"""The Intervention Brain: a LangGraph state machine that decides WHEN to interrupt,
HOW (voice, house, or a family rule), and HOW OFTEN (the annoyance budget).

Three kinds of event enter the graph:

  tick       score_drift -> check_policy -> gate -> check_budget -> choose_channel
             -> find_breakpoint -> act -> log
  utterance  hear -> explain | accept | judge | rule_held | chat -> log
  timeout    timeout -> log

Every path ends in `log`, so every decision (including "held back") is written down
with a reason a parent can read. The LLM is only ever asked for words: the dare, the
quest, the judge's opinion. Whether and when to act is decided by the plain code here.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from . import config
from .agents import creator, judge as judge_agent, living_video, quest as quest_agent
from .agents.house import House
from .breakpoints import next_breakpoint
from .bus import Bus
from .drift import drift_score
from .llm import LLM
from .policy import evaluate, parse_hhmm
from .rag import LiveIndex
from .store import Store
from .text import has_any
from .videos import Catalogue


@dataclass
class Session:
    video_id: str | None = None
    t: float = 0.0
    playing: bool = False
    clock_min: float = 0.0            # session clock; runs DEMO_SPEED times faster than real time
    watch_min: float = 0.0            # passive minutes in the current sitting
    shorts_min: float = 0.0
    passive_today: float = 0.0
    active_today: float = 0.0
    minutes_today: dict = field(default_factory=dict)
    interactions: list = field(default_factory=list)
    still_min: float | None = None    # None until a watch reports
    steps: int = 0
    phase: str = "watching"           # watching | prepared | interrupted | quest
    pending: dict | None = None
    extension_until: float | None = None
    promised: bool = False
    declines: int = 0
    house_tried: bool = False
    gave_up: bool = False
    homework_done: bool = False
    pretend_time: str | None = None
    speed: float = config.DEMO_SPEED
    drift: dict = field(default_factory=lambda: {"score": 0.0, "parts": {}})
    verdict: dict = field(default_factory=dict)
    held_back: str | None = None
    last_stop: str | None = None
    winddown: bool = False
    quest_id: str | None = None
    quest_started: float = 0.0
    steps_at_offer: int = 0


class BrainState(TypedDict, total=False):
    event: dict
    stop: str            # why nothing happened
    channel: str
    breakpoint: dict
    decision: dict       # what happened, already written to the log
    intent: str


class NullTimers:
    def start(self, key: str, seconds: float) -> None: ...
    def cancel(self, key: str | None = None) -> None: ...


class Brain:
    def __init__(self, *, bus: Bus, llm: LLM, store: Store, catalogue: Catalogue, index: LiveIndex,
                 house: House, timers: Any = None) -> None:
        self.bus, self.llm, self.store = bus, llm, store
        self.catalogue, self.index, self.house = catalogue, index, house
        self.timers = timers or NullTimers()
        self.s = Session()
        self.lock = asyncio.Lock()
        self._ingested: dict[str, int] = {}
        self.graph = self._build()

    # ------------------------------------------------------------------ graph
    def _build(self):
        g = StateGraph(BrainState)
        for name in ("score_drift", "check_policy", "gate", "check_budget", "choose_channel", "find_breakpoint",
                     "act", "hear", "explain", "accept", "judge", "rule_held", "chat", "timeout", "log"):
            g.add_node(name, getattr(self, f"_{name}"))

        g.add_conditional_edges(START, lambda st: st["event"]["kind"],
                                {"tick": "score_drift", "utterance": "hear", "timeout": "timeout"})
        g.add_edge("score_drift", "check_policy")

        def after_policy(st: BrainState) -> str:
            if st.get("stop"):
                return "log"
            return "act" if st.get("channel") == "enforce" else "gate"

        g.add_conditional_edges("check_policy", after_policy, {"log": "log", "act": "act", "gate": "gate"})
        carry_on = lambda nxt: (lambda st: "log" if st.get("stop") else nxt)  # noqa: E731
        g.add_conditional_edges("gate", carry_on("check_budget"), {"log": "log", "check_budget": "check_budget"})
        g.add_conditional_edges("check_budget", carry_on("choose_channel"), {"log": "log", "choose_channel": "choose_channel"})
        g.add_conditional_edges("choose_channel", lambda st: "act" if st["channel"] == "house" else "find_breakpoint",
                                {"act": "act", "find_breakpoint": "find_breakpoint"})
        g.add_conditional_edges("find_breakpoint", carry_on("act"), {"log": "log", "act": "act"})
        g.add_edge("act", "log")

        g.add_conditional_edges("hear", lambda st: st["intent"],
                                {i: i for i in ("explain", "accept", "judge", "rule_held", "chat")})
        for name in ("explain", "accept", "judge", "rule_held", "chat", "timeout"):
            g.add_edge(name, "log")
        g.add_edge("log", END)
        return g.compile()

    # ------------------------------------------------------------ entry points
    async def on_tick(self, data: dict) -> None:
        async with self.lock:
            s = self.s
            dt = max(0.0, min(float(data.get("dt", 1.0)), 5.0))
            dmin = dt * s.speed / 60.0
            s.clock_min += dmin
            video_id = data.get("video_id")
            if video_id != s.video_id:
                await self._video_changed(video_id)
            s.t, s.playing = float(data.get("t", 0.0)), bool(data.get("playing"))
            video = self.catalogue.get(video_id) if video_id else None
            if video:
                self._ingest(video)

            if s.phase == "quest":
                s.active_today += dmin
            elif s.playing and video:
                category = video.get("category", "other")
                s.watch_min += dmin
                s.passive_today += dmin
                s.minutes_today[category] = s.minutes_today.get(category, 0.0) + dmin
                if category == "shorts":
                    s.shorts_min += dmin
                self.store.note_interest(video.get("topics", []), watched_min=dmin, save=False)

            if s.phase == "prepared" and s.t > s.pending["at"] + 12:
                # The page never confirmed the pause (tab closed, video scrubbed past).
                self._close(s.pending["decision_id"], "missed")
                s.phase, s.pending = "watching", None
            elif s.phase == "interrupted" and s.pending and s.pending["kind"] == "enforce" and video:
                still_blocked = not evaluate(self.store.active_rules(), video.get("category", "other"), self.now(),
                                             s.homework_done, s.minutes_today).allowed
                if not still_blocked:
                    # A parent changed something (homework marked done, rule removed).
                    s.phase, s.pending = "watching", None
                    await self.bus.emit("player/cmd", {"cmd": "resume", "line": "You're clear now. Enjoy.",
                                                       "companion": self.store.profile["companion"]}, roles=("child",))
                elif s.playing:
                    await self.bus.emit("player/cmd", {"cmd": "pause"}, roles=("child",))
            elif s.phase == "interrupted" and s.playing and s.pending:
                if s.pending["kind"] == "dare":
                    await self._decline("declined", "The child pressed play instead of answering.")
            elif s.phase == "watching" and video and (s.playing or data.get("ended")):
                await self.graph.ainvoke({"event": {"kind": "tick", "ended": bool(data.get("ended"))}})
            await self._publish_state()

    async def on_interaction(self, data: dict) -> None:
        self.s.interactions.append(self.s.clock_min)

    async def on_interrupted(self, data: dict) -> None:
        """The child page paused the video and started speaking the line."""
        async with self.lock:
            s = self.s
            if s.phase != "prepared" or not s.pending or s.pending["decision_id"] != data.get("decision_id"):
                return
            s.phase = "interrupted"
            self.store.update_decision(s.pending["decision_id"], late_ms=data.get("late_ms"))
            self.timers.start(s.pending["decision_id"], config.VOICE_REPLY_TIMEOUT_S)

    async def on_utterance(self, data: dict) -> None:
        text = str(data.get("text", "")).strip()
        if not text:
            return
        async with self.lock:
            self.s.interactions.append(self.s.clock_min)
            if self.s.pending and data.get("barge_in"):
                self.store.update_decision(self.s.pending["decision_id"], barged_in=True, barge_ms=data.get("barge_ms"))
            await self.graph.ainvoke({"event": {"kind": "utterance", "text": text}})
            await self._publish_state()

    async def on_timeout(self, decision_id: str) -> None:
        async with self.lock:
            if self.s.pending and self.s.pending["decision_id"] == decision_id:
                await self.graph.ainvoke({"event": {"kind": "timeout"}})
                await self._publish_state()

    async def on_body(self, data: dict) -> None:
        async with self.lock:
            s = self.s
            if "still_min" in data:
                s.still_min = None if data["still_min"] is None else float(data["still_min"])
            if "steps" in data:
                s.steps = int(data["steps"])
            p = s.pending
            if p and p["kind"] == "house" and not p.get("walked") and s.steps - s.steps_at_offer >= 10:
                p["walked"] = True
                quest = self.store.quests[p["quest_id"]]
                await self.bus.emit("tv/show", {"screen": "quest", "quest": public(quest), "state": "offered"})
            await self._publish_state()

    async def on_bad_timing(self, data: dict) -> None:
        async with self.lock:
            if self.store.update_decision(data.get("decision_id", ""), false_interrupt=True):
                self.store.budget.learn("bad_timing")
                await self._publish_state()

    async def accept_quest(self) -> dict | None:
        """The child tapped Accept on the quest card (same as saying yes)."""
        async with self.lock:
            if not self.s.pending or self.s.pending["kind"] not in ("dare", "house"):
                return None
            await self.graph.ainvoke({"event": {"kind": "utterance", "text": "yes"}})
            await self._publish_state()
            return public(self.store.quests[self.s.quest_id]) if self.s.quest_id else None

    async def submit_proof(self, quest_id: str, proof: dict) -> dict:
        async with self.lock:
            s, quest = self.s, self.store.quests.get(quest_id)
            if not quest or quest["status"] != "active":
                return {"ok": False, "note": "That quest is not running."}
            images = proof.get("images_b64") or ([proof["image_b64"]] if proof.get("image_b64") else [])
            if proof.get("kind") == "photo" and images:
                quest["photos"] = (quest["photos"] + images)[-5:]
                proof = {**proof, "image_b64": images[0]}
            if proof.get("kind") == "steps":
                proof = {**proof, "steps": s.steps - quest.get("steps_at_start", 0)}
            result = await quest_agent.verify(self.llm, quest, proof)
            if not result["ok"]:
                return result
            minutes = round(s.clock_min - s.quest_started, 1)
            reward = self.store.rewards.award()
            quest.update(status="complete", minutes_taken=minutes, verified_by=result["verified_by"],
                         proof_note=result["note"], reward=reward)
            self.store.put_quest(quest)
            video = self.catalogue.get(quest.get("video_id") or "") or {}
            self.store.note_interest(list(dict.fromkeys([quest["topic"]] + video.get("topics", [])[:1])), did=1)
            decision = self.store.log({
                "clock_min": round(s.clock_min, 1), "kind": "quest_complete", "channel": "quest", "outcome": "complete",
                "reason": f'Quest "{quest["title"]}" finished in {minutes} min. Proof check: {result["verified_by"]}. '
                          f"Reward: {reward} sparks (capped at {config.REWARD_DAILY_CAP} a day).",
                "quest_id": quest_id})
            await self.bus.emit("log/decision", decision, roles=("parent",))
            await self.house.restore()
            await self.bus.emit("quest/update", {"state": "complete", "quest": public(quest), "note": result["note"],
                                                 "reward": reward, "sparks": self.store.rewards.sparks})
            film = await creator.script(self.llm, {
                "child_name": self.store.profile["name"], "age": self.store.profile["age"],
                "quest": {k: quest[k] for k in ("title", "mission", "steps")}, "inspired_by": quest.get("video_title"),
                "proof_note": result["note"] if result["confidence"] >= 0.5 else "", "minutes_taken": minutes,
                "scene_count": max(3, min(5, len(quest["photos"]) + 2))})
            self.store.note_interest([quest["topic"]], made=1)
            await self.bus.emit("tv/show", {"screen": "documentary", "film": film, "photos": quest["photos"],
                                            "child": self.store.profile["name"]})
            self._new_sitting()
            await self._publish_state()
            return {**result, "reward": reward, "film": film}

    async def abandon_quest(self) -> None:
        async with self.lock:
            s = self.s
            if s.phase != "quest":
                return
            quest = self.store.quests[s.quest_id]
            quest["status"] = "abandoned"
            self.store.put_quest(quest)
            await self.house.restore()
            await self.bus.emit("quest/update", {"state": "none"})
            await self.bus.emit("tv/show", {"screen": "idle"})
            s.phase, s.quest_id = "watching", None
            await self._publish_state()

    def new_day(self) -> None:
        s = self.s
        s.minutes_today, s.passive_today, s.active_today = {}, 0.0, 0.0
        self.store.extensions_today = 0
        self.store.rewards.new_day()
        self._new_sitting()

    # ------------------------------------------------------------- tick nodes
    async def _score_drift(self, st: BrainState) -> dict:
        s = self.s
        recent = [t for t in s.interactions if s.clock_min - t <= 10]
        s.interactions = recent
        s.drift = drift_score(s.watch_min, s.shorts_min, len(recent), s.still_min)
        return {}

    async def _check_policy(self, st: BrainState) -> dict:
        s = self.s
        if config.age_mode(self.store.profile["age"]) == "pilot":
            return {"stop": "pilot mode: teens get a mirror, never an interruption"}
        video = self.catalogue.get(s.video_id)
        verdict = evaluate(self.store.active_rules(), video.get("category", "other"), self.now(),
                           s.homework_done, s.minutes_today)
        s.verdict = verdict.model_dump()
        if verdict.allowed and s.winddown:
            s.winddown = False
            await self.house.restore()
            await self.bus.emit("tv/show", {"screen": "idle"})
        return {} if verdict.allowed else {"channel": "enforce"}

    async def _gate(self, st: BrainState) -> dict:
        s = self.s
        if s.gave_up:
            return {"stop": "backed off for this sitting"}
        if s.extension_until is not None and s.clock_min < s.extension_until:
            return {"stop": f"extension running for {s.extension_until - s.clock_min:.0f} more min"}
        if s.drift["score"] < config.DRIFT_THRESHOLD and not s.promised:
            return {"stop": "not drifting"}
        return {}

    async def _check_budget(self, st: BrainState) -> dict:
        ok, why = self.store.budget.check(self.s.clock_min, promised=self.s.promised)
        return {} if ok else {"stop": f"budget: {why}"}

    async def _choose_channel(self, st: BrainState) -> dict:
        s = self.s
        house = s.declines >= 1 and s.watch_min >= config.HOUSE_AFTER_MIN and not s.house_tried
        return {"channel": "house" if house else "voice"}

    async def _find_breakpoint(self, st: BrainState) -> dict:
        s, video = self.s, self.catalogue.get(self.s.video_id)
        if video.get("breakpoints"):
            bp = next_breakpoint(video["breakpoints"], s.t, config.BREAKPOINT_LEAD_S, config.BREAKPOINT_LOOKAHEAD_S)
        elif st["event"].get("ended"):
            bp = {"t": s.t, "score": 1.0, "why": "the video ended"}
        else:
            bp = None
        if not bp:
            return {"stop": "waiting for a natural breakpoint"}
        return {"breakpoint": bp}

    async def _act(self, st: BrainState) -> dict:
        channel = st["channel"]
        if channel == "enforce":
            return {"decision": await self._act_enforce()}
        if channel == "house":
            return {"decision": await self._act_house()}
        return {"decision": await self._act_dare(st["breakpoint"])}

    async def _act_dare(self, bp: dict) -> dict:
        s, video, profile = self.s, self.catalogue.get(self.s.video_id), self.store.profile
        watched = self.index.window(s.video_id, s.t - 90, s.t)
        started = time.perf_counter()
        dare = await living_video.dare(self.llm, {
            "companion": profile["companion"], "child_name": profile["name"], "age": profile["age"],
            "mode": config.age_mode(profile["age"]), "video_title": video["title"], "just_watched": watched,
            "minutes_watching": round(s.watch_min)})
        gen_ms = round((time.perf_counter() - started) * 1000)
        promised = s.promised
        why = ("the extra time agreed earlier ran out" if promised else
               f"drift reached {s.drift['score']:.2f} (threshold {config.DRIFT_THRESHOLD}) after {s.watch_min:.0f} min of passive watching")
        decision = self.store.log({
            "clock_min": round(s.clock_min, 1), "kind": "dare", "channel": "voice", "outcome": "pending",
            "reason": f"Paused at a natural breakpoint ({bp['why']}) because {why}.",
            "child_reason": f"you had been watching for {s.watch_min:.0f} minutes and the video reached a natural pause, "
                            f"so I suggested a challenge instead of the next part",
            "line": dare["line"], "by": dare["by"], "gen_ms": gen_ms, "drift": s.drift, "breakpoint": bp,
            "video": video["title"]})
        self.store.budget.spend(s.clock_min)
        s.promised, s.extension_until = False, None
        s.phase = "prepared"
        s.pending = {"decision_id": decision["id"], "kind": "dare", "round": 1, "counter": None,
                     "challenge": dare["challenge"], "at": bp["t"], "video_id": s.video_id}
        await self.bus.emit("player/cmd", {"cmd": "interrupt", "at": bp["t"], "line": dare["line"],
                                           "decision_id": decision["id"], "companion": profile["companion"]},
                            roles=("child",))
        return decision

    async def _act_house(self) -> dict:
        s = self.s
        quest = await self._make_quest(challenge=None)
        decision = self.store.log({
            "clock_min": round(s.clock_min, 1), "kind": "house", "channel": "house", "outcome": "pending",
            "reason": f"{s.watch_min:.0f} min of passive watching and the voice suggestion was declined, so the "
                      f"living room shifted to a sunrise scene and the TV offered a quest. The video was not paused.",
            "child_reason": f"you had been watching for {s.watch_min:.0f} minutes and said no to my challenge, "
                            f"so I asked the living room to show you something to do",
            "drift": s.drift, "by": quest["by"], "quest_id": quest["id"], "smartthings": self.house.state()["mode"]})
        self.store.budget.spend(s.clock_min)
        s.promised, s.extension_until = False, None
        s.house_tried, s.steps_at_offer = True, s.steps
        s.phase = "interrupted"
        s.pending = {"decision_id": decision["id"], "kind": "house", "round": 1, "counter": None,
                     "quest_id": quest["id"], "video_id": s.video_id}
        await self.house.sunrise()
        await self.bus.emit("tv/show", {"screen": "portal", "quest": public(quest), "child": self.store.profile["name"]})
        await self.bus.emit("quest/update", {"state": "offered", "quest": public(quest), "via": "house",
                                             "decision_id": decision["id"]})
        self.timers.start(decision["id"], config.HOUSE_REPLY_TIMEOUT_S)
        return decision

    async def _act_enforce(self) -> dict:
        s, verdict = self.s, self.s.verdict
        now = self.now()
        allowed = [v for v in self.catalogue.listing()
                   if evaluate(self.store.active_rules(), v.get("category", "other"), now, s.homework_done,
                               s.minutes_today).allowed]
        rule = self.store.rules.get(verdict["rule_id"])
        bedtime = bool(rule and rule.effect == "block" and not rule.categories and (rule.time_start or rule.time_end))
        if bedtime:
            line = "It is screens-off time in this house now. The lights are winding down too. See you tomorrow."
        else:
            line = verdict["reason"].replace("Family rule: ", "That one is a family rule. ")
            line += " Pick something else, or say quest." if allowed else " Say quest if you want something to do."
        decision = self.store.log({
            "clock_min": round(s.clock_min, 1), "kind": "enforce", "channel": "rule", "outcome": "enforced",
            "reason": verdict["reason"], "child_reason": "of a family rule. " + verdict["reason"].replace("Family rule: ", ""),
            "line": line, "rule_id": verdict["rule_id"], "video": self.catalogue.get(s.video_id)["title"], "by": "policy engine"})
        s.phase = "interrupted"
        s.pending = {"decision_id": decision["id"], "kind": "enforce", "round": 1, "video_id": s.video_id}
        await self.bus.emit("player/cmd", {"cmd": "enforce", "line": line, "decision_id": decision["id"],
                                           "alternatives": allowed, "companion": self.store.profile["companion"]},
                            roles=("child",))
        if bedtime and not s.winddown:
            # A whole-screen curfew is bedtime: the home winds down with the child.
            s.winddown = True
            await self.house.winddown()
            await self.bus.emit("tv/show", {"screen": "winddown"})
        return decision

    # -------------------------------------------------------- utterance nodes
    async def _hear(self, st: BrainState) -> dict:
        text, p = st["event"]["text"], self.s.pending
        intent = judge_agent.classify(text)
        if intent == "why":
            return {"intent": "explain"}
        if self.s.phase == "quest":
            return {"intent": "chat"}
        if p is None:
            wants = has_any(text, ["quest", "challenge", "bored", "something to do", "mission"])
            return {"intent": "accept" if wants else "chat"}
        if p["kind"] == "enforce":
            return {"intent": "accept" if has_any(text, ["quest", "challenge", "mission"]) else "rule_held"}
        return {"intent": "accept" if intent == "accept" else "judge"}

    async def _explain(self, st: BrainState) -> dict:
        last = next((d for d in reversed(self.store.decisions) if d.get("child_reason")), None)
        line = f"Because {last['child_reason']}." if last else "I have not done anything yet. I am just watching along with you."
        await self._say(line, listen=bool(self.s.pending and self.s.pending["kind"] != "enforce"))
        if self.s.pending and self.s.pending["kind"] == "dare":
            self.timers.start(self.s.pending["decision_id"], config.VOICE_REPLY_TIMEOUT_S)
        return {"decision": self._log_reply("explain", "The child asked why, and was told the logged reason.", line)}

    async def _accept(self, st: BrainState) -> dict:
        s, p = self.s, self.s.pending
        if p and p["kind"] == "dare" and p.get("counter"):
            return {"decision": await self._grant(p["counter"], f"Deal. {p['counter']} more minutes, then the challenge.",
                                                  "The child accepted the smaller deal NEST offered.")}
        if p and p["kind"] == "house":
            quest = self.store.quests[p["quest_id"]]
        else:
            quest = await self._make_quest(challenge=p.get("challenge") if p else None)
        if p:
            self.timers.cancel(p["decision_id"])
            if p["kind"] != "enforce":
                self._close(p["decision_id"], "accepted")
                self.store.budget.learn("accepted")
        quest.update(status="active", steps_at_start=s.steps)
        self.store.put_quest(quest)
        if self.house.scene != "sunrise":
            await self.house.sunrise()      # an adventure has started: the room says so too
        s.phase, s.pending, s.quest_id, s.quest_started = "quest", None, quest["id"], s.clock_min
        line = f"Challenge accepted. {quest['mission']} Your timer starts now."
        await self.bus.emit("player/cmd", {"cmd": "pause"}, roles=("child",))
        await self.bus.emit("quest/update", {"state": "active", "quest": public(quest)})
        await self.bus.emit("tv/show", {"screen": "quest", "quest": public(quest), "state": "active"})
        await self._say(line)
        return {"decision": self._log_reply("quest_start", f'The child accepted. Quest "{quest["title"]}" started '
                                                           f'({quest["by"]} quest, proof by {quest["proof"]}).', line)}

    async def _judge(self, st: BrainState) -> dict:
        s, p, profile = self.s, self.s.pending, self.store.profile
        video = self.catalogue.get(s.video_id) or {}
        max_minutes = 0 if self.store.extensions_today >= config.MAX_EXTENSIONS_PER_DAY else config.MAX_EXTENSION_MIN
        if s.verdict.get("minutes_left") is not None:
            max_minutes = int(min(max_minutes, s.verdict["minutes_left"]))
        left = video.get("duration", 0) - s.t if video.get("duration") and not video.get("loop") else None
        result = await judge_agent.judge(self.llm, {
            "child_said": st["event"]["text"], "child_name": profile["name"], "age": profile["age"],
            "video_title": video.get("title"), "video_seconds_left": left, "round": p["round"],
            "max_minutes": max_minutes, "earlier_offer": p.get("counter")})
        if result["verdict"] == "grant":
            return {"decision": await self._grant(result["minutes"], result["reply"], result["reason"], result["by"])}
        if result["verdict"] == "counter":
            p["round"], p["counter"] = 2, result["minutes"] or None
            await self._say(result["reply"], listen=True)
            self.timers.start(p["decision_id"], config.VOICE_REPLY_TIMEOUT_S if p["kind"] == "dare" else config.HOUSE_REPLY_TIMEOUT_S)
            return {"decision": self._log_reply("argument", result["reason"], result["reply"], result["by"],
                                                child_said=st["event"]["text"], verdict="counter")}
        await self._decline("declined", result["reason"], line=result["reply"])
        return {"decision": self._log_reply("argument", result["reason"], result["reply"], result["by"],
                                            child_said=st["event"]["text"], verdict="back_off")}

    async def _rule_held(self, st: BrainState) -> dict:
        line = "That is a family rule, so I can't change it. You can ask your grown-up, or pick something else."
        await self._say(line)
        return {"decision": self._log_reply("rule_held", "The child argued against a family rule. Family rules are "
                                                         "not negotiable by the agent; only a parent can change them.",
                                            line, child_said=st["event"]["text"])}

    async def _chat(self, st: BrainState) -> dict:
        if self.s.phase == "quest":
            line = "You are on a quest. Send me your proof when it is done, and I will take a look."
        else:
            line = "I am here. Say quest if you want a challenge, or ask me why I did something."
        await self._say(line)
        return {}

    async def _timeout(self, st: BrainState) -> dict:
        p = self.s.pending
        if p["kind"] == "house":
            reason = (f"No response to the house scene within {config.HOUSE_REPLY_TIMEOUT_S:.0f} s. NEST restored the "
                      f"lights and stopped suggesting for this sitting. Worth a conversation later, not a fight now.")
        else:
            reason = f"No answer within {config.VOICE_REPLY_TIMEOUT_S:.0f} s, so the video resumed by itself."
        await self._decline("ignored", reason)
        return {"decision": self._log_reply("gave_up" if p["kind"] == "house" else "ignored", reason, None)}

    async def _log(self, st: BrainState) -> dict:
        s = self.s
        if st.get("decision"):
            s.held_back = None
            await self.bus.emit("log/decision", st["decision"], roles=("parent",))
        elif st.get("stop", "").startswith("budget") and s.held_back != "budget":
            # Restraint is a decision too. Logged once per episode, not every tick.
            s.held_back = "budget"
            entry = self.store.log({"clock_min": round(s.clock_min, 1), "kind": "held_back", "channel": "none",
                                    "outcome": "no action", "drift": s.drift,
                                    "reason": f"Drift is {s.drift['score']:.2f} but NEST held back. Annoyance {st['stop']}."})
            await self.bus.emit("log/decision", entry, roles=("parent",))
        s.last_stop = st.get("stop")
        return {}

    # ----------------------------------------------------------------- helpers
    def now(self) -> datetime:
        now = datetime.now()
        if self.s.pretend_time:
            t = parse_hhmm(self.s.pretend_time)
            now = now.replace(hour=t.hour, minute=t.minute, second=0)
        return now

    async def _say(self, line: str, listen: bool = False) -> None:
        await self.bus.emit("player/cmd", {"cmd": "say", "line": line, "listen": listen,
                                           "companion": self.store.profile["companion"]}, roles=("child",))

    def _log_reply(self, kind: str, reason: str, line: str | None, by: str = "scripted", **extra) -> dict:
        return self.store.log({"clock_min": round(self.s.clock_min, 1), "kind": kind, "channel": "voice",
                               "outcome": extra.pop("verdict", "done"), "reason": reason, "line": line, "by": by, **extra})

    def _close(self, decision_id: str, outcome: str) -> None:
        self.store.update_decision(decision_id, outcome=outcome)

    async def _grant(self, minutes: int, line: str, reason: str, by: str = "scripted") -> dict:
        s, p = self.s, self.s.pending
        self.timers.cancel(p["decision_id"])
        self._close(p["decision_id"], "extended")
        self.store.budget.learn("extended")
        self.store.extensions_today += 1
        s.extension_until, s.promised = s.clock_min + minutes, True
        s.declines += 1
        await self._release(p, line)
        return self._log_reply("argument", reason, line, by, verdict="grant", minutes=minutes)

    async def _decline(self, outcome: str, reason: str, line: str | None = None) -> None:
        s, p = self.s, self.s.pending
        self.timers.cancel(p["decision_id"])
        self._close(p["decision_id"], outcome)
        self.store.budget.learn(outcome)
        s.declines += 1
        if p["kind"] == "house":
            s.gave_up = True
        await self._release(p, line)

    async def _release(self, p: dict, line: str | None) -> None:
        """Let the child carry on: resume the video, put the house back."""
        s = self.s
        s.phase, s.pending = "watching", None
        if p["kind"] == "house":
            quest = self.store.quests.get(p["quest_id"])
            if quest:
                quest["status"] = "expired"
                self.store.put_quest(quest)
            await self.house.restore()
            await self.bus.emit("tv/show", {"screen": "idle"})
            await self.bus.emit("quest/update", {"state": "none"})
            if line:
                await self._say(line)
        else:
            await self.bus.emit("player/cmd", {"cmd": "resume", "line": line, "companion": self.store.profile["companion"]},
                                roles=("child",))

    async def _make_quest(self, challenge: str | None) -> dict:
        s, profile = self.s, self.store.profile
        video = self.catalogue.get(s.video_id) or {"title": "", "id": None}
        watched = self.index.window(s.video_id, max(0, s.t - 180), s.t) if s.video_id else ""
        quest = await quest_agent.create(self.llm, {
            "child_name": profile["name"], "age": profile["age"], "mode": config.age_mode(profile["age"]),
            "video_id": video.get("id"), "video_title": video.get("title"), "watched": watched,
            "challenge": challenge, "fridge": []})
        return self.store.put_quest(quest)

    async def _video_changed(self, video_id: str | None) -> None:
        s = self.s
        s.video_id = video_id
        if s.pending and s.pending["kind"] in ("dare", "enforce") and s.pending.get("video_id") != video_id:
            if s.pending["kind"] == "dare":
                self.timers.cancel(s.pending["decision_id"])
                self._close(s.pending["decision_id"], "video changed")
            s.phase, s.pending = "watching", None

    def _ingest(self, video: dict) -> None:
        """Streaming RAG: index caption lines as playback reaches them."""
        i, segments = self._ingested.get(video["id"], 0), video["segments"]
        while i < len(segments) and segments[i]["start"] <= self.s.t:
            seg = segments[i]
            self.index.add(video["id"], seg["start"], seg["start"] + seg.get("dur", 0), seg["text"])
            i += 1
        self._ingested[video["id"]] = i

    def _new_sitting(self) -> None:
        s = self.s
        s.phase, s.pending, s.quest_id = "watching", None, None
        s.watch_min = s.shorts_min = 0.0
        s.declines, s.house_tried, s.gave_up = 0, False, False
        s.extension_until, s.promised, s.held_back = None, False, None
        self.store.save_profile()

    def snapshot(self) -> dict:
        s, b = self.s, self.store.budget
        return {
            "phase": s.phase, "pending": s.pending["kind"] if s.pending else None, "drift": s.drift,
            "threshold": config.DRIFT_THRESHOLD, "watch_min": round(s.watch_min, 1), "clock_min": round(s.clock_min, 1),
            "speed": s.speed, "passive_today": round(s.passive_today, 1), "active_today": round(s.active_today, 1),
            "budget": {"gap_min": b.gap_min, "left_this_hour": b.left_this_hour(s.clock_min), "max_per_hour": b.max_per_hour},
            "extension_left": round(s.extension_until - s.clock_min, 1) if s.extension_until and s.extension_until > s.clock_min else 0,
            "extensions_today": self.store.extensions_today, "declines": s.declines, "gave_up": s.gave_up,
            "homework_done": s.homework_done, "pretend_time": s.pretend_time, "still_min": s.still_min, "steps": s.steps,
            "verdict": s.verdict, "waiting": s.last_stop, "video_id": s.video_id,
            "now": self.now().strftime("%H:%M"),
        }

    async def _publish_state(self) -> None:
        await self.bus.emit("brain/state", self.snapshot(), roles=("parent", "tv"))


def public(quest: dict) -> dict:
    """A quest without its photo payloads, safe to broadcast on every tick."""
    return {k: v for k, v in quest.items() if k != "photos"}

"""Tests for the parts of PORTAL that must be right: policy, the rule compiler,
the Brain's decision paths, and the Game Forge validation loop.

All of these run without a local model, so they exercise the scripted paths plus (via a
fake Ollama transport) the model-handling code.
"""
import asyncio
import json
from datetime import datetime

import httpx
import pytest

from hub import config, metrics
from hub.agents import game_forge, judge, parent_voice, quest
from hub.agents.house import House
from hub.brain import Brain
from hub.breakpoints import find_breakpoints, next_breakpoint
from hub.budget import AnnoyanceBudget, Rewards
from hub.bus import Bus
from hub.drift import drift_score
from hub.llm import LLM, parse_json
from hub.policy import Rule, describe, evaluate, in_window
from hub.rag import LiveIndex
from hub.store import Store
from hub.videos import Catalogue

NOON = datetime(2026, 10, 2, 12, 0)     # a Friday
NIGHT = datetime(2026, 10, 2, 21, 30)


def run(coro):
    return asyncio.run(coro)


def active(**kw) -> Rule:
    return Rule(id=kw.pop("id", "r1"), status="active", **kw)


# ------------------------------------------------------------------- policy
def test_block_beats_allow():
    rules = [active(id="a", effect="allow", categories=["shorts"]), active(id="b", effect="block", categories=["shorts"])]
    verdict = evaluate(rules, "shorts", NOON, True, {})
    assert not verdict.allowed and verdict.rule_id == "b" and verdict.kind == "blocked"


def test_allow_after_homework():
    rules = [active(effect="allow", categories=["cartoon"], after_homework=True)]
    assert not evaluate(rules, "cartoon", NOON, False, {}).allowed
    assert evaluate(rules, "cartoon", NOON, True, {}).allowed
    assert evaluate(rules, "gaming", NOON, False, {}).allowed      # rule does not cover gaming


def test_window_crossing_midnight():
    assert in_window(NIGHT.time(), "21:00", "07:00")
    assert in_window(datetime(2026, 1, 1, 6, 0).time(), "21:00", "07:00")
    assert not in_window(NOON.time(), "21:00", "07:00")
    rules = [active(effect="block", time_start="21:00", time_end="07:00")]
    assert not evaluate(rules, "educational", NIGHT, True, {}).allowed
    assert evaluate(rules, "educational", NOON, True, {}).allowed


def test_daily_limit_and_minutes_left():
    rules = [active(effect="limit", categories=["gaming"], limit_minutes=30)]
    assert evaluate(rules, "gaming", NOON, True, {"gaming": 12}).minutes_left == 18
    over = evaluate(rules, "gaming", NOON, True, {"gaming": 31})
    assert not over.allowed and over.kind == "limit_reached"


def test_draft_rules_are_not_enforced():
    rules = [Rule(id="d", effect="block", categories=["shorts"], status="draft")]
    assert evaluate(rules, "shorts", NOON, True, {}).allowed


def test_days_filter():
    rules = [active(effect="block", categories=["gaming"], days=["sat", "sun"])]
    assert evaluate(rules, "gaming", NOON, True, {}).allowed                       # Friday
    assert not evaluate(rules, "gaming", datetime(2026, 10, 3, 12, 0), True, {}).allowed  # Saturday


# ------------------------------------------------------------- parent voice
def compile_scripted(text):
    return run(parent_voice.compile_rules(LLM(), text))


def test_two_rules_from_one_sentence():
    rules = compile_scripted("Cartoon is fine after homework, but no shorts reels ever.")
    assert len(rules) == 2
    cartoon, shorts = rules
    assert (cartoon.effect, cartoon.categories, cartoon.after_homework) == ("allow", ["cartoon"], True)
    assert (shorts.effect, shorts.categories) == ("block", ["shorts"])
    assert all(r.status == "draft" for r in rules)
    assert describe(shorts) == "Never allow shorts and reels."


def test_hinglish_and_devanagari():
    a, b = compile_scripted("Homework ke baad cartoon theek hai, lekin reels bilkul nahi")
    assert (a.effect, a.categories, a.after_homework, a.language) == ("allow", ["cartoon"], True, "hi")
    assert (b.effect, b.categories) == ("block", ["shorts"])
    c, d = compile_scripted("होमवर्क के बाद कार्टून ठीक है, लेकिन रील्स कभी नहीं")
    assert (c.effect, c.categories, c.after_homework) == ("allow", ["cartoon"], True)
    assert (d.effect, d.categories) == ("block", ["shorts"])


def test_open_ended_block_asks_once_then_resolves():
    (rule,) = compile_scripted("No phone after 9 pm")
    assert rule.effect == "block" and rule.categories == [] and rule.time_start == "21:00"
    assert rule.status == "needs_clarification" and rule.clarify_field == "time_end"
    parent_voice.apply_answer(rule, "7 in the morning")
    assert rule.status == "draft" and rule.time_end == "07:00" and rule.clarify_question is None


def test_limit_parsing():
    (rule,) = compile_scripted("Only one hour of gaming a day")
    assert (rule.effect, rule.categories, rule.limit_minutes) == ("limit", ["gaming"], 60)
    (half,) = compile_scripted("gaming sirf aadha ghanta")
    assert half.limit_minutes == 30


def test_vague_rule_asks_what_content():
    (rule,) = compile_scripted("no bad stuff")
    assert rule.status == "needs_clarification" and rule.clarify_field == "categories"
    parent_voice.apply_answer(rule, "reels and gaming")
    assert rule.status == "draft" and set(rule.categories) == {"shorts", "gaming"}


def fake_ollama(reply: dict | str, vision: bool = False) -> LLM:
    """An LLM wired to a fake Ollama server that answers every chat with `reply`."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "gemma3:4b"}, {"name": "nomic-embed-text"}]})
        if request.url.path == "/api/show":
            return httpx.Response(200, json={"capabilities": ["completion"] + (["vision"] if vision else [])})
        content = reply if isinstance(reply, str) else json.dumps(reply)
        return httpx.Response(200, json={"message": {"content": content}})

    llm = LLM(transport=httpx.MockTransport(handler))
    run(llm.probe())
    return llm


def test_model_path_is_used_and_checked():
    llm = fake_ollama({"language": "ta", "rules": [
        {"effect": "block", "categories": ["shorts", "nonsense"], "time_start": "21:00", "time_end": None}]})
    assert llm.available and llm.model == "gemma3:4b"
    (rule,) = run(parent_voice.compile_rules(llm, "iravu 9 manikku mel reels vendam"))
    assert rule.compiled_by == "model" and rule.language == "ta" and rule.categories == ["shorts"]
    # The deterministic check still catches the missing end time the model did not ask about.
    assert rule.status == "needs_clarification" and rule.clarify_field == "time_end"


def test_bad_model_output_falls_back_to_scripted():
    llm = fake_ollama("Sure! Here are your rules: none.")
    rules = run(parent_voice.compile_rules(llm, "no reels ever"))
    assert rules[0].compiled_by == "scripted" and rules[0].categories == ["shorts"]


def test_parse_json_digs_out_fenced_objects():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Here you go: {"a": {"b": 2}} hope that helps') == {"a": {"b": 2}}
    with pytest.raises(ValueError):
        parse_json("no json here")


# ----------------------------------------------- drift, breakpoints, budget
def test_drift_rises_with_time_and_short_form():
    fresh = drift_score(2, 0, 0, None)["score"]
    long_form = drift_score(40, 0, 0, None)["score"]
    shorts = drift_score(10, 10, 0, None)["score"]
    assert fresh < 0.3 < config.DRIFT_THRESHOLD <= long_form
    assert shorts >= config.DRIFT_THRESHOLD
    assert drift_score(40, 0, 3, None)["score"] < long_form        # an engaged child drifts less
    assert "stillness" not in drift_score(40, 0, 0, None)["parts"]  # no watch, no guess
    assert drift_score(40, 0, 0, 45)["parts"]["stillness"] == 1.0


def test_breakpoints_land_between_sentences():
    video = Catalogue().get("reel_piston_door")
    points = video["breakpoints"]
    assert len(points) >= 4
    for p in points:
        speaking = [s for s in video["segments"] if s["start"] < p["t"] < s["start"] + s["dur"] - 0.01]
        assert not speaking, f"breakpoint at {p['t']} cuts into a caption line"
    assert next_breakpoint(points, 0, 2, 45)["t"] > 2
    assert next_breakpoint(points, 500, 2, 45) is None
    assert find_breakpoints([]) == []


def test_budget_gap_and_hourly_cap_and_learning():
    b = AnnoyanceBudget(gap_min=10, max_per_hour=3)
    assert b.check(0)[0]
    b.spend(0)
    assert not b.check(5)[0] and b.check(5, promised=True)[0] and b.check(11)[0]
    b.spend(11), b.spend(22)
    ok, why = b.check(40)
    assert not ok and "3 times" in why
    assert b.check(61)[0]                       # the first one has aged out
    b.learn("ignored")
    assert b.gap_min == 15
    for _ in range(10):
        b.learn("declined")
    assert b.gap_min == config.BUDGET_GAP_CEIL
    for _ in range(30):
        b.learn("accepted")
    assert b.gap_min == config.BUDGET_GAP_FLOOR


def test_rewards_are_capped_and_decay():
    r = Rewards()
    earned = [r.award() for _ in range(8)]
    assert earned[0] == 10 and earned == sorted(earned, reverse=True)
    assert sum(earned) <= config.REWARD_DAILY_CAP
    before = r.sparks
    r.new_day()
    assert r.sparks < before


# ----------------------------------------------------------------- the judge
def test_judge_classify():
    assert judge.classify("ok let's do it") == "accept"
    assert judge.classify("haan chalo") == "accept"
    assert judge.classify("ok but five more minutes") == "argue"
    assert judge.classify("why did you stop my video") == "why"
    assert judge.classify("no") == "argue"


def test_scripted_judge_paths():
    base = {"child_name": "A", "age": 9, "video_title": "x", "video_seconds_left": 200, "round": 1, "max_minutes": 10}
    grant = judge.scripted_judge({**base, "child_said": "two more minutes, it is almost done"})
    assert (grant["verdict"], grant["minutes"]) == ("grant", 2)
    trimmed = judge.scripted_judge({**base, "child_said": "20 more minutes please"})
    assert (trimmed["verdict"], trimmed["minutes"]) == ("grant", 10)
    assert judge.scripted_judge({**base, "child_said": "no"})["verdict"] == "counter"
    assert judge.scripted_judge({**base, "child_said": "no", "round": 2})["verdict"] == "back_off"
    assert judge.scripted_judge({**base, "child_said": "go away I hate this"})["verdict"] == "back_off"
    spent = judge.scripted_judge({**base, "child_said": "five more minutes", "max_minutes": 0})
    assert spent["verdict"] == "counter" and spent["minutes"] == 0


def test_guard_clamps_a_generous_model():
    llm = fake_ollama({"verdict": "grant", "minutes": 45, "reply": "Take 45 minutes!", "reason": "nice kid"})
    out = run(judge.judge(llm, {"child_said": "more please", "round": 1, "max_minutes": 10}))
    # The model tried to grant 45; the guard changed that, so its reply is discarded for a consistent scripted one.
    assert out["minutes"] <= 10 and out["by"] == "scripted" and "45" not in out["reply"]


# ---------------------------------------------------------------- game forge
def test_scripted_game_from_the_pitch_sentence():
    out = run(game_forge.create(LLM(), "Make me a game where a cat dodges math problems"))
    rules = out["rules"]
    assert out["by"] == "scripted" and rules["player"]["emoji"] == "🐱"
    assert any(t["look"] == "math" and t["does"] == "hurt" for t in rules["things"])
    assert rules["quiz"]["on"]


def test_forge_repairs_invalid_model_output():
    replies = iter([
        {"title": "Broken", "player": {"emoji": "🐱", "speed": 99}, "things": []},
        {"title": "Fixed", "player": {"emoji": "🐱", "speed": 6}, "theme": "space",
         "things": [{"look": "⭐", "does": "score"}], "lives": 3, "win_score": 10},
    ])
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "gemma3:4b"}]})
        if request.url.path == "/api/show":
            return httpx.Response(200, json={})
        seen.append(json.loads(request.content)["messages"][1]["content"])
        return httpx.Response(200, json={"message": {"content": json.dumps(next(replies))}})

    llm = LLM(transport=httpx.MockTransport(handler))
    run(llm.probe())
    out = run(game_forge.create(llm, "stars"))
    assert out["by"] == "model" and out["attempts"] == 2 and out["rules"]["title"] == "Fixed"
    assert "errors" in json.loads(seen[1])       # the second attempt was told what was wrong


def test_game_must_have_a_way_to_score():
    with pytest.raises(ValueError):
        game_forge.GameSpec(title="x", player={"emoji": "🐱"}, things=[{"look": "💣", "does": "hurt"}])


def test_scripted_edits_change_only_what_was_asked():
    spec = game_forge.scripted_spec("a cat dodges math problems")
    faster = game_forge.scripted_edit(spec, "make it faster")["rules"]
    assert faster["things"][0]["fall_speed"] == spec.things[0].fall_speed + 2
    assert faster["player"] == spec.model_dump()["player"] and faster["lives"] == spec.lives
    assert game_forge.scripted_edit(spec, "give me 5 lives")["rules"]["lives"] == 5
    assert game_forge.scripted_edit(spec, "make the player a dragon")["rules"]["player"]["emoji"] == "🐉"
    unknown = game_forge.scripted_edit(spec, "blah blah")
    assert unknown["rules"] == spec.model_dump() and "did not catch" in unknown["changed"]


# ------------------------------------------------------------------- quests
def test_scripted_quest_is_safe_and_complete():
    q = quest.scripted_quest({"video_title": "Secret Piston Door", "watched": "sticky pistons pull the door blocks"})
    assert len(q["steps"]) == 3 and 5 <= q["minutes"] <= 15 and q["proof"] == "photo"


def test_unsafe_model_quest_is_rejected():
    llm = fake_ollama({"title": "Fire Lab", "mission": "Light a candle and melt wax.", "steps": ["Light it", "Melt", "Photo"],
                       "materials": ["candle", "matches"], "minutes": 10, "proof": "photo", "topic": "science"})
    q = run(quest.create(llm, {"video_title": "Volcano experiment", "watched": "science experiment volcano"}))
    assert q["by"] == "scripted" and "candle" not in json.dumps(q).lower()


def test_photo_without_vision_model_is_flagged_unverified():
    out = run(quest.verify(LLM(), {"title": "t", "mission": "m", "steps": ["a", "b", "c"]}, {"kind": "photo", "image_b64": "x"}))
    assert out["ok"] and out["confidence"] == 0.0 and "not verified" in out["verified_by"]


# -------------------------------------------------------------------- brain
class RecordingBus(Bus):
    def __init__(self):
        super().__init__()
        self.sent = []

    async def emit(self, topic, data, roles=None):
        self.sent.append((topic, data))

    def last(self, topic, **match):
        for t, d in reversed(self.sent):
            if t == topic and all(d.get(k) == v for k, v in match.items()):
                return d
        return None


def make_brain(speed=60.0):
    bus = RecordingBus()
    store = Store(persist=False)
    brain = Brain(bus=bus, llm=LLM(), store=store, catalogue=Catalogue(), index=LiveIndex(),
                  house=House(bus, ramp_seconds=0))
    brain.s.speed = speed
    return brain, bus, store


async def watch(brain, video_id, seconds, start=0.0):
    """Play `seconds` of video, one tick per second. At speed 60 each tick is one session minute."""
    t = start
    for _ in range(seconds):
        t += 1
        await brain.on_tick({"video_id": video_id, "t": t, "playing": True, "dt": 1})
        if brain.s.phase != "watching":
            break
    return t


def test_no_interrupt_before_drift():
    async def go():
        brain, bus, _ = make_brain()
        await watch(brain, "reel_piston_door", 15)
        assert brain.s.phase == "watching" and bus.last("player/cmd") is None
    run(go())


def test_dare_waits_for_breakpoint_then_grant_then_house_then_quest():
    async def go():
        brain, bus, store = make_brain()
        t = await watch(brain, "reel_piston_door", 80)
        cmd = bus.last("player/cmd", cmd="interrupt")
        assert cmd, "the Brain never interrupted"
        points = [p["t"] for p in brain.catalogue.get("reel_piston_door")["breakpoints"]]
        assert cmd["at"] in points and cmd["at"] >= t + config.BREAKPOINT_LEAD_S - 1
        dare = store.decisions[-1]
        assert dare["kind"] == "dare" and "natural breakpoint" in dare["reason"] and dare["by"] == "scripted"
        assert brain.s.phase == "prepared"

        await brain.on_interrupted({"decision_id": cmd["decision_id"], "late_ms": 80})
        assert brain.s.phase == "interrupted"

        # The child barges in and argues with a specific reason: granted.
        await brain.on_utterance({"text": "two more minutes, it's almost done", "barge_in": True, "barge_ms": 210})
        resume = bus.last("player/cmd", cmd="resume")
        assert resume and "2 more minute" in resume["line"]
        assert brain.s.phase == "watching" and brain.s.extension_until is not None
        assert store.decisions[-2]["outcome"] == "extended" and store.decisions[-2]["barge_ms"] == 210
        assert store.extensions_today == 1

        # No second interruption while the extension runs.
        before = len([1 for tp, d in bus.sent if tp == "player/cmd" and d["cmd"] == "interrupt"])
        await brain.on_tick({"video_id": "reel_piston_door", "t": cmd["at"] + 1, "playing": True, "dt": 1})
        assert len([1 for tp, d in bus.sent if tp == "player/cmd" and d["cmd"] == "interrupt"]) == before

        # Extension ends and the sitting passes 45 minutes: the house takes over, video not paused.
        brain.s.watch_min, brain.s.clock_min = 46, brain.s.clock_min + 10
        await watch(brain, "reel_piston_door", 3, start=cmd["at"] + 1)
        assert brain.s.phase == "interrupted" and brain.s.pending["kind"] == "house"
        assert brain.house.scene == "sunrise" and bus.last("tv/show")["screen"] == "portal"
        offered = bus.last("quest/update", state="offered")["quest"]
        assert store.decisions[-1]["kind"] == "house"

        # The child accepts, sends a photo, and gets a documentary.
        quest_view = await brain.accept_quest()
        assert quest_view["id"] == offered["id"] and brain.s.phase == "quest"
        assert bus.last("player/cmd", cmd="pause")
        for _ in range(8):
            await brain.on_tick({"video_id": "reel_piston_door", "t": 50, "playing": False, "dt": 1})
        result = await brain.submit_proof(offered["id"], {"kind": "photo", "image_b64": "abc"})
        assert result["ok"] and result["reward"] == 10
        film = bus.last("tv/show", screen="documentary")
        assert film and len(film["film"]["scenes"]) >= 3 and film["photos"] == ["abc"]
        await asyncio.sleep(0)
        assert brain.house.scene == "normal" and brain.s.phase == "watching" and brain.s.watch_min == 0

        m = metrics.compute(store.decisions, brain.s.passive_today, brain.s.active_today, list(store.quests.values()))
        assert m["interventions"] == 2 and m["quests_completed"] == 1 and m["active_min"] == 8
        assert m["acceptance_rate"] == 0.5 and m["engagement_rate"] == 1.0
    run(go())


def test_parent_rule_enforced_immediately_and_not_negotiable():
    async def go():
        brain, bus, store = make_brain(speed=1)
        store.put_rule(active(id="noshorts", effect="block", categories=["shorts"]))
        await brain.on_tick({"video_id": "reel_slime_shorts", "t": 1, "playing": True, "dt": 1})
        cmd = bus.last("player/cmd", cmd="enforce")
        assert cmd and "family rule" in cmd["line"].lower()
        assert all(v["category"] != "shorts" for v in cmd["alternatives"])
        await brain.on_utterance({"text": "please just five more minutes"})
        assert "can't change it" in bus.last("player/cmd", cmd="say")["line"]
        assert store.decisions[-1]["kind"] == "rule_held" and store.extensions_today == 0
        # Pressing play on the blocked video pauses it again.
        await brain.on_tick({"video_id": "reel_slime_shorts", "t": 2, "playing": True, "dt": 1})
        assert bus.sent[-2] == ("player/cmd", {"cmd": "pause"})
        # Switching to an allowed video clears the block.
        await brain.on_tick({"video_id": "reel_saturn", "t": 1, "playing": True, "dt": 1})
        assert brain.s.phase == "watching" and brain.s.pending is None
    run(go())


def test_ignored_dare_resumes_and_backs_off():
    async def go():
        brain, bus, store = make_brain()
        await watch(brain, "reel_piston_door", 80)
        cmd = bus.last("player/cmd", cmd="interrupt")
        await brain.on_interrupted({"decision_id": cmd["decision_id"]})
        gap_before = store.budget.gap_min
        await brain.on_timeout(cmd["decision_id"])
        assert bus.last("player/cmd", cmd="resume")["line"] is None
        assert brain.s.phase == "watching" and store.budget.gap_min > gap_before
        assert store.decisions[-2]["outcome"] == "ignored"
    run(go())


def test_why_is_answered_from_the_log():
    async def go():
        brain, bus, store = make_brain()
        await watch(brain, "reel_piston_door", 80)
        cmd = bus.last("player/cmd", cmd="interrupt")
        await brain.on_interrupted({"decision_id": cmd["decision_id"]})
        await brain.on_utterance({"text": "why did you do that"})
        said = bus.last("player/cmd", cmd="say")
        assert said["line"].startswith("Because you had been watching for") and said["listen"]
        assert brain.s.phase == "interrupted"       # still waiting for the child's answer
    run(go())


def test_pilot_mode_never_interrupts():
    async def go():
        brain, bus, store = make_brain()
        store.profile["age"] = 15
        store.put_rule(active(effect="block", categories=["gaming"]))
        await watch(brain, "reel_piston_door", 80)
        assert bus.last("player/cmd") is None and store.decisions == []
    run(go())


def test_budget_holds_back_and_logs_once():
    async def go():
        brain, bus, store = make_brain()
        await watch(brain, "reel_piston_door", 80)
        cmd = bus.last("player/cmd", cmd="interrupt")
        await brain.on_interrupted({"decision_id": cmd["decision_id"]})
        await brain.on_utterance({"text": "no"})
        await brain.on_utterance({"text": "no"})          # declined twice: PORTAL backs off
        assert brain.s.phase == "watching" and store.decisions[-1]["outcome"] == "back_off"
        brain.s.interactions.clear()      # talking counts as engagement; set that aside to isolate the budget
        for i in range(5):
            await brain.on_tick({"video_id": "reel_piston_door", "t": 5 + i, "playing": True, "dt": 1})
        held = [d for d in store.decisions if d["kind"] == "held_back"]
        assert len(held) == 1 and "held back" in held[0]["reason"]
    run(go())

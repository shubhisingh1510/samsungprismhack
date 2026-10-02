"""NEST home hub: FastAPI app, WebSocket event bus, REST endpoints, static pages.

Run:  .venv\\Scripts\\python -m uvicorn hub.main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import asyncio
import socket
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, metrics
from .agents import game_forge, parent_voice
from .agents.house import House
from .brain import Brain, public
from .bus import Bus
from .llm import LLM
from .policy import describe
from .rag import LiveIndex
from .store import Store
from .videos import Catalogue


class Timers:
    """Real-time reply timers. The Brain asks for one; when it fires the Brain hears a timeout."""

    def __init__(self) -> None:
        self._tasks: dict[str, asyncio.Task] = {}
        self.brain: Brain | None = None

    def start(self, key: str, seconds: float) -> None:
        self.cancel(key)

        async def fire() -> None:
            await asyncio.sleep(seconds)
            self._tasks.pop(key, None)
            await self.brain.on_timeout(key)

        self._tasks[key] = asyncio.create_task(fire())

    def cancel(self, key: str | None = None) -> None:
        for k in ([key] if key else list(self._tasks)):
            task = self._tasks.pop(k, None)
            if task and task is not asyncio.current_task():
                task.cancel()


class Hub:
    def __init__(self) -> None:
        self.bus = Bus()
        self.llm = LLM()
        self.store = Store()
        self.catalogue = Catalogue()
        self.index = LiveIndex()
        self.house = House(self.bus)
        self.timers = Timers()
        self.brain = Brain(bus=self.bus, llm=self.llm, store=self.store, catalogue=self.catalogue,
                           index=self.index, house=self.house, timers=self.timers)
        self.timers.brain = self.brain
        self.bus.on("screen/tick", self.brain.on_tick)
        self.bus.on("screen/interaction", self.brain.on_interaction)
        self.bus.on("player/interrupted", self.brain.on_interrupted)
        self.bus.on("voice/utterance", self.brain.on_utterance)
        self.bus.on("body/update", self.brain.on_body)
        self.bus.on("feedback/bad_timing", self.brain.on_bad_timing)

    def status(self) -> dict:
        """What is real and what is simulated right now. Shown on every page."""
        return {
            "llm": {"on": self.llm.available, "model": self.llm.model if self.llm.available else None,
                    "vision": self.llm.vision, "where": "local (Ollama)"},
            "smartthings": self.house.state()["mode"],
            "speed": self.brain.s.speed,
            "child": {**self.store.profile, "mode": config.age_mode(self.store.profile["age"])},
            "lan_url": f"http://{lan_ip()}:8000",
        }


def lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


hub: Hub


@asynccontextmanager
async def lifespan(app: FastAPI):
    global hub
    hub = Hub()
    await hub.llm.probe()
    await hub.house.publish()
    await hub.bus.emit("tv/show", {"screen": "idle"})
    yield
    hub.timers.cancel()
    await hub.house.close()
    await hub.llm.close()


app = FastAPI(title="NEST hub", lifespan=lifespan)


# ------------------------------------------------------------------ event bus
@app.websocket("/ws")
async def ws(socket_: WebSocket, role: str = "child"):
    await socket_.accept()
    await hub.bus.connect(socket_, role)
    await hub.bus.emit("status", hub.status())
    try:
        while True:
            message = await socket_.receive_json()
            await hub.bus.dispatch(message.get("topic", ""), message.get("data") or {})
    except WebSocketDisconnect:
        pass
    finally:
        hub.bus.disconnect(socket_)


# -------------------------------------------------------------------- status
@app.get("/api/status")
async def status():
    return hub.status()


@app.post("/api/llm/probe")
async def probe():
    await hub.llm.probe()
    await hub.bus.emit("status", hub.status())
    return hub.status()


# -------------------------------------------------------------------- videos
class YouTubeIn(BaseModel):
    url: str


@app.get("/api/videos")
async def videos():
    return hub.catalogue.listing()


@app.get("/api/videos/{video_id}")
async def video(video_id: str):
    found = hub.catalogue.get(video_id)
    if not found:
        raise HTTPException(404, "Unknown video")
    return found


@app.post("/api/videos/youtube")
async def add_youtube(body: YouTubeIn):
    try:
        return await asyncio.to_thread(hub.catalogue.add_youtube, body.url)
    except ValueError as e:
        raise HTTPException(400, str(e))


# --------------------------------------------------------------------- rules
class TextIn(BaseModel):
    text: str


def rule_view(rule) -> dict:
    return {**rule.model_dump(), "understanding": describe(rule)}


@app.get("/api/rules")
async def rules():
    return [rule_view(r) for r in hub.store.rules.values()]


@app.post("/api/rules/compile")
async def compile_rules(body: TextIn):
    if not body.text.strip():
        raise HTTPException(400, "Say or type a rule first.")
    out = []
    for rule in await parent_voice.compile_rules(hub.llm, body.text):
        rule.understanding_local = await parent_voice.localise(hub.llm, rule)
        hub.store.put_rule(rule)
        out.append(rule_view(rule))
    return out


@app.post("/api/rules/{rule_id}/clarify")
async def clarify(rule_id: str, body: TextIn):
    rule = hub.store.rules.get(rule_id)
    if not rule:
        raise HTTPException(404, "Unknown rule")
    hub.store.put_rule(parent_voice.apply_answer(rule, body.text))
    return rule_view(rule)


@app.post("/api/rules/{rule_id}/confirm")
async def confirm(rule_id: str):
    rule = hub.store.rules.get(rule_id)
    if not rule:
        raise HTTPException(404, "Unknown rule")
    if rule.status == "needs_clarification":
        raise HTTPException(409, "Answer the question first.")
    rule.status = "active"
    hub.store.put_rule(rule)
    return rule_view(rule)


@app.delete("/api/rules/{rule_id}")
async def delete_rule(rule_id: str):
    hub.store.delete_rule(rule_id)
    return {"ok": True}


# -------------------------------------------------------------------- quests
class ProofIn(BaseModel):
    kind: str
    images_b64: list[str] | None = None
    said: str | None = None


@app.post("/api/quest/accept")
async def accept_quest():
    quest = await hub.brain.accept_quest()
    if not quest:
        raise HTTPException(409, "There is no quest on offer.")
    return quest


@app.post("/api/quest/{quest_id}/proof")
async def proof(quest_id: str, body: ProofIn):
    return await hub.brain.submit_proof(quest_id, body.model_dump())


@app.post("/api/quest/abandon")
async def abandon():
    await hub.brain.abandon_quest()
    return {"ok": True}


@app.get("/api/quests")
async def quests():
    return [public(q) for q in hub.store.quests.values()]


# ---------------------------------------------------------------- game forge
class ForgeEditIn(BaseModel):
    rules: dict
    instruction: str


@app.post("/api/forge/create")
async def forge_create(body: TextIn):
    result = await game_forge.create(hub.llm, body.text)
    hub.store.note_interest(["game making"], made=1)
    hub.brain.s.interactions.append(hub.brain.s.clock_min)
    return result


@app.post("/api/forge/edit")
async def forge_edit(body: ForgeEditIn):
    try:
        return await game_forge.edit(hub.llm, body.rules, body.instruction)
    except ValueError as e:
        raise HTTPException(400, f"Those rules are not valid: {e}")


# ------------------------------------------------------- parent dashboard data
@app.get("/api/log")
async def log():
    return hub.store.decisions[-200:]


@app.get("/api/metrics")
async def get_metrics():
    s = hub.brain.s
    return metrics.compute(hub.store.decisions, s.passive_today, s.active_today, list(hub.store.quests.values()))


@app.get("/api/genome")
async def genome():
    nodes = [{"topic": t, **v, "watched_min": round(v["watched_min"], 1)} for t, v in hub.store.genome.items()]
    return sorted(nodes, key=lambda n: -(n["watched_min"] + 10 * n["did"] + 10 * n["made"]))


@app.get("/api/brain")
async def brain_state():
    return hub.brain.snapshot()


# --------------------------------------------------- context and demo controls
class ContextIn(BaseModel):
    homework_done: bool | None = None
    pretend_time: str | None = None      # "HH:MM", or "" to use the real clock
    speed: float | None = None
    jump_min: float | None = None        # add passive minutes to the current sitting
    child_name: str | None = None
    child_age: int | None = None


@app.post("/api/context")
async def context(body: ContextIn):
    s = hub.brain.s
    if body.homework_done is not None:
        s.homework_done = body.homework_done
    if body.pretend_time is not None:
        s.pretend_time = body.pretend_time or None
    if body.speed is not None:
        s.speed = max(1.0, min(body.speed, 600.0))
    if body.jump_min:
        video = hub.catalogue.get(s.video_id or "") or {}
        category = video.get("category", "other")
        s.watch_min += body.jump_min
        s.clock_min += body.jump_min
        s.passive_today += body.jump_min
        s.minutes_today[category] = s.minutes_today.get(category, 0.0) + body.jump_min
        s.interactions.clear()      # the skipped minutes are counted as passive long-form viewing
    if body.child_name:
        hub.store.profile["name"] = body.child_name.strip()[:24]
    if body.child_age:
        hub.store.profile["age"] = max(4, min(17, body.child_age))
    hub.store.save_profile()
    await hub.bus.emit("status", hub.status())
    await hub.bus.emit("brain/state", hub.brain.snapshot(), roles=("parent", "tv"))
    return hub.brain.snapshot()


@app.post("/api/demo/reset")
async def reset():
    """Wipe runtime state (rules, log, quests) and start a fresh day."""
    global hub
    hub.timers.cancel()
    await hub.house.restore()
    hub.store.reset()
    hub.index.clear()
    speed = hub.brain.s.speed
    hub.brain.__init__(bus=hub.bus, llm=hub.llm, store=hub.store, catalogue=hub.catalogue, index=hub.index,
                       house=hub.house, timers=hub.timers)
    hub.brain.s.speed = speed
    await hub.bus.emit("tv/show", {"screen": "idle"})
    await hub.bus.emit("quest/update", {"state": "none"})
    await hub.bus.emit("player/cmd", {"cmd": "reset"}, roles=("child",))
    await hub.bus.emit("brain/state", hub.brain.snapshot(), roles=("parent", "tv"))
    return {"ok": True}


app.mount("/", StaticFiles(directory=config.WEB, html=True), name="web")

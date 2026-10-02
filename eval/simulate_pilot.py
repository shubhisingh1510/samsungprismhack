"""Mock pilot study: a SYNTHETIC cohort run through the real Intervention Brain.

What this is: 24 simulated children over 14 days. Their viewing plans and their
responses to NEST (accept, argue, ignore, flag bad timing) are drawn from the assumed
probabilities in PERSONA below. Everything NEST does in response is the real code:
drift scoring, breakpoints, the annoyance budget, escalation, the judge, quests, rewards.

What this is not: evidence that NEST works on real children. The acceptance rates are
inputs, not findings. The study shows that the pipeline produces the metrics, how the
budget and escalation behave over two weeks, and what a real pilot would measure.

Run:  .venv\\Scripts\\python -m eval.simulate_pilot
"""
from __future__ import annotations

import asyncio
import json
import random
import statistics
import time
from pathlib import Path

from hub import metrics
from hub.agents.house import House
from hub.brain import Brain
from hub.bus import Bus
from hub.llm import LLM
from hub.rag import LiveIndex
from hub.store import Store
from hub.videos import Catalogue

SEED, CHILDREN, DAYS = 7, 24, 14

# Assumed ranges. Each child draws one value per range and keeps it for the study.
PERSONA = {
    "daily_minutes": (60, 200),        # planned passive screen time per day, split over 2 sittings
    "shorts_share": (0.1, 0.7),        # share of sittings spent on short-form feeds
    "p_accept_voice": (0.15, 0.50),    # says yes to the companion's dare
    "p_argue": (0.25, 0.45),           # argues for more time (specific reason half the time)
    "p_accept_house": (0.30, 0.65),    # says yes when the house reacts
    "p_bad_timing": (0.03, 0.12),      # flags an interruption as badly timed
    "p_finish_quest": (0.60, 0.90),    # completes an accepted quest
    "quest_minutes": (6, 14),
}


class QuietBus(Bus):
    def __init__(self) -> None:
        super().__init__()
        self.last_interrupt: dict | None = None

    async def emit(self, topic, data, roles=None):
        if topic == "player/cmd" and data.get("cmd") == "interrupt":
            self.last_interrupt = data


async def run_quest(brain: Brain, child: dict, rng: random.Random, video_id: str) -> None:
    quest_id = brain.s.quest_id
    for _ in range(round(rng.uniform(*PERSONA["quest_minutes"]))):
        await brain.on_tick({"video_id": video_id, "t": 1, "playing": False, "dt": 1})
    if rng.random() < child["p_finish_quest"]:
        brain.s.steps += 60
        await brain.submit_proof(quest_id, {"kind": brain.store.quests[quest_id]["proof"], "image_b64": "x",
                                            "said": "I built it and it opens and closes when I pull the string"})
    else:
        await brain.abandon_quest()


async def sitting(brain: Brain, bus: QuietBus, child: dict, rng: random.Random, minutes: int, tick_ms: list) -> None:
    video_id = "reel_slime_shorts" if rng.random() < child["shorts_share"] else rng.choice(["reel_piston_door", "reel_saturn"])
    duration = brain.catalogue.get(video_id)["duration"]
    t = 0.0
    for _ in range(minutes):
        t = (t + 1) % duration
        started = time.perf_counter()
        await brain.on_tick({"video_id": video_id, "t": t, "playing": True, "dt": 1})
        tick_ms.append((time.perf_counter() - started) * 1000)
        s = brain.s
        if s.phase == "prepared":
            decision_id = bus.last_interrupt["decision_id"]
            await brain.on_interrupted({"decision_id": decision_id, "late_ms": round(rng.uniform(20, 180))})
            if rng.random() < child["p_bad_timing"]:
                await brain.on_bad_timing({"decision_id": decision_id})
            roll = rng.random()
            if roll < child["p_accept_voice"]:
                await brain.on_utterance({"text": "yes"})
                await run_quest(brain, child, rng, video_id)
                return                                      # the quest ends this sitting
            if roll < child["p_accept_voice"] + child["p_argue"]:
                if rng.random() < 0.5:
                    await brain.on_utterance({"text": "five more minutes, it is almost finished", "barge_in": True,
                                              "barge_ms": round(rng.uniform(150, 400))})
                else:
                    await brain.on_utterance({"text": "no"})
                    await brain.on_utterance({"text": "no"})
            else:
                await brain.on_timeout(decision_id)
        elif s.phase == "interrupted" and s.pending and s.pending["kind"] == "house":
            if rng.random() < child["p_accept_house"]:
                await brain.accept_quest()
                await run_quest(brain, child, rng, video_id)
                return
            await brain.on_timeout(s.pending["decision_id"])


async def run_child(index: int, rng: random.Random, tick_ms: list) -> dict:
    child = {k: rng.uniform(*v) for k, v in PERSONA.items() if k != "quest_minutes"}
    bus, store = QuietBus(), Store(persist=False)
    brain = Brain(bus=bus, llm=LLM(), store=store, catalogue=Catalogue(), index=LiveIndex(), house=House(bus, ramp_seconds=0))
    brain.s.speed = 60.0                                    # one tick is one session minute
    planned = passive = active = 0.0
    gap_by_day = []
    for _ in range(DAYS):
        brain.new_day()
        today = round(child["daily_minutes"] * rng.uniform(0.7, 1.3))
        planned += today
        for part in (today // 2, today - today // 2):
            await sitting(brain, bus, child, rng, part, tick_ms)
            brain.s.clock_min += 180                        # a few hours pass between sittings
            brain._new_sitting()
            brain.index.clear()
        passive += brain.s.passive_today
        active += brain.s.active_today
        gap_by_day.append(store.budget.gap_min)
    m = metrics.compute(store.decisions, passive, active, list(store.quests.values()))
    await brain.house.close()
    return {"child": index, "planned_min": planned, "gap_by_day": gap_by_day,
            "gave_up": len([d for d in store.decisions if d["kind"] == "gave_up"]), **m}


def mean(rows: list[dict], key: str) -> float:
    values = [r[key] for r in rows if r.get(key) is not None]
    return statistics.mean(values) if values else float("nan")


async def main() -> None:
    rng = random.Random(SEED)
    tick_ms: list[float] = []
    rows = [await run_child(i, rng, tick_ms) for i in range(CHILDREN)]
    child_days = CHILDREN * DAYS
    tick_ms.sort()
    summary = {
        "label": "SYNTHETIC cohort. Response rates are assumptions, not findings.",
        "seed": SEED, "children": CHILDREN, "days": DAYS,
        "baseline_passive_min_per_day": round(sum(r["planned_min"] for r in rows) / child_days, 1),
        "portal_passive_min_per_day": round(sum(r["passive_min"] for r in rows) / child_days, 1),
        "portal_active_min_per_day": round(sum(r["active_min"] for r in rows) / child_days, 1),
        "interruptions_per_child_day": round(sum(r["interventions"] for r in rows) / child_days, 2),
        "voice_interruptions": sum(r["by_channel"]["voice"] for r in rows),
        "house_interruptions": sum(r["by_channel"]["house"] for r in rows),
        "acceptance_rate": round(mean(rows, "acceptance_rate"), 3),
        "engagement_rate": round(mean(rows, "engagement_rate"), 3),
        "ignored_rate": round(mean(rows, "ignored_rate"), 3),
        "false_interrupt_rate": round(mean(rows, "false_interrupt_rate"), 3),
        "quest_completion_rate": round(mean(rows, "quest_completion_rate"), 3),
        "quests_completed_per_child_week": round(sum(r["quests_completed"] for r in rows) / CHILDREN / (DAYS / 7), 2),
        "times_held_back_per_child_day": round(sum(r["held_back"] for r in rows) / child_days, 2),
        "house_gave_up_total": sum(r["gave_up"] for r in rows),
        "mean_gap_min_day_1": round(statistics.mean(r["gap_by_day"][0] for r in rows), 1),
        "mean_gap_min_day_14": round(statistics.mean(r["gap_by_day"][-1] for r in rows), 1),
        "brain_tick_ms_p50": round(tick_ms[len(tick_ms) // 2], 2),
        "brain_tick_ms_p95": round(tick_ms[int(len(tick_ms) * 0.95)], 2),
        "ticks": len(tick_ms),
    }
    summary["passive_reduction_pct"] = round(
        100 * (1 - summary["portal_passive_min_per_day"] / summary["baseline_passive_min_per_day"]), 1)
    out = Path(__file__).parent / "results"
    out.mkdir(exist_ok=True)
    (out / "pilot.json").write_text(json.dumps({"summary": summary, "assumptions": PERSONA, "children": rows}, indent=2),
                                    encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(main())

"""Evaluation metrics, computed from the decision log and session counters.

Used by the parent dashboard (live) and by eval/simulate_pilot.py (synthetic cohort),
so both report the same definitions.
"""
from __future__ import annotations

from statistics import median

INTERVENTIONS = ("dare", "house")
RESOLVED = ("accepted", "extended", "declined", "ignored")
LATE_MS = 1500     # an interrupt landing this long after its breakpoint counts as mistimed


def _median(values: list) -> float | None:
    values = [v for v in values if isinstance(v, (int, float))]
    return round(median(values), 1) if values else None


def compute(decisions: list[dict], passive_min: float, active_min: float, quests: list[dict]) -> dict:
    interventions = [d for d in decisions if d["kind"] in INTERVENTIONS]
    resolved = [d for d in interventions if d.get("outcome") in RESOLVED]
    accepted = [d for d in resolved if d["outcome"] == "accepted"]
    engaged = [d for d in resolved if d["outcome"] in ("accepted", "extended")]
    false = [d for d in interventions if d.get("false_interrupt") or (d.get("late_ms") or 0) > LATE_MS]
    started = [q for q in quests if q.get("status") in ("active", "complete", "abandoned")]
    done = [q for q in quests if q.get("status") == "complete"]

    def rate(part: list, whole: list) -> float | None:
        return round(len(part) / len(whole), 3) if whole else None

    return {
        "passive_min": round(passive_min, 1),
        "active_min": round(active_min, 1),
        "active_share": round(active_min / (passive_min + active_min), 3) if passive_min + active_min else None,
        "passive_to_active": round(passive_min / active_min, 2) if active_min else None,
        "interventions": len(interventions),
        "by_channel": {c: len([d for d in interventions if d["channel"] == c]) for c in ("voice", "house")},
        "acceptance_rate": rate(accepted, resolved),
        "engagement_rate": rate(engaged, resolved),      # accepted, or negotiated an extension
        "ignored_rate": rate([d for d in resolved if d["outcome"] == "ignored"], resolved),
        "false_interrupt_rate": rate(false, interventions),
        "held_back": len([d for d in decisions if d["kind"] == "held_back"]),
        "rules_enforced": len([d for d in decisions if d["kind"] == "enforce"]),
        "quests_started": len(started),
        "quests_completed": len(done),
        "quest_completion_rate": rate(done, started),
        "latency_ms": {
            "dare_generation_p50": _median([d.get("gen_ms") for d in interventions]),
            "pause_after_breakpoint_p50": _median([d.get("late_ms") for d in interventions]),
            "barge_in_p50": _median([d.get("barge_ms") for d in interventions]),
        },
    }

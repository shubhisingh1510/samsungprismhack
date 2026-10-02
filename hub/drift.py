"""Drift score: how passive has this session become, from 0 (engaged) to 1 (drifting)."""
from __future__ import annotations

from . import config


def drift_score(watch_min: float, shorts_min: float, interactions_last_10: int,
                still_min: float | None) -> dict:
    """Returns {"score": float, "parts": {...}}. A missing signal (no watch paired) is
    dropped and the remaining weights are re-normalised rather than guessed."""
    parts = {
        "session": min(watch_min / config.SESSION_FULL_MIN, 1.0),
        "short_form": (shorts_min / watch_min) if watch_min > 0 else 0.0,
        "passivity": 1.0 - min(interactions_last_10 / config.ACTIVE_PER_10_MIN, 1.0),
    }
    if still_min is not None:
        parts["stillness"] = min(still_min / config.STILL_FULL_MIN, 1.0)
    total_weight = sum(config.DRIFT_WEIGHTS[k] for k in parts)
    score = sum(config.DRIFT_WEIGHTS[k] * v for k, v in parts.items()) / total_weight
    # Passivity alone should not flag a child who just sat down.
    score *= min(watch_min / 5.0, 1.0)
    return {"score": round(score, 3), "parts": {k: round(v, 3) for k, v in parts.items()}}

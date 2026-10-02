"""Natural-breakpoint detection over a caption track.

A breakpoint is a moment where interrupting costs the least: the speaker paused,
finished a sentence, and is about to start something new. Scored from three cheap
signals so it runs on every tick.
"""
from __future__ import annotations

from .text import cosine, embed

CUES = ("now", "next", "okay", "ok", "alright", "so", "step", "first", "second", "third", "finally",
        "let's", "lets", "moving", "ab", "toh", "chalo", "agla", "phir", "अब", "तो", "चलो", "फिर")
MIN_SCORE = 0.6


def find_breakpoints(segments: list[dict]) -> list[dict]:
    """segments: [{start, dur, text}] sorted by start. Returns [{t, score, why}]."""
    points = []
    for i in range(len(segments) - 1):
        cur, nxt = segments[i], segments[i + 1]
        end = cur["start"] + cur.get("dur", 0)
        score, why = 0.0, []
        gap = nxt["start"] - end
        if gap >= 1.0:
            score += 0.5
            why.append(f"{gap:.1f}s pause")
        if cur["text"].rstrip().endswith((".", "!", "?", "।")):
            score += 0.3
            why.append("sentence ends")
        first = nxt["text"].strip().lower().split(" ")[0].strip(",.!") if nxt["text"].strip() else ""
        if first in CUES:
            score += 0.4
            why.append(f'next part starts with "{first}"')
        before = embed(" ".join(s["text"] for s in segments[max(0, i - 2): i + 1]))
        after = embed(" ".join(s["text"] for s in segments[i + 1: i + 4]))
        if cosine(before, after) < 0.15:
            score += 0.3
            why.append("topic changes")
        if score >= MIN_SCORE:
            points.append({"t": round(max(end, nxt["start"] - 0.3), 2), "score": round(score, 2),
                           "why": ", ".join(why)})
    return points


def next_breakpoint(points: list[dict], t: float, lead: float, lookahead: float) -> dict | None:
    """First breakpoint far enough ahead to prepare for, but not so far that drift goes stale."""
    for p in points:
        if t + lead <= p["t"] <= t + lookahead:
            return p
    return None

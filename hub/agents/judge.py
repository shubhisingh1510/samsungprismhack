"""Argument judge: the child talks back, and gets a fair hearing.

The model (or the scripted fallback) proposes a verdict; guard() then clamps it to what
family rules and today's extension count allow, so the model can never grant more than
the parents would.
"""
from __future__ import annotations

import json
import math
import re

from ..llm import LLM, LLMUnavailable, load_prompt
from ..text import has_any

YES = ["yes", "yeah", "yep", "ok", "okay", "sure", "fine", "deal", "accept", "accepted", "let's go", "lets go",
       "let's do it", "bring it", "i'll do it", "haan", "han", "theek", "thik", "chalo", "हाँ", "ठीक", "चलो"]
NO = ["no", "not", "don't", "dont", "wait", "later", "more", "minute", "minutes", "but", "nahi", "nahin", "ruko",
      "baad", "aur", "नहीं", "रुको", "बाद"]
WHY = ["why", "kyun", "kyu", "kyon", "क्यों", "how come"]
SPECIFIC = ["almost", "nearly", "finish", "finished", "last", "end", "ending", "until", "till", "khatam", "poora",
            "done soon", "this one", "this video", "this part"]
UPSET = ["hate", "stupid", "shut up", "go away", "leave me", "annoying", "not fair", "chup", "jao"]
NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
                "nine": 9, "ten": 10, "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5, "panch": 5,
                "das": 10, "couple": 2, "few": 3}


def classify(text: str) -> str:
    """'why', 'accept' or 'argue'. Deterministic so the control flow never depends on a model."""
    low = text.lower().strip()
    if any(low.startswith(w) for w in WHY) or "why did you" in low:
        return "why"
    if has_any(text, YES) and not has_any(text, NO):
        return "accept"
    return "argue"


def asked_minutes(text: str) -> int | None:
    match = re.search(r"(\d{1,2})\s*(?:more\s*)?(?:min|minute|minutes|mins|m\b)", text.lower())
    if match:
        return int(match.group(1))
    for word, n in NUMBER_WORDS.items():
        if re.search(rf"(?<!\w){word}\s+(?:more\s+)?(?:min|minute|minutes|mins)", text.lower()):
            return n
    return None


def guard(verdict: dict, ctx: dict) -> dict:
    max_minutes, rnd = int(ctx.get("max_minutes", 0)), int(ctx.get("round", 1))
    kind = verdict.get("verdict")
    if kind not in ("grant", "counter", "back_off"):
        kind = "back_off"
    minutes = max(0, min(int(verdict.get("minutes") or 0), max_minutes))
    if kind == "grant" and minutes == 0:
        kind = "counter" if rnd == 1 else "back_off"
    if kind == "counter" and rnd > 1:
        kind = "back_off"
    if kind == "back_off":
        minutes = 0
    return {**verdict, "verdict": kind, "minutes": minutes}


async def judge(llm: LLM, ctx: dict) -> dict:
    """ctx: child_said, child_name, age, video_title, video_seconds_left, round, max_minutes, earlier_offer.
    Returns {"verdict", "minutes", "reply", "reason", "by"}."""
    try:
        out = await llm.json(load_prompt("judge"), json.dumps(ctx, ensure_ascii=False), temperature=0.5, max_tokens=160)
        if out.get("reply"):
            guarded = guard(out, ctx)
            if guarded["verdict"] == out.get("verdict") and guarded["minutes"] == int(out.get("minutes") or 0):
                return {**guarded, "reason": str(out.get("reason", "")), "by": "model"}
            # The guard changed the outcome, so the model's spoken reply no longer matches it.
    except (LLMUnavailable, ValueError, TypeError):
        pass
    return scripted_judge(ctx)


def scripted_judge(ctx: dict) -> dict:
    said = ctx.get("child_said", "")
    max_minutes, rnd = int(ctx.get("max_minutes", 0)), int(ctx.get("round", 1))
    if has_any(said, UPSET):
        return {"verdict": "back_off", "minutes": 0, "reply": "Okay. I'll leave you to it.",
                "reason": "The child sounded upset, so NEST backed off.", "by": "scripted"}
    wanted = asked_minutes(said)
    left = ctx.get("video_seconds_left")
    if has_any(said, SPECIFIC) and left is not None and wanted is None:
        wanted = max(1, math.ceil(left / 60))
    if (wanted or has_any(said, SPECIFIC)) and max_minutes > 0:
        minutes = min(wanted or 5, max_minutes)
        trimmed = wanted and wanted > max_minutes
        reply = (f"I can do {minutes}, not {wanted}. {minutes} more minutes, then I'm back." if trimmed
                 else f"Fair enough. {minutes} more minute{'s' if minutes != 1 else ''}, then I'm back.")
        return {"verdict": "grant", "minutes": minutes, "reply": reply,
                "reason": f"The child gave a specific, bounded reason, so {minutes} extra minutes were granted.",
                "by": "scripted"}
    if rnd == 1:
        if max_minutes > 0:
            offer = min(3, max_minutes)
            return {"verdict": "counter", "minutes": offer,
                    "reply": f"How about {offer} more minutes, then we try the challenge. Deal?",
                    "reason": "The reply gave no specific reason, so NEST offered a smaller deal.", "by": "scripted"}
        return {"verdict": "counter", "minutes": 0,
                "reply": "Today's extra turns are used up. Want the challenge, or shall I leave you to it?",
                "reason": "No extensions are left today, so NEST said so and offered the challenge again.",
                "by": "scripted"}
    return {"verdict": "back_off", "minutes": 0, "reply": "Okay, your call. I'm here if you change your mind.",
            "reason": "The child declined twice. NEST's own suggestions are never forced, so it backed off.",
            "by": "scripted"}

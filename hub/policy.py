"""Deterministic policy engine.

The Parent Voice agent turns speech into Rule objects once. From then on this plain
Python code decides what is allowed, so enforcement is predictable and every verdict
can be explained to the child word for word. No LLM is involved in enforcement.
"""
from __future__ import annotations

from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator

CATEGORIES = ["shorts", "cartoon", "gaming", "educational", "music", "social", "movies", "other"]
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
LABELS = {"shorts": "shorts and reels", "cartoon": "cartoons", "gaming": "gaming videos",
          "educational": "learning videos", "music": "music", "social": "social media",
          "movies": "movies and shows", "other": "other videos"}


class Rule(BaseModel):
    id: str = ""
    source_text: str = ""
    language: str = "en"
    effect: Literal["allow", "block", "limit"]
    categories: list[str] = Field(default_factory=list)   # empty = every kind of content
    after_homework: bool = False
    time_start: str | None = None                          # "HH:MM", 24-hour
    time_end: str | None = None
    days: list[str] = Field(default_factory=list)          # empty = every day
    limit_minutes: int | None = None
    status: Literal["draft", "needs_clarification", "active"] = "draft"
    clarify_field: str | None = None
    clarify_question: str | None = None
    compiled_by: str = "scripted"
    understanding_local: str | None = None   # courtesy translation of the read-back

    @field_validator("categories")
    @classmethod
    def _known_categories(cls, v: list[str]) -> list[str]:
        return [c for c in dict.fromkeys(x.lower().strip() for x in v) if c in CATEGORIES]

    @field_validator("days")
    @classmethod
    def _known_days(cls, v: list[str]) -> list[str]:
        return [d for d in dict.fromkeys(x.lower().strip()[:3] for x in v) if d in DAYS]

    @field_validator("time_start", "time_end")
    @classmethod
    def _valid_time(cls, v: str | None) -> str | None:
        if not v:
            return None
        return parse_hhmm(v).strftime("%H:%M")


class Verdict(BaseModel):
    allowed: bool
    kind: Literal["ok", "blocked", "condition_unmet", "limit_reached"] = "ok"
    rule_id: str | None = None
    reason: str = ""
    minutes_left: float | None = None      # tightest remaining daily limit, if any


def parse_hhmm(value: str) -> time:
    hour, minute = value.strip().split(":")
    return time(int(hour), int(minute))


def in_window(now: time, start: str | None, end: str | None) -> bool:
    """True when now is inside [start, end). Windows may cross midnight (21:00 to 07:00)."""
    if not start and not end:
        return True
    s = parse_hhmm(start) if start else time(0, 0)
    e = parse_hhmm(end) if end else time(23, 59, 59)
    if s <= e:
        return s <= now < e
    return now >= s or now < e


def _what(rule: Rule) -> str:
    if not rule.categories:
        return "any screen content"
    names = [LABELS[c] for c in rule.categories]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def _when(rule: Rule) -> str:
    parts = []
    if rule.time_start and rule.time_end:
        parts.append(f"between {rule.time_start} and {rule.time_end}")
    elif rule.time_start:
        parts.append(f"after {rule.time_start}")
    elif rule.time_end:
        parts.append(f"before {rule.time_end}")
    if rule.days:
        parts.append("on " + ", ".join(d.capitalize() for d in rule.days))
    return " ".join(parts)


def describe(rule: Rule) -> str:
    """Plain-language read-back. Generated from the rule itself, not by an LLM, so what
    the parent confirms is exactly what will be enforced."""
    what, when = _what(rule), _when(rule)
    if rule.effect == "block":
        text = f"Never allow {what}" if not when else f"Do not allow {what} {when}"
    elif rule.effect == "limit":
        amount = f"{rule.limit_minutes} minutes" if rule.limit_minutes else "a set number of minutes"
        text = f"Allow at most {amount} of {what} per day" + (f" {when}" if when else "")
    else:
        conditions = []
        if rule.after_homework:
            conditions.append("only after homework is marked done")
        if when:
            conditions.append(f"only {when}")
        text = f"Allow {what}" + (" " + " and ".join(conditions) if conditions else " at any time")
    return text + "."


def applies(rule: Rule, category: str, now: datetime) -> bool:
    if rule.status != "active":
        return False
    if rule.categories and category not in rule.categories:
        return False
    if rule.days and DAYS[now.weekday()] not in rule.days:
        return False
    return True


def evaluate(rules: list[Rule], category: str, now: datetime, homework_done: bool,
             minutes_today: dict[str, float]) -> Verdict:
    """Most restrictive rule wins: any block beats any allow."""
    minutes_left: float | None = None
    for rule in rules:
        if not applies(rule, category, now):
            continue
        inside = in_window(now.time(), rule.time_start, rule.time_end)
        what = _what(rule)
        if rule.effect == "block" and inside:
            return Verdict(allowed=False, kind="blocked", rule_id=rule.id,
                           reason=f"Family rule: {describe(rule)}")
        if rule.effect == "allow":
            if rule.after_homework and not homework_done:
                return Verdict(allowed=False, kind="condition_unmet", rule_id=rule.id,
                               reason=f"Family rule: {what} only after homework, and homework is not marked done yet.")
            if (rule.time_start or rule.time_end) and not inside:
                return Verdict(allowed=False, kind="condition_unmet", rule_id=rule.id,
                               reason=f"Family rule: {describe(rule)}")
        if rule.effect == "limit" and rule.limit_minutes and inside:
            cats = rule.categories or CATEGORIES
            used = sum(minutes_today.get(c, 0.0) for c in cats)
            left = rule.limit_minutes - used
            if left <= 0:
                return Verdict(allowed=False, kind="limit_reached", rule_id=rule.id,
                               reason=f"Family rule: {describe(rule)} Today's {rule.limit_minutes} minutes are used up.")
            minutes_left = left if minutes_left is None else min(minutes_left, left)
    return Verdict(allowed=True, minutes_left=minutes_left)

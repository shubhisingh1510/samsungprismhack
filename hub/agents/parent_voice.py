"""Teach-It-Once Parent Voice: spoken household rules compiled into policy.Rule objects.

Model path: the local LLM extracts the rules (any language it understands).
Scripted path: a keyword parser that handles English, Hinglish and common Hindi words.
Both paths end in the same deterministic checks, which ask the parent one question when
a detail is missing instead of guessing.
"""
from __future__ import annotations

import json
import re

from pydantic import ValidationError

from ..llm import LLM, LLMUnavailable, load_prompt
from ..policy import Rule, describe
from ..text import has_any

CATEGORY_WORDS = {
    "shorts": ["shorts", "short videos", "reels", "reel", "tiktok", "रील", "रील्स", "शॉर्ट्स"],
    "cartoon": ["cartoon", "cartoons", "doraemon", "shinchan", "chhota bheem", "कार्टून"],
    "gaming": ["gaming", "gameplay", "game videos", "games", "game", "minecraft", "free fire", "गेम"],
    "educational": ["educational", "learning videos", "study videos", "science videos", "पढ़ाई वाले"],
    "music": ["music", "songs", "song", "gaane", "गाने"],
    "social": ["instagram", "social media", "facebook", "snapchat"],
    "movies": ["movies", "movie", "films", "film", "serial", "serials", "netflix", "फिल्म"],
}
ALL_SCREEN = ["phone", "screen", "screens", "tv", "mobile", "tablet", "youtube", "videos", "फोन", "मोबाइल", "टीवी"]
NEGATIVE = ["no", "never", "not allowed", "don't allow", "dont allow", "ban", "block", "stop", "nahi", "nahin",
            "mat", "band", "नहीं", "मत", "बंद"]
LIMIT_WORDS = ["only", "max", "maximum", "at most", "limit", "per day", "a day", "daily", "sirf", "roz", "सिर्फ"]
HOMEWORK = ["after homework", "homework ke baad", "after studies", "after study", "after studying", "padhai ke baad",
            "once homework", "homework is done", "homework done", "होमवर्क के बाद", "पढ़ाई के बाद"]
HINGLISH = ["hai", "nahi", "nahin", "ke baad", "lekin", "baje", "sirf", "theek", "bilkul", "kabhi", "roz"]
DAY_WORDS = {"weekend": ["sat", "sun"], "weekends": ["sat", "sun"], "weekdays": ["mon", "tue", "wed", "thu", "fri"],
             "weekday": ["mon", "tue", "wed", "thu", "fri"], "school days": ["mon", "tue", "wed", "thu", "fri"],
             "school nights": ["sun", "mon", "tue", "wed", "thu"], "monday": ["mon"], "tuesday": ["tue"],
             "wednesday": ["wed"], "thursday": ["thu"], "friday": ["fri"], "saturday": ["sat"], "sunday": ["sun"],
             "itwar": ["sun"], "ravivar": ["sun"]}
HOUR_WORDS = {"one": 1, "an": 1, "a": 1, "ek": 1, "two": 2, "do": 2, "three": 3, "teen": 3, "half": 0.5,
              "aadha": 0.5, "adha": 0.5, "आधा": 0.5, "एक": 1, "दो": 2}

CLOCK = r"(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|baje)?"
QUESTIONS = {
    "categories": "Which kind of content do you mean: shorts and reels, cartoons, gaming, movies, or everything?",
    "time_end": "Until what time in the morning should this stay off?",
    "time_start": "From what time should this apply?",
    "limit_minutes": "How many minutes per day should be allowed?",
}


def detect_language(text: str) -> str:
    if re.search(r"[ऀ-ॿ]", text):
        return "hi"
    return "hi" if has_any(text, HINGLISH) else "en"


def find_categories(text: str) -> list[str]:
    return [cat for cat, words in CATEGORY_WORDS.items() if has_any(text, words)]


def find_minutes(text: str) -> int | None:
    low = text.lower()
    m = re.search(r"(\d{1,3})\s*(?:min|mins|minute|minutes|मिनट)", low)
    if m:
        return int(m.group(1))
    if re.search(r"half an hour|half hour|aadha ghanta|adha ghanta|आधा घंटा|आधे घंटे", low):
        return 30
    m = re.search(r"(?<!\w)(\d+(?:\.\d+)?|" + "|".join(HOUR_WORDS) + r")\s*(?:and a half\s*)?(?:hour|hours|hr|hrs|ghanta|ghante|घंटा|घंटे)", low)
    if m:
        value = HOUR_WORDS.get(m.group(1), None)
        hours = value if value is not None else float(m.group(1))
        if "and a half" in m.group(0):
            hours += 0.5
        return int(round(hours * 60))
    return None


def to_clock(hour: int, minute: int, marker: str | None, context: str, default_pm: bool) -> str | None:
    """Turn '9', '9 pm', '9 baje' into HH:MM. Bare hours take am/pm from nearby words,
    then from default_pm ('after 9' usually means night, 'before 7' usually means morning)."""
    if hour > 23 or minute > 59:
        return None
    marker = (marker or "").replace(".", "")
    night = has_any(context, ["night", "raat", "evening", "shaam", "pm", "रात", "शाम"])
    morning = has_any(context, ["morning", "subah", "am", "सुबह"])
    if hour <= 12:
        pm = marker == "pm" or (marker != "am" and (night or (default_pm and not morning)))
        if pm and hour < 12:
            hour += 12
        if not pm and hour == 12:
            hour = 0
    return f"{hour:02d}:{minute:02d}"


def find_window(text: str) -> tuple[str | None, str | None]:
    low = text.lower()
    m = re.search(rf"(?:between|from)\s+{CLOCK}\s+(?:and|to|se)\s+{CLOCK}", low)
    if m:
        h1, m1, k1, h2, m2, k2 = m.groups()
        end = to_clock(int(h2), int(m2 or 0), k2, low, default_pm=True)
        start = to_clock(int(h1), int(m1 or 0), k1 or (k2 if k2 in ("am", "pm") else None), low, default_pm=True)
        return start, end
    m = re.search(rf"(?:after|post)\s+{CLOCK}", low) or re.search(rf"{CLOCK}\s*(?:ke baad|के बाद)", low)
    if m and (m.group(3) or int(m.group(1)) <= 23):
        return to_clock(int(m.group(1)), int(m.group(2) or 0), m.group(3), low, default_pm=True), None
    m = re.search(rf"(?:before|until|till)\s+{CLOCK}", low) or re.search(rf"{CLOCK}\s*(?:se pehle|से पहले|tak|तक)", low)
    if m:
        return None, to_clock(int(m.group(1)), int(m.group(2) or 0), m.group(3), low, default_pm=False)
    return None, None


def find_days(text: str) -> list[str]:
    days: list[str] = []
    for word, codes in DAY_WORDS.items():
        if has_any(text, [word]):
            days += [c for c in codes if c not in days]
    return days


def split_clauses(text: str) -> list[str]:
    parts = re.split(r"\s*(?:\bbut\b|\blekin\b|\bmagar\b|\bhowever\b|लेकिन|मगर|[;.।]|,\s*(?=no\b|never\b|and\b))\s*", text,
                     flags=re.IGNORECASE)
    return [p.strip(" ,") for p in parts if p and p.strip(" ,")]


def parse_clause(clause: str) -> dict | None:
    cats = find_categories(clause)
    everything = not cats and has_any(clause, ALL_SCREEN)
    homework = has_any(clause, HOMEWORK)
    minutes = find_minutes(clause)
    start, end = (None, None) if minutes and not re.search(r"after|before|between|baad|pehle", clause.lower()) else find_window(clause)
    days = find_days(clause)
    wants_limit = minutes is not None or (has_any(clause, LIMIT_WORDS) and has_any(clause, ["limit"]))
    if not (cats or everything or homework or start or end or wants_limit):
        return None
    if wants_limit:
        effect = "limit"
    elif has_any(clause, NEGATIVE):
        effect = "block"
    else:
        effect = "allow"
    return {"effect": effect, "categories": cats, "after_homework": homework and effect == "allow",
            "time_start": start, "time_end": end, "days": days, "limit_minutes": minutes,
            "_no_target": not cats and not everything}


def scripted_parse(text: str) -> list[dict]:
    rules = [r for r in (parse_clause(c) for c in split_clauses(text)) if r]
    if not rules:
        rules = [{"effect": "block" if has_any(text, NEGATIVE) else "allow", "categories": [], "_no_target": True}]
    return rules


def finalise(raw: dict, source_text: str, language: str, by: str) -> Rule:
    """Build the Rule and run the missing-detail checks shared by both paths."""
    ask = raw.get("ask") if isinstance(raw.get("ask"), dict) else None
    no_target = raw.get("_no_target", False)
    fields = {k: raw.get(k) for k in ("effect", "categories", "after_homework", "time_start", "time_end", "days", "limit_minutes")}
    fields = {k: v for k, v in fields.items() if v is not None}
    rule = Rule(**fields, source_text=source_text, language=language, compiled_by=by)
    field = None
    if no_target or (ask and ask.get("field") == "categories"):
        field = "categories"
    elif rule.effect == "limit" and not rule.limit_minutes:
        field = "limit_minutes"
    elif rule.effect == "block" and rule.time_start and not rule.time_end:
        field = "time_end"
    elif ask and ask.get("field") in QUESTIONS:
        field = ask["field"]
    if field:
        rule.status = "needs_clarification"
        rule.clarify_field = field
        asked = ask.get("question") if ask and ask.get("field") == field else None
        rule.clarify_question = asked or QUESTIONS[field]
    return rule


async def compile_rules(llm: LLM, text: str) -> list[Rule]:
    text = text.strip()
    try:
        out = await llm.json(load_prompt("parent_voice"), text, temperature=0.1, max_tokens=500)
        language = str(out.get("language") or detect_language(text))[:2]
        rules = [finalise(r, text, language, "model") for r in out.get("rules", []) if isinstance(r, dict)]
        if rules:
            return rules
    except (LLMUnavailable, ValidationError, ValueError, TypeError):
        pass
    language = detect_language(text)
    return [finalise(r, text, language, "scripted") for r in scripted_parse(text)]


def apply_answer(rule: Rule, answer: str) -> Rule:
    """The parent answered the one clarifying question. If the answer parses, the rule
    becomes a draft awaiting confirmation; if not, the question stays open."""
    field = rule.clarify_field
    if field == "categories":
        cats = find_categories(answer)
        if cats:
            rule.categories = cats
        elif not has_any(answer, ["everything", "all", "sab", "sab kuch", "सब"] + ALL_SCREEN):
            return rule
    elif field == "limit_minutes":
        minutes = find_minutes(answer) or (int(answer.strip()) if answer.strip().isdigit() else None)
        if not minutes:
            return rule
        rule.limit_minutes = minutes
    elif field in ("time_end", "time_start"):
        m = re.search(CLOCK, answer.lower())
        if not m:
            return rule
        value = to_clock(int(m.group(1)), int(m.group(2) or 0), m.group(3), answer, default_pm=(field == "time_start"))
        if not value:
            return rule
        setattr(rule, field, value)
    rule.status, rule.clarify_field, rule.clarify_question = "draft", None, None
    rule.understanding_local = None      # the earlier translation described the unfinished rule
    return rule


async def localise(llm: LLM, rule: Rule) -> str | None:
    """Optional courtesy translation of the read-back. The English read-back from
    policy.describe() remains the authoritative statement of what is enforced."""
    if rule.language == "en":
        return None
    try:
        return await llm.chat(
            "Translate the sentence into the language with the given ISO code, in the everyday spoken register a "
            "parent would use at home. Reply with the translation only.",
            json.dumps({"language": rule.language, "sentence": describe(rule)}), temperature=0.1, max_tokens=120)
    except LLMUnavailable:
        return None

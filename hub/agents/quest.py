"""Real-World Quest agent: makes a quest from what was watched, and checks the proof."""
from __future__ import annotations

import json

from ..llm import LLM, LLMUnavailable, load_prompt
from ..store import new_id
from .common import is_unsafe, main_thing, topic_class

SCRIPTED = {
    "build": {
        "title": "Operation Cardboard {Thing}",
        "mission": "Build a working {thing} out of cardboard and tape in 10 minutes.",
        "steps": ["Find cardboard or stiff paper, tape and anything else you think you need.",
                  "Build the {thing} so that it really does its job.",
                  "Test it three times, then take a photo of it working."],
        "materials": ["cardboard", "tape", "string"], "minutes": 10, "proof": "photo", "topic": "mechanisms"},
    "space": {
        "title": "Pocket {Thing}",
        "mission": "Make a paper model of {thing} that you can hold in one hand, in 10 minutes.",
        "steps": ["Scrunch paper into a ball for the planet.",
                  "Cut or tear a flat ring from another sheet and slide it around the ball.",
                  "Hold it up to a lamp, tilt it, and take a photo of the shadow it makes."],
        "materials": ["paper", "tape", "a lamp or torch"], "minutes": 10, "proof": "photo", "topic": "space"},
    "cook": {
        "title": "Fridge Inventor",
        "mission": "Ask a grown-up, then invent a no-cook snack from three things in the fridge in 10 minutes.",
        "steps": ["Ask a grown-up which three things you may use.",
                  "Put them together in a way nobody in your family has tried.",
                  "Give it a name and take a photo before anyone eats it."],
        "materials": ["three fridge items", "a plate"], "minutes": 10, "proof": "photo", "topic": "cooking"},
    "nature": {
        "title": "Creature Walk",
        "mission": "Invent the walk of a {thing} and cross the room and back five times in 5 minutes.",
        "steps": ["Decide how a {thing} would move if it were your size.",
                  "Cross the room and back five times moving that way.",
                  "Count your steps on the watch and say what was hardest."],
        "materials": ["a clear bit of floor"], "minutes": 5, "proof": "steps", "topic": "animals"},
    "art": {
        "title": "Memory Sketch",
        "mission": "Draw the {thing} from memory in 5 minutes without looking at any screen.",
        "steps": ["Close your eyes and picture the {thing} for ten seconds.",
                  "Draw it as big as the page.",
                  "Add one detail the video did not have, then take a photo."],
        "materials": ["paper", "pencil"], "minutes": 5, "proof": "photo", "topic": "drawing"},
    "move": {
        "title": "Ten Times Challenge",
        "mission": "Do the {thing} move ten times in 5 minutes, then teach it to someone.",
        "steps": ["Clear a safe space on the floor.", "Do the move ten times, slowly at first.",
                  "Show someone at home and count your steps on the watch."],
        "materials": ["a clear bit of floor"], "minutes": 5, "proof": "steps", "topic": "movement"},
    "science": {
        "title": "Bedroom Lab",
        "mission": "Test the {thing} idea with three things from your room in 10 minutes.",
        "steps": ["Guess what will happen and say it out loud.", "Try it with three different objects.",
                  "Tell me which one surprised you and why."],
        "materials": ["three objects from your room"], "minutes": 10, "proof": "voice", "topic": "experiments"},
    "sensory": {
        "title": "Sound Hunt",
        "mission": "Find the three most satisfying sounds in your house in 5 minutes.",
        "steps": ["Walk through two rooms tapping, crinkling and shaking things gently.",
                  "Pick your top three sounds.", "Tell me what made each one."],
        "materials": ["your ears"], "minutes": 5, "proof": "voice", "topic": "sound"},
    "general": {
        "title": "Two-Minute Teacher",
        "mission": "Teach someone at home about {thing} in 2 minutes, with one drawing.",
        "steps": ["Draw one picture that explains {thing}.", "Find someone at home and teach them with it.",
                  "Tell me the question they asked you."],
        "materials": ["paper", "pencil"], "minutes": 5, "proof": "voice", "topic": "explaining"},
}


def _clean(raw: dict) -> dict | None:
    """Validate a model-written quest. Anything off returns None and the scripted quest is used."""
    try:
        steps = [str(s).strip() for s in raw["steps"]][:3]
        quest = {
            "title": str(raw["title"]).strip()[:40],
            "mission": str(raw["mission"]).strip(),
            "steps": steps,
            "materials": [str(m).strip() for m in raw.get("materials", [])][:6],
            "minutes": max(5, min(15, int(raw.get("minutes", 10)))),
            "proof": raw.get("proof") if raw.get("proof") in ("photo", "voice", "steps") else "photo",
            "topic": str(raw.get("topic", "making")).strip().lower()[:24],
        }
    except (KeyError, TypeError, ValueError):
        return None
    if len(steps) != 3 or not quest["title"] or not quest["mission"]:
        return None
    if is_unsafe(quest["mission"], *steps, *quest["materials"]) and "grown-up" not in quest["mission"].lower():
        return None
    return quest


async def create(llm: LLM, ctx: dict) -> dict:
    """ctx: child_name, age, mode, video_id, video_title, watched, challenge, fridge."""
    quest, by = None, "scripted"
    try:
        payload = {k: ctx.get(k) for k in ("child_name", "age", "mode", "video_title", "watched", "challenge", "fridge")}
        quest = _clean(await llm.json(load_prompt("quest"), json.dumps(payload, ensure_ascii=False),
                                      temperature=0.8, max_tokens=350))
        if quest:
            by = "model"
    except LLMUnavailable:
        pass
    if quest is None:
        quest = scripted_quest(ctx)
    return {"id": new_id("quest"), "by": by, "status": "offered", "video_id": ctx.get("video_id"),
            "video_title": ctx.get("video_title"), "photos": [], **quest}


def scripted_quest(ctx: dict) -> dict:
    text = f'{ctx.get("video_title", "")} {ctx.get("watched", "")}'
    template = SCRIPTED[topic_class(text)]
    thing = main_thing(ctx.get("watched") or ctx.get("video_title", ""), "idea", title=ctx.get("video_title") or "")

    def fill(s: str) -> str:
        return s.replace("{thing}", thing).replace("{Thing}", thing.capitalize())

    return {**template, "title": fill(template["title"]), "mission": fill(template["mission"]),
            "steps": [fill(s) for s in template["steps"]]}


async def verify(llm: LLM, quest: dict, proof: dict) -> dict:
    """proof: {"kind": "photo", "image_b64": ...} | {"kind": "voice", "said": ...} | {"kind": "steps", "steps": n}.
    Returns {"ok", "confidence", "note", "verified_by"}. verified_by tells the parent honestly
    how strong the check was."""
    brief = {"title": quest["title"], "mission": quest["mission"], "steps": quest["steps"]}
    kind = proof.get("kind")
    if kind == "steps":
        steps = int(proof.get("steps", 0))
        ok = steps >= 40
        note = f"The watch counted {steps} steps. " + ("That is a proper mission." if ok else "Keep moving, 40 steps finishes it.")
        return {"ok": ok, "confidence": 1.0, "note": note, "verified_by": "watch steps"}
    if kind == "photo":
        if llm.available and llm.vision:
            try:
                out = await llm.json(load_prompt("quest_verify"), json.dumps({"quest": brief}),
                                     images=[proof["image_b64"]], temperature=0.2, max_tokens=120)
                return {"ok": bool(out.get("ok")), "confidence": float(out.get("confidence", 0.5)),
                        "note": str(out.get("note", "")).strip() or "Got your photo.", "verified_by": "vision model"}
            except (LLMUnavailable, ValueError, TypeError):
                pass
        return {"ok": True, "confidence": 0.0, "note": "Photo saved. I could not check it myself, so your grown-up will see it.",
                "verified_by": "not verified (no vision model)"}
    said = str(proof.get("said", "")).strip()
    try:
        out = await llm.json(load_prompt("quest_verify"), json.dumps({"quest": brief, "said": said}, ensure_ascii=False),
                             temperature=0.2, max_tokens=120)
        return {"ok": bool(out.get("ok")), "confidence": float(out.get("confidence", 0.5)),
                "note": str(out.get("note", "")).strip() or "Thanks for telling me.", "verified_by": "language model"}
    except (LLMUnavailable, ValueError, TypeError):
        ok = len(said.split()) >= 5
        note = "Thanks for telling me what you did." if ok else "Tell me a bit more. What did you make or find out?"
        return {"ok": ok, "confidence": 0.3, "note": note, "verified_by": "length check only"}

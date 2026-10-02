"""Creator Studio: the script for the mini-documentary starring the child.

The hub writes the script; the TV page renders it live (photos with slow zoom, captions,
synthesised narration and music). Nothing is exported to a video file in this MVP.
"""
from __future__ import annotations

import json

from ..llm import LLM, LLMUnavailable, load_prompt
from .common import clip_words


async def script(llm: LLM, ctx: dict) -> dict:
    """ctx: child_name, age, quest, inspired_by, proof_note, minutes_taken, scene_count.
    Returns {"title", "scenes": [{"caption", "narration"}], "closing", "by"}."""
    count = max(3, min(5, int(ctx.get("scene_count", 4))))
    ctx = {**ctx, "scene_count": count}
    try:
        out = await llm.json(load_prompt("creator"), json.dumps(ctx, ensure_ascii=False), temperature=0.8, max_tokens=400)
        scenes = [{"caption": clip_words(str(s["caption"]), 6).rstrip("."), "narration": clip_words(str(s["narration"]), 24)}
                  for s in out.get("scenes", []) if isinstance(s, dict) and s.get("caption") and s.get("narration")]
        if len(scenes) >= 3 and out.get("title"):
            return {"title": str(out["title"])[:60], "scenes": scenes[:5],
                    "closing": str(out.get("closing", "")).strip() or "Made at home.", "by": "model"}
    except (LLMUnavailable, KeyError, TypeError):
        pass
    return scripted_script(ctx)


def scripted_script(ctx: dict) -> dict:
    name, quest = ctx.get("child_name", "Our maker"), ctx["quest"]
    minutes = max(1, round(ctx.get("minutes_taken") or quest.get("minutes", 10)))
    scenes = [
        {"caption": "It started with a video",
         "narration": f"While watching {ctx.get('inspired_by', 'a video')}, {name} spotted an idea worth stealing."},
        {"caption": "The mission",
         "narration": clip_words(quest["mission"], 22)},
        {"caption": "The attempt",
         "narration": clip_words(quest["steps"][1], 22)},
        {"caption": f"{minutes} minutes later",
         "narration": ctx.get("proof_note") or f"After {minutes} minutes of work, the result was ready for the camera."},
    ]
    if ctx["scene_count"] >= 5:
        scenes.append({"caption": "What comes next", "narration": f"The next idea is already forming. {name} is just getting started."})
    return {"title": f"{name}: {quest['title']}", "scenes": scenes[: ctx["scene_count"]],
            "closing": f"Directed by, built by and starring {name}.", "by": "scripted"}

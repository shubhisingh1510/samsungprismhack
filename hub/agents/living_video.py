"""Living Video agent: the line the companion speaks when the video 'talks back'."""
from __future__ import annotations

import json

from ..llm import LLM, LLMUnavailable, load_prompt
from .common import clip_words, is_unsafe, main_thing, topic_class

SCRIPTED = {
    "build": ("Pause. That {thing} trick? Bet you can't build a real one out of cardboard in ten minutes.",
              "cardboard {thing} in ten minutes"),
    "space": ("Hold on. You just saw {thing} up close. Bet you can't build a paper model of it in ten minutes.",
              "paper model of {thing}"),
    "cook": ("That looked tasty. Bet you can't invent a no-cook snack from the fridge. Ask a grown-up first.",
             "invent a no-cook snack"),
    "nature": ("Wait. Bet you can't move like that {thing} across the room and back without laughing.",
               "move like a {thing}"),
    "art": ("Pause. Bet you can't draw that {thing} from memory in five minutes. No peeking.",
            "draw {thing} from memory"),
    "move": ("Hold up. Bet you can't do that {thing} move ten times before the timer runs out.",
             "do the {thing} move"),
    "science": ("Wait a second. Bet you can't test that {thing} idea with stuff from your own room.",
                "test the {thing} idea"),
    "sensory": ("Okay, that was squishy. Bet you can't find the three most satisfying sounds in your house in five minutes.",
                "find three satisfying sounds"),
    "general": ("Quick one. Bet you can't explain {thing} to someone at home in under two minutes.",
                "explain {thing} in two minutes"),
}


async def dare(llm: LLM, ctx: dict) -> dict:
    """ctx: companion, child_name, age, mode, video_title, just_watched, minutes_watching.
    Returns {"line", "challenge", "by"} where by is "model" or "scripted"."""
    try:
        out = await llm.json(load_prompt("living_video"), json.dumps(ctx, ensure_ascii=False),
                             temperature=0.9, max_tokens=120)
        line, challenge = str(out.get("line", "")).strip(), str(out.get("challenge", "")).strip()
        if line and not is_unsafe(line, challenge):
            return {"line": clip_words(line, 40), "challenge": challenge or line, "by": "model"}
    except LLMUnavailable:
        pass
    return scripted_dare(ctx)


def scripted_dare(ctx: dict) -> dict:
    text = f'{ctx.get("video_title", "")} {ctx.get("just_watched", "")}'
    line, challenge = SCRIPTED[topic_class(text)]
    thing = main_thing(ctx.get("just_watched") or ctx.get("video_title", ""), title=ctx.get("video_title", ""))
    return {"line": line.format(thing=thing), "challenge": challenge.format(thing=thing), "by": "scripted"}

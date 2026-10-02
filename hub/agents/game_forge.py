"""Voice-to-Game Forge.

The agent writes a rules object (GameSpec); a fixed engine in web/js/engine.js runs it
inside a sandboxed iframe. The loop is generate -> validate -> repair, up to three
attempts, then a scripted parser. The child never executes model-written JavaScript,
which is what makes this safe to hand to a six-year-old.
"""
from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator

from ..llm import LLM, LLMUnavailable, load_prompt
from ..text import has_any

THEMES = ["space", "sky", "ocean", "forest", "night", "candy", "lava"]
MAX_ATTEMPTS = 3


class Player(BaseModel):
    emoji: str = Field(min_length=1, max_length=8)
    speed: int = Field(default=6, ge=1, le=10)


class Thing(BaseModel):
    look: str = Field(min_length=1, max_length=8)
    does: Literal["hurt", "score"]
    every: float = Field(default=1.2, ge=0.4, le=5)
    fall_speed: int = Field(default=3, ge=1, le=10)
    points: int = Field(default=1, ge=1, le=10)


class Quiz(BaseModel):
    on: bool = False
    ops: list[Literal["+", "-", "x"]] = Field(default_factory=lambda: ["+"])
    max: int = Field(default=10, ge=5, le=50)
    every: float = Field(default=9, ge=5, le=20)


class GameSpec(BaseModel):
    title: str = Field(min_length=1, max_length=40)
    player: Player
    theme: Literal["space", "sky", "ocean", "forest", "night", "candy", "lava"] = "night"
    things: list[Thing] = Field(min_length=1, max_length=4)
    quiz: Quiz = Field(default_factory=Quiz)
    lives: int = Field(default=3, ge=1, le=9)
    win_score: int = Field(default=15, ge=5, le=200)

    @model_validator(mode="after")
    def _can_score(self) -> "GameSpec":
        if not self.quiz.on and not any(t.does == "score" for t in self.things):
            raise ValueError("there is no way to score: add a thing that scores or turn the quiz on")
        if self.quiz.on and not self.quiz.ops:
            raise ValueError("quiz.ops is empty")
        return self


EMOJI = {
    "cat": "🐱", "kitten": "🐱", "dog": "🐶", "puppy": "🐶", "dragon": "🐉", "rocket": "🚀", "spaceship": "🚀",
    "robot": "🤖", "car": "🚗", "fish": "🐟", "shark": "🦈", "unicorn": "🦄", "dinosaur": "🦖", "dino": "🦖",
    "monkey": "🐵", "tiger": "🐯", "lion": "🦁", "elephant": "🐘", "rabbit": "🐰", "bunny": "🐰", "frog": "🐸",
    "bird": "🐦", "penguin": "🐧", "ninja": "🥷", "wizard": "🧙", "princess": "👸", "astronaut": "🧑‍🚀",
    "alien": "👽", "ghost": "👻", "bee": "🐝", "turtle": "🐢", "panda": "🐼", "peacock": "🦚", "cow": "🐮",
    "star": "⭐", "stars": "⭐", "coin": "🪙", "coins": "🪙", "apple": "🍎", "apples": "🍎", "mango": "🥭",
    "mangoes": "🥭", "banana": "🍌", "bananas": "🍌", "pizza": "🍕", "laddu": "🟡", "laddoo": "🟡",
    "samosa": "🥟", "samosas": "🥟", "candy": "🍬", "candies": "🍬", "heart": "💖", "hearts": "💖",
    "gem": "💎", "gems": "💎", "diamond": "💎", "diamonds": "💎", "cookie": "🍪", "cookies": "🍪",
    "bomb": "💣", "bombs": "💣", "rock": "🪨", "rocks": "🪨", "asteroid": "☄️", "asteroids": "☄️",
    "meteor": "☄️", "meteors": "☄️", "fire": "🔥", "fireball": "🔥", "fireballs": "🔥", "rain": "💧",
    "raindrops": "💧", "spider": "🕷️", "spiders": "🕷️", "snake": "🐍", "snakes": "🐍", "monster": "👾",
    "monsters": "👾", "zombie": "🧟", "zombies": "🧟", "broccoli": "🥦", "homework": "📚", "ball": "⚽",
    "balls": "⚽", "balloon": "🎈", "balloons": "🎈",
}
HAZARDS = {"💣", "🪨", "☄️", "🔥", "💧", "🕷️", "🐍", "👾", "🧟", "🥦", "📚"}
PLAYERS = {"🐱", "🐶", "🐉", "🚀", "🤖", "🚗", "🐟", "🦈", "🦄", "🦖", "🐵", "🐯", "🦁", "🐘", "🐰", "🐸", "🐦",
           "🐧", "🥷", "🧙", "👸", "🧑‍🚀", "👽", "👻", "🐝", "🐢", "🐼", "🦚", "🐮"}
MATH_WORDS = ["math", "maths", "sum", "sums", "numbers", "tables", "addition", "multiply", "multiplication",
              "subtract", "ganit", "गणित"]
THEME_WORDS = {"space": ["space", "galaxy", "planet", "moon", "stars", "rocket", "asteroid", "alien"],
               "ocean": ["ocean", "sea", "underwater", "fish", "shark"], "forest": ["forest", "jungle", "tree"],
               "sky": ["sky", "cloud", "clouds", "bird", "flying"], "candy": ["candy", "sweet", "cake", "unicorn"],
               "lava": ["lava", "volcano", "fire", "dragon"], "night": ["night", "dark", "ghost"]}


def mentioned(text: str) -> list[tuple[str, str]]:
    """Known nouns in the order the child said them: [(word, emoji)]."""
    found = []
    for match in re.finditer(r"[^\W\d_]+", text.lower()):
        word = match.group(0)
        if word in EMOJI and EMOJI[word] not in [e for _, e in found]:
            found.append((word, EMOJI[word]))
    return found


def scripted_spec(prompt: str) -> GameSpec:
    nouns = mentioned(prompt)
    player = next((e for _, e in nouns if e in PLAYERS), "🐱")
    math = has_any(prompt, MATH_WORDS)
    things: list[Thing] = []
    for _, emoji in nouns:
        if emoji == player or len(things) >= 3:
            continue
        things.append(Thing(look=emoji, does="hurt" if emoji in HAZARDS else "score"))
    if math:
        things.insert(0, Thing(look="math", does="hurt"))
    if not any(t.does == "hurt" for t in things):
        things.append(Thing(look="💣", does="hurt", every=1.6))
    if not any(t.does == "score" for t in things):
        things.append(Thing(look="⭐", does="score", every=1.4, points=1))
    theme = next((name for name, words in THEME_WORDS.items() if has_any(prompt, words)), "night")
    speed = 5 if has_any(prompt, ["fast", "speedy", "quick", "tez"]) else 3
    for t in things:
        t.fall_speed = speed
    title = next((w.capitalize() for w, e in nouns if e == player), "Cat") + (" vs Maths" if math else " Dash")
    return GameSpec(title=title, player=Player(emoji=player), theme=theme, things=things[:4],
                    quiz=Quiz(on=math, ops=["+"], max=10), lives=3, win_score=15)


async def create(llm: LLM, prompt: str) -> dict:
    """Returns {"rules", "by", "attempts", "said"}."""
    errors, attempts = None, 0
    try:
        while attempts < MAX_ATTEMPTS:
            attempts += 1
            payload = {"request": prompt} | ({"errors": errors} if errors else {})
            raw = await llm.json(load_prompt("game_forge"), json.dumps(payload, ensure_ascii=False),
                                 temperature=0.7, max_tokens=500)
            try:
                spec = GameSpec(**raw)
                return {"rules": spec.model_dump(), "by": "model", "attempts": attempts,
                        "said": f"Your game is ready: {spec.title}."}
            except (ValidationError, TypeError) as e:
                errors = _short(e)
    except LLMUnavailable:
        pass
    spec = scripted_spec(prompt)
    return {"rules": spec.model_dump(), "by": "scripted", "attempts": attempts,
            "said": f"Your game is ready: {spec.title}."}


async def edit(llm: LLM, rules: dict, instruction: str) -> dict:
    """Returns {"rules", "changed", "by"}. Invalid edits leave the game as it was."""
    current = GameSpec(**rules)
    try:
        out = await llm.json(load_prompt("game_edit"),
                             json.dumps({"rules": current.model_dump(), "instruction": instruction}, ensure_ascii=False),
                             temperature=0.3, max_tokens=500)
        spec = GameSpec(**out["rules"])
        return {"rules": spec.model_dump(), "changed": str(out.get("changed", "Changed.")), "by": "model"}
    except (LLMUnavailable, ValidationError, KeyError, TypeError):
        pass
    return scripted_edit(current, instruction)


def scripted_edit(spec: GameSpec, instruction: str) -> dict:
    data, low, changed = spec.model_dump(), instruction.lower(), []
    number = re.search(r"\d+", low)
    n = int(number.group(0)) if number else None

    if has_any(low, ["life", "lives", "heart", "hearts"]) and n:
        data["lives"] = max(1, min(9, n))
        changed.append(f"You now have {data['lives']} lives.")
    elif has_any(low, ["win", "score", "points", "target"]) and n:
        data["win_score"] = max(5, min(200, n))
        changed.append(f"You now win at {data['win_score']} points.")
    if has_any(low, ["faster", "fast", "speed up", "harder", "tez"]):
        for t in data["things"]:
            t["fall_speed"] = min(10, t["fall_speed"] + 2)
        changed.append("Everything falls faster.")
    elif has_any(low, ["slower", "slow", "easier", "easy", "dheere"]):
        for t in data["things"]:
            t["fall_speed"] = max(1, t["fall_speed"] - 1)
        changed.append("Everything falls slower.")
    if has_any(low, ["more things", "more stuff", "more of them", "lots more"]):
        for t in data["things"]:
            t["every"] = max(0.4, round(t["every"] * 0.7, 2))
        changed.append("Things drop more often.")
    if has_any(low, ["bigger numbers", "harder maths", "harder math", "harder sums"]):
        data["quiz"]["on"], data["quiz"]["max"] = True, min(50, data["quiz"]["max"] + 10)
        changed.append(f"Sums now go up to {data['quiz']['max']}.")
    if has_any(low, ["times tables", "multiply", "multiplication"]):
        data["quiz"]["on"], data["quiz"]["ops"] = True, ["x"]
        changed.append("The quiz now asks times tables.")
    if has_any(low, ["no maths", "no math", "remove maths", "remove math", "without maths", "without math"]):
        kept = [t for t in data["things"] if t["look"] != "math"]
        data["things"] = kept or [{"look": "⭐", "does": "score", "every": 1.4, "fall_speed": 3, "points": 1}]
        data["quiz"]["on"] = False
        if not any(t["does"] == "score" for t in data["things"]):
            data["things"].append({"look": "⭐", "does": "score", "every": 1.4, "fall_speed": 3, "points": 1})
        changed.append("The maths is gone.")
    theme = next((name for name, words in THEME_WORDS.items() if has_any(low, [name] + words)), None)
    nouns = mentioned(low)
    if has_any(low, ["add", "collect", "catch", "also drop"]) and nouns and len(data["things"]) < 4:
        word, emoji = nouns[-1]
        data["things"].append({"look": emoji, "does": "hurt" if emoji in HAZARDS else "score", "every": 1.4,
                               "fall_speed": data["things"][0]["fall_speed"], "points": 1})
        changed.append(f"Added {word}.")
    elif nouns and has_any(low, ["change", "make", "turn", "swap", "be a", "into", "instead", "player"]):
        word, emoji = nouns[-1]
        if emoji in PLAYERS:
            data["player"]["emoji"] = emoji
            changed.append(f"The player is now a {word}.")
    elif theme:
        data["theme"] = theme
        changed.append(f"The world is now {theme}.")
    try:
        new = GameSpec(**data)
    except ValidationError:
        return {"rules": spec.model_dump(), "changed": "That change would break the game, so I left it as it was.",
                "by": "scripted"}
    if not changed:
        return {"rules": spec.model_dump(), "by": "scripted",
                "changed": "I did not catch a change I can make. Try: faster, five lives, or make the player a dragon."}
    return {"rules": new.model_dump(), "changed": " ".join(changed), "by": "scripted"}


def _short(error: Exception) -> str:
    if isinstance(error, ValidationError):
        return "; ".join(f'{".".join(str(p) for p in e["loc"])}: {e["msg"]}' for e in error.errors())[:600]
    return str(error)[:300]

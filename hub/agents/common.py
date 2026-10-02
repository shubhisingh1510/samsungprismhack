"""Shared helpers for the scripted fallbacks that run when no local model is available."""
from __future__ import annotations

from collections import Counter

from ..text import STOPWORDS, has_any, keywords, tokens

TOPIC_WORDS = {
    "build": ["build", "building", "door", "piston", "redstone", "craft", "lego", "bridge", "tower", "machine",
              "robot", "lever", "wall", "house", "base", "staircase"],
    "space": ["saturn", "planet", "planets", "moon", "moons", "star", "stars", "rocket", "space", "rings",
              "telescope", "galaxy", "sun", "astronaut"],
    "cook": ["recipe", "cook", "cooking", "bake", "sandwich", "snack", "kitchen", "chef", "dosa", "roti", "cake"],
    "nature": ["animal", "animals", "bird", "birds", "insect", "plant", "plants", "tree", "ocean", "dinosaur",
               "tiger", "elephant", "forest"],
    "art": ["draw", "drawing", "paint", "painting", "sketch", "colour", "color", "origami", "art"],
    "move": ["dance", "football", "cricket", "trick", "skate", "yoga", "gymnastics", "jump", "goal", "workout"],
    "science": ["experiment", "science", "magnet", "volcano", "chemistry", "physics", "electric", "gravity"],
    "sensory": ["slime", "satisfying", "squish", "asmr", "sand", "soap"],
}

UNSAFE = ["knife", "knives", "fire", "flame", "match", "matches", "lighter", "stove", "oven", "boil", "boiling",
          "candle", "socket", "plug in", "bleach", "chemical", "roof", "balcony", "climb", "ladder", "blade",
          "razor", "glue gun", "outside alone", "swallow"]


VOCABULARY = {w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w
              for words in TOPIC_WORDS.values() for w in words}


def topic_class(text: str) -> str:
    best, hits = "general", 0
    for name, words in TOPIC_WORDS.items():
        n = sum(1 for w in words if has_any(text, [w]))
        if n > hits:
            best, hits = name, n
    return best


def singular(word: str) -> str:
    return word[:-1] if len(word) > 3 and word.endswith("s") and not word.endswith("ss") else word


def main_thing(text: str, fallback: str = "that", title: str = "") -> str:
    """The thing the video is about, used to make scripted lines refer to it. Title words
    win, preferring ones PORTAL knows how to build a challenge around and then the ones
    the transcript mentions most; with no usable title word, the transcript's top word."""
    counts = Counter(singular(t) for t in tokens(text) if t not in STOPWORDS)
    in_title = [w for w in dict.fromkeys(singular(t) for t in tokens(title)) if w not in STOPWORDS]
    known = [w for w in in_title if w in VOCABULARY]
    if known:
        return max(known, key=lambda w: counts.get(w, 0))
    mentioned = [w for w in in_title if counts.get(w)]
    if mentioned:
        return max(mentioned, key=lambda w: counts[w])
    words = keywords(text, 1) or keywords(title, 1)
    return singular(words[0]) if words else fallback


def is_unsafe(*texts: str) -> bool:
    return any(has_any(t, UNSAFE) for t in texts if t)


def clip_words(text: str, limit: int) -> str:
    words = text.split()
    return text if len(words) <= limit else " ".join(words[:limit]).rstrip(",;:") + "."

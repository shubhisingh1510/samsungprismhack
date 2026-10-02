"""Small text helpers shared by retrieval, breakpoints and the scripted fallbacks."""
from __future__ import annotations

import re
import zlib
from collections import Counter

import numpy as np

STOPWORDS = set("""
a about above after again all also am an and any are as at be because been before being below between both
but by can could did do does doing don down during each few for from further get gets go going gonna got had
has have having he her here hers him his how i if in into is it its just know let like look lot make makes
me more most my need no nor not now of off ok okay on once one only or other our out over own really right
same see she should so some such take than that the their them then there these they thing things this
those through to too two under until up use used using very want was way we well were what when where which
while who why will with would yeah you your yours guys today video watch watching going little bit
hey hello welcome channel subscribe everyone builders back minute minutes thanks
""".split())

DIM = 512


def tokens(text: str) -> list[str]:
    return [t.lower() for t in re.findall(r"[^\W\d_]{2,}", text, flags=re.UNICODE)]


def keywords(text: str, k: int = 3) -> list[str]:
    """Most frequent content words, ties broken by first appearance."""
    words = [t for t in tokens(text) if t not in STOPWORDS and len(t) > 2]
    counts = Counter(words)
    order = {w: i for i, w in reversed(list(enumerate(words)))}
    return [w for w, _ in sorted(counts.items(), key=lambda kv: (-kv[1], order[kv[0]]))[:k]]


def embed(text: str) -> np.ndarray:
    """Hashed bag-of-words vector. Deterministic, dependency-free, good enough for a
    ten-minute rolling window. Swap for a sentence-embedding model without touching callers."""
    vec = np.zeros(DIM, dtype=np.float32)
    for t in tokens(text):
        if t not in STOPWORDS:
            vec[zlib.crc32(t.encode("utf-8")) % DIM] += 1.0
    norm = float(np.linalg.norm(vec))
    return vec / norm if norm else vec


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))


def has_any(text: str, words) -> bool:
    low = text.lower()
    return any(re.search(rf"(?<!\w){re.escape(w)}(?!\w)", low) for w in words)

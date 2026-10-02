"""Streaming live RAG index.

Transcript chunks are added as the child reaches them, so the agents can only retrieve
what has actually been watched so far. Two retrieval modes: a time window ("the last
90 seconds") and similarity search.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .text import cosine, embed

MAX_CHUNKS = 2000


@dataclass
class Chunk:
    video_id: str
    start: float
    end: float
    text: str
    vec: np.ndarray = field(repr=False, default=None)


class LiveIndex:
    def __init__(self) -> None:
        self.chunks: list[Chunk] = []

    def add(self, video_id: str, start: float, end: float, text: str) -> None:
        self.chunks.append(Chunk(video_id, start, end, text, embed(text)))
        if len(self.chunks) > MAX_CHUNKS:
            del self.chunks[: len(self.chunks) - MAX_CHUNKS]

    def window(self, video_id: str, t0: float, t1: float) -> str:
        parts = [c.text for c in self.chunks if c.video_id == video_id and c.end > t0 and c.start <= t1]
        return " ".join(parts)

    def search(self, query: str, k: int = 3, video_id: str | None = None) -> list[Chunk]:
        q = embed(query)
        pool = [c for c in self.chunks if video_id is None or c.video_id == video_id]
        scored = sorted(pool, key=lambda c: cosine(q, c.vec), reverse=True)
        return [c for c in scored[:k] if cosine(q, c.vec) > 0]

    def clear(self) -> None:
        self.chunks.clear()

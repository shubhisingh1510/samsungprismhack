"""Video catalogue: bundled sample reels plus any YouTube video with captions.

A sample reel is a caption track with timings and emoji, drawn by the child page as an
animated card. It needs no network and no licensed footage. A YouTube video plays in
the real IFrame player; its captions are fetched once and cached next to the reels.
"""
from __future__ import annotations

import json
import re

import httpx

from . import config
from .breakpoints import find_breakpoints
from .text import has_any, keywords

YOUTUBE_ID = re.compile(r"(?:v=|youtu\.be/|/shorts/|/embed/|/live/)([A-Za-z0-9_-]{11})")


class Catalogue:
    def __init__(self) -> None:
        self.videos: dict[str, dict] = {}
        config.VIDEOS.mkdir(parents=True, exist_ok=True)
        for path in sorted(config.VIDEOS.glob("*.json")):
            self._add(json.loads(path.read_text(encoding="utf-8")))

    def _add(self, video: dict) -> dict:
        video.setdefault("segments", [])
        video["breakpoints"] = find_breakpoints(video["segments"])
        last = video["segments"][-1] if video["segments"] else None
        video.setdefault("duration", round(last["start"] + last["dur"] + 1.0, 1) if last else 0)
        self.videos[video["id"]] = video
        return video

    def get(self, video_id: str) -> dict | None:
        return self.videos.get(video_id)

    def listing(self) -> list[dict]:
        return [{k: v[k] for k in ("id", "title", "channel", "source", "category") if k in v}
                for v in self.videos.values()]

    def add_youtube(self, url: str) -> dict:
        match = YOUTUBE_ID.search(url)
        if not match:
            raise ValueError("That does not look like a YouTube link.")
        yt_id = match.group(1)
        video_id = f"yt_{yt_id}"
        if video_id in self.videos:
            return self.videos[video_id]
        title, channel = _oembed(yt_id)
        segments, note = _captions(yt_id)
        text = " ".join(s["text"] for s in segments)
        video = {
            "id": video_id, "youtube_id": yt_id, "title": title, "channel": channel, "source": "youtube",
            "category": "shorts" if "/shorts/" in url else guess_category(title + " " + text[:600]),
            "topics": keywords(title + " " + text, 3), "segments": segments, "caption_note": note,
        }
        (config.VIDEOS / f"{video_id}.json").write_text(json.dumps(video, ensure_ascii=False, indent=1), encoding="utf-8")
        return self._add(video)


def guess_category(text: str) -> str:
    if has_any(text, ["minecraft", "roblox", "gameplay", "fortnite", "gaming", "speedrun", "free fire", "bgmi"]):
        return "gaming"
    if has_any(text, ["cartoon", "episode", "peppa", "doraemon", "chhota bheem", "shinchan", "motu patlu", "animation"]):
        return "cartoon"
    if has_any(text, ["song", "music", "lyrics", "official video", "rhymes"]):
        return "music"
    if has_any(text, ["explained", "science", "how does", "why do", "learn", "experiment", "history", "maths", "math", "tutorial"]):
        return "educational"
    return "other"


def _oembed(yt_id: str) -> tuple[str, str]:
    try:
        r = httpx.get("https://www.youtube.com/oembed",
                      params={"url": f"https://www.youtube.com/watch?v={yt_id}", "format": "json"}, timeout=8)
        r.raise_for_status()
        data = r.json()
        return data.get("title", yt_id), data.get("author_name", "YouTube")
    except Exception:
        return f"YouTube video {yt_id}", "YouTube"


def _captions(yt_id: str) -> tuple[list[dict], str]:
    """Returns (segments, note). No captions is not an error: the Brain then waits for
    the end of the video instead of guessing a breakpoint."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        fetched = YouTubeTranscriptApi().fetch(yt_id, languages=["en", "en-IN", "hi"])
        segments = [{"start": round(s.start, 2), "dur": round(s.duration, 2), "text": s.text.replace("\n", " ")}
                    for s in fetched]
        return segments, f"{len(segments)} caption lines"
    except Exception as e:
        return [], f"no captions available ({type(e).__name__})"

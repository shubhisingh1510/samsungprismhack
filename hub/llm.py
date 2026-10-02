"""Local LLM client (Ollama HTTP API).

Every agent calls this and catches LLMUnavailable to fall back to its scripted path,
so the demo keeps working when no model is installed or the model is too slow.
"""
from __future__ import annotations

import json
import re
import time

import httpx

from . import config

PREFERRED = ("gemma3", "gemma", "qwen", "llama3", "phi", "mistral")


class LLMUnavailable(Exception):
    pass


class LLM:
    def __init__(self, base_url: str = config.OLLAMA_URL, model: str = config.MODEL,
                 timeout: float = config.LLM_TIMEOUT_S, transport: httpx.AsyncBaseTransport | None = None):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.available = False
        self.vision = False
        self.last_ms: float | None = None
        self._client = httpx.AsyncClient(timeout=timeout, transport=transport)

    async def probe(self) -> bool:
        """Find out whether a local model is reachable, and which one to use."""
        self.available = False
        try:
            r = await self._client.get(f"{self.base_url}/api/tags", timeout=3)
            r.raise_for_status()
            names = [m["name"] for m in r.json().get("models", [])]
        except Exception:
            return False
        names = [n for n in names if "embed" not in n]
        if not names:
            return False
        if not self.model or self.model not in names:
            self.model = next((n for p in PREFERRED for n in names if n.startswith(p)), names[0])
        try:
            r = await self._client.post(f"{self.base_url}/api/show", json={"model": self.model}, timeout=5)
            self.vision = "vision" in r.json().get("capabilities", [])
        except Exception:
            self.vision = False
        self.available = True
        return True

    async def chat(self, system: str, user: str, *, as_json: bool = False, images: list[str] | None = None,
                   temperature: float = 0.7, max_tokens: int = 400) -> str:
        if not self.available:
            raise LLMUnavailable("no local model")
        message: dict = {"role": "user", "content": user}
        if images:
            message["images"] = images
        body: dict = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, message],
            "stream": False,
            "keep_alive": "30m",
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        if as_json:
            body["format"] = "json"
        started = time.perf_counter()
        try:
            r = await self._client.post(f"{self.base_url}/api/chat", json=body)
            r.raise_for_status()
            text = r.json()["message"]["content"]
        except Exception as e:
            raise LLMUnavailable(str(e)) from e
        self.last_ms = (time.perf_counter() - started) * 1000
        return text.strip()

    async def json(self, system: str, user: str, **kw) -> dict:
        text = await self.chat(system, user, as_json=True, **kw)
        try:
            return parse_json(text)
        except ValueError as e:
            raise LLMUnavailable(f"model did not return JSON: {e}") from e

    async def close(self) -> None:
        await self._client.aclose()


def parse_json(text: str) -> dict:
    """Small models wrap JSON in prose or code fences; dig the object out."""
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise ValueError("no JSON object found")
        try:
            value = json.loads(match.group(0))
        except json.JSONDecodeError as e:
            raise ValueError(str(e)) from e
    if not isinstance(value, dict):
        raise ValueError("JSON was not an object")
    return value


def load_prompt(name: str) -> str:
    return (config.PROMPTS / f"{name}.md").read_text(encoding="utf-8")

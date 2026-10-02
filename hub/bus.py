"""In-home event bus.

Topics are MQTT-style strings ("screen/tick", "house/state"). Devices connect over
WebSocket with a role (child, tv, parent, forge). Hub-side agents subscribe with on().
Retained topics are replayed to late joiners, the way MQTT retained messages work.
"""
from __future__ import annotations

import json
from collections import defaultdict
from typing import Any, Awaitable, Callable

Handler = Callable[[dict], Awaitable[None]]

RETAINED = {"house/state", "tv/show", "brain/state", "quest/update", "status"}


class Bus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = defaultdict(list)
        self._sockets: dict[Any, str] = {}
        self._retained: dict[str, dict] = {}

    def on(self, topic: str, handler: Handler) -> None:
        self._handlers[topic].append(handler)

    async def connect(self, ws: Any, role: str) -> None:
        self._sockets[ws] = role
        for topic, data in self._retained.items():
            await self._send(ws, topic, data)

    def disconnect(self, ws: Any) -> None:
        self._sockets.pop(ws, None)

    async def dispatch(self, topic: str, data: dict) -> None:
        """A device sent us an event: hand it to hub-side handlers."""
        for handler in self._handlers.get(topic, []):
            await handler(data)

    async def emit(self, topic: str, data: dict, roles: tuple[str, ...] | None = None) -> None:
        """The hub publishes: fan out to connected devices (optionally only some roles)."""
        if topic in RETAINED:
            self._retained[topic] = data
        for ws, role in list(self._sockets.items()):
            if roles is None or role in roles:
                await self._send(ws, topic, data)

    def clear_retained(self) -> None:
        self._retained.clear()

    async def _send(self, ws: Any, topic: str, data: dict) -> None:
        try:
            await ws.send_text(json.dumps({"topic": topic, "data": data}))
        except Exception:
            self.disconnect(ws)

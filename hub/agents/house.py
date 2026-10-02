"""House agent: the home reacts.

Every scene is a list of plain device commands. With a SmartThings token and device IDs
the commands go to the real SmartThings REST API; without them they only drive the
simulator on the TV page. Either way the simulator shows the state, and the status
badge says which mode is running. This agent is deterministic: no LLM chooses what the
house does.
"""
from __future__ import annotations

import asyncio

import httpx

from .. import config
from ..bus import Bus

DEFAULT = {"level": 60, "kelvin": 4000, "on": True}


class House:
    def __init__(self, bus: Bus, transport: httpx.AsyncBaseTransport | None = None, ramp_seconds: float = 6.0) -> None:
        self.bus = bus
        self.live = bool(config.ST_TOKEN and config.ST_LIGHT_IDS)
        self.ramp_seconds = ramp_seconds
        self.lights = dict(DEFAULT)
        self.speaker = {"playing": None, "volume": 0}
        self.scene = "normal"
        self.last_error: str | None = None
        self._before: dict | None = None
        self._ramp: asyncio.Task | None = None
        self._client = httpx.AsyncClient(timeout=6, transport=transport,
                                         headers={"Authorization": f"Bearer {config.ST_TOKEN}"})

    def state(self) -> dict:
        return {"mode": "live" if self.live else "simulated", "scene": self.scene, "lights": self.lights,
                "speaker": self.speaker, "error": self.last_error}

    async def publish(self) -> None:
        await self.bus.emit("house/state", self.state())

    # --- scenes ---
    async def sunrise(self) -> None:
        """Lights drift to warm sunrise orange and brighten; the speaker plays birdsong."""
        await self._remember()
        self.scene = "sunrise"
        await self._speaker("birdsong", 25)
        self._start_ramp(level_to=85, kelvin_to=2200)

    async def winddown(self) -> None:
        await self._remember()
        self.scene = "winddown"
        await self._speaker(None, 0)
        self._start_ramp(level_to=10, kelvin_to=2000)

    async def restore(self) -> None:
        if self._ramp:
            self._ramp.cancel()
        before = self._before or DEFAULT
        self._before = None
        self.scene = "normal"
        await self._speaker(None, 0)
        await self._lights(before["level"], before["kelvin"])

    # --- internals ---
    async def _remember(self) -> None:
        if self._before is None:
            self._before = dict(self.lights)

    def _start_ramp(self, level_to: int, kelvin_to: int, steps: int = 6) -> None:
        if self._ramp:
            self._ramp.cancel()

        async def run() -> None:
            level0, kelvin0 = self.lights["level"], self.lights["kelvin"]
            for i in range(1, steps + 1):
                f = i / steps
                await self._lights(round(level0 + (level_to - level0) * f), round(kelvin0 + (kelvin_to - kelvin0) * f))
                if i < steps:
                    await asyncio.sleep(self.ramp_seconds / steps)

        self._ramp = asyncio.create_task(run())

    async def _lights(self, level: int, kelvin: int) -> None:
        self.lights = {"level": level, "kelvin": kelvin, "on": level > 0}
        if self.live:
            for device in config.ST_LIGHT_IDS:
                await self._command(device, [
                    {"component": "main", "capability": "switch", "command": "on" if level > 0 else "off"},
                    {"component": "main", "capability": "switchLevel", "command": "setLevel", "arguments": [level]},
                    {"component": "main", "capability": "colorTemperature", "command": "setColorTemperature",
                     "arguments": [kelvin]},
                ])
        await self.publish()

    async def _speaker(self, track: str | None, volume: int) -> None:
        self.speaker = {"playing": track, "volume": volume}
        if self.live and config.ST_SPEAKER_ID and config.ST_BIRDSONG_URL:
            if track:
                await self._command(config.ST_SPEAKER_ID, [
                    {"component": "main", "capability": "audioNotification", "command": "playTrack",
                     "arguments": [config.ST_BIRDSONG_URL, volume]}])
            else:
                await self._command(config.ST_SPEAKER_ID, [
                    {"component": "main", "capability": "mediaPlayback", "command": "stop"}])
        await self.publish()

    async def _command(self, device_id: str, commands: list[dict]) -> None:
        try:
            r = await self._client.post(f"{config.ST_BASE}/devices/{device_id.strip()}/commands", json={"commands": commands})
            r.raise_for_status()
            self.last_error = None
        except Exception as e:
            # A failed bulb must never stall the Brain; the simulator still shows the intent.
            self.last_error = f"SmartThings: {type(e).__name__}: {str(e)[:120]}"

    async def close(self) -> None:
        if self._ramp:
            self._ramp.cancel()
        await self._client.aclose()

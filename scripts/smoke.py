"""End-to-end rehearsal against a running hub, with no browser.

Pretends to be the child phone, the TV and the parent page over the real WebSocket bus
and REST API, and walks the whole demo story:

  rule taught -> shorts blocked -> video talks back -> child argues and wins time
  -> house reacts -> quest accepted -> photo proof -> documentary on the TV

Run the hub first, then:  .venv\\Scripts\\python scripts\\smoke.py
"""
import asyncio
import json
import sys

import httpx
import websockets

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
WS = BASE.replace("http", "ws") + "/ws?role="
PHOTO = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="


class Device:
    def __init__(self, role):
        self.role, self.inbox, self.ws = role, [], None

    async def start(self):
        self.ws = await websockets.connect(WS + self.role, max_size=None)
        asyncio.create_task(self._read())

    async def _read(self):
        async for raw in self.ws:
            self.inbox.append(json.loads(raw))

    async def send(self, topic, data):
        await self.ws.send(json.dumps({"topic": topic, "data": data}))

    async def expect(self, topic, timeout=8, **match):
        for _ in range(int(timeout * 20)):
            for m in self.inbox:
                if m["topic"] == topic and all(m["data"].get(k) == v for k, v in match.items()):
                    self.inbox.remove(m)
                    return m["data"]
            await asyncio.sleep(0.05)
        raise AssertionError(f"{self.role} never received {topic} {match}")


def step(text):
    print(f"  ok  {text}")


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as http:
        post = lambda path, body=None: http.post(path, json=body or {})  # noqa: E731
        (await post("/api/demo/reset")).raise_for_status()
        status = (await http.get("/api/status")).json()
        print(f"hub: AI model {'on: ' + status['llm']['model'] if status['llm']['on'] else 'off (scripted lines)'}, "
              f"SmartThings {status['smartthings']}")

        child, tv, parent = Device("child"), Device("tv"), Device("parent")
        for d in (child, tv, parent):
            await d.start()
        await post("/api/context", {"speed": 60})

        # 1. Parent teaches a rule; NEST reads it back; parent confirms.
        rules = (await post("/api/rules/compile", {"text": "Cartoon is fine after homework, but no shorts reels ever."})).json()
        assert len(rules) == 2, rules
        for r in rules:
            assert r["status"] == "draft"
            (await post(f"/api/rules/{r['id']}/confirm")).raise_for_status()
        step(f'rule compiled and confirmed: "{rules[1]["understanding"]}"')

        # 2. Shorts are blocked at once, and arguing does not help.
        await child.send("screen/tick", {"video_id": "reel_slime_shorts", "t": 1, "playing": True, "dt": 1})
        blocked = await child.expect("player/cmd", cmd="enforce")
        await child.send("voice/utterance", {"text": "please five more minutes"})
        held = await child.expect("player/cmd", cmd="say")
        assert "can't change it" in held["line"]
        step(f'shorts blocked: "{blocked["line"]}"')

        # 3. Long-form video: no interruption until drift, then only at a breakpoint.
        t, cmd = 0.0, None
        for _ in range(80):
            t += 1
            await child.send("screen/tick", {"video_id": "reel_piston_door", "t": t, "playing": True, "dt": 1})
            await asyncio.sleep(0.02)
            cmd = next((m["data"] for m in child.inbox if m["topic"] == "player/cmd" and m["data"]["cmd"] == "interrupt"), None)
            if cmd:
                break
        assert cmd, "no interruption was scheduled"
        video = (await http.get("/api/videos/reel_piston_door")).json()
        assert cmd["at"] in [p["t"] for p in video["breakpoints"]]
        step(f'after {t:.0f} session-minutes, interruption scheduled for breakpoint at {cmd["at"]}s: "{cmd["line"]}"')

        # 4. The phone pauses at the breakpoint; the child barges in and argues.
        await child.send("player/interrupted", {"decision_id": cmd["decision_id"], "late_ms": 60})
        await child.send("voice/utterance", {"text": "two more minutes, it's almost done", "barge_in": True, "barge_ms": 180})
        resume = await child.expect("player/cmd", cmd="resume")
        step(f'child argued, agent granted: "{resume["line"]}"')

        # 5. Past 45 minutes and still drifting: the house reacts, the video keeps playing.
        await post("/api/context", {"jump_min": 12})
        for i in range(4):
            await child.send("screen/tick", {"video_id": "reel_piston_door", "t": cmd["at"] + 1 + i, "playing": True, "dt": 1})
            await asyncio.sleep(0.05)
        portal = await tv.expect("tv/show", screen="portal")
        await asyncio.sleep(1.5)
        house = (await tv.expect("house/state", scene="sunrise"))
        offered = await child.expect("quest/update", state="offered")
        step(f'house reacted ({house["mode"]} SmartThings), TV opened portal: "{portal["quest"]["title"]}"')

        # 6. Child walks over (watch), accepts, does the quest, sends a photo.
        await tv.send("body/update", {"still_min": 0, "steps": 20})
        await tv.expect("tv/show", screen="quest")
        (await post("/api/quest/accept")).raise_for_status()
        await child.expect("quest/update", state="active")
        for _ in range(6):
            await child.send("screen/tick", {"video_id": "reel_piston_door", "t": 60, "playing": False, "dt": 1})
        await asyncio.sleep(0.2)
        result = (await post(f"/api/quest/{offered['quest']['id']}/proof", {"kind": "photo", "images_b64": [PHOTO]})).json()
        assert result["ok"], result
        film = await tv.expect("tv/show", screen="documentary")
        done = await child.expect("quest/update", state="complete")
        step(f'quest complete (+{done["reward"]} sparks, proof check: {result["verified_by"]})')
        step(f'documentary on TV: "{film["film"]["title"]}", {len(film["film"]["scenes"])} scenes, {len(film["photos"])} photo')

        # 7. Everything above is in the parent's log, with reasons.
        log = (await http.get("/api/log")).json()
        metrics = (await http.get("/api/metrics")).json()
        kinds = [d["kind"] for d in log]
        for kind in ("enforce", "rule_held", "dare", "argument", "house", "quest_start", "quest_complete"):
            assert kind in kinds, f"{kind} missing from the log: {kinds}"
        assert all(d.get("reason") for d in log)
        step(f"parent log has {len(log)} entries, every one with a reason")
        print("\nmetrics:", json.dumps({k: metrics[k] for k in ("passive_min", "active_min", "interventions", "acceptance_rate",
                                                               "engagement_rate", "quests_completed", "rules_enforced")}))

        # 8. Game Forge.
        game = (await post("/api/forge/create", {"text": "Make me a game where a cat dodges math problems"})).json()
        edited = (await post("/api/forge/edit", {"rules": game["rules"], "instruction": "make the player a dragon"})).json()
        assert edited["rules"]["player"]["emoji"] == "🐉"
        step(f'game forged ("{game["rules"]["title"]}", {game["by"]}) and edited by instruction: {edited["changed"]}')
        print("\nALL STEPS PASSED")


asyncio.run(main())

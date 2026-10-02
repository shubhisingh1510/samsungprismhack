# NEST

**small moments. bigger worlds.**

An agent system for the Samsung home that turns passive screen time into things a child does in the real world. It never blocks on its own initiative. It waits for a natural pause in the video, dares the child to try what they just watched, listens when they argue, and lets the house (lights, speaker, TV) join in.

Samsung PRISM Agentic AI challenge. Primary track: Interruptible Real-time Agents.

## Run it

```powershell
cd C:\Users\MAYANK\portal
.\.venv\Scripts\python.exe -m uvicorn hub.main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000 on the laptop. That is the NEST story: a long-form product site with a demo mode ("Enter NEST") that drives this hub live. The working prototype, one page per device, is at http://localhost:8000/devices.html:

| Page | Stands for | Open it on |
|---|---|---|
| `/child.html` | The child's Galaxy phone | the phone |
| `/tv.html` | Galaxy TV app, SmartThings lights and speaker, Galaxy Watch | the laptop, full screen |
| `/parent.html` | The parent's phone, plus demo controls | the laptop, second window |
| `/forge.html` | Voice-to-Game Forge | either |

### The NEST site

The site in `site/` (React, TypeScript, Vite, Tailwind, Motion) is already built into `web/nest/`, so the hub serves it with no Node step. To change it:

```powershell
cd site
npm install
npm run dev      # http://localhost:5173/nest/ with live reload; /api and /ws are proxied to the hub
npm run build    # writes web/nest/
```

Logo files and a brand sheet are in `site/public/brand/` (served at `/nest/brand/`). Design notes: `docs/11-nest-design.md`.

First-time setup on a new machine: `python -m venv .venv`, then `.venv\Scripts\pip install -r requirements.txt`.

### Phone setup

The phone must reach the laptop, and Chrome only allows the microphone on a secure page. Pick one:

1. **USB (most reliable):** install Android platform-tools, enable USB debugging, run `adb reverse tcp:8000 tcp:8000`, then open `http://localhost:8000/child.html` on the phone.
2. **Wi-Fi:** on the phone open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<laptop-ip>:8000` (the landing page shows the address), relaunch Chrome.

Without either, the page still works with typed replies and the "I'm in" button; only the microphone is unavailable.

### Turn on the local AI model (optional)

Everything runs without a model, using scripted lines. With one, the dares, quests, judge, rule compiler, game rules and documentary script are written by the model.

```powershell
winget install Ollama.Ollama
ollama pull gemma3:4b
```

Restart the hub, or press "Look for local AI model" on the parent page. The status chip on every page changes from "AI model: off, scripted lines" to "AI: local gemma3:4b". Set `PORTAL_MODEL` to force a specific model.

### Turn on real SmartThings (optional)

```powershell
$env:SMARTTHINGS_TOKEN = "<personal access token>"
$env:SMARTTHINGS_LIGHT_IDS = "<deviceId>,<deviceId>"
```

Personal access tokens expire after 24 hours, so make a fresh one on demo day. The lights need the `switch`, `switchLevel` and `colorTemperature` capabilities.

## What is real and what is simulated

Every page shows this live in its status chips. In full:

| Part | Status |
|---|---|
| Intervention Brain (LangGraph), drift score, breakpoints, annoyance budget, escalation, decision log | Real, tested |
| Policy engine and rule read-back | Real, tested. Deterministic code, no AI |
| Rule compiler | Real. Keyword parser handles English, Hinglish and common Hindi; other languages need the local model |
| Pausing the video at a breakpoint, companion voice, talking back | Real in the NEST player. Voice out is on-device browser TTS |
| Speech-to-text | **Stand-in.** Chrome's Web Speech API, which sends audio to Google. The product design is on-device ASR |
| Live RAG over the transcript | Real, with a small hashed-vector index rather than a neural embedding model |
| Sample videos | **Synthetic.** Caption reels written for the demo. Real YouTube videos also work if they have captions |
| Quests, proof, rewards cap | Real. Photo proof is **not verified** unless a vision-capable local model is running; the log says so |
| Mini-documentary | Real script and real photos, rendered live on the TV page. **Not exported** to a video file |
| Game Forge | Real. The agent writes a rules object; a fixed sandboxed engine runs it. It does not write free-form JavaScript |
| SmartThings | Real REST calls when a token is set (**untested against real bulbs**); otherwise simulated on the TV page |
| TV | **Stand-in.** A browser page; the same HTML would be packaged as a Tizen web app |
| Galaxy Watch | **Simulated** with a slider and a button on the TV page |
| Reading other apps (YouTube app, Instagram) | **Not built.** Needs a native Android service; see docs/03 |
| Model-written lines | Code path tested against a fake Ollama server. **Not tested with a real model on this machine** |

## Check it works

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q          # 35 tests, no model needed
.\.venv\Scripts\python.exe scripts\smoke.py             # full story against the running hub
.\.venv\Scripts\python.exe -m eval.simulate_pilot       # synthetic pilot, about 3 minutes
```

## How it is organised

```
hub/
  main.py           FastAPI app: WebSocket event bus, REST API, static pages
  brain.py          Intervention Brain (LangGraph state machine)
  drift.py          drift score
  breakpoints.py    natural-breakpoint detection over captions
  budget.py         annoyance budget, reward cap
  policy.py         rules, deterministic evaluation, plain-language read-back
  rag.py            live transcript index
  videos.py         sample reels, YouTube captions
  llm.py            local model client (Ollama)
  metrics.py        evaluation metrics from the decision log
  store.py          JSON files a parent could open
  agents/           living_video, quest, judge, parent_voice, game_forge, creator, house
  prompts/          one system prompt per agent
web/                child, tv, parent, forge pages; js/engine.js is the game engine; nest/ is the built site
site/               source of the NEST site and its demo mode
data/videos/        sample reels and cached YouTube captions
data/runtime/       rules.json, decisions.jsonl, quests.json, profile.json
eval/               synthetic pilot study
scripts/smoke.py    end-to-end rehearsal without a browser
tests/              pytest suite
docs/               pitch, architecture, plan, prompts, metrics, demo script, deck, Q&A, roadmap
```

## The order the Brain decides in

On every tick from the phone: `score_drift → check_policy → gate → check_budget → choose_channel → find_breakpoint → act → log`.

A family rule that forbids the current content acts at once and cannot be argued with. Everything else is NEST's own suggestion: it waits for a breakpoint, spends from the annoyance budget, can be argued with, and backs off after two refusals.

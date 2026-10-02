# Deliverable 3: Build, fake, or show as vision

The rule for a 48-hour build: **one loop that really works beats ten features that half work.** PORTAL's loop is *sense drift → wait for a breakpoint → interrupt → listen → act → log*. Everything built for real serves that loop. Everything else is either a labelled stand-in or a slide.

## Built for real (in this repo, tested)

| Feature | What works | Where |
|---|---|---|
| Intervention Brain | LangGraph state machine: drift score, policy check, annoyance budget, channel escalation, breakpoint wait, decision log with reasons | `hub/brain.py` |
| 1. Living Video | Transcript streams into a live index; the video pauses at a detected breakpoint; the companion speaks a dare drawn from the last 90 seconds | `hub/agents/living_video.py`, `web/js/child.js` |
| Barge-in and arguing | The child can cut the companion off mid-sentence, argue for time, and win; the grant is clamped by family rules and a daily extension cap | `hub/agents/judge.py` |
| "Why did you do that?" | Answered from the decision log, word for word | `Brain._explain` |
| 3. Real-World Quest | Quest generated from watched content, safety-filtered, with photo, voice or step proof; capped and decaying rewards | `hub/agents/quest.py`, `hub/budget.py` |
| 9. Parent Voice rules | Speech to structured rules, plain-language read-back, one clarifying question, confirmation, then deterministic enforcement | `hub/agents/parent_voice.py`, `hub/policy.py` |
| 5. Game Forge | Idea to playable game; rules shown as blocks and code; edits by voice change only the rule named | `hub/agents/game_forge.py`, `web/js/engine.js` |
| 2. House Reacts | Sunrise scene, wind-down at bedtime, restore; real SmartThings REST calls when a token is set | `hub/agents/house.py` |
| 4. Creator Studio (lite) | Documentary script plus the child's own photos, played on the TV with narration and music | `hub/agents/creator.py`, `web/js/tv.js` |
| 7. Curiosity Genome (lite) | Interest map built from minutes watched, quests done and things made | parent page |
| Age modes | Explorer and Adventurer change the tone; Pilot (13+) is never interrupted | `config.age_mode`, `Brain._check_policy` |

## Stand-ins (working, clearly labelled on screen)

| Stand-in | What it replaces | Why it is acceptable for the demo |
|---|---|---|
| Browser page on the laptop | Tizen TV app | A Tizen web app is HTML and JavaScript; the same files would be packaged |
| Lights and speaker drawn on the TV page | Physical SmartThings devices | The command list is identical; a token switches to the real API |
| Watch slider and "walk 20 steps" button | Galaxy Watch sensor stream | The Brain consumes the same `body/update` event either way |
| Chrome speech recognition | On-device streaming ASR | Fast to demo; it is the one place audio leaves the device, and the chip says so |
| Caption reels | Licensed video | No network or copyright risk on stage; real YouTube also works |
| Scripted lines when no model is running | Local LLM output | The demo cannot die because a model is slow; the chip says which is in use |
| Demo clock x60 and "+10 min" | Real elapsed time | A 45-minute story has to fit in 3 minutes; shown as a chip |

## Vision only (slides, not code)

| Feature | Why it is not built | What would make it real |
|---|---|---|
| Reading other apps (YouTube app, Instagram) | Needs a native Android service | `UsageStatsManager` for app and duration; `NotificationListenerService` plus `MediaSessionManager` for title, play state and a real pause command. No root. About two days of Kotlin |
| 6. Guardian-to-Guardian Diplomacy | Needs several households and an agent-to-agent protocol | A2A-style negotiation over free/busy windows only, with no viewing data shared |
| 8. Blink-rate eye strain | Camera on a child is a consent and accuracy problem; not worth the risk for a demo | Opt-in, on-device face landmarks; would need a clinical validation partner |
| 10. Parent Coach | Advice about a child's behaviour needs clinical review before it ships | Curated, clinician-reviewed scripts with retrieval, and referral paths |
| Family Hub recipes | No fridge API access | SmartThings Food / Family Hub inventory; the quest prompt already accepts a `fridge` list |
| Documentary as a video file | No ffmpeg on the demo laptop; live rendering looks the same on stage | ffmpeg with Piper narration, or Android's Media3 Transformer on the phone |
| Full on-device inference | A mid-range phone cannot run ASR, vision, LLM and TTS together with good latency | Gemma-class model via LiteRT on the phone NPU; hub moves to the TV or SmartThings Station |

## The 48-hour plan

| Hours | Goal | Done when |
|---|---|---|
| 0–4 | Hub, event bus, child page with sample reel, tick reporting | Parent page shows drift rising |
| 4–12 | Brain: drift, breakpoints, budget, dare, pause at breakpoint | The video talks back at a sentence boundary |
| 12–18 | Talking back: barge-in, judge, extension, "why?" | The child argues and wins two minutes |
| 18–24 | Rules: compile, read back, clarify, enforce | "No shorts ever" blocks the shorts reel |
| 24–30 | Quest, proof, rewards, documentary on TV | A photo becomes a film |
| 30–36 | House: sunrise, wind-down, SmartThings client | Lights shift when the Brain escalates |
| 36–40 | Game Forge | "A cat dodges math problems" is playable and editable |
| 40–44 | Local model, prompt tuning, real bulbs if available | Chips turn green |
| 44–48 | Rehearse the 3-minute script ten times; freeze code at hour 46 | No surprises |

This repo is at the hour-40 mark. What is left is the hardware and model work in the last two rows, which needs your devices.

## Three risks on demo day

1. **Venue Wi-Fi.** Use USB (`adb reverse`) for the phone and keep everything on localhost. Nothing in the scripted path needs the internet.
2. **Microphone in a noisy hall.** The "I'm in" button and the text box do everything the voice does. Rehearse the typed path too.
3. **Model latency.** If a line takes more than about two seconds, the pause lands late. Either warm the model before going on stage, or turn it off and run scripted: the story is the same.

# Deliverable 2: Architecture (as built)

This describes the code in this repo. Where it differs from the first design, the table at the end says how and why.

## Devices and agents

```mermaid
flowchart LR
  subgraph PHONE["Child's Galaxy phone: web/child.html"]
    SS["Screen sense<br/>video id, position, play state, interactions"]
    VO["Voice<br/>TTS out, speech in, barge-in"]
    ACT["Player control<br/>pause at breakpoint, resume"]
  end

  subgraph LIVING["Living room: web/tv.html"]
    TV["TV app<br/>portal, quest, documentary, wind-down"]
    SIM["Simulated lights, speaker, watch"]
  end

  subgraph HUB["Home hub: hub/ (laptop in demo)"]
    BUS(("Event bus<br/>WebSocket, MQTT-style topics"))
    RAG[("Live RAG index<br/>caption lines as watched")]
    subgraph BRAIN["Intervention Brain: LangGraph"]
      DRIFT["score_drift"]
      POL["check_policy<br/>deterministic"]
      BUD["check_budget"]
      CH["choose_channel"]
      BP["find_breakpoint"]
      ACTN["act"]
      HEAR["hear, judge, explain"]
    end
    LOG[("decisions.jsonl<br/>a reason for every action")]
    LV["Living Video agent"]
    QA["Quest agent and verifier"]
    JU["Argument judge"]
    HA["House agent"]
    CS["Creator Studio agent"]
    PV["Parent Voice compiler"]
    GF["Game Forge agent"]
    LLM["Local model via Ollama<br/>or scripted fallback"]
  end

  ST["SmartThings REST API<br/>when a token is set"]
  PARENT["Parent: web/parent.html<br/>rules, log, metrics, interests"]
  FORGE["Game Forge: web/forge.html<br/>sandboxed engine"]

  SS -->|screen/tick| BUS
  VO -->|voice/utterance| BUS
  SIM -->|body/update| BUS
  BUS -->|player/cmd| ACT
  BUS --> RAG
  BUS --> DRIFT
  DRIFT --> POL --> BUD --> CH --> BP --> ACTN
  BUS --> HEAR
  HEAR --> JU
  ACTN --> LV
  ACTN --> QA
  ACTN --> HA
  QA --> CS
  LV --- RAG
  QA --- RAG
  HA --> ST
  HA -->|house/state| SIM
  ACTN -->|tv/show| TV
  CS -->|tv/show| TV
  BRAIN --> LOG
  LOG --> PARENT
  PARENT --> PV
  PV -->|rules.json| POL
  FORGE --> GF
  LV --- LLM
  QA --- LLM
  JU --- LLM
  PV --- LLM
  GF --- LLM
  CS --- LLM
```

## The Brain's graph

Three kinds of event enter one LangGraph `StateGraph`. Every path ends in `log`.

| Event | Path |
|---|---|
| `tick` (every second from the phone) | `score_drift → check_policy → gate → check_budget → choose_channel → find_breakpoint → act → log` |
| `utterance` (the child speaks or types) | `hear → explain / accept / judge / rule_held / chat → log` |
| `timeout` (no reply) | `timeout → log` |

- `check_policy` can jump straight to `act` when a family rule forbids the content. That is the only immediate block.
- `gate` stops when drift is below 0.5, an agreed extension is running, or PORTAL has already backed off this sitting.
- `choose_channel` picks the house when a voice suggestion was declined and the sitting has passed 45 minutes; the house channel does not wait for a breakpoint because it does not pause the video.
- The model is called only inside `act`, `accept` and `judge`, and only for words.

**Drift score** (0 to 1): `0.35·session + 0.25·short_form + 0.20·passivity + 0.20·stillness`, each term 0 to 1. With no watch paired, stillness is dropped and the other weights are re-normalised. The weights are starting values to tune in a pilot.

## Sequence: Living Video

```mermaid
sequenceDiagram
  autonumber
  participant K as Child
  participant P as Phone page
  participant B as Event bus
  participant I as Brain
  participant R as Live RAG
  participant L as Living Video agent

  loop every second
    P->>B: screen/tick with video position
    B->>I: on_tick
    I->>R: index caption lines reached so far
  end
  I->>I: drift 0.51 passes threshold 0.5
  I->>I: policy allows, budget has interruptions left
  I->>I: next breakpoint is 6 s ahead
  I->>R: last 90 s watched
  R-->>I: piston door wiring
  I->>L: write the dare
  L-->>I: line and challenge
  I->>B: player/cmd interrupt at breakpoint time
  B->>P: schedule
  P->>P: position reaches breakpoint, pause
  P->>B: player/interrupted with delay in ms
  P->>K: speaks the dare
  K->>P: talks over it
  P->>P: speech stops at once
  P->>B: voice/utterance with barge_in true
  B->>I: hear
  alt accepts
    I->>B: quest/update active, tv/show quest
  else argues with a reason
    I->>I: judge, then guard clamps minutes
    I->>B: player/cmd resume with reply
  else says no twice or stays silent
    I->>B: player/cmd resume
    I->>I: budget gap grows
  end
  I->>B: log/decision with reason
```

## Sequence: The House Reacts

```mermaid
sequenceDiagram
  autonumber
  participant K as Child
  participant P as Phone page
  participant I as Brain
  participant Q as Quest agent
  participant H as House agent
  participant S as SmartThings or simulator
  participant T as TV page
  participant C as Creator Studio agent

  P->>I: ticks, sitting passes 45 min, voice was declined
  I->>I: choose_channel picks house
  I->>Q: make a quest from what was watched
  Q-->>I: quest
  I->>H: sunrise
  H->>S: lights to 2200 K, level ramp to 85, birdsong
  I->>T: tv/show portal with the quest
  I->>P: quest/update offered, video keeps playing
  alt child gets up
    T->>I: body/update steps from the watch
    I->>T: tv/show quest steps
    K->>P: accepts
    I->>P: pause video, quest active
    K->>P: photo proof
    P->>I: proof
    I->>Q: verify
    I->>H: restore lights
    I->>C: write the film script
    C-->>I: script
    I->>T: tv/show documentary with script and photos
  else no response before the timeout
    I->>H: restore lights
    I->>T: tv/show idle
    I->>I: back off for this sitting, note for the parent
  end
  opt a whole-screen curfew rule is active
    I->>H: winddown, lights to 2000 K at 10 percent
    I->>T: tv/show winddown
  end
```

## Built versus first design

| Layer | First design | Built | Why |
|---|---|---|---|
| Event bus | MQTT broker | WebSocket fan-out inside the hub, with MQTT-style topics and retained messages | One process to start on Windows; swapping in Mosquitto later changes `bus.py` only |
| Vector store | Chroma with a sentence-embedding model | Hashed bag-of-words vectors in NumPy | The window is a few hundred lines; a heavy dependency bought nothing |
| Speech in | faster-whisper with Silero VAD | Chrome Web Speech API | Minutes to integrate. It is a cloud service, and the page says so |
| Speech out | Piper | Browser `speechSynthesis` | Already on-device and needs no model download |
| LLM | Gemma via Ollama | Same, with a scripted fallback for every agent | The demo must survive a missing or slow model |
| Game Forge | Model writes an HTML/JS game | Model writes a validated rules object; fixed engine runs it | No model-written code runs on a child's device, and the rules map directly to blocks |
| Documentary | ffmpeg render to a file | Rendered live on the TV page | No ffmpeg on the demo laptop |
| Phone sensing | UsageStats, MediaSession, Accessibility | The PORTAL player page only | Native Android service not built |

## Latency

See `06-evaluation.md`. Measured: Brain tick 5 ms median, pause 37 ms after the breakpoint in one headless run. Not measured: model-written lines and barge-in with a real microphone.

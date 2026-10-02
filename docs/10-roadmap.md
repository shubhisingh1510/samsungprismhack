# Deliverable 10: Roadmap

From hackathon prototype, to a Samsung product feature, to a global launch. Dates are relative to the hackathon. The durations are planning estimates, not commitments from anyone at Samsung.

## Where we are

A working prototype: the Intervention Brain, living video with barge-in, quests, voice rules, Game Forge and house scenes, with the hub on a laptop and stand-ins for the TV, lights and watch.

## Phase 1: Make it real on Samsung hardware (months 0–3)

**Goal:** the same demo with no stand-ins.

| Work | Detail |
|---|---|
| Native Android service | `UsageStatsManager` for app and duration; `NotificationListenerService` with `MediaSessionManager` for title, play state and pause in any media app |
| On-device speech | Streaming recognition with voice-activity detection and echo cancellation, so barge-in works over the companion's own voice |
| Local model | Install and tune a Gemma-class model on the hub; measure line-generation latency; tune the prompts on real output |
| Real SmartThings | Run the existing REST client against real bulbs and a speaker; read the prior state before a scene so restore is exact |
| Tizen TV app | Package the TV page as a Tizen web app |
| Galaxy Watch | Health Sensor SDK on the watch, Wearable Data Layer to the phone, feeding the existing `body/update` event |

**Exit test:** the 3-minute demo runs with every status chip green.

## Phase 2: Pilot (months 3–9)

**Goal:** find out whether it helps, and whether children can stand it.

- 20–30 families with a child aged 8–12, recruited through two schools. Design as in `06-evaluation.md`: two weeks baseline, four weeks NEST, two weeks off.
- A child psychologist on the team, and institutional ethics review, before any child is enrolled.
- Legal review of the DPDP position: consent flow, on-device processing, what counts as behavioural monitoring.
- Hindi, Tamil, Bengali, Marathi and Telugu for parent rules and the companion's voice.
- Quest content reviewed for safety and for homes without craft supplies.
- Parent Coach built only once there is clinician-reviewed guidance to retrieve from.

**Go / no-go at month 9**

| Signal | Continue if |
|---|---|
| Active share of screen-session time | 10% or more |
| Children rating the companion "annoying" | under 20% |
| Mistimed interruptions | under 10% |
| Total device time | not higher than baseline |
| Parents who would keep it | more than half |

If these miss, the right move is to change the design, not the thresholds.

## Phase 3: Samsung product feature (months 9–18)

**Goal:** ship inside products families already have, not as another app to install.

| Home for NEST | What it becomes |
|---|---|
| **Samsung Kids** | "Portal mode": the companion, quests and Game Forge for ages 4–12 |
| **Digital Wellbeing / parental controls** | Voice rules and the decision log, next to the existing timers |
| **SmartThings** | "The house reacts" as routines a parent can see and edit |
| **Galaxy Watch for kids** | Movement quests and step proof |
| **Samsung TV** | The portal and Creator Studio as a TV app |

Engineering for this phase:

- Move reasoning onto Samsung's on-device AI stack on the phone and TV, so no laptop hub is needed.
- Solve transcripts for third-party video at the system level (live captions), which only a first-party feature can do.
- Creator Studio renders a real video file on the phone, shareable only inside the family group.
- Security review, accessibility review, and a red-team exercise on the companion's prompts.
- Launch in India first: the problem data, the languages and the pilot are all here.

## Phase 4: Global (months 18–36)

- **Markets:** start where Samsung has the phone, TV and appliances in the same home. Order to be decided from device-footprint data we do not have.
- **Regulation per market:** COPPA in the US, the GDPR and the UK children's code in Europe, each with its own consent and data rules. The on-device design is the common answer; the consent flow is rebuilt per market.
- **Culture:** quests, materials and companion characters are localised with local educators. A cardboard quest written for Bengaluru does not automatically fit Seoul.
- **Guardian-to-Guardian Diplomacy:** agent-to-agent playdate planning once there is density of households, sharing free/busy only.
- **Teens:** the Pilot mirror for 13–17 as its own product, designed with teenagers.
- **Open questions for partners:** schools (quests tied to what is being taught) and creators (videos that ship with their own real-world challenge).

## What could stop this

| Risk | Mitigation |
|---|---|
| The pilot shows no benefit, or children hate it | Phase 2 has explicit no-go criteria. Stop or redesign |
| DPDP or another law rules out behavioural sensing even on-device | Fall back to parent-initiated quests and voice rules, which need no monitoring |
| On-device models stay too slow on mid-range phones | Keep the hub on the TV or a SmartThings hub |
| Platforms restrict the Android APIs needed | First-party integration removes the dependency; this is the case for building it inside Samsung |
| It turns into a reward-chasing game | Caps and decay are in the core, and total device time is a launch guardrail |

## The next 30 days

1. Install a local model and tune the five most-used prompts on real output.
2. Buy two SmartThings-compatible bulbs and run the house scenes for real.
3. Write the Android service (two days of Kotlin) so drift works over any app.
4. Recruit one child psychologist as an adviser.
5. Run NEST with three families you know for a week and read every line of the decision logs.

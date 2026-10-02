# Deliverable 5: System prompts for every agent

The prompts are files in `hub/prompts/`, loaded by the code at run time, so what you read there is exactly what the model receives. This page explains how they fit together.

## The design rule behind all of them

**The model writes words; code decides what happens.** No prompt asks a model whether to interrupt, whether a rule applies, or whether a child may have more time beyond a limit. Those are decided by `brain.py` and `policy.py`. This is why three of NEST's agents have no prompt at all.

Every prompt follows the same shape:

1. **The situation**: who the child or parent is, what just happened, and what the output is used for. A model that knows the dare will be spoken aloud to a nine-year-old writes differently from one told "write a short line".
2. **What good looks like, with the reason.** For example, the dare prompt explains that sounding like a parent makes the child tune out, instead of just saying "be playful".
3. **Hard limits** for safety, stated as plain rules.
4. **A JSON reply format**, which the code validates. Invalid or unsafe output is discarded and the scripted fallback is used.

## Agents with prompts (built)

| Agent | File | Input | Output | Code-side guard |
|---|---|---|---|---|
| Living Video | `living_video.md` | last 90 s of transcript, child, mode | `line`, `challenge` | unsafe-word filter, 40-word clip |
| Quest | `quest.md` | watched excerpts, the dare, fridge list | title, mission, 3 steps, materials, minutes, proof type | exactly 3 steps, 5–15 minutes, unsafe-word filter |
| Quest Verifier | `quest_verify.md` | quest plus photo or spoken proof | `ok`, `confidence`, `note` | photo needs a vision model, else logged as not verified |
| Argument Judge | `judge.md` | what the child said, round, `max_minutes` | verdict, minutes, reply, reason | `guard()` clamps minutes to family rules and the daily cap; if the clamp changes the verdict the model's reply is discarded |
| Parent Voice | `parent_voice.md` | the parent's sentence | list of structured rules, optional question | pydantic validation, then deterministic missing-detail checks |
| Game Forge | `game_forge.md` | the child's idea (and validation errors on retry) | rules object | pydantic schema; up to 3 repair attempts |
| Game Forge edit | `game_edit.md` | current rules, instruction | full updated rules, `changed` sentence | same schema; invalid edit leaves the game untouched |
| Creator Studio | `creator.md` | quest, proof note, scene count | title, scenes, closing | scene count and word clips |

## Agents with no prompt, on purpose

| Agent | Why it is plain code |
|---|---|
| Intervention Brain | When and how often to interrupt a child must be predictable, testable and explainable. It is a state machine with numeric thresholds. |
| Policy engine | A parent's rule must mean the same thing every time. The read-back the parent confirms is generated from the rule itself, not by a model. |
| House agent | Scenes are fixed command lists. A model should never improvise with a family's lights at bedtime. |

## Agents with prompts (vision, not wired in)

These are in `hub/prompts/vision/`. They are written to the same standard so they can be dropped in, but no code calls them yet.

| Agent | File | Note |
|---|---|---|
| Parent Coach | `vision/parent_coach.md` | Requires a clinician-reviewed playbook to retrieve from. Must not ship without one. |
| Guardian-to-Guardian Diplomacy | `vision/diplomacy.md` | The message schema is the privacy boundary: free/busy and yes/no only. |
| Curiosity Genome narrator | `vision/genome.md` | The map is built by code; the model only writes the weekly note. |

## Three excerpts worth showing judges

**The judge is told why arguing matters** (`judge.md`):

> Children comply with limits they had a voice in, and resist limits imposed on them. A child who makes a specific, bounded case ("two more minutes, the build is almost done") and wins has just practised self-regulation. A child who is refused no matter what learns to stop talking and start hiding.

**The rule compiler is told not to guess** (`parent_voice.md`):

> If you guess wrong, a child gets blocked or allowed wrongly and the parent stops trusting the system. When the parent's words do not settle a detail, do not guess: fill `ask` so the system can ask them once.

**The documentary celebrates making, not abstaining** (`creator.md`):

> Avoid any mention of screens, screen time or being better than watching videos. The film celebrates what was made, not what was avoided.

## Status

The code paths that call these prompts are tested against a fake Ollama server (valid output, invalid output, unsafe output, over-generous output). The prompts have **not** been run against a real model on this machine, because none is installed. Expect to tune wording after the first real runs, especially `living_video.md` on a small model.

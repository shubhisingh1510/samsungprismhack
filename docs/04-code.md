# Deliverable 4: Folder structure and working code

The code is the rest of this repository. Start with the top-level `README.md` for how to run it and what is real versus simulated.

## The four MVP features and where they live

| Feature | Hub code | Page code | Prompt | Tests |
|---|---|---|---|---|
| Living Video interrupt | `hub/brain.py` (`_act_dare`, `_judge`, `_explain`), `hub/breakpoints.py`, `hub/drift.py`, `hub/rag.py`, `hub/agents/living_video.py`, `hub/agents/judge.py` | `web/js/child.js` | `living_video.md`, `judge.md` | `test_dare_waits_for_breakpoint…`, `test_ignored_dare…`, `test_why_is_answered…`, `test_breakpoints_land_between_sentences` |
| Real-World Quest | `hub/agents/quest.py`, `hub/agents/creator.py`, `hub/brain.py` (`submit_proof`), `hub/budget.py` (`Rewards`) | `web/js/child.js`, `web/js/tv.js` | `quest.md`, `quest_verify.md`, `creator.md` | `test_scripted_quest…`, `test_unsafe_model_quest_is_rejected`, `test_photo_without_vision_model…`, `test_rewards_are_capped_and_decay` |
| Parent Voice rules | `hub/agents/parent_voice.py`, `hub/policy.py` | `web/js/parent.js` | `parent_voice.md` | thirteen policy and compiler tests, plus `test_parent_rule_enforced_immediately_and_not_negotiable` |
| Game Forge | `hub/agents/game_forge.py` | `web/js/forge.js`, `web/js/engine.js` | `game_forge.md`, `game_edit.md` | `test_scripted_game…`, `test_forge_repairs_invalid_model_output`, `test_scripted_edits_change_only_what_was_asked` |

Supporting the four: `hub/agents/house.py` (The House Reacts), `hub/metrics.py`, `hub/store.py`, `hub/bus.py`, `hub/llm.py`, `hub/videos.py`.

## What has been verified, and how

| Check | Result |
|---|---|
| `pytest tests` | 35 passed. Covers policy, rule compiler (English, Hinglish, Devanagari), drift, breakpoints, budget, rewards, judge, quests, Game Forge, and seven Brain scenarios |
| `scripts/smoke.py` against the running hub | All steps passed: rule → block → dare at a breakpoint → argument granted → house → quest → photo → documentary → log → Game Forge |
| Real pages in headless Edge | The same story clicked through `parent.html`, `child.html`, `tv.html` and `forge.html`, with no page errors. The game engine started, took keyboard input and ended a round |
| `eval/simulate_pilot` | 29,239 Brain ticks across a synthetic 24-child, 14-day cohort without error |

## What has not been verified

- Any output from a real language model. The model code paths are tested with a fake Ollama server only.
- Sound: companion voice, birdsong, narration and music were not audible in headless runs.
- The microphone and barge-in by voice. The typed and button paths were exercised.
- The page on an actual Galaxy phone.
- SmartThings calls against real devices.
- YouTube playback inside the page. Fetching captions for a real YouTube video through the hub was tested once and worked (61 caption lines, 3 breakpoints found); playing and pausing that video in the page was not exercised.

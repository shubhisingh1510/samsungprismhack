# Deliverable 6: Evaluation metrics and mock pilot study

## Metrics

All of these are computed by `hub/metrics.py` from the decision log, so the live parent dashboard and the simulation report the same definitions.

| Metric | Definition | Why it matters | Target for a real pilot |
|---|---|---|---|
| **Active share** | active minutes ÷ (passive + active minutes). Active = time inside a quest or the Game Forge | The headline: did passive time turn into doing? | 10% or more of screen-session time |
| **Passive-to-active ratio** | passive minutes ÷ active minutes | Same thing, in the form the challenge brief uses | Below 10 : 1 |
| **Intervention acceptance** | interruptions that ended in an accepted quest ÷ interruptions resolved | Are the dares appealing? | 25% or more |
| **Engagement rate** | (accepted + negotiated an extension) ÷ resolved | A child who argues is engaging with a limit, which is a good outcome too | 50% or more |
| **Ignored rate** | no reply before the timeout ÷ resolved | Rising values mean PORTAL is becoming background noise | Below 30% and not rising |
| **False-interrupt rate** | (child pressed "Bad timing" + pauses landing more than 1.5 s after the breakpoint) ÷ interruptions | Are the breakpoints really natural? | Below 10% |
| **Quest completion** | quests completed ÷ quests started | Are the quests doable? | 70% or more |
| **Held back** | times drift was high but the budget said no | Evidence that the restraint works | Reported, not optimised |
| **House gave up** | house scenes with no response | Evidence that PORTAL stops rather than escalates forever | Reported |
| **Latency** | line generation, pause delay after breakpoint, barge-in (speech detected to voice silenced), Brain tick | The "interruptible real-time" claim | See below |

### Guardrail metrics

A system like this can win its headline metric in harmful ways, so these are tracked alongside:

- **Interruptions per child per day**: hard cap of 3 per hour; watch the daily total.
- **Rewards earned**: capped at 20 sparks a day by construction.
- **Total device time** (passive + active): PORTAL should not increase it.
- **Child sentiment**: weekly one-question check ("Is Pixel annoying, okay, or fun?").
- **Parent override count**: how often parents remove or loosen a rule after seeing it enforced.

## Latency

| Path | Target | Measured here | How |
|---|---|---|---|
| Brain decision per tick (no model) | under 50 ms | **5.1 ms median, 8.5 ms p95** | 29,239 ticks in the simulation |
| Pause lands after the breakpoint | under 300 ms | **37 ms** | One run in headless Edge; the phone polls at 100 ms, so expect 0–100 ms |
| Scripted line ready | under 100 ms | **10 ms** | Same run |
| Model-written line ready | under 1.5 s | **Not measured** | No local model on this machine. It is generated ahead of the breakpoint, so up to about 40 s of slack exists |
| Barge-in: child speaks to voice silenced | under 300 ms | **Not measured** | Needs a real microphone. The page records it per interruption and the dashboard shows the median |

## Mock pilot study

> **This is a simulation, not evidence.** The children are synthetic and their response rates are assumptions I chose. The study shows that the pipeline produces these metrics and how PORTAL's own mechanisms behave over two weeks. It does not show that PORTAL changes real children's behaviour.

**Setup.** 24 synthetic children, 14 days, two sittings a day, seed 7. Every PORTAL decision is made by the real Brain code (drift, breakpoints, budget, escalation, judge, quests, rewards) in scripted mode. Reproduce with `python -m eval.simulate_pilot`; full per-child results land in `eval/results/pilot.json`.

**Assumptions (inputs).** Each child draws one value from each range and keeps it:

| Assumption | Range |
|---|---|
| Planned passive screen time per day | 60–200 min |
| Share of sittings on short-form feeds | 10–70% |
| Probability of accepting a voice dare | 15–50% |
| Probability of arguing (half with a specific reason) | 25–45% |
| Probability of accepting when the house reacts | 30–65% |
| Probability of flagging bad timing | 3–12% |
| Probability of finishing an accepted quest | 60–90% |
| An accepted quest ends that sitting | always |

**Results (outputs).**

| Metric | Baseline (no PORTAL) | With PORTAL |
|---|---|---|
| Passive minutes per child per day | 124.5 | 87.0 |
| Active minutes per child per day | 0 | 10.8 |
| Interruptions per child per day | – | 3.07 (865 voice, 166 house) |
| Acceptance rate | – | 34.9% |
| Engagement rate | – | 47.5% |
| Ignored rate | – | 35.9% |
| False-interrupt rate | – | 4.9% |
| Quest completion | – | 74.6% |
| Quests completed per child per week | – | 5.6 |
| Times held back per child per day | – | 1.34 |
| House scenes that got no response | – | 70 in total, each followed by PORTAL standing down |
| Mean gap between interruptions, day 1 → day 14 | – | 21.1 → 25.5 min |

**What the simulation does tell us.**

1. **The 30% drop in passive time is mostly an artefact of one assumption**: that an accepted quest ends the sitting. Acceptance (35%), completion (75%) and false interrupts (5%) simply echo the input ranges. Do not present these as findings.
2. **The annoyance budget behaves as designed.** Under these assumptions children decline more often than they accept, so the learned gap grows from the 10-minute default to about 21 minutes within the first day and 25 by day 14. PORTAL gets quieter with a child who says no. This is a property of the code, and it is real.
3. **Restraint is frequent.** The Brain held back 1.34 times per child per day when drift was high but the budget was spent.
4. **Escalation terminates.** All 70 unanswered house scenes ended with lights restored and no further suggestions in that sitting.
5. **The ignored rate (36%) is above the 30% target.** If a real pilot looked like this, the first fix would be dare quality, not frequency.

## What a real pilot would look like

| | |
|---|---|
| Design | Within-family crossover: 2 weeks baseline logging only, 4 weeks PORTAL, 2 weeks off to see what persists |
| Size | 20–30 families with a child aged 8–12, recruited through two schools |
| Primary outcome | Active share of screen-session time |
| Secondary | Parent-reported conflict at "screen off" moments (weekly 5-point scale), child sentiment, sleep onset on school nights |
| Harm checks | Total device time must not rise; any child reporting PORTAL as "annoying" three weeks running triggers a review |
| Consent | Verifiable parental consent and child assent; all data stays on the family's devices; families export their own summary for the study |
| Oversight | Institutional ethics review and a child psychologist on the study team before any child is enrolled |

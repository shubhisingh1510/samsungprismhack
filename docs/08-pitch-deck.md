# Deliverable 8: 12-slide pitch deck

Slide text is kept short enough to read from the back of a room. Speaker notes carry the detail. Sources for every statistic are in `01-pitch-and-stats.md`.

---

## Slide 1: Title

**PORTAL**
Everyone else blocks the screen. We turn it into a door.

*Samsung PRISM · Agentic AI · Interruptible Real-time Agents*

> **Notes:** Say the tagline, then nothing else. Go straight to slide 2.

---

## Slide 2: The problem

**61%** of surveyed urban Indian parents say their 9–17-year-old spends 3+ hours a day on social media, video and games.

**37.8%** of 10-year-olds already have a Facebook account, against the rules.

**Blocking has been tried. It lost.**

> **Notes:** LocalCircles for the first number, NCPCR for the second. The second is the important one: age rules exist and a third of ten-year-olds are past them. Say "surveyed parents", not "children".

---

## Slide 3: Why blocking fails

| What the tool does | What the child learns |
|---|---|
| Timer runs out, app locks | The tool is the enemy |
| Parent enters a PIN to extend | Nagging works |
| Content filter | Use a friend's phone |

The problem was never the screen. It is **passive, unstructured** time on it.

> **Notes:** No parent-blaming. The tools gave parents one lever, and it is "off".

---

## Slide 4: The idea

**Don't block the child. Recruit them.**

PORTAL waits for a natural pause in the video, then the video itself dares the child to try what they just watched, in the real world.

Passive minute → dare → quest → their own film.

> **Notes:** This is the moment to gesture at the demo table. One sentence, then the demo.

---

## Slide 5: Live demo

1. The video talks back
2. The house reacts
3. The child's own documentary plays

> **Notes:** Three minutes. Follow `07-demo-script.md` exactly. Leave this slide up on the second screen only if the TV page is on the projector.

---

## Slide 6: The Intervention Brain

**When** to interrupt: only at a natural breakpoint in the captions.
**How:** voice first, then the house, then stop.
**How often:** an annoyance budget, learned per child. Three an hour at most, fewer if they keep saying no.

Every decision is logged with a reason a parent can read and a child can ask for.

> **Notes:** This is the agentic core and the answer to "isn't this just a chatbot with a timer?". It is a LangGraph state machine. The model writes the words; plain code decides whether and when to act.

---

## Slide 7: Interruptible, both ways

PORTAL interrupts the video. **The child can interrupt PORTAL.**

"Ten more minutes, it's almost done." → "Fair enough. Ten more minutes, then I'm back."

Good arguments win. Parent rules can't be argued with. PORTAL's own suggestions always can.

> **Notes:** Barge-in stops the voice mid-sentence. The judge's verdict is clamped by code to what family rules and today's extension count allow, so the model can never be talked into more than the parents would give.

---

## Slide 8: Competitive teardown

| | Family Link | Apple Screen Time | Bark | Qustodio | **PORTAL** |
|---|---|---|---|---|---|
| Core action | Limit and lock | Limit and lock | Monitor and alert | Filter and limit | **Redirect into activity** |
| When it acts | Timer expiry | Timer expiry | After risky content | Timer or filter hit | **At a natural pause** |
| Child's voice | Ask a parent | Ask a parent | None | Ask a parent | **Argues with the agent, can win** |
| Uses the home | No | No | No | No | **Lights, TV, speaker, watch** |
| What the parent sees | Minutes per app | Minutes per app | Alerts | Reports | **Interests, and a reason for every action** |
| Outcome measured | Minutes reduced | Minutes reduced | Risks flagged | Minutes reduced | **Passive minutes turned active** |

**They restrict. PORTAL transforms.**

> **Notes:** Be fair. These are good products at what they do, and PORTAL keeps the one thing they do well: a hard parent rule is enforced. The difference is what happens the rest of the time. Only Samsung has the phone, the TV, the lights and the watch in one ecosystem; that is why this is a Samsung product and not an app.

---

## Slide 9: Built for trust

- **Nothing raw leaves the home.** Screen, voice and camera are processed on the family's own devices.
- **Rules are enforced by plain code.** The AI compiles a rule once; the parent confirms the read-back.
- **PORTAL limits itself.** Interruptions are budgeted. Rewards are capped and fade. No streaks.
- **It gives up gracefully.** Two refusals and it backs off.
- **Teens are never interrupted.** 13+ get a mirror they own.

> **Notes:** If asked about DPDP: verifiable parental consent is built into onboarding, and the design keeps behavioural data on-device precisely because the Act restricts behavioural monitoring of children by data fiduciaries. Say plainly that this needs legal review before launch. In the demo, speech recognition used the browser's cloud service; the product design is on-device.

---

## Slide 10: What we built

**Real, tested:** the Brain, living video with barge-in, quests with proof, voice rules in English and Hinglish, Game Forge, house scenes, decision log. 35 automated tests and an end-to-end rehearsal script.

**Stand-ins, labelled on screen:** TV in a browser, simulated lights and watch, browser speech recognition, sample videos.

**Vision:** reading other apps, agent-to-agent playdates, parent coach.

> **Notes:** Judges reward honesty about scope. Show the status chips. Offer to open the code.

---

## Slide 11: How we will know it works

Headline metric: **share of screen-session time that became active.**

Guardrails: interruptions per day, mistimed interruptions, total device time must not rise.

A simulated two-week cohort shows the pipeline and the self-limiting behaviour work. **It is not evidence about real children.** Next step: a 20-family pilot with a child psychologist and ethics review.

> **Notes:** Do not quote the simulated 30% reduction as a result. If asked, explain it comes from an assumption and say what the real pilot measures.

---

## Slide 12: Roadmap and ask

**Now:** working prototype.
**6 months:** native Android service, on-device model, real SmartThings and Tizen, 20-family pilot.
**12–18 months:** a mode inside Samsung Kids and SmartThings.
**After that:** global, starting where Samsung homes are densest.

**The ask:** device access, a SmartThings and Samsung Kids mentor, and help running the pilot.

*Everyone else blocks the screen. PORTAL turns it into a door.*

> **Notes:** End on the tagline, exactly as on slide 1.

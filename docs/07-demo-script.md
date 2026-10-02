# Deliverable 7: The 3-minute live demo

Three wow moments in order: **the video talks back → the lights change → the child's own film plays.** This click-path was rehearsed against the running app in a headless browser; the timings below are from that run (76 seconds of system time, which leaves about 100 seconds for talking).

## Cast and screens

| Who | Device | Page |
|---|---|---|
| Presenter A, "the parent" and narrator | Laptop, window 1 | `/parent.html` |
| The room | Laptop on the projector, window 2, full screen | `/tv.html` |
| Presenter B, "the child" | Galaxy phone, mirrored if possible | `/child.html` |

**Prop:** a cardboard door with a tape hinge, built beforehand and hidden under the table. Nobody can build one in 15 seconds on stage; say so with a smile.

## Before you walk on (2 minutes)

1. Start the hub. Run `adb reverse tcp:8000 tcp:8000` and open `localhost:8000/child.html` on the phone.
2. Parent page: **Reset everything**, set **Clock speed x60**.
3. TV page: **Turn on the TV** (this enables sound). Laptop volume up.
4. Phone: **Tap to start**. Allow the microphone. Leave "Open mic" off in a noisy hall.
5. Check the chips: they should say what you expect about the AI model and SmartThings.
6. Type the rule into the parent box but do not press the button yet: `Cartoon is fine after homework, but no shorts reels ever.`

## The script

| Time | What happens | Who does what | Words |
|---|---|---|---|
| 0:00 | Hook | A, to the judges | "Every parental-control app says **no**. Every child finds a way around it. We built something that never says no. Watch." |
| 0:12 | **Rule by voice.** Two rules appear with plain-language read-backs | A presses **Understand this**, then **Yes, enforce this** twice | "I say a rule the way I'd say it at home. It reads back what it understood. Only then is it enforced, by plain code, not by an AI." |
| 0:25 | Shorts blocked | B taps **Satisfying Slime Shorts**. The companion explains the family rule | B, to the phone: "Five more minutes?" (type or say). It refuses. A: "Parent rules can't be argued with. That's the only thing in PORTAL that blocks." |
| 0:40 | Start the real story | B taps **Secret Piston Door**. A clicks **+10 min watched** twice | A: "Now an allowed video. Fast-forward: he's been watching for half an hour, not moving, not touching the screen. Watch the drift bar." (point at the parent page) |
| 0:45–1:10 | Drift climbs; about 27 seconds of video | A narrates | "PORTAL isn't going to cut him off mid-sentence. It's reading the captions as they stream and waiting for a natural pause. And it has a budget: three interruptions an hour, fewer if he keeps saying no." |
| **1:10** | **WOW 1: the video talks back.** It pauses between two sentences and the companion says: "That piston trick? Bet you can't build a real one out of cardboard in ten minutes." | B looks surprised | Let it land. Say nothing for two seconds. |
| 1:18 | Barge-in and argue | B taps **Talk** mid-sentence (or types): "Ten more minutes, it's almost done." | The companion: "Fair enough. 10 more minutes, then I'm back." A: "He interrupted it, argued, and won, because he gave a real reason. Kids keep deals they helped make." |
| 1:30 | Skip ahead | A clicks **+10 min watched** twice | "Ten minutes later he's still there. Forty-five minutes in. Now PORTAL stops talking, and asks the house." |
| **1:36** | **WOW 2: the house reacts.** The room turns sunrise orange over six seconds, birdsong starts, a portal opens on the TV with a quest. The video on the phone keeps playing | Everyone looks at the projector | A: "Nothing was blocked. The video is still playing. The room just became more interesting than the phone." |
| 1:50 | He walks over | A clicks **Walk 20 steps** on the TV page. The TV shows the quest steps. B taps **Accept the quest** | "His watch felt him get up." |
| 2:00 | The quest | B produces the cardboard door | B: "Ten minutes later…" (laughter). B taps **Take a photo** and photographs the door, twice if there is time |
| **2:10** | **WOW 3: the documentary.** Lights return to normal. The TV plays a film titled with the child's name, using his photos, with narration and music (about 30 seconds) | Nobody talks for the first 10 seconds | Then A, over the film: "An hour ago he was watching someone else's video. Now he's watching his own." |
| 2:40 | The receipts | A switches to the parent page and scrolls the decision log | "Every decision, with its reason. When it interrupted, when it held back, when it gave up. He can ask 'why did you do that?' and get the same answer." |
| 2:52 | Close | A | "Everyone else blocks the screen. PORTAL turns it into a door." |

## If something goes wrong

| Problem | Do this |
|---|---|
| The microphone hears nothing | Type the line, or tap **I'm in**. Do not apologise; keep talking |
| The dare has not come by 1:20 | Click **+10 min watched** once more |
| The portal does not open after the skip | Click **+10 min watched** again; the Brain needs the sitting past 45 minutes and the extension over |
| The phone lost the hub | Run the child page in a narrow laptop window instead; it is the same page |
| A model-written line is odd or slow | Before the demo, decide: model on or off. Off is deterministic and is what was rehearsed |
| Total collapse | `python scripts\smoke.py` prints the whole story in a terminal in about 10 seconds, with every step checked |

## What to say when asked "what was real?"

Point at the chips on screen and read them out. Then: "The decisions were all real: when to interrupt, the breakpoint, the budget, the argument, the escalation, the rule enforcement, the log. The lights and the watch were simulated on this laptop, the speech recognition used the browser's cloud service, and the clock ran sixty times fast. On a home network with a SmartThings token the same code drives real bulbs."

If a model was running, add that the lines were written by a local model; if not, say the lines were scripted.

## Rehearsal notes

- Do the full run **ten times**. The risky seconds are 1:18 to 1:36: after the companion grants 10 minutes you have about 10 real seconds at x60 to click **+10 min watched**. If you miss the window, PORTAL will come back by voice first, which is correct behaviour but not the script. Clicking twice makes this safe.
- Sound on a headless rehearsal is not tested. Check birdsong, narration and music on the real laptop speakers before the day.
- Keep the cardboard door out of sight until 2:00.

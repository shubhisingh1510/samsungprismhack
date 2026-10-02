# Deliverable 9: The 15 hardest questions, with answers

Each answer is written to be said in under 30 seconds. Where the honest answer includes a weakness, it is stated first. Judges trust teams that name their own gaps.

## Product and psychology

**1. Isn't this just manipulation with a friendly face? You're nudging children.**

It is persuasion, and we constrain it the way you'd want. PORTAL may only suggest at a natural pause, at most three times an hour, and it must back off after two refusals. The child can always ask why and gets the logged reason. Rewards are capped and fade, with no streaks. The thing being competed against is an infinite feed optimised to hold attention with no such limits.

**2. Won't PORTAL become the new addiction?**

That is the risk we designed against first. Sparks are capped at 20 a day, each quest in a day is worth less than the last, and unspent sparks decay. The annoyance budget shrinks PORTAL's presence for a child who declines. We also track total device time as a guardrail: if it rises, PORTAL is failing.

**3. Kids will just say "no" every time. Then what?**

Then PORTAL gets quieter, by design. In our simulated cohort the gap between interruptions grew from 10 minutes to about 25 for children who mostly declined. After two refusals it backs off; after an unanswered house scene it stops for that sitting and leaves a note for the parent. We'd rather be ignored than hated. A parent who wants a hard limit sets a rule, and rules are not negotiable.

**4. A clever child will argue their way to unlimited time.**

They can't. The judge's verdict passes through a guard in plain code: at most two extensions a day, at most ten minutes each, never beyond a parent's daily limit. We tested a model that tried to grant 45 minutes; the guard cut it to 10 and replaced the reply. Parent rules can't be argued with at all.

**5. Where is the evidence this helps children?**

We don't have it yet, and we won't pretend otherwise. What we have is a design built on two ideas from the parenting and motivation literature: limits a child has a say in hold better than imposed ones, and transitions go better at natural stopping points. We still need to cite specific studies for both. Our pilot numbers are from a simulation and say nothing about real children. The next step is a 20-family crossover pilot with a child psychologist and ethics review.

## Privacy and law

**6. India's DPDP Act restricts behavioural monitoring of children. Isn't that exactly what you do?**

This is our biggest legal question and it needs counsel before launch. Our design position: the Act targets data fiduciaries tracking children. PORTAL keeps behavioural data on the family's own devices, under verifiable parental consent, and Samsung's servers never receive it. Whether that fully satisfies the Act and its rules is a legal determination we have not obtained.

**7. You said "nothing leaves the home", but your demo used cloud speech recognition.**

Correct, and the screen says so. The demo uses the browser's speech service because it took minutes to integrate. The product design is on-device streaming recognition. Voice output in the demo is on-device. SmartThings commands do go to Samsung's cloud, but they contain "set light to 2200 K", not anything about the child.

**8. A camera watching a child's eyes?**

We didn't build it and we'd be cautious about shipping it. It is on the vision list as opt-in and on-device only, and it would need clinical validation. The watch's stillness signal gives most of the value with far less risk.

## Technology

**9. What is actually agentic here? This sounds like a timer plus a chatbot.**

The Intervention Brain is a LangGraph state machine that perceives (screen, body, time), decides (drift, policy, budget, channel, breakpoint), acts across devices (phone, lights, TV), listens to the response, and adapts its own future behaviour. Specialist agents write dares, quests, verdicts, rules and game rules. A timer does none of perceive-decide-act-adapt.

**10. Can a mid-range phone really run this?**

Not all of it today, which is why the demo runs the hub on a laptop. A mid-range Galaxy can't run speech recognition, a vision model and a language model together with good latency. The architecture puts sensing and actuation on the phone and reasoning on a home hub, which in a product is the TV or a SmartThings hub. Small on-device models are improving quickly, and the hub can move onto the phone when they are ready.

**11. How do you read what the child is watching in YouTube or Instagram?**

In the demo we don't: Living Video runs in our own player, where we have the captions and can pause. On Android the public APIs give us the foreground app and duration, and through a notification listener the media title, play state and a pause command. That is enough for drift and pausing. Transcripts of third-party video are the hard part; as a first-party Samsung feature this could be solved at the system level, which is the argument for building it inside Samsung.

**12. How do you find a "natural breakpoint"? What if there are no captions?**

From captions we score three signals: a pause of a second or more, a sentence ending, and the next line starting a new part ("now", "next", "ab", "toh") or changing topic. Our tests check that no breakpoint cuts into a caption line. With no captions, PORTAL waits for the video to end or for the child to pause. It does not guess.

**13. LLMs hallucinate. What if it tells a child to do something dangerous?**

Three layers. The quest prompt forbids fire, knives, heat, electricity, climbing and going out alone. Then code scans every generated quest for unsafe words and discards it in favour of a vetted template. And the model never decides anything about limits or rules. We have a test where a model proposes a candle experiment; it is rejected.

**14. Why doesn't the AI write the game code? Isn't that the "code intelligence" track?**

A deliberate trade. The agent writes a rules object, validated against a schema with a repair loop, and a fixed sandboxed engine runs it. That means no model-written JavaScript ever executes on a child's device, the game always loads, and the rules map one-to-one onto blocks a six-year-old can read and change by voice. Free-form generation would demo slightly flashier and fail far more often.

## Business

**15. Google and Apple could copy this in a quarter. Why Samsung, why you?**

They could copy the phone part. Neither can easily make the house react. PORTAL's second act needs the phone, the TV, the lights, the speaker and the watch under one platform, and in an Indian home that platform is far more likely to be Samsung and SmartThings than anyone else's. Google also has a harder story to tell, because YouTube's revenue depends on the watch time PORTAL interrupts. Samsung sells the devices, not the attention.

## Two to have ready

**"What was fake in the demo?"** Read the status chips aloud: lights, watch and TV were simulated on the laptop, the clock ran 60 times fast, speech recognition used the browser. Every decision was made by the real Brain.

**"What would you do with one more month?"** The native Android service, an on-device model, and real bulbs. In that order.

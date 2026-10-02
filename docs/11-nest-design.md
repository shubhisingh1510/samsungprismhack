# NEST: brand and site design notes

**NEST** · *small moments. bigger worlds.*

The product was called PORTAL in the earlier deliverables. The idea is unchanged; the name, the look and the front end are new. Environment variables (`PORTAL_MODEL` and so on) and the `C:\Users\MAYANK\portal` folder keep the old name so nothing breaks.

## The mark

Two curved strokes. The outer one is a shelter; the inner one is a doorway. Nothing else.

| File (in `site/public/brand/`, served at `/nest/brand/`) | Use |
|---|---|
| `nest-logo-light.svg` | Primary horizontal logo on light backgrounds |
| `nest-logo-dark.svg` | On dark backgrounds |
| `nest-logo-mono.svg` | One ink, for print or embroidery |
| `nest-symbol.svg`, `nest-symbol-mono.svg` | The symbol alone |
| `nest-app-icon.svg` | App icon |
| `index.html` | Brand sheet showing all of them |

The wordmark is drawn from the same round-ended strokes as the symbol, so it does not depend on a font. On the site, the doorway in the symbol fills with light while the cursor explores the hero.

## System

| | |
|---|---|
| Base | Warm Ivory `#FFF9F2`, text Deep Brown-Black `#292724` |
| Pastels | Blush `#F4DDE2`, Butter `#F5E8B5`, Sage `#DDE8D7`, Powder `#DCEAF2`, Lavender `#E6DDF0`, Terracotta `#DCA58D` |
| Type | Fraunces (a warm old-style serif, set at weight 620) for statements; Instrument Sans for interface text. Noto Serif Devanagari, Noto Serif KR and Noto Serif JP carry the headlines in Hindi, Korean and Japanese. All bundled, no network fonts |
| Texture | One fixed sheet of fine grain over flat colour. The only gradient-like effect is the soft halo behind a doorway |
| Illustration | One object library (`site/src/illustrations/objects.tsx`): flat pastel shapes with a few ink lines. Every scene is composed from it |
| Motion | Each animation shows a cause: the door growing out of the TV, the quest sliding out of the video, the room warming when NEST wakes. Reduced-motion preferences are respected |

## The site as a walk through a home

Each section is a room, and each room's top edge is cut as a wide archway in the colour of the room you are leaving.

| Room | Sections |
|---|---|
| Hero | "What if screen time could take them somewhere?" |
| 01 The Screen | The problem |
| 02 The Door | The idea (TV becomes a doorway, driven by scrolling); the living-video player |
| 03 The Adventure | Four picture-book spreads: Build, Look up, Make, Move |
| 04 The Home | The house waking up; "NEST knows when to knock" |
| 05 The Making | NEST Films |
| 06 The Future | Three age rooms; languages; the parents' window; privacy; closing |

## Languages

The site reads in English, Spanish, Hindi, Korean, French and Japanese. The language can be changed in two places: the small menu in the navigation, and the Languages section, where each language is a large name in its own script. The choice is remembered on the device, and a first visit follows the browser's language.

- Every string lives in `site/src/i18n/`. `en.ts` is the source of truth and the other files are typed against it, so a missing translation is a build error.
- A translator marks emphasis with `*stars*` and line breaks with a new line; layout stays in code.
- Hindi, Korean and Japanese have no italics, so emphasis becomes the terracotta colour, and their lines are set taller.
- The translations were written by the assistant and have not been reviewed by native speakers. Have each one read before it is shown to a judge who speaks that language.
- The descriptions of illustrations for screen readers are still English only.
- In demo mode the hub's own lines (the dare, the quest, the film script) stay in English, and the demo says so. Only the recording is translated.
- The working prototype pages at `/devices.html` are English only.

## Sign-in page

`#/signin` is a design preview and says so on the page. The form's fields are never read: submitting clears them, plays the door opening, and enters the demo. Nothing is sent or stored. There is deliberately no "continue with Samsung account" button, so the page cannot be mistaken for a real Samsung sign-in.

The demo and the sign-in page have their own addresses (`#/demo`, `#/signin`), so the browser's back button works between them.

## Demo mode ("Enter NEST")

One continuous story with a phone, a TV, a light and a watch.

- When the hub is running, the story is driven by it: the moment NEST decides to speak, the breakpoint it waits for, the line, the quest, the light scene and the film script all come from the real Brain over the same WebSocket bus the prototype uses. The header says **Decisions: LIVE**.
- When the hub is not reachable, the same story plays from a recording and the header says **SIMULATED**. If the hub stops answering mid-story the demo switches to the recording and says so.
- The four devices are drawings and are tagged **SIMULATED**. The light switches to **LIVE** only when the hub reports real SmartThings.
- The film's pictures are drawn stand-ins for a child's photos, and the screen says so.

Opening the demo resets the hub's runtime state (rules, log, quests) so each run starts clean.

## Checked, and not checked

Checked in headless Edge at 1360 and 1440 px wide and at 390 px: every section renders without page errors; the hero cursor effect, the quest sliding out of the video, the wall switch, the age rooms and the film were each triggered by script and responded; the demo runs end to end against the live hub (in English and in Hindi); both language switchers change the whole page and the choice survives a reload; no language overflows the page sideways at either width; the sign-in page clears its fields and opens the demo; the restyled prototype pages pass the same click-through as before.

Not checked: real phones and tablets, Safari and Firefox, how the motion feels to a person using it, and screen readers. The illustrations carry text descriptions, but nobody has listened to them.

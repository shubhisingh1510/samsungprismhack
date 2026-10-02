import type { ReactNode } from "react";
import { Reveal } from "../components/Reveal";
import { Room, RoomMark, type Tone } from "../components/Room";
import { rich, useLang, type Key } from "../i18n";
import { At, Box, Bridge, C, ChildJumping, Ground, Plant, Pot, Saturn, Star, Tape, Telescope } from "../illustrations/objects";

const ink = { stroke: C.ink, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

function BuildScene() {
  return (
    <svg viewBox="0 0 760 540" className="w-full" role="img" aria-label="A cardboard bridge across two stacks of books, holding more books, with a roll of tape beside it.">
      <At x={60} y={430}><Ground w={640} fill={C.ivory} /></At>
      <g>
        <At x={170} y={250} s={1.25}><Bridge load={5} /></At>
        <At x={598} y={392} s={1.05}><Tape /></At>
        <At x={36} y={360} s={0.92}><Box /></At>
      </g>
    </svg>
  );
}

function LookUpScene() {
  return (
    <svg viewBox="0 0 760 540" className="w-full" role="img" aria-label="A small telescope on a balcony at night, pointed at Saturn among the stars.">
      <At x={560} y={130}><Saturn r={40} /></At>
      {[[90, 80, 1.2], [210, 150, 0.7], [330, 60, 1], [440, 190, 0.6], [660, 250, 0.9], [130, 250, 0.6], [700, 70, 0.7], [280, 250, 0.5]].map(([x, y, s], i) => (
        <At key={i} x={x} y={y} s={s}><Star fill={i % 3 ? C.butter : C.ivory} /></At>
      ))}
      <g>
        <At x={250} y={236} s={1.7}><Telescope stroke={C.ivory} /></At>
        <path d="M30 430 H730 M30 470 H730" stroke={C.ivory} strokeWidth={3} strokeLinecap="round" />
        {Array.from({ length: 15 }).map((_, i) => (
          <path key={i} d={`M${54 + i * 47} 430 V520`} stroke={C.ivory} strokeWidth={2.4} strokeLinecap="round" />
        ))}
        <At x={600} y={330} s={1}><Plant pot={C.clay} stroke={C.ivory} /></At>
      </g>
    </svg>
  );
}

function MakeScene() {
  return (
    <svg viewBox="0 0 760 540" className="w-full" role="img" aria-label="Vegetables around a plate, a cooking pot, and a handwritten recipe card.">
      <g>
        <circle cx={380} cy={300} r={150} fill={C.ivory} />
        <circle cx={380} cy={300} r={150} {...ink} />
        <circle cx={380} cy={300} r={104} {...ink} strokeWidth={1.4} />
        {/* tomato, carrot, leaf, onion: tonight's ingredients */}
        <circle cx={340} cy={290} r={34} fill={C.clay} />
        <path d="M330 262 L340 252 L350 262 M340 252 V244" {...ink} stroke={C.moss} strokeWidth={4} />
        <path d="M392 350 L470 290 L484 306 Z" fill={C.terracotta} />
        <path d="M470 290 L492 268 M478 298 L504 286" {...ink} stroke={C.moss} strokeWidth={5} />
        <path d="M398 236 C420 214 452 222 458 246 C436 262 408 256 398 236 Z" fill={C.moss} />
        <ellipse cx={318} cy={352} rx={24} ry={20} fill={C.lavender} />
        <At x={40} y={90} s={1.5}><Pot /></At>
        <g transform="rotate(7 620 150)">
          <rect x={540} y={60} width={170} height={210} fill={C.ivory} />
          <rect x={540} y={60} width={170} height={210} {...ink} />
          <path d="M560 96 H650 M560 130 H690 M560 156 H672 M560 182 H690 M560 208 H640" {...ink} strokeWidth={1.8} />
          <circle cx={690} cy={78} r={7} fill={C.clay} />
        </g>
        <path d="M150 430 L210 500 M168 420 L228 490" {...ink} strokeWidth={5} stroke={C.card} />
      </g>
    </svg>
  );
}

function MoveScene() {
  return (
    <svg viewBox="0 0 760 540" className="w-full" role="img" aria-label="A child mid star-jump beside a sixty-second timer.">
      <At x={130} y={470}><Ground w={460} fill={C.ivory} /></At>
      <g>
        <path d="M150 250 C130 200 140 150 170 120 M610 270 C640 220 630 160 600 126 M220 90 C260 60 310 52 350 62" {...ink} stroke={C.clay} strokeDasharray="2 14" strokeWidth={4} />
        <At x={216} y={120} s={2.6}><ChildJumping /></At>
        <circle cx={620} cy={400} r={62} fill={C.ivory} />
        <circle cx={620} cy={400} r={62} {...ink} />
        <path d="M620 338 A62 62 0 0 1 674 431" {...ink} stroke={C.clay} strokeWidth={8} />
        <text x={620} y={417} textAnchor="middle" fontFamily="var(--font-serif)" fontSize={50} fill={C.ink}>60</text>
      </g>
    </svg>
  );
}

type Spread = { n: string; kind: Key; ask: Key; note: Key; tone: Tone; scene: ReactNode; flip?: boolean };

const SPREADS: Spread[] = [
  { n: "01", kind: "adv.1.kind", ask: "adv.1.ask", note: "adv.1.note", tone: "butter", scene: <BuildScene /> },
  { n: "02", kind: "adv.2.kind", ask: "adv.2.ask", note: "adv.2.note", tone: "ink", scene: <LookUpScene />, flip: true },
  { n: "03", kind: "adv.3.kind", ask: "adv.3.ask", note: "adv.3.note", tone: "sage", scene: <MakeScene /> },
  { n: "04", kind: "adv.4.kind", ask: "adv.4.ask", note: "adv.4.note", tone: "blush", scene: <MoveScene />, flip: true },
];

export function Adventures() {
  const { t } = useLang();
  return (
    <>
      <Room id="adventures" tone="ivory">
        <div className="mx-auto max-w-[1500px] px-6 pt-[6vh] pb-[12vh] md:px-12">
          <RoomMark n="03" name="room.adventure" />
          <Reveal className="mt-[9vh]">
            <h2 className="display text-[clamp(3rem,9vw,9rem)]">
              {rich(t("adv.title"))}
            </h2>
            <p className="lede mt-8 opacity-70">{t("adv.lede")}</p>
          </Reveal>
        </div>
      </Room>

      {SPREADS.map((s, i) => (
        <Room key={s.n} tone={s.tone} from={i === 0 ? "ivory" : SPREADS[i - 1].tone}>
          <div className="mx-auto grid max-w-[1500px] grid-cols-1 items-center gap-10 px-6 pt-[4vh] pb-[12vh] md:px-12 lg:min-h-[86vh] lg:grid-cols-12">
            <Reveal className={`lg:col-span-5 ${s.flip ? "lg:order-2 lg:col-start-8" : ""}`}>
              <p className="flex items-baseline gap-5">
                <span className="display text-[2.6rem] opacity-45">{s.n}</span>
                <span className="label">{t(s.kind)}</span>
              </p>
              <h3 className="display mt-6 text-[clamp(2.4rem,5.4vw,5.4rem)]">{rich(t(s.ask))}</h3>
              <p className="mt-8 text-[0.95rem] opacity-65">{t(s.note)}</p>
            </Reveal>
            <Reveal delay={0.15} className={`lg:col-span-7 ${s.flip ? "lg:order-1 lg:col-start-1 lg:row-start-1" : ""}`}>
              {s.scene}
            </Reveal>
          </div>
        </Room>
      ))}
    </>
  );
}

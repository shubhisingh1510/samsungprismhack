import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Reveal } from "../components/Reveal";
import { Room, RoomMark } from "../components/Room";
import { rich, useLang, type Key } from "../i18n";
import { At, Box, C, Plant, Star } from "../illustrations/objects";

const ink = { stroke: C.ink, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const fade = (on: boolean, delay = 0) => ({ opacity: on ? 1 : 0, transition: `opacity 0.9s var(--ease-quiet) ${delay}s` });

function ExplorerRoom({ on }: { on: boolean }) {
  return (
    <>
      <circle cx={232} cy={120} r={34} fill={C.butter} />
      <path d="M-400 330 C-200 300 60 280 130 300 C180 314 230 262 320 270 C420 280 600 300 720 290 V460 H-400 Z" fill={C.moss} opacity={0.55} />
      {/* building blocks */}
      <rect x={34} y={340} width={54} height={54} rx={10} fill={C.blush} />
      <rect x={92} y={340} width={54} height={54} rx={10} fill={C.powder} />
      <rect x={62} y={284} width={54} height={54} rx={10} fill={C.butter} />
      {/* the rabbit is always there; the whale surfaces when you look in */}
      <g>
        <path d="M150 250 C150 214 196 204 222 224 C246 206 268 222 262 244 C282 252 276 284 250 284 H176 C158 284 150 270 150 250 Z" fill={C.ivory} />
        <path d="M192 216 C186 184 204 172 210 208 Z M222 210 C222 178 242 176 238 212 Z" fill={C.ivory} />
        <path d="M192 216 C186 184 204 172 210 208 M222 210 C222 178 242 176 238 212" {...ink} strokeWidth={1.6} />
        <circle cx={206} cy={244} r={2.6} fill={C.ink} /><circle cx={232} cy={244} r={2.6} fill={C.ink} />
      </g>
      <g style={fade(on)}>
        <path d="M176 392 C176 362 214 350 246 356 C272 360 288 376 284 392 C270 404 200 406 176 392 Z" fill={C.sky} />
        <path d="M284 384 L304 368 L300 398 Z" fill={C.sky} />
        <circle cx={204} cy={378} r={2.6} fill={C.ink} />
      </g>
    </>
  );
}

function AdventurerRoom({ on }: { on: boolean }) {
  return (
    <>
      {/* a map on the wall, with tonight's route */}
      <g transform="rotate(-3 160 150)">
        <rect x={48} y={74} width={224} height={150} fill={C.ivory} />
        <rect x={48} y={74} width={224} height={150} {...ink} />
        <path d="M48 124 C100 104 130 150 180 128 C220 112 250 140 272 126" {...ink} strokeWidth={1.4} stroke={C.sky} />
        <motion.path d="M76 196 C104 150 140 190 168 150 C190 120 220 130 244 104" {...ink} stroke={C.clay} strokeDasharray="3 9" strokeWidth={3}
          initial={false} animate={{ pathLength: on ? 1 : 0.25 }} transition={{ duration: 1.4, ease: [0.22, 0.61, 0.36, 1] }} />
        <path d="M236 96 L252 112 M252 96 L236 112" {...ink} stroke={C.clay} strokeWidth={3} style={fade(on, 0.9)} />
      </g>
      <At x={186} y={300} s={1.05}><Box /></At>
      {/* backpack */}
      <path d="M44 310 C44 280 62 268 86 268 C110 268 128 280 128 310 V392 H44 Z" fill={C.terracotta} />
      <path d="M60 340 H112 V378 H60 Z" fill={C.clay} />
      <path d="M44 310 C44 280 62 268 86 268 C110 268 128 280 128 310 V392 H44 Z M68 268 C68 250 104 250 104 268" {...ink} />
      <g style={fade(on, 0.4)}>
        <path d="M150 262 V200" {...ink} />
        <path d="M150 202 L186 214 L150 228 Z" fill={C.honey} />
      </g>
    </>
  );
}

function PilotRoom({ on }: { on: boolean }) {
  return (
    <>
      <path d="M20 330 H300" {...ink} />
      <path d="M48 330 V420 M272 330 V420" {...ink} />
      {/* a journal, and goals they wrote themselves */}
      <path d="M92 300 L160 290 L228 300 V326 L160 316 L92 326 Z" fill={C.ivory} />
      <path d="M92 300 L160 290 L228 300 V326 L160 316 L92 326 Z M160 290 V316" {...ink} />
      <g transform="translate(86 96)">
        <rect width={148} height={130} fill={C.ivory} />
        <rect width={148} height={130} {...ink} />
        {[30, 62, 94].map((y, i) => (
          <g key={y}>
            <rect x={18} y={y - 9} width={16} height={16} {...ink} strokeWidth={1.6} />
            <path d={`M46 ${y} H${118 - i * 14}`} {...ink} strokeWidth={1.6} />
            <path d={`M21 ${y} L25 ${y + 4} L32 ${y - 5}`} {...ink} stroke={C.clay} strokeWidth={2.6} style={fade(on, 0.25 * (i + 1))} />
          </g>
        ))}
      </g>
      <At x={236} y={236} s={0.86}><Plant pot={C.umber} /></At>
      <At x={60} y={70} s={0.8}><Star fill={C.ivory} /></At>
    </>
  );
}

type Mode = { key: string; name: Key; ages: string; tone: string; line: Key; scene: (on: boolean) => ReactNode };

const MODES: Mode[] = [
  { key: "explorer", name: "ages.explorer", ages: "4–7", tone: C.sage, line: "ages.explorer.line", scene: (on) => <ExplorerRoom on={on} /> },
  { key: "adventurer", name: "ages.adventurer", ages: "8–12", tone: C.butter, line: "ages.adventurer.line", scene: (on) => <AdventurerRoom on={on} /> },
  { key: "pilot", name: "ages.pilot", ages: "13–17", tone: C.powder, line: "ages.pilot.line", scene: (on) => <PilotRoom on={on} /> },
];

export function Ages() {
  const [active, setActive] = useState("adventurer");
  const { t } = useLang();

  return (
    <Room id="ages" tone="ivory" from="ink">
      <div className="mx-auto max-w-[1500px] px-6 pt-[6vh] pb-[14vh] md:px-12">
        <RoomMark n="06" name="room.future" />
        <Reveal className="mt-[8vh] max-w-[62rem]">
          <h2 className="display text-[clamp(2.6rem,6.4vw,6.4rem)]">
            {rich(t("ages.title"))}
          </h2>
        </Reveal>

        {/* three doorways; step towards one and the room behind it comes alive */}
        <div className="mt-14 flex flex-col gap-10 md:flex-row md:items-end md:gap-6">
          {MODES.map((m) => {
            const on = active === m.key;
            return (
              <motion.button
                key={m.key}
                type="button"
                className="group min-w-0 text-left"
                style={{ flexBasis: 0 }}
                animate={{ flexGrow: on ? 1.5 : 1 }}
                transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
                onMouseEnter={() => setActive(m.key)}
                onFocus={() => setActive(m.key)}
                onClick={() => setActive(m.key)}
                aria-pressed={on}
              >
                <div className="overflow-hidden" style={{ backgroundColor: m.tone, borderRadius: "999px 999px 0 0", filter: on ? "none" : "saturate(0.8)", transition: "filter 0.8s var(--ease-quiet)" }}>
                  <svg viewBox="0 0 320 440" className="block h-[46vh] max-h-[520px] min-h-[300px] w-full overflow-visible" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
                    <g>{m.scene(on)}</g>
                  </svg>
                </div>
                <div className="rule mt-0 pt-5">
                  <p className="flex items-baseline justify-between">
                    <span className="display text-[clamp(1.8rem,2.6vw,2.6rem)]">{t(m.name)}</span>
                    <span className="label opacity-60">{m.ages}</span>
                  </p>
                  <p className="mt-2 max-w-[34ch] text-[0.95rem] transition-opacity duration-700" style={{ opacity: on ? 0.8 : 0.4 }}>{t(m.line)}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </Room>
  );
}

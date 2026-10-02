import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Reveal } from "../components/Reveal";
import { Room, RoomMark } from "../components/Room";
import { rich, useLang, type Key } from "../i18n";
import { At, Bridge, C, Tape, TV } from "../illustrations/objects";

const ink = { stroke: C.ink, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

function Still({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 800 336" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={800} height={336} fill={bg} />
      <g>{children}</g>
    </svg>
  );
}

export type Shot = { line: string; still: ReactNode };

const LINES: Key[] = ["creator.shot1", "creator.shot2", "creator.shot3", "creator.shot4"];

/** The four stills. The words that go with them come from the translations (or, in the demo, from the hub). */
export const STILLS: ReactNode[] = [
  (
      <Still bg={C.powder}>
        <At x={270} y={70}><TV w={260} h={160}><rect width={242} height={142} fill={C.butter} /><path d="M40 96 C90 60 150 60 202 96" {...ink} strokeWidth={6} stroke={C.card} /></TV></At>
      </Still>
  ),
  <Still bg={C.butter}><At x={230} y={150}><Bridge load={0} /></At><At x={610} y={220} s={0.8}><Tape /></At></Still>,
  (
      <Still bg={C.blush}>
        <At x={230} y={150}><Bridge load={0} /></At>
        <g transform="rotate(24 400 250)"><path d="M300 250 H520 V266 H300 Z" fill={C.card} /><path d="M300 250 H520 V266 H300 Z" {...ink} /></g>
      </Still>
  ),
  <Still bg={C.sage}><At x={230} y={190}><Bridge load={6} /></At></Still>,
];

const SHOT_MS = 3000;
const ease = [0.22, 0.61, 0.36, 1] as const;

/** The film itself. Shared by this section and by the demo, which passes in its own script. */
export function FilmPlayer({ title, runtime, shots, closing, autoPlay = false }: { title: string; runtime: string; shots: Shot[]; closing: string; autoPlay?: boolean }) {
  const [at, setAt] = useState(autoPlay ? 0 : -1);          // -1 poster, 0..n-1 shots, n end card
  const playing = at >= 0 && at < shots.length;
  const { t } = useLang();

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setAt((i) => i + 1), SHOT_MS);
    return () => clearTimeout(timer);
  }, [at, playing]);

  return (
    <div>
      <div className="relative overflow-hidden bg-black" style={{ aspectRatio: "2.39 / 1", borderRadius: 4 }}>
        <AnimatePresence>
          {playing && (
            <motion.div key={at} className="absolute inset-0" initial={{ opacity: 0, scale: 1 }} animate={{ opacity: 1, scale: 1.05 }} exit={{ opacity: 0 }}
              transition={{ opacity: { duration: 0.8 }, scale: { duration: SHOT_MS / 1000 + 0.8, ease: "linear" } }}>
              {shots[at].still}
            </motion.div>
          )}
        </AnimatePresence>

        {at === -1 && <div className="absolute inset-0 opacity-80">{shots[shots.length - 1].still}</div>}
        <div className="pointer-events-none absolute inset-0" style={{ background: at === -1 || at === shots.length ? "rgba(20,18,16,0.5)" : "linear-gradient(transparent 55%, rgba(20,18,16,0.7))" }} />

        {at === -1 && (
          <div className="absolute inset-0 flex flex-col justify-between p-[5%] text-ivory">
            <p className="label">{t("creator.films")}</p>
            <div>
              <h3 className="display max-w-[16ch] text-[clamp(1.5rem,4.2vw,4rem)] uppercase">{title}</h3>
              <div className="mt-[3%] flex items-center gap-6">
                <button className="btn btn-ivory" onClick={() => setAt(0)}>
                  <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true"><path d="M1 1 L10 6 L1 11 Z" fill="currentColor" /></svg>
                  {t("creator.play")}
                </button>
                <span className="text-[0.9rem] tabular-nums opacity-80">{runtime}</span>
              </div>
            </div>
          </div>
        )}

        {playing && (
          <div className="absolute inset-x-0 bottom-0 p-[4%] text-center text-ivory">
            <p className="label opacity-70">{t("creator.vo")}</p>
            <AnimatePresence mode="wait">
              <motion.p key={at} className="display mt-1 text-[clamp(1.1rem,2.6vw,2.2rem)] italic" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, delay: 0.3, ease }}>
                {shots[at].line}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

        {at === shots.length && (
          <motion.div className="absolute inset-0 grid place-items-center p-[5%] text-center text-ivory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
            <div>
              <p className="display text-[clamp(1.3rem,3.2vw,2.8rem)] italic">{closing}</p>
              <button className="link mt-5 text-[0.9rem]" onClick={() => setAt(0)}>{t("creator.again")}</button>
            </div>
          </motion.div>
        )}
      </div>

      {/* the edit: one block per shot, lit as it plays */}
      <div className="mt-4 flex items-center gap-4 text-[0.8rem] tabular-nums">
        <span className="opacity-60">{playing ? t("creator.shot", { n: at + 1, m: shots.length }) : t(at === -1 ? "creator.ready" : "creator.end")}</span>
        <div className="flex flex-1 gap-1.5">
          {shots.map((_, i) => (
            <div key={i} className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-current/20">
              {i < at && <div className="absolute inset-0 bg-current" />}
              {i === at && <motion.div className="absolute inset-y-0 left-0 bg-current" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: SHOT_MS / 1000, ease: "linear" }} />}
            </div>
          ))}
        </div>
        <span className="opacity-60">{runtime}</span>
      </div>
    </div>
  );
}

export function Creator() {
  const { t } = useLang();
  const shots: Shot[] = STILLS.map((still, i) => ({ still, line: t(LINES[i]) }));
  return (
    <Room id="creator" tone="ink" from="lavender">
      <div className="mx-auto max-w-[1500px] px-6 pt-[6vh] pb-[16vh] md:px-12">
        <RoomMark n="05" name="room.making" light />
        <Reveal className="mt-[9vh]">
          <h2 className="display text-[clamp(2.6rem,6.6vw,6.6rem)]">{t("creator.one")}</h2>
          <h2 className="display mt-2 text-[clamp(2.6rem,6.6vw,6.6rem)] text-terracotta [&_em]:text-terracotta">{rich(t("creator.two"))}</h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-9">
            <FilmPlayer title={t("creator.film")} runtime="1:42" shots={shots} closing={t("creator.closing")} />
          </div>
          <div className="lg:col-span-3 lg:pt-2">
            <p className="lede opacity-80">{t("creator.lede")}</p>
            <p className="mt-6 text-[0.85rem] opacity-55">{t("creator.note")}</p>
          </div>
        </Reveal>
      </div>
    </Room>
  );
}

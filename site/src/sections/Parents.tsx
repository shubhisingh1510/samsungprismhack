import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Reveal } from "../components/Reveal";
import { Room } from "../components/Room";
import { rich, useLang, type Key } from "../i18n";
import { At, Bridge, C, Pot, Saturn } from "../illustrations/objects";

const ink = { stroke: C.ink, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

function Mini({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 80" className="h-[0.62em] w-auto shrink-0" aria-hidden="true">
      <g>{children}</g>
    </svg>
  );
}

const INTERESTS: { word: Key; mini: ReactNode }[] = [
  { word: "parents.i1", mini: <Mini><At x={-2} y={18} s={0.36}><Bridge /></At></Mini> },
  { word: "parents.i2", mini: <Mini><At x={60} y={40}><Saturn r={20} /></At></Mini> },
  { word: "parents.i3", mini: <Mini><At x={22} y={6} s={0.76}><Pot /></At></Mini> },
  { word: "parents.i4", mini: <Mini><path d="M20 62 L84 14 L98 28 L34 72 Z" fill={C.honey} /><path d="M20 62 L84 14 L98 28 L34 72 Z M20 62 L14 78 L34 72" {...ink} /></Mini> },
];

const PROMISES: [Key, Key][] = [["parents.p1h", "parents.p1b"], ["parents.p2h", "parents.p2b"], ["parents.p3h", "parents.p3b"]];

export function Parents() {
  const { t } = useLang();
  return (
    <Room id="parents" tone="powder" from="butter">
      <div className="mx-auto max-w-[1500px] px-6 pt-[6vh] pb-[14vh] md:px-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <p className="label opacity-55">{t("parents.label")}</p>
            <h2 className="display mt-5 text-[clamp(2.6rem,5.6vw,5.6rem)]">
              {rich(t("parents.title"))}
            </h2>
            <p className="lede mt-8 opacity-75">{t("parents.lede")}</p>
          </Reveal>

          {/* an arched window; what you see through it is what she is curious about */}
          <div className="lg:col-span-7">
            <div className="relative bg-ivory px-7 pt-16 pb-10 md:px-14 md:pt-24" style={{ borderRadius: "999px 999px 0 0", boxShadow: "inset 0 0 0 2px var(--color-ink)" }}>
              <div className="pointer-events-none absolute inset-x-0 top-[46%] h-px bg-ink/15" />
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-ink/15" />
              <p className="relative text-center text-[1.05rem] opacity-70">{t("parents.week")}</p>
              <ul className="relative mt-6">
                {INTERESTS.map((it, i) => (
                  <motion.li
                    key={it.word}
                    className="display flex items-center justify-center gap-[0.4em] text-[clamp(2.1rem,5.6vw,5.2rem)] uppercase"
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1 - i * 0.17, y: 0 }}
                    viewport={{ once: true, margin: "0px 0px -18% 0px" }}
                    transition={{ duration: 0.8, delay: i * 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                  >
                    {it.mini}
                    {t(it.word)}
                  </motion.li>
                ))}
              </ul>
              <Reveal delay={0.9} className="relative mt-10 text-center">
                <p className="text-[1.05rem] opacity-70">{t("parents.next")}</p>
                <p className="display mt-2 text-[clamp(1.6rem,3vw,2.8rem)] italic text-clay">{t("parents.idea")}</p>
              </Reveal>
            </div>
            <div className="h-3 bg-ink" />
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-3">
          {PROMISES.map(([head, body], i) => (
            <Reveal key={head} delay={i * 0.1} className="rule pt-5">
              <h3 className="display text-[1.7rem]">{t(head)}</h3>
              <p className="mt-2 max-w-[36ch] text-[0.95rem] opacity-70">{t(body)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </Room>
  );
}

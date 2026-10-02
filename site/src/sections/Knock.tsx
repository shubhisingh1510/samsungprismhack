import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "../components/Reveal";
import { Room } from "../components/Room";
import { rich, useLang, type Key } from "../i18n";
import { At, C, Ground, House, Plant, Star } from "../illustrations/objects";

const STEPS: Key[] = ["knock.s1", "knock.s2", "knock.s3", "knock.s4"];
const CONSIDERS: Key[] = ["knock.c1", "knock.c2", "knock.c3", "knock.c4", "knock.c5"];

export function Knock() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { amount: 0.5 });
  const still = useReducedMotion();
  const [step, setStep] = useState(0);
  const { t } = useLang();

  // One thought at a time, then a long rest on the question before starting over.
  useEffect(() => {
    if (!seen) return;
    if (still) {
      setStep(STEPS.length - 1);
      return;
    }
    const last = step === STEPS.length - 1;
    const timer = setTimeout(() => setStep(last ? 0 : step + 1), last ? 5200 : 2300);
    return () => clearTimeout(timer);
  }, [seen, step, still]);

  const asking = step === STEPS.length - 1;

  return (
    <Room id="knock" tone="lavender" from="ivory">
      <div className="mx-auto max-w-[1500px] px-6 pt-[6vh] pb-[14vh] md:px-12">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <p className="label opacity-55">{t("knock.label")}</p>
            <h2 className="display mt-5 text-[clamp(2.8rem,6.6vw,6.6rem)]">
              {rich(t("knock.title"))}
            </h2>
            <p className="lede mt-8 opacity-75">
              {t("knock.lede")}
            </p>
          </Reveal>

          <div ref={ref} className="relative lg:col-span-6">
            <svg viewBox="0 0 640 520" className="w-full" role="img" aria-label="A small house at dusk. A note by the door reads one line at a time.">
              <At x={40} y={452}><Ground w={560} fill={C.ivory} /></At>
              <At x={470} y={70} s={1.2}><Star fill={C.ivory} /></At>
              <At x={560} y={150} s={0.8}><Star fill={C.ivory} /></At>
              <At x={90} y={110} s={0.9}><Star fill={C.ivory} /></At>
              <g>
                <At x={150} y={160}><House lit={asking} /></At>
                <At x={470} y={372} s={0.95}><Plant /></At>
              </g>
            </svg>

            {/* the note is real text, so it can be read aloud and selected */}
            <div className="paper absolute left-[2%] top-[4%] w-[min(300px,64%)] px-5 py-4" style={{ borderRadius: 4, rotate: "-2deg" }} aria-live="polite">
              <div className="flex gap-1.5">
                {STEPS.map((s, i) => (
                  <span key={s} className="h-[3px] w-5 rounded-full bg-ink transition-opacity duration-500" style={{ opacity: i <= step ? 0.85 : 0.15 }} />
                ))}
              </div>
              <div className="mt-3 min-h-[3.4em]">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={step}
                    className={asking ? "display text-[1.9rem] italic" : "text-[1.02rem]"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.5 }}
                  >
                    {t(STEPS[step])}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <Reveal className="mt-14">
          <div className="rule pt-6">
            <p className="label opacity-55">{t("knock.considers")}</p>
            <ul className="mt-4 flex flex-wrap gap-x-10 gap-y-2 text-[0.95rem]">
              {CONSIDERS.map((c) => <li key={c}>{t(c)}</li>)}
            </ul>
          </div>
        </Reveal>
      </div>
    </Room>
  );
}

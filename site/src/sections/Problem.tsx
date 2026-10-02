import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "../components/Reveal";
import { Room, RoomMark } from "../components/Room";
import { useLang } from "../i18n";

export function Problem() {
  const ref = useRef<HTMLHeadingElement>(null);
  const seen = useInView(ref, { amount: 0.6 });
  const still = useReducedMotion();
  const { t, lang } = useLang();
  const [i, setI] = useState(0);

  // Each language supplies its own sentence around the changing word, because the word
  // does not sit in the same place in every grammar.
  const words = t("problem.words").split("|");
  const [before, after] = t("problem.little").split("{word}");

  // The last word only starts changing once the sentence has been read.
  useEffect(() => {
    if (!seen || still) return;
    const timer = setInterval(() => setI((n) => n + 1), 2100);
    return () => clearInterval(timer);
  }, [seen, still]);

  const word = words[i % words.length];

  return (
    <Room id="problem" tone="ivory">
      <div className="mx-auto max-w-[1500px] px-6 pt-[14vh] pb-[20vh] md:px-12">
        <RoomMark n="01" name="room.screen" />
        <Reveal className="mt-[12vh]">
          <p className="label opacity-55">{t("problem.label")}</p>
          <h2 className="display mt-6 text-[clamp(3rem,10vw,10rem)]">{t("problem.watch")}</h2>
        </Reveal>

        <div className="h-[16vh] md:h-[24vh]" />

        <Reveal className="md:pl-[12%]">
          <h2 ref={ref} className="display text-[clamp(3rem,10vw,10rem)]">
            {before}
            <span className="relative inline-block align-baseline">
              <AnimatePresence mode="wait" initial={false}>
                <motion.em
                  key={`${lang}-${word}`}
                  className="inline-block text-clay"
                  initial={{ opacity: 0, y: "0.18em" }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: "-0.14em" }}
                  transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  {word}
                </motion.em>
              </AnimatePresence>
            </span>
            {after}
          </h2>
          <p className="lede mt-12 opacity-70">{t("problem.note")}</p>
        </Reveal>
      </div>
    </Room>
  );
}

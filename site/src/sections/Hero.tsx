import { motion, useMotionValue, useSpring } from "motion/react";
import { rich, useLang } from "../i18n";
import { HeroScene } from "../illustrations/HeroScene";

type Props = { onEnter: () => void; onPointerActive: (active: boolean) => void };

export function Hero({ onEnter, onPointerActive }: Props) {
  // Cursor position across the hero, -1..1, eased so the room follows rather than jumps.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 40, damping: 16 });
  const my = useSpring(rawY, { stiffness: 40, damping: 16 });
  const { t } = useLang();

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-ivory"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const box = e.currentTarget.getBoundingClientRect();
        rawX.set(((e.clientX - box.left) / box.width) * 2 - 1);
        rawY.set(((e.clientY - box.top) / box.height) * 2 - 1);
        onPointerActive(true);
      }}
      onPointerLeave={() => {
        rawX.set(0);
        rawY.set(0);
        onPointerActive(false);
      }}
    >
      <div className="mx-auto grid min-h-[100svh] max-w-[1500px] grid-cols-1 px-6 pt-28 pb-10 md:px-12 lg:grid-cols-12 lg:pt-32">
        <div className="relative z-10 flex flex-col lg:col-span-6 lg:justify-between">
          <motion.h1
            className="display text-[clamp(2.7rem,11.4vw,5rem)] uppercase lg:text-[clamp(3.2rem,5.4vw,6.4rem)] lg:whitespace-nowrap [&_em]:normal-case"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {rich(t("hero.title"))}
          </motion.h1>

          <motion.div
            className="mt-10 lg:mt-0 lg:pb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.5 }}
          >
            <p className="lede">{t("hero.lede")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <button className="btn btn-ink" onClick={onEnter}>{t("nav.enter")}</button>
              <a className="link text-[0.95rem] font-semibold" href="#idea">{t("hero.how")}</a>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="relative -mx-6 mt-8 aspect-[900/690] md:-mx-12 lg:absolute lg:aspect-auto lg:inset-y-0 lg:right-0 lg:mx-0 lg:mt-0 lg:h-auto lg:w-[66%]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.6, delay: 0.2 }}
        >
          <div className="absolute inset-0 lg:top-[12%]">
            <HeroScene mx={mx} my={my} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

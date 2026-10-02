import { motion } from "motion/react";
import { Reveal } from "../components/Reveal";
import { Room } from "../components/Room";
import { LANGUAGES, rich, useLang } from "../i18n";

/**
 * The language of the whole site is chosen here, by picking a name off the page.
 * Each name is set in its own script and typeface, with the tagline as a taste of how it reads.
 */
export function Languages() {
  const { lang, setLang, t } = useLang();
  const current = LANGUAGES.find((l) => l.code === lang)!;

  return (
    <Room id="languages" tone="butter" from="ivory">
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-12 px-6 pt-[6vh] pb-[14vh] md:px-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <p className="label opacity-55">{t("lang.label")}</p>
          <h2 className="display mt-5 text-[clamp(2.6rem,5.6vw,5.6rem)]">{rich(t("lang.title"))}</h2>
          <p className="lede mt-8 opacity-75">{t("lang.lede")}</p>
          <p className="mt-8 text-[0.9rem] opacity-60" aria-live="polite">{t("lang.current", { name: current.name })}</p>
        </Reveal>

        <ul className="lg:col-span-7" role="radiogroup" aria-label={t("lang.label")}>
          {LANGUAGES.map((l, i) => {
            const on = l.code === lang;
            return (
              <motion.li
                key={l.code}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 0.61, 0.36, 1] }}
                className="border-t border-ink/20 last:border-b"
              >
                <button
                  role="radio"
                  aria-checked={on}
                  lang={l.code}
                  onClick={() => setLang(l.code)}
                  className="group flex w-full items-baseline justify-between gap-6 py-4 text-left md:py-5"
                >
                  <span className="flex items-baseline gap-4 md:gap-6">
                    {/* a small door beside the language you are in */}
                    <svg width="16" height="22" viewBox="0 0 16 22" className="shrink-0 translate-y-[2px] transition-opacity duration-500" style={{ opacity: on ? 1 : 0 }} aria-hidden="true">
                      <path d="M1 21 V8 C1 4 4 1 8 1 C12 1 15 4 15 8 V21 Z" fill="var(--color-clay)" />
                    </svg>
                    <span
                      className="display text-[clamp(2.4rem,6vw,5.4rem)] transition-[opacity,translate] duration-500 group-hover:translate-x-1"
                      style={{ opacity: on ? 1 : 0.42 }}
                    >
                      {l.name}
                    </span>
                  </span>
                  <span className="hidden max-w-[22ch] text-right text-[0.95rem] transition-opacity duration-500 sm:block" style={{ opacity: on ? 0.75 : 0.4 }}>
                    {l.tagline}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </Room>
  );
}

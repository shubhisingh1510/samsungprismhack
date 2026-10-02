import { motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Logo } from "../brand/Logo";
import { rich, useLang } from "../i18n";
import { At, C, Door, Ground, Plant, Star } from "../illustrations/objects";

const ease = [0.22, 0.61, 0.36, 1] as const;

/**
 * A sign-in page, for show. It is a design preview: the fields are never read, nothing is
 * sent anywhere, and the page says so. Submitting opens the door and enters the demo.
 */
export function SignIn({ onClose, onEnter }: { onClose: () => void; onEnter: () => void }) {
  const { t } = useLang();
  const [opening, setOpening] = useState(false);
  const [nudged, setNudged] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.current?.reset();          // whatever was typed is thrown away, unread
    setOpening(true);
    window.setTimeout(onEnter, 1500);
  };

  const field = "mt-2 w-full border-0 border-b-[1.5px] border-ink/30 bg-transparent px-0 py-2.5 text-[1.1rem] outline-none transition-colors placeholder:text-ink/30 focus:border-ink";

  return (
    <motion.div
      className="fixed inset-0 z-[55] overflow-y-auto bg-ivory"
      role="dialog" aria-modal="true" aria-label={t("nav.signin")}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
    >
      <div className="grid min-h-full grid-cols-1 lg:grid-cols-2">
        {/* the doorway */}
        <div className="relative hidden overflow-hidden bg-blush lg:block">
          <svg viewBox="0 0 700 900" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <At x={90} y={770}><Ground w={520} fill={C.ivory} /></At>
            <motion.g style={{ originX: 0.5, originY: 1 }} animate={{ scale: opening ? 4.2 : 1 }} transition={{ duration: 1.5, ease }}>
              <At x={220} y={250}><Door w={260} h={540} /></At>
            </motion.g>
            <motion.g animate={{ opacity: opening ? 0 : 1 }} transition={{ duration: 0.6 }}>
              <path d="M330 790 C340 700 372 650 430 610" stroke={C.ivory} strokeWidth={26} strokeLinecap="round" fill="none" opacity={0.75} />
              <At x={300} y={360} s={1.3}><Star fill={C.ivory} /></At>
              <At x={410} y={440} s={0.8}><Star fill={C.ivory} /></At>
              <At x={350} y={520} s={0.6}><Star fill={C.ivory} /></At>
              <At x={520} y={650} s={1.5}><Plant /></At>
              <At x={130} y={190} s={1.4}><Star fill={C.terracotta} /></At>
              <At x={590} y={300} s={1}><Star fill={C.terracotta} /></At>
            </motion.g>
          </svg>
        </div>

        <div className="flex flex-col px-6 py-6 md:px-14 lg:py-8">
          <header className="flex items-center justify-between">
            <button onClick={onClose} aria-label={t("signin.back")}><Logo /></button>
            <button className="link text-[0.9rem] font-semibold" onClick={onClose}>{t("signin.back")}</button>
          </header>

          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-12">
            <h1 className="display text-[clamp(3rem,7vw,5.6rem)]">{rich(t("signin.title"))}</h1>
            <p className="lede mt-5 opacity-70">{t("signin.lede")}</p>

            <form ref={form} className="mt-10" onSubmit={submit} autoComplete="off" noValidate>
              <label className="block">
                <span className="label opacity-60">{t("signin.email")}</span>
                <input className={field} type="email" name="preview-email" autoComplete="off" placeholder="maya@family.home" disabled={opening} />
              </label>
              <label className="mt-7 block">
                <span className="label opacity-60">{t("signin.password")}</span>
                <input className={field} type="password" name="preview-password" autoComplete="off" placeholder="••••••••" disabled={opening} />
              </label>
              <button type="submit" className="btn btn-ink mt-10 w-full justify-center !py-4" disabled={opening}>
                {opening ? t("signin.opening") : t("signin.submit")}
              </button>
            </form>

            <div className="mt-6 flex flex-wrap justify-between gap-x-6 gap-y-2 text-[0.9rem]">
              <button className="link" onClick={() => setNudged(true)}>{t("signin.create")}</button>
              <button className="link opacity-70" onClick={() => setNudged(true)}>{t("signin.forgot")}</button>
            </div>

            <motion.p
              className="mt-10 border-l-2 border-clay pl-4 text-[0.85rem]"
              animate={{ opacity: nudged ? 1 : 0.65, x: nudged ? [0, 5, 0] : 0 }}
              transition={{ duration: 0.5 }}
              onAnimationComplete={() => setNudged(false)}
            >
              {t("signin.note")}
            </motion.p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

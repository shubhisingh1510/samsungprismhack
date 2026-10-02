import { useEffect, useRef, useState } from "react";
import { Logo } from "../brand/Logo";
import { LANGUAGES, useLang } from "../i18n";

type Props = { onEnter: () => void; onSignIn: () => void; doorOpen: boolean };

/** A small menu of languages, each written in its own script. */
function LanguageMenu() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button className="label flex items-center gap-1.5 py-2" aria-haspopup="listbox" aria-expanded={open} aria-label={t("nav.language")} onClick={() => setOpen((o) => !o)}>
        {lang}
        <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden="true" style={{ rotate: open ? "180deg" : "0deg", transition: "rotate 0.3s" }}>
          <path d="M1 1 L4.5 5 L8 1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul role="listbox" aria-label={t("nav.language")} className="paper absolute right-0 top-full mt-2 min-w-[170px] py-2" style={{ borderRadius: 8 }}>
          {LANGUAGES.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button
                lang={l.code}
                className="flex w-full items-center justify-between gap-6 px-4 py-2 text-left text-[0.95rem] hover:bg-butter/60"
                style={{ fontWeight: l.code === lang ? 700 : 480 }}
                onClick={() => { setLang(l.code); setOpen(false); }}
              >
                {l.name}
                {l.code === lang && <span className="h-1.5 w-1.5 rounded-full bg-clay" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Nav({ onEnter, onSignIn, doorOpen }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLang();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-500"
      style={{
        backgroundColor: scrolled ? "rgba(255,249,242,0.94)" : "rgba(255,249,242,0)",
        boxShadow: scrolled ? "0 1px 0 rgba(41,39,36,0.1)" : "none",
      }}
    >
      <nav className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-4 md:px-12" aria-label="Main">
        <a href="#top" aria-label="NEST">
          {/* While the cursor is exploring the hero, the name steps back and the door lights up. */}
          <Logo open={doorOpen && !scrolled} hideWord={doorOpen && !scrolled} />
        </a>
        <div className="flex items-center gap-5 text-[0.92rem] font-semibold md:gap-7">
          <a className="link hidden lg:inline" href="#idea">{t("nav.how")}</a>
          <a className="link hidden lg:inline" href="#adventures">{t("nav.adventures")}</a>
          <a className="link hidden lg:inline" href="#parents">{t("nav.parents")}</a>
          <LanguageMenu />
          <button className="link hidden sm:inline" onClick={onSignIn}>{t("nav.signin")}</button>
          <button className="btn btn-line !px-5 !py-2.5" onClick={onEnter}>{t("nav.enter")}</button>
        </div>
      </nav>
    </header>
  );
}

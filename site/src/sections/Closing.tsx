import { NestSymbol } from "../brand/Logo";
import { Reveal } from "../components/Reveal";
import { Room } from "../components/Room";
import { rich, useLang } from "../i18n";

export function Closing({ onEnter, onSignIn }: { onEnter: () => void; onSignIn: () => void }) {
  const { t } = useLang();
  return (
    <Room id="enter" tone="ivory" from="sage">
      <div className="mx-auto max-w-[1500px] px-6 pt-[10vh] md:px-12">
        <Reveal className="text-center">
          <NestSymbol size={64} className="mx-auto" open />
          <h2 className="display mt-10 text-[clamp(2.8rem,9.4vw,9.4rem)]">{rich(t("closing.title"))}</h2>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <button className="btn btn-ink" onClick={onEnter}>{t("nav.enter")}</button>
            <button className="link text-[0.95rem] font-semibold" onClick={onSignIn}>{t("nav.signin")}</button>
          </div>
        </Reveal>

        <footer className="rule mt-[16vh] flex flex-wrap items-center justify-between gap-x-10 gap-y-4 py-7 text-[0.84rem]">
          <p className="opacity-60">{t("closing.concept")}</p>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label={t("closing.prototype")}>
            <span className="opacity-50">{t("closing.prototype")}</span>
            <a className="link" href="/child.html">{t("closing.phone")}</a>
            <a className="link" href="/tv.html">{t("closing.living")}</a>
            <a className="link" href="/parent.html">{t("closing.parent")}</a>
            <a className="link" href="/forge.html">{t("closing.forge")}</a>
            <a className="link" href={`${import.meta.env.BASE_URL}brand/`}>{t("closing.brand")}</a>
            <button className="label rounded-full px-3 py-1.5 shadow-[inset_0_0_0_1px_var(--color-ink)] transition-colors hover:bg-ink hover:text-ivory" onClick={onEnter}>
              {t("closing.demo")}
            </button>
          </nav>
        </footer>
      </div>
    </Room>
  );
}

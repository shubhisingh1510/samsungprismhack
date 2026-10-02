import type { ReactNode } from "react";
import { useLang, type Key } from "../i18n";

const TONES = {
  ivory: "var(--color-ivory)",
  blush: "var(--color-blush)",
  butter: "var(--color-butter)",
  sage: "var(--color-sage)",
  powder: "var(--color-powder)",
  lavender: "var(--color-lavender)",
  ink: "var(--color-ink)",
} as const;

export type Tone = keyof typeof TONES;

/** The small sign beside each doorway: which room you have just walked into. */
export function RoomMark({ n, name, light = false }: { n: string; name: Key; light?: boolean }) {
  const { t } = useLang();
  return (
    <p className="label flex items-center gap-3" style={{ color: light ? "var(--color-ivory)" : "var(--color-ink)", opacity: 0.72 }}>
      <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true">
        <path d="M1 17 V7 C1 3.5 3.5 1 7 1 C10.5 1 13 3.5 13 7 V17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {t("room")} {n}
      <span className="h-px w-8 bg-current opacity-50" />
      {t(name)}
    </p>
  );
}

/**
 * A section of the story. `from` is the colour of the room you are leaving: the top edge
 * is cut as a wide archway in that colour, so scrolling reads as walking through a door.
 */
export function Room({ id, tone, from, children, className = "" }: { id?: string; tone: Tone; from?: Tone; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative ${className}`} style={{ backgroundColor: TONES[tone], color: tone === "ink" ? TONES.ivory : TONES.ink }}>
      {from && (
        <svg className="block h-[9vw] max-h-[150px] min-h-[54px] w-full" viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden="true"
          style={{ backgroundColor: TONES[tone] }}>
          <path d="M0 0 H1440 V150 C1440 62 1180 0 720 0 C260 0 0 62 0 150 Z" fill={TONES[from]} />
        </svg>
      )}
      {children}
    </section>
  );
}

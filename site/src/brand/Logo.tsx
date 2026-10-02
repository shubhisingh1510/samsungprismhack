// The NEST mark: two curved strokes. The outer one shelters; the inner one is a doorway.
export const OUTER = "M10 50 C8 28 19 10.5 35 10.5 C46.5 10.5 54.5 19.5 54.5 32";
export const INNER = "M23.5 54 C22.5 44 24 33.5 31.5 30.5 C39.5 27.5 44.5 34 44.5 42 C44.5 46.5 44 50.5 43.5 54";

type SymbolProps = {
  size?: number;
  outer?: string;
  inner?: string;
  /** Fills the doorway with light: the "open door" state. */
  open?: boolean;
  className?: string;
};

export function NestSymbol({ size = 30, outer = "currentColor", inner = "var(--color-terracotta)", open = false, className }: SymbolProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M27 54 C26.5 45 27.5 37 32.5 34.5 C38 32 41 36.5 41 42 C41 46.5 40.5 50.5 40 54 Z"
        fill="var(--color-butter)"
        style={{ opacity: open ? 1 : 0, transition: "opacity 0.6s var(--ease-quiet)" }}
      />
      <g fill="none" strokeLinecap="round" strokeWidth={6.5}>
        <path stroke={outer} d={OUTER} />
        <path stroke={inner} d={INNER} />
      </g>
    </svg>
  );
}

export function Wordmark({ height = 14, color = "currentColor", className }: { height?: number; color?: string; className?: string }) {
  return (
    <svg height={height} viewBox="0 0 114 28" className={className} role="img" aria-label="NEST">
      <g fill="none" stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 24 V4.5 L20 23.5 V4" />
        <path d="M49 4.5 H36.5 V23.5 H49.5 M36.5 13.6 H46.5" />
        <path d="M78 7.5 C75.5 4 66 3 65.5 9 C65 15.5 78.5 12.5 78.5 19 C78.5 25 68 25 64.5 20.5" />
        <path d="M92 4.5 H110 M101 4.5 V24" />
      </g>
    </svg>
  );
}

export function Logo({ open = false, hideWord = false }: { open?: boolean; hideWord?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <NestSymbol size={30} open={open} />
      <span
        style={{
          opacity: hideWord ? 0 : 1,
          transform: hideWord ? "translateX(-6px)" : "none",
          transition: "opacity 0.5s var(--ease-quiet), transform 0.5s var(--ease-quiet)",
        }}
      >
        <Wordmark />
      </span>
    </span>
  );
}

// The NEST object library. Every scene on the site is composed from these, so the
// whole story is drawn in one hand: flat pastel shapes, a few ink lines, nothing glossy.
import type { ReactNode } from "react";

export const C = {
  ivory: "#FFF9F2",
  ink: "#292724",
  blush: "#F4DDE2",
  butter: "#F5E8B5",
  sage: "#DDE8D7",
  powder: "#DCEAF2",
  lavender: "#E6DDF0",
  terracotta: "#DCA58D",
  clay: "#C4826A",
  card: "#D8B48F",
  cardLight: "#E6CBAA",
  moss: "#A9BFA0",
  sky: "#A9C6D6",
  honey: "#E6CF7A",
  umber: "#6B5A4E",
  skin: "#C99A7A",
};

const line = { stroke: C.ink, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

/** Defined once per page: the soft halo behind a doorway. */
export function SharedDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>
    </svg>
  );
}

type At = { x?: number; y?: number; s?: number; r?: number; children?: ReactNode };

export function At({ x = 0, y = 0, s = 1, r = 0, children }: At) {
  return <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>{children}</g>;
}

/** The doorway: the one shape the whole product is built around. */
export function doorPath(w: number, h: number) {
  const r = w / 2;
  return `M0 ${h} V${r} C0 ${r * 0.42} ${r * 0.44} 0 ${r} 0 C${w - r * 0.44} 0 ${w} ${r * 0.42} ${w} ${r} V${h} Z`;
}

export function Door({ w = 200, h = 420, fill = C.butter, glow = true }: { w?: number; h?: number; fill?: string; glow?: boolean }) {
  return (
    <g>
      {glow && <path d={doorPath(w, h)} fill={fill} opacity={0.55} filter="url(#glow)" />}
      <path d={doorPath(w, h)} fill={fill} />
    </g>
  );
}

export function Box() {
  return (
    <g>
      <path d="M10 40 L-3 22 L38 24 L50 40 Z" fill={C.cardLight} />
      <path d="M90 40 L104 21 L61 24 L50 40 Z" fill={C.cardLight} />
      <path d="M10 40 H90 V94 H10 Z" fill={C.card} />
      <path d="M46 40 H55 V94 H46 Z" fill={C.cardLight} opacity={0.8} />
      <path d="M10 40 H90 V94 H10 Z M10 40 L-3 22 L38 24 L50 40 L61 24 L104 21 L90 40" {...line} />
    </g>
  );
}

export function Sneaker({ color = C.blush }: { color?: string }) {
  return (
    <g>
      <path d="M6 60 C5 46 16 40 28 43 L44 31 C50 26 58 30 60 39 C76 43 95 49 95 62 V68 H6 Z" fill={color} />
      <path d="M4 67 H97 C98 75 95 79 90 79 H10 C5 79 3 74 4 67 Z" fill={C.ivory} />
      <path d="M6 60 C5 46 16 40 28 43 L44 31 C50 26 58 30 60 39 C76 43 95 49 95 62 V68 M4 67 H97 C98 75 95 79 90 79 H10 C5 79 3 74 4 67 Z" {...line} />
      <path d="M40 40 L47 46 M46 36 L53 43 M52 34 L58 41" {...line} strokeWidth={1.8} />
    </g>
  );
}

export function Star({ fill = C.honey }: { fill?: string }) {
  return <path d="M0 -11 L3.2 -3.6 L11 -3 L5 2.2 L7 10 L0 5.8 L-7 10 L-5 2.2 L-11 -3 L-3.2 -3.6 Z" fill={fill} />;
}

export function Books({ colors = [C.sky, C.terracotta, C.moss] }: { colors?: string[] }) {
  return (
    <g>
      {colors.map((c, i) => {
        const y = 70 - i * 21;
        const dx = [0, 7, -4, 5][i % 4];
        return (
          <g key={i} transform={`translate(${dx} ${y})`}>
            <path d="M4 0 H96 V20 H4 Z" fill={c} />
            <path d="M88 3 H96 V17 H88 Z" fill={C.ivory} opacity={0.85} />
            <path d="M4 0 H96 V20 H4 Z M16 0 V20" {...line} />
          </g>
        );
      })}
    </g>
  );
}

export function Pot() {
  return (
    <g>
      <path d="M52 30 L84 -6" {...line} strokeWidth={5} stroke={C.card} />
      <path d="M20 40 H82 V72 C82 82 74 88 64 88 H38 C28 88 20 82 20 72 Z" fill={C.sky} />
      <path d="M16 34 H86 V42 H16 Z" fill={C.powder} />
      <path d="M20 42 V72 C20 82 28 88 38 88 H64 C74 88 82 82 82 72 V42 M16 34 H86 V42 H16 Z M20 52 H10 M82 52 H92 M46 34 C46 28 56 28 56 34" {...line} />
    </g>
  );
}

export function Telescope({ stroke = C.ink }: { stroke?: string }) {
  return (
    <g>
      <path d="M50 52 L28 110 M50 52 L72 110 M50 52 L52 112" {...line} stroke={stroke} />
      <g transform="rotate(-28 50 50)">
        <path d="M6 40 H74 V60 H6 Z" fill={C.terracotta} />
        <path d="M74 36 H96 V64 H74 Z" fill={C.clay} />
        <path d="M-2 44 H6 V56 H-2 Z" fill={C.ink} />
        <path d="M6 40 H74 V60 H6 Z M74 36 H96 V64 H74 Z M40 40 V60" {...line} stroke={stroke} />
      </g>
    </g>
  );
}

export function Plant({ pot = C.terracotta, stroke = C.ink }: { pot?: string; stroke?: string }) {
  return (
    <g>
      <path d="M50 70 C48 50 40 34 26 22 M50 70 C52 46 58 28 72 14 M50 70 C50 52 50 36 48 6" {...line} stroke={stroke} />
      <path d="M26 22 C14 20 8 28 8 36 C20 38 28 32 26 22 Z" fill={C.moss} />
      <path d="M72 14 C84 10 92 18 92 28 C80 30 70 26 72 14 Z" fill={C.moss} />
      <path d="M48 6 C40 -2 44 -12 52 -16 C58 -8 56 2 48 6 Z" fill={C.sage} />
      <path d="M38 40 C28 40 24 48 26 54 C36 54 42 48 38 40 Z" fill={C.sage} />
      <path d="M62 36 C72 34 78 42 76 48 C66 50 60 44 62 36 Z" fill={C.sage} />
      <path d="M28 68 H72 L66 104 H34 Z" fill={pot} />
      <path d="M28 68 H72 L66 104 H34 Z M26 68 H74" {...line} stroke={stroke} />
    </g>
  );
}

export function Tape() {
  return (
    <g>
      <ellipse cx="30" cy="30" rx="28" ry="26" fill={C.butter} />
      <ellipse cx="30" cy="30" rx="13" ry="12" fill={C.ivory} />
      <path d="M58 30 C58 44 46 56 30 56 C14 56 2 44 2 30 C2 16 14 4 30 4 C46 4 58 16 58 30 Z M43 30 C43 37 37 42 30 42 C23 42 17 37 17 30 C17 23 23 18 30 18 C37 18 43 23 43 30 Z M56 40 L78 46 L76 56 L50 50" {...line} />
    </g>
  );
}

/** A cardboard bridge resting on two stacks of books. */
export function Bridge({ load = 0 }: { load?: number }) {
  return (
    <g>
      <At x={0} y={40} s={0.9}><Books colors={[C.sky, C.blush]} /></At>
      <At x={250} y={40} s={0.9}><Books colors={[C.moss, C.butter]} /></At>
      <path d="M40 52 C120 18 220 18 300 52 L300 66 C220 34 120 34 40 66 Z" fill={C.card} />
      <path d="M40 52 C120 18 220 18 300 52 L300 66 C220 34 120 34 40 66 Z M95 36 L99 49 M170 27 V41 M245 36 L241 49" {...line} />
      {Array.from({ length: load }).map((_, i) => (
        <g key={i} transform={`translate(${128 + (i % 2) * 6} ${10 - i * 15}) scale(0.82)`}>
          <path d="M4 0 H96 V17 H4 Z" fill={[C.terracotta, C.lavender, C.sky, C.butter][i % 4]} />
          <path d="M4 0 H96 V17 H4 Z M16 0 V17" {...line} />
        </g>
      ))}
    </g>
  );
}

export function Saturn({ r = 34 }: { r?: number }) {
  return (
    <g>
      <path d={`M${-r * 1.9} ${r * 0.3} C${-r * 1.2} ${-r * 0.5} ${r * 1.2} ${-r * 0.9} ${r * 1.9} ${-r * 0.3}`} {...line} stroke={C.butter} strokeWidth={3} />
      <circle r={r} fill={C.honey} />
      <path d={`M${-r * 0.9} ${-r * 0.25} C${-r * 0.3} ${-r * 0.5} ${r * 0.4} ${-r * 0.5} ${r * 0.95} ${-r * 0.3}`} fill="none" stroke={C.butter} strokeWidth={4} strokeLinecap="round" />
      <path d={`M${-r * 1.9} ${r * 0.3} C${-r * 1.4} ${r * 0.9} ${r * 1.5} ${r * 0.5} ${r * 1.9} ${-r * 0.3}`} {...line} stroke={C.butter} strokeWidth={3} />
    </g>
  );
}

// ------------------------------------------------------------------ people
export function ChildSitting({ sweater = C.terracotta }: { sweater?: string }) {
  return (
    <g>
      {/* cross-legged: thigh out to the knee, shin folded back, a sock at the end */}
      <path d="M46 92 L96 95" fill="none" stroke="#4A4541" strokeWidth={18} strokeLinecap="round" />
      <path d="M96 97 L62 106" fill="none" stroke="#4A4541" strokeWidth={14} strokeLinecap="round" />
      <ellipse cx="54" cy="107" rx="10" ry="6" fill={C.ivory} stroke={C.ink} strokeWidth={1.6} />
      <path d="M36 92 C33 68 40 50 55 50 C70 50 76 66 74 92 Z" fill={sweater} />
      <path d="M62 60 C74 66 82 76 86 88" fill="none" stroke={sweater} strokeWidth={11} strokeLinecap="round" />
      <circle cx="87" cy="90" r="5.5" fill={C.skin} />
      <circle cx="58" cy="34" r="15" fill={C.skin} />
      <path d="M42 34 C39 20 50 13 60 14 C71 15 77 24 74 33 C68 26 56 25 46 33 Z" fill={C.umber} />
      <circle cx="66" cy="35" r="1.4" fill={C.ink} />
    </g>
  );
}

export function ChildJumping({ sweater = C.terracotta }: { sweater?: string }) {
  const limb = { fill: "none", strokeLinecap: "round" as const, strokeWidth: 12 };
  return (
    <g>
      <path d="M50 84 L24 124" {...limb} stroke={C.sky} />
      <path d="M62 84 L92 118" {...limb} stroke={C.sky} />
      <path d="M17 122 L32 130" {...limb} stroke={C.ink} strokeWidth={9} />
      <path d="M88 122 L103 114" {...limb} stroke={C.ink} strokeWidth={9} />
      <path d="M44 52 L16 22" {...limb} stroke={sweater} />
      <path d="M68 52 L98 26" {...limb} stroke={sweater} />
      <circle cx="13" cy="18" r="6" fill={C.skin} />
      <circle cx="101" cy="22" r="6" fill={C.skin} />
      <path d="M40 46 H72 L68 90 H44 Z" fill={sweater} />
      <circle cx="56" cy="26" r="15" fill={C.skin} />
      <path d="M40 27 C37 13 48 6 58 7 C69 8 75 17 72 26 C66 19 54 18 44 26 Z" fill={C.umber} />
      <path d="M51 31 C54 34 58 34 61 31" fill="none" stroke={C.ink} strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

// ----------------------------------------------------------------- devices
export function TV({ w = 320, h = 190, children, on = true }: { w?: number; h?: number; children?: ReactNode; on?: boolean }) {
  return (
    <g>
      <path d={`M${w / 2 - 46} ${h + 14} H${w / 2 + 46} M${w / 2} ${h} V${h + 14}`} {...line} strokeWidth={5} />
      <rect width={w} height={h} rx={10} fill={C.ink} />
      <rect x={9} y={9} width={w - 18} height={h - 18} rx={4} fill={on ? C.powder : "#3a3733"} />
      <svg x={9} y={9} width={w - 18} height={h - 18} viewBox={`0 0 ${w - 18} ${h - 18}`} overflow="hidden">
        {children}
      </svg>
    </g>
  );
}

export function Phone({ w = 86, h = 172, children, screen = C.ivory }: { w?: number; h?: number; children?: ReactNode; screen?: string }) {
  return (
    <g>
      <rect width={w} height={h} rx={16} fill={C.ink} />
      <rect x={5} y={5} width={w - 10} height={h - 10} rx={12} fill={screen} />
      <circle cx={w / 2} cy={13} r={2.4} fill={C.ink} />
      <svg x={5} y={5} width={w - 10} height={h - 10} viewBox={`0 0 ${w - 10} ${h - 10}`} overflow="hidden">
        {children}
      </svg>
    </g>
  );
}

export function Watch({ children, screen = C.ink }: { children?: ReactNode; screen?: string }) {
  return (
    <g>
      <path d="M22 -20 H58 L54 6 H26 Z M26 74 H54 L58 100 H22 Z" fill={C.terracotta} />
      <rect x={10} y={2} width={60} height={76} rx={20} fill={C.ink} />
      <rect x={15} y={7} width={50} height={66} rx={16} fill={screen} />
      <path d="M70 30 H74 V44 H70" {...line} />
      <svg x={15} y={7} width={50} height={66} viewBox="0 0 50 66" overflow="hidden">
        {children}
      </svg>
    </g>
  );
}

export function Lamp({ on = false, height = 250 }: { on?: boolean; height?: number }) {
  return (
    <g>
      <path
        d={`M12 62 L-70 ${height + 6} H150 L68 62 Z`}
        fill={C.butter}
        style={{ opacity: on ? 0.75 : 0, transition: "opacity 1.6s var(--ease-quiet)" }}
      />
      <path d={`M40 62 V${height} M14 ${height} H66`} {...line} strokeWidth={4} />
      <path d="M14 8 H66 L80 62 H0 Z" fill={on ? C.honey : C.cardLight} style={{ transition: "fill 1.6s var(--ease-quiet)" }} />
      <path d="M14 8 H66 L80 62 H0 Z" {...line} />
    </g>
  );
}

export function Speaker({ on = false }: { on?: boolean }) {
  return (
    <g>
      <rect width={52} height={74} rx={14} fill={C.umber} />
      <circle cx={26} cy={48} r={14} fill={C.ink} />
      <circle cx={26} cy={18} r={6} fill={C.ink} />
      <g style={{ opacity: on ? 1 : 0, transition: "opacity 1s var(--ease-quiet)" }}>
        <path d="M62 30 C68 36 68 46 62 52 M72 22 C82 32 82 50 72 60" {...line} stroke={C.clay} />
      </g>
    </g>
  );
}

export function Fridge() {
  return (
    <g>
      <rect width={120} height={250} rx={12} fill={C.powder} />
      <path d="M0 96 H120" {...line} />
      <path d="M100 30 V70 M100 116 V176" {...line} strokeWidth={5} />
      <rect width={120} height={250} rx={12} {...line} />
      <rect x={18} y={24} width={34} height={26} fill={C.butter} transform="rotate(-4 35 37)" />
      <rect x={24} y={58} width={22} height={22} fill={C.blush} transform="rotate(5 35 69)" />
    </g>
  );
}

export function House({ lit = false }: { lit?: boolean }) {
  const pane = lit ? C.honey : C.powder;
  return (
    <g>
      <path d="M20 120 L160 24 L300 120 V300 H20 Z" fill={C.ivory} />
      <path d="M2 128 L160 18 L318 128" {...line} strokeWidth={5} stroke={C.clay} />
      <path d="M20 120 V300 H300 V120" {...line} />
      <path d="M232 70 V34 H258 V88" fill={C.terracotta} />
      <path d="M232 70 V34 H258 V88" {...line} />
      <path d={doorPath(64, 118)} transform="translate(128 182)" fill={C.terracotta} />
      <path d={doorPath(64, 118)} transform="translate(128 182)" {...line} />
      <circle cx="180" cy="246" r="3" fill={C.ink} />
      {[52, 222].map((x) => (
        <g key={x} transform={`translate(${x} 160)`}>
          <rect width={52} height={58} fill={pane} style={{ transition: "fill 1.2s var(--ease-quiet)" }} />
          <path d="M0 0 H52 V58 H0 Z M26 0 V58 M0 29 H52" {...line} />
        </g>
      ))}
    </g>
  );
}

export function Cloud({ fill = C.powder }: { fill?: string }) {
  return (
    <g>
      <path d="M22 60 C4 60 0 40 16 34 C14 16 38 8 48 22 C58 6 86 12 84 34 C102 34 104 60 84 60 Z" fill={fill} />
      <path d="M22 60 C4 60 0 40 16 34 C14 16 38 8 48 22 C58 6 86 12 84 34 C102 34 104 60 84 60 Z" {...line} />
    </g>
  );
}

/** A paper-like blob used as ground under a scene. */
export function Ground({ w = 600, fill = C.sage }: { w?: number; fill?: string }) {
  return <path d={`M0 22 C${w * 0.2} 2 ${w * 0.45} 8 ${w * 0.62} 4 C${w * 0.8} 0 ${w * 0.95} 10 ${w} 26 C${w * 0.9} 48 ${w * 0.6} 52 ${w * 0.4} 50 C${w * 0.2} 52 ${w * 0.05} 44 0 22 Z`} fill={fill} />;
}

import { Reveal } from "../components/Reveal";
import { Room } from "../components/Room";
import { rich, useLang } from "../i18n";
import { At, C, Cloud } from "../illustrations/objects";

const ink = { stroke: C.ink, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const tag = { fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, letterSpacing: "0.16em", fill: C.ink, textAnchor: "middle" as const };

export function Privacy() {
  const { t } = useLang();
  return (
    <Room id="privacy" tone="sage" from="powder">
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 items-center gap-12 px-6 pt-[6vh] pb-[14vh] md:px-12 lg:grid-cols-12">
        <Reveal className="lg:order-2 lg:col-span-5 lg:col-start-8">
          <p className="label opacity-55">{t("privacy.label")}</p>
          <h2 className="display mt-5 text-[clamp(2.8rem,6.4vw,6.4rem)]">
            {rich(t("privacy.title"))}
          </h2>
          <p className="lede mt-8 opacity-75">{t("privacy.lede")}</p>
          <p className="mt-6 max-w-[42ch] text-[0.85rem] opacity-60">
            {t("privacy.note")}
          </p>
        </Reveal>

        <Reveal delay={0.1} className="lg:order-1 lg:col-span-7 lg:row-start-1">
          <svg viewBox="0 0 760 560" className="w-full" role="img"
            aria-label="A house containing four things: voice, screen, camera and watch. A soft dashed line surrounds the house. The internet is a small cloud outside it, and the path from the cloud stops at the line.">
            {/* the soft boundary */}
            <path d="M92 318 C70 190 190 60 370 62 C540 64 640 180 640 320 C640 458 548 536 372 538 C200 540 110 450 92 318 Z"
              fill={C.ivory} opacity={0.55} />
            <path d="M92 318 C70 190 190 60 370 62 C540 64 640 180 640 320 C640 458 548 536 372 538 C200 540 110 450 92 318 Z"
              {...ink} stroke={C.clay} strokeDasharray="3 13" strokeWidth={3.4} />

            <g>
              <path d="M200 270 L370 150 L540 270 V490 H200 Z" fill={C.ivory} />
              <path d="M178 284 L370 146 L562 284" {...ink} stroke={C.clay} strokeWidth={5} />
              <path d="M200 270 V490 H540 V270" {...ink} />

              {/* voice */}
              <g transform="translate(262 290)">
                <path d="M0 14 C0 2 22 2 22 14 V30 C22 42 0 42 0 30 Z" fill={C.blush} />
                <path d="M0 14 C0 2 22 2 22 14 V30 C22 42 0 42 0 30 Z M-8 30 C-8 52 30 52 30 30 M11 48 V58" {...ink} />
              </g>
              {/* screen */}
              <g transform="translate(418 294)">
                <rect width={62} height={40} rx={4} fill={C.powder} />
                <path d="M0 0 H62 V40 H0 Z M20 52 H42 M31 40 V52" {...ink} />
              </g>
              {/* camera */}
              <g transform="translate(254 408)">
                <rect width={44} height={32} rx={5} fill={C.butter} />
                <circle cx={22} cy={16} r={8} fill={C.ivory} />
                <path d="M0 5 C0 2 2 0 5 0 H39 C42 0 44 2 44 5 V27 C44 30 42 32 39 32 H5 C2 32 0 30 0 27 Z M30 16 A8 8 0 1 1 14 16 A8 8 0 1 1 30 16" {...ink} />
              </g>
              {/* watch */}
              <g transform="translate(432 404)">
                <path d="M8 -6 H28 V4 H8 Z M8 44 H28 V52 H8 Z" fill={C.terracotta} />
                <rect y={2} width={36} height={44} rx={10} fill={C.lavender} />
                <rect y={2} width={36} height={44} rx={10} {...ink} />
              </g>
            </g>
            <text x={273} y={372} {...tag}>{t("privacy.voice").toUpperCase()}</text>
            <text x={449} y={372} {...tag}>{t("privacy.screen").toUpperCase()}</text>
            <text x={276} y={476} {...tag}>{t("privacy.camera").toUpperCase()}</text>
            <text x={450} y={476} {...tag}>{t("privacy.watch").toUpperCase()}</text>

            {/* outside */}
            <g><At x={636} y={36} s={1.05}><Cloud fill={C.ivory} /></At></g>
            <text x={690} y={126} {...tag} opacity={0.6}>{t("privacy.internet").toUpperCase()}</text>
            <path d="M650 104 C632 126 618 146 606 168" {...ink} strokeDasharray="1 9" opacity={0.5} />
            <path d="M598 164 L612 176" {...ink} strokeWidth={3} />
          </svg>
        </Reveal>
      </div>
    </Room>
  );
}

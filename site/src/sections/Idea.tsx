import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Room, RoomMark } from "../components/Room";
import { rich, useLang } from "../i18n";
import { At, C, Door, Star } from "../illustrations/objects";

/**
 * The product's one metaphor, told by scrolling: an ordinary video on an ordinary TV
 * becomes a doorway, and the doorway outgrows the TV.
 */
export function Idea() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const video = useTransform(p, [0.12, 0.4], [1, 0]);
  const door = useTransform(p, [0.14, 0.5, 0.9], [0, 1, 2]);
  const first = useTransform(p, [0.42, 0.56], [1, 0.18]);
  const second = useTransform(p, [0.5, 0.64], [0, 1]);
  const secondY = useTransform(p, [0.5, 0.64], [16, 0]);
  const stars = useTransform(p, [0.66, 0.86], [0, 1]);
  const { t } = useLang();

  return (
    <Room id="idea" tone="blush" from="ivory">
      <div ref={ref} className="relative h-[260vh]">
        <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden">
          <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 items-center gap-6 px-6 pt-24 pb-8 md:px-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <RoomMark n="02" name="room.door" />
              <motion.h2 style={{ opacity: first }} className="display mt-8 text-[clamp(2.6rem,6.4vw,6.4rem)]">
                {rich(t("idea.one"))}
              </motion.h2>
              <motion.h2 style={{ opacity: second, y: secondY }} className="display mt-5 text-[clamp(2.6rem,6.4vw,6.4rem)]">
                {rich(t("idea.two"))}
              </motion.h2>
            </div>

            <div className="relative h-[46svh] lg:col-span-7 lg:h-[78svh]">
              <svg viewBox="0 0 900 760" className="h-full w-full overflow-visible" role="img"
                aria-label="A television showing an ordinary video. As you scroll, the picture turns into a doorway of light that grows taller than the television.">
                <g>
                  <path d="M330 640 H570 M450 600 V640" stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
                  <rect x={120} y={230} width={660} height={372} rx={14} fill={C.ink} />
                </g>
                <rect x={136} y={246} width={628} height={340} rx={5} fill={C.butter} />
                <motion.g style={{ opacity: video }}>
                  <svg x={136} y={246} width={628} height={340} viewBox="0 0 628 340" overflow="hidden">
                    <rect width={628} height={340} fill={C.powder} />
                    <circle cx={470} cy={104} r={44} fill={C.butter} />
                    <path d="M0 250 C90 190 170 220 270 200 C380 178 470 232 628 196 V340 H0 Z" fill={C.moss} />
                    <path d="M0 290 C140 250 260 280 400 262 C500 250 560 276 628 262 V340 H0 Z" fill={C.sage} />
                    <path d="M40 312 H588" stroke={C.ivory} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
                    <path d="M40 312 H250" stroke={C.ivory} strokeWidth={4} strokeLinecap="round" />
                    <path d="M298 150 L344 176 L298 202 Z" fill={C.ivory} />
                  </svg>
                </motion.g>

                {/* the doorway stands on the bottom edge of the screen and grows from there */}
                <motion.g style={{ scale: door, originX: 0.5, originY: 1 }}>
                  <At x={356} y={300}><Door w={188} h={286} /></At>
                </motion.g>
                <motion.g style={{ opacity: stars }}>
                  <At x={420} y={130} s={1.6}><Star fill={C.ivory} /></At>
                  <At x={500} y={250} s={1.1}><Star fill={C.ivory} /></At>
                  <At x={390} y={360} s={0.8}><Star fill={C.ivory} /></At>
                  <At x={96} y={150} s={1.3}><Star fill={C.terracotta} /></At>
                  <At x={820} y={96} s={1}><Star fill={C.terracotta} /></At>
                </motion.g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </Room>
  );
}

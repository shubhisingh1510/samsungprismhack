import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "../components/Reveal";
import { Room, RoomMark } from "../components/Room";
import { rich, useLang } from "../i18n";
import { At, C, Fridge, Lamp, Phone, Plant, Speaker, TV, Watch } from "../illustrations/objects";

const ink = { stroke: C.ink, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const slow = { transition: "all 1.6s var(--ease-quiet)" };

/** Everything NEST can reach, drawn where it actually lives in a home. */
function HomeScene({ awake }: { awake: boolean }) {
  const { t } = useLang();
  const show = { opacity: awake ? 1 : 0, ...slow };
  return (
    <svg viewBox="0 0 1240 610" className="w-full" role="img"
      aria-label={awake
        ? "A living room. The lamp glows warm, the speaker plays birdsong, the television reads Adventure unlocked, the phone reads Ready, and the watch reads Let's move."
        : "A quiet living room with a fridge, a television, a speaker, a lamp, a phone on the sofa and a watch on a side table."}>
      <rect x={30} y={24} width={1180} height={520} rx={6} fill={awake ? "#FAEFCB" : "#F1EEE8"} style={slow} />
      <path d="M30 544 H1210 V600 H30 Z" fill={C.cardLight} />
      <path d="M30 544 H1210" {...ink} />

      <g>
        <At x={78} y={294}><Fridge /></At>
        <At x={214} y={420} s={1.1}><Plant /></At>

        {/* console, television, speaker */}
        <path d="M356 470 H800 V520 H356 Z" fill={C.card} />
        <path d="M356 470 H800 V520 H356 Z M380 520 V544 M776 520 V544" {...ink} />
        <At x={410} y={230}>
          <TV w={320} h={196} on={awake}>
            <g style={show}>
              <rect width={302} height={178} fill={C.butter} />
              <text x={151} y={82} textAnchor="middle" fontFamily="var(--font-serif)" fontSize={30} fill={C.ink}>{t("home.tv1")}</text>
              <text x={151} y={116} textAnchor="middle" fontFamily="var(--font-serif)" fontStyle="italic" fontSize={30} fill={C.ink}>{t("home.tv2")}</text>
            </g>
          </TV>
        </At>
        <At x={738} y={396}><Speaker on={awake} /></At>

        <At x={846} y={292}><Lamp on={awake} height={252} /></At>

        {/* sofa, with the phone left on its arm */}
        <path d="M950 392 C950 366 972 356 996 356 H1150 C1176 356 1190 372 1190 396 V520 H950 Z" fill={C.terracotta} />
        <path d="M934 446 C934 428 968 428 968 446 V528 H934 Z M1172 446 C1172 428 1206 428 1206 446 V528 H1172 Z" fill={C.clay} />
        <path d="M968 462 H1172 V520 H968 Z" fill={C.blush} />
        <path d="M950 392 C950 366 972 356 996 356 H1150 C1176 356 1190 372 1190 396 M968 462 H1172" {...ink} />
        <At x={1010} y={318} s={0.92} r={-8}>
          <Phone w={84} h={160} screen={awake ? C.ivory : "#3a3733"}>
            <g style={show}>
              <text x={37} y={82} textAnchor="middle" fontFamily="var(--font-serif)" fontSize={18} fill={C.ink}>{t("home.phone")}</text>
            </g>
          </Phone>
        </At>
      </g>

      {/* the watch, left on the sofa beside the phone */}
      <g>
        <At x={1104} y={352} s={0.98} r={7}>
          <Watch screen={C.ink}>
            <g style={show}>
              <text x={25} y={30} textAnchor="middle" fontFamily="var(--font-serif)" fontSize={13} fill={C.ivory}>{t("home.watch1")}</text>
              <text x={25} y={46} textAnchor="middle" fontFamily="var(--font-serif)" fontStyle="italic" fontSize={13} fill={C.ivory}>{t("home.watch2")}</text>
            </g>
          </Watch>
        </At>
      </g>

      {/* birdsong, written the way a picture book would write it */}
      <g style={show} fontFamily="var(--font-serif)" fontStyle="italic" fill={C.clay}>
        <text x={752} y={378} fontSize={20} transform="rotate(-10 752 378)">{t("home.tweet")}</text>
        <text x={790} y={350} fontSize={15} transform="rotate(8 790 350)">{t("home.tweet")}</text>
      </g>
    </svg>
  );
}

export function Home() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { amount: 0.6, once: true });
  const [awake, setAwake] = useState(false);
  const { t } = useLang();

  // The room wakes shortly after you walk in. The switch lets you do it yourself.
  useEffect(() => {
    if (!seen) return;
    const timer = setTimeout(() => setAwake(true), 900);
    return () => clearTimeout(timer);
  }, [seen]);

  return (
    <Room id="home" tone="ivory" from="blush">
      <div className="mx-auto max-w-[1500px] px-6 pt-[6vh] pb-[14vh] md:px-12">
        <RoomMark n="04" name="room.home" />
        <div className="mt-[8vh] grid grid-cols-1 items-end gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-8">
            <h2 className="display text-[clamp(2.6rem,6.4vw,6.4rem)]">
              {rich(t("home.title"))}
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-4">
            <p className="lede opacity-70">{t("home.lede")}</p>
          </Reveal>
        </div>

        <p className="mt-10 text-[0.8rem] opacity-55 md:hidden">{t("home.swipe")}</p>
        <div ref={ref} className="mt-3 overflow-x-auto md:mt-12">
          <div className="min-w-[760px]"><HomeScene awake={awake} /></div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-6">
          <button
            className="group flex items-center gap-4 text-left"
            onClick={() => setAwake((a) => !a)}
            aria-pressed={awake}
          >
            {/* a wall switch, because that is how you change a room */}
            <span className="relative block h-[52px] w-[34px] rounded-[7px] bg-ivory shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
              <span
                className="absolute left-[7px] h-[20px] w-[20px] rounded-[4px] bg-ink transition-[top] duration-500"
                style={{ top: awake ? 6 : 26 }}
              />
            </span>
            <span>
              <span className="label block opacity-55">{t(awake ? "home.awake.label" : "home.asleep.label")}</span>
              <span className="text-[0.95rem]">{t(awake ? "home.awake.text" : "home.asleep.text")}</span>
            </span>
          </button>
          <p className="max-w-[40ch] text-[0.85rem] opacity-55">{t("home.note")}</p>
        </div>
      </div>
    </Room>
  );
}

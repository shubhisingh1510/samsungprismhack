import { AnimatePresence, LayoutGroup, animate, motion, useInView, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { NestSymbol } from "../brand/Logo";
import { rich, useLang, type Key } from "../i18n";
import { Reveal } from "../components/Reveal";
import { Room } from "../components/Room";
import { At, Bridge, C, Tape } from "../illustrations/objects";

type Phase = "idle" | "playing" | "pause" | "quest";

const BREAK = 0.58;            // where the natural pause falls on the timeline
const LENGTH = 330;            // the pretend video is 5:30 long
const CAPTIONS: [number, Key][] = [[0, "living.cap1"], [0.2, "living.cap2"], [0.4, "living.cap3"]];
const STEPS: Key[] = ["living.step1", "living.step2", "living.step3"];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const ease = [0.22, 0.61, 0.36, 1] as const;

function Film({ load, caption }: { load: number; caption: string }) {
  return (
    <svg viewBox="0 0 800 450" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={800} height={450} fill={C.butter} />
      <path d="M0 330 H800 V450 H0 Z" fill={C.cardLight} />
      <g>
        <At x={228} y={224}><Bridge load={load} /></At>
        <At x={610} y={292} s={0.9}><Tape /></At>
      </g>
      <text x={400} y={408} textAnchor="middle" fill={C.ink} fontFamily="var(--font-sans)" fontSize={19} fontWeight={500}>{caption}</text>
    </svg>
  );
}

function QuestSlip({ big, onGo }: { big: boolean; onGo?: () => void }) {
  const { t } = useLang();
  return (
    <motion.div
      layoutId="quest"
      transition={{ duration: 0.9, ease }}
      className="paper relative overflow-hidden text-ink"
      style={{ borderRadius: 6 }}
    >
      {/* the perforated edge of a ticket: this is something to tear off and take away */}
      <div className="absolute inset-y-0 left-0 w-3 border-r border-dashed border-ink/25 bg-butter" />
      <motion.div layout="position" className={big ? "p-8 pl-12 md:p-12 md:pl-16" : "p-5 pl-9"}>
        <p className="label flex items-center gap-2 opacity-70"><NestSymbol size={16} /> {t("living.ticket")}</p>
        <h3 className={`display mt-3 uppercase ${big ? "text-[clamp(2.6rem,5.4vw,5rem)]" : "text-[2rem]"}`}>{t("living.quest")}</h3>
        <p className={`mt-2 ${big ? "text-[1.05rem]" : "text-[0.9rem]"} opacity-75`}>{t("living.meta")}</p>
        {big ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.8 }}>
            <ol className="mt-8 max-w-[38ch] space-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className="flex gap-4"><span className="display text-[1.5rem] leading-none text-clay">{i + 1}</span><span>{t(s)}</span></li>
              ))}
            </ol>
            <div className="mt-8 flex items-center gap-6">
              <span className="display text-[2.4rem] tabular-nums">10:00</span>
              <span className="text-[0.9rem] opacity-65">{t("living.show")}</span>
            </div>
          </motion.div>
        ) : (
          <button className="btn btn-ink mt-5 !py-2.5" onClick={onGo}>{t("living.go")}</button>
        )}
      </motion.div>
    </motion.div>
  );
}

export function LivingVideo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { amount: 0.55, once: true });
  const [phase, setPhase] = useState<Phase>("idle");
  const { t } = useLang();
  const [caption, setCaption] = useState<Key>(CAPTIONS[0][1]);
  const [load, setLoad] = useState(0);
  const [time, setTime] = useState("0:00");
  const pos = useMotionValue(0);
  const width = useTransform(pos, (v) => `${v * 100}%`);

  useMotionValueEvent(pos, "change", (v) => {
    setCaption([...CAPTIONS].reverse().find(([at]) => v >= at)![1]);
    setLoad(v < 0.2 ? 0 : Math.min(3, Math.floor((v - 0.2) / 0.12)));
    setTime(clock(v * LENGTH));
  });

  const play = () => {
    pos.set(0);
    setPhase("playing");
  };

  useEffect(() => {
    if (seen && phase === "idle") play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  useEffect(() => {
    if (phase !== "playing") return;
    const run = animate(pos, BREAK, { duration: 8, ease: "linear", onComplete: () => setPhase("pause") });
    return () => run.stop();
  }, [phase, pos]);

  const quest = phase === "quest";

  return (
    <Room id="living" tone="ivory" from="blush">
      <div className="mx-auto max-w-[1500px] px-6 pt-[8vh] pb-[16vh] md:px-12">
        <Reveal className="max-w-[60rem]">
          <p className="label opacity-55">{t("living.label")}</p>
          <h2 className="display mt-5 text-[clamp(2.4rem,5.6vw,5.4rem)]">
            {rich(t("living.title"))}
          </h2>
        </Reveal>

        <LayoutGroup>
          <div ref={ref} className={`mt-14 grid items-start gap-8 ${quest ? "lg:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)]" : "grid-cols-1"}`}>
            <motion.div layout transition={{ duration: 0.9, ease }} className={quest ? "" : "mx-auto w-full max-w-[1080px]"}>
              <motion.p layout="position" className="label mb-3 opacity-55">{quest ? t("living.watch") : " "}</motion.p>
              <motion.div layout transition={{ duration: 0.9, ease }} className={`relative overflow-hidden bg-ink ${quest ? "aspect-video" : "aspect-[4/5] sm:aspect-video"}`} style={{ borderRadius: 10 }}>
                <div className="absolute inset-[10px] overflow-hidden" style={{ borderRadius: 4 }}>
                  <Film load={load} caption={phase === "pause" ? "" : t(caption)} />
                  <motion.div className="absolute inset-0 bg-ink" animate={{ opacity: phase === "pause" ? 0.8 : quest ? 0.5 : 0 }} transition={{ duration: 1 }} />

                  <AnimatePresence>
                    {phase === "pause" && (
                      <motion.div className="absolute inset-0 flex flex-col justify-between p-[5%] text-ivory" exit={{ opacity: 0 }}>
                        <div>
                          <motion.p className="label" initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 0.5, duration: 0.8 }}>
                            {t("living.pause")}
                          </motion.p>
                          <motion.p className="display mt-3 text-[clamp(1.7rem,4.4vw,4rem)]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.9, ease }}>
                            {t("living.ask")}
                          </motion.p>
                        </div>
                        <motion.div className="w-[min(300px,74%)] self-end" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.3, duration: 0.8, ease }}>
                          <QuestSlip big={false} onGo={() => setPhase("quest")} />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {phase === "idle" && (
                    <button className="absolute inset-0 grid place-items-center" onClick={play} aria-label="Play the video">
                      <span className="grid h-16 w-16 place-items-center rounded-full bg-ivory"><svg width="18" height="20" viewBox="0 0 18 20"><path d="M2 1 L17 10 L2 19 Z" fill={C.ink} /></svg></span>
                    </button>
                  )}
                </div>
              </motion.div>

              {/* quiet controls: a line, a notch where the pause falls, the time */}
              <motion.div layout="position" className="mt-4 flex items-center gap-4 text-[0.82rem] tabular-nums">
                <span className="w-9">{time}</span>
                <div className="relative h-px flex-1 bg-ink/20">
                  <motion.div className="absolute inset-y-[-0.5px] left-0 bg-ink" style={{ width, height: 2 }} />
                  <span className="absolute top-[-5px] h-[11px] w-px bg-clay" style={{ left: `${BREAK * 100}%` }} title={t("living.pause")} />
                </div>
                <span className="opacity-55">{clock(LENGTH)}</span>
              </motion.div>
              {!quest && (
                <p className="mt-3 text-[0.82rem] opacity-55">
                  {t("living.mark")}
                </p>
              )}
            </motion.div>

            {quest && (
              <div>
                <motion.p className="label mb-3 text-clay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>{t("living.do")}</motion.p>
                <QuestSlip big />
                <motion.button className="link mt-6 text-[0.88rem] opacity-70" initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 1.2 }} onClick={play}>
                  {t("living.again")}
                </motion.button>
              </div>
            )}
          </div>
        </LayoutGroup>
      </div>
    </Room>
  );
}

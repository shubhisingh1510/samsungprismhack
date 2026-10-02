import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NestSymbol } from "../brand/Logo";
import { useLang, type Key } from "../i18n";
import { At, Bridge, C, Lamp, Watch } from "../illustrations/objects";
import { FilmPlayer, STILLS, type Shot } from "../sections/Creator";
import { INITIAL, createDriver, type DemoState, type Driver } from "./drivers";

const ease = [0.22, 0.61, 0.36, 1] as const;

function Tag({ live }: { live: boolean }) {
  const { t } = useLang();
  return (
    <span className="label rounded-full px-2 py-[3px]" style={live
      ? { background: C.ink, color: C.ivory }
      : { boxShadow: `inset 0 0 0 1px ${C.ink}`, opacity: 0.7 }}>
      {t(live ? "demo.live" : "demo.simulated")}
    </span>
  );
}

function Device({ name, live, children, className = "" }: { name: string; live: boolean; children: ReactNode; className?: string }) {
  return (
    <figure className={`flex flex-col items-center ${className}`}>
      {children}
      <figcaption className="mt-3 flex items-center gap-2 text-[0.8rem]">
        <span className="font-medium">{name}</span>
        <Tag live={live} />
      </figcaption>
    </figure>
  );
}

function Fade({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <motion.div key={id} className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease }}>
      {children}
    </motion.div>
  );
}

function VideoStill({ dim }: { dim: boolean }) {
  return (
    <div className="relative overflow-hidden" style={{ borderRadius: 6 }}>
      <svg viewBox="0 0 400 230" className="block w-full" aria-hidden="true">
        <rect width={400} height={230} fill={C.butter} />
        <path d="M0 172 H400 V230 H0 Z" fill={C.cardLight} />
        <At x={72} y={104} s={0.74}><Bridge load={1} /></At>
      </svg>
      <div className="absolute inset-0 bg-ink transition-opacity duration-1000" style={{ opacity: dim ? 0.7 : 0 }} />
    </div>
  );
}

const HEADLINES: Record<DemoState["stage"], [Key, Key]> = {
  idle: ["demo.idle.h", "demo.idle.s"],
  watching: ["demo.watching.h", "demo.watching.s"],
  noticed: ["demo.noticed.h", "demo.noticed.s"],
  pause: ["demo.pause.h", "demo.pause.s"],
  offer: ["demo.offer.h", "demo.offer.s"],
  quest: ["demo.quest.h", "demo.quest.s"],
  story: ["demo.story.h", "demo.story.s"],
};

export function Demo({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<DemoState>(INITIAL);
  const [ready, setReady] = useState(false);
  const driver = useRef<Driver | null>(null);
  const { t, lang } = useLang();
  // The driver asks for lines when it needs them, so it always speaks the current language.
  const tr = useRef(t);
  tr.current = t;
  const translate = (key: Key) => tr.current(key);

  const emit = (patch: Partial<DemoState>) => setS((prev) => ({ ...prev, ...patch }));

  const connect = async () => {
    driver.current?.stop();
    setReady(false);
    setS(INITIAL);
    driver.current = await createDriver(emit, translate);
    setReady(true);
  };

  useEffect(() => {
    let cancelled = false;
    createDriver(emit, translate).then((d) => {
      if (cancelled) return d.stop();
      driver.current = d;
      setReady(true);
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelled = true;
      driver.current?.stop();
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headline = t(HEADLINES[s.stage][0], { n: s.minutes });
  const sub = t(HEADLINES[s.stage][1], { n: s.minutes });
  const hub = s.source === "hub";
  const words = !hub ? t("demo.wordsScripted") : s.model ? t("demo.wordsModel", { model: s.model }) : t("demo.wordsNoModel");
  const paused = s.stage === "pause" || s.stage === "offer";

  // The hub writes the film's words. The pictures here are drawn stand-ins for the child's photos.
  const shots: Shot[] = useMemo(
    () => (s.film ? s.film.scenes.map((scene, i) => ({ line: scene.narration, still: STILLS[i % STILLS.length] })) : []),
    [s.film],
  );

  return (
    <motion.div
      className="fixed inset-0 z-[55] overflow-y-auto"
      role="dialog" aria-modal="true" aria-label={t("demo.label")}
      style={{ backgroundColor: s.warm ? "#FAEFCB" : C.ivory, transition: "background-color 2.4s var(--ease-quiet)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
    >
      <div className="mx-auto flex min-h-full max-w-[1400px] flex-col px-6 py-5 md:px-10">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <NestSymbol size={26} open={s.warm} />
            <span className="label">{t("demo.label")}</span>
          </div>
          <dl className="hidden flex-1 flex-wrap justify-center gap-x-8 gap-y-1 text-[0.78rem] md:flex">
            <div className="flex items-center gap-2"><dt className="opacity-55">{t("demo.decisions")}</dt><dd className="flex items-center gap-2"><Tag live={hub} />{t(hub ? "demo.hubLive" : "demo.hubRec")}</dd></div>
            <div className="flex items-center gap-2"><dt className="opacity-55">{t("demo.words")}</dt><dd>{words}</dd></div>
          </dl>
          <button className="link text-[0.9rem] font-semibold" onClick={onClose}>{t("demo.close")}</button>
        </header>
        <p className="mt-2 text-[0.78rem] opacity-60 md:hidden">
          {t("demo.decisions")}: {t(hub ? "demo.live" : "demo.simulated")} · {t("demo.words")}: {words}
        </p>
        {s.note && <p className="mt-2 text-center text-[0.8rem] text-clay">{s.note}</p>}
        {hub && lang !== "en" && s.stage !== "idle" && <p className="mt-2 text-center text-[0.8rem] opacity-60">{t("demo.hubEnglish")}</p>}

        {/* the room */}
        <div className="grid flex-1 grid-cols-1 items-end gap-x-8 gap-y-10 py-8 lg:grid-cols-[250px_minmax(0,1fr)_230px]">
          <Device name={t("demo.phone")} live={false} className="order-2 lg:order-1">
            <div className="w-[230px] bg-ink p-[7px]" style={{ borderRadius: 34 }}>
              <div className="flex h-[440px] flex-col overflow-hidden bg-ivory p-4 pt-8" style={{ borderRadius: 28 }}>
                <AnimatePresence mode="wait">
                  {s.stage === "idle" && (
                    <Fade key="idle" id="idle" className="flex flex-1 flex-col justify-between">
                      <div><p className="display text-[2.6rem] leading-none">4:12</p><p className="text-[0.8rem] opacity-60">{t("demo.day")}</p></div>
                      <div><VideoStill dim={false} /><p className="mt-2 text-[0.8rem] font-semibold">{t("demo.video")}</p><p className="text-[0.72rem] opacity-55">{t("demo.channel")}</p></div>
                    </Fade>
                  )}
                  {(s.stage === "watching" || s.stage === "noticed" || s.stage === "pause") && (
                    <Fade key="video" id="video" className="flex flex-1 flex-col">
                      <VideoStill dim={paused} />
                      <p className="mt-3 min-h-[4.2em] text-[0.86rem] leading-snug">{s.stage === "pause" ? "" : s.caption}</p>
                      <div className="mt-auto">
                        <div className="h-px bg-ink/20"><div className="h-[2px] bg-ink transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (s.minutes - 30) * 5)}%` }} /></div>
                        <p className="mt-2 text-[0.72rem] opacity-55">{t(s.stage === "pause" ? "demo.paused" : "demo.playing")}</p>
                      </div>
                    </Fade>
                  )}
                  {s.stage === "offer" && (
                    <Fade key="offer" id="offer" className="flex flex-1 flex-col">
                      <p className="label flex items-center gap-2 opacity-60"><NestSymbol size={14} /> NEST</p>
                      <p className="display mt-4 text-[1.7rem] !leading-[1.08]">{t("demo.offer")}</p>
                      {s.line && <p className="mt-4 text-[0.82rem] italic opacity-70">&ldquo;{s.line}&rdquo;</p>}
                      <button className="btn btn-ink mt-auto justify-center" onClick={() => driver.current?.accept()}>{t("living.go")}</button>
                    </Fade>
                  )}
                  {s.stage === "quest" && s.quest && (
                    <Fade key="quest" id="quest" className="flex flex-1 flex-col">
                      <p className="label opacity-60">{t("demo.quest", { n: s.quest.minutes })}</p>
                      <p className="display mt-2 text-[1.45rem] uppercase !leading-[1.08]">{s.quest.title}</p>
                      <ol className="mt-4 space-y-2 text-[0.8rem] leading-snug">
                        {s.quest.steps.map((step, i) => <li key={i} className="flex gap-2"><span className="display text-clay">{i + 1}</span>{step}</li>)}
                      </ol>
                      <button className="btn btn-ink mt-auto justify-center !px-3 text-[0.84rem]" onClick={() => driver.current?.finish()}>{t("demo.photo")}</button>
                    </Fade>
                  )}
                  {s.stage === "story" && (
                    <Fade key="story" id="story" className="flex flex-1 flex-col justify-center text-center">
                      <NestSymbol size={40} className="mx-auto" open />
                      <p className="display mt-4 text-[1.7rem]">{t("demo.look")}</p>
                      <p className="mt-2 text-[0.82rem] opacity-65">{t("demo.filmOn")}</p>
                    </Fade>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Device>

          <Device name={t("demo.tv")} live={false} className="order-1 lg:order-2">
            <div className="w-full bg-ink p-[10px]" style={{ borderRadius: 12 }}>
              <div className="relative overflow-hidden" style={{ aspectRatio: "16 / 9", borderRadius: 4, backgroundColor: s.stage === "quest" ? C.butter : "#34312d", transition: "background-color 1.4s var(--ease-quiet)" }}>
                <AnimatePresence mode="wait">
                  {s.stage === "quest" && s.quest && (
                    <Fade key="tv-quest" id="tv-quest" className="absolute inset-0 grid place-items-center p-[6%] text-center">
                      <div>
                        <p className="display text-[clamp(1.5rem,4vw,3.6rem)]">{t("home.tv1")} <em>{t("home.tv2")}</em></p>
                        <p className="mt-3 text-[clamp(0.8rem,1.3vw,1.1rem)] opacity-75">{s.quest.mission}</p>
                      </div>
                    </Fade>
                  )}
                  {s.stage === "story" && s.film && (
                    <Fade key="tv-film" id="tv-film" className="absolute inset-0 flex flex-col justify-center bg-black px-[3%] text-ivory">
                      <FilmPlayer title={s.film.title} runtime={`0:${String(shots.length * 3).padStart(2, "0")}`} shots={shots} closing={s.film.closing} autoPlay />
                    </Fade>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="h-3 w-[2px] bg-ink" /><div className="h-[3px] w-28 rounded-full bg-ink" />
          </Device>

          <div className="order-3 flex items-end justify-center gap-10 lg:flex-col lg:items-center lg:gap-8">
            <Device name={t("demo.watch")} live={false}>
              <svg viewBox="-4 -24 88 128" className="w-[104px]" aria-hidden="true">
                <Watch>
                  <text x={25} y={s.stage === "quest" ? 30 : 38} textAnchor="middle" fontFamily="var(--font-serif)" fontSize={s.stage === "quest" ? 13 : 9.5} fill={C.ivory}>
                    {s.stage === "quest" ? t("home.watch1") : s.stage === "story" ? t("demo.nice") : s.stage === "idle" ? "4:12" : t("demo.still", { n: s.minutes })}
                  </text>
                  {s.stage === "quest" && <text x={25} y={46} textAnchor="middle" fontFamily="var(--font-serif)" fontStyle="italic" fontSize={13} fill={C.ivory}>{t("home.watch2")}</text>}
                </Watch>
              </svg>
            </Device>
            <Device name={t("demo.light")} live={s.smartthings === "live"}>
              <svg viewBox="-80 0 240 270" className="w-[150px]" aria-hidden="true"><Lamp on={s.warm} height={250} /></svg>
            </Device>
          </div>
        </div>

        {/* the story, one line at a time */}
        <div className="grid grid-cols-1 items-end gap-6 pb-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div aria-live="polite" className="min-h-[7.5rem]">
            <AnimatePresence mode="wait">
              <Fade key={s.stage + (s.stage === "watching" ? "" : headline)} id={s.stage}>
                <h2 className="display text-[clamp(2rem,4.6vw,4.4rem)]">{headline}</h2>
                <p className="mt-2 max-w-[60ch] text-[0.95rem] opacity-70">{sub}</p>
              </Fade>
            </AnimatePresence>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {s.stage === "idle" && <button className="btn btn-ink" disabled={!ready} onClick={() => driver.current?.start()}>{t("demo.start")}</button>}
            {s.stage === "story" && (
              <>
                <button className="btn btn-line" onClick={connect}>{t("demo.again")}</button>
                <a className="link text-[0.9rem] font-semibold" href="/devices.html">{t("demo.open")}</a>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

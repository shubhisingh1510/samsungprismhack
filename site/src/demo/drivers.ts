// Two ways to run the demo story.
//
// HubDriver talks to the real NEST hub over its WebSocket bus and REST API. The decisions
// (when to speak, where the natural pause is, the quest, the lights, the film script) are
// then made by the same code that runs the working prototype.
//
// ScriptDriver plays a recording of what the hub does, for when the hub is not running
// (for example when this page is opened as static files). The screen says which is in use.

import type { Key } from "../i18n";

export type Stage = "idle" | "watching" | "noticed" | "pause" | "offer" | "quest" | "story";

export type Quest = { id?: string; title: string; mission: string; steps: string[]; minutes: number };
export type Film = { title: string; scenes: { caption: string; narration: string }[]; closing: string };

export type DemoState = {
  stage: Stage;
  minutes: number;
  caption: string;
  line: string;
  quest: Quest | null;
  warm: boolean;
  film: Film | null;
  source: "hub" | "script";
  model: string | null;
  smartthings: "live" | "simulated";
  note: string;
};

export const INITIAL: DemoState = {
  stage: "idle", minutes: 0, caption: "", line: "", quest: null, warm: false, film: null,
  source: "script", model: null, smartthings: "simulated", note: "",
};

export interface Driver {
  start(): void;
  accept(): void;
  finish(): void;
  stop(): void;
}

type Emit = (patch: Partial<DemoState>) => void;

const VIDEO = "reel_bridge";
const START_MINUTES = 37;      // the story begins 37 minutes into the sitting

/** Looks up a line of the recording in the visitor's language. */
type Tr = (key: Key) => string;

const recording = (tr: Tr) => ({
  captions: [tr("demo.rec.cap1"), tr("demo.rec.cap2"), tr("demo.rec.cap3")],
  line: tr("demo.rec.line"),
  quest: {
    title: tr("demo.rec.quest"),
    mission: tr("demo.rec.mission"),
    steps: [tr("demo.rec.step1"), tr("demo.rec.step2"), tr("demo.rec.step3")],
    minutes: 10,
  } as Quest,
  film: {
    title: tr("demo.rec.film"),
    scenes: [
      { caption: "", narration: tr("demo.rec.scene1") },
      { caption: "", narration: tr("demo.rec.mission") },
      { caption: "", narration: tr("demo.rec.step2") },
      { caption: "", narration: tr("demo.rec.scene4") },
    ],
    closing: tr("creator.closing"),
  } as Film,
});

async function json(path: string, body?: unknown, timeout = 8000) {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

/** A stand-in for the child's photo: a quick drawing of a cardboard bridge on two stacks of books. */
function standInPhoto(): string {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 420;
  const g = c.getContext("2d")!;
  g.fillStyle = "#F5E8B5";
  g.fillRect(0, 0, 640, 420);
  g.fillStyle = "#E6CBAA";
  g.fillRect(0, 300, 640, 120);
  [["#A9C6D6", 110], ["#F4DDE2", 460]].forEach(([color, x]) => {
    g.fillStyle = color as string;
    g.fillRect(x as number, 250, 110, 26);
    g.fillRect((x as number) + 8, 276, 110, 26);
  });
  g.strokeStyle = "#D8B48F";
  g.lineWidth = 22;
  g.beginPath();
  g.moveTo(150, 246);
  g.quadraticCurveTo(325, 150, 520, 246);
  g.stroke();
  return c.toDataURL("image/jpeg", 0.8).split(",")[1];
}

class ScriptDriver implements Driver {
  private timers: number[] = [];
  constructor(private emit: Emit, private tr: Tr) {}

  private at(ms: number, fn: () => void) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  start() {
    const { captions } = recording(this.tr);
    this.emit({ source: "script", stage: "watching", minutes: START_MINUTES, caption: captions[0], warm: false, film: null, quest: null });
    for (let s = 1; s <= 8; s++) {
      this.at(s * 1000, () => this.emit({ minutes: START_MINUTES + s, caption: captions[Math.min(2, Math.floor(s / 3.9))] }));
    }
    this.at(2600, () => this.emit({ stage: "noticed" }));
    this.afterNotice(8000);
  }

  /** From "NEST has decided to speak" to the offer. Also used when the hub goes quiet mid-story. */
  afterNotice(delay: number) {
    this.at(delay, () => this.emit({ stage: "pause", minutes: 45 }));
    this.at(delay + 2200, () => this.emit({ stage: "offer", line: recording(this.tr).line }));
  }

  accept() {
    this.emit({ stage: "quest", quest: recording(this.tr).quest });
    this.at(500, () => this.emit({ warm: true }));
  }

  finish() {
    this.emit({ stage: "story", film: recording(this.tr).film, warm: false });
  }

  stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

class HubDriver implements Driver {
  private ws: WebSocket | null = null;
  private tick = 0;
  private t = 0;
  private playing = false;
  private pending: { at: number; line: string; decision_id: string } | null = null;
  private segments: { start: number; text: string }[] = [];
  private questId = "";
  private fallback: ScriptDriver | null = null;
  private watchdog = 0;
  private stopped = false;

  constructor(private emit: Emit, private tr: Tr) {}

  private send(topic: string, data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ topic, data }));
  }

  /** If the hub stops answering, finish the story from the recording and say so. */
  private giveUp(why: Key, resume: (s: ScriptDriver) => void) {
    if (this.fallback || this.stopped) return;
    this.halt();
    this.fallback = new ScriptDriver(this.emit, this.tr);
    this.emit({ source: "script", note: this.tr(why) });
    resume(this.fallback);
  }

  private halt() {
    clearInterval(this.tick);
    clearTimeout(this.watchdog);
    this.ws?.close();
    this.ws = null;
  }

  async start() {
    try {
      await json("/api/demo/reset", {});
      await json("/api/context", { speed: 60, child_name: "Maya", child_age: 9 });
      const video = await json(`/api/videos/${VIDEO}`);
      this.segments = video.segments;
    } catch {
      this.giveUp("demo.note.down", (s) => s.start());
      return;
    }
    if (this.stopped) return;

    const scheme = location.protocol === "https:" ? "wss" : "ws";
    this.ws = new WebSocket(`${scheme}://${location.host}/ws?role=child`);
    this.ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    this.t = 0;
    this.playing = true;
    this.emit({ source: "hub", stage: "watching", minutes: START_MINUTES, caption: this.segments[0]?.text ?? "", warm: false, film: null, quest: null, note: "" });

    let jumped = false;
    this.tick = window.setInterval(async () => {
      if (this.playing) this.t += 1;
      this.send("screen/tick", { video_id: VIDEO, t: this.t, playing: this.playing, dt: 1 });
      if (!jumped && this.ws?.readyState === WebSocket.OPEN) {
        jumped = true;
        json("/api/context", { jump_min: START_MINUTES }).catch(() => undefined);
      }
      if (this.playing) {
        const line = [...this.segments].reverse().find((s) => s.start <= this.t);
        json("/api/brain", undefined, 900)
          .then((b) => this.playing && this.emit({ minutes: Math.max(START_MINUTES, Math.round(b.watch_min)), caption: line?.text ?? "" }))
          .catch(() => undefined);
        if (this.pending && this.t >= this.pending.at) this.pauseNow();
      }
    }, 1000);

    this.watchdog = window.setTimeout(() => {
      if (!this.pending) this.giveUp("demo.note.slow", (s) => s.afterNotice(600));
    }, 30000);
  }

  private pauseNow() {
    const p = this.pending!;
    this.pending = null;
    this.playing = false;
    this.send("player/interrupted", { decision_id: p.decision_id, late_ms: Math.max(0, Math.round((this.t - p.at) * 1000)) });
    this.emit({ stage: "pause" });
    window.setTimeout(() => !this.stopped && this.emit({ stage: "offer", line: p.line }), 2200);
  }

  private onMessage({ topic, data }: { topic: string; data: any }) {
    if (topic === "status") {
      this.emit({ model: data.llm.on ? data.llm.model : null, smartthings: data.smartthings });
    } else if (topic === "player/cmd" && data.cmd === "interrupt") {
      // The Brain has decided to speak, and has chosen the breakpoint to do it at.
      clearTimeout(this.watchdog);
      this.pending = data;
      this.emit({ stage: "noticed" });
    } else if (topic === "quest/update" && data.state === "active") {
      this.questId = data.quest.id;
      this.emit({ stage: "quest", quest: data.quest });
    } else if (topic === "house/state") {
      this.emit({ warm: data.scene === "sunrise", smartthings: data.mode });
    }
  }

  accept() {
    if (this.fallback) return this.fallback.accept();
    this.send("voice/utterance", { text: "yes" });
    window.setTimeout(() => {
      if (!this.questId) this.giveUp("demo.note.down", (s) => s.accept());
    }, 6000);
  }

  async finish() {
    if (this.fallback) return this.fallback.finish();
    try {
      const result = await json(`/api/quest/${this.questId}/proof`, { kind: "photo", images_b64: [standInPhoto()] }, 30000);
      if (!result.ok || !result.film) throw new Error("proof not accepted");
      this.emit({ stage: "story", film: result.film });
    } catch {
      this.giveUp("demo.note.photo", (s) => s.finish());
    }
  }

  stop() {
    this.stopped = true;
    this.halt();
    this.fallback?.stop();
  }
}

/** Use the real hub when it answers; otherwise the recording. */
export async function createDriver(emit: Emit, tr: Tr): Promise<Driver> {
  try {
    const status = await json("/api/status", undefined, 1500);
    emit({ source: "hub", model: status.llm.on ? status.llm.model : null, smartthings: status.smartthings });
    return new HubDriver(emit, tr);
  } catch {
    emit({ source: "script", model: null, smartthings: "simulated" });
    return new ScriptDriver(emit, tr);
  }
}

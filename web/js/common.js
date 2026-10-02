// Shared by every PORTAL page: event-bus connection, REST helper, speech, and the
// "truth bar" that labels what is real and what is simulated right now.
const PORTAL = (() => {
  const handlers = {};
  const queue = [];
  let ws = null;
  let role = "child";
  let status = null;

  function connect(asRole) {
    role = asRole;
    open();
  }

  function open() {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${scheme}://${location.host}/ws?role=${role}`);
    ws.onopen = () => {
      queue.splice(0).forEach((m) => ws.send(m));
      document.body.classList.remove("offline");
    };
    ws.onmessage = (e) => {
      const { topic, data } = JSON.parse(e.data);
      (handlers[topic] || []).forEach((fn) => fn(data));
    };
    ws.onclose = () => {
      document.body.classList.add("offline");
      setTimeout(open, 1000);
    };
  }

  function on(topic, fn) {
    (handlers[topic] = handlers[topic] || []).push(fn);
  }

  // Ticks are only useful live, so they are dropped while offline; everything else is queued.
  function send(topic, data) {
    const message = JSON.stringify({ topic, data });
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(message);
    else if (topic !== "screen/tick") queue.push(message);
  }

  async function api(path, body, method) {
    const res = await fetch(path, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
    return data;
  }

  function chip(text, kind) {
    const el = document.createElement("span");
    el.className = `chip ${kind}`;
    el.textContent = text;
    return el;
  }

  function renderTruth(extra) {
    const bar = document.getElementById("truth");
    if (!bar || !status) return;
    bar.replaceChildren(
      status.llm.on ? chip(`AI: local ${status.llm.model}`, "real") : chip("AI model: off, scripted lines", "sim"),
      chip(`SmartThings: ${status.smartthings}`, status.smartthings === "live" ? "real" : "sim"),
      ...(status.speed > 1 ? [chip(`Demo clock x${status.speed}`, "sim")] : []),
      ...(extra || []).map(([text, kind]) => chip(text, kind)),
    );
  }

  let truthExtra = [];
  on("status", (s) => {
    status = s;
    renderTruth(truthExtra);
  });
  function setTruthExtra(extra) {
    truthExtra = extra;
    renderTruth(truthExtra);
  }

  // Text to speech with the browser's built-in voices (these run on the device).
  let unlocked = false;
  function unlockAudio() {
    unlocked = true;
    if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  }
  function speak(text, { pitch = 1.25, rate = 1.05, onend } = {}) {
    const done = () => onend && onend();
    if (!unlocked || !("speechSynthesis" in window) || !text) {
      // No audio available: leave the words on screen for a reading-speed pause.
      const timer = setTimeout(done, text ? Math.min(6000, 900 + text.split(" ").length * 280) : 0);
      return { cancel: () => clearTimeout(timer) };
    }
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find((v) => v.lang === "en-IN") || voices.find((v) => v.lang.startsWith("en")) || null;
    u.pitch = pitch;
    u.rate = rate;
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        done();
      }
    };
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return { cancel: () => { finished = true; speechSynthesis.cancel(); } };
  }

  const el = (id) => document.getElementById(id);
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return { connect, on, send, api, speak, unlockAudio, setTruthExtra, el, fmtTime, getStatus: () => status };
})();

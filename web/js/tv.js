// Living room: the TV app plus a visual stand-in for the SmartThings lights and
// speaker. The same HTML would be packaged as a Tizen web app on a real TV.
(() => {
  const { on, send, speak, el } = PORTAL;
  let audio = null;
  let birds = null;
  let music = null;
  let steps = 0;
  let filmRun = 0;

  // ------------------------------------------------------------- lighting
  // Colour temperature in kelvin to RGB (Tanner Helland's approximation).
  function kelvinToRgb(k) {
    const t = k / 100;
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp(r), clamp(g), clamp(b)];
  }

  on("house/state", (h) => {
    const [r, g, b] = kelvinToRgb(h.lights.kelvin);
    const room = el("room");
    room.style.setProperty("--light", `${r} ${g} ${b}`);
    room.style.setProperty("--glow", (h.lights.on ? h.lights.level / 100 : 0).toFixed(2));
    el("lights").textContent = `Lights (${h.mode}): ${h.lights.level}% at ${h.lights.kelvin} K · scene: ${h.scene}` +
      (h.error ? ` · ${h.error}` : "");
    const playing = h.speaker.playing;
    el("speaker").textContent = playing ? `🔊 Speaker: ${playing} (vol ${h.speaker.volume})` : "🔈 Speaker: silent";
    el("speaker").classList.toggle("playing", Boolean(playing));
    playing === "birdsong" ? startBirds(h.speaker.volume) : stopBirds();
  });

  // ---------------------------------------------------- synthesised sound
  function startBirds(volume) {
    if (!audio || birds) return;
    const gain = audio.createGain();
    gain.gain.value = volume / 250;
    gain.connect(audio.destination);
    const chirp = () => {
      const now = audio.currentTime;
      const notes = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < notes; i++) {
        const osc = audio.createOscillator();
        const env = audio.createGain();
        const start = now + i * 0.11;
        const base = 2400 + Math.random() * 2200;
        osc.type = "sine";
        osc.frequency.setValueAtTime(base, start);
        osc.frequency.exponentialRampToValueAtTime(base * (0.75 + Math.random() * 0.7), start + 0.08);
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(1, start + 0.015);
        env.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
        osc.connect(env).connect(gain);
        osc.start(start);
        osc.stop(start + 0.1);
      }
      birds.timer = setTimeout(chirp, 350 + Math.random() * 1400);
    };
    birds = { gain, timer: null };
    chirp();
  }

  function stopBirds() {
    if (!birds) return;
    clearTimeout(birds.timer);
    birds.gain.disconnect();
    birds = null;
  }

  function startMusic() {
    if (!audio || music) return;
    const gain = audio.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.05, audio.currentTime + 2);
    gain.connect(audio.destination);
    const chords = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]];
    let i = 0;
    const play = () => {
      const now = audio.currentTime;
      for (const f of chords[i++ % chords.length]) {
        const osc = audio.createOscillator();
        const env = audio.createGain();
        osc.type = "triangle";
        osc.frequency.value = f;
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(1, now + 0.8);
        env.gain.linearRampToValueAtTime(0, now + 3.1);
        osc.connect(env).connect(gain);
        osc.start(now);
        osc.stop(now + 3.2);
      }
    };
    play();
    music = { gain, timer: setInterval(play, 3000) };
  }

  function stopMusic() {
    if (!music) return;
    clearInterval(music.timer);
    const g = music.gain;
    g.gain.linearRampToValueAtTime(0, audio.currentTime + 1.5);
    setTimeout(() => g.disconnect(), 1800);
    music = null;
  }

  // --------------------------------------------------------------- screens
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("on", s.id === id));
  }

  on("tv/show", (m) => {
    filmRun++;
    stopMusic();
    if (m.screen === "portal") {
      el("portalHello").textContent = `A portal has opened, ${m.child}.`;
      el("portalTitle").textContent = m.quest.title;
      el("portalMission").textContent = m.quest.mission;
      show("portal");
    } else if (m.screen === "quest") {
      el("questState").textContent = m.state === "active" ? `Quest in progress · ${m.quest.minutes} minutes` : "Your quest";
      el("questTitle").textContent = m.quest.title;
      el("questMission").textContent = m.quest.mission;
      el("questSteps").replaceChildren(...m.quest.steps.map((s) => Object.assign(document.createElement("li"), { textContent: s })));
      show("quest");
    } else if (m.screen === "documentary") {
      playFilm(m);
    } else if (m.screen === "winddown") {
      show("winddown");
    } else {
      show("idle");
    }
  });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const narrate = (text) => new Promise((resolve) => speak(text, { pitch: 0.9, rate: 0.95, onend: resolve }));

  // The mini-documentary: rendered live from the script and the child's own photos.
  async function playFilm(m) {
    const run = filmRun;
    const alive = () => run === filmRun;
    const photos = m.photos || [];
    show("film");
    startMusic();
    el("filmCaption").textContent = "";
    el("filmNarration").textContent = "";
    ["photoA", "photoB", "filmEmoji"].forEach((id) => el(id).classList.remove("show"));
    el("filmKicker").textContent = "NEST Films presents";
    el("filmTitle").textContent = m.film.title;
    el("filmCard").hidden = false;
    await wait(3200);
    if (!alive()) return;
    el("filmCard").hidden = true;
    let flip = false;
    for (let i = 0; i < m.film.scenes.length; i++) {
      const scene = m.film.scenes[i];
      if (photos.length) {
        const layer = el(flip ? "photoB" : "photoA");
        const other = el(flip ? "photoA" : "photoB");
        layer.style.backgroundImage = `url(data:image/jpeg;base64,${photos[i % photos.length]})`;
        layer.classList.remove("show");
        void layer.offsetWidth;                 // restart the zoom animation
        layer.classList.add("show");
        other.classList.remove("show");
        flip = !flip;
      } else {
        el("filmEmoji").classList.add("show");
      }
      el("filmCaption").textContent = scene.caption;
      el("filmNarration").textContent = scene.narration;
      await Promise.all([narrate(scene.narration), wait(3500)]);
      if (!alive()) return;
    }
    el("filmKicker").textContent = "The end";
    el("filmTitle").textContent = m.film.closing;
    el("filmCard").hidden = false;
    await narrate(m.film.closing);
    await wait(4000);
    if (!alive()) return;
    stopMusic();
    show("idle");
  }

  // ------------------------------------------------------ watch simulator
  function sendBody() {
    el("stillOut").textContent = el("still").value;
    send("body/update", { still_min: el("watchOn").checked ? Number(el("still").value) : null, steps });
  }
  el("watchOn").onchange = sendBody;
  el("still").oninput = sendBody;
  el("walk").onclick = () => {
    steps += 20;
    el("still").value = 0;
    el("steps").textContent = `${steps} steps`;
    sendBody();
  };

  on("brain/state", (b) => {
    el("brain").textContent = `Brain: ${b.phase}${b.pending ? ` (${b.pending})` : ""} · drift ${b.drift.score.toFixed(2)} / ${b.threshold} · ` +
      `${b.watch_min} min this sitting`;
  });

  setInterval(() => {
    el("clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, 1000);

  el("startBtn").onclick = () => {
    PORTAL.unlockAudio();
    audio = new (window.AudioContext || window.webkitAudioContext)();
    el("start").hidden = true;
    PORTAL.setTruthExtra([["TV: browser standing in for a Tizen app", "sim"], ["Watch + sounds: simulated", "sim"]]);
    PORTAL.connect("tv");
  };
})();

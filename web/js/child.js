// Child phone: plays the video, reports what is on screen, speaks the companion's
// lines, lets the child talk back (and barge in), and runs the quest card.
(() => {
  const { on, send, api, speak, el, fmtTime } = PORTAL;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

  let video = null;
  let player = null;
  let pending = null;          // an interrupt scheduled for a breakpoint
  let lastTick = performance.now();
  let lastDecision = null;
  let speech = null;
  let speaking = false;
  let afterSpeech = null;
  let currentLine = "";
  let rec = null;
  let micDenied = false;
  let quest = null;
  let questTimer = null;

  // ------------------------------------------------------------- players
  class ReelPlayer {
    constructor(stage, v) {
      this.video = v;
      this.t = 0;
      this.playing = false;
      this.ended = false;
      this.last = performance.now();
      const root = document.createElement("div");
      root.className = "reel";
      const [c1, c2] = v.palette || ["#1b2a49", "#4b2e83"];
      root.style.background = `linear-gradient(160deg, ${c1}, ${c2})`;
      root.innerHTML = '<div class="meta"><b></b><br><span></span></div><div class="state"></div>' +
        '<div class="emoji"></div><div class="caption"></div><div class="time"></div><div class="progress"><i></i></div>';
      root.querySelector(".meta b").textContent = v.title;
      root.querySelector(".meta span").textContent = v.channel || "";
      root.onclick = () => {
        this.playing ? this.pause() : this.play();
        send("screen/interaction", { kind: "play-pause" });
      };
      stage.replaceChildren(root);
      this.root = root;
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
      this.render();
    }
    play() {
      if (this.ended) { this.t = 0; this.ended = false; }
      this.playing = true;
      this.last = performance.now();
      this.render();
    }
    pause() { this.playing = false; this.render(); }
    time() { return this.t; }
    frame(now) {
      if (this.dead) return;
      if (this.playing) {
        this.t += Math.min(0.5, (now - this.last) / 1000);
        if (this.t >= this.video.duration) {
          if (this.video.loop) this.t = 0;
          else { this.t = this.video.duration; this.playing = false; this.ended = true; }
        }
        this.render();
      }
      this.last = now;
      requestAnimationFrame(this.frame);
    }
    render() {
      const segs = this.video.segments;
      let cur = null;
      for (const s of segs) if (s.start <= this.t) cur = s;
      const showing = cur && this.t < cur.start + cur.dur + 0.6;
      const q = (sel) => this.root.querySelector(sel);
      q(".emoji").textContent = (cur && cur.emoji) || "🎬";
      q(".caption").textContent = showing ? cur.text : "";
      q(".state").textContent = this.ended ? "ended · tap to replay" : this.playing ? "playing" : "paused · tap to play";
      q(".time").textContent = `${fmtTime(this.t)} / ${fmtTime(this.video.duration)}`;
      q(".progress i").style.width = `${(100 * this.t) / this.video.duration}%`;
      this.root.classList.toggle("playing", this.playing);
    }
    destroy() { this.dead = true; }
  }

  function loadYouTubeApi() {
    return new Promise((resolve) => {
      if (window.YT && YT.Player) return resolve();
      const earlier = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (earlier) earlier(); resolve(); };
      if (!document.getElementById("ytapi")) {
        const s = document.createElement("script");
        s.id = "ytapi";
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
    });
  }

  class YouTubePlayer {
    constructor(stage, v) {
      this.playing = false;
      this.ended = false;
      this.ready = false;
      const holder = document.createElement("div");
      holder.id = "yt";
      stage.replaceChildren(holder);
      loadYouTubeApi().then(() => {
        if (this.dead) return;
        this.p = new YT.Player("yt", {
          videoId: v.youtube_id,
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: () => { this.ready = true; },
            onStateChange: (e) => {
              this.playing = e.data === 1;
              this.ended = e.data === 0;
              if (e.data === 2 && !this.byPortal) send("screen/interaction", { kind: "pause" });
              if (e.data !== 3) this.byPortal = false;
            },
          },
        });
      });
    }
    play() { if (this.ready) this.p.playVideo(); }
    pause() { if (this.ready) { this.byPortal = true; this.p.pauseVideo(); } }
    time() { return this.ready && this.p.getCurrentTime ? this.p.getCurrentTime() : 0; }
    destroy() { this.dead = true; if (this.p && this.p.destroy) this.p.destroy(); }
  }

  async function loadVideo(id, autoplay = true) {
    video = await api(`/api/videos/${id}`);
    if (player) player.destroy();
    pending = null;
    el("blocked").hidden = true;
    el("replyRow").hidden = true;
    player = video.source === "youtube" ? new YouTubePlayer(el("stage"), video) : new ReelPlayer(el("stage"), video);
    if (autoplay) player.play();
    send("screen/interaction", { kind: "chose-video" });
  }

  function videoButton(v) {
    const b = document.createElement("button");
    b.textContent = v.title;
    b.title = `${v.category} · ${v.source === "youtube" ? "YouTube" : "sample reel"}`;
    b.onclick = () => loadVideo(v.id);
    return b;
  }

  async function refreshPicker() {
    const videos = await api("/api/videos");
    el("picker").replaceChildren(...videos.map(videoButton));
  }

  // ------------------------------------------------- reporting to the hub
  setInterval(() => {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    if (!video || !player) return;
    send("screen/tick", { video_id: video.id, t: player.time(), playing: player.playing, ended: player.ended, dt });
  }, 1000);

  // The hub schedules an interruption for a breakpoint; the phone lands it precisely.
  setInterval(() => {
    if (!pending || !player) return;
    if (player.time() >= pending.at || player.ended || !player.playing) interruptNow();
  }, 100);

  function interruptNow() {
    const p = pending;
    pending = null;
    const late = Math.max(0, Math.round((player.time() - p.at) * 1000));
    player.pause();
    lastDecision = p.decision_id;
    send("player/interrupted", { decision_id: p.decision_id, late_ms: late });
    el("replyRow").hidden = false;
    el("badBtn").disabled = false;
    say(p.line, { listen: true });
  }

  // ------------------------------------------------------------- speaking
  function say(line, { listen = false, then = null } = {}) {
    stopSpeech(false);
    currentLine = line;
    afterSpeech = then;
    el("line").textContent = line;
    speaking = true;
    el("avatar").classList.add("speaking");
    if (el("openMic").checked) startListening();       // lets the child barge in mid-sentence
    speech = speak(line, {
      onend: () => {
        speaking = false;
        el("avatar").classList.remove("speaking");
        const next = afterSpeech;
        afterSpeech = null;
        if (next) next();
        if (listen && !rec && el("openMic").checked) startListening();
      },
    });
  }

  function stopSpeech(runAfter = true) {
    if (speech) speech.cancel();
    speech = null;
    speaking = false;
    el("avatar").classList.remove("speaking");
    const next = afterSpeech;
    afterSpeech = null;
    if (runAfter && next) next();
  }

  // The microphone hears the companion's own voice. Ignore recognised text that is
  // mostly the line being spoken, so the companion does not interrupt itself.
  function isEcho(text) {
    const words = text.toLowerCase().match(/[a-z']+/g) || [];
    if (words.length < 3) return false;
    const line = new Set(currentLine.toLowerCase().match(/[a-z']+/g) || []);
    return words.filter((w) => line.has(w)).length / words.length >= 0.7;
  }

  // ------------------------------------------------------------ listening
  function startListening({ barged = false, forProof = null } = {}) {
    if (!SR || micDenied) {
      el("heard").textContent = SR ? "Microphone is blocked. Type instead." : "No speech recognition in this browser. Type instead.";
      return;
    }
    stopListening();
    const r = new SR();
    rec = r;
    r.lang = "en-IN";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    let bargeMs = null;
    let speechStart = 0;
    el("micBtn").classList.add("listening");
    r.onspeechstart = () => { speechStart = performance.now(); };
    r.onresult = (e) => {
      let text = "";
      for (const res of e.results) text += res[0].transcript;
      text = text.trim();
      if (!text) return;
      if (speaking) {
        if (isEcho(text)) return;
        bargeMs = speechStart ? Math.round(performance.now() - speechStart) : null;
        stopSpeech();
        barged = true;
      }
      el("heard").textContent = `You: ${text}`;
      if (e.results[e.results.length - 1].isFinal) finalText = text;
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") micDenied = true;
    };
    r.onend = () => {
      if (rec === r) {
        rec = null;
        el("micBtn").classList.remove("listening");
      }
      if (finalText && !(speaking && isEcho(finalText))) {
        if (forProof) forProof(finalText);
        else utter(finalText, barged, bargeMs);
      } else if (speaking && el("openMic").checked && !micDenied) {
        startListening({ forProof });
      }
    };
    try { r.start(); } catch (err) { rec = null; }
  }

  function stopListening() {
    if (rec) {
      const r = rec;
      rec = null;
      r.onend = null;
      try { r.abort(); } catch (err) { /* already stopped */ }
    }
    el("micBtn").classList.remove("listening");
  }

  function utter(text, barged = false, bargeMs = null) {
    stopSpeech();
    el("heard").textContent = `You: ${text}`;
    send("voice/utterance", { text, barge_in: barged, barge_ms: bargeMs });
  }

  el("micBtn").onclick = () => {
    const wasSpeaking = speaking;
    const t0 = performance.now();
    stopSpeech();
    if (rec) stopListening();
    else startListening({ barged: wasSpeaking });
    if (wasSpeaking) el("heard").textContent = `(stopped talking in ${Math.round(performance.now() - t0)} ms) Go on…`;
  };
  function sendTyped() {
    const text = el("say").value.trim();
    if (!text) return;
    el("say").value = "";
    utter(text, speaking, null);
  }
  el("sendBtn").onclick = sendTyped;
  el("say").onkeydown = (e) => { if (e.key === "Enter") sendTyped(); };
  el("yesBtn").onclick = () => utter("yes", speaking, null);
  el("whyBtn").onclick = () => utter("why did you do that", speaking, null);
  el("badBtn").onclick = () => {
    send("feedback/bad_timing", { decision_id: lastDecision });
    el("badBtn").disabled = true;
    el("heard").textContent = "Noted. I'll pick my moments better.";
  };

  // ------------------------------------------------------ hub -> phone
  on("player/cmd", (c) => {
    if (c.companion) el("who").textContent = c.companion;
    if (c.cmd === "interrupt") {
      pending = c;
    } else if (c.cmd === "say") {
      say(c.line, { listen: c.listen });
    } else if (c.cmd === "resume") {
      pending = null;
      el("replyRow").hidden = true;
      el("blocked").hidden = true;
      stopListening();
      if (c.line) say(c.line, { then: () => player && player.play() });
      else { stopSpeech(false); if (player) player.play(); }
    } else if (c.cmd === "pause") {
      pending = null;
      if (player) player.pause();
    } else if (c.cmd === "enforce") {
      pending = null;
      lastDecision = c.decision_id;
      if (player) player.pause();
      el("replyRow").hidden = true;
      el("alternatives").replaceChildren(...c.alternatives.map(videoButton));
      el("blocked").hidden = c.alternatives.length === 0;
      say(c.line);
    } else if (c.cmd === "reset") {
      location.reload();
    }
  });

  // ---------------------------------------------------------------- quests
  on("quest/update", (u) => {
    clearInterval(questTimer);
    const card = el("quest");
    if (u.state === "none" || !u.quest) {
      card.hidden = true;
      quest = null;
      return;
    }
    quest = u.quest;
    card.hidden = false;
    el("questTitle").textContent = quest.title;
    el("questMission").textContent = quest.mission;
    el("questSteps").replaceChildren(...quest.steps.map((s) => Object.assign(document.createElement("li"), { textContent: s })));
    el("questMaterials").replaceChildren(...(quest.materials || []).map((m) => Object.assign(document.createElement("span"), { textContent: m })));
    el("questOffer").hidden = u.state !== "offered";
    el("questProof").hidden = u.state !== "active";
    el("questDone").hidden = u.state !== "complete";
    el("questTimer").textContent = "";
    if (u.state === "offered") {
      el("questLabel").textContent = "The living room has a quest for you";
    } else if (u.state === "active") {
      el("questLabel").textContent = "Quest in progress";
      el("replyRow").hidden = true;
      el("proofPhoto").hidden = quest.proof !== "photo";
      el("proofVoice").hidden = quest.proof !== "voice";
      el("proofSteps").hidden = quest.proof !== "steps";
      el("proofNote").textContent = "";
      const endsAt = Date.now() + quest.minutes * 60000;
      const show = () => {
        const left = Math.max(0, (endsAt - Date.now()) / 1000);
        el("questTimer").textContent = left > 0 ? fmtTime(left) : "Time! Show me.";
      };
      show();
      questTimer = setInterval(show, 1000);
    } else if (u.state === "complete") {
      el("questLabel").textContent = "Quest complete";
      el("doneNote").textContent = u.note || "";
      el("doneReward").textContent = `+${u.reward} sparks`;
      el("line").textContent = u.note || "Quest complete.";
    }
  });

  el("acceptBtn").onclick = () => api("/api/quest/accept", {}).catch((e) => { el("heard").textContent = e.message; });
  el("abandonBtn").onclick = () => api("/api/quest/abandon", {});

  async function sendProof(body) {
    el("proofNote").textContent = "Checking…";
    try {
      const result = await api(`/api/quest/${quest.id}/proof`, body);
      el("proofNote").textContent = result.note || "";
      if (!result.ok) say(result.note);
    } catch (e) {
      el("proofNote").textContent = e.message;
    }
  }

  async function shrink(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72).split(",")[1];
  }

  el("photoBtn").onclick = () => el("photo").click();
  el("photo").onchange = async () => {
    const files = [...el("photo").files].slice(0, 4);
    if (!files.length) return;
    const images = await Promise.all(files.map(shrink));
    el("photo").value = "";
    sendProof({ kind: "photo", images_b64: images });
  };
  el("proofSend").onclick = () => sendProof({ kind: "voice", said: el("proofText").value });
  el("proofMic").onclick = () => startListening({ forProof: (text) => { el("proofText").value = text; } });
  el("stepsBtn").onclick = () => sendProof({ kind: "steps" });

  // ----------------------------------------------------------------- start
  el("ytAdd").onclick = async () => {
    el("ytNote").textContent = "Fetching captions…";
    try {
      const v = await api("/api/videos/youtube", { url: el("ytUrl").value });
      el("ytNote").textContent = `${v.title}: ${v.caption_note}. Category guessed as "${v.category}".`;
      await refreshPicker();
      loadVideo(v.id, false);
    } catch (e) {
      el("ytNote").textContent = e.message;
    }
  };

  on("status", (s) => {
    el("hello").textContent = `${s.child.name}, ${s.child.age} · ${s.child.mode} mode`;
    el("who").textContent = s.child.companion;
  });

  el("openMic").checked = Boolean(SR) && !isMobile;
  el("startBtn").onclick = () => {
    PORTAL.unlockAudio();
    el("start").hidden = true;
    PORTAL.setTruthExtra([
      ["Voice out: on-device TTS", "real"],
      SR ? ["Speech-to-text: browser service (cloud)", "sim"] : ["Speech-to-text: unavailable, type instead", "off"],
    ]);
    PORTAL.connect("child");
    refreshPicker();
  };
})();

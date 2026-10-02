// Game Forge page: the agent writes a rules object, the fixed engine runs it in a
// sandboxed iframe, and the rules are shown as blocks the child can change by voice.
(() => {
  const { api, speak, el } = PORTAL;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let engineSource = "";
  let rules = null;
  let previous = {};

  const escapeHtml = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // A complete, standalone game page. The CSP forbids every network request, and the
  // iframe sandbox gives it an opaque origin, so the game cannot reach PORTAL or the web.
  function gamePage(r) {
    const data = JSON.stringify(r).replace(/</g, "\\u003c");
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(r.title)}</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000;touch-action:none}canvas{display:block;width:100%;height:100%}</style>
</head><body><canvas id="c"></canvas><script>${engineSource}
portalGame(${data});<\/script></body></html>`;
  }

  function blocksFor(r) {
    const who = r.player.emoji;
    const list = [{ key: "player", cls: "player", text: `${who} is the player`, small: `moves left and right at speed ${r.player.speed}`, data: r.player }];
    r.things.forEach((t, i) => {
      const what = t.look === "math" ? "a maths problem" : t.look;
      const effect = t.does === "hurt" ? "lose 1 life" : `score ${t.points} point${t.points === 1 ? "" : "s"}`;
      list.push({ key: `thing${i}`, cls: `touch-${t.does}`, text: `When ${who} touches ${what}: ${effect}`,
        small: `drops every ${t.every} seconds, falling at speed ${t.fall_speed}`, data: t });
    });
    if (r.quiz.on) {
      list.push({ key: "quiz", cls: "quiz", text: `Every ${r.quiz.every} seconds, ask a sum (${r.quiz.ops.join(" ")}) with numbers up to ${r.quiz.max}`,
        small: "catch the right answer: +3 points · wrong answer: lose 1 life", data: r.quiz });
    }
    list.push({ key: "goal", cls: "goal", text: `Win at ${r.win_score} points`, small: `you start with ${r.lives} lives · world: ${r.theme}`,
      data: [r.win_score, r.lives, r.theme] });
    return list;
  }

  function render(announce) {
    el("workshop").hidden = false;
    el("frame").srcdoc = gamePage(rules);
    const seen = {};
    el("blocks").replaceChildren(...blocksFor(rules).map((b) => {
      const sig = JSON.stringify(b.data);
      seen[b.key] = sig;
      const node = document.createElement("div");
      node.className = `block ${b.cls}${announce && previous[b.key] !== sig ? " changed" : ""}`;
      node.textContent = b.text;
      node.append(Object.assign(document.createElement("small"), { textContent: b.small }));
      return node;
    }));
    previous = seen;
    el("code").textContent = "// rules.js: written by the Game Forge from what you said.\n" +
      "// engine.js is fixed and sandboxed; it runs whatever rules you give it.\n\n" +
      `const rules = ${JSON.stringify(rules, null, 2)};\n\nportalGame(rules);`;
  }

  async function forge() {
    const idea = el("idea").value.trim() || el("idea").placeholder;
    PORTAL.unlockAudio();
    el("note").textContent = "Forging…";
    el("forge").disabled = true;
    try {
      const out = await api("/api/forge/create", { text: idea });
      rules = out.rules;
      previous = {};
      render(false);
      const how = out.by === "model" ? `written by the local AI model in ${out.attempts} attempt${out.attempts === 1 ? "" : "s"}` : "built by the keyword parser (no AI model running)";
      el("note").textContent = `${out.said} Rules ${how}.`;
      speak(out.said);
    } catch (e) {
      el("note").textContent = e.message;
    }
    el("forge").disabled = false;
  }

  async function change() {
    const instruction = el("change").value.trim();
    if (!instruction || !rules) return;
    el("apply").disabled = true;
    try {
      const out = await api("/api/forge/edit", { rules, instruction });
      rules = out.rules;
      el("change").value = "";
      el("changed").textContent = out.changed;
      render(true);
      speak(out.changed);
    } catch (e) {
      el("changed").textContent = e.message;
    }
    el("apply").disabled = false;
  }

  function listenInto(input, then) {
    if (!SR) {
      el("note").textContent = "No speech recognition in this browser. Type instead.";
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    let done = false;
    rec.onresult = (e) => {
      input.value = [...e.results].map((r) => r[0].transcript).join(" ");
      done = e.results[e.results.length - 1].isFinal;
    };
    rec.onend = () => { if (done) then(); };
    rec.start();
  }

  el("forge").onclick = forge;
  el("idea").onkeydown = (e) => { if (e.key === "Enter") forge(); };
  el("mic").onclick = () => listenInto(el("idea"), forge);
  el("apply").onclick = change;
  el("change").onkeydown = (e) => { if (e.key === "Enter") change(); };
  el("editMic").onclick = () => listenInto(el("change"), change);
  el("download").onclick = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([gamePage(rules)], { type: "text/html" }));
    link.download = `${rules.title.replace(/[^\w]+/g, "-").toLowerCase() || "game"}.html`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Forward movement keys to the game unless the child is typing.
  for (const type of ["keydown", "keyup"]) {
    document.addEventListener(type, (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || !rules) return;
      if (["ArrowLeft", "ArrowRight", "a", "d", " ", "Enter"].includes(e.key)) {
        el("frame").contentWindow.postMessage({ portalKey: e.key, down: type === "keydown" }, "*");
        if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault();
      }
    });
  }
  window.addEventListener("message", (e) => {
    if (e.source !== el("frame").contentWindow || !e.data || e.data.portal !== "game") return;
    if (e.data.event === "win") el("changed").textContent = "You won! Now make it harder: change a rule.";
    if (e.data.event === "lose") el("changed").textContent = "Too hard? Change a rule: slower, or more lives.";
  });

  PORTAL.setTruthExtra([["Game runs in a sandbox with no network", "real"]]);
  PORTAL.connect("forge");
  fetch("/js/engine.js").then((r) => r.text()).then((t) => { engineSource = t; });
})();

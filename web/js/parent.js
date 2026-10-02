// Parent page: teach rules by voice, see what the Brain is doing and why.
(() => {
  const { on, api, el } = PORTAL;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const make = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };

  // ------------------------------------------------------------------ rules
  async function loadRules() {
    renderRules(await api("/api/rules"));
  }

  function renderRules(rules) {
    el("rules").replaceChildren(...rules.map((r) => {
      const box = make("div", { className: `rule ${r.status}` });
      box.append(
        make("div", { className: "said", textContent: `You said: "${r.source_text}"` }),
        make("div", { className: "means", textContent: r.understanding }),
      );
      if (r.understanding_local) box.append(make("div", { className: "small", textContent: r.understanding_local }));
      const tag = { active: "Enforced on every device", draft: "Not enforced yet: confirm if this is right",
        needs_clarification: "One question before I can enforce this" }[r.status];
      box.append(make("div", { className: "small muted", textContent: `${tag} · understood by ${r.compiled_by === "model" ? "local AI model" : "keyword parser"}` }));
      const row = make("div", { className: "row", style: "margin-top:8px" });
      if (r.status === "needs_clarification") {
        const input = make("input", { type: "text", className: "grow", placeholder: "Your answer" });
        const answer = async () => {
          await api(`/api/rules/${r.id}/clarify`, { text: input.value });
          loadRules();
        };
        input.onkeydown = (e) => { if (e.key === "Enter") answer(); };
        box.append(make("div", { style: "margin-top:6px", textContent: r.clarify_question }));
        row.append(input, make("button", { textContent: "Answer", onclick: answer }));
      }
      if (r.status === "draft") {
        row.append(make("button", { className: "primary", textContent: "Yes, enforce this",
          onclick: async () => { await api(`/api/rules/${r.id}/confirm`, {}); loadRules(); } }));
      }
      row.append(make("button", { className: "ghost danger", textContent: "Remove",
        onclick: async () => { await api(`/api/rules/${r.id}`, undefined, "DELETE"); loadRules(); } }));
      box.append(row);
      return box;
    }));
  }

  el("ruleGo").onclick = async () => {
    const text = el("ruleText").value.trim();
    if (!text) return;
    el("ruleNote").textContent = "Working it out…";
    try {
      await api("/api/rules/compile", { text });
      el("ruleText").value = "";
      el("ruleNote").textContent = "";
      loadRules();
    } catch (e) {
      el("ruleNote").textContent = e.message;
    }
  };

  el("ruleMic").onclick = () => {
    if (!SR) {
      el("ruleNote").textContent = "No speech recognition in this browser. Type the rule instead.";
      return;
    }
    const rec = new SR();
    rec.lang = el("lang").value;
    rec.interimResults = true;
    el("ruleNote").textContent = "Listening…";
    rec.onresult = (e) => {
      el("ruleText").value = [...e.results].map((r) => r[0].transcript).join(" ");
    };
    rec.onend = () => { el("ruleNote").textContent = ""; };
    rec.onerror = (e) => { el("ruleNote").textContent = `Microphone: ${e.error}`; };
    rec.start();
  };

  // ------------------------------------------------------------ brain state
  on("brain/state", (b) => {
    el("driftBar").style.width = `${Math.min(100, b.drift.score * 100)}%`;
    el("driftMark").style.left = `${b.threshold * 100}%`;
    el("homework").checked = b.homework_done;
    if (document.activeElement !== el("speed")) el("speed").value = String(b.speed);
    const parts = Object.entries(b.drift.parts || {}).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" · ");
    const rows = [
      ["Drift", `${b.drift.score.toFixed(2)} of 1 (acts at ${b.threshold})`],
      ["Made of", parts || "nothing yet"],
      ["Brain is", b.phase + (b.pending ? `: waiting on ${b.pending}` : "") + (b.waiting ? ` (${b.waiting})` : "")],
      ["This sitting", `${b.watch_min} min passive`],
      ["Interruptions left", `${b.budget.left_this_hour} of ${b.budget.max_per_hour} this hour, at least ${b.budget.gap_min} min apart`],
      ["Extra time", b.extension_left ? `${b.extension_left} min left on an agreed extension` : `${b.extensions_today} extension(s) used today`],
      ["Watch", b.still_min === null ? "not paired" : `still for ${b.still_min} min, ${b.steps} steps`],
      ["Rules say", b.verdict && b.verdict.allowed === false ? b.verdict.reason : "allowed"],
      ["Clock", `${b.now}${b.pretend_time ? " (pretend)" : ""}`],
    ];
    el("brain").replaceChildren(...rows.flatMap(([k, v]) => [make("span", { textContent: k }), make("span", { textContent: v })]));
  });

  // -------------------------------------------------------------------- log
  function entry(d) {
    const time = new Date(d.ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const node = make("div", { className: `entry ${d.kind}`, id: d.id });
    const head = make("div", { className: "head" },
      make("span", { className: "kind", textContent: d.kind.replace("_", " ") }),
      make("span", { className: "muted small", textContent: `${time} · ${d.channel}${d.by ? ` · ${d.by}` : ""}${d.outcome ? ` · ${d.outcome}` : ""}` }));
    node.append(head, make("div", { textContent: d.reason }));
    if (d.child_said) node.append(make("div", { className: "muted", textContent: `Child: "${d.child_said}"` }));
    if (d.line) node.append(make("div", { className: "line", textContent: `PORTAL: "${d.line}"` }));
    if (d.false_interrupt) node.append(make("div", { className: "small", style: "color:var(--bad)", textContent: "Child flagged this as bad timing." }));
    return node;
  }

  async function loadLog() {
    const decisions = await api("/api/log");
    el("log").replaceChildren(...decisions.reverse().map(entry));
    if (!decisions.length) el("log").append(make("p", { className: "muted small", textContent: "Nothing yet. PORTAL logs every action and every time it holds back." }));
  }
  on("log/decision", loadLog);

  // ---------------------------------------------------------- metrics, map
  const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v * 100)}%`);

  async function loadNumbers() {
    const [m, genome] = await Promise.all([api("/api/metrics"), api("/api/genome")]);
    const tiles = [
      [m.passive_min, "passive min"], [m.active_min, "active min"], [pct(m.active_share), "of time was active"],
      [m.interventions, "interruptions"], [pct(m.acceptance_rate), "accepted"], [pct(m.false_interrupt_rate), "mistimed"],
      [`${m.quests_completed}/${m.quests_started}`, "quests finished"], [m.held_back, "times held back"], [m.rules_enforced, "rules enforced"],
    ];
    el("tiles").replaceChildren(...tiles.map(([v, label]) => make("div", { className: "tile" }, make("b", { textContent: v }), make("span", { className: "small muted", textContent: label }))));
    const l = m.latency_ms;
    const ms = (v) => (v === null ? "no data" : `${v} ms`);
    el("latency").textContent = `Latency (median): line written in ${ms(l.dare_generation_p50)} · pause landed ${ms(l.pause_after_breakpoint_p50)} after the breakpoint · barge-in ${ms(l.barge_in_p50)}`;
    const biggest = Math.max(1, ...genome.map((g) => g.watched_min + 10 * g.did + 10 * g.made));
    el("genome").replaceChildren(...genome.slice(0, 12).map((g) => {
      const weight = (g.watched_min + 10 * g.did + 10 * g.made) / biggest;
      const size = 64 + Math.round(70 * Math.sqrt(weight));
      return make("div", { className: `interest ${g.did || g.made ? "did" : ""}`, style: `width:${size}px;height:${size}px` },
        make("div", {}, g.topic, make("small", { textContent: `${g.watched_min} min · did ${g.did} · made ${g.made}` })));
    }));
    if (!genome.length) el("genome").append(make("p", { className: "muted small", textContent: "Fills in as videos are watched and quests are done." }));
  }

  // --------------------------------------------------------------- controls
  const ctx = (body) => api("/api/context", body);
  el("homework").onchange = () => ctx({ homework_done: el("homework").checked });
  el("speed").onchange = () => ctx({ speed: Number(el("speed").value) });
  el("jump").onclick = () => ctx({ jump_min: 10 });
  el("pretend").onchange = () => ctx({ pretend_time: el("pretend").value });
  el("pretendClear").onclick = () => { el("pretend").value = ""; ctx({ pretend_time: "" }); };
  el("saveChild").onclick = () => ctx({ child_name: el("childName").value, child_age: Number(el("childAge").value) });
  el("probe").onclick = () => api("/api/llm/probe", {});
  el("reset").onclick = async () => {
    await api("/api/demo/reset", {});
    loadRules(); loadLog(); loadNumbers();
  };

  on("status", (s) => {
    if (document.activeElement !== el("childName")) el("childName").value = s.child.name;
    if (document.activeElement !== el("childAge")) el("childAge").value = s.child.age;
    el("genomeTitle").textContent = `What ${s.child.name} is getting into`;
  });

  PORTAL.setTruthExtra([["Rules enforced by plain code, not AI", "real"]]);
  PORTAL.connect("parent");
  loadRules(); loadLog(); loadNumbers();
  setInterval(() => { loadNumbers(); loadLog(); }, 3000);
})();

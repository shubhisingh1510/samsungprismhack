// NEST game engine. Runs one rules object (written by the Game Forge agent) inside a
// sandboxed iframe: no network, no storage, no access to the page that hosts it.
function portalGame(rules) {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const THEMES = {
    space: ["#050818", "#1b1464"], sky: ["#4facfe", "#b8e8ff"], ocean: ["#023e8a", "#48cae4"],
    forest: ["#1b4332", "#74c69d"], night: ["#0d0b1e", "#3a1c71"], candy: ["#ff8fab", "#ffc8dd"], lava: ["#370617", "#e85d04"],
  };
  const dark = !["sky", "candy"].includes(rules.theme);
  const ink = dark ? "#fff" : "#1b1b2f";
  const dots = Array.from({ length: 40 }, () => [Math.random(), Math.random(), Math.random() * 1.6 + 0.4]);
  const keys = {};
  let W = 0, H = 0, u = 0, s = null, last = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    u = Math.min(W, H * 0.75) / 9;
  }

  function reset() {
    s = { x: W / 2, target: null, score: 0, lives: rules.lives, items: [], over: null, flash: 0, flashColor: "#f00",
      timers: rules.things.map((t) => 0.5 + Math.random() * t.every), quizIn: rules.quiz.on ? 3 : Infinity, question: null };
  }

  const rand = (n) => Math.floor(Math.random() * n);
  function sum(max) {
    const op = rules.quiz.ops[rand(rules.quiz.ops.length)] || "+";
    let a = 1 + rand(max), b = 1 + rand(max);
    if (op === "-") { if (b > a) [a, b] = [b, a]; return { text: `${a} - ${b}`, answer: a - b }; }
    if (op === "x") { a = 1 + rand(Math.min(10, max)); b = 1 + rand(10); return { text: `${a} x ${b}`, answer: a * b }; }
    return { text: `${a} + ${b}`, answer: a + b };
  }

  function ask() {
    const q = sum(rules.quiz.max);
    const choices = new Set([q.answer]);
    while (choices.size < 3) choices.add(Math.max(0, q.answer + (rand(2) ? 1 : -1) * (1 + rand(3))));
    const slots = [1, 3, 5].sort(() => Math.random() - 0.5);
    [...choices].forEach((value, i) => {
      s.items.push({ kind: "answer", value, correct: value === q.answer, x: (W * slots[i]) / 6, y: -u, v: H * 0.2 });
    });
    s.question = q;
  }

  function spawn(t) {
    const item = { kind: "thing", look: t.look, does: t.does, points: t.points, x: u + Math.random() * (W - 2 * u), y: -u,
      v: H * (0.12 + t.fall_speed * 0.06) };
    if (t.look === "math") item.text = sum(Math.min(12, rules.quiz.max)).text.replace(/ /g, "");
    s.items.push(item);
  }

  function hit(item) {
    if (item.kind === "answer") {
      if (item.correct) { s.score += 3; flash("#34d399"); } else { s.lives -= 1; flash("#fb7185"); }
      s.items = s.items.filter((i) => i.kind !== "answer");
      s.question = null;
      s.quizIn = rules.quiz.every;
      return;
    }
    if (item.does === "hurt") { s.lives -= 1; flash("#fb7185"); } else { s.score += item.points; flash("#fbbf24"); }
    s.items = s.items.filter((i) => i !== item);
  }

  function flash(color) { s.flash = 0.25; s.flashColor = color; }

  function finish(result) {
    s.over = result;
    parent.postMessage({ portal: "game", event: result, score: s.score }, "*");
  }

  function update(dt) {
    if (s.over) return;
    const speed = (rules.player.speed * W) / 9;
    if (keys.ArrowLeft || keys.a) { s.x -= speed * dt; s.target = null; }
    if (keys.ArrowRight || keys.d) { s.x += speed * dt; s.target = null; }
    if (s.target !== null) {
      const step = speed * 2.5 * dt;
      s.x += Math.max(-step, Math.min(step, s.target - s.x));
    }
    s.x = Math.max(u * 0.6, Math.min(W - u * 0.6, s.x));

    rules.things.forEach((t, i) => {
      s.timers[i] -= dt;
      if (s.timers[i] <= 0) { spawn(t); s.timers[i] = t.every * (0.7 + Math.random() * 0.6); }
    });
    if (rules.quiz.on && !s.question) {
      s.quizIn -= dt;
      if (s.quizIn <= 0) ask();
    }

    const py = H - u * 1.3;
    for (const item of [...s.items]) {
      item.y += item.v * dt;
      if (Math.abs(item.x - s.x) < u * 0.8 && Math.abs(item.y - py) < u * 0.8) hit(item);
    }
    s.items = s.items.filter((i) => i.y < H + u);
    if (s.question && !s.items.some((i) => i.kind === "answer")) { s.question = null; s.quizIn = rules.quiz.every; }
    s.flash = Math.max(0, s.flash - dt);
    if (s.score >= rules.win_score) finish("win");
    else if (s.lives <= 0) finish("lose");
  }

  function pill(text, x, y, fill, color) {
    ctx.font = `bold ${u * 0.5}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width + u * 0.6;
    ctx.fillStyle = fill;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - u * 0.42, w, u * 0.84, u * 0.3); else ctx.rect(x - w / 2, y - u * 0.42, w, u * 0.84);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function draw() {
    const [c1, c2] = THEMES[rules.theme] || THEMES.night;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = dark ? "#ffffff66" : "#ffffffaa";
    for (const [dx, dy, r] of dots) { ctx.beginPath(); ctx.arc(dx * W, dy * H, r, 0, 7); ctx.fill(); }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const item of s.items) {
      if (item.kind === "answer") pill(String(item.value), item.x, item.y, "#c4b5fd", "#1b1b2f");
      else if (item.look === "math") pill(item.text, item.x, item.y, "#fda4af", "#1b1b2f");
      else { ctx.font = `${u}px serif`; ctx.fillText(item.look, item.x, item.y); }
    }
    ctx.font = `${u * 1.25}px serif`;
    ctx.fillText(rules.player.emoji, s.x, H - u * 1.3);

    ctx.fillStyle = ink;
    ctx.font = `bold ${u * 0.5}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`⭐ ${s.score} / ${rules.win_score}`, u * 0.3, u * 0.5);
    ctx.textAlign = "right";
    ctx.fillText("❤️".repeat(Math.max(0, s.lives)), W - u * 0.3, u * 0.5);
    ctx.textAlign = "center";
    if (s.question) pill(`${s.question.text} = ?  catch the answer`, W / 2, u * 1.4, "#ffffffee", "#1b1b2f");

    if (s.flash > 0) {
      ctx.globalAlpha = s.flash * 1.4;
      ctx.fillStyle = s.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (s.over) {
      ctx.fillStyle = "#000a";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${u * 0.9}px system-ui, sans-serif`;
      ctx.fillText(s.over === "win" ? "You win! 🎉" : "So close!", W / 2, H / 2 - u * 0.4);
      ctx.font = `${u * 0.42}px system-ui, sans-serif`;
      ctx.fillText("Tap to play again, or change a rule", W / 2, H / 2 + u * 0.6);
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function press(key, down) {
    keys[key] = down;
    if (down && s.over && (key === " " || key === "Enter")) reset();
  }
  window.addEventListener("keydown", (e) => press(e.key, true));
  window.addEventListener("keyup", (e) => press(e.key, false));
  // The host page forwards arrow keys so the game works before the child clicks into it.
  window.addEventListener("message", (e) => { if (e.data && e.data.portalKey) press(e.data.portalKey, e.data.down); });
  canvas.addEventListener("pointerdown", (e) => { if (s.over) reset(); else s.target = e.clientX; });
  canvas.addEventListener("pointermove", (e) => { if (e.buttons || e.pointerType === "touch") s.target = e.clientX; });
  window.addEventListener("resize", resize);

  resize();
  reset();
  parent.postMessage({ portal: "game", event: "ready" }, "*");
  requestAnimationFrame(frame);
}

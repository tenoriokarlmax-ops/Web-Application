/* app.js — UI: navigation, the three calculator modes, and the sparkle effect. */
import { gaussJordan, balance, fmt } from "./calc.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => Object.assign(document.createElement("div"), { textContent: s }).innerHTML;
const sub = (f) => esc(f).replace(/(\d+)/g, "<sub>$1</sub>");           // H2O → H₂O
const errorBox = (msg) => `<div class="result result--error" role="alert"><strong>Check your input</strong><p>${esc(msg)}</p></div>`;

/* ---------- Navigation (hash routing keeps Calculator and About on separate screens) ---------- */
function route() {
  const h = location.hash.slice(1), page = ["about", "applications"].includes(h) ? h : "calculator";
  ["calculator", "about", "applications"].forEach((p) => ($(`#page-${p}`).hidden = p !== page));
  document.querySelectorAll("nav a").forEach((a) => a.toggleAttribute("aria-current", a.dataset.page === page));
  window.scrollTo(0, 0);
  sizeSparkles();
}
window.addEventListener("hashchange", route);

/* ---------- Matrix helpers ---------- */
const matrixHTML = (m) => `<div class="display-matrix" style="--cols:${m[0].length}">${m.flatMap((r) =>
  r.map((v, i) => `${i === r.length - 1 ? "<i></i>" : ""}<span>${fmt(v)}</span>`)).join("")}</div>`;
const stepsHTML = (steps) => `<div class="steps">${steps.map((s, i) =>
  `<details${i === steps.length - 1 ? " open" : ""}><summary><b>${i + 1}</b>${esc(s.label)}</summary>${matrixHTML(s.matrix)}</details>`).join("")}</div>`;

/* ---------- Mode 1: Gauss–Jordan ---------- */
function gaussMode(root, preload) {
  const st = preload ? { rows: preload.length, vars: preload[0].length - 1, m: preload.map((r) => r.map(String)) } : { rows: 3, vars: 3, m: [["2", "1", "-1", "8"], ["-3", "-1", "2", "-11"], ["-2", "1", "2", "-3"]] };
  const draw = () => {
    root.innerHTML = `
      <h2>Gauss–Jordan elimination</h2>
      <p class="lede">Enter an augmented matrix: coefficients first, constants in the last column. Non-square systems are allowed.</p>
      <p class="link-note">Chemical balancing is a linear system too. <button type="button" class="linkbtn" data-mode="chem">Try the balancer</button></p>
      <div class="controls">
        ${["rows", "vars"].map((k) => `<div class="stepper"><span>${k === "rows" ? "Equations" : "Variables"}</span>
          <button type="button" data-k="${k}" data-d="-1" aria-label="Fewer ${k}">−</button><strong>${st[k]}</strong>
          <button type="button" data-k="${k}" data-d="1" aria-label="More ${k}">+</button></div>`).join("")}
        <button type="button" class="btn btn--ghost" id="g-example">Load example</button>
      </div>
      <div class="grid-wrap"><div class="grid" style="--cols:${st.vars + 1}">${st.m.flatMap((r, i) => r.map((v, j) =>
        `<input type="number" step="any" value="${esc(v)}" data-i="${i}" data-j="${j}" aria-label="Equation ${i + 1}, ${j === st.vars ? "constant" : "coefficient " + (j + 1)}" class="${j === st.vars ? "const" : ""}">`)).join("")}</div></div>
      <div class="row"><button type="button" class="btn btn--primary" id="g-solve">Reduce matrix</button>
      <button type="button" class="btn btn--ghost" id="g-clear">Clear</button></div>
      <div id="g-out" aria-live="polite"></div>`;
  };
  const resize = (k, d) => {
    const rows = Math.min(6, Math.max(2, st.rows + (k === "rows" ? d : 0))), vars = Math.min(6, Math.max(1, st.vars + (k === "vars" ? d : 0)));
    st.m = Array.from({ length: rows }, (_, i) => Array.from({ length: vars + 1 }, (_, j) =>
      j === vars ? st.m[i]?.[st.vars] ?? "0" : st.m[i]?.[j] ?? "0"));
    st.rows = rows; st.vars = vars; draw();
  };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.mode) return showMode(b.dataset.mode);
    if (b.dataset.k) resize(b.dataset.k, +b.dataset.d);
    if (b.id === "g-example") { Object.assign(st, { rows: 3, vars: 3, m: [["2", "1", "-1", "8"], ["-3", "-1", "2", "-11"], ["-2", "1", "2", "-3"]] }); draw(); }
    if (b.id === "g-clear") { st.m = st.m.map((r) => r.map(() => "0")); draw(); }
    if (b.id === "g-solve") {
      const out = $("#g-out", root);
      try {
        const a = gaussJordan(st.m);
        out.innerHTML = `<div class="result result--${a.type}"><div><h3>${a.summary}</h3><p>${a.detail}</p></div>
          ${a.solutions ? `<div class="chips">${a.solutions.map((v, i) => `<span>x<sub>${i + 1}</sub> = <b>${fmt(v)}</b></span>`).join("")}</div>` : ""}</div>
          <h3 class="sub">Solution path (${a.steps.length} steps)</h3>${stepsHTML(a.steps)}`;
      } catch (err) { out.innerHTML = errorBox(err.message); }
    }
  });
  root.addEventListener("input", (e) => { const t = e.target; if (t.dataset.i) st.m[t.dataset.i][t.dataset.j] = t.value; });
  draw();
  if (preload) $("#g-solve", root).click();                              // run immediately when opened from another page
}

/* ---------- Mode 2: Chemical equation balancer ---------- */
function chemMode(root, preload) {
  let last = null;                                                        // most recent balanced result
  const examples = ["H2 + O2 -> H2O", "Fe + O2 -> Fe2O3", "C3H8 + O2 -> CO2 + H2O", "Al + HCl -> AlCl3 + H2"];
  root.innerHTML = `
    <h2>Chemical equation balancer</h2>
    <p class="lede">Type an unbalanced equation using an arrow (<code>-></code>). Use capital letters for elements and parentheses for groups, like <code>Ca(OH)2</code>.</p>
    <p class="link-note"><strong>Powered by Gauss–Jordan.</strong> Each element becomes a linear equation, and this balancer solves them with the same elimination as the solver. <button type="button" class="linkbtn" data-mode="gauss">Open the solver</button></p>
    <label class="field">Equation<input id="c-in" type="text" value="${esc(preload || examples[0])}" autocomplete="off" spellcheck="false"></label>
    <div class="row"><button type="button" class="btn btn--primary" id="c-go">Balance equation</button></div>
    <div class="chips chips--pick" aria-label="Examples">${examples.map((x) => `<button type="button" data-ex="${x}">${sub(x)}</button>`).join("")}</div>
    <div id="c-out" aria-live="polite"></div>`;
  const run = () => {
    const out = $("#c-out", root);
    try {
      const r = last = balance($("#c-in", root).value);
      const L = "abcdefghijklmnop", n = r.species.length;
      const eqs = r.elements.map((el, ri) => {
        const side = (from, to) => r.species.slice(from, to).map((_, k) => ({ c: Math.abs(r.counts[ri][from + k]), v: L[from + k] })).filter((t) => t.c)
          .map((t) => (t.c > 1 ? t.c : "") + t.v).join(" + ");
        return `<li><b>${el}</b>: ${side(0, r.nLeft)} = ${side(r.nLeft, n)}</li>`;
      }).join("");
      out.innerHTML = `<div class="result result--unique"><div><h3>Balanced equation</h3>
        <p class="big">${r.text.split(" ").map((p) => (p === "+" || p === "→" ? p : p.replace(/^(\d+)(.*)$/, "$1$2")).replace(/(\D)(\d+)/g, "$1<sub>$2</sub>")).join(" ")}</p></div></div>
        <h3 class="sub">How it was balanced</h3>
        <ol class="logic">
          <li>Give each compound a unknown coefficient: ${r.species.map((s, i) => `<b>${L[i]}</b>·${sub(s)}`).join(", ")}.</li>
          <li>Atoms are conserved, so each element gives one equation (left side = right side):<ul class="eqs">${eqs}</ul></li>
          <li>Rewrite these as a matrix (products negative) and reduce it with <b>Gauss–Jordan elimination</b>, exactly as the solver does. One free variable remains, so set it to 1 and read the others.</li>
          <li>Scale to the smallest whole numbers: <b>${r.coefficients.join(", ")}</b>.</li></ol>
        <h3 class="sub">Gauss–Jordan work (${r.steps.length} steps)</h3>${stepsHTML(r.steps)}
        <div class="row"><button type="button" class="btn btn--ghost" id="c-open">Open this matrix in the Gauss–Jordan solver</button></div>`;
    } catch (err) { out.innerHTML = errorBox(err.message); }
  };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.ex) { $("#c-in", root).value = b.dataset.ex; run(); }
    if (b.id === "c-go") run();
    if (b.dataset.mode) return showMode(b.dataset.mode);
    if (b.id === "c-open" && last) openInSolver(last.counts.map((row) => [...row, 0]));
  });
  $("#c-in", root).addEventListener("keydown", (e) => e.key === "Enter" && run());
  run();
}

/* ---------- Mode selector (Calculator page) ---------- */
const modes = [
  { id: "gauss", label: "Gauss–Jordan solver", hint: "Solve any system of linear equations", init: gaussMode },
  { id: "chem", label: "Chemical balancer", hint: "Balance reactions with the same method", init: chemMode },
];
const tabs = $(".tabs");
function showMode(id, arg) {
  tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.id === id));
  const old = $("#mode-panel"), fresh = old.cloneNode(false);            // fresh node drops old listeners
  old.replaceWith(fresh);
  modes.find((m) => m.id === id).init(fresh, arg);
}
tabs.innerHTML = modes.map((m) => `<button type="button" role="tab" data-id="${m.id}"><strong>${m.label}</strong><span>${m.hint}</span></button>`).join("");
tabs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) showMode(b.dataset.id); });
// Jump into a calculator with data pre-filled (used by the Applications page and the mode links)
function openInSolver(matrix) { showMode("gauss", matrix); location.hash = "#calculator"; }
function openInBalancer(eq) { showMode("chem", eq); location.hash = "#calculator"; }

/* ---------- Real-world applications page ---------- */
const apps = [
  { title: "Balancing chemical reactions", field: "Chemistry", balancer: "C3H8 + O2 -> CO2 + H2O",
    text: "Atoms are never created or destroyed, so every element gives one equation. Fixing a = 1 pins down the scale of the unknown coefficients.",
    eqs: ["a = 1", "3a − c = 0   (carbon)", "8a − 2d = 0   (hydrogen)", "2b − 2c − d = 0   (oxygen)"],
    matrix: [[1, 0, 0, 0, 1], [3, 0, -1, 0, 0], [8, 0, 0, -2, 0], [0, 2, -2, -1, 0]],
    answer: "a = 1, b = 5, c = 3, d = 4, so C₃H₈ + 5O₂ → 3CO₂ + 4H₂O." },
  { title: "Solving circuits with Kirchhoff’s laws", field: "Electrical engineering",
    text: "Current in equals current out at a junction, and voltage drops around a loop add up to the source. Each law is one linear equation in the unknown currents.",
    eqs: ["I₁ − I₂ − I₃ = 0   (junction)", "2I₁ + 4I₂ = 22   (loop with a 22 V source)", "4I₂ − 6I₃ = 0   (loop through both branches)"],
    matrix: [[1, -1, -1, 0], [2, 4, 0, 22], [0, 4, -6, 0]],
    answer: "I₁ = 5 A, I₂ = 3 A, I₃ = 2 A." },
  { title: "Supply and demand equilibrium", field: "Economics",
    text: "A market settles where the quantity buyers want equals the quantity sellers offer. Add more goods and you get a larger linear system, the idea behind input–output models.",
    eqs: ["Q + 2P = 100   (demand: Q = 100 − 2P)", "Q − 4P = −20   (supply: Q = −20 + 4P)"],
    matrix: [[1, 2, 100], [1, -4, -20]],
    answer: "x₁ = Q = 60 units at x₂ = P = 20 price." },
  { title: "Changing coordinates in graphics", field: "Computer graphics",
    text: "Cameras, characters and objects each have their own coordinate frame. Finding a point’s coordinates in another frame means solving a small linear system. Here (4, 5) is written as a·(2, 1) + b·(−1, 1).",
    eqs: ["2a − b = 4   (x-coordinate)", "a + b = 5   (y-coordinate)"],
    matrix: [[2, -1, 4], [1, 1, 5]],
    answer: "a = 3, b = 2." },
  { title: "Traffic and network flow", field: "Civil engineering and logistics",
    text: "Cars entering a junction must leave it. These networks often have one free variable, so one extra traffic count pins the rest down. The solver reports this as infinitely many solutions.",
    eqs: ["x₁ + x₂ = 500   (junction A)", "x₂ − x₃ = −200   (junction B)", "x₁ + x₃ = 700   (junction C)"],
    matrix: [[1, 1, 0, 500], [0, 1, -1, -200], [1, 0, 1, 700]],
    answer: "One free variable. For example, if x₃ = 300 then x₂ = 100 and x₁ = 400." },
  { title: "Fitting a curve through data", field: "Data science",
    text: "A parabola y = a + bx + cx² through three measured points gives three equations in a, b and c. Regression and interpolation build on this idea.",
    eqs: ["a + b + c = 6   (point x = 1, y = 6)", "a + 2b + 4c = 11   (point x = 2, y = 11)", "a + 3b + 9c = 18   (point x = 3, y = 18)"],
    matrix: [[1, 1, 1, 6], [1, 2, 4, 11], [1, 3, 9, 18]],
    answer: "a = 3, b = 2, c = 1, so y = 3 + 2x + x²." },
];
$("#apps-list").innerHTML = apps.map((p, i) => `<article class="card app"><p class="tag">${p.field}</p><h2>${p.title}</h2><p>${p.text}</p>
  <pre class="eqs-block">${p.eqs.join("\n")}</pre><p class="note">Answer: ${p.answer}</p>
  <div class="row"><button type="button" class="btn btn--primary" data-i="${i}" data-act="solver">Open in the Gauss–Jordan solver</button>
  ${p.balancer ? `<button type="button" class="btn btn--ghost" data-i="${i}" data-act="chem">Open in the chemical balancer</button>` : ""}</div></article>`).join("");
$("#apps-list").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const p = apps[b.dataset.i];
  b.dataset.act === "chem" ? openInBalancer(p.balancer) : openInSolver(p.matrix);
});

/* ---------- About page: live worked example from the real solver ---------- */
$("#about-example").innerHTML = stepsHTML(gaussJordan([[1, 1, 3], [2, -1, 0]]).steps) + `<p class="note">Result: x = 1, y = 2.</p>`;

/* ---------- Sparkle effect: ~1 star per 40px of width, drawn on one small canvas ---------- */
const canvas = $("#sparkles"), ctx = canvas.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let W = 0, H = 0, stars = [], raf = 0, onScreen = true;
function sizeSparkles() {
  const r = canvas.parentElement.getBoundingClientRect(), d = devicePixelRatio || 1;
  W = r.width; H = r.height; canvas.width = W * d; canvas.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
  stars = Array.from({ length: Math.round(W / 40) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 2 + Math.random() * 5, p: Math.random() * 6.28, s: 0.5 + Math.random() * 1.2 }));
  frame(performance.now());
}
function sparkle(x, y, r, a) {                                              // four-point star
  ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x, y - r);
  [[x + r, y], [x, y + r], [x - r, y], [x, y - r]].forEach(([px, py]) => ctx.quadraticCurveTo(x, y, px, py)); ctx.fill();
}
function frame(t) {
  cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#c2417a";
  stars.forEach((s) => sparkle(s.x, s.y, s.r, 0.15 + 0.5 * (0.5 + 0.5 * Math.sin((t / 1000) * s.s + s.p))));
  if (!reduced && onScreen && !document.hidden) raf = requestAnimationFrame(frame);   // static when reduced-motion / offscreen / hidden tab
}
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) frame(performance.now()); }).observe(canvas);
document.addEventListener("visibilitychange", () => frame(performance.now()));
window.addEventListener("resize", sizeSparkles);

showMode("gauss");
route();

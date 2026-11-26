/* calc.js — pure calculator logic (no DOM). */
const EPS = 1e-10;
const near0 = (v) => Math.abs(v) < EPS;
const clean = (v) => { if (near0(v)) return 0; const r = Math.round(v); return Math.abs(v - r) < EPS ? r : v; };
export const fmt = (v) => (near0(v) ? "0" : Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4))));

/* ---------- Mode 1: Gauss–Jordan elimination ---------- */
// input: array of rows (last column = constants). Returns RREF, recorded steps and classification.
export function gaussJordan(input) {
  if (!input.length) throw new Error("Enter at least one equation.");
  const width = input[0].length;
  if (width < 2 || input.some((r) => r.length !== width)) throw new Error("Every row must have the same number of values.");
  const m = input.map((r) => r.map((v) => {
    const n = Number(v);
    if (v === "" || !Number.isFinite(n)) throw new Error("Every matrix entry must be a valid number. Fill in or clear any empty cells.");
    return n;
  }));
  const steps = [{ label: "Starting augmented matrix", matrix: m.map((r) => [...r]) }];
  const snap = (label) => steps.push({ label, matrix: m.map((r) => [...r]) });
  let p = 0;
  for (let c = 0; c < width - 1 && p < m.length; c++) {
    let best = p;                                           // 1. partial pivoting
    for (let r = p + 1; r < m.length; r++) if (Math.abs(m[r][c]) > Math.abs(m[best][c])) best = r;
    if (near0(m[best][c])) continue;
    if (best !== p) { [m[p], m[best]] = [m[best], m[p]]; snap(`Swap R${p + 1} and R${best + 1}`); }
    const pv = m[p][c];                                     // 2. scale pivot to 1
    if (!near0(pv - 1)) { m[p] = m[p].map((v) => clean(v / pv)); snap(`Scale R${p + 1} by 1/${fmt(pv)}`); }
    for (let r = 0; r < m.length; r++) {                    // 3. clear the column
      if (r === p || near0(m[r][c])) continue;
      const f = m[r][c];
      m[r] = m[r].map((v, i) => clean(v - f * m[p][i]));
      snap(`R${r + 1} ← R${r + 1} ${f < 0 ? "+" : "−"} ${fmt(Math.abs(f))}·R${p + 1}`);
    }
    p++;
  }
  snap("Reduced row echelon form");
  const n = width - 1;
  if (m.some((r) => r.slice(0, n).every(near0) && !near0(r[n]))) return { matrix: m, steps, type: "none", summary: "No solution", detail: "A row reads 0 = nonzero, so the equations contradict each other." };
  const pivots = m.filter((r) => r.slice(0, n).some((v) => !near0(v))).length;
  if (pivots < n) return { matrix: m, steps, type: "infinite", summary: "Infinitely many solutions", detail: `${n - pivots} free variable${n - pivots === 1 ? "" : "s"} remain, so the system is underdetermined or dependent.` };
  const solutions = Array.from({ length: n }, (_, c) => clean(m.find((r) => !near0(r[c]))[n]));
  return { matrix: m, steps, type: "unique", summary: "Unique solution", detail: "Every variable has a pivot.", solutions };
}

/* ---------- Mode 2: Chemical equation balancer ---------- */
// Parses a formula such as Ca(OH)2 into {Ca:1, O:2, H:2}. Supports nested parentheses.
function parseFormula(raw) {
  const f = raw.replace(/^\d+/, "");                        // ignore any coefficient the user typed
  const stack = [{}], re = /([A-Z][a-z]?)(\d*)|\(|\)(\d*)/y;
  let i = 0;
  if (!f) throw new Error("Found an empty compound. Check for a stray + sign.");
  while (i < f.length) {
    re.lastIndex = i;
    const t = re.exec(f);
    if (!t) throw new Error(`Can't read "${raw}". Element symbols start with a capital letter (Na, not na) and only letters, numbers and parentheses are allowed.`);
    i = re.lastIndex;
    const top = stack[stack.length - 1];
    if (t[1]) top[t[1]] = (top[t[1]] || 0) + (t[2] ? +t[2] : 1);
    else if (t[0] === "(") stack.push({});
    else {
      if (stack.length < 2) throw new Error(`Unmatched ")" in "${raw}".`);
      const g = stack.pop(), k = t[3] ? +t[3] : 1, up = stack[stack.length - 1];
      for (const e in g) up[e] = (up[e] || 0) + g[e] * k;
    }
  }
  if (stack.length !== 1) throw new Error(`Unmatched "(" in "${raw}".`);
  return stack[0];
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function balance(text) {
  const sides = text.split(/->|→|=>|=/);
  if (sides.length !== 2 || sides.some((s) => !s.trim())) throw new Error("Write the equation with one arrow, like H2 + O2 -> H2O.");
  const left = sides[0].split("+").map((s) => s.trim()), right = sides[1].split("+").map((s) => s.trim());
  const species = [...left, ...right].map((s) => s.replace(/^\d+/, ""));
  const comps = species.map(parseFormula);
  const elements = [...new Set(comps.flatMap((c) => Object.keys(c)))];
  for (const e of elements) {
    const inL = comps.slice(0, left.length).some((c) => c[e]), inR = comps.slice(left.length).some((c) => c[e]);
    if (!inL || !inR) throw new Error(`${e} appears on only one side, so the equation can't be balanced.`);
  }
  // Rows = elements, columns = compounds (products negative) → solve A·x = 0
  const A = elements.map((e) => comps.map((c, i) => (c[e] || 0) * (i < left.length ? 1 : -1)));
  const gj = gaussJordan(A.map((r) => [...r, 0]));
  const n = species.length, pivotOf = {};
  gj.matrix.forEach((r, ri) => { const c = r.slice(0, n).findIndex((v) => !near0(v)); if (c >= 0) pivotOf[c] = ri; });
  const free = [...Array(n).keys()].filter((c) => !(c in pivotOf));
  if (!free.length) throw new Error("No positive whole-number coefficients balance this equation. Check the formulas.");
  if (free.length > 1) throw new Error("This equation has more than one independent solution (it may combine several reactions). Split it into separate equations.");
  const v = Array(n).fill(0); v[free[0]] = 1;
  for (const c in pivotOf) v[c] = -gj.matrix[pivotOf[c]][free[0]];
  let k = 1;                                                // smallest multiplier giving integers
  while (k < 2000 && !v.every((x) => Math.abs(x * k - Math.round(x * k)) < 1e-6)) k++;
  let co = v.map((x) => Math.round(x * k));
  if (co.every((x) => x < 0)) co = co.map((x) => -x);
  if (co.some((x) => x <= 0)) throw new Error("No positive whole-number coefficients balance this equation. Check the formulas.");
  const g = co.reduce(gcd); co = co.map((x) => x / g);
  const term = (i) => (co[i] > 1 ? co[i] : "") + species[i];
  return {
    steps: gj.steps, species, coefficients: co, elements, counts: A, nLeft: left.length,
    text: `${species.slice(0, left.length).map((_, i) => term(i)).join(" + ")} → ${species.slice(left.length).map((_, i) => term(i + left.length)).join(" + ")}`,
  };
}

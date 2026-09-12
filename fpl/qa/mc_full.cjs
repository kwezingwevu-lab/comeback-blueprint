/*
 * qa/mc_full.cjs — transpile-and-fuzz suite for the assembled app (CLAUDE.md H1).
 *
 * What it does
 *   1. Transpiles app/FPL_Mission_Control.jsx with esbuild (--jsx=transform, loader jsx,
 *      format cjs) and evaluates it against stubs for react / react-dom / recharts /
 *      lucide-react, so the whole shipped file — engine, weekly block, live data and every
 *      UI function — is in scope without a browser.
 *   2. Extracts EVERY top-level function by name (a capture epilogue appended before the
 *      transpile, so a name that esbuild renamed or dropped shows up as missing, not as a
 *      silent gap).
 *   3. Fuzzes each function with the 20 junk kinds, mixed with valid arguments drawn from a
 *      synthetic CONTRACT §3 snapshot, and evaluates all 38 property groups on every call.
 *
 * Accounting
 *   iterations  = fuzz trials actually executed (argv[2], default 3000; release 25000)
 *   assertions  = iterations × 38 property groups + the fixture assertions
 *   functions   = <passed>/<total>: a function passes when no property group flagged it
 *   failures    = property-group violations
 *
 * Three contracts, not one — stated here so no one has to guess what "nothing throws" means:
 *   · TOTAL functions (the engine's own header rule: "every function is total") must never
 *     throw on any junk. Group P01.
 *   · parseJson and applyRefresh throw by specification (D4). Group P02 asserts they throw a
 *     real, named message — a silent return would be the failure.
 *   · React components require props. React never calls them with junk, so P01 does not apply;
 *     group P03 asserts they reject junk props with a TypeError and nothing worse (no hang, no
 *     RangeError, no global leak). Their real rendering is covered by smoke.cjs and buttons.cjs.
 *
 * One limit worth knowing: the suite is single-threaded, so it cannot time out a synchronous
 * loop from inside it. A genuinely unbounded loop shows up as a run that never finishes, not as
 * a P04 failure — that is how E-035 (binomial looping 1e308 times) was found.
 *
 * Run: node --stack-size=4000 qa/mc_full.cjs [iterations] [seed]
 */

"use strict";

const fs = require("fs");
const path = require("path");
const WT = require("worker_threads");

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "app", "FPL_Mission_Control.jsx");
const ITERS = Math.max(1, Math.floor(Number(process.argv[2]) || 3000));
const SEED = Math.floor(Number(process.argv[3]) || 20260911);

/* ---------------------------------------------------------------- the watchdog
 *
 * The suite used to run in one thread, which meant it could not time out a synchronous loop
 * from inside itself: a genuinely unbounded loop appeared as a run that never finished rather
 * than as a named failure. That is how E-035 (binomial looping 1e308 times) was found — by a
 * human noticing the suite had not returned.
 *
 * The whole fuzz run now happens in a worker thread. Before every trial the worker writes the
 * function name and the junk kinds into a SharedArrayBuffer and bumps a counter; the parent
 * thread, which has nothing else to do, watches that counter. A trial that has not returned
 * within the budget is printed as `FAIL mc_full-watchdog — <function> <kinds> …`, the worker is
 * terminated and the suite exits 1. Iteration counts and per-trial timings are unchanged; the
 * only new cost is the worker start-up and a 1.5 s self-test that proves the watchdog fires.
 *
 * Layout of the shared buffer: Int32Array[0] = trial counter · [1] = label byte length ·
 * bytes 64.. = the UTF-8 label of the trial in flight.
 */
const WATCHDOG_MS = Math.max(2000, Math.floor(Number(process.env.MC_WATCHDOG_MS) || 10000));
const STARTUP_MS = Math.max(20000, Math.floor(Number(process.env.MC_STARTUP_MS) || 120000));
const SAB_BYTES = 320;
const LABEL_OFF = 64;

function readLabel(sab) {
  try {
    const i32 = new Int32Array(sab, 0, 2);
    const len = Math.max(0, Math.min(SAB_BYTES - LABEL_OFF, Atomics.load(i32, 1)));
    if (!len) return "(no trial started yet)";
    return new TextDecoder().decode(new Uint8Array(sab, LABEL_OFF, len));
  } catch (e) { return "(label unreadable)"; }
}

/* One watcher, used by the self-test and by the real run, so the mechanism that guards the
   suite is the mechanism the suite proves. Resolves {stalled, label, beats, code}. */
function watch(worker, sab, budgetMs, startupMs) {
  return new Promise(function (resolve) {
    const i32 = new Int32Array(sab, 0, 2);
    let lastBeat = -1;
    let lastChange = Date.now();
    let settled = false;
    const timer = setInterval(function () {
      if (settled) return;
      const beat = Atomics.load(i32, 0);
      if (beat !== lastBeat) { lastBeat = beat; lastChange = Date.now(); return; }
      const budget = beat > 0 ? budgetMs : startupMs;
      if (Date.now() - lastChange > budget) {
        settled = true;
        clearInterval(timer);
        const label = readLabel(sab);
        worker.terminate();
        resolve({ stalled: true, label: label, beats: beat, waited: Date.now() - lastChange });
      }
    }, 200);
    worker.on("exit", function (code) {
      if (settled) return;
      settled = true; clearInterval(timer);
      resolve({ stalled: false, code: code, beats: Atomics.load(i32, 0) });
    });
    worker.on("error", function (err) {
      if (settled) return;
      settled = true; clearInterval(timer);
      resolve({ stalled: false, code: 1, error: err, beats: Atomics.load(i32, 0) });
    });
  });
}

/* The parent. It proves the watchdog on a worker that really does loop for ever, then runs the
   suite in a second worker under the same watcher. */
if (WT.isMainThread && process.env.MC_NO_WORKER !== "1") {
  (async function supervise() {
    const selfSab = new SharedArrayBuffer(SAB_BYTES);
    const SELF_BUDGET = 1500;
    const SELF_SRC = [
      "const { workerData } = require('worker_threads');",
      "const i32 = new Int32Array(workerData.sab, 0, 2);",
      "const bytes = new TextEncoder().encode('deliberateInfiniteLoop|self-test');",
      "new Uint8Array(workerData.sab, 64, bytes.length).set(bytes);",
      "Atomics.store(i32, 1, bytes.length);",
      "Atomics.add(i32, 0, 1);",
      "while (true) { Math.sqrt(2); }"
    ].join("\n");
    const t0 = Date.now();
    const selfWorker = new WT.Worker(SELF_SRC, { eval: true, workerData: { sab: selfSab } });
    const selfOut = await watch(selfWorker, selfSab, SELF_BUDGET, 20000);
    const selfMs = Date.now() - t0;
    const selfOk = selfOut.stalled === true && /deliberateInfiniteLoop/.test(String(selfOut.label));
    console.log((selfOk ? "PASS " : "FAIL ") + "mc_full-watchdog-self-test-names-an-unbounded-loop — " +
      (selfOut.stalled ? "named «" + selfOut.label + "» after " + selfMs + " ms (budget " + SELF_BUDGET + " ms)" :
        "the loop was NOT caught: " + JSON.stringify(selfOut)));

    const sab = new SharedArrayBuffer(SAB_BYTES);
    const worker = new WT.Worker(__filename, {
      argv: [String(ITERS), String(SEED)],
      workerData: { sab: sab, selfTest: { ok: selfOk, ms: selfMs, budget: SELF_BUDGET, label: String(selfOut.label) } },
      resourceLimits: { stackSizeMb: 8 }
    });
    const out = await watch(worker, sab, WATCHDOG_MS, STARTUP_MS);
    if (out.stalled) {
      console.log("");
      console.log("FAIL mc_full-watchdog — «" + out.label + "» did not return within " + WATCHDOG_MS +
        " ms (trial " + out.beats + "); the worker was terminated");
      console.log("SUITE mc_full " + out.beats + " iters · watchdog timeout · 0/0 · 1");
      process.exit(1);
    }
    if (out.error) console.log("FAIL mc_full — the worker errored: " + (out.error && out.error.message ? out.error.message : String(out.error)));
    process.exit(selfOk ? (out.code || 0) : 1);
  })();
  return;                                   // CommonJS module scope: the worker runs the rest
}

/* The worker. Heartbeat helpers write into the buffer the parent is watching. */
const SAB = WT.workerData && WT.workerData.sab ? WT.workerData.sab : new SharedArrayBuffer(SAB_BYTES);
const BEAT = new Int32Array(SAB, 0, 2);
const LABEL = new Uint8Array(SAB, LABEL_OFF, SAB_BYTES - LABEL_OFF);
const ENC = new TextEncoder();
function heartbeat(label) {
  const b = ENC.encode(String(label).slice(0, SAB_BYTES - LABEL_OFF - 1));
  LABEL.set(b.subarray(0, LABEL.length));
  Atomics.store(BEAT, 1, Math.min(b.length, LABEL.length));
  Atomics.add(BEAT, 0, 1);
}

// ---------------------------------------------------------------- reporting

let assertions = 0;
let failCount = 0;
const failures = [];
const fnBad = {};                      // fnName → [group ids]
const groupHits = {};                  // group id → {run, failed}

function record(groupId, groupName, fnName, ok, detail) {
  assertions++;
  const g = groupHits[groupId] || (groupHits[groupId] = { name: groupName, run: 0, failed: 0 });
  g.run++;
  if (ok === false) {
    g.failed++;
    failCount++;
    (fnBad[fnName] || (fnBad[fnName] = [])).push(groupId);
    if (failures.length < 40) failures.push(groupId + " " + groupName + " · " + fnName + " — " + String(detail).slice(0, 220));
  }
}

function hardFail(name, detail) {
  assertions++;
  failCount++;
  failures.push("FIXTURE " + name + " — " + String(detail).slice(0, 220));
  console.log("FAIL " + name + " — " + String(detail).slice(0, 220));
}
function hardPass(name) { assertions++; console.log("PASS " + name); }
function fixture(name, cond, detail) { if (cond) hardPass(name); else hardFail(name, detail); return !!cond; }

// ---------------------------------------------------------------- rng

function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const RNG = mulberry32(SEED);
function pick(list) { return list[Math.floor(RNG() * list.length) % list.length]; }

// ---------------------------------------------------------------- 1. transpile + evaluate

if (!fs.existsSync(APP)) {
  console.log("FAIL mc_full — app/FPL_Mission_Control.jsx does not exist (run `node build.cjs`)");
  console.log("SUITE mc_full 0 iters · 0 assertions · 0/0 · 1");
  process.exit(1);
}

let esbuild;
try { esbuild = require(path.join(ROOT, "node_modules", "esbuild")); }
catch (e) { console.log("FAIL mc_full — esbuild is not installed in fpl/node_modules"); console.log("SUITE mc_full 0 iters · 0 assertions · 0/0 · 1"); process.exit(1); }

const SRC = fs.readFileSync(APP, "utf8");

// Every top-level function declaration in the shipped file, in source order.
const FN_NAMES = [];
const DECL = /^(?:export\s+default\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
let mm;
while ((mm = DECL.exec(SRC))) FN_NAMES.push(mm[1]);

const EPILOGUE = "\nmodule.exports.__FNS__ = {" +
  FN_NAMES.map(function (n) { return JSON.stringify(n) + ": (typeof " + n + " === \"function\" ? " + n + " : null)"; }).join(",") +
  "};\nmodule.exports.__WEEKLY__ = (typeof WEEKLY !== \"undefined\" ? WEEKLY : null);\n" +
  "module.exports.__LIVE__ = (typeof LIVE !== \"undefined\" ? LIVE : null);\n";

let CODE;
try {
  CODE = esbuild.transformSync(SRC + EPILOGUE, { loader: "jsx", jsx: "transform", format: "cjs", target: "node22" }).code;
} catch (e) {
  console.log("FAIL mc_full — esbuild could not transpile the app: " + (e && e.message ? String(e.message).split("\n")[0] : String(e)));
  console.log("SUITE mc_full 0 iters · 0 assertions · 0/0 · 1");
  process.exit(1);
}

// --- stubs. React.createElement returns a plain descriptor so a component's return value can
//     be inspected (children, className, text) without a DOM.
function El(type, props) {
  const kids = Array.prototype.slice.call(arguments, 2);
  return { __el: true, type: typeof type === "function" ? (type.name || "fn") : type, props: props || {}, children: kids };
}
// Hooks are stubbed faithfully: React keeps per-instance slots and useMemo really memoises. A
// stub that re-runs every useMemo body on every call measures the stub, not the app (App rebuilt
// the whole context and plan on each of its trials and looked 700 ms slow).
let HOOK_SLOTS = [];
let HOOK_I = 0;
const HOOK_STORE = {};
function useHooksOf(name) { HOOK_SLOTS = HOOK_STORE[name] || (HOOK_STORE[name] = []); HOOK_I = 0; }
function sameDeps(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
const ReactStub = {
  createElement: El,
  cloneElement: El,
  Fragment: "Fragment",
  Component: function () {},
  useState: function (v) {
    const i = HOOK_I++;
    if (!HOOK_SLOTS[i]) HOOK_SLOTS[i] = { v: typeof v === "function" ? v() : v };
    return [HOOK_SLOTS[i].v, function () {}];
  },
  useEffect: function () {},
  useLayoutEffect: function () {},
  useMemo: function (f, deps) {
    const i = HOOK_I++;
    const h = HOOK_SLOTS[i];
    if (h && "m" in h && sameDeps(h.deps, deps)) return h.m;
    const v = typeof f === "function" ? f() : undefined;
    HOOK_SLOTS[i] = { m: v, deps: Array.isArray(deps) ? deps.slice() : null };
    return v;
  },
  useCallback: function (f, deps) { return ReactStub.useMemo(function () { return f; }, deps); },
  useRef: function (v) {
    const i = HOOK_I++;
    if (!HOOK_SLOTS[i]) HOOK_SLOTS[i] = { current: v === undefined ? null : v };
    return HOOK_SLOTS[i];
  },
  useReducer: function (r, i0) {
    const i = HOOK_I++;
    if (!HOOK_SLOTS[i]) HOOK_SLOTS[i] = { v: i0 };
    return [HOOK_SLOTS[i].v, function () {}];
  }
};
ReactStub.Component.prototype.setState = function () {};
ReactStub.Component.prototype.forceUpdate = function () {};

function iconStub() { return null; }
const PROXY = new Proxy({}, { get: function (t, k) { return k === "__esModule" ? false : iconStub; } });

function stubRequire(id) {
  if (id === "react") return Object.assign({ default: ReactStub, __esModule: true }, ReactStub);
  if (id === "react-dom" || id === "react-dom/client") return { __esModule: true, createRoot: function () { return { render: function () {}, unmount: function () {} }; }, default: {} };
  if (id === "recharts" || id === "lucide-react") return PROXY;
  throw new Error("mc_full: unstubbed require(" + id + ") — the app must not import anything else");
}

const MODULE = { exports: {} };
let FNS = null;
try {
  const g = { setTimeout: function () { return 0; }, clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {} };
  new Function("require", "module", "exports", "setTimeout", "clearTimeout", "setInterval", "clearInterval", CODE)(
    stubRequire, MODULE, MODULE.exports, g.setTimeout, g.clearTimeout, g.setInterval, g.clearInterval);
  FNS = MODULE.exports.__FNS__;
} catch (e) {
  console.log("FAIL mc_full — evaluating the transpiled app threw: " + (e && e.message ? e.message : String(e)));
  console.log("SUITE mc_full 0 iters · 0 assertions · 0/0 · 1");
  process.exit(1);
}

fixture("mc_full-transpile-and-evaluate-the-assembled-app", !!FNS, "no capture object came back");
fixture("mc_full-extracted-every-top-level-function", FN_NAMES.length > 100 && Object.keys(FNS).length === FN_NAMES.length,
  "declared " + FN_NAMES.length + ", captured " + Object.keys(FNS).length);
const MISSING = FN_NAMES.filter(function (n) { return typeof FNS[n] !== "function"; });
fixture("mc_full-no-extracted-name-is-missing-from-the-evaluated-scope", MISSING.length === 0, MISSING.join(", "));
fixture("mc_full-the-weekly-block-and-the-live-block-are-both-in-scope",
  MODULE.exports.__WEEKLY__ !== null && MODULE.exports.__LIVE__ !== null, "WEEKLY or LIVE missing from the assembled file");

const F = function (n) { return FNS[n]; };

// ---------------------------------------------------------------- 2. the three contracts

const THROWERS = ["parseJson", "applyRefresh"];                         // D4: throw by specification
const COMPONENTS = FN_NAMES.filter(function (n) { return /^[A-Z]/.test(n); });   // React components need props
const TOTAL_FNS = FN_NAMES.filter(function (n) { return THROWERS.indexOf(n) < 0 && COMPONENTS.indexOf(n) < 0; });

fixture("mc_full-component-set-is-the-capitalised-top-level-functions", COMPONENTS.length >= 15 && COMPONENTS.indexOf("GwActionCard") >= 0 && COMPONENTS.indexOf("App") >= 0,
  COMPONENTS.length + " components: " + COMPONENTS.join(","));
fixture("mc_full-both-documented-throwers-are-present", THROWERS.every(function (n) { return typeof FNS[n] === "function"; }), THROWERS.join(","));

// ---------------------------------------------------------------- 3. synthetic snapshot (CONTRACT §3)

const NOW = "2026-09-11T06:00:00Z";
const TYPE_OF_J = [1, 2, 2, 3, 3, 4];
const BASE_COST = { 1: 45, 2: 50, 3: 70, 4: 85 };
function idFor(t, j) { return (t - 1) * 6 + j + 1; }

function buildSnapshot() {
  const fixtures = [];
  const rounds = [[[1, 2], [3, 4], [5, 6]], [[2, 3], [4, 5], [6, 1]], [[3, 1], [5, 2], [4, 6]], [[1, 4], [2, 6], [3, 5]],
                  [[6, 3], [5, 1], [4, 2]], [[2, 5], [1, 3], [6, 4]], [[4, 1], [3, 6], [5, 2]], [[1, 6], [2, 4], [3, 5]]];
  for (let g = 1; g <= 8; g++) rounds[g - 1].forEach(function (p, i) {
    fixtures.push({ id: g * 10 + i + 1, event: g, team_h: p[0], team_a: p[1], team_h_difficulty: 2 + ((p[1] + g) % 4), team_a_difficulty: 2 + ((p[0] + g) % 4),
      finished: g <= 3, started: g <= 3, kickoff_time: "2026-0" + (7 + Math.floor((g - 1) / 4)) + "-" + String(10 + g).padStart(2, "0") + "T14:00:00Z",
      team_h_score: g <= 3 ? p[0] % 3 : null, team_a_score: g <= 3 ? p[1] % 2 : null });
  });
  const elements = [];
  for (let t = 1; t <= 6; t++) for (let j = 0; j < 6; j++) {
    const id = idFor(t, j), type = TYPE_OF_J[j];
    elements.push({ id: id, code: 500000 + id, web_name: "P" + id, team: t, element_type: type, now_cost: BASE_COST[type] + (id % 7),
      cost_change_event: 0, cost_change_start: 0, selected_by_percent: 5 + (id % 20), status: "a", news: "", chance: null,
      total_points: 0, minutes: 0, starts: 0, xg: 0, xa: 0, xgc: 0, dc: 0, bps: 0, ict: 0, form: 0, goals: 0, assists: 0,
      cs: 0, gc: 0, bonus: 0, yc: 0, rc: 0, og: 0, pen_miss: 0, pen_save: 0, saves: 0, transfers_in_event: 0, transfers_out_event: 0 });
  }
  const byId = {}; elements.forEach(function (e) { byId[e.id] = e; });
  byId[22].status = "d"; byId[22].chance = 75; byId[22].news = "Knock — 75% chance of playing";
  const PATTERN = {}; elements.forEach(function (e) { PATTERN[e.id] = "reg"; });
  PATTERN[34] = "dead"; PATTERN[21] = "dead"; PATTERN[35] = "rot"; PATTERN[29] = "rot"; PATTERN[13] = "rot"; PATTERN[3] = "back";
  const QUALITY = {}; for (let id = 1; id <= 36; id++) QUALITY[id] = 2 + ((id * 7) % 6);
  QUALITY[5] = 14; QUALITY[22] = 15; QUALITY[16] = 12; QUALITY[11] = 11; QUALITY[17] = 10;
  const gw = {};
  for (let g = 1; g <= 3; g++) {
    const rows = {}, fxg = {};
    fixtures.filter(function (f) { return f.event === g; }).forEach(function (f) {
      fxg[f.id] = { h: Math.round((0.8 + (f.team_h % 4) * 0.35) * 100) / 100, a: Math.round((0.6 + (f.team_a % 3) * 0.4) * 100) / 100 };
    });
    elements.forEach(function (el) {
      const p = PATTERN[el.id];
      let min = 90, starts = 1;
      if (p === "dead") { min = 0; starts = 0; }
      else if (p === "rot" && g === 2) { min = 18; starts = 0; }
      else if (p === "back" && g < 3) { min = 0; starts = 0; }
      if (min === 0) return;
      const type = el.element_type, q = QUALITY[el.id];
      const goals = type >= 3 && q >= 10 && g !== 2 ? 1 : 0;
      const assists = type === 3 && q >= 8 && g === 2 ? 1 : 0;
      const cs = type <= 2 && (el.team + g) % 2 === 0 ? 1 : 0;
      const gcf = cs ? 0 : (el.team + g) % 3;
      const dcv = type === 2 ? 8 + ((el.id + g) % 6) : (type === 1 ? 0 : 9 + ((el.id + g) % 6));
      const saves = type === 1 ? 2 + ((el.id + g) % 4) : 0;
      const bonus = q >= 12 && g !== 2 ? 2 : 0;
      rows[el.id] = [min, starts, starts ? q + (g % 2) : Math.max(1, Math.round(q / 3)),
        Math.round((type >= 3 ? 0.2 + (q % 5) * 0.11 : 0.05) * 100) / 100,
        Math.round((type === 3 ? 0.15 + (q % 4) * 0.09 : 0.04) * 100) / 100,
        Math.round((0.6 + (el.team % 4) * 0.3) * 100) / 100,
        dcv, 10 + q + g, Math.round((4 + q * 0.8) * 100) / 100,
        goals, assists, cs, gcf, bonus, (el.id + g) % 11 === 0 ? 1 : 0, 0, 0, 0, 0, saves];
    });
    gw[String(g)] = { elements: rows, fixture_xg: fxg };
  }
  elements.forEach(function (el) {
    let tp = 0, mn = 0, st = 0, xg = 0, xa = 0, xgc = 0, dc = 0, bps = 0, ict = 0, goals = 0, assists = 0, cs = 0, gc = 0, bonus = 0, yc = 0, saves = 0;
    for (let g = 1; g <= 3; g++) {
      const r = gw[String(g)].elements[el.id]; if (!r) continue;
      mn += r[0]; st += r[1]; tp += r[2]; xg += r[3]; xa += r[4]; xgc += r[5]; dc += r[6]; bps += r[7]; ict += r[8];
      goals += r[9]; assists += r[10]; cs += r[11]; gc += r[12]; bonus += r[13]; yc += r[14]; saves += r[19];
    }
    el.total_points = tp; el.minutes = mn; el.starts = st; el.xg = Math.round(xg * 100) / 100; el.xa = Math.round(xa * 100) / 100;
    el.xgc = Math.round(xgc * 100) / 100; el.dc = dc; el.bps = bps; el.ict = Math.round(ict * 100) / 100;
    el.goals = goals; el.assists = assists; el.cs = cs; el.gc = gc; el.bonus = bonus; el.yc = yc; el.saves = saves;
    el.form = Math.round(tp / 3 * 100) / 100;
  });
  const events = [];
  for (let g = 1; g <= 8; g++) events.push({ id: g, name: "Gameweek " + g,
    deadline_time: "2026-0" + (7 + Math.floor((g - 1) / 4)) + "-" + String(10 + g).padStart(2, "0") + "T12:30:00Z",
    is_current: g === 3, is_next: g === 4, finished: g <= 3, average_entry_score: 45 + g });
  const SQUAD = [1, 7, 2, 9, 14, 20, 26, 4, 16, 22, 28, 34, 12, 18, 30];
  const RIVAL_PICKS = [
    { gk: [1, 7], def: [2, 3, 8, 9, 14], mid: [5, 17, 4, 10, 16], fwd: [6, 12, 18], cap: 5 },
    { gk: [13, 19], def: [15, 20, 21, 26, 27], mid: [5, 17, 22, 23, 28], fwd: [24, 30, 36], cap: 5 },
    { gk: [25, 31], def: [32, 33, 2, 3, 8], mid: [5, 17, 29, 34, 35], fwd: [6, 12, 24], cap: 5 },
    { gk: [1, 7], def: [9, 14, 15, 20, 21], mid: [5, 4, 10, 16, 22], fwd: [18, 30, 36], cap: 16 }];
  const rivals = {};
  [101, 102, 103, 104].forEach(function (r, i) {
    const p = RIVAL_PICKS[i];
    const all = [p.gk[0]].concat(p.def.slice(0, 4), p.mid.slice(0, 4), p.fwd.slice(0, 2), [p.gk[1], p.def[4], p.mid[4], p.fwd[2]]);
    rivals[r] = { event: 3, picks: all.map(function (el, k) { return { element: el, position: k + 1, multiplier: k < 11 ? (el === p.cap ? 2 : 1) : 0, is_captain: el === p.cap, is_vice_captain: k === 1 }; }) };
  });
  return {
    fetched_at: NOW, source: "synthetic snapshot built by qa/mc_full.cjs",
    next_event: 4, current_event: 3, total_players: 1000,
    events: events, teams: [1, 2, 3, 4, 5, 6].map(function (t) { return { id: t, short_name: "T" + t, name: "Team " + t }; }),
    elements: elements, fixtures: fixtures, gw: gw,
    entry: { id: 3546875, name: "Synth", summary_overall_points: 178, summary_overall_rank: 500000, summary_event_points: 50, current_event: 3, last_deadline_bank: 10, last_deadline_value: 990, last_deadline_total_transfers: 0 },
    history: { current: [1, 2, 3].map(function (g) { return { event: g, points: 50 + g, total_points: 50 * g, rank: 1, overall_rank: 1, bank: 10, value: 990, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 4 }; }), chips: [] },
    picks: { "3": { active_chip: null, picks: SQUAD.map(function (el, k) { return { element: el, position: k + 1, multiplier: k < 11 ? 1 : 0, is_captain: el === 16, is_vice_captain: el === 4 }; }) } },
    ft_available: 3,
    leagues: [{ id: 900, name: "Synth League", size: 5, rank: 2, last_rank: 3, standings: [
      { entry: 101, player_name: "Rival One", entry_name: "R1", total: 190, rank: 1 },
      { entry: 3546875, player_name: "Kwezi Ngwevu", entry_name: "Synth", total: 178, rank: 2 },
      { entry: 102, player_name: "Rival Two", entry_name: "R2", total: 175, rank: 3 },
      { entry: 103, player_name: "Rival Three", entry_name: "R3", total: 170, rank: 4 },
      { entry: 104, player_name: "Rival Four", entry_name: "R4", total: 160, rank: 5 }] }],
    rivals: rivals,
    draft: { game: { current_event: 3, next_event: 4, waivers_processed: false },
      events: [{ id: 4, deadline_time: "2026-08-14T12:30:00Z", waivers_time: "2026-08-13T12:30:00Z" }],
      scoring: { short_play: 1, long_play: 2, long_play_limit: 60, goals_scored_GKP: 10, goals_scored_DEF: 6, goals_scored_MID: 5, goals_scored_FWD: 4,
        assists: 3, clean_sheets_GKP: 4, clean_sheets_DEF: 4, clean_sheets_MID: 1, clean_sheets_FWD: 0,
        goals_conceded_GKP: -1, goals_conceded_DEF: -1, goals_conceded_MID: 0, goals_conceded_FWD: 0, concede_limit: 2,
        saves: 1, saves_limit: 3, penalties_saved: 5, penalties_missed: -2, yellow_cards: -1, red_cards: -3, own_goals: -2, bonus: 1,
        defensive_contribution_DEF: 2, defensive_contribution_limit_DEF: 10, defensive_contribution_MID: 2, defensive_contribution_limit_MID: 12,
        defensive_contribution_FWD: 2, defensive_contribution_limit_FWD: 12 },
      squad: { size: 15, captains_disabled: true },
      elements: elements.map(function (el) { const shifted = [4, 11, 17, 22, 30].indexOf(el.id) >= 0;
        return { id: shifted ? el.id + 100 : el.id, code: el.code, web_name: el.web_name, team: el.team, element_type: el.element_type, status: el.status, chance: el.chance, news: el.news, starts: el.starts, minutes: el.minutes, total_points: el.total_points }; }),
      league_id: null },
    __squad: SQUAD
  };
}

const SNAP = buildSnapshot();
const SQUAD = SNAP.__squad.slice();
const STATE = {
  version: 87, exported_at: NOW, entry: 3546875,
  squad: SQUAD.map(function (id) { const el = SNAP.elements.filter(function (e) { return e.id === id; })[0]; return { id: id, purchase: el.now_cost }; }),
  bank: 10, ft: 3, value: 990, confirmed_gw: 3, leagues: [900],
  draft: { league_id: null, roster: SQUAD.map(function (id) { return 500000 + id; }), watchlist: [500005, 500011] },
  ui: { mode: "simple", tab: "command", open: {}, reveals: {} }, ledger: [],
  refresh: { pair: "sonnet46", last: null }
};

const CTX = F("buildCtx")(SNAP, STATE, NOW);
fixture("mc_full-synthetic-context-builds", CTX && CTX.ok === true, CTX ? String(CTX.error) : "buildCtx returned nothing");
const XI = F("bestXI")(SQUAD, CTX);
fixture("mc_full-synthetic-best-XI-is-eleven", XI && XI.ids.length === 11, XI ? XI.ids.length + " ids" : "no result");
const BENCH = SQUAD.filter(function (id) { return XI.ids.indexOf(id) < 0; });
const SNAP_CANARY = JSON.stringify({ squad: SQUAD, state: STATE, els: Object.keys(CTX.els).length, ctxSquad: CTX.squadIds });

// ---------------------------------------------------------------- 4. the 20 junk kinds

const DEEP = (function () { const o = { squad: [] }; let c = o; for (let i = 0; i < 60; i++) { c.next = { i: i, s: "n" + i }; c = c.next; } return o; })();
const JUNK = [
  { k: "null", v: null },
  { k: "undefined", v: undefined },
  { k: "empty string", v: "" },
  { k: "non-JSON string", v: "x" },
  { k: "zero", v: 0 },
  { k: "negative zero", v: -0 },
  { k: "NaN", v: NaN },
  { k: "Infinity", v: Infinity },
  { k: "true", v: true },
  { k: "empty array", v: [] },
  { k: "empty object", v: {} },
  { k: "array of null", v: [null] },
  { k: "object {a:1}", v: { a: 1 } },
  { k: "100k-character string", v: new Array(100001).join("z") },
  { k: "40-element array", v: (function () { const a = []; for (let i = 0; i < 40; i++) a.push(i % 7 ? i : { id: i }); return a; })() },
  { k: "deep nested object", v: DEEP },
  { k: "negative number", v: -7.5 },
  { k: "huge number", v: 1e308 },
  { k: "function", v: function fuzzFn() { return 1; } },
  { k: "unicode keys", v: { "éè€": 1, "क": [1, 2], "日本": { z: true } } }
];
fixture("mc_full-exactly-20-junk-kinds", JUNK.length === 20, JUNK.length + " kinds");

// The parent proved the watchdog on a worker that really does loop for ever before it started
// this one; the result is carried in so it is counted with every other assertion.
const SELF = (WT.workerData && WT.workerData.selfTest) || null;
fixture("mc_full-watchdog-catches-an-unbounded-loop-and-names-it",
  !!(SELF && SELF.ok), SELF ? "self-test returned " + JSON.stringify(SELF) : "the suite was run without the supervisor (MC_NO_WORKER=1)");
fixture("mc_full-the-fuzz-loop-runs-under-that-watchdog",
  !!(WT.workerData && WT.workerData.sab) && !WT.isMainThread,
  WT.isMainThread ? "running on the main thread: an unbounded call would hang instead of failing" : "no shared heartbeat buffer");

// ---------------------------------------------------------------- 5. valid arguments per function

const STATS_ROW = { minutes: 90, starts: 1, goals: 1, assists: 1, cs: 1, gc: 0, dc: 12, bps: 30, saves: 0, bonus: 2, yc: 0, rc: 0, og: 0, pen_miss: 0, pen_save: 0 };
const FIXTURE1 = SNAP.fixtures.filter(function (f) { return f.event === 4; })[0];
const EL = CTX.els[16];
const TS = CTX.TS;
const CODES = SQUAD.map(function (id) { return 500000 + id; });
const CONTENT = [{ type: "server_tool_use", name: "web_search" }, { type: "web_search_tool_result", content: [] }, { type: "text", text: "{\"elements\":[]}" }];

const WCW = F("wcSetup")(CTX, {}, "TS");                  // the solver's own pool/feasibility bundle
const VALID = {
  num: [3.5, 0], intOf: [3.7, 0], clamp: [5, 0, 10], isObj: [{}], kindOf: [{}], arr: [[1, 2]], errMsg: [new Error("x")], okCtx: [CTX],
  idOf: [{ id: 4 }], idList: [SQUAD], elMap: [SNAP.elements], elType: [EL], uniq: [[1, 1, 2]], sum: [[1, 2, 3]],
  sortNum: [1, 2], quantile: [[1, 2, 3, 4, 5], 0.5], nowMs: [NOW], combos: [[1, 2, 3, 4], 2],
  rowStat: [SNAP.gw["1"].elements[16], 2, "pts", 0], pointsFor: [STATS_ROW, 3], draftScoring: [SNAP], gwPoints: [SNAP.picks["3"].picks, SNAP.gw["3"]],
  clubCounts: [SQUAD, CTX.els], posCounts: [SQUAD, CTX.els], legal15: [SQUAD, CTX.els, 1000], legalXI: [XI.ids, CTX.els], formationOf: [XI.ids, CTX.els],
  shrunkPps: [EL], flagInfo: [EL], isFlagged: [EL], statsFor: [EL, CTX], pStart: [EL, { games: 3, starts: 3, everBenched: false }],
  fxMult: [FIXTURE1, 1, TS], fxMultInfo: [FIXTURE1, 1, TS], teamMults: [1, CTX, "TS"], xp5FromMults: [EL, 0.875, [1.1, 0.95, 1.05, 0.9, 1.0]],
  xp1With: [EL, CTX, "TS"], xp5With: [EL, CTX, "TS"], xp1: [EL, CTX], xp5: [EL, CTX],
  teamStrength: [SNAP], tsEntry: [TS, 1], tsXg: [1, 2, true, TS], tsMult: [1, 2, true, TS], tsPcs: [1, 2, true, TS],
  overUnderTags: [SNAP], runAvg: [1, SNAP.fixtures, 5], elementGwStats: [SNAP],
  rivalPickShares: [SNAP], rivalOwn: [SNAP], capShare: [SNAP], rivalOwnMax: [5, CTX], convergenceRisk: [5, CTX], classify: [EL, CTX],
  gamePhase: [SNAP, NOW], buildCtx: [SNAP, STATE, NOW],
  tierOf: [EL, CTX], pickXI: [SQUAD, CTX], captainPick: [XI.ids, CTX], bestXI: [SQUAD, CTX], benchOrder: [SQUAD, XI.ids, CTX],
  sellCandidates: [STATE.squad, CTX], transferProtocol: [STATE, CTX],
  wcObjective: [SQUAD, CTX, "TS"], wcPool: [CTX, {}, 3], wcCost: [SQUAD, CTX], wcSetup: [CTX, {}, "TS"], wcFeasible: [SQUAD, CTX, WCW],
  wcSolve: [CTX, {}, "TS"], wcLocalOptimum: [SQUAD, CTX, {}], wildcardSolver: [CTX, {}],
  elName: [16, CTX], writtenFifteen: [{ written: SQUAD }], wildcardOptions: [CTX, { written: SQUAD }], wildcardTiming: [CTX],
  chipWindows: [SNAP], chipRegret: ["bench_boost", CTX, {}],
  draftEl: [500016, CTX], draftEV: [CTX.draft && CTX.draft.byCode ? CTX.draft.byCode[500016] : null, CTX],
  draftWaivers: [STATE, CTX], watchlistAudit: [CODES, CTX], draftXI: [CODES, CTX],
  sanitiseState: [STATE], detectSquadChange: [SQUAD, SNAP.picks["3"].picks], ftAvailable: [SNAP.history, 3], sellPrice: [47, 45], bankAfter: [STATE, [{ out: 34, in: 11 }], CTX.els],
  openClosers: ['{"a":[1,2'], salvageJson: ['{"a":[1,2'], stripFences: ["```json\n{\"a\":1}\n```"], parseJson: ['{"a":1}'], blocksOf: [{ content: CONTENT }], pickText: [CONTENT], blockTypes: [CONTENT],
  refreshRequest: [{ pair: "sonnet46", nextEvent: 4 }], applyRefresh: [{ live: SNAP }, { elements: [{ id: 1, status: "d", chance: 75 }] }],
  mulberry32: [7], rngOf: [7], poisson: [1.4, mulberry32(3)], binomial: [10, 0.3, mulberry32(4)],
  posRates: [CTX], playerRates: [EL, CTX], likelyXI: [1, CTX], simFixture: [FIXTURE1, CTX, mulberry32(5)],
  simPlayerDetail: [EL, CTX, mulberry32(6)], simPlayer: [EL, CTX, mulberry32(7)], fixtureDraws: [CTX, mulberry32(8)],
  entryPoints: [XI.ids, BENCH, XI.capId, XI.viceId, {}, CTX], squadOrder: [SQUAD, XI.capId, CTX],
  mcSquad: [SQUAD, XI.capId, CTX, 30, 11, XI.viceId], mcLeague: [CTX, 900, { iters: 30, seed: 3 }],
  ranksOf: [[3, 1, 2]], spearman: [[1, 2, 3], [2, 1, 3]], mae: [[1, 2, 3], [2, 1, 3]], calibrateToPoints: [[10, 20, 30], [1, 2, 3]], tournament: [SNAP],
  // F4 calibration, F5 player xG, F8 chip solver (v88)
  logistic: [1.2], solveLinear: [[[2, 1], [1, 3]], [5, 10]],
  fitLogistic: [[[1, 0], [1, 1], [1, 0], [1, 1], [1, 0], [1, 1], [1, 0.5], [1, 0.25]], [0, 1, 0, 1, 0, 1, 1, 0], {}],
  brier: [[0.2, 0.8, 0.5], [0, 1, 1]], reliability: [[0.2, 0.8, 0.5], [0, 1, 1], 5],
  promotionGate: [{ transitions: 2, wins: 2, holdout: 1, challenger: "x", incumbent: "y" }],
  strengthFromCounts: [{ 1: { g: 3, xgf: 4.2, xga: 3.1 }, 2: { g: 3, xgf: 3.0, xga: 4.4 } }],
  playerXgPredict: [{ played: 3, min: 270, pts: 18, xg: 1.2, xa: 0.4, cs: 1, gc: 2, dcHits: 2, bps: 60, ict: 30, bonus: 2, last: 6 },
    { min: 9000, xg: 20, xa: 12 }, 3,
    { play_short: 1, play_long: 2, goal: 5, assist: 3, cs: 1, gc_per2: 0, dc: 2, dc_threshold: 12, bonus: 1 },
    [{ team: 1, opp: 2, home: true }], { TS: TS, Lbar: 1.4 }],
  minutesTerms: [{ beta: [0, 0, 0, 0, 0] }], minutesPanel: [SNAP],
  minutesFeatureVector: [[{ gw: 1, games: 1, min: 90, starts: 1 }, { gw: 2, games: 1, min: 45, starts: 0 }], 4, { 1: 0, 2: 86400000, 3: 172800000, 4: 259200000 }],
  minutesRowsFor: [SNAP, 3, null], minutesFit: [SNAP, 3, {}], ctxMinutesFit: [CTX, {}], minutesModel: [EL, CTX, {}],
  truncateLive: [SNAP, 2], minutesWalkForward: [SNAP, { bins: 5 }],
  playerXg: [EL, CTX, {}], eventMult: [1, CTX, 4], xpEvent: [EL, CTX, 4], bestElevenForEvent: [CTX, 4, null],
  chipValue: ["BB", 4, CTX, {}], chipSolver: [CTX, {}]
};

// Slot budgets: how many arguments to offer each function. Declared length, but never zero for
// a function that reads arguments positionally, and never more than 6.
function arityOf(fn, name) {
  const v = VALID[name];
  const declared = fn.length;
  const n = Math.max(declared, v ? v.length : 0);
  return Math.min(6, Math.max(1, n));
}

// Expensive functions: the huge-number junk kind in an iteration-count slot would make each call
// run the engine's 20 000-iteration cap. They keep the valid iteration count in that slot; every
// other slot still takes junk, and P04 still times every call.
const ITER_SLOT = { mcSquad: 3, mcLeague: -1, wcSolve: -1, wildcardOptions: -1, wcLocalOptimum: -1 };

// ---------------------------------------------------------------- 6. inspection helpers

// The three primitives whose documented scalar answer to unusable input is NaN.
const NAN_SENTINEL = ["num", "intOf", "idOf", "sortNum"];

const PROB_KEYS = ["pstart", "pwin", "share", "prob", "p", "pmodel", "pincumbent", "flagfactor",
  "brier", "baserate", "basebrier", "meanpred", "meanoutcome", "gap", "maxgap"];
const INT_KEYS = ["cost", "now_cost", "bank", "bankafter", "budget", "hits", "ft", "k", "iters", "purchase", "sellprice", "entries", "transitions",
  "wins", "holdout", "need", "needholdout", "comparable", "nbins", "considered", "set", "event", "fitrows"];
const TENTH_KEYS = ["cost", "now_cost", "bank", "bankafter", "budget", "purchase"];
// Published caps. "ids" is only a fifteen for the functions that return a squad — wcPool's `ids`
// is a candidate pool and is legitimately longer — and "bench" is "whatever was not picked", so
// its cap is the input list minus the eleven (4 for a real fifteen, and stricter than a flat 4
// whenever the caller passed fewer than fifteen).
// models is 9 from v88: the eight of E5 plus the F5 player-xG challenger.
const CAPS = { squad: 15, xi: 11, moves: 3, order: 8, models: 9, claims: 20, alternatives: 3, reasons: 60, relaxations: 12,
  terms: 12, plan: 8, candidates: 16, sets: 2, bins: 20, x: 8, beta: 8, opponents: 4 };
const IDS_CAP = { bestXI: 11, pickXI: 11, wildcardSolver: 15, wildcardOptions: 15, sanitiseState: 15 };

function walk(v, visit) {
  let nodes = 0;
  const seen = new Set();
  (function rec(val, key, path, depth) {
    if (nodes++ > 4000 || depth > 8) return;
    if (val === null || val === undefined) return;
    const t = typeof val;
    if (t === "number" || t === "string" || t === "boolean") { visit(val, key, path); return; }
    if (t === "function") return;
    if (typeof val === "object") {
      if (seen.has(val)) return;
      seen.add(val);
      if (Array.isArray(val)) {
        visit(val, key, path);
        for (let i = 0; i < val.length && i < 400; i++) rec(val[i], key, path + "[" + i + "]", depth + 1);
        return;
      }
      for (const k in val) {
        if (!Object.prototype.hasOwnProperty.call(val, k)) continue;
        if (k.charAt(0) === "_") continue;                       // engine memo caches, not a return contract
        rec(val[k], k, path + "." + k, depth + 1);
      }
    }
  })(v, "", "", 0);
}

// The argument values are a fixed set of objects (the junk table and the valid table), so the
// deep scan for a non-finite input is memoised on identity — without it P06 re-walks the whole
// context object on every trial that takes a ctx.
const NONFINITE_MEMO = new WeakMap();
function objHasNonFinite(o) {
  if (NONFINITE_MEMO.has(o)) return NONFINITE_MEMO.get(o);
  let bad = false;
  try { walk(o, function (val) { if (typeof val === "number" && !isFinite(val)) bad = true; }); } catch (e) { bad = true; }
  NONFINITE_MEMO.set(o, bad);
  return bad;
}
function inputHadNonFinite(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (typeof a === "number" && !isFinite(a)) return true;
    if (a && typeof a === "object" && objHasNonFinite(a)) return true;
  }
  return false;
}
function inputHadNonNumericJunk(args) {
  return args.some(function (a) { return a === undefined || a === null || typeof a === "string" || typeof a === "boolean" || typeof a === "function" || (typeof a === "number" && !isFinite(a)); });
}
// Mirrors the engine's own idOf/idList: a plain number, or an object carrying id / element.
function idsOf(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  v.forEach(function (x) {
    const n = (x && typeof x === "object" && !Array.isArray(x)) ? Number(x.id !== undefined ? x.id : x.element) : Number(x);
    if (Number.isFinite(n) && out.indexOf(n) < 0) out.push(n);
  });
  return out;
}

// ---------------------------------------------------------------- 7. the 38 property groups

const GROUPS = [
  ["P01", "nothing throws (total functions)", function (r) {
    if (THROWERS.indexOf(r.name) >= 0 || COMPONENTS.indexOf(r.name) >= 0) return null;
    if (!r.threw) return null;
    return { ok: false, detail: r.kinds + " → " + r.err };
  }],
  ["P02", "documented throwers throw a named Error", function (r) {
    if (THROWERS.indexOf(r.name) < 0) return null;
    if (!r.threw) return null;                                   // a successful parse is fine
    const ok = r.errObj instanceof Error && /^(parseJson|applyRefresh):/.test(String(r.err)) && String(r.err).length > 18;
    return ok ? null : { ok: false, detail: "message was " + JSON.stringify(String(r.err)).slice(0, 120) };
  }],
  ["P03", "components reject junk props with a TypeError", function (r) {
    if (COMPONENTS.indexOf(r.name) < 0 || !r.threw) return null;
    const ok = r.errObj instanceof TypeError;
    return ok ? null : { ok: false, detail: (r.errObj && r.errObj.constructor ? r.errObj.constructor.name : typeof r.errObj) + ": " + r.err };
  }],
  ["P04", "every call terminates inside two seconds", function (r) {
    return r.ms < 2000 ? null : { ok: false, detail: r.kinds + " took " + Math.round(r.ms) + " ms" };
  }],
  ["P05", "no NaN in any returned number", function (r) {
    if (r.threw) return null;
    let bad = null;
    // num(x, NaN), intOf(x, NaN), idOf and sortNum return a bare NaN on purpose: the second
    // argument of num and intOf IS the caller's chosen default, idOf's NaN is the "not an id"
    // sentinel idList filters on
    // (src/engine.js idList), and sortNum is an Array#sort comparator. The sentinel is allowed
    // only as the whole scalar return of those three — never inside an object or an array.
    const sentinel = NAN_SENTINEL.indexOf(r.name) >= 0 && typeof r.out === "number";
    if (sentinel) return null;
    walk(r.out, function (v, k, p) { if (bad === null && typeof v === "number" && Number.isNaN(v)) bad = (p || k || "return") + " = NaN"; });
    return bad === null ? null : { ok: false, detail: r.kinds + " → " + bad };
  }],
  ["P06", "no infinite returned number unless one was passed in", function (r) {
    if (r.threw || inputHadNonFinite(r.args)) return null;
    let bad = null;
    walk(r.out, function (v, k, p) { if (bad === null && typeof v === "number" && !isFinite(v) && !Number.isNaN(v) && Math.abs(v) !== 1e9) bad = (p || k || "return") + " = " + v; });
    return bad === null ? null : { ok: false, detail: r.kinds + " → " + bad };
  }],
  ["P07", "no returned string ever contains undefined/NaN/[object Object]", function (r) {
    if (r.threw) return null;
    let bad = null;
    walk(r.out, function (v, k, p) {
      if (bad !== null || typeof v !== "string" || v.length > 4000) return;
      if (/undefined|NaN|\[object Object\]/.test(v)) bad = (p || k || "return") + " = " + JSON.stringify(v.slice(0, 90));
    });
    return bad === null ? null : { ok: false, detail: r.kinds + " → " + bad };
  }],
  ["P08", "probability fields stay inside [0,1]", function (r) {
    if (r.threw) return null;
    let bad = null;
    walk(r.out, function (v, k, p) {
      if (bad !== null || typeof v !== "number" || !isFinite(v)) return;
      const key = String(k).toLowerCase();
      if (PROB_KEYS.indexOf(key) < 0) return;
      if (v < 0 || v > 1) bad = (p || key) + " = " + v;
    });
    return bad === null ? null : { ok: false, detail: r.kinds + " → " + bad };
  }],
  ["P09", "integer fields are integers on clean input", function (r) {
    if (r.threw || !r.clean) return null;
    let bad = null;
    walk(r.out, function (v, k, p) {
      if (bad !== null || typeof v !== "number" || !isFinite(v)) return;
      if (INT_KEYS.indexOf(String(k).toLowerCase()) < 0) return;
      if (!Number.isInteger(v)) bad = (p || k) + " = " + v;
    });
    return bad === null ? null : { ok: false, detail: bad };
  }],
  ["P10", "prices stay in whole tenths on clean input", function (r) {
    if (r.threw || !r.clean) return null;
    let bad = null;
    walk(r.out, function (v, k, p) {
      if (bad !== null || typeof v !== "number" || !isFinite(v)) return;
      if (TENTH_KEYS.indexOf(String(k).toLowerCase()) < 0) return;
      if (!Number.isInteger(v) || v < -2000 || v > 20000) bad = (p || k) + " = " + v;
    });
    return bad === null ? null : { ok: false, detail: bad };
  }],
  ["P11", "quantiles come back ordered q10 ≤ q50 ≤ q90", function (r) {
    if (r.threw || !r.out || typeof r.out !== "object" || !("q10" in r.out)) return null;
    const o = r.out;
    const ok = typeof o.q10 === "number" && o.q10 <= o.q50 && o.q50 <= o.q90;
    return ok ? null : { ok: false, detail: r.kinds + " → q10 " + o.q10 + " q50 " + o.q50 + " q90 " + o.q90 };
  }],
  ["P12", "arrays never exceed their published cap", function (r) {
    if (r.threw) return null;
    let bad = null;
    const srcLen = idsOf(r.args[0]).length;
    walk(r.out, function (v, k, p) {
      if (bad !== null || !Array.isArray(v)) return;
      const key = String(k);
      let cap = CAPS[key];
      if (key === "ids") cap = IDS_CAP[r.name];
      if (key === "bench") cap = srcLen > 11 ? srcLen - 11 : (srcLen ? 0 : 4);
      if (cap !== undefined && v.length > cap) bad = (p || key) + " holds " + v.length + " (cap " + cap + ")";
    });
    return bad === null ? null : { ok: false, detail: r.kinds + " → " + bad };
  }],
  ["P13", "sanitiseState caps the squad at 15 and dedupes on id (E-003)", function (r) {
    if (r.name !== "sanitiseState" || r.threw) return null;
    const s = r.out;
    if (!s || !Array.isArray(s.squad)) return { ok: false, detail: "squad is not an array" };
    if (s.squad.length > 15) return { ok: false, detail: r.kinds + " → squad of " + s.squad.length };
    const ids = s.squad.map(function (x) { return x && x.id; });
    const uniqIds = ids.filter(function (v, i) { return ids.indexOf(v) === i; });
    return ids.length === uniqIds.length ? null : { ok: false, detail: r.kinds + " → duplicate ids " + ids.join(",") };
  }],
  ["P14", "sanitiseState always returns the §6 shape", function (r) {
    if (r.name !== "sanitiseState" || r.threw) return null;
    const s = r.out;
    const ok = s && typeof s === "object" && Array.isArray(s.squad) && Array.isArray(s.ledger) && s.ui && typeof s.ui === "object" &&
      s.draft && typeof s.draft === "object" && isFinite(Number(s.bank)) && isFinite(Number(s.ft)) && Number(s.ft) >= 0 && Number(s.ft) <= 5;
    return ok ? null : { ok: false, detail: r.kinds + " → " + JSON.stringify(s && { squad: Array.isArray(s.squad), ledger: Array.isArray(s.ledger), ui: !!s.ui, bank: s.bank, ft: s.ft }) };
  }],
  ["P15", "legal15 never passes a list that is not fifteen distinct legal players", function (r) {
    if (r.name !== "legal15" || r.threw || !r.out || r.out.ok !== true) return null;
    const ids = idsOf(r.args[0]);
    const uniqIds = ids.filter(function (v, i) { return ids.indexOf(v) === i; });
    return (ids.length === 15 && uniqIds.length === 15) ? null : { ok: false, detail: r.kinds + " → ok on " + ids.length + " ids (" + uniqIds.length + " distinct)" };
  }],
  ["P16", "legalXI never passes a list that is not eleven distinct players", function (r) {
    if (r.name !== "legalXI" || r.threw || !r.out || r.out.ok !== true) return null;
    const ids = idsOf(r.args[0]);
    const uniqIds = ids.filter(function (v, i) { return ids.indexOf(v) === i; });
    return (ids.length === 11 && uniqIds.length === 11) ? null : { ok: false, detail: r.kinds + " → ok on " + ids.length + " ids" };
  }],
  ["P17", "formationOf returns \"\" or one of the eight legal shapes", function (r) {
    if (r.name !== "formationOf" || r.threw) return null;
    const legal = ["3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-2-3", "5-3-2", "5-4-1"];
    const v = r.out;
    if (v === "") return null;
    return legal.indexOf(v) >= 0 ? null : { ok: false, detail: r.kinds + " → " + JSON.stringify(v) };
  }],
  ["P18", "pointsFor is an integer, FWD never gets a clean sheet, GKP never gets DefCon (B1)", function (r) {
    if (r.name !== "pointsFor" || r.threw) return null;
    if (!Number.isInteger(r.out)) return { ok: false, detail: r.kinds + " → " + r.out };
    if (!r.clean) return null;
    const f = F("pointsFor");
    const fwdCs = f({ minutes: 90, cs: 1 }, 4) - f({ minutes: 90 }, 4);
    const gkDc = f({ minutes: 90, dc: 40 }, 1) - f({ minutes: 90 }, 1);
    return (fwdCs === 0 && gkDc === 0) ? null : { ok: false, detail: "FWD clean sheet " + fwdCs + ", GKP DefCon " + gkDc };
  }],
  ["P19", "bestXI returns eleven distinct ids drawn from its own input", function (r) {
    if (r.name !== "bestXI" || r.threw || !r.out) return null;
    const got = idsOf(r.out.ids);
    if (!got.length) return null;                                // no legal eleven: a legitimate empty result
    const src = idsOf(r.args[0]);
    const uniqGot = got.filter(function (v, i) { return got.indexOf(v) === i; });
    const outside = got.filter(function (id) { return src.indexOf(id) < 0; });
    return (got.length === 11 && uniqGot.length === 11 && outside.length === 0) ? null
      : { ok: false, detail: r.kinds + " → " + got.length + " ids, " + outside.length + " not in the input" };
  }],
  ["P20", "captainPick returns null or an eligible attacker inside the XI it was given", function (r) {
    if (r.name !== "captainPick" || r.threw || !r.out) return null;
    const cap = r.out.capId;
    if (cap === null || cap === undefined) return null;
    const src = idsOf(r.args[0]);
    if (src.indexOf(cap) < 0) return { ok: false, detail: r.kinds + " → capId " + cap + " is not in the XI" };
    if (!r.clean) return null;
    const el = CTX.els[cap];
    const type = el ? el.element_type : 0;
    if (type !== 3 && type !== 4) return { ok: false, detail: "capId " + cap + " is element_type " + type };
    return CTX.flags[cap] && CTX.flags[cap].flagged ? { ok: false, detail: "capId " + cap + " is flagged" } : null;
  }],
  ["P21", "benchOrder returns outfield squad members that are not in the XI", function (r) {
    if (r.name !== "benchOrder" || r.threw || !Array.isArray(r.out)) return null;
    const src = idsOf(r.args[0]), xi = idsOf(r.args[1]);
    const bad = r.out.filter(function (id) { return src.indexOf(id) < 0 || xi.indexOf(id) >= 0; });
    if (bad.length) return { ok: false, detail: r.kinds + " → " + bad.join(",") + " not benchable" };
    if (!r.clean) return null;
    const gk = r.out.filter(function (id) { return CTX.els[id] && CTX.els[id].element_type === 1; });
    return gk.length ? { ok: false, detail: "goalkeeper " + gk.join(",") + " in the outfield bench order" } : null;
  }],
  ["P22", "transferProtocol never exceeds the FT budget and prices hits at −4 (E-004)", function (r) {
    if (r.name !== "transferProtocol" || r.threw || !r.out) return null;
    const o = r.out;
    const k = Number(o.k), ft = Number(o.ft), hits = Number(o.hits);
    if (!isFinite(k) || !isFinite(ft) || !isFinite(hits)) return { ok: false, detail: "k " + o.k + " ft " + o.ft + " hits " + o.hits };
    if (k > Math.min(ft + 1, 3)) return { ok: false, detail: r.kinds + " → k " + k + " with ft " + ft };
    if (hits !== Math.max(0, k - ft) * 4) return { ok: false, detail: "hits " + hits + " for k " + k + " ft " + ft };
    return Array.isArray(o.moves) && o.moves.length === k ? null : { ok: false, detail: "k " + k + " but " + (o.moves ? o.moves.length : "no") + " moves" };
  }],
  ["P23", "transferProtocol confidence is one of HIGH / MED / LOW / hold", function (r) {
    if (r.name !== "transferProtocol" || r.threw || !r.out) return null;
    return ["HIGH", "MED", "LOW", "hold"].indexOf(r.out.confidence) >= 0 ? null : { ok: false, detail: "confidence " + JSON.stringify(r.out.confidence) };
  }],
  ["P24", "wildcardSolver returns fifteen distinct ids inside the budget when it says ok", function (r) {
    if (r.name !== "wildcardSolver" || r.threw || !r.out || r.out.ok !== true) return null;
    const ids = idsOf(r.out.ids);
    const uniqIds = ids.filter(function (v, i) { return ids.indexOf(v) === i; });
    if (ids.length !== 15 || uniqIds.length !== 15) return { ok: false, detail: ids.length + " ids, " + uniqIds.length + " distinct" };
    return Number(r.out.cost) <= Number(r.out.budget) ? null : { ok: false, detail: "cost " + r.out.cost + " over budget " + r.out.budget };
  }],
  ["P25", "classify only ever returns EDGE / SHARED / DEAD / NEUTRAL", function (r) {
    if (r.name !== "classify" || r.threw) return null;
    return ["EDGE", "SHARED", "DEAD", "NEUTRAL"].indexOf(r.out) >= 0 ? null : { ok: false, detail: r.kinds + " → " + JSON.stringify(r.out) };
  }],
  ["P26", "convergenceRisk returns a boolean risk and a share inside [0,1]", function (r) {
    if (r.name !== "convergenceRisk" && r.name !== "rivalOwnMax") return null;
    if (r.threw || !r.out) return null;
    const mx = Number(r.out.max);
    if (!(mx >= 0 && mx <= 1)) return { ok: false, detail: r.kinds + " → max " + r.out.max };
    if (r.name === "convergenceRisk" && typeof r.out.risk !== "boolean") return { ok: false, detail: "risk " + JSON.stringify(r.out.risk) };
    return null;
  }],
  ["P27", "mcSquad reports a non-negative sd over a capped, integer iteration count", function (r) {
    if (r.name !== "mcSquad" || r.threw || !r.out) return null;
    const o = r.out;
    const ok = Number.isInteger(o.iters) && o.iters >= 0 && o.iters <= 20000 && isFinite(o.sd) && o.sd >= 0 && isFinite(o.mean);
    return ok ? null : { ok: false, detail: r.kinds + " → iters " + o.iters + " sd " + o.sd + " mean " + o.mean };
  }],
  ["P28", "mcLeague never reports a raw P(win) under eight gameweeks (E-020)", function (r) {
    if (r.name !== "mcLeague" || r.threw || !r.out) return null;
    if (Number(r.out.gwsOfData) >= 8) return null;
    return r.out.pWin === null ? null : { ok: false, detail: r.kinds + " → pWin " + r.out.pWin + " on " + r.out.gwsOfData + " gameweeks" };
  }],
  ["P29", "tournament returns the nine named models with ρ in [-1,1] or null", function (r) {
    if (r.name !== "tournament" || r.threw || !r.out || !Array.isArray(r.out.models)) return null;
    const want = ["season_mean", "last_gw", "per90", "shrunk_per90", "ict_rate", "bps_rate", "blend", "component_xp", "player_xg"];
    const keys = r.out.models.map(function (m) { return m.key; });
    if (keys.join(",") !== want.join(",")) return { ok: false, detail: "models " + keys.join(",") };
    const bad = r.out.models.filter(function (m) { return m.spearman !== null && !(m.spearman >= -1 && m.spearman <= 1); });
    return bad.length ? { ok: false, detail: "ρ out of range for " + bad.map(function (m) { return m.key; }).join(",") } : null;
  }],
  ["P30", "refreshRequest carries max_tokens 4000 and never a banned field (E-001, D1)", function (r) {
    if (r.name !== "refreshRequest" || r.threw || !r.out) return null;
    if (r.out.max_tokens !== 4000) return { ok: false, detail: "max_tokens " + r.out.max_tokens };
    let body = "";
    try { body = JSON.stringify(r.out); } catch (e) { body = ""; }
    return /ep_this|ep_next/.test(body) ? { ok: false, detail: "banned expected-points field in the request body" } : null;
  }],
  ["P31", "parseJson never returns anything but an object", function (r) {
    if (r.name !== "parseJson" || r.threw) return null;
    const ok = r.out && typeof r.out === "object" && !Array.isArray(r.out);
    return ok ? null : { ok: false, detail: r.kinds + " → " + Object.prototype.toString.call(r.out) };
  }],
  ["P32", "detectSquadChange returns booleans and arrays, never a mixed shape (D3)", function (r) {
    if (r.name !== "detectSquadChange" || r.threw || !r.out) return null;
    const o = r.out;
    const ok = typeof o.changed === "boolean" && typeof o.block === "boolean" && Array.isArray(o.added) && Array.isArray(o.removed) &&
      (o.block === false || o.changed === true);
    return ok ? null : { ok: false, detail: r.kinds + " → " + JSON.stringify(o).slice(0, 140) };
  }],
  ["P33", "ftAvailable returns an integer between 1 and 5 (B2)", function (r) {
    if (r.name !== "ftAvailable" || r.threw) return null;
    return (Number.isInteger(r.out) && r.out >= 1 && r.out <= 5) ? null : { ok: false, detail: r.kinds + " → " + r.out };
  }],
  ["P34", "sellPrice and bankAfter return whole tenths (E-007)", function (r) {
    if (r.name !== "sellPrice" && r.name !== "bankAfter") return null;
    if (r.threw) return null;
    if (!Number.isInteger(r.out)) return { ok: false, detail: r.kinds + " → " + r.out };
    if (r.name !== "sellPrice" || !r.clean) return null;
    const now = Number(r.args[0]), buy = Number(r.args[1]);
    const want = buy > 0 && now > buy ? buy + Math.floor((now - buy) / 2) : now;
    return r.out === want ? null : { ok: false, detail: "sellPrice(" + now + "," + buy + ") = " + r.out + ", expected " + want };
  }],
  ["P35", "no call leaks a global or mutates the shared fixtures", function (r) {
    if (r.leaked) return { ok: false, detail: r.kinds + " leaked global " + r.leaked };
    return r.canary === SNAP_CANARY ? null : { ok: false, detail: r.kinds + " mutated the shared snapshot or state" };
  }],
  // ---- F4 / F5 / F8 (v88) ----
  ["P36", "Brier stays in [0,1], skill in [-1,1], and every reliability bin is accounted for", function (r) {
    if (r.threw || !r.out || typeof r.out !== "object") return null;
    let bad = null;
    walk(r.out, function (v, k, p) {
      if (bad !== null || !v || typeof v !== "object" || Array.isArray(v)) return;
      if (typeof v.brier === "number" && (!isFinite(v.brier) || v.brier < 0 || v.brier > 1)) bad = (p || k) + ".brier = " + v.brier;
      if (bad === null && typeof v.skill === "number" && (!isFinite(v.skill) || v.skill < -1 || v.skill > 1)) bad = (p || k) + ".skill = " + v.skill;
      if (bad === null && Array.isArray(v.bins) && typeof v.n === "number") {
        let counted = 0, shape = true;
        v.bins.forEach(function (b) {
          if (!b || typeof b !== "object" || typeof b.n !== "number" || !(b.lo >= 0) || !(b.hi <= 1) || b.lo >= b.hi) { shape = false; return; }
          counted += b.n;
        });
        if (!shape) bad = (p || k) + " has a malformed reliability bin";
        else if (counted !== v.n) bad = (p || k) + " bins hold " + counted + " of " + v.n + " rows";
      }
    });
    return bad === null ? null : { ok: false, detail: r.kinds + " → " + bad };
  }],
  ["P37", "the chip solver never repeats a chip in a set, doubles up a gameweek, or breaks an expiry", function (r) {
    if (r.name !== "chipSolver" || r.threw || !r.out || !Array.isArray(r.out.plan)) return null;
    const bounds = {};
    (Array.isArray(r.out.sets) ? r.out.sets : []).forEach(function (S) { if (S && typeof S === "object") bounds[S.set] = S; });
    const seenChip = {}, seenEvent = {};
    let bad = null;
    r.out.plan.forEach(function (a) {
      if (bad !== null || !a || typeof a !== "object") return;
      const key = a.set + ":" + a.chip;
      if (seenChip[key]) { bad = a.chip + " assigned twice in set " + a.set; return; }
      seenChip[key] = true;
      if (seenEvent[a.event]) { bad = "two chips in GW" + a.event; return; }
      seenEvent[a.event] = true;
      const B = bounds[a.set];
      if (!B) { bad = "assignment in an unknown set " + a.set; return; }
      if (!(a.event >= B.from && a.event <= B.to)) bad = a.chip + " in GW" + a.event + " is outside set " + a.set;
      else if (!isFinite(a.value) || a.value < 0) bad = a.chip + " priced at " + a.value;
    });
    return bad === null ? null : { ok: false, detail: r.kinds + " → " + bad };
  }],
  ["P38", "the promotion gate never opens below three transitions, three wins and a two-week hold-out", function (r) {
    if (r.threw || !r.out || typeof r.out !== "object") return null;
    let bad = null;
    walk(r.out, function (v, k, p) {
      if (bad !== null || !v || typeof v !== "object" || Array.isArray(v)) return;
      if (typeof v.promotable !== "boolean" || typeof v.need !== "number" || typeof v.transitions !== "number") return;
      if (v.promotable && (v.transitions < v.need || v.wins < v.need || v.holdout < v.needHoldout)) {
        bad = (p || k) + " opened at " + v.transitions + " transitions, " + v.wins + " wins, hold-out " + v.holdout;
      }
      if (bad === null && (v.wins > v.transitions || v.holdout > v.transitions)) {
        bad = (p || k) + " reports " + v.wins + " wins and a " + v.holdout + " hold-out over " + v.transitions + " transitions";
      }
    });
    return bad === null ? null : { ok: false, detail: r.kinds + " → " + bad };
  }]
];

fixture("mc_full-exactly-38-property-groups", GROUPS.length === 38, GROUPS.length + " groups");

// ---------------------------------------------------------------- 8. the fuzz loop

const GLOBAL_BEFORE = Object.getOwnPropertyNames(globalThis).length;
const ORDER = FN_NAMES.slice();

function argsFor(name, fn, trialIdx) {
  const n = arityOf(fn, name);
  const valid = VALID[name] || null;
  const args = [];
  const kinds = [];
  // Every fourth trial is clean (all valid) when a valid vector exists — that is what makes the
  // shape groups non-vacuous. Otherwise each slot independently takes junk or the valid value.
  const cleanTrial = !!valid && trialIdx % 4 === 0;
  for (let i = 0; i < n; i++) {
    if (cleanTrial) { args.push(valid[i]); kinds.push("valid"); continue; }
    const useValid = valid && i < valid.length && RNG() < 0.45;
    if (useValid || (valid && ITER_SLOT[name] === i)) { args.push(valid[i]); kinds.push("valid"); continue; }
    const j = JUNK[(Math.floor(RNG() * JUNK.length) + trialIdx + i) % JUNK.length];
    args.push(j.v); kinds.push(j.k);
  }
  return { args: args, kinds: kinds.join("|"), clean: cleanTrial };
}

let iterationsRun = 0;
const MS = {};                                   // cumulative call time per function
for (let t = 0; t < ITERS; t++) {
  const name = ORDER[t % ORDER.length];
  const fn = FNS[name];
  if (typeof fn !== "function") continue;
  const a = argsFor(name, fn, Math.floor(t / ORDER.length));
  const rec = { name: name, args: a.args, kinds: a.kinds, clean: a.clean, threw: false, err: "", errObj: null, out: undefined, ms: 0, leaked: null, canary: "" };
  heartbeat(name + " [" + a.kinds + "]");
  useHooksOf(name);
  const t0 = process.hrtime.bigint();
  try { rec.out = fn.apply(null, a.args); }
  catch (e) { rec.threw = true; rec.errObj = e; rec.err = e && e.message ? String(e.message) : String(e); }
  rec.ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (Object.getOwnPropertyNames(globalThis).length !== GLOBAL_BEFORE) rec.leaked = "globalThis grew";
  try { rec.canary = JSON.stringify({ squad: SQUAD, state: STATE, els: Object.keys(CTX.els).length, ctxSquad: CTX.squadIds }); } catch (e) { rec.canary = "unserialisable"; }
  iterationsRun++;
  MS[name] = (MS[name] || 0) + rec.ms;
  for (let g = 0; g < GROUPS.length; g++) {
    const G = GROUPS[g];
    let verdict = null;
    try { verdict = G[2](rec); }
    catch (e) { verdict = { ok: false, detail: "property group threw: " + (e && e.message ? e.message : String(e)) }; }
    record(G[0], G[1], name, verdict === null ? true : verdict.ok !== false ? true : false, verdict && verdict.detail);
  }
}

// ---------------------------------------------------------------- 9. verdict

const passedFns = FN_NAMES.filter(function (n) { return !fnBad[n]; });
const badFns = Object.keys(fnBad);

console.log("");
console.log("--- property groups ---");
GROUPS.forEach(function (G) {
  const g = groupHits[G[0]] || { run: 0, failed: 0 };
  console.log((g.failed ? "FAIL " : "PASS ") + G[0] + " " + G[1] + " · " + g.run + " checks, " + g.failed + " failed");
});
if (badFns.length) {
  console.log("");
  console.log("--- functions that failed a property group ---");
  badFns.forEach(function (n) {
    const ids = fnBad[n].filter(function (v, i) { return fnBad[n].indexOf(v) === i; });
    console.log("  " + n + " → " + ids.join(","));
  });
}
if (failures.length) {
  console.log("");
  console.log("--- first " + failures.length + " failures ---");
  failures.forEach(function (f) { console.log("  " + f); });
}
const slowest = Object.keys(MS).sort(function (a, b) { return MS[b] - MS[a]; }).slice(0, 6);
console.log("");
console.log("slowest fuzz targets: " + slowest.map(function (n) { return n + " " + Math.round(MS[n]) + " ms"; }).join(" · "));
console.log("seed " + SEED + " · " + FN_NAMES.length + " top-level functions (" + TOTAL_FNS.length + " total, " +
  THROWERS.length + " documented throwers, " + COMPONENTS.length + " React components)");
console.log("SUITE mc_full " + iterationsRun + " iters · " + assertions + " assertions · " + passedFns.length + "/" + FN_NAMES.length + " · " + failCount);
process.exit(failCount > 0 ? 1 : 0);

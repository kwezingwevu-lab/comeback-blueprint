/*
 * qa/components.cjs — component OUTPUT suite (Part I "test coverage").
 *
 * Why it exists
 *   qa/mc_full.cjs fuzzes the 21 React components under a props CONTRACT only (group P03:
 *   junk props must be rejected with a TypeError, no hang, no global leak). Nothing asserted
 *   what any of them RENDER. smoke.cjs, buttons.cjs and webkit.js drive the whole app in a
 *   browser, so a component that draws nothing inside an open section stays invisible to them
 *   as long as the page still paints. This suite renders each component on its own, from the
 *   real snapshot, through react-dom/server, and asserts on the markup.
 *
 * How it runs
 *   The assembled app (app/FPL_Mission_Control.jsx) is transpiled with esbuild
 *   (--jsx=transform, format cjs) and evaluated against the REAL react, recharts and
 *   lucide-react from node_modules — not the descriptor stubs mc_full uses — so
 *   renderToStaticMarkup produces the HTML the browser paints on first render. Effects do not
 *   run under renderToStaticMarkup, which is exactly what is wanted: first paint from props.
 *
 * Four passes
 *   A · valid props from the shipped snapshot (data/live.json + state/kwezi.json + buildCtx):
 *       a non-empty string, no `undefined` / `NaN` / `[object Object]` in the markup, no hex
 *       colour literal outside the one <style> block (CONTRACT §7), no empty class attribute,
 *       and every data-testid the component OWNS present in the union of its variants.
 *   B · degraded but legal ctx — no fixtures, no rivals, an empty squad, a blocked D3 state:
 *       still renders, and says something honest rather than going blank.
 *   C · junk props, the same 20 kinds mc_full uses, one prop slot at a time and then the whole
 *       props object: the render either returns markup or throws, and never leaks the junk.
 *   D · the ownership scan is proven non-vacuous: every literal data-testid in the shipped file
 *       is claimed by exactly one component and nothing is left unclaimed.
 *
 * Two definitions, written down so neither can be read as loose
 *
 *   1. "never leaks the junk". A component has two kinds of prop. A TEXT slot (`title`,
 *      `label`, `k`, `v`, `children`, `cols`, `tone`, `where`, `id`, `importErr`) exists to be
 *      printed; demanding that its value not appear in the markup would assert the opposite of
 *      its contract, so the leak rule does not apply to the slot it was placed in — and the
 *      TEXT list is declared per component below, in the open. Every other slot is a DATA slot:
 *      it is read, never printed, and the residues that prove it reached the screen are
 *      `undefined`, `NaN`, `[object Object]`, `Infinity`, a function source, and an echo of the
 *      100k-character string. Those fail, in any slot including a TEXT one when the junk went
 *      somewhere else.
 *
 *   2. "or throws". React itself refuses an object or a function where a child belongs, and it
 *      throws a plain Error for it, not a TypeError. That is React's guard, not the app's, so
 *      the assertion is: every throw is a TypeError, OR its message is React's own child/element
 *      type guard, quoted below. Any other error class or message still fails, and the counts of
 *      each are printed.
 *
 * Known open defect carried here, not hidden: MoveList renders `<span class="">` for the
 * captain and vice rows (`tone` is "" for those two actions). See ERRORS.md E-070. src/ui.jsx
 * is owned by another agent, so this suite pins the defect to exactly those two spans: any
 * other empty class attribute, anywhere, is a FAIL.
 *
 * Run: node qa/components.cjs [--verbose]
 */

"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "app", "FPL_Mission_Control.jsx");
const VERBOSE = process.argv.indexOf("--verbose") >= 0;
const NOW = "2026-09-12T06:00:00Z";

let pass = 0, total = 0;
const fails = [];
function assert(name, cond, detail) {
  total++;
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fails.push(name + " — " + String(detail === undefined ? "" : detail).slice(0, 240));
  console.log("FAIL " + name + " — " + String(detail === undefined ? "" : detail).slice(0, 240));
  return false;
}
function bail(msg) {
  console.log("FAIL components — " + msg);
  console.log("SUITE components 0/1");
  process.exit(1);
}
function done() {
  console.log("");
  if (fails.length) { console.log("--- failures ---"); fails.forEach(function (f) { console.log("  " + f); }); }
  console.log("SUITE components " + pass + "/" + total);
  process.exit(fails.length ? 1 : 0);
}

// ---------------------------------------------------------------- 1. transpile + evaluate

if (!fs.existsSync(APP)) bail("app/FPL_Mission_Control.jsx does not exist (run `node build.cjs`)");

let esbuild;
try { esbuild = require(path.join(ROOT, "node_modules", "esbuild")); }
catch (e) { bail("esbuild is not installed in fpl/node_modules"); }

const SRC = fs.readFileSync(APP, "utf8");
const FN_NAMES = [];
const DECL = /^(?:export\s+default\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
let mm;
while ((mm = DECL.exec(SRC))) FN_NAMES.push(mm[1]);

const EPILOGUE = "\nmodule.exports.__FNS__ = {" +
  FN_NAMES.map(function (n) { return JSON.stringify(n) + ": (typeof " + n + " === \"function\" ? " + n + " : null)"; }).join(",") +
  "};\nmodule.exports.__LIVE__ = (typeof LIVE !== \"undefined\" ? LIVE : null);\n";

/* The browser globals the components legitimately read at render time: a mocked clock (the
   browser suites set window.__NOW__ the same way) and a clipboard, without which the Export
   panel's Copy button is correctly not drawn. Nothing else is provided — a component that
   needs more than this on first paint would fail here, which is the point. */
global.window = global.window || { __NOW__: NOW };
// node 22 exposes `navigator` as a getter-only global, so the clipboard is defined over it.
try {
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: function () { return Promise.resolve(); } } },
    configurable: true, writable: true, enumerable: true
  });
} catch (e) { /* Copy simply will not be drawn, and the testid check will say so */ }

let CODE;
try {
  CODE = esbuild.transformSync(SRC + EPILOGUE, { loader: "jsx", jsx: "transform", format: "cjs", target: "node22" }).code;
} catch (e) { bail("esbuild could not transpile the app: " + (e && e.message ? String(e.message).split("\n")[0] : String(e))); }

const appRequire = Module.createRequire(path.join(ROOT, "package.json"));
const MODULE = { exports: {} };
let FNS = null;
try {
  new Function("require", "module", "exports", CODE)(appRequire, MODULE, MODULE.exports);
  FNS = MODULE.exports.__FNS__;
} catch (e) { bail("evaluating the transpiled app under the real React threw: " + (e && e.message ? e.message : String(e))); }

const React = appRequire("react");
const RDS = appRequire("react-dom/server");
const LIVE = MODULE.exports.__LIVE__;
const F = function (n) { return FNS[n]; };
const COMPONENTS = FN_NAMES.filter(function (n) { return /^[A-Z]/.test(n); });

assert("components-the-assembled-app-evaluates-under-the-real-react",
  !!FNS && !!(React && React.version) && typeof RDS.renderToStaticMarkup === "function",
  "react " + (React && React.version));
assert("components-every-capitalised-top-level-function-is-in-scope",
  COMPONENTS.length >= 21 && COMPONENTS.every(function (n) { return typeof FNS[n] === "function"; }),
  COMPONENTS.length + " components: " + COMPONENTS.join(","));
assert("components-the-live-block-is-in-scope",
  !!(LIVE && Array.isArray(LIVE.elements) && LIVE.elements.length > 100),
  LIVE ? LIVE.elements.length + " elements" : "no LIVE block");

// ---------------------------------------------------------------- 2. pass D — the ownership scan

/* Which component owns which data-testid, read out of the shipped file rather than typed here,
   so a testid added to the app cannot drift away from this suite. A component's boundary is a
   top-level function declaration; <Section id="x"> renders data-testid="sec-x" and
   <Reveal id="x"> renders "rev-x" (Section and Reveal own the prefix itself). */
function scanOwnership(src) {
  const lines = src.split("\n");
  const owned = {}, claim = {};
  let cur = null;
  const decl = /^(?:export\s+default\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;
  for (let i = 0; i < lines.length; i++) {
    const d = decl.exec(lines[i]);
    if (d) cur = d[1];
    if (!cur || !/^[A-Z]/.test(cur)) continue;
    const L = lines[i];
    const push = function (id) {
      (owned[cur] || (owned[cur] = [])).push(id);
      (claim[id] || (claim[id] = [])).push(cur);
    };
    let m2;
    const TID = /data-testid="([^"]+)"/g; while ((m2 = TID.exec(L))) push(m2[1]);
    const SEC = /<Section\s+id="([^"]+)"/g; while ((m2 = SEC.exec(L))) push("sec-" + m2[1]);
    const REV = /<Reveal\s+id="([^"]+)"/g; while ((m2 = REV.exec(L))) push("rev-" + m2[1]);
  }
  Object.keys(owned).forEach(function (k) { owned[k] = owned[k].filter(function (v, i) { return owned[k].indexOf(v) === i; }); });
  return { owned: owned, claim: claim };
}
const OWN = scanOwnership(SRC);
const OWNED = OWN.owned;
const multi = Object.keys(OWN.claim).filter(function (id) {
  const c = OWN.claim[id].filter(function (v, i) { return OWN.claim[id].indexOf(v) === i; });
  return c.length > 1;
});
assert("D-every-testid-in-the-shipped-file-is-owned-by-exactly-one-component",
  multi.length === 0, multi.map(function (id) { return id + " → " + OWN.claim[id].join("/"); }).join("; "));

const literalIds = (function () {
  const out = []; let m3; const RE = /data-testid="([^"]+)"/g;
  while ((m3 = RE.exec(SRC))) if (out.indexOf(m3[1]) < 0) out.push(m3[1]);
  return out.sort();
})();
const ownedUnion = (function () {
  const out = [];
  Object.keys(OWNED).forEach(function (k) { OWNED[k].forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); }); });
  return out;
})();
assert("D-the-ownership-map-covers-every-literal-testid-in-the-source",
  literalIds.every(function (id) { return ownedUnion.indexOf(id) >= 0; }),
  literalIds.filter(function (id) { return ownedUnion.indexOf(id) < 0; }).join(","));

/* Four testids cannot exist in a static first render: each is gated by a component's OWN
   useState, which only a user event sets. They are not skipped — each one is asserted to be
   exercised by a browser suite that clicks it, so nothing falls between the two. */
const SSR_UNREACHABLE = {
  "draft-league-save": "TabDraft's Save button appears only once the league input differs from the saved value (local useState `txt`)",
  "import-apply": "TabLab's Apply button appears only once the paste box holds text (local useState `imp`)",
  "refbar": "App's refresh bar renders only while its own `busy` state is true",
  "err": "App's error line renders only once its own `refErr` state is set"
};
const BROWSER_SUITES = ["smoke.cjs", "buttons.cjs", "webkit.js"].map(function (f) {
  try { return fs.readFileSync(path.join(ROOT, "qa", f), "utf8"); } catch (e) { return ""; }
}).join("\n");
Object.keys(SSR_UNREACHABLE).forEach(function (id) {
  const seen = BROWSER_SUITES.indexOf('data-testid="' + id + '"') >= 0 || BROWSER_SUITES.indexOf("." + id) >= 0;
  assert("D-" + id + "-is-unreachable-in-a-static-render-and-is-covered-by-a-browser-suite", seen,
    "no browser suite mentions it — " + SSR_UNREACHABLE[id]);
});
console.log("       " + Object.keys(OWNED).length + " components own " + ownedUnion.length + " testids (" +
  literalIds.length + " literal, the rest from Section/Reveal ids); " + Object.keys(SSR_UNREACHABLE).length + " are state-gated");

// ---------------------------------------------------------------- 3. contexts from the real snapshot

const KWEZI = JSON.parse(fs.readFileSync(path.join(ROOT, "state", "kwezi.json"), "utf8"));
const baseState = F("sanitiseState")(JSON.parse(JSON.stringify(KWEZI)));
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function ctxOf(live, state) { return F("buildCtx")(live, state, NOW); }

const CTX = ctxOf(LIVE, baseState);
assert("components-the-shipped-snapshot-builds-a-usable-context",
  !!(CTX && CTX.ok === true && CTX.squadIds.length === 15), CTX ? String(CTX.error) : "no ctx");

// A league-loaded snapshot from the recorded public responses, so the draft paths that exist
// only with a real free-agent pool are rendered too (the same shaping the fetcher runs).
let CTX_LEAGUE = null, STATE_LEAGUE = null;
try {
  const DF = require(path.join(ROOT, "qa", "fixtures", "draft_fixture.cjs"));
  const block = DF.leagueBlock(LIVE, 1, {});
  const liveL = DF.asTeam(LIVE, 1, block.entries[0].leagueEntryId);
  STATE_LEAGUE = clone(baseState);
  STATE_LEAGUE.draft.league_id = 1;
  STATE_LEAGUE.draft.league_input = "1";
  CTX_LEAGUE = ctxOf(liveL, STATE_LEAGUE);
} catch (e) { CTX_LEAGUE = null; }
assert("components-a-league-loaded-context-builds-from-the-recorded-fixtures",
  !!(CTX_LEAGUE && CTX_LEAGUE.ok && CTX_LEAGUE.draft && CTX_LEAGUE.draft.hasPool),
  CTX_LEAGUE ? "hasPool " + (CTX_LEAGUE.draft && CTX_LEAGUE.draft.hasPool) : "fixtures unavailable");

// The wildcard already played: the landing drops to the transfer plan and the saved fifteen's
// own flags (Shaw, status d) become the thing the manager has to be told about.
const chipUsedLive = (function () { const l = clone(LIVE); l.history.chips = [{ name: "wildcard", event: 3 }]; return l; })();
const CTX_CHIPUSED = ctxOf(chipUsedLive, baseState);

/* The four degraded-but-legal worlds: a snapshot pulled before the fixture list published, a
   manager in no mini-league, a fresh install with nothing saved, and the D3 block. */
const noFixLive = (function () { const l = clone(LIVE); l.fixtures = []; return l; })();
const noRivLive = (function () { const l = clone(LIVE); l.rivals = {}; l.leagues = []; return l; })();
const emptyState = (function () { const s = clone(baseState); s.squad = []; return s; })();
const blockState = (function () {
  const s = clone(baseState);
  const owned = s.squad.map(function (q) { return q.id; });
  const alt = LIVE.elements.filter(function (e) { return owned.indexOf(e.id) < 0; })[0];
  s.squad[0] = { id: alt.id, purchase: alt.now_cost };
  s.confirmed_gw = 0;
  return s;
})();

const DEGRADED = [
  { key: "no-fixtures", ctx: ctxOf(noFixLive, baseState), state: baseState },
  { key: "no-rivals", ctx: ctxOf(noRivLive, baseState), state: baseState },
  { key: "empty-squad", ctx: ctxOf(LIVE, emptyState), state: emptyState },
  { key: "blocked-D3", ctx: ctxOf(LIVE, blockState), state: blockState }
];
DEGRADED.forEach(function (d) {
  assert("components-degraded-context-builds-" + d.key, !!(d.ctx && typeof d.ctx === "object"), "buildCtx returned nothing");
});
assert("components-the-blocked-world-really-blocks",
  !!(DEGRADED[3].ctx && DEGRADED[3].ctx.block && DEGRADED[3].ctx.block.block === true),
  "block " + JSON.stringify(DEGRADED[3].ctx && DEGRADED[3].ctx.block));
assert("components-the-no-fixtures-world-really-has-no-fixtures",
  Array.isArray(noFixLive.fixtures) && noFixLive.fixtures.length === 0, "fixtures still present");

// ---------------------------------------------------------------- 4. props fixtures

const noop = function () {};
const ON = { sec: noop, rev: noop };
function allOpen() {
  // openOf reads ui.open[id]; a Proxy answering true opens every Section and Reveal, so a
  // component's whole body is measured rather than only its primary panel.
  return new Proxy({}, { get: function (t, k) { return k === "toJSON" ? undefined : true; }, has: function () { return true; }, ownKeys: function () { return []; } });
}
function uiFor(tab, open) { return { mode: "full", tab: tab, open: open ? allOpen() : {}, reveals: open ? allOpen() : {} }; }

const PLAN = F("buildPlan")(CTX, false);
const PLAN_LOCKED = F("buildPlan")(CTX, true);
const PLAN_CHIPUSED = F("buildPlan")(CTX_CHIPUSED, false);
const PLAN_BLOCKED = F("buildPlan")(DEGRADED[3].ctx, false);
const TP = F("transferProtocol")(null, CTX);
const KID = React.createElement("div", { className: "dim" }, "child content");

assert("components-the-chip-used-world-reaches-the-transfer-landing-with-a-real-flag",
  PLAN_CHIPUSED.kind !== "wildcard" && PLAN_CHIPUSED.flags.length > 0,
  "kind " + PLAN_CHIPUSED.kind + ", " + PLAN_CHIPUSED.flags.length + " flags");

/* props: the valid fixture · text: the slots that exist to be printed · variants: extra renders
   whose union has to carry every owned testid · fuzz: the props pass C starts from (sections
   closed, which is first paint, and keeps the junk pass off the wildcard solver). */
const FIX = {
  Section: { props: { id: "cmd-stand", title: "Where the season stands", open: true, onToggle: noop, children: KID }, text: ["id", "title", "children"], passthrough: true },
  Reveal: { props: { id: "ld-why", label: "Why this call", open: true, onToggle: noop, children: KID }, text: ["id", "label", "children"], passthrough: true },
  Tier: { props: { k: "T0" }, text: ["k"], passthrough: true },
  BlockNote: { props: { ctx: DEGRADED[3].ctx, onConfirm: noop, where: "plan-tx" }, text: ["where"] },
  Guard: { props: { ctx: DEGRADED[3].ctx, onConfirm: noop, where: "plan-tx", children: KID }, text: ["where", "children"], passthrough: true },
  Row: { props: { cols: "22px minmax(0,1fr) auto", head: false, children: KID }, text: ["cols", "children"], passthrough: true },
  KV: { props: { k: "Overall rank", v: "5,081,388", tone: "go" }, text: ["k", "v", "tone"], passthrough: true },
  Meter: { props: { pct: 62, label: "Gameweek progress" }, text: ["label"], passthrough: true },
  GwActionCard: {
    props: { plan: PLAN, ctx: CTX, mode: "simple", reveals: {}, onReveal: noop, onConfirm: noop }, text: ["mode"],
    variants: [
      { plan: PLAN, ctx: CTX, mode: "full", reveals: allOpen(), onReveal: noop, onConfirm: noop },
      { plan: PLAN_LOCKED, ctx: CTX, mode: "full", reveals: allOpen(), onReveal: noop, onConfirm: noop },
      { plan: PLAN_CHIPUSED, ctx: CTX_CHIPUSED, mode: "full", reveals: allOpen(), onReveal: noop, onConfirm: noop },
      { plan: PLAN_BLOCKED, ctx: DEGRADED[3].ctx, mode: "simple", reveals: {}, onReveal: noop, onConfirm: noop }
    ]
  },
  Header: { props: { ctx: CTX, onRefresh: noop, onMenu: noop, menuOpen: false, busy: false }, text: [] },
  Tabs: { props: { tab: "command", onTab: noop }, text: ["tab"] },
  Menu: { props: { mode: "simple", onMode: noop, onJump: noop }, text: ["mode"] },
  TabCommand: { props: { ctx: CTX, ui: uiFor("command", true), on: ON }, text: [] },
  MoveList: { props: { ctx: CTX, tp: TP }, text: [] },
  TabPlan: {
    props: { ctx: CTX, ui: uiFor("plan", true), on: ON, plan: PLAN, onConfirm: noop }, text: [],
    variants: [{ ctx: CTX, ui: uiFor("plan", true), on: ON, plan: PLAN_LOCKED, onConfirm: noop }],
    fuzz: { ctx: CTX, ui: uiFor("plan", false), on: ON, plan: PLAN, onConfirm: noop }
  },
  TabSquad: { props: { ctx: CTX, ui: uiFor("squad", true), on: ON, onConfirm: noop }, text: [] },
  TabRivals: { props: { ctx: CTX, ui: uiFor("rivals", true), on: ON, plan: PLAN, simLeague: 0, onSimLeague: noop, onConfirm: noop }, text: [] },
  TabDraft: {
    props: { ctx: CTX, ui: uiFor("draft", true), on: ON, state: baseState, onLeague: noop }, text: [],
    variants: CTX_LEAGUE ? [{ ctx: CTX_LEAGUE, ui: uiFor("draft", true), on: ON, state: STATE_LEAGUE, onLeague: noop }] : []
  },
  TabChips: { props: { ctx: CTX, ui: uiFor("chips", true), on: ON, plan: PLAN, onConfirm: noop }, text: [],
    fuzz: { ctx: CTX, ui: uiFor("chips", false), on: ON, plan: PLAN, onConfirm: noop } },
  TabLab: {
    props: { ctx: CTX, ui: uiFor("lab", true), on: ON, state: baseState, onDownload: noop, onCopy: noop, onImport: noop, importErr: null,
      refresh: { busy: false, err: null, okMsg: "", onRefresh: noop, onPair: noop } },
    text: ["importErr"],
    variants: [{ ctx: CTX, ui: uiFor("lab", true), on: ON, state: baseState, onDownload: noop, onCopy: noop, onImport: noop, importErr: "that file had no squad in it",
      refresh: { busy: true, err: "400 invalid_request_error", okMsg: "", onRefresh: noop, onPair: noop } }]
  },
  App: { props: {}, text: [] }
};

const missingFix = COMPONENTS.filter(function (n) { return !FIX[n]; });
assert("components-every-component-has-a-valid-props-fixture", missingFix.length === 0, missingFix.join(","));

// ---------------------------------------------------------------- 5. render helpers

function render(name, props) { return RDS.renderToStaticMarkup(React.createElement(FNS[name], props)); }
function tryRender(name, props) {
  const t0 = Date.now();
  try { return { ok: true, html: render(name, props), ms: Date.now() - t0 }; }
  catch (e) { return { ok: false, err: e, ms: Date.now() - t0 }; }
}
function stripStyle(html) { return String(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ""); }
function visibleText(html) {
  return stripStyle(html).replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function wordsOf(html) { return visibleText(html).split(" ").filter(Boolean).length; }

/* ERRORS.md E-070, closed in v88: MoveList shipped class="" on the captain and vice rows because
   tone was "" for both. Fixed in src/ui.jsx (className={tone || undefined}); the pin that used to
   allow those two strings is gone, so ANY empty class attribute anywhere is now a FAIL. */
function emptyClassOffenders(html) {
  return (stripStyle(html).match(/class=""/g) || []).length;
}

// ---------------------------------------------------------------- 6. pass A — valid props

console.log("");
console.log("--- pass A · valid props, the shipped snapshot ---");

const perComponent = {};
function tally(name) { return perComponent[name] || (perComponent[name] = { a: 0, aFail: 0, b: 0, bFail: 0, c: 0, cFail: 0 }); }
const MS = {};
let knownEmptyClassSeen = 0;

COMPONENTS.forEach(function (name) {
  const fx = FIX[name];
  if (!fx) return;
  const c = tally(name);
  const variants = [fx.props].concat(fx.variants || []);
  let union = "";
  variants.forEach(function (p, i) {
    const r = tryRender(name, p);
    MS[name] = (MS[name] || 0) + r.ms;
    c.a++;
    if (!r.ok) { c.aFail++; assert("A-" + name + "-variant-" + i + "-renders-without-throwing", false, r.err && r.err.message); return; }
    union += r.html;
    const clean = stripStyle(r.html);
    const bad = [];
    if (typeof r.html !== "string" || r.html.length === 0) bad.push("empty markup");
    if (/\bundefined\b/.test(clean)) bad.push("undefined");
    if (/\bNaN\b/.test(clean)) bad.push("NaN");
    if (clean.indexOf("[object Object]") >= 0) bad.push("[object Object]");
    const extraEmpty = emptyClassOffenders(r.html);
    knownEmptyClassSeen += extraEmpty;
    if (extraEmpty) bad.push(extraEmpty + " empty class attribute(s)");
    const hex = clean.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    if (hex.length) bad.push("hex " + hex.slice(0, 4).join(","));
    if (bad.length) c.aFail++;
    assert("A-" + name + "-variant-" + i + "-markup-is-clean", bad.length === 0, bad.join(" · "));
  });
  const owned = (OWNED[name] || []).filter(function (id) { return !SSR_UNREACHABLE[id]; });
  if (owned.length) {
    const miss = owned.filter(function (id) { return union.indexOf('data-testid="' + id + '"') < 0; });
    c.a++;
    if (miss.length) c.aFail++;
    assert("A-" + name + "-renders-every-testid-it-owns", miss.length === 0,
      "missing " + miss.join(",") + " of " + owned.length);
  }
  if (VERBOSE) console.log("       " + name + " " + union.length + " chars over " + variants.length + " variant(s)");
});

assert("A-no-component-ships-an-empty-class-attribute-E070", knownEmptyClassSeen === 0,
  knownEmptyClassSeen + " empty class attribute(s) across every pass-A render (E-070 was two, on MoveList's captain and vice rows)");

// Part G, on first paint: the landing card is the one screen read before a deadline.
(function () {
  const r = tryRender("GwActionCard", FIX.GwActionCard.props);
  const w = r.ok ? wordsOf(r.html) : 0;
  assert("A-GwActionCard-first-paint-says-something-and-stays-under-the-110-word-gate",
    r.ok && w > 10 && w < 110, r.ok ? w + " visible words" : "threw");
})();

// ---------------------------------------------------------------- 7. pass B — degraded contexts

console.log("");
console.log("--- pass B · degraded but legal contexts ---");

const CTX_COMPONENTS = ["BlockNote", "Guard", "GwActionCard", "Header", "TabCommand", "MoveList",
  "TabPlan", "TabSquad", "TabRivals", "TabDraft", "TabChips", "TabLab"];

DEGRADED.forEach(function (d) {
  const dPlan = F("buildPlan")(d.ctx, false);
  let dTp; try { dTp = F("transferProtocol")(null, d.ctx); } catch (e) { dTp = { order: [], moves: [] }; }
  CTX_COMPONENTS.forEach(function (name) {
    const base = FIX[name].props;
    const p = {};
    Object.keys(base).forEach(function (k) { p[k] = base[k]; });
    p.ctx = d.ctx;
    if ("plan" in p) p.plan = dPlan;
    if ("tp" in p) p.tp = dTp;
    if ("state" in p) p.state = d.state;
    if ("ui" in p) p.ui = uiFor(base.ui ? base.ui.tab : "command", true);
    const c = tally(name);
    const r = tryRender(name, p);
    c.b++;
    if (!r.ok) { c.bFail++; assert("B-" + name + "-survives-" + d.key, false, r.err && r.err.message); return; }
    const clean = stripStyle(r.html);
    const bad = [];
    if (!r.html.length) bad.push("empty markup");
    // A pass-through container is judged on carrying its children, not on its own word count.
    if (FIX[name].passthrough) { if (visibleText(r.html).indexOf("child content") < 0 && wordsOf(r.html) < 3) bad.push("dropped its children and said nothing"); }
    // Three words is the shortest honest answer anywhere in the app ("Nothing to execute."),
    // so the floor is three: fewer means the panel went blank rather than explaining itself.
    else if (wordsOf(r.html) < 3) bad.push("only " + wordsOf(r.html) + " visible words — it went blank instead of saying why");
    if (/\bundefined\b/.test(clean)) bad.push("undefined");
    if (/\bNaN\b/.test(clean)) bad.push("NaN");
    if (clean.indexOf("[object Object]") >= 0) bad.push("[object Object]");
    if (emptyClassOffenders(r.html)) bad.push("undocumented empty class attribute");
    if (bad.length) c.bFail++;
    assert("B-" + name + "-survives-" + d.key, bad.length === 0, bad.join(" · "));
  });
});

// ---------------------------------------------------------------- 8. pass C — junk props

console.log("");
console.log("--- pass C · the 20 junk kinds, one slot at a time, then the whole props object ---");

const DEEP = (function () { const o = { squad: [] }; let c = o; for (let i = 0; i < 60; i++) { c.next = { i: i, s: "n" + i }; c = c.next; } return o; })();
const BIGSTR = new Array(100001).join("z");
const JUNK = [
  { k: "null", v: null }, { k: "undefined", v: undefined }, { k: "empty string", v: "" },
  { k: "non-JSON string", v: "x" }, { k: "zero", v: 0 }, { k: "negative zero", v: -0 },
  { k: "NaN", v: NaN }, { k: "Infinity", v: Infinity }, { k: "true", v: true },
  { k: "empty array", v: [] }, { k: "empty object", v: {} }, { k: "array of null", v: [null] },
  { k: "object {a:1}", v: { a: 1 } }, { k: "100k-character string", v: BIGSTR },
  { k: "40-element array", v: (function () { const a = []; for (let i = 0; i < 40; i++) a.push(i % 7 ? i : { id: i }); return a; })() },
  { k: "deep nested object", v: DEEP }, { k: "negative number", v: -7.5 }, { k: "huge number", v: 1e308 },
  { k: "function", v: function fuzzFn() { return 1; } },
  { k: "unicode keys", v: { "éè€": 1, "क": [1, 2], "日本": { z: true } } }
];
assert("C-exactly-20-junk-kinds-the-same-set-mc_full-uses", JUNK.length === 20, JUNK.length + " kinds");

const REACT_CHILD_GUARD = /Objects are not valid as a React child|Functions are not valid as a React child|is not a function or its return value is not iterable|type is invalid/;

function residues(html) {
  const clean = stripStyle(html);
  const out = [];
  if (/\bundefined\b/.test(clean)) out.push("undefined");
  if (/\bNaN\b/.test(clean)) out.push("NaN");
  if (clean.indexOf("[object Object]") >= 0) out.push("[object Object]");
  if (/\bInfinity\b/.test(clean)) out.push("Infinity");
  if (clean.indexOf("fuzzFn") >= 0) out.push("function source");
  if (clean.indexOf("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz") >= 0) out.push("the 100k string echoed");
  return out;
}

const GLOBALS_BEFORE = Object.getOwnPropertyNames(globalThis).length;
let junkCalls = 0, junkThrew = 0, junkTypeError = 0, junkReactGuard = 0, junkOther = 0, junkRendered = 0;
const otherErrors = [];

COMPONENTS.forEach(function (name) {
  const fx = FIX[name];
  if (!fx) return;
  const c = tally(name);
  const basis = fx.fuzz || fx.props;
  const slots = Object.keys(basis);
  const textSlots = fx.text || [];
  let bad = 0, detail = "", localCalls = 0;

  const cases = [];
  slots.forEach(function (s) { JUNK.forEach(function (j) { cases.push({ slot: s, j: j }); }); });
  JUNK.forEach(function (j) { cases.push({ slot: "__all__", j: j }); });

  cases.forEach(function (cs) {
    let props;
    if (cs.slot === "__all__") props = cs.j.v;
    else { props = {}; slots.forEach(function (k) { props[k] = basis[k]; }); props[cs.slot] = cs.j.v; }
    const r = tryRender(name, props);
    junkCalls++; localCalls++;
    if (!r.ok) {
      junkThrew++;
      const msg = String(r.err && r.err.message || r.err);
      if (r.err instanceof TypeError) junkTypeError++;
      else if (REACT_CHILD_GUARD.test(msg)) junkReactGuard++;
      else {
        junkOther++;
        if (otherErrors.length < 8) otherErrors.push(name + "." + cs.slot + "=" + cs.j.k + " → " + (r.err && r.err.constructor ? r.err.constructor.name : typeof r.err) + ": " + msg.slice(0, 90));
        bad++;
        if (detail.length < 320) detail += (detail ? " · " : "") + cs.slot + "=" + cs.j.k + " → " + msg.slice(0, 70);
      }
      return;
    }
    junkRendered++;
    if (typeof r.html !== "string") { bad++; detail += " " + cs.slot + "=" + cs.j.k + " → not a string"; return; }
    if (emptyClassOffenders(r.html)) { bad++; if (detail.length < 320) detail += (detail ? " · " : "") + cs.slot + "=" + cs.j.k + " → undocumented empty class"; }
    if (cs.slot !== "__all__" && textSlots.indexOf(cs.slot) >= 0) return;   // a TEXT slot prints what it is given
    const res = residues(r.html);
    if (res.length) { bad++; if (detail.length < 320) detail += (detail ? " · " : "") + cs.slot + "=" + cs.j.k + " → " + res.join(","); }
  });

  c.c = localCalls; c.cFail = bad;
  assert("C-" + name + "-renders-or-throws-cleanly-and-never-leaks-the-junk", bad === 0,
    bad + " of " + localCalls + " junk renders: " + detail);
});

assert("C-no-junk-render-leaked-a-global",
  Object.getOwnPropertyNames(globalThis).length === GLOBALS_BEFORE,
  "globalThis grew by " + (Object.getOwnPropertyNames(globalThis).length - GLOBALS_BEFORE));
assert("C-every-throw-was-a-TypeError-or-React's-own-child-type-guard", junkOther === 0,
  junkOther + " other throws: " + otherErrors.join(" | "));
assert("C-the-junk-pass-really-exercised-both-outcomes", junkRendered > 100 && junkThrew > 20,
  junkRendered + " rendered, " + junkThrew + " threw");

// ---------------------------------------------------------------- 9. per-component report

console.log("");
console.log("--- per-component counts (A valid · B degraded · C junk) ---");
COMPONENTS.forEach(function (name) {
  const c = perComponent[name] || { a: 0, aFail: 0, b: 0, bFail: 0, c: 0, cFail: 0 };
  console.log("  " + (name + "                ").slice(0, 16) +
    " A " + (c.a - c.aFail) + "/" + c.a +
    " · B " + (c.b - c.bFail) + "/" + c.b +
    " · C " + (c.c - c.cFail) + "/" + c.c +
    (MS[name] ? "   (" + MS[name] + " ms of valid render)" : ""));
});
console.log("");
console.log("junk renders " + junkCalls + " · produced markup " + junkRendered + " · threw " + junkThrew +
  " (TypeError " + junkTypeError + ", React child guard " + junkReactGuard + ", other " + junkOther + ")");

done();

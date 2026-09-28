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
// E-123: the MC ENGINE block's column-0 functions live inside the UMD wrapper, not at module scope; not scanned.
const SCAN_SRC = SRC.replace(/\/\/ MC ENGINE — START[\s\S]*?\/\/ MC ENGINE — END/, "");
let mm;
while ((mm = DECL.exec(SCAN_SRC))) FN_NAMES.push(mm[1]);

const EPILOGUE = "\nmodule.exports.__FNS__ = {" +
  FN_NAMES.map(function (n) { return JSON.stringify(n) + ": (typeof " + n + " === \"function\" ? " + n + " : null)"; }).join(",") +
  "};\nmodule.exports.__LIVE__ = (typeof LIVE !== \"undefined\" ? LIVE : null);\n" +
  /* v110 D0: the four blocks the ported engine reads (CONTRACT §2) and the app's own tab table, taken out of
     the assembled file rather than retyped here, so a tab or a block added to the app is seen by this suite. */
  "module.exports.__MC__ = { MC: (typeof MC !== \"undefined\" ? MC : null), PLAN: (typeof PLAN !== \"undefined\" ? PLAN : null)," +
  " PRE: (typeof PRE !== \"undefined\" ? PRE : null), MCEngine: (typeof MCEngine !== \"undefined\" ? MCEngine : null) };\n" +
  "module.exports.__TABS__ = (typeof TABS !== \"undefined\" ? TABS : null);\n" +
  "module.exports.__PRIMARY__ = (typeof PRIMARY !== \"undefined\" ? PRIMARY : null);\n";

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

/* v110 D0 · the integration. App builds the ported engine once, MCEngine.create(MC), and hands every tab and the
   landing card props.mc = { MC, PLAN, PRE, E }. The suite builds the same object from the same blocks. */
const MCB = MODULE.exports.__MC__ || {};
const APP_TABS = Array.isArray(MODULE.exports.__TABS__) ? MODULE.exports.__TABS__ : [];
const APP_PRIMARY = MODULE.exports.__PRIMARY__ || {};
let MCP = null;
try { MCP = { MC: MCB.MC, PLAN: MCB.PLAN, PRE: MCB.PRE, E: MCB.MCEngine.create(MCB.MC) }; } catch (e) { MCP = null; }
assert("components-the-mc-engine-data-plan-and-precomputed-blocks-are-in-scope",
  !!(MCP && MCP.MC && Array.isArray(MCP.MC.players) && MCP.PLAN && MCP.PRE && MCP.E && typeof MCP.E.ep === "function" &&
    typeof MCP.PLAN.hash === "string" && MCP.PLAN.hash === MCP.PRE.hash),
  MCP ? "MC " + (MCP.MC && MCP.MC.players ? MCP.MC.players.length + " players" : "missing") + ", PLAN " + (MCP.PLAN && MCP.PLAN.hash) +
    ", PRE " + (MCP.PRE && MCP.PRE.hash) + ", E.ep " + typeof (MCP.E && MCP.E.ep) : "MCEngine.create(MC) could not run");
assert("components-the-app-tab-table-and-its-primary-sections-are-in-scope",
  APP_TABS.length > 0 && APP_TABS.every(function (t) { return t && typeof t.id === "string" && typeof APP_PRIMARY[t.id] === "string"; }),
  APP_TABS.map(function (t) { return (t && t.id) + "→" + (t && APP_PRIMARY[t.id]); }).join(", ") || "no TABS in the assembled file");

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
// E-125: the shipped snapshot carries the manager's own league once he supplies it in state/kwezi.json, so the
// no-league Draft path is built explicitly — the fetcher's own emptyDraftLeague() shape, the state's league and entry
// ids cleared — and rendered as a TabDraft variant, instead of being assumed of the snapshot.
let CTX_NO_LEAGUE = null, STATE_NO_LEAGUE = null;
try {
  const liveN = clone(LIVE);
  liveN.draft = Object.assign({}, liveN.draft, require(path.join(ROOT, "data", "draft_league.cjs")).emptyDraftLeague(), { league_id: null });
  STATE_NO_LEAGUE = clone(baseState);
  STATE_NO_LEAGUE.draft.league_id = null; STATE_NO_LEAGUE.draft.entry_id = null; STATE_NO_LEAGUE.draft.league_input = null;
  CTX_NO_LEAGUE = ctxOf(liveN, STATE_NO_LEAGUE);
} catch (e) { CTX_NO_LEAGUE = null; }
assert("components-a-no-league-context-builds-from-the-shipped-snapshot",
  !!(CTX_NO_LEAGUE && CTX_NO_LEAGUE.ok && CTX_NO_LEAGUE.draft && !CTX_NO_LEAGUE.draft.hasPool),
  CTX_NO_LEAGUE ? "hasPool " + (CTX_NO_LEAGUE.draft && CTX_NO_LEAGUE.draft.hasPool) : "could not build");
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

/* v110 §5 D2 · the fixtures the Classic plan panel (TabPlan, section plan-solved) is rendered from. allOpen() answers
   true for every reveal, and one of them is "wc-lock" — the planning setting that HIDES the solved plan — so the
   variant that has to show every part of the panel opens every section and every reveal except that one. The two
   other worlds are the ones the panel must refuse to show a plan in: a PLAN block with no solved plan in it, and a
   manager's own match price on the Odds tab (state.market), which the plan was not solved on. The override is a
   synthetic input on a team read from the engine's own list, never a typed team. */
function allOpenExcept(skip) {
  return new Proxy({}, { get: function (t, k) { return k === "toJSON" ? undefined : skip.indexOf(k) < 0; }, has: function () { return true; }, ownKeys: function () { return []; } });
}
const MCP_NOPLAN = MCP ? { MC: MCP.MC, PLAN: { hash: MCP.PLAN.hash }, PRE: MCP.PRE, E: MCP.E } : null;
const STATE_MKT = (function () {
  const s = clone(baseState);
  const team = MCP && MCP.E && Array.isArray(MCP.E.teamNames) ? MCP.E.teamNames[0] : null;
  const gw = MCP && MCP.MC && MCP.MC.gw ? String(MCP.MC.gw.next) : "";
  s.market = {};
  if (team && gw) { s.market[gw] = {}; s.market[gw][team] = { xg: 1.9 }; }
  return s;
})();
const CTX_MKT = ctxOf(LIVE, STATE_MKT);
const UI_PLAN_SOLVED = { mode: "full", tab: "plan", open: allOpen(), reveals: allOpenExcept(["wc-lock"]) };

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
    props: { plan: PLAN, ctx: CTX, mode: "simple", reveals: {}, onReveal: noop, onConfirm: noop, mc: MCP }, text: ["mode"],
    variants: [
      { plan: PLAN, ctx: CTX, mode: "full", reveals: allOpen(), onReveal: noop, onConfirm: noop, mc: MCP },
      { plan: PLAN_LOCKED, ctx: CTX, mode: "full", reveals: allOpen(), onReveal: noop, onConfirm: noop, mc: MCP },
      { plan: PLAN_CHIPUSED, ctx: CTX_CHIPUSED, mode: "full", reveals: allOpen(), onReveal: noop, onConfirm: noop, mc: MCP },
      { plan: PLAN_BLOCKED, ctx: DEGRADED[3].ctx, mode: "simple", reveals: {}, onReveal: noop, onConfirm: noop, mc: MCP },
      /* v110 D1: the solved card with every reveal open except the lock (which sets it aside), the app's own card when
         the PLAN block carries no plan, and the solved plan set aside by a match price typed on the Odds tab */
      { plan: PLAN, ctx: CTX, mode: "full", reveals: allOpenExcept(["wc-lock"]), onReveal: noop, onConfirm: noop, mc: MCP },
      { plan: PLAN, ctx: CTX, mode: "simple", reveals: {}, onReveal: noop, onConfirm: noop, mc: MCP_NOPLAN },
      { plan: PLAN, ctx: CTX_MKT, mode: "simple", reveals: {}, onReveal: noop, onConfirm: noop, mc: MCP }
    ]
  },
  Header: { props: { ctx: CTX, onRefresh: noop, onMenu: noop, menuOpen: false, busy: false }, text: [] },
  Tabs: { props: { tab: "command", onTab: noop }, text: ["tab"] },
  Menu: { props: { mode: "simple", onMode: noop, onJump: noop }, text: ["mode"] },
  /* v110 D1: TabCommand ticks the dated checklist through App's on.done(key); the variant carries one tick in
     ctx.state.done, the other a match price typed on the Odds tab (the solved plan set aside) */
  TabCommand: { props: { ctx: CTX, ui: uiFor("command", true), on: { sec: noop, rev: noop, done: noop }, mc: MCP }, text: [],
    variants: [
      { ctx: (function () { const c = Object.assign({}, CTX); const d = {}; if (MCP && MCP.MC && MCP.MC.gw) d[MCP.MC.gw.next + ":claims"] = true; c.state = Object.assign({}, CTX.state, { done: d }); return c; })(),
        ui: uiFor("command", true), on: { sec: noop, rev: noop, done: noop }, mc: MCP },
      { ctx: CTX_MKT, ui: uiFor("command", true), on: { sec: noop, rev: noop, done: noop }, mc: MCP }] },
  MoveList: { props: { ctx: CTX, tp: TP }, text: [] },
  TabPlan: {
    props: { ctx: CTX, ui: uiFor("plan", true), on: ON, plan: PLAN, onConfirm: noop, mc: MCP }, text: [],
    variants: [{ ctx: CTX, ui: uiFor("plan", true), on: ON, plan: PLAN_LOCKED, onConfirm: noop, mc: MCP },
      // v110 D2: the solved plan with every part open, then the two worlds that must hide it behind one note
      { ctx: CTX, ui: UI_PLAN_SOLVED, on: ON, plan: PLAN, onConfirm: noop, mc: MCP },
      { ctx: CTX, ui: uiFor("plan", false), on: ON, plan: PLAN, onConfirm: noop, mc: MCP_NOPLAN },
      { ctx: CTX_MKT, ui: uiFor("plan", false), on: ON, plan: PLAN, onConfirm: noop, mc: MCP }],
    fuzz: { ctx: CTX, ui: uiFor("plan", false), on: ON, plan: PLAN, onConfirm: noop, mc: MCP }
  },
  TabSquad: { props: { ctx: CTX, ui: uiFor("squad", true), on: ON, onConfirm: noop, mc: MCP }, text: [] },
  TabRivals: { props: { ctx: CTX, ui: uiFor("rivals", true), on: ON, plan: PLAN, simLeague: 0, onSimLeague: noop, onConfirm: noop, mc: MCP }, text: [] },
  TabDraft: {
    props: { ctx: CTX, ui: uiFor("draft", true), on: ON, state: baseState, onLeague: noop, mc: MCP }, text: [],
    variants: (CTX_LEAGUE ? [{ ctx: CTX_LEAGUE, ui: uiFor("draft", true), on: ON, state: STATE_LEAGUE, onLeague: noop, mc: MCP }] : [])
      .concat(CTX_NO_LEAGUE ? [{ ctx: CTX_NO_LEAGUE, ui: uiFor("draft", true), on: ON, state: STATE_NO_LEAGUE, onLeague: noop, mc: MCP }] : [])
      // v110 D3: a match price typed on the Odds tab, which hides every build-time Draft answer behind its own note
      .concat([{ ctx: CTX_MKT, ui: uiFor("draft", true), on: ON, state: STATE_MKT, onLeague: noop, mc: MCP }])
  },
  TabChips: { props: { ctx: CTX, ui: uiFor("chips", true), on: ON, plan: PLAN, onConfirm: noop, mc: MCP }, text: [],
    fuzz: { ctx: CTX, ui: uiFor("chips", false), on: ON, plan: PLAN, onConfirm: noop, mc: MCP } },
  /* v110 D0: the two tabs the port adds (D4 Odds, D5 Review), scaffolded by the integration in src/mc_ui.jsx and
     filled by the Build phase. Same props as every tab — ctx, ui, on — plus mc, the ported engine and its blocks.
     Junk in any slot is refused with a TypeError (the contract pass C holds every component to). */
  /* v110 D4, D5 (27 Sep): TabOdds writes prices, so its `on` carries market(gw, team, xg), App's handler; its variant
     has a price of the manager's active in ctx.state.market, which draws the od-active note. The entry form, the
     calculator and the list of his prices are module-level components of their own (OddsCalc and OddsOverrides take no
     hooks, so qa/mc_render.cjs drives their buttons), fed from the baked block's next gameweek. TabReview also renders
     with PRE absent: the path that computes the post-mortem inside the tab. */
  TabOdds: {
    props: { ctx: CTX, ui: uiFor("odds", true), on: { sec: noop, rev: noop, market: noop }, mc: MCP }, text: [],
    variants: [{ ctx: (function () {
      const f = MCP && MCP.MC ? MCP.MC.fixtures.filter(function (x) { return x.gw === MCP.MC.gw.next; })[0] : null;
      const m = {}; if (f) { m[String(f.gw)] = {}; m[String(f.gw)][f.h] = { xg: 1.5 }; m[String(f.gw)][f.a] = { xg: 1.1 }; }
      const c = Object.assign({}, CTX); c.state = Object.assign({}, CTX.state, { market: m }); return c;
    })(), ui: uiFor("odds", true), on: { sec: noop, rev: noop, market: noop }, mc: MCP }]
  },
  OddsForm: {
    props: { fixtures: MCP && MCP.MC ? MCP.MC.fixtures.filter(function (x) { return x.gw === MCP.MC.gw.next; }) : [], E: MCP && MCP.E, market: {},
      on: { sec: noop, rev: noop, market: noop } }, text: []
  },
  OddsCalc: {
    props: { fixture: MCP && MCP.MC ? MCP.MC.fixtures.filter(function (x) { return x.gw === MCP.MC.gw.next; })[0] : null, prices: { h: "1.45", d: "4.60", a: "7.00" },
      E: MCP && MCP.E, market: {}, on: { sec: noop, rev: noop, market: noop }, onDone: noop }, text: [],
    variants: [
      { fixture: MCP && MCP.MC ? MCP.MC.fixtures.filter(function (x) { return x.gw === MCP.MC.gw.next; })[0] : null, prices: { h: "", d: "", a: "" },
        E: MCP && MCP.E, market: {}, on: { sec: noop, rev: noop, market: noop } },
      { fixture: MCP && MCP.MC ? MCP.MC.fixtures.filter(function (x) { return x.gw === MCP.MC.gw.next; })[0] : null, prices: { h: "5", d: "5", a: "5" },
        E: MCP && MCP.E, market: {}, on: { sec: noop, rev: noop, market: noop } }
    ]
  },
  OddsOverrides: {
    props: { market: (function () {
      const f = MCP && MCP.MC ? MCP.MC.fixtures.filter(function (x) { return x.gw === MCP.MC.gw.next; })[0] : null;
      const m = {}; if (f) { m[String(f.gw)] = {}; m[String(f.gw)][f.h] = { xg: 1.5 }; m[String(f.gw)][f.a] = { xg: 1.1 }; } return m;
    })(), fixtures: MCP && MCP.MC ? MCP.MC.fixtures : [], E: MCP && MCP.E, on: { sec: noop, rev: noop, market: noop } }, text: [],
    variants: [{ market: {}, fixtures: MCP && MCP.MC ? MCP.MC.fixtures : [], E: MCP && MCP.E, on: { sec: noop, rev: noop, market: noop } }]
  },
  TabReview: {
    props: { ctx: CTX, ui: uiFor("review", true), on: ON, mc: MCP }, text: [],
    variants: [{ ctx: CTX, ui: uiFor("review", true), on: ON, mc: MCP ? { MC: MCP.MC, PLAN: MCP.PLAN, PRE: null, E: MCP.E } : MCP }]
  },
  TabLab: {
    props: { ctx: CTX, ui: uiFor("lab", true), on: ON, state: baseState, onDownload: noop, onCopy: noop, onImport: noop, importErr: null,
      refresh: { busy: false, err: null, okMsg: "", onRefresh: noop, onPair: noop }, mc: MCP },
    text: ["importErr"],
    variants: [{ ctx: CTX, ui: uiFor("lab", true), on: ON, state: baseState, onDownload: noop, onCopy: noop, onImport: noop, importErr: "that file had no squad in it",
      refresh: { busy: true, err: "400 invalid_request_error", okMsg: "", onRefresh: noop, onPair: noop }, mc: MCP }]
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

/* v110 D0 · every entry of the app's own TABS table is drawn by a module-level component named for it, that
   component owns the tab's PRIMARY section, and on first paint (ui.open empty) that section is the only one open.
   Read from the assembled file's TABS and PRIMARY, so a tab added to the strip without a panel — or a panel whose
   primary id drifts from the table — is red here, before any browser runs. */
(function () {
  const cap = function (id) { return "Tab" + id.charAt(0).toUpperCase() + id.slice(1); };
  const orphan = APP_TABS.filter(function (t) {
    const name = cap(t.id);
    return !FNS[name] || (OWNED[name] || []).indexOf("sec-" + APP_PRIMARY[t.id]) < 0;
  });
  assert("A-every-TABS-entry-has-a-Tab-component-that-owns-its-PRIMARY-section", APP_TABS.length > 0 && orphan.length === 0,
    APP_TABS.length + " tabs; without a component owning sec-<PRIMARY>: " + (orphan.map(function (t) { return t.id + " → " + cap(t.id) + " / sec-" + APP_PRIMARY[t.id]; }).join(", ") || "none"));
  const firstPaint = {};
  APP_TABS.forEach(function (t) {
    const name = cap(t.id);
    if (!FIX[name] || !FNS[name]) { firstPaint[t.id] = "no fixture"; return; }
    const p = {};
    Object.keys(FIX[name].props).forEach(function (k) { p[k] = FIX[name].props[k]; });
    p.ui = { mode: "full", tab: t.id, open: {}, reveals: {} };
    const r = tryRender(name, p);
    if (!r.ok) { firstPaint[t.id] = "threw " + (r.err && r.err.message); return; }
    const open = []; let m4; const RE = /data-testid="sec-([^"]+)" aria-expanded="true"/g;
    while ((m4 = RE.exec(r.html))) open.push(m4[1]);
    firstPaint[t.id] = open.length === 1 && open[0] === APP_PRIMARY[t.id] ? "ok" : "open [" + open.join("|") + "] expected " + APP_PRIMARY[t.id];
  });
  const badPaint = Object.keys(firstPaint).filter(function (k) { return firstPaint[k] !== "ok"; });
  assert("A-every-tab-first-paint-opens-exactly-its-PRIMARY-section", APP_TABS.length > 0 && badPaint.length === 0,
    badPaint.length ? badPaint.map(function (k) { return k + ": " + firstPaint[k]; }).join("; ") : APP_TABS.length + " tabs, each with exactly its PRIMARY open");
})();

/* ---------------------------------------------------------------- 6b. v110 §5 D2 — the Classic plan panel

   TabPlan's section plan-solved ports the kit's planHtml and priceWatchHtml (the kit's ui.js 154–182) and is the plan
   tab's PRIMARY. Every expectation below is derived at run time from the PLAN block, its replay, the baked data and
   the ported engine, so a re-solve or a re-bake moves the expectation with the panel (qa/no_frozen.cjs, E-084). The
   renders use first paint (ui.open empty), which opens plan-solved alone, so they stay cheap. Two of the timing
   verdict's branches are not reached by today's numbers, so they are reached by moving the numbers themselves, and
   the replay rule (§6: free transfers, hits and bank from PLAN.replay, never the solver's own week fields) is proved
   by corrupting the solver's fields and reading the screen. */
console.log("");
console.log("--- v110 D2 · the Classic plan panel ---");
(function () {
  const SP = MCP ? MCP.PLAN : null, EN = MCP ? MCP.E : null, MB = MCP ? MCP.MC : null;
  const pl = SP && SP.plan && SP.plan.ok === true && Array.isArray(SP.plan.weeks) && SP.plan.weeks.length ? SP.plan : null;
  const rw = SP && SP.replay && Array.isArray(SP.replay.weeks) ? SP.replay.weeks : [];
  if (!assert("D2-the-PLAN-block-carries-a-solved-plan-and-a-replay-of-every-planned-week",
    !!(pl && EN && MB && rw.length === pl.weeks.length && pl.weeks.every(function (x) { return rw.some(function (r) { return r && r.gw === x.gw; }); })),
    pl ? pl.weeks.length + " planned weeks, " + rw.length + " replayed" : "no solved plan in the PLAN block")) return;
  const w = pl.weeks[0];
  const rOf = function (g) { return rw.filter(function (r) { return r && r.gw === g; })[0] || null; };
  const r0 = rOf(w.gw);
  const nm = function (id) { return EN.P[id] ? EN.P[id].n : "?"; };
  const f0 = function (x) { return String(Math.round(x)); };
  const f1 = function (x) { return (Math.round(x * 10) / 10).toFixed(1); };
  const sgn = function (x) { return (x >= 0 ? "+" : "−") + f1(Math.abs(x)); };
  const cash = function (x) { return "£" + Number(x).toFixed(1) + "m"; };
  const plain = function (html) {
    return String(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;|&#39;/g, "'")
      .replace(/\s+/g, " ").trim();
  };
  // One part of the panel: the markup from its data-testid to the next of the panel's own markers.
  const MARKS = ["plan-solved", "plan-solved-note", "plan-strip", "plan-timing", "plan-xi", "plan-changes", "plan-price", "rev-pl-week", "plan-week-table", "sec-plan-tx"];
  const OPEN_CHANGES = { mode: "full", tab: "plan", open: {}, reveals: { "pl-changes": true } };
  // Cut at tag boundaries: from the "<" of the element carrying the testid to the "<" of the next marked element.
  const raw = function (html, id) {
    const hit = html.indexOf('data-testid="' + id + '"'); if (hit < 0) return "";
    const at = html.lastIndexOf("<", hit);
    let end = html.length;
    MARKS.forEach(function (o) {
      if (o === id) return;
      const k = html.indexOf('data-testid="' + o + '"', hit + 1);
      if (k > hit) { const s = html.lastIndexOf("<", k); if (s > hit && s < end) end = s; }
    });
    return html.slice(at, end);
  };
  const part = function (html, id) { return plain(raw(html, id)); };
  const has = function (html, id) { return html.indexOf('data-testid="' + id + '"') >= 0; };
  const props = function (over) {
    const p = {};
    Object.keys(FIX.TabPlan.props).forEach(function (k) { p[k] = FIX.TabPlan.props[k]; });
    p.ui = { mode: "full", tab: "plan", open: {}, reveals: {} };
    Object.keys(over || {}).forEach(function (k) { p[k] = over[k]; });
    return p;
  };
  const mcWith = function (plan) { return { MC: MB, PLAN: plan, PRE: MCP.PRE, E: EN }; };
  const T = SP.timing || null;
  const okc = function (r) { return !!(r && r.ok === true && isFinite(r.total)); };
  const wc = w.chip === "wildcard";
  const lastGw = pl.weeks[pl.weeks.length - 1].gw;

  const r1 = tryRender("TabPlan", props({}));
  if (!assert("D2-the-plan-tab-first-paint-renders", r1.ok, r1.err && r1.err.message)) return;
  const h1 = r1.html;
  const timingDue = wc && !!T && okc(T.now) && okc(T.later) && okc(T.never);
  const sAt = h1.indexOf('data-testid="sec-plan-solved"'), txAt = h1.indexOf('data-testid="sec-plan-tx"');
  const need1 = ["plan-solved", "plan-strip", "plan-xi"].concat(timingDue ? ["plan-timing"] : []).concat(w.in.length ? ["plan-changes", "rev-pl-changes"] : []);
  assert("D2-first-paint-opens-the-solved-plan-first-and-leaves-transfers-closed-with-the-week-table-behind-a-reveal",
    /data-testid="sec-plan-solved" aria-expanded="true"/.test(h1) && /data-testid="sec-plan-tx" aria-expanded="false"/.test(h1) &&
      sAt >= 0 && txAt > sAt && need1.every(function (id) { return has(h1, id); }) && !has(h1, "plan-week-table") && has(h1, "rev-pl-week"),
    "sec-plan-solved at " + sAt + ", sec-plan-tx at " + txAt + "; " + MARKS.map(function (id) { return id + (has(h1, id) ? " yes" : " no"); }).join(", "));

  // (1) the stat strip, every figure from PLAN, and the game named
  {
    const strip = part(h1, "plan-strip");
    const want = ["Expected points " + f0(pl.total) + " to GW" + lastGw];
    if (wc && T && okc(T.later)) want.push("Wildcard later " + f0(T.later.total) + " " + sgn(pl.total - T.later.total) + " for playing it now");
    else {
      const nw = (T && okc(T.never) ? T.never : null) || (okc(SP.noWildcard) ? SP.noWildcard : null);
      want.push("Without the wildcard " + (nw ? f0(nw.total) + " the plan is " + sgn(pl.total - nw.total) : "—"));
    }
    want.push("GW" + w.gw + " " + (wc ? "Wildcard" : w.in.length ? w.in.length + " in" : "Roll") + " captain " + nm(w.cap));
    const fh = (SP.freeHit || []).filter(function (f) { return f && f.free === true && isFinite(f.gain); }).sort(function (a, b) { return b.gain - a.gain; })[0];
    want.push("Free Hit " + (fh ? "GW" + fh.gw + " " + sgn(fh.gain) + " that week" : "—"));
    const miss = want.filter(function (s) { return strip.indexOf(s) < 0; });
    const lead = part(h1, "plan-solved");
    assert("D2-the-stat-strip-reads-the-plan-total-the-wildcard-case-the-next-action-and-the-free-hit-week-from-PLAN",
      miss.length === 0 && /^Classic\b/.test(lead),
      (miss.length ? "missing «" + miss.join("» «") + "» · " : "") + "strip «" + strip + "» · lead «" + lead.slice(0, 90) + "»");
  }

  // (2) the timing verdict: proved worse only on the objective proof, settled only beyond the tolerance
  let tol = 0;
  if (timingDue) {
    const tim = part(h1, "plan-timing");
    const gap = function (r) { return isFinite(r.gap) ? r.gap : 0; };
    tol = Math.round(Math.max(gap(T.now), gap(T.later), gap(T.never)) * pl.total);
    const bound = function (r) { return isFinite(r.obj) ? r.obj * (1 + gap(r)) : 0; };
    const provedNever = T.now.obj > bound(T.never);
    const edge = T.now.total - T.later.total, clear = edge > tol;
    const cEnd = EN.CFG.classicEnd;
    const lw = (T.later.weeks || []).filter(function (x) { return x && x.chip === "wildcard"; })[0];
    const bad = [];
    if (tim.indexOf("Play it in GW" + w.gw + ": " + f0(T.now.total)) < 0) bad.push("the now case");
    if (!lw || tim.indexOf("best week GW" + lw.gw + ": " + f0(T.later.total)) < 0) bad.push("the later case");
    if (tim.indexOf("Keep it unplayed to GW" + cEnd + ": " + f0(T.never.total)) < 0) bad.push("the never case");
    if (/proved worse/.test(tim) !== provedNever) bad.push("'proved worse' shown " + /proved worse/.test(tim) + " with the proof " + provedNever);
    if (/the week is settled/.test(tim) !== clear) bad.push("'settled' shown " + /the week is settled/.test(tim) + " with an edge of " + f1(edge) + " against " + tol);
    if (/treat the two weeks as level/.test(tim) === clear) bad.push("'level' wording");
    if (tim.indexOf("about " + tol + " points") < 0) bad.push("the tolerance, about " + tol + " points");
    if (!clear) {
      const ev = MB.gw.events.filter(function (e) { return e.id === w.gw; })[0] || {};
      const days = Math.max(0, Math.round((Date.parse(ev.dl) - Date.parse(NOW)) / 864e5));
      const dayText = days > 6 ? "with " + days + " days to the deadline" : "building at the deadline";
      if (tim.indexOf(dayText) < 0) bad.push("the deadline tie-breaker «" + dayText + "»");
      if (r0.ftAfter === r0.ftBefore && r0.ftBefore > 0 && tim.indexOf("your " + r0.ftBefore + " free transfer") < 0) bad.push("the " + r0.ftBefore + " replayed free transfers surviving the chip");
      const tcw = pl.weeks.filter(function (x) { return x.chip === "3xc"; })[0];
      if (tcw && (tim.indexOf(nm(tcw.cap)) < 0 || tim.indexOf("in GW" + tcw.gw) < 0)) bad.push("the Triple Captain week, " + nm(tcw.cap) + " in GW" + tcw.gw);
      if (w.in.length >= 6 && tim.indexOf(w.in.length + " of your fifteen") < 0) bad.push(w.in.length + " of the fifteen changing");
    }
    assert("D2-the-timing-verdict-says-proved-worse-only-on-the-objective-proof-and-settled-only-beyond-the-tolerance", bad.length === 0,
      (bad.length ? "wrong: " + bad.join("; ") + " · " : "") + "tolerance " + tol + ", edge " + f1(edge) + ", never proved " + provedNever + ": «" + tim.slice(0, 260) + "»");

    // the branches today's numbers do not reach, reached by moving the numbers
    const mut = function (fn) {
      const P2 = JSON.parse(JSON.stringify(SP)); fn(P2);
      const r = tryRender("TabPlan", props({ mc: mcWith(P2) }));
      return r.ok ? part(r.html, "plan-timing") : "threw " + (r.err && r.err.message);
    };
    const settled = mut(function (P2) {
      ["now", "later", "never"].forEach(function (k) { P2.timing[k].gap = 0.001; });
      P2.timing.later.total = P2.timing.now.total - 25;
    });
    const unproved = mut(function (P2) { P2.timing.never.obj = P2.timing.now.obj; P2.timing.never.gap = 0.05; });
    assert("D2-mutation-an-edge-beyond-the-tolerance-settles-the-week-and-a-never-case-inside-its-bound-is-not-proved",
      /the week is settled/.test(settled) && !/treat the two weeks as level/.test(settled) && !/What tips it/.test(settled) &&
        /still inside the proof tolerance/.test(unproved) && !/proved worse/.test(unproved),
      "edge 25 on gaps of 0.1%: «" + settled.slice(0, 200) + "» · never at the kept objective with a 5% gap: «" + unproved.slice(0, 200) + "»");
  }

  // (3) the next-gameweek eleven: the engine's expected points per player, C and V, the bench in order, the reserve keeper
  {
    const xi = part(h1, "plan-xi");
    const bad = [];
    w.xi.forEach(function (id) {
      const s = nm(id) + " " + f1(EN.ep(EN.P[id], w.gw)) + (id === w.cap ? " C" : id === w.vice ? " V" : "");
      if (xi.indexOf(s) < 0) bad.push(s);
    });
    const benchIds = w.bench.concat(w.gk2 ? [w.gk2] : []);
    benchIds.forEach(function (id) { const s = nm(id) + " " + f1(EN.ep(EN.P[id], w.gw)); if (xi.indexOf(s) < 0) bad.push("bench " + s); });
    const at = benchIds.map(function (id) { return xi.indexOf(nm(id) + " " + f1(EN.ep(EN.P[id], w.gw))); });
    const ordered = at.every(function (v, i) { return v >= 0 && (i === 0 || v > at[i - 1]); });
    assert("D2-the-eleven-prints-the-engine's-expected-points-marks-captain-and-vice-and-keeps-the-bench-order",
      bad.length === 0 && ordered && /Classic/.test(xi) && xi.indexOf("GW" + w.gw) >= 0,
      (bad.length ? "missing «" + bad.join("» «") + "» · " : "") + "bench in order " + ordered + ": «" + xi.slice(0, 240) + "»");
  }

  // (4) the change list: every sale paired with a buy (the pairs sit behind the pl-changes reveal, the bank, the
  //     budget-line warning and the kept free transfers stay on first paint), all read from the replay
  if (w.in.length) {
    const rCh = tryRender("TabPlan", props({ ui: OPEN_CHANGES }));
    const rc = rCh.ok ? raw(rCh.html, "plan-changes") : "", ch = plain(rc), first = part(h1, "plan-changes");
    const bad = [];
    if (!rCh.ok) bad.push("the render with the changes open threw " + (rCh.err && rCh.err.message));
    if (first.indexOf(cash(r0.bank)) < 0) bad.push("the replayed bank is not on first paint");
    if (/budget line/.test(first) !== (r0.bank < 0.35)) bad.push("the budget-line warning is not on first paint");
    if ((raw(h1, "plan-changes").match(/class="row"/g) || []).length !== 0) bad.push("the pair rows are on first paint instead of behind the reveal");
    w.out.concat(w.in).forEach(function (id) { if (ch.indexOf(nm(id)) < 0) bad.push(nm(id)); });
    const rows = (rc.match(/class="row"/g) || []).length;
    if (rows !== w.out.length) bad.push(rows + " pair rows for " + w.out.length + " sales");
    if (ch.indexOf(cash(r0.bank)) < 0) bad.push("the replayed bank " + cash(r0.bank));
    if (/budget line/.test(ch) !== (r0.bank < 0.35)) bad.push("the budget-line warning against a replayed bank of " + cash(r0.bank));
    if (wc && r0.ftAfter === r0.ftBefore && ch.indexOf("Your " + r0.ftBefore + " free transfer") < 0) bad.push("the " + r0.ftBefore + " kept free transfers");
    if (wc && ch.indexOf("GW" + (w.gw + 1)) < 0) bad.push("the week they are kept for, GW" + (w.gw + 1));
    assert("D2-the-change-list-pairs-every-sale-with-a-buy-and-reads-the-bank-and-free-transfers-from-the-replay", bad.length === 0,
      (bad.length ? "wrong: " + bad.join("; ") + " · " : "") + rows + " pairs: «" + ch.slice(0, 220) + "»");
  }

  // §6 proved on the screen: the solver's own ft, hits and bank corrupted, the panel still shows the replay's
  {
    const P3 = JSON.parse(JSON.stringify(SP));
    P3.plan.weeks.forEach(function (x) { x.bank = Math.round((Number(x.bank) + 7.3) * 10) / 10; x.ftBefore = 0; x.hits = 3; x.used = 9; });
    const r = tryRender("TabPlan", props({ mc: mcWith(P3), ui: { mode: "full", tab: "plan", open: {}, reveals: { "pl-week": true } } }));
    const all = r.ok ? plain(r.html) : "", wt = r.ok ? part(r.html, "plan-week-table") : "";
    const bad = [];
    if (!r.ok) bad.push("threw " + (r.err && r.err.message));
    P3.plan.weeks.forEach(function (x) { if (all.indexOf(cash(x.bank)) >= 0) bad.push("the solver's GW" + x.gw + " bank " + cash(x.bank) + " is on screen"); });
    const hitMarks = (wt.match(/\(−\d+\)/g) || []).length, hitWeeks = rw.filter(function (x) { return x.hits > 0; }).length;
    if (hitMarks !== hitWeeks) bad.push(hitMarks + " hit marks in the week table for " + hitWeeks + " replayed weeks with a hit");
    rw.forEach(function (x) { if (wt.indexOf(x.ftBefore + " free, bank " + cash(x.bank)) < 0) bad.push("GW" + x.gw + " replay «" + x.ftBefore + " free, bank " + cash(x.bank) + "» missing"); });
    assert("D2-free-transfers-hits-and-bank-come-from-the-replay-even-when-the-solver-fields-are-corrupted", bad.length === 0,
      bad.length ? bad.slice(0, 5).join("; ") : rw.length + " replayed weeks shown, no corrupted solver bank or hit on screen");
  }

  // (5) the price watch, from the engine's own priceStress on the replayed bank
  {
    const st = EN.priceStress(w.squad, w.in, w.out, r0.bank, MB.gw.next, EN.CFG.classicEnd, MB.classic.sell);
    const pw = part(h1, "plan-price");
    const bad = [];
    const due = st.risers.length > 0 || st.fallers.length > 0 || st.need > 0;
    if (due !== (pw.length > 0)) bad.push("price watch shown " + (pw.length > 0) + " with " + st.risers.length + " risers, " + st.fallers.length + " fallers, need " + st.need);
    st.risers.forEach(function (i) { const s = nm(i) + " " + Math.round(EN.P[i].press * 100) + "%"; if (pw.indexOf(s) < 0) bad.push("riser «" + s + "»"); });
    st.fallers.forEach(function (i) { if (pw.indexOf(nm(i)) < 0) bad.push("faller " + nm(i)); });
    if (st.need > 0 && pw.indexOf(cash(st.need) + " short") < 0) bad.push("the shortfall " + cash(st.need));
    if (st.need > 0 && st.fix && pw.indexOf(nm(st.fix.out) + " to " + nm(st.fix.inn)) < 0) bad.push("the fix " + nm(st.fix.out) + " to " + nm(st.fix.inn));
    assert("D2-the-price-watch-names-the-engine's-risers-fallers-shortfall-and-fix", bad.length === 0 && (!due || /Classic/.test(pw)),
      (bad.length ? bad.join("; ") + " · " : "") + "«" + pw.slice(0, 240) + "»");
  }

  // (6) the week table, behind a reveal: one row per planned week with its captain and expected points
  {
    const r = tryRender("TabPlan", props({ ui: { mode: "full", tab: "plan", open: {}, reveals: { "pl-week": true } } }));
    const rt = r.ok ? raw(r.html, "plan-week-table") : "", wt = plain(rt);
    const rows = (rt.match(/class="row"/g) || []).length;
    const bad = [];
    pl.weeks.forEach(function (x) { if (wt.indexOf(nm(x.cap)) < 0 || wt.indexOf(f1(x.epNet)) < 0) bad.push("GW" + x.gw + " " + nm(x.cap) + " " + f1(x.epNet)); });
    assert("D2-the-week-table-has-one-row-per-planned-week-with-its-captain-and-expected-points", r.ok && rows === pl.weeks.length && bad.length === 0,
      rows + " rows for " + pl.weeks.length + " planned weeks" + (bad.length ? "; missing " + bad.join(", ") : ""));
  }

  // hidden behind one note: the wildcard lock, an Odds override, no solved plan, a first deadline already passed
  {
    const rLock = tryRender("TabPlan", props({ ui: { mode: "full", tab: "plan", open: {}, reveals: { "wc-lock": true } } }));
    const rMkt = tryRender("TabPlan", props({ ctx: CTX_MKT }));
    const rNo = tryRender("TabPlan", props({ mc: MCP_NOPLAN }));
    const ev = MB.gw.events.filter(function (e) { return e.id === w.gw; })[0] || {};
    const late = new Date(Date.parse(ev.dl) + 3600000).toISOString();
    const rLate = tryRender("TabPlan", props({ ctx: F("buildCtx")(LIVE, baseState, late) }));
    const mk = CTX_MKT && CTX_MKT.state && CTX_MKT.state.market ? Object.keys(CTX_MKT.state.market).length : 0;
    const note = function (r) { return r.ok ? part(r.html, "plan-solved-note") : "threw " + (r.err && r.err.message); };
    const hidden = function (r) { return r.ok && has(r.html, "plan-solved-note") && !has(r.html, "plan-strip") && !has(r.html, "plan-xi"); };
    const quick = /quick searches below still work/;
    assert("D2-a-planning-setting-the-plan-was-not-solved-on-hides-it-behind-one-note-that-names-the-setting",
      hidden(rLock) && /premiums/.test(note(rLock)) && quick.test(note(rLock)) &&
        mk > 0 && hidden(rMkt) && /Odds tab/.test(note(rMkt)) && quick.test(note(rMkt)),
      "lock «" + note(rLock) + "» · " + mk + " market gameweek(s) in ctx.state «" + note(rMkt) + "»");
    assert("D2-no-solved-plan-or-a-passed-first-deadline-says-so-instead-of-showing-a-plan",
      hidden(rNo) && /not solved for this data/.test(note(rNo)) && hidden(rLate) && /deadline has passed/.test(note(rLate)),
      "no plan «" + note(rNo) + "» · at " + late + " «" + note(rLate) + "»");
  }

  // Part G, measured here on the component alone (the browser gate in smoke.cjs adds the header and the tab strip)
  {
    const words = wordsOf(h1);
    assert("D2-the-plan-tab-first-paint-stays-under-the-500-word-gate-on-the-component-alone", words > 0 && words < 500, words + " visible words");
  }
})();

/* ---------------------------------------------------------------- 6c. v110 §5 D3 — the Draft tab

   TabDraft ports the kit's vDraft, claimSheetHtml, draftPlanHtml, contestHtml and tradesHtml (the kit's ui.js 199–279).
   df-claims ("Claims to lodge, in this order") is the draft tab's PRIMARY; df-waivers stays, closed, as "Quick check:
   the app's own claim search". Every expectation below is derived at run time from PRE.claims, PRE.trades, PLAN.draft,
   PLAN.draftIfTaken, the baked block MC and the ported engine E, so a rebuild moves the expectation with the panel
   (qa/no_frozen.cjs, E-084). The branches today's data does not reach — waivers settled, a player locked, a trade
   across positions, a re-draft moved — are reached by moving the data itself. */
console.log("");
console.log("--- v110 D3 · the Draft tab ---");
(function () {
  const EN = MCP ? MCP.E : null, MB = MCP ? MCP.MC : null, PR = MCP ? MCP.PRE : null, SP = MCP ? MCP.PLAN : null;
  const C = PR && PR.claims && Array.isArray(PR.claims.sheet) && PR.claims.sheet.length ? PR.claims : null;
  if (!assert("D3-the-precomputed-block-carries-a-claims-sheet-and-trades-and-the-plan-a-solved-Draft-roster",
    !!(EN && MB && C && PR.trades && Array.isArray(PR.trades.ask) && Array.isArray(PR.trades.both) && SP && SP.draft && SP.draft.ok === true),
    C ? C.sheet.length + " claims, " + (PR.trades ? PR.trades.both.length + " both-gain and " + PR.trades.ask.length + " ask trades" : "no trades") +
      ", PLAN.draft " + (SP && SP.draft ? SP.draft.ok : "missing") : "no claims sheet in PRE")) return;
  const nm = function (id) { return EN.P[id] ? EN.P[id].n : "?"; };
  const pos = function (id) { return EN.P[id] ? EN.POS[EN.P[id].p] : "?"; };
  const f0 = function (x) { return String(Math.round(x)); };
  const f1 = function (x) { return (Math.round(x * 10) / 10).toFixed(1); };
  const sgn = function (x) { return (x >= 0 ? "+" : "−") + f1(Math.abs(x)); };
  const pct = function (x) { return Math.round(x * 100) + "%"; };
  const ordn = function (n) { const m = n % 100; return n + (m >= 11 && m <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"); };
  // SAST, computed here rather than borrowed from the app, so the two can disagree
  const sastDay = function (iso) {
    const t = Date.parse(iso); if (!isFinite(t)) return "";
    const d = new Date(t + 2 * 3600000);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()] + " " + d.getUTCDate() + " " +
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()] + " " +
      String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  };
  const plain = function (html) {
    return String(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;|&#39;/g, "'")
      .replace(/\s+/g, " ").trim();
  };
  const MARKS = ["sec-df-claims", "df-claims", "df-horizon", "df-phase", "df-claims-note", "df-sheet", "df-strip", "df-stress", "rev-df-orderings", "df-orderings-list",
    "rev-df-rivals", "df-rivals-list", "sec-df-solved", "df-solved", "df-solved-note", "sec-df-waivers", "sec-df-pool", "df-pool-horizon", "rev-df-pool-app", "df-pool-app",
    "sec-df-trades", "df-trades", "df-trades-note", "sec-df-h2h"];
  const raw = function (html, id) {
    const hit = html.indexOf('data-testid="' + id + '"'); if (hit < 0) return "";
    const at = html.lastIndexOf("<", hit);
    let end = html.length;
    MARKS.forEach(function (o) {
      if (o === id) return;
      const k = html.indexOf('data-testid="' + o + '"', hit + 1);
      if (k > hit) { const s = html.lastIndexOf("<", k); if (s > hit && s < end) end = s; }
    });
    return html.slice(at, end);
  };
  const part = function (html, id) { return plain(raw(html, id)); };
  const has = function (html, id) { return html.indexOf('data-testid="' + id + '"') >= 0; };
  const inOrder = function (text, pieces) { let at = -1; return pieces.every(function (s) { const k = text.indexOf(s, at + 1); if (k < 0) return false; at = k; return true; }); };
  const props = function (over) {
    const p = {};
    Object.keys(FIX.TabDraft.props).forEach(function (k) { p[k] = FIX.TabDraft.props[k]; });
    p.ui = { mode: "full", tab: "draft", open: {}, reveals: {} };
    Object.keys(over || {}).forEach(function (k) { p[k] = over[k]; });
    return p;
  };
  const uiOpen = function (open, reveals) { return { mode: "full", tab: "draft", open: open || {}, reveals: reveals || {} }; };
  // a moved copy of the baked block, with its own engine, for the branches today's data does not reach
  const moved = function (fn) { const M2 = JSON.parse(JSON.stringify(MB)); fn(M2); return { MC: M2, PLAN: SP, PRE: PR, E: MCB.MCEngine.create(M2) }; };
  const next = MB.gw.next, rd = MB.draft.league.redraft, hz = rd.fromGw - 1;

  // first paint: the claims sheet alone, the app's own search kept, closed and retitled
  const r1 = tryRender("TabDraft", props({}));
  if (!assert("D3-the-draft-tab-first-paint-renders", r1.ok, r1.err && r1.err.message)) return;
  const h1 = r1.html;
  {
    const need = ["df-claims", "df-horizon", "df-phase", "df-sheet", "df-strip", "df-stress", "rev-df-orderings", "rev-df-rivals"];
    const cAt = h1.indexOf('data-testid="sec-df-claims"'), wAt = h1.indexOf('data-testid="sec-df-waivers"');
    const title = wAt >= 0 ? plain(h1.slice(h1.lastIndexOf("<", wAt), h1.indexOf("</button>", wAt))) : "";
    assert("D3-first-paint-opens-the-claims-sheet-alone-and-keeps-the-app's-own-search-closed-as-a-quick-check",
      APP_PRIMARY.draft === "df-claims" && /data-testid="sec-df-claims" aria-expanded="true"/.test(h1) && /data-testid="sec-df-waivers" aria-expanded="false"/.test(h1) &&
        /data-testid="sec-df-solved" aria-expanded="false"/.test(h1) && /data-testid="sec-df-trades" aria-expanded="false"/.test(h1) &&
        cAt >= 0 && wAt > cAt && title === "Quick check: the app's own claim search" && need.every(function (id) { return has(h1, id); }) &&
        /data-testid="rev-df-orderings" aria-expanded="false"/.test(h1) && /data-testid="rev-df-rivals" aria-expanded="false"/.test(h1) && !has(h1, "df-orderings-list"),
      "PRIMARY.draft " + APP_PRIMARY.draft + "; df-waivers title «" + title + "»; " + need.map(function (id) { return id + (has(h1, id) ? " yes" : " no"); }).join(", "));
  }

  // the Draft horizon, read from the league's own draft settings
  {
    const line = part(h1, "df-horizon");
    const want = "Draft horizon GW" + hz + ": the league re-drafts " + sastDay(rd.at) + " SAST, effective GW" + rd.fromGw;
    const mv = moved(function (M2) { M2.draft.league.redraft.fromGw = rd.fromGw + 4; M2.draft.league.redraft.at = new Date(Date.parse(rd.at) + 28 * 864e5).toISOString(); });
    const r2 = tryRender("TabDraft", props({ mc: mv }));
    const line2 = r2.ok ? part(r2.html, "df-horizon") : "threw " + (r2.err && r2.err.message);
    const want2 = "Draft horizon GW" + (hz + 4) + ": the league re-drafts " + sastDay(mv.MC.draft.league.redraft.at) + " SAST, effective GW" + (rd.fromGw + 4);
    assert("D3-the-horizon-line-reads-the-re-draft-from-the-league-settings-and-follows-it-when-it-moves",
      line.indexOf(want) >= 0 && /Draft/.test(line) && line2.indexOf(want2) >= 0,
      "«" + line + "» · moved four gameweeks and 28 days: «" + line2 + "»");
  }

  // the waiver phase: the full order, my place, the settle time and what happens either side of it
  const order = EN.waiverOrder(), me = MB.draft.me, ev = MB.draft.events[String(next)];
  {
    const ph = part(h1, "df-phase");
    const bad = [];
    if (!inOrder(ph, order.map(function (t, i) { return (i + 1) + ". " + t; }))) bad.push("the full order, in order");
    if (ph.indexOf("You are " + ordn(order.indexOf(me) + 1) + " of " + order.length) < 0) bad.push("your place, " + ordn(order.indexOf(me) + 1) + " of " + order.length);
    if (ph.indexOf("settle " + sastDay(ev.wv) + " SAST") < 0) bad.push("the settle time " + sastDay(ev.wv) + " SAST");
    if (!/every move is a claim/.test(ph)) bad.push("before it every move is a claim");
    if (ph.indexOf("signed instantly until the GW" + next + " deadline, " + sastDay(ev.dl) + " SAST") < 0) bad.push("instant signings until the GW" + next + " deadline " + sastDay(ev.dl));
    assert("D3-the-waiver-paragraph-names-the-full-order-your-place-and-the-settle-time-in-SAST", MB.draft.waiversProcessed === false && bad.length === 0,
      (bad.length ? "missing " + bad.join("; ") + " · " : "") + "«" + ph.slice(0, 260) + "»");
  }
  // moved: the order is read from waiver_pick, never re-derived from the table (Part N2) — today the two agree, so the
  // first and last picks are swapped while the table stays as it is, and the paragraph must follow the picks
  {
    const first = order[0], last = order[order.length - 1];
    const mv = moved(function (M2) {
      const a = M2.draft.entries.filter(function (e) { return e.name === first; })[0], b = M2.draft.entries.filter(function (e) { return e.name === last; })[0];
      const w = a.waiver; a.waiver = b.waiver; b.waiver = w;
    });
    const o2 = mv.E.waiverOrder();
    const byTable = MB.draft.standings.slice().sort(function (x, y) { return y.rank - x.rank; }).map(function (x) { return x.name; });
    const r2 = tryRender("TabDraft", props({ mc: mv }));
    const ph2 = r2.ok ? part(r2.html, "df-phase") : "threw " + (r2.err && r2.err.message);
    const me2 = o2.indexOf(me) + 1;
    assert("D3-moved-the-waiver-order-follows-waiver_pick-and-not-the-table",
      r2.ok && o2[0] === last && o2[o2.length - 1] === first && o2.join("|") !== byTable.join("|") &&
        inOrder(ph2, o2.map(function (t, i) { return (i + 1) + ". " + t; })) && ph2.indexOf("You are " + ordn(me2) + " of " + o2.length) >= 0,
      "picks swapped: " + o2.join(", ") + " · reverse table: " + byTable.join(", ") + " · «" + ph2.slice(0, 200) + "»");
  }

  // the sheet, in lodging order: claim, position, gain, chance it lands, worst case, and backups named
  const landed = C.landed || [], lost = C.lost || [];
  const worstOf = function (id) { return landed.indexOf(id) >= 0 ? "lands" : lost.indexOf(id) >= 0 ? "taken first" : "not reached"; };
  {
    const raw1 = raw(h1, "df-sheet"), sh = plain(raw1);
    const lines = C.sheet.map(function (q, i) {
      return (i + 1) + " " + nm(q.add) + " for " + nm(q.drop) + " " + sgn(q.gain) + " " + pct(C.land[q.add]) + " " + pos(q.add) + " " + worstOf(q.add) +
        (q.kind === "backup" ? " backup for " + nm(q.of) : "");
    });
    const miss = lines.filter(function (s) { return sh.indexOf(s) < 0; });
    const rows = (raw1.match(/class="row"/g) || []).length;
    const likeForLike = C.sheet.every(function (q) { return EN.P[q.add].p === EN.P[q.drop].p; });
    assert("D3-the-sheet-lists-every-claim-in-lodging-order-with-position-gain-chance-and-worst-case", miss.length === 0 && inOrder(sh, lines) && rows === C.sheet.length && likeForLike,
      (miss.length ? "missing «" + miss.slice(0, 3).join("» «") + "» · " : "") + rows + " rows for " + C.sheet.length + " claims; «" + sh.slice(0, 200) + "»");
    const held = (C.held || []).map(function (h) { return nm(h.add) + " for " + nm(h.drop) + ", status " + h.status; });
    assert("D3-a-flagged-pair-held-back-from-the-sheet-is-named-with-its-status", held.every(function (s) { return sh.indexOf(s) >= 0; }) &&
      (C.held || []).every(function (h) { return !C.sheet.some(function (q) { return q.add === h.add; }); }),
      (C.held || []).length + " held: " + (held.join("; ") || "none") + " · «" + sh.slice(-200) + "»");
  }

  // the strip and the stress-test note
  {
    const st = part(h1, "df-strip");
    const want = ["Roster today " + f0(C.valueNow) + " Draft points to GW" + hz, "Expected after claims " + f0(C.meanValue) + " " + sgn(C.meanValue - C.valueNow) + ", " + f0(C.p10) + " to " + f0(C.p90),
      "Worst case " + f0(C.valueStress), "Every first choice " + f0(C.valueAll) + " the ceiling"];
    const miss = want.filter(function (s) { return st.indexOf(s) < 0; });
    assert("D3-the-strip-reads-roster-today-expected-after-claims-worst-case-and-the-ceiling-from-the-sheet", miss.length === 0, (miss.length ? "missing «" + miss.join("» «") + "» · " : "") + "«" + st + "»");
    const ss = part(h1, "df-stress");
    const nL = C.sheet.filter(function (q) { return worstOf(q.add) === "lands"; }).length, nT = C.sheet.filter(function (q) { return worstOf(q.add) === "taken first"; }).length;
    const nR = C.sheet.length - nL - nT;
    const NAMES = { firsts: "all first choices, then backups", paired: "each backup under its first choice" };
    const kept = NAMES[C.strategy], other = C.strategy === "firsts" ? NAMES.paired : NAMES.firsts;
    const bad = [];
    if (ss.indexOf(nL + " of " + C.sheet.length + " claims land, " + nT + " are taken first and " + nR) < 0) bad.push("the counts " + nL + "/" + nT + "/" + nR);
    if (ss.indexOf(kept) < 0 || ss.indexOf(f1(C.valueStress)) < 0 || ss.indexOf(other) < 0 || ss.indexOf(f1(C.altValue)) < 0) bad.push("the kept ordering " + kept + " " + f1(C.valueStress) + " against " + f1(C.altValue));
    assert("D3-the-stress-note-counts-lands-taken-first-and-not-reached-and-names-the-ordering-it-keeps", bad.length === 0, (bad.length ? bad.join("; ") + " · " : "") + "«" + ss + "»");
  }

  // behind reveals: the four orderings, and each rival's modelled wants with the league's activity, team names only
  {
    const r = tryRender("TabDraft", props({ ui: uiOpen({}, { "df-orderings": true, "df-rivals": true }) }));
    const ol = r.ok ? part(r.html, "df-orderings-list") : "", rl = r.ok ? part(r.html, "df-rivals-list") : "";
    const bad = [];
    if (!r.ok) bad.push("threw " + (r.err && r.err.message));
    C.orderings.slice().sort(function (a, b) { return b.mean - a.mean; }).forEach(function (o) { if (ol.indexOf(o.name) < 0 || ol.indexOf(f1(o.mean)) < 0 || ol.indexOf(f0(o.p10) + " to " + f0(o.p90)) < 0) bad.push("ordering " + o.name); });
    const NAMES = { firsts: "all first choices, then backups", paired: "each backup under its first choice" };
    if (ol.indexOf(NAMES[C.strategy] + " lodged") < 0) bad.push("the lodged ordering is not marked");
    const teams = MB.draft.entries.map(function (e) { return e.name; });
    Object.keys(C.rivals).filter(function (k) { return k !== me; }).forEach(function (k) {
      const s = k + " " + C.rivals[k].map(nm).join(", ");
      if (rl.indexOf(s) < 0) bad.push("rival «" + s + "»");
      if (teams.indexOf(k) < 0) bad.push(k + " is not a team name in the league");
    });
    const act = MB.draft.activity;
    Object.keys(act).filter(function (k) { return k !== me; }).sort(function (a, b) { return act[b].claims - act[a].claims; }).slice(0, 3).forEach(function (k) {
      if (rl.indexOf(k + ", " + act[k].claims + " claims in " + act[k].runs + " runs") < 0) bad.push("activity " + k);
    });
    if (plain(h1).indexOf("Busiest in the league") >= 0) bad.push("the activity line is on first paint");
    assert("D3-the-orderings-and-the-rivals'-wants-sit-behind-reveals-and-name-teams-only", bad.length === 0,
      (bad.length ? bad.slice(0, 4).join("; ") + " · " : "") + "«" + ol.slice(0, 120) + "» «" + rl.slice(0, 160) + "»");
  }

  // the solved roster to the re-draft, and the if-taken variant with what it excludes
  {
    const A = SP.draft, B = SP.draftIfTaken;
    const r = tryRender("TabDraft", props({ ui: uiOpen({ "df-solved": true }) }));
    const so = r.ok ? part(r.html, "df-solved") : "";
    const last = A.weeks[A.weeks.length - 1];
    const bad = [];
    if (!r.ok) bad.push("threw " + (r.err && r.err.message));
    if (so.indexOf(A.pairs.length + " claims, " + sgn(A.value - A.base) + " Draft points to GW" + last + " (" + f0(A.base) + " to " + f0(A.value) + ")") < 0) bad.push("the head");
    A.pairs.forEach(function (q) {
      if (so.indexOf(nm(q.add) + " for " + nm(q.drop) + " " + pos(q.add)) < 0) bad.push(nm(q.add) + " for " + nm(q.drop));
      if (EN.P[q.add].p !== EN.P[q.drop].p) bad.push("a cross-position pair");
      if (EN.P[q.add].st !== "a" && so.indexOf(nm(q.add) + " for " + nm(q.drop) + " " + pos(q.add) + " flagged, status " + EN.P[q.add].st) < 0) bad.push(nm(q.add) + " is flagged and not marked");
    });
    if (B && B.ok && B.excluded.length) {
      if (so.indexOf("If " + SP.draftAhead + " take") < 0) bad.push("the team ahead");
      B.excluded.forEach(function (id) { if (so.indexOf(nm(id)) < 0) bad.push("excluded " + nm(id)); });
      if (so.indexOf("worth " + sgn(B.value - B.base)) < 0) bad.push("the if-taken value");
      B.pairs.forEach(function (q) { if (so.indexOf(nm(q.add) + " for " + nm(q.drop)) < 0) bad.push("if-taken " + nm(q.add)); });
    }
    assert("D3-the-solved-roster-lists-every-pair-with-its-value-and-the-if-taken-variant-with-what-it-excludes", bad.length === 0,
      (bad.length ? bad.slice(0, 4).join("; ") + " · " : "") + "«" + so.slice(0, 240) + "»");
  }

  // trades: "both gain" apart from "ask", position for position, each with my gain and theirs
  {
    const T = PR.trades;
    const r = tryRender("TabDraft", props({ ui: uiOpen({ "df-trades": true }) }));
    const tr = r.ok ? part(r.html, "df-trades") : "";
    const line = function (x) { return "Get " + nm(x.get) + " from " + x.rival + " for " + nm(x.give) + " " + pos(x.get) + " you " + sgn(x.mine) + ", they " + sgn(x.theirs); };
    const bad = [];
    if (!r.ok) bad.push("threw " + (r.err && r.err.message));
    const bAt = tr.indexOf("Both sides gain"), aAt = tr.indexOf("Worth asking");
    if (bAt < 0 || aAt < bAt) bad.push("the two groups, both-gain first");
    T.both.slice(0, 4).forEach(function (x) { const k = tr.indexOf(line(x)); if (k < 0 || k > aAt) bad.push("both " + line(x)); });
    T.ask.slice(0, 3).forEach(function (x) { if (tr.indexOf(line(x), aAt) < 0) bad.push("ask " + line(x)); });
    const more = Math.max(0, T.both.length - 4) + Math.max(0, T.ask.length - 3);
    if (more && tr.indexOf(more + " more") < 0) bad.push("the " + more + " more");
    assert("D3-trades-are-split-into-both-gain-and-ask-each-position-for-position-with-both-sides'-change", bad.length === 0,
      (bad.length ? bad.slice(0, 4).join("; ") + " · " : "") + T.both.length + " both, " + T.ask.length + " ask: «" + tr.slice(0, 260) + "»");
    // moved: a cross-position swap and one with my own team at the top of the asks, and one both-gain swap
    const mineIds = MB.draft.rosters[me], rv = MB.draft.entries.filter(function (e) { return e.name !== me; })[0].name;
    const theirs = MB.draft.rosters[rv];
    const gk = theirs.filter(function (id) { return EN.P[id].p === 1; })[0], fw = mineIds.filter(function (id) { return EN.P[id].p === 4; })[0];
    const d1 = theirs.filter(function (id) { return EN.P[id].p === 2; })[0], d2 = mineIds.filter(function (id) { return EN.P[id].p === 2; })[0];
    const PR2 = JSON.parse(JSON.stringify(PR));
    PR2.trades.ask.unshift({ rival: rv, get: gk, give: fw, mine: 9.9, theirs: -0.1, both: false }, { rival: me, get: d2, give: d2, mine: 8.8, theirs: -0.2, both: false });
    PR2.trades.both.unshift({ rival: rv, get: d1, give: d2, mine: 2.2, theirs: 0.7, both: true });
    const r2 = tryRender("TabDraft", props({ ui: uiOpen({ "df-trades": true }), mc: { MC: MB, PLAN: SP, PRE: PR2, E: EN } }));
    const t2 = r2.ok ? part(r2.html, "df-trades") : "";
    const a2 = t2.indexOf("Worth asking");
    assert("D3-moved-a-cross-position-swap-and-a-swap-with-yourself-are-never-shown-and-a-both-gain-swap-lists-under-both",
      r2.ok && t2.indexOf("Get " + nm(gk) + " from " + rv + " for " + nm(fw)) < 0 && t2.indexOf("from " + me) < 0 && t2.indexOf(line(PR2.trades.both[0])) >= 0 && t2.indexOf(line(PR2.trades.both[0])) < a2,
      "«" + t2.slice(0, 260) + "»");
  }

  // free agents: ranked to the horizon with the phase-aware "how to get him"; the app's own rows kept behind a reveal
  {
    const r = tryRender("TabDraft", props({ ui: uiOpen({ "df-pool": true }, { "df-pool-app": true }) }));
    const ph = r.ok ? part(r.html, "df-pool-horizon") : "", app = r.ok ? raw(r.html, "df-pool-app") : "";
    const end = EN.CFG.draftEnd;
    const top = EN.waiverPool().map(function (p) { return { p: p, h: EN.epRange(p, next, end) }; }).sort(function (a, b) { return b.h - a.h; }).slice(0, 12);
    const bad = [];
    if (!r.ok) bad.push("threw " + (r.err && r.err.message));
    const lines = top.map(function (x, i) { return (i + 1) + " " + x.p.n + " " + EN.POS[x.p.p] + " " + x.p.t; });
    lines.forEach(function (s, i) {
      const k = ph.indexOf(s);
      if (k < 0) { bad.push("row «" + s + "»"); return; }
      const rest = ph.slice(k + s.length, k + s.length + 60);
      if (rest.indexOf(f0(top[i].h) + " waiver claim") < 0) bad.push("«" + s + "» reads «" + rest + "»");
    });
    if (!inOrder(ph, lines)) bad.push("rows not in order of Draft points to GW" + end);
    const repo = F("draftPool")(CTX).slice(0, 12);
    const appRows = (app.match(/class="row"/g) || []).length;
    if (appRows !== repo.length || !repo.every(function (p) { return plain(app).indexOf(p.web_name) >= 0; })) bad.push(appRows + " of the app's own " + repo.length + " rows behind the reveal");
    assert("D3-free-agents-rank-to-the-horizon-with-how-to-get-him-and-keep-the-app's-own-rows-behind-a-reveal", bad.length === 0,
      (bad.length ? bad.slice(0, 4).join("; ") + " · " : "") + "«" + ph.slice(0, 220) + "»");
    // moved: waivers settled, the top free agent dropped this week (locked) — the labels and the sheet follow the phase
    const topId = top[0].p.id;
    const mv = moved(function (M2) { M2.draft.waiversProcessed = true; M2.players.forEach(function (p) { if (p.id === topId) p.ds = "l"; }); });
    const r2 = tryRender("TabDraft", props({ mc: mv, ui: uiOpen({ "df-pool": true }) }));
    const p2 = r2.ok ? part(r2.html, "df-pool-horizon") : "", ph2 = r2.ok ? part(r2.html, "df-phase") : "", n2 = r2.ok ? part(r2.html, "df-claims-note") : "";
    assert("D3-moved-once-waivers-settle-the-labels-read-sign-now-or-locked-and-the-sheet-steps-aside",
      r2.ok && p2.indexOf(top[0].p.n) >= 0 && /locked until next waivers/.test(p2) && /sign now/.test(p2) && !/waiver claim/.test(p2) &&
        /have settled/.test(ph2) && /settled/.test(n2) && !has(r2.html, "df-sheet"),
      "pool «" + p2.slice(0, 160) + "» · phase «" + ph2.slice(0, 100) + "» · note «" + n2 + "»");
  }

  // a typed match price hides every build-time answer behind a note naming the Odds tab; nothing else is lost
  {
    const r = tryRender("TabDraft", props({ ctx: CTX_MKT, state: STATE_MKT, ui: uiOpen({ "df-solved": true, "df-trades": true }) }));
    const n1 = r.ok ? part(r.html, "df-claims-note") : "", n2 = r.ok ? part(r.html, "df-solved-note") : "", n3 = r.ok ? part(r.html, "df-trades-note") : "";
    assert("D3-a-typed-match-price-hides-the-sheet-the-solved-roster-and-the-trades-behind-notes-naming-the-Odds-tab",
      r.ok && [n1, n2, n3].every(function (s) { return /Odds tab/.test(s); }) && !has(r.html, "df-sheet") && !has(r.html, "df-solved") && !has(r.html, "df-trades") &&
        has(r.html, "df-phase") && has(r.html, "df-horizon"),
      "«" + n1 + "» «" + n2 + "» «" + n3 + "»");
  }

  // no sheet in this build, a settled waiver run by the clock, a sheet from another plan: each says so
  {
    const noC = { MC: MB, PLAN: SP, PRE: { hash: PR.hash }, E: EN };
    const rNo = tryRender("TabDraft", props({ mc: noC, ui: uiOpen({ "df-trades": true }) }));
    const late = new Date(Date.parse(ev.wv) + 3600000).toISOString();
    const rLate = tryRender("TabDraft", props({ ctx: F("buildCtx")(LIVE, baseState, late) }));
    const PR3 = JSON.parse(JSON.stringify(PR)); PR3.hash = "0000000000000000";
    const rOther = tryRender("TabDraft", props({ mc: { MC: MB, PLAN: SP, PRE: PR3, E: EN } }));
    const note = function (r, id) { return r.ok ? part(r.html, id) : "threw " + (r.err && r.err.message); };
    assert("D3-no-sheet-a-settled-waiver-run-or-a-sheet-from-another-plan-says-so-instead-of-a-sheet",
      /not in this build's data/.test(note(rNo, "df-claims-note")) && /not in this build's data/.test(note(rNo, "df-trades-note")) && has(rNo.html || "", "df-phase") &&
        /settled/.test(note(rLate, "df-claims-note")) && !has(rLate.html || "", "df-sheet") &&
        /different plan/.test(note(rOther, "df-claims-note")) && !has(rOther.html || "", "df-sheet"),
      "no sheet «" + note(rNo, "df-claims-note") + "» · at " + late + " «" + note(rLate, "df-claims-note") + "» · other plan «" + note(rOther, "df-claims-note") + "»");
  }

  // two games, two currencies (§1.1), and the Part G word gate on the component alone
  {
    const txt = visibleText(h1), words = wordsOf(h1);
    assert("D3-the-draft-tab-first-paint-is-labelled-Draft-and-carries-no-Classic-figure", /\bDraft\b/.test(txt) && !/\bClassic\b/i.test(txt),
      (txt.match(/\bClassic\b/gi) || []).length + " mentions of Classic on first paint");
    assert("D3-the-draft-tab-first-paint-stays-under-the-500-word-gate-on-the-component-alone", words > 0 && words < 500, words + " visible words");
  }
})();

/* ---------------------------------------------------------------- 6d. v110 §5 D1 — Today: the landing card and the Command tab

   GwActionCard ports the kit's vToday instruction (the kit's ui.js 70–132): when PLAN.plan exists and PLAN.hash equals
   PRE.hash, the landing states the solved plan's next-gameweek instruction, its captain and vice and the deadline in
   SAST, and the Draft claims line from PRE.claims; when anything the plan was not solved on is in play, the app's own
   card (buildPlan) stands and one line says why. TabCommand gains, before cmd-stand, the last gameweek per game
   (cmd-last), the dated checklist (cmd-next, ticks kept in state.done), the flags on both fifteens (cmd-flags) and what
   this build knows (cmd-notes). Every expectation below is derived at run time from PLAN, PRE, MC, LIVE and the two
   engines, so a rebuild moves the expectation with the screen (qa/no_frozen.cjs, E-084). E-122 (spec §7.6, "seven points
   off the lead" when the gap was eight): every league-table figure is read from the table, proved by rendering on a
   moved table and seeing the copy move. */
console.log("");
console.log("--- v110 D1 · Today: the landing card and the Command tab ---");
(function () {
  const EN = MCP ? MCP.E : null, MB = MCP ? MCP.MC : null, SP = MCP ? MCP.PLAN : null, PR = MCP ? MCP.PRE : null;
  const pl = SP && SP.plan && SP.plan.ok === true && Array.isArray(SP.plan.weeks) && SP.plan.weeks.length ? SP.plan : null;
  const rw = SP && SP.replay && Array.isArray(SP.replay.weeks) ? SP.replay.weeks : [];
  const C = PR && PR.claims && Array.isArray(PR.claims.sheet) && PR.claims.sheet.length ? PR.claims : null;
  if (!assert("D1-the-blocks-carry-a-solved-plan-with-its-replay-and-a-claims-sheet-on-one-hash-for-the-next-gameweek",
    !!(pl && EN && MB && C && rw.length && typeof PR.hash === "string" && PR.hash === SP.hash && pl.weeks[0].gw === CTX.nextEvent),
    pl ? "PLAN " + SP.hash + ", PRE " + (PR && PR.hash) + ", first week GW" + pl.weeks[0].gw + ", the snapshot's next GW" + CTX.nextEvent : "no solved plan in the PLAN block")) return;
  const w = pl.weeks[0], gw = w.gw, lastGw = pl.weeks[pl.weeks.length - 1].gw, next = MB.gw.next;
  const r0 = rw.filter(function (r) { return r && r.gw === gw; })[0] || null;
  const nmL = function (id) { return CTX.els[id] ? CTX.els[id].web_name : "?"; };
  const nmE = function (id) { return EN.P[id] ? EN.P[id].n : "?"; };
  const f0 = function (x) { return String(Math.round(x)); };
  const f1 = function (x) { return (Math.round(x * 10) / 10).toFixed(1); };
  const sgn = function (x) { return (x >= 0 ? "+" : "−") + f1(Math.abs(x)); };
  const cash = function (x) { return "£" + Number(x).toFixed(1) + "m"; };
  const grpS = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); };
  const ordn = function (n) { const m = n % 100; return n + (m >= 11 && m <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"); };
  // SAST, computed here rather than borrowed from the app, so the two can disagree: "Sat 12:00" and "Sat 10 Oct 12:00"
  const sastAt = function (iso) {
    const t = Date.parse(iso); if (!isFinite(t)) return { wd: "", day: "" };
    const d = new Date(t + 2 * 3600000), hm = String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
    return { wd: wd + " " + hm, day: wd + " " + d.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()] + " " + hm };
  };
  const plain = function (html) {
    return String(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;|&#39;/g, "'")
      .replace(/\s+/g, " ").replace(/ ([,.;:])/g, "$1").trim();
  };
  const MARKS = ["ld-draft", "ld-aside", "rev-ld-why", "rev-ld-cost", "rev-ld-flag", "rev-ld-quick", "ld-why", "ld-cost", "ld-quick",
    "sec-cmd-last", "cmd-last-classic", "cmd-last-draft", "sec-cmd-next", "cmd-todo", "sec-cmd-flags", "cmd-flags-classic", "cmd-flags-draft", "cmd-delta",
    "sec-cmd-notes", "cmd-notes-list", "sec-cmd-stand", "sec-cmd-checks", "sec-cmd-week"];
  const raw = function (html, id) {
    const hit = html.indexOf('data-testid="' + id + '"'); if (hit < 0) return "";
    const at = html.lastIndexOf("<", hit);
    let end = html.length;
    MARKS.forEach(function (o) {
      if (o === id) return;
      const k = html.indexOf('data-testid="' + o + '"', hit + 1);
      if (k > hit) { const s = html.lastIndexOf("<", k); if (s > hit && s < end) end = s; }
    });
    return html.slice(at, end);
  };
  const part = function (html, id) { return plain(raw(html, id)); };
  const has = function (html, id) { return html.indexOf('data-testid="' + id + '"') >= 0; };
  const landing = function (over) {
    const p = {};
    Object.keys(FIX.GwActionCard.props).forEach(function (k) { p[k] = FIX.GwActionCard.props[k]; });
    Object.keys(over || {}).forEach(function (k) { p[k] = over[k]; });
    return p;
  };
  const cmd = function (over) {
    const p = {};
    Object.keys(FIX.TabCommand.props).forEach(function (k) { p[k] = FIX.TabCommand.props[k]; });
    p.ui = { mode: "full", tab: "command", open: {}, reveals: {} };
    Object.keys(over || {}).forEach(function (k) { p[k] = over[k]; });
    return p;
  };
  const openCmd = function (ids) { const o = {}; ids.forEach(function (id) { o[id] = true; }); return { mode: "full", tab: "command", open: o, reveals: {} }; };
  const mcWith = function (over) { return { MC: over.MC || MB, PLAN: over.PLAN || SP, PRE: "PRE" in over ? over.PRE : PR, E: over.E || EN }; };
  const ev = MB.gw.events.filter(function (e) { return e.id === gw; })[0] || {};
  const dev = MB.draft.events[String(next)] || {};
  const CHIP = { wildcard: "Wildcard", freehit: "Free Hit", bboost: "Bench Boost", "3xc": "Triple Captain" };
  const kind = w.chip === "wildcard" ? "wildcard" : w.chip === "freehit" ? "freehit" : w.in.length ? "transfers" : "roll";

  // (1) the solved instruction: what to do, captain and vice, the deadline in SAST, under the spec's 100 words (§1.6)
  const r0l = tryRender("GwActionCard", landing({}));
  if (!assert("D1-the-landing-first-paint-renders", r0l.ok, r0l.err && r0l.err.message)) return;
  const h0 = r0l.html;
  {
    const lead = kind === "wildcard" ? "Play the Wildcard" : kind === "freehit" ? "Play the Free Hit"
      : kind === "transfers" ? "Make " + w.in.length + " transfer" + (w.in.length === 1 ? "" : "s") + (w.chip && CHIP[w.chip] ? " and play the " + CHIP[w.chip] : "")
        : (w.chip && CHIP[w.chip] ? "Play the " + CHIP[w.chip] : "Roll the free transfer");
    const bad = [];
    if (h0.indexOf('data-plan="solved"') < 0) bad.push("the card is not marked as the solved plan");
    if (plain(h0).indexOf(lead + " before " + sastAt(ev.dl).wd + " SAST.") < 0) bad.push("the lead «" + lead + " before " + sastAt(ev.dl).wd + " SAST.»");
    const cm = /Captain <b>([^<]+)<\/b>, vice <b>([^<]+)<\/b>\./.exec(h0);
    if (!cm || cm[1] !== nmL(w.cap) || cm[2] !== nmL(w.vice)) bad.push("captain and vice read " + (cm ? cm[1] + " / " + cm[2] : "nothing") + ", the plan has " + nmL(w.cap) + " / " + nmL(w.vice));
    const bx = F("bestXI")(w.squad, CTX);
    if (w.xi.indexOf(w.cap) < 0) bad.push("the plan's captain is not in the plan's eleven");
    if (!bx || !Array.isArray(bx.ids) || bx.ids.indexOf(w.cap) < 0) bad.push("the plan's captain is not in the app engine's best eleven of that fifteen");
    if (kind === "wildcard" || kind === "freehit") {
      const nm = /<div class="names">([\s\S]*?)<\/div>/.exec(h0);
      const shown = nm ? plain(nm[1]).split(/[·,]/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
      const want = w.squad.map(nmL);
      if (shown.length !== 15 || want.some(function (n) { return shown.indexOf(n) < 0; })) bad.push("the fifteen reads «" + shown.join("|") + "»");
    }
    if (kind === "transfers") w.in.concat(w.out).forEach(function (id) { if (plain(h0).indexOf(nmL(id)) < 0) bad.push("the move list lacks " + nmL(id)); });
    const keys = []; let km; const KRE = /<div class="panel-k">([\s\S]*?)<\/div>/g; while ((km = KRE.exec(h0))) keys.push(plain(km[1]));
    if (keys.some(function (k) { return /Classic/.test(k) && /Draft/.test(k); })) bad.push("a panel names both games");
    if (!keys.some(function (k) { return /^Classic\b/.test(k); }) || !keys.some(function (k) { return /^Draft\b/.test(k); })) bad.push("panels «" + keys.join("» «") + "» do not name each game");
    const panels = (h0.match(/class="panel"/g) || []).length, words = wordsOf(h0);
    assert("D1-the-landing-shows-the-solved-plan's-instruction-captain-vice-and-SAST-deadline-with-each-game-labelled-in-at-most-4-panels-under-100-words",
      bad.length === 0 && panels <= 4 && words < 100,
      (bad.length ? bad.join("; ") + " · " : "") + panels + " panels, " + words + " words: «" + plain(h0).slice(0, 220) + "»");
  }

  // (2) the Draft claims line: count, the first claim, the value if all land and under the stress test, the settle time
  {
    const dr = part(h0, "ld-draft");
    const sheet = C.sheet.filter(function (q) { return EN.P[q.add] && EN.P[q.drop] && EN.P[q.add].p === EN.P[q.drop].p; });
    const all = isFinite(C.valueAll) ? C.valueAll : C.allFirst;
    const want = [sheet.length + (sheet.length === 1 ? " claim" : " claims") + ", first " + nmE(sheet[0].add) + " for " + nmE(sheet[0].drop) + ": " +
      sgn(all - C.valueNow) + " Draft points if all land, " + sgn(C.valueStress - C.valueNow) + " under the stress test.", "Waivers settle " + sastAt(dev.wv).wd + " SAST."];
    const miss = want.filter(function (s) { return dr.indexOf(s) < 0; });
    assert("D1-the-landing-Draft-line-reads-the-claims-sheet-from-PRE-and-the-settle-time-from-the-league",
      miss.length === 0 && /^Draft\b/.test(dr) && !/Classic/.test(dr), (miss.length ? "missing «" + miss.join("» «") + "» · " : "") + "«" + dr + "»");
  }

  // (3) E-122: the league-table figures are read from the table and move with it, on the landing and on the Command tab
  {
    const tableOf = function (M) {
      const st = M.draft.standings, me = st.filter(function (s) { return s.name === M.draft.me; })[0];
      const byRank = st.slice().sort(function (a, b) { return a.rank - b.rank || b.pts - a.pts; });
      let tail;
      if (me.rank === 1) {
        const second = byRank.filter(function (s) { return s !== me; })[0], clear = second ? me.pts - second.pts : 0;
        tail = "top of the table" + (clear > 0 ? ", " + clear + " clear" : ", level on league points");
      } else {
        const behind = byRank[0].pts - me.pts;
        tail = behind === 0 ? "level with the leader" : behind + " off the lead";
      }
      return { key: ordn(me.rank) + " of " + st.length + ", " + tail, row: ordn(me.rank) + " of " + st.length + " on " + me.pts + " league point" + (me.pts === 1 ? "" : "s") + ", " + tail };
    };
    const moves = [
      { why: "the leader three points further on", fn: function (M) { M.draft.standings.filter(function (s) { return s.rank === 1; })[0].pts += 3; } },
      { why: "your rank swapped with third", fn: function (M) {
        const me = M.draft.standings.filter(function (s) { return s.name === M.draft.me; })[0], o = M.draft.standings.filter(function (s) { return s.rank === 3 && s !== me; })[0];
        if (o) { o.rank = me.rank; me.rank = 3; } } },
      { why: "you top by two", fn: function (M) {
        const me = M.draft.standings.filter(function (s) { return s.name === M.draft.me; })[0], top = M.draft.standings.filter(function (s) { return s.rank === 1 && s !== me; })[0];
        if (top) { me.pts = top.pts + 2; top.rank = me.rank; me.rank = 1; } } }
    ];
    const base = tableOf(MB), bad = [];
    if (part(h0, "ld-draft").indexOf("Draft · " + base.key) < 0) bad.push("the landing does not read «Draft · " + base.key + "»");
    const cl0 = tryRender("TabCommand", cmd({ ui: openCmd(["cmd-last"]) }));
    if (!cl0.ok || part(cl0.html, "cmd-last-draft").indexOf("Draft table " + base.row) < 0) bad.push("cmd-last does not read «Draft table " + base.row + "»");
    const seen = [base.key];
    moves.forEach(function (mv) {
      const M2 = JSON.parse(JSON.stringify(MB)); mv.fn(M2);
      const want = tableOf(M2);
      const rl = tryRender("GwActionCard", landing({ mc: mcWith({ MC: M2 }) }));
      const rc = tryRender("TabCommand", cmd({ ui: openCmd(["cmd-last"]), mc: mcWith({ MC: M2 }) }));
      const lk = rl.ok ? part(rl.html, "ld-draft") : "threw " + (rl.err && rl.err.message), ck = rc.ok ? part(rc.html, "cmd-last-draft") : "threw " + (rc.err && rc.err.message);
      if (want.key === base.key) bad.push(mv.why + " did not move the expectation");
      if (lk.indexOf("Draft · " + want.key) < 0 || lk.indexOf("Draft · " + base.key) >= 0) bad.push(mv.why + ": landing «" + lk.slice(0, 60) + "» for «" + want.key + "»");
      if (ck.indexOf("Draft table " + want.row) < 0) bad.push(mv.why + ": cmd-last «" + ck.slice(0, 120) + "» for «" + want.row + "»");
      seen.push(want.key);
    });
    assert("D1-E122-every-league-table-figure-on-the-landing-and-the-Command-tab-is-read-from-the-table-and-moves-with-it", bad.length === 0,
      bad.length ? bad.slice(0, 4).join("; ") : seen.map(function (s) { return "«" + s + "»"; }).join(" → "));
  }

  // (4) the solved card steps aside, and says why in one line, for everything the plan was not solved on
  {
    const aside = function (r) { return r.ok ? part(r.html, "ld-aside") : "threw " + (r.err && r.err.message); };
    const app = function (r) { return r.ok && r.html.indexOf('data-plan="app"') >= 0 && r.html.indexOf('data-plan="solved"') < 0; };
    const PR2 = JSON.parse(JSON.stringify(PR)); PR2.hash = "0000000000000000";
    const SP2 = JSON.parse(JSON.stringify(SP)); SP2.plan.weeks[0].gw = gw + 1;
    const liveF = JSON.parse(JSON.stringify(LIVE));
    const capEl = liveF.elements.filter(function (e) { return e.id === w.cap; })[0];
    if (capEl) { capEl.status = "d"; capEl.chance = 75; capEl.news = "Knock - 75% chance of playing"; }
    const ctxF = F("buildCtx")(liveF, baseState, NOW);
    // past the first deadline and outside the live window: four hours after that gameweek's last kick-off
    const lastKo = Math.max.apply(null, [Date.parse(ev.dl)].concat(LIVE.fixtures.filter(function (f) { return Number(f.event) === gw; })
      .map(function (f) { return Date.parse(f.kickoff_time); }).filter(isFinite)));
    const ctxL = F("buildCtx")(LIVE, baseState, new Date(lastKo + 4 * 3600000).toISOString());
    const R = {
      hash: tryRender("GwActionCard", landing({ mc: mcWith({ PRE: PR2 }) })),
      noPre: tryRender("GwActionCard", landing({ mc: mcWith({ PRE: null }) })),
      gw: tryRender("GwActionCard", landing({ mc: mcWith({ PLAN: SP2 }) })),
      late: tryRender("GwActionCard", landing({ ctx: ctxL, plan: F("buildPlan")(ctxL, false) })),
      lock: tryRender("GwActionCard", landing({ plan: PLAN_LOCKED, reveals: { "wc-lock": true } })),
      price: tryRender("GwActionCard", landing({ ctx: CTX_MKT })),
      flag: tryRender("GwActionCard", landing({ ctx: ctxF, plan: F("buildPlan")(ctxF, false) }))
    };
    const WANT = { hash: /precomputed results/, noPre: /precomputed results/, gw: new RegExp("starts at GW" + (gw + 1)), late: /deadline has passed/, lock: /premiums are locked/,
      price: /Odds tab/, flag: /flagged/ };
    const bad = [];
    Object.keys(R).forEach(function (k) {
      const a = aside(R[k]);
      if (!app(R[k])) bad.push(k + ": the solved card still shows");
      if (!WANT[k].test(a)) bad.push(k + ": the note reads «" + a + "»");
      if (!/^Solved plan set aside/.test(a)) bad.push(k + ": the note does not say the solved plan is set aside");
    });
    if (R.lock.ok && plain(R.lock.html).indexOf("Premiums locked") < 0) bad.push("lock: the app's own locked card is not the one shown");
    if (R.flag.ok && plain(R.flag.html).indexOf(nmL(w.cap)) >= 0) bad.push("flag: the flagged captain " + nmL(w.cap) + " is still named");
    assert("D1-the-solved-card-steps-aside-for-another-hash-another-gameweek-a-passed-deadline-the-lock-a-typed-price-or-a-new-flag-and-says-why", bad.length === 0,
      bad.length ? bad.slice(0, 5).join("; ") : Object.keys(R).map(function (k) { return k + " «" + aside(R[k]).slice(23, 90) + "»"; }).join(" · "));
    const rNo = tryRender("GwActionCard", landing({ mc: MCP_NOPLAN }));
    const heurLead = PLAN.kind === "wildcard" ? "Play Wildcard 1" : PLAN.kind === "transfers" ? "Make " + PLAN.tp.moves.length + " transfer" : "Hold";
    assert("D1-with-no-solved-plan-the-app's-own-card-stands-with-no-note",
      app(rNo) && !has(rNo.html, "ld-aside") && !has(rNo.html, "ld-draft") && plain(rNo.html).indexOf(heurLead) >= 0 &&
        rNo.html.indexOf("Captain <b>" + nmL(PLAN.capId) + "</b>") >= 0,
      rNo.ok ? "«" + plain(rNo.html).slice(0, 160) + "»" : "threw " + (rNo.err && rNo.err.message));
  }

  // (5) the reasoning behind reveals: why (the plan), what it costs (its replay, never the solver's fields), and the app's
  //     own answer kept behind a labelled reveal (§1.4)
  {
    const RV = { "ld-why": true, "ld-cost": true, "ld-quick": true };
    const r = tryRender("GwActionCard", landing({ reveals: RV }));
    const why = r.ok ? part(r.html, "ld-why") : "", cost = r.ok ? part(r.html, "ld-cost") : "", quick = r.ok ? part(r.html, "ld-quick") : "";
    const T = SP.timing || null, okc = function (x) { return !!(x && x.ok === true && isFinite(x.total)); };
    const nw = (T && okc(T.never) ? T.never : null) || (okc(SP.noWildcard) ? SP.noWildcard : null);
    const bad = [];
    if (!r.ok) bad.push("threw " + (r.err && r.err.message));
    if (!/^Classic\b/.test(why) || why.indexOf(f0(pl.total) + " expected points to GW" + lastGw) < 0) bad.push("why «" + why.slice(0, 120) + "»");
    if (nw && why.indexOf(sgn(pl.total - nw.total)) < 0) bad.push("why lacks the edge over the best plan that keeps the wildcard, " + sgn(pl.total - nw.total));
    if (!r0 || cost.indexOf(cash(r0.bank)) < 0) bad.push("cost lacks the replayed bank " + (r0 ? cash(r0.bank) : "?"));
    if (r0 && /budget line/.test(cost) !== (r0.bank < 0.35)) bad.push("the budget-line warning against a replayed bank of " + cash(r0.bank));
    if (r0 && kind === "wildcard" && r0.ftAfter === r0.ftBefore && r0.ftBefore > 0 &&
      cost.indexOf("Your " + r0.ftBefore + " free transfer" + (r0.ftBefore === 1 ? " is" : "s are") + " kept for GW" + (gw + 1)) < 0) bad.push("the kept free transfers");
    if (quick.indexOf(nmL(PLAN.capId)) < 0 || !/own search/.test(quick)) bad.push("the app's own answer «" + quick.slice(0, 100) + "»");
    const SP3 = JSON.parse(JSON.stringify(SP));
    SP3.plan.weeks.forEach(function (x) { x.bank = Math.round((Number(x.bank) + 7.3) * 10) / 10; x.ftBefore = 0; x.hits = 3; x.used = 9; });
    const r3 = tryRender("GwActionCard", landing({ reveals: RV, mc: mcWith({ PLAN: SP3 }) }));
    const cost3 = r3.ok ? part(r3.html, "ld-cost") : "";
    if (!r3.ok || cost3.indexOf(cash(SP3.plan.weeks[0].bank)) >= 0 || (r0 && cost3.indexOf(cash(r0.bank)) < 0)) bad.push("with the solver's fields corrupted the cost reads «" + cost3.slice(0, 100) + "»");
    assert("D1-why-and-cost-read-the-plan-and-its-replay-and-the-app's-own-answer-sits-behind-a-labelled-reveal", bad.length === 0,
      (bad.length ? bad.join("; ") + " · " : "") + "why «" + why.slice(0, 90) + "» cost «" + cost.slice(0, 90) + "»");
  }

  // (6) the Command tab: four sections before the season panel, which stays PRIMARY and the only one open at first paint
  const c1 = tryRender("TabCommand", cmd({}));
  if (!assert("D1-the-Command-tab-first-paint-renders", c1.ok, c1.err && c1.err.message)) return;
  {
    const order = []; let sm; const SRE = /data-testid="sec-(cmd-[a-z]+)" aria-expanded="(true|false)"/g;
    const open = [];
    while ((sm = SRE.exec(c1.html))) { order.push(sm[1]); if (sm[2] === "true") open.push(sm[1]); }
    const want = ["cmd-last", "cmd-next", "cmd-flags", "cmd-notes", "cmd-stand", "cmd-checks", "cmd-week"];
    const t = plain(c1.html);
    assert("D1-the-Command-tab-adds-last-next-flags-and-notes-before-cmd-stand-which-stays-PRIMARY-and-alone-open",
      order.join(",") === want.join(",") && open.join(",") === "cmd-stand" && APP_PRIMARY.command === "cmd-stand" && t.indexOf("Before GW" + next) >= 0 && wordsOf(c1.html) < 500,
      "order " + order.join(",") + "; open " + open.join(",") + "; PRIMARY " + APP_PRIMARY.command + "; " + wordsOf(c1.html) + " words");
  }

  // (7) cmd-last: the last gameweek per game, from the baked block
  {
    const r = tryRender("TabCommand", cmd({ ui: openCmd(["cmd-last"]) }));
    const lc = r.ok ? part(r.html, "cmd-last-classic") : "", ld = r.ok ? part(r.html, "cmd-last-draft") : "";
    const lastDone = MB.gw.lastDone;
    const gws = MB.classic.gws.filter(function (g) { return g.gw <= lastDone; });
    const g = gws[gws.length - 1], prev = gws.length > 1 ? gws[gws.length - 2] : null;
    const since = function (id, from) { let s = 0; for (let k = from; k <= lastDone; k++) { const h = EN.P[id] && EN.P[id].h ? EN.P[id].h[k] : null; s += h ? h[1] : 0; } return s; };
    const want = ["Classic GW" + g.gw + " " + g.pts + " against an average of " + g.avg];
    if (prev) want.push("Classic overall rank " + grpS(prev.rank) + " to " + grpS(g.rank) + (g.rank === prev.rank ? ", unchanged" : ", " + (g.rank < prev.rank ? "up " : "down ") + grpS(Math.abs(prev.rank - g.rank))));
    const cap = g.picks.filter(function (k) { return k.c; })[0];
    if (cap) want.push("Classic captain " + nmE(cap.id) + ", " + ((cap.pts || 0) * cap.mult) + " points");
    (MB.classic.transfersLog || []).filter(function (t) { return t.gw === g.gw; }).forEach(function (t) {
      want.push("Classic transfer, GW" + t.gw + " " + nmE(t.in) + " in for " + nmE(t.out) + ": " + since(t.in, t.gw) + " against " + since(t.out, t.gw) + " since GW" + t.gw);
    });
    const me = MB.draft.me;
    const m = MB.draft.matches.filter(function (x) { return x.fin && x.gw <= lastDone && (x.a === me || x.b === me); }).sort(function (a, b) { return b.gw - a.gw; })[0];
    const wantD = [];
    if (m) {
      const mine = m.a === me ? m.ap : m.bp, opp = m.a === me ? m.bp : m.ap, on = m.a === me ? m.b : m.a;
      wantD.push("Draft GW" + m.gw + " " + (mine > opp ? "Won" : mine < opp ? "Lost" : "Drew") + " " + mine + "–" + opp + " against " + on);
    }
    const st = MB.draft.standings.filter(function (s) { return s.name === me; })[0];
    if (st) wantD.push("Draft record " + st.w + " won, " + st.d + " drawn, " + st.l + " lost; " + st.pf + " scored, " + st.pa + " conceded");
    const miss = want.filter(function (s) { return lc.indexOf(s) < 0; }).concat(wantD.filter(function (s) { return ld.indexOf(s) < 0; }));
    // moved: a different score and average for the last gameweek, and the copy follows
    const M2 = JSON.parse(JSON.stringify(MB)); const g2 = M2.classic.gws.filter(function (x) { return x.gw === g.gw; })[0]; g2.pts += 5; g2.avg += 1;
    const r2 = tryRender("TabCommand", cmd({ ui: openCmd(["cmd-last"]), mc: mcWith({ MC: M2 }) }));
    const lc2 = r2.ok ? part(r2.html, "cmd-last-classic") : "";
    assert("D1-cmd-last-reads-each-game's-last-gameweek-from-the-baked-block-and-moves-with-it",
      r.ok && miss.length === 0 && !/Draft/.test(lc) && !/Classic/.test(ld) && lc2.indexOf("Classic GW" + g.gw + " " + (g.pts + 5) + " against an average of " + (g.avg + 1)) >= 0,
      (miss.length ? "missing «" + miss.join("» «") + "» · " : "") + "«" + lc.slice(0, 160) + "» «" + ld.slice(0, 160) + "»");
  }

  // (8) cmd-next: the dated checklist in SAST, in due order, each item labelled with its game, ticks read from state.done
  {
    const tickCtx = FIX.TabCommand.variants[0].ctx;
    const r = tryRender("TabCommand", cmd({ ui: openCmd(["cmd-next"]), ctx: tickCtx }));
    const html = r.ok ? raw(r.html, "cmd-todo") : "";
    const items = []; let bm; const BRE = /<button[^>]*data-todo="([a-z]+)"[^>]*aria-pressed="(true|false)"[^>]*>([\s\S]*?)<\/button>/g;
    while ((bm = BRE.exec(html))) items.push({ id: bm[1], on: bm[2] === "true", text: plain(bm[3]) });
    const sheet = C.sheet.filter(function (q) { return EN.P[q.add] && EN.P[q.drop] && EN.P[q.add].p === EN.P[q.drop].p; });
    const both = (PR.trades && Array.isArray(PR.trades.both) ? PR.trades.both : []).filter(function (x) {
      return x && x.rival !== MB.draft.me && EN.P[x.get] && EN.P[x.give] && EN.P[x.get].p === EN.P[x.give].p;
    });
    const want = [];
    if (both.length && dev.tr) want.push({ id: "trade", due: dev.tr, has: "Propose " + nmE(both[0].get) + " from " + both[0].rival + " for " + nmE(both[0].give), game: "Draft" });
    want.push({ id: "rebuild", due: new Date(Date.parse(dev.wv || ev.dl) - 24 * 3600000).toISOString(), has: "rebuild", game: "" });
    want.push({ id: "claims", due: dev.wv, has: "Lodge the " + sheet.length + " Draft claims in the order on the Draft tab, first " + nmE(sheet[0].add) + " for " + nmE(sheet[0].drop), game: "Draft" });
    want.push({ id: "classic", due: ev.dl, game: "Classic",
      has: kind === "wildcard" ? "Play the Wildcard and build the planned fifteen; captain " + nmL(w.cap) + ", vice " + nmL(w.vice) : "captain " + nmL(w.cap) + ", vice " + nmL(w.vice) });
    want.push({ id: "draftxi", due: ev.dl, has: "set the Draft eleven", game: "Draft" });
    const sorted = want.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return Date.parse(a.x.due) - Date.parse(b.x.due) || a.i - b.i; }).map(function (o) { return o.x; });
    const bad = [];
    if (items.map(function (x) { return x.id; }).join(",") !== sorted.map(function (x) { return x.id; }).join(",")) bad.push("order " + items.map(function (x) { return x.id; }).join(",") + " against " + sorted.map(function (x) { return x.id; }).join(","));
    sorted.forEach(function (x) {
      const it = items.filter(function (y) { return y.id === x.id; })[0];
      if (!it) return;
      if (it.text.indexOf(x.has) < 0) bad.push(x.id + " «" + it.text.slice(0, 90) + "» lacks «" + x.has + "»");
      if (it.text.indexOf(sastAt(x.due).day + " SAST") < 0) bad.push(x.id + " is not dated " + sastAt(x.due).day + " SAST");
      if (x.game && it.text.indexOf(x.game) !== 0) bad.push(x.id + " is not labelled " + x.game);
      if (it.on !== (x.id === "claims")) bad.push(x.id + " tick " + it.on);
    });
    if (r.ok && plain(r.html).indexOf("1 of " + sorted.length + " done") < 0) bad.push("the count of ticks");
    assert("D1-cmd-next-is-the-dated-checklist-in-SAST-in-due-order-with-each-game-named-and-ticks-read-from-state", r.ok && bad.length === 0,
      (bad.length ? bad.slice(0, 4).join("; ") + " · " : "") + items.map(function (x) { return x.id + (x.on ? "✓" : ""); }).join(", "));
  }

  // (9) cmd-flags: the flags on both fifteens, each game on its own, and what moved since the last build
  {
    const r = tryRender("TabCommand", cmd({ ui: openCmd(["cmd-flags"]) }));
    const fc = r.ok ? part(r.html, "cmd-flags-classic") : "", fd = r.ok ? part(r.html, "cmd-flags-draft") : "", dl = r.ok ? part(r.html, "cmd-delta") : "";
    const cf = CTX.squadIds.filter(function (id) { return CTX.flags[id] && CTX.flags[id].flagged; });
    const df = EN.draftRoster().filter(function (p) { return p.st !== "a"; });
    const bad = [];
    if (!/^Classic\b/.test(fc) || !/^Draft\b/.test(fd)) bad.push("each block names its game first");
    cf.forEach(function (id) { if (fc.indexOf("Classic · " + nmL(id)) < 0) bad.push("Classic " + nmL(id)); });
    df.forEach(function (p) { if (fd.indexOf("Draft · " + p.n) < 0) bad.push("Draft " + p.n); });
    if (!cf.length && !/nobody/.test(fc)) bad.push("Classic says nothing when nobody is flagged");
    if (!df.length && !/nobody/.test(fd)) bad.push("Draft says nothing when nobody is flagged");
    const d = MB.delta;
    if (d && d.since && ((d.prices || []).length || (d.flags || []).length)) {
      const np = d.prices.length, nf = d.flags.length;
      if (dl.indexOf(np + " price change" + (np === 1 ? "" : "s") + " and " + nf + " flag change" + (nf === 1 ? "" : "s")) < 0 || dl.indexOf(sastAt(d.since).day) < 0) bad.push("the delta «" + dl + "»");
    }
    assert("D1-cmd-flags-names-every-flag-on-both-fifteens-with-each-game-apart-and-the-changes-since-the-last-build", r.ok && bad.length === 0,
      (bad.length ? bad.join("; ") + " · " : "") + cf.length + " Classic, " + df.length + " Draft: «" + fc.slice(0, 100) + "» «" + fd.slice(0, 100) + "»");
  }

  // (10) cmd-notes: what this build knows, dated: the build notes and the desk research, and the re-draft from the league
  {
    const r = tryRender("TabCommand", cmd({ ui: openCmd(["cmd-notes"]) }));
    const nt = r.ok ? part(r.html, "cmd-notes-list") : "", all = r.ok ? plain(r.html) : "";
    const bad = [];
    (PR.changes || []).forEach(function (s) { if (nt.indexOf(plain(s)) < 0) bad.push("build note «" + s.slice(0, 40) + "»"); });
    ((MB.intel && MB.intel.notes) || []).forEach(function (s) { if (nt.indexOf(plain(s)) < 0) bad.push("desk note «" + s.slice(0, 40) + "»"); });
    if (all.indexOf("Feeds pulled " + sastAt(MB.asOf).day + " SAST") < 0) bad.push("the feed date");
    if (MB.intel && MB.intel.asOf && all.indexOf("Desk research dated " + sastAt(MB.intel.asOf).day + " SAST") < 0) bad.push("the desk-research date");
    const rd = MB.draft.league.redraft;
    if (rd && nt.indexOf("re-drafts " + sastAt(rd.at).day + " SAST, effective GW" + rd.fromGw + ", so this roster plays through GW" + (rd.fromGw - 1)) < 0) bad.push("the re-draft line");
    assert("D1-cmd-notes-lists-the-build-notes-and-the-desk-research-dated-and-the-re-draft-from-the-league", r.ok && bad.length === 0,
      (bad.length ? bad.slice(0, 4).join("; ") + " · " : "") + (PR.changes || []).length + " build notes, " + ((MB.intel && MB.intel.notes) || []).length + " desk notes");
  }

  // (11) the tick store: state.done keeps "<gameweek>:<item>" set to true and nothing else, total under junk
  {
    const S = F("sanitiseState");
    const rawD = { done: {} };
    rawD.done[next + ":claims"] = true; rawD.done[next + ":classic"] = false; rawD.done.abc = true; rawD.done["99:claims"] = true;
    rawD.done[next + ":CLAIMS"] = true; rawD.done["0:claims"] = true; rawD.done[next + ":x"] = true; rawD.done[next + ":rebuild"] = "yes";
    const s = S(rawD);
    const bad = [];
    if (JSON.stringify(s.done) !== JSON.stringify((function () { const o = {}; o[next + ":claims"] = true; return o; })())) bad.push("kept " + JSON.stringify(s.done));
    if (!s.done || JSON.stringify(S(s).done) !== JSON.stringify(s.done)) bad.push("not stable through a second pass");
    const p = S(JSON.parse('{"done":{"__proto__":true,"' + next + ':claims":true}}'));
    if (!p.done || typeof p.done !== "object" || Object.getPrototypeOf(p.done) !== Object.prototype || Object.keys(p.done).join(",") !== next + ":claims") bad.push("an own __proto__ key " + JSON.stringify(p.done));
    [null, undefined, "", "x", 0, [], {}, { done: "x" }, { done: [1, 2] }, { done: null }, { done: 7 }].forEach(function (j, i) {
      let o; try { o = S(j); } catch (e) { bad.push("junk #" + i + " threw"); return; }
      if (!o.done || typeof o.done !== "object" || Array.isArray(o.done) || Object.keys(o.done).length) bad.push("junk #" + i + " done " + JSON.stringify(o.done));
    });
    const many = { done: {} }; for (let g = 1; g <= 38; g++) ["claims", "classic", "draftxi", "rebuild", "trade", "extraone", "extratwo", "extrathree"].forEach(function (k) { many.done[g + ":" + k] = true; });
    const nk = Object.keys(S(many).done || {}).length;
    if (!(nk > 0 && nk < Object.keys(many.done).length)) bad.push("the map is not capped (" + nk + " kept)");
    assert("D1-state.done-keeps-gameweek-item-ticks-set-to-true-and-drops-everything-else", bad.length === 0, bad.join("; ") || "one tick kept of eight, junk refused, capped at " + nk);
  }

  // (12) two games, two currencies: every stat row in the new sections names its game; no row names both; and the season
  //      panels carry a Classic tag in their first line (E-118)
  {
    const r = tryRender("TabCommand", FIX.TabCommand.props);
    const html = r.ok ? r.html : "";
    const sec = function (id) { const a = html.indexOf('data-section="' + id + '"'); if (a < 0) return ""; const b = html.indexOf('data-section="', a + 10); return html.slice(a, b < 0 ? html.length : b); };
    const bad = [];
    ["cmd-last", "cmd-flags"].forEach(function (id) {
      let km; const KRE = /<span class="k">([\s\S]*?)<\/span>/g, s = sec(id); let n = 0;
      while ((km = KRE.exec(s))) { n++; const k = plain(km[1]); if (!/^(Classic|Draft)\b/.test(k)) bad.push(id + " row «" + k + "» names no game"); }
      if (!n && id === "cmd-last") bad.push(id + " has no rows");
    });
    let rm; const KV = /<div class="kv">([\s\S]*?)<\/div>/g;
    while ((rm = KV.exec(html))) { const t = plain(rm[1]); if (/\bClassic\b/.test(t) && /\bDraft\b/.test(t)) bad.push("row «" + t.slice(0, 60) + "» names both games"); }
    ["cmd-stand", "cmd-checks"].forEach(function (id) {
      const s = sec(id), b = s.indexOf('class="sec-b"'), c = b >= 0 ? s.indexOf("<div", b) : -1, e = c >= 0 ? s.indexOf("</div>", c) : -1;
      const first = c >= 0 && e > c ? plain(s.slice(c, e)) : "";
      if (!/^Classic\b/.test(first)) bad.push(id + " first line «" + first.slice(0, 40) + "»");
    });
    assert("D1-every-stat-row-in-the-Command-tab's-new-sections-names-its-game-none-names-both-and-the-season-panels-carry-a-Classic-tag-E118", r.ok && bad.length === 0,
      bad.slice(0, 5).join("; ") || "rows labelled, season panels tagged");
  }
})();

/* ---------------------------------------------------------------- 6e. v110 §5 D6 — the Lab tab: method, limits, dated sources

   TabLab ports the kit's vLab (the kit's ui.js 357–375) and backtestHtml (376–392) as four closed sections after
   lab-refresh, and lab-data stays PRIMARY: lab-method (how the numbers are made, the optimiser included), lab-backtest
   (the walk-forward table by position), lab-limits (what the model cannot see) and lab-sources (every source dated, and
   the solve's own provenance). Every expectation below is computed here from MC, PLAN, PRE and the ported engine, with
   formatters written here rather than borrowed from the app, so the two can disagree; and every derived passage is
   proved to move by rendering on a moved block (qa/no_frozen.cjs, E-084; spec §1.7: no typed fact in copy). */
console.log("");
console.log("--- v110 D6 · the Lab tab: method, limits, dated sources ---");
(function () {
  const EN = MCP ? MCP.E : null, MB = MCP ? MCP.MC : null, SP = MCP ? MCP.PLAN : null, PR = MCP ? MCP.PRE : null;
  const BT = MB && MB.model && MB.model.backtest ? MB.model.backtest : null;
  const pl = SP && SP.plan && SP.plan.ok === true && Array.isArray(SP.plan.weeks) && SP.plan.weeks.length ? SP.plan : null;
  if (!assert("D6-the-blocks-carry-the-fitted-ratings-the-backtest-a-solved-plan-and-dated-sources",
    !!(EN && EN.calib && EN.CFG && MB && BT && BT.points && BT.points.byPos && MB.model.calib && pl && PR && MB.intel &&
      Array.isArray(MB.intel.sources) && MB.intel.sources.length && SP.replay && Array.isArray(SP.replay.weeks)),
    "calib " + JSON.stringify(EN && EN.calib) + ", backtest " + !!BT + ", plan " + !!pl + ", sources " +
      (MB && MB.intel && MB.intel.sources ? MB.intel.sources.length : 0))) return;
  const d1 = function (x) { return (x < 0 ? "−" : "") + Math.abs(x).toFixed(1); };
  const d2 = function (x) { return (x < 0 ? "−" : "") + Math.abs(x).toFixed(2); };
  const d3 = function (x) { return Number(x).toFixed(3); };
  const kx = function (x) { return String(Math.round(x * 100) / 100); };
  const pct0 = function (x) { return Math.round(x * 100) + "%"; };
  const pct2 = function (x) { return (x * 100).toFixed(2) + "%"; };
  const n0 = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); };
  const secsT = function (s) { return s < 1 ? "under a second" : Math.round(s) + " s"; };
  const gwList = function (a) { const g = a.map(function (x) { return "GW" + x; }); return g.length < 2 ? g.join("") : g.slice(0, -1).join(", ") + " and " + g[g.length - 1]; };
  const NAMES = { 1: "Goalkeepers", 2: "Defenders", 3: "Midfielders", 4: "Forwards" };
  // SAST computed here (UTC+2 all year), and the same instant written in UTC, so a UTC time on screen is caught
  const stamp = function (iso, h) {
    const t = Date.parse(iso); if (!isFinite(t)) return "?";
    const d = new Date(t + h * 3600000);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()] + " " + d.getUTCDate() + " " +
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()] + " " +
      String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  };
  const sast = function (iso) { return stamp(iso, 2); }, utc = function (iso) { return stamp(iso, 0); };
  const plain = function (html) {
    return String(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;|&#39;/g, "'")
      .replace(/\s+/g, " ").replace(/ ([,.;:])/g, "$1").trim();
  };
  const secOf = function (html, id) { const a = html.indexOf('data-section="' + id + '"'); if (a < 0) return ""; const b = html.indexOf('data-section="', a + 10); return html.slice(a, b < 0 ? html.length : b); };
  const lab = function (open, mc) {
    const o = {}; open.forEach(function (id) { o[id] = true; });
    const p = {}; Object.keys(FIX.TabLab.props).forEach(function (k) { p[k] = FIX.TabLab.props[k]; });
    p.ui = { mode: "full", tab: "lab", open: o, reveals: {} }; p.mc = mc;
    return tryRender("TabLab", p);
  };
  const text = function (id, mc) { const r = lab([id], mc); return r.ok ? plain(secOf(r.html, id)) : "THREW " + (r.err && r.err.message); };
  const miss = function (t, need) { return need.filter(function (s) { return t.indexOf(s) < 0; }).map(function (s) { return "«" + s + "»"; }); };
  const withMC = function (edit) { const m = clone(MB); edit(m); return { MC: m, PLAN: SP, PRE: PR, E: EN }; };
  const byPos = BT.points.byPos, posKeys = Object.keys(byPos).sort();
  const cal = function (M, k) { const c = M.model && M.model.calib ? Number(M.model.calib[k]) : NaN; return isFinite(c) ? c : 1; };
  const corrOf = function (M) {
    const bp = M.model.backtest.points.byPos, ks = Object.keys(bp).sort();
    const corrected = ks.filter(function (k) { return Math.abs(cal(M, k) - 1) > 1e-9; });
    return {
      corrected: corrected, alone: ks.filter(function (k) { return corrected.indexOf(k) < 0; }),
      halfway: corrected.length > 0 && corrected.every(function (k) { return Math.abs(cal(M, k) - (1 + (bp[k].ratio - 1) / 2)) <= 0.0015; }),
      excl: ks.every(function (k) { return (Math.abs(cal(M, k) - 1) > 1e-9) === (bp[k].lo > 1 || bp[k].hi < 1); })
    };
  };

  // (1) first paint: lab-data alone open, the four new sections present, closed and in order after lab-refresh, < 500 words
  {
    const r = lab([], MCP), html = r.ok ? r.html : "";
    const st = {};
    ["lab-data", "lab-method", "lab-backtest", "lab-limits", "lab-sources"].forEach(function (id) {
      const m = new RegExp('data-testid="sec-' + id + '" aria-expanded="(true|false)"').exec(html); st[id] = m ? m[1] : "absent";
    });
    const order = ["lab-data", "lab-refresh", "lab-method", "lab-backtest", "lab-limits", "lab-sources", "lab-tour"].map(function (id) { return html.indexOf('data-section="' + id + '"'); });
    const w = r.ok ? wordsOf(html) : 0;
    assert("D6-first-paint-keeps-lab-data-the-only-open-section-adds-four-closed-sections-in-order-and-stays-under-500-words",
      r.ok && st["lab-data"] === "true" && ["lab-method", "lab-backtest", "lab-limits", "lab-sources"].every(function (id) { return st[id] === "false"; }) &&
        order.every(function (v, i) { return v >= 0 && (i === 0 || v > order[i - 1]); }) && w < 500,
      r.ok ? JSON.stringify(st) + ", section offsets " + order.join(",") + ", " + w + " visible words" : "threw " + (r.err && r.err.message));
  }

  const M0 = text("lab-method", MCP);
  // (2) the team ratings, read from the engine's own fit (E.calib, E.CFG), never typed
  {
    const c = EN.calib, next = MB.gw.next, k = Object.keys((MB.intel.start && MB.intel.start[String(next)]) || {}).length;
    const need = [c.n + " bookmaker-implied numbers from " + gwList(c.weeks), "attack exponent " + kx(c.ka), "defence exponent " + kx(c.kd),
      "typical miss is " + pct0(c.rmse), "worth " + EN.CFG.kShrink + " matches", MB.gw.lastDone + " played gameweek", k + " dated override", "for GW" + next];
    const bad = miss(M0, need);
    assert("D6-lab-method-reads-the-team-ratings-fitted-to-bookmaker-prices-and-the-player-prior-from-the-engine", bad.length === 0, bad.join(", ") + " — " + M0.slice(0, 200));
  }
  // (3) the optimiser: horizon, objective weights, detail, tolerance, time, hash and replay, all from PLAN
  {
    const pa = pl.params || {}, w0 = pl.weeks[0].gw, wN = pl.weeks[pl.weeks.length - 1].gw, rw = SP.replay;
    const need = ["from GW" + w0 + " to GW" + wN, "counts " + pa.decay + " of the week before", "bench counts " + pa.benchW, "a " + pa.tau + "-point friction",
      "worth " + pa.ftValue, "for " + pl.detail + " gameweeks", "Only squad membership is integer", "totally unimodular", "one core",
      "within " + pct2(pl.gap) + " of the best possible in " + Math.round(pl.secs) + " seconds", SP.hash,
      rw.agrees ? "agrees with the solve on all " + rw.weeks.length + " planned weeks" : "differs from the solve on"];
    const bad = miss(M0, need);
    if (/proved within [0-9.]+% of the best possible/.test(M0) === false) bad.push("no tolerance sentence");
    assert("D6-lab-method-states-the-mixed-integer-optimiser-its-tolerance-time-hash-guard-and-replay-from-PLAN", bad.length === 0, bad.join(", "));
  }
  // (4) Draft roster, waiver model and simulation sizes, each labelled with its game
  {
    const dw = SP.draft && Array.isArray(SP.draft.weeks) ? SP.draft.weeks : [], act = MB.draft.activity || {}, runs = (MB.draft.waiverRuns || []).slice().sort(function (a, b) { return a - b; });
    const claims = Object.keys(act).reduce(function (s, t) { return s + (Number(act[t].claims) || 0); }, 0);
    const need = ["Draft roster. Solved the same way to GW" + dw[dw.length - 1], d1(SP.draft.base) + " expected Draft points as the roster stands", d1(SP.draft.value) + " solved",
      d1(SP.draftIfTaken.value) + " if " + SP.draftAhead, "replays the league's own " + claims + " claims from the GW" + runs[0] + " to GW" + runs[runs.length - 1] + " waiver runs",
      "Classic GW" + PR.classicSim.gw + ": " + n0(PR.classicSim.draws) + " runs", "Draft GW" + PR.h2h.gw + " head-to-head: " + n0(PR.h2h.draws) + " runs",
      "Draft claims: " + PR.claims.orderings.length + " lodging orders, " + n0(PR.claims.runs) + " runs each"];
    const bad = miss(M0, need);
    assert("D6-lab-method-states-the-Draft-roster-solve-the-waiver-model-replayed-from-the-league's-own-log-and-the-simulation-sizes", bad.length === 0, bad.join(", "));
  }
  // (5) position corrections "only halfway", computed per position, and the sentence moves when the correction does
  {
    const co = corrOf(MB), bad = [];
    co.corrected.forEach(function (k) { const s = NAMES[k].toLowerCase() + " ×" + d3(cal(MB, k)) + " for an observed " + d2(byPos[k].ratio); if (M0.indexOf(s) < 0) bad.push("«" + s + "»"); });
    co.alone.forEach(function (k) { if (M0.indexOf(NAMES[k].toLowerCase()) < 0) bad.push("no " + NAMES[k]); });
    if (co.alone.length && M0.indexOf("left alone") < 0) bad.push("no 'left alone'");
    if (co.halfway !== (M0.indexOf("only halfway") >= 0)) bad.push("halfway " + co.halfway + " but the copy " + (co.halfway ? "does not say" : "says") + " so");
    if (co.excl !== (M0.indexOf("only where the 90% range excludes 1") >= 0)) bad.push("range rule " + co.excl + " disagrees with the copy");
    // moved: the first corrected position takes its whole observed gap, so the correction is no longer halfway
    const k0 = co.corrected[0];
    const mv = k0 ? withMC(function (m) { m.model.calib[k0] = Number(d3(m.model.backtest.points.byPos[k0].ratio)); }) : null;
    const M1 = mv ? text("lab-method", mv) : "";
    if (k0) {
      if (M1.indexOf("only halfway") >= 0) bad.push("a full-gap correction still reads 'only halfway'");
      if (M1.indexOf(NAMES[k0].toLowerCase() + " ×" + d3(mv.MC.model.calib[k0])) < 0) bad.push("the moved correction ×" + d3(mv.MC.model.calib[k0]) + " is not shown");
    } else bad.push("no corrected position to move");
    assert("D6-lab-method-names-each-position-correction-against-its-observed-ratio-says-halfway-only-when-it-is-and-moves-with-the-block", bad.length === 0,
      bad.join("; ") || co.corrected.map(function (k) { return NAMES[k] + " ×" + d3(cal(MB, k)); }).join(", "));
  }

  // (6) the backtest table, one row per position in each of its three tables, and the Brier and goals lines
  const B0 = text("lab-backtest", MCP);
  const rowT = function (M, k) {
    const x = M.model.backtest.points.byPos[k], c = cal(M, k);
    return [NAMES[k] + " " + x.n + " " + d1(x.meanPred) + " " + d1(x.meanAct),
      NAMES[k] + " " + d2(x.ratio) + " (" + d2(x.lo) + "–" + d2(x.hi) + ") " + (Math.abs(c - 1) > 1e-9 ? "×" + d3(c) : "none"),
      NAMES[k] + " " + d2(x.rho) + " / " + d2(x.rhoNaive) + " " + d1(x.mae) + " / " + d1(x.maeNaive)];
  };
  {
    const bad = [];
    posKeys.forEach(function (k) { bad.push.apply(bad, miss(B0, rowT(MB, k))); });
    const mi = BT.minutes, go = BT.goals, all = BT.points.all;
    const band = Math.round(100 * Math.max.apply(null, mi.buckets.filter(function (b) { return b.n > 0; }).map(function (b) { return Math.abs(b.pred - b.act); })));
    bad.push.apply(bad, miss(B0, [gwList(BT.weeks), "Brier score " + d3(mi.brier) + " against " + d3(mi.brierNaive), "over " + n0(mi.n) + " player-weeks",
      "within " + band + " points of the observed rate in every band", "log-likelihood " + d1(go.logLik) + " against " + d1(go.logLikNaive), "over " + go.n + " matches",
      "rank correlation " + d2(all.rho) + " against " + d2(all.rhoNaive) + " naive over " + n0(all.n) + " starts"]));
    assert("D6-lab-backtest-shows-starts-forecast-actual-ratio-and-range-rank-correlation-error-and-correction-for-every-position", bad.length === 0,
      bad.slice(0, 6).join(", ") || posKeys.length + " positions");
  }
  {
    const k = posKeys[1] || posKeys[0];
    const mv = withMC(function (m) { const x = m.model.backtest.points.byPos[k]; x.n += 11; x.meanAct += 0.5; x.rho = -0.2; m.model.backtest.minutes.brier = 0.2; });
    const B1 = text("lab-backtest", mv), was = rowT(MB, k), now = rowT(mv.MC, k);
    const bad = miss(B1, [now[0], now[2], "Brier score " + d3(0.2)]);
    if (B1.indexOf(was[0]) >= 0) bad.push("the old row «" + was[0] + "» is still drawn");
    assert("D6-lab-backtest-moves-with-the-block", bad.length === 0, bad.join(", ") || now[0]);
  }

  // (7) what it cannot see, each line computed: played weeks, the deadline in SAST, coverage per gameweek, the horizons
  const L0 = text("lab-limits", MCP);
  const coverOf = function (M) {
    const O = (M.intel && M.intel.odds) || {};
    return Object.keys(O).map(Number).filter(function (g) { return g >= M.gw.next; }).sort(function (a, b) { return a - b; }).map(function (g) {
      const fx = M.fixtures.filter(function (f) { return f.gw === g; });
      const have = (O[g] || O[String(g)] || []).filter(function (r) { return fx.some(function (f) { return f.h === r[0] && f.a === r[1]; }); }).length;
      return { g: g, have: have, all: fx.length };
    }).filter(function (c) { return c.have > 0; });
  };
  {
    const ev = (MB.gw.events || []).filter(function (e) { return e.id === MB.gw.next; })[0] || {};
    const cov = coverOf(MB), last = cov.length ? cov[cov.length - 1].g : MB.gw.next - 1;
    const need = cov.map(function (c) { return "GW" + c.g + " (" + c.have + " of " + c.all + " matches)"; }).concat([
      "A sample of " + MB.gw.lastDone + " played gameweek", "team for GW" + MB.gw.next + " stays private until its deadline, " + sast(ev.dl) + " SAST",
      "last published team, GW" + MB.gw.lastDone, "From GW" + (last + 1) + " the team ratings carry the fixtures", "GW" + pl.weeks[pl.weeks.length - 1].gw + " in Classic",
      "GW" + EN.CFG.draftEnd + " in Draft", "fixed when it is built, " + sast(PR.at) + " SAST", "Rivals' Draft elevens publish only after each deadline"]);
    const bad = miss(L0, need);
    if (L0.indexOf(utc(ev.dl)) >= 0) bad.push("the deadline is also shown in UTC");
    assert("D6-lab-limits-computes-each-line-from-the-block-played-weeks-the-SAST-deadline-bookmaker-coverage-and-both-horizons", bad.length === 0, bad.join(", ") + " — " + L0.slice(0, 160));
  }
  {
    const next = MB.gw.next;
    const mv = withMC(function (m) { const k = String(next); m.intel.odds[k] = (m.intel.odds[k] || []).slice(3); m.gw.lastDone += 1; });
    const L1 = text("lab-limits", mv), c1 = coverOf(mv.MC).filter(function (c) { return c.g === next; })[0];
    const bad = miss(L1, [c1 ? "GW" + next + " (" + c1.have + " of " + c1.all + " matches)" : "GW" + next + " no longer priced", "A sample of " + mv.MC.gw.lastDone + " played gameweek"]);
    assert("D6-lab-limits-moves-with-the-bookmaker-coverage-and-the-played-weeks", bad.length === 0, bad.join(", "));
  }

  // (8) the sources, dated in SAST, and the solve's provenance, every line naming its game
  {
    const r = lab(["lab-sources"], MCP), html = r.ok ? secOf(r.html, "lab-sources") : "", S0 = plain(html);
    const tm = SP.timing || {};
    // a source's own note may quote a UTC time ("pulled 26 Sep 17:15Z"): on screen it must read in SAST, moved here with its date
    const yr = new Date(Date.parse(MB.intel.asOf || MB.asOf)).getUTCFullYear(), MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const toSast = function (s) {
      return s.replace(/(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}):(\d{2}) ?(?:Z|UTC)\b/g, function (a, dd, mo, h, mi) {
        const x = new Date(Date.UTC(yr, MONS.indexOf(mo), +dd, +h + 2, +mi));
        return x.getUTCDate() + " " + MONS[x.getUTCMonth()] + " " + String(x.getUTCHours()).padStart(2, "0") + ":" + String(x.getUTCMinutes()).padStart(2, "0") + " SAST";
      });
    };
    const need = MB.intel.sources.map(function (s) { return plain(toSast(String(s))); }).concat([
      "feeds, pulled " + sast(MB.asOf) + " SAST", "Desk research, dated " + sast(MB.intel.asOf) + " SAST", "fitted " + sast(MB.model.at) + " SAST",
      "This build " + sast(PR.at) + " SAST", "content hash " + PR.hash, "Classic plan: solved " + sast(SP.at) + " SAST",
      "within " + pct2(pl.gap) + " in " + secsT(pl.secs), "Classic wildcard timing, solved " + sast(tm.at) + " SAST"]);
    ["noWildcard", "undecayed"].forEach(function (k) { if (SP[k] && SP[k].ok) need.push("within " + pct2(SP[k].gap) + " in " + secsT(SP[k].secs)); });
    ["now", "later", "never"].forEach(function (k) { if (tm[k] && tm[k].ok) need.push(k + " within " + pct2(tm[k].gap) + " in " + secsT(tm[k].secs)); });
    if (SP.draft && SP.draft.ok) need.push("Draft roster: solved in " + secsT(SP.draft.secs));
    const bad = miss(S0, need);
    [MB.asOf, MB.intel.asOf, SP.at, PR.at].forEach(function (iso) { if (S0.indexOf(utc(iso)) >= 0) bad.push(utc(iso) + " shown in UTC"); });
    const zq = S0.match(/\d{1,2}:\d{2} ?(?:Z|UTC)\b/g);
    if (zq) bad.push("UTC time on screen: " + zq.join(", "));
    assert("D6-lab-sources-lists-every-dated-source-and-the-solve's-own-timings-and-tolerances-in-SAST", r.ok && bad.length === 0, bad.slice(0, 6).join(", "));
    const lis = []; const ul = /data-testid="lab-solve-list"[\s\S]*?<\/ul>/.exec(html); let m;
    const LI = /<li>([\s\S]*?)<\/li>/g; while (ul && (m = LI.exec(ul[0]))) lis.push(plain(m[1]));
    const unl = lis.filter(function (t) { return !/^(Classic|Draft)\b/.test(t) || (/\bClassic\b/.test(t) && /\bDraft\b/.test(t)); });
    assert("D6-every-solve-provenance-line-names-its-game-and-none-names-both", lis.length >= 3 && unl.length === 0, lis.length + " lines; " + unl.join(" | "));
  }

  // (9) the guards, in words: another hash sets the plan aside; a replay that disagrees says the replay is shown
  {
    const bad = [];
    const hx = { MC: MB, PLAN: SP, PRE: Object.assign({}, PR, { hash: "0000000000000000" }), E: EN };
    const Mh = text("lab-method", hx), Sh = text("lab-sources", hx);
    if (Mh.indexOf("so the solved plan is set aside") < 0) bad.push("method does not set the plan aside on another hash");
    if (Sh.indexOf("the solved plan's is " + SP.hash) < 0) bad.push("sources do not name both hashes");
    const rp = clone(SP); rp.replay.agrees = false; rp.replay.differences = [{ gw: pl.weeks[0].gw }];
    const Mr = text("lab-method", { MC: MB, PLAN: rp, PRE: PR, E: EN });
    if (Mr.indexOf("differs from the solve on 1 of " + rp.replay.weeks.length + " planned weeks, and the replay is what is shown") < 0) bad.push("a disagreeing replay is not reported");
    assert("D6-lab-method-says-the-plan-is-set-aside-on-another-hash-and-that-the-replay-is-shown-when-it-disagrees", bad.length === 0, bad.join("; "));
  }
  // (10) degraded: no solved plan still explains the model; no mc at all still renders every section with one honest line
  {
    const bad = [];
    const Mn = text("lab-method", MCP_NOPLAN), Sn = text("lab-sources", MCP_NOPLAN);
    if (Mn.indexOf(EN.calib.n + " bookmaker-implied numbers") < 0) bad.push("no ratings without a plan");
    if (Mn.indexOf("No solved Classic plan is in this build") < 0) bad.push("no 'no solved plan' line");
    if (Sn.indexOf("feeds, pulled " + sast(MB.asOf) + " SAST") < 0) bad.push("sources lost the feeds without a plan");
    ["lab-method", "lab-backtest", "lab-limits", "lab-sources"].forEach(function (id) {
      const t = text(id, null);
      if (/^THREW/.test(t)) bad.push(id + " threw with no mc: " + t);
      else if (t.indexOf("not in this build") < 0) bad.push(id + " says nothing with no mc");
    });
    assert("D6-the-lab-sections-degrade-to-one-honest-line-with-no-solved-plan-or-no-engine", bad.length === 0, bad.join("; "));
  }
})();

// ---------------------------------------------------------------- 7. pass B — degraded contexts

console.log("");
console.log("--- pass B · degraded but legal contexts ---");

const CTX_COMPONENTS = ["BlockNote", "Guard", "GwActionCard", "Header", "TabCommand", "MoveList",
  "TabPlan", "TabSquad", "TabRivals", "TabDraft", "TabChips", "TabOdds", "TabReview", "TabLab"];

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

/* v110 D2: the solved plan's own degraded world, a PLAN block with no plan in it, on every degraded context. The panel
   says the plan is not solved for this data, except in the blocked world, where the D3 block comes first. */
DEGRADED.forEach(function (d) {
  const p = {};
  Object.keys(FIX.TabPlan.props).forEach(function (k) { p[k] = FIX.TabPlan.props[k]; });
  p.ctx = d.ctx; p.plan = F("buildPlan")(d.ctx, false); p.mc = MCP_NOPLAN;
  p.ui = { mode: "full", tab: "plan", open: {}, reveals: {} };
  const c = tally("TabPlan");
  c.b++;
  const r = tryRender("TabPlan", p);
  const txt = r.ok ? visibleText(r.html) : "";
  const blocked = !!(d.ctx && d.ctx.block && d.ctx.block.block);
  const bad = [];
  if (!r.ok) bad.push("threw " + (r.err && r.err.message));
  else if (blocked ? !/differ/.test(txt) : !/not solved for this data/.test(txt)) bad.push(blocked ? "no D3 block" : "no 'not solved for this data' note");
  if (r.ok && residues(r.html).length) bad.push(residues(r.html).join(","));
  if (bad.length) c.bFail++;
  assert("B-TabPlan-with-no-solved-plan-says-so-" + d.key, bad.length === 0, bad.join(" · ") || txt.slice(0, 120));
});

/* v110 D3: the Draft tab's own degraded worlds, on every degraded context: a PRE block with no claims sheet and no trades
   in it, and no PRE at all. The waiver paragraph still names the order and the settle time, the claims and trades panels
   say the sheet is not in this build's data, and nothing leaks. */
DEGRADED.forEach(function (d) {
  [{ key: "no-claims", pre: MCP && MCP.PRE ? { hash: MCP.PRE.hash } : null }, { key: "no-PRE", pre: null }].forEach(function (v) {
    const p = {};
    Object.keys(FIX.TabDraft.props).forEach(function (k) { p[k] = FIX.TabDraft.props[k]; });
    p.ctx = d.ctx; p.state = d.state; p.mc = MCP ? { MC: MCP.MC, PLAN: MCP.PLAN, PRE: v.pre, E: MCP.E } : null;
    p.ui = { mode: "full", tab: "draft", open: { "df-trades": true }, reveals: {} };
    const c = tally("TabDraft");
    c.b++;
    const r = tryRender("TabDraft", p);
    const txt = r.ok ? visibleText(r.html).replace(/&#x27;|&#39;/g, "'") : "";
    const bad = [];
    if (!r.ok) bad.push("threw " + (r.err && r.err.message));
    else {
      if ((txt.match(/not in this build's data/g) || []).length < 2) bad.push("the claims and trades panels do not both say the sheet is not in this build's data");
      if (!/every move is a claim|have settled/.test(txt)) bad.push("no waiver paragraph");
      if (/data-testid="df-sheet"/.test(r.html)) bad.push("a sheet was drawn from nothing");
      if (residues(r.html).length) bad.push(residues(r.html).join(","));
    }
    if (bad.length) c.bFail++;
    assert("B-TabDraft-with-" + v.key + "-says-so-" + d.key, bad.length === 0, bad.join(" · ") || txt.slice(0, 120));
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

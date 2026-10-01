#!/usr/bin/env node
/*
 * qa/mc_separation.cjs — the two games never mix (v110 §1.1, fpl/CLAUDE.md Part N3; §5 E1 "separation";
 * the kit's qa.js group 5, lines 89–93, and its line 273, "the two games are labelled").
 *
 *   node qa/mc_separation.cjs
 *
 * WHAT IT PROVES
 *   On the page. The landing card (GwActionCard) and the Command, Plan and Draft tabs are rendered through
 *   react-dom/server from the assembled app (app/FPL_Mission_Control.jsx), twice each: at first paint, and with
 *   every section and every reveal open (so nothing behind a closed Section escapes the scan). Then:
 *     · the Classic season total plus the Draft points-for — read from the baked block and from the live block,
 *       both pairs — appears nowhere in the visible text or in an aria-label or title, in any grouping;
 *     · every strip stat (a cell of a `.pstrip` or `.strip`) is labelled with exactly one game: by its own text,
 *       by the nearest block heading above it inside its section, or by the tab it sits on — and no cell names the
 *       other game; at least one strip is found, so the check cannot pass on an empty page;
 *     · no stat row (`.kv`) or strip cell names both games at once;
 *     · across the four surfaces both games are named (the kit's "labelled everywhere", line 273).
 *   In the engine.
 *     · the Draft horizon is independent of the Classic one: moving the chip stop leaves the Draft horizon where it
 *       was, and moving the re-draft leaves the Classic horizon (kit 91, made a test that can fail);
 *     · the Draft search reads nothing of the Classic game: with the Classic bank, selling prices, free transfers
 *       and published squad all changed, the Draft moves, the rivals' modelled claims and the claims sheet are the
 *       same to the last digit (kit 92, which asserted only that a gain existed);
 *     · the Classic search reads nothing of the Draft game: with every Draft roster moved to another team, the
 *       ownership rewritten and the waiver phase flipped, the greedy transfers and the gameweek simulation are the
 *       same to the last digit;
 *     · every precomputed result (data/pre.json) carries the one game it belongs to, and the review keeps the two
 *       apart.
 *
 * HOW THE APP IS LOADED
 *   As qa/components.cjs loads it (the same esbuild transform, epilogue and real react-dom/server), with the MC
 *   ENGINE block skipped by the function scan (E-123). The props are the same shape components.cjs builds:
 *   state/kwezi.json through sanitiseState and buildCtx, the Classic plan from buildPlan, and mc = { MC, PLAN, PRE,
 *   E } with E = MCEngine.create(MC), as App makes it. The clock is the baked block's own asOf, not a typed date.
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   The sum is computed from the blocks at run time; no total, no points-for and no gameweek is typed here.
 *
 * MUTATIONS
 *   The sum scan is re-run on a copy of the Command markup with a planted "Season points" row carrying the sum,
 *   and the strip check on a copy of the Plan markup with its game tag removed. Both must go red; the red lines
 *   are quoted (E-070).
 *
 * PRIVACY
 *   Draft entries appear as team names only. Nothing here reads or prints a manager's personal name.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "app", "FPL_Mission_Control.jsx");
const ENG = require(path.join(ROOT, "src", "mc_engine.js"));
const AN = require(path.join(ROOT, "src", "mc_analysis.js"));

let pass = 0, fail = 0;
const ok = (name, cond, detail, show) => {
  if (cond) { pass++; console.log("PASS " + name + (show && detail ? " — " + detail : "")); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const redLine = (name, cond, detail) => (cond ? null : "RED " + name + (detail ? " — " + detail : ""));
const finish = () => { console.log("SUITE mc_separation " + pass + "/" + (pass + fail)); process.exit(fail ? 1 : 0); };
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (e) { return null; } };
const clone = (o) => JSON.parse(JSON.stringify(o));

const MC = readJson("data/mc_data.json"), PLAN = readJson("data/plan.json"), PRE = readJson("data/pre.json");
ok("the baked block, the solved plan and the precomputed results are readable", !!MC && !!PLAN && !!PRE, [!!MC, !!PLAN, !!PRE].join(","));
if (!MC || !PLAN || !PRE) finish();

/* ================================================================ 1. the page */

/* ---- the loader: qa/components.cjs's, verbatim in what it does ---- */
let esbuild = null;
try { esbuild = require(path.join(ROOT, "node_modules", "esbuild")); } catch (e) { /* reported below */ }
ok("the assembled app and esbuild are present (run `node build.cjs` if the app is missing)", fs.existsSync(APP) && !!esbuild, "app " + fs.existsSync(APP) + " esbuild " + !!esbuild);
if (!fs.existsSync(APP) || !esbuild) finish();
const NOW = MC.asOf;
const SRC = fs.readFileSync(APP, "utf8");
const FN_NAMES = [];
const DECL = /^(?:export\s+default\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const SCAN_SRC = SRC.replace(/\/\/ MC ENGINE — START[\s\S]*?\/\/ MC ENGINE — END/, "");   // E-123
let mm; while ((mm = DECL.exec(SCAN_SRC))) FN_NAMES.push(mm[1]);
const EPILOGUE = "\nmodule.exports.__FNS__ = {" +
  FN_NAMES.map(function (n) { return JSON.stringify(n) + ": (typeof " + n + " === \"function\" ? " + n + " : null)"; }).join(",") +
  "};\nmodule.exports.__LIVE__ = (typeof LIVE !== \"undefined\" ? LIVE : null);\n" +
  "module.exports.__MC__ = { MC: (typeof MC !== \"undefined\" ? MC : null), PLAN: (typeof PLAN !== \"undefined\" ? PLAN : null)," +
  " PRE: (typeof PRE !== \"undefined\" ? PRE : null), MCEngine: (typeof MCEngine !== \"undefined\" ? MCEngine : null) };\n" +
  "module.exports.__TABS__ = (typeof TABS !== \"undefined\" ? TABS : null);\n";
global.window = global.window || { __NOW__: NOW };
try { Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: function () { return Promise.resolve(); } } }, configurable: true, writable: true, enumerable: true }); } catch (e) { /* not needed by these four */ }
let MOD = { exports: {} }, loadErr = "";
try {
  const CODE = esbuild.transformSync(SRC + EPILOGUE, { loader: "jsx", jsx: "transform", format: "cjs", target: "node22" }).code;
  new Function("require", "module", "exports", CODE)(Module.createRequire(path.join(ROOT, "package.json")), MOD, MOD.exports);
} catch (e) { loadErr = e && e.message ? e.message.split("\n")[0] : String(e); }
const appRequire = Module.createRequire(path.join(ROOT, "package.json"));
const React = appRequire("react"), RDS = appRequire("react-dom/server");
const FNS = MOD.exports.__FNS__ || {}, B = MOD.exports.__MC__ || {}, LIVE = MOD.exports.__LIVE__, TABS = MOD.exports.__TABS__ || [];
const NEED = ["GwActionCard", "TabCommand", "TabPlan", "TabDraft", "TabSquad", "TabRivals", "TabChips", "buildPlan", "buildCtx", "sanitiseState"];
ok("the assembled app evaluates under the real React and exposes the seven surfaces and their props builders",
  !loadErr && NEED.every((n) => typeof FNS[n] === "function") && !!LIVE && !!B.MC && !!B.MCEngine, loadErr || NEED.filter((n) => typeof FNS[n] !== "function").join(","));
if (loadErr || !NEED.every((n) => typeof FNS[n] === "function") || !B.MCEngine) finish();

/* ---- props, as components.cjs builds them ---- */
const noop = function () {};
const ON = { sec: noop, rev: noop, market: noop };
const STATE = FNS.sanitiseState(JSON.parse(fs.readFileSync(path.join(ROOT, "state", "kwezi.json"), "utf8")));
const CTX = FNS.buildCtx(LIVE, STATE, NOW);
const PLAN_C = FNS.buildPlan(CTX, false);
const MCP = { MC: B.MC, PLAN: B.PLAN, PRE: B.PRE, E: B.MCEngine.create(B.MC) };
const allOpenExcept = (skip) => new Proxy({}, { get: (t, k) => (k === "toJSON" ? undefined : skip.indexOf(k) < 0), has: () => true, ownKeys: () => [] });
const ui = (tab, open) => (open ? { mode: "full", tab: tab, open: allOpenExcept(["wc-lock"]), reveals: allOpenExcept(["wc-lock"]) } : { mode: "simple", tab: tab, open: {}, reveals: {} });
const SURFACES = [
  { name: "landing card", tab: null, el: "GwActionCard", props: (o) => ({ plan: PLAN_C, ctx: CTX, mode: o ? "full" : "simple", reveals: o ? allOpenExcept([]) : {}, onReveal: noop, onConfirm: noop, mc: MCP }) },
  { name: "Command tab", tab: "command", el: "TabCommand", props: (o) => ({ ctx: CTX, ui: ui("command", o), on: ON, mc: MCP }) },
  { name: "Plan tab", tab: "plan", el: "TabPlan", props: (o) => ({ ctx: CTX, ui: ui("plan", o), on: ON, plan: PLAN_C, onConfirm: noop, mc: MCP }) },
  { name: "Draft tab", tab: "draft", el: "TabDraft", props: (o) => ({ ctx: CTX, ui: ui("draft", o), on: ON, state: STATE, onLeague: noop, mc: MCP }) },
  /* Audit F-06: the three Classic-only tabs are rendered too, so the unlabelled count is armed over them as well. */
  { name: "Squad tab", tab: "squad", el: "TabSquad", props: (o) => ({ ctx: CTX, ui: ui("squad", o), on: ON, onConfirm: noop, mc: MCP }) },
  { name: "Rivals tab", tab: "rivals", el: "TabRivals", props: (o) => ({ ctx: CTX, ui: ui("rivals", o), on: ON, plan: PLAN_C, simLeague: 0, onSimLeague: noop, onConfirm: noop, mc: MCP }) },
  { name: "Chips tab", tab: "chips", el: "TabChips", props: (o) => ({ ctx: CTX, ui: ui("chips", o), on: ON, plan: PLAN_C, onConfirm: noop, mc: MCP }) }
];
const RENDERS = [];
SURFACES.forEach((s) => [false, true].forEach((o) => {
  let html = null, err = "";
  try { html = RDS.renderToStaticMarkup(React.createElement(FNS[s.el], s.props(o))); } catch (e) { err = e.message; }
  RENDERS.push({ s: s, open: o, label: s.name + (o ? ", everything open" : ", first paint"), html: html, err: err });
}));
const broken = RENDERS.filter((r) => !r.html);
ok("the seven surfaces render at first paint and with everything open (" + RENDERS.length + " renders, " + RENDERS.reduce((a, r) => a + (r.html ? r.html.length : 0), 0) + " characters)",
  broken.length === 0, broken.map((r) => r.label + ": " + r.err).join("; "));

/* ---- a small HTML reader for react-dom/server's well-formed output ---- */
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;|&#160;/g, " ");
function parse(html) {
  const root = { tag: "#root", attrs: {}, kids: [], parent: null }; let cur = root, m;
  const RE = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^\s=>\/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  while ((m = RE.exec(html))) {
    if (m[1]) { let n = cur; while (n && n.tag !== m[1].toLowerCase()) n = n.parent; if (n && n.parent) cur = n.parent; continue; }
    if (m[2]) {
      const attrs = {}; let a; const AR = /([^\s=]+)(?:="([^"]*)")?/g; while ((a = AR.exec(m[3] || ""))) attrs[a[1]] = decode(a[2] || "");
      const el = { tag: m[2].toLowerCase(), attrs: attrs, kids: [], parent: cur }; cur.kids.push(el);
      if (!m[4] && !VOID.has(el.tag)) cur = el; continue;
    }
    if (m[5] && cur.tag !== "style") cur.kids.push({ text: decode(m[5]), parent: cur });
  }
  return root;
}
const isEl = (n) => !!n && !!n.tag;
const cls = (n) => (isEl(n) && n.attrs.class ? n.attrs.class.split(/\s+/) : []);
const textOf = (n) => (n.text != null ? n.text : n.tag === "style" ? "" : n.kids.map(textOf).join(" ")).replace(/\s+/g, " ").trim();
const all = (n, pred, out) => { out = out || []; if (isEl(n)) { if (pred(n)) out.push(n); n.kids.forEach((k) => all(k, pred, out)); } return out; };
const GAME_RE = /\b(Classic|Draft)\b/g;
const gamesIn = (s) => { const g = new Set(); let x; GAME_RE.lastIndex = 0; while ((x = GAME_RE.exec(s))) g.add(x[1]); return g; };
const visible = (html) => textOf(parse(html));
const readable = (html) => { const r = parse(html), extra = all(r, (n) => !!(n.attrs["aria-label"] || n.attrs.title)).map((n) => (n.attrs["aria-label"] || "") + " " + (n.attrs.title || "")); return textOf(r) + " " + extra.join(" "); };

/* ---- the sum, from both blocks ---- */
const draftPf = (() => { const s = MC.draft.standings.find((x) => x.name === MC.draft.me); return s ? s.pf : null; })();
const livePf = (() => {
  const d = LIVE.draft || {}, e = (d.entries || []).find((x) => x.name === MC.draft.me);
  const s = e && (d.standings || []).find((x) => x.leagueEntry === e.leagueEntryId); return s ? s.pointsFor : null;
})();
const liveTotal = LIVE.entry ? LIVE.entry.summary_overall_points : null;
const SUMS = [...new Set([MC.classic.total + draftPf, liveTotal != null && livePf != null ? liveTotal + livePf : null].filter((x) => typeof x === "number" && isFinite(x)))];
const numRe = (n) => { const s = String(n), grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, "[ ,  ]?"); return new RegExp("(?<![\\d.,£])" + grouped + "(?![\\d]|[.,]\\d)"); };
const sumHits = (text) => SUMS.filter((n) => numRe(n).test(text));
const N_SUM = (label) => "the Classic season total plus the Draft points-for (" + SUMS.join(" and ") + ") appears nowhere on the " + label;
ok("the sum to look for is computed from the blocks: Classic " + MC.classic.total + " + Draft " + draftPf + (liveTotal != null ? ", and live Classic " + liveTotal + " + Draft " + livePf : ""),
  SUMS.length > 0 && draftPf != null, "");
RENDERS.filter((r) => r.html).forEach((r) => { const h = sumHits(readable(r.html)); ok(N_SUM(r.label), h.length === 0, "found " + h.join(",")); });

/* ---- strip stats: each labelled with exactly one game ---- */
function tabGame(tab) { const t = TABS.find((x) => x.id === tab); return t ? gamesIn((t.label || "") + " " + (t.aria || "")) : new Set(); }
/* The label a node inherits: the nearest block heading above it, walking up through its ancestors and reading the
   siblings that come before at each level, stopping at the section boundary (its title counts, the sections
   around it do not); failing that, a data-game attribute on the way up; failing that, the tab it sits on. */
function labelOf(node, tab) {
  let n = node;
  while (n && n.parent) {
    const p = n.parent, before = p.kids.slice(0, p.kids.indexOf(n));
    const g = gamesIn(before.map(textOf).join(" "));
    if (g.size) return { games: g, by: "heading" };
    if (isEl(p) && p.attrs["data-game"]) return { games: gamesIn(p.attrs["data-game"].replace(/^./, (c) => c.toUpperCase())), by: "data-game" };
    if (cls(p).indexOf("section") >= 0) break;
    n = p;
  }
  const t = tabGame(tab); return { games: t, by: t.size ? "tab" : "none" };
}
function stripReport(html, tab) {
  const root = parse(html), strips = all(root, (n) => cls(n).some((c) => c === "pstrip" || c === "strip")), bad = [], seen = [];
  strips.forEach((s) => {
    const own = gamesIn(textOf(s)), ctx = labelOf(s, tab), label = own.size === 1 ? own : ctx.games;
    const cells = s.kids.filter(isEl);
    seen.push((s.attrs["data-testid"] || "strip") + " " + cells.length + " cells → " + ([...label].join("+") || "no game") + " (" + (own.size === 1 ? "own text" : ctx.by) + ")");
    if (label.size !== 1) bad.push((s.attrs["data-testid"] || "strip") + ": " + (label.size ? "both games" : "no game label"));
    cells.forEach((c) => { const g = gamesIn(textOf(c)); if (g.size > 1 || (g.size === 1 && label.size === 1 && !g.has([...label][0]))) bad.push("cell '" + textOf(c).slice(0, 40) + "' names " + [...g].join("+")); });
  });
  return { strips: strips.length, seen: seen, bad: bad };
}
const N_STRIP = (label) => "every strip stat on the " + label + " is labelled with exactly one game";
let stripsFound = 0;
RENDERS.filter((r) => r.html).forEach((r) => {
  const s = stripReport(r.html, r.s.tab); stripsFound += s.strips;
  ok(N_STRIP(r.label) + " (" + (s.strips ? s.seen.join("; ") : "no strip on this surface") + ")", s.bad.length === 0, s.bad.join("; "));
});
ok("the strip check is not vacuous: " + stripsFound + " strips were found across the renders", stripsFound > 0, "no .pstrip or .strip rendered anywhere");

/* ---- stat rows: never both games; and both games are named across the page ---- */
{
  let rows = 0; const unlabelled = { first: 0, open: 0 }, both = [], names = new Set();
  RENDERS.filter((r) => r.html).forEach((r) => {
    const root = parse(r.html); gamesIn(textOf(root)).forEach((g) => names.add(g));
    all(root, (n) => cls(n).indexOf("kv") >= 0 || cls(n).indexOf("pst") >= 0).forEach((n) => {
      rows++; const t = textOf(n), g = gamesIn(t);
      if (g.size > 1) both.push(r.label + ": '" + t.slice(0, 50) + "'");
      if (/\d/.test(t) && g.size === 0 && labelOf(n, r.s.tab).games.size === 0) unlabelled[r.open ? "open" : "first"]++;
    });
  });
  ok("no stat row or strip cell names both games at once (" + rows + " rows over the renders; rows that carry a number and no game label in their row, block or tab: " + unlabelled.first + " at first paint, " + unlabelled.open + " with everything open — ERRORS.md E-118)", both.length === 0, both.join("; "));
  /* E-118 armed: every stat row carrying a number resolves to a game by its own text, a heading above it inside its
     section, a data-game attribute or the tab it sits on. The count reached zero when the Plan tab's six older sections
     each gained a Classic line; from now on a row that loses its game fails the suite instead of only being printed. */
  ok("every stat row that carries a number names its game: " + unlabelled.first + " unlabelled at first paint and " + unlabelled.open + " with everything open (E-118, armed)", unlabelled.first === 0 && unlabelled.open === 0, unlabelled.first + " at first paint, " + unlabelled.open + " with everything open");
  ok("both games are named across the four surfaces (" + [...names].join(" and ") + ")", names.has("Classic") && names.has("Draft"), [...names].join(","));
}

/* ---- mutations ---- */
{
  const cmd = RENDERS.find((r) => r.s.el === "TabCommand" && !r.open), planted = cmd.html.replace("</div>", "<div class=\"kv\"><span class=\"k\">Season points</span><span class=\"v\">" + SUMS[0] + "</span></div></div>");
  const h = sumHits(readable(planted)), line = redLine(N_SUM(cmd.label), h.length === 0, "found " + h.join(","));
  ok("mutation: a planted row showing the sum turns the sum scan red", line !== null, line ? "red: " + line : "the scan stayed green", true);
  const plan = RENDERS.find((r) => r.s.el === "TabPlan" && !r.open);
  const untagged = plan.html.replace(/<span class="tag tag-s">Classic<\/span>/g, "<span class=\"tag tag-s\"></span>").replace(/\bClassic\b/g, "the");
  const s = stripReport(untagged, "plan"), line2 = redLine(N_STRIP(plan.label), s.bad.length === 0, s.bad.join("; "));
  ok("mutation: the Plan strip with its game label removed turns the strip check red", s.strips > 0 && line2 !== null, line2 ? "red: " + line2 : "the check stayed green", true);
}

/* ================================================================ 2. the engine */
const M = ENG.create(MC), next = MC.gw.next;
{
  const a = clone(MC); a.rules.chipStop = MC.rules.chipStop - 1;
  const b = clone(MC); if (b.draft.league.redraft) b.draft.league.redraft.fromGw = MC.draft.league.redraft.fromGw + 2;
  const Ma = ENG.create(a), Mb = ENG.create(b);
  ok("the Draft horizon is independent of the Classic one: a chip stop one earlier leaves Draft at GW" + Ma.CFG.draftEnd + ", a re-draft two later leaves Classic at GW" + Mb.CFG.classicEnd,
    Ma.CFG.draftEnd === M.CFG.draftEnd && Ma.CFG.classicEnd === M.CFG.classicEnd - 1 && Mb.CFG.classicEnd === M.CFG.classicEnd && (!MC.draft.league.redraft || Mb.CFG.draftEnd === M.CFG.draftEnd + 2),
    "Draft " + M.CFG.draftEnd + "/" + Ma.CFG.draftEnd + "/" + Mb.CFG.draftEnd + " Classic " + M.CFG.classicEnd + "/" + Ma.CFG.classicEnd + "/" + Mb.CFG.classicEnd);
}
const pack = (mv) => mv.map((m) => m.add.id + ">" + m.drop.id + ":" + m.gain + ":" + m.gainNext).join("|");
{
  /* Everything Classic changes: bank, selling prices, free transfers, the published squad (its eleven reversed). */
  const c = clone(MC), last = c.classic.gws[c.classic.gws.length - 1];
  c.classic.gws.forEach((g) => { g.bank = g.bank + 5; }); Object.keys(c.classic.sell).forEach((k) => { c.classic.sell[k].sell += 1; });
  c.classic.ftNext = 1; c.classic.ftSure = !c.classic.ftSure; last.picks = last.picks.slice().reverse().map((k, i) => Object.assign({}, k, { pos: i + 1 }));
  const Mc = ENG.create(c), dEnd = M.CFG.draftEnd;
  const same = pack(M.draftMoves(M.draftRoster(), next, dEnd, { perPos: 4 })) === pack(Mc.draftMoves(Mc.draftRoster(), next, dEnd, { perPos: 4 }))
    && JSON.stringify(M.rivalClaimLists(next, dEnd, 4)) === JSON.stringify(Mc.rivalClaimLists(next, dEnd, 4))
    && JSON.stringify(AN.buildClaimSheet(M, MC, PLAN.draft.pairs, { fitOnly: true })) === JSON.stringify(AN.buildClaimSheet(Mc, c, PLAN.draft.pairs, { fitOnly: true }));
  const moved = Mc.classicSquad().bank !== M.classicSquad().bank;
  ok("the Draft search reads nothing of the Classic game: with the Classic bank, selling prices, free transfers and squad changed, the Draft moves, the rivals' claims and the claims sheet are identical",
    same && moved, "draft identical " + same + ", classic changed " + moved);
}
{
  /* Everything Draft changes: each roster handed to the next team, ownership rewritten, the waiver phase flipped. */
  const d = clone(MC), names = Object.keys(d.draft.rosters), rs = names.map((n) => d.draft.rosters[n]);
  names.forEach((n, i) => { d.draft.rosters[n] = rs[(i + 1) % rs.length]; d.draft.rosters[n].forEach((id) => { const p = d.players.find((x) => x.id === id); p.do = n; }); });
  d.draft.waiversProcessed = !d.draft.waiversProcessed;
  const Md = ENG.create(d);
  const g1 = JSON.stringify(AN.greedyTransfers(M, MC)), g2 = JSON.stringify(AN.greedyTransfers(Md, d));
  const s1 = JSON.stringify(AN.classicGameweekSim(M, MC, { draws: 2000 })), s2 = JSON.stringify(AN.classicGameweekSim(Md, d, { draws: 2000 }));
  const moved = pack(Md.draftMoves(Md.draftRoster(), next, Md.CFG.draftEnd, { perPos: 2 })) !== pack(M.draftMoves(M.draftRoster(), next, M.CFG.draftEnd, { perPos: 2 }));
  ok("the Classic search reads nothing of the Draft game: with every Draft roster moved and the waiver phase flipped, the greedy transfers and the gameweek simulation are identical",
    g1 === g2 && s1 === s2 && moved, "transfers identical " + (g1 === g2) + ", simulation identical " + (s1 === s2) + ", draft changed " + moved);
}
{
  const want = { claims: "draft", trades: "draft", transfers: "classic", classicSim: "classic", h2h: "draft", draftMoves: "draft" };
  const bad = Object.keys(want).filter((k) => !PRE[k] || PRE[k].game !== want[k]).map((k) => k + " " + (PRE[k] && PRE[k].game));
  ok("every precomputed result carries the one game it belongs to, and the review keeps the two apart (" + Object.keys(want).map((k) => k + " " + want[k]).join(", ") + ")",
    bad.length === 0 && PRE.review && PRE.review.classic.game === "classic" && PRE.review.draft.game === "draft" && Object.keys(PRE.review).sort().join(",") === "classic,draft",
    bad.join("; "));
}

finish();

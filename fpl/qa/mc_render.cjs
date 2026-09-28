/*
 * qa/mc_render.cjs — the two tabs the port adds, rendered on their own (v110 §5 D4 Odds, D5 Review).
 *
 * Why it exists
 *   qa/components.cjs holds every component to the same generic contract (clean markup, degraded contexts, junk
 *   props, testid ownership). This suite asserts what the Odds and Review tabs SAY: the words at first paint, the
 *   source named for every match, the margin removed from a typed price, the override written through the app's
 *   own store and read back by the engine, and the post-mortem's avoidable points never above what the bench
 *   scored. Every expected figure is read from MC, PLAN, PRE or the engine at run time; nothing is typed here
 *   (qa/no_frozen.cjs, E-084, E-094).
 *
 * How it runs
 *   The assembled app (app/FPL_Mission_Control.jsx) is transpiled with esbuild and evaluated against the real
 *   react and react-dom/server, the way qa/components.cjs loads it. Effects do not run; first paint is props.
 *   The two click handlers are driven for real: OddsCalc and OddsOverrides take no hooks, so each is called as a
 *   plain function, its element tree is walked to the button that carries the testid, and that button's own
 *   onClick is invoked — with an `on.market` that does what App's does (sanitiseState with the engine's team list,
 *   then E.setMarket before the next render).
 *
 *   --src   splice the working src/mc_ui.jsx into the assembled file in memory, between the two MC UI markers,
 *           before evaluating. For building the tabs without running build.cjs. Without it the suite tests the
 *           assembled app as shipped and first requires that block to equal src/mc_ui.jsx.
 *
 * Run: node qa/mc_render.cjs [--src] [--verbose]
 */

"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "app", "FPL_Mission_Control.jsx");
const MC_UI_SRC = path.join(ROOT, "src", "mc_ui.jsx");
const SPLICE = process.argv.indexOf("--src") >= 0;
const VERBOSE = process.argv.indexOf("--verbose") >= 0;
const NOW = "2026-09-12T06:00:00Z";
const UI_START = "// MC UI \u2014 START", UI_END = "// MC UI \u2014 END";   // the marker text, built so this file never carries it whole

let pass = 0, total = 0;
const fails = [];
function assert(name, cond, detail) {
  total++;
  const d = String(detail === undefined ? "" : detail).slice(0, 300);
  if (cond) { pass++; console.log("PASS " + name + (VERBOSE && d ? " — " + d : "")); return true; }
  fails.push(name + " — " + d);
  console.log("FAIL " + name + " — " + d);
  return false;
}
function bail(msg) {
  console.log("FAIL mc_render — " + msg);
  console.log("SUITE mc_render 0/1");
  process.exit(1);
}
function done() {
  console.log("");
  if (fails.length) { console.log("--- failures ---"); fails.forEach(function (f) { console.log("  " + f); }); }
  console.log("SUITE mc_render " + pass + "/" + total);
  process.exit(fails.length ? 1 : 0);
}

// ---------------------------------------------------------------- 1. load the app (spliced with --src)

if (!fs.existsSync(APP)) bail("app/FPL_Mission_Control.jsx does not exist (run `node build.cjs`)");
let esbuild;
try { esbuild = require(path.join(ROOT, "node_modules", "esbuild")); } catch (e) { bail("esbuild is not installed in fpl/node_modules"); }

let SRC = fs.readFileSync(APP, "utf8");
const UI_SOURCE = fs.readFileSync(MC_UI_SRC, "utf8").trim();
(function () {
  const a = SRC.indexOf(UI_START + "\n"), b = SRC.indexOf("\n" + UI_END);
  const once = SRC.split(UI_START).length === 2 && SRC.split(UI_END).length === 2 && a >= 0 && b > a;
  if (!once) { assert("mc_render-the-MC-UI-block-is-in-the-assembled-app-once", false, "markers not found exactly once"); done(); }
  const inner = SRC.slice(a + UI_START.length + 1, b);
  if (SPLICE) {
    SRC = SRC.slice(0, a + UI_START.length + 1) + UI_SOURCE + SRC.slice(b);
    assert("mc_render-src/mc_ui.jsx-spliced-into-the-assembled-app-in-memory", SRC.indexOf(UI_SOURCE) > 0,
      "--src: " + UI_SOURCE.length + " characters between the markers (the assembled block had " + inner.length + ")");
  } else {
    assert("mc_render-the-assembled-MC-UI-block-is-src/mc_ui.jsx", inner === UI_SOURCE,
      inner === UI_SOURCE ? inner.length + " characters, equal" : "the assembled block (" + inner.length + " chars) is not src/mc_ui.jsx (" +
        UI_SOURCE.length + " chars): run `node build.cjs`, or pass --src to test the source");
  }
})();

const FN_NAMES = [];
const DECL = /^(?:export\s+default\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const SCAN_SRC = SRC.replace(/\/\/ MC ENGINE \u2014 START[\s\S]*?\/\/ MC ENGINE \u2014 END/, "");   // E-123
let mm;
while ((mm = DECL.exec(SCAN_SRC))) FN_NAMES.push(mm[1]);

const EPILOGUE = "\nmodule.exports.__FNS__ = {" +
  FN_NAMES.map(function (n) { return JSON.stringify(n) + ": (typeof " + n + " === \"function\" ? " + n + " : null)"; }).join(",") +
  "};\nmodule.exports.__LIVE__ = (typeof LIVE !== \"undefined\" ? LIVE : null);\n" +
  "module.exports.__MC__ = { MC: (typeof MC !== \"undefined\" ? MC : null), PLAN: (typeof PLAN !== \"undefined\" ? PLAN : null)," +
  " PRE: (typeof PRE !== \"undefined\" ? PRE : null), MCEngine: (typeof MCEngine !== \"undefined\" ? MCEngine : null) };\n" +
  "module.exports.__TABS__ = (typeof TABS !== \"undefined\" ? TABS : null);\n" +
  "module.exports.__PRIMARY__ = (typeof PRIMARY !== \"undefined\" ? PRIMARY : null);\n" +
  "module.exports.__CFG__ = (typeof MC_UI_CFG !== \"undefined\" ? MC_UI_CFG : null);\n";

global.window = global.window || { __NOW__: NOW };
let CODE;
try { CODE = esbuild.transformSync(SRC + EPILOGUE, { loader: "jsx", jsx: "transform", format: "cjs", target: "node22" }).code; }
catch (e) { bail("esbuild could not transpile the app: " + (e && e.message ? String(e.message).split("\n")[0] : String(e))); }
const appRequire = Module.createRequire(path.join(ROOT, "package.json"));
const MOD = { exports: {} };
try { new Function("require", "module", "exports", CODE)(appRequire, MOD, MOD.exports); }
catch (e) { bail("evaluating the transpiled app under the real React threw: " + (e && e.message ? e.message : String(e))); }

const React = appRequire("react");
const RDS = appRequire("react-dom/server");
const FNS = MOD.exports.__FNS__ || {};
const B = MOD.exports.__MC__ || {};
const TABS = MOD.exports.__TABS__ || [];
const PRIMARY = MOD.exports.__PRIMARY__ || {};
const CFG = MOD.exports.__CFG__;
const LIVE = MOD.exports.__LIVE__;
const MC = B.MC, PLAN = B.PLAN, PRE = B.PRE;

const NEED = ["TabOdds", "TabReview", "OddsForm", "OddsCalc", "OddsOverrides", "mcOddsWeeks", "mcOddsRows", "mcFairPrice", "mcMarketWith",
  "mcReviewOf", "mcLedgerOf", "mcReviewNotes", "sanitiseState", "buildCtx", "sastText"];
const missing = NEED.filter(function (n) { return typeof FNS[n] !== "function"; });
assert("mc_render-the-odds-and-review-components-and-their-helpers-are-in-scope", missing.length === 0,
  missing.length ? "missing: " + missing.join(", ") : NEED.length + " functions");
assert("mc_render-the-baked-block-plan-precomputed-block-and-engine-are-in-scope",
  !!(MC && PLAN && PRE && B.MCEngine && typeof B.MCEngine.create === "function" && Array.isArray(MC.fixtures) && LIVE),
  "MC " + !!MC + " · PLAN " + !!PLAN + " · PRE " + !!PRE + " · MCEngine " + !!B.MCEngine + " · LIVE " + !!LIVE);
if (missing.length || !MC || !B.MCEngine) done();

// ---------------------------------------------------------------- 2. fixtures from the shipped snapshot

const F = function (n) { return FNS[n]; };
const noop = function () {};
function clone(o) { return JSON.parse(JSON.stringify(o)); }
const KWEZI = JSON.parse(fs.readFileSync(path.join(ROOT, "state", "kwezi.json"), "utf8"));
const STATE = F("sanitiseState")(clone(KWEZI));
const CTX = F("buildCtx")(LIVE, STATE, NOW);
const E = B.MCEngine.create(MC);                        // the app's instance; the round trip below gets its own
const MCP = { MC: MC, PLAN: PLAN, PRE: PRE, E: E };
const ON = { sec: noop, rev: noop, market: noop };
function uiFirst(tab) { return { mode: "simple", tab: tab, open: {}, reveals: {} }; }
function uiAll(tab) {
  const all = new Proxy({}, { get: function (t, k) { return k === "toJSON" ? undefined : true; }, has: function () { return true; }, ownKeys: function () { return []; } });
  return { mode: "full", tab: tab, open: all, reveals: all };
}
function ctxWithMarket(ctx, market) { const s = Object.assign({}, ctx.state, { market: market }); return Object.assign({}, ctx, { state: s }); }
function render(name, props) { return RDS.renderToStaticMarkup(React.createElement(FNS[name], props)); }
function tryRender(name, props) { try { return { ok: true, html: render(name, props) }; } catch (e) { return { ok: false, err: e }; } }
function stripStyle(html) { return String(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ""); }
function textOf(html) { return stripStyle(html).replace(/<[^>]*>/g, " ").replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, " ").replace(/\s+/g, " ").trim(); }
function wordsOf(html) { return textOf(html).split(" ").filter(Boolean).length; }
function openSections(html) { const o = []; let m; const RE = /data-testid="sec-([^"]+)" aria-expanded="(true|false)"/g; while ((m = RE.exec(html))) o.push({ id: m[1], open: m[2] === "true" }); return o; }
function residues(html) {
  const c = stripStyle(html), out = [];
  if (/\bundefined\b/.test(c)) out.push("undefined");
  if (/\bNaN\b/.test(c)) out.push("NaN");
  if (c.indexOf("[object Object]") >= 0) out.push("[object Object]");
  if (/\bInfinity\b/.test(c)) out.push("Infinity");
  if (/class=""/.test(c)) out.push("empty class");
  const hex = c.match(/#[0-9a-fA-F]{3,8}\b/g); if (hex) out.push("hex " + hex.slice(0, 3).join(","));
  const styles = c.match(/style="[^"]*"/g) || [];
  styles.forEach(function (s) {
    if (/font-size/.test(s)) out.push("inline font-size " + s);
    if (/(color|background)/.test(s) && s.indexOf("var(--") < 0) out.push("inline colour without a token " + s);
  });
  return out;
}
/* Every attribute set of the elements carrying a testid, in document order. */
function testidEls(html, id) {
  const out = []; let m;
  const RE = new RegExp("<([a-z]+)([^>]*\\bdata-testid=\"" + id.replace(/[-]/g, "\\-") + "\"[^>]*)>([^<]*)", "g");
  while ((m = RE.exec(html))) {
    const attrs = {}; let a; const AR = /([a-z-]+)="([^"]*)"/g;
    while ((a = AR.exec(m[2]))) attrs[a[1]] = a[2];
    out.push({ tag: m[1], attrs: attrs, text: m[3].replace(/&#x27;/g, "'").replace(/&amp;/g, "&") });
  }
  return out;
}
/* The React element tree a hookless component returns, walked through every props.children. */
function walk(node, pred, out) {
  out = out || [];
  if (Array.isArray(node)) { node.forEach(function (n) { walk(n, pred, out); }); return out; }
  if (!node || typeof node !== "object" || !node.props) return out;
  if (pred(node)) out.push(node);
  walk(node.props.children, pred, out);
  return out;
}
function byTestid(tree, id) { return walk(tree, function (n) { return n.props && n.props["data-testid"] === id; }); }
function r2(x) { return Math.round(Number(x) * 100) / 100; }

const SRC_LABELS = { odds: "bookmaker match prices", market: "bookmaker goal and clean-sheet prices", model: "the model", mine: "bookmaker match prices, added by you" };
const WEEKS = F("mcOddsWeeks")(MC);
const G1 = WEEKS[0], G2 = WEEKS[1];
const FX1 = MC.fixtures.filter(function (f) { return Number(f.gw) === G1; });
const FX2 = MC.fixtures.filter(function (f) { return Number(f.gw) === G2; });

// ---------------------------------------------------------------- 3. D4 · Odds at first paint

console.log("");
console.log("--- D4 · Odds ---");

assert("odds-the-tab-is-in-TABS-with-PRIMARY-od-next", TABS.some(function (t) { return t && t.id === "odds"; }) && PRIMARY.odds === "od-next",
  "PRIMARY.odds " + PRIMARY.odds);
const inPlay = Number(MC.gw.live) > Number(MC.gw.lastDone) ? Number(MC.gw.live) : null;
const wantFirst = inPlay || Number(MC.gw.next);
const wantSecond = wantFirst !== Number(MC.gw.next) ? Number(MC.gw.next) : Number(MC.gw.next) + 1;
const wantWeeks = [wantFirst].concat(wantSecond <= 38 ? [wantSecond] : []);        // 38: the season's length, a rule of the game
assert("odds-the-two-gameweeks-are-the-one-in-play-or-next-and-the-one-after", JSON.stringify(WEEKS) === JSON.stringify(wantWeeks),
  "weeks " + JSON.stringify(WEEKS) + " from gw " + JSON.stringify({ next: MC.gw.next, live: MC.gw.live, lastDone: MC.gw.lastDone }));

const O1 = tryRender("TabOdds", { ctx: CTX, ui: uiFirst("odds"), on: ON, mc: MCP });
assert("odds-first-paint-renders", O1.ok, O1.ok ? O1.html.length + " characters" : O1.err && O1.err.message);
const oHtml = O1.ok ? O1.html : "";
const oSecs = openSections(oHtml);
assert("odds-first-paint-opens-exactly-od-next-and-carries-od-later-and-od-add-closed",
  oSecs.filter(function (s) { return s.open; }).map(function (s) { return s.id; }).join(",") === "od-next" &&
  ["od-next", "od-later", "od-add"].every(function (id) { return oSecs.some(function (s) { return s.id === id; }); }),
  JSON.stringify(oSecs));
const oWords = wordsOf(oHtml);
assert("odds-first-paint-is-under-500-visible-words-and-says-something", oWords > 40 && oWords < 500, oWords + " visible words");
assert("odds-first-paint-markup-is-clean", residues(oHtml).length === 0, residues(oHtml).join(" · "));

(function () {
  const fx = testidEls(oHtml, "od-fx"), src = testidEls(oHtml, "od-src"), ko = testidEls(oHtml, "od-ko"), xg = testidEls(oHtml, "od-xg");
  const bad = [];
  FX1.forEach(function (f) {
    const id = String(f.id);
    const row = fx.filter(function (e) { return e.attrs["data-fx"] === id; })[0];
    const lab = src.filter(function (e) { return e.attrs["data-fx"] === id; })[0];
    const k = ko.filter(function (e) { return e.attrs["data-fx"] === id; })[0];
    const x = xg.filter(function (e) { return e.attrs["data-fx"] === id; })[0];
    if (!row || !lab || !k || !x) { bad.push("fixture " + id + " " + f.h + " v " + f.a + " has no complete row"); return; }
    const L = E.lambdas(f.h, { o: f.a, ha: "H" }, G1);
    const want = SRC_LABELS[L.src] || "?";
    if (lab.text !== want) bad.push(id + " label '" + lab.text + "' want '" + want + "' (engine src " + L.src + ")");
    if (row.text.indexOf(f.h) < 0 || row.text.indexOf(f.a) < 0) bad.push(id + " match text '" + row.text + "'");
    if (k.text !== F("sastText")(f.ko) || !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d\d:\d\d$/.test(k.text)) bad.push(id + " kick-off '" + k.text + "' want SAST weekday and time " + F("sastText")(f.ko));
    if (x.text !== L.lf.toFixed(2) + "\u2013" + L.la.toFixed(2)) bad.push(id + " goals '" + x.text + "' want " + L.lf.toFixed(2) + "\u2013" + L.la.toFixed(2));
  });
  assert("odds-every-fixture-of-the-next-gameweek-names-its-source-with-its-SAST-kick-off-and-goals", FX1.length > 0 && bad.length === 0,
    FX1.length + " fixtures in GW" + G1 + (bad.length ? ": " + bad.slice(0, 4).join("; ") : ", every one labelled as the engine prices it"));
  const labels = src.map(function (e) { return e.text; });
  assert("odds-every-source-label-is-one-of-the-four-named-sources", labels.length > 0 && labels.every(function (t) { return Object.keys(SRC_LABELS).some(function (k) { return SRC_LABELS[k] === t; }); }),
    labels.filter(function (t, i) { return labels.indexOf(t) === i; }).join(" | "));
  const onlyFirst = fx.every(function (e) { return Number(e.attrs["data-gw"]) === G1; });
  assert("odds-first-paint-draws-only-the-next-gameweek's-rows-the-second-waits-in-its-closed-section", onlyFirst && fx.length === FX1.length,
    fx.length + " rows at first paint, " + FX1.length + " fixtures in GW" + G1);
})();

const OA = tryRender("TabOdds", { ctx: CTX, ui: uiAll("odds"), on: ON, mc: MCP });
assert("odds-every-section-open-renders-clean", OA.ok && residues(OA.html).length === 0, OA.ok ? residues(OA.html).join(" · ") || OA.html.length + " characters" : OA.err && OA.err.message);
(function () {
  const html = OA.ok ? OA.html : "";
  const src2 = testidEls(html, "od-src").filter(function (e) { return FX2.some(function (f) { return String(f.id) === e.attrs["data-fx"]; }); });
  assert("odds-the-second-gameweek-names-a-source-for-every-fixture-too", FX2.length === 0 || src2.length === FX2.length,
    src2.length + " of " + FX2.length + " fixtures in GW" + G2);
  const opts = (html.match(/<option /g) || []).length;
  assert("odds-the-entry-form-offers-every-fixture-of-both-gameweeks", opts === FX1.length + FX2.length, opts + " options for " + (FX1.length + FX2.length) + " fixtures");
  const inputs = ["od-home", "od-draw", "od-away"].map(function (id) { return testidEls(html, id)[0]; });
  assert("odds-the-three-price-inputs-are-labelled-.inp-fields", inputs.every(function (i) { return i && /\binp\b/.test(i.attrs["class"] || "") && (i.attrs["aria-label"] || "").length > 3; }) &&
    testidEls(html, "od-fixture").length === 1, inputs.map(function (i) { return i ? i.attrs["aria-label"] : "missing"; }).join(" · "));
  assert("odds-the-entry-form-starts-empty-with-no-apply-button", testidEls(html, "od-apply").length === 0 && testidEls(html, "od-calc").length === 1,
    "od-apply " + testidEls(html, "od-apply").length);
  assert("odds-with-no-price-of-yours-the-list-says-so-and-offers-no-remove", testidEls(html, "od-remove").length === 0 && testidEls(html, "od-overrides").length === 1 &&
    testidEls(html, "od-active").length === 0, textOf((html.match(/data-testid="od-overrides"[^>]*>[^<]*/) || [""])[0]));
  const reveal = ["rev-od-model-next", "rev-od-model-later"].every(function (id) { return html.indexOf('data-testid="' + id + '"') >= 0; });
  assert("odds-the-original-engine's-numbers-stay-as-a-labelled-reveal-per-gameweek-(§1.4)", reveal && /original engine/i.test(textOf(html)),
    "reveals " + reveal);
})();

// ---------------------------------------------------------------- 4. the calculator: margin out, goals fitted

(function () {
  const f = FX1[0];
  if (!f) { assert("calc-there-is-a-fixture-in-the-next-gameweek-to-price", false, "no fixture in GW" + G1); return; }
  const calc = function (h, d, a) { return tryRender("OddsCalc", { fixture: f, prices: { h: h, d: d, a: a }, E: E, market: {}, on: ON }); };
  const prices = [f && E.lambdas(f.h, { o: f.a, ha: "H" }, G1).lf >= E.lambdas(f.h, { o: f.a, ha: "H" }, G1).la ? "1.45" : "7.00", "4.60", "7.00"];
  const r = calc(prices[0], prices[1], prices[2] === prices[0] ? "1.45" : prices[2]);
  const hs = [Number(prices[0]), Number(prices[1]), prices[2] === prices[0] ? 1.45 : Number(prices[2])];
  const fair = E.devig(hs[0], hs[1], hs[2]), fit = E.fitRates(fair);
  const html = r.ok ? r.html : "", t = textOf(html);
  assert("calc-valid-prices-render-a-clean-note-and-the-apply-button", r.ok && residues(html).length === 0 && testidEls(html, "od-apply").length === 1,
    r.ok ? residues(html).join(" · ") || t.slice(0, 160) : r.err && r.err.message);
  const shown = (t.match(/(\d+(?:\.\d+)?)%/g) || []).map(function (x) { return x; });
  assert("calc-the-margin-shown-is-the-engine's-devig-margin", t.indexOf((fair.margin * 100).toFixed(1) + "%") >= 0, "want " + (fair.margin * 100).toFixed(1) + "% in: " + t.slice(0, 200));
  const fairTxt = ["home " + Math.round(fair.h * 100) + "%", "draw " + Math.round(fair.d * 100) + "%", "away " + Math.round(fair.a * 100) + "%"];
  assert("calc-the-fair-chances-are-the-margin-removed-in-proportion", fairTxt.every(function (x) { return t.toLowerCase().indexOf(x) >= 0; }) &&
    Math.abs(fair.h + fair.d + fair.a - 1) < 1e-9, fairTxt.join(", ") + " · " + shown.join(" "));
  assert("calc-the-implied-goals-are-the-engine's-Poisson-fit", t.indexOf(f.h + " " + r2(fit.lh).toFixed(2)) >= 0 && t.indexOf(f.a + " " + r2(fit.la).toFixed(2)) >= 0,
    "want " + f.h + " " + r2(fit.lh).toFixed(2) + " and " + f.a + " " + r2(fit.la).toFixed(2) + " in: " + t.slice(0, 240));
  const o = E.matchOdds(fit.lh, fit.la);
  assert("calc-the-fitted-goals-price-back-within-1.2-points-of-the-fair-chances-(B2)",
    Math.max(Math.abs(o.h - fair.h), Math.abs(o.d - fair.d), Math.abs(o.a - fair.a)) < 0.012,
    "max gap " + (100 * Math.max(Math.abs(o.h - fair.h), Math.abs(o.d - fair.d), Math.abs(o.a - fair.a))).toFixed(2) + " pp");
  const cases = [["", "", ""], ["1.9", "", "3.1"], ["1.0", "3.5", "4"], ["abc", "3.5", "4"], ["-2", "3.5", "4"], ["5", "5", "5"]];
  const outs = cases.map(function (c) { const x = calc(c[0], c[1], c[2]); return { c: c, ok: x.ok, apply: x.ok ? testidEls(x.html, "od-apply").length : -1, t: x.ok ? textOf(x.html) : String(x.err && x.err.message), res: x.ok ? residues(x.html) : ["threw"] }; });
  assert("calc-empty-partial-out-of-range-non-numeric-and-under-100%-prices-never-offer-apply-and-each-says-why",
    outs.every(function (x) { return x.ok && x.apply === 0 && x.res.length === 0 && x.t.split(" ").length >= 5; }),
    outs.map(function (x) { return JSON.stringify(x.c) + " → " + (x.apply === 0 ? "no apply" : "apply " + x.apply) + ": " + x.t.slice(0, 60); }).join(" | "));
  const under = outs[5].t;
  assert("calc-prices-under-100%-are-named-as-not-one-bookmaker's-market", /under 100%/.test(under), under.slice(0, 160));
  const comma = calc(prices[0].replace(".", ","), prices[1].replace(".", ","), (prices[2] === prices[0] ? "1.45" : prices[2]).replace(".", ","));
  assert("calc-a-decimal-comma-reads-the-same-as-a-decimal-point", comma.ok && testidEls(comma.html, "od-apply").length === 1 && textOf(comma.html) === t, comma.ok ? "" : comma.err && comma.err.message);
})();

// ---------------------------------------------------------------- 5. the override round trip

console.log("");
console.log("--- D4 · the override round trip, through the buttons' own handlers ---");
(function () {
  const E2 = B.MCEngine.create(MC);                     // its own engine, so nothing above or below is moved
  const teams = E2.teamNames;
  const store = { market: {}, calls: [], applied: 0 };
  /* What App's on.market does (src/ui.jsx App): deep-copy the state, set or clear one side, sanitiseState against
     the engine's team list, and — in App's useMemo keyed on the market — E.setMarket before any child renders. */
  const appOn = {
    sec: noop, rev: noop,
    market: function (gw, team, xg) {
      store.calls.push([gw, team, xg]);
      const next = JSON.parse(JSON.stringify({ market: store.market }));
      const g = String(gw), t = String(team);
      next.market = next.market && typeof next.market === "object" ? next.market : {};
      if (xg === null || xg === undefined) {
        if (next.market[g]) { delete next.market[g][t]; if (!Object.keys(next.market[g]).length) delete next.market[g]; }
      } else {
        next.market[g] = next.market[g] && typeof next.market[g] === "object" ? next.market[g] : {};
        next.market[g][t] = { xg: Number(xg) };
      }
      store.market = F("sanitiseState")(next, { teams: teams }).market;
      E2.setMarket(store.market);
    }
  };
  const f = FX1.slice().sort(function (a, b) { return String(a.ko).localeCompare(String(b.ko)) || a.id - b.id; })[0];
  if (!f) { assert("trip-there-is-a-fixture-in-the-next-gameweek-to-price", false, "no fixture in GW" + G1); return; }
  const L0 = E2.lambdas(f.h, { o: f.a, ha: "H" }, G1);
  const best = function (club) {
    return MC.players.filter(function (p) { return p.t === club; }).map(function (p) { return { p: p, ep: E2.ep(p, G1) }; })
      .sort(function (a, b) { return b.ep - a.ep; })[0];
  };
  const PH = best(f.h), PA = best(f.a);
  const ep0 = [E2.ep(PH.p, G1), E2.ep(PA.p, G1)];
  const inv = L0.lf >= L0.la ? ["6.50", "4.40", "1.50"] : ["1.50", "4.40", "6.50"];      // the favourite flipped, so the goals must move
  const fit = E2.fitRates(E2.devig(Number(inv[0]), Number(inv[1]), Number(inv[2])));
  let doneCalls = 0;
  const tree = F("OddsCalc")({ fixture: f, prices: { h: inv[0], d: inv[1], a: inv[2] }, E: E2, market: store.market, on: appOn, onDone: function () { doneCalls++; } });
  const btn = byTestid(tree, "od-apply");
  assert("trip-OddsCalc-is-hookless-and-its-tree-carries-one-apply-button", btn.length === 1 && typeof btn[0].props.onClick === "function",
    btn.length + " apply buttons");
  if (btn.length !== 1) return;
  btn[0].props.onClick();
  const m = store.market[String(G1)] || {};
  assert("trip-apply-writes-both-sides-through-on.market-into-state.market",
    store.calls.length === 2 && m[f.h] && m[f.a] && m[f.h].xg === r2(fit.lh) && m[f.a].xg === r2(fit.la),
    JSON.stringify(store.calls) + " → " + JSON.stringify(store.market));
  const L1 = E2.lambdas(f.h, { o: f.a, ha: "H" }, G1);
  assert("trip-the-engine-reads-the-override-back", L1.lf === r2(fit.lh) && L1.la === r2(fit.la) && L1.src === "market",
    "lambdas " + L1.lf + "–" + L1.la + " src " + L1.src + " (was " + L0.lf.toFixed(3) + "–" + L0.la.toFixed(3) + " " + L0.src + ")");
  const ep1 = [E2.ep(PH.p, G1), E2.ep(PA.p, G1)];
  assert("trip-the-projection-for-a-player-of-each-club-moves",
    Math.abs(ep1[0] - ep0[0]) > 0.01 && Math.abs(ep1[1] - ep0[1]) > 0.01,
    PH.p.n + " (" + f.h + ") " + ep0[0].toFixed(3) + " → " + ep1[0].toFixed(3) + " · " + PA.p.n + " (" + f.a + ") " + ep0[1].toFixed(3) + " → " + ep1[1].toFixed(3));
  assert("trip-the-form-is-told-to-clear-after-apply", doneCalls === 1, doneCalls + " onDone calls");

  const mcp2 = { MC: MC, PLAN: PLAN, PRE: PRE, E: E2 };
  const ctx1 = ctxWithMarket(CTX, store.market);
  const R1 = tryRender("TabOdds", { ctx: ctx1, ui: uiFirst("odds"), on: appOn, mc: mcp2 });
  const h1 = R1.ok ? R1.html : "";
  const lab1 = testidEls(h1, "od-src").filter(function (e) { return e.attrs["data-fx"] === String(f.id); })[0];
  const xg1 = testidEls(h1, "od-xg").filter(function (e) { return e.attrs["data-fx"] === String(f.id); })[0];
  assert("trip-first-paint-names-the-price-as-yours-and-shows-its-goals", !!lab1 && lab1.text === SRC_LABELS.mine && !!xg1 && xg1.text === r2(fit.lh).toFixed(2) + "\u2013" + r2(fit.la).toFixed(2),
    (lab1 ? lab1.text : "no label") + " · " + (xg1 ? xg1.text : "no goals"));
  const act = testidEls(h1, "od-active")[0];
  assert("trip-first-paint-says-the-solved-plan-is-hidden-while-a-price-of-yours-is-active", !!act && /solved/.test(textOf(h1)) && /hidden/.test(textOf(h1)),
    act ? textOf(h1).slice(0, 120) : "no od-active note");
  assert("trip-first-paint-with-an-override-stays-clean-and-under-500-words", R1.ok && residues(h1).length === 0 && wordsOf(h1) < 500, wordsOf(h1) + " words " + residues(h1).join(" "));

  const tree2 = F("OddsOverrides")({ market: store.market, fixtures: MC.fixtures, E: E2, on: appOn });
  const rm = byTestid(tree2, "od-remove");
  assert("trip-OddsOverrides-lists-the-fixture-once-with-one-remove-button", rm.length === 1 && typeof rm[0].props.onClick === "function",
    rm.length + " remove buttons for " + JSON.stringify(store.market));
  if (rm.length !== 1) return;
  const RA = tryRender("OddsOverrides", { market: store.market, fixtures: MC.fixtures, E: E2, on: appOn });
  assert("trip-the-listed-override-names-the-gameweek-the-match-and-both-goals", RA.ok && textOf(RA.html).indexOf("GW" + G1) >= 0 && textOf(RA.html).indexOf(f.h + " v " + f.a) >= 0 &&
    textOf(RA.html).indexOf(r2(fit.lh).toFixed(2)) >= 0 && residues(RA.html).length === 0, RA.ok ? textOf(RA.html).slice(0, 160) : RA.err && RA.err.message);
  const before = store.calls.length;
  rm[0].props.onClick();
  assert("trip-remove-clears-both-sides-through-on.market", store.calls.length === before + 2 && Object.keys(store.market).length === 0,
    JSON.stringify(store.calls.slice(before)) + " → " + JSON.stringify(store.market));
  const L2 = E2.lambdas(f.h, { o: f.a, ha: "H" }, G1);
  const ep2 = [E2.ep(PH.p, G1), E2.ep(PA.p, G1)];
  assert("trip-remove-restores-the-engine-exactly", L2.lf === L0.lf && L2.la === L0.la && L2.src === L0.src && ep2[0] === ep0[0] && ep2[1] === ep0[1],
    "lambdas " + L2.lf + "–" + L2.la + " " + L2.src + " · ep " + ep2[0] + " / " + ep2[1] + " vs " + ep0[0] + " / " + ep0[1]);
  const R2 = tryRender("TabOdds", { ctx: ctxWithMarket(CTX, store.market), ui: uiAll("odds"), on: appOn, mc: mcp2 });
  const lab2 = R2.ok ? testidEls(R2.html, "od-src").filter(function (e) { return e.attrs["data-fx"] === String(f.id); })[0] : null;
  assert("trip-after-remove-the-row-is-back-on-its-original-source-and-nothing-is-listed", !!lab2 && lab2.text === SRC_LABELS[L0.src] &&
    testidEls(R2.html, "od-remove").length === 0 && testidEls(R2.html, "od-active").length === 0, lab2 ? lab2.text : "no label");
})();

// ---------------------------------------------------------------- 6. D4 · degraded and junk

(function () {
  const none = tryRender("TabOdds", { ctx: CTX, ui: uiFirst("odds"), on: ON, mc: { MC: null, PLAN: null, PRE: null, E: null } });
  assert("odds-with-no-baked-block-says-so-in-one-sentence-in-its-primary-section", none.ok && residues(none.html).length === 0 &&
    openSections(none.html).filter(function (s) { return s.open; }).map(function (s) { return s.id; }).join(",") === "od-next" &&
    (textOf(none.html).match(/\./g) || []).length === 1 && wordsOf(none.html) >= 6, none.ok ? textOf(none.html) : none.err && none.err.message);
  const junk = [null, 7, "x", [], { ctx: CTX }, { ctx: CTX, ui: uiFirst("odds"), on: { sec: noop, rev: noop }, mc: MCP },
    { ctx: CTX, ui: uiFirst("odds"), on: ON, mc: [] }, { ctx: CTX, ui: uiFirst("odds"), on: ON, mc: { MC: MC, E: {} } }];
  const kinds = junk.map(function (p) { const r = tryRender("TabOdds", p); return r.ok ? "rendered" : (r.err instanceof TypeError ? "TypeError" : r.err && r.err.constructor && r.err.constructor.name); });
  assert("odds-junk-props-are-refused-with-a-TypeError", kinds.every(function (k) { return k === "TypeError"; }), kinds.join(","));
  const sub = [["OddsCalc", { fixture: null, prices: {}, E: E, market: {}, on: ON }], ["OddsCalc", { fixture: FX1[0], prices: { h: "2" }, E: E, market: {}, on: {} }],
    ["OddsOverrides", { market: {}, fixtures: "x", E: E, on: ON }], ["OddsForm", { fixtures: FX1, E: E, market: {}, on: null }]];
  const k2 = sub.map(function (s) { const r = tryRender(s[0], s[1]); return s[0] + " " + (r.ok ? "rendered" : r.err instanceof TypeError ? "TypeError" : "other"); });
  assert("odds-the-form-the-calculator-and-the-list-refuse-junk-with-a-TypeError", k2.every(function (k) { return / TypeError$/.test(k); }), k2.join(", "));
})();

// ---------------------------------------------------------------- 7. D5 · Review

console.log("");
console.log("--- D5 · Review ---");
assert("review-the-tab-is-in-TABS-with-PRIMARY-rw-classic", TABS.some(function (t) { return t && t.id === "review"; }) && PRIMARY.review === "rw-classic",
  "PRIMARY.review " + PRIMARY.review);

const RV = PRE && PRE.review;
const MINE = F("mcReviewOf")(E, MC);
function deepEq(a, b) { return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b)); }
function sortKeys(v) { if (Array.isArray(v)) return v.map(sortKeys); if (v && typeof v === "object") { const o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = sortKeys(v[k]); }); return o; } return v; }
assert("review-the-fallback-computed-in-the-tab-equals-PRE.review-built-by-precompute", !!MINE && !!RV && deepEq(MINE, RV),
  MINE && RV ? "classic " + MINE.classic.rows.length + " rows, draft " + MINE.draft.rows.length + " rows" : "mcReviewOf " + !!MINE + " · PRE.review " + !!RV);
(function () {
  let ref = null;
  try {
    const ENG = require(path.join(ROOT, "src", "mc_engine.js")), AN = require(path.join(ROOT, "src", "mc_analysis.js"));
    ref = { summary: AN.reviewSummary(ENG.create(MC), MC), weeks: AN.MC_REVIEW_WEEKS, flags: AN.MC_REVIEW_FLAGS };
  } catch (e) { ref = null; }
  assert("review-and-it-equals-src/mc_analysis.js-reviewSummary-run-on-the-source-engine", !!ref && !!MINE && deepEq(MINE, ref.summary), ref ? "equal" : "could not run src/mc_analysis.js");
  assert("review-the-tab's-window-and-flag-thresholds-are-mc_analysis's-own", !!ref && !!CFG && CFG.reviewWeeks === ref.weeks && deepEq(CFG.flags, ref.flags),
    "MC_UI_CFG " + JSON.stringify(CFG) + " · mc_analysis " + JSON.stringify(ref && { weeks: ref.weeks, flags: ref.flags }));
})();
(function () {
  const bad = [];
  (RV ? [["PRE", RV], ["tab", MINE]] : [["tab", MINE]]).forEach(function (x) {
    const r = x[1]; if (!r) { bad.push(x[0] + " missing"); return; }
    r.classic.rows.forEach(function (g) { if (!(g.leftOnBench <= g.bench)) bad.push(x[0] + " Classic GW" + g.gw + " avoidable " + g.leftOnBench + " > bench " + g.bench); });
    r.draft.rows.forEach(function (g) {
      const w = (r.draft.perWeek || []).filter(function (p) { return p.gw === g.gw; })[0];
      if (!w || !(g.leftOnBench <= w.benchScored)) bad.push(x[0] + " Draft GW" + g.gw + " avoidable " + g.leftOnBench + " > bench " + (w ? w.benchScored : "?"));
    });
    if (!(r.classic.avoidable <= r.classic.benchScored) || !(r.draft.avoidable <= r.draft.benchScored)) bad.push(x[0] + " totals");
  });
  assert("review-avoidable-never-exceeds-what-the-bench-scored-on-any-row-in-either-game", bad.length === 0 && !!MINE,
    bad.length ? bad.join("; ") : "Classic " + MINE.classic.avoidable + " of " + MINE.classic.benchScored + " · Draft " + MINE.draft.avoidable + " of " + MINE.draft.benchScored);
})();

const V1 = tryRender("TabReview", { ctx: CTX, ui: uiFirst("review"), on: ON, mc: MCP });
const vHtml = V1.ok ? V1.html : "";
assert("review-first-paint-renders", V1.ok, V1.ok ? vHtml.length + " characters" : V1.err && V1.err.message);
const vSecs = openSections(vHtml);
assert("review-first-paint-opens-exactly-rw-classic-and-carries-rw-draft-closed",
  vSecs.filter(function (s) { return s.open; }).map(function (s) { return s.id; }).join(",") === "rw-classic" && vSecs.some(function (s) { return s.id === "rw-draft" && !s.open; }),
  JSON.stringify(vSecs));
const vWords = wordsOf(vHtml);
assert("review-first-paint-is-under-500-visible-words-and-says-something", vWords > 40 && vWords < 500, vWords + " visible words");
assert("review-first-paint-markup-is-clean", residues(vHtml).length === 0, residues(vHtml).join(" · "));
const VA = tryRender("TabReview", { ctx: CTX, ui: uiAll("review"), on: ON, mc: MCP });
const vaHtml = VA.ok ? VA.html : "";
assert("review-every-section-open-renders-clean", VA.ok && residues(vaHtml).length === 0, VA.ok ? residues(vaHtml).join(" · ") || vaHtml.length + " characters" : VA.err && VA.err.message);

(function () {
  const c = testidEls(vaHtml, "rw-c-gw"), d = testidEls(vaHtml, "rw-d-gw");
  const cRows = (RV || MINE).classic.rows, dRows = (RV || MINE).draft.rows, per = (RV || MINE).draft.perWeek;
  const badC = cRows.filter(function (g) {
    const e = c.filter(function (x) { return Number(x.attrs["data-gw"]) === g.gw; })[0];
    return !e || Number(e.attrs["data-bench"]) !== g.bench || Number(e.attrs["data-avoid"]) !== g.leftOnBench || Number(e.attrs["data-avoid"]) > Number(e.attrs["data-bench"]);
  });
  const badD = dRows.filter(function (g) {
    const e = d.filter(function (x) { return Number(x.attrs["data-gw"]) === g.gw; })[0], w = per.filter(function (p) { return p.gw === g.gw; })[0];
    return !e || !w || Number(e.attrs["data-bench"]) !== w.benchScored || Number(e.attrs["data-avoid"]) !== g.leftOnBench || Number(e.attrs["data-avoid"]) > Number(e.attrs["data-bench"]) ||
      e.attrs["data-flip"] !== String(!!g.flip);
  });
  assert("review-the-Classic-table-draws-one-row-per-gameweek-with-bench-scored-and-avoidable-as-computed", c.length === cRows.length && cRows.length > 0 && badC.length === 0,
    c.length + " rows for " + cRows.length + " gameweeks" + (badC.length ? "; wrong: " + badC.map(function (g) { return g.gw; }).join(",") : ""));
  assert("review-the-Draft-table-draws-one-row-per-gameweek-with-bench-scored-avoidable-and-the-flip", d.length === dRows.length && dRows.length > 0 && badD.length === 0,
    d.length + " rows for " + dRows.length + " gameweeks" + (badD.length ? "; wrong: " + badD.map(function (g) { return g.gw; }).join(",") : ""));
  const firstC = testidEls(vHtml, "rw-c-gw").length, firstD = testidEls(vHtml, "rw-d-gw").length;
  assert("review-first-paint-shows-the-Classic-table-and-keeps-the-Draft-one-behind-its-section", firstC === cRows.length && firstD === 0, firstC + " Classic rows, " + firstD + " Draft rows");
  const tC = (testidEls(vaHtml, "rw-c-sum")[0] || { text: "" }).text, tD = (testidEls(vaHtml, "rw-d-sum")[0] || { text: "" }).text;
  const R = RV || MINE;
  assert("review-each-summary-is-labelled-with-its-game-and-quotes-its-own-bench-and-avoidable",
    /Classic/.test(tC) && !/Draft/.test(tC) && tC.indexOf(String(R.classic.benchScored)) >= 0 && tC.indexOf(String(R.classic.avoidable)) >= 0 &&
    /Draft/.test(tD) && !/Classic/.test(tD) && tD.indexOf(String(R.draft.benchScored)) >= 0 && tD.indexOf(String(R.draft.avoidable)) >= 0,
    "Classic: " + tC.slice(0, 110) + " | Draft: " + tD.slice(0, 110));
  /* the prose only — summaries, repeat and stop notes, the reveal — split into sentences; the table cells ("Lost 32–39",
     "Bench scored 7") sit side by side in the markup and are not sentences */
  const prose = (vaHtml.match(/<(p|li)\b[^>]*>[^<]*<\/\1>|<div class="reveal-b"[^>]*>[\s\S]*?<\/div><\/div>/g) || []).map(textOf).join(" ");
  const sentences = prose.split(/(?<=\.)\s+/);
  const lossy = sentences.filter(function (x) { return /\bbench\b/i.test(x) && /\b(lost|lose|wasted|thrown away|left behind|cost)\b/i.test(x); });
  assert("review-bench-points-scored-are-never-presented-as-a-loss-and-avoidable-is-named", sentences.length > 5 && lossy.length === 0 && /avoidable/i.test(prose),
    lossy.length ? lossy.join(" | ").slice(0, 240) : sentences.length + " prose sentences read, none presents bench points scored as a loss");
})();

(function () {
  const want = F("mcLedgerOf")(E, MC);
  const log = (MC.classic && MC.classic.transfersLog) || [];
  const rows = testidEls(vHtml, "rw-ledger");
  const P = E.P;
  const bad = log.filter(function (t) {
    let pi = 0, po = 0;
    for (let g = t.gw; g <= MC.gw.lastDone; g++) { pi += P[t.in] && P[t.in].h && P[t.in].h[g] ? P[t.in].h[g][1] : 0; po += P[t.out] && P[t.out].h && P[t.out].h[g] ? P[t.out].h[g][1] : 0; }
    const w = want.filter(function (x) { return x.gw === t.gw && x.inId === t.in && x.outId === t.out; })[0];
    const e = rows.filter(function (x) { return Number(x.attrs["data-in"]) === t.in && Number(x.attrs["data-out"]) === t.out; })[0];
    return !w || w.ptsIn !== pi || w.ptsOut !== po || !e || e.text.indexOf(P[t.in].n) < 0 || e.text.indexOf(P[t.out].n) < 0;
  });
  assert("review-the-Classic-transfer-ledger-has-every-transfer-in-against-out-with-points-since", rows.length === log.length && bad.length === 0,
    rows.length + " ledger rows for " + log.length + " transfers" + (bad.length ? "; wrong: " + JSON.stringify(bad) : "") + (log.length ? " · " + rows.map(function (r) { return r.text; }).join(" / ") : ""));
})();

(function () {
  /* E-117 · every league fact in the notes is computed, never carried as prose. The notes that quote the table appear
     only in some weeks (no Draft win yet, a heavy bench), so they are asked for directly, on a copy of the review with
     those conditions forced, and again on a block whose table and plan are moved: each quoted figure must follow. */
  const R = RV || MINE, st = MC.draft.standings || [], me = st.filter(function (s) { return s.name === MC.draft.me; })[0];
  if (!R || !me || typeof FNS.mcReviewNotes !== "function") { assert("review-league-facts-in-the-notes-are-computed-from-the-table", false, "mcReviewNotes or the table missing"); return; }
  const forced = clone(R); forced.draft.wins = 0; forced.draft.flags.bench = true; forced.classic.noTransfers = false;
  const rankOf = function (list, pf) { return list.filter(function (s) { return Number(s.pf) > Number(pf); }).length + 1; };
  const top = Math.max.apply(null, st.map(function (s) { return Number(s.pf); })) + 1;
  const MC2 = Object.assign({}, MC, { draft: Object.assign({}, MC.draft, { standings: st.map(function (s) { return s.name === MC.draft.me ? Object.assign({}, s, { pf: top }) : s; }) }) });
  const t1 = F("mcReviewNotes")(forced, MC, PLAN, E, []).draft.stop.join(" "), t2 = F("mcReviewNotes")(forced, MC2, PLAN, E, []).draft.stop.join(" ");
  const close = R.draft.rows.filter(function (g) { return g.res === "L" && Number(g.opp) - Number(g.mine) <= CFG.closeLoss; }).length;
  const want1 = "Your " + me.pf + " points scored rank " + rankOf(st, me.pf) + " of " + st.length, want2 = "Your " + top + " points scored rank 1 of " + st.length;
  assert("review-league-facts-in-the-notes-are-computed-from-the-table-(E-117)",
    t1.indexOf(want1) >= 0 && t2.indexOf(want2) >= 0 && (close === 0 ? !/points or fewer/.test(t1) : t1.indexOf(close + " of your " + R.draft.losses) >= 0) && !/bottom two|twice already/.test(t1 + " " + t2),
    "want '" + want1 + "' then '" + want2 + "', close losses " + close + " · got: " + t1.slice(0, 200));
  const next = Number(MC.gw.next), wk = (PLAN.replay && PLAN.replay.weeks || []).filter(function (w) { return Number(w.gw) === next; })[0];
  if (!wk) { assert("review-the-free-transfer-bank-quoted-is-PLAN.replay's", false, "no replay week for GW" + next); return; }
  const cap = Number(MC.classic.maxFt), led = [{}];
  const plan2 = clone(PLAN); plan2.replay.weeks.forEach(function (w) { if (Number(w.gw) === next) w.ftBefore = cap; });
  const c1 = F("mcReviewNotes")(forced, MC, PLAN, E, led).classic.stop.join(" "), c2 = F("mcReviewNotes")(forced, MC, plan2, E, led).classic.stop.join(" ");
  const a1 = wk.ftBefore >= cap - 1 ? c1.indexOf(wk.ftBefore + " free transfers are banked for GW" + next) >= 0 : !/banked/.test(c1);
  assert("review-the-free-transfer-bank-quoted-is-PLAN.replay's-and-follows-it", a1 && c2.indexOf(cap + " free transfers are banked for GW" + next) >= 0 &&
    c2.indexOf("The most you can hold is " + cap) >= 0 && /this week throws one away/.test(c2),
    "replay GW" + next + " ftBefore " + wk.ftBefore + ", cap " + cap + " · " + c1.slice(c1.indexOf("free") - 3, c1.indexOf("free") + 90) + " | moved: " + c2.slice(c2.indexOf("free") - 3, c2.indexOf("free") + 120));
})();

(function () {
  const noPre = tryRender("TabReview", { ctx: CTX, ui: uiAll("review"), on: ON, mc: { MC: MC, PLAN: PLAN, PRE: null, E: E } });
  assert("review-with-no-PRE-computes-and-draws-exactly-what-PRE-draws", noPre.ok && noPre.html === vaHtml, noPre.ok ? noPre.html.length + " vs " + vaHtml.length + " characters" : noPre.err && noPre.err.message);
  const noMc = tryRender("TabReview", { ctx: CTX, ui: uiFirst("review"), on: ON, mc: { MC: null, PLAN: null, PRE: null, E: null } });
  assert("review-with-no-baked-block-says-so-in-one-sentence-in-its-primary-section", noMc.ok && residues(noMc.html).length === 0 &&
    openSections(noMc.html).filter(function (s) { return s.open; }).map(function (s) { return s.id; }).join(",") === "rw-classic" &&
    (textOf(noMc.html).match(/\./g) || []).length === 1 && wordsOf(noMc.html) >= 6, noMc.ok ? textOf(noMc.html) : noMc.err && noMc.err.message);
  const junk = [null, "x", {}, { ctx: CTX, ui: uiFirst("review"), on: ON, mc: 3 }, { ctx: CTX, ui: 1, on: ON, mc: MCP }, { ctx: CTX, ui: uiFirst("review"), on: ON, mc: { MC: MC, E: E, PRE: "x" } }];
  const kinds = junk.map(function (p) { const r = tryRender("TabReview", p); return r.ok ? "rendered" : (r.err instanceof TypeError ? "TypeError" : "other"); });
  assert("review-junk-props-are-refused-with-a-TypeError", kinds.every(function (k) { return k === "TypeError"; }), kinds.join(","));
})();

// ---------------------------------------------------------------- 8. §1.1 · the two games are never summed

(function () {
  const me = (MC.draft.standings || []).filter(function (s) { return s.name === MC.draft.me; })[0];
  const R = RV || MINE;
  const sums = [];
  if (me && isFinite(MC.classic.total) && isFinite(me.pf)) sums.push(["Classic total + Draft points for", MC.classic.total + me.pf]);
  /* numbers as the app writes them: a space-grouped figure ("3 434 824") is one number, not three; a percentage or a
     decimal is never a points total, so neither is read. Only this one sum is checked: a smaller one (the two benches
     together, say) is a plausible gameweek score, and a coincidence would turn this check red for no fault. */
  const nums = function (html) {
    return (textOf(html).match(/\d{1,3}(?: \d{3})+(?![\d%.])|\d+(?:\.\d+)?%?/g) || []).filter(function (s) { return !/[%.]/.test(s); }).map(function (s) { return s.replace(/ /g, ""); });
  };
  const seen = nums(OA.ok ? OA.html : "").concat(nums(vaHtml));
  const hit = sums.filter(function (s) { return seen.indexOf(String(s[1])) >= 0; });
  assert("separation-the-Classic-total-plus-the-Draft-points-for-appears-nowhere-on-either-tab", sums.length === 1 && hit.length === 0,
    sums.map(function (s) { return s[0] + " = " + s[1]; }).join(" · ") + (hit.length ? " — FOUND " + hit.map(function (s) { return s[0]; }).join(", ") : " — neither appears among " + seen.length + " figures"));
})();

done();

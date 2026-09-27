#!/usr/bin/env node
/*
 * qa/parity.cjs — the ported engine module against the reference's golden numbers (v110 §5 E2,
 * covering B1, B2, B3, B4, B5, B7, B8 and B9).
 *
 *   node qa/parity.cjs
 *
 * WHAT IT PROVES
 *   src/mc_engine.js is the v111 engine, and src/mc_analysis.js is the pure logic the v111 kit kept
 *   inside its interface file. Both must reproduce, on reference/v109/app/data.json, the numbers the
 *   reference build recorded in reference/v109/app/golden.json and solver_in.json:
 *     B1  the fitted price exponents, the anchor count, the fit error and every team rating
 *     B2  every bookmaker match price turned into goals, and back into the same fair price
 *     B3  every player's expected points in every gameweek of the solver's horizon
 *     B4  the greedy transfer search, move for move
 *     B5  the phase-aware "how to get him" label (spec §7.4, E-097)
 *     B7  the claims sheet, first against golden.json and then line for line against the reference
 *         implementation itself, run in this same process on the same data
 *     B8  the Classic gameweek simulation and the head-to-head, on the kit's own seeds
 *     B9  the post-mortems, equal to the reference engine's, with their invariants
 *   plus the like-for-like rule over trades and claims (spec §7.3, E-096).
 *
 * WHERE THE EXPECTED NUMBERS COME FROM
 *   Every expectation is read from reference/v109/app/golden.json or solver_in.json, or produced by
 *   running the reference implementation (reference/v109/app/engine.js and ui.js) in this process.
 *   Nothing is typed. The reference tree is read-only and the app never imports from it; a test may
 *   require it, which is the one purpose it has here.
 *
 * TOLERANCES (v110 §5)
 *   rmse 0.0005 · ratings 0.001 · goals 0.01 · fair price 0.0005 · round trip 1.2 percentage points ·
 *   expected points 0.01 · transfer value 0.05 · claims-sheet values 0.5 · head-to-head win 0.02 and
 *   draw 0.01 · simulation percentiles 2. The claims-sheet values are simulation means in the golden
 *   file's own rounding (one decimal), which is why 0.5 rather than a tighter figure; the line-for-line
 *   comparison against the reference implementation is exact and is the check that matters.
 *
 * MUTATIONS
 *   A parity check that cannot go red is not a check. Each comparator is re-run on a broken copy —
 *   a rating exponent moved, an odds row moved, one player's expected points moved, one claim's
 *   backup swapped, the phase dropped from the label, a cross-position pair fed to the sheet — and the
 *   suite asserts the comparator reports the break, quoting what it said.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REF_APP = path.join(ROOT, "reference", "v109", "app");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const finish = () => { console.log("SUITE parity " + pass + "/" + (pass + fail)); process.exit(fail ? 1 : 0); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } };
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const fmt = (x) => (x == null ? "null" : Number(x).toFixed(4));
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------------------------------------------------------------- inputs */
const DATA = readJson(path.join(REF_APP, "data.json"));
const golden = readJson(path.join(REF_APP, "golden.json"));
const solverIn = readJson(path.join(REF_APP, "solver_in.json"));
const solverOut = readJson(path.join(REF_APP, "solver_out.json"));
const refPRE = readJson(path.join(REF_APP, "pre.json"));

ok("the reference data, golden numbers, solver input, solved plan and precompute are readable",
  !!DATA && !!golden && !!solverIn && !!solverOut && !!refPRE && !!golden.calib && !!golden.ratings && !!golden.odds &&
  !!golden.classic && !!golden.draft && Array.isArray(solverIn.players) && !!solverOut.draft && Array.isArray(solverOut.draft.pairs),
  [!!DATA, !!golden, !!solverIn, !!solverOut, !!refPRE].join(","));
if (!DATA || !golden || !solverIn || !solverOut || !refPRE) finish();

/* ---------------------------------------------------------------- the modules under test */
let ENG = null, A = null, loadErr = [];
try { ENG = require(path.join(ROOT, "src", "mc_engine.js")); } catch (e) { loadErr.push("mc_engine: " + e.message); }
try { A = require(path.join(ROOT, "src", "mc_analysis.js")); } catch (e) { loadErr.push("mc_analysis: " + e.message); }
const NEED = ["buildClaimSheet", "findTrades", "tradeGroups", "classicReviewSummary", "draftReviewSummary", "reviewSummary",
  "classicGameweekSim", "headToHead", "greedyTransfers", "claimability"];
ok("src/mc_engine.js loads under Node and exports create()", !!ENG && typeof ENG.create === "function", loadErr.join(" · "));
ok("src/mc_analysis.js loads under Node and exports " + NEED.join(", "),
  !!A && NEED.every((k) => typeof A[k] === "function"),
  loadErr.join(" · ") + (A ? " missing: " + NEED.filter((k) => typeof A[k] !== "function").join(", ") : ""));
if (!ENG || !A || NEED.some((k) => typeof A[k] !== "function")) finish();

const M = ENG.create(DATA);
const refM = require(path.join(REF_APP, "engine.js")).create(DATA);
const P = M.P, next = DATA.gw.next, cEnd = M.CFG.classicEnd, dEnd = M.CFG.draftEnd;
const nameOf = (id) => (P[id] ? P[id].n : "#" + id);

/* ================================================================ comparators
   Each returns {ok, max, detail} so the same code judges the real run and the mutated copies. */

function cmpCalib(calib, g) {
  const weeksEq = JSON.stringify(calib.weeks) === JSON.stringify(g.weeks);
  const rmse = Math.abs(calib.rmse - g.rmse);
  const good = calib.ka === g.ka && calib.kd === g.kd && calib.n === g.anchors && weeksEq && rmse <= 0.0005;
  return { ok: good, max: rmse, detail: "ka " + calib.ka + "/" + g.ka + " kd " + calib.kd + "/" + g.kd + " anchors " + calib.n + "/" + g.anchors +
    " weeks " + JSON.stringify(calib.weeks) + "/" + JSON.stringify(g.weeks) + " rmse " + fmt(calib.rmse) + "/" + fmt(g.rmse) + " (diff " + rmse.toExponential(2) + ")" };
}
function cmpRatings(RAT, g, tol) {
  let max = 0, worst = "", n = 0, missing = [];
  Object.keys(g).forEach((t) => { if (!RAT[t]) { missing.push(t); return; }
    ["att", "def"].forEach((k) => { n++; const d = Math.abs(RAT[t][k] - g[t][k]); if (d > max) { max = d; worst = t + "." + k + " " + fmt(RAT[t][k]) + " vs " + fmt(g[t][k]); } }); });
  return { ok: !missing.length && max <= tol, max, n, detail: n + " ratings, max |error| " + max.toExponential(2) + " at " + worst + (missing.length ? "; missing " + missing.join(",") : "") };
}
function cmpOdds(ODDS, gOdds, matchOdds) {
  let rows = 0, maxGoal = 0, maxFair = 0, maxTrip = 0, bad = [];
  Object.keys(gOdds).forEach((gw) => {
    const mine = ODDS[gw] || [];
    if (mine.length !== gOdds[gw].length) bad.push("gameweek " + gw + ": " + mine.length + " fixtures priced, golden has " + gOdds[gw].length);
    gOdds[gw].forEach((row) => { rows++;
      const o = mine.find((x) => x.h === row.h && x.a === row.a);
      if (!o) { bad.push("gameweek " + gw + " " + row.h + " v " + row.a + " not priced"); return; }
      const dg = Math.max(Math.abs(o.lh - row.lh), Math.abs(o.la - row.la)); if (dg > maxGoal) maxGoal = dg;
      const fair = row.fair ? { h: row.fair[0], d: row.fair[1], a: row.fair[2] } : null;
      if (fair) { const df = Math.max(Math.abs(o.fair.h - fair.h), Math.abs(o.fair.d - fair.d), Math.abs(o.fair.a - fair.a)); if (df > maxFair) maxFair = df; }
      const rt = matchOdds(row.lh, row.la), f2 = fair || o.fair;
      const dt = Math.max(Math.abs(rt.h - f2.h), Math.abs(rt.d - f2.d), Math.abs(rt.a - f2.a)); if (dt > maxTrip) maxTrip = dt;
      if (dg > 0.01 + 1e-12) bad.push(gw + " " + row.h + "-" + row.a + " goals " + fmt(o.lh) + "/" + fmt(o.la) + " vs " + row.lh + "/" + row.la);
      if (fair && Math.max(Math.abs(o.fair.h - fair.h), Math.abs(o.fair.d - fair.d), Math.abs(o.fair.a - fair.a)) > 0.0005 + 1e-12) bad.push(gw + " " + row.h + "-" + row.a + " fair price off");
      if (dt > 0.012 + 1e-12) bad.push(gw + " " + row.h + "-" + row.a + " round trip off by " + fmt(dt)); });
  });
  return { ok: !bad.length, rows, maxGoal, maxFair, maxTrip, detail: rows + " fixtures · max goals error " + maxGoal.toExponential(2) + " · max fair-price error " + maxFair.toExponential(2) +
    " · max round-trip error " + (maxTrip * 100).toFixed(3) + " pp" + (bad.length ? " · " + bad.slice(0, 4).join(" · ") : "") };
}
function cmpEp(ep, si, tol) {
  let n = 0, max = 0, worst = "", over = 0;
  si.players.forEach((pl) => { const p = P[pl.id]; if (!p) { over++; return; }
    si.gws.forEach((gw, i) => { n++; const d = Math.abs(ep(p, gw) - pl.ep[i]); if (d > max) { max = d; worst = pl.n + " gameweek " + gw + " " + fmt(ep(p, gw)) + " vs " + pl.ep[i]; } if (d > tol + 1e-12) over++; }); });
  return { ok: over === 0 && n > 1000, n, max, over, detail: n + " assertions · max |error| " + max.toExponential(3) + " at " + worst + " · " + over + " over " + tol };
}
function cmpTransfers(tr, g) {
  const moves = tr.moves.map((m) => m.out.n + " -> " + m.inn.n);
  const dv = Math.abs(tr.value - g.value);
  return { ok: JSON.stringify(moves) === JSON.stringify(g.moves) && dv <= 0.05, max: dv, detail: moves.join(" · ") + " (value " + fmt(tr.value) + " vs " + g.value + ", diff " + fmt(dv) + ")" };
}
/* The golden sheet names players; the sheet carries ids. The "result" column is the stress test:
   lands / taken (already claimed) / not reached. */
function sheetResult(C, id) { return C.landed.indexOf(id) >= 0 ? "lands" : C.lost.indexOf(id) >= 0 ? "taken" : "not reached"; }
function cmpSheetToGolden(C, g) {
  const bad = [];
  if (C.sheet.length !== g.sheet.length) bad.push("lines " + C.sheet.length + " vs " + g.sheet.length);
  if (C.strategy !== g.strategy) bad.push("strategy " + C.strategy + " vs " + g.strategy);
  let max = 0;
  [["valueNow", "valueNow"], ["valueStress", "valueStress"], ["altValue", "altValue"], ["valueAll", "valueAll"]].forEach(([k, gk]) => {
    const d = Math.abs(C[k] - g[gk]); if (d > max) max = d; if (d > 0.5) bad.push(k + " " + fmt(C[k]) + " vs " + g[gk]); });
  g.sheet.forEach((row, i) => { const e = C.sheet[i]; if (!e) return;
    const mine = e.kind + " " + nameOf(e.add) + " for " + nameOf(e.drop) + " " + sheetResult(C, e.add), want = row.kind + " " + row.add + " for " + row.drop + " " + row.result;
    if (mine !== want) bad.push("line " + (i + 1) + ": " + mine + " vs " + want);
    if (Math.abs(e.gain - row.gain) > 0.05 + 1e-12) bad.push("line " + (i + 1) + " gain " + fmt(e.gain) + " vs " + row.gain); });
  return { ok: !bad.length, max, detail: C.sheet.length + " lines, strategy " + C.strategy + ", now " + fmt(C.valueNow) + " stressed " + fmt(C.valueStress) +
    " other ordering " + fmt(C.altValue) + " all first choices " + fmt(C.valueAll) + " (max value diff " + fmt(max) + ")" + (bad.length ? " · " + bad.slice(0, 5).join(" · ") : "") };
}
/* Line for line against another implementation: ids, kinds, gains, the stress-test simulation, what
   landed and what was lost, and the rivals' modelled wants. */
function normSheet(C) {
  return JSON.stringify({ sheet: C.sheet.map((e) => ({ kind: e.kind, add: e.add, drop: e.drop, of: e.of == null ? null : e.of, gain: r6(e.gain) })),
    strategy: C.strategy, altValue: r6(C.altValue), valueNow: r6(C.valueNow), valueStress: r6(C.valueStress), valueAll: r6(C.valueAll),
    sim: C.sim, landed: C.landed, lost: C.lost, rivals: C.rivals });
}
function cmpSheetToRef(C, R) {
  const a = normSheet(C), b = normSheet(R);
  if (a === b) return { ok: true, detail: C.sheet.length + " lines identical, including the stress-test simulation and the rivals' wants" };
  if (C.sheet.length !== R.sheet.length) return { ok: false, detail: C.sheet.length + " lines vs the reference's " + R.sheet.length };
  const la = C.sheet.map((e) => e.kind + " " + nameOf(e.add) + " for " + nameOf(e.drop)), lb = R.sheet.map((e) => e.kind + " " + nameOf(e.add) + " for " + nameOf(e.drop));
  const firstDiff = la.findIndex((x, i) => x !== lb[i]);
  return { ok: false, detail: firstDiff >= 0 ? "line " + (firstDiff + 1) + ": " + la[firstDiff] + " vs " + lb[firstDiff] : "same lines, different values or simulation (" + a.length + " vs " + b.length + " chars)" };
}
const samePos = (list, add, drop) => list.every((x) => P[x[add]] && P[x[drop]] && P[x[add]].p === P[x[drop]].p);

/* ================================================================ B1 · team ratings */
{
  const c = cmpCalib(M.calib, golden.calib);
  ok("B1 calibration: ka, kd, anchors and weeks equal golden.calib and rmse within 0.0005", c.ok, c.detail);
  const r = cmpRatings(M.RAT, golden.ratings, 0.001);
  ok("B1 ratings: every golden.ratings att and def within 0.001 (" + r.n + " numbers)", r.ok, r.detail);
  console.log("     " + r.detail);
  /* the same numbers from the reference engine, so any future drift is seen to be the port's */
  const rr = cmpRatings(M.RAT, refM.RAT, 1e-12);
  ok("B1 ratings equal the reference engine's to 1e-12", rr.ok, rr.detail);
}

/* ================================================================ B2 · match prices to goals */
{
  const o = cmpOdds(M.ODDS, golden.odds, M.matchOdds);
  ok("B2 odds: every golden.odds fixture priced, goals within 0.01, fair price within 0.0005, round trip within 1.2 pp", o.ok, o.detail);
  console.log("     " + o.detail);
  ok("B2 the margin is removed proportionally: devig(2.0, 3.5, 4.0) sums to one and reports a positive margin",
    (() => { const d = M.devig(2.0, 3.5, 4.0); return Math.abs(d.h + d.d + d.a - 1) < 1e-12 && d.margin > 0 && Math.abs(d.h / d.a - 2.0) < 1e-9; })(),
    JSON.stringify(M.devig(2.0, 3.5, 4.0)));
}

/* ================================================================ B3 · expected points */
{
  const e = cmpEp(M.ep, solverIn, 0.01);
  ok("B3 expected points: every player in solver_in.json, every gameweek " + solverIn.gws[0] + "–" + solverIn.gws[solverIn.gws.length - 1] + ", within 0.01", e.ok, e.detail);
  console.log("     " + e.detail);
  ok("B3 the horizon in solver_in.json is the one the engine derives (next to the later of the two horizons)",
    solverIn.gws[0] === next && solverIn.gws[solverIn.gws.length - 1] === Math.max(cEnd, dEnd) && solverIn.cEnd === cEnd && solverIn.dEnd === dEnd,
    "solver " + solverIn.gws[0] + "–" + solverIn.gws[solverIn.gws.length - 1] + ", engine " + next + "–" + Math.max(cEnd, dEnd));
  ok("B3 the calibration hook is empty on data without a model block, so nothing scales the reference maths",
    M.CAL && Object.keys(M.CAL).length === 0 && !DATA.model, JSON.stringify(M.CAL));
}

/* ================================================================ B4 · the greedy transfer search */
{
  const cs = M.classicSquad();
  const tr = M.classicTransfers(cs, next, cEnd, Math.min(cs.ft, 5));            // build.js line 17: how the kit produces it
  const t = cmpTransfers(tr, golden.classic.greedyTransfers);
  ok("B4 greedy transfers reproduce golden.classic.greedyTransfers, move for move, value within 0.05", t.ok, t.detail);
  console.log("     " + t.detail);
  const g2 = A.greedyTransfers(M, DATA);
  ok("B4 the analysis wrapper gives the same moves and names them out -> in",
    JSON.stringify(g2.moves.map((m) => m.label)) === JSON.stringify(golden.classic.greedyTransfers.moves) && Math.abs(g2.value - tr.value) < 1e-9 && g2.maxMoves === Math.min(cs.ft, 5),
    JSON.stringify(g2.moves.map((m) => m.label)));
  ok("B4 every transfer swaps like for like and stays inside the budget", tr.moves.every((m) => m.out.p === m.inn.p) && tr.bank >= -1e-9, "bank " + fmt(tr.bank));
}

/* ================================================================ B5 · claimability (E-097) */
{
  const pool = M.waiverPool();
  const before = pool.every((p) => M.howToGet(p) === "waiver");
  ok("B5 before waivers settle every unowned player is a claim: howToGet is \"waiver\" for all " + pool.length + " in the pool",
    DATA.draft.waiversProcessed === false && pool.length > 0 && before, "waiversProcessed " + DATA.draft.waiversProcessed);
  /* After they settle: `a` signs instantly, `l` (dropped since the run) stays a claim. The snapshot has
     no `l` player, so one is made: a synthetic fixture, not an expectation. */
  const D2 = clone(DATA); D2.draft.waiversProcessed = true;
  const aPl = D2.players.find((p) => p.did && !p.do && p.ds === "a"), lPl = D2.players.find((p) => p.did && !p.do && p.ds === "a" && p.id !== aPl.id);
  lPl.ds = "l";
  const M2 = ENG.create(D2);
  ok("B5 after waivers settle an available player signs instantly and a dropped-and-locked one is still a claim",
    M2.howToGet(M2.P[aPl.id]) === "free" && M2.howToGet(M2.P[lPl.id]) === "waiver",
    aPl.n + " " + M2.howToGet(M2.P[aPl.id]) + ", " + lPl.n + " (locked) " + M2.howToGet(M2.P[lPl.id]));
  const cl = A.claimability(M, DATA), cl2 = A.claimability(M2, D2);
  ok("B5 claimability names the phase and labels the whole pool: claims before the run, free and locked after it",
    cl.phase === "claims" && cl.pool.length === pool.length && cl.pool.every((x) => x.how === "waiver") &&
    cl2.phase === "free" && cl2.pool.find((x) => x.id === lPl.id).how === "waiver" && cl2.pool.find((x) => x.id === aPl.id).how === "free",
    cl.phase + " " + cl.pool.length + " · " + cl2.phase + " locked " + cl2.pool.filter((x) => x.ds === "l").length);
  ok("B5 the reference engine agrees on every label in the pool", pool.every((p) => refM.howToGet(p) === M.howToGet(refM.P[p.id])), "");
}

/* ================================================================ B7 · the claims sheet */
let C = null, R = null;
{
  const pairs = solverOut.draft.pairs;
  C = A.buildClaimSheet(M, DATA, pairs);
  const gg = cmpSheetToGolden(C, golden.draft.claims);
  ok("B7 the claims sheet reproduces golden.draft.claims: line count, strategy, each line's result, values within 0.5", gg.ok, gg.detail);
  console.log("     " + gg.detail);
  ok("B7 valueAll is also exposed as allFirst, the name the spec uses", C.allFirst === C.valueAll, fmt(C.allFirst));
  /* the stronger check: the reference implementation, run here on the same data */
  let refErr = null;
  try { const U = require(path.join(REF_APP, "ui.js")); R = U.makeUI(refM, DATA, refPRE, null).buildClaimSheet(pairs); } catch (e) { refErr = e; }
  ok("B7 the reference ui.js can be required under Node without a DOM and builds its sheet", !!R && Array.isArray(R.sheet), refErr ? refErr.message : "");
  if (R) { const lf = cmpSheetToRef(C, R); ok("B7 line for line equal to the reference implementation: ids, kinds, gains, stress-test simulation, landed, lost, rivals' wants", lf.ok, lf.detail); }
  /* one backup per slot, same position, not wanted by any rival, gain above 3 */
  const RL = M.rivalClaimLists(next, dEnd, 4), wanted = new Set(); Object.values(RL).forEach((v) => v.forEach((c) => wanted.add(c.add)));
  const backups = C.sheet.filter((e) => e.kind === "backup"), firsts = C.sheet.filter((e) => e.kind === "first");
  ok("B7 each backup sits under one first choice, shares its drop's position, is wanted by no rival and gains more than 3",
    backups.every((b) => { const f = firsts.find((x) => x.add === b.of); return f && f.drop === b.drop && P[b.add].p === P[b.drop].p && !wanted.has(b.add) && b.gain > 3; }) &&
    backups.length === new Set(backups.map((b) => b.of)).size,
    backups.length + " backups for " + firsts.length + " first choices");
  ok("B7 every rival is modelled with at most four distinct moves and never includes me",
    Object.keys(RL).length === DATA.draft.entries.length - 1 && !(DATA.draft.me in RL) && Object.values(RL).every((v) => v.length <= 4),
    Object.entries(RL).map(([k, v]) => k + ":" + v.length).join(" "));
  /* the additive v111 delta: the Monte Carlo orderings claimsMC compares, on request */
  const Cmc = A.buildClaimSheet(M, DATA, pairs, { mc: { runs: 300, seed: 909 } });
  ok("B7 with mc requested the kit's four orderings are compared and every landing chance is a probability",
    Cmc.orderings && Cmc.orderings.length === 4 && Cmc.orderings.every((o) => isFinite(o.mean) && o.name) && Cmc.land && Object.values(Cmc.land).every((v) => v >= 0 && v <= 1) &&
    isFinite(Cmc.meanValue) && normSheet(Cmc) === normSheet(C),
    Cmc.orderings ? Cmc.orderings.map((o) => o.name + " " + fmt(o.mean)).join(" · ") : "no orderings");
}

/* ================================================================ E-096 · like for like */
{
  ok("E-096 every claim on the sheet swaps a player for one in the same position", C && samePos(C.sheet, "add", "drop"), "");
  const T = A.findTrades(M, DATA);
  ok("E-096 every trade is position for position and never takes from my own roster",
    T.length > 0 && samePos(T, "get", "give") && T.every((t) => !M.draftRoster().some((r) => r.id === t.get)), T.length + " trades");
  const G = A.tradeGroups(T);
  ok("E-096 trades split into both-gain and ask, the both-gain list first, and the split loses nothing",
    G.both.every((t) => t.both && t.theirs > 0.2) && G.ask.every((t) => !t.both) && G.both.length + G.ask.length === T.length &&
    T.slice(0, G.both.length).every((t) => t.both),
    G.both.length + " both gain · " + G.ask.length + " ask");
  const refT = require(path.join(REF_APP, "ui.js")).makeUI(refM, DATA, refPRE, null).findTrades();
  ok("E-096 the trade list equals the reference implementation's, pair for pair",
    JSON.stringify(T.map((t) => [t.rival, t.get, t.give, r6(t.mine), r6(t.theirs), t.both])) === JSON.stringify(refT.map((t) => [t.rival, t.get, t.give, r6(t.mine), r6(t.theirs), t.both])),
    T.length + " vs " + refT.length);
  /* the guard: a cross-position pair never reaches the sheet */
  const bad = clone(solverOut.draft.pairs); const other = DATA.players.find((p) => p.did && !p.do && p.ds === "a" && p.p !== P[bad[0].drop].p);
  bad[0].add = other.id;
  let threw = null; try { A.buildClaimSheet(M, DATA, bad); } catch (e) { threw = e; }
  ok("E-096 a cross-position pair is refused by name rather than lodged",
    !!threw && /position/i.test(threw.message) && threw.message.indexOf(other.n) >= 0, threw ? threw.message : "no error was thrown");
}

/* ================================================================ B8 · Monte Carlo */
{
  const s1 = A.classicGameweekSim(M, DATA), s2 = A.classicGameweekSim(M, DATA), g = golden.classic.sim6;
  ok("B8 Classic gameweek simulation: p10, p50 and p90 within 2 of golden.classic.sim6 (" + g.p10 + "/" + g.p50 + "/" + g.p90 + ")",
    s1.gw === next && Math.abs(s1.p10 - g.p10) <= 2 && Math.abs(s1.p50 - g.p50) <= 2 && Math.abs(s1.p90 - g.p90) <= 2,
    "gameweek " + s1.gw + " · " + s1.p10 + "/" + s1.p50 + "/" + s1.p90 + " · mean " + fmt(s1.mean) + " · " + s1.draws + " draws, seed " + s1.seed);
  ok("B8 the same seed reproduces the same distribution", JSON.stringify(s1) === JSON.stringify(s2), "");
  const sr = A.classicGameweekSim(refM, DATA);
  ok("B8 the reference engine on the same seed gives the same distribution to the last digit", JSON.stringify(sr) === JSON.stringify(s1), fmt(sr.mean) + " vs " + fmt(s1.mean));
  const h1 = A.headToHead(M, DATA), h2 = A.headToHead(M, DATA), gh = golden.draft.h2h6;
  ok("B8 head-to-head against " + gh.opp + ": win within 0.02 and draw within 0.01 of golden.draft.h2h6",
    !!h1 && h1.opp === gh.opp && h1.gw === next && Math.abs(h1.win - gh.win) <= 0.02 && Math.abs(h1.draw - gh.draw) <= 0.01,
    h1 ? "v " + h1.opp + " win " + fmt(h1.win) + " draw " + fmt(h1.draw) + " lose " + fmt(h1.lose) + " · " + h1.draws + " draws, seed " + h1.seed : "no head-to-head");
  ok("B8 the head-to-head medians sit within 2 of golden (" + gh.me50 + "/" + gh.them50 + ")",
    !!h1 && Math.abs(h1.me.p50 - gh.me50) <= 2 && Math.abs(h1.them.p50 - gh.them50) <= 2, h1 ? h1.me.p50 + "/" + h1.them.p50 : "");
  ok("B8 the same seed reproduces the same head-to-head", JSON.stringify(h1) === JSON.stringify(h2), "");
  ok("B8 win, draw and lose sum to one and every percentile is ordered",
    !!h1 && Math.abs(h1.win + h1.draw + h1.lose - 1) < 1e-9 && s1.p10 <= s1.p50 && s1.p50 <= s1.p90 && h1.me.p10 <= h1.me.p50 && h1.me.p50 <= h1.me.p90, "");
}

/* ================================================================ B9 · post-mortems */
{
  const c = A.classicReviewSummary(M, DATA), d = A.draftReviewSummary(M, DATA), both = A.reviewSummary(M, DATA);
  ok("B9 classicReview(5) through the module equals the reference engine's, row for row",
    JSON.stringify(c.rows) === JSON.stringify(refM.classicReview(5)) && c.rows.length === refM.classicReview(5).length, c.rows.length + " rows");
  ok("B9 draftReview(5) through the module equals the reference engine's, row for row",
    JSON.stringify(d.rows) === JSON.stringify(refM.draftReview(5)) && d.rows.length === refM.draftReview(5).length, d.rows.length + " rows");
  ok("B9 Classic invariants: avoidable never exceeds what the bench scored, and the captain gap is never negative",
    c.rows.every((g) => g.leftOnBench <= g.bench + 1e-9 && g.capGap >= 0) && c.avoidable === c.rows.reduce((s, g) => s + g.leftOnBench, 0) && c.benchScored === c.rows.reduce((s, g) => s + g.bench, 0),
    c.rows.map((g) => "gw" + g.gw + " bench " + g.bench + " avoidable " + g.leftOnBench + " cap gap " + g.capGap).join(" · "));
  ok("B9 Classic totals: bench scored " + c.benchScored + ", avoidable " + c.avoidable + ", captain gap " + c.captainGap + " over " + c.rows.length + " gameweeks",
    c.captainGap === c.rows.reduce((s, g) => s + g.capGap, 0) && c.captainBest === c.rows.filter((g) => g.capGap === 0).length, "");
  ok("B9 Draft invariants: a result is flagged as flipped only where the best eleven beats the opponent and the real score did not",
    d.rows.every((g) => g.flip === (g.mine != null && g.mine <= g.opp && g.mine + g.leftOnBench > g.opp)) && d.rows.every((g) => g.leftOnBench <= (d.perWeek.find((w) => w.gw === g.gw) || {}).benchScored + 1e-9),
    d.rows.map((g) => "gw" + g.gw + " " + g.res + " " + g.mine + "-" + g.opp + " avoidable " + g.leftOnBench + (g.flip ? " flipped" : "")).join(" · "));
  ok("B9 the combined review keeps the two games apart and adds nothing across them",
    both.classic && both.draft && !("total" in both) && both.classic.game === "classic" && both.draft.game === "draft" &&
    JSON.stringify(both.classic) === JSON.stringify(c) && JSON.stringify(both.draft) === JSON.stringify(d), Object.keys(both).join(","));
  ok("B9 the module's rows carry no personal names: player names and team names only",
    !JSON.stringify(both).match(/player_first_name|player_last_name|player_name|"mgr"/), "");
}

/* ================================================================ mutations: each check can go red */
{
  const mk = ENG.create(DATA, { fixedK: { ka: golden.calib.ka + 0.5, kd: golden.calib.kd } });
  const r = cmpRatings(mk.RAT, golden.ratings, 0.001);
  ok("mutation: a rating exponent moved by 0.5 turns B1 red — " + r.detail.slice(0, 80), !r.ok, "the ratings did not move");
  const go = clone(golden.odds); go[Object.keys(go)[0]][0].lh += 0.05;
  const o = cmpOdds(M.ODDS, go, M.matchOdds);
  ok("mutation: one odds row moved by 0.05 goals turns B2 red — " + o.detail.split(" · ").pop().slice(0, 80), !o.ok, "the odds check did not notice");
  const si = clone(solverIn); si.players[0].ep[0] += 0.02;
  const e0 = cmpEp(M.ep, solverIn, 0.01), e = cmpEp(M.ep, si, 0.01);
  ok("mutation: one player's expected points moved by 0.02 turns B3 red — " + e.detail.split(" · ")[1], !e.ok && e.over === e0.over + 1, "misses " + e0.over + " before, " + e.over + " after");
  const gt = clone(golden.classic.greedyTransfers); gt.moves.reverse();
  const cs = M.classicSquad(), t = cmpTransfers(M.classicTransfers(cs, next, cEnd, Math.min(cs.ft, 5)), gt);
  ok("mutation: the golden moves in a different order turn B4 red", !t.ok, "the order was not checked");
  if (C && R) {
    /* A sheet with no backup line cannot have one swapped: that is itself a red (golden has backups),
       reported by name rather than by a stack trace (E-079). */
    const Cm = clone(C); const bk = Cm.sheet.findIndex((x) => x.kind === "backup");
    const alt = bk >= 0 ? M.waiverPool().find((p) => p.p === P[Cm.sheet[bk].drop].p && !Cm.sheet.some((x) => x.add === p.id)) : null;
    if (bk >= 0 && alt) Cm.sheet[bk].add = alt.id;
    const lf = cmpSheetToRef(Cm, R), gg = cmpSheetToGolden(Cm, golden.draft.claims);
    ok("mutation: one claim's backup swapped turns the line-for-line check red — " + lf.detail, bk >= 0 && !!alt && !lf.ok,
      bk < 0 ? "the sheet carries no backup line to swap" : !alt ? "no same-position alternative in the pool" : "the reference comparison did not notice");
    ok("mutation: the same swap turns the golden comparison red", bk >= 0 && !!alt && !gg.ok, gg.detail);
  }
  const blind = (p) => (p.ds === "l" ? "waiver" : "free");                   // the §7.4 defect: the phase ignored
  ok("mutation: a phase-blind label fails B5 — before waivers settle it calls " + M.waiverPool().filter((p) => blind(p) === "free").length + " claimable players \"free\"",
    !M.waiverPool().every((p) => blind(p) === "waiver"), "the phase-blind label passed, so the check is not about the phase");
}

finish();

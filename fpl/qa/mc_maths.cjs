#!/usr/bin/env node
/*
 * qa/mc_maths.cjs — the ported engine's maths, and the bookmaker prices it reads (v110 §5 E1 "maths" and
 * "market"; the kit's qa.js group 2, lines 37–50, and the market lines of group 8b, 160–164).
 *
 *   node qa/mc_maths.cjs
 *
 * WHAT IT PROVES, on data/mc_data.json through src/mc_engine.js (MCEngine.create):
 *   · match odds: home, draw and away sum to one for every fixture of the next gameweek priced by the engine
 *     and across a grid of goal rates; the side expected to score more wins more often
 *   · Poisson: the mass sums to one, the tail P(X ≥ t) falls as the bar rises, the clean-sheet chance
 *     P(X = 0) is e^−λ and falls as the goals against rise
 *   · quantiles are ordered and interpolate exactly; the seeded generator repeats for a seed and differs across
 *     seeds (every simulation in the app leans on that)
 *   · team ratings are normalised: the geometric mean of attack and of defence across the league is one
 *   · the price exponents fit the loaded market anchors closely (the kit's gate, rmse under 0.25) on at least
 *     the engine's own minimum number of anchors
 *   · bookmaker numbers are used where loaded: every side of every loaded match price is sourced "odds", and
 *     every club with a goal or clean-sheet anchor is sourced from the market in the anchor's gameweek
 *   · removing the margin gives fair chances that sum to one, the margin is Σ(1/price) − 1, and the fitted goals
 *     price back to the fair chances within the kit's 0.02
 *   market (kit 160, 162–164): every loaded match price, turned into goals and back, sits within 1.2 percentage
 *     points of its fair price (B2); every bookmaker margin is positive and under 15%; the loaded prices drive
 *     the next gameweek's projections; the favourite is expected to score more
 *
 * ALREADY PROVED ELSEWHERE, CITED AND NOT PORTED TWICE
 *   kit 161 every loaded price is a real fixture ....... qa/bake.cjs A7 (odds rows)
 *   golden.calib, golden.odds and golden.ratings ......... qa/parity.cjs B1, B2 (on the reference data)
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   The goal rates and prices below are synthetic INPUTS to the maths, not expectations about the season; the
 *   tolerances are the kit's and the spec's (B2: 1.2 pp), named where they are used. Every expectation about the
 *   data is read from the block or the engine.
 *
 * MUTATION
 *   The "fitted goals reproduce the fair odds" comparator is re-run with the home rate moved by a third of a
 *   goal and must go red; its red line is quoted (E-070).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const ENG = require(path.join(ROOT, "src", "mc_engine.js"));

let pass = 0, fail = 0;
const ok = (name, cond, detail, show) => {
  if (cond) { pass++; console.log("PASS " + name + (show && detail ? " — " + detail : "")); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const redLine = (name, cond, detail) => (cond ? null : "RED " + name + (detail ? " — " + detail : ""));
const finish = () => { console.log("SUITE mc_maths " + pass + "/" + (pass + fail)); process.exit(fail ? 1 : 0); };
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (e) { return null; } };
const near = (a, b, e) => Math.abs(a - b) <= e;
const pp = (x) => (x * 100).toFixed(2) + " pp";

/* Tolerances: the kit's and the spec's, not facts about the season. */
const FIT_TOL = 0.02;        // frozen-ok: kit qa.js line 49, fitted goals price back within 0.02
const ROUND_TRIP = 0.012;    // frozen-ok: v110 §5 B2, a price turned into goals and back within 1.2 percentage points
const RMSE_MAX = 0.25;       // frozen-ok: kit qa.js line 46, the market fit gate
const MARGIN_MAX = 0.15;     // frozen-ok: kit qa.js line 162, a sane bookmaker margin
const FAV_TIE = 0.02;        // frozen-ok: kit qa.js line 164, two sides within 2 pp are level
const MIN_ANCHORS = 6;       // frozen-ok: src/mc_engine.js fits the exponents only on six anchors or more

const MC = readJson("data/mc_data.json");
if (!MC) { ok("data/mc_data.json is readable", false, "unreadable"); finish(); }
let M = null;
try { M = ENG.create(MC); } catch (e) { ok("MCEngine.create(MC) runs on the block", false, e.message); finish(); }
ok("MCEngine.create(MC) runs and exposes the maths it is tested on",
  ["matchOdds", "lambdas", "devig", "fitRates", "fx"].every((k) => typeof M[k] === "function") && !!M.maths && !!M.RAT && !!M.calib && !!M.ODDS, "");
const G = MC.gw, next = G.next;
const X = M.maths;
const RATES = []; for (let a = 0.2; a <= 4.01; a += 0.3) RATES.push(Math.round(a * 100) / 100);   // synthetic inputs

/* ---------------------------------------------------------------- match odds */
{
  const fx = MC.fixtures.filter((f) => f.gw === next), bad = [];
  fx.forEach((f) => { const L = M.lambdas(f.h, { o: f.a, ha: "H" }, next), o = M.matchOdds(L.lf, L.la); if (!near(o.h + o.d + o.a, 1, 1e-9) || [o.h, o.d, o.a].some((v) => v < 0 || v > 1)) bad.push(f.h + "v" + f.a); });
  RATES.forEach((a) => RATES.forEach((b) => { const o = M.matchOdds(a, b); if (!near(o.h + o.d + o.a, 1, 1e-9)) bad.push(a + "/" + b); }));
  ok("home, draw and away sum to one for all " + fx.length + " GW" + next + " fixtures and a " + RATES.length + "×" + RATES.length + " grid of goal rates", fx.length > 0 && bad.length === 0, bad.slice(0, 5).join(", "));
  const worse = [];
  RATES.forEach((a) => RATES.forEach((b) => { if (a > b && !(M.matchOdds(a, b).h > M.matchOdds(b, a).h)) worse.push(a + ">" + b); }));
  ok("the side expected to score more wins more often, everywhere on the grid", worse.length === 0, worse.slice(0, 5).join(", "));
}

/* ---------------------------------------------------------------- Poisson */
{
  const mass = RATES.map((l) => { let s = 0; for (let k = 0; k < 60; k++) s += X.poisPmf(k, l); return s; });
  ok("the Poisson mass sums to one at every rate on the grid", mass.every((s) => near(s, 1, 1e-6)), mass.map((s) => s.toFixed(7)).join(","));
  const tails = []; RATES.forEach((l) => { for (let t = 1; t < 10; t++) if (!(X.poisTail(t + 1, l) < X.poisTail(t, l))) tails.push(l + "@" + t); });
  ok("the tail probability falls as the bar rises", tails.length === 0, tails.slice(0, 5).join(","));
  const cs = RATES.map((l) => X.poisPmf(0, l));
  ok("the clean-sheet chance is e^−λ and falls as the goals against rise",
    cs.every((c, i) => near(c, Math.exp(-RATES[i]), 1e-12) && (i === 0 || c < cs[i - 1])), cs.map((c) => c.toFixed(3)).join(","));
}

/* ---------------------------------------------------------------- quantiles and the generator */
{
  const a = []; for (let i = 0; i < 200; i++) a.push(i);
  ok("quantiles are ordered and interpolate exactly (0.1, 0.5, 0.9 of 0…199)",
    X.quantile(a, 0.1) < X.quantile(a, 0.5) && X.quantile(a, 0.5) < X.quantile(a, 0.9) && near(X.quantile(a, 0.5), 99.5, 1e-12),
    [0.1, 0.5, 0.9].map((q) => X.quantile(a, q)).join(","));
  const r1 = X.mulberry(42), r2 = X.mulberry(42), r3 = X.mulberry(43);
  const s1 = [], s2 = [], s3 = []; for (let i = 0; i < 50; i++) { s1.push(r1()); s2.push(r2()); s3.push(r3()); }
  ok("the random generator repeats for a given seed and differs for another, every draw in [0, 1)",
    s1.every((v, i) => v === s2[i]) && s1.some((v, i) => v !== s3[i]) && s1.concat(s3).every((v) => v >= 0 && v < 1), "");
}

/* ---------------------------------------------------------------- ratings and the fit */
{
  const T = M.teamNames, gm = (k) => Math.exp(T.reduce((s, t) => s + Math.log(M.RAT[t][k]), 0) / T.length);
  ok("ratings are normalised around one: geometric mean of attack " + gm("att").toFixed(9) + ", of defence " + gm("def").toFixed(9),
    T.length === MC.teams.length && near(gm("att"), 1, 1e-6) && near(gm("def"), 1, 1e-6), "");
  ok("the price exponents fit the market closely: rmse " + (M.calib.rmse == null ? "none" : M.calib.rmse.toFixed(3)) + " on " + M.calib.n + " anchors (ka " + M.calib.ka + ", kd " + M.calib.kd + ")",
    M.calib.rmse != null && M.calib.rmse < RMSE_MAX && M.calib.n >= MIN_ANCHORS, "gate " + RMSE_MAX);
}

/* ---------------------------------------------------------------- bookmaker numbers where loaded */
{
  const odds = (MC.intel && MC.intel.odds) || {}, bad = []; let n = 0;
  Object.keys(odds).forEach((g) => odds[g].forEach((r) => {
    const f = M.fx(r[0], +g).find((x) => x.o === r[1] && x.ha === "H"); if (!f) return; n++;
    const Lh = M.lambdas(r[0], f, +g), La = M.lambdas(r[1], M.fx(r[1], +g).find((x) => x.o === r[0]), +g);
    if (Lh.src !== "odds" || La.src !== "odds") bad.push("GW" + g + " " + r[0] + "v" + r[1] + " " + Lh.src + "/" + La.src);
  }));
  ok("every side of every loaded match price is sourced from the bookmaker (" + n + " matches over GW" + Object.keys(odds).join(", GW") + ")", n > 0 && bad.length === 0, bad.join("; "));
  /* The goal and clean-sheet anchors (intel.market5) apply to the anchor week the engine keys them to: the weeks
     the fit used that carry no match prices. Read from the engine, not typed. */
  const m5 = (MC.intel && MC.intel.market5) || {}, anchorWeeks = M.calib.weeks.filter((g) => !odds[g]);
  const miss = [];
  anchorWeeks.forEach((g) => Object.keys(m5).forEach((t) => { const f = M.fx(t, g)[0]; if (f && M.lambdas(t, f, g).src === "model") miss.push(t + " GW" + g); }));
  ok("every club with a goal or clean-sheet anchor is priced from the market in its anchor week (" + Object.keys(m5).length + " clubs, GW" + anchorWeeks.join(",") + ")",
    Object.keys(m5).length === 0 || (anchorWeeks.length > 0 && miss.length === 0), miss.join(", "));
}

/* ---------------------------------------------------------------- margin and fit */
const PRICES = [[1.5, 4.2, 6.5], [2.1, 3.4, 3.6], [3.8, 3.5, 2.0], [1.25, 6.5, 11]];   // synthetic inputs
function fitGap(fit, fair) { const r = M.matchOdds(fit.lh, fit.la); return Math.max(Math.abs(r.h - fair.h), Math.abs(r.d - fair.d), Math.abs(r.a - fair.a)); }
const N_FIT = "fitted goals reproduce the fair odds within " + FIT_TOL + " on " + PRICES.length + " price triples";
{
  const bad = PRICES.filter((p) => { const d = M.devig(p[0], p[1], p[2]), m = 1 / p[0] + 1 / p[1] + 1 / p[2] - 1; return !(near(d.h + d.d + d.a, 1, 1e-12) && d.margin > 0 && near(d.margin, m, 1e-12)); });
  ok("removing the margin gives fair chances that sum to one, and the margin is Σ(1/price) − 1", bad.length === 0, JSON.stringify(bad));
  const gaps = PRICES.map((p) => { const d = M.devig(p[0], p[1], p[2]); return fitGap(M.fitRates(d), d); });
  ok(N_FIT, gaps.every((g) => g < FIT_TOL), gaps.map(pp).join(", "));
  /* mutation: the same comparator on a fit whose home rate is a third of a goal out */
  const d0 = M.devig(PRICES[0][0], PRICES[0][1], PRICES[0][2]), f0 = M.fitRates(d0), bent = { lh: f0.lh + 0.33, la: f0.la };
  const gM = PRICES.map((p, i) => (i === 0 ? fitGap(bent, d0) : gaps[i]));
  const line = redLine(N_FIT, gM.every((g) => g < FIT_TOL), gM.map(pp).join(", "));
  ok("mutation: a fitted home rate moved by a third of a goal turns the fit check red", line !== null, line ? "red: " + line : "the check stayed green", true);
}

/* ---------------------------------------------------------------- market (kit 160, 162–164) */
{
  const rows = []; Object.keys(M.ODDS).forEach((g) => M.ODDS[g].forEach((o) => rows.push(Object.assign({ g: +g }, o))));
  const worst = rows.reduce((w, o) => { const r = M.matchOdds(o.lh, o.la), e = Math.max(Math.abs(r.h - o.fair.h), Math.abs(r.d - o.fair.d), Math.abs(r.a - o.fair.a)); return e > w.e ? { e: e, at: "GW" + o.g + " " + o.h + "v" + o.a } : w; }, { e: 0, at: "" });
  ok("every loaded match price, turned into goals and back, sits within 1.2 pp of its fair price (" + rows.length + " prices, worst " + pp(worst.e) + " " + worst.at + ")",
    rows.length > 0 && worst.e < ROUND_TRIP, "");
  const mg = rows.map((o) => o.fair.margin);
  ok("every bookmaker margin is positive and under 15% (" + (100 * Math.min.apply(null, mg)).toFixed(1) + "% to " + (100 * Math.max.apply(null, mg)).toFixed(1) + "%)",
    mg.every((m) => m > 0 && m < MARGIN_MAX), "");
  const first = (M.ODDS[next] || [])[0];
  ok("the loaded prices drive the next gameweek's projections (GW" + next + (first ? " " + first.h + "v" + first.a : "") + ")",
    (M.ODDS[next] || []).length === 0 || M.lambdas(first.h, M.fx(first.h, next).find((f) => f.o === first.a), next).src === "odds",
    first ? M.lambdas(first.h, M.fx(first.h, next)[0], next).src : "");
  const flip = rows.filter((o) => !((o.fair.h > o.fair.a) === (o.lh > o.la) || Math.abs(o.fair.h - o.fair.a) < FAV_TIE)).map((o) => o.h + "v" + o.a);
  ok("the favourite is expected to score more, wherever the two sides are not level", flip.length === 0, flip.join(", "));
}

finish();

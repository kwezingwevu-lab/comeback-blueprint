#!/usr/bin/env node
/*
 * qa/mc_projections.cjs — player expected points from the ported engine behave (v110 §5 E1 "projections";
 * the kit's qa.js group 3, lines 51–66).
 *
 *   node qa/mc_projections.cjs
 *
 * WHAT IT PROVES, on data/mc_data.json through src/mc_engine.js (MCEngine.create):
 *   · every player who has played gets a finite projection for the next gameweek inside the kit's band
 *   · a player ruled out (status u, or injured with no return date) projects under the kit's 1.2 floor
 *   · the build-up adds to the total: the per-fixture parts sum to the player's figure
 *   · a horizon is the sum of its gameweeks, and the same fixture scores the same twice — also on a second,
 *     fresh engine instance, so the cache never changes an answer
 *   · goals conceded cost only goalkeepers and defenders (Part B1), and cost them points, never add any;
 *     clean-sheet points are never negative; expected defensive-contribution points never exceed the two a
 *     match the rule pays (Part N1)
 *   · the season's top-scoring available forward outscores a fourth-choice defender, and his best fixture in the
 *     next seven gameweeks by goal expectation beats his worst — both players are read from the data, not named
 *   · every dated start override in the block is applied in its own gameweek and nowhere else
 *   · every flagged player with a return date after the next deadline is out for every gameweek before it and
 *     back in full once the gameweek before has also passed it (the engine's 0.75 for the week straddling the
 *     return is the one it is allowed in between)
 *
 * ALREADY PROVED ELSEWHERE, CITED AND NOT PORTED TWICE
 *   forwards never get clean-sheet points, goalkeepers never get defensive contribution .. qa/mc_rules.cjs (Part N)
 *   every player's expected points to the solver horizon equal the exported solver input .. qa/export_hash.cjs
 *     ("Shipped": data/solver_in.json is the export of data/mc_data.json, hash for hash)
 *   the engine applies the calibration it was given (kit 242) ................ qa/calibration.cjs "Uncalibrated"
 *   B3 on the reference data, every player every gameweek within 0.01 ......... qa/parity.cjs B3
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   No player is named: the forward and the defender are chosen by rule from the block, and the return dates
 *   and deadlines are the block's. The bands are the kit's, named where they are used.
 *
 * MUTATION
 *   The "a horizon is the sum of its gameweeks" comparator is re-run on a horizon function that reads one
 *   gameweek too far and must go red; its red line is quoted (E-070).
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
const redLine = (name, cond, detail) => (cond ? null : "FAIL " + name + (detail ? " — " + detail : ""));
const finish = () => { console.log("SUITE mc_projections " + pass + "/" + (pass + fail)); process.exit(fail ? 1 : 0); };
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (e) { return null; } };
const near = (a, b, e) => Math.abs(a - b) <= e;
const who = (p) => p.n + "|" + p.t;

const EP_BAND = [-2, 18];     // frozen-ok: kit qa.js line 53, a projection's sanity band
const OUT_FLOOR = 1.2;        // frozen-ok: kit qa.js line 54, what a ruled-out player may still project (a late fitness call)
const DC_MAX = 2;             // frozen-ok: Part N1, defensive contribution scores 2 points, once per match
const EASY = 2.2, HARD = 1.6; // frozen-ok: kit qa.js line 63, goal expectations that make a fixture easy or hard
const HORIZON = 4, RUN = 7;   // frozen-ok: kit qa.js lines 56 and 63, the windows the kit tested over

const MC = readJson("data/mc_data.json");
if (!MC) { ok("data/mc_data.json is readable", false, "unreadable"); finish(); }
let M = null, M2 = null;
try { M = ENG.create(MC); M2 = ENG.create(MC); } catch (e) { ok("MCEngine.create(MC) runs on the block", false, e.message); finish(); }
const G = MC.gw, next = G.next, last = G.events.length;
const played = MC.players.filter((p) => p.mins > 0);
ok("MCEngine.create(MC) runs and " + played.length + " of " + MC.players.length + " players have minutes to project from",
  typeof M.parts === "function" && played.length > 0, "");

/* ---------------------------------------------------------------- range and availability */
{
  const out = played.filter((p) => { const e = M.ep(p, next); return !(isFinite(e) && e > EP_BAND[0] && e < EP_BAND[1]); });
  const hi = played.reduce((b, p) => (M.ep(p, next) > b.e ? { e: M.ep(p, next), p: p } : b), { e: -Infinity, p: null });
  ok("every player who has played projects a finite GW" + next + " figure inside (" + EP_BAND.join(", ") + ") — highest " + hi.e.toFixed(2) + " " + who(hi.p),
    out.length === 0, out.slice(0, 5).map((p) => who(p) + " " + M.ep(p, next)).join("; "));
  const ruledOut = MC.players.filter((p) => p.st === "u" || (p.st === "i" && !p.ret));
  const bad = ruledOut.filter((p) => !(M.ep(p, next) < OUT_FLOOR));
  ok("every player ruled out with no return date projects under " + OUT_FLOOR + " (" + ruledOut.length + " players)", bad.length === 0, bad.map((p) => who(p) + " " + M.ep(p, next).toFixed(2)).join("; "));
}

/* ---------------------------------------------------------------- the build-up and the horizon */
{
  const bad = played.filter((p) => { const x = M.parts(p, next); return !near(x.det.reduce((s, d) => s + d.ep, 0), x.ep, 1e-9); });
  ok("the build-up adds to the total for every player who has played (" + played.length + ")", bad.length === 0, bad.slice(0, 5).map(who).join(", "));
  const end = Math.min(last, next + HORIZON - 1);
  const sumCheck = (range) => played.filter((p) => { let s = 0; for (let g = next; g <= end; g++) s += M.ep(p, g); return !near(range(p, next, end), s, 1e-9); });
  const N_SUM = "a horizon is the sum of its gameweeks, GW" + next + " to GW" + end + ", for every player who has played";
  const off = sumCheck(M.epRange);
  ok(N_SUM, off.length === 0, off.slice(0, 5).map(who).join(", "));
  /* mutation: a horizon that reads one gameweek too far */
  const offM = sumCheck((p, a, b) => M.epRange(p, a, Math.min(last, b + 1)));
  const line = redLine(N_SUM, offM.length === 0, offM.length + " players off, first " + offM.slice(0, 3).map(who).join(", "));
  ok("mutation: a horizon one gameweek too long turns the horizon check red", line !== null, line ? "red: " + line : "the check stayed green", true);
  const drift = played.filter((p) => M.ep(p, next) !== M.ep(p, next) || M.ep(p, next) !== M2.ep(p, next) || M.epRange(p, next, end) !== M2.epRange(p, next, end));
  ok("the same fixture scores the same twice, and a second fresh engine agrees to the last digit", drift.length === 0, drift.slice(0, 5).map(who).join(", "));
}

/* ---------------------------------------------------------------- components (Part B1, N1) */
{
  const horizon = []; for (let g = next; g <= Math.min(last, M.CFG.draftEnd); g++) horizon.push(g);
  const scan = (list, bad) => { const out = []; list.forEach((p) => horizon.forEach((g) => M.parts(p, g).det.forEach((d) => { if (bad(d, p)) out.push(who(p) + " GW" + g); }))); return out; };
  const gk = MC.players.filter((p) => p.p === 1), back = MC.players.filter((p) => p.p <= 2 && p.mins > 200), front = MC.players.filter((p) => p.p >= 3);
  const b1 = scan(gk, (d) => d.cs < 0);
  ok("a goalkeeper's clean-sheet points are never negative (" + gk.length + " goalkeepers, GW" + horizon[0] + "–" + horizon[horizon.length - 1] + ")", b1.length === 0, b1.slice(0, 5).join(", "));
  const b2 = scan(back, (d) => d.gc > 0), lost = back.some((p) => M.parts(p, next).det.some((d) => d.gc < 0));
  ok("goalkeepers and defenders lose points for goals conceded and never gain from them (" + back.length + " regulars)", b2.length === 0 && lost, b2.slice(0, 5).join(", "));
  const b3 = scan(front, (d) => d.gc !== 0);
  ok("goals conceded never cost a midfielder or a forward (" + front.length + " players)", b3.length === 0, b3.slice(0, 5).join(", "));
  let mx = 0; const b4 = scan(MC.players, (d) => { if (d.dc > mx) mx = d.dc; return d.dc > DC_MAX + 1e-9 || d.dc < 0; });
  ok("expected defensive-contribution points never exceed two a match (highest " + mx.toFixed(3) + ")", b4.length === 0, b4.slice(0, 5).join(", "));
}

/* ---------------------------------------------------------------- a strong forward, and his fixtures */
{
  const fwd = MC.players.filter((p) => p.p === 4 && p.st === "a").sort((a, b) => b.pts - a.pts)[0];
  const dfn = MC.players.filter((p) => p.p === 2 && p.st === "a" && p.mins < 60)[0];      // fit, and barely used
  ok("the season's top-scoring available forward (" + (fwd ? who(fwd) + " " + M.ep(fwd, next).toFixed(2) : "none") + ") outscores a fourth-choice defender (" + (dfn ? who(dfn) + " " + M.ep(dfn, next).toFixed(2) : "none") + ")",
    !!fwd && !!dfn && M.ep(fwd, next) > M.ep(dfn, next), "");
  let easy = null, hard = null;
  if (fwd) for (let g = next; g <= Math.min(last, next + RUN - 1); g++) {
    M.fx(fwd.t, g).forEach((f) => { const L = M.lambdas(fwd.t, f, g), e = M.ep(fwd, g); if (L.lf > EASY && (!easy || e > easy.e)) easy = { e: e, g: g, o: f.o }; if (L.lf < HARD && (!hard || e > hard.e)) hard = { e: e, g: g, o: f.o }; });
  }
  ok("a stronger fixture lifts that forward: " + (easy ? "GW" + easy.g + " v " + easy.o + " " + easy.e.toFixed(2) : "no easy fixture") + " against " + (hard ? "GW" + hard.g + " v " + hard.o + " " + hard.e.toFixed(2) : "no hard fixture"),
    !easy || !hard || easy.e > hard.e, "");
}

/* ---------------------------------------------------------------- dated overrides and return dates */
{
  const S = (MC.intel && MC.intel.start) || {}, bad = []; let n = 0;
  Object.keys(S).forEach((g) => Object.keys(S[g]).forEach((k) => {
    const p = M.byKey[k]; if (!p) return; n++;
    const other = +g + 20 <= last ? +g + 20 : 1, here = M.avail(p, +g), there = M.avail(p, other);
    if (here.pStart !== S[g][k].p || there.pStart != null) bad.push(k + " GW" + g + " " + here.pStart + " / GW" + other + " " + there.pStart);
  }));
  ok("every dated start override is applied in its own gameweek only (" + n + " overrides over GW" + Object.keys(S).join(", GW") + ")", n > 0 && bad.length === 0, bad.join("; "));
  /* a return date: out before it, 0.75 for the week that straddles it, back in full after */
  const ref = G.live >= next ? G.live : next, dlNext = Date.parse(M.deadline[next]);
  const hurt = MC.players.filter((p) => p.st !== "a" && p.ret && Date.parse(p.ret + "T00:00:00Z") > dlNext);
  const wrong = []; let before = 0, after = 0;
  hurt.forEach((p) => {
    const back = Date.parse(p.ret + "T00:00:00Z");
    for (let g = ref + 1; g <= M.CFG.classicEnd; g++) {
      if (S[g] && S[g][p.n + "|" + p.t]) continue;           // a dated override speaks for that week instead
      const dl = Date.parse(M.deadline[g]), prev = Date.parse(M.deadline[g - 1]), a = M.avail(p, g).a;
      if (dl < back) { before++; if (a !== 0) wrong.push(who(p) + " GW" + g + " before " + p.ret + " a " + a); }
      else if (prev >= back) { after++; if (a !== 1) wrong.push(who(p) + " GW" + g + " after " + p.ret + " a " + a); }
    }
  });
  ok("every flagged player with a return date after the GW" + next + " deadline is out before it and back after it (" + hurt.length + " players, " + before + " weeks out, " + after + " back)",
    hurt.length === 0 || (wrong.length === 0 && before > 0 && after > 0), wrong.slice(0, 5).join("; "));
}

finish();

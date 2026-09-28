#!/usr/bin/env node
/*
 * qa/mc_simulation.cjs — the Monte Carlo behaves (v110 §5 B8, E1 "simulation"; the kit's qa.js group 7, lines
 * 109–127, and its claims-run line 249–250).
 *
 *   node qa/mc_simulation.cjs
 *
 * WHAT IT PROVES, on data/mc_data.json through src/mc_engine.js and src/mc_analysis.js
 *   Classic gameweek (the best eleven from the last published fifteen, the gameweek in focus):
 *     · the same seed gives the same distribution to the last digit, and another seed a different one
 *     · the percentiles are ordered, min ≤ p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90 ≤ max
 *     · the simulated mean sits within the kit's 8 points of the projection (the eleven's expected points plus the
 *       captain's again)
 *     · scores are never below the kit's floor of −5 in practice
 *     · a triple captain scores more than a double
 *   Draft head-to-head (the gameweek in focus, against the opponent the fixture list names):
 *     · win, draw and lose sum to one, and the result is not a landslide either way (the kit's 5%–95%)
 *     · a saved eleven is used once published: every side built from a manager's published picks is marked saved,
 *       and a side built with none is the best eleven, not saved
 *   Title race (every remaining Draft match to the Draft horizon): each manager's chance of finishing first sums
 *     to one across the league, the top-three chances sum to three, and every average finish is inside the table
 *   Claims run: the probabilistic waiver run repeats for a seed, and an empty claims list is worth exactly the
 *     roster as it stands
 *   The shipped numbers are the engine's: data/pre.json's Classic simulation and head-to-head equal
 *     classicGameweekSim and headToHead run here on the same draws and seed, field for field.
 *
 * ALREADY PROVED ELSEWHERE, CITED AND NOT PORTED TWICE
 *   B8 against golden (GW6 win 51.9% ± 2 pp, p10/p50/p90 37/52/71 ± 2) on the reference data .. qa/parity.cjs B8
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   The draws, seeds and bands are the kit's (qa.js 111–126) and the shipped precompute's own (read from pre.json);
 *   no score, percentile or probability is typed as an expectation.
 *
 * MUTATION
 *   The comparator that holds pre.json to the engine is re-run against a simulation on another seed and must go
 *   red; its red line is quoted (E-070).
 *
 * PRIVACY
 *   Draft opponents appear as team names only.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const ENG = require(path.join(ROOT, "src", "mc_engine.js"));
const AN = require(path.join(ROOT, "src", "mc_analysis.js"));

let pass = 0, fail = 0;
const ok = (name, cond, detail, show) => {
  if (cond) { pass++; console.log("PASS " + name + (show && detail ? " — " + detail : "")); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const redLine = (name, cond, detail) => (cond ? null : "FAIL " + name + (detail ? " — " + detail : ""));
const finish = () => { console.log("SUITE mc_simulation " + pass + "/" + (pass + fail)); process.exit(fail ? 1 : 0); };
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (e) { return null; } };
const near = (a, b, e) => Math.abs(a - b) <= e;
const pct = (x) => (100 * x).toFixed(1) + "%";

const SIM_N = 3000, TC_N = 2000, SIM_SEED = 7;       // frozen-ok: the kit's draws and seed, qa.js lines 111 and 116
const H2H_N = 4000, H2H_SEED = 5;                    // frozen-ok: kit qa.js line 120
const RACE_N = 1500, RACE_SEED = 3;                  // frozen-ok: kit qa.js line 124
const MC_RUNS = 200, MC_SEED = 5;                    // frozen-ok: kit qa.js line 249
const NEAR_PROJ = 8, FLOOR = -5;                     // frozen-ok: kit qa.js lines 114 and 115
const LANDSLIDE = [0.05, 0.95];                      // frozen-ok: kit qa.js line 123
const TOP = 3;                                       // frozen-ok: a top three is three places

const MC = readJson("data/mc_data.json"), PRE = readJson("data/pre.json");
ok("the baked block and the precomputed results are readable", !!MC && !!PRE && !!PRE.classicSim && !!PRE.h2h, [!!MC, !!PRE].join(","));
if (!MC || !PRE) finish();
const M = ENG.create(MC), H = AN.mcHorizon(M, MC), focus = H.focus, me = MC.draft.me;

/* ---------------------------------------------------------------- Classic gameweek */
const cs = M.classicSquad();
if (cs) {
  const b = M.bestXI(cs.squad, focus), side = { xi: b.xi, bench: b.bench, benchGk: b.benchGk, captain: b.cap, vice: b.vice };
  const s1 = M.summarise(M.simulate(focus, [side], SIM_N, SIM_SEED)[0]), s2 = M.summarise(M.simulate(focus, [side], SIM_N, SIM_SEED)[0]), s3 = M.summarise(M.simulate(focus, [side], SIM_N, SIM_SEED + 1)[0]);
  ok("Classic GW" + focus + ": the same seed gives the same distribution to the last digit, and another seed a different one (mean " + s1.mean.toFixed(2) + ")",
    JSON.stringify(s1) === JSON.stringify(s2) && JSON.stringify(s1) !== JSON.stringify(s3), "");
  ok("Classic GW" + focus + ": the percentiles are ordered (" + [s1.min, s1.p10, s1.p25, s1.p50, s1.p75, s1.p90, s1.max].join(" ≤ ") + ")",
    s1.min <= s1.p10 && s1.p10 <= s1.p25 && s1.p25 <= s1.p50 && s1.p50 <= s1.p75 && s1.p75 <= s1.p90 && s1.p90 <= s1.max, "");
  const proj = b.tot + b.capV;
  ok("Classic GW" + focus + ": the simulated mean " + s1.mean.toFixed(1) + " sits within " + NEAR_PROJ + " of the projection " + proj.toFixed(1), Math.abs(s1.mean - proj) < NEAR_PROJ, "");
  ok("Classic GW" + focus + ": no simulated score falls below " + FLOOR + " (lowest " + s1.min + ")", s1.min > FLOOR, "");
  const tc = M.summarise(M.simulate(focus, [Object.assign({}, side, { tc: true })], TC_N, SIM_SEED)[0]), dc = M.summarise(M.simulate(focus, [side], TC_N, SIM_SEED)[0]);
  ok("Classic GW" + focus + ": a triple captain scores more than a double (" + tc.mean.toFixed(2) + " against " + dc.mean.toFixed(2) + ")", tc.mean > dc.mean, "");
} else ok("the Classic squad is in the block", false, "classicSquad() returned nothing");

/* ---------------------------------------------------------------- Draft head-to-head */
{
  const m = MC.draft.matches.find((x) => x.gw === focus && (x.a === me || x.b === me));
  ok("the Draft fixture list names my opponent in GW" + focus + (m ? " (" + (m.a === me ? m.b : m.a) + ")" : ""), !!m, "");
  if (m) {
    const on = m.a === me ? m.b : m.a, inPlay = focus === H.inPlay, now = MC.draft.rivalsNow || {};
    const mine = M.sideFromRoster(M.draftRoster(), focus, inPlay ? now[me] : null), theirs = M.sideFromRoster(M.draftRoster(on), focus, inPlay ? now[on] : null);
    const r = M.h2h(focus, mine, theirs, H2H_N, H2H_SEED);
    ok("GW" + focus + " head-to-head: win, draw and lose sum to one (" + pct(r.win) + " / " + pct(r.draw) + " / " + pct(r.lose) + ")", near(r.win + r.draw + r.lose, 1, 1e-9), "");
    ok("GW" + focus + " head-to-head is not a landslide either way (win " + pct(r.win) + ", inside " + LANDSLIDE.map(pct).join("–") + ")", r.win > LANDSLIDE[0] && r.win < LANDSLIDE[1], "");
  }
  /* a saved eleven once published: every manager whose picks the block carries */
  const pub = Object.keys(MC.draft.rivalsNow || {}), bad = [];
  pub.forEach((nm) => {
    const withPicks = M.sideFromRoster(M.draftRoster(nm), MC.gw.live, MC.draft.rivalsNow[nm]), without = M.sideFromRoster(M.draftRoster(nm), MC.gw.live, null);
    const pk = MC.draft.rivalsNow[nm].filter((k) => k.pos <= 11).map((k) => k.id).sort().join(",");
    if (!withPicks || !withPicks.saved || withPicks.xi.map((p) => p.id).sort().join(",") !== pk || !without || without.saved) bad.push(nm);
  });
  ok("a saved eleven is used once published: " + pub.length + " managers' published picks give saved sides with exactly those elevens, and no picks gives the best eleven",
    pub.length > 0 && bad.length === 0, bad.join(", "));
}

/* ---------------------------------------------------------------- title race */
{
  const race = M.titleRace(H.next, H.dEnd, RACE_N, RACE_SEED), n = MC.draft.entries.length;
  const first = race.reduce((s, r) => s + r.first, 0), top = race.reduce((s, r) => s + r.top3, 0);
  ok("title race to GW" + H.dEnd + ": finishing-first chances sum to one, top-three chances to three, every average finish inside 1–" + n + " (leader " + race[0].name + " " + pct(race[0].first) + ")",
    race.length === n && near(first, 1, 1e-6) && near(top, Math.min(TOP, n), 1e-6) && race.every((r) => r.pos >= 1 && r.pos <= n && r.first >= 0 && r.first <= 1), "first " + first + " top " + top);
}

/* ---------------------------------------------------------------- claims run */
{
  const r1 = M.claimsMC([{ name: "none", list: [] }], { runs: MC_RUNS, seed: MC_SEED }), r2 = M.claimsMC([{ name: "none", list: [] }], { runs: MC_RUNS, seed: MC_SEED });
  ok("the probabilistic waiver run repeats for a seed, and an empty list is worth exactly the roster as it stands (" + r1.base.toFixed(2) + ")",
    near(r1.res[0].mean, r2.res[0].mean, 1e-9) && near(r1.base, r1.res[0].mean, 1e-9) && JSON.stringify(r1.res[0]) === JSON.stringify(r2.res[0]), (r1.res[0].mean - r1.base).toExponential(2));
}

/* ---------------------------------------------------------------- the shipped numbers are the engine's */
const FIELDS = ["gw", "draws", "seed", "mean", "sd", "p10", "p25", "p50", "p75", "p90", "min", "max"];
function diff(a, b, keys) { return keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => k + " " + JSON.stringify(a[k]) + " vs " + JSON.stringify(b[k])); }
const N_PRE = "data/pre.json's Classic simulation is classicGameweekSim run here on its draws and seed, field for field";
{
  const S = AN.classicGameweekSim(M, MC, { draws: PRE.classicSim.draws, seed: PRE.classicSim.seed });
  const d = S ? diff(PRE.classicSim, S, FIELDS.concat(["game", "saved"])) : ["not computed"];
  ok(N_PRE + " (GW" + PRE.classicSim.gw + ", " + PRE.classicSim.draws + " draws, p50 " + PRE.classicSim.p50 + ")", d.length === 0, d.join("; "));
  const Hh = AN.headToHead(M, MC, { draws: PRE.h2h.draws, seed: PRE.h2h.seed });
  const dh = Hh ? diff(PRE.h2h, Hh, ["game", "gw", "opp", "mySaved", "theirSaved", "draws", "seed", "win", "draw", "lose"]).concat(diff(PRE.h2h.me, Hh.me, FIELDS.slice(3)), diff(PRE.h2h.them, Hh.them, FIELDS.slice(3))) : ["not computed"];
  ok("data/pre.json's head-to-head is headToHead run here on its draws and seed, field for field (GW" + PRE.h2h.gw + " v " + PRE.h2h.opp + ", win " + pct(PRE.h2h.win) + ")", dh.length === 0, dh.join("; "));
  /* mutation: the same comparator against the simulation on the next seed */
  const S2 = AN.classicGameweekSim(M, MC, { draws: PRE.classicSim.draws, seed: PRE.classicSim.seed + 1 }), d2 = diff(PRE.classicSim, S2, FIELDS);
  const line = redLine(N_PRE, d2.length === 0, d2.slice(0, 3).join("; "));
  ok("mutation: a simulation on another seed turns the pre.json comparator red", line !== null, line ? "red: " + line : "the comparator stayed green", true);
}

finish();

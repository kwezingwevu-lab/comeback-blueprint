#!/usr/bin/env node
/*
 * qa/mc_property.cjs — property tests over thousands of generated cases (v110 §5 E1 "property", at least
 * 3,900 generated cases; the kit's qa.js group 6, lines 94–108, plus six families the kit did not have).
 *
 *   node qa/mc_property.cjs
 *
 * WHAT IT PROVES, on data/mc_data.json through src/mc_engine.js (MCEngine.create), on a seeded generator so a
 * counterexample is reproducible:
 *   The kit's three families, with the kit's loop bounds:
 *     K1  a random player in a random gameweek of the next ten: a finite projection inside the kit's band, and in
 *         every fixture a start chance in [0, 1], a playing chance at least the start chance, a clean-sheet chance
 *         in [0, 1]                                                     (one case per player-week and per fixture)
 *     K2  a random fifteen in the 2/5/5/3 shape from the players who are not ruled out: the best eleven is legal
 *         (1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD) and scores at least zero; the same fifteen reversed gives the same
 *         total, so the order of a squad never changes the answer                 (two cases per squad)
 *     K3  a random manager's Draft roster in a random gameweek of the next four: eleven on the pitch and fifteen
 *         in all, the reserve keeper counted                                     (one case per roster)
 *   Six more families:
 *     P4  match odds on random goal rates: home, draw and away in [0, 1], summing to one, and more goals for the
 *         home side never lowers his chance of winning
 *     P5  the margin removed from random prices: fair chances in (0, 1) summing to one, a margin of Σ(1/price) − 1,
 *         and the shorter price always the likelier outcome
 *     P6  goals fitted to a realisable match (odds made from random rates) price back within the kit's 0.02
 *     P7  the league's waiver processing on random claim lists (random managers' drops, random targets from the
 *         pool and from each other's lists): no player lands twice, every landed drop is the claimant's own and is
 *         used once, a claim on a player already taken is reported "already claimed" before its drop is checked,
 *         and a manager lands at most one claim a round
 *     P8  a shortlist of distinct moves from random subsets of the Draft moves: never the same player twice, never
 *         more than asked, never under the minimum gain, and in the order it was given
 *     P9  quantiles of random samples: ordered, and inside the sample's range
 *
 * THE COUNT
 *   The floor is the spec's, 3,900 (v110 §5 E1). The suite prints how many cases ran, and separately how many the
 *   kit's three families alone ran against the minimum their loop bounds guarantee (K1 at least one case per
 *   player-week, K2 two per squad, K3 one per roster).
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   The random inputs are generated here from a fixed seed; the bands and tolerances are the kit's, named where
 *   used; the shapes are rules of the game (frozen-ok).
 *
 * MUTATION
 *   K2's invariants are re-run with a "best eleven" that takes the first legal eleven in the order it is given, and
 *   must find counterexamples (the order of the squad changes the answer); its red line is quoted (E-070).
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
const finish = () => { console.log("SUITE mc_property " + pass + "/" + (pass + fail)); process.exit(fail ? 1 : 0); };
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (e) { return null; } };
const near = (a, b, e) => Math.abs(a - b) <= e;

const SPEC_FLOOR = 3900;                              // frozen-ok: v110 §5 E1, "property (at least 3,900 generated cases)"
const N1 = 1500, N2 = 400, N3 = 120;                  // frozen-ok: the kit's loop bounds, qa.js lines 96, 99 and 105
const N4 = 800, N5 = 800, N6 = 120, N7 = 300, N8 = 300, N9 = 300;   // frozen-ok: this suite's own loop bounds
const EP_BAND = [-2, 20];                             // frozen-ok: kit qa.js line 97, the property band
const FIT_TOL = 0.02;                                 // frozen-ok: kit qa.js line 49, fitted goals price back within 0.02
const SHAPE = { 1: 2, 2: 5, 3: 5, 4: 3 };             // frozen-ok: Part N1/N2, 2/5/5/3
const XI_RANGE = { 1: [1, 1], 2: [3, 5], 3: [2, 5], 4: [1, 3] };   // frozen-ok: Part N1, the eleven's shape
const SQUAD = 15, XI = 11;                            // frozen-ok: Part N1/N2

const MC = readJson("data/mc_data.json");
if (!MC) { ok("data/mc_data.json is readable", false, "unreadable"); finish(); }
const M = ENG.create(MC), G = MC.gw, next = G.next, season = G.events.length;
const rnd = M.maths.mulberry(99);                     // the kit's seed
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi) => lo + (hi - lo) * rnd();
const counts = (list) => { const c = { 1: 0, 2: 0, 3: 0, 4: 0 }; list.forEach((p) => { c[p.p]++; }); return c; };
const legalXi = (b) => { if (!b || b.xi.length !== XI) return false; const c = counts(b.xi); return [1, 2, 3, 4].every((k) => c[k] >= XI_RANGE[k][0] && c[k] <= XI_RANGE[k][1]); };
let total = 0, kit = 0;
const report = [];
function family(tag, label, fn) {
  const r = { cases: 0, bad: [] }; fn(r);
  total += r.cases; if (/^K/.test(tag)) kit += r.cases;
  report.push(tag + " " + r.cases);
  ok(tag + " " + label + " — " + r.cases.toLocaleString("en-ZA") + " cases", r.cases > 0 && r.bad.length === 0, r.bad.length + " counterexamples, first " + r.bad.slice(0, 3).join("; "));
  return r;
}

/* ---------------------------------------------------------------- the kit's three families */
family("K1", "a random player in a random gameweek projects inside the band, with every chance a probability", (r) => {
  for (let i = 0; i < N1; i++) {
    const p = pick(MC.players), g = next + Math.floor(rnd() * Math.min(10, season - next + 1)), x = M.parts(p, g);
    r.cases++; if (!isFinite(x.ep) || x.ep < EP_BAND[0] || x.ep > EP_BAND[1]) r.bad.push(p.n + " GW" + g + " " + x.ep);
    x.det.forEach((d) => { r.cases++; if (d.pStart < 0 || d.pStart > 1.0001 || d.pPlay < d.pStart - 1e-9 || d.pcs < 0 || d.pcs > 1) r.bad.push(p.n + " GW" + g + " chances"); });
  }
});
const fit = MC.players.filter((p) => p.st !== "u");
function randomFifteen() { const picks = []; while (picks.length < SQUAD) { const p = pick(fit); if (counts(picks)[p.p] < SHAPE[p.p] && picks.indexOf(p) < 0) picks.push(p); } return picks; }
const SQUADS = []; for (let i = 0; i < N2; i++) SQUADS.push({ picks: randomFifteen(), g: next + Math.floor(rnd() * 5) });
function k2(best, r) {
  SQUADS.forEach((s) => {
    const b = best(s.picks, s.g); r.cases++;
    if (!legalXi(b) || b.tot < 0) r.bad.push("GW" + s.g + " " + (b ? b.form : "none"));
    const alt = best(s.picks.slice().reverse(), s.g); r.cases++;
    if (!alt || !b || !near(alt.tot, b.tot, 1e-6)) r.bad.push("GW" + s.g + " reversed " + (alt ? alt.tot.toFixed(2) : "none") + " vs " + (b ? b.tot.toFixed(2) : "none"));
  });
}
const N_K2 = "a random 2/5/5/3 fifteen gets a legal best eleven, and reversing the fifteen never changes its total";
const k2r = family("K2", N_K2.replace(/^a random/, "a random"), (r) => k2(M.bestXI, r));
family("K3", "a random manager's Draft roster fields eleven and holds fifteen with the reserve keeper", (r) => {
  for (let i = 0; i < N3; i++) {
    const g = next + Math.floor(rnd() * 4), ros = M.draftRoster(pick(MC.draft.entries).name), b = M.bestXI(ros, g); r.cases++;
    if (!b || b.xi.length !== XI || b.xi.concat(b.bench, b.benchGk ? [b.benchGk] : []).length !== SQUAD) r.bad.push("GW" + g);
  }
});
{
  /* mutation: a "best eleven" that fills the first legal formation in the order the squad is given */
  const naive = (sq, g) => {
    const by = (k) => sq.filter((p) => p.p === k), f = ENG.FORMATIONS[0];
    const xi = [by(1)[0]].concat(by(2).slice(0, f[0]), by(3).slice(0, f[1]), by(4).slice(0, f[2]));
    return { xi: xi, form: f.join("-"), tot: xi.reduce((s, p) => s + M.ep(p, g), 0) };
  };
  const r = { cases: 0, bad: [] }; k2(naive, r);
  const line = redLine("K2 " + N_K2 + " — " + r.cases + " cases", r.bad.length === 0, r.bad.length + " counterexamples, first " + r.bad.slice(0, 2).join("; "));
  ok("mutation: a best eleven that depends on the squad's order turns K2 red", line !== null, line ? "red: " + line : "K2 stayed green", true);
}

/* ---------------------------------------------------------------- six more families */
family("P4", "match odds on random goal rates are probabilities summing to one, and more home goals never lower the home win", (r) => {
  for (let i = 0; i < N4; i++) {
    const a = between(0.1, 4.5), b = between(0.1, 4.5), o = M.matchOdds(a, b), up = M.matchOdds(a + between(0.05, 1), b); r.cases++;
    if (!near(o.h + o.d + o.a, 1, 1e-9) || [o.h, o.d, o.a].some((v) => v < 0 || v > 1) || up.h < o.h - 1e-12) r.bad.push(a.toFixed(2) + "/" + b.toFixed(2));
  }
});
family("P5", "the margin removed from random prices leaves fair chances summing to one, the margin Σ(1/price) − 1, the shorter price the likelier", (r) => {
  for (let i = 0; i < N5; i++) {
    const h = between(1.05, 15), d = between(2.5, 9), a = between(1.05, 15), f = M.devig(h, d, a); r.cases++;
    const okOrder = (h < a) === (f.h > f.a) || h === a;
    if (!near(f.h + f.d + f.a, 1, 1e-12) || [f.h, f.d, f.a].some((v) => v <= 0 || v >= 1) || !near(f.margin, 1 / h + 1 / d + 1 / a - 1, 1e-12) || !okOrder) r.bad.push([h, d, a].map((x) => x.toFixed(2)).join("/"));
  }
});
family("P6", "goals fitted to a realisable match price back within " + FIT_TOL, (r) => {
  for (let i = 0; i < N6; i++) {
    const t = M.matchOdds(between(0.4, 3.4), between(0.4, 3.4)), f = M.fitRates(t), back = M.matchOdds(f.lh, f.la); r.cases++;
    const e = Math.max(Math.abs(back.h - t.h), Math.abs(back.d - t.d), Math.abs(back.a - t.a)); if (!(e < FIT_TOL)) r.bad.push((e * 100).toFixed(2) + " pp");
  }
});
family("P7", "the league's waiver processing on random claim lists: nobody lands a player twice, drops are the claimant's own and used once, a taken target is reported first, one landing a manager a round", (r) => {
  const order = M.waiverOrder(), me = MC.draft.me, pool = M.waiverPool().map((p) => p.id);
  for (let i = 0; i < N7; i++) {
    const lists = {}, targets = pool.slice(0, 25);
    order.forEach((nm) => { const ros = MC.draft.rosters[nm], n = Math.floor(rnd() * 6), L = []; for (let k = 0; k < n; k++) L.push({ add: pick(targets), drop: pick(ros) }); lists[nm] = L; });
    const mine = lists[me]; delete lists[me];
    const sim = M.waiverSim(mine, lists, order), landed = new Set(), dropped = {}, perRound = {}, takenAt = {};
    sim.log.forEach((x, j) => {
      r.cases++;
      if (x.ok) {
        const key = x.who + "@" + x.round;
        if (landed.has(x.add)) r.bad.push("run " + i + " " + x.add + " landed twice");
        if ((MC.draft.rosters[x.who] || []).indexOf(x.drop) < 0) r.bad.push("run " + i + " dropped a player not on the roster");
        if ((dropped[x.who] = dropped[x.who] || new Set()).has(x.drop)) r.bad.push("run " + i + " one drop used twice");
        if (perRound[key]) r.bad.push("run " + i + " two landings in one round");
        landed.add(x.add); takenAt[x.add] = j; dropped[x.who].add(x.drop); perRound[key] = true;
      } else if (x.why === "drop already gone" && landed.has(x.add)) r.bad.push("run " + i + " a taken target reported as a gone drop");
      else if (x.why === "already claimed" && !landed.has(x.add)) r.bad.push("run " + i + " 'already claimed' for a free target");
    });
  }
});
family("P8", "a shortlist of distinct moves never repeats a player, never exceeds its length or goes under its minimum gain, and keeps the given order", (r) => {
  const all = M.draftMoves(M.draftRoster(), next, M.CFG.draftEnd, { perPos: 6 });
  for (let i = 0; i < N8; i++) {
    const sub = all.filter(() => rnd() < 0.5), n = 1 + Math.floor(rnd() * 6), min = between(-2, 6), res = M.bestDistinctMoves(sub, n, min); r.cases++;
    const ids = res.map((m) => m.add.id).concat(res.map((m) => m.drop.id)), idx = res.map((m) => sub.indexOf(m));
    if (new Set(ids).size !== ids.length || res.length > n || res.some((m) => m.gain < min) || idx.some((v, k) => v < 0 || (k > 0 && v < idx[k - 1]))) r.bad.push("run " + i);
  }
});
family("P9", "quantiles of random samples are ordered and inside the sample's range", (r) => {
  for (let i = 0; i < N9; i++) {
    const n = 1 + Math.floor(rnd() * 200), a = []; for (let k = 0; k < n; k++) a.push(between(-10, 150)); a.sort((x, y) => x - y);
    const q = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((t) => M.maths.quantile(a, t)); r.cases++;
    if (q.some((v, k) => k > 0 && v < q[k - 1] - 1e-12) || q[0] !== a[0] || q[q.length - 1] !== a[n - 1]) r.bad.push("n " + n);
  }
});

/* ---------------------------------------------------------------- the count */
const kitFloor = N1 + 2 * N2 + N3;
ok("the kit's three families ran " + kit.toLocaleString("en-ZA") + " cases (their loop bounds guarantee at least " + kitFloor.toLocaleString("en-ZA") + ": K1 " + N1 + " player-weeks plus one per fixture, K2 two per squad, K3 one per roster)",
  kit >= kitFloor, "");
ok(total.toLocaleString("en-ZA") + " generated cases hold, at least the spec's " + SPEC_FLOOR.toLocaleString("en-ZA") + " (" + report.join(", ") + ")", total >= SPEC_FLOOR && k2r.cases > 0, "");

finish();

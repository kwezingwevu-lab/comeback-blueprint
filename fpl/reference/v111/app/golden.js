/* golden.js — writes golden.json: the numbers a port of this build must reproduce on the same data. node golden.js */
const fs = require("fs"), D = require("./data.json"), PRE = require("./pre.json"), E = require("./engine.js"), M = E.create(D), P = M.P;
const r = (x, d) => Math.round(x * Math.pow(10, d || 1)) / Math.pow(10, d || 1), sq = M.classicSquad(), S = PRE.solver || {}, pl = S.plan, T = S.timing, C = PRE.claims, bt = D.model.backtest;
const rat = {}; M.teamNames.forEach((t) => { rat[t] = { att: r(M.RAT[t].att, 4), def: r(M.RAT[t].def, 4) }; });
const odds = {}; Object.keys(M.ODDS).forEach((g) => { odds[g] = M.ODDS[g].map((o) => ({ h: o.h, a: o.a, lh: r(o.lh, 2), la: r(o.la, 2) })); });
const g = { snapshot: D.asOf, note: "Expected points for every player, gameweeks 6–20, are in solver_in.json (tolerance 0.01). Solver totals are time-limited: compare within the stated gap.",
  calib: { ka: M.calib.ka, kd: M.calib.kd, rmse: r(M.calib.rmse, 4), anchors: M.calib.n, weeks: M.calib.weeks }, ratings: rat, odds,
  backtest: { weeks: bt.weeks, rho: r(bt.points.all.rho, 3), rhoNaive: r(bt.points.all.rhoNaive, 3), starts: bt.points.all.n, brier: r(bt.minutes.brier, 3), brierNaive: r(bt.minutes.brierNaive, 3), goalsLogLik: r(bt.goals.logLik, 1), goalsLogLikNaive: r(bt.goals.logLikNaive, 1),
    byPos: Object.fromEntries(Object.entries(bt.points.byPos).map(([k, x]) => [k, { n: x.n, ratio: r(x.ratio, 3), lo: r(x.lo, 3), hi: r(x.hi, 3) }])), corrections: D.model.calib },
  classic: { total: D.classic.total, ftNext: D.classic.ftNext, bank: sq.bank, budget: r(sq.squad.reduce((a, p) => a + p.sell, 0) + sq.bank), recon: D.classic.recon,
    sim6: { p10: PRE.classicSim.p10, p50: PRE.classicSim.p50, p90: PRE.classicSim.p90 },
    plan: pl ? { total: pl.total, gap: r(pl.gap, 4), chips: pl.weeks.filter((w) => w.chip).map((w) => ({ gw: w.gw, chip: w.chip, captain: P[w.cap].n })), gw6: { captain: P[pl.weeks[0].cap].n, in: pl.weeks[0].in.map((i) => P[i].n), out: pl.weeks[0].out.map((i) => P[i].n), bank: pl.weeks[0].bank } } : null,
    timing: T ? { now: T.now.total, later: T.later.total, laterGap: r(T.later.gap, 4), laterWildcardGw: (T.later.weeks.find((w) => w.chip === "wildcard") || {}).gw, never: T.never.total, neverGap: r(T.never.gap, 4) } : null,
    freeHit: (S.freeHit || []).filter((f) => f.free).sort((a, b) => b.gain - a.gain).slice(0, 3).map((f) => ({ gw: f.gw, gain: f.gain })) },
  draft: { horizonEnd: M.CFG.draftEnd, waiverOrder: M.waiverOrder(), activity: D.draft.activity, h2h6: { opp: PRE.h2h.opp, win: r(PRE.h2h.win, 3), draw: r(PRE.h2h.draw, 3) },
    solvedRoster: S.draft ? { value: S.draft.value, base: S.draft.base, pairs: S.draft.pairs.map((q) => P[q.add].n + " for " + P[q.drop].n) } : null,
    claims: C ? { strategy: C.strategy, valueNow: r(C.valueNow), mean: r(C.meanValue), p10: r(C.p10), p90: r(C.p90), worst: r(C.valueStress), ceiling: r(C.valueAll), orderings: C.orderings.map((o) => ({ name: o.name, mean: r(o.mean) })),
      sheet: C.sheet.map((e) => ({ kind: e.kind, add: P[e.add].n, drop: P[e.drop].n, gain: r(e.gain), land: r(C.land[e.add], 3) })) } : null,
    waiverLogReplication: "74 of 74 claim results in d_tx.json, gameweeks 2–5" } };
fs.writeFileSync("golden.json", JSON.stringify(g, null, 1)); console.log("golden.json written", (fs.statSync("golden.json").size / 1024).toFixed(1) + " kB");

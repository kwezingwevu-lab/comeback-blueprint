/* backtest.js — walk-forward validation. For each gameweek k, the data is cut back to what was known before k's deadline
   (no later matches, no injury flags), the engine is rebuilt on it, and its forecasts are scored against what happened.
   Three separate questions, so a weakness can be traced: points given a start, who starts, and team goals.
   Also returns position calibration factors, applied only where the evidence is clear. */
function truncate(DATA, k) {
  const D = JSON.parse(JSON.stringify(DATA));
  D.gw = Object.assign({}, D.gw, { live: k - 1, next: k, lastDone: k - 1, withData: D.gw.withData.filter((g) => g < k) });
  D.players.forEach((p) => { const h = p.h || {}, sub = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    Object.keys(h).forEach((g) => { if (+g >= k) { h[g].forEach((v, i) => { sub[i] += v; }); delete h[g]; } });
    const keep = p.mins > 0 ? Math.max(0, p.mins - sub[0]) / p.mins : 0;
    p.mins -= sub[0]; p.pts -= sub[1]; p.xg = Math.max(0, p.xg - sub[2]); p.xa = Math.max(0, p.xa - sub[3]); p.dc -= sub[4]; p.stt -= sub[5]; p.g -= sub[6]; p.a -= sub[7]; p.cs -= sub[8]; p.bon -= sub[9];
    p.sv = Math.round((p.sv || 0) * keep); p.yc = Math.round((p.yc || 0) * keep);
    p.st = "a"; p.cop = null; p.cpt = null; delete p.ret; delete p.news; });
  Object.values(D.teamSeason).forEach((t) => { t.log = t.log.filter((m) => m.gw < k); t.m = t.log.length; t.gf = 0; t.ga = 0; t.xgf = 0; t.xga = 0; t.cs = 0;
    t.log.forEach((m) => { t.gf += m.gf; t.ga += m.ga; t.xgf += m.xgf; t.xga += m.xga; if (m.ga === 0) t.cs++; }); });
  D.intel = Object.assign({}, D.intel, { start: {}, odds: {}, market5: k === 5 ? D.intel.market5 : {} });   // only prices that existed before the deadline
  delete D.model; return D;
}
const rank = (a) => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length); let i = 0;
  while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let t = i; t <= j; t++) r[idx[t][1]] = (i + j) / 2; i = j + 1; } return r; };
const pearson = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy || 1); };
const spearman = (x, y) => pearson(rank(x), rank(y));
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function run(DATA, E, ks) {
  const live = E.create(DATA, { noCalib: true }), fixedK = { ka: live.calib.ka, kd: live.calib.kd };
  const rows = [], mins = [], goals = [];
  ks.forEach((k) => {
    const D = truncate(DATA, k), M = E.create(D, { fixedK, noCalib: true });
    const starters = DATA.players.filter((p) => p.h && p.h[k] && p.h[k][5] > 0);
    const Dg = JSON.parse(JSON.stringify(D)); Dg.intel.start = { [k]: {} }; starters.forEach((p) => { Dg.intel.start[k][p.n + "|" + p.t] = { p: 1 }; });
    const Mg = E.create(Dg, { fixedK, noCalib: true }), Pg = {}; Dg.players.forEach((p) => { Pg[p.id] = p; });
    const Pt = {}; D.players.forEach((p) => { Pt[p.id] = p; });
    starters.forEach((p) => { const q = Pg[p.id]; if (!q || !M.fx(p.t, k).length) return; const before = Pt[p.id], naive = before.stt > 0 ? before.pts / Math.max(1, before.stt) : null;
      rows.push({ k, pos: p.p, pred: Mg.ep(q, k), act: p.h[k][1], naive }); });
    D.players.forEach((q) => { if (q.mins <= 0 || !M.fx(q.t, k).length) return; const full = DATA.players.find((x) => x.id === q.id), h = (full.h || {})[k], st = h && h[5] > 0 ? 1 : 0, last = q.h && q.h[k - 1] && q.h[k - 1][5] > 0 ? 1 : 0;
      mins.push({ k, pred: M.rateOf(q).pStart, act: st, naive: last }); });
    DATA.fixtures.filter((f) => f.gw === k && f.fin).forEach((f) => { const L = M.lambdas(f.h, { o: f.a, ha: "H" }, k); goals.push({ k, lh: L.lf, la: L.la, h: f.hs, a: f.as }); });
  });
  const posStats = {}; const rnd = mulberry(7);
  [1, 2, 3, 4].forEach((pos) => { const R = rows.filter((r) => r.pos === pos); if (R.length < 20) return;
    const sp = R.reduce((a, r) => a + r.pred, 0), sa = R.reduce((a, r) => a + r.act, 0), ratio = sa / sp, boots = [];
    for (let b = 0; b < 800; b++) { let x = 0, y = 0; for (let i = 0; i < R.length; i++) { const r = R[Math.floor(rnd() * R.length)]; x += r.pred; y += r.act; } boots.push(y / x); }
    boots.sort((a, b) => a - b); const lo = boots[Math.floor(0.05 * boots.length)], hi = boots[Math.floor(0.95 * boots.length) - 1];
    const withNaive = R.filter((r) => r.naive != null), meanPos = sa / R.length;
    const naivePred = R.map((r) => (r.naive != null ? r.naive : meanPos));
    posStats[pos] = { n: R.length, meanPred: sp / R.length, meanAct: meanPos, ratio, lo, hi, rho: spearman(R.map((r) => r.pred), R.map((r) => r.act)), rhoNaive: spearman(naivePred, R.map((r) => r.act)),
      mae: R.reduce((a, r) => a + Math.abs(r.pred - r.act), 0) / R.length, maeNaive: R.reduce((a, r, i) => a + Math.abs(naivePred[i] - r.act), 0) / R.length, nNaive: withNaive.length }; });
  const all = { rho: spearman(rows.map((r) => r.pred), rows.map((r) => r.act)), rhoNaive: spearman(rows.map((r) => (r.naive != null ? r.naive : 2)), rows.map((r) => r.act)), n: rows.length };
  const brier = (key) => mins.reduce((a, m) => a + (m[key] - m.act) ** 2, 0) / mins.length;
  const buckets = [0, 0.2, 0.4, 0.6, 0.8, 1.01].slice(0, -1).map((lo, i, arr) => { const hi = [0.2, 0.4, 0.6, 0.8, 1.01][i], B = mins.filter((m) => m.pred >= lo && m.pred < hi);
    return { lo, hi: Math.min(1, hi), n: B.length, pred: B.length ? B.reduce((a, m) => a + m.pred, 0) / B.length : null, act: B.length ? B.reduce((a, m) => a + m.act, 0) / B.length : null }; });
  const lp = (lam, g) => { let f = 1; for (let i = 2; i <= g; i++) f *= i; return -lam + g * Math.log(Math.max(1e-9, lam)) - Math.log(f); };
  const avgH = goals.reduce((a, g) => a + g.h, 0) / Math.max(1, goals.length), avgA = goals.reduce((a, g) => a + g.a, 0) / Math.max(1, goals.length);
  const ll = goals.reduce((a, g) => a + lp(g.lh, g.h) + lp(g.la, g.a), 0), llNaive = goals.reduce((a, g) => a + lp(1.40 * 1.09, g.h) + lp(1.40 * 0.915, g.a), 0);
  const calib = {}; Object.keys(posStats).forEach((pos) => { const s = posStats[pos], clear = s.lo > 1 || s.hi < 1;
    calib[pos] = clear ? Math.round(Math.min(1.15, Math.max(0.85, 1 + 0.5 * (s.ratio - 1))) * 1000) / 1000 : 1; });
  return { weeks: ks, points: { byPos: posStats, all }, minutes: { n: mins.length, brier: brier("pred"), brierNaive: brier("naive"), buckets }, goals: { n: goals.length, logLik: ll, logLikNaive: llNaive, avgHome: avgH, avgAway: avgA }, calib, fixedK };
}
module.exports = { truncate, run, spearman };

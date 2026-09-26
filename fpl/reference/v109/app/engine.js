/* Mission Control engine — pure functions over the baked data block.
   Runs unchanged in the browser and under Node (the test harness requires this same file).
   Classic and Draft are separate games: nothing in here ever adds a Classic number to a Draft number. */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.MCEngine = factory(); })(typeof self !== "undefined" ? self : this, function () {
"use strict";

/* ─────────────── small maths ─────────────── */
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function poisPmf(k, l) { if (l <= 0) return k === 0 ? 1 : 0; let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; }
function poisTail(t, l) { let c = 0; for (let k = 0; k < t; k++) c += poisPmf(k, l); return clamp(1 - c, 0, 1); }          // P(X >= t)
function expFloorDiv(l, d) { let e = 0; for (let k = d; k < 40; k++) e += Math.floor(k / d) * poisPmf(k, l); return e; }   // E[floor(X/d)]
function mulberry(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rPois(l, rnd) { if (l <= 0) return 0; const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L && k < 60); return k - 1; }
function rBinom(n, p, rnd) { let k = 0; for (let i = 0; i < n; i++) if (rnd() < p) k++; return k; }
function rNorm(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function quantile(sorted, q) { if (!sorted.length) return 0; const i = clamp((sorted.length - 1) * q, 0, sorted.length - 1); const lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }

const POS = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
const GOAL_PTS = { 1: 10, 2: 6, 3: 5, 4: 4 }, CS_PTS = { 1: 4, 2: 4, 3: 1, 4: 0 }, DC_T = { 1: 99, 2: 10, 3: 12, 4: 12 };
const FORMATIONS = []; for (let d = 3; d <= 5; d++) for (let m = 2; m <= 5; m++) for (let f = 1; f <= 3; f++) if (d + m + f === 10) FORMATIONS.push([d, m, f]);

function create(DATA, opts) {
  opts = opts || {};
  const CFG = { mu: 1.40, home: 1.09, away: 0.915, kShrink: 6, draftEnd: null, classicEnd: DATA.rules.chipStop || 19 };
  const next = DATA.gw.next, live = DATA.gw.live;
  const redraft = DATA.draft.league.redraft;
  CFG.draftEndApi = redraft ? redraft.fromGw - 1 : 38;
  CFG.draftEnd = opts.draftEnd || CFG.draftEndApi;

  /* ─────────────── lookups ─────────────── */
  const P = {}; DATA.players.forEach((p) => { P[p.id] = p; });
  const byKey = {}; DATA.players.forEach((p) => { byKey[p.n + "|" + p.t] = p; });
  const fxByTeamGw = {}; DATA.teams.forEach((t) => { fxByTeamGw[t.s] = {}; });
  DATA.fixtures.forEach((f) => { (fxByTeamGw[f.h][f.gw] = fxByTeamGw[f.h][f.gw] || []).push({ id: f.id, o: f.a, ha: "H", ko: f.ko, fin: f.fin }); (fxByTeamGw[f.a][f.gw] = fxByTeamGw[f.a][f.gw] || []).push({ id: f.id, o: f.h, ha: "A", ko: f.ko, fin: f.fin }); });
  const deadline = {}; DATA.gw.events.forEach((e) => { deadline[e.id] = e.dl; });
  function fx(team, gw) { return (fxByTeamGw[team] && fxByTeamGw[team][gw]) || []; }

  /* ─────────────── team ratings ───────────────
     Prior: what the game's own prices say about each side's attack and defence. Season: opponent-adjusted
     expected goals (70%) and goals (30%) from the matches played. The two are blended in log space, and the
     price exponents are fitted so the model reproduces the bookmaker-implied gameweek-5 numbers it was given. */
  const teamNames = DATA.teams.map((t) => t.s);
  const pricePrior = {}; teamNames.forEach((t) => {
    const sq = DATA.players.filter((p) => p.t === t && p.st !== "u");
    const att = sq.filter((p) => p.p >= 3).map((p) => p.pr).sort((a, b) => b - a).slice(0, 6), def = sq.filter((p) => p.p <= 2).map((p) => p.pr).sort((a, b) => b - a).slice(0, 6);
    const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length); pricePrior[t] = { a: mean(att), d: mean(def) };
  });
  const meanA = teamNames.reduce((s, t) => s + pricePrior[t].a, 0) / teamNames.length, meanD = teamNames.reduce((s, t) => s + pricePrior[t].d, 0) / teamNames.length;
  function buildRatings(ka, kd) {
    const R = {}; teamNames.forEach((t) => { R[t] = { att: Math.pow(pricePrior[t].a / meanA, ka), def: Math.pow(pricePrior[t].d / meanD, -kd) }; });
    for (let it = 0; it < 3; it++) {
      const S = {}; teamNames.forEach((t) => {
        const ts = DATA.teamSeason[t]; if (!ts || !ts.m) { S[t] = { att: R[t].att, def: R[t].def, w: 0 }; return; }
        let sa = 0, sd = 0; ts.log.forEach((m) => { const side = m.ha === "H" ? CFG.home : CFG.away, oside = m.ha === "H" ? CFG.away : CFG.home;
          const pf = 0.7 * m.xgf + 0.3 * m.gf, pa = 0.7 * m.xga + 0.3 * m.ga;
          sa += pf / (CFG.mu * side * R[m.o].def); sd += pa / (CFG.mu * oside * R[m.o].att); });
        S[t] = { att: clamp(sa / ts.m, 0.35, 2.6), def: clamp(sd / ts.m, 0.35, 2.6), w: ts.m / (ts.m + 8) };
      });
      const N = {}; teamNames.forEach((t) => { const pa = Math.pow(pricePrior[t].a / meanA, ka), pd = Math.pow(pricePrior[t].d / meanD, -kd), w = S[t].w;
        N[t] = { att: Math.exp((1 - w) * Math.log(pa) + w * Math.log(S[t].att)), def: Math.exp((1 - w) * Math.log(pd) + w * Math.log(S[t].def)) }; });
      const ga = Math.exp(teamNames.reduce((s, t) => s + Math.log(N[t].att), 0) / teamNames.length), gd = Math.exp(teamNames.reduce((s, t) => s + Math.log(N[t].def), 0) / teamNames.length);
      teamNames.forEach((t) => { R[t] = { att: N[t].att / ga, def: N[t].def / gd }; });
    }
    return R;
  }
  function rawLambda(R, team, opp, ha) { return CFG.mu * (ha === "H" ? CFG.home : CFG.away) * R[team].att * R[opp].def; }
  function matchOdds0(lh, la) { let h = 0, d = 0, a = 0; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const p = poisPmf(i, lh) * poisPmf(j, la); if (i > j) h += p; else if (i === j) d += p; else a += p; } const s = h + d + a; return { h: h / s, d: d / s, a: a / s }; }
  function devig(h, d, a) { const ih = 1 / h, id = 1 / d, ia = 1 / a, s = ih + id + ia; return { h: ih / s, d: id / s, a: ia / s, margin: s - 1 }; }
  function fitRates(t) { let best = null; for (let lh = 0.3; lh <= 3.61; lh += 0.05) for (let la = 0.3; la <= 3.61; la += 0.05) { const o = matchOdds0(lh, la), e = Math.pow(o.h - t.h, 2) + Math.pow(o.d - t.d, 2) + Math.pow(o.a - t.a, 2); if (!best || e < best.e) best = { lh, la, e }; }
    /* polish on a finer grid around the coarse answer */ const c = best; for (let lh = c.lh - 0.05; lh <= c.lh + 0.05; lh += 0.01) for (let la = c.la - 0.05; la <= c.la + 0.05; la += 0.01) { const o = matchOdds0(lh, la), e = Math.pow(o.h - t.h, 2) + Math.pow(o.d - t.d, 2) + Math.pow(o.a - t.a, 2); if (e < best.e) best = { lh, la, e }; } return best; }
  const mk5 = (DATA.intel && DATA.intel.market5) || {}, MK0 = { 5: JSON.parse(JSON.stringify(mk5)) }, ODDS = {};
  Object.keys((DATA.intel && DATA.intel.odds) || {}).forEach((g) => { DATA.intel.odds[g].forEach((r) => { const f = (fxByTeamGw[r[0]] || {})[g]; if (!f || !f.some((x) => x.o === r[1] && x.ha === "H")) return;
    const fair = devig(r[2], r[3], r[4]), fit = fitRates(fair); MK0[g] = MK0[g] || {}; MK0[g][r[0]] = { xg: fit.lh, from: "odds" }; MK0[g][r[1]] = { xg: fit.la, from: "odds" }; (ODDS[g] = ODDS[g] || []).push({ h: r[0], a: r[1], odds: [r[2], r[3], r[4]], fair, lh: fit.lh, la: fit.la }); }); });
  const anchors = [];
  Object.keys(MK0).forEach((g) => { const m = MK0[g]; Object.keys(m).forEach((t) => { const f = fx(t, +g)[0]; if (!f) return; if (m[t].xg) anchors.push({ t, o: f.o, ha: f.ha, v: m[t].xg, g: +g }); if (m[t].cs && !(m[f.o] && m[f.o].xg)) anchors.push({ t: f.o, o: t, ha: f.ha === "H" ? "A" : "H", v: -Math.log(m[t].cs), g: +g }); }); });
  let best = { ka: 3, kd: 3, err: Infinity };
  if (anchors.length >= 6) { for (let ka = 1; ka <= 6.01; ka += 0.5) for (let kd = 1; kd <= 8.01; kd += 0.5) { const R = buildRatings(ka, kd); let e = 0; anchors.forEach((a) => { const d = Math.log(rawLambda(R, a.t, a.o, a.ha) / a.v); e += d * d; }); if (e < best.err) best = { ka, kd, err: e }; } }
  const RAT = buildRatings(best.ka, best.kd);
  const calib = { ka: best.ka, kd: best.kd, rmse: anchors.length ? Math.sqrt(best.err / anchors.length) : null, n: anchors.length, weeks: Object.keys(MK0).map(Number).sort((a, b) => a - b) };

  /* market overrides: baked gameweek-5 numbers plus anything typed into the Odds tab ({gw:{TEAM:{xg,cs}}}) */
  let MARKET = JSON.parse(JSON.stringify(MK0));
  function setMarket(m) { MARKET = JSON.parse(JSON.stringify(MK0)); Object.keys(m || {}).forEach((g) => { MARKET[g] = Object.assign({}, MARKET[g] || {}, m[g]); }); cache.clear(); }
  function lambdas(team, f, gw) {              // goals for / against for this side in this fixture
    const mine = (MARKET[gw] || {})[team] || {}, theirs = (MARKET[gw] || {})[f.o] || {};
    let lf = rawLambda(RAT, team, f.o, f.ha), la = rawLambda(RAT, f.o, team, f.ha === "H" ? "A" : "H"), src = "model";
    if (mine.xg) { lf = mine.xg; src = mine.from === "odds" ? "odds" : "market"; } else if (theirs.cs) { lf = -Math.log(theirs.cs); src = "market"; }
    if (theirs.xg) { la = theirs.xg; src = theirs.from === "odds" ? "odds" : src === "model" ? "market" : src; } else if (mine.cs) { la = -Math.log(mine.cs); if (src === "model") src = "market"; }
    return { lf, la, src };
  }
  function matchOdds(lh, la) { let h = 0, d = 0, a = 0; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const p = poisPmf(i, lh) * poisPmf(j, la); if (i > j) h += p; else if (i === j) d += p; else a += p; } const s = h + d + a; return { h: h / s, d: d / s, a: a / s }; }

  /* ─────────────── player rates ─────────────── */
  const PRIOR = {
    xg: (p) => p.p === 4 ? 0.18 + 0.06 * (p.pr - 4.5) : p.p === 3 ? 0.04 + 0.045 * (p.pr - 4.5) : p.p === 2 ? 0.02 + 0.015 * (p.pr - 4) : 0,
    xa: (p) => p.p === 4 ? 0.08 + 0.02 * (p.pr - 4.5) : p.p === 3 ? 0.06 + 0.035 * (p.pr - 4.5) : p.p === 2 ? 0.03 + 0.025 * (p.pr - 4) : 0.002,
    bon: (p) => clamp(p.p === 1 ? 0.35 : p.p === 2 ? 0.30 + 0.06 * (p.pr - 4) : p.p === 3 ? 0.15 + 0.12 * (p.pr - 4.5) : 0.20 + 0.10 * (p.pr - 4.5), 0.05, 1.4),
    dc: (p) => p.p === 2 ? 7.5 : p.p === 3 ? 6.5 : p.p === 4 ? 3 : 0,
    start: (p) => p.p === 1 ? (p.pr >= 4.5 ? 0.75 : 0.08) : clamp(0.30 + 0.10 * (p.pr - 4.0), 0.25, 0.85),
  };
  const rates = {};
  function rateOf(p) {
    if (rates[p.id]) return rates[p.id];
    const n90 = p.mins / 90, K = CFG.kShrink;
    let pxg = Math.max(0, PRIOR.xg(p)); if (p.pen === 1 && p.mins < 450) pxg += 0.08;
    const xg90 = (p.xg + K * pxg) / (n90 + K), xa90 = (p.xa + K * Math.max(0, PRIOR.xa(p))) / (n90 + K);
    const bon90 = (p.bon + K * PRIOR.bon(p)) / (n90 + K), sv90 = p.p === 1 ? (p.sv + K * 3.0) / (n90 + K) : 0, yc90 = (p.yc + K * 0.15) / (n90 + K);
    /* minutes */
    const gws = DATA.gw.withData.filter((g) => g <= DATA.gw.lastDone), H = p.h || {};
    const first = gws.find((g) => H[g] && H[g][0] > 0); let sw = 0, ws = 0, apps = 0, starts = 0, minsStarted = 0, played = 0;
    gws.forEach((g, i) => { if (first == null || g < first) return; const w = i === gws.length - 1 ? 2 : i === gws.length - 2 ? 1.5 : 1; ws += w; played++; const h = H[g]; if (h && h[0] > 0) { apps++; if (h[5] > 0) { sw += w; starts++; minsStarted += h[0]; } } });
    const prior = first == null ? PRIOR.start(p) * 0.35 : PRIOR.start(p);
    const pStart = clamp((sw + 1.0 * prior) / (ws + 1.0), 0.01, 0.98);
    const mps = starts ? clamp(minsStarted / starts, 55, 90) : 78, p60s = clamp(0.55 + (mps - 60) / 30 * 0.42, 0.5, 0.97);
    const pSub = played - starts > 0 ? clamp((apps - starts + 0.5) / (played - starts + 1), 0.05, 0.9) : 0.35;
    /* defensive contribution: observed hit-rate, steadied by a Poisson read of the per-90 count */
    const T = DC_T[p.p]; let hits = 0, nn = 0; gws.forEach((g) => { const h = H[g]; if (h && h[0] >= 45) { nn++; if (h[4] >= T) hits++; } });
    const dc90 = (p.dc + K * PRIOR.dc(p)) / (n90 + K), p0 = p.p === 1 ? 0 : poisTail(T, dc90), pDC = p.p === 1 ? 0 : (hits + 2 * p0) / (nn + 2);
    return (rates[p.id] = { xg90, xa90, bon90, sv90, yc90, pStart, mps, p60s, pSub, pDC, dc90 });
  }
  /* availability for a gameweek: 0..1 */
  function avail(p, gw) {
    const key = p.n + "|" + p.t, S = (DATA.intel && DATA.intel.start) || { 5: (DATA.intel && DATA.intel.start5) || {} }, ov = S[gw] && S[gw][key];
    if (ov) return { a: null, pStart: ov.p, why: ov.why };
    if (p.st === "a") return { a: 1 };
    const ref = live >= gw ? live : next;                 // the gameweek the official flag speaks to
    const copNow = gw <= live ? (p.cpt != null ? p.cpt : p.cop) : p.cop;
    if (gw <= ref) return { a: copNow != null ? copNow / 100 : (p.st === "d" ? 0.5 : 0) };
    if (p.ret) { const back = new Date(p.ret + "T00:00:00Z").getTime(), dl = new Date(deadline[gw] || 0).getTime(); if (dl < back) return { a: 0 }; const prevDl = new Date(deadline[gw - 1] || 0).getTime(); return { a: prevDl < back ? 0.75 : 1 }; }
    if (p.st === "d") return { a: gw - ref >= 2 ? 1 : 0.9 };
    if (p.st === "u" || p.st === "n") return { a: 0 };
    const k = gw - ref; return { a: k <= 3 ? 0 : clamp(0.2 * (k - 3) + 0.2, 0, 0.9) };
  }

  /* ─────────────── expected points ─────────────── */
  const cache = new Map();
  function parts(p, gw) {                                   // the full build-up of one player's expected points in one gameweek
    const key = p.id + ":" + gw; if (cache.has(key)) return cache.get(key);
    const r = rateOf(p), F = fx(p.t, gw), av = avail(p, gw); let tot = 0; const det = [];
    F.forEach((f) => {
      const L = lambdas(p.t, f, gw), typ = CFG.mu * RAT[p.t].att;
      const pStart = av.pStart != null ? av.pStart : r.pStart * av.a, a = av.pStart != null ? 1 : av.a;
      const pSubOn = (1 - pStart) * r.pSub * (av.pStart != null ? 1 : a), pPlay = pStart + pSubOn, p60 = pStart * r.p60s, em = pStart * r.mps + pSubOn * 20;
      const fac = L.lf / typ, xg = r.xg90 * fac * em / 90, xa = r.xa90 * fac * em / 90, pcs = Math.exp(-L.la);
      const app = pPlay + p60, gl = GOAL_PTS[p.p] * xg, as = 3 * xa, cs = CS_PTS[p.p] * pcs * p60;
      const gc = p.p <= 2 ? -expFloorDiv(L.la, 2) * em / 90 : 0, sv = p.p === 1 ? expFloorDiv(r.sv90 * Math.pow(L.la / CFG.mu, 0.6), 3) * em / 90 : 0;
      const giTyp = Math.max(0.02, r.xg90 + r.xa90), bo = (p.p >= 3 ? r.bon90 * Math.pow((r.xg90 + r.xa90) * fac / giTyp, 0.8) : r.bon90 * (0.55 + 0.45 * pcs / 0.28)) * em / 90;
      const dc = 2 * r.pDC * pStart, yc = -(r.yc90 * em / 90) - 0.02 * pPlay;
      const ep = app + gl + as + cs + gc + sv + bo + dc + yc; tot += ep;
      det.push({ f, L, pStart, pPlay, p60, em, xg, xa, pcs, app, gl, as, cs, gc, sv, bo, dc, yc, ep });
    });
    const out = { ep: tot, det, why: av.why || null }; cache.set(key, out); return out;
  }
  function ep(p, gw) { return parts(p, gw).ep; }
  function epRange(p, g0, g1) { let s = 0; for (let g = g0; g <= g1; g++) s += ep(p, g); return s; }

  /* ─────────────── elevens ─────────────── */
  function bestXI(squad, gw, o) {                          // squad: array of player objects (15). Returns the best legal eleven on expected points.
    o = o || {}; const val = o.val || ((p) => ep(p, gw));
    const s = squad.map((p) => ({ p, v: val(p) })); const by = (k) => s.filter((x) => x.p.p === k).sort((a, b) => b.v - a.v);
    const G = by(1), D = by(2), M = by(3), F = by(4); if (!G.length) return null; let bestF = null;
    FORMATIONS.forEach(([d, m, f]) => { if (D.length < d || M.length < m || F.length < f) return; let t = G[0].v; for (let i = 0; i < d; i++) t += D[i].v; for (let i = 0; i < m; i++) t += M[i].v; for (let i = 0; i < f; i++) t += F[i].v; if (!bestF || t > bestF.t) bestF = { d, m, f, t }; });
    if (!bestF) return null;
    const xi = [G[0]].concat(D.slice(0, bestF.d), M.slice(0, bestF.m), F.slice(0, bestF.f));
    const bench = D.slice(bestF.d).concat(M.slice(bestF.m), F.slice(bestF.f)).sort((a, b) => b.v - a.v);
    const cap = xi.slice().sort((a, b) => b.v - a.v);
    return { form: bestF.d + "-" + bestF.m + "-" + bestF.f, tot: bestF.t, xi: xi.map((x) => x.p), bench: bench.map((x) => x.p), benchGk: G[1] ? G[1].p : null, cap: cap[0].p, vice: cap[1] ? cap[1].p : cap[0].p, capV: cap[0].v };
  }
  function squadValue(squad, g0, g1, captain) {            // sum of best elevens across the horizon; Classic adds the armband
    let v = 0; for (let g = g0; g <= g1; g++) { const x = bestXI(squad, g); if (x) v += x.tot + (captain ? x.capV : 0); } return v;
  }
  function xiTotal(xi, gw) { return xi.reduce((s, p) => s + ep(p, gw), 0); }

  /* ─────────────── squads from the feeds ─────────────── */
  function classicSquad() {
    const gws = DATA.classic.gws; if (!gws.length) return null; const last = gws[gws.length - 1];
    const scr = (DATA.screen && DATA.screen.sell) || {}, calc = DATA.classic.sell || {};
    const squad = last.picks.map((k) => { const p = P[k.id]; if (!p) return null; const key = p.n + "|" + p.t, c = calc[k.id];
      return Object.assign({}, p, { sell: c ? c.sell : scr[key] != null ? scr[key] : p.pr, paid: c ? c.paid : null, slot: k.pos, isC: k.c, isV: k.v, mult: k.mult }); }).filter(Boolean);
    return { gw: last.gw, squad, bank: last.bank, chip: last.chip, ft: DATA.classic.ftNext, ftSure: DATA.classic.ftSure, value: last.value };
  }
  function draftRoster(name) { return (DATA.draft.rosters[name || DATA.draft.me] || []).map((id) => P[id]).filter(Boolean); }
  function freeAgents() { return DATA.players.filter((p) => p.did && !p.do && p.ds === "a" && p.st !== "u"); }
  function lockedFreeAgents() { return DATA.players.filter((p) => p.did && !p.do && p.ds === "l" && p.st !== "u"); }
  function waiverPool() { return freeAgents().concat(lockedFreeAgents()); }          // everything claimable before the next deadline: free now, or on waivers until they process
  function howToGet(p) { return !DATA.draft.waiversProcessed || p.ds === "l" ? "waiver" : "free"; }   // before waivers settle, every unowned player is a claim
  function waiverOrder() { return DATA.draft.entries.slice().sort((a, b) => a.waiver - b.waiver).map((e) => e.name); }
  /* How this league actually settles waivers, read from its own transaction log: claims are processed in rounds. In each
     round managers are visited in waiver order and each tries their claims in the order lodged until one succeeds (a target
     already taken is skipped, a drop already gone voids the claim). Nobody moves to the bottom. So your first success beats
     everyone behind you, and your k-th success comes after everyone ahead of you has had k, and everyone behind you k−1. */
  function waiverSim(myClaims, rivalLists, order) {              // claims: [{add, drop}] with ids; returns what lands, in processing order
    const lists = Object.assign({}, rivalLists, { [DATA.draft.me]: myClaims }), pos = {}, gone = {}, taken = new Set(), log = [];
    order.forEach((nm) => { pos[nm] = 0; gone[nm] = new Set(); });
    for (let round = 1; round <= 12; round++) { let any = false;
      order.forEach((nm) => { const L = lists[nm] || []; while (pos[nm] < L.length) { const c = L[pos[nm]++]; if (!c) continue;
        if (taken.has(c.add)) { log.push({ round, who: nm, add: c.add, drop: c.drop, ok: false, why: "already claimed" }); continue; }      // the game reports this reason first
        if (gone[nm].has(c.drop)) { log.push({ round, who: nm, add: c.add, drop: c.drop, ok: false, why: "drop already gone" }); continue; }
        taken.add(c.add); gone[nm].add(c.drop); log.push({ round, who: nm, add: c.add, drop: c.drop, ok: true }); any = true; break; } });
      if (!any) break; }
    return { log, mine: log.filter((x) => x.who === DATA.draft.me), taken };
  }
  function rivalClaimLists(g0, g1, n) { const out = {}; DATA.draft.entries.forEach((e) => { if (e.name === DATA.draft.me) return;
    out[e.name] = bestDistinctMoves(draftMoves(draftRoster(e.name), g0, g1, { perPos: 8 }), n || 4, 0.5).map((m) => ({ add: m.add.id, drop: m.drop.id, gain: m.gain })); }); return out; }
  function contested(g0, g1, n) {                                   // what the managers who claim before you are likely to go for
    const order = waiverOrder(), mine = order.indexOf(DATA.draft.me), ahead = order.slice(0, Math.max(0, mine)), out = {};
    ahead.forEach((nm) => { out[nm] = bestDistinctMoves(draftMoves(draftRoster(nm), g0, g1, { perPos: 8 }), n || 3, 0.5).map((m) => ({ add: m.add.id, drop: m.drop.id, gain: m.gain })); });
    return { order, ahead, picks: out };
  }

  /* ─────────────── Classic: transfers and the wildcard ─────────────── */
  function legalSwap(squad, out, inn, bank) {
    if (inn.p !== out.p) return false; if (squad.some((x) => x.id === inn.id)) return false; if (inn.pr > out.sell + bank + 1e-9) return false;
    const club = squad.filter((x) => x.t === inn.t && x.id !== out.id).length; return club < DATA.rules.clubLimit;
  }
  function candidatePool(g0, g1, perPos) {
    const pool = []; [1, 2, 3, 4].forEach((k) => { const c = DATA.players.filter((p) => p.p === k && p.st !== "u" && p.st !== "n").map((p) => ({ p, v: epRange(p, g0, g1) })).sort((a, b) => b.v - a.v).slice(0, perPos); c.forEach((x) => pool.push(x.p)); }); return pool;
  }
  function classicTransfers(state, g0, g1, maxMoves) {      // greedy best-next-move, each move scored on the exact horizon value
    let squad = state.squad.slice(), bank = state.bank; const moves = []; const pool = candidatePool(g0, g1, 45); let base = squadValue(squad, g0, g1, true);
    for (let k = 0; k < maxMoves; k++) {
      let bestM = null;
      squad.forEach((out) => { pool.forEach((inn) => { if (!legalSwap(squad, out, inn, bank)) return;
        const quick = epRange(inn, g0, g1) - epRange(out, g0, g1); if (quick < 0.5 && out.st === "a") return;
        const trial = squad.map((x) => x === out ? Object.assign({}, inn, { sell: inn.pr }) : x), v = squadValue(trial, g0, g1, true);
        if (!bestM || v - base > bestM.gain) bestM = { out, inn, gain: v - base, v, trial, bank: r1(bank + out.sell - inn.pr) }; }); });
      if (!bestM || bestM.gain < 0.75) break; const nextGain = bestXI(bestM.trial, g0).tot - bestXI(squad, g0).tot;
      moves.push({ out: bestM.out, inn: bestM.inn, gain: bestM.gain, gainNext: nextGain, bankAfter: bestM.bank }); squad = bestM.trial; bank = bestM.bank; base = bestM.v;
    }
    return { moves, squad, bank, value: base };
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function wildcard(budget, g0, g1, o) {                    // build the best fifteen for the horizon under a budget. Greedy upgrades, then swap search.
    o = o || {}; const need = { 1: 2, 2: 5, 3: 5, 4: 3 }, pool = candidatePool(g0, g1, o.perPos || 40);
    const cheap = DATA.players.filter((p) => p.st === "a" && rateOf(p).pStart > 0.5).sort((a, b) => a.pr - b.pr || epRange(b, g0, g1) - epRange(a, g0, g1));
    [1, 2, 3, 4].forEach((k) => cheap.filter((p) => p.p === k).slice(0, 6).forEach((p) => { if (!pool.includes(p)) pool.push(p); }));
    let squad = []; const clubN = (s, t) => s.filter((x) => x.t === t).length;
    [1, 2, 3, 4].forEach((k) => { cheap.filter((p) => p.p === k).forEach((p) => { if (squad.filter((x) => x.p === k).length < need[k] && clubN(squad, p.t) < DATA.rules.clubLimit) squad.push(p); }); });
    if (squad.length < 15) return null;
    const cost = (s) => s.reduce((t, p) => t + p.pr, 0), value = (s) => squadValue(s, g0, g1, true) + 0.12 * s.reduce((t, p) => t + epRange(p, g0, g1), 0) / (g1 - g0 + 1);
    let cur = value(squad), guard = 0;
    while (guard++ < 60) {                                  // upgrade by best value gained per pound until nothing affordable improves
      let bestU = null; const c0 = cost(squad);
      squad.forEach((out) => pool.forEach((inn) => { if (inn.p !== out.p || squad.includes(inn)) return; if (clubN(squad.filter((x) => x !== out), inn.t) >= DATA.rules.clubLimit) return;
        const dc = inn.pr - out.pr; if (c0 + dc > budget + 1e-9) return; if (epRange(inn, g0, g1) <= epRange(out, g0, g1)) return;
        const v = value(squad.map((x) => x === out ? inn : x)), gain = v - cur; if (gain <= 0.01) return; const score = dc > 0.05 ? gain / dc : gain * 50; if (!bestU || score > bestU.score) bestU = { out, inn, v, score }; }));
      if (!bestU) break; squad = squad.map((x) => x === bestU.out ? bestU.inn : x); cur = bestU.v;
    }
    for (let pass = 0; pass < 2; pass++) {                  // plain best-gain swaps, to undo any greedy mis-step
      let improved = false; const c0 = cost(squad);
      squad.slice().forEach((out) => { let bestS = null; pool.forEach((inn) => { if (inn.p !== out.p || squad.includes(inn)) return; if (clubN(squad.filter((x) => x !== out), inn.t) >= DATA.rules.clubLimit) return; if (cost(squad) - out.pr + inn.pr > budget + 1e-9) return;
        const v = value(squad.map((x) => x === out ? inn : x)); if (v > cur + 0.05 && (!bestS || v > bestS.v)) bestS = { inn, v }; }); if (bestS) { squad = squad.map((x) => x === out ? bestS.inn : x); cur = bestS.v; improved = true; } });
      if (!improved) break;
    }
    return { squad, cost: r1(cost(squad)), budget: r1(budget), value: squadValue(squad, g0, g1, true) };
  }

  /* ─────────────── Draft: free agents and drops ─────────────── */
  function draftMoves(roster, g0, g1, o) {
    o = o || {}; const fa = (o.pool || waiverPool()), base = squadValue(roster, g0, g1, false), baseNext = (bestXI(roster, g0) || { tot: 0 }).tot, out = [];
    [1, 2, 3, 4].forEach((k) => { const cands = fa.filter((p) => p.p === k).map((p) => ({ p, v: epRange(p, g0, g1) })).sort((a, b) => b.v - a.v).slice(0, o.perPos || 14);
      roster.filter((x) => x.p === k).forEach((drop) => cands.forEach((c) => { const trial = roster.map((x) => x === drop ? c.p : x), v = squadValue(trial, g0, g1, false);
        out.push({ add: c.p, drop, how: howToGet(c.p), gain: v - base, gainNext: bestXI(trial, g0).tot - baseNext }); })); });
    return out.sort((a, b) => b.gain - a.gain);
  }
  function bestDistinctMoves(moves, n, minGain) { const used = new Set(), res = []; moves.forEach((m) => { if (res.length >= n || m.gain < minGain) return; if (used.has(m.add.id) || used.has(m.drop.id)) return; used.add(m.add.id); used.add(m.drop.id); res.push(m); }); return res; }

  /* ─────────────── simulation ───────────────
     One draw = one set of scorelines for the gameweek. Goals and assists are dealt to players from their share of the
     team's goals, so team-mates rise and fall together and a striker facing your defender is properly opposed. */
  function simulate(gw, sides, n, seed) {                   // sides: [{xi:[players], bench:[players ordered], benchGk, captain, vice, tc}] → per-side score arrays
    const rnd = mulberry(seed || 20260918), need = new Map();
    sides.forEach((s) => s.xi.concat(s.bench || [], s.benchGk ? [s.benchGk] : []).forEach((p) => { if (!need.has(p.id)) need.set(p.id, { p, parts: parts(p, gw) }); }));
    const fxSet = new Map(); need.forEach((v) => v.parts.det.forEach((d) => { if (!fxSet.has(d.f.id)) fxSet.set(d.f.id, { id: d.f.id, a: d.f.ha === "H" ? v.p.t : d.f.o, la: d.f.ha === "H" ? d.L.lf : d.L.la, lb: d.f.ha === "H" ? d.L.la : d.L.lf }); }));
    const scores = sides.map(() => new Float64Array(n)), one = new Map();
    for (let i = 0; i < n; i++) {
      const gl = {}; fxSet.forEach((f) => { gl[f.id] = { a: f.a, ga: rPois(f.la, rnd), gb: rPois(f.lb, rnd) }; });
      one.clear(); need.forEach((v, id) => { let pts = 0, played = false; v.parts.det.forEach((d) => { const G = gl[d.f.id], mineHome = G.a === v.p.t, tf = mineHome ? G.ga : G.gb, ta = mineHome ? G.gb : G.ga;
        const u = rnd(); const started = u < d.pStart, subOn = !started && u < d.pPlay; if (!started && !subOn) return; played = true; const sixty = started && rnd() < (d.pStart > 0 ? d.p60 / d.pStart : 0), frac = started ? (sixty ? 1 : 0.6) : 0.22;
        const lf = Math.max(0.05, d.L.lf), sg = clamp((d.xg / Math.max(0.01, d.em / 90)) / lf * frac, 0, 0.8), sa = clamp((d.xa / Math.max(0.01, d.em / 90)) / lf * frac, 0, 0.8);
        const g = rBinom(tf, sg, rnd), a = rBinom(Math.max(0, tf - g), sa, rnd); let s = 1 + (sixty ? 1 : 0) + GOAL_PTS[v.p.p] * g + 3 * a; const cs = sixty && ta === 0;
        if (cs) s += CS_PTS[v.p.p]; if (v.p.p <= 2 && started) s -= Math.floor(ta * (sixty ? 1 : 0.6) / 2);
        if (v.p.p === 1 && started) s += Math.floor(rPois(rateOf(v.p).sv90 * Math.pow(Math.max(0.2, mineHome ? G.gb + 0.6 : G.ga + 0.6) / CFG.mu, 0.5), rnd) / 3);
        if (started && rnd() < rateOf(v.p).pDC) s += 2; if (rnd() < rateOf(v.p).yc90 * frac) s -= 1;
        const bm = (d.bo / Math.max(0.05, d.pPlay)) * (1 + 1.2 * g + 0.7 * a + (v.p.p <= 2 && cs ? 0.8 : 0)) / (1 + 1.2 * d.xg / Math.max(0.05, d.pPlay) + 0.7 * d.xa / Math.max(0.05, d.pPlay) + (v.p.p <= 2 ? 0.8 * d.pcs : 0));
        s += Math.min(3, rPois(bm, rnd)); pts += s; }); one.set(id, { pts, played }); });
      sides.forEach((s, k) => { let xi = s.xi.slice(); const bench = (s.bench || []).slice();   // automatic substitutions, keeping the eleven legal
        xi.forEach((p, idx) => { if (one.get(p.id).played) return; if (p.p === 1) { if (s.benchGk && one.get(s.benchGk.id).played) xi[idx] = s.benchGk; return; }
          for (let b = 0; b < bench.length; b++) { const c = bench[b]; if (!c || !one.get(c.id).played) continue; const trial = xi.slice(); trial[idx] = c; const cnt = { 2: 0, 3: 0, 4: 0 }; trial.forEach((x) => { if (x.p > 1) cnt[x.p]++; }); if (cnt[2] >= 3 && cnt[3] >= 2 && cnt[4] >= 1) { xi = trial; bench[b] = null; break; } } });
        let t = 0; xi.forEach((p) => { t += one.get(p.id).pts; });
        if (s.captain) { const c = one.get(s.captain.id), v = s.vice && one.get(s.vice.id), m = s.tc ? 2 : 1; if (c && c.played && xi.some((x) => x.id === s.captain.id)) t += m * c.pts; else if (v && v.played && xi.some((x) => x.id === s.vice.id)) t += m * v.pts; }
        scores[k][i] = t; });
    }
    return scores;
  }
  function summarise(arr) { const a = Array.from(arr).sort((x, y) => x - y), n = a.length; let m = 0; a.forEach((x) => { m += x; }); m /= n; let v = 0; a.forEach((x) => { v += (x - m) * (x - m); }); return { mean: m, sd: Math.sqrt(v / n), p10: quantile(a, 0.1), p25: quantile(a, 0.25), p50: quantile(a, 0.5), p75: quantile(a, 0.75), p90: quantile(a, 0.9), min: a[0], max: a[n - 1] }; }
  function h2h(gw, mine, theirs, n, seed) { const S = simulate(gw, [mine, theirs], n, seed); let w = 0, d = 0; for (let i = 0; i < n; i++) { if (S[0][i] > S[1][i]) w++; else if (S[0][i] === S[1][i]) d++; } return { win: w / n, draw: d / n, lose: 1 - (w + d) / n, me: summarise(S[0]), them: summarise(S[1]), n }; }
  function sideFromRoster(roster, gw, picksNow) {          // use the saved eleven when the feed has it, otherwise the best eleven
    if (picksNow && picksNow.length >= 11) { const xi = picksNow.filter((k) => k.pos <= 11).map((k) => P[k.id]).filter(Boolean), bench = picksNow.filter((k) => k.pos > 11).sort((a, b) => a.pos - b.pos).map((k) => P[k.id]).filter(Boolean); if (xi.length === 11) return { xi, bench: bench.filter((p) => p.p !== 1), benchGk: bench.find((p) => p.p === 1) || null, saved: true }; }
    const b = bestXI(roster, gw); return b ? { xi: b.xi, bench: b.bench, benchGk: b.benchGk, saved: false } : null;
  }

  /* Draft table race: every remaining head-to-head, each side's weekly score drawn around its projected best eleven. */
  function titleRace(g0, g1, n, seed, swapMine) {
    const rnd = mulberry(seed || 7), names = DATA.draft.entries.map((e) => e.name), mean = {}; const SD = 13.5;
    names.forEach((nm) => { const r = nm === DATA.draft.me && swapMine ? swapMine : draftRoster(nm); mean[nm] = {}; for (let g = g0; g <= g1; g++) { const b = bestXI(r, g); mean[nm][g] = b ? b.tot : 0; } });
    const base = {}; DATA.draft.standings.forEach((s) => { base[s.name] = { pts: s.pts, pf: s.pf }; });
    const games = DATA.draft.matches.filter((m) => !m.fin && m.gw >= g0 && m.gw <= g1), first = {}, top3 = {}, avgPts = {}, avgPos = {}; names.forEach((nm) => { first[nm] = 0; top3[nm] = 0; avgPts[nm] = 0; avgPos[nm] = 0; });
    for (let i = 0; i < n; i++) { const t = {}; names.forEach((nm) => { t[nm] = { pts: base[nm] ? base[nm].pts : 0, pf: base[nm] ? base[nm].pf : 0 }; });
      games.forEach((m) => { const a = Math.round(mean[m.a][m.gw] + SD * rNorm(rnd)), b = Math.round(mean[m.b][m.gw] + SD * rNorm(rnd)); t[m.a].pf += a; t[m.b].pf += b; if (a > b) t[m.a].pts += 3; else if (b > a) t[m.b].pts += 3; else { t[m.a].pts++; t[m.b].pts++; } });
      const ord = names.slice().sort((x, y) => t[y].pts - t[x].pts || t[y].pf - t[x].pf); ord.forEach((nm, k) => { if (k === 0) first[nm]++; if (k < 3) top3[nm]++; avgPos[nm] += k + 1; avgPts[nm] += t[nm].pts; }); }
    return names.map((nm) => ({ name: nm, first: first[nm] / n, top3: top3[nm] / n, pos: avgPos[nm] / n, pts: avgPts[nm] / n, strength: games.length ? Object.values(mean[nm]).reduce((s, x) => s + x, 0) / Math.max(1, Object.keys(mean[nm]).length) : 0 })).sort((a, b) => b.first - a.first || a.pos - b.pos);
  }

  /* ─────────────── post-mortems: each game on its own ─────────────── */
  function classicReview(lastN) {
    const gws = DATA.classic.gws.filter((g) => g.gw <= DATA.gw.lastDone).slice(-(lastN || 5));
    return gws.map((g) => { const pk = g.picks.map((k) => Object.assign({ pl: P[k.id] }, k)).filter((k) => k.pl); const xi = pk.filter((k) => k.pos <= 11), bench = pk.filter((k) => k.pos > 11);
      const cap = pk.find((k) => k.c), bestCap = pk.slice().sort((a, b) => b.pts - a.pts)[0];
      const best = bestXI(pk.map((k) => k.pl), g.gw, { val: (p) => (pk.find((k) => k.id === p.id) || {}).pts || 0 });
      const played = xi.reduce((s, k) => s + (k.pts || 0), 0), capGap = cap && bestCap ? (bestCap.pts - cap.pts) : 0;
      return { gw: g.gw, pts: g.pts, avg: g.avg, rank: g.rank, bench: g.bench, tx: g.tx, hit: g.hit, chip: g.chip, cap: cap ? { n: cap.pl.n, pts: cap.pts } : null, bestCap: bestCap ? { n: bestCap.pl.n, pts: bestCap.pts } : null, capGap,
        xiPts: played, bestXiPts: best ? best.tot : played, leftOnBench: best ? Math.max(0, best.tot - played) : 0, top: pk.slice().sort((a, b) => b.pts - a.pts).slice(0, 3).map((k) => ({ n: k.pl.n, pts: k.pts })), blanks: xi.filter((k) => (k.pts || 0) <= 2).map((k) => k.pl.n), benchBest: bench.slice().sort((a, b) => b.pts - a.pts).slice(0, 2).map((k) => ({ n: k.pl.n, pts: k.pts })) }; });
  }
  function draftReview(lastN) {
    const gws = DATA.draft.myGws.filter((g) => g.gw <= DATA.gw.lastDone).slice(-(lastN || 5));
    return gws.map((g) => { const pk = g.picks.map((k) => Object.assign({ pl: P[k.id] }, k)).filter((k) => k.pl), xi = pk.filter((k) => k.pos <= 11), bench = pk.filter((k) => k.pos > 11);
      const m = DATA.draft.matches.find((x) => x.gw === g.gw && (x.a === DATA.draft.me || x.b === DATA.draft.me)), mine = m ? (m.a === DATA.draft.me ? m.ap : m.bp) : null, opp = m ? (m.a === DATA.draft.me ? m.bp : m.ap) : null;
      const best = bestXI(pk.map((k) => k.pl), g.gw, { val: (p) => (pk.find((k) => k.id === p.id) || {}).pts || 0 }), played = xi.reduce((s, k) => s + (k.pts || 0), 0);
      return { gw: g.gw, mine, opp, oppName: m ? (m.a === DATA.draft.me ? m.b : m.a) : null, res: mine == null ? null : mine > opp ? "W" : mine < opp ? "L" : "D", xiPts: played, bestXiPts: best ? best.tot : played, leftOnBench: best ? Math.max(0, best.tot - played) : 0,
        flip: mine != null && mine <= opp && best && (mine + (best.tot - played)) > opp, top: pk.slice().sort((a, b) => b.pts - a.pts).slice(0, 3).map((k) => ({ n: k.pl.n, pts: k.pts })), benchBest: bench.slice().sort((a, b) => b.pts - a.pts).slice(0, 2).map((k) => ({ n: k.pl.n, pts: k.pts })) }; });
  }

  /* fixture run: average goals-for and clean-sheet chance across a window, per team */
  function ticker(g0, g1) { return teamNames.map((t) => { const row = []; let sf = 0, sc = 0, n = 0; for (let g = g0; g <= g1; g++) { const F = fx(t, g); row.push(F.map((f) => { const L = lambdas(t, f, g); sf += L.lf; sc += Math.exp(-L.la); n++; return { o: f.o, ha: f.ha, lf: L.lf, cs: Math.exp(-L.la), src: L.src }; })); } return { t, row, att: n ? sf / n : 0, cs: n ? sc / n : 0 }; }); }

  return { CFG, POS, P, byKey, RAT, calib, fx, deadline, lambdas, matchOdds, rateOf, avail, parts, ep, epRange, bestXI, squadValue, xiTotal, classicSquad, draftRoster, freeAgents, lockedFreeAgents, waiverPool, howToGet, waiverOrder, contested, waiverSim, rivalClaimLists, legalSwap, candidatePool, devig, fitRates, ODDS,
    classicTransfers, wildcard, draftMoves, bestDistinctMoves, simulate, summarise, h2h, sideFromRoster, titleRace, classicReview, draftReview, ticker, setMarket, clearCache: () => cache.clear(), teamNames,
    setDraftEnd: (g) => { CFG.draftEnd = g; }, maths: { poisPmf, poisTail, expFloorDiv, quantile, mulberry, clamp } };
}
return { create, FORMATIONS };
});

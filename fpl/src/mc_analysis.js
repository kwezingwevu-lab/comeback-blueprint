/* src/mc_analysis.js — the pure logic the v111 kit kept inside its interface file, ported without
 * any HTML (v110 §5 B5, B7, B8, B9). Ported from /home/claude/app/ui.js and the top of
 * /home/claude/app/build.js on 2026-09-27.
 *
 * Every function here takes (M, DATA, …) — M is an engine instance from src/mc_engine.js (or the
 * reference engine, which is how qa/parity.cjs proves each one) and DATA is the baked data block —
 * and returns a plain object. Nothing renders, nothing reads the DOM, nothing calls the network.
 * The interface wave decides how each result is shown; the numbers are made here.
 *
 *   buildClaimSheet(M, DATA, pairs, opts)  the ordered claims sheet (B7): each rival modelled with
 *                                           their top four distinct moves; one backup per slot, same
 *                                           position, wanted by no rival, gaining more than 3; two
 *                                           orderings run through the league's own waiver processing
 *                                           and the better kept; valueNow / valueStress / altValue /
 *                                           valueAll (also named allFirst). With opts.mc the kit's
 *                                           four orderings are also compared by Monte Carlo (claimsMC).
 *   findTrades(M, DATA, opts)              like-for-like swaps with every rival, sorted both-gain first
 *   tradeGroups(trades)                    the same list split into "both gain" and "ask"
 *   classicReviewSummary / draftReviewSummary / reviewSummary (B9): bench points scored against the
 *                                           avoidable ones, the captain gap, and the Draft results the
 *                                           best eleven would have flipped — each game on its own
 *   classicGameweekSim(M, DATA, opts)      the Classic gameweek simulation summary (B8)
 *   headToHead(M, DATA, opts)              the Draft head-to-head for the gameweek in focus (B8)
 *   greedyTransfers(M, DATA, opts)         the greedy transfer search, moves named out -> in (B4)
 *   claimability(M, DATA)                  the waiver pool with the phase-aware "how to get him" (B5)
 *   buildDraftSheet(M, DATA, pairs, opts)  the sheet the app writes (E-203, E-200): before waivers process, exactly
 *                                           buildClaimSheet's object; after, the same object plus the two parts —
 *                                           now (free agents to sign before the deadline, each with the drop that
 *                                           costs least) and next (locked players worth a claim at the next run)
 *   sheetLines(S)                          the lines a sheet writes: { phase, now, next }
 *
 * RULES ENCODED (fpl/CLAUDE.md Part N)
 *   · Like for like: every claim and every trade swaps a player for one in the same position. A pair
 *     that is not is refused by name, never lodged (spec §7.3, E-096).
 *   · Phase-aware labels: before waivers settle every unowned player is a claim; afterwards `a`
 *     signs instantly and `l` stays a claim until the next run (spec §7.4, E-097). The label itself
 *     is M.howToGet; claimability applies it to the whole pool and names the phase.
 *   · Two games, two currencies: no function here adds a Classic figure to a Draft figure, and every
 *     result carries its `game`.
 *
 * The constants below are the kit's own and are exported so a suite reads them rather than retyping
 * them (E-094). No figure in this file is a fact about the season.
 */
"use strict";

/* build.js: M.simulate(focus, [side], 20000, 11) and M.h2h(focus, me, them, 30000, 5) */
const MC_SIM_DRAWS = 20000, MC_SIM_SEED = 11;
const MC_H2H_DRAWS = 30000, MC_H2H_SEED = 5;
/* ui.js: CLAIM_RUNS = 1500 at seed 909, with a 600-run pilot at seed 11 to rank by landing chance */
const MC_CLAIM_RUNS = 1500, MC_CLAIM_SEED = 909, MC_PILOT_RUNS = 600, MC_PILOT_SEED = 11;
/* ui.js buildClaimSheet: rivals modelled with their top four distinct moves; a backup must gain more than 3 */
const MC_RIVAL_TOP = 4, MC_BACKUP_MIN_GAIN = 3;
/* ui.js findTrades: the quick screen, my minimum gain, the most a rival is asked to give up, and what counts as both gaining */
const MC_TRADE = { quick: 0.5, mine: 1, theirsFloor: -2.5, both: 0.2 };
/* ui.js vReview: five gameweeks per game, and the thresholds its verdicts turn on */
const MC_REVIEW_WEEKS = 5;
const MC_REVIEW_FLAGS = { captainGap: 6, classicBench: 8, draftBench: 10 };

/* The gameweek in focus: the one in play if a deadline has passed and it is not finished, else the next. */
function mcHorizon(M, DATA, opts) {
  opts = opts || {};
  const G = DATA.gw, next = opts.next || G.next, inPlay = G.live > G.lastDone ? G.live : null;
  return { next: next, inPlay: inPlay, focus: inPlay || next, cEnd: M.CFG.classicEnd, dEnd: opts.draftEnd || M.CFG.draftEnd };
}

/* ─────────────── B7 · the claims sheet ─────────────── */
function buildClaimSheet(M, DATA, pairs, opts) {
  opts = opts || {};
  const H = mcHorizon(M, DATA, opts), next = H.next, dEnd = H.dEnd, P = M.P;
  let list = (pairs || []).slice(), held = [];
  /* opts.fitOnly (v110, data/weekly.js and data/pre.json): no flagged player is lodged, first choice or backup —
     CLAUDE.md D2 sends any flag back for re-evaluation, and qa/smoke_wk.cjs holds every incoming player to status "a".
     Off by default, so the parity-proven sheet (B7) is byte for byte the reference's. */
  if (opts.fitOnly) { const cp = claimablePairs(M, list); list = cp.pairs; held = cp.held; }
  /* like for like (Part N2, spec §7.3): a pair the game would reject never reaches the sheet */
  list.forEach(function (q) {
    const a = P[q.add], d = P[q.drop];
    if (!a || !d) throw new Error("claims sheet: unknown player in the pair " + q.add + " for " + q.drop);
    if (a.p !== d.p) throw new Error("claims sheet: " + a.n + " (" + M.POS[a.p] + ") for " + d.n + " (" + M.POS[d.p] + ") is not position for position, so it cannot be lodged");
  });
  const RL = M.rivalClaimLists(next, dEnd, MC_RIVAL_TOP), order = M.waiverOrder(), wanted = new Set();
  Object.values(RL).forEach(function (v) { v.forEach(function (c) { wanted.add(c.add); }); });
  const val = function (id) { return M.epRange(P[id], next, dEnd); };
  const prim = list.map(function (q) { return { add: q.add, drop: q.drop, gain: val(q.add) - val(q.drop) }; }).sort(function (a, b) { return b.gain - a.gain; });
  const primAdds = new Set(prim.map(function (q) { return q.add; }));
  const usedBackup = new Set(), backups = [];
  prim.forEach(function (q) {
    const drop = P[q.drop];
    const alt = M.waiverPool().filter(function (p) { return p.p === drop.p && !primAdds.has(p.id) && !wanted.has(p.id) && !usedBackup.has(p.id) && (!opts.fitOnly || p.st === "a"); })
      .map(function (p) { return { id: p.id, v: val(p.id) }; }).sort(function (a, b) { return b.v - a.v; })[0];
    if (alt && alt.v - val(q.drop) > MC_BACKUP_MIN_GAIN) { backups.push({ add: alt.id, drop: q.drop, gain: alt.v - val(q.drop), of: q.add }); usedBackup.add(alt.id); }
  });
  const roster = M.draftRoster().map(function (p) { return p.id; });
  const value = function (ids) { return M.squadValue(ids.map(function (i) { return P[i]; }), next, dEnd, false); };
  const run = function (flat) {
    const sim = M.waiverSim(flat, RL, order), after = roster.slice();
    sim.mine.filter(function (x) { return x.ok; }).forEach(function (x) { const k = after.indexOf(x.drop); if (k >= 0) after[k] = x.add; });
    return { sim: sim, after: after, value: value(after) };
  };
  /* two ways to order the same claims; the league's round-robin processing decides which lands more */
  const A = prim.map(function (q) { return { add: q.add, drop: q.drop, gain: q.gain, kind: "first" }; })
    .concat(backups.map(function (b) { return { add: b.add, drop: b.drop, gain: b.gain, kind: "backup", of: b.of }; }));
  const B = [];
  prim.forEach(function (q) {
    B.push({ add: q.add, drop: q.drop, gain: q.gain, kind: "first" });
    const bk = backups.find(function (x) { return x.of === q.add; });
    if (bk) B.push({ add: bk.add, drop: bk.drop, gain: bk.gain, kind: "backup", of: q.add });
  });
  const rA = run(A), rB = run(B), useA = rA.value >= rB.value - 1e-9, sheet = useA ? A : B, r = useA ? rA : rB;
  const landed = r.sim.mine.filter(function (x) { return x.ok; }).map(function (x) { return x.add; });
  const lost = r.sim.mine.filter(function (x) { return !x.ok && x.why === "already claimed"; }).map(function (x) { return x.add; });
  const valueAll = value(roster.map(function (i) { const q = prim.find(function (z) { return z.drop === i; }); return q ? q.add : i; }));
  const out = {
    game: "draft", sheet: sheet, strategy: useA ? "firsts" : "paired", altValue: useA ? rB.value : rA.value,
    sim: r.sim.mine.map(function (x) { return { round: x.round, add: x.add, drop: x.drop, ok: x.ok, why: x.why || null }; }),
    landed: landed, lost: lost, valueNow: value(roster), valueStress: r.value, valueAll: valueAll, allFirst: valueAll, held: held,
    rivals: Object.fromEntries(Object.entries(RL).map(function (kv) { return [kv[0], kv[1].slice(0, 3).map(function (c) { return c.add; })]; }))
  };
  /* the additive v111 delta: the same claims under four orderings, each rival active as often as the league log
     shows, on common random numbers. Reported beside the deterministic stress test, never in place of it. */
  if (opts.mc && typeof M.claimsMC === "function") {
    const mcOpt = typeof opts.mc === "object" ? opts.mc : {};
    const runs = mcOpt.runs || MC_CLAIM_RUNS, seed = mcOpt.seed || MC_CLAIM_SEED;
    const tag = function (kind, arr) { return arr.map(function (c) { return Object.assign({}, c, { kind: kind }); }); };
    const pilot = M.claimsMC([{ name: "pilot", list: A }], { runs: mcOpt.pilotRuns || MC_PILOT_RUNS, seed: mcOpt.pilotSeed || MC_PILOT_SEED, g0: next, g1: dEnd }).res[0];
    const C = tag("first", prim.slice().sort(function (x, y) { return y.gain * pilot.land[y.add] - x.gain * pilot.land[x.add]; })).concat(tag("backup", backups));
    const D = tag("first", prim.slice().sort(function (x, y) { return pilot.land[y.add] - pilot.land[x.add] || y.gain - x.gain; })).concat(tag("backup", backups));
    const mc = M.claimsMC([
      { name: "all first choices, then backups", list: A }, { name: "each backup under its first choice", list: B },
      { name: "highest expected gain first", list: C }, { name: "likeliest to land first", list: D }
    ], { runs: runs, seed: seed, g0: next, g1: dEnd });
    const kept = mc.res.find(function (x) { return x.list === sheet; }) || mc.res[0];
    out.orderings = mc.res.map(function (x) { return { name: x.name, mean: x.mean, p10: x.p10, p90: x.p90 }; });
    out.land = kept.land; out.meanValue = kept.mean; out.p10 = kept.p10; out.p90 = kept.p90; out.runs = mc.runs;
  }
  return out;
}

/* ─────────────── trades ─────────────── */
function findTrades(M, DATA, opts) {
  const H = mcHorizon(M, DATA, opts), next = H.next, dEnd = H.dEnd, myRoster = M.draftRoster();
  const base = M.squadValue(myRoster, next, dEnd, false), out = [];
  DATA.draft.entries.forEach(function (e) {
    if (e.name === DATA.draft.me) return;
    const theirs = M.draftRoster(e.name), tb = M.squadValue(theirs, next, dEnd, false);
    myRoster.forEach(function (give) { theirs.forEach(function (get) {
      if (give.p !== get.p) return;                                       // Draft squads must stay 2-5-5-3, so every swap is position for position (Part N2)
      const mineSq = myRoster.map(function (x) { return x === give ? get : x; }), theirSq = theirs.map(function (x) { return x === get ? give : x; });
      const quick = M.epRange(get, next, dEnd) - M.epRange(give, next, dEnd); if (quick < MC_TRADE.quick) return;
      const mine = M.squadValue(mineSq, next, dEnd, false) - base; if (mine < MC_TRADE.mine) return;
      const th = M.squadValue(theirSq, next, dEnd, false) - tb; if (th < MC_TRADE.theirsFloor) return;
      out.push({ rival: e.name, get: get.id, give: give.id, mine: mine, theirs: th, both: th > MC_TRADE.both });
    }); });
  });
  return out.sort(function (a, b) { return (b.both ? 1 : 0) - (a.both ? 1 : 0) || b.mine + b.theirs - (a.mine + a.theirs); });
}
function tradeGroups(trades) {
  const t = trades || [];
  return { game: "draft", both: t.filter(function (x) { return x.both; }), ask: t.filter(function (x) { return !x.both; }) };
}

/* ─────────────── B9 · post-mortems, each game on its own ─────────────── */
function classicReviewSummary(M, DATA, opts) {
  opts = opts || {};
  const rows = M.classicReview(opts.weeks || MC_REVIEW_WEEKS);
  const sum = function (f) { return rows.reduce(function (s, g) { return s + f(g); }, 0); };
  const benchScored = sum(function (g) { return g.bench || 0; }), avoidable = sum(function (g) { return g.leftOnBench; });
  const captainGap = sum(function (g) { return g.capGap; }), vsAverage = sum(function (g) { return g.pts - g.avg; });
  const captainBest = rows.filter(function (g) { return g.capGap === 0; }).length, noTransfers = rows.every(function (g) { return !g.tx; });
  return { game: "classic", weeks: rows.length, rows: rows, benchScored: benchScored, avoidable: avoidable, captainGap: captainGap, captainBest: captainBest,
    vsAverage: vsAverage, noTransfers: noTransfers,
    flags: { captain: captainGap > MC_REVIEW_FLAGS.captainGap, bench: avoidable > MC_REVIEW_FLAGS.classicBench, noTransfers: noTransfers } };
}
function draftReviewSummary(M, DATA, opts) {
  opts = opts || {};
  const n = opts.weeks || MC_REVIEW_WEEKS, rows = M.draftReview(n), P = M.P;
  /* what the bench scored, from the same picks the engine scores: the engine reports the avoidable part only */
  const gws = DATA.draft.myGws.filter(function (g) { return g.gw <= DATA.gw.lastDone; }).slice(-n);
  const perWeek = gws.map(function (g) {
    const bench = g.picks.filter(function (k) { return P[k.id] && k.pos > 11; });
    return { gw: g.gw, benchScored: bench.reduce(function (s, k) { return s + (k.pts || 0); }, 0) };
  });
  const sum = function (f) { return rows.reduce(function (s, g) { return s + f(g); }, 0); };
  const avoidable = sum(function (g) { return g.leftOnBench; }), benchScored = perWeek.reduce(function (s, w) { return s + w.benchScored; }, 0);
  const count = function (r) { return rows.filter(function (g) { return g.res === r; }).length; };
  const flipped = rows.filter(function (g) { return g.flip; }).map(function (g) { return g.gw; });
  return { game: "draft", weeks: rows.length, rows: rows, perWeek: perWeek, benchScored: benchScored, avoidable: avoidable, flipped: flipped,
    wins: count("W"), draws: count("D"), losses: count("L"),
    flags: { bench: avoidable > MC_REVIEW_FLAGS.draftBench, noWins: rows.length > 0 && count("W") === 0, flipped: flipped.length > 0 } };
}
function reviewSummary(M, DATA, opts) {
  return { classic: classicReviewSummary(M, DATA, opts), draft: draftReviewSummary(M, DATA, opts) };
}

/* ─────────────── B8 · Monte Carlo ─────────────── */
function classicGameweekSim(M, DATA, opts) {
  opts = opts || {};
  const H = mcHorizon(M, DATA, opts), cs = M.classicSquad(); if (!cs) return null;
  const gws = DATA.classic.gws, last = gws[gws.length - 1];
  const pk = last.picks.map(function (k) { return Object.assign({ pl: M.P[k.id] }, k); }).filter(function (k) { return k.pl; });
  let side;
  if (last.gw === H.focus) {                                                  // the saved eleven, once it has published
    const b = pk.filter(function (k) { return k.pos > 11; }).sort(function (a, c) { return a.pos - c.pos; }).map(function (k) { return k.pl; });
    side = { xi: pk.filter(function (k) { return k.pos <= 11; }).map(function (k) { return k.pl; }), bench: b.filter(function (p) { return p.p !== 1; }),
      benchGk: b.find(function (p) { return p.p === 1; }) || null, captain: (pk.find(function (k) { return k.c; }) || {}).pl, vice: (pk.find(function (k) { return k.v; }) || {}).pl, tc: last.chip === "3xc" };
  } else {                                                                    // otherwise the best eleven on expected points
    const b = M.bestXI(cs.squad, H.focus);
    side = { xi: b.xi, bench: b.bench, benchGk: b.benchGk, captain: b.cap, vice: b.vice };
  }
  const draws = opts.draws || MC_SIM_DRAWS, seed = opts.seed || MC_SIM_SEED;
  return Object.assign({ game: "classic", gw: H.focus, saved: last.gw === H.focus, draws: draws, seed: seed }, M.summarise(M.simulate(H.focus, [side], draws, seed)[0]));
}
function headToHead(M, DATA, opts) {
  opts = opts || {};
  const H = mcHorizon(M, DATA, opts), me = DATA.draft.me;
  const m = DATA.draft.matches.find(function (x) { return x.gw === H.focus && (x.a === me || x.b === me); }); if (!m) return null;
  const on = m.a === me ? m.b : m.a, now = DATA.draft.rivalsNow || {};
  const mineNow = H.focus === H.inPlay ? (now[me] || ((DATA.draft.myGws.find(function (g) { return g.gw === H.focus; }) || {}).picks)) : null;
  const theirNow = H.focus === H.inPlay ? now[on] : null;
  const mine = M.sideFromRoster(M.draftRoster(), H.focus, mineNow), theirs = M.sideFromRoster(M.draftRoster(on), H.focus, theirNow);
  if (!mine || !theirs) return null;
  const draws = opts.draws || MC_H2H_DRAWS, seed = opts.seed || MC_H2H_SEED;
  return Object.assign({ game: "draft", gw: H.focus, opp: on, mySaved: mine.saved, theirSaved: theirs.saved, draws: draws, seed: seed }, M.h2h(H.focus, mine, theirs, draws, seed));
}

/* ─────────────── B4 · the greedy transfer search, as the kit's build runs it ─────────────── */
function greedyTransfers(M, DATA, opts) {
  const H = mcHorizon(M, DATA, opts), cs = M.classicSquad(); if (!cs) return null;
  const cap = DATA.rules && DATA.rules.maxFt ? DATA.rules.maxFt : 5;        // the free-transfer bank's ceiling, read from the data
  const maxMoves = Math.min(cs.ft, cap);
  const tr = M.classicTransfers(cs, H.next, H.cEnd, maxMoves);
  return { game: "classic", gw: H.next, horizonEnd: H.cEnd, maxMoves: maxMoves,
    moves: tr.moves.map(function (m) { return { out: m.out.id, inn: m.inn.id, label: m.out.n + " -> " + m.inn.n, gain: m.gain, gainNext: m.gainNext, bankAfter: m.bankAfter }; }),
    value: tr.value, baseValue: M.squadValue(cs.squad, H.next, H.cEnd, true), bank: tr.bank };
}

/* ─────────────── the pairs the app will lodge ─────────────── */
/* The Draft solve (PLAN.draft.pairs) maximises the roster's expected points, and a flagged player's chance is already
   inside those points. The app still never lodges a claim for a flagged player: CLAUDE.md D2 says any flag sends the
   recommendation touching that player back for re-evaluation first, and qa/smoke_wk.cjs holds every written claim's
   incoming player to status "a". So the pairs are filtered before the sheet is built — by data/weekly.js and
   data/pre.json alike, through this one function, so the two sheets cannot differ — and what was left out is
   returned with its flag, for the interface to name. buildClaimSheet itself is untouched (parity B7). */
function claimablePairs(M, pairs) {
  const P = M.P, keep = [], held = [];
  (pairs || []).forEach(function (q) {
    const a = P[q.add];
    if (a && a.st === "a") keep.push(q);
    else held.push({ add: q.add, drop: q.drop, status: a ? a.st : null, chance: a ? a.cop : null });
  });
  return { game: "draft", pairs: keep, held: held };
}

/* ─────────────── the two-part Draft sheet (E-203, E-200, 21 Nov 2026) ───────────────
   After the week's waiver run a claims sheet is the wrong instrument: a player dropped in that run is locked until the next
   one, every other unowned player can be signed at once, and a "first choice" that is locked or a "backup" that can be
   signed sends the manager to buttons that do not work (E-203: on 20 Nov the sheet led with Gibbs-White and Schade, both
   locked). So once waivers have processed the sheet has two parts, built here and nowhere else:
     now   fit free agents (league status a, FPL status a), chosen one at a time: the like-for-like swap that adds most to
           the roster's Draft value to the horizon, then the next on the changed roster, until none adds MC_SIGN_MIN_GAIN.
           Each line's drop is the one that costs least for that add (E-200: never the solver's list-order pairing).
     next  fit locked players worth a claim at the next waiver run, the same way, from the gameweek after this one, on the
           roster the signings leave (so a drop can be a player signed above), with the run's time and the manager's place.
           The place is a range, not today's waiver_pick: this league orders each run by the table after the gameweek
           before it, bottom first, so while that gameweek is unplayed the place can still move (waiverPlaceRange; 21 Nov
           2026, the pre-ship review: today's pick 1 becomes 2 if the manager wins his GW11 match).
   Flagged players are still held back (heldBack), each priced on the roster both parts leave, from the week he could
   first arrive, and only while he would still add MC_SIGN_MIN_GAIN before the horizon (never the solver's list-order drop).
   Before waivers process the function returns buildClaimSheet's object untouched, so that phase is byte for byte today's
   and parity B7 is untouched. The greedy choice is checked against an exhaustive search in qa/mc_optimisers.cjs. */
const MC_SIGN_MIN_GAIN = 0.25, MC_SIGN_PER_POS = 14, MC_PLACE_MAX_OPEN = 8;
/* The manager's place at the waiver run before gameweek `run`, as {min, max, of, after, open}. The league's own log shows each
   run processed in reverse order of the table after the previous gameweek (points, then points for): GW2 to GW11, no exception
   but two exact ties. While matches up to gameweek run-1 are unplayed every win, draw and loss is tried; a tie on points
   counts both ways, because the unplayed matches still move points for. With every match played the place is exact. Null
   when the standings do not name the manager or too many matches are open to enumerate. */
function waiverPlaceRange(DATA, run) {
  const d = DATA && DATA.draft; if (!d || !Array.isArray(d.standings)) return null;
  const me = d.me, pts = {}, pf = {};
  d.standings.forEach(function (x) { if (x && typeof x.name === "string") { pts[x.name] = Number(x.pts) || 0; pf[x.name] = Number(x.pf) || 0; } });
  if (!(me in pts)) return null;
  const open = (Array.isArray(d.matches) ? d.matches : []).filter(function (m) { return m && m.gw < run && !m.fin && (m.a in pts) && (m.b in pts); });
  if (open.length > MC_PLACE_MAX_OPEN) return null;
  const names = Object.keys(pts);
  let lo = Infinity, hi = -Infinity;
  for (let k = 0, n = Math.pow(3, open.length); k < n; k++) {
    const p = Object.assign({}, pts); let c = k;
    open.forEach(function (m) { const r = c % 3; c = (c - r) / 3; if (r === 0) p[m.a] += 3; else if (r === 1) { p[m.a] += 1; p[m.b] += 1; } else p[m.b] += 3; });
    let below = 0, level = 0;
    names.forEach(function (x) {
      if (x === me) return;
      if (p[x] < p[me]) below++;
      else if (p[x] === p[me]) { if (open.length) level++; else if (pf[x] < pf[me]) below++; }
    });
    lo = Math.min(lo, below + 1); hi = Math.max(hi, below + level + 1);
  }
  return { min: lo, max: hi, of: names.length, after: run - 1, open: open.length };
}
function greedySwaps(M, roster, pool, g0, g1) {
  let cur = roster.slice();
  const start = new Set(roster.map(function (p) { return p.id; })), dropped = new Set(), added = new Set(), lines = [];
  for (let k = 0; k < roster.length; k++) {
    const avail = pool.filter(function (p) { return !added.has(p.id) && !start.has(p.id); });
    if (!avail.length) break;
    const mv = M.draftMoves(cur, g0, g1, { pool: avail, perPos: MC_SIGN_PER_POS })
      .filter(function (m) { return start.has(m.drop.id) && !dropped.has(m.drop.id); })[0];
    if (!mv || !(mv.gain >= MC_SIGN_MIN_GAIN)) break;
    lines.push({ add: mv.add.id, drop: mv.drop.id, gain: mv.gain });
    added.add(mv.add.id); dropped.add(mv.drop.id);
    cur = cur.map(function (x) { return x === mv.drop ? mv.add : x; });
  }
  return { lines: lines, after: cur };
}
function buildDraftSheet(M, DATA, pairs, opts) {
  opts = opts || {};
  const out = buildClaimSheet(M, DATA, pairs, opts);
  if (!DATA || !DATA.draft || DATA.draft.waiversProcessed !== true) return out;
  const H = mcHorizon(M, DATA, opts), next = H.next, dEnd = H.dEnd, P = M.P;
  const fit = function (p) { return !!p && p.st === "a"; };
  const one = greedySwaps(M, M.draftRoster(), M.freeAgents().filter(fit), next, dEnd);
  const run = next + 1, evs = DATA.draft.events || {}, ev = evs[String(run)] || {};
  let nx = null, last = one.after;
  if (run <= dEnd && typeof ev.wv === "string") {
    const order = M.waiverOrder(), pr = waiverPlaceRange(DATA, run);
    const two = greedySwaps(M, one.after, M.lockedFreeAgents().filter(fit), run, dEnd);
    nx = { gw: run, wv: ev.wv, placeMin: pr ? pr.min : 1, placeMax: pr ? pr.max : order.length, orderAfter: run - 1, of: order.length,
      placeKnown: !!pr, claims: two.lines };
    last = two.after;
    // a signing the next run swaps out again is kept only to the gameweek before that run: say so on the line
    const out2 = new Set(two.lines.map(function (l) { return l.drop; }));
    one.lines.forEach(function (l) { if (out2.has(l.add)) l.until = run - 1; });
  }
  const used = new Set(one.lines.map(function (l) { return l.add; }).concat(nx ? nx.claims.map(function (l) { return l.add; }) : []));
  out.phase = "free";
  out.now = one.lines;
  out.next = nx;
  out.heldBack = (out.held || []).filter(function (h) { return !used.has(h.add) && P[h.add]; }).map(function (h) {
    const a = P[h.add], how = M.howToGet(a), from = how === "free" ? next : run;
    const best = from <= dEnd ? M.draftMoves(last, from, dEnd, { pool: [a] })[0] : null;
    return best && best.gain >= MC_SIGN_MIN_GAIN
      ? { add: h.add, drop: best.drop.id, status: h.status, chance: h.chance, gain: best.gain, from: from, how: how } : null;
  }).filter(Boolean);
  out.valueAfter = M.squadValue(one.after, next, dEnd, false);
  return out;
}
function sheetLines(S) {
  if (S && S.phase === "free") return { phase: "free", now: Array.isArray(S.now) ? S.now : [], next: S.next && Array.isArray(S.next.claims) ? S.next.claims : [] };
  return { phase: "claims", now: S && Array.isArray(S.sheet) ? S.sheet : [], next: [] };
}

/* ─────────────── B5 · claimability ─────────────── */
function claimability(M, DATA) {
  const processed = !!DATA.draft.waiversProcessed, pool = M.waiverPool();
  return { game: "draft", phase: processed ? "free" : "claims", waiversProcessed: processed,
    pool: pool.map(function (p) { return { id: p.id, ds: p.ds, how: M.howToGet(p) }; }),
    locked: pool.filter(function (p) { return p.ds === "l"; }).length };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    mcHorizon: mcHorizon, buildClaimSheet: buildClaimSheet, findTrades: findTrades, tradeGroups: tradeGroups,
    classicReviewSummary: classicReviewSummary, draftReviewSummary: draftReviewSummary, reviewSummary: reviewSummary,
    classicGameweekSim: classicGameweekSim, headToHead: headToHead, greedyTransfers: greedyTransfers, claimability: claimability, claimablePairs: claimablePairs,
    buildDraftSheet: buildDraftSheet, sheetLines: sheetLines, greedySwaps: greedySwaps, waiverPlaceRange: waiverPlaceRange,
    MC_SIGN_MIN_GAIN: MC_SIGN_MIN_GAIN, MC_SIGN_PER_POS: MC_SIGN_PER_POS, MC_PLACE_MAX_OPEN: MC_PLACE_MAX_OPEN,
    MC_SIM_DRAWS: MC_SIM_DRAWS, MC_SIM_SEED: MC_SIM_SEED, MC_H2H_DRAWS: MC_H2H_DRAWS, MC_H2H_SEED: MC_H2H_SEED,
    MC_CLAIM_RUNS: MC_CLAIM_RUNS, MC_CLAIM_SEED: MC_CLAIM_SEED, MC_PILOT_RUNS: MC_PILOT_RUNS, MC_PILOT_SEED: MC_PILOT_SEED,
    MC_RIVAL_TOP: MC_RIVAL_TOP, MC_BACKUP_MIN_GAIN: MC_BACKUP_MIN_GAIN, MC_TRADE: MC_TRADE, MC_REVIEW_WEEKS: MC_REVIEW_WEEKS, MC_REVIEW_FLAGS: MC_REVIEW_FLAGS
  };
}

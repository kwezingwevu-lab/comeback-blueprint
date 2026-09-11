/*
 * FPL Mission Control — pure engine (src/engine.js), v87.
 *
 * Rules of this file: top-level function declarations only; no React, no DOM, no
 * imports, no Date.now() inside pure functions (pass `now` in). Every function is
 * total — bad input yields a safe empty result — except parseJson and applyRefresh,
 * which throw by specification (D4). The API's two opaque expected-points fields are
 * never read (D1 bans them; verify.sh greps the assembled file for their names).
 *
 * Most decision functions take a `ctx` built once by buildCtx(live, state, now).
 * Prices are in tenths (integers). Ids are classic FPL element ids; draft players are
 * joined on `code`.
 *
 * EXPORTS (signature → return shape)
 *
 * Constants
 *   SCORING                         {1:{…},2:{…},3:{…},4:{…}} per element_type (B1)
 *   REFRESH_PAIRS                   {sonnet46|sonnet5|opus5: {model, tool}}
 *   DECAY, PRIOR_PPS, FORMATIONS    E1 decay weights, position priors, legal formations
 *
 * Context
 *   buildCtx(live, state, now)      → ctx {ok, els, elList, byCode, teams, events, nextEvent,
 *                                      currentEvent, deadline, hoursToDeadline, phase, fixtures,
 *                                      fixturesByEvent, finishedGws, TS, TS_GOALS, Lbar, gwStats,
 *                                      rivalOwn, capShare, flags, mults, xp, squadIds, squad, picks,
 *                                      ft, bank, value, budget, block, baseRates, draft, leagues, error}
 *   elementGwStats(live)            → {id: {games, starts, played, minutes, everBenched, starts_last3,
 *                                      startedLast, konsa, last3[], dcRate, bonusRate, ptsPerGame, …}}
 *   flagInfo(el)                    → {flagged, status, chance, news, factor}
 *   isFlagged(el)                   → boolean
 *   gamePhase(live, now)            → "pre" | "live" | "post"
 *   nowMs(now)                      → epoch ms (0 if unparseable)
 *
 * Scoring (B1)
 *   pointsFor(statsRow, elementType, scoring?) → integer points (FWD never CS; GKP never DefCon)
 *   draftScoring(live)              → SCORING-shaped table from live.draft.scoring (GKP goal 10)
 *   gwPoints(picks, gwData)         → Σ pts × multiplier from a finished live.gw block
 *
 * Constraints (B3)
 *   legal15(ids, els, budget=1000)  → {ok, reasons[], cost, counts, clubs}
 *   legalXI(ids, els)               → {ok, reasons[], formation}
 *   formationOf(ids, els)           → "D-M-F" string ("" if not 11)
 *   clubCounts(ids, els)            → {teamId: n}
 *
 * xP (E1)
 *   shrunkPps(el)                   → number (K=4, position priors)
 *   pStart(el, gwStats)             → probability [0,1]
 *   fxMult(fixture, teamId, TS)     → multiplier (1 when the team is not in the fixture, and 1
 *                                     when the argument is not a fixture object at all — ask
 *                                     fxMultInfo which of the two it was)
 *   fxMultInfo(fixture, teamId, TS) → {mult, resolved, reason}: resolved=false means the 1 is the
 *                                     unresolved default, not a computed multiplier (E-043)
 *   xp1(el, ctx) / xp5(el, ctx)     → number (cached in ctx.xp)
 *   xp1With(el, ctx, tsKey) / xp5With(el, ctx, tsKey)  → number under "TS" or "TS_GOALS"
 *   xp5FromMults(el, pstart, mults) → number (worked example: 5.23 × 0.875 × 3.557 = 16.3)
 *   teamMults(teamId, ctx, tsKey)   → [m0..m4] for the next five events (0 on a blank)
 *
 * Strength (E2)
 *   teamStrength(live)              → {TS:{teamId:{att,def,g,xgf,xga,Lbar}}, TS_GOALS:{…}, Lbar, LbarGoals}
 *   tsXg(t,o,home,TS) / tsMult(t,o,home,TS) / tsPcs(t,o,home,TS) → numbers (tsPcs ∈ (0,1))
 *   overUnderTags(live)             → [{teamId, short_name, g, gf, xgf, ga, xga, tagFor, tagAgainst}]
 *   runAvg(teamId, fixtures, n)     → FDR 1–5 (comparison panel only)
 *
 * Rivals (E3)
 *   rivalOwn(live)                  → {leagueId:{elementId: share}}
 *   capShare(live)                  → {leagueId:{elementId: share}}
 *   classify(el, ctx)               → "EDGE" | "SHARED" | "DEAD" | "NEUTRAL"
 *   convergenceRisk(elementId, ctx) → {risk, max, league}
 *   rivalOwnMax(elementId, ctx)     → {max, league}
 *
 * Decisions (C1–C5)
 *   captainPick(xiIds, ctx)         → {capId, viceId, table[], reasons[]}
 *   bestXI(ids, ctx)                → {ids, capId, viceId, formation, score, bench[]}
 *   benchOrder(squadIds, xiIds, ctx)→ ordered outfield bench ids (GKP excluded)
 *   sellCandidates(squad, ctx)      → [{id, web_name, reason, forced, konsa}]
 *   transferProtocol(state, ctx)    → {moves[], order[], captain, vice, value, margin, confidence,
 *                                      hits, k, bankAfter, forced[], alternatives[], reasons[], blocked}
 *                                      order is sells, then buys, then the captain and vice steps,
 *                                      on every path that reaches an eleven — hold included (E-037)
 *   wildcardSolver(ctx, opts)       → {ok, ids, xi, cost, bank, score, model, alt, disagreement,
 *                                      relaxed, relaxations[], reasons[], steps, spend}
 *   wcSetup(ctx, opts, tsKey)       → {ok, budget, pool, cands, cheap, minCost, locks, lockSet,
 *                                      current, relaxed, relaxations[], reasons[]} — the pool,
 *                                      windows and budget the solver and its audit both use
 *   wcFeasible(ids, ctx, W)         → boolean (B3 + ≤3/club + ≤2 incoming/club + budget lookahead)
 *   wcCost(ids, ctx)                → tenths
 *   wcLocalOptimum(ids, ctx, opts)  → {ok, optimal, checked, dearerTried, bestGain, bank,
 *                                      improvements[], reason} — no legal single swap over the
 *                                      whole pool improves the fifteen (the acceptance criterion)
 *   wildcardOptions(ctx, opts)      → {ok, pure, locked, written, locks[], deltas, budget, note}
 *                                      the three priced answers to the C1.6 conflict; opts.written
 *                                      supplies the manager’s fifteen when no WEEKLY block is in
 *                                      scope. Changes neither the solver default nor rule C1.6.
 *   wildcardTiming(ctx)             → {gw, weeklyGap, swapsNeeded, horizons[], grid[], breakeven,
 *                                      saturated:{saturates, weeks, gw, note}, note} — both
 *                                      horizons include their end gameweek (E-042)
 *   chipWindows(live)               → {doubles[], blanks[], recommendation, nextEvent}
 *   chipRegret(chip, ctx, opts)     → {chip, useNow, bestLater, laterEvent, regretUse, regretHold, verdict, note}
 *   draftWaivers(state, ctx)        → [{priority, out, in, outName, inName, evOut, evIn, gain, why}]
 *   watchlistAudit(codes, ctx)      → {keep[], drop[], unknown[], detail[]}
 *   draftXI(codes, ctx)             → {codes, ids, formation, score, gk, def[], mid[], fwd[], bench[]}
 *
 * Squad / state
 *   sanitiseState(raw)              → state (§6 shape; cap 15, dedupe on id; never throws)
 *   detectSquadChange(stateSquadIds, picks) → {changed, added[], removed[], block}
 *   ftAvailable(history, currentEvent, chips?) → integer 1..5. Accepts the history object or its
 *                                      rows array and gives the SAME answer either way: chips come
 *                                      from the object, from the third argument, or are inferred
 *                                      from a gameweek that used more free transfers than the cap
 *   sellPrice(now, purchase)        → tenths (purchase + floor(rise/2); falls follow now)
 *   bankAfter(state, moves, els)    → tenths (raw)
 *
 * Monte Carlo (E4)
 *   mulberry32(seed)                → rng() in [0,1)
 *   simFixture(fixture, ctx, rng)   → {h, a} shared goals draw
 *   simPlayer(el, ctx, rng, draw?)  → points (may be negative)
 *   mcSquad(ids, capId, ctx, iters, seed, viceId?) → {mean, sd, q10, q50, q90, iters}
 *                                      iters is floored at MC_MIN_ITERS (100): one draw is not a
 *                                      distribution and is never reported as one (E-046)
 *   mcLeague(ctx, leagueId, opts)   → {leagueId, direction, rankBand, currentRank, medianRank, pWin|null, …}
 *
 * Tournament (E5)
 *   tournament(live)                → {models:[{key,name,spearman,mae,maeRaw,maeScale,
 *                                      maeCalibrated,transitions}], leader, promotable,
 *                                      transitions, maeUnits:"points", maeNote} — MAE is rescaled
 *                                      into points before it is compared across models (E-047)
 *   calibrateToPoints(pred, actual) → {scale, calibrated, pred[]}
 *   spearman(a, b) / mae(a, b)      → numbers
 *
 * Refresh (D4)
 *   parseJson(text)                 → object (throws with the real message)
 *   stripFences(text)               → string with an opening and a closing fence line removed and
 *                                     nothing touched in between (E-044)
 *   pickText(contentBlocks)         → string (only type==="text", any order)
 *   blockTypes(contentBlocks)       → string listing block types seen
 *   refreshRequest(cfg)             → {model, max_tokens:4000, tools:[{type,name:"web_search"}], messages}
 *   applyRefresh(state, parsed)     → new state (throws on invalid input; never mutates)
 */

var ENGINE_VERSION = "v87";

var SCORING = {
  1: { play_short: 1, play_long: 2, goal: 6, assist: 3, cs: 4, gc_per2: -1, saves_per3: 1, pen_save: 5, pen_miss: -2, yc: -1, rc: -3, og: -2, dc: 0, dc_threshold: null, bonus: 1 },
  2: { play_short: 1, play_long: 2, goal: 6, assist: 3, cs: 4, gc_per2: -1, saves_per3: 0, pen_save: 0, pen_miss: -2, yc: -1, rc: -3, og: -2, dc: 2, dc_threshold: 10, bonus: 1 },
  3: { play_short: 1, play_long: 2, goal: 5, assist: 3, cs: 1, gc_per2: 0, saves_per3: 0, pen_save: 0, pen_miss: -2, yc: -1, rc: -3, og: -2, dc: 2, dc_threshold: 12, bonus: 1 },
  4: { play_short: 1, play_long: 2, goal: 4, assist: 3, cs: 0, gc_per2: 0, saves_per3: 0, pen_save: 0, pen_miss: -2, yc: -1, rc: -3, og: -2, dc: 2, dc_threshold: 12, bonus: 1 }
};
var POS_NAME = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
var SQUAD_SHAPE = { 1: 2, 2: 5, 3: 5, 4: 3 };
var FORMATIONS = [[3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 2, 3], [5, 3, 2], [5, 4, 1]];
var PRIOR_PPS = { 1: 3.2, 2: 3.4, 3: 3.9, 4: 3.8 };
var BINOMIAL_MAX_N = 5000;
var SHRINK_K = 4;
var TS_K = 6;
var HOME_ADV = 1.10;
var AWAY_ADV = 0.90;
var DECAY = [1.00, 0.82, 0.68, 0.56, 0.46];
var BENCH_FACTOR = 0.85;
var LBAR_PRIOR = 1.4;
var BUDGET_TENTHS = 1000;
var MAX_PER_CLUB = 3;
var MAX_INCOMING_PER_CLUB = 2;
var HIT_COST = 4;
var MAX_SWAPS = 3;
var SELL_GAIN_MIN = 4;
var MARGIN_HIGH = 2.0;
var MARGIN_MED = 0.8;
var CONVERGENCE = 0.60;
var EDGE_MAX = 0.25;
var SHARED_MIN = 0.70;
var WC_MIN_STARTS3 = 3;
var WC_MIN_PSTART = 0.75;
var WC_BENCH_WEIGHT = 0.15;
var WC_TRIGGER = 20;
var MC_MIN_GWS_FOR_PWIN = 8;
var MC_MIN_ITERS = 100;
var TOURNAMENT_PROMOTE_AT = 3;
var FT_CAP = 5;
var REFRESH_MAX_TOKENS = 4000;
var REFRESH_PAIRS = {
  sonnet46: { model: "claude-sonnet-4-6", tool: "web_search_20250305" },
  sonnet5: { model: "claude-sonnet-5", tool: "web_search_20260209" },
  opus5: { model: "claude-opus-5", tool: "web_search_20260209" }
};
var TOURNAMENT_MODELS = [
  { key: "season_mean", name: "Season mean" },
  { key: "last_gw", name: "Last GW" },
  { key: "per90", name: "Per 90" },
  { key: "shrunk_per90", name: "Shrunk per 90" },
  { key: "ict_rate", name: "ICT rate" },
  { key: "bps_rate", name: "BPS rate" },
  { key: "blend", name: "Blend" },
  { key: "component_xp", name: "Component xP" }
];

// ---------------------------------------------------------------- helpers

function num(x, d) {
  var v = typeof x === "number" ? x : (typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
  return isFinite(v) ? v : (d === undefined ? 0 : d);
}
function intOf(x, d) { var v = num(x, NaN); return isFinite(v) ? Math.trunc(v) : (d === undefined ? 0 : d); }
// A clamp that can return NaN is not a clamp: non-finite bounds fall back to 0 and the pair is
// ordered, so the answer is always inside a real range.
function clamp(v, lo, hi) {
  lo = num(lo, 0); hi = num(hi, 0);
  if (hi < lo) { var t = lo; lo = hi; hi = t; }
  v = num(v, lo);
  return v < lo ? lo : (v > hi ? hi : v);
}
function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
// A name for a value that is safe to put in a message: never the literal "undefined", which
// a returned string is not allowed to contain (it reads as a bug even when it is the truth).
function kindOf(x) { return x === null ? "null" : (x === undefined ? "missing" : (Array.isArray(x) ? "array" : typeof x)); }
function arr(x) { return Array.isArray(x) ? x : []; }
function errMsg(e) {
  if (e && e.message) return String(e.message);
  if (typeof e === "string" && e) return e;
  if (e === null || e === undefined) return "unknown error";
  if (typeof e === "number") return isFinite(e) ? "error " + e : "unknown error";
  var s;
  try { s = String(e); } catch (x) { s = ""; }
  if (s && s.indexOf("[object ") < 0) return s;
  try { var j = JSON.stringify(e); if (j && j !== "{}" && j.indexOf("[object ") < 0) return j.slice(0, 240); } catch (x2) { /* circular */ }
  return "unknown error";
}
function okCtx(ctx) { return isObj(ctx) && ctx.ok === true && isObj(ctx.els); }
function idOf(x) { if (isObj(x)) { return num(x.id !== undefined ? x.id : x.element, NaN); } return num(x, NaN); }
function idList(ids) { var out = []; arr(ids).forEach(function (x) { var v = idOf(x); if (isFinite(v)) out.push(v); }); return out; }
function elMap(els) {
  if (Array.isArray(els)) { var m = {}; els.forEach(function (e) { if (isObj(e) && e.id !== undefined) m[e.id] = e; }); return m; }
  return isObj(els) ? els : {};
}
function elType(el) { var t = intOf(el && el.element_type, 0); return t >= 1 && t <= 4 ? t : 0; }
function uniq(list) { var seen = {}, out = []; arr(list).forEach(function (v) { if (!seen[v]) { seen[v] = true; out.push(v); } }); return out; }
function sum(list, f) { var s = 0; var g = typeof f === "function" ? f : null; arr(list).forEach(function (v, i) { s += num(g ? g(v, i) : v, 0); }); return s; }
function sortNum(a, b) { return a - b; }
function quantile(sorted, q) {
  // E-055 (recurrence of E-031): the two endpoints used to be read straight off the array, so a
  // list of anything but numbers came back as a STRING — "[object Object]NaN" — from the helper
  // that produces mcSquad's q10/q50/q90, which are rendered.
  sorted = arr(sorted); q = clamp(q, 0, 1);
  if (!sorted.length) return 0;
  var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  var a = num(sorted[lo], 0), b = num(sorted[hi], 0);
  return a + (b - a) * (pos - lo);
}
function nowMs(now) {
  if (now === undefined || now === null) return 0;
  if (typeof now === "number") return isFinite(now) ? now : 0;
  if (now instanceof Date) { var t = now.getTime(); return isFinite(t) ? t : 0; }
  if (typeof now === "string") { var p = Date.parse(now); return isFinite(p) ? p : 0; }
  return 0;
}
function combos(list, k) {
  list = arr(list); k = intOf(k, -1);
  var out = [];
  function rec(start, cur) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (var i = start; i < list.length; i++) { cur.push(list[i]); rec(i + 1, cur); cur.pop(); }
  }
  if (k >= 0 && k <= list.length) rec(0, []);
  return out;
}

// ---------------------------------------------------------------- scoring (B1)

function rowStat(row, idx, key, alt) {
  if (Array.isArray(row)) return num(row[idx], 0);
  if (!isObj(row)) return 0;
  if (row[key] !== undefined) return num(row[key], 0);
  if (alt && row[alt] !== undefined) return num(row[alt], 0);
  return 0;
}
function pointsFor(statsRow, elementType, scoring) {
  var t = intOf(elementType, 0);
  var S = (isObj(scoring) && isObj(scoring[t])) ? scoring[t] : SCORING[t];
  if (!S) return 0;
  var mins = rowStat(statsRow, 0, "minutes", "min");
  if (mins <= 0) return 0;
  var goals = rowStat(statsRow, 9, "goals", "goals_scored");
  var assists = rowStat(statsRow, 10, "assists");
  var cs = rowStat(statsRow, 11, "cs", "clean_sheets");
  var gc = rowStat(statsRow, 12, "gc", "goals_conceded");
  var bonus = rowStat(statsRow, 13, "bonus");
  var yc = rowStat(statsRow, 14, "yc", "yellow_cards");
  var rc = rowStat(statsRow, 15, "rc", "red_cards");
  var og = rowStat(statsRow, 16, "og", "own_goals");
  var penMiss = rowStat(statsRow, 17, "pen_miss", "penalties_missed");
  var penSave = rowStat(statsRow, 18, "pen_save", "penalties_saved");
  var saves = rowStat(statsRow, 19, "saves");
  var dc = rowStat(statsRow, 6, "dc", "defensive_contribution");
  var p = mins >= 60 ? S.play_long : S.play_short;
  p += goals * S.goal + assists * S.assist;
  if (mins >= 60 && cs > 0 && S.cs) p += S.cs;                      // FWD: S.cs = 0, never a clean sheet
  if (S.gc_per2) p += Math.floor(gc / 2) * S.gc_per2;                // GKP/DEF only
  if (S.saves_per3) p += Math.floor(saves / 3) * S.saves_per3;       // GKP only
  if (t === 1) p += penSave * S.pen_save;
  p += penMiss * S.pen_miss + yc * S.yc + rc * S.rc + og * S.og;
  if (S.dc && S.dc_threshold && dc >= S.dc_threshold) p += S.dc;     // GKP: S.dc = 0, never DefCon
  p += bonus * (S.bonus === undefined ? 1 : S.bonus);
  return Math.round(p);
}
function draftScoring(live) {
  var out = {};
  var sc = live && live.draft && isObj(live.draft.scoring) ? live.draft.scoring : null;
  [1, 2, 3, 4].forEach(function (t) {
    var base = SCORING[t], pos = POS_NAME[t], o = {};
    Object.keys(base).forEach(function (k) { o[k] = base[k]; });
    if (sc) {
      o.play_short = num(sc.short_play, base.play_short);
      o.play_long = num(sc.long_play, base.play_long);
      o.goal = num(sc["goals_scored_" + pos], base.goal);
      o.assist = num(sc.assists, base.assist);
      o.cs = num(sc["clean_sheets_" + pos], base.cs);
      o.gc_per2 = num(sc["goals_conceded_" + pos], base.gc_per2);
      o.saves_per3 = t === 1 ? num(sc.saves, base.saves_per3) : 0;
      o.pen_save = t === 1 ? num(sc.penalties_saved, base.pen_save) : 0;
      o.pen_miss = num(sc.penalties_missed, base.pen_miss);
      o.yc = num(sc.yellow_cards, base.yc);
      o.rc = num(sc.red_cards, base.rc);
      o.og = num(sc.own_goals, base.og);
      o.dc = num(sc["defensive_contribution_" + pos], base.dc);
      var thr = num(sc["defensive_contribution_limit_" + pos], 0);
      o.dc_threshold = thr > 0 ? thr : null;
      o.bonus = num(sc.bonus, 1);
    }
    out[t] = o;
  });
  return out;
}
function gwPoints(picks, gwData) {
  var list = arr(isObj(picks) && Array.isArray(picks.picks) ? picks.picks : picks);
  var els = isObj(gwData) && isObj(gwData.elements) ? gwData.elements : (isObj(gwData) ? gwData : {});
  var total = 0;
  list.forEach(function (p) {
    if (!isObj(p)) return;
    var m = num(p.multiplier, 1); if (m <= 0) return;
    var row = els[p.element]; if (!Array.isArray(row)) return;
    total += num(row[2], 0) * m;
  });
  return total;
}

// ---------------------------------------------------------------- constraints (B3)

function clubCounts(ids, els) {
  var E = elMap(els), out = {};
  idList(ids).forEach(function (id) { var el = E[id]; if (!el) return; var t = num(el.team, 0); out[t] = (out[t] || 0) + 1; });
  return out;
}
function posCounts(ids, E) {
  var c = { 1: 0, 2: 0, 3: 0, 4: 0, unknown: 0 };
  E = elMap(E);
  arr(ids).forEach(function (id) { var el = E[id]; var t = el ? elType(el) : 0; if (t) c[t]++; else c.unknown++; });
  return c;
}
function legal15(ids, els, budget) {
  var res = { ok: false, reasons: [], cost: 0, counts: {}, clubs: {} };
  try {
    var E = elMap(els);
    var raw = arr(ids), list = idList(raw);
    var cap = num(budget, BUDGET_TENTHS);
    if (!Array.isArray(ids)) { res.reasons.push("squad is not a list"); return res; }
    if (list.length !== raw.length) res.reasons.push("squad contains a non-numeric id");
    if (list.length !== 15) res.reasons.push("squad has " + list.length + " players, needs 15");
    if (uniq(list).length !== list.length) res.reasons.push("duplicate player id");
    var missing = list.filter(function (id) { return !E[id]; });
    if (missing.length) res.reasons.push("unknown ids: " + missing.join(","));
    var c = posCounts(list, E); res.counts = c;
    if (c[1] !== 2 || c[2] !== 5 || c[3] !== 5 || c[4] !== 3) res.reasons.push("shape " + c[1] + "-" + c[2] + "-" + c[3] + "-" + c[4] + ", needs 2-5-5-3");
    var cost = 0;
    raw.forEach(function (x) {
      var id = idOf(x); var el = E[id]; if (!el) return;
      cost += (isObj(x) && x.purchase !== undefined) ? num(x.purchase, num(el.now_cost, 0)) : num(el.now_cost, 0);
    });
    res.cost = cost;
    if (cost > cap) res.reasons.push("cost " + (cost / 10).toFixed(1) + "m exceeds " + (cap / 10).toFixed(1) + "m");
    var clubs = clubCounts(list, E); res.clubs = clubs;
    Object.keys(clubs).forEach(function (t) { if (clubs[t] > MAX_PER_CLUB) res.reasons.push(clubs[t] + " players from club " + t + " (max " + MAX_PER_CLUB + ")"); });
    res.ok = res.reasons.length === 0;
  } catch (e) { res.ok = false; res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function legalXI(ids, els) {
  var res = { ok: false, reasons: [], formation: "" };
  try {
    var E = elMap(els);
    if (!Array.isArray(ids)) { res.reasons.push("XI is not a list"); return res; }
    var list = idList(ids);
    if (list.length !== ids.length) res.reasons.push("XI contains a non-numeric id");
    if (list.length !== 11) res.reasons.push("XI has " + list.length + " players, needs 11");
    if (uniq(list).length !== list.length) res.reasons.push("duplicate player id");
    var missing = list.filter(function (id) { return !E[id]; });
    if (missing.length) res.reasons.push("unknown ids: " + missing.join(","));
    var c = posCounts(list, E);
    if (c[1] !== 1) res.reasons.push(c[1] + " goalkeepers, needs exactly 1");
    if (c[2] < 3) res.reasons.push(c[2] + " defenders, needs at least 3");
    if (c[3] < 2) res.reasons.push(c[3] + " midfielders, needs at least 2");
    if (c[4] < 1) res.reasons.push(c[4] + " forwards, needs at least 1");
    if (c[2] > 5 || c[3] > 5 || c[4] > 3) res.reasons.push("too many in one position");
    res.formation = c[2] + "-" + c[3] + "-" + c[4];
    res.ok = res.reasons.length === 0;
  } catch (e) { res.ok = false; res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function formationOf(ids, els) {
  var E = elMap(els), list = idList(ids);
  if (list.length !== 11) return "";
  var c = posCounts(list, E);
  if (c.unknown > 0 || c[1] !== 1) return "";
  return c[2] + "-" + c[3] + "-" + c[4];
}

// ---------------------------------------------------------------- xP (E1)

function shrunkPps(el) {
  if (!isObj(el)) return 0;
  var t = elType(el); var prior = PRIOR_PPS[t] || 3.5;
  var starts = Math.max(0, num(el.starts, 0)), pts = num(el.total_points, 0);
  var w = starts / (starts + SHRINK_K);
  var pps = starts > 0 ? pts / starts : 0;
  return w * pps + (1 - w) * prior;
}
function flagInfo(el) {
  var out = { flagged: false, status: "a", chance: null, news: "", factor: 1 };
  if (!isObj(el)) return out;
  var status = typeof el.status === "string" ? el.status : "a";
  var chance = (el.chance === null || el.chance === undefined) ? (el.chance_of_playing_next_round === undefined ? null : el.chance_of_playing_next_round) : el.chance;
  chance = chance === null || chance === undefined ? null : clamp(chance, 0, 100);
  out.status = status; out.chance = chance; out.news = typeof el.news === "string" ? el.news : "";
  out.flagged = status !== "a" || (chance !== null && chance < 100);
  if (!out.flagged) out.factor = 1;
  else if (chance !== null) out.factor = chance / 100;
  else out.factor = status === "d" ? 0.75 : 0;         // 'd' with no percentage: FPL's default doubt is 75%; i/s/u/n: 0
  return out;
}
function isFlagged(el) { return flagInfo(el).flagged; }
function statsFor(el, gwStats) {
  if (!isObj(el)) return null;
  if (isObj(gwStats) && typeof gwStats.games === "number") return gwStats;
  if (isObj(gwStats) && isObj(gwStats[el.id])) return gwStats[el.id];
  return null;
}
function pStart(el, gwStats) {
  if (!isObj(el)) return 0;
  var gs = statsFor(el, gwStats);
  var starts, n, benched;
  if (gs) { starts = num(gs.starts, 0); n = num(gs.games, 0); benched = !!gs.everBenched; }
  else { starts = Math.max(0, num(el.starts, 0)); n = starts; benched = false; }
  if (n < starts) n = starts;
  var p = (starts + 0.5) / (n + 1);
  if (benched) p *= BENCH_FACTOR;
  p *= flagInfo(el).factor;
  return clamp(p, 0, 1);
}
function fxMultInfo(fixture, teamId, TS) {
  // E-043: fxMult takes a FIXTURE OBJECT (H2 names this trap). Handed a fixture id it has nothing
  // to look up, returns the neutral 1, and every xp1/xp5 quietly falls back to the shrunk
  // baseline with no sign that anything went wrong. fxMult keeps the neutral answer — teamMults
  // sums over real fixtures and relies on it — and this companion says whether that 1 was
  // computed from a fixture or is the unresolved default. Callers and suites read `resolved`.
  var res = { mult: 1, resolved: false, reason: "" };
  if (!isObj(fixture)) { res.reason = "not a fixture object (" + kindOf(fixture) + "): fxMult needs the fixture itself, not its id"; return res; }
  var t = num(teamId, NaN);
  if (!isFinite(t)) { res.reason = "team id is not a number (" + kindOf(teamId) + ")"; return res; }
  var h = num(fixture.team_h, NaN), a = num(fixture.team_a, NaN);
  if (t === h) { res.mult = tsMult(t, a, true, TS); res.resolved = true; res.reason = "home"; return res; }
  if (t === a) { res.mult = tsMult(t, h, false, TS); res.resolved = true; res.reason = "away"; return res; }
  res.reason = "team " + t + " is not in this fixture";
  return res;
}
function fxMult(fixture, teamId, TS) { return fxMultInfo(fixture, teamId, TS).mult; }
function teamMults(teamId, ctx, tsKey) {
  var out = [0, 0, 0, 0, 0];
  if (!okCtx(ctx)) return out;
  var key = tsKey === "TS_GOALS" ? "TS_GOALS" : "TS";
  var cache = ctx.mults && ctx.mults[key] && ctx.mults[key][teamId];
  if (cache) return cache.slice();
  var TS = ctx[key] || {};
  for (var k = 0; k < 5; k++) {
    var ev = ctx.nextEvent + k;
    var fx = arr(ctx.fixturesByEvent[ev]);
    var m = 0;
    fx.forEach(function (f) { if (num(f.team_h, -1) === teamId || num(f.team_a, -1) === teamId) m += fxMult(f, teamId, TS); });
    out[k] = m;
  }
  return out;
}
function xp5FromMults(el, pstart, mults) {
  var s = shrunkPps(el), p = clamp(pstart, 0, 1), acc = 0;
  for (var k = 0; k < 5; k++) acc += DECAY[k] * num(arr(mults)[k], 0);
  return s * p * acc;
}
function xp1With(el, ctx, tsKey) {
  if (!isObj(el) || !okCtx(ctx)) return 0;
  var key = tsKey === "TS_GOALS" ? "TS_GOALS" : "TS";
  var c = ctx.xp && ctx.xp[el.id];
  if (c && c.el === el) return key === "TS" ? c.xp1 : c.xp1g;
  var m = teamMults(num(el.team, -1), ctx, key);
  return shrunkPps(el) * m[0] * pStart(el, ctx.gwStats);
}
function xp5With(el, ctx, tsKey) {
  if (!isObj(el) || !okCtx(ctx)) return 0;
  var key = tsKey === "TS_GOALS" ? "TS_GOALS" : "TS";
  var c = ctx.xp && ctx.xp[el.id];
  if (c && c.el === el) return key === "TS" ? c.xp5 : c.xp5g;
  return xp5FromMults(el, pStart(el, ctx.gwStats), teamMults(num(el.team, -1), ctx, key));
}
function xp1(el, ctx) { return xp1With(el, ctx, "TS"); }
function xp5(el, ctx) { return xp5With(el, ctx, "TS"); }

// ---------------------------------------------------------------- strength (E2)

function teamStrength(live) {
  var out = { TS: {}, TS_GOALS: {}, Lbar: LBAR_PRIOR, LbarGoals: LBAR_PRIOR };
  try {
    if (!isObj(live)) return out;
    var teams = arr(live.teams), fixtures = arr(live.fixtures);
    var fxById = {}; fixtures.forEach(function (f) { if (isObj(f) && f.id !== undefined) fxById[f.id] = f; });
    var acc = {};
    teams.forEach(function (t) { if (isObj(t) && t.id !== undefined) acc[t.id] = { g: 0, xgf: 0, xga: 0, gg: 0, gf: 0, ga: 0 }; });
    var gw = isObj(live.gw) ? live.gw : {};
    Object.keys(gw).forEach(function (k) {
      var fxg = isObj(gw[k]) && isObj(gw[k].fixture_xg) ? gw[k].fixture_xg : null; if (!fxg) return;
      Object.keys(fxg).forEach(function (fid) {
        var f = fxById[fid], v = fxg[fid]; if (!f || !isObj(v)) return;
        var h = num(v.h, 0), a = num(v.a, 0);
        if (acc[f.team_h]) { acc[f.team_h].g++; acc[f.team_h].xgf += h; acc[f.team_h].xga += a; }
        if (acc[f.team_a]) { acc[f.team_a].g++; acc[f.team_a].xgf += a; acc[f.team_a].xga += h; }
      });
    });
    fixtures.forEach(function (f) {
      if (!isObj(f) || !f.finished) return;
      var hs = num(f.team_h_score, NaN), as = num(f.team_a_score, NaN);
      if (!isFinite(hs) || !isFinite(as)) return;
      if (acc[f.team_h]) { acc[f.team_h].gg++; acc[f.team_h].gf += hs; acc[f.team_h].ga += as; }
      if (acc[f.team_a]) { acc[f.team_a].gg++; acc[f.team_a].gf += as; acc[f.team_a].ga += hs; }
    });
    var sx = 0, sg = 0, sgo = 0, sgg = 0;
    Object.keys(acc).forEach(function (t) { sx += acc[t].xgf; sg += acc[t].g; sgo += acc[t].gf; sgg += acc[t].gg; });
    var Lbar = sg > 0 && sx > 0 ? sx / sg : LBAR_PRIOR;
    var LbarG = sgg > 0 && sgo > 0 ? sgo / sgg : LBAR_PRIOR;
    out.Lbar = Lbar; out.LbarGoals = LbarG;
    Object.keys(acc).forEach(function (t) {
      var a = acc[t];
      var w = a.g / (a.g + TS_K);
      out.TS[t] = { att: w * ((a.g ? a.xgf / a.g : 0) / Lbar) + (1 - w), def: w * ((a.g ? a.xga / a.g : 0) / Lbar) + (1 - w), g: a.g, xgf: a.xgf, xga: a.xga, Lbar: Lbar };
      var wg = a.gg / (a.gg + TS_K);
      out.TS_GOALS[t] = { att: wg * ((a.gg ? a.gf / a.gg : 0) / LbarG) + (1 - wg), def: wg * ((a.gg ? a.ga / a.gg : 0) / LbarG) + (1 - wg), g: a.gg, xgf: a.gf, xga: a.ga, gf: a.gf, ga: a.ga, Lbar: LbarG };
    });
  } catch (e) { out.error = errMsg(e); }
  return out;
}
function tsEntry(TS, t) {
  var e = isObj(TS) ? TS[t] : null;
  if (!isObj(e)) return { att: 1, def: 1, Lbar: LBAR_PRIOR };
  return { att: clamp(num(e.att, 1), 0.05, 5), def: clamp(num(e.def, 1), 0.05, 5), Lbar: clamp(num(e.Lbar, LBAR_PRIOR), 0.2, 5) };
}
function tsXg(t, o, home, TS) {
  var a = tsEntry(TS, t), d = tsEntry(TS, o);
  return a.Lbar * a.att * d.def * (home ? HOME_ADV : AWAY_ADV);
}
function tsMult(t, o, home, TS) {
  var a = tsEntry(TS, t), d = tsEntry(TS, o);
  return a.att * d.def * (home ? HOME_ADV : AWAY_ADV);
}
function tsPcs(t, o, home, TS) {
  var lam = tsXg(o, t, !home, TS);
  return clamp(Math.exp(-lam), 1e-6, 1 - 1e-6);
}
function overUnderTags(live) {
  var out = [];
  try {
    var st = teamStrength(live);
    arr(live && live.teams).forEach(function (t) {
      if (!isObj(t)) return;
      var x = st.TS[t.id] || { g: 0, xgf: 0, xga: 0 }, g = st.TS_GOALS[t.id] || { g: 0, gf: 0, ga: 0 };
      var n = Math.max(x.g, g.g);
      var row = { teamId: t.id, short_name: t.short_name, g: n, gf: g.gf, xgf: x.xgf, ga: g.ga, xga: x.xga, tagFor: null, tagAgainst: null, diffFor: 0, diffAgainst: 0 };
      if (n > 0) {
        row.diffFor = (g.gf - x.xgf) / n; row.diffAgainst = (g.ga - x.xga) / n;
        if (row.diffFor >= 0.5) row.tagFor = "OVER"; else if (row.diffFor <= -0.5) row.tagFor = "UNDER";
        if (row.diffAgainst >= 0.5) row.tagAgainst = "OVER"; else if (row.diffAgainst <= -0.5) row.tagAgainst = "UNDER";
      }
      out.push(row);
    });
  } catch (e) { /* total */ }
  return out;
}
function runAvg(teamId, fixtures, n) {
  try {
    var t = num(teamId, NaN); if (!isFinite(t)) return 3;
    var k = Math.max(1, intOf(n, 5));
    var list = arr(fixtures).filter(function (f) { return isObj(f) && !f.finished && f.event !== null && f.event !== undefined && (num(f.team_h, -1) === t || num(f.team_a, -1) === t); });
    list.sort(function (a, b) { return num(a.event, 99) - num(b.event, 99) || String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")); });
    list = list.slice(0, k);
    if (!list.length) return 3;
    var s = 0; list.forEach(function (f) { s += clamp(num(f.team_h, -1) === t ? f.team_h_difficulty : f.team_a_difficulty, 1, 5); });
    return clamp(s / list.length, 1, 5);
  } catch (e) { return 3; }
}

// ---------------------------------------------------------------- per-element GW stats

function elementGwStats(live) {
  var out = {};
  try {
    if (!isObj(live)) return out;
    var fixtures = arr(live.fixtures);
    var gw = isObj(live.gw) ? live.gw : {};
    var gwKeys = Object.keys(gw).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum);
    var teamGames = {};                                 // teamId -> [{gw, n}]
    gwKeys.forEach(function (g) {
      fixtures.forEach(function (f) {
        if (!isObj(f) || num(f.event, -1) !== g) return;
        [f.team_h, f.team_a].forEach(function (t) { teamGames[t] = teamGames[t] || {}; teamGames[t][g] = (teamGames[t][g] || 0) + 1; });
      });
    });
    var dcThr = { 1: null, 2: 10, 3: 12, 4: 12 };
    arr(live.elements).forEach(function (el) {
      if (!isObj(el) || el.id === undefined) return;
      var t = el.team, type = elType(el);
      var s = { games: 0, starts: 0, played: 0, minutes: 0, everBenched: false, starts_last3: 0, startedLast: false, konsa: false, last3: [], history: [], dcHits: 0, dcRate: 0, bonusSum: 0, bonusRate: 0, ptsSum: 0, ptsPerGame: 0, bpsSum: 0, ictSum: 0, xgSum: 0, xaSum: 0, xgcSum: 0 };
      var seq = [];
      gwKeys.forEach(function (g) {
        var clubN = teamGames[t] && teamGames[t][g] ? teamGames[t][g] : 0;
        var row = isObj(gw[g]) && isObj(gw[g].elements) ? gw[g].elements[el.id] : null;
        var min = Array.isArray(row) ? num(row[0], 0) : 0, st = Array.isArray(row) ? num(row[1], 0) : 0, pts = Array.isArray(row) ? num(row[2], 0) : 0;
        if (clubN === 0 && !row) return;               // blank for the club and no data: not a game
        var n = Math.max(clubN, st > 0 ? st : 0, row ? 1 : 0);
        s.games += n; s.starts += st; s.minutes += min;
        if (min > 0) s.played++;
        if (st < n) s.everBenched = true;
        var h = { gw: g, games: n, min: min, starts: st, pts: pts };
        if (Array.isArray(row)) {
          h.xg = num(row[3], 0); h.xa = num(row[4], 0); h.xgc = num(row[5], 0); h.dc = num(row[6], 0); h.bps = num(row[7], 0); h.ict = num(row[8], 0); h.bonus = num(row[13], 0);
          s.ptsSum += pts; s.bpsSum += h.bps; s.ictSum += h.ict; s.xgSum += h.xg; s.xaSum += h.xa; s.xgcSum += h.xgc; s.bonusSum += h.bonus;
          if (dcThr[type] && h.dc >= dcThr[type]) s.dcHits++;
        }
        seq.push(h); s.history.push(h);
      });
      s.last3 = seq.slice(-3);
      s.starts_last3 = sum(s.last3, function (h) { return h.starts; });
      s.startedLast = seq.length > 0 && seq[seq.length - 1].starts > 0;
      s.konsa = s.startedLast && seq.length > 1 && seq[seq.length - 2].starts === 0;
      s.dcRate = s.played ? s.dcHits / s.played : 0;
      s.bonusRate = s.played ? s.bonusSum / s.played : 0;
      s.ptsPerGame = s.played ? s.ptsSum / s.played : 0;
      out[el.id] = s;
    });
  } catch (e) { /* total */ }
  return out;
}

// ---------------------------------------------------------------- rivals (E3)

function rivalPickShares(live, predicate) {
  var out = {};
  try {
    if (!isObj(live)) return out;
    var me = live.entry && live.entry.id !== undefined ? num(live.entry.id, NaN) : NaN;
    var rivals = isObj(live.rivals) ? live.rivals : {};
    arr(live.leagues).forEach(function (L) {
      if (!isObj(L) || L.id === undefined) return;
      var ids = arr(L.standings).map(function (r) { return isObj(r) ? num(r.entry, NaN) : NaN; })
        .filter(function (e) { return isFinite(e) && e !== me && isObj(rivals[e]) && Array.isArray(rivals[e].picks); });
      ids = uniq(ids);
      var counts = {};
      ids.forEach(function (e) { arr(rivals[e].picks).forEach(function (p) { if (isObj(p) && p.element !== undefined && predicate(p)) counts[p.element] = (counts[p.element] || 0) + 1; }); });
      var share = {}; Object.keys(counts).forEach(function (k) { share[k] = ids.length ? counts[k] / ids.length : 0; });
      out[L.id] = share;
    });
  } catch (e) { /* total */ }
  return out;
}
function rivalOwn(live) { return rivalPickShares(live, function () { return true; }); }
function capShare(live) { return rivalPickShares(live, function (p) { return p.is_captain === true || num(p.multiplier, 1) >= 2; }); }
function rivalOwnMax(elementId, ctx) {
  var best = { max: 0, league: null };
  if (!okCtx(ctx) || !isObj(ctx.rivalOwn)) return best;
  Object.keys(ctx.rivalOwn).forEach(function (L) { var v = num(ctx.rivalOwn[L][elementId], 0); if (v > best.max) { best.max = v; best.league = num(L, L); } });
  return best;
}
function convergenceRisk(elementId, ctx) {
  var m = rivalOwnMax(elementId, ctx);
  return { risk: m.max >= CONVERGENCE, max: m.max, league: m.league };
}
function classify(el, ctx) {
  if (!isObj(el) || !okCtx(ctx)) return "NEUTRAL";
  var gs = ctx.gwStats[el.id] || { starts_last3: 0, startedLast: false };
  if (num(gs.starts_last3, 0) === 0) return "DEAD";
  var m = rivalOwnMax(el.id, ctx).max;
  if (m >= SHARED_MIN) return "SHARED";
  if (m < EDGE_MAX && gs.startedLast) return "EDGE";
  return "NEUTRAL";
}

// ---------------------------------------------------------------- phase and context

function gamePhase(live, now) {
  try {
    var t = nowMs(now); if (!t || !isObj(live)) return "pre";
    var events = arr(live.events).filter(function (e) { return isObj(e) && isFinite(Date.parse(e.deadline_time)); });
    var past = events.filter(function (e) { return Date.parse(e.deadline_time) <= t; });
    if (!past.length) return "pre";
    var last = past[past.length - 1];
    var dl = Date.parse(last.deadline_time);
    var open = arr(live.fixtures).some(function (f) {
      if (!isObj(f) || num(f.event, -1) !== num(last.id, -2) || f.finished) return false;
      var ko = Date.parse(f.kickoff_time); return isFinite(ko) && ko - dl < 6 * 86400000;
    });
    if (open) return "live";
    var future = events.filter(function (e) { return Date.parse(e.deadline_time) > t; });
    return future.length ? "pre" : "post";
  } catch (e) { return "pre"; }
}
function buildCtx(live, state, now) {
  var ctx = { ok: false, live: null, state: null, now: 0, nowISO: "", els: {}, elList: [], byCode: {}, teams: {}, teamList: [], events: [], nextEvent: 0, currentEvent: 0, deadline: null, hoursToDeadline: null, phase: "pre", fixtures: [], fixturesByEvent: {}, finishedGws: [], TS: {}, TS_GOALS: {}, Lbar: LBAR_PRIOR, gwStats: {}, rivalOwn: {}, capShare: {}, flags: {}, mults: { TS: {}, TS_GOALS: {} }, xp: {}, squadIds: [], squad: [], purchase: {}, picks: [], ft: 1, bank: 0, value: 0, budget: BUDGET_TENTHS, block: { changed: false, added: [], removed: [], block: false }, baseRates: { yc: 0.13, rc: 0.005, og: 0.004 }, draft: { els: {}, byCode: {}, scoring: null, waiversTime: null, deadline: null }, leagues: [], error: null };
  try {
    if (!isObj(live) || !Array.isArray(live.elements)) { ctx.error = "live snapshot missing or malformed"; return ctx; }
    ctx.live = live;
    var t = nowMs(now) || nowMs(live.fetched_at) || 0;
    ctx.now = t; ctx.nowISO = t ? new Date(t).toISOString() : "";
    live.elements.forEach(function (el) { if (isObj(el) && el.id !== undefined) { ctx.els[el.id] = el; ctx.elList.push(el); if (el.code !== undefined) ctx.byCode[el.code] = el; } });
    arr(live.teams).forEach(function (tm) { if (isObj(tm) && tm.id !== undefined) { ctx.teams[tm.id] = tm; ctx.teamList.push(tm); } });
    ctx.events = arr(live.events).filter(isObj);
    var nextEv = intOf(live.next_event, 0);
    if (!nextEv) { var n1 = ctx.events.filter(function (e) { return e.is_next; })[0]; nextEv = n1 ? intOf(n1.id, 0) : 0; }
    var curEv = intOf(live.current_event, 0);
    if (!curEv) { var c1 = ctx.events.filter(function (e) { return e.is_current; })[0]; curEv = c1 ? intOf(c1.id, 0) : Math.max(0, nextEv - 1); }
    if (!nextEv) nextEv = curEv + 1;
    ctx.nextEvent = nextEv; ctx.currentEvent = curEv;
    var nextObj = ctx.events.filter(function (e) { return intOf(e.id, -1) === nextEv; })[0];
    ctx.deadline = nextObj && nextObj.deadline_time ? String(nextObj.deadline_time) : null;
    var dl = ctx.deadline ? Date.parse(ctx.deadline) : NaN;
    ctx.hoursToDeadline = isFinite(dl) && t ? (dl - t) / 3600000 : null;
    ctx.phase = gamePhase(live, t);
    ctx.fixtures = arr(live.fixtures).filter(isObj);
    ctx.fixtures.forEach(function (f) { var ev = intOf(f.event, -1); if (ev < 0) return; (ctx.fixturesByEvent[ev] = ctx.fixturesByEvent[ev] || []).push(f); });
    ctx.finishedGws = Object.keys(isObj(live.gw) ? live.gw : {}).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum);
    var st = teamStrength(live);
    ctx.TS = st.TS; ctx.TS_GOALS = st.TS_GOALS; ctx.Lbar = st.Lbar; ctx.LbarGoals = st.LbarGoals;
    ctx.gwStats = elementGwStats(live);
    ctx.rivalOwn = rivalOwn(live); ctx.capShare = capShare(live);
    ctx.leagues = arr(live.leagues).filter(isObj);
    ctx.ok = true;
    ctx.teamList.forEach(function (tm) { ctx.mults.TS[tm.id] = teamMults(tm.id, ctx, "TS"); ctx.mults.TS_GOALS[tm.id] = teamMults(tm.id, ctx, "TS_GOALS"); });
    var mins = 0, yc = 0, rc = 0, og = 0;
    ctx.elList.forEach(function (el) {
      ctx.flags[el.id] = flagInfo(el);
      mins += num(el.minutes, 0); yc += num(el.yc, 0); rc += num(el.rc, 0); og += num(el.og, 0);
      var s = shrunkPps(el), p = pStart(el, ctx.gwStats);
      var m = ctx.mults.TS[el.team] || [0, 0, 0, 0, 0], mg = ctx.mults.TS_GOALS[el.team] || [0, 0, 0, 0, 0];
      ctx.xp[el.id] = { el: el, shrunk: s, pstart: p, xp1: s * m[0] * p, xp5: xp5FromMults(el, p, m), xp1g: s * mg[0] * p, xp5g: xp5FromMults(el, p, mg) };
    });
    if (mins > 0) ctx.baseRates = { yc: yc / mins * 90, rc: rc / mins * 90, og: og / mins * 90 };
    var sstate = sanitiseState(state);
    ctx.state = sstate;
    ctx.squad = sstate.squad.filter(function (s) { return ctx.els[s.id]; });
    ctx.squadIds = ctx.squad.map(function (s) { return s.id; });
    ctx.squad.forEach(function (s) { ctx.purchase[s.id] = s.purchase; });
    ctx.ft = live.ft_available !== undefined ? clamp(intOf(live.ft_available, 1), 0, FT_CAP) : (isObj(live.history) ? ftAvailable(live.history, curEv) : clamp(sstate.ft, 0, FT_CAP));
    if (state && isObj(state) && state.ft !== undefined && live.ft_available === undefined) ctx.ft = clamp(sstate.ft, 0, FT_CAP);
    ctx.bank = sstate.bank;
    if (isObj(live.entry) && live.entry.last_deadline_bank !== undefined && (!isObj(state) || state.bank === undefined)) ctx.bank = intOf(live.entry.last_deadline_bank, 0);
    ctx.value = sstate.value || (isObj(live.entry) ? intOf(live.entry.last_deadline_value, 0) : 0);
    var sellSum = 0; ctx.squad.forEach(function (s) { sellSum += sellPrice(num(ctx.els[s.id].now_cost, 0), s.purchase); });
    ctx.budget = ctx.squad.length === 15 ? ctx.bank + sellSum : BUDGET_TENTHS;
    var pk = isObj(live.picks) ? live.picks[curEv] || live.picks[String(curEv)] : null;
    ctx.picks = pk && Array.isArray(pk.picks) ? pk.picks : [];
    ctx.block = ctx.picks.length ? detectSquadChange(ctx.squadIds, ctx.picks) : { changed: false, added: [], removed: [], block: false };
    if (ctx.block.block && sstate.confirmed_gw >= curEv && ctx.squadIds.length === 15) ctx.block = { changed: ctx.block.changed, added: ctx.block.added, removed: ctx.block.removed, block: false, confirmed: true };
    var d = isObj(live.draft) ? live.draft : {};
    arr(d.elements).forEach(function (de) { if (isObj(de) && de.id !== undefined) { ctx.draft.els[de.id] = de; if (de.code !== undefined) ctx.draft.byCode[de.code] = de; } });
    ctx.draft.scoring = draftScoring(live);
    var dEv = arr(d.events).filter(function (e) { return isObj(e) && intOf(e.id, -1) === nextEv; })[0];
    ctx.draft.waiversTime = dEv && dEv.waivers_time ? String(dEv.waivers_time) : null;
    ctx.draft.deadline = dEv && dEv.deadline_time ? String(dEv.deadline_time) : null;
    ctx.draft.leagueId = d.league_id === undefined ? null : d.league_id;
    ctx.draft.captainsDisabled = !(isObj(d.squad) && d.squad.captains_disabled === false);
  } catch (e) { ctx.ok = false; ctx.error = errMsg(e); }
  return ctx;
}

// ---------------------------------------------------------------- XI selection

function tierOf(p) { return p >= 0.75 ? 2 : (p >= 0.5 ? 1 : 0); }
function pickXI(ids, ctx, valueOf) {
  // Generic legal-XI maximiser over the eight formations. valueOf(el) is the per-player score.
  // A P(start) < 0.5 player never starts ahead of a P(start) >= 0.75 player he could be swapped with.
  var res = { ids: [], formation: "", score: 0, bench: [], ok: false };
  if (!okCtx(ctx)) return res;
  var scoreOf = typeof valueOf === "function" ? valueOf : function () { return 0; };
  var list = uniq(idList(ids)).filter(function (id) { return ctx.els[id]; });
  var by = { 1: [], 2: [], 3: [], 4: [] };
  list.forEach(function (id) {
    var el = ctx.els[id], t = elType(el); if (!t) return;
    var p = ctx.xp[id] ? ctx.xp[id].pstart : pStart(el, ctx.gwStats);
    by[t].push({ id: id, v: num(scoreOf(el), 0), p: p, tier: tierOf(p), starts: num(el.starts, 0), min: num(el.minutes, 0) });
  });
  [1, 2, 3, 4].forEach(function (t) { by[t].sort(function (a, b) { return b.tier - a.tier || b.v - a.v || b.starts - a.starts || b.min - a.min; }); });
  if (!by[1].length) return res;
  var best = null;
  FORMATIONS.forEach(function (f) {
    if (by[2].length < f[0] || by[3].length < f[1] || by[4].length < f[2]) return;
    var xi = [by[1][0]].concat(by[2].slice(0, f[0]), by[3].slice(0, f[1]), by[4].slice(0, f[2]));
    var bench = by[1].slice(1).concat(by[2].slice(f[0]), by[3].slice(f[1]), by[4].slice(f[2]));
    var score = sum(xi, function (x) { return x.v; });
    // violation: a tier-0 starter while a tier-2 outfield bench player could legally replace him
    var counts = { 2: f[0], 3: f[1], 4: f[2] };
    var violation = xi.some(function (s) {
      if (s.tier !== 0) return false;
      var st = elType(ctx.els[s.id]);
      return bench.some(function (b) {
        if (b.tier !== 2) return false;
        var bt = elType(ctx.els[b.id]); if (bt === 1 || st === 1) return bt === st;
        if (bt === st) return true;
        var c = { 2: counts[2], 3: counts[3], 4: counts[4] }; c[st]--; c[bt]++;
        return c[2] >= 3 && c[2] <= 5 && c[3] >= 2 && c[3] <= 5 && c[4] >= 1 && c[4] <= 3;
      });
    });
    var cand = { xi: xi, bench: bench, score: score, formation: f[0] + "-" + f[1] + "-" + f[2], violation: violation };
    if (!best || (best.violation && !cand.violation) || (best.violation === cand.violation && cand.score > best.score)) best = cand;
  });
  if (!best) return res;
  res.ids = best.xi.map(function (x) { return x.id; });
  res.bench = best.bench.map(function (x) { return x.id; });
  res.formation = best.formation; res.score = best.score; res.ok = true;
  return res;
}
function captainPick(xiIds, ctx) {
  var res = { capId: null, viceId: null, table: [], reasons: [] };
  try {
    if (!okCtx(ctx)) { res.reasons.push("no context"); return res; }
    var list = uniq(idList(xiIds)).filter(function (id) { return ctx.els[id]; });
    list.forEach(function (id) {
      var el = ctx.els[id], t = elType(el);
      var x = ctx.xp[id] || { xp1: xp1(el, ctx), pstart: pStart(el, ctx.gwStats) };
      var fl = ctx.flags[id] || flagInfo(el);
      var starts = num(el.starts, 0);
      var cs = {}; var csMax = 0;
      Object.keys(ctx.capShare).forEach(function (L) { var v = num(ctx.capShare[L][id], 0); cs[L] = v; if (v > csMax) csMax = v; });
      var row = { id: id, web_name: el.web_name, pos: POS_NAME[t] || "?", xp1: x.xp1, pstart: x.pstart, ev: 2 * x.xp1 * x.pstart, ppsStart: starts ? num(el.total_points, 0) / starts : 0, flagged: fl.flagged, status: fl.status, chance: fl.chance, capShare: cs, capShareMax: csMax, rivalOwnMax: rivalOwnMax(id, ctx).max, eligible: (t === 3 || t === 4) && !fl.flagged && x.pstart >= 0.5, why: "" };
      if (t !== 3 && t !== 4) row.why = "not an attacker";
      else if (fl.flagged) row.why = "flagged (" + fl.status + (fl.chance !== null ? " " + fl.chance + "%" : "") + ")";
      else if (x.pstart < 0.5) row.why = "P(start) below 0.5";
      res.table.push(row);
    });
    res.table.sort(function (a, b) { return (b.eligible - a.eligible) || (b.ev - a.ev) || (b.ppsStart - a.ppsStart) || (b.pstart - a.pstart); });
    var el = res.table.filter(function (r) { return r.eligible; });
    if (el.length) res.capId = el[0].id; else res.reasons.push("no unflagged attacker with P(start) >= 0.5 in the XI");
    if (el.length > 1) res.viceId = el[1].id;
  } catch (e) { res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function bestXI(ids, ctx) {
  var res = { ids: [], capId: null, viceId: null, formation: "", score: 0, bench: [] };
  try {
    if (!okCtx(ctx)) return res;
    var r = pickXI(ids, ctx, function (el) { return ctx.xp[el.id] ? ctx.xp[el.id].xp1 : xp1(el, ctx); });
    if (!r.ok) return res;
    res.ids = r.ids; res.formation = r.formation; res.score = r.score; res.bench = r.bench;
    var c = captainPick(r.ids, ctx); res.capId = c.capId; res.viceId = c.viceId;
  } catch (e) { /* total */ }
  return res;
}
function benchOrder(squadIds, xiIds, ctx) {
  try {
    if (!okCtx(ctx)) return [];
    var xi = uniq(idList(xiIds)).filter(function (id) { return ctx.els[id]; });
    var xiSet = {}; xi.forEach(function (id) { xiSet[id] = true; });
    var bench = uniq(idList(squadIds)).filter(function (id) { return ctx.els[id] && !xiSet[id] && elType(ctx.els[id]) !== 1; });
    var counts = posCounts(xi, ctx.els);
    var starters = xi.filter(function (id) { return elType(ctx.els[id]) !== 1; });
    var scored = bench.map(function (id) {
      var el = ctx.els[id], bt = elType(el), x = ctx.xp[id] || { shrunk: shrunkPps(el), pstart: pStart(el, ctx.gwStats) };
      var m = (ctx.mults.TS[el.team] || [0])[0];
      var eGiven = x.shrunk * m;                                    // E[points | plays]
      var pNone = 1;
      starters.forEach(function (s) {
        var st = elType(ctx.els[s]);
        var c = { 2: counts[2], 3: counts[3], 4: counts[4] }; c[st]--; c[bt]++;
        var legal = c[2] >= 3 && c[2] <= 5 && c[3] >= 2 && c[3] <= 5 && c[4] >= 1 && c[4] <= 3;
        if (!legal) return;
        var ps = ctx.xp[s] ? ctx.xp[s].pstart : pStart(ctx.els[s], ctx.gwStats);
        pNone *= ps;                                                 // P(this starter does not fail)
      });
      var pFail = 1 - pNone;
      return { id: id, key: pFail * eGiven * x.pstart, pFail: pFail, eGiven: eGiven };
    });
    scored.sort(function (a, b) { return b.key - a.key; });
    return scored.map(function (s) { return s.id; });
  } catch (e) { return []; }
}
function sellCandidates(squad, ctx) {
  var out = [];
  try {
    if (!okCtx(ctx)) return out;
    uniq(idList(squad)).forEach(function (id) {
      var el = ctx.els[id]; if (!el) return;
      var gs = ctx.gwStats[id] || { starts_last3: 0, konsa: false };
      var fl = ctx.flags[id] || flagInfo(el);
      var reasons = [];
      if (num(gs.starts_last3, 0) === 0) reasons.push("no starts in the last 3");
      if (fl.status !== "a") reasons.push("status " + fl.status + (fl.chance !== null ? " (" + fl.chance + "%)" : ""));
      if (reasons.length) out.push({ id: id, web_name: el.web_name, reason: reasons.join("; "), forced: true, konsa: !!gs.konsa });
      else if (gs.konsa) out.push({ id: id, web_name: el.web_name, reason: "started the last match after a spell out — protected (Konsa rule)", forced: false, konsa: true });
    });
  } catch (e) { /* total */ }
  return out;
}

// ---------------------------------------------------------------- transfers (C2)

function transferProtocol(state, ctx) {
  var res = { moves: [], order: [], captain: null, vice: null, value: 0, margin: 0, confidence: "hold", hits: 0, k: 0, bankAfter: 0, forced: [], alternatives: [], reasons: [], blocked: false, ft: 0, bank: 0 };
  try {
    if (!okCtx(ctx)) { res.reasons.push("no context"); return res; }
    var st = state === undefined || state === null ? ctx.state : sanitiseState(state);
    var squad = st.squad.map(function (s) { return s.id; }).filter(function (id) { return ctx.els[id]; });
    if (squad.length !== 15) { res.reasons.push("squad is " + squad.length + " known players, not 15"); return res; }
    var purchase = {}; st.squad.forEach(function (s) { purchase[s.id] = s.purchase; });
    var FT = clamp(intOf(st.ft, ctx.ft), 0, FT_CAP); if (state === undefined || state === null) FT = ctx.ft;
    var bank = state === undefined || state === null ? ctx.bank : intOf(st.bank, 0);
    res.ft = FT; res.bank = bank; res.bankAfter = bank;
    var blk = detectSquadChange(squad, ctx.picks);
    if (ctx.picks.length && blk.block && !(st.confirmed_gw >= ctx.currentEvent)) { res.blocked = true; res.reasons.push("live picks differ from the saved squad (added " + blk.added.join(",") + "; removed " + blk.removed.join(",") + ") — confirm the squad before any move"); return res; }
    var sells = sellCandidates(squad, ctx);
    var forced = sells.filter(function (s) { return s.forced; }).map(function (s) { return s.id; });
    var protectedIds = {}; sells.forEach(function (s) { if (s.konsa && !s.forced) protectedIds[s.id] = true; });
    res.forced = sells.filter(function (s) { return s.forced; });
    var inSquad = {}; squad.forEach(function (id) { inSquad[id] = true; });
    var maxK = Math.min(FT + 1, MAX_SWAPS);
    if (forced.length > maxK) res.reasons.push(forced.length + " forced sells but at most " + maxK + " transfers this week; the lowest-xp forced sells go first");
    forced.sort(function (a, b) { return ctx.xp[a].xp5 - ctx.xp[b].xp5; });
    var candByPos = { 1: [], 2: [], 3: [], 4: [] };
    ctx.elList.forEach(function (el) {
      var t = elType(el); if (!t || inSquad[el.id]) return;
      var fl = ctx.flags[el.id]; if (fl.status !== "a" || fl.flagged) return;
      var gs = ctx.gwStats[el.id]; if (!gs || gs.starts_last3 === 0) return;
      var x = ctx.xp[el.id]; if (x.pstart < 0.5) return;
      if (convergenceRisk(el.id, ctx).risk) return;
      candByPos[t].push(el.id);
    });
    [1, 2, 3, 4].forEach(function (t) { candByPos[t].sort(function (a, b) { return ctx.xp[b].xp5 - ctx.xp[a].xp5; }); });
    var perPos = { 1: 40, 2: 12, 3: 8 };
    var plans = [];
    function evalPlan(outs, ins, k) {
      var hits = Math.max(0, k - FT) * HIT_COST;
      var newSquad = squad.filter(function (id) { return outs.indexOf(id) < 0; }).concat(ins);
      var L = legal15(newSquad, ctx.els, 1e9); if (!L.ok) return null;
      var incoming = clubCounts(ins, ctx.els);
      for (var c in incoming) if (incoming[c] > MAX_INCOMING_PER_CLUB) return null;
      var moves = [];
      var outsByPos = {}, insByPos = {};
      outs.forEach(function (id) { var t = elType(ctx.els[id]); (outsByPos[t] = outsByPos[t] || []).push(id); });
      ins.forEach(function (id) { var t = elType(ctx.els[id]); (insByPos[t] = insByPos[t] || []).push(id); });
      var gain = 0;
      for (var t in outsByPos) {
        if (!insByPos[t] || insByPos[t].length !== outsByPos[t].length) return null;
        var o = outsByPos[t].slice().sort(function (a, b) { return ctx.xp[a].xp5 - ctx.xp[b].xp5; });
        var i = insByPos[t].slice().sort(function (a, b) { return ctx.xp[a].xp5 - ctx.xp[b].xp5; });
        for (var j = 0; j < o.length; j++) {
          var g = ctx.xp[i[j]].xp5 - ctx.xp[o[j]].xp5;
          var isForced = forced.indexOf(o[j]) >= 0;
          if (!isForced && g <= SELL_GAIN_MIN) return null;     // C1 rule 1: sell only if no starts in 3 or gain > 4
          gain += g;
          moves.push({ out: o[j], in: i[j], outName: ctx.els[o[j]].web_name, inName: ctx.els[i[j]].web_name, xpOut: ctx.xp[o[j]].xp5, xpIn: ctx.xp[i[j]].xp5, gain: g, forced: isForced, priceOut: sellPrice(num(ctx.els[o[j]].now_cost, 0), purchase[o[j]]), priceIn: num(ctx.els[i[j]].now_cost, 0) });
        }
      }
      var bankAfter = bankAfter_(bank, moves);
      if (bankAfter < 0) return null;
      moves.sort(function (a, b) { return (b.forced - a.forced) || (b.gain - a.gain); });
      return { moves: moves, outs: outs.slice().sort(sortNum), ins: ins.slice().sort(sortNum), k: k, hits: hits, value: gain - hits, bankAfter: bankAfter };
    }
    function bankAfter_(b, moves) { var v = b; moves.forEach(function (m) { v += m.priceOut - m.priceIn; }); return v; }
    for (var k = 1; k <= maxK; k++) {
      var need = forced.slice(0, Math.min(forced.length, k));
      var free = squad.filter(function (id) { return need.indexOf(id) < 0 && forced.indexOf(id) < 0 && !protectedIds[id]; });
      var outSets = combos(free, k - need.length).map(function (c) { return need.concat(c); });
      var lim = perPos[k] || 8;
      outSets.forEach(function (outs) {
        var slots = outs.map(function (id) { return candByPos[elType(ctx.els[id])].slice(0, lim); });
        function rec(i, chosen) {
          if (i === outs.length) { var p = evalPlan(outs, chosen, k); if (p) plans.push(p); return; }
          for (var j = 0; j < slots[i].length; j++) {
            var c = slots[i][j]; if (chosen.indexOf(c) >= 0) continue;
            if (i > 0 && elType(ctx.els[outs[i - 1]]) === elType(ctx.els[outs[i]]) && chosen.length && c < chosen[chosen.length - 1]) continue; // same-position symmetry
            chosen.push(c); rec(i + 1, chosen); chosen.pop();
          }
        }
        rec(0, []);
      });
    }
    plans.sort(function (a, b) { return b.value - a.value || a.k - b.k; });
    // E-037: `order` is built on ONE path. The no-plan branch used to return early with the
    // captain and the vice set but the execution order empty, so a hold week handed the manager
    // an empty list of steps. C2 step 5 wants sells first and the captain and vice steps last on
    // every path that reaches an eleven — hold included.
    var newSquad = squad;
    if (!plans.length) {
      res.confidence = forced.length ? "LOW" : "hold";
      res.reasons.push(forced.length ? "forced sells exist but no legal replacement passed every gate (budget, club cap, convergence, starts)" : "no swap clears the sell rule (gain > 4 xp5 or a forced sell)");
    } else {
      var best = plans[0];
    // E-008: "genuinely different" is the SET of players out and the SET of players in, sorted —
    // the same two swaps paired the other way round is the same plan, and reporting it as the
    // runner-up is what produced "margin 0.00 LOW". The margin and the alternatives panel both
    // use this key, so the panel can never show the shipped plan back to the manager.
      var planKey = function (p) { return p.outs.slice().sort(sortNum).join(",") + ">" + p.ins.slice().sort(sortNum).join(","); };
      var bestKey = planKey(best);
      var different = plans.slice(1).filter(function (p) { return planKey(p) !== bestKey; });
      var alt = different.length ? different[0] : null;
      res.margin = alt ? best.value - alt.value : best.value;
      res.value = best.value; res.hits = best.hits; res.k = best.k; res.bankAfter = best.bankAfter;
      res.alternatives = different.slice(0, 3).map(function (p) { return { value: p.value, k: p.k, hits: p.hits, moves: p.moves.map(function (m) { return { out: m.out, in: m.in, outName: m.outName, inName: m.inName, gain: m.gain }; }) }; });
      var hasForced = best.moves.some(function (m) { return m.forced; });
      if (res.margin >= MARGIN_HIGH) res.confidence = "HIGH";
      else if (res.margin >= MARGIN_MED) res.confidence = "MED";
      else res.confidence = hasForced ? "LOW" : "hold";
      if (res.confidence === "hold" && best.value <= 0) res.reasons.push("best plan does not beat holding");
      var ship = res.confidence !== "hold";
      if (!ship && hasForced) ship = true;
      if (ship) {
        res.moves = best.moves;
        newSquad = squad.filter(function (id) { return best.outs.indexOf(id) < 0; }).concat(best.ins);
        best.moves.forEach(function (m, i) { res.order.push({ step: i + 1, action: "sell", id: m.out, name: m.outName, price: m.priceOut }); });
        best.moves.forEach(function (m, i) { res.order.push({ step: best.moves.length + i + 1, action: "buy", id: m.in, name: m.inName, price: m.priceIn }); });
      } else {
        res.reasons.push("margin " + res.margin.toFixed(2) + " below " + MARGIN_MED + " — hold; best plan kept in alternatives");
        res.alternatives.unshift({ value: best.value, k: best.k, hits: best.hits, moves: best.moves.map(function (m) { return { out: m.out, in: m.in, outName: m.outName, inName: m.inName, gain: m.gain }; }) });
      }
    }
    var bx = bestXI(newSquad, ctx);
    res.captain = bx.capId; res.vice = bx.viceId; res.xi = bx.ids; res.formation = bx.formation;
    if (bx.capId) res.order.push({ step: res.order.length + 1, action: "captain", id: bx.capId, name: ctx.els[bx.capId].web_name });
    if (bx.viceId) res.order.push({ step: res.order.length + 1, action: "vice", id: bx.viceId, name: ctx.els[bx.viceId].web_name });
  } catch (e) { res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}

// ---------------------------------------------------------------- wildcard (C3, C4)

function wcObjective(ids, ctx, tsKey) {
  var r = pickXI(ids, ctx, function (el) { return xp5With(el, ctx, tsKey); });
  if (!r.ok) return -1e9;
  return r.score + WC_BENCH_WEIGHT * sum(r.bench, function (id) { return xp5With(ctx.els[id], ctx, tsKey); });
}
function wcPool(ctx, opts, position) {
  // Eligibility ladder: L0 strict (3 of 3 starts, P(start) >= 0.75, status a) → L1 (2 of 3, 0.5) → L2 (any start) → L3 (status a).
  var levels = [
    function (el, gs, x) { return gs.starts_last3 >= WC_MIN_STARTS3 && x.pstart >= WC_MIN_PSTART; },
    function (el, gs, x) { return gs.starts_last3 >= 2 && x.pstart >= 0.5; },
    function (el, gs, x) { return num(el.starts, 0) >= 1; },
    function () { return true; }
  ];
  if (!okCtx(ctx) || !Array.isArray(ctx.elList) || !SQUAD_SHAPE[position]) return { ids: [], level: 3, exhausted: true };
  if (!isObj(opts)) opts = {};
  var lockSet = {}; arr(opts.locks).forEach(function (id) { lockSet[id] = true; });
  var exclude = {}; arr(opts.exclude).forEach(function (id) { exclude[id] = true; });
  var need = SQUAD_SHAPE[position] + 2;
  for (var L = 0; L < levels.length; L++) {
    if (L > 0 && opts.relax === false) return { ids: [], level: L - 1, exhausted: true };
    var ids = ctx.elList.filter(function (el) {
      if (elType(el) !== position || exclude[el.id]) return false;
      if (lockSet[el.id]) return true;
      var fl = ctx.flags && ctx.flags[el.id] ? ctx.flags[el.id] : flagInfo(el); if (fl.status !== "a") return false;
      var gs = ctx.gwStats[el.id] || { starts_last3: 0 }, x = ctx.xp[el.id];
      if (!levels[L](el, gs, x)) return false;
      if (convergenceRisk(el.id, ctx).risk) return false;
      return true;
    }).map(function (el) { return el.id; });
    if (ids.length >= need) return { ids: ids, level: L, exhausted: false };
  }
  return { ids: [], level: 3, exhausted: true };
}
function wcCost(ids, ctx) {
  if (!okCtx(ctx)) return 0;
  return sum(arr(ids), function (x) { var el = ctx.els[idOf(x)]; return el ? num(el.now_cost, 0) : 0; });
}
function wcSetup(ctx, opts, tsKey) {
  // One place builds the eligible pool, the candidate windows, the locks and the budget that the
  // wildcard search AND any audit of its answer have to share. It used to be inline in wcSolve,
  // so a check of the returned fifteen could only ever test its own private copy of the rules.
  var out = { ok: false, budget: BUDGET_TENTHS, pool: {}, cands: {}, cheap: {}, minCost: {}, locks: [], lockSet: {}, current: {}, relaxed: false, relaxations: [], reasons: [] };
  if (!okCtx(ctx) || !Array.isArray(ctx.elList) || !Array.isArray(ctx.squadIds)) { out.reasons.push("no usable context"); return out; }
  if (!isObj(opts)) opts = {};
  var key = tsKey === "TS_GOALS" ? "TS_GOALS" : "TS";
  out.budget = num(opts.budget, ctx.budget || BUDGET_TENTHS);
  out.locks = uniq(idList(opts.locks)).filter(function (id) { return ctx.els[id]; });
  out.locks.forEach(function (id) { out.lockSet[id] = true; });
  ctx.squadIds.forEach(function (id) { out.current[id] = true; });
  var levelNames = ["3 of 3 starts and P(start) >= 0.75", "2 of 3 starts and P(start) >= 0.5", "any start this season", "status available only"];
  [1, 2, 3, 4].forEach(function (t) {
    var p = wcPool(ctx, opts, t);
    if (p.exhausted) out.reasons.push(POS_NAME[t] + ": pool cannot fill the position");
    if (p.level > 0) { out.relaxed = true; out.relaxations.push(POS_NAME[t] + ": fewer than " + (SQUAD_SHAPE[t] + 2) + " players meet 3 of 3 starts and P(start) >= 0.75; relaxed to " + levelNames[p.level]); }
    out.pool[t] = p.ids.slice().sort(function (a, b) { return xp5With(ctx.els[b], ctx, key) - xp5With(ctx.els[a], ctx, key); });
    out.cands[t] = out.pool[t].slice(0, 30);
    out.locks.forEach(function (id) { if (elType(ctx.els[id]) === t && out.cands[t].indexOf(id) < 0) out.cands[t].unshift(id); });
    out.cheap[t] = out.pool[t].slice().sort(function (a, b) { return num(ctx.els[a].now_cost, 0) - num(ctx.els[b].now_cost, 0); }).slice(0, 8);
    out.minCost[t] = out.pool[t].length ? Math.min.apply(null, out.pool[t].map(function (id) { return num(ctx.els[id].now_cost, 0); })) : 999;
  });
  out.ok = out.reasons.length === 0;
  return out;
}
function wcFeasible(ids, ctx, W) {
  // B3 plus C3: 2-5-5-3 never exceeded, <=3 from a club, <=2 incoming from a club (E-009), and
  // enough budget left to fill the empty slots at the cheapest price in the pool.
  if (!Array.isArray(ids) || !okCtx(ctx) || !isObj(W)) return false;
  if (uniq(ids).length !== ids.length) return false;
  var pc = posCounts(ids, ctx.els);
  if (pc.unknown > 0) return false;
  for (var t = 1; t <= 4; t++) if (pc[t] > SQUAD_SHAPE[t]) return false;
  var cc = clubCounts(ids, ctx.els); for (var c in cc) if (cc[c] > MAX_PER_CLUB) return false;
  var cur = isObj(W.current) ? W.current : {};
  var inc = clubCounts(ids.filter(function (id) { return !cur[id]; }), ctx.els); for (var c2 in inc) if (inc[c2] > MAX_INCOMING_PER_CLUB) return false;
  var mc = isObj(W.minCost) ? W.minCost : {};
  var remaining = 0; for (var t2 = 1; t2 <= 4; t2++) remaining += (SQUAD_SHAPE[t2] - pc[t2]) * num(mc[t2], 999);
  return wcCost(ids, ctx) + remaining <= num(W.budget, BUDGET_TENTHS);
}
function wcSolve(ctx, opts, tsKey) {
  var out = { ok: false, ids: [], cost: 0, score: -1e9, steps: 0, spend: null, relaxed: false, relaxations: [], reasons: [] };
  if (!okCtx(ctx) || !Array.isArray(ctx.elList) || !Array.isArray(ctx.squadIds)) { out.reasons.push("no usable context"); return out; }
  if (!isObj(opts)) opts = {};
  var W = wcSetup(ctx, opts, tsKey);
  out.relaxed = W.relaxed; out.relaxations = W.relaxations.slice();
  if (!W.ok) { out.reasons = W.reasons.slice(); return out; }
  var budget = W.budget, pool = W.pool, cands = W.cands, cheap = W.cheap, locks = W.locks, lockSet = W.lockSet;
  function feasible(list) { return wcFeasible(list, ctx, W); }
  function obj(list) { return wcObjective(list, ctx, tsKey); }
  function priceOf(id) { return num(ctx.els[id].now_cost, 0); }
  // greedy seed by xp5/price
  var ids = locks.slice();
  if (!feasible(ids)) { out.reasons.push("locks are not jointly legal within the budget"); return out; }
  var ratio = [];
  [1, 2, 3, 4].forEach(function (t) { pool[t].forEach(function (id) { if (ids.indexOf(id) < 0) ratio.push({ id: id, r: xp5With(ctx.els[id], ctx, tsKey) / Math.max(1, priceOf(id)) }); }); });
  ratio.sort(function (a, b) { return b.r - a.r; });
  ratio.forEach(function (c) { if (ids.length >= 15) return; var tryIds = ids.concat([c.id]); if (feasible(tryIds)) ids = tryIds; });
  if (ids.length < 15) { out.reasons.push("greedy seed could not fill 15 within the budget"); return out; }
  var score = obj(ids);
  // E-038: the local search used to stop after twelve improvements and only ever looked at the
  // top thirty candidates per position, so "nothing better exists" really meant "nothing better
  // inside the window, if twelve steps were enough". The 1-swap pass now runs to a fixed point
  // over the WHOLE eligible pool; the 2-swap pass keeps its top-12 window because it is
  // quadratic; and a spend-the-bank pair step sells one player down to fund a dearer upgrade
  // elsewhere, which is the only move that can turn an idle bank into points. What comes back is
  // a 1-swap local optimum by construction, and wcLocalOptimum is the proof of it.
  var stepCap = clamp(intOf(opts.maxPasses, 300), 0, 4000);
  var steps = 0, spendTried = 0;
  function step1() {
    var bestIds = null, bestGain = 1e-9;
    for (var i = 0; i < ids.length; i++) {
      if (lockSet[ids[i]]) continue;
      var p = pool[elType(ctx.els[ids[i]])] || [];
      for (var j = 0; j < p.length; j++) {
        var c = p[j]; if (ids.indexOf(c) >= 0) continue;
        var trial = ids.slice(); trial[i] = c;
        if (!feasible(trial)) continue;
        var sc = obj(trial);
        if (sc - score > bestGain) { bestGain = sc - score; bestIds = trial; }
      }
    }
    return bestIds ? { ids: bestIds, gain: bestGain } : null;
  }
  function step2() {
    var bestIds = null, bestGain = 1e-9;
    for (var a = 0; a < ids.length && !bestIds; a++) {
      if (lockSet[ids[a]]) continue;
      var ca = (cands[elType(ctx.els[ids[a]])] || []).slice(0, 12);
      for (var b = a + 1; b < ids.length && !bestIds; b++) {
        if (lockSet[ids[b]]) continue;
        var cb = (cands[elType(ctx.els[ids[b]])] || []).slice(0, 12);
        for (var x = 0; x < ca.length; x++) {
          if (ids.indexOf(ca[x]) >= 0) continue;
          for (var y = 0; y < cb.length; y++) {
            if (ids.indexOf(cb[y]) >= 0 || cb[y] === ca[x]) continue;
            var tr = ids.slice(); tr[a] = ca[x]; tr[b] = cb[y];
            if (!feasible(tr)) continue;
            var s2 = obj(tr);
            if (s2 - score > bestGain) { bestGain = s2 - score; bestIds = tr; }
          }
        }
      }
    }
    return bestIds ? { ids: bestIds, gain: bestGain } : null;
  }
  function stepSpend() {
    var bestIds = null, bestGain = 1e-9;
    for (var a = 0; a < ids.length && !bestIds; a++) {
      if (lockSet[ids[a]]) continue;
      var down = cheap[elType(ctx.els[ids[a]])] || [];
      for (var b = 0; b < ids.length && !bestIds; b++) {
        if (b === a || lockSet[ids[b]]) continue;
        var up = (cands[elType(ctx.els[ids[b]])] || []).slice(0, 10);
        for (var x = 0; x < down.length; x++) {
          if (ids.indexOf(down[x]) >= 0 || priceOf(down[x]) >= priceOf(ids[a])) continue;
          for (var y = 0; y < up.length; y++) {
            if (ids.indexOf(up[y]) >= 0 || up[y] === down[x] || priceOf(up[y]) <= priceOf(ids[b])) continue;
            var tr = ids.slice(); tr[a] = down[x]; tr[b] = up[y];
            if (!feasible(tr)) continue;
            spendTried++;
            var s3 = obj(tr);
            if (s3 - score > bestGain) { bestGain = s3 - score; bestIds = tr; }
          }
        }
      }
    }
    return bestIds ? { ids: bestIds, gain: bestGain } : null;
  }
  var moved = true, m1, m2, m3;
  while (moved && steps < stepCap) {
    moved = false;
    while (steps < stepCap) {
      m1 = step1(); if (!m1) break;
      ids = m1.ids; score += m1.gain; steps++; moved = true;
    }
    if (steps >= stepCap) break;
    m2 = step2();
    if (m2) { ids = m2.ids; score += m2.gain; steps++; moved = true; continue; }
    m3 = stepSpend();
    if (m3) { ids = m3.ids; score += m3.gain; steps++; moved = true; }
  }
  var spent = wcCost(ids, ctx), left = Math.trunc(num(budget, 0) - spent);
  out.ok = true; out.ids = ids; out.cost = spent; out.score = score; out.steps = steps;
  out.spend = { bank: left, pairsTried: spendTried, note: left <= 0 ? "the whole budget is spent" : "no legal swap and no funded upgrade inside the eligible pool raises the objective, so " + left + " tenths stay in the bank" };
  return out;
}
function wcLocalOptimum(ids, ctx, opts) {
  // The only honest acceptance criterion for a local search: a returned fifteen is a local
  // optimum when no single legal swap against the WHOLE eligible pool raises the objective.
  // Same pool, same feasibility and same objective as wcSolve, because they come from wcSetup.
  var res = { ok: false, optimal: false, checked: 0, dearerTried: 0, bestGain: 0, bank: 0, improvements: [], reason: "" };
  try {
    var o = isObj(opts) ? opts : {};
    var tsKey = o.model === "TS_GOALS" ? "TS_GOALS" : "TS";
    if (!okCtx(ctx)) { res.reason = "no context"; return res; }
    var list = uniq(idList(ids)).filter(function (id) { return ctx.els[id]; });
    if (list.length !== 15) { res.reason = "a fifteen is needed, got " + list.length + " known players"; return res; }
    var W = wcSetup(ctx, o, tsKey);
    if (!W.ok) { res.reason = W.reasons.join("; ") || "no eligible pool"; return res; }
    res.bank = Math.trunc(num(W.budget, 0) - wcCost(list, ctx));
    var score = wcObjective(list, ctx, tsKey);
    var found = [];
    for (var i = 0; i < list.length; i++) {
      if (W.lockSet[list[i]]) continue;
      var p = arr(W.pool[elType(ctx.els[list[i]])]);
      for (var j = 0; j < p.length; j++) {
        var c = p[j]; if (list.indexOf(c) >= 0) continue;
        var trial = list.slice(); trial[i] = c;
        if (!wcFeasible(trial, ctx, W)) continue;
        res.checked++;
        if (num(ctx.els[c].now_cost, 0) > num(ctx.els[list[i]].now_cost, 0)) res.dearerTried++;
        var g = wcObjective(trial, ctx, tsKey) - score;
        if (g > 1e-9) found.push({ out: list[i], outName: elName(list[i], ctx), in: c, inName: elName(c, ctx), gain: g });
      }
    }
    found.sort(function (a, b) { return b.gain - a.gain; });
    res.improvements = found.slice(0, 5);
    res.bestGain = found.length ? found[0].gain : 0;
    res.optimal = found.length === 0;
    res.ok = true;
    res.reason = found.length
      ? found.length + " legal single swaps raise the objective; the best is worth " + found[0].gain.toFixed(3)
      : res.checked + " legal single swaps were tested and none raises the objective" + (res.bank > 0 ? ", including " + res.dearerTried + " dearer players the " + res.bank + " tenths in the bank could pay for" : "");
  } catch (e) { res.reason = "engine error: " + errMsg(e); }
  return res;
}
function wildcardSolver(ctx, opts) {
  var res = { ok: false, ids: [], xi: null, cost: 0, bank: 0, score: 0, model: "TS", alt: null, disagreement: null, relaxed: false, relaxations: [], reasons: [], budget: 0, steps: 0, spend: null };
  try {
    if (!okCtx(ctx)) { res.reasons.push("no context"); return res; }
    var o = isObj(opts) ? opts : {};
    var budget = num(o.budget, ctx.budget || BUDGET_TENTHS);
    res.budget = budget;
    var main = wcSolve(ctx, { locks: o.locks, exclude: o.exclude, relax: o.relax, budget: budget, maxPasses: o.maxPasses }, "TS");
    res.relaxed = main.relaxed; res.relaxations = main.relaxations; res.reasons = main.reasons.slice();
    if (!main.ok) return res;
    var alt = (o.model === "TS" || o.both === false) ? null : wcSolve(ctx, { locks: o.locks, exclude: o.exclude, relax: o.relax, budget: budget, maxPasses: o.maxPasses }, "TS_GOALS");
    var mainTs = main.score, mainGoals = wcObjective(main.ids, ctx, "TS_GOALS");
    var chosen = main, model = "TS";
    if (alt && alt.ok) {
      var altTs = wcObjective(alt.ids, ctx, "TS"), altGoals = alt.score;
      var differ = alt.ids.filter(function (id) { return main.ids.indexOf(id) < 0; }).length;
      res.alt = { ids: alt.ids, cost: alt.cost, score: altGoals, scoreTs: altTs, model: "TS_GOALS" };
      res.disagreement = { playersDiffer: differ, main: { ts: mainTs, goals: mainGoals }, alt: { ts: altTs, goals: altGoals }, mainDominates: mainGoals >= altGoals - 1e-9, note: differ === 0 ? "both fixture models agree on the fifteen" : (mainGoals >= altGoals - 1e-9 ? "xG squad is equal-or-better under both models" : "the goals model prefers " + differ + " different players; treat the gap as noise — xG drives, goals explain") };
    }
    res.ok = true; res.ids = chosen.ids; res.cost = chosen.cost; res.bank = budget - chosen.cost; res.score = chosen.score; res.model = model;
    res.steps = chosen.steps; res.spend = chosen.spend;
    res.xi = bestXI(chosen.ids, ctx);
    var L = legal15(chosen.ids, ctx.els, budget); if (!L.ok) { res.ok = false; res.reasons = res.reasons.concat(L.reasons); }
  } catch (e) { res.ok = false; res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function elName(id, ctx) {
  var el = okCtx(ctx) ? ctx.els[id] : null;
  var n = el && el.web_name !== undefined && el.web_name !== null ? String(el.web_name) : "";
  if (n !== "") return n;
  var v = idOf(id);
  return isFinite(v) ? "player " + v : "unknown player";
}
function writtenFifteen(opts) {
  // The written plan lives in the WEEKLY block, which is assembled after the engine in the
  // shipped file. Callers may hand it in (opts.written); when they do not, and a weekly block is
  // in scope, it is read from there. Required either way — the engine never invents a fifteen.
  var given = uniq(idList(isObj(opts) ? opts.written : null));
  if (given.length) return given;
  try {
    if (typeof WEEKLY !== "undefined" && isObj(WEEKLY) && isObj(WEEKLY.classic)) return uniq(idList(WEEKLY.classic.wildcard15));
  } catch (e) { /* the engine also runs standalone, with no weekly block in scope */ }
  return [];
}
function wildcardOptions(ctx, opts) {
  // C1 rule 6 keeps anyone at or above 60% rival ownership out of the solver. When the manager's
  // own written fifteen contains such players, the rule and the plan disagree, and the app has to
  // be able to show the disagreement priced rather than silently shipping one side of it. This
  // returns all three fifteens under one objective; it changes neither wildcardSolver's default
  // answer nor rule C1.6.
  var res = { ok: false, pure: null, locked: null, written: null, locks: [], deltas: null, budget: 0, model: "TS", note: "", reasons: [] };
  try {
    if (!okCtx(ctx)) { res.reasons.push("no context"); return res; }
    var o = isObj(opts) ? opts : {};
    var budget = num(o.budget, ctx.budget || BUDGET_TENTHS);
    res.budget = budget;
    var decaySum = sum(DECAY) || 1;
    var w15 = writtenFifteen(o).filter(function (id) { return ctx.els[id]; });
    // Derived, never a list of ids: the convergent players the written plan itself contains.
    var lockIds = w15.filter(function (id) { return convergenceRisk(id, ctx).risk; });
    res.locks = lockIds.map(function (id) {
      var r = rivalOwnMax(id, ctx);
      return { id: id, web_name: elName(id, ctx), rivalOwn: r.max, league: r.league, now_cost: num(ctx.els[id].now_cost, 0) };
    });
    function variant(label, list, how) {
      var v = { label: label, how: how, ok: false, ids: [], cost: 0, bank: 0, objective: 0, weekly: 0, xi: [], formation: "", captain: null, vice: null, legal: false, reasons: [] };
      var ids = uniq(idList(list)).filter(function (id) { return ctx.els[id]; });
      v.ids = ids;
      if (ids.length !== 15) { v.reasons.push(label + " is " + ids.length + " known players, not fifteen"); return v; }
      var L = legal15(ids, ctx.els, budget);
      v.legal = L.ok; v.cost = L.cost; v.bank = Math.trunc(budget - L.cost);
      if (!L.ok) v.reasons = v.reasons.concat(L.reasons);
      v.objective = wcObjective(ids, ctx, "TS");
      v.weekly = v.objective / decaySum;
      var bx = bestXI(ids, ctx);
      v.xi = bx.ids; v.formation = bx.formation; v.captain = bx.capId; v.vice = bx.viceId;
      v.ok = true;
      return v;
    }
    function gap(a, b) {
      if (!a || !b || !a.ok || !b.ok) return null;
      var onlyA = a.ids.filter(function (id) { return b.ids.indexOf(id) < 0; });
      var onlyB = b.ids.filter(function (id) { return a.ids.indexOf(id) < 0; });
      return {
        objective: a.objective - b.objective, weekly: a.weekly - b.weekly,
        cost: a.cost - b.cost, bank: a.bank - b.bank, playersDiffer: onlyA.length,
        gained: onlyA.map(function (id) { return { id: id, web_name: elName(id, ctx), now_cost: num(ctx.els[id].now_cost, 0) }; }),
        given: onlyB.map(function (id) { return { id: id, web_name: elName(id, ctx), now_cost: num(ctx.els[id].now_cost, 0) }; })
      };
    }
    var pureSolve = wildcardSolver(ctx, { budget: budget, both: false, relax: o.relax, exclude: o.exclude, maxPasses: o.maxPasses });
    if (!pureSolve.ok) { res.reasons = res.reasons.concat(pureSolve.reasons); return res; }
    res.pure = variant("rule-pure", pureSolve.ids, "solved with C1 rule 6 in force: nobody at or above 60% rival ownership");
    var lockedSolve = lockIds.length ? wildcardSolver(ctx, { budget: budget, both: false, locks: lockIds, relax: o.relax, exclude: o.exclude, maxPasses: o.maxPasses }) : pureSolve;
    if (lockedSolve.ok) {
      res.locked = variant("premiums locked", lockedSolve.ids, lockIds.length
        ? "same solve with " + lockIds.map(function (id) { return elName(id, ctx); }).join(", ") + " locked in — the convergent players the written plan already carries"
        : "no convergent player in the written fifteen, so this is the rule-pure solve");
    } else {
      res.reasons = res.reasons.concat(lockedSolve.reasons);
    }
    res.written = variant("written plan", w15, w15.length ? "the manager's own fifteen, scored under the same objective" : "no written fifteen was supplied");
    res.deltas = {
      lockedVsPure: gap(res.locked, res.pure),
      writtenVsPure: gap(res.written, res.pure),
      writtenVsLocked: gap(res.written, res.locked)
    };
    var d = res.deltas.lockedVsPure;
    res.note = lockIds.length === 0
      ? "No player in the written fifteen is 60% rival-owned, so the rule and the plan agree and all three fifteens are the same solve."
      : "Rule C1.6 keeps " + lockIds.length + " of the written fifteen out of the solver (" + res.locks.map(function (l) { return l.web_name + " " + Math.round(l.rivalOwn * 100) + "%"; }).join(", ") +
        "). Locking them in is worth " + (d ? (d.objective >= 0 ? "+" : "") + d.objective.toFixed(2) + " over five gameweeks and spends " + (d.cost >= 0 ? "" : "") + d.cost + " tenths more" : "a figure the solver could not produce") +
        ". The rule protects mini-league rank against the field; the points say the opposite. Both are on the table, priced.";
    res.ok = true;
  } catch (e) { res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function wildcardTiming(ctx) {
  var res = { gw: 0, weeklyGap: 0, swapsNeeded: 0, currentWeekly: 0, bestWeekly: 0, horizons: [], grid: [], breakeven: { byGw19: null, byGw38: null }, wcTrigger: WC_TRIGGER, sumDeficit5: 0, saturated: { saturates: false, weeks: 0, gw: 0, note: "" }, note: "" };
  try {
    if (!okCtx(ctx)) return res;
    res.gw = ctx.nextEvent;
    var decaySum = sum(DECAY);
    var cur = ctx.squadIds.length === 15 ? ctx.squadIds : [];
    var wc = wildcardSolver(ctx, { both: false });
    if (!wc.ok) { res.note = "wildcard solver could not build a squad: " + wc.reasons.join("; "); return res; }
    var curObj = cur.length ? wcObjective(cur, ctx, "TS") : 0;
    res.currentWeekly = curObj / decaySum; res.bestWeekly = wc.score / decaySum;
    res.weeklyGap = Math.max(0, res.bestWeekly - res.currentWeekly);
    res.swapsNeeded = cur.length ? wc.ids.filter(function (id) { return cur.indexOf(id) < 0; }).length : 15;
    res.sumDeficit5 = Math.max(0, wc.score - curObj);
    var perFix = res.swapsNeeded ? res.weeklyGap / res.swapsNeeded : 0;
    function sumDeficit(T, mult) { var s = 0; for (var t = 0; t < T; t++) s += Math.max(0, res.weeklyGap * mult - t * perFix * mult); return s; }
    // E-042: the two headline horizons were a gameweek out of step with each other — the GW19
    // window excluded GW19 while the GW38 window included GW38 — and then printed the same total
    // with nothing to say why. Both windows are inclusive of their end gameweek now, and
    // `saturated` names the gameweek after which the deficit stops growing because the free
    // transfers have already made every swap. Two equal totals are a property, not a coincidence.
    var toGw19 = Math.max(0, 19 - ctx.nextEvent + 1), toGw38 = Math.max(0, 38 - ctx.nextEvent + 1);
    [5, toGw19, toGw38].forEach(function (T, i) { res.horizons.push({ label: ["5 GWs", "to GW19 (set 1 expiry)", "to GW38"][i], weeks: T, gw: ctx.nextEvent + T - 1, sumDeficit: sumDeficit(T, 1) }); });
    var satWeeks = perFix > 1e-12 ? Math.ceil(res.weeklyGap / perFix - 1e-9) : 0;
    if (!isFinite(satWeeks) || satWeeks < 0) satWeeks = 0;
    res.saturated = {
      saturates: satWeeks > 0 && satWeeks <= toGw38,
      weeks: satWeeks,
      gw: satWeeks > 0 ? res.gw + satWeeks - 1 : res.gw,
      note: satWeeks > 0
        ? "The deficit stops growing after GW" + (res.gw + satWeeks - 1) + ": by then the free transfers have made all " + res.swapsNeeded + " swaps at one a week, so every horizon past that gameweek reports the same total."
        : "Current squad and wildcard squad are the same fifteen, so there is no deficit to accumulate."
    };
    [0.5, 0.75, 1, 1.25, 1.5].forEach(function (m) {
      [0, 10, 20, 30, 45, 60].forEach(function (later) {
        res.grid.push({ deficitMult: m, laterValue: later, nowAdvantageBy: { gw19: sumDeficit(toGw19, m) - later, gw38: sumDeficit(toGw38, m) - later } });
      });
    });
    res.breakeven.byGw19 = sumDeficit(toGw19, 1); res.breakeven.byGw38 = sumDeficit(toGw38, 1);
    res.note = "Now-advantage = cumulative weekly deficit of the current squad against the wildcard squad, declining as free transfers fix it at one a week, minus the value of a later window. A later window worth more than " + res.breakeven.byGw19.toFixed(0) + " by GW19 would beat playing it now; none is confirmed in the fixture list.";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- chips (C1 rule 5, F8)

function chipWindows(live) {
  var res = { doubles: [], blanks: [], recommendation: { bb: null, tc: null, fh: null, wc: "see wildcardTiming", note: "" }, nextEvent: 0 };
  try {
    if (!isObj(live)) return res;
    var teams = arr(live.teams).filter(isObj).map(function (t) { return t.id; });
    var nextEv = intOf(live.next_event, 0);
    var events = arr(live.events).filter(isObj).map(function (e) { return intOf(e.id, 0); }).filter(function (e) { return e >= nextEv; });
    var counts = {};
    arr(live.fixtures).forEach(function (f) { if (!isObj(f)) return; var ev = intOf(f.event, -1); if (ev < nextEv) return; counts[ev] = counts[ev] || {}; counts[ev][f.team_h] = (counts[ev][f.team_h] || 0) + 1; counts[ev][f.team_a] = (counts[ev][f.team_a] || 0) + 1; });
    res.nextEvent = nextEv;
    events.forEach(function (ev) {
      var c = counts[ev] || {}; var total = 0; Object.keys(c).forEach(function (t) { total += c[t]; });
      if (total === 0) return;                                   // unscheduled event: no evidence either way
      var dbl = teams.filter(function (t) { return (c[t] || 0) >= 2; }), blank = teams.filter(function (t) { return !(c[t] || 0); });
      if (dbl.length) res.doubles.push({ event: ev, teams: dbl, n: dbl.length, confirmed: true });
      if (blank.length) res.blanks.push({ event: ev, teams: blank, n: blank.length, confirmed: true });
    });
    if (res.doubles.length) { var big = res.doubles.slice().sort(function (a, b) { return b.n - a.n || a.event - b.event; })[0]; res.recommendation.bb = big.event; res.recommendation.tc = big.event; }
    if (res.blanks.length) { var deep = res.blanks.slice().sort(function (a, b) { return b.n - a.n || a.event - b.event; })[0]; res.recommendation.fh = deep.event; }
    res.recommendation.note = (res.doubles.length || res.blanks.length) ? "Windows are read from the fixture list as published; a double or blank only counts once the fixtures are scheduled." : "No double or blank gameweek is scheduled in the fixture list yet; Bench Boost, Triple Captain and Free Hit wait for a confirmed window.";
  } catch (e) { res.recommendation.note = "engine error: " + errMsg(e); }
  return res;
}
function chipRegret(chip, ctx, opts) {
  var res = { chip: String(chip || "").toUpperCase(), useNow: 0, bestLater: 0, laterEvent: null, regretUse: 0, regretHold: 0, verdict: "no window", note: "" };
  try {
    if (!okCtx(ctx)) return res;
    var o = isObj(opts) ? opts : {};
    var windows = chipWindows(ctx.live);
    var squad = uniq(idList(o.ids && o.ids.length ? o.ids : ctx.squadIds)).filter(function (id) { return ctx.els[id]; });
    var bx = squad.length >= 11 ? bestXI(squad, ctx) : { ids: [], capId: null, bench: [] };
    var capXp = bx.capId ? ctx.xp[bx.capId].xp1 : 0;
    var benchXp = sum(bx.bench, function (id) { return ctx.xp[id].xp1; });
    var dbl = windows.doubles[0] || null, blank = windows.blanks[0] || null;
    if (res.chip === "TC") { res.useNow = capXp; res.bestLater = dbl ? 2 * capXp : 0; res.laterEvent = dbl ? dbl.event : null; }
    else if (res.chip === "BB") { res.useNow = benchXp; res.bestLater = dbl ? 2 * benchXp : 0; res.laterEvent = dbl ? dbl.event : null; }
    else if (res.chip === "FH") { var wc = wildcardSolver(ctx, { both: false }); res.useNow = wc.ok && bx.ids.length ? Math.max(0, (wc.xi ? wc.xi.score : 0) - bx.score) : 0; res.bestLater = blank ? blank.n / 20 * 11 * (bx.score / 11 || 0) : 0; res.laterEvent = blank ? blank.event : null; }
    else if (res.chip === "WC") { var tm = wildcardTiming(ctx); res.useNow = tm.breakeven.byGw19 || 0; res.bestLater = num(o.laterValue, 0); res.laterEvent = o.laterEvent === undefined ? null : o.laterEvent; }
    else { res.note = "unknown chip"; return res; }
    res.regretUse = Math.max(0, res.bestLater - res.useNow); res.regretHold = Math.max(0, res.useNow - res.bestLater);
    if (res.laterEvent === null && res.chip !== "WC") { res.verdict = res.useNow > 0 && res.chip === "WC" ? "use" : "no window"; res.note = "No confirmed later window in the fixture list; expected regret of holding is the single-GW value forgone, of using it is unknown until a window is scheduled."; }
    else res.verdict = res.regretUse > res.regretHold ? "hold" : "use";
    if (res.chip === "WC") res.verdict = res.useNow >= WC_TRIGGER && res.useNow >= res.bestLater ? "use" : (res.useNow < WC_TRIGGER ? "hold" : "hold");
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- draft (C5)

function draftEl(code, ctx) {
  if (!okCtx(ctx)) return null;
  var c = num(code, NaN); if (!isFinite(c)) return null;
  var cls = ctx.byCode[c] || null, dr = ctx.draft.byCode[c] || null;
  if (!cls && !dr) return null;
  return { code: c, classic: cls, draft: dr, id: cls ? cls.id : null, web_name: (cls || dr).web_name, team: (cls || dr).team, element_type: elType(cls || dr), status: (dr || cls).status, chance: (dr || cls).chance === undefined ? null : (dr || cls).chance };
}
function draftEV(rec, ctx) {
  if (!rec || !rec.classic) return { ev: 0, xp5: 0, pstart: 0, starts_last3: 0 };
  var x = ctx.xp[rec.classic.id] || { xp5: 0, pstart: 0 };
  var gs = ctx.gwStats[rec.classic.id] || { starts_last3: 0 };
  var fl = flagInfo(rec.draft || rec.classic);
  var p = fl.flagged ? x.pstart * (fl.factor / Math.max(1e-6, (ctx.flags[rec.classic.id] || fl).factor)) : x.pstart;
  return { ev: x.xp5 * clamp(p, 0, 1), xp5: x.xp5, pstart: clamp(p, 0, 1), starts_last3: gs.starts_last3, flagged: fl.flagged, status: fl.status };
}
function draftWaivers(state, ctx) {
  var out = [];
  try {
    if (!okCtx(ctx)) return out;
    var st = state === undefined || state === null ? ctx.state : sanitiseState(state);
    var roster = uniq(arr(st.draft.roster).map(function (c) { return num(c, NaN); }).filter(isFinite));
    var mine = {}; roster.forEach(function (c) { mine[c] = true; });
    var taken = {}; arr(isObj(state) && state.draft ? state.draft.taken : null).forEach(function (c) { taken[num(c, NaN)] = true; });
    var rosterRecs = roster.map(function (c) { return draftEl(c, ctx); }).filter(Boolean);
    var fa = {};
    [1, 2, 3, 4].forEach(function (t) { fa[t] = []; });
    Object.keys(ctx.draft.byCode).forEach(function (c) {
      var rec = draftEl(c, ctx); if (!rec || mine[rec.code] || taken[rec.code] || !rec.classic) return;
      if (rec.status !== "a") return;
      var ev = draftEV(rec, ctx); if (ev.starts_last3 === 0) return;
      fa[rec.element_type].push({ rec: rec, ev: ev });
    });
    [1, 2, 3, 4].forEach(function (t) { fa[t].sort(function (a, b) { return b.ev.ev - a.ev.ev; }); });
    var used = {};
    function bestFA(t) { for (var i = 0; i < fa[t].length; i++) if (!used[fa[t][i].rec.code]) return fa[t][i]; return null; }
    var claims = [];
    rosterRecs.forEach(function (r) {
      var ev = draftEV(r, ctx);
      var why = null;
      if (r.status !== "a") why = "unavailable (status " + r.status + ")";
      else if (ev.starts_last3 === 0) why = "no starts in the last 3";
      if (!why) return;
      var b = bestFA(r.element_type); if (!b) return;
      used[b.rec.code] = true;
      claims.push({ out: r.code, in: b.rec.code, outName: r.web_name, inName: b.rec.web_name, evOut: ev.ev, evIn: b.ev.ev, gain: b.ev.ev - ev.ev, why: why, forced: true });
    });
    // C5: forced replacements go in first, but within that group the claim order is still
    // the gain — a waiver list is submitted in priority order and the biggest gain has to
    // survive the rivals' claims. (Caught by smoke_wk "draft claims forced replacements first".)
    claims.sort(function (a, b) { return b.gain - a.gain; });
    var upgrades = [];
    rosterRecs.forEach(function (r) {
      if (claims.some(function (c) { return c.out === r.code; })) return;
      var ev = draftEV(r, ctx);
      var b = bestFA(r.element_type); if (!b) return;
      var gain = b.ev.ev - ev.ev;
      if (gain > 0.5) upgrades.push({ out: r.code, in: b.rec.code, outName: r.web_name, inName: b.rec.web_name, evOut: ev.ev, evIn: b.ev.ev, gain: gain, why: "upgrade: EV " + b.ev.ev.toFixed(1) + " vs " + ev.ev.toFixed(1), forced: false });
    });
    upgrades.sort(function (a, b) { return b.gain - a.gain; });
    var seen = {};
    upgrades.forEach(function (u) { if (seen[u.in]) return; seen[u.in] = true; claims.push(u); });
    claims.forEach(function (c, i) { c.priority = i + 1; out.push(c); });
  } catch (e) { /* total */ }
  return out;
}
function watchlistAudit(codes, ctx) {
  var res = { keep: [], drop: [], unknown: [], detail: [] };
  try {
    if (!okCtx(ctx)) return res;
    uniq(arr(codes).map(function (c) { return num(c, NaN); }).filter(isFinite)).forEach(function (c) {
      var rec = draftEl(c, ctx);
      if (!rec || !rec.classic) { res.unknown.push(c); res.detail.push({ code: c, name: null, starts_last3: null, verdict: "unknown" }); return; }
      var gs = ctx.gwStats[rec.classic.id] || { starts_last3: 0 };
      var keep = gs.starts_last3 >= 3 && rec.status === "a";
      (keep ? res.keep : res.drop).push(c);
      res.detail.push({ code: c, id: rec.classic.id, name: rec.web_name, starts_last3: gs.starts_last3, status: rec.status, verdict: keep ? "KEEP" : "DROP" });
    });
  } catch (e) { /* total */ }
  return res;
}
function draftXI(codes, ctx) {
  var res = { codes: [], ids: [], formation: "", score: 0, gk: null, def: [], mid: [], fwd: [], bench: [] };
  try {
    if (!okCtx(ctx)) return res;
    var recs = uniq(arr(codes).map(function (c) { return num(c, NaN); }).filter(isFinite)).map(function (c) { return draftEl(c, ctx); }).filter(function (r) { return r && r.classic; });
    var ids = recs.map(function (r) { return r.classic.id; });
    var codeOf = {}; recs.forEach(function (r) { codeOf[r.classic.id] = r.code; });
    var r = pickXI(ids, ctx, function (el) { return ctx.xp[el.id] ? ctx.xp[el.id].xp1 : xp1(el, ctx); });
    if (!r.ok) return res;
    res.ids = r.ids; res.codes = r.ids.map(function (id) { return codeOf[id]; }); res.formation = r.formation; res.score = r.score;
    res.bench = r.bench.map(function (id) { return codeOf[id]; });
    r.ids.forEach(function (id) { var t = elType(ctx.els[id]); if (t === 1) res.gk = codeOf[id]; else if (t === 2) res.def.push(codeOf[id]); else if (t === 3) res.mid.push(codeOf[id]); else res.fwd.push(codeOf[id]); });
  } catch (e) { /* total */ }
  return res;
}

// ---------------------------------------------------------------- state (§6), D3

function sanitiseState(raw) {
  var out = { version: 87, exported_at: null, entry: null, squad: [], bank: 0, ft: 1, value: 0, confirmed_gw: 0, leagues: [], draft: { league_id: null, roster: [], watchlist: [] }, ui: { mode: "simple", tab: "command", open: {}, reveals: {} }, ledger: [], refresh: { pair: "sonnet46", last: null } };
  try {
    var r = raw;
    if (typeof r === "string") { try { r = JSON.parse(r); } catch (e) { r = null; } }
    if (!isObj(r)) return out;
    out.version = clamp(intOf(r.version, 87), 1, 100000);
    out.exported_at = typeof r.exported_at === "string" ? r.exported_at.slice(0, 40) : null;
    var en = num(r.entry, NaN); out.entry = isFinite(en) && en > 0 ? Math.trunc(en) : null;
    var seen = {};
    arr(r.squad).forEach(function (s) {
      if (out.squad.length >= 15) return;
      var id = idOf(s); if (!isFinite(id) || id <= 0 || id > 1000000 || seen[id]) return;
      var p = isObj(s) ? num(s.purchase, NaN) : NaN;
      seen[id] = true;
      out.squad.push({ id: Math.trunc(id), purchase: isFinite(p) ? clamp(Math.trunc(p), 0, 100000) : null });
    });
    out.bank = clamp(intOf(r.bank, 0), 0, 1000000);
    out.ft = clamp(intOf(r.ft, 1), 0, FT_CAP);
    out.value = clamp(intOf(r.value, 0), 0, 1000000);
    out.confirmed_gw = clamp(intOf(r.confirmed_gw, 0), 0, 38);
    out.leagues = uniq(arr(r.leagues).map(function (x) { return num(x, NaN); }).filter(function (x) { return isFinite(x) && x > 0; }).map(Math.trunc)).slice(0, 50);
    var d = isObj(r.draft) ? r.draft : {};
    var lid = num(d.league_id, NaN); out.draft.league_id = isFinite(lid) && lid > 0 ? Math.trunc(lid) : null;
    out.draft.roster = uniq(arr(d.roster).map(function (x) { return num(x, NaN); }).filter(function (x) { return isFinite(x) && x > 0; }).map(Math.trunc)).slice(0, 15);
    out.draft.watchlist = uniq(arr(d.watchlist).map(function (x) { return num(x, NaN); }).filter(function (x) { return isFinite(x) && x > 0; }).map(Math.trunc)).slice(0, 200);
    if (Array.isArray(d.taken)) out.draft.taken = uniq(d.taken.map(function (x) { return num(x, NaN); }).filter(function (x) { return isFinite(x) && x > 0; }).map(Math.trunc)).slice(0, 400);
    if (typeof d.roster_complete === "boolean") out.draft.roster_complete = d.roster_complete;
    if (typeof d.roster_note === "string") out.draft.roster_note = d.roster_note.slice(0, 600);
    var u = isObj(r.ui) ? r.ui : {};
    out.ui.mode = u.mode === "full" ? "full" : "simple";
    var tabs = ["command", "plan", "squad", "rivals", "draft", "chips", "lab"];
    out.ui.tab = tabs.indexOf(u.tab) >= 0 ? u.tab : "command";
    ["open", "reveals"].forEach(function (k) { var src = isObj(u[k]) ? u[k] : {}; var n = 0; Object.keys(src).forEach(function (key) { if (n++ < 200 && typeof key === "string" && key.length <= 60) out.ui[k][key] = !!src[key]; }); });
    arr(r.ledger).slice(0, 500).forEach(function (row) {
      if (!isObj(row)) return;
      out.ledger.push({ gw: clamp(intOf(row.gw, 0), 0, 38), type: String(row.type === undefined ? "" : row.type).slice(0, 20), pick: row.pick === undefined || row.pick === null ? null : (isFinite(num(row.pick, NaN)) ? num(row.pick) : String(row.pick).slice(0, 40)), alt: row.alt === undefined || row.alt === null ? null : (isFinite(num(row.alt, NaN)) ? num(row.alt) : String(row.alt).slice(0, 40)), xp_pick: num(row.xp_pick, 0), xp_alt: num(row.xp_alt, 0), outcome: row.outcome === undefined || row.outcome === null ? null : num(row.outcome, 0), regret: row.regret === undefined || row.regret === null ? null : num(row.regret, 0) });
    });
    var rf = isObj(r.refresh) ? r.refresh : {};
    out.refresh.pair = REFRESH_PAIRS[rf.pair] ? rf.pair : "sonnet46";
    out.refresh.last = typeof rf.last === "string" ? rf.last.slice(0, 40) : null;
  } catch (e) { /* total: defaults stand */ }
  return out;
}
function detectSquadChange(stateSquadIds, picks) {
  var res = { changed: false, added: [], removed: [], block: false };
  try {
    var mine = uniq(idList(stateSquadIds));
    var list = isObj(picks) && Array.isArray(picks.picks) ? picks.picks : picks;
    var theirs = uniq(arr(list).map(function (p) { return isObj(p) ? num(p.element, NaN) : num(p, NaN); }).filter(isFinite));
    if (!theirs.length) return res;
    var m = {}, t = {}; mine.forEach(function (id) { m[id] = true; }); theirs.forEach(function (id) { t[id] = true; });
    res.added = theirs.filter(function (id) { return !m[id]; });
    res.removed = mine.filter(function (id) { return !t[id]; });
    res.changed = res.added.length > 0 || res.removed.length > 0;
    res.block = res.changed;
  } catch (e) { res.changed = true; res.block = true; }
  return res;
}
function ftAvailable(history, currentEvent, chips) {
  // E-045: the chips list was only ever read from the object form, so ftAvailable(history, n) and
  // ftAvailable(history.current, n) answered differently on the same data and neither said so.
  // Chips now reach this function three ways and the two shapes agree: from the object, from an
  // explicit third argument, and — when neither is given — inferred from the rows themselves,
  // because using more free transfers in one gameweek than the cap of five allows can only be a
  // wildcard or a free hit week.
  try {
    var src = isObj(history) && Array.isArray(history.current) ? history.current : history;
    var rows = arr(src).filter(isObj).map(function (r) { return { event: intOf(r.event, 0), t: Math.max(0, intOf(r.event_transfers, 0)), cost: Math.max(0, intOf(r.event_transfers_cost, 0)) }; }).filter(function (r) { return r.event > 0; }).sort(function (a, b) { return a.event - b.event; });
    var chipSrc = Array.isArray(chips) ? chips : (isObj(history) ? history.chips : null);
    var chipWeeks = {}; arr(chipSrc).forEach(function (c) { if (isObj(c) && (c.name === "wildcard" || c.name === "freehit")) chipWeeks[intOf(c.event, 0)] = true; });
    var cur = intOf(currentEvent, rows.length ? rows[rows.length - 1].event : 0);
    var ft = 1;
    rows.forEach(function (r) {
      if (r.event < 2 || r.event > cur) return;
      var freeUsed = Math.max(0, r.t - Math.floor(r.cost / HIT_COST));
      if (chipWeeks[r.event] || freeUsed > FT_CAP) { ft = Math.min(FT_CAP, ft + 1); return; }
      ft = Math.min(FT_CAP, Math.max(0, ft - freeUsed) + 1);
    });
    return clamp(ft, 1, FT_CAP);
  } catch (e) { return 1; }
}
function sellPrice(now, purchase) {
  var n = Math.max(0, intOf(now, 0)); var p = intOf(purchase, NaN);
  if (!isFinite(p) || p <= 0) return n;
  if (n > p) return p + Math.floor((n - p) / 2);
  return n;
}
function bankAfter(state, moves, els) {
  try {
    var st = sanitiseState(state), E = elMap(els);
    var purchase = {}; st.squad.forEach(function (s) { purchase[s.id] = s.purchase; });
    var bank = st.bank;
    var list = isObj(moves) && !Array.isArray(moves) ? arr(moves.sells).map(function (id) { return { out: id }; }).concat(arr(moves.buys).map(function (id) { return { in: id }; })) : arr(moves);
    list.forEach(function (m) {
      if (!isObj(m)) return;
      var o = num(m.out, NaN), i = num(m.in, NaN);
      if (isFinite(o) && E[o]) bank += sellPrice(num(E[o].now_cost, 0), purchase[o]);
      if (isFinite(i) && E[i]) bank -= num(E[i].now_cost, 0);
    });
    return Math.trunc(bank);
  } catch (e) { return 0; }
}

// ---------------------------------------------------------------- refresh (D4)

function openClosers(piece) {
  if (typeof piece !== "string") return null;
  var stack = [], inStr = false, esc = false;
  for (var i = 0; i < piece.length; i++) {
    var ch = piece[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === "\"") inStr = false; continue; }
    if (ch === "\"") inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") { if (!stack.length || stack[stack.length - 1] !== ch) return null; stack.pop(); }
  }
  return (inStr ? "\"" : "") + stack.reverse().join("");
}
function salvageJson(s) {
  if (typeof s !== "string") return null;
  var cut = s.length;
  for (var attempt = 0; attempt < 80; attempt++) {
    var piece = s.slice(0, cut).replace(/[\s,]+$/, "");
    var closers = openClosers(piece);
    if (closers !== null) {
      try { var v = JSON.parse(piece + closers); if (isObj(v)) return v; } catch (e) { /* keep cutting */ }
      var tail = piece.replace(/:\s*$/, ": null");
      if (tail !== piece) { try { var v2 = JSON.parse(tail + closers); if (isObj(v2)) return v2; } catch (e2) { /* keep cutting */ } }
    }
    var lc = piece.lastIndexOf(",");
    if (lc <= 0) return null;
    cut = lc;
  }
  return null;
}
function stripFences(text) {
  // E-044: the fence strip was global, so it ran INSIDE the JSON string values too and ate the
  // whitespace after each fence — '{"news":"a ``` b"}' came back as {"news":"a b"}. D4 payloads
  // carry news text, which is exactly where a stray fence turns up. Only a fence that opens the
  // reply and a fence that closes it are markup; anything between them is content.
  if (typeof text !== "string") return "";
  var s = text.trim();
  s = s.replace(/^```[a-zA-Z0-9_.+-]*[ \t]*(\r?\n|$)/, "");
  s = s.replace(/(\r?\n|^)[ \t]*```[ \t]*$/, "");
  return s.trim();
}
function parseJson(text) {
  if (typeof text !== "string") throw new Error("parseJson: expected a string, got " + (text === null ? "null" : typeof text));
  var s = stripFences(text);
  var a = s.indexOf("{");
  if (a < 0) throw new Error("parseJson: no JSON object in the reply (" + s.length + " chars: \"" + s.slice(0, 60).replace(/\s+/g, " ") + "\")");
  var b = s.lastIndexOf("}");
  var body = b > a ? s.slice(a, b + 1) : s.slice(a);
  var first;
  try { var v = JSON.parse(body); if (isObj(v)) return v; first = new Error("top-level JSON is not an object"); } catch (e) { first = e; }
  var salvaged = salvageJson(s.slice(a));
  if (salvaged !== null) { salvaged.__salvaged = true; return salvaged; }
  throw new Error("parseJson: " + errMsg(first) + " (reply starts: \"" + s.slice(0, 60).replace(/\s+/g, " ") + "\")");
}
function blocksOf(content) {
  if (Array.isArray(content)) return content;
  if (isObj(content) && Array.isArray(content.content)) return content.content;
  return [];
}
function pickText(contentBlocks) {
  var parts = [];
  blocksOf(contentBlocks).forEach(function (b) { if (isObj(b) && b.type === "text" && typeof b.text === "string") parts.push(b.text); });
  return parts.join("\n");
}
function blockTypes(contentBlocks) {
  var types = blocksOf(contentBlocks).map(function (b) { return isObj(b) && typeof b.type === "string" ? b.type : "unknown"; });
  return types.length ? uniq(types).join(", ") : "none";
}
function refreshRequest(cfg) {
  var c = isObj(cfg) ? cfg : {};
  var key = REFRESH_PAIRS[c.pair] ? c.pair : "sonnet46";
  var pair = REFRESH_PAIRS[key];
  var ids = uniq(idList(c.ids)).slice(0, 60);
  var names = arr(c.names).filter(function (n) { return typeof n === "string"; }).slice(0, 60);
  var gw = intOf(c.nextEvent, 0);
  var who = names.length ? names.join(", ") : (ids.length ? "element ids " + ids.join(", ") : "every player in the two fifteens");
  var prompt = typeof c.prompt === "string" && c.prompt.trim() ? c.prompt : (
    "You are updating a Fantasy Premier League app. Search the official Fantasy Premier League site and this week's club press conferences" +
    (gw ? " for Gameweek " + gw : "") + " and report, for these players: " + who + ". " +
    "Reply with one JSON object and nothing else, in this exact shape: " +
    "{\"fetched_at\":\"<ISO-8601 UTC>\",\"deadline_time\":\"<ISO-8601 UTC of the next deadline>\"," +
    "\"elements\":[{\"id\":<FPL element id>,\"web_name\":\"<name>\",\"status\":\"a|d|i|s|u|n\",\"chance\":<0-100 or null>,\"news\":\"<short>\",\"now_cost\":<price in tenths, e.g. 77>}]}. " +
    "Use the element id as the key, never the name. Leave a field out if you could not verify it. No prose, no code fences.");
  return { model: pair.model, max_tokens: REFRESH_MAX_TOKENS, tools: [{ type: pair.tool, name: "web_search" }], messages: [{ role: "user", content: prompt }], pair: key, ids: ids, warning: REFRESH_PAIRS[c.pair] ? null : "unknown pair " + (typeof c.pair === "string" && c.pair ? "'" + c.pair + "'" : "(none given)") + ", using sonnet46" };
}
function applyRefresh(state, parsed) {
  if (!isObj(parsed)) throw new Error("applyRefresh: refresh payload is not an object");
  if (parsed.type === "error" || isObj(parsed.error)) throw new Error("applyRefresh: " + (isObj(parsed.error) && parsed.error.message ? parsed.error.message : "the reply was an error object"));
  var elements = Array.isArray(parsed.elements) ? parsed.elements : (Array.isArray(parsed.players) ? parsed.players : null);
  if (!elements) throw new Error("applyRefresh: no elements array in the refresh");
  var live = isObj(state) && Array.isArray(state.elements) ? state : (isObj(state) && isObj(state.live) && Array.isArray(state.live.elements) ? state.live : null);
  if (!live) throw new Error("applyRefresh: state carries no live snapshot to update");
  var byId = {}; live.elements.forEach(function (el) { if (isObj(el)) byId[el.id] = el; });
  var updates = {}, skipped = [], applied = 0;
  elements.forEach(function (u) {
    if (!isObj(u)) { skipped.push("non-object entry"); return; }
    var id = num(u.id, NaN);
    if (!isFinite(id)) { skipped.push("no element id for " + String(u.web_name || "?")); return; }
    if (!byId[id]) { skipped.push("unknown element id " + id); return; }
    var patch = {};
    if (u.status !== undefined && u.status !== null) { var st = String(u.status).toLowerCase(); if (st.length !== 1 || "adisun".indexOf(st) < 0) throw new Error("applyRefresh: bad status \"" + String(u.status) + "\" for id " + id); patch.status = st; }
    if (u.chance !== undefined) { if (u.chance === null) patch.chance = null; else { var ch = num(u.chance, NaN); if (!isFinite(ch)) throw new Error("applyRefresh: bad chance \"" + String(u.chance) + "\" for id " + id); patch.chance = clamp(Math.round(ch), 0, 100); } }
    if (u.news !== undefined && u.news !== null) patch.news = String(u.news).slice(0, 300);
    if (u.now_cost !== undefined && u.now_cost !== null) { var nc = num(u.now_cost, NaN); if (!isFinite(nc) || nc < 30 || nc > 250) throw new Error("applyRefresh: bad now_cost \"" + String(u.now_cost) + "\" for id " + id); patch.now_cost = Math.round(nc); }
    if (Object.keys(patch).length) { updates[id] = patch; applied++; } else skipped.push("nothing verifiable for id " + id);
  });
  if (!applied) throw new Error("applyRefresh: nothing applied (" + (skipped.slice(0, 3).join("; ") || "empty elements") + ")");
  var newElements = live.elements.map(function (el) {
    if (!isObj(el) || !updates[el.id]) return el;
    var p = updates[el.id], n = {};
    Object.keys(el).forEach(function (k) { n[k] = el[k]; });
    Object.keys(p).forEach(function (k) { n[k] = p[k]; });
    if (p.now_cost !== undefined) n.cost_change_event = num(el.cost_change_event, 0) + (p.now_cost - num(el.now_cost, 0));
    return n;
  });
  var newLive = {};
  Object.keys(live).forEach(function (k) { newLive[k] = live[k]; });
  newLive.elements = newElements;
  if (typeof parsed.fetched_at === "string" && isFinite(Date.parse(parsed.fetched_at))) newLive.fetched_at = parsed.fetched_at;
  if (typeof parsed.deadline_time === "string" && isFinite(Date.parse(parsed.deadline_time)) && Array.isArray(live.events)) {
    var nextId = intOf(live.next_event, 0);
    newLive.events = live.events.map(function (e) { if (!isObj(e) || intOf(e.id, -1) !== nextId) return e; var ne = {}; Object.keys(e).forEach(function (k) { ne[k] = e[k]; }); ne.deadline_time = parsed.deadline_time; return ne; });
  }
  newLive.refreshed = { applied: applied, skipped: skipped, at: newLive.fetched_at || null, salvaged: parsed.__salvaged === true };
  if (live === state) return newLive;
  var ns = {}; Object.keys(state).forEach(function (k) { ns[k] = state[k]; }); ns.live = newLive;
  return ns;
}

// ---------------------------------------------------------------- Monte Carlo (E4)

function mulberry32(seed) {
  var a = (intOf(seed, 1) | 0) >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngOf(rng) { return typeof rng === "function" ? rng : mulberry32(1); }
function poisson(lambda, rng) {
  if (typeof rng !== "function") return 0;
  lambda = num(lambda, 0); if (lambda <= 0) return 0;
  if (lambda > 25) { var u1 = Math.max(1e-12, rng()), u2 = rng(); return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2))); }
  var L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L && k < 60);
  return k - 1;
}
// n is capped: nothing in this game draws more than a few hundred Bernoulli trials, and an
// uncapped n from a corrupt input is an unbounded loop, not a bad number (poisson is already
// capped at 60 draws).
function binomial(n, p, rng) { var k = 0; if (typeof rng !== "function") return 0; n = clamp(intOf(n, 0), 0, BINOMIAL_MAX_N); p = clamp(p, 0, 1); for (var i = 0; i < n; i++) if (rng() < p) k++; return k; }
function posRates(ctx) {
  if (!isObj(ctx)) return { 1: { xg90: 0, xa90: 0, sv90: 0 }, 2: { xg90: 0, xa90: 0, sv90: 0 }, 3: { xg90: 0, xa90: 0, sv90: 0 }, 4: { xg90: 0, xa90: 0, sv90: 0 } };
  if (ctx._posRates) return ctx._posRates;
  var acc = { 1: { m: 0, xg: 0, xa: 0, sv: 0 }, 2: { m: 0, xg: 0, xa: 0, sv: 0 }, 3: { m: 0, xg: 0, xa: 0, sv: 0 }, 4: { m: 0, xg: 0, xa: 0, sv: 0 } };
  arr(ctx.elList).forEach(function (el) { var t = elType(el); if (!t) return; acc[t].m += num(el.minutes, 0); acc[t].xg += num(el.xg, 0); acc[t].xa += num(el.xa, 0); acc[t].sv += num(el.saves, 0); });
  var out = {}; [1, 2, 3, 4].forEach(function (t) { var m = acc[t].m; out[t] = { xg90: m ? acc[t].xg / m * 90 : 0, xa90: m ? acc[t].xa / m * 90 : 0, sv90: m ? acc[t].sv / m * 90 : 0 }; });
  ctx._posRates = out; return out;
}
function playerRates(el, ctx) {
  if (!isObj(ctx)) ctx = {};
  if (!isObj(el)) el = {};
  var base = isObj(ctx.baseRates) ? ctx.baseRates : { yc: 0 };
  var t = elType(el), pr = posRates(ctx)[t] || { xg90: 0, xa90: 0, sv90: 0 };
  var m = num(el.minutes, 0), w = m / (m + 270);
  var r = function (v, prior) { return w * (m ? num(v, 0) / m * 90 : 0) + (1 - w) * prior; };
  return { xg90: r(el.xg, pr.xg90), xa90: r(el.xa, pr.xa90), sv90: t === 1 ? r(el.saves, pr.sv90) : 0, yc90: Math.max(num(base.yc, 0), m ? num(el.yc, 0) / m * 90 : 0) };
}
function likelyXI(teamId, ctx) {
  if (!isObj(ctx) || !Array.isArray(ctx.elList) || !isObj(ctx.xp)) return [];
  ctx._likely = ctx._likely || {};
  if (ctx._likely[teamId]) return ctx._likely[teamId];
  var list = ctx.elList.filter(function (el) { return num(el.team, -1) === teamId && ctx.xp[el.id] && ctx.xp[el.id].pstart >= 0.5; })
    .sort(function (a, b) { return ctx.xp[b.id].pstart - ctx.xp[a.id].pstart; }).slice(0, 11)
    .map(function (el) { var gs = ctx.gwStats[el.id] || { played: 0, bpsSum: 0 }; return { id: el.id, bps: gs.played ? gs.bpsSum / gs.played : num(el.bps, 0) / Math.max(1, num(el.starts, 0)) }; });
  ctx._likely[teamId] = list; return list;
}
function simFixture(fixture, ctx, rng) {
  var out = { h: 0, a: 0, bonus: {} };
  try {
    if (!okCtx(ctx) || !isObj(fixture)) return out;
    var R = rngOf(rng), h = num(fixture.team_h, -1), a = num(fixture.team_a, -1);
    out.h = poisson(tsXg(h, a, true, ctx.TS), R); out.a = poisson(tsXg(a, h, false, ctx.TS), R);
    var cand = likelyXI(h, ctx).concat(likelyXI(a, ctx)).map(function (p) { return { id: p.id, bps: p.bps * (0.5 + R()) }; });
    cand.sort(function (x, y) { return y.bps - x.bps; });
    if (cand[0]) out.bonus[cand[0].id] = 3; if (cand[1]) out.bonus[cand[1].id] = 2; if (cand[2]) out.bonus[cand[2].id] = 1;
  } catch (e) { /* total */ }
  return out;
}
function simPlayerDetail(el, ctx, rng, draws) {
  var res = { pts: 0, mins: 0 };
  if (!isObj(el) || !okCtx(ctx)) return res;
  var R = rngOf(rng), t = elType(el); if (!t) return res;
  var x = ctx.xp[el.id] || { pstart: pStart(el, ctx.gwStats) };
  var gs = ctx.gwStats[el.id] || { dcRate: 0, bonusRate: 0 };
  var team = num(el.team, -1), fx = arr(ctx.fixturesByEvent[ctx.nextEvent]).filter(function (f) { return num(f.team_h, -1) === team || num(f.team_a, -1) === team; });
  if (!fx.length) return res;
  var rates = playerRates(el, ctx), S = SCORING[t];
  fx.forEach(function (f) {
    if (R() >= x.pstart) return;                                      // did not start: 0 minutes
    var mins = R() < 0.85 ? 60 + Math.floor(R() * 31) : 1 + Math.floor(R() * 59);
    var home = num(f.team_h, -1) === team, opp = home ? num(f.team_a, -1) : num(f.team_h, -1);
    var draw = isObj(draws) ? draws[f.id] : null;
    var mult = tsMult(team, opp, home, ctx.TS), frac = mins / 90;
    var teamGoals, oppGoals, goals, assists;
    if (isObj(draw)) {
      teamGoals = home ? num(draw.h, 0) : num(draw.a, 0); oppGoals = home ? num(draw.a, 0) : num(draw.h, 0);
      goals = binomial(teamGoals, rates.xg90 * frac / ctx.Lbar, R);
      assists = binomial(teamGoals - goals, rates.xa90 * frac / ctx.Lbar, R);
    } else {
      var lamOpp = tsXg(opp, team, !home, ctx.TS);
      goals = poisson(rates.xg90 * frac * mult, R); assists = poisson(rates.xa90 * frac * mult, R);
      oppGoals = poisson(lamOpp, R); teamGoals = goals;
    }
    var cs = mins >= 60 && oppGoals === 0 ? 1 : 0;
    var gc = mins >= 60 ? oppGoals : Math.floor(oppGoals * frac);
    var dc = S.dc_threshold && R() < num(gs.dcRate, 0) ? S.dc_threshold : 0;
    var saves = t === 1 ? poisson(rates.sv90 * frac * tsMult(opp, team, !home, ctx.TS), R) : 0;
    var yc = R() < rates.yc90 * frac ? 1 : 0, rc = R() < ctx.baseRates.rc * frac ? 1 : 0, og = R() < ctx.baseRates.og * frac ? 1 : 0;
    var bonus = isObj(draw) && isObj(draw.bonus) ? num(draw.bonus[el.id], 0) : (R() < clamp(num(gs.bonusRate, 0), 0, 1) ? 1 + Math.floor(R() * 3) : 0);
    var row = { minutes: mins, goals: goals, assists: assists, cs: cs, gc: gc, bonus: bonus, yc: yc, rc: rc, og: og, pen_miss: 0, pen_save: 0, saves: saves, dc: dc };
    res.pts += pointsFor(row, t); res.mins += mins;
  });
  return res;
}
function simPlayer(el, ctx, rng, draws) { return simPlayerDetail(el, ctx, rng, draws).pts; }
function fixtureDraws(ctx, rng) { var d = {}; if (!isObj(ctx) || !isObj(ctx.fixturesByEvent) || typeof rng !== "function") return d; arr(ctx.fixturesByEvent[ctx.nextEvent]).forEach(function (f) { d[f.id] = simFixture(f, ctx, rng); }); return d; }
function entryPoints(xi, bench, capId, viceId, sims, ctx) {
  // xi: 11 ids in order; bench: [gkSub, b1, b2, b3] in order; sims: {id:{pts,mins}}
  if (!okCtx(ctx)) return 0;
  if (!isObj(sims)) sims = {};
  var total = 0, starters = arr(xi).slice(), benchLeft = arr(bench).slice();
  var counts = posCounts(starters, ctx.els);
  starters.forEach(function (id, i) {
    var s = sims[id] || { pts: 0, mins: 0 };
    if (s.mins > 0) return;
    var st = elType(ctx.els[id]);
    for (var j = 0; j < benchLeft.length; j++) {
      var b = benchLeft[j], bs = sims[b] || { pts: 0, mins: 0 }; if (bs.mins <= 0) continue;
      var bt = elType(ctx.els[b]);
      if (st === 1 || bt === 1) { if (st !== bt) continue; }
      else { var c = { 2: counts[2], 3: counts[3], 4: counts[4] }; c[st]--; c[bt]++; if (!(c[2] >= 3 && c[3] >= 2 && c[4] >= 1)) continue; counts = c; }
      starters[i] = b; benchLeft.splice(j, 1); break;
    }
  });
  starters.forEach(function (id) { total += (sims[id] || { pts: 0 }).pts; });
  var cap = capId, capS = sims[cap] || { pts: 0, mins: 0 };
  if (capS.mins <= 0 && viceId) { cap = viceId; capS = sims[cap] || { pts: 0, mins: 0 }; }
  if (cap && starters.indexOf(cap) >= 0 && capS.mins > 0) total += capS.pts;
  return total;
}
function squadOrder(ids, capId, ctx) {
  if (!okCtx(ctx)) return null;
  var list = uniq(idList(ids)).filter(function (id) { return ctx.els[id]; });
  var xi, bench;
  if (list.length === 11 && legalXI(list, ctx.els).ok) { xi = list; bench = []; }
  else if (list.length === 15 && legalXI(list.slice(0, 11), ctx.els).ok) { xi = list.slice(0, 11); bench = list.slice(11); }
  else { var bx = bestXI(list, ctx); if (!bx.ids.length) return null; xi = bx.ids; var gk = bx.bench.filter(function (id) { return elType(ctx.els[id]) === 1; }); bench = gk.concat(benchOrder(list, xi, ctx)); if (!capId) capId = bx.capId; }
  var cap = num(capId, NaN); if (!isFinite(cap) || xi.indexOf(cap) < 0) { var c = captainPick(xi, ctx); cap = c.capId; }
  return { xi: xi, bench: bench, cap: cap };
}
function mcSquad(ids, capId, ctx, iters, seed, viceId) {
  var res = { mean: 0, sd: 0, q10: 0, q50: 0, q90: 0, iters: 0 };
  try {
    if (!okCtx(ctx)) return res;
    var so = squadOrder(ids, capId, ctx); if (!so) return res;
    var vice = num(viceId, NaN); if (!isFinite(vice) || so.xi.indexOf(vice) < 0) vice = null;
    // E-046: iters 0 or negative used to become a single draw reported with the full shape of a
    // converged distribution — mean, sd 0, and three identical quantiles. The count is floored at
    // MC_MIN_ITERS so one draw can never be presented as a distribution.
    var n = clamp(intOf(iters, 1000), MC_MIN_ITERS, 20000), R = mulberry32(intOf(seed, 1));
    var all = so.xi.concat(so.bench), totals = [];
    for (var i = 0; i < n; i++) {
      var draws = fixtureDraws(ctx, R), sims = {};
      all.forEach(function (id) { sims[id] = simPlayerDetail(ctx.els[id], ctx, R, draws); });
      totals.push(entryPoints(so.xi, so.bench, so.cap, vice, sims, ctx));
    }
    var mean = sum(totals) / n, v = 0; totals.forEach(function (t) { v += (t - mean) * (t - mean); });
    totals.sort(sortNum);
    res.mean = mean; res.sd = Math.sqrt(v / n); res.q10 = quantile(totals, 0.1); res.q50 = quantile(totals, 0.5); res.q90 = quantile(totals, 0.9); res.iters = n;
  } catch (e) { /* total */ }
  return res;
}
function mcLeague(ctx, leagueId, opts) {
  var res = { leagueId: null, name: "", entries: 0, rivalsSimulated: 0, missingPicks: 0, currentRank: null, medianRank: null, rankBand: [null, null], direction: "hold", gwsOfData: 0, pWin: null, pWinNote: "", iters: 0, note: "" };
  try {
    if (!okCtx(ctx)) return res;
    var o = isObj(opts) ? opts : {};
    var L = ctx.leagues.filter(function (l) { return num(l.id, NaN) === num(leagueId, NaN); })[0];
    if (!L) { res.note = "league not in the snapshot"; return res; }
    res.leagueId = num(L.id); res.name = String(L.name || ""); res.gwsOfData = ctx.finishedGws.length;
    var me = ctx.live.entry ? num(ctx.live.entry.id, NaN) : NaN;
    var rivals = isObj(ctx.live.rivals) ? ctx.live.rivals : {};
    var mine = squadOrder(o.ids && o.ids.length ? o.ids : (ctx.picks.length ? ctx.picks.slice().sort(function (a, b) { return num(a.position, 0) - num(b.position, 0); }).map(function (p) { return p.element; }) : ctx.squadIds), o.capId, ctx);
    if (!mine) { res.note = "no legal squad to simulate"; return res; }
    var vice = num(o.viceId, NaN); if (!isFinite(vice)) vice = null;
    var entries = [];
    arr(L.standings).forEach(function (r) {
      if (!isObj(r)) return;
      var e = num(r.entry, NaN); if (!isFinite(e)) return;
      var row = { entry: e, total: num(r.total, 0), rank: num(r.rank, 0), me: e === me, xi: null, bench: [], cap: null };
      if (row.me) { row.xi = mine.xi; row.bench = mine.bench; row.cap = mine.cap; }
      else if (rivals[e] && Array.isArray(rivals[e].picks)) {
        var pk = rivals[e].picks.filter(isObj).slice().sort(function (a, b) { return num(a.position, 0) - num(b.position, 0); });
        var ids = pk.map(function (p) { return num(p.element, NaN); }).filter(function (id) { return isFinite(id) && ctx.els[id]; });
        if (ids.length >= 11 && legalXI(ids.slice(0, 11), ctx.els).ok) { row.xi = ids.slice(0, 11); row.bench = ids.slice(11); var capP = pk.filter(function (p) { return p.is_captain === true || num(p.multiplier, 1) >= 2; })[0]; row.cap = capP ? num(capP.element) : null; }
      }
      entries.push(row);
    });
    if (!entries.some(function (e) { return e.me; })) entries.push({ entry: me, total: num(ctx.live.entry && ctx.live.entry.summary_overall_points, 0), rank: entries.length + 1, me: true, xi: mine.xi, bench: mine.bench, cap: mine.cap });
    res.entries = entries.length; res.rivalsSimulated = entries.filter(function (e) { return !e.me && e.xi; }).length; res.missingPicks = entries.filter(function (e) { return !e.xi; }).length;
    var meRow = entries.filter(function (e) { return e.me; })[0]; res.currentRank = meRow.rank || null;
    var n = clamp(intOf(o.iters, 500), 1, 20000), R = mulberry32(intOf(o.seed, 7));
    var union = {}; entries.forEach(function (e) { if (e.xi) e.xi.concat(e.bench).forEach(function (id) { union[id] = true; }); });
    var unionIds = Object.keys(union).map(Number);
    var ranks = [], wins = 0;
    for (var i = 0; i < n; i++) {
      var draws = fixtureDraws(ctx, R), sims = {};
      unionIds.forEach(function (id) { sims[id] = simPlayerDetail(ctx.els[id], ctx, R, draws); });
      var pts = entries.map(function (e) { return e.xi ? entryPoints(e.xi, e.bench, e.cap, e.me ? vice : null, sims, ctx) : null; });
      var known = pts.filter(function (p) { return p !== null; }); var fill = known.length ? sum(known) / known.length : 0;
      var totals = entries.map(function (e, j) { return e.total + (pts[j] === null ? fill : pts[j]); });
      var myTotal = totals[entries.indexOf(meRow)];
      var rank = 1; totals.forEach(function (t, j) { if (entries[j] !== meRow && t > myTotal) rank++; });
      ranks.push(rank); if (rank === 1) wins++;
    }
    ranks.sort(sortNum);
    res.medianRank = quantile(ranks, 0.5); res.rankBand = [quantile(ranks, 0.1), quantile(ranks, 0.9)]; res.iters = n;
    res.direction = res.currentRank === null ? "hold" : (res.medianRank < res.currentRank - 0.5 ? "up" : (res.medianRank > res.currentRank + 0.5 ? "down" : "hold"));
    if (res.gwsOfData >= MC_MIN_GWS_FOR_PWIN) { res.pWin = wins / n; res.pWinNote = "P(win) shown: " + res.gwsOfData + " gameweeks of data"; }
    else res.pWinNote = "Direction and rank band only: " + res.gwsOfData + " of the " + MC_MIN_GWS_FOR_PWIN + " gameweeks needed before a win probability is reported";
    res.note = "One-gameweek simulation against the rivals' actual GW" + ctx.currentEvent + " picks; entries without picks data score the simulated field mean.";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- tournament (E5)

function ranksOf(v) {
  v = arr(v);
  var idx = v.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x - b.x; });
  var r = new Array(v.length), i = 0;
  while (i < idx.length) { var j = i; while (j + 1 < idx.length && idx[j + 1].x === idx[i].x) j++; var avg = (i + j) / 2 + 1; for (var k = i; k <= j; k++) r[idx[k].i] = avg; i = j + 1; }
  return r;
}
function spearman(a, b) {
  try {
    var x = arr(a).map(function (v) { return num(v, NaN); }), y = arr(b).map(function (v) { return num(v, NaN); });
    var n = Math.min(x.length, y.length), px = [], py = [];
    for (var i = 0; i < n; i++) if (isFinite(x[i]) && isFinite(y[i])) { px.push(x[i]); py.push(y[i]); }
    if (px.length < 3) return 0;
    var rx = ranksOf(px), ry = ranksOf(py), mx = sum(rx) / rx.length, my = sum(ry) / ry.length, sxy = 0, sxx = 0, syy = 0;
    for (var j = 0; j < rx.length; j++) { sxy += (rx[j] - mx) * (ry[j] - my); sxx += (rx[j] - mx) * (rx[j] - mx); syy += (ry[j] - my) * (ry[j] - my); }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  } catch (e) { return 0; }
}
function mae(a, b) {
  try {
    var x = arr(a), y = arr(b), n = Math.min(x.length, y.length), s = 0, c = 0;
    for (var i = 0; i < n; i++) { var u = num(x[i], NaN), v = num(y[i], NaN); if (isFinite(u) && isFinite(v)) { s += Math.abs(u - v); c++; } }
    return c ? s / c : 0;
  } catch (e) { return 0; }
}
function calibrateToPoints(pred, actual) {
  // E-047: MAE is only comparable across models when every predictor is in the same units. BPS
  // per 90 runs about ten times points per 90, so the raw column ranked units, not accuracy
  // (bps_rate 11.23 against component_xp 2.43 on the GW4 snapshot). Each predictor is rescaled by
  // mean(points) / mean(prediction) over the gameweek it was fitted on before the MAE is taken.
  // Spearman is scale-invariant and is left exactly as it was.
  var res = { scale: 1, calibrated: false, pred: arr(pred).slice() };
  var p = arr(pred), a = arr(actual), n = Math.min(p.length, a.length), sp = 0, sa = 0, c = 0;
  for (var i = 0; i < n; i++) {
    var u = num(p[i], NaN), v = num(a[i], NaN);
    if (isFinite(u) && isFinite(v)) { sp += u; sa += v; c++; }
  }
  if (!c || Math.abs(sp) < 1e-9) return res;                       // a zero mean cannot be scaled
  var k = sa / sp;
  if (!isFinite(k) || k <= 0) return res;
  res.scale = k; res.calibrated = true;
  res.pred = p.map(function (x) { return num(x, 0) * k; });
  return res;
}
function tournament(live) {
  var res = { models: TOURNAMENT_MODELS.map(function (m) { return { key: m.key, name: m.name, spearman: null, mae: null, maeRaw: null, maeScale: null, maeCalibrated: false, transitions: 0 }; }), leader: null, promotable: false, transitions: 0, maeUnits: "points", maeNote: "", note: "" };
  try {
    if (!isObj(live) || !isObj(live.gw)) { res.note = "no finished gameweeks in the snapshot"; return res; }
    var keys = Object.keys(live.gw).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum);
    var types = {}; arr(live.elements).forEach(function (el) { if (isObj(el)) types[el.id] = elType(el); });
    var acc = {};                                                       // cumulative per element
    var scores = {}; TOURNAMENT_MODELS.forEach(function (m) { scores[m.key] = { rho: [], mae: [], raw: [], scale: [], uncal: 0 }; });
    for (var i = 0; i < keys.length; i++) {
      var g = keys[i], rows = isObj(live.gw[g]) && isObj(live.gw[g].elements) ? live.gw[g].elements : {};
      if (i > 0) {
        var preds = {}; TOURNAMENT_MODELS.forEach(function (m) { preds[m.key] = []; }); var actual = [];
        Object.keys(rows).forEach(function (id) {
          var a = acc[id]; if (!a || !a.played) return;
          var row = rows[id]; if (!Array.isArray(row) || num(row[0], 0) <= 0) return;
          var t = types[id] || 3, S = SCORING[t];
          var seasonMean = a.pts / a.played, per90 = a.min ? a.pts / a.min * 90 : 0, w = a.played / (a.played + SHRINK_K);
          var shrunk = w * per90 + (1 - w) * (PRIOR_PPS[t] || 3.5);
          var bps = a.bps / a.played, ict = a.ict / a.played;
          var component = (a.min / a.played >= 60 ? 2 : 1) + a.xg / a.played * S.goal + a.xa / a.played * S.assist + a.cs / a.played * S.cs + (a.gc / a.played) / 2 * S.gc_per2 + a.dcHits / a.played * S.dc + a.bonus / a.played;
          preds.season_mean.push(seasonMean); preds.last_gw.push(a.last); preds.per90.push(per90); preds.shrunk_per90.push(shrunk);
          preds.ict_rate.push(ict); preds.bps_rate.push(bps); preds.blend.push((seasonMean + shrunk + bps / 10) / 3); preds.component_xp.push(component);
          actual.push(num(row[2], 0));
        });
        if (actual.length >= 10) TOURNAMENT_MODELS.forEach(function (m) {
          var S = scores[m.key];
          S.rho.push(spearman(preds[m.key], actual));
          var cal = calibrateToPoints(preds[m.key], actual);
          S.mae.push(mae(cal.pred, actual));
          S.raw.push(mae(preds[m.key], actual));
          S.scale.push(cal.scale);
          if (!cal.calibrated) S.uncal++;
        });
      }
      Object.keys(rows).forEach(function (id) {
        var row = rows[id]; if (!Array.isArray(row)) return;
        var a = acc[id] = acc[id] || { played: 0, min: 0, pts: 0, xg: 0, xa: 0, cs: 0, gc: 0, dcHits: 0, bps: 0, ict: 0, bonus: 0, last: 0 };
        if (num(row[0], 0) > 0) { a.played++; a.min += num(row[0], 0); a.pts += num(row[2], 0); a.xg += num(row[3], 0); a.xa += num(row[4], 0); a.cs += num(row[11], 0); a.gc += num(row[12], 0); a.bps += num(row[7], 0); a.ict += num(row[8], 0); a.bonus += num(row[13], 0); var thr = SCORING[types[id] || 3].dc_threshold; if (thr && num(row[6], 0) >= thr) a.dcHits++; }
        a.last = num(row[2], 0);
      });
      Object.keys(acc).forEach(function (id) { if (!rows[id]) acc[id].last = 0; });
    }
    res.models.forEach(function (m) {
      var s = scores[m.key]; m.transitions = s.rho.length;
      if (!s.rho.length) return;
      m.spearman = sum(s.rho) / s.rho.length;
      m.mae = sum(s.mae) / s.mae.length;
      m.maeRaw = sum(s.raw) / s.raw.length;
      m.maeScale = sum(s.scale) / s.scale.length;
      m.maeCalibrated = s.uncal === 0;
    });
    res.maeNote = "MAE is reported in points: each predictor is rescaled by mean(points) / mean(prediction) over the gameweek it was fitted on, so the column ranks accuracy and not units. maeRaw keeps the unscaled figure. Spearman needs no rescaling.";
    res.transitions = Math.max.apply(null, [0].concat(res.models.map(function (m) { return m.transitions; })));
    var ranked = res.models.filter(function (m) { return m.spearman !== null; }).sort(function (a, b) { return b.spearman - a.spearman || a.mae - b.mae; });
    res.leader = ranked.length ? ranked[0].key : null;
    res.promotable = res.transitions >= TOURNAMENT_PROMOTE_AT;
    res.note = res.transitions ? (res.transitions + " walk-forward transition" + (res.transitions === 1 ? "" : "s") + "; promotion needs " + TOURNAMENT_PROMOTE_AT) : "fewer than two finished gameweeks: no transition to score";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- exports

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ENGINE_VERSION: ENGINE_VERSION, SCORING: SCORING, REFRESH_PAIRS: REFRESH_PAIRS, DECAY: DECAY, PRIOR_PPS: PRIOR_PPS, FORMATIONS: FORMATIONS, SQUAD_SHAPE: SQUAD_SHAPE, POS_NAME: POS_NAME, TOURNAMENT_MODELS: TOURNAMENT_MODELS,
    num: num, intOf: intOf, clamp: clamp, isObj: isObj, kindOf: kindOf, arr: arr, errMsg: errMsg, okCtx: okCtx, idOf: idOf, idList: idList, elMap: elMap, elType: elType, uniq: uniq, sum: sum, sortNum: sortNum, quantile: quantile, nowMs: nowMs, combos: combos,
    rowStat: rowStat, pointsFor: pointsFor, draftScoring: draftScoring, gwPoints: gwPoints,
    clubCounts: clubCounts, posCounts: posCounts, legal15: legal15, legalXI: legalXI, formationOf: formationOf,
    shrunkPps: shrunkPps, flagInfo: flagInfo, isFlagged: isFlagged, statsFor: statsFor, pStart: pStart, fxMult: fxMult, fxMultInfo: fxMultInfo, teamMults: teamMults, xp5FromMults: xp5FromMults, xp1With: xp1With, xp5With: xp5With, xp1: xp1, xp5: xp5,
    teamStrength: teamStrength, tsEntry: tsEntry, tsXg: tsXg, tsMult: tsMult, tsPcs: tsPcs, overUnderTags: overUnderTags, runAvg: runAvg,
    elementGwStats: elementGwStats, rivalPickShares: rivalPickShares, rivalOwn: rivalOwn, capShare: capShare, rivalOwnMax: rivalOwnMax, convergenceRisk: convergenceRisk, classify: classify,
    gamePhase: gamePhase, buildCtx: buildCtx,
    tierOf: tierOf, pickXI: pickXI, captainPick: captainPick, bestXI: bestXI, benchOrder: benchOrder, sellCandidates: sellCandidates, transferProtocol: transferProtocol,
    wcObjective: wcObjective, wcPool: wcPool, wcCost: wcCost, wcSetup: wcSetup, wcFeasible: wcFeasible, wcSolve: wcSolve, wcLocalOptimum: wcLocalOptimum,
    wildcardSolver: wildcardSolver, elName: elName, writtenFifteen: writtenFifteen, wildcardOptions: wildcardOptions, wildcardTiming: wildcardTiming, chipWindows: chipWindows, chipRegret: chipRegret,
    draftEl: draftEl, draftEV: draftEV, draftWaivers: draftWaivers, watchlistAudit: watchlistAudit, draftXI: draftXI,
    sanitiseState: sanitiseState, detectSquadChange: detectSquadChange, ftAvailable: ftAvailable, sellPrice: sellPrice, bankAfter: bankAfter,
    openClosers: openClosers, salvageJson: salvageJson, stripFences: stripFences, parseJson: parseJson, blocksOf: blocksOf, pickText: pickText, blockTypes: blockTypes, refreshRequest: refreshRequest, applyRefresh: applyRefresh,
    mulberry32: mulberry32, rngOf: rngOf, poisson: poisson, binomial: binomial, posRates: posRates, playerRates: playerRates, likelyXI: likelyXI, simFixture: simFixture, simPlayerDetail: simPlayerDetail, simPlayer: simPlayer, fixtureDraws: fixtureDraws, entryPoints: entryPoints, squadOrder: squadOrder, mcSquad: mcSquad, mcLeague: mcLeague,
    ranksOf: ranksOf, spearman: spearman, mae: mae, calibrateToPoints: calibrateToPoints, tournament: tournament
  };
}

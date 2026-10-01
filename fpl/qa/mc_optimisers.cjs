#!/usr/bin/env node
/*
 * qa/mc_optimisers.cjs — the searches respect the rules they are given, and what ships is what they return
 * (v110 §5 B4, B7, E1 "optimisers"; the kit's qa.js group 8, lines 128–146, with the waiver lines 165–169, the
 * claims-sheet lines 221–230, the price-stress lines 246–248 and the plan-versus-greedy line 196).
 *
 *   node qa/mc_optimisers.cjs
 *
 * WHAT IT PROVES, on data/mc_data.json, data/plan.json and data/pre.json through src/mc_engine.js and
 * src/mc_analysis.js
 *   Classic transfers (the greedy search, up to min(free transfers, cap) moves, as src/mc_analysis.js runs it):
 *     inside the budget with the bank replayed from selling and buying prices; like for like; at most three a club;
 *     never buying a player already owned, nor the same player twice; every move improving the horizon; the squad
 *     worth more after them; no more moves than the free transfers allow — and data/pre.json's transfers are this
 *     search's answer, field for field
 *   Classic wildcard (the heuristic, the kit's 18 per position): fifteen, 2/5/5/3, inside the budget the selling
 *     prices give, at most three a club, nobody ruled out, its cost the sum of its prices, and it beats the squad
 *     it replaces
 *   The solved plan beats the quick greedy search (kit 196, within the kit's one point)
 *   Draft moves: ranked by what they add; each adds a claimable player and drops one of mine; a shortlist never
 *     uses a player twice nor adds and drops the same man
 *   Waivers: only the managers ahead of me in the order are treated as rivals for claims, and their likely claims
 *     are real free players dropping their own; data/pre.json's moves, managers ahead and backups are this search's
 *   The claims sheet (data/pre.json, and rebuilt here): every line adds a claimable player and drops one of mine,
 *     like for like; nobody asked for twice; each backup sits under a first choice for the same drop and is wanted
 *     by no rival; no flagged player lodged and every held-back pair flagged (Part N2 "Flags before claims"); each
 *     gain measured to the Draft horizon (E-126); the stress-test value between today's and the all-land ceiling;
 *     the ordering kept is the one the deterministic stress test values higher, with the four Monte Carlo
 *     orderings reported beside it (Part N2 "Lodging order"); every landing chance a probability; a first choice
 *     and its backup never landing more than once between them; the expected roster between today and the
 *     ceiling; the stress-test roster 2/5/5/3 — and the sheet is buildClaimSheet's answer on the shipped data
 *   Trades: data/pre.json's trades are this search's, split both-gain first, and every trade meets the thresholds
 *   Price watch (on the plan's first week, with the bank from PLAN.replay, never the solver's field — §6): the
 *     shortfall is never negative, and a suggested fix is like for like, frees enough and keeps the club cap
 *
 * WHERE THE KIT AND THE REPO DIFFER, ON PURPOSE
 *   The kit (qa.js 226) kept whichever of four orderings had the highest Monte Carlo mean. The repo's rule (Part N2,
 *   "Lodging order") keeps the order that lands the most value under the league's own processing — the
 *   deterministic stress test decides — and reports the Monte Carlo orderings beside it. This suite holds the
 *   repo's rule and prints both numbers.
 *
 * ALREADY PROVED ELSEWHERE, CITED AND NOT PORTED TWICE
 *   golden greedy transfers move for move, the claims sheet against golden and the reference line for line .. qa/parity.cjs B4, B7
 *   every week of the solved plan legal; the plan at least as good as keeping the wildcard; the gap .......... qa/plan_legality.cjs
 *   the Draft solve's roster, adds, drops and the contested version ........................................ qa/plan_legality.cjs
 *   the round-by-round waiver model against the league's own log, 74/74 (kit 207–220) ...................... qa/waiver_log.cjs
 *   the solved plan's legality, chips, free-hit weeks and Draft roster (kit 172–205, bar 196 ported here) ... qa/plan_legality.cjs
 *   the timing verdict describing the plan actually shown (kit 197–198) is the Plan tab's copy ............ qa/components.cjs D2
 *   the walk-forward backtest and the corrections it licenses (kit 233–243) ................................ qa/calibration.cjs
 *   colour contrast in light and dark (kit 252–261) ......................................................... qa/visual.cjs audit_contrast
 *   render, actions and the page (kit 263–298) .... qa/components.cjs, qa/mc_render.cjs, qa/smoke.cjs, qa/buttons.cjs, qa/verify.sh
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   Every expectation is read from the blocks, the plan, the precompute or the engine; the thresholds are the
 *   kit's and src/mc_analysis.js's exported constants, and the shapes are rules (frozen-ok).
 *
 * MUTATION
 *   The club-cap check on the transfer search's squad is re-run with a fourth player from one club planted in it,
 *   and must go red; its red line is quoted (E-070).
 *
 * PRIVACY
 *   Draft entries appear as team names only.
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
const redLine = (name, cond, detail) => (cond ? null : "RED " + name + (detail ? " — " + detail : ""));
const finish = () => { console.log("SUITE mc_optimisers " + pass + "/" + (pass + fail)); process.exit(fail ? 1 : 0); };
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (e) { return null; } };
const r1 = (x) => Math.round(x * 10) / 10;
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const who = (p) => (p ? p.n + "|" + p.t : "?");

const SHAPE = { 1: 2, 2: 5, 3: 5, 4: 3 };      // frozen-ok: Part N1/N2, 2/5/5/3
const SQUAD = 15;                              // frozen-ok: Part N1/N2
const WC_PER_POS = 18;                         // frozen-ok: kit qa.js line 136, the wildcard's candidates per position
const PLAN_VS_GREEDY = 1;                      // frozen-ok: kit qa.js line 196, the plan within a point of the greedy search or better
const SHORT_N = 4, SHORT_MIN = 0.5, MOVES_PER_POS = 6;   // frozen-ok: kit qa.js line 143
const AHEAD_TAKES = 3;                         // frozen-ok: pipeline/precompute.cjs, three modelled takes a manager ahead

const MC = readJson("data/mc_data.json"), PLAN = readJson("data/plan.json"), PRE = readJson("data/pre.json");
ok("the baked block, the solved plan and the precomputed results are readable", !!MC && !!PLAN && !!PRE && !!PRE.claims && !!PRE.transfers, [!!MC, !!PLAN, !!PRE].join(","));
if (!MC || !PLAN || !PRE) finish();
const M = ENG.create(MC), H = AN.mcHorizon(M, MC), next = H.next, cEnd = H.cEnd, dEnd = H.dEnd, P = M.P;
const CAP = MC.rules.clubLimit;
const shapeOk = (list) => { const c = { 1: 0, 2: 0, 3: 0, 4: 0 }; list.forEach((p) => { c[p.p]++; }); return list.length === SQUAD && [1, 2, 3, 4].every((k) => c[k] === SHAPE[k]); };
const clubOver = (list) => { const c = {}; list.forEach((p) => { c[p.t] = (c[p.t] || 0) + 1; }); return Object.keys(c).filter((t) => c[t] > CAP).map((t) => t + " " + c[t]); };

/* ---------------------------------------------------------------- Classic transfers */
const cs = M.classicSquad();
{
  const G = AN.greedyTransfers(M, MC), tr = M.classicTransfers(cs, next, cEnd, G.maxMoves), own = new Set(cs.squad.map((p) => p.id));
  let bank = cs.bank; tr.moves.forEach((m) => { bank = r1(bank + m.out.sell - m.inn.pr); });
  ok("the transfer search stays inside the budget: bank £" + f1(tr.bank) + "m, replayed from selling and buying prices", tr.bank >= -1e-9 && Math.abs(bank - tr.bank) < 1e-9, "replayed " + bank);
  ok("every transfer swaps like for like (" + tr.moves.map((m) => who(m.out) + " → " + who(m.inn)).join(", ") + ")", tr.moves.every((m) => m.out.p === m.inn.p), "");
  const N_CLUB = "the squad after the transfers keeps at most " + CAP + " a club";
  ok(N_CLUB, clubOver(tr.squad).length === 0, clubOver(tr.squad).join(", "));
  const ins = tr.moves.map((m) => m.inn.id), outs = tr.moves.map((m) => m.out.id);
  ok("no transfer buys a player already owned, and none buys or sells the same player twice", ins.every((i) => !own.has(i)) && new Set(ins).size === ins.length && new Set(outs).size === outs.length, "");
  ok("every transfer improves the horizon to GW" + cEnd + " (" + tr.moves.map((m) => "+" + f1(m.gain)).join(", ") + ")", tr.moves.every((m) => m.gain > 0), "");
  const base = M.squadValue(cs.squad, next, cEnd, true);
  ok("the squad is worth more after them: " + f1(tr.value) + " against " + f1(base), tr.value >= base - 1e-6, "");
  ok("no more moves than the free transfers allow (" + tr.moves.length + " of at most " + G.maxMoves + " = min(" + cs.ft + " free, cap " + MC.rules.maxFt + "))",
    tr.moves.length <= G.maxMoves && G.maxMoves === Math.min(cs.ft, MC.rules.maxFt), "");
  ok("data/pre.json's Classic transfers are this search's answer, field for field", JSON.stringify(PRE.transfers) === JSON.stringify(G), "");
  ok("the solved plan beats the quick greedy search: " + f1(PLAN.plan.total) + " against " + f1(PRE.transfers.value) + " (the kit's " + PLAN_VS_GREEDY + "-point tolerance)", PLAN.plan.total >= PRE.transfers.value - PLAN_VS_GREEDY, "");
  /* mutation: a fourth player from one club planted in the transfer search's squad */
  const club = tr.squad[0].t, planted = tr.squad.slice(); let k = 0;
  for (let i = 0; i < planted.length && k < CAP; i++) {
    if (planted[i].t === club || planted[i].p === 1) continue;
    const same = MC.players.find((p) => p.t === club && p.p === planted[i].p && planted.indexOf(p) < 0); if (same) { planted[i] = same; k++; }
  }
  const over = clubOver(planted), line = redLine(N_CLUB, over.length === 0, over.join(", "));
  ok("mutation: " + k + " more " + club + " players planted in the squad turn the club-cap check red", k > 0 && line !== null, line ? "red: " + line : "the check stayed green", true);
}

/* ---------------------------------------------------------------- Classic wildcard */
{
  const budget = cs.squad.reduce((s, p) => s + p.sell, 0) + cs.bank, w = M.wildcard(budget, next, cEnd, { perPos: WC_PER_POS });
  ok("the wildcard squad is fifteen, 2/5/5/3", !!w && shapeOk(w.squad), w ? w.squad.length + " players" : "no squad");
  ok("the wildcard fits the budget the selling prices give: £" + (w ? w.cost : "?") + "m of £" + (w ? w.budget : "?") + "m, its cost the sum of its prices",
    !!w && w.cost <= w.budget + 1e-9 && Math.abs(r1(w.squad.reduce((s, p) => s + p.pr, 0)) - w.cost) < 1e-9 && Math.abs(w.budget - r1(budget)) < 1e-9, "");
  ok("the wildcard keeps at most " + CAP + " a club and picks nobody ruled out", !!w && clubOver(w.squad).length === 0 && w.squad.every((p) => p.st !== "u"), w ? clubOver(w.squad).join(",") : "");
  const base = M.squadValue(cs.squad, next, cEnd, true);
  ok("the wildcard beats the squad it replaces: " + (w ? f1(w.value) : "?") + " against " + f1(base) + " to GW" + cEnd, !!w && w.value > base, "");
}

/* ---------------------------------------------------------------- Draft moves and waivers */
const roster = M.draftRoster(), mine = new Set(roster.map((p) => p.id)), poolIds = new Set(M.waiverPool().map((p) => p.id));
{
  const mv = M.draftMoves(roster, next, dEnd, { perPos: MOVES_PER_POS }), dist = M.bestDistinctMoves(mv, SHORT_N, SHORT_MIN);
  ok("Draft claims are ranked by what they add to GW" + dEnd + " (" + mv.length + " moves, best +" + (mv[0] ? f1(mv[0].gain) : "?") + ")", mv.every((m, i) => i === 0 || mv[i - 1].gain >= m.gain - 1e-9), "");
  ok("every Draft move adds a claimable player and drops one of mine", mv.every((m) => poolIds.has(m.add.id) && mine.has(m.drop.id)), "");
  ok("a shortlist never uses the same player twice, nor adds and drops the same man (" + dist.map((m) => who(m.add) + " for " + who(m.drop)).join(", ") + ")",
    new Set(dist.map((m) => m.add.id)).size === dist.length && new Set(dist.map((m) => m.drop.id)).size === dist.length && dist.every((m) => m.add.id !== m.drop.id), "");
  const ct = M.contested(next, dEnd, AHEAD_TAKES), order = M.waiverOrder(), at = order.indexOf(MC.draft.me);
  ok("only the managers ahead of me in the waiver order are treated as rivals for claims (" + (ct.ahead.join(", ") || "none") + ")",
    ct.ahead.length === at && ct.ahead.every((n) => order.indexOf(n) < at) && Object.keys(ct.picks).sort().join("|") === ct.ahead.slice().sort().join("|"), "");
  const badPicks = []; Object.keys(ct.picks).forEach((nm) => ct.picks[nm].forEach((m) => { if (!poolIds.has(m.add) || (MC.draft.rosters[nm] || []).indexOf(m.drop) < 0) badPicks.push(nm + " " + m.add + ">" + m.drop); }));
  ok("their likely claims are real free players, dropping their own", badPicks.length === 0, badPicks.join("; "));
  const pk = (a) => a.map((m) => ({ add: m.add.id, drop: m.drop.id, how: m.how || M.howToGet(m.add), gain: m.gain, gainNext: m.gainNext }));
  const taken = new Set([].concat.apply([], Object.values(ct.picks).map((v) => v.map((m) => m.add))));
  const top = pk(M.bestDistinctMoves(M.draftMoves(roster, next, dEnd), PRE.draftMoves.top.length, SHORT_MIN));
  const backups = taken.size ? pk(M.bestDistinctMoves(M.draftMoves(roster, next, dEnd, { pool: M.waiverPool().filter((p) => !taken.has(p.id)) }), PRE.draftMoves.top.length, SHORT_MIN)) : [];
  ok("data/pre.json's Draft moves, the managers ahead and the backups are this search's (" + top.length + " moves, " + backups.length + " backups)",
    JSON.stringify(PRE.draftMoves.top) === JSON.stringify(top) && JSON.stringify(PRE.draftMoves.ahead) === JSON.stringify(ct.ahead) &&
    JSON.stringify(PRE.draftMoves.contested) === JSON.stringify(ct.picks) && JSON.stringify(PRE.draftMoves.backups) === JSON.stringify(backups) && PRE.draftMoves.horizonEnd === dEnd, "");
}

/* ---------------------------------------------------------------- the claims sheet */
{
  const C = PRE.claims, S = C.sheet, firsts = S.filter((e) => e.kind === "first"), backs = S.filter((e) => e.kind === "backup");
  ok("every claim on the sheet adds a claimable player and drops one of mine, like for like (" + S.length + " lines: " + firsts.length + " first choices, " + backs.length + " backups)",
    S.length > 0 && S.every((e) => poolIds.has(e.add) && mine.has(e.drop) && P[e.add].p === P[e.drop].p), "");
  ok("nobody is asked for twice on the sheet", new Set(S.map((e) => e.add)).size === S.length, "");
  const wanted = new Set([].concat.apply([], Object.values(C.rivals)));
  ok("each backup sits under a first choice for the same drop, and is never a name a rival is modelled to want",
    backs.every((b) => firsts.some((f) => f.add === b.of && f.drop === b.drop) && !wanted.has(b.add)), backs.map((b) => b.add + " of " + b.of).join(", "));
  ok("no flagged player is lodged, and every held-back pair is flagged (" + (C.held || []).map((h) => who(P[h.add]) + " " + h.status + (h.chance != null ? " " + h.chance + "%" : "")).join(", ") + ")",
    S.every((e) => P[e.add].st === "a") && (C.held || []).every((h) => P[h.add] && P[h.add].st !== "a"), "");
  const off = S.filter((e) => Math.abs(e.gain - (M.epRange(P[e.add], next, dEnd) - M.epRange(P[e.drop], next, dEnd))) > 1e-9);
  ok("every gain on the sheet is measured to the Draft horizon, GW" + next + " to GW" + dEnd + " (E-126)", off.length === 0, off.map((e) => e.add).join(","));
  ok("the stress-test roster (" + f1(C.valueStress) + ") is worth no more than every first choice landing (" + f1(C.valueAll) + ") and no less than today's (" + f1(C.valueNow) + ")",
    C.valueStress <= C.valueAll + 1e-6 && C.valueStress >= C.valueNow - 1e-6, "");
  const best = (C.orderings || []).slice().sort((a, b) => b.mean - a.mean)[0];
  ok("the ordering kept is the one the league's own processing values higher (" + C.strategy + " " + f1(C.valueStress) + " against " + f1(C.altValue) + "), with the " + (C.orderings || []).length + " Monte Carlo orderings reported beside it (kept " + f1(C.meanValue) + ", best " + (best ? best.name + " " + f1(best.mean) : "none") + ")",
    C.valueStress >= C.altValue - 1e-9 && (C.orderings || []).length === 4 && (C.orderings || []).some((o) => Math.abs(o.mean - C.meanValue) < 1e-9) && ["firsts", "paired"].indexOf(C.strategy) >= 0, "");
  ok("every landing chance is a probability (" + Object.keys(C.land || {}).length + ")", Object.values(C.land || {}).every((x) => x >= 0 && x <= 1) && Object.keys(C.land || {}).length === S.length, "");
  ok("a first choice and its backup never land more than once between them",
    firsts.every((f) => { const bk = backs.find((b) => b.of === f.add); return !bk || C.land[f.add] + C.land[bk.add] <= 1 + 1e-9; }), "");
  ok("the expected roster (" + f1(C.meanValue) + ", " + f1(C.p10) + " to " + f1(C.p90) + ") sits between today and the ceiling", C.meanValue >= C.valueNow - 1e-6 && C.meanValue <= C.valueAll + 1e-6 && C.p10 <= C.p90, "");
  const after = roster.map((p) => p.id); C.sim.filter((x) => x.ok).forEach((x) => { const k = after.indexOf(x.drop); if (k >= 0) after[k] = x.add; });
  ok("the stress-test roster stays 2/5/5/3 (" + C.landed.length + " claims land)", shapeOk(after.map((i) => P[i])), "");
  const rebuilt = AN.buildClaimSheet(M, MC, PLAN.draft.pairs, { mc: true, fitOnly: true });
  ok("data/pre.json's claims sheet is buildClaimSheet's answer on the shipped data and the solved pairs, field for field", JSON.stringify(rebuilt) === JSON.stringify(C), "");
}

/* ---------------------------------------------------------------- trades */
{
  const T = AN.tradeGroups(AN.findTrades(M, MC)), Q = AN.MC_TRADE, all = T.both.concat(T.ask);
  ok("data/pre.json's trades are this search's, both-gain first (" + T.both.length + " both gain, " + T.ask.length + " ask)", JSON.stringify(PRE.trades) === JSON.stringify(T), "");
  ok("every trade meets the thresholds: I gain at least " + Q.mine + ", they lose no more than " + Math.abs(Q.theirsFloor) + ", and both-gain means they gain more than " + Q.both,
    all.every((t) => t.mine >= Q.mine && t.theirs >= Q.theirsFloor && t.both === t.theirs > Q.both), "");
}

/* ---------------------------------------------------------------- price watch */
{
  const w0 = PLAN.plan.weeks[0], bank = PLAN.replay.weeks[0].bank, st = M.priceStress(w0.squad, w0.in, w0.out, bank, next, cEnd, MC.classic.sell);
  ok("the price-watch shortfall is never negative (GW" + w0.gw + ": " + st.risers.length + " planned buys under rise pressure, " + st.fallers.length + " sales under fall pressure, bank £" + f1(bank) + "m from PLAN.replay, need £" + f1(st.need) + "m)",
    st.need >= 0 && typeof bank === "number", "");
  const fx = st.fix, sq = w0.squad.map((i) => P[i]);
  ok("a suggested budget fix is like for like, frees enough and keeps the club cap (" + (fx ? who(P[fx.out]) + " → " + who(P[fx.inn]) + " saves £" + fx.saves + "m" : "none needed") + ")",
    !fx || (P[fx.out].p === P[fx.inn].p && fx.saves + 1e-9 >= st.need && w0.squad.indexOf(fx.inn) < 0 && clubOver(sq.map((p) => (p.id === fx.out ? P[fx.inn] : p))).length === 0), "");
}

finish();

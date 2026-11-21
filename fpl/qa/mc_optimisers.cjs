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
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
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
  // 21 Nov 2026 (E-203): both writers call buildDraftSheet, which is buildClaimSheet's object before the waiver run and that
  // object plus the two parts after it; the shipped claims are compared with it, field for field.
  const rebuilt = AN.buildDraftSheet(M, MC, PLAN.draft.pairs, { mc: true, fitOnly: true });
  ok("data/pre.json's claims are buildDraftSheet's answer on the shipped data and the solved pairs, field for field", JSON.stringify(rebuilt) === JSON.stringify(C), "");
  const sw = JSON.parse(JSON.stringify(C)); const L0 = sw.phase === "free" ? sw.now : sw.sheet;
  if (L0.length >= 2) { const t = L0[0]; L0[0] = L0[1]; L0[1] = t; }
  ok("mutation: the same claims with two lines swapped are not the builder's", L0.length < 2 || JSON.stringify(rebuilt) !== JSON.stringify(sw), L0.length < 2 ? "fewer than two lines" : "");
}

/* ---------------------------------------------------------------- the two-part Draft sheet (E-203, E-200; 21 Nov 2026)
   After the week's waiver run the sheet is two parts: free agents to sign now, each the best like-for-like swap left on the
   roster the lines above leave, and the locked players worth a claim at the next run. These checks run on clones in both
   phases, so they run whichever phase the shipped data is in. */
{
  const clone = (processed) => { const X = JSON.parse(JSON.stringify(MC)); X.draft.waiversProcessed = processed; return X; };
  const MCs = clone(true), MCp = clone(false), Ms = ENG.create(MCs), Mp = ENG.create(MCp), Hs = AN.mcHorizon(Ms, MCs), nx = Hs.next, hz = Hs.dEnd, Ps = Ms.P;
  const S = AN.buildDraftSheet(Ms, MCs, PLAN.draft.pairs, { fitOnly: true });
  const Sp = AN.buildDraftSheet(Mp, MCp, PLAN.draft.pairs, { fitOnly: true }), Cp = AN.buildClaimSheet(Mp, MCp, PLAN.draft.pairs, { fitOnly: true });
  const NEW = ["phase", "now", "next", "heldBack", "valueAfter"];
  ok("before the waiver run buildDraftSheet is buildClaimSheet, byte for byte, with none of the two-part keys (constraint d)",
    JSON.stringify(Sp) === JSON.stringify(Cp) && NEW.every((k) => !(k in Sp)), "");
  ok("mutation: after the run the same comparison fails, and all five two-part keys are there", JSON.stringify(S) !== JSON.stringify(AN.buildClaimSheet(Ms, MCs, PLAN.draft.pairs, { fitOnly: true })) && NEW.every((k) => k in S), "");
  const lines = (X) => JSON.stringify(AN.sheetLines(X));
  ok("the written lines do not depend on the Monte Carlo option, in either phase",
    lines(AN.buildDraftSheet(Ms, MCs, PLAN.draft.pairs, { mc: true, fitOnly: true })) === lines(S) && lines(AN.buildDraftSheet(Mp, MCp, PLAN.draft.pairs, { mc: true, fitOnly: true })) === lines(Sp), "");

  const fit = (p) => !!p && p.st === "a", MIN = AN.MC_SIGN_MIN_GAIN, PER = AN.MC_SIGN_PER_POS;
  // a replay of the greedy rule: each line must be the largest like-for-like gain left, from players still on the roster
  // the pass started from, at least MIN; and after the last line nothing reaches MIN
  const replay = (ls, roster, pool, g0) => {
    const bad = [], start = new Set(roster.map((p) => p.id)), dropped = new Set(), added = new Set(); let cur = roster.slice();
    ls.forEach((l, i) => {
      const avail = pool.filter((p) => !added.has(p.id) && !start.has(p.id));
      const best = Ms.draftMoves(cur, g0, hz, { pool: avail, perPos: PER }).filter((m) => start.has(m.drop.id) && !dropped.has(m.drop.id))[0];
      const a = Ps[l.add], d = cur.find((x) => x.id === l.drop);
      if (!a || !d || a.p !== d.p) { bad.push("line " + (i + 1) + " is not like for like on the roster"); return; }
      if (!best || Math.abs(best.gain - l.gain) > 1e-9 || l.gain < MIN || best.add.id !== l.add || best.drop.id !== l.drop) bad.push("line " + (i + 1) + " " + who(a) + " for " + who(d) + " " + f1(l.gain) + " is not the best swap left" + (best ? " (" + who(best.add) + " for " + who(best.drop) + " " + f1(best.gain) + ")" : ""));
      if (l.kind !== undefined || l.of !== undefined) bad.push("line " + (i + 1) + " carries a claims-sheet kind");
      added.add(l.add); dropped.add(l.drop); cur = cur.map((x) => x === d ? a : x);
    });
    const avail = pool.filter((p) => !added.has(p.id) && !start.has(p.id));
    const more = avail.length ? Ms.draftMoves(cur, g0, hz, { pool: avail, perPos: PER }).filter((m) => start.has(m.drop.id) && !dropped.has(m.drop.id))[0] : null;
    if (more && more.gain >= MIN) bad.push("after the last line " + who(more.add) + " for " + who(more.drop) + " still adds " + f1(more.gain));
    return { bad, after: cur };
  };
  const roster = Ms.draftRoster(), fa = Ms.freeAgents().filter(fit), locked = Ms.lockedFreeAgents().filter(fit);
  const r1 = replay(S.now, roster, fa, nx);
  ok("sign now (" + S.now.length + " lines): each is a fit free agent for one of my players, like for like, the best swap left on the roster the lines above leave, at least +" + MIN,
    r1.bad.length === 0 && S.now.every((l) => fit(Ps[l.add]) && Ps[l.add].ds === "a"), r1.bad.slice(0, 3).join("; "));
  ok("the roster after the signings (" + f1(S.valueAfter) + ") is today's (" + f1(S.valueNow) + ") plus the lines' gains",
    Math.abs(S.valueAfter - S.valueNow - S.now.reduce((t, l) => t + l.gain, 0)) < 1e-6 && Math.abs(S.valueAfter - Ms.squadValue(r1.after, nx, hz, false)) < 1e-6, "");
  if (S.now.length) {
    const other = roster.find((x) => x.p === Ps[S.now[0].add].p && x.id !== S.now[0].drop);
    const mut = [Object.assign({}, S.now[0], { drop: other.id })].concat(S.now.slice(1));
    ok("mutation: the first line paired with another of my players (E-200's pairing) is caught by the replay", replay(mut, roster, fa, nx).bad.length > 0, replay(mut, roster, fa, nx).bad.slice(0, 1).join(""));
  }

  // greedy against an exhaustive search over every like-for-like fifteen from my roster and the top PER fit free agents a
  // position (by points to the horizon). A group of a position is dropped only when another beats or equals it in every
  // week at every count the elevens can use; the survivors' cross product is scored as bestXI scores an eleven.
  const weeks = []; for (let g = nx; g <= hz; g++) weeks.push(g);
  const need = { 1: 2, 2: 5, 3: 5, 4: 3 }, FORM = ENG.FORMATIONS;
  const groupsOf = (k) => {
    const cands = roster.filter((p) => p.p === k).concat(fa.filter((p) => p.p === k).map((p) => ({ p, v: Ms.epRange(p, nx, hz) })).sort((a, b) => b.v - a.v).slice(0, PER).map((x) => x.p));
    const ev = cands.map((p) => weeks.map((g) => Ms.ep(p, g))), n = cands.length, r = need[k], out = [];
    const pick = (from, chosen) => {
      if (chosen.length === r) {
        const pre = weeks.map((_, w) => { const v = chosen.map((i) => ev[i][w]).sort((a, b) => b - a); const c = [0]; v.forEach((x) => c.push(c[c.length - 1] + x)); return c; });
        out.push({ ids: chosen.map((i) => cands[i].id), pre, tot: pre.reduce((t, c) => t + c[r], 0) }); return;
      }
      for (let i = from; i <= n - (r - chosen.length); i++) pick(i + 1, chosen.concat([i]));
    };
    pick(0, []);
    out.sort((a, b) => b.tot - a.tot);
    const keep = [];
    out.forEach((g) => { if (!keep.some((h) => h.pre.every((c, w) => c.every((x, j) => x >= g.pre[w][j] - 1e-12)))) keep.push(g); });
    return keep;
  };
  const GK = groupsOf(1), DF = groupsOf(2), MD = groupsOf(3), FW = groupsOf(4);
  let bestV = -Infinity, bestSet = null;
  GK.forEach((g) => DF.forEach((d) => MD.forEach((m) => FW.forEach((f) => {
    let v = 0;
    for (let w = 0; w < weeks.length; w++) { let b = -Infinity; FORM.forEach(([a, b2, c]) => { const t = d.pre[w][a] + m.pre[w][b2] + f.pre[w][c]; if (t > b) b = t; }); v += g.pre[w][1] + b; }
    if (v > bestV) { bestV = v; bestSet = [].concat(g.ids, d.ids, m.ids, f.ids); }
  }))));
  const exact = bestSet ? Ms.squadValue(bestSet.map((i) => Ps[i]), nx, hz, false) : NaN;
  const gap = (val) => exact - val;
  const extra = bestSet ? bestSet.filter((i) => !r1.after.some((p) => p.id === i)).map((i) => who(Ps[i])) : [];
  ok("the greedy signings are within +" + MIN + " of an exhaustive search over " + GK.length + "×" + DF.length + "×" + MD.length + "×" + FW.length + " like-for-like fifteens (exhaustive " + f2(exact) + ", greedy " + f2(S.valueAfter) + ")",
    isFinite(exact) && gap(S.valueAfter) < MIN, extra.length ? "the search also signs " + extra.join(", ") : "");
  if (S.now.length) {
    const undone = r1.after.map((p) => p.id === S.now[0].add ? Ps[S.now[0].drop] : p);
    ok("mutation: with the first signing undone the same comparison fires", gap(Ms.squadValue(undone, nx, hz, false)) >= MIN, "");
  }

  // the next run: locked, fit players, from the gameweek after this one, on the roster the signings leave; its time and
  // the manager's place are the league's own
  const run = nx + 1, ev = (MCs.draft.events || {})[String(run)] || {}, order = Ms.waiverOrder();
  if (run <= hz && typeof ev.wv === "string") {
    const r2 = replay(S.next.claims, r1.after, locked, run);
    ok("next waiver run (" + S.next.claims.length + " claims): each is a fit locked player, the best claim left from GW" + run + " on the roster the signings leave",
      r2.bad.length === 0 && S.next.claims.every((l) => fit(Ps[l.add]) && Ps[l.add].ds === "l"), r2.bad.slice(0, 3).join("; "));
    ok("the next run is GW" + run + " at the league's waiver time, and the place is waiver_pick (" + S.next.place + " of " + S.next.of + ")",
      S.next.gw === run && S.next.wv === ev.wv && S.next.place === order.indexOf(MCs.draft.me) + 1 && S.next.of === order.length, "");
    if (S.now.length && S.next.claims.length) {
      const mut = [Object.assign({}, S.next.claims[0], { drop: S.now[0].drop })].concat(S.next.claims.slice(1));
      ok("mutation: a next-run claim that drops a player a signing has already dropped is caught", replay(mut, r1.after, locked, run).bad.length > 0, "");
    }
  } else ok("after the re-draft there is no next run on the sheet", S.next === null, "");
  const inParts = new Set(S.now.map((l) => l.add).concat(S.next ? S.next.claims.map((l) => l.add) : []));
  ok("every held-back player is flagged and in neither part (" + S.heldBack.map((h) => who(Ps[h.add]) + " " + h.status).join(", ") + ")",
    S.heldBack.every((h) => Ps[h.add] && Ps[h.add].st !== "a" && !inParts.has(h.add)), "");
  if (S.now.length) {
    const firstId = S.now[0].add, MCf = clone(true); MCf.players.forEach((p) => { if (p.id === firstId) { p.st = "d"; p.cop = 75; } });
    const Mf = ENG.create(MCf), Sf = AN.buildDraftSheet(Mf, MCf, PLAN.draft.pairs, { fitOnly: true });
    ok("mutation: flag the first signing and he leaves the sign-now lines", !Sf.now.some((l) => l.add === firstId), "");
  }
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

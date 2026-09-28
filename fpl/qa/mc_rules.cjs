#!/usr/bin/env node
/*
 * qa/mc_rules.cjs — the rules of the two games, as fpl/CLAUDE.md Part N states them, held by the ported
 * engine, the baked block, the solved plan and the precomputed results (v110 §4, §5 E1 "rules"; the kit's
 * qa.js group 4, lines 67–88, extended to every rule Part N names).
 *
 *   node qa/mc_rules.cjs
 *
 * WHAT IT PROVES — each block names the Part N rule it holds
 *   N1 Squad        the block's club cap, free-transfer cap and chip stop are the rule's; the Classic fifteen is
 *                   2/5/5/3 with at most three a club; for the next four gameweeks the best eleven is legal (1 GK,
 *                   3–5 DEF, 2–5 MID, 1–3 FWD), the bench holds the rest, captain and vice are distinct and in it,
 *                   and it beats the saved eleven; the engine's formation list is exactly the legal set
 *   N1 FT ledger    PLAN.replay is the Part N1 ledger applied to the plan's own moves: it starts from the block's
 *                   free transfers, a wildcard or free-hit week keeps the count exactly (nothing spent, nothing
 *                   added), an ordinary week spends then adds one to the cap, a hit is −4 and only once every free
 *                   transfer is used
 *   N1 Chips        two of each; wildcard and free hit from GW2, bench boost and triple captain from GW1, the first
 *                   set to the chip stop and the second from the week after to the end of the season
 *   N1 Selling      on the shipped block's sell map: a rise is shared half and half, rounded down to £0.1m; a fall is
 *                   taken in full; never above today's price; and the Classic squad the engine plans from uses it
 *   N1 DefCon       10 actions pay a defender, 12 a midfielder or forward, never a goalkeeper (synthetic players
 *                   through the engine's own rate model); the live count is a count, not a points total; no
 *                   goalkeeper projects a defensive contribution and no forward a clean sheet, over the whole horizon
 *   N1 Picks timing the engine plans from the last published Classic squad; nothing from a gameweek whose deadline
 *                   has not passed; the free-transfer count is sure only once the gameweek in play has published
 *   N1 Strength     no strength_* team field reaches the block or the engine
 *   N2 Squad        the Draft roster is fifteen, 2/5/5/3 and fields a legal eleven with a goalkeeper in bench slot 12
 *                   — in the engine's eleven and in every published Draft week; there is no captain (the Draft value
 *                   is the plain best eleven, the Classic one adds the armband); there is no club limit (the Draft
 *                   search proposes a fourth player from one club where the Classic swap rule refuses him)
 *   N2 Like for like every claim and every trade swaps a player for one in the same position: the engine's moves,
 *                   the solved Draft pairs (and the contested solve's), the precomputed claims sheet and moves, and
 *                   every trade, live and precomputed; a trade never takes from my roster and only gives from it
 *   N2 Ownership    o owned, a available, l locked; rostered players are o; the claim pool is the free agents plus
 *                   the locked, owned by nobody and never on my roster
 *   N2 Phase        before waivers settle every unowned player is a claim; after, an available one signs at once and a
 *                   locked one is still a claim — on copies of the block in both phases, with a locked player planted
 *   N2 Order        the waiver order is read from waiver_pick, a permutation of the league, never re-derived
 *
 * ALREADY PROVED ELSEWHERE, CITED AND NOT PORTED TWICE
 *   every week of the solved plan legal (shape, club cap, eleven, armband, bench, bank, chips once, one a week) .. qa/plan_legality.cjs
 *   the waiver processing reproduces the league's own log, 74/74 .............................................. qa/waiver_log.cjs
 *   selling prices against golden on the reference feeds, the transfer log winning over the start price ....... qa/prices.cjs
 *   the ledger on synthetic histories, the cap as 1 + max_extra_free_transfers ................................ qa/bake.cjs A5
 *   a cross-position pair fed to the claims sheet is refused by name ......................................... qa/parity.cjs E-096
 *   kit 170, the claims copy matches the phase, is a render check of the Draft tab (D3's panel, held by qa/components.cjs
 *     and the browser suites); the labels that copy prints come from M.howToGet, which the phase block below holds in
 *     both phases
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   The rule constants below are the game's, each marked frozen-ok with the rule named. Everything else — who is
 *   owned, which week is the chip week, the free-transfer count — is read from the block, the plan or the engine.
 *
 * MUTATIONS
 *   The ledger comparator is re-run with a ledger in which a wildcard week adds a free transfer, and the
 *   forward-clean-sheet scan is re-run on a copy of the engine whose forward clean sheet pays a point. Both must
 *   go red; their red lines are quoted (E-070).
 *
 * PRIVACY
 *   Draft entries appear as team names only. Nothing here reads or prints a manager's personal name.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.resolve(__dirname, "..");
const ENGINE_PATH = path.join(ROOT, "src", "mc_engine.js");
const ENG = require(ENGINE_PATH);
const AN = require(path.join(ROOT, "src", "mc_analysis.js"));

let pass = 0, fail = 0;
const ok = (name, cond, detail, show) => {
  if (cond) { pass++; console.log("PASS " + name + (show && detail ? " — " + detail : "")); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const redLine = (name, cond, detail) => (cond ? null : "FAIL " + name + (detail ? " — " + detail : ""));
const finish = () => { console.log("SUITE mc_rules " + pass + "/" + (pass + fail)); process.exit(fail ? 1 : 0); };
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (e) { return null; } };
const clone = (o) => JSON.parse(JSON.stringify(o));
const who = (p) => (p ? p.n + "|" + p.t : "?");

/* ---------------------------------------------------------------- the rules, as Part N states them */
const SHAPE = { 1: 2, 2: 5, 3: 5, 4: 3 };            // frozen-ok: Part N1/N2 squad, 2 GKP / 5 DEF / 5 MID / 3 FWD
const SQUAD = 15, XI = 11, BENCH_GK_SLOT = 12;       // frozen-ok: Part N1/N2, fifteen, an eleven, bench slot 12 is the goalkeeper's
const XI_RANGE = { 1: [1, 1], 2: [3, 5], 3: [2, 5], 4: [1, 3] };   // frozen-ok: Part N1, 1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD
const CLUB_CAP = 3;                                   // frozen-ok: Part N1, at most 3 per club (Classic only)
const FT_CAP = 5;                                     // frozen-ok: Part N1, free transfers capped at five
const HIT = 4;                                        // frozen-ok: Part N1, −4 per transfer beyond the free ones
const CHIP_STOP = 19;                                 // frozen-ok: Part N1, the first set of chips runs to the GW19 deadline
const CHIP_FROM = { wildcard: 2, freehit: 2, bboost: 1, "3xc": 1 };   // frozen-ok: Part N1, wildcard and free hit from GW2, the others from GW1
const KEEPS = { wildcard: true, freehit: true };      // frozen-ok: Part N1, a wildcard or free-hit week keeps the free-transfer count
const DC_T = { 2: 10, 3: 12, 4: 12 };                 // frozen-ok: Part N1, 10 CBIT for defenders, 12 for midfielders and forwards

const MC = readJson("data/mc_data.json"), PLAN = readJson("data/plan.json"), PRE = readJson("data/pre.json");
ok("the baked block, the solved plan and the precomputed results are readable",
  !!MC && !!PLAN && !!PLAN.plan && !!PLAN.replay && !!PRE, [!!MC, !!PLAN, !!PRE].join(","));
if (!MC || !PLAN || !PRE) finish();
let M = null;
try { M = ENG.create(MC); } catch (e) { ok("MCEngine.create(MC) runs on the block", false, e.message); finish(); }
const G = MC.gw, next = G.next, season = G.events.length, cEnd = M.CFG.classicEnd, dEnd = M.CFG.draftEnd;
const countPos = (list) => { const c = { 1: 0, 2: 0, 3: 0, 4: 0 }; list.forEach((p) => { if (p) c[p.p]++; }); return c; };
const shapeOf = (c) => c[1] + "-" + c[2] + "-" + c[3] + "-" + c[4];
const isShape = (list) => { const c = countPos(list); return list.length === SQUAD && [1, 2, 3, 4].every((k) => c[k] === SHAPE[k]); };
function xiProblems(b) {
  if (!b) return ["no eleven"];
  const c = countPos(b.xi), out = [];
  if (b.xi.length !== XI) out.push(b.xi.length + " players");
  [1, 2, 3, 4].forEach((k) => { if (c[k] < XI_RANGE[k][0] || c[k] > XI_RANGE[k][1]) out.push(M.POS[k] + " " + c[k]); });
  return out;
}

/* ---------------------------------------------------------------- N1 · the block carries the rule's constants */
ok("the block's rules are the game's: at most " + CLUB_CAP + " a club, " + FT_CAP + " free transfers at most, the first chips to GW" + CHIP_STOP,
  MC.rules.clubLimit === CLUB_CAP && MC.rules.maxFt === FT_CAP && MC.classic.maxFt === FT_CAP && MC.rules.chipStop === CHIP_STOP,
  JSON.stringify(MC.rules) + " classic.maxFt " + MC.classic.maxFt);

/* ---------------------------------------------------------------- N1 · the Classic squad and its elevens */
const cs = M.classicSquad();
{
  const club = {}; cs.squad.forEach((p) => { club[p.t] = (club[p.t] || 0) + 1; });
  ok("the Classic fifteen is 2/5/5/3 (" + shapeOf(countPos(cs.squad)) + ") with at most " + CLUB_CAP + " a club (most " + Math.max.apply(null, Object.values(club)) + ")",
    isShape(cs.squad) && Object.values(club).every((n) => n <= CLUB_CAP), JSON.stringify(club));
  const saved = cs.squad.filter((p) => p.slot <= XI);
  for (let g = next; g <= Math.min(season, next + 3); g++) {
    const b = M.bestXI(cs.squad, g), bad = xiProblems(b);
    const inXi = (p) => !!p && b.xi.indexOf(p) >= 0;
    const benchOk = !!b && b.xi.length + b.bench.length + (b.benchGk ? 1 : 0) === SQUAD && !!b.benchGk && b.benchGk.p === 1 && b.bench.every((p) => p.p !== 1);
    ok("GW" + g + ": the best Classic eleven is legal (" + (b ? b.form : "none") + "), the bench holds the other four with the reserve keeper, captain " + (b ? who(b.cap) : "?") + " and vice " + (b ? who(b.vice) : "?") + " are distinct and in it, and it beats the saved eleven",
      bad.length === 0 && benchOk && inXi(b.cap) && inXi(b.vice) && b.cap !== b.vice && b.tot >= M.xiTotal(saved, g) - 1e-9,
      bad.join(", ") + " bench " + benchOk + " saved " + M.xiTotal(saved, g).toFixed(2) + " best " + (b ? b.tot.toFixed(2) : "-"));
  }
  const legal = []; for (let d = XI_RANGE[2][0]; d <= XI_RANGE[2][1]; d++) for (let m = XI_RANGE[3][0]; m <= XI_RANGE[3][1]; m++) for (let f = XI_RANGE[4][0]; f <= XI_RANGE[4][1]; f++) if (d + m + f === XI - 1) legal.push(d + "-" + m + "-" + f);
  const eng = ENG.FORMATIONS.map((x) => x.join("-"));
  ok("the engine's formations are exactly the legal ones (" + legal.join(", ") + ")", eng.length === legal.length && legal.every((x) => eng.indexOf(x) >= 0), eng.join(", "));
}

/* ---------------------------------------------------------------- N1 · the free-transfer ledger */
/* Part N1 as a function: a wildcard or free-hit week spends nothing and adds nothing; an ordinary week spends up
   to the free ones, pays −4 for each move beyond them (only once every free transfer is used), then adds one. */
function ledgerStep(ft, moves, chip, keeps, chipAfter) {
  if (keeps[chip]) return { used: 0, hitCount: 0, ftAfter: chipAfter ? chipAfter(ft, chip) : ft };
  const used = Math.min(ft, moves), hitCount = Math.max(0, moves - ft);
  return { used: used, hitCount: hitCount, ftAfter: Math.min(FT_CAP, ft - used + 1) };
}
function ledgerDiff(weeks, replay, ft0, keeps, chipAfter) {
  const bad = []; let ft = ft0;
  weeks.forEach((w, i) => {
    const r = replay[i] || {}, s = ledgerStep(ft, (w.in || []).length, w.chip, keeps, chipAfter);
    if (r.gw !== w.gw || r.ftBefore !== ft || r.moves !== (w.in || []).length || r.used !== s.used || r.hitCount !== s.hitCount || r.hits !== HIT * s.hitCount || r.ftAfter !== s.ftAfter)
      bad.push("GW" + w.gw + (w.chip ? " " + w.chip : "") + ": replay " + r.ftBefore + "→" + r.ftAfter + " used " + r.used + " hits " + r.hits + ", rule " + ft + "→" + s.ftAfter + " used " + s.used + " hits " + HIT * s.hitCount);
    if (s.hitCount > 0 && s.used !== ft) bad.push("GW" + w.gw + " a hit before every free transfer was used");
    ft = s.ftAfter;
  });
  return bad;
}
{
  const W = PLAN.plan.weeks, R = PLAN.replay.weeks, chipWeeks = W.filter((w) => KEEPS[w.chip]).map((w) => "GW" + w.gw + " " + w.chip);
  const N_FT = "PLAN.replay is the Part N1 ledger on the plan's own moves, from the block's " + MC.classic.ftNext + " free transfers (" + W.length + " weeks; " + (chipWeeks.join(", ") || "no chip week") + " keeps the count)";
  const bad = ledgerDiff(W, R, MC.classic.ftNext, KEEPS);
  ok(N_FT, R.length === W.length && bad.length === 0, bad.slice(0, 4).join("; "));
  const keep = W.map((w, i) => (KEEPS[w.chip] ? R[i] : null)).filter(Boolean);
  ok("every wildcard or free-hit week in the plan keeps the count exactly: nothing spent, nothing added, no hit (" + keep.map((r) => "GW" + r.gw + " " + r.ftBefore + "→" + r.ftAfter).join(", ") + ")",
    keep.every((r) => r.ftAfter === r.ftBefore && r.used === 0 && r.hits === 0), "");
  /* the rule itself, on a history built here: a wildcard in the middle of three ordinary weeks */
  const syn = [{ gw: 1, in: [] }, { gw: 2, in: [1, 2, 3, 4, 5, 6], chip: "wildcard" }, { gw: 3, in: [1, 2, 3] }, { gw: 4, in: [] }];   // frozen-ok: a synthetic history, the input of the rule
  const synSteps = []; let f = 1; syn.forEach((w) => { const s = ledgerStep(f, w.in.length, w.chip, KEEPS); synSteps.push(f + "→" + s.ftAfter + (s.hitCount ? " hit " + s.hitCount : "")); f = s.ftAfter; });
  ok("the ledger rule on a built history: 1→2, the wildcard keeps 2, three moves on two pay one hit and leave 1, then 2 (" + synSteps.join(", ") + ")",
    synSteps.join(",") === "1→2,2→2,2→1 hit 1,1→2", "");   // frozen-ok: the arithmetic of Part N1 on the synthetic history above
  /* mutation: a ledger in which a wildcard week adds one, the class of E-102 */
  const leaky = (ft, chip) => (chip === "wildcard" ? Math.min(FT_CAP, ft + 1) : ft);
  const badM = ledgerDiff(W, R, MC.classic.ftNext, KEEPS, leaky), badS = W.some((w) => w.chip === "wildcard");
  const line = redLine(N_FT, badM.length === 0, badM.slice(0, 2).join("; "));
  ok("mutation: a ledger in which the wildcard week adds a free transfer disagrees with PLAN.replay", !badS || line !== null,
    line ? "red: " + line : "the plan has no wildcard week to disagree on", true);
}

/* ---------------------------------------------------------------- N1 · chips */
{
  const Wn = MC.classic.chipWindows || [], bad = [];
  Object.keys(CHIP_FROM).forEach((c) => {
    const w = Wn.filter((x) => x.name === c).sort((a, b) => a.from - b.from);
    if (w.length !== 2) { bad.push(c + " has " + w.length + " windows"); return; }
    if (w[0].from !== CHIP_FROM[c] || w[0].to !== MC.rules.chipStop) bad.push(c + " first set " + w[0].from + "–" + w[0].to);
    if (w[1].from !== MC.rules.chipStop + 1 || w[1].to !== season) bad.push(c + " second set " + w[1].from + "–" + w[1].to);
  });
  ok("two of each chip: wildcard and free hit from GW2, bench boost and triple captain from GW1, the first set to GW" + MC.rules.chipStop + " and the second to GW" + season,
    Wn.length === 2 * Object.keys(CHIP_FROM).length && bad.length === 0, bad.join("; "));
}

/* ---------------------------------------------------------------- N1 · selling prices on the shipped block */
{
  const S = MC.classic.sell || {}, ids = Object.keys(S), t = (x) => Math.round(x * 10);
  const bad = ids.filter((i) => { const v = S[i], rule = t(v.now) <= t(v.paid) ? t(v.now) : t(v.paid) + Math.floor((t(v.now) - t(v.paid)) / 2); return t(v.sell) !== rule || v.sell > v.now + 1e-9; });
  const rises = ids.filter((i) => S[i].now > S[i].paid).length, falls = ids.filter((i) => S[i].now < S[i].paid).length;
  ok("every selling price is the price paid plus half the rise rounded down, a fall taken in full, never above today's price (" + ids.length + " players, " + rises + " rises, " + falls + " falls)",
    ids.length > 0 && bad.length === 0, bad.map((i) => i + " " + JSON.stringify(S[i])).join("; "));
  const off = cs.squad.filter((p) => S[p.id] && Math.abs(p.sell - S[p.id].sell) > 1e-9);
  ok("the Classic squad the engine plans from sells at those prices", off.length === 0 && cs.squad.every((p) => !!S[p.id]), off.map(who).join(", "));
}

/* ---------------------------------------------------------------- N1 · defensive contribution and clean sheets */
{
  /* A synthetic player with n full matches of k actions each, run through the engine's own rate model. */
  const base = MC.players.find((p) => p.p === 2 && p.mins > 0), done = (G.withData || []).filter((g) => g <= G.lastDone);
  let uid = -1;
  const pDC = (pos, k) => {
    const h = {}; done.forEach((g) => { h[g] = [90, 2, 0, 0, k, 1, 0, 0, 0, 0]; });
    const p = Object.assign({}, base, { id: uid--, p: pos, h: h, mins: 90 * done.length, dc: k * done.length });
    return M.rateOf(p).pDC;
  };
  const rows = [], bad = [];
  Object.keys(DC_T).forEach((k) => {
    const T = DC_T[k], at = pDC(+k, T), under = pDC(+k, T - 1), under2 = pDC(+k, T - 2);
    rows.push(M.POS[k] + " " + (T - 1) + "→" + T + ": " + under.toFixed(2) + "→" + at.toFixed(2));
    if (!(at - under > 0.5 && under - under2 < 0.2)) bad.push(M.POS[k] + " threshold is not " + T);
  });
  const gk = pDC(1, 20);
  ok("defensive contribution pays at 10 actions for a defender and 12 for a midfielder or forward, never a goalkeeper (" + rows.join("; ") + "; GKP at 20: " + gk + ")",
    done.length > 0 && bad.length === 0 && gk === 0, bad.join("; "));
  const lines = []; MC.players.forEach((p) => Object.keys(p.h || {}).forEach((g) => lines.push(p.h[g][4])));
  const hi = Math.max.apply(null, lines);
  ok("defensive_contribution in the live lines is a count: whole numbers, and above 2 where a points total never could be (highest " + hi + ")",
    lines.length > 0 && lines.every((x) => Number.isInteger(x) && x >= 0) && hi > 2, "");
}
function horizonScan(engine, pos, bad) {
  const out = []; engine.CFG && MC.players.filter((p) => p.p === pos).forEach((p) => { for (let g = next; g <= Math.max(cEnd, dEnd); g++) engine.parts(p, g).det.forEach((d) => { if (bad(d)) out.push(who(p) + " GW" + g); }); });
  return out;
}
const N_FWD = "no forward ever projects a clean-sheet point, GW" + next + " to GW" + Math.max(cEnd, dEnd);
{
  const f = horizonScan(M, 4, (d) => d.cs !== 0);
  ok(N_FWD, f.length === 0, f.slice(0, 5).join(", "));
  const g = horizonScan(M, 1, (d) => d.dc !== 0);
  ok("no goalkeeper ever projects a defensive contribution, GW" + next + " to GW" + Math.max(cEnd, dEnd), g.length === 0, g.slice(0, 5).join(", "));
  /* mutation: the same scan on a copy of the engine whose forward clean sheet pays a point */
  const src = fs.readFileSync(ENGINE_PATH, "utf8"), from = "CS_PTS = { 1: 4, 2: 4, 3: 1, 4: 0 }";
  let line = null, applied = src.indexOf(from) >= 0;
  if (applied) {
    const mod = new Module(ENGINE_PATH + ".mutant", null); mod.filename = ENGINE_PATH + ".mutant"; mod.paths = module.paths;
    mod._compile(src.replace(from, "CS_PTS = { 1: 4, 2: 4, 3: 1, 4: 1 }"), mod.filename);
    const f2 = horizonScan(mod.exports.create(MC), 4, (d) => d.cs !== 0);
    line = redLine(N_FWD, f2.length === 0, f2.length + " forward-weeks, first " + f2.slice(0, 2).join(", "));
  }
  ok("mutation: an engine whose forward clean sheet pays a point turns the forward scan red", line !== null, line ? "red: " + line : (applied ? "the check stayed green" : "the clean-sheet table was not found in src/mc_engine.js"), true);
}

/* ---------------------------------------------------------------- N1 · picks timing and team strength */
{
  const gws = MC.classic.gws, lastPub = gws[gws.length - 1].gw, dl = (g) => Date.parse((G.events.find((e) => e.id === g) || {}).dl);
  ok("the engine plans from the last published Classic squad (GW" + cs.gw + "), and no published week is one whose deadline has not passed",
    cs.gw === lastPub && gws.every((w) => w.gw <= G.live && dl(w.gw) <= Date.parse(MC.asOf)), "live " + G.live + " asOf " + MC.asOf);
  ok("the free-transfer count is sure only once the gameweek in play has published its picks (GW" + G.live + (lastPub === G.live ? " published" : " not published") + ", sure " + MC.classic.ftSure + ")",
    MC.classic.ftSure === (lastPub === G.live), "");
  const keys = []; MC.teams.forEach((t) => Object.keys(t).forEach((k) => { if (/^strength/.test(k)) keys.push(t.s + "." + k); }));
  ok("no strength_* team field reaches the block or the engine", keys.length === 0 && !/strength_/.test(fs.readFileSync(ENGINE_PATH, "utf8")), keys.slice(0, 5).join(", "));
}

/* ---------------------------------------------------------------- N2 · the Draft squad */
const roster = M.draftRoster(), mine = new Set(roster.map((p) => p.id));
{
  const b = M.bestXI(roster, next), bad = xiProblems(b);
  ok("the Draft roster is fifteen, 2/5/5/3 (" + shapeOf(countPos(roster)) + "), and fields a legal eleven (" + (b ? b.form : "none") + ") with a goalkeeper in the bench slot",
    isShape(roster) && bad.length === 0 && !!b.benchGk && b.benchGk.p === 1 && b.xi.length + b.bench.length + 1 === SQUAD, bad.join(", "));
  const wrong = MC.draft.myGws.filter((g) => { const k = g.picks.find((x) => x.pos === BENCH_GK_SLOT); return !k || !M.P[k.id] || M.P[k.id].p !== 1; }).map((g) => "GW" + g.gw);
  ok("bench slot 12 holds a goalkeeper in every published Draft week (" + MC.draft.myGws.length + " weeks)", MC.draft.myGws.length > 0 && wrong.length === 0, wrong.join(", "));
  const side = M.sideFromRoster(roster, next), cb = M.bestXI(cs.squad, next);
  ok("Draft has no captain: the side carries none, the Draft value is the plain best eleven, and only the Classic value adds the armband",
    !!side && side.captain === undefined && Math.abs(M.squadValue(roster, next, next, false) - b.tot) < 1e-9 && Math.abs(M.squadValue(cs.squad, next, next, true) - (cb.tot + cb.capV)) < 1e-9,
    "draft " + M.squadValue(roster, next, next, false).toFixed(3) + " vs " + b.tot.toFixed(3));
  let plain = 0; for (let g = next; g <= dEnd; g++) plain += M.bestXI(roster, g).tot;
  ok("the claims sheet values my roster with no armband: valueNow is the sum of plain best elevens to GW" + dEnd + " (" + plain.toFixed(2) + ")",
    Math.abs(PRE.claims.valueNow - plain) < 1e-6, "PRE " + PRE.claims.valueNow);
}
{
  /* No club limit in Draft: a roster already holding three of one club is offered a fourth by the Draft search,
     and the Classic swap rule refuses the same player. The roster and the pool are built here from the block. */
  const club = MC.teams.map((t) => t.s).find((s) => MC.players.filter((p) => p.t === s && p.p === 3).length >= 4);
  const mids = MC.players.filter((p) => p.t === club && p.p === 3).slice(0, 4);
  const built = roster.slice(); let k = 0;
  built.forEach((p, i) => { if (p.p === 3 && k < 3) built[i] = mids[k++]; });
  const counts = built.filter((p) => p.t === club).length, fourth = mids[3];
  const moves = M.draftMoves(built, next, next, { pool: [fourth], perPos: 1 });
  const out = built.find((p) => p.p === 3 && p.t !== club);
  const classicSays = out ? M.legalSwap(built.map((p) => Object.assign({}, p, { sell: p.pr })), Object.assign({}, out, { sell: out.pr }), fourth, 100) : null;
  ok("Draft has no club limit: with " + counts + " " + club + " midfielders on the roster the Draft search still offers a fourth (" + who(fourth) + "), where the Classic swap rule refuses him",
    counts === CLUB_CAP && moves.length > 0 && moves.every((m) => m.add === fourth) && classicSays === false, "moves " + moves.length + " classic " + classicSays);
}

/* ---------------------------------------------------------------- N2 · like for like */
{
  const P = M.P, cross = (list, a, d) => list.filter((q) => { const x = P[a(q)], y = P[d(q)]; return !x || !y || x.p !== y.p; });
  const id = (v) => (v && typeof v === "object" ? v.id : v);
  const sets = [
    ["the engine's claims (draftMoves)", M.draftMoves(roster, next, dEnd, { perPos: 4 }), (m) => id(m.add), (m) => id(m.drop)],
    ["the solved Draft pairs", PLAN.draft.pairs, (q) => q.add, (q) => q.drop],
    ["the contested solve's pairs", (PLAN.draftIfTaken && PLAN.draftIfTaken.pairs) || [], (q) => q.add, (q) => q.drop],
    ["the claims sheet (PRE.claims)", PRE.claims.sheet, (q) => q.add, (q) => q.drop],
    ["the held-back pairs", PRE.claims.held || [], (q) => q.add, (q) => q.drop],
    ["the top Draft moves (PRE.draftMoves)", (PRE.draftMoves.top || []).concat(PRE.draftMoves.backups || []), (q) => q.add, (q) => q.drop]
  ];
  sets.forEach((s) => { const bad = cross(s[1], s[2], s[3]); ok("every claim swaps like for like: " + s[0] + " (" + s[1].length + ")", s[1].length >= 0 && bad.length === 0, bad.slice(0, 3).map((q) => JSON.stringify(q)).join("; ")); });
  const live = AN.findTrades(M, MC), shipped = (PRE.trades.both || []).concat(PRE.trades.ask || []);
  [["the trades found now", live], ["the precomputed trades", shipped]].forEach((s) => {
    const bad = s[1].filter((t) => { const g = P[t.get], v = P[t.give]; return !g || !v || g.p !== v.p || mine.has(t.get) || !mine.has(t.give) || (MC.draft.rosters[t.rival] || []).indexOf(t.get) < 0; });
    ok("every trade swaps like for like, takes from the rival's roster and gives only from mine: " + s[0] + " (" + s[1].length + ")", bad.length === 0, bad.slice(0, 3).map((t) => JSON.stringify(t)).join("; "));
  });
}

/* ---------------------------------------------------------------- N2 · ownership, phase and order */
{
  const fa = M.freeAgents(), locked = M.lockedFreeAgents(), pool = M.waiverPool();
  const statuses = new Set(MC.players.filter((p) => p.did).map((p) => p.ds));
  ok("every Draft player's status is o, a or l, and every rostered player is o (" + [...statuses].join(",") + ")",
    [...statuses].every((s) => ["o", "a", "l"].indexOf(s) >= 0) && Object.values(MC.draft.rosters).every((r) => r.every((i) => M.P[i].ds === "o")), "");
  ok("the claim pool is the free agents plus the locked (" + fa.length + " + " + locked.length + "), owned by nobody and never on my roster",
    pool.length === fa.length + locked.length && pool.every((p) => !p.do && (p.ds === "a" || p.ds === "l")) && pool.every((p) => !mine.has(p.id)), "");
  const phase = (processed) => {
    const c = clone(MC); c.draft.waiversProcessed = processed;
    const lk = c.players.find((p) => p.did && !p.do && p.ds === "a" && p.st !== "u"); lk.ds = "l";      // a player dropped since the last run
    const E = ENG.create(c), P = E.waiverPool(), lab = (p) => E.howToGet(p);
    return { claims: AN.claimability(E, c), a: P.filter((p) => p.ds === "a").map(lab), l: P.filter((p) => p.ds === "l").map(lab) };
  };
  const before = phase(false), after = phase(true), uniq = (a) => [...new Set(a)].join(",");
  ok("before waivers settle every unowned player is a claim (" + before.a.length + " available: " + uniq(before.a) + "; locked: " + uniq(before.l) + "; phase " + before.claims.phase + ")",
    before.a.every((x) => x === "waiver") && before.l.every((x) => x === "waiver") && before.l.length > 0 && before.claims.phase === "claims", "");
  ok("after waivers settle an available player signs at once and a locked one is still a claim (available: " + uniq(after.a) + "; locked: " + uniq(after.l) + "; phase " + after.claims.phase + ")",
    after.a.every((x) => x === "free") && after.l.every((x) => x === "waiver") && after.l.length > 0 && after.claims.phase === "free", "");
  const shippedLabels = pool.map((p) => M.howToGet(p)), want = MC.draft.waiversProcessed ? null : "waiver";
  ok("the shipped block's labels follow its own phase (waivers " + (MC.draft.waiversProcessed ? "settled" : "not settled") + ")",
    want ? shippedLabels.every((x) => x === want) : pool.every((p) => M.howToGet(p) === (p.ds === "l" ? "waiver" : "free")), uniq(shippedLabels));
  const E = MC.draft.entries, picks = E.map((e) => e.waiver).sort((a, b) => a - b);
  const read = E.slice().sort((a, b) => a.waiver - b.waiver).map((e) => e.name), order = M.waiverOrder();
  const table = MC.draft.standings.slice().sort((a, b) => b.rank - a.rank || a.pf - b.pf).map((s) => s.name);
  ok("the waiver order is read from waiver_pick, a permutation of the league's " + E.length + " places; I claim " + (order.indexOf(MC.draft.me) + 1) + " of " + E.length +
    (order.join("|") === table.join("|") ? " (it matches the reverse table today)" : " (it differs from the reverse table today, which is allowed: the picks are set at the last run)"),
    order.join("|") === read.join("|") && picks.every((w, i) => w === i + 1), picks.join(","));
}

finish();

#!/usr/bin/env node
/*
 * pipeline/weekly.cjs — writes data/weekly.js, the WEEKLY block the app reads (CONTRACT §4), from the solved plan.
 *
 *   node pipeline/weekly.cjs --version 110 [--dry-run]
 *
 * Stage 7 of the pipeline, after plan.cjs. v110 §1.4 says extend the path the app already receives baked data
 * through, and §1.7 says every figure shown is computed at build time; before this file the block was typed by
 * hand, so every refresh re-typed fifteen ids, two captains and a claims list. Now the decisions come from:
 *
 *   Classic   data/plan.json — the first planned week's squad, captain and vice, chip, and the no-wildcard
 *             scenario's first week as the fallback; the chip weeks of the whole plan; the timing scenarios.
 *   Draft     buildClaimSheet (src/mc_analysis.js) on the solved roster's pairs (PLAN.draft.pairs), with the
 *             Monte Carlo orderings — the same call data/pre.json makes, so the two can never disagree; the
 *             eleven is the best eleven of the roster the stress test leaves (src/mc_engine.js bestXI).
 *   Checks    the app's own engine (src/engine.js) on data/live.json: legal15, bestXI, flags, convergence.
 *             The rule C1.6 exemption is declared, never assumed: every player in the written fifteen at or
 *             over the rival-ownership gate goes into `locks`, because the plan maximises expected points
 *             (v110 §1.2) and the gate protects mini-league rank; both are priced on the Plan tab.
 *
 * GUARDS. The plan must have been solved on this block: PLAN.hash must equal the export hash of
 * data/mc_data.json (pipeline/export.js buildInput), or the script exits 3 and writes nothing (E-101: content,
 * never clocks). The block records that hash, so a later check can tell a stale block from a fresh one.
 * A replaced plan is recorded, never deleted: the previous block's decision becomes `superseded`, and its own
 * `superseded` rides inside it as `previous`. A re-run for the same version keeps the record it already has.
 * Conflicts with the app's rules (a flagged player, a captain outside the app's eleven, a claim the app's engine
 * scores as neither forced nor a gain) are PRINTED with the player named, and the exit code is 4 when any
 * exists, so a person decides; the file is still written unless --dry-run, because the suites are the gate.
 */
"use strict";

const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const refuse = (msg, code) => { console.log("weekly.cjs refused: " + msg); process.exit(code || 3); };

function args(argv) {
  const o = { version: null, dry: false, out: path.join(ROOT, "data", "weekly.js") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--version") { o.version = Number(argv[++i]); }
    else if (a === "--dry-run") o.dry = true;
    else if (a === "--out") o.out = path.resolve(argv[++i]);
    else refuse("unknown argument " + a + " (expected --version N, --dry-run, --out file)", 2);
  }
  if (!Number.isInteger(o.version) || o.version < 1) refuse("--version N is required (the app version this block belongs to)", 2);
  return o;
}

const OPT = args(process.argv.slice(2));
const MC = read("data/mc_data.json"), PLAN = read("data/plan.json"), LIVE = read("data/live.json"), STATE = read("state/kwezi.json");
const MCE = require(path.join(ROOT, "src", "mc_engine.js")), AN = require(path.join(ROOT, "src", "mc_analysis.js"));
const E = require(path.join(ROOT, "src", "engine.js"));
const { buildInput } = require("./export.js");
const M = MCE.create(MC), P = M.P;

const HASH = buildInput(MC, M).hash;
if (PLAN.hash !== HASH) refuse("data/plan.json was solved on " + PLAN.hash + " but data/mc_data.json exports " + HASH + "; re-run the solve, then plan.cjs");
if (!PLAN.plan || !PLAN.plan.ok || !PLAN.plan.weeks || !PLAN.plan.weeks.length) refuse("data/plan.json carries no solved Classic plan");
if (!PLAN.draft || !PLAN.draft.ok) refuse("data/plan.json carries no solved Draft roster");

let PREV = null;
try { PREV = (new Function(fs.readFileSync(OPT.out, "utf8") + "\n;return WEEKLY;"))(); } catch (e) { PREV = null; }

const NOW = Date.parse(MC.asOf);
const CTX = E.buildCtx(LIVE, STATE, NOW);
if (!CTX.ok) refuse("src/engine.js could not build a context on data/live.json: " + CTX.error);
const next = MC.gw.next, cEnd = M.CFG.classicEnd, dEnd = M.CFG.draftEnd;
if (PLAN.plan.weeks[0].gw !== next) refuse("the plan starts at GW" + PLAN.plan.weeks[0].gw + " but the block's next gameweek is GW" + next);

const nm = (id) => (P[id] ? P[id].n : CTX.els[id] ? CTX.els[id].web_name : "#" + id);
const code = (id) => { const e = CTX.els[id]; if (!e || !Number.isInteger(Number(e.code))) refuse("no code for classic id " + id + " in data/live.json"); return Number(e.code); };
const POS = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1), f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const money = (tenths) => "£" + (tenths / 10).toFixed(1) + "m";
const sastDate = (iso) => new Date(Date.parse(iso) + 2 * 3600000).toISOString().slice(0, 10);
const CHIP = { wildcard: "WC", bboost: "BB", "3xc": "TC", freehit: "FH" };
const conflicts = [];

/* ─────────────── Classic ─────────────── */
const W = PLAN.plan.weeks, w0 = W[0], R0 = PLAN.replay && PLAN.replay.weeks ? PLAN.replay.weeks[0] : null;
const kind = w0.chip === "wildcard" ? "wildcard" : (w0.in && w0.in.length ? "transfers" : "hold");
const fifteen = w0.squad.slice();
const cost = fifteen.reduce((s, id) => s + Number(CTX.els[id].now_cost), 0);
const L15 = E.legal15(fifteen, CTX.els, CTX.budget);
if (!L15.ok) conflicts.push("the planned fifteen is not legal15 under the app's engine: " + L15.reasons.join("; "));
const flagged = fifteen.filter((id) => (CTX.flags[id] || {}).flagged);
if (flagged.length) conflicts.push("the planned fifteen carries flagged players: " + flagged.map((id) => nm(id) + " " + CTX.els[id].status + " " + CTX.els[id].chance_of_playing_next_round + "%").join(", "));
const appXI = E.bestXI(fifteen, CTX);
[["captain", w0.cap], ["vice", w0.vice]].forEach(([k, id]) => { if (appXI.ids.indexOf(id) < 0) conflicts.push("the plan's " + k + " " + nm(id) + " is not in the app engine's eleven of the fifteen (" + appXI.formation + ")"); });
const locksWc = fifteen.filter((id) => E.convergenceRisk(id, CTX).risk);

// The fallback. The optimiser's no-wildcard week is preferred when it passes every hard rule the app enforces on a
// written fallback (qa/smoke_wk.cjs: the Konsa rule, at most two incoming per club, buys status a, unflagged and
// starting, captain and vice in the app engine's eleven, the bank not negative on raw prices). When it does not, the
// app's own rule-bound weekly protocol (src/engine.js transferProtocol, CLAUDE.md C2) is written instead, and the
// block says which and why — a hard rule is never traded for points silently (CLAUDE.md A2.4).
const NW = PLAN.noWildcard && PLAN.noWildcard.ok ? PLAN.noWildcard : null;
const pairUp = (outs, ins) => {
  const byPos = (ids) => ids.map((i) => P[i]).filter(Boolean).sort((a, b) => a.p - b.p || b.pr - a.pr);
  const o = byPos(outs), n = byPos(ins), res = [];
  [1, 2, 3, 4].forEach((k) => { const a = o.filter((x) => x.p === k), b = n.filter((x) => x.p === k); a.forEach((x, j) => { if (b[j]) res.push({ out: x.id, in: b[j].id }); }); });
  return res;
};
const squadAfter = (moves) => CTX.squadIds.filter((id) => !moves.some((m) => m.out === id)).concat(moves.map((m) => m.in));
function fallbackBreaks(moves, cap, vice) {
  const why = [], xi = E.bestXI(squadAfter(moves), CTX), club = {};
  moves.forEach((m) => {
    if ((CTX.gwStats[m.out] || {}).konsa === true) why.push("sells " + nm(m.out) + ", protected by the Konsa rule");
    const e = CTX.els[m.in], gs = CTX.gwStats[m.in] || {};
    if (!e || e.status !== "a" || (CTX.flags[m.in] || {}).flagged) why.push("buys " + nm(m.in) + ", who is flagged or not status a");
    if (!(e && e.starts >= 1) || !(gs.starts_last3 >= 1)) why.push("buys " + nm(m.in) + ", who has not started recently");
    club[e ? e.team : 0] = (club[e ? e.team : 0] || 0) + 1;
  });
  Object.keys(club).forEach((t) => { if (club[t] > 2) why.push("brings in " + club[t] + " from one club"); });
  const bank = moves.reduce((b, m) => b + E.sellPrice(Number(CTX.els[m.out].now_cost), CTX.purchase[m.out] === undefined ? null : CTX.purchase[m.out]) - Number(CTX.els[m.in].now_cost), CTX.bank);
  if (bank < 0) why.push("leaves the bank at " + bank + " tenths");
  [["captain", cap], ["vice", vice]].forEach(([k, id]) => { if (xi.ids.indexOf(id) < 0) why.push("its " + k + " " + nm(id) + " is not in the app engine's eleven"); if ((CTX.flags[id] || {}).flagged) why.push("its " + k + " " + nm(id) + " is flagged"); });
  if (cap === vice) why.push("captain and vice are the same player");
  return why;
}
const nw0 = NW ? NW.weeks[0] : null;
let fbMoves = nw0 ? pairUp(nw0.out || [], nw0.in || []) : [], fbCap = nw0 ? nw0.cap : null, fbVice = nw0 ? nw0.vice : null, fbSource, fbWhy = [];
if (nw0 && fbMoves.length !== (nw0.in || []).length) fbWhy.push("its transfers do not pair position for position");
if (nw0) fbWhy = fbWhy.concat(fallbackBreaks(fbMoves, fbCap, fbVice));
if (nw0 && !fbWhy.length) fbSource = "the optimiser's no-wildcard scenario, week one (data/plan.json noWildcard, " + f2(NW.total) + " Classic expected points to GW" + cEnd + ")";
else {
  const tp = E.transferProtocol(null, CTX);
  fbMoves = tp.moves.map((m) => ({ out: m.out, in: m.in }));
  const cp = E.captainPick(E.bestXI(squadAfter(fbMoves), CTX).ids, CTX);
  fbCap = cp.capId; fbVice = cp.viceId;
  fbSource = "src/engine.js transferProtocol (CLAUDE.md C2), because the optimiser's no-wildcard week " + (nw0 ? fbWhy.join("; ") : "is absent") + "; " + fbMoves.length + " moves, " + (tp.hits / 4) + " hit" + (tp.hits === 4 ? "" : "s") + ", confidence " + tp.confidence;
  const still = fallbackBreaks(fbMoves, fbCap, fbVice);
  if (still.length) conflicts.push("the app's own fallback breaks its rules: " + still.join("; "));
}
const fbConvergent = fbMoves.map((m) => m.in).filter((id) => E.convergenceRisk(id, CTX).risk);

const locks = [...new Set(locksWc.concat(fbConvergent))].sort((a, b) => a - b);
const chipWeeks = W.filter((w) => w.chip).map((w) => ({ set: 1, chip: CHIP[w.chip] || w.chip, gw: w.gw, captain: w.cap }));
const T = PLAN.timing || {}, laterWc = T.later && T.later.weeks ? (T.later.weeks.find((w) => w.chip === "wildcard") || {}).gw : null;
const wcWeek = (r) => (r && r.weeks ? (r.weeks.find((w) => w.chip === "wildcard") || {}).gw : null) || null;
const LT = T.latest && T.latest.ok && T.latest.constructed === true ? T.latest : null;   // the wildcard as late as the rules allow: the never plan, then the wildcard in the last week
const latestWc = wcWeek(LT);
const fhBest = (PLAN.freeHit || []).filter((f) => f.free && f.affordable).sort((a, b) => b.gain - a.gain)[0] || null;
const buys = w0.in || [], sells = w0.out || [];

/* ─────────────── Draft ─────────────── */
const sheet = AN.buildClaimSheet(M, MC, PLAN.draft.pairs, { mc: true, fitOnly: true });   // no flagged player lodged (CLAUDE.md D2)
const CP = { held: sheet.held };
const tag = (c) => sheet.landed.indexOf(c.add) >= 0 ? "lands" : sheet.lost.indexOf(c.add) >= 0 ? "taken first" : "not reached";
const claims = sheet.sheet.map((c) => ({
  out: code(c.drop), in: code(c.add),
  why: nm(c.add) + " for " + nm(c.drop) + " (" + POS[P[c.add].p] + "), " + (c.kind === "backup" ? "backup for " + nm(c.of) : "first choice") +
    ": +" + f1(c.gain) + " Draft expected points to GW" + dEnd + (sheet.land && sheet.land[c.add] !== undefined ? ", lands in " + Math.round(100 * sheet.land[c.add]) + "% of " + sheet.runs + " simulated waiver runs" : "") +
    ", stress test: " + tag(c)
}));
const rosterNow = M.draftRoster().map((p) => p.id);
const after = rosterNow.slice();
sheet.sim.filter((x) => x.ok).forEach((x) => { const k = after.indexOf(x.drop); if (k >= 0) after[k] = x.add; });
const dxi = M.bestXI(after.map((id) => P[id]).filter(Boolean), next);
const byP = (k) => dxi.xi.filter((p) => p.p === k).map((p) => code(p.id));
// Every written claim is forced (out not status a, or no start in three) or a gain to the Draft horizon under the
// engine that ranks the sheet (qa/smoke_wk.cjs check 28, E-126), and its incoming player is status a. The app's older
// five-gameweek draftEV is asked too, and a disagreement is printed as a note, not a conflict.
const notes5 = [];
sheet.sheet.forEach((q) => {
  const o = E.draftEl(code(q.drop), CTX), i = E.draftEl(code(q.add), CTX);
  if (!o || !i) { conflicts.push("claim " + nm(q.add) + " for " + nm(q.drop) + ": a code does not resolve in data/live.json"); return; }
  const eo = E.draftEV(o, CTX), ei = E.draftEV(i, CTX), forced = String(o.status) !== "a" || eo.starts_last3 === 0;
  const g = M.epRange(P[q.add], next, dEnd) - M.epRange(P[q.drop], next, dEnd);
  if (!forced && !(g > 0)) conflicts.push("claim " + i.web_name + " for " + o.web_name + " is neither forced nor a gain to GW" + dEnd + " (" + f2(g) + ")");
  if (!forced && ei.ev - eo.ev <= 0) notes5.push(i.web_name + " for " + o.web_name + " " + f2(ei.ev - eo.ev));
  if (String(i.status) !== "a") conflicts.push("claim " + i.web_name + " is status " + i.status + " in the Draft feed");
});
// CLAUDE.md B3: wildcard picks have three starts of the last three, P(start) at least 0.75 and status a. The
// optimiser prices minutes through P(start) instead of a hard floor, so a buy under the floor is reported by name.
const b3 = buys.filter((id) => { const gs = CTX.gwStats[id] || {}; const e = CTX.els[id]; return !(gs.starts_last3 >= 3) || !(e && e.status === "a") || !((CTX.xp[id] || {}).pstart >= 0.75); })
  .map((id) => nm(id) + " (" + ((CTX.gwStats[id] || {}).starts_last3) + "/3 starts, P(start) " + f2((CTX.xp[id] || {}).pstart || 0) + ", " + (CTX.els[id] || {}).status + ")");

/* ─────────────── the record of what this replaces ─────────────── */
let superseded;
if (PREV && PREV.version === OPT.version && PREV.superseded) superseded = PREV.superseded;
else if (PREV && PREV.classic) {
  const pc = PREV.classic, prevIds = (pc.wildcard15 || []).filter((id) => P[id]);
  const v = (ids) => M.squadValue(ids.map((i) => P[i]).filter(Boolean), next, cEnd, true);
  superseded = {
    version: PREV.version, gw: PREV.gw, plan: pc.plan,
    what: (pc.plan === "wildcard" ? "Play Wildcard 1 in GW" + PREV.gw + " with " : "The fifteen ") + (pc.wildcard15 || []).map(nm).join(", ") + "; captain " + nm(pc.captain) + ", vice " + nm(pc.vice) + ".",
    outcome: "Superseded on " + sastDate(MC.asOf) + ", before the GW" + next + " deadline, by the v" + OPT.version + " solved plan; never played.",
    measured: "src/mc_engine.js squadValue, each fifteen held unchanged from GW" + next + " to GW" + cEnd + " with its best eleven and captain every week: v" + PREV.version + "'s " + f1(v(prevIds)) + " Classic expected points against v" + OPT.version + "'s " + f1(v(fifteen)) + " (the v" + OPT.version + " plan's own total, with its later transfers and chips, is " + f2(PLAN.plan.total) + ").",
    evidence: "data/plan.json hash " + PLAN.hash + " · v" + PREV.version + " was written " + PREV.written + " from " + PREV.source
  };
  if (PREV.superseded) superseded.previous = PREV.superseded;
}

/* ─────────────── tournament and the app engine's timing note ─────────────── */
const TN = E.tournament(LIVE), WT = E.wildcardTiming(CTX);

/* ─────────────── write ─────────────── */
const J = (x) => JSON.stringify(x);
const ids = (arr) => "[" + arr.join(", ") + "]";
const lines = [];
const L = (s) => lines.push(s);
L("// WEEKLY STRATEGY ENGINE — decisions only (CONTRACT §4). WRITTEN BY pipeline/weekly.cjs — do not edit by hand;");
L("// change the inputs and re-run it after pipeline/plan.cjs. Classic entries are FPL element ids; Draft entries are");
L("// player codes (join on code, never on id). The figures in the comments and the why lines are the plan's own at");
L("// the moment of writing; the app's engines recompute every figure it shows.");
L("// Plan " + PLAN.hash + " (" + (PLAN.source && PLAN.source.solvedBy) + "), block baked " + MC.asOf + ", live snapshot " + LIVE.fetched_at + ".");
L("const WEEKLY = {");
L("  version: " + OPT.version + ", gw: " + next + ", written: " + J(sastDate(MC.asOf)) + ", hash: " + J(PLAN.hash) + ",");
L("  source: " + J("pipeline/plan.cjs on data/mc_data.json baked " + MC.asOf + " (export hash " + HASH + "); data/live.json fetched " + LIVE.fetched_at) + ",");
L("");
L("  // The plan this block replaces, recorded rather than deleted (v89 rule). `previous` carries the one before it.");
L("  superseded: " + JSON.stringify(superseded || null, null, 2).split("\n").join("\n  ") + ",");
L("");
L("  classic: {");
L("    plan: " + J(kind) + ",                                   // \"wildcard\" | \"transfers\" | \"hold\"");
L("    // data/plan.json weeks[0].squad: " + fifteen.map(nm).join(", ") + ".");
L("    // Buys " + buys.map(nm).join(", ") + "; sells " + sells.map(nm).join(", ") + ".");
L("    wildcard15: " + ids(fifteen) + ",");
L("    // Rule C1.6's only exemption, declared (smoke_wk reads it): the fifteen's players at or over the 60% rival-ownership");
L("    // gate. The plan keeps them because they maximise expected points (v110 §1.2).");
L("    locks: " + ids(locks) + ",");
L("    // The fifteen's cost at today's prices, recorded so the Plan tab reads it out of the block (E-088).");
L("    wildcard15_cost_written: " + cost + ",");
L("    captain: " + w0.cap + ", vice: " + w0.vice + ",                            // " + nm(w0.cap) + ", " + nm(w0.vice) + " — the plan's own armband for GW" + next);
L("    // Without the chip: " + fbSource + ".");
L("    fallback: {");
L("      moves: " + J(fbMoves).replace(/"(\w+)":/g, "$1: ").replace(/,(?=[a-z{])/g, ", ") + ",");
L("      captain: " + fbCap + ", vice: " + fbVice + "                            // " + nm(fbCap) + ", " + nm(fbVice));
L("    },");
L("    chip: " + J(w0.chip || null) + ",");
L("    notes: " + JSON.stringify([
  "The plan is the optimiser's (pipeline/solve.py, HiGHS), proved within " + f2(100 * PLAN.plan.gap) + "% of the best possible: " + f2(PLAN.plan.total) + " Classic expected points from GW" + next + " to GW" + cEnd + ", " + W.reduce((s, w) => s + (w.hits || 0), 0) + " hits.",
  "Chips in the plan: " + chipWeeks.map((c) => c.chip + " GW" + c.gw + (c.chip === "TC" ? " on " + nm(c.captain) : "")).join(", ") + (fhBest ? "; the best free-hit week is GW" + fhBest.gw + " at +" + f2(fhBest.gain) + ", not taken." : "."),
  "Free transfers come from the replayed ledger (data/plan.json replay), never the solver's own variables: " + (R0 ? R0.ftBefore + " into GW" + next + ", " + R0.ftAfter + " after it" + (w0.chip === "wildcard" ? ", because a wildcard week keeps the count." : ".") : "no replay."),
  locks.length ? locks.map(nm).join(", ") + (locks.length === 1 ? " is" : " are") + " at or over the 60% rival-ownership gate and kept on purpose; the rule-pure search on the Plan tab prices the difference." : "No player in the fifteen is over the rival-ownership gate."
], null, 2).split("\n").join("\n    ") + ",");
L("    why: " + JSON.stringify([
  "Timing (data/plan.json timing): wildcard now " + f2(T.now ? T.now.total : PLAN.plan.total) + (T.later ? ", later (GW" + laterWc + ") " + f2(T.later.total) : "") + (T.never ? ", never " + f2(T.never.total) : "") + " Classic expected points to GW" + cEnd + ".",
  LT ? "The wildcard as late as the rules allow, GW" + latestWc + " (the last deadline before set one expires): the no-wildcard plan to the week before, then the fifteen rebuilt for that week" + (LT.reshuffle ? " (" + LT.reshuffle.changes + " changes, " + f2(LT.reshuffle.gain) + " that week)" : "") + ", worth " + f2(LT.total) + " Classic expected points, which is " + f2(PLAN.plan.total - LT.total) + " below the plan, so waiting to the end costs at most that plus the proof tolerance. It is a plan built from a proven one and replayed against the rules, and a floor, not a proved best. Points are counted only to GW" + cEnd + ", so a wildcard played in the last week is credited with that week alone and none after it: the cost is what waiting gives up, not the whole comparison." : "The wildcard as late as the rules allow was not built for this data.",
  (function () {
    // Two solves bound the no-wildcard problem (noWildcard, and the timing file's "never"); quote the better one, so the
    // chip's worth is never overstated.
    const best = Math.max(NW ? NW.total : -Infinity, T.never ? T.never.total : -Infinity);
    return isFinite(best) ? "Without the wildcard the best plan found is " + f2(best) + ", so the chip is worth " + f2(PLAN.plan.total - best) + " over the window." : "Without the wildcard: not solved.";
  })(),
  "The app's own timing model (src/engine.js wildcardTiming) puts the five-gameweek deficit of the current fifteen at " + f1(WT.sumDeficit5) + " and the break-even for waiting at " + f1(WT.breakeven.byGw19 || 0) + " by GW19."
], null, 2).split("\n").join("\n    "));
L("  },");
L("");
L("  draft: {");
L("    // buildClaimSheet (src/mc_analysis.js) on the solved roster's pairs, with the Monte Carlo orderings — the same call");
L("    // data/pre.json makes. Lodge in exactly this order: " + (sheet.strategy === "firsts" ? "every first choice, then the backups" : "each backup directly under its first choice") + " — the ordering that lands more value under the league's own processing (strategy " + J(sheet.strategy) + ").");
if (sheet.orderings) L("    // Monte Carlo over " + sheet.runs + " runs, mean Draft value by ordering: " + sheet.orderings.map((o) => o.name + " " + f1(o.mean)).join("; ") + ".");
L("    pool: \"api\",");
L("    pool_note: " + J("League " + MC.draft.league.id + ": the ins are free agents in the league's own feed, and the waiver model reproduces the league's claim log (qa/waiver_log.cjs). " + sheet.sheet.length + " claims, " + sheet.sheet.filter((c) => c.kind === "backup").length + " of them backups." + (CP.held.length ? " Held back because the player is flagged (re-check after the pressers): " + CP.held.map((h) => nm(h.add) + " for " + nm(h.drop) + " (status " + h.status + (h.chance !== null ? ", " + h.chance + "%" : "") + ")").join(", ") + "." : "")) + ",");
L("    claims: [");
claims.forEach((c, i) => L("      { out: " + c.out + ", in: " + c.in + ", why: " + J(c.why) + " }" + (i < claims.length - 1 ? "," : "")));
L("    ],");
L("    // The best eleven of the roster the stress test leaves (src/mc_engine.js bestXI for GW" + next + "): " + dxi.form + ", " + dxi.xi.map((p) => p.n).join(", ") + ".");
L("    xi: {");
L("      formation: " + J(dxi.form) + ",");
L("      gk: " + byP(1)[0] + ",");
L("      def: " + ids(byP(2)) + ",");
L("      mid: " + ids(byP(3)) + ",");
L("      fwd: " + ids(byP(4)));
L("    },");
L("    watchlist: " + J(PREV && PREV.draft && Array.isArray(PREV.draft.watchlist) ? PREV.draft.watchlist : []));
L("  },");
L("");
L("  chips: {");
L("    set1_expires_gw: " + MC.rules.chipStop + ",");
L("    planned: " + J(chipWeeks.map((c) => ({ set: c.set, chip: c.chip, gw: c.gw }))).replace(/"(\w+)":/g, "$1: ").replace(/,(?=[a-z])/g, ", ") + ",");
L("    note: " + J("Chips from data/plan.json: " + chipWeeks.map((c) => c.chip + " GW" + c.gw).join(", ") + "." + (fhBest ? " The free hit is held; its best week is GW" + fhBest.gw + "." : "")));
L("  },");
L("");
L("  // tournament(live) on data/live.json: notes only; the engine recomputes them every render.");
L("  tournament: { leader: " + J(TN.leader) + ", transitions: " + TN.transitions + ", promote_at_gw: " + (TN.promotable ? "null" : next) + " },");
L("");
L("  // wildcardTiming(ctx) — the app engine's note; `solved` is the optimiser's (data/plan.json timing).");
L("  timing: { now_vs_later: { by_gw19: " + Math.round(WT.breakeven.byGw19 || 0) + ", by_gw38: " + Math.round(WT.breakeven.byGw38 || 0) + ", breakeven_double_gw17: null, breakeven_later_value: " + Math.round(WT.breakeven.byGw19 || 0) + " },");
L("    solved: { now: " + (T.now ? T.now.total : "null") + ", later: " + (T.later ? T.later.total : "null") + ", later_gw: " + (laterWc || "null") + ", never: " + (T.never ? T.never.total : "null") + ", latest: " + (LT ? LT.total : "null") + ", latest_gw: " + (latestWc || "null") + " } }");
L("};");
const text = lines.join("\n") + "\n";

// the written file must evaluate to the object it describes
const back = (new Function(text + "\n;return WEEKLY;"))();
if (back.hash !== PLAN.hash || back.classic.wildcard15.length !== 15 || back.draft.claims.length !== claims.length) refuse("the written block does not read back", 5);

console.log("weekly.cjs · v" + OPT.version + " GW" + next + " · plan " + PLAN.hash + " · " + kind + " · captain " + nm(w0.cap) + ", vice " + nm(w0.vice) +
  " · chips " + chipWeeks.map((c) => c.chip + " GW" + c.gw).join(", ") + " · locks " + (locks.map(nm).join(", ") || "none") + " · cost " + money(cost) + " of " + money(CTX.budget) +
  " · fallback " + fbMoves.map((m) => nm(m.out) + "→" + nm(m.in)).join(", ") + " (captain " + nm(fbCap) + ", from " + (fbSource.indexOf("transferProtocol") >= 0 ? "the app's protocol" : "the optimiser") + ")" +
  " · Draft " + claims.length + " claims (" + sheet.strategy + "), mean " + (sheet.meanValue !== undefined ? f1(sheet.meanValue) : "-") + " p10 " + (sheet.p10 !== undefined ? f1(sheet.p10) : "-") + " p90 " + (sheet.p90 !== undefined ? f1(sheet.p90) : "-") + ", stress " + f1(sheet.valueStress) + ", all first " + f1(sheet.valueAll) + ", now " + f1(sheet.valueNow));
claims.forEach((c, i) => console.log("  " + (i + 1) + ". " + c.why));
if (CP.held.length) console.log("held back (flagged): " + CP.held.map((h) => nm(h.add) + " for " + nm(h.drop) + " " + h.status + (h.chance !== null ? " " + h.chance + "%" : "")).join(", "));
if (notes5.length) console.log("note: src/engine.js draftEV (five gameweeks) scores " + notes5.length + " of the claims as no gain: " + notes5.join(", "));
// CLAUDE.md C1 rule 1 (the Konsa rule): never sell a player who started his club's last match after a spell out.
// On the wildcard every place is re-picked, so a protected player the optimiser lets go is reported, not refused.
const konsa = sells.filter((id) => (CTX.gwStats[id] || {}).konsa === true);
if (konsa.length) console.log("note: the wildcard lets go of " + konsa.map(nm).join(", ") + ", whom the Konsa rule protects from a weekly sale (started the last match after a spell out)");
if (b3.length) console.log("note: wildcard buys under CLAUDE.md B3's floor (three starts of three, P(start) 0.75, status a): " + b3.join(", "));
if (conflicts.length) { console.log("CONFLICTS with the app's rules (" + conflicts.length + "):"); conflicts.forEach((c) => console.log("  - " + c)); }
if (OPT.dry) { console.log("--dry-run: nothing written"); process.stdout.write(text.slice(0, 0)); }
else { fs.writeFileSync(OPT.out, text); console.log("wrote " + path.relative(process.cwd(), OPT.out) + " (" + text.length + " chars)"); }
process.exit(conflicts.length ? 4 : 0);

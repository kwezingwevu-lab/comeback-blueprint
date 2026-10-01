#!/usr/bin/env node
/*
 * qa/mc_data.cjs — the baked block the ported engine reads is whole and consistent (v110 §5 E1 "data";
 * the kit's qa.js group 1, lines 13–36).
 *
 *   node qa/mc_data.cjs
 *
 * WHAT IT PROVES, on data/mc_data.json read through src/mc_engine.js (MCEngine.create):
 *   · the gameweek pointers agree: live at or after the last finished one, next the one after (or live itself);
 *     every event flagged finished is exactly an event at or before the last finished one; deadlines rise
 *   · the fixture list is a double round robin of the clubs the block carries — clubs × (clubs − 1) fixtures,
 *     2 × (clubs − 1) per club, every gameweek inside the season's event list — and the engine's per-team
 *     fixture lookup (M.fx) returns exactly what the list holds for every club and every gameweek, so a blank
 *     or a double is read as it is rather than failing the gate (the kit's own comment on its line 20)
 *   · every player carries a club the block knows and a position 1–4, at a price inside the kit's sanity band
 *   · every Draft roster is fifteen, 2/5/5/3, no player is on two rosters, and every rostered player's owner
 *     field names the roster that holds him
 *   · the Draft table adds up (3 a win, 1 a draw), everyone has played the same number of matches, each team's
 *     played count and points for and against reconcile with the finished matches, and the league scores what
 *     it concedes
 *   · the Classic season total is the sum of its weeks, in both the history (season) and the published weeks (gws)
 *   · the bank follows the transfer log: each published week's bank is the week before's plus what that week's
 *     transfers freed (selling price out less price in), and each week's transfer count is the log's (kit line 152,
 *     made per week; a free-hit week and the week after it are left out, because the bank reverts)
 *   · the selling prices taken off the 18 Sep Transfers screen name players who exist (kit line 33; the prices
 *     themselves are never used for display, v110 §6 and ERRORS.md E-111)
 *   · the re-draft is read from the league settings (the first unfinished draft) and the engine's Draft horizon
 *     stops the gameweek before it, while the Classic horizon is the block's chip stop (Part N2, §7.12)
 *
 * ALREADY PROVED ELSEWHERE, CITED AND NOT PORTED TWICE
 *   kit 32  free transfers inside the cap ........ qa/bake.cjs "A5 repo block: ftNext sits inside [1, maxFt] …"
 *   kit 149 every Classic week rebuilds exactly .. qa/bake.cjs A4 (recon rows, rebuilt recomputed from the picks)
 *   kit 151 every logged transfer is in the next published squad .. qa/bake.cjs A6 (cross-checked against the squads)
 *   kit 153 free transfers follow the published history ........... qa/bake.cjs A5 (ftLedger on the block's own weeks)
 *   kit 161 every loaded price is a real fixture .. qa/bake.cjs A7 (odds rows)
 *   the block, the plan, the precompute and WEEKLY share one content hash .. qa/verify.sh I23, qa/export_hash.cjs
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   Every expectation is derived from the block itself (the club count, the event list, the league's own
 *   entries) or is a rule of the game, marked frozen-ok with the rule named. No gameweek number, count, price
 *   or league position is typed here.
 *
 * MUTATION
 *   The roster-shape check is re-run on a copy of the block in which one Draft roster's goalkeeper is swapped
 *   for an outfield player, and must go red; the line it would print is quoted in the PASS detail (E-070).
 *
 * PRIVACY
 *   Draft entries appear as team names only. Nothing here reads or prints a manager's personal name.
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
/* The line ok() would print for a failing check, without counting it: how a mutation quotes its red line. */
const redLine = (name, cond, detail) => (cond ? null : "RED " + name + (detail ? " — " + detail : ""));
const finish = () => { console.log("SUITE mc_data " + pass + "/" + (pass + fail)); process.exit(fail ? 1 : 0); };
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (e) { return null; } };
const clone = (o) => JSON.parse(JSON.stringify(o));

/* Rules of the game, not observations. */
const SHAPE = { 1: 2, 2: 5, 3: 5, 4: 3 };      // frozen-ok: Part N1/N2 — a squad is 2 GKP, 5 DEF, 5 MID, 3 FWD
const SQUAD = 15;                              // frozen-ok: Part N1/N2 — fifteen players
const WIN = 3, DRAW = 1;                       // frozen-ok: head-to-head league points, 3 a win and 1 a draw
const PRICE_BAND = [3.5, 16];                  // frozen-ok: the kit's sanity band (qa.js line 23) — a range, not a fact

const MC = readJson("data/mc_data.json");
ok("data/mc_data.json is readable and carries the blocks the engine reads",
  !!MC && !!MC.gw && Array.isArray(MC.fixtures) && Array.isArray(MC.teams) && Array.isArray(MC.players) && !!MC.draft && !!MC.classic && !!MC.rules,
  MC ? Object.keys(MC).join(",") : "unreadable");
if (!MC) finish();
let M = null;
try { M = ENG.create(MC); } catch (e) { ok("MCEngine.create(MC) runs on the block", false, e.message); finish(); }
ok("MCEngine.create(MC) runs on the block", !!M && typeof M.fx === "function", "");

const G = MC.gw, next = G.next, live = G.live;
const teamSet = new Set(MC.teams.map((t) => t.s));
const counts = (ids) => { const c = { 1: 0, 2: 0, 3: 0, 4: 0 }; ids.forEach((id) => { const p = M.P[id]; if (p) c[p.p]++; }); return c; };
const shapeText = (c) => c[1] + "-" + c[2] + "-" + c[3] + "-" + c[4];

/* ---------------------------------------------------------------- gameweeks */
ok("the live gameweek is at or after the last finished one (live " + live + ", last finished " + G.lastDone + ")", live >= G.lastDone, "");
ok("the next gameweek follows the live one, or is the live one", next === live + 1 || next === live, "live " + live + " next " + next);
{
  const badFin = G.events.filter((e) => !!e.fin !== (e.id <= G.lastDone)).map((e) => "GW" + e.id + " fin " + !!e.fin);
  ok("an event is finished exactly when it is at or before the last finished gameweek", badFin.length === 0, badFin.join(", "));
  const badDl = G.events.filter((e, i) => i > 0 && !(Date.parse(e.dl) > Date.parse(G.events[i - 1].dl))).map((e) => "GW" + e.id);
  ok("every deadline is a date and each is later than the one before (" + G.events.length + " events)",
    G.events.every((e) => isFinite(Date.parse(e.dl))) && badDl.length === 0, badDl.join(", "));
}

/* ---------------------------------------------------------------- fixtures */
const clubs = MC.teams.length, season = G.events.length;
ok("every fixture has two different clubs the block knows",
  MC.fixtures.every((f) => f.h && f.a && f.h !== f.a && teamSet.has(f.h) && teamSet.has(f.a)),
  MC.fixtures.filter((f) => !(f.h && f.a && f.h !== f.a && teamSet.has(f.h) && teamSet.has(f.a))).slice(0, 5).map((f) => f.id + ":" + f.h + "v" + f.a).join(" "));
{
  /* A double round robin: every club meets every other club home and away. The count follows from the club
     list, and the season's gameweeks are the rounds, so none of the three numbers is typed. */
  const per = {}; MC.fixtures.forEach((f) => { per[f.h] = (per[f.h] || 0) + 1; per[f.a] = (per[f.a] || 0) + 1; });
  const bad = MC.teams.filter((t) => per[t.s] !== 2 * (clubs - 1)).map((t) => t.s + ":" + (per[t.s] || 0));
  const outside = MC.fixtures.filter((f) => !(f.gw >= 1 && f.gw <= season));
  ok("the fixture list is a double round robin: " + MC.fixtures.length + " fixtures for " + clubs + " clubs, " + 2 * (clubs - 1) + " each, every gameweek inside the " + season + "-event season",
    MC.fixtures.length === clubs * (clubs - 1) && bad.length === 0 && outside.length === 0 && season === 2 * (clubs - 1),
    "clubs " + clubs + " fixtures " + MC.fixtures.length + " odd counts " + bad.join(",") + " outside " + outside.length + " events " + season);
  /* The kit asserted exactly one fixture per club per gameweek and commented that blanks and doubles are legal.
     The engine is held to the list instead: what M.fx returns is what the list holds, blank or double. */
  let blank = 0, dbl = 0; const miss = [];
  MC.teams.forEach((t) => {
    for (let g = 1; g <= season; g++) {
      const want = MC.fixtures.filter((f) => f.gw === g && (f.h === t.s || f.a === t.s)).length, got = M.fx(t.s, g).length;
      if (want === 0) blank++; if (want > 1) dbl++;
      if (got !== want && miss.length < 5) miss.push(t.s + " GW" + g + " list " + want + " engine " + got);
    }
  });
  ok("the engine reads every club's fixtures in every gameweek as the list holds them (" + blank + " blank, " + dbl + " double club-weeks)", miss.length === 0, miss.join("; "));
}

/* ---------------------------------------------------------------- players */
{
  const noClub = MC.players.filter((p) => !teamSet.has(p.t) || [1, 2, 3, 4].indexOf(p.p) < 0);
  ok("every player carries a club the block knows and a position 1–4 (" + MC.players.length + " players)", noClub.length === 0, noClub.slice(0, 5).map((p) => p.n + "|" + p.t + " p" + p.p).join(", "));
  const prices = MC.players.map((p) => p.pr).filter((x) => typeof x === "number");
  const lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices);
  ok("every price sits inside the kit's sanity band (£" + lo.toFixed(1) + "m to £" + hi.toFixed(1) + "m)",
    prices.length === MC.players.length && lo >= PRICE_BAND[0] && hi <= PRICE_BAND[1], "band " + PRICE_BAND.join("–"));
}

/* ---------------------------------------------------------------- Draft rosters */
function rosterShape(block) {
  const bad = [];
  Object.keys(block.draft.rosters).forEach((nm) => {
    const r = block.draft.rosters[nm], c = { 1: 0, 2: 0, 3: 0, 4: 0 };
    r.forEach((id) => { const p = block.players.find((x) => x.id === id); if (p) c[p.p]++; });
    if (r.length !== SQUAD || [1, 2, 3, 4].some((k) => c[k] !== SHAPE[k])) bad.push(nm + " " + r.length + " players " + shapeText(c));
  });
  return bad;
}
const entryNames = MC.draft.entries.map((e) => e.name);
{
  const bad = rosterShape(MC), N_ROSTER = "every Draft roster holds fifteen, 2/5/5/3 (" + Object.keys(MC.draft.rosters).length + " rosters)";
  ok(N_ROSTER, bad.length === 0, bad.join("; "));
  const seen = new Map(), twice = [];
  Object.keys(MC.draft.rosters).forEach((nm) => MC.draft.rosters[nm].forEach((id) => { if (seen.has(id)) twice.push(id + " on " + seen.get(id) + " and " + nm); seen.set(id, nm); }));
  ok("no player is owned by two Draft teams", twice.length === 0, twice.join("; "));
  const wrongOwner = [];
  seen.forEach((nm, id) => { const p = M.P[id]; if (!p || p.do !== nm) wrongOwner.push(id + " owner " + (p ? p.do : "missing") + " roster " + nm); });
  ok("every rostered player's owner field names the roster that holds him (" + seen.size + " players)", wrongOwner.length === 0, wrongOwner.slice(0, 5).join("; "));
  ok("the roster keys are the league's entries and my team is one of them",
    Object.keys(MC.draft.rosters).every((nm) => entryNames.indexOf(nm) >= 0) && entryNames.indexOf(MC.draft.me) >= 0 && M.draftRoster().length === SQUAD,
    "roster keys " + Object.keys(MC.draft.rosters).length + ", entries " + entryNames.length);

  /* mutation: one roster's first goalkeeper becomes the first outfield player the block holds who is on no roster */
  const mut = clone(MC), victim = Object.keys(mut.draft.rosters)[0];
  const gkAt = mut.draft.rosters[victim].findIndex((id) => M.P[id] && M.P[id].p === 1);
  const spare = mut.players.find((p) => p.p === 2 && !seen.has(p.id));
  if (gkAt >= 0 && spare) mut.draft.rosters[victim][gkAt] = spare.id;
  const badM = rosterShape(mut), line = redLine(N_ROSTER, badM.length === 0, badM.join("; "));
  ok("mutation: a goalkeeper swapped for a defender on one roster turns the roster-shape check red", gkAt >= 0 && !!spare && line !== null,
    line ? "red: " + line : "the check stayed green", true);
}

/* ---------------------------------------------------------------- the Draft table */
{
  const S = MC.draft.standings;
  ok("one standings row per Draft entry, every row an entry (" + S.length + " rows)",
    S.length === MC.draft.entries.length && S.every((s) => entryNames.indexOf(s.name) >= 0) && new Set(S.map((s) => s.name)).size === S.length, "");
  const badPts = S.filter((s) => s.pts !== WIN * s.w + DRAW * s.d).map((s) => s.name + " " + s.pts + " vs " + (WIN * s.w + DRAW * s.d));
  ok("the Draft table adds up: points are 3 a win and 1 a draw", badPts.length === 0, badPts.join("; "));
  const played = new Set(S.map((s) => s.w + s.d + s.l));
  ok("every manager has played the same number of matches (" + [...played].join(",") + ")", played.size === 1, "");
  const fin = MC.draft.matches.filter((m) => m.fin), rec = {};
  fin.forEach((m) => {
    [[m.a, m.ap, m.bp], [m.b, m.bp, m.ap]].forEach((x) => { const r = rec[x[0]] || (rec[x[0]] = { n: 0, pf: 0, pa: 0, w: 0, d: 0, l: 0 }); r.n++; r.pf += x[1]; r.pa += x[2]; if (x[1] > x[2]) r.w++; else if (x[1] === x[2]) r.d++; else r.l++; });
  });
  const badRec = S.filter((s) => { const r = rec[s.name] || {}; return r.n !== s.w + s.d + s.l || r.pf !== s.pf || r.pa !== s.pa || r.w !== s.w || r.d !== s.d || r.l !== s.l; })
    .map((s) => s.name + " table " + s.w + "-" + s.d + "-" + s.l + " " + s.pf + "/" + s.pa + " matches " + JSON.stringify(rec[s.name] || null));
  ok("every team's record and points for and against reconcile with the finished matches (" + fin.length + " matches)", badRec.length === 0, badRec.join("; "));
  const pf = S.reduce((a, s) => a + s.pf, 0), pa = S.reduce((a, s) => a + s.pa, 0);
  ok("points scored across the league equal points conceded (" + pf + ")", pf === pa, pf + " vs " + pa);
}

/* ---------------------------------------------------------------- Classic history */
{
  const C = MC.classic, s1 = C.season.reduce((a, s) => a + s.pts, 0), s2 = C.gws.reduce((a, g) => a + g.pts, 0);
  ok("the Classic season total is the sum of its weeks, in the history and in the published weeks (" + C.total + ")",
    s1 === C.total && s2 === C.total && C.season.length === C.gws.length, "season " + s1 + " gws " + s2 + " total " + C.total);
  const logBy = {}; (C.transfersLog || []).forEach((t) => { (logBy[t.gw] = logBy[t.gw] || []).push(t); });
  const badBank = [];
  for (let i = 1; i < C.gws.length; i++) {
    const w = C.gws[i], prev = C.gws[i - 1], L = logBy[w.gw] || [];
    if (w.chip === "freehit" || prev.chip === "freehit") continue;
    const freed = L.reduce((a, t) => a + t.outCost - t.inCost, 0);
    if (Math.abs(w.bank - (prev.bank + freed)) > 0.05 + 1e-9 || (w.tx || 0) !== L.length) badBank.push("GW" + w.gw + " bank " + w.bank + " vs " + (prev.bank + freed).toFixed(1) + ", transfers " + (w.tx || 0) + " vs log " + L.length);
  }
  const nT = (C.transfersLog || []).length;
  ok("the bank follows the transfer log week by week, and each week's transfer count is the log's (" + nT + (nT === 1 ? " transfer" : " transfers") + ", bank £" + C.gws[C.gws.length - 1].bank.toFixed(1) + "m)",
    badBank.length === 0, badBank.join("; "));
  const scr = (MC.screen && MC.screen.sell) || {};
  const unknown = Object.keys(scr).filter((k) => !M.byKey[k]);
  ok("every selling price taken off the 18 Sep screen names a player who exists (" + Object.keys(scr).length + " keys)", unknown.length === 0, unknown.join(", "));
}

/* ---------------------------------------------------------------- horizons */
{
  const L = MC.draft.league, rd = L.redraft, open = (L.drafts || []).filter((d) => !d.done);
  ok("the re-draft is read from the league settings: the first unfinished draft, from gameweek 2 or later",
    !rd || (rd.fromGw >= 2 && open.length > 0 && open[0].fromGw === rd.fromGw && open[0].at === rd.at),
    rd ? "redraft GW" + rd.fromGw + ", first unfinished draft GW" + (open[0] ? open[0].fromGw : "none") : "no re-draft");
  ok("the engine's Draft horizon stops the gameweek before the re-draft (GW" + M.CFG.draftEnd + ")",
    !rd || (M.CFG.draftEnd === rd.fromGw - 1 && M.CFG.draftEndApi === rd.fromGw - 1), "draftEnd " + M.CFG.draftEnd + " redraft " + (rd && rd.fromGw));
  ok("the engine's Classic horizon is the block's chip stop (GW" + M.CFG.classicEnd + ")", M.CFG.classicEnd === MC.rules.chipStop, "classicEnd " + M.CFG.classicEnd + " chipStop " + MC.rules.chipStop);
}

finish();

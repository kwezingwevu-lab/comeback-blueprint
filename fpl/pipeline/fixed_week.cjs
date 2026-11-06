#!/usr/bin/env node
/* fixed_week.cjs — the manager fixes the first week himself; the plan from the week after it is solved and stitched on.

     node pipeline/fixed_week.cjs --in "<id>,<id>" --out "<id>,<id>" --why "<one line>" [--weeks K] [--tl 600]

   --weeks K (5 Nov 2026, E-195): the manager fixes K weeks, not one. The first carries the moves given (none is a hold);
   weeks 2..K are holds with no transfer, the free transfers banking one a week up to the cap. The solve starts at the week
   after the last fixed one. `--in "" --out "" --weeks 3` is "no transfer in GW10, GW11 or GW12".

   Why it exists (ERRORS.md E-186). On 23 Oct 2026 the manager put survival first in his last-man-standing league (the
   lowest gameweek score after hits goes out each week): for GW8 one free transfer, Semenyo out and Mbeumo in, no hit,
   instead of the solver's three transfers at −8. The solver's own model (`classic()`, held byte-identical to the
   reference but for the declared E-181 change) cannot take a fixed first week, and it is not touched again for this.
   Instead:

   1. the GW8 week is built here, from the rules: the squad after the moves, the eleven and the armband from
      src/engine.js `bestXI` and `captainPick` (C1 rules 2 and 3), the points from src/mc_engine.js `ep` (the numbers
      qa/plan_legality.cjs re-derives), the bank on the export's selling prices, the free transfers replayed;
   2. a shifted solver input starts at GW9 from that squad, bank and free-transfer count, every expected-points row one
      week shorter; nobody sold in the fixed week can be bought back (the model's own no-rebuy rule, enforced by
      pricing them out of the shifted input);
   3. the "never" case (no wildcard, GW19 kept free) is solved on it with `solve.scenario_kwargs("never")`, and
      pipeline/latest_wildcard.py builds the GW19 wildcard on top, exactly as for the unfixed plan;
   4. both are stitched behind the fixed week and written into data/solver_timing.json as `never` and `latest`, with
      `fixedWeek` recorded; `now` and `later` stay the solver's own unconstrained solves, so the Plan tab still prices
      the choice against them. The file keeps the unshifted export hash.

   Their gaps are the shifted solves' own: proofs for GW9 onward given the fixed week, which the copy says. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const refuse = (m) => { console.error("fixed_week.cjs: " + m); process.exit(3); };
const ids = (s) => String(s || "").split(",").map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0);
const INS = ids(arg("in")), OUTS = ids(arg("out")), WHY = arg("why", ""), TL = Number(arg("tl", 600));
const WEEKS = Math.round(Number(arg("weeks", 1)));
if (!(WEEKS >= 1 && WEEKS <= 6)) refuse("--weeks must be a whole number from 1 to 6");
if (INS.length !== OUTS.length) refuse("give --in and --out as equal-length comma lists of element ids (both empty for a hold)");
if (!WHY) refuse("give --why: the manager's reason, in one line");

const MC = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "mc_data.json"), "utf8"));
const LIVE = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "live.json"), "utf8"));
const STATE = JSON.parse(fs.readFileSync(path.join(ROOT, "state", "kwezi.json"), "utf8"));
const SIN = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "solver_in.json"), "utf8"));
const TIMING = path.join(ROOT, "data", "solver_timing.json");
const M = require(path.join(ROOT, "src", "mc_engine.js")).create(MC);
const E = require(path.join(ROOT, "src", "engine.js"));
const EXPORT = require(path.join(ROOT, "pipeline", "export.js"));
const HASH = EXPORT.buildInput(MC, M).hash;
if (SIN.hash !== HASH) refuse("data/solver_in.json (hash " + SIN.hash + ") is not the export of data/mc_data.json (" + HASH + ")");
const T0 = JSON.parse(fs.readFileSync(TIMING, "utf8"));
if (T0.hash !== HASH) refuse("data/solver_timing.json was solved on other data (" + T0.hash + ")");

/* 1. the fixed weeks, from the rules */
const C = SIN.classic, gw = SIN.next, P = new Map(SIN.players.map((p) => [p.id, p]));
if (SIN.gws.length <= WEEKS) refuse("--weeks " + WEEKS + " leaves no week to solve");
const own = new Set(C.squad);
OUTS.forEach((i) => { if (!own.has(i)) refuse("id " + i + " is not in the squad"); });
INS.forEach((i) => { if (own.has(i)) refuse("id " + i + " is already in the squad"); if (!P.has(i)) refuse("id " + i + " is not in the solver input"); });
const sellOf = (i) => (C.sell[String(i)] !== undefined ? C.sell[String(i)] : P.get(i).pr);
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const squad = C.squad.filter((i) => !OUTS.includes(i)).concat(INS);
const bank = r1(C.bank + OUTS.reduce((a, i) => a + sellOf(i), 0) - INS.reduce((a, i) => a + P.get(i).pr, 0));
if (bank < -1e-9) refuse("the moves overspend: bank " + bank);
const L15 = (() => { const cnt = { 1: 0, 2: 0, 3: 0, 4: 0 }, club = {}; squad.forEach((i) => { const p = P.get(i); cnt[p.p]++; club[p.t] = (club[p.t] || 0) + 1; });
  return cnt[1] === 2 && cnt[2] === 5 && cnt[3] === 5 && cnt[4] === 3 && Object.values(club).every((n) => n <= C.clubLimit); })();
if (!L15) refuse("the squad after the moves is not 2/5/5/3 inside the club limit");
const CTX = E.buildCtx(LIVE, STATE, Date.parse(MC.asOf));
if (!CTX.ok) refuse("src/engine.js could not build a context: " + CTX.error);
const fixed = [], forms = [];
let ftCur = C.ft;
for (let j = 0; j < WEEKS; j++) {
  const g = SIN.gws[j], ins = j === 0 ? INS.slice() : [], outs = j === 0 ? OUTS.slice() : [];
  const usedJ = Math.min(ftCur, ins.length), hitsJ = Math.max(0, ins.length - ftCur);
  const ep = (i) => M.ep(M.P[i], g);
  let xi, benchIds, capId, viceId, formation;
  if (j === 0) {
    // the gameweek in play: the app's own eleven and armband (C1 rules 2 and 3), exactly as before
    const bx = E.bestXI(squad, CTX), cp = E.captainPick(bx.ids, CTX);
    xi = bx.ids.slice(); benchIds = bx.bench || []; capId = cp.capId; viceId = cp.viceId; formation = bx.formation;
  } else {
    // a later held week: the same legal-XI maximiser on that week's expected points, and the armband by C1 rule 2's shape
    // (attackers only, flagged never) on the same numbers, because the engine's xp1 speaks only to the next gameweek
    const bx = E.pickXI(squad, CTX, (el) => ep(el.id));
    if (!bx.ok) refuse("no legal eleven for GW" + g);
    xi = bx.ids.slice(); benchIds = bx.bench || []; formation = bx.formation;
    const att = xi.filter((i) => (P.get(i).p === 3 || P.get(i).p === 4) && !((CTX.flags[i] || {}).flagged)).sort((a, b) => ep(b) - ep(a));
    const pool = att.length >= 2 ? att : xi.slice().sort((a, b) => ep(b) - ep(a));
    capId = pool[0]; viceId = pool[1];
  }
  const rest = squad.filter((i) => !xi.includes(i));
  const gk2 = rest.filter((i) => P.get(i).p === 1)[0];
  const bo = benchIds.filter((i) => rest.includes(i) && P.get(i).p !== 1);
  const bench = bo.concat(rest.filter((i) => P.get(i).p !== 1 && !bo.includes(i)));
  const wEp = r2(xi.reduce((a, i) => a + ep(i), 0) + ep(capId));
  fixed.push({ gw: g, chip: null, xi, bench, gk2: gk2 === undefined ? null : gk2, cap: capId, vice: viceId, in: ins, out: outs,
    ftBefore: ftCur, used: usedJ, hits: hitsJ, bank, ep: wEp, epNet: r2(wEp - 4 * hitsJ), squad: squad.slice(), held: false });
  forms.push(formation);
  ftCur = Math.max(1, Math.min(C.maxFt, ftCur - usedJ + 1));
}
const week0 = fixed[0], hits = week0.hits, ftNext = ftCur, lastGw = fixed[fixed.length - 1].gw;

/* 2. the shifted input: the week after the last fixed one onward, from the squad the fixed weeks leave */
const SH = JSON.parse(JSON.stringify(SIN));
SH.next = SIN.gws[WEEKS]; SH.gws = SIN.gws.slice(WEEKS);
SH.players.forEach((p) => { p.ep = p.ep.slice(WEEKS); if (OUTS.includes(p.id)) p.ep = p.ep.map(() => -99); });   // no rebuy of a player sold in a fixed week
SH.classic.squad = squad.slice();
SH.classic.sell = Object.fromEntries(Object.entries(C.sell).filter(([k]) => !OUTS.includes(Number(k))));
INS.forEach((i) => { SH.classic.sell[String(i)] = P.get(i).pr; });
SH.classic.bank = bank; SH.classic.ft = ftNext;
SH.hash = "fixed-" + crypto.createHash("sha1").update(HASH + JSON.stringify(WEEKS === 1 ? week0 : fixed)).digest("hex").slice(0, 10);
const TMP = path.join(require("os").tmpdir(), "fixed_week_" + process.pid);
fs.mkdirSync(TMP, { recursive: true });
const SHIN = path.join(TMP, "solver_in.json"), SHT = path.join(TMP, "solver_timing.json");
fs.writeFileSync(SHIN, JSON.stringify(SH));
fs.writeFileSync(SHT, JSON.stringify({ hash: SH.hash, at: new Date().toISOString() }));

/* 3. never on the shifted input, then the GW19 wildcard on top */
const env = Object.assign({}, process.env, { SOLVER_IN: SHIN, SOLVER_TIMING: SHT });
// E-195: the GW19 wildcard is built on a HELD GW19 (pipeline/latest_wildcard.py), so the detailed window must stop before it.
// From GW11 the default eight weeks (GW11–18) already do; from GW13 they would run through GW19, so the window is cut to end at GW18.
const py = "import json, solve\nW = [g for g in solve.GWS if g <= solve.IN['cEnd']]\nTD = min(8, W.index(solve.SET1_LAST)) if solve.SET1_LAST in W else 8\n" +
  "r = solve.classic(time_limit=" + TL + ", gap=0.004, detail=TD, **solve.scenario_kwargs('never'))\n" +
  "t = json.load(open(solve.ARGS.timing)); t['never'] = {k: r[k] for k in solve.TIMING_KEYS if k in r}; solve.dump(t, solve.ARGS.timing)\n" +
  "print('never (from GW%d)' % solve.IN['next'], r.get('status'), r.get('secs'), 's · gap', r.get('gap'), '· total', r.get('total'), flush=True)\n";
process.stdout.write(execFileSync("python3", ["-c", py], { cwd: path.join(ROOT, "pipeline"), env, encoding: "utf8", maxBuffer: 1 << 26 }));
process.stdout.write(execFileSync("python3", [path.join(ROOT, "pipeline", "latest_wildcard.py")], { cwd: path.join(ROOT, "pipeline"), env, encoding: "utf8", maxBuffer: 1 << 26 }));
const ST = JSON.parse(fs.readFileSync(SHT, "utf8"));
if (!ST.never || !ST.never.ok || !ST.latest || !ST.latest.ok) refuse("the shifted solve did not return a never plan and a GW19 wildcard plan");

/* 4. stitch, and write into the timing file */
const fixedNet = r2(fixed.reduce((a, w) => a + w.epNet, 0));
const stitch = (r) => Object.assign({}, r, { weeks: fixed.map((w) => Object.assign({}, w)).concat(r.weeks), total: r2(fixedNet + r.total) });
const span = WEEKS === 1 ? "GW" + gw : "GW" + gw + "–GW" + lastGw;
const fixedWeek = { gw, lastGw, weeks: WEEKS, in: INS.slice(), out: OUTS.slice(), why: WHY, hits, bank, epNet: fixedNet, shiftedHash: SH.hash,
  note: span + " fixed by the manager" + (WEEKS > 1 ? " (" + (INS.length ? "the moves in GW" + gw + ", then " : "") + "no transfer" + (INS.length ? " after" : "") + ")" : "") +
    "; GW" + SH.next + " onward solved from the squad " + (WEEKS === 1 ? "it leaves" : "they leave") + " (the proof covers those weeks, given the fixed ones)" };
const T1 = JSON.parse(fs.readFileSync(TIMING, "utf8"));
if (T1.hash !== HASH) refuse("data/solver_timing.json changed to other data while this ran");
T1.never = Object.assign(stitch(ST.never), { fixedWeek });
T1.latest = Object.assign(stitch(ST.latest), { fixedWeek, note: span + " fixed by the manager, then " + ST.latest.note });
T1.fixedWeek = fixedWeek;
fs.writeFileSync(TIMING, JSON.stringify(T1, null, 1));
const nm = (i) => (P.get(i) || {}).n || "#" + i;
fixed.forEach((w) => console.log("  GW" + w.gw + ": " + (w.in.length ? w.out.map(nm).join(", ") + " out, " + w.in.map(nm).join(", ") + " in" : "no transfer") + " · FT before " + w.ftBefore +
  " · eleven " + forms[fixed.indexOf(w)] + ", captain " + nm(w.cap) + ", vice " + nm(w.vice) + " · " + w.epNet));
console.log("fixed_week.cjs · " + span + ": " + (INS.length ? OUTS.map(nm).join(", ") + " out, " + INS.map(nm).join(", ") + " in" : "no transfer") + " · " + hits + " hit(s) · bank " + bank +
  " · FT into GW" + SH.next + " " + ftNext + " · fixed weeks " + fixedNet +
  " · never " + T1.never.total + " · GW19 wildcard " + T1.latest.total + " · wrote " + path.relative(process.cwd(), TIMING));

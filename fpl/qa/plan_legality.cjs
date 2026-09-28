#!/usr/bin/env node
/*
 * qa/plan_legality.cjs — every week of a solved Classic plan obeys the rules of the game
 * (v110 §5 E3 and C3, closing §7.1, §7.9 and §7.10).
 *
 *   node qa/plan_legality.cjs --plan=<plan.json> [--data=<block.json>] [--skip-gap] [--golden=<golden.json> | --no-golden]
 *
 *   --plan      the plan file pipeline/plan.cjs wrote. Required. A missing plan is a hole, not a skip:
 *               the suite prints a FAIL and exits 1, because a gate that runs without a plan proves nothing.
 *   --data      the baked block the plan was solved on. Defaults to plan.source.data, which plan.cjs records.
 *   --skip-gap  leave out the two checks that speak to solve QUALITY rather than legality (the proven gap
 *               under 3% and "at least as good as keeping the wildcard"). qa/solver_smoke.sh passes it,
 *               because a short, time-limited solve is asked to be legal, not to prove its gap. The suite says so.
 *   --golden    run the C acceptance against this golden file. Without it the acceptance runs only when the
 *               plan was built from reference/v109/app/solver_out.json, which is the data the golden numbers
 *               were recorded on; --no-golden switches it off.
 *               THE ACCEPTANCE IS THE SPEC'S, WITH ITS TOLERANCE (E-106): total within 2% of golden's, the
 *               wildcard in GW6 with Saka and the triple captain in GW7 on Haaland, one bench boost, no hits,
 *               the gap under 3%, the timing scenarios within 2%, the Draft roster's pairs exactly (that
 *               programme solves to optimality in under a second), and an objective at least the recorded
 *               incumbent's. golden's bench-boost week, first fifteen, exact gap and exact totals are a 240 s
 *               incumbent's photograph; a proven re-solve of the same input beats it (882.72 against 878.28,
 *               objective 661.74 against 658.74, bench boost GW9), and a check that fails a better proven
 *               plan is measuring the clock, not the rules.
 *
 * WHAT IT PROVES
 *   For EVERY week of the plan, from the rules in CLAUDE.md Part N1 and v110 §4, re-derived here from the
 *   data and never read off the solver's own bookkeeping (§6: the solver's free-transfer variables are upper
 *   bounds, §7.1):
 *     · fifteen players in a 2/5/5/3 shape, at most clubLimit per club
 *     · a legal eleven — 1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD — drawn from the squad, captain and vice both in
 *       it and distinct; the bench is the rest, outfield only, with the reserve goalkeeper named
 *     · in and out lists equal to the squad difference from the previous week; a held week makes no moves
 *     · no player sold and bought back inside the window (§7.10)
 *     · the bank replayed from selling prices for the original fifteen and purchase prices for anyone bought
 *       inside the window, never below zero, and equal to the solver's figure
 *     · free transfers replayed from the rules — one added per ordinary week, none added and none spent in a
 *       wildcard or free-hit week, cap 1 + max_extra_free_transfers as the block carries it, floor 1 — and
 *       hits equal to the replayed number: a hit only once every free transfer is used, none on a chip week
 *     · one chip a week at most, each chip at most once in the plan, free-hit weeks carrying no other chip
 *     · expected points re-derived by src/mc_engine.js within 0.05 of the plan's figure
 *   Then for the plan as a whole: the weeks run from the next deadline to the chip stop, the total is the sum
 *   of the weeks less the hits, the replay block plan.cjs wrote agrees with this suite's independent replay,
 *   the free-hit prices are affordable and re-derived, the Draft roster is fifteen in shape with every add
 *   claimable and every drop mine, position for position, and the proven gap is under 3% (§7.9).
 *   And the plan carries the content hash of the data it was solved on (§7.7) — a plan solved on other data
 *   is not a plan for this one.
 *
 * THE OPTIMISER IS THE EXECUTABLE SPEC
 *   The suite also proves that the model functions in pipeline/solve.py — class Model, classic(),
 *   one_week_best() and draft() — are byte for byte the reference's (reference/v109/app/solve.py). The port
 *   changed the paths and the entry points, and nothing else (v110 §1.4).
 *
 * WHERE THE EXPECTED NUMBERS COME FROM
 *   The rules are the game's, so the shape constants here are rules and not observations (frozen-ok below).
 *   Every acceptance number — the plan total, the chip weeks, the first squad, the timing call and the Draft
 *   roster — is read from reference/v109/app/golden.json. Nothing is typed.
 *
 * MUTATIONS
 *   A legality check that cannot go red is not a check. Nine breaks are applied to copies of the plan and the
 *   suite asserts the named rule reports each one: a fourth player from one club, a captain off the pitch, a
 *   player bought back after being sold, an overspent bank, a second wildcard, expected points moved, the
 *   solver's hit count wrong, a foreign hash, and the acceptance total and chip weeks moved.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REF_APP = path.join(ROOT, "reference", "v109", "app");

/* ---------------------------------------------------------------- arguments */
function parseArgs(argv) {
  const o = { plan: null, data: null, golden: null, skipGap: false, noGolden: false };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], v = null;
    const eq = a.indexOf("=");
    if (eq > 0) { v = a.slice(eq + 1); a = a.slice(0, eq); }
    const take = () => { if (v == null) { v = argv[++i]; } return v; };
    if (a === "--plan") o.plan = take();
    else if (a === "--data") o.data = take();
    else if (a === "--golden") o.golden = take();
    else if (a === "--skip-gap") o.skipGap = true;
    else if (a === "--no-golden") o.noGolden = true;
    else { console.log("FAIL arguments — unknown argument " + a + " (expected --plan=<file> [--data=<file>] [--skip-gap] [--golden=<file>|--no-golden])"); process.exit(1); }
  }
  return o;
}
const OPT = parseArgs(process.argv.slice(2));
const here = (p) => (p ? path.resolve(ROOT, p) : p);
const rel = (p) => { const r = path.relative(ROOT, p); return r && !r.startsWith("..") ? r : p; };

let pass = 0, fail = 0, skipped = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const skip = (name, why) => { skipped++; console.log("SKIP " + name + " — " + why); };
const finish = () => {
  console.log("SUITE plan_legality " + pass + "/" + (pass + fail) + (skipped ? " · " + skipped + " skipped by --skip-gap" : ""));
  process.exit(fail ? 1 : 0);
};
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } };
const clone = (o) => JSON.parse(JSON.stringify(o));
const r1 = (x) => Math.round(x * 10) / 10;
const near = (a, b, tol) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;
const sameSet = (a, b) => a.length === b.length && a.slice().sort((x, y) => x - y).join(",") === b.slice().sort((x, y) => x - y).join(",");
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);

/* ---------------------------------------------------------------- rules of the game
   These are rules, not observations, so a literal is the right thing (frozen-ok: v110 §4 Classic squad and
   eleven, a hit is four points, one decay-free tolerance for re-derived points). */
const SQUAD_SHAPE = { 1: 2, 2: 5, 3: 5, 4: 3 };                     // frozen-ok: the squad is 2/5/5/3 by rule
const XI_RANGE = { 1: [1, 1], 2: [3, 5], 3: [2, 5], 4: [1, 3] };     // frozen-ok: the eleven is 1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD by rule
const XI_SIZE = 11, SQUAD_SIZE = 15, HIT_POINTS = 4;                 // frozen-ok: rules of the game
const CHIP_NAMES = ["wildcard", "bboost", "3xc", "freehit"];
const EP_TOL = 0.05, BANK_TOL = 0.051, GAP_MAX = 0.03, TOTAL_TOL = 0.02, VALUE_TOL = 0.05, WC_MARGIN = 1.5;
const POS_NAME = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

/* ---------------------------------------------------------------- the plan file */
if (!OPT.plan) { ok("a plan file was named (--plan=<file>)", false, "no --plan argument"); finish(); }
const PLAN_PATH = here(OPT.plan);
if (!fs.existsSync(PLAN_PATH)) {
  ok("the plan file exists", false, rel(PLAN_PATH) + " is missing — a missing plan is a hole. The solve stage writes data/plan.json with pipeline/plan.cjs; until it lands, data/plan_reference.json (built from reference/v109) stands in.");
  finish();
}
const PF = readJson(PLAN_PATH);
ok("the plan file parses as JSON and carries a solved Classic plan with weeks",
  !!PF && !!PF.plan && PF.plan.ok === true && Array.isArray(PF.plan.weeks) && PF.plan.weeks.length > 0 && typeof PF.hash === "string",
  PF ? "plan " + JSON.stringify(PF.plan ? { ok: PF.plan.ok, weeks: Array.isArray(PF.plan.weeks) ? PF.plan.weeks.length : null } : null) + " hash " + PF.hash : rel(PLAN_PATH) + " is not JSON");
if (!PF || !PF.plan || !Array.isArray(PF.plan.weeks)) finish();

/* ---------------------------------------------------------------- the data and the engine */
const DATA_PATH = here(OPT.data || (PF.source && PF.source.data));
const DATA = DATA_PATH ? readJson(DATA_PATH) : null;
ok("the data block the plan was solved on is readable (" + (DATA_PATH ? rel(DATA_PATH) : "no --data and no plan.source.data") + ")",
  !!DATA && !!DATA.rules && !!DATA.gw && Array.isArray(DATA.players) && !!DATA.classic,
  DATA ? "keys " + Object.keys(DATA).join(",") : "unreadable");
if (!DATA) finish();

let ENG = null, EXPORT = null, loadErr = [];
try { ENG = require(path.join(ROOT, "src", "mc_engine.js")); } catch (e) { loadErr.push("src/mc_engine.js: " + e.message); }
try { EXPORT = require(path.join(ROOT, "pipeline", "export.js")); } catch (e) { loadErr.push("pipeline/export.js: " + e.message); }
ok("src/mc_engine.js and pipeline/export.js load under Node", !!ENG && !!EXPORT && typeof ENG.create === "function" && typeof EXPORT.buildInput === "function", loadErr.join(" · "));
if (!ENG || !EXPORT) finish();
const M = ENG.create(DATA), P = M.P;
const nameOf = (id) => (P[id] ? P[id].n : "#" + id);

/* ---------------------------------------------------------------- the content hash (§7.7) */
const NOW_HASH = EXPORT.buildInput(DATA, M).hash;
const hashCheck = (pf) => ({ name: "the plan carries the export hash of this data (§7.7: the guard is content, not a clock)", ok: pf.hash === NOW_HASH, detail: "plan " + pf.hash + " · data " + NOW_HASH });
{ const h = hashCheck(PF); ok(h.name, h.ok, h.detail); }

/* ---------------------------------------------------------------- the optimiser is the executable spec (§1.4) */
{
  /* the reference's model region — class Model through the end of draft() — must appear verbatim in the port */
  const region = (text) => { if (!text) return null; const a = text.indexOf("class Model:"), b = text.indexOf("\nif __name__ == \"__main__\":"); return a < 0 || b < 0 || b < a ? null : text.slice(a, b); };
  const mine = (() => { try { return fs.readFileSync(path.join(ROOT, "pipeline", "solve.py"), "utf8"); } catch (e) { return null; } })();
  const ref = (() => { try { return fs.readFileSync(path.join(REF_APP, "solve.py"), "utf8"); } catch (e) { return null; } })();
  const rr = region(ref);
  ok("pipeline/solve.py's model functions (class Model, classic, one_week_best, draft) are byte-identical to reference/v109/app/solve.py's",
    !!mine && !!rr && rr.length > 1000 && mine.indexOf(rr) >= 0,
    !mine ? "pipeline/solve.py is missing" : !ref ? "the reference solve.py is missing" : !rr ? "the model region could not be located in the reference" : "the reference's " + rr.length + "-byte model region does not appear verbatim in pipeline/solve.py");
}

/* ---------------------------------------------------------------- the rules, as one function over a plan file */
function checkPlan(pf, data, eng) {
  const P = eng.P, pl = pf.plan, cs = eng.classicSquad();
  const maxFt = data.rules.maxFt, clubLimit = data.rules.clubLimit;
  const sellMap = new Map(cs.squad.map((p) => [p.id, p.sell]));
  const sellOf = (i) => (sellMap.has(i) ? sellMap.get(i) : P[i] ? P[i].pr : 0);   // selling price for the original fifteen, purchase price for anyone bought inside the window
  const buyOf = (i) => (P[i] ? P[i].pr : 0);
  const weeks = [], planChecks = [], replay = [];
  let prev = new Set(cs.squad.map((p) => p.id)), ft = cs.ft, bank = cs.bank;
  const sold = new Set(), chipsSeen = {};
  const nm = (id) => (P[id] ? P[id].n : "#" + id);

  pl.weeks.forEach((w) => {
    const C = []; const chk = (name, cond, detail) => C.push({ name, ok: !!cond, detail: detail || "" });
    const ids = Array.isArray(w.squad) ? w.squad : [], xiIds = Array.isArray(w.xi) ? w.xi : [], bench = Array.isArray(w.bench) ? w.bench : [], gk2 = w.gk2;
    const unknown = ids.concat(xiIds, bench).filter((i) => !P[i]);
    chk("known players", unknown.length === 0, "ids not in the data: " + unknown.join(","));
    const sq = ids.map((i) => P[i]).filter(Boolean);
    const cnt = { 1: 0, 2: 0, 3: 0, 4: 0 }, club = {}; sq.forEach((p) => { cnt[p.p]++; club[p.t] = (club[p.t] || 0) + 1; });
    chk("squad shape", sq.length === SQUAD_SIZE && [1, 2, 3, 4].every((k) => cnt[k] === SQUAD_SHAPE[k]) && new Set(ids).size === ids.length,
      sq.length + " players " + [1, 2, 3, 4].map((k) => cnt[k]).join("/"));
    const over = Object.keys(club).filter((t) => club[t] > clubLimit);
    chk("club cap", over.length === 0, over.map((t) => t + " x" + club[t]).join(", ") + " over the limit of " + clubLimit);
    const xi = xiIds.map((i) => P[i]).filter(Boolean), xc = { 1: 0, 2: 0, 3: 0, 4: 0 }; xi.forEach((p) => xc[p.p]++);
    chk("eleven", xi.length === XI_SIZE && [1, 2, 3, 4].every((k) => xc[k] >= XI_RANGE[k][0] && xc[k] <= XI_RANGE[k][1]) && xiIds.every((i) => ids.includes(i)) && new Set(xiIds).size === xiIds.length,
      xi.length + " on the pitch " + [1, 2, 3, 4].map((k) => POS_NAME[k] + " " + xc[k]).join(", ") + (xiIds.every((i) => ids.includes(i)) ? "" : " · not all from the squad"));
    chk("armband", xiIds.includes(w.cap) && xiIds.includes(w.vice) && w.cap !== w.vice,
      "captain " + nm(w.cap) + (xiIds.includes(w.cap) ? "" : " is not on the pitch") + " · vice " + nm(w.vice) + (xiIds.includes(w.vice) ? "" : " is not on the pitch") + (w.cap === w.vice ? " · captain and vice are the same player" : ""));
    const rest = ids.filter((i) => !xiIds.includes(i));
    chk("bench", bench.every((i) => rest.includes(i) && P[i] && P[i].p !== 1) && new Set(bench).size === bench.length &&
      (gk2 == null ? rest.every((i) => !P[i] || P[i].p !== 1) : rest.includes(gk2) && P[gk2] && P[gk2].p === 1) && bench.length + (gk2 != null ? 1 : 0) === rest.length,
      "bench " + bench.map(nm).join(",") + " · reserve GK " + (gk2 != null ? nm(gk2) : "none") + " · off the pitch " + rest.map(nm).join(","));
    const ins = ids.filter((i) => !prev.has(i)), outs = [...prev].filter((i) => !ids.includes(i));
    chk("transfer lists", sameSet(ins, Array.isArray(w.in) ? w.in : []) && sameSet(outs, Array.isArray(w.out) ? w.out : []),
      "squad difference in " + ins.map(nm).join(",") + " out " + outs.map(nm).join(",") + " · listed in " + (w.in || []).map(nm).join(",") + " out " + (w.out || []).map(nm).join(","));
    chk("held week", !w.held || ins.length === 0, "a held week with " + ins.length + " move(s)");
    const rebought = ins.filter((i) => sold.has(i));
    chk("no rebuy", rebought.length === 0, "bought back after being sold inside the window: " + rebought.map(nm).join(","));
    outs.forEach((i) => sold.add(i));
    /* the ledger, from the rules (Part N1): a wildcard or free-hit week spends nothing and adds nothing */
    const chipWeek = w.chip === "wildcard" || w.chip === "freehit";
    const moves = ins.length, used = chipWeek ? 0 : Math.min(ft, moves), hitCount = chipWeek ? 0 : Math.max(0, moves - ft);
    bank = r1(bank + sum(outs, sellOf) - sum(ins, buyOf));
    chk("bank", bank >= -1e-9 && near(bank, w.bank, BANK_TOL), "replayed " + bank.toFixed(1) + " vs the solver's " + w.bank + (bank < -1e-9 ? " · overspent" : ""));
    chk("free transfers", ft === w.ftBefore && used === w.used, "replayed before " + ft + " used " + used + " vs the solver's before " + w.ftBefore + " used " + w.used);
    chk("hits", hitCount === w.hits, "replayed " + hitCount + " hit(s) vs the solver's " + w.hits + " (moves " + moves + ", free " + ft + (chipWeek ? ", " + w.chip + " week" : "") + ")");
    chk("chip", w.chip == null || CHIP_NAMES.includes(w.chip), "unknown chip " + w.chip);
    if (w.chip) chipsSeen[w.chip] = (chipsSeen[w.chip] || 0) + 1;
    const capMul = w.chip === "3xc" ? 2 : 1;
    const epX = sum(xi, (p) => eng.ep(p, w.gw)) + (P[w.cap] ? eng.ep(P[w.cap], w.gw) * capMul : 0) +
      (w.chip === "bboost" ? sum(bench.concat(gk2 != null ? [gk2] : []).filter((i) => P[i]), (i) => eng.ep(P[i], w.gw)) : 0);
    chk("expected points", near(epX, w.ep, EP_TOL) && near(w.ep - HIT_POINTS * w.hits, w.epNet, EP_TOL),
      "re-derived " + epX.toFixed(2) + " vs the plan's " + w.ep + " · net " + w.epNet + " vs " + (w.ep - HIT_POINTS * w.hits).toFixed(2));
    const ftAfter = chipWeek ? ft : Math.max(1, Math.min(maxFt, ft - used + 1));
    replay.push({ gw: w.gw, chip: w.chip || null, ftBefore: ft, moves, used, hitCount, hits: HIT_POINTS * hitCount, bank, ftAfter });
    ft = ftAfter; prev = new Set(ids);
    weeks.push({ gw: w.gw, checks: C });
  });

  /* the plan as a whole */
  const twice = Object.keys(chipsSeen).filter((c) => chipsSeen[c] > 1);
  planChecks.push({ name: "each chip is used at most once", ok: twice.length === 0, detail: twice.map((c) => c + " x" + chipsSeen[c]).join(", ") });
  const gws = pl.weeks.map((w) => w.gw), first = data.gw.next, last = eng.CFG.classicEnd;
  planChecks.push({ name: "the weeks run from the next deadline to the chip stop without a gap", ok: gws.length === last - first + 1 && gws.every((g, i) => g === first + i), detail: "weeks " + gws.join(",") + " · expected " + first + "–" + last });
  const tot = sum(pl.weeks, (w) => w.ep) - HIT_POINTS * sum(pl.weeks, (w) => w.hits);
  planChecks.push({ name: "the plan's total is the sum of its weeks' points less four per hit", ok: near(tot, pl.total, EP_TOL), detail: tot.toFixed(2) + " vs " + pl.total });
  /* free hit: priced against the kept plan, a week is free only if the plan plays no chip in it */
  {
    const fh = Array.isArray(pf.freeHit) ? pf.freeHit : [], bad = [];
    fh.forEach((f) => {
      const w = pl.weeks.find((x) => x.gw === f.gw); if (!w) { bad.push("GW" + f.gw + ": no such week"); return; }
      if (f.free !== !w.chip) bad.push("GW" + f.gw + ": free " + f.free + " but the plan plays " + (w.chip || "no chip"));
      const sq = (f.squad || []).map((i) => P[i]).filter(Boolean), cnt = { 1: 0, 2: 0, 3: 0, 4: 0 }, club = {}; sq.forEach((p) => { cnt[p.p]++; club[p.t] = (club[p.t] || 0) + 1; });
      if (sq.length !== SQUAD_SIZE || [1, 2, 3, 4].some((k) => cnt[k] !== SQUAD_SHAPE[k]) || Object.keys(club).some((t) => club[t] > clubLimit)) bad.push("GW" + f.gw + ": the free-hit squad is not a legal fifteen");
      const xi = (f.xi || []).map((i) => P[i]).filter(Boolean), xc = { 1: 0, 2: 0, 3: 0, 4: 0 }; xi.forEach((p) => xc[p.p]++);
      if (xi.length !== XI_SIZE || [1, 2, 3, 4].some((k) => xc[k] < XI_RANGE[k][0] || xc[k] > XI_RANGE[k][1]) || !(f.xi || []).every((i) => (f.squad || []).includes(i)) || !(f.xi || []).includes(f.cap)) bad.push("GW" + f.gw + ": the free-hit eleven is not legal");
      const budget = r1(sum(w.squad, sellOf) + w.bank), cost = r1(sum(f.squad || [], buyOf));
      if (!near(budget, f.budget, BANK_TOL) || !near(cost, f.cost, BANK_TOL) || cost > budget + 1e-9) bad.push("GW" + f.gw + ": budget " + budget + "/" + f.budget + " cost " + cost + "/" + f.cost);
      const fhEp = sum(xi, (p) => eng.ep(p, f.gw)) + (P[f.cap] ? eng.ep(P[f.cap], f.gw) : 0), base = sum(w.xi.map((i) => P[i]).filter(Boolean), (p) => eng.ep(p, f.gw)) + (P[w.cap] ? eng.ep(P[w.cap], f.gw) : 0);
      if (!near(fhEp - base, f.gain, EP_TOL)) bad.push("GW" + f.gw + ": gain " + (fhEp - base).toFixed(2) + " vs " + f.gain);
    });
    planChecks.push({ name: "free-hit weeks carry no other chip, and each priced free-hit squad is legal, affordable and re-derived (" + fh.length + " weeks)", ok: bad.length === 0, detail: bad.join(" · ") });
  }
  /* the replay block the interface reads must be what the rules give */
  {
    const rb = pf.replay, diffs = [];
    if (!rb || !Array.isArray(rb.weeks)) diffs.push("no replay block");
    else {
      if (rb.agrees !== true) diffs.push("agrees is " + rb.agrees);
      if (!Array.isArray(rb.differences) || rb.differences.length) diffs.push("differences " + JSON.stringify(rb.differences));
      if (rb.weeks.length !== replay.length) diffs.push("weeks " + rb.weeks.length + " vs " + replay.length);
      replay.forEach((r, i) => { const o = rb.weeks[i] || {}; ["gw", "ftBefore", "used", "hits", "moves", "hitCount", "ftAfter"].forEach((k) => { if (o[k] !== r[k]) diffs.push("GW" + r.gw + " " + k + " " + o[k] + " vs " + r[k]); }); if (!near(o.bank, r.bank, 1e-6)) diffs.push("GW" + r.gw + " bank " + o.bank + " vs " + r.bank); });
    }
    planChecks.push({ name: "the plan's replay block agrees with this suite's own replay of the rules, week for week", ok: diffs.length === 0, detail: diffs.slice(0, 6).join(" · ") });
  }
  return { weeks, plan: planChecks, replay };
}

/* ---------------------------------------------------------------- run it on the plan under test */
const RES = checkPlan(PF, DATA, M);
RES.weeks.forEach((wk) => {
  const bad = wk.checks.filter((c) => !c.ok), n = wk.checks.length;
  ok("GW" + wk.gw + " legal (" + (n - bad.length) + "/" + n + " rules)", bad.length === 0, bad.map((c) => c.name + ": " + c.detail).join("; "));
});
RES.plan.forEach((c) => ok(c.name, c.ok, c.detail));

/* solve quality — legality does not depend on these, and a short, time-limited smoke is not asked for them */
if (OPT.skipGap) {
  skip("the plan is proven close to the best possible (gap under " + GAP_MAX + ", §7.9)", "--skip-gap: a short, time-limited solve is asked to be legal, not to prove its gap (gap " + PF.plan.gap + ")");
  skip("the plan is at least as good as keeping the wildcard", "--skip-gap: two time-limited solves of different lengths are not comparable");
} else {
  ok("the plan is proven close to the best possible (gap under " + GAP_MAX + ", §7.9)", typeof PF.plan.gap === "number" && PF.plan.gap < GAP_MAX, "gap " + PF.plan.gap + (PF.plan.gapFrom ? " (certified by the " + PF.plan.gapFrom + ", the kept solve's own gap " + PF.plan.gapOwn + ")" : ""));
  /* E-128. The plan may claim a tighter proof than its own solve reached only if a solve of the SAME problem (same
     hash, same recorded parameters) proved a bound that supports it. So recompute the tightest bound from the raw solver
     files the plan names, and refuse a gap tighter than that bound allows, or a bound the raw files do not contain. */
  {
    const src = PF.source || {}, raws = [];
    const grab = (rel, pick) => { const f = rel ? readJson(here(rel)) : null; if (f && f.hash === PF.hash) pick(f); return !!f; };
    const readable = [
      grab(src.out, (f) => f.plan && raws.push({ label: "main plan", p: f.plan })),
      src.long ? grab(src.long, (f) => f.plan && raws.push({ label: "long solve", p: f.plan })) : true,
      src.timing ? grab(src.timing, (f) => f.now && raws.push({ label: "wildcard now", p: f.now })) : true,
    ];
    const key = JSON.stringify((PF.plan || {}).params || null);
    const peers = raws.filter((x) => x.p && x.p.ok && typeof x.p.obj === "number" && typeof x.p.gap === "number" && JSON.stringify(x.p.params || null) === key);
    const bestB = peers.reduce((a, x) => Math.min(a, x.p.obj * (1 + x.p.gap)), Infinity);
    const floorGap = isFinite(bestB) && PF.plan.obj > 0 ? bestB / PF.plan.obj - 1 : null;
    ok("the plan's gap is no tighter than the tightest bound the raw solves prove (E-128): " + (floorGap === null ? "no bound" : "floor " + floorGap.toFixed(5)),
      readable.every(Boolean) && floorGap !== null && PF.plan.gap >= floorGap - 1e-6 && PF.plan.gap <= (typeof PF.plan.gapOwn === "number" ? PF.plan.gapOwn : PF.plan.gap) + 1e-9,
      "plan gap " + PF.plan.gap + " · floor from " + peers.map((x) => x.label).join(", ") + " " + (floorGap === null ? "none" : floorGap.toFixed(5)) + (readable.every(Boolean) ? "" : " · a raw solver file named by the plan is missing or was solved on other data"));
  }
  ok("the plan is at least as good as keeping the wildcard", !PF.noWildcard || !PF.noWildcard.ok || PF.plan.total >= PF.noWildcard.total - WC_MARGIN, PF.plan.total + " vs " + (PF.noWildcard || {}).total);
}

/* the timing scenarios, when the plan carries them. One function decides whether they are proven, so the check and its
   mutation run the same code (E-129). */
const timingProved = (T) => !!T && !!T.later && !!T.never && typeof T.later.gap === "number" && T.later.gap < GAP_MAX && typeof T.never.gap === "number" && T.never.gap < GAP_MAX;
if (PF.timing && PF.timing.now && PF.timing.later && PF.timing.never) {
  const T = PF.timing, wcOf = (r) => (r.weeks || []).filter((w) => w.chip === "wildcard").map((w) => w.gw);
  ok("timing: 'now' is the kept plan, 'later' plays the wildcard after the first week, 'never' plays none",
    T.now.total === PF.plan.total && T.now.obj === PF.plan.obj && wcOf(T.later).every((g) => g > PF.plan.weeks[0].gw) && wcOf(T.never).length === 0,
    "now " + T.now.total + "/" + PF.plan.total + " · later wildcard " + wcOf(T.later).join(",") + " · never wildcard " + wcOf(T.never).join(","));
  /* E-129. The timing verdict compares three solves, so each must carry its own proof: a scenario stopped by the
     240 s clock at 6% or 11% (the 28 Sep refresh: 5.8% and 11.3%, on problems that prove to 0.4% in 250 to 430 s) makes
     the verdict a comparison of noise. The kept plan ('now') is held by the certified-gap check above; 'later' and 'never'
     are held here to the same ceiling. */
  if (!OPT.skipGap) {
    ok("timing: 'later' and 'never' are each proven within the " + GAP_MAX + " ceiling (E-129) — later " + T.later.gap + ", never " + T.never.gap,
      timingProved(T), "later " + T.later.gap + " · never " + T.never.gap + " — re-solve the loose one: python3 pipeline/solve_scenario.py <later|never> 900 --gap 0.004");
  }
}

/* the Draft roster (C5), a separate game: nothing here touches a Classic number */
if (PF.draft && PF.draft.ok) {
  const dr = PF.draft, r0 = new Set(M.draftRoster().map((p) => p.id)), pool = new Set(M.waiverPool().map((p) => p.id)), c = { 1: 0, 2: 0, 3: 0, 4: 0 };
  (dr.roster || []).forEach((i) => { if (P[i]) c[P[i].p]++; });
  ok("Draft: the solved roster is fifteen, 2/5/5/3", (dr.roster || []).length === SQUAD_SIZE && [1, 2, 3, 4].every((k) => c[k] === SQUAD_SHAPE[k]), (dr.roster || []).length + " players " + [1, 2, 3, 4].map((k) => c[k]).join("/"));
  const badPairs = (dr.pairs || []).filter((q) => !(pool.has(q.add) && r0.has(q.drop) && P[q.add] && P[q.drop] && P[q.add].p === P[q.drop].p));
  ok("Draft: every add is claimable, every drop is mine, position for position (" + (dr.pairs || []).length + " pairs)", badPairs.length === 0, badPairs.map((q) => nameOf(q.add) + " for " + nameOf(q.drop)).join(", "));
  ok("Draft: the solved roster is worth at least the current one", dr.value >= dr.base - 1e-6, dr.value + " vs " + dr.base);
  ok("Draft: the contested version never adds a player the manager ahead is modelled to take",
    !PF.draftIfTaken || !PF.draftIfTaken.ok || (PF.draftIfTaken.pairs || []).every((q) => !(PF.draftIfTaken.excluded || []).includes(q.add)),
    PF.draftIfTaken ? "excluded " + (PF.draftIfTaken.excluded || []).map(nameOf).join(",") : "no contested solve");
} else ok("Draft: the plan carries a solved Draft roster", false, "draft " + JSON.stringify(PF.draft && { ok: PF.draft.ok, status: PF.draft.status }));

/* ---------------------------------------------------------------- the C acceptance against golden.json */
function acceptance(pf, golden, eng) {
  const P = eng.P, g = golden.classic.plan, pl = pf.plan, out = [];
  const nm = (id) => (P[id] ? P[id].n : "#" + id);
  out.push({ name: "C1 the plan total is within 2% of golden.classic.plan.total", ok: near(pl.total, g.total, TOTAL_TOL * g.total), detail: pl.total + " vs " + g.total + " (" + (100 * Math.abs(pl.total - g.total) / g.total).toFixed(2) + "%)" });
  const chips = pl.weeks.filter((w) => w.chip).map((w) => ({ gw: w.gw, chip: w.chip, captain: nm(w.cap) }));
  const want = (g.chips || []).map((c) => ({ gw: c.gw, chip: c.chip, captain: c.captain }));
  /* E-106. golden's chip weeks are a 240 s incumbent's (gap 1.3%); a proven re-solve of the same input keeps the
     wildcard in GW6 with Saka and the triple captain in GW7 on Haaland — the two the spec's acceptance names —
     and moves the bench boost to GW9 with a higher objective. So the wildcard and triple-captain rows must equal
     golden's, the bench boost must appear exactly once, and its week is printed rather than pinned. */
  const pinned = ["wildcard", "3xc"], same = (k) => JSON.stringify(chips.filter((c) => c.chip === k)) === JSON.stringify(want.filter((c) => c.chip === k));
  const bbWeeks = chips.filter((c) => c.chip === "bboost").map((c) => c.gw);
  out.push({ name: "C1 the chip weeks golden fixes — wildcard GW" + ((want.find((c) => c.chip === "wildcard") || {}).gw) + " and triple captain GW" + ((want.find((c) => c.chip === "3xc") || {}).gw) + " with their captains — and one bench boost (E-106: its week is the solver's)",
    ok: pinned.every(same) && bbWeeks.length === 1, detail: JSON.stringify(chips) + " vs golden " + JSON.stringify(want) + " · bench boost in GW" + bbWeeks.join(",") });
  const sq0 = pl.weeks[0] ? pl.weeks[0].squad.map(nm).sort() : [], want0 = (g.gw6squad || []).slice().sort();
  const shared = sq0.filter((x) => want0.includes(x)).length;
  /* E-106. The fifteen golden records is the incumbent's; the proven re-solve shares thirteen of them and swaps
     two for a higher objective. The check that cannot be gamed is the objective: a plan measured against a
     recorded incumbent must reach at least that incumbent's objective (read from the reference solver output,
     never typed). The overlap is printed for the reader. */
  const refOut = readJson(path.join(REF_APP, "solver_out.json")), refObj = refOut && refOut.plan ? refOut.plan.obj : null;
  out.push({ name: "C1 the plan's objective is at least the recorded incumbent's (reference solver_out.json) — a re-solve may not be worse than the photograph (E-106)",
    ok: typeof pl.obj === "number" && typeof refObj === "number" && pl.obj + 1e-6 >= refObj,
    detail: "objective " + pl.obj + " vs recorded " + refObj + " · first fifteen shares " + shared + " of " + want0.length + " with golden's (" + sq0.filter((x) => !want0.includes(x)).join(",") + " for " + want0.filter((x) => !sq0.includes(x)).join(",") + ")" });
  const hits = sum(pl.weeks, (w) => w.hits), tot = sum(pl.weeks, (w) => w.ep) - HIT_POINTS * hits;
  out.push({ name: "C1 no hits, and the weeks' points less four per replayed hit reproduce the plan's own total (" + hits + " hit" + (hits === 1 ? "" : "s") + ")", ok: hits === 0 && near(tot, pl.total, EP_TOL), detail: tot.toFixed(2) + " vs the plan's " + pl.total + " (golden's total " + g.total + " is held to 2% by the first check)" });
  out.push({ name: "C2 the proven gap is under " + GAP_MAX + " (§7.9; golden's own gap is printed, not pinned — E-106)", ok: typeof pl.gap === "number" && pl.gap < GAP_MAX, detail: pl.gap + " (golden recorded " + g.gap + ")" });
  if (g.timing && pf.timing && pf.timing.later && pf.timing.never) {
    const T = pf.timing, laterWc = (T.later.weeks || []).find((w) => w.chip === "wildcard");
    out.push({ name: "C4 wildcard timing now/later/never each within 2% of golden's (E-106: the later week is the solver's, printed)", ok: near(T.now.total, g.timing.now, TOTAL_TOL * g.timing.now) && near(T.later.total, g.timing.later, TOTAL_TOL * g.timing.later) && near(T.never.total, g.timing.never, TOTAL_TOL * g.timing.never) && !!laterWc,
      detail: "now " + T.now.total + "/" + g.timing.now + " · later " + T.later.total + "/" + g.timing.later + " in GW" + (laterWc ? laterWc.gw : "none") + "/" + g.timing.laterWildcardGw + " · never " + T.never.total + "/" + g.timing.never });
  } else out.push({ name: "C4 the plan carries the wildcard timing scenarios", ok: false, detail: "timing " + JSON.stringify(pf.timing && Object.keys(pf.timing)) });
  const gd = golden.draft && golden.draft.solvedRoster, dr = pf.draft;
  if (gd && dr && dr.ok) {
    const pairs = (dr.pairs || []).map((q) => nm(q.add) + " for " + nm(q.drop)).sort(), wantP = (gd.pairs || []).slice().sort();
    out.push({ name: "C5 the Draft roster's value, base and pairs are the ones golden.draft.solvedRoster records", ok: near(dr.value, gd.value, VALUE_TOL) && near(dr.base, gd.base, VALUE_TOL) && JSON.stringify(pairs) === JSON.stringify(wantP),
      detail: "value " + dr.value + "/" + gd.value + " · base " + dr.base + "/" + gd.base + " · gain " + (dr.value - dr.base).toFixed(2) + " · pairs " + pairs.join("; ") });
  } else out.push({ name: "C5 the plan carries a solved Draft roster to compare with golden", ok: false, detail: "draft " + JSON.stringify(dr && dr.ok) });
  return out;
}
const isReferencePlan = !!(PF.source && /reference[\\/]v109[\\/]app[\\/]solver_out\.json$/.test(String(PF.source.out || "")));
let GOLDEN = null;
if (!OPT.noGolden && (OPT.golden || isReferencePlan)) {
  GOLDEN = readJson(here(OPT.golden || path.join(REF_APP, "golden.json")));
  ok("golden.json is readable for the acceptance", !!GOLDEN && !!GOLDEN.classic && !!GOLDEN.classic.plan, OPT.golden || "reference/v109/app/golden.json");
  if (GOLDEN) acceptance(PF, GOLDEN, M).forEach((c) => ok(c.name, c.ok, c.detail));
} else console.log("     acceptance against golden.json not run: " + (OPT.noGolden ? "--no-golden" : "this plan was not built from reference/v109/app/solver_out.json (source.out " + (PF.source && PF.source.out) + "); the golden numbers were recorded on the reference data"));

/* ---------------------------------------------------------------- mutations: every rule must be able to go red */
{
  const findWeekCheck = (res, gw, name) => { const wk = res.weeks.find((w) => w.gw === gw); return wk ? wk.checks.find((c) => c.name === name) : null; };
  const findPlanCheck = (res, prefix) => res.plan.find((c) => c.name.indexOf(prefix) === 0);
  const w0 = PF.plan.weeks[0], w1 = PF.plan.weeks[1];
  const benchOf = (w) => (w.bench || []).filter((i) => i !== w.cap && i !== w.vice);
  const posOf = (i) => (P[i] ? P[i].p : 0);
  const swapIn = (w, from, to) => { ["squad", "xi", "bench", "in"].forEach((k) => { if (Array.isArray(w[k])) w[k] = w[k].map((i) => (i === from ? to : i)); }); };

  /* 1. one club over the cap: the best-represented club in the first squad is filled to clubLimit + 1 with
        same-position players of that club, taking bench players first and never the armband */
  {
    const c = clone(PF), w = c.plan.weeks[0], club = {}; w.squad.forEach((i) => { club[P[i].t] = (club[P[i].t] || 0) + 1; });
    const full = Object.keys(club).sort((x, y) => club[y] - club[x])[0];
    let need = DATA.rules.clubLimit + 1 - club[full], swapped = 0;
    const victims = benchOf(w).concat(w.squad.filter((i) => !(w.bench || []).includes(i) && i !== w.cap && i !== w.vice)).filter((i) => P[i].t !== full);
    for (const victim of victims) {
      if (need <= 0) break;
      const sub = DATA.players.find((p) => p.t === full && p.p === posOf(victim) && !w.squad.includes(p.id));
      if (sub) { swapIn(w, victim, sub.id); need--; swapped++; }
    }
    const r = need <= 0 ? findWeekCheck(checkPlan(c, DATA, M), w.gw, "club cap") : null;
    ok("mutation: a " + (DATA.rules.clubLimit + 1) + "th player from one club goes red on 'club cap'", !!r && !r.ok, r ? r.detail : "could not build the mutation (club " + full + " had " + club[full] + ", " + swapped + " swapped)");
  }
  /* 2. the captain off the pitch */
  {
    const c = clone(PF), w = c.plan.weeks[0]; w.cap = (w.bench || [])[0];
    const r = findWeekCheck(checkPlan(c, DATA, M), w.gw, "armband");
    ok("mutation: a captain on the bench goes red on 'armband'", !!r && !r.ok, r ? r.detail : "no check");
  }
  /* 3. a player sold in the first week and bought back in the second (§7.10) */
  {
    const c = clone(PF), a = c.plan.weeks[0], b = c.plan.weeks[1];
    const back = (a.out || [])[0], victim = back != null && b ? b.squad.find((i) => posOf(i) === posOf(back) && i !== b.cap && i !== b.vice) : null;
    if (victim != null) { swapIn(b, victim, back); if (!b.in.includes(back)) b.in.push(back); b.out = (b.out || []).concat([victim]); }
    const r = victim != null ? findWeekCheck(checkPlan(c, DATA, M), b.gw, "no rebuy") : null;
    ok("mutation: buying back a player sold inside the window goes red on 'no rebuy'", !!r && !r.ok, r ? r.detail : "could not build the mutation");
  }
  /* 4. an overspent bank */
  {
    const c = clone(PF), w = c.plan.weeks[0], victim = benchOf(w)[0];
    const dear = victim != null ? DATA.players.filter((p) => p.p === posOf(victim) && !w.squad.includes(p.id)).sort((x, y) => y.pr - x.pr)[0] : null;
    if (dear) swapIn(w, victim, dear.id);
    const r = dear ? findWeekCheck(checkPlan(c, DATA, M), w.gw, "bank") : null;
    ok("mutation: buying the dearest player in a position goes red on 'bank'", !!r && !r.ok, r ? r.detail : "could not build the mutation");
  }
  /* 5. a second wildcard */
  {
    const c = clone(PF), target = c.plan.weeks.find((w) => !w.chip && w !== w0);
    if (target) target.chip = "wildcard";
    const res = target ? checkPlan(c, DATA, M) : null, r = res && findPlanCheck(res, "each chip is used at most once");
    ok("mutation: a second wildcard goes red on 'each chip is used at most once'", !!r && !r.ok, r ? r.detail : "could not build the mutation");
  }
  /* 6. expected points moved */
  {
    const c = clone(PF); c.plan.weeks[0].ep = r1(c.plan.weeks[0].ep + 1);
    const r = findWeekCheck(checkPlan(c, DATA, M), w0.gw, "expected points");
    ok("mutation: a week's expected points moved by a point goes red on 'expected points'", !!r && !r.ok, r ? r.detail : "no check");
  }
  /* 7. the solver's own hit count wrong (§7.1: the replay decides, not the solver's field) */
  {
    const c = clone(PF); c.plan.weeks[1].hits = (w1.hits || 0) + 1;
    const r = findWeekCheck(checkPlan(c, DATA, M), w1.gw, "hits");
    ok("mutation: a solver hit count that the replay does not reproduce goes red on 'hits'", !!r && !r.ok, r ? r.detail : "no check");
  }
  /* 8. a plan solved on other data */
  {
    const c = clone(PF); c.hash = "0000000000000000"; const h = hashCheck(c);
    ok("mutation: a foreign hash goes red on the content-hash check", !h.ok, h.detail);
  }
  /* 8b. E-128: a gap tighter than any raw bound proves */
  if (!OPT.skipGap) {
    const c = clone(PF); c.plan.gap = 0.00001; c.plan.gapOwn = c.plan.gapOwn || 0.05;
    const src = PF.source || {}, raw = [];
    [[src.out, (f) => f.plan], [src.long, (f) => f.plan], [src.timing, (f) => f.now]].forEach(([rel, pick]) => { const f = rel ? readJson(here(rel)) : null; if (f && f.hash === PF.hash && pick(f)) raw.push(pick(f)); });
    const key = JSON.stringify((PF.plan || {}).params || null);
    const bestB = raw.filter((p) => p.ok && typeof p.obj === "number" && typeof p.gap === "number" && JSON.stringify(p.params || null) === key).reduce((a, p) => Math.min(a, p.obj * (1 + p.gap)), Infinity);
    const floorGap = isFinite(bestB) ? bestB / PF.plan.obj - 1 : null;
    ok("mutation: a gap of 0.00001 no raw solve supports goes red on the E-128 check", floorGap !== null && c.plan.gap < floorGap - 1e-6, "floor " + (floorGap === null ? "none" : floorGap.toFixed(5)) + " vs claimed " + c.plan.gap);
  }
  /* 8c. E-129: a timing scenario stopped on its clock */
  if (!OPT.skipGap && PF.timing && PF.timing.never) {
    const c = clone(PF); c.timing.never.gap = 0.113;
    ok("mutation: a 'never' scenario left at an 11% gap goes red on the E-129 timing check", timingProved(PF.timing) && !timingProved(c.timing), "real " + timingProved(PF.timing) + " · with never at " + c.timing.never.gap + ": " + timingProved(c.timing));
  }
  /* 9. the acceptance: total and chip weeks moved */
  if (GOLDEN) {
    const c = clone(PF); c.plan.total = r1(c.plan.total * (1 + TOTAL_TOL + 0.01));
    const t = acceptance(c, GOLDEN, M).find((x) => x.name.indexOf("C1 the plan total") === 0);
    ok("mutation: a total 3% off goes red on the C1 total acceptance", !!t && !t.ok, t ? t.detail : "no check");
    const d = clone(PF), wcWeek = d.plan.weeks.find((w) => w.chip === "wildcard"), other = d.plan.weeks.find((w) => !w.chip);
    if (wcWeek && other) { other.chip = "wildcard"; wcWeek.chip = null; }
    const k = acceptance(d, GOLDEN, M).find((x) => x.name.indexOf("C1 the chip weeks") === 0);
    ok("mutation: the wildcard moved to another week goes red on the C1 chip-weeks acceptance", !!k && !k.ok, k ? k.detail : "no check");
    /* E-106: the checks that replaced the photographs must each be able to go red. */
    const acc = (x, prefix) => acceptance(x, GOLDEN, M).find((y) => y.name.indexOf(prefix) === 0);
    const e = clone(PF), tcWeek = e.plan.weeks.find((w) => w.chip === "3xc"), notCap = tcWeek ? tcWeek.xi.find((i) => i !== tcWeek.cap) : null;
    if (tcWeek && notCap != null) tcWeek.cap = notCap;
    const kc = tcWeek ? acc(e, "C1 the chip weeks") : null;
    ok("mutation: the triple captain handed to another player goes red on the C1 chip-weeks acceptance", !!kc && !kc.ok, kc ? kc.detail : "no triple-captain week");
    const f = clone(PF), free = f.plan.weeks.find((w) => !w.chip);
    if (free) free.chip = "bboost";
    const kb = free ? acc(f, "C1 the chip weeks") : null;
    ok("mutation: a second bench boost goes red on the C1 chip-weeks acceptance", !!kb && !kb.ok, kb ? kb.detail : "no chip-free week");
    const refOut = readJson(path.join(REF_APP, "solver_out.json")), refObj = refOut && refOut.plan ? refOut.plan.obj : null;
    const o = clone(PF); o.plan.obj = typeof refObj === "number" ? r1(refObj - 1) : o.plan.obj;
    const ko = acc(o, "C1 the plan's objective");
    ok("mutation: an objective a point under the recorded incumbent's goes red (E-106)", typeof refObj === "number" && !!ko && !ko.ok, ko ? ko.detail : "no check");
    const h = clone(PF); h.plan.weeks[1].hits = (h.plan.weeks[1].hits || 0) + 1;
    const kh = acc(h, "C1 no hits");
    ok("mutation: a hit in the plan goes red on the C1 no-hits acceptance", !!kh && !kh.ok, kh ? kh.detail : "no check");
    const q = clone(PF); q.plan.gap = GAP_MAX + 0.001;
    const kq = acc(q, "C2 the proven gap");
    ok("mutation: a gap over " + GAP_MAX + " goes red on the C2 acceptance", !!kq && !kq.ok, kq ? kq.detail : "no check");
    if (PF.timing && PF.timing.later) {
      const t2 = clone(PF); t2.timing.later.total = r1(t2.timing.later.total * (1 + TOTAL_TOL + 0.01));
      const kt = acc(t2, "C4 wildcard timing");
      ok("mutation: a later-wildcard total 3% off goes red on the C4 acceptance", !!kt && !kt.ok, kt ? kt.detail : "no check");
    }
  }
}

finish();

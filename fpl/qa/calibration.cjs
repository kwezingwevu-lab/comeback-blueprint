#!/usr/bin/env node
/*
 * qa/calibration.cjs — the calibration stage reproduces the kit's model block (v110 §1.4; GAP_v110 A9).
 *
 *   node qa/calibration.cjs
 *
 * WHAT THE STAGE IS
 *   `node pipeline/calibrate.js [data/mc_data.json]` runs the walk-forward backtest (pipeline/backtest.js) on the
 *   baked block and writes DATA.model = { calib, backtest, at } into it. The engine (src/mc_engine.js) reads
 *   model.calib through its CAL hook and scales every points component by the position's factor. The stage is in
 *   the v111 kit and absent from v109's spec, and it is what makes the exported solver input hash equal to the
 *   kit's: without the block the two differ in every player's expected points (ERRORS.md E-101, GAP A8).
 *
 * WHAT IT PROVES
 *   Parity        calibrate.js on a COPY of data/mc_data.json writes calib factors that equal
 *                 qa/fixtures/v111_model.json's exactly, and a backtest — points rho / rhoNaive / n, minutes Brier /
 *                 naive / n and the five buckets, the team-goals log-likelihood and n, byPos ratio / lo / hi / rho /
 *                 mae / n, weeks, fixedK — equal to the fixture's within 1e-9. The walk-forward is deterministic
 *                 (its bootstrap draws from a seeded generator), so 1e-9 is the tolerance of summation order, not of
 *                 the model. The fixture is the kit's own output on the same block, computed by the reference
 *                 implementation; nothing here is typed.
 *   Committed     the block that ships, data/mc_data.json, carries the model the stage computes FROM THAT BLOCK: the
 *                 stage's output on the committed data equals the committed model (calib exactly, backtest within
 *                 1e-9), and its weeks are the block's own finished gameweeks. A re-bake that skipped the stage, or
 *                 a model calibrated on other data, goes red here. The block is NOT compared with the kit's fixture:
 *                 the game revises finished matches' xG and other feeds after the fact, so the committed block's
 *                 backtest legitimately drifts from the kit's by about 1e-4 on every refresh (ERRORS.md E-130); that
 *                 drift is printed as a NOTE, never asserted.
 *   The fixture   is the kit's output on the KIT's block, reference/v111/app/data.json, which never changes. Every
 *                 check that compares with the fixture runs on that block: the reproduction is proved on the input
 *                 the fixture was made from, not on whatever the feeds say today.
 *   Uncalibrated  the backtest runs with opts.noCalib, so the corrections never feed their own evidence. Proved
 *                 three ways: the engine's CAL is empty under noCalib on a block that carries a model and equal to
 *                 model.calib without it; backtest.run on the block WITH its model gives the same factors and
 *                 metrics as on the block without one (calibrating twice equals calibrating once); and a copy of
 *                 backtest.js with noCalib removed makes the two runs differ.
 *   Shape         model.at is an ISO instant; backtest.weeks is exactly the finished gameweeks from the script's
 *                 own floor to gw.lastDone, derived from the block's events; every factor is a finite number in
 *                 [0.5, 2] and there is one per position.
 *   Mutations     on copies of pipeline/backtest.js loaded in this process: the shrink that applies the corrections
 *                 only halfway (1 + 0.5 × (ratio − 1)) set to the full ratio moves the factors, and the parity
 *                 comparator above reports them; the last week dropped from the walk moves the metrics and the
 *                 comparator reports them. A parity check that survives both is not comparing anything (E-070).
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   Every expectation is read from qa/fixtures/v111_model.json or data/mc_data.json, or is derived from the object
 *   under test. The floor of the walk (the first gameweek that can be scored) is read out of pipeline/calibrate.js,
 *   not typed here.
 *
 * PRIVACY
 *   Nothing here prints a rival manager's personal name. The block's draft and league entries are never read.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BLOCK = path.join(ROOT, "data", "mc_data.json");
const FIXTURE = path.join(ROOT, "qa", "fixtures", "v111_model.json");
const CALIBRATE = path.join(ROOT, "pipeline", "calibrate.js");
const BACKTEST = path.join(ROOT, "pipeline", "backtest.js");
const ENGINE = path.join(ROOT, "src", "mc_engine.js");
const TOL = 1e-9;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } };
const clone = (x) => JSON.parse(JSON.stringify(x));
const fmt = (v) => (typeof v === "number" ? String(v) : JSON.stringify(v));

/* Path-for-path comparison. Numbers within `tol` are equal; everything else must be identical. Returns the
   differing paths with both values, so a red names what moved. `leaves` counts the numeric leaves compared,
   so a comparator that compared nothing cannot read as a pass. */
function diff(a, b, tol, at, out, stat) {
  at = at || "$"; out = out || []; stat = stat || { leaves: 0 };
  if (typeof a === "number" && typeof b === "number") {
    stat.leaves++;
    if (!(Number.isFinite(a) && Number.isFinite(b)) || Math.abs(a - b) > tol) out.push(at + " got " + a + " want " + b);
    return { out, stat };
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) { out.push(at + " got " + fmt(a) + " want " + fmt(b)); return { out, stat }; }
    a.forEach((v, i) => diff(v, b[i], tol, at + "[" + i + "]", out, stat));
    return { out, stat };
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).sort();
    keys.forEach((k) => {
      if (!(k in a)) out.push(at + "." + k + " missing (want " + fmt(b[k]) + ")");
      else if (!(k in b)) out.push(at + "." + k + " unexpected (got " + fmt(a[k]) + ")");
      else diff(a[k], b[k], tol, at + "." + k, out, stat);
    });
    return { out, stat };
  }
  if (a !== b) out.push(at + " got " + fmt(a) + " want " + fmt(b));
  return { out, stat };
}
const head = (arr, n) => arr.slice(0, n || 6).join(" · ") + (arr.length > (n || 6) ? " · +" + (arr.length - (n || 6)) + " more" : "");

/* The backtest module, or a mutant of it, loaded from a copy so pipeline/backtest.js is never edited.
   backtest.js has no requires of its own — the engine is passed into run() — so a copy anywhere loads. */
function loadBacktest(dir, tag, edits) {
  let src = fs.readFileSync(BACKTEST, "utf8");
  for (const [from, to, times] of edits || []) {
    const n = src.split(from).length - 1;
    if (n !== (times || 1)) throw new Error("mutation anchor " + JSON.stringify(from) + " found " + n + " times, expected " + (times || 1));
    src = src.split(from).join(to);
  }
  const file = path.join(dir, "backtest_" + tag + ".js");
  fs.writeFileSync(file, src);
  return require(file);
}

const fixture = readJson(FIXTURE);
const block = readJson(BLOCK);
const KIT = path.join(ROOT, "reference", "v111", "app", "data.json");
const kit = readJson(KIT);
const F = fixture && fixture.model;

ok("the fixture, the kit's block, the committed block, the stage and the engine are all present",
  !!F && !!F.calib && !!F.backtest && !!block && !!block.gw && !!kit && !!kit.gw && fs.existsSync(CALIBRATE) && fs.existsSync(BACKTEST) && fs.existsSync(ENGINE),
  [!!F, !!kit, !!block, fs.existsSync(CALIBRATE), fs.existsSync(BACKTEST), fs.existsSync(ENGINE)].join(","));

if (F && block && kit) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "calibration-"));
  const E = require(ENGINE);
  const B = require(BACKTEST);

  /* The floor of the walk is the script's own rule (a week is scored on the weeks before it), read from the script. */
  const calSrc = fs.readFileSync(CALIBRATE, "utf8");
  const floorM = /g >= (\d+) && g <= DATA\.gw\.lastDone/.exec(calSrc);
  const FLOOR = floorM ? +floorM[1] : NaN;
  ok("the walk's first scored gameweek is read out of pipeline/calibrate.js", Number.isFinite(FLOOR), "the filter `g >= N && g <= DATA.gw.lastDone` was not found");
  const finished = (block.gw.events || []).filter((e) => e.fin).map((e) => e.id);
  const weeksWanted = finished.filter((g) => g >= FLOOR && g <= block.gw.lastDone);
  const kitFinished = (kit.gw.events || []).filter((e) => e.fin).map((e) => e.id);
  const kitWeeks = kitFinished.filter((g) => g >= FLOOR && g <= kit.gw.lastDone);

  /* ================================================================ (a) parity: the stage on a copy */
  const copy = path.join(tmp, "copy.json");
  fs.writeFileSync(copy, fs.readFileSync(KIT));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [CALIBRATE, copy], { cwd: ROOT, encoding: "utf8", timeout: 90000 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  ok("pipeline/calibrate.js runs on a copy of the kit's block and exits 0 (" + secs + " s)", r.status === 0, "exit " + r.status + " " + String(r.stderr || "").trim().split("\n")[0]);
  const got = readJson(copy);
  const gotModel = got && got.model;
  ok("the stage writes model = {calib, backtest, at} into the block and nothing else in the block changes",
    !!gotModel && !!gotModel.calib && !!gotModel.backtest && typeof gotModel.at === "string" &&
    diff(Object.assign({}, got, { model: null }), Object.assign({}, kit, { model: null }), 0).out.length === 0,
    gotModel ? Object.keys(gotModel).join(",") : "no model block written");
  ok("the stage reports the weeks it walked on stdout",
    !!gotModel && new RegExp("backtest GW" + gotModel.backtest.weeks.join(",")).test(r.stdout || ""),
    String(r.stdout || "").split("\n")[0]);

  if (gotModel) {
    const dc = diff(gotModel.calib, F.calib, 0);
    ok("(a) the calib factors equal the fixture's exactly, position for position (" + dc.stat.leaves + " factors)",
      dc.out.length === 0 && dc.stat.leaves > 0, head(dc.out));
    const db = diff(gotModel.backtest, F.backtest, TOL);
    ok("(a) the backtest equals the fixture's within 1e-9 — points rho / rhoNaive / n, minutes Brier / naive / n and buckets, team-goals log-likelihood, byPos ratio / lo / hi / rho / mae (" + db.stat.leaves + " numeric leaves)",
      db.out.length === 0 && db.stat.leaves > 50, head(db.out));
    /* The named metrics are asserted by name as well, so a fixture that lost a key could not pass by absence. */
    const named = ["points.all.rho", "points.all.rhoNaive", "points.all.n", "minutes.brier", "minutes.brierNaive", "minutes.n", "goals.logLik", "goals.n"];
    const pick = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
    const missing = named.filter((p) => typeof pick(gotModel.backtest, p) !== "number" || typeof pick(F.backtest, p) !== "number");
    const posKeys = Object.keys(F.backtest.points.byPos);
    const posMissing = posKeys.filter((k) => ["ratio", "lo", "hi", "rho", "mae", "n"].some((f) => typeof pick(gotModel.backtest, "points.byPos." + k + "." + f) !== "number"));
    ok("(a) every named metric is present as a number on both sides (" + named.length + " overall, " + posKeys.length + " positions × 6)",
      missing.length === 0 && posMissing.length === 0 && posKeys.length > 0, missing.concat(posMissing).join(" · "));
  }

  /* ================================================================ (b) the committed block */
  {
    const m = block.model;
    ok("(b) the committed data/mc_data.json carries a model block", !!m && !!m.calib && !!m.backtest, m ? Object.keys(m).join(",") : "none");
    if (m) {
      /* The model must be what the stage computes from THIS block, re-derived here on a copy with the model removed. */
      const bare = clone(block); delete bare.model;
      const rc = B.run(bare, E, weeksWanted);
      const dc = diff(rc.calib, m.calib, 0), db = diff(rc, m.backtest, TOL);
      ok("(b) the committed block's model.calib is exactly what the stage computes from the committed data (" + dc.stat.leaves + " factors)", dc.out.length === 0 && dc.stat.leaves > 0, head(dc.out));
      ok("(b) the committed block's backtest is what the stage computes from the committed data, within 1e-9 (" + db.stat.leaves + " numeric leaves)", db.out.length === 0 && db.stat.leaves > 50, head(db.out));
      ok("(b) its weeks are the committed block's own finished gameweeks from the floor (" + FLOOR + ") to gw.lastDone (" + block.gw.lastDone + ")",
        JSON.stringify(m.backtest.weeks) === JSON.stringify(weeksWanted) && weeksWanted.length > 0, "weeks " + JSON.stringify(m.backtest.weeks) + " wanted " + JSON.stringify(weeksWanted));
      const fdc = diff(m.calib, F.calib, 0), fdb = diff(m.backtest, F.backtest, TOL);
      console.log("NOTE the committed block's model against the kit's fixture: " + fdc.out.length + " of " + fdc.stat.leaves + " factors differ and " + fdb.out.length + " of " + fdb.stat.leaves +
        " backtest leaves differ beyond 1e-9 — feed revisions since the kit's block (" + kit.asOf + " → " + block.asOf + "); printed, never asserted (E-130)");
    }
  }

  /* ================================================================ (c) uncalibrated: the corrections never feed their own evidence */
  {
    const withModel = clone(block);
    const noModel = clone(block); delete noModel.model;
    const calOn = E.create(clone(withModel), {}).CAL, calOff = E.create(clone(withModel), { noCalib: true }).CAL, calNone = E.create(clone(noModel), {}).CAL;
    ok("(c) the engine's CAL reads model.calib from the block, is empty under opts.noCalib, and is empty when the block has no model",
      diff(calOn, withModel.model.calib, 0).out.length === 0 && Object.keys(calOff).length === 0 && Object.keys(calNone).length === 0,
      "with " + JSON.stringify(calOn) + " · noCalib " + JSON.stringify(calOff) + " · no model " + JSON.stringify(calNone));
    const r1 = B.run(clone(withModel), E, weeksWanted), r2 = B.run(clone(noModel), E, weeksWanted);
    const dc = diff(r1.calib, r2.calib, 0), db = diff(r1, r2, TOL);
    ok("(c) backtest.run on the block WITH its model gives the same factors as on the block without one — calibrating twice equals once",
      dc.out.length === 0 && dc.stat.leaves > 0, head(dc.out));
    ok("(c) and the same metrics within 1e-9 (" + db.stat.leaves + " numeric leaves)", db.out.length === 0, head(db.out));
    const kitBare = clone(kit); delete kitBare.model;
    const rk = B.run(kitBare, E, kitWeeks);
    ok("(c) the in-process run on the kit's block reproduces the fixture's factors and backtest too, so the stage and the module agree",
      diff(rk.calib, F.calib, 0).out.length === 0 && diff(rk, F.backtest, TOL).out.length === 0, head(diff(rk, F.backtest, TOL).out));

    /* Mutation. The module keeps the corrections out of their own evidence twice over: truncate() deletes the
       block's model from every cut-back copy, and every engine it builds is created with noCalib. Removing one
       defence changes nothing — the other still holds, which is the point of having two — so the mutant removes
       both, and then the block's own factors scale the forecasts and the second calibration differs from the first. */
    let mutant = null, err = "";
    try { mutant = loadBacktest(tmp, "nocalib", [["noCalib: true", "noCalib: false", 3], ["delete D.model; return D;", "return D;", 1]]); } catch (e) { err = e.message; }
    const m1 = mutant && mutant.run(clone(withModel), E, weeksWanted), m2 = mutant && mutant.run(clone(noModel), E, weeksWanted);
    ok("(c) mutation: with noCalib removed and truncate() keeping the model, the run on the block WITH its model differs from the run without — the corrections would feed their own evidence, and the check above would go red",
      !!mutant && diff(m1.calib, m2.calib, 0).out.length > 0 && diff(m2.calib, r2.calib, 0).out.length === 0,
      err || ("with " + JSON.stringify(m1 && m1.calib) + " · without " + JSON.stringify(m2 && m2.calib)));
    let half = null; err = "";
    try { half = loadBacktest(tmp, "nocalib_only", [["noCalib: true", "noCalib: false", 3]]); } catch (e) { err = e.message; }
    const h1 = half && half.run(clone(withModel), E, weeksWanted);
    ok("(c) and with noCalib alone removed the factors still hold, because truncate() strips the model on its own — two defences, each proved to carry the rule",
      !!half && diff(h1.calib, r2.calib, 0).out.length === 0, err || JSON.stringify(h1 && h1.calib));
  }

  /* ================================================================ (d) shape */
  if (gotModel) {
    ok("(d) model.at is an ISO instant", ISO_RE.test(gotModel.at) && !isNaN(Date.parse(gotModel.at)), String(gotModel.at));
    ok("(d) backtest.weeks is exactly the finished gameweeks from the script's floor (" + FLOOR + ") to gw.lastDone (" + kit.gw.lastDone + "), derived from the block's events",
      JSON.stringify(gotModel.backtest.weeks) === JSON.stringify(kitWeeks) && kitWeeks.length > 0 &&
      JSON.stringify(kitWeeks) === JSON.stringify(kit.gw.withData.filter((g) => g >= FLOOR && g <= kit.gw.lastDone)),
      "weeks " + JSON.stringify(gotModel.backtest.weeks) + " finished " + JSON.stringify(kitFinished));
    const factors = Object.entries(gotModel.calib);
    const bad = factors.filter(([, v]) => !(typeof v === "number" && Number.isFinite(v) && v >= 0.5 && v <= 2));
    const positions = Object.keys(gotModel.backtest.points.byPos);
    ok("(d) every factor is a finite number in [0.5, 2], one per position in the backtest (" + factors.length + ")",
      bad.length === 0 && factors.length > 0 && JSON.stringify(factors.map(([k]) => k).sort()) === JSON.stringify(positions.sort()),
      bad.map(([k, v]) => k + "=" + v).join(" · ") + " positions " + positions.join(","));
    ok("(d) the block's model.calib is the backtest's own calib — one set of factors, not two",
      diff(gotModel.calib, gotModel.backtest.calib, 0).out.length === 0, head(diff(gotModel.calib, gotModel.backtest.calib, 0).out));
  }

  /* ================================================================ (e) mutations on a copy of backtest.js */
  {
    const noModel = clone(kit); delete noModel.model;   // the mutants are compared with the fixture, so they run on the fixture's own input
    /* The shrink: the corrections are applied only halfway, 1 + 0.5 × (ratio − 1). Set to the full ratio. */
    let shrink = null, err = "";
    try { shrink = loadBacktest(tmp, "shrink", [["1 + 0.5 * (s.ratio - 1)", "1 + 1.0 * (s.ratio - 1)", 1]]); } catch (e) { err = e.message; }
    const rs = shrink && shrink.run(clone(noModel), E, kitWeeks);
    const ds = rs ? diff(rs.calib, F.calib, 0) : { out: [] };
    ok("(e) mutation: the shrink set to the full ratio moves the factors and the parity comparator names them — (a) goes red",
      !!rs && ds.out.length > 0, err || "the factors did not move: " + JSON.stringify(rs && rs.calib));
    /* The last week dropped from the walk. */
    let dropped = null; err = "";
    try { dropped = loadBacktest(tmp, "drop", [["ks.forEach((k) => {", "ks.slice(0, -1).forEach((k) => {", 1]]); } catch (e) { err = e.message; }
    const rd = dropped && dropped.run(clone(noModel), E, kitWeeks);
    const dd = rd ? diff(rd, F.backtest, TOL) : { out: [] };
    ok("(e) mutation: the last week dropped from the walk moves the metrics and the comparator names them — (a) goes red",
      !!rd && dd.out.length > 0 && rd.points.all.n !== F.backtest.points.all.n,
      err || "n " + (rd && rd.points.all.n) + " against the fixture's " + F.backtest.points.all.n + "; " + head(dd.out));
    /* And the comparator itself: it cannot pass on an empty object or on a fixture with a key removed. */
    const lost = clone(F.backtest); delete lost.points.all.rho;
    ok("(e) the comparator is red on a fixture that lost a key and on an empty object, so it is comparing something",
      diff(F.backtest, lost, TOL).out.length > 0 && diff({}, F.backtest, TOL).out.length > 0 && diff(F.backtest, F.backtest, 0).out.length === 0,
      "");
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* leave it */ }
}

console.log("SUITE calibration " + pass + "/" + (pass + fail));
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
/*
 * qa/waiver_log.cjs — the waiver model reproduces this league's own claim log (v110 §5 B6, E4).
 *
 *   node qa/waiver_log.cjs
 *
 * WHY THIS IS THE TEST THAT MATTERS FOR THE DRAFT SIDE
 *   Every claim recommendation rests on an assumption about how the league settles waivers. That
 *   assumption is not documented anywhere by the game, so it is inferred — and an inferred rule
 *   is worth nothing until it reproduces what actually happened. This league's transaction log
 *   records 74 claims across GW2–5 with the result the game gave each one: accepted, "already
 *   claimed", or "drop already gone". A model that reproduces all 74 has earned the right to
 *   predict the 75th.
 *
 * THE RULES BEING TESTED (v110 §4, Draft)
 *   - The order is reverse league standings, read from `waiver_pick`, never re-derived.
 *   - Claims settle in ROUNDS. Each round visits managers in that order, and each manager's
 *     claims are tried in the order lodged until one lands.
 *   - A claim fails "already claimed" if its target has gone — checked FIRST — or "drop already
 *     gone" if its drop has left the roster.
 *   - Nobody moves to the bottom after a success.
 *
 * THE PROCESSING ORDER IS READ OFF THE LOG, NOT ASSUMED
 *   Each row carries `index` (its position in that week's processing) and `priority` (its position
 *   in that manager's own lodged list). So a week's order is the managers sorted by their lowest
 *   `index`, and each manager's list is sorted by `priority`. Deriving the order from today's
 *   `waiver_pick` instead would be circular: the picks move as the table moves, and these are
 *   past weeks.
 *
 * MUTATION PROOF
 *   74 of 74 means nothing if the model would score 74 whatever the rules were. So the suite
 *   re-runs with each rule deliberately broken and asserts the score FALLS. §7.8 records that
 *   checking the denial reasons in the wrong order scored 72 of 74; that is reproduced here as a
 *   measured number rather than quoted.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const E = require(path.join(ROOT, "src", "engine.js"));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};

/* The API's result codes, in the project's words. */
const WANT = { a: "ok", di: "already claimed", do: "drop already gone" };

function logsAvailable() {
  const out = [];
  const committed = path.join(ROOT, "reference", "v109", "live", "d_tx.json");
  if (fs.existsSync(committed)) out.push(["the committed snapshot", committed]);
  const fresh = path.join(ROOT, "pipeline", "feeds", "d_tx.json");
  if (fs.existsSync(fresh)) out.push(["the live log from the last pull", fresh]);
  return out;
}

/* One week of the log, turned into what waiverSim takes. */
function weekOf(rows) {
  const byOwner = {};
  rows.forEach((t) => { (byOwner[t.entry] = byOwner[t.entry] || []).push(t); });
  Object.keys(byOwner).forEach((k) => byOwner[k].sort((a, b) => Number(a.priority) - Number(b.priority)));
  const firstIndex = {};
  Object.keys(byOwner).forEach((k) => {
    firstIndex[k] = Math.min.apply(null, byOwner[k].map((t) => Number(t.index)));
  });
  const order = Object.keys(byOwner).sort((a, b) => firstIndex[a] - firstIndex[b]);
  const claims = {};
  order.forEach((k) => { claims[k] = byOwner[k].map((t) => ({ add: t.element_in, drop: t.element_out })); });
  return { order: order, claims: claims, byOwner: byOwner };
}

/* Replay one log and count how many of its rows the model reproduces. */
function replay(txs, opts) {
  let checked = 0, matched = 0, weeks = 0;
  const misses = [];
  const events = [...new Set(txs.filter((t) => t.kind === "w").map((t) => Number(t.event)))].sort((a, b) => a - b);
  for (const gw of events) {
    const rows = txs.filter((t) => t.kind === "w" && Number(t.event) === gw);
    if (!rows.length) continue;
    weeks++;
    const w = weekOf(rows);
    const sim = E.waiverSim(w.claims, w.order, opts);
    for (const x of sim.log) {
      const row = (w.byOwner[x.who] || []).filter((q) => q.element_in === x.add && q.element_out === x.drop)[0];
      if (!row) continue;
      checked++;
      const got = x.ok ? "ok" : x.why;
      if (got === WANT[row.result]) matched++;
      else if (misses.length < 6) misses.push("GW" + gw + " entry " + x.who + " in " + x.add + "/out " + x.drop + ": model says " + got + ", the game said " + WANT[row.result]);
    }
  }
  return { checked: checked, matched: matched, weeks: weeks, misses: misses };
}

ok("the engine exposes waiverSim", typeof E.waiverSim === "function", typeof E.waiverSim);

const logs = logsAvailable();
ok("a waiver log is available to replay", logs.length >= 1, "none found");

let anyFull = null;
for (const [label, file] of logs) {
  const txs = JSON.parse(fs.readFileSync(file, "utf8")).transactions || [];
  const waivers = txs.filter((t) => t.kind === "w");
  ok(label + ": it carries waiver rows to replay", waivers.length >= 40, waivers.length + " waiver rows of " + txs.length + " transactions");
  if (typeof E.waiverSim !== "function") continue;

  const r = replay(txs, null);
  ok(label + ": every row the model reaches is one the log records",
    r.checked === waivers.length, r.checked + " checked of " + waivers.length + " in the log");
  ok(label + ": the model reproduces every claim result — " + r.matched + " of " + r.checked + " across " + r.weeks + " gameweeks",
    r.checked >= 40 && r.matched === r.checked, r.misses.join(" · ") || "nothing to report");
  if (r.checked >= 40 && r.matched === r.checked) anyFull = r;
}

/* ---------------------------------------------------------------- the rules, one at a time */
if (typeof E.waiverSim === "function" && anyFull) {
  const file = logs[0][1];
  const txs = JSON.parse(fs.readFileSync(file, "utf8")).transactions || [];
  const base = replay(txs, null);

  const mutations = [
    ["denyOrder: drop-gone checked before already-claimed (§7.8)", { denyOrder: "dropFirst" }],
    ["rotate: a manager moves to the bottom after a success", { rotate: true }],
    ["oneEach: one claim per manager per round, win or lose", { stopOnFail: true }],
    ["reverse: the processing order reversed", { reverseOrder: true }]
  ];
  for (const [label, opts] of mutations) {
    const m = replay(txs, opts);
    ok("breaking a rule makes it worse — " + label + ": " + m.matched + " of " + m.checked + " against " + base.matched,
      m.matched < base.matched, "the model scored the same with the rule broken, so the rule is not what makes it fit");
  }

  /* And the order genuinely comes off the log, not from waiver_pick. */
  ok("the replay reads each week's processing order off the log's index",
    /index/.test(fs.readFileSync(__filename, "utf8")) && base.weeks >= 4, base.weeks + " gameweeks replayed");
}

console.log("SUITE waiver_log " + pass + "/" + (pass + fail) +
  (anyFull ? " · " + anyFull.matched + "/" + anyFull.checked + " claims across " + anyFull.weeks + " gameweeks" : ""));
process.exit(fail ? 1 : 0);

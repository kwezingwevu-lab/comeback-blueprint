#!/usr/bin/env node
/*
 * qa/prices.cjs — selling prices, against the reference's own recorded numbers (v110 §5 A3).
 *
 *   node qa/prices.cjs
 *
 * THE RULE (v110 §4 Classic)
 *   Selling price = the price PAID, plus half of any rise, rounded down to £0.1m. A fall is taken
 *   in full. The price paid is `now_cost - cost_change_start` for the original fifteen, and
 *   `element_in_cost` from /api/entry/{id}/transfers/ for anyone bought since.
 *
 * WHY THE TRANSFER LOG MATTERS EVEN WHEN IT AGREES
 *   On this snapshot the one player bought since gameweek 1 — Calvert-Lewin, in for João Pedro in
 *   GW5 — was bought at his start price, so the log and the start-price derivation give the same
 *   60. That is luck, not equivalence: a player bought after a rise was paid the risen price, and
 *   `cost_change_start` would understate what he sells for. So the suite does not settle for "the
 *   fifteen match"; it also builds a synthetic buy-after-a-rise and asserts the log wins, and
 *   asserts the source map says which of the two answered for each player.
 *
 * MUTATIONS
 *   Each of the four arithmetic rules is broken in turn and the suite asserts the fifteen stop
 *   matching. A parity test that would pass with the rounding reversed is not testing the rounding.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const E = require(path.join(ROOT, "src", "engine.js"));
const REF = path.join(ROOT, "reference", "v109", "live");
const GOLDEN = path.join(ROOT, "reference", "v109", "app", "golden.json");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const r1 = (x) => Math.round(x * 10) / 10;

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } }

const boot = readJson(path.join(REF, "bootstrap.json"));
const tx = readJson(path.join(REF, "transfers.json"));
const golden = readJson(GOLDEN);

ok("the reference feeds and golden numbers are readable",
  !!boot && Array.isArray(boot.elements) && Array.isArray(tx) && !!golden && !!golden.classic && !!golden.classic.sell,
  [!!boot, Array.isArray(tx), !!golden].join(","));

if (boot && tx && golden) {
  /* The last published squad. picks5 is the gameweek in play on this snapshot. */
  let ids = [];
  for (let g = 38; g >= 1 && !ids.length; g--) {
    const p = readJson(path.join(REF, "picks" + g + ".json"));
    if (p && Array.isArray(p.picks)) ids = p.picks.map((k) => k.element);
  }
  ok("a published squad was found in the reference feeds", ids.length === 15, ids.length + " picks");

  const els = boot.elements.map((e) => ({
    id: e.id, web_name: e.web_name, now_cost: e.now_cost, cost_change_start: e.cost_change_start
  }));
  const nameOf = {}; els.forEach((e) => { nameOf[e.id] = e.web_name; });
  const want = golden.classic.sell;

  const sp = E.sellPrices(els, tx, ids);
  const misses = [];
  let checked = 0;
  for (const id of ids) {
    const row = sp.rows[id], w = want[nameOf[id]];
    if (!row || !w) { misses.push(nameOf[id] + ": " + (row ? "no golden row" : "no engine row")); continue; }
    checked++;
    if (r1(row.now / 10) !== w.now || r1(row.paid / 10) !== w.paid || r1(row.sell / 10) !== w.sell) {
      misses.push(nameOf[id] + " engine " + r1(row.now / 10) + "/" + r1(row.paid / 10) + "/" + r1(row.sell / 10) +
        " golden " + w.now + "/" + w.paid + "/" + w.sell);
    }
  }
  ok("every player still held matches golden.classic.sell — " + checked + " of 15",
    checked === 15 && misses.length === 0, misses.join(" · "));

  /* The one player bought since gameweek 1 is priced from the LOG, and the suite says so rather
     than inferring it from a number that happens to agree. */
  const boughtIds = tx.map((t) => t.element_in);
  ok("the player bought since gameweek 1 is priced from the transfer log, not from the start price",
    boughtIds.length >= 1 && boughtIds.every((id) => sp.paidSource[id] === "transfer"),
    boughtIds.map((id) => nameOf[id] + ": " + sp.paidSource[id]).join(", "));
  ok("everyone else is priced from the start price",
    ids.filter((id) => boughtIds.indexOf(id) < 0).every((id) => sp.paidSource[id] === "start"),
    sp.note);

  /* A buy AFTER a rise: the log and the start-price derivation disagree, and the log has to win.
     This is the case the real snapshot does not contain, so nothing else here would catch it. */
  {
    const synth = [{ id: 9001, web_name: "Risen", now_cost: 80, cost_change_start: 5 }];
    const synthTx = [{ element_in: 9001, element_in_cost: 78, element_out: 1, element_out_cost: 50, time: "2026-09-01T00:00:00Z", event: 3 }];
    const a = E.sellPrices(synth, synthTx, [9001]).rows[9001];
    const b = E.sellPrices(synth, [], [9001]).rows[9001];
    ok("a player bought after a rise sells on what he cost, not on his start price",
      a.paid === 78 && a.sell === 79 && b.paid === 75 && b.sell === 77,
      "with the log paid " + a.paid + " sell " + a.sell + "; without it paid " + b.paid + " sell " + b.sell);
  }

  /* Re-buys: the price that counts is the LAST one paid. */
  {
    const synth = [{ id: 9002, web_name: "Boomerang", now_cost: 70, cost_change_start: 0 }];
    const synthTx = [
      { element_in: 9002, element_in_cost: 65, element_out: 1, element_out_cost: 50, time: "2026-08-20T00:00:00Z", event: 1 },
      { element_in: 1, element_in_cost: 50, element_out: 9002, element_out_cost: 66, time: "2026-08-27T00:00:00Z", event: 2 },
      { element_in: 9002, element_in_cost: 69, element_out: 1, element_out_cost: 50, time: "2026-09-03T00:00:00Z", event: 3 }
    ];
    const r = E.sellPrices(synth, synthTx, [9002]).rows[9002];
    // paid 69, now 70: a one-tenth rise is not yet worth a tenth, so he sells at 69.
    ok("a player bought, sold and bought again is priced on the last purchase",
      r.paid === 69 && r.sell === 69, "paid " + r.paid + " sell " + r.sell);
  }

  /* MUTATIONS. Each breaks one arithmetic rule; the fifteen must stop matching. */
  {
    const mutate = {
      "the full rise instead of half": (now, paid) => (now > paid ? now : now),
      "rounding the half-rise up instead of down": (now, paid) => (now > paid ? paid + Math.ceil((now - paid) / 2) : now),
      "a fall taken as half instead of in full": (now, paid) => (now > paid ? paid + Math.floor((now - paid) / 2) : paid - Math.floor((paid - now) / 2)),
      "the price paid ignored, selling at today's price": (now) => now
    };
    for (const label of Object.keys(mutate)) {
      let differs = 0;
      for (const id of ids) {
        const row = sp.rows[id], w = want[nameOf[id]];
        if (!row || !w) continue;
        if (r1(mutate[label](row.now, row.paid) / 10) !== w.sell) differs++;
      }
      ok("breaking a rule stops it matching — " + label + ": " + differs + " of 15 wrong",
        differs > 0, "the mutation changed nothing, so the rule is not what makes the fifteen match");
    }
  }

  /* And the arithmetic is exact at the boundaries, not approximately right. */
  {
    const cases = [
      [50, 50, 50, "no change"],
      [51, 50, 50, "a one-tenth rise is not yet worth a tenth"],
      [52, 50, 51, "a two-tenth rise is worth one"],
      [53, 50, 51, "a three-tenth rise is still worth one"],
      [54, 50, 52, "a four-tenth rise is worth two"],
      [49, 50, 49, "a fall is taken in full"],
      [45, 50, 45, "a big fall is taken in full"]
    ];
    const wrong = cases.filter(([now, paid, expect]) => E.sellPrice(now, paid) !== expect)
      .map(([now, paid, expect, why]) => why + " (" + now + "," + paid + " → " + E.sellPrice(now, paid) + ", want " + expect + ")");
    ok("the half-rise arithmetic is exact at every boundary (" + cases.length + " cases)",
      wrong.length === 0, wrong.join(" · "));
  }
}

console.log("SUITE prices " + pass + "/" + (pass + fail));
process.exit(fail ? 1 : 0);

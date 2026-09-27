#!/usr/bin/env node
/*
 * qa/export_hash.cjs — the solver input and its content hash (v110 §5 A8, §7.7).
 *
 *   node qa/export_hash.cjs
 *
 * WHAT IT PROVES
 *   Parity      pipeline/export.js's buildInput, run on reference/v109/app/data.json with the ported
 *               engine (src/mc_engine.js), reproduces reference/v109/app/solver_in.json: the same hash
 *               string, and the object equal path for path apart from the two clock fields the
 *               exporter writes outside the hash, `at` (when the export ran) and `dataAsOf` (when the
 *               block was baked). The reference engine (reference/v109/app/engine.js) is run on the
 *               same data in this process, so a miss is attributed: if the reference engine gives the
 *               reference hash and the ported engine does not, the port drifted (a stop-rule event, and
 *               the first ten differing paths are printed); if neither does, the export logic drifted.
 *               The hash is also recomputed from the reference file's own payload, so its definition —
 *               sha1 of the JSON of {next, gws, cEnd, dEnd, classic, draft, players}, first 16 hex —
 *               is proved without any engine at all.
 *   Stability   Two exports of the same data give the same hash, and the hash does not move when the
 *               fields a re-bake changes without changing an input move: asOf, delta, intel.notes, and
 *               the transfer counts, ownership and price pressure a fresh pull always shifts. That is
 *               the A8 law: a harmless re-bake keeps the solved plan (E-093's rule, content not clocks,
 *               applied to the solver's plan; ERRORS.md E-101).
 *   Sensitivity In four separate copies, each with its own engine: one player's price moved by 0.1, one
 *               player's status changed, one start override's probability changed, one fixture's home
 *               side swapped. Each moves the hash, so changed data drops the plan.
 *   Shape       next, gws, cEnd = rules.chipStop, dEnd = redraft.fromGw − 1, classic.{squad, sell, bank,
 *               ft, chips}, draft.{me, roster, pool, aheadTakes}, and every players[].ep with one entry
 *               per gameweek in gws — on the reference export and on the export of the committed block.
 *   Shipped     data/solver_in.json is the export of data/mc_data.json: its hash is what buildInput
 *               gives on the committed block today, and its dataAsOf is the block's asOf. A re-bake
 *               that changes an input goes red here until `npm run export` is run again, which is the
 *               point: the input that ships is the input for the block that ships.
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   Every expectation is read from reference/v109/app/{data,solver_in}.json, from data/mc_data.json, or
 *   derived from the object under test. Nothing is typed; the hash the suite compares against is the
 *   one the reference file carries.
 *
 * MUTATIONS
 *   The path comparator must name a changed expected-points entry; the payload recompute must move when
 *   a player field is dropped or the bank changes; and the four sensitivity checks are each a mutation
 *   of the data the hash must see. A check that cannot fail proves nothing (E-070).
 *
 * PRIVACY
 *   Nothing here prints a rival manager's personal name. Draft entries appear as team names and ids.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const REF_APP = path.join(ROOT, "reference", "v109", "app");
const EXPORT_PATH = path.join(ROOT, "pipeline", "export.js");
const ENGINE_PATH = path.join(ROOT, "src", "mc_engine.js");
const BLOCK_PATH = path.join(ROOT, "data", "mc_data.json");
const SHIPPED_PATH = path.join(ROOT, "data", "solver_in.json");

/* The exporter writes these two beside the hashed payload; they say when, never what. */
const CLOCK_FIELDS = ["at", "dataAsOf"];
const CHIP_NAMES = ["wildcard", "bboost", "3xc", "freehit"];   // the game's four chips (frozen-ok: a rule of the game)

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } };
const clone = (o) => JSON.parse(JSON.stringify(o));
const sha16 = (o) => crypto.createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16);
const isId = (x) => Number.isInteger(x) && x > 0;

/* Every path where two JSON values differ, as $.a.b[3], with both sides; capped so a wholesale miss stays readable. */
function diffPaths(a, b, p, out, cap) {
  p = p || "$"; out = out || []; cap = cap || 10;
  if (out.length >= cap) return out;
  if (a === b) return out;
  const ta = a === null ? "null" : Array.isArray(a) ? "array" : typeof a, tb = b === null ? "null" : Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb || (ta !== "object" && ta !== "array")) { out.push(p + " ref " + JSON.stringify(a) + " got " + JSON.stringify(b)); return out; }
  if (ta === "array") {
    if (a.length !== b.length) { out.push(p + ".length ref " + a.length + " got " + b.length); return out; }
    for (let i = 0; i < a.length && out.length < cap; i++) diffPaths(a[i], b[i], p + "[" + i + "]", out, cap);
    return out;
  }
  for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) {
    if (out.length >= cap) break;
    if (!(k in a)) { out.push(p + "." + k + " only in the export"); continue; }
    if (!(k in b)) { out.push(p + "." + k + " missing from the export"); continue; }
    diffPaths(a[k], b[k], p + "." + k, out, cap);
  }
  return out;
}
const withoutClock = (o) => { const c = Object.assign({}, o); for (const k of CLOCK_FIELDS) delete c[k]; return c; };

/* ---------------------------------------------------------------- 0. what is on disk */
const REF = readJson(path.join(REF_APP, "data.json"));
const REF_IN = readJson(path.join(REF_APP, "solver_in.json"));
ok("the reference data and the reference solver input are readable",
  !!REF && !!REF_IN && Array.isArray(REF_IN.players) && typeof REF_IN.hash === "string",
  [!!REF, !!REF_IN].join(","));

let EXP = null, ENG = null, REF_ENG = null;
const loadErr = [];
try { EXP = require(EXPORT_PATH); } catch (e) { loadErr.push("export: " + e.message.split("\n")[0]); }
try { ENG = require(ENGINE_PATH); } catch (e) { loadErr.push("mc_engine: " + e.message.split("\n")[0]); }
try { REF_ENG = require(path.join(REF_APP, "engine.js")); } catch (e) { loadErr.push("reference engine: " + e.message.split("\n")[0]); }
ok("pipeline/export.js loads under Node and exports buildInput(DATA, M)",
  !!EXP && typeof EXP.buildInput === "function", loadErr.join(" · ") || "buildInput is " + (EXP && typeof EXP.buildInput));
ok("src/mc_engine.js and the reference engine load",
  !!ENG && typeof ENG.create === "function" && !!REF_ENG && typeof REF_ENG.create === "function", loadErr.join(" · "));

if (!(REF && REF_IN && EXP && typeof EXP.buildInput === "function" && ENG && REF_ENG)) {
  console.log("SUITE export_hash " + pass + "/" + (pass + fail));
  process.exit(1);
}

const build = (DATA, engine) => EXP.buildInput(DATA, (engine || ENG).create(DATA));

/* ---------------------------------------------------------------- 1. the hash's definition, from the file alone */
{
  const payload = withoutClock(REF_IN); delete payload.hash;
  ok("A8 the hash is sha1 of the payload JSON without the clock fields, first 16 hex — recomputed from the reference file itself: " + REF_IN.hash,
    sha16(payload) === REF_IN.hash, "recomputed " + sha16(payload) + " vs the file's " + REF_IN.hash);
  ok("A8 the clock fields beside the payload are exactly " + CLOCK_FIELDS.join(" and "),
    CLOCK_FIELDS.every((k) => typeof REF_IN[k] === "string") &&
    Object.keys(REF_IN).filter((k) => !("next gws cEnd dEnd classic draft players hash".split(" ").includes(k))).sort().join(",") === CLOCK_FIELDS.slice().sort().join(","),
    Object.keys(REF_IN).join(","));

  /* Mutation: the recompute has to move when a player field is dropped or the bank changes. */
  const m1 = clone(payload); m1.players.forEach((p) => { delete p.start; });
  const m2 = clone(payload); m2.classic.bank = Math.round((m2.classic.bank + 0.1) * 10) / 10;
  ok("A8 mutation: dropping players[].start from the payload moves the recomputed hash",
    sha16(m1) !== REF_IN.hash, "the hash did not see the players' rows");
  ok("A8 mutation: the bank moved by 0.1 moves the recomputed hash",
    sha16(m2) !== REF_IN.hash, "the hash did not see the bank");
}

/* ---------------------------------------------------------------- 2. parity against the reference file */
let refOut = null, refEngOut = null;
{
  const t0 = Date.now();
  refOut = build(REF);
  refEngOut = build(REF, REF_ENG);
  const ms = Date.now() - t0;
  const want = withoutClock(REF_IN);
  const d = diffPaths(want, refOut, "$", [], 10);
  ok("A8 buildInput on the reference data with the ported engine gives the reference hash " + REF_IN.hash + " (" + ms + " ms for both engines)",
    refOut.hash === REF_IN.hash,
    "got " + refOut.hash + " — first differing paths: " + (d.length ? d.join(" / ") : "none, so the payload matches and the hash routine differs"));
  ok("A8 the export equals the reference solver input path for path, apart from " + CLOCK_FIELDS.join(" and "),
    d.length === 0, d.length + " differing — " + d.join(" / "));

  const dRef = diffPaths(want, refEngOut, "$", [], 10);
  ok("A8 the reference engine on the same data also gives the reference hash, so the export logic is the kit's whatever the engine",
    refEngOut.hash === REF_IN.hash, "got " + refEngOut.hash + " — " + dRef.join(" / "));
  const dEng = diffPaths(refEngOut.players, refOut.players, "$.players", [], 10);
  ok("A8 the ported engine's player rows equal the reference engine's exactly — a difference here is engine drift, not export drift",
    dEng.length === 0, dEng.join(" / "));

  /* Mutation: the comparator names a changed expected-points entry. */
  const bent = clone(refOut); bent.players[3].ep[2] = Math.round((bent.players[3].ep[2] + 0.02) * 1000) / 1000;
  const dm = diffPaths(want, bent, "$", [], 10);
  ok("A8 mutation: one expected-points entry moved by 0.02 is named by the comparator",
    dm.length === 1 && dm[0].indexOf("$.players[3].ep[2]") === 0, dm.join(" / "));
}

/* ---------------------------------------------------------------- 3. stability: what a re-bake may change */
{
  const again = build(REF);
  ok("A8 stability: two exports of the same data, each with its own engine, give the same hash",
    again.hash === refOut.hash && EXP.buildInput(REF, ENG.create(REF)).hash === refOut.hash, again.hash + " vs " + refOut.hash);

  const c1 = clone(REF); c1.asOf = "2030-01-01T00:00:00.000Z";
  ok("A8 stability: a changed asOf keeps the hash", build(c1).hash === refOut.hash, build(c1).hash);

  const c2 = clone(REF); c2.delta = { since: "2030-01-01T00:00:00.000Z", prices: [{ id: REF.players[0].id, from: 1, to: 2 }], flags: [{ id: REF.players[1].id, st: "d" }] };
  ok("A8 stability: a changed delta block keeps the hash", build(c2).hash === refOut.hash, build(c2).hash);

  const c3 = clone(REF); c3.intel.notes = (c3.intel.notes || []).concat(["A note added after the bake."]).reverse();
  ok("A8 stability: changed intel.notes keep the hash", build(c3).hash === refOut.hash, build(c3).hash);

  const c4 = clone(REF); c4.players.forEach((p, i) => { p.tin = (p.tin || 0) + 1000 + i; p.tout = (p.tout || 0) + 500; p.press = 0.2; p.own = Math.round(((p.own || 0) + 0.3) * 10) / 10; });
  ok("A8 stability: transfer counts, ownership and price pressure moved on every player keep the hash (the fields a fresh pull always shifts)",
    build(c4).hash === refOut.hash, build(c4).hash);
}

/* ---------------------------------------------------------------- 4. sensitivity: what must drop the plan */
{
  const next = REF.gw.next;
  const target = REF.players.find((p) => p.st !== "u");
  const x1 = clone(REF); { const p = x1.players.find((q) => q.id === target.id); p.pr = Math.round((p.pr + 0.1) * 10) / 10; }
  ok("A8 sensitivity: one player's price moved by 0.1 changes the hash (id " + target.id + ")",
    build(x1).hash !== refOut.hash, "unchanged at " + refOut.hash);

  const other = REF.players.find((p) => p.st !== "u" && p.st !== target.st);
  const x2 = clone(REF); { const p = x2.players.find((q) => q.id === target.id); p.st = other.st; }
  ok("A8 sensitivity: one player's status changed (" + target.st + " to " + other.st + ") changes the hash",
    build(x2).hash !== refOut.hash, "unchanged at " + refOut.hash);

  const gwKey = Object.keys(REF.intel.start).map(Number).filter((g) => g >= next).sort((a, b) => a - b)[0];
  const ovKey = gwKey ? Object.keys(REF.intel.start[gwKey])[0] : null;
  const x3 = clone(REF);
  if (ovKey) { const o = x3.intel.start[gwKey][ovKey]; o.p = o.p > 0.5 ? Math.round((o.p - 0.3) * 100) / 100 : Math.round((o.p + 0.3) * 100) / 100; }
  ok("A8 sensitivity: one start override's probability changed (gameweek " + gwKey + ", " + ovKey + ") changes the hash",
    !!ovKey && build(x3).hash !== refOut.hash, ovKey ? "unchanged at " + refOut.hash : "the reference intel has no start override at or after gameweek " + next);

  const fxIdx = REF.fixtures.findIndex((f) => f.gw >= next && !f.fin);
  const x4 = clone(REF); { const f = x4.fixtures[fxIdx]; const h = f.h; f.h = f.a; f.a = h; }
  ok("A8 sensitivity: one fixture's home side swapped (gameweek " + REF.fixtures[fxIdx].gw + ", " + REF.fixtures[fxIdx].h + " v " + REF.fixtures[fxIdx].a + ") changes the hash",
    fxIdx >= 0 && build(x4).hash !== refOut.hash, "unchanged at " + refOut.hash);
}

/* ---------------------------------------------------------------- 5. shape, read from the data never typed */
function shapeChecks(label, DATA, out) {
  const ids = new Set(DATA.players.map((p) => p.id));
  const wantLast = Math.max(DATA.rules.chipStop, DATA.draft.league.redraft.fromGw - 1);
  ok(label + " next is the block's gw.next and gws runs from it to max(cEnd, dEnd) without a gap",
    out.next === DATA.gw.next && Array.isArray(out.gws) && out.gws.length === wantLast - DATA.gw.next + 1 && out.gws.every((g, i) => g === DATA.gw.next + i),
    "next " + out.next + " gws " + JSON.stringify(out.gws));
  ok(label + " cEnd is rules.chipStop and dEnd is redraft.fromGw − 1",
    out.cEnd === DATA.rules.chipStop && out.dEnd === DATA.draft.league.redraft.fromGw - 1,
    "cEnd " + out.cEnd + " dEnd " + out.dEnd + " (chipStop " + DATA.rules.chipStop + ", fromGw " + DATA.draft.league.redraft.fromGw + ")");
  const c = out.classic || {};
  const squadOk = Array.isArray(c.squad) && c.squad.length === 15 && c.squad.every(isId) && c.squad.every((i) => ids.has(i)) && new Set(c.squad).size === 15;   // frozen-ok: a squad is fifteen, a rule of the game
  const sellOk = c.sell && Object.keys(c.sell).sort().join(",") === c.squad.slice().sort().join(",") && Object.values(c.sell).every((v) => typeof v === "number" && v > 0);
  const chipsOk = c.chips && CHIP_NAMES.every((k) => typeof c.chips[k] === "boolean") && Object.keys(c.chips).length === CHIP_NAMES.length;
  ok(label + " classic carries squad (15 known ids), sell (one price per squad id), bank, ft within 1..maxFt, chips (the four, each a boolean), maxFt and clubLimit from rules",
    squadOk && sellOk && typeof c.bank === "number" && c.bank >= 0 && Number.isInteger(c.ft) && c.ft >= 1 && c.ft <= DATA.rules.maxFt && chipsOk && c.maxFt === DATA.rules.maxFt && c.clubLimit === DATA.rules.clubLimit,
    "squad " + (c.squad || []).length + " sell " + Object.keys(c.sell || {}).length + " bank " + c.bank + " ft " + c.ft + " chips " + JSON.stringify(c.chips));
  const d = out.draft || {};
  ok(label + " draft carries me, roster (15 known ids), pool (known ids, none on the roster), ahead (team names) and aheadTakes (known ids)",
    d.me === DATA.draft.me && Array.isArray(d.roster) && d.roster.length === 15 && d.roster.every((i) => ids.has(i)) &&   // frozen-ok: a Draft roster is fifteen, a rule of the game
    Array.isArray(d.pool) && d.pool.length > 0 && d.pool.every((i) => ids.has(i) && !d.roster.includes(i)) &&
    Array.isArray(d.ahead) && d.ahead.every((t) => typeof t === "string") && Array.isArray(d.aheadTakes) && d.aheadTakes.every((i) => ids.has(i)),
    "me " + d.me + " roster " + (d.roster || []).length + " pool " + (d.pool || []).length + " ahead " + (d.ahead || []).length + " aheadTakes " + (d.aheadTakes || []).length);
  const wantPlayers = DATA.players.filter((p) => p.st !== "u").length;
  const badEp = (out.players || []).filter((p) => !Array.isArray(p.ep) || p.ep.length !== out.gws.length || p.ep.some((x) => typeof x !== "number" || !isFinite(x)));
  ok(label + " players are every player not marked unavailable (" + wantPlayers + "), each with one expected-points entry per gameweek in gws and a start probability in [0, 1]",
    Array.isArray(out.players) && out.players.length === wantPlayers && badEp.length === 0 && out.players.every((p) => ids.has(p.id) && p.st !== "u" && p.start >= 0 && p.start <= 1),
    (out.players || []).length + " players, " + badEp.length + " with a wrong ep row" + (badEp.length ? " e.g. id " + badEp[0].id + " length " + (badEp[0].ep || []).length : ""));
}
shapeChecks("A8 shape (reference):", REF, refOut);

/* ---------------------------------------------------------------- 6. the committed block and the shipped input */
{
  const BLOCK = readJson(BLOCK_PATH);
  ok("the committed block data/mc_data.json exists and parses", !!BLOCK && Array.isArray(BLOCK.players), "missing or unparseable");
  if (BLOCK) {
    const nowOut = build(BLOCK);
    shapeChecks("A8 shape (committed block):", BLOCK, nowOut);
    const SHIPPED = readJson(SHIPPED_PATH);
    ok("the shipped solver input data/solver_in.json exists and parses (npm run export writes it)",
      !!SHIPPED && typeof SHIPPED.hash === "string", "missing or unparseable");
    if (SHIPPED) {
      const d = diffPaths(withoutClock(SHIPPED), nowOut, "$", [], 10);
      ok("A8 shipped: data/solver_in.json carries the hash buildInput gives on the committed block today (" + nowOut.hash + "), so the input that ships is the input for the block that ships",
        SHIPPED.hash === nowOut.hash && d.length === 0, "shipped " + SHIPPED.hash + " vs " + nowOut.hash + " — " + d.join(" / ") + " — run npm run export");
      ok("A8 shipped: its dataAsOf is the committed block's asOf and its at is an ISO instant",
        SHIPPED.dataAsOf === BLOCK.asOf && /^\d{4}-\d{2}-\d{2}T/.test(SHIPPED.at || ""), "dataAsOf " + SHIPPED.dataAsOf + " block " + BLOCK.asOf + " at " + SHIPPED.at);
      const payload = withoutClock(SHIPPED); delete payload.hash;
      ok("A8 shipped: its hash recomputes from its own payload", sha16(payload) === SHIPPED.hash, sha16(payload) + " vs " + SHIPPED.hash);
    }
  }
}

console.log("SUITE export_hash " + pass + "/" + (pass + fail));
process.exit(fail ? 1 : 0);

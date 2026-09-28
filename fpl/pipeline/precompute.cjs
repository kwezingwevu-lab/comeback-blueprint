#!/usr/bin/env node
/*
 * pipeline/precompute.cjs — data/pre.json: the heavy searches, run once when the app is built (v110 D0).
 *
 *   node pipeline/precompute.cjs [--dry-run]            (build.cjs calls it before assembling)
 *
 * WHY IT EXISTS
 *   The v111 kit ran its expensive searches in build.js so the page opens on a phone without waiting for them
 *   (/home/claude/app/build.js lines 9-33). The repo ships the same engine (src/mc_engine.js) and the same analysis
 *   layer (src/mc_analysis.js), so the same searches run here, once per build, and the app reads their results
 *   from the PRECOMPUTED block (CONTRACT §2) as `PRE`. Every search can still be re-run in the page on `props.mc.E`.
 *
 * WHAT IT WRITES — { at, hash, claims, trades, transfers, classicSim, h2h, review, draftMoves, changes }
 *   hash        the export hash of data/mc_data.json (pipeline/export.js buildInput): the data this was computed on.
 *   claims      buildClaimSheet(M, MC, PLAN.draft.pairs, { mc: true, fitOnly: true }) — the Draft claims sheet in
 *               lodging order with the Monte Carlo orderings; no flagged player lodged, the held pairs in .held.
 *               pipeline/weekly.cjs makes exactly this call, so data/weekly.js lodges this sheet line for line, and
 *               this script refuses to write when the two disagree on the same hash.
 *   trades      tradeGroups(findTrades(M, MC)) — like-for-like swaps with every rival, "both gain" apart from "ask".
 *   transfers   greedyTransfers(M, MC) — the kit's greedy Classic transfer search, moves named out -> in.
 *   classicSim  classicGameweekSim(M, MC) — the Classic gameweek in focus, simulated (fixed draws and seed).
 *   h2h         headToHead(M, MC) — the Draft head-to-head in focus, simulated (fixed draws and seed).
 *   review      reviewSummary(M, MC, { weeks: 5 }) — each game's last five finished gameweeks, on its own.
 *   draftMoves  the top distinct Draft moves over the waiver pool, the managers who claim ahead of this one with the
 *               moves they are modelled to take, and the distinct moves left if they take them (build.js 25-33).
 *   changes     data/changes.json — what this build changed, in SA English, with no figure a reader cannot check.
 *   Every result carries its game where it has one; nothing here adds a Classic figure to a Draft figure (§1.1).
 *
 * DETERMINISTIC. Every simulation runs on the analysis layer's fixed seeds, and the only clock is `at`, which sits
 * outside what verify.sh compares. `at` changes only when the payload does: a re-run on identical inputs rewrites
 * nothing, so `node build.cjs` still reproduces the tree byte for byte.
 *
 * REFUSES (exit 3, nothing written) when data/plan.json's hash is not the export hash of data/mc_data.json: a
 * precompute on a plan solved for other data is a lie (E-101: content, never clocks). Refuses (exit 4) when the
 * WEEKLY block carries the same hash and lodges a different claims sheet — two sheets for one plan is a defect.
 * A WEEKLY block written from an older plan is reported, not refused: qa/verify.sh I23 holds the four hashes equal.
 */
"use strict";

const fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "pre.json");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

/* The kit's own method parameters (build.js lines 25, 31 and 33), named rather than typed inline. None is a fact
   about the season: the number of distinct moves listed, how different two moves must be to count as distinct,
   and how many moves each manager claiming ahead is modelled to take. */
const TOP_MOVES = 5, DISTINCT_MIN = 0.5, AHEAD_TAKES = 3;
const REVIEW_WEEKS = 5;

class Refusal extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

function compute() {
  const MC = readJson("data/mc_data.json"), PLAN = readJson("data/plan.json");
  const CHANGES = fs.existsSync(path.join(ROOT, "data", "changes.json")) ? readJson("data/changes.json") : [];
  if (!Array.isArray(CHANGES) || !CHANGES.every((c) => typeof c === "string" && c.trim())) throw new Refusal("data/changes.json must be an array of non-empty strings", 3);
  const MCE = require(path.join(ROOT, "src", "mc_engine.js"));
  const AN = require(path.join(ROOT, "src", "mc_analysis.js"));
  const { buildInput } = require(path.join(ROOT, "pipeline", "export.js"));
  const M = MCE.create(MC);

  const hash = buildInput(MC, M).hash;
  if (PLAN.hash !== hash) {
    throw new Refusal("data/plan.json was solved on " + PLAN.hash + " but data/mc_data.json exports " + hash +
      " — a precompute on a plan solved for other data is a lie; re-run the solve and pipeline/plan.cjs first", 3);
  }
  if (!PLAN.draft || !PLAN.draft.ok || !Array.isArray(PLAN.draft.pairs)) throw new Refusal("data/plan.json carries no solved Draft roster", 3);

  const H = AN.mcHorizon(M, MC);
  const claims = AN.buildClaimSheet(M, MC, PLAN.draft.pairs, { mc: true, fitOnly: true });
  const trades = AN.tradeGroups(AN.findTrades(M, MC));
  const transfers = AN.greedyTransfers(M, MC);
  const classicSim = AN.classicGameweekSim(M, MC);
  const h2h = AN.headToHead(M, MC);
  const review = AN.reviewSummary(M, MC, { weeks: REVIEW_WEEKS });

  const roster = M.draftRoster(), all = M.draftMoves(roster, H.next, H.dEnd);
  const pack = (a) => a.map((m) => ({ add: m.add.id, drop: m.drop.id, how: m.how || M.howToGet(m.add), gain: m.gain, gainNext: m.gainNext }));
  const ct = M.contested(H.next, H.dEnd, AHEAD_TAKES);
  const taken = new Set([].concat.apply([], Object.values(ct.picks).map((v) => v.map((m) => m.add))));
  const backups = taken.size
    ? pack(M.bestDistinctMoves(M.draftMoves(roster, H.next, H.dEnd, { pool: M.waiverPool().filter((p) => !taken.has(p.id)) }), TOP_MOVES, DISTINCT_MIN))
    : [];
  const draftMoves = { game: "draft", gw: H.next, horizonEnd: H.dEnd, top: pack(M.bestDistinctMoves(all, TOP_MOVES, DISTINCT_MIN)),
    ahead: ct.ahead, contested: ct.picks, backups: backups };

  const payload = { hash, claims, trades, transfers, classicSim, h2h, review, draftMoves, changes: CHANGES };

  /* The WEEKLY block lodges the same sheet: same call, same plan. Compared by Draft code, as the block writes it. */
  let weeklyNote = "";
  try {
    const W = (new Function(fs.readFileSync(path.join(ROOT, "data", "weekly.js"), "utf8") + "\n;return WEEKLY;"))();
    if (W.hash === hash) {
      const LIVE = readJson("data/live.json"), codeOf = {};
      (LIVE.elements || []).forEach((e) => { codeOf[e.id] = Number(e.code); });
      const mine = claims.sheet.map((q) => codeOf[q.drop] + ">" + codeOf[q.add]).join(",");
      const theirs = ((W.draft && W.draft.claims) || []).map((c) => Number(c.out) + ">" + Number(c.in)).join(",");
      if (mine !== theirs) throw new Refusal("the claims sheet (" + claims.sheet.length + " lines) is not the one data/weekly.js lodges on the same hash " + hash + " — re-run pipeline/weekly.cjs", 4);
      weeklyNote = "claims equal data/weekly.js line for line (" + claims.sheet.length + ")";
    } else {
      weeklyNote = "data/weekly.js carries hash " + W.hash + ", not " + hash + " — re-run pipeline/weekly.cjs (qa/verify.sh I23 is red until then)";
    }
  } catch (e) {
    if (e instanceof Refusal) throw e;
    weeklyNote = "data/weekly.js could not be read back: " + e.message;
  }
  return { payload, weeklyNote };
}

/* Writes only when the payload changed, so `at` moves with the content and never with the clock. */
function precompute(opts) {
  opts = opts || {};
  const t0 = Date.now();
  const r = compute();
  const ms = Date.now() - t0;
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { prev = null; }
  const same = !!prev && (function () { const p = Object.assign({}, prev); delete p.at; return JSON.stringify(p) === JSON.stringify(r.payload); })();
  const out = Object.assign({ at: same ? prev.at : new Date().toISOString() }, r.payload);
  const wrote = !same && !opts.dry;
  if (wrote) fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  return { out, ms, wrote, same, weeklyNote: r.weeklyNote };
}

function summary(res) {
  const p = res.out, c = p.claims;
  return "data/pre.json · hash " + p.hash + " · " + (res.wrote ? "written" : res.same ? "unchanged, at " + p.at + " kept" : "dry run, not written") +
    " · " + res.ms + " ms · Draft claims " + c.sheet.length + " (" + c.strategy + ", held " + c.held.length + ") · Draft trades " +
    p.trades.both.length + " both-gain / " + p.trades.ask.length + " ask · Classic transfers " + (p.transfers ? p.transfers.moves.length : 0) +
    " · Classic sim GW" + (p.classicSim ? p.classicSim.gw : "-") + " · Draft h2h GW" + (p.h2h ? p.h2h.gw : "-") +
    " · Draft moves " + p.draftMoves.top.length + " · changes " + p.changes.length + " · " + res.weeklyNote;
}

module.exports = { precompute, summary, Refusal, TOP_MOVES, DISTINCT_MIN, AHEAD_TAKES, REVIEW_WEEKS };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const bad = argv.filter((a) => a !== "--dry-run");
  if (bad.length) { console.log("precompute.cjs refused: unknown argument " + bad[0] + " (expected --dry-run)"); process.exit(2); }
  try {
    console.log(summary(precompute({ dry: argv.indexOf("--dry-run") >= 0 })));
  } catch (e) {
    console.log("precompute.cjs refused: " + (e && e.message ? e.message : String(e)));
    process.exit(e instanceof Refusal ? e.code : 1);
  }
}

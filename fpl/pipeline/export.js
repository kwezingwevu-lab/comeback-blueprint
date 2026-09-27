/* pipeline/export.js — the solver input and its content hash (v110 §5 A8, §7.7).

   node pipeline/export.js [--data <file>] [--out <file>]        (npm run export)

   --data   the baked block to export from (default data/mc_data.json)
   --out    the solver input to write (default data/solver_in.json); nothing else is written

   WHAT IT WRITES
     Every player's expected points per gameweek from the engine the app uses (src/mc_engine.js), from the
     next gameweek to the later of the Classic chip stop and the Draft horizon, plus the Classic state
     (squad, selling prices, bank, free transfers, chips still in hand, the rules) and the Draft state
     (my roster, the waiver pool, who claims ahead of me and what they are modelled to take). solve.py
     reads it; nothing in it adds a Classic number to a Draft number.

   THE HASH, AND WHAT IT COVERS
     `hash` is the first 16 hex characters of the sha1 of the JSON of the payload — {next, gws, cEnd, dEnd,
     classic, draft, players} in that order — computed exactly as the v111 kit computes it, so a plan solved
     on the kit's input and a plan solved on this one are comparable by hash alone. The two clock fields the
     command line writes beside it, `at` (when the export ran) and `dataAsOf` (when the block was baked), sit
     OUTSIDE the hash: they say when, never what.
       · A re-bake that changes no input keeps the hash. asOf, the delta block, the intel notes and sources,
         league ranks, transfer counts, ownership and price pressure all move on every pull and none of them
         enters the payload or the expected points, so the solved plan stays valid.
       · A price, a flag or status, a projection (a fixture, a team rating, a start override, a calibration
         block, an injury return date) or a squad change moves the expected points or the state, and drops
         the hash — and with it the plan, until the solve is run again on the new input.
     build.js reuses buildInput() at build time to compute the hash of the data it ships and keeps a solved
     plan only when its hash matches. That is the rule of ERRORS.md E-101: the guard is content, not a clock.

   PROVENANCE
     Ported from the v111 kit (/home/claude/app/export.js) on 2026-09-27. The one edit beyond the plumbing:
     the kit filtered chips used with a literal 19; here the same window is `cEnd`, which the engine reads
     from rules.chipStop and which equals 19 on every block this season. qa/export_hash.cjs proves the export
     reproduces reference/v109/app/solver_in.json path for path with the same hash, that the hash is stable
     under a harmless re-bake and moves under a changed input, and that the shipped data/solver_in.json is
     the export of the committed block. */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DEFAULTS = {
  data: path.join(ROOT, "data", "mc_data.json"),
  out: path.join(ROOT, "data", "solver_in.json")
};

function buildInput(DATA, M) {
  const next = DATA.gw.next, cEnd = M.CFG.classicEnd, dEnd = M.CFG.draftEnd, last = Math.max(cEnd, dEnd);
  const gws = []; for (let g = next; g <= last; g++) gws.push(g);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const players = DATA.players.filter((p) => p.st !== "u").map((p) => ({ id: p.id, n: p.n, t: p.t, p: p.p, pr: p.pr, st: p.st, did: p.did || null, do: p.do || null, ep: gws.map((g) => r3(M.ep(p, g))), start: r3(M.rateOf(p).pStart) }));
  const cs = M.classicSquad(), used = (DATA.classic.chipsUsed || []).filter((c) => c.gw <= cEnd).map((c) => c.name), ct = M.contested(next, dEnd, 3);
  const out = { next, gws, cEnd, dEnd,
    classic: { squad: cs.squad.map((p) => p.id), sell: Object.fromEntries(cs.squad.map((p) => [p.id, p.sell])), bank: cs.bank, ft: cs.ft, maxFt: DATA.rules.maxFt, clubLimit: DATA.rules.clubLimit,
      chips: { wildcard: !used.includes("wildcard"), bboost: !used.includes("bboost"), "3xc": !used.includes("3xc"), freehit: !used.includes("freehit") } },
    draft: { me: DATA.draft.me, roster: M.draftRoster().map((p) => p.id), pool: M.waiverPool().map((p) => p.id), ahead: ct.ahead, aheadTakes: [].concat.apply([], Object.values(ct.picks).map((v) => v.map((m) => m.add))) },
    players };
  out.hash = crypto.createHash("sha1").update(JSON.stringify(out)).digest("hex").slice(0, 16);   // the same data always gives the same hash, whenever it was baked
  return out;
}

function parseArgs(argv) {
  const o = Object.assign({}, DEFAULTS);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === "--data") { o.data = path.resolve(v); i++; }
    else if (a === "--out") { o.out = path.resolve(v); i++; }
    else throw new Error("unknown argument " + a + " (expected --data <file> or --out <file>)");
  }
  return o;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const DATA = JSON.parse(fs.readFileSync(opts.data, "utf8")), M = require(path.join(ROOT, "src", "mc_engine.js")).create(DATA);
  const out = Object.assign({ at: new Date().toISOString(), dataAsOf: DATA.asOf }, buildInput(DATA, M));
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(out));
  console.log(`${path.relative(process.cwd(), opts.out)} · hash ${out.hash} · ${out.players.length} players · gameweeks ${out.gws[0]}–${out.gws[out.gws.length - 1]} · cEnd ${out.cEnd} · dEnd ${out.dEnd} · bank ${out.classic.bank} · FT ${out.classic.ft} · draft pool ${out.draft.pool.length} · ahead ${out.draft.ahead.join(", ")} · data as of ${out.dataAsOf}`);
}

module.exports = { buildInput };
if (require.main === module) main();

/* export.js — writes solver_in.json for solve.py: every player's expected points per gameweek from the engine the app uses,
   plus the Classic and Draft state. Also exported as a function so build.js can prove a solver result matches the data it ships. */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
function buildInput(DATA, M) {
  const next = DATA.gw.next, cEnd = M.CFG.classicEnd, dEnd = M.CFG.draftEnd, last = Math.max(cEnd, dEnd);
  const gws = []; for (let g = next; g <= last; g++) gws.push(g);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const players = DATA.players.filter((p) => p.st !== "u").map((p) => ({ id: p.id, n: p.n, t: p.t, p: p.p, pr: p.pr, st: p.st, did: p.did || null, do: p.do || null, ep: gws.map((g) => r3(M.ep(p, g))), start: r3(M.rateOf(p).pStart) }));
  const cs = M.classicSquad(), used = (DATA.classic.chipsUsed || []).filter((c) => c.gw <= 19).map((c) => c.name), ct = M.contested(next, dEnd, 3);
  const out = { next, gws, cEnd, dEnd,
    classic: { squad: cs.squad.map((p) => p.id), sell: Object.fromEntries(cs.squad.map((p) => [p.id, p.sell])), bank: cs.bank, ft: cs.ft, maxFt: DATA.rules.maxFt, clubLimit: DATA.rules.clubLimit,
      chips: { wildcard: !used.includes("wildcard"), bboost: !used.includes("bboost"), "3xc": !used.includes("3xc"), freehit: !used.includes("freehit") } },
    draft: { me: DATA.draft.me, roster: M.draftRoster().map((p) => p.id), pool: M.waiverPool().map((p) => p.id), ahead: ct.ahead, aheadTakes: [].concat.apply([], Object.values(ct.picks).map((v) => v.map((m) => m.add))) },
    players };
  out.hash = crypto.createHash("sha1").update(JSON.stringify(out)).digest("hex").slice(0, 16);   // the same data always gives the same hash, whenever it was baked
  return out;
}
module.exports = { buildInput };
if (require.main === module) {
  const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8")), M = require("./engine.js").create(DATA);
  const out = Object.assign({ at: new Date().toISOString(), dataAsOf: DATA.asOf }, buildInput(DATA, M));
  fs.writeFileSync(path.join(__dirname, "solver_in.json"), JSON.stringify(out));
  console.log(`solver_in.json · hash ${out.hash} · ${out.players.length} players · gameweeks ${out.gws[0]}–${out.gws[out.gws.length - 1]} · bank ${out.classic.bank} · FT ${out.classic.ft} · draft pool ${out.draft.pool.length} · ahead ${out.draft.ahead.join(", ")}`);
}

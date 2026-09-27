/* pipeline/calibrate.js — ported from the v111 kit on 2026-09-27. Runs the walk-forward backtest on the baked block
   and writes DATA.model = { calib, backtest, at } into it, so the engine applies the position corrections.
   Run after pipeline/bake.js and before pipeline/export.js:  node pipeline/calibrate.js [data/mc_data.json]
   The engine reads DATA.model.calib; the backtest itself always runs uncalibrated (opts.noCalib), so the
   corrections are fitted on unadjusted forecasts and never feed back into their own evidence. */
const fs = require("fs"), path = require("path"), E = require("../src/mc_engine.js"), B = require("./backtest.js");
const f = process.argv[2] || path.join(__dirname, "..", "data", "mc_data.json"), DATA = JSON.parse(fs.readFileSync(f, "utf8")); delete DATA.model;
const ks = DATA.gw.withData.filter((g) => g >= 3 && g <= DATA.gw.lastDone), t0 = Date.now(), r = B.run(DATA, E, ks);
DATA.model = { calib: r.calib, backtest: r, at: new Date().toISOString() };
fs.writeFileSync(f, JSON.stringify(DATA));
const P = r.points.byPos, pct = (x) => (x * 100).toFixed(0) + "%";
console.log(`backtest GW${ks.join(",")} in ${((Date.now() - t0) / 1000).toFixed(1)}s · points given a start: ρ ${r.points.all.rho.toFixed(3)} v naive ${r.points.all.rhoNaive.toFixed(3)} (n ${r.points.all.n}) · minutes Brier ${r.minutes.brier.toFixed(3)} v naive ${r.minutes.brierNaive.toFixed(3)} (n ${r.minutes.n}) · team goals log-lik ${r.goals.logLik.toFixed(1)} v naive ${r.goals.logLikNaive.toFixed(1)} (n ${r.goals.n})`);
Object.keys(P).forEach((k) => console.log(`  pos ${k}: n ${P[k].n} pred ${P[k].meanPred.toFixed(2)} act ${P[k].meanAct.toFixed(2)} ratio ${P[k].ratio.toFixed(3)} [${P[k].lo.toFixed(3)}, ${P[k].hi.toFixed(3)}] ρ ${P[k].rho.toFixed(3)} v ${P[k].rhoNaive.toFixed(3)} MAE ${P[k].mae.toFixed(2)} v ${P[k].maeNaive.toFixed(2)} → factor ${r.calib[k]}`));
console.log("  minutes buckets:", r.minutes.buckets.map((b) => `${b.lo}-${b.hi}: ${b.n} pred ${b.pred == null ? "-" : pct(b.pred)} act ${b.act == null ? "-" : pct(b.act)}`).join(" | "));

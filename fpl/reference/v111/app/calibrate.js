/* calibrate.js — runs the walk-forward backtest on the baked data and writes DATA.model = { calib, backtest }.
   Run after bake.js and before export.js. The engine applies the factors; the backtest itself always runs uncalibrated. */
const fs = require("fs"), path = require("path"), E = require("./engine.js"), B = require("./backtest.js");
const f = path.join(__dirname, "data.json"), DATA = JSON.parse(fs.readFileSync(f, "utf8")); delete DATA.model;
const ks = DATA.gw.withData.filter((g) => g >= 3 && g <= DATA.gw.lastDone), t0 = Date.now(), r = B.run(DATA, E, ks);
DATA.model = { calib: r.calib, backtest: r, at: new Date().toISOString() };
fs.writeFileSync(f, JSON.stringify(DATA));
const P = r.points.byPos, pct = (x) => (x * 100).toFixed(0) + "%";
console.log(`backtest GW${ks.join(",")} in ${((Date.now() - t0) / 1000).toFixed(1)}s · points given a start: ρ ${r.points.all.rho.toFixed(3)} v naive ${r.points.all.rhoNaive.toFixed(3)} (n ${r.points.all.n}) · minutes Brier ${r.minutes.brier.toFixed(3)} v naive ${r.minutes.brierNaive.toFixed(3)} (n ${r.minutes.n}) · team goals log-lik ${r.goals.logLik.toFixed(1)} v naive ${r.goals.logLikNaive.toFixed(1)} (n ${r.goals.n})`);
Object.keys(P).forEach((k) => console.log(`  pos ${k}: n ${P[k].n} pred ${P[k].meanPred.toFixed(2)} act ${P[k].meanAct.toFixed(2)} ratio ${P[k].ratio.toFixed(3)} [${P[k].lo.toFixed(3)}, ${P[k].hi.toFixed(3)}] ρ ${P[k].rho.toFixed(3)} v ${P[k].rhoNaive.toFixed(3)} MAE ${P[k].mae.toFixed(2)} v ${P[k].maeNaive.toFixed(2)} → factor ${r.calib[k]}`));
console.log("  minutes buckets:", r.minutes.buckets.map((b) => `${b.lo}-${b.hi}: ${b.n} pred ${b.pred == null ? "-" : pct(b.pred)} act ${b.act == null ? "-" : pct(b.act)}`).join(" | "));

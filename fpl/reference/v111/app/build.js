/* build.js — node build.js  →  /mnt/user-data/outputs/fpl-mission-control.html
   Heavy searches run here once so the page opens instantly on a phone; every one of them can be re-run in the page. */
const fs = require("fs"), path = require("path");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const E = require("./engine.js"), U = require("./ui.js");
const t0 = Date.now(), M = E.create(DATA), G = DATA.gw, next = G.next, inPlay = G.live > G.lastDone ? G.live : null, focus = inPlay || next, cEnd = M.CFG.classicEnd, dEnd = M.CFG.draftEnd;
const PRE = { builtAt: new Date().toISOString() };

/* Classic */
const cs = M.classicSquad();
if (cs) {
  const last = DATA.classic.gws[DATA.classic.gws.length - 1], pk = last.picks.map((k) => Object.assign({ pl: M.P[k.id] }, k)).filter((k) => k.pl);
  let side; if (last.gw === focus) { const b = pk.filter((k) => k.pos > 11).sort((a, c) => a.pos - c.pos).map((k) => k.pl); side = { xi: pk.filter((k) => k.pos <= 11).map((k) => k.pl), bench: b.filter((p) => p.p !== 1), benchGk: b.find((p) => p.p === 1) || null, captain: (pk.find((k) => k.c) || {}).pl, vice: (pk.find((k) => k.v) || {}).pl, tc: last.chip === "3xc" }; }
  else { const b = M.bestXI(cs.squad, focus); side = { xi: b.xi, bench: b.bench, benchGk: b.benchGk, captain: b.cap, vice: b.vice }; }
  PRE.classicSim = Object.assign({ gw: focus, saved: last.gw === focus }, M.summarise(M.simulate(focus, [side], 20000, 11)[0]));
  const tr = M.classicTransfers(cs, next, cEnd, Math.min(cs.ft, 5));
  PRE.transfers = { moves: tr.moves.map((m) => ({ out: m.out.id, inn: m.inn.id, gain: m.gain, gainNext: m.gainNext, bankAfter: m.bankAfter })), value: tr.value, baseValue: M.squadValue(cs.squad, next, cEnd, true) };
  const budget = cs.squad.reduce((s, p) => s + p.sell, 0) + cs.bank, w = M.wildcard(budget, next, cEnd, { perPos: 40 });
  if (w) PRE.wildcard = { squad: w.squad.map((p) => p.id), cost: w.cost, budget: w.budget, value: w.value };
}
/* Draft */
const ui0 = U.makeUI(M, DATA, {}, null);
const roster = M.draftRoster(), all = M.draftMoves(roster, next, dEnd);
const pack = (a) => a.map((m) => ({ add: m.add.id, drop: m.drop.id, how: m.how || M.howToGet(m.add), gain: m.gain, gainNext: m.gainNext }));
PRE.draftMoves = { top: pack(M.bestDistinctMoves(all, 5, 0.5)), all: pack(all.slice(0, 40)) };
const m = DATA.draft.matches.find((x) => x.gw === focus && (x.a === DATA.draft.me || x.b === DATA.draft.me));
if (m) { const on = m.a === DATA.draft.me ? m.b : m.a, mineNow = focus === inPlay ? (DATA.draft.rivalsNow[DATA.draft.me] || ((DATA.draft.myGws.find((g) => g.gw === focus) || {}).picks)) : null, theirNow = focus === inPlay ? DATA.draft.rivalsNow[on] : null;
  const me = M.sideFromRoster(roster, focus, mineNow), them = M.sideFromRoster(M.draftRoster(on), focus, theirNow);
  if (me && them) PRE.h2h = Object.assign({ gw: focus, opp: on, mySaved: me.saved, theirSaved: them.saved }, M.h2h(focus, me, them, 30000, 5)); }
PRE.race = M.titleRace(next, dEnd, 20000, 3);
const ct = M.contested(next, dEnd, 3); PRE.contest = { ahead: ct.ahead, picks: ct.picks };
const taken = new Set([].concat.apply([], Object.values(ct.picks).map((v) => v.map((m) => m.add))));
PRE.backups = taken.size ? pack(M.bestDistinctMoves(M.draftMoves(roster, next, dEnd, { pool: M.waiverPool().filter((p) => !taken.has(p.id)) }), 5, 0.5)) : [];
PRE.trades = ui0.findTrades();
PRE.changes = JSON.parse(fs.existsSync(path.join(__dirname, "changes.json")) ? fs.readFileSync(path.join(__dirname, "changes.json"), "utf8") : "[]");
/* the solved plan (solve.py), used only if it was solved on exactly this data */
const SOI = path.join(__dirname, "solver_in.json"), SOO = path.join(__dirname, "solver_out.json");
if (fs.existsSync(SOI) && fs.existsSync(SOO)) {
  const si = JSON.parse(fs.readFileSync(SOI, "utf8")), so = JSON.parse(fs.readFileSync(SOO, "utf8"));
  const slim = (pl) => pl && pl.ok ? { ok: true, total: pl.total, obj: pl.obj, secs: pl.secs, gap: pl.gap, detail: pl.detail, params: pl.params,
    weeks: pl.weeks.map((w) => ({ gw: w.gw, chip: w.chip, xi: w.xi, bench: w.bench, gk2: w.gk2, cap: w.cap, vice: w.vice, in: w.in, out: w.out, ftBefore: w.ftBefore, used: w.used, hits: w.hits, bank: w.bank, ep: w.ep, epNet: w.epNet, held: !!w.held, squad: w.squad })) } : null;
  const nowHash = require("./export.js").buildInput(DATA, M).hash;                       // content hash: a re-bake of identical data keeps the plan valid
  if ((so.hash && so.hash === nowHash) && so.plan && so.plan.ok) PRE.solver = { at: so.at, complete: !!so.done, plan: slim(so.plan), noWildcard: slim(so.noWildcard), undecayed: slim(so.undecayed),
    freeHit: (so.freeHit || []).map((f) => ({ gw: f.gw, gain: f.gain, free: f.free, budget: f.budget, cap: f.cap, xi: f.xi, squad: f.squad })), draft: so.draft || null, draftIfTaken: so.draftIfTaken || null, draftAhead: (si.draft.ahead || []).join(", ") };
  else console.log("solver output ignored: solved on different data (hash " + so.hash + " vs " + nowHash + ")");
  const SOL = path.join(__dirname, "solver_long.json");
  if (PRE.solver && fs.existsSync(SOL)) { const sl = JSON.parse(fs.readFileSync(SOL, "utf8")); if (sl.hash === nowHash && sl.plan && sl.plan.ok && (sl.plan.obj || 0) > (PRE.solver.plan.obj || 0)) { PRE.solver.plan = slim(sl.plan); console.log("plan: using the long solve (objective " + sl.plan.obj + ", gap " + sl.plan.gap + ")"); } }
  const SOT = path.join(__dirname, "solver_timing.json");
  if (PRE.solver && fs.existsSync(SOT)) { const st = JSON.parse(fs.readFileSync(SOT, "utf8")); if (st.hash === nowHash && st.now && st.later && st.never) {
      /* the main plan and "wildcard now" are the same problem solved twice: keep whichever reached the better objective, and its proven gap */
      if ((st.now.obj || 0) > (PRE.solver.plan.obj || 0)) { PRE.solver.plan = Object.assign(slim(st.now), { detail: so.plan.detail }); console.log("plan: using the wildcard-now solve (objective " + st.now.obj + ")"); }
      PRE.solver.timing = { now: PRE.solver.plan, later: slim(st.later), never: slim(st.never), at: st.at }; } else console.log("timing comparison ignored: " + (st.hash === nowHash ? "incomplete" : "stale")); }
}
if (PRE.solver && PRE.solver.draft && PRE.solver.draft.ok) { const u0 = U.makeUI(M, DATA, PRE, null); PRE.claims = u0.buildClaimSheet(PRE.solver.draft.pairs); }
/* free-hit weeks are re-labelled against whichever plan was finally kept: a week is free only if that plan plays no chip in it */
if (PRE.solver && PRE.solver.freeHit) { const pl = PRE.solver.plan, chipWeeks = new Set(pl.weeks.filter((w) => w.chip).map((w) => w.gw)), own0 = new Set(M.classicSquad().squad.map((p) => p.id));
  const sellOf = (i) => own0.has(i) && (DATA.classic.sell || {})[i] ? DATA.classic.sell[i].sell : M.P[i].pr;
  PRE.solver.freeHit = PRE.solver.freeHit.map((f) => { const w = pl.weeks.find((x) => x.gw === f.gw); if (!w || !f.squad) return null;
    const budget = Math.round((w.squad.reduce((a, i) => a + sellOf(i), 0) + w.bank) * 10) / 10, cost = Math.round(f.squad.reduce((a, i) => a + M.P[i].pr, 0) * 10) / 10;
    const fhEp = f.xi.reduce((a, i) => a + M.ep(M.P[i], f.gw), 0) + M.ep(M.P[f.cap], f.gw), base = w.xi.reduce((a, i) => a + M.ep(M.P[i], f.gw), 0) + M.ep(M.P[w.cap], f.gw);
    return Object.assign({}, f, { free: !chipWeeks.has(f.gw), budget, cost, affordable: cost <= budget + 1e-9, gain: Math.round((fhEp - base) * 100) / 100 }); }).filter(Boolean).filter((f) => f.affordable); }
const ui1 = U.makeUI(M, DATA, PRE, null); PRE.tests = ui1.selfTest();

const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8"), eng = fs.readFileSync(path.join(__dirname, "engine.js"), "utf8"), uis = fs.readFileSync(path.join(__dirname, "ui.js"), "utf8");
const safe = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "");
const html = `<!doctype html>
<html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>FPL Mission Control</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600&family=Barlow+Condensed:wght@600;700&display=swap" rel="stylesheet">
<style>${css}</style></head>
<body><div id="app"><div class="wrap"><p style="padding:24px 0">Loading Mission Control…</p></div></div>
<noscript><p style="padding:24px">Mission Control needs JavaScript switched on.</p></noscript>
<script>${eng}</script>
<script>${uis}</script>
<script>window.__DATA=${safe(DATA)};window.__PRE=${safe(PRE)};</script>
<script>(function(){try{var M=MCEngine.create(window.__DATA);window.__ui=MCUI.boot(M,window.__DATA,window.__PRE);}catch(e){document.getElementById("app").innerHTML='<div class="wrap"><h1>Mission Control could not start</h1><p>'+String(e&&e.message||e).replace(/</g,"&lt;")+'</p><p>Ask for a rebuild in chat and quote this message.</p></div>';}})();</script>
</body></html>`;
const out = process.argv[2] || "/mnt/user-data/outputs/fpl-mission-control.html";
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
fs.writeFileSync(path.join(__dirname, "pre.json"), JSON.stringify(PRE));
console.log(`built ${out} · ${(html.length / 1024).toFixed(0)} kB · ${((Date.now() - t0) / 1000).toFixed(1)}s · self-test ${PRE.tests.pass}/${PRE.tests.total}${PRE.tests.fails.length ? " · FAILS: " + PRE.tests.fails.join("; ") : ""} · solved plan ${PRE.solver ? "in (" + (PRE.solver.complete ? "complete" : "partial") + ")" : "absent"}`);

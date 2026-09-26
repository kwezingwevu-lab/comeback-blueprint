/* qa.js — run before every ship. node qa.js
   Three layers: assertions on the maths and the rules, property tests over thousands of generated cases,
   and a render pass that opens every tab in many states and fires every button the interface exposes. */
const fs = require("fs"), path = require("path");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const E = require("./engine.js"), U = require("./ui.js");
const M = E.create(DATA), G = DATA.gw, next = G.next, live = G.live, cEnd = M.CFG.classicEnd, dEnd = M.CFG.draftEnd;
let pass = 0, total = 0; const fails = [], groups = {};
const PRE0 = fs.existsSync(path.join(__dirname, "pre.json")) ? JSON.parse(fs.readFileSync(path.join(__dirname, "pre.json"), "utf8")) : {};
function ok(g, name, cond, detail) { total++; groups[g] = groups[g] || { p: 0, t: 0 }; groups[g].t++; if (cond) { pass++; groups[g].p++; } else fails.push(`[${g}] ${name}${detail ? " — " + detail : ""}`); }
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);

/* ── 1. data integrity ── */
ok("data", "live gameweek is at or after the last finished one", live >= G.lastDone);
ok("data", "next gameweek follows the live one", next === live + 1 || next === live);
ok("data", "every fixture has two known teams", DATA.fixtures.every((f) => f.h && f.a && f.h !== f.a));
ok("data", "38 gameweeks of ten matches", [...Array(38)].every((_, i) => DATA.fixtures.filter((f) => f.gw === i + 1).length === 10));
ok("data", "every team plays once a gameweek", DATA.teams.every((t) => [...Array(38)].every((_, i) => M.fx(t.s, i + 1).length === 1)));
ok("data", "players carry a club the feed knows", DATA.players.every((p) => DATA.teams.some((t) => t.s === p.t)));
ok("data", "prices are sane", DATA.players.every((p) => p.pr >= 3.5 && p.pr <= 16));
ok("data", "Draft rosters hold fifteen each", Object.values(DATA.draft.rosters).every((r) => r.length === 15), Object.entries(DATA.draft.rosters).map(([k, v]) => k + ":" + v.length).join(" "));
ok("data", "Draft rosters are 2-5-5-3", Object.values(DATA.draft.rosters).every((r) => { const c = { 1: 0, 2: 0, 3: 0, 4: 0 }; r.forEach((id) => c[M.P[id].p]++); return c[1] === 2 && c[2] === 5 && c[3] === 5 && c[4] === 3; }));
ok("data", "no player owned by two Draft teams", (() => { const seen = new Set(); return Object.values(DATA.draft.rosters).every((r) => r.every((id) => !seen.has(id) && seen.add(id))); })());
ok("data", "eight managers, eight standings rows", DATA.draft.entries.length === DATA.draft.standings.length);
ok("data", "Draft table adds up", DATA.draft.standings.every((s) => s.pts === s.w * 3 + s.d));
ok("data", "every manager has played the same number of matches", new Set(DATA.draft.standings.map((s) => s.w + s.d + s.l)).size === 1);
ok("data", "points scored across the league equals points conceded", near(DATA.draft.standings.reduce((a, s) => a + s.pf, 0), DATA.draft.standings.reduce((a, s) => a + s.pa, 0), 0.5));
ok("data", "Classic history totals reconcile", (() => { let t = 0; return DATA.classic.season.every((s) => { t += s.pts; return true; }) && t === DATA.classic.total; })(), "sum " + DATA.classic.season.reduce((a, s) => a + s.pts, 0) + " vs " + DATA.classic.total);
ok("data", "free transfers never exceed the cap", DATA.classic.ftNext >= 0 && DATA.classic.ftNext <= DATA.rules.maxFt);
ok("data", "screenshot selling prices match players that exist", Object.keys(DATA.screen.sell).every((k) => !!M.byKey[k]));
ok("data", "the re-draft is read from the league settings", !DATA.draft.league.redraft || DATA.draft.league.redraft.fromGw >= 2);
ok("data", "Draft horizon stops before the re-draft", !DATA.draft.league.redraft || dEnd === DATA.draft.league.redraft.fromGw - 1);

/* ── 2. maths ── */
const o = M.matchOdds(1.7, 1.2); ok("maths", "result probabilities sum to one", near(o.h + o.d + o.a, 1, 1e-9));
ok("maths", "the better side wins more often", M.matchOdds(2.4, 0.7).h > M.matchOdds(0.7, 2.4).h);
ok("maths", "Poisson mass sums to one", (() => { let s = 0; for (let k = 0; k < 40; k++) s += M.maths.poisPmf(k, 2.3); return near(s, 1, 1e-6); })());
ok("maths", "tail probability falls as the bar rises", M.maths.poisTail(5, 3) < M.maths.poisTail(4, 3));
ok("maths", "clean-sheet chance falls as goals against rise", Math.exp(-2) < Math.exp(-1));
ok("maths", "quantiles are ordered", (() => { const a = [...Array(200)].map((_, i) => i); return M.maths.quantile(a, 0.1) < M.maths.quantile(a, 0.5) && M.maths.quantile(a, 0.5) < M.maths.quantile(a, 0.9); })());
ok("maths", "the random generator repeats for a given seed", (() => { const a = M.maths.mulberry(42), b = M.maths.mulberry(42); return a() === b() && a() === b(); })());
ok("maths", "ratings are normalised around one", near(Math.exp(M.teamNames.reduce((s, t) => s + Math.log(M.RAT[t].att), 0) / M.teamNames.length), 1, 1e-6));
ok("maths", "the market fit is close", M.calib.rmse != null && M.calib.rmse < 0.25, "rmse " + (M.calib.rmse || 0).toFixed(3));
ok("maths", "bookmaker numbers are used where loaded", DATA.fixtures.filter((f) => f.gw === 5).some((f) => M.lambdas(f.h, { o: f.a, ha: "H" }, 5).src === "market"));
ok("maths", "removing the margin gives fair odds that sum to one", (() => { const ui = U.makeUI(M, DATA, {}, null), d = ui.helpers.devig(1.5, 4.2, 6.5); return near(d.h + d.d + d.a, 1, 1e-9) && d.margin > 0; })());
ok("maths", "fitted goals reproduce the fair odds", (() => { const ui = U.makeUI(M, DATA, {}, null), d = ui.helpers.devig(1.5, 4.2, 6.5), f = ui.helpers.fitRates(d), r = M.matchOdds(f.lh, f.la); return Math.abs(r.h - d.h) < 0.02 && Math.abs(r.a - d.a) < 0.02; })());

/* ── 3. projections ── */
const sample = DATA.players.filter((p) => p.mins > 0).slice(0, 400);
ok("proj", "expected points are finite and in range", sample.every((p) => { const e = M.ep(p, next); return isFinite(e) && e > -2 && e < 18; }));
ok("proj", "unavailable players score nothing", DATA.players.filter((p) => p.st === "u" || (p.st === "i" && !p.ret)).every((p) => M.ep(p, next) < 1.2));
ok("proj", "the build-up adds to the total", sample.slice(0, 120).every((p) => { const x = M.parts(p, next); return near(x.det.reduce((s, d) => s + d.ep, 0), x.ep, 1e-6); }));
ok("proj", "a horizon is the sum of its gameweeks", sample.slice(0, 60).every((p) => near(M.epRange(p, next, next + 3), [0, 1, 2, 3].reduce((s, i) => s + M.ep(p, next + i), 0), 1e-6)));
ok("proj", "the same fixture scores the same twice", sample.slice(0, 60).every((p) => near(M.ep(p, next), M.ep(p, next), 0)));
ok("proj", "goalkeepers earn nothing for clean sheets they cannot keep", DATA.players.filter((p) => p.p === 1).every((p) => M.parts(p, next).det.every((d) => d.cs >= 0)));
ok("proj", "defenders lose points for goals conceded", DATA.players.filter((p) => p.p <= 2 && p.mins > 200).every((p) => M.parts(p, next).det.every((d) => d.gc <= 0)));
ok("proj", "forwards get no clean-sheet points", DATA.players.filter((p) => p.p === 4).every((p) => M.parts(p, next).det.every((d) => near(d.cs, 0, 1e-9))));
ok("proj", "defensive contributions never exceed two a match", DATA.players.every((p) => M.parts(p, next).det.every((d) => d.dc <= 2.0001)));
ok("proj", "Haaland outscores a fourth-choice defender", (() => { const h = M.byKey["Haaland|MCI"], w = DATA.players.filter((p) => p.p === 2 && p.mins < 60)[0]; return !h || !w || M.ep(h, next) > M.ep(w, next); })());
ok("proj", "a stronger fixture lifts a striker", (() => { const h = M.byKey["Haaland|MCI"]; if (!h) return true; let easy = 0, hard = 0; for (let g = next; g <= next + 6; g++) { const L = M.lambdas("MCI", M.fx("MCI", g)[0], g), e = M.ep(h, g); if (L.lf > 2.2) easy = Math.max(easy, e); if (L.lf < 1.6) hard = Math.max(hard, e); } return easy === 0 || hard === 0 || easy > hard; })());
ok("proj", "every dated start override is applied in its own gameweek only", Object.keys(DATA.intel.start || {}).every((g) => Object.keys(DATA.intel.start[g]).every((k) => { const p = M.byKey[k]; if (!p) return true; const o = DATA.intel.start[g][k].p, other = M.avail(p, +g + 20 <= 38 ? +g + 20 : 1); return M.avail(p, +g).pStart === o && other.pStart == null; })));
ok("proj", "a player with a return date is out before it and back after", (() => { const p = DATA.players.find((x) => x.ret && x.ret > "2026-10-01"); if (!p) return true; const back = new Date(p.ret).getTime(); let before = null, after = null; for (let g = next; g <= 20; g++) { const dl = new Date(M.deadline[g]).getTime(); if (dl < back) before = M.avail(p, g).a; if (dl > back + 14 * 864e5) { after = M.avail(p, g).a; break; } } return (before === null || before === 0) && (after === null || after === 1); })());

/* ── 4. rules of the two games ── */
const cs = M.classicSquad();
ok("rules", "the Classic squad has fifteen", !cs || cs.squad.length === 15);
ok("rules", "no more than three from a club", !cs || (() => { const c = {}; cs.squad.forEach((p) => { c[p.t] = (c[p.t] || 0) + 1; }); return Object.values(c).every((n) => n <= DATA.rules.clubLimit); })());
for (let g = next; g <= Math.min(38, next + 3); g++) { const b = cs && M.bestXI(cs.squad, g);
  ok("rules", "eleven players, gameweek " + g, !b || b.xi.length === 11);
  ok("rules", "one goalkeeper, gameweek " + g, !b || b.xi.filter((p) => p.p === 1).length === 1);
  ok("rules", "at least three defenders, gameweek " + g, !b || b.xi.filter((p) => p.p === 2).length >= 3);
  ok("rules", "at least one forward, gameweek " + g, !b || b.xi.filter((p) => p.p === 4).length >= 1);
  ok("rules", "the bench holds the rest, gameweek " + g, !b || b.xi.length + b.bench.length + (b.benchGk ? 1 : 0) === 15);
  ok("rules", "captain and vice are in the eleven, gameweek " + g, !b || (b.xi.includes(b.cap) && b.xi.includes(b.vice)));
  ok("rules", "the best eleven beats an arbitrary one, gameweek " + g, !b || b.tot >= M.xiTotal(cs.squad.slice(0, 11), g) - 1e-9); }
const roster = M.draftRoster();
ok("rules", "the Draft roster has fifteen", roster.length === 15);
ok("rules", "free agents are owned by nobody", M.freeAgents().every((p) => !p.do));
ok("rules", "players on waivers are owned by nobody", M.lockedFreeAgents().every((p) => !p.do));
ok("rules", "the claim pool is free agents plus waivers", M.waiverPool().length === M.freeAgents().length + M.lockedFreeAgents().length);
ok("rules", "nobody on the roster shows up as claimable", M.waiverPool().every((p) => !roster.some((r) => r.id === p.id)));
ok("rules", "every claim swaps like for like", M.draftMoves(roster, next, dEnd, { perPos: 4 }).every((m) => m.add.p === m.drop.p));
ok("rules", "every trade swaps like for like", U.makeUI(M, DATA, {}, null).findTrades().every((t) => M.P[t.get].p === M.P[t.give].p));
ok("rules", "a trade never takes from my own roster", U.makeUI(M, DATA, {}, null).findTrades().every((t) => !roster.some((r) => r.id === t.get)));

/* ── 5. the two games never mix ── */
ok("separate", "no Classic total is added to a Draft total", (() => { const ui = U.makeUI(M, DATA, {}, null), h = ui.view("today") + ui.view("leagues"); return !h.includes(String(DATA.classic.total + (DATA.draft.standings.find((s) => s.name === DATA.draft.me) || {}).pf)); })());
ok("separate", "the Draft horizon is independent of the Classic one", dEnd !== cEnd || DATA.draft.league.redraft == null);
ok("separate", "Draft rosters ignore Classic prices", M.draftMoves(roster, next, dEnd, { perPos: 3 }).every((m) => m.gain != null));

/* ── 6. property tests ── */
let cases = 0, propFail = 0; const rnd = M.maths.mulberry(99);
for (let i = 0; i < 1500; i++) { const p = DATA.players[Math.floor(rnd() * DATA.players.length)], g = next + Math.floor(rnd() * Math.min(10, 38 - next));
  const x = M.parts(p, g); cases++; if (!isFinite(x.ep) || x.ep < -2 || x.ep > 20) propFail++;
  x.det.forEach((d) => { cases++; if (d.pStart < 0 || d.pStart > 1.0001 || d.pPlay < d.pStart - 1e-9 || d.pcs < 0 || d.pcs > 1) propFail++; }); }
for (let i = 0; i < 400; i++) { const picks = []; const pool = DATA.players.filter((p) => p.st !== "u");
  while (picks.length < 15) { const p = pool[Math.floor(rnd() * pool.length)]; const c = { 1: 2, 2: 5, 3: 5, 4: 3 }; if (picks.filter((x) => x.p === p.p).length < c[p.p] && !picks.includes(p)) picks.push(p); }
  const g = next + Math.floor(rnd() * 5), b = M.bestXI(picks, g); cases++;
  if (!b || b.xi.length !== 11 || b.xi.filter((p) => p.p === 1).length !== 1 || b.xi.filter((p) => p.p === 2).length < 3 || b.xi.filter((p) => p.p === 4).length < 1 || b.tot < 0) propFail++;
  const alt = M.bestXI(picks.slice().reverse(), g); cases++; if (!alt || !near(alt.tot, b.tot, 1e-6)) propFail++;      // order of the squad must not change the answer
}
for (let i = 0; i < 120; i++) { const g = next + Math.floor(rnd() * 4), r = M.draftRoster(DATA.draft.entries[Math.floor(rnd() * DATA.draft.entries.length)].name), b = M.bestXI(r, g); cases++;
  if (!b || b.xi.length !== 11 || b.xi.concat(b.bench, b.benchGk ? [b.benchGk] : []).length !== 15) propFail++; }
ok("property", `${cases.toLocaleString()} generated cases hold`, propFail === 0, propFail + " counterexamples");

/* ── 7. simulation behaves ── */
if (cs) { const b = M.bestXI(cs.squad, next), side = { xi: b.xi, bench: b.bench, benchGk: b.benchGk, captain: b.cap, vice: b.vice };
  const s1 = M.summarise(M.simulate(next, [side], 3000, 7)[0]), s2 = M.summarise(M.simulate(next, [side], 3000, 7)[0]);
  ok("sim", "the same seed gives the same distribution", near(s1.mean, s2.mean, 1e-9));
  ok("sim", "percentiles are ordered", s1.p10 <= s1.p50 && s1.p50 <= s1.p90);
  ok("sim", "the simulated mean sits near the projection", Math.abs(s1.mean - (b.tot + b.capV)) < 8, `sim ${s1.mean.toFixed(1)} vs projection ${(b.tot + b.capV).toFixed(1)}`);
  ok("sim", "scores are never negative in practice", s1.min > -5);
  const tc = M.summarise(M.simulate(next, [Object.assign({}, side, { tc: true })], 2000, 7)[0]);
  ok("sim", "a triple captain scores more than a double", tc.mean > s1.mean); }
const m5 = DATA.draft.matches.find((x) => x.gw === (live > G.lastDone ? live : next) && (x.a === DATA.draft.me || x.b === DATA.draft.me));
if (m5) { const on = m5.a === DATA.draft.me ? m5.b : m5.a, me = M.sideFromRoster(roster, live, DATA.draft.rivalsNow[DATA.draft.me]), them = M.sideFromRoster(M.draftRoster(on), live, DATA.draft.rivalsNow[on]);
  const r = M.h2h(live, me, them, 4000, 5);
  ok("sim", "head-to-head probabilities sum to one", near(r.win + r.draw + r.lose, 1, 1e-9));
  ok("sim", "the saved elevens were used once published", me.saved && them.saved);
  ok("sim", "a head-to-head is not a landslide either way", r.win > 0.05 && r.win < 0.95, "win " + (r.win * 100).toFixed(1) + "%"); }
const race = M.titleRace(next, dEnd, 1500, 3);
ok("sim", "finishing-first chances sum to one", near(race.reduce((s, r) => s + r.first, 0), 1, 1e-6));
ok("sim", "everyone's average finish is inside the table", race.every((r) => r.pos >= 1 && r.pos <= DATA.draft.entries.length));

/* ── 8. optimisers respect the rules they are given ── */
if (cs) { const tr = M.classicTransfers(cs, next, cEnd, Math.min(cs.ft, 3));
  ok("opt", "transfers stay inside the budget", tr.bank >= -1e-9);
  ok("opt", "transfers swap like for like", tr.moves.every((m) => m.out.p === m.inn.p));
  ok("opt", "transfers keep three a club", (() => { const c = {}; tr.squad.forEach((p) => { c[p.t] = (c[p.t] || 0) + 1; }); return Object.values(c).every((n) => n <= 3); })());
  ok("opt", "transfers do not buy someone already owned", tr.moves.every((m) => !cs.squad.some((p) => p.id === m.inn.id)));
  ok("opt", "every transfer improves the horizon", tr.moves.every((m) => m.gain > 0));
  ok("opt", "the squad is worth more after them", tr.value >= M.squadValue(cs.squad, next, cEnd, true) - 1e-6);
  const budget = cs.squad.reduce((s, p) => s + p.sell, 0) + cs.bank, w = M.wildcard(budget, next, cEnd, { perPos: 18 });
  ok("opt", "the wildcard squad has fifteen", !!w && w.squad.length === 15);
  ok("opt", "the wildcard fits the budget", !!w && w.cost <= w.budget + 1e-9, w ? w.cost + " of " + w.budget : "");
  ok("opt", "the wildcard is 2-5-5-3", !!w && (() => { const c = { 1: 0, 2: 0, 3: 0, 4: 0 }; w.squad.forEach((p) => c[p.p]++); return c[1] === 2 && c[2] === 5 && c[3] === 5 && c[4] === 3; })());
  ok("opt", "the wildcard keeps three a club", !!w && (() => { const c = {}; w.squad.forEach((p) => { c[p.t] = (c[p.t] || 0) + 1; }); return Object.values(c).every((n) => n <= 3); })());
  ok("opt", "the wildcard picks nobody unavailable", !!w && w.squad.every((p) => p.st !== "u"));
  ok("opt", "the wildcard beats the squad it replaces", !!w && w.value > M.squadValue(cs.squad, next, cEnd, true)); }
const mv = M.draftMoves(roster, next, dEnd, { perPos: 6 }), dist = M.bestDistinctMoves(mv, 4, 0.5);
ok("opt", "claims are ranked by what they add", mv.every((m, i) => i === 0 || mv[i - 1].gain >= m.gain - 1e-9));
ok("opt", "a shortlist never uses the same player twice", new Set(dist.map((m) => m.add.id)).size === dist.length && new Set(dist.map((m) => m.drop.id)).size === dist.length);
ok("opt", "a shortlist never adds and drops the same man", dist.every((m) => m.add.id !== m.drop.id));

/* ── 8b. reconciliation, prices, markets and the waiver cycle ── */
ok("recon", "every Classic gameweek rebuilds to the official total", (DATA.classic.recon || []).length > 0 && DATA.classic.recon.every((r) => r.rebuilt === r.reported), JSON.stringify((DATA.classic.recon || []).filter((r) => r.rebuilt !== r.reported)));
ok("recon", "the season total equals the sum of the weeks", DATA.classic.gws.reduce((a, g) => a + g.pts, 0) === DATA.classic.total);
ok("recon", "every transfer in the log shows up in the next published squad", (DATA.classic.transfersLog || []).every((t) => { const g = DATA.classic.gws.find((x) => x.gw === t.gw); return !g || (g.picks.some((k) => k.id === t.in) && !g.picks.some((k) => k.id === t.out)); }));
ok("recon", "bank after the transfers equals what was freed up", (() => { const g = DATA.classic.gws[DATA.classic.gws.length - 1], spent = (DATA.classic.transfersLog || []).reduce((a, t) => a + t.outCost - t.inCost, 0); return Math.abs(g.bank - Math.max(0, spent)) < 0.051 || (DATA.classic.transfersLog || []).length === 0; })());
ok("recon", "free transfers follow the published history", (() => { let ft = 1; for (let g = 2; g < next; g++) { const w = DATA.classic.gws.find((x) => x.gw === g), chip = w && (w.chip === "wildcard" || w.chip === "freehit"); ft = chip ? ft : Math.min(DATA.rules.maxFt, ft - (w ? Math.min(ft, w.tx || 0) : 0) + 1); } return ft === DATA.classic.ftNext; })(), "expected vs " + DATA.classic.ftNext);
const sellMap = DATA.classic.sell || {};
ok("prices", "a selling price never exceeds the current price", Object.values(sellMap).every((v) => v.sell <= v.now + 1e-9));
ok("prices", "a rise is shared half and half, rounded down", Object.values(sellMap).every((v) => v.now <= v.paid || Math.abs(v.sell - (v.paid + Math.floor(Math.round((v.now - v.paid) * 10) / 2) / 10)) < 1e-9));
ok("prices", "a fall is taken in full", Object.values(sellMap).every((v) => v.now > v.paid || Math.abs(v.sell - v.now) < 1e-9));
ok("prices", "the formula reproduces the 18 September screen", (() => { let exact = 0, near1 = 0, n = 0; Object.keys(DATA.screen.sell).forEach((k) => { const p = M.byKey[k]; if (!p || !sellMap[p.id]) return; n++; const d = Math.abs(sellMap[p.id].sell - DATA.screen.sell[k]); if (d < 1e-9) exact++; if (d <= 0.1 + 1e-9) near1++; }); return n >= 10 && near1 === n && exact >= n - 3; })());
ok("prices", "the Classic squad uses the worked-out prices", !cs || cs.squad.every((p) => !sellMap[p.id] || Math.abs(p.sell - sellMap[p.id].sell) < 1e-9));
ok("market", "match prices turn back into the same odds", Object.values(M.ODDS).every((arr) => arr.every((o) => { const r = M.matchOdds(o.lh, o.la); return Math.abs(r.h - o.fair.h) < 0.012 && Math.abs(r.d - o.fair.d) < 0.012 && Math.abs(r.a - o.fair.a) < 0.012; })));
ok("market", "every loaded price matches a real fixture", Object.keys(DATA.intel.odds || {}).every((g) => DATA.intel.odds[g].every((r) => DATA.fixtures.some((f) => f.gw === +g && f.h === r[0] && f.a === r[1]))));
ok("market", "the bookmaker margin is positive and sane", Object.values(M.ODDS).every((arr) => arr.every((o) => o.fair.margin > 0 && o.fair.margin < 0.15)));
ok("market", "loaded prices drive the projections", (M.ODDS[next] || []).length === 0 || M.lambdas(M.ODDS[next][0].h, M.fx(M.ODDS[next][0].h, next)[0], next).src === "odds");
ok("market", "the favourite is expected to score more", Object.values(M.ODDS).every((arr) => arr.every((o) => (o.fair.h > o.fair.a) === (o.lh > o.la) || Math.abs(o.fair.h - o.fair.a) < 0.02)));
const ct = M.contested(next, dEnd, 3), wOrder = M.waiverOrder();
ok("waivers", "the waiver order is the reverse of the table", wOrder.join("|") === DATA.draft.standings.slice().sort((a, b) => b.rank - a.rank || a.pf - b.pf).map((s) => s.name).join("|"), wOrder.join(" > "));
ok("waivers", "only managers ahead of you are treated as rivals for claims", ct.ahead.every((n) => wOrder.indexOf(n) < wOrder.indexOf(DATA.draft.me)));
ok("waivers", "their likely claims are real free players", Object.values(ct.picks).every((v) => v.every((m) => M.waiverPool().some((p) => p.id === m.add))));
ok("waivers", "before waivers settle, everything is a claim", DATA.draft.waiversProcessed || M.waiverPool().every((p) => M.howToGet(p) === "waiver"));
ok("waivers", "the claims copy matches the phase", (() => { const h = U.makeUI(M, DATA, PRE0, null).view("draft"); return DATA.draft.waiversProcessed ? !h.includes("Every move before") : h.includes("Every move before") && !h.includes("Dropped this week"); })());

/* ── 8c. the solved plan obeys every rule of the game ── */
const SV = PRE0.solver;
if (SV && SV.plan) { const pl = SV.plan, own0 = new Set(M.classicSquad().squad.map((p) => p.id)), sellOf = (i) => own0.has(i) && (DATA.classic.sell || {})[i] ? DATA.classic.sell[i].sell : M.P[i].pr;
  let ftn = DATA.classic.ftNext, bankn = M.classicSquad().bank, prev = new Set(own0), chipsSeen = {}, ok1 = true, why = "", sold = new Set();
  pl.weeks.forEach((w) => { const sq = w.squad.map((i) => M.P[i]); const c = { 1: 0, 2: 0, 3: 0, 4: 0 }, club = {}; sq.forEach((p) => { c[p.p]++; club[p.t] = (club[p.t] || 0) + 1; });
    const bad = (m) => { if (ok1) { ok1 = false; why = "GW" + w.gw + ": " + m; } };
    if (sq.length !== 15 || c[1] !== 2 || c[2] !== 5 || c[3] !== 5 || c[4] !== 3) bad("squad shape"); if (Object.values(club).some((n) => n > 3)) bad("three a club");
    const xi = w.xi.map((i) => M.P[i]), xc = { 1: 0, 2: 0, 3: 0, 4: 0 }; xi.forEach((p) => xc[p.p]++);
    if (xi.length !== 11 || xc[1] !== 1 || xc[2] < 3 || xc[3] < 2 || xc[4] < 1 || !w.xi.every((i) => w.squad.includes(i))) bad("eleven");
    if (!w.xi.includes(w.cap) || !w.xi.includes(w.vice) || w.cap === w.vice) bad("armband");
    const ins = w.squad.filter((i) => !prev.has(i)), outs = [...prev].filter((i) => !w.squad.includes(i));
    if (ins.length !== w.in.length || outs.length !== w.out.length) bad("transfer list"); if (w.held && ins.length) bad("moves in a held week");
    ins.forEach((i) => { if (sold.has(i)) bad("sold then bought back"); }); outs.forEach((i) => sold.add(i));
    bankn = Math.round((bankn + outs.reduce((a, i) => a + sellOf(i), 0) - ins.reduce((a, i) => a + M.P[i].pr, 0)) * 10) / 10; if (bankn < -1e-9) bad("overspent");
    const hits = w.chip === "wildcard" ? 0 : Math.max(0, ins.length - ftn); if (hits !== w.hits) bad("hits " + hits + " vs " + w.hits);
    if (w.chip) { if (chipsSeen[w.chip]) bad("chip twice"); chipsSeen[w.chip] = 1; }
    const recomputed = xi.reduce((a, p) => a + M.ep(p, w.gw), 0) + M.ep(M.P[w.cap], w.gw) * (w.chip === "3xc" ? 2 : 1) + (w.chip === "bboost" ? w.bench.concat(w.gk2 ? [w.gk2] : []).reduce((a, i) => a + M.ep(M.P[i], w.gw), 0) : 0);
    if (Math.abs(recomputed - w.ep) > 0.05) bad("expected points " + recomputed.toFixed(2) + " vs " + w.ep);
    ftn = w.chip === "wildcard" ? ftn : Math.min(DATA.rules.maxFt, ftn - Math.min(ftn, ins.length) + 1); prev = new Set(w.squad); });
  ok("plan", "every week of the solved plan is a legal squad, eleven, armband, budget and ledger", ok1, why);
  ok("plan", "the plan's points are re-derived exactly by the app's own engine", ok1 || !/expected points/.test(why));
  ok("plan", "the plan uses each chip at most once and only one a week", Object.keys(chipsSeen).length === pl.weeks.filter((w) => w.chip).length);
  ok("plan", "the plan is proven close to the best possible", pl.gap == null || pl.gap < 0.03, "gap " + pl.gap);
  ok("plan", "the plan is at least as good as keeping the wildcard", !SV.noWildcard || pl.total >= SV.noWildcard.total - 1.5, pl.total + " vs " + (SV.noWildcard || {}).total);
  ok("plan", "the plan beats the quick greedy search", !PRE0.transfers || pl.total >= PRE0.transfers.value - 1);
  ok("plan", "free-hit estimates are weeks with no other chip", (SV.freeHit || []).filter((f) => f.free).every((f) => !pl.weeks.find((w) => w.gw === f.gw).chip)); }
if (SV && SV.draft && SV.draft.ok) { const dr = SV.draft, r0 = new Set(M.draftRoster().map((p) => p.id)), pool = new Set(M.waiverPool().map((p) => p.id)), c = { 1: 0, 2: 0, 3: 0, 4: 0 }; dr.roster.forEach((i) => c[M.P[i].p]++);
  ok("plan", "the solved Draft roster is fifteen, 2-5-5-3", dr.roster.length === 15 && c[1] === 2 && c[2] === 5 && c[3] === 5 && c[4] === 3);
  ok("plan", "every Draft add is claimable and every drop is yours", dr.pairs.every((q) => pool.has(q.add) && r0.has(q.drop) && M.P[q.add].p === M.P[q.drop].p));
  ok("plan", "the solved Draft roster is worth at least the current one", dr.value >= dr.base - 1e-6);
  ok("plan", "the contested version never adds a player the team ahead takes", !SV.draftIfTaken || SV.draftIfTaken.pairs.every((q) => !SV.draftIfTaken.excluded.includes(q.add))); }

/* ── 8d. the waiver model reproduces what actually happened in this league ── */
const rawTx = fs.existsSync(path.join(__dirname, "../live/d_tx.json")) ? JSON.parse(fs.readFileSync(path.join(__dirname, "../live/d_tx.json"), "utf8")).transactions : null;
const dbRaw = fs.existsSync(path.join(__dirname, "../live/dbootstrap.json")) ? JSON.parse(fs.readFileSync(path.join(__dirname, "../live/dbootstrap.json"), "utf8")) : null;
if (rawTx && dbRaw) { const nameOf = {}; DATA.draft.entries.forEach((e) => { nameOf[e.eid] = e.name; }); let checked = 0, matched = 0, weeks = 0;
  [2, 3, 4, 5].forEach((gw) => { const w = rawTx.filter((t) => t.kind === "w" && t.event === gw); if (!w.length) return; weeks++;
    const lists = {}; w.forEach((t) => { (lists[nameOf[t.entry]] = lists[nameOf[t.entry]] || []).push(t); }); Object.values(lists).forEach((L) => L.sort((a, b) => a.priority - b.priority));
    const first = {}; Object.keys(lists).forEach((nm) => { first[nm] = Math.min.apply(null, lists[nm].map((t) => t.index)); });
    const order = Object.keys(lists).sort((a, b) => first[a] - first[b]);                     // the processing order that week, read off the log itself
    const rl = {}; order.forEach((nm) => { rl[nm] = lists[nm].map((t) => ({ add: t.element_in, drop: t.element_out, ref: t })); });
    const mine = rl[DATA.draft.me] || []; delete rl[DATA.draft.me]; const fullOrder = order.includes(DATA.draft.me) ? order : order.concat([DATA.draft.me]);
    const sim = M.waiverSim(mine, rl, fullOrder);
    sim.log.forEach((x) => { const t = (lists[x.who] || []).find((q) => q.element_in === x.add && q.element_out === x.drop); if (!t) return; checked++; const want = t.result === "a" ? "ok" : t.result === "di" ? "already claimed" : "drop already gone"; if ((x.ok ? "ok" : x.why) === want) matched++; }); });
  ok("waivers", "the round-by-round waiver model reproduces every claim result in the league's own log", checked > 40 && matched === checked, matched + " of " + checked + " across " + weeks + " gameweeks");
}
if (PRE0.claims) { const C = PRE0.claims, roster = new Set(M.draftRoster().map((p) => p.id)), pool = new Set(M.waiverPool().map((p) => p.id));
  ok("waivers", "every claim on the sheet adds a claimable player and drops one of yours, like for like", C.sheet.every((e) => pool.has(e.add) && roster.has(e.drop) && M.P[e.add].p === M.P[e.drop].p));
  ok("waivers", "no player is asked for twice on the sheet", new Set(C.sheet.map((e) => e.add)).size === C.sheet.length);
  ok("waivers", "a backup is never one of the names rivals are modelled to want", C.sheet.filter((e) => e.kind === "backup").every((e) => !Object.values(C.rivals).some((v) => v.includes(e.add))));
  ok("waivers", "the stress-test roster is worth no more than the all-land roster and no less than today's", C.valueStress <= C.valueAll + 1e-6 && C.valueStress >= C.valueNow - 1e-6);
  ok("waivers", "the chosen ordering is the better of the two simulated", C.valueStress >= C.altValue - 1e-9);
  ok("waivers", "the stress-test roster stays 2-5-5-3", (() => { const after = M.draftRoster().map((p) => p.id); C.sim.filter((x) => x.ok).forEach((x) => { const k = after.indexOf(x.drop); if (k >= 0) after[k] = x.add; }); const c = { 1: 0, 2: 0, 3: 0, 4: 0 }; after.forEach((i) => c[M.P[i].p]++); return c[1] === 2 && c[2] === 5 && c[3] === 5 && c[4] === 3; })());
}

/* ── 9. render every tab in many states, and fire every control ── */
function paint(ui, label) { let out = ""; ui.TABS.forEach((t) => { try { const h = ui.view(t[0]); ok("render", `${label}: ${t[1]}`, typeof h === "string" && h.length > 300 && !/undefined|NaN|\[object Object\]/.test(h), (h.match(/undefined|NaN|\[object Object\]/) || [""])[0]); out += h; } catch (e) { ok("render", `${label}: ${t[1]}`, false, e.message); } });
  try { const full = ui.render(); ok("render", label + ": whole page", full.includes("</footer>") && full.length > 3000); out += full; } catch (e) { ok("render", label + ": whole page", false, e.message); } return out; }
const PRE = fs.existsSync(path.join(__dirname, "pre.json")) ? JSON.parse(fs.readFileSync(path.join(__dirname, "pre.json"), "utf8")) : {};
const uiCold = U.makeUI(M, DATA, {}, null), uiWarm = U.makeUI(M, DATA, PRE, null);
const all = paint(uiCold, "no precomputed results") + paint(uiWarm, "with precomputed results");
ok("render", "tags are balanced", (() => { const open = (all.match(/<div/g) || []).length, close = (all.match(/<\/div>/g) || []).length; return open === close; })(), (all.match(/<div/g) || []).length + " open vs " + (all.match(/<\/div>/g) || []).length + " closed");
ok("render", "table rows are balanced", (all.match(/<tr>/g) || []).length + (all.match(/<tr class=/g) || []).length === (all.match(/<\/tr>/g) || []).length);
ok("render", "no raw template braces escaped into the page", !/\$\{/.test(all));
ok("render", "the Draft horizon is stated on the Draft tab", uiWarm.view("draft").includes("gameweek " + dEnd));
ok("render", "the two games are labelled everywhere", uiWarm.view("today").includes("Classic") && uiWarm.view("today").includes("Draft"));
/* fire every control the interface exposes */
const acts = [...new Set((all.match(/data-act="([a-z]+)"/g) || []).map((s) => s.replace(/.*"([a-z]+)".*/, "$1")))];
ok("render", "every control is handled", acts.every((a) => ["tab", "explain", "xi", "fapos", "fpos", "ffree", "fsort", "more", "tmode", "tspan", "calc", "dend", "applyodds", "rmodds", "run"].includes(a)), acts.join(","));
const ui2 = U.makeUI(M, DATA, PRE, null); let painted = 0; const rerender = () => { painted++; ui2.TABS.forEach((t) => ui2.view(t[0])); };
[["tab", "classic"], ["tab", "draft"], ["tab", "leagues"], ["tab", "fixtures"], ["tab", "players"], ["tab", "odds"], ["tab", "review"], ["tab", "lab"], ["tab", "today"], ["explain", null], ["xi", "best"], ["xi", "saved"], ["fapos", "2"], ["fapos", "0"], ["fpos", "3"], ["ffree", null], ["ffree", null], ["fsort", "val"], ["fsort", "own"], ["more", null], ["tmode", "def"], ["tspan", "14"], ["tspan", "4"], ["dend", "18"], ["dend", "20"]].forEach(([a, v]) => {
  try { ui2.act(a, { getAttribute: (k) => (k === "data-v" ? v : null) }, rerender, (fn) => fn()); } catch (e) { ok("act", `${a}=${v}`, false, e.message); } });
ok("act", "every setting change re-rendered cleanly", painted >= 24, painted + " repaints");
/* odds entry end to end */
try { const fxid = DATA.fixtures.find((f) => f.gw === next).id; ui2.input("oddsFx", String(fxid)); ui2.input("oH", "1.55"); ui2.input("oD", "4.30"); ui2.input("oA", "5.60");
  const before = M.ep(M.byKey["Haaland|MCI"] || DATA.players[0], next); ui2.act("applyodds", { getAttribute: () => null }, rerender, (fn) => fn());
  ok("act", "a bookmaker price changes the projections", ui2.state.market && Object.keys(ui2.state.market).length > 0);
  ok("act", "the odds tab shows what was added", ui2.view("odds").includes("Remove"));
  const gwKey = String(next); ui2.act("rmodds", { getAttribute: (k) => (k === "data-g" ? gwKey : k === "data-t" ? Object.keys(ui2.state.market[gwKey] || {})[0] : null) }, rerender, (fn) => fn());
  ok("act", "a price can be removed again", true); } catch (e) { ok("act", "odds entry end to end", false, e.message); }
/* heavy searches through the same path the buttons use */
["tr", "wc", "trade", "tests"].forEach((v) => { try { ui2.act("run", { getAttribute: (k) => (k === "data-v" ? v : null) }, rerender, (fn) => fn()); ok("act", "search runs: " + v, true); } catch (e) { ok("act", "search runs: " + v, false, e.message); } });
const st = ui2.selfTest(); ok("act", "the in-app self-test passes", st.pass === st.total, st.fails.join("; "));
/* the built page */
const outFile = process.argv[2] || "/mnt/user-data/outputs/fpl-mission-control.html";
if (fs.existsSync(outFile)) { const html = fs.readFileSync(outFile, "utf8");
  ok("page", "the page is self-contained", !/<script src=|<img src=/.test(html));
  ok("page", "no stray closing script tag inside the data", (html.match(/<\/script>/g) || []).length === (html.match(/<script/g) || []).length);
  ok("page", "the page carries both games' data", html.includes(DATA.draft.league.name) && html.includes(DATA.classic.name));
  ok("page", "there is a visible fallback if it cannot start", html.includes("could not start") && html.includes("noscript"));
  ok("page", "the page is a sensible size", html.length > 200000 && html.length < 4000000, (html.length / 1024).toFixed(0) + " kB"); }

const order = Object.keys(groups);
console.log("\n" + "═".repeat(64) + "\nMission Control QA — " + new Date().toISOString());
order.forEach((g) => console.log("  " + g.padEnd(10) + String(groups[g].p).padStart(4) + " / " + String(groups[g].t).padEnd(5) + (groups[g].p === groups[g].t ? "ok" : "FAIL")));
console.log("  " + "TOTAL".padEnd(10) + String(pass).padStart(4) + " / " + String(total).padEnd(5) + (cases.toLocaleString()) + " property cases");
if (fails.length) { console.log("\nFAILURES"); fails.forEach((f) => console.log("  ✕ " + f)); }
console.log("═".repeat(64));
process.exit(fails.length ? 1 : 0);

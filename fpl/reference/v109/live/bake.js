/* bake.js — reads the feeds pull.sh fetched and writes ../app/data.json, the single
   data block Mission Control ships with. Nothing here is typed by hand except INTEL,
   which carries dated desk research the feeds cannot see. Run: node bake.js */
const fs = require("fs");
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };
const has = (f) => fs.existsSync(f);
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;

const ME = { classic: 3546875, draft: 279275, league: 46148 };
const b = J("bootstrap.json"), fxAll = J("fixtures.json"), db = J("dbootstrap.json");
const det = J("d_details.json"), es = J("d_status.json").element_status, dtx = (J("d_tx.json") || {}).transactions || [];
const entry = J("entry.json"), hist = J("history.json"), dgame = J("d_game.json") || {};
const asOf = new Date().toISOString();

/* ── gameweeks ─────────────────────────────────────────────────────────── */
const now = Date.now();
const events = b.events.map((e) => ({ id: e.id, dl: e.deadline_time, fin: !!e.finished, avg: e.average_entry_score || 0, hi: e.highest_score || 0 }));
const nextEv = events.find((e) => new Date(e.dl).getTime() > now) || events[events.length - 1];
const liveEv = [...events].reverse().find((e) => new Date(e.dl).getTime() <= now) || events[0];   // the gameweek whose deadline has passed most recently
const lastDone = [...events].reverse().find((e) => e.fin) || { id: 0 };
const dEvents = {}; db.events.data.forEach((e) => { dEvents[e.id] = { dl: e.deadline_time, wv: e.waivers_time }; });

/* ── teams and fixtures ────────────────────────────────────────────────── */
const teams = b.teams.map((t) => ({ id: t.id, s: t.short_name, n: t.name }));
const TS = {}; teams.forEach((t) => { TS[t.id] = t.s; });
const fixtures = fxAll.filter((f) => f.event).map((f) => ({ id: f.id, gw: f.event, h: TS[f.team_h], a: TS[f.team_a], ko: f.kickoff_time, fin: !!f.finished, st: !!f.started,
  hs: f.team_h_score, as: f.team_a_score }));
const fxById = {}; fxAll.forEach((f) => { fxById[f.id] = f; });

/* ── players: Classic is the spine; Draft ids are mapped through the shared Opta code ── */
const dByCode = {}; db.elements.forEach((e) => { dByCode[e.code] = e; });
const owner = {}; const dstat = {};
const lidByEntry = {}; det.league_entries.forEach((e) => { lidByEntry[e.entry_id] = e; });
es.forEach((x) => { dstat[x.element] = x.status; if (x.owner != null) owner[x.element] = lidByEntry[x.owner] ? lidByEntry[x.owner].entry_name : String(x.owner); });

const liveByGw = {}, dliveByGw = {};
for (let g = 1; g <= 38; g++) { if (has(`live${g}.json`)) liveByGw[g] = J(`live${g}.json`); if (has(`dlive${g}.json`)) dliveByGw[g] = J(`dlive${g}.json`); }
const gwsWithData = Object.keys(liveByGw).map(Number).filter((g) => events.find((e) => e.id === g && (e.fin || g === liveEv.id)));

/* per-player per-gameweek lines: [mins, pts, xg, xa, dc, starts, goals, assists, cs, bonus] */
const histById = {}; const teamFx = {};   // teamFx[fixtureId][teamShort] = xG for
gwsWithData.forEach((g) => {
  (liveByGw[g].elements || []).forEach((el) => {
    const s = el.stats; if (!s) return;
    if (s.minutes > 0 || s.total_points !== 0) {
      (histById[el.id] = histById[el.id] || {})[g] = [s.minutes, s.total_points, r2(+s.expected_goals || 0), r2(+s.expected_assists || 0), s.defensive_contribution || 0, s.starts || 0, s.goals_scored || 0, s.assists || 0, s.clean_sheets || 0, s.bonus || 0];
    }
  });
});
const elById = {}; b.elements.forEach((e) => { elById[e.id] = e; });
gwsWithData.forEach((g) => {
  (liveByGw[g].elements || []).forEach((el) => {
    const e = elById[el.id]; if (!e) return; const t = TS[e.team];
    (el.explain || []).forEach((x) => {
      const f = fxById[x.fixture]; if (!f || !f.finished) return;
      const mine = (TS[f.team_h] === t || TS[f.team_a] === t); if (!mine) return;   // a player who moved clubs is skipped for that match
      const xg = (el.explain.length === 1) ? (+el.stats.expected_goals || 0) : 0;
      (teamFx[x.fixture] = teamFx[x.fixture] || {})[t] = ((teamFx[x.fixture] || {})[t] || 0) + xg;
    });
  });
});

const POSN = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
const retDate = (news) => { const m = /(?:Expected back|until)\s+(\d{1,2})\s+([A-Za-z]{3})/.exec(news || ""); if (!m) return null;
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(m[2]); if (mon < 0) return null;
  const y = mon >= 7 ? 2026 : 2027; return new Date(Date.UTC(y, mon, +m[1])).toISOString().slice(0, 10); };

const players = b.elements.map((e) => {
  const d = dByCode[e.code]; const h = histById[e.id] || null;
  const o = { id: e.id, n: e.web_name, fn: `${e.first_name} ${e.second_name}`.trim(), t: TS[e.team], p: e.element_type, pr: e.now_cost / 10,
    st: e.status, cop: e.chance_of_playing_next_round, cpt: e.chance_of_playing_this_round, pts: e.total_points, mins: e.minutes, stt: e.starts, g: e.goals_scored, a: e.assists, cs: e.clean_sheets, gc: e.goals_conceded,
    xg: r2(+e.expected_goals), xa: r2(+e.expected_assists), xgc: r2(+e.expected_goals_conceded), bps: e.bps, bon: e.bonus, dc: e.defensive_contribution, sv: e.saves, yc: e.yellow_cards, rc: e.red_cards,
    own: +e.selected_by_percent, cs0: e.cost_change_start, tin: e.transfers_in_event, tout: e.transfers_out_event, form: +e.form, epn: +e.ep_next || 0, cc: e.cost_change_event || 0 };
  if (e.news) { o.news = e.news.slice(0, 110); const rd = retDate(e.news); if (rd) o.ret = rd; }
  if (e.penalties_order) o.pen = e.penalties_order; if (e.direct_freekicks_order) o.fk = e.direct_freekicks_order; if (e.corners_and_indirect_freekicks_order) o.ck = e.corners_and_indirect_freekicks_order;
  if (d) { o.did = d.id; o.ds = dstat[d.id] || "a"; if (owner[d.id]) o.do = owner[d.id]; o.dr = d.draft_rank; }
  if (h) o.h = h;
  return o;
}).filter((o) => o.st !== "u" || o.pts > 0 || o.do);   // players who have left the league and never scored are dropped

/* ── season team numbers from the matches actually played ───────────────── */
const teamSeason = {}; teams.forEach((t) => { teamSeason[t.s] = { m: 0, gf: 0, ga: 0, xgf: 0, xga: 0, cs: 0, log: [] }; });
fixtures.filter((f) => f.fin).forEach((f) => {
  const x = teamFx[f.id] || {}; const H = teamSeason[f.h], A = teamSeason[f.a];
  const hx = x[f.h] || 0, ax = x[f.a] || 0;
  H.m++; A.m++; H.gf += f.hs; H.ga += f.as; A.gf += f.as; A.ga += f.hs; H.xgf += hx; H.xga += ax; A.xgf += ax; A.xga += hx; if (f.as === 0) H.cs++; if (f.hs === 0) A.cs++;
  H.log.push({ gw: f.gw, o: f.a, ha: "H", gf: f.hs, ga: f.as, xgf: r2(hx), xga: r2(ax) }); A.log.push({ gw: f.gw, o: f.h, ha: "A", gf: f.as, ga: f.hs, xgf: r2(ax), xga: r2(hx) });
});
Object.values(teamSeason).forEach((t) => { t.xgf = r2(t.xgf); t.xga = r2(t.xga); });

/* ── desk research the feeds cannot see. Dated, sourced, and only ever an override. ── */
const INTEL = {
  asOf: "2026-09-22T17:35:00Z",
  /* Gameweek 5 market numbers (allaboutfpl / Fantasy Football Scout clean-sheet odds and RotoWire prices, 17 Sep). Kept as calibration anchors now the week is played. */
  market5: { MCI: { xg: 2.36, cs: 0.48 }, NEW: { xg: 2.01, cs: 0.35 }, NFO: { xg: 1.88, cs: 0.38 }, LIV: { xg: 1.84 }, ARS: { xg: 1.80, cs: 0.34 }, EVE: { xg: 1.80, cs: 0.34 }, MUN: { xg: 1.80 }, CHE: { xg: 1.77 }, LEE: { xg: 1.77, cs: 0.33 }, TOT: { cs: 0.31 } },
  /* Average bookmaker match prices (home, draw, away), OddsPortal, seen 21 Sep. The engine removes the margin and turns each into goals for both sides. */
  odds: {
    6: [["ARS", "LEE", 1.34, 5.00, 8.00], ["HUL", "EVE", 3.50, 3.37, 2.07], ["AVL", "BRE", 2.58, 3.48, 2.55], ["CHE", "BOU", 1.74, 4.07, 3.97], ["SUN", "BHA", 2.77, 3.37, 2.47],
        ["IPS", "FUL", 2.67, 3.43, 2.50], ["MUN", "TOT", 1.66, 4.10, 4.43], ["CRY", "NFO", 2.63, 3.20, 2.64], ["LIV", "MCI", 2.88, 3.70, 2.20], ["COV", "NEW", 3.28, 3.65, 2.08]],
    7: [["EVE", "CHE", 3.10, 3.55, 2.13], ["BRE", "LIV", 2.60, 3.78, 2.39], ["FUL", "HUL", 1.54, 4.20, 5.48]],
  },
  /* Start-probability overrides by gameweek, where reporting is ahead of the official flag. */
  start: {
    5: { "João Pedro|CHE": { p: 0.15, why: "ESPN Brasil: knee, about three and a half weeks. He did miss Brentford." }, "Shaw|MUN": { p: 0.40, why: "Carrick: 'half a chance'." }, "N.Jackson|AVL": { p: 0.55, why: "Hooked at half-time the week before." } },
    6: { "João Pedro|CHE": { p: 0.65, why: "The Standard and Yahoo Sports, 21 Sep: minor knee problem, target is Bournemouth on 10 October. Fox Sports and RotoWire: Chelsea may be cautious. Official flag 75%." } },
  },
  notes: [
    "The September and October international windows have been merged: no Premier League football between 20 September and Saturday 10 October.",
    "International duty is the main risk between now and gameweek 6. Build a wildcard, and set Draft claims, as late as the deadlines allow so the injury news is in.",
    "Dunk (BHA) is newly flagged: neck injury, 75%. Hall (NEW) rose to £5.3m on 22 September and is the most-bought defender in the game, so expect further rises before the deadline.",
    "Newly flagged after gameweek 5: Palmer (CHE, muscular, 75%), Rice (ARS, 75%), White (ARS, groin, 75%), Mainoo, Rashford and Šeško (MUN, 75%), van Ewijk (COV, hamstring, 75%), Kluivert (BOU, out, no date).",
    "Chelsea were without João Pedro, Caicedo and James in the 3–0 loss at Brentford; Alonso calls most of them marginal for 10 October.",
  ],
  sources: ["Official Fantasy Premier League and FPL Draft feeds", "OddsPortal average match prices, seen 21 Sep", "The Standard via NewsBreak, 21 Sep", "Yahoo Sports / Roundtable, 18 Sep", "Fox Sports and RotoWire player notes, 18–19 Sep", "Sports Illustrated FC, 18 Sep", "allaboutfpl and Fantasy Football Scout gameweek 5 clean-sheet odds, 17 Sep"],
};

/* ── Classic: my entry ─────────────────────────────────────────────────── */
const picks = {}; for (let g = 1; g <= 38; g++) { const p = J(`picks${g}.json`); if (p && p.picks) picks[g] = p; }
const livePts = (g, id) => { const L = liveByGw[g]; if (!L) return null; const el = L.elements.find((x) => x.id === id); return el ? el.stats.total_points : 0; };
const liveMin = (g, id) => { const L = liveByGw[g]; if (!L) return null; const el = L.elements.find((x) => x.id === id); return el ? el.stats.minutes : 0; };
const classicGws = Object.keys(picks).map(Number).sort((a, b2) => a - b2).map((g) => {
  const P = picks[g], eh = P.entry_history || {};
  return { gw: g, pts: eh.points, total: eh.total_points, rank: eh.overall_rank, gwRank: eh.rank, bank: (eh.bank || 0) / 10, value: (eh.value || 0) / 10, tx: eh.event_transfers, hit: eh.event_transfers_cost, bench: eh.points_on_bench,
    chip: P.active_chip || null, avg: (events.find((e) => e.id === g) || {}).avg || 0,
    picks: P.picks.map((k) => ({ id: k.element, pos: k.position, mult: k.multiplier, c: !!k.is_captain, v: !!k.is_vice_captain, pts: livePts(g, k.element), mins: liveMin(g, k.element) })) };
});
const lastPicksGw = classicGws.length ? classicGws[classicGws.length - 1].gw : 0;
/* free transfers: one arrives after every deadline from gameweek 1, capped at five; transfers spend them.
   A wildcard or free hit week keeps the count exactly as it was: nothing spent, and no extra one added (Fantasy Football Scout, 20 Jul 2026). */
const maxFt = 1 + (b.game_settings.max_extra_free_transfers || 4);
let ft = 1; let ftKnownThrough = 1;                                  // ft = free transfers in hand for gameweek 2's deadline
for (let g = 2; g < nextEv.id; g++) {                                // roll forward through every deadline that has passed
  const w = classicGws.find((x) => x.gw === g);
  const chip = w && (w.chip === "wildcard" || w.chip === "freehit");
  const used = w && !chip ? Math.min(ft, w.tx || 0) : 0;
  if (w) ftKnownThrough = g;
  ft = chip ? ft : Math.min(maxFt, ft - used + 1);
}
const ftSure = ftKnownThrough >= nextEv.id - 1;                      // false until the gameweek in play publishes its picks
const leagues = (entry.leagues.classic || []).map((l) => {
  const o = { id: l.id, name: l.name, type: l.league_type, rank: l.entry_rank, last: l.entry_last_rank, n: l.rank_count || null };
  const s = J(`lg_${l.id}.json`);
  if (s && s.standings && s.standings.results.length) {
    const R = s.standings.results; const mine = R.find((x) => x.entry === ME.classic);
    o.top = R.slice(0, 5).map((x) => ({ r: x.rank, team: x.entry_name, tot: x.total, gw: x.event_total }));   // rivals' personal names are never stored
    o.leader = R[0].total; if (mine) { o.mine = mine.total; const above = R.filter((x) => x.rank < mine.rank).slice(-2); o.above = above.map((x) => ({ r: x.rank, team: x.entry_name, tot: x.total })); }
  }
  return o;
});
const chipsUsed = (hist.chips || []).map((c) => ({ name: c.name, gw: c.event }));
/* Selling price = what you paid, plus half of any rise, rounded down to the nearest 0.1; a fall is taken in full.
   What you paid is the start price for anyone in the original fifteen, and the logged cost for anyone bought since. */
const txLog = (J("transfers.json") || []).slice().sort((a, c) => a.time.localeCompare(c.time));
const paid = {}; txLog.forEach((t) => { paid[t.element_in] = t.element_in_cost; });
const sell = {}; const lastPk = classicGws.length ? classicGws[classicGws.length - 1].picks : [];
lastPk.forEach((k) => { const e = elById[k.id]; if (!e) return; const now = e.now_cost, pur = paid[k.id] != null ? paid[k.id] : now - e.cost_change_start;
  sell[k.id] = { now: now / 10, paid: pur / 10, sell: (now > pur ? pur + Math.floor((now - pur) / 2) : now) / 10 }; });
const transfersLog = txLog.map((t) => ({ gw: t.event, at: t.time, in: t.element_in, out: t.element_out, inCost: t.element_in_cost / 10, outCost: t.element_out_cost / 10 }));
/* reconciliation: every gameweek's points must equal the picks times their multipliers, less any hit */
const recon = classicGws.map((g) => ({ gw: g.gw, reported: g.pts, rebuilt: g.picks.reduce((a, k) => a + (k.pts || 0) * k.mult, 0) - (g.hit || 0) }));
const chipWindows = b.chips.map((c) => ({ name: c.name, from: c.start_event, to: c.stop_event }));
const classic = { entry: ME.classic, name: entry.name, mgr: `${entry.player_first_name} ${entry.player_last_name}`, total: entry.summary_overall_points, rank: entry.summary_overall_rank, players: b.total_players,
  gws: classicGws, chipsUsed, chipWindows, maxFt, ftNext: ft, ftSure, leagues, sell, transfersLog, recon, season: hist.current.map((c) => ({ gw: c.event, pts: c.points, rank: c.overall_rank, bench: c.points_on_bench, tx: c.event_transfers, hit: c.event_transfers_cost, value: c.value / 10, bank: c.bank / 10 })) };

/* ── Draft: league, rosters, matches, my elevens ───────────────────────── */
const dEl = {}; db.elements.forEach((e) => { dEl[e.id] = e; });
const cByCode = {}; b.elements.forEach((e) => { cByCode[e.code] = e.id; });
const d2c = (did) => { const e = dEl[did]; return e ? (cByCode[e.code] || null) : null; };
const byLid = {}; det.league_entries.forEach((e) => { byLid[e.id] = e; });
const dEntries = det.league_entries.map((e) => ({ lid: e.id, eid: e.entry_id, name: e.entry_name, waiver: e.waiver_pick }));   // team names only; rivals' personal names are never stored
const dStand = det.standings.slice().sort((a, c) => a.rank - c.rank).map((s) => ({ rank: s.rank, name: byLid[s.league_entry].entry_name, w: s.matches_won, d: s.matches_drawn, l: s.matches_lost, pts: s.total, pf: s.points_for, pa: s.points_against }));
const dMatches = det.matches.map((m) => ({ gw: m.event, a: byLid[m.league_entry_1].entry_name, b: byLid[m.league_entry_2].entry_name, ap: m.league_entry_1_points, bp: m.league_entry_2_points, fin: !!m.finished }));
const rosters = {}; es.forEach((x) => { if (x.owner != null && lidByEntry[x.owner]) { const c = d2c(x.element); if (c) (rosters[lidByEntry[x.owner].entry_name] = rosters[lidByEntry[x.owner].entry_name] || []).push(c); } });
const dlivePts = (g, did) => { const L = dliveByGw[g]; if (!L || !L.elements) return null; const el = L.elements[did] || L.elements[String(did)]; return el && el.stats ? el.stats.total_points : 0; };
const myDraftGws = []; for (let g = 1; g <= 38; g++) { const p = J(`d_picks${g}.json`); if (p && p.picks) myDraftGws.push({ gw: g, picks: p.picks.map((k) => ({ id: d2c(k.element), pos: k.position, pts: dlivePts(g, k.element) })), subs: (p.subs || []).length }); }
const rivalsNow = {}; det.league_entries.forEach((e) => { const p = J(`d_rival_${e.entry_id}_${liveEv.id}.json`); if (p && p.picks) rivalsNow[e.entry_name] = p.picks.map((k) => ({ id: d2c(k.element), pos: k.position })); });
const myName = (lidByEntry[ME.draft] || {}).entry_name || "Yoh-Nited";
const tx = dtx.slice(-40).map((t) => ({ at: t.added, gw: t.event, who: (lidByEntry[t.entry] || {}).entry_name || String(t.entry), in: d2c(t.element_in), out: d2c(t.element_out), kind: t.kind, ok: t.result === "a" }));
const drafts = (det.league.drafts || []).map((d) => ({ at: d.draft_dt, fromGw: d.event, done: !!d.draft_completed, order: d.order_method }));
const redraft = drafts.find((d) => !d.done) || null;
const draft = { entry: ME.draft, league: { id: det.league.id, name: det.league.name, scoring: det.league.scoring, trades: det.league.trades, mode: det.league.transaction_mode, drafts, redraft }, me: myName,
  entries: dEntries, standings: dStand, matches: dMatches, rosters, myGws: myDraftGws, rivalsNow, tx, waiversProcessed: !!dgame.waivers_processed, gameCurrent: dgame.current_event, gameFinished: !!dgame.current_event_finished, events: dEvents, scoring: db.settings.scoring };

/* audit trail: selling prices read off the Transfers page at 18:33 SAST on 18 September. The app now works them out itself; QA checks the formula against these. */
const SCREEN = { at: "2026-09-18T16:33:00Z", ft: 4, bank: 0.0, wildcard: true, freehit: true,
  sell: { "Verbruggen|BHA": 4.5, "Kinsky|TOT": 4.5, "Gabriel|ARS": 8.0, "Konsa|ARS": 4.5, "van Ewijk|COV": 4.0, "Diop|IPS": 4.0, "Shaw|MUN": 4.4, "Saka|ARS": 9.5, "Rogers|CHE": 7.6, "Hughes|CRY": 4.4, "Szoboszlai|LIV": 7.0, "Semenyo|MCI": 8.4, "João Pedro|CHE": 7.6, "Haaland|MCI": 15.5, "Brobbey|SUN": 5.8 } };
const DATA = { asOf, screen: SCREEN, gw: { live: liveEv.id, next: nextEv.id, lastDone: lastDone.id, events, withData: gwsWithData }, teams, fixtures, players, teamSeason, classic, draft, intel: INTEL,
  rules: { maxFt, clubLimit: b.game_settings.squad_team_limit || 3, chipStop: 19 } };
fs.mkdirSync("../app", { recursive: true });
fs.writeFileSync("../app/data.json", JSON.stringify(DATA));
console.log(`baked ${asOf} · live GW${liveEv.id} · next GW${nextEv.id} (deadline ${nextEv.dl}) · ${players.length} players · ${fixtures.length} fixtures · classic picks for GW ${Object.keys(picks).join(",")} · FT into GW${nextEv.id}: ${ft} · draft rosters ${Object.keys(rosters).length} · my draft elevens ${myDraftGws.map((x) => x.gw).join(",")} · rivals' elevens now ${Object.keys(rivalsNow).length} · leagues with tables ${leagues.filter((l) => l.top).length} · ${(fs.statSync("../app/data.json").size / 1024).toFixed(0)} kB`);

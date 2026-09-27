#!/usr/bin/env node
/* pipeline/bake.js — reads the feeds pipeline/pull.sh fetched and writes the single data block
   Mission Control ships with (v110 §5 A2, A4, A5, A6, A7). Ported from the v111 kit's live/bake.js
   with its logic as it stands: the code join across the two id spaces, selling prices, the points
   reconciliation, the free-transfer ledger, the transfer log, team season xG logs, the Draft block
   with waiver runs and activity, league tables, the derived chipStop and the tolerant manager field.
   Nothing here is typed by hand except INTEL, which lives in pipeline/intel.js and carries dated
   desk research the feeds cannot see. Rival managers' personal names never reach the output: only
   entry ids, team names and picks are read off the Draft and league feeds (v110 §1.5).

     node pipeline/bake.js [--feeds <dir>] [--out <file>] [--prev <file>|none] [--intel <file>]

   --feeds  the pulled feeds (default pipeline/feeds)
   --out    the block to write (default data/mc_data.json); nothing else is written
   --prev   the previous block for the "since last build" delta (default: the existing --out file;
            `none` means there is no previous block, so the delta is empty)
   --intel  pipeline/intel.js by default; a .json path means "use that file's intel key", which is
            how qa/bake.cjs bakes the reference feeds with the reference block's own INTEL

   Proved by qa/bake.cjs: on reference/v109/live with the reference INTEL and no previous block it
   reproduces reference/v109/app/data.json path for path. */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULTS = {
  feeds: path.join(ROOT, "pipeline", "feeds"),
  out: path.join(ROOT, "data", "mc_data.json"),
  intel: path.join(ROOT, "pipeline", "intel.js"),
  prev: null,                                                        // null → the existing --out file; "none" → nothing
};
function parseArgs(argv) {
  const o = Object.assign({}, DEFAULTS);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === "--feeds") { o.feeds = path.resolve(v); i++; }
    else if (a === "--out") { o.out = path.resolve(v); i++; }
    else if (a === "--prev") { o.prev = v === "none" ? "none" : path.resolve(v); i++; }
    else if (a === "--intel") { o.intel = path.resolve(v); i++; }
    else throw new Error("bake.js: unknown argument " + a);
  }
  return o;
}
/* The INTEL block: a module exporting it, or a .json file whose `intel` key holds it. */
function loadIntel(p) {
  if (/\.json$/i.test(p)) {
    const doc = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!doc || typeof doc.intel !== "object" || doc.intel === null) throw new Error("bake.js: " + p + " carries no intel key");
    return doc.intel;
  }
  return require(p);
}

/* Free transfers (v110 §4 Classic, Part N1): one arrives after every deadline from gameweek 1, capped
   at 1 + max_extra_free_transfers; transfers spend them. A wildcard or free hit week keeps the count
   exactly as it was: nothing spent, and no extra one added (Fantasy Football Scout, 20 Jul 2026).
   `classicGws` are the published weeks {gw, tx, chip}; `nextGw` is the gameweek whose deadline is
   next; the count returned is what is in hand for that deadline. ftSure is false until the gameweek
   in play has published its picks, because until then this week's spend is unknown. Exported so
   qa/bake.cjs proves the rule on the code the bake runs. */
function ftLedger(classicGws, nextGw, maxFt) {
  let ft = 1; let ftKnownThrough = 1;                                // ft = free transfers in hand for gameweek 2's deadline
  for (let g = 2; g < nextGw; g++) {                                 // roll forward through every deadline that has passed
    const w = classicGws.find((x) => x.gw === g);
    const chip = w && (w.chip === "wildcard" || w.chip === "freehit");
    const used = w && !chip ? Math.min(ft, w.tx || 0) : 0;
    if (w) ftKnownThrough = g;
    ft = chip ? ft : Math.min(maxFt, ft - used + 1);
  }
  return { ft, ftKnownThrough, ftSure: ftKnownThrough >= nextGw - 1 };
}

function bake(opts) {
  const feeds = opts.feeds, out = opts.out;
  const J = (f) => { try { return JSON.parse(fs.readFileSync(path.join(feeds, f), "utf8")); } catch (e) { return null; } };
  const has = (f) => fs.existsSync(path.join(feeds, f));
  const r2 = (x) => Math.round(x * 100) / 100;

  const ME = { classic: 3546875, draft: 279275, league: 46148 };
  const b = J("bootstrap.json"), fxAll = J("fixtures.json"), db = J("dbootstrap.json");
  const det = J("d_details.json"), es = J("d_status.json").element_status, dtx = (J("d_tx.json") || {}).transactions || [];
  const entry = J("entry.json"), hist = J("history.json"), dgame = J("d_game.json") || {};
  const asOf = new Date().toISOString();
  const INTEL = loadIntel(opts.intel);

  /* ── gameweeks ─────────────────────────────────────────────────────────── */
  const now = Date.now();
  const events = b.events.map((e) => ({ id: e.id, dl: e.deadline_time, fin: !!e.finished, avg: e.average_entry_score || 0, hi: e.highest_score || 0 }));
  const nextEv = events.find((e) => new Date(e.dl).getTime() > now) || events[events.length - 1];
  const liveEv = [...events].reverse().find((e) => new Date(e.dl).getTime() <= now) || events[0];   // the gameweek whose deadline has passed most recently
  const lastDone = [...events].reverse().find((e) => e.fin) || { id: 0 };
  const dEvents = {}; db.events.data.forEach((e) => { dEvents[e.id] = { dl: e.deadline_time, wv: e.waivers_time, tr: e.trades_time || null }; });

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

  const retDate = (news) => { const m = /(?:Expected back|until)\s+(\d{1,2})\s+([A-Za-z]{3})/.exec(news || ""); if (!m) return null;
    const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(m[2]); if (mon < 0) return null;
    const y = mon >= 7 ? 2026 : 2027; return new Date(Date.UTC(y, mon, +m[1])).toISOString().slice(0, 10); };

  const players = b.elements.map((e) => {
    const d = dByCode[e.code]; const h = histById[e.id] || null;
    const o = { id: e.id, n: e.web_name, fn: `${e.first_name} ${e.second_name}`.trim(), t: TS[e.team], p: e.element_type, pr: e.now_cost / 10,
      st: e.status, cop: e.chance_of_playing_next_round, cpt: e.chance_of_playing_this_round, pts: e.total_points, mins: e.minutes, stt: e.starts, g: e.goals_scored, a: e.assists, cs: e.clean_sheets, gc: e.goals_conceded,
      xg: r2(+e.expected_goals), xa: r2(+e.expected_assists), xgc: r2(+e.expected_goals_conceded), bps: e.bps, bon: e.bonus, dc: e.defensive_contribution, sv: e.saves, yc: e.yellow_cards, rc: e.red_cards,
      own: +e.selected_by_percent, cs0: e.cost_change_start, press: Math.round(1000 * (e.transfers_in_event - e.transfers_out_event) / Math.max(5000, (+e.selected_by_percent) / 100 * b.total_players)) / 1000, tin: e.transfers_in_event, tout: e.transfers_out_event, form: +e.form, epn: +e.ep_next || 0, cc: e.cost_change_event || 0 };
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
  /* the free-transfer ledger (ftLedger above): the cap is read from bootstrap, never typed */
  const maxFt = 1 + (b.game_settings.max_extra_free_transfers || 4);
  const ledger = ftLedger(classicGws, nextEv.id, maxFt);
  const ft = ledger.ft, ftSure = ledger.ftSure;                     // false until the gameweek in play publishes its picks
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
  // The first chip set's expiry is the earliest stop_event the game publishes. Typing 19 here froze a
  // season rule into the data and out into the copy; read it instead.
  const chipStop = chipWindows.length ? Math.min(...chipWindows.map((c) => c.to)) : 38;
  const classic = { entry: ME.classic, name: entry.name, mgr: [entry.player_first_name, entry.player_last_name].filter(Boolean).join(" ") || entry.name, total: entry.summary_overall_points, rank: entry.summary_overall_rank, players: b.total_players,
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
  /* the re-draft is READ from league.drafts (v110 §4 Draft, §7.12): the unfinished draft's event is the first gameweek of the new rosters */
  const drafts = (det.league.drafts || []).map((d) => ({ at: d.draft_dt, fromGw: d.event, done: !!d.draft_completed, order: d.order_method }));
  /* how active each manager is on the waiver wire, from the whole log: runs seen, runs with a claim, claims lodged, claims won */
  const wRuns = [...new Set(dtx.filter((t) => t.kind === "w").map((t) => t.event))].sort((a, c) => a - c), activity = {};
  det.league_entries.forEach((e) => { const mine = dtx.filter((t) => t.kind === "w" && t.entry === e.entry_id);
    activity[e.entry_name] = { runs: wRuns.length, active: new Set(mine.map((t) => t.event)).size, claims: mine.length, won: mine.filter((t) => t.result === "a").length,
      free: dtx.filter((t) => t.kind === "f" && t.entry === e.entry_id).length }; });
  const redraft = drafts.find((d) => !d.done) || null;
  const draft = { entry: ME.draft, league: { id: det.league.id, name: det.league.name, scoring: det.league.scoring, trades: det.league.trades, mode: det.league.transaction_mode, drafts, redraft }, me: myName,
    entries: dEntries, standings: dStand, matches: dMatches, rosters, myGws: myDraftGws, rivalsNow, tx, activity, waiverRuns: wRuns, waiversProcessed: !!dgame.waivers_processed, gameCurrent: dgame.current_event, gameFinished: !!dgame.current_event_finished, events: dEvents, scoring: db.settings.scoring };

  /* audit trail: selling prices read off the Transfers page at 18:33 SAST on 18 September. The app now works them out itself; QA checks the formula against these. */
  const SCREEN = { at: "2026-09-18T16:33:00Z", ft: 4, bank: 0.0, wildcard: true, freehit: true,
    sell: { "Verbruggen|BHA": 4.5, "Kinsky|TOT": 4.5, "Gabriel|ARS": 8.0, "Konsa|ARS": 4.5, "van Ewijk|COV": 4.0, "Diop|IPS": 4.0, "Shaw|MUN": 4.4, "Saka|ARS": 9.5, "Rogers|CHE": 7.6, "Hughes|CRY": 4.4, "Szoboszlai|LIV": 7.0, "Semenyo|MCI": 8.4, "João Pedro|CHE": 7.6, "Haaland|MCI": 15.5, "Brobbey|SUN": 5.8 } };
  /* what moved since the previous bake, for the "since last build" line */
  const prevPath = opts.prev === "none" ? null : (opts.prev || out);
  const PREV = prevPath ? (() => { try { return JSON.parse(fs.readFileSync(prevPath, "utf8")); } catch (e) { return null; } })() : null;
  const delta = { since: PREV ? PREV.asOf : null, prices: [], flags: [] };
  if (PREV) { const pv = {}; PREV.players.forEach((p) => { pv[p.id] = p; });
    players.forEach((p) => { const q = pv[p.id]; if (!q) return;
      if (q.pr !== p.pr) delta.prices.push({ id: p.id, from: q.pr, to: p.pr });
      if (q.st !== p.st || q.cop !== p.cop || (q.news || "") !== (p.news || "")) delta.flags.push({ id: p.id, from: q.st + (q.cop != null ? " " + q.cop + "%" : ""), to: p.st + (p.cop != null ? " " + p.cop + "%" : ""), news: p.news || "" }); }); }
  const DATA = { asOf, delta, screen: SCREEN, gw: { live: liveEv.id, next: nextEv.id, lastDone: lastDone.id, events, withData: gwsWithData }, teams, fixtures, players, teamSeason, classic, draft, intel: INTEL,
    rules: { maxFt, clubLimit: b.game_settings.squad_team_limit || 3, chipStop } };
  const json = JSON.stringify(DATA);
  const line = `baked ${asOf} · live GW${liveEv.id} · next GW${nextEv.id} (deadline ${nextEv.dl}) · ${players.length} players · ${fixtures.length} fixtures · classic picks for GW ${Object.keys(picks).join(",")} · FT into GW${nextEv.id}: ${ft} · draft rosters ${Object.keys(rosters).length} · my draft elevens ${myDraftGws.map((x) => x.gw).join(",")} · rivals' elevens now ${Object.keys(rivalsNow).length} · leagues with tables ${leagues.filter((l) => l.top).length} · ${(Buffer.byteLength(json) / 1024).toFixed(0)} kB`;
  return { DATA, json, line, out };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const r = bake(opts);
  fs.mkdirSync(path.dirname(r.out), { recursive: true });
  fs.writeFileSync(r.out, r.json);                                   // the one file this script writes
  console.log(r.line);
}

module.exports = { DEFAULTS, parseArgs, loadIntel, ftLedger, bake };
if (require.main === module) main();

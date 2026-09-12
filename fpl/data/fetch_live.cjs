#!/usr/bin/env node
/*
 * fetch_live.cjs — pulls the public FPL classic + draft APIs into data/live.json
 * in the exact CONTRACT.md §3 shape. Node 22, global fetch, no dependencies.
 *
 *   node data/fetch_live.cjs                 network build
 *   node data/fetch_live.cjs --draft-league X  also pull the draft league X: its teams,
 *                                            ownership, rosters, free agents, fixtures
 *                                            and table. X may be a league id, a draft
 *                                            entry id, or the address of either — a bare
 *                                            number is tried as a league first, then as
 *                                            an entry. Without it the draft block keeps
 *                                            today's shape with every league field empty.
 *   node data/fetch_live.cjs --offline DIR   same code path, but every URL is
 *                                            answered from a snapshot folder:
 *                                            bootstrap.json fixtures_all.json live{gw}.json
 *                                            entry.json history.json picks{gw}.json
 *                                            leagues/{id}.json (page 1) rivals/{entry}.json
 *                                            draft_bootstrap.json draft_game.json
 *   node data/fetch_live.cjs --out PATH      write somewhere other than data/live.json
 *
 * Rules honoured here (CLAUDE.md A2, D1, D4; CONTRACT §3):
 *  - ep_this / ep_next are never read and never written (the output is grepped for "ep_").
 *  - Nothing account-touching is called (no /my-team/, /transfers/, no login).
 *  - The deadline is never hard-coded: next_event / deadline come from events[].is_next.
 *  - Numeric strings become numbers; prices stay in tenths (integers).
 *  - Polite: at most 6 requests in flight, 3 retries with backoff on 429 / 5xx / network.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const ENGINE = require("../src/engine.js");                 // draftLeagueInput: one parser, not two
const { shapeDraftLeague, emptyDraftLeague } = require("./draft_league.cjs");

const ENTRY = 3546875;
const CLASSIC = "https://fantasy.premierleague.com/api";
const DRAFT = "https://draft.premierleague.com/api";
// The six winnable leagues (CONTRACT §3, T0 from entry/3546875 on 11 Sep 2026).
const LEAGUE_IDS = [1314671, 1683215, 26474, 512557, 989793, 512550];
const MAX_FT = 5;            // free transfers bank to 5 (max_extra_free_transfers 4)
const CONCURRENCY = 6;
const RETRIES = 3;

// ---------------------------------------------------------------- CLI
const argv = process.argv.slice(2);
function argOf(flag) { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; }
const OFFLINE_DIR = argOf("--offline");
const OUT = argOf("--out") || path.join(__dirname, "live.json");
const STATE_PATH = argOf("--state") || path.join(__dirname, "..", "state", "kwezi.json");

// The draft league id: the command line first, then state/kwezi.json. Never invented — when
// neither carries one the draft block ships with every league field empty and the app says so.
function savedDraft() {
  try {
    const st = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const d = st && st.draft && typeof st.draft === "object" ? st.draft : {};
    return { league_id: d.league_id || null, entry_id: d.entry_id || null, input: typeof d.league_input === "string" ? d.league_input : null };
  } catch (e) { return { league_id: null, entry_id: null, input: null }; }
}
const SAVED = savedDraft();
const DRAFT_INPUT = argOf("--draft-league") || SAVED.input || (SAVED.league_id ? String(SAVED.league_id) : null);
const DRAFT_ENTRY_ARG = argOf("--draft-entry") || (SAVED.entry_id ? String(SAVED.entry_id) : null);
const MANAGER_NAME = { first: "Kwezi", last: "Ngwevu" };

// ---------------------------------------------------------------- transport
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Offline: map a URL to a snapshot file. Same getJSON() code path as the network.
function offlineFile(url) {
  const u = new URL(url);
  const p = u.pathname.replace(/\/+$/, "");
  let m;
  if (u.host === "draft.premierleague.com") {
    if (p === "/api/bootstrap-static") return "draft_bootstrap.json";
    if (p === "/api/game") return "draft_game.json";
    if ((m = p.match(/^\/api\/league\/(\d+)\/details$/))) return `league_${m[1]}_details.json`;
    if ((m = p.match(/^\/api\/league\/(\d+)\/element-status$/))) return `league_${m[1]}_status.json`;
    if ((m = p.match(/^\/api\/entry\/(\d+)\/public$/))) return `entry_${m[1]}_public.json`;
    if ((m = p.match(/^\/api\/entry\/(\d+)\/event\/(\d+)$/))) return `entry_${m[1]}_event_${m[2]}.json`;
  } else {
    if (p === "/api/bootstrap-static") return "bootstrap.json";
    if (p === "/api/fixtures") return "fixtures_all.json";
    if ((m = p.match(/^\/api\/event\/(\d+)\/live$/))) return `live${m[1]}.json`;
    if (p === `/api/entry/${ENTRY}`) return "entry.json";
    if (p === `/api/entry/${ENTRY}/history`) return "history.json";
    if ((m = p.match(/^\/api\/entry\/(\d+)\/event\/(\d+)\/picks$/))) {
      return Number(m[1]) === ENTRY ? `picks${m[2]}.json` : path.join("rivals", `${m[1]}.json`);
    }
    if ((m = p.match(/^\/api\/leagues-classic\/(\d+)\/standings$/))) {
      const page = Number(u.searchParams.get("page_standings") || 1);
      if (page !== 1) throw new Error(`offline snapshot has only page 1 of league ${m[1]}`);
      return path.join("leagues", `${m[1]}.json`);
    }
  }
  throw new Error(`no offline mapping for ${url}`);
}

async function getJSON(url) {
  if (OFFLINE_DIR) {
    const f = path.join(OFFLINE_DIR, offlineFile(url));
    return JSON.parse(fs.readFileSync(f, "utf8"));
  }
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt) await sleep(600 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "fpl-mission-control/87 (data refresh; node 22)", accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status >= 500) { lastErr = new Error(`HTTP ${res.status} ${url}`); continue; }
      if (!res.ok) { const e = new Error(`HTTP ${res.status} ${url}`); e.status = res.status; throw e; }
      return await res.json();
    } catch (e) {
      if (e.status && e.status < 500 && e.status !== 429) throw e;   // 4xx other than 429: do not retry
      lastErr = e;
    }
  }
  throw lastErr;
}

// Small pool: run tasks with at most CONCURRENCY in flight, preserving order of results.
async function pool(items, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) { const i = next++; out[i] = await worker(items[i], i); }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, lane));
  return out;
}

// ---------------------------------------------------------------- helpers
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const r2 = (x) => Math.round(x * 100) / 100;

function shapeElement(e) {
  return {
    id: e.id, code: e.code, web_name: e.web_name, team: e.team, element_type: e.element_type,
    now_cost: e.now_cost, cost_change_event: e.cost_change_event, cost_change_start: e.cost_change_start,
    selected_by_percent: num(e.selected_by_percent), status: e.status, news: e.news || "",
    chance: e.chance_of_playing_next_round === null || e.chance_of_playing_next_round === undefined ? null : Number(e.chance_of_playing_next_round),
    total_points: e.total_points, minutes: e.minutes, starts: e.starts,
    xg: num(e.expected_goals), xa: num(e.expected_assists), xgc: num(e.expected_goals_conceded),
    dc: e.defensive_contribution, bps: e.bps, ict: num(e.ict_index), form: num(e.form),
    goals: e.goals_scored, assists: e.assists, cs: e.clean_sheets, gc: e.goals_conceded,
    bonus: e.bonus, yc: e.yellow_cards, rc: e.red_cards, og: e.own_goals,
    pen_miss: e.penalties_missed, pen_save: e.penalties_saved, saves: e.saves,
    transfers_in_event: e.transfers_in_event, transfers_out_event: e.transfers_out_event,
  };
}

// Fixed 20-slot order (CONTRACT §3):
// [min,starts,pts,xg,xa,xgc,dc,bps,ict,goals,assists,cs,gc,bonus,yc,rc,og,pen_miss,pen_save,saves]
function gwRow(s) {
  return [
    s.minutes, s.starts, s.total_points, num(s.expected_goals), num(s.expected_assists), num(s.expected_goals_conceded),
    s.defensive_contribution, s.bps, num(s.ict_index), s.goals_scored, s.assists, s.clean_sheets, s.goals_conceded,
    s.bonus, s.yellow_cards, s.red_cards, s.own_goals, s.penalties_missed, s.penalties_saved, s.saves,
  ];
}

// Per-fixture team xG = Σ player expected_goals attributed to the fixture(s) in the
// player's "explain" blocks. The live stats are per-GW, so in a double gameweek a
// player's xG is split across his fixtures in proportion to the minutes each explain
// block reports (single-fixture weeks: the whole figure goes to that fixture).
// A player's side is read from the fixture's own stats blocks first (the bps block lists
// everyone who played), so a player who has since changed clubs (Konsa AVL→ARS, N.Jackson
// CHE→AVL) is credited to the club he played for that week; the current bootstrap team is
// only the fallback.
function fixtureXg(liveElements, fixtureById, teamOf, sideByFixture) {
  const out = {};
  for (const el of liveElements) {
    const xg = num(el.stats && el.stats.expected_goals) || 0;
    const ex = Array.isArray(el.explain) ? el.explain : [];
    if (!xg || !ex.length) continue;
    const mins = ex.map((b) => { const m = (b.stats || []).find((s) => s.identifier === "minutes"); return m ? Number(m.value) || 0 : 0; });
    const tot = mins.reduce((a, b) => a + b, 0);
    ex.forEach((b, i) => {
      const fx = fixtureById.get(b.fixture);
      if (!fx) return;
      const share = ex.length === 1 ? 1 : tot > 0 ? mins[i] / tot : 1 / ex.length;
      const known = sideByFixture.get(fx.id);
      let side = known ? known.get(el.id) || null : null;
      if (!side) { const team = teamOf.get(el.id); side = team === fx.team_h ? "h" : team === fx.team_a ? "a" : null; }
      if (!side) return;
      const key = String(fx.id);
      out[key] = out[key] || { h: 0, a: 0 };
      out[key][side] += xg * share;
    });
  }
  for (const k of Object.keys(out)) { out[k].h = r2(out[k].h); out[k].a = r2(out[k].a); }
  return out;
}

// ft_available — derivation (CLAUDE.md B2; CONTRACT §3):
//   GW1 has unlimited transfers and is excluded. Entering GW2 the manager holds 1 FT.
//   Each later GW adds 1, capped at MAX_FT (5). Transfers made in a GW consume FTs
//   first (min(event_transfers, held)); anything beyond that was a paid hit and does
//   not reduce the bank further. On a wildcard / free-hit GW the transfers are free
//   and the held count carries through untouched. The value returned is what is
//   available for the event AFTER the last one in history.current (the next deadline).
//   Kwezi 11 Sep 2026: GW2 1 (0 used) → GW3 2 (0 used) → GW4 3.
function deriveFt(history) {
  const rows = [...(history.current || [])].sort((a, b) => a.event - b.event);
  const chipAt = new Map((history.chips || []).map((c) => [c.event, c.name]));
  let held = 1;                                   // available at GW2
  for (const row of rows) {
    if (row.event < 2) continue;
    const chip = chipAt.get(row.event);
    const free = chip === "wildcard" || chip === "freehit" ? 0 : Math.min(Number(row.event_transfers) || 0, held);
    held = Math.min(MAX_FT, held - free + 1);     // roll into the next event
  }
  return held;
}

// ---------------------------------------------------------------- main
async function main() {
  const fetched_at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const warnings = [];

  const [bootstrap, fixturesRaw, entry, history, draftBoot, draftGame] = await Promise.all([
    getJSON(`${CLASSIC}/bootstrap-static/`),
    getJSON(`${CLASSIC}/fixtures/`),
    getJSON(`${CLASSIC}/entry/${ENTRY}/`),
    getJSON(`${CLASSIC}/entry/${ENTRY}/history/`),
    getJSON(`${DRAFT}/bootstrap-static`),
    getJSON(`${DRAFT}/game`),
  ]);

  const events = bootstrap.events.map((e) => ({
    id: e.id, name: e.name, deadline_time: e.deadline_time, is_current: !!e.is_current, is_next: !!e.is_next,
    finished: !!e.finished, average_entry_score: e.average_entry_score,
  }));
  const nextEv = events.find((e) => e.is_next) || null;
  const curEv = events.find((e) => e.is_current) || null;
  const next_event = nextEv ? nextEv.id : null;
  const current_event = curEv ? curEv.id : (entry.current_event || null);
  const finishedIds = events.filter((e) => e.finished).map((e) => e.id);

  const teams = bootstrap.teams.map((t) => ({ id: t.id, short_name: t.short_name, name: t.name }));
  const elements = bootstrap.elements.map(shapeElement);
  const teamOf = new Map(bootstrap.elements.map((e) => [e.id, e.team]));

  const fixtures = fixturesRaw.map((f) => ({
    id: f.id, event: f.event, team_h: f.team_h, team_a: f.team_a,
    team_h_difficulty: f.team_h_difficulty, team_a_difficulty: f.team_a_difficulty,
    finished: !!f.finished, started: !!f.started, kickoff_time: f.kickoff_time,
    team_h_score: f.team_h_score, team_a_score: f.team_a_score,
  }));
  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  // element -> "h"|"a" per fixture, from the fixture stats blocks (goals, bps, ...)
  const sideByFixture = new Map();
  for (const f of fixturesRaw) {
    const m = new Map();
    for (const blk of f.stats || []) {
      for (const x of blk.h || []) m.set(x.element, "h");
      for (const x of blk.a || []) m.set(x.element, "a");
    }
    if (m.size) sideByFixture.set(f.id, m);
  }

  // Finished GWs: event/{gw}/live/
  const gw = {};
  const lives = await pool(finishedIds, (id) => getJSON(`${CLASSIC}/event/${id}/live/`));
  finishedIds.forEach((id, i) => {
    const els = {};
    for (const el of lives[i].elements) {
      if (!el.stats || !(Number(el.stats.minutes) > 0)) continue;   // 0-minute players omitted
      els[String(el.id)] = gwRow(el.stats);
    }
    gw[String(id)] = { elements: els, fixture_xg: fixtureXg(lives[i].elements, fixtureById, teamOf, sideByFixture) };
  });

  // Kwezi's picks GW1..current
  const pickGws = [];
  for (let g = 1; g <= (current_event || 0); g++) pickGws.push(g);
  const pickRaw = await pool(pickGws, (g) => getJSON(`${CLASSIC}/entry/${ENTRY}/event/${g}/picks/`));
  const picks = {};
  pickGws.forEach((g, i) => {
    picks[String(g)] = {
      active_chip: pickRaw[i].active_chip === undefined ? null : pickRaw[i].active_chip,
      picks: pickRaw[i].picks.map((p) => ({ element: p.element, position: p.position, multiplier: p.multiplier, is_captain: !!p.is_captain, is_vice_captain: !!p.is_vice_captain })),
    };
  });

  // Leagues: follow has_next paging
  const leagues = [];
  const rivalIds = new Set();
  for (const id of LEAGUE_IDS) {
    let page = 1, name = null, results = [];
    for (;;) {
      const L = await getJSON(`${CLASSIC}/leagues-classic/${id}/standings/?page_standings=${page}`);
      name = name || (L.league && L.league.name) || String(id);
      results = results.concat(L.standings.results);
      if (!L.standings.has_next) break;
      page++;
      if (page > 50) { warnings.push(`league ${id}: stopped paging at 50`); break; }
    }
    const me = results.find((r) => r.entry === ENTRY);
    leagues.push({
      id, name, size: results.length,
      rank: me ? me.rank : null, last_rank: me ? me.last_rank : null,
      standings: results.map((r) => ({ entry: r.entry, player_name: r.player_name, entry_name: r.entry_name, total: r.total, rank: r.rank })),
    });
    for (const r of results) if (r.entry !== ENTRY) rivalIds.add(r.entry);
  }

  // Rivals' picks for the current (last finished) event
  const rivals = {};
  const rivalList = [...rivalIds].sort((a, b) => a - b);
  const rivalRaw = await pool(rivalList, async (rid) => {
    try { return await getJSON(`${CLASSIC}/entry/${rid}/event/${current_event}/picks/`); }
    catch (e) { warnings.push(`rival ${rid}: ${e.message}`); return null; }
  });
  rivalList.forEach((rid, i) => {
    const R = rivalRaw[i];
    if (!R || !Array.isArray(R.picks)) return;
    rivals[String(rid)] = {
      event: current_event,
      picks: R.picks.map((p) => ({ element: p.element, is_captain: !!p.is_captain, multiplier: p.multiplier, position: p.position })),
    };
  });

  // Draft: ids differ from classic for some players — carry code, and map team via team code
  const teamIdByCode = new Map(bootstrap.teams.map((t) => [t.code, t.id]));
  const draftTeamCode = new Map((draftBoot.teams || []).map((t) => [t.id, t.code]));
  const draftEvents = ((draftBoot.events && draftBoot.events.data) || []).map((e) => ({
    id: e.id, deadline_time: e.deadline_time, waivers_time: e.waivers_time, trades_time: e.trades_time,
  }));
  const draft = {
    game: { current_event: draftGame.current_event, next_event: draftGame.next_event, waivers_processed: !!draftGame.waivers_processed },
    events: draftEvents,
    scoring: draftBoot.settings.scoring,
    squad: draftBoot.settings.squad,
    elements: draftBoot.elements.map((e) => ({
      id: e.id, code: e.code, web_name: e.web_name,
      team: teamIdByCode.get(draftTeamCode.get(e.team)) ?? e.team,
      element_type: e.element_type, status: e.status,
      chance: e.chance_of_playing_next_round === null || e.chance_of_playing_next_round === undefined ? null : Number(e.chance_of_playing_next_round),
      news: e.news || "", starts: e.starts, minutes: e.minutes, total_points: e.total_points,
    })),
    league_id: null,   // unknown until the manager supplies the draft league URL
  };
  Object.assign(draft, emptyDraftLeague());

  // ---------------------------------------------------------------- draft league (optional)
  const draftGw = Number(draftGame.current_event) || Number(current_event) || 0;
  if (DRAFT_INPUT) {
    const parsed = ENGINE.draftLeagueInput(DRAFT_INPUT);
    if (!parsed.ok) {
      warnings.push(`draft league "${DRAFT_INPUT}": ${parsed.note}`);
    } else {
      const tryLeague = async (id) => {
        try { return await getJSON(`${DRAFT}/league/${id}/details`); }
        catch (e) { return null; }
      };
      const viaEntry = async (id) => {
        try {
          const pub = await getJSON(`${DRAFT}/entry/${id}/public`);
          const set = (pub && pub.entry && Array.isArray(pub.entry.league_set)) ? pub.entry.league_set : [];
          return set.length ? Number(set[0]) : null;
        } catch (e) { return null; }
      };
      let leagueId = null, details = null, meEntryId = Number(DRAFT_ENTRY_ARG) || null, how = "";
      if (parsed.kind !== "entry") {
        details = await tryLeague(parsed.id);
        if (details) { leagueId = parsed.id; how = "league id"; }
      }
      if (!details) {
        const lid = await viaEntry(parsed.id);
        if (lid) {
          details = await tryLeague(lid);
          if (details) { leagueId = lid; meEntryId = meEntryId || parsed.id; how = "entry id " + parsed.id + " → league " + lid; }
        }
      }
      if (!details) {
        warnings.push(`draft league "${DRAFT_INPUT}": neither league/${parsed.id}/details nor entry/${parsed.id}/public answered`);
      } else {
        const status = await getJSON(`${DRAFT}/league/${leagueId}/element-status`);
        const entryIds = (details.league_entries || []).map((e) => e.entry_id).filter((x) => x !== null && x !== undefined);
        const picksRaw = draftGw ? await pool(entryIds, async (eid) => {
          try { return await getJSON(`${DRAFT}/entry/${eid}/event/${draftGw}`); }
          catch (e) { warnings.push(`draft entry ${eid} event ${draftGw}: ${e.message}`); return null; }
        }) : [];
        const picks = {};
        entryIds.forEach((eid, i) => { if (picksRaw[i]) picks[String(eid)] = picksRaw[i]; });
        const block = shapeDraftLeague({
          details, status, picks, elements: draft.elements, leagueId,
          meEntryId, meName: MANAGER_NAME, event: draftGw,
        });
        Object.assign(draft, block);
        draft.league_id = leagueId;
        console.error(`draft league ${leagueId} "${draft.league.name}" via ${how}: ` +
          `${block.counts.entries} teams, ${block.counts.owned} owned, ${block.counts.freeAgents} free agents` +
          `${block.unjoined ? `, ${block.unjoined} draft element(s) not in the bootstrap` : ""}` +
          `${block.me ? `, your team is league entry ${block.me.leagueEntryId} (${block.me.via})` : ", your own team was not identified"}`);
      }
    }
  }

  const out = {
    fetched_at,
    source: "fantasy.premierleague.com/api + draft.premierleague.com/api",
    next_event, current_event, total_players: bootstrap.total_players,
    events, teams, elements, fixtures, gw,
    entry: {
      id: entry.id, name: entry.name,
      summary_overall_points: entry.summary_overall_points, summary_overall_rank: entry.summary_overall_rank,
      summary_event_points: entry.summary_event_points, current_event: entry.current_event,
      last_deadline_bank: entry.last_deadline_bank, last_deadline_value: entry.last_deadline_value,
      last_deadline_total_transfers: entry.last_deadline_total_transfers,
    },
    history: {
      current: (history.current || []).map((h) => ({
        event: h.event, points: h.points, total_points: h.total_points, rank: h.rank, overall_rank: h.overall_rank,
        bank: h.bank, value: h.value, event_transfers: h.event_transfers, event_transfers_cost: h.event_transfers_cost,
        points_on_bench: h.points_on_bench,
      })),
      chips: (history.chips || []).map((c) => ({ name: c.name, event: c.event })),
    },
    picks,
    ft_available: deriveFt(history),
    leagues, rivals, draft,
  };

  const text = JSON.stringify(out);
  if (text.includes("ep_")) {
    // Banned-field invariant: refuse to write rather than ship a file that fails verify.sh.
    const at = text.indexOf("ep_");
    throw new Error(`output contains "ep_" near: ${text.slice(Math.max(0, at - 60), at + 40)}`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);

  for (const w of warnings) console.error(`warn: ${w}`);
  console.log(
    `live.json: ${teams.length} teams, ${elements.length} elements, ${fixtures.length} fixtures, gw ${Object.keys(gw).join("/")}, ` +
    `picks GW1-${pickGws.length}, ${leagues.length} leagues, ${Object.keys(rivals).length} rivals, ${draft.elements.length} draft elements, ` +
    `draft league ${draft.league_id === null ? "none" : draft.league_id + " (" + draft.counts.entries + " teams, " + draft.counts.freeAgents + " free agents)"}, ` +
    `ft ${out.ft_available} | fetched_at ${fetched_at} | next_event ${next_event} | deadline ${nextEv ? nextEv.deadline_time : "n/a"} | ` +
    `${Buffer.byteLength(text)} bytes -> ${path.relative(process.cwd(), OUT)}${OFFLINE_DIR ? " (offline)" : ""}`
  );
}

main().catch((e) => { console.error(`fetch_live failed: ${e.message}`); process.exit(1); });

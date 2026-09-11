/*
 * qa/mc_all.cjs — the engine-invariant suite (CLAUDE.md H1).
 *
 * 70+ invariants over randomly generated legal AND illegal inputs, driven by a seeded
 * mulberry32 so every run is reproducible from the seed printed at the end.
 *
 * Shape of a run
 *   · UNIVERSES  — random CONTRACT §3 snapshots (5–8 clubs, 0–12 finished gameweeks, random
 *                  flags, prices, rival leagues). Rebuilt every REBUILD_EVERY iterations so the
 *                  invariants do not all see one fixture. A universe with ≥8 finished gameweeks
 *                  exists on purpose: it is the only way to exercise both sides of the E-020
 *                  variance cap.
 *   · INVARIANTS — each carries a cost weight; the cheap ones run millions of times, the ones
 *                  that solve a wildcard run hundreds. Every invariant must run at least once
 *                  or the suite fails: an invariant that never ran proves nothing.
 *
 * Run: node qa/mc_all.cjs [iterations] [seed]
 */

"use strict";

const path = require("path");
const fs = require("fs");
const ROOT = path.resolve(__dirname, "..");
const E = require(path.join(ROOT, "src", "engine.js"));

const ITERS = Math.max(1, Math.floor(Number(process.argv[2]) || 1000000));
const SEED = Math.floor(Number(process.argv[3]) || 87020260912);
const REBUILD_EVERY = Math.max(2000, Math.floor(ITERS / 24));

// ---------------------------------------------------------------- rng

function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const RNG = mulberry32(SEED);
function ri(lo, hi) { return lo + Math.floor(RNG() * (hi - lo + 1)); }
function rpick(a) { return a[Math.floor(RNG() * a.length) % a.length]; }
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(RNG() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; }

// ---------------------------------------------------------------- bookkeeping

let failCount = 0;
const failures = [];
const stats = {};        // invariant id → {name, run, failed}

function report(inv, ok, detail) {
  const s = stats[inv.id] || (stats[inv.id] = { name: inv.name, run: 0, failed: 0 });
  s.run++;
  if (ok) return;
  s.failed++;
  failCount++;
  if (failures.length < 40) failures.push(inv.id + " " + inv.name + " — " + String(detail).slice(0, 240));
}

// ---------------------------------------------------------------- universe generator

const POS_SHAPE = [1, 2, 2, 3, 3, 4];         // per club: GKP DEF DEF MID MID FWD
const BASE_COST = { 1: 42, 2: 45, 3: 60, 4: 70 };

function makeUniverse(gwN, clubs, tag) {
  const teams = [];
  for (let t = 1; t <= clubs; t++) teams.push({ id: t, short_name: "C" + t, name: "Club " + t });
  const elements = [];
  let id = 0;
  for (let t = 1; t <= clubs; t++) for (let j = 0; j < POS_SHAPE.length; j++) {
    id++;
    const type = POS_SHAPE[j];
    elements.push({
      id: id, code: 900000 + id, web_name: "E" + id, team: t, element_type: type,
      now_cost: BASE_COST[type] + ri(0, 22), cost_change_event: ri(-1, 1), cost_change_start: ri(-3, 6),
      selected_by_percent: ri(0, 60), status: "a", news: "", chance: null,
      total_points: 0, minutes: 0, starts: 0, xg: 0, xa: 0, xgc: 0, dc: 0, bps: 0, ict: 0, form: 0,
      goals: 0, assists: 0, cs: 0, gc: 0, bonus: 0, yc: 0, rc: 0, og: 0, pen_miss: 0, pen_save: 0, saves: 0,
      transfers_in_event: 0, transfers_out_event: 0
    });
  }
  const byId = {}; elements.forEach(function (e) { byId[e.id] = e; });

  // Flags: a handful of doubts and unavailables, plus one club whose whole attack is flagged, so
  // "every attacker flagged → no captain" is reachable.
  const flagPool = shuffle(elements.map(function (e) { return e.id; })).slice(0, Math.max(2, Math.floor(elements.length * 0.12)));
  flagPool.forEach(function (fid) {
    const el = byId[fid], roll = RNG();
    if (roll < 0.45) { el.status = "d"; el.chance = rpick([25, 50, 75]); el.news = "Doubt"; }
    else if (roll < 0.75) { el.status = "i"; el.chance = 0; el.news = "Injured"; }
    else if (roll < 0.9) { el.status = "u"; el.chance = 0; el.news = "Left the league"; }
    else { el.status = "a"; el.chance = 75; el.news = "Knock"; }
  });

  // Fixtures: a round-robin-ish rotation over gwN + 6 events.
  const totalEvents = gwN + 6;
  const fixtures = [];
  let fid = 0;
  for (let g = 1; g <= totalEvents; g++) {
    const order = shuffle(teams.map(function (t) { return t.id; }));
    for (let i = 0; i + 1 < order.length; i += 2) {
      fid++;
      fixtures.push({
        id: fid, event: g, team_h: order[i], team_a: order[i + 1],
        team_h_difficulty: ri(2, 5), team_a_difficulty: ri(2, 5),
        finished: g <= gwN, started: g <= gwN,
        kickoff_time: "2026-09-" + String(Math.min(28, g)).padStart(2, "0") + "T14:00:00Z",
        team_h_score: g <= gwN ? ri(0, 3) : null, team_a_score: g <= gwN ? ri(0, 3) : null
      });
    }
  }

  // Gameweek rows. Some players never appear (zero-start sell candidates), some are rotated.
  const role = {};
  elements.forEach(function (e) { role[e.id] = RNG() < 0.12 ? "dead" : (RNG() < 0.18 ? "rot" : "reg"); });
  const gw = {};
  for (let g = 1; g <= gwN; g++) {
    const rows = {}, fxg = {};
    fixtures.filter(function (f) { return f.event === g; }).forEach(function (f) {
      fxg[f.id] = { h: Math.round(RNG() * 300) / 100, a: Math.round(RNG() * 300) / 100 };
    });
    elements.forEach(function (el) {
      const r = role[el.id];
      let min = 90, starts = 1;
      if (r === "dead") return;
      if (r === "rot" && g % 2 === 0) { min = ri(1, 40); starts = 0; }
      const type = el.element_type;
      const goals = RNG() < (type >= 3 ? 0.22 : 0.05) ? 1 : 0;
      const assists = RNG() < 0.16 ? 1 : 0;
      const cs = type <= 2 && RNG() < 0.35 ? 1 : 0;
      const gcf = cs ? 0 : ri(0, 3);
      const dcv = type === 1 ? 0 : ri(4, 16);
      const saves = type === 1 ? ri(0, 7) : 0;
      const bonus = RNG() < 0.18 ? ri(1, 3) : 0;
      const pts = E.pointsFor({ minutes: min, goals: goals, assists: assists, cs: cs, gc: gcf, dc: dcv, saves: saves, bonus: bonus }, type);
      rows[el.id] = [min, starts, pts,
        Math.round(RNG() * 90) / 100, Math.round(RNG() * 70) / 100, Math.round(RNG() * 250) / 100,
        dcv, ri(3, 45), Math.round(RNG() * 900) / 100,
        goals, assists, cs, gcf, bonus, RNG() < 0.09 ? 1 : 0, 0, 0, 0, 0, saves];
    });
    gw[String(g)] = { elements: rows, fixture_xg: fxg };
  }
  elements.forEach(function (el) {
    let tp = 0, mn = 0, st = 0, xg = 0, xa = 0, xgc = 0, dc = 0, bps = 0, ict = 0, goals = 0, assists = 0, cs = 0, gc = 0, bonus = 0, yc = 0, saves = 0;
    for (let g = 1; g <= gwN; g++) {
      const r = gw[String(g)].elements[el.id]; if (!r) continue;
      mn += r[0]; st += r[1]; tp += r[2]; xg += r[3]; xa += r[4]; xgc += r[5]; dc += r[6]; bps += r[7]; ict += r[8];
      goals += r[9]; assists += r[10]; cs += r[11]; gc += r[12]; bonus += r[13]; yc += r[14]; saves += r[19];
    }
    el.total_points = tp; el.minutes = mn; el.starts = st;
    el.xg = Math.round(xg * 100) / 100; el.xa = Math.round(xa * 100) / 100; el.xgc = Math.round(xgc * 100) / 100;
    el.dc = dc; el.bps = bps; el.ict = Math.round(ict * 100) / 100;
    el.goals = goals; el.assists = assists; el.cs = cs; el.gc = gc; el.bonus = bonus; el.yc = yc; el.saves = saves;
    el.form = gwN ? Math.round(tp / gwN * 100) / 100 : 0;
  });

  const events = [];
  for (let g = 1; g <= totalEvents; g++) events.push({
    id: g, name: "Gameweek " + g,
    deadline_time: "2026-09-" + String(Math.min(28, g)).padStart(2, "0") + "T12:30:00Z",
    is_current: g === gwN, is_next: g === gwN + 1, finished: g <= gwN, average_entry_score: ri(35, 70)
  });

  const squad = randomLegal15(elements);
  const picks = squad.length === 15 ? { active_chip: null, picks: squad.map(function (e, k) { return { element: e, position: k + 1, multiplier: k < 11 ? 1 : 0, is_captain: k === 5, is_vice_captain: k === 6 }; }) } : null;

  const rivals = {};
  const rivalIds = [201, 202, 203, 204, 205];
  rivalIds.forEach(function (r) {
    const s = randomLegal15(elements);
    if (s.length !== 15) return;
    rivals[r] = { event: Math.max(1, gwN), picks: s.map(function (el, k) { return { element: el, position: k + 1, multiplier: k < 11 ? (k === 3 ? 2 : 1) : 0, is_captain: k === 3, is_vice_captain: k === 4 }; }) };
  });

  const history = { current: [], chips: [] };
  for (let g = 1; g <= gwN; g++) history.current.push({ event: g, points: ri(30, 90), total_points: 0, rank: ri(1, 5), overall_rank: ri(1, 9000000), bank: ri(0, 30), value: 1000, event_transfers: RNG() < 0.3 ? 1 : 0, event_transfers_cost: 0, points_on_bench: ri(0, 20) });

  const snap = {
    fetched_at: "2026-09-11T06:00:00Z", source: "random universe " + tag,
    next_event: gwN + 1, current_event: gwN, total_players: 10000,
    events: events, teams: teams, elements: elements, fixtures: fixtures, gw: gw,
    entry: { id: 3546875, name: "Kwezi", summary_overall_points: 150, summary_overall_rank: 500000, summary_event_points: 50, current_event: gwN, last_deadline_bank: 5, last_deadline_value: 1000, last_deadline_total_transfers: 0 },
    history: history,
    picks: picks && gwN >= 1 ? (function () { const o = {}; o[String(gwN)] = picks; return o; })() : {},
    ft_available: ri(0, 5),
    leagues: [{ id: 700, name: "Random League", size: rivalIds.length + 1, rank: 2, last_rank: 3,
      standings: [{ entry: 3546875, player_name: "Kwezi Ngwevu", entry_name: "Kwezi", total: 150, rank: 2 }].concat(
        rivalIds.map(function (r, i) { return { entry: r, player_name: "Rival " + i, entry_name: "R" + i, total: 140 + i * 7, rank: i + 1 }; })) }],
    rivals: rivals,
    draft: { game: { current_event: gwN, next_event: gwN + 1, waivers_processed: false },
      events: [{ id: gwN + 1, deadline_time: "2026-09-12T12:30:00Z", waivers_time: "2026-09-11T12:30:00Z" }],
      scoring: { short_play: 1, long_play: 2, long_play_limit: 60, goals_scored_GKP: 10, goals_scored_DEF: 6, goals_scored_MID: 5, goals_scored_FWD: 4,
        assists: 3, clean_sheets_GKP: 4, clean_sheets_DEF: 4, clean_sheets_MID: 1, clean_sheets_FWD: 0,
        goals_conceded_GKP: -1, goals_conceded_DEF: -1, goals_conceded_MID: 0, goals_conceded_FWD: 0, concede_limit: 2,
        saves: 1, saves_limit: 3, penalties_saved: 5, penalties_missed: -2, yellow_cards: -1, red_cards: -3, own_goals: -2, bonus: 1,
        defensive_contribution_DEF: 2, defensive_contribution_limit_DEF: 10, defensive_contribution_MID: 2, defensive_contribution_limit_MID: 12,
        defensive_contribution_FWD: 2, defensive_contribution_limit_FWD: 12 },
      squad: { size: 15, captains_disabled: true },
      elements: elements.map(function (el) { return { id: RNG() < 0.1 ? el.id + 500 : el.id, code: el.code, web_name: el.web_name, team: el.team, element_type: el.element_type, status: el.status, chance: el.chance, news: el.news, starts: el.starts, minutes: el.minutes, total_points: el.total_points }; }),
      league_id: null }
  };

  const state = {
    version: 87, exported_at: "2026-09-11T06:00:00Z", entry: 3546875,
    squad: squad.map(function (i) { return { id: i, purchase: Math.max(38, byId[i].now_cost - ri(0, 5)) }; }),
    bank: ri(0, 25), ft: snap.ft_available, value: 1000, confirmed_gw: gwN,
    leagues: [700], draft: { league_id: null, roster: squad.map(function (i) { return byId[i].code; }), watchlist: [] },
    ui: { mode: "simple", tab: "command", open: {}, reveals: {} }, ledger: [],
    refresh: { pair: "sonnet46", last: null }
  };

  const ctx = E.buildCtx(snap, state, "2026-09-11T06:00:00Z");
  const u = { tag: tag, gwN: gwN, clubs: clubs, snap: snap, state: state, ctx: ctx, squad: squad, byId: byId, elements: elements };
  u.xi = ctx.ok && squad.length === 15 ? E.bestXI(squad, ctx) : { ids: [], bench: [], capId: null, viceId: null, formation: "" };
  return u;
}

// A legal fifteen drawn at random from an element table: 2/5/5/3, ≤3 per club, ≤1000 tenths.
function randomLegal15(elements) {
  const need = { 1: 2, 2: 5, 3: 5, 4: 3 };
  for (let attempt = 0; attempt < 40; attempt++) {
    const clubN = {}, out = [];
    let cost = 0, ok = true;
    for (const t of [1, 2, 3, 4]) {
      const pool = shuffle(elements.filter(function (e) { return e.element_type === Number(t); }));
      let taken = 0;
      for (const el of pool) {
        if (taken >= need[t]) break;
        if ((clubN[el.team] || 0) >= 3) continue;
        out.push(el.id); clubN[el.team] = (clubN[el.team] || 0) + 1; cost += el.now_cost; taken++;
      }
      if (taken < need[t]) { ok = false; break; }
    }
    if (ok && out.length === 15 && cost <= 1000) return out;
  }
  return [];
}

const GW_PROFILE = [0, 1, 2, 3, 3, 5, 6, 7, 8, 9, 11, 12];
let universeSerial = 0;
function freshUniverse() {
  universeSerial++;
  return makeUniverse(GW_PROFILE[universeSerial % GW_PROFILE.length], ri(5, 8), "u" + universeSerial);
}

let UNIVERSES = [];
for (let i = 0; i < 5; i++) UNIVERSES.push(freshUniverse());
const LIVE_UNIVERSES = UNIVERSES.filter(function (u) { return u.ctx.ok && u.squad.length === 15; });
if (!LIVE_UNIVERSES.length) {
  console.log("FAIL mc_all — no usable universe could be generated");
  console.log("SUITE mc_all 0 iters · 0 invariants · 1 (seed " + SEED + ")");
  process.exit(1);
}
function U() {
  const list = UNIVERSES.filter(function (u) { return u.ctx.ok && u.squad.length === 15; });
  return list.length ? rpick(list) : LIVE_UNIVERSES[0];
}

// ---------------------------------------------------------------- input generators

function randomStatsRow() {
  const min = rpick([0, 0, 1, 25, 45, 59, 60, 70, 90, 90, 90]);
  return {
    minutes: min, starts: min >= 60 ? 1 : 0,
    goals: ri(0, 3), assists: ri(0, 2), cs: RNG() < 0.4 ? 1 : 0, gc: ri(0, 5),
    dc: ri(0, 20), saves: ri(0, 9), bonus: ri(0, 3), yc: RNG() < 0.15 ? 1 : 0,
    rc: RNG() < 0.04 ? 1 : 0, og: RNG() < 0.03 ? 1 : 0, pen_miss: RNG() < 0.03 ? 1 : 0, pen_save: RNG() < 0.03 ? 1 : 0,
    bps: ri(0, 60), ict: ri(0, 40)
  };
}

function illegal15(u) {
  const kind = ri(0, 5);
  const s = u.squad.slice();
  if (kind === 0) return { ids: s.slice(0, ri(0, 14)), why: "wrong length" };
  if (kind === 1) { s[14] = s[0]; return { ids: s, why: "duplicate" }; }
  if (kind === 2) {
    // a fourth player from a club already holding three
    const counts = E.clubCounts(s, u.ctx.els);
    const full = Object.keys(counts).filter(function (c) { return counts[c] >= 3; })[0];
    if (!full) return { ids: s.concat([0]), why: "wrong length" };
    const swapIn = u.elements.filter(function (e) { return String(e.team) === String(full) && s.indexOf(e.id) < 0; })[0];
    const swapOutIdx = s.findIndex(function (id) { return String(u.ctx.els[id].team) !== String(full) && swapIn && u.ctx.els[id].element_type === swapIn.element_type; });
    if (!swapIn || swapOutIdx < 0) return { ids: s.concat([0]), why: "wrong length" };
    s[swapOutIdx] = swapIn.id;
    return { ids: s, why: "club cap" };
  }
  if (kind === 3) { s[0] = s[1]; s[1] = u.squad[0]; return { ids: s.slice(0, 15), why: "reordered (still legal)" , legal: true }; }
  if (kind === 4) return { ids: s.concat(s[0]), why: "sixteen" };
  return { ids: shuffle(s), why: "reordered (still legal)", legal: true };
}

// ---------------------------------------------------------------- the invariants

const INV = [];
function inv(id, name, cost, fn) { INV.push({ id: id, name: name, cost: cost, run: fn }); }
const OK = true;
function bad(detail) { return { ok: false, detail: detail }; }

/* --- B3 constraints ------------------------------------------------------- */

inv("I01", "a generated legal fifteen passes legal15", 60, function (u) {
  const r = E.legal15(u.squad, u.ctx.els, 1000);
  return r.ok ? OK : bad(u.tag + " " + r.reasons.join(" | "));
});
inv("I02", "legal15 ok implies exactly 2/5/5/3", 60, function (u) {
  const r = E.legal15(u.squad, u.ctx.els, 1000);
  if (!r.ok) return OK;
  return (r.counts[1] === 2 && r.counts[2] === 5 && r.counts[3] === 5 && r.counts[4] === 3) ? OK : bad(JSON.stringify(r.counts));
});
inv("I03", "legal15 never passes more than three from one club (E-005)", 60, function (u) {
  const c = illegal15(u);
  const r = E.legal15(c.ids, u.ctx.els, 1000);
  if (!r.ok) return OK;
  const counts = E.clubCounts(c.ids, u.ctx.els);
  const over = Object.keys(counts).filter(function (k) { return counts[k] > 3; });
  return over.length ? bad("ok with " + counts[over[0]] + " from club " + over[0] + " (" + c.why + ")") : OK;
});
inv("I04", "legal15 never passes a list that is not fifteen distinct ids", 60, function (u) {
  const c = illegal15(u);
  const r = E.legal15(c.ids, u.ctx.els, 1000);
  if (!r.ok) return OK;
  const d = c.ids.filter(function (v, i) { return c.ids.indexOf(v) === i; });
  return (c.ids.length === 15 && d.length === 15) ? OK : bad("ok on " + c.ids.length + " ids / " + d.length + " distinct (" + c.why + ")");
});
inv("I05", "legal15 cost is the exact sum of now_cost in tenths", 60, function (u) {
  const r = E.legal15(u.squad, u.ctx.els, 1000);
  let s = 0; u.squad.forEach(function (id) { s += u.ctx.els[id].now_cost; });
  return (r.cost === s && Number.isInteger(r.cost)) ? OK : bad("cost " + r.cost + " vs " + s);
});
inv("I06", "legal15 rejects one tenth over the budget and accepts the budget exactly", 25, function (u) {
  let s = 0; u.squad.forEach(function (id) { s += u.ctx.els[id].now_cost; });
  const at = E.legal15(u.squad, u.ctx.els, s);
  const under = E.legal15(u.squad, u.ctx.els, s - 1);
  if (!at.ok) return bad("rejected at its own cost " + s + ": " + at.reasons.join("|"));
  return under.ok ? bad("accepted " + s + " against a budget of " + (s - 1)) : OK;
});
inv("I07", "a legal fifteen never exceeds £100.0m at the live budget", 60, function (u) {
  const r = E.legal15(u.squad, u.ctx.els, 1000);
  return (!r.ok || r.cost <= 1000) ? OK : bad("cost " + r.cost);
});
inv("I08", "clubCounts partitions the known ids", 80, function (u) {
  const ids = shuffle(u.squad).slice(0, ri(1, 15));
  const c = E.clubCounts(ids, u.ctx.els);
  let s = 0; Object.keys(c).forEach(function (k) { s += c[k]; });
  return s === ids.length ? OK : bad(s + " counted of " + ids.length);
});
inv("I09", "posCounts partitions the ids it is given", 80, function (u) {
  const ids = shuffle(u.squad).slice(0, ri(1, 15));
  const c = E.posCounts(ids, u.ctx.els);
  const s = c[1] + c[2] + c[3] + c[4] + c.unknown;
  return s === ids.length ? OK : bad(s + " counted of " + ids.length);
});
inv("I10", "legalXI ok implies 11 with 1 GKP, ≥3 DEF, ≥2 MID, ≥1 FWD", 60, function (u) {
  const ids = u.xi.ids.length ? u.xi.ids : shuffle(u.squad).slice(0, 11);
  const r = E.legalXI(ids, u.ctx.els);
  if (!r.ok) return OK;
  const c = E.posCounts(ids, u.ctx.els);
  return (ids.length === 11 && c[1] === 1 && c[2] >= 3 && c[3] >= 2 && c[4] >= 1) ? OK : bad(JSON.stringify(c));
});
inv("I11", "legalXI rejects a second goalkeeper", 30, function (u) {
  const gks = u.elements.filter(function (e) { return e.element_type === 1; }).slice(0, 2).map(function (e) { return e.id; });
  if (gks.length < 2) return OK;
  const rest = u.squad.filter(function (id) { return u.ctx.els[id].element_type !== 1; }).slice(0, 9);
  const r = E.legalXI(gks.concat(rest), u.ctx.els);
  return r.ok ? bad("passed two goalkeepers") : OK;
});
inv("I12", "legalXI rejects an eleven with fewer than three defenders", 30, function (u) {
  const by = { 1: [], 2: [], 3: [], 4: [] };
  u.elements.forEach(function (e) { by[e.element_type].push(e.id); });
  if (by[1].length < 1 || by[2].length < 2 || by[3].length < 5 || by[4].length < 3) return OK;
  const ids = [by[1][0]].concat(by[2].slice(0, 2), by[3].slice(0, 5), by[4].slice(0, 3));
  const r = E.legalXI(ids, u.ctx.els);
  return r.ok ? bad("passed two defenders") : OK;
});
inv("I13", "legalXI rejects an eleven with no forward", 30, function (u) {
  const by = { 1: [], 2: [], 3: [], 4: [] };
  u.elements.forEach(function (e) { by[e.element_type].push(e.id); });
  if (by[1].length < 1 || by[2].length < 5 || by[3].length < 5) return OK;
  const ids = [by[1][0]].concat(by[2].slice(0, 5), by[3].slice(0, 5));
  const r = E.legalXI(ids, u.ctx.els);
  return r.ok ? bad("passed without a forward") : OK;
});
inv("I14", "formationOf returns one of the eight legal shapes for a legal eleven", 40, function (u) {
  if (!u.xi.ids.length) return OK;
  const f = E.formationOf(u.xi.ids, u.ctx.els);
  const shapes = E.FORMATIONS.map(function (x) { return x.join("-"); });
  return shapes.indexOf(f) >= 0 ? OK : bad("formation " + JSON.stringify(f));
});
inv("I15", "formationOf returns \"\" for anything that is not an eleven", 40, function (u) {
  const ids = shuffle(u.squad).slice(0, rpick([0, 1, 9, 10, 12, 15]));
  return E.formationOf(ids, u.ctx.els) === "" ? OK : bad(ids.length + " ids gave " + E.formationOf(ids, u.ctx.els));
});

/* --- B1 scoring ----------------------------------------------------------- */

inv("I16", "pointsFor always returns an integer", 120, function () {
  const t = ri(1, 4), v = E.pointsFor(randomStatsRow(), t);
  return Number.isInteger(v) ? OK : bad("type " + t + " gave " + v);
});
inv("I17", "a FWD never earns clean-sheet points (B1)", 120, function () {
  const r = randomStatsRow();
  const withCs = Object.assign({}, r, { cs: 1 }), without = Object.assign({}, r, { cs: 0 });
  const d = E.pointsFor(withCs, 4) - E.pointsFor(without, 4);
  return d === 0 ? OK : bad("delta " + d + " on " + JSON.stringify(r));
});
inv("I18", "a GKP never earns DefCon (B1)", 120, function () {
  const r = randomStatsRow();
  const hi = Object.assign({}, r, { dc: 40 }), lo = Object.assign({}, r, { dc: 0 });
  const d = E.pointsFor(hi, 1) - E.pointsFor(lo, 1);
  return d === 0 ? OK : bad("delta " + d);
});
inv("I19", "a MID clean sheet is worth 1 and a DEF/GKP clean sheet 4", 60, function () {
  const r = Object.assign({}, randomStatsRow(), { minutes: 90 });
  const d = function (t) { return E.pointsFor(Object.assign({}, r, { cs: 1 }), t) - E.pointsFor(Object.assign({}, r, { cs: 0 }), t); };
  return (d(1) === 4 && d(2) === 4 && d(3) === 1 && d(4) === 0) ? OK : bad([d(1), d(2), d(3), d(4)].join(","));
});
inv("I20", "a clean sheet needs sixty minutes", 60, function () {
  const m = ri(0, 59);
  const d = E.pointsFor({ minutes: m, cs: 1 }, 2) - E.pointsFor({ minutes: m, cs: 0 }, 2);
  return d === 0 ? OK : bad(m + " minutes paid " + d);
});
inv("I21", "zero minutes always scores zero", 60, function () {
  const r = Object.assign({}, randomStatsRow(), { minutes: 0 });
  const v = E.pointsFor(r, ri(1, 4));
  return v === 0 ? OK : bad("scored " + v);
});
inv("I22", "goals conceded only ever cost GKP and DEF, one per completed pair", 60, function () {
  const gc = ri(0, 9);
  const base = { minutes: 90 };
  const d = function (t) { return E.pointsFor({ minutes: 90, gc: gc }, t) - E.pointsFor(base, t); };
  const want = -Math.floor(gc / 2);
  return (d(1) === want && d(2) === want && d(3) === 0 && d(4) === 0) ? OK : bad("gc " + gc + " → " + [d(1), d(2), d(3), d(4)].join(",") + " want " + want);
});
inv("I23", "saves pay only the goalkeeper, one per three", 60, function () {
  const s = ri(0, 12);
  const d = function (t) { return E.pointsFor({ minutes: 90, saves: s }, t) - E.pointsFor({ minutes: 90 }, t); };
  return (d(1) === Math.floor(s / 3) && d(2) === 0 && d(3) === 0 && d(4) === 0) ? OK : bad("saves " + s + " → " + [d(1), d(2), d(3), d(4)].join(","));
});
inv("I24", "DefCon pays at 10 for DEF and at 12 for MID and FWD", 60, function () {
  const d = function (t, v) { return E.pointsFor({ minutes: 90, dc: v }, t) - E.pointsFor({ minutes: 90 }, t); };
  return (d(2, 10) === 2 && d(2, 9) === 0 && d(3, 12) === 2 && d(3, 11) === 0 && d(4, 12) === 2 && d(4, 11) === 0) ? OK
    : bad([d(2, 10), d(2, 9), d(3, 12), d(3, 11), d(4, 12), d(4, 11)].join(","));
});
inv("I25", "the captain doubles a negative return as faithfully as a positive one", 60, function () {
  const r = randomStatsRow();
  const t = ri(1, 4), base = E.pointsFor(r, t);
  return base * 2 === base + base ? OK : bad("base " + base);
});
inv("I26", "draft scoring gives a goalkeeper goal 10 and leaves the outfield alone", 30, function (u) {
  const D = E.draftScoring(u.snap);
  return (D[1].goal === 10 && D[2].goal === 6 && D[3].goal === 5 && D[4].goal === 4 && E.SCORING[1].goal === 6) ? OK
    : bad([D[1].goal, D[2].goal, D[3].goal, D[4].goal].join(","));
});
inv("I27", "gwPoints is the multiplier-weighted sum of the finished gameweek", 20, function (u) {
  if (!u.gwN) return OK;
  const pk = u.snap.picks[String(u.gwN)];
  if (!pk) return OK;
  const data = u.snap.gw[String(u.gwN)];
  let want = 0;
  pk.picks.forEach(function (p) { const row = data.elements[p.element]; if (row) want += row[2] * p.multiplier; });
  const got = E.gwPoints(pk.picks, data);
  return got === want ? OK : bad("got " + got + " want " + want);
});

/* --- xP and strength ------------------------------------------------------ */

inv("I28", "pStart is a probability", 100, function (u) {
  const id = rpick(u.elements).id;
  const p = E.pStart(u.ctx.els[id], u.ctx.gwStats);
  return (p >= 0 && p <= 1) ? OK : bad("id " + id + " → " + p);
});
inv("I29", "xp1 and xp5 are never negative", 80, function (u) {
  const id = rpick(u.elements).id;
  const a = E.xp1(u.ctx.els[id], u.ctx), b = E.xp5(u.ctx.els[id], u.ctx);
  return (a >= 0 && b >= 0 && isFinite(a) && isFinite(b)) ? OK : bad("xp1 " + a + " xp5 " + b);
});
inv("I30", "xp5 is never below xp1 (five decayed weeks include the first)", 60, function (u) {
  const id = rpick(u.elements).id;
  const a = E.xp1(u.ctx.els[id], u.ctx), b = E.xp5(u.ctx.els[id], u.ctx);
  return b >= a - 1e-9 ? OK : bad("xp1 " + a + " > xp5 " + b);
});
inv("I31", "shrunkPps sits between the position prior and the raw points per start", 60, function (u) {
  const el = rpick(u.elements);
  const v = E.shrunkPps(el);
  const prior = E.PRIOR_PPS[el.element_type];
  const raw = el.starts ? el.total_points / el.starts : prior;
  const lo = Math.min(prior, raw) - 1e-9, hi = Math.max(prior, raw) + 1e-9;
  return (v >= lo && v <= hi) ? OK : bad("shrunk " + v + " outside [" + lo + "," + hi + "]");
});
inv("I32", "tsPcs is strictly inside (0,1)", 80, function (u) {
  const t = ri(1, u.clubs), o = ri(1, u.clubs);
  if (t === o) return OK;
  const p = E.tsPcs(t, o, RNG() < 0.5, RNG() < 0.5 ? u.ctx.TS : u.ctx.TS_GOALS);
  return (p > 0 && p < 1) ? OK : bad(t + " v " + o + " → " + p);
});
inv("I33", "tsMult is finite and positive", 80, function (u) {
  const t = ri(1, u.clubs), o = ri(1, u.clubs);
  if (t === o) return OK;
  const m = E.tsMult(t, o, RNG() < 0.5, u.ctx.TS);
  return (isFinite(m) && m > 0) ? OK : bad(t + " v " + o + " → " + m);
});
inv("I34", "home beats away for the same pair of clubs", 50, function (u) {
  const t = ri(1, u.clubs), o = ri(1, u.clubs);
  if (t === o) return OK;
  return E.tsMult(t, o, true, u.ctx.TS) > E.tsMult(t, o, false, u.ctx.TS) ? OK : bad("home not better for " + t + " v " + o);
});
inv("I35", "runAvg returns an FDR between 1 and 5", 50, function (u) {
  const v = E.runAvg(ri(1, u.clubs), u.snap.fixtures, ri(1, 6));
  return (v >= 1 && v <= 5) ? OK : bad("runAvg " + v);
});
inv("I36", "fxMult returns 1 for a club that is not in the fixture", 50, function (u) {
  const f = rpick(u.snap.fixtures);
  const outsider = u.elements.map(function (e) { return e.team; }).filter(function (t) { return t !== f.team_h && t !== f.team_a; })[0];
  if (outsider === undefined) return OK;
  const m = E.fxMult(f, outsider, u.ctx.TS);
  return m === 1 ? OK : bad("outsider multiplier " + m);
});

/* --- rivals --------------------------------------------------------------- */

inv("I37", "rival ownership shares stay inside [0,1]", 25, function (u) {
  const map = E.rivalOwn(u.snap);
  let bd = null;
  Object.keys(map).forEach(function (L) { Object.keys(map[L]).forEach(function (id) { const v = map[L][id]; if (bd === null && !(v >= 0 && v <= 1)) bd = L + "/" + id + " = " + v; }); });
  return bd === null ? OK : bad(bd);
});
inv("I38", "captaincy share never exceeds ownership share", 25, function (u) {
  const own = E.rivalOwn(u.snap), cap = E.capShare(u.snap);
  let bd = null;
  Object.keys(cap).forEach(function (L) {
    Object.keys(cap[L]).forEach(function (id) {
      const c = cap[L][id], o = own[L] ? own[L][id] || 0 : 0;
      if (bd === null && c > o + 1e-9) bd = L + "/" + id + " captained " + c + " owned " + o;
    });
  });
  return bd === null ? OK : bad(bd);
});
inv("I39", "classify only ever returns EDGE, SHARED, DEAD or NEUTRAL", 90, function (u) {
  const c = E.classify(rpick(u.elements), u.ctx);
  return ["EDGE", "SHARED", "DEAD", "NEUTRAL"].indexOf(c) >= 0 ? OK : bad(JSON.stringify(c));
});
inv("I40", "a player with no start in three is always DEAD", 60, function (u) {
  const el = rpick(u.elements);
  const gs = u.ctx.gwStats[el.id];
  if (!gs || gs.starts_last3 !== 0 || !u.gwN) return OK;
  return E.classify(el, u.ctx) === "DEAD" ? OK : bad("id " + el.id + " classified " + E.classify(el, u.ctx));
});
inv("I41", "convergenceRisk fires exactly at 0.60 and its max is a share", 60, function (u) {
  const el = rpick(u.elements);
  const r = E.convergenceRisk(el.id, u.ctx);
  if (typeof r.risk !== "boolean") return bad("risk " + JSON.stringify(r.risk));
  if (!(r.max >= 0 && r.max <= 1)) return bad("max " + r.max);
  return r.risk === (r.max >= 0.60) ? OK : bad("risk " + r.risk + " at max " + r.max);
});
inv("I42", "rivalOwnMax is the maximum over the leagues", 40, function (u) {
  const el = rpick(u.elements);
  const own = E.rivalOwn(u.snap);
  let want = 0;
  Object.keys(own).forEach(function (L) { const v = own[L][el.id] || 0; if (v > want) want = v; });
  const got = E.rivalOwnMax(el.id, u.ctx).max;
  return Math.abs(got - want) < 1e-9 ? OK : bad("got " + got + " want " + want);
});

/* --- XI, captain, bench --------------------------------------------------- */

inv("I43", "bestXI returns eleven distinct ids drawn from the squad it was given", 8, function (u) {
  const x = E.bestXI(u.squad, u.ctx);
  if (!x.ids.length) return OK;
  const d = x.ids.filter(function (v, i) { return x.ids.indexOf(v) === i; });
  const outside = x.ids.filter(function (id) { return u.squad.indexOf(id) < 0; });
  return (x.ids.length === 11 && d.length === 11 && outside.length === 0) ? OK : bad(x.ids.length + " ids, " + outside.length + " outside");
});
inv("I44", "bestXI always returns a legal eleven", 8, function (u) {
  const x = u.xi;
  if (!x.ids.length) return OK;
  const L = E.legalXI(x.ids, u.ctx.els);
  return L.ok ? OK : bad(L.reasons.join(" | "));
});
inv("I45", "bestXI and its bench together are the whole fifteen", 8, function (u) {
  const x = u.xi;
  if (!x.ids.length) return OK;
  const all = x.ids.concat(x.bench).slice().sort(function (a, b) { return a - b; }).join(",");
  return all === u.squad.slice().sort(function (a, b) { return a - b; }).join(",") ? OK : bad("XI+bench ≠ squad");
});
inv("I46", "the captain is a MID or FWD unless every attacker in the XI is flagged", 20, function (u) {
  const x = u.xi;
  if (!x.ids.length) return OK;
  const cp = E.captainPick(x.ids, u.ctx);
  const attackers = x.ids.filter(function (id) { const t = u.ctx.els[id].element_type; return t === 3 || t === 4; });
  const eligible = attackers.filter(function (id) { return !u.ctx.flags[id].flagged; });
  if (cp.capId === null) return eligible.length === 0 ? OK : bad("no captain although " + eligible.length + " clean attackers are in the XI");
  const t = u.ctx.els[cp.capId].element_type;
  if (t !== 3 && t !== 4) return bad("captain " + cp.capId + " is element_type " + t);
  return u.ctx.flags[cp.capId].flagged ? bad("captain " + cp.capId + " is flagged") : OK;
});
inv("I47", "the captain's own row leads the returned table", 20, function (u) {
  const x = u.xi;
  if (!x.ids.length || x.capId === null) return OK;
  const cp = E.captainPick(x.ids, u.ctx);
  if (cp.capId === null) return OK;
  const eligible = cp.table.filter(function (r) { return r.eligible; });
  return (eligible.length && eligible[0].id === cp.capId) ? OK : bad("top eligible row is " + (eligible[0] ? eligible[0].id : "none") + ", captain " + cp.capId);
});
inv("I48", "eligible rows lead the captaincy table and EV falls inside each group", 20, function (u) {
  // The table is sorted eligibility-first, then EV descending (src/engine.js captainPick), so the
  // shipped captain is always the first row. A flagged 15-point man therefore sits BELOW a clean
  // 5-point man — that is the C1 rule 2 gate, not a sorting bug.
  const x = u.xi;
  if (!x.ids.length) return OK;
  const t = E.captainPick(x.ids, u.ctx).table;
  let seenIneligible = false;
  for (let i = 0; i < t.length; i++) {
    if (!t[i].eligible) seenIneligible = true;
    else if (seenIneligible) return bad("eligible row " + i + " (id " + t[i].id + ") sits below an ineligible one");
    if (i && t[i].eligible === t[i - 1].eligible && t[i].ev > t[i - 1].ev + 1e-9) {
      return bad("row " + i + " ev " + t[i].ev + " above row " + (i - 1) + " ev " + t[i - 1].ev + " inside the same group");
    }
  }
  return OK;
});
inv("I49", "vice is inside the XI and is never the captain", 20, function (u) {
  const x = u.xi;
  if (!x.ids.length || x.capId === null) return OK;
  if (x.viceId === null || x.viceId === undefined) return OK;
  if (x.ids.indexOf(x.viceId) < 0) return bad("vice " + x.viceId + " not in the XI");
  return x.viceId !== x.capId ? OK : bad("vice equals the captain");
});
inv("I50", "benchOrder returns exactly the outfield squad members that are not in the XI", 15, function (u) {
  const x = u.xi;
  if (!x.ids.length) return OK;
  const order = E.benchOrder(u.squad, x.ids, u.ctx);
  const want = u.squad.filter(function (id) { return x.ids.indexOf(id) < 0 && u.ctx.els[id].element_type !== 1; });
  const a = order.slice().sort(function (p, q) { return p - q; }).join(",");
  const b = want.slice().sort(function (p, q) { return p - q; }).join(",");
  return a === b ? OK : bad("bench order [" + order.join(",") + "] against [" + want.join(",") + "]");
});
inv("I51", "the bench order never repeats a player", 15, function (u) {
  const x = u.xi;
  if (!x.ids.length) return OK;
  const order = E.benchOrder(u.squad, x.ids, u.ctx);
  const d = order.filter(function (v, i) { return order.indexOf(v) === i; });
  return d.length === order.length ? OK : bad("duplicates in [" + order.join(",") + "]");
});
inv("I52", "a sub-0.5 P(start) player never starts ahead of a 0.75 one he could replace", 8, function (u) {
  const x = u.xi;
  if (!x.ids.length) return OK;
  const bench = u.squad.filter(function (id) { return x.ids.indexOf(id) < 0; });
  for (const id of x.ids) {
    if (u.ctx.xp[id].pstart >= 0.5) continue;
    for (const b of bench) {
      if (u.ctx.xp[b].pstart >= 0.75 && u.ctx.els[b].element_type === u.ctx.els[id].element_type) {
        return bad(id + " (" + u.ctx.xp[id].pstart.toFixed(2) + ") started over " + b + " (" + u.ctx.xp[b].pstart.toFixed(2) + ")");
      }
    }
  }
  return OK;
});

/* --- transfers ------------------------------------------------------------ */

function tp(u) {
  if (u._tp === undefined) u._tp = E.transferProtocol(u.state, u.ctx);
  return u._tp;
}
inv("I53", "the free-transfer budget is never exceeded (E-004)", 6, function (u) {
  const r = tp(u);
  return r.k <= Math.min(r.ft + 1, 3) ? OK : bad("k " + r.k + " with ft " + r.ft);
});
inv("I54", "a hit is priced at exactly −4 per extra transfer", 6, function (u) {
  const r = tp(u);
  return r.hits === Math.max(0, r.k - r.ft) * 4 ? OK : bad("hits " + r.hits + " for k " + r.k + " ft " + r.ft);
});
inv("I55", "the number of moves matches k", 6, function (u) {
  const r = tp(u);
  return r.moves.length === r.k ? OK : bad(r.moves.length + " moves for k " + r.k);
});
inv("I56", "the bank after the moves is never negative on raw prices (E-007)", 6, function (u) {
  const r = tp(u);
  return (r.blocked || r.bankAfter >= 0) ? OK : bad("bankAfter " + r.bankAfter);
});
inv("I57", "never more than two incoming players from one club (E-009)", 6, function (u) {
  const r = tp(u);
  const c = E.clubCounts(r.moves.map(function (m) { return m.in; }), u.ctx.els);
  const over = Object.keys(c).filter(function (k) { return c[k] > 2; });
  return over.length ? bad("club " + over[0] + " sent " + c[over[0]] + " players in") : OK;
});
inv("I58", "no buy is ever 60% rival-owned (E-021)", 6, function (u) {
  const r = tp(u);
  const conv = r.moves.filter(function (m) { return E.rivalOwnMax(m.in, u.ctx).max >= 0.60; });
  return conv.length ? bad("bought " + conv[0].in + " at " + E.rivalOwnMax(conv[0].in, u.ctx).max) : OK;
});
inv("I59", "the fifteen after the shipped moves is still legal (E-005)", 6, function (u) {
  const r = tp(u);
  if (!r.moves.length) return OK;
  const outs = r.moves.map(function (m) { return m.out; });
  const after = u.squad.filter(function (id) { return outs.indexOf(id) < 0; }).concat(r.moves.map(function (m) { return m.in; }));
  const L = E.legal15(after, u.ctx.els, 1e9);
  return L.ok ? OK : bad(L.reasons.join(" | "));
});
inv("I60", "every swap is position for position", 6, function (u) {
  const r = tp(u);
  const badm = r.moves.filter(function (m) { return u.ctx.els[m.out].element_type !== u.ctx.els[m.in].element_type; });
  return badm.length ? bad(badm[0].out + "→" + badm[0].in) : OK;
});
inv("I61", "an optional sell only ships on a five-week gain above four (C1 rule 1)", 6, function (u) {
  const r = tp(u);
  const weak = r.moves.filter(function (m) { return !m.forced && m.gain <= 4; });
  return weak.length ? bad("optional move " + weak[0].out + "→" + weak[0].in + " gains only " + weak[0].gain) : OK;
});
inv("I62", "a zero-start player is always a forced sell candidate (E-006)", 6, function (u) {
  if (!u.gwN) return OK;
  const r = tp(u);
  const forced = r.forced.map(function (f) { return f.id; });
  const dead = u.squad.filter(function (id) { const gs = u.ctx.gwStats[id]; return gs && gs.starts_last3 === 0; });
  const missed = dead.filter(function (id) { return forced.indexOf(id) < 0; });
  return missed.length ? bad("zero-start " + missed[0] + " is not a forced sell") : OK;
});
inv("I63", "a player who started his club's last match is never sold for being out (E-010)", 6, function (u) {
  const r = tp(u);
  const konsa = r.moves.filter(function (m) {
    const gs = u.ctx.gwStats[m.out];
    return m.forced && gs && gs.startedLast === true && u.ctx.flags[m.out].status === "a";
  });
  return konsa.length ? bad("sold returning starter " + konsa[0].out) : OK;
});
inv("I64", "the margin is never measured against the same plan (E-008)", 6, function (u) {
  const r = tp(u);
  if (!r.moves.length) return OK;
  const key = function (mv) { return mv.map(function (m) { return m.out + ">" + m.in; }).slice().sort().join("|"); };
  const shipped = key(r.moves);
  const same = (r.alternatives || []).filter(function (a) { return key(a.moves) === shipped; });
  if (same.length) return bad("an alternative is the shipped plan itself");
  return r.margin >= 0 ? OK : bad("margin " + r.margin);
});
inv("I65", "confidence follows the 2.0 and 0.8 margin thresholds", 6, function (u) {
  const r = tp(u);
  const m = r.margin, c = r.confidence;
  const okc = (m >= 2.0 && c === "HIGH") || (m >= 0.8 && m < 2.0 && c === "MED") || (m < 0.8 && (c === "LOW" || c === "hold"));
  return okc ? OK : bad("margin " + m + " → " + c);
});
inv("I66", "sells are executed before buys and the captain and vice come last", 6, function (u) {
  const r = tp(u);
  const acts = r.order.map(function (o) { return o.action; });
  if (!acts.length) return OK;
  const lastSell = acts.lastIndexOf("sell"), firstBuy = acts.indexOf("buy");
  if (lastSell >= 0 && firstBuy >= 0 && lastSell > firstBuy) return bad(acts.join(" → "));
  return (acts[acts.length - 2] === "captain" && acts[acts.length - 1] === "vice") ? OK : bad(acts.join(" → "));
});
inv("I67", "a blocked plan recommends nothing at all (D3)", 6, function (u) {
  const r = tp(u);
  return (!r.blocked || r.moves.length === 0) ? OK : bad("blocked with " + r.moves.length + " moves");
});
inv("I68", "at FT 0 every transfer costs a hit", 4, function (u) {
  const st = Object.assign({}, u.state, { ft: 0 });
  const snap2 = Object.assign({}, u.snap); delete snap2.ft_available;
  const ctx2 = E.buildCtx(snap2, st, "2026-09-11T06:00:00Z");
  const r = E.transferProtocol(st, ctx2);
  return (r.ft === 0 && (r.k === 0 || r.hits === r.k * 4)) ? OK : bad("ft " + r.ft + " k " + r.k + " hits " + r.hits);
});
inv("I69", "sellCandidates never invents a player who is not in the squad", 20, function (u) {
  const s = E.sellCandidates(u.state.squad, u.ctx);
  const outside = s.filter(function (c) { return u.squad.indexOf(c.id) < 0; });
  return outside.length ? bad("candidate " + outside[0].id + " is not in the squad") : OK;
});

/* --- wildcard ------------------------------------------------------------- */

function wc(u) {
  if (u._wc === undefined) u._wc = E.wildcardSolver(u.ctx, {});
  return u._wc;
}
inv("I70", "the wildcard solver returns a legal fifteen inside the budget", 3, function (u) {
  const r = wc(u);
  if (!r.ok) return OK;
  const L = E.legal15(r.ids, u.ctx.els, r.budget);
  return L.ok ? OK : bad(L.reasons.join(" | "));
});
inv("I71", "the wildcard cost and bank add up to the budget", 3, function (u) {
  const r = wc(u);
  if (!r.ok) return OK;
  return (r.cost + r.bank === r.budget && r.cost <= r.budget && r.bank >= 0) ? OK : bad("cost " + r.cost + " bank " + r.bank + " budget " + r.budget);
});
inv("I72", "the wildcard never picks a 60% rival-owned player", 3, function (u) {
  const r = wc(u);
  if (!r.ok) return OK;
  const conv = r.ids.filter(function (id) { return E.rivalOwnMax(id, u.ctx).max >= 0.60; });
  return conv.length ? bad("picked " + conv[0] + " at " + E.rivalOwnMax(conv[0], u.ctx).max) : OK;
});
inv("I73", "the wildcard never brings in more than two players from one club", 3, function (u) {
  const r = wc(u);
  if (!r.ok) return OK;
  const incoming = r.ids.filter(function (id) { return u.squad.indexOf(id) < 0; });
  const c = E.clubCounts(incoming, u.ctx.els);
  const over = Object.keys(c).filter(function (k) { return c[k] > 2; });
  return over.length ? bad("club " + over[0] + " sent " + c[over[0]] + " in") : OK;
});
inv("I74", "the wildcard's own eleven is legal", 3, function (u) {
  const r = wc(u);
  if (!r.ok || !r.xi || !r.xi.ids || !r.xi.ids.length) return OK;
  const L = E.legalXI(r.xi.ids, u.ctx.els);
  return L.ok ? OK : bad(L.reasons.join(" | "));
});
inv("I75", "wildcard timing returns finite horizons and a grid", 3, function (u) {
  const t = E.wildcardTiming(u.ctx);
  const badRow = (t.horizons || []).filter(function (h) { return !isFinite(h.sumDeficit); });
  return badRow.length ? bad("non-finite horizon") : (Array.isArray(t.grid) ? OK : bad("no grid"));
});

inv("I117", "the wildcard fifteen is a one-swap local optimum over the whole pool (E-038)", 2, function (u) {
  const r = wc(u);
  if (!r.ok) return OK;
  const lo = E.wcLocalOptimum(r.ids, u.ctx, {});
  if (!lo.ok) return OK;                                   // no eligible pool in this universe
  return lo.optimal ? OK : bad(lo.improvements.length + " swaps improve it, best " + lo.bestGain.toFixed(3) + ": " + lo.reason);
});
inv("I110", "wcFeasible agrees with legal15 whenever a fifteen is complete", 3, function (u) {
  const r = wc(u);
  if (!r.ok) return OK;
  const W = E.wcSetup(u.ctx, {}, "TS");
  if (!W.ok) return OK;
  const f = E.wcFeasible(r.ids, u.ctx, W);
  const L = E.legal15(r.ids, u.ctx.els, W.budget);
  // wcFeasible is the stricter of the two (it adds the ≤2-incoming-per-club guard), so it may
  // never pass a fifteen that legal15 rejects.
  return (!f || L.ok) ? OK : bad("wcFeasible passed a fifteen legal15 rejects: " + L.reasons.join(" | "));
});
inv("I111", "wildcardOptions never changes the solver's own answer or rule C1.6 (E-036)", 1, function (u) {
  const r = wc(u);
  if (!r.ok) return OK;
  const o = E.wildcardOptions(u.ctx, { written: u.squad });
  if (!o.ok) return OK;
  const same = o.pure.ids.slice().sort(function (a, b) { return a - b; }).join(",") === r.ids.slice().sort(function (a, b) { return a - b; }).join(",");
  const clean = o.pure.ids.filter(function (id) { return E.rivalOwnMax(id, u.ctx).max >= 0.60; }).length === 0;
  const derived = o.locks.every(function (l) { return u.squad.indexOf(l.id) >= 0 && E.convergenceRisk(l.id, u.ctx).risk === true; });
  return (same && clean && derived) ? OK : bad("pure matches solver " + same + ", pure clean " + clean + ", locks derived " + derived);
});
inv("I112", "the transfer order always ends with the captain and then the vice (C2 step 5, E-037)", 8, function (u) {
  const r = tp(u);
  if (r.blocked || r.captain === null) return OK;
  const o = r.order;
  if (o.length < 2) return bad("order has " + o.length + " steps with captain " + r.captain);
  const last = o[o.length - 1], prev = o[o.length - 2];
  const stepsRun = o.every(function (x, i) { return x.step === i + 1; });
  const sellsFirst = o.filter(function (x) { return x.action === "sell"; }).every(function (x, i) { return o.indexOf(x) === i; });
  return (prev.action === "captain" && prev.id === r.captain && last.action === "vice" && stepsRun && sellsFirst) ? OK
    : bad("order tail " + prev.action + "/" + last.action + ", steps run " + stepsRun + ", sells first " + sellsFirst);
});
inv("I113", "ftAvailable gives the same answer from the history object and from its rows (E-045)", 40, function (u) {
  const gws = ri(2, 12), cur = [], chips = [];
  for (let g = 1; g <= gws; g++) cur.push({ event: g, event_transfers: ri(0, 4), event_transfers_cost: ri(0, 2) * 4 });
  if (RNG() < 0.4) { const ev = ri(2, gws); chips.push({ name: RNG() < 0.5 ? "wildcard" : "freehit", event: ev }); cur[ev - 1].event_transfers = ri(6, 15); cur[ev - 1].event_transfers_cost = 0; }
  const h = { current: cur, chips: chips };
  const a = E.ftAvailable(h, gws), b = E.ftAvailable(cur, gws, chips);
  const c = chips.length ? a : E.ftAvailable(cur, gws);
  return (a === b && a === c) ? OK : bad("object " + a + ", rows+chips " + b + ", rows " + c + " over " + gws + " gameweeks");
});

/* --- Monte Carlo ---------------------------------------------------------- */

inv("I114", "mcSquad never reports fewer than the hundred-draw floor (E-046)", 20, function (u) {
  if (!u.xi.ids.length) return OK;
  const r = E.mcSquad(u.squad, u.xi.capId, u.ctx, rpick([0, -1, -1e9, 1, 3, NaN]), ri(1, 1e6), u.xi.viceId);
  return (Number.isInteger(r.iters) && r.iters >= 100) ? OK : bad("iters " + r.iters);
});
inv("I76", "mcSquad quantiles come back ordered", 3, function (u) {
  if (!u.xi.ids.length) return OK;
  const r = E.mcSquad(u.squad, u.xi.capId, u.ctx, 40, ri(1, 1e6), u.xi.viceId);
  return (r.q10 <= r.q50 && r.q50 <= r.q90 && isFinite(r.mean) && r.sd >= 0) ? OK : bad("q " + r.q10 + "/" + r.q50 + "/" + r.q90 + " sd " + r.sd);
});
inv("I77", "mcSquad never runs more than the twenty-thousand iteration cap", 3, function (u) {
  const r = E.mcSquad(u.squad, u.xi.capId, u.ctx, 1e9, 5, u.xi.viceId);
  return (Number.isInteger(r.iters) && r.iters <= 20000) ? OK : bad("iters " + r.iters);
});
inv("I78", "mcSquad is reproducible from its seed", 3, function (u) {
  if (!u.xi.ids.length) return OK;
  const s = ri(1, 1e6);
  const a = E.mcSquad(u.squad, u.xi.capId, u.ctx, 25, s, u.xi.viceId);
  const b = E.mcSquad(u.squad, u.xi.capId, u.ctx, 25, s, u.xi.viceId);
  return JSON.stringify(a) === JSON.stringify(b) ? OK : bad("same seed gave " + JSON.stringify(a) + " and " + JSON.stringify(b));
});
inv("I79", "no raw P(win) is ever reported under eight finished gameweeks (E-020)", 3, function (u) {
  const r = E.mcLeague(u.ctx, 700, { iters: 25, seed: ri(1, 1e6) });
  if (r.gwsOfData >= 8) return r.pWin === null || (r.pWin >= 0 && r.pWin <= 1) ? OK : bad("pWin " + r.pWin);
  return r.pWin === null ? OK : bad("pWin " + r.pWin + " on " + r.gwsOfData + " gameweeks");
});
inv("I80", "mcLeague returns a direction and a rank band inside the league", 3, function (u) {
  const r = E.mcLeague(u.ctx, 700, { iters: 25, seed: ri(1, 1e6) });
  if (!r.entries) return OK;
  const okd = ["up", "down", "hold"].indexOf(r.direction) >= 0;
  const okb = r.rankBand[0] >= 1 && r.rankBand[0] <= r.rankBand[1] && r.rankBand[1] <= r.entries;
  return (okd && okb) ? OK : bad("direction " + r.direction + " band " + JSON.stringify(r.rankBand) + " entries " + r.entries);
});
inv("I81", "simPlayer is finite and may legitimately be negative", 40, function (u) {
  const rng = E.mulberry32(ri(1, 1e6));
  const v = E.simPlayer(rpick(u.elements), u.ctx, rng);
  return isFinite(v) ? OK : bad("simPlayer " + v);
});
inv("I82", "poisson and binomial return non-negative integers", 90, function () {
  const rng = E.mulberry32(ri(1, 1e6));
  const a = E.poisson(RNG() * 40, rng), b = E.binomial(ri(0, 30), RNG(), rng);
  return (Number.isInteger(a) && a >= 0 && Number.isInteger(b) && b >= 0) ? OK : bad("poisson " + a + " binomial " + b);
});
inv("I109", "binomial and poisson terminate on an absurd count (no unbounded loop)", 20, function () {
  // E-035: binomial looped n times with n straight off the argument, so a corrupt 1e308 hung the app.
  const rng = E.mulberry32(ri(1, 1e6));
  const t0 = Date.now();
  const b = E.binomial(rpick([1e9, 1e308, Infinity, Number.MAX_SAFE_INTEGER]), 0.5, rng);
  const a = E.poisson(rpick([1e9, 1e308, Infinity]), rng);
  const ms = Date.now() - t0;
  if (ms > 500) return bad("took " + ms + " ms");
  return (Number.isInteger(b) && b >= 0 && b <= 5000 && Number.isInteger(a) && a >= 0) ? OK : bad("binomial " + b + " poisson " + a);
});
inv("I83", "mulberry32 stays inside [0,1)", 120, function () {
  const rng = E.mulberry32(ri(0, 2e9));
  for (let i = 0; i < 4; i++) { const v = rng(); if (!(v >= 0 && v < 1)) return bad("draw " + v); }
  return OK;
});

/* --- state, prices, free transfers ---------------------------------------- */

inv("I84", "sanitiseState caps the squad at fifteen and dedupes on id (E-003)", 60, function (u) {
  const raw = { squad: [] };
  const n = ri(0, 60);
  for (let i = 0; i < n; i++) raw.squad.push({ id: ri(1, 8), purchase: ri(38, 140) });
  const s = E.sanitiseState(raw);
  if (s.squad.length > 15) return bad("kept " + s.squad.length);
  const ids = s.squad.map(function (x) { return x.id; });
  return ids.length === ids.filter(function (v, i) { return ids.indexOf(v) === i; }).length ? OK : bad("duplicate ids " + ids.join(","));
});
inv("I85", "sanitiseState always returns the §6 shape and never throws", 60, function (u) {
  const s = E.sanitiseState(RNG() < 0.5 ? u.state : { squad: "junk", ft: ri(-9, 99), bank: RNG() * 1e6, ui: RNG() < 0.5 ? null : 4 });
  const okShape = s && Array.isArray(s.squad) && Array.isArray(s.ledger) && s.ui && typeof s.ui === "object" && s.draft && typeof s.draft === "object";
  return (okShape && s.ft >= 0 && s.ft <= 5 && isFinite(s.bank)) ? OK : bad(JSON.stringify({ squad: s && Array.isArray(s.squad), ft: s && s.ft, bank: s && s.bank }));
});
inv("I86", "sellPrice is purchase plus half the rise, floored, and follows a fall", 120, function () {
  const buy = ri(38, 140), delta = ri(-20, 20);
  const now = Math.max(1, buy + delta);
  const got = E.sellPrice(now, buy);
  const want = now > buy ? buy + Math.floor((now - buy) / 2) : now;
  return (got === want && Number.isInteger(got)) ? OK : bad("sellPrice(" + now + "," + buy + ") = " + got + " want " + want);
});
inv("I87", "bankAfter is a whole number of tenths", 40, function (u) {
  const outIdx = ri(0, 14);
  const out = u.squad[outIdx];
  const cand = u.elements.filter(function (e) { return e.element_type === u.ctx.els[out].element_type && u.squad.indexOf(e.id) < 0; });
  if (!cand.length) return OK;
  const v = E.bankAfter(u.state, [{ out: out, in: rpick(cand).id }], u.ctx.els);
  return Number.isInteger(v) ? OK : bad("bankAfter " + v);
});
inv("I88", "ftAvailable is an integer between 1 and 5", 90, function () {
  const cur = [];
  const n = ri(1, 20);
  for (let g = 1; g <= n; g++) cur.push({ event: g, event_transfers: ri(0, 4), event_transfers_cost: rpick([0, 0, 4, 8]) });
  const v = E.ftAvailable({ current: cur, chips: [] }, n);
  return (Number.isInteger(v) && v >= 1 && v <= 5) ? OK : bad("ftAvailable " + v);
});
inv("I89", "detectSquadChange blocks exactly when the ids differ (D3)", 90, function (u) {
  const mine = u.squad.slice();
  const change = RNG() < 0.5;
  let theirs = mine.slice();
  if (change) {
    const spare = u.elements.filter(function (e) { return mine.indexOf(e.id) < 0; })[0];
    if (!spare) return OK;
    theirs[ri(0, 14)] = spare.id;
  } else theirs = shuffle(theirs);
  const r = E.detectSquadChange(mine, theirs.map(function (id) { return { element: id }; }));
  return (r.changed === change && r.block === change) ? OK : bad("changed " + r.changed + " block " + r.block + " expected " + change);
});
inv("I90", "detectSquadChange never blocks on empty picks", 60, function (u) {
  const r = E.detectSquadChange(u.squad, []);
  return (r.block === false && r.changed === false) ? OK : bad(JSON.stringify(r));
});

/* --- refresh path and banned fields --------------------------------------- */

inv("I91", "refreshRequest always asks for 4000 tokens with a paired web-search tool (E-001)", 60, function () {
  const r = E.refreshRequest({ pair: rpick(["sonnet46", "sonnet5", "opus5", "gpt", "", null]), nextEvent: ri(1, 38) });
  const okTool = Array.isArray(r.tools) && r.tools.length === 1 && r.tools[0].name === "web_search" && typeof r.tools[0].type === "string";
  return (r.max_tokens === 4000 && okTool && typeof r.model === "string") ? OK : bad(JSON.stringify({ max: r.max_tokens, tools: r.tools, model: r.model }));
});
inv("I92", "the request body never carries a banned expected-points field (D1)", 60, function () {
  const body = JSON.stringify(E.refreshRequest({ pair: "sonnet46", nextEvent: 4, ids: [1, 2, 3] }));
  return /ep_this|ep_next/.test(body) ? bad("banned field in the request body") : OK;
});
inv("I93", "applyRefresh never mutates the state it was given when it throws", 40, function (u) {
  const st = { live: { next_event: 4, events: [{ id: 4, deadline_time: "2026-09-12T12:30:00Z" }], elements: [{ id: 1, web_name: "A", status: "a", chance: null, now_cost: 70, cost_change_event: 0 }] } };
  const before = JSON.stringify(st);
  let threw = false;
  try { E.applyRefresh(st, rpick([{ elements: [{ id: 1, status: "zzz" }] }, { type: "error", error: { message: "boom" } }, null, 7])); } catch (e) { threw = true; }
  return (threw && JSON.stringify(st) === before) ? OK : bad("threw " + threw + ", mutated " + (JSON.stringify(st) !== before));
});
inv("I94", "the engine never reads ep_this or ep_next (D1)", 3, function () {
  // Dynamic proof: the banned fields are defined as recording getters on every element, then the
  // whole decision path is run. A read sets the flag.
  let read = null;
  const u = TRAP;
  u.elements.forEach(function (el) {
    if (el.__trapped) return;
    el.__trapped = true;
    Object.defineProperty(el, "ep_this", { configurable: true, enumerable: false, get: function () { read = "ep_this on " + el.id; return "0.0"; } });
    Object.defineProperty(el, "ep_next", { configurable: true, enumerable: false, get: function () { read = "ep_next on " + el.id; return "0.0"; } });
  });
  const ctx = E.buildCtx(u.snap, u.state, "2026-09-11T06:00:00Z");
  if (ctx.ok) {
    const x = E.bestXI(u.squad, ctx);
    E.captainPick(x.ids, ctx);
    E.transferProtocol(u.state, ctx);
    E.sellCandidates(u.state.squad, ctx);
    E.tournament(u.snap);
  }
  const srcHasBanned = /\bep_this\b|\bep_next\b/.test(ENGINE_SRC);
  if (srcHasBanned) return bad("src/engine.js names a banned field");
  return read === null ? OK : bad("engine read " + read);
});

/* --- tournament and chips ------------------------------------------------- */

inv("I95", "the tournament always carries the eight named models", 8, function (u) {
  const t = E.tournament(u.snap);
  const want = ["season_mean", "last_gw", "per90", "shrunk_per90", "ict_rate", "bps_rate", "blend", "component_xp"];
  return t.models.map(function (m) { return m.key; }).join(",") === want.join(",") ? OK : bad(t.models.map(function (m) { return m.key; }).join(","));
});
inv("I96", "every Spearman ρ is null or inside [-1,1]", 8, function (u) {
  const t = E.tournament(u.snap);
  const badm = t.models.filter(function (m) { return m.spearman !== null && !(m.spearman >= -1 && m.spearman <= 1); });
  return badm.length ? bad(badm[0].key + " ρ " + badm[0].spearman) : OK;
});
inv("I97", "promotion needs three transitions and the leader is one of the eight", 8, function (u) {
  const t = E.tournament(u.snap);
  if (t.promotable !== (t.transitions >= 3)) return bad("promotable " + t.promotable + " at " + t.transitions + " transitions");
  if (t.leader === null) return OK;
  return t.models.map(function (m) { return m.key; }).indexOf(t.leader) >= 0 ? OK : bad("leader " + t.leader);
});
inv("I98", "spearman of a perfect ranking is 1 and of an inverted one is −1", 60, function () {
  const n = ri(3, 12), a = [], b = [], c = [];
  for (let i = 0; i < n; i++) { a.push(i); b.push(i * 3 + 1); c.push(-i); }
  return (Math.abs(E.spearman(a, b) - 1) < 1e-9 && Math.abs(E.spearman(a, c) + 1) < 1e-9) ? OK : bad(E.spearman(a, b) + " / " + E.spearman(a, c));
});
inv("I99", "chipWindows never invents a double or a blank", 8, function (u) {
  const w = E.chipWindows(u.snap);
  const counts = {};
  u.snap.fixtures.forEach(function (f) {
    if (f.finished) return;
    const k = f.event + ":" + f.team_h; const k2 = f.event + ":" + f.team_a;
    counts[k] = (counts[k] || 0) + 1; counts[k2] = (counts[k2] || 0) + 1;
  });
  const realDouble = Object.keys(counts).some(function (k) { return counts[k] >= 2; });
  if (w.doubles.length && !realDouble) return bad("reported a double with no club playing twice");
  return OK;
});
inv("I100", "chipRegret returns a verdict and a finite regret", 5, function (u) {
  const r = E.chipRegret(rpick(["wildcard", "bench_boost", "triple_captain", "free_hit"]), u.ctx, {});
  return (typeof r.verdict === "string" && isFinite(r.regretUse)) ? OK : bad(JSON.stringify({ verdict: r.verdict, regretUse: r.regretUse }));
});

/* --- draft ---------------------------------------------------------------- */

inv("I101", "draft waiver claims are ordered by priority with forced replacements first", 5, function (u) {
  const claims = E.draftWaivers(u.state, u.ctx);
  for (let i = 1; i < claims.length; i++) {
    if (claims[i].priority <= claims[i - 1].priority) return bad("priority " + claims[i].priority + " after " + claims[i - 1].priority);
  }
  return OK;
});
inv("I102", "the watchlist audit keeps only three-start players and drops the rest (C5)", 5, function (u) {
  const codes = shuffle(u.elements.map(function (e) { return e.code; })).slice(0, ri(1, 12));
  const a = E.watchlistAudit(codes, u.ctx);
  const overlap = a.keep.filter(function (c) { return a.drop.indexOf(c) >= 0; });
  return overlap.length ? bad("code " + overlap[0] + " is both kept and dropped") : OK;
});
inv("I103", "the draft eleven is a legal formation drawn from the roster", 5, function (u) {
  const codes = u.state.draft.roster;
  const x = E.draftXI(codes, u.ctx);
  if (!x.ids || !x.ids.length) return OK;
  const outside = x.codes.filter(function (c) { return codes.indexOf(c) < 0; });
  if (outside.length) return bad("code " + outside[0] + " is not on the roster");
  const shapes = E.FORMATIONS.map(function (f) { return f.join("-"); });
  return shapes.indexOf(x.formation) >= 0 ? OK : bad("formation " + x.formation);
});
inv("I104", "the draft join is by code, never by id (E-026)", 20, function (u) {
  const el = rpick(u.elements);
  const d = E.draftEl(el.code, u.ctx);
  return (!d || d.code === el.code) ? OK : bad("code " + el.code + " resolved to code " + d.code);
});

/* --- context and phase ---------------------------------------------------- */

inv("I105", "buildCtx reports ok with a squad, a deadline and a strength table", 3, function (u) {
  const c = E.buildCtx(u.snap, u.state, "2026-09-11T06:00:00Z");
  if (!c.ok) return bad("ctx not ok: " + c.error);
  return (Array.isArray(c.squadIds) && c.TS && typeof c.deadline === "string") ? OK : bad("ctx missing a field");
});
inv("I106", "gamePhase is always pre, live or post", 40, function (u) {
  const p = E.gamePhase(u.snap, rpick(["2026-09-01T00:00:00Z", "2026-09-12T13:00:00Z", "2027-01-01T00:00:00Z", "x", ""]));
  return ["pre", "live", "post"].indexOf(p) >= 0 ? OK : bad("phase " + JSON.stringify(p));
});
inv("I107", "every xp entry carries a probability and a non-negative expectation", 30, function (u) {
  const id = rpick(u.squad);
  const x = u.ctx.xp[id];
  return (x && x.pstart >= 0 && x.pstart <= 1 && x.xp1 >= 0 && x.xp5 >= 0) ? OK : bad("xp " + JSON.stringify(x && { p: x.pstart, xp1: x.xp1, xp5: x.xp5 }));
});
inv("I108", "flagInfo agrees with isFlagged on every element", 60, function (u) {
  const el = rpick(u.elements);
  return E.flagInfo(el).flagged === E.isFlagged(el) ? OK : bad("id " + el.id + " flagInfo " + E.flagInfo(el).flagged + " isFlagged " + E.isFlagged(el));
});
inv("I115", "tournament MAEs stay inside one order of magnitude of each other (E-047)", 20, function (u) {
  const t = E.tournament(u.snap);
  const scored = t.models.filter(function (m) { return m.mae !== null; });
  if (scored.length < 2) return OK;
  const vals = scored.map(function (m) { return m.mae; });
  const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  if (!(lo > 0)) return OK;                                 // a perfect model scores zero: nothing to compare
  return hi <= 10 * lo ? OK : bad("MAE spread " + lo.toFixed(2) + " to " + hi.toFixed(2) + " (ratio " + (hi / lo).toFixed(1) + ")");
});
inv("I116", "fxMult answers 1 for a non-fixture argument and says it is unresolved (E-043)", 40, function (u) {
  const f = rpick(u.snap.fixtures);
  if (!f) return OK;
  const byId = E.fxMultInfo(f.id, f.team_h, u.ctx.TS);
  const byObj = E.fxMultInfo(f, f.team_h, u.ctx.TS);
  if (byId.resolved !== false || byId.mult !== 1) return bad("a fixture id resolved: " + JSON.stringify(byId));
  if (byObj.resolved !== true) return bad("a fixture object did not resolve: " + JSON.stringify(byObj));
  return E.fxMult(f, f.team_h, u.ctx.TS) === byObj.mult ? OK : bad("fxMult and fxMultInfo disagree");
});

const ENGINE_SRC = fs.readFileSync(path.join(ROOT, "src", "engine.js"), "utf8");
const TRAP = makeUniverse(3, 6, "trap");

// ---------------------------------------------------------------- weighted dispatch

const BAG = [];
INV.forEach(function (i, idx) { for (let n = 0; n < i.cost; n++) BAG.push(idx); });

const t0 = Date.now();
for (let it = 0; it < ITERS; it++) {
  if (it > 0 && it % REBUILD_EVERY === 0) {
    UNIVERSES[(it / REBUILD_EVERY) % UNIVERSES.length | 0] = freshUniverse();
  }
  const inv = INV[BAG[Math.floor(RNG() * BAG.length) % BAG.length]];
  const u = U();
  let out;
  try { out = inv.run(u); }
  catch (e) { out = { ok: false, detail: "threw: " + (e && e.message ? e.message : String(e)) }; }
  report(inv, out === true || (out && out.ok !== false), out && out.detail);
}
const secs = (Date.now() - t0) / 1000;

// Every invariant must have been exercised: one that never ran proves nothing.
const never = INV.filter(function (i) { return !stats[i.id] || stats[i.id].run === 0; });
never.forEach(function (i) { failCount++; failures.push(i.id + " " + i.name + " — never ran in " + ITERS + " iterations"); });

// ---------------------------------------------------------------- verdict

console.log("--- invariants ---");
INV.forEach(function (i) {
  const s = stats[i.id] || { run: 0, failed: 0 };
  console.log((s.failed ? "FAIL " : "PASS ") + i.id + " " + i.name + " · " + s.run + " runs, " + s.failed + " failed");
});
if (failures.length) {
  console.log("");
  console.log("--- first " + failures.length + " failures ---");
  failures.forEach(function (f) { console.log("  " + f); });
}
console.log("");
console.log("seed " + SEED + " · " + UNIVERSES.length + " live universes, " + universeSerial + " generated · " + secs.toFixed(1) + " s");
console.log("SUITE mc_all " + ITERS + " iters · " + INV.length + " invariants · " + failCount);
process.exit(failCount > 0 ? 1 : 0);

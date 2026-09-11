/*
 * qa/unit_engine.cjs — deterministic unit suite for src/engine.js.
 *
 * Plain node, no framework. Prints "PASS <name>" / "FAIL <name> — <detail>" per check,
 * then "SUITE unit_engine <pass>/<total>"; exits 1 on any FAIL (CONTRACT §8).
 *
 * Two data sources:
 *   SYN  — a synthetic snapshot in the CONTRACT §3 shape, built here so every number is
 *          known in advance. 6 teams · 36 players · 3 finished gameweeks · GW4 next.
 *          (The brief asked for 4 teams; a legal fifteen needs 2/5/5/3 under the
 *          ≤3-per-club rule, which is impossible with fewer than five clubs, so the
 *          snapshot carries six. Everything else is as specified.)
 *   LIVE — data/live.json, used for the E-026 draft↔classic join regression and for a
 *          live sanity block that prints real numbers.
 *
 * Run: node qa/unit_engine.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const E = require(path.join(ROOT, "src", "engine.js"));

// ---------------------------------------------------------------- reporting

let pass = 0, fail = 0;
const failures = [];

function assert(name, cond, detail) {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++;
  const d = detail === undefined || detail === null || detail === "" ? "no detail given" : String(detail);
  failures.push(name + " — " + d);
  console.log("FAIL " + name + " — " + d);
  return false;
}
function check(name, fn) {
  try {
    const r = fn();
    if (r && typeof r === "object" && "ok" in r) return assert(name, r.ok, r.detail);
    return assert(name, r === true, r === true ? "" : "returned " + JSON.stringify(r));
  } catch (e) {
    return assert(name, false, "threw: " + (e && e.message ? e.message : String(e)));
  }
}
function close(a, b, tol) { return typeof a === "number" && isFinite(a) && Math.abs(a - b) <= tol; }
function r2(x) { return Math.round(x * 100) / 100; }
function r4(x) { return Math.round(x * 10000) / 10000; }

// ================================================================ synthetic snapshot

const SYN_NOW = "2026-09-11T06:00:00Z";
const TEAMS = [1, 2, 3, 4, 5, 6];
const TYPE_OF_J = [1, 2, 2, 3, 3, 4];                     // 6 players per club: GKP DEF DEF MID MID FWD
const BASE_COST = { 1: 45, 2: 50, 3: 70, 4: 85 };

function idFor(t, j) { return (t - 1) * 6 + j + 1; }

// Per-player minute/start pattern across GW1..GW3.
// "reg" three starts · "rot" benched in GW2 · "dead" never played · "back" a Konsa-style return.
const PATTERN = {};
for (let t = 1; t <= 6; t++) for (let j = 0; j < 6; j++) PATTERN[idFor(t, j)] = "reg";
PATTERN[34] = "dead";                 // t6 MID — forced sell in the synthetic squad
PATTERN[35] = "rot";                  // t6 MID — rotation risk, tier 1
PATTERN[3] = "back";                  // t1 DEF — did not start GW1/GW2, started GW3 (Konsa rule)
PATTERN[21] = "dead";                 // t4 DEF — a dead player outside the squad
PATTERN[29] = "rot";                  // t5 MID
PATTERN[13] = "rot";                  // t3 GKP

// Points per appearance; deliberately spread so shrunkPps and the tournament models differ.
const QUALITY = {};
for (let id = 1; id <= 36; id++) QUALITY[id] = 2 + ((id * 7) % 6);
QUALITY[5] = 14;      // t1 MID — the best midfielder in the game, owned by every rival (convergence)
QUALITY[22] = 15;     // t4 MID — the flagged star: highest EV, must never be captain
QUALITY[16] = 12;     // t3 MID — the clean captain pick
QUALITY[11] = 11;     // t2 MID — a genuine differential (no rival owns him)
QUALITY[17] = 10;     // t3 MID — 75% rival-owned, SHARED

function fixturesFor() {
  // Six teams, three fixtures a gameweek, a simple rotation over GW1..GW8.
  const rounds = [
    [[1, 2], [3, 4], [5, 6]],
    [[2, 3], [4, 5], [6, 1]],
    [[3, 1], [5, 2], [4, 6]],
    [[1, 4], [2, 6], [3, 5]],
    [[6, 3], [5, 1], [4, 2]],
    [[2, 5], [1, 3], [6, 4]],
    [[4, 1], [3, 6], [5, 2]],
    [[1, 6], [2, 4], [3, 5]]
  ];
  const out = [];
  for (let g = 1; g <= 8; g++) {
    rounds[g - 1].forEach(function (p, i) {
      out.push({
        id: g * 10 + i + 1, event: g, team_h: p[0], team_a: p[1],
        team_h_difficulty: 2 + ((p[1] + g) % 4), team_a_difficulty: 2 + ((p[0] + g) % 4),
        finished: g <= 3, started: g <= 3,
        kickoff_time: "2026-0" + (7 + Math.floor((g - 1) / 4)) + "-" + String(10 + g).padStart(2, "0") + "T14:00:00Z",
        team_h_score: g <= 3 ? (p[0] % 3) : null,
        team_a_score: g <= 3 ? (p[1] % 2) : null
      });
    });
  }
  return out;
}

function buildSyn() {
  const fixtures = fixturesFor();
  const elements = [];
  for (let t = 1; t <= 6; t++) {
    for (let j = 0; j < 6; j++) {
      const id = idFor(t, j), type = TYPE_OF_J[j];
      elements.push({
        id: id, code: 500000 + id, web_name: "P" + id, team: t, element_type: type,
        now_cost: BASE_COST[type] + (id % 7), cost_change_event: 0, cost_change_start: 0,
        selected_by_percent: 5 + (id % 20), status: "a", news: "", chance: null,
        total_points: 0, minutes: 0, starts: 0, xg: 0, xa: 0, xgc: 0, dc: 0, bps: 0, ict: 0,
        form: 0, goals: 0, assists: 0, cs: 0, gc: 0, bonus: 0, yc: 0, rc: 0, og: 0,
        pen_miss: 0, pen_save: 0, saves: 0, transfers_in_event: 0, transfers_out_event: 0
      });
    }
  }
  const byId = {}; elements.forEach(function (e) { byId[e.id] = e; });

  // The flagged star (C1 rule 2: any flag excludes him from the captaincy).
  byId[22].status = "d"; byId[22].chance = 75; byId[22].news = "Knock — 75% chance of playing";

  const gw = {};
  for (let g = 1; g <= 3; g++) {
    const rows = {}, fxg = {};
    fixtures.filter(function (f) { return f.event === g; }).forEach(function (f) {
      fxg[f.id] = { h: r2(0.8 + (f.team_h % 4) * 0.35), a: r2(0.6 + (f.team_a % 3) * 0.4) };
    });
    elements.forEach(function (el) {
      const p = PATTERN[el.id];
      let min = 90, starts = 1;
      if (p === "dead") { min = 0; starts = 0; }
      else if (p === "rot" && g === 2) { min = 18; starts = 0; }
      else if (p === "back" && g < 3) { min = 0; starts = 0; }
      if (min === 0) return;                                        // §3: 0-minute elements are omitted
      const type = el.element_type;
      const q = QUALITY[el.id];
      const goals = type >= 3 && q >= 10 && g !== 2 ? 1 : 0;
      const assists = type === 3 && q >= 8 && g === 2 ? 1 : 0;
      const cs = type <= 2 && (el.team + g) % 2 === 0 ? 1 : 0;
      const gcf = cs ? 0 : ((el.team + g) % 3);
      const dcv = type === 2 ? 8 + ((el.id + g) % 6) : (type === 1 ? 0 : 9 + ((el.id + g) % 6));
      const saves = type === 1 ? 2 + ((el.id + g) % 4) : 0;
      const bonus = q >= 12 && g !== 2 ? 2 : 0;
      const pts = starts ? q + (g % 2) : Math.max(1, Math.round(q / 3));
      rows[el.id] = [
        min, starts, pts,
        r2(type >= 3 ? 0.2 + (q % 5) * 0.11 : 0.05),                // xg
        r2(type === 3 ? 0.15 + (q % 4) * 0.09 : 0.04),              // xa
        r2(0.6 + (el.team % 4) * 0.3),                              // xgc
        dcv, 10 + q + g, r2(4 + q * 0.8),                           // dc, bps, ict
        goals, assists, cs, gcf, bonus,
        (el.id + g) % 11 === 0 ? 1 : 0,                             // yc
        0, 0, 0, 0, saves                                           // rc, og, pen_miss, pen_save, saves
      ];
    });
    gw[String(g)] = { elements: rows, fixture_xg: fxg };
  }

  // Season totals aggregated straight out of the gameweek rows (self-consistent by construction).
  elements.forEach(function (el) {
    let tp = 0, mn = 0, st = 0, xg = 0, xa = 0, xgc = 0, dc = 0, bps = 0, ict = 0;
    let goals = 0, assists = 0, cs = 0, gc = 0, bonus = 0, yc = 0, saves = 0;
    for (let g = 1; g <= 3; g++) {
      const row = gw[String(g)].elements[el.id];
      if (!row) continue;
      mn += row[0]; st += row[1]; tp += row[2]; xg += row[3]; xa += row[4]; xgc += row[5];
      dc += row[6]; bps += row[7]; ict += row[8]; goals += row[9]; assists += row[10];
      cs += row[11]; gc += row[12]; bonus += row[13]; yc += row[14]; saves += row[19];
    }
    el.total_points = tp; el.minutes = mn; el.starts = st;
    el.xg = r2(xg); el.xa = r2(xa); el.xgc = r2(xgc); el.dc = dc; el.bps = bps; el.ict = r2(ict);
    el.goals = goals; el.assists = assists; el.cs = cs; el.gc = gc; el.bonus = bonus; el.yc = yc; el.saves = saves;
    el.form = r2(tp / 3);
  });

  const events = [];
  for (let g = 1; g <= 8; g++) {
    events.push({
      id: g, name: "Gameweek " + g,
      deadline_time: "2026-0" + (7 + Math.floor((g - 1) / 4)) + "-" + String(10 + g).padStart(2, "0") + "T12:30:00Z",
      is_current: g === 3, is_next: g === 4, finished: g <= 3, average_entry_score: 45 + g
    });
  }

  const SQUAD = [1, 7, 2, 9, 14, 20, 26, 4, 16, 22, 28, 34, 12, 18, 30];   // 2-5-5-3, ≤3 per club

  // Four rival fifteens, laid out by hand so the ownership shares are exactly known:
  //   element 5  → 4 of 4 rivals (1.00) — the convergence exhibit, must never be bought
  //   element 17 → 3 of 4 (0.75)        — SHARED
  //   element 11 → 0 of 4 (0.00)        — the differential
  //   everything else ≤ 2 of 4 (0.50)   — below the 0.60 convergence gate, so the pools stay deep
  const RIVAL_PICKS = [
    { gk: [1, 7], def: [2, 3, 8, 9, 14], mid: [5, 17, 4, 10, 16], fwd: [6, 12, 18], cap: 5 },
    { gk: [13, 19], def: [15, 20, 21, 26, 27], mid: [5, 17, 22, 23, 28], fwd: [24, 30, 36], cap: 5 },
    { gk: [25, 31], def: [32, 33, 2, 3, 8], mid: [5, 17, 29, 34, 35], fwd: [6, 12, 24], cap: 5 },
    { gk: [1, 7], def: [9, 14, 15, 20, 21], mid: [5, 4, 10, 16, 22], fwd: [18, 30, 36], cap: 16 }
  ];
  const rivals = {};
  const rivalIds = [101, 102, 103, 104];
  rivalIds.forEach(function (r, i) {
    const p = RIVAL_PICKS[i];
    const xi = [p.gk[0]].concat(p.def.slice(0, 4), p.mid.slice(0, 4), p.fwd.slice(0, 2));   // 1 GKP · 4 DEF · 4 MID · 2 FWD
    const bench = [p.gk[1], p.def[4], p.mid[4], p.fwd[2]];
    const all = xi.concat(bench);
    rivals[r] = {
      event: 3,
      picks: all.map(function (el, k) {
        return { element: el, position: k + 1, multiplier: k < 11 ? (el === p.cap ? 2 : 1) : 0, is_captain: el === p.cap, is_vice_captain: k === 1 };
      })
    };
  });

  const picksGw3 = { active_chip: null, picks: SQUAD.map(function (el, k) { return { element: el, position: k + 1, multiplier: k < 11 ? 1 : 0, is_captain: el === 16, is_vice_captain: el === 4 }; }) };

  const draftElements = elements.map(function (el) {
    // Five players deliberately carry a different draft id from their classic id (E-026 shape).
    const shifted = [4, 11, 17, 22, 30].indexOf(el.id) >= 0;
    return { id: shifted ? el.id + 100 : el.id, code: el.code, web_name: el.web_name, team: el.team, element_type: el.element_type, status: el.status, chance: el.chance, news: el.news, starts: el.starts, minutes: el.minutes, total_points: el.total_points };
  });

  return {
    fetched_at: SYN_NOW,
    source: "synthetic snapshot built by qa/unit_engine.cjs",
    next_event: 4, current_event: 3, total_players: 1000,
    events: events,
    teams: TEAMS.map(function (t) { return { id: t, short_name: "T" + t, name: "Team " + t }; }),
    elements: elements,
    fixtures: fixtures,
    gw: gw,
    entry: { id: 3546875, name: "Synth", summary_overall_points: 178, summary_overall_rank: 500000, summary_event_points: 50, current_event: 3, last_deadline_bank: 10, last_deadline_value: 990, last_deadline_total_transfers: 0 },
    history: {
      current: [
        { event: 1, points: 58, total_points: 58, rank: 1, overall_rank: 1, bank: 10, value: 990, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 4 },
        { event: 2, points: 70, total_points: 128, rank: 1, overall_rank: 1, bank: 10, value: 990, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 6 },
        { event: 3, points: 50, total_points: 178, rank: 1, overall_rank: 1, bank: 10, value: 990, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 11 }
      ],
      chips: []
    },
    picks: { "3": picksGw3 },
    ft_available: 3,
    leagues: [{
      id: 900, name: "Synth League", size: 5, rank: 2, last_rank: 3,
      standings: [
        { entry: 101, player_name: "Rival One", entry_name: "R1", total: 190, rank: 1 },
        { entry: 3546875, player_name: "Kwezi Ngwevu", entry_name: "Synth", total: 178, rank: 2 },
        { entry: 102, player_name: "Rival Two", entry_name: "R2", total: 175, rank: 3 },
        { entry: 103, player_name: "Rival Three", entry_name: "R3", total: 170, rank: 4 },
        { entry: 104, player_name: "Rival Four", entry_name: "R4", total: 160, rank: 5 }
      ]
    }],
    rivals: rivals,
    draft: {
      game: { current_event: 3, next_event: 4, waivers_processed: false },
      events: [{ id: 4, deadline_time: "2026-08-14T12:30:00Z", waivers_time: "2026-08-13T12:30:00Z" }],
      scoring: {
        short_play: 1, long_play: 2, long_play_limit: 60,
        goals_scored_GKP: 10, goals_scored_DEF: 6, goals_scored_MID: 5, goals_scored_FWD: 4,
        assists: 3, clean_sheets_GKP: 4, clean_sheets_DEF: 4, clean_sheets_MID: 1, clean_sheets_FWD: 0,
        goals_conceded_GKP: -1, goals_conceded_DEF: -1, goals_conceded_MID: 0, goals_conceded_FWD: 0,
        concede_limit: 2, saves: 1, saves_limit: 3, penalties_saved: 5, penalties_missed: -2,
        yellow_cards: -1, red_cards: -3, own_goals: -2, bonus: 1,
        defensive_contribution_DEF: 2, defensive_contribution_limit_DEF: 10,
        defensive_contribution_MID: 2, defensive_contribution_limit_MID: 12,
        defensive_contribution_FWD: 2, defensive_contribution_limit_FWD: 12
      },
      squad: { size: 15, captains_disabled: true },
      elements: draftElements,
      league_id: null
    },
    __squad: SQUAD
  };
}

const SYN = buildSyn();
const SYN_SQUAD = SYN.__squad;
const SYN_STATE = {
  version: 87, exported_at: SYN_NOW, entry: 3546875,
  squad: SYN_SQUAD.map(function (id) {
    const el = SYN.elements.filter(function (e) { return e.id === id; })[0];
    return { id: id, purchase: el.now_cost };
  }),
  bank: 10, ft: 3, value: 990, confirmed_gw: 3,
  leagues: [900],
  draft: { league_id: null, roster: [], watchlist: [] },
  ui: { mode: "simple", tab: "command", open: {}, reveals: {} },
  ledger: [],
  refresh: { pair: "sonnet46", last: null }
};
const CTX = E.buildCtx(SYN, SYN_STATE, SYN_NOW);

// An element table with six clubs, used only by the legality checks (a legal fifteen
// needs at least five clubs under the ≤3-per-club rule).
const LEGAL_ELS = SYN.elements;

// ================================================================ E1 — the worked example

const E1_MID = { id: 9001, element_type: 3, team: 1, total_points: 21, starts: 3, status: "a", chance: null, now_cost: 70 };

check("E1-shrunkPps-5.23-worked-example", function () {
  const v = E.shrunkPps(E1_MID);
  return { ok: close(v, 5.23, 0.05), detail: "shrunkPps = " + r4(v) + ", expected 5.23 ±0.05" };
});
check("E1-pStart-0.875-worked-example", function () {
  const v = E.pStart(E1_MID, { games: 3, starts: 3, everBenched: false });
  return { ok: close(v, 0.875, 0.0001), detail: "pStart = " + r4(v) + ", expected 0.875" };
});
check("E1-xp5FromMults-16.3-worked-example", function () {
  const v = E.xp5FromMults(E1_MID, 0.875, [1.10, 0.95, 1.05, 0.90, 1.00]);
  return { ok: close(v, 16.3, 0.05), detail: "xp5 = " + r4(v) + ", expected 16.3 ±0.05" };
});
check("E1-decay-weights-are-the-published-five", function () {
  const d = E.DECAY;
  return { ok: JSON.stringify(d) === JSON.stringify([1.00, 0.82, 0.68, 0.56, 0.46]), detail: "DECAY = " + JSON.stringify(d) };
});
check("E1-pStart-benched-player-takes-the-0.85-factor", function () {
  const a = E.pStart(E1_MID, { games: 4, starts: 3, everBenched: false });
  const b = E.pStart(E1_MID, { games: 4, starts: 3, everBenched: true });
  return { ok: close(b, a * 0.85, 1e-9), detail: "unbenched " + r4(a) + " vs benched " + r4(b) };
});
check("E1-pStart-flag-scales-by-chance", function () {
  const flagged = { id: 9002, element_type: 3, team: 1, total_points: 21, starts: 3, status: "d", chance: 50 };
  const v = E.pStart(flagged, { games: 3, starts: 3, everBenched: false });
  return { ok: close(v, 0.4375, 1e-9), detail: "pStart = " + r4(v) + ", expected 0.875 × 0.50" };
});

// ================================================================ B1 — SCORING / pointsFor

function row(o) { return Object.assign({ minutes: 90 }, o); }

check("B1-goal-worth-6-6-5-4-by-position", function () {
  const got = [1, 2, 3, 4].map(function (t) { return E.pointsFor(row({ goals: 1 }), t) - E.pointsFor(row({}), t); });
  return { ok: JSON.stringify(got) === JSON.stringify([6, 6, 5, 4]), detail: "goal deltas GKP/DEF/MID/FWD = " + JSON.stringify(got) };
});
check("B1-assist-worth-3-in-every-position", function () {
  const got = [1, 2, 3, 4].map(function (t) { return E.pointsFor(row({ assists: 1 }), t) - E.pointsFor(row({}), t); });
  return { ok: JSON.stringify(got) === JSON.stringify([3, 3, 3, 3]), detail: "assist deltas = " + JSON.stringify(got) };
});
check("B1-clean-sheet-worth-4-4-1-0", function () {
  const got = [1, 2, 3, 4].map(function (t) { return E.pointsFor(row({ cs: 1 }), t) - E.pointsFor(row({}), t); });
  return { ok: JSON.stringify(got) === JSON.stringify([4, 4, 1, 0]), detail: "clean-sheet deltas = " + JSON.stringify(got) };
});
check("B1-FWD-never-earns-a-clean-sheet", function () {
  const v = E.pointsFor(row({ cs: 1, minutes: 90 }), 4);
  return { ok: v === 2, detail: "FWD 90 minutes + clean sheet = " + v + ", expected 2 (appearance only)" };
});
check("B1-clean-sheet-needs-60-minutes", function () {
  const a = E.pointsFor(row({ cs: 1, minutes: 59 }), 2), b = E.pointsFor(row({ cs: 1, minutes: 60 }), 2);
  return { ok: a === 1 && b === 6, detail: "59 min = " + a + " (expected 1), 60 min = " + b + " (expected 6)" };
});
check("B1-conceded-minus-1-per-2-for-GKP-and-DEF-only", function () {
  const got = [1, 2, 3, 4].map(function (t) { return E.pointsFor(row({ gc: 3 }), t) - E.pointsFor(row({}), t); });
  return { ok: JSON.stringify(got) === JSON.stringify([-1, -1, 0, 0]), detail: "3 conceded deltas = " + JSON.stringify(got) + ", expected [-1,-1,0,0]" };
});
check("B1-conceded-rounds-down-in-pairs", function () {
  const one = E.pointsFor(row({ gc: 1 }), 2) - E.pointsFor(row({}), 2);
  const four = E.pointsFor(row({ gc: 4 }), 2) - E.pointsFor(row({}), 2);
  return { ok: one === 0 && four === -2, detail: "1 conceded = " + one + " (expected 0), 4 conceded = " + four + " (expected -2)" };
});
check("B1-saves-1-per-3-for-GKP-only", function () {
  const gk = E.pointsFor(row({ saves: 6 }), 1) - E.pointsFor(row({}), 1);
  const def = E.pointsFor(row({ saves: 6 }), 2) - E.pointsFor(row({}), 2);
  const two = E.pointsFor(row({ saves: 2 }), 1) - E.pointsFor(row({}), 1);
  return { ok: gk === 2 && def === 0 && two === 0, detail: "GKP 6 saves = " + gk + " (2), DEF 6 saves = " + def + " (0), GKP 2 saves = " + two + " (0)" };
});
check("B1-DefCon-DEF-10-CBIT-scores-2", function () {
  const at10 = E.pointsFor(row({ dc: 10 }), 2) - E.pointsFor(row({}), 2);
  const at9 = E.pointsFor(row({ dc: 9 }), 2) - E.pointsFor(row({}), 2);
  return { ok: at10 === 2 && at9 === 0, detail: "DEF dc 10 = " + at10 + " (2), dc 9 = " + at9 + " (0)" };
});
check("B1-DefCon-MID-and-FWD-12-CBIRT-scores-2", function () {
  const got = [3, 4].map(function (t) { return [E.pointsFor(row({ dc: 12 }), t) - E.pointsFor(row({}), t), E.pointsFor(row({ dc: 11 }), t) - E.pointsFor(row({}), t)]; });
  return { ok: JSON.stringify(got) === JSON.stringify([[2, 0], [2, 0]]), detail: "[[MID@12,MID@11],[FWD@12,FWD@11]] = " + JSON.stringify(got) };
});
check("B1-DefCon-never-applies-to-GKP", function () {
  const v = E.pointsFor(row({ dc: 40 }), 1) - E.pointsFor(row({}), 1);
  return { ok: v === 0, detail: "GKP dc 40 delta = " + v + ", expected 0" };
});
check("B1-cards-and-own-goals", function () {
  const yc = E.pointsFor(row({ yc: 1 }), 3) - E.pointsFor(row({}), 3);
  const rc = E.pointsFor(row({ rc: 1 }), 3) - E.pointsFor(row({}), 3);
  const og = E.pointsFor(row({ og: 1 }), 3) - E.pointsFor(row({}), 3);
  const pm = E.pointsFor(row({ pen_miss: 1 }), 3) - E.pointsFor(row({}), 3);
  return { ok: yc === -1 && rc === -3 && og === -2 && pm === -2, detail: "yellow " + yc + ", red " + rc + ", own goal " + og + ", penalty miss " + pm };
});
check("B1-penalty-save-5-for-GKP-only", function () {
  const gk = E.pointsFor(row({ pen_save: 1 }), 1) - E.pointsFor(row({}), 1);
  const mid = E.pointsFor(row({ pen_save: 1 }), 3) - E.pointsFor(row({}), 3);
  return { ok: gk === 5 && mid === 0, detail: "GKP " + gk + " (5), MID " + mid + " (0)" };
});
check("B1-bonus-is-added-as-scored", function () {
  const v = E.pointsFor(row({ bonus: 3 }), 3) - E.pointsFor(row({}), 3);
  return { ok: v === 3, detail: "bonus 3 delta = " + v };
});
check("B1-appearance-1-under-60-and-2-at-60", function () {
  const a = E.pointsFor(row({ minutes: 1 }), 3), b = E.pointsFor(row({ minutes: 60 }), 3);
  return { ok: a === 1 && b === 2, detail: "1 min = " + a + ", 60 min = " + b };
});
check("B1-zero-minutes-scores-nothing", function () {
  const v = E.pointsFor(row({ minutes: 0, goals: 2, bonus: 3 }), 4);
  return { ok: v === 0, detail: "0 minutes with 2 goals = " + v };
});
check("B1-captain-doubles-a-negative-total", function () {
  const base = E.pointsFor({ minutes: 30, red_cards: 1, own_goals: 1 }, 3);
  return { ok: base === -4 && base * 2 === -8, detail: "raw " + base + " (expected -4), captained " + base * 2 + " (expected -8)" };
});
check("B1-array-row-shape-matches-the-object-shape", function () {
  // [min,starts,pts,xg,xa,xgc,dc,bps,ict,goals,assists,cs,gc,bonus,yc,rc,og,pen_miss,pen_save,saves]
  const arrRow = [90, 1, 0, 0, 0, 0, 10, 20, 5, 1, 0, 1, 0, 2, 0, 0, 0, 0, 0, 0];
  const objRow = { minutes: 90, dc: 10, goals: 1, cs: 1, bonus: 2 };
  const a = E.pointsFor(arrRow, 2), b = E.pointsFor(objRow, 2);
  return { ok: a === b && a === 16, detail: "array " + a + " vs object " + b + ", expected 16 (2 + 6 goal + 4 CS + 2 DefCon + 2 bonus)" };
});

// ---------------------------------------------------------------- draft scoring differs

check("DRAFT-scoring-GKP-goal-is-10-not-6", function () {
  const D = E.draftScoring(SYN);
  return { ok: D[1].goal === 10 && E.SCORING[1].goal === 6, detail: "draft GKP goal = " + D[1].goal + " (expected 10); classic GKP goal = " + E.SCORING[1].goal + " (expected 6)" };
});
check("DRAFT-scoring-applied-by-pointsFor", function () {
  const D = E.draftScoring(SYN);
  const draftPts = E.pointsFor(row({ goals: 1 }), 1, D);
  const classicPts = E.pointsFor(row({ goals: 1 }), 1);
  return { ok: draftPts === 12 && classicPts === 8, detail: "draft GKP 90min+goal = " + draftPts + " (expected 12), classic = " + classicPts + " (expected 8)" };
});
check("DRAFT-scoring-outfield-goals-match-classic", function () {
  const D = E.draftScoring(SYN);
  return { ok: D[2].goal === 6 && D[3].goal === 5 && D[4].goal === 4, detail: "draft DEF/MID/FWD goal = " + D[2].goal + "/" + D[3].goal + "/" + D[4].goal };
});
check("DRAFT-scoring-keeps-bonus", function () {
  const D = E.draftScoring(SYN);
  return { ok: D[3].bonus === 1, detail: "draft MID bonus multiplier = " + D[3].bonus };
});

// ================================================================ B3 — legal15 / legalXI

const OK15 = SYN_SQUAD.slice();

check("LEGAL15-positive-a-valid-fifteen", function () {
  const r = E.legal15(OK15, LEGAL_ELS, 1000);
  return { ok: r.ok, detail: "reasons: " + r.reasons.join(" | ") + " · cost " + r.cost };
});
check("LEGAL15-negative-four-players-from-one-club", function () {
  const bad = OK15.slice();
  bad[bad.indexOf(34)] = 5;                                     // 5 is team 1: t1 then holds 1,2,4,5
  const r = E.legal15(bad, LEGAL_ELS, 1000);
  const said = r.reasons.some(function (s) { return /club 1/.test(s); });
  return { ok: !r.ok && said, detail: "ok=" + r.ok + " reasons: " + r.reasons.join(" | ") };
});
check("LEGAL15-negative-1001-tenths-is-over-budget", function () {
  const els = LEGAL_ELS.map(function (e) { return Object.assign({}, e); });
  const byId = {}; els.forEach(function (e) { byId[e.id] = e; });
  let cost = 0; OK15.forEach(function (id) { cost += byId[id].now_cost; });
  byId[OK15[0]].now_cost += 1001 - cost;                        // force the fifteen to cost exactly 1001
  const r = E.legal15(OK15, els, 1000);
  const over = r.reasons.some(function (s) { return /exceeds/.test(s); });
  return { ok: !r.ok && r.cost === 1001 && over, detail: "cost " + r.cost + " ok=" + r.ok + " reasons: " + r.reasons.join(" | ") };
});
check("LEGAL15-negative-1000-tenths-exactly-is-allowed", function () {
  const els = LEGAL_ELS.map(function (e) { return Object.assign({}, e); });
  const byId = {}; els.forEach(function (e) { byId[e.id] = e; });
  let cost = 0; OK15.forEach(function (id) { cost += byId[id].now_cost; });
  byId[OK15[0]].now_cost += 1000 - cost;
  const r = E.legal15(OK15, els, 1000);
  return { ok: r.ok && r.cost === 1000, detail: "cost " + r.cost + " ok=" + r.ok + " reasons: " + r.reasons.join(" | ") };
});
check("LEGAL15-negative-2-3-5-5-shape-is-rejected", function () {
  // 2 GKP · 3 DEF · 5 MID · 5 FWD — fifteen players, wrong shape (needs 2-5-5-3).
  const ids = [1, 7, 2, 9, 14, 4, 10, 16, 22, 28, 6, 12, 18, 24, 30];
  const r = E.legal15(ids, LEGAL_ELS, 1000);
  const shape = r.reasons.some(function (s) { return /needs 2-5-5-3/.test(s); });
  return { ok: !r.ok && shape && r.counts[1] === 2 && r.counts[2] === 3 && r.counts[3] === 5 && r.counts[4] === 5, detail: "counts " + JSON.stringify(r.counts) + " reasons: " + r.reasons.join(" | ") };
});
check("LEGAL15-negative-duplicate-player-id", function () {
  const bad = OK15.slice(); bad[14] = bad[0];
  const r = E.legal15(bad, LEGAL_ELS, 1000);
  return { ok: !r.ok && r.reasons.some(function (s) { return /duplicate/.test(s); }), detail: r.reasons.join(" | ") };
});
check("LEGAL15-negative-fourteen-players", function () {
  const r = E.legal15(OK15.slice(0, 14), LEGAL_ELS, 1000);
  return { ok: !r.ok && r.reasons.some(function (s) { return /needs 15/.test(s); }), detail: r.reasons.join(" | ") };
});

check("LEGALXI-positive-a-valid-eleven", function () {
  const ids = [1, 2, 9, 14, 20, 4, 16, 22, 28, 12, 18];        // 1 GKP · 4 DEF · 4 MID · 2 FWD
  const r = E.legalXI(ids, LEGAL_ELS);
  return { ok: r.ok && r.formation === "4-4-2", detail: "ok=" + r.ok + " formation " + r.formation + " reasons: " + r.reasons.join(" | ") };
});
check("LEGALXI-negative-two-goalkeepers-in-the-eleven", function () {
  const ids = [1, 7, 2, 9, 14, 20, 4, 16, 22, 12, 18];
  const r = E.legalXI(ids, LEGAL_ELS);
  return { ok: !r.ok && r.reasons.some(function (s) { return /goalkeepers/.test(s); }), detail: r.reasons.join(" | ") };
});
check("LEGALXI-negative-only-two-defenders", function () {
  const ids = [1, 2, 9, 4, 16, 22, 28, 5, 12, 18, 24];
  const r = E.legalXI(ids, LEGAL_ELS);
  return { ok: !r.ok && r.reasons.some(function (s) { return /defenders/.test(s); }), detail: r.reasons.join(" | ") };
});
check("LEGALXI-negative-no-forward", function () {
  const ids = [1, 2, 9, 14, 20, 26, 4, 16, 22, 28, 5];
  const r = E.legalXI(ids, LEGAL_ELS);
  return { ok: !r.ok && r.reasons.some(function (s) { return /forwards/.test(s); }), detail: r.reasons.join(" | ") };
});
check("LEGALXI-formationOf-reads-the-shape-back", function () {
  const ids = [1, 2, 9, 14, 20, 26, 4, 16, 22, 12, 18];        // 5-3-2... 5 DEF, 3 MID, 2 FWD
  const f = E.formationOf(ids, LEGAL_ELS);
  return { ok: f === "5-3-2", detail: "formationOf = " + f };
});
check("CAPTAIN-is-inside-the-XI-and-vice-is-not-the-captain", function () {
  const xi = E.bestXI(SYN_SQUAD, CTX);
  const inXi = xi.ids.indexOf(xi.capId) >= 0;
  const viceInXi = xi.ids.indexOf(xi.viceId) >= 0;
  return { ok: inXi && viceInXi && xi.capId !== xi.viceId && xi.capId !== null, detail: "cap " + xi.capId + " vice " + xi.viceId + " xi " + xi.ids.join(",") };
});

// ================================================================ prices and the bank

check("SELL-rise-of-2-returns-purchase-plus-1", function () {
  const v = E.sellPrice(47, 45);
  return { ok: v === 46, detail: "sellPrice(47,45) = " + v + ", expected 46" };
});
check("SELL-rise-of-1-returns-purchase-plus-0", function () {
  const v = E.sellPrice(46, 45);
  return { ok: v === 45, detail: "sellPrice(46,45) = " + v + ", expected 45" };
});
check("SELL-rise-of-3-returns-purchase-plus-1", function () {
  const v = E.sellPrice(48, 45);
  return { ok: v === 46, detail: "sellPrice(48,45) = " + v + ", expected 46" };
});
check("SELL-a-fall-follows-now-cost", function () {
  const v = E.sellPrice(43, 45);
  return { ok: v === 43, detail: "sellPrice(43,45) = " + v + ", expected 43" };
});
check("SELL-unknown-purchase-follows-now-cost", function () {
  return { ok: E.sellPrice(50, null) === 50 && E.sellPrice(50, 0) === 50, detail: "null → " + E.sellPrice(50, null) + ", 0 → " + E.sellPrice(50, 0) };
});
check("BANK-after-works-on-raw-tenths", function () {
  const els = [{ id: 1, element_type: 3, team: 1, now_cost: 47 }, { id: 2, element_type: 3, team: 2, now_cost: 50 }];
  const st = { squad: [{ id: 1, purchase: 45 }], bank: 5 };
  const v = E.bankAfter(st, [{ out: 1, in: 2 }], els);
  return { ok: v === 1, detail: "5 + sell 46 − buy 50 = " + v + ", expected 1 (never a display-rounded 4.6)" };
});
check("BANK-after-never-rounds-a-sale-up", function () {
  const els = [{ id: 1, element_type: 3, team: 1, now_cost: 46 }, { id: 2, element_type: 3, team: 2, now_cost: 46 }];
  const st = { squad: [{ id: 1, purchase: 45 }], bank: 0 };
  const v = E.bankAfter(st, [{ out: 1, in: 2 }], els);
  return { ok: v === -1, detail: "0 + sell 45 − buy 46 = " + v + ", expected -1 (the caller rejects it, the helper does not hide it)" };
});

// ================================================================ free transfers

check("FT-no-transfers-in-GW2-and-GW3-gives-3", function () {
  const h = { current: [{ event: 1, event_transfers: 0, event_transfers_cost: 0 }, { event: 2, event_transfers: 0, event_transfers_cost: 0 }, { event: 3, event_transfers: 0, event_transfers_cost: 0 }], chips: [] };
  const v = E.ftAvailable(h, 3);
  return { ok: v === 3, detail: "ftAvailable = " + v + ", expected 3" };
});
check("FT-GW1-transfers-are-excluded", function () {
  const h = { current: [{ event: 1, event_transfers: 15, event_transfers_cost: 0 }, { event: 2, event_transfers: 0, event_transfers_cost: 0 }, { event: 3, event_transfers: 0, event_transfers_cost: 0 }], chips: [] };
  const v = E.ftAvailable(h, 3);
  return { ok: v === 3, detail: "ftAvailable = " + v + ", expected 3 (GW1 is a free build)" };
});
check("FT-a-minus-4-hit-does-not-spend-a-second-free-transfer", function () {
  const h = { current: [{ event: 1, event_transfers: 0, event_transfers_cost: 0 }, { event: 2, event_transfers: 2, event_transfers_cost: 4 }, { event: 3, event_transfers: 0, event_transfers_cost: 0 }], chips: [] };
  const v = E.ftAvailable(h, 3);
  return { ok: v === 2, detail: "ftAvailable = " + v + ", expected 2 (1 free used, 1 hit, then +1 for GW3)" };
});
check("FT-all-free-transfers-spent-drops-to-1", function () {
  const h = { current: [{ event: 1, event_transfers: 0, event_transfers_cost: 0 }, { event: 2, event_transfers: 1, event_transfers_cost: 0 }, { event: 3, event_transfers: 1, event_transfers_cost: 0 }], chips: [] };
  const v = E.ftAvailable(h, 3);
  return { ok: v === 1, detail: "ftAvailable = " + v + ", expected 1" };
});
check("FT-banks-to-a-cap-of-5", function () {
  const cur = [];
  for (let g = 1; g <= 12; g++) cur.push({ event: g, event_transfers: 0, event_transfers_cost: 0 });
  const v = E.ftAvailable({ current: cur, chips: [] }, 12);
  return { ok: v === 5, detail: "ftAvailable after 12 untouched gameweeks = " + v + ", expected 5" };
});
check("FT-junk-history-returns-1-not-a-throw", function () {
  return { ok: E.ftAvailable(null, 3) === 1 && E.ftAvailable({ current: "x" }, 3) === 1, detail: "null → " + E.ftAvailable(null, 3) + ", junk → " + E.ftAvailable({ current: "x" }, 3) };
});

// ================================================================ D4 — refresh path

check("REFRESH-parseJson-strips-code-fences", function () {
  const v = E.parseJson("```json\n{\"a\":1,\"b\":[1,2]}\n```");
  return { ok: v && v.a === 1 && v.b.length === 2, detail: JSON.stringify(v) };
});
check("REFRESH-parseJson-ignores-prose-around-the-object", function () {
  const v = E.parseJson("Sure — here is what I found for GW4.\n{\"elements\":[{\"id\":1,\"status\":\"a\"}]}\nLet me know if you need more.");
  return { ok: v && Array.isArray(v.elements) && v.elements[0].id === 1, detail: JSON.stringify(v) };
});
check("REFRESH-parseJson-salvages-a-cut-off-trailing-array", function () {
  const cut = '{"fetched_at":"2026-09-11T06:00:00Z","elements":[{"id":1,"status":"a"},{"id":2,"status":"d","chance":';
  const v = E.parseJson(cut);
  return { ok: v && Array.isArray(v.elements) && v.elements.length >= 1 && v.elements[0].id === 1 && v.__salvaged === true, detail: JSON.stringify(v) };
});
check("REFRESH-parseJson-garbage-throws-with-a-real-message", function () {
  try {
    E.parseJson("I could not find anything useful this week.");
    return { ok: false, detail: "did not throw" };
  } catch (e) {
    const m = String(e.message || "");
    return { ok: /parseJson/.test(m) && m.length > 30 && /no JSON object/.test(m), detail: "message: " + m };
  }
});
check("REFRESH-parseJson-non-string-throws-naming-the-type", function () {
  try { E.parseJson(null); return { ok: false, detail: "did not throw" }; }
  catch (e) { return { ok: /expected a string/.test(e.message) && /null/.test(e.message), detail: e.message }; }
});
check("REFRESH-pickText-ignores-tool-blocks-that-come-first", function () {
  const content = [
    { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "fpl gw4 injuries" } },
    { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [{ type: "web_search_result", title: "FPL", url: "https://example.invalid" }] },
    { type: "text", text: "{\"elements\":[]}" }
  ];
  const t = E.pickText(content);
  return { ok: t === "{\"elements\":[]}", detail: "pickText returned " + JSON.stringify(t) };
});
check("REFRESH-pickText-joins-several-text-blocks-in-order", function () {
  const t = E.pickText([{ type: "text", text: "a" }, { type: "server_tool_use", name: "web_search" }, { type: "text", text: "b" }]);
  return { ok: t === "a\nb", detail: JSON.stringify(t) };
});
check("REFRESH-pickText-empty-when-only-tool-blocks", function () {
  const t = E.pickText([{ type: "server_tool_use", name: "web_search" }]);
  const types = E.blockTypes([{ type: "server_tool_use", name: "web_search" }]);
  return { ok: t === "" && /server_tool_use/.test(types), detail: "text " + JSON.stringify(t) + " · blockTypes " + types };
});
check("REFRESH-request-carries-max_tokens-4000", function () {
  const r = E.refreshRequest({ pair: "sonnet46", nextEvent: 4 });
  return { ok: r.max_tokens === 4000, detail: "max_tokens = " + r.max_tokens + " (E-001: 1000 truncated every reply)" };
});
check("REFRESH-request-tool-type-matches-the-chosen-pair", function () {
  const a = E.refreshRequest({ pair: "sonnet46" });
  const b = E.refreshRequest({ pair: "sonnet5" });
  const c = E.refreshRequest({ pair: "opus5" });
  const okA = a.model === "claude-sonnet-4-6" && a.tools[0].type === "web_search_20250305";
  const okB = b.model === "claude-sonnet-5" && b.tools[0].type === "web_search_20260209";
  const okC = c.model === "claude-opus-5" && c.tools[0].type === "web_search_20260209";
  return { ok: okA && okB && okC, detail: [a, b, c].map(function (x) { return x.model + "/" + x.tools[0].type; }).join(" · ") };
});
check("REFRESH-request-tools-array-is-named-web_search", function () {
  const r = E.refreshRequest({ pair: "sonnet5" });
  return { ok: Array.isArray(r.tools) && r.tools.length === 1 && r.tools[0].name === "web_search", detail: JSON.stringify(r.tools) };
});
check("REFRESH-request-unknown-pair-falls-back-and-says-so", function () {
  const r = E.refreshRequest({ pair: "gpt" });
  return { ok: r.model === "claude-sonnet-4-6" && typeof r.warning === "string" && /gpt/.test(r.warning), detail: r.model + " · " + r.warning };
});
check("REFRESH-request-never-mentions-ep_this-or-ep_next", function () {
  const r = JSON.stringify(E.refreshRequest({ pair: "sonnet46", nextEvent: 4 }));
  return { ok: !/ep_this|ep_next/.test(r), detail: "banned field found in the request body" };
});

function refreshState() {
  return { live: { next_event: 4, events: [{ id: 4, deadline_time: "2026-09-12T12:30:00Z" }], elements: [{ id: 1, web_name: "P1", status: "a", chance: null, now_cost: 70, cost_change_event: 0 }, { id: 2, web_name: "P2", status: "a", chance: null, now_cost: 50, cost_change_event: 0 }] } };
}
check("REFRESH-applyRefresh-applies-a-good-payload-without-mutating-the-input", function () {
  const st = refreshState(), before = JSON.stringify(st);
  const ns = E.applyRefresh(st, { fetched_at: "2026-09-11T07:00:00Z", elements: [{ id: 1, status: "d", chance: 75, news: "Knock" }] });
  const untouched = JSON.stringify(st) === before;
  const applied = ns.live.elements[0].status === "d" && ns.live.elements[0].chance === 75;
  return { ok: untouched && applied && ns !== st, detail: "input untouched=" + untouched + " applied=" + applied };
});
check("REFRESH-applyRefresh-never-mutates-on-a-bad-status", function () {
  const st = refreshState(), before = JSON.stringify(st);
  let threw = false, msg = "";
  try { E.applyRefresh(st, { elements: [{ id: 1, status: "zzz" }] }); } catch (e) { threw = true; msg = e.message; }
  return { ok: threw && JSON.stringify(st) === before && /bad status/.test(msg), detail: "threw=" + threw + " message=" + msg + " state changed=" + (JSON.stringify(st) !== before) };
});
check("REFRESH-applyRefresh-never-mutates-on-an-error-object", function () {
  const st = refreshState(), before = JSON.stringify(st);
  let threw = false, msg = "";
  try { E.applyRefresh(st, { type: "error", error: { type: "invalid_request_error", message: "max_tokens too small" } }); } catch (e) { threw = true; msg = e.message; }
  return { ok: threw && JSON.stringify(st) === before && /max_tokens too small/.test(msg), detail: "threw=" + threw + " message=" + msg };
});
check("REFRESH-applyRefresh-never-mutates-when-nothing-is-applicable", function () {
  const st = refreshState(), before = JSON.stringify(st);
  let threw = false;
  try { E.applyRefresh(st, { elements: [{ id: 9999, status: "a" }] }); } catch (e) { threw = true; }
  return { ok: threw && JSON.stringify(st) === before, detail: "threw=" + threw + " state changed=" + (JSON.stringify(st) !== before) };
});
check("REFRESH-applyRefresh-rejects-an-absurd-price", function () {
  const st = refreshState(), before = JSON.stringify(st);
  let threw = false, msg = "";
  try { E.applyRefresh(st, { elements: [{ id: 1, now_cost: 9999 }] }); } catch (e) { threw = true; msg = e.message; }
  return { ok: threw && JSON.stringify(st) === before && /now_cost/.test(msg), detail: "threw=" + threw + " " + msg };
});

// ================================================================ D3 — squad-change detection

check("D3-Konsa-style-id-mismatch-sets-block-and-lists-the-players", function () {
  // The saved squad still holds 34; the live picks hold 11 instead (a transfer made in the app).
  const mine = SYN_SQUAD.slice();
  const theirs = SYN_SQUAD.map(function (id) { return id === 34 ? 11 : id; }).map(function (id, k) { return { element: id, position: k + 1, multiplier: k < 11 ? 1 : 0 }; });
  const r = E.detectSquadChange(mine, theirs);
  return { ok: r.block === true && r.changed === true && r.added.join(",") === "11" && r.removed.join(",") === "34", detail: "block=" + r.block + " added=[" + r.added + "] removed=[" + r.removed + "]" };
});
check("D3-two-moves-are-both-reported", function () {
  const mine = SYN_SQUAD.slice();
  const theirs = SYN_SQUAD.map(function (id) { return id === 34 ? 11 : (id === 20 ? 21 : id); }).map(function (id) { return { element: id }; });
  const r = E.detectSquadChange(mine, theirs);
  return { ok: r.block && r.added.length === 2 && r.removed.length === 2, detail: "added=[" + r.added + "] removed=[" + r.removed + "]" };
});
check("D3-identical-ids-do-not-block", function () {
  const r = E.detectSquadChange(SYN_SQUAD, SYN_SQUAD.map(function (id) { return { element: id }; }));
  return { ok: r.block === false && r.changed === false && r.added.length === 0 && r.removed.length === 0, detail: JSON.stringify(r) };
});
check("D3-same-ids-in-a-different-order-do-not-block", function () {
  const shuffled = SYN_SQUAD.slice().reverse().map(function (id) { return { element: id }; });
  const r = E.detectSquadChange(SYN_SQUAD, shuffled);
  return { ok: r.block === false, detail: JSON.stringify(r) };
});
check("D3-empty-picks-do-not-block", function () {
  const r = E.detectSquadChange(SYN_SQUAD, []);
  return { ok: r.block === false && r.changed === false, detail: JSON.stringify(r) };
});
check("D3-a-renamed-player-on-the-same-id-does-not-block", function () {
  // The whole point of keying on id: a club move (Konsa AVL→ARS) changes nothing here.
  const theirs = SYN_SQUAD.map(function (id) { return { element: id, web_name: "Renamed" + id }; });
  const r = E.detectSquadChange(SYN_SQUAD, theirs);
  return { ok: r.block === false, detail: JSON.stringify(r) };
});

// ================================================================ sanitiseState

const JUNK_KINDS = [
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["non-JSON string", "x"],
  ["number 0", 0],
  ["NaN", NaN],
  ["empty array", []],
  ["empty object", {}],
  ["squad is a string", { squad: "junk" }],
  ["squad holds null/number/string", { squad: [null, 1, "x"] }],
  ["squad of 40 identical objects", { squad: new Array(40).fill({ id: 1 }) }],
  ["deeply nested object", (function () { let o = { squad: [] }; let c = o; for (let i = 0; i < 60; i++) { c.next = { i: i }; c = c.next; } return o; })()],
  ["huge numbers", { bank: 1e308, ft: 1e308, value: Number.MAX_SAFE_INTEGER, squad: [{ id: 1e308, purchase: 1e308 }] }],
  ["negative ids", { squad: [{ id: -4, purchase: -50 }, { id: -1 }] }],
  ["duplicate ids", { squad: [{ id: 7 }, { id: 7 }, { id: 7 }, { id: 7 }] }],
  ["unicode keys", { "éè€": 1, squad: [{ id: 3, "क": "x" }], ui: { "🚀": true } }],
  ["function-valued field", { squad: [{ id: 2 }], bank: function () { return 5; }, ui: { mode: function () {} } }],
  ["Infinity", { bank: Infinity, ft: -Infinity, value: Infinity, squad: [{ id: Infinity }] }],
  ["negative zero", { bank: -0, ft: -0, value: -0, squad: [{ id: -0 }] }],
  ["a one-million-character string", { squad: [{ id: 5 }], draft: { roster_note: new Array(1000001).join("x") } }]
];

check("SANITISE-never-throws-on-20-junk-kinds", function () {
  const bad = [];
  JUNK_KINDS.forEach(function (pair) {
    try {
      const s = E.sanitiseState(pair[1]);
      if (!s || typeof s !== "object") bad.push(pair[0] + " (not an object)");
      else if (!Array.isArray(s.squad)) bad.push(pair[0] + " (squad is not an array)");
      else if (s.squad.length > 15) bad.push(pair[0] + " (squad " + s.squad.length + ")");
    } catch (e) { bad.push(pair[0] + " threw: " + e.message); }
  });
  return { ok: bad.length === 0 && JUNK_KINDS.length === 20, detail: JUNK_KINDS.length + " kinds tested; failures: " + (bad.join("; ") || "none") };
});
check("SANITISE-caps-the-squad-at-15", function () {
  const raw = { squad: [] };
  for (let i = 1; i <= 40; i++) raw.squad.push({ id: i, purchase: 50 });
  const s = E.sanitiseState(raw);
  return { ok: s.squad.length === 15 && s.squad[0].id === 1 && s.squad[14].id === 15, detail: "kept " + s.squad.length + ": " + s.squad.map(function (x) { return x.id; }).join(",") };
});
check("SANITISE-dedupes-on-id", function () {
  const raw = { squad: [{ id: 3 }, { id: 3 }, { id: 4 }, { id: 3 }, { id: 4 }, { id: 5 }] };
  const s = E.sanitiseState(raw);
  return { ok: s.squad.length === 3 && s.squad.map(function (x) { return x.id; }).join(",") === "3,4,5", detail: s.squad.map(function (x) { return x.id; }).join(",") };
});
check("SANITISE-keeps-a-good-state-intact", function () {
  const s = E.sanitiseState(SYN_STATE);
  return { ok: s.squad.length === 15 && s.bank === 10 && s.ft === 3 && s.entry === 3546875 && s.ui.tab === "command", detail: "squad " + s.squad.length + " bank " + s.bank + " ft " + s.ft + " entry " + s.entry };
});
check("SANITISE-accepts-a-JSON-string", function () {
  const s = E.sanitiseState(JSON.stringify(SYN_STATE));
  return { ok: s.squad.length === 15 && s.entry === 3546875, detail: "squad " + s.squad.length };
});
check("SANITISE-clamps-ft-to-the-cap-of-5", function () {
  const s = E.sanitiseState({ ft: 99 });
  return { ok: s.ft === 5, detail: "ft = " + s.ft };
});

// ================================================================ C1/C2/C3 — decisions

check("CTX-buildCtx-is-ok-on-the-synthetic-snapshot", function () {
  return { ok: CTX.ok === true && CTX.nextEvent === 4 && CTX.squadIds.length === 15, detail: "ok=" + CTX.ok + " error=" + CTX.error + " nextEvent=" + CTX.nextEvent + " squad=" + CTX.squadIds.length };
});

// captainPick against a hand-built context: the flagged man's EV is highest by construction.
function stubCtx(rows) {
  const els = {}, xp = {}, flags = {};
  rows.forEach(function (r) {
    els[r.id] = { id: r.id, web_name: r.name, element_type: r.type, team: r.team || 1, total_points: r.pts, starts: r.starts, status: r.status || "a", chance: r.chance === undefined ? null : r.chance };
    xp[r.id] = { xp1: r.xp1, pstart: r.pstart, xp5: r.xp1 * 4, shrunk: r.xp1, el: els[r.id] };
    flags[r.id] = E.flagInfo(els[r.id]);
  });
  return { ok: true, els: els, xp: xp, flags: flags, capShare: {}, rivalOwn: {}, gwStats: {}, mults: { TS: {}, TS_GOALS: {} }, elList: rows.map(function (r) { return els[r.id]; }) };
}

check("CAP-excludes-a-flagged-player-with-the-highest-EV", function () {
  const ctx = stubCtx([
    { id: 1, name: "Flagged", type: 3, pts: 45, starts: 3, xp1: 10, pstart: 0.75, status: "d", chance: 75 },
    { id: 2, name: "Clean", type: 3, pts: 30, starts: 3, xp1: 5, pstart: 0.9 },
    { id: 3, name: "Third", type: 4, pts: 20, starts: 3, xp1: 4, pstart: 0.9 }
  ]);
  const r = E.captainPick([1, 2, 3], ctx);
  const flaggedRow = r.table.filter(function (x) { return x.id === 1; })[0];
  const chosenRow = r.table.filter(function (x) { return x.id === r.capId; })[0];
  return { ok: r.capId === 2 && flaggedRow.ev > chosenRow.ev && flaggedRow.eligible === false, detail: "capId " + r.capId + " · flagged EV " + r2(flaggedRow.ev) + " > chosen EV " + r2(chosenRow.ev) + " · flagged eligible=" + flaggedRow.eligible };
});
check("CAP-a-1-percent-doubt-is-still-a-flag", function () {
  const ctx = stubCtx([
    { id: 1, name: "Doubt99", type: 3, pts: 45, starts: 3, xp1: 10, pstart: 0.99, status: "a", chance: 99 },
    { id: 2, name: "Clean", type: 3, pts: 30, starts: 3, xp1: 5, pstart: 0.9 }
  ]);
  const r = E.captainPick([1, 2], ctx);
  return { ok: r.capId === 2, detail: "capId " + r.capId + " (any percentage below 100 excludes)" };
});
check("CAP-ties-break-on-season-points-per-start", function () {
  const ctx = stubCtx([
    { id: 1, name: "Alpha", type: 3, pts: 40, starts: 10, xp1: 5, pstart: 0.9 },
    { id: 2, name: "Bravo", type: 3, pts: 20, starts: 10, xp1: 5, pstart: 0.9 }
  ]);
  const a = E.captainPick([1, 2], ctx);
  const ctx2 = stubCtx([
    { id: 1, name: "Alpha", type: 3, pts: 20, starts: 10, xp1: 5, pstart: 0.9 },
    { id: 2, name: "Bravo", type: 3, pts: 40, starts: 10, xp1: 5, pstart: 0.9 }
  ]);
  const b = E.captainPick([1, 2], ctx2);
  const evEqual = Math.abs(a.table[0].ev - a.table[1].ev) < 1e-12;
  return { ok: evEqual && a.capId === 1 && b.capId === 2, detail: "EVs equal=" + evEqual + "; higher pts/start wins both ways (a=" + a.capId + ", b=" + b.capId + ")" };
});
check("CAP-a-goalkeeper-or-defender-is-never-captain", function () {
  const ctx = stubCtx([
    { id: 1, name: "Keeper", type: 1, pts: 60, starts: 3, xp1: 20, pstart: 1 },
    { id: 2, name: "Defender", type: 2, pts: 55, starts: 3, xp1: 18, pstart: 1 },
    { id: 3, name: "Mid", type: 3, pts: 20, starts: 3, xp1: 4, pstart: 0.9 }
  ]);
  const r = E.captainPick([1, 2, 3], ctx);
  return { ok: r.capId === 3, detail: "capId " + r.capId + " (C1 rule 2 ranges over attackers)" };
});
check("CAP-no-eligible-attacker-returns-null-with-a-reason", function () {
  const ctx = stubCtx([{ id: 1, name: "Keeper", type: 1, pts: 60, starts: 3, xp1: 20, pstart: 1 }]);
  const r = E.captainPick([1], ctx);
  return { ok: r.capId === null && r.reasons.length > 0, detail: "capId " + r.capId + " reasons " + r.reasons.join("; ") };
});
check("CAP-flagged-star-is-not-captain-on-the-real-synthetic-context", function () {
  const xi = E.bestXI(SYN_SQUAD, CTX);
  const table = E.captainPick(xi.ids, CTX).table;
  const star = table.filter(function (r) { return r.id === 22; })[0];
  return { ok: xi.capId !== 22 && (!star || star.eligible === false), detail: "capId " + xi.capId + "; element 22 in the XI = " + (xi.ids.indexOf(22) >= 0) + ", eligible = " + (star ? star.eligible : "not in XI") };
});

check("XI-never-starts-a-sub-0.5-player-ahead-of-a-0.75-one", function () {
  const xi = E.bestXI(SYN_SQUAD, CTX);
  const bench = SYN_SQUAD.filter(function (id) { return xi.ids.indexOf(id) < 0; });
  const bad = [];
  xi.ids.forEach(function (id) {
    const p = CTX.xp[id].pstart;
    if (p >= 0.5) return;
    bench.forEach(function (b) {
      if (CTX.xp[b].pstart >= 0.75 && CTX.els[b].element_type === CTX.els[id].element_type) bad.push(id + " (" + r2(p) + ") started over " + b + " (" + r2(CTX.xp[b].pstart) + ")");
    });
  });
  return { ok: bad.length === 0, detail: bad.join("; ") || "no violation" };
});
check("XI-returns-a-legal-formation", function () {
  const xi = E.bestXI(SYN_SQUAD, CTX);
  const L = E.legalXI(xi.ids, CTX.els);
  const shapes = E.FORMATIONS.map(function (f) { return f.join("-"); });
  return { ok: L.ok && xi.ids.length === 11 && shapes.indexOf(xi.formation) >= 0, detail: "formation " + xi.formation + " legalXI=" + L.ok + " reasons " + L.reasons.join("; ") };
});
check("XI-benches-the-dead-player", function () {
  const xi = E.bestXI(SYN_SQUAD, CTX);
  return { ok: xi.ids.indexOf(34) < 0, detail: "element 34 (no starts in three) in the XI = " + (xi.ids.indexOf(34) >= 0) };
});
check("XI-bench-plus-XI-is-the-whole-squad", function () {
  const xi = E.bestXI(SYN_SQUAD, CTX);
  const all = xi.ids.concat(xi.bench).slice().sort(function (a, b) { return a - b; });
  return { ok: all.join(",") === SYN_SQUAD.slice().sort(function (a, b) { return a - b; }).join(","), detail: "XI+bench = " + all.length + " players" };
});
check("BENCH-order-excludes-the-goalkeeper", function () {
  const xi = E.bestXI(SYN_SQUAD, CTX);
  const order = E.benchOrder(SYN_SQUAD, xi.ids, CTX);
  const gk = order.filter(function (id) { return CTX.els[id].element_type === 1; });
  return { ok: gk.length === 0 && order.length === 3, detail: "bench order " + order.join(",") + " (goalkeepers found: " + gk.length + ")" };
});

// ---------------------------------------------------------------- transfers (C2)

const TP = E.transferProtocol(SYN_STATE, CTX);
console.log("(synthetic transfer plan: k=" + TP.k + " ft=" + TP.ft + " hits=" + TP.hits + " confidence=" + TP.confidence +
  " margin=" + r2(TP.margin) + " bankAfter=" + TP.bankAfter + " moves=" + (TP.moves.map(function (m) { return m.out + "→" + m.in + (m.forced ? "*" : "") + " +" + r2(m.gain); }).join(", ") || "none") + ")");

check("TP-produces-a-result-without-an-engine-error", function () {
  const err = TP.reasons.filter(function (r) { return /engine error/.test(r); });
  return { ok: err.length === 0, detail: err.join("; ") || "reasons: " + TP.reasons.join(" | ") };
});
check("TP-respects-the-free-transfer-budget-and-prices-hits-at-4", function () {
  const k = TP.k, ft = TP.ft;
  const expectHits = Math.max(0, k - ft) * 4;
  return { ok: k <= ft + 1 && k <= 3 && TP.hits === expectHits, detail: "k=" + k + " ft=" + ft + " hits=" + TP.hits + " expected " + expectHits };
});
check("TP-never-proposes-a-buy-that-is-60-percent-rival-owned", function () {
  const bad = TP.moves.filter(function (m) { return E.rivalOwnMax(m.in, CTX).max >= 0.60; });
  const own5 = E.rivalOwnMax(5, CTX).max;
  return { ok: bad.length === 0 && own5 >= 0.60, detail: "convergent buys " + bad.length + "; element 5 rivalOwn = " + own5 + " (the best available midfielder, correctly excluded)" };
});
check("TP-the-excluded-convergent-player-really-is-the-best-buy", function () {
  const outside = CTX.elList.filter(function (el) { return el.element_type === 3 && SYN_SQUAD.indexOf(el.id) < 0; });
  outside.sort(function (a, b) { return CTX.xp[b.id].xp5 - CTX.xp[a.id].xp5; });
  return { ok: outside[0].id === 5, detail: "best midfielder outside the squad by xp5 = " + outside[0].id + " (xp5 " + r2(CTX.xp[outside[0].id].xp5) + "), rivalOwn " + E.rivalOwnMax(5, CTX).max };
});
check("TP-never-brings-in-more-than-two-players-from-one-club", function () {
  const ins = TP.moves.map(function (m) { return m.in; });
  const counts = E.clubCounts(ins, CTX.els);
  const over = Object.keys(counts).filter(function (c) { return counts[c] > 2; });
  return { ok: over.length === 0, detail: "incoming club counts " + JSON.stringify(counts) };
});
check("TP-never-leaves-a-negative-bank", function () {
  return { ok: TP.bankAfter >= 0, detail: "bankAfter = " + TP.bankAfter + " tenths (bank in " + TP.bank + ")" };
});
check("TP-margin-is-measured-against-a-genuinely-different-plan-E008", function () {
  const bestIns = TP.moves.map(function (m) { return m.in; }).sort(function (a, b) { return a - b; }).join(",");
  const bestOuts = TP.moves.map(function (m) { return m.out; }).sort(function (a, b) { return a - b; }).join(",");
  const same = TP.alternatives.filter(function (alt) {
    const ins = alt.moves.map(function (m) { return m.in; }).sort(function (a, b) { return a - b; }).join(",");
    const outs = alt.moves.map(function (m) { return m.out; }).sort(function (a, b) { return a - b; }).join(",");
    return ins === bestIns && outs === bestOuts;
  });
  return { ok: same.length === 0 && TP.margin >= 0, detail: "alternatives identical to the shipped plan: " + same.length + "; margin " + r2(TP.margin) };
});
check("TP-confidence-follows-the-2.0-and-0.8-thresholds", function () {
  const m = TP.margin, c = TP.confidence;
  const ok = (m >= 2.0 && c === "HIGH") || (m >= 0.8 && m < 2.0 && c === "MED") || (m < 0.8 && (c === "LOW" || c === "hold"));
  return { ok: ok, detail: "margin " + r2(m) + " → confidence " + c };
});
check("TP-a-forced-sell-is-listed-and-shipped-first", function () {
  const forcedIds = TP.forced.map(function (f) { return f.id; });
  const firstMoveForced = TP.moves.length === 0 || TP.moves[0].forced === true;
  return { ok: forcedIds.indexOf(34) >= 0 && firstMoveForced, detail: "forced " + JSON.stringify(forcedIds) + "; first move forced = " + (TP.moves.length ? TP.moves[0].forced : "no moves") };
});
check("TP-sells-order-comes-before-buys-in-the-execution-list", function () {
  const actions = TP.order.map(function (o) { return o.action; });
  const lastSell = actions.lastIndexOf("sell"), firstBuy = actions.indexOf("buy");
  return { ok: TP.order.length === 0 || lastSell < 0 || firstBuy < 0 || lastSell < firstBuy, detail: actions.join(" → ") };
});
check("TP-captain-and-vice-are-the-last-two-steps", function () {
  const actions = TP.order.map(function (o) { return o.action; });
  const ok = actions.length >= 2 && actions[actions.length - 2] === "captain" && actions[actions.length - 1] === "vice";
  return { ok: ok, detail: actions.join(" → ") };
});
check("TP-an-optional-sell-needs-a-five-week-gain-above-4", function () {
  const optional = TP.moves.filter(function (m) { return !m.forced; });
  const bad = optional.filter(function (m) { return m.gain <= 4; });
  return { ok: bad.length === 0, detail: optional.length + " optional moves; gains " + optional.map(function (m) { return r2(m.gain); }).join(",") };
});
check("TP-blocks-every-recommendation-on-a-squad-mismatch-D3", function () {
  const changed = JSON.parse(JSON.stringify(SYN));
  changed.picks["3"].picks[11].element = 11;                       // live picks hold 11 where the saved squad holds 34
  const st = JSON.parse(JSON.stringify(SYN_STATE)); st.confirmed_gw = 0;
  const ctx2 = E.buildCtx(changed, st, SYN_NOW);
  const r = E.transferProtocol(st, ctx2);
  return { ok: r.blocked === true && r.moves.length === 0 && /confirm the squad/.test(r.reasons.join(" ")), detail: "blocked=" + r.blocked + " moves=" + r.moves.length + " reasons: " + r.reasons.join(" | ") };
});
check("TP-a-confirmed-squad-clears-the-block", function () {
  const changed = JSON.parse(JSON.stringify(SYN));
  changed.picks["3"].picks[11].element = 11;
  const st = JSON.parse(JSON.stringify(SYN_STATE)); st.confirmed_gw = 3;
  const ctx2 = E.buildCtx(changed, st, SYN_NOW);
  const r = E.transferProtocol(st, ctx2);
  return { ok: r.blocked === false, detail: "blocked=" + r.blocked + " reasons: " + r.reasons.join(" | ") };
});
check("TP-at-FT-0-a-single-move-costs-a-hit", function () {
  const st = JSON.parse(JSON.stringify(SYN_STATE)); st.ft = 0;
  const snapshot = JSON.parse(JSON.stringify(SYN)); delete snapshot.ft_available;
  const ctx2 = E.buildCtx(snapshot, st, SYN_NOW);
  const r = E.transferProtocol(st, ctx2);
  return { ok: r.ft === 0 && (r.k === 0 || r.hits === r.k * 4), detail: "ft=" + r.ft + " k=" + r.k + " hits=" + r.hits };
});
check("TP-every-shipped-fifteen-is-still-legal", function () {
  if (!TP.moves.length) return { ok: true, detail: "no moves shipped" };
  const newSquad = SYN_SQUAD.filter(function (id) { return !TP.moves.some(function (m) { return m.out === id; }); }).concat(TP.moves.map(function (m) { return m.in; }));
  const L = E.legal15(newSquad, CTX.els, 1e9);
  const XI = E.legalXI(E.bestXI(newSquad, CTX).ids, CTX.els);
  return { ok: L.ok && XI.ok, detail: "legal15=" + L.ok + " (" + L.reasons.join("; ") + ") legalXI=" + XI.ok };
});

// A second transfer scenario: three forced sells, so the multi-swap guards are exercised
// rather than only the single-move path.
const SYN3 = JSON.parse(JSON.stringify(SYN));
[20, 28].forEach(function (id) {
  const el = SYN3.elements.filter(function (e) { return e.id === id; })[0];
  el.status = "u"; el.chance = 0; el.news = "Left the league";
});
const CTX3 = E.buildCtx(SYN3, SYN_STATE, SYN_NOW);
const TP3 = E.transferProtocol(SYN_STATE, CTX3);
console.log("(three-forced-sell plan: k=" + TP3.k + " ft=" + TP3.ft + " hits=" + TP3.hits + " confidence=" + TP3.confidence +
  " bankAfter=" + TP3.bankAfter + " moves=" + (TP3.moves.map(function (m) { return m.out + "→" + m.in + (m.forced ? "*" : ""); }).join(", ") || "none") + ")");

check("TP3-every-unavailable-and-flagged-player-is-a-forced-sell", function () {
  // 20 and 28 are status "u", 34 has no starts in three, 22 carries a 75% doubt.
  const ids = TP3.forced.map(function (f) { return f.id; }).sort(function (a, b) { return a - b; });
  return { ok: ids.join(",") === "20,22,28,34", detail: "forced = " + ids.join(",") + " (expected 20,22,28,34)" };
});
check("TP3-ships-three-moves-inside-the-free-transfer-budget", function () {
  return { ok: TP3.k === 3 && TP3.moves.length === 3 && TP3.hits === 0 && TP3.ft === 3, detail: "k=" + TP3.k + " moves=" + TP3.moves.length + " hits=" + TP3.hits + " ft=" + TP3.ft };
});
check("TP3-never-brings-in-more-than-two-players-from-one-club", function () {
  const counts = E.clubCounts(TP3.moves.map(function (m) { return m.in; }), CTX3.els);
  const over = Object.keys(counts).filter(function (c) { return counts[c] > 2; });
  return { ok: over.length === 0, detail: "incoming club counts " + JSON.stringify(counts) };
});
check("TP3-never-buys-a-convergent-player-and-never-goes-overdrawn", function () {
  const conv = TP3.moves.filter(function (m) { return E.rivalOwnMax(m.in, CTX3).max >= 0.60; });
  return { ok: conv.length === 0 && TP3.bankAfter >= 0, detail: "convergent buys " + conv.length + " · bankAfter " + TP3.bankAfter };
});
check("TP3-the-fifteen-after-three-moves-is-still-legal", function () {
  const outs = TP3.moves.map(function (m) { return m.out; });
  const newSquad = SYN_SQUAD.filter(function (id) { return outs.indexOf(id) < 0; }).concat(TP3.moves.map(function (m) { return m.in; }));
  const L = E.legal15(newSquad, CTX3.els, 1e9);
  return { ok: L.ok, detail: "legal15=" + L.ok + " " + L.reasons.join("; ") };
});
check("TP3-position-for-position-swaps-only", function () {
  const bad = TP3.moves.filter(function (m) { return CTX3.els[m.out].element_type !== CTX3.els[m.in].element_type; });
  return { ok: bad.length === 0, detail: bad.map(function (m) { return m.out + "→" + m.in; }).join(", ") || "all swaps keep the position" };
});
check("TP3-at-FT-2-the-third-move-costs-a-minus-4-hit", function () {
  const st = JSON.parse(JSON.stringify(SYN_STATE)); st.ft = 2;
  const snap = JSON.parse(JSON.stringify(SYN3)); delete snap.ft_available;
  const ctx = E.buildCtx(snap, st, SYN_NOW);
  const r = E.transferProtocol(st, ctx);
  return { ok: r.ft === 2 && r.k <= 3 && r.hits === Math.max(0, r.k - 2) * 4, detail: "ft=" + r.ft + " k=" + r.k + " hits=" + r.hits };
});

// ---------------------------------------------------------------- wildcard

const WC = E.wildcardSolver(CTX, {});
check("WC-solver-returns-a-legal-fifteen-inside-the-budget", function () {
  if (!WC.ok) return { ok: false, detail: "solver not ok: " + WC.reasons.join("; ") };
  const L = E.legal15(WC.ids, CTX.els, WC.budget);
  return { ok: L.ok && WC.cost <= WC.budget && WC.bank === WC.budget - WC.cost, detail: "cost " + WC.cost + " budget " + WC.budget + " bank " + WC.bank + " legal15=" + L.ok + " " + L.reasons.join("; ") };
});
check("WC-solver-excludes-convergent-players", function () {
  if (!WC.ok) return { ok: false, detail: "solver not ok" };
  const bad = WC.ids.filter(function (id) { return E.rivalOwnMax(id, CTX).max >= 0.60; });
  return { ok: bad.length === 0, detail: "convergent picks: " + bad.join(",") };
});

// ================================================================ strength, rivals, MC, tournament

check("TS-tsPcs-is-strictly-inside-0-and-1", function () {
  const bad = [];
  TEAMS.forEach(function (t) {
    TEAMS.forEach(function (o) {
      if (t === o) return;
      [true, false].forEach(function (home) {
        [CTX.TS, CTX.TS_GOALS].forEach(function (TS, k) {
          const p = E.tsPcs(t, o, home, TS);
          if (!(p > 0 && p < 1)) bad.push((k ? "goals" : "xG") + " " + t + " v " + o + (home ? " (H)" : " (A)") + " = " + p);
        });
      });
    });
  });
  return { ok: bad.length === 0, detail: bad.slice(0, 4).join("; ") || "60 pairs × 2 models all inside (0,1)" };
});
check("TS-tsMult-is-finite-and-positive", function () {
  let bad = 0;
  TEAMS.forEach(function (t) { TEAMS.forEach(function (o) { if (t === o) return; [true, false].forEach(function (h) { const m = E.tsMult(t, o, h, CTX.TS); if (!(isFinite(m) && m > 0)) bad++; }); }); });
  return { ok: bad === 0, detail: bad + " non-finite or non-positive multipliers" };
});
check("TS-home-advantage-beats-the-same-fixture-away", function () {
  const h = E.tsMult(1, 2, true, CTX.TS), a = E.tsMult(1, 2, false, CTX.TS);
  return { ok: h > a, detail: "home " + r4(h) + " vs away " + r4(a) };
});
check("TS-runAvg-returns-an-FDR-between-1-and-5", function () {
  const bad = TEAMS.map(function (t) { return E.runAvg(t, SYN.fixtures, 5); }).filter(function (v) { return !(v >= 1 && v <= 5); });
  return { ok: bad.length === 0, detail: "values " + TEAMS.map(function (t) { return r2(E.runAvg(t, SYN.fixtures, 5)); }).join(", ") };
});
check("RIVAL-ownership-shares-are-inside-0-and-1", function () {
  const bad = [];
  [E.rivalOwn(SYN), E.capShare(SYN)].forEach(function (map, k) {
    Object.keys(map).forEach(function (L) {
      Object.keys(map[L]).forEach(function (id) {
        const v = map[L][id];
        if (!(v >= 0 && v <= 1)) bad.push((k ? "capShare" : "rivalOwn") + " " + L + "/" + id + " = " + v);
      });
    });
  });
  return { ok: bad.length === 0, detail: bad.join("; ") || "all shares inside [0,1]" };
});
check("RIVAL-ownership-counts-the-rivals-not-me", function () {
  const own = E.rivalOwn(SYN);
  return { ok: own[900][5] === 1 && own[900][17] === 0.75 && own[900][11] === undefined, detail: "element 5 = " + own[900][5] + " (4 of 4), element 17 = " + own[900][17] + " (3 of 4), element 11 = " + own[900][11] + " (owned by nobody)" };
});
check("RIVAL-capShare-reads-is_captain", function () {
  const cs = E.capShare(SYN);
  return { ok: cs[900][5] === 0.75 && cs[900][16] === 0.25, detail: "element 5 captained by " + cs[900][5] + " of the rivals, element 16 by " + cs[900][16] };
});
check("RIVAL-classify-returns-EDGE-SHARED-DEAD-NEUTRAL", function () {
  const dead = E.classify(CTX.els[34], CTX);
  const shared = E.classify(CTX.els[17], CTX);
  const edge = E.classify(CTX.els[11], CTX);
  const valid = ["EDGE", "SHARED", "DEAD", "NEUTRAL"];
  const all = CTX.elList.map(function (el) { return E.classify(el, CTX); });
  const bad = all.filter(function (c) { return valid.indexOf(c) < 0; });
  return { ok: dead === "DEAD" && shared === "SHARED" && edge === "EDGE" && bad.length === 0, detail: "34=" + dead + " 17=" + shared + " 11=" + edge + "; invalid classes " + bad.length };
});
check("RIVAL-convergenceRisk-fires-at-0.60", function () {
  const a = E.convergenceRisk(5, CTX), b = E.convergenceRisk(11, CTX);
  return { ok: a.risk === true && a.max >= 0.60 && b.risk === false, detail: "element 5 risk=" + a.risk + " max=" + a.max + "; element 11 risk=" + b.risk + " max=" + b.max };
});

const XI_FOR_MC = E.bestXI(SYN_SQUAD, CTX);
const MC_A = E.mcSquad(SYN_SQUAD, XI_FOR_MC.capId, CTX, 400, 12345, XI_FOR_MC.viceId);
const MC_B = E.mcSquad(SYN_SQUAD, XI_FOR_MC.capId, CTX, 400, 12345, XI_FOR_MC.viceId);
const MC_C = E.mcSquad(SYN_SQUAD, XI_FOR_MC.capId, CTX, 400, 999, XI_FOR_MC.viceId);

check("MC-squad-quantiles-are-ordered-q10-q50-q90", function () {
  return { ok: MC_A.q10 <= MC_A.q50 && MC_A.q50 <= MC_A.q90 && MC_A.iters === 400, detail: "q10 " + MC_A.q10 + " ≤ q50 " + MC_A.q50 + " ≤ q90 " + MC_A.q90 + " over " + MC_A.iters + " iterations" };
});
check("MC-squad-is-reproducible-with-a-fixed-seed", function () {
  return { ok: JSON.stringify(MC_A) === JSON.stringify(MC_B), detail: "seed 12345 twice: " + JSON.stringify(MC_A) + " vs " + JSON.stringify(MC_B) };
});
check("MC-squad-moves-when-the-seed-changes", function () {
  return { ok: MC_A.mean !== MC_C.mean || MC_A.sd !== MC_C.sd, detail: "seed 12345 mean " + r2(MC_A.mean) + " vs seed 999 mean " + r2(MC_C.mean) };
});
check("MC-squad-mean-and-sd-are-finite-and-sd-is-positive", function () {
  return { ok: isFinite(MC_A.mean) && isFinite(MC_A.sd) && MC_A.sd > 0, detail: "mean " + r2(MC_A.mean) + " sd " + r2(MC_A.sd) };
});
check("MC-simPlayer-may-be-negative-and-that-is-correct", function () {
  // Cards and own goals exist; a suite that forbids a negative is the bug, not the engine.
  const rng = E.mulberry32(3);
  let min = Infinity;
  for (let i = 0; i < 4000; i++) min = Math.min(min, E.simPlayer(CTX.els[16], CTX, rng));
  return { ok: isFinite(min), detail: "lowest simulated score over 4000 draws = " + min };
});
check("MC-league-reports-no-win-probability-below-8-gameweeks", function () {
  const r = E.mcLeague(CTX, 900, { iters: 200, seed: 5 });
  return { ok: r.pWin === null && r.gwsOfData === 3 && /8/.test(r.pWinNote), detail: "pWin " + r.pWin + " with " + r.gwsOfData + " gameweeks · " + r.pWinNote };
});
check("MC-league-returns-a-direction-and-a-rank-band", function () {
  const r = E.mcLeague(CTX, 900, { iters: 200, seed: 5 });
  const ok = ["up", "down", "hold"].indexOf(r.direction) >= 0 && r.rankBand[0] <= r.rankBand[1] && r.rankBand[0] >= 1 && r.rankBand[1] <= r.entries;
  return { ok: ok, detail: "direction " + r.direction + " band [" + r.rankBand.join(",") + "] of " + r.entries + " entries, current rank " + r.currentRank };
});

const TOUR = E.tournament(SYN);
check("TOURNAMENT-returns-exactly-the-eight-named-models", function () {
  const keys = TOUR.models.map(function (m) { return m.key; });
  const want = ["season_mean", "last_gw", "per90", "shrunk_per90", "ict_rate", "bps_rate", "blend", "component_xp"];
  return { ok: keys.length === 8 && keys.join(",") === want.join(","), detail: "keys: " + keys.join(", ") };
});
check("TOURNAMENT-spearman-values-are-inside-minus-1-and-1", function () {
  const bad = TOUR.models.filter(function (m) { return m.spearman !== null && !(m.spearman >= -1 && m.spearman <= 1); });
  return { ok: bad.length === 0, detail: TOUR.models.map(function (m) { return m.key + "=" + (m.spearman === null ? "n/a" : r4(m.spearman)); }).join(" ") };
});
check("TOURNAMENT-promotion-needs-three-transitions", function () {
  return { ok: TOUR.transitions === 2 && TOUR.promotable === false, detail: TOUR.transitions + " transitions from 3 finished gameweeks; promotable=" + TOUR.promotable + " (gate is 3)" };
});
check("TOURNAMENT-leader-is-one-of-the-eight", function () {
  const keys = TOUR.models.map(function (m) { return m.key; });
  return { ok: TOUR.leader !== null && keys.indexOf(TOUR.leader) >= 0, detail: "leader " + TOUR.leader };
});
check("TOURNAMENT-spearman-of-a-perfect-ranking-is-1", function () {
  return { ok: close(E.spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), 1, 1e-9) && close(E.spearman([1, 2, 3, 4, 5], [50, 40, 30, 20, 10]), -1, 1e-9), detail: "perfect " + E.spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]) + ", inverted " + E.spearman([1, 2, 3, 4, 5], [50, 40, 30, 20, 10]) };
});

// ================================================================ E-026 — draft ↔ classic join on code

check("E026-synthetic-draft-ids-differ-and-the-code-join-is-the-truth", function () {
  const shifted = [4, 11, 17, 22, 30];
  const bad = [];
  shifted.forEach(function (id) {
    const classic = CTX.els[id];
    const byCode = CTX.draft.byCode[classic.code];
    const byId = CTX.draft.els[id];
    if (!byCode || byCode.code !== classic.code) bad.push(id + ": code join missed");
    if (byId && byId.code === classic.code) bad.push(id + ": id join accidentally correct — the fixture is wrong");
  });
  return { ok: bad.length === 0, detail: bad.join("; ") || shifted.length + " shifted draft ids all resolve by code" };
});

// ================================================================ live snapshot

const LIVE_PATH = path.join(ROOT, "data", "live.json");
let LIVE = null;
try { LIVE = JSON.parse(fs.readFileSync(LIVE_PATH, "utf8")); } catch (e) { LIVE = null; }

if (!LIVE) {
  console.log("SKIP live block — data/live.json is missing or unreadable (" + LIVE_PATH + ")");
} else {
  check("E026-live-59-draft-ids-differ-from-their-classic-ids", function () {
    const byCode = {}, byId = {};
    LIVE.elements.forEach(function (e) { byCode[e.code] = e; byId[e.id] = e; });
    const differ = LIVE.draft.elements.filter(function (d) { const c = byCode[d.code]; return c && c.id !== d.id; });
    return { ok: differ.length === 59, detail: differ.length + " draft ids differ from the classic id (expected 59, checked 11 Sep 2026)" };
  });
  check("E026-joining-by-code-resolves-the-same-player-joining-by-id-does-not", function () {
    const byCode = {}, byId = {};
    LIVE.elements.forEach(function (e) { byCode[e.code] = e; byId[e.id] = e; });
    const differ = LIVE.draft.elements.filter(function (d) { const c = byCode[d.code]; return c && c.id !== d.id; });
    if (!differ.length) return { ok: false, detail: "no shifted ids in the snapshot to test" };
    const badCode = differ.filter(function (d) { return byCode[d.code].web_name !== d.web_name; });
    const wrongById = differ.filter(function (d) { return byId[d.id] && byId[d.id].code !== d.code; });
    const ex = differ[0];
    return {
      ok: badCode.length === 0 && wrongById.length >= 1,
      detail: "code join wrong for " + badCode.length + " of " + differ.length + "; id join lands on a DIFFERENT player for " + wrongById.length +
        " — e.g. draft id " + ex.id + " (" + ex.web_name + ", code " + ex.code + ") joins by code to classic id " + byCode[ex.code].id +
        " (" + byCode[ex.code].web_name + "), but by id to " + (byId[ex.id] ? byId[ex.id].web_name : "nothing")
    };
  });
  check("DRAFT-live-goals_scored_GKP-is-10", function () {
    const D = E.draftScoring(LIVE);
    return { ok: D[1].goal === 10 && LIVE.draft.scoring.goals_scored_GKP === 10, detail: "live.draft.scoring.goals_scored_GKP = " + LIVE.draft.scoring.goals_scored_GKP + " → draft GKP goal " + D[1].goal + " (classic " + E.SCORING[1].goal + ")" };
  });
  check("LIVE-no-banned-ep_this-or-ep_next-field", function () {
    const raw = fs.readFileSync(LIVE_PATH, "utf8");
    return { ok: raw.indexOf("ep_this") < 0 && raw.indexOf("ep_next") < 0, detail: "banned field present in data/live.json" };
  });

  // ------------------------------------------------------------ live sanity block (prints numbers)
  console.log("");
  console.log("--- live sanity (data/live.json, fetched " + LIVE.fetched_at + ") ---");

  let LSTATE = null;
  try { LSTATE = JSON.parse(fs.readFileSync(path.join(ROOT, "state", "kwezi.json"), "utf8")); } catch (e) { LSTATE = null; }
  const t0 = Date.now();
  const LCTX = E.buildCtx(LIVE, LSTATE, LIVE.fetched_at);
  const buildMs = Date.now() - t0;

  check("LIVE-buildCtx-ok", function () {
    return { ok: LCTX.ok === true, detail: "ok=" + LCTX.ok + " error=" + LCTX.error };
  });
  console.log("buildCtx: ok=" + LCTX.ok + " · " + buildMs + " ms · next_event GW" + LCTX.nextEvent +
    " · deadline " + LCTX.deadline + " · " + (LCTX.hoursToDeadline === null ? "n/a" : r2(LCTX.hoursToDeadline)) + " h to deadline" +
    " · phase " + LCTX.phase + " · FT " + LCTX.ft + " · bank " + LCTX.bank + " · budget " + LCTX.budget + " tenths · block " + LCTX.block.block);

  const tags = E.overUnderTags(LIVE);
  const hull = tags.filter(function (t) { return t.short_name === "HUL"; })[0];
  const ars = tags.filter(function (t) { return t.short_name === "ARS"; })[0];
  if (hull) {
    const xgaPg = hull.g ? hull.xga / hull.g : 0;
    console.log("Hull: " + hull.g + " games · xGA " + r2(hull.xga) + " (" + r2(xgaPg) + " per game) · goals conceded " + hull.ga +
      " · tagAgainst " + String(hull.tagAgainst) + " · TS def " + r4(LCTX.TS[hull.teamId].def) + " (E-011: the goals model rated them the best defence; xG rates them average)");
    check("LIVE-Hull-conceded-fewer-goals-than-xGA-so-the-tag-is-UNDER", function () {
      return { ok: hull.tagAgainst === "UNDER" && xgaPg > 1.5, detail: "xGA/game " + r2(xgaPg) + " · goals conceded " + hull.ga + " · tagAgainst " + hull.tagAgainst };
    });
  } else {
    console.log("Hull: not in the snapshot");
  }
  if (ars) {
    console.log("Arsenal: " + ars.g + " games · xGA " + r2(ars.xga) + " (" + r2(ars.xga / ars.g) + " per game) · TS def " + r4(LCTX.TS[ars.teamId].def) + " (lower is a better defence)");
    check("LIVE-Arsenal-is-the-best-defence-on-xG", function () {
      const best = Object.keys(LCTX.TS).map(function (t) { return { t: Number(t), def: LCTX.TS[t].def }; }).sort(function (a, b) { return a.def - b.def; })[0];
      return { ok: best.t === ars.teamId && close(LCTX.TS[ars.teamId].def, 0.73, 0.02), detail: "best def team " + best.t + " (" + r4(best.def) + "); Arsenal def " + r4(LCTX.TS[ars.teamId].def) + ", CLAUDE.md E2 quotes 0.73" };
    });
  }

  const jp = LIVE.elements.filter(function (e) { return e.web_name === "João Pedro"; })[0];
  if (jp) {
    const own = LCTX.rivalOwn[1683215] ? LCTX.rivalOwn[1683215][jp.id] : undefined;
    const cap = LCTX.capShare[1683215] ? LCTX.capShare[1683215][jp.id] : undefined;
    const mx = E.rivalOwnMax(jp.id, LCTX);
    console.log("João Pedro (id " + jp.id + "): rivalOwn in 1683215 Nineteen45 = " + (own === undefined ? "0" : own) +
      " · captained by " + (cap === undefined ? "0" : cap) + " of the rivals there · highest across the six leagues " + r2(mx.max) + " (league " + mx.league + ")" +
      " · classify " + E.classify(jp, LCTX));
    check("LIVE-Joao-Pedro-is-convergent-not-a-differential", function () {
      return { ok: mx.max >= 0.60 && E.convergenceRisk(jp.id, LCTX).risk === true, detail: "max rival ownership " + r2(mx.max) + " ≥ 0.60 → CONVERGENCE" };
    });
  } else {
    console.log("João Pedro: not found by web_name in the snapshot");
  }

  let WEEKLY = null;
  try {
    WEEKLY = (new Function(fs.readFileSync(path.join(ROOT, "data", "weekly.js"), "utf8") + "\n;return WEEKLY;"))();
  } catch (e) { WEEKLY = null; }

  if (WEEKLY && WEEKLY.classic && Array.isArray(WEEKLY.classic.wildcard15)) {
    const w15 = WEEKLY.classic.wildcard15;
    const L15 = E.legal15(w15, LCTX.els, LCTX.budget);
    const xi = E.bestXI(w15, LCTX);
    const cp = E.captainPick(xi.ids, LCTX);
    const name = function (id) { return id !== null && LCTX.els[id] ? LCTX.els[id].web_name : String(id); };
    console.log("WEEKLY wildcard15: cost " + L15.cost + " tenths vs budget " + LCTX.budget + " · legal15 " + L15.ok + (L15.ok ? "" : " (" + L15.reasons.join("; ") + ")"));
    console.log("  bestXI " + xi.formation + " score " + r2(xi.score) + " · captainPick " + name(cp.capId) + " (id " + cp.capId + ")" +
      ", vice " + name(cp.viceId) + " (id " + cp.viceId + ")");
    console.log("  captain table top 3: " + cp.table.slice(0, 3).map(function (r) { return r.web_name + " EV " + r2(r.ev) + (r.eligible ? "" : " [" + r.why + "]"); }).join(" · "));
    check("LIVE-WEEKLY-wildcard15-is-a-legal-fifteen-inside-the-selling-value", function () {
      return { ok: L15.ok && L15.cost <= LCTX.budget, detail: "cost " + L15.cost + " budget " + LCTX.budget + " ok=" + L15.ok + " " + L15.reasons.join("; ") };
    });
    check("LIVE-WEEKLY-captain-is-in-the-XI-and-unflagged", function () {
      const capRow = cp.table.filter(function (r) { return r.id === cp.capId; })[0];
      return { ok: cp.capId !== null && xi.ids.indexOf(cp.capId) >= 0 && capRow && capRow.flagged === false, detail: "capId " + cp.capId + " in XI=" + (xi.ids.indexOf(cp.capId) >= 0) + " flagged=" + (capRow ? capRow.flagged : "n/a") };
    });
    check("LIVE-WEEKLY-wildcard15-carries-no-flagged-player", function () {
      const flagged = w15.filter(function (id) { return LCTX.flags[id] && LCTX.flags[id].flagged; });
      return { ok: flagged.length === 0, detail: "flagged in the fifteen: " + flagged.map(function (id) { return name(id) + " (" + LCTX.flags[id].status + " " + LCTX.flags[id].chance + "%)"; }).join(", ") || "none" };
    });
  } else {
    console.log("WEEKLY: data/weekly.js could not be evaluated — wildcard15 checks skipped");
  }

  const t1 = Date.now();
  const lwc = E.wildcardSolver(LCTX, {});
  const wcMs = Date.now() - t1;
  const lwcLegal = lwc.ok ? E.legal15(lwc.ids, LCTX.els, lwc.budget) : { ok: false, reasons: lwc.reasons, cost: 0 };
  console.log("wildcardSolver: ok=" + lwc.ok + " · " + wcMs + " ms · cost " + lwc.cost + " of budget " + lwc.budget + " tenths · bank " + lwc.bank +
    " · objective " + r2(lwc.score) + " · legal15 " + lwcLegal.ok + " · model " + lwc.model +
    (lwc.disagreement ? " · goals model differs on " + lwc.disagreement.playersDiffer + " players" : ""));
  check("LIVE-wildcardSolver-returns-a-legal-fifteen-within-budget", function () {
    return { ok: lwc.ok && lwcLegal.ok && lwc.cost <= lwc.budget && lwc.bank >= 0, detail: "ok=" + lwc.ok + " legal15=" + lwcLegal.ok + " cost " + lwc.cost + " ≤ " + lwc.budget + " bank " + lwc.bank + " " + (lwcLegal.reasons || []).join("; ") };
  });
  check("LIVE-wildcardSolver-picks-nobody-who-is-60-percent-rival-owned", function () {
    const bad = (lwc.ids || []).filter(function (id) { return E.rivalOwnMax(id, LCTX).max >= 0.60; });
    return { ok: bad.length === 0, detail: "convergent picks: " + bad.map(function (id) { return LCTX.els[id].web_name + " " + r2(E.rivalOwnMax(id, LCTX).max); }).join(", ") || "none" };
  });

  const ltour = E.tournament(LIVE);
  console.log("tournament: leader " + ltour.leader + " · " + ltour.transitions + " transitions · promotable " + ltour.promotable);
  console.log("  " + ltour.models.map(function (m) { return m.key + " ρ=" + (m.spearman === null ? "n/a" : r4(m.spearman)) + " MAE=" + (m.mae === null ? "n/a" : r2(m.mae)); }).join("\n  "));
  check("LIVE-tournament-has-eight-models-and-is-not-promotable-yet", function () {
    return { ok: ltour.models.length === 8 && ltour.transitions === 2 && ltour.promotable === false, detail: ltour.models.length + " models · " + ltour.transitions + " transitions · promotable " + ltour.promotable + " (gate is 3, GW5 earliest)" };
  });
  check("LIVE-deadline-is-read-from-is_next-never-hard-coded", function () {
    const nextEv = LIVE.events.filter(function (e) { return e.is_next; })[0];
    return { ok: !!nextEv && LCTX.deadline === nextEv.deadline_time && LCTX.nextEvent === nextEv.id, detail: "events[is_next] GW" + (nextEv ? nextEv.id : "?") + " " + (nextEv ? nextEv.deadline_time : "?") + " · ctx " + LCTX.nextEvent + " " + LCTX.deadline };
  });
  console.log("--- end live sanity ---");
  console.log("");
}

// ================================================================ done

console.log("SUITE unit_engine " + pass + "/" + (pass + fail));
if (fail > 0) {
  console.log("failures:");
  failures.forEach(function (f) { console.log("  " + f); });
  process.exit(1);
}

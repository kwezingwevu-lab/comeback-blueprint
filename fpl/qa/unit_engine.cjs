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

// E-043: fxMult takes a FIXTURE OBJECT. Handed an id it returns the neutral 1 and every xp
// silently falls back to the shrunk baseline. fxMultInfo is the way to tell the two apart.
check("XP-fxMult-answers-from-a-fixture-object-and-not-from-a-fixture-id", function () {
  const fxs = SYN.fixtures.filter(function (f) { return f.event === 4; });
  const live = fxs.filter(function (f) { return Math.abs(E.fxMult(f, f.team_h, CTX.TS) - 1) > 1e-6; })[0];
  if (!live) return { ok: false, detail: "no GW4 fixture in the synthetic snapshot has a multiplier away from 1" };
  const byObj = E.fxMult(live, live.team_h, CTX.TS);
  const byId = E.fxMult(live.id, live.team_h, CTX.TS);
  return { ok: Math.abs(byObj - 1) > 1e-6 && byId === 1, detail: "fixture " + live.id + ": object → " + r4(byObj) + ", id → " + byId + " (the neutral default)" };
});
check("XP-fxMultInfo-marks-the-neutral-answer-as-unresolved", function () {
  const fx = SYN.fixtures.filter(function (f) { return f.event === 4; })[0];
  const good = E.fxMultInfo(fx, fx.team_h, CTX.TS);
  const byId = E.fxMultInfo(fx.id, fx.team_h, CTX.TS);
  const away = E.fxMultInfo(fx, fx.team_a, CTX.TS);
  const other = E.fxMultInfo(fx, 999, CTX.TS);
  const ok = good.resolved === true && good.reason === "home" && away.resolved === true && away.reason === "away" &&
    byId.resolved === false && byId.mult === 1 && /not a fixture object/.test(byId.reason) &&
    other.resolved === false && other.mult === 1 && /not in this fixture/.test(other.reason);
  return { ok: ok, detail: "object → resolved " + good.resolved + " (" + good.reason + "); id → resolved " + byId.resolved + " (" + byId.reason + "); team not in the fixture → " + other.reason };
});

// E1 again, but on the two functions the whole app actually calls. Every recommendation is a
// comparison of xp5 values, so the formula is asserted element by element against the published
// definition rather than through a single worked example.
check("XP-xp5-is-shrunkPps-times-P(start)-times-the-decayed-fixture-run-for-every-element", function () {
  const bad = [];
  CTX.elList.forEach(function (el) {
    const mults = E.teamMults(el.team, CTX, "TS");
    const p = E.pStart(el, CTX.gwStats);
    const shrunk = E.shrunkPps(el);
    let acc = 0;
    for (let k = 0; k < 5; k++) acc += E.DECAY[k] * mults[k];
    const want = shrunk * p * acc;
    const got = E.xp5(el, CTX);
    if (!close(got, want, 1e-9)) bad.push(el.id + ": " + r4(got) + " vs " + r4(want));
  });
  const spread = CTX.elList.map(function (el) { return E.xp5(el, CTX); });
  const lo = Math.min.apply(null, spread), hi = Math.max.apply(null, spread);
  return { ok: bad.length === 0 && hi > lo && lo >= 0,
    detail: bad.length ? bad.slice(0, 3).join("; ") : CTX.elList.length + " elements reconcile to shrunk × P(start) × Σ decay·mult; xp5 spread " + r2(lo) + " to " + r2(hi) };
});
check("XP-xp1-is-the-next-fixture-only-and-is-zero-on-a-blank-gameweek", function () {
  const bad = [];
  CTX.elList.forEach(function (el) {
    const want = E.shrunkPps(el) * E.teamMults(el.team, CTX, "TS")[0] * E.pStart(el, CTX.gwStats);
    if (!close(E.xp1(el, CTX), want, 1e-9)) bad.push(String(el.id));
  });
  // Take team 3's GW4 fixture away: xp1 must go to zero for its players while xp5 survives on
  // the four gameweeks that remain.
  const V = JSON.parse(JSON.stringify(SYN));
  V.fixtures = V.fixtures.filter(function (f) { return !(f.event === 4 && (f.team_h === 3 || f.team_a === 3)); });
  const ctxB = E.buildCtx(V, SYN_STATE, SYN_NOW);
  const blanked = ctxB.elList.filter(function (el) { return el.team === 3; });
  const stillOne = blanked.filter(function (el) { return E.xp1(el, ctxB) !== 0; });
  const lostFive = blanked.filter(function (el) { return !(E.xp5(el, ctxB) > 0); });
  const playing = ctxB.elList.filter(function (el) { return el.team === 1 && E.xp1(el, ctxB) > 0; });
  return { ok: bad.length === 0 && blanked.length === 6 && stillOne.length === 0 && lostFive.length === 0 && playing.length > 0,
    detail: bad.length ? "formula mismatch on " + bad.slice(0, 3).join(",") :
      blanked.length + " team-3 players blank in GW4 → xp1 " + (stillOne.length ? stillOne.length + " non-zero" : "all zero") +
      ", xp5 still positive for " + (blanked.length - lostFive.length) + " of them; team 1 still plays (" + playing.length + " with xp1 > 0)" };
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
// E-045: the two accepted shapes used to answer differently, because the chips list was only
// ever read from the object. These three calls must agree, and the array form is what the app
// hands in when it has already unwrapped the history.
check("FT-the-object-and-the-rows-array-agree-on-a-chip-week", function () {
  const h = {
    current: [{ event: 1, event_transfers: 0, event_transfers_cost: 0 },
              { event: 2, event_transfers: 11, event_transfers_cost: 0 },
              { event: 3, event_transfers: 0, event_transfers_cost: 0 }],
    chips: [{ name: "wildcard", event: 2 }]
  };
  const a = E.ftAvailable(h, 3), b = E.ftAvailable(h.current, 3), c = E.ftAvailable(h.current, 3, h.chips);
  return { ok: a === 3 && b === 3 && c === 3, detail: "object " + a + " · rows array " + b + " · rows array with chips " + c + " (a chip week consumes no free transfer, so 3)" };
});
check("FT-the-two-shapes-agree-over-two-hundred-generated-histories", function () {
  let seed = 4242;
  const rnd = function () { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const ri = function (lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); };
  let explicitBad = 0, noChipBad = 0, withChips = 0, firstBad = "";
  for (let n = 0; n < 200; n++) {
    const gws = ri(2, 12), cur = [], chips = [];
    for (let g = 1; g <= gws; g++) {
      const t = ri(0, 4), cost = t > 1 && rnd() < 0.5 ? (t - 1) * 4 : 0;
      cur.push({ event: g, event_transfers: t, event_transfers_cost: cost });
    }
    if (rnd() < 0.4) { const ev = ri(2, gws); chips.push({ name: rnd() < 0.5 ? "wildcard" : "freehit", event: ev }); cur[ev - 1].event_transfers = ri(6, 15); cur[ev - 1].event_transfers_cost = 0; }
    const h = { current: cur, chips: chips };
    const a = E.ftAvailable(h, gws), c = E.ftAvailable(cur, gws, chips);
    if (a !== c) { explicitBad++; if (!firstBad) firstBad = "explicit chips disagree at gw " + gws + ": " + a + " vs " + c; }
    if (chips.length) withChips++;
    else { const b = E.ftAvailable(cur, gws); if (a !== b) { noChipBad++; if (!firstBad) firstBad = "chip-free history disagrees at gw " + gws + ": " + a + " vs " + b; } }
  }
  return { ok: explicitBad === 0 && noChipBad === 0, detail: "200 histories (" + withChips + " with a chip): " + explicitBad + " disagreements when the chips are passed, " + noChipBad + " on chip-free histories" + (firstBad ? " — " + firstBad : "") };
});
check("FT-junk-history-returns-1-not-a-throw", function () {
  return { ok: E.ftAvailable(null, 3) === 1 && E.ftAvailable({ current: "x" }, 3) === 1, detail: "null → " + E.ftAvailable(null, 3) + ", junk → " + E.ftAvailable({ current: "x" }, 3) };
});

// ================================================================ D4 — refresh path

check("REFRESH-parseJson-strips-code-fences", function () {
  const v = E.parseJson("```json\n{\"a\":1,\"b\":[1,2]}\n```");
  return { ok: v && v.a === 1 && v.b.length === 2, detail: JSON.stringify(v) };
});
// E-044: the fence strip used to be global, so it ran inside JSON string values and ate the
// whitespace after each fence. D4 payloads carry news text, which is where a stray fence lands.
check("REFRESH-parseJson-keeps-a-code-fence-that-sits-inside-a-string-value", function () {
  const v = E.parseJson('{"news":"a ``` b"}');
  return { ok: v && v.news === "a ``` b", detail: "news came back as " + JSON.stringify(v && v.news) + ", expected \"a ``` b\"" };
});
check("REFRESH-stripFences-only-touches-the-opening-and-the-closing-fence", function () {
  const a = E.stripFences("```json\n{\"a\":1}\n```");
  const b = E.stripFences('{"news":"x ``` y"}');
  const c = E.stripFences("```\n{\"a\":1}");
  return { ok: a === '{"a":1}' && b === '{"news":"x ``` y"}' && c === '{"a":1}', detail: "fenced → " + a + " · inline fence → " + b + " · unclosed fence → " + c };
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

// C1 rule 3. The sweep over the synthetic fifteen alone cannot fail: no player in it starts at
// P(start) < 0.5, so the loop body never runs and the check passes whatever pickXI does. The
// rule only means something when the two signals disagree, so the control below puts the
// highest-scoring player in the game at P(start) 0.30 and asks for him to be benched anyway —
// then flips only his P(start) to 0.90 and asks for the opposite answer.
check("XI-never-starts-a-sub-0.5-player-ahead-of-a-0.75-one", function () {
  const rows = function (starP) {
    const out = [
      { id: 1, name: "GK1", type: 1, team: 1, pts: 30, starts: 3, xp1: 3, pstart: 0.9 },
      { id: 2, name: "GK2", type: 1, team: 2, pts: 20, starts: 3, xp1: 2, pstart: 0.9 }
    ];
    for (let i = 0; i < 5; i++) out.push({ id: 10 + i, name: "D" + i, type: 2, team: 1 + i, pts: 30, starts: 3, xp1: 4, pstart: 0.9 });
    out.push({ id: 20, name: "DoubtStar", type: 3, team: 1, pts: 90, starts: 3, xp1: 20, pstart: starP, status: starP < 0.5 ? "d" : "a", chance: starP < 0.5 ? 30 : null });
    for (let i = 1; i < 5; i++) out.push({ id: 20 + i, name: "M" + i, type: 3, team: i, pts: 30, starts: 3, xp1: 5, pstart: 0.9 });
    for (let i = 0; i < 3; i++) out.push({ id: 30 + i, name: "F" + i, type: 4, team: i + 1, pts: 30, starts: 3, xp1: 5, pstart: 0.9 });
    return out;
  };
  const doubt = rows(0.30), fit = rows(0.90);
  const ids = doubt.map(function (r) { return r.id; });
  const benched = E.bestXI(ids, stubCtx(doubt));
  const started = E.bestXI(ids, stubCtx(fit));
  const ctrlOk = benched.ids.indexOf(20) < 0 && started.ids.indexOf(20) >= 0 &&
    E.legalXI(benched.ids, stubCtx(doubt).els).ok && E.legalXI(started.ids, stubCtx(fit).els).ok;
  // …and the same property, swept over the real synthetic fifteen.
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
  return { ok: ctrlOk && bad.length === 0,
    detail: "control: the 20-point midfielder at P(start) 0.30 is " + (benched.ids.indexOf(20) < 0 ? "benched" : "STARTED (" + benched.formation + ")") +
      " and the same man at 0.90 is " + (started.ids.indexOf(20) >= 0 ? "started" : "BENCHED") +
      "; synthetic fifteen violations: " + (bad.join("; ") || "none") };
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

// ---------------------------------------------------------------- sellCandidates (C1 rule 1)

check("SELL-candidates-name-the-dead-and-the-unavailable-and-nobody-else", function () {
  const list = E.sellCandidates([34, 22, 3, 16, 2, 9], CTX);
  const by = {}; list.forEach(function (s) { by[s.id] = s; });
  const dead = by[34], flagged = by[22], konsa = by[3];
  const ok = list.length === 3 &&
    dead && dead.forced === true && /no starts in the last 3/.test(dead.reason) &&
    flagged && flagged.forced === true && /status d/.test(flagged.reason) && /75/.test(flagged.reason) &&
    konsa && konsa.forced === false && konsa.konsa === true &&
    !by[16] && !by[2] && !by[9];
  return { ok: ok, detail: list.map(function (s) { return s.id + (s.forced ? " FORCED" : " protected") + " (" + s.reason + ")"; }).join(" · ") +
    "; three fit regulars (16, 2, 9) are absent" };
});
check("SELL-E010-a-returning-starter-is-listed-as-protected-never-as-a-forced-sell", function () {
  // Konsa: element 3 did not start GW1 or GW2 and started GW3. starts_last3 is 1, so he is not
  // a forced sell — and the entry that names him must say so, or the transfer protocol has no
  // way to keep him. A universe where the rule is dropped would return him as forced.
  const gs = CTX.gwStats[3];
  const rec = E.sellCandidates([3], CTX)[0];
  const plan = E.transferProtocol(SYN_STATE, CTX);
  const soldHim = plan.moves.filter(function (m) { return m.out === 3; });
  const ok = gs.starts_last3 === 1 && gs.startedLast === true && gs.konsa === true &&
    rec && rec.forced === false && rec.konsa === true && soldHim.length === 0;
  return { ok: ok, detail: "element 3: starts in the last three = " + gs.starts_last3 + ", started the last match = " + gs.startedLast +
    ", konsa = " + gs.konsa + " → " + (rec ? (rec.forced ? "FORCED" : "protected") : "not listed") + "; the protocol sold him " + soldHim.length + " times" };
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
  // `margin >= 0` is true by construction (the plans are sorted by value), so the old
  // assertion could not fail for the reason its name gives. What can fail is the identity:
  // the margin has to be the shipped plan's value minus the value of the best plan that is
  // genuinely different, and the alternatives panel has to be free of duplicates under the
  // same key. Measure the key here, independently of the engine.
  const key = function (moves) {
    return moves.map(function (m) { return m.out; }).sort(function (a, b) { return a - b; }).join(",") + ">" +
           moves.map(function (m) { return m.in; }).sort(function (a, b) { return a - b; }).join(",");
  };
  if (!TP.moves.length) return { ok: false, detail: "the fixture shipped no plan, so the margin has nothing to be measured against" };
  if (!TP.alternatives.length) return { ok: false, detail: "no alternative was ranked, so the margin cannot be shown to be measured against one" };
  const bestKey = key(TP.moves);
  const same = TP.alternatives.filter(function (alt) { return key(alt.moves) === bestKey; });
  const keys = TP.alternatives.map(function (alt) { return key(alt.moves); });
  const dupes = keys.filter(function (k, i) { return keys.indexOf(k) !== i; });
  const expect = TP.value - TP.alternatives[0].value;
  const ok = same.length === 0 && dupes.length === 0 && TP.margin > 0 && close(TP.margin, expect, 1e-9);
  return { ok: ok, detail: "shipped " + bestKey + " (value " + r2(TP.value) + "); best genuinely different " + keys[0] + " (value " + r2(TP.alternatives[0].value) +
    ") → margin should be " + r2(expect) + ", engine says " + r2(TP.margin) + "; duplicates in the panel " + dupes.length + ", panel copies of the shipped plan " + same.length };
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
// C1 rule 1, with a fixture that can actually break it. The base synthetic plan is driven by a
// FORCED sell, so it carries no optional move at all and "no optional move has a gain ≤ 4" was
// true of an empty list. CTX_OPT removes both forced sells (element 34 becomes a fit but weak
// starter, element 22 loses its flag), which leaves the protocol nothing to ship but optional
// upgrades — and leaves 20-odd legal sub-4 upgrades on the table for it to refuse.
const SYN_OPT = (function () {
  const V = JSON.parse(JSON.stringify(SYN));
  ["1", "2", "3"].forEach(function (g) {
    const row = V.gw[g].elements[28].slice();
    row[2] = 4;                                                   // three starts, four points a week
    V.gw[g].elements[34] = row;
  });
  V.elements.forEach(function (el) {
    if (el.id === 34) { el.total_points = 12; el.minutes = 270; el.starts = 3; }
    if (el.id === 22) { el.status = "a"; el.chance = null; el.news = ""; }
  });
  return V;
})();
const CTX_OPT = E.buildCtx(SYN_OPT, SYN_STATE, SYN_NOW);
const TP_OPT = E.transferProtocol(SYN_STATE, CTX_OPT);

check("TP-an-optional-sell-needs-a-five-week-gain-above-4", function () {
  const forced = E.sellCandidates(SYN_SQUAD, CTX_OPT).filter(function (s) { return s.forced; });
  const optional = TP_OPT.moves.filter(function (m) { return !m.forced; });
  const shippedBad = optional.filter(function (m) { return m.gain <= 4; });
  // every alternative the panel ranked is held to the same rule
  const altBad = [];
  TP_OPT.alternatives.forEach(function (a) { a.moves.forEach(function (m) { if (m.gain <= 4) altBad.push(m.out + "→" + m.in + " " + r2(m.gain)); }); });
  // the opportunity the rule declines: legal same-position upgrades worth more than 0 and at most 4
  const subFour = [];
  SYN_SQUAD.forEach(function (o) {
    CTX_OPT.elList.forEach(function (c) {
      if (SYN_SQUAD.indexOf(c.id) >= 0 || c.element_type !== CTX_OPT.els[o].element_type) return;
      const g = CTX_OPT.xp[c.id].xp5 - CTX_OPT.xp[o].xp5;
      if (g > 0 && g <= 4) subFour.push(o + "→" + c.id);
    });
  });
  const shippedPairs = TP_OPT.moves.map(function (m) { return m.out + "→" + m.in; })
    .concat(TP_OPT.alternatives.reduce(function (acc, a) { return acc.concat(a.moves.map(function (m) { return m.out + "→" + m.in; })); }, []));
  const leaked = subFour.filter(function (p) { return shippedPairs.indexOf(p) >= 0; });
  const ok = forced.length === 0 && optional.length === TP_OPT.moves.length && optional.length >= 1 &&
    shippedBad.length === 0 && altBad.length === 0 && subFour.length > 0 && leaked.length === 0;
  return { ok: ok, detail: "no forced sells (" + forced.length + "); " + optional.length + " optional move(s) at gains " +
    optional.map(function (m) { return r2(m.gain); }).join(",") + "; " + subFour.length +
    " legal sub-4 upgrades existed and " + leaked.length + " reached a plan; alternatives below the threshold: " + altBad.length };
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

// ---------------------------------------------------------------- E-037: the execution order

// C2 step 5: sells first, captain and vice last. The no-plan path used to return an empty order.
// A context whose element list holds nothing but the squad has no buy candidates at all, so the
// protocol reaches "hold" with no plan to rank — the exact branch that used to return early.
const CTX_NOPOOL = E.buildCtx(SYN, SYN_STATE, SYN_NOW);
CTX_NOPOOL.elList = CTX_NOPOOL.elList.filter(function (el) { return CTX_NOPOOL.squadIds.indexOf(el.id) >= 0; });
const TPH = E.transferProtocol(SYN_STATE, CTX_NOPOOL);

check("TP-the-hold-path-still-lists-the-captain-and-the-vice-as-steps", function () {
  const o = TPH.order;
  const ok = TPH.moves.length === 0 && o.length === 2 &&
    o[0].action === "captain" && o[1].action === "vice" &&
    o[0].id === TPH.captain && o[1].id === TPH.vice && TPH.captain !== null &&
    o[0].step === 1 && o[1].step === 2;
  return { ok: ok, detail: "moves " + TPH.moves.length + " · confidence " + TPH.confidence + " · order [" + o.map(function (x) { return x.action + " " + x.id; }).join(", ") + "] · captain " + TPH.captain + " vice " + TPH.vice };
});
check("TP-the-shipping-path-ends-its-order-with-the-captain-then-the-vice", function () {
  const o = TP.order;
  if (o.length < 2) return { ok: false, detail: "order has " + o.length + " steps" };
  const sells = o.filter(function (x) { return x.action === "sell"; });
  const buys = o.filter(function (x) { return x.action === "buy"; });
  const lastTwo = o.slice(-2);
  const sellsFirst = sells.every(function (x, i) { return o.indexOf(x) === i; });
  const stepsRun = o.every(function (x, i) { return x.step === i + 1; });
  const ok = lastTwo[0].action === "captain" && lastTwo[1].action === "vice" &&
    lastTwo[0].id === TP.captain && lastTwo[1].id === TP.vice &&
    sells.length === TP.moves.length && buys.length === TP.moves.length && sellsFirst && stepsRun;
  return { ok: ok, detail: o.map(function (x) { return x.step + " " + x.action + " " + x.id; }).join(" · ") };
});

// ---------------------------------------------------------------- E-067: a hold ships nothing

// A hold has to report a hold. `k`, `hits`, `value` and `bankAfter` used to be written from the
// best plan BEFORE the ship decision, so a hold week returned k=3 with an empty move list and the
// landing card read "no hit: 3 of your 3 free transfers" while recommending no transfer at all.
// Found by mc_all I55 on a randomly generated universe (0 moves for k 3).
//
// The fixture: a clean fifteen with no forced sell, and two out-of-squad midfielders made
// numerically identical (same club, same season totals, same gameweek rows) so two genuinely
// different plans tie exactly, the margin is 0 and the protocol holds with plans on the table.
const SYN_TIE = (function () {
  const V = JSON.parse(JSON.stringify(SYN));
  const byId = {}; V.elements.forEach(function (e) { byId[e.id] = e; });
  const donor = byId[11], twin = byId[35];
  ["team", "element_type", "now_cost", "status", "news", "chance", "total_points", "minutes", "starts",
   "xg", "xa", "xgc", "dc", "bps", "ict", "form", "goals", "assists", "cs", "gc", "bonus", "yc", "rc",
   "og", "pen_miss", "pen_save", "saves"].forEach(function (k) { twin[k] = donor[k]; });
  for (let g = 1; g <= 3; g++) {
    const rows = V.gw[String(g)].elements;
    if (rows[11]) rows[35] = rows[11].slice(); else delete rows[35];
  }
  return V;
})();
const TIE_SQUAD = [1, 2, 4, 8, 10, 12, 14, 16, 18, 19, 20, 23, 26, 29, 30];
const TIE_STATE = {
  version: 87, exported_at: SYN_NOW, entry: 3546875,
  squad: TIE_SQUAD.map(function (id) {
    const el = SYN_TIE.elements.filter(function (e) { return e.id === id; })[0];
    return { id: id, purchase: el.now_cost };
  }),
  bank: 40, ft: 1, value: 960, confirmed_gw: 3, leagues: [900],
  draft: { league_id: null, roster: [], watchlist: [] },
  ui: { mode: "simple", tab: "command", open: {}, reveals: {} }, ledger: [],
  refresh: { pair: "sonnet46", last: null }
};
const TIE_SNAP = (function () {
  const V = JSON.parse(JSON.stringify(SYN_TIE));
  V.picks = {};                                        // no live picks: nothing to block on
  V.ft_available = 1;
  return V;
})();
const CTX_TIE = E.buildCtx(TIE_SNAP, TIE_STATE, SYN_NOW);
const TPT = E.transferProtocol(TIE_STATE, CTX_TIE);

check("E067-a-hold-reports-no-transfers-no-hit-and-an-untouched-bank", function () {
  const bad = [];
  if (TPT.moves.length !== 0) bad.push("the fixture shipped " + TPT.moves.length + " moves instead of holding (confidence " + TPT.confidence + ")");
  if (TPT.confidence !== "hold") bad.push("confidence is " + TPT.confidence + ", not hold");
  if (!TPT.alternatives.length) bad.push("the plans that were considered were not kept as alternatives");
  if (TPT.k !== 0) bad.push("k is " + TPT.k + " on a hold");
  if (TPT.hits !== 0) bad.push("hits is " + TPT.hits + " on a hold");
  if (TPT.value !== 0) bad.push("value is " + TPT.value + " on a hold");
  if (TPT.bankAfter !== TPT.bank) bad.push("bankAfter " + TPT.bankAfter + " against a bank of " + TPT.bank);
  return { ok: !bad.length, detail: bad.join("; ") || "margin " + r2(TPT.margin) + " with " + TPT.alternatives.length +
    " plans considered (best worth " + r2(TPT.alternatives[0] ? TPT.alternatives[0].value : 0) + " over " +
    (TPT.alternatives[0] ? TPT.alternatives[0].k : 0) + " swaps); shipped k 0, hits 0, bank " + TPT.bank + " unchanged" };
});
check("E067-every-transfer-plan-reports-as-many-moves-as-its-k", function () {
  const all = [TP, TP3, TPH, TPT, E.transferProtocol(null, CTX)];
  const bad = all.filter(function (r) { return r.moves.length !== r.k || r.hits !== Math.max(0, r.k - r.ft) * 4; });
  return { ok: bad.length === 0, detail: bad.length ? bad.map(function (r) { return r.moves.length + " moves for k " + r.k + " hits " + r.hits; }).join("; ")
    : all.map(function (r) { return r.confidence + ":" + r.k + "/" + r.moves.length; }).join(" · ") };
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

// E-038 acceptance test: a local search has only one honest claim to make — that no single legal
// swap improves what it returned. wcLocalOptimum re-scans the WHOLE eligible pool with the
// solver's own feasibility (wcSetup/wcFeasible), so it cannot be a private copy of the rules.
check("WC-the-returned-fifteen-is-a-one-swap-local-optimum", function () {
  if (!WC.ok) return { ok: false, detail: "solver not ok" };
  const lo = E.wcLocalOptimum(WC.ids, CTX, {});
  return { ok: lo.ok && lo.optimal === true && lo.checked > 0, detail: lo.reason + " (" + lo.checked + " swaps tested, bank " + lo.bank + " tenths)" };
});
check("WC-the-local-optimum-test-fails-on-a-deliberately-worsened-fifteen", function () {
  // A check that cannot fail proves nothing: worsen the squad by one legal swap and the same
  // function must report the fifteen as improvable, naming the swap back.
  if (!WC.ok) return { ok: false, detail: "solver not ok" };
  const W = E.wcSetup(CTX, {}, "TS");
  if (!W.ok) return { ok: false, detail: "wcSetup: " + W.reasons.join("; ") };
  const base = E.wcObjective(WC.ids, CTX, "TS");
  let worse = null, dropped = null, brought = null;
  for (let i = 0; i < WC.ids.length && !worse; i++) {
    const t = CTX.els[WC.ids[i]].element_type;
    const pool = W.pool[t] || [];
    for (let j = pool.length - 1; j >= 0; j--) {
      if (WC.ids.indexOf(pool[j]) >= 0) continue;
      const trial = WC.ids.slice(); trial[i] = pool[j];
      if (!E.wcFeasible(trial, CTX, W)) continue;
      if (E.wcObjective(trial, CTX, "TS") < base - 1e-6) { worse = trial; dropped = WC.ids[i]; brought = pool[j]; break; }
    }
  }
  if (!worse) return { ok: false, detail: "no legal worsening swap exists in the synthetic pool — the control cannot be run" };
  const lo = E.wcLocalOptimum(worse, CTX, {});
  const namesBack = lo.improvements.some(function (m) { return m.out === brought && m.in === dropped; });
  return { ok: lo.ok && lo.optimal === false && lo.bestGain > 0 && namesBack, detail: "swapped " + dropped + " out for " + brought + ": optimal=" + lo.optimal + ", best gain " + r4(lo.bestGain) + ", swap back named=" + namesBack };
});
check("WC-wildcardOptions-leaves-the-solver-default-exactly-where-it-was", function () {
  const opt = E.wildcardOptions(CTX, { written: SYN_SQUAD });
  if (!opt.ok) return { ok: false, detail: "wildcardOptions: " + opt.reasons.join("; ") };
  const same = opt.pure.ids.slice().sort(function (a, b) { return a - b; }).join(",") === WC.ids.slice().sort(function (a, b) { return a - b; }).join(",");
  const shapes = ["pure", "locked", "written"].every(function (k) { return opt[k] && Array.isArray(opt[k].ids); });
  return { ok: same && shapes && opt.written.ok === true, detail: "pure matches wildcardSolver: " + same + " · three variants present: " + shapes + " · written scored: " + opt.written.ok };
});
check("WC-wildcardOptions-locks-only-what-the-written-plan-and-the-ownership-data-both-say", function () {
  // Derived, never a list of ids: the locks are exactly written15 ∩ convergent.
  const written = SYN_SQUAD;
  const opt = E.wildcardOptions(CTX, { written: written });
  if (!opt.ok) return { ok: false, detail: "wildcardOptions: " + opt.reasons.join("; ") };
  const want = written.filter(function (id) { return E.convergenceRisk(id, CTX).risk; }).sort(function (a, b) { return a - b; });
  const got = opt.locks.map(function (l) { return l.id; }).sort(function (a, b) { return a - b; });
  const inSolve = opt.locked.ok ? want.every(function (id) { return opt.locked.ids.indexOf(id) >= 0; }) : false;
  return { ok: want.join(",") === got.join(",") && inSolve, detail: "convergent players inside the written fifteen: [" + want.join(",") + "], locks returned [" + got.join(",") + "], all present in the locked solve: " + inSolve };
});

// ---------------------------------------------------------------- E-042: wildcard timing

const TIM = E.wildcardTiming(CTX);
check("TIMING-both-headline-horizons-include-their-own-end-gameweek", function () {
  const g19 = TIM.horizons.filter(function (h) { return /GW19/.test(h.label); })[0];
  const g38 = TIM.horizons.filter(function (h) { return /GW38/.test(h.label); })[0];
  if (!g19 || !g38) return { ok: false, detail: "horizons: " + TIM.horizons.map(function (h) { return h.label; }).join(", ") };
  const ok = g19.weeks === 19 - TIM.gw + 1 && g38.weeks === 38 - TIM.gw + 1 && g19.gw === 19 && g38.gw === 38;
  return { ok: ok, detail: "from GW" + TIM.gw + ": GW19 window " + g19.weeks + " weeks ending GW" + g19.gw + ", GW38 window " + g38.weeks + " weeks ending GW" + g38.gw };
});
check("TIMING-two-equal-horizons-are-explained-by-saturation-not-left-as-a-coincidence", function () {
  const g19 = TIM.horizons.filter(function (h) { return /GW19/.test(h.label); })[0];
  const g38 = TIM.horizons.filter(function (h) { return /GW38/.test(h.label); })[0];
  const equal = Math.abs(g19.sumDeficit - g38.sumDeficit) < 1e-9;
  const sat = TIM.saturated;
  if (!equal) return { ok: sat && typeof sat.note === "string", detail: "horizons differ (" + r2(g19.sumDeficit) + " vs " + r2(g38.sumDeficit) + "); saturation flag " + (sat ? sat.saturates : "missing") };
  const ok = sat.saturates === true && sat.weeks === TIM.swapsNeeded && sat.gw === TIM.gw + TIM.swapsNeeded - 1 && sat.gw <= g19.gw && /stops growing/.test(sat.note);
  return { ok: ok, detail: "both horizons read " + r2(g19.sumDeficit) + "; saturates at GW" + sat.gw + " after " + sat.weeks + " weekly swaps (" + TIM.swapsNeeded + " needed)" };
});

// ---------------------------------------------------------------- chips (C1 rule 5)

// The synthetic fixture list is one fixture per team per gameweek, so there is no window in it
// at all — that is the honest "nothing scheduled" answer and it is asserted as such. SYN_CHIP
// then gives team 1 and team 2 a second GW5 fixture and takes team 1 and team 3 out of GW6, so
// the detector has one real double and one real blank to find.
const SYN_CHIP = (function () {
  const V = JSON.parse(JSON.stringify(SYN));
  V.fixtures.push({ id: 999, event: 5, team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3,
    finished: false, started: false, kickoff_time: "2026-08-16T14:00:00Z", team_h_score: null, team_a_score: null });
  V.fixtures = V.fixtures.filter(function (f) { return !(f.event === 6 && f.team_h === 1 && f.team_a === 3); });
  return V;
})();
const CTX_CHIP = E.buildCtx(SYN_CHIP, SYN_STATE, SYN_NOW);

check("CHIPS-no-double-and-no-blank-is-reported-as-nothing-scheduled-not-as-a-recommendation", function () {
  const w = E.chipWindows(SYN);
  const ok = w.doubles.length === 0 && w.blanks.length === 0 && w.nextEvent === 4 &&
    w.recommendation.bb === null && w.recommendation.tc === null && w.recommendation.fh === null &&
    /No double or blank/.test(w.recommendation.note);
  return { ok: ok, detail: "doubles " + w.doubles.length + " blanks " + w.blanks.length + " · bb=" + w.recommendation.bb +
    " tc=" + w.recommendation.tc + " fh=" + w.recommendation.fh + " · " + w.recommendation.note };
});
check("CHIPS-a-real-double-and-a-real-blank-are-found-in-the-right-gameweeks", function () {
  const w = E.chipWindows(SYN_CHIP);
  const dbl = w.doubles[0], blk = w.blanks[0];
  const ok = w.doubles.length === 1 && w.blanks.length === 1 &&
    dbl.event === 5 && dbl.teams.slice().sort(function (a, b) { return a - b; }).join(",") === "1,2" && dbl.n === 2 && dbl.confirmed === true &&
    blk.event === 6 && blk.teams.slice().sort(function (a, b) { return a - b; }).join(",") === "1,3" && blk.n === 2 &&
    w.recommendation.bb === 5 && w.recommendation.tc === 5 && w.recommendation.fh === 6;
  return { ok: ok, detail: "double GW" + dbl.event + " teams [" + dbl.teams.join(",") + "], blank GW" + blk.event + " teams [" + blk.teams.join(",") +
    "] → BB GW" + w.recommendation.bb + ", TC GW" + w.recommendation.tc + ", FH GW" + w.recommendation.fh };
});
check("CHIPS-chipRegret-prices-a-double-at-twice-the-single-week-and-says-hold", function () {
  const tcNow = E.chipRegret("TC", CTX);
  const tcLater = E.chipRegret("TC", CTX_CHIP);
  const bbLater = E.chipRegret("BB", CTX_CHIP);
  const ok = tcNow.laterEvent === null && tcNow.verdict === "no window" && tcNow.regretUse === 0 && tcNow.regretHold > 0 &&
    tcLater.laterEvent === 5 && close(tcLater.bestLater, 2 * tcLater.useNow, 1e-9) &&
    close(tcLater.regretUse, tcLater.useNow, 1e-9) && tcLater.regretHold === 0 && tcLater.verdict === "hold" &&
    bbLater.laterEvent === 5 && close(bbLater.bestLater, 2 * bbLater.useNow, 1e-9) && bbLater.verdict === "hold";
  return { ok: ok, detail: "no window: TC verdict " + tcNow.verdict + " (regret of holding " + r2(tcNow.regretHold) + ") · with the GW5 double: TC now " +
    r2(tcLater.useNow) + " vs later " + r2(tcLater.bestLater) + " → " + tcLater.verdict + "; BB now " + r2(bbLater.useNow) + " vs later " + r2(bbLater.bestLater) };
});
check("CHIPS-chipRegret-names-an-unknown-chip-instead-of-scoring-it", function () {
  const junk = E.chipRegret("TRIPLE_WILDCARD", CTX);
  const empty = E.chipRegret("", CTX);
  return { ok: junk.verdict === "no window" && /unknown chip/.test(junk.note) && junk.useNow === 0 && /unknown chip/.test(empty.note),
    detail: "unknown chip → verdict " + junk.verdict + ", note " + junk.note };
});

// ================================================================ strength, rivals, MC, tournament

const TSR = E.teamStrength(SYN);
check("TS-teamStrength-shrinks-att-and-def-towards-1-with-K-6-on-the-snapshot-xG", function () {
  // Independent recomputation of E2 straight from the snapshot: Lbar = Σ xGF / Σ games,
  // att = w·(xGF/g ÷ Lbar) + (1−w), w = g/(g+6).
  const acc = {};
  SYN.teams.forEach(function (t) { acc[t.id] = { g: 0, xgf: 0, xga: 0 }; });
  const fxById = {}; SYN.fixtures.forEach(function (f) { fxById[f.id] = f; });
  Object.keys(SYN.gw).forEach(function (k) {
    const fxg = SYN.gw[k].fixture_xg;
    Object.keys(fxg).forEach(function (fid) {
      const f = fxById[fid], v = fxg[fid];
      acc[f.team_h].g++; acc[f.team_h].xgf += v.h; acc[f.team_h].xga += v.a;
      acc[f.team_a].g++; acc[f.team_a].xgf += v.a; acc[f.team_a].xga += v.h;
    });
  });
  let sx = 0, sg = 0;
  TEAMS.forEach(function (t) { sx += acc[t].xgf; sg += acc[t].g; });
  const Lbar = sx / sg;
  const bad = [];
  TEAMS.forEach(function (t) {
    const w = acc[t].g / (acc[t].g + 6);
    const att = w * ((acc[t].xgf / acc[t].g) / Lbar) + (1 - w);
    const def = w * ((acc[t].xga / acc[t].g) / Lbar) + (1 - w);
    if (!close(TSR.TS[t].att, att, 1e-9) || !close(TSR.TS[t].def, def, 1e-9) || TSR.TS[t].g !== acc[t].g) bad.push("team " + t);
  });
  // xG and goals are two different tables, and they must not be the same numbers (E-011).
  const same = TEAMS.every(function (t) { return close(TSR.TS[t].def, TSR.TS_GOALS[t].def, 1e-9); });
  const bestDef = TEAMS.slice().sort(function (a, b) { return TSR.TS[a].def - TSR.TS[b].def; })[0];
  const bestDefGoals = TEAMS.slice().sort(function (a, b) { return TSR.TS_GOALS[a].def - TSR.TS_GOALS[b].def; })[0];
  return { ok: bad.length === 0 && close(TSR.Lbar, Lbar, 1e-9) && !same,
    detail: bad.length ? "mismatch on " + bad.join(", ") : "Lbar " + r4(TSR.Lbar) + " (K=6, 3 games each); best defence on xG = team " + bestDef +
      ", on goals = team " + bestDefGoals + "; the two tables are not the same numbers" };
});
check("TS-tsXg-is-Lbar-times-att-times-def-times-the-home-or-away-factor", function () {
  const bad = [];
  TEAMS.forEach(function (t) {
    TEAMS.forEach(function (o) {
      if (t === o) return;
      const h = E.tsXg(t, o, true, TSR.TS), a = E.tsXg(t, o, false, TSR.TS);
      const wantH = TSR.Lbar * TSR.TS[t].att * TSR.TS[o].def * 1.10;
      const wantA = TSR.Lbar * TSR.TS[t].att * TSR.TS[o].def * 0.90;
      if (!close(h, wantH, 1e-9) || !close(a, wantA, 1e-9) || !close(h / a, 1.10 / 0.90, 1e-9)) bad.push(t + " v " + o);
    });
  });
  // An unknown team falls back to the neutral 1/1 entry rather than NaN.
  const unknown = E.tsXg(999, 998, true, TSR.TS);
  const ok = bad.length === 0 && isFinite(unknown) && unknown > 0;
  return { ok: ok, detail: bad.length ? "mismatch on " + bad.slice(0, 3).join(", ") :
    "30 ordered pairs reconcile to Lbar·att·def·(1.10 home / 0.90 away); unknown teams fall back to " + r4(unknown) + " not NaN" };
});
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

// E-055: quantile is the helper behind q10/q50/q90, and those three numbers are rendered.
check("MC-quantile-always-returns-a-number-never-a-concatenated-string-E055", function () {
  const objects = []; for (let i = 0; i < 40; i++) objects.push({ a: i });
  const cases = [
    ["a 40-element array of objects with a function for q", E.quantile(objects, function () {})],
    ["an array of non-numeric strings", E.quantile(["a", "b", "c"], 0.5)],
    ["a mixed array", E.quantile([1, null, undefined, 3], 0.5)],
    ["an empty array", E.quantile([], 0.5)],
    ["junk in place of the array", E.quantile("nonsense", 0.5)]
  ];
  const bad = cases.filter(function (c) { return typeof c[1] !== "number" || !isFinite(c[1]); });
  // …and the arithmetic is untouched for real numbers, including numeric strings from the API.
  const good = close(E.quantile([1, 2, 3, 4], 0.5), 2.5, 1e-12) && E.quantile([1, 2, 3, 4], 0) === 1 &&
    E.quantile([1, 2, 3, 4], 1) === 4 && close(E.quantile(["1", "2", "3", "4"], 0.5), 2.5, 1e-12);
  return { ok: bad.length === 0 && good,
    detail: bad.length ? bad.map(function (c) { return c[0] + " → " + JSON.stringify(c[1]); }).join("; ")
      : cases.length + " junk shapes all return a finite number; [1,2,3,4] still gives 1 / 2.5 / 4 at q 0 / 0.5 / 1" };
});
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
// E-046: iters 0 or negative used to come back as one draw dressed as a distribution —
// sd 0 and three identical quantiles under the same field names a converged run uses.
check("MC-squad-never-presents-a-single-draw-as-a-distribution", function () {
  const z = E.mcSquad(SYN_SQUAD, XI_FOR_MC.capId, CTX, 0, 1, XI_FOR_MC.viceId);
  const neg = E.mcSquad(SYN_SQUAD, XI_FOR_MC.capId, CTX, -5, 1, XI_FOR_MC.viceId);
  const flat = function (r) { return r.sd === 0 && r.q10 === r.q50 && r.q50 === r.q90; };
  const ok = z.iters >= 100 && neg.iters >= 100 && !flat(z) && !flat(neg) && z.iters === neg.iters;
  return { ok: ok, detail: "iters 0 → " + z.iters + " draws (sd " + r2(z.sd) + ", q10/q50/q90 " + r2(z.q10) + "/" + r2(z.q50) + "/" + r2(z.q90) + "); iters -5 → " + neg.iters + " draws" };
});
check("MC-simPlayer-may-be-negative-and-that-is-correct", function () {
  // Cards and own goals exist; a suite that forbids a negative is the bug, not the engine.
  // The old assertion was isFinite(min) alone, which passes unchanged against a sampler that
  // clamps at zero — it proved nothing about the name. The claim is that a negative score is
  // REACHABLE, so the check draws until it sees one and says where it came from.
  const rng = E.mulberry32(7);
  let min = Infinity, minId = null, negatives = 0, draws = 0;
  SYN_SQUAD.forEach(function (id) {
    for (let i = 0; i < 3000; i++) {
      const v = E.simPlayer(CTX.els[id], CTX, rng);
      draws++;
      if (v < 0) negatives++;
      if (v < min) { min = v; minId = id; }
    }
  });
  return { ok: isFinite(min) && min < 0 && negatives > 0,
    detail: negatives + " negative scores in " + draws + " draws over the fifteen; lowest " + min + " (element " + minId + ") — a sampler clamped at zero fails this" };
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
check("TOURNAMENT-returns-exactly-the-nine-named-models", function () {
  // Eight at v87; player_xg is the F5 challenger added at v88 and is barred from driving
  // anything by E6 and by the shared promotion gate until it clears three transitions.
  const keys = TOUR.models.map(function (m) { return m.key; });
  const want = ["season_mean", "last_gw", "per90", "shrunk_per90", "ict_rate", "bps_rate", "blend", "component_xp", "player_xg"];
  return { ok: keys.length === 9 && keys.join(",") === want.join(","), detail: "keys: " + keys.join(", ") };
});
check("TOURNAMENT-spearman-values-are-inside-minus-1-and-1", function () {
  const bad = TOUR.models.filter(function (m) { return m.spearman !== null && !(m.spearman >= -1 && m.spearman <= 1); });
  return { ok: bad.length === 0, detail: TOUR.models.map(function (m) { return m.key + "=" + (m.spearman === null ? "n/a" : r4(m.spearman)); }).join(" ") };
});
check("TOURNAMENT-promotion-needs-three-transitions", function () {
  return { ok: TOUR.transitions === 2 && TOUR.promotable === false, detail: TOUR.transitions + " transitions from 3 finished gameweeks; promotable=" + TOUR.promotable + " (gate is 3)" };
});
check("TOURNAMENT-leader-is-one-of-the-nine", function () {
  const keys = TOUR.models.map(function (m) { return m.key; });
  return { ok: TOUR.leader !== null && keys.indexOf(TOUR.leader) >= 0, detail: "leader " + TOUR.leader };
});
// E-047: MAE is only comparable when every predictor is in points units.
check("TOURNAMENT-calibrateToPoints-puts-a-ten-times-predictor-back-into-points", function () {
  const actual = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const pred = actual.map(function (v) { return v * 10; });
  const c = E.calibrateToPoints(pred, actual);
  const rawMae = E.mae(pred, actual), calMae = E.mae(c.pred, actual);
  return { ok: c.calibrated === true && close(c.scale, 0.1, 1e-9) && close(calMae, 0, 1e-9) && rawMae > 40,
    detail: "scale " + r4(c.scale) + " · MAE raw " + r2(rawMae) + " → calibrated " + r2(calMae) };
});
check("TOURNAMENT-calibrateToPoints-refuses-to-scale-a-zero-mean-predictor", function () {
  const c = E.calibrateToPoints([0, 0, 0, 0], [1, 2, 3, 4]);
  const d = E.calibrateToPoints([-1, -2, -3], [1, 2, 3]);
  return { ok: c.calibrated === false && c.scale === 1 && d.calibrated === false && d.scale === 1,
    detail: "zero mean → calibrated " + c.calibrated + " scale " + c.scale + "; negative mean → calibrated " + d.calibrated + " scale " + d.scale };
});
check("TOURNAMENT-the-reported-MAEs-are-inside-one-order-of-magnitude-of-each-other", function () {
  const m = TOUR.models.filter(function (x) { return x.mae !== null; });
  if (m.length < 2) return { ok: false, detail: "only " + m.length + " scored models" };
  const vals = m.map(function (x) { return x.mae; });
  const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  return { ok: lo > 0 && hi <= 10 * lo, detail: "MAE spread " + r2(lo) + " to " + r2(hi) + " (ratio " + r2(hi / lo) + ", gate 10) · units " + TOUR.maeUnits };
});
check("TOURNAMENT-spearman-of-a-perfect-ranking-is-1", function () {
  return { ok: close(E.spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), 1, 1e-9) && close(E.spearman([1, 2, 3, 4, 5], [50, 40, 30, 20, 10]), -1, 1e-9), detail: "perfect " + E.spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]) + ", inverted " + E.spearman([1, 2, 3, 4, 5], [50, 40, 30, 20, 10]) };
});

// ================================================================ F4 — calibration and the minutes model

check("F4-logistic-is-total-and-always-inside-0-1", function () {
  const junk = [NaN, Infinity, -Infinity, "x", {}, [], null, undefined, "12", 1e308, -1e308, 0, 40.1, -40.1, true];
  const bad = [];
  junk.forEach(function (v) {
    const p = E.logistic(v);
    if (typeof p !== "number" || !isFinite(p) || p < 0 || p > 1) bad.push(JSON.stringify(v) + " → " + p);
  });
  if (E.logistic(NaN) !== 0.5) bad.push("NaN did not answer 0.5");
  if (E.logistic(0) !== 0.5) bad.push("logistic(0) was not 0.5");
  if (E.logistic(Infinity) !== 1 || E.logistic(-Infinity) !== 0) bad.push("the infinities did not saturate");
  if (!close(E.logistic(2), 1 / (1 + Math.exp(-2)), 1e-12)) bad.push("logistic(2) is not the sigmoid");
  return { ok: !bad.length, detail: bad.join("; ") || junk.length + " junk inputs, every answer inside [0,1]; NaN → 0.5" };
});

check("F4-solveLinear-solves-a-known-system-and-answers-null-on-a-singular-one", function () {
  const x = E.solveLinear([[2, 1], [1, 3]], [5, 10]);
  const sing = E.solveLinear([[1, 2], [2, 4]], [3, 6]);
  const junk = E.solveLinear([[1, NaN], [2, 4]], [3, 6]);
  const ok = Array.isArray(x) && close(x[0], 1, 1e-9) && close(x[1], 3, 1e-9) && sing === null && junk === null;
  return { ok: ok, detail: "2x+y=5, x+3y=10 → " + JSON.stringify(x ? x.map(r4) : x) + "; singular → " + sing + "; NaN entry → " + junk };
});

// Generate from a KNOWN logistic, then check the fit finds it back and beats the base rate.
const FIT_DATA = (function () {
  const rng = E.mulberry32(20260912);
  const X = [], y = [];
  for (let i = 0; i < 600; i++) {
    const x1 = i / 599;                                  // deterministic sweep of the feature
    const p = 1 / (1 + Math.exp(-(-4 + 8 * x1)));
    X.push([1, x1]); y.push(rng() < p ? 1 : 0);
  }
  return { X: X, y: y };
})();

check("F4-fitLogistic-recovers-the-coefficients-it-was-generated-from", function () {
  const f = E.fitLogistic(FIT_DATA.X, FIT_DATA.y, {});
  if (!f.ok) return { ok: false, detail: "the fit did not converge: " + f.note };
  const b0 = f.beta[0], b1 = f.beta[1];
  const ok = f.converged && Math.abs(b0 + 4) < 1.2 && Math.abs(b1 - 8) < 2.0 && f.n === 600 && f.k === 2;
  return { ok: ok, detail: "generated from intercept −4 and slope 8; fitted " + r2(b0) + " and " + r2(b1) +
    " on " + f.n + " rows in " + f.iters + " Newton steps (" + f.note + ")" };
});

check("F4-the-fitted-model-beats-the-base-rate-on-Brier", function () {
  const f = E.fitLogistic(FIT_DATA.X, FIT_DATA.y, {});
  const pred = FIT_DATA.X.map(function (x) { return E.logistic(f.beta[0] * x[0] + f.beta[1] * x[1]); });
  const b = E.brier(pred, FIT_DATA.y);
  const flat = E.brier(FIT_DATA.y.map(function () { return b.baseRate; }), FIT_DATA.y);
  return { ok: f.ok && b.ok && b.brier < flat.brier && b.skill > 0.3 && b.brier >= 0 && b.brier <= 1,
    detail: "fitted Brier " + r4(b.brier) + " against the base rate's " + r4(flat.brier) + " (base " + r4(b.baseRate) + ", skill " + r4(b.skill) + ")" };
});

check("F4-fitLogistic-never-returns-a-coefficient-that-is-not-finite", function () {
  const cases = [
    { X: [[1, NaN], [1, 2], [1, 3], [1, 4], [1, 5]], y: [1, 0, 1, 0, 1] },
    { X: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]], y: [1, 1, 1, 1, 1] },      // perfectly separated constant
    { X: [[1, 1e308], [1, -1e308], [1, 0], [1, 1], [1, 2]], y: [1, 0, 1, 0, 1] },
    { X: "not a matrix", y: 7 },
    { X: [], y: [] },
    { X: [[1, 0], [1, 1]], y: [1, 0] }                                          // fewer rows than the fit needs
  ];
  const bad = [];
  cases.forEach(function (c, i) {
    const f = E.fitLogistic(c.X, c.y, {});
    if (!Array.isArray(f.beta)) { bad.push("case " + i + ": beta is not an array"); return; }
    f.beta.forEach(function (b, j) { if (!isFinite(b)) bad.push("case " + i + " coefficient " + j + " = " + b); });
    if (typeof f.note !== "string" || !f.note.length) bad.push("case " + i + ": no note");
  });
  return { ok: !bad.length, detail: bad.join("; ") || cases.length + " degenerate fits, every coefficient finite and every one carrying a reason" };
});

check("F4-brier-scores-a-perfect-a-worst-and-a-base-rate-forecast-exactly", function () {
  const y = [1, 0, 1, 0, 1, 1, 0, 0];
  const perfect = E.brier(y, y);
  const worst = E.brier(y.map(function (v) { return 1 - v; }), y);
  const flat = E.brier(y.map(function () { return 0.5; }), y);
  const junk = E.brier("nonsense", {});
  const ok = perfect.brier === 0 && worst.brier === 1 && close(flat.brier, 0.25, 1e-12) &&
    close(flat.baseRate, 0.5, 1e-12) && close(flat.baseBrier, 0.25, 1e-12) && close(flat.skill, 0, 1e-12) &&
    junk.ok === false && junk.brier === 0;
  return { ok: ok, detail: "perfect " + perfect.brier + ", inverted " + worst.brier + ", base-rate forecast " + r4(flat.brier) +
    " with skill " + r4(flat.skill) + "; junk answers ok=false" };
});

check("F4-reliability-bins-account-for-every-row-and-a-calibrated-forecast-has-a-small-gap", function () {
  const rng = E.mulberry32(4242);
  const p = [], y = [];
  for (let i = 0; i < 2000; i++) { const q = (i % 100) / 100 + 0.005; p.push(q); y.push(rng() < q ? 1 : 0); }
  const rel = E.reliability(p, y, 5);
  const counted = rel.bins.reduce(function (s, b) { return s + b.n; }, 0);
  const ordered = rel.bins.every(function (b, i) { return b.lo === i / 5 && b.hi === (i + 1) / 5; });
  const inRange = rel.bins.every(function (b) { return b.meanPred >= 0 && b.meanPred <= 1 && b.meanOutcome >= 0 && b.meanOutcome <= 1; });
  return { ok: rel.ok && counted === 2000 && rel.n === 2000 && ordered && inRange && rel.maxGap < 0.12 && rel.nBins === 5,
    detail: counted + " of 2000 rows binned into " + rel.nBins + " bins; largest gap between forecast and outcome " + r4(rel.maxGap) };
});

check("F4-minutesFeatureVector-is-bounded-on-any-history-and-starts-with-the-intercept", function () {
  // The null-row cases are E-074: `last3[last3.length - 1].min` threw on a history whose last
  // entry was null. mc_full found it at the 25000 release count and not at 3000.
  const cases = [[], null, "junk", [{ gw: 1, games: 1, min: 90, starts: 1 }],
    [{ gw: 1, games: NaN, min: Infinity, starts: "x" }, { gw: 2, games: 1, min: 90, starts: 1 }],
    [{ gw: 1, games: 1, min: 0, starts: 0 }, { gw: 2, games: 1, min: 0, starts: 0 }, { gw: 3, games: 1, min: 0, starts: 0 }],
    [null], [null, null], [null, Infinity, { gw: 1, games: 1, min: 90, starts: 1 }],
    [{ gw: 1, games: 1, min: 90, starts: 1 }, null], [undefined, null, 3], ["x", { gw: 2, games: 1, min: 45, starts: 0 }]];
  const bad = [];
  cases.forEach(function (h, i) {
    const x = E.minutesFeatureVector(h, 4, { 1: 0, 2: 86400000, 3: 172800000, 4: 259200000 });
    if (x.length !== E.MINUTES_FEATURES.length) bad.push("case " + i + ": " + x.length + " terms, not " + E.MINUTES_FEATURES.length);
    if (x[0] !== 1) bad.push("case " + i + ": the intercept is " + x[0]);
    x.forEach(function (v, j) { if (!isFinite(v) || v < -1 || v > 1) bad.push("case " + i + " term " + j + " = " + v); });
  });
  return { ok: !bad.length, detail: bad.join("; ") || cases.length + " histories including junk; every term finite and inside [−1,1]" };
});

check("F4-the-feature-matrix-uses-no-data-from-the-gameweek-it-predicts", function () {
  const V = JSON.parse(JSON.stringify(SYN));
  Object.keys(V.gw["3"].elements).forEach(function (id) {
    const r = V.gw["3"].elements[id];
    r[0] = 0; r[1] = 0; r[2] = 0;                                  // wipe GW3 minutes, starts and points
  });
  const base = E.minutesRowsFor(SYN, 3, null);
  const wiped = E.minutesRowsFor(V, 3, null);
  const sameX = JSON.stringify(base.X) === JSON.stringify(wiped.X);
  const yChanged = JSON.stringify(base.y) !== JSON.stringify(wiped.y);
  return { ok: base.n > 0 && sameX && yChanged && base.ids.join(",") === wiped.ids.join(","),
    detail: base.n + " rows; wiping GW3 leaves the feature matrix byte-identical (" + sameX + ") and changes only the outcome column (" + yChanged + ")" };
});

check("F4-a-club-with-no-fixture-gets-no-row-because-a-blank-is-not-a-non-start", function () {
  const V = JSON.parse(JSON.stringify(SYN));
  V.fixtures = V.fixtures.filter(function (f) { return !(f.event === 3 && f.team_h === 4 && f.team_a === 6); });
  Object.keys(V.gw["3"].elements).forEach(function (id) {
    const el = V.elements.filter(function (e) { return e.id === Number(id); })[0];
    if (el && (el.team === 4 || el.team === 6)) delete V.gw["3"].elements[id];
  });
  const rows = E.minutesRowsFor(V, 3, null);
  const teamOf = {}; V.elements.forEach(function (e) { teamOf[e.id] = e.team; });
  const blanked = rows.ids.filter(function (id) { return teamOf[id] === 4 || teamOf[id] === 6; });
  const full = E.minutesRowsFor(SYN, 3, null);
  return { ok: blanked.length === 0 && rows.n > 0 && rows.n < full.n,
    detail: rows.n + " rows with teams 4 and 6 blank in GW3, against " + full.n + " on the full fixture list; rows for the blanked clubs: " + blanked.length };
});

const SYN_MWF = E.minutesWalkForward(SYN, { bins: 5 });

check("F4-the-walk-forward-scores-both-models-and-can-only-fit-where-history-exists", function () {
  const f0 = SYN_MWF.folds[0], f1 = SYN_MWF.folds[1];
  const ok = SYN_MWF.folds.length === 2 && f0.fitted === false && f1.fitted === true &&
    f0.challenger === null && f1.challenger !== null &&
    f0.incumbent.brier >= 0 && f0.incumbent.brier <= 1 && f1.challenger.brier >= 0 && f1.challenger.brier <= 1 &&
    SYN_MWF.comparable === 1 && /no gameweek up to GW1/.test(f0.note);
  return { ok: ok, detail: "GW1→GW2 incumbent " + r4(f0.incumbent.brier) + ", challenger " + (f0.challenger ? r4(f0.challenger.brier) : "not fitted") +
    "; GW2→GW3 incumbent " + r4(f1.incumbent.brier) + ", challenger " + r4(f1.challenger.brier) + " → " + f1.winner };
});

check("F4-the-walk-forward-never-fits-on-the-gameweek-it-scores", function () {
  const bad = [];
  SYN_MWF.folds.forEach(function (f) {
    if (!f.fitted) return;
    if (f.fitGws.indexOf(f.to) >= 0) bad.push("the fit for GW" + f.to + " included GW" + f.to);
    f.fitGws.forEach(function (g) { if (g > f.from) bad.push("the fit for GW" + f.to + " included GW" + g + ", past the cut at GW" + f.from); });
  });
  return { ok: !bad.length, detail: bad.join("; ") || SYN_MWF.folds.map(function (f) { return "GW" + f.to + " fitted on [" + f.fitGws.join(",") + "]"; }).join("; ") };
});

check("F4-truncateLive-hides-every-later-gameweek-and-puts-later-fixtures-back-to-unplayed", function () {
  const t = E.truncateLive(SYN, 2);
  const keys = Object.keys(t.gw).map(Number).sort(function (a, b) { return a - b; });
  const laterPlayed = t.fixtures.filter(function (f) { return f.event > 2 && (f.finished || f.started || f.team_h_score !== null); });
  const earlyIntact = t.fixtures.filter(function (f) { return f.event <= 2 && f.finished; }).length;
  const original = SYN.fixtures.filter(function (f) { return f.event === 3 && f.finished; }).length;
  return { ok: keys.join(",") === "1,2" && laterPlayed.length === 0 && earlyIntact === 6 && original === 3 &&
      t.current_event === 2 && t.next_event === 3 && SYN.gw["3"] !== undefined,
    detail: "gameweeks kept [" + keys.join(",") + "], " + laterPlayed.length + " later fixtures still marked played, " +
      earlyIntact + " earlier fixtures intact; the original snapshot still carries GW3 (" + (SYN.gw["3"] !== undefined) + ")" };
});

check("F4-minutesModel-declares-the-flag-and-the-European-load-as-terms-it-did-not-fit", function () {
  const m = E.minutesModel(CTX.els[16], CTX, {});
  const flag = m.terms.filter(function (t) { return t.name === "flag"; })[0];
  const euro = m.terms.filter(function (t) { return t.name === "european_load"; })[0];
  const fitted = m.terms.filter(function (t) { return t.fitted; });
  const ok = !!flag && flag.fitted === false && /not a status per gameweek/.test(flag.why) &&
    !!euro && euro.fitted === false && euro.available === false && /Premier League/.test(euro.why) &&
    fitted.length === E.MINUTES_FEATURES.length;
  return { ok: ok, detail: fitted.length + " fitted terms (" + E.MINUTES_FEATURES.join(", ") + "); flag and European load both declared and both not fitted" };
});

check("F4-minutesModel-drives-nothing-and-says-the-Laplace-rate-is-the-driver", function () {
  const bad = [];
  [16, 22, 34, 3].forEach(function (id) {
    const m = E.minutesModel(CTX.els[id], CTX, {});
    if (m.driving !== false) bad.push(id + " claims to be driving");
    if (m.driver !== "pStart") bad.push(id + " names the driver as " + m.driver);
    if (!(m.p >= 0 && m.p <= 1) || !(m.pModel >= 0 && m.pModel <= 1)) bad.push(id + " p=" + m.p + " pModel=" + m.pModel);
    if (!close(m.pIncumbent, E.pStart(CTX.els[id], CTX.gwStats), 1e-12)) bad.push(id + " does not report the shipped pStart");
  });
  const flagged = E.minutesModel(CTX.els[22], CTX, {});
  if (!close(flagged.flagFactor, 0.75, 1e-12)) bad.push("the 75% doubt did not become a 0.75 factor");
  if (!close(flagged.p, flagged.pModel * 0.75, 1e-12)) bad.push("the flag was not applied multiplicatively");
  return { ok: !bad.length, detail: bad.join("; ") || "four players: driving=false, driver=pStart, the 75% doubt multiplies the fitted probability by 0.75" };
});

check("GATE-the-promotion-gate-cannot-open-below-three-transitions", function () {
  const bad = [];
  for (let t = 0; t <= 2; t++) {
    const g = E.promotionGate({ transitions: t, wins: 99, holdout: 99, challenger: "x" });
    if (g.promotable) bad.push(t + " transitions opened the gate");
    if (g.wins > t || g.holdout > t) bad.push(t + " transitions reported " + g.wins + " wins and a " + g.holdout + " hold-out");
    if (!g.reasons.length) bad.push(t + " transitions gave no reason");
  }
  const open = E.promotionGate({ transitions: 3, wins: 3, holdout: 2 });
  return { ok: !bad.length && open.promotable === true,
    detail: bad.join("; ") || "0, 1 and 2 transitions all stay shut even with the wins and the hold-out maxed; 3 wins over 3 with a 2-week hold-out opens it" };
});

check("GATE-three-wins-alone-are-not-enough-without-the-two-week-holdout", function () {
  const noHold = E.promotionGate({ transitions: 4, wins: 3, holdout: 1 });
  const noWins = E.promotionGate({ transitions: 4, wins: 2, holdout: 2 });
  const both = E.promotionGate({ transitions: 4, wins: 3, holdout: 2 });
  return { ok: noHold.promotable === false && noHold.holdoutOk === false && noHold.winsOk === true &&
      noWins.promotable === false && noWins.winsOk === false && both.promotable === true &&
      E.PROMOTION_HOLDOUT_WEEKS === 2,
    detail: "3 wins with a 1-week hold-out: " + noHold.promotable + "; 2 wins with a 2-week hold-out: " + noWins.promotable +
      "; 3 wins with a 2-week hold-out: " + both.promotable };
});

check("GATE-the-tournament-and-the-minutes-walk-forward-go-through-the-same-gate", function () {
  const tourGate = TOUR.models.filter(function (m) { return m.gate; })[0];
  const mwfGate = SYN_MWF.gate;
  const ok = !!tourGate && !!mwfGate && tourGate.gate.need === mwfGate.need && tourGate.gate.needHoldout === mwfGate.needHoldout &&
    mwfGate.need === 3 && mwfGate.needHoldout === 2 && TOUR.models.every(function (m) { return m.promotable === false; });
  return { ok: ok, detail: "both gates want " + mwfGate.need + " transitions and a " + mwfGate.needHoldout +
    "-gameweek hold-out; no tournament model is promotable at " + TOUR.transitions + " transitions" };
});

// ================================================================ F5 — player xG

check("F5-playerXg-is-xG90-times-att-times-def-folded-into-the-E1-shape", function () {
  const el = CTX.els[16];
  const rates = E.playerRates(el, CTX);
  const fx = CTX.fixturesByEvent[4].filter(function (f) { return f.team_h === el.team || f.team_a === el.team; });
  if (fx.length !== 1) return { ok: false, detail: "expected exactly one GW4 fixture for team " + el.team + ", found " + fx.length };
  const f = fx[0], home = f.team_h === el.team, opp = home ? f.team_a : f.team_h;
  const a = E.tsEntry(CTX.TS, el.team), d = E.tsEntry(CTX.TS, opp);
  const mult = a.att * d.def * (home ? 1.10 : 0.90);
  const gs = CTX.gwStats[16];
  const minsAvg = gs.minutes / gs.played, frac = minsAvg / 90;
  const lam = rates.xg90 * mult * frac, lamA = rates.xa90 * mult * frac;
  const lamOpp = E.tsXg(opp, el.team, !home, CTX.TS);
  const S = E.SCORING[3];
  const want = (minsAvg >= 60 ? S.play_long : S.play_short) + lam * S.goal + lamA * S.assist +
    (minsAvg >= 60 ? Math.exp(-lamOpp) : 0) * S.cs + (S.gc_per2 ? (lamOpp * frac) / 2 * S.gc_per2 : 0) +
    gs.dcRate * S.dc + gs.bonusRate;
  const px = E.playerXg(el, CTX, {});
  const p = E.pStart(el, CTX.gwStats);
  const ok = close(px.mult, mult, 1e-12) && close(px.lambda, lam, 1e-12) && close(px.xpPerFixture, want, 1e-9) &&
    close(px.xp, want * p, 1e-9) && px.driving === false && px.fixtures === 1 && close(px.att, a.att, 1e-12) && close(px.def, d.def, 1e-12);
  return { ok: ok, detail: "xG90 " + r4(rates.xg90) + " x att " + r4(a.att) + " x def " + r4(d.def) + " x home 1.10 → λ " + r4(px.lambda) +
    "; recomputed by hand " + r4(want) + " against the engine's " + r4(px.xpPerFixture) + " per fixture, " + r4(px.xp) + " after P(start) " + r4(p) };
});

check("F5-playerXg-answers-zero-on-a-blank-and-names-it", function () {
  const V = JSON.parse(JSON.stringify(SYN));
  V.fixtures = V.fixtures.filter(function (f) { return !(f.event === 4 && f.team_h === 1 && f.team_a === 4); });
  const c = E.buildCtx(V, SYN_STATE, SYN_NOW);
  const px = E.playerXg(c.els[4], c, {});
  const still = E.playerXg(c.els[16], c, {});
  return { ok: px.xp === 0 && px.fixtures === 0 && /blank is worth nothing/.test(px.note) && still.xp > 0,
    detail: "team 1 blank in GW4 → xp " + px.xp + " (" + px.note + "); a club that still plays scores " + r4(still.xp) };
});

check("F5-player-xg-is-the-ninth-model-and-is-scored-like-the-other-eight", function () {
  const m = TOUR.models.filter(function (x) { return x.key === "player_xg"; })[0];
  const scored = TOUR.models.filter(function (x) { return x.spearman !== null; });
  const ok = !!m && m.name === "Player xG" && m.transitions === TOUR.transitions && m.spearman !== null &&
    m.spearman >= -1 && m.spearman <= 1 && m.mae !== null && m.mae > 0 &&
    Array.isArray(m.perTransition) && m.perTransition.length === TOUR.transitions && scored.length === 9;
  return { ok: ok, detail: m ? "player_xg ρ " + r4(m.spearman) + " over " + m.transitions + " transitions, MAE " + r2(m.mae) +
    " points, per transition [" + m.perTransition.map(r4).join(", ") + "]" : "player_xg is missing from the tournament" };
});

check("F5-player-xg-cannot-drive-anything-even-when-it-leads-every-transition", function () {
  const m = TOUR.models.filter(function (x) { return x.key === "player_xg"; })[0];
  const bad = [];
  if (!m) return { ok: false, detail: "player_xg is missing" };
  if (m.promotable !== false) bad.push("player_xg says it is promotable at " + m.transitions + " transitions");
  if (!m.gate || m.gate.transitionsOk !== false) bad.push("the gate does not report the transition count as the blocker");
  TOUR.models.forEach(function (x) { if (x.promotable) bad.push(x.key + " claims to be promotable"); });
  return { ok: !bad.length, detail: bad.join("; ") || "player_xg led " + m.wins + " of " + TOUR.transitions +
    " transitions with a " + m.holdout + "-gameweek trailing run and is still not promotable: " + m.gate.reasons.join("; ") };
});

check("F5-the-tournament-reads-no-team-strength-from-the-gameweek-it-is-predicting", function () {
  const V = JSON.parse(JSON.stringify(SYN));
  Object.keys(V.gw["3"].fixture_xg).forEach(function (fid) {
    V.gw["3"].fixture_xg[fid] = { h: 9.5, a: 0.01 };                  // an absurd GW3 xG record
  });
  const t2 = E.tournament(V);
  const a = TOUR.models.filter(function (m) { return m.key === "player_xg"; })[0];
  const b = t2.models.filter(function (m) { return m.key === "player_xg"; })[0];
  const same = JSON.stringify(a.perTransition.map(r4)) === JSON.stringify(b.perTransition.map(r4));
  return { ok: same && a.perTransition.length === 2,
    detail: "GW3 team xG rewritten to 9.5 against 0.01; the player-xG per-transition ρ is [" + a.perTransition.map(r4).join(", ") +
      "] before and [" + b.perTransition.map(r4).join(", ") + "] after" };
});

check("F5-per-transition-Spearman-averages-back-to-the-published-mean", function () {
  const bad = [];
  TOUR.models.forEach(function (m) {
    if (m.spearman === null) return;
    const mean = m.perTransition.reduce(function (s, v) { return s + v; }, 0) / m.perTransition.length;
    if (!close(mean, m.spearman, 1e-12)) bad.push(m.key + ": mean of " + JSON.stringify(m.perTransition.map(r4)) + " is " + r4(mean) + ", published " + r4(m.spearman));
  });
  return { ok: !bad.length, detail: bad.join("; ") || "all nine models: the per-transition figures average exactly to the published ρ" };
});

// ================================================================ F8 — the chip solver on the real calendar

const SYN_SOLVE = E.chipSolver(CTX, {});
const SYN_SOLVE_CHIP = E.chipSolver(CTX_CHIP, {});

function solverShapeErrors(s, nextEvent) {
  const bad = [];
  const seenChip = {}, seenEvent = {};
  const bounds = {}; s.sets.forEach(function (S) { bounds[S.set] = S; });
  s.plan.forEach(function (a) {
    const key = a.set + ":" + a.chip;
    if (seenChip[key]) bad.push(a.chip + " assigned twice in set " + a.set);
    seenChip[key] = true;
    if (seenEvent[a.event]) bad.push("two chips in GW" + a.event);
    seenEvent[a.event] = true;
    const B = bounds[a.set];
    if (!B) { bad.push("assignment in an unknown set " + a.set); return; }
    if (a.event < B.from || a.event > B.to) bad.push(a.chip + " in GW" + a.event + " is outside set " + a.set + " (GW" + B.from + "–GW" + B.to + ")");
    if (a.event < nextEvent) bad.push(a.chip + " assigned to GW" + a.event + ", already past");
    if (!isFinite(a.value) || a.value < 0) bad.push(a.chip + " priced at " + a.value);
  });
  return bad;
}

check("F8-with-no-double-and-no-blank-the-solver-says-no-window-is-confirmed", function () {
  const s = SYN_SOLVE;
  const nonWc = s.plan.filter(function (a) { return a.chip !== "WC"; });
  const ok = s.ok && s.confirmed === false && s.doubles.length === 0 && s.blanks.length === 0 &&
    /No window is confirmed yet/.test(s.windowNote) && nonWc.length === 0 &&
    s.reasons.some(function (r) { return /BB has no window/.test(r); });
  return { ok: ok, detail: "confirmed " + s.confirmed + "; plan " + s.plan.map(function (a) { return a.chip + " GW" + a.event; }).join(", ") +
    "; " + s.windowNote };
});

check("F8-a-real-double-and-a-real-blank-are-found-and-every-chip-is-priced-in-them", function () {
  const s = SYN_SOLVE_CHIP;
  const bb = s.candidates.filter(function (c) { return c.chip === "BB" && c.event === 5; })[0];
  const tc = s.candidates.filter(function (c) { return c.chip === "TC" && c.event === 5; })[0];
  const fh = s.candidates.filter(function (c) { return c.chip === "FH" && c.event === 6; })[0];
  const ok = s.ok && s.confirmed === true && s.doubles.length === 1 && s.doubles[0].event === 5 &&
    s.blanks.length === 1 && s.blanks[0].event === 6 && !!bb && !!tc && !!fh &&
    bb.value >= 0 && tc.value > 0 && fh.value >= 0;
  return { ok: ok, detail: "double GW5, blank GW6 → BB " + (bb ? r2(bb.value) : "—") + ", TC " + (tc ? r2(tc.value) : "—") +
    ", FH " + (fh ? r2(fh.value) : "—") + " points; " + s.windowNote };
});

check("F8-the-solver-never-uses-a-chip-twice-nor-two-chips-in-one-gameweek", function () {
  const bad = solverShapeErrors(SYN_SOLVE, CTX.nextEvent).concat(solverShapeErrors(SYN_SOLVE_CHIP, CTX_CHIP.nextEvent));
  const s = SYN_SOLVE_CHIP;
  const atFive = s.plan.filter(function (a) { return a.event === 5; });
  const wanted = s.candidates.filter(function (a) { return a.event === 5; });
  if (wanted.length < 2) bad.push("the fixture did not create two chips competing for GW5");
  if (atFive.length > 1) bad.push("both chips were assigned to GW5");
  return { ok: !bad.length, detail: bad.join("; ") || wanted.length + " chips want GW5 and exactly " + atFive.length +
    " is assigned there; plan " + s.plan.map(function (a) { return a.chip + " set " + a.set + " GW" + a.event; }).join(", ") };
});

check("F8-a-chip-already-used-in-a-set-is-never-offered-again-in-that-set", function () {
  const V = JSON.parse(JSON.stringify(SYN_CHIP));
  V.history.chips = [{ name: "bboost", event: 2 }, { name: "wildcard", event: 3 }];
  const c = E.buildCtx(V, SYN_STATE, SYN_NOW);
  const s = E.chipSolver(c, {});
  const bb = s.candidates.filter(function (x) { return x.chip === "BB" && x.set === 1; });
  const wc = s.candidates.filter(function (x) { return x.chip === "WC" && x.set === 1; });
  const tc = s.candidates.filter(function (x) { return x.chip === "TC" && x.set === 1; });
  return { ok: bb.length === 0 && wc.length === 0 && tc.length === 1 && s.used.length === 2 &&
      s.used.filter(function (u) { return u.chip === "BB" && u.set === 1; }).length === 1,
    detail: "Bench Boost and Wildcard already played in set one → " + bb.length + " BB and " + wc.length +
      " WC candidates left, Triple Captain still offered (" + tc.length + ")" };
});

// A calendar that runs to GW21 with a double in GW20, so the set-two expiry is a real test and
// not an assertion about a window that cannot exist.
const SYN_LATE = (function () {
  const V = JSON.parse(JSON.stringify(SYN));
  let fid = 5000;
  for (let g = 9; g <= 21; g++) {
    V.events.push({ id: g, name: "Gameweek " + g, deadline_time: "2026-12-" + String(g).padStart(2, "0") + "T12:30:00Z", is_current: false, is_next: false, finished: false, average_entry_score: 50 });
    [[1, 2], [3, 4], [5, 6]].forEach(function (p) {
      V.fixtures.push({ id: ++fid, event: g, team_h: p[0], team_a: p[1], team_h_difficulty: 3, team_a_difficulty: 3, finished: false, started: false, kickoff_time: "2026-12-" + String(g).padStart(2, "0") + "T14:00:00Z", team_h_score: null, team_a_score: null });
    });
  }
  V.fixtures.push({ id: ++fid, event: 20, team_h: 2, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, finished: false, started: false, kickoff_time: "2026-12-20T16:00:00Z", team_h_score: null, team_a_score: null });
  return V;
})();

check("F8-a-double-inside-set-two-is-only-ever-assigned-to-a-set-two-chip", function () {
  const c = E.buildCtx(SYN_LATE, SYN_STATE, SYN_NOW);
  const s = E.chipSolver(c, {});
  const bad = solverShapeErrors(s, c.nextEvent);
  const dbl = s.doubles.filter(function (d) { return d.event === 20; })[0];
  if (!dbl) bad.push("the GW20 double was not detected");
  s.candidates.forEach(function (x) {
    if (x.event === 20 && x.set !== 2) bad.push(x.chip + " offered in GW20 as a set-" + x.set + " chip");
    if (x.set === 1 && x.event > 19) bad.push("set one offered a chip in GW" + x.event);
  });
  const late = s.plan.filter(function (a) { return a.event === 20; });
  if (!late.length) bad.push("nothing was assigned to the only confirmed double");
  late.forEach(function (a) { if (a.set !== 2) bad.push(a.chip + " assigned to GW20 from set " + a.set); });
  return { ok: !bad.length, detail: bad.join("; ") || "GW20 double over " + (dbl ? dbl.n : 0) + " clubs; " +
    late.map(function (a) { return a.chip + " from set " + a.set; }).join(", ") + " assigned there, and set one is confined to GW19 and earlier" };
});

check("F8-eventMult-counts-both-fixtures-of-a-double-and-nothing-on-a-blank", function () {
  const single = E.eventMult(1, CTX_CHIP, 4);
  const dbl = E.eventMult(1, CTX_CHIP, 5);
  const blank = E.eventMult(1, CTX_CHIP, 6);
  const parts = CTX_CHIP.fixturesByEvent[5].filter(function (f) { return f.team_h === 1 || f.team_a === 1; })
    .map(function (f) { return E.fxMult(f, 1, CTX_CHIP.TS); });
  const ok = parts.length === 2 && close(dbl, parts[0] + parts[1], 1e-12) && blank === 0 && single > 0 && dbl > single;
  return { ok: ok, detail: "team 1: GW4 single " + r4(single) + ", GW5 double " + r4(dbl) + " (= " + parts.map(r4).join(" + ") + "), GW6 blank " + blank };
});

check("F8-bench-boost-is-the-bench-and-triple-captain-is-the-best-single-fixture", function () {
  const bb = E.chipValue("BB", 5, CTX_CHIP, {});
  const tc = E.chipValue("TC", 5, CTX_CHIP, {});
  const xi = E.pickXI(CTX_CHIP.squadIds, CTX_CHIP, function (el) { return E.xpEvent(el, CTX_CHIP, 5); });
  const benchWant = xi.bench.reduce(function (s, id) { return s + E.xpEvent(CTX_CHIP.els[id], CTX_CHIP, 5); }, 0);
  let capWant = 0;
  xi.ids.forEach(function (id) {
    const el = CTX_CHIP.els[id];
    if (el.element_type < 3 || E.isFlagged(el)) return;
    const v = E.xpEvent(el, CTX_CHIP, 5);
    if (v > capWant) capWant = v;
  });
  return { ok: bb.ok && tc.ok && close(bb.value, benchWant, 1e-9) && close(tc.value, capWant, 1e-9) && xi.bench.length === 4,
    detail: "bench of " + xi.bench.length + " worth " + r2(bb.value) + " against " + r2(benchWant) +
      " recomputed; best unflagged attacker " + r2(tc.value) + " against " + r2(capWant) };
});

check("F8-free-hit-is-the-best-available-eleven-minus-your-own-and-is-labelled-an-upper-bound", function () {
  const fh = E.chipValue("FH", 6, CTX_CHIP, {});
  const mine = E.pickXI(CTX_CHIP.squadIds, CTX_CHIP, function (el) { return E.xpEvent(el, CTX_CHIP, 6); });
  const free = E.bestElevenForEvent(CTX_CHIP, 6, null);
  const blanked = free.ids.filter(function (id) { return E.eventMult(CTX_CHIP.els[id].team, CTX_CHIP, 6) === 0; });
  const legal = E.legalXI(free.ids, CTX_CHIP.els);
  return { ok: fh.ok && free.ok && legal.ok && close(fh.value, Math.max(0, free.score - mine.score), 1e-9) && blanked.length === 0 &&
      /upper bound/.test(fh.detail) && /budget/.test(free.note) && /three-per-club/.test(free.note),
    detail: "best available eleven in the GW6 blank " + r2(free.score) + " (" + free.formation + ", legal " + legal.ok +
      ") against your own " + r2(mine.score) + " → " + r2(fh.value) + "; nobody in it is blank; " + fh.detail };
});

check("F8-the-joint-solve-is-never-worse-than-taking-the-chips-one-at-a-time", function () {
  const s = SYN_SOLVE_CHIP;
  // The greedy answer takes the best candidate, then the best that still fits, and so on.
  const greedy = [], gChip = {}, gEvent = {};
  s.candidates.forEach(function (c) {
    const k = c.set + ":" + c.chip;
    if (gChip[k] || gEvent[c.event]) return;
    gChip[k] = true; gEvent[c.event] = true; greedy.push(c);
  });
  const gTotal = greedy.reduce(function (t, c) { return t + c.value; }, 0);
  return { ok: s.total >= gTotal - 1e-9 && s.considered > 1,
    detail: "joint solve " + r2(s.total) + " points over " + s.plan.length + " chips against the greedy " + r2(gTotal) +
      " over " + greedy.length + "; " + s.considered + " nodes searched" };
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

// The check above guards the MAP (ctx.draft.byCode) and nothing else, so an id join inside
// draftEl — the one function every draft consumer goes through — used to pass the whole suite
// (E-048). These four drive the consumers: draftEl itself, then draftWaivers, watchlistAudit
// and draftXI, each on codes whose draft id is NOT the classic id.

const SYN_SHIFTED = [4, 11, 17, 22, 30].map(function (id) { return 500000 + id; });
const SYN_ROSTER = [1, 7, 2, 3, 8, 9, 14, 4, 16, 17, 22, 34, 6, 12, 30].map(function (id) { return 500000 + id; });
const SYN_DRAFT_STATE = (function () {
  const st = JSON.parse(JSON.stringify(SYN_STATE));
  st.draft = { league_id: null, roster: SYN_ROSTER, watchlist: [500004, 500034, 500016, 999999] };
  return st;
})();

check("E026-draftEl-joins-on-code-so-both-halves-are-the-same-footballer", function () {
  const bad = [];
  SYN_SHIFTED.forEach(function (code) {
    const rec = E.draftEl(code, CTX);
    if (!rec) { bad.push(code + ": draftEl returned null"); return; }
    if (!rec.classic || !rec.draft) { bad.push(code + ": one half missing (classic " + !!rec.classic + ", draft " + !!rec.draft + ")"); return; }
    if (rec.classic.code !== code || rec.draft.code !== code) bad.push(code + ": the two halves carry different codes");
    if (rec.classic.id === rec.draft.id) bad.push(code + ": the fixture is wrong — the ids do not differ");
    if (rec.id !== rec.classic.id) bad.push(code + ": rec.id is not the CLASSIC id");
    if (rec.web_name !== CTX.els[rec.classic.id].web_name) bad.push(code + ": name does not match the classic row");
    // the join an id-keyed implementation would make
    if (CTX.els[code] || CTX.draft.els[code]) bad.push(code + ": a code is also a valid id here — the fixture cannot separate the two joins");
  });
  return { ok: bad.length === 0, detail: bad.join("; ") ||
    SYN_SHIFTED.length + " shifted codes resolve to one player in both systems; keying the element tables by the CODE resolves nothing at all" };
});
check("E026-draftWaivers-claims-are-named-and-priced-off-the-code-join", function () {
  const claims = E.draftWaivers(SYN_DRAFT_STATE, CTX);
  const forced = claims.filter(function (c) { return c.forced; });
  const upgrades = claims.filter(function (c) { return !c.forced; });
  const named = claims.filter(function (c) {
    const o = E.draftEl(c.out, CTX), i = E.draftEl(c.in, CTX);
    return o && i && o.web_name === c.outName && i.web_name === c.inName;
  });
  const shiftedTouched = claims.filter(function (c) { return SYN_SHIFTED.indexOf(c.out) >= 0 || SYN_SHIFTED.indexOf(c.in) >= 0; });
  const sortedWithin = function (list) { return list.every(function (c, i) { return i === 0 || list[i - 1].gain >= c.gain - 1e-9; }); };
  const forcedFirst = claims.every(function (c, i) { return !c.forced || i < forced.length; });
  const ok = claims.length >= 2 && forced.length >= 2 && named.length === claims.length &&
    shiftedTouched.length >= 1 && forcedFirst && sortedWithin(forced) && sortedWithin(upgrades) &&
    claims.every(function (c, i) { return c.priority === i + 1; }) &&
    forced.some(function (c) { return c.out === 500034 && /no starts/.test(c.why); }) &&
    forced.some(function (c) { return c.out === 500022 && /unavailable/.test(c.why); });
  return { ok: ok, detail: claims.map(function (c) { return c.priority + ") " + c.outName + "→" + c.inName + " " + r2(c.gain) + (c.forced ? " forced" : "") ; }).join(" · ") +
    "; " + shiftedTouched.length + " of them involve a shifted code" };
});
check("E026-watchlistAudit-resolves-shifted-codes-and-applies-the-three-start-rule", function () {
  const res = E.watchlistAudit([500004, 500034, 500016, 999999], CTX);
  const d = {}; res.detail.forEach(function (x) { d[x.code] = x; });
  const ok = res.keep.join(",") === "500004,500016" && res.drop.join(",") === "500034" && res.unknown.join(",") === "999999" &&
    d[500004].id === 4 && d[500004].starts_last3 === 3 && d[500004].verdict === "KEEP" &&
    d[500034].starts_last3 === 0 && d[500034].verdict === "DROP" && d[999999].verdict === "unknown";
  return { ok: ok, detail: res.detail.map(function (x) { return x.code + "→" + (x.id === undefined ? "unresolved" : "id " + x.id) + " " + x.verdict + " (" + x.starts_last3 + " starts)"; }).join(" · ") };
});
check("E026-draftXI-picks-a-legal-eleven-from-a-roster-of-codes", function () {
  const xi = E.draftXI(SYN_ROSTER, CTX);
  const ids = xi.codes.map(function (c) { return E.draftEl(c, CTX).classic.id; });
  const shapes = E.FORMATIONS.map(function (f) { return f.join("-"); });
  const ok = xi.ids.length === 11 && xi.codes.length === 11 && ids.join(",") === xi.ids.join(",") &&
    shapes.indexOf(xi.formation) >= 0 && E.legalXI(xi.ids, CTX.els).ok &&
    xi.codes.every(function (c) { return SYN_ROSTER.indexOf(c) >= 0; }) &&
    xi.codes.filter(function (c) { return SYN_SHIFTED.indexOf(c) >= 0; }).length >= 1 &&
    xi.bench.length === 4 && xi.codes.indexOf(500034) < 0;
  return { ok: ok, detail: xi.formation + " from codes [" + xi.codes.join(",") + "] → ids [" + xi.ids.join(",") + "]; bench " + xi.bench.length +
    ", shifted codes in the eleven " + xi.codes.filter(function (c) { return SYN_SHIFTED.indexOf(c) >= 0; }).length + ", the dead man (500034) is out" };
});

// ================================================================ live snapshot

const LIVE_PATH = path.join(ROOT, "data", "live.json");
let LIVE = null;
try { LIVE = JSON.parse(fs.readFileSync(LIVE_PATH, "utf8")); } catch (e) { LIVE = null; }

if (!LIVE) {
  console.log("SKIP live block — data/live.json is missing or unreadable (" + LIVE_PATH + ")");
} else {
  // The recorded figure was 59 of 655 on 11 Sep 2026. The game added a player that evening and
  // the tables became 656 long, which failed a constant on a snapshot that was entirely correct
  // (E-064). The invariant is that every draft element joins by code and that the shift is real;
  // the size of the shift is reported, not frozen. smoke_wk reconciles it against the live API.
  check("E026-live-every-draft-element-joins-by-code-and-the-id-shift-is-real", function () {
    const byCode = {};
    LIVE.elements.forEach(function (e) { byCode[e.code] = e; });
    const joined = LIVE.draft.elements.filter(function (d) { return !!byCode[d.code]; });
    const differ = joined.filter(function (d) { return byCode[d.code].id !== d.id; });
    return { ok: joined.length === LIVE.draft.elements.length && differ.length > 0,
      detail: joined.length + " of " + LIVE.draft.elements.length + " draft elements join to a classic element by code; " +
        differ.length + " of them carry a different id (59 of 655 was the figure recorded on 11 Sep 2026)" };
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

  // ------------------------------------------------------------ E-026 / E-048 on the real 655
  // The map check earlier proves the two tables can be joined. These prove that the join the
  // CONSUMERS make is the code one: draftEl and the three functions built on it, driven over
  // the 59 codes whose draft id belongs to a different footballer in the classic game.
  const L_BYCODE = {}, L_BYID = {};
  LIVE.elements.forEach(function (e) { L_BYCODE[e.code] = e; L_BYID[e.id] = e; });
  const L_SHIFTED = LIVE.draft.elements.filter(function (d) { const c = L_BYCODE[d.code]; return c && c.id !== d.id; });

  check("E026-draftEl-resolves-every-shifted-code-to-one-player-while-the-id-join-lands-on-another", function () {
    const bad = [], collisions = [];
    L_SHIFTED.forEach(function (d) {
      const rec = E.draftEl(d.code, LCTX);
      if (!rec || !rec.classic || !rec.draft) { bad.push(d.code + ": draftEl returned " + (rec ? "half a record" : "null")); return; }
      if (rec.classic.code !== d.code || rec.draft.code !== d.code) bad.push(d.code + ": halves disagree");
      if (rec.classic.id !== L_BYCODE[d.code].id) bad.push(d.code + ": wrong classic id " + rec.classic.id);
      if (rec.web_name !== L_BYCODE[d.code].web_name) bad.push(d.code + ": wrong name " + rec.web_name);
      const other = LCTX.els[d.id];                 // what an id join would have found
      if (other && other.code !== d.code) collisions.push({ code: d.code, name: rec.web_name, draftId: d.id, classicId: rec.classic.id, other: other.web_name });
      if (LCTX.els[d.code]) bad.push(d.code + ": a code is also a live element id — the control is unsound");
    });
    const ex = collisions[0];
    return { ok: bad.length === 0 && L_SHIFTED.length === 59 && collisions.length >= 1,
      detail: bad.length ? bad.slice(0, 3).join("; ") :
        L_SHIFTED.length + " shifted codes all resolve to the same player in both systems; " + collisions.length +
        " of them would land on a DIFFERENT player under an id join — e.g. " + ex.name + " (code " + ex.code + ", draft id " + ex.draftId +
        ", classic id " + ex.classicId + ") would come back as " + ex.other };
  });
  check("E026-watchlistAudit-and-draftXI-and-draftWaivers-all-resolve-the-shifted-codes", function () {
    const need = { 1: 2, 2: 5, 3: 5, 4: 3 };
    const roster = [];
    L_SHIFTED.slice().sort(function (a, b) { return L_BYCODE[b.code].total_points - L_BYCODE[a.code].total_points; })
      .forEach(function (d) { const t = L_BYCODE[d.code].element_type; if (need[t] > 0) { need[t]--; roster.push(d.code); } });
    if (roster.length !== 15) return { ok: false, detail: "only " + roster.length + " shifted players available to build a 2-5-5-3 roster" };
    const audit = E.watchlistAudit(roster, LCTX);
    const xi = E.draftXI(roster, LCTX);
    const st = JSON.parse(JSON.stringify(LSTATE || {}));
    st.draft = { league_id: null, roster: roster, watchlist: roster };
    const claims = E.draftWaivers(st, LCTX);
    const auditOk = audit.unknown.length === 0 && audit.keep.length + audit.drop.length === 15 &&
      audit.detail.every(function (x) { return x.id === L_BYCODE[x.code].id && x.name === L_BYCODE[x.code].web_name; });
    const xiOk = xi.ids.length === 11 && E.legalXI(xi.ids, LCTX.els).ok &&
      xi.codes.every(function (c, i) { return L_BYCODE[c] && L_BYCODE[c].id === xi.ids[i]; });
    const claimsOk = claims.length >= 1 && claims.every(function (c) {
      return L_BYCODE[c.out] && L_BYCODE[c.in] && L_BYCODE[c.out].web_name === c.outName && L_BYCODE[c.in].web_name === c.inName;
    });
    return { ok: auditOk && xiOk && claimsOk,
      detail: "roster of 15 shifted-code players → watchlist " + audit.keep.length + " KEEP / " + audit.drop.length + " DROP / " +
        audit.unknown.length + " unknown; draftXI " + xi.formation + " (" + xi.ids.length + " ids, legal " + E.legalXI(xi.ids, LCTX.els).ok + "); " +
        claims.length + " waiver claims, all named off the classic row" };
  });

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

  // E-038 acceptance test on the real 655-player pool.
  const t2 = Date.now();
  const llo = lwc.ok ? E.wcLocalOptimum(lwc.ids, LCTX, {}) : { ok: false, optimal: false, checked: 0, reason: "solver not ok" };
  const loMs = Date.now() - t2;
  console.log("local-optimum audit: " + llo.checked + " legal single swaps tested in " + loMs + " ms · optimal " + llo.optimal +
    " · bank " + llo.bank + " tenths · solver took " + lwc.steps + " improving steps");
  check("LIVE-wildcardSolver-returns-a-one-swap-local-optimum-over-the-whole-pool", function () {
    return { ok: llo.ok && llo.optimal === true && llo.checked > 100, detail: llo.reason };
  });

  // E-036/E-039 (C1 rule 6 against the written plan): all three fifteens, priced, under one
  // objective. wildcardOptions must not move the solver's own answer.
  if (WEEKLY && WEEKLY.classic && Array.isArray(WEEKLY.classic.wildcard15)) {
    const t3 = Date.now();
    const lopt = E.wildcardOptions(LCTX, { written: WEEKLY.classic.wildcard15 });
    const optMs = Date.now() - t3;
    if (!lopt.ok) {
      check("LIVE-wildcardOptions-prices-all-three-fifteens", function () { return { ok: false, detail: lopt.reasons.join("; ") }; });
    } else {
      console.log("wildcardOptions (" + optMs + " ms): locks " + (lopt.locks.map(function (l) { return l.web_name + " " + Math.round(l.rivalOwn * 100) + "%"; }).join(", ") || "none"));
      ["pure", "locked", "written"].forEach(function (k) {
        const v = lopt[k];
        console.log("  " + k.padEnd(8) + " cost " + v.cost + " bank " + v.bank + " · objective " + r2(v.objective) + " (weekly " + r2(v.weekly) + ") · " + v.formation + " · legal " + v.legal);
      });
      const dl = lopt.deltas.lockedVsPure, dw = lopt.deltas.writtenVsPure;
      console.log("  locked − pure: " + (dl ? r2(dl.objective) + " objective, " + dl.cost + " tenths, " + dl.playersDiffer + " players" : "n/a") +
        " · written − pure: " + (dw ? r2(dw.objective) + " objective, " + dw.cost + " tenths, " + dw.playersDiffer + " players" : "n/a"));
      console.log("  " + lopt.note);
      check("LIVE-wildcardOptions-prices-all-three-fifteens", function () {
        const ok = ["pure", "locked", "written"].every(function (k) { return lopt[k] && lopt[k].ok === true && lopt[k].legal === true && lopt[k].ids.length === 15 && isFinite(lopt[k].objective); });
        return { ok: ok, detail: ["pure", "locked", "written"].map(function (k) { return k + " ok=" + lopt[k].ok + " legal=" + lopt[k].legal + " cost=" + lopt[k].cost; }).join(" · ") };
      });
      check("LIVE-wildcardOptions-derives-its-locks-from-the-written-plan-and-the-ownership-data", function () {
        const want = WEEKLY.classic.wildcard15.filter(function (id) { return LCTX.els[id] && E.convergenceRisk(id, LCTX).risk; }).sort(function (a, b) { return a - b; });
        const got = lopt.locks.map(function (l) { return l.id; }).sort(function (a, b) { return a - b; });
        const held = lopt.locked.ok && want.every(function (id) { return lopt.locked.ids.indexOf(id) >= 0; });
        return { ok: want.length > 0 && want.join(",") === got.join(",") && held,
          detail: want.length + " of the written fifteen are 60%+ rival-owned (" + want.map(function (id) { return LCTX.els[id].web_name; }).join(", ") + "); locks " + (want.join(",") === got.join(",") ? "match" : "DO NOT match: " + got.join(",")) + "; all held in the locked solve: " + held };
      });
      check("LIVE-wildcardOptions-does-not-move-the-default-solver-answer-or-rule-C1.6", function () {
        const same = lopt.pure.ids.slice().sort(function (a, b) { return a - b; }).join(",") === (lwc.ids || []).slice().sort(function (a, b) { return a - b; }).join(",");
        const pureClean = lopt.pure.ids.filter(function (id) { return E.rivalOwnMax(id, LCTX).max >= 0.60; }).length === 0;
        return { ok: same && pureClean, detail: "pure fifteen identical to wildcardSolver: " + same + "; rule-pure solve still carries no convergent player: " + pureClean };
      });
      check("LIVE-wildcardOptions-locked-solve-spends-more-of-the-bank-than-the-rule-pure-solve", function () {
        const d = lopt.deltas.lockedVsPure;
        if (!d) return { ok: false, detail: "no locked/pure delta" };
        return { ok: d.cost > 0 && lopt.locked.bank < lopt.pure.bank && d.playersDiffer > 0,
          detail: "pure leaves " + lopt.pure.bank + " tenths idle at objective " + r2(lopt.pure.objective) + "; locking the convergent premiums spends " + d.cost + " tenths more, leaves " + lopt.locked.bank + ", and is worth " + r2(d.objective) + " over five gameweeks across " + d.playersDiffer + " players" };
      });
    }
  }

  const ltim = E.wildcardTiming(LCTX);
  console.log("timing: " + ltim.horizons.map(function (h) { return h.label + " (" + h.weeks + " wks to GW" + h.gw + ") " + r2(h.sumDeficit); }).join(" · "));
  console.log("  " + ltim.saturated.note);
  check("LIVE-timing-horizons-both-include-their-end-gameweek-and-saturation-is-named", function () {
    const g19 = ltim.horizons.filter(function (h) { return /GW19/.test(h.label); })[0];
    const g38 = ltim.horizons.filter(function (h) { return /GW38/.test(h.label); })[0];
    const inclusive = g19 && g38 && g19.gw === 19 && g38.gw === 38 && g19.weeks === 19 - ltim.gw + 1 && g38.weeks === 38 - ltim.gw + 1;
    const equal = g19 && g38 && Math.abs(g19.sumDeficit - g38.sumDeficit) < 1e-9;
    const explained = !equal || (ltim.saturated.saturates === true && ltim.saturated.gw === ltim.gw + ltim.swapsNeeded - 1);
    return { ok: inclusive && explained, detail: "GW19 window " + (g19 ? g19.weeks : "?") + " weeks to GW" + (g19 ? g19.gw : "?") + ", GW38 window " + (g38 ? g38.weeks : "?") + " weeks to GW" + (g38 ? g38.gw : "?") + "; equal totals " + equal + ", saturates at GW" + ltim.saturated.gw };
  });

  const ltour = E.tournament(LIVE);
  console.log("tournament: leader " + ltour.leader + " · " + ltour.transitions + " transitions · promotable " + ltour.promotable + " · MAE in " + ltour.maeUnits);
  console.log("  " + ltour.models.map(function (m) { return m.key + " ρ=" + (m.spearman === null ? "n/a" : r4(m.spearman)) + " MAE=" + (m.mae === null ? "n/a" : r2(m.mae)) + " (raw " + (m.maeRaw === null ? "n/a" : r2(m.maeRaw)) + " × " + (m.maeScale === null ? "n/a" : r4(m.maeScale)) + ")"; }).join("\n  "));
  check("LIVE-tournament-MAEs-are-inside-one-order-of-magnitude-of-each-other", function () {
    const scored = ltour.models.filter(function (m) { return m.mae !== null; });
    const vals = scored.map(function (m) { return m.mae; });
    const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const raws = scored.map(function (m) { return m.maeRaw; });
    const rlo = Math.min.apply(null, raws), rhi = Math.max.apply(null, raws);
    return { ok: scored.length === 9 && lo > 0 && hi <= 10 * lo,
      detail: "calibrated spread " + r2(lo) + "–" + r2(hi) + " (ratio " + r2(hi / lo) + "); raw spread " + r2(rlo) + "–" + r2(rhi) + " (ratio " + r2(rhi / rlo) + ")" };
  });
  check("LIVE-the-BPS-rate-model-is-the-one-the-rescaling-moves", function () {
    const bps = ltour.models.filter(function (m) { return m.key === "bps_rate"; })[0];
    const cxp = ltour.models.filter(function (m) { return m.key === "component_xp"; })[0];
    if (!bps || bps.mae === null || !cxp || cxp.mae === null) return { ok: false, detail: "bps_rate or component_xp not scored" };
    return { ok: bps.maeRaw / bps.mae > 3 && bps.maeScale < 0.5 && Math.abs(bps.mae - cxp.mae) < 1 && cxp.maeRaw / cxp.mae < 1.5,
      detail: "bps_rate MAE " + r2(bps.maeRaw) + " raw → " + r2(bps.mae) + " in points (scale " + r4(bps.maeScale) + "); component_xp " + r2(cxp.maeRaw) + " → " + r2(cxp.mae) + " (scale " + r4(cxp.maeScale) + ")" };
  });
  check("LIVE-tournament-has-nine-models-and-is-not-promotable-yet", function () {
    return { ok: ltour.models.length === 9 && ltour.transitions === 2 && ltour.promotable === false, detail: ltour.models.length + " models · " + ltour.transitions + " transitions · promotable " + ltour.promotable + " (gate is 3, GW5 earliest)" };
  });
  // E-054: CLAUDE.md Part M and data/weekly.js both carry a written tournament leader
  // ("bps_rate", recorded at v86). The engine recomputes the walk-forward from the snapshot and
  // does not agree. The written value is a note, never an input — the app has to report what it
  // computed, and neither model may drive anything until the promotion gate opens at GW5.
  check("LIVE-the-tournament-leader-is-computed-from-the-snapshot-not-read-from-the-written-plan", function () {
    let written = null;
    try {
      const wsrc = fs.readFileSync(path.join(ROOT, "data", "weekly.js"), "utf8");
      const m = /tournament:\s*\{[^}]*leader:\s*"([a-z_0-9]+)"/.exec(wsrc);
      written = m ? m[1] : null;
    } catch (e) { written = null; }
    const keys = ltour.models.map(function (m) { return m.key; });
    // Recompute the ranking here, from the engine's own per-model Spearman, and check the
    // engine's leader is that argmax — not the written string.
    const scored = ltour.models.filter(function (m) { return m.spearman !== null; });
    const top = scored.slice().sort(function (a, b) { return b.spearman - a.spearman; })[0];
    const ok = written !== null && keys.indexOf(written) >= 0 && top && ltour.leader === top.key &&
      ltour.promotable === false && ltour.transitions < 3;
    return { ok: ok, detail: "written plan says " + written + "; the snapshot computes " + ltour.leader + " (ρ " + r4(top ? top.spearman : NaN) + ")" +
      (written === ltour.leader ? " — they agree today" : " — they disagree, and the computed one is what the engine reports") +
      "; promotable " + ltour.promotable + " at " + ltour.transitions + " transitions (gate 3)" };
  });
  check("LIVE-deadline-is-read-from-is_next-never-hard-coded", function () {
    const nextEv = LIVE.events.filter(function (e) { return e.is_next; })[0];
    return { ok: !!nextEv && LCTX.deadline === nextEv.deadline_time && LCTX.nextEvent === nextEv.id, detail: "events[is_next] GW" + (nextEv ? nextEv.id : "?") + " " + (nextEv ? nextEv.deadline_time : "?") + " · ctx " + LCTX.nextEvent + " " + LCTX.deadline };
  });
  // ================================================================ draft league (C5 · F2)
  //
  // Driven from qa/fixtures/draft/ — verbatim public responses recorded on 11 Sep 2026 —
  // through data/draft_league.cjs, the same shaping function data/fetch_live.cjs runs.
  // No suite touches the network.

  const DF = require("./fixtures/draft_fixture.cjs");
  const DF_RAW1 = DF.raw(1);
  const DF_RAW100 = DF.raw(100);
  const L1 = DF.withLeague(LIVE, 1, { meEntryId: 1 });
  const L100 = DF.withLeague(LIVE, 100, {});
  const L1_CTX = E.buildCtx(L1, LSTATE, LIVE.fetched_at);
  const L100_CTX = E.buildCtx(L100, LSTATE, LIVE.fetched_at);
  const NO_LEAGUE_CTX = E.buildCtx(LIVE, LSTATE, LIVE.fetched_at);

  check("DRAFT-league-input-reads-an-address-an-id-and-an-entry", function () {
    const cases = [
      ["https://draft.premierleague.com/league/1/standings", "league", 1],
      ["https://draft.premierleague.com/leagues/26474/details", "league", 26474],
      ["https://draft.premierleague.com/entry/1/event/3", "entry", 1],
      ["  1234  ", "unknown", 1234],
      ["league 99 of mine", "unknown", 99]
    ];
    const bad = [];
    cases.forEach(function (c) {
      const r = E.draftLeagueInput(c[0]);
      if (!r.ok || r.kind !== c[1] || r.id !== c[2]) bad.push(JSON.stringify(c[0]) + " → " + JSON.stringify(r));
    });
    ["", "   ", "no digits here", "12345678901234", new Array(500).join("9")].forEach(function (x) {
      const r = E.draftLeagueInput(x);
      if (r.ok) bad.push(JSON.stringify(String(x).slice(0, 20)) + " was accepted: " + JSON.stringify(r));
    });
    return { ok: bad.length === 0, detail: bad.join("; ") || cases.length + " accepted forms and 5 rejected ones all read as documented" };
  });

  check("DRAFT-fixture-league-1-shapes-into-fourteen-fifteens", function () {
    const d = L1.draft;
    const sizes = Object.keys(d.rosters).map(function (k) { return d.rosters[k].length; });
    const ok = d.entries.length === 14 && Object.keys(d.rosters).length === 14 &&
      sizes.every(function (n) { return n === 15; }) && d.counts.owned === 210 &&
      d.freeAgents.length === d.counts.freeAgents && d.matches.length > 0 && d.standings.length === 14;
    return { ok: ok, detail: d.entries.length + " teams, " + Object.keys(d.rosters).length + " rosters of " +
      (sizes.join("/") || "none") + ", " + d.counts.owned + " owned, " + d.freeAgents.length + " free agents, " +
      d.matches.length + " fixtures, " + d.standings.length + " standings rows, " + d.unjoined + " draft element(s) the snapshot cannot join" };
  });

  // E-063. element_status[].owner is an ENTRY id, not a league-entry id. The fixture proves
  // the trap is live (three owners in league 1 are not league-entry ids at all) and that the
  // shaped block speaks league-entry ids throughout.
  check("E063-element-status-owner-is-an-entry-id-and-is-translated", function () {
    const details = DF_RAW1.details, status = DF_RAW1.status;
    const leagueEntryIds = {}; details.league_entries.forEach(function (e) { leagueEntryIds[e.id] = true; });
    const entryToLeagueEntry = {}; details.league_entries.forEach(function (e) { if (e.entry_id) entryToLeagueEntry[e.entry_id] = e.id; });
    const owners = {}; status.element_status.forEach(function (r) { if (r.owner !== null) owners[r.owner] = true; });
    const rawOwners = Object.keys(owners).map(Number);
    const trapped = rawOwners.filter(function (o) { return !leagueEntryIds[o]; });
    if (!trapped.length) return { ok: false, detail: "the fixture no longer contains an owner that is not a league-entry id, so this check cannot prove the translation" };
    const bad = [];
    L1.draft.ownership.forEach(function (row) {
      if (row.owner === null) return;
      if (!leagueEntryIds[row.owner]) bad.push("code " + row.code + " owned by " + row.owner + ", which is not a league-entry id");
    });
    // and the translation lands on the right team: a trapped entry id maps to its league entry
    trapped.forEach(function (o) {
      const want = entryToLeagueEntry[o];
      const got = L1.draft.rosters[String(want)];
      if (!got || got.length !== 15) bad.push("entry id " + o + " should become league entry " + want + " with fifteen players");
    });
    return { ok: bad.length === 0, detail: bad.join("; ") ||
      "raw owners " + trapped.join(", ") + " are entry ids and not league-entry ids; all " + L1.draft.ownership.filter(function (r) { return r.owner !== null; }).length +
      " owned rows carry a league-entry id after shaping" };
  });

  check("DRAFT-pool-is-free-agents-only-and-excludes-every-rostered-code", function () {
    const pool = E.draftPool(L1_CTX);
    const rostered = {};
    Object.keys(L1_CTX.draft.rosters).forEach(function (k) { L1_CTX.draft.rosters[k].forEach(function (c) { rostered[c] = k; }); });
    const free = {}; L1_CTX.draft.freeAgents.forEach(function (c) { free[c] = true; });
    const owned = pool.filter(function (p) { return rostered[p.code]; });
    const notFree = pool.filter(function (p) { return !free[p.code]; });
    // element-status "a" is claimability; elements[].status is fitness. A free agent can be
    // claimable and injured, so the pool membership test is the first and eligibility uses both.
    const statusBad = pool.filter(function (p) { return p.poolStatus !== "a"; });
    const unfit = pool.filter(function (p) { return p.status !== "a"; });
    const unfitEligible = unfit.filter(function (p) { return p.eligible; });
    const sorted = pool.every(function (p, i) {
      if (!i) return true;
      const q = pool[i - 1];
      return (Number(q.eligible) > Number(p.eligible)) || (q.eligible === p.eligible && q.ev >= p.ev - 1e-9);
    });
    const elig = pool.filter(function (p) { return p.eligible; });
    const eligBad = elig.filter(function (p) { return p.starts_last3 < 3; });
    return {
      ok: pool.length > 0 && !owned.length && !notFree.length && !statusBad.length && sorted && !eligBad.length && !unfitEligible.length,
      detail: pool.length + " free agents, " + elig.length + " of them with three starts of three; " +
        owned.length + " owned by somebody, " + notFree.length + " outside the free-agent list, " + statusBad.length +
        " not claimable; " + unfit.length + " claimable but carrying a fitness flag, of which " + unfitEligible.length +
        " wrongly marked eligible; ranking descending within the eligible groups: " + sorted +
        "; top three " + pool.slice(0, 3).map(function (p) { return p.web_name + " " + p.ev.toFixed(1); }).join(", ")
    };
  });

  // A corrupted snapshot: the freeAgents list is made to contain a player the ownership map
  // says is rostered. The pool is derived from ownership, so he must not appear — the guard
  // this proves could not fail while the pool merely read the list (mutation-checked).
  check("DRAFT-a-wrong-free-agent-list-cannot-put-an-owned-player-in-the-pool", function () {
    const bent = JSON.parse(JSON.stringify(L1));
    const victimOwner = Object.keys(bent.draft.rosters)[0];
    const victim = bent.draft.rosters[victimOwner][0];
    bent.draft.freeAgents = bent.draft.freeAgents.concat([victim]);
    const c = E.buildCtx(bent, LSTATE, LIVE.fetched_at);
    const pool = E.draftPool(c);
    const claims = E.draftWaivers(null, c);
    const inPool = pool.filter(function (p) { return p.code === victim; });
    const claimed = claims.filter(function (x) { return x.in === victim; });
    return { ok: pool.length > 0 && !inPool.length && !claimed.length,
      detail: "code " + victim + " (owned by league entry " + victimOwner + ") was pushed into freeAgents; the pool of " +
        pool.length + " contains him " + inPool.length + " times and the claims " + claimed.length + " times" };
  });

  check("DRAFT-a-claim-is-never-for-a-player-somebody-owns", function () {
    const claims = E.draftWaivers(null, L1_CTX);
    const rostered = {};
    Object.keys(L1_CTX.draft.rosters).forEach(function (k) { L1_CTX.draft.rosters[k].forEach(function (c) { rostered[c] = Number(k); }); });
    const me = L1_CTX.draft.me.leagueEntryId;
    const mine = {}; (L1_CTX.draft.rosters[me] || []).forEach(function (c) { mine[c] = true; });
    const bad = [];
    claims.forEach(function (c) {
      if (rostered[c.in]) bad.push(c.inName + " is owned by league entry " + rostered[c.in]);
      if (!mine[c.out]) bad.push(c.outName + " is not on your fifteen");
      if (c.pool !== "api") bad.push(c.inName + " was claimed from the assumed pool while a real one exists");
      if (c.roster !== "api") bad.push("the roster behind the claim came from " + c.roster);
    });
    let seenUnforced = false;
    claims.forEach(function (c) { if (c.forced && seenUnforced) bad.push("a forced replacement ranks below an upgrade"); if (!c.forced) seenUnforced = true; });
    return { ok: claims.length > 0 && !bad.length, detail: bad.join("; ") ||
      claims.length + " claims, all from the real pool: " + claims.map(function (c) { return c.priority + ". " + c.outName + " to " + c.inName + " " + c.gain.toFixed(1) + (c.forced ? " forced" : ""); }).join(" · ") };
  });

  check("DRAFT-waiver-order-is-the-league-s-own-waiver-pick", function () {
    const wo = E.waiverOrder(L1_CTX);
    const want = DF_RAW1.details.league_entries.slice().sort(function (a, b) {
      const pa = a.waiver_pick === null || a.waiver_pick === undefined ? Infinity : a.waiver_pick;
      const pb = b.waiver_pick === null || b.waiver_pick === undefined ? Infinity : b.waiver_pick;
      return (pa - pb) || (a.id - b.id);
    }).map(function (e) { return e.id; });
    const got = wo.order.map(function (r) { return r.leagueEntryId; });
    const meRow = DF_RAW1.details.league_entries.filter(function (e) { return e.id === L1_CTX.draft.me.leagueEntryId; })[0];
    const minePos = want.indexOf(meRow.id) + 1;
    const ok = wo.ok && JSON.stringify(got) === JSON.stringify(want) && wo.mine &&
      wo.mine.position === minePos && wo.mine.of === want.length && wo.mine.waiverPick === meRow.waiver_pick;
    return { ok: ok, detail: "order " + got.join(",") + " against the API's waiver_pick order " + want.join(",") +
      "; you claim " + (wo.mine ? wo.mine.position + " of " + wo.mine.of + " on waiver pick " + wo.mine.waiverPick : "unknown") };
  });

  check("DRAFT-league-100-empty-seat-owns-nothing-and-claims-last", function () {
    const seat = DF_RAW100.details.league_entries.filter(function (e) { return e.entry_id === null; })[0];
    if (!seat) return { ok: false, detail: "the league 100 fixture no longer has a team without an entry id" };
    const wo = E.waiverOrder(L100_CTX);
    const last = wo.order[wo.order.length - 1];
    const roster = E.draftRosterOf(seat.id, L100_CTX);
    const ok = wo.ok && wo.order.length === 10 && last.leagueEntryId === seat.id && roster.length === 0 && !wo.mine;
    return { ok: ok, detail: "league entry " + seat.id + " has no entry id, owns " + roster.length + " players and sits " +
      (last ? last.position : "?") + " of " + wo.order.length + "; whose team is whose is unknown, so mine is " + JSON.stringify(wo.mine) };
  });

  check("DRAFT-h2h-opponent-comes-from-the-league-s-matches", function () {
    const gw = L1_CTX.nextEvent;
    const wanted = {};
    DF_RAW1.details.matches.forEach(function (m) {
      if (Number(m.event) !== gw) return;
      wanted[m.league_entry_1] = m.league_entry_2;
      wanted[m.league_entry_2] = m.league_entry_1;
    });
    const bad = [];
    let n = 0;
    L1.draft.entries.forEach(function (e) {
      const snap = DF.asTeam(LIVE, 1, e.leagueEntryId);
      const c = E.buildCtx(snap, LSTATE, LIVE.fetched_at);
      const h = E.h2hOpponent(c, gw);
      n++;
      if (!h.ok) { bad.push(e.name + ": " + h.note); return; }
      if (h.opponent.leagueEntryId !== wanted[e.leagueEntryId]) {
        bad.push(e.name + " → " + h.opponent.leagueEntryId + ", the API says " + wanted[e.leagueEntryId]);
      }
    });
    return { ok: n === 14 && !bad.length, detail: bad.join("; ") || n + " teams, every GW" + gw + " opponent matches the league's own fixture list" };
  });

  check("DRAFT-h2h-margin-is-antisymmetric-because-the-draws-are-shared", function () {
    const gw = L1_CTX.nextEvent;
    const margin = {};
    L1.draft.entries.forEach(function (e) {
      const c = E.buildCtx(DF.asTeam(LIVE, 1, e.leagueEntryId), LSTATE, LIVE.fetched_at);
      const p = E.h2hProjection(c, {});
      margin[e.leagueEntryId] = p.ok ? { m: p.margin, opp: p.opponent.leagueEntryId, mine: p.mine.mean, theirs: p.theirs.mean, dist: p.marginDist } : null;
    });
    const bad = [];
    Object.keys(margin).forEach(function (k) {
      const a = margin[k];
      if (!a) { bad.push(k + " has no projection"); return; }
      const b = margin[a.opp];
      if (!b) { bad.push("no projection for opponent " + a.opp); return; }
      if (Math.abs(a.m + b.m) > 1e-9) bad.push(k + " sees " + a.m.toFixed(3) + " while " + a.opp + " sees " + b.m.toFixed(3));
      if (Math.abs(a.m - (a.mine - a.theirs)) > 1e-9) bad.push(k + ": the mean margin is not the difference of the means");
      if (!(a.dist.q10 <= a.dist.q50 && a.dist.q50 <= a.dist.q90)) bad.push(k + ": margin quantiles are out of order");
    });
    const sample = margin[1];
    return { ok: !bad.length, detail: bad.slice(0, 3).join("; ") || "seven fixtures, every margin the exact negative of its mirror; league entry 1 projects " +
      sample.mine.toFixed(1) + " against " + sample.theirs.toFixed(1) + " (margin " + sample.m.toFixed(2) + ", tenth to ninetieth " + sample.dist.q10.toFixed(1) + " to " + sample.dist.q90.toFixed(1) + ")" };
  });

  check("DRAFT-C5-variance-rule-leans-up-when-behind-and-down-when-ahead", function () {
    const bad = [];
    let tilted = 0, leaned = 0;
    L1.draft.entries.forEach(function (e) {
      const c = E.buildCtx(DF.asTeam(LIVE, 1, e.leagueEntryId), LSTATE, LIVE.fetched_at);
      const roster = E.draftRoster(null, c).codes;
      const xi = E.draftXI(roster, c);
      const plain = E.draftXIBase(roster, c);
      if (!xi.h2h || !xi.h2h.ok) { bad.push(e.name + ": no projection"); return; }
      const m = xi.h2h.margin;
      const want = m < -0.5 ? "up" : (m > 0.5 ? "down" : "none");
      if (xi.lean !== want) bad.push(e.name + ": margin " + m.toFixed(2) + " but lean " + xi.lean);
      if (xi.lean !== "none") leaned++;
      const sameXI = xi.ids.slice().sort().join() === plain.ids.slice().sort().join();
      const sameBench = xi.benchIds.join() === plain.benchIds.join();
      if (xi.tilted) {
        tilted++;
        if (sameXI && sameBench) bad.push(e.name + " is marked tilted but neither the eleven nor the bench changed");
        if (xi.tiltChangedXI === sameXI) bad.push(e.name + ": tiltChangedXI says " + xi.tiltChangedXI + " while the eleven " + (sameXI ? "did not change" : "changed"));
        if (E.legalXI(xi.ids, c.els).ok !== true) bad.push(e.name + ": the tilted eleven is not legal");
      } else if (!sameXI || !sameBench) {
        bad.push(e.name + " changed its side without being marked tilted");
      }
      if (!/(ahead|behind|level)/.test(xi.note)) bad.push(e.name + ": the note does not say which side of the projection he is on — " + xi.note);
      if (!/(ceiling|floor|highest.expected.points)/.test(xi.note)) bad.push(e.name + ": the note does not name the direction — " + xi.note);
    });
    return { ok: !bad.length && leaned > 0, detail: bad.slice(0, 3).join("; ") ||
      leaned + " of 14 teams separate on the projection and " + tilted + " of those keep a tilted eleven; every one states the direction and the quantile it was judged on" };
  });

  check("DRAFT-mcDraftXI-applies-no-captain-where-mcSquad-does", function () {
    const roster = E.draftRoster(null, L1_CTX).codes;
    const base = E.draftXIBase(roster, L1_CTX);
    const ids = base.ids.concat(base.benchIds);
    const draftRun = E.mcDraftXI(base.ids, base.benchIds, L1_CTX, 400, 5);
    const classicRun = E.mcSquad(base.ids.concat(base.benchIds), base.ids[0], L1_CTX, 400, 5);
    return {
      ok: draftRun.ok && draftRun.mean > 0 && classicRun.mean > draftRun.mean && ids.length === 15,
      detail: "fifteen players; draft run (no captain) " + draftRun.mean.toFixed(2) + ", classic run (captain doubled) " +
        classicRun.mean.toFixed(2) + " — the captain double is the difference"
    };
  });

  check("DRAFT-roster-comes-from-the-api-when-the-league-knows-it", function () {
    const api = E.draftRoster(null, L1_CTX);
    const saved = E.draftRoster(null, NO_LEAGUE_CTX);
    const mine = L1_CTX.draft.rosters[L1_CTX.draft.me.leagueEntryId] || [];
    return {
      ok: api.source === "api" && api.complete && api.codes.length === 15 &&
        JSON.stringify(api.codes) === JSON.stringify(mine) &&
        saved.source === "saved" && saved.codes.length === (LSTATE.draft.roster || []).length,
      detail: "with a league: " + api.codes.length + " codes from the API (" + api.note + "); without one: " +
        saved.codes.length + " from the saved state (" + saved.note + ")"
    };
  });

  // E-026 again, now on the league path: the 59 shifted ids must survive the ownership join.
  check("E026-the-code-join-holds-for-every-shifted-draft-id-in-the-league", function () {
    const byCode = {}; LIVE.elements.forEach(function (el) { byCode[el.code] = el; });
    const byId = {}; LIVE.elements.forEach(function (el) { byId[el.id] = el; });
    const draftById = {}; LIVE.draft.elements.forEach(function (d) { draftById[d.id] = d; });
    const shifted = LIVE.draft.elements.filter(function (d) { const c = byCode[d.code]; return c && Number(c.id) !== Number(d.id); });
    const ownByCode = {}; L1.draft.ownership.forEach(function (r) { ownByCode[r.code] = r; });
    const rawByElement = {}; DF_RAW1.status.element_status.forEach(function (r) { rawByElement[r.element] = r; });
    const bad = [];
    let checked = 0;
    shifted.forEach(function (d) {
      const rawRow = rawByElement[d.id];
      if (!rawRow) { bad.push(d.web_name + ": draft id " + d.id + " is not in the recorded element-status"); return; }
      const shaped = ownByCode[d.code];
      if (!shaped) { bad.push(d.web_name + ": code " + d.code + " did not survive the join"); return; }
      // keying on the draft id instead would have named a different footballer
      const wrong = byId[d.id];
      if (!wrong || wrong.code === d.code) { bad.push(d.web_name + ": the fixture cannot separate the two joins"); return; }
      checked++;
    });
    return { ok: shifted.length === 59 && checked === 59 && !bad.length,
      detail: bad.slice(0, 3).join("; ") || checked + " of " + shifted.length + " shifted draft ids join by code through the league's ownership; " +
        "worked example " + (shifted[0] ? shifted[0].web_name + " draft id " + shifted[0].id + " is classic id " + byCode[shifted[0].code].id + ", where the classic table's id " + shifted[0].id + " is " + byId[shifted[0].id].web_name : "none") };
  });

  check("DRAFT-without-a-league-id-nothing-changes", function () {
    const c = NO_LEAGUE_CTX;
    const pool = E.draftPool(c);
    const own = E.draftOwnership(c);
    const wo = E.waiverOrder(c);
    const h = E.h2hOpponent(c, c.nextEvent);
    const claims = E.draftWaivers(null, c);
    const bad = [];
    if (c.draft.hasPool) bad.push("hasPool is true without a league");
    if (pool.length) bad.push("the pool is not empty");
    if (own.ok) bad.push("ownership claims to be known");
    if (wo.ok) bad.push("a waiver order was produced");
    if (h.ok) bad.push("an opponent was produced");
    if (!claims.length) bad.push("the documented fallback produced no claims at all");
    claims.forEach(function (cl) { if (cl.pool !== "assumed") bad.push("a fallback claim is labelled " + cl.pool); });
    if (!/no draft league id/.test(c.draft.note)) bad.push("the context does not say why the pool is unknown: " + c.draft.note);
    return { ok: !bad.length, detail: bad.join("; ") || claims.length + " fallback claims, every one labelled assumed; " + c.draft.note };
  });

  // ------------------------------------------------------------ F4 / F5 / F8 on the live snapshot
  const LWF = E.minutesWalkForward(LIVE, { bins: 5 });
  console.log("");
  console.log("minutes model (F4), walk-forward on the shipped snapshot:");
  LWF.folds.forEach(function (f) {
    console.log("  GW" + f.from + " → GW" + f.to + ": n " + f.n + " · base rate " + r4(f.baseRate) +
      " · Laplace Brier " + r4(f.incumbent.brier) + " (skill " + r4(f.incumbent.skill) + ")" +
      " · logistic " + (f.challenger ? r4(f.challenger.brier) + " (skill " + r4(f.challenger.skill) + ")" : "not fitted") +
      " → " + f.winner);
    if (f.challenger) console.log("    reliability, 5 bins: " + f.challenger.reliability.bins.map(function (b) {
      return "[" + r2(b.lo) + "–" + r2(b.hi) + "] n " + b.n + " said " + r2(b.meanPred) + " happened " + r2(b.meanOutcome);
    }).join(" · "));
    console.log("    no-flag pair: Laplace " + r4(f.noFlag.incumbent) + " · logistic " + (f.noFlag.challenger === null ? "—" : r4(f.noFlag.challenger)) +
      " · players seen before: n " + f.seenOnly.n + " Laplace " + r4(f.seenOnly.incumbent) + " logistic " + (f.seenOnly.challenger === null ? "—" : r4(f.seenOnly.challenger)));
  });
  console.log("  gate: " + LWF.gate.note);

  check("LIVE-F4-both-models-are-scored-and-the-gate-is-shut", function () {
    const scored = LWF.folds.filter(function (f) { return f.fitted; });
    const ok = LWF.folds.length === 2 && LWF.comparable === 1 && LWF.gate.promotable === false &&
      LWF.folds.every(function (f) { return f.incumbent.brier >= 0 && f.incumbent.brier <= 1; }) &&
      scored.every(function (f) { return f.challenger.brier >= 0 && f.challenger.brier <= 1; }) &&
      LWF.driver === "pStart";
    return { ok: ok, detail: LWF.folds.length + " transitions, " + LWF.comparable + " of them fittable; driver " + LWF.driver +
      "; " + LWF.gate.reasons.join("; ") };
  });

  const LPXEL = LCTX.els[LCTX.squadIds[0]] || LCTX.elList[0];
  const LPX = E.playerXg(LPXEL, LCTX, {});
  const lpxModel = ltour.models.filter(function (m) { return m.key === "player_xg"; })[0];
  console.log("");
  console.log("player xG (F5): ρ " + (lpxModel && lpxModel.spearman !== null ? r4(lpxModel.spearman) : "—") +
    " · calibrated MAE " + (lpxModel && lpxModel.mae !== null ? r2(lpxModel.mae) + " pts" : "—") +
    " · per transition [" + (lpxModel ? lpxModel.perTransition.map(r4).join(", ") : "") + "]" +
    " · led " + (lpxModel ? lpxModel.wins : 0) + " of " + ltour.transitions + " · promotable " + (lpxModel ? lpxModel.promotable : "—"));
  console.log("  every model, ρ then MAE in points: " + ltour.models.slice().sort(function (a, b) { return (b.spearman || 0) - (a.spearman || 0); })
    .map(function (m) { return m.key + " " + (m.spearman === null ? "—" : r4(m.spearman)) + "/" + (m.mae === null ? "—" : r2(m.mae)); }).join(" · "));
  console.log("  worked example: " + (LPXEL ? LPXEL.web_name : "no player") +
    " xG90 " + r4(LPX.xg90) + " x att " + r4(LPX.att) + " x def " + r4(LPX.def) + " → lambda " + r4(LPX.lambda) + ", xP " + r2(LPX.xp));

  check("LIVE-F5-player-xg-is-scored-and-still-cannot-be-promoted", function () {
    if (!lpxModel) return { ok: false, detail: "player_xg is not in the live tournament" };
    return { ok: lpxModel.spearman !== null && lpxModel.promotable === false && lpxModel.gate.transitionsOk === false &&
        ltour.models.every(function (m) { return m.promotable === false; }),
      detail: "player_xg ρ " + r4(lpxModel.spearman) + " leading " + lpxModel.wins + " of " + ltour.transitions +
        " transitions; " + lpxModel.gate.reasons.join("; ") };
  });

  const LCS = E.chipSolver(LCTX, {});
  console.log("");
  console.log("chip solver (F8): doubles " + LCS.doubles.length + " · blanks " + LCS.blanks.length +
    " · confirmed " + LCS.confirmed + " · plan " + (LCS.plan.length ? LCS.plan.map(function (a) { return a.chip + " set " + a.set + " GW" + a.event + " " + r2(a.value); }).join(", ") : "nothing"));
  console.log("  " + LCS.windowNote);

  check("LIVE-F8-no-window-is-confirmed-on-the-real-calendar", function () {
    const counts = {};
    LIVE.fixtures.forEach(function (f) {
      if (f.event === null || f.event === undefined || f.event < LIVE.next_event) return;
      counts[f.event + ":" + f.team_h] = (counts[f.event + ":" + f.team_h] || 0) + 1;
      counts[f.event + ":" + f.team_a] = (counts[f.event + ":" + f.team_a] || 0) + 1;
    });
    const doubles = Object.keys(counts).filter(function (k) { return counts[k] >= 2; });
    const nonWc = LCS.plan.filter(function (a) { return a.chip !== "WC"; });
    return { ok: LCS.ok && LCS.confirmed === false && doubles.length === 0 && nonWc.length === 0 && /No window is confirmed yet/.test(LCS.windowNote),
      detail: "every remaining club-gameweek in the published list has exactly one fixture (" + doubles.length +
        " with two), so no Bench Boost, Triple Captain or Free Hit window exists; the solver assigns " + LCS.plan.length + " chip" + (LCS.plan.length === 1 ? "" : "s") };
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

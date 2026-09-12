#!/usr/bin/env node
/*
 * validate_live.cjs — checks data/live.json against CONTRACT.md §3.
 *   node data/validate_live.cjs [path]      (default data/live.json)
 * Prints PASS/FAIL lines and exits 1 on any FAIL. No dependencies.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const file = process.argv[2] || path.join(__dirname, "live.json");
const text = fs.readFileSync(file, "utf8");
const L = JSON.parse(text);
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`PASS ${name}`); } else { fail++; console.log(`FAIL ${name}${detail ? " — " + detail : ""}`); } };

const KEYS = ["fetched_at","source","next_event","current_event","total_players","events","teams","elements","fixtures","gw","entry","history","picks","ft_available","leagues","rivals","draft"];
for (const k of KEYS) ok(`key ${k}`, k in L);
ok("fetched_at ISO UTC", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(L.fetched_at), L.fetched_at);
ok("20 teams", L.teams.length === 20, String(L.teams.length));
ok(">=600 elements", L.elements.length >= 600, String(L.elements.length));
ok("3 finished GWs in gw", Object.keys(L.gw).join(",") === "1,2,3", Object.keys(L.gw).join(","));
ok("6 leagues", L.leagues.length === 6, String(L.leagues.length));
ok("79 rivals", Object.keys(L.rivals).length === 79, String(Object.keys(L.rivals).length));
ok('no "ep_" substring', !text.includes("ep_"));
ok("ft_available === 3", L.ft_available === 3, String(L.ft_available));
ok("next_event 4", L.next_event === 4, String(L.next_event));
const nextEv = L.events.find((e) => e.is_next);
ok("deadline 2026-09-12T12:30:00Z", nextEv && nextEv.deadline_time === "2026-09-12T12:30:00Z", nextEv && nextEv.deadline_time);
ok("current_event 3", L.current_event === 3, String(L.current_event));
ok("total_players number", typeof L.total_players === "number" && L.total_players > 1e7, String(L.total_players));

// element shape and numeric types
const EL_KEYS = ["id","code","web_name","team","element_type","now_cost","cost_change_event","cost_change_start","selected_by_percent","status","news","chance","total_points","minutes","starts","xg","xa","xgc","dc","bps","ict","form","goals","assists","cs","gc","bonus","yc","rc","og","pen_miss","pen_save","saves","transfers_in_event","transfers_out_event"];
const badKeys = L.elements.filter((e) => EL_KEYS.some((k) => !(k in e)) || Object.keys(e).length !== EL_KEYS.length).length;
ok("element keys exact", badKeys === 0, `${badKeys} elements off-shape`);
const strNum = L.elements.filter((e) => ["selected_by_percent","xg","xa","xgc","ict","form","now_cost"].some((k) => typeof e[k] !== "number")).length;
ok("element numerics are numbers", strNum === 0, `${strNum} with string numerics`);
const badChance = L.elements.filter((e) => !(e.chance === null || (typeof e.chance === "number" && e.chance >= 0 && e.chance <= 100))).length;
ok("chance null|0..100", badChance === 0, String(badChance));
ok("prices in tenths (integers)", L.elements.every((e) => Number.isInteger(e.now_cost) && e.now_cost > 30 && e.now_cost < 200));

// fixtures
ok("380 fixtures", L.fixtures.length === 380, String(L.fixtures.length));
ok("fixture keys", L.fixtures.every((f) => ["id","event","team_h","team_a","team_h_difficulty","team_a_difficulty","finished","started","kickoff_time","team_h_score","team_a_score"].every((k) => k in f)));

// gw blocks
for (const g of Object.keys(L.gw)) {
  const rows = Object.values(L.gw[g].elements);
  ok(`gw${g} rows are 20-slot`, rows.every((r) => Array.isArray(r) && r.length === 20 && r.every((v) => typeof v === "number")), `${rows.length} rows`);
  ok(`gw${g} no 0-minute rows`, rows.every((r) => r[0] > 0));
  ok(`gw${g} ~300 players played`, rows.length > 250 && rows.length < 400, String(rows.length));
  const fxs = L.fixtures.filter((f) => f.event === Number(g) && f.finished);
  const covered = fxs.filter((f) => L.gw[g].fixture_xg[String(f.id)]).length;
  ok(`gw${g} fixture_xg covers all ${fxs.length} finished fixtures`, covered === fxs.length, `${covered}/${fxs.length}`);
  const sumXg = Object.values(L.gw[g].fixture_xg).reduce((s, v) => s + v.h + v.a, 0);
  const sumRows = rows.reduce((s, r) => s + r[3], 0);
  ok(`gw${g} fixture_xg sums to player xg (${sumXg.toFixed(2)} vs ${sumRows.toFixed(2)})`, Math.abs(sumXg - sumRows) < 0.05 * fxs.length);
}

// entry / history / picks
ok("entry id 3546875", L.entry.id === 3546875);
ok("entry keys", ["id","name","summary_overall_points","summary_overall_rank","summary_event_points","current_event","last_deadline_bank","last_deadline_value","last_deadline_total_transfers"].every((k) => k in L.entry));
ok("history 3 rows", L.history.current.length === 3, String(L.history.current.length));
ok("history keys", L.history.current.every((h) => ["event","points","total_points","rank","overall_rank","bank","value","event_transfers","event_transfers_cost","points_on_bench"].every((k) => k in h)));
ok("chips array", Array.isArray(L.history.chips));
ok("picks GW1..3", Object.keys(L.picks).join(",") === "1,2,3", Object.keys(L.picks).join(","));
const pickIds = (g) => L.picks[g].picks.map((p) => p.element).sort((a, b) => a - b).join(",");
ok("picks GW1=GW2=GW3", pickIds("1") === pickIds("2") && pickIds("2") === pickIds("3"));
ok("GW3 picks = §9 ids", pickIds("3") === "4,12,31,40,109,165,175,212,259,368,397,411,423,496,552", pickIds("3"));
ok("picks have 15 with position/multiplier/captain flags", Object.values(L.picks).every((p) => p.picks.length === 15 && p.picks.every((x) => "position" in x && "multiplier" in x && typeof x.is_captain === "boolean" && typeof x.is_vice_captain === "boolean") && "active_chip" in p));

// leagues / rivals
const want = { 1314671: 8, 1683215: 11, 26474: 17, 512557: 23, 989793: 24, 512550: 28 };
ok("league ids = §3", L.leagues.map((l) => l.id).join(",") === Object.keys(want).map(Number).sort((a, b) => a - b).join(",") || L.leagues.every((l) => want[l.id]), L.leagues.map((l) => l.id).join(","));
ok("league sizes = §3", L.leagues.every((l) => l.size === want[l.id] && l.standings.length === l.size), L.leagues.map((l) => `${l.id}:${l.size}`).join(" "));
ok("league rank/last_rank numbers", L.leagues.every((l) => Number.isInteger(l.rank) && Number.isInteger(l.last_rank)), L.leagues.map((l) => `${l.name} ${l.rank}/${l.last_rank}`).join(" · "));
ok("standings keys", L.leagues.every((l) => l.standings.every((s) => ["entry","player_name","entry_name","total","rank"].every((k) => k in s))));
ok("Kwezi not a rival", !("3546875" in L.rivals));
const allRivals = new Set(L.leagues.flatMap((l) => l.standings.map((s) => s.entry)).filter((e) => e !== 3546875));
ok("rivals = union of standings minus Kwezi", [...allRivals].every((e) => L.rivals[String(e)]) && Object.keys(L.rivals).length === allRivals.size);
ok("rival picks 15 for event 3", Object.values(L.rivals).every((r) => r.event === 3 && r.picks.length === 15 && r.picks.every((p) => ["element","is_captain","multiplier","position"].every((k) => k in p))));

// draft
ok("draft keys", ["game","events","scoring","squad","elements","league_id"].every((k) => k in L.draft));
// The league half of the draft block (CONTRACT §3). Present in every snapshot, empty until a
// draft league id is supplied — so the app takes one code path either way.
const LEAGUE_KEYS = ["league","entries","ownership","rosters","freeAgents","matches","standings","picks","me","unjoined","unmappedOwners","counts"];
ok("draft league keys all present", LEAGUE_KEYS.every((k) => k in L.draft), LEAGUE_KEYS.filter((k) => !(k in L.draft)).join(",") || "");
// The shipped snapshot must carry no league id — Kwezi's is unknown and inventing one is a
// ledger offence. Any other file may legitimately carry a real league, so it is only checked
// for shape.
const SHIPPED = path.resolve(file) === path.resolve(path.join(__dirname, "live.json"));
if (SHIPPED) ok("draft league_id null in the shipped snapshot", L.draft.league_id === null, String(L.draft.league_id));
else ok("draft league_id is null or a positive integer", L.draft.league_id === null || (Number.isInteger(L.draft.league_id) && L.draft.league_id > 0), String(L.draft.league_id));
if (L.draft.league_id === null) {
  ok("no league id → every league field empty", L.draft.league === null && L.draft.entries.length === 0 &&
    L.draft.ownership.length === 0 && Object.keys(L.draft.rosters).length === 0 && L.draft.freeAgents.length === 0 &&
    L.draft.matches.length === 0 && L.draft.standings.length === 0 && Object.keys(L.draft.picks).length === 0 && L.draft.me === null);
} else {
  const owners = new Set(L.draft.entries.map((e) => e.leagueEntryId));
  ok("every ownership owner is a league entry of this league",
    L.draft.ownership.every((r) => r.owner === null || owners.has(r.owner)));
  ok("free agents are unowned and available",
    L.draft.freeAgents.every((c) => { const r = L.draft.ownership.find((x) => x.code === c); return r && r.owner === null && r.status === "a"; }));
}
ok("draft game next_event 4", L.draft.game.next_event === 4 && "waivers_processed" in L.draft.game);
const dEv4 = L.draft.events.find((e) => e.id === 4);
ok("draft GW4 waivers 2026-09-11T12:30:00Z", dEv4 && dEv4.waivers_time === "2026-09-11T12:30:00Z", dEv4 && dEv4.waivers_time);
ok("draft scoring GKP goal 10, bonus applied", L.draft.scoring.goals_scored_GKP === 10 && L.draft.scoring.bonus === 1);
ok("draft elements carry code", L.draft.elements.every((e) => Number.isInteger(e.code) && ["id","code","web_name","team","element_type","status","chance","news","starts","minutes","total_points"].every((k) => k in e)));
const classicByCode = new Map(L.elements.map((e) => [e.code, e]));
const joined = L.draft.elements.filter((d) => classicByCode.has(d.code)).length;
const idDiff = L.draft.elements.filter((d) => classicByCode.has(d.code) && classicByCode.get(d.code).id !== d.id).length;
ok(`draft joins to classic on code (${joined}/${L.draft.elements.length})`, joined === L.draft.elements.length);
// Reported, not frozen: the recorded figure was 59 of 655 on 11 Sep 2026 and the game has
// since added a player (E-064). What must hold is that the shift is real and every element joins.
ok(`draft id != classic id for ${idDiff} of ${L.draft.elements.length} players`, idDiff > 0);
const teamMismatch = L.draft.elements.filter((d) => classicByCode.has(d.code) && classicByCode.get(d.code).team !== d.team).length;
ok("draft team ids agree with classic after code mapping", teamMismatch === 0, String(teamMismatch));

console.log(`SUITE validate_live ${pass}/${pass + fail} · ${Buffer.byteLength(text)} bytes · ${path.relative(process.cwd(), file)}`);
process.exit(fail ? 1 : 0);

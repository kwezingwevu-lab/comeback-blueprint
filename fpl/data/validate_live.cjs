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
// frozen-ok: the Premier League is twenty clubs. That is the competition's shape, not an
// observation of one pull, and if it ever changes the whole model changes with it.
ok("20 teams", L.teams.length === 20, String(L.teams.length));
ok(">=600 elements", L.elements.length >= 600, String(L.elements.length));
// E-084 (a recurrence of E-064): these were frozen to the 11 September snapshot ("1,2,3", 79 rivals, ft 3, GW4).
// A refreshed snapshot that was entirely correct turned eleven of them red. What is invariant
// is the snapshot's internal consistency with its own events, history and picks; the gameweek
// numbers are not. verify.sh reconciles the same fields against the live API.
const finishedIds = L.events.filter((e) => e.finished).map((e) => e.id).sort((a, b) => a - b);
const gwIds = Object.keys(L.gw).map(Number).sort((a, b) => a - b);
ok("gw blocks are exactly the finished events", gwIds.join(",") === finishedIds.join(","), gwIds.join(",") + " vs events[finished] " + finishedIds.join(","));
const rivalUnion = new Set(L.leagues.flatMap((l) => l.standings.map((s) => s.entry)).filter((e) => e !== L.entry.id));
ok("every rival in the six leagues has a picks row and nobody else does",
  Object.keys(L.rivals).length === rivalUnion.size && [...rivalUnion].every((e) => L.rivals[String(e)]),
  Object.keys(L.rivals).length + " rival rows against a standings union of " + rivalUnion.size);
ok('no "ep_" substring', !text.includes("ep_"));
ok("ft_available is an integer within the cap of 5", Number.isInteger(L.ft_available) && L.ft_available >= 0 && L.ft_available <= 5, String(L.ft_available));
const nextEv = L.events.find((e) => e.is_next);
const curEv = L.events.find((e) => e.is_current);
ok("next_event is events[is_next] and one past current_event",
  !!nextEv && L.next_event === nextEv.id && L.next_event === L.current_event + 1,
  "next_event " + L.next_event + ", events[is_next] " + (nextEv ? nextEv.id : "none") + ", current_event " + L.current_event);
ok("the next deadline is ISO UTC, unfinished, and later than every finished deadline",
  !!nextEv && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(nextEv.deadline_time) && nextEv.finished === false &&
  L.events.filter((e) => e.finished).every((e) => Date.parse(e.deadline_time) < Date.parse(nextEv.deadline_time)),
  nextEv ? nextEv.deadline_time : "no is_next event");
ok("current_event is events[is_current] and is finished",
  !!curEv && L.current_event === curEv.id && curEv.finished === true,
  "current_event " + L.current_event + ", events[is_current] " + (curEv ? curEv.id + (curEv.finished ? " finished" : " NOT finished") : "none"));
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
// frozen-ok: twenty clubs playing thirty-eight rounds is 380 fixtures. Derived from the
// competition's shape rather than from this pull.
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
ok("history carries one row per played gameweek, in order",
  L.history.current.length === L.current_event && L.history.current.every((h, i) => h.event === i + 1),
  L.history.current.length + " rows for current_event " + L.current_event);
ok("history keys", L.history.current.every((h) => ["event","points","total_points","rank","overall_rank","bank","value","event_transfers","event_transfers_cost","points_on_bench"].every((k) => k in h)));
ok("chips array", Array.isArray(L.history.chips));
const pickKeys = Object.keys(L.picks).map(Number).sort((a, b) => a - b);
ok("picks cover GW1 to current_event", pickKeys.join(",") === Array.from({ length: L.current_event }, (_, i) => i + 1).join(","), pickKeys.join(","));
const pickSet = (g) => new Set(L.picks[String(g)].picks.map((p) => p.element));
// A fifteen changes only where the history says a transfer was made, or a wildcard or free hit
// was played. This ties picks to history instead of freezing one week's ids.
const chipWeeks = new Set(L.history.chips.filter((c) => c.name === "wildcard" || c.name === "freehit").map((c) => c.event));
const churn = [];
for (let g = 2; g <= L.current_event; g++) {
  const a = pickSet(g - 1), b = pickSet(g);
  const moved = [...b].filter((x) => !a.has(x)).length;
  const row = L.history.current.find((h) => h.event === g) || { event_transfers: 0 };
  if (!chipWeeks.has(g) && moved !== row.event_transfers) churn.push("GW" + g + ": " + moved + " players in against event_transfers " + row.event_transfers);
}
ok("every change of fifteen is a transfer the history records", churn.length === 0, churn.join("; ") || "GW1–GW" + L.current_event + " reconcile");
const lastPicks = L.picks[String(L.current_event)].picks;
const posOf = new Map(L.elements.map((e) => [e.id, e.element_type]));
const shape = [0, 0, 0, 0, 0];
lastPicks.forEach((p) => { shape[posOf.get(p.element)]++; });
ok("the latest fifteen is 2-5-5-3 with one captain and one vice",
  shape.slice(1).join("-") === "2-5-5-3" && lastPicks.filter((p) => p.is_captain).length === 1 &&
  lastPicks.filter((p) => p.is_vice_captain).length === 1 && lastPicks.filter((p) => p.multiplier >= 1).length === 11,
  "shape " + shape.slice(1).join("-") + ", " + lastPicks.filter((p) => p.multiplier >= 1).length + " starters");
ok("picks have 15 with position/multiplier/captain flags", Object.values(L.picks).every((p) => p.picks.length === 15 && p.picks.every((x) => "position" in x && "multiplier" in x && typeof x.is_captain === "boolean" && typeof x.is_vice_captain === "boolean") && "active_chip" in p));

// leagues / rivals
// The six league IDs are stable; their sizes are not — mini-leagues gain and lose entries
// every week, and the §3 sizes were a September observation (E-084).
const WANT_IDS = [26474, 512550, 512557, 989793, 1314671, 1683215];
// Derived, not frozen: the fetcher pulls exactly the league ids it is configured with, so the
// count is that list's length. He can join a seventh mini-league tomorrow and only WANT_IDS
// changes (E-084).
ok("leagues = the configured id list", L.leagues.length === WANT_IDS.length, L.leagues.length + " of " + WANT_IDS.length);
ok("league ids = §3", L.leagues.map((l) => l.id).sort((a, b) => a - b).join(",") === WANT_IDS.join(","), L.leagues.map((l) => l.id).join(","));
ok("every league's size is its standings length", L.leagues.every((l) => l.size === l.standings.length && l.size >= 1), L.leagues.map((l) => `${l.id}:${l.size}`).join(" "));
ok("league rank/last_rank numbers", L.leagues.every((l) => Number.isInteger(l.rank) && Number.isInteger(l.last_rank)), L.leagues.map((l) => `${l.name} ${l.rank}/${l.last_rank}`).join(" · "));
// The standings row is {entry, entry_name, total, rank} and nothing else. player_name used to be
// asserted PRESENT here, which is how 84 rival managers' names came to be committed with a green
// suite (ERRORS.md E-085). qa/privacy.cjs is the belt; this is the braces.
const STANDINGS_KEYS = ["entry","entry_name","total","rank"];
ok("standings keys exact", L.leagues.every((l) => l.standings.every((s) =>
  STANDINGS_KEYS.every((k) => k in s) && Object.keys(s).length === STANDINGS_KEYS.length)));
ok("Kwezi not a rival", !("3546875" in L.rivals));
ok("rival picks are fifteen for the current event", Object.values(L.rivals).every((r) => r.event === L.current_event && r.picks.length === 15 && r.picks.every((p) => ["element","is_captain","multiplier","position"].every((k) => k in p))), "event " + [...new Set(Object.values(L.rivals).map((r) => r.event))].join(","));

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
  // frozen-ok: zero is emptiness, not a count. This asserts the shape the snapshot carries when
  // no draft league id has been supplied, so the app takes the same code path either way.
  ok("no league id → every league field empty", L.draft.league === null && L.draft.entries.length === 0 &&
    L.draft.ownership.length === 0 && Object.keys(L.draft.rosters).length === 0 && L.draft.freeAgents.length === 0 &&
    // frozen-ok: as above — this is one assertion across three lines.
    L.draft.matches.length === 0 && L.draft.standings.length === 0 && Object.keys(L.draft.picks).length === 0 && L.draft.me === null);
} else {
  const owners = new Set(L.draft.entries.map((e) => e.leagueEntryId));
  ok("every ownership owner is a league entry of this league",
    L.draft.ownership.every((r) => r.owner === null || owners.has(r.owner)));
  ok("free agents are unowned and available",
    L.draft.freeAgents.every((c) => { const r = L.draft.ownership.find((x) => x.code === c); return r && r.owner === null && r.status === "a"; }));
}
ok("the draft game is on the same next event as the classic game", L.draft.game.next_event === L.next_event && "waivers_processed" in L.draft.game, "draft " + L.draft.game.next_event + " vs classic " + L.next_event);
const dNext = L.draft.events.find((e) => e.id === L.next_event);
const waiverLead = dNext && nextEv ? (Date.parse(nextEv.deadline_time) - Date.parse(dNext.waivers_time)) / 3600000 : null;
ok("draft waivers process between 0 and 48 hours before the classic deadline",
  !!dNext && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(dNext.waivers_time) && waiverLead > 0 && waiverLead <= 48,
  dNext ? dNext.waivers_time + ", " + (waiverLead === null ? "?" : waiverLead.toFixed(1)) + "h before " + nextEv.deadline_time : "no draft event " + L.next_event);
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

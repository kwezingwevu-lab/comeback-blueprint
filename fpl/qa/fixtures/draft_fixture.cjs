/*
 * qa/fixtures/draft_fixture.cjs — recorded draft-league responses, replayed offline.
 *
 * The files in qa/fixtures/draft/ are verbatim public responses captured on
 * 11 September 2026 (MANIFEST.json lists every URL and the capture time). No suite
 * ever calls the draft API: it calls the same shaping function data/fetch_live.cjs
 * calls, on these bytes, so a suite cannot pass against a copy of the shaping code
 * that the fetcher does not run.
 *
 * League 1  "Garth Crooks Fan Club Draft" — 14 teams, 15 each, and three teams whose
 *           league-entry id differs from their entry id (the E-063 trap).
 * League 100 "STL Misfits - Season 10"    — 10 teams, one of them with entry_id null
 *           and no waiver pick (nobody claimed the seat).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const DIR = __dirname + path.sep + "draft";
const { shapeDraftLeague } = require(path.join(ROOT, "data", "draft_league.cjs"));

function readJson(file) { return JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")); }
function manifest() { return readJson("MANIFEST.json"); }

/* The raw recorded bodies for one league, exactly as the endpoints returned them. */
function raw(leagueId) {
  const details = readJson("league_" + leagueId + "_details.json");
  const status = readJson("league_" + leagueId + "_status.json");
  const gw = Number(manifest().current_event) || 0;
  const picks = {};
  for (const e of details.league_entries) {
    if (!e.entry_id) continue;
    const f = "entry_" + e.entry_id + "_event_" + gw + ".json";
    if (fs.existsSync(path.join(DIR, f))) picks[String(e.entry_id)] = readJson(f);
  }
  return { details: details, status: status, picks: picks, gw: gw };
}

/* The CONTRACT §3 league block, shaped by the production function. */
function leagueBlock(live, leagueId, opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const r = raw(leagueId);
  return shapeDraftLeague({
    details: r.details, status: r.status, picks: r.picks,
    elements: live.draft.elements, leagueId: leagueId,
    meEntryId: o.meEntryId, meName: o.meName, event: r.gw,
  });
}

/* A copy of a live snapshot with that league block in it. */
function withLeague(live, leagueId, opts) {
  const out = JSON.parse(JSON.stringify(live));
  Object.assign(out.draft, leagueBlock(live, leagueId, opts));
  out.draft.league_id = leagueId;
  return out;
}

/* …and with a chosen team named as the manager's own, for the paths that need one. */
function asTeam(live, leagueId, leagueEntryId) {
  const out = withLeague(live, leagueId, {});
  const row = out.draft.entries.filter(function (e) { return e.leagueEntryId === leagueEntryId; })[0];
  out.draft.me = row ? { leagueEntryId: row.leagueEntryId, entryId: row.entryId, via: "fixture" } : null;
  return out;
}

module.exports = { DIR: DIR, readJson: readJson, manifest: manifest, raw: raw, leagueBlock: leagueBlock, withLeague: withLeague, asTeam: asTeam };

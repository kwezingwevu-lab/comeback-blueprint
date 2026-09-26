#!/usr/bin/env node
/*
 * data/scrub.cjs — remove rival managers' personal identity before anything is written to disk.
 *
 *   const { scrubNames, NAME_KEYS } = require("./scrub.cjs");
 *   fs.writeFileSync(out, JSON.stringify(scrubNames(payload)));
 *
 * The rule (v110 §1.5): commit entry ids, team names and squad picks only — never
 * `player_first_name`, `player_last_name`, `player_name` or initials. The FPL and Draft APIs
 * hand personal names back on every league endpoint, so a writer that keeps whatever the feed
 * gave it commits 84 real people's names without anyone deciding to. That is what happened
 * (ERRORS.md E-085), and it went unnoticed because the interface never rendered them: the rule
 * is about committing, not about rendering. A display-time filter would leave the names on
 * disk, in the built page and in git history, so the scrub happens at the write.
 *
 * INITIALS ARE PART OF THE RULE, AND `short_name` IS NOT ALWAYS INITIALS
 *   A Draft league entry's `short_name` is the manager's initials — "KN", "MB", "TM". A Classic
 *   team's `short_name` is a football club: "ARS", "LIV". The same key, two entirely different
 *   things, and dropping it blindly would take the club abbreviations the whole app is built on.
 *   So `short_name` is dropped only from an object that also identifies a league entry — one
 *   carrying `entry_id`, `entry_name` or `waiver_pick`. The reference snapshot bakes its league
 *   entries as {lid, eid, name, waiver}, which is the same decision reached independently.
 *
 * What survives, because the app needs it: `entry_id`, `entry`, `entry_name`, `waiver_pick`
 * (the waiver order is read off that field, never re-derived from rank) and every team field.
 *
 * Pure: returns a new structure and never mutates its input, so a caller can still read the raw
 * feed afterwards — the fetch reconciles ids against it.
 */
"use strict";

/* Dropped wherever they appear. */
const NAME_KEYS = ["player_first_name", "player_last_name", "player_name"];

/* Dropped only from an object that identifies a league entry. */
const INITIALS_KEY = "short_name";
const ENTRY_MARKERS = ["entry_id", "entry_name", "waiver_pick"];

const DROP = new Set(NAME_KEYS);

function isLeagueEntry(o) {
  for (const m of ENTRY_MARKERS) if (Object.prototype.hasOwnProperty.call(o, m)) return true;
  return false;
}

function scrubNames(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrubNames);
  const entry = isLeagueEntry(value);
  const out = {};
  for (const k of Object.keys(value)) {
    if (DROP.has(k)) continue;
    if (entry && k === INITIALS_KEY) continue;
    out[k] = scrubNames(value[k]);
  }
  return out;
}

module.exports = { scrubNames, NAME_KEYS, INITIALS_KEY, ENTRY_MARKERS, isLeagueEntry };

#!/usr/bin/env node
/*
 * data/draft_league.cjs — turns the four public draft-league endpoints into the
 * CONTRACT §3 `draft` league block. Pure: no network, no filesystem, no clock.
 *
 * It is required by data/fetch_live.cjs (which does the transport) and by the QA
 * suites (which replay recorded responses from qa/fixtures/draft/). One
 * implementation, so a suite can never pass against a copy of the shaping code
 * that the fetcher does not run.
 *
 *   shapeDraftLeague({ details, status, picks, elements, leagueId, meEntryId, meName })
 *
 * details   league/{id}/details          {league, league_entries[], matches[], standings[]}
 * status    league/{id}/element-status   {element_status[{element, owner, status}]}
 * picks     {"<entryId>": entry/{entryId}/event/{gw} }                       optional
 * elements  the draft bootstrap elements [{id, code}]  — the ONLY place draft element
 *           ids are turned into codes (ERRORS.md E-026: draft ids differ from classic
 *           ids for 59 of 655 players; everything downstream keys on code)
 * meEntryId the manager's own draft ENTRY id, when he supplied one
 *
 * element_status[].owner is an ENTRY id (E-063) and is translated to a league-entry id
 * here, so `ownership[].owner` and the keys of `rosters` are league-entry ids throughout.
 * meName    {first, last} — the fallback resolution, matched case-insensitively
 *
 * Two id spaces are kept apart by their names throughout:
 *   leagueEntryId  league_entries[].id       — what standings and matches speak
 *   entryId        league_entries[].entry_id — what entry/{id}/… speaks (can be null)
 */
"use strict";

function intOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.trunc(n) > 0 ? Math.trunc(n) : null;
}
function numOr0(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function str(v) { return v === null || v === undefined ? "" : String(v); }

function codeMap(elements) {
  const m = new Map();
  for (const e of Array.isArray(elements) ? elements : []) {
    if (!e || typeof e !== "object") continue;
    const id = intOrNull(e.id), code = intOrNull(e.code);
    if (id && code) m.set(id, code);
  }
  return m;
}

function shapeDraftLeague(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const details = o.details && typeof o.details === "object" ? o.details : null;
  const status = o.status && typeof o.status === "object" ? o.status : null;
  const byId = codeMap(o.elements);

  const out = {
    league_id: intOrNull(o.leagueId),
    league: null,
    entries: [],
    ownership: [],
    rosters: {},
    freeAgents: [],
    matches: [],
    standings: [],
    picks: {},
    me: null,
    unjoined: 0,
    unmappedOwners: 0,
    counts: { entries: 0, owned: 0, unowned: 0, freeAgents: 0, unjoined: 0, unmappedOwners: 0 },
  };
  if (!details) return out;

  const L = details.league && typeof details.league === "object" ? details.league : {};
  const entries = Array.isArray(details.league_entries) ? details.league_entries : [];
  out.league_id = out.league_id || intOrNull(L.id);
  out.league = {
    id: intOrNull(L.id),
    name: str(L.name),
    scoring: str(L.scoring),
    size: entries.length,
    draft_status: str(L.draft_status),
    trades: str(L.trades),
    transaction_mode: str(L.transaction_mode),
  };

  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const leagueEntryId = intOrNull(e.id);
    if (!leagueEntryId) continue;
    out.entries.push({
      leagueEntryId,
      entryId: intOrNull(e.entry_id),
      name: str(e.entry_name),
      manager: (str(e.player_first_name) + " " + str(e.player_last_name)).trim(),
      shortName: str(e.short_name),
      waiverPick: intOrNull(e.waiver_pick),
    });
  }
  out.counts.entries = out.entries.length;

  // element_status[].owner is the ENTRY id, not the league-entry id. Checked against both
  // recorded leagues: in league 100 seven of nine owner values are not league-entry ids at
  // all, and every owner value in both leagues is an entry_id (ERRORS.md E-063). Everything
  // downstream — standings, matches, rosters — speaks league-entry ids, so the translation
  // happens here, once, and an owner that cannot be translated is counted rather than guessed.
  const leagueEntryOfEntry = new Map();
  for (const e of out.entries) if (e.entryId) leagueEntryOfEntry.set(e.entryId, e.leagueEntryId);
  const knownLeagueEntry = new Set(out.entries.map((e) => e.leagueEntryId));

  // ownership, by code. A draft element the bootstrap does not carry (the draft game can
  // add a player between pulls) is counted, never guessed at.
  const rosters = new Map();
  if (status && Array.isArray(status.element_status)) {
    for (const row of status.element_status) {
      if (!row || typeof row !== "object") continue;
      const code = byId.get(intOrNull(row.element));
      if (!code) { out.unjoined++; continue; }
      const raw = intOrNull(row.owner);
      let owner = null;
      if (raw !== null) {
        owner = leagueEntryOfEntry.has(raw) ? leagueEntryOfEntry.get(raw) : (knownLeagueEntry.has(raw) ? raw : null);
        if (owner === null) out.unmappedOwners++;          // owned by a team this league does not list
      }
      const st = str(row.status);
      out.ownership.push({ code, owner, status: st, owned: raw !== null });
      if (raw !== null) {
        out.counts.owned++;
        if (owner) {
          if (!rosters.has(owner)) rosters.set(owner, []);
          rosters.get(owner).push(code);
        }
      } else {
        out.counts.unowned++;
        if (st === "a") out.freeAgents.push(code);        // free agent = unowned AND available
      }
    }
  }
  out.ownership.sort((a, b) => a.code - b.code);
  out.freeAgents.sort((a, b) => a - b);
  out.counts.freeAgents = out.freeAgents.length;
  out.counts.unjoined = out.unjoined;
  out.counts.unmappedOwners = out.unmappedOwners;
  for (const [owner, codes] of rosters) { codes.sort((a, b) => a - b); out.rosters[String(owner)] = codes; }

  for (const m of Array.isArray(details.matches) ? details.matches : []) {
    if (!m || typeof m !== "object") continue;
    out.matches.push({
      event: intOrNull(m.event) || 0,
      finished: !!m.finished,
      started: !!m.started,
      entry1: intOrNull(m.league_entry_1),
      points1: numOr0(m.league_entry_1_points),
      entry2: intOrNull(m.league_entry_2),
      points2: numOr0(m.league_entry_2_points),
      winner: intOrNull(m.winning_league_entry),
    });
  }

  for (const r of Array.isArray(details.standings) ? details.standings : []) {
    if (!r || typeof r !== "object") continue;
    out.standings.push({
      leagueEntry: intOrNull(r.league_entry),
      rank: intOrNull(r.rank) || 0,
      lastRank: intOrNull(r.last_rank) || 0,
      played: numOr0(r.matches_played),
      won: numOr0(r.matches_won),
      drawn: numOr0(r.matches_drawn),
      lost: numOr0(r.matches_lost),
      pointsFor: numOr0(r.points_for),
      pointsAgainst: numOr0(r.points_against),
      total: numOr0(r.total),
    });
  }

  // Per-team picks for one event, keyed by leagueEntryId and converted to codes.
  const entryToLeagueEntry = new Map();
  for (const e of out.entries) if (e.entryId) entryToLeagueEntry.set(e.entryId, e.leagueEntryId);
  const pk = o.picks && typeof o.picks === "object" ? o.picks : {};
  for (const key of Object.keys(pk)) {
    const entryId = intOrNull(key);
    const leagueEntryId = entryId ? entryToLeagueEntry.get(entryId) : null;
    const body = pk[key];
    if (!leagueEntryId || !body || !Array.isArray(body.picks)) continue;
    const rows = body.picks
      .filter((p) => p && typeof p === "object")
      .map((p) => ({ code: byId.get(intOrNull(p.element)) || null, position: intOrNull(p.position) || 0 }))
      .filter((p) => p.code)
      .sort((a, b) => a.position - b.position);
    out.picks[String(leagueEntryId)] = {
      event: intOrNull(body.event) || intOrNull(o.event) || 0,
      codes: rows.map((r) => r.code),
      xi: rows.filter((r) => r.position >= 1 && r.position <= 11).map((r) => r.code),
      bench: rows.filter((r) => r.position > 11).map((r) => r.code),
    };
  }

  // Which of these fourteen teams is his. The entry id is exact; the name is a fallback
  // and is only accepted when exactly one team matches it.
  const meEntryId = intOrNull(o.meEntryId);
  if (meEntryId) {
    const hit = out.entries.filter((e) => e.entryId === meEntryId)[0];
    if (hit) out.me = { leagueEntryId: hit.leagueEntryId, entryId: hit.entryId, via: "entry id" };
  }
  if (!out.me && o.meName && typeof o.meName === "object") {
    const want = (str(o.meName.first) + " " + str(o.meName.last)).trim().toLowerCase();
    if (want) {
      const hits = out.entries.filter((e) => e.manager.toLowerCase() === want);
      if (hits.length === 1) out.me = { leagueEntryId: hits[0].leagueEntryId, entryId: hits[0].entryId, via: "manager name" };
    }
  }
  return out;
}

/* The shape the snapshot carries when no league id has been supplied: every field
   present and empty, so the app's own code path is the same either way. */
function emptyDraftLeague() {
  return {
    league_id: null, league: null, entries: [], ownership: [], rosters: {}, freeAgents: [],
    matches: [], standings: [], picks: {}, me: null, unjoined: 0, unmappedOwners: 0,
    counts: { entries: 0, owned: 0, unowned: 0, freeAgents: 0, unjoined: 0, unmappedOwners: 0 },
  };
}

module.exports = { shapeDraftLeague, emptyDraftLeague, codeMap };

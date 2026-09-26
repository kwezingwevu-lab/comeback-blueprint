#!/usr/bin/env node
/*
 * qa/no_frozen.cjs — the rule that closes E-084 so it cannot recur.
 *
 *   node qa/no_frozen.cjs
 *
 * E-064 said: a count taken from a live source is reconciled against that source, never frozen.
 * Two gameweeks later E-084 happened anyway — eleven assertions in data/validate_live.cjs and
 * more in three suites compared a live-sourced field to a literal, and a snapshot refresh that
 * was entirely correct turned them red. A rule written in prose does not reach a file nobody
 * re-reads. This is the same rule expressed as something a machine checks.
 *
 * THE RULE
 *   No check compares a live-sourced field to a literal number or a literal ISO instant.
 *   Live-sourced means: written into data/live.json out of the API. Those values move every
 *   week — gameweek numbers, deadlines, free transfers, league sizes, prices, player totals —
 *   and an equality against a literal is a statement about one pull, not an invariant.
 *
 *   What to write instead: derive the expectation from the file under test (the gameweek keys
 *   ARE the finished events; the deadline IS the is_next event's own), or reconcile against the
 *   live API as qa/verify.sh does, or assert a range and REPORT the value in the detail string.
 *
 * THE ESCAPE HATCH, AND WHY IT IS NARROW
 *   A line may carry `frozen-ok: <reason>` in a comment on it or directly above it. Two cases
 *   deserve it: a constant that is a rule of the game rather than an observation (a squad is 15,
 *   a hit is 4, at most 3 per club), and a synthetic fixture built in the test itself, where the
 *   literal is the input and not an expectation. The reason is required, and this suite prints
 *   every exemption it honoured, so they stay visible instead of accumulating unread.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/* Fields that data/live.json carries straight out of the API (CONTRACT §3). */
const LIVE_FIELDS = [
  "next_event", "current_event", "ft_available", "fetched_at", "total_players",
  "deadline_time", "waivers_time", "average_entry_score",
  "now_cost", "cost_change_start", "cost_change_event", "selected_by_percent",
  "total_points", "summary_overall_points", "summary_overall_rank", "summary_event_points",
  "last_deadline_bank", "last_deadline_value", "last_deadline_total_transfers",
  "points_for", "points_against", "waiver_pick", "last_rank",
  "event_transfers", "event_transfers_cost", "points_on_bench"
];

/* Live-sourced collections whose length is an observation, not an invariant. */
const LIVE_COUNTS = [
  "L.leagues", "L.elements", "L.events", "L.fixtures", "L.rivals", "L.teams",
  "L.draft.elements", "L.draft.entries", "L.draft.standings", "L.draft.matches",
  "LIVE.leagues", "LIVE.elements", "LIVE.rivals", "LIVE.events"
];

/* ADJACENCY MATTERS. The first version of this detector matched a live field anywhere on the
   line and a literal anywhere after it, and it flagged ten legitimate lines for every real one:
   `is_current: g === 3` building a synthetic fixture, `r.event === L.current_event` where the
   literal belonged to a different clause, `churn.length === 0` on a locally computed array. A
   detector with that false-positive rate gets exemptions bolted onto it until it means nothing.
   So the field must sit IMMEDIATELY left of the comparison, and the literal immediately right. */
const LIT = '(?:"\\d{4}-\\d{2}-\\d{2}T[^"]*"|\'\\d{4}-\\d{2}-\\d{2}T[^\']*\'|-?\\d+(?:\\.\\d+)?)';
const FIELD_CMP_RE = new RegExp(
  "\\.(?:" + LIVE_FIELDS.join("|") + ")\\s*(?:===|==|!==|!=)\\s*" + LIT);
const COUNT_RE = new RegExp(
  "(?:" + LIVE_COUNTS.map((c) => c.replace(/\./g, "\\.")).join("|") +
  ")(?:\\.length|\\s*\\)\\s*\\.length)\\s*(?:===|==|!==|!=)\\s*-?\\d");
/* Object.keys(<live collection>).length === n, which is the same statement one call along. */
const KEYS_RE = new RegExp(
  "Object\\.keys\\(\\s*(?:" + LIVE_COUNTS.map((c) => c.replace(/\./g, "\\.")).join("|") +
  ")\\s*\\)\\.length\\s*(?:===|==|!==|!=)\\s*-?\\d");
const EXEMPT_RE = /frozen-ok:/;

/* Files in scope: the snapshot validator and the suites that assert on it. Not the engine, whose
   constants are the game's rules, and not build tooling. */
function scope() {
  const out = [];
  for (const dir of ["data", "qa"]) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!/\.(cjs|js)$/.test(f)) continue;
      if (f === "no_frozen.cjs") continue;            // it names the fields it forbids
      if (f === "harness.cjs" || f === "scrub.cjs") continue;
      out.push(path.join(dir, f));
    }
  }
  return out;
}

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};

/* Returns {hits:[{line,text,why}], exempt:[{line,reason}]} for one file's text. */
function scan(text) {
  const lines = text.split("\n");
  const hits = [], exempt = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;      // a comment is documentation, not a check
    /* The reason usually sits in a comment block above the line, not on it, so look up a few
       lines — stopping at the first line that is not a comment, so an exemption cannot drift
       onto a check it was never written for. */
    let prev = "";
    for (let k = i - 1; k >= 0 && k >= i - 4; k--) {
      if (!/^\s*(\/\/|\*|\/\*)/.test(lines[k])) break;
      prev += "\n" + lines[k];
    }
    let why = "";
    if (FIELD_CMP_RE.test(line)) why = "a live-sourced field compared to a literal";
    else if (COUNT_RE.test(line) || KEYS_RE.test(line)) why = "the length of a live-sourced collection compared to a literal";
    if (!why) continue;
    if (EXEMPT_RE.test(line) || EXEMPT_RE.test(prev)) {
      const src = EXEMPT_RE.test(line) ? line : prev;
      exempt.push({ line: i + 1, reason: (src.split("frozen-ok:")[1] || "").trim().slice(0, 70) });
      continue;
    }
    hits.push({ line: i + 1, text: line.trim().slice(0, 110), why: why });
  }
  return { hits: hits, exempt: exempt };
}

const files = scope();
ok("the scan reached the suites it is meant to check", files.length >= 8, files.length + " files: " + files.join(" "));
ok("data/validate_live.cjs is in scope", files.indexOf(path.join("data", "validate_live.cjs")) !== -1, files.join(" "));

let offenders = [], exemptions = [], scanned = 0;
for (const rel of files) {
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  scanned += text.length;
  const r = scan(text);
  for (const h of r.hits) offenders.push(rel + ":" + h.line + "  " + h.text + "   [" + h.why + "]");
  for (const e of r.exempt) exemptions.push(rel + ":" + e.line + "  frozen-ok: " + e.reason);
}
ok("the scan read the files rather than an empty list", scanned > 100000, scanned + " bytes");

if (exemptions.length) {
  console.log("     " + exemptions.length + " exemption(s) honoured, each with its reason:");
  for (const e of exemptions) console.log("       " + e);
}

ok("no check compares a live-sourced field or collection length to a literal (E-084)",
  offenders.length === 0,
  offenders.length + " line(s):\n       " + offenders.join("\n       "));

ok("every exemption states a reason",
  exemptions.every((e) => e.replace(/^.*frozen-ok:\s*/, "").length > 0),
  exemptions.filter((e) => !e.replace(/^.*frozen-ok:\s*/, "").length).join(" · "));

/* ---------------------------------------------------------------- mutation: it must be able to fail */
{
  const cases = [
    ['ok("next_event 4", L.next_event === 4, String(L.next_event));', true, "a gameweek number frozen"],
    ['ok("ft", L.ft_available === 3, "x");', true, "a free-transfer count frozen"],
    ['assert("deadline", nextEv.deadline_time === "2026-09-12T12:30:00Z");', true, "a deadline frozen"],
    ['ok("rivals", Object.keys(L.rivals).length === 79);', true, "a live collection length frozen"],
    ['ok("leagues", L.leagues.length === 6);', true, "another live collection length frozen"],
    ['ok("squad is fifteen", picks.length === 15);', false, "a rule of the game, not a live field"],
    ['// ok("next_event 4", L.next_event === 4);', false, "inside a comment"],
    ['ok("next_event", L.next_event === 4); // frozen-ok: replaying a recorded fixture', false, "exempted with a reason"],
    ['ok("derived", L.next_event === nextEv.id, String(L.next_event));', false, "derived from the file under test"],
    ['ok("ft in range", L.ft_available >= 0 && L.ft_available <= 5);', false, "a range, with the value reported"],
    ['events.push({ is_current: g === 3, is_next: g === 4, average_entry_score: 45 + g });', false, "building a synthetic fixture, not asserting"],
    ['ok("rival picks", every((r) => r.event === L.current_event && r.picks.length === 15));', false, "derived on the left, a game rule on the right"],
    ['ok("no churn", churn.length === 0, churn.join("; "));', false, "a locally computed array of violations"],
    ['el.total_points = 12;', false, "an assignment into a fixture, not a comparison"],
    ['ok("rivals", Object.keys(L.draft.entries).length === 8);', true, "Object.keys on a live collection"],
    ['ok("deadline", ev.deadline_time !== "2026-09-12T12:30:00Z");', true, "inequality against a frozen instant is the same statement"]
  ];
  let wrong = [];
  for (const [line, shouldFlag, label] of cases) {
    const flagged = scan(line).hits.length > 0;
    if (flagged !== shouldFlag) wrong.push((shouldFlag ? "missed" : "false positive") + ": " + label + " — " + line);
  }
  ok("the detector flags every frozen form and none of the legitimate ones (" + cases.length + " cases)",
    wrong.length === 0, wrong.join(" · "));
}

console.log("SUITE no_frozen " + pass + "/" + (pass + fail) + " · " + files.length + " files · " +
  offenders.length + " offender(s) · " + exemptions.length + " exemption(s)");
process.exit(fail ? 1 : 0);

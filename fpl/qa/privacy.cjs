#!/usr/bin/env node
/*
 * qa/privacy.cjs — the standing rule that rival managers' personal names are never committed.
 *
 *   node qa/privacy.cjs
 *
 * The rule (v110 §1.5, repeated in §6 and §7.14): commit entry ids, team names and squad picks
 * only. `player_first_name`, `player_last_name`, `player_name` and initials never land in the
 * repo. It is about committing, not about rendering: the interface never showed these names and
 * 84 of them were committed anyway, which is exactly why this suite exists (ERRORS.md E-085).
 *
 * WHAT IS IN SCOPE
 *   Committed data, built artefacts and test fixtures. Source files may name the keys — they
 *   have to, in order to delete them — so prose and code are not scanned for the key names.
 *   `reference/` is read-only and already scrubbed; it is scanned too, because a scrub that
 *   regressed upstream would show up there first.
 *   Two files in reference/live are the manager's OWN entry feeds, where the name is his own
 *   data and not a rival's; they are listed by name rather than waved through by a pattern.
 *
 * WHY THERE IS A MUTATION CHECK AT THE END
 *   A check that cannot fail is worse than no check, because it reads as proof. This suite
 *   plants a violation in a temporary file and asserts the scanner finds it, so a scanner that
 *   silently stops looking cannot pass (ERRORS.md E-070).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const KEYS = ["player_first_name", "player_last_name", "player_name"];
/* Quoted, single-quoted and BARE key positions. The bare form is not hypothetical: the built
   dist/index.html inlines its data block as a JavaScript object literal, so a regex that
   insisted on double quotes read that file as clean while it carried 115 names. */
const KEY_SRC = '(?:^|[^A-Za-z0-9_$])["\']?(' + KEYS.join("|") + ')["\']?\\s*:';
const keyRe = () => new RegExp(KEY_SRC, "g");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};

/* The manager's own entry feeds inside the read-only reference tree. His own name is his own
   data; the rule is about rivals. Anything else in reference/ is a rival feed and is scrubbed. */
const OWN_ENTRY_FEEDS = new Set([
  "reference/v109/live/entry.json",
  "reference/v109/live/dentry.json"
]);

/* Directories that never hold committed data. node_modules is vendored; reference/v110 is the
   governing prompt, which necessarily quotes the key names in its own privacy clause. */
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const SKIP_FILES = new Set(["reference/v110/UPDATE_PROMPT.md"]);

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full);
    const st = fs.lstatSync(full);
    if (st.isDirectory()) { walk(full, out); continue; }
    if (!st.isFile()) continue;
    if (SKIP_FILES.has(rel)) continue;
    out.push(rel);
  }
  return out;
}

/* Scan scope: data, state, built artefacts, fixtures, and the reference feeds. */
function inScope(rel) {
  if (OWN_ENTRY_FEEDS.has(rel)) return false;
  if (/^reference\//.test(rel)) return /\.json$/.test(rel);
  if (/^(data|state)\//.test(rel)) return /\.(json|js|cjs)$/.test(rel) && !/\/(fetch_live|draft_league|validate_live|scrub)\.cjs$/.test(rel);
  if (/^(app|dist)\//.test(rel)) return true;
  if (/^qa\/fixtures\//.test(rel)) return true;
  return false;
}

function hits(rel) {
  let text;
  try { text = fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch (e) { return null; }
  const m = text.match(keyRe());
  return { n: m ? m.length : 0, bytes: Buffer.byteLength(text) };
}

const all = walk(ROOT, []);
const scanned = all.filter(inScope);

/* A scan that looked at nothing would pass every assertion below. */
ok("the scan reached the files it is meant to check",
  scanned.length >= 8, scanned.length + " files in scope");
for (const must of ["data/live.json", "app/FPL_Mission_Control.jsx", "dist/index.html"]) {
  ok("in scope: " + must, scanned.indexOf(must) !== -1,
    fs.existsSync(path.join(ROOT, must)) ? "present on disk but not scanned" : "missing on disk");
}

let totalBytes = 0;
const offenders = [];
for (const rel of scanned) {
  const h = hits(rel);
  if (!h) continue;
  totalBytes += h.bytes;
  if (h.n > 0) offenders.push(rel + " (" + h.n + ")");
}
ok("the scan read a meaningful volume of data", totalBytes > 500000, totalBytes + " bytes read");
ok("no personal-name key in any committed data file, built artefact or fixture",
  offenders.length === 0, offenders.length + " file(s): " + offenders.join(", "));

/* Initials are named in the rule too. `short_name` cannot be grepped, because a Classic team's
   short_name is a club ("ARS") while a Draft league entry's is a manager's initials ("KN"), so
   this walks the parsed JSON and only objects that identify a league entry are offenders. */
function entryInitials(rel) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (e) { return null; }
  let n = 0;
  const seen = new Set();
  (function walkDoc(v) {
    if (v === null || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach(walkDoc); return; }
    const marks = ["entry_id", "entry_name", "waiver_pick"];
    let isEntry = false;
    for (const m of marks) if (Object.prototype.hasOwnProperty.call(v, m)) { isEntry = true; break; }
    if (isEntry && Object.prototype.hasOwnProperty.call(v, "short_name")) { n++; seen.add(String(v.short_name)); }
    for (const k of Object.keys(v)) walkDoc(v[k]);
  })(doc);
  return { n: n, seen: [...seen].slice(0, 8) };
}
const initialOffenders = [];
let jsonScanned = 0;
for (const rel of scanned) {
  if (!/\.json$/.test(rel)) continue;
  const r = entryInitials(rel);
  if (!r) continue;
  jsonScanned++;
  if (r.n > 0) initialOffenders.push(rel + " (" + r.n + ": " + r.seen.join(",") + ")");
}
ok("the initials scan parsed the JSON data files", jsonScanned >= 3, jsonScanned + " parsed");
ok("no league entry carries short_name, which is the manager's initials",
  initialOffenders.length === 0, initialOffenders.join(" · "));

/* The scrubber itself, so a regression in the writer fails here and not in a data review. */
let scrub = null;
try { scrub = require(path.join(ROOT, "data", "scrub.cjs")); } catch (e) { scrub = null; }
ok("data/scrub.cjs exports scrubNames", scrub && typeof scrub.scrubNames === "function",
  scrub ? "module loaded but scrubNames is " + typeof (scrub && scrub.scrubNames) : "module not found");

if (scrub && typeof scrub.scrubNames === "function") {
  const payload = {
    league_entries: [
      { id: 1, entry_id: 279275, entry_name: "Yoh-Nited", short_name: "KN", waiver_pick: 2, player_first_name: "Given", player_last_name: "Surname" },
      { id: 2, entry_id: 111111, entry_name: "Rival FC", short_name: "AB", waiver_pick: 1, player_first_name: "Other", player_last_name: "Person" }
    ],
    standings: [{ entry: 3546875, entry_name: "Kwezi's Team", player_name: "Given Surname", total: 311, rank: 4 }],
    nested: { deep: [[{ player_name: "Buried Deep" }]] }
  };
  const out = scrub.scrubNames(payload);
  const text = JSON.stringify(out);
  ok("scrubNames removes every personal-name key, however deeply nested",
    !keyRe().test(text), text.slice(0, 200));
  ok("scrubNames keeps entry ids", text.indexOf("279275") !== -1 && text.indexOf("3546875") !== -1);
  ok("scrubNames keeps team names", text.indexOf("Yoh-Nited") !== -1 && text.indexOf("Kwezi's Team") !== -1);
  ok("scrubNames keeps the field the waiver order is read from",
    text.indexOf('"waiver_pick":2') !== -1, text.slice(0, 200));
  ok("scrubNames drops a league entry's short_name, because those are the manager's initials",
    text.indexOf('"KN"') === -1 && text.indexOf('"AB"') === -1, text.slice(0, 300));
  const teams = scrub.scrubNames({ teams: [{ id: 1, short_name: "ARS", name: "Arsenal" }] });
  ok("scrubNames keeps a team's short_name, because that is a football club and not a person",
    teams.teams[0].short_name === "ARS", JSON.stringify(teams));
  ok("scrubNames does not mutate its input",
    typeof payload.standings[0].player_name === "string", "input was mutated");
  ok("scrubNames survives null and primitives",
    JSON.stringify(scrub.scrubNames(null)) === "null" && scrub.scrubNames(7) === 7 && scrub.scrubNames("x") === "x");
}

/* Mutation check: plant a violation and prove the scanner sees it. */
{
  const probes = [
    ["quoted JSON", "__privacy_probe__.json", JSON.stringify({ standings: [{ entry: 1, player_name: "Planted Name" }] })],
    ["bare key, as dist/ inlines it", "__privacy_probe_bare__.json", "{ standings: [{ entry: 1, player_name: \"Planted Name\" }] }"],
    ["single-quoted key", "__privacy_probe_sq__.json", "{ 'player_last_name': 'Planted' }"]
  ];
  for (const [label, name, body] of probes) {
    const planted = path.join(ROOT, "qa", "fixtures", name);
    fs.writeFileSync(planted, body);
    let seen = -1;
    try {
      const rel = path.relative(ROOT, planted);
      seen = inScope(rel) ? hits(rel).n : -2;
    } finally {
      fs.unlinkSync(planted);
    }
    ok("the scanner detects a planted violation — " + label,
      seen === 1, "found " + seen + " where 1 was planted");
  }
  /* The initials scan gets the same treatment: plant one, and prove a club is not mistaken
     for a person. */
  const initProbe = path.join(ROOT, "qa", "fixtures", "__privacy_initials__.json");
  fs.writeFileSync(initProbe, JSON.stringify({
    league_entries: [{ entry_id: 1, entry_name: "T", short_name: "ZZ", waiver_pick: 1 }],
    teams: [{ id: 1, short_name: "ARS", name: "Arsenal" }]
  }));
  let initSeen = null;
  try { initSeen = entryInitials(path.relative(ROOT, initProbe)); } finally { fs.unlinkSync(initProbe); }
  ok("the initials scan detects a planted league-entry short_name",
    initSeen && initSeen.n === 1 && initSeen.seen.join() === "ZZ",
    JSON.stringify(initSeen));

  /* And it must not fire on the words appearing in prose or in a variable name. */
  const innocent = path.join(ROOT, "qa", "fixtures", "__privacy_innocent__.json");
  fs.writeFileSync(innocent, '{ "note": "the writer deletes player_name before saving", "no_player_name_here": 1 }');
  let innocentHits = -1;
  try { innocentHits = hits(path.relative(ROOT, innocent)).n; } finally { fs.unlinkSync(innocent); }
  ok("the scanner does not fire on the key name used in prose or inside another identifier",
    innocentHits === 0, "found " + innocentHits);
}

console.log("SUITE privacy " + pass + "/" + (pass + fail) + " · " + scanned.length + " files · " + totalBytes + " bytes");
process.exit(fail ? 1 : 0);

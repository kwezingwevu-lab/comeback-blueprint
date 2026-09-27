#!/usr/bin/env node
// Strips rivals' personal names out of a copy of the feed folder before it is zipped.
// The manager's own two files keep his own name, because bake.js reads it for the Classic header.
// Everything else loses player_first_name / player_last_name / player_name outright, and loses
// short_name only where the object is a Draft entry (there short_name is a person's initials;
// on a Classic team object it is a club, "ARS", and must survive).
"use strict";
const fs = require("fs"), path = require("path");
const NAME_KEYS = ["player_first_name", "player_last_name", "player_name"];
const OWN = new Set(["entry.json", "dentry.json"]);   // the manager's own entries, not rivals'
const isDraftEntry = (o) => "entry_id" in o || "entry_name" in o || "waiver_pick" in o;

let dropped = 0;
function scrub(node, keepOwnNames) {
  if (Array.isArray(node)) { node.forEach((v) => scrub(v, keepOwnNames)); return; }
  if (!node || typeof node !== "object") return;
  if (!keepOwnNames) for (const k of NAME_KEYS) if (k in node) { delete node[k]; dropped++; }
  if ("short_name" in node && isDraftEntry(node)) { delete node.short_name; dropped++; }
  for (const v of Object.values(node)) scrub(v, keepOwnNames);
}

const dir = process.argv[2];
if (!dir) { console.error("usage: node scrub.js <dir>"); process.exit(2); }
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
for (const f of files) {
  const p = path.join(dir, f);
  let j; try { j = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { console.log(`skip ${f}: ${e.message}`); continue; }
  const before = dropped;
  scrub(j, OWN.has(f));
  if (dropped > before) { fs.writeFileSync(p, JSON.stringify(j)); console.log(`${f}: ${dropped - before} field(s) removed`); }
}

// Audit: re-read every file and prove the keys are gone everywhere but the two own-entry files.
let bad = 0;
for (const f of files) {
  const txt = fs.readFileSync(path.join(dir, f), "utf8");
  for (const k of NAME_KEYS) if (txt.includes(`"${k}"`) && !OWN.has(f)) { console.log(`STILL PRESENT ${f} ${k}`); bad++; }
}
console.log(`scrub: ${files.length} files, ${dropped} fields removed, ${bad} offenders`);
process.exit(bad ? 1 : 0);

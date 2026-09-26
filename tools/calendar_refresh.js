#!/usr/bin/env node
/* Calendar refresh helper for The Comeback Blueprint.
   Re-reads the RaceSpace Gauteng month listings, diffs them against RACES_12M in src/app_full.js and writes a
   report for a human to approve. It NEVER edits the app: every change goes in by hand (or through a Claude session)
   with the source line the app shows under each event. Distances are computed from HOME_LL, never typed.

   Usage
     node tools/calendar_refresh.js                      next 12 months, 30 km, writes calendar-report.md
     node tools/calendar_refresh.js --months 6 --radius 45 --out /tmp/report.md
     node tools/calendar_refresh.js --geocode            also look up unknown venues on OpenStreetMap (approximate, 1 request/s)
     node tools/calendar_refresh.js --json               print the raw diff as JSON instead of Markdown
     node tools/calendar_refresh.js --selftest           offline parser + matcher check against qa/fixtures (used by qa/all.sh)
*/
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const ARGS = process.argv.slice(2);
const opt = (k, d) => { const i = ARGS.indexOf("--" + k); return i < 0 ? d : (ARGS[i + 1] && !ARGS[i + 1].startsWith("--") ? ARGS[i + 1] : true); };
const MONTHS = +opt("months", 12), RADIUS = +opt("radius", 30), OUT = opt("out", path.join(ROOT, "calendar-report.md"));
const GEOCODE = !!opt("geocode", false), JSON_OUT = !!opt("json", false), SELFTEST = !!opt("selftest", false);
const UA = "ComebackBlueprint-calendar-helper/1.0 (personal training app; one user)";
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- the app's own data ----------
function loadApp(file) {
  const src = fs.readFileSync(file, "utf8");
  const a = src.indexOf("const RACES_12M=["), b = src.indexOf("\n];", a);
  if (a < 0 || b < 0) throw new Error("RACES_12M not found in " + file);
  const races = Function('"use strict";return (' + src.slice(a + "const RACES_12M=".length, b + 2) + ");")();
  const m = src.match(/const HOME_LL=\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/);
  if (!m) throw new Error("HOME_LL not found");
  return { races, home: [+m[1], +m[2]] };
}
// same maths as havKm() in the app, so the report and the app always agree
function havKm(a, b) { if (!a || !b) return null; const R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(x))); }
function parseDates(s) { const m = String(s || "").match(/(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
  if (!m) return null; const mo = String(MON.indexOf(m[3].slice(0, 3).toLowerCase()) + 1).padStart(2, "0"), p = d => m[4] + "-" + mo + "-" + String(d).padStart(2, "0");
  return { start: p(m[1]), end: p(m[2] || m[1]) }; }
function todaySAST() { return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }); }

// ---------- RaceSpace listing parser ----------
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = s => String(s).replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (w, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? w)).replace(/\s+/g, " ").trim();
function parseListing(html) {
  const out = [];
  html.split(/<div class="race-card\s*"/).slice(1).forEach(chunk => {
    const href = (chunk.match(/href="(\/race\/[^"]+)"/) || [])[1], name = (chunk.match(/race-card__section-title">([^<]+)</) || [])[1];
    if (!href || !name) return;
    const type = (chunk.match(/race-card__content">\s*([^<]+?)\s*<\/div>/) || [])[1] || "";
    const spans = [...chunk.matchAll(/<span>([^<]+)<\/span>/g)].map(x => decode(x[1]));
    const price = (chunk.match(/From ZAR\s*([\d ,.]+)/) || [])[1];
    const dates = parseDates(spans[0]);
    out.push({ name: decode(name), url: "https://www.racespace.co.za" + href, type: decode(type), dateText: spans[0] || "", date: dates && dates.start, dateEnd: dates && dates.end, venue: spans[1] || "", distances: spans[2] || "", price: price ? "R" + price.replace(/[ ,]/g, "").replace(/\.00$/, "") : null });
  });
  return out;
}
async function fetchText(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
  try { const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html,application/json" }, signal: ctl.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); }
  finally { clearTimeout(t); }
}
async function readMonth(y, m, problems) {
  const base = `https://www.racespace.co.za/races/all/gauteng/${y}/${String(m).padStart(2, "0")}`, seen = new Map();
  for (let page = 1; page <= 8; page++) {
    let html; try { html = await fetchText(page === 1 ? base : base + "?page=" + page); } catch (e) { problems.push(`${base}?page=${page}: ${e.message}`); break; }
    const cards = parseListing(html); let fresh = 0;
    cards.forEach(c => { if (!seen.has(c.url)) { seen.set(c.url, c); fresh++; } });
    if (!fresh || !html.includes("?page=" + (page + 1))) break;
    await sleep(400);
  }
  return [...seen.values()];
}

// ---------- matching ----------
const STOP = new Set("the a an of and at in on for with race races run runs running fun walk km k by presented x".split(" "));
const toks = s => new Set(String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\d+(\.\d+)?\s*km\b/g, " ").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w && !STOP.has(w) && !/^\d+$/.test(w)));
const jac = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; a.forEach(x => { if (b.has(x)) n++; }); return n / (a.size + b.size - n); };
function matchApp(card, races) {
  const ct = toks(card.name); let best = null;
  races.forEach(r => { if (r.st === "weekly") return; const d = parseDates(r.d), j = jac(ct, toks(r.name)), same = !!(d && card.date && card.date >= d.start && card.date <= d.end);
    const score = j + (same ? 0.3 : 0); if ((j >= 0.5 || (j >= 0.34 && same)) && (!best || score > best.score)) best = { r, score, sameDate: same, appDates: d }; });
  return best;
}
function gazetteer(races) { return races.filter(r => r.co).map(r => ({ t: toks(r.km || ""), co: r.co, from: r.name })); }
// containment, not Jaccard: "Marks Park, Judith Rd, Emmarentia" must match the app's "Marks Park, Emmarentia"
function venueCoords(venue, gaz) { const vt = toks(venue); let best = null; gaz.forEach(g => { if (!g.t.size || !vt.size) return; let n = 0; g.t.forEach(x => { if (vt.has(x)) n++; });
  const j = n / Math.min(g.t.size, vt.size); if (n >= 2 && j >= 0.75 && (!best || j > best.j)) best = { j, co: g.co, from: g.from }; }); return best; }
// OpenStreetMap search, most specific first: the full venue, then its first + last parts, then the town alone
// (a town centre is marked as such: good enough to say "outside 30 km", never good enough to add an event)
async function geocode(venue, problems) {
  const parts = venue.split(",").map(x => x.trim()).filter(Boolean), tries = [[venue, "venue"]];
  if (parts.length > 2) tries.push([parts[0] + ", " + parts[parts.length - 1], "venue, approximate"]);
  if (parts.length > 1) tries.push([parts[parts.length - 1], "town centre only"]);
  for (const [q, how] of tries) {
    try { const j = JSON.parse(await fetchText(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", Gauteng, South Africa")}&format=json&countrycodes=za&limit=1`)); await sleep(1100);
      if (j[0]) return { co: [+(+j[0].lat).toFixed(6), +(+j[0].lon).toFixed(6)], label: how + ": " + j[0].display_name }; }
    catch (e) { problems.push("geocode " + q + ": " + e.message); return null; }
  }
  return null;
}

// ---------- diff ----------
async function diff(cards, app, today, opts) {
  const gaz = gazetteer(app.races), res = { changed: [], confirmedOk: [], newNear: [], newUnknown: [], newFar: [], missing: [], problems: opts.problems || [] }, hit = new Set();
  for (const c of cards) {
    if (c.date && c.date < today) continue;
    const m = matchApp(c, app.races);
    if (m) { hit.add(m.r.name); const appStart = m.appDates && m.appDates.start;
      if (!m.sameDate) res.changed.push({ app: m.r.name, appDate: m.r.d, appStatus: m.r.st, listing: c });
      else res.confirmedOk.push({ app: m.r.name, listing: c });
      continue; }
    let co = null, how = null; const g = venueCoords(c.venue, gaz);
    if (g) { co = g.co; how = "venue already in the app (" + g.from + ")"; }
    else if (opts.geocode && c.venue) { const x = await geocode(c.venue, res.problems); if (x) { co = x.co; how = "OpenStreetMap search, approximate: " + x.label; } }
    const km = havKm(app.home, co), row = Object.assign({}, c, { co, coFrom: how, km });
    if (km == null) res.newUnknown.push(row); else if (km <= opts.radius) res.newNear.push(row); else res.newFar.push(row);
  }
  const last = opts.lastMonth;
  app.races.forEach(r => { const d = parseDates(r.d); if (r.st !== "confirmed" || !d || d.end < today || d.start.slice(0, 7) > last || hit.has(r.name)) return;
    const km = havKm(app.home, r.co); if (km != null && km > opts.radius + 15) return; res.missing.push({ name: r.name, d: r.d, src: r.src || "", km }); });
  const byDate = (a, b) => String(a.date || a.listing?.date || "").localeCompare(String(b.date || b.listing?.date || ""));
  ["changed", "confirmedOk", "newNear", "newUnknown", "newFar"].forEach(k => res[k].sort(byDate));
  return res;
}

// ---------- report ----------
const cell = s => String(s == null ? "" : s).replace(/\|/g, "/").replace(/\n/g, " ");
function report(res, meta) {
  const L = [`# Calendar refresh — ${meta.today}`, "",
    `Source: RaceSpace Gauteng month listings, ${meta.months} months from ${meta.today} (${meta.cards} listings read). Radius ${meta.radius} km from HOME_LL.`, "",
    "**Nothing in the app was changed.** Each row below is a candidate for a human to approve. To apply one, edit `RACES_12M` in `src/app_full.js` by hand: set `co` from a venue you checked, `st:\"confirmed\"` only when the organiser or listing shows the date, and `src:\"RaceSpace, checked <date>\"`. Then run `bash qa/run.sh`.", ""];
  L.push(`## 1. Events the app lists whose RaceSpace date differs (${res.changed.length})`, "");
  if (res.changed.length) { L.push("| App entry | App date · status | RaceSpace date | RaceSpace venue | From | Listing |", "|---|---|---|---|---|---|");
    res.changed.forEach(x => L.push(`| ${cell(x.app)} | ${cell(x.appDate)} · ${x.appStatus} | ${cell(x.listing.dateText)} | ${cell(x.listing.venue)} | ${cell(x.listing.price || "")} | ${x.listing.url} |`)); }
  else L.push("None — every matched listing agrees with the app's date.");
  L.push("", `## 2. On RaceSpace, not in the app, within ${meta.radius} km (${res.newNear.length})`, "");
  if (res.newNear.length) { L.push("| Date | Event | Type | Venue | Distances | From | ~km | Coordinates from | Listing |", "|---|---|---|---|---|---|---|---|---|");
    res.newNear.forEach(x => L.push(`| ${cell(x.dateText)} | ${cell(x.name)} | ${cell(x.type)} | ${cell(x.venue)} | ${cell(x.distances)} | ${cell(x.price || "")} | ${x.km} | ${cell(x.coFrom)} | ${x.url} |`)); }
  else L.push("None.");
  L.push("", `## 3. On RaceSpace, not in the app, distance unknown (${res.newUnknown.length})`, "", "The venue is not in the app yet" + (meta.geocode ? " and OpenStreetMap found nothing" : " — re-run with `--geocode`, or find the venue by hand") + ". Never guess a distance.", "");
  res.newUnknown.forEach(x => L.push(`- ${cell(x.dateText)} — **${cell(x.name)}** (${cell(x.type)}) · ${cell(x.venue)} · ${cell(x.distances)}${x.price ? " · from " + x.price : ""} · ${x.url}`));
  L.push("", `## 4. On RaceSpace, outside ${meta.radius} km (${res.newFar.length})`, "");
  res.newFar.forEach(x => L.push(`- ${cell(x.dateText)} — ${cell(x.name)} · ${cell(x.venue)} · ~${x.km} km`));
  L.push("", `## 5. Confirmed app events in this window that RaceSpace does not list (${res.missing.length})`, "", "Not an error on its own: many are listed only by the organiser, Entry Ninja or Webtickets. Re-open the source named on each entry.", "");
  res.missing.forEach(x => L.push(`- ${cell(x.d)} — ${cell(x.name)}${x.km != null ? " (~" + x.km + " km)" : ""} · last source: ${cell(x.src)}`));
  L.push("", `## 6. Matched and unchanged (${res.confirmedOk.length})`, "");
  res.confirmedOk.forEach(x => L.push(`- ${cell(x.listing.dateText)} — ${cell(x.app)}${x.listing.price ? " · RaceSpace from " + x.listing.price : ""}`));
  if (res.problems.length) { L.push("", "## Fetch problems — the listing above may be incomplete", ""); res.problems.forEach(p => L.push("- " + cell(p))); }
  return L.join("\n") + "\n";
}

// ---------- self-test (offline, used by qa/all.sh) ----------
function selftest() {
  const fx = path.join(ROOT, "qa/fixtures/racespace-gauteng-2026-10.html"), cards = parseListing(fs.readFileSync(fx, "utf8")), app = loadApp(path.join(ROOT, "src/app_full.js"));
  const R = []; const T = (n, ok, d) => R.push({ n, ok: !!ok, d });
  const fat = cards.find(c => /Fat Cats/.test(c.name)), owl = cards.find(c => /Owl Project/.test(c.name));
  T("parser reads every card with a name, a /race/ link and a date", cards.length >= 4 && cards.every(c => c.name && /\/race\//.test(c.url) && /^\d{4}-\d{2}-\d{2}$/.test(c.date)), JSON.stringify(cards.map(c => c.name + "|" + c.date)));
  T("parser reads venue, distances and price (Fat Cats 10K, 11 Oct, Mall of Africa, from R90)", fat && fat.date === "2026-10-11" && /Mall of Africa/.test(fat.venue) && /10km/.test(fat.distances) && fat.price === "R90", JSON.stringify(fat));
  T("entities decode (&amp; becomes &)", cards.every(c => !/&amp;/.test(c.name + c.venue)), "");
  const mf = matchApp(fat, app.races), mo = matchApp(owl, app.races);
  T("matcher pairs listings with the app's own entries on name + date", mf && mf.r.name === "Fat Cats 10K" && mf.sameDate && mo && /Owl Project/.test(mo.r.name) && mo.sameDate, JSON.stringify([mf && mf.r.name, mo && mo.r.name]));
  T("distances use HOME_LL and the app's maths (Fat Cats ~16 km)", havKm(app.home, [-26.015085, 28.1073947]) === 16, "");
  const g = venueCoords("Mall of Africa, Waterfall City", gazetteer(app.races));
  T("venues already in the app give coordinates without any lookup", g && Math.abs(g.co[0] + 26.015) < 0.01, JSON.stringify(g));
  const g2 = venueCoords("Marks Park, Judith Rd, Emmarentia, Randburg", gazetteer(app.races));
  T("a longer street address still finds a venue the app knows (containment match)", g2 && Math.abs(g2.co[0] + 26.166) < 0.01, JSON.stringify(g2));
  T("the helper never writes to src/app_full.js", !/writeFileSync\([^)]*app_full/.test(fs.readFileSync(__filename, "utf8")), "");
  const bad = R.filter(x => !x.ok); bad.forEach(x => console.log("FAIL: " + x.n + " → " + x.d));
  console.log(bad.length ? "CALENDAR HELPER SELFTEST FAILED" : "CALENDAR HELPER SELFTEST PASS"); console.log("CALENDAR HELPER RESULT: " + (R.length - bad.length) + "/" + R.length);
  process.exit(bad.length ? 1 : 0);
}

// ---------- main ----------
(async () => {
  if (SELFTEST) return selftest();
  const app = loadApp(path.join(ROOT, "src/app_full.js")), today = todaySAST(), problems = [];
  let [y, m] = today.split("-").map(Number), cards = [], lastMonth = today.slice(0, 7);
  for (let i = 0; i < MONTHS; i++) { process.stderr.write(`reading ${y}-${String(m).padStart(2, "0")}…\n`); cards = cards.concat(await readMonth(y, m, problems)); lastMonth = `${y}-${String(m).padStart(2, "0")}`; m++; if (m > 12) { m = 1; y++; } await sleep(400); }
  const uniq = [...new Map(cards.map(c => [c.url + "|" + c.date, c])).values()];
  const res = await diff(uniq, app, today, { radius: RADIUS, geocode: GEOCODE, problems, lastMonth });
  if (JSON_OUT) { process.stdout.write(JSON.stringify({ today, radius: RADIUS, months: MONTHS, cards: uniq.length, ...res }, null, 1) + "\n"); return; }
  const md = report(res, { today, months: MONTHS, radius: RADIUS, cards: uniq.length, geocode: GEOCODE });
  if (OUT === "-") process.stdout.write(md); else { fs.writeFileSync(OUT, md); console.log(`Report written to ${path.relative(process.cwd(), OUT) || OUT}: ${res.changed.length} date differences, ${res.newNear.length} new within ${RADIUS} km, ${res.newUnknown.length} unknown distance, ${res.missing.length} app events not on RaceSpace. Nothing in the app was changed.`); }
})().catch(e => { console.error("calendar helper failed: " + e.message); process.exit(2); });

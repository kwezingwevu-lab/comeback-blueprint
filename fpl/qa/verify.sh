#!/usr/bin/env bash
# qa/verify.sh — the reconciliation gate (CLAUDE.md H1 "verify" row).
#
#   11 live reconciliations  — the shipped snapshot and the app's own numbers against
#                              a fresh pull of the public API. Skipped, loudly, when the
#                              network is unreachable; the SUITE line says so.
#   22 static invariants     — things that must hold whether or not the network is up,
#                              I1..I22 below, one of which is the esbuild syntax gate.
#   ---
#   33 checks
#
# The arithmetic, spelled out so nobody has to guess: the master prompt lists nine
# invariant sentences, two of which name two artefacts each (banned fields in the
# assembled app AND in data/live.json; account-touching URLs in src AND in the shipped
# app), and one of which is the tdz scan — 11 checks. esbuild is the twelfth. v88 added
# I13..I16 (imports survive the assembler; the shell style block carries no hex; the
# draft-league block; the recorded draft fixtures) for 16, and the header still said 23
# until v89 corrected it. v89 adds I17..I22 for the PWA — the manifest, worker and icons
# exist and parse; the colours are the --bg token; the registration guard is executed
# rather than grepped; the worker precaches this build only; every manifest-named file is
# in the worker SHELL; and nothing the app ships is excluded by a gitignore rule
# (E-076): 11 + 22 = 33.
#
# Every check prints "PASS <name> — <detail>" or "FAIL <name> — <detail>", and the last
# line is "SUITE verify <pass>/<total>". Exit 1 on any FAIL.
#
# Run from fpl/:  bash qa/verify.sh

set -uo pipefail

cd "$(dirname "$0")/.." || { echo "FAIL verify — cannot reach the fpl/ directory"; echo "SUITE verify 0/31"; exit 1; }
ROOT="$PWD"

ENTRY=3546875
API="https://fantasy.premierleague.com/api"
DRAFT_API="https://draft.premierleague.com/api"
CURL_OPTS=(-sS --max-time 30 --retry 1 --retry-delay 1)

PASS=0
FAIL=0
SKIP=0
declare -a RED=()

ok()   { PASS=$((PASS + 1)); echo "PASS $1${2:+ — $2}"; }
bad()  { FAIL=$((FAIL + 1)); RED+=("$1"); echo "FAIL $1 — ${2:-no detail given}"; }
skip() { SKIP=$((SKIP + 1)); echo "SKIP live (offline) — $1"; }

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# ---------------------------------------------------------------- fresh pull

OFFLINE=0
OFFLINE_WHY=""

fetch() {  # fetch <url> <file>
  curl "${CURL_OPTS[@]}" -o "$TMP/$2" "$1" >/dev/null 2>"$TMP/curl.err" || return 1
  [ -s "$TMP/$2" ] || return 1
  head -c 1 "$TMP/$2" | grep -q '[{[]' || return 1
  return 0
}

if ! fetch "$API/bootstrap-static/" bootstrap.json; then
  OFFLINE=1
  OFFLINE_WHY="$(tr -d '\r' < "$TMP/curl.err" 2>/dev/null | head -1)"
  [ -n "$OFFLINE_WHY" ] || OFFLINE_WHY="bootstrap-static did not return JSON"
fi

if [ "$OFFLINE" -eq 0 ]; then
  fetch "$DRAFT_API/bootstrap-static" draft.json   || OFFLINE=1
  fetch "$API/entry/$ENTRY/" entry.json            || OFFLINE=1
  fetch "$API/entry/$ENTRY/history/" history.json  || OFFLINE=1
  if [ "$OFFLINE" -eq 1 ] && [ -z "$OFFLINE_WHY" ]; then OFFLINE_WHY="an endpoint beyond bootstrap-static did not answer"; fi
fi

if [ "$OFFLINE" -eq 0 ]; then
  # The six winnable leagues, read from the committed state so the list is never retyped.
  LEAGUE_IDS="$(node -e 'const s=require("./state/kwezi.json");process.stdout.write((s.leagues||[]).join(" "))')"
  for lid in $LEAGUE_IDS; do
    fetch "$API/leagues-classic/$lid/standings/" "league_$lid.json" || { OFFLINE=1; OFFLINE_WHY="league $lid standings did not answer"; break; }
  done
fi

# ---------------------------------------------------------------- the live check script
# One node file, one check per invocation: it prints a single detail line and exits 0/1,
# so the bash side keeps the counting and the PASS/FAIL vocabulary in one place.

cat > "$TMP/live_checks.cjs" <<'NODEEOF'
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = process.env.MC_ROOT;
const TMP = process.env.MC_TMP;
const ENTRY = Number(process.env.MC_ENTRY);

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const tmp = (f) => read(path.join(TMP, f));
const LIVE = read(path.join(ROOT, "data", "live.json"));
const STATE = read(path.join(ROOT, "state", "kwezi.json"));
const E = require(path.join(ROOT, "src", "engine.js"));
const WEEKLY = new Function(fs.readFileSync(path.join(ROOT, "data", "weekly.js"), "utf8") + "\nreturn WEEKLY;")();

const BOOT = tmp("bootstrap.json");
const NOW = new Date().toISOString();
const ctx = E.buildCtx(LIVE, STATE, NOW);

const bootById = new Map(BOOT.elements.map((e) => [Number(e.id), e]));
const liveById = new Map(LIVE.elements.map((e) => [Number(e.id), e]));
const nameOf = (id) => (liveById.get(id) ? liveById.get(id).web_name : bootById.get(id) ? bootById.get(id).web_name : "id " + id);

// Every player the app can put on screen as part of a plan: the saved fifteen, the
// written wildcard fifteen and its captain and vice, the written fallback moves, and
// the fifteen plus buys the engine itself proposes from this snapshot.
function planIds() {
  const s = new Set();
  (STATE.squad || []).forEach((p) => s.add(Number(p.id)));
  const c = WEEKLY.classic || {};
  (c.wildcard15 || []).forEach((id) => s.add(Number(id)));
  if (c.captain) s.add(Number(c.captain));
  if (c.vice) s.add(Number(c.vice));
  ((c.fallback && c.fallback.moves) || []).forEach((m) => { s.add(Number(m.out)); s.add(Number(m.in)); });
  try {
    const wc = E.wildcardSolver(ctx, {});
    if (wc.ok) wc.ids.forEach((id) => s.add(Number(id)));
    const tp = E.transferProtocol(null, ctx);
    tp.moves.forEach((m) => { s.add(Number(m.out)); s.add(Number(m.in)); });
  } catch (e) { /* the static set still stands */ }
  return [...s].filter((id) => isFinite(id)).sort((a, b) => a - b);
}

const nextFromBoot = () => BOOT.events.filter((e) => e.is_next)[0] || null;

const CHECKS = {
  prices() {
    const ids = planIds();
    const bad = [];
    ids.forEach((id) => {
      const l = liveById.get(id), b = bootById.get(id);
      if (!l) { bad.push(nameOf(id) + " (" + id + ") is not in the snapshot"); return; }
      if (!b) { bad.push(nameOf(id) + " (" + id + ") is not in the live API"); return; }
      if (Number(l.now_cost) !== Number(b.now_cost)) bad.push(nameOf(id) + " snapshot " + l.now_cost + " vs live " + b.now_cost);
    });
    return { ok: !bad.length, detail: ids.length + " squad and plan players priced exactly" + (bad.length ? "; drift: " + bad.join("; ") : "") };
  },
  ownership() {
    let worst = 0, who = "";
    let n = 0;
    LIVE.elements.forEach((l) => {
      const b = bootById.get(Number(l.id));
      if (!b) return;
      n++;
      const d = Math.abs(Number(l.selected_by_percent) - Number(b.selected_by_percent));
      if (d > worst) { worst = d; who = l.web_name; }
    });
    return { ok: worst <= 1.5, detail: "largest ownership drift over " + n + " players " + worst.toFixed(2) + "pp (" + who + "), gate 1.50pp" };
  },
  freshness() {
    const t = Date.parse(LIVE.fetched_at);
    if (!isFinite(t)) return { ok: false, detail: "fetched_at is not a date: " + String(LIVE.fetched_at) };
    const hours = (Date.now() - t) / 3600000;
    return { ok: hours <= 24 * 7, detail: "snapshot taken " + LIVE.fetched_at + ", age " + hours.toFixed(1) + "h (" + (hours / 24).toFixed(2) + " days), gate 7 days" };
  },
  deadline() {
    const n = nextFromBoot();
    if (!n) return { ok: false, detail: "the live API has no is_next event" };
    const shown = ctx.deadline;
    return { ok: shown === n.deadline_time, detail: "app deadline " + String(shown) + " vs live events[is_next] " + n.deadline_time };
  },
  nextevent() {
    const n = nextFromBoot();
    if (!n) return { ok: false, detail: "the live API has no is_next event" };
    const okSnap = Number(LIVE.next_event) === Number(n.id);
    const okCtx = Number(ctx.nextEvent) === Number(n.id);
    return { ok: okSnap && okCtx, detail: "live is_next GW" + n.id + ", snapshot next_event " + LIVE.next_event + ", app GW" + ctx.nextEvent };
  },
  leagues() {
    const ids = (STATE.leagues || []).map(Number);
    const bad = [];
    ids.forEach((id) => {
      const f = path.join(TMP, "league_" + id + ".json");
      if (!fs.existsSync(f)) { bad.push(id + " not fetched"); return; }
      const L = read(f);
      const snap = (LIVE.leagues || []).filter((x) => Number(x.id) === id)[0];
      if (!snap) { bad.push(id + " missing from the snapshot"); return; }
      if (!L.league || Number(L.league.id) !== id) { bad.push(id + " no longer exists"); return; }
      const size = ((L.standings && L.standings.results) || []).length;
      if (size !== Number(snap.size)) bad.push(id + " " + snap.name + " size " + snap.size + " → " + size);
    });
    return { ok: ids.length === 6 && !bad.length, detail: ids.length + " league ids checked, sizes " + (LIVE.leagues || []).map((l) => l.size).join("/") + (bad.length ? "; " + bad.join("; ") : "") };
  },
  entry() {
    const en = tmp("entry.json");
    const pts = Number(en.summary_overall_points), rank = Number(en.summary_overall_rank);
    const present = isFinite(pts) && isFinite(rank) && rank > 0 && Number(en.id) === ENTRY;
    const samePts = pts === Number(LIVE.entry.summary_overall_points);
    const drift = rank - Number(LIVE.entry.summary_overall_rank);
    return { ok: present && samePts, detail: "entry " + ENTRY + " " + pts + " points, rank " + rank + " (snapshot " + LIVE.entry.summary_overall_points + " / " + LIVE.entry.summary_overall_rank + ", rank drift " + drift + ")" };
  },
  flags() {
    const ids = planIds();
    const bad = [];
    ids.forEach((id) => {
      const l = liveById.get(id), b = bootById.get(id);
      if (!l || !b) { bad.push(nameOf(id) + " missing on one side"); return; }
      const lc = l.chance === undefined ? null : l.chance;
      const bc = b.chance_of_playing_next_round === undefined ? null : b.chance_of_playing_next_round;
      if (String(l.status) !== String(b.status)) bad.push(nameOf(id) + " status " + l.status + " → " + b.status);
      else if (lc !== bc) bad.push(nameOf(id) + " chance " + String(lc) + " → " + String(bc));
    });
    const flagged = ids.filter((id) => { const b = bootById.get(id); return b && (b.status !== "a" || (b.chance_of_playing_next_round !== null && b.chance_of_playing_next_round < 100)); });
    return { ok: !bad.length, detail: ids.length + " plan players match live status/chance; flagged live: " + (flagged.map((id) => nameOf(id) + " " + bootById.get(id).status + " " + bootById.get(id).chance_of_playing_next_round).join(", ") || "none") + (bad.length ? "; drift: " + bad.join("; ") : "") };
  },
  waivers() {
    const D = tmp("draft.json");
    const nextEv = Number(LIVE.next_event);
    const rows = (D.events && D.events.data) || [];
    const live = rows.filter((e) => Number(e.id) === nextEv)[0];
    const snap = ((LIVE.draft && LIVE.draft.events) || []).filter((e) => Number(e.id) === nextEv)[0];
    if (!live) return { ok: false, detail: "the draft API has no event " + nextEv };
    if (!snap) return { ok: false, detail: "the snapshot has no draft event " + nextEv };
    return { ok: String(snap.waivers_time) === String(live.waivers_time), detail: "GW" + nextEv + " waivers snapshot " + snap.waivers_time + " vs draft API " + live.waivers_time };
  },
  finished() {
    const liveFinished = BOOT.events.filter((e) => e.finished).length;
    const snapFinished = LIVE.events.filter((e) => e.finished).length;
    const gwBlocks = Object.keys(LIVE.gw || {}).length;
    return { ok: liveFinished === snapFinished && gwBlocks === liveFinished, detail: "live API " + liveFinished + " finished gameweeks, snapshot " + snapFinished + ", gw blocks " + gwBlocks };
  },
  ft() {
    const H = tmp("history.json");
    const cur = Number(LIVE.current_event);
    const derived = E.ftAvailable({ current: H.current, chips: H.chips }, cur);
    return { ok: Number(derived) === Number(LIVE.ft_available), detail: "derived from the live history " + derived + ", snapshot ft_available " + LIVE.ft_available + " (through GW" + cur + ")" };
  }
};

const key = process.argv[2];
const fn = CHECKS[key];
if (!fn) { console.log("no such check: " + key); process.exit(1); }
let r;
try { r = fn(); } catch (e) { console.log("threw: " + (e && e.message ? e.message : String(e))); process.exit(1); }
console.log(r.detail);
process.exit(r.ok ? 0 : 1);
NODEEOF

live_chk() {  # live_chk <name> <key>
  if [ "$OFFLINE" -eq 1 ]; then skip "$1"; return; fi
  local out rc
  out="$(MC_ROOT="$ROOT" MC_TMP="$TMP" MC_ENTRY="$ENTRY" node "$TMP/live_checks.cjs" "$2" 2>&1)"
  rc=$?
  out="$(printf '%s' "$out" | tail -1)"
  if [ $rc -eq 0 ]; then ok "$1" "$out"; else bad "$1" "$out"; fi
}

echo "------------------------------------------------------------"
if [ "$OFFLINE" -eq 1 ]; then
  echo "SKIP live (offline) — $OFFLINE_WHY"
else
  echo "live pull: bootstrap-static, draft bootstrap-static, entry $ENTRY, history, six league standings"
fi

live_chk "live-prices-exact-for-every-squad-and-plan-player"  prices
live_chk "live-ownership-drift-within-1.5pp"                  ownership
live_chk "live-snapshot-freshness-under-7-days"               freshness
live_chk "live-deadline-equals-events-is-next"                deadline
live_chk "live-next-event-matches"                            nextevent
live_chk "live-six-league-ids-exist-at-the-same-size"         leagues
live_chk "live-entry-3546875-points-and-rank-present"         entry
live_chk "live-plan-player-status-and-chance-match"           flags
live_chk "live-draft-waivers-time-matches-the-draft-api"      waivers
live_chk "live-finished-gameweek-count-matches"               finished
live_chk "live-ft-available-still-derives-the-same"           ft

# ---------------------------------------------------------------- static invariants

echo "------------------------------------------------------------"

APP="app/FPL_Mission_Control.jsx"
DIST="dist/index.html"

# I1 · banned fields absent from the assembled app (D1: ep_this/ep_next are opaque and never read)
if [ ! -f "$APP" ]; then
  bad "banned-fields-absent-from-the-assembled-app" "$APP does not exist"
else
  hits="$(grep -c -e 'ep_this' -e 'ep_next' "$APP" || true)"
  if [ "$hits" = "0" ]; then ok "banned-fields-absent-from-the-assembled-app" "no ep_this/ep_next in $APP"
  else bad "banned-fields-absent-from-the-assembled-app" "$hits line(s) mention ep_this/ep_next: $(grep -n -e 'ep_this' -e 'ep_next' "$APP" | head -3 | tr '\n' ' ')"; fi
fi

# I2 · banned fields absent from the shipped snapshot (CONTRACT §3)
if [ ! -f data/live.json ]; then
  bad "banned-fields-absent-from-live-json" "data/live.json does not exist"
else
  hits="$(grep -c -e 'ep_this' -e 'ep_next' data/live.json || true)"
  if [ "$hits" = "0" ]; then ok "banned-fields-absent-from-live-json" "no ep_this/ep_next in data/live.json ($(wc -c < data/live.json) bytes)"
  else bad "banned-fields-absent-from-live-json" "$hits occurrence(s) in data/live.json"; fi
fi

# I3 · no account-touching call in the authored sources (D4 invariant)
acct="$(grep -rn -e '/my-team/' -e '/transfers/' -e 'login' src/ 2>/dev/null | head -3 || true)"
if [ -z "$acct" ]; then ok "no-account-touching-url-in-src" "no /my-team/, /transfers/ or login in src/"
else bad "no-account-touching-url-in-src" "$(printf '%s' "$acct" | tr '\n' ' ')"; fi

# I4 · and none in what actually ships
acct2="$(grep -n -e '/my-team/' -e '/transfers/' -e 'login' "$APP" "$DIST" 2>/dev/null | head -3 || true)"
if [ -z "$acct2" ]; then ok "no-account-touching-url-in-the-shipped-app" "clean in $APP and $DIST"
else bad "no-account-touching-url-in-the-shipped-app" "$(printf '%s' "$acct2" | tr '\n' ' ')"; fi

# I5 · the six CONTRACT §2 markers, once each, in order
markers_out="$(node -e '
const fs=require("fs");
const M=["// ENGINE — START","// ENGINE — END","// WEEKLY STRATEGY ENGINE — START","// WEEKLY STRATEGY ENGINE — END","// LIVE DATA — START","// LIVE DATA — END"];
const f="app/FPL_Mission_Control.jsx";
if(!fs.existsSync(f)){console.log(f+" does not exist");process.exit(1);}
const s=fs.readFileSync(f,"utf8");
const at=[],bad=[];
M.forEach(m=>{const n=s.split(m).length-1; if(n!==1) bad.push(m+" ×"+n); at.push(s.indexOf(m));});
const ordered=at.every((v,i)=>i===0||v>at[i-1]);
if(!ordered) bad.push("markers out of order");
console.log(bad.length?bad.join("; "):"six markers, one each, in order at "+at.join("/"));
process.exit(bad.length?1:0);' 2>&1 | tail -1)"
if printf '%s' "$markers_out" | grep -q "six markers"; then ok "six-contract-markers-exactly-once-and-in-order" "$markers_out"
else bad "six-contract-markers-exactly-once-and-in-order" "$markers_out"; fi

# I6 · APP_VERSION stamped, and equal to package.json's major
ver_out="$(node -e '
const fs=require("fs");
const pkg=require("./package.json");
const want="v"+String(pkg.version).split(".")[0];
const f="app/FPL_Mission_Control.jsx";
if(!fs.existsSync(f)){console.log(f+" does not exist");process.exit(1);}
const s=fs.readFileSync(f,"utf8");
const m=s.match(/const APP_VERSION = "(v[0-9]+)";/);
if(!m){console.log("no APP_VERSION stamp in "+f);process.exit(1);}
const distOk=!fs.existsSync("dist/index.html")||fs.readFileSync("dist/index.html","utf8").includes(want);
console.log("APP_VERSION "+m[1]+", package.json "+pkg.version+" → "+want+(distOk?", dist stamped":", dist NOT stamped"));
process.exit(m[1]===want&&distOk?0:1);' 2>&1 | tail -1)"
if printf '%s' "$ver_out" | grep -q "dist stamped"; then ok "app-version-stamped-and-equals-package-major" "$ver_out"
else bad "app-version-stamped-and-equals-package-major" "$ver_out"; fi

# I7 · every suite named by CONTRACT §1 is present in qa/ (E-014: a workspace reset once wiped them)
missing=""
present=0
for s in run.sh harness.cjs verify.sh tdz_check.cjs unit_engine.cjs smoke.cjs smoke_wk.cjs realistic.cjs buttons.cjs webkit.js mc_full.cjs mc_all.cjs; do
  if [ -f "qa/$s" ]; then present=$((present + 1)); else missing="$missing $s"; fi
done
if [ -z "$missing" ]; then ok "every-suite-file-present-in-qa" "$present of 12 suite files present"
else bad "every-suite-file-present-in-qa" "$present of 12 present; missing:$missing"; fi

# I8 · what ships was built from the sources as they stand — compared by content, not by clock
#
# This check was `find src data build.cjs -newer dist/index.html`. Four faults, each measured:
#   · mtime is not content. Append a line to src/engine.js, do not rebuild, then touch
#     dist/index.html: the old form went GREEN on a page that was missing that line. Any
#     `cp -p`, checkout or touch could hand it a fresh clock over a stale artefact.
#   · it over-reached. `find data` covers data/validate_live.cjs and data/fetch_live.cjs,
#     which the build never reads, so touching a validator reported the page as stale.
#   · it under-reached. It never looked at app/FPL_Mission_Control.jsx, so a build that
#     assembled the app and then died before writing the page read GREEN.
#   · its verdict moved under its own feet — red inside a gate run, green seconds later by
#     hand, because a second overlapping gate rebuilt dist/ in between. Both readings were
#     true of the clock at the instant they were taken; neither was a reading of the artefact.
#
# CONTRACT §2 fixes the assembled file as a verbatim concatenation, so the comparison below is
# exact: the engine, the weekly block and the ui body must stand in app/FPL_Mission_Control.jsx
# byte for byte, and the LIVE literal must parse to the same data as data/live.json. It reads
# 1.1 MB of sources against the 1.1 MB app in 40 ms, and no clock can flatter it.
#
# dist/index.html is esbuild output, which cannot be compared to its input without restating
# build.cjs's bundler options here — a second copy that would call a fresh page stale the day
# those options change. That last hop stays a clock comparison, and only between the two files
# one build writes in a fixed order, so a build landing inside the same second (or the same
# nanosecond) is green: only the app strictly newer than the page is a fault.
#
# Nothing here is tolerated away. The whole check is simply taken a second time, unchanged, if
# the first reading is red: build.cjs writes the app 0.82-0.90 s before the page (five builds
# measured, whole build 0.94-1.00 s), so a sample taken inside ANOTHER gate's build sees the
# app ahead of the page, or catches the 1.1 MB app half-written. Four seconds is over four
# times the longest build measured here; a real fault is still there afterwards, a build in
# flight is not. Do not turn this into a tolerance on the gap itself — and the proper cure for
# overlapping runs is a lock in qa/run.sh, not a wait here.
i8_probe() { node -e 'const fs = require("fs");
const APP = "app/FPL_Mission_Control.jsx";
const DIST = "dist/index.html";
const bad = [];
const note = [];
const need = [APP, DIST, "src/engine.js", "src/ui.jsx", "data/weekly.js", "data/live.json", "build.cjs"];
for (const f of need) {
  if (!fs.existsSync(f)) { console.log(f + " does not exist"); process.exit(1); }
  if (fs.statSync(f).size === 0) { console.log(f + " is empty"); process.exit(1); }
}
const app = fs.readFileSync(APP, "utf8");
function between(a, b) {
  const i = app.indexOf(a), j = app.indexOf(b);
  if (i < 0 || j < 0 || j < i) { console.log("marker missing or out of order in " + APP + ": " + a + " / " + b); process.exit(1); }
  return app.slice(i + a.length, j).trim();
}
function same(label, shipped, source) {
  if (shipped === source) { note.push(label + " " + source.length + "B verbatim"); return; }
  let k = 0;
  const n = Math.min(shipped.length, source.length);
  while (k < n && shipped[k] === source[k]) k++;
  bad.push(label + " differs from byte " + k + " (source " + source.length + "B, shipped " + shipped.length + "B)");
}
same("engine", between("// ENGINE — START", "// ENGINE — END"), fs.readFileSync("src/engine.js", "utf8").trim());
same("weekly", between("// WEEKLY STRATEGY ENGINE — START", "// WEEKLY STRATEGY ENGINE — END"), fs.readFileSync("data/weekly.js", "utf8").trim());
const liveBlock = between("// LIVE DATA — START", "// LIVE DATA — END");
const head = "const LIVE = ";
if (!liveBlock.startsWith(head) || !liveBlock.endsWith(";")) {
  bad.push("the LIVE block is not one " + head + "<literal>; statement");
} else {
  let shipped = null, source = null;
  try { shipped = JSON.stringify(JSON.parse(liveBlock.slice(head.length, -1))); } catch (e) { bad.push("the shipped LIVE literal does not parse as JSON: " + e.message); }
  try { source = JSON.stringify(JSON.parse(fs.readFileSync("data/live.json", "utf8"))); } catch (e) { bad.push("data/live.json does not parse as JSON: " + e.message); }
  if (shipped && source) same("live", shipped, source);
}
/* The ui body, lifted the way build.cjs lifts it: blank lines, comments and imports off the top,
   and everything from the first other statement on is the body (CONTRACT section 2 item 5). */
const lines = fs.readFileSync("src/ui.jsx", "utf8").split("\n");
let k = 0;
for (; k < lines.length; k++) {
  const t = lines[k].trim();
  if (t === "" || t.startsWith("//") || t.startsWith("import ")) continue;
  break;
}
const uiBody = lines.slice(k).join("\n").trim();
if (app.indexOf(uiBody) >= 0) note.push("ui body " + uiBody.length + "B verbatim");
else bad.push("the src/ui.jsx body after its imports (" + uiBody.length + "B) is not in " + APP + " verbatim");
/* The one hop no content comparison reaches: esbuild output against its input. Both files come
   out of one build.cjs run, the assembled app first, so only the app NEWER than the page is a
   fault, and equal timestamps pass. build.cjs is held the same way: nothing else covers it. */
const ns = function (f) { return fs.statSync(f, { bigint: true }).mtimeNs; };
const appNs = ns(APP), distNs = ns(DIST), buildNs = ns("build.cjs");
const ms = function (a, b) { return (Number(a - b) / 1e6).toFixed(0); };
if (appNs > distNs) bad.push(APP + " is " + ms(appNs, distNs) + " ms newer than " + DIST + ", so the page was not written by that build");
else note.push(DIST + " written " + ms(distNs, appNs) + " ms after " + APP);
if (buildNs > appNs) bad.push("build.cjs is " + ms(buildNs, appNs) + " ms newer than " + APP + ", so the assembler changed after the last assembly");
if (bad.length) { console.log(bad.join("; ")); process.exit(1); }
console.log(note.join(", ") + "; " + fs.statSync(DIST).size + " bytes shipped");
process.exit(0);' 2>&1; }
i8_out="$(i8_probe)"
i8_rc=$?
i8_again=""
if [ "$i8_rc" -ne 0 ]; then
  sleep 4
  i8_out="$(i8_probe)"
  i8_rc=$?
  i8_again=" [re-read 4 s later: a build in flight would have finished]"
fi
if [ "$i8_rc" -eq 0 ]; then ok "dist-and-app-are-built-from-the-current-sources" "$(printf '%s' "$i8_out" | tail -1)$i8_again"
else bad "dist-and-app-are-built-from-the-current-sources" "$(printf '%s' "$i8_out" | tail -3 | tr '\n' ' ') — run node build.cjs$i8_again"; fi

# I9 · no hyperlink in the app copy (A1 working style: no hyperlinks in deliverables)
links="$(grep -n -e '<a ' -e 'href=' -e '](http' src/ui.jsx "$APP" 2>/dev/null | head -3 || true)"
if [ -z "$links" ]; then ok "no-hyperlink-in-the-app-copy" "no anchor, href or markdown link in src/ui.jsx or $APP"
else bad "no-hyperlink-in-the-app-copy" "$(printf '%s' "$links" | tr '\n' ' ')"; fi

# I10 · the engine's CommonJS export guard (CONTRACT §5) — the suites require the engine directly
guard='typeof module !== "undefined" && module.exports'
g1="$(grep -c "$guard" src/engine.js 2>/dev/null || echo 0)"
g2="$(grep -c "$guard" "$APP" 2>/dev/null || echo 0)"
if [ "$g1" -ge 1 ] && [ "$g2" -ge 1 ]; then ok "engine-export-guard-present" "guard in src/engine.js and in the assembled file"
else bad "engine-export-guard-present" "src/engine.js ×$g1, $APP ×$g2"; fi

# I11 · tdz_check clean on both sources and the assembled file
tdz_targets=()
[ -f src/engine.js ] && tdz_targets+=("src/engine.js")
[ -f src/ui.jsx ] && tdz_targets+=("src/ui.jsx")
[ -f "$APP" ] && tdz_targets+=("$APP")
if [ ! -f qa/tdz_check.cjs ] || [ ${#tdz_targets[@]} -eq 0 ]; then
  bad "tdz-check-clean" "qa/tdz_check.cjs or the scan targets are missing"
else
  tdz_out="$(node qa/tdz_check.cjs "${tdz_targets[@]}" 2>&1)"
  tdz_rc=$?
  if [ $tdz_rc -eq 0 ] && printf '%s' "$tdz_out" | tail -1 | grep -q "TDZ CLEAN"; then ok "tdz-check-clean" "${#tdz_targets[@]} files scanned, $(printf '%s' "$tdz_out" | tail -1)"
  else bad "tdz-check-clean" "$(printf '%s' "$tdz_out" | tail -2 | tr '\n' ' ')"; fi
fi

# I12 (the esbuild syntax gate) · the assembled file compiles
if [ ! -f "$APP" ]; then
  bad "esbuild-syntax-gate" "$APP does not exist"
else
  es_out="$(npx --no-install esbuild "$APP" --bundle --loader:.jsx=jsx --jsx=automatic --outfile=/dev/null 2>&1)"
  es_rc=$?
  if [ $es_rc -eq 0 ]; then ok "esbuild-syntax-gate" "$APP bundles clean"
  else bad "esbuild-syntax-gate" "$(printf '%s' "$es_out" | head -3 | tr '\n' ' ')"; fi
fi

# I13 · every import written in src/ui.jsx survives into the assembled file
# The assembler lifts the imports off the top of src/ui.jsx and stops collecting at the first
# statement that is not one, so an import added further down the file used to be dropped in
# silence. build.cjs throws on that now; this invariant proves the built file against the source.
ui_imports="$(grep -c '^import ' src/ui.jsx 2>/dev/null || echo 0)"
app_imports="$(grep -c '^import ' "$APP" 2>/dev/null || echo 0)"
missing_imports="$(grep '^import ' src/ui.jsx 2>/dev/null | while IFS= read -r line; do grep -qxF "$line" "$APP" || printf '%s ' "$line"; done)"
if [ "$ui_imports" -gt 0 ] && [ "$app_imports" -eq "$ui_imports" ] && [ -z "$missing_imports" ]; then
  ok "every-ui-import-survives-the-assembler" "$ui_imports import lines in src/ui.jsx, all $app_imports present in $APP"
else
  bad "every-ui-import-survives-the-assembler" "src/ui.jsx has $ui_imports, $APP has $app_imports; missing: ${missing_imports:-none}"
fi

# I14 · exactly one <style> block in dist/index.html, and it carries no hex colour
# The shell used to repeat --bg and --text as raw hex outside the token definitions, where they
# were free to drift (CONTRACT §7 allows hex only inside those definitions).
if [ ! -f "$DIST" ]; then
  bad "dist-shell-style-block-has-no-hex" "$DIST does not exist"
else
  shell_styles="$(grep -o '<style>' "$DIST" | wc -l | tr -d ' ')"
  shell_hex="$(grep -o '<style>[^<]*</style>' "$DIST" | grep -o '#[0-9a-fA-F]\{3,8\}' | head -5 | tr '\n' ' ')"
  if [ "$shell_styles" = "1" ] && [ -z "$shell_hex" ]; then
    ok "dist-shell-style-block-has-no-hex" "1 style block in the shell, no hex literal in it"
  else
    bad "dist-shell-style-block-has-no-hex" "$shell_styles style blocks; hex found: ${shell_hex:-none}"
  fi
fi

# I15 · the draft-league block is in the shipped snapshot, and carries no invented league id
draft_out="$(MC_ROOT="$ROOT" node -e '
const fs=require("fs"), path=require("path");
const L=JSON.parse(fs.readFileSync(path.join(process.env.MC_ROOT,"data","live.json"),"utf8"));
const keys=["league","entries","ownership","rosters","freeAgents","matches","standings","picks","me","unjoined","unmappedOwners","counts"];
const missing=keys.filter(k=>!(k in L.draft));
const empty = L.draft.league===null && L.draft.entries.length===0 && L.draft.ownership.length===0 &&
  Object.keys(L.draft.rosters).length===0 && L.draft.freeAgents.length===0 && L.draft.matches.length===0 &&
  Object.keys(L.draft.picks).length===0 && L.draft.me===null;
if (missing.length) { console.log("missing draft-league fields: "+missing.join(",")); process.exit(1); }
if (L.draft.league_id!==null) { console.log("the shipped snapshot carries draft league id "+L.draft.league_id+" — Kwezi\u2019s is unknown and must not be invented"); process.exit(1); }
if (!empty) { console.log("league_id is null but the league fields are not empty"); process.exit(1); }
console.log("all "+keys.length+" draft-league fields present, league_id null, every one empty");
' 2>&1)"
if [ $? -eq 0 ]; then ok "draft-league-block-present-and-uninvented" "$draft_out"
else bad "draft-league-block-present-and-uninvented" "$draft_out"; fi

# I16 · the recorded draft-league fixtures the suites replay are in the repository
fx_dir="qa/fixtures/draft"
if [ ! -f "$fx_dir/MANIFEST.json" ]; then
  bad "draft-fixtures-recorded-with-a-manifest" "$fx_dir/MANIFEST.json is missing"
else
  fx_out="$(MC_DIR="$fx_dir" node -e '
const fs=require("fs"), path=require("path");
const dir=process.env.MC_DIR;
const m=JSON.parse(fs.readFileSync(path.join(dir,"MANIFEST.json"),"utf8"));
const files=Object.keys(m.files||{});
const missing=files.filter(f=>!fs.existsSync(path.join(dir,f)));
if (!files.length) { console.log("the manifest lists no files"); process.exit(1); }
if (missing.length) { console.log("listed but absent: "+missing.join(", ")); process.exit(1); }
const bad=files.filter(f=>!/^https:\/\/draft\.premierleague\.com\/api\//.test(m.files[f]));
if (bad.length) { console.log("not a public draft API url: "+bad.join(", ")); process.exit(1); }
console.log(files.length+" recorded responses, every one from draft.premierleague.com/api, captured "+m.captured_at);
' 2>&1)"
  if [ $? -eq 0 ]; then ok "draft-fixtures-recorded-with-a-manifest" "$fx_out"
  else bad "draft-fixtures-recorded-with-a-manifest" "$fx_out"; fi
fi

# ---------------------------------------------------------------- the PWA (v89)
# dist/ is also an installable, offline-capable app. The four checks below are the ones that
# can actually regress: the files are generated, so "they exist and parse" is worth asserting
# after a build; the colours are derived from the --bg token, so "they still equal it" is the
# whole point of deriving them; and the registration guard is what keeps the file:// mode
# alive, so it is EXECUTED here against a stubbed location rather than grepped for.

# I17 · the manifest, the worker and every icon the manifest names are on disk and parse
pwa_out="$(MC_ROOT="$ROOT" node -e '
const fs=require("fs"), path=require("path");
const R=process.env.MC_ROOT, D=path.join(R,"dist");
const need=["index.html","manifest.webmanifest","sw.js"];
const missing=need.filter(f=>!fs.existsSync(path.join(D,f)));
if (missing.length) { console.log("missing from dist/: "+missing.join(", ")+" — run node build.cjs"); process.exit(1); }
let m; try { m=JSON.parse(fs.readFileSync(path.join(D,"manifest.webmanifest"),"utf8")); }
catch(e){ console.log("manifest.webmanifest is not valid JSON: "+e.message); process.exit(1); }
const req=["name","short_name","start_url","scope","display","background_color","theme_color","icons"];
const gone=req.filter(k=>!(k in m));
if (gone.length) { console.log("manifest is missing "+gone.join(", ")); process.exit(1); }
if (m.display!=="standalone") { console.log("manifest display is "+m.display+", not standalone"); process.exit(1); }
if (m.short_name!=="FPL MC") { console.log("manifest short_name is "+JSON.stringify(m.short_name)+", not \"FPL MC\""); process.exit(1); }
if (!Array.isArray(m.icons)||!m.icons.length) { console.log("manifest lists no icons"); process.exit(1); }
const badIcon=m.icons.filter(i=>!i.src||!fs.existsSync(path.join(D,i.src)));
if (badIcon.length) { console.log("icon(s) named by the manifest but not on disk: "+badIcon.map(i=>i.src).join(", ")); process.exit(1); }
const maskable=m.icons.filter(i=>String(i.purpose||"").split(/\s+/).indexOf("maskable")>=0);
if (!maskable.length) { console.log("no maskable icon in the manifest"); process.exit(1); }
const png=m.icons.filter(i=>/\.png$/.test(i.src));
for (const i of png) {
  const b=fs.readFileSync(path.join(D,i.src));
  if (b.length<8 || b[0]!==0x89 || b.toString("ascii",1,4)!=="PNG") { console.log(i.src+" is not a PNG"); process.exit(1); }
  const w=b.readUInt32BE(16), h=b.readUInt32BE(20);
  const want=Number(String(i.sizes).split("x")[0]);
  if (w!==want||h!==want) { console.log(i.src+" declares "+i.sizes+" but the IHDR says "+w+"x"+h); process.exit(1); }
}
console.log(m.icons.length+" icons ("+png.length+" PNG, "+maskable.length+" maskable), display "+m.display+", scope "+m.scope+", start_url "+m.start_url);
' 2>&1)"
if [ $? -eq 0 ]; then ok "pwa-manifest-worker-and-icons-exist-and-parse" "$pwa_out"
else bad "pwa-manifest-worker-and-icons-exist-and-parse" "$pwa_out"; fi

# I18 · the manifest colours and the theme-color meta ARE the --bg token
# A manifest cannot say var(--bg), so the only safe copy is one derived at build time. This is
# the check that makes "derived" mean something: change the token and forget to rebuild, or
# hand-edit either copy, and it goes red.
theme_out="$(MC_ROOT="$ROOT" node -e '
const fs=require("fs"), path=require("path");
const R=process.env.MC_ROOT;
const ui=fs.readFileSync(path.join(R,"src","ui.jsx"),"utf8");
const t=ui.match(/--bg\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/);
if(!t){ console.log("no --bg token definition in src/ui.jsx"); process.exit(1); }
const bg=t[1].toLowerCase();
const m=JSON.parse(fs.readFileSync(path.join(R,"dist","manifest.webmanifest"),"utf8"));
const html=fs.readFileSync(path.join(R,"dist","index.html"),"utf8");
const meta=html.match(/<meta name="theme-color" content="(#[0-9a-fA-F]{3,8})">/);
const bad=[];
if(String(m.theme_color).toLowerCase()!==bg) bad.push("manifest theme_color "+m.theme_color);
if(String(m.background_color).toLowerCase()!==bg) bad.push("manifest background_color "+m.background_color);
if(!meta) bad.push("no theme-color meta in dist/index.html");
else if(meta[1].toLowerCase()!==bg) bad.push("theme-color meta "+meta[1]);
if(bad.length){ console.log("--bg is "+bg+" but: "+bad.join("; ")); process.exit(1); }
console.log("--bg "+bg+" = manifest theme_color = manifest background_color = the theme-color meta");
' 2>&1)"
if [ $? -eq 0 ]; then ok "pwa-colours-are-the-bg-token-and-cannot-drift" "$theme_out"
else bad "pwa-colours-are-the-bg-token-and-cannot-drift" "$theme_out"; fi

# I19 · the shipped page registers the worker ONLY over http(s) — executed, not grepped
# dist/index.html is opened from a file:// URL today. A service-worker registration from one
# rejects, and on some engines throws; either way it would be a regression in the mode the app
# is actually used in. The registration is bracketed in the page so this check can lift it out
# and RUN it twice, against a stubbed file: location and a stubbed https: one.
guard_out="$(MC_ROOT="$ROOT" node -e '
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(process.env.MC_ROOT,"dist","index.html"),"utf8");
const A="/* PWA — START */", B="/* PWA — END */";
const a=html.indexOf(A), b=html.indexOf(B);
if(a<0||b<0||b<a){ console.log("the bracketed PWA registration block is not in dist/index.html"); process.exit(1); }
if(html.split(A).length-1!==1||html.split(B).length-1!==1){ console.log("the PWA markers do not appear exactly once each"); process.exit(1); }
const src=html.slice(a+A.length,b);
if(!/serviceWorker/.test(src)){ console.log("the bracketed block does not mention serviceWorker"); process.exit(1); }
function run(proto){
  const calls=[]; const listeners=[];
  const win={ addEventListener:function(t,f){ listeners.push(t); } };
  const nav={ serviceWorker:{ register:function(u,o){ calls.push(String(u)); return { then:function(ok){ try{ok({scope:"/"});}catch(e){} return { then:function(){} }; } }; } } };
  const loc={ protocol: proto };
  const doc={ readyState:"complete" };
  let err=null;
  try { new Function("window","navigator","location","document",src)(win,nav,loc,doc); }
  catch(e){ err = e && e.message ? e.message : String(e); }
  return { st: win.__PWA__, calls: calls, listeners: listeners, err: err };
}
const f=run("file:"), h=run("https:"), t=run("http:");
const bad=[];
if(f.err) bad.push("file: threw "+f.err);
if(!f.st||f.st.sw!=="skipped-not-http") bad.push("file: __PWA__.sw is "+(f.st?f.st.sw:"undefined")+", expected skipped-not-http");
if(f.calls.length) bad.push("file: called register("+f.calls.join(",")+")");
if(f.listeners.length) bad.push("file: added a "+f.listeners.join(",")+" listener");
if(h.err) bad.push("https: threw "+h.err);
if(h.calls.length!==1||h.calls[0]!=="sw.js") bad.push("https: register calls "+JSON.stringify(h.calls));
if(t.calls.length!==1) bad.push("http: register calls "+JSON.stringify(t.calls));
if(bad.length){ console.log(bad.join("; ")); process.exit(1); }
console.log("executed the shipped block: file: → "+f.st.sw+", no register, no listener; https: → register(\"sw.js\") once; http: → once");
' 2>&1)"
if [ $? -eq 0 ]; then ok "pwa-service-worker-registers-only-over-http-s" "$guard_out"
else bad "pwa-service-worker-registers-only-over-http-s" "$guard_out"; fi

# I20 · the worker parses, precaches this build and never caches what it must not
# The cache name is recomputed here from the same inputs build.cjs hashes. The duplication is
# deliberate: it is what turns "derived from the build" into something a test can fail on. Stop
# deriving it, or ship a worker from a previous build, and this goes red.
sw_out="$(MC_ROOT="$ROOT" node -e '
const fs=require("fs"), path=require("path"), crypto=require("crypto");
const R=process.env.MC_ROOT, D=path.join(R,"dist");
const sw=fs.readFileSync(path.join(D,"sw.js"),"utf8");
try { new Function(sw); } catch(e){ console.log("sw.js does not parse: "+e.message); process.exit(1); }
/* The checks below are about what the worker DOES, so they read the code with the comments
   taken out. A scan that cannot tell a comment from a statement is how E-013 happened: the
   first version of this check went red on the header comment that explains why the refresh
   path is never cached — the comment was right and the check was wrong (E-075). */
const code=sw.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"");
const cm=sw.match(/var CACHE = "([^"]+)";/);
const sm=sw.match(/var SHELL = (\[[^\]]*\]);/);
if(!cm||!sm){ console.log("sw.js does not declare CACHE and SHELL as literals"); process.exit(1); }
let shell;
try { shell=JSON.parse(sm[1]); }
catch(e){ console.log("the SHELL literal in sw.js is not valid JSON ("+e.message+"): "+sm[1].slice(0,160)); process.exit(1); }
const pkg=JSON.parse(fs.readFileSync(path.join(R,"package.json"),"utf8"));
const ver="v"+String(pkg.version).split(".")[0];
const bad=[];
if(shell.indexOf("./index.html")<0) bad.push("SHELL does not precache ./index.html");
if(shell.indexOf("./manifest.webmanifest")<0) bad.push("SHELL does not precache the manifest");
shell.filter(u=>u!=="./").forEach(function(u){ if(!fs.existsSync(path.join(D,u.replace(/^\.\//,"")))) bad.push("SHELL names "+u+", which is not in dist/"); });
if(!/req\.method !== .GET./.test(code)) bad.push("sw.js does not skip non-GET requests (the D4 refresh path is a POST)");
if(!/url\.origin !== self\.location\.origin/.test(code)) bad.push("sw.js does not skip cross-origin requests");
if(/api\.anthropic\.com/.test(code)) bad.push("sw.js code names api.anthropic.com — the refresh path is a cross-origin POST and is skipped by the two rules above, not by naming it");
const h=crypto.createHash("sha256");
h.update(fs.readFileSync(path.join(D,"index.html")));
h.update(fs.readFileSync(path.join(D,"manifest.webmanifest")));
["icon-192.png","icon-512.png","icon-maskable-512.png","icon.svg"].sort().forEach(function(k){ h.update(k); h.update(fs.readFileSync(path.join(D,k))); });
const want="fpl-mc-"+ver+"-"+h.digest("hex").slice(0,12);
if(cm[1]!==want) bad.push("cache name "+cm[1]+" is not the one this build derives ("+want+") — dist/ is a mix of two builds, or the name stopped being derived");
if(bad.length){ console.log(bad.join("; ")); process.exit(1); }
console.log("sw.js parses ("+code.split("\n").filter(l=>l.trim()).length+" code lines after comments are stripped), cache "+cm[1]+" recomputed from the shipped page+manifest+icons, "+shell.length+" shell entries, non-GET and cross-origin skipped");
' 2>&1)"
if [ $? -eq 0 ]; then ok "pwa-service-worker-precaches-this-build-only" "$sw_out"
else bad "pwa-service-worker-precaches-this-build-only" "$sw_out"; fi

# I21 · every file the manifest names is also precached by the worker
# I17 proves the manifest's icons are on disk and I20 proves the worker's SHELL entries are on
# disk, and between them they leave a gap wide enough to walk through: an icon added to the
# manifest and not to shellList() is a file the installed app fetches from the network and does
# not have offline. Today the two lists agree; they agree by hand, which is the kind of agreement
# that holds until the fifth icon.
shell_out="$(MC_ROOT="$ROOT" node -e '
const fs=require("fs"), path=require("path");
const D=path.join(process.env.MC_ROOT,"dist");
const m=JSON.parse(fs.readFileSync(path.join(D,"manifest.webmanifest"),"utf8"));
const sw=fs.readFileSync(path.join(D,"sw.js"),"utf8");
const sm=sw.match(/var SHELL = (\[[^\]]*\]);/);
if(!sm){ console.log("sw.js does not declare SHELL as a literal array"); process.exit(1); }
let shell;
try { shell=JSON.parse(sm[1]).map(u=>u.replace(/^\.\//,"")); }
catch(e){ console.log("the SHELL literal in sw.js is not valid JSON ("+e.message+"): "+sm[1].slice(0,160)); process.exit(1); }
const named=[m.start_url].concat(m.icons.map(i=>i.src)).map(u=>String(u).replace(/^\.\//,""));
const gap=named.filter(u=>shell.indexOf(u)<0 && !(u==="" && shell.indexOf("")>=0));
if(gap.length){ console.log("named by the manifest and NOT precached by the worker: "+gap.join(", ")+" (SHELL is "+shell.join(", ")+")"); process.exit(1); }
if(shell.indexOf("manifest.webmanifest")<0){ console.log("the worker does not precache the manifest itself"); process.exit(1); }
console.log(named.length+" manifest-named files (start_url + "+m.icons.length+" icons) all appear in the worker SHELL of "+shell.length);
' 2>&1)"
if [ $? -eq 0 ]; then ok "pwa-every-manifest-named-file-is-precached" "$shell_out"
else bad "pwa-every-manifest-named-file-is-precached" "$shell_out"; fi

# I22 · nothing the app ships is excluded from the repository by a gitignore rule
# The defect this was written for (E-076): the repository root ignores *.png for the sibling
# project's screenshots, so the three PWA icons build.cjs generates were never committed. The
# manifest named them, the worker precached them, every other check passed — and a host serving
# the committed dist/ would have answered 404 three times, with the iPhone install falling back
# to a screenshot of the page for its icon.
# The assertion is "not excluded", not "already tracked": a file generated a second ago is
# legitimately untracked until somebody commits it, but a file an ignore rule has quietly
# removed from the repository is a defect at any moment. Untracked files are named in the detail
# so they are visible rather than silent.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  bad "pwa-no-shipped-file-is-gitignored" "qa/verify.sh is not running inside a git work tree, so the exclusion rules cannot be read"
else
  pwa_files="dist/index.html dist/manifest.webmanifest dist/sw.js"
  for ic in $(MC_ROOT="$ROOT" node -e '
const fs=require("fs"), path=require("path");
const m=JSON.parse(fs.readFileSync(path.join(process.env.MC_ROOT,"dist","manifest.webmanifest"),"utf8"));
process.stdout.write(m.icons.map(i=>"dist/"+String(i.src).replace(/^\.\//,"")).join(" "));' 2>/dev/null); do
    pwa_files="$pwa_files $ic"
  done
  excluded=""
  untracked=""
  counted=0
  for f in $pwa_files; do
    counted=$((counted + 1))
    if [ ! -f "$f" ]; then excluded="$excluded $f(absent)"; continue; fi
    if git check-ignore -q "$f"; then
      excluded="$excluded $f($(git check-ignore -v "$f" | awk '{print $1}'))"
    elif ! git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      untracked="$untracked $f"
    fi
  done
  if [ -z "$excluded" ]; then
    ok "pwa-no-shipped-file-is-gitignored" "$counted shipped PWA files, none excluded by a gitignore rule${untracked:+; not yet committed:$untracked}"
  else
    bad "pwa-no-shipped-file-is-gitignored" "excluded from the repository:$excluded — the manifest names files the repository does not carry"
  fi
fi

# ---------------------------------------------------------------- verdict

echo "------------------------------------------------------------"
TOTAL=$((PASS + FAIL))
if [ "$SKIP" -gt 0 ]; then
  echo "SUITE verify $PASS/$TOTAL — SKIP live (offline): $SKIP live reconciliations not run ($OFFLINE_WHY); invariants only"
else
  echo "SUITE verify $PASS/$TOTAL"
fi
if [ "$FAIL" -gt 0 ]; then
  for r in "${RED[@]}"; do echo "  red: $r"; done
  exit 1
fi
exit 0

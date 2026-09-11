#!/usr/bin/env bash
# qa/verify.sh — the reconciliation gate (CLAUDE.md H1 "verify" row, bar 23/23).
#
#   11 live reconciliations  — the shipped snapshot and the app's own numbers against
#                              a fresh pull of the public API. Skipped, loudly, when the
#                              network is unreachable; the SUITE line says so.
#   11 static invariants     — things that must hold whether or not the network is up.
#    1 esbuild syntax gate
#   ---
#   23 checks
#
# The arithmetic, spelled out so nobody has to guess how 23 was reached: the master
# prompt lists nine invariant sentences, two of which name two artefacts each (banned
# fields in the assembled app AND in data/live.json; account-touching URLs in src AND
# in the shipped app), and one of which is the tdz scan. Those two are counted as the
# two checks they are, which is 11 static invariants, and esbuild is the twelfth
# static check: 11 + 11 + 1 = 23.
#
# Every check prints "PASS <name> — <detail>" or "FAIL <name> — <detail>", and the last
# line is "SUITE verify <pass>/<total>". Exit 1 on any FAIL.
#
# Run from fpl/:  bash qa/verify.sh

set -uo pipefail

cd "$(dirname "$0")/.." || { echo "FAIL verify — cannot reach the fpl/ directory"; echo "SUITE verify 0/23"; exit 1; }
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
for s in run.sh harness.cjs verify.sh tdz_check.cjs unit_engine.cjs smoke.cjs smoke_wk.cjs realistic.cjs buttons.cjs mc_full.cjs mc_all.cjs; do
  if [ -f "qa/$s" ]; then present=$((present + 1)); else missing="$missing $s"; fi
done
if [ -z "$missing" ]; then ok "every-suite-file-present-in-qa" "$present of 11 suite files present"
else bad "every-suite-file-present-in-qa" "$present of 11 present; missing:$missing"; fi

# I8 · dist/index.html exists and is not older than the sources it is built from
if [ ! -f "$DIST" ]; then
  bad "dist-index-html-exists-and-is-not-older-than-src" "$DIST does not exist"
else
  newer="$(find src data build.cjs -type f -newer "$DIST" 2>/dev/null | head -3 | tr '\n' ' ')"
  if [ -z "$newer" ]; then ok "dist-index-html-exists-and-is-not-older-than-src" "$DIST ($(wc -c < "$DIST") bytes) is at least as new as src/, data/ and build.cjs"
  else bad "dist-index-html-exists-and-is-not-older-than-src" "newer than dist: $newer — run node build.cjs"; fi
fi

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

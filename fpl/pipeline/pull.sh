#!/bin/bash
# pipeline/pull.sh — fetch every public Classic and Draft feed the bake reads (v110 §5 A1).
#
#   bash pipeline/pull.sh            # gameweek in play detected from bootstrap
#   bash pipeline/pull.sh 5          # or forced
#   FEEDS=/some/dir bash pipeline/pull.sh
#
# Then: node pipeline/bake.js
#
# THREE THINGS THIS DOES THAT THE REFERENCE pull.sh DOES NOT
#
# 1. It detects the gameweek in play instead of taking it as an argument. The reference defaults
#    to 5, which is right for one week of one season and silently wrong afterwards — a pull that
#    fetches picks for the wrong gameweek is worse than one that fails, because it succeeds.
#    Detection: events[].is_current, falling back to the highest finished event, falling back to
#    is_next minus one. An explicit argument still wins, for replaying a past week.
#
# 2. A feed that answers with something that is not JSON leaves the previous file alone. The FPL
#    API serves an HTML "the game is being updated" page during the deadline processing window,
#    and it serves it with a 200. Writing that over a good snapshot turns a stale file into a
#    broken one, and the bake then fails on a parse error rather than on a missing feed. The
#    write is staged through a .tmp and only moved when the body opens with { or [ AND parses.
#
# 3. It exits non-zero when a feed the bake cannot do without is missing, and says which. A pull
#    that half-succeeds and reports success is how a stale snapshot gets committed as fresh.
#
# THE FEEDS ARE NOT COMMITTED. They carry `player_first_name`, `player_last_name`, `player_name`
# and league-entry `short_name` straight from the API, and those are never committed (v110 §1.5,
# ERRORS.md E-085). pipeline/feeds/ is ignored by git; the bake writes the scrubbed block.
#
# Endpoints are public and unauthenticated. The league-level transactions endpoint
# draft/league/{id}/transactions IS public; the per-entry one is not (403).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FEEDS="${FEEDS:-$ROOT/pipeline/feeds}"
FPL_BASE="${FPL_BASE:-https://fantasy.premierleague.com/api}"
DRAFT_BASE="${DRAFT_BASE:-https://draft.premierleague.com/api}"
UA="${PULL_UA:-Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)}"
TIMEOUT="${PULL_TIMEOUT:-30}"

# Kwezi's two entries and the Draft league (v110 §3, every one verified against the live API).
E="${CLASSIC_ENTRY:-3546875}"
D="${DRAFT_ENTRY:-279275}"
L="${DRAFT_LEAGUE:-46148}"

mkdir -p "$FEEDS"
MISSED=0
KEPT=0
GOT=0
MISSING_NAMES=""

# g <url> <file> — stage, validate, then move. Never truncates a good file.
g() {
  local url="$1" name="$2" dest="$FEEDS/$2" tmp="$FEEDS/$2.tmp"
  if curl -s -m "$TIMEOUT" -A "$UA" "$url" -o "$tmp" 2>/dev/null &&
     [ -s "$tmp" ] &&
     head -c 1 "$tmp" | grep -q '[{[]' &&
     node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$tmp" 2>/dev/null; then
    mv "$tmp" "$dest"
    GOT=$((GOT + 1))
    return 0
  fi
  rm -f "$tmp"
  if [ -f "$dest" ]; then
    KEPT=$((KEPT + 1))
    echo "  kept  $name (the feed did not answer with JSON; the previous file is untouched)"
  else
    MISSED=$((MISSED + 1))
    MISSING_NAMES="$MISSING_NAMES $name"
    echo "  MISS  $name (no previous file to fall back on)"
  fi
  return 1
}

g "$FPL_BASE/bootstrap-static/" bootstrap.json || true

# The gameweek in play, from the feed rather than from an assumption.
GW="${1:-}"
if [ -z "$GW" ]; then
  if [ -f "$FEEDS/bootstrap.json" ]; then
    GW="$(node -e '
      const b = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      const ev = Array.isArray(b.events) ? b.events : [];
      const cur = ev.filter((e) => e.is_current)[0];
      if (cur) { process.stdout.write(String(cur.id)); }
      else {
        const fin = ev.filter((e) => e.finished).map((e) => e.id);
        if (fin.length) { process.stdout.write(String(Math.max.apply(null, fin))); }
        else {
          const nx = ev.filter((e) => e.is_next)[0];
          process.stdout.write(nx ? String(Math.max(1, Number(nx.id) - 1)) : "");
        }
      }
    ' "$FEEDS/bootstrap.json" 2>/dev/null || true)"
  fi
fi
if ! printf '%s' "${GW:-}" | grep -qE '^[0-9]+$'; then
  echo "pull: cannot tell which gameweek is in play — bootstrap-static did not answer and no argument was given" >&2
  echo "pull: nothing was overwritten. $KEPT feed(s) kept, $MISSED missing." >&2
  exit 2
fi
echo "pull: gameweek in play $GW · feeds -> $FEEDS"

g "$FPL_BASE/fixtures/" fixtures.json || true
g "$FPL_BASE/event-status/" evstatus.json || true
g "$FPL_BASE/entry/$E/" entry.json || true
g "$FPL_BASE/entry/$E/history/" history.json || true
g "$FPL_BASE/entry/$E/transfers/" transfers.json || true

for k in $(seq 1 "$GW"); do
  # Classic picks for the gameweek in play publish only after the deadline is processed and 404
  # until then (v110 §4). A miss here is expected, not a failure.
  g "$FPL_BASE/entry/$E/event/$k/picks/" "picks$k.json" || true
  g "$FPL_BASE/event/$k/live/" "live$k.json" || true
  g "$DRAFT_BASE/event/$k/live" "dlive$k.json" || true
  g "$DRAFT_BASE/entry/$D/event/$k" "d_picks$k.json" || true
done

g "$DRAFT_BASE/bootstrap-static" dbootstrap.json || true
g "$DRAFT_BASE/game" d_game.json || true
g "$DRAFT_BASE/entry/$D/public" dentry.json || true
g "$DRAFT_BASE/league/$L/details" d_details.json || true
g "$DRAFT_BASE/league/$L/element-status" d_status.json || true
g "$DRAFT_BASE/draft/league/$L/transactions" d_tx.json || true

# Every rival's saved eleven for the gameweek in play. Public once the deadline has passed.
if [ -f "$FEEDS/d_details.json" ]; then
  for id in $(node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write((d.league_entries || []).map((e) => e.entry_id).filter(Boolean).join(" "));
  ' "$FEEDS/d_details.json" 2>/dev/null || true); do
    g "$DRAFT_BASE/entry/$id/event/$GW" "d_rival_${id}_$GW.json" || true
  done
fi

# Private Classic mini-leagues. Page one carries the leader and the pack around him.
if [ -f "$FEEDS/entry.json" ]; then
  for id in $(node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const cl = (d.leagues && d.leagues.classic) || [];
    process.stdout.write(cl.filter((l) => l.league_type === "x" && l.rank_count).map((l) => l.id).join(" "));
  ' "$FEEDS/entry.json" 2>/dev/null || true); do
    g "$FPL_BASE/leagues-classic/$id/standings/" "lg_$id.json" || true
  done
fi

TOTAL="$(ls -1 "$FEEDS"/*.json 2>/dev/null | wc -l | tr -d ' ')"
echo "pull: $GOT fetched, $KEPT kept from the previous pull, $MISSED missing · $TOTAL feed(s) in $FEEDS at $(date -u +%H:%MZ)"

# The bake cannot run without these. Anything else missing is degraded, not broken.
ESSENTIAL="bootstrap.json fixtures.json entry.json history.json"
LACK=""
for f in $ESSENTIAL; do [ -f "$FEEDS/$f" ] || LACK="$LACK $f"; done
if [ -n "$LACK" ]; then
  echo "pull: FAILED — the bake cannot run without:$LACK" >&2
  exit 1
fi
if [ "$MISSED" -gt 0 ]; then
  echo "pull: degraded — no previous file for:$MISSING_NAMES" >&2
  exit 3
fi
exit 0

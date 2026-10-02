#!/usr/bin/env bash
# qa/solver_smoke.sh — a short solve must return a legal plan (v110 §5 E6 and C6; §7.2, E-103).
#
#   bash qa/solver_smoke.sh [TL]        TL is the main plan's time limit in seconds; default 45 (30 until 2 Oct 2026, E-152)
#
# WHY 30 AND NOT 20 (measured 27 Sep 2026, four cores shared with another agent's suites)
#   The spec asks for a 20-second smoke. On the committed input the main Classic model is 8,091 variables (883
#   integer) and 11,787 rows, and HiGHS found its FIRST feasible solution at 21.5 s: with logging on, the progress
#   rows at 0.1, 2.6, 7.7 and 13.4 s all carry BestSol inf, and the first finite one is the root local-search row
#   `L 0 0 0 0.00% -760.3140047 -668.2602612 13.78% … 21.5s`. A 20-second limit therefore returned status 13 with
#   no incumbent, plan.ok false, and this script went red at 3/4 — which is the right behaviour, a smoke with no
#   plan is a red and never a skip. The default was 30 s, the top of the band the item allows, and a slower
#   runner passed a larger number. On 2 Oct 2026 (input e24645609f1ec9db) the first incumbent arrived at 30.1 s on an
#   idle machine and not at all inside 30 s in the release gate, so 30 s had stopped being a margin: the default is
#   45 s (ERRORS.md E-152). The spec's 20 s (E6) cannot return a plan on this model at all; the assertion is unchanged,
#   only the clock. The limit is measured, not assumed.
#
# WHAT IT PROVES
#   The whole optimiser chain runs end to end on this machine and hands back a plan that obeys the rules of
#   the game: pipeline/solve.py through every stage (the plan, the no-wildcard plan, the free hit priced week
#   by week, the Draft roster, the Draft roster with the manager ahead's picks removed, then done: true),
#   pipeline/plan.cjs (the content-hash guard, the best-of-identical-solves fold, the ledger replayed from the
#   rules) and qa/plan_legality.cjs on the result: fifteen in a 2/5/5/3 shape under the club cap, a legal
#   eleven with captain and vice on it, transfer lists equal to the squad difference, no player sold and bought
#   back, the bank never negative at selling prices, hits equal to the replayed number, one chip a week and each
#   chip once, and expected points re-derived by src/mc_engine.js within 0.05.
#
#   It also proves §7.2 by observation rather than by reading the code: the output file appears, carrying the
#   plan stage and no `done`, BEFORE the run ends. A run killed half way therefore leaves a usable file. The
#   check records how many seconds before the end the file first appeared and which keys it carried.
#
# WHAT IT DOES NOT PROVE, AND SAYS SO
#   The gap. A TL-second solve is asked to be legal, not close to optimal, so the two checks in
#   qa/plan_legality.cjs that speak to solve quality (the proven gap under 3% and "at least as good as keeping
#   the wildcard") are skipped by an explicit --skip-gap, and that suite prints SKIP for each with the gap it
#   saw. The gap proof lives with the committed plan, solved on an idle machine for its full time limit, and is
#   checked by the plan_legality step in the same gate group. The full optimiser never runs on push (E6).
#
# INPUT
#   data/solver_in.json when it exists (the export of the committed block, with data/mc_data.json as its
#   block), else reference/v109/app/solver_in.json with the reference block. Everything this script writes goes
#   to a temporary directory that is removed on exit; data/ is never touched. data/plan.json is written only by
#   the solve stage, on an idle machine, never by a smoke test.
#
# OUTPUT
#   PASS <name> / FAIL <name> — <detail> per check, then `SUITE solver_smoke N/N · wall S s`; exit 1 on any
#   failure. A green run never prints the literal FAIL, because gate.yml greps the combined log for it.
#
# TOOLING
#   python3 with scipy>=1.11 (scipy.optimize.milp on HiGHS) and numpy: `pip install -r pipeline/requirements.txt`.
#   A missing interpreter or a missing scipy is a named FAIL with the install line, never a silent skip.
set -u
cd "$(dirname "$0")/.." || { echo "FAIL solver_smoke — cannot cd to fpl/"; exit 1; }

TL="${1:-45}"
case "$TL" in ''|*[!0-9]*) echo "FAIL solver_smoke — the time limit must be a whole number of seconds, not '$TL'"; exit 1 ;; esac

WALL_MAX=120                     # the budget every new suite in this gate is held to (two minutes)
T="$(mktemp -d "${TMPDIR:-/tmp}/solver_smoke.XXXXXX")"
trap 'rm -rf "$T"' EXIT
OUT="$T/solver_out.json"; PLAN="$T/plan.json"

pass=0; fail=0
ok() { if [ "$2" -eq 0 ]; then pass=$((pass + 1)); echo "PASS $1"; else fail=$((fail + 1)); echo "FAIL $1 — ${3:-}"; fi; }
now() { date +%s.%N; }
since() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.1f", b - a }'; }
finish() { echo "SUITE solver_smoke $pass/$((pass + fail)) · wall $(since "$T0" "$(now)") s"; [ "$fail" -eq 0 ] && exit 0 || exit 1; }
T0="$(now)"

# ---------------------------------------------------------------- tooling
if ! command -v python3 >/dev/null 2>&1; then ok "python3 is on PATH" 1 "no python3 — install Python 3 and run: pip install -r pipeline/requirements.txt"; finish; fi
PYV="$(python3 -c 'import sys; print(sys.version.split()[0])' 2>/dev/null || printf '?')"
if ! python3 -c 'from scipy.optimize import milp; import numpy' >/dev/null 2>&1; then
  ok "scipy.optimize.milp and numpy import under python3 $PYV" 1 "run: python3 -m pip install -r pipeline/requirements.txt"; finish
fi
ok "scipy.optimize.milp and numpy import under python3 $PYV ($(python3 -c 'import scipy, numpy; print("scipy " + scipy.__version__ + ", numpy " + numpy.__version__)'))" 0
for f in pipeline/solve.py pipeline/plan.cjs qa/plan_legality.cjs src/mc_engine.js pipeline/export.js; do
  [ -f "$f" ] || { ok "$f exists" 1 "missing"; finish; }
done

# ---------------------------------------------------------------- input
if [ -f data/solver_in.json ]; then IN=data/solver_in.json; DATA=data/mc_data.json; SRC="the committed block"
else IN=reference/v109/app/solver_in.json; DATA=reference/v109/app/data.json; SRC="the reference block (data/solver_in.json is absent)"; fi
[ -f "$DATA" ] || { ok "the data block $DATA beside $IN exists" 1 "missing"; finish; }
echo "     input $IN on $SRC · hash $(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).hash))' "$IN") · plan time limit $TL s"

# ---------------------------------------------------------------- the solve, watched while it runs (§7.2)
S0="$(now)"
python3 pipeline/solve.py "$TL" --in "$IN" --out "$OUT" --timing "$T/timing.json" --long "$T/long.json" > "$T/solve.log" 2>&1 &
PID=$!
FIRST=""; FIRST_KEYS=""
while kill -0 "$PID" 2>/dev/null; do
  if [ -z "$FIRST" ] && [ -f "$OUT" ]; then
    FIRST_KEYS="$(node -e 'try { const o = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(Object.keys(o).sort().join(",") + (o.done ? " done:true" : " done:absent")); } catch (e) { process.stdout.write("unreadable"); }' "$OUT")"
    [ "$FIRST_KEYS" != "unreadable" ] && FIRST="$(now)"
  fi
  sleep 0.5
done
wait "$PID"; RC=$?
S1="$(now)"
sed 's/^/     solve: /' "$T/solve.log"
ok "pipeline/solve.py exit 0 in $(since "$S0" "$S1") s with a $TL s plan limit" "$RC" "exit $RC — see the solve log above"
[ "$RC" -eq 0 ] || finish
if [ -n "$FIRST" ]; then
  case "$FIRST_KEYS" in
    *plan*done:absent*) ok "the output appeared $(since "$FIRST" "$S1") s before the run ended, carrying the plan stage and no done flag (§7.2: written after every stage) — keys $FIRST_KEYS" 0 ;;
    *) ok "the output appeared before the run ended carrying the plan stage and no done flag (§7.2)" 1 "first seen $(since "$FIRST" "$S1") s before the end with keys $FIRST_KEYS" ;;
  esac
else ok "the output appeared before the run ended (§7.2)" 1 "the file was first seen only after the run finished"; fi
node -e '
const o = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")), i = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));
const stages = ["plan", "noWildcard", "freeHit", "draft", "draftIfTaken"], missing = stages.filter((k) => !(k in o));
const bad = [];
if (o.done !== true) bad.push("done is " + JSON.stringify(o.done));
if (!o.plan || o.plan.ok !== true) bad.push("plan.ok is " + JSON.stringify(o.plan && o.plan.ok) + " (" + (o.plan && o.plan.status) + "): no feasible solution inside the limit — HiGHS needs about 22 s for its first incumbent on this model on the dev machine, so pass a larger limit on a slower runner, e.g. bash qa/solver_smoke.sh 45");
if (o.hash !== i.hash) bad.push("hash " + o.hash + " vs the input " + i.hash);
if (missing.length) bad.push("stages missing: " + missing.join(","));
if (bad.length) { console.log("FAIL solver_out.json is a finished solve of this input with every stage — " + bad.join(" · ")); process.exit(1); }
console.log("PASS solver_out.json is a finished solve of this input with every stage (plan total " + o.plan.total + ", gap " + o.plan.gap + ", status " + JSON.stringify(o.plan.status) + "; noWildcard total " + (o.noWildcard && o.noWildcard.total) + "; free-hit weeks " + (o.freeHit || []).length + "; Draft roster value " + (o.draft && o.draft.value) + " from " + (o.draft && o.draft.base) + ")");
' "$OUT" "$IN"; if [ $? -eq 0 ]; then pass=$((pass + 1)); else fail=$((fail + 1)); finish; fi

# ---------------------------------------------------------------- plan.cjs: the guard and the replay
node pipeline/plan.cjs --data "$DATA" --solver-out "$OUT" --timing "$T/no_timing.json" --long "$T/no_long.json" --out "$PLAN" | sed 's/^/     plan.cjs: /'
RC=${PIPESTATUS[0]}
ok "pipeline/plan.cjs exit 0: the hash guard passed and the replayed ledger agrees with the solver's fields" "$RC" "exit $RC (2 = the replay disagrees, 3 = refused)"
[ "$RC" -eq 0 ] || finish

# ---------------------------------------------------------------- legality, with the gap check skipped by name
echo "     the gap check is skipped on purpose: a $TL s solve is asked to be legal, not to prove its gap; qa/plan_legality.cjs prints SKIP for the two quality checks"
node qa/plan_legality.cjs "--plan=$PLAN" "--data=$DATA" --skip-gap --no-golden > "$T/legality.log" 2>&1; RC=$?
grep "^SKIP\|^SUITE" "$T/legality.log" | sed 's/^/     legality: /'
if [ "$RC" -ne 0 ]; then grep "^FAIL" "$T/legality.log" | sed 's/^/     legality: /'; fi
ok "qa/plan_legality.cjs --skip-gap --no-golden is green on the smoke plan ($(grep '^SUITE' "$T/legality.log" | sed 's/^SUITE plan_legality //'))" "$RC" "exit $RC — the lines above name the rule"

# ---------------------------------------------------------------- the budget
WALL="$(since "$T0" "$(now)")"
if awk -v w="$WALL" -v m="$WALL_MAX" 'BEGIN { exit !(w < m) }'; then ok "the whole smoke ran inside the $WALL_MAX s budget ($WALL s)" 0; else ok "the whole smoke ran inside the $WALL_MAX s budget" 1 "$WALL s"; fi
finish

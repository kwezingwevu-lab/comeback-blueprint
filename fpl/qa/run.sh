#!/usr/bin/env bash
# qa/run.sh — the full gate (CONTRACT §8, CLAUDE.md H1/H3).
#
# ONE RUN PER TREE AT A TIME. See "the run lock" below: two overlapping runs each rebuild
# dist/ while the other's suites read it. That happened on 26 September 2026 and cost two
# hours — verify.sh I8 flapped, the step numbers moved between runs, and the symptom read
# like a phantom process editing src/engine.js. I8 has since been rewritten to compare
# content instead of clocks, which removes the false reading but not the collision: two
# builds writing app/ and dist/ underneath a third suite is a data race whatever I8 asserts.
# The cure is the lock.
#
# Order of the suites, and why (the groups are what a red should arrive in, soonest first):
#
#   0  lock            take the run lock, or refuse
#   1  tdz             sources
#   2  esbuild         syntax gate
#   3  build           build.cjs → app/ + dist/
#   4  tdz             the freshly built app
#   A  cheap + deterministic   privacy · no_frozen · visual
#   B  data                    validate_live · waiver_log · prices · verify.sh · pull_guard
#   C  engine + render         unit_engine · components        (node, no browser)
#   D  browser                 smoke · smoke_wk · realistic · buttons · webkit · browser.py
#   E  million-iteration       mc_full · mc_all
#
# WHAT THE ORDER COSTS, measured on this machine on 26 September 2026 — twice, because the two
# numbers differ and both are honest. Each suite on its own from fpl/, then the same suites in
# this order inside one run of this script (that run was stopped by hand at step 15):
#
#              own run     in order        group
#   privacy         226         219        A
#   no_frozen        65          57        A
#   visual            —           —        A   (not written yet: a named FAIL, see below)
#   validate_live     74          56        B
#   waiver_log        73          53        B
#   prices           93           73        B
#   verify.sh      8 813      11 176       B
#   pull_guard    12 593      12 247       B
#   unit_engine    6 256       6 028       C
#   components    37 777      40 279       C
#   steps 1-4          —       3 974       tdz 565 · esbuild 764 · build 1 567 · tdz 1 078
#
# So group A costs 276 ms in order, group B 23 605 ms, group C 46 307 ms, and everything before
# the first browser launches 73 882 ms — 74 s. The in-order column runs slower than the own-run
# column because other agents were working this tree at the same time; neither number is wrong,
# and the gap is the reason the per-step wall-clock is printed on every run instead of being
# written down once here.
#
# The change that came out of measuring: pull_guard used to sit third, ahead of four suites that
# come to 240 ms between them, so a red in any of those waited 12.6 s behind a suite that stands
# up a real HTTP server. It now runs last in its group.
#
# Group D and group E are NOT measured here. Timing them means launching three browsers and two
# million-iteration suites while other agents hold this tree, so the figure would be noise. The
# verdict prints the whole table, so the next uninterrupted run answers it by measurement. Until
# then, one ordering question stays open and is deliberately left as it is: components (40 s,
# no browser) runs before the browser suites on the grounds that a deterministic red beats a
# possibly-flaky one, and moving it after them would only pay off in wall-clock if the browser
# suites together come to less than 40 s. Nobody has measured that, so nobody should assume it.
#
# components is the component OUTPUT suite (qa/components.cjs): every React component rendered
# on its own through react-dom/server from the real snapshot, then from four degraded contexts,
# then with the 20 junk kinds in one prop slot at a time. mc_full fuzzes the components' props
# contract; this one fuzzes what comes out. It launches no browser — which is why it sits in
# group C, ahead of the browser suites, and not among them.
#
# webkit is the Safari-engine acceptance suite (qa/webkit.js): the manager reads this app on an
# iPhone, so the Part G gates and the storage paths are re-measured under WebKit, not only in
# Chromium. It launches playwright.webkit directly — never `npx playwright install webkit`.
#
# browser.py is the phone-render suite (E5): Playwright at 390×844 in light and dark mode. It is
# Python, so py_suite runs it, prints the interpreter and the exit code, and turns a missing
# interpreter or a missing Playwright into a named FAIL. A Python suite that skips itself when
# its dependency is absent is a check that cannot fail, which is worse than no check.
#
# Prints ALL PASS only when every step passed. A suite file that does not exist yet is a
# clear FAIL line naming the missing file, never a crash — the suites are written by
# several agents in parallel and this script has to stay runnable in between.
#
# Run from fpl/:  bash qa/run.sh              (npm run qa) — mc_full at the 3000 dev count
# Release run:    bash qa/run.sh --release    — mc_full at the 25000 release count (CLAUDE.md H3)
# Help:           bash qa/run.sh --help       — flags, environment, exit codes, suite order
#
# A TAG IS CUT ONLY AFTER A --release RUN. The dev count is for the edit loop; the release count
# is what actually found E-035 (binomial looping without bound) and E-036 (clamp returning NaN
# from the helper that guarantees probabilities sit in [0,1]). Neither showed up at 3000.
# MC_ITERS=<n> still works and overrides both.

set -uo pipefail

MC_DEV_ITERS=3000
MC_RELEASE_ITERS=25000

usage() {
  cat <<'USAGE'
usage: bash qa/run.sh [--release] [-h|--help]

flags
  --release      run mc_full at the 25000 release count instead of the 3000 dev count.
                 A tag is cut only after a --release run (CLAUDE.md H3).
  -h, --help     this text. Takes no lock and runs nothing.
  --dry-run      print the ordered step list and exit 0. Takes no lock, builds nothing and
                 runs no suite. The list is printed BY the call sites themselves, so it
                 cannot drift from what a real run does, and each suite is marked present
                 or MISSING. This is how the order here is compared against gate.yml.
  --lock-selftest[=SECONDS]
                 take the run lock, print what was written into it, hold it for SECONDS
                 (default 5), release it and exit 0. Runs no suite and builds nothing.
                 This is how the lock itself is exercised — a refusal, a stale reclaim and
                 the signal paths — without a 13-minute gate run underneath it.

environment
  MC_ITERS=<n>          override the mc_full iteration count in either mode.
  FPL_GATE_LOCK=<path>  where the run lock lives. Default: $TMPDIR (or /tmp), named after
                        this tree, so two different checkouts never block each other.

the run lock
  One gate run per tree at a time. Two overlapping runs rebuild app/ and dist/ underneath
  each other's suites; on 26 September 2026 that flapped verify.sh I8 and moved the step
  numbers between runs. A second run is REFUSED and names the pid holding the lock and the
  time it took it. A lock left behind by a run that was killed is detected and reclaimed,
  not waited on — the holder is judged gone when its pid is dead, or when that pid has been
  recycled by a different process (its start time no longer matches the one recorded). The
  lock is released on normal exit and on SIGINT, SIGTERM and SIGHUP.

exit codes
  0    ALL PASS
  1    at least one step red (NOT ALL PASS), or fpl/ is unreachable
  2    unknown argument
  75   refused — another run holds the lock (EX_TEMPFAIL: retry later)
  129  SIGHUP · 130  SIGINT · 143  SIGTERM   (the lock is released first)

suite order
  cheap and deterministic first, then data, then browser suites, then the million-iteration
  ones. Every step prints its own wall-clock; the verdict prints the whole table.

    0 lock · 1 tdz(sources) · 2 esbuild · 3 build · 4 tdz(built app)
    A privacy · no_frozen · visual
    B validate_live · waiver_log · prices · verify.sh · pull_guard
    C unit_engine · components
    D smoke · smoke_wk · realistic · buttons · webkit · browser.py
    E mc_full · mc_all
USAGE
}

RELEASE=0
LOCK_SELFTEST=0
DRY=0
for arg in "$@"; do
  case "$arg" in
    --release) RELEASE=1 ;;
    --dry-run) DRY=1 ;;
    --lock-selftest) LOCK_SELFTEST=5 ;;
    --lock-selftest=*) LOCK_SELFTEST="${arg#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "run.sh: unknown argument '$arg' (only --release and --help are understood)"; exit 2 ;;
  esac
done

case "$LOCK_SELFTEST" in
  ''|*[!0-9]*) echo "run.sh: --lock-selftest takes a whole number of seconds, not '$LOCK_SELFTEST'"; exit 2 ;;
esac

# BASH_SOURCE, not $0: when this file is sourced (library mode, below) $0 is the sourcing
# script and this would cd somewhere else entirely. Executed, the two are the same.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || { echo "FAIL run.sh — cannot reach the fpl/ directory"; exit 1; }

# ---------------------------------------------------------------- 0. the run lock
#
# mkdir is the atomic primitive: for one path, exactly one caller's mkdir succeeds. The
# holder's pid, its process start time and the wall-clock it took the lock are written
# inside, so a refusal can name the holder and a reclaim can prove the holder is gone.
#
# Why the start time and not just the pid: pids are recycled. `kill -0` on a recycled pid
# succeeds and would make a finished run look like a live one forever — a deadlock. The
# start time (field 22 of /proc/<pid>/stat, ticks since boot) is recorded at acquire time
# and re-read at inspection time; a mismatch means this pid is now a different process.
# Where /proc is not readable the script falls back to `ps -o lstart=`, and where neither
# is available it trusts `kill -0` alone and says so.

LOCK_EXIT=75
LOCK_DIR="${FPL_GATE_LOCK:-${TMPDIR:-/tmp}/fpl-gate$(printf '%s' "$PWD" | tr -c 'A-Za-z0-9._-' '_').lock}"
LOCK_HELD=0

# lock_start_token <pid> — a stable identity for a running pid, or empty if unobtainable.
lock_start_token() {
  local pid="$1" st
  if [ -r "/proc/$pid/stat" ]; then
    st=$(cat "/proc/$pid/stat" 2>/dev/null) || return 0
    # "<pid> (<comm>) <state> …" — comm can hold spaces and brackets, so cut at its LAST ") ".
    st=${st##*') '}
    # starttime is field 22 of the line, i.e. field 20 of what is left after "<pid> (<comm>) ".
    printf '%s' "$st" | awk '{print $20}'
    return 0
  fi
  if command -v ps >/dev/null 2>&1; then
    ps -o lstart= -p "$pid" 2>/dev/null | tr -s ' ' | sed 's/^ *//;s/ *$//'
    return 0
  fi
  printf ''
}

# lock_read <name> — one line of the lock's state, or empty.
lock_read() {
  [ -r "$LOCK_DIR/$1" ] || { printf ''; return 0; }
  head -n 1 "$LOCK_DIR/$1" 2>/dev/null | tr -d '\n'
}

# lock_holder_state — prints "alive", or "gone: <why>", for whatever holds the lock now.
lock_holder_state() {
  local pid recorded live
  pid=$(lock_read pid)
  case "$pid" in
    '') echo "gone: the lock carries no pid (a run was killed between taking it and writing it)"; return 0 ;;
    *[!0-9]*) echo "gone: the lock's pid '$pid' is not a number"; return 0 ;;
  esac
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "gone: no such process $pid"
    return 0
  fi
  recorded=$(lock_read start)
  live=$(lock_start_token "$pid")
  if [ -n "$recorded" ] && [ -n "$live" ] && [ "$recorded" != "$live" ]; then
    echo "gone: pid $pid exists but was recycled (start $live, the lock recorded $recorded)"
    return 0
  fi
  if [ -z "$recorded" ] || [ -z "$live" ]; then
    echo "alive: pid $pid answers, and no start time is available to check it against"
    return 0
  fi
  echo "alive"
}

lock_write_state() {
  printf '%s\n' "$$"                        > "$LOCK_DIR/pid"
  printf '%s\n' "$(lock_start_token "$$")"  > "$LOCK_DIR/start"
  printf '%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$LOCK_DIR/since"
  printf '%s\n' "$(date '+%s')"             > "$LOCK_DIR/epoch"
  printf '%s\n' "bash qa/run.sh$( [ "$RELEASE" -eq 1 ] && printf ' --release' )" > "$LOCK_DIR/cmd"
}

lock_refuse() {
  local pid since epoch cmd state ago now
  pid=$(lock_read pid); since=$(lock_read since); epoch=$(lock_read epoch); cmd=$(lock_read cmd)
  state="$1"
  now=$(date '+%s')
  if [ -n "$epoch" ]; then ago="$(( now - epoch )) s ago"; else ago="unknown"; fi
  hr
  echo "REFUSED — another gate run holds the lock for this tree."
  echo "  lock     $LOCK_DIR"
  echo "  holder   pid ${pid:-unknown} · ${state}"
  echo "  since    ${since:-unknown} (${ago})"
  echo "  command  ${cmd:-unknown}"
  hr
  echo "Two overlapping runs rebuild app/ and dist/ underneath each other's suites. That is"
  echo "what made verify.sh I8 flap and the step numbers move on 26 September 2026."
  echo "Wait for pid ${pid:-?} to finish, or stop it and run again. Exit code $LOCK_EXIT."
  exit "$LOCK_EXIT"
}

lock_acquire() {
  local tries=0 state stale
  while [ "$tries" -lt 4 ]; do
    tries=$(( tries + 1 ))
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      LOCK_HELD=1
      lock_write_state
      echo "LOCK taken by pid $$ · $LOCK_DIR"
      return 0
    fi
    state=$(lock_holder_state)
    case "$state" in
      alive*) lock_refuse "$state" ;;
    esac
    # Stale. Move it aside before recreating it: of two runs that both find it stale, only
    # one `mv` can succeed, and the loser falls through to another pass of this loop.
    stale="$LOCK_DIR.stale.$$"
    if mv "$LOCK_DIR" "$stale" 2>/dev/null; then
      echo "LOCK stale — reclaimed. Previous holder: $(printf '%s' "$state" | sed 's/^gone: //')."
      echo "     it took the lock at $(head -n 1 "$stale/since" 2>/dev/null | tr -d '\n' || printf 'unknown')."
      rm -rf "$stale"
    else
      echo "LOCK stale — another run reclaimed it first; retrying (pass $tries)."
    fi
  done
  hr
  echo "REFUSED — could not take $LOCK_DIR after $tries passes."
  echo "Remove it by hand if no gate run is in progress. Exit code $LOCK_EXIT."
  exit "$LOCK_EXIT"
}

lock_release() {
  [ "$LOCK_HELD" -eq 1 ] || return 0
  # Only ever remove a lock this process owns. A run that was refused never reaches here
  # with LOCK_HELD=1, so it can never delete the live holder's lock.
  if [ "$(lock_read pid)" = "$$" ]; then
    rm -rf "$LOCK_DIR"
  fi
  LOCK_HELD=0
}

lock_on_signal() {
  local sig="$1" code="$2"
  echo
  hr
  echo "run.sh — $sig received. Releasing the lock and stopping (exit $code)."
  lock_release
  trap - EXIT
  exit "$code"
}

APP="app/FPL_Mission_Control.jsx"
ENGINE="src/engine.js"
UI="src/ui.jsx"

if [ "$RELEASE" -eq 1 ]; then
  MC_ITERS="${MC_ITERS:-$MC_RELEASE_ITERS}"
else
  MC_ITERS="${MC_ITERS:-$MC_DEV_ITERS}"
fi

STEPS=0
FAILED=0
declare -a RED=()
declare -a TIMES=()
STEP_LABEL=""
STEP_T0=0

hr() { printf '%s\n' "------------------------------------------------------------"; }

# EPOCHREALTIME (bash 5.0+) costs no process and needs no GNU date: `date +%s%N` prints a
# literal N on any date without the GNU extension, and `$(( 1790441775N / 1000000 ))` is not a
# timing, it is a syntax error. The decimal separator follows the locale, hence the comma.
now_ms() {
  local e="${EPOCHREALTIME:-}" n
  if [ -n "$e" ]; then
    e="${e/,/.}"
    printf '%s' "$(( ${e%%.*} * 1000 + 10#${e#*.} / 1000 ))"
    return 0
  fi
  n=$(date '+%s%N')
  case "$n" in *[!0-9]*) printf '0'; return 0 ;; esac
  printf '%s' "$(( n / 1000000 ))"
}

record_fail() {
  FAILED=$((FAILED + 1))
  RED+=("$1")
}

begin_step() {
  STEP_LABEL="$1"
  STEPS=$((STEPS + 1))
  hr
  echo "STEP $STEPS · $STEP_LABEL"
  STEP_T0=$(now_ms)
}

# end_step <rc> [detail]
end_step() {
  local rc="$1" detail="${2:-}" dt
  dt=$(( $(now_ms) - STEP_T0 ))
  TIMES+=("$STEP_LABEL|$dt")
  if [ "$rc" -eq 0 ]; then
    echo "OK   $STEP_LABEL · ${dt} ms"
  else
    echo "FAIL $STEP_LABEL — ${detail:-exited $rc} · ${dt} ms"
    record_fail "$STEP_LABEL"
  fi
}

# end_step_missing <reason> — a step that could not run at all.
end_step_missing() {
  local dt
  dt=$(( $(now_ms) - STEP_T0 ))
  TIMES+=("$STEP_LABEL|$dt")
  echo "FAIL $STEP_LABEL — $1"
  record_fail "$STEP_LABEL ($1)"
}

# dry <runner> <label> [file] — the --dry-run line for one step, printed by the call site.
dry() {
  local runner="$1" label="$2" file="${3:-}" mark=""
  STEPS=$((STEPS + 1))
  if [ -n "$file" ]; then
    if [ -f "$file" ]; then mark="present"; else mark="MISSING"; fi
    printf '%3d  %-9s %-28s %s\n' "$STEPS" "$runner" "$label" "$mark"
  else
    printf '%3d  %-9s %-28s %s\n' "$STEPS" "$runner" "$label" "(internal step)"
  fi
}

# step <label> <command…>
step() {
  local label="$1"; shift
  if [ "$DRY" -eq 1 ]; then dry "internal" "$label"; return 0; fi
  begin_step "$label"
  if "$@"; then end_step 0; else end_step "$?" "command exited non-zero"; fi
}

# node_suite <file> [node-flags…] — flags go BEFORE the file, the way node takes them.
node_suite() {
  local file="$1"; shift
  if [ "$DRY" -eq 1 ]; then dry "node" "$file" "$file"; return 0; fi
  begin_step "${file#qa/}"
  if [ ! -f "$file" ]; then
    end_step_missing "$file does not exist yet (suite not written)"
    return 0
  fi
  if node "$@" "$file" 2>&1; then end_step 0; else end_step "$?" "suite exited non-zero"; fi
}

# node_suite_arg <file> <script-arg> [node-flags…] — one argument for the suite itself.
node_suite_arg() {
  local file="$1" sarg="$2"; shift 2
  if [ "$DRY" -eq 1 ]; then dry "node" "$file $sarg" "$file"; return 0; fi
  begin_step "${file#qa/} $sarg"
  if [ ! -f "$file" ]; then
    end_step_missing "$file does not exist yet (suite not written)"
    return 0
  fi
  if node "$@" "$file" "$sarg" 2>&1; then end_step 0; else end_step "$?" "suite exited non-zero"; fi
}

node_suite_args() { local file="$1"; shift; if [ "$DRY" -eq 1 ]; then dry "node" "$file $*" "$file"; return 0; fi; begin_step "${file#qa/} $*"; if [ ! -f "$file" ]; then end_step_missing "$file does not exist yet (suite not written)"; return 0; fi; if node "$file" "$@" 2>&1; then end_step 0; else end_step "$?" "suite exited non-zero"; fi; }   # node_suite_args <file> <script-args…> — several arguments for the suite itself, no node flags

# sh_suite <file> — same treatment for the bash suites.
sh_suite() {
  local file="$1"
  if [ "$DRY" -eq 1 ]; then dry "bash" "$file" "$file"; return 0; fi
  begin_step "${file#qa/}"
  if [ ! -f "$file" ]; then
    end_step_missing "$file does not exist yet (suite not written)"
    return 0
  fi
  if bash "$file" 2>&1; then end_step 0; else end_step "$?" "script exited non-zero"; fi
}

# py_suite <file> [script-args…] — a Python suite.
#
# Three ways a Python suite can fail to run, and none of them is allowed to be a silent skip:
# the file is missing, there is no interpreter, or Playwright for Python is not importable.
# Each is a named FAIL with the fix on the next line. The suite's own exit code is printed
# whatever it is, so a non-zero that carries no output is still attributable.
py_suite() {
  local file="$1"; shift
  local py="" cand want rc
  if [ "$DRY" -eq 1 ]; then dry "python3" "$file" "$file"; return 0; fi
  begin_step "${file#qa/}"
  if [ ! -f "$file" ]; then
    end_step_missing "$file does not exist yet (suite not written)"
    return 0
  fi
  for cand in python3 python; do
    if command -v "$cand" >/dev/null 2>&1; then py="$cand"; break; fi
  done
  if [ -z "$py" ]; then
    end_step_missing "no python3 (or python) on PATH, so $file cannot run — install Python 3"
    return 0
  fi
  echo "interpreter $py $("$py" -c 'import sys; print(sys.version.split()[0])' 2>/dev/null || printf '?')"
  if ! "$py" -c 'import playwright.sync_api' >/dev/null 2>&1; then
    want=$(node -e 'try{process.stdout.write(String(require("./package.json").devDependencies.playwright||""))}catch(e){}' 2>/dev/null)
    echo "     Playwright for Python is not importable. $file drives a real browser, so this"
    echo "     is a missing dependency, not a reason to skip the suite."
    if [ -n "$want" ]; then
      echo "     fix: $py -m pip install 'playwright==$want' && $py -m playwright install chromium"
      echo "          ($want is what package.json pins for the Node suites; matching the two keeps"
      echo "           one set of browser builds on disk)"
    else
      echo "     fix: $py -m pip install playwright && $py -m playwright install chromium"
    fi
    end_step_missing "Playwright for Python is not importable"
    return 0
  fi
  "$py" "$file" "$@" 2>&1
  rc=$?
  if [ "$rc" -eq 0 ]; then end_step 0; else end_step "$rc" "$py exited $rc"; fi
}

# ---------------------------------------------------------------- library mode
#
# FPL_RUN_SH_LIB=1 makes this file define its helpers and stop: no lock, no build, no suite.
# It exists so the helpers above can be exercised against THIS file rather than a copy of it
# — py_suite's three refusal paths in particular, which are what stop a Python suite from
# skipping itself when Playwright is absent. Nothing in the gate sets it.
if [ -n "${FPL_RUN_SH_LIB:-}" ]; then
  return 0 2>/dev/null || exit 0
fi

# The traps go on before the lock is taken, so a signal in the window between mkdir and the
# pid being written still releases. A lock dir with no pid reads as stale to the next run.
#
# Measured on bash 5.2.21, 26 September 2026, by removing each trap and sending SIGTERM to a
# --lock-selftest run. DO NOT prune either of these as dead code — they are independently
# sufficient, not duplicated:
#   EXIT trap only, no TERM trap  → lock released (bash runs an EXIT trap when a fatal signal
#                                   kills the shell), exit 143, but no line saying why
#   TERM trap only, no EXIT trap  → lock released, exit 143, with the line
#   neither                       → LOCK LEAKS, exit 143
# So the property "a signalled run releases its lock" only goes red when both are gone. The
# EXIT trap also covers the ordinary path and any exit 1; the signal traps add the message
# and pin the exit code rather than inheriting bash's 128+n.
#
# SIGKILL cannot be trapped at all, which is the whole reason stale reclaim exists.
#
# One inherited-disposition trap, found while proving this: a run started as a BACKGROUND job
# of a non-interactive shell inherits SIGINT as SIG_IGN, and POSIX forbids a shell from
# trapping a signal that was ignored on entry — so `kill -INT` on such a run does nothing and
# the INT trap never installs. The EXIT trap still releases the lock when it finishes. The
# signal paths must therefore be tested against a FOREGROUND run.
trap 'lock_release' EXIT
trap 'lock_on_signal SIGINT 130' INT
trap 'lock_on_signal SIGTERM 143' TERM
trap 'lock_on_signal SIGHUP 129' HUP

if [ "$DRY" -eq 1 ]; then
  echo "DRY RUN · qa/run.sh step order (nothing is executed, no lock is taken)"
  echo "  mc_full would run at $MC_ITERS iterations"
  hr
  printf '%3s  %-9s %-28s %s\n' "#" "runner" "file or step" "state"
  hr
else
  lock_acquire
fi

# --lock-selftest: hold the lock and do nothing else. The sleep is sliced into seconds so a
# SIGINT or SIGTERM is serviced within one second rather than after the whole hold — bash
# defers a trap until the running foreground command returns.
if [ "$LOCK_SELFTEST" -gt 0 ]; then
  hr
  echo "LOCK SELF-TEST · holding for ${LOCK_SELFTEST}s, running no suites"
  echo "  dir      $LOCK_DIR"
  echo "  pid      $(lock_read pid)"
  echo "  start    $(lock_read start)   (process start token, /proc/<pid>/stat field 22)"
  echo "  since    $(lock_read since)"
  echo "  epoch    $(lock_read epoch)"
  echo "  cmd      $(lock_read cmd)"
  echo "  state    $(lock_holder_state)"
  i=0
  while [ "$i" -lt "$LOCK_SELFTEST" ]; do sleep 1; i=$(( i + 1 )); done
  hr
  echo "LOCK SELF-TEST · releasing"
  lock_release
  trap - EXIT
  if [ -d "$LOCK_DIR" ]; then echo "FAIL lock self-test — $LOCK_DIR still exists after release"; exit 1; fi
  echo "LOCK released · $LOCK_DIR is gone"
  exit 0
fi

RUN_T0=$(now_ms)

# ---------------------------------------------------------------- 1. TDZ

# The sources only. The assembled app is scanned AFTER the build (step 4) — scanning it here
# would scan the PREVIOUS build's file and report a verdict on code that is about to be
# replaced (E-053).
tdz() {
  local targets=()
  [ -f "$ENGINE" ] && targets+=("$ENGINE")
  [ -f "$UI" ] && targets+=("$UI")
  if [ ${#targets[@]} -eq 0 ]; then
    echo "no source files to scan"
    return 1
  fi
  node qa/tdz_check.cjs --self-test || return 1
  node qa/tdz_check.cjs "${targets[@]}"
}
if [ -f qa/tdz_check.cjs ]; then
  step "tdz_check (self-test + sources)" tdz
else
  begin_step "tdz_check"
  end_step_missing "qa/tdz_check.cjs does not exist"
fi

# ---------------------------------------------------------------- 2. esbuild syntax gate

esbuild_gate() {
  local target=""
  if [ -f "$APP" ]; then target="$APP"; elif [ -f "$UI" ]; then target="$UI"; else target="$ENGINE"; fi
  if [ ! -f "$target" ]; then
    echo "nothing to compile: $target is missing"
    return 1
  fi
  echo "compiling $target"
  npx --no-install esbuild "$target" --bundle --loader:.jsx=jsx --jsx=automatic --outfile=/dev/null
}
step "esbuild syntax gate" esbuild_gate

# ---------------------------------------------------------------- 3. build

build_step() {
  if [ ! -f build.cjs ]; then
    echo "build.cjs does not exist yet (the assembler is written with the UI)"
    return 1
  fi
  node build.cjs
}
step "build (build.cjs → app/ + dist/)" build_step

# ---------------------------------------------------------------- 4. TDZ on the built app

# E-053: the assembled file is what ships and what every browser suite loads, so it is scanned
# here, after build.cjs has just written it — never before.
tdz_built() {
  if [ ! -f "$APP" ]; then
    echo "$APP was not produced by the build step"
    return 1
  fi
  node qa/tdz_check.cjs "$APP"
}
if [ -f qa/tdz_check.cjs ]; then
  step "tdz_check (freshly built app)" tdz_built
else
  begin_step "tdz_check (freshly built app)"
  end_step_missing "qa/tdz_check.cjs does not exist"
fi

# ---------------------------------------------------------------- A. cheap and deterministic
#
# No browser, no network, no snapshot arithmetic. 291 ms for the two that exist, measured
# 26 September 2026 — so a red here is the cheapest red in the gate.

node_suite qa/privacy.cjs         # rival managers' names are never committed (E-085) — 226 ms alone, 219 in order
node_suite qa/no_frozen.cjs       # no check compares a live-sourced field to a literal (E-084) — 65 ms alone, 57 in order
node_suite qa/visual.cjs          # the contrast and layout assertions (audit_contrast, audit_layout)

# ---------------------------------------------------------------- B. data
#
# validate_live first: it is the snapshot's shape, which the three suites after it assume.
# verify.sh and pull_guard come last in the group because they are the expensive two — 8.8 s
# and 12.6 s against 74-93 ms for the rest. pull_guard stands up a real HTTP server.

node_suite data/validate_live.cjs # the snapshot against CONTRACT §3 — 74 ms alone, 56 in order
node_suite qa/waiver_log.cjs      # the waiver model reproduces the league's own log, 74/74 (B6, E4) — 73 ms alone, 53 in order
node_suite qa/prices.cjs          # selling prices against golden.classic.sell (A3) — 93 ms alone, 73 in order
node_suite qa/parity.cjs          # the v111 engine module against golden.json, solver_in.json and the reference implementation (B1–B9, E2) — 3 611 ms alone
node_suite qa/bake.cjs            # the bake reproduces the reference block; recon, free transfers, transfer log, INTEL (A2, A4-A7) — 580 ms alone
node_suite qa/export_hash.cjs     # the solver input reproduces reference solver_in.json with the same content hash; stable under a re-bake, moved by a changed input (A8, E-101) — 4 844 ms alone
node_suite qa/calibration.cjs     # the calibration stage reproduces the kit's model block on a copy of the block; the backtest is uncalibrated and idempotent; the committed block carries it (A9) — 4 006 ms alone
node_suite_arg qa/plan_legality.cjs --plan=data/plan.json   # every week of the shipped plan obeys the rules; the ledger replayed, never the solver's fields (E3, C1–C3, C5, §7.1 §7.9 §7.10) — 469 ms alone; a missing plan file is a FAIL, not a skip; golden is not run here because its numbers were recorded on the reference data
node_suite_args qa/plan_legality.cjs --plan=data/plan_reference.json --data=reference/v109/app/data.json --golden=reference/v109/app/golden.json   # the reference input re-solved by the ported optimiser (proven optimal within 0.5%) against the C acceptance in golden.json; the acceptance is the spec's, with its tolerance, and an objective at least the recorded incumbent's (E-106) — 55/55 on 27 Sep, every acceptance check mutation-proven
sh_suite   qa/verify.sh           # live reconciliation + invariants — 8 813 ms alone, 11 176 in order
node_suite qa/pull_guard.cjs      # pipeline/pull.sh keeps the last good feed (A1) — 12 593 ms alone, 12 247 in order
sh_suite   qa/solver_smoke.sh     # a 30-second solve → plan.cjs → legality shape checks (gap skipped by name); the full optimiser never runs here (E6, C6, §7.2) — 54 839 ms alone, last in the group because it is the dearest

# ---------------------------------------------------------------- C. engine and render (no browser)

node_suite qa/unit_engine.cjs     # 6 256 ms alone, 6 028 in order
node_suite qa/components.cjs      # component output under react-dom/server, valid + degraded + junk — 37 777 ms alone, 40 279 in order

# ---------------------------------------------------------------- D. browser suites
#
# Chromium for the first four, WebKit for the fifth, Python Playwright for the sixth.

node_suite qa/smoke.cjs
node_suite qa/smoke_wk.cjs
node_suite qa/realistic.cjs
node_suite qa/buttons.cjs
node_suite qa/webkit.js
py_suite   qa/browser.py          # E5 phone render: 390×844, light and dark, every tab

# ---------------------------------------------------------------- E. the million-iteration suites

# mc_full takes the iteration count as an argument and needs a deeper stack.
node_suite_arg qa/mc_full.cjs "$MC_ITERS" --stack-size=4000
node_suite qa/mc_all.cjs

# ---------------------------------------------------------------- verdict

if [ "$DRY" -eq 1 ]; then
  hr
  echo "$STEPS steps. Compare against .github/workflows/gate.yml, which runs the same list in"
  echo "the same order (its extra steps are checkout, setup-node, npm ci, setup-python, the two"
  echo "Playwright installs, and the final no-FAIL scan of the combined log)."
  exit 0
fi

hr
RUN_MS=$(( $(now_ms) - RUN_T0 ))
echo "WALL-CLOCK per step (ms)"
for t in "${TIMES[@]}"; do
  printf '  %-34s %8s\n' "${t%%|*}" "${t##*|}"
done
printf '  %-34s %8s\n' "TOTAL" "$RUN_MS"
hr
if [ "$RELEASE" -eq 1 ]; then
  echo "MODE release · mc_full ran at $MC_ITERS iterations (a tag is cut only after a --release run)"
else
  echo "MODE dev · mc_full ran at $MC_ITERS iterations · run 'bash qa/run.sh --release' ($MC_RELEASE_ITERS) before cutting a tag"
fi
if [ "$FAILED" -eq 0 ]; then
  echo "ALL PASS ($STEPS steps, $RUN_MS ms)"
  exit 0
fi
echo "RED: $FAILED of $STEPS steps failed"
for r in "${RED[@]}"; do echo "  - $r"; done
echo "NOT ALL PASS"
exit 1

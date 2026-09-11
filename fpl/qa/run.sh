#!/usr/bin/env bash
# qa/run.sh — the full gate (CONTRACT §8, CLAUDE.md H1/H3).
#
#   tdz (self-test + sources) → esbuild → build → tdz (built app) → verify → unit_engine
#       → smoke → smoke_wk → realistic → buttons → mc_full 3000 → mc_all
#
# Prints ALL PASS only when every step passed. A suite file that does not exist yet is a
# clear FAIL line naming the missing file, never a crash — the suites are written by
# several agents in parallel and this script has to stay runnable in between.
#
# Run from fpl/:  bash qa/run.sh      (npm run qa)
# Release run:    MC_ITERS=25000 bash qa/run.sh

set -uo pipefail

cd "$(dirname "$0")/.." || { echo "FAIL run.sh — cannot reach the fpl/ directory"; exit 1; }

APP="app/FPL_Mission_Control.jsx"
ENGINE="src/engine.js"
UI="src/ui.jsx"
MC_ITERS="${MC_ITERS:-3000}"

STEPS=0
FAILED=0
declare -a RED=()

hr() { printf '%s\n' "------------------------------------------------------------"; }

record_fail() {
  FAILED=$((FAILED + 1))
  RED+=("$1")
}

# step <label> <command…>
step() {
  local label="$1"; shift
  STEPS=$((STEPS + 1))
  hr
  echo "STEP $STEPS · $label"
  if "$@"; then
    echo "OK   $label"
  else
    echo "FAIL $label — command exited non-zero"
    record_fail "$label"
  fi
}

# node_suite <file> [args…] — a missing file is a FAIL line, not a crash.
node_suite() {
  local file="$1"; shift
  local label="${file#qa/}"
  STEPS=$((STEPS + 1))
  hr
  echo "STEP $STEPS · $label"
  if [ ! -f "$file" ]; then
    echo "FAIL $label — $file does not exist yet (suite not written)"
    record_fail "$label (missing $file)"
    return 0
  fi
  if node "$@" "$file" 2>&1; then
    echo "OK   $label"
  else
    echo "FAIL $label — suite exited non-zero"
    record_fail "$label"
  fi
}

# sh_suite <file> — same treatment for the bash suites.
sh_suite() {
  local file="$1"
  local label="${file#qa/}"
  STEPS=$((STEPS + 1))
  hr
  echo "STEP $STEPS · $label"
  if [ ! -f "$file" ]; then
    echo "FAIL $label — $file does not exist yet (suite not written)"
    record_fail "$label (missing $file)"
    return 0
  fi
  if bash "$file" 2>&1; then
    echo "OK   $label"
  else
    echo "FAIL $label — script exited non-zero"
    record_fail "$label"
  fi
}

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
  STEPS=$((STEPS + 1)); hr; echo "STEP $STEPS · tdz_check"
  echo "FAIL tdz_check — qa/tdz_check.cjs does not exist"
  record_fail "tdz_check (missing qa/tdz_check.cjs)"
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
  STEPS=$((STEPS + 1)); hr; echo "STEP $STEPS · tdz_check (freshly built app)"
  echo "FAIL tdz_check (freshly built app) — qa/tdz_check.cjs does not exist"
  record_fail "tdz_check built (missing qa/tdz_check.cjs)"
fi

# ---------------------------------------------------------------- 5-12. the suites

sh_suite qa/verify.sh
node_suite qa/unit_engine.cjs
node_suite qa/smoke.cjs
node_suite qa/smoke_wk.cjs
node_suite qa/realistic.cjs
node_suite qa/buttons.cjs

# mc_full takes the iteration count as an argument and needs a deeper stack.
STEPS=$((STEPS + 1))
hr
echo "STEP $STEPS · mc_full.cjs $MC_ITERS"
if [ ! -f qa/mc_full.cjs ]; then
  echo "FAIL mc_full.cjs — qa/mc_full.cjs does not exist yet (suite not written)"
  record_fail "mc_full.cjs (missing qa/mc_full.cjs)"
elif node --stack-size=4000 qa/mc_full.cjs "$MC_ITERS" 2>&1; then
  echo "OK   mc_full.cjs $MC_ITERS"
else
  echo "FAIL mc_full.cjs — suite exited non-zero"
  record_fail "mc_full.cjs"
fi

node_suite qa/mc_all.cjs

# ---------------------------------------------------------------- verdict

hr
if [ "$FAILED" -eq 0 ]; then
  echo "ALL PASS ($STEPS steps)"
  exit 0
fi
echo "RED: $FAILED of $STEPS steps failed"
for r in "${RED[@]}"; do echo "  - $r"; done
echo "NOT ALL PASS"
exit 1

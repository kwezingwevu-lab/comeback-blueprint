#!/bin/bash
# qa/fail_scan.sh — the "no FAIL in the log" sweep, in one place for gate.yml and refresh.yml (ERRORS.md E-141).
#
#   bash qa/fail_scan.sh <log file or directory>   exit 1 and print the lines when a suite failed, else exit 0
#   bash qa/fail_scan.sh --self-test               prove the pattern on planted logs
#
# A failure is a line that STARTS with FAIL (or "TDZ FAIL"), which is how ok(), run.sh and every suite print one.
# The sweep used to match the word anywhere, so the mutation proofs, which quote the check they turned red, made CI
# red on every run from 28 Sep. The proofs now print "RED <check>", and this anchor keeps a quoted FAIL from counting.
set -uo pipefail
PAT='^[[:space:]]*(TDZ )?FAIL( |:|$)'
if [ "${1:-}" = "--self-test" ]; then
  d="$(mktemp -d)"; bad=0
  printf 'PASS mutation: x turns y red — red: FAIL y — detail\nPASS a — no FAIL here\nSUITE z 3/3\n' > "$d/clean.log"
  printf 'PASS a\nFAIL b — exited 1\n' > "$d/red.log"
  printf 'TDZ FAIL src/x.js\n' > "$d/tdz.log"
  grep -qE "$PAT" "$d/clean.log" && { echo "FAIL fail_scan self-test — a quoted FAIL inside a PASS line counted"; bad=1; }
  grep -qE "$PAT" "$d/red.log" || { echo "FAIL fail_scan self-test — a FAIL at line start was missed"; bad=1; }
  grep -qE "$PAT" "$d/tdz.log" || { echo "FAIL fail_scan self-test — a TDZ FAIL was missed"; bad=1; }
  rm -rf "$d"
  [ $bad = 0 ] && echo "PASS fail_scan self-test — quoted FAIL ignored, line-start FAIL and TDZ FAIL caught"
  exit $bad
fi
[ -e "${1:-}" ] || { echo "FAIL fail_scan — no log at '${1:-}'"; exit 1; }
if grep -rnE "$PAT" "$1"; then echo "a suite printed FAIL (lines above)"; exit 1; fi
echo "no FAIL at the start of any line in $1"

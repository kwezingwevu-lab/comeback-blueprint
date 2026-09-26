#!/usr/bin/env bash
# Every gate in one go: syntax -> build -> Chromium functional suite -> PWA/offline suite -> WebKit (Safari engine)
# -> calendar-helper self-test. Each gate is judged on its own pass line, not on an exit code a pipe could swallow.
# WebKit needs: npx playwright install webkit && npx playwright install-deps webkit (Linux).
# Real fonts for screenshots: bash tools/fetch_fonts.sh (optional).
cd "$(dirname "$0")/.."
fail=0
gate(){ local want="$1";shift;local out;out=$("$@" 2>&1);echo "$out"|tail -3;echo "$out"|grep -q "$want"||{ echo "GATE FAILED: $*";fail=1; }; }
gate "^ALL PASS" bash qa/run.sh
gate "PWA ALL PASS" node qa/pwa.js
gate "WEBKIT ALL PASS" node qa/webkit.js
gate "CALENDAR HELPER SELFTEST PASS" node tools/calendar_refresh.js --selftest
[ $fail -eq 0 ] && echo "ALL GATES GREEN" || { echo "A GATE FAILED"; exit 1; }

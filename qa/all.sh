#!/usr/bin/env bash
# Every gate in one go: syntax -> build -> Chromium functional suite -> PWA/offline suite -> WebKit (Safari engine).
# WebKit needs: npx playwright install webkit && npx playwright install-deps webkit (Linux). Real fonts for audit
# screenshots: bash tools/fetch_fonts.sh (optional).
set -o pipefail
cd "$(dirname "$0")/.."
fail=0
bash qa/run.sh || fail=1
node qa/pwa.js | tail -3 || fail=1
node qa/webkit.js | tail -3 || fail=1
[ $fail -eq 0 ] && echo "ALL GATES GREEN" || { echo "A GATE FAILED"; exit 1; }

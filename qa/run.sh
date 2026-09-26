#!/usr/bin/env bash
# Full QA: syntax -> build -> 150+ functional checks in Chromium. WebKit acceptance: see CLAUDE.md.
set -e
cd "$(dirname "$0")/.."
# The user lives in Johannesburg (UTC+2). Every date the app derives must be right in that zone, so the whole suite runs in it.
export TZ=Africa/Johannesburg
node --check src/app_full.js
python3 build.py
cp dist/ComebackBlueprint.html qa/ComebackBlueprint.html
cd qa && node qa_full.js | tail -3

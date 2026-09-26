#!/usr/bin/env bash
# Full QA: syntax -> build -> 150+ functional checks in Chromium. WebKit acceptance: see CLAUDE.md.
set -e
cd "$(dirname "$0")/.."
node --check src/app_full.js
python3 build.py
cp dist/ComebackBlueprint.html qa/ComebackBlueprint.html
# the page links icons/ beside it (Chrome fetches them when the rest beep plays); mirror the dist layout
rm -rf qa/icons && cp -r dist/icons qa/icons
cd qa && node qa_full.js | tail -3

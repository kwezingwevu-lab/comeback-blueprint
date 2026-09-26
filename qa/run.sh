#!/usr/bin/env bash
# Full QA: syntax -> build -> 220+ functional checks in Chromium -> PWA offline acceptance. Exits non-zero on any failure.
# WebKit (Safari engine) acceptance is separate: node qa/webkit.js (see CLAUDE.md).
set -eo pipefail
cd "$(dirname "$0")/.."
# The user lives in Johannesburg (UTC+2). Every date the app derives must be right in that zone, so the whole suite runs in it.
export TZ=Africa/Johannesburg
node --check src/app_full.js
python3 build.py
cp dist/ComebackBlueprint.html qa/ComebackBlueprint.html
cd qa && node qa_full.js | tail -3
# Installable/offline acceptance: serves dist/ over local HTTP, installs the service worker, kills the server, reloads.
node pwa.js | tail -2
# Calendar refresh helper: parser and diff self-test (the live sweep is run by hand: node tools/calendar-refresh.js --geocode).
node ../tools/calendar-refresh.js --selftest | tail -1

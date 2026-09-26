# The Comeback Blueprint — dev bundle

Single-file HTML fitness app for Kwezi (Johannesburg). `dist/ComebackBlueprint.html` is the app; it opens straight from Files, and when published with the "Publish app" workflow it installs to the iPhone Home Screen and works offline.

- Start here: `CLAUDE.md` (operating prompt for Claude Code), `PROMPT-KICKOFF.md` (small changes), `PROMPT-MASTER.md` (full upgrade pass), `IMPROVEMENTS.md` (the register).
- Build: `python3 build.py` (src → dist, plus the install layer). Test: `bash qa/run.sh` (Chromium functional suite, offline acceptance, calendar-tool self-test), then `node qa/webkit.js` (Safari engine; needs `npx playwright install webkit` and, on Linux, `npx playwright install-deps webkit`). CI runs all of it on every push.
- Calendar: `node tools/calendar-refresh.js --geocode` writes new and moved events for human approval.
- From the iPhone: `IPHONE.md` (cloud sessions via GitHub, publishing, CI, weekly loop).
- Memory: `LEDGER.md` (standing rules), `CHANGELOG.md`, `LEARNINGS.md`.

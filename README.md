# The Comeback Blueprint — dev bundle

Single-file HTML fitness app for Kwezi (Johannesburg). `dist/ComebackBlueprint.html` is the app; everything else is the factory that builds and tests it.

- Start here: `CLAUDE.md` (operating prompt for Claude Code), `PROMPT-KICKOFF.md` (first message).
- Build: `python3 build.py` (src → dist, plus the install bundle: sw.js, manifest, icons). Test every gate: `bash qa/all.sh` → ALL GATES GREEN (at last run: Chromium 282, PWA/offline 16, WebKit 29, calendar-helper self-test 8). WebKit needs `npx playwright install webkit` and, on Linux, `npx playwright install-deps webkit`. Real fonts for screenshots: `bash tools/fetch_fonts.sh`.
- Calendar upkeep: `node tools/calendar_refresh.js --geocode` writes `calendar-report.md` (RaceSpace vs RACES_12M) for a human to approve; it never edits the app.
- From the iPhone: `IPHONE.md` (cloud sessions via GitHub; the phone only steers).
- Memory: `LEDGER.md` (user's standing rules), `CHANGELOG.md`, `LEARNINGS.md`.
- Sibling project: `fpl/README.md` (FPL Mission Control; separate app, separate QA, not covered by this file).

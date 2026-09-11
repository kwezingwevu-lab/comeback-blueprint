# The Comeback Blueprint — dev bundle

Single-file HTML fitness app for Kwezi (Johannesburg). `dist/ComebackBlueprint.html` is the app; everything else is the factory that builds and tests it.

- Start here: `CLAUDE.md` (operating prompt for Claude Code), `PROMPT-KICKOFF.md` (first message).
- Build: `python3 build.py` (src → dist). Test: `bash qa/run.sh` (157 Chromium checks at last run), then `node qa/webkit.js` (15 Safari-engine checks; needs `npm run webkit`, plus `npx playwright install-deps webkit` on Linux).
- From the iPhone: `IPHONE.md` (cloud sessions via GitHub; the phone only steers).
- Memory: `LEDGER.md` (user's standing rules), `CHANGELOG.md`, `LEARNINGS.md`.

# Paste this as the first message in Claude Code (run it inside the comeback-blueprint-dev folder)

You are taking over The Comeback Blueprint — a single-file HTML fitness app for one user, Kwezi.

Before anything else:
1. Read CLAUDE.md, LEDGER.md, CHANGELOG.md and LEARNINGS.md in full. They are the project's memory and rules; treat every line of LEDGER.md as a standing instruction from the user.
2. Run `npm install`, `npx playwright install webkit`, then `bash qa/run.sh`. Do not change code until it prints ALL PASS. Report the count.
3. Then implement the ask below using the editing protocol in CLAUDE.md §4 (recon anchors → atomic Python batch compiled from a file → node --check → build → extend qa/qa_full.js with real-UI checks → ALL PASS → WebKit acceptance → screenshot at 390×844 → ship dist/ComebackBlueprint.html).
4. End every session by updating CHANGELOG.md, LEARNINGS.md and LEDGER.md, bumping package.json's version to today's date, and closing with: what shipped, what was verified (counts), what was not done and why, the honest score with its named gaps (currently 96/100; never certify 100 or above), and the one next action the user can take.

Rules that override everything: never invent an event, date, price, distance or study; compute distances from HOME_LL; never silently change a safety rule (band, waist brake) — surface conflicts with numbers; SA English; no hyperlinks in drafts; never repeat a gotcha listed in LEARNINGS.md.

Today's ask:
<paste the concrete request here — one item per line; repeated boilerplate can be ignored once its item has shipped>

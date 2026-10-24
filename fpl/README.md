# FPL Mission Control (v87)

A single-file React app that tells Kwezi Ngwevu (classic entry 3546875; draft "Yoh-Nited") what to do each Fantasy Premier League week. The landing card gives the decision in under 100 words, sourced; the tabs hold everything else. Objective: win the overall competition, every mini-league and the draft pool.

## Deliverables
- `app/FPL_Mission_Control.jsx` — the assembled single file (ES module, artifact-ready).
- `dist/index.html` — standalone build; opens in any browser with no server (`window.storage` falls back to `localStorage`).

`build.cjs` assembles both from `src/` and `data/`; never edit them by hand.

## Commands (from `fpl/`, Node 22)
- `npm install`
- `npm run fetch` — public FPL and draft APIs into `data/live.json`.
- `npm run build` — assemble app and standalone page.
- `npm run qa` — all suites (see `qa/README.md`); prints `ALL PASS` only when every suite passes.

## Memory files
`CLAUDE.md` (master prompt, read first), `CONTRACT.md` (names, shapes, markers), `ERRORS.md` (append-only ledger), `retests/RETEST_vNN.md` (one per version), `state/kwezi.json` (exported state, committed every delivery). Root-level memory files belong to the fitness app.

## Session opener (first message, every session)
> Read `CLAUDE.md`, `ERRORS.md` and the latest `retests/RETEST_v*.md`. Then run the live check (Part D2) and report: hours to deadline, flags on both fifteens, price moves on owned players, any rival-league rank change. Only then ask what I want to change. Score every deliverable /100 by the rubric in Part I before you show it.

## iPhone
Claude Code on the web runs from this GitHub repository, reached from the Claude app; the phone steers, nothing runs on it.

## Storage, honestly
`window.storage` in the artifact is Anthropic-hosted, per-user and persistent, but not linkable to Drive or iCloud. The repository is the permanent, versioned store: commit the JSON export as `state/kwezi.json` every delivery; restore by importing. Drive or iCloud may hold a backup copy; nothing in the runtime writes to them.

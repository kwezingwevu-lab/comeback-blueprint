REFERENCE TREE — read-only. Layout mirrors the scratch build: live/ holds pull.sh, bake.js and the frozen feeds
(pulled 22 Sep 2026 17:30 UTC, rival personal names removed); app/ holds the engine, interface, optimiser, QA, the
solved plan (solver_out.json, solver_timing.json), golden.json and the built page fpl-mission-control-v109.html.
Run from app/: node qa.js fpl-mission-control-v109.html   (expects ../live/ for the waiver log)
build.js writes to a scratch path by default; always pass an explicit output path.

FPL Mission Control — live pipeline (v109)

Rebuild the app from scratch, in order:

  1. Put pull.sh and bake.js in a working folder (say live/), and the rest in a sibling folder app/
  2. cd live && ./pull.sh 5          fetch every public feed for the gameweek in play (use the current gameweek number)
  3. node bake.js                    write ../app/data.json from those feeds; edit INTEL in bake.js for new bookmaker prices or dated news
  4. cd ../app && node export.js     write solver_in.json: expected points per player per gameweek, plus both games' state
  5. python3 solve.py 240 sens       the points-maximising plan (needs scipy 1.17+; ~10 minutes on one core); writes solver_out.json
     python3 -c "import solve; solve.chip_timing(TL=240)"   optional: wildcard now / later / never to a common tolerance
  6. node build.js                   write /mnt/user-data/outputs/fpl-mission-control.html (the plan is included only if it was
                                     solved on exactly this data: the build compares content hashes)
  7. node qa.js                      the gate: 189 checks, ~3,900 property cases, the plan re-checked week by week, the waiver
                                     model checked against the league's own log, every tab and every control rendered
  8. python3 shot.py                 phone-sized browser render, light and dark, every tab, the on-device self-test pressed

What each file does
  pull.sh      Classic and Draft public endpoints: bootstrap, fixtures, entry, history, transfers, per-gameweek picks and live
               scores, Draft league details, element status, transactions, every rival's eleven for the gameweek in play, and
               each private mini-league table.
  bake.js      Turns the feeds into one compact data block. Works out selling prices from start prices and the transfer log,
               reconciles every gameweek's points, and carries INTEL (dated desk research, bookmaker prices, start overrides).
  engine.js    Pure maths: team ratings fitted to bookmaker prices, player rates, expected points, best elevens, transfer and
               wildcard searches, Draft claims, the league's round-by-round waiver processing, Monte Carlo, the league race,
               post-mortems. Runs in the browser and under Node unchanged.
  export.js    The solver's input, with a content hash so a plan can be proven to match the data it ships with.
  solve.py     Mixed-integer programmes: the Classic plan to gameweek 19 (squad, eleven, captain, transfers, hits, free-transfer
               bank, wildcard, bench boost, triple captain; free hit priced week by week) and the Draft roster to the re-draft.
  ui.js        Nine tabs rendered as strings, so the whole interface can be checked before shipping.
  build.js     Precomputes the heavy searches and the claims sheet, then inlines data, engine, interface and styles into one file.
  qa.js        The gate. Fails loudly and exits non-zero.
  shot.py      Headless phone render with Playwright.

Identifiers: Classic entry 3546875, Draft entry 279275, Draft league 46148.

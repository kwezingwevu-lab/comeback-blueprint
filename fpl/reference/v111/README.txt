REFERENCE TREE v111 — read-only, like reference/v109. Added 27 Sep 2026.

What this is
  The kit that built the live artifact FPL Mission Control v111 (published 26 Sep 2026 to the manager's
  claude.ai artifact link), as it stood after that publish: live/ holds pull.sh, bake.js, scrub.js and the
  feeds pulled 26 Sep 2026 17:15 UTC (gameweek 5 finished and data-checked; rival managers' personal names
  removed by live/scrub.js — only the manager's own two entry files keep his name, which bake.js reads for
  the Classic header); app/ holds the engine, interface, optimiser, calibration, QA, the solved plan
  (solver_out.json, solver_timing.json, solver_long.json), golden.js, changes.json and the built page;
  WEEKLY_PROMPT.md is the routine the artifact is refreshed with, set to bump v111 → v112.

Why it is here
  reference/v109 is the executable spec the v110 port was graded against (golden.json, solver_in.json on
  the 22 Sep snapshot). v111 is what the port was taken FROM: v109 plus additive deltas (opts.fixedK, the
  calibration hook and the backtest/calibrate stage, claimsMC, priceRisk/priceStress, chipStop derived
  from the feed, a tolerant mgr, dated INTEL, the fixture invariant in qa.js, the objective-space wildcard
  timing note, and five copy lines that read the feed instead of a typed number). Keeping both trees lets
  a reader diff exactly what changed between the graded reference and the ported source, and lets the
  next session rebuild the artifact from the same inputs the repo's data/mc_data.json was baked from.

Relationship to the repo's own files
  src/mc_engine.js         = app/engine.js, verbatim plus a header and two loop-variable renames (E-109)
  pipeline/bake.js         = live/bake.js with arguments; the INTEL block moved to pipeline/intel.js
  pipeline/backtest.js     = app/backtest.js, verbatim
  pipeline/calibrate.js    = app/calibrate.js with paths
  pipeline/export.js       = app/export.js with paths
  pipeline/solve*.py       = app/solve*.py with arguments
  pipeline/plan.cjs        = the plan-keeping and free-hit re-pricing from app/build.js lines 40–61,
                             plus the replay of the ledger from the rules
  data/mc_data.json        = what live/bake.js writes on these feeds, with the model block from calibrate.js
  data/solver_in.json      = app/solver_in.json (the same content hash, d812652812be50a7)

Nothing in the app imports from here. Run from app/: node qa.js fpl-mission-control.html (expects ../live/).

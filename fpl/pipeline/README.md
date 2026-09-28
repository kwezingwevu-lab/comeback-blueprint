# pipeline/ — from the public feeds to the page

The pipeline turns the public Classic and Draft feeds into the one data block Mission Control ships,
and the solved plan beside it. Every stage is a file in this folder, runs from `fpl/`, writes one named
output and nothing else, and is proved by a suite in `qa/`. Run the stages in this order. The app runs
none of them: the page reads committed files, and the gate (`bash qa/run.sh`) refuses a tree whose
committed outputs are not the outputs of its committed inputs.

Three rules run through every stage. Content, never clocks: a stage decides whether its input changed by
hashing what the input says, not by comparing timestamps (ERRORS.md E-093, E-101). Privacy: the raw feeds
carry rival managers' personal names and are never committed; only entry ids, team names and picks leave
the bake (E-085, E-091). Read, never typed: every figure the game publishes — the gameweek in play, the
transfer cap, the chip stop, the Draft horizon — is read from a feed and reconciled, never written into a
file by hand (E-084, E-108).

## 1. Pull — `bash pipeline/pull.sh [gw]`

Fetches every public feed the bake reads into `pipeline/feeds/`, which git ignores. The gameweek in play
is detected from bootstrap (`is_current`, then the highest finished event, then `is_next` minus one), or
given as an argument to replay a past week. A feed that answers with something other than JSON — the API
serves an HTML "being updated" page with a 200 during deadline processing — leaves the previous file
alone, and the script exits non-zero naming any feed the bake cannot do without. Writes: the feed files
only. Proved by `qa/pull_guard.cjs`.

## 2. Bake — `node pipeline/bake.js` (`npm run bake`)

Reads the feeds and writes the block, `data/mc_data.json`: the players joined across the two id spaces by
`code`, selling prices from the rule of the game, the points reconciliation against the official totals,
the free-transfer ledger replayed from the published weeks, the transfer log, team season xG logs, the
Draft block with waiver runs and activity, the league tables, the rules read from the game (the chip stop,
the transfer cap, the Draft horizon from `league.drafts`) and the dated desk research in
`pipeline/intel.js`. The previous block supplies the "since last build" delta. Rival managers' personal
names never reach the output. Writes: `data/mc_data.json` only. Proved by `qa/bake.cjs`.

## 3. Calibrate — `node pipeline/calibrate.js [data/mc_data.json]` (`npm run calibrate`)

Runs the walk-forward backtest in `pipeline/backtest.js` on the block and writes `model = { calib,
backtest, at }` into it. For each finished gameweek from the third, the data is cut back to what was known
before that deadline — no later matches, no injury flags, no prices that did not yet exist — the engine is
rebuilt on it uncalibrated, and its forecasts are scored against what happened on three separate
questions, so a weakness can be traced: points given a start (Spearman rank correlation and MAE against a
naive points-per-start), who starts (Brier against "started last week"), and team goals (Poisson
log-likelihood against a flat rate). Where a position's evidence is clear — the bootstrap band of
actual-over-predicted excludes 1 — the correction is applied halfway and clamped to [0.85, 1.15];
otherwise the factor is 1. The engine (`src/mc_engine.js`) reads `model.calib` through its `CAL` hook and
scales every points component by the position's factor. The backtest itself never sees the corrections:
every cut-back copy has the model removed and every engine it builds is created with `noCalib`, so
calibrating twice equals calibrating once. Writes: the `model` key of the block, nothing else in it.
Proved by `qa/calibration.cjs` against `qa/fixtures/v111_model.json`, the v111 kit's own model block on the
same feeds.

## 4. Export — `node pipeline/export.js` (`npm run export`)

Writes the solver input, `data/solver_in.json`: every player's expected points per gameweek from the
engine the app uses, from the next gameweek to the later of the Classic chip stop and the Draft horizon,
with the Classic state (squad, selling prices, bank, free transfers, chips in hand, rules) and the Draft
state (roster, the claimable pool, who claims ahead and what they are modelled to take). Its `hash` is the
first 16 hex characters of the sha1 of the payload; the two clock fields `at` and `dataAsOf` sit outside
it, so a re-bake that changes no input keeps the hash, and a changed price, flag, projection, calibration
block or squad drops it. Writes: `data/solver_in.json` only. Proved by `qa/export_hash.cjs`.

## 5. Solve — `python3 pipeline/solve.py [TL]`, detached

Maximises expected points as two separate programmes on the exported input, and never adds a Classic
number to a Draft number. Classic: one integer programme from the next deadline to the chip stop over the
squad, the eleven, the captain, every transfer, the free transfers banked and the weeks for the wildcard,
bench boost and triple captain, with the free hit priced week by week. Draft: the best fifteen from the
roster plus the claimable pool to the re-draft, solved twice — as the market stands, and with the manager
who claims first taking what the model expects. Only squad membership is integer; the rest is totally
unimodular and comes out whole on its own, which is what closes the proof (§7.9). Writes:
`data/solver_out.json`; `solve_long.py` writes `data/solver_long.json`, and `solve.py --later` or
`solve_later.py` write `data/solver_timing.json` (wildcard now, later, never). Every stage writes its
output as soon as it finishes, so a partial run is still usable. Start a full run detached — `setsid nohup
python3 pipeline/solve.py > solve.log 2>&1 &` — because a background job dies with the shell call that
started it (§7.2). Needs `pipeline/requirements.txt`. Proved by `qa/plan_legality.cjs` on what it produced.

## 6. Plan — `node pipeline/plan.cjs`

Keeps the best of the solves and refuses one whose hash is not the export hash of the block being shipped
(exit 3, nothing written). Slims each solve to what the interface needs, lets the long solve replace the
plan when it proved a better objective on the same problem, folds the timing file in, re-labels and
re-prices the free-hit weeks against the kept plan, and then replays the free-transfer ledger, the hits
and the bank week by week from the rules of the game — the solver's own free-transfer variables are upper
bounds and never reach the interface (§7.1). Writes: `data/plan.json`, with no clock in it; exit 2 when
the replay disagrees with the solver's figures, with every disagreeing week printed. Proved by
`qa/plan_legality.cjs`.

## 7. Weekly block — `node pipeline/weekly.cjs --version N` (`npm run weekly -- --version N`)

Writes `data/weekly.js`, the decisions block the app reads (CONTRACT §4), from the plan instead of by hand:
the first planned week's fifteen, captain, vice and chip; the chip weeks of the whole plan; the timing
scenarios; the fallback without the chip; and the Draft claims sheet in lodging order. The fallback is the
optimiser's no-wildcard week when it passes every hard rule the app enforces on a written fallback (the
Konsa rule, two incoming per club, fit and starting buys, captain and vice in the app's eleven, a bank that
is not negative), and the app's own C2 protocol otherwise, with the reason written beside it. The claims
sheet is built with `fitOnly`, so no flagged player is lodged, and the held-back pair is named. Refuses
(exit 3) when the plan's hash is not the export hash of the block, records that hash in the output, and
keeps the replaced plan as `superseded`. Exits 4, having written the file, when any decision breaks one of
the app's rules, printing each one by name. Proved by `qa/smoke_wk.cjs` (check 28 compares the written
claims with the sheet line for line and requires one content hash across the block, the plan and the data),
`qa/unit_engine.cjs` and `qa/verify.sh`.

## 8. Build — `node build.cjs` (`npm run build`)

Assembles `src/engine.js` and `src/ui.jsx` with the bracketed data blocks into the single file
`app/FPL_Mission_Control.jsx` and the standalone `dist/index.html`. As this file is written the assembler
reads `data/weekly.js` and `data/live.json`; wiring the baked block and the plan into the page is the
interface work in `docs/GAP_v110.md` section D, and the rule it must keep is E-101's: a solved plan ships
only when its hash equals the export hash of the block being shipped, which `pipeline/plan.cjs` enforces
before anything is written. Then `bash qa/run.sh` is the gate, and nothing ships red.

## 9. Refresh — `.github/workflows/refresh.yml` with `node pipeline/refresh_note.cjs`

Runs stages 1–8 on a GitHub runner and proposes the result as a pull request on `refresh/<yyyy-mm-dd>`; it never
commits to the branch it runs on. It proceeds daily at 06:17 UTC only inside an international break (the next deadline
at most 21 days away and at least 12 days after the last one, read from bootstrap), or when started by hand. The raw
feeds go to the runner's temp folder, outside the checkout. `refresh_note.cjs --check`, after the export, compares
the pull with the committed snapshot on content with the clocks set aside: when nothing a decision rests on moved it
exits the job green with the reason, and when the export hash has not moved the committed plan is kept rather than
re-solved. The solve is `python3 pipeline/solve.py 240`; the chip-timing and long solves are skipped there, and
`plan.json`'s source says so. After stage 8 the fast gate (`qa/run.sh` steps 1–4 and groups A–C, read from its
`--dry-run`) must be green before anything is pushed. `refresh_note.cjs` then writes the one-paragraph note, which
covers the gameweek, the deadlines, price moves and flags on the manager's players, and the plan's change in each
game. It refuses (exit 3) a pull that is behind the committed snapshot, or any file not written by the run.
Dry-run it on the tree with `node pipeline/refresh_note.cjs --before data --after data`, which says nothing changed.

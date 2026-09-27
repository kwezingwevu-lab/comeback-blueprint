# GAP_v110 — what the repo has, what v109 has, what has to be built

Written 26 Sep 2026 before any v110 code, and kept current as items close. A row marked **done**
carries its proving number; `retests/RETEST_v110.md` has the working. Governing spec: `reference/v110/UPDATE_PROMPT.md`.
Reference implementation: `reference/v109/` (read-only; the app never imports from it).

Preflight is complete and recorded in `retests/RETEST_v110.md`. Reference gate: **189/189, 3,920
property cases** on this machine.

Status words mean exactly this:

- **present** — the repo does it, to the reference's standard or better, and a test proves it.
- **partial** — the repo does part of it, or does it by a weaker method. The gap is named.
- **absent** — nothing in the repo does it.

Effort is in units of one build loop (failing test → code → suite green → commit). S = under an
hour, M = a few hours, L = most of a session.

---

## 0. Two findings that come before A1

### P0 · Rival managers' personal names are in committed data — **closed, then reopened, then closed**

`data/live.json` carries **115 `player_name` fields, 84 distinct real people's names**, inside
`leagues[].standings`. They have propagated into `app/FPL_Mission_Control.jsx` and
`dist/index.html` — the same count in each. The interface never renders them, which is why this
was not visible, but the rule is about committing, not about rendering:

> "Never commit rival managers' personal names (`player_first_name`, `player_last_name`,
> `player_name`, initials)." — v110 §1.5, repeated in §6 and §7.14.

`data/fetch_live.cjs` was the writer. Closed as E-085: `data/scrub.cjs` scrubs the whole payload at
the write, a league entry no longer carries `manager` or `shortName` (a Draft `short_name` is the
manager's initials), and `qa/privacy.cjs` runs first in both `qa/run.sh` and `gate.yml`.

Then **reopened by my own next commit**, which tracked 53 raw feeds carrying **489** name fields,
because the ignore rule was written inside `pipeline/.gitignore` as `pipeline/feeds/` — relative to
that directory, so it meant `pipeline/pipeline/feeds/` and matched nothing — and because the suite
walked the working tree, where tracked and untracked look identical. Closed again as E-091: the
scope is `git ls-files`, the ignore rule is proved with `git check-ignore`, and the offending commit
was rewritten rather than followed by a deletion. `qa/privacy.cjs` **25/25**.

Still open, and the manager's call: the 84 rival names in `data/live.json` in commits **before**
`baac4bc`. Removing those means rewriting further back than my own work.

### P0 · The baseline gate is red — **closed**

`bash qa/run.sh` fails at step 8: **smoke 51/60**. The nine failures split into two kinds, and
neither is a v110 defect — both were introduced by refreshing the snapshot from GW4 to GW5 on
26 Sep:

- **Six** are `E-064` again: assertions that mock a clock of 12 or 15 Sep 2026 to sit inside a
  GW-in-play window. Against a GW5 snapshot whose next deadline is 10 Oct those dates are in the
  past, so the window they were written to test no longer exists. The football moved; the
  assertion did not. The fix is in the suite, and it is to derive the mocked instant from the
  snapshot's own deadlines rather than freeze a date — not to relax what is asserted.
- **Three** are fitted numbers that moved with the data: the F4 lab panel's unfitted-terms line
  and the F5 tournament panel's `promotable` verdict (`player_xg` now leads 3 of 4 transitions
  at ρ 0.3054).

Both are logged in `ERRORS.md` (E-084) and fixed. `bash qa/run.sh` prints **ALL PASS**, and the
rule is now machine-checked by `qa/no_frozen.cjs` 6/6 so it cannot recur: no check compares a
live-sourced field, or the length of a live-sourced collection, to a literal number or ISO instant.

---

## A. Data layer → `pipeline/`

| Item | Status | Where it is / goes | Failing test to write first | Effort |
|---|---|---|---|---|
| **A1 Pull** | **done** | `pipeline/pull.sh` | `qa/pull_guard.cjs` **22/22** — blocked, HTML-with-200 and truncated all leave every file byte-identical and exit non-zero; a good feed **does** overwrite; gameweek detected from `is_current` → highest finished → `is_next − 1`; refuses rather than guessing with no bootstrap. Proven live: 53 feeds, gameweek 5, exit 0 | M |
| **A2 Bake** | **done** | `pipeline/bake.js` (ported from the v111 kit; INTEL in `pipeline/intel.js`; output `data/mc_data.json`, `npm run bake`) | `qa/bake.cjs` **42/42** — snapshot equality against `reference/v109/app/data.json` on the reference feeds, path for path with **zero excluded paths** (the clock is pinned to the reference's own `asOf` by a test-time preload, so `asOf` matches too); the only added paths are the five v111 additions the suite names (`delta`, `players[].press`, `draft.events[].tr`, `draft.activity`, `draft.waiverRuns`). Three real-bake mutants — the half-rise rounded up, `chipStop` typed as 20, `rebuilt` copied from `reported` — each go red. Still to wire: `data/weekly.js` reading the new keys (§1.4) | L |
| **A3 Selling prices** | **done, engine side** | `purchasePrices`, `sellPrices` in `src/engine.js` | `qa/prices.cjs` **12/12** — all **15 of 15** match `golden.classic.sell`, 14 from the start price and 1 from the transfer log, with the source named per player. Four mutations (full rise, rounding up, a fall halved, the price paid ignored) each break the match. Still to wire: the fetcher must carry the transfer log into `data/live.json` so the app uses it instead of hand-typed `state.squad[].purchase` | M |
| **A4 Reconciliation** | **done** | `classic.recon` in `pipeline/bake.js`; `qa/bake.cjs` | Σ(points × multiplier) − hits equals the official total, **5 of 5** on the reference bake and 5 of 5 on the committed block, with `rebuilt` recomputed from the picks inside the suite; a feed whose official total is one point off makes the row mismatch, so the gate refuses that block | M |
| **A5 Free-transfer ledger** | **done, bake side** | `ftLedger()` exported from `pipeline/bake.js`, replayed from the published weeks into `classic.ftNext`; `ftAvailable()` in `src/engine.js` still **adds one on a chip week** (E-099, open, engine side) | `qa/bake.cjs`: `ftNext` equals `golden.classic.ftNext` with `ftSure` true; the block's value is what the exported ledger returns; the rule proved on synthetic weeks — a wildcard week keeps the count, a free-hit week likewise, an ordinary week adds one, the cap is 1 + max_extra_free_transfers, a hit week leaves 1 — and a wildcard-adds-one ledger disagrees | S |
| **A6 Transfer ledger** | **done** | `classic.transfersLog` in `pipeline/bake.js` | `qa/bake.cjs`: the reference bake's log equals the reference data's; every entry carries the player in, the player out, the gameweek and the price paid, and the points each has scored since — derived from the per-gameweek lines the way the reference interface does it — agree with the published squads, on both blocks | S |
| **A7 INTEL block** | **done** | `pipeline/intel.js` (`odds`, `market5`, `start[gw]`, notes, sources), carried into the bake as `intel` | `qa/bake.cjs`: `asOf` an ISO instant; 7 notes and 10 sources each dated; 20 odds rows over gameweeks 6–7, each `[HOME, AWAY, h, d, a]` with prices above 1 and a real fixture of that gameweek; 9 start overrides with p in (0, 1] and a dated why; the Draft horizon read from `league.drafts` and proved to follow a moved feed (§7.12) | M |
| **A8 Content hash** | **done** | `pipeline/export.js` — `buildInput(DATA, M)` exported for build-time reuse; `npm run export` writes `data/solver_in.json` (`f80b43568c47e325` on the committed block: 562 players, gameweeks 6–20, cEnd 19, dEnd 20) | `qa/export_hash.cjs` **36/36** in 5.2 s: the export reproduces `reference/v109/app/solver_in.json` path for path with the same hash `dde282bdf39bd757` (ported engine and reference engine); the hash recomputes from the file's own payload; kept under a changed asOf, delta, intel.notes and every player's transfer counts, ownership and price pressure; moved by one price (0.1), one status, one start override's p and one fixture's home side; shape read from the data; the shipped input is the export of the committed block. Run red first (2/3). File-level mutations each 31/36: rounding cut to two decimals names `$.players[0].ep[1] ref 4.088 got 4.09`; the hash cut to 15 hex is red with the payload path-equal; `did` dropped names `$.players[0].did missing`. The kit's `d812652812be50a7` is NOT reproduced: only `players[*].ep` differs (7,271 entries), because the kit's data.json carries a `model.calib` block ({1: 1.117, 2: 1.076, 3: 1.048, 4: 1}) that `CAL` applies and the repo's bake does not; grafting that block onto the committed block gives `d812652812be50a7` exactly, so the kit's solved plan is reusable only once the repository carries the same calibration (E-101) | S |
| **A9 Calibration** | **done** | `pipeline/calibrate.js` (`npm run calibrate`, ported from the v111 kit; the walk-forward is `pipeline/backtest.js`, verbatim from the kit) writes `model = {calib, backtest, at}` into `data/mc_data.json`; the engine's `CAL` reads `model.calib`. Present in the kit, absent from v109's spec, and the stage that closes A8's gap: with the block calibrated `npm run export` gives `d812652812be50a7`, the kit's hash | `qa/calibration.cjs` **24/24** in 4.0 s: the stage on a copy of the committed block reproduces `qa/fixtures/v111_model.json` (the kit's own model block on the same feeds) — calib factors exactly, the backtest (89 numeric leaves: points ρ / naive / n, minutes Brier / naive / n and buckets, team-goals log-likelihood, byPos ratio / lo / hi / ρ / MAE) within 1e-9; the committed block carries that same model; the backtest is uncalibrated and idempotent (CAL empty under `noCalib`, run WITH the model equals run without; the mutant with both defences removed differs); model.at an ISO instant, weeks exactly the finished gameweeks from the script's floor to lastDone, every factor finite in [0.5, 2]. Run red first by mutation on the real file: shrink 0.5 → full ratio 18/23 (`$.1 got 1.15 want 1.117`), last week dropped 20/24 (`$.1 got 1 want 1.117`), each restored byte for byte. Wired into `qa/run.sh` group B after `export_hash` and into `gate.yml` | S |

**A2 is the load-bearing one.** The reference block is `{asOf, classic, draft, fixtures, gw,
intel, players, rules, screen, teamSeason, teams}`; the repo's `live.json` is
`{current_event, draft, elements, entry, events, fetched_at, fixtures, ft_available, gw, history,
leagues, next_event, picks, rivals, source, teams, total_players}` — raw API shape, not a baked
block. `teamSeason` (expected goals for and against by match) and `intel` have no counterpart.
Per §1.4 the repo's path is extended, not replaced: `weekly.js` keeps its bracketed block and
gains the new keys.

---

## B. Engine

| Item | Status | Where | Failing test to write first | Effort |
|---|---|---|---|---|
| **B1 Team ratings** | **done** | `src/mc_engine.js` — the v111 engine as a Node-importable module, ported 27 Sep 2026; `src/engine.js` and its `teamStrength` stay untouched (§1.4, both engines ship) | `qa/parity.cjs` B1: ka 1.5, kd 2, 42 anchors and weeks 5–7 equal `golden.calib`, rmse within 0.0005 (measured diff 9e-6); all 40 `golden.ratings` within 0.001 (max error 4.8e-5) and equal to the reference engine to 1e-12. Mutation: ka moved by 0.5 through `opts.fixedK` gives a max error of 0.179 — red | L |
| **B2 Match prices to goals** | **done** | `devig`, `fitRates`, `ODDS`, `matchOdds` in `src/mc_engine.js` | `qa/parity.cjs` B2: all 13 priced fixtures (gameweeks 6–7) match `golden.odds` — goals max error 8.9e-16, fair price max error 4.9e-5, round trip max 0.121 pp against the 1.2 pp limit. Mutation: one row moved 0.05 goals — red | M |
| **B3 Player expected points** | **done** | `ep`, `parts`, `rateOf`, `avail` in `src/mc_engine.js`; the repo's `xp1`, `xp5`, `minutesModel`, `playerXg` stay (§1.4) | `qa/parity.cjs` B3: **8,430 assertions** (562 players × gameweeks 6–20) against `solver_in.json`, max error 5.0e-4, none over 0.01; the calibration hook `CAL` is proved empty on data without a `model` block, so the reference maths is unchanged. Mutation: one player's ep moved 0.02 — red | L |
| **B4 Searches** | **done** | `bestXI`, `pickXI`, `transferProtocol`, `wildcardSolver`, `wcLocalOptimum` in `src/engine.js`; `classicTransfers`, `wildcard`, `draftMoves` in `src/mc_engine.js`; `greedyTransfers` in `src/mc_analysis.js` | §7.11 **done**: the week's limit is FT + 1 capped at five, exhaustive to three then greedy, and the plan goes 3 swaps worth 37.54 at LOW to **5 worth 54.01 at HIGH** with one hit (E-090). `golden.classic.greedyTransfers` **done**: `qa/parity.cjs` B4 reproduces it move for move (van Ewijk → Silva, Semenyo → Mbeumo, Konsa → Murillo, Brobbey → Barry), value 827.45 against 827.5, within 0.05. Mutation: the moves in another order — red | M |
| **B5 Claimability** | **done** | `waiverPool`, `howToGet` in `src/mc_engine.js`; `claimability` in `src/mc_analysis.js`; the repo's `draftPool`, `draftOwnership` stay | `qa/parity.cjs` B5: before waivers settle all 442 pool players are labelled "waiver"; after they settle an `a` player is "free" and an `l` player stays "waiver" (a synthetic `l`, the snapshot has none); the reference engine agrees on every label. Mutation: a phase-blind label calls 442 claimable players "free" — red (E-097) | S |
| **B6 Waiver simulator** | **done** | `waiverSim`, `waiverOutcomeFor` in `src/engine.js` | `qa/waiver_log.cjs` **13/13 · 74/74 claims across four gameweeks**, on the committed snapshot and the live log. Four mutations: denial order reversed 72/74 (§7.8's own number), rotate-to-bottom 73/74, one attempt per round 62/69, order reversed 52/74 | L |
| **B7 Claims sheet** | **done** | `buildClaimSheet` in `src/mc_analysis.js` (rivals modelled with their top four moves, one backup per slot, two orderings through `waiverSim`; the kit's four `claimsMC` orderings on request) | `qa/parity.cjs` B7: 13 lines, strategy "firsts", 577.6 now / 619.8 stressed / 616.8 other ordering / 645.8 all first choices, max value diff 0.034 to `golden.draft.claims`; and **line for line equal** to the reference `ui.js` run in the same process. Mutations: a backup swapped — red at line 9; a cross-position pair is refused by name (E-096) | L |
| **B8 Monte Carlo** | **done** | `simulate`, `summarise`, `h2h`, `sideFromRoster`, `titleRace` in `src/mc_engine.js` (shared scorelines per fixture); `classicGameweekSim`, `headToHead` in `src/mc_analysis.js`; the repo's `mcSquad`, `mcH2H`, `mcLeague` stay (§1.4) | `qa/parity.cjs` B8: GW6 v Isak at this game win 0.519, draw 0.031 (golden 0.519 / 0.031; 30,000 draws, seed 5), medians 38 / 37; Classic GW6 p10/p50/p90 37/52/71 (golden 37/52/71; 20,000 draws, seed 11). Two runs on one seed are identical, and the reference engine on the same seed gives the same distribution to the last digit | M |
| **B9 Post-mortems** | **done** | `classicReview`, `draftReview` in `src/mc_engine.js`; `classicReviewSummary`, `draftReviewSummary`, `reviewSummary` in `src/mc_analysis.js` | `qa/parity.cjs` B9: both reviews equal the reference engine's row for row. Classic over five gameweeks: bench scored 43, **avoidable 19**, captain gap 27 (the correction below stands). Draft: two results (GW3, GW4) the best eleven would have flipped. Invariants hold — avoidable never exceeds what the bench scored, the captain gap is never negative, and a flip is flagged only where the best eleven beats the opponent and the real score did not | M |

**On B9, a correction that has to survive into the code.** The earlier spec cited "21 bench points
wasted" and I once restated it as 43. Both are wrong as a measure of a leak: `points_on_bench` is
what the bench scored, not what a better ordering would have won. On this snapshot **no starter
blanked across the five gameweeks, so bench ordering cost 0**. The measurable leaks are captaincy
27 and eleven selection 19. B9 must compute avoidable points, and the copy must never present
`points_on_bench` as a loss.

---

## C. Optimiser → `pipeline/solve.py`

| Item | Status | Failing test to write first | Effort |
|---|---|---|---|
| **C1 Classic plan to GW19** | **done** | `pipeline/solve.py` — the reference's `classic()` byte for byte (the suite proves it on every run), the paths as arguments. **Shipped `data/plan.json`** (27 Sep, export hash `d812652812be50a7`, equal to the kit's): the v111 kit's solves on the identical input, copied byte for byte (`cmp`) into `data/solver_out.json`, `data/solver_timing.json` and `data/solver_long.json` with the kit's four stage logs in `pipeline/logs/`; `plan.cjs` keeps the long solve (objective **677.51** over 672.16, HiGHS optimal within 1%, gap **0.00996**): total **903.96**, wildcard GW6 (Saka), bench boost GW7 (Haaland), triple captain GW8 (Haaland), **0 replayed hits**, GW6 captain Saka and vice Gabriel. **`data/plan_reference.json`**, the C acceptance: the reference input re-solved here on an idle core — 240 s: 874.35 at gap 0.0165 on the time limit; 480 s: **proven optimal within 0.5% at 265.5 s** (HiGHS status 7, gap 0.004996), total **882.72** (objective 661.74) against golden's 878.28 (0.51%, inside 2%), wildcard GW6 (Saka), triple captain GW7 (Haaland), bench boost GW9 (Haaland), **0 hits**, the golden Draft roster exactly. The proven plan boosts the bench in GW9 (Haaland) where golden's time-limited incumbent has GW10 (Saka), and Affengruber and Janelt stand where golden has Diop and Stach — **E-106**, and the acceptance now asks what the spec asks: `--golden` **55/55**, every legality rule green, the objective 661.74 over the recorded 658.74 | L |
| **C2 Continuous relaxation** | **done** | Only squad membership is integer (the model region carries the comment). On the reference input the relaxation **proves the plan optimal within 0.5% in 265.5 s** on an idle core (HiGHS status 7, gap 0.004996; the 240 s run on the same input stopped on the clock at 0.0165), better than the golden incumbent's 658.74 at gap 0.0130 (E-106); the shipped `data/plan.json` carries the kit's long solve at gap **0.00996**, and every gap is under 0.03 (§7.9, E-104). The 30-second smoke skips the gap check by an explicit flag and says so. Mutation: one byte of `classic()`'s signature → 48/49, restored and sha1-verified | — (falls out of C1) |
| **C3 Replay before display** | **done** | `pipeline/plan.cjs` replays free transfers, used, hits and bank from Part N1 and writes `replay` in `plan.json`; the interface reads `replay`, never the solver's fields (§6, §7.1, E-102). Exit 2 on any disagreement, printing the week and both values. On `data/plan.json` the replay agrees on all 14 weeks (0 differences, exit 0), on `data/plan_reference.json` on all 14; `qa/plan_legality.cjs` runs a third independent replay on each and agrees week for week. Mutation: a `plan.cjs` copy where a wildcard week adds a free transfer exits 2 naming GW7/8/9 (`replay 5 · solver 4`) and its file is refused at 48/49 | S |
| **C4 Scenarios** | **done** | `chip_timing()` / `--later` / `solve_later.py` write the timing file after every scenario; `plan.cjs` folds it with now := the kept plan, keeps a better long solve, and re-labels and re-prices the free hit against the kept plan; a stale timing or long file is named and left out. `data/plan.json`: now **903.96** (the kept long solve), later **897.47** (wildcard GW7; the kit's 540 s re-solve, optimal at 316.9 s, folded by `solve_later.py`), never **892.26** (optimal at 165.2 s); no-wildcard 890.63; undecayed 896.33; 14 free-hit weeks. `data/plan_reference.json`: now := the proven plan 882.72, later 876.80 (wildcard GW10) and never 869.40 from the reference's own timing file, folded by content hash | M |
| **C5 Draft roster to GW20** | **done** | `draft()` and `draft(exclude=aheadTakes)` in `pipeline/solve.py`; every add claimable, every drop mine, position for position, and the contested roster never adds a player the manager ahead is modelled to take (`qa/plan_legality.cjs` C5 on both plans). `data/plan.json`: value **667.23** from **596.17** (+71.06, 8 pairs); if the manager ahead takes what the model expects, 650.98 with 7 pairs. Reference: **645.77** from **577.57** (+68.20) with the eight `golden.draft.solvedRoster` pairs, reproduced exactly by both re-solves (the Draft programme closes in under a second) | L |
| **C6 Operations** | **done** | Every stage writes as soon as it finishes (temporary file moved into place); `qa/solver_smoke.sh` saw the file **22.6 s before the run ended** carrying `plan` and no `done` (§7.2, E-103). `plan.cjs` refuses (exit 3) a file without `done: true`, a plan that is not `ok`, or a hash that differs from `buildInput(DATA, M).hash` (§7.7). The app never solves: it reads the committed `data/plan.json`, written 27 Sep by `node pipeline/plan.cjs` from the v111 kit's solves (instants 2026-09-26T17:26:07Z, 2026-09-26T17:35:21Z and 2026-09-26T17:51:08Z on the identical export hash, so no re-solve was needed; `pipeline/logs/solve.log`, `timing.log`, `long.log` and `later.log` are the kit's stage records). The reference re-solve ran detached (`setsid nohup`, its own session, nothing else scheduled) and `pipeline/logs/ref_solve.log` and `ref_solve_480.log` show every stage | S |

Before 27 Sep nothing in the repo was a mixed-integer optimiser: no Python, no `scipy`, no `plan.json`. Now `pipeline/solve.py`, `solve_long.py` and `solve_later.py` carry the reference models unchanged, `pipeline/plan.cjs` writes the plan the app reads, `data/plan.json` is the shipped plan, and `data/plan_reference.json` (the reference input re-solved through `plan.cjs`, its raw output committed as `data/solver_out_reference.json`) carries the golden acceptance.
`wildcardSolver` and `chipSolver` are greedy and heuristic and stay (§1.4 — the stronger one wins
per measured number, and for a 14-week plan the MILP is stronger by construction).

`scipy 1.17.1` and `numpy 2.4.6` are installed on this machine and pinned in
`pipeline/requirements.txt`.

---

## D. Interface

The repo ships **7 tabs**: command, plan, squad, rivals, draft, chips, lab. v109 ships **9**:
today, classic, draft, leagues, fixtures, players, odds, review, lab. Nothing is deleted (§1.4),
so the repo keeps its seven and gains **odds** and **review** → nine. The tab bar is measured at
390 px before and after, because a strip that clips at eight is a known failure in this codebase.

| Item | Status | Target tab | Failing test to write first | Effort |
|---|---|---|---|---|
| **D1 Today** | partial | command | Last gameweek per game, the plan's next instruction, the claims line, flags and build notes — all derived, under 100 words | M |
| **D2 Classic plan panel** | partial | plan | Stat strip, next-gameweek pitch, week table, timing verdict that says "clear" **only** when the gap beats the tolerance, the £0.35m budget warning, and the plan hidden with a note when a planning setting is changed | L |
| **D3 Draft** | partial | draft | Solved roster, claims sheet in lodging order labelled lands / taken first / not reached, waiver-phase paragraph with the full order, free agents with "how to get him", trades split into "both gain" and "ask" | L |
| **D4 Odds** | absent | new odds tab | Next two gameweeks, source named per match, and an entry form that removes the margin and applies the override | M |
| **D5 Review** | absent | new review tab | Transfer ledger and bench points scored against avoidable, five weeks per game | M |
| **D6 Lab** | partial | lab | The optimiser's method, its limits, and dated sources | S |
| **D7 Phone** | partial | all | No horizontal scroll at 390 px in light **and** dark, fixture rows on one line with weekday and time, chalk lines clear of text. `qa/webkit.js` and `qa/components.cjs` cover part of this; dark mode is not asserted | M |

---

## E. QA and CI

| Item | Status | Failing test to write first | Effort |
|---|---|---|---|
| **E1 Ported suites** | partial | Sixteen suites by the reference's names — data, maths, projections, rules, separation, property (≥3,900 cases), simulation, optimisers, reconciliation, prices, market, waivers, plan, render, actions, page. The repo has ten suites of its own (`unit_engine`, `smoke`, `smoke_wk`, `realistic`, `components`, `buttons`, `mc_full`, `mc_all`, `webkit`, `tdz_check`) — all keep running | L |
| **E2 Parity** | **done** | `qa/parity.cjs` **51/51** in 3.6 s: B1–B5 and B7–B9 against `golden.json`, `solver_in.json` and the reference implementation run in the same process, at the spec tolerances. Seven in-suite mutations and three file-level ones each go red (home advantage 1.09 → 1.10: 41/51; backup gain floor 3 → 30: B7 red; the trade position check removed: 49/51). Wired into `qa/run.sh` group B after `prices` and into `gate.yml` in the same place | M |
| **E3 Plan legality** | **done** | `qa/plan_legality.cjs --plan=data/plan.json` **39/39** in 0.47 s: 14 weeks × 14 rules (shape, club cap, eleven, armband, bench, transfer lists, held week, no rebuy §7.10, bank at selling prices, free transfers, hits, chip, expected points within 0.05 by `src/mc_engine.js`), each chip once, weeks contiguous to the chip stop, total = Σ weeks − 4 × hits, free-hit weeks legal/affordable/re-derived and never a chip week, the `replay` block equal to the suite's own, gap under 0.03, timing shape, Draft roster rules, the content hash, the model region byte-identical to the reference's, and nine in-suite mutations. `--plan=data/plan_reference.json --data=reference/v109/app/data.json --golden=reference/v109/app/golden.json` **55/55**: every legality rule green and the acceptance at the spec's tolerance (E-106), with six mutations for the checks it gained (triple captain moved, a second bench boost, an objective a point under the incumbent's, a hit, a gap over 0.03, a later total 3% off), each red. Run red first: 0/1 with no plan file, 45/48 on the raw reference output without `plan.cjs`. Five file-level mutations each red on the named rule (club cap ARS x4 → 37/49; captain Groß off the pitch → 46/49; Gabriel rebought → 39/49; bank −6.1 → 38/49; wildcard x2 → 40/49). A missing plan file is a FAIL and exit 1, never a skip. Both invocations wired into `qa/run.sh` group B after `calibration` and into `gate.yml` in the same place | L |
| **E4 Waiver log** | **done** | `qa/waiver_log.cjs` 13/13, 74/74 on both the committed snapshot and the log pulled today; wired into `qa/run.sh` and `gate.yml` | M |
| **E5 Phone render** | partial | `qa/browser.py` at 390×844, light and dark, every tab, zero page errors, no overflow, self-test pressed. `qa/webkit.js` does Safari-engine acceptance and light mode only | M |
| **E6 `gate.yml`** | partial — **the smoke part is done** | `qa/solver_smoke.sh` **7/7 in 54.8 s**: a 30-second solve of `data/solver_in.json` into a temporary file → `plan.cjs` (guard, replay) → `plan_legality --skip-gap --no-golden` 36/36 with the two quality checks skipped by name. Measured, not assumed: HiGHS found its first incumbent at **21.5 s** on the 8,091-variable model with the cores shared, so the spec's 20 s returned no plan and the smoke went red 3/4 — the default is 30 s (the top of the item's band) and a slower runner passes a larger number. Wired last in `qa/run.sh` group B and in `gate.yml` with a `pip install -r pipeline/requirements.txt` step before it. E1–E4 and the rest of E6 are other items | S |
| **E7 `refresh.yml`** | partial | Exists, uncommitted, from the superseded v89 wave. It commits straight to the branch; §5 E7 wants pull → bake → export → solve → build → gate and then **a pull request** with a one-paragraph note. It must not be enabled before the P0 privacy scrub, because it commits `data/live.json` | M |

Two loose ends inherited from the v89 wave, both in files v110 rewrites:

- `build.cjs` declares `function serviceWorker` **twice** (lines 372 and 709); the later
  declaration silently wins. The dead one goes.
- `--mute` (#6a7588) fails WCAG AA at 11 px: measured 4.15 / 3.82 / 3.45 on `--bg` / `--bg2` /
  `--bg3` against the 4.5 it needs. `#7c899f` measures 5.46 / 5.02 / 4.54.
  **Held by `qa/visual.cjs`** (gate step 7, group A, 41/42 on this tree): audit_contrast computes those three numbers from the source on every run (5.4636 / 5.0243 / 4.5422) with 28 derived pairings and seven 1.4.11 checks; audit_layout holds the seven touch floors, the tab strip, the header guard, zero hex in markup, and the 11px floor in every media query, where it is red on `.tabi` at 10px under `@media (max-width:380px)` (E-100).
- `qa/webkit.js` has an uncommitted fix worth keeping: the service-worker registration half of
  the PWA guard was served over `http://`, where WebKit does not expose
  `navigator.serviceWorker` at all, so the page honestly reported "unsupported" and the check
  **could not fail**. Moving it to `https://mc.test/` makes it able to fail, which is the only
  reason to have it.

---

## Order of work

P0 privacy scrub → P0 red-gate repair → A (data) → B (engine) → C (optimiser, solved detached) →
D (interface) → E (QA and CI) → refresh on live feeds if the network holds.

**Where it stands.** Both P0 items are closed. **A1, A3 (engine side), B6 and E4 are done**, §7.11 is
done inside B4, and E-087, E-088, E-090 and E-091 are closed with their numbers. Four suites are new
and wired into `qa/run.sh` and `gate.yml`: `privacy` 25/25, `no_frozen` 6/6, `pull_guard` 22/22,
`waiver_log` 13/13 and `prices` 12/12.

**One thing a reader of this file needs to know.** A concurrent wave of subagents was editing
`src/engine.js`, `qa/` and `data/` for part of this session, and about 1,400 lines of theirs arrived
in the working tree — autosub resolution, a bench planner, a leak backtest, a win-probability
objective, hierarchical pooling and Dixon-Coles tau/rho, plus a tenth tournament model. It is
committed because discarding it would destroy real work and the suites cover it (mc_all's 135
property invariants over a million iterations, and unit_engine), but it has **not** had a
line-by-line review from me, and that review is the first thing after this. It cost two gate runs to
notice, because the engine changed between them: the tenth model turned four checks red that had
pinned "nine models" — E-084's class applied to a registry rather than to a date, now fixed by
reading `TOURNAMENT_MODELS`. The Draft ground truth is **closed**: `state/kwezi.json` carries
`draft.league_id` 46148 and `draft.entry_id` 279275, both verified against `d_details.json` and
`dentry.json`, and Yoh-Nited's fifteen as Opta codes read from the baked block by two independent
routes (the v89 guess of twelve shared four of them), which unlocks B5, B7, C5 and D3 before the
waivers settle on 9 October. A2 (the bake) is done alongside A4–A7, `qa/bake.cjs` 42/42. Then B1–B3
against `golden.json`, then C.

Parity is the spine: B1, B2 and B3 are graded against `golden.json` and `solver_in.json`, and
nothing downstream is trustworthy until they match. Per the stop rule, a parity target that
misses its tolerance twice is logged in `ERRORS.md` with the evidence and left, not loosened.

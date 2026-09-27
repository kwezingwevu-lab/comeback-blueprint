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
| **C1 Classic plan to GW19** | absent | Plan total 878 ± 2%, wildcard GW6, triple captain GW7, bench boost GW10, no hits | L |
| **C2 Continuous relaxation** | absent | Proven gap under 3% in 180–240 s (§7.9: all-binary stalled at 24.6%) | — (falls out of C1) |
| **C3 Replay before display** | absent | The ledger, hits and bank are recomputed from the rules; the solver's own free-transfer values never reach the interface (§7.1) | S |
| **C4 Scenarios** | absent | Wildcard now 878 / later 877 / never 869, all inside ~20 points, so the verdict must say "not clear" | M |
| **C5 Draft roster to GW20** | absent | +68 (578 → 646) with the eight pairs in `golden.draft.solvedRoster` | L |
| **C6 Operations** | absent | `setsid nohup`, output written after every stage (§7.2); the app reads committed `data/plan.json` and never solves | S |

Nothing in the repo is a mixed-integer optimiser: there is no Python, no `scipy`, no `plan.json`.
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
| **E3 Plan legality** | absent | `qa/plan_legality.cjs` over every week of `data/plan.json`: shape, club cap, legal eleven with captain and vice in it, transfers equal to the squad difference, no sell-then-rebuy (§7.10), bank never negative at selling prices, replayed hits, one chip per week and each once, expected points re-derived within 0.05, free-hit weeks carrying no other chip | L |
| **E4 Waiver log** | **done** | `qa/waiver_log.cjs` 13/13, 74/74 on both the committed snapshot and the log pulled today; wired into `qa/run.sh` and `gate.yml` | M |
| **E5 Phone render** | partial | `qa/browser.py` at 390×844, light and dark, every tab, zero page errors, no overflow, self-test pressed. `qa/webkit.js` does Safari-engine acceptance and light mode only | M |
| **E6 `gate.yml`** | partial | E1–E4 added, plus a 20-second solver smoke that must return a legal plan; the full solve never runs on push | S |
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

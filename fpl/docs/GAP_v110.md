# GAP_v110 — what the repo has, what v109 has, what has to be built

Written 26 Sep 2026, before any v110 code. Governing spec: `reference/v110/UPDATE_PROMPT.md`.
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

### P0 · Rival managers' personal names are in committed data

`data/live.json` carries **115 `player_name` fields, 84 distinct real people's names**, inside
`leagues[].standings`. They have propagated into `app/FPL_Mission_Control.jsx` and
`dist/index.html` — the same count in each. The interface never renders them, which is why this
was not visible, but the rule is about committing, not about rendering:

> "Never commit rival managers' personal names (`player_first_name`, `player_last_name`,
> `player_name`, initials)." — v110 §1.5, repeated in §6 and §7.14.

`data/fetch_live.cjs` is the writer. This is the first change of the session, ahead of A1, and it
carries the §7.14 test: a privacy grep over everything committed, wired into the gate so it can
never come back. The names are also in this branch's earlier commits; the scrub stops them being
shipped from here, and rewriting the branch history is a separate decision for the manager.

### P0 · The baseline gate is red

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

Both are logged in `ERRORS.md` and fixed before A1 code lands, because §1.3 puts the failing
assertion first and §9 needs a green gate.

---

## A. Data layer → `pipeline/`

| Item | Status | Where it is / goes | Failing test to write first | Effort |
|---|---|---|---|---|
| **A1 Pull** | partial | `data/fetch_live.cjs` (Classic + Draft, 667 elements, 83 rivals) → `pipeline/pull.sh` | Two runs against a blocked network leave the previous files intact — the repo writer has no last-good-file fallback and no gameweek auto-detect assertion | M |
| **A2 Bake** | partial | `data/fetch_live.cjs` → `pipeline/bake.js`, feeding the existing `data/weekly.js` path | Snapshot equality against `reference/v109/app/data.json` on the reference feeds | L |
| **A3 Selling prices** | partial | `sellPrice()` in `src/engine.js` | Every player held since 18 Sep matches `golden.classic.sell` — the repo has `cost_change_start` but **no `element_in_cost`** anywhere, so anyone bought since GW1 is priced by the wrong rule | M |
| **A4 Reconciliation** | absent | `pipeline/bake.js` + `qa/recon.cjs` | Σ(points × multiplier) − hits equals the official total, 5 of 5 on the snapshot | M |
| **A5 Free-transfer ledger** | partial | `ftAvailable()` in `src/engine.js`; `ft_available: 4` is currently **read from the feed, not replayed** | 4 free transfers for GW6 replayed from history, with a wildcard week keeping the count | S |
| **A6 Transfer ledger** | absent | `pipeline/bake.js` | Every transfer with points scored since, against the one GW5 transfer on the snapshot | S |
| **A7 INTEL block** | absent | `pipeline/bake.js` (`odds`, `market5`, `start[gw]`, notes, sources) | Every INTEL entry carries a date and a source; no entry without both | M |
| **A8 Content hash** | absent | `pipeline/export.js` | A re-bake that changes nothing keeps the plan; changed data drops it. No `sha1`/`createHash` exists in the repo today | S |

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
| **B1 Team ratings** | partial | `teamStrength`, `tsXg`, `tsMult` in `src/engine.js` — fitted to **season counts only** | `golden.calib` = {ka 1.5, kd 2, rmse 0.1687, 42 anchors, weeks 5–7} and `golden.ratings` to 0.001. No price prior, no log-space blend, no fitted exponents exist | L |
| **B2 Match prices to goals** | absent | `src/engine.js` | Margin removed proportionally, Poisson grid at 0.05 then 0.01; round-trip inside 1.2 pp and `golden.odds` to 0.01. **No `odds` anywhere in the repo** | M |
| **B3 Player expected points** | partial | `xp1`, `xp5`, `minutesModel`, `playerXg` | Every player GW6–20 within 0.01 of `solver_in.json`. The repo has appearance/goals/assists/CS/bonus and a real minutes model, and `defensive_contribution` is read — but there is no empirical-Bayes DC hit rate, no parsed return dates, no dated start overrides | L |
| **B4 Searches** | present | `bestXI`, `pickXI`, `transferProtocol`, `wildcardSolver`, `wcLocalOptimum` | Matches `golden.classic.greedyTransfers`; and §7.11 — search up to min(free transfers, 5), the repo's protocol needs re-checking at 5 | M |
| **B5 Claimability** | partial | `draftPool`, `draftOwnership` (real league pool, closed in v88) | A phase-aware "how to get him": `waivers_processed` is read but the `o`/`a`/`l` distinction is not turned into a label | S |
| **B6 Waiver simulator** | partial | `draftWaivers`, `waiverOrder` | Replaying `reference/v109/live/d_tx.json` reproduces **74/74**, reading each round's order off the log's `index`; denial reasons ordered "already claimed" first (§7.8) | L |
| **B7 Claims sheet** | absent | `src/engine.js` | `golden.draft.claims`: 13 lines, strategy "firsts", 578 now / 620 stressed / 617 other ordering / 646 all-first-choices | L |
| **B8 Monte Carlo** | partial | `mcSquad`, `mcH2H`, `mcLeague`, `simFixture`, `fixtureDraws` | GW6 v Isak at this game 51.9% ± 2 pp win, 3.1% ± 1 pp draw; Classic GW6 p10/p50/p90 37/52/71 ± 2. Scorelines are not yet shared per fixture across owners | M |
| **B9 Post-mortems** | partial | leak analysis exists as session work, not as engine code | Bench points scored against **avoidable** ones, the captain gap, and Draft results a better eleven would have flipped — over five gameweeks per game | M |

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
| **E2 Parity** | absent | `qa/parity.cjs` against `golden.json` and `solver_in.json` at the tolerances above | M |
| **E3 Plan legality** | absent | `qa/plan_legality.cjs` over every week of `data/plan.json`: shape, club cap, legal eleven with captain and vice in it, transfers equal to the squad difference, no sell-then-rebuy (§7.10), bank never negative at selling prices, replayed hits, one chip per week and each once, expected points re-derived within 0.05, free-hit weeks carrying no other chip | L |
| **E4 Waiver log** | absent | `qa/waiver_log.cjs` — 74/74 on the snapshot, re-run on the live log at every build | M |
| **E5 Phone render** | partial | `qa/browser.py` at 390×844, light and dark, every tab, zero page errors, no overflow, self-test pressed. `qa/webkit.js` does Safari-engine acceptance and light mode only | M |
| **E6 `gate.yml`** | partial | E1–E4 added, plus a 20-second solver smoke that must return a legal plan; the full solve never runs on push | S |
| **E7 `refresh.yml`** | partial | Exists, uncommitted, from the superseded v89 wave. It commits straight to the branch; §5 E7 wants pull → bake → export → solve → build → gate and then **a pull request** with a one-paragraph note. It must not be enabled before the P0 privacy scrub, because it commits `data/live.json` | M |

Two loose ends inherited from the v89 wave, both in files v110 rewrites:

- `build.cjs` declares `function serviceWorker` **twice** (lines 372 and 709); the later
  declaration silently wins. The dead one goes.
- `--mute` (#6a7588) fails WCAG AA at 11 px: measured 4.15 / 3.82 / 3.45 on `--bg` / `--bg2` /
  `--bg3` against the 4.5 it needs. `#7c899f` measures 5.46 / 5.02 / 4.54.
- `qa/webkit.js` has an uncommitted fix worth keeping: the service-worker registration half of
  the PWA guard was served over `http://`, where WebKit does not expose
  `navigator.serviceWorker` at all, so the page honestly reported "unsupported" and the check
  **could not fail**. Moving it to `https://mc.test/` makes it able to fail, which is the only
  reason to have it.

---

## Order of work

P0 privacy scrub → P0 red-gate repair → A (data) → B (engine) → C (optimiser, solved detached) →
D (interface) → E (QA and CI) → refresh on live feeds if the network holds.

Parity is the spine: B1, B2 and B3 are graded against `golden.json` and `solver_in.json`, and
nothing downstream is trustworthy until they match. Per the stop rule, a parity target that
misses its tolerance twice is logged in `ERRORS.md` with the evidence and left, not loosened.

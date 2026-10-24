# RETEST v87 — FPL Mission Control, rebuilt in-repo

**Written** 11 September 2026, 16:20 UTC (18:20 SAST) · **Snapshot** `data/live.json` fetched 2026-09-11T14:05:25Z
**Gate** `bash qa/run.sh` → **ALL PASS (12 steps)** at the release Monte Carlo count · wall clock 8m07s

---

## 1. What shipped

The whole app, from nothing, inside `fpl/` in the `comeback-blueprint` repository — the only repo connected to Claude Code on the web. The master prompt is carried verbatim in `fpl/CLAUDE.md` under a repo addendum; `fpl/CONTRACT.md` fixes the names, shapes and markers so parallel work fits together.

| Piece | What it is |
|---|---|
| `src/engine.js` | 120+ pure functions: B1 scoring, B3 constraints, E1 xP, E2 Dixon-Coles-lite on xG, E3 rival engine, E4 Monte Carlo, E5 walk-forward tournament, C1–C5 decision protocols, D3 squad detection, D4 refresh path |
| `src/ui.jsx` | Seven-tab React app, module-level components, every number from an engine call |
| `build.cjs` | Assembles `app/FPL_Mission_Control.jsx` (artifact-ready) and `dist/index.html` (opens from a phone, no server) |
| `data/fetch_live.cjs` → `data/live.json` | Both public APIs into one snapshot: 655 elements, 380 fixtures, GW1–3 with per-fixture xG, six league tables, 79 rival squads, the draft bootstrap |
| `data/weekly.js` · `state/kwezi.json` | The written plan by element id and code; the exported state |
| `qa/` | Nine suites plus the harness and the TDZ gate |
| `ERRORS.md` | 62 entries, E-001 … E-061 |
| `.github/workflows/gate.yml` | Runs the gate on every `fpl/**` push |

## 2. What was verified, with counts

```
STEP 1  tdz_check (self-test + sources)   TDZ SELF-TEST 6/6 · CLEAN on engine, ui
STEP 2  esbuild syntax gate                OK
STEP 3  build (build.cjs → app/ + dist/)   markers 6/6, order ok
STEP 4  tdz_check (freshly built app)      CLEAN
STEP 5  verify.sh                          SUITE verify 25/25
STEP 6  unit_engine.cjs                    SUITE unit_engine 202/202
STEP 7  smoke.cjs                          SUITE smoke 52/52
STEP 8  smoke_wk.cjs                       SUITE smoke_wk 32/32
STEP 9  realistic.cjs                      SUITE realistic 8/8
STEP 10 buttons.cjs                        SUITE buttons 94 · 0 · 0 · 0   (10/10)
STEP 11 mc_full.cjs 25000                  875,010 assertions · 172/172 functions · 0
STEP 12 mc_all.cjs                         1,000,000 iters · 117 invariants · 0
                                           ALL PASS (12 steps)
```

Part G gates, measured rather than asserted: landing card 77 visible words (87 with the premiums locked, gate <110) in 4 panels; every tab under 500 on first paint (command 145, plan 126, squad 252, rivals 90, draft 154, chips 79, lab 59); type floor 11.00px; touch floors `.btn` 42 `.btn-sm` 38 `.tabi` 52 `.sec-h` 48 `.menu-i` 44 `.inp` 40 `.row` 38; exactly 21 tokens on `.mc-root` and zero hex literals in rendered markup; seven equal-width icon tabs with no horizontal scroll at 360px or 390px; mode, tab, open sections and reveals survive a reload.

Model checks that reproduce the master prompt's own record from live data: Arsenal is the best defence on xG at **0.733** (E2 says 0.73); **Hull sits 13th of 20 on xG defence while having conceded no goals**, which is exactly the v74 lesson that a goals-based strength model inverts a captaincy call on luck (E-011); the E1 worked example returns shrunk 5.2286, P(start) 0.875, xp5 **16.27** against the documented 5.23 / 0.875 / 16.3.

## 3. The decision this produces for GW4

Live check at 16:08 UTC: **20.4 hours to the deadline** (2026-09-12T12:30:00Z). Flags: **Shaw (in the current fifteen) went status `d`, 75%** during the session — the engine now lists him as a forced sell and the fallback plan sells him. The written fifteen carries no flags. No price moves on any owned or planned player since the snapshot. Overall rank 5,081,366 live, 5,081,590 on the GW3 history row (the two endpoints differ by a few hundred places; this file quotes both).

**The app and the written plan disagree, and the app now says so on the first screen.** Rule C1.6 keeps anyone at or above 60% rival ownership out of the wildcard solver. On today's rival picks that is **João Pedro 100%, Haaland 86%, Calafiori 82%, Raya 60%** — four of the fifteen in Part M. So:

| Fifteen | Weekly xP | Cost | Bank |
|---|---|---|---|
| rule-pure (what the solver ships) | 55.84 | £92.4m | £7.3m |
| premiums locked back in | 56.96 | £99.6m | £0.1m |
| the written Part M plan | 52.85 | £98.1m | £1.6m |

The locked fifteen scores **1.12 points a week more** and spends £7.2m more of the budget, so on this snapshot rule six costs expected points. That is a finding, not a licence to drop the rule — it exists to protect rank in six mini-leagues against a field that already owns those players. The Plan tab prices all three and carries a lock control that drives the landing card, the wildcard panel and the captain; the landing names the conflict in one line either way.

Part M's own figures no longer hold: its fifteen costs **£98.1m, not £97.8m**, against a selling value of £99.7m, so the bank is £1.6m rather than £2.2m.

## 4. What was found and fixed

Three independent adversarial verifiers and the fuzz suites found 17 defects after the build passed its first green gate. Everything below is in `ERRORS.md` with its cause, how it was caught, the rule and the test.

**Would have shown the manager something wrong:** the live window keyed on the snapshot's `current_event` instead of the clock, so on match day the app would still have said "Play Wildcard 1" with the full transfer list (E-028); the landing replaced the written plan with the solver's fifteen and never said why (E-039); an API error arriving with a 200 status was reported as an empty reply instead of its own message (E-040); waiver claims were ordered by roster position rather than by what they are worth (E-041); the countdown printed "closed to deadline" once the deadline passed (E-056).

**Would have broken under real input:** 19 engine helpers threw on junk although the file promises totality — 48 of 155 functions failed the first fuzz run (E-030); `binomial` looped without bound on an absurd count, hanging the app with no error (E-035); `clamp` returned NaN when a bound was non-finite, from the helper that guarantees probabilities sit in [0,1] (E-036); `quantile` returned the string `"[object Object]NaN"` into the rendered Monte Carlo quantiles (E-055).

**Would have quietly misled:** the transfer margin compared move *order* rather than the move *set*, so the same plan could be reported as its own runner-up (E-033); the tournament compared MAEs measured in different units, ranking models by scale rather than accuracy (E-047); `formationOf` invented "0-0-0" (E-032); `ftAvailable` gave two answers for the same history (E-045).

**Tests that could not fail:** the E-026 draft-code-join guard watched the map and not one consumer — mutating the join to an id left the suite green at 158/158 (E-048); twelve required functions had no direct assertion (E-049); four checks were tautological (E-050); the TDZ gate reported CLEAN on a file whose exported function throws (E-051); the harness swallowed a mount timeout and reported 0/0 as a pass (E-052). Each fix was mutation-proven: break the behaviour, watch exactly that check go red, revert.

## 5. Where I was wrong

I diagnosed the wildcard solver as under-converged, on the evidence that a greedy one-swap pass improved the objective by 3.2% and spent £7.3m of idle bank. **That diagnosis was wrong and the engine agent disproved it with evidence I accept.** My probe had relaxed two constraints the rules require — the ≤2-incoming-per-club correlation guard, and B3's wildcard entry test of three starts in the last three. Audited properly the shipped fifteen is already a strict one-swap local optimum under four pool and feasibility combinations, and 60 random-restart hill climbs all converge to the same objective. The £7.3m and the 3.2% are the price of rule C1.6, not of an unfinished search — which is what the three-fifteens panel now shows. `wcLocalOptimum()` and invariant I117 exist so this is checkable rather than arguable.

I also quoted per-transition Spearman figures in my own working that came from a cruder estimator than the engine's eight models; the UI agent caught that they could not be the figures behind the averages I quoted beside them. The Lab panel shows the engine's own per-transition numbers, not mine.

## 6. Honest limitations

- **The walk-forward does not endorse the driver.** At two transitions the engine ranks component-xP first (ρ 0.239) ahead of ICT-rate 0.226, BPS-rate 0.209 and season-mean 0.203. Part M and E5 record BPS-rate leading at +0.148 with component-xP last. Neither ordering reproduces the other, two transitions is not decision-grade, and E6 still bars component-xP from driving anything — the three-transition gate returns `promotable: false`. Production stays on the E1 xP. This resolves itself at GW5 and properly at GW8.
- **The draft half is running half-blind.** The draft league id for Yoh-Nited is unknown, so there is no real free-agent pool: the engine's own waiver ranking proposes players who are certainly rostered elsewhere. The Draft tab therefore leads with the Part M claims checked against the snapshot and puts the engine ranking behind a reveal that says this in plain words. The saved roster is 12 of 15; the three unknown slots are one goalkeeper and two defenders; "Wilson" is assumed to be the Leeds midfielder of the three in the game.
- **Never opened in Safari.** WebKit is not installed in this sandbox and `playwright install` is refused, so every browser check ran in Chromium 141. The manager's device is an iPhone. No Safari acceptance was run and none is claimed.
- **P(start) is uncalibrated.** It is still the Laplace rate from B3/E1, not the F4 logistic on minutes trend and competition load, and no Brier score has been computed.
- **No double or blank gameweek exists yet** in the fixture list, so the chip solver's DGW and BGW paths are proven only against constructed fixtures in `unit_engine`, never against a real one.
- `state/kwezi.json` records the squad as of GW3 and is the snapshot the D3 block compares against; it is the repository, not the browser, that is the permanent store.

## 7. Score — Part I rubric

**81 / 100.** Deductions, with what would close each:

| Dimension | Weight | Score | Deduction and why |
|---|---|---|---|
| Correctness & sourcing | 30 | 26 | −4: the draft free-agent ranking is computed against a pool the app cannot see. Closed by the Yoh-Nited league id. No flag was missed (Shaw was caught mid-session and acted on) and the 11 live reconciliations pass. |
| Model calibration | 20 | 14 | −6: the bar is "the driver model leads the walk-forward" and it does not — component-xP does, on two transitions that decide nothing. Closed by GW8, or sooner by F4/F5 giving the driver a calibrated minutes model. |
| Decision quality | 15 | 14 | −1: chip timing has no real double or blank to be tested against. Closed when the February–April calendar lands. |
| Sleekness | 15 | 15 | Every Part G gate measured green, none asserted. |
| Test coverage | 15 | 11 | −3 no Safari acceptance on the manager's own device class; −1 the 21 React components are fuzzed under a props contract, not on their output. Closed by a WebKit run and a props-fixture pass. |
| Honesty | 5 | 5 | Limitations stated, ledger at 62 entries, a wrong diagnosis of my own recorded in §5, no claim of 100. |

**The score is never 100 and this is not close to it.** The two real gaps are that the model tournament does not yet back the model that drives the recommendations, and that the draft half of the brief is running without the league it is meant to win.

## 8. The single next action

**Paste the Yoh-Nited draft league URL.** It is the one input that turns the Draft tab from an ordering into a list, fills the three unknown roster slots, settles the Wilson identity, and lets the waiver engine rank real free agents before the GW4 waivers process. Everything else on this list closes itself with time and gameweeks.

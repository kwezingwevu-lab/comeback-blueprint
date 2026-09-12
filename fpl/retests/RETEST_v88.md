# RETEST v88 — the draft half stops guessing

**Written** 12 September 2026, 00:21 UTC (02:21 SAST) · **Snapshot** `data/live.json` refetched 2026-09-11T23:58:05Z
**Gate** `MC_ITERS=25000 bash qa/run.sh` → **ALL PASS (14 steps)** at the release Monte Carlo count · wall clock 9m38s · **Score** §7

---

## 1. What this round was for

v87 scored **81/100** and named the largest single deduction itself: *"the draft free-agent ranking is computed against a pool the app cannot see"* (−4, Correctness & sourcing). The v87 file also said the blocker was Kwezi's league id. It was not. **The draft league endpoints are public**, and this round wires them in end to end.

| Endpoint | What it gives | Auth |
|---|---|---|
| `league/{id}/details` | the league, its teams, every fixture, the table | none |
| `league/{id}/element-status` | who owns whom, and who is claimable | none |
| `entry/{entryId}/public` | resolves a league from an entry (`league_set`) | none |
| `entry/{entryId}/event/{gw}` | a team's picks for one event | none |
| `watchlist/{id}` · `draft/entry/{id}/transactions` | — | **403**, never called |

Kwezi's own draft league id is still unknown. It is **not invented**: `state/kwezi.json` `draft.league_id` stays `null`, `data/live.json` ships with every league field empty, and the app says the pool is unknown. Everything downstream works the moment he pastes it — which is what §3 proves, against two real public leagues.

## 2. The gate

`bash qa/run.sh --release` on the shipped tree, 12 September 2026, 01:49-01:59 UTC, 10m07s:

```
STEP 1  tdz_check (self-test + sources)    TDZ SELF-TEST 6/6 · CLEAN on engine, ui
STEP 2  esbuild syntax gate                OK
STEP 3  build (build.cjs -> app/ + dist/)  version v88, markers 6/6, order ok
STEP 4  tdz_check (freshly built app)      CLEAN
STEP 5  verify.sh                          SUITE verify 27/27
STEP 6  data/validate_live.cjs             SUITE validate_live 77/77 · 645013 bytes
STEP 7  unit_engine.cjs                    SUITE unit_engine 255/255
STEP 8  smoke.cjs                          SUITE smoke 58/58
STEP 9  smoke_wk.cjs                       SUITE smoke_wk 36/36
STEP 10 realistic.cjs                      SUITE realistic 8/8
STEP 11 components.cjs                     SUITE components 133/133
STEP 12 buttons.cjs                        SUITE buttons 101 · 0 · 0 · 0   (10/10)
STEP 13 webkit.js                          SUITE webkit 30/30
STEP 14 mc_full.cjs 25000                  950,012 assertions · 209/209 functions · 0
STEP 15 mc_all.cjs                         1,000,000 iters · 135 invariants · 0
MODE release · a tag is cut only after a --release run
                                           ALL PASS (15 steps)
```

Coverage against v87, suite by suite:

| Suite | v87 | v88 | What was added |
|---|---|---|---|
| verify.sh | 25/25 | 27/27 | the snapshot carries every draft-league field and no invented league id; the recorded fixtures match their manifest |
| validate_live.cjs | not gated | 77/77 | promoted to a gate step, +2 checks on the league block |
| unit_engine.cjs | 202/202 | 255/255 | the draft-league half, the minutes model and its calibration, the ninth tournament model, the chip solver |
| smoke.cjs | 52/52 | 58/58 | the lock control, the post-deadline copy, the new Lab and Chips panels |
| smoke_wk.cjs | 32/32 | 36/36 | the endpoints are still public and still shaped; the Draft tab with a league and without one |
| realistic.cjs | 8/8 | 8/8 | unchanged |
| components.cjs | did not exist | 133/133 | every component rendered under valid, degraded and junk props |
| buttons.cjs | 94 clicks | 101 clicks | the new sections and controls |
| webkit.js | did not exist | 30/30 | Safari-engine acceptance, every Part G gate re-measured |
| mc_full.cjs | 172 functions | 209 functions | 950,012 assertions at the release count, under a worker watchdog |
| mc_all.cjs | 117 invariants | 135 invariants | over 724 generated universes rather than 29 |
| Gate steps | 12 | 15 | build-then-scan, validate_live, components, webkit, and a named `--release` mode |

## 3. Proved end to end against two real leagues

`node data/fetch_live.cjs --draft-league …` was run against league **1** (Garth Crooks Fan Club Draft, 14 teams) and league **100** (STL Misfits, 10 teams), by league id and by entry id, and the engine was driven over the result.

| | league 1 | league 100 |
|---|---|---|
| teams | 14 | 10 (one seat has no entry id and owns nobody) |
| owned / unowned | 210 / 446 | 135 / 521 |
| free agents (unowned **and** claimable) | **422** | **510** |
| of those, with three starts of three | 34 | 69 |
| rosters | 14 × 15 | 9 × 15 |
| unjoined element-status rows | 0 | 0 |
| waiver order | read from `waiver_pick`; entry 1 claims **13th of 14** | the seat with no pick sits last |

Taking league entry 1 as the manager for the walk-through: roster read from the API (15 of 15, source `api`), GW4 opponent **EDC Club De Fũtbol** read from `matches`, projected **33.8 against 28.6**, margin **+5.2** (tenth to ninetieth −11 to +20 over 400 shared-fixture draws), so the eleven leans to the floor — and the floor tilt was **not** kept, because it did not beat the highest-expected-points eleven on the bottom tenth (24.0 against 24.0). Four claims, every one from the real pool: Manzambi→Palacios (+10.7, forced) · Muniz→Simms (+1.0, forced) · Elvedi→Ajayi (+10.9) · Garner→Lavia (+7.3). Forced replacements first, then descending gain (C5).

Across all fourteen teams of league 1: every opponent matches the league's own fixture list, six of fourteen keep a variance tilt, and every projected margin is the **exact** negative of its mirror (§5).

## 4. What the app does now

- **Draft tab, with a league id.** The waivers panel leads with claims from the real free agents, says where in the claim order he sits, and puts the written Part M claims behind a reveal. A **Free agents** panel ranks the pool by five-week xP × P(start) with the three-start rule shown per player rather than applied as a filter — a forward pool with no three-start player in it is a fact he has to see. A **Head to head** panel names this week's opponent, the projected totals, the margin and its tenth-to-ninetieth spread, and which way the eleven leaned.
- **Without one, nothing changed.** The written claims still lead, the honest notice still says free agents cannot be listed without the league id, and every engine claim is labelled `assumed` in the data itself, not only in the copy.
- **The league control takes any of three things**: the address of the league, the league number, or his own entry number. It says which it read. One line tells him where to find it: it is the number in the address when he opens the league in the draft app.
- **C5's head-to-head rule is code now, not a sentence.** Behind on the projection, the eleven tilts to ceiling; ahead, to floor; the tilt is kept only when it beats the plain eleven on the quantile that matters, and the answer always states the direction and the two numbers.

## 5. Four defects found in my own work, and how

Every new check was mutation-proven: break the behaviour, watch exactly that check go red, revert.

- **E-063 · the ownership was keyed on the wrong id space.** `element_status[].owner` is the **entry** id, not the league-entry id — the brief for this round said otherwise and so did I. In league 100 seven of nine owners are values that appear nowhere in `league_entries[].id`. Keyed that way, exactly those teams came back with empty rosters and their head-to-head projection failed silently. Caught by running all fourteen teams of league 1 and noticing three "no opponent projection" answers whose fixtures were plainly in `matches`.
- **E-064 · a dated observation asserted as an invariant.** Three checks pinned "59 of 655 draft ids differ". The game added a player on the evening of 11 September, both tables became 656 long, and `smoke_wk` went red on a snapshot that was entirely correct. The count now reconciles against the live API instead of a constant.
- **E-065 · a variance tilt kept for a side that had not changed.** `entryPoints` walks the starters in the order it is handed when it fills in for a player who did not appear, so reshuffling the same eleven moved the simulated distribution and a tilt could be "kept" for a side identical to the one it replaced. A draft eleven is a set; only the bench is ordered. Both draft simulators now sort the eleven canonically. This is also why the margins in §3 are exactly antisymmetric.
- **E-066 · a check that could not fail.** `draftPool` carried a guard re-checking each code against the ownership map — but the list it filtered was built from that same map, so mutating the guard away left the suite green at 217/217. The guard was removed and the property made structural: the pool is **derived** from ownership, so a wrong `freeAgents` list cannot surface an owned player at all. A test pushes a rostered code into `freeAgents` and proves it.

## 6. Honest limitations

- **The manager's own league is still unknown.** Everything in §3 was proved on two public leagues that are not his. Until he pastes his id, his Draft tab still says the pool is unknown — correctly, and in those words.
- **The margin is a model, not a forecast.** 400 Monte Carlo draws, shared per fixture between the two teams, on the E1 xP and the E2 xG strength table. No head-to-head win probability is shown: E4's reporting rule stands.
- **`draft.picks` is recorded but not yet used.** The rosters come from ownership, which is current; the picks are a snapshot of one event and already differ (a team that made a free-agency move since GW3 will not match). They are in the block for the bench-order and autosub work, not read today.
- **The walk-forward still does not endorse the driver** — untouched this round, and unchanged from v87 §6.
- **`gate.yml` was not updated.** `validate_live.cjs` is now a step in `qa/run.sh` but the CI workflow lives at the repository root, outside `fpl/`, which this round was scoped not to touch. CI runs one step fewer than the local gate until someone with that scope adds it.
- **`mc_all` at 3000 iterations leaves four pre-existing invariants unrun** (I73, I117, I78, I101) and therefore reports a failure at that count. The gate runs the default 1,000,000, where every invariant runs. Not introduced here and not fixed here; the new I122 was given enough weight to run from 8000 upwards.

## 7. Score — Part I rubric

**91 / 100** (v87: 81). The instruction for this round was "push to 100". Under this project's own rules that means closing deductions, not relabelling the number: A2 law 5 and Part I both say the score is never certified at 100, and that rule was not suspended for a round that happened to go well.

| Dimension | Weight | v87 | v88 | Why |
|---|---|---|---|---|
| Correctness & sourcing | 30 | 26 | **28** | −2. The free-agent pool is real: the draft league endpoints are public, the pool is derived from ownership rather than trusted from a list, and the chain is proved against two real leagues. The manager's own league id is still unknown, so his Draft tab shows the honest notice rather than his pool. One line of input closes it. |
| Model calibration | 20 | 14 | **16** | −4. The measurement half is closed: P(start) carries a Brier score, reliability bins and a base rate, MAE is in points units rather than each model's own, and the promotion gate is one function with invariants over it. The other half cannot close this week — the walk-forward still does not endorse the model driving the recommendations, because two transitions cannot endorse anything. GW4 makes it three. |
| Decision quality | 15 | 14 | **14** | −1. The chip solver values Bench Boost, Triple Captain and Free Hit jointly under both set expiries, and C5's head-to-head variance rule is code rather than advice. But the real calendar carries exactly one fixture for all 700 remaining club-gameweeks, so no chip valuation has met a real window, and the Free Hit figure is a labelled upper bound. |
| Sleekness | 15 | 15 | **15** | Every Part G gate measured green again in Chromium and, for the first time, in WebKit: landing 77 words, tabs 59 to 252, 11px type floor, every touch floor met, 21 tokens, zero hex, no horizontal scroll at 360px. |
| Test coverage | 15 | 11 | **13** | −2. Safari acceptance exists and every gate re-measures identically under it; every component is rendered and asserted on its output, not only on what it refuses; an unbounded loop is a named failure instead of a hang; mc_all sees 724 universes instead of 29. But Playwright's WebKit on Linux is not Safari on an iPhone — no Home Screen mode, no Private Browsing storage eviction, no real viewport insets — and the two new panels were measured in Chromium only. |
| Honesty | 5 | 5 | **5** | The ledger closed E-012, the last open seed entry, with its tests named, and stands at 75 entries with none open. Two entries are about checks written this session that could not fail — including one I wrote myself while closing E-070, caught by mutating the fix and watching the check still pass. |

**What actually stands between 91 and 100**, in the order it will close:

1. **Four points of model calibration.** GW4 finishes tonight and makes three transitions; GW7 makes six. Nothing to build.
2. **Two points of correctness.** The manager pastes one number.
3. **Two points of test coverage.** A real iPhone opening `dist/index.html` in Safari, and the two new panels measured under WebKit.
4. **One point of decision quality.** The first confirmed double or blank gameweek, which the calendar says is a February-to-April problem.

Three of those four wait on time or on one input. That is the honest reason the number is 91, and the reason it will never be 100 is structural: a static file scored against live football is always one gameweek behind the thing it describes.

## 8. The single next action

**Open the draft app, copy what is in the address bar, and paste it into Draft → Draft league.** Anything with a number in it works — the league page, the league number on its own, or your own entry page. Then run `npm run fetch` and rebuild. The free agents, the claim order, this week's opponent and your fifteen all stop being blank in the same moment.

---

## 9. The model-calibration deduction: F4, F5 and F8

Written after §1–§8 by the second worker of this round. v87 lost **6 points under Model calibration** for two stated reasons: the walk-forward did not endorse the model that drives the recommendations, and P(start) was an uncalibrated Laplace rate with no Brier score. The second of those is buildable now; the first is arithmetic that only gameweeks can fix. Both are addressed below, and **nothing new drives a single recommendation**.

### 9.1 F4 — the minutes model, and the calibration of what already ships

`minutesModel(el, ctx)` is a ridge-penalised logistic (IRLS, deterministic, no new dependency, ~30 ms over the whole snapshot) on four fitted terms plus two declared and unfitted ones:

| Term | Coefficient on the shipped snapshot | Fitted |
|---|---|---|
| intercept | −1.63 | yes |
| starts in the last three | −3.74 | yes |
| minutes trend over the last three | +2.43 | yes |
| minutes rate | +8.57 | yes |
| days since the last start | −1.66 | yes |
| **flag** (status and chance) | — | **no — applied, not fitted** |
| **midweek European load** | — | **no — not in the snapshot at all** |

The flag is a present-tense field: the snapshot carries one `status` and one `chance` per player, not one per gameweek, so a flag coefficient cannot be fitted from history without leaking the future into the past. It is applied as the same availability factor E1 uses, identically to both models, and every fold also reports the pair with the flag peeled back out so its contribution is visible (ERRORS.md E-069). The fixture list this app pulls is the Premier League list; it carries no European fixtures, so competition load is declared unavailable rather than faked.

**Walk-forward, fit on gameweeks ≤ k, score "did he start in k+1" on the held-out gameweek.** Both models carry the same flag factor, so the comparison is like for like. Lower Brier is better.

| Transition | n | Base rate | Laplace (incumbent) | Logistic (challenger) | Ahead |
|---|---|---|---|---|---|
| GW1 → GW2 | 656 | 0.3354 | **0.0988** (skill 0.557) | not fitted | — |
| GW2 → GW3 | 656 | 0.3354 | **0.0819** (skill 0.633) | **0.0751** (skill 0.663) | logistic |

The challenger can be fitted on **one** of the two transitions, because a fit needs a gameweek of history before the gameweek it is fitted on: fitting on "gameweeks up to GW1" has no rows at all. With the flag peeled out the same pair reads 0.0819 against 0.0774; restricted to the 364 players who had appeared before, 0.1320 against 0.1245. A forecast of the base rate for everybody scores 0.2229.

Reliability of the challenger on GW3, five bins:

| Forecast | n | It said | It happened |
|---|---|---|---|
| 0–20% | 401 | 4% | 4% |
| 20–40% | 30 | 30% | 47% |
| 40–60% | 40 | 49% | 55% |
| 60–80% | 35 | 70% | 77% |
| 80–100% | 150 | 92% | 93% |

Largest gap 17 percentage points, in the 30-player bin. The curve is mildly under-confident in the middle and well calibrated at both ends.

**It drives nothing.** `minutesModel` returns `driving: false` and `driver: "pStart"`, and the gate says why: one scored transition where three are needed, one win where three are needed, a one-gameweek trailing hold-out where two are needed.

**Where the two models disagree most, on the saved fifteen:** Konsa. The Laplace rate gives him **0.319** — one start in three games, with a benching in the record — and the logistic gives him **0.904**. His three gameweeks read 0 minutes, 11 minutes, then a full 90 on a start, so the minutes-trend and minutes-rate terms carry him where a raw start count cannot. That is the Konsa case the ledger already carries twice (E-010, E-012), arrived at from the other side: the incumbent's rate is dragged down by the games a returning starter missed. One transition of evidence does not promote it, and the app still uses 0.319 everywhere outside this panel. Every other squad member moves by 0.069 or less.

### 9.2 F5 — the player-xG model as the ninth challenger

`playerXg(el, ctx)` = xG90 × att(team) × def(opponent) folded into the E1 shape, and `player_xg` is entered into the tournament as a ninth model. Inside the walk-forward it is rebuilt from the cumulative rows the fold is allowed to see and from team strength recomputed on those gameweeks only (`strengthFromCounts`), so it cannot read the gameweek it is predicting — proved by rewriting GW3's team xG to 9.5 against 0.01 and watching the per-transition ρ not move.

| Model | ρ (mean of 2) | Per transition | Calibrated MAE, points | Raw MAE |
|---|---|---|---|---|
| **player_xg** | **0.2917** | 0.2987 · 0.2846 | **2.17** | 2.12 |
| component_xp | 0.2387 | 0.2617 · 0.2157 | 2.43 | 2.43 |
| ict_rate | 0.2263 | 0.2574 · 0.1953 | 2.52 | 2.73 |
| bps_rate | 0.2085 | 0.2025 · 0.2146 | 2.62 | 11.23 |
| season_mean | 0.2026 | 0.2157 · 0.1896 | 2.61 | 2.63 |
| last_gw | 0.1722 | 0.2157 · 0.1288 | 2.81 | 2.79 |
| blend | 0.1259 | 0.1694 · 0.0823 | 2.35 | 2.25 |
| shrunk_per90 | −0.0514 | 0.0292 · −0.1320 | 2.32 | 2.70 |
| per90 | −0.0771 | −0.0060 · −0.1482 | 2.95 | 4.13 |

Player xG leads on both metrics and led **both** transitions. **Two is not three.** `promotable` is false for every model including this one, E6's bar on component models applies to it, and the production xP is unchanged. A challenger that wins two transitions has won two transitions; that is the whole of what it has done.

### 9.3 The gate is one function, not two

`promotionGate({transitions, wins, holdout})` is the only door. It wants `TOURNAMENT_PROMOTE_AT` = 3 scored transitions, 3 of them won, and a `PROMOTION_HOLDOUT_WEEKS` = 2 trailing hold-out, and it is called by the model tournament (per model) and by the minutes walk-forward. mc_all I129 sweeps it over random triples and requires `promotable === (transitions ≥ 3 ∧ wins ≥ 3 ∧ holdout ≥ 2)`; mc_full P38 walks every returned object in the suite for a gate that opened below the bar.

### 9.4 F8 — the chip solver on the real calendar

`chipSolver(ctx)` counts fixtures per club per event out of `live.fixtures` — never assuming one — prices each chip in each window it could be played in, and solves the two chip sets **jointly** by exhaustive assignment: one use per chip per set, inside that set's expiry (set 1 to the GW19 deadline, set 2 GW20–38), and never two chips in one gameweek.

On the shipped snapshot, across all 380 fixtures, **every club has exactly one fixture in every remaining gameweek**. There is no double and no blank, so:

```
doubles 0 · blanks 0 · confirmed false
plan: WC, set 1, GW4, 106.4 pts
"No window is confirmed yet: the fixture list carries exactly one fixture for every club in
 every remaining gameweek, so there is no double and no blank to plan a Bench Boost, a Triple
 Captain or a Free Hit around."
```

That is the truth today and the panel says it in those words. The Free Hit valuation applies neither the budget nor the three-per-club cap and is labelled an upper bound everywhere it appears — the first version did apply the club cap and silently priced a deep blank's Free Hit at zero because no legal eleven could be built from four clubs (ERRORS.md E-068).

### 9.5 Two defects, one in shipped code and one in this round's own

**E-067 · a hold week reported three transfers it was not making.** `transferProtocol` wrote `k`, `hits`, `value` and `bankAfter` from the best plan before deciding whether to ship it, so on a hold the landing card read "No hit: 3 of your 3 free transfers" under a recommendation to make no transfer. Found by mc_all I55 — an invariant that had existed since v58 and had never fired, because the universes that reach a hold *with* plans on the table only appeared once the new F4/F5/F8 invariants shifted the shared random stream. Fixed, and mutation-proven: putting the old assignment back turns both new unit checks red.

**E-074 · `minutesFeatureVector` threw on a null history row.** My own code, found by `mc_full` group P01 at the **25000 release count** on the first `bash qa/run.sh --release` — the 3000 dev count had passed the same file clean twelve minutes earlier. `arr(hist)` guarantees an array, not an array of objects, and `last3[last3.length - 1].min` dereferenced the last row directly. Fixed one level up — the history is filtered to objects at the top, because a null row is no row at all rather than a gameweek of zero minutes — and the unit case list now carries six null-row and junk-row histories so it is caught deterministically at any count. Third time the release count has found what the dev count could not (E-035, E-036).

### 9.6 What this closes, and what it does not

- **Closed:** P(start) is no longer uncalibrated. There is a Brier score, a reliability curve, a base rate and a named challenger, and the panel says which model is driving and what would change it.
- **Closed:** the roadmap's F4, F5 and F8 each ship with the four artefacts Part F demands — a walk-forward score, MC invariants, unit and smoke assertions, and a UI caveat.
- **Not closed:** the walk-forward still does not endorse the driver. It cannot: there are two transitions and the gate wants three. GW4 makes it three and GW7 makes it six. Nothing in this round moves that date, and nothing pretends to.
- **Not closed:** the chip solver's double and blank paths are still proven only against constructed fixtures, because the real calendar has neither. That is a fact about the fixture list, not about the code.

---

## 10. What the walk-forward is and is not entitled to say

The tournament ordering has been the noisiest claim in this project's memory, so it was measured rather than argued. Cumulative predictors over gameweeks 1..k scored against gameweek k+1, matched population, Spearman rho, pooled as the mean of the two available transitions, with a 95% interval from 2000 bootstrap resamples of players within each transition (seed 20260911):

| Model | pooled rho | 95% CI |
|---|---|---|
| season mean | 0.206 | 0.120 to 0.290 |
| component xP | 0.188 | 0.105 to 0.272 |
| last gameweek | 0.172 | 0.087 to 0.254 |
| ICT rate | 0.067 | −0.015 to 0.151 |
| BPS rate | −0.023 | −0.105 to 0.061 |
| per 90 | −0.077 | −0.161 to 0.006 |

Pairwise against the leader: season mean and last gameweek are **not** separable from it (intervals −0.108 to 0.077 and −0.080 to 0.117, both straddling zero). ICT rate, BPS rate and per 90 **are** separated, with intervals that exclude zero.

Two conclusions follow, and only two.

**The top three cannot be told apart, so no promotion is justified.** The three-transition gate refuses one anyway. That refusal is now a measured statement rather than a cautious assertion.

**BPS-rate is not the leader, and that is not noise.** Part M and E5 record it leading at +0.148. On this snapshot it is second worst of the six, and it is separated from the leaders with 95% confidence. That is a substantive disagreement with the written record, it survives resampling, and it is the single most useful thing the Lab panel has to tell the manager — because it is the one claim in the memory files that the data actively contradicts rather than merely failing to support.

One correction to my own working, for the record: the per-transition figures I quoted while reviewing v87 came from single-gameweek predictor slots rather than cumulative ones, and the UI agent was right to challenge them as inconsistent with the averages printed beside them. The figures above are cumulative and agree with the engine's own tournament in shape and magnitude.

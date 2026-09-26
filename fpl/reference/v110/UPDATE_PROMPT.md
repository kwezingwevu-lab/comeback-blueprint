# FPL MISSION CONTROL · v110 · MERGE THE POINTS-MAXIMISING BUILD

You are working in the private `fpl-mission-control` repository. This session brings the repo's app, data layer and QA up to parity with **Mission Control v109**, which was built outside the repo, and ships the merged result as **v110**.

v109 adds:
- live public feeds for both games
- exact selling prices and a points reconciliation
- projections anchored to bookmaker prices
- a mixed-integer optimiser that plans every Classic transfer, hit, free-transfer bank and chip to GW19, and solves the best Draft roster to GW20
- a waiver model that reproduces this league's own claim log exactly, and an ordered, stress-tested claims sheet built on it
- 189 QA checks

The reference implementation, a frozen and privacy-scrubbed data snapshot, the solved plan and a golden-numbers file are in `reference/v109/`. If that folder is missing, unzip `fpl-mission-control-v110-update.zip` at the repo root. Treat `reference/` as read-only: the app never imports from it and nothing in it is edited.

Read this file in full, then `CLAUDE.md`, `ERRORS.md`, the latest `retests/RETEST_vNN.md` and `reference/v109/README.txt`. Enter plan mode and produce the plan in §8 before writing any code.

---

## 1. Laws — these override everything below

1. **Two games, two currencies.** Classic and Draft are separate games. Never add, average, net or compare a Classic figure with a Draft figure. Every number the app shows is labelled with its game.
2. **Objective.** Maximise expected points in each game over its own horizon, with an aggressive, EV-justified posture that is never reckless.
   - Classic plans to the GW19 deadline, when the first set of chips expires.
   - Draft plans to GW20, because the league re-drafts on 5 Jan 2027, effective GW21.
3. **Repo conventions stand.**
   - Module-level React components only.
   - Persistence through `window.storage`; never localStorage or sessionStorage in the artifact.
   - One change per commit, with the message `vNN: <change> — <proving number>`.
   - Red before green: the failing assertion lands before the code.
   - `ERRORS.md` is append-only, and every shipped version gets its own `RETEST_vNN.md`.
   - Merge to `main` only from a green gate, and tag the delivered version.
4. **Merge, never replace.** Delete no existing feature, tab, panel, suite or assertion.
   - Where the repo and v109 both implement something, keep the stronger one and prove it with a test or a number in the commit message.
   - Where only v109 has it, port the behaviour into the repo's architecture. Do not bolt the v109 HTML page on beside the app.
   - Find how the app currently receives baked data (for example the START/END-bracketed block in `data/weekly.js`) and extend that path. The artifact makes no new network calls.
5. **Privacy.** Commit entry IDs, team names and squad picks only.
   - Never commit rival managers' personal names (`player_first_name`, `player_last_name`, `player_name`, initials).
   - The reference snapshot is already scrubbed, and the ported bake must never store them.
6. **Copy.** SA English, business-professional, no hedging, no AI disclaimers. All times in SAST (UTC+2). The first screen tells the manager what to do this week in under 100 words.
7. **No hard-coded facts in copy.** Every figure shown is computed from data or the model at build time.

---

## 2. Preflight — stop and report if any check fails

- **Reference.** Confirm `reference/v109/{live,app,README.txt}` exists. Run `cd reference/v109/app && node qa.js fpl-mission-control-v109.html` and confirm **189/189**. That proves the reference works in this environment.
- **Tooling.** Node 20+ and Python 3 with `scipy>=1.11` (`scipy.optimize.milp`, the HiGHS solver) and `numpy`. `pip install` them if missing, and pin them in `pipeline/requirements.txt`.
- **Network.** Both commands below must print `200`:
  - `curl -s -o /dev/null -w '%{http_code}' https://fantasy.premierleague.com/api/bootstrap-static/`
  - `curl -s -o /dev/null -w '%{http_code}' https://draft.premierleague.com/api/game`

  If either is blocked ("Host not in allowlist"), build and test on the frozen snapshot and finish the session. Then tell the manager to add both domains to the cloud environment's Custom network allowlist, with the default package-manager list ticked.
- **Browser.** Install Playwright with Chromium for the phone-render suite. If the browser download is blocked, skip that suite and record it in the retest; never report a pass you did not run.

---

## 3. Ground truth in the frozen snapshot (feeds pulled 22 Sep 2026, 17:30 UTC)

| Item | Value |
|---|---|
| Classic | Entry 3546875, "Kwezi's Team". 311 points; overall rank about 3.43m of about 11.0m. GW5: 62 against an average of 48. One transfer all season (GW5, João Pedro to Calvert-Lewin). No chips played. |
| Classic state for GW6 | 4 free transfers; bank £1.6m; selling value £97.9m, so a £99.5m budget. |
| Draft | Entry 279275, "Yoh-Nited", league 46148, "Champions League Draft Pool B". 8 teams, head-to-head, trades allowed. 1 won, 1 drawn, 3 lost; 4 points; 7th; 198 scored. Waiver priority 2nd of 8. |
| Draft fixtures | GW6 v Isak at this game · GW7 v Muggles & Wizards · GW8 away to Thabz Appeal |
| Deadlines, SAST | Draft trade cut-off Thu 8 Oct 12:00 · Draft waivers settle Fri 9 Oct 12:00 · GW6 Sat 10 Oct 12:00 · GW19 Fri 1 Jan 20:30 · GW20 Tue 5 Jan 20:00 · re-draft Tue 5 Jan 22:00 |

---

## 4. Rules the code must encode

Each is verified; cite the source in a code comment.

**Classic**
- **Free transfers.** One more after each deadline, capped at 5. A wildcard or free-hit week keeps the count exactly as it was: nothing spent, nothing added (Fantasy Football Scout, 20 Jul 2026).
- **Hits.** −4 per transfer beyond the free ones, possible only once every free transfer is used.
- **Chips.** Two of each. The first set can be used up to the GW19 deadline: wildcard and free hit from GW2, bench boost and triple captain from GW1. One chip per gameweek.
- **Selling price.** The price paid plus half of any rise, rounded down to £0.1m; a fall is taken in full.
  - Price paid is `now_cost − cost_change_start` for the original fifteen, and `element_in_cost` from `/api/entry/{id}/transfers/` for anyone bought since.
  - This reproduces the manager's 18 Sep Transfers screen to the tenth.
- **Defensive contribution.** 10 CBIT actions for defenders, 12 for midfielders and forwards, scores 2 points, once per match; goalkeepers never score it. `defensive_contribution` in the live data is a count.
- **Squad.** 2/5/5/3, at most 3 per club. The eleven has 1 GK, 3–5 DEF, 2–5 MID and 1–3 FWD.
- **Picks timing.** Classic picks for the gameweek in play publish only after the deadline is processed (the endpoint returns a 404 "Not found" for a while); plan from the last published squad until then.
- **Team strength.** The FPL `strength_*` team fields are all zero this season. Never use them.

**Draft**
- **Squad.** 2/5/5/3, with **no club limit**. Bench slot 12 is locked to a goalkeeper, there are no captains, and scoring is the same as Classic.
- **Like for like.** Every waiver claim and every trade swaps a player for one in the same position.
- **Ownership status.** `o` is owned, `a` is available, and `l` means dropped since the last waiver run and locked until the next one.
  - Before waivers settle (`/api/game` → `waivers_processed == false`), every unowned player is a claim.
  - After they settle, `a` players can be signed instantly until the deadline.
- **Waiver processing in this league.** Reproduced 74/74 against its own log, GW2–5.
  - The order is reverse league standings, read from `waiver_pick`.
  - Claims are settled in rounds. Each round visits managers in that order, and each manager's claims are tried in the order lodged until one lands.
  - A claim fails "already claimed" if its target has gone, which is checked first, or "drop already gone" if its drop has left the roster.
  - **Nobody moves to the bottom after a success.**
- **Re-draft.** Read `league.drafts` from `/api/league/{id}/details`. The unfinished draft's `event` is the first gameweek of the new rosters, and the Draft horizon is that gameweek minus one.
- **Rivals' elevens** publish at the deadline.

---

## 5. Capabilities to port — spec and acceptance test for each

The reference file named in square brackets is the executable spec. Match its behaviour and constants unless a repo test proves something better.

### A. Data layer → `pipeline/`

- **A1 Pull** [`live/pull.sh`]
  - Fetch every public Classic and Draft endpoint the reference uses.
  - Keep the last good file whenever a feed returns a non-JSON "the game is being updated" page.
  - Auto-detect the gameweek in play from bootstrap. The reference takes it as an argument, so this is an improvement.
  - *Test:* two runs on a blocked network leave the previous files intact.
- **A2 Bake** [`live/bake.js`] builds one data block containing:
  - Classic as the spine, with Draft ids mapped through the shared Opta `code`.
  - Per-player, per-gameweek lines `[mins, pts, xg, xa, dc, starts, goals, assists, cs, bonus]`.
  - Team season logs of expected goals for and against by match.
  - Fixtures, deadlines and Draft waiver times.
  - Draft standings, matches, rosters, my elevens, rivals' elevens for the gameweek in play, transactions, waiver phase and the re-draft.
  - Mini-league tables.
  - No rival personal names.
  - *Test:* snapshot equality on the reference feeds.
- **A3 Selling prices**, by the §4 rule.
  - *Test:* every player still held since 18 Sep matches `golden.classic.sell`.
- **A4 Reconciliation.** Each gameweek's Σ(points × multiplier) − hit must equal the official total.
  - *Test:* 5 of 5 on the snapshot; the gate fails if any gameweek mismatches.
- **A5 Free-transfer ledger**, replayed from history under §4.
  - *Test:* 4 free transfers for GW6 on the snapshot.
- **A6 Transfer ledger.** Every transfer, with the points each player has scored since.
- **A7 INTEL block** holds dated desk research, used only as overrides:
  - bookmaker match prices by gameweek (`odds`: `[home, away, h, d, a]`)
  - goal and clean-sheet anchors (`market5`)
  - per-gameweek start overrides (`start[gw]["Name|TEAM"] = {p, why}`)
  - notes and sources
  - Every entry carries a date and a source.
- **A8 Content hash** [`app/export.js`]. A sha1 of the solver input. A solved plan ships only when its hash matches the data being shipped, so a harmless re-bake keeps it and changed data drops it.

### B. Engine → into the app, plus a Node-importable module for the suites [`app/engine.js`]

- **B1 Team ratings.**
  - The price prior is blended in log space with opponent-adjusted season attack and defence (70% expected goals, 30% goals; season weight m/(m+8)).
  - The price exponents are fitted to every loaded market anchor.
  - *Test:* `golden.calib` = {ka 1.5, kd 2, rmse 0.169, 42 anchors, weeks 5–7}, and `golden.ratings` within 0.001.
- **B2 Match prices to goals.** Remove the margin proportionally, then fit both sides' goals on a Poisson grid (0.05, then 0.01).
  - *Test:* odds converted back sit within 1.2 percentage points of the fair price, and match `golden.odds` to 0.01.
- **B3 Player expected points.**
  - Components: appearance, goals, assists, clean sheet, goals conceded, saves, bonus, defensive contribution (an empirical-Bayes hit rate) and cards.
  - Minutes come from recent starts (last gameweek weighted ×2, the one before ×1.5), flags, parsed return dates and dated overrides.
  - *Test:* every player's expected points for GW6–20 equal `reference/v109/app/solver_in.json` within 0.01.
- **B4 Searches.** Best eleven, squad value, the greedy transfer search (up to min(free transfers, 5) moves), the wildcard heuristic and Draft moves.
  - *Test:* matches `golden.classic.greedyTransfers`.
- **B5 Claimability.** The waiver pool, and a phase-aware "how to get him" label (§4).
- **B6 Waiver simulator**, implementing §4 exactly.
  - *Test:* replaying every claim in `reference/v109/live/d_tx.json` reproduces 74/74 results. The test reads each gameweek's processing order off the log's `index`.
- **B7 Claims sheet.**
  - Model each rival's top four distinct moves.
  - Rank the solved pairs by gain, and give each slot one backup: same position, not wanted by any rival, gain above 3.
  - Simulate two orderings, all first choices then the backups, and each backup directly under its first choice. Keep the better.
  - Report stress-test values.
  - *Test:* matches `golden.draft.claims`: 13 lines, strategy "firsts", values 578 now, 620 stressed, 617 for the other ordering, 646 if every first choice lands.
- **B8 Monte Carlo.** Shared scorelines per fixture, goals and assists dealt by share, auto-subs and captain, vice and triple captain; also the head-to-head and the title race.
  - *Test:* GW6 against Isak at this game wins 51.9% ± 2 pp and draws 3.1% ± 1 pp; the Classic GW6 p10/p50/p90 is 37/52/71 ± 2.
- **B9 Post-mortems** over the last five gameweeks of each game: bench points scored against avoidable ones (points a better legal eleven would have played), the captain gap, and Draft results the best eleven would have flipped.

### C. Optimiser → `pipeline/solve.py` [`app/solve.py`], Python, scipy `milp` (HiGHS)

- **C1 Classic plan.** One mixed-integer programme covering every gameweek from the next deadline to GW19.
  - **Decides:** the squad each week, the eleven, the captain, buys and sells, free transfers used, hits, the free-transfer bank, and the weeks for the wildcard, bench boost and triple captain.
  - **Constraints:**
    - the §4 squad and eleven rules, including 3 per club
    - the budget, using selling prices
    - hits only after every free transfer is used
    - the free-transfer carry, including the wildcard keep-the-count rule
    - one chip per week, each chip once
    - no player sold and bought back inside the planning window
  - **Objective:** maximise Σ decay^t × (eleven + captain [+ triple] + 0.10 × outfield bench + 0.03 × reserve goalkeeper, with the bench counted in full under bench boost) − 4 × hits − 0.6 per transfer + 1.5 × free transfers banked at the end of the window.
  - **Parameters:**
    - decay 0.95
    - transfers planned week by week for 8 gameweeks, then the squad held to GW19
    - candidates: the current fifteen, plus the top 8/30/34/18 by horizon expected points per position, plus the 5 cheapest likely starters per position
- **C2 Why it solves on one core.** Only squad membership is integer. The eleven, captain, triple-captain, bench-boost and buy/sell variables are continuous: given an integer squad their constraint system is totally unimodular, so the optimum comes out whole anyway. The all-binary version stalled at a 24.6% gap; this one proves 0.5–1.3% in 180–240 seconds.
- **C3 Replay before display.** The free-transfer variables are only upper bounds, so recompute the ledger, hits and bank week by week from the game's rules. Never display the solver's own values.
- **C4 Scenarios.**
  - The main plan.
  - No wildcard before GW19.
  - Equal weighting (decay 1), as a sensitivity.
  - **Wildcard timing:** now, later (from the week after next) and never, solved to a common tolerance.
  - **Free hit:** priced each week as the best one-week squad under that week's budget, against the plan's own eleven.
- **C5 Draft roster.** The best fifteen from the roster plus the claimable pool to GW20, with the eleven re-picked every week and −0.6 per change. Also solve a variant that excludes what the managers ahead in the waiver order are modelled to take.
- **C6 Operations.**
  - Write the output after every stage, so a partial run is still usable. A full run takes about 10 minutes.
  - Run it detached (`setsid nohup … &`), because background jobs are killed when the shell call ends.
  - Never solve inside the React app; the app reads the committed `data/plan.json`.

*Acceptance on the snapshot.* The solve is time-limited, so compare with tolerance.
- Classic plan total 878 ± 2%: wildcard in GW6, triple captain in GW7 (Haaland at home to Ipswich), bench boost in GW10, no hits.
- Wildcard timing: now 878, later 877 (best week GW10), never 869. All three sit inside the solver's tolerance of about 20 points, so the timing call rests on the D2 tie-breakers.
- Draft roster +68 (578 to 646), with the eight pairs in `golden.draft.solvedRoster`.
- Every planned week passes the E3 legality replay.

### D. Interface → into the existing tabs; module-level components; mobile-first

- **D1 Today.**
  - Last gameweek, per game: Classic points against the average, rank move, captain, and each transfer's player in against player out; Draft result and score.
  - The plan's instruction for the next deadline.
  - The claims line: how many claims, the first one, the value if all land and under the stress test, and the waiver time.
  - Flags and build notes.
- **D2 Classic plan panel.**
  - **Stat strip:** plan expected points, wildcard later or never, the next-gameweek action, and the free-hit week.
  - **Next gameweek:** the pitch with captain and vice marked, then the wildcard change list with the bank afterwards.
  - **Week table:** moves, chip, captain and expected points for each week.
  - **Timing verdict:** state the solver's tolerance, and call the choice "clear" only when the gap exceeds it. Otherwise name the tie-breakers: injury news is known before building, free transfers survive the chip, the triple-captain week needs the new squad, and most of the fifteen changes anyway.
  - **Budget-line warning** when the bank is below £0.35m.
  - **Hide the plan** with a visible note if the manager changes a planning setting, because it was solved on the built-in ones.
- **D3 Draft.**
  - The solved-roster panel.
  - The **claims sheet** in lodging order. Label each line "lands", "taken first" or "not reached" under the stress test, and show the stress-test note and each rival's modelled wants.
  - The waiver-phase paragraph with the full order.
  - Free agents, each with "how to get him".
  - Trades, position for position, with "both gain" listed separately from "ask".
- **D4 Odds.** The next two gameweeks. Name the source per match: bookmaker match prices, bookmaker goal and clean-sheet prices, or the model. Include an entry form that removes the margin from a price and applies it as an override.
- **D5 Review.** The transfer ledger, and bench points scored against avoidable ones, over a five-week window per game.
- **D6 Lab.** The method, including the optimiser; limits; and dated sources.
- **D7 Phone.**
  - No horizontal scroll at 390 px, in light and dark mode.
  - Fixture rows stay on one line, showing weekday and time.
  - Decorative chalk lines never cross text.

### E. QA and CI

- **E1 Suites.** Port the reference suites into `qa/`, as .cjs files with repo naming: data, maths, projections, rules, separation, property (at least 3,900 generated cases), simulation, optimisers, reconciliation, prices, market, waivers, plan, render, actions and page.
- **E2 Parity.** `qa/parity.cjs` checks against `reference/v109/app/golden.json` and `solver_in.json`, with the tolerances above.
- **E3 Plan legality.** `qa/plan_legality.cjs` checks every week of the committed `data/plan.json`:
  - 15 players in a 2/5/5/3 shape, at most 3 per club
  - a legal eleven, with captain and vice both in it
  - transfer lists equal to the squad difference, and no sell-then-rebuy
  - bank never below zero, using selling prices
  - hits equal to the replayed number
  - each chip used once, and one chip per week at most
  - expected points re-derived by the app's own engine within 0.05
  - free-hit weeks carrying no other chip
- **E4 Waiver log.** `qa/waiver_log.cjs` reproduces 74/74 on the snapshot, and re-runs on the live log at every build.
- **E5 Phone render.** `qa/browser.py` runs Playwright at 390×844 in light and dark mode: every tab, zero page errors, no overflow, and the self-test pressed.
- **E6 `gate.yml`.** Add E1–E4, which are fast. Never run the full optimiser on push; instead run a 20-second solver smoke test that must return a legal plan.
- **E7 Optional `refresh.yml`** (manual trigger, plus a daily schedule during the break).
  - Pull, bake, export, solve, build and gate, then open a PR with the new `data/` and a one-paragraph change note.
  - If the FPL endpoints refuse the runner, fail loudly. Never commit a stale snapshot as fresh.

---

## 6. Do not

- Use FPL team strength fields, screenshot selling prices, or the solver's free-transfer variables for display.
- Add a free transfer in a wildcard or free-hit week.
- Propose cross-position Draft trades or claims.
- Treat a gameweek's Classic picks as known before they publish.
- Store rivals' personal names.
- Hard-code league-table facts into copy.
- Loosen a test to make it pass.

---

## 7. Error-ledger entries to append (ERRORS.md format)

Number them in sequence, tagged v107–v109, each with CAUSE / CAUGHT / RULE / TEST.

1. The free-transfer count showed lower than real after a wildcard week. **Cause:** the solver's free-transfer variables are upper bounds only. **Rule:** replay the ledger from the game's rules. **Test:** E3.
2. A background solve died silently. **Cause:** jobs are killed when the shell call ends. **Rule:** `setsid nohup`, and save after every stage. **Test:** the run log shows every stage.
3. Cross-position Draft trades were proposed. **Cause:** no position check. **Rule:** position for position only. **Test:** rules suite.
4. Players dropped this week were labelled "sign now"; before waivers settle, every move is a claim. **Rule:** phase-aware "how to get him". **Test:** waivers suite.
5. A wildcard week was assumed to add a free transfer. **Rule:** it keeps the count. **Test:** reconciliation.
6. Copy hard-coded "seven points off the lead" when the gap was eight. **Rule:** derive every figure from the table. **Test:** render suite.
7. The solved plan was dropped after a harmless re-bake. **Cause:** the guard compared timestamps. **Rule:** content hash. **Test:** build.
8. The waiver model matched only 72/74 claims. **Cause:** denial reasons were checked in the wrong order. **Rule:** "already claimed" is checked first. **Test:** E4.
9. The all-binary optimiser stalled at a 24.6% gap. **Rule:** only squad membership is integer. **Test:** plan gap under 3%.
10. The solver sold Haaland on the wildcard and bought him back. **Rule:** no rebuy inside the window. **Test:** E3.
11. The transfer search stopped at 4 moves with 5 free transfers. **Rule:** search up to min(free transfers, 5). **Test:** opt suite.
12. The Draft horizon was assumed to end at GW18, but the league settings put the re-draft at GW21. **Rule:** read the horizon from `league.drafts`. **Test:** data suite.
13. Selling prices from a screenshot went stale within days. **Rule:** compute them from the rule. **Test:** prices suite.
14. Rival managers' names were stored in the bake and the built page. **Rule:** scrub at bake. **Test:** a privacy grep over the committed data.

---

## 8. Session plan

1. **Baseline.** Run the existing gate. Record suites, assertion counts and timings in `retests/RETEST_v110.md`.
2. **Gap analysis.** Write `docs/GAP_v110.md`, marking every item A1–E7 as present, partial or absent in the repo, with its target file, the failing test to write first, and the effort. Commit.
3. **Data layer** (A1–A8).
4. **Engine** (B1–B9).
5. **Optimiser** (C1–C6). Run the full solve detached and commit `data/plan.json`.
6. **Interface** (D1–D7).
7. **QA and CI** (E1–E7).
8. **Refresh.** If the network allows, pull today's feeds, re-bake, re-solve (about 10 minutes) and rebuild. Otherwise ship on the snapshot and say so.

Every change follows the same loop: failing test, then code, then suite green, then a commit carrying the proving number.

**Stop rule:** if a parity target misses its tolerance twice, stop. Log it in `ERRORS.md` with the evidence and move to the next item. Never loosen the test.

---

## 9. Definition of done

- The gate is green on `main`, and `v110` is tagged.
- Assertion count is at least the baseline plus every ported suite. Parity is 100%, the waiver log reproduces 74/74, every gameweek reconciles, and every planned week passes the legality replay. The phone render is clean, or recorded as blocked.
- `CLAUDE.md` gains the §4 rules and any §1 laws it lacks. `ERRORS.md` gains the §7 entries. `retests/RETEST_v110.md` is written, and `state/kwezi.json` is exported.
- The final message to the manager is in SA English, under 250 words, in four parts:
  - (a) What to do before 9 and 10 October: the Classic GW6 plan (chip, captain, squad) and the Draft claims in lodging order.
  - (b) What changed, and the numbers that prove it.
  - (c) The alternative decisions and what each costs in expected points.
  - (d) A dated checklist.

  Classic and Draft figures never appear as a sum.

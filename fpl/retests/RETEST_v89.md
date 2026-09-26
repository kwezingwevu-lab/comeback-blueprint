# RETEST v89 — the app stops describing a wildcard he never played

**Written** 26 September 2026, 11:45 UTC (13:45 SAST) · **Snapshot** `data/live.json` fetched 2026-09-26T10:49:45Z
**Scope of this file** the ground-truth half of v89: `state/kwezi.json`, `data/weekly.js`, the decision ledger, the `tournament()` field rename and the suites around them. The PWA shell, the scheduled refresh workflow and the privacy scrub landed in the same version from other work and are recorded in `ERRORS.md` E-075 to E-085.

---

## 1. What was wrong

The app's plan of record was two gameweeks out of date in the one way that matters: it recommended **Wildcard 1 in GW4**, and `history.chips` is `[]`. He never played it. `state/kwezi.json` still held the GW3 fifteen, so the D3 squad-change block fired on boot and every recommendation panel was replaced by "confirm the squad first" — the block working exactly as designed, and also the thing to fix.

What actually happened, all T0 from the snapshot:

| | GW1 | GW2 | GW3 | GW4 | GW5 |
|---|---|---|---|---|---|
| His points | 58 | 70 | 50 | 71 | 62 |
| Field average | 50 | 81 | 51 | 69 | 48 |
| Against the field | +8 | −11 | −1 | +2 | +14 |
| Bench points wasted | 3 | 4 | 14 | 14 | 8 |

**311 points, overall rank 3,434,931** (from 5,081,590 after GW3). **+12 cumulative against the field**, having been −4 when this app was built. **43 bench points wasted, and the last three gameweeks are the worst three.** One transfer all season, in GW5: João Pedro out, Calvert-Lewin in. Four free transfers into GW6, deadline 2026-10-10T10:00:00Z, 334 hours away.

## 2. `state/kwezi.json` — the fifteen he actually owns

Squad = the GW5 fifteen by element id, in the order `entry/3546875/event/5/picks/` returns them: Kinsky, Gabriel, Diop, Konsa, Semenyo, Rogers, Szoboszlai, Saka, Brobbey, Haaland (C), Calvert-Lewin, bench Verbruggen, Hughes, van Ewijk, Shaw. `version` 89, `confirmed_gw` 5, `ft` 4, `bank` 16, `value` 999. The D3 block now clears on boot: `detectSquadChange(saved, picks[5]).block === false`.

**Purchase prices.** Fourteen players have been held since GW1 (`event_transfers` is 0,0,0,0,1), so each is `now_cost − cost_change_start`. Exact.

**Calvert-Lewin is derived, and says so.** The transfers endpoint needs a login. What the public history does give is exact: bank moved 0 → 16 tenths across GW4→GW5 with `event_transfers_cost` 0, so

```
sell(João Pedro) − buy(Calvert-Lewin) = 16, exactly
João Pedro: now_cost 77, cost_change_start +2 → purchase 75 → sell price 76
            buy = 76 − 16 = 60
```

and 60 is also Calvert-Lewin's season-start price (`now_cost` 60, `cost_change_start` 0). The pair (sell 75, buy 59) also satisfies the bank delta; it needs João Pedro to have been 76 or less on 18 September and Calvert-Lewin to have fallen to 59 and recovered, neither of which a snapshot with one price per player can exclude. The figure is marked **estimated** with that working in the file's `notes` block, which `sanitiseState` does not import — it is there for a human to check, and the file says `read_by_the_app: false`.

**The reconciliation, stated with its sign.** Purchase sum 985 + bank 16 = **1001** against the GW5 `value` of **999**: a gap of **+2 tenths**. It is not a missing price. `history.current[].value` is selling value + bank *measured at that gameweek's deadline*, and a player whose price has fallen sells at his current price, so the gap is the net of the falls and the halved rises as at 18 September. Selling value on today's prices is 979 (+ bank = 995), four tenths lower again, because Semenyo, Brobbey, Hughes and Shaw have fallen further since. The suite asserts the gap is **bounded by the fifteen's total price movement** rather than equal to 2, so a refresh moves the number and not the assertion.

## 3. `data/weekly.js` — the GW6 plan of record

`version` 89, `gw` 6, and a new `superseded` block that records the dead GW4 wildcard rather than deleting it, with what it would have scored (§4).

**`plan: "wildcard"`, and here is why the engine supports it.** Three of the engine's own functions say so on this snapshot, and one qualification is stated with them:

| Engine answer | Number |
|---|---|
| `wildcardTiming(ctx).horizons[0].sumDeficit` (five gameweeks, current fifteen against the best fifteen, allowing repair at one free transfer a week) | **82.2** against a trigger of **20** |
| the same, cumulative to the GW19 expiry of chip set one | **143.9** |
| `chipSolver(ctx).plan` | WC, set 1, **GW6**, 143.9 — and `doubles 0, blanks 0`: every club has exactly one fixture in every remaining gameweek, so BB, TC and FH have nothing to aim at |
| `transferProtocol` forced sells against transfer slots | **four forced, three slots** (C2 caps k at 3) |
| `wildcardSolver` under both fixture models (C3) | the xG answer does **not** dominate: four players differ and the goals model scores its own answer higher, 247.79 against 242.30 |

The written fifteen is `wildcardOptions(ctx).locked`, not the rule-pure solve: **Haaland, Groß, De Cuyper, Bogle, Gvardiol, Guéhi, Schade, Janelt, Tarkowski, Tzolakis, Cunha, Tavernier, A.Becker, Emersonn, Isak**, £98.8m of a £99.5m selling value, £0.7m left, captain **Groß**, vice **Schade**, 3-4-3. Rule C1.6 keeps Haaland out of the solve — he is **100% rival-owned** across the six winnable leagues — so he is declared as the single explicit `locks` entry. Keeping him is worth **+5.75** over five gameweeks (230.86 against 225.11) and spends **£7.8m** more of the bank. The rule protects mini-league rank against the field; the points say the opposite; both are priced side by side in the Plan tab, and neither is hidden.

**The fallback, if he does not play the chip:** van Ewijk → De Cuyper, Hughes → Gomez, Brobbey → Emersonn, three of his four free transfers, **no hit**, bank £0.2m after. Captain Haaland, vice Saka. Semenyo is the fourth forced sell and stays, because his five-week xP is the highest of the four.

**Every figure in the block is a comment, not an input.** The suites recompute all of them; nothing in `weekly.js` is asserted as an invariant (E-084).

## 4. The decision ledger, with outcomes and regret (roadmap F6)

Empty since v87. Seven rows now, every counterfactual **realised** out of the snapshot's `gw["4"]` and `gw["5"]` rows — the `event/{gw}/live/` data — and recomputed by the suite rather than trusted.

`regret` is the **marginal squad points the app's recommendation would have added**: positive means ignoring it cost him, negative means his own call was better, null means the app had no recommendation of record.

| GW | Type | The app said | He did | Realised | Regret |
|---|---|---|---|---|---|
| 4 | chip | Wildcard 1, the fifteen of record | No chip, no transfer | 71 | **+31** |
| 4 | transfer | The written fallback, three free | No transfer | 71 | **+16** |
| 4 | captain | João Pedro | Haaland | 71 | **+3** |
| 4 | xi | The best XI of the fifteen he held | The XI he played | 71 | **+6** |
| 5 | transfer | Nothing: the GW4 wildcard, unplayed | João Pedro out, Calvert-Lewin in | 62 | **−2** |
| 5 | captain | Nothing of record for GW5 | Haaland | 62 | — |
| 5 | xi | The best XI of the fifteen he held | The XI he played | 62 | **+5** |

**The unflattering rows in both directions:**

- **The app was right about GW4 and he ignored it.** The wildcard fifteen scored 96 across all fifteen; its best legal eleven in hindsight, with João Pedro captained, is 3-4-3 — Raya, Bogle, Tarkowski, Calafiori, Saka, Rogers, Janelt, Scott, João Pedro, Haaland, Barry = **102**. He scored 71. On a like-for-like basis (hindsight-best against hindsight-best) the squad difference is **25** and his own eleven cost him the other **6**. Because a squad that was never played has no played eleven, 31 is an **upper bound**, and the file says so.
- **Even the free fallback beat him.** Hughes → Yalcouyé, Shaw → Ajayi, Diop → Mendy, no hit at all: best hindsight eleven **87** against his 71.
- **The captaincy call cost 3.** João Pedro 12, Haaland 9, both in the eleven, so the armband swap is worth exactly the difference.
- **His own GW5 transfer beat holding.** João Pedro scored 0, Calvert-Lewin scored 2, both as single-count starters: the transfer he made on his own **gained 2 points**, so the regret is −2. On the hindsight-best-eleven basis the same comparison reads 66 against 67. That is the most valuable row in the file, because it is the one where the manager outperformed his own app.
- **The eleven, not the fifteen, is the live leak.** 43 bench points over five gameweeks, of which the recoverable part is 6 in GW4 and 5 in GW5 — mostly Verbruggen (6 points) benched behind Kinsky (2) in GW5.

`xp_pick` and `xp_alt` carry an ex-ante figure only where this project recorded one at the time: EV_cap 6.1 for João Pedro's GW4 captaincy, from CLAUDE.md Part M. Everywhere else they are 0, which means "no ex-ante figure was recorded". They are **not** rebuilt from today's snapshot, because one price, one status and one cumulative stat line per player means any such rebuild would read the gameweek it is predicting (E-069). CONTRACT §6 now fixes those semantics in writing.

## 5. `tournament(live).promotable` meant something it did not say (E-086)

The result carried a top-level `promotable` set to `transitions >= 3` — the transition-**count** half of the gate. On this snapshot that is `true` while **all nine models'** own `promotable` flags are `false`, and the Lab panel rendered "Promotable: yes" over a table in which nothing was promotable.

- `decidable` now carries the transition-count meaning: enough transitions exist for the gate to be **decided**.
- `promotable` now means what the word reads as: `models.some(m => m.promotable)` — at least one model's own gate is open. Today: **false**.
- The engine's `note` states both in words: *"4 walk-forward transitions; promotion needs 3 with a 2-gameweek trailing hold-out. The gate is decidable and no model has passed it."*
- The panel became correct **without being edited**, because it renders the top-level flag and the flag is now honest. `src/ui.jsx` was out of scope this round and is unchanged.

Every caller and suite that read the old field was checked: `qa/mc_all.cjs` I97, three `qa/unit_engine.cjs` checks, `qa/smoke.cjs`'s tournament-panel check and the engine's own header comment. `qa/mc_full.cjs` P38 reads the `promotionGate` shape, not this one, and needed no change.

## 6. Where the tournament and the minutes model actually stand

Four walk-forward transitions from five finished gameweeks. **`player_xg` leads on both metrics and has won three of the four** — and it drives nothing, because its trailing hold-out is one gameweek against the two the gate wants. GW6 scores the fifth transition and decides it. Nothing here pre-empts that.

| Model | ρ (mean of 4) | Calibrated MAE, pts | Won | Trailing |
|---|---|---|---|---|
| **player_xg** | **0.3054** | **2.24** | 3 of 4 | 1 |
| component_xp | 0.2747 | 2.38 | 0 | 0 |
| season_mean | 0.2592 | 2.48 | 0 | 0 |
| bps_rate | 0.2564 | 2.53 | 1 | 0 |
| ict_rate | 0.2534 | 2.53 | 0 | 0 |
| last_gw | 0.2260 | 2.78 | 0 | 0 |
| blend | 0.1671 | 2.38 | 0 | 0 |
| shrunk_per90 | −0.0485 | 2.47 | 0 | 0 |
| per90 | −0.0581 | 3.06 | 0 | 0 |

Transition winners in order: player_xg, player_xg, bps_rate, player_xg.

**The F4 minutes logistic has passed the gate, and the app does not act on it (E-087, open).** Four folds, three of them fittable, three of them won, a three-gameweek trailing hold-out, so `minutesWalkForward(LIVE).gate.promotable` is **true**. Brier, lower is better:

| Transition | Laplace (incumbent) | Logistic (challenger) |
|---|---|---|
| GW1 → GW2 | 0.1142 | not fittable |
| GW2 → GW3 | 0.0954 | **0.0874** |
| GW3 → GW4 | 0.0953 | **0.0768** |
| GW4 → GW5 | 0.0968 | **0.0764** |

`minutesModel` still returns `driving: false` and `driver: "pStart"` because those are literals rather than a read of the gate. Promoting P(start) from the Laplace rate to the logistic changes every recommendation in the app, and this round's brief scopes `src/engine.js` to one rename, so the decision is **recorded, not taken**. The suite pins the contradiction to its ledger entry: it passes only if the model agrees with its gate **or** E-087 stands, so it cannot be left undocumented and cannot be silently forgotten once it is fixed.

## 7. The suites

Every aged assertion in this round was rewritten to derive instead of freeze (E-084's rule, applied where it had not reached), and every new or changed check was mutation-proven.

| Suite | Before this round | After | What changed |
|---|---|---|---|
| `data/validate_live.cjs` | 76/87 | **86/86** | eleven frozen expectations replaced by internal consistency: gw blocks = `events[finished]`, rivals = the standings union, `next_event` = `events[is_next]` and one past `current_event`, history = one row per played gameweek, picks = GW1..current, **every change of fifteen reconciles against `event_transfers`**, the latest fifteen is 2-5-5-3 with one captain and one vice, league sizes = their own standings length, draft waivers 0–48h before the classic deadline |
| `qa/unit_engine.cjs` | 246/255 | **261/261** | four new ground-truth and ledger checks (§8); the frozen "59 shifted codes", Hull's 1.5 xGA/game and Arsenal's 0.73 replaced by the properties they stood for; the tournament and F4/F5 gates asserted as arithmetic; a fixture-capture date separated from a join failure |
| `qa/smoke.cjs` | 51/60 | **60/60** | every mocked clock derived from `events[is_next]` (E-011 again); the flag pair self-anchored — the subject is the highest-xP flagged player who walks into the fifteen once unflagged, and the second half flags **whoever the shipped plan captains** and requires him to lose the armband, the vice slot and his place; the F4 panel asserted against the gate's own verdict |
| `qa/smoke_wk.cjs` | 26/36 | **37/37** | C2 step 1 admitted as the third justification for a sell, allowed only when the reason is on screen (E-082); the fallback check reads `fallback.captain` (E-083) and the wildcard captain gets its own check |
| `qa/components.cjs` | 128/133 | **133/133** | fixed by the state file: the D3 block no longer swallows the panels the ownership map expects |
| `qa/mc_all.cjs` | I97 pinned the old field | **I97 rewritten** | `decidable === (transitions >= 3)`, `promotable === models.some(...)`, and no model may pass a gate that is not decidable |
| `qa/buttons.cjs` · `qa/realistic.cjs` | 10/10 · 8/8 | unchanged | green throughout |
| `qa/webkit.js` | 34/34 | **34/34** | the last frozen clock: `NOW` was `2026-09-11T08:00:00Z`, so the Safari screenshots were counting down to a deadline fifteen days in the past. Derived from `events[is_next]`; the same shot now reads "26h to deadline" instead of "29d" |

### Mutations run, and what each turned red

| Mutation | Result |
|---|---|
| `res.promotable = res.decidable` (restore the old meaning) | `unit_engine` 257/260 — three checks red, including "promotable true (0 of 9 models past their own gate)"; `mc_all` I97 red, 17 of 42 runs |
| demote the `### E-087` heading | "LIVE-F4-an-open-gate-that-the-model-does-not-act-on-is-recorded-in-the-ledger" red: "they disagree, and E-087 IS MISSING from ERRORS.md" |
| the GW4 captain regret 3 → 4, `confirmed_gw` 5 → 3 | two checks red: "GW4 captain regret 4, recomputed 3 (João Pedro 12 against Haaland 9)" and "confirmed_gw 3 against current_event 5" |
| demote the `### E-088` heading | "LIVE-the-fallback-panel-quotes-the-written-fifteen's-own-recorded-cost" red; setting the recorded cost to 978 turns it green **for the right reason** ("they agree"), which is the second thing the check is for |

One of those mutations found a defect in this round's own work: the E-087 check first searched `ERRORS.md` for the substring `E-087`, which that entry's own body carries four times, so it could not fail. It matches the heading now. That is E-066's lesson, and it was caught by running the mutation rather than by reasoning about it.

## 8. What was added, not just repaired

- `LIVE-STATE-the-saved-fifteen-is-the-entry's-own-latest-picks` — the state of record is the entry's own picks, the D3 block is clear, `confirmed_gw` equals `current_event`, `ft` equals the snapshot's.
- `LIVE-STATE-purchase-prices-derive-from-the-snapshot-and-the-bank-delta-pins-the-one-transfer` — every player held since GW1 is priced at `now_cost − cost_change_start`; the single transfer's buy price is pinned by the bank delta to the tenth; and the reconciliation gap against the recorded `value` is **bounded by the fifteen's total price movement**, so a stale price is tolerated and a wrong one is not.
- `LIVE-LEDGER-every-row-names-a-played-gameweek-and-carries-that-gameweek's-own-points` — no row may name an unplayed gameweek, every `outcome` equals `history.current[].points`, every row says what was recommended and what was done.
- `LIVE-LEDGER-the-captain-and-xi-regrets-recompute-from-the-event-live-rows` — the eleven-level regrets are rebuilt from `gw[<n>]` with the best legal eleven and the captain doubled, and the captaincy regrets from the two players' realised points. A typed number cannot survive in the ledger.
- `LIVE-the-fallback-panel-quotes-the-written-fifteen's-own-recorded-cost` — E-088's pin.
- `qa/smoke_wk.cjs` "captain-and-vice-in-the-xi-of-the-written-wildcard-fifteen".

## 9. Honest limitations

- **The draft claims are the engine's own answer against a pool it cannot see.** `state/kwezi.json` `draft.league_id` is still `null`, so `draftWaivers` ranks replacements over the **whole** player list. The six outs are sourced — they are exactly the six players on the saved roster with no starts in the last three or a status that is not "a" — but the ins include Haaland and Isak, who in a seven-team H2H draft league are almost certainly owned. Every row is marked `pool: "assumed"` in the data and in the copy, the `why` of each says so in those words, and the Draft tab still carries the honest notice. This is worse than useless advice only if the label is ignored; it is the honest shape of an answer with the pool missing, and one number from him replaces it with the real pool. Three of the fifteen roster slots are also still unknown.
- **The wildcard is a model answer, not a forecast.** Fourteen of fifteen change. The deficit is driven by four flagged players and a bench worth 0.9 to 7.5 five-week xP, the two fixture models disagree on four of the fifteen, and C3's "equal-or-better under both" test does **not** pass — the goals model prefers its own answer. The plan says all of this in `classic.why`. 334 hours to the deadline over an international break is the right amount of time to re-read the flags before committing a chip.
- **Squad-level regret is an upper bound.** A recommended fifteen was never played, so it has no played eleven. The hindsight-optimal eleven is the only basis available and it flatters the recommendation. The `xi` rows isolate the part he controlled on the same basis so the two can be netted, and the ledger says which is which.
- **`src/ui.jsx` was not edited** and carries E-088: `money(978)` typed into the fallback panel, a September figure for a fifteen that no longer exists. The plan now records `wildcard15_cost_written` so the panel can read it; the one-line change belongs to whoever owns that file.
- **E-087 is open by choice.** The minutes gate is open and the app has not been promoted onto it. That is a deliberate deferral with its measurement written down, not an oversight.
- **The draft fixtures under `qa/fixtures/draft/` were captured on 11 September** and cannot contain players the game has added since. The suite now counts and names them instead of failing on them, which is correct but does mean three shifted ids are unexercised on the league path until the fixtures are recaptured.

## 10. The single next action

**Open the draft app, copy what is in the address bar, and paste it into Draft → Draft league.** It is the one input that turns the draft half from an honest guess into the real pool, the real claim order and this week's real opponent. Then re-read the flags on Semenyo, Brobbey, van Ewijk and João Pedro after the international-break pressers — there are 334 hours before the GW6 deadline and three of the four repairs are free either way.

---

## 11. The gate, verbatim

`bash qa/run.sh --release` on the shipped tree, 26 September 2026, 11:47–11:58 UTC — the last run in which every step of the gate belonged to this round's tree:

```
STEP 1  tdz_check (self-test + sources)     OK
STEP 2  esbuild syntax gate                 OK
STEP 3  build (build.cjs → app/ + dist/)    version v89, markers 6/6, order ok
STEP 4  tdz_check (freshly built app)       OK
STEP 5  privacy.cjs                         SUITE privacy 22/22 · 92 files · 12,651,348 bytes
STEP 6  verify.sh                           SUITE verify 33/33
STEP 7  data/validate_live.cjs              SUITE validate_live 86/86 · 693,032 bytes
STEP 8  unit_engine.cjs                     SUITE unit_engine 261/261
STEP 9  smoke.cjs                           SUITE smoke 60/60
STEP 10 smoke_wk.cjs                        SUITE smoke_wk 37/37
STEP 11 realistic.cjs                       SUITE realistic 8/8
STEP 12 components.cjs                      SUITE components 133/133
STEP 13 buttons.cjs                         SUITE buttons 101 · 0 · 0 · 0   (10/10)
STEP 14 webkit.js                           SUITE webkit 34/34
STEP 15 mc_full.cjs 25000                   950,012 assertions · 209/209 functions · 0
STEP 16 mc_all.cjs                          1,000,000 iters · 135 invariants · 0
MODE release · mc_full ran at 25000 iterations (a tag is cut only after a --release run)
                                            ALL PASS (16 steps)
```

**A second release run at 12:00–12:12 came back `RED: 1 of 20 steps`, and the red step is not this round's.** The repository was being worked on by other agents throughout: `qa/pull_guard.cjs` and `qa/no_frozen.cjs` were added to `qa/run.sh` at 11:37 and 11:59, and `qa/run.sh` itself was rewritten at 12:05 while that run was in flight — which is why the same run lists `buttons.cjs` and `webkit.js` twice, as steps 15/16 and 17/18. The failure is `pull_guard` 21/22, "and no feed is tracked — pipeline/feeds/bootstrap.json, pipeline/feeds/d_details.json, pipeline/feeds/d_game.json": a new suite asserting that a `pipeline/` directory's feeds are untracked, against a `pipeline/` that has just been added. Every step that covers this round was green in that run too:

```
verify 33/33 · validate_live 86/86 · unit_engine 261/261 · smoke 60/60 · smoke_wk 37/37
realistic 8/8 · components 133/133 · buttons 10/10 · webkit 34/34
mc_full 25000 iters · 950,012 assertions · 209/209 · 0
mc_all 1,000,000 iters · 135 invariants · 0
```

Re-verified at 12:14 after a rebuild, with two more checks having landed from elsewhere in the meantime: `validate_live 86/86 · unit_engine 263/263 · smoke_wk 37/37 · realistic 8/8`.

**One real defect was caught by the first attempt at that second run**, and it was not this round's either: `data/validate_live.cjs` threw `ReferenceError: Cannot access 'WANT_IDS' before initialization` — a league-count check had been added above the `const` it reads. It is a temporal dead zone in a file `qa/tdz_check.cjs` does not scan (it takes `src/engine.js`, `src/ui.jsx` and the assembled app, not the `.cjs` scripts under `data/` and `qa/`). The agent who wrote it fixed it nine minutes later and recorded it. The coverage gap it points at — node scripts are not TDZ-scanned — is worth closing and was not closed here.

---

## 12. Score — Part I rubric

**87 / 100** (v88: 91). The number went down, and it went down for reasons that are written here rather than absorbed. Two of them are defects this round found in shipped behaviour and did not fix, because the files that fix them belong to other work this round; one of them is a gate that opened and has not been acted on. A score that only moves upward is not a score.

| Dimension | Weight | v88 | v89 | Why |
|---|---|---|---|---|
| Correctness & sourcing | 30 | 28 | **26** | −4. The state of record is now the fifteen he owns, every purchase price derives from the snapshot, the one price that cannot be read is pinned by the bank delta and marked estimated with its working, and the ledger's counterfactuals are realised points rather than a model. Against that: `src/ui.jsx` prints £97.8m as a literal for a fifteen that no longer exists (E-088), and the draft claims' incoming side is ranked over the whole player list because the pool cannot be seen — labelled `assumed` everywhere, and still a recommendation that names players a seven-team league has almost certainly taken. |
| Model calibration | 20 | 16 | **15** | −5. Four transitions now, and `player_xg` leads on both metrics having won three of them — and cannot be promoted, because its trailing hold-out is one gameweek against two. That is arithmetic and GW6 settles it. The point lost since v88 is not that: it is that **the F4 minutes gate has opened and the app has not moved**, because `driving` is a literal rather than a read of the gate (E-087). A measurement that the behaviour does not follow is worse than one that is still short. |
| Decision quality | 15 | 14 | **13** | −2. The plan of record is the engine's own answer, its fallback costs no hit, and the convergence conflict is priced in both directions rather than resolved silently. But C3's "equal-or-better under both fixture models" does **not** pass on the fifteen that is being recommended, fourteen of fifteen change, and the Transfers panel prints "at most 3 transfers this week" under a header reading "FT 4" (E-090) — the cap is the protocol's, not the week's, and the copy does not say so. |
| Sleekness | 15 | 15 | **15** | Every Part G gate measured green again in Chromium (smoke 60/60) and WebKit (34/34): landing under 110 words, every tab under 500, the 11px type floor, all seven touch floors, 21 tokens, zero hex, no horizontal scroll at 360px. The Safari screenshots also stopped counting down to a deadline that had passed. |
| Test coverage | 15 | 13 | **13** | Seven checks added that test behaviour rather than restate it, four mutations run and named, every frozen clock and frozen observation in four suites replaced by a derivation. Against that: a temporal dead zone shipped in `data/validate_live.cjs` today and no gate step scans the `.cjs` scripts under `data/` and `qa/` for one; and the recorded draft fixtures are dated 11 September, so three shifted ids go unexercised on the league path. |
| Honesty | 5 | 5 | **5** | Three entries opened rather than closed quietly (E-087, E-088, E-090), each with the exact one-line fix and who owns it. The ledger's most valuable row is the one where the manager's own call beat the app by two points, and it is in the table at the same size as the rows that flatter it. One check written this round could not fail and was caught by mutating it. |

**What stands between 87 and 100, in the order it closes:**

1. **Two lines of code someone else owns.** `money(978)` → the recorded cost (E-088); the transfer-cap sentence (E-090). Both are written out verbatim in the ledger.
2. **One decision.** Promote P(start) onto the minutes logistic or record why a Brier gate is not enough (E-087). It changes every recommendation, so it gets its own round and its own before-and-after.
3. **One gameweek.** GW6 scores the fifth transition and settles whether `player_xg` drives the xP model.
4. **One number from him.** The draft league id turns the claim list from an honest guess into the real pool.

Three of those four are not waiting on cleverness. That is the honest shape of the gap.

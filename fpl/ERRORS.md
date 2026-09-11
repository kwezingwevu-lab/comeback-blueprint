# ERRORS.md — FPL Mission Control error ledger

Purpose: the second law (CLAUDE.md A2) is "never the same error twice". This file is read at the start of every session and appended at every fix. It is the project's memory of what went wrong, how it was caught, the rule that now prevents it and the test that proves the rule.

Fixed shape, one entry per error:

```
### E-NNN · vNN · symptom
CAUSE: what was actually wrong
CAUGHT: how it was found (suite, review, MC, user)
RULE: the rule that now prevents it
TEST: the assertion that proves the rule (suite and check)
```

Append-only. Never edit or delete an earlier entry; a correction is a new entry. A recurrence is a new entry referencing the old one (for example "recurrence of E-010"), and the RULE is strengthened until it cannot recur. Entries E-001 to E-025 are the seed from CLAUDE.md Part L, expanded into the shape above with the wording carried over as written; where Part L recorded no CAUGHT value the line says so rather than guessing. E-012 is still open.

---

### E-001 · v63 · refresh "unexpected error" on first click
CAUSE: `max_tokens:1000` with web search; response truncated before the JSON
CAUGHT: by realistic.cjs after weeks of misdiagnosis
RULE: 4000 tokens with tools; name `max_tokens` stops
TEST: realistic #2

### E-002 · v82 · sections flicker/reset on every state change
CAUSE: components defined inside `App`
CAUGHT: by a failing edge-panel test
RULE: module-level components, props not closures
TEST: smoke "sections open, close, persist"

### E-003 · v76 · 40 players rendered from a corrupt store
CAUSE: `sanitiseState` never capped/deduped
CAUGHT: by mc_full fuzz
RULE: cap 15, dedupe on id
TEST: mc_full sanitise group

### E-004 · v58 · transfers recommended at FT=0
CAUSE: optimiser ignored FT budget
CAUGHT: by mc_all
RULE: FT gate
TEST: mc_all #12

### E-005 · v58 · illegal 4th player from one club
CAUSE: paired path skipped club cap
CAUGHT: mc_all
RULE: legal15 on every candidate
TEST: mc_all #3

### E-006 · v58 · zero-minute player over a fit one
CAUSE: tie on zero score
CAUGHT: mc_all
RULE: starts tiebreak
TEST: mc_all #19

### E-007 · v65 · third buy 5p over budget
CAUSE: bank from display-rounded `bankAfter`
CAUGHT: mc_all
RULE: raw prices only
TEST: mc_all #22

### E-008 · v65 · "margin 0.00 LOW" from the same pair swapped
CAUSE: degenerate tie
CAUGHT: mc_all
RULE: margin vs genuinely different
TEST: mc_all #24

### E-009 · v67 · three Hull defenders proposed
CAUSE: no correlation guard
CAUGHT: review
RULE: ≤2 incoming per club
TEST: mc_all #27

### E-010 · v66 · Konsa sold the week he started
CAUSE: raw gain overrode the rule
CAUGHT: review
RULE: never sell a returning starter
TEST: smoke_wk sells

### E-011 · v74 · Hull rated best defence
CAUSE: strength on goals not xG
CAUGHT: captaincy inverted
RULE: xG drives, goals explain
TEST: smoke_wk TS sane

### E-012 · open · Konsa/N.Jackson moves missed
CAUSE: name-keyed matching
CAUGHT: GW review
RULE: key on element id; BLOCK on mismatch
TEST: pending (F1)

### E-013 · v78 · TDZ checker false positives
CAUSE: comment-blind scan
CAUGHT: not recorded in Part L
RULE: comment/string-aware
TEST: tdz self-check

### E-014 · v77 · false failures for a session
CAUSE: stale suites after workspace reset
CAUGHT: not recorded in Part L
RULE: suites live in outputs and repo
TEST: verify invariant 9

### E-015 · v65 · `PLAYBOOK` deleted
CAUSE: regex end-anchor was the next `const`
CAUGHT: not recorded in Part L
RULE: START/END markers
TEST: verify invariant

### E-016 · v86 · closing tag and sentence swallowed
CAUSE: replacement spanned a block
CAUGHT: esbuild + div-depth trace
RULE: count==1 and diff review
TEST: esbuild gate

### E-017 · v83 · smoke cascade
CAUSE: loop threw without navigating back
CAUGHT: not recorded in Part L
RULE: `finally` to Command
TEST: smoke structure

### E-018 · v84 · "refresh bar did not clear"
CAUSE: mocked a 500 (retried)
CAUGHT: not recorded in Part L
RULE: mock 400 for clears
TEST: realistic #8

### E-019 · v73 · captaincy on FDR (GW2 −8)
CAUSE: fixture over quality
CAUGHT: not recorded in Part L
RULE: xG EV captaincy
TEST: smoke_wk captain

### E-020 · v70 · "99% to win"
CAUSE: 5-GW compounding
CAUGHT: not recorded in Part L
RULE: direction only <8 GWs
TEST: mc_all variance cap

### E-021 · v68 · Bruno recommended
CAUSE: convergence ignored
CAUGHT: MC against rivals
RULE: ≥60% excluded
TEST: smoke_wk convergence

### E-022 · v64 · simple mode opened on a pre-season checklist
CAUSE: wrong card
CAUGHT: not recorded in Part L
RULE: both modes share `GwActionCard`
TEST: smoke #1

### E-023 · v75 · 151 elements at 9px
CAUSE: no type floor
CAUGHT: not recorded in Part L
RULE: 11px floor
TEST: smoke type floor

### E-024 · v85 · 21px buttons
CAUSE: no touch floor
CAUGHT: not recorded in Part L
RULE: floors per class
TEST: smoke touch

### E-025 · v84 · 86 colour literals
CAUSE: no tokens
CAUGHT: not recorded in Part L
RULE: 21 tokens, 0 hex
TEST: smoke tokens

### E-026 · v87 · draft roster keyed by classic id
CAUSE: draft element ids differ from classic ids for 59 of 655 players (checked 11 Sep 2026 against draft bootstrap-static)
CAUGHT: rebuild recon before code
RULE: join draft↔classic on code, never id or name
TEST: unit_engine "E026-synthetic-draft-ids-differ-and-the-code-join-is-the-truth", "E026-live-59-draft-ids-differ-from-their-classic-ids", "E026-joining-by-code-resolves-the-same-player-joining-by-id-does-not" (the maps) and "E026-draftEl-joins-on-code-so-both-halves-are-the-same-footballer", "E026-draftWaivers-claims-are-named-and-priced-off-the-code-join", "E026-watchlistAudit-resolves-shifted-codes-and-applies-the-three-start-rule", "E026-draftXI-picks-a-legal-eleven-from-a-roster-of-codes", "E026-draftEl-resolves-every-shifted-code-to-one-player-while-the-id-join-lands-on-another", "E026-watchlistAudit-and-draftXI-and-draftWaivers-all-resolve-the-shifted-codes" (the consumers — see E-048); smoke_wk "draft-claims-join-on-code-not-id"

### E-027 · v87 · Playwright 1.63 looks for Chromium build 1243; the sandbox has 1194
CAUSE: version drift between the pinned playwright and the preinstalled browser
CAUGHT: harness launch failure during recon
RULE: launch with executablePath /opt/pw-browsers/chromium, never run playwright install
TEST: smoke "E027-harness-launched-a-real-chromium-and-says-which-build" (asserts the browser is connected and prints the build and which install it came from, before any UI claim is made)

Note (E-027, contract edit, 11 Sep 2026): the CI runner has no `/opt/pw-browsers`. `.github/workflows/gate.yml` runs `npx playwright install --with-deps chromium` before the browser suites, and CONTRACT.md §8 now carries one added sentence requiring `qa/harness.cjs` `launch()` to fall back to Playwright's default Chromium when `/opt/pw-browsers/chromium` does not exist. The sandbox rule above is unchanged: never run `playwright install` in the sandbox.

### E-028 · v87 · transfer panels stayed open while GW4 was being played
CAUSE: `inLiveWindow()` in `src/ui.jsx` keyed the live window on the snapshot's `current_event`. A snapshot pulled on the Friday still says `current_event: 3` all through Saturday, so with `now` between the GW4 deadline (2026-09-12T12:30Z) and the last GW4 kick-off the app measured GW3's window, found it long past, and kept showing "Play Wildcard 1", the transfer list, the wildcard fifteen and the fallback moves — the one thing CLAUDE.md C6 and CONTRACT §7 forbid on a match day.
CAUGHT: qa/smoke.cjs LIVE-window checks, written against CONTRACT §7 (the engine's own `gamePhase()` had it right all along; only the UI helper was wrong)
RULE: the live window comes from the clock — the last event whose deadline has passed, with at least one of its fixtures unfinished — never from `current_event`; `plan.kind === "live"` hides every panel that instructs a transfer (`plan-tx`, `plan-wc`, `plan-fb`)
TEST: smoke "LIVE-window-landing-shows-live-points-and-no-transfer-instruction", "LIVE-window-hides-every-transfer-panel", "LIVE-window-is-keyed-on-the-clock-not-on-the-snapshot-current_event"

### E-029 · v87 · a reload test that could never pass
CAUSE: `qa/harness.cjs` `open()` installs its storage seed with `page.addInitScript`, which re-runs on every navigation. A suite that seeded `mode` and then reloaded had `mc_ui` rewritten to `{mode}` alone before the app booted, so the saved tab was always lost and the persistence gate read as a UI defect that was not there. `addInitScript` also accumulates across `open()` calls on one page, and `localStorage` is shared inside a BrowserContext.
CAUGHT: qa/smoke.cjs persistence check failing against a UI that passed the same steps by hand
RULE: a reload test seeds nothing — it drives the real controls and lets the app write its own `mc_ui`; every scenario gets its own `BrowserContext`, never a reused page
TEST: smoke "E002-E022-saved-tab-and-open-sections-survive-a-reload", "reveals-survive-a-reload"

### E-030 · v87 · nineteen engine helpers threw on junk input although the file promises totality
CAUSE: `src/engine.js` opens with "every function is total — bad input yields a safe empty result — except parseJson and applyRefresh". Nineteen helpers did not honour it: `uniq`, `sum` (both the list and the callback), `quantile`, `combos`, `posCounts`, `openClosers`, `salvageJson`, `poisson`, `binomial`, `posRates`, `playerRates`, `likelyXI`, `fixtureDraws`, `entryPoints`, `squadOrder`, `wcPool`, `wcSolve`, `ranksOf` and `pickXI` read `.forEach`, `.length`, `ctx.els` or a callback straight off the argument. A corrupt `mc_state` restored from storage reaches `sanitiseState` and then these helpers; the same class of gap produced E-003.
CAUGHT: qa/mc_full.cjs property group P01, first run — 48 of 155 top-level functions threw on the 20 junk kinds
RULE: a guard clause is part of the signature: list arguments go through `arr()`, element tables through `elMap()`, contexts through `okCtx()`, callbacks through `typeof x === "function"`, and an rng that is not a function returns the zero draw
TEST: mc_full P01 (nothing throws) over every extracted top-level function

### E-031 · v87 · "undefined", "NaN" and "[object Object]" rendered into user-visible strings
CAUSE: `errMsg` fell through to `String(e)` for a non-Error throw, `refreshRequest` interpolated a missing pair as `unknown pair 'undefined'`, `nameOf`/`codeName` built `"id undefined"` and `"code NaN"`, and `Section`/`Reveal` built `data-testid="sec-undefined"`. Every one of those reaches the screen — the refresh error line is shown verbatim by contract (§7, first 140 characters).
CAUGHT: qa/mc_full.cjs property group P07
RULE: no string the app can render is ever built by concatenating an unchecked value; the fallback names what is missing in words
TEST: mc_full P07 (no returned string contains undefined / NaN / [object Object])

### E-032 · v87 · formationOf invented a shape out of players it could not resolve
CAUSE: `formationOf(ids, els)` counted unresolved ids into `posCounts().unknown` and still returned `c[2] + "-" + c[3] + "-" + c[4]`, so eleven ids against an empty element table produced "0-0-0" — a formation that does not exist, and one the eleven-player gate would have rejected.
CAUGHT: qa/mc_full.cjs property group P17
RULE: "" is the documented answer for anything that is not a readable eleven with exactly one goalkeeper
TEST: mc_full P17, mc_all I14/I15

### E-033 · v87 · the alternatives panel could show the shipped transfer plan back to the manager
CAUSE: `transferProtocol` measured the margin against the first plan whose `ins`/`outs` arrays differed *in order* (`p.ins.join(",") !== best.ins.join(",")`). Two swaps paired the other way round — out A→in X, out B→in Y versus out A→in Y, out B→in X — are the same plan, so it could be counted as the runner-up (margin 0.00) and `alternatives` (a raw `plans.slice(1,4)`) could list it a second time. This is the display half of E-008, which the RULE had only closed for the margin.
CAUGHT: qa/mc_all.cjs invariant I64 over randomly generated universes (the fixed synthetic squad in unit_engine never produced the collision)
RULE: "genuinely different" is the sorted SET of ids out and the sorted SET of ids in; the margin and the alternatives list both use that one key
TEST: mc_all I64, unit_engine "TP-margin-is-measured-against-a-genuinely-different-plan-E008"

### E-034 · v87 · two draft claims could share one React key
CAUSE: `checkClaims` in `src/ui.jsx` built each row's key as `String(c.out) + "-" + String(c.in)`. A malformed claim (no codes) gives every such row the key `"undefined-undefined"`, so React reconciles two different claims onto one row — and the same two values were printed to the screen as `"code undefined"`.
CAUGHT: qa/mc_full.cjs property group P07
RULE: a list key is the row's own position in the written order, never a concatenation of values that may be missing; names on screen go through `codeName`/`nameOf`, which say "unknown player" when they cannot resolve one
TEST: mc_full P07

### E-035 · v87 · an unbounded loop in the Monte Carlo sampler
CAUSE: `binomial(n, p, rng)` in `src/engine.js` took its trial count straight off the argument (`n = Math.max(0, intOf(n, 0))`) and then looped `n` times. A corrupt or absurd count — `1e308`, `Infinity`, `Number.MAX_SAFE_INTEGER` — is not a wrong answer, it is a hang: the app stops responding with no error and no way back. `poisson` was already bounded at 60 draws; `wcSolve`'s `maxPasses` had the same open shape.
CAUGHT: qa/mc_full.cjs — the 25 000-iteration release run stopped producing output. The fuzz suite cannot time out a synchronous loop from inside the same thread, so an unbounded loop shows up as a suite that never finishes, not as a P04 failure. That is the signal.
RULE: every loop bound that comes from an argument is clamped at the top of the function — `BINOMIAL_MAX_N` 5000 for Bernoulli trials, 60 passes for the wildcard local search, the existing 20 000 for `mcSquad`/`mcLeague`
TEST: mc_all I109 (binomial and poisson terminate on an absurd count), mc_full P04

### E-036 · v87 · clamp returned NaN
CAUSE: `clamp(v, lo, hi)` coerced only `v` (`v = num(v, lo)`) and compared it against `lo`/`hi` as given. A non-finite bound made every comparison false and the "clamped" value came back as NaN — from the one helper the engine uses to guarantee a range (`clamp(p, 0, 1)` for probabilities, `clamp(intOf(iters, 1000), 1, 20000)` for the Monte Carlo iteration cap).
CAUGHT: qa/mc_full.cjs property group P05, only at the 25 000-iteration release count — the 3 000-iteration dev count never drew the (junk value, NaN low bound) pair. The release count earns its place.
RULE: clamp coerces all three arguments, orders the pair, and always returns a number inside a real range
TEST: mc_full P05 at 25 000 iterations

### E-037 · v87 · a hold week handed the manager an empty list of steps
CAUSE: `transferProtocol` built `res.order` inside the shipping branch only. The no-plan branch (no swap clears the sell rule, or a forced sell has no legal replacement) returned before the captain and vice steps were appended, so `order` came back `[]` on every path that did not ship a transfer — the exact weeks when the only thing left to do IS set the captain. Probed against Kwezi's own state with the candidate pool restricted to his fifteen: order was `[]`.
CAUGHT: adversarial read of C2 step 5 against the code, then reproduced with a pool-restricted context
RULE: `order` is built on one code path — `var newSquad = squad;` is hoisted, the plan branch is an `else`, and the captain and vice steps are appended last on every path that reaches an eleven, hold included
TEST: unit_engine "TP-the-hold-path-still-lists-the-captain-and-the-vice-as-steps", "TP-the-shipping-path-ends-its-order-with-the-captain-then-the-vice"; mc_all I112

### E-038 · v87 · the wildcard search stopped before it had finished improving
CAUSE: `wcSolve`'s 1-swap pass looked only at the top-30 slice of each position pool and stopped after a fixed twelve improvements, so the fifteen it returned was not a local optimum even under its own rules — and nothing in the suite asked whether it was. There was also no shared definition of the pool, the feasibility test and the budget: the solver had one and any audit of it would have had to write another.
CAUGHT: adversarial review of C3 against the code; then by the new acceptance test, which found improving swaps in the answer the old search returned
RULE: the 1-swap pass runs to a fixed point over the WHOLE eligible pool; `wcCost`/`wcSetup`/`wcFeasible` are extracted so the search and its audit share one pool, one feasibility and one budget; a spend-the-bank pair step sells one player down to fund a dearer upgrade elsewhere
TEST: unit_engine "WC-the-returned-fifteen-is-a-one-swap-local-optimum", "WC-the-local-optimum-test-fails-on-a-deliberately-worsened-fifteen" (the negative control), "LIVE-wildcardSolver-returns-a-one-swap-local-optimum-over-the-whole-pool"; mc_all I117, I110

### E-039 · v87 · the app's wildcard fifteen and the written plan disagreed with nothing priced
CAUSE: rule C1.6 keeps any player at ≥0.60 rival ownership out of the solver. Four of the manager's own written fifteen (Raya 60%, Calafiori 82%, Haaland 86%, João Pedro 100%) are above that line, so the landing card's solved fifteen and the plan in `data/weekly.js` were different squads — and the app showed one of them without ever saying what the other was worth. A manager cannot choose between a rule and his own plan when only one of them carries a number.
CAUGHT: review of the landing card against data/weekly.js during the fix round
RULE: the conflict is surfaced priced, never resolved silently — `wildcardOptions(ctx, opts)` scores the rule-pure solve, the same solve with the written fifteen's convergent players locked in, and the written fifteen itself under one objective and one legality test; the locks are derived as written15 ∩ convergenceRisk, never hard-coded; the solver default and rule C1.6 are unchanged
TEST: unit_engine "WC-wildcardOptions-leaves-the-solver-default-exactly-where-it-was", "WC-wildcardOptions-locks-only-what-the-written-plan-and-the-ownership-data-both-say", "LIVE-wildcardOptions-prices-all-three-fifteens", "LIVE-wildcardOptions-derives-its-locks-from-the-written-plan-and-the-ownership-data", "LIVE-wildcardOptions-does-not-move-the-default-solver-answer-or-rule-C1.6"; mc_all I111

### E-040 · v87 · an API error arriving with a 200 status was read as an empty reply
CAUSE: the Anthropic API can answer 200 with an error-shaped body (`{type:"error", error:{message}}`). The refresh path checked the status first, found it fine, then looked for text blocks, found none, and told the manager "no text in the reply" — hiding the real message ("Your credit balance is too low…"), which is the one thing D4 says must reach the screen.
CAUGHT: suggested by the suite review, then written as realistic.cjs check 7
RULE: the error shape is inspected before the content blocks, whatever the status code; the first 140 characters of the API's own message are what the manager sees
TEST: realistic "error-object-surfaces-its-real-message"

### E-041 · v87 · waiver claims were ordered by roster position, not by what they are worth
CAUSE: `draftWaivers` put the forced replacements first (correct, C5) but left each group in the order the roster happened to be in. A waiver list is submitted in priority order and every claim is contested, so the biggest gain has to be at the top of its group or the rivals take it.
CAUGHT: suggested by the suite review, then written as a smoke_wk check
RULE: forced replacements first, then upgrades; within each group, descending `EV_in − EV_out`; `priority` is the position in that final order
TEST: smoke_wk "draft-claims-forced-replacements-first"; unit_engine "E026-draftWaivers-claims-are-named-and-priced-off-the-code-join"

### E-042 · v87 · the two wildcard-timing horizons were a gameweek out of step
CAUSE: `wildcardTiming` computed the GW19 window as `19 - nextEvent` and the GW38 window as `38 - nextEvent + 1`, so one headline excluded its end gameweek and the other included it. The two numbers the manager compares were measured on different rulers.
CAUGHT: adversarial read of C4 against the code
RULE: both horizons include their end gameweek — `Math.max(0, end - nextEvent + 1)` — and when two horizons return the same total the result says why, through `saturated {saturates, weeks, gw, note}`: after that gameweek the free transfers have made every swap and the deficit stops growing
TEST: unit_engine "TIMING-both-headline-horizons-include-their-own-end-gameweek", "TIMING-two-equal-horizons-are-explained-by-saturation-not-left-as-a-coincidence", "LIVE-timing-horizons-both-include-their-end-gameweek-and-saturation-is-named"

### E-043 · v87 · fxMult answered 1 whether it had computed one or given up
CAUSE: `fxMult(fixture, teamId, TS)` takes a fixture OBJECT (CLAUDE.md H2 names this trap). Handed a fixture id it has nothing to look up and returns the neutral 1 — indistinguishable from a genuine multiplier of 1 — so every xp1/xp5 built on it falls back to the shrunk baseline with no sign that anything went wrong.
CAUGHT: adversarial review of the H2 signature traps
RULE: `fxMult` keeps the neutral answer (`teamMults` sums over real fixtures and depends on it), and `fxMultInfo(fixture, teamId, TS)` → `{mult, resolved, reason}` says whether the 1 was computed or is the unresolved default; callers and suites read `resolved`, and the reason names the argument kind instead of printing "undefined"
TEST: unit_engine "XP-fxMult-answers-from-a-fixture-object-and-not-from-a-fixture-id", "XP-fxMultInfo-marks-the-neutral-answer-as-unresolved"; mc_all I116

### E-044 · v87 · the fence strip ate text inside the JSON it was cleaning
CAUSE: `parseJson` removed code fences with a global `/```/g` replace, which also ran inside string VALUES. A player news line containing a backtick run came back with the run silently deleted — the parser corrupting the data it was there to read.
CAUGHT: adversarial review of D4 step 4
RULE: `stripFences(text)` removes a leading fence line and a trailing fence line and touches nothing in between; `parseJson` uses it
TEST: unit_engine "REFRESH-parseJson-strips-code-fences", "REFRESH-parseJson-keeps-a-code-fence-that-sits-inside-a-string-value", "REFRESH-stripFences-only-touches-the-opening-and-the-closing-fence"

### E-045 · v87 · ftAvailable gave two different answers for the same history
CAUSE: `ftAvailable` accepts the history object or its rows array, but read the chips list off the object only. A wildcard or free-hit week does not spend a free transfer; given the rows array the function could not see the chip and counted the week as a spend, so the object form and the array form disagreed on the same data.
CAUGHT: adversarial review of B2 against the code, then over 200 generated histories
RULE: chips come from the history object, from the new third argument, or are inferred from a gameweek whose free-transfer count exceeds the cap of five (only a wildcard or free hit can produce that); the two accepted shapes must agree
TEST: unit_engine "FT-the-object-and-the-rows-array-agree-on-a-chip-week", "FT-the-two-shapes-agree-over-two-hundred-generated-histories"; mc_all I113

### E-046 · v87 · one Monte Carlo draw reported with the full shape of a distribution
CAUSE: `mcSquad(..., iters, ...)` clamped its iteration count from below at 1. An `iters` of 0 or a negative came back as a single draw wearing the field names of a converged run — sd 0, q10 = q50 = q90 — which reads on screen as certainty.
CAUGHT: qa/mc_full fuzz over the iteration argument
RULE: the iteration count is floored at the documented constant `MC_MIN_ITERS` (100); one draw is never presented as a distribution
TEST: unit_engine "MC-squad-never-presents-a-single-draw-as-a-distribution"; mc_all I114

### E-047 · v87 · the tournament compared MAEs measured in different units
CAUSE: the eight walk-forward models predict on their own scales — BPS-rate predicts in the hundreds, per-90 in fractions — and the MAE was taken against points without rescaling. The BPS model's MAE was an order of magnitude above the rest for a reason that has nothing to do with accuracy, so the table invited the wrong conclusion (E5 promotion reads the tournament).
CAUGHT: adversarial review of E5 against the printed table (bps_rate raw MAE 11.23 against a field of 2.3–4.1)
RULE: every predictor is rescaled by mean(points)/mean(prediction) over its own source gameweek (guarded on a zero or non-positive mean) before the MAE is taken; the result carries `maeUnits:"points"`, `maeRaw` and `maeScale` so the rescaling is visible; Spearman is untouched
TEST: unit_engine "TOURNAMENT-calibrateToPoints-puts-a-ten-times-predictor-back-into-points", "TOURNAMENT-calibrateToPoints-refuses-to-scale-a-zero-mean-predictor", "TOURNAMENT-the-reported-MAEs-are-inside-one-order-of-magnitude-of-each-other", "LIVE-the-BPS-rate-model-is-the-one-the-rescaling-moves"; mc_all I115

### E-048 · v87 · the E-026 regression guard did not guard a single consumer
CAUSE: the checks written for E-026 asserted on the MAP only (`ctx.draft.byCode` against `ctx.draft.els`). `draftEl(code, ctx)` — the one function `draftWaivers`, `watchlistAudit` and `draftXI` all go through — had no assertion at all. An adversarial verifier copied the repo to a scratch directory, changed `draftEl`'s join from `ctx.byCode[c] / ctx.draft.byCode[c]` to `ctx.els[c] / ctx.draft.els[c]`, and `node qa/unit_engine.cjs` still printed 158/158 and exited 0, with every draft recommendation in the app silently empty.
CAUGHT: adversarial verification of the suite itself (mutate the source, re-run, see whether anything goes red)
RULE: a regression guard names the CONSUMER, not the data structure — the id join must change the ANSWER a suite reads, through `draftEl` and through each of the three functions built on it, on codes whose draft id belongs to a different player
TEST: unit_engine "E026-draftEl-joins-on-code-so-both-halves-are-the-same-footballer", "E026-draftWaivers-claims-are-named-and-priced-off-the-code-join", "E026-watchlistAudit-resolves-shifted-codes-and-applies-the-three-start-rule", "E026-draftXI-picks-a-legal-eleven-from-a-roster-of-codes", "E026-draftEl-resolves-every-shifted-code-to-one-player-while-the-id-join-lands-on-another", "E026-watchlistAudit-and-draftXI-and-draftWaivers-all-resolve-the-shifted-codes"; the mutation above now turns six checks red (195/201) while the two map checks stay green

### E-049 · v87 · twelve required engine functions had no direct assertion anywhere
CAUSE: `grep -c "E\.<name>\b" qa/unit_engine.cjs` returned 0 for `fxMult`, `xp1`, `xp5`, `teamStrength`, `tsXg`, `sellCandidates`, `chipWindows`, `chipRegret`, `wildcardTiming`, `draftWaivers`, `watchlistAudit` and `draftXI` — every one a CONTRACT §5 required name, two of them (`fxMult`, `chipRegret`) the exact signature traps CLAUDE.md H2 warns about. They were exercised only indirectly, through callers that would have gone on producing a plausible number if the formula underneath had changed.
CAUGHT: adversarial verification of the suite itself
RULE: every CONTRACT §5 required name carries at least one direct assertion that fails when its contract is broken — a formula reconciled independently, a rule with a control that goes the other way, or a named error instead of a score
TEST: unit_engine "XP-xp5-is-shrunkPps-times-P(start)-times-the-decayed-fixture-run-for-every-element", "XP-xp1-is-the-next-fixture-only-and-is-zero-on-a-blank-gameweek", "TS-teamStrength-shrinks-att-and-def-towards-1-with-K-6-on-the-snapshot-xG", "TS-tsXg-is-Lbar-times-att-times-def-times-the-home-or-away-factor", "SELL-candidates-name-the-dead-and-the-unavailable-and-nobody-else", "SELL-E010-a-returning-starter-is-listed-as-protected-never-as-a-forced-sell", "CHIPS-no-double-and-no-blank-is-reported-as-nothing-scheduled-not-as-a-recommendation", "CHIPS-a-real-double-and-a-real-blank-are-found-in-the-right-gameweeks", "CHIPS-chipRegret-prices-a-double-at-twice-the-single-week-and-says-hold", "CHIPS-chipRegret-names-an-unknown-chip-instead-of-scoring-it", plus the E-026 draft checks and the existing fxMult and timing checks

### E-050 · v87 · four checks whose assertion could not fail for the reason their name gave
CAUSE: "MC-simPlayer-may-be-negative-and-that-is-correct" asserted only `isFinite(min)` — true of a sampler clamped at zero. "TP-margin-is-measured-against-a-genuinely-different-plan-E008" asserted `margin >= 0`, which is true by construction. "XI-never-starts-a-sub-0.5-player-ahead-of-a-0.75-one" swept a fifteen in which no player starts below 0.5, so the loop body never ran. "TP-an-optional-sell-needs-a-five-week-gain-above-4" filtered a list of optional moves that was empty, because the fixture's plan is driven by a forced sell.
CAUGHT: adversarial verification of the suite itself
RULE: a check whose name makes a claim has to contain a fixture in which that claim can be false — the negative must be reachable, the identity must be recomputed independently, the rule must be put in conflict with the score, and the opportunity the rule declines must exist in the universe
TEST: the same four checks, rewritten; each was then mutated into failure and back — simPlayer clamped at 0, `res.margin = best.value`, pickXI's non-violating preference removed, `SELL_GAIN_MIN` dropped to 0 — and each turned red on its own (200/201) and green again on revert

### E-051 · v87 · the TDZ gate reported a clean pass on a file whose exported function throws
CAUSE: `qa/tdz_check.cjs` reported "TDZ CLEAN … evaluated with const/let semantics intact" for `function boot(){ const read = function(){ return CONF.k; }; const v = read(); const CONF = { k: 1 }; return v; }` although calling `boot()` throws a real ReferenceError. The dynamic pass evaluated the module top level and never called a function; the static scan skips references inside nested function bodies on purpose (the E-013 leniency). Neither covered the case, and the wording claimed more than either had done.
CAUGHT: adversarial verification of the gate itself, with a control file
RULE: the gate runs three passes and its output names all three — same-scope static, nested-body static (a function expression bound to a const/let that is called by name in the same scope before the declaration it reads), and a dynamic pass that calls every exported function once with no arguments. A parameter of the same name shadows the outer binding and is never a finding (E-013 leniency kept, now pinned). The checker carries a `--self-test` of six control files, three that must be found and three that must stay clean, and `qa/run.sh` runs it before the sources.
TEST: `node qa/tdz_check.cjs --self-test` (TDZ SELF-TEST 6/6, run as part of the tdz step in qa/run.sh); the control file above is now reported by both the nested-body scan and the dynamic pass, exit 1

### E-052 · v87 · two silent-pass paths in the shared browser harness
CAUSE: `open()` caught and discarded the `.mc-root` `waitForSelector` timeout, so a page that never mounted was handed to the suite as if it had opened and every later assertion measured an empty document. `done(suite)` exited 0 whenever `fail === 0`, including a total of 0 — a suite that threw before its first assert printed a green SUITE line.
CAUGHT: adversarial verification of the harness itself
RULE: `open()` throws, naming the timeout and what the page actually contained, unless the caller passes `allowNoMount:true` and reads `page.mcMounted` itself; `done()` treats a total of 0 as a failure and says so
TEST: reproduced directly — `H.done("suite_that_asserted_nothing")` now prints "FAIL … 0/0 is not a pass" and exits 1, and `H.open` on a page with no `.mc-root` throws "harness: the app never mounted — .mc-root did not appear within 1500ms (#root present, 0 children; body empty)"

### E-053 · v87 · the TDZ step scanned the previous build's assembled file
CAUSE: `qa/run.sh` ran `tdz_check` on `src/engine.js`, `src/ui.jsx` AND `app/FPL_Mission_Control.jsx` as step 1 — before `build.cjs` had run. The verdict on the assembled file was a verdict on the artefact from the last run, which is the one file every browser suite then loads.
CAUGHT: reading the gate's own order during the fix round
RULE: the sources are scanned before the build, the assembled app is scanned immediately after it; the gate is 12 steps, not 11
TEST: qa/run.sh step 1 "tdz_check (self-test + sources)" and step 4 "tdz_check (freshly built app)"

### E-054 · v87 · the written tournament leader and the walk-forward disagreed
CAUSE: CLAUDE.md Part M and `data/weekly.js` both record `leader: "bps_rate"` from v86. Recomputed on the 11 Sep snapshot the walk-forward puts `component_xp` first on Spearman — the model E6 lists as failed three times. Neither number may drive anything (the promotion gate is three transitions and there are two), but a written leader that is quoted as current is a claim the data does not support.
CAUGHT: reading the live tournament print-out against Part M during the fix round
RULE: the written plan's tournament block is a note about what was true when it was written, never an input; the app reports the leader it computed from the snapshot, with the transition count and the promotion gate beside it, and nothing is promoted below three transitions
TEST: unit_engine "LIVE-the-tournament-leader-is-computed-from-the-snapshot-not-read-from-the-written-plan", "LIVE-tournament-has-eight-models-and-is-not-promotable-yet", "TOURNAMENT-promotion-needs-three-transitions"

### E-055 · v87 · quantile returned the string "[object Object]NaN" (recurrence of E-031)
CAUSE: `quantile(sorted, q)` coerced its `q` argument but read the two interpolation endpoints straight off the array — `sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)`. Given a list of anything but numbers the `+` is string concatenation, so the helper that produces `mcSquad`'s q10/q50/q90 returned a STRING. Those three numbers are rendered, which is the same class of defect as E-031 ("no string the app can render is ever built by concatenating an unchecked value") in a helper E-030 had already guarded at the top but not in the body.
CAUGHT: qa/mc_full.cjs property group P07, 3000-iteration gate run on 11 Sep 2026 — "quantile — 40-element array|function → return = \"[object Object]NaN\""
RULE: a guard clause covers the VALUES a function reads, not only the arguments it is handed: every element quantile interpolates goes through `num(…, 0)`; the arithmetic for real numbers (including the numeric strings the API sends) is unchanged
TEST: unit_engine "MC-quantile-always-returns-a-number-never-a-concatenated-string-E055"; mc_full P07

### E-056 · v87 · the countdown printed half a sentence once the deadline passed
CAUSE: `hoursText()` in `src/ui.jsx` returned the bare word "closed" and every call site appended its own suffix, so after a deadline the header read "closed to deadline", the landing read "closed left, nobody flagged." and the draft waivers row did the same. A snapshot age could render the same way.
CAUGHT: the UI verifier, rendering at a mocked `2026-09-12T13:00:00Z`
RULE: a helper returns a magnitude; the complete phrase belongs to the call site, and no rendered sentence is built by appending a suffix to a word that might already be the whole answer
TEST: smoke "no-half-sentence-copy-once-the-deadline-has-passed", "the-header-says-the-deadline-is-closed-in-a-whole-phrase", "the-landing-deadline-panel-reads-as-a-sentence-after-the-deadline"

### E-057 · v87 · eight elements carried data-tab and one of them was not a tab
CAUSE: the root element carried `data-tab` alongside the seven tab buttons, so "command" appeared twice and any selector counting tabs counted eight.
CAUGHT: the test agent, measuring the rendered page end to end through the harness
RULE: `data-tab` marks a tab button and nothing else; the root carries `data-view`
TEST: smoke "exactly-seven-elements-carry-data-tab"

### E-058 · v87 · the shipped page carried colour outside the token block
CAUSE: `build.cjs` wrote a shell `<style>` with `background:#0b0e13;color:#e9eef6` — the values of `--bg` and `--text` duplicated outside the token definitions, free to drift from them.
CAUGHT: the UI verifier, counting hex literals per style block in the rendered page
RULE: every colour in the shipped page resolves through a token; the shell block carries layout only
TEST: verify "dist-shell-style-block-has-no-hex", smoke "exactly-one-style-block-in-the-page-carries-hex-colour"

### E-059 · v87 · the assembler could drop an import without saying so
CAUSE: `splitImports()` in `build.cjs` stopped collecting at the first non-import statement and silently dropped any import below it; the inner import check inside its blank/comment branch was unreachable dead code.
CAUGHT: the UI verifier, reading the assembler against its own contract
RULE: the assembler throws with the line number when an import survives below the first statement, and a check proves every source import reaches the assembled file
TEST: verify "every-ui-import-survives-the-assembler"

### E-060 · v87 · the lock control moved a heading and nothing else
CAUSE: locking the convergent premiums rewrote only the headline inside "Three fifteens, priced". The landing card and the Wildcard fifteen panel kept the rule-pure solve, so the control appeared to do nothing where the manager actually reads the decision. `wildcardOptions().locked` also returns `xi` as a plain array of ids with `captain`/`vice` beside it, not the solver's `{ids, capId, viceId}`, so the first wiring produced a wildcard recommendation with no captain at all.
CAUGHT: the orchestrator, driving the real page in both lock states after the fix round
RULE: a control that changes the answer changes it everywhere the answer is shown; when two engine functions return the same thing in different shapes, the caller normalises once at the boundary and never reads a shape it has not checked
TEST: smoke "locking-the-premiums-changes-the-landing-fifteen-and-keeps-a-captain"

### E-061 · v87 · a list of names built by joining unchecked values
CAUSE: `andList()` in `src/ui.jsx` joined whatever it was handed, so an array of objects rendered "[object Object], 1, 2 …" into a sentence on the landing card. Recurrence of E-031 in a helper written after that rule was set.
CAUGHT: mc_full property group P07 on the first run after the helper was added
RULE: a string helper that feeds the screen filters its input to renderable scalars before it joins anything — the rule from E-031 applies to every new helper, not only the ones that existed when it was written
TEST: mc_full P07 (no returned string contains undefined / NaN / [object Object])

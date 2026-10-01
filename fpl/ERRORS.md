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

### E-012 · v88 · Konsa/N.Jackson moves missed
CAUSE: name-keyed matching
CAUGHT: GW review
RULE: key on element id; BLOCK on mismatch
STATUS: **closed in v88**, the last of the seed entries to close. Roadmap item F1 shipped in v87 and was hardened in v88: `detectSquadChange(stateSquadIds, picks)` compares element ids only, `buildCtx` carries the result as `ctx.block`, and every recommendation panel is replaced by the block notice until the manager confirms. The draft half of the same hazard is closed separately by E-026 (join on `code`, never on id or name), because the draft API's ids are a different id space again — 59 of 656 players carry a different id there, so a name or an id would both have been wrong.
TEST: `qa/smoke.cjs` "E012-D3-a-squad-that-differs-from-the-entry-picks-blocks-the-landing", "E012-D3-every-recommendation-panel-is-suppressed-until-confirmed" (all eleven guarded panels) and "E012-D3-confirming-the-API-squad-clears-the-block"; `qa/mc_all.cjs` I89 "detectSquadChange blocks exactly when the ids differ" and I90 "never blocks on empty picks", over randomly generated squads; `qa/unit_engine.cjs` carries the Konsa/N.Jackson-shaped mismatch directly.

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

### E-062 · v88 · "WebKit is not installed" — a limitation that was never measured
CAUSE: the repo addendum in `fpl/CLAUDE.md` and the v87 sandbox notes stated WebKit was unavailable, so every browser suite was written for Chromium only and `RETEST_v87.md` §6 carried "Never opened in Safari" as an honest limitation and −3 under Test coverage. The statement was wrong: `require("playwright").webkit.launch()` returns 26.6 in this sandbox once `npx playwright install-deps webkit` has been run. What actually fails is `npx playwright install webkit` (download validation), and that single failure had been generalised into "WebKit is not installed" without launching the browser to check.
CAUGHT: v88, by launching `playwright.webkit` directly instead of trusting the note
RULE: an environment claim in the memory files is a measurement, not a recollection — state the command that produced it and its output, and when one command fails do not widen its failure into a capability claim. A limitation that is cheap to test is tested before it is written down.
TEST: `qa/webkit.js` check "webkit-launched-and-reports-its-version" prints the engine version; the suite is a gate step in `qa/run.sh` and in `.github/workflows/gate.yml`, so the claim cannot silently go stale again

### E-063 · v88 · the draft league's ownership was keyed on the wrong id space
CAUSE: `element_status[].owner` was read as a league-entry id, which is what `standings` and `matches` speak and what the brief for this round said it was. It is not: it is the team's ENTRY id. In the two public leagues recorded as fixtures, three of fourteen owners in league 1 and seven of nine in league 100 are values that appear nowhere in `league_entries[].id`. Keyed that way the rosters of exactly those teams came back empty, so `h2hProjection` could not build the opponent's eleven and three of fourteen teams silently lost their head-to-head projection — the failure looked like a missing fixture rather than a wrong join.
CAUGHT: v88, by the first end-to-end run across all fourteen teams of league 1; three of them reported "no opponent projection" while their fixtures were plainly in `matches`
RULE: two id spaces that overlap for most rows must be separated by evidence, not by the field name. Before keying on an id, check that every value of the field is a member of the set it is supposed to index — and pick a fixture where the two sets differ, because one where they coincide proves nothing. The translation happens once, at the shaping boundary (`data/draft_league.cjs`), so nothing downstream has to know.
TEST: unit_engine "E063-element-status-owner-is-an-entry-id-and-is-translated" (fails the fixture itself if the recorded league stops containing an owner that is not a league-entry id, so the check cannot go quiet); smoke_wk "draft-league-endpoints-are-public-and-shaped-as-documented" asserts the same against the live API; mc_all I119 proves the rosters partition the owned codes

### E-064 · v88 · a dated observation asserted as an invariant
CAUSE: three checks asserted "59 of 655 draft ids differ from the classic id" as a constant. On the evening of 11 September 2026 the game added a player, both tables became 656 long, and `smoke_wk` went red on a snapshot that was entirely correct. The number was a measurement of a moment written down as a law.
CAUGHT: v88, on the first gate run after refreshing `data/live.json` (the refresh was itself forced by a real red: three overnight price changes against the 14:05Z snapshot)
RULE: a count taken from a live source is reconciled against that source, never frozen. The invariant is the property — every draft element joins to a classic element by code — and the count is reported beside it. Where a suite can reach the source it compares the two and says which it used.
TEST: smoke_wk "draft-ids-differ-from-classic-and-the-count-reconciles-live" (snapshot against a fresh pull, and it says so when the API is unreachable); unit_engine "E026-live-every-draft-element-joins-by-code-and-the-id-shift-is-real"; validate_live prints the shift instead of pinning it

### E-065 · v88 · a variance tilt kept for a side that had not changed
CAUSE: the C5 head-to-head rule builds a second eleven tilted towards ceiling or floor and keeps it only when it beats the first on the quantile that matters. It was keeping tilts that changed nothing real: `entryPoints` walks the starters in the order it is handed when it fills in for a player who did not appear, so a reshuffle of the same eleven moved the simulated distribution. A draft eleven is a set; only the bench is ordered.
CAUGHT: v88, by unit_engine "DRAFT-C5-variance-rule-leans-up-when-behind-and-down-when-ahead" on the refreshed snapshot — "AC FC is marked tilted but neither the eleven nor the bench changed"
RULE: a Monte Carlo comparison between two selections must depend only on what a selection actually is. `mcDraftXI` and `mcH2H` sort the eleven into a canonical order before simulating and leave the bench order alone, because the bench order is a real decision and the starting order is not.
TEST: unit_engine "DRAFT-C5-variance-rule-leans-up-when-behind-and-down-when-ahead" (a tilt marked kept must have changed the eleven or the bench, and `tiltChangedXI` must agree); mc_all I122

### E-066 · v88 · a check that could not fail
CAUSE: `draftPool` listed the snapshot's `freeAgents` array and carried a second guard that re-checked each code against the ownership map. The guard could never fire, because the array it filtered was built from that same map — mutating the guard away left the suite green at 217/217. The guard read like protection and was decoration.
CAUGHT: v88, by mutation-testing the new checks one by one: every other mutation turned a check red, this one turned nothing red
RULE: every new check is mutation-proven before it is counted — break the behaviour it claims to protect and watch exactly that check go red. A guard nothing can exercise is removed, and the thing it pretended to protect is made structural instead: the pool is now DERIVED from ownership, so a wrong `freeAgents` list cannot put an owned player in front of the manager at all.
TEST: unit_engine "DRAFT-a-wrong-free-agent-list-cannot-put-an-owned-player-in-the-pool" (a rostered code is pushed into `freeAgents` and must not surface), plus "DRAFT-pool-is-free-agents-only-and-excludes-every-rostered-code" and mc_all I118, both of which go red when the derivation stops filtering owners

### E-067 · v88 · a hold week reported three transfers it was not making
CAUSE: `transferProtocol` wrote `k`, `hits`, `value` and `bankAfter` from the best plan it had found **before** deciding whether to ship it. On a hold — plans exist, the margin is under 0.8 and nothing is forced — `moves` stayed empty while `k` kept the best plan's swap count, so the landing card read "No hit: 3 of your 3 free transfers. Bank afterwards £1.5m" under a recommendation to make no transfer at all, and `hits` could be non-zero with nothing bought.
CAUGHT: v88, by mc_all I55 ("the number of moves matches k") on a randomly generated universe — "0 moves for k 3". The invariant had existed since v58 and had never fired: the universes that reach a hold **with** plans on the table only appeared once the F4/F5/F8 invariants shifted the shared random stream.
RULE: every field that describes the shipped plan is written on the ship path and nowhere else. A hold ships nothing: `k` 0, `hits` 0, `value` 0, the bank untouched. What was considered stays in `alternatives`, which carries its own `k`, `hits` and `value`, and `margin` still reports the comparison.
TEST: unit_engine "E067-a-hold-reports-no-transfers-no-hit-and-an-untouched-bank" (a fixture with two numerically identical replacement midfielders, so two genuinely different plans tie, the margin is 0 and the protocol holds with plans on the table) and "E067-every-transfer-plan-reports-as-many-moves-as-its-k" across five contexts; mc_all I54, I55, I56. Mutation-proven: restoring the pre-ship assignment turns both checks red with "k is 1 on a hold; value is 7.11 on a hold; bankAfter 39 against a bank of 40".

### E-068 · v88 · a Free Hit silently worth nothing in a deep blank
CAUSE: the first `bestElevenForEvent` capped its candidate pool at three players per club before handing it to `pickXI`, reasoning that a Free Hit squad obeys the same club cap. With four clubs playing that leaves twelve candidates, which need not contain one goalkeeper, three defenders, two midfielders and a forward — `pickXI` then returns `ok:false` and the chip is priced at zero. A Free Hit reported as worth nothing in the deepest blank of the season is exactly the wrong answer in exactly the week the chip exists for, and it would have been a zero with no error attached to it.
CAUGHT: v88, while writing the unit fixture for it: the synthetic blank leaves four of six clubs playing and the check "F8-free-hit-is-the-best-available-eleven-minus-your-own" went red on `free.ok === false` before the value was ever compared.
RULE: a constraint that can make the answer unrepresentable is not applied silently. The pool is the highest-scoring players whose club plays, with no club cap and no budget, and every place the number appears — the engine's `note`, `chipValue`'s `detail`, the Chips panel and its reveal — says it is an upper bound on both counts.
TEST: unit_engine "F8-free-hit-is-the-best-available-eleven-minus-your-own-and-is-labelled-an-upper-bound" (asserts `legalXI` on the returned eleven, that nobody in it is blank, and that both words "budget" and "three-per-club" appear in the note); smoke "F8-the-chip-panel-states-both-set-expiries-and-the-Free-Hit-upper-bound"

### E-069 · v88 · a walk-forward that scores a past gameweek with today's injury flags
CAUSE: `pStart` folds the current `status` and `chance_of_playing_next_round` into its answer, and the snapshot carries exactly one of each per player — the value as at the moment of the pull, with no per-gameweek history. Scoring GW2 from GW1 therefore applies a flag that was set after GW3 was played. Left unsaid, the incumbent's Brier would look better or worse than it really was for a reason that has nothing to do with the model.
CAUGHT: v88, while building F4's walk-forward: there was no honest way to fit a flag coefficient from a field with no history.
RULE: the flag is applied, never fitted, and both models carry it identically so the comparison is like for like. Every fold also reports the pair with the flag peeled back out (`noFlag`), so its contribution is visible rather than assumed, and `minutesTerms` declares `flag` and `european_load` as terms that exist and were not fitted, each with the reason — the fixture list this app pulls is the Premier League list and carries no midweek European load at all.
TEST: unit_engine "F4-minutesModel-declares-the-flag-and-the-European-load-as-terms-it-did-not-fit" and "F4-minutesModel-drives-nothing-and-says-the-Laplace-rate-is-the-driver" (the 75% doubt must multiply the fitted probability by exactly 0.75); smoke "F4-the-lab-panel-says-the-flag-and-the-European-load-were-not-fitted"; the live block prints the no-flag pair beside every fold

### E-070 · v88 · the shipped markup carries `class=""` on the captain and vice rows
CAUSE: `MoveList` computes `const tone = o.action === "sell" ? "out" : (o.action === "buy" ? "go" : "")` and passes it straight to `<span className={tone}>`. For the two actions that are neither a sell nor a buy — captain and vice — that is the empty string, and React writes the attribute out as `class=""`. Every other tone in the app is built as `"base" + (tone ? " " + tone : "")`, which can never be empty; this one has no base class at all, so the element ships with an attribute that says nothing and a styling hook that is not there.
CAUGHT: v88, by the first run of `qa/components.cjs`, which renders each component on its own through `react-dom/server` and scans the markup. Reproducing input, no mocks: `buildCtx(LIVE, sanitiseState(state/kwezi.json), "2026-09-12T06:00:00Z")` → `transferProtocol(null, ctx)` (order: sell,sell,sell,buy,buy,buy,captain,vice) → `renderToStaticMarkup(<MoveList ctx tp/>)` contains exactly two occurrences, `<span class="">Captain</span>` and `<span class="">Vice</span>`. `TabPlan` inherits both. No browser suite could see it: `smoke.cjs` scans rendered markup for hex literals and token counts, never for empty attributes.
RULE: a className built by a ternary must never be able to evaluate to the empty string. Either give it a base class or pass `undefined`, which React omits. Fix: `className={tone || undefined}` in `src/ui.jsx`.
STATUS: **fixed**, same round, by the session that owns `src/ui.jsx`: `className={tone || undefined}`. The `KNOWN_EMPTY_CLASS` pin has been deleted from `qa/components.cjs`, so any empty class attribute anywhere is now a plain FAIL with nothing allow-listed.
TEST: `qa/components.cjs` "A-no-component-ships-an-empty-class-attribute-E070", which counts every empty class attribute across every pass-A render and fails on one. Mutation-proven twice: restoring `className={tone}` takes the suite from 133/133 to 123/133 and names "6 empty class attribute(s)". The first replacement for the pin was itself dead — it asserted a counter nothing incremented any more, and passed with the defect reintroduced — so the accumulator was wired to the real offender count and the mutation re-run. A check that has not been seen to fail has not been written.

### E-071 · v88 · twenty-one React components were fuzzed on their inputs and never on their output
CAUSE: `mc_full` group P03 asserts the components *reject* junk props with a TypeError. That is a statement about what they refuse, not about what they draw, and it was the only component-level assertion in the suite. The browser suites measure the assembled page — word counts, type floors, touch floors, tokens — so a component that rendered `undefined`, `NaN`, `[object Object]` or an empty attribute inside an open panel could ship with every suite green. E-070 is the proof: it was in the shipped file through the whole of v87 and no suite could see it.
CAUGHT: v88, by the Part I "test coverage" deduction ("the 21 React components are fuzzed under a props contract, not on their output"), and then immediately by the suite written to close it.
RULE: a component's contract is its markup. Every component renders on its own, from the real snapshot, and the markup is asserted: non-empty, free of `undefined` / `NaN` / `[object Object]` / an empty `class`, free of hex colour outside the one `<style>` block, and carrying every `data-testid` it owns. The ownership map is scanned out of the shipped file rather than typed, so a testid added to the app cannot drift away from the suite; the four testids only a user event can produce are named with the browser suite that clicks each one, so nothing falls between the two.
TEST: `qa/components.cjs`, 132 checks, a gate step in `qa/run.sh`. **`.github/workflows/gate.yml` lists its suites one by one and does not yet name `components.cjs` (nor `data/validate_live.cjs`); that file is outside `fpl/` and was not edited this round, so CI is one suite behind the local gate until someone adds the line.** Each new check was mutation-proven: emptying the pin turns the empty-class checks red, dropping the league-loaded TabDraft variant turns the testid check red, removing `importErr` from TabLab's declared TEXT slots turns the leak check red, and a deliberately broken ctx turns six B checks red.

### E-072 · v88 · the fuzz suite could not fail on an unbounded loop, only hang on one
CAUSE: `mc_full` ran in one thread, so it could not time out a synchronous call from inside itself. Property group P04 ("every call terminates inside two seconds") is measured after the call returns, which is no use when the call never returns. E-035 — `binomial(1e308, p)` looping without bound — was therefore found by a human noticing that the suite had not finished, not by the suite. A CI runner would have reported a timeout with no name attached to it.
CAUGHT: v88, from the suite's own documented limit, written into its header by whoever hit it.
RULE: the thing that measures a run cannot be inside the run. The fuzz loop now executes in a worker thread and writes the function name and the junk kinds into a `SharedArrayBuffer` before every trial; the parent thread watches the heartbeat and turns a trial that has not returned inside `MC_WATCHDOG_MS` (10000) into `FAIL mc_full-watchdog — «<function> [<kinds>]»`, terminates the worker and exits 1. Iteration counts, seeds and per-trial timings are unchanged.
TEST: `mc_full-watchdog-self-test-names-an-unbounded-loop` runs a worker that really does spin for ever and requires the watchdog to name it (1.5 s budget; it named it in 1.8 s), and its result is carried into the suite's own assertion counts so the mechanism cannot be silently disabled; `mc_full-the-fuzz-loop-runs-under-that-watchdog` fails if the suite is run on the main thread. Mutation-proven against the real loop: a `while(true)` injected at trial 120 produced `FAIL mc_full-watchdog — «fixtureDraws [valid|valid]» did not return within 3000 ms (trial 121)` and exit 1.

### E-073 · v88 · a million iterations against twenty-nine worlds
CAUSE: `mc_all` rebuilt its universe pool every `max(2000, ITERS/24)` iterations, so the 1,000,000-iteration release run generated 29 universes in total and every invariant saw only those. For the cheap invariants that is ample. For the expensive ones it was the binding constraint and the iteration count was buying nothing: an invariant that solves a wildcard runs a few hundred times in the whole suite, and running it three hundred times against twenty-nine worlds is thirty times less evidence than the headline "1,000,000 iterations" suggests. The suite reported iterations and never reported worlds, so the gap was invisible.
CAUGHT: v88, by reading what the fuzz suites themselves reported after the v87 release run.
RULE: report the dimension that is actually binding. Every invariant now prints the number of distinct universes it ran against, and the suite fails if an expensive one (dispatch weight ≤ 5, 22 of them) saw fewer than 25 or any other saw fewer than 5. Those expensive invariants draw from their own three-slot bank, one slot of which is replaced with a brand-new universe every 24 deep draws — about 700 extra universes and 15 s at the release count. Measured at 200,000 iterations on one machine: 29 universes generated and 20–27 seen per expensive invariant before, 243 generated and 38–154 seen after, 71.3 s → 75.6 s.
TEST: `qa/mc_all.cjs` prints "N runs over M universes" per invariant and adds the two floors to `failCount`; `MC_DEEP_W=0` restores the old behaviour so the before and after are measurable rather than arguable.

### E-074 · v88 · `minutesFeatureVector` throws on a null history row
CAUSE: `src/engine.js` line 3013 reads `num(last3[last3.length - 1].min, 0)` — it dereferences the last of the three history rows directly. Every other row access in the same function uses the `r && r.min` guard (lines 3011, 3018, 3021); this one does not, so any `null` or `undefined` row among the last three throws a TypeError out of a function the engine's header declares total. It is reachable from real data: `sanitiseState` does not guarantee dense history rows and `arr()` keeps holes.
CAUGHT: v88, by `mc_full` at the **25000 release count**, first run of `bash qa/run.sh --release`. `P01 nothing throws (total functions) · 25000 checks, 1 failed · minutesFeatureVector — array of null|Infinity|valid`. The 3000 dev count had passed the same code clean twelve minutes earlier — which is the whole argument for the release mode being a named gate rather than an environment variable somebody remembers. Minimal repro, no mocks: `minutesFeatureVector([null], 4, {})` and `minutesFeatureVector([{gw:1,games:1,min:90,starts:1}, null], 4, {})`, both `TypeError: Cannot read properties of null (reading 'min')`.
RULE: a total function guards every element of every array it is handed, not just the ones the happy path reaches. Fixed one level up rather than one call site at a time: the history is filtered to objects once, at the top of the function (`var h = arr(hist).filter(isObj);`), so a null row is treated as no row at all — which is what it is — and every reader below can assume an object. A null row is not a gameweek of zero minutes.
STATUS: **fixed**, same round, by the agent that owns `src/engine.js`, from the repro handed over above. Both repro calls now return the five bounded terms; nine junk histories (null-only, null-last, mixed, string, empty, non-array) were checked by hand before the suite was touched.
TEST: `qa/mc_full.cjs` group P01 at the release count, which is what found it; and unit_engine "F4-minutesFeatureVector-is-bounded-on-any-history-and-starts-with-the-intercept", whose case list now carries six null-row and junk-row histories among its twelve, so the defect is caught deterministically at every count rather than only when the fuzzer happens to draw that junk kind. The real lesson is the count: this is the third defect the release count found that the dev count could not (E-035, E-036), and a tag is cut only after `bash qa/run.sh --release`.

### E-075 · v89 · a new invariant went red on the comment that explains it (recurrence of E-013)
CAUSE: the first version of `qa/verify.sh` I20, the service-worker invariant, asserted that `dist/sw.js` never names `api.anthropic.com` — the D4 refresh path must never be served from a cache. It tested the whole file, comments included, and the generated worker opens with a header comment that says in plain words why that origin is never cached. The comment was correct and the check was wrong: `SUITE verify 30/31 — red: pwa-service-worker-precaches-this-build-only`, on a worker that behaves exactly as intended. This is E-013 again in a different file: a scan that cannot tell a comment from a statement.
CAUGHT: v89, on the first run of the new invariant, before anything shipped.
RULE: a check on what code DOES reads the code with the comments stripped. I20 now builds `code` by removing block and line comments from `sw.js` and runs all three behavioural greps (non-GET skipped, cross-origin skipped, the refresh origin not named) against that, and prints how many code lines it scanned so the stripping is visible rather than assumed. The wider rule from E-013 stands and now has a second test behind it: never assert on source text without deciding first whether comments are part of what you are asserting.
TEST: `qa/verify.sh` I20 "pwa-service-worker-precaches-this-build-only", which prints "sw.js parses (51 code lines after comments are stripped)". Mutation-proof of the stripping itself: putting `api.anthropic.com` back into the worker's header comment leaves the check green, and putting it into a statement turns it red.

> Numbering note (v89): two sessions appended to this file in the same round. When the entries
> below were drafted, `qa/verify.sh` I20 already carried a comment citing **E-075** and that entry
> had not yet been written, so these were numbered from E-076 rather than claim a number another
> agent was holding. E-075 landed while they were being written, which is the outcome the choice
> was made for: the numbering held and nothing was overwritten. Append-only means the number you
> take is the number nobody else can be taking.

### E-076 · v89 · the app shipped a manifest naming three icons the repository did not carry
CAUSE: `build.cjs` generates four PWA icons into `dist/`, and the repository root `.gitignore`
carries `*.png` on line 4 for the sibling fitness project's screenshots. That rule swallowed
`icon-192.png`, `icon-512.png` and `icon-maskable-512.png`, so the commit that added the PWA
carried `dist/manifest.webmanifest` naming all four icons, `dist/sw.js` precaching all four, and
`dist/icon.svg` — and none of the three PNGs. A host serving the committed `dist/` would have
answered 404 three times: `apple-touch-icon` gone, so an iPhone "Add to Home Screen" falls back to
a screenshot of the page, which is the exact device this feature was built for; two of the four
manifest icons gone; and the service worker skipping them at install through the `catch` that is
there so one missing file cannot abort the precache — silently, by design, for the wrong reason.
CAUGHT: v89, by `git ls-files fpl/dist` printing four paths where seven files exist on disk, and
then `git check-ignore -v` naming `.gitignore:4:*.png`. No suite could see it: every PWA check ran
against the working tree, where `node build.cjs` had just written the files.
RULE: a generated file the app names is a file the repository must carry, and "it exists on disk
after a build" is not that. `fpl/.gitignore` re-includes `dist/*.png` (`!dist/*.png`, which is
scoped so `qa/shots/*.png` stays ignored), and verify.sh asserts the property rather than the
patch: for every file the manifest names, `git check-ignore -q` must say it is not excluded. The
assertion is "not excluded", not "already tracked" — a file generated a second ago is legitimately
uncommitted, while a file an ignore rule has quietly removed from the repository is wrong at any
moment — and uncommitted files are named in the detail so they are visible rather than silent.
TEST: `qa/verify.sh` I22 "pwa-no-shipped-file-is-gitignored", which reads the icon list out of the
shipped manifest rather than a typed list, so a fifth icon is covered the day it is added.
Mutation-proven: with `fpl/.gitignore` moved aside the suite goes 33/33 → 32/33 with
"excluded from the repository: dist/icon-192.png(.gitignore:4:*.png) dist/icon-512.png(…)
dist/icon-maskable-512.png(…)", and restoring it returns 33/33.

### E-077 · v89 · a deadline that had just passed made the scheduled refresh decline for the wrong reason
CAUSE: `.github/workflows/refresh.yml` reads the hours to the next deadline in node, hands the
number back to bash, and the first version let bash hand it to a second `node -e` for the
"is it inside 36 hours" comparison. The FPL API can still report a gameweek whose deadline has
just passed as `is_next`, so that argument can be `-0.2`, and node reads a leading dash as a
command-line option: `node: bad option: -0.2`. The comparison then produced an empty string, the
`= "true"` test failed, and the run declined with the message "outside the 36-hour window" for a
deadline twelve minutes in the past — a wrong answer wearing a plausible explanation, in the one
window the second daily run exists for.
CAUGHT: v89, before the workflow ran anywhere, by testing the gate at seven deadline positions
(+334.8 h, +36.0, +35.9, +20, +0.5, −0.2, −4.0 and no `is_next` at all). The two negative cases
printed `node: bad option`; the five others were correct, which is why reading the code was not
going to find it.
RULE: a number crosses the shell boundary once, or not at all. The window decision now lives in
`gate.cjs` beside the arithmetic that produces the number, which emits `inside_window=1|0` and the
window itself as text; bash reads the flag and never re-derives it. The window is stated as 36
hours ahead to 3 hours behind, and the trailing edge is deliberate: it keeps the run going through
the minutes after a deadline locks.
TEST: the gate helper was run against the live API (GW6, deadline 2026-10-10T10:00:00Z, 334.8 h,
`inside_window=0`) and against four synthetic bootstraps — deadline 12 minutes past → `hours=-0.2
inside_window=1`; 4 hours past → `-4.0`, `0`; 20 hours ahead → `1`; no `is_next` → empty hours,
`0`. The workflow is validated with `python3 -c "import yaml; yaml.safe_load(...)"` and both
embedded helpers are extracted and `node --check`ed.

### E-078 · v89 · two agents edited build.cjs and it declared serviceWorker twice
CAUSE: two sessions were given the PWA half of v89 at the same time. One had already written the
manifest, worker and icon generator into `build.cjs`; the other had read `build.cjs` before that
landed, built its edit as an atomic batch against the bytes it had read, and applied it. Every
`assert count == 1` in the batch passed, because the anchors it matched were still there — the
other agent's code had been added around them, not over them. The result compiled, `node --check`
passed, and the file declared `function serviceWorker` twice, at lines 372 and 709. Function
declarations hoist, the later one wins, so every call resolved to the version that took one
argument and the `shell` array the call site passed was dropped on the floor.
CAUGHT: v89, by review, from the duplicate `const zlib = require("zlib")` that the same batch
produced one line below an identical declaration — that one is a `SyntaxError` and stopped
`node --check` immediately, which is the only reason the silent duplicate beside it was looked for.
A duplicate `function` declaration is legal JavaScript and no gate in this project can see it.
RULE: recon is not a step you do once. An atomic batch is only atomic against a file nobody else
is writing, so the last thing before applying one is re-reading the target — and `assert
count == 1` on an anchor proves the anchor is unique, never that the file is the one you read.
When a collision is found the other agent's work is restored first and the merge is deliberate;
the resolution here was to keep their implementation whole and drop the duplicate wholesale.
`grep -o '^function [A-Za-z0-9_]*' build.cjs | sort | uniq -c | awk '$1>1'` prints nothing on a
clean file and is the check that would have caught it in one line.
TEST: no suite assertion — this one is a working-practice rule, and pretending otherwise would be
worse than saying so. What is verified is the end state: `build.cjs` declares each of its 24
top-level functions exactly once, and `verify.sh` I20 recomputes the worker's cache name from the
shipped page, manifest and icons, so a worker built by the wrong code path cannot match it.

### E-079 · v89 · a red check that could not say what was wrong
CAUSE: `verify.sh` I20 and I21 both read the worker's `SHELL` array with `JSON.parse` on a regex
capture. When that literal is malformed the exception escapes the `node -e`, bash captures a stack
trace and keeps its first line, and the suite prints `FAIL pwa-service-worker-precaches-this-
build-only — <anonymous_script>:1`. The check was right to go red and told the reader nothing.
It matters more than it looks: `.github/workflows/refresh.yml` copies these `FAIL` lines straight
into a GitHub issue, and an unreadable weekly failure is how a scheduled job gets muted.
CAUGHT: v89, by an invalid first attempt at mutation-proving I21 — the mutation removed an array
element and left a trailing comma, so both checks failed on the parse instead of the logic. The
bad mutation was the useful one.
RULE: a check reports what it found, not that it fell over. Both parses are wrapped and print the
JSON error and the first 160 characters of the offending literal. A mutation that turns a check red
for a different reason than the one being proven has not proven it; re-mutate.
TEST: the trailing-comma mutation now yields "the SHELL literal in sw.js is not valid JSON
(Unexpected token ']' …): [\"./\",\"./index.html\",…,]" on both checks, and the clean mutation —
one element removed, list still valid JSON — turns I21 red alone (33/33 → 32/33, "named by the
manifest and NOT precached by the worker: icon-maskable-512.png") while I20 stays green, which is
the proof that I21 covers a gap I20 could not see.

### E-080 · v89 · the refresh job sourced API-derived text as shell (recurrence of E-077's class)
CAUSE: `gate.cjs` prints `key=value` lines and the workflow read them back with `. "$LOGS/gate.env"`.
Two things are wrong with that and the second is the serious one. First, one of the values is a
sentence — `window=36h ahead to 3h behind` — and sourcing it runs `ahead`, `to`, `3h` and `behind`
as commands, leaving `window` set to `36h` and four "command not found" lines in the log of a job
whose whole job is to be readable. Second, every value in that file was derived from a public HTTP
response. `deadline` is a string the FPL API chose. Sourcing API-derived text is a shell-injection
path, and it does not need a hostile API to go wrong — it needs one unexpected character.
CAUGHT: v89, by reading the shipped text after fixing E-077, looking for other values crossing the
same boundary. It had not run anywhere yet.
RULE: read, never source. A `key=value` file produced for a shell is parsed with
`sed -n "s/^key=//p"` into a variable, which evaluates nothing, tolerates spaces, and cannot run a
command whatever the API returns. Nothing that came off the network is ever `.`-sourced, `eval`-ed
or interpolated into a position where the shell would evaluate it.
TEST: the gate step's shipped text is extracted from the YAML with only the `curl` line swapped for
a fixture, and executed for six scenarios against real and synthetic bootstraps — morning far from
a deadline (`proceed=1`), afternoon far (`proceed=0`, "334.7h away, outside the 36h ahead to 3h
behind window", which is the sentence-valued variable surviving the read), afternoon 19.9h ahead
(`1`), afternoon 0.3h past (`1`), afternoon 4.1h past (`0`), and no `is_next` at all (`0`, "the
afternoon run needs a next deadline and the API reports none").

### E-081 · v89 · a green run would have failed on the red it inherited
CAUSE: the refresh job runs `validate_live` twice — once on the committed snapshot before fetching,
to tell "this fetch broke something" apart from "this assertion is frozen to a past gameweek", and
once afterwards as a gate. Both logs went into `$LOGS`, and a later step sweeps `$LOGS` for `^FAIL `
and fails the job on a hit. So the baseline measurement, whose entire purpose is to record failures
that are *not* this run's fault, would have failed the run for them — and it would have done it on
every single run, because today the committed snapshot carries eleven of them. A diagnostic that
fails the thing it is diagnosing is worse than no diagnostic.
CAUGHT: v89, before the workflow ran anywhere, while working out what it would do against the real
tree: `data/validate_live.cjs` is 76/87 on the 26 Sep snapshot with all eleven failures frozen to
12 September, so the sweep would have hit eleven `FAIL` lines on a job whose own suites were green.
RULE: measurements and results do not share a directory. `$LOGS` holds only what this run produced
and is what the sweep and the failure issue read; `$HELPERS` holds inputs and evidence about the
previous state. The rule generalises past this workflow: any "no FAIL anywhere" sweep has to be
told exactly what "anywhere" means, or it will eventually be handed a log of expected failures.
TEST: the step's shipped text is extracted and run against the real 76/87 snapshot twice. With the
true baseline it reports "0 check(s) NEWLY broken by this fetch, 11 already failing on the committed
snapshot", prints every one as a `before:`/`after:` pair, exits 1 and commits nothing. With one
check removed from the baseline it reports "1 newly broken, 10 pre-existing", lists
`FAIL next_event 4 — 6` under "the snapshot this job just wrote is the suspect", and annotates the
run with both counts.

### E-082 · v89 · a protocol check allowed two of the three reasons the rules give for a sell
CAUSE: `qa/smoke_wk.cjs` asserted that every sell `transferProtocol` proposes either has no starts
in three or gains more than the hit plus a margin — C1 rule 1 — and ignored `m.forced`. C2 step 1
is explicit that a sell is also justified when the player is unavailable ("status != 'a'"), and a
75% doubt is a status that is not "a". The check encoded two of the three justifications, so it was
bound to go red the first week the engine did something it was entitled to do.
CAUGHT: v89, the first week the protocol forced out a player who was starting — Brobbey, status d,
three starts of three, a gain of only 2.44. The recommendation was right and the check could not
express it.
RULE: a check on a rule reproduces every branch of that rule, or it is a check on a different rule.
Selling a starter on a doubt is the aggressive end of the protocol, so the third justification is
allowed only when the reason is on screen with the player's name against it.
TEST: `qa/smoke_wk.cjs` step 3 accepts a forced sell only when the landing copy names the player
and the reason, and still requires the margin on an unforced one.

### E-083 · v89 · a check named "on the fallback path" read the wildcard captain
CAUSE: `qa/smoke_wk.cjs` step 14 asserts the captain is in the eleven on the fallback path, where
no chip is played, and read `WEEKLY.classic.captain` — the captain of the WILDCARD fifteen. It
passed through v87 and v88 only because the same player captained both paths.
CAUGHT: v89, the moment the two paths differed: the wildcard fifteen captains Groß, who is not in
the fallback fifteen at all, so a correct plan turned the check red.
RULE: a check reads the field belonging to the path it is named for. Where one plan carries two
paths, each path's captain and vice are asserted separately.
TEST: step 14 reads `fallback.captain` and `fallback.vice` and asserts both are in the fallback
eleven and differ; the wildcard captain is asserted in its own check above it.

### E-084 · v89 · eleven snapshot assertions frozen to a past gameweek (a recurrence of E-064)
CAUSE: `data/validate_live.cjs` asserted the 11 September observation as an invariant — three
finished gameweeks ("1,2,3"), 79 rivals, `ft_available === 3`, `next_event 4`, `current_event 3`,
the literal deadline `2026-09-12T12:30:00Z`, the GW4 draft waiver time, and the six mini-league
sizes. Refreshing the snapshot to GW5 turned eleven of them red on data that was entirely correct.
E-064 recorded this exact class in v88 and the rule did not reach this file, which is the part that
matters: a ledger entry that does not get applied everywhere the class lives is a note, not a rule.
CAUGHT: v110 preflight. The baseline gate came back `RED: 5 of 15 steps` with `validate_live 76/87`,
`unit_engine 246/255`, `smoke 51/60`, `smoke_wk 26/36` and `components 128/133`, and every failure
inspected was the same class: an expectation frozen to 12 September against a snapshot whose next
deadline is 10 October.
RULE: derive, never freeze. What is invariant is the snapshot's internal consistency with its own
events, history and picks — the gameweek keys are exactly the finished events, `ft_available` is
the replayed ledger, the deadline is the `is_next` event's own — not the values any one pull
happened to carry. A dated observation is reported in the detail string, never asserted.
  E-064 already said that in prose, and prose did not reach this file. So the rule is now
  something a machine checks, and it is stated in a form that cannot be satisfied by wording:
  **no check anywhere in `qa/` or `data/` compares a live-sourced field, or the length of a
  live-sourced collection, to a literal number or a literal ISO instant.** A line may carry
  `frozen-ok: <reason>` where the constant is a rule of the competition rather than an
  observation (twenty clubs, 380 fixtures) or where the literal is a synthetic fixture's own
  input; the reason is required and every exemption is printed on every run, so they stay
  visible instead of accumulating unread.
TEST: `qa/no_frozen.cjs`, 6/6 over 16 files, 0 offenders and 5 exemptions each with its reason.
It is mutation-proven on 16 cases: it flags a frozen gameweek number, free-transfer count,
deadline instant, collection length and `Object.keys(...).length`, and does not flag a game rule
(a squad is fifteen), a derived comparison, a range with the value reported, an object literal
building a fixture, an assignment, a locally computed array or a commented-out line. It also
caught a defect while being written: lifting the league-count check above `WANT_IDS` put the
constant in its own temporal dead zone, which `node --check` cannot see (E-004's class).
Alongside it, `data/validate_live.cjs` is 86/86 with every check derived from the file under
test, and `qa/verify.sh` reconciles the same fields against the live API. A future refresh moves
the numbers in the detail strings and changes no assertion.
FOLLOW-THROUGH (same round): the rule was then carried to every other place the class lived, which
is the part E-084's own CAUSE says gets missed. `qa/unit_engine.cjs` had four more — "59 shifted
codes", Hull's "xGA per game above 1.5", Arsenal's "def 0.73 ± 0.02" and the F4/F5 gate verdicts
pinned as "shut" — each replaced by the property it stood for or by the gate's own arithmetic.
`qa/smoke.cjs` had three mocked clocks frozen to the GW4 weekend, now derived from
`events[is_next]`, and its flag pair named one player, now chosen from the snapshot.
`qa/webkit.js` had the last one: `NOW = "2026-09-11T08:00:00Z"`, so its Safari screenshots were
counting down to a deadline fifteen days in the past ("29d to deadline" on a GW6 snapshot). It is
derived too, and the same shot now reads "26h to deadline".

### E-085 · v110 · rival managers' personal names were committed, and a suite held them in place
CAUSE: `data/fetch_live.cjs` mapped `player_name` straight from the Classic league standings into
`data/live.json`, and `data/draft_league.cjs` built a `manager` field from `player_first_name` and
`player_last_name`. 115 name fields holding 84 distinct real people went into the snapshot and
from there into `app/FPL_Mission_Control.jsx` and `dist/index.html` — 345 occurrences in the
shipped tree — plus 50 more and 24 league-entry `short_name` values, which are managers'
initials, in the recorded fixtures under `qa/fixtures/draft/`. Nothing rendered them, which is why
nobody saw them; the rule is about committing, not rendering. Worse, `data/validate_live.cjs`
asserted that `player_name` was PRESENT, so the suite was holding the violation in place and
reporting green.
CAUGHT: v110 preflight, reading the snapshot's shape against the privacy clause. Not by any suite,
and not by the interface, because neither was looking.
RULE: scrub at the write, not at the display — a display filter leaves the names on disk, in the
built page and in git history. `data/scrub.cjs` drops the three name keys everywhere and
`short_name` only from an object that identifies a league entry, because a Classic team's
`short_name` is a club ("ARS") and a Draft entry's is a person ("KN"). The whole payload goes
through it at the write, so a field added to a feed tomorrow cannot leak a name in by default.
TEST: `qa/privacy.cjs`, first among the suites in `qa/run.sh` and `.github/workflows/gate.yml`:
22/22 over 92 files and 12,650,291 bytes, 0 name keys and 0 league-entry initials where there were
345 and 24. It matches quoted, single-quoted and BARE key positions — the first version insisted on
double quotes and read `dist/index.html` as clean while that file carried 115 names, because the
build inlines its data as a JavaScript object literal. It plants a violation in each encoding and
asserts the scanner finds it, and asserts it does not fire on the key name used in prose, so a
scanner that stops looking cannot pass (E-070's lesson). `data/validate_live.cjs` now requires the
standings row's keys to be exactly {entry, entry_name, total, rank}.

### E-086 · v89 · a tournament field called `promotable` that meant something else
CAUSE: `tournament(live)` returned a top-level `promotable` boolean that was set to
`transitions >= TOURNAMENT_PROMOTE_AT` — the transition-COUNT half of the promotion gate, and
nothing about any model passing it. On the GW5 snapshot it read `true` while all nine models'
own `promotable` flags read `false`, and the Lab panel rendered it as "Promotable: yes" under a
table in which nothing was promotable. The word said one thing and the value meant another, which
is the A2 law-1 failure mode in a field name rather than in a number.
CAUGHT: v89, reading the Lab tournament panel against the engine's own per-model gates on the
refreshed snapshot: `tournament(LIVE).promotable === true` with
`tournament(LIVE).models.every(m => m.promotable === false)`.
RULE: a field is named for what it means. The transition-count half is `decidable` — enough
transitions exist for the gate to be DECIDED — and `promotable` now means what the word reads as:
at least one model's own gate is open (`models.some(m => m.promotable)`). Per model, `promotable`
stays that model's own `promotionGate` verdict, so the two never disagree in the same direction.
The engine's `note` states both in words, and the panel, which renders the top-level flag, became
correct without being edited: it now reads "Promotable: not yet" because no model has passed.
TEST: `qa/mc_all.cjs` I97 asserts the two separately over random universes —
`decidable === (transitions >= 3)`, `promotable === models.some(...)`, and a model may never pass
a gate that is not even decidable; `qa/unit_engine.cjs`
"LIVE-tournament-has-nine-models-and-separates-decidable-from-promotable" asserts the same
arithmetic on the shipped snapshot with the transition count derived from its finished gameweeks.
Mutation-proven: setting `res.promotable = res.decidable` again turns I97 and both unit checks red
with "promotable true while 0 models are past their gate".

### E-087 · v89 · the minutes gate opened and nothing in the app noticed
CAUSE: F4's `minutesModel` returns `driving: false` and `driver: "pStart"` as literals. They were
written in v88 when the walk-forward had one fittable transition against a gate that wants three,
so the literal and the gate agreed and nobody had to look again. Five finished gameweeks make four
folds, three of them fittable, three of them won by the logistic and a three-gameweek trailing
hold-out, so `minutesWalkForward(LIVE).gate.promotable` is now **true** — the shared
`promotionGate` says the challenger may be promoted — and the engine still reports that it is not
driving anything, because the flag is a constant rather than a read of the gate. Measured on the
26 September snapshot: Laplace Brier 0.1142 · 0.0954 · 0.0953 · 0.0968, logistic — · 0.0874 ·
0.0768 · 0.0764, so the logistic is ahead on every fold it can be fitted on.
CAUGHT: v89, by rewriting the two v88 checks that had frozen the gate as shut. The arithmetic came
out the other way and the model's own report had not moved with it.
RULE: a flag that answers a question the engine can compute is computed, not typed. `driving` must
be derived from the gate that decides it, and promoting P(start) from the Laplace rate to the
logistic changes every recommendation in the app, so it is a deliberate act with its own round,
its own before-and-after on the shipped plan, and its own retest — not a side effect of a suite fix.
STATUS: **closed in v110, and the answer is the third option neither of those two allowed for.**
`driving` is computed, and the promotion decision turned out to be three questions rather than one:
`eligible` (the gate AND a tail condition), `routed` (whether production actually asks the model),
and `driving` (the conjunction). Reporting `driving: true` for a model nothing calls would be this
entry inverted and no better than it, so the code answers each separately and the note says which
word is false.
  On Part J and Spearman: Spearman is the right score for a model that RANKS players by points; a
minutes model predicts a binary event, for which Brier is the right score and Spearman is not
defined. So the gate is appropriate, and the objection this entry raised does not hold. What the
gate could not see is a tail: it is a mean over every scored row, and a handful of rows where the
challenger has almost no evidence is exactly what moves a transfer recommendation. Promotion now
also requires that, for every player whose incumbent probability is at the floor, the challenger
stays below an even chance.
  Measured like for like on the 26 September snapshot — and "like for like" is the correction this
entry needed, because comparing the model's raw `pModel` against the flag-adjusted incumbent invents
disagreements out of nothing: the first version of this analysis claimed a 0.000 to 0.627 jump for
Fatawu that was entirely the flag factor and not the model. Corrected, over 421 players the two
disagree by a mean of 0.104, median 0.035, p90 0.304, max 0.598. Of 138 players at the incumbent
floor the challenger's highest RAW probability is 0.497 against the 0.50 limit — it holds by 0.003,
which is close, and the engine says so rather than rounding it away. Flag-adjusted the same row is
0.305.
  So the challenger is ELIGIBLE and is NOT routed. v110 §5 B3 replaces this minutes model outright —
recent starts weighted, flags, parsed return dates and dated overrides — and the tournament
re-scores against that, so routing production through a model about to be replaced would spend a
round's worth of before-and-after on the shipped plan twice. `MINUTES_PRODUCTION_ROUTED` is a named
constant beside the reason, and flipping it means routing the xp path and putting the
before-and-after in the retest, because every recommendation in the app moves with it.
TEST: `qa/unit_engine.cjs`, three checks, 263/263 on the suite.
"LIVE-F4-driving-is-computed-from-eligibility-and-routing-not-typed" asserts
`eligible === (gate.promotable && tail.ok)`, `driving === (eligible && routed)`,
`minutesModel.driving === promotion.driving`, that the driver name follows, and that `routed` is the
named constant — so no part of the verdict can be typed.
"LIVE-F4-the-tail-condition-binds-on-the-raw-probability-of-a-thin-row" asserts there are thin rows
to check at all, that every one was scored, that the condition is exactly `max <= limit`, that the
raw maximum is at least the flag-adjusted one, and that the reported margin is the arithmetic.
"LIVE-F4-an-eligible-model-that-production-does-not-use-is-recorded-in-the-ledger" keeps the
decision tied to this entry: eligible-and-not-routed passes only while the heading stands.
"LIVE-F4-both-models-are-scored-and-the-gate-is-arithmetic" asserts
`gate.promotable === (comparable >= 3 && wins >= 3 && holdout >= 2)` at any gameweek instead of
pinning the verdict. Mutation-proven: demoting the E-087 heading turns the third check red with
"IS MISSING from ERRORS.md". The first version of that check searched for the substring "E-087",
which this entry's own body carries several times, so it could not fail — E-066's lesson, caught by
running the mutation rather than by reasoning about it. It matches the heading.

### E-088 · v89 · the Plan tab quotes a price that is typed into the markup
CAUSE: `src/ui.jsx` renders, in the "Fallback, without the chip" panel, `The written plan quotes
{money(978)} for that fifteen. Today it is {money(fbCost)}…`. The 978 is a literal: it was the
£97.8m of the v86 Part M wildcard fifteen. Every other number in that panel is computed from the
snapshot; this one is a September fact welded into the markup, and the fifteen it described has been
replaced. With the v89 plan of record the line reads "the written plan quotes £97.8m … today it is
£98.8m", which invites the manager to read a £1.0m price move that never happened: the fifteen
changed, not its price. A number with no source in shipped copy is an A2 law-1 breach whatever its
size.
CAUGHT: v89, while rewriting `data/weekly.js`. Not by any suite — the Part G copy gates count words,
measure type and touch floors and scan for hex, and none of them asks where a number came from.
RULE: a figure in the markup comes from the data or it does not appear. `data/weekly.js` now records
`classic.wildcard15_cost_written` (988 tenths on the 26 September snapshot), so the panel can read
the cost out of the plan it is describing.
STATUS: **closed in v110.** `src/ui.jsx` now reads
`money(WEEKLY.classic.wildcard15_cost_written)`, so the sentence is true for every future plan
without anyone remembering to retype it. The check passes on its first branch — the panel reads the
block — rather than on the ledger branch, which is the outcome that branch existed to reach.
TEST: `qa/unit_engine.cjs`
"LIVE-the-fallback-panel-quotes-the-written-fifteen's-own-recorded-cost" passes when the panel reads
the figure out of the block, or when the literal equals the recorded cost, or while this entry
stands. Mutation-proven: demoting the E-088 heading turns it red with "they disagree, and E-088 IS
MISSING from ERRORS.md", and setting `wildcard15_cost_written: 978` turns it green for the right
reason (they agree), which is the second thing the check is for.

### E-089 · v110 · the waiver model matched 72 of 74 because two denial reasons were checked in the wrong order
CAUSE: a waiver claim can fail two ways at once — its target has already gone to a manager ahead in
the order, AND the player it was going to drop has already left the roster on an earlier claim of
the same manager's. The game reports one reason, and it reports "already claimed" first. A model
that checks "drop already gone" first agrees with the game on every claim where only one reason
applies and disagrees on every claim where both do.
CAUGHT: v110, by replaying this league's own transaction log rather than reasoning about it. With
the order wrong the model reproduces 72 of 74 claims; with it right, 74 of 74. Two claims is the
entire signal, which is exactly why this needed a log and not a code review — a model at 97% looks
like a model that works.
RULE: the settlement order is not inferred from what seems reasonable. Every rule in `waiverSim` is
one the log forced, and the function documents which: claims settle in rounds; a manager keeps
trying their own claims, in the order lodged, until one lands; "already claimed" is checked before
"drop already gone"; nobody moves to the bottom after a success; a failed claim is consumed and not
retried.
TEST: `qa/waiver_log.cjs`, 13/13, replaying **74 of 74 claims across four gameweeks** on both the
committed snapshot and the live log pulled today, with each week's processing order read off the
log's own `index` rather than from today's `waiver_pick` — the picks move as the table moves, and
these are past weeks. Four mutations prove the fit is the rules and not luck: denial order reversed
scores 72/74, a manager rotating to the bottom after a success 73/74, one attempt per manager per
round 62/69, and the processing order reversed 52/74. A model that still scored 74 with a rule
broken would be fitting something else.

### E-090 · v89 · "at most 3 transfers this week" printed beside "FT 4"
CAUSE: `transferProtocol` computes `maxK = Math.min(FT + 1, MAX_SWAPS)` — C2 step 2 searches one to
three swaps and no more — and when there are more forced sells than slots it pushes the reason
`forced.length + " forced sells but at most " + maxK + " transfers this week; the lowest-xp forced
sells go first"`. The cap is the protocol's own search limit, not the week's. On the GW6 snapshot he
holds **four** free transfers, so the Plan tab prints "4 forced sells but at most 3 transfers this
week" directly under a header that reads "FT 4". Both statements are true about different things
and the sentence makes them look like the same thing: the manager is told he cannot do something
the rules plainly allow.
CAUGHT: v89, reading the shipped Transfers panel against the header after the state file was
corrected. No suite could see it — `smoke_wk` asserts that the reasons are shown, never that they
agree with the free-transfer count.
RULE: a message names the constraint that actually bound — but the wording was the smaller half of
this, and fixing only the wording would have been the wrong fix. The entry as first written proposed
rephrasing the reason to blame `MAX_SWAPS`. That would have made a true sentence out of a real
limitation: with four free transfers in hand the engine was structurally unable to use the fourth,
and telling the manager so more precisely is not the same as letting him do it. The rule is that a
search limit is not allowed to masquerade as a rule of the game. C2's three-swap ceiling was written
when free transfers could not exceed three; they bank to five (v110 §4), so the week's limit is
FT + 1 with one hit, capped at five, and the search reaches it.
  How, without an exhaustive search nobody can run: exhaustive stays at three, because C(15,4)
out-sets times the candidates per slot is not a search a phone finishes. Past three the search is
greedy, which is what v110 §5 B4 asks for — take the best plan so far and add the single best
further swap, and only while it pays. `weekLimit` and `searchLimit` are both reported, so the two
numbers can never be confused again.
  A second rule fell out of it. On the GW6 snapshot the five-swap plan declines the fourth forced
sell (Semenyo, status d, 75%) because two unforced upgrades pay more, and nothing on screen said so.
E-082's rule cuts both ways: selling a starter on a doubt needs the reason on screen with his name,
and so does KEEPING one. `keptForced` names every forced sell the plan does not make, with its
reason.
STATUS: **closed in v110.** Measured on the 26 September snapshot: the plan goes from 3 swaps worth
37.54 at LOW confidence to **5 swaps worth 54.01 at HIGH**, with one hit — Hughes→Gomez,
van Ewijk→Bogle, Brobbey→Emersonn, Konsa→De Cuyper, Szoboszlai→Schade — and Semenyo named as kept
despite the flag. 46 ms.
TEST: `qa/unit_engine.cjs` 266/266, three checks.
"LIVE-the-transfer-plan-reaches-the-week's-limit-not-the-search's" sweeps FT 0 to 5 and asserts
`weekLimit === min(FT + 1, 5)`, `searchLimit === min(weekLimit, 3)`, `k <= weekLimit`, that a hit is
charged for every transfer beyond the free ones, and — the part that would have failed before the
fix — that at four free transfers the plan gets past three swaps.
"LIVE-growing-a-plan-past-three-swaps-never-lowers-its-value" asserts the greedy extension is
monotone, so it cannot spend points to look busy.
"LIVE-a-forced-sell-the-plan-keeps-is-named-with-its-reason" asserts `keptForced` is exactly the
forced sells not in the plan, and that the reason reaches the copy.
`qa/smoke_wk.cjs` "ft-budget-respected" had pinned the three-swap limit itself, so a correct plan
turned it red; it reads `E.MAX_GREEDY_SWAPS` now and asserts the week's limit instead of the
search's — which is E-084's rule applied to a constant rather than to a date.

### E-091 · v110 · the privacy fix's own next commit committed 489 personal names
CAUSE: `pipeline/pull.sh` writes raw API feeds, which carry `player_first_name`,
`player_last_name`, `player_name` and league-entry `short_name` exactly as the endpoints return
them, so they must never be tracked. The ignore rule was written as `pipeline/feeds/` INSIDE
`pipeline/.gitignore` — where patterns are relative to the file's own directory, so it meant
`pipeline/pipeline/feeds/` and matched nothing at all. `git add -A` then tracked 53 feeds carrying
**489 personal-name fields** across thirteen mini-league tables, the Draft league details and two
entry feeds. One commit after closing E-085, in a commit whose own message described the feeds as
gitignored.
  Two failures, and the second is the one that matters. `qa/privacy.cjs` walked the WORKING TREE,
so `pipeline/feeds/` looked like untracked scratch to it whether it was tracked or not. A suite that
cannot tell tracked from untracked cannot check a rule about committing.
CAUGHT: by `qa/pull_guard.cjs`, on its last assertion — "and no feed is tracked", which runs
`git ls-files pipeline/feeds` — inside the full gate run, minutes after the commit. Not by review,
and not by the suite whose whole subject this is.
RULE: two rules, because one would not have caught it.
  1. "Committed" means TRACKED. `qa/privacy.cjs` takes its scope from `git ls-files`, then adds
     anything in scope on disk that is not yet tracked, so a file is checked before it is committed
     and a tracked file is checked whether or not it is still on disk.
  2. An ignore rule is proved, not read. The suite runs `git check-ignore --no-index` against a path
     under `pipeline/feeds/` and fails if git does not agree, because a pattern that looks right and
     matches nothing is the whole defect.
TEST: `qa/privacy.cjs` 25/25 — "no raw feed is tracked: they come straight off the API with names in
them" and "the ignore rule genuinely matches, proved with git rather than by reading the pattern",
alongside the existing key and initials scans. `qa/pull_guard.cjs` keeps its independent check from
the other side, so neither suite is the only thing standing between a raw feed and a commit. The
leak was removed from the branch as well as from the tree: the commit that introduced it was
rewritten before it went any further, because a name that has been pushed is not un-shipped by a
later deletion.

### E-092 · v110 · the greedy transfer extension counted from a constant instead of from the plan it was growing
CAUSE: the extension that takes a transfer plan past three swaps ran `for (gk = MAX_SWAPS + 1; gk <= weekK; gk++)`
while the plan it grows from is whatever won the exhaustive search — and that winner is often a one- or two-swap
plan, because a k-swap out-set is forced to carry min(forced, k) forced sells, and two forced sells plus one
high-gain choice can beat three forced sells. Growing a two-swap plan therefore produced three moves labelled
k = 4. Three consequences, all shipped: `moves.length !== k`; a hit charged at four points for a transfer nobody
made, because the hit is priced off the same k; and the last free transfer left unused, because the counter ran out
before the plan did. A plan whose moves disagree with its k is not a plan, it is a lie with a price on it.
CAUGHT: v110, by `qa/mc_all.cjs` I55 — 82 failures across its synthetic universes. My own first attempt to
reproduce it on the live snapshot failed and I reported that it did not reproduce there: I swept FT 0–5 against
bank 0–40 tenths in steps of ten and got 0 mismatches in 36 states. Stepping the bank by one instead finds **27 of
246 live states**, every one at a tight bank (FT 3, bank 1–9; FT 4, bank 1–9). At the shipped bank of 16 it does
not fire. A coarse sweep is not a reproduction, and "it does not reproduce on live data" was the wrong conclusion
drawn from too few samples.
RULE: two rules, and the second is the one that makes it impossible.
  1. A loop that grows a structure counts from that structure, never from the constant that bounded the previous
     stage. The step now reads `grown.moves`: the base pairs come from the moves the plan actually reports, the new
     k is one more than that count, and the loop runs while that count is below the week's limit.
  2. `evalPlan` refuses to return a plan whose moves length differs from its k. The pairing already refuses an out
     whose position has no candidate left; this is the backstop for any caller that miscounts the swaps it asked
     for, so no future caller can reintroduce the same class from outside.
TEST: `qa/mc_all.cjs` I55 and I54, and `qa/unit_engine.cjs`'s three E-090 checks — the week-limit sweep across
FT 0–5, the monotonicity of the greedy extension, and the naming of a forced sell the plan keeps. 266/266 and
`mc_full` 246/246 with 114,013 assertions. The reproduction harness drove mc_all's own universe generator at its
own seed rather than inventing one, so the failing shapes are the suite's own: u32 (gwN 8, FT 4, bank 8, three
forced sells → k=4 with 3 moves) and u63 (gwN 3, FT 5, bank 18 → k=5 with 4 moves).

### E-093 · v110 · the check that what ships was built from the sources compared clocks, not content
CAUSE: `qa/verify.sh` I8 was `find src data build.cjs -type f -newer dist/index.html`. Four faults, each measured
rather than argued:
  · mtime is not content. Append a line to `src/engine.js`, do not rebuild, then `touch dist/index.html`: the old
    form went GREEN on a page missing that line. Any `cp -p`, checkout or touch hands it a fresh clock over a stale
    artefact.
  · it over-reached. `find data` covers `data/validate_live.cjs` and `data/fetch_live.cjs`, which the build never
    reads, so touching a validator reported the shipped page as stale.
  · it under-reached. It never looked at `app/FPL_Mission_Control.jsx`, so a build that assembled the app and then
    died before writing the page read GREEN.
  · its verdict moved under its own feet — red inside a gate run, green seconds later by hand — because a second
    overlapping gate run rebuilt `dist/` in between. Both readings were true of the clock at the instant they were
    taken; neither was a reading of the artefact.
CAUGHT: v110. The flap is what drew attention, and the flap was the least of it: the mutation that matters is the
one where the old check passed a page that genuinely did not contain the code it claimed to ship.
RULE: compare content, not clocks, wherever the contract makes content comparable. CONTRACT §2 fixes the assembled
file as a verbatim concatenation, so the engine, the weekly block and the ui body must stand in
`app/FPL_Mission_Control.jsx` byte for byte, and the LIVE literal must parse to the same data as `data/live.json`.
That reads 1.1 MB against 1.1 MB in 40 ms and no clock can flatter it. `dist/index.html` is esbuild output and
cannot be compared to its input without restating build.cjs's bundler options — a second copy that would call a
fresh page stale the day those options change — so that last hop stays a clock comparison, between the two files
one build writes in a fixed order, and only the app STRICTLY newer than the page is a fault.
  Nothing is tolerated away. A red first reading is simply taken again, unchanged, four seconds later: build.cjs
writes the app 0.82–0.90 s before the page across five measured builds, so a sample taken inside another gate's
build sees the app ahead of the page or catches the 1.1 MB app half-written, while a real fault is still there
afterwards. This is not a tolerance on the gap, and the proper cure for overlapping runs is a lock in `qa/run.sh`,
which is still open.
TEST: `bash qa/verify.sh` 33/33, with the mutation that the old form could not fail: append a line to
`src/engine.js`, touch `dist/index.html`, and I8 goes red naming the byte offset where the engine diverges —
"engine differs from byte 75695 (source 334243B, shipped 330613B)".

### E-094 · v110 · two suites published a cap that was a search limit and a model count that was a photograph
CAUSE: `qa/mc_full.cjs` CAPS typed `moves: 3` and `models: 9`. `moves: 3` was `MAX_SWAPS`, the exhaustive search's
own limit, standing in for the week's limit — and free transfers bank to five, so a five-move plan is correct
(E-090). `models: 9` counted the tournament's challengers before `hier_pool` was registered as the tenth. `P29` in
mc_full and `I95` in mc_all each pinned the nine v88 model keys as a literal array, which was never an invariant
about the engine, only a photograph of one release. Two further instances of the same staleness were found in the
same files and were not yet red: `P22` asserted against `min(ft + 1, 3)`, and `CAPS.order` was `2 × 3 + 2`, the
three-swap execution list plus the captain and vice steps.
CAUGHT: v110, by the full gate: P12 12 failures, P29 12, I95 1777 of 1777 runs. A correct engine change turned
three suites red, which is the signature of the class.
RULE: E-084's rule applies to a constant exactly as it applies to a date. A published cap is a limit the engine
declares, read from the engine — `MAX_SWAPS`, `MAX_GREEDY_SWAPS`, `TOURNAMENT_MODELS.length` — never a number
retyped in a suite. Registering an eleventh challenger is then one line in the engine and no churn in the suites.
TEST: `qa/mc_full.cjs` 246/246 at 114,013 assertions and `qa/mc_all.cjs`'s I95, both reading the registry; and
`qa/no_frozen.cjs` 6/6, which is the machine-checked form of the rule. Mutation-proven by reverting one registry
read to a literal and confirming the check goes red again.

### E-096 · v110 · cross-position Draft trades were proposed
CAUSE: the trade search paired every player on my roster with every player on a rival's and scored
the swap on expected points alone. Nothing checked that the two men played the same position, so a
midfielder for a forward could top the list. A Draft squad must stay 2/5/5/3 (v110 §4, CLAUDE.md
Part N2), so the game refuses such a swap — the proposal was advice that could not be followed, and
the same hole sat in front of the claims sheet, which took solved pairs on trust.
CAUGHT: in the v109 build outside this repository, by reading the Trades panel against the rules
(spec §7.3). In the repository it is closed before it can occur: the check lands with the port.
RULE: position for position, everywhere a swap is proposed. `findTrades` in `src/mc_analysis.js`
skips any pair whose positions differ, and `buildClaimSheet` refuses a cross-position pair by name
rather than lodging it, because a claim the game will reject is worse than no claim — it burns the
slot in the processing order.
TEST: `qa/parity.cjs` E-096 — every trade is position for position and never takes from my own
roster; every claim on the sheet swaps like for like; the trade list equals the reference
implementation's pair for pair (23 trades); and a cross-position pair fed to the sheet throws an
error naming both players. Mutation-proven: with the position check removed from the trade search
the list grows from 23 to 53 pairs and two checks go red (49/51).

### E-097 · v110 · players dropped this week were labelled "sign now"
CAUSE: the "how to get him" label read only the player's ownership status. `a` meant available, so
it said "sign now" — but before the waiver run settles, every unowned player is a claim, whatever his
status says, and a player marked `l` (dropped since the last run) stays a claim even after it. A
label that ignores the phase tells the manager to do something the game will not let him do until
Friday noon.
CAUGHT: in the v109 build outside this repository, on the Free Agents table (spec §7.4). In the
repository it is closed with the port.
RULE: the label is phase-aware. `howToGet` in `src/mc_engine.js` returns "waiver" for every unowned
player while `/api/game` reports `waivers_processed == false`, and "waiver" for status `l` after
that; only an `a` player after the run is "free". `claimability` in `src/mc_analysis.js` names the
phase ("claims" or "free") beside every label so the interface cannot show one without the other.
TEST: `qa/parity.cjs` B5 — all 442 players in the reference pool are "waiver" before the run; on a
copy of the data with the run settled and one player set to `l`, the `a` player is "free" and the
`l` player is "waiver"; the reference engine agrees on every label. Mutation-proven: a phase-blind
label (`l` → "waiver", everything else → "free") calls 442 claimable players "free" and the check
goes red.

### E-099 · v110 · a wildcard week was assumed to add a free transfer
CAUSE: `ftAvailable` in `src/engine.js` replays the ledger with `if (chipWeeks[r.event] ...) { ft = Math.min(FT_CAP, ft + 1) }`:
a wildcard or free-hit week spends nothing, which E-045 fixed, but the week's arrival still lands, so the count
after a chip week reads one higher than the game's. The rule is that the count is kept exactly as it was — nothing
spent, nothing added (Fantasy Football Scout, 20 Jul 2026; v110 §4 Classic, §6, CLAUDE.md Part N1). The same
`+ 1` sits on the rows-array inference path (`freeUsed > FT_CAP`). No chip has been played on this snapshot, so no
screen has yet shown the wrong number, which is why it sat unnoticed: the defect is in the code, and only a
history with a chip in it can surface it.
CAUGHT: v110, porting the bake. The v111 kit's ledger keeps the count (`ft = chip ? ft : ...`), the A5 unit test
was written against that rule on synthetic weeks, and the "wildcard adds one" mutant the test refuses is exactly
what the engine's replay does. The bake's own `ftNext` matches `golden.classic.ftNext` either way, because the
manager has played no chip; on a chipped history the two would disagree by one.
RULE: on a wildcard or free-hit week the free-transfer count is carried forward unchanged. The cap is
`1 + game_settings.max_extra_free_transfers`, read from bootstrap and never typed. The ledger the bake ships is
`ftLedger()` in `pipeline/bake.js`, exported so the suite runs the code the bake runs; `ftAvailable()` in
`src/engine.js` still adds one on a chip week and is outside this item's files — it takes the same rule, and its
E-045 tests ("the object and the rows array agree on a chip week") must then agree on the kept count, not on the
added one.
TEST: `qa/bake.cjs` A5 — `ftNext` equals `golden.classic.ftNext` with `ftSure` true; the block's value is what the
exported `ftLedger` returns on its own weeks; five rule checks on synthetic histories (a wildcard week keeps the
count, a free-hit week likewise, an ordinary week adds one, the cap is 1 + max_extra_free_transfers, a hit week
leaves 1); and the mutation check that a ledger where the wildcard week adds one disagrees with `ftLedger` on the
wildcard history while agreeing on the plain one. Suite 42/42.

### E-100 · v110 · a 10px tab label shipped under the 11px type floor, inside a media query no gate could reach
CAUSE: `src/ui.jsx` carries `@media (max-width:380px){ .tabi{min-width:37px;font-size:10px;padding:4px 0} … }`,
written to keep seven tabs on one row on a 375px phone (the iPhone SE and mini class). The type floor is E-023's
rule (11px, CLAUDE.md Part G) and it is measured by `qa/smoke.cjs` (E023-type-floor) and `qa/webkit.js`
(G-type-floor) at a 390x844 viewport, where a max-width:380px rule never applies. The only narrower width either
suite visits is 360px, for the horizontal-scroll check, after the floor has already been measured; `qa/browser.py`
renders at 390 and 320 and measures overflow, not type. So the rule sat in the shipped file with every suite
green. A floor measured in one viewport is a statement about that viewport: E-084's class, applied to a width
instead of a date or a count.
CAUGHT: 27 September 2026, by the first run of `qa/visual.cjs` audit_layout, which reads every font-size in every
rule of every media query out of the stylesheet instead of measuring one rendering of it.
RULE: the type floor is a property of the stylesheet, not of a viewport. Every `font-size`, the size in every
`font` shorthand and every `fontSize` prop in markup, in every rule inside every media query, is at least 11px,
held by a static scan that needs no browser. The browser measurement stays as the check that the rendered page
agrees with the stylesheet, never as the only check.
TEST: `qa/visual.cjs` — "11px type floor in every rule, every media query and every markup fontSize (33
declarations)". It is RED on this tree, naming `.tabi @media (max-width:380px): font-size 10px = 10px`, and it is
left red because the fix belongs in `src/ui.jsx`, which the suite's author was not to edit. The fix is one number:
at 11px the seven tabs still fit, since the same suite computes 7×37 + 6×4 + 16 = 299px against the 360px width
the browser suites use. Proven on a copy of the source with the rule raised to 11px: the check passes and the
suite reads 42/42; on the source as it stands, 41/42.

### E-101 · v110 · the solved plan was dropped after a harmless re-bake
CAUSE: the kit's build guard once compared the plan's solve time with the block's `asOf`, so any bake after the
solve read as "solved on different data". A re-pull moves fields no optimiser reads — transfer counts, ownership,
price pressure, league ranks, the intel notes, the delta block and the clock itself — and the guard threw away a
plan that was still the optimal plan for the block being shipped. It is E-093's fault in the solver's clothes: a
clock says when, never what. The port measured the boundary rather than describing it: on the 26 Sep feeds the
kit's data.json and this repository's bake differ in 1,156 player-level fields (`tin`, `tout`, `press`, `own`),
the league ranks, `asOf` and `delta`, and the solver input hashes the same for both once the one real input
difference — the kit's `model.calib` block, which `CAL` applies to every points component — is removed.
CAUGHT: v110 spec §7.7, the kit's own record, confirmed while porting `app/export.js`: the reference solver input's
hash recomputes from its own payload with the clock fields left out, which is only true of a content hash.
RULE: the guard is a content hash. `pipeline/export.js` writes `hash` = the first 16 hex characters of the sha1 of
the JSON of the solver payload {next, gws, cEnd, dEnd, classic, draft, players}, exactly as the kit computes it,
and the two clock fields `at` and `dataAsOf` sit outside it. A solved plan ships only when its hash equals
`buildInput(DATA, M).hash` on the block being shipped. A re-bake that changes no input keeps the hash; a price, a
status or flag, a start override, a fixture, a calibration block or a squad change drops it. No stage compares
clocks to decide whether a plan is current, and the shipped `data/solver_in.json` must be the export of the
committed `data/mc_data.json`, so a re-bake that changes an input is followed by `npm run export` or the gate says so.
TEST: `qa/export_hash.cjs` 36/36 in 5.2 s — the export reproduces `reference/v109/app/solver_in.json` path for
path with the same hash (`dde282bdf39bd757`, from the ported engine and from the reference engine run in the same
process); the hash recomputes from the file's own payload; it is kept under a changed asOf, delta, intel.notes and
every player's transfer counts, ownership and price pressure, and moved by one price (0.1), one status, one start
override's probability and one fixture's home side; the shipped input is the export of the committed block.
Written first and run red (2/3, `Cannot find module pipeline/export.js`). File-level mutations, each restored byte
for byte and each 31/36: three-decimal rounding cut to two names `$.players[0].ep[1] ref 4.088 got 4.09`; the hash
cut to 15 hex is red with the payload path-equal; `did` dropped from the player row names
`$.players[0].did missing from the export`.

### E-108 · v110 · the Draft horizon was assumed to end at GW18 while the league re-drafts at GW21
CAUSE: the v107–v109 kit planned the Draft roster to a typed horizon of GW18. The league's own settings,
`/api/league/{id}/details` → `league.drafts`, carry an unfinished draft whose `event` is 21: the new rosters start
in GW21, so the last gameweek the current roster plays is GW20. Two gameweeks of expected points were left out of
every Draft valuation, and a plan that stops at the wrong week does not fail — it looks finished. A number the feed
carries was typed instead of read, which is E-084's class applied to a league setting rather than to a date.
CAUGHT: in the v109 build outside this repository (v110 spec §7.12); the spec's ground truth lists the re-draft on
5 Jan 2027, effective GW21, so the Draft plans to GW20. In the repository it is closed with the port:
`pipeline/bake.js` reads `league.drafts` into `draft.league.drafts[]` and `redraft` (the unfinished one), the
engine's `CFG.draftEnd` and the export's `dEnd` are `redraft.fromGw − 1`, and CLAUDE.md Part N2 carries the rule
without the number.
RULE: the Draft horizon is read from `league.drafts`, never typed. The unfinished draft's `event` is the first
gameweek of the new rosters; the horizon is that gameweek minus one. No file in the repository states the horizon as
a number, and no test compares it to one.
TEST: `qa/bake.cjs` A7 §7.12 — three checks: the reference bake's `redraft.fromGw` is the unfinished draft's `event`
read from `d_details.json`, with one `drafts[]` row per draft; the repository block's redraft is its own unfinished
draft and its horizon starts after the next gameweek; and the mutation — the unfinished draft moved one gameweek
later in a copy of the feed moves the block's horizon with it (read, not typed). `qa/export_hash.cjs` — `dEnd` is
`redraft.fromGw − 1` on the reference export and on the export of the committed block.

### E-109 · v110 · the TDZ checker read a loop variable reused across two for-headers as a same-scope TDZ (recurrence of E-013's class)
CAUSE: `collectDecls` in `qa/tdz_check.cjs` gave every `const`/`let` the scope of the nearest enclosing brace. A
declaration in a for-header — `for (let i = 0; …)`, `for (const x of …)` — sits inside parentheses, not braces, so it
was attributed to the function body around it, and a second loop in the same function that reused the name read as
"i read before its let declaration": the first loop's use of its own variable, charged against the second loop's
declaration. JavaScript scopes a for-header declaration to its loop; two loops are two bindings, and no TDZ exists.
CAUGHT: 27 September 2026, porting the v111 kit engine to `src/mc_engine.js`. `node qa/tdz_check.cjs
/home/claude/app/engine.js` reported four findings on clean code — `lh` and `la` in `fitRates` (the coarse grid and
the polish grid, lines 69–70) and `i` twice in the formation loop (line 166) — and the port renamed the polish loop's
counters to `ph`/`pa` and the formation loop's to `j`/`k` to get past the gate. A gate that is satisfied by a rename
has checked the rename, not the code (E-013: false positives for a session; E-075: the same class on a comment).
RULE: a for-header declaration is scoped to its loop. `forHeaderOf` in `qa/tdz_check.cjs` recognises a declaration
whose keyword follows `for (` or `for await (`, opens its scope at the header's parenthesis, and records the loop's
range (header and body, braced or a single statement); the same-scope scan skips a read that sits inside a loop whose
own header binds that name. Nothing else moved: a header that reads a const declared after the loop is still a
finding, as is a plain read before a declaration beside two loops, and the nested-body and dynamic passes are
untouched.
TEST: `node qa/tdz_check.cjs --self-test` 10/10 — four new control files: the kit's shape (a counter reused across
two for-headers, braced and unbraced, and a nested pair reusing two names) is clean; a const declared after a loop
that used the same name is clean; a for-header that reads a const declared after the loop is still found; a plain
same-scope read beside two loops is still found. The checker as it stood before the fix reports 4 findings on the
first two of those files. `node qa/tdz_check.cjs /home/claude/app/engine.js` (the kit, unrenamed) now reads TDZ
CLEAN; `src/engine.js`, `src/ui.jsx`, `src/mc_engine.js`, `src/mc_analysis.js` and `app/FPL_Mission_Control.jsx`
stay CLEAN; a control file with a genuine same-scope TDZ still fails with two findings (static and dynamic).

### E-102 · v110 · the free-transfer count showed lower than real after a wildcard week
CAUSE: the optimiser's free-transfer variables are upper bounds, not a ledger. In `classic()` the row
`used[t] <= ft[t]` and the carry rows `ft[t+1] <= ft[t] - used[t] + 1` and `ft[t+1] <= ft[t] + 5·wc[t]` let the
solver pick ANY `ft` at or below the true count wherever a lower value costs nothing — and after a wildcard week,
where nothing is spent, it often does. Read off the solution, the count after the wildcard came out one or two
below what the game would show; the plan's moves were legal, the number beside them was not (spec §7.1).
CAUGHT: v110, porting the optimiser. The reference's own `classic()` already rebuilds `ftBefore`, `used`, `hits`
and `bank` after the solve, and the port keeps that; the port then adds a second, independent replay outside the
solver so the interface never depends on a solver field at all.
RULE: replay the ledger from the rules of the game (CLAUDE.md Part N1; v110 §4 Classic) and display only the
replay. `pipeline/plan.cjs` recomputes, week by week from `data/mc_data.json`'s own state: free transfers before
the week (one added per ordinary week; a wildcard or free-hit week keeps the count exactly as it was, nothing
spent and nothing added; cap `1 + max_extra_free_transfers` as `rules.maxFt` carries it; floor 1), transfers used
= |in|, hits = 4 × max(0, used − free) and only once every free transfer is used, and the bank from selling prices
for the original fifteen and purchase prices for anyone bought inside the window. It writes the result as
`replay` in `data/plan.json`, which is the block the interface reads (§6); the solver's `ftBefore`, `used`, `hits`
and `bank` stay in the file for comparison only. If the replay disagrees with the solver's fields anywhere,
`plan.cjs` prints the gameweek and both values and exits 2, so the stage goes red rather than shipping a number
the rules do not give.
TEST: `qa/plan_legality.cjs` — its own third replay of the same rules must agree with the solver's fields on every
week ("free transfers" and "hits" in the per-week checks) and with `plan.json`'s replay block week for week ("the
plan's replay block agrees with this suite's own replay of the rules"). On the reference plan: 14 weeks, 14 rules
each, 49/49. Mutation-proven twice: a solver `hits` moved by one goes red on 'hits'; and a copy of `plan.cjs` in
which a wildcard week ADDS a free transfer (E-099's mutant) exits 2 naming GW7, GW8 and GW9 (`ftBefore: replay 5
· solver 4`), and the file it wrote is refused by the suite at 48/49 with `agrees is false`.

### E-103 · v110 · a background solve died silently
CAUSE: a full solve takes about ten minutes and was started as a background job from a shell call; the job is
killed when the call that started it ends, and a run that wrote its output only at the end left nothing behind
(spec §7.2). The reference's `solve.py` already saves after every stage; what was missing in the port was the
proof that it does, and a launcher that survives the shell.
CAUGHT: v110, porting the optimiser. The v111 kit's own `solve.log` shows every stage line, which is the record
§7.2 asks for; the port keeps that and adds an observed check.
RULE: start a full run detached — `setsid nohup python3 pipeline/solve.py 240 > solve.log 2>&1 &` — and write the
output as soon as each stage finishes. `pipeline/solve.py` dumps `data/solver_out.json` after the plan, after the
no-wildcard plan, after the free-hit pricing, after each Draft roster and after the optional sensitivity, each
write to a temporary file moved into place so a reader never sees a half-written stage; `chip_timing()` writes the
timing file after each of now, later and never. `done: true` lands only at the end, and `pipeline/plan.cjs`
refuses (exit 3) a file without it, so a partial run is inspectable but never shipped.
TEST: `qa/solver_smoke.sh` watches the output path while a 30-second solve runs and asserts the file appeared
BEFORE the run ended, carrying the plan stage and no `done` flag: on the dev machine it was first seen 22.6 s
before the end with keys `at,hash,plan` (and 14.6 s before the end on the 20-second run that found no incumbent, the
file still carrying the failed plan stage). The stage lines are echoed into the gate log as the run log §7.2 names.
`qa/plan_legality.cjs` refuses a plan whose source lacks `done` through `plan.cjs`'s exit 3 (proved: a copy of the
reference output with `done` removed is refused and nothing is written).

### E-104 · v110 · the all-binary optimiser stalled at a 24.6% gap
CAUSE: the first formulation made every decision binary — squad membership, the eleven, the captain, the triple
captain, the bench boost, buy and sell — and HiGHS could not close the bound: 24.6% after the full time limit
(spec §7.9). A plan with a gap that wide is a guess with a solver attached.
CAUGHT: v109, outside this repository; recorded here with the port so the formulation is never "tidied" back.
RULE: only squad membership is integer. Given a whole-number squad, the eleven, the armband and the buy/sell
flows form a totally unimodular constraint system, so the linear relaxation is integral and the optimum comes out
whole on its own; the models in `pipeline/solve.py` (class Model, classic, one_week_best, draft) are byte for
byte `reference/v109/app/solve.py`'s and carry the comment at the line that does it. On the reference input the
proof closes at gap 0.01297 in 240 s. The gap is checked, never assumed: a committed plan must carry `gap` under
0.03, and the 30-second smoke skips that check by an explicit flag and says so, because a short solve is asked to
be legal, not to prove its gap.
TEST: `qa/plan_legality.cjs` — "the plan is proven close to the best possible (gap under 0.03, §7.9)" on the
committed plan, and "C2 the proven gap is the one golden records" on the reference plan (0.012967284891281062,
equal to `golden.classic.plan.gap`); and "pipeline/solve.py's model functions … are byte-identical to
reference/v109/app/solve.py's", which went red (48/49) when one byte of `classic()`'s signature was changed and
green again after a sha1-verified restore. `qa/solver_smoke.sh` runs the same formulation in 30 s and reports the
gap it saw beside the SKIP line.

### E-105 · v110 · the solver sold Haaland on the wildcard and bought him back
CAUSE: nothing in the first model forbade selling a player in one week and buying him back later in the window.
Prices move and the plan is one the manager is meant to follow; a sell-then-rebuy is a move nobody makes, and it
also lets the model bank a phantom free transfer by churning (spec §7.10).
CAUGHT: v109, reading the wildcard change list against the later weeks; carried into this repository as a rule
the plan must pass every time it is built.
RULE: no rebuy inside the window. `classic(no_rebuy=True)` adds `SO[i,t1] + BI[i,t2] <= 1` for every player and
every t1 < t2 in the detailed window, and the legality suite checks the shipped plan independently: a player who
appears in any week's `out` may not appear in a later week's `in`.
TEST: `qa/plan_legality.cjs` — "no rebuy" in every week's checks on `data/plan.json` (and on
`data/plan_reference.json` until the solve stage lands). Mutation-proven on a copy of the reference plan: Gabriel,
sold in GW6, bought back in GW7 for Thomas goes red on 'no rebuy: bought back after being sold inside the window:
Gabriel', and the same break trips the bank and the free-transfer replay downstream (39/49).


### E-106 · v110 · the golden acceptance held a re-solve to a time-limited incumbent's bench-boost week, fifteen, total and gap
CAUSE: `golden.classic.plan` was recorded from a 240-second solve that stopped on the clock at a 1.3% gap (HiGHS
status 13), and the acceptance in `qa/plan_legality.cjs` compared a fresh solve to that file exactly: its chip weeks
and captains, its GW6 fifteen, its total to 0.05 and its gap to 1e-6. The spec says the solve is time-limited and
asks for tolerance (§5 C acceptance: total 878 ± 2%, wildcard GW6, triple captain GW7, no hits). On an idle core
the same model on the same input proves optimal within 0.5% (status 7) in 265.5 s: objective 661.74 against the
incumbent's 658.74, total 882.72 against 878.28 (+0.51%), the bench boost in GW9 with Haaland where the incumbent
boosts in GW10 with Saka, Affengruber and Janelt where it holds Diop and Stach. The 240-second run on this machine
gave 874.35 at a 1.65% gap and the same GW9 bench boost. An exact match of a recorded incumbent is a property of
that file, not of the optimiser, and a proven solve that beats the incumbent cannot reproduce it.
CAUGHT: v110 solve stage, 27 Sep 2026, running the C acceptance on the reference input twice (240 s, then 480 s
as the retry allows). Both inside 2% on the total, both with the wildcard and triple-captain weeks and captains,
both without hits, both reproducing the Draft roster exactly; both red on the same five checks (44/49).
RULE: a re-solve is accepted at the spec's tolerance — total within 2%, the wildcard and triple-captain weeks and
captains, no hits, the Draft roster — and its gap is required to be under 3%, never equal to another run's. Exact
reproduction of a recorded output (its fifteen, its bench-boost week, its total to 0.05, its gap) is proved by
running that output through `pipeline/plan.cjs`, not by re-solving; `reference/v109` is read-only, so the recorded
incumbent stays what it is and the acceptance carries the tolerance.
TEST: `node qa/plan_legality.cjs --plan=data/plan_reference.json --data=reference/v109/app/data.json
--golden=reference/v109/app/golden.json` on the proven re-solve: 44/49, red on 'C1 the chip weeks and their
captains', 'C1 the first week's squad', 'C1 the hit count … reproduce the golden total' (882.74 vs 878.28), 'C2 the
proven gap is the one golden records' (0.004996 vs 0.012967) and 'C4 wildcard timing' (now 882.72 vs 878.28); green
on every legality rule, the replay, the gap under 0.03 and the Draft roster. The step stays red in `qa/run.sh` and
`gate.yml` until the acceptance encodes the rule above; `pipeline/logs/ref_solve.log` and
`pipeline/logs/ref_solve_480.log` carry the two runs stage by stage.

### E-107 · v110 · two source fixes were committed while the shipped page still carried the defects they fixed
CAUSE: commits 3e1838b (E-099, `ftAvailable` in `src/engine.js`) and 1935890 (E-100, the 11px tab label in `src/ui.jsx`)
changed the sources and not the build outputs. The last commit that wrote `app/FPL_Mission_Control.jsx` was 4f0606a
(26 Sep), so at HEAD the assembled app and `dist/index.html` still added a free transfer on a wildcard week and still
set `.tabi` to 10px under the narrow media query — the two defects the commit messages said were closed. Nothing
reported it, because the gate builds at step 3 and verify.sh's I8, the content comparison of the app against the
sources, runs at step 17: by then the build has replaced the stale file, and I8 reads the regeneration, not the
commit. A check that runs after the thing it checks has been rebuilt cannot fail on a stale commit.
CAUGHT: 27 Sep 2026, the adversarial review's single gate run. `git status` after step 3 showed
`app/FPL_Mission_Control.jsx`, `dist/index.html` and `dist/sw.js` modified — 7 insertions, 9 deletions: the two
source edits and the service worker's content-hash cache key — on a tree that had been clean apart from the solve
stage's files. `git log -1 -- app/FPL_Mission_Control.jsx` named 4f0606a.
RULE: a commit that changes `src/`, `data/weekly.js`, `data/live.json` or `build.cjs` carries the rebuilt `app/` and
`dist/` in the same commit, and its proving number is measured on that build (CLAUDE.md H3: bump → build → suites →
commit). The gate must be able to see a stale commit: the committed app is compared with a fresh build BEFORE the
build step overwrites it, as a step ahead of step 3 in `qa/run.sh` and `gate.yml`, or I8 moves ahead of the build.
TEST: this session's measurement — `node build.cjs` on HEAD (a17a5dc) changes three tracked files, and `git diff`
on the rebuilt app shows the E-099 `return;` and the `font-size:11px` rule. The pre-build comparison is not yet
written; until it lands, the rebuilt `app/` and `dist/` ship with this wave's commits and the rule is held by the
commit discipline above, which is a weaker guard than a check and is named as such.

### E-110 · v110 · a suite typed the number of Draft claims (six) where it should read the block's own length (recurrence of E-084's class, after E-094 and E-106)
CAUSE: `qa/smoke_wk.cjs` checked the written Draft claims with `claims.length === 6` in two places and wrote "all
twelve codes" into a detail line. Six was how many claims the v89 block happened to carry; the v110 claim sheet lodges
thirteen, every one with a backup under its first choice. The first honest refresh would have turned two checks red
for writing better advice, and the detail line would have printed a wrong count while green.
CAUGHT: 27 Sep 2026, reading the suite before writing the v110 weekly block, alongside the E-106 correction.
RULE: a suite reads counts of decisions from the thing it checks. The E-084 test applies to every literal in a check:
could the next honest run change this number? If yes, derive it (`claims.length >= 1`, `2 * claims.length` codes) and
let the content checks (every code resolves on both sides, every claim valid against the live Draft API) carry the
weight. E-106 closes on the same day: `qa/plan_legality.cjs`'s acceptance is the spec's (total within 2%, wildcard and
triple-captain weeks and captains, one bench boost, no hits, gap under 3%, timing within 2%, Draft pairs) plus an
objective at least the recorded incumbent's, read from `reference/v109/app/solver_out.json`.
TEST: `node qa/plan_legality.cjs --plan=data/plan_reference.json --data=reference/v109/app/data.json
--golden=reference/v109/app/golden.json` 55/55, six new mutations each red on its named check; the smoke suite's two
claim checks read the block's own length and its detail prints the derived code count.

### E-111 · v110 · selling prices read off a Transfers screenshot went stale within days (spec §7.13)
CAUSE: the selling prices that fund a wildcard were taken from a screenshot of the manager's Transfers page. A
screenshot is a photograph of one moment: prices move after every deadline, and the half-of-any-rise rule means a
rise changes what a player sells for, so the numbers were wrong within days while still looking exact to the tenth.
CAUGHT: v108–v109, outside this repository, as the v110 spec records it (§7.13); logged with the port so the
screenshot never returns as a source. In this repository the v89 Draft path had the same habit for rosters
(CLAUDE.md: the Draft API "replaces screenshot ingestion").
RULE: compute the selling price from the rule of the game on every bake: the price paid plus half of any rise,
rounded down to £0.1m, a fall taken in full; the price paid is `now_cost − cost_change_start` for the original
fifteen and `element_in_cost` from `/api/entry/{id}/transfers/` for anyone bought since. A screenshot may confirm a
number once; it never supplies one (CLAUDE.md Part N; spec §6 forbids screenshot selling prices for display).
TEST: `qa/prices.cjs` 12/12 — the fifteen against the reference's recorded numbers, a synthetic buy after a rise
where the transfer log must win over the start price, the half-rise arithmetic at every boundary, and each of the
four arithmetic rules broken in turn (the price paid ignored leaves 3 of 15 wrong).

### E-125 · v110 · the live validator pinned the Draft league id to null after the manager had supplied it (E-084's class)
CAUSE: `data/validate_live.cjs` asserted "draft league_id null in the shipped snapshot" because, when it was
written, the manager's league id was unknown and inventing one would have been a ledger offence. On 27 Sep the
Draft ground truth landed (commit ade4ca4: `state/kwezi.json` gained league 46148 and entry 279275), but
`data/live.json` was not re-fetched, and the check kept passing on a snapshot that no longer agreed with the state
it was supposed to reflect. It could not see the disagreement because it compared the snapshot with a remembered
fact rather than with the file that holds the fact.
CAUGHT: 27 Sep 2026, the refresh: `npm run fetch` read the saved league from the state and wrote it into the
snapshot (8 teams, 547 free agents, the manager's entry found by entry id), and the validator went red 86/87 on
the first honest snapshot since the league was supplied.
RULE: a check on a value the manager supplies reads it from where he supplied it. The shipped snapshot's league id
must equal `state/kwezi.json` `draft.league_id` (null while there is none), and when a league is present the
manager's own entry must be found in it by the entry id he supplied. Nothing is invented and nothing is pinned.
TEST: `node data/validate_live.cjs` 88/88 on today's snapshot; the 26 Sep snapshot (league_id null) now goes red
on both new checks (85/87: "null vs state 46148", "null vs state entry 279275").
THE SAME PHOTOGRAPH IN FOUR MORE PLACES, found by running the suites on the first snapshot with the league in it:
`qa/verify.sh` I15 required `league_id === null` (now: equal to the state's, the league present and his entry found
when there is one, every field empty when there is none); `qa/unit_engine.cjs` built its "without a league" context
from the shipped snapshot (two reds: hasPool true "without a league"), now built explicitly from the fetcher's own
`emptyDraftLeague()` with the state's ids cleared; `qa/smoke_wk.cjs` check 36 rendered the shipped app and demanded
the "pool unknown" notice (now it branches on the state: without a league the notice and assumed claims, with one
the league's own free-agent count on screen, no unknown-pool notice and every engine claim labelled api); and
`qa/components.cjs` rendered TabDraft's no-league branch only because the shipped snapshot happened to have no
league (`rev-df-eng` missing, 132/133), now a constructed no-league variant renders it every time. After the fixes:
verify 33/33, unit_engine 266/266, smoke_wk 37/37, components 135/135. A no-league path that only exists because
of today's data is untested the day the data changes; every suite now builds the case it means to test.

### E-126 · v110 · the Draft claims check measured gains over five gameweeks while the law plans the Draft game to GW20, and a flagged player reached the claims sheet
CAUSE: two things surfaced together when `pipeline/weekly.cjs` first wrote the v110 claims sheet into the weekly
block. (1) `qa/smoke_wk.cjs` check 28 accepted a written claim only if it was forced or a gain under
`src/engine.js` `draftEV`, whose EV is xp5 × P(start) — five gameweeks (CLAUDE.md C5). v110 law §1.2 fixes the
Draft objective to the re-draft, GW20, read from `league.drafts` (§7.12), and the claims sheet (§5 B7, parity 13/13
lines against golden) ranks claims to that horizon. On 26 Sep's block the five-week view called seven of thirteen
sheet lines "no gain" — Hill for Bogle −8.91, Mainoo for Janelt −11.28 — every one a positive gain to GW20 under the
engine that ranks them. The check was measuring the wrong horizon, and would have failed every sheet the spec asks
for. (2) The Draft solve's pairs included Mainoo (status d, 75%), and the sheet's backup search could pick him again
once removed as a first choice: nothing between the solver and the page applied CLAUDE.md D2 ("any flag → the
recommendation touching that player is re-evaluated before anything else"), which check 28 enforces as status "a".
CAUGHT: 27 Sep 2026, the first dry run of `pipeline/weekly.cjs` on the 26 Sep block and plan (hash
d812652812be50a7): eight conflicts printed, seven of them the horizon, one the flag.
RULE: a check on a decision uses the horizon the law gives that decision. Check 28 now measures the gain with
`src/mc_engine.js` from the next gameweek to the Draft horizon, still requires every incoming player to be status
"a", still names every shortfall on screen, and prints the five-week engine's disagreements rather than hiding them.
It gained two guards the old check never had: the written claims must be the claims sheet line for line, and the
weekly block, the plan and the baked data must share one content hash, so a stale block is red instead of audited.
Flags are handled before the sheet is built: `buildClaimSheet(…, { fitOnly: true })` holds a flagged player back as
first choice and as backup and returns him in `held` with his status; the default path is unchanged, so parity stays
51/51. `data/weekly.js` and `data/pre.json` make the same call, so the two sheets cannot differ. The fallback path gets
the same discipline: the optimiser's no-wildcard week is written only when it passes every hard rule the app
enforces on a written fallback (the Konsa rule, two incoming per club, buys fit and starting, captain and vice in the
app's eleven, bank not negative), otherwise the app's rule-bound C2 protocol is written and the block says why.
TEST: `node qa/smoke_wk.cjs` check 28 on the written block; `node qa/parity.cjs` 51/51 with fitOnly added; the 26 Sep
dry run: twelve claims, Mainoo held back ("d 75%"), zero conflicts, and the fallback switched to the C2 protocol
because the optimiser's no-wildcard week sold Shaw, whom the Konsa rule protects.

### E-123 · v110 · the suites' top-level-function scanners read the ported engine's inner functions as module scope
CAUSE: `qa/mc_full.cjs` and `qa/components.cjs` find "every top-level function" in the assembled file with one
regex, `^(?:export\s+default\s+)?function\s+NAME\s*\(` on multiline source — column 0, not scope. The D0
integration ships `src/mc_engine.js` verbatim (CONTRACT §2 item 3), and the kit writes its UMD factory's inner
functions at column 0: `clamp`, `poisPmf`, `poisTail`, `expFloorDiv`, `mulberry`, `rPois`, `rBinom`, `rNorm`,
`quantile`, `create`. In the assembled file they sit inside the wrapper function and the factory, so they are not
in module scope, and the source may not be re-indented because verify.sh I8 holds it byte for byte. mc_full asserts
that every extracted name is a function in the evaluated module ("mc_full-no-extracted-name-is-missing-from-the-
evaluated-scope") and then fuzzes each one; eight of the ten are nowhere at module scope (`clamp` and `quantile` are
found only because `src/engine.js` declares its own), so the suite would have gone red on an app that is correct,
and would have fuzzed `null`.
CAUGHT: 27 Sep 2026, D0 integration, before any gate run: a replica of mc_full's extraction and evaluation on the
first assembled file listed 259 names with 8 missing from module scope; with the MC ENGINE block left out of the
scan, 249 names and 0 missing. mc_full itself was not run by the integration agent (the orchestrator runs it).
RULE: a scan for top-level declarations is a scan of top-level code. Both scanners now blank the `// MC ENGINE —
START` … `END` block (one wrapper, verbatim source, no module-scope declarations by construction) before they
extract names; nothing else about either suite changed. A future block that ships a module inside a wrapper is
added to the same exclusion, never re-indented to dodge the regex.
TEST: `qa/components.cjs` 153/153 on the integrated file; mc_full's extraction reproduced out of the suite (249
names, 0 missing); the orchestrator's `qa/mc_full.cjs` run is the gate.

### E-116 · v110 · the Odds tab would have named a price the manager typed as a bookmaker's goal and clean-sheet price
CAUSE: the ported engine tags a match's goals by where they came from — `lambdas(...).src` is "odds" for a baked
match price (the INTEL row carries `from: "odds"`), "market" for anything else in its MARKET table, "model" otherwise.
A price the manager adds on the Odds tab reaches that table through `setMarket` as `{ xg }` with no `from`, so the
engine tags it "market", the same tag as the baked goal and clean-sheet anchors. The kit's vOdds (ui.js 320–332, the
executable spec for this tab's copy) maps "market" to "bookmaker goal and clean-sheet prices", so a straight port
names a match price the manager typed himself as a goal or clean-sheet price from a bookmaker. That is one wrong
label next to a number he is about to act on, and the "your price is active" note depends on the same knowledge.
CAUGHT: 27 Sep 2026, building D4, before any build: tracing an override through `setMarket` and `lambdas` while
writing the round trip in qa/mc_render.cjs.
RULE: provenance comes from the store that holds it. A match either of whose sides carries a price in
`ctx.state.market` is labelled "bookmaker match prices, added by you", whatever the engine's tag (`mcOddsRows` in
src/mc_ui.jsx). The engine's tag decides only for the baked prices. The engine is not changed: `src/mc_engine.js`
ships byte for byte (verify.sh I8).
TEST: `qa/mc_render.cjs` "trip-first-paint-names-the-price-as-yours-and-shows-its-goals". The apply button's own
onClick writes both sides through an App-equivalent `on.market`, and the next first paint must carry that label.
Mutation: labelling from the engine's tag alone (`const src = L.src`) → 64/65, red on that check.

### E-117 · v110 · the kit's Review copy carried two Draft league facts as prose
CAUSE: the kit's vReview (ui.js 333–356) is the executable spec for the Review tab's copy, and it writes two facts
about the Draft table as fixed words. The no-win note says points scored "sits in the bottom two of the league". The
bench note says "In a head-to-head league decided by two points twice already, that is the whole season". Both were
true of the table the day they were written, and neither is derived from it. Ported verbatim, both go false the
first week the table moves. This is the class spec §1.7, §6 and §7.6 forbid ("seven points off the lead" when the
gap was eight), and E-084 / E-094 caught the same class in tests.
CAUGHT: 27 Sep 2026, building D5, reading vReview line by line before porting its copy.
RULE: a league fact in copy is computed at render time or it is not written. The no-win note quotes the manager's
points scored and their rank among the league's points-for, both read from `MC.draft.standings`. The bench note
counts the losses by `MC_UI_CFG.closeLoss` points or fewer from the review rows. The threshold is a definition, stated
as a number, not a fact about the season. The free-transfer bank the Classic note quotes is `PLAN.replay`'s
`ftBefore` for the next gameweek, never the solver's field or the bake's.
TEST: `qa/mc_render.cjs` "review-league-facts-in-the-notes-are-computed-from-the-table-(E-117)" asks for the notes
with the conditions forced, then again on a table where the manager's points-for is moved to the top; the quoted
rank must follow (rank 7 of 8, then 1 of 8). "review-the-free-transfer-bank-quoted-is-PLAN.replay's-and-follows-it"
moves the replay's bank and the note must follow. Mutations: the kit's "bottom two" prose → 64/65; the bank read from
`MC.classic.ftNext` → 64/65. Each is red on its own check.

### E-112 · v110 · two suites read the plan tab's old primary section as if it were always open
CAUSE: v110 §5 D2 makes the solved Classic plan (`plan-solved`) the plan tab's PRIMARY, so Transfers (`plan-tx`) is
closed on first paint. Two suites assumed the old primary. `qa/smoke.cjs` typed its own copy of PRIMARY with
`plan: "plan-tx"`. `qa/smoke_wk.cjs` read `plan-tx`'s innerText straight after opening the tab, without opening the
section. A closed Section renders no body, so the check "sells … are unavailable and say so" then read only the
title. It went red on a panel that does name the status once opened. A suite that reads a section's text without
opening it is testing the open/closed state, not the copy.
CAUGHT: 27 Sep 2026, building D2. The pre-migration `qa/smoke_wk.cjs`, run against the new build in a scratch copy
of the tree, gave 36/37: "Brobbey is sold on a status of d and the panel does not say so". The migrated check gives
37/37 on the same build.
RULE: a suite that reads a section's text opens it first and waits for its body to show. It never relies on which
section is PRIMARY. A suite that pins PRIMARY changes with the app's table in the same change.
`qa/components.cjs` already reads PRIMARY out of the assembled file.
TEST: `qa/smoke_wk.cjs` 37/37. It clicks `sec-plan-tx` when that section is closed, then waits for
`[data-section="plan-tx"] .sec-b` to show text. Only then does it read the panel, so a panel that never opens
times out instead of passing empty. `qa/smoke.cjs` 62/62 with `plan: "plan-solved"`, "every tab first paint opens
exactly its PRIMARY". `qa/components.cjs` "D2-first-paint-opens-the-solved-plan-first-and-leaves-transfers-closed-…".

### E-118 · v110 · the Command and Plan tabs show Classic figures with no game named in the row, its section or its tab (§1.1, Part N3)
CAUSE: v110 §1.1 and Part N3 say every number the app shows is labelled with its game. The repo's own stat rows
predate that law. The Command tab's first section, "Where the season stands" (`cmd-stand`, open at first paint on the
first tab), lists overall rank, season points, the last gameweek's points, points left on the bench and squad value.
All five are Classic, and neither the rows, the section title nor the tab ("Now") names the game. "What the engine
checked" (`cmd-checks`) adds two more, flags on the fifteen and free transfers. The Plan tab's older sections
(`plan-tx`, `plan-wc`, `plan-opts`, `plan-xi`, `plan-time`, `plan-fb`) carry sixteen more rows the same way. The
port's own panels are labelled: the solved-plan strip sits under a Classic tag, and every Draft figure sits on the
tab named Draft. No figure is summed or compared across the games, so no number is wrong. But both games score
"points", and a manager reading the first tab cannot tell from the page which game a number belongs to. That is
the confusion the law exists to prevent.
CAUGHT: 27 Sep 2026, porting the kit's separation group (qa.js 89–93 and 273) as `qa/mc_separation.cjs`. The suite
resolves each stat row's game from its own text, the nearest heading above it inside its section, a `data-game`
attribute, or the tab it sits on. Five rows at first paint and 23 with everything open resolve to no game. Every
strip stat resolves to exactly one.
RULE: a stat row or strip cell names its game in its own text, in a heading above it inside its section, or
through the tab it sits on. It is never left to the reader to infer. A section that shows one game's figures
carries a Classic or Draft tag in its first line, as `plan-solved` does.
TEST: `qa/mc_separation.cjs` "every strip stat on the … is labelled with exactly one game" is armed on the landing
card and the Command, Plan and Draft tabs, at first paint and with everything open. Its mutation, the Plan strip
without its tag, goes red. The row count is printed by "no stat row or strip cell names both games at once (… 5 at
first paint, 23 with everything open — ERRORS.md E-118)", but it does not fail the suite yet. The fix is in
`src/ui.jsx` (TabCommand's `cmd-stand` and `cmd-checks`, and TabPlan's older sections), which the E1 item may not
edit. Open. Once each of those sections carries a Classic tag in its first line, the count reaches zero and the
check is armed as `unlabelled.first === 0 && unlabelled.open === 0`.

### E-113 · v110 · smoke_wk read the Draft tab's old primary, and the free-agent panel's first rows by index, as if neither could move (recurrence of E-112's class)
CAUSE: v110 §5 D3 makes the Draft claims sheet (`df-claims`) the draft tab's PRIMARY, so the app's own claim search
(`df-waivers`, now titled "Quick check: the app's own claim search") is closed on first paint. `qa/smoke_wk.cjs`
waited twice for "waivers process" in `df-waivers` straight after opening the tab, without opening the section, and a
closed Section renders no body. The same change puts the ported engine's ranking to the Draft horizon first in the
free-agent panel, with the phase-aware "how to get him", and keeps the app's own five-week rows behind the
`df-pool-app` reveal (§1.4: the proven answer shows, the repo's stays as a labelled Reveal). Check 34 read every
`.row` in `df-pool` by position, so the first twelve rows it compared would have been the new ranking's. E-112 wrote
the rule ("a suite that reads a section's text opens it first") and applied it to the plan tab only; the two Draft
reads in the same file still relied on which section is PRIMARY.
CAUGHT: 27 Sep 2026, building D3. The unmigrated `qa/smoke_wk.cjs`, run from a temporary copy against the new build,
gave 29/37. The draft wait timed out in both page passes, so eight checks read a page that never finished opening.
Four are the Draft checks (28, 34, 35 and 36). The other four are the deadline, sells, captain and timing checks,
which share the first pass's session with the draft tab. The migrated file gives 37/37 on the same build.
RULE: every read of a Section in a browser suite opens it first and waits for its body, whichever section is PRIMARY.
A read of rows inside a panel is scoped to the element that owns them, a data-testid, never to the section's first
N `.row` elements, because a panel can gain a table above them. A suite that pins PRIMARY changes with the app's
table in the same change.
TEST: `qa/smoke_wk.cjs` 37/37. In both page passes it clicks `sec-df-waivers` when that section is closed, then waits
for "waivers process". Check 34 opens `rev-df-pool-app` and reads only `[data-testid="df-pool-app"] .row`, in order.
`qa/smoke.cjs` 62/62 with `draft: "df-claims"`. `qa/components.cjs` has two matching checks,
"D3-first-paint-opens-the-claims-sheet-alone-and-keeps-the-app's-own-search-closed-as-a-quick-check" and
"D3-free-agents-rank-to-the-horizon-with-how-to-get-him-and-keep-the-app's-own-rows-behind-a-reveal". The second one
counts the reveal's rows against `draftPool(ctx)`.

### E-119 · v110 · the committed refresh workflow could never have started, and the check it was validated with could not see why
CAUSE: the v89 `.github/workflows/refresh.yml` (committed in baac4bc) set `LOGS: ${{ runner.temp }}/logs` and
`HELPERS: ${{ runner.temp }}/helpers` in the job-level `env:`. GitHub provides only the github, needs, strategy,
matrix, vars, secrets and inputs contexts there; `runner` exists from the steps on. A workflow that names a context
where it is not available is rejected when it is loaded, so the first scheduled morning after a merge to main would
have failed before any step ran, and the failure-issue step, being a step, would not have run either: a red badge
and nothing else, which is the muted failure the file's own header was written to prevent. The v89 validation was
`python3 -c "import yaml; yaml.safe_load(...)"` (E-077's TEST). That checks YAML syntax, not the workflow schema or
where each context may be used, and it printed nothing wrong for the invalid file.
CAUGHT: 27 Sep 2026, v110 E7, before the rewrite: actionlint 1.7.12 (installed into a scratch folder from PyPI's
actionlint-py, not a project dependency) on the committed file reports `context "runner" is not allowed here` at
lines 65 and 66; the same file passes `yaml.safe_load`. main carries no workflow, and a schedule runs only on the
default branch, so it never ran.
RULE: a workflow file is validated with actionlint, which also runs shellcheck on every `run:` block;
`yaml.safe_load` is the first line of that check, never the whole of it. A path under the runner's temp folder is
set by a step through `$GITHUB_ENV`, never in the job's `env:`. A `run:` block is executed once before it is
trusted: the E7 rewrite was rehearsed step by step, with its own text extracted from the YAML, in a scratch copy of
the tree.
TEST: actionlint over the rewritten `refresh.yml` with shellcheck on: 0 findings (the first draft had one, SC1087,
fixed); `gate.yml` 0 schema findings (shellcheck's one info-level SC2012 in its Playwright step predates this item
and is left alone); the v89 file 2 errors. No repo suite runs actionlint yet: it is a Go binary and the project
takes no new dependency without a decision, so the rule is held by practice until `gate.yml` gains a step for it.
This entry names that gap rather than calling it closed.

### E-120 · v110 · the kit's deadline board draws its chalk circle through the countdown, and a suite pinned 26 hours out could never see it (D7)
CAUSE: the kit's styles.css draws the Today board's big circle as `.board:before` (240px, `right:-120px;top:-120px`,
a 2px chalk border), and sets the countdown beside it in `.board .big` at `clamp(2.6rem,11vw,4.6rem)` with no width
limit. So the circle's clipped box, the board's top-right 124px, overlaps the countdown whenever the countdown text is
long, and at 390 that means any reading with a two-digit hour and a two-digit minute: roughly half the hours of any
gameweek. Every browser suite pins its clock 26 hours before
the deadline, where the text reads "1d 2h 0m", one of its narrowest forms. The kit is the executable spec for Today's
layout, so a verbatim port would have shipped a D7 breach that no existing suite could see.
CAUGHT: 27 Sep 2026, E5/D7, before the Today board landed. The board was transplanted from the kit's stylesheet into
the app with the snapshot's own fixtures (`python3 qa/browser.py --mutate kit-board`), and the countdown was also
measured on a kit-faithful scratch page (Chromium, sandbox fonts). At 390 the pinned "1d 2h 0m" ends at x 219.4,
clear of the circle's box, which starts at 252. "1d 23h 59m", "3d 12h 30m" and "6d 23h 59m" all end at 267.9, and
"12d 22h 10m" at 292.2, and every one of them crosses; "5d 18h 0m" (243.7) and "2d 3h 4m" (219.4) clear. The stroke
itself crosses the text too, not just the box. At 320 even "1d 2h 0m" crosses. In the app on the long clock,
"21d 16h 29m" crosses at 390 and at 320, in both schemes. Nothing shipped: no decorative line renders in today's
build.
RULE: no decorative line's box intersects a text node's client rect, at 390 or at 320. On Today this is measured
again on the long clock, one minute after the previous deadline, where the countdown is at its widest, because the
pinned clock shows its narrowest form. A port of the kit's board keeps the countdown's box clear of the circle's
box, by limiting the countdown's width or by moving or shrinking the circle. It is measured by the suite, not judged
by eye.
TEST: `qa/browser.py` checks `browser-d7-<tab>-<scheme>-chalk-lines-clear-of-text-at-390/-320` on every tab, and
`browser-d7-command-long-clock-<scheme>-chalk-lines-clear-of-text-at-390/-320`. Decorative lines are found by class
and as every empty-content ::before/::after that paints a border or background. `--mutate kit-board` is red at 320
on every tab and on the long clock at 390 and 320. `--mutate chalk-cross` is red at 390. Today, with no decorative
line in the build, the check prints a SKIP with its reason and runs the moment one renders.

### E-122 · v110 · copy said "seven points off the lead" when the gap was eight (spec §7.6)
CAUSE: the v109 Today copy wrote the Draft league's gap to the leader as prose. It was true of the table the day it was
written, and a table moves every gameweek while prose does not, so it read "seven points off the lead" when the gap was
eight. The class is E-117's (two Draft league facts in the kit's Review copy) and, in tests, E-084's and E-094's.
CAUGHT: spec §7.6, carried into v110 as a required entry, and checked on 27 Sep 2026 while porting the kit's vToday
(v110 §5 D1): a grep of this file found §7.6 cited only as a class inside E-117, with no entry and no test of its own.
On the baked table of 27 Sep the gap is eight again (Yoh-Nited on 4 league points, the leader on 12), which is the
number a typed "seven" would have kept printing.
RULE: a league-table figure in copy (a position, a points total, a gap to the leader, a lead over second) is computed
from the table when the panel draws and is never written as prose. On the landing card and the Command tab it comes
from one helper, `draftTableView(MC)` in `src/ui.jsx`, reading `MC.draft.standings`: the position is the table's own
rank, the gap is the rank-1 entry's league points minus the manager's, and the top-of-the-table and level cases are
worded by the same computation. The Classic rank move on the Command tab is read from `MC.classic.gws` the same way.
TEST: `qa/components.cjs` "D1-E122-every-league-table-figure-on-the-landing-and-the-Command-tab-is-read-from-the-table-and-moves-with-it"
renders the landing's Draft panel and `cmd-last`'s table row on the baked table and then on three moved copies of it
(the leader three points further on, the manager's rank swapped with third, the manager top by two). Each render must
carry the moved figure and not the old one: «7th of 8, 8 off the lead» on the baked table, «1st of 8, top of the table,
2 clear» on the last copy. "D1-cmd-last-reads-each-game's-last-gameweek-from-the-baked-block-and-moves-with-it" moves
the last Classic gameweek's score and average and requires the copy to follow. Mutation: the gap typed as
"7 off the lead" → 237/238, red on the E-122 check alone.

### E-114 · v110 · three browser checks read the landing card as if only the app's own search could fill it (recurrence of E-112's class)
CAUSE: v110 §5 D1 makes the landing card show the solved plan's first week whenever `PLAN.plan` exists, `PLAN.hash`
equals `PRE.hash`, that week is the snapshot's next gameweek and its deadline is still ahead. The app's own card
(`buildPlan`) now answers only when that plan is set aside. Three browser checks were written when the app's own search
was the only thing the landing could show. smoke's "C1-flagged-player-is-absent-from-the-recommendation" lifts one flag
in the snapshot and expects the landing to name that player; the solved plan is fixed at build time and does not move
with the snapshot's flags, so the control half could no longer pass on a correct app. smoke_wk's check 13
"captain-in-the-xi-on-the-wildcard-path" expects the landing to name the app's own wildcard captain. smoke's
"locking-the-premiums-changes-the-landing-fifteen-and-keeps-a-captain" compared the app's own unlocked fifteen with the
locked one. A fourth suite, `qa/buttons.cjs`, resolves the landing's names against the fifteens the app's own engine can
show, and the solved fifteen carries a web_name ("Thomas") that two elements share.
CAUGHT: 27 Sep 2026, building D1. The pre-migration `qa/smoke.cjs`, run from a temporary copy against the new build,
gave 61/62, red on "control with the flag lifted names him = false; shipped names him = false" (subject Semenyo). The
pre-migration `qa/smoke_wk.cjs` gave 36/37, red on check 13 ("captain Groß … the landing card does not"). buttons.cjs's
resolver, replayed in Node on the solved fifteen, leaves "Thomas" unresolved without the plan's ids and resolves all
fifteen names to the plan's own ids with them; buttons.cjs itself was not run (not permitted in this item).
RULE: a browser check that reads the landing names the card it expects, by `data-plan="solved"` or `data-plan="app"` on
`.landing`, and asserts that card's property. The app's own card is reached with the one setting that sets the solved
plan aside and leaves the app's own engine untouched: a match price typed on the Odds tab (`state.market`, which
`src/engine.js` never reads). A check migrated this way keeps every property it had, never a weaker comparison, and the
solved card gets its own, stronger assertion.
TEST: `qa/smoke.cjs` 64/64. "C1-flagged-player-is-absent-from-the-recommendation" and a new app's-own half of
"C1-flagged-player-is-never-captain-nor-vice" run on pages opened with the app's seeded state plus one typed price, and
both pages must read `data-plan="app"`. The new "C1-the-solved-landing-names-only-unflagged-players-and-a-new-flag-on-one-sets-it-aside"
requires the solved card exactly when the data says so, every player it recommends unflagged and named on it, and a
flag on its vice to hand the card to the app's own search without naming him. "locking-the-premiums-…" also reads the
app's own unlocked card and requires the lock to set the solved card aside. `qa/smoke_wk.cjs` 37/37: check 13 asserts,
on the solved card, that PLAN week one's captain is named, sits in PLAN week one's eleven and in this engine's `bestXI`
of that fifteen, and keeps today's assertion on the app's own card read with a typed price; checks 15 and 18 add the
solved captain, fifteen and vice to the recommendations they hold to the flag rule. `qa/buttons.cjs` prefers the plan's
first-week ids when it resolves a duplicated name.

### E-127 · v110 · E-118 closed: the Plan tab's six older sections name their game, and the check that only counted now fails
CAUSE: the wave logged E-118 open because `qa/mc_separation.cjs` could print how many stat rows carried a number and
no game (5 at first paint, 16 with everything open) but was not allowed to fail on it: the fix sat in `src/ui.jsx`,
which the suite's author did not own. The Command tab's two older sections were tagged Classic by the Today item; the
Plan tab's six (`plan-tx`, `plan-wc`, `plan-opts`, `plan-xi`, `plan-time`, `plan-fb`) were not.
CAUGHT: 28 Sep 2026, reading the full-gate log after the wave landed: the count still stood at 16 with everything
open and the entry was still open.
RULE: a section that shows one game's figures carries that game's tag in its first line, and the count of unlabelled
rows is an assertion, not a report. Each of the six sections now opens with a Classic line that names what it shows
and carries no figure, so no copy can drift; the check is armed as `unlabelled.first === 0 && unlabelled.open === 0`.
TEST: `node qa/mc_separation.cjs` 31/31, the count 0 at first paint and 0 with everything open; removing the
`plan-time` line from a copy of the source turns the armed check red ("0 at first paint, 5 with everything open").
components 252/252, mc_render 65/65, visual 42/42 and unit_engine 272/272 on the rebuilt page. The browser suites run
in the gate that follows the refresh, since the solver was using the machine when this was committed.

### E-128 · v110 · the kept plan reported the gap of the solve that produced it, though a sibling solve of the same problem had proved a tighter bound
CAUSE: `pipeline/plan.cjs` keeps the best plan by objective among the main solve, the long solve and the timing file's
"wildcard now", and copied the gap of whichever solve won. Those three are one integer programme: `classic()` with its
default arguments. A dual bound proved by any of them bounds the best plan of all of them, so the winner's honest gap
is the tightest bound over its own objective, not its own solve's clock-limited gap. On the 28 Sep refresh the three
solves gave objectives 671.63, 672.02 and 673.06 at gaps 4.4%, 1.0% and 5.8%. The best plan (673.06) came from the
solve with the loosest gap, and reported as it stood it would have failed the 3% ceiling (§7.9) while being provably
within 0.84% of the best possible, by the long solve's bound (672.02 × 1.01 = 678.7).
CAUGHT: 28 Sep 2026, reading the solve logs during the second refresh: a timing solve with the best incumbent and a
5.8% gap was about to become the kept plan.
RULE: each solve proves bound = objective × (1 + gap). The kept plan's gap is min(bound) over the solves whose
recorded `params` equal the kept plan's (checked, never assumed), divided by the kept plan's objective, less one. It is
never tighter than that bound and never looser than the kept solve's own gap; `gapOwn`, `gapFrom` and `gapBound`
record what supplied it. A solve with other parameters shares nothing. The 3% ceiling itself is unchanged.
TEST: `qa/plan_legality.cjs` "the plan's gap is no tighter than the tightest bound the raw solves prove", which
recomputes the floor from the raw solver files the plan names and fails on a missing file, a hash from other data or a
claim below the floor; its mutation (a gap of 0.00001) goes red. On the committed 27 Sep solver files the same plan
(weeks identical) is certified at 0.2467% by the long solve's bound instead of 0.4851% (41/41 on the old and the new
plan file); changing the long solve's `tau` in a copy makes `plan.cjs` fall back to the plan's own 0.4851% gap.

### E-129 · v110 · the 240 s timing solves stopped at 4% to 11% gaps on a changed input, and the gate never looked at the scenarios' proofs
CAUSE: `chip_timing(TL=240)` (the kit's setting) solves "now", "later" and "never" once each on a 240 s clock. On the
27 Sep input they proved to 0.49% (main plan) and optimal in 165 s ("never"). One player's price moved (Barry £5.6m →
£5.7m, which also moved the wildcard's £0.1m of headroom to nil) and two flags changed, and on the 28 Sep input the same
stages stopped on the clock: main plan 4.4%, "now" 5.8%, "never" 11.3% (883.78 against 892.26 the day before). Clean
re-solves on an otherwise idle machine proved the same problems within 0.4%: "now" in 247.5 s (900.83), "never" in
426.4 s (889.69), and the full problem at 0.22% in 474.3 s (903.39). Nothing in the gate read a timing scenario's own
gap: `plan_legality` held the kept plan to 3% and the timing block only for its shape, so a verdict built on an 11%
"never" would have shipped, with the timing note saying nothing about it.
CAUGHT: 28 Sep 2026, reading the solve logs during the second refresh, while a "now" incumbent at a 5.8% gap was
about to become the kept plan (E-128). Contention could not be separated from the clock: I had run builds and suites
beside the solves, but "later" ran through the same window and proved to 0.4% in 212.8 s, so the honest finding is
that 240 s is too short for these problems on this input, not that the machine was busy.
RULE: after `chip_timing`, any scenario above a 1% gap is re-solved with
`python3 pipeline/solve_scenario.py <now|later|never> 900 --gap 0.004` (idle machine, one scenario per core) before
`plan.cjs` runs; the script folds a result in only when its objective is higher and the input hash matches, and
re-reads the timing file just before writing, so two scenarios may run side by side. Solves run on a machine with
nothing else on it, and a suite is not started beside a time-limited solve.
TEST: `qa/plan_legality.cjs` "timing: 'later' and 'never' are each proven within the 0.03 ceiling", through one function
`timingProved` that the check and its mutation both call (the mutation, a "never" at an 11% gap, goes red); 43/43 on the
committed plan, 59/59 on the reference plan.

### E-130 · v110 · the calibration suite pinned the committed block's backtest to the kit's fixture to 1e-9, and the game revised its own data
CAUSE: `qa/calibration.cjs` (E-084's class again) ran the ported stage on a copy of `data/mc_data.json` and compared the
result with `qa/fixtures/v111_model.json`, the kit's output on the kit's own block, to 1e-9; and asserted the committed
block's stored backtest equal to the same fixture. That was true only while the committed block was the kit's. The game
revises finished matches' xG and other feeds after the fact: on the 28 Sep bake the four calibration factors were
unchanged (1.117, 1.076, 1.048, 1) but 27 of the 89 backtest leaves had moved by about 1e-4 (goals log-likelihood
−92.3523 → −92.3546, minutes Brier 0.130510 → 0.130509), so three checks went red on a correct refresh.
CAUGHT: 28 Sep 2026, the second full gate run: calibration 22/25 on the refreshed tree, everything else green.
RULE: a reproduction check runs on the input the fixture was made from. Every comparison with the fixture now uses the
kit's saved block, `reference/v111/app/data.json`, which never changes; the committed block is held to consistency
instead: its `model` must equal what the stage computes from that block (calib exactly, backtest within 1e-9, weeks the
block's own finished gameweeks), which a re-bake that skipped the stage, or a model calibrated on other data, cannot pass.
The drift against the fixture is printed as a NOTE, never asserted.
TEST: `node qa/calibration.cjs` 25/25 (0 of 4 factors and 27 of 89 leaves differ from the fixture, printed); on a copy,
corrupting the stored `points.all.rho` by 0.001 and changing a stored factor each turn the (b) check red on the named
leaf.

### E-131 · v110 · the timing verdict's "proved, but only just" branch omitted the tolerance the spec says to state
CAUSE: spec §5 D2 says the timing verdict states the solver's tolerance and calls the choice clear only when the gap
exceeds it. The copy has two "level" branches: one names the edge and the tolerance ("inside the tolerance of about N
points"), and the other, taken when the wildcard-now plan is proved ahead of every later week in objective space,
said "ahead of every later week in the proof as well, but only just" and then "treat the two weeks as level" with no
tolerance. Yesterday's numbers took the first branch. The 28 Sep numbers (now 903.39, later 901.52, edge 1.9 against
a tolerance of about 4; now's objective 677.53 above later's best possible 675.66) took the second, and the D2 check
reported "the tolerance, about 4 points" missing.
CAUGHT: 28 Sep 2026, the full gate: components 251/252.
RULE: every branch of the verdict states the edge and the tolerance; the test reads the tolerance from the plan, not from
the copy. The branch now reads "ahead of every later week in the proof as well, but only just: +1.9 against GW7, inside
the tolerance of about 4 points".
TEST: components D2 "the timing verdict says proved worse only on the objective proof and settled only beyond the
tolerance", 252/252, which reaches this branch on the shipped plan.

### E-095 · v110 · verify.sh derived the service worker's cache name from a hard-coded four-icon list (E-084's class), and the entry its own fix comment cites was never written
CAUSE: `qa/verify.sh`'s check `pwa-service-worker-precaches-this-build-only` recomputes the worker's cache name from the
shipped page, the manifest and the icons, exactly as `build.cjs` does. The suite hashed a typed list of four icon files;
`build.cjs` hashes every icon it writes. On 26 Sep the icon set grew from four files to eleven, the two derivations
disagreed and a correct build read red. A frozen list in a suite was standing in for what the build produces.
CAUGHT: 26 Sep 2026, commit 4f0606a (the contrast fix and the full icon set), the run after the icon set grew. The fix
comment in `qa/verify.sh` names this entry, and the entry was not written until now: a fixed error with no ledger line.
RULE: the list is read off `dist/` itself, every `icon*.png` and `icon*.svg` there, sorted, which is what `build.cjs` walks,
so a file added to the set is hashed by both sides or by neither. A fix comment that cites a ledger number is not done
until the entry exists: `qa/verify.sh` now has a reason to be read next to this one.
TEST: `bash qa/verify.sh` check `pwa-service-worker-precaches-this-build-only` (34/34 on the 28 Sep tree; the cache name
it recomputes equals the one in `dist/sw.js` over all eleven icons).
NUMBERING, for anyone reading the ledger in order: entries E-096 to E-111 and E-122 were reserved by the v110 spec's
section 7 order and by the agents that wrote them, and are appended in the order they were written, so the file is not in
numeric order. E-098 was never used. Nothing is missing, and nothing is renumbered, because an append-only ledger keeps
the numbers its commits already cite.

### E-132 · v110 · the plan's Reduce Motion rule left the press scale on every button
CAUSE: PLAN.md IOS27-12 says to add `.btn:active,.btn-sm:active,.tabi:active,.sec-h:active,.menu-i:active,.inp:active,.reveal:active{transform:none}`
inside `@media (prefers-reduced-motion: reduce)`. The scale it cancels is set by a base rule whose selector list also carries
`.mc-root button:active` (specificity 0,2,1), which matches every `<button class="btn">`; the plan's `.btn:active` is 0,2,0 and loses.
Measured in the sandbox WebKit on a copy of dist carrying the plan's wording, through the CSSOM route ios IOS27-12 uses, with Reduce Motion
emulated: the plan's rule left `matrix(0.97, 0, 0, 0.97, 0, 0)` on a pressed `.btn`; the shipped rule gives `none`. Nothing that shipped carried
the plan's wording.
CAUGHT: 28 Sep 2026, while writing the rule: the specificity of the two selector lists was compared, then measured with a probe. Not caught by a
suite, because the only check was written against the plan's wording.
RULE: an override of a state rule takes the specificity of the strongest selector it must beat (here the `.mc-root` prefix on every selector), and the
static check asks for a twin of equal or higher specificity for every base rule, never for a rule that merely has the same name.
TEST: visual `Reduce Motion: every :active press-scale rule has a transform:none twin of equal or higher specificity inside prefers-reduced-motion`
(11 press-scale selectors, 11 twins; with the plan's wording the same check finds 7 twins and names the four `.mc-root` selectors left without one) and
ios IOS27-12 `a pressed .btn is not scaled`.

### E-134 · v110 · the plan typed "mounts within 4 s" for a navigation that waits 3 s before it falls back to the cache
CAUSE: PLAN.md IOS27-17 and the ios check written from it asserted that `.mc-root` mounts within 4 s while `index.html` is held for 10 s. The
plan's own design is a 3 s race, so the answer that beats it cannot start before 3 s, and the cached shell then has to boot. The bound was a
number typed before anything was measured; the adversarial verifier of ios.cjs measured a controlled reload that opens straight from the cache
at 3.47 s in this sandbox, so 3 s + that boot is beyond 4 s for any correct worker, and a cache-first one as well. The check could not have
passed, whatever the worker did.
CAUGHT: 28 Sep 2026, by the verifier's measurement, before the worker was written. This is the first change this chain makes to a check, made
under the rule that a check may change only when it is proved wrong against its source, and the replacement asserts the same property at least as
strictly.
RULE: a time bound in a check is derived from the timer it tests plus a boot measured in the same run, never typed. Here the property is that the
page opens from the cached shell without waiting for the network: `.mc-root` mounts no earlier than `RACE_MS` (read out of `dist/sw.js`; the
network was still held), no later than `RACE_MS` plus the controlled-reload boot plus 1 s, and before the held response is released (read from the
server's own log). The boot is measured four times, twice before the held reload and twice after it, and the largest is used, because the pool runs three
WebKit contexts at once and the same reload took 1.3 s alone (standalone probe: prompt 1.34 s, held reload mounted at 4.35 s with the race at
3.01 s) and up to 2.9 s beside them. Every number is printed.
TEST: ios `IOS27-17 slow network: ... mounts from the cached shell after the race and before the held response is released, within race +
controlled-reload boot + 1 s`; with the race removed from `dist/sw.js` (the fetch awaited alone) the page mounts only when the held response is
released and the check is red.

### E-135 · v110 · the app wrote objects to a store Anthropic documents as text only, and every test double accepted them
CAUSE: `store.set` passed the raw state object to `window.storage.set`; Anthropic documents artifact storage as text only. Every double in this
repository (the harness's two, the webkit suite's, the dist shim) JSON-encoded whatever it was given, so a write the real store may refuse could
not fail here, and the read side returned an object where the real store returns `{ key, value: <string> }`. The doubles were written from what the
adapter did, not from what the platform documents, which is how the mismatch stayed invisible through every suite.
CAUGHT: 27 Sep 2026 by the iOS 27 research (plan IOS27-04), from the support page's own words; fixed 28 Sep. Found by reading the documentation,
not by a suite: no suite could have seen it.
RULE: a test double keeps the contract of what it stands in for, and refuses what the platform refuses. The harness's `window.storage` and the webkit
suite's now take text only, throw a TypeError on a non-string and count it on `window.__STORAGE_NONTEXT__`; `get` answers `{ key, value: <text> }`.
The app writes `JSON.stringify(value)` and reads a string with a guard (unreadable text or a non-object reads as null); an object an older build saved
still loads, and the harness seeds objects on purpose so every test that seeds state proves it.
TEST: smoke `IOS27-04-the-app-writes-text-only-to-window-storage-and-reads-its-first-save-back` and its two webkit twins (`IOS27-04-storage-window-storage-...`,
`IOS27-04-storage-localStorage-...`); ios `IOS27-04 shell A (strict text-only window.storage)`. With `store.set` passing the object again, smoke
counts the refused writes and goes red.

### E-136 · v110 · the dist storage shim reported success on a write that failed, and the app never looked at the result
CAUSE: `build.cjs`'s shim wrapped `localStorage.setItem` in a `try` whose `catch` was empty and then resolved `true`; `store.set` returned that
value, and the two save effects in `useBoot` ignored the promise altogether. A full store, Safari's private browsing and a sandboxed frame all throw
on `setItem`, so the app lost every change and showed nothing. Measured on the shipped dist before this change: with `setItem` throwing
QuotaExceededError, `await window.storage.set('k', {a: 1})` resolved `true`.
CAUGHT: 27 Sep 2026 by the iOS 27 research (plan IOS27-05), measured on the shipped dist; fixed 28 Sep.
RULE: a storage layer that can fail says so. The shim resolves `false` on a throw and keeps `{ name, message }` on `window.storage.__error`; `store.set`
resolves `{ ok, reason, mode }`; the app shows "Last change not saved (<reason>). Export now." until the next good write of that key, and, when the first
save of `mc_ui` does not come back on a read, "This copy is not saving on this device. Export before you close it." (`storeMode`, on `.mc-root` as
`data-store`). `navigator.storage.persist()` is asked for once, after the first save that was read back in local mode, where it exists.
TEST: ios `IOS27-05 dist shim: window.storage.set resolves false when localStorage.setItem throws QuotaExceededError`, `IOS27-05 a failed save shows
'Last change not saved (<reason>). Export now.'`, `IOS27-05 navigator.storage.persist() is called exactly once after the first save`, and shells B and C of
IOS27-04; with the shim's `catch` resolving `true` again the first two go red.

### E-137 · v110 · the visually-hidden recipe put the status region one pixel outside the viewport, and its sibling recipe for a file input left an unseen control with no edge
CAUSE: the one status region for IOS27-11 (`Announcer`) took its class from the recipe copied everywhere for screen-reader-only text:
`position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0)`. The `margin:-1px` moves the box to x = -1 from the left edge
of the page, so the element walk in qa/ios.cjs (the qa/browser.py walk, ported) read `div.vh[announce] left +1` as horizontal overflow on every
tab of every context. The same first draft made the file picker for IOS27-14 a 1px clipped `<input type="file">` inside its 44px label; under forced
colours the audit counted it as a control with no border or outline (2 of 231 controls), although nothing about it can be seen.
CAUGHT: 28 Sep 2026, by the first ios run against the behaviour work (76/78; the two reds were exactly these). Not caught by a static gate: nothing
read the rule.
RULE: a node that has to stay in the accessibility tree and off the screen is `position:absolute;width:1px;height:1px;padding:0;border:0;overflow:hidden;
clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap`, and never carries a negative margin or offset: the clip already hides it, and a negative
offset only moves it out of the page. A control a person is meant to use is not made invisible by shrinking it: the file input is laid over its 44px
label at full size with `opacity:0` (the label's border is the edge people see, `.filebtn:focus-within` its focus ring), so the tap lands on the input
itself, a screen reader gets a full-size frame, and the audits, which skip a control with no opacity, do not see a control with no edge.
TEST: components `IOS27-11-the-visually-hidden-rule-clips-to-one-pixel-and-has-no-negative-margin-or-offset-E-137` (red with `margin:-1px` restored,
proved on a mutated build) and ios `IOS27-01 ... no horizontal overflow by document width, strip scroll box or element walk` and `IOS27-13 forced
colours 'active' ... every control keeps a border or an outline` (78/78 after the change).

### E-138 · v110 · the word gates were counted with innerText, which a WebKit release moves, and the harness's own visibleText had no caller
CAUSE: Part G's landing (under 110) and tab (under 500) gates count words in `innerText`. Safari 27 changed `innerText` to keep the text of every
`<option>` inside a `<select>` (WebKit 175006854), so a count taken with it can rise by a whole option list on a WebKit update with no change to
what a person sees; measured here, appending a 200-option select moves Chromium's `innerText` count from 2890 to 3090 while the visible words move by
the one selected value. `qa/harness.cjs` exported `visibleText(page)` for exactly this and returned `innerText`, and nothing called it: the suites
that gate on words (qa/smoke.cjs at lines 182, 256, 310 and 1014-1039, qa/webkit.js at 164, 338, 408 and 958, qa/smoke_wk.cjs) each read `innerText`
on their own.
CAUGHT: 27 Sep 2026 by the iOS 27 research (plan IOS27-16), from the Safari 27 release notes; the ios suite already counts with a text-node walk.
RULE: a word gate counts what a person can see, from a walk over text nodes that skips `<style>`, `<script>`, `<template>`, `[hidden]` and aria-hidden
subtrees, nodes whose parent has no client rects or is not `visibility:visible`, and every unselected `<option>` (a visible select's selected option
counts once). `harness.visibleText(page)` is now that walk (text in one block container joined, each new block a new line, so it splits into the
same words) and `harness.visibleWords(page)` counts it. Measured through the harness in Chromium at 402x874 on the landing and all nine tabs,
first paint and every section open (18 readings), it equals the ios suite's counter on every one, and the 200-option fixture moves it by +1 where
`innerText` moves by +200. The thresholds are unchanged.
NOT DONE HERE: the gates in qa/smoke.cjs, qa/webkit.js and qa/smoke_wk.cjs still count `innerText`; they are outside this change's file list and are
named so they are switched to this walk (webkit.js has its own page shell and does not require the harness, so the walk has to be inlined there).
TEST: components `IOS27-16-harness-visibleText-walks-text-nodes-and-never-reads-innerText-E-138` (red when the function returns `innerText` again,
proved on a mutated copy) and ios `IOS27-16 parity` and `IOS27-16 stability`.

### E-141 · v110 · the "no FAIL" sweeps matched the word anywhere in a line, so the mutation proofs made CI red on every run
CAUSE: gate.yml's last step ran `grep -n "FAIL"` over the combined log, and refresh.yml's sweep did the same over its gate logs. The E1 suites prove
each check by mutation and print the check they turned red, `PASS mutation: … — red: FAIL <check> …`, so ten PASS lines carried the word. Every
suite step of fpl-gate runs #25 to #34 was green and the run was red on this step alone; refresh.yml could therefore never open its pull request.
qa/run.sh decides by exit codes, so it printed ALL PASS on the same tree: the two runners disagreed about what red means. The ledger described the
refresh sweep as `^FAIL ` while the shipped file was unanchored (a recurrence of E-081's sweep-scope lesson).
CAUGHT: 28 Sep 2026 by the v110 audit (findings F01, G-01, SEC-01), from the GitHub job log of run 36489278425.
RULE: one sweep, in one file: `qa/fail_scan.sh` matches only a line that starts with FAIL or TDZ FAIL, which is how every suite prints a failure, and
both workflows call it. A mutation proof prints `RED <check>`, never the word FAIL. The sweep proves itself before it runs.
TEST: `bash qa/fail_scan.sh --self-test` (a quoted FAIL inside a PASS line must not count; a line-start FAIL and a TDZ FAIL must), run by both
workflows before their sweep.

### E-142 · v110 · a rival manager's full name sat in fpl/CLAUDE.md, and the privacy suite only looked for key names
CAUSE: the Draft league row in CLAUDE.md named the league admin. qa/privacy.cjs scanned data, built files and fixtures for the personal-name KEYS
(`player_first_name` and the rest), never for name VALUES, and never prose, so a name typed into markdown passed it. The repository is public and
the file is served, so the name is in the history of `main` and the branch from the commit that added it; removing the line does not remove that.
CAUGHT: 28 Sep 2026 by the v110 audit (P-04, F-01, SEC-03).
RULE: no rival's name in any tracked file, prose included. The line now says "the league's own admin entry". The privacy suite reads every rival's
first and last name from the raw feeds at run time (they are ignored by git, and the names are never written down) and searches every tracked text
file for each full name, word-bounded; the manager's own name and names that are part of a team label are left out. On a checkout without the
feeds (CI) it says plainly that the by-value scan did not run. Purging the name from history (a rewrite of a public `main`, or a GitHub support
request) is the manager's decision and is not done here.
TEST: privacy `no rival manager's full name, read from the raw feeds, appears in any tracked file` (red on the old CLAUDE.md line: it found it there
and, before the word-boundary and team-label rules, in 70 more files) and `mutation: a name from the feeds planted in prose is found`.

### E-143 · v110 · the minutes tail condition scored every thin row against gameweek zero, and its test could only agree with itself
CAUSE: minutesPromotion built each thin row's features with `intOf(panel.nextEvent, 0)`, but minutesPanel carries no nextEvent, so the target
gameweek was 0 and the days-since-last-start feature was wrong. On the 1 Oct snapshot the worst thin row (Fatawu) read 0.4967, under the 0.50 limit,
so the logistic was reported ELIGIBLE; scored for the real next gameweek it is 0.6273 and the tail condition fails. Nothing in production moved:
MINUTES_PRODUCTION_ROUTED is false, so P(start) was and is the Laplace rate. The unit check compared the function's fields with each other
(`t.ok === (t.max <= t.limit)` and so on), so it held whatever the function computed. E-087's wording ("eligible") rested on the wrong number.
CAUGHT: 28 Sep 2026 by the v110 audit (G-11).
RULE: the target gameweek comes from the snapshot's next_event (or the event marked is_next), as minutesModel uses ctx.nextEvent. A check on a
derived figure needs an oracle outside the function: the worst row's raw probability must equal minutesModel's pModel for the same player on a
context built from the same snapshot, and the limit is the literal 0.50 the ledger names. E-087 stands corrected by this entry: the logistic is not
eligible on this snapshot.
TEST: unit_engine `LIVE-F4-the-tail-condition-binds-on-the-raw-probability-of-a-thin-row` (with the gameweek-zero line restored the promotion reads
0.4967 against minutesModel's 0.6273 and the oracle disagrees, proved on a scratch copy).

### E-144 · v110 · the Chips, Rivals and older Plan panels spoke for the app's own fifteen while the landing spoke for the solved plan
CAUSE: the landing card shows the solved plan when its hash matches (D1), but the Chips tab, the Rivals tab and the Plan tab's wildcard fifteen,
priced options, best eleven and timing sections were built on buildPlan, the app's own quick model. On 28 Sep the phone named Saka as captain on
the landing and Groß on Rivals, gave the wildcard's worth as 13.7, 1.9 and 136.4 in three places, and said Bench Boost and Triple Captain "wait for a
confirmed window" while the plan played them in GW7 and GW8. The Draft head-to-head showed the phone's 400-draw check, not the 30 000-draw result baked
into the build. Squad, Rivals and Chips named no game on their figures, and the separation suite never rendered them.
CAUGHT: 28 Sep 2026 by the v110 audit (F-02, F-03, F-05, F-06).
RULE: one test decides whether the solved plan stands (landingPlanView), and every surface that shows a fifteen, a captain or a chip verdict follows
it. Where the plan stands, the Rivals checks read its fifteen, buys, captain and vice; the Chips tab and the four older Plan sections open with one
line naming the plan's chips and captain and calling what follows the app's own quick model; the Draft head-to-head shows the baked result when it
was made on this build's data for the next gameweek, with the phone's check behind a reveal. Each section on Squad, Rivals and Chips carries a
Classic tag in its header.
TEST: mc_separation renders Squad, Rivals and Chips (seven surfaces) with the unlabelled count armed over all of them.

### E-145 · v110 · the in-app refresh let a web-search reply move the official deadline and any price, and showed it as fact
CAUSE: applyRefresh accepted any now_cost from 30 to 250 and replaced the next event's deadline_time with any string Date.parse read. Run in memory
on the 1 Oct snapshot, a reply two hours out moved the deadline the whole app counts down to, and a reply cutting a premium by £6.0m was applied;
the message said only "Applied 1 update". The refresh's job (D4) is flags and prices; the deadline belongs to the official snapshot.
CAUGHT: 28 Sep 2026 by the v110 audit (SEC-02).
RULE: a refresh never changes the deadline: a reply within 15 minutes of the official one is a confirmation, anything further is skipped with its
reason. A price may move at most £0.3m per refresh; a larger move skips that one field and the rest of the reply still applies. Every patched
player carries refresh_src "model", the refresh record carries src "model", and the message says the values came from a Claude web search,
unverified, and that the deadline is never changed.
TEST: unit_engine `REFRESH-applyRefresh-keeps-the-official-deadline-and-bounds-a-price-move-SEC-02` (red on the old function: the deadline moved
to 14:30 and the price to 56).

### E-146 · v110 · every screen said v89, and the version check compared two readings of the same number
CAUSE: package.json stayed at 89.0.0 through the v110 work, so the header, the page title and the service-worker cache name said v89. verify.sh
I6 compared APP_VERSION with package.json, which build.cjs derives it from, so it could not disagree; and it decided by grepping "dist stamped",
which it printed whether or not the versions matched.
CAUGHT: 28 Sep 2026 by the v110 audit (F05, F-08).
RULE: the version a build ships is checked against an independent source, the version the weekly block was written for (data/weekly.js), and
the check decides on its own verdict, not on a phrase it always prints. package.json is 110.0.0.
TEST: verify.sh `app-version-stamped-and-equals-package-major` (red with package.json at 89.0.0 against weekly version 110).

### E-147 · v110 · the spoken refresh message printed "[object Object]" when handed a value that was not text
CAUSE: refreshMessage (IOS27-11, the status line a screen reader speaks) built its text with String(err) and "GW" + gw, so an error object or a
non-numeric gameweek came out as "[object Object]" or "GWundefined". Nothing in App passes such values today; the fuzzer does, by design.
CAUGHT: 1 Oct 2026 by mc_full P07 in the first gate run on the v110 tree (3 of 3000 cases).
RULE: a message slot accepts a string or an Error as its reason and a whole positive number as a gameweek, and leaves out what it cannot say.
TEST: mc_full P07 (302/302 at 3000 after the fix).

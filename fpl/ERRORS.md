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

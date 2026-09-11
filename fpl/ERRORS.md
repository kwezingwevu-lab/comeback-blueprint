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
TEST: pending (unit_engine)

### E-027 · v87 · Playwright 1.63 looks for Chromium build 1243; the sandbox has 1194
CAUSE: version drift between the pinned playwright and the preinstalled browser
CAUGHT: harness launch failure during recon
RULE: launch with executablePath /opt/pw-browsers/chromium, never run playwright install
TEST: harness.cjs launch (pending)

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

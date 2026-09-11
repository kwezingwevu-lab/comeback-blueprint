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

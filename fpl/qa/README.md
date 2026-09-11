# qa/ — what each suite proves

`npm run qa` runs `qa/run.sh`; ship only on `ALL PASS`; never loosen a test to pass.

- `tdz_check.cjs` — comment/string-aware TDZ scan (CLEAN).
- `verify.sh` — syntax, 11 live reconciliations, 9 invariants (23/23).
- `unit_engine.cjs` — E1 worked example (5.23, 0.875, 16.3); draft↔classic `code` join.
- `smoke.cjs` — both modes, landing gates, tabs, tokens, touch floors, persistence (29/29).
- `smoke_wk.cjs` — every recommendation against the live API (32/32).
- `realistic.cjs` — refresh path with real API shapes (8/8).
- `buttons.cjs` — every enabled button, every section (370 · 0 · 0 · 0).
- `mc_full.cjs` — fuzz every top-level function, 3000 dev / 25000 release (0 failures).
- `mc_all.cjs` — 70+ engine invariants, 1M iterations (0).

Output (CONTRACT §8): `PASS name` / `FAIL name — detail`, then `SUITE <name> <pass>/<total>`; exit 1 on any FAIL. `harness.cjs` uses `/opt/pw-browsers/chromium`, else Playwright's default browser.

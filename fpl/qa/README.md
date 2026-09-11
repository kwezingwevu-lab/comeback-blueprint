# qa/ — what each suite proves

`npm run qa` runs `qa/run.sh`; ship only on `ALL PASS`; never loosen a test to pass.

- `tdz_check.cjs` — comment/string-aware TDZ scan (CLEAN).
- `verify.sh` — syntax, 11 live reconciliations, 9 invariants (23/23).
- `unit_engine.cjs` — E1 worked example (5.23, 0.875, 16.3); draft↔classic `code` join.
- `smoke.cjs` — both modes, landing gates, tabs, tokens, touch floors, persistence (29/29).
- `smoke_wk.cjs` — every recommendation against the live API (32/32).
- `realistic.cjs` — refresh path with real API shapes (8/8).
- `buttons.cjs` — every enabled button, every section (370 · 0 · 0 · 0).
- `mc_full.cjs` — transpiles the assembled app (esbuild `--jsx=transform`), stubs react/react-dom/recharts/lucide-react,
  extracts all 155 top-level functions and fuzzes them with 20 junk kinds mixed with valid arguments; 35 property groups,
  35 assertions per iteration. 3000 dev / 25000 release, `node --stack-size=4000 qa/mc_full.cjs <iters> [seed]`.
  Three contracts: 132 functions must never throw, `parseJson`/`applyRefresh` must throw a named Error (D4),
  21 React components must reject junk props with a TypeError (their real rendering is smoke/buttons).
  Bar: 155/155 functions, 0 failures.
- `mc_all.cjs` — 109 engine invariants over randomly generated legal and illegal inputs drawn from seeded random
  universes (5–8 clubs, 0–12 finished gameweeks, so both sides of the E-020 variance cap are exercised).
  `node qa/mc_all.cjs <iters> [seed]`; 1,000,000 iterations ≈ 350 s. Every invariant must run at least once.
  Bar: 0 failures; the seed is printed so any failure is reproducible.

Output (CONTRACT §8): `PASS name` / `FAIL name — detail`, then `SUITE <name> <pass>/<total>`; exit 1 on any FAIL. `harness.cjs` uses `/opt/pw-browsers/chromium`, else Playwright's default browser.

# qa/ — what each suite proves

`npm run qa` runs `qa/run.sh`; ship only on `ALL PASS`; never loosen a test to pass.

**Two counts, and only one of them is a release.** `bash qa/run.sh` runs `mc_full` at the 3000
dev count — fast enough for the edit loop. `bash qa/run.sh --release` runs it at **25000**, and
**a tag is cut only after a `--release` run**: the 25000 count is what found E-035 (`binomial`
looping 1e308 times, which hung the app with no error) and E-036 (`clamp` returning NaN from the
helper that guarantees probabilities sit in [0,1]). Neither appeared at 3000. The last line of a
run says which mode it was. `MC_ITERS=<n>` still overrides both.

- `tdz_check.cjs` — comment/string-aware TDZ scan (CLEAN).
- `verify.sh` — syntax, 11 live reconciliations, 16 invariants (27/27), including that the shipped snapshot carries every draft-league field, carries no invented league id, and that the recorded draft fixtures match their manifest.
- `unit_engine.cjs` — E1 worked example (5.23, 0.875, 16.3); draft↔classic `code` join; the whole draft-league half (pool, ownership, waiver order, head to head, the C5 variance rule) driven from `qa/fixtures/draft/`; the F4 calibration and minutes model, the F5 player-xG challenger and the F8 chip solver, each with its leak test (255/255).
- `smoke.cjs` — both modes, landing gates, tabs, tokens, touch floors, persistence, and the F4/F5/F8 caveat panels compared against the engine's own figures rather than against literals (58/58).
- `smoke_wk.cjs` — every recommendation against the live API (36/36), including that the draft league endpoints are still public and still shaped as documented, that the Draft tab shows the real pool, claim order and opponent when a league id is present, and that it admits the pool is unknown when one is not.
- `realistic.cjs` — refresh path with real API shapes (8/8).
- `components.cjs` — **component OUTPUT**, the half `mc_full` cannot reach. `mc_full` proves the
  21 React components *reject* junk props; this proves what they *draw*. The assembled app is
  transpiled and evaluated against the real react / recharts / lucide-react and each component is
  rendered on its own through `react-dom/server`. Four passes: valid props from the shipped
  snapshot (non-empty markup, no `undefined` / `NaN` / `[object Object]`, no empty `class=""`, no
  hex literal outside the one `<style>` block, and every `data-testid` the component owns present
  in the union of its variants — ownership is scanned out of the shipped file, not typed here);
  four degraded but legal contexts (no fixtures, no rivals, an empty squad, a blocked D3 state)
  where every panel must still say something rather than go blank; the 20 junk kinds in one prop
  slot at a time and then over the whole props object; and a check that the ownership scan itself
  is not vacuous. Two definitions are written into the file header so neither can be read as
  loose: which slots are TEXT (printed by contract, so the leak rule does not apply to them) and
  why React's own "Objects are not valid as a React child" Error counts as a clean rejection
  alongside a TypeError. Per-component pass counts are printed. 132 checks, ~32 s, 2060 junk
  renders a run (1395 produced markup, 665 threw: 620 TypeError, 45 React's own child guard, 0 anything else).
- `buttons.cjs` — every enabled button, every section (370 · 0 · 0 · 0).
- `webkit.js` — **Safari-engine acceptance** (`node qa/webkit.js`), the only suite that is not Chromium: the manager reads
  this app on an iPhone, so the engine-dependent gates are measured where he actually reads them. Launches
  `playwright.webkit` directly (26.6 here) — never `npx playwright install webkit`, its download validation fails; the
  browser is present and `install-deps webkit` has been run. Covers: `dist/index.html` booting from a `file://` URL and the
  harness page booting, both with zero page errors; seven tabs in full mode, the landing in simple mode, no `.boundary`;
  the Part G gates re-measured under WebKit with every number printed (landing < 110 words, every tab < 500, 11px type
  floor, seven touch floors, seven equal-width tabs, no horizontal scroll at 360px and 390px); the `window.storage` path
  and the `localStorage` fallback each persisting mode, tab and open sections across a reload; export → wipe → import
  restoring the squad; a mocked 400 clearing `.refbar` with the state unchanged; the D3 block rendering and clearing on
  confirm; 390×844 screenshots to `qa/shots/webkit-<tab>.png`. Bar: `SUITE webkit 30/30`.
- `mc_full.cjs` — **runs in a worker thread under a wall-clock watchdog.** The suite is otherwise
  single-threaded and could not time out a synchronous loop from inside itself, so an unbounded
  loop used to appear as a run that never finished rather than as a failure — that is how E-035
  was found, by a human noticing. The parent thread now watches a SharedArrayBuffer heartbeat the
  worker bumps before every trial; a trial that has not returned inside `MC_WATCHDOG_MS`
  (10000 by default) is printed as `FAIL mc_full-watchdog — «<function> [<junk kinds>]» …`, the
  worker is terminated and the suite exits 1. A 1.5 s self-test on a worker that really does loop
  for ever proves the watchdog fires, and its result is carried into the suite's own counts.
  `MC_NO_WORKER=1` runs the old single-threaded way, and the suite then fails the assertion that
  says it is watched. Transpiles the assembled app (esbuild `--jsx=transform`), stubs react/react-dom/recharts/lucide-react,
  extracts every top-level function and fuzzes them with 20 junk kinds mixed with valid arguments; 38 property groups,
  38 assertions per iteration (P36 Brier and reliability ranges, P37 the chip solver's set/expiry/one-chip-a-gameweek rules, P38 the promotion gate). 3000 dev / 25000 release, `node --stack-size=4000 qa/mc_full.cjs <iters> [seed]`.
  Three contracts: 132 functions must never throw, `parseJson`/`applyRefresh` must throw a named Error (D4),
  21 React components must reject junk props with a TypeError (their real rendering is smoke/buttons).
  Bar: 155/155 functions, 0 failures.
- `mc_all.cjs` — 135 engine invariants over randomly generated legal and illegal inputs drawn from seeded random
  universes (5–8 clubs, 0–12 finished gameweeks, so both sides of the E-020 variance cap are exercised).
  **Universe diversity is now a bar, not a footnote.** The 1M run generated 29 universes and every
  invariant saw only those; for the cheap invariants that is plenty, but an invariant that solves a
  wildcard runs a few hundred times in the whole suite, so iteration count buys it nothing and
  universe diversity is the only thing that does. The expensive invariants (dispatch weight ≤ 5,
  22 of them) now draw from their own three-slot bank, one slot of which is replaced with a brand
  new universe every 24 deep draws. Each run prints, per invariant, the number of distinct
  universes it ran against, and fails if an expensive one saw fewer than 25 or any other fewer
  than 5. `MC_DEEP_W=0` turns the bank off, which is the pre-v88 behaviour and is how the before
  and after numbers were measured on one machine.
  `node qa/mc_all.cjs <iters> [seed]`; the 1,000,000-iteration release run measured 331.6 s with the deep bank on (724 universes generated, 695 of them for the bank). Every invariant must run at least once, and against enough worlds.
  Bar: 0 failures; the seed is printed so any failure is reproducible.

`qa/fixtures/draft/` holds verbatim public draft-league responses with a `MANIFEST.json` naming every URL and the
capture time; `qa/fixtures/draft_fixture.cjs` replays them through `data/draft_league.cjs`, the same shaping function the
fetcher runs. **No suite calls the draft league API** — `smoke_wk` pulls it only as a live reconciliation and says so when
it is unreachable.

Output (CONTRACT §8): `PASS name` / `FAIL name — detail`, then `SUITE <name> <pass>/<total>`; exit 1 on any FAIL. `harness.cjs` uses `/opt/pw-browsers/chromium`, else Playwright's default browser; `webkit.js` carries its own `playwright.webkit` launcher and its own page shell (the harness's in-memory `window.storage` cannot be wiped, and the export/import check has to wipe it for real).

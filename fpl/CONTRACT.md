# CONTRACT.md — build conventions for FPL Mission Control (v88)

Every agent building a part of this app reads `CLAUDE.md` (the master prompt) first, then this file. The master prompt says *what*; this file fixes the *names, shapes and markers* so parts written in parallel fit together. Change this file only with a note in `ERRORS.md` if the change was forced by a defect.

## 1. Layout and ownership
```
fpl/
  CLAUDE.md                master prompt + repo addendum (read first)
  CONTRACT.md              this file
  ERRORS.md                append-only ledger, Part L shape
  package.json             esbuild 0.27.4 · react/react-dom 19.2.4 · recharts 3.10.1 · lucide-react 1.44.0 · playwright 1.63.0 (installed)
  build.cjs                assembles app/FPL_Mission_Control.jsx and dist/index.html (see §2)
  src/engine.js            pure functions, no React, no imports; CommonJS export guard at the end (see §5)
  src/ui.jsx               React components; starts with the three imports (react, recharts, lucide-react)
  data/fetch_live.cjs      Node 22, global fetch, no deps → data/live.json (see §3)
  data/draft_league.cjs    pure shaping of the four draft-league endpoints into the §3 block;
                           required by fetch_live.cjs AND by the suites, so a test can never
                           pass against a copy of the shaping the fetcher does not run
  data/live.json           committed snapshot of the public API (shape §3)
  data/weekly.js           WEEKLY STRATEGY ENGINE block (shape §4)
  state/kwezi.json         exported app state (shape §6), committed every delivery
  app/FPL_Mission_Control.jsx   assembled single file (committed; artifact-ready: ES module, default export App)
  dist/index.html          assembled standalone page (committed; opens from a phone with no server)
  qa/                      run.sh harness.cjs verify.sh tdz_check.cjs unit_engine.cjs smoke.cjs smoke_wk.cjs realistic.cjs
                           components.cjs buttons.cjs webkit.js mc_full.cjs mc_all.cjs
  qa/fixtures/draft/       verbatim public draft-league responses + MANIFEST.json (url, capture time)
  qa/fixtures/draft_fixture.cjs   replays them through data/draft_league.cjs; no suite calls the network
  qa/shots/                390x844 screenshots; `webkit-<tab>.png` from qa/webkit.js, `full-<tab>.png` from the Chromium runs
  retests/RETEST_v87.md
```
Node scripts are CommonJS (`.cjs`). No TypeScript. No dependencies beyond package.json. Node 22.

## 2. The assembled single file (build.cjs)
`app/FPL_Mission_Control.jsx` = in this order:
1. the import lines from the top of `src/ui.jsx` (`react`, `recharts`, `lucide-react`) — imports must stay first in an ES module;
2. `// ENGINE — START` … contents of `src/engine.js` … `// ENGINE — END`;
3. `// WEEKLY STRATEGY ENGINE — START` … contents of `data/weekly.js` … `// WEEKLY STRATEGY ENGINE — END`;
4. `// LIVE DATA — START` … `const LIVE = <data/live.json as a JS literal>;` … `// LIVE DATA — END`;
5. the rest of `src/ui.jsx` (everything after its import lines), which ends with `export default function App(){…}` (or `export default App`).
Also stamps `const APP_VERSION = "v87";` (from package.json `version` major) right after the imports. Marker text is exact (em dash, one space each side). `verify.sh` asserts all six markers appear exactly once and in this order.

`dist/index.html`: esbuild bundle of the assembled JSX (`--bundle --format=iife --jsx=automatic --loader:.jsx=jsx --minify-syntax`) inlined in one HTML file with a tiny `window.storage` shim over `localStorage` (only if `window.storage` is absent) and `<div id="root">`. Mobile viewport meta. No external requests except the D4 refresh path.

## 3. data/live.json (fetch_live.cjs output)
All numeric strings from the API are converted to numbers. Prices stay in tenths (integers). Ids are FPL element ids. No `ep_this`/`ep_next` anywhere in the file (the banned-field invariant greps for them).
```
{
  "fetched_at": "2026-09-11T06:02:00Z",          // ISO, UTC
  "source": "fantasy.premierleague.com/api + draft.premierleague.com/api",
  "next_event": 4, "current_event": 3, "total_players": 10663216,
  "events": [{ "id","name","deadline_time","is_current","is_next","finished","average_entry_score" }],
  "teams":  [{ "id","short_name","name" }],
  "elements": [{ "id","code","web_name","team","element_type","now_cost","cost_change_event","cost_change_start",
                 "selected_by_percent" (number),"status","news","chance" (null|0..100 = chance_of_playing_next_round),
                 "total_points","minutes","starts","xg","xa","xgc","dc","bps","ict","form","goals","assists","cs","gc",
                 "bonus","yc","rc","og","pen_miss","pen_save","saves","transfers_in_event","transfers_out_event" }],
  "fixtures": [{ "id","event","team_h","team_a","team_h_difficulty","team_a_difficulty","finished","started",
                 "kickoff_time","team_h_score","team_a_score" }],           // all events, from fixtures/ (no ?event)
  "gw": { "1": { "elements": { "<id>": [min,starts,pts,xg,xa,xgc,dc,bps,ict,goals,assists,cs,gc,bonus,yc,rc,og,pen_miss,pen_save,saves] },
                 "fixture_xg": { "<fixtureId>": { "h": xG_home_players_sum, "a": xG_away_players_sum } } },
          "2": …, "3": … },                                                   // finished events only; elements with 0 minutes omitted
  "entry": { "id","name","summary_overall_points","summary_overall_rank","summary_event_points","current_event",
             "last_deadline_bank","last_deadline_value","last_deadline_total_transfers" },
  "history": { "current": [ {event,points,total_points,rank,overall_rank,bank,value,event_transfers,event_transfers_cost,points_on_bench} ],
               "chips": [ {name,event} ] },
  "picks": { "<gw>": { "active_chip", "picks": [ {element,position,multiplier,is_captain,is_vice_captain} ] } },   // GW1..current
  "ft_available": 3,                                   // derived: 1 + banked unused (cap 5); GW1 excluded; hits subtract
  "leagues": [ { "id","name","size","rank","last_rank",
                 "standings": [ {entry,player_name,entry_name,total,rank} ] } ],        // the six winnable leagues, ids in §4
  "rivals": { "<entryId>": { "event": 3, "picks": [ {element,is_captain,multiplier,position} ] } },   // every rival in those leagues
  "draft": { "game": { current_event, next_event, waivers_processed }, 
             "events": [ {id,deadline_time,waivers_time,trades_time} ],
             "scoring": { …settings.scoring verbatim… }, "squad": { …settings.squad verbatim… },
             "elements": [ {id, code, web_name, team, element_type, status, chance, news, starts, minutes, total_points} ],   // draft ids differ from classic ids: join on code
             "league_id": null,                         // unknown until the manager supplies it

             // The league half. Every field below is ALWAYS present; all of them are empty
             // while league_id is null, so the app takes one code path either way.
             "league":   { id, name, scoring, size, draft_status, trades, transaction_mode } | null,
             "entries":  [ {leagueEntryId, entryId, name, manager, shortName, waiverPick} ],
             "ownership":[ {code, owner, status, owned} ],        // KEYED BY CODE; owner is a
                                                                  // leagueEntryId or null; status
                                                                  // is the league element-status
                                                                  // ("a" claimable), NOT fitness
             "rosters":  { "<leagueEntryId>": [codes…] },         // fifteen codes per team
             "freeAgents": [ codes… ],                            // owner null AND status "a"
             "matches":  [ {event, finished, started, entry1, points1, entry2, points2, winner} ],
             "standings":[ {leagueEntry, rank, lastRank, played, won, drawn, lost,
                            pointsFor, pointsAgainst, total} ],
             "picks":    { "<leagueEntryId>": {event, codes[], xi[], bench[]} },   // one event
             "me":       { leagueEntryId, entryId, via } | null,  // via: "entry id" | "manager name"
             "unjoined": 0,          // element-status rows whose draft element id is not in the
                                     // draft bootstrap (the game can add a player between pulls)
             "unmappedOwners": 0,    // owners the league does not list
             "counts":   { entries, owned, unowned, freeAgents, unjoined, unmappedOwners } }
}
```
**`element_status[].owner` is an ENTRY id, not a league-entry id** (ERRORS.md E-063, checked
against two public leagues). `data/draft_league.cjs` translates it once, so every id in the
block above is a league-entry id and nothing downstream has to know.

`fetch_live.cjs` takes the league from `--draft-league <id|url|entry id>` or from
`state/kwezi.json` `draft.league_id` / `draft.entry_id` / `draft.league_input`. A bare number
is tried as a league first and then as an entry (`entry/{id}/public` → `league_set`). With no
league id the fetcher writes the block above with every league field empty.
Winnable league ids (T0, entry/3546875 on 11 Sep 2026): 1314671 Forecast to Glory (8) · 1683215 Nineteen45 (11) · 26474 Marvelous Matchups (17) · 512557 Champions League Mini (23) · 989793 Gentlemen's Sport Bar (24) · 512550 Champions League!! 2026/27 (28).

## 4. data/weekly.js (the WEEKLY STRATEGY ENGINE block)
One statement: `const WEEKLY = {…};` — decisions only, never model outputs (the engine recomputes numbers live). Element ids for classic, `code`s for draft.
```
const WEEKLY = {
  version: 87, gw: 4, written: "2026-09-11", source: "CLAUDE.md Part M + live check 11 Sep 2026",
  classic: {
    plan: "wildcard",                                   // "wildcard" | "transfers" | "hold"
    wildcard15: [572,1,8,279,229,330,586,98,12,69,40,453,165,411,249],
    captain: 165, vice: 411,
    fallback: { moves: [{out:212,in:605},{out:423,in:279},{out:259,in:586}], captain: 165, vice: 411 },
    chip: "wildcard", notes: ["Gakpo out (thigh, 75%) → Janelt"]
  },
  draft: {
    claims: [ {out:<code Richarlison>, in:<code Isidor>, why:"unavailable"}, … six in order … ],
    xi: { formation: "3-5-2", gk: <code>, def: [...], mid: [...], fwd: [...] },
    watchlist: [ …codes with three starts… ]
  },
  chips: { set1_expires_gw: 19, planned: [] },
  tournament: { leader: "bps_rate", transitions: 2, promote_at_gw: 5 },
  timing: { now_vs_later: { by_gw19: 21, by_gw38: 45, breakeven_double_gw17: 45 } }   // from the master prompt C4; recomputed by the engine when data allows
};
```

## 5. Engine API (src/engine.js) — required names
Top-level `function` declarations only (mc_full extracts every top-level function). No React, no DOM, no `Date.now()` inside pure functions (pass `now` in). Deterministic RNG for Monte Carlo (`mulberry32(seed)`). Last lines:
```
if (typeof module !== "undefined" && module.exports) { module.exports = { legal15, legalXI, … every function … }; }
```
Required functions (signatures in the file header comment; these names are asserted by the suites):
- Constraints: `legal15(ids, els)` → `{ok, reasons[]}`; `legalXI(ids, els)` → `{ok, reasons[]}`; `formationOf(ids, els)`; `clubCounts(ids, els)`.
- xP (E1): `shrunkPps(el)`, `pStart(el, gwStats)`, `fxMult(fixture, teamId, TS)` (takes a fixture object), `xp1(el, ctx)`, `xp5(el, ctx)` — worked example must give 5.23 / 0.875 / 16.3 (±0.05).
- Strength (E2): `teamStrength(live)` → `{TS: {teamId:{att,def,g,xgf,xga}}, TS_GOALS: {...}, Lbar}`; `tsXg(t,o,home,TS)`, `tsMult(t,o,home,TS)`, `tsPcs(t,o,home,TS)`; `overUnderTags(live)`; `runAvg(teamId, fixtures, n)` → FDR 1–5 (comparison panel only).
- Rivals (E3): `rivalOwn(live)` → `{leagueId:{elementId:share}}`; `capShare(live)`; `classify(el, ctx)` → "EDGE"|"SHARED"|"DEAD"|"NEUTRAL"; `convergenceRisk(elementId, ctx)` → `{risk:boolean, max:number, league}`.
- Decisions (C1–C5): `captainPick(xiIds, ctx)` → `{capId, viceId, table[]}` (flagged excluded); `bestXI(ids, ctx)` → `{ids, capId, viceId, formation, score}`; `benchOrder(squadIds, xiIds, ctx)` → ordered bench ids (GKP separate); `sellCandidates(squad, ctx)`; `transferProtocol(state, ctx)` → `{moves[], captain, vice, value, margin, confidence:"HIGH"|"MED"|"LOW"|"hold", hits}`; `wildcardSolver(ctx, opts)` → `{ids, xi, cost, bank, score, model, steps, spend}`; `wildcardOptions(ctx, opts)` → `{pure, locked, written, locks, deltas, budget, note}` (the three priced answers to the C1.6 conflict: the rule-pure solve, the same solve with the written fifteen's convergent players locked in, and the written fifteen itself — all scored under one objective; it changes neither the solver default nor rule C1.6); `wildcardTiming(ctx)` → grid; `chipWindows(live)` → `{doubles[], blanks[], recommendation}`; `draftWaivers(state, ctx)` → ordered claims, each carrying `pool:"api"|"assumed"` and `roster:"api"|"saved"|"none"`; `watchlistAudit(codes, ctx)` → `{keep[], drop[]}`; `draftXI(codes, ctx, opts?)` → the C5 head-to-head eleven (`lean`, `tilted`, `h2h`, `note`).
- Draft league (C5 · F2): `draftLeagueInput(text)` → `{ok, kind:"league"|"entry"|"unknown", id, note}`; `draftOwnership(ctx)`; `draftPool(ctx, opts?)` (free agents only, ranked by EV, `eligible` = the three-start rule); `draftRosterOf(leagueEntryId, ctx)`; `draftRivalRosters(ctx)`; `waiverOrder(ctx)`; `h2hOpponent(ctx, gw)`; `draftRoster(state, ctx)`; `draftXIBase(codes, ctx, valueOf?)`; `playerSpread(el, ctx, iters, seed)`; `distStats(list)`; `mcDraftXI(ids, bench, ctx, iters, seed)` (no captain, draft scoring); `mcH2H(myIds, myBench, oppIds, oppBench, ctx, iters, seed)` (both elevens over shared fixture draws); `h2hProjection(ctx, opts?)`.
- Squad/state: `sanitiseState(raw)` (cap 15, dedupe on id, never throws); `detectSquadChange(stateSquadIds, picks)` → `{changed:boolean, added[], removed[], block:boolean}`; `ftAvailable(history, currentEvent)`; `sellPrice(now, purchase)`; `bankAfter(state, moves, els)` (tenths, raw).
- MC (E4): `simPlayer(el, ctx, rng)` (may be negative); `mcSquad(ids, capId, ctx, iters, seed)` → `{mean, sd, q10, q50, q90}`; `mcLeague(…)` → direction + rank band, never a raw P(win) when data < 8 GWs; `chipRegret(…)` → `{regretUse, …}`.
- Tournament (E5): `tournament(live)` → `{models:[{key,name,spearman,mae,maeRaw,perTransition[],transitions,wins,holdout,gate,promotable}], leader, promotable:boolean, transitions, transitionWinners[]}` with the **nine** named models — the eight of E5 plus `player_xg` (F5, added v88). `promotable` on the result is the transition-count half of the gate; each model's own `gate` is `promotionGate(…)`.
- Promotion gate (CLAUDE.md J): `promotionGate({transitions, wins, holdout, challenger, incumbent})` → `{promotable, transitions, wins, holdout, need, needHoldout, transitionsOk, winsOk, holdoutOk, reasons[], note}`. `TOURNAMENT_PROMOTE_AT` is 3 and `PROMOTION_HOLDOUT_WEEKS` is 2. **One function, used by the model tournament and by the minutes walk-forward** — a challenger may never be promoted through a second door.
- Calibration (F4): `logistic(z)` → [0,1] (NaN answers 0.5); `solveLinear(A,b)` → vector or null; `fitLogistic(X, y, opts?)` → `{ok, beta[], n, k, iters, converged, ridge, logLik, baseRate, note}` (ridge IRLS, the design matrix carries its own intercept); `brier(pred, out)` → `{brier, n, baseRate, baseBrier, skill, ok}`; `reliability(pred, out, bins?)` → `{bins:[{lo,hi,n,meanPred,meanOutcome,gap}], n, baseRate, maxGap, ok}`.
- Minutes model (F4, a challenger — it drives nothing): `minutesPanel(live)`; `minutesFeatureVector(hist, gw, deadlines)` → the `MINUTES_FEATURES` vector `[1, starts_last3, minutes_trend3, minutes_rate, days_since_last_start]`, every term bounded; `minutesRowsFor(live, gw, panel?)` → `{X, y, ids, seenFlag, n, seen, baseRate, note}` built from gameweeks **strictly before** `gw`; `minutesFit(live, uptoGw, opts?)` → `{ok, beta[], rows, gws[], terms[], …}`; `ctxMinutesFit(ctx, opts?)`; `minutesModel(el, ctx, opts?)` → `{p, pModel, pIncumbent, flagFactor, fitted, driving:false, driver:"pStart", features, terms[], fit, note}`; `truncateLive(live, uptoGw)`; `minutesWalkForward(live, opts?)` → `{folds[], comparable, wins, holdout, incumbent, challengerScore, gate, note}`. `terms` always declares `flag` (applied, not fitted — the snapshot has one status per player, not one per gameweek) and `european_load` (`available:false` — the fixture list is the Premier League list).
- Player xG (F5, the ninth challenger; E6 bars it from driving): `playerXg(el, ctx, opts?)` → `{xp, xpPerFixture, p, lambda, lambdaAssist, mult, att, def, xg90, xa90, fixtures, components, opponents[], note}`; `playerXgPredict(acc, prior, type, scoringRow, fixtures, TSprev)` (the same shape inside the walk-forward, from accumulators only); `strengthFromCounts(counts)` → `{TS, Lbar}`.
- Chips on the real calendar (F8): `eventMult(teamId, ctx, event)`; `xpEvent(el, ctx, event)`; `bestElevenForEvent(ctx, event, ids?)` → `{ids, score, formation, ok, pool, note}` (**no budget and no club cap — an upper bound, and it says so**); `chipValue(chip, event, ctx, opts?)` → `{chip, event, value, basis, detail, ok}`; `chipSolver(ctx, opts?)` → `{ok, doubles[], blanks[], confirmed, used[], candidates[], plan[], total, sets[], considered, windowNote, note, reasons[]}`. `CHIP_SETS` is `[{set:1,from:1,to:19},{set:2,from:20,to:38}]`; the two sets are solved **jointly**: one use per chip per set, inside that set's expiry, never two chips in one gameweek, and an explicit “no window is confirmed yet” when the fixture list carries no double and no blank.
- Refresh (D4): `parseJson(text)`; `pickText(contentBlocks)`; `refreshRequest(cfg)` builds the request body (model+tool pairing from `REFRESH_PAIRS`); `applyRefresh(state, parsed)` returns a new state or throws (never mutates on failure).
- Scoring (B1): `SCORING` table by position; `pointsFor(statsRow, elementType)` (FWD never CS; GKP never DefCon).

## 6. state/kwezi.json (exported app state; `sanitiseState` accepts exactly this)
```
{ "version": 87, "exported_at": ISO, "entry": 3546875,
  "squad": [ {"id": 109, "purchase": 45} … 15 ], "bank": 0, "ft": 3, "value": 1000,
  "confirmed_gw": 3,                                     // last GW whose picks the manager confirmed (D3 block clears when equal to live)
  "leagues": [1314671,1683215,26474,512557,989793,512550],
  "draft": { "league_id": null, "entry_id": null, "league_input": "…"?, "roster": [codes…], "watchlist": [codes…] },
  "ui": { "mode": "simple", "tab": "command", "open": {}, "reveals": {} },
  "ledger": [ {gw, type, pick, alt, xp_pick, xp_alt, outcome, regret} ],
  "refresh": { "pair": "sonnet46", "last": null } }
```

## 7. UI contract (src/ui.jsx)
- Root `<div className="mc-root">` carries exactly 21 colour tokens as CSS custom properties: `--bg --bg2 --bg3 --line --text --dim --mute --grn --grn2 --pnk --pnk2 --amb --cyn --blu --pur --wht --shadow --focus --ok --warn --err`. Markup uses `var(--…)` only; **0 hex literals** in any `style`/`className` markup (hex may appear only inside the token definitions in the one `<style>` block).
- Class names the gates measure: `.btn` (≥38px tall) `.btn-sm` (≥32) `.tabi` (≥52) `.sec-h` (≥48) `.menu-i` (≥44) `.inp` (≥40) `.row` (≥38) `.refbar` `.gwbar` `.note` `.landing` `.reveal` `.section` `.boundary`.
- Seven equal-width icon tabs in this order, with `data-tab` values: `command · plan · squad · rivals · draft · chips · lab`.
- Lab tab sections: `lab-data` (primary, open) · `lab-refresh` · `lab-tour` · **`lab-minutes`** · `lab-ts` · `lab-ledger` · `lab-export` · `lab-import` · `lab-guide` · `lab-gloss`. `lab-minutes` is the F4 caveat panel: it names the model that is driving P(start) today, prints both Brier scores per walk-forward transition against the engine's own figures, carries the reliability curve behind `lab-min-rel` and the fitted and unfitted terms behind `lab-min-terms`, and states the gate and what would open it. Reveals: `lab-tour-chart`, `lab-min-rel`, `lab-min-terms`.
- Chips tab sections: `ch-now` (primary, open) · **`ch-solver`** · `ch-regret`. `ch-solver` is the F8 panel: both set expiries, the confirmed windows, the joint plan with each assignment's value, and an explicit “no window is confirmed yet” when there is none — which is the truth on the shipped snapshot. Reveal: `ch-solver-how`.
- Draft tab sections: `df-waivers` (primary, open) · `df-pool` · `df-h2h` · `df-xi` · `df-watch` · `df-league`. With a league id `df-waivers` leads with claims from the real pool and puts the written ones behind the `df-written` reveal; without one it keeps the written claims, the honest "free agents cannot be listed without the draft league id" notice and the `df-eng` reveal. The league control accepts an address, a league id or an entry id and shows what it read. Each tab button has `data-testid="tab-<name>"` and an `aria-label`.
- Header: `<h1 data-testid="title">`, `.status` line, `button[data-testid="refresh"]` (↻), `button[data-testid="menu"]` (⋯) opening `.menu` with 2 mode items (`.menu-i[data-mode="simple"|"full"]`) + 4 more (`guide`, `glossary`, `export`, `import`).
- Module-level components with props: `Section({id,title,open,onToggle,children})` (header `.sec-h`, body hidden unless open), `Reveal({id,label,open,onToggle,children})` (`▸` label), `GwActionCard({plan, ctx, mode})` — the landing card, shared by both modes, `<110` visible words, ≤4 panels, decision only; `Boundary` (error boundary rendering `.boundary`). No components defined inside `App`.
- Persistence: `ui` (mode, tab, open sections, reveals) and `state` (§6) saved through `store` = `{get(key), set(key, value)}` async over `window.storage` (artifact: `await window.storage.get(key)` → `{value}`|null; `set(key, value)`), falling back to `localStorage`. Keys: `mc_state`, `mc_ui`. Reload reopens the saved tab.
- Modes: `simple` = landing card + status only; `full` = tabs. Both render `GwActionCard` first.
- LIVE: when `now` is between the current deadline and the last fixture finishing, transfer panels are hidden and the landing shows live points.
- D3 block: when `detectSquadChange` says `block`, every recommendation panel shows the `.block` notice with the added/removed players and a confirm button; nothing else is recommended.
- Refresh: `button[data-testid="refresh"]` → `.refbar` visible while pending; success replaces `LIVE`-derived state; failure shows `.err` with the first 140 chars of the real message and leaves state unchanged. Retry with backoff only on 429/5xx/timeout/network.
- Copy: SA English, no hyperlinks, no "pre-season" language, labels read `GW4` from `LIVE.next_event`, never hard-coded.
- `prefers-reduced-motion` disables transitions; every interactive element has `:active{transform:scale(.97)}`.
- Type floor 11px everywhere (measured on every visible element).

## 8. QA harness (qa/harness.cjs) and suite output
- `harness.cjs` exports `buildPage({inlineData})` → HTML string (esbuild bundle of the assembled JSX with React from node_modules); `launch()` → Playwright Chromium with `executablePath: "/opt/pw-browsers/chromium"` (the installed browser build is 1194; Playwright 1.63 would otherwise look for 1243 — never run `playwright install`); `open(page, {mode, state, ui, now, mocks})` sets storage before load; `visibleText(page)` (innerText of `.mc-root`, never `textContent`); `assert(name, cond, detail)` printing `PASS name` / `FAIL name — detail`; `done(suite)` printing `SUITE <name> <pass>/<total>` and exiting 1 on any FAIL. When `/opt/pw-browsers/chromium` does not exist (the CI runner), `launch()` must fall back to Playwright's default Chromium, which `gate.yml` installs with `npx playwright install --with-deps chromium` before the browser suites (ERRORS.md E-027 note).
- `qa/run.sh`: `node --check`-equivalent via esbuild → tdz → build → tdz (built) → verify → validate_live → unit_engine → smoke → smoke_wk → realistic → **components** → buttons → **webkit** → mc_full → mc_all; prints `ALL PASS` only if every suite passed. It takes exactly one optional argument: **`--release`**, which runs `mc_full` at 25000 instead of 3000. **A tag is cut only after a `--release` run** (CLAUDE.md H3): the release count is what found E-035 and E-036, and neither showed at 3000. The last line before the verdict says which mode ran. Any other argument exits 2.
- `qa/components.cjs`: the component OUTPUT suite. Every capitalised top-level function is rendered on its own through `react-dom/server` against the REAL react/recharts/lucide-react, from the shipped snapshot, from four degraded-but-legal contexts, and with the 20 junk kinds in one prop slot at a time. Its ownership map (which component must render which `data-testid`) is scanned out of `app/FPL_Mission_Control.jsx` rather than typed, so a testid added to the app cannot drift away from the suite; the four testids that only a user event can produce are named in `SSR_UNREACHABLE` with the browser suite that clicks each one. Bar: `SUITE components 132/132`.
- `qa/mc_full.cjs`: runs its fuzz loop in a worker thread. The parent watches a SharedArrayBuffer heartbeat and turns a call that does not return inside `MC_WATCHDOG_MS` (10000) into `FAIL mc_full-watchdog — «<function> [<kinds>]»`, with a self-test on a deliberately unbounded worker proving the watchdog fires.
- `qa/mc_all.cjs`: prints the number of distinct universes each invariant ran against and fails below the floor (25 for the expensive invariants, 5 for the rest). Expensive invariants draw from a deep bank refreshed every 24 draws; `MC_DEEP_W=0` restores the pre-v88 behaviour. `verify.sh` needs network (live reconciliation); if the API is unreachable it prints `SKIP live (offline)` for those checks and fails only the invariants.
- Mocking the Anthropic API in tests: `page.route("https://api.anthropic.com/**", …)`. Mock a **400** to test "clears" (500 is retried).
- Mocked time: pass `now` (ISO) and the page sets `window.__NOW__`; the app reads `nowISO()` which prefers `window.__NOW__`.

- `qa/webkit.js` — **Safari-engine acceptance** (the one suite that is not Chromium). Named `.js` rather than `.cjs` because the package has no `"type": "module"`, so `.js` is already CommonJS here, and the sibling fitness project uses the same `qa/webkit.js` name for the same job. It reuses `harness.cjs` for `bundleApp()`, `assert`, `done` and `PAGE_URL`, and carries its own launcher (`playwright.webkit`, no `executablePath`) and its own page shell, because `harness.launch()` is pinned to Chromium and `harness.open()` installs an **in-memory** `window.storage` that `localStorage.clear()` cannot wipe — this suite has to be able to wipe storage for real. Two shells over one bundle: with the `window.storage` shim (the artifact path) and without it (the `localStorage` fallback). Never run `npx playwright install webkit` in the sandbox; the browser is present and its download validation fails.
  **Bar: `SUITE webkit 30/30`, exit 1 on any FAIL.** It covers: boot of `dist/index.html` from a `file://` URL and of the harness page with zero page errors; the seven tabs in full mode and the landing in simple mode with no `.boundary`; the engine-dependent Part G gates re-measured under WebKit (landing < 110 visible words, every tab < 500, the 11px type floor, the seven touch floors, seven equal-width tabs, no horizontal scroll at 360px and 390px) with every number printed; both storage paths persisting mode, tab and open sections across a reload; export → wipe → import restoring the squad; the refresh error path on a mocked 400 clearing `.refbar` and leaving the state unchanged; the D3 block rendering and clearing on confirm; and 390×844 screenshots of all seven tabs written to `qa/shots/webkit-<tab>.png`.

## 9. Sandbox facts (11 Sep 2026)
Chromium is preinstalled at `/opt/pw-browsers/chromium`; **WebKit 26.6 launches too** (`install-deps webkit` has been run; `npx playwright install webkit` fails its download validation and must not be run). Both FPL APIs reachable through the proxy. GW4 deadline 2026-09-12T12:30:00Z; draft GW4 waivers 2026-09-11T12:30:00Z. Kwezi's GW1–GW3 picks are identical (ids 4,12,31,40,109,165,175,212,259,368,397,411,423,496,552); bank 0; value 1000; no chips used; FT for GW4 = 3. Overall rank 5,081,388 (`entry` summary) / 5,081,590 (`history` GW3). Draft league id unknown.

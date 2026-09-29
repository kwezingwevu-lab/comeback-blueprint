# CONTRACT.md — build conventions for FPL Mission Control (v89)

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
`app/FPL_Mission_Control.jsx` = in this order (v110 D0, 27 Sep 2026: eight blocks, sixteen markers):
1. the import lines from the top of `src/ui.jsx` (`react`, `recharts`, `lucide-react`) — imports must stay first in an ES module;
2. `// ENGINE — START` … contents of `src/engine.js` … `// ENGINE — END`;
3. `// MC ENGINE — START` … `src/mc_engine.js` verbatim inside a two-line wrapper — `const MCEngine = (function () { const module = { exports: {} }; const exports = module.exports;` above it and `return module.exports; })();` below it — … `// MC ENGINE — END`. The module is UMD and the assembled file is an ES module that `qa/components.cjs` and `qa/mc_full.cjs` evaluate under Node with a `module` of their own in scope, so a bare `module.exports = factory()` would be assigned over the harness's object; inside the wrapper it lands on the wrapper's own `module` and becomes the one binding the app reads, `MCEngine`;
4. `// WEEKLY STRATEGY ENGINE — START` … contents of `data/weekly.js` … `// WEEKLY STRATEGY ENGINE — END`;
5. `// LIVE DATA — START` … `const LIVE = <data/live.json as a JS literal>;` … `// LIVE DATA — END`;
6. `// MC DATA — START` … `const MC = <data/mc_data.json as a JS literal>;` … `// MC DATA — END`;
7. `// PLAN — START` … `const PLAN = <data/plan.json as a JS literal>;` … `// PLAN — END`;
8. `// PRECOMPUTED — START` … `const PRE = <data/pre.json as a JS literal>;` … `// PRECOMPUTED — END` — `data/pre.json` is written by `pipeline/precompute.cjs`, which `build.cjs` runs first and which refuses (exit 3) when `data/plan.json` was solved on data other than `data/mc_data.json`;
9. the rest of `src/ui.jsx` (everything after its import lines), which ends with `export default function App(){…}` (or `export default App`);
10. `// MC UI — START` … `src/mc_ui.jsx` verbatim … `// MC UI — END` — module-level components (`TabOdds`, `TabReview` and the Build phase's) in the same module scope as the ui body, with no import or export of their own; function declarations are hoisted, so App renders them although they follow it.
Also stamps `const APP_VERSION = "v87";` (from package.json `version` major) right after the imports. Marker text is exact (em dash, one space each side), and no source may contain a marker's text. `verify.sh` I5 reads the marker list from this section — every backticked START and END marker above, in the order written — and asserts each appears exactly once in that order; I8 compares every block with its source (the wrapper's two lines exactly, the data blocks as parsed JSON, `at` in `data/pre.json` excepted as a clock); I23 holds `data/pre.json`, `data/plan.json`, the WEEKLY block and the export hash of `data/mc_data.json` to one content hash.

`dist/index.html`: esbuild bundle of the assembled JSX (`--bundle --format=iife --jsx=automatic --loader:.jsx=jsx --minify-syntax`) inlined in one HTML file with a tiny `window.storage` shim over `localStorage` (only if `window.storage` is absent) and `<div id="root">`. Mobile viewport meta. No external requests except the D4 refresh path.

The shim keeps the artifact's contract, which Anthropic documents as **text only** (28 Sep 2026, IOS27-04 and IOS27-05): `get(k)` resolves `{ key, value: <the stored text> }` or `null`; `set(k, v)` stores a string as it is and anything else as its JSON text, so the bytes in `localStorage` are the same whichever path wrote them. A write that throws (QuotaExceededError in a full store or in private browsing, SecurityError in a sandboxed frame) resolves **`false`** and leaves `{ name, message }` on `window.storage.__error`; a good write resolves `true` and clears it. `window.storage.__shim === "localStorage"` is the marker that says the page is the dist build: **the artifact never has it**, and it is the only thing the app reads to tell the two hosts apart (never the user agent).

`dist/sw.js` (IOS27-07, IOS27-17): a navigation is fetched with `new Request(url, { cache: "no-cache", redirect: "manual" })`, so it is revalidated on every open whatever `max-age` the host sends, and it races a timer, `var RACE_MS = 3000`: when the network has not answered in that time the cached `./index.html` answers, and the fetch is left to finish under `e.waitUntil` so the cache holds the new copy for the next open; with no cached shell the worker waits for the network, and offline it answers from the cache as before. The worker still calls `skipWaiting()` after its precache and also takes over on a `{ type: "SKIP_WAITING" }` message. The registration block in the page (bracketed by `/* PWA — START */` and `/* PWA — END */`, executed by verify.sh I19) registers `sw.js` with scope `./`, and after a registration keeps `reg`: on `visibilitychange` to visible it calls `reg.update()` at most once in 30 minutes, the throttle starting unarmed so the first return checks; on a `controllerchange` over an existing controller (or a worker left waiting) it sets `window.__PWA__.updated = true` and dispatches `mc-sw-updated`. The first worker claiming an uncontrolled page is not an update.

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
  version: 89, gw: 6, written: "2026-09-26", source: "src/engine.js on data/live.json fetched <ISO>",
  // v89: a plan that is replaced records what it replaced. `superseded` carries the previous
  // version, gameweek, plan and what actually happened, so an unplayed recommendation is not
  // quietly deleted from the record.
  superseded: { version, gw, plan, what, outcome, measured, evidence },
  classic: {
    plan: "wildcard",                                   // "wildcard" | "transfers" | "hold"
    wildcard15: [411,124,115,330,391,388,94,98,229,572,428,68,350,316,379],
    locks: [411],                                       // v89: the convergent players (rivalOwn ≥ 0.60)
                                                        // the written fifteen keeps on purpose. The ONLY
                                                        // exemption rule C1.6 takes; smoke_wk reads it.
    captain: 124, vice: 94,                             // of the WILDCARD fifteen's eleven
    fallback: { moves: [{out:175,in:115},{out:212,in:127},{out:552,in:316}], captain: 411, vice: 12 },
                                                        // fallback.captain is the captain of the FALLBACK
                                                        // eleven and may differ from classic.captain (E-083)
    chip: "wildcard", notes: [...],
    why: [...]                                          // v89: one line per number that drives the plan,
                                                        // each reproducible from a named engine function
  },
  draft: {
    pool: "assumed" | "api",                            // v89: where the `in` side came from. With no
    pool_note: "…",                                     // league id the pool cannot be seen, so the ins
                                                        // are the engine's best replacements over the
                                                        // whole list and say so in both fields.
    claims: [ {out:<code>, in:<code>, why:"…"}, … in claim order … ],
    xi: { formation: "3-5-2", gk: <code>, def: [...], mid: [...], fwd: [...] },
    watchlist: [ …codes with three starts… ]
  },
  chips: { set1_expires_gw: 19, planned: [{set,chip,gw}], note: "…" },
  tournament: { leader: "player_xg", transitions: 4, promote_at_gw: 6 },
  timing: { now_vs_later: { by_gw19, by_gw38, breakeven_double_gw17, breakeven_later_value } }
  // timing is a note recomputed by the engine every render. `breakeven_double_gw17` is null when
  // the fixture list carries no double gameweek to price; `breakeven_later_value` (v89) is what a
  // later window would have to be worth for waiting to break even.
};
```
Nothing in this block is asserted as an invariant by a suite: the numbers in the comments are dated
observations and the suites recompute them (E-084). What IS asserted: every id resolves, the written
fifteen is `legal15` inside the selling value and carries no flagged player, every buy is unflagged
and under the convergence gate unless it is in `locks`, and each path's own captain and vice are in
that path's eleven.

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
- Tournament (E5): `tournament(live)` → `{models:[{key,name,spearman,mae,maeRaw,perTransition[],transitions,wins,holdout,gate,promotable}], leader, decidable:boolean, promotable:boolean, transitions, transitionWinners[], note}` with the **nine** named models — the eight of E5 plus `player_xg` (F5, added v88). **`decidable`** is the transition-count half of the gate: enough transitions exist for the gate to be DECIDED (`transitions >= TOURNAMENT_PROMOTE_AT`). It says nothing about any model passing. **`promotable`** means what the word reads as: at least one model's own gate is open (`models.some(m => m.promotable)`). Until v88 the second name carried the first meaning and the Lab panel printed "Promotable: yes" over a table in which nothing was promotable (E-086). Each model's own `gate` is `promotionGate(…)` and its `promotable` is that gate's verdict.
- Promotion gate (CLAUDE.md J): `promotionGate({transitions, wins, holdout, challenger, incumbent})` → `{promotable, transitions, wins, holdout, need, needHoldout, transitionsOk, winsOk, holdoutOk, reasons[], note}`. `TOURNAMENT_PROMOTE_AT` is 3 and `PROMOTION_HOLDOUT_WEEKS` is 2. **One function, used by the model tournament and by the minutes walk-forward** — a challenger may never be promoted through a second door.
- Calibration (F4): `logistic(z)` → [0,1] (NaN answers 0.5); `solveLinear(A,b)` → vector or null; `fitLogistic(X, y, opts?)` → `{ok, beta[], n, k, iters, converged, ridge, logLik, baseRate, note}` (ridge IRLS, the design matrix carries its own intercept); `brier(pred, out)` → `{brier, n, baseRate, baseBrier, skill, ok}`; `reliability(pred, out, bins?)` → `{bins:[{lo,hi,n,meanPred,meanOutcome,gap}], n, baseRate, maxGap, ok}`.
- Minutes model (F4, a challenger — it drives nothing): `minutesPanel(live)`; `minutesFeatureVector(hist, gw, deadlines)` → the `MINUTES_FEATURES` vector `[1, starts_last3, minutes_trend3, minutes_rate, days_since_last_start]`, every term bounded; `minutesRowsFor(live, gw, panel?)` → `{X, y, ids, seenFlag, n, seen, baseRate, note}` built from gameweeks **strictly before** `gw`; `minutesFit(live, uptoGw, opts?)` → `{ok, beta[], rows, gws[], terms[], …}`; `ctxMinutesFit(ctx, opts?)`; `minutesModel(el, ctx, opts?)` → `{p, pModel, pIncumbent, flagFactor, fitted, driving:false, driver:"pStart", features, terms[], fit, note}`; `truncateLive(live, uptoGw)`; `minutesWalkForward(live, opts?)` → `{folds[], comparable, wins, holdout, incumbent, challengerScore, gate, note}`. `terms` always declares `flag` (applied, not fitted — the snapshot has one status per player, not one per gameweek) and `european_load` (`available:false` — the fixture list is the Premier League list).
- Player xG (F5, the ninth challenger; E6 bars it from driving): `playerXg(el, ctx, opts?)` → `{xp, xpPerFixture, p, lambda, lambdaAssist, mult, att, def, xg90, xa90, fixtures, components, opponents[], note}`; `playerXgPredict(acc, prior, type, scoringRow, fixtures, TSprev)` (the same shape inside the walk-forward, from accumulators only); `strengthFromCounts(counts)` → `{TS, Lbar}`.
- Chips on the real calendar (F8): `eventMult(teamId, ctx, event)`; `xpEvent(el, ctx, event)`; `bestElevenForEvent(ctx, event, ids?)` → `{ids, score, formation, ok, pool, note}` (**no budget and no club cap — an upper bound, and it says so**); `chipValue(chip, event, ctx, opts?)` → `{chip, event, value, basis, detail, ok}`; `chipSolver(ctx, opts?)` → `{ok, doubles[], blanks[], confirmed, used[], candidates[], plan[], total, sets[], considered, windowNote, note, reasons[]}`. `CHIP_SETS` is `[{set:1,from:1,to:19},{set:2,from:20,to:38}]`; the two sets are solved **jointly**: one use per chip per set, inside that set's expiry, never two chips in one gameweek, and an explicit “no window is confirmed yet” when the fixture list carries no double and no blank.
- Refresh (D4): `parseJson(text)`; `pickText(contentBlocks)`; `refreshRequest(cfg)` builds the request body (model+tool pairing from `REFRESH_PAIRS`); `applyRefresh(state, parsed)` returns a new state or throws (never mutates on failure).
- Scoring (B1): `SCORING` table by position; `pointsFor(statsRow, elementType)` (FWD never CS; GKP never DefCon).

## 6. state/kwezi.json (exported app state; `sanitiseState` accepts exactly this)
```
{ "version": 89, "exported_at": ISO, "entry": 3546875,
  "squad": [ {"id": 496, "purchase": 45} … 15 ], "bank": 16, "ft": 4, "value": 999,
  "confirmed_gw": 5,                                     // last GW whose picks the manager confirmed (D3 block clears when equal to live)
  "leagues": [1314671,1683215,26474,512557,989793,512550],
  "draft": { "league_id": null, "entry_id": null, "league_input": "…"?, "roster": [codes…], "watchlist": [codes…] },
  "ui": { "mode": "simple", "tab": "command", "open": {}, "reveals": {} },
  "ledger": [ {gw, type, pick, alt, xp_pick, xp_alt, outcome, regret} ],
  "refresh": { "pair": "sonnet46", "last": null },
  "market": { "6": { "ARS": { "xg": 1.85 } } },          // v110 D0: the Odds tab's overrides — gameweek 1–38 → team short name (the engine's teamNames, passed as sanitiseState(raw, { teams }); without it a three-letter capital name) → finite xg 0.2–5; anything else dropped, capped at 200; applied by App through MCEngine setMarket
  "done": { "6:claims": true },                           // v110 D1: the Command tab's checklist ticks — "<gameweek 1–38>:<item, 2–12 lower-case letters>" → true only (an untick deletes the key); anything else dropped, capped at 100; written by App's on.done(key)
  "notes": { … }                                         // v89, NOT imported: see below
}
```
`sanitiseState` keeps exactly the fields above and drops everything else, so a field this file
carries and that list does not never reaches the app.

**`squad[].purchase`** is the price paid, in tenths. For a player held since GW1 it is
`now_cost − cost_change_start`, which is exact. For one bought later the public API will not
itemise the price without a login, so it is derived from the constraint the history does give:
with one transfer and no hit, `bank_after − bank_before === sell(out) − buy(in)` exactly. A derived
price is stated as derived, with its working, and is never presented as read.

**`notes`** (v89) is a record carried by the file and **not imported**: the derivation of every
number above, written so a human can check it against the snapshot. It exists because the state
file is the state of record in git and a number without its working is not checkable. Nothing reads
it at runtime, and `notes.read_by_the_app` is `false` to say so in the file itself.

**`ledger`** (roadmap F6) is the decision ledger, eight fields fixed by `sanitiseState`:
- `gw` — the gameweek the decision was made for; it must be a gameweek `history.current` has played.
- `type` — `"chip" | "transfer" | "captain" | "xi"`.
- `pick` — what the app recommended (an element id, or a label of up to 40 characters).
- `alt` — what the manager actually did.
- `xp_pick` / `xp_alt` — the **ex-ante** expectation, and only where one was recorded at the time.
  `0` means "no ex-ante figure was recorded", not "an expectation of zero". They are never
  rebuilt from a later snapshot: one price, one status and one cumulative stat line per player
  means any such rebuild reads the gameweek it is predicting (E-069).
- `outcome` — the realised squad points of that gameweek as played (T0, `history.current[].points`).
- `regret` — the **marginal** squad points the recommendation would have ADDED. Positive means
  ignoring the app cost that many points; negative means the manager's own call was better; `null`
  means the app had no recommendation of record. Counterfactual squads were never played and so
  have no played eleven: they are scored on the hindsight-optimal legal eleven with the recommended
  captain doubled, which makes a squad-level `regret` an **upper bound**, and the `xi` row for the
  same gameweek isolates the eleven-and-bench part on the same basis so the two net.
Every `regret` is recomputed from the snapshot's own `gw[<n>]` rows by
`qa/unit_engine.cjs` "LIVE-LEDGER-the-captain-and-xi-regrets-recompute-from-the-event-live-rows",
so a typed number cannot survive in this file.

## 7. UI contract (src/ui.jsx)
- Root `<div className="mc-root">` carries exactly 21 colour tokens as CSS custom properties: `--bg --bg2 --bg3 --line --text --dim --mute --grn --grn2 --pnk --pnk2 --amb --cyn --blu --pur --wht --shadow --focus --ok --warn --err`. Markup uses `var(--…)` only; **0 hex literals** in any `style`/`className` markup (hex may appear only inside the token definitions in the one `<style>` block).
- Class names the gates measure: `.btn` (≥44px tall) `.btn-sm` (≥32) `.btn-ic` (≥44×44, the header ↻ and ⋯) `.tabi` (≥52 tall, ≥28 wide) `.sec-h` (≥48) `.menu-i` (≥44) `.inp` (≥44 tall, text ≥16px) `.row` (≥38) `.reveal` (≥44) `.refbar` `.gwbar` `.note` `.landing` `.reveal` `.section` `.boundary`.
- Seven equal-width icon tabs in this order, with `data-tab` values: `command · plan · squad · rivals · draft · chips · lab`.
- v110 D0 (27 Sep 2026) supersedes the line above: **nine** equal-width tabs, `command · plan · squad · rivals · draft · chips · odds · review · lab` (`odds` → `TabOdds`, primary `od-next`; `review` → `TabReview`, primary `rw-classic`; both in `src/mc_ui.jsx`), labels at 11px above 380px and icon-only at 380px and below with the name in `aria-label` (CLAUDE.md Part G); every tab and the landing card receive `mc = { MC, PLAN, PRE, E }`, `E = MCEngine.create(MC)` made once in App.
- Lab tab sections: `lab-data` (primary, open) · `lab-refresh` · `lab-tour` · **`lab-minutes`** · `lab-ts` · `lab-ledger` · `lab-export` · `lab-import` · **`lab-device`** · `lab-guide` · `lab-gloss`. `lab-device` ("This device", closed on first paint, so it adds two words to Lab's first paint and nothing more) is the on-device readout of IOS27-15: `DeviceReadout`, read when the section opens and again on a resize or turn, never typed (see "Device readout" below). `lab-minutes` is the F4 caveat panel: it names the model that is driving P(start) today, prints both Brier scores per walk-forward transition against the engine's own figures, carries the reliability curve behind `lab-min-rel` and the fitted and unfitted terms behind `lab-min-terms`, and states the gate and what would open it. Reveals: `lab-tour-chart`, `lab-min-rel`, `lab-min-terms`.
- Chips tab sections: `ch-now` (primary, open) · **`ch-solver`** · `ch-regret`. `ch-solver` is the F8 panel: both set expiries, the confirmed windows, the joint plan with each assignment's value, and an explicit “no window is confirmed yet” when there is none — which is the truth on the shipped snapshot. Reveal: `ch-solver-how`.
- Draft tab sections: `df-waivers` (primary, open) · `df-pool` · `df-h2h` · `df-xi` · `df-watch` · `df-league`. With a league id `df-waivers` leads with claims from the real pool and puts the written ones behind the `df-written` reveal; without one it keeps the written claims, the honest "free agents cannot be listed without the draft league id" notice and the `df-eng` reveal. The league control accepts an address, a league id or an entry id and shows what it read. Each tab button has `data-testid="tab-<name>"` and an `aria-label`.
- Header: `<h1 data-testid="title">`, `.status` line (GW, deadline, FT, bank, version; while a refresh or a check is in flight the bank and the version give way to **"Refreshing…"**, so progress is never carried by the `.refbar` animation alone, which stops under Reduce Motion, and the line stays on one row at 390), `button[data-testid="refresh"]` (↻, `aria-label` "Refresh player data" in the artifact and "Check for new data" in the dist build), `button[data-testid="menu"]` (⋯) opening `.menu` with 2 mode items (`.menu-i[data-mode="simple"|"full"]`) + 4 more (`guide`, `glossary`, `export`, `import`).
- Module-level components with props: `Section({id,title,open,onToggle,children})` (header `.sec-h`, body hidden unless open), `Reveal({id,label,open,onToggle,children})` (`▸` label), `GwActionCard({plan, ctx, mode})` — the landing card, shared by both modes, `<110` visible words, ≤4 panels, decision only; `Boundary` (error boundary rendering `.boundary`), `StoreNotes`, `Announcer({text})` (the one `role="status"` region) and `DeviceReadout({mode, onCopy})`. No components defined inside `App`.
- Persistence: `ui` (mode, tab, open sections, reveals) and `state` (§6) saved through `store` = `{get(key), set(key, value)}` async over `window.storage` (artifact: `await window.storage.get(key)` → `{value}`|null; `set(key, text)`), falling back to `localStorage`. Keys: `mc_state`, `mc_ui`. Reload reopens the saved tab.
  **Text only (IOS27-04).** `set` writes `JSON.stringify(value)`; `get` parses a string `value` with a guard (an unreadable value, or one that is not an object, reads as `null`, so the app reseeds instead of crashing) and still accepts an object, so anything an older build saved keeps loading. Writes are queued, so results arrive in the order the writes were made. `store.set` resolves `{ ok, reason, mode }` and never rejects. **The first save of `mc_ui` is read back and compared** (no new storage key): `mode` becomes `"artifact"` (the host's own `window.storage`), `"local"` (`localStorage`, directly or through the dist shim) or `"none"` (the copy did not come back, or the first write failed); while it is `"none"` each later save is read back again, so a store that recovers is noticed. `data-store` on `.mc-root` carries it (`pending` until the first save is read back).
  **Notes (`StoreNotes`, module level, above every view inside `.wrap`).** Mode `"none"`: `.note-w` **"This copy is not saving on this device. Export before you close it."** A failed write in any other mode: `.note-w` **"Last change not saved (<reason>). Export now."**, the reason short and in words (`storage is full`, `storage is blocked here`, else the error's own message, 60 characters at most), cleared by the next good write of that key; the two never show together. A newer build waiting: a `.btn.upd` button **"New build ready. Tap to reload."**, which posts `SKIP_WAITING` to a waiting worker and reloads on its `controllerchange` (or after two seconds), or reloads at once with none waiting; the state is saved on every change, so the reload loses nothing. First launch as an installed app with nothing saved in the dist build (`runsAsApp()` and `store.get(mc_state)` empty and the state not yet imported): a `.btn.upd` button **"New here? Import the export from Safari."** on the landing, which opens Lab, Import. The notes count toward the landing's 110 words while they show.
  **`navigator.storage.persist()`** is called once, after the first save that was read back in mode `"local"`, where it exists; nothing else calls it.
  **Host and mode without the user agent (IOS27-10).** `hostIsDist()` = `window.storage.__shim` is set; `runsAsApp()` = `matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches` or `navigator.standalone === true` (iOS reports fullscreen where a manifest says standalone, WebKit bug 264218, and `toolbar.visible` now returns a static value, so neither the bare standalone query nor `toolbar.visible` is used). `navigator.userAgent` is never read (a static gate in qa/ios.cjs).
- Modes: `simple` = landing card + status only; `full` = tabs. Both render `GwActionCard` first.
- LIVE: when `now` is between the current deadline and the last fixture finishing, transfer panels are hidden and the landing shows live points.
- D3 block: when `detectSquadChange` says `block`, every recommendation panel shows the `.block` notice with the added/removed players and a confirm button; nothing else is recommended.
- Refresh: `button[data-testid="refresh"]` → `.refbar` visible while pending; success replaces `LIVE`-derived state; failure shows `.err` with the first 140 chars of the real message and leaves state unchanged. Retry with backoff only on 429/5xx/timeout/network. **In the artifact only.** The D4 request needs the artifact's keyless proxy, so **in the dist build (`window.storage.__shim` set) ↻ and Lab's refresh button send no request to api.anthropic.com**: they ask the server for a newer build (`registration.update()`, which requests `sw.js`) and, with no worker to ask (file://, an engine without service workers), reload the page. A newer build found: the "New build ready" note. Nothing newer: a `.note` "Nothing newer: this is the latest build, with the snapshot taken <day hh:mm> SAST." for eight seconds (Lab shows it in its own section). A server that does not answer in 15 seconds, or an update that fails: `.err` "Could not check for a newer build: <reason>". Lab's refresh section in the dist build drops the model select.
  **Outcomes are spoken (IOS27-11).** One `Announcer` (`div.vh[role="status"][data-testid="announce"]`) is mounted for good as the first child of `.mc-root` after the style block, never keyed, and only its text changes. When a refresh settles, in the effect that runs after `.refbar` has left the DOM, `refreshMessage(err, dist, okMsg, gw)` builds the sentence from the game week the app is on: **"Refreshed, GW<next_event> data"** (artifact success), **"Refresh failed: <first 60 characters of the reason>"** (either build), and in the dist build **"Nothing newer. GW<next_event> data is the latest."** or **"A newer build was found."**; 80 characters at most. Where `document.body.ariaNotify` is a function (Safari 27) it is called once and the region stays empty; otherwise the region carries the text. Exactly one path speaks. The region is cleared when the next refresh starts, so an outcome that repeats is still a change. `.vh` is the class that keeps a node in the accessibility tree and off the screen (`clip`, 1px, no colour). No other element in the app has a live role.
  **Where a jump lands (IOS27-08).** `goTab` and `jump` bump one `nav` counter in the same batch as the tab change, and one layout effect (after the new view has drawn, before it paints) calls `landOn(id)`: no id (a tab switch, including a tap on the tab already open) is `window.scrollTo(0, 0)`, so the first section sits just under the tab strip; an id (menu → Guide, Glossary, Export, Import) is `scrollIntoView({block: "start"})` on `[data-section=id]` and then `.sec-h.focus({preventScroll: true})`. `.section{scroll-margin-top:calc(73px + var(--sat))}` (the strip is 65px: 6 + 52 + 6 + its 1px edge; 8px to spare) keeps the section clear of the pinned strip and of the status-bar inset. Window scrolling only, nothing scrolls on the first render, so a reload keeps the position the browser restored. Where `scroll-margin` is ignored the section lands under the strip by at most its height; where `preventScroll` is ignored the header is already in view.
- Copy: SA English, no hyperlinks, no "pre-season" language, labels read `GW4` from `LIVE.next_event`, never hard-coded.
- `prefers-reduced-motion` disables transitions and animations and the press scale: every interactive element has `:active{transform:scale(.97)}`, and inside the media query each of those selectors has a `transform:none` twin of equal or higher specificity (`.mc-root button:active` is matched by `.mc-root button:active`, the classes by `.mc-root .btn:active` and its siblings; the shorter `.btn:active` loses) with the press shown as a `--line` background instead.
- Type floor 11px everywhere (measured on every visible element); form controls (`input`, `select`, `textarea`, all `.inp`) 16px or more, and the viewport meta carries no maximum-scale or user-scalable.
- Safe area: four custom properties on `:root` (never on `.mc-root`): `--sat --sar --sab --sal` = `env(safe-area-inset-top|right|bottom|left, 0px)`. `.hdr`, `.tabs`, `.wrap`, `.menu` and `.mc-root` consume them (`.tabs{top:var(--sat)}`, `.menu{top:calc(70px + var(--sat));right:max(10px,var(--sar))}`, `.mc-root{padding-bottom:calc(44px + var(--sab))}`), `.mc-root::before` is the fixed status-bar band painted `var(--bg2)`, and the root's height is `min-height:100vh;min-height:100svh` (the same pair on the shell's `#root`).
- Increase Contrast: one `@media (prefers-contrast: more){.mc-root{…}}` block in the same `<style>` redefines `--dim`, `--mute` and `--line` (names from the 21 only; hex allowed there, as in the base token block, and nowhere else). Under forced colours `.reveal`, `.sec-h` and `.menu-i` draw a 1px inside outline so every control keeps an edge.
- Tap feedback: `.mc-root{-webkit-tap-highlight-color:transparent}`; `.tabi .btn .btn-sm .btn-ic .sec-h .menu-i .reveal` carry `-webkit-user-select:none;user-select:none;-webkit-touch-callout:none`.
- Export and import (IOS27-14). **Export** (`export-download`) hands the share sheet one file, `new File([json], "mc_state_gw<next_event>.json", {type: "application/json"})`, `navigator.share({files: [f], title: "FPL MC state"})`, when `navigator.share` and `navigator.canShare` exist and `canShare({files: [f]})` is true; the button then reads "Share or save" ("Download" otherwise). `share()` is called in the tap's own tick, because it needs the tap's transient activation. Closing the sheet (`AbortError`) is an answer; any other refusal, and every browser without a sheet for files, falls back to the blob download of the same name (in the tap's own tick when there is no sheet to open). **Import** keeps the paste box and adds `<label class="btn filebtn">Import from a file<input type="file" accept="application/json,.json" data-testid="import-file"></label>`: the label is the 44px control and the real input is laid over it at full size with `opacity:0` (so the tap lands on the input, a screen reader gets a full-size frame, and the label's border is the edge people see; its focus ring is `.filebtn:focus-within`), the file is read with `file.text()` (a `FileReader` before Safari 14) and passed to the same `onImport(text)` the paste box calls, so the same parse, `sanitiseState` and "no squad in that file" error apply; a file over 5 MB or one that cannot be read shows `.err` (`import-file-err`). This is the carry path between a Safari tab and the Home Screen app, which share no storage.
- Keyboard hints (IOS27-19). The draft-league field (`draft-league`) carries `autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done"` and no `inputmode` (it takes addresses and numeric ids); Enter does what Save does (nothing when the text is unchanged) and then dismisses the keyboard. The import box (`import-text`) carries `autocapitalize="none" autocorrect="off" spellcheck="false"`; Enter there is a newline.
- Device readout (IOS27-15). `DeviceReadout` prints, as `.kv` rows that can be selected, and copies them as text with `device-copy`: window `innerWidth×innerHeight`, screen, pixel ratio, the four safe-area insets (read from a probe element's padding through `--sat --sar --sab --sal`, so the readout shows what the layout got), which display modes match (`standalone`, `fullscreen`, `browser`, one query each: a diagnostic that decides nothing, unlike `runsAsApp()`), `navigator.standalone`, the storage mode App holds (`artifact`, `local`, `none`, `pending`; anything else reads n/a), `navigator.storage.persisted()` and `estimate()` (asked once), `__PWA__.sw`, whether `ariaNotify`, a share sheet for files and `storage.persist()` exist, and `prefers-contrast`, `prefers-reduced-motion` and `prefers-color-scheme`. Every field is a feature read that answers `n/a` where its API is missing; `navigator.userAgent` is never read. The numbers it prints from a phone replace the placeholder insets in qa/ios.cjs and say which Playwright profile to use.

## 8. QA harness (qa/harness.cjs) and suite output
- `harness.cjs` exports `buildPage({inlineData})` → HTML string (esbuild bundle of the assembled JSX with React from node_modules); `launch()` → Playwright Chromium with `executablePath: "/opt/pw-browsers/chromium"` (the installed browser build is 1194; Playwright 1.63 would otherwise look for 1243 — never run `playwright install`); `open(page, {mode, state, ui, now, mocks})` sets storage before load; `visibleText(page)` (the text a person can see under `.mc-root`, from a walk over its text nodes that skips `<style>`, `<script>`, `[hidden]`, `aria-hidden` subtrees, nodes with no client rects and every unselected `<option>`, IOS27-16: not `innerText`, which Safari 27 changed to keep the text of every option of a select, and not a bare `textContent`) and `visibleWords(page)` (its word count, the number the Part G gates use); `assert(name, cond, detail)` printing `PASS name` / `FAIL name — detail`; `done(suite)` printing `SUITE <name> <pass>/<total>` and exiting 1 on any FAIL. When `/opt/pw-browsers/chromium` does not exist (the CI runner), `launch()` must fall back to Playwright's default Chromium, which `gate.yml` installs with `npx playwright install --with-deps chromium` before the browser suites (ERRORS.md E-027 note).
- `qa/run.sh`: `node --check`-equivalent via esbuild → tdz → build → tdz (built) → verify → validate_live → unit_engine → smoke → smoke_wk → realistic → **components** → buttons → **webkit** → mc_full → mc_all; prints `ALL PASS` only if every suite passed. It takes exactly one optional argument: **`--release`**, which runs `mc_full` at 25000 instead of 3000. **A tag is cut only after a `--release` run** (CLAUDE.md H3): the release count is what found E-035 and E-036, and neither showed at 3000. The last line before the verdict says which mode ran. Any other argument exits 2.
- `qa/components.cjs`: the component OUTPUT suite. Every capitalised top-level function is rendered on its own through `react-dom/server` against the REAL react/recharts/lucide-react, from the shipped snapshot, from four degraded-but-legal contexts, and with the 20 junk kinds in one prop slot at a time. Its ownership map (which component must render which `data-testid`) is scanned out of `app/FPL_Mission_Control.jsx` rather than typed, so a testid added to the app cannot drift away from the suite; the four testids that only a user event can produce are named in `SSR_UNREACHABLE` with the browser suite that clicks each one. Bar: `SUITE components 132/132`.
- `qa/mc_full.cjs`: runs its fuzz loop in a worker thread. The parent watches a SharedArrayBuffer heartbeat and turns a call that does not return inside `MC_WATCHDOG_MS` (10000) into `FAIL mc_full-watchdog — «<function> [<kinds>]»`, with a self-test on a deliberately unbounded worker proving the watchdog fires.
- `qa/mc_all.cjs`: prints the number of distinct universes each invariant ran against and fails below the floor (25 for the expensive invariants, 5 for the rest). Expensive invariants draw from a deep bank refreshed every 24 draws; `MC_DEEP_W=0` restores the pre-v88 behaviour. `verify.sh` needs network (live reconciliation); if the API is unreachable it prints `SKIP live (offline)` for those checks and fails only the invariants.
- Mocking the Anthropic API in tests: `page.route("https://api.anthropic.com/**", …)`. Mock a **400** to test "clears" (500 is retried).
- Mocked time: pass `now` (ISO) and the page sets `window.__NOW__`; the app reads `nowISO()` which prefers `window.__NOW__`.

- `qa/webkit.js` — **Safari-engine acceptance** (the one suite that is not Chromium). Named `.js` rather than `.cjs` because the package has no `"type": "module"`, so `.js` is already CommonJS here, and the sibling fitness project uses the same `qa/webkit.js` name for the same job. It reuses `harness.cjs` for `bundleApp()`, `assert`, `done` and `PAGE_URL`, and carries its own launcher (`playwright.webkit`, no `executablePath`) and its own page shell, because `harness.launch()` is pinned to Chromium and `harness.open()` installs an **in-memory** `window.storage` that `localStorage.clear()` cannot wipe — this suite has to be able to wipe storage for real. Two shells over one bundle: with the `window.storage` shim (the artifact path) and without it (the `localStorage` fallback). Never run `npx playwright install webkit` in the sandbox; the browser is present and its download validation fails.
  **Bar: `SUITE webkit 30/30`, exit 1 on any FAIL.** It covers: boot of `dist/index.html` from a `file://` URL and of the harness page with zero page errors; the seven tabs in full mode and the landing in simple mode with no `.boundary`; the engine-dependent Part G gates re-measured under WebKit (landing < 110 visible words, every tab < 500, the 11px type floor, the nine touch floors (the raised 44s included), form controls at 16px, the header buttons at 44×44 with 12px between them, nine equal-width tabs, no horizontal scroll at 360px and 390px) with every number printed; both storage paths persisting mode, tab and open sections across a reload; export → wipe → import restoring the squad; the refresh error path on a mocked 400 clearing `.refbar` and leaving the state unchanged; the D3 block rendering and clearing on confirm; and 390×844 screenshots of all seven tabs written to `qa/shots/webkit-<tab>.png`.

## 9. Sandbox facts (11 Sep 2026)
Chromium is preinstalled at `/opt/pw-browsers/chromium`; **WebKit 26.6 launches too** (`install-deps webkit` has been run; `npx playwright install webkit` fails its download validation and must not be run). Both FPL APIs reachable through the proxy. GW4 deadline 2026-09-12T12:30:00Z; draft GW4 waivers 2026-09-11T12:30:00Z. Kwezi's GW1–GW3 picks are identical (ids 4,12,31,40,109,165,175,212,259,368,397,411,423,496,552); bank 0; value 1000; no chips used; FT for GW4 = 3. Overall rank 5,081,388 (`entry` summary) / 5,081,590 (`history` GW3). Draft league id unknown.

## 10. The v111 engine module and its analysis layer (added 27 Sep 2026, v110 §5 B)
- `src/mc_engine.js` is the v111 engine as a UMD module: `module.exports = { create, FORMATIONS }` under Node, `window.MCEngine` in a browser. `create(DATA, opts)` returns the engine instance `M` whose names the suites assert: `CFG`, `P`, `RAT`, `calib` (`{ka, kd, rmse, n, weeks}`), `ODDS`, `devig`, `fitRates`, `matchOdds`, `lambdas`, `rateOf`, `avail`, `parts`, `ep`, `epRange`, `bestXI`, `squadValue`, `classicSquad`, `classicTransfers`, `wildcard`, `draftRoster`, `waiverPool`, `howToGet`, `waiverOrder`, `waiverSim`, `rivalClaimLists`, `claimsMC`, `contested`, `draftMoves`, `bestDistinctMoves`, `simulate`, `summarise`, `h2h`, `sideFromRoster`, `titleRace`, `classicReview`, `draftReview`, `priceRisk`, `priceStress`, `CAL`. `opts.fixedK = {ka, kd}` pins the price exponents; `CAL` is empty when `DATA` has no `model` block. It does not replace `src/engine.js`: both ship, and the interface decides per panel.
- `src/mc_analysis.js` holds the pure logic the v111 interface computed, every function `(M, DATA, …)` returning a plain object carrying its `game`: `buildClaimSheet(M, DATA, pairs, opts)` → `{sheet[{kind, add, drop, gain, of?}], strategy:"firsts"|"paired", altValue, sim, landed, lost, valueNow, valueStress, valueAll, allFirst, rivals}` plus `orderings`, `land`, `meanValue`, `p10`, `p90`, `runs` when `opts.mc` is set; it throws on a pair that is not position for position. `findTrades(M, DATA, opts)` → `[{rival, get, give, mine, theirs, both}]` sorted both-gain first; `tradeGroups(trades)` → `{both, ask}`. `classicReviewSummary` → `{rows, benchScored, avoidable, captainGap, captainBest, vsAverage, noTransfers, flags}`; `draftReviewSummary` → `{rows, perWeek, benchScored, avoidable, flipped, wins, draws, losses, flags}`; `reviewSummary` → `{classic, draft}` and never a sum. `classicGameweekSim` → `{gw, saved, draws, seed}` plus `summarise`'s fields; `headToHead` → `{gw, opp, mySaved, theirSaved, draws, seed, win, draw, lose, me, them, n}` or null; `greedyTransfers` → `{gw, horizonEnd, maxMoves, moves[{out, inn, label, gain, gainNext, bankAfter}], value, baseValue, bank}`; `claimability` → `{phase:"claims"|"free", waiversProcessed, pool[{id, ds, how}], locked}`. The kit's constants (`MC_SIM_DRAWS` 20000, `MC_SIM_SEED` 11, `MC_H2H_DRAWS` 30000, `MC_H2H_SEED` 5, `MC_CLAIM_RUNS` 1500, `MC_CLAIM_SEED` 909, `MC_RIVAL_TOP` 4, `MC_BACKUP_MIN_GAIN` 3, `MC_TRADE`, `MC_REVIEW_WEEKS` 5, `MC_REVIEW_FLAGS`) are exported so a suite reads them rather than retyping them.
- `qa/parity.cjs` proves both on `reference/v109/app/data.json` against `golden.json`, `solver_in.json` and the reference implementation required in-process; it is the only place the reference tree is imported.

## 11. The solver input and its content hash (added 27 Sep 2026, v110 §5 A8)
- `pipeline/export.js` exports `buildInput(DATA, M)` → `{next, gws, cEnd, dEnd, classic:{squad, sell, bank, ft, maxFt, clubLimit, chips:{wildcard, bboost, "3xc", freehit}}, draft:{me, roster, pool, ahead, aheadTakes}, players:[{id, n, t, p, pr, st, did, do, ep, start}], hash}`. `hash` is the first 16 hex characters of the sha1 of `JSON.stringify` of the object without `hash`, keys in that order, exactly as the v111 kit computes it. `cEnd` is `M.CFG.classicEnd` (rules.chipStop), `dEnd` is `M.CFG.draftEnd` (redraft.fromGw − 1), `gws` runs from `gw.next` to the later of the two, `ep` has one entry per gameweek in `gws`, players marked `u` are left out, and `ep` and `start` are rounded to three decimals.
- `node pipeline/export.js [--data <file>] [--out <file>]` (`npm run export`) writes `{at, dataAsOf, …buildInput()}` to `data/solver_in.json`. `at` and `dataAsOf` are the only fields outside the hash; they say when, never what. A solved plan (`solver_out.json`, `solver_long.json`, `solver_timing.json`) ships only when its `hash` equals `buildInput` on the block being shipped; no stage compares clocks (ERRORS.md E-101).
- `qa/export_hash.cjs` proves the export against `reference/v109/app/solver_in.json` (same hash, path-equal apart from the clock fields), its stability under a harmless re-bake and its sensitivity to a changed input, and requires the committed `data/solver_in.json` to be the export of the committed `data/mc_data.json`.

## 12. The calibration stage (added 27 Sep 2026, v110 §1.4; GAP_v110 A9)
- `node pipeline/calibrate.js [data/mc_data.json]` (`npm run calibrate`) runs `pipeline/backtest.js`'s `run(DATA, E, ks)` on the block and writes `DATA.model = { calib: {pos: factor}, backtest: {weeks, points:{byPos, all}, minutes, goals, calib, fixedK}, at }` into it, `at` an ISO instant. It runs after the bake and before the export; the engine's `CAL` reads `model.calib`, and is `{}` under `opts.noCalib` or when the block has no `model`. The backtest itself is uncalibrated — `truncate()` removes the model from every cut-back copy and every engine it builds is created with `noCalib` — so calibrating twice equals once. `qa/calibration.cjs` proves the stage against `qa/fixtures/v111_model.json` (the kit's own model block on the same feeds): factors exactly, metrics within 1e-9.

## 13. The plan the app reads (added 27 Sep 2026, v110 §5 C3, C6; §6)

`data/plan.json` is written only by `node pipeline/plan.cjs` (defaults `--data data/mc_data.json --solver-out data/solver_out.json --timing data/solver_timing.json --long data/solver_long.json --out data/plan.json`), never by the app and never by a smoke test; until the solve stage lands it, `data/plan_reference.json` (the reference solve through the same script) stands in for the gate. Shape: `{hash, at, source: {data, out, timing, long, solvedBy, longSolve, timingFold}, plan, noWildcard, undecayed, freeHit, timing, draft, draftIfTaken, draftAhead, replay}`. `hash` is the export hash of the data the plan was solved on (§11) and must equal `buildInput(DATA, M).hash` of the block being shipped; `plan.cjs` refuses otherwise (exit 3), as it refuses a file without `done: true` or without an `ok` plan. `plan` is the best of the identical solves by objective (the main plan, the long solve, the timing file's "now") slimmed to `{ok, total, obj, secs, gap, detail, params, weeks[]}` with each week `{gw, chip, xi, bench, gk2, cap, vice, in, out, ftBefore, used, hits, bank, ep, epNet, held, squad}`; `timing` is `{now, later, never, at}` with `now` the kept plan; `freeHit[]` is re-labelled (`free` only where the kept plan plays no chip) and re-priced against the kept plan, affordable weeks only. **The interface reads `replay`, never the solver's `ftBefore`, `used`, `hits` or `bank`** (§6, E-102): `replay = {weeks: [{gw, chip, ftBefore, moves, used, hitCount, hits, bank, ftAfter}], agrees, differences}` replayed from Part N1 — `hits` is points (four per hit) and `hitCount` the number; `agrees` is false and the exit code 2 when the replay differs from the solver's fields anywhere. Classic and Draft never meet in this file: `draft` and `draftIfTaken` are the Draft game's own objects. `qa/plan_legality.cjs --plan=<file>` checks every week against the rules and `qa/solver_smoke.sh` runs the chain on a 30-second solve.


The solve stage (27 Sep 2026) fixes two more facts of this file. First, `data/solver_out.json`, `data/solver_timing.json` and `data/solver_long.json` are the solve stage's inputs to `plan.cjs` and carry the export hash they were solved on; when that hash equals the kit's, the kit's files are copied byte for byte and its stage logs sit in `pipeline/logs/`, otherwise the detached chain (`solve.py`, `chip_timing`, `solve_long.py`, `solve_later.py`) writes them and its logs. Second, the golden acceptance (`--golden=reference/v109/app/golden.json`) runs on `data/plan_reference.json` — the reference input re-solved by `pipeline/solve.py` through `plan.cjs`, with the reference's own timing file folded by hash — and never on `data/plan.json`, because golden's numbers were recorded on the reference data; the gate carries both invocations. The acceptance is the spec's, with its tolerance (E-106): total within 2% of golden's, the wildcard and triple-captain weeks and captains, one bench boost, no hits, the gap under 3%, the timing scenarios within 2%, the Draft pairs exactly, and an objective at least the recorded incumbent's (`reference/v109/app/solver_out.json`). The raw output behind `data/plan_reference.json` is committed as `data/solver_out_reference.json`, so its `source` names repository paths only.

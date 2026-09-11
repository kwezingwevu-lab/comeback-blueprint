# CONTRACT.md — build conventions for FPL Mission Control (v87 rebuild)

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
  data/live.json           committed snapshot of the public API (shape §3)
  data/weekly.js           WEEKLY STRATEGY ENGINE block (shape §4)
  state/kwezi.json         exported app state (shape §6), committed every delivery
  app/FPL_Mission_Control.jsx   assembled single file (committed; artifact-ready: ES module, default export App)
  dist/index.html          assembled standalone page (committed; opens from a phone with no server)
  qa/                      run.sh harness.cjs verify.sh tdz_check.cjs unit_engine.cjs smoke.cjs smoke_wk.cjs realistic.cjs buttons.cjs mc_full.cjs mc_all.cjs
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
             "elements": [ {id, code, web_name, team, element_type, status, chance, news, starts, minutes, total_points} ],   // draft ids differ from classic for 59 players: join on code
             "league_id": null }                        // unknown until the manager supplies it (draft league URL)
}
```
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
- Decisions (C1–C5): `captainPick(xiIds, ctx)` → `{capId, viceId, table[]}` (flagged excluded); `bestXI(ids, ctx)` → `{ids, capId, viceId, formation, score}`; `benchOrder(squadIds, xiIds, ctx)` → ordered bench ids (GKP separate); `sellCandidates(squad, ctx)`; `transferProtocol(state, ctx)` → `{moves[], captain, vice, value, margin, confidence:"HIGH"|"MED"|"LOW"|"hold", hits}`; `wildcardSolver(ctx, opts)` → `{ids, xi, cost, bank, score, model, steps, spend}`; `wildcardOptions(ctx, opts)` → `{pure, locked, written, locks, deltas, budget, note}` (the three priced answers to the C1.6 conflict: the rule-pure solve, the same solve with the written fifteen's convergent players locked in, and the written fifteen itself — all scored under one objective; it changes neither the solver default nor rule C1.6); `wildcardTiming(ctx)` → grid; `chipWindows(live)` → `{doubles[], blanks[], recommendation}`; `draftWaivers(state, ctx)` → ordered claims; `watchlistAudit(codes, ctx)` → `{keep[], drop[]}`; `draftXI(codes, ctx)`.
- Squad/state: `sanitiseState(raw)` (cap 15, dedupe on id, never throws); `detectSquadChange(stateSquadIds, picks)` → `{changed:boolean, added[], removed[], block:boolean}`; `ftAvailable(history, currentEvent)`; `sellPrice(now, purchase)`; `bankAfter(state, moves, els)` (tenths, raw).
- MC (E4): `simPlayer(el, ctx, rng)` (may be negative); `mcSquad(ids, capId, ctx, iters, seed)` → `{mean, sd, q10, q50, q90}`; `mcLeague(…)` → direction + rank band, never a raw P(win) when data < 8 GWs; `chipRegret(…)` → `{regretUse, …}`.
- Tournament (E5): `tournament(live)` → `{models:[{key,name,spearman,mae,transitions}], leader, promotable:boolean}` with the eight named models.
- Refresh (D4): `parseJson(text)`; `pickText(contentBlocks)`; `refreshRequest(cfg)` builds the request body (model+tool pairing from `REFRESH_PAIRS`); `applyRefresh(state, parsed)` returns a new state or throws (never mutates on failure).
- Scoring (B1): `SCORING` table by position; `pointsFor(statsRow, elementType)` (FWD never CS; GKP never DefCon).

## 6. state/kwezi.json (exported app state; `sanitiseState` accepts exactly this)
```
{ "version": 87, "exported_at": ISO, "entry": 3546875,
  "squad": [ {"id": 109, "purchase": 45} … 15 ], "bank": 0, "ft": 3, "value": 1000,
  "confirmed_gw": 3,                                     // last GW whose picks the manager confirmed (D3 block clears when equal to live)
  "leagues": [1314671,1683215,26474,512557,989793,512550],
  "draft": { "league_id": null, "roster": [codes…], "watchlist": [codes…] },
  "ui": { "mode": "simple", "tab": "command", "open": {}, "reveals": {} },
  "ledger": [ {gw, type, pick, alt, xp_pick, xp_alt, outcome, regret} ],
  "refresh": { "pair": "sonnet46", "last": null } }
```

## 7. UI contract (src/ui.jsx)
- Root `<div className="mc-root">` carries exactly 21 colour tokens as CSS custom properties: `--bg --bg2 --bg3 --line --text --dim --mute --grn --grn2 --pnk --pnk2 --amb --cyn --blu --pur --wht --shadow --focus --ok --warn --err`. Markup uses `var(--…)` only; **0 hex literals** in any `style`/`className` markup (hex may appear only inside the token definitions in the one `<style>` block).
- Class names the gates measure: `.btn` (≥38px tall) `.btn-sm` (≥32) `.tabi` (≥52) `.sec-h` (≥48) `.menu-i` (≥44) `.inp` (≥40) `.row` (≥38) `.refbar` `.gwbar` `.note` `.landing` `.reveal` `.section` `.boundary`.
- Seven equal-width icon tabs in this order, with `data-tab` values: `command · plan · squad · rivals · draft · chips · lab`. Each tab button has `data-testid="tab-<name>"` and an `aria-label`.
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
- `qa/run.sh`: `node --check`-equivalent via esbuild → tdz → build → verify → unit_engine → smoke → smoke_wk → realistic → buttons → mc_full 3000 → mc_all; prints `ALL PASS` only if every suite passed. `verify.sh` needs network (live reconciliation); if the API is unreachable it prints `SKIP live (offline)` for those checks and fails only the invariants.
- Mocking the Anthropic API in tests: `page.route("https://api.anthropic.com/**", …)`. Mock a **400** to test "clears" (500 is retried).
- Mocked time: pass `now` (ISO) and the page sets `window.__NOW__`; the app reads `nowISO()` which prefers `window.__NOW__`.

## 9. Sandbox facts (11 Sep 2026)
Both FPL APIs reachable through the proxy. GW4 deadline 2026-09-12T12:30:00Z; draft GW4 waivers 2026-09-11T12:30:00Z. Kwezi's GW1–GW3 picks are identical (ids 4,12,31,40,109,165,175,212,259,368,397,411,423,496,552); bank 0; value 1000; no chips used; FT for GW4 = 3. Overall rank 5,081,388 (`entry` summary) / 5,081,590 (`history` GW3). Draft league id unknown.

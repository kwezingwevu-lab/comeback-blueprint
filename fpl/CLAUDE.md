# FPL MISSION CONTROL — MASTER PROMPT FOR CLAUDE CODE
### The single document that rebuilds, runs, tests and evolves the app. Supersedes the rebuild and iteration prompts; both are folded in and deepened. Version 1.0 · written 10 Sep 2026 after 86 shipped versions.

> **Repo addendum (added 11 Sep 2026 with the v87 in-repo rebuild; everything below this box is the manager's master prompt, verbatim).**
> - This project lives in `fpl/` inside the `comeback-blueprint` repository (the only repository connected to Claude Code on the web). The root `CLAUDE.md`, `LEDGER.md`, `CHANGELOG.md` and `LEARNINGS.md` belong to the fitness app and are not this project's memory; this file, `ERRORS.md` and `retests/` are. Run every command below from `fpl/`. Tags are `fpl-vNN` (the repository is shared).
> - Layout additions on top of Part K1: `src/engine.js` (pure functions, no React) and `src/ui.jsx` (components) are the authored sources; `build.cjs` assembles them with the two bracketed data blocks into the single file `app/FPL_Mission_Control.jsx` (committed, artifact-ready) and `dist/index.html` (standalone, runnable in any browser; `window.storage` falls back to `localStorage`). `data/fetch_live.cjs` pulls the public API into `data/live.json`; `data/weekly.js` is the WEEKLY STRATEGY ENGINE block. `CONTRACT.md` fixes the data shapes and markers. Commands: `npm install` · `npm run fetch` · `npm run build` · `npm run qa` (tdz → esbuild → verify → smoke → smoke_wk → realistic → buttons → mc_full 3000 → mc_all).
> - Verified against the sources on 11 Sep 2026 (each of these corrects or narrows a line in the prompt below): (1) Draft scoring is not identical to classic — the draft API `settings.scoring` gives a goalkeeper goal 10 (classic 6) and applies bonus; everything else matches B1. (2) Draft waivers process 24 h before the classic deadline (`events[].waivers_time`): GW4 waivers Fri 11 Sep 12:30 UTC / 14:30 SAST. (3) Draft element ids differ from classic ids for 59 of 655 players — key across the two systems by `code`, never by id or name. (4) Free transfers bank to 5 (`max_extra_free_transfers` 4); GW4 available = 3 (none used GW2–GW3). (5) The refresh path's `claude-sonnet-4-6` + `web_search_20250305` pairing is still served; the current-generation pairing is `claude-sonnet-5`/`claude-opus-5` + `web_search_20260209`. The model and tool type are a single paired setting in the app. (6) `entry/{id}/` `summary_overall_rank` and `history.current[].overall_rank` differ by a few hundred places at the same moment; RETEST files quote the history value and say so.
> - **Draft league endpoints, verified 11–12 Sep 2026 (v88).** These are PUBLIC and need no login, so the draft half no longer runs blind: `league/{id}/details` (league, `league_entries`, `matches`, `standings`), `league/{id}/element-status` (ownership), `entry/{entryId}/public` (resolves a league from an entry through `league_set`), `entry/{entryId}/event/{gw}` (picks), `game`, `bootstrap-static`. `watchlist/{id}` and `draft/entry/{id}/transactions` are 403 without a session and are never called. Two id spaces run through these: `league_entries[].id` is the **league-entry** id that `standings` and `matches` speak, `league_entries[].entry_id` is the **entry** id that `entry/…` speaks — and `element_status[].owner` is the **entry** id, not the league-entry id (ERRORS.md E-063; in one recorded league seven of nine owners are values that appear nowhere in `league_entries[].id`). `data/draft_league.cjs` translates it once at the boundary. Kwezi's own draft league id is still unknown and is never invented: `state/kwezi.json` `draft.league_id` stays null and the app says the pool is unknown until he supplies it.
> - Item (3) above is dated, not fixed: the game added a player on the evening of 11 Sep 2026 and the two tables became 656 long. The shift was 59 of 655 when it was written and 59 of 656 the next morning. Counts taken from a live source are reconciled against that source, never frozen into a test (E-064).
> - Sandbox facts: `fantasy.premierleague.com` and `draft.premierleague.com` are reachable through the session proxy; Playwright's Chromium is preinstalled under `/opt/pw-browsers` (never run `playwright install`). **WebKit correction (11 Sep 2026, v88):** the earlier line here said WebKit is not installed. That is wrong and was corrected the day it was found. `npx playwright install-deps webkit` has been run and `require("playwright").webkit.launch()` returns **26.6**, so the Safari engine is available and `qa/webkit.js` is a gate step. Do **not** run `npx playwright install webkit` — its download validation fails here; launch `playwright.webkit` directly.

---

# PART A — READ-FIRST

## A1. Who, what, why
| | |
|---|---|
| Manager | **Kwezi Ngwevu**, Noordhang, Randburg, South Africa · SAST = UTC+2 |
| Classic | entry **3546875**, "Kwezi's Team" · ~10.66m managers |
| Draft | "**Yoh-Nited**", Champions League Draft Pool B · 7 teams · H2H · no captain · admin Vince Mahloko |
| Objective | **Win the overall competition, every mini-league, and the draft pool.** Not top 10k. First. |
| Winnable leagues (≤40) | Forecast to Glory 7 (rank 5) · Nineteen45 11 (4) · Marvelous Matchups 17 (15) · Champions League Mini 23 (22) · Gentlemen's Sport Bar 24 (20) · Champions League!! 2026/27 28 (25) |
| Record to v86 | GW1 58 (field 50) · GW2 70 (81, captain error −8) · GW3 50 (51, transfers not made) · 21 bench points wasted · rank 5,081,397 · −4 vs field cumulative |
| Working style | SA English · direct answer first · no AI disclaimers · no hyperlinks in deliverables · probabilistic, never certain · everything QA'd before shown · harsh self-score /100 with limitations stated |

The manager finds it hard to know what to do each week. **The first screen tells him, in under 100 words, sourced.** Everything else serves that screen.

## A2. The five laws (violating any one is a ledger entry)
1. **Never hallucinate.** Every number carries a tier: T0 official FPL/PL/club · T1 Opta · T2 FFScout / FFHub / LiveFPL · T3 Understat / FBref · T4 named expert · T5 community. Unsourced → shown as "unverified" or not shown.
2. **Never the same error twice.** `ERRORS.md` is read at session start and appended at every fix (Part H).
3. **Never ship on a red suite; never loosen a test to pass.** Fix the app or prove the test wrong against the source.
4. **Never recommend what the rules forbid.** The six rules (C1) and the constraints (B3) are hard gates in code, not advice.
5. **Never claim 100.** Score harshly, list what would reach 100, do it, re-score, state what remains.

## A3. Session opener (paste as the first message, every session)
> Read `CLAUDE.md`, `ERRORS.md` and the latest `retests/RETEST_v*.md`. Then run the live check (Part D2) and report: hours to deadline, flags on both fifteens, price moves on owned players, any rival-league rank change. Only then ask what I want to change. Score every deliverable /100 by the rubric in Part I before you show it.

---

# PART B — THE GAME, EXACTLY

## B1. Scoring (verify against the official rules page at each season start; these are the 2025/26+ rules the models are built on)
| Event | GKP | DEF | MID | FWD |
|---|---|---|---|---|
| Played 1–59 min / 60+ | 1 / 2 | 1 / 2 | 1 / 2 | 1 / 2 |
| Goal | 6 | 6 | 5 | 4 |
| Assist | 3 | 3 | 3 | 3 |
| Clean sheet (60+ min) | 4 | 4 | 1 | 0 |
| Goals conceded, per 2 | −1 | −1 | 0 | 0 |
| Saves, per 3 | 1 | — | — | — |
| Penalty save / miss | 5 / −2 | −2 | −2 | −2 |
| Yellow / red / own goal | −1 / −3 / −2 | same | same | same |
| Bonus (BPS top 3) | 3 / 2 / 1 | | | |
| **Defensive contribution** | — | 10 CBIT → 2 | 12 CBIRT → 2 | 12 CBIRT → 2 |

Consequences the models must respect: FWD never earns a clean sheet; GKP never earns DefCon; DEF value is CS + DefCon + BPS, so a DEF's fixture matters more than a MID's; captain doubles everything including negatives.

## B2. Calendar & mechanics
- Deadline = 90 min before the first kick-off. Read `events[].deadline_time` every session; never hard-code — and do not write the current one here either. A gameweek number in this file is stale within the week, and a stale master prompt misleads the next session more than no number would (E-084).
- Free transfers: 1 per GW, bank to 5. Hit = −4 per extra. FT count comes from `entry/{id}/` and `entry/{id}/history/`.
- Chips: Wildcard, Free Hit, Bench Boost, Triple Captain — **two sets**; set 1 can be used up to the GW19 deadline. Which chips are still in hand comes from `history.chips`, never from this file: the v87/v88 plan of record recommended Wildcard 1 in GW4 and it was **not played**, so a sentence here saying it was in play would have been wrong for two gameweeks.
- Price changes overnight (~01:30–02:30 UTC) from net transfers; sell price = purchase + half the rise, rounded down.
- Squad: 15 = 2 GKP / 5 DEF / 5 MID / 3 FWD · ≤£100.0m · ≤3 per club · XI formations 3-4-3 … 5-4-1 with 1 GKP, ≥3 DEF, ≥2 MID, ≥1 FWD.
- Autosubs: bench order matters; a benched player replaces a 0-minute starter if the formation stays legal.
- Draft: same 15-shape and formations, no budget, no chips; waivers are claimed in priority order and process before the deadline (confirm the league's waiver time in the draft app); unclaimed players are free agents afterwards; H2H points = classic scoring, win/draw/loss table.
- Blanks/doubles: FA Cup rounds and rescheduling, mainly Feb–Apr 2027. Read from `fixtures/?event=N` (count fixtures per team per event). Never assume a DGW.

## B3. Hard constraints (encoded, tested by mc_all)
`legal15(squad)` = 2/5/5/3 ∧ cost ≤ 1000 (tenths) ∧ ≤3/club. `legalXI` = 11 ∧ 1 GKP ∧ ≥3 DEF ∧ ≥2 MID ∧ ≥1 FWD. Captain ∈ XI. Vice ∈ XI, ≠ captain. Transfers ≤ FT + hits; bank ≥ 0 from **raw** prices (never display-rounded). Wildcard picks: ≥3 starts of last 3 and P(start) ≥ 0.75 and status "a".

---

# PART C — DECISION PROTOCOLS (algorithms, not advice)

## C1. The six rules, as code paths
1. **Sell** only if `starts_last3 == 0` OR the buy's `xp5 − sell.xp5 > 4` (a hit pays only when the five-week gain clears the −4 with margin). Never sell a player who started his club's last match after a spell out (Konsa rule).
2. **Captain** = argmax over XI attackers of `EV_cap = 2 × xp1 × P(start)` under the xG strength model; tie → higher season pts/start; **flagged (any %) → excluded**; report rival captaincy share alongside.
3. **XI** = `bestXI()`: maximise Σ xp1 × P(start) over legal formations; a player with `P(start) < 0.5` never starts ahead of one ≥ 0.75 regardless of xp.
4. **Bench order** = descending `P(starter_i fails) × E[sub points | plays]`, GKP last of the outfield subs is irrelevant (GKP sub is separate).
5. **Chips**: BB in the largest confirmed DGW; TC on the highest-EV double; FH on the deepest blank; WC when `Σ over 5 GWs of (best15 − current15) ≥ 20` and no bigger window inside the chip's expiry. Never on a single-GW impulse.
6. **Mini-leagues**: for each buy candidate compute `rivalOwn(league)`; if ≥ 0.60 flag CONVERGENCE; the wildcard solver excludes ≥0.60 unless locked. Differential = `< 0.25 rival-owned ∧ starts`.

## C2. Weekly transfer protocol (Fri, after Thu pressers)
```
inputs: squad, FT, bank, flags, xp5 table, rivalOwn, club counts
1. sells := players with starts_last3==0 or status!='a'          (forced)
2. for k in 1..min(FT+1, 3): enumerate k-swaps from pool where legal15 holds,
   value = Σ(xp5_in − xp5_out) − 4·max(0, k−FT); reject if any in ≥0.60 rivalOwn
   or ≥2 incoming from one club or bank<0 on raw prices
3. rank by value; margin := best − best_genuinely_different (not the same pair swapped)
4. confidence := HIGH if margin ≥ 2.0, MED if ≥ 0.8, else LOW → "hold"
5. output moves in execution order (sells first), captain & vice last
```

## C3. Wildcard solver
Greedy seed by `xp5/price` per position → local search (1-swap, 2-swap) maximising Σ xp5 of best XI + 0.15 × bench xp5, under B3 + locks + rival exclusion + correlation (≤2 per club incoming). **Run under both fixture models (xG and goals).** Ship the minimal change that is equal-or-better under both; report the disagreement as noise (v74 lesson: 11/15 swapped on a model change, +13.6 on one, −3.0 on the other).

## C4. Wildcard timing (now vs later)
`deficit_t` = weekly xp gap of current squad vs best15 (declines as you fix with FTs at 1/week). `NowAdvantage(T) = Σ_{t≤T} deficit_t − LaterValue(T)`. Ship the sensitivity grid (deficit × later-window value). Current result: +21 by GW19, +45 by GW38; GW17 needs a ~45-pt double to break even; none scheduled.

## C5. Draft protocol
- **Watchlist rule:** on the list only if started the last three. Audit every week; the manager's 44-name list had 12 starters.
- **Waivers:** rank claims by `EV_in − EV_out` where EV = xp5 × P(start), forced replacements first (unavailable players), then largest gains; submit all in order.
- **H2H XI:** same bestXI; if the opponent's projected total is known, prefer variance-up picks when trailing (higher ceiling), variance-down when leading.
- **Forward scarcity:** no free-agent forward has three starts; Isidor SUN (13 pts) is the best available; Thomas-Asante COV is the backup.

## C6. Weekly rhythm (SAST)
| Day | Do | Don't |
|---|---|---|
| Sun/Mon | log GW points, bench waste, rank; walk-forward score; decision ledger outcomes | transfers |
| Tue/Wed | price-watch; draft waivers submitted; provisional plan | commit captain |
| **Thu** | **press conferences → flag check on both fifteens** (caught Gakpo 75% before a wildcard) | — |
| Fri | execute transfers in order; captain & vice last; final flag check | new ideas |
| Sat/Sun | watch; transfer panels hidden in LIVE | panic moves |

---

# PART D — DATA & API (field-level)

## D1. Endpoints and the fields used
```
bootstrap-static/         events[id,name,deadline_time,is_current,is_next,finished,average_entry_score]
                          teams[id,short_name,name]  total_players
                          elements[id,web_name,team,element_type(1..4),now_cost,cost_change_event,
                            selected_by_percent,status('a','d','i','s','u','n'),news,
                            chance_of_playing_next_round(null|0..100),total_points,minutes,starts,
                            expected_goals,expected_assists,expected_goals_conceded,
                            defensive_contribution,bps,ict_index,form,ep_this(BANNED),ep_next(BANNED)]
fixtures/?event=N         id,event,team_h,team_a,team_h_difficulty,team_a_difficulty,finished,started,
                          kickoff_time,stats[]   (no team xG — sum player xG from element-summary)
element-summary/{id}/     history[round,minutes,starts,total_points,expected_goals,expected_assists,
                          expected_goals_conceded,defensive_contribution,bps,ict_index,was_home,opponent_team]
event/{gw}/live/          elements[id,stats{...}]  (bootstrap caches; use this for live points)
entry/{id}/               summary_overall_rank, summary_overall_points, last_deadline_bank,
                          last_deadline_value, last_deadline_total_transfers, leagues{classic[]}
entry/{id}/history/       current[event,points,rank,bank,value,event_transfers,event_transfers_cost,points_on_bench]
                          chips[name,event]
entry/{id}/event/{gw}/picks/   picks[element,position,multiplier,is_captain,is_vice_captain],
                          entry_history{...}, active_chip
leagues-classic/{id}/standings/   standings.results[entry,player_name,entry_name,total,rank]
```
`ep_this`/`ep_next` are banned as inputs (opaque, not reproducible). `team_h_difficulty` is FDR — kept for the goals-vs-FDR comparison panel only.

## D2. Live check (every session, before code)
```bash
curl -s https://fantasy.premierleague.com/api/bootstrap-static/ -o B.json
# hours to deadline from events[is_next].deadline_time
# flags: status!='a' or chance_of_playing_next_round<100 on: wildcard15, draft15
# price moves: cost_change_event on owned players
# rank: entry/3546875/ summary_overall_rank vs last RETEST
```
Any flag → the recommendation touching that player is re-evaluated before anything else.

## D3. Squad-change detection (top open defect)
Key on **element id**, never name/club. Name matching missed Konsa (AVL→ARS) and N.Jackson (CHE→AVL) — two misses in three gameweeks. On mismatch between `D.squad[].id` and `picks[].element`: BLOCK every recommendation until the user confirms the imported squad.

## D4. Runtime refresh path (the only network the app does)
1. Direct `fetch` of bootstrap (CORS-blocked in the browser; always falls through).
2. `POST https://api.anthropic.com/v1/messages`, model `claude-sonnet-4-6`, `tools:[{type:"web_search_20250305",name:"web_search"}]`, **`max_tokens: 4000`** (1000 truncated every reply for weeks: the search results consume the budget before the answer).
3. Detect `stop_reason==="max_tokens"` and say so. Read only `content[].type==="text"`. Never assume block order (`server_tool_use` and `web_search_tool_result` come first).
4. `parseJson`: strip fences → outermost `{…}` → try closing a cut-off array → throw with the real message.
5. UI shows the real error (first 140 chars). Retry with backoff on 429/5xx/timeout/network only. On failure state is unchanged and says so.
Invariant: **no account-touching calls** (`/my-team/`, `/transfers/`, login).

---

# PART E — MODELS (formulas, worked numbers, verdicts)

## E1. Production xP (drives every recommendation)
```
pps_shrunk  = w·(pts/starts) + (1−w)·prior_pos,   w = starts/(starts+4)          K=4
prior_pos   = GKP 3.2 · DEF 3.4 · MID 3.9 · FWD 3.8
P(start)    = (starts+0.5)/(n+1) × (everBenched ? 0.85 : 1) × (chance/100 if flagged)
decay       = [1.00, 0.82, 0.68, 0.56, 0.46] for GW+0..+4
xp1         = pps_shrunk × tsMult(team, opp, home) × P(start)
xp5         = pps_shrunk × P(start) × Σ_k decay_k × tsMult_k
```
Worked: a MID with 21 pts from 3 starts → w=0.4286, pps=7.0 → shrunk = 0.4286·7.0 + 0.5714·3.9 = **5.23**. P(start)=(3.5/4)=0.875. With fixture mults [1.10,0.95,1.05,0.90,1.00]: Σ decay×mult = 1.10+0.779+0.714+0.504+0.46 = 3.557 → **xp5 = 5.23×0.875×3.557 = 16.3**. Unit-test against this.

## E2. Team strength — Dixon-Coles-lite on xG (replaces FDR)
```
xGF_t, xGA_t  = Σ player xG for/against by match from element-summary (NOT goals)
att_t = w·(xGF_t/g ÷ L̄) + (1−w)·1,   def_t = w·(xGA_t/g ÷ L̄) + (1−w)·1,   w = g/(g+6)   K=6
tsXg(t,o,home) = L̄ · att_t · def_o · (home ? 1.10 : 0.90)
tsMult = tsXg / L̄ ;  tsPcs(t,o,home) = exp(−tsXg(o,t,!home))
```
Keep `TS_GOALS` beside `TS` for the OVER/UNDER tags (|GF−xGF| ≥ 0.5). Verdict from v74: **Hull conceded 0 goals from 1.68 xGA/game** — the goals model rated them best defence; xG rated them average; the goals model inverted a captaincy call on luck. Arsenal best DEF on xG (0.73). **xG drives; goals explain.**

## E3. Rival-aware engine
```
for league in winnable: rivals := standings.results.map(entry)
for rival: picks_gw := entry/{rival}/event/{gw}/picks/
rivalOwn[league][element] = |{rivals owning}| / |rivals|
capShare[league][element] = |{rivals captaining}| / |rivals|
class(player) = EDGE if rivalOwn<0.25 ∧ starts ; SHARED if ≥0.70 ; DEAD if starts_last3==0
convergenceRisk(buy) = max over leagues rivalOwn ≥ 0.60
```
The result that reversed my own advice: B.Fernandes 65% rival-owned / 42% captained; Monte Carlo (20k) against the actual rival squads showed buying him **lowered** P(win) in every league (14.2% → 2.7% in the 7-team league). João Pedro is 89–92% rival-owned: not a differential despite 2% field captaincy. Gakpo was captained by 1 of 80 rivals — highest EV *and* the captaincy differential.

## E4. Monte Carlo (mc engine)
Per player per GW: minutes ~ Bernoulli(P(start)) × (60 w.p. 0.85, else U(1,59)); goals ~ Poisson(λ = player xG90 × mins/90 × tsMult); assists ~ Poisson(xA90·…); CS ~ Bernoulli(tsPcs) for DEF/GKP if mins ≥ 60; DefCon ~ Bernoulli(dc rate); cards/OG at league base rates; bonus by BPS rank within the fixture. Squad score = XI + captain double + autosubs. **Correlation:** same-club and same-fixture players share the goals draw (portfolio constraint, spec F7). **Reporting rule:** P(win) over ≥5 GWs compounds a 3-GW edge into false certainty (the "99% to win" result) — report **direction and rank-band** until ≥8 GWs of data; never the raw probability.

## E5. Champion/challenger tournament (walk-forward)
Eight models score GW k+1 from data ≤ k: season-mean · last-GW · per-90 · shrunk-per-90 · ICT-rate · BPS-rate · blend · component-xP. Metrics: Spearman ρ on pts, MAE. After two transitions: **BPS-rate +0.148 (leads)** · season-mean +0.141 · ICT +0.135 · … · component-xP +0.032 (last, third time). **Promotion gate ≥3 transitions** (GW5 earliest; re-evaluate GW8 with ≥6). The GW1 leader (ICT) was third by GW3 — one transition has no power.

## E6. Failed — do not resurrect without new walk-forward evidence
- Component-xP as a driver (three consecutive last places).
- Captaincy by FDR (GW2, −8).
- 5-GW P(win) as a headline number.
- Team strength on goals.
- Name-keyed squad matching.

## E7. Evidence-ranked edge (PLOS ONE 2021, 901,912 managers; app's own for the last two)
Transfers **+76** · Captaincy **+51** · Chip timing **+30** · Team value by GW19 **+22** · XI/bench/autosubs +21 · Template/EO +20. Effort follows this order. Chips were once ranked first on assertion; the correction is permanent.

---

# PART F — ROADMAP SPECS (each ships only with walk-forward score + MC invariant + smoke assertion + UI caveat)
1. **Element-id squad detection** with a hard BLOCK (D3). Highest value: two misses in three GWs.
2. **Draft API** (`draft.premierleague.com/api/…`): roster, free agents, waiver order, H2H fixtures; replaces screenshot ingestion.
3. **Bench-order optimiser**: `P(starter_i fails) = 1 − P(start_i)`; order subs by `P(fail among starters they'd replace) × E[pts | plays]`; 21 bench points wasted to date.
4. **Minutes model** — *built v88, as a challenger only.* `minutesModel(el, ctx)` is a ridge IRLS logistic on {starts in the last three, minutes trend over the last three, minutes rate, days since the last start}, walk-forward scored against the Laplace rate on Brier. Two of the five slots the spec names are declared and **not fitted**, each with its reason: the snapshot carries one `status`/`chance` per player rather than one per gameweek, so the flag is applied as the E1 availability factor instead of fitted (E-069), and the fixture list this app pulls carries no midweek European load at all. On the 11 Sep snapshot: base rate 0.335, GW2→GW3 Laplace Brier **0.0819** against the logistic's **0.0751**; one transition can be fitted (a fit needs a gameweek of history before the gameweek it is fitted on), so the gate answers no. `pStart` still drives everything.
5. **Player-level xG model** — *built v88, as the ninth tournament challenger `player_xg`.* `playerXg(el, ctx)` = xG90 × att(team) × def(opponent) folded into the E1 shape; inside the walk-forward it is rebuilt from accumulators and from team strength recomputed on the gameweeks ≤ k only, so it cannot read the gameweek it predicts. On the 11 Sep snapshot it leads on both metrics — ρ **0.292** and calibrated MAE **2.17 pts** against component-xP's 0.239 / 2.43 — and led both transitions. **It drives nothing:** two transitions is not three, and E6's bar on component models applies to it too.
6. **Decision ledger with regret**: every recommendation logged {gw, type, pick, alt, xp_pick, xp_alt} → outcome → regret; captaincy already tracked; extend to transfers, XI, chips, draft.
7. **Correlation-aware MC**: shared goals draws per fixture; portfolio variance shown; the ≤2-per-club guard becomes a covariance constraint.
8. **Chip solver on the real calendar** — *built v88.* `chipSolver(ctx)` counts fixtures per club per event out of `live.fixtures`, prices each chip in each window it could be played in, and solves the two sets jointly — one use per chip per set, inside that set's expiry (set 1 to the GW19 deadline, set 2 GW20–38), never two chips in one gameweek. On the shipped fixture list **every club has exactly one fixture in every remaining gameweek**, so there is no double and no blank, the panel says “no window is confirmed yet”, and only the Wildcard is assigned. The Free Hit figure applies neither the budget nor the three-per-club cap and is labelled an upper bound wherever it appears (E-068).
9. **Price-change model**: rise/fall probability from net transfers and ownership; value edge (+22) realised by moving the day before a rise.
10. **Tournament promotion** at ≥3 transitions with a 2-week hold-out.

---

# PART G — UX STANDARD (every row is a test gate)
| Property | Gate | Was |
|---|---|---|
| Landing card, first paint | **<110 words**, ≤4 panels; decision only, reasoning behind `▸` reveals | 441 words |
| Every tab, first paint | **<500 words**, ≥1 `Section`, one primary panel open | Plan 1,760 |
| Type floor | 11px | 151 elements at 9px |
| Form controls (28 Sep 2026) | every visible input, select and textarea computes to **≥16px**, so WebKit does not zoom the page on focus (its own rule scales the page by 16 ÷ the control's font size); the viewport meta never carries maximum-scale or user-scalable. Held by smoke `E023-form-controls-are-16px-or-larger-so-focus-does-not-zoom`, its webkit twin, visual `form controls (.inp) are 16px` and ios IOS27-03 | 13px on every control |
| Touch floors | `.btn` 44 · `.btn-sm` 32 · `.btn-ic` 44 · `.tabi` 52 · `.sec-h` 48 · `.menu-i` 44 · `.inp` 44 · `.row` 38 · `.reveal` 44. **28 Sep 2026, raised to Apple's number:** `.btn` 38→44, `.inp` 40→44, the header ↻ and ⋯ (`.btn-ic`, 38×38) to 44×44 and `.reveal` (32) to 44, both now gated. Source: Apple Human Interface Guidelines, Buttons and Accessibility (a hit region of at least 44×44 pt by default, 28×28 pt minimum). Unchanged on purpose: `.btn-sm` stays 32 (a dense in-row secondary control, above Apple's 28×28) and `.row` stays 38 (no row carries a handler). The three copies of the table (smoke, webkit, visual) are held equal by visual | 21px buttons; until 28 Sep `.btn` 38 · `.inp` 40 |
| Space between controls (28 Sep 2026) | bordered controls in one row sit **12px** apart (`.hdr-r`, `.chips-r`), Apple's "about 12 points of padding around elements that include a bezel"; the tab strip's 2px gap is inside the tab exception below. Held by smoke `E024-header-refresh-and-menu-are-44x44-with-12px-between`, its webkit twin and ios IOS27-09 | 6px |
| Colour | 21 tokens on `.mc-root`; **0 hex literals in markup**; grn=do · pnk=out/alarm · dim=secondary · amb/cyn never on the landing | 86 distinct colours |
| Contrast (28 Sep 2026) | every text token is **≥4.5:1** on every background token it is painted on (visual `audit_contrast`, ios IOS27-13 on the rendered page: 2264 texts, minimum 5.11). `--dim` is **≥7:1** on `--bg`, `--bg2` and `--bg3` (Apple, Dark Mode: "strive for a contrast ratio of 7:1, especially in small text"): `--dim` #97a3b6→#a2adbe and `--mute` #7c899f→#8692a6, lightened together so the step between them is unchanged (1.39 on `--bg3`, held at ≥1.2). `--mute` stays under 7:1 (5.11 to 6.14): reaching it would flatten it into `--dim`, and that choice, or dropping `--mute` from 11–12px text on `--bg2` and `--bg3`, is the manager's to make after seeing before and after screenshots. Under `prefers-contrast: more` one `.mc-root` block redefines `--dim`, `--mute` and `--line` only (names from the 21, hex allowed there and in the base block and nowhere else): `--dim` ≥7:1 and `--mute` ≥7:1 on all three neutral surfaces, `--line` ≥3:1 on `--bg2` and `--bg3`, order `--text` > `--dim` > `--mute` kept. Under forced colours every control keeps a border or an outline. Held by visual (six Increase Contrast and two `--dim` lines) and ios IOS27-13 | no contrast gate on the rendered page; tightest pair 4.54 |
| Tabs | 7 equal-width icon tabs, no horizontal scroll | text tabs |
| Tabs, v110 (27 Sep 2026, supersedes the row above) | one equal cell per `TABS` entry (nine: odds and review before lab) in one row, `flex:1 1 0`; above 380px every label shows at 11px, uncut; at 380px and below the cells are icon-only with the name in `aria-label`; every cell ≥28×28 (Apple's minimum, raised on 28 Sep 2026 from WCAG 2.5.8's 24; Apple's 44 is the named exception, because nine equal cells are 42 wide at 402 and 40.7 at 390 and would need at least 396px of cells at 44 each) and ≥52 high; no horizontal scroll by document width or by an element walk of `.tabs` children at 360, 390 and 430, in Chromium and WebKit. Chosen by measurement: at 360 the widest label ("Review", 36.08px in the sandbox's Liberation Sans) does not fit the 35.33px a cell leaves, at 390 it fits with 2.59px spare. Held by smoke `tab-strip-fits-with-labels-above-380px-and-icon-only-at-360`, its webkit twin and visual audit_layout | 7 tabs, 44px floor (9 would need 444px) |
| Header | title · status line · ↻ · ⋯ menu (simple/full, guide, glossary) | 4 buttons in a row |
| Feedback | `:active` scale(.97) on every interactive element **except under `prefers-reduced-motion`** (Apple lists scaling among the motion to reduce): there the press shows as a `--line` background (a `--wht` border on the green button) and every scale rule has a `transform:none` twin of equal or higher specificity, because `.btn:active` alone loses to `.mc-root button:active` (E-132) · `.refbar` while refreshing · `.gwbar` cycle progress · `prefers-reduced-motion` · no grey tap flash (`-webkit-tap-highlight-color:transparent` on `.mc-root`) and no callout or text selection on the controls (`-webkit-touch-callout`, `-webkit-user-select`, `user-select` on `.tabi .btn .btn-sm .btn-ic .sec-h .menu-i .reveal`; panel text stays selectable). Held by ios IOS27-12 and visual `Reduce Motion` and `tap flash` | none |
| Safe area (28 Sep 2026) | `:root` holds `--sat --sar --sab --sal` from `env(safe-area-inset-*, 0px)`, never on `.mc-root` (smoke E025 counts that rule's custom properties: 21). `.hdr` (top and sides), `.tabs` (`top:var(--sat)`, side padding), `.wrap` (sides), `.menu` (top and right) and `.mc-root` (bottom) consume them, so the header, the pinned strip and the menu clear the status bar, the Dynamic Island and the landscape sensor housing; `.mc-root::before` paints the status-bar band `--bg2`, the token the header and the strip use. `viewport-fit=cover` and `black-translucent` stay. Height is `min-height:100vh;min-height:100svh` on the root and the shell's `#root`. Where env() is 0 (older Safari, desktop, every engine the suites run) the layout is the pre-change one. **The suites cannot prove real insets:** ios IOS27-02 overrides the variables with placeholder values (top 59px and bottom 34px in portrait, 59px each side in landscape, not Apple figures) and says so; the numbers that count come from the device | header under the status bar in the Home Screen app |
| Persistence | tab, sections, reveals, pool state survive reload | reopened on Command |
| Dead taps | 0 (pool collapses when squad is full) | 51 |
| Components | `Section`, `Reveal`, `GwActionCard` at module level with props | inside App → remount on every state change |
| Copy | no pre-season language after GW1; labels read `WEEK.gw`; `.note` style, no monospace mea-culpa blocks | orange blocks re-read every load |

---

# PART H — QA · QC · VAC (what must pass, and the test-writing rules)

## H1. The suites (all live in `qa/` and in the outputs folder; a workspace reset once wiped them)
| Suite | Proves | Bar |
|---|---|---|
| `verify.sh` | esbuild syntax · `tdz_check` · 11 live reconciliations (prices exact; ownership ≤1.5pp drift; freshness; deadline = `is_next`) · 9 invariants (banned fields absent; no account calls; START/END markers; version bumped; suites present) | 23/23 |
| `tdz_check.cjs` | comment/string-aware static scan + dynamic `new Function` with const semantics (esbuild CJS rewrites const→var and hides TDZ) | CLEAN |
| `smoke.cjs` | renders both modes · landing first & short · flagged player absent, never captain · every tab under gates · tokens/no hex · touch floors · **reboot from saved state reopens on the saved tab** · pool collapse · press states · reduced motion · playbook · header menu 2+4 · gwbar 0–100 · refbar appears/clears · no error boundary on any tab | 29/29 |
| `smoke_wk.cjs` | every recommendation vs live API: deadline · sells 0-start or genuine upgrade · buys available with starts · captain in XI on both paths · legal15 · budget raw · club cap · P(start) · flags · timing series reconciles · TS sane · draft claims valid & ordered · watchlist KEEP=3 starts, DROP=0 | 32/32 |
| `realistic.cjs` | real API shapes: tool blocks first · ≥4000 tokens with tool · truncation named · fenced JSON · cut-off JSON salvaged · empty reply names block types · error object surfaces message · 4xx = rejected, state untouched | 8/8 |
| `buttons.cjs` | both modes × 7 tabs × every section opened × every enabled button → no throw, no boundary, `legal15` still holds | 370 · 0 · 0 · 0 |
| `mc_full.cjs` | transpile (`--jsx=transform`), stub React/recharts/lucide, extract **every** top-level function, fuzz with 20 junk kinds; 35 property groups (probabilities ∈[0,1]; integers; ordered quantiles; legal shapes; never throws) | 25k iters · 875k assertions · 79/81 · 0 |
| `mc_all.cjs` | engine invariants (70+): 15/2-5-5-3/≤£100m/≤3-club · captain MID/FWD · variance cap · ep_this banned · zero-start → SELL · FT budget · FWD never CS · GKP never DefCon · rival classes valid | 1M iters · 0 |

## H2. Test-writing rules (each one cost a session)
- Read the real signature before asserting (`fxMult` takes a fixture object; `bestXI` returns `ids`/`capId`; `runAvg` returns FDR 1–5; `chipRegret` returns `regretUse`).
- Measure **visible content**, never `textContent` (it includes the `<style>` block).
- Open sections before asserting on their contents; run remount tests **last**; a loop that can throw must `finally` navigate back to Command.
- A 500 is retried — mock a **400** to test "clears".
- `sed s/v84/v85/` does not match `'84'`; grep the literal.
- Negative `simPlayer` is correct (cards, own goals).
- After every string replacement assert `count == 1` and read the diff — a replacement swallowed a closing tag and half a sentence (v86); a regex end-anchor deleted `PLAYBOOK` (v65).

## H3. Delivery ritual
bump → tdz → esbuild → verify → smoke → smoke_wk → realistic → buttons → mc_full (3k dev / 25k release) → copy app **and suites** to outputs → `RETEST_vNN.md` → commit → tag.

---

# PART I — THE 100/100 RUBRIC (score before every delivery; write the deductions down)
| Dimension | Weight | 100 means | Typical deduction |
|---|---|---|---|
| Correctness & sourcing | 30 | every number reconciles to T0/T1 within tolerance; no unverified figure shown | −5 per unsourced number; −15 if a flag is missed |
| Model calibration | 20 | driver model leads the walk-forward; caveats state what would change the call | −10 if a failed model drives anything |
| Decision quality | 15 | six rules honoured; evidence order followed; hits justified by margin | −5 per rule breach |
| Sleekness | 15 | all Part G gates green | −3 per gate |
| Test coverage | 15 | all seven suites green; new behaviour has a new assertion | −5 per red suite; −3 per untested change |
| Honesty | 5 | limitations stated; no "100" claimed; ledger updated | −5 if any error recurs |
Report as: score · deductions · what would reach 100 · what was done about it · what remains. **The score is never 100.**

---

# PART J — CONTINUOUS EVOLUTION (how the app learns)
- **Every finished GW**: re-score all eight models; update the tournament panel; log outcomes into the decision ledger; compute regret for captaincy and transfers; refresh rival squads; update the six-league table; recompute team strength.
- **Every session**: live check → measure → one change → suites → prove → ledger → deliver.
- **Promotion**: a challenger drives production only after ≥3 transitions ahead on Spearman and a 2-week hold-out; demotion is symmetric.
- **Growth**: a roadmap item (Part F) enters the app only with its four artefacts (walk-forward score, MC invariant, smoke assertion, UI caveat).
- **Pruning**: any panel not read in four weeks (tracked by section-open events) collapses by default; any model behind for six transitions is retired to explanatory.

---

# PART K — GITHUB, iPHONE, STORAGE

## K1. Repository
```
CLAUDE.md                    this file (Claude Code reads it at session start)
ERRORS.md                    append-only ledger (Part L)
app/FPL_Mission_Control.jsx  single file; git holds the versions
data/weekly.js               WEEKLY STRATEGY ENGINE block, START/END bracketed
state/kwezi.json             exported app state, committed every delivery
qa/                          verify.sh tdz_check.cjs harness.cjs smoke.cjs smoke_wk.cjs realistic.cjs buttons.cjs mc_full.cjs mc_all.cjs
retests/RETEST_vNN.md        one per shipped version
.github/workflows/gate.yml   runs qa/ on every push; red blocks merge
```
Branches `gwNN/<topic>`; `main` = last green. Commit message = `vNN: <change> — <proving number>`. Tag `vNN`. Never commit keys or rival personal data beyond entry IDs and picks.

`gate.yml` (essentials): `actions/checkout` → `actions/setup-node@v4` (node 22) → `npm ci` → `node qa/tdz_check.cjs app/FPL_Mission_Control.jsx` → `npx esbuild … --loader:.jsx=jsx` → `bash qa/verify.sh` → `node qa/smoke.cjs && node qa/smoke_wk.cjs && node qa/realistic.cjs && node qa/buttons.cjs && node --stack-size=4000 qa/mc_full.cjs 3000` → fail on any `FAIL`.

## K2. iPhone (verified against Anthropic's docs, Sep 2026)
- **Claude Code on the web** — runs on Anthropic's cloud from a GitHub repo; reached from the Claude app or a browser; no laptop. Phone-first path. Confirm repo connection on the docs page before a deadline.
- **Remote Control** — `claude --remote-control` (or `claude remote-control` for server mode) on a laptop; Claude app → **Code** → session (computer icon, green dot) or scan the terminal QR (spacebar toggles). Files and execution stay on the laptop; the phone sends prompts, approves permissions, gets push notifications (`/config`). `/mobile` shows the app download QR. Terminal-only commands (`/plugin`, `/resume`) don't work from the phone. All plans.

## K3. Storage (the honest answer)
`window.storage` in the artifact is Anthropic-hosted, per-user, persistent, **not linkable** to Drive or iCloud. **The repository is the permanent, versioned store**: commit the app's JSON export as `state/kwezi.json` every delivery; restore by importing. Drive/iCloud may hold a backup copy; nothing in the runtime writes to them.

---

# PART L — ERROR LEDGER (seed; append-only)
Format: `### E-NNN · vNN · symptom` / `CAUSE` / `CAUGHT` / `RULE` / `TEST`.

- **E-001 · v63** · refresh "unexpected error" on first click · `max_tokens:1000` with web search; response truncated before the JSON · caught by realistic.cjs after weeks of misdiagnosis · RULE 4000 tokens with tools; name `max_tokens` stops · TEST realistic #2.
- **E-002 · v82** · sections flicker/reset on every state change · components defined inside `App` · caught by a failing edge-panel test · RULE module-level components, props not closures · TEST smoke "sections open, close, persist".
- **E-003 · v76** · 40 players rendered from a corrupt store · `sanitiseState` never capped/deduped · caught by mc_full fuzz · RULE cap 15, dedupe on id · TEST mc_full sanitise group.
- **E-004 · v58** · transfers recommended at FT=0 · optimiser ignored FT budget · caught by mc_all · RULE FT gate · TEST mc_all #12.
- **E-005 · v58** · illegal 4th player from one club · paired path skipped club cap · mc_all · RULE legal15 on every candidate · TEST mc_all #3.
- **E-006 · v58** · zero-minute player over a fit one · tie on zero score · mc_all · RULE starts tiebreak · TEST mc_all #19.
- **E-007 · v65** · third buy 5p over budget · bank from display-rounded `bankAfter` · mc_all · RULE raw prices only · TEST mc_all #22.
- **E-008 · v65** · "margin 0.00 LOW" from the same pair swapped · degenerate tie · mc_all · RULE margin vs genuinely different · TEST mc_all #24.
- **E-009 · v67** · three Hull defenders proposed · no correlation guard · review · RULE ≤2 incoming per club · TEST mc_all #27.
- **E-010 · v66** · Konsa sold the week he started · raw gain overrode the rule · review · RULE never sell a returning starter · TEST smoke_wk sells.
- **E-011 · v74** · Hull rated best defence · strength on goals not xG · captaincy inverted · RULE xG drives, goals explain · TEST smoke_wk TS sane.
- **E-012 · open** · Konsa/N.Jackson moves missed · name-keyed matching · GW review · RULE key on element id; BLOCK on mismatch · TEST pending (F1).
- **E-013 · v78** · TDZ checker false positives · comment-blind scan · RULE comment/string-aware · TEST tdz self-check.
- **E-014 · v77** · false failures for a session · stale suites after workspace reset · RULE suites live in outputs and repo · TEST verify invariant 9.
- **E-015 · v65** · `PLAYBOOK` deleted · regex end-anchor was the next `const` · RULE START/END markers · TEST verify invariant.
- **E-016 · v86** · closing tag and sentence swallowed · replacement spanned a block · esbuild + div-depth trace · RULE count==1 and diff review · TEST esbuild gate.
- **E-017 · v83** · smoke cascade · loop threw without navigating back · RULE `finally` to Command · TEST smoke structure.
- **E-018 · v84** · "refresh bar did not clear" · mocked a 500 (retried) · RULE mock 400 for clears · TEST realistic #8.
- **E-019 · v73** · captaincy on FDR (GW2 −8) · fixture over quality · RULE xG EV captaincy · TEST smoke_wk captain.
- **E-020 · v70** · "99% to win" · 5-GW compounding · RULE direction only <8 GWs · TEST mc_all variance cap.
- **E-021 · v68** · Bruno recommended · convergence ignored · MC against rivals · RULE ≥60% excluded · TEST smoke_wk convergence.
- **E-022 · v64** · simple mode opened on a pre-season checklist · wrong card · RULE both modes share `GwActionCard` · TEST smoke #1.
- **E-023 · v75** · 151 elements at 9px · no type floor · RULE 11px floor · TEST smoke type floor.
- **E-024 · v85** · 21px buttons · no touch floor · RULE floors per class · TEST smoke touch.
- **E-025 · v84** · 86 colour literals · no tokens · RULE 21 tokens, 0 hex · TEST smoke tokens.

A recurrence is a new entry referencing the old one, and the RULE is strengthened until it cannot recur.

---

# PART M — CURRENT PLAN (v110 · 2026-09-28 · verify before trusting)
> The plan of record is `data/plan.json` (the optimiser's, replayed from the rules) and `data/weekly.js`, which
> `pipeline/weekly.cjs` writes from it. Nothing here is an input: this block is the human-readable copy, generated
> from those files at the moment of writing, dated, and it carries the record of the plan it replaced.

**What happened to the v89 plan.** It recommended Wildcard 1 in GW6 with a heuristic fifteen (captain Groß)
and was superseded on 27 Sep, before the deadline, by the solved plan; never played. Held unchanged to GW19
with its best eleven and captain each week, the v89 fifteen is worth 805.4 Classic expected points by the ported engine,
the solved fifteen 856.1 (both measured on 27 Sep's block).

**Classic GW6: play Wildcard 1** (deadline Sat 10 Oct 12:00 SAST). 12 of fifteen change. Sell Diop, Shaw, Rogers, Brobbey, Semenyo, Verbruggen, van Ewijk, Kinsky, Szoboszlai, Hughes, Calvert-Lewin, Konsa; buy Janelt, Groß, Thomas, Tarkowski, Mykolenko, Barry, Leno, Stach, Trafford, Mbeumo, Hall, Gonzalo. Gabriel, Saka, Haaland stay. Captain **Saka**, vice **Gabriel**. £0.6m in the bank, 4 free transfers kept (a wildcard week keeps the count). Then **Bench Boost GW7** on Haaland and **Triple Captain GW8** on Haaland; the free hit is held (best week GW14, +4.09). The plan is worth 903.39 Classic expected points to GW19, proved within 0.18% of the best possible (certified by the wildcard now's bound). Wildcard in GW7 instead: 901.52 (-1.87, a difference inside the tolerance of about 4 points, so tie-breakers decide: the injury news lands before the deadline and the 4 free transfers survive the chip). Never: 889.69 (-13.70). Haaland is the one declared lock (over the C1.6 rival-ownership gate). **Fallback without the chip** is the app's own C2 protocol, because the optimiser's no-wildcard week sells Shaw, whom the Konsa rule protects.

**Draft GW6: 12 claims** (waivers settle Fri 9 Oct 12:00 SAST; trades close Thu 8 Oct 12:00 SAST). Lodge in this order: Silva for Dunk, Evanilson for Isidor, Mukiele for Davis, E.Le Fée for Belloumi, Hill for Bogle, McBurnie for Igor Jesus, Cunha for King; then the backups Schuster (Dunk), Fernandez-Pardo (Isidor), Justin (Davis), Buendía (Belloumi), Thomas (Bogle). Mainoo for Janelt (d 75%) is held back as flagged; re-check after Thursday's pressers. Worth 637.6 Draft expected points to GW20 under the stress test, a mean of 640.6 over 1500 simulated waiver runs, against 596.2 today.

**Flags on both fifteens (2026-09-28):** Classic — Semenyo d 75%, Brobbey d 75%, van Ewijk d 75%. Draft — Dunk d 75%. The plan's fifteen carries no flagged player.

**Chips:** all four of both sets unused. Set 1 expires at the GW19 deadline. **Tournament:** `player_xg` leads and drives nothing until its hold-out reaches two gameweeks. **F4:** the minutes logistic has passed the shared gate on Brier and the app has not been promoted onto it (ERRORS.md E-087, open, deliberate).

---

*Best in class here has meant one thing: nothing shown to the manager that has not been checked against the source and against the model's own record. Keep it that way.*

---

# PART N — THE RULES THE CODE MUST ENCODE (v110 §4, each verified)

Added in v110. Every rule here is cited in the code that implements it, and the citation is the
point: a rule in a prompt that no function names is a rule nobody applies.

## N1. Classic

- **Free transfers.** One more after each deadline, capped at five. A wildcard or free-hit week keeps
  the count exactly as it was: nothing spent, nothing added (Fantasy Football Scout, 20 Jul 2026).
  The cap is `1 + game_settings.max_extra_free_transfers`, read from bootstrap, not typed.
- **Hits.** −4 per transfer beyond the free ones, and only once every free transfer is used.
  The week's limit is therefore FT + 1 with one hit, capped at five — which is why the transfer
  search is exhaustive to three swaps and greedy above it (E-090). A search limit is never allowed
  to masquerade as a rule of the game.
- **Chips.** Two of each. The first set can be used up to the GW19 deadline: wildcard and free hit
  from GW2, bench boost and triple captain from GW1. One chip per gameweek.
- **Selling price.** The price paid plus half of any rise, rounded down to £0.1m; a fall is taken in
  full. Price paid is `now_cost − cost_change_start` for the original fifteen and `element_in_cost`
  from `/api/entry/{id}/transfers/` for anyone bought since. A screenshot is not a source: prices
  taken off the Transfers page went stale within days (E-088's class, and §7.13).
- **Defensive contribution.** 10 CBIT actions for defenders, 12 for midfielders and forwards, scores
  2 points, once per match. Goalkeepers never score it. `defensive_contribution` in the live data is
  a **count**, not a points total.
- **Squad.** 2/5/5/3, at most 3 per club. The eleven has 1 GK, 3–5 DEF, 2–5 MID and 1–3 FWD.
- **Picks timing.** Classic picks for the gameweek in play publish only after the deadline is
  processed — the endpoint answers 404 "Not found" until then. Plan from the last published squad,
  and never treat the current gameweek's picks as known.
- **Team strength.** The FPL `strength_*` team fields are all zero this season. Never use them.

## N2. Draft

- **Squad.** 2/5/5/3 with **no club limit**. Bench slot 12 is locked to a goalkeeper, there are no
  captains, and scoring is the same as Classic.
- **Like for like.** Every waiver claim and every trade swaps a player for one in the same position.
  A cross-position proposal is a defect, not a suggestion (§7.3).
- **Ownership status.** `o` owned, `a` available, `l` dropped since the last waiver run and locked
  until the next one. Before waivers settle (`/api/game` → `waivers_processed == false`) every
  unowned player is a **claim**; afterwards `a` players can be signed instantly until the deadline.
  The label the app shows is phase-aware, because "sign now" for a player who can only be claimed is
  advice that cannot be followed (§7.4).
- **Waiver processing in this league**, reproduced 74/74 against its own log, GW2–5 (E-089):
  - the order is reverse league standings, read from `waiver_pick` and never re-derived from the
    table — the picks are set at the last run and the table moves;
  - claims settle in **rounds**; each round visits managers in that order and each manager's claims
    are tried in the order lodged until one **lands**;
  - a claim fails "already claimed" if its target has gone — **checked first** — or "drop already
    gone" if its drop has left the roster;
  - **nobody moves to the bottom** after a success;
  - a failed claim is consumed and not retried.
- **Lodging order.** The claims sheet is built from the Draft solve's pairs (`buildClaimSheet`): each first
  choice ranked by its gain to the Draft horizon, each backup lodged for the same drop, and the order that lands
  the most value under the league's own processing kept — the deterministic stress test decides, the Monte Carlo
  orderings are reported beside it. Lodge exactly the written order.
- **Flags before claims.** No flagged player is lodged, as a first choice or a backup: the sheet is built with
  `fitOnly`, the held-back pair is named with its status, and it is re-checked after the Thursday pressers (D2).
  The gain that justifies a claim is measured to the Draft horizon, never over five gameweeks (E-126).
- **Re-draft.** Read `league.drafts` from `/api/league/{id}/details`. The unfinished draft's `event`
  is the first gameweek of the new rosters, so the Draft horizon is that gameweek minus one. On this
  league it is event 21, so the horizon is GW20 — read, not assumed (§7.12).
- **Rivals' elevens** publish at the deadline.

## N3. Two games, two currencies

Classic and Draft are separate games. Never add, average, net or compare a Classic figure with a
Draft figure, and label every number the app shows with its game. The final message to the manager
never shows the two as a sum.

## N4. What this file may not contain

No figure that the engine can compute. A gameweek number, a deadline, a free-transfer count, a
league position or a price in this file is stale within the week and will be quoted by a future
session as if it were true. Part M is the one exception, and it carries its own timestamp and the
words "verify before trusting" for that reason.

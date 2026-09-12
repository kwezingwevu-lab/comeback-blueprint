# data/ — the data layer of FPL Mission Control

| File | What it is | Written by |
|---|---|---|
| `fetch_live.cjs` | Node 22 script (global `fetch`, no dependencies) that pulls the public classic and draft APIs and writes `live.json` in the CONTRACT §3 shape. | hand |
| `live.json` | Committed snapshot of the public API: events, teams, elements, all fixtures, per-GW stats for finished gameweeks, Kwezi's entry / history / picks, the six winnable leagues with every rival's current picks, and the draft game, scoring, squad rules and elements. Every number is a number; prices are in tenths. | `fetch_live.cjs` |
| `draft_league.cjs` | Pure shaping of the four public draft-league endpoints into the CONTRACT §3 `draft` league block. No network, no filesystem, no clock. Required by `fetch_live.cjs` and by the QA suites, so a suite can never pass against a copy of the shaping the fetcher does not run. | hand |
| `validate_live.cjs` | 75 checks on `live.json` (keys, counts, shapes, no banned fields, ft derivation, league sizes, rival union, draft join). Exits 1 on any FAIL. | hand |
| `weekly.js` | The WEEKLY STRATEGY ENGINE block: one `const WEEKLY = {…};` statement of decisions only (wildcard 15, captain, fallback, draft claims, draft XI, chip plan). `build.cjs` pastes it between the START/END markers. | hand, each Friday |

## Refresh
```
cd fpl
node data/fetch_live.cjs            # network; prints one summary line
node data/validate_live.cjs         # must end SUITE validate_live 75/75
```
`npm run fetch` is the same first command. To rebuild from a folder of raw API snapshots
instead of the network (same code path, every URL answered from a file):
```
node data/fetch_live.cjs --offline <dir>    # bootstrap.json fixtures_all.json live{gw}.json entry.json
                                            # history.json picks{gw}.json leagues/{id}.json rivals/{entry}.json
                                            # draft_bootstrap.json draft_game.json
                                            # league_{id}_details.json league_{id}_status.json
                                            # entry_{id}_public.json entry_{id}_event_{gw}.json
```

## The draft league
```
node data/fetch_live.cjs --draft-league 1                                      # a league id
node data/fetch_live.cjs --draft-league https://draft.premierleague.com/entry/1/event/3
node data/fetch_live.cjs                                                       # or from state/kwezi.json
```
`--draft-league` accepts the address of a draft league, a bare league id, or a draft ENTRY id;
a bare number is tried as a league first and then as an entry (`entry/{id}/public` →
`league_set`). With no league id — which is where the file stands, because Kwezi's league id is
unknown and must not be invented — every league field in the `draft` block is written empty and
the app says the pool is unknown. With one, the block carries the teams, ownership by code,
each team's fifteen, the free agents, the fixtures, the table, the current picks and which team
is his. `element_status[].owner` is an **entry** id and is translated to a league-entry id in
`draft_league.cjs`; everything downstream speaks league-entry ids (ERRORS.md E-063).
The script is polite (at most 6 requests in flight; 3 retries with backoff on 429, 5xx and
network errors), touches nothing account-side, never reads `ep_this`/`ep_next`, and refuses
to write a file that contains the substring `ep_`. The deadline is read from
`events[].is_next` every run, never hard-coded.

## Ids versus codes
Classic and draft are two systems. Element ids differ between them — 59 of 655 players when it
was first measured on 11 September 2026, 59 of 656 the next morning after the game added a
player, which is why no test pins the total (ERRORS.md E-064). Tzolakis is classic 572, draft 571. Every draft element in `live.json` carries `code`;
join draft to classic on `code`, never on id or name. `weekly.js` therefore uses classic
element ids in `classic` and player codes in `draft`; `state/kwezi.json` does the same.
Name matching is banned outright (CLAUDE.md D3: it missed Konsa and N.Jackson).

## Derived fields
- `ft_available`: GW1 is excluded; 1 free transfer entering GW2; +1 per gameweek, capped at 5;
  transfers made in a gameweek consume free transfers first (hits do not reduce the bank
  further); wildcard and free-hit weeks consume none. The value is what the next deadline
  offers. Full comment in `fetch_live.cjs` (`deriveFt`).
- `gw.<n>.fixture_xg`: per fixture, the sum of player `expected_goals` from `event/{gw}/live/`
  by side. Side comes from the fixture's own stats blocks first, so a player who has since
  changed clubs is credited to the club he played for that week; a double-gameweek player's
  xG is split across his fixtures by the minutes in his `explain` blocks. The validator
  checks that the fixture sums equal the player sums for every finished gameweek.
- `leagues[].rank` / `last_rank`: Kwezi's row in the standings.

## The draft league id gap
`draft.league_id` is `null` and `state/kwezi.json` has `draft.league_id: null` with 12 of 15
roster codes and `roster_complete: false`. The draft league (Yoh-Nited) URL was not available
to the rebuild, so the roster, waiver order, free agents and H2H fixtures cannot be read from
`draft.premierleague.com/api/league/{id}/…` yet. Once the manager supplies the league URL,
put its id there and the draft tab reads the API instead of the hand-typed roster. The
manager's 44-name draft watchlist was also not available; `WEEKLY.draft.watchlist` is empty
on purpose and must be rebuilt under the three-starts rule before use.

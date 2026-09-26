# RETEST_v110 — merging the points-maximising build

Session opened 26 September 2026. Governing spec: `reference/v110/UPDATE_PROMPT.md`.
This file is written as the session runs, so the baseline below is what was measured **before**
any v110 change, and it is recorded whether it flatters the repo or not.

---

## 1. Preflight (§2) — every check, with what it printed

| Check | Result |
|---|---|
| `reference/v109/{live,app,README.txt}` present | Yes. 78 files, 8,999,606 bytes unpacked from the update bundle into `fpl/reference/`. |
| `cd reference/v109/app && node qa.js fpl-mission-control-v109.html` | **189 / 189, 3,920 property cases.** Sixteen suites: data 19, maths 12, proj 13, rules 38, separate 3, property 1, sim 10, opt 15, recon 5, prices 5, market 5, waivers 12, plan 11, render 26, act 9, page 5. The reference works in this environment. |
| Node 20+ | Node **v22.22.2**. |
| `scipy>=1.11` with `scipy.optimize.milp`, and `numpy` | Were absent. Installed: **scipy 1.17.1, numpy 2.4.6**. Pinned in `pipeline/requirements.txt`. |
| `https://fantasy.premierleague.com/api/bootstrap-static/` | **200** |
| `https://draft.premierleague.com/api/game` | **200** — `{current_event: 5, current_event_finished: true, next_event: 6, processing_status: "n", trades_time_for_approval: true, waivers_processed: false}` |
| `https://draft.premierleague.com/api/league/46148/details` | **200** |
| `https://draft.premierleague.com/api/entry/279275/public` | **200** |
| Playwright with Chromium | Present at `/opt/pw-browsers/chromium`. WebKit also launches here (`playwright install-deps webkit`, then `playwright.webkit.launch()` — never `playwright install webkit`), and `qa/webkit.js` ran. |

The network is open, so the session is not restricted to the frozen snapshot.

### §3 ground truth, checked against the live API rather than taken on trust

Every Draft figure in §3 verifies. Pulled today from `league/46148/details`, `entry/279275/public`
and `/game`:

- Entry **279275** "Yoh-Nited", league-entry id 281896, in league **46148** "Champions League
  Draft Pool B", 8 teams, `trades: "y"`, `transaction_mode: "waivers"`.
- **1 won, 1 drawn, 3 lost, 4 points, 7th of 8, 198 scored, 191 against.**
- **`waiver_pick` 2** — and the field is reverse standings, as §4 says: pick 1 belongs to the
  team lying 8th, pick 2 to Kwezi in 7th. The code reads `waiver_pick`; it never re-derives the
  order from the table.
- GW6 at home to "Isak at this game", GW7 at home to "Muggles & Wizards", GW8 away to
  "Thabz Appeal". 20 of 152 league matches are finished.
- `league.drafts` holds two: the completed one at `event` 1, and an unstarted one at
  **`event` 21**, `draft_dt` 2027-01-05T20:00:00Z (SAST 22:00). So the Draft horizon is
  **GW20** — read from the API, never assumed (§7.12).
- `waivers_processed` is **false**, so every unowned player is currently a claim, not a signing.

This matters because the repo did not have it: `state/kwezi.json` carries
`draft.league_id: null`, `draft.entry_id: null` and a roster reconstructed from twelve guessed
player codes, with a note asking for the league URL. §3 supplied the two ids and the API answers.

---

## 2. Baseline (§8.1) — the existing gate before any v110 change

`bash qa/run.sh` in dev mode (mc_full at 3,000 iterations), on commit `cd5bdb1`.

**Result: RED — 5 of 15 steps failed.**

| Step | Suite | Result |
|---|---|---|
| 1 | tdz_check (self-test + sources) | pass |
| 2 | esbuild syntax gate (real bundle) | pass |
| 3 | build (build.cjs → app/ + dist/) | pass, 6/6 markers |
| 4 | tdz_check (freshly built app) | pass |
| 5 | verify.sh | **31 / 31** |
| 6 | data/validate_live.cjs | **76 / 87 — RED** |
| 7 | unit_engine.cjs | **246 / 255 — RED** |
| 8 | smoke.cjs | **51 / 60 — RED** |
| 9 | smoke_wk.cjs | **26 / 36 — RED** |
| 10 | realistic.cjs | 8 / 8 |
| 11 | components.cjs | **128 / 133 — RED** |
| 12 | buttons.cjs | 10 / 10 |
| 13 | webkit.js | 34 / 34 |
| 14 | mc_full.cjs 3000 | 209 / 209 · **114,012 assertions** |
| 15 | mc_all.cjs | **135 invariants · 1,000,000 iterations · 0 failed · 372.7 s** |

Forty-four assertions failed across five suites. None is a v110 defect. They divide into two
causes, both created by refreshing the snapshot from GW4 to GW5 earlier on 26 September:

- **Expectations frozen to a past gameweek — `E-064` again.** `validate_live.cjs` asserts three
  finished gameweeks, 79 rivals, `ft_available === 3`, `next_event 4`, `current_event 3` and the
  literal deadline `2026-09-12T12:30:00Z`. The snapshot now holds five finished gameweeks, 83
  rivals, four free transfers and a GW6 deadline of `2026-10-10T10:00:00Z`. The smoke suites mock
  a clock of 12 or 15 September to land inside a gameweek-in-play window that no longer exists.
  The football moved and the assertions did not. They are fixed by deriving the instant and the
  expected values from the snapshot's own deadlines — never by relaxing what is asserted.
- **Fitted numbers that moved with the data.** The lab panel's unfitted-terms line and the
  tournament panel's `promotable` verdict: `player_xg` now leads 3 of 4 transitions at ρ 0.3054.

Timing, for comparison against the post-merge gate: the full dev run took about 11 minutes
wall-clock, of which `mc_all` was 372.7 s and `mc_full` at 3,000 iterations about 40 s.

**Measurement caveat, stated because it affects the numbers above.** Two subagents from the
superseded v89 wave were still executing during this run and were editing `data/weekly.js`,
`state/kwezi.json`, `ERRORS.md`, `qa/smoke.cjs`, `qa/unit_engine.cjs`, `qa/verify.sh` and
`package.json` in the same window. By the time the baseline run finished, `validate_live` read
86/86 and `unit_engine` 256/256 on the tree as it then stood — repaired by their concurrent
work, not by mine. The table above is the state at the start of the run, which is what a baseline
is for; where a later section credits a repair, it says whose it was.

---

## 3. Changes, in order, each with its proving number

### P0 · Rival managers' personal names were being committed — closed

The defect, measured before the fix: `data/live.json` carried **115 `player_name` fields holding
84 distinct real people's names**, inside `leagues[].standings`. They had propagated into
`app/FPL_Mission_Control.jsx` (115) and `dist/index.html` (115) — 345 occurrences in the shipped
tree. The recorded Draft fixtures under `qa/fixtures/draft/` held **50 more**, captured verbatim
from two strangers' public leagues, plus **24 league-entry `short_name` values**, which are
managers' initials and named in the rule. The interface rendered none of them, which is why it
went unseen: the rule is about committing, not about rendering.

Worse, `data/validate_live.cjs` **asserted that `player_name` was present**. The suite was
holding the violation in place and reporting green.

Written first, as the failing test: `qa/privacy.cjs`.

- It scans committed data, built artefacts and fixtures — not source prose, which has to name the
  keys in order to delete them.
- It matches the key in **quoted, single-quoted and bare** positions. This was not academic: the
  first version insisted on double quotes and read `dist/index.html` as clean while that file
  carried 115 names, because the build inlines its data block as a JavaScript object literal.
- Initials cannot be grepped, because a Classic team's `short_name` is a club ("ARS") and a Draft
  league entry's is a person ("KN"). So it walks the parsed JSON and flags `short_name` only on
  objects that identify a league entry.
- It **plants violations and proves it finds them** — one per encoding, plus a league-entry
  `short_name` — and proves it does not fire on the key name used in prose. A check that cannot
  fail reads as proof while proving nothing; this project has already shipped one such check
  (E-070), and that is not repeated here.

Then the fix:

- `data/scrub.cjs` — `scrubNames()`, pure, recursive. Drops the three name keys everywhere and
  `short_name` only from an object carrying `entry_id`, `entry_name` or `waiver_pick`. The
  reference bundle bakes its league entries as `{lid, eid, name, waiver}`, which is the same
  decision arrived at independently.
- `data/fetch_live.cjs` — the Classic standings row no longer maps `player_name`, and the entire
  payload goes through the scrubber at the write, so a field added to a feed tomorrow cannot leak
  a name in because nobody thought to strip it. The hard-coded `MANAGER_NAME` constant is gone
  with the name-matching fallback it fed.
- `data/draft_league.cjs` — a league entry no longer carries `manager` or `shortName`, and the
  "resolve which team is mine by the manager's name" fallback is deleted. The entry id is exact
  and is now known.
- `src/engine.js` — `manager` and `shortName` removed from the entry row and from its three
  consumers (`draftRivalRosters`, `waiverOrder`, `h2hOpponent`).
- `data/validate_live.cjs` — the inverted assertion: the standings row's keys are now required to
  be exactly `{entry, entry_name, total, rank}` and nothing more.
- `qa/fixtures/draft/*.json` scrubbed, with the provenance note in `MANIFEST.json` and
  `draft_fixture.cjs` corrected: they are no longer "verbatim", and saying so matters.
- `qa/privacy.cjs` runs first among the suites in both `qa/run.sh` and `.github/workflows/gate.yml`.

**Proving numbers: privacy 22/22 · 92 files · 12,650,291 bytes scanned · 0 name keys and 0
league-entry initials left in the tree, down from 345 and 24. validate_live 86/86 and
unit_engine 256/256 with the fields removed.**

Not closed by this change, and the manager's call rather than mine: the names are still in this
branch's **earlier commits**. The scrub stops them being shipped from here; removing them from
history means rewriting the branch, which is a decision to take deliberately.

### A1 · the pull, with a guard that has to be able to fail

`pipeline/pull.sh` fetches every public Classic and Draft feed. Three things the reference
`pull.sh` does not do, each because the reference's way is silently wrong rather than loudly wrong:

- **The gameweek in play is detected**, not passed as an argument defaulting to 5. A pull that
  fetches the wrong gameweek's picks is worse than one that fails, because it succeeds. Detection
  is `events[].is_current`, then the highest finished event, then `is_next` minus one; an explicit
  argument still wins for replaying a past week; with no bootstrap and no argument it refuses and
  writes nothing.
- **A feed that does not answer with parseable JSON leaves the previous file alone.** The FPL API
  serves an HTML "the game is being updated" page with a 200 during deadline processing. Writing
  that over a good snapshot turns a stale file into a broken one, and the bake then dies on a parse
  error instead of on a missing feed — which points the reader at the wrong thing entirely.
- **It exits non-zero and names what is missing** when a feed the bake cannot do without is absent.

`qa/pull_guard.cjs` **22/22**. The spec's test is "two runs on a blocked network leave the previous
files intact", and a guard that never writes would pass that too, so the suite proves both sides:
blocked, a 200 with an HTML body, and a 200 that does not parse all leave every file byte-identical
and exit non-zero; a feed that answers properly **does** overwrite. The stand-in API runs in its own
process, because the suite drives `pull.sh` with `execFileSync` and a server listening in this
process would accept the connection and never answer it — every case would have passed for the
wrong reason.

Proven live as well as against a stand-in: **53 feeds from the real endpoints, gameweek 5 detected,
exit 0.**

### B6 and E4 · the waiver model reproduces this league's own log

**74 of 74 claims across four gameweeks**, on the committed snapshot and on the log pulled today
(they agree: 116 transactions, 74 of kind `w`, 39 accepted, 31 "already claimed", 4 "drop already
gone" — the GW6 window has not run yet, so the log has not moved).

`waiverSim` is pure and context-free, so a suite can drive it straight off a recorded log and a
claims sheet can be simulated under several orderings without a context at all. Every rule in it is
one the log forced, and each week's processing order is read off the log's own `index` rather than
from today's `waiver_pick` — the picks move as the table moves, and these are past weeks.

Four mutations prove the fit is the rules and not luck:

| rule broken | score |
|---|---|
| none — the model as it stands | **74 / 74** |
| "drop already gone" checked before "already claimed" | 72 / 74 |
| a manager rotates to the bottom after a success | 73 / 74 |
| one attempt per manager per round, win or lose | 62 / 69 |
| the processing order reversed | 52 / 74 |

The 72/74 is §7.8's own number, reproduced independently rather than quoted. ERRORS.md E-089.

### E-084's rule made machine-checkable

`qa/no_frozen.cjs` **6/6 over 17 files, 0 offenders, 5 exemptions**. No check in `qa/` or `data/`
compares a live-sourced field, or the length of a live-sourced collection, to a literal number or a
literal ISO instant. `frozen-ok: <reason>` exempts the competition's shape (twenty clubs, 380
fixtures) or a synthetic fixture's own input; the reason is required and every exemption prints on
every run, so they stay visible instead of accumulating unread.

Mutation-proven on 16 cases — and the first version **failed** that proof, flagging ten legitimate
lines for every real one, so the field must sit immediately left of the operator and the literal
immediately right. It also caught a defect while it was being written: lifting the league-count
check above its `WANT_IDS` declaration put the constant in its own temporal dead zone, which
`node --check` cannot see.

### Three ledger entries closed, and one reopened as a bigger fix than it looked

**E-087 — the minutes gate opened and nothing noticed.** `driving` was a literal `false`, written
when the gate was shut. The decision turned out to be three questions, not one: `eligible` (the
gate AND a tail condition), `routed` (whether production actually asks the model) and `driving` (the
conjunction). Reporting `driving` for a model nothing calls would be E-087 inverted.

On the entry's own objection that Part J speaks of Spearman: Spearman is for a model that RANKS
players by points. A minutes model predicts a binary event, for which Brier is the right score and
Spearman is not defined — so the gate is appropriate and the objection does not hold. What the gate
cannot see is a tail: it is a mean over every scored row, and a handful of low-evidence rows is
exactly what moves a transfer recommendation. Promotion now also requires that, for every player at
the incumbent's floor, the challenger stays below an even chance.

Measured like for like, which is the correction that mattered: comparing the model's raw `pModel`
against the flag-adjusted incumbent invents disagreements out of nothing, and the first pass claimed
a 0.000 → 0.627 jump for Fatawu that was **entirely the flag factor**. Corrected, over 421 players
the two disagree by a mean of **0.104**, median 0.035, p90 0.304, max 0.598. Of **138** players at
the incumbent floor the challenger's highest raw figure is **0.497** against the 0.50 limit — it
holds by 0.003, which is close, and the engine says so rather than rounding it away.

So the challenger is **eligible** and is **not routed**: v110 §5 B3 replaces this minutes model
outright, and routing production through a model about to be replaced would spend a round's
before-and-after twice. `MINUTES_PRODUCTION_ROUTED` is a named constant beside the reason.

**E-088 — a price typed into shipped markup.** `src/ui.jsx` quoted `money(978)` for the written
fifteen's cost: a September fact describing a fifteen that has since been replaced, so the panel
invited the manager to read a £1.0m price move that never happened. It reads
`WEEKLY.classic.wildcard15_cost_written` now.

**E-090 — "at most 3 transfers this week" printed beside "FT 4".** The entry proposed rewording the
message. That would have made a true sentence out of a real limitation: with four free transfers in
hand the engine was **structurally unable to use the fourth**. C2's three-swap ceiling was written
when free transfers could not exceed three; they bank to five. The week's limit is now FT + 1 with
one hit, capped at five, and the search reaches it — exhaustive to three, then greedy, which is what
§5 B4 asks for, and only while a further swap pays.

Measured on the 26 September snapshot: **3 swaps worth 37.54 at LOW confidence → 5 swaps worth
54.01 at HIGH**, with one hit, in 46 ms. Hughes→Gomez, van Ewijk→Bogle, Brobbey→Emersonn,
Konsa→De Cuyper, Szoboszlai→Schade. A second rule fell out of it: the five-swap plan **declines**
the fourth forced sell (Semenyo, status d, 75%) because two unforced upgrades pay more, and nothing
said so. E-082's rule cuts both ways, so `keptForced` now names every forced sell the plan does not
make, with its reason.

### E-091 · the privacy fix's own next commit committed 489 personal names

Recorded here because it is the worst thing that happened in this session and it happened one commit
after E-085 was closed.

`pipeline/pull.sh` writes raw API feeds, which carry the name fields exactly as the endpoints return
them. The ignore rule was written as `pipeline/feeds/` **inside** `pipeline/.gitignore` — where
patterns are relative to that file's own directory, so it meant `pipeline/pipeline/feeds/` and
matched nothing. `git add -A` tracked 53 feeds carrying **489 personal-name fields** across thirteen
mini-league tables, the Draft league details and two entry feeds.

Two failures, and the second is the one that matters: `qa/privacy.cjs` walked the **working tree**,
where a tracked file and untracked scratch look identical. A suite that cannot tell tracked from
untracked cannot check a rule about committing.

Caught by `qa/pull_guard.cjs`'s own last assertion — `git ls-files pipeline/feeds` — inside the
full gate run, minutes after the commit. Not by review, and not by the suite whose whole subject
this is.

Both fixed. The privacy scope is now `git ls-files` plus anything in scope on disk that is not yet
tracked, so a file is checked before it is committed and a tracked file is checked whether or not it
is still on disk; and the ignore rule is proved with `git check-ignore --no-index` rather than read,
because a pattern that looks right and matches nothing is the whole defect. `qa/privacy.cjs` is
**25/25**. The commit that introduced the leak was **rewritten and force-pushed**, because a name
that has been pushed is not un-shipped by a later deletion. Honest limit: the rewritten commit
object may survive in the remote's unreachable objects until GitHub garbage-collects, and the 84
rival names in `data/live.json` in commits **before** `baac4bc` are still there — removing those
means rewriting further back, which is the manager's call, not mine.

### A3 · selling prices, against the reference's own recorded numbers

`purchasePrices` and `sellPrices` are pure and array-shaped, so a suite drives them straight off the
recorded feeds. `qa/prices.cjs` **12/12**:

- **15 of 15 match `golden.classic.sell`** — 14 priced from the start price
  (`now_cost − cost_change_start`), 1 from the transfer log (`element_in_cost`).
- The source is **named per player**, not inferred. On this snapshot the one player bought since
  gameweek 1 — Calvert-Lewin, in for João Pedro in GW5 — was bought at his start price, so the log
  and the derivation give the same 60. That is luck, not equivalence, so the suite also builds a
  synthetic buy-after-a-rise (paid 78 against a start price of 75) and asserts the log wins, and a
  buy-sell-rebuy and asserts the **last** purchase counts.
- Four mutations each break the fifteen: the full rise instead of half (3 of 15 wrong), rounding the
  half-rise up (2), a fall taken as half (4), the price paid ignored (3). A parity test that would
  pass with the rounding reversed is not testing the rounding.
- Seven boundary cases pin the arithmetic exactly, including that a one-tenth rise is not yet worth
  a tenth.

`state/kwezi.json` had Calvert-Lewin at 60 marked "estimated", inferred from the bank delta. The log
says 60. The estimate was right, and that is not the point: an estimate that happens to be right is
still an estimate, and §7.13 records a screenshot going stale within days.

### A note on scope, and on two gate runs spent finding out

A concurrent wave of subagents was editing `src/engine.js`, `qa/` and `data/` for part of this
session. About 1,400 lines of theirs arrived in the working tree: autosub resolution, a bench
planner, a leak backtest, a win-probability objective, hierarchical pooling, Dixon-Coles tau and rho,
and a **tenth** tournament model.

That cost two gate runs. The fourth run was green at 19 of 19; the fifth went red on four checks that
had pinned "nine models" — and the engine had changed between the two runs, so nothing I did caused
it. It is E-084's class applied to a registry instead of to a date, and the fix is the same: the
checks read `E.TOURNAMENT_MODELS` now, so adding an eleventh challenger is one line in the engine and
no churn in the suites. The fifth run also caught a regression of my own: `verify.sh` forbids an
account-touching URL anywhere in `src/`, and my new comment quoted the transfers endpoint's path.
The rule is right; the comment changed.

The inherited work is committed, because discarding it would destroy real work and the suites cover
it — mc_all's 135 property invariants over a million iterations, and unit_engine at 266. It has
**not** had a line-by-line review from me. That review is the first item after this, and saying so
is more useful than implying it was reviewed.

---

## 4. What has not been done yet

Everything in §5 A1–E7 beyond the item above. `docs/GAP_v110.md` marks each one present, partial
or absent with its target file, the failing test to write first and the effort, and gives the
order of work. The two P0 items come before A1.

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
that has been pushed is not un-shipped by a later deletion. Honest limit, measured on 1 Oct 2026 rather than
supposed: the pre-rewrite commit `9261b148` is still publicly fetchable by its SHA (the GitHub API
answers 200), the repository is public with Pages on, and rival names remain in earlier pushed
commits in five file families (`data/live.json`, `dist/index.html`, `app/FPL_Mission_Control.jsx`,
the Draft fixtures and some qa files, commits `2f419d5`..`cd5bdb1`), in PR #2's head ref, and on
`main` (the v87 page Pages serves). A later deletion does not remove any of that. The routes are a
GitHub support purge request, a history rewrite of `main` plus the pull refs, or making the repo
private (which takes the Pages app offline on a free plan). Each is the manager's call; none is
taken here. Recheck: `curl -s -o /dev/null -w '%{http_code}' https://api.github.com/repos/kwezingwevu-lab/comeback-blueprint/commits/9261b148d74889bc95864638f8363f9140890130`
must print 404 before E-091 counts as closed.

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


### B1–B5, B7–B9 and E2 · the v111 engine as a Node module, with parity proved

`src/mc_engine.js` is the kit's engine byte for byte below a 32-line header (`tail -n +33` is `cmp`-equal to
`reference/v111/app/engine.js`). Two loop-variable renames were made at first to quiet `qa/tdz_check.cjs`; E-109
showed the checker, not the code, was wrong, and once the checker was fixed the renames were reverted (bd927a7). `src/mc_analysis.js` carries the pure logic
the kit kept inside its interface: the claims sheet, trades, the two reviews, the gameweek simulation, the
head-to-head, the greedy transfers and the claimability labels, each a function of (engine, data, options)
returning plain objects labelled with their game.

`qa/parity.cjs` **51/51** in 3.6 s on `reference/v109/app/data.json`: calibration ka 1.5 / kd 2 / 42 anchors /
weeks 5–7 exact and rmse within 9.1e-6; forty ratings within 4.8e-5; thirteen priced fixtures within 8.9e-16 on
goals and 0.121 percentage points on the round trip; **8,430 expected-points assertions** (562 players ×
gameweeks 6–20) with a maximum error of 5.0e-4 against `solver_in.json`; the four greedy transfers move for
move; the claims sheet line for line against the reference interface required in-process (13 lines, strategy
firsts, 577.6 / 619.8 / 616.8 / 645.8 within 0.034); the head-to-head 0.5188 / 0.0309 against 0.519 / 0.031; the
Classic simulation 37 / 52 / 71 exactly; both reviews JSON-equal to the reference engine's. Seven in-suite
mutations and three file-level ones (a home advantage of 1.10 → rmse and 1,057 ep cells red; the backup floor
at 30 → 8 lines against 13; the position check removed → 53 cross-position trades) each go red.

### A2, A4–A7 · the bake, and the Draft ground truth

`pipeline/bake.js` is the kit's bake with arguments; the INTEL research moved to `pipeline/intel.js`, where eight
undated entries received the date their own sources carry. `qa/bake.cjs` **42/42**: baking the reference feeds
with the reference INTEL and its clock reproduces `reference/v109/app/data.json` **path for path with zero
excluded paths**; reconciliation 5 of 5 on both the reference and the 26 September bake, with a feed-level
mutation (the official total moved by one) proving the block reports a mismatch rather than copying the
reported figure; four free transfers into gameweek 6 against `golden.classic.ftNext`, and the ledger rule on
synthetic weeks — a wildcard week keeps the count; the transfer log equal to the reference's; the Draft
horizon read from `league.drafts` (event 21 → gameweek 20), proved by a feed with the draft moved to 22.
`state/kwezi.json` now names league 46148 and entry 279275 and carries the real fifteen by Opta code: of the
twelve codes guessed in v89 only four were on the roster.

### A8 · the solver input with a content hash

`pipeline/export.js` reproduces `reference/v109/app/solver_in.json` at **dde282bdf39bd757**, path for path apart
from the two clock fields. `qa/export_hash.cjs` **36/36**: the hash is stable under a re-bake that changes
asOf, delta, intel notes and 1,156 ownership and transfer-pressure fields, and moves under a price, a flag, a
start override or a fixture's home side. The repo's own export first hashed to f80b43568c47e325 against the
kit's d812652812be50a7 with 7,271 differing expected-points cells — every one of them the kit's calibration
factors, which the repo did not carry. Porting `pipeline/backtest.js` and `pipeline/calibrate.js` closed it: the
factors are identical (1.117 / 1.076 / 1.048 / 1.000) and the hash is **d812652812be50a7**, so the plan solved
and proved on 26 September is a solution of exactly this input.

### qa/visual.cjs · the missing gate step

Step 7 of the gate ran a suite that did not exist. It exists now: `audit_contrast` reads the 21 tokens from
`src/ui.jsx` through the same reader `build.cjs` uses and measures every foreground on every surface the markup
puts it on (the --mute fix reproduces as 5.4636 / 5.0243 / 4.5422; the old value as 4.1538 / 3.8198 / 3.4533);
`audit_layout` holds the Part G floors, the 11 px type floor across every rule and media query, the tab rule,
and zero hex literals in markup. It found one real defect on the current source — `.tabi` at 10 px under
380 px (E-100) — which is fixed; **42/42**, and three mutations go red.

### E-099 · the engine added a free transfer on a wildcard week

`ftAvailable()` in `src/engine.js` added one free transfer on a chip week; the rule (Part N1) is that the count
is kept. Invisible on this season's data because no chip has been played; the bake's ledger disagreed on
synthetic weeks and the unit test that pinned the old behaviour (E-045's "so 3") encoded the wrong rule. Both
corrected; `qa/unit_engine.cjs` 266/266.

### C1–C6 and E3 · the optimiser, the ledger replay and the plan legality suite

`pipeline/solve.py`, `solve_long.py` and `solve_later.py` are the reference's programmes byte for byte in their
model regions, with arguments for paths. `pipeline/plan.cjs` keeps the best of identical solves under the
content-hash guard (E-101: a plan solved on other data exits 3 with nothing written), folds the timing file
with "now" := the kept plan, re-prices the free-hit weeks against the kept plan, and REPLAYS the ledger from
the rules of the game — free transfers, hits and bank week by week, a wildcard week keeping the count — so
the interface never reads the solver's own free-transfer variables (§6; E-102). `qa/plan_legality.cjs`
**49/49** on the reference plan as first recorded (the recorded solver output run through `plan.cjs`): fourteen
rules on each of fourteen weeks, plus the C acceptance read from golden — total **878.28 = golden to the cent**, gap 0.012967 equal, wildcard GW6 with Saka, Triple Captain
GW7 on Haaland, Bench Boost GW10, no hits; the GW6 fifteen name for name; the timing 878.28 / 876.8 (GW10) /
869.4 exact; the Draft roster 645.77 from 577.57 with the eight golden pairs. The replay agrees with the
solver's fields on all fourteen weeks and the reference ledger confirms the rule in data (GW6 wildcard keeps
4; GW7 uses 2 → 3; then 4; then the cap). Five mutations go red at the named week (a rebuy 39/49; the replay
disagreeing exits 2 naming GW7/8/9). `qa/solver_smoke.sh` **7/7** in 55 s: a 30-second solve returns a legal
plan — measured, not chosen: HiGHS finds its first incumbent on this model (8,091 variables, 883 integer,
11,787 rows) at 21.5 s on this machine, so the spec's 20 s returns no plan at all and the header says so.

### Calibration proved, and the checker that had forced two renames

`qa/calibration.cjs` **24/24**: the ported stage reproduces the kit's model block — four factors exactly and
89 backtest leaves with zero paths over 1e-9 — on a copy of the committed block, and the committed block's
own model equals the fixture; the corrections never feed their own evidence (calibrating twice equals once,
and the mutant with both defences removed differs); two on-disk mutations of the backtest (the shrink at
full ratio, the last week dropped) go red naming the moved factors. The export hash of the committed block
is **d812652812be50a7**, the artifact's. E-109: `qa/tdz_check.cjs` attributed a `for (let x …)` header to the
enclosing block, so a loop variable reused across two loops read as a same-scope TDZ — four findings on the
untouched kit engine; the checker now scopes a for-header declaration to its loop, its self-test is 10/10
with the new case, the unrenamed kit reads CLEAN and a genuine TDZ still fails. E-108 records the Draft
horizon rule (§7.12) with its three checks.

### The solve stage · data/plan.json and the reference acceptance

On 26 September the export of the calibrated block hashed to **d812652812be50a7**, the artifact's own, so the kit's three
solver files were copied byte for byte (cmp equal; 19,732 / 15,693 / 5,430 bytes; instants 26 Sep 17:26,
17:35 and 17:51 UTC) rather than re-solved: a plan proved on identical input is a plan for this input, which
is what the content hash exists to say. `pipeline/plan.cjs` kept the long solve (objective 677.51, gap
0.00996), folded the timing file with now := the kept plan, and replayed the ledger: **data/plan.json** —
903.96 expected points to gameweek 19, wildcard GW6 (Saka, vice Gabriel), bench boost GW7 and triple captain
GW8 on Haaland, no hits, the replay agreeing with the solver's fields on all fourteen weeks, legality
**39/39**; timing 903.96 / 897.47 (GW7) / 892.26, every case proved by the kit; Draft 667.23 from 596.17.

The reference acceptance was run for real, twice, each solve detached on an idle core and waited on by pid:
240 s reached 874.35 at a 1.65% gap; 480 s **proved optimal within 0.5% at 265.5 s** — 882.72, objective
661.74, wildcard GW6 with Saka, triple captain GW7 on Haaland, no hits, the Draft roster 645.77 from 577.57
with the eight golden pairs. That is inside the spec's 2% of golden's 878.28 — and it is a **better plan
than golden's**: golden records a 240 s incumbent (objective 658.74, gap 1.3%) whose bench boost sits in
GW10; the proven optimum puts it in GW9. `qa/plan_legality.cjs`'s acceptance had compared a re-solve to that
incumbent exactly (chip weeks, first fifteen, total to 0.05, gap to 1e-6, timing now to 0.05), so the better
proven solve failed five checks (44/49). That is E-084's class in an acceptance test — a time-limited
incumbent photographed as truth — logged as **E-106** and corrected to what the spec actually asks (f9d73c1): total within 2%, wildcard GW6,
triple captain GW7 with Haaland, one bench boost, no hits, gap under 3%, timing within 2%, the Draft pairs, and
an objective at least the recorded incumbent's — **55/55**, with six new mutations (the triple captain moved, a
second bench boost, an objective a point under the incumbent's, a hit, a gap over 0.03, a later total 3% off),
each red on its named check. Exact reproduction of golden stays available where it belongs: the recorded
solver output run through plan.cjs, which proves the fold and the replay rather than the solver's clock.

### What the first full gate run found, and the two commits it asked for (E-107)

The adversarial review ran the gate once on the port wave: 26 of 29 steps green, the three reds explained (E-106,
and Isak's new flag twice). It also found that commits for E-099 (`ftAvailable` on a wildcard week) and E-100 (the
10 px tab label) had changed the sources but not the shipped page: `app/FPL_Mission_Control.jsx` had last been
written on 26 September, so the page still carried both defects, and nothing could see it because the gate
rebuilds at step 3 and the source-equality check reads the rebuild. The page was rebuilt and committed (b4674d7;
`node build.cjs` reproduces the tree byte for byte, unit_engine 266/266, visual 42/42), and E-107 records the rule:
a commit that changes a source carries its rebuilt `app/` and `dist/`, until a pre-build comparison exists.

### E-106 closed, and a count typed into a test (E-110)

`qa/smoke_wk.cjs` pinned the Draft claims at six, the length of the v89 block, in two checks and one detail line.
The v110 sheet lodges twelve or thirteen, so the first honest refresh would have gone red for giving better advice.
Both checks now read the block's own length and the detail derives its code count (f9d73c1). E-111 records spec
§7.13, the stale screenshot selling prices, held by `qa/prices.cjs` 12/12 (a835c6e).

### The refresh on 27 September, and the weekly block written from the plan (905ab36)

**Feeds.** `pipeline/pull.sh` fetched 53 feeds at 16:18 UTC; the bake, the calibration (factors unchanged at
1.117 / 1.076 / 1.048 / 1) and the export moved the hash from d812652812be50a7 to **cef80183f9a5a2ae**. Two players
changed since the 26 September bake: Isak flagged d, 75%, foot injury; Zepa down £0.1m. `pipeline/intel.js` was
left as it stood: the one new fact is the official flag itself, and there was no dated report to set against it.

**Solve**, detached on an idle machine, the main chain and the long solve on separate cores:

| Stage | Result |
|---|---|
| Main plan (240 s limit) | optimal within 0.49% at 237.1 s · **902.96** Classic expected points to GW19 · objective 677.14 |
| No wildcard (168 s) | 890.66 at a 6.8% gap on the clock |
| Long solve (600 s limit) | optimal within 1% at 156.1 s · 897.08 · objective 672.09, so not kept |
| Timing: later | wildcard in GW7, optimal within 1% at 240.1 s · **897.74** |
| Timing: never | 891.42 at a 1.9% gap on the clock |
| Draft roster | 667.23 from 596.17; with the manager ahead taking his modelled picks, 650.98 |

`pipeline/plan.cjs` kept the main plan and replayed the ledger (agrees on all 14 weeks): **wildcard GW6, captain
Saka, vice Gabriel; bench boost GW7 and triple captain GW8, both on Haaland; no hits**; twelve changes on the
wildcard. `qa/plan_legality.cjs --plan=data/plan.json` **39/39**. Playing the wildcard now beats holding it to
GW7 by 5.22 and never playing it by 11.54 (the better of the two no-wildcard bounds is quoted).

**The Draft league reaches the snapshot (E-125).** `state/kwezi.json` had carried league 46148 since the morning,
but `data/live.json` had not been re-fetched, and five checks asserted that the shipped snapshot had no league —
a photograph of the day the id was unknown: `data/validate_live.cjs`, `qa/verify.sh` I15, the unit suite's
no-league context, smoke_wk check 36 and the components suite's no-league render. Each now reads the league from
the state and builds the no-league case explicitly; the 26 September snapshot goes red on the new validator checks
(85/87), and the fixed suites read 88/88, 33/33, 266/266, 37/37 and 135/135.

**`pipeline/weekly.cjs` (stage 7).** The weekly block is no longer typed. It is written from the plan: the fifteen,
the armband, the chips, the timing lines, the fallback and the Draft claims sheet, with the plan's hash, and the
v89 plan kept as `superseded` (its fifteen held to GW19 is worth 805.4 Classic expected points by the ported engine,
v110's 856.1). Three rule conflicts surfaced on the first dry run and each is resolved in the open (E-126):

- The optimiser's no-wildcard week sells Shaw, whom the Konsa rule protects, so the written fallback is the app's
  own C2 protocol and the block says why.
- Mainoo is flagged (d, 75%) in both games' feeds, and the Draft solve paired him with Janelt; `buildClaimSheet`
  gained an opt-in `fitOnly` (default path unchanged, parity 51/51), so he is held back as a first choice and as a
  backup and named with his status.
- smoke_wk check 28 judged claims over five gameweeks, where law §1.2 plans the Draft game to GW20; it now measures
  to the horizon, prints the five-week engine's disagreement (six of twelve today), and gains two guards —
  the written claims equal the sheet line for line, and the block, the plan and the data share one hash — both
  mutation-proved (a swap and a foreign hash each give 36/37).

The sheet lodges **twelve claims, every first choice and then the backups**: Silva for Dunk, Evanilson for Isidor,
Mukiele for Davis, Le Fée for Belloumi, Hill for Bogle, McBurnie for Igor Jesus, Cunha for King; then Schuster,
Fernandez-Pardo, Justin, Buendía and Thomas. Under the league's own processing it is worth 637.7 in the stress test
and a mean of 640.6 (p10 626.5, p90 652.9) over 1,500 simulated runs, against 596.2 today. The four orderings
differ by at most 7.7 and the two best by 0.6, inside the simulation's noise, so the deterministic stress test
decides, as the port does.

The suites on the final data: tdz clean, privacy 25/25, no_frozen 6/6, validate_live 88/88, parity 51/51, bake
42/42, export_hash 36/36, calibration 24/24, waiver_log 13/13 (74/74 claims), prices 12/12, pull_guard 22/22,
plan_legality 39/39 and 55/55, verify 33/33, unit_engine 266/266, smoke 60/60, smoke_wk 37/37, components 135/135,
realistic 8/8, buttons 10/10, webkit 34/34.

---

### The refresh on 1 October, the audit's fixes, and the iOS 27 work (v110 ship)

**Feeds and solve.** `pipeline/pull.sh` fetched 53 feeds at 18:19 UTC; the export hash moved from 681ecb778aa48846 to
**1c1af4c2c40b1b26** (prices and flags), so the plan was re-solved on an idle machine. Main plan (240 s): optimal within
0.50% at 232.4 s, **904.07**. The three timing scenarios ran side by side with `solve_scenario.py … 900 --gap 0.004`:
now 904.00 (gap 0.38%, 311 s), later 899.87 (wildcard GW7, 0.40%, 394 s), never 889.86 (0.40%, 622 s). `plan.cjs` kept the
main plan and certified its gap at **0.38%** from the "now" bound (E-128). **Wildcard GW6, captain Saka, vice Gabriel;
Triple Captain GW7 and Bench Boost GW9 on Haaland; no hits; £0.1m in the bank.** Holding the wildcard to GW7 costs 4.20,
more than the proof's 3.6-point tolerance, so playing it now is proved better, though only just. `data/live.json` was
re-fetched too (18:40 UTC), which the 28 Sep refresh had done and this one nearly missed: the price check reads it.
The Draft sheet is unchanged in order (twelve claims, Mainoo held back as flagged); stress 637.7, mean 640.6 against 596.2.

**The audit (28 Sep, 105 findings, 79 confirmed by a sceptic).** Fixed here, each with a ledger entry and a check that
can fail: the CI sweep that could never pass (E-141, `qa/fail_scan.sh`, both workflows); a rival's name in CLAUDE.md
and a privacy suite that could not see prose (E-142, by-value scan from the raw feeds); the minutes tail condition
scored against gameweek zero, which had reported the logistic eligible (E-143, independent oracle, mutation-proved);
the Chips, Rivals and older Plan panels speaking for the app's own fifteen while the landing spoke for the solved plan,
the Draft head-to-head showing the phone's 400 draws instead of the baked 30,000, and three tabs naming no game
(E-144); the refresh moving the official deadline and any price (E-145); every screen saying v89 and a version check
that could not disagree (E-146); a league with no scores shown as rank 0 in green; "Worst case" on a stress scenario;
"+69.9 if all land" where all twelve cannot land; "valid" beside a negative five-week gain; the "Best XI" caption
naming a fifteen it did not show; solver dependencies unpinned. Recorded, not fixed, and the manager's call: the
repository is public, Pages serves `main` (the v87 page with rival names), and earlier commits remain fetchable by SHA
(measured above under E-091); merging this branch would replace the served copy, and purging history needs a GitHub
request or a rewrite of `main`.

**iOS 27.** Stages one to four landed (safe areas, 44 pt floors, 16 px controls, contrast, Reduce Motion; text-only
storage with a visible not-saving notice; update on resume and a 3 s race to the cached shell; the tab jump, one
status region, share and import, the Lab device readout). `qa/ios.cjs` is wired into `qa/run.sh` and `gate.yml`
(G-03) and reads **78/78** on iPhone 17, 17 Pro and 17 Pro Max profiles in WebKit. Not proved here: real safe-area
insets, focus zoom and the Home Screen app on a real iPhone (the WebKit build is Playwright's on Linux).

**The gate.** First full run on this tree: 35 of 39 steps green; the four reds (no_frozen on two literals in the new
refresh test, components on the new note's missing fixture and a source scan the new attribute order broke,
smoke_wk on the head-to-head check that still expected the phone's margin, mc_full P07, E-147) were fixed and each
re-run green: no_frozen 6/6, components 292/292, smoke_wk 37/37, mc_full 302/302. The first release-count run
(`qa/run.sh --release`) found two more: mc_full P05 at 25,000 iterations (truncateElements handed junk input back) and
IOS27-17's mount bound, 0.21 s over a fixed slack under load (E-148). Both fixed in a7b915b.

**The release gate on a7b915b: ALL PASS, 39 of 39 steps, 1,275 s.** privacy 27/27, no_frozen 6/6, visual 56/56,
validate_live 88/88, waiver_log 13/13 (74/74 claims), prices 12/12, parity 51/51, bake 42/42, export_hash 36/36,
calibration 25/25, plan_legality 43/43 and 59/59, verify 34/34, pull_guard 22/22, solver_smoke 7/7, unit_engine 273/273,
components 292/292, mc_render 65/65, the eight mc suites 27, 19, 15, 42, 43, 12, 15 and 37 of the same, smoke 69/69,
smoke_wk 37/37, realistic 8/8, buttons 10/10, webkit 58/58, ios 78/78, browser 185/185, mc_full 302/302 at 25,000
iterations (950,013 assertions), mc_all 136 invariants over 1,000,000 iterations, 0 failures. `qa/fail_scan.sh` on that
log: no line starts with FAIL. On GitHub, fpl-gate run #36 (4286e46) is the first green CI run of this branch.

---

### The wildcard as late as possible (2 Oct 2026)

Asked for after the release gate: a scenario where the first wildcard is played as late as the rules allow, the last week before set
one expires (GW19). The optimiser cannot place a wildcard there, because it holds the squad after the first eight weeks and a chip
cannot be played in a held week. The first attempt widened `solve.classic` to all fourteen weeks and edited the reference's own
function, which the legality suite forbids; the wide solve and its base then ran 1800 s each and stopped at 3.1% and 4.9% gaps with
incumbents below plans already in hand (E-149). Neither the edit nor the result is kept.

What shipped instead is `pipeline/latest_wildcard.py`: the proven `never` plan unchanged to GW18, then the wildcard in GW19 with the
fifteen rebuilt for that week by `solve.one_week_best` under the held squad's budget, nobody re-bought. On 1 Oct's data it is worth
**894.63**: **4.77 above never playing the wildcard (889.86) and 9.44 below playing it now (904.07)**; nine changes in the last week,
+4.75 points that week. It is built, not solved, so it is flagged constructed and carries no gap, and it is a floor, not a proved
best. The Plan tab says so in one sentence of the timing note: waiting to the end costs at most the plan above minus this plan plus
the proof tolerance (9.4 + 3.6, so at most about 13 points), and points are counted only to GW19, so a wildcard played then is credited
with one week of its new squad and none of the weeks after it. That caveat is the real limit of the scenario: it measures what waiting
gives up inside the window, not what a late wildcard would earn afterwards.

Proof: `qa/plan_legality.cjs` 51/51 on `data/plan.json` (four checks on `latest`: one wildcard in GW19, no gap of its own; every earlier week
is the never plan's own; all fourteen weeks legal under the full rule replay; the total is the sum of its weeks and not below never; and
four mutations, each red), components 295/295 (the sentence with its figures, absent without a `latest`, and two moved-number
mutations), smoke 69/69 with the Plan tab inside its word gate, smoke_wk 37/37, verify 34/34, ios 78/78, mc_separation 43/43,
privacy 27/27, visual 56/56.

**The release gate with the scenario in: ALL PASS, 39 of 39 steps, 1,148 s**, `qa/run.sh --release` on the committed tree: plan_legality 51/51
and 59/59, components 295/295, mc_full 302/302 at 25,000 iterations (950,013 assertions), mc_all 136 invariants over 1,000,000
iterations, ios 78/78, 0 failures.

---

### The refresh on 2 October, and "current at all times" (2 Oct 2026)

Asked for: the data, statistics, analysis, pundits' opinions, press conferences and forecasts current at all times.

**What was refreshed, as at 07:25–07:52Z on 2 Oct.** The official Classic and Draft feeds (53 pulled, `data/live.json`
re-fetched); since 1 Oct the only change was Mykolenko flagged 75% (leg). The desk research in `pipeline/intel.js` was
re-read in full by three research agents, each told to return only what a page it opened said, with the page's own date:
bookmaker prices for all twenty gameweek 6 and 7 fixtures (OddsPortal, live scrape; gameweek 6 read twice and matched;
Chelsea v Bournemouth moved most), start-probability overrides for seven players where dated reporting now differs from the
official flag (João Pedro 0.40, Semenyo 0.45, Brobbey 0.25, van Ewijk 0.50, Dunk 0.70, Havertz 0.20, Mykolenko 0.50, each
with its sources), and nine dated notes: international matches still to come on 3–6 Oct, no gameweek 6 press-conference
schedule published yet (Coventry and Newcastle play on Monday and may not speak before the deadline), prices not paused for the
break, international minutes for the plan's players, and pundit opinion on the captaincy (The Scout, OneFPL and Fantasy
Football Scout back Saka; RotoWire projects Bruno and Palmer higher), on the plan's picks (no published draft runs three
Everton players; Gabriel called pricy) and on the chips (Manchester City host PSG on 14 Oct, three days before the Triple
Captain week).

**The plan, re-solved on that input (hash e24645609f1ec9db).** 903.41, proved within 0.39%: Wildcard GW6, captain Saka, vice
Gabriel; Triple Captain GW7 and Bench Boost GW8 on Haaland; no hits; £0.0m in the bank. Against 1 Oct it buys Raya where it
bought Benitez (who sat under the three-starts floor), keeps Diop where it bought Branthwaite, and moves the Bench Boost from GW9
to GW8. Wildcard in GW7: 900.54, 2.87 behind, inside the 3.6-point tolerance, so the two weeks are level on expected points and
the tie-breakers decide. Never: 892.59. As late as the rules allow (GW19, built): 896.84. Draft: twelve claims in the same order,
Mainoo held back; stress 637.5, mean 640.4, against 595.4 today. Raya and Haaland are the declared locks over the rival-ownership
gate.

**What "at all times" can and cannot mean here.** Nothing in the app is live: it carries a snapshot. Since this change the header
says how old the snapshot is on every screen ("5h old"; amber past a day, pink past three) and the landing card says to check
for new data once it is a day old (components, smoke 69/69, webkit 58/58, ios 78/78). The scheduled refresh (`refresh.yml`) still
runs only daily inside international breaks and only from the default branch, where it is not yet merged; running it every three
hours in every week was proposed and declined by the session's permission check, so it is the manager's to approve. Press
conferences for gameweek 6 have not happened (expected 8–9 Oct); the next refresh worth doing is after them, and again after the
overnight price change before the deadline.

**The gate.** The release run on the refreshed tree found three real defects, each fixed and logged: the app's own budget check
charged a kept player today's price and called the legal £0.0m-bank wildcard £0.1m over (E-150; the optimiser and the rule replay
were right); the second bake of the morning compared itself with the first and lost the "since the last build" changes (E-151);
and the 30-second solver smoke had stopped being a margin on this input (E-152, now 45 s). The Plan tab went to 524 words with
today's longer timing wording, so the late-wildcard reasoning moved behind a reveal. Final release run on a4ab3af: 38 of 39 steps
green, the one red the solver smoke at its old 30 s limit; after E-152, solver_smoke 7/7 twice alone. Suites on that run:
unit_engine 274/274, components 300/300, smoke 69/69, smoke_wk 37/37, webkit 58/58, ios 78/78, verify 34/34, plan_legality 51/51
and 59/59, mc_full 308/308 at 25,000 iterations (after the costedSquad guard), mc_all 136 invariants over 1,000,000.


**Afternoon, 2 Oct (13:26–14:10Z).** The feeds were pulled again: nothing a decision rests on moved (export hash unchanged), so the plan
stands and was not re-solved. A two-agent sweep for news since 07:45Z found no availability change on any listed player (Ukraine's
coach confirmed Mykolenko out of their match; Sunderland still awaiting news on Brobbey; Hall in contention for England; Groß and Raya
won September's monthly awards) and three gameweek 6 fixtures moved by 0.05 or more on a leg at OddsPortal, all within half a point of
implied probability; both are recorded in the desk research with their times, and the odds table keeps the 07:25Z read. The release gate
ran beside that sweep and tripped two wall-clock bounds (E-153): webkit IOS27-04 now waits on the store's state rather than 800 ms, and
the fuzzer's hang watchdog allows a whole-App render five seconds (every other call keeps two). The Command tab says "no price or flag
has changed" when the delta is empty, and every time in the desk research carries its date so the Lab shows it in SAST. On the rebuilt
tree, alone: bake 42/42, privacy 27/27, components 300/300, smoke 69/69, verify 34/34, mc_full 308/308 at 25,000, webkit 58/58, ios 78/78.
---

## 4. What has not been done yet

- The merge to `main` and the protection of `main` (audit F02, SEC-05): both are the manager's to do or approve. The tag
  `fpl-v110` marks the shipped commit on this branch.
- History purge of rival names (P-01 to P-03): the manager's decision; the routes are listed under E-091.
- Audit findings left open, each a refinement rather than a wrong number on screen: trades and claims computed
  independently (F-15), hard-coded figures in copy (F-16), the waiver log's live leg skipped silently on CI (F08),
  the A7 date predicate (F10), sellPrices wired on the bake side only (F11), four cannot-fail checks (G-04 to G-06,
  G-08, G-09), the live price check making a pushed gate perishable (F14), refresh.yml's write token on disk (SEC-04's
  second half).
- Device-only checks: safe-area insets, focus zoom, Increase Contrast and the Home Screen app on a real iPhone 17.

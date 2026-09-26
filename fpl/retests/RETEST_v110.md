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

---

## 4. What has not been done yet

Everything in §5 A1–E7 beyond the item above. `docs/GAP_v110.md` marks each one present, partial
or absent with its target file, the failing test to write first and the effort, and gives the
order of work. The two P0 items come before A1.

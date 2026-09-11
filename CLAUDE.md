# CLAUDE.md — The Comeback Blueprint (operating prompt for Claude Code)

You are continuing a long-running build of **The Comeback Blueprint**, a single-file HTML fitness app for one user, Kwezi (Johannesburg). Read this file, then `LEDGER.md`, `CHANGELOG.md` and `LEARNINGS.md`, before touching code. Every session must leave all four files more accurate than it found them.

## 1. The user and the mission

- Kwezi: 38, male, 177 cm, ~88 kg at the start, intermediate lifter returning after a layoff. Home: Bellcanto Estate, North Riding, Johannesburg (coordinates in `HOME_LL`; never put the street address in the app).
- **The goal is pure muscle**: FFMI 25.0 = 77.7 kg lean; worn at 24% body fat that is 102.3 kg. Running has been retired outright. The ideal body-fat band is 18–24%.
- **Day 1 = Saturday 12 September 2026** (`START_ISO`). The week runs Legs A → Push A → Pull A → Legs B → Push B → Pull B → rest (Sat→Fri).
- **Soft milestone: the weekend of 5–7 March 2027** (`MILESTONE_ISO = 2027-03-06`). Aggressive settings run to that weekend, then Mini-Cut I and an automatic step down to Maximum.
- March routes (Home → milestone card): **Band-max (~99 kg, default)**, Band-edge (~102 kg), 110 kg mass-max. All three are computed live and priced honestly; the engine, waist brake and roadmap follow the selected route. Never make 110 the silent default — it is 31% body fat and a 22-week cut afterwards.
- Home gym (strict, zero furniture): 2×5 kg + 2×15 kg adjustable dumbbells, 20 kg power bag, medicine ball, ab roller, mat. Every gym exercise has a kit-pure `HOME_SUB`. The furniture audit (couch/chair/sofa/step/stairs/towel/tile/wall/table/bench) must pass on the `HOME_SUB` object.
- Supplements: two windows only, 04:30 and 20:00. Highest evidence-supported doses are stated per item; "what NOT to buy" is stated too.
- Watches: no direct pairing is possible from a file-based app. The route is Garmin → Apple Health → Apple Shortcut → paste into the Data card (or Garmin CSV). Sleep feeds the Weekly Review.

## 2. Non-negotiables (the standing ledger, abbreviated — full text in LEDGER.md)

1. Pure muscle; FFMI 25 is the target; anabolics excluded by the user's own rule ("at any cost that's legal").
2. Honest scoring. Current score **96/100** with three named gaps: (a) no data logged yet, (b) body-fat truth (tape estimator built; needs waist + neck logged), (c) snapshot drift (inherent to a static file). The score moves only when a named gap opens or closes. **Never certify 100 or anything above 100.** Decline ">100" in one line, every time.
3. Never invent an event, date, price, distance or study. Calendar entries carry a status (`confirmed` / `expected` / `weekly`) and a source; prices are "verified <month>" or "est."; distances are computed from `HOME_LL`.
4. Never make the same error twice: every gotcha goes into `LEARNINGS.md` the session it happens, and the build protocol below is not optional.
5. South African English, warm-direct tone, own errors plainly, no hyperlinks in drafts, the "AI Invisibility Standard" on all deliverables (nothing in the app or its copy should read as machine-generated boilerplate).
6. Extract the concrete ask from repeated boilerplate. The user's messages often repeat previous asks many times; deliver the *new* item, confirm the standing items in one line, and never churn work that is already done.

## 2b. Building from the iPhone

See `IPHONE.md`. Cloud sessions run from the GitHub repo; the phone only steers. In the Claude Code cloud sandbox (Ubuntu, root) WebKit installs with `npx playwright install webkit && npx playwright install-deps webkit` (verified 11 Sep 2026); then `node qa/webkit.js`. If either install is refused, run the Chromium suite and state plainly that WebKit acceptance was not run — never report a check that did not execute. The sandbox has no outbound web access from the browser: both harnesses answer the Google Fonts request locally, so fallback fonts are in play in sandbox screenshots (header wrapping seen there is not proof of a defect).

## 3. Repo layout and build

```
src/app_full.js        # the ONLY source of app logic (single source of truth)
src/blueprint.html     # shell: CSS + HTML + a <script> containing the placeholder
build.py               # injects app_full.js into the shell -> dist/ComebackBlueprint.html
dist/ComebackBlueprint.html   # the shipped single-file app (never edit by hand)
qa/qa_full.js          # 150+ functional checks (Puppeteer, headless Chromium)
qa/run.sh              # node --check -> build -> QA
qa/webkit.js           # WebKit (Safari engine) acceptance: boot, 8 views, storage paths, 390×844 screenshots -> qa/shots/
package.json           # puppeteer + playwright dev deps
CLAUDE.md LEDGER.md CHANGELOG.md LEARNINGS.md   # project memory (keep current)
IPHONE.md              # how to run sessions from the Claude iOS app (cloud sessions via GitHub)
```

Setup once per machine: `npm install` then `npx playwright install webkit` (WebKit acceptance = Safari/iOS behaviour). Node 22.

## 4. Editing protocol (mandatory, in this order)

1. **Recon before editing.** Print the exact bytes of every anchor you intend to replace (`python3 -c` with `repr()`); the file mixes literal Unicode and `\u` escapes, and several anchors have a stray space or a different dash.
2. **Atomic batch.** Write the edit as a Python script that reads `src/app_full.js`, applies `rep(old,new,tag)` calls guarded by `assert s.count(old)==1`, and writes the file only at the end. One failed assert = nothing written.
3. **Compile the batch from a file first** (`python3 -c "compile(open('batch.py').read(),'b','exec')"`) — quoting errors inside long template strings are the most repeated mistake in this project's history.
4. `node --check src/app_full.js`, then `python3 build.py`.
5. **QA:** `bash qa/run.sh` must print `ALL PASS`. Extend `qa/qa_full.js` with checks for every new feature — drive the real UI (clicks, inputs, `input` events), not just functions.
6. **WebKit acceptance:** `node qa/webkit.js` must print `WEBKIT ALL PASS` (boot, all eight views, weigh-in → localStorage/IndexedDB/account mirror, backup → wipe → restore across the reload). Extend it for any touched view or storage path; it already carries the `window.storage` mock `cloudBoot` needs.
7. **Screenshot the touched UI at 390×844** and look at it. Several defects (button widths, wrapping headers, giant icons, stale copy) were only caught visually.
8. Ship: `dist/ComebackBlueprint.html` is the deliverable. Grep-verify the new anchors exist in it and that the placeholder comment is gone.
9. Update `CHANGELOG.md` (what shipped), `LEARNINGS.md` (any gotcha), `LEDGER.md` (any new standing rule from the user).

Never edit `dist/` directly. Never use `re.sub` with replacements containing `\u` escapes (write literal characters). Never call `memory`-style helpers that don't exist — grep first.

## 5. Domain constants and identifiers (grep these; do not guess)

- Rest: Friday is active recovery (`weekTemplate` Fri label "Active Recovery"; Today card + CTA branch on `isDeloadWeek()`); full rest only in deload weeks or on review flags.
- Dates: `START_ISO`, `MILESTONE_ISO`, `MILESTONE_WK` (computed), `todayISO()`, `dayDiff()`, `dateAdd()`, `planWeek()`, `roadmapWeekNow()`, `isDeloadWeek()` (weeks 6, 12, 18 …).
- Engine: `gainModel(phase)`, `macros(phase)`, `bulkMode` ∈ {lean, balanced, max, aggr, cut} (`cb2_bulk`), `aggrLive()` (aggressive until the milestone), `marchKey` ∈ {band, edge, mass} (`cb2_march`), `marchTarget()`, `proFactor()` (2.1 / 2.2 aggressive / 2.4 cut), `compute()` (leanNow, ceilLean, ceilBW, goalFFMInorm), `estimateBF()` (US Navy from waist + neck), `etaModel()`, `etaActual()`, `fastTrackModel()`, `milestoneProjection()`, `weeklyReview()` (rules in priority order: waist brake → rate → sleep → cut trigger → attendance → stalls).
- Training: `GYM` (days), `GYM_ORDER = ["legsA","pushA","pullA","legsB","pushB","pullB"]`, `goToLift()` day map, `weekTemplate()`, `HOME_SUB` (kit-pure subs), `homeRx()`, `focusLB` + `REGION` + `fxSets()`/`fxDelta()` (Legs & Back focus: targets +1 set, push/arm isolations −1), `regionSets()`, `posteriorStats()`, `currentBlock()` (16-week base, then 6-week specializations).
- Fuel: `SUPP_TIERS` items carry `hi` (highest recommended dose), `prem` (premium pick with SA price), `how`, `why`; `fuelQ` (standard/premium, `cb2_fuelq`); `MP_DAYS` (costed 3-day plan with `pf` premium swaps); `MEALS`.
- Events: `RACES_12M` entries `{ym,d,name,co:[lat,lon],dist,km,st,type,note}`; `HOME_LL`; `radiusKm` (`cb2_radius`, selector 15/30/45/60); `evKm()`, `evVenue()`; weekly club block is static text.
- Storage: `DB` (profile, sessions, weight, measure, lifts, sleep, rhr, steps), `DB.save()` → `persist()` per key + `cloudQueue()` → IndexedDB mirror (`idbSave`) + Claude account mirror when `cloudOK()`; `idbBoot()`/`cloudBoot()` restore on empty; `backupJSON()`/`applyRestoreText()`; `shareBackup()` (Web Share → iCloud Drive/Google Drive), `downloadBackup()`; keys listed in the `BACKUP_KEYS` array inside `backupJSON` — add every new key there.
- Watch import: `importHealthText()` accepts Shortcut lines (`date,weight|sleep|rhr|steps,value`), Garmin CSV (auto-detected header), or JSON.

## 6. Known gotchas — the "never twice" list (also in LEARNINGS.md)

1. Python batch quoting: triple-quoted strings opened with `'''` must close with `'''`; nested backticks/`${}` are fine inside Python strings. Compile from a file before running.
2. `re.sub` replacement strings interpret `\u` — write literal characters or use `str.replace`.
3. `var _ct=null`, not `let`: a `let` inside the script caused a temporal-dead-zone crash in WebKit when `cloudQueue` ran during migration.
4. Declare state before first use in the same function (`notes` was used before `const notes=[]` — TDZ at runtime, not caught by `node --check`).
5. `.tool-h` elements inside `#liftBody` are bound by the Lift renderer; adding an inline `onclick` double-toggles and the accordion can never open.
6. Lift tools icons need `<span class="ic">…</span>` or the SVG renders full-width.
7. `.btn` defaults to full width; inside flex rows give buttons `flex:none;width:auto`.
8. `.hero-top` wraps on 390 px unless `.hero-race{max-width:calc(100% - 120px)}`; `.tabs` needs `flex:1 1 0` or the eighth tab clips.
9. Puppeteer `innerText` excludes collapsed accordion bodies — assert on `innerHTML` for hidden content.
10. Test isolation: pages in one browser share localStorage **and** IndexedDB; the vault will legitimately restore a previous section's data. Clear localStorage in an init script; do not assert "exactly one record" after a vault restore.
11. Mocked dates: `class M extends Date` with a fixed `now()`; `START_ISO` changes move every relative test (deload week dates, Day-1 CTA text).
12. Regex windows in tests: long card text (the Deadly Dozen description) is >200 chars — use generous `{0,700}` windows.
13. Distances must be computed from `HOME_LL`; the one guessed distance in this project's history ("~5 km") was wrong by 10 km.
14. Home template: `quickLogHTML()` and `milestoneCardHTML()` render before the Today card; the four support cards (Brief, Review, Win Plan, Data) render after the how-week note.
15. Furniture audit scope: check the `HOME_SUB` object only (calendar text legitimately contains "wall balls" and "bench-press").
16. The shell loads Google Fonts with a render-blocking `<link>`; in a sandbox without outbound access that request hangs, the app `<script>` waits on it, and any fixed `wait()` after a reload sees `DB is not defined`. Both harnesses now answer the request locally and wait for the reload navigation instead of sleeping.
17. `build.py` prints a character count (`len(str)`), not bytes; compare files with `wc -c` or `cmp`, not against that number.
18. Playwright's WebKit download succeeds without its shared libraries; `install-deps webkit` is a separate step on Linux, and the failure message is a dependency list, not a download error.

## 7. Honesty rules for content

- Every calendar addition needs a date, a venue, a status and a source you actually saw. If the 2027 date is unpublished, mark `expected` and show last year's slot.
- Prices: "verified <Mon YYYY> at <retailer>" only when you fetched the page; otherwise "est."
- Physiology: the lean-gain model (0.6 kg/month in the memory window to March, 0.35 after, tapering near the ceiling) and the route table are stated as models; the app says "Still a model" until the user's own weigh-ins exist.
- When the user's asks conflict (110 kg vs the 18–24% band), surface the conflict with numbers and give a choice — never silently reprogram a safety rule.
- The score: report it with its gaps every time it is asked for; never inflate; never round up for effort.

## 8. Session loop (how this project evolves)

1. Read the four memory files. Run `bash qa/run.sh`; confirm `ALL PASS` before changing anything.
2. Extract the concrete ask(s). State assumptions. Recon anchors.
3. Build in one atomic batch (or a few), QA-extend, WebKit, screenshot, ship.
4. Update CHANGELOG / LEARNINGS / LEDGER. Bump `package.json` version to the date.
5. Close with: what shipped, what was verified (counts), what was NOT done and why, the honest score, and the single next action the user can take.
6. Propose the next three improvements from the backlog below — but never build unrequested scope that changes a standing rule.

## 9. Backlog (candidates, in rough value order)

- Retire the run-era copy still shipping in the Lift view: the intro says "4 lifting days a week" and the Pure Muscle note says "Post-race growth (after 24 Sep)"; the footer says "Strength + Speed · Built for 24 September 2026". All three contradict the pure-muscle mission and Day 1 = 12 Sep (seen in the WebKit screenshots, 11 Sep 2026).
- Hosted PWA (Netlify/GitHub Pages) with a service worker so the app installs to the home screen and works offline; keep the file-based version working.
- e1RM progression charts per exercise on Track; PR badges in the Weekly Review.
- Auto-progression: when a set hits the top of its rep range at RIR 0, suggest next session's load.
- DEXA import (paste the lean/fat numbers; overrides the tape estimate).
- Calendar auto-refresh helper: a script that re-scrapes RaceSpace/Peak Timing and diffs `RACES_12M` for the human to approve.
- Peak-week countdown notifications via the Shortcut route.
- A "coach export": weekly summary as text for a real coach or physio.

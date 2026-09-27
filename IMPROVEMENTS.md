# IMPROVEMENTS.md — the improvement register

Every session adds to this list, builds everything on it that can be verified, and says plainly why the rest waits. "Shipped" means a named check in the QA suites proves it; nothing is marked shipped on the strength of reading the code.

Status on 26 Sep 2026 (plan week 3): 55 items shipped across two sessions, then a 64-finding adversarial review round fixed and proven (section R), then a visual round (section V, 14 items) and on 27 Sep the chart readout and progress photos (V15, V16, formerly K13 and K4); 12 queued with the reason; 6 not possible from a web app, with the honest alternative.

## A. Correctness and coherence (every tab tells the same story)

| # | Item | Status |
|---|---|---|
| A1 | Coach's Brief read the retired run plan: "Long Run" on Sundays, "Easy Run" on Tuesdays | Shipped 26 Sep · X1 |
| A2 | Home Today card showed "RACE DAY — Absa" every Thursday from week 9 | Shipped 26 Sep · X1 |
| A3 | Peak week: Legs B on D-3 contradicted the peak card; D-1 is now a 30-minute upper pump (card, Brief, button, Jump In agree) | Shipped · X2 |
| A4 | March route rate exploded near the check (+6.9 kg/week, 7,590 kcal); every route now stops at 1% of bodyweight a week and prices the gap | Shipped · X5 |
| A5 | Milestone card printed a rate the engine was not using; it now prints the engine's rate and the route's need | Shipped · X5 |
| A6 | March targets shrank week by week with no data; they are now anchored to the Day-1 weigh-in | Shipped · X5 |
| A7 | Deload Friday: Brief said "pump" while the card said "full rest"; pump buttons hidden on the one rest day | Shipped · X3 |
| A8 | Week strip called every Friday "Rest"; it is "Pump" except in deload weeks | Shipped · X3/X4 |
| A9 | Roadmap: "Week 9 — first bulk block banked", "concurrent", "Running drops away", "second race" | Shipped · X6 |
| A10 | "1 weeks away" → counts days under two weeks | Shipped · X5 |
| A11 | Strength pillar "natural peak ~95 kg" unlabelled next to "102 kg @ 24%" | Shipped · X4 |
| A12 | Run-era copy on Lift, Numbers, Guide, Fuel, Track, footer, disclaimer, page description | Shipped 11 + 26 Sep · W, X16 |
| A13 | Dates were a day early in Johannesburg before 02:00 and in every date sum (UTC slicing) | Shipped 11 Sep · W |
| A14 | Session-time estimate ignored the Legs & Back focus and the aggressive extra set | Shipped 11 Sep · W |
| A15 | PR toast crashed on Extras and Upper exercises (missing from the exercise map) | Shipped · X15 |
| A16 | A second tape entry on the same day wiped the first (waist lost when arm was logged) | Shipped · X14 |
| A17 | Restoring a backup without lifts could crash the Track tab (wrong empty type) | Shipped · X14 |
| A18 | Fast-track card said "crosses week 8" meaning eight weeks from today | Shipped |

## B. Training intelligence

| # | Item | Status |
|---|---|---|
| B1 | Auto-progression on every exercise card: double progression from your last session at the same location; top sets recognised; deload weeks drop to ~65%; home kit progresses by tempo, not load | Shipped · X8 |
| B2 | Region tracker: hard sets logged per region this week vs the plan, with last week beside it (calves, hamstrings, glutes, quads, lower, mid and upper back) | Shipped · X9 |
| B3 | Strength curves: estimated 1RM per exercise straight from the Lift log, table of bests, change since first session, PB flags | Shipped · X9 |
| B4 | Sessions record home or gym, so curves and targets never mix 15 kg bells with a barbell | Shipped · X8 |
| B5 | Readiness: a logged night under 6 h turns the first compound into RIR 2 and drops the aggressive extra set (Brief and Lift) | Shipped · X7, Y |
| B6 | Legs & Back focus, calves four days a week incl. tibialis, region map (earlier sessions) | Shipped |

## C. Body composition and fuel

| # | Item | Status |
|---|---|---|
| C1 | Scan body fat (DEXA, InBody, Bod Pod) sets the profile and outranks an older tape estimate | Shipped · X13 |
| C2 | Tape estimator (US Navy), one-tap apply (earlier) | Shipped |
| C3 | Maintenance-week macros replace "Race Week"; beta-alanine reason is lifting-only | Shipped · W |

## D. Device and platform technology

| # | Item | Status |
|---|---|---|
| D1 | Installable offline app: web manifest, service worker (network-first page, versioned cache stamped by the build), PNG icons incl. 180 px Home Screen icon, only active when served over https | Shipped · PWA 8/8 |
| D2 | Screen stays awake while Lift is open (Screen Wake Lock, toggle, feature-detected) | Shipped · X10 |
| D3 | Rest timer runs on the wall clock, so a locked phone no longer freezes it; audio cue at zero; +15 s restarts a finished timer | Shipped · X11, WebKit |
| D4 | Google Fonts no longer block the first paint (the app opens instantly on bad gym signal) | Shipped · X16 |
| D5 | One-tap "Publish app" workflow for GitHub Pages | Shipped (needs Pages switched on once) |

## E. AI

| # | Item | Status |
|---|---|---|
| E1 | "Copy this week for Claude": a plain-text check-in with weigh-ins, tapes, sleep, every set, sets per region, four questions and a no-guessing instruction; clipboard, share sheet or a selectable box | Shipped · X12, WebKit |

## F. Data safety

| # | Item | Status |
|---|---|---|
| F1 | Track's Export writes the full backup (it used to skip sleep, resting HR, steps and settings) | Shipped · X14 |
| F2 | Restore accepts the older export format and refuses keys that are not the app's own | Shipped · X14 |
| F3 | Location, fuel tier and wake-lock settings travel with the backup | Shipped · X14 |
| F4 | Four copies (device, IndexedDB vault, Claude account mirror, backup file) and the backup-age clock (earlier) | Shipped |

## G. Events calendar

| # | Item | Status |
|---|---|---|
| G1 | Past events drop off, countdowns ("in 8 days"), radius-true empty text, anchors box computed from data | Shipped 11 Sep · W |
| G2 | Every hand-typed "~N km" removed; all distances computed from home; 22 venues re-located on OpenStreetMap | Shipped · X16 |
| G3 | Verified corrections: Deadly Dozen two days (19–20 Sep), Hollywoodbets moved to Nasrec and sold out, Versus sold out, Warrior #3 at Syringa Park, NPC show at Silverstar Casino, Hope In Motion 18 Oct (was 6 Sep) | Shipped |
| G4 | Unverified Deadly Dozen Pretoria date removed | Shipped · X16 |
| G5 | 11 verified additions (Fat Cats 10K, Sandton Half, Cotlands, Chillie Runners, Stronger Fun Run, Rosebank Pink Run, Thembisa, Tommy Malone, Cuba Solidarity Walk, Ryobi trail run, SA Day 8 km) | Shipped · X16 |
| G6 | Calendar refresh helper: reads Peak Timing and 12 months of RaceSpace, reports new events and moved dates for approval, never edits the app | Shipped · self-test in QA |
| G7 | 32 parkruns inside 30 km from parkrun's own list; nearest is Golden Harvest, ~3 km | Shipped 11 Sep |

## H. Engineering and quality

| # | Item | Status |
|---|---|---|
| H1 | GitHub Actions CI on every push: Chromium suite, offline acceptance, WebKit acceptance, and a check that dist/ equals a fresh build of src/ | Shipped (first run on push) |
| H2 | qa/run.sh used to pass even when checks failed (piped through tail); now fails on any failure | Shipped |
| H3 | Every new test group runs in its own browser context, so seeded data cannot leak between tests | Shipped |
| H4 | QA runs in Africa/Johannesburg time; WebKit context too | Shipped |
| H5 | Screenshot helpers: qa/shot.js (whole view), qa/clip.js (region), qa/elshot.js (one element) | Shipped |
| H6 | Build is deterministic and stamps the offline cache with a content hash | Shipped |

## I. Accessibility and polish

| # | Item | Status |
|---|---|---|
| I1 | Reduced-motion users get no animations | Shipped |
| I2 | Labels for the rest-timer buttons and new inputs | Shipped |
| I3 | Track tabs fit at 390 px (Weight, Lifts, Regions, Tests, Tapes); five-button engine row wraps | Shipped · X9 |
| I4 | "Fill" button no longer stretches across the Last-time box | Shipped |
| I5 | Header subtitle truncates cleanly instead of sliding under the chips | Shipped |

## R. Review round (26 Sep): 64 verified findings, all fixed

| Area | Findings | Proof |
|---|---|---|
| Progression and history (home ranges, deload anchor, aggressive rule, location, bodyweight sets, labels, steps) | 13 | Section Y |
| March engine (Day-1 anchor, pricing from Day 1, band slowdown, after-milestone, Cut wording, waist rule, roadmap start) | 12 | Section Y |
| Offline app (errors and stalls fall back, cache bypass, full-asset stamp, update on resume, status-bar safe area) | 5 | PWA 10/10 |
| Data safety (vault restore, false toast, settings reload, scans, imports, export contents) | 9 | Section Y |
| Calendar data and helper | 13 | Section Y, helper self-test 9/9 |
| Tests and docs honesty (mutant-proof checks, disclosures, gotchas) | 12 | Section Y, docs |

## V. Visual round (26 Sep): measured at 390 px, fixed, proven

| # | Item | Status |
|---|---|---|
| V1 | Roadmap chart and FFMI gauge drawn at 680 units, labels 4–6 px on the phone | Shipped · Z1, Z2, WebKit visual |
| V2 | ETA and fast-track labels under 10 px | Shipped · Z1 |
| V3 | Chart engine: true scale (320), 11 px labels, monotone curves, round ticks, latest-value pill, halos, screen-reader labels | Shipped · Z1, Z2 |
| V4 | Roadmap: round ticks, month-and-year dates, legend (ceiling label sat under the data) | Shipped · Z5 |
| V5 | ETA legend; milestone value no longer breaks mid-phrase | Shipped · screenshot |
| V6 | Fast-track header doubled dash | Shipped · Z6 |
| V7 | Text floor: micro-labels 10–10.5 px, tab labels 10 px, units 11 px | Shipped · Z3 |
| V8 | Tap targets: segments, tabs, buttons ≥ 40 px, set buttons 38, Fill 36, tick hit area 42, delete 35×38 | Shipped · Z4 |
| V9 | Undo after deleting a weigh-in, tape entry or lift | Shipped · Z7, WebKit storage path 3 |
| V10 | "Strength" pillar showed bodyweight, now "Mass"; ring label fits the ring | Shipped · screenshot |
| V11 | Weight target band, Lifts chart in kg, Tapes chart as change since the first tape | Shipped · screenshot, section X |
| V12 | Fonts cached by the installed app for offline use; clean failure with no copy | Shipped · PWA no-network path only (sandbox cannot reach Google Fonts) |
| V13 | Screenshot helpers render with the real typefaces (qa/fonts, qa/fontroute.js) | Shipped · probe reports Manrope and IBM Plex Mono loaded |
| V15 | Touch a chart to read any point (weight, lifts, tapes, roadmap, ETA, fast track); arrow keys; no cut-off readings | Shipped 27 Sep · Z readout ×3, WebKit readout |
| V16 | Progress photos on the phone: front/side/back, first-vs-latest compare, Undo, space used, save to Files or iCloud | Shipped 27 Sep · Z photos ×2, WebKit photos |
| V14 | Harness: one-line FAILs, null-safe UI steps, 390 px probe, WebKit shot helper | Shipped · mutation run 255/261 with 6 named FAILs |

## K. Queued (not built yet) — what each needs

| # | Item | Why it waits |
|---|---|---|
| K1 | Plate-accurate targets (round to the plates you own) | Needs your plate inventory once; 2.5 kg steps assume a full commercial rack |
| K2 | Per-exercise stall detector with a named fix (swap, reset 10%, rep-range change) | Needs 3+ weeks of your logs to tune without false alarms |
| K3 | Weekly volume auto-tuning per region (add a set where recovery allows) | Same: needs logged soreness or performance trend, not guesses |
| K5 | Calendar helper: more sources (Webtickets, Howler, EntryNinja) | Those pages render with scripts; needs a browser-driven scraper and a test fixture for each |
| K6 | Auto-add to the app from the helper's report | Deliberately not done: a human approves every event (standing rule) |
| K7 | Check-day capture form for 5–7 March (weight, five tapes, photos, one screen) | Scheduled for a February session so it can be tested against real baseline data |
| K8 | Protein-per-meal tracker | Only worth it if you will log meals; say the word |
| K9 | Heart-rate-variability readiness | Needs HRV in the Shortcut export (Garmin writes it to Apple Health on some models) |
| K10 | Dark/light theme switch | App is dark-only by design; low value for the effort |
| K11 | Home Screen reminders at 04:30 and 20:00 | Web push on iPhone needs a push server; the Shortcuts app can do it today (see IPHONE.md) |
| K12 | Split the 380 KB single file into modules | Only if the file becomes hard to edit; single-file is a feature for the phone |
| K14 | Check the visual round on your iPhone | The sandbox WebKit is Playwright’s build, not iOS Safari; open the published app on the phone and report anything that looks off |

## L. Not possible from a web app (and the honest alternative)

- Direct Garmin or Apple Health sync: no web access to either. Route stays Garmin → Apple Health → Shortcut → paste.
- Live iCloud Drive or Google Drive sync: no web API for either from a page. Route stays the weekly backup file via the share sheet.
- Background notifications without a server: see K11.
- Vibration on iPhone: Safari has no vibration API; the rest timer beeps instead.
- Calling Claude from inside the app: a single-file app would have to carry an API key, which is unsafe. The check-in text is the safe bridge.
- Certifying a score of 100 or more: the score is 96/100 and only your logged data can close the remaining gaps.

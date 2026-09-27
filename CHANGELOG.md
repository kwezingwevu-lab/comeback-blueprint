# CHANGELOG.md — what has shipped (newest first)

## 2026-09-27 — touch a chart to read it; progress photos on the phone
Verified: Chromium 266/266 (5 new checks; 4 deliberate breakages of the build gave 4 named failures), PWA 10/10, WebKit 25/25 (2 new), calendar self-test pass.
- Chart readout: touch or drag any chart (weight, lifts, tapes, roadmap, ETA, fast track) and the reading prints above it: the date and value, both lines where there are two, and on the roadmap the projected weight and phase. A tap elsewhere clears it; with a keyboard, the arrow keys step through the points. Every reading was measured against the line it sits on, so none is cut off at phone width.
- Progress photos (Track → Tapes): Front, Side and Back open the camera or the photo library; each photo is shrunk to 1280 px and kept on the phone in its own store, apart from the data vault; the card compares your first and latest photo of each pose side by side, lists every photo with Undo on delete, shows the space used, and saves copies to Files or iCloud through the share sheet. Photos are not in the JSON backup (too large), and the card says so. After the first photo the app asks the browser to keep its storage.
- Caught by the Safari-engine gate: WebKit refused to store an image Blob in IndexedDB, so photos are stored as raw bytes plus their type. The test harnesses now let the app's own blob: image URLs through (they had been answering them with empty CSS).
- Helpers: shot.js, clip.js and wkshot.js accept APP=<file> like the others.

## 2026-09-26 (visual round) — charts at true scale, a text floor, finger-sized targets, undo
Measured first, at 390 px (iPhone width) with two weeks of demo data: the Roadmap chart and the FFMI gauge were drawn 680 units wide and shrunk, so their labels rendered at 4–6 px; the ETA and fast-track labels were under 10 px; 110 buttons, toggles and set ticks were under 36 px tall. Verified: Chromium 261/261 (section Z, 7 new checks, each shown to fail against a broken build), PWA 10/10, WebKit 23/23 (2 new), calendar self-test pass. Screenshots at 3× in Chromium and WebKit with the real typefaces.
- Charts: one drawing unit is one screen pixel at phone width (320); labels 11 px; monotone curves (no overshoot), round-number ticks, a gradient area, a pill with the latest value; labels that can sit on a line carry a halo; every chart is labelled for screen readers; dates read "12 Sep", not "09/12".
- Weight chart shows the engine's target range as a band; the Lifts chart plots kilograms and opens on the most-logged lift; the Tapes chart plots change since the first tape, with today's waist and arm in the legend.
- Roadmap: round weight ticks (85–105), month-and-year dates across 2026–2028, a legend for the ceiling line, "this week" and the three dot colours (the ceiling label used to sit under the data line); the Start tile reads "12 Sep ’26".
- ETA card: legend for the green, dotted and gold lines; the milestone value no longer breaks mid-phrase. FFMI gauge redrawn at true scale. Fast-track header: the doubled dash is gone.
- Text floor: micro-labels raised to 10–10.5 px (the smallest is the 9.5 px "This week" pill); bottom tab labels 10 px, the iOS tab-bar size; units beside big numbers 11 px.
- Targets: segment buttons, Track tabs and small buttons at least 40 px; Add/Remove set 38 px; Fill 36 px; the set tick has a 42 px hit area; delete icons 35×38; how-to toggles 32 px.
- Undo: deleting a weigh-in, a tape entry or a lift shows Undo for 5 seconds; Undo restores it on screen and in storage (bigger delete targets make a stray tap likelier, and deletes used to be final).
- Home: the pillar headed "Strength" showed bodyweight, now "Mass"; the ring label "kg lean to go" overran the ring at the new size, now two centred lines. Events tab and Jump In use a calendar icon; the Focus pillar a target icon.
- Type: antialiased text, no iOS text inflation, tabular numbers in charts. The installed app keeps the Google Fonts in their own cache (stale-while-revalidate), so it keeps its typefaces offline; with no copy and no network the worker now returns a clean network error. Not proven by a test: the sandbox cannot reach Google Fonts, so pwa.js only exercises the no-network path.
- QA tooling: the screenshot helpers render with the real typefaces (qa/fonts: Manrope, IBM Plex Mono, Space Grotesk, latin subsets, SIL OFL 1.1, served offline by qa/fontroute.js); DSF=3 for 3× shots; qa/wkshot.js for Safari-engine shots; qa/probe.js measures at 390×844 (it had been measuring an 800 px window); qa/fixtures/demo.setup.js is a two-week demo log; run.sh prints every FAIL on one line.

## 2026-09-26 (review round) — 64 verified findings fixed
An adversarial review (six lenses, two skeptics per finding, 136 agents) confirmed 64 defects in the session diff and in older code. All 64 are fixed and covered by section Y of qa/qa_full.js (28 new checks) and two new offline cases. Verified: Chromium 254/254, PWA 10/10, WebKit 21/21, calendar self-test 9/9.
- Data safety: the IndexedDB vault now actually restores after a wipe (the boot migration used to overwrite it with an empty state); no false "Restored" toast; a restore re-checks after its await and reloads settings too; older-format imports replace the logs they lack; a modern file cannot write foreign keys; an older scan no longer overrides a newer one; scans appear in the Tapes list; backfilling the Day-1 weigh-in keeps the profile on the latest reading.
- Progression: home cards use the home rep range and the real kit (5 kg → 15 kg bells, then tempo); the week after a deload anchors on the last full week; aggressive mode raises the load when set one hits the top (as the Lift screen says); Last time, Fill and targets read the same location's history; sessions follow the Home/Gym switch until the first set; untagged sessions from before the upgrade took the location setting once; 0 kg bodyweight sets count; dumbbell steps match the rack (22.5 → 25); duplicate exercise names carry their day.
- March engine: the Day-1 anchor uses the weigh-in nearest 12 Sep (±7 days) and a Day-1 body-fat snapshot, so later scans or late first weigh-ins no longer move it; route columns are priced from Day 1 (no negative muscle); on the band route the engine slows to what the route needs when ahead; after the milestone no route asks for kilos per week; Cut mode reads as a deficit; one waist rule on the card and in the review; roadmap and its Start landmark begin at Day 1.
- Peak week: the Lift button follows the swap (Fuel on D-3, the pump on D-1); the Lift view says so; the short-sleep nudge respects a rest swap. Readiness now changes the Lift prescription (note, no aggressive +1 set).
- Regions: Friday Extras are shown as pump sets, not hard sets.
- Offline app: HTTP errors and a stalled network fall back to the cached app within 3.5 s; the cache bypasses the HTTP cache on install and on page loads; any change to the app, manifest, icons or worker installs a fresh cache; the app checks for an update when it comes back to the foreground; the header clears the iPhone status bar when installed.
- Calendar: HYROX is 26–29 Nov (organiser added Thursday); multi-day events stay listed until their last day ("on now"); Johnson Crane moved to expected (aggregator date only); Thembisa removed (its point was a highway feature); parkrun and club distances computed at render; the estate name is no longer rendered.
- Calendar helper: JSON-LD parsed as data; "Sept" months; RaceSpace pagination; empty venues kept; series numbers and editions distinguished; newly dated "expected" events reported; geocoding rejects road features; local date.
- Docs: CLAUDE.md gotchas 16 and 26–28, BACKUP_KEYS and RUN_PLAN statements corrected; IPHONE.md privacy disclosure made exact.

## 2026-09-26 (plan week 3) — coherence sweep + technology layer
Full register with test names: IMPROVEMENTS.md. Verified: Chromium 226/226, PWA offline 8/8, WebKit 21/21, calendar tool self-test pass.
- Home tells one story: the Coach's Brief and Today card no longer read the retired run plan (Sunday "Long Run", Tuesday "Easy Run", Thursday "RACE DAY — Absa" from week 9); peak week drops legs D-3..D-1 and makes D-1 a 30-minute upper pump on the card, Brief, button and Jump In; deload Friday is full rest everywhere; Friday strip reads "Pump"; Jump In says Events; ceiling pillar names both fat levels; "9 days away" under two weeks.
- March engine: targets anchored to the Day-1 weigh-in (no drift with time alone); every route capped at 1% of bodyweight a week with the unmet gap priced, not chased (final-week route no longer asks for +6.9 kg/week); the milestone card prints the rate the engine actually uses beside what the route needs; route table readable.
- Roadmap: week-16 base-block milestone replaces "week 9 bulk banked"; run-era focus text and "second race" retired.
- Training intelligence: auto-progression targets on every exercise card (double progression, top-set aware, deload 65%, home kit progresses by tempo); sessions tagged home/gym; readiness nudge after a sub-6 h night.
- Track: Lifts (e1RM curves and bests from the Lift log, PB flags) and Regions (hard sets logged per region vs plan, last week beside) replace the run tabs; tabs fit at 390 px.
- Scan body fat (DEXA/InBody/Bod Pod) sets the profile and outranks older tape estimates.
- Device: installable offline app when served over https (manifest, service worker, PNG icons, build-stamped cache); Screen Wake Lock on Lift with a toggle; rest timer on the wall clock with an audio cue; non-blocking fonts.
- AI: "Copy this week for Claude" check-in text in the Weekly Review.
- Data safety: Track Export = full backup; restore accepts the older format and only cb2_ keys; settings travel in backups; same-day tapes merge; lifts default fixed; PR toast no longer crashes on Extras/Upper exercises.
- Calendar: 22 venues re-located on OpenStreetMap, every typed "~N km" removed, verified corrections (Deadly Dozen 19–20 Sep, Hollywoodbets → Nasrec and sold out, Versus sold out, Warrior #3 Syringa Park, NPC show at Silverstar Casino, Hope In Motion 18 Oct), unverified Deadly Dozen Pretoria removed, 11 verified additions; club heading honest ("within about 15 km"); tools/calendar-refresh.js reports new and moved events from Peak Timing and 12 months of RaceSpace for approval.
- Engineering: GitHub Actions CI (Chromium, PWA, WebKit, reproducible build); QA exits non-zero on any failure; isolated browser contexts per test group; Johannesburg time zone in both harnesses; screenshot helpers; Publish-app workflow for GitHub Pages.
- Accessibility: reduced motion honoured, labels on icon buttons and new inputs, Fill button width, header truncation.

## 2026-09-11 (session 2, pre-Day-1)
- Run-era copy retired on Lift, Numbers, Guide, Fuel, footer and disclaimer; Foundation becomes an honest 4-day fallback; Race Time Predictor and Goal-10K field removed.
- Dates fixed for Johannesburg time (todayISO/dateAdd/normDate were a day early); QA runs in Africa/Johannesburg.
- Calendar: ISO dates, past events drop off, countdowns, radius-true text, computed anchors box, nearest parkrun from parkrun's own list.
- Session time estimate honours the focus toggle and the aggressive extra set.

## 2026-09-11 (pre-Day-1)
- Bundle unpacked to the repository root (first cloud session from the phone route); zip removed. `dist/` rebuilt and confirmed byte-identical to the shipped file. Chromium suite 157/157. New `qa/webkit.js` Safari-engine acceptance (15/15: boot, eight views, storage mirrors, restore across reload) with 390×844 screenshots; both harnesses made offline-deterministic (fonts answered locally, reload awaited). App unchanged.
- IPHONE.md v2: phone-first numbered steps (GitHub app creates the repo; Safari uploads the zip; Claude Code unpacks; GitHub Pages runs it, public-vs-Pro stated). Earlier: verified cloud-session route from the Claude iOS app (Code tab → New Session → GitHub repo); .gitignore; CLAUDE.md §2b. App unchanged (157/157).
- Minimal rest days: Friday = active recovery by default (CTA, Today card, template, Extras header); deload-week Friday = full rest; sleep rule reclaims Friday; rest doctrine in the Guide. Suite: 157/157.
- Repo bundle + CLAUDE.md operating prompt; build verified byte-identical to the shipped app.
- Legs-first week; pre-start brief updated; Save-backup-to-iCloud/Drive via Web Share; honest Drive/iCloud answer.
- Distances computed from home (HOME_LL); radius selector 15/30/45/60; weekly club block with distances.
- IndexedDB vault mirror + navigator.storage.persist(); storage status + backup-age indicator.
- Fuel effectiveness audit: collagen + vitamin C replaces sodium bicarbonate; "what NOT to buy" note.
- Legs & Back focus (toggle, +1/−1 set redistribution, calves 4×/week incl. tibialis, region map card).
- 30 km / 45 km calendar digs: Deadly Dozen Johannesburg (20 Sep, UJ Westdene), After Dark, Warrior #3, TinMan #4/#5, Blair Atholl MTB, Joburg Ultra Tri, Johnson Crane (28 Feb 2027), Wally Hayward (1 May 2027), Pirates Homerun + club time trials.
- Tape body-fat estimator (US Navy; neck field; one-tap apply).
- Highest-dose blocks on all 12 Fuel items; watch-data importer (Shortcut text / Garmin CSV / JSON); sleep, RHR, steps; sleep rule in the Weekly Review; Guide recipe.
- Quick Log (weight/waist) on Home; Fill-from-last-time on exercise cards.
- Fast-track lean plot; Cut mode; cut trigger; creatine loading in Fuel and the Brief.
- March route selector (band/edge/110) with cost table; roadmap per route; brake per route.
- Peak-week protocol (auto-surfaces D-7..D-0); baseline tapes status; hero interim objective.
- Soft milestone 5–7 Mar 2027 on Home, Roadmap and ETA; aggressive window to the milestone; coherent engine recalibration (aggr 0.48%/wk, max 0.35, balanced 0.25, lean 0.15).
- Dynamic FFMI-25 ETA on the Roadmap (mode-aware, logged-rate override, waypoints).
- Aggressive mode (RIR 0 last set, +1 compound set, waist brake), premium Fuel picks with verified Dis-Chem prices, intuitive home mode (home-first cards, guided flow, rules accordion), sleek pass (nav fit, header, Today-first, CTA), Quick Log, and the 8-tab pure-muscle app underneath.

## Earlier (June–August 2026)
- Original 8-tab app, storage tiers, 12-month calendar, Fable Method skill pack, run-plan era (retired).

# CHANGELOG.md — what has shipped (newest first)

## 2026-09-28 (week 3)
- Independent accessibility audit with axe-core (WCAG 2.0/2.1 A and AA plus best practice) over all eight screens, the header and the nav: two moderate "heading-order" findings (Home and Lift), fixed by setting heading levels from the screen they sit on; axe now reports zero violations. New regression check that no screen skips a heading level.
- Screenshot audit (105 screens, real fonts, seeded data): zero page errors, no leaked placeholders.
- Gates: Chromium 301/301 · PWA 16/16 · WebKit 29/29 · calendar helper 8/8.

## 2026-09-27 (week 3)
- New-PR badge on Home (every all-time best from the last 7 days, gain over the previous best, tap to open it in Track).
- Week card: the Weekly Review draws the week as a 1080×1350 image (sessions, weight + rate, waist, PRs, 28-day weight line, verdict, lean model) and shares or saves it.
- Body Lab follows the user's own arm, chest and thigh tapes once a group has two readings 21+ days apart (girth ÷ 2π, model fat change removed); the rest stays on the model; the card says which.
- Gates: Chromium 299/299 · PWA 16/16 · WebKit 29/29 · calendar helper 8/8.
- Independent review of everything since the unzip; eight defects confirmed with reproductions and fixed:
  - home progression now uses the home prescription (10–20, 12–20, 15–25), not the gym range;
  - bodyweight sets logged with reps only now get Next cards, Track lines, PRs and stall checks (load = weigh-in nearest that day + added kg; labels read "12×BW");
  - Aggressive rules (first-set load trigger, extra set, tags, brake label) end at the March milestone (`aggrLive()`);
  - back-off and stall reset stay on the kit's grid, never "drop" to the same load, and say so when one step is more than 10%;
  - the calendar file now escapes semicolons (RFC 5545);
  - Body Lab binds once per render, refreshes when the Day-1 weigh-in changes, recovers from GPU context loss, and adapts resolution from real frame time.
- Weight chart's target band now counts in the y-scale.
- Test harness: first-load marker moved from sessionStorage to window.name (Chromium can drop sessionStorage across a file:// reload, which re-seeded pages mid-test and caused the intermittent restore failure).
- Live calendar diff (27 Sep): no disagreements; nothing new to add inside 30 km (reasons in IMPROVEMENTS.md).
- Docs: IPHONE.md storage facts, offline, Shortcut caveat, reminders, Body Lab; IMPROVEMENTS.md register; prompts use `bash qa/all.sh`.
- Gates: Chromium 292/292 · PWA 16/16 · WebKit 29/29 · calendar helper 8/8.

## 2026-09-26 (week 3)
- **Body Lab · 3D + time (Roadmap).** Real-time WebGL render of the plan's body: signed-distance anatomy (28 smooth-blended primitives), three-point lighting, wrap-lit satin material, crease shading that sharpens as body fat drops, ambient occlusion, soft contact shadow, ACES tone mapping, dithering. Time is the fourth axis: scrub or play weeks 1–104; weight from `buildRoadmap()`, lean from the stated lean-gain model (flat in cuts, capped at the FFMI-25 ceiling), fat = weight − lean, muscle girth ∝ √(lean ÷ Day-1 lean). Modes: Form, Training heat (this week's legs-and-back sets vs plan), Growth (analytic mm of muscle depth added, fat held equal). Renders on demand only; low resolution while moving, full device resolution (≤2.4 MP) at rest; context-loss safe; one persistent canvas; plain-text fallback without WebGL.
- **Chart engine.** Monotone cubic curves, gradient fill on single-series charts, haloed latest value with unit, hairline strokes at any zoom, touch/pointer scrub readout, screen-reader summary; distinct y ticks; day-first dates ("14 Sep") on any locale.
- **Visual pass.** Card sheen and depth, staggered card entrance, press feedback, gold focus rings, tabular numerals, Reduce Motion respected everywhere.
- **Research integration.** e1RM from sets over 10 reps shown as an index (Reynolds et al. 2006); singles are their own max; lift history keyed by exercise and place (home subs never create false gym PRs); stall = three non-deload sessions without an e1RM best or rep PR, easy sets excluded (Grgic et al. 2020 on day-to-day noise); missed-rep back-off (~4%/rep, ≤10%); >10% load-step warning; Weekly Review uses all-time bests and three-session stalls; lifting references card in the Guide.
- **Calendar.** RACES_12M re-checked 26 Sep 2026 against organiser pages and listings: 18 new sourced events, Hope In Motion moved to 18 Oct, HYROX Thu 26–Sun 29 Nov, Hollywoodbets moved to Nasrec, Soweto and Johnson Crane downgraded to expected, every entry now shows its source. `tools/calendar_refresh.js` diffs RaceSpace listings against the app for human approval (never edits the app; self-test in the gates).
- **Reminders.** `.ics` calendar file from the Roadmap: deloads, photo-and-tape days, re-tests, bloodwork, phase changes, peak week, the 5–7 Mar check weekend, daily 04:30/20:00 supplement windows, all with alerts and stable UIDs.
- **Platform.** Installable PWA (manifest, service worker, PNG icons, offline), `#view` deep links, `#import=` Shortcut links, screen wake lock, rest beep + optional voice cue with audio-session ducking, live "This phone" capability panel with the iPhone Safari-vs-Home-Screen storage warning, iOS standalone detection (`display-mode: fullscreen`).
- **Correctness.** SAST date bug fixed (toISOString on local midnight shifted every date back a day); retired run plan no longer drives Home; roadmap lists every checkpoint in a week (bloodwork at 26/78 had been hidden).
- Gates: Chromium 282/282 · PWA 16/16 · WebKit 29/29 · calendar helper 8/8.

## 2026-09-11 (pre-Day-1)
- 2026-09-11: Added sibling project fpl/ (FPL Mission Control v87); fitness app unchanged.
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

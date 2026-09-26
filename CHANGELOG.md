# CHANGELOG.md — what has shipped (newest first)

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

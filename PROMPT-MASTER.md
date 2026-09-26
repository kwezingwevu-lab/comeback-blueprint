# PROMPT-MASTER.md — the "rebuild, upgrade and perfect" prompt for Claude Code

Paste this whole file as your message when you want a full upgrade pass. For a small change use PROMPT-KICKOFF.md.

---

You are the lead engineer on The Comeback Blueprint, a single-file HTML fitness app for one user, Kwezi. This session: find every improvement worth making across the app, build all of them that can be proven, and leave the project's memory more accurate than you found it.

## 0. Before touching anything
- Read in full: CLAUDE.md (operating rules), LEDGER.md (standing rules — each line is an instruction), IMPROVEMENTS.md (the register: shipped / queued / not possible), CHANGELOG.md, LEARNINGS.md (mistakes never to repeat), IPHONE.md.
- `npm install`; `npx playwright install webkit && npx playwright install-deps webkit` (say "WebKit not run" if refused — never claim it passed).
- `bash qa/run.sh` must print ALL PASS, PWA ALL PASS and the calendar self-test PASS, and exit 0. `node qa/webkit.js` must print WEBKIT ALL PASS. Report the counts before changing anything.
- Check the latest CI run on GitHub (Actions → QA). If it is red, fixing it is the first job.

## 1. Audit (fan out if you can run parallel agents)
Walk all eight tabs at 390×844 on these mocked dates: today, a deload Friday, a Legs B Tuesday mid-plan, peak week (2 and 4 March 2027), and the day after the milestone. Use `qa/shot.js` (whole view) and `qa/elshot.js` (one element). For each tab list: stale or contradictory copy, numbers that disagree across tabs, layout faults, dead buttons, anything the QA suite does not already cover. Then audit the engine for coherence: gainModel, macros, marchTarget/marchModel, milestoneProjection, weeklyReview, progressTarget, regionSets/regionDone, peakSwap must tell one story. Verify each finding before acting on it (reproduce it, or drop it).

## 2. Register
Add every verified finding and every idea worth having to IMPROVEMENTS.md with an ID. Mark what you will build now; for the rest, write why it waits and what it needs. Do not quietly narrow the list.

## 3. Build (CLAUDE.md §4, no shortcuts)
- Recon anchor bytes with repr(). The Bash tool decodes a typed backslash-u escape into the literal character — to match a `—` in the source, type `\\u2014` or build it with `chr(92)`.
- One atomic Python batch per theme, compiled from a file first, asserts before any write.
- `node --check`, `python3 build.py`.
- Write the acceptance test first or alongside: real UI in qa/qa_full.js (clicks, inputs, events), each seeded group in its own browser context (`ctxPage`), expected numbers computed not eyeballed. Storage, install or timer changes also go into qa/webkit.js or qa/pwa.js.
- Screenshot every touched element at 390×844 and look at it.

## 4. Calendar (monthly, or when asked to dig)
`node tools/calendar-refresh.js --geocode` → tools/out/calendar-candidates.md. Open each candidate's source; add only events whose date and venue you saw; coordinates from OpenStreetMap or parkrun's list; distances computed from HOME_LL; organiser beats aggregator. Fix the "moved" list first.

## 5. Record and ship
CHANGELOG.md (what shipped, with counts), LEARNINGS.md (every gotcha, dated), LEDGER.md (only new standing rules from Kwezi), IMPROVEMENTS.md statuses, package.json version = today. Commit with a message that names the change; push to the session branch; confirm CI goes green on that push. Publishing to the phone is the "Publish app" workflow (IPHONE.md Part 6).

## Rules that override everything
- Never invent an event, date, price, distance, study or product. Sourced or labelled "est." Distances from HOME_LL only.
- Never silently change a safety rule (18–24% band, waist brake, deload weeks, rest doctrine, the 1%-a-week route ceiling). Surface conflicts with numbers.
- Never report a check that did not run. The score is 96/100 with three named gaps (no data logged; body fat still typed until a tape or scan is logged; snapshot drift). Only logged data closes the first two. Never certify 100 or more; decline ">100" in one line.
- South African English, warm-direct, no hyperlinks in drafts, own errors plainly, extract the concrete ask from repeated boilerplate.
- The file must still open from the phone with no server; the install layer only activates over https.

## Close the session with
What shipped (with test counts per suite), what was audited and left alone and why, what is queued, the honest score with its gaps, and the single next action Kwezi can take.

# PROMPT-MASTER.md — the "rebuild, upgrade and perfect" prompt for Claude Code

Paste this whole file as your message when you want a full upgrade pass (not a small change). For small changes use PROMPT-KICKOFF.md.

---

You are the lead engineer on The Comeback Blueprint, a single-file HTML fitness app for one user, Kwezi. Your job this session: rebuild, upgrade and perfect the app without breaking anything that already works, and leave the project's memory files more accurate than you found them.

Read, in full, before touching code: CLAUDE.md (operating rules), LEDGER.md (the user's standing rules — every line is an instruction), CHANGELOG.md (what exists), LEARNINGS.md (mistakes never to repeat), IPHONE.md (how the user works). Then run `npm install` and `bash qa/run.sh`. Do not change anything until it prints ALL PASS; report the count.

Then work through this loop until the session budget is spent:

1. AUDIT. Open dist/ComebackBlueprint.html in headless Chromium at 390×844 and walk all eight tabs (Home, Lift, Events, Roadmap, Fuel, Numbers, Track, Guide) with a mocked date of today and of Day 1 (2026-09-12). Screenshot each. List every defect you can see or measure: stale copy, wrapping, clipped elements, inconsistent numbers between tabs, dead buttons, anything the QA suite does not already cover. Rank by impact on the user's daily use.
2. PLAN. Choose the top items. For each, write the acceptance test first (a real-UI check in qa/qa_full.js: clicks, inputs, dispatched events, mocked dates) so the improvement is provable.
3. BUILD. Follow CLAUDE.md §4 exactly: recon the anchor bytes with repr(), one atomic Python batch compiled from a file, node --check, python3 build.py, ALL PASS, WebKit acceptance if it can be installed (say "not run" if it cannot), screenshots of everything touched.
4. VERIFY COHERENCE. The engine (gainModel, macros, roadmap, weeklyReview, etaModel, marchTarget, regionSets) must tell one story: same rates, same brakes, same dates on every tab. Add a numeric coherence test if you touched any of them.
5. RECORD. Update CHANGELOG.md, LEARNINGS.md (any gotcha, the day it happened), LEDGER.md (only if the user set a new rule), bump package.json version to today's date, commit with a message that names the change.
6. REPEAT from 1 with the remaining budget.

Rules that override everything:
- Never invent an event, date, price, distance, study or product. Sourced or labelled "est." Distances from HOME_LL only.
- Never silently change a safety rule (18–24% band, waist brake, deload weeks, rest-day doctrine). Surface conflicts with numbers and stop.
- Never report a check that did not run. Never certify a score of 100 or above; the score is 96/100 with three named gaps (no data logged; body fat still typed; snapshot drift) and only the user's logged data can move two of them.
- South African English, warm-direct, no hyperlinks in drafts, own errors plainly, extract the concrete ask from repeated boilerplate.
- Keep it a single file: dist/ComebackBlueprint.html must still open from a phone with no server.

Ideas worth digging into, in value order (build only what the audit supports and the ledger allows):
- Auto-progression: when a set hits the top of its rep range at RIR 0, suggest next session's load on the card and in the Brief.
- e1RM trend charts per exercise on Track; PR badges in the Weekly Review; "best set this block".
- A service worker + manifest so the app installs from GitHub Pages and works offline; keep the plain-file mode working.
- DEXA import (paste lean/fat numbers; overrides the tape estimate; dated).
- A calendar refresh helper: script that fetches RaceSpace / Peak Timing / Webtickets listings, diffs RACES_12M, and produces a human-approval list — never auto-commits events.
- Peak-week and check-day reminders via the Apple Shortcut route; a check-day capture form (weight, five tapes, three photos noted).
- Coach export: a one-page weekly summary as plain text.
- Accessibility pass: contrast, tap targets ≥ 44 px, reduced-motion respected, VoiceOver labels on icon buttons.

End the session with: what shipped (with test counts), what was audited and left alone and why, what was not done, the honest score with its gaps, and the single next action the user can take.

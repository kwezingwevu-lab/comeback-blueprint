# IMPROVEMENTS.md — the register (audit findings and upgrades, with what happened to each)

Kept current by every session. Status: **done** (shipped and tested), **your call** (needs Kwezi's decision; numbers given), **deferred** (with the reason). Newest items at the top of each section.

## Your call — nothing here changes until you say so

| # | Decision | The numbers | Default kept |
|---|---|---|---|
| D1 | Band-max weekly gain rate | The engine runs +0.42 kg/week (~460 kcal surplus) and lands ≈97.7 kg in March. Hitting the full 98.7 kg route needs ≈+0.47 kg/week (~510 kcal). | 0.42, shown honestly on the milestone card |
| D2 | Band-max route vs the waist brake | The full 98.7 kg route implies ≈+6 cm of waist; the brake is +5 cm. | Brake stays at +5 cm |
| D3 | Mini-Cut I after the March check | The copy no longer claims it starts automatically. It can be made automatic (Cut mode switches on the Monday after 7 Mar) or stay a prompt. | Prompt, your choice |

## Done — 26 to 27 Sep 2026

**Visuals**
- Body Lab · 3D + time on the Roadmap: real-time WebGL body, three-point lighting, ambient occlusion, soft contact shadow, crease shading tied to body fat, ACES tone mapping; scrub or play weeks 1–104; Form / Training heat / Growth (analytic millimetres of muscle depth). Renders on demand, low resolution while moving, full resolution at rest, context-loss safe, text fallback without WebGL.
- Charts: monotone curves, single-series gradient fill, latest value labelled, crisp at any zoom, touch-scrub readout, screen-reader summaries, distinct y ticks, day-first dates.
- Interface: card depth and sheen, staggered entrance, press feedback, focus rings, tabular numerals, Reduce Motion respected.

**Training logic**
- e1RM from sets over 10 reps shown as an index; singles are their own max (Reynolds, Gordon & Robergs 2006).
- Lift history split by gym and home; a gym session can no longer be a false PR over home sets.
- Stall = three non-deload sessions without a new best or a rep PR; easy sets (RPE ≤ 7) are under-effort, not a stall (Grgic, Lazinica & Schoenfeld 2020 on day-to-day noise).
- Missed-rep back-off (~4% per rep, never more than 10%); warning when the next load step is over 10%.
- Weekly Review counts all-time bests and three-session stalls, not last week versus this week.
- Double progression, plates per side, Use button, session strip, AMRAP safety.

**Platform**
- Installable PWA with offline service worker and PNG icons; deep links; Shortcut import links; screen wake lock; rest beep; voice cue with music ducking; "This phone, checked live" panel with the Safari-vs-Home-Screen storage warning; iOS standalone detection.
- Calendar file (.ics) with every dated checkpoint, peak week, the check weekend and both supplement windows.
- Coach pack and Ask Claude export.

**Correctness**
- SAST date bug (every date a day early; Thursday Pull B never counted).
- Retired run plan no longer drives Home (it had been putting "RACE DAY" on Thursdays).
- Template text leak on the sleep chip; Friday copy consistent with active recovery.
- Track import no longer wipes the log; Quick-log Edit, neck save, cut-mode advice, lean-mass overstatement, noisy gain rate, false vault toast all fixed.
- Roadmap shows every checkpoint in a week (the 6-monthly bloodwork at weeks 26 and 78 had been hidden).
- Contrast and 44 px tap targets.

**Calendar**
- Full re-check against organiser pages and listings (26 Sep 2026): 18 new sourced events, one date moved, one venue moved, two downgraded to expected, prices corrected, every entry shows its source.
- `tools/calendar_refresh.js`: RaceSpace diff for human approval, with self-test. Live run 27 Sep: no date disagreements; two new listings inside 30 km, both deliberately not added (a women-only race; a 779 km multi-day cycling tour located only to a town centre).

## Deferred — and why

| Item | Why not now |
|---|---|
| Web Push notifications | Needs a push server; iPhone web apps cannot schedule local notifications. The calendar file covers reminders. |
| Voice logging (speech recognition) | WebKit's speech recognition is unavailable or unreliable in Home Screen apps (WebKit bugs 225298, 321436). The keyboard's dictation key works in every field. |
| Direct Google Drive / iCloud sync | No web API a file-based app can use without a server; the backup file saved there is the permanent copy. |
| RIR-adjusted e1RM | RPE is optional per set; mixing sets with and without it would create false PRs. |
| Photoreal body scan | Needs a 3D scanner or photogrammetry; Body Lab is an honest model, labelled as one. |
| Body Lab per-muscle growth from your own tape readings | Needs chest, arm and thigh tapes over several weeks first; the fields exist in Track. |
| Real-iPhone timing of Body Lab and .ics import | Can only be done on the device; asked of Kwezi. |

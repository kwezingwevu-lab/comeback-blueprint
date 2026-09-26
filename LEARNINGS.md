# LEARNINGS.md — gotchas that must never recur (add the day they happen)

See CLAUDE.md §6 for the numbered list. Additions:

- 2026-09-11: `mkdir -p a/{b,c}` does not expand under /bin/sh (dash); create directories explicitly.
- 2026-09-11: A Python `rep()` batch that asserts before writing is atomic — but a SyntaxError in the batch means *nothing* ran; do not assume partial application. Compile from a file first.
- 2026-09-11: QA sections that seed data must isolate localStorage per page; IndexedDB persists across pages in the same browser profile and the vault restore is correct behaviour, not a bug.
- 2026-09-11: When the anchor text contains an em dash or a stray space, print it with repr() and copy the bytes; do not retype.
- 2026-09-11: Distances were once guessed from a wrong origin ("~5 km"); always compute from HOME_LL.
- 2026-09-10: Test regex windows must exceed the longest card description (>200 chars).
- 2026-09-09: Lift `.tool-h` is bound by the renderer; no inline onclick on accordions inside #liftBody.
- 2026-09-07: `const notes=[]` declared after first use → TDZ at runtime; node --check does not catch it.
- 2026-08: `var _ct=null` (not `let`) to avoid a WebKit TDZ crash during migration; window.onerror armour on line 1; safeStep() around every INIT call.
- 2026-07: Never use re.sub with `\u` in the replacement; rebuild from the shipped HTML by regex-extracting the last <script> when the factory is lost (proven byte-identical).
- 2026-09-11: Anchors containing escaped apostrophes (\'s) inside template literals are error-prone to retype; slice by unambiguous start/end markers instead of matching the whole sentence.
- 2026-09-11: A day object field (`sub`) is only "shipped" if something renders it; tests that assert on copy must assert on rendered text, and features must render.
- 2026-09-11: GitHub serves raw HTML as text/plain; a built single-file app only runs when served as a page (GitHub Pages: public repo on Free, private needs Pro). Never tell the user to "open the raw file".
- 2026-09-11: In the cloud sandbox the browser cannot reach the web. The render-blocking Google Fonts `<link>` hung until the proxy reset it, the app `<script>` waited behind it, and the fixed 1200 ms sleep after the restore reload saw `DB is not defined` (the suite crashed instead of reporting). Fix: harnesses answer the fonts request locally and await the reload navigation. Never trust a fixed sleep across a `location.reload()`.
- 2026-09-11: `npx playwright install webkit` downloads the browser but exits with a list of missing shared libraries; `npx playwright install-deps webkit` (root in the sandbox) fixes it. The two are separate steps.
- 2026-09-11: `build.py` prints `len()` of the text (characters), not bytes; a size mismatch against `wc -c` is not drift. Use `cmp`.
- 2026-09-11: A multi-file doc batch that writes each file inside the loop is not atomic: a bad tuple shape on file two left file one already written. Collect every patched string first and write all files only after every assert has passed.
- 2026-09-11: GitHub Mobile can create repositories (May 2026) but file upload is done on the website in Safari.

- 2026-09-26: ROOT CAUSE of the most repeated mistake in this project: the Bash tool decodes \uXXXX in the command text before the shell sees it, so a batch typed with a backslash-u escape arrives holding the literal character (verified with od -c). Anchors in app_full.js that contain \u escapes then never match. Write \\u in a heredoc to get a literal backslash-u, or build it in Python with chr(92)+'u2014'. New code can simply use literal characters.
- 2026-09-26: A service worker must store only the app's own response under the app's cache key. Caching the site-root redirect page there produced an offline reload loop (the cached "app" was a meta refresh to itself). qa/pwa.js now kills the server and reloads to prove offline boot.
- 2026-09-26: qa/run.sh piped the suite through tail, so it exited 0 even when checks failed. set -o pipefail plus process.exit(pass===total?0:1). Never trust a green shell exit without the RESULT line.
- 2026-09-26: .gitignore had *.png, which would have silently dropped the PWA icons from the commit. Exceptions added for src/pwa and dist; check git check-ignore before committing new binary files.
- 2026-09-26: Seeded tests must run in their own browser context (browser.createBrowserContext()); storage and IndexedDB are then isolated and the vault cannot restore another test's data.
- 2026-09-26: Compute expected numbers in tests (Epley 100 kg x 8 = 126.7, not 133). Two of this session's first failures were test arithmetic, not app bugs.
- 2026-09-26: For a local-server test in the sandbox, launch Chromium with --no-proxy-server and map external hosts to ~NOTFOUND; otherwise the proxy hangs requests.
- 2026-09-26: Aggregators and organisers disagree (RaceSpace listed Hollywoodbets at James & Ethel Gray Park; the organiser says Nasrec). The organiser wins; say so in the note.
- 2026-09-26: A one-word event name ("Vaal") matched a different race in the calendar helper; one-word names must match exactly.
- 2026-09-26: Relative model horizons drift: projecting "months from today" made March targets shrink every week with no data. Anchor targets to Day 1.
- 2026-09-26 (review round, 136 agents, 64 verified findings): the IndexedDB vault had never worked on a real wipe — the boot migration called DB.save() on an empty localStorage, which overwrote the vault before idbBoot read it, and idbBoot then showed a false "Restored" toast. The QA check passed only because its init script re-seeded the flag that skipped the migration. Boot code must never persist an empty state over a backup; a restore must re-check emptiness after every await.
- 2026-09-26: Mutation-test new checks (break the code, the check must fail). Four of this session's checks passed against broken code: home-vs-gym leakage, the key whitelist, lifts-default, and export contents.
- 2026-09-26: A target and the "last time" line on the same card must read the same history (same location, deloads excluded), or the card contradicts itself.
- 2026-09-26: Relative targets compared with a typed-body-fat lean estimate go negative as weight rises; price routes from Day 1, not from "now".
- 2026-09-26: innerText applies CSS text-transform — assert with case-insensitive patterns on uppercase labels.
- 2026-09-26: A service worker's network-first page needs a timeout and must treat HTTP errors like failures, or "offline-ready" still shows a blank or error screen on bad signal.

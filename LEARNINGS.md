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

# IPHONE.md — build and run The Comeback Blueprint from your iPhone

You need **Safari** plus either the apps or the browser: GitHub works in the **GitHub app** or at `github.com`; Claude Code works in the **Claude app (Code tab)** or at `claude.ai/code/new` in Safari — both open the same cloud sessions. Everything below was checked against GitHub's and Anthropic's own documentation in September 2026; where a step depends on your plan it says so.

---

## Part 1 — Get the bundle onto your phone (2 minutes)

1. In this Claude chat, tap the file **comeback-blueprint-dev.zip**.
2. Tap the Share icon → **Save to Files** → choose **iCloud Drive** → Save.

---

## Part 2 — Create the repository in the GitHub app (2 minutes)

3. Open the **GitHub** app → tap **+** (on Home or your Profile) → **Create repository**. (Browser alternative: Safari → `github.com/new`.)
4. Name it `comeback-blueprint`. Set it to **Private**. Leave README, .gitignore and licence off. Create.

---

## Part 3 — Upload the zip with Safari (3 minutes)

The GitHub app is for browsing; uploading a file is done on the website.

5. Open **Safari** → go to `github.com` → sign in → open the new repository.
6. Tap **Add file** → **Upload files**. If you cannot see the button, tap the **aA** icon in Safari's address bar → **Request Desktop Website**, then try again.
7. Tap **choose your files** → **Files** → iCloud Drive → **comeback-blueprint-dev.zip**.
8. Scroll down, tap **Commit changes**. You now have one file in the repo: the zip.

---

## Part 4 — Let Claude Code unpack and prove it (5 minutes)

9. Open the **Claude** app → tap **Code** → **New Session** → choose `comeback-blueprint` and the `main` branch. (Browser alternative: Safari → `claude.ai/code/new` → same choice.) (If there is no Code tab, your plan does not include Claude Code cloud sessions — that is the first thing to check.)
10. Paste this as the first message, exactly:

> Unzip comeback-blueprint-dev.zip so that CLAUDE.md, LEDGER.md, CHANGELOG.md, LEARNINGS.md, PROMPT-KICKOFF.md, IPHONE.md, build.py, package.json, src/, qa/ and dist/ sit at the repository root. Delete the zip. Read CLAUDE.md, LEDGER.md, CHANGELOG.md and LEARNINGS.md in full. Run npm install, then bash qa/run.sh. Report the exact result line. If Playwright's WebKit cannot be installed in this environment, say "WebKit acceptance not run" — do not claim it passed. Commit with the message "Unpack bundle, verify QA".

11. Wait for it to report **ALL PASS** with the count (157 at hand-over). Nothing else should be changed until it does.

---

## Part 5 — Every build session after that (whenever you like)

12. Claude app → **Code** → **New Session** (or continue the last one) on `comeback-blueprint`.
13. Paste the contents of **PROMPT-KICKOFF.md** (open it in the GitHub app → copy) and put your request under "Today's ask", one line per item.
14. Claude Code recons, builds, extends the QA suite, runs it, commits `dist/ComebackBlueprint.html`, and updates the four memory files. It ends with what shipped, what was verified, the honest score with its gaps, and one next action. Read that closing before you accept the work.

---

## Part 6 — Run the app on the phone

GitHub shows HTML files as text, so opening the file in the GitHub app does not run it. You need it served as a web page. Two honest options:

**Option A — GitHub Pages (free, but the repository must be public).** In Safari: repository → **Settings** → **Pages** → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)` → Save. After a few minutes the app is at
`https://kwezingwevu-lab.github.io/comeback-blueprint/dist/ComebackBlueprint.html` (your GitHub username is kwezingwevu-lab)
Open it in Safari → Share → **Add to Home Screen**. It launches like an app.
*Know what public means:* the file contains suburb-level coordinates for the calendar distances (two decimals, roughly a kilometre) and your profile defaults (age, height, starting weight). No house number, no logged data — your logs live only in the phone's browser storage and your backup files. If that is more than you want public, use Option B.

**Option B — keep it private (GitHub Pro).** GitHub Pages on a private repository needs the Pro plan (paid). Same Settings → Pages steps; the site is still reachable by anyone with the link, but the source repository stays private.

Either way, once the app is on your Home Screen, your data lives in Safari's storage for that site plus the app's IndexedDB vault. Back up weekly with the app's own **Save backup to iCloud Drive / Google Drive** button; restore anywhere with the Data card's Restore picker.

---

## Things that are not possible, so you do not waste time trying

- Opening `dist/ComebackBlueprint.html` in the GitHub app or via the "Raw" link: shows source code, not the app.
- Running Claude Code *on* the iPhone: the app is a client; the cloud session does the work.
- Linking the app directly to iCloud Drive or Google Drive: no web API for that; the backup file is the permanent copy.

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

## Part 6 — Run the app on the phone (installed, works offline)

GitHub shows HTML files as text, so opening the file in the GitHub app does not run it. It has to be served as a web page, and once it is, it installs to your Home Screen and keeps working with no signal.

**One-time setup (5 minutes, in Safari):**
1. Repository → **Settings** → **Pages** → Source: **GitHub Actions**. (Pages on a private repository needs GitHub Pro; on the free plan the repository must be public — see "know what public means" below.)
2. Repository → **Actions** → **Publish app** → **Run workflow** → Run. Wait for the green tick (about a minute).
3. Open `https://kwezingwevu-lab.github.io/comeback-blueprint/` in Safari. It forwards to the app.
4. Share → **Add to Home Screen**. From now on it opens full-screen like an app, and works offline after the first visit.
5. After any build session, run **Publish app** again; the next time the phone is online the app picks up the new version by itself.

**Moving your data to the installed app (do this once).** Each web address has its own storage, and on iPhone a Home Screen app keeps its storage apart from Safari even at the same address, so logs made in another copy do not appear automatically. In the old copy: Home → Data → **Save backup to iCloud Drive**. In the installed app: Home → Data → **Restore** → pick that file.

*Know what public means:* the app contains suburb-level coordinates for the calendar distances (two decimals, roughly a kilometre) and your profile defaults (age, height, starting weight). No house number and no logged data — your logs live only on the phone and in your backup files.

## Part 7 — Automatic checks on every change (CI)

Every push runs the full QA on GitHub's machines: the Chromium suite, the offline test, the Safari-engine test, and a check that the shipped file is a faithful build of the source. On the phone: GitHub app → repository → **Actions** shows a green tick or a red cross per push. A red cross means do not publish; ask Claude Code to fix it ("CI is red on the latest push — fix it").

## Part 8 — The weekly loop that makes the app smarter

1. Log every set in Lift. The next-target line on each exercise tells you the load for next time.
2. Friday: Home → Weekly Review → **Copy this week for Claude** → paste into a Claude chat. Act on the one change it gives you.
3. Saturday: Home → Data → **Save backup to iCloud Drive**.
4. Monthly: start a Claude Code session with PROMPT-KICKOFF.md and the ask "run the calendar helper and add the verified events".

## Things that are not possible, so you do not waste time trying

- Opening `dist/ComebackBlueprint.html` in the GitHub app or via the "Raw" link: shows source code, not the app.
- Running Claude Code *on* the iPhone: the app is a client; the cloud session does the work.
- Linking the app directly to iCloud Drive or Google Drive: no web API for that; the backup file is the permanent copy.
- Direct Garmin or Apple Health sync from a web page: not possible; the Shortcut paste route in the Data card is the bridge.
- Vibration on iPhone: Safari has no vibration API; the rest timer beeps instead (turn the ringer on).

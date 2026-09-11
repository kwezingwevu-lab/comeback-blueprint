/*
 * qa/buttons.cjs — every control, in both modes, on all seven tabs (CLAUDE.md H1 "buttons").
 *
 * For each mode and each tab: open every Section, then click every enabled button, input,
 * select and textarea in turn. After each click:
 *   · no script error on the page (a mocked 400 and an aborted cross-origin fetch are
 *     expected and filtered — they are network noise, not app errors);
 *   · no `.boundary` anywhere;
 *   · `legal15` still holds over every fifteen the app is currently displaying.
 *
 * The tab loop is wrapped so a throw navigates back to Command before the next tab
 * (E-017). The remount test runs last (H2).
 *
 * Prints the standard per-check lines, then
 *   SUITE buttons <clicks> · <throws> · <boundaries> · <illegal>
 *   SUITE buttons <pass>/<total>
 *
 * Run: node qa/buttons.cjs
 */

"use strict";

const path = require("path");
const fs = require("fs");
const H = require(path.join(__dirname, "harness.cjs"));

const ROOT = path.resolve(__dirname, "..");
const LIVE = require(path.join(ROOT, "data", "live.json"));
const E = require(path.join(ROOT, "src", "engine.js"));

const NOW = "2026-09-11T08:00:00Z";
const TABS = ["command", "plan", "squad", "rivals", "draft", "chips", "lab"];
const MODES = ["full", "simple"];
const CONTROLS = ".mc-root button, .mc-root input, .mc-root select, .mc-root textarea";

// ---------------------------------------------------------------- name → element id
//
// Seventeen web_names in the snapshot belong to more than one element (Palmer 154/301,
// Hughes 212/278, Wilson 108/172/260 …). E-012 is exactly the cost of keying on names,
// so an ambiguous name is resolved only against the ids this session can actually be
// showing — the saved fifteen and the engine's own wildcard fifteen — and anything still
// ambiguous is reported as unresolved rather than quietly assumed.

const NAME_IDS = {};
LIVE.elements.forEach(function (el) { (NAME_IDS[el.web_name] = NAME_IDS[el.web_name] || []).push(el.id); });

const SAVED = LIVE.picks["3"].picks.map(function (p) { return p.element; });

function seedState() {
  return {
    version: 87, exported_at: null, entry: LIVE.entry.id,
    squad: SAVED.map(function (id) { return { id: id, purchase: null }; }),
    bank: 0, ft: LIVE.ft_available, value: 1000, confirmed_gw: LIVE.current_event,
    leagues: LIVE.leagues.map(function (l) { return l.id; }),
    draft: { league_id: null, roster: [], watchlist: [] },
    ui: { mode: "full", tab: "command", open: {}, reveals: {} },
    ledger: [], refresh: { pair: "sonnet46", last: null }
  };
}

const CTX = E.buildCtx(LIVE, seedState(), NOW);
const ENGINE_15 = (function () {
  try { const wc = E.wildcardSolver(CTX, {}); return wc && wc.ok ? wc.ids : []; } catch (e) { return []; }
})();
const LOCKED_15 = (function () {
  try {
    const wsrc = fs.readFileSync(path.join(ROOT, "data", "weekly.js"), "utf8");
    const WEEKLY = new Function(wsrc + "; return WEEKLY;")();
    const wo = E.wildcardOptions(CTX, { written: WEEKLY && WEEKLY.classic ? WEEKLY.classic.wildcard15 : [] });
    return wo && wo.ok && wo.locked && wo.locked.ok ? wo.locked.ids : [];
  } catch (e) { return []; }
})();
const PREFERRED = {};
ENGINE_15.concat(LOCKED_15).concat(SAVED).forEach(function (id) { PREFERRED[id] = true; });

function resolveName(name) {
  const c = NAME_IDS[name];
  if (!c) return null;
  if (c.length === 1) return c[0];
  const p = c.filter(function (id) { return PREFERRED[id]; });
  return p.length === 1 ? p[0] : null;
}

// ---------------------------------------------------------------- page helpers

/* Every fifteen the app is showing right now, as name lists. Three places render one:
   the landing card's fifteen panel, the wildcard fifteen panel on Plan, and the fifteen
   on Squad. Each is read from its own markup, never from a shared innerText blob. */
function collectSquadsInPage() {
  const out = [];
  const names = document.querySelector(".landing .names");
  if (names) {
    const list = names.innerText.split("·").join("|").split("|")
      .map(function (s) { return s.trim(); }).filter(Boolean)
      .reduce(function (acc, chunk) { return acc.concat(chunk.split(",").map(function (s) { return s.trim(); }).filter(Boolean)); }, []);
    if (list.length) out.push({ source: "landing", names: list });
  }
  const wc = document.querySelector('.section[data-section="plan-wc"] .sec-b');
  if (wc) {
    const list = [];
    Array.prototype.forEach.call(wc.querySelectorAll(".row"), function (r) {
      const cells = r.children;
      if (cells.length < 2) return;
      cells[1].innerText.split(",").forEach(function (s) { const v = s.trim(); if (v) list.push(v); });
    });
    if (list.length) out.push({ source: "plan-wc", names: list });
  }
  const sq = document.querySelector('.section[data-section="sq-fifteen"] .sec-b');
  if (sq) {
    const list = [];
    Array.prototype.forEach.call(sq.querySelectorAll(".row .nm"), function (nm) {
      const t = Array.prototype.filter.call(nm.childNodes, function (n) { return n.nodeType === 3; })
        .map(function (n) { return n.textContent; }).join("").trim();
      if (t) list.push(t);
    });
    if (list.length) out.push({ source: "sq-fifteen", names: list });
  }
  return out;
}

async function openAllSections(page) {
  const ids = await page.evaluate(function () {
    return Array.prototype.map.call(document.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section"); });
  });
  for (const id of ids) {
    const sel = '[data-testid="sec-' + id + '"]';
    try { if ((await page.getAttribute(sel, "aria-expanded")) !== "true") await page.click(sel, { timeout: 4000 }); } catch (e) { /* re-checked by the caller */ }
  }
  return ids;
}

async function restore(page, mode, tab) {
  const m = await page.getAttribute(".mc-root", "data-mode");
  if (m !== mode) {
    await page.click('[data-testid="menu"]');
    await page.click('.menu-i[data-mode="' + mode + '"]');
    await page.waitForTimeout(120);
  }
  if (await page.$(".menu")) { await page.click('[data-testid="menu"]'); }
  if (mode === "full") {
    const t = await page.getAttribute(".mc-root", "data-view");
    if (t !== tab) { await page.click('[data-testid="tab-' + tab + '"]'); await page.waitForTimeout(120); }
    await openAllSections(page);
  }
}

async function settleRefresh(page) {
  try { await page.waitForFunction(function () { return document.querySelectorAll(".refbar").length === 0; }, null, { timeout: 20000 }); }
  catch (e) { /* reported by the boundary/error checks */ }
}

// ---------------------------------------------------------------- the suite

async function main() {
  const missing = H.appMissing();
  if (missing) { H.assert("app-file-exists", false, missing); return H.done("buttons"); }
  H.assert("engine-produced-a-reference-fifteen-for-name-resolution", ENGINE_15.length === 15,
    ENGINE_15.length + " ids from wildcardSolver; " + Object.keys(NAME_IDS).filter(function (n) { return NAME_IDS[n].length > 1; }).length + " duplicate web_names in the snapshot");

  const html = H.buildPage({});
  const browser = await H.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();

  const scriptErrors = [];
  page.on("pageerror", function (e) { scriptErrors.push(String(e && e.message ? e.message : e)); });
  page.on("console", function (m) {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/i.test(t) || /net::ERR_/.test(t)) return;
    scriptErrors.push("console: " + t);
  });
  page.on("download", function (d) { d.cancel().catch(function () { /* nothing to clean up */ }); });

  let clicks = 0, throws = 0, boundaries = 0, illegal = 0, legalRuns = 0, unresolved = 0;
  const throwDetail = [], boundaryDetail = [], illegalDetail = [], unresolvedDetail = [], errorDetail = [];
  const coverage = [];                       // one row per mode/tab: eligible controls vs clicks made

  // Every control this pass is expected to click: visible, enabled and not a tab button
  // (the loop's own navigation clicks all seven tabs).
  async function eligibleCount() {
    return page.evaluate(function (sel) {
      return Array.prototype.filter.call(document.querySelectorAll(sel), function (e) {
        const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
        if (!(b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && Number(cs.opacity) > 0)) return false;
        if (e.disabled === true || e.getAttribute("aria-disabled") === "true") return false;
        return !/\btabi\b/.test(e.getAttribute("class") || "");
      }).length;
    }, CONTROLS);
  }

  async function afterClick(where) {
    // 1. script errors
    if (scriptErrors.length) {
      scriptErrors.splice(0).forEach(function (e) { errorDetail.push(where + " → " + e); });
    }
    // 2. error boundary
    const b = await page.evaluate(function () { return document.querySelectorAll(".boundary").length; });
    if (b > 0) { boundaries += b; boundaryDetail.push(where + " rendered " + b + " .boundary"); }
    // 3. legal15 over whatever fifteen is on screen
    const squads = await page.evaluate(collectSquadsInPage);
    squads.forEach(function (sq) {
      const ids = [], bad = [];
      sq.names.forEach(function (n) { const id = resolveName(n); if (id === null) bad.push(n); else ids.push(id); });
      if (bad.length) {
        unresolved += bad.length;
        if (unresolvedDetail.length < 5) unresolvedDetail.push(where + " " + sq.source + " unresolved: " + bad.join(", "));
        return;
      }
      if (ids.length !== 15) {
        illegal++;
        if (illegalDetail.length < 5) illegalDetail.push(where + " " + sq.source + " showed " + ids.length + " players, not 15");
        return;
      }
      legalRuns++;
      const r = E.legal15(ids, LIVE.elements);
      if (!r.ok) {
        illegal++;
        if (illegalDetail.length < 5) illegalDetail.push(where + " " + sq.source + ": " + r.reasons.join("; "));
      }
    });
  }

  try {
    await H.open(page, {
      html: html, mode: "full", state: seedState(), now: NOW,
      mocks: {
        // The refresh path is driven like any other button; both legs answer immediately
        // and deterministically so the loop never waits on the real network.
        "https://fantasy.premierleague.com/**": function (route) { return route.abort(); },
        "https://api.anthropic.com/**": { status: 400, contentType: "application/json", body: JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "buttons: deliberate 400" } }) }
      }
    });

    for (const mode of MODES) {
      for (const tab of TABS) {
        try {
          await restore(page, mode, tab);
          await page.waitForTimeout(120);
          await afterClick(mode + "/" + tab + " (before any click)");
          const eligible = await eligibleCount();
          const clicksBefore = clicks;

          // Clicking a Reveal renders controls that did not exist when the sweep started,
          // so sweep until the control count stops growing (at most three passes).
          let n = await page.evaluate(function (sel) { return document.querySelectorAll(sel).length; }, CONTROLS);
          let sweep = 0, seen = -1;
          while (sweep < 3 && n !== seen) {
            seen = n;
            sweep++;
          for (let i = 0; i < n; i++) {
            const handles = await page.$$(CONTROLS);
            const el = handles[i];
            if (!el) break;
            const info = await el.evaluate(function (e) {
              const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
              return {
                tag: e.tagName.toLowerCase(),
                testid: e.getAttribute("data-testid") || "",
                cls: e.getAttribute("class") || "",
                tab: e.getAttribute("data-tab") || "",
                disabled: e.disabled === true || e.getAttribute("aria-disabled") === "true",
                visible: b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && Number(cs.opacity) > 0,
                options: e.tagName === "SELECT" ? e.options.length : 0
              };
            });
            const label = mode + "/" + tab + " #" + i + " " + (info.testid || info.cls.split(" ")[0] || info.tag);
            if (!info.visible || info.disabled) continue;
            if (/\btabi\b/.test(info.cls)) continue;              // the loop's own navigation clicks every tab
            try {
              await el.click({ timeout: 5000 });
              clicks++;
              if (info.tag === "select" && info.options > 1) {
                await el.selectOption({ index: info.options - 1 });
                clicks++;
              }
              if (info.testid === "refresh" || info.testid === "refresh-run") await settleRefresh(page);
              await page.waitForTimeout(90);
              await afterClick(label);
            } catch (e) {
              throws++;
              if (throwDetail.length < 6) throwDetail.push(label + " → " + (e && e.message ? String(e.message).split("\n")[0] : String(e)));
            }
            await restore(page, mode, tab);
          }
            n = await page.evaluate(function (sel) { return document.querySelectorAll(sel).length; }, CONTROLS);
          }
          coverage.push({ key: mode + "/" + tab, eligible: eligible, clicked: clicks - clicksBefore });
        } catch (e) {
          throws++;
          if (throwDetail.length < 6) throwDetail.push(mode + "/" + tab + " loop → " + (e && e.message ? String(e.message).split("\n")[0] : String(e)));
        } finally {
          // E-017: never leave the next tab to start from a half-broken view.
          try {
            const m = await page.getAttribute(".mc-root", "data-mode");
            if (m !== "full") { await page.click('[data-testid="menu"]'); await page.click('.menu-i[data-mode="full"]'); }
            if (await page.$(".menu")) await page.click('[data-testid="menu"]');
            await page.click('[data-testid="tab-command"]');
            await page.waitForTimeout(100);
          } catch (e) { /* the browser is already gone; the counters carry the verdict */ }
        }
      }
    }

    const short = coverage.filter(function (c) { return c.clicked < c.eligible; });
    H.assert("every-control-on-both-modes-and-all-seven-tabs-was-clicked",
      coverage.length === MODES.length * TABS.length && short.length === 0 && clicks > 0,
      coverage.length + " passes, " + clicks + " clicks; per pass " +
      coverage.map(function (c) { return c.key + " " + c.clicked + "/" + c.eligible; }).join(", "));
    H.assert("no-click-threw", throws === 0, throws ? throwDetail.join(" | ") : clicks + " clicks, none threw");
    H.assert("no-error-boundary-after-any-click", boundaries === 0, boundaries ? boundaryDetail.slice(0, 4).join(" | ") : "0 .boundary in " + clicks + " clicks");
    H.assert("no-script-error-after-any-click", errorDetail.length === 0, errorDetail.length ? errorDetail.slice(0, 4).join(" | ") : "no pageerror, no console error (network failures filtered)");
    H.assert("every-displayed-name-resolved-to-one-element-id", unresolved === 0,
      unresolved ? unresolvedDetail.join(" | ") : "all displayed names resolved against the saved fifteen and the engine's fifteen");
    H.assert("legal15-holds-over-every-displayed-fifteen-after-every-click", illegal === 0,
      illegal ? illegalDetail.join(" | ") : "legal15 ran " + legalRuns + " times (2/5/5/3, cost, three per club) and passed every time");

    // ---------------------------------------------------------- controls that only exist once something is typed

    await restore(page, "full", "draft");
    await page.fill('[data-testid="draft-league"]', "1234");
    await page.waitForTimeout(120);
    const saveBtn = await page.$('[data-testid="draft-league-save"]');
    if (saveBtn) { await saveBtn.click(); clicks++; await page.waitForTimeout(200); await afterClick("full/draft draft-league-save"); }
    const savedId = await page.evaluate(function () {
      const s = document.querySelector('.section[data-section="df-league"]');
      return s ? s.innerText.replace(/\s+/g, " ") : "";
    });
    H.assert("typing-a-draft-league-id-reveals-Save-and-the-id-is-stored",
      !!saveBtn && /1234/.test(savedId), "df-league reads «" + savedId.slice(0, 70) + "»");
    await page.fill('[data-testid="draft-league"]', "");
    await page.waitForTimeout(120);
    const clearBtn = await page.$('[data-testid="draft-league-save"]');
    if (clearBtn) { await clearBtn.click(); clicks++; await page.waitForTimeout(200); await afterClick("full/draft draft-league-clear"); }

    await restore(page, "full", "lab");
    await page.fill('[data-testid="import-text"]', JSON.stringify(seedState()));
    await page.waitForTimeout(150);
    const applyBtn = await page.$('[data-testid="import-apply"]');
    if (applyBtn) { await applyBtn.click(); clicks++; await page.waitForTimeout(400); await afterClick("full/lab import-apply"); }
    const importErr = await page.evaluate(function () {
      const s = document.querySelector('.section[data-section="lab-import"] .err');
      return s ? s.innerText.slice(0, 80) : null;
    });
    H.assert("importing-a-valid-export-applies-without-an-error-panel",
      !!applyBtn && importErr === null, applyBtn ? "import error panel: " + String(importErr) : "the Apply button never rendered");

    // ---------------------------------------------------------- remount test, last (H2)

    await restore(page, "full", "rivals");
    await page.click('[data-testid="sec-rv-own"]');
    await page.waitForTimeout(120);
    const before = await page.evaluate(function () {
      const root = document.querySelector(".mc-root");
      return {
        tab: root.getAttribute("data-view"),
        secs: Array.prototype.map.call(root.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section") + ":" + s.querySelector(".sec-h").getAttribute("aria-expanded"); })
      };
    });
    await page.click('[data-testid="menu"]');
    await page.click('.menu-i[data-mode="simple"]');
    await page.waitForTimeout(180);
    await page.click('[data-testid="menu"]');
    await page.click('.menu-i[data-mode="full"]');
    await page.waitForTimeout(250);
    const after = await page.evaluate(function () {
      const root = document.querySelector(".mc-root");
      return {
        tab: root.getAttribute("data-view"), mode: root.getAttribute("data-mode"),
        boundary: root.querySelectorAll(".boundary").length,
        secs: Array.prototype.map.call(root.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section") + ":" + s.querySelector(".sec-h").getAttribute("aria-expanded"); })
      };
    });
    H.assert("E002-a-mode-remount-keeps-the-tab-and-the-open-sections",
      after.mode === "full" && after.tab === before.tab && after.boundary === 0 && after.secs.join(",") === before.secs.join(","),
      "before " + before.tab + " [" + before.secs.join(" ") + "] · after " + after.mode + "/" + after.tab + " [" + after.secs.join(" ") + "] boundary=" + after.boundary);
  } finally {
    console.log("(coverage: " + coverage.map(function (c) { return c.key + " " + c.clicked + "/" + c.eligible; }).join(", ") + ")");
    console.log("(legal15 evaluated " + legalRuns + " times over displayed fifteens; " + Object.keys(NAME_IDS).filter(function (n) { return NAME_IDS[n].length > 1; }).length + " duplicate web_names resolved by id preference)");
    console.log("SUITE buttons " + clicks + " · " + throws + " · " + boundaries + " · " + illegal);
    await browser.close();
  }

  return H.done("buttons");
}

main().catch(function (e) {
  H.assert("buttons-suite-ran-to-completion", false, e && e.message ? e.message : String(e));
  H.done("buttons");
});

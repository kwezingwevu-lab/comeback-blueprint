/*
 * qa/smoke.cjs — the UX-standard suite (CLAUDE.md H1 "smoke" row, Part G, CONTRACT §7).
 *
 * Drives the real UI in Chromium through qa/harness.cjs. Every gate in Part G is one or
 * more named checks; the error-ledger regressions carry their E-number in the name so
 * ERRORS.md can point at the assertion that holds the rule.
 *
 * One browser, serial pages, one esbuild bundle reused for every page (4 CPUs).
 *
 * Run: node qa/smoke.cjs
 */

"use strict";

const path = require("path");
const H = require(path.join(__dirname, "harness.cjs"));

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist", "index.html");
const LIVE = require(path.join(ROOT, "data", "live.json"));
// The engine is required here for ONE reason: the panel checks below compare what the screen
// prints against what the engine computes, rather than against a number typed into the test.
const ENG = require(path.join(ROOT, "src", "engine.js"));
// v110 D1 (E-114): the solved plan and the build's precomputed results, read only to know which card the landing must
// show and what the solved card recommends; every figure compared below is read from them or from the snapshot.
const PLAN = require(path.join(ROOT, "data", "plan.json"));
const PRE = require(path.join(ROOT, "data", "pre.json"));

// E-084: these were "2026-09-11T08:00:00Z" and "2026-09-12T15:00:00Z" — the Friday and the
// Saturday of GW4. The snapshot moved on to GW6 and every clock-relative check in this suite
// went red on an app that was correct. Both are derived from the snapshot's own is_next event
// now, so a refresh moves them with it (E-011).
const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const NEXT_EV = LIVE.events.filter(function (e) { return e.is_next; })[0] || LIVE.events[LIVE.events.length - 1];
const NEXT_DL = Date.parse(NEXT_EV.deadline_time);
const NEXT_LAST_KO = Math.max.apply(null, [NEXT_DL].concat(
  LIVE.fixtures.filter(function (f) { return Number(f.event) === Number(LIVE.next_event); })
    .map(function (f) { return Date.parse(f.kickoff_time); }).filter(isFinite)));
const NOW = isoAt(NEXT_DL - 26 * 3600000);          // the day before the next deadline
const LIVE_NOW = isoAt(NEXT_DL + 5 * 3600000);      // inside the live window of the next gameweek
// v110 D0: nine tabs — odds and review join before lab (GAP_v110 D4, D5). Every count below is TABS.length, and
// "suite-TABS-equal-the-app-tab-strip" compares this list once with the rendered .tabi ids, so the two cannot drift.
const TABS = ["command", "plan", "squad", "rivals", "draft", "chips", "odds", "review", "lab"];
const PRIMARY = { command: "cmd-stand", plan: "plan-solved", squad: "sq-fifteen", rivals: "rv-table", draft: "df-claims", chips: "ch-now", odds: "od-next", review: "rw-classic", lab: "lab-data" };
const TOKENS = ["--amb", "--bg", "--bg2", "--bg3", "--blu", "--cyn", "--dim", "--err", "--focus", "--grn", "--grn2", "--line", "--mute", "--ok", "--pnk", "--pnk2", "--pur", "--shadow", "--text", "--warn", "--wht"];
const FLOORS = { ".btn": 44, ".btn-sm": 32, ".btn-ic": 44, ".tabi": 52, ".sec-h": 48, ".menu-i": 44, ".inp": 44, ".row": 38, ".reveal": 44 };
const GAKPO = 367;

// ---------------------------------------------------------------- small helpers

function words(s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length; }

/* v110 D0 · the tab strip rule (CLAUDE.md Part G, 27 Sep 2026), measured rather than read from the stylesheet: every
   child of .tabs by its client rect (an element walk — a strip can clip or scroll while the document's scrollWidth
   stays pinned at the viewport), the strip's own scroll box and the document's, and each label's natural width (a
   clone with no max-width) against the width it was given. Returns plain numbers for the suite to judge. */
function stripProbe() {
  const tabs = document.querySelector(".tabs");
  const cells = Array.prototype.map.call(tabs ? tabs.children : [], function (e) {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e), sp = e.querySelector("span");
    const inner = r.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let label = null;
    if (sp) {
      const ls = getComputedStyle(sp), c = sp.cloneNode(true);
      c.style.cssText = "position:absolute;visibility:hidden;max-width:none;white-space:nowrap;overflow:visible;display:inline";
      e.appendChild(c); const natural = c.getBoundingClientRect().width; c.remove();
      label = { shown: ls.display !== "none" && ls.visibility !== "hidden", fs: parseFloat(ls.fontSize), natural: natural, rendered: sp.getBoundingClientRect().width };
    }
    return { id: e.getAttribute("data-tab"), left: r.left, right: r.right, w: r.width, h: r.height, inner: inner, aria: e.getAttribute("aria-label") || "", label: label };
  });
  return { vw: window.innerWidth, docSW: document.documentElement.scrollWidth, docCW: document.documentElement.clientWidth,
    stripSW: tabs ? tabs.scrollWidth : -1, stripCW: tabs ? tabs.clientWidth : -1, cells: cells };
}
/* Judges one stripProbe reading against the rule: at every width the strip fits (document, strip box and element
   walk), the cells are equal, at least Apple's 28 wide (HIG minimum; nine cells cannot reach 44, the named exception in Part G) and 24 by WCAG 2.5.8, and 52 high (Part G), and each keeps its name in
   aria-label; wider than 380px every label is shown at 11px or more and uncut; at 380px and narrower the cells are
   icon-only. Returns the list of breaches, empty when the reading passes. */
function stripBreaches(m, count) {
  const bad = [];
  const w = m.vw, widths = m.cells.map(function (c) { return c.w; });
  if (m.cells.length !== count) bad.push(w + ": " + m.cells.length + " cells, not " + count);
  if (m.docSW > m.docCW) bad.push(w + ": document scrollWidth " + m.docSW + " > " + m.docCW);
  if (m.stripSW > m.stripCW) bad.push(w + ": strip scrollWidth " + m.stripSW + " > " + m.stripCW);
  if (widths.length && Math.max.apply(null, widths) - Math.min.apply(null, widths) > 1) bad.push(w + ": widths spread " + (Math.max.apply(null, widths) - Math.min.apply(null, widths)).toFixed(2));
  m.cells.forEach(function (c) {
    if (c.left < -0.5 || c.right > w + 0.5) bad.push(w + ": " + c.id + " spans " + c.left.toFixed(2) + "–" + c.right.toFixed(2));
    if (c.w < 28 || c.h < 28) bad.push(w + ": " + c.id + " is " + c.w.toFixed(2) + "x" + c.h.toFixed(2) + " (Apple's minimum 28x28; WCAG 2.5.8 floor 24x24)");
    if (c.h < 52 - 0.5) bad.push(w + ": " + c.id + " is " + c.h.toFixed(2) + " high (Part G .tabi 52)");
    if (!c.aria.trim()) bad.push(w + ": " + c.id + " has no aria-label");
    if (!c.label) { bad.push(w + ": " + c.id + " has no label span"); return; }
    if (w > 380) {
      if (!c.label.shown) bad.push(w + ": " + c.id + " label hidden");
      else if (c.label.fs < 11) bad.push(w + ": " + c.id + " label " + c.label.fs + "px (floor 11)");
      else if (c.label.natural > c.label.rendered + 0.01 || c.label.natural > c.inner + 0.01) bad.push(w + ": " + c.id + " label cut, " + c.label.natural.toFixed(2) + "px in " + Math.min(c.label.rendered, c.inner).toFixed(2));
    } else if (c.label.shown) bad.push(w + ": " + c.id + " label shown at " + w + "px, where the rule is icon-only");
  });
  return bad;
}
function stripSummary(m) {
  const shown = m.cells.filter(function (c) { return c.label && c.label.shown; });
  const tight = shown.map(function (c) { return { id: c.id, room: c.inner - c.label.natural, natural: c.label.natural }; }).sort(function (a, b) { return a.room - b.room; })[0];
  return m.vw + "px: " + m.cells.length + " × " + (m.cells[0] ? m.cells[0].w.toFixed(2) + "x" + m.cells[0].h.toFixed(2) : "?") +
    ", document " + m.docSW + "/" + m.docCW + ", strip " + m.stripSW + "/" + m.stripCW + ", " +
    (shown.length ? shown.length + " labels, tightest " + tight.id + " " + tight.natural.toFixed(2) + "px with " + tight.room.toFixed(2) + "px spare" : "icon-only");
}

function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

/* The snapshot as it would look with the NEXT gameweek under way: the same data, plus the
   live rows and picks the API serves once the deadline has passed. Nothing else is changed,
   so current_event stays where a pre-deadline pull leaves it. */
function nextGwRunning() {
  const live = deepCopy(LIVE);
  const cur = String(LIVE.current_event), nxt = String(LIVE.next_event);
  const picks = live.picks[cur].picks;
  const rows = {};
  picks.forEach(function (p, i) { rows[p.element] = [90, 1, (i % 5) + 2, 0.2, 0.1, 0.8, 9, 20, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; });
  live.gw[nxt] = { elements: rows, fixture_xg: {} };
  live.picks[nxt] = { active_chip: null, picks: picks };
  return live;
}

/* v110 D1 (E-114): a saved state with one match price typed on the Odds tab (state.market), the setting that sets the
   solved plan aside on the landing while leaving the app's own engine untouched (src/engine.js never reads it). The
   gameweek and the team are read from the snapshot, never typed. */
function withPrice(state) {
  const s = deepCopy(state);
  const g = String(LIVE.next_event), t = LIVE.teams[0].short_name;
  s.market = {}; s.market[g] = {}; s.market[g][t] = { xg: 1.5 };
  return s;
}

/* One element's flag lifted, or added, and nothing else touched. */
function withFlag(id, on) {
  const live = deepCopy(LIVE);
  const el = live.elements.filter(function (e) { return Number(e.id) === Number(id); })[0];
  if (el) { el.status = on ? "d" : "a"; el.chance = on ? 75 : null; el.news = on ? "Knock - 75% chance of playing" : ""; }
  return live;
}

/* The subject of the flag pair, chosen from the snapshot rather than named: the highest
   five-week xP flagged player who walks into the engine's recommended fifteen the moment his
   flag is lifted. Hard-coding Gakpo meant the pair stopped testing anything the week his form
   dropped out of the solve (E-084). */
function flagSubject() {
  const base = ENG.buildCtx(LIVE, null, NOW);
  const cands = base.elList
    .filter(function (el) { return el.status !== "a" || (el.chance !== null && el.chance < 100); })
    .filter(function (el) { const g = base.gwStats[el.id]; return g && g.starts_last3 >= 3; })
    .sort(function (a, b) { return base.xp[b.id].xp5 - base.xp[a.id].xp5; })
    .slice(0, 5);
  for (const el of cands) {
    const wc = ENG.wildcardSolver(ENG.buildCtx(withFlag(el.id, false), null, NOW), {});
    if (wc.ok && wc.ids.indexOf(el.id) >= 0) return { id: el.id, name: el.web_name, status: el.status, chance: el.chance };
  }
  return null;
}

async function openAllSections(page) {
  const ids = await page.evaluate(function () {
    return Array.prototype.map.call(document.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section"); });
  });
  for (const id of ids) {
    const sel = '[data-testid="sec-' + id + '"]';
    if ((await page.getAttribute(sel, "aria-expanded")) !== "true") await page.click(sel);
  }
  return ids;
}

async function openAllReveals(page) {
  const ids = await page.evaluate(function () {
    return Array.prototype.map.call(document.querySelectorAll(".reveal"), function (r) { return r.getAttribute("data-testid"); });
  });
  for (const id of ids) {
    const sel = '[data-testid="' + id + '"]';
    if ((await page.getAttribute(sel, "aria-expanded")) !== "true") await page.click(sel);
  }
  return ids;
}

async function landingText(page) {
  return page.evaluate(function () { const l = document.querySelector(".landing"); return l ? l.innerText : ""; });
}

// ---------------------------------------------------------------- the suite

async function main() {
  const missing = H.appMissing();
  if (missing) { H.assert("app-file-exists", false, missing); return H.done("smoke"); }

  // Three bundles: the shipped snapshot, the flag-lifted control, and the snapshot as it
  // looks once GW4 kicks off. buildPage() bakes inlineData into the HTML, so a scenario
  // that needs its own snapshot needs its own page.
  const html = H.buildPage({});
  const SUBJECT = flagSubject();
  const htmlCtrl = SUBJECT ? H.buildPage({ inlineData: withFlag(SUBJECT.id, false) }) : null;
  const htmlLive = H.buildPage({ inlineData: nextGwRunning() });
  const browser = await H.launch();

  // E-027: Playwright 1.63 looks for Chromium build 1243 while the sandbox carries 1194, so
  // launch() pins executablePath to /opt/pw-browsers/chromium when it exists and falls back
  // to Playwright's own install on the CI runner. Either way a real browser must be running
  // before a single UI claim is made, and the suite says which one it got.
  H.assert("E027-harness-launched-a-real-chromium-and-says-which-build",
    !!browser && browser.isConnected() && /^\d+\.\d+/.test(String(browser.version())),
    "chromium " + (browser ? browser.version() : "no browser") + " via " +
      (require("fs").existsSync(H.CHROMIUM_PATH) ? H.CHROMIUM_PATH + " (preinstalled)" : "the Playwright default install"));

  const pageErrors = [];
  function watch(p) {
    p.on("pageerror", function (e) { pageErrors.push(String(e && e.message ? e.message : e)); });
    p.on("console", function (m) {
      // A mocked 400 and an aborted cross-origin fetch are the point of two of the checks
      // below; only script errors count here.
      if (m.type() !== "error") return;
      const t = m.text();
      if (/Failed to load resource/i.test(t) || /net::ERR_/.test(t)) return;
      pageErrors.push("console: " + t);
    });
  }

  // A scenario gets its own BrowserContext: page.addInitScript accumulates across open()
  // calls and localStorage is shared inside a context, so reusing one page would let an
  // earlier seed rewrite mc_ui on the reload the persistence check depends on.
  let context = null, page = null;
  async function fresh(opts) {
    if (context) { await context.close(); context = null; page = null; }
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await context.newPage();
    watch(page);
    await H.open(page, opts);
    return page;
  }

  try {
    // ---------------------------------------------------------- 1. both modes render

    await fresh({ html: html, mode: "simple", now: NOW });
    const simple = await page.evaluate(function () {
      const root = document.querySelector(".mc-root");
      if (!root) return null;
      const first = root.querySelector(".landing, .section, .card");
      const sec = root.querySelector(".section");
      const stand = root.querySelector('[data-testid="standing"]');
      return {
        mode: root.getAttribute("data-mode"),
        landing: !!root.querySelector(".landing"),
        boundary: root.querySelectorAll(".boundary").length,
        firstIsLanding: !!first && first.classList.contains("landing"),
        beforeSections: !sec || !!(first && (first.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING)),
        beforeStanding: !stand || !!(first && (first.compareDocumentPosition(stand) & Node.DOCUMENT_POSITION_FOLLOWING)),
        tabs: root.querySelectorAll(".tabi").length,
        cardHtml: (function () { const l = root.querySelector(".landing"); return l ? l.innerHTML : ""; })(),
        panels: root.querySelectorAll(".landing .panel").length,
        plan: (function () { const l = root.querySelector(".landing"); return l ? l.getAttribute("data-plan") || "" : ""; })(),
        text: (function () { const l = root.querySelector(".landing"); return l ? l.innerText : ""; })()
      };
    });
    // v110 D1 (E-114): the app's seeded state, read back from storage once the app has written it, so the checks written
    // for the app's own card can reopen the same session with one match price typed on the Odds tab (withPrice).
    let SEEDED = null;
    try {
      await page.waitForFunction(function () { return !!window.localStorage.getItem("mc_state"); }, null, { timeout: 5000 });
      SEEDED = await page.evaluate(function () { return JSON.parse(window.localStorage.getItem("mc_state")); });
    } catch (e) { SEEDED = null; }
    const STATE_PRICE = SEEDED && Array.isArray(SEEDED.squad) && SEEDED.squad.length ? withPrice(SEEDED) : null;
    H.assert("simple-mode-renders", !!simple && simple.landing && simple.boundary === 0 && simple.mode === "simple",
      simple ? "landing=" + simple.landing + " boundary=" + simple.boundary + " mode=" + simple.mode : "no .mc-root");
    H.assert("simple-mode-landing-is-the-first-card-in-mc-root", !!simple && simple.firstIsLanding && simple.beforeSections && simple.beforeStanding,
      simple ? "firstIsLanding=" + simple.firstIsLanding + " beforeSections=" + simple.beforeSections + " beforeStanding=" + simple.beforeStanding : "no page");

    const simpleWords = simple ? words(simple.text) : -1;
    H.assert("landing-card-under-110-visible-words", simpleWords > 0 && simpleWords < 110, "visible words in .landing = " + simpleWords + " (gate < 110)");
    H.assert("landing-card-has-at-most-4-panels", !!simple && simple.panels <= 4, simple ? simple.panels + " .panel children" : "no page");

    await fresh({ html: html, mode: "full", now: NOW });
    const full = await page.evaluate(function () {
      const root = document.querySelector(".mc-root");
      if (!root) return null;
      const first = root.querySelector(".landing, .section, .card");
      const sec = root.querySelector(".section");
      return {
        mode: root.getAttribute("data-mode"), tab: root.getAttribute("data-view"),
        landing: !!root.querySelector(".landing"), boundary: root.querySelectorAll(".boundary").length,
        firstIsLanding: !!first && first.classList.contains("landing"),
        beforeSections: !sec || !!(first && (first.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING)),
        tabs: root.querySelectorAll(".tabi").length,
        tabIds: Array.prototype.map.call(root.querySelectorAll(".tabi"), function (e) { return e.getAttribute("data-tab"); }),
        cardHtml: (function () { const l = root.querySelector(".landing"); return l ? l.innerHTML : ""; })()
      };
    });
    H.assert("full-mode-renders", !!full && full.landing && full.boundary === 0 && full.mode === "full" && full.tabs === TABS.length,
      full ? "landing=" + full.landing + " boundary=" + full.boundary + " tabs=" + full.tabs + " (suite TABS " + TABS.length + ")" : "no .mc-root");
    H.assert("suite-TABS-equal-the-app-tab-strip", !!full && full.tabIds.join(",") === TABS.join(","),
      full ? "rendered [" + full.tabIds.join(",") + "] · suite [" + TABS.join(",") + "]" : "no .mc-root");
    H.assert("full-mode-landing-is-the-first-card-in-mc-root", !!full && full.firstIsLanding && full.beforeSections,
      full ? "firstIsLanding=" + full.firstIsLanding + " beforeSections=" + full.beforeSections : "no page");
    H.assert("E022-both-modes-share-GwActionCard", !!simple && !!full && simple.cardHtml.length > 0 && simple.cardHtml === full.cardHtml,
      "simple " + (simple ? simple.cardHtml.length : -1) + " chars, full " + (full ? full.cardHtml.length : -1) + " chars, identical=" + (!!simple && !!full && simple.cardHtml === full.cardHtml));

    // ---------------------------------------------------------- 2. per-tab first paint

    const tabWords = {}, tabSecs = {};
    for (const t of TABS) {
      await page.click('[data-testid="tab-' + t + '"]');
      await page.waitForFunction(function (id) { const r = document.querySelector(".mc-root"); return r && r.getAttribute("data-view") === id; }, t, { timeout: 10000 });
      const r = await page.evaluate(function () {
        const root = document.querySelector(".mc-root");
        return {
          text: root.innerText,
          boundary: root.querySelectorAll(".boundary").length,
          open: Array.prototype.filter.call(root.querySelectorAll(".section"), function (s) { return s.querySelector(".sec-h").getAttribute("aria-expanded") === "true"; }).map(function (s) { return s.getAttribute("data-section"); }),
          count: root.querySelectorAll(".section").length
        };
      });
      tabWords[t] = words(r.text);
      tabSecs[t] = r;
    }
    const overWords = TABS.filter(function (t) { return tabWords[t] >= 500; });
    H.assert("every-tab-under-500-visible-words-on-first-paint", overWords.length === 0,
      TABS.map(function (t) { return t + " " + tabWords[t]; }).join(", ") + " (gate < 500)");
    H.assert("every-tab-renders-at-least-one-Section", TABS.every(function (t) { return tabSecs[t].count >= 1; }),
      TABS.map(function (t) { return t + " " + tabSecs[t].count; }).join(", "));
    const primaryBad = TABS.filter(function (t) { return tabSecs[t].open.length !== 1 || tabSecs[t].open[0] !== PRIMARY[t]; });
    H.assert("every-tab-opens-exactly-one-primary-Section", primaryBad.length === 0,
      TABS.map(function (t) { return t + " [" + tabSecs[t].open.join("|") + "] expected " + PRIMARY[t]; }).join("; "));
    H.assert("no-boundary-on-any-tab-in-either-mode",
      TABS.every(function (t) { return tabSecs[t].boundary === 0; }) && !!simple && simple.boundary === 0,
      "full-mode tabs " + TABS.map(function (t) { return t + ":" + tabSecs[t].boundary; }).join(",") + "; simple-mode landing:" + (simple ? simple.boundary : "n/a"));

    // ---------------------------------------------------------- 3. flagged player (C1 rule 2)

    const realText = simple ? simple.text : "";
    const oneLine = realText.replace(/\n/g, " ");
    const rx = (n) => new RegExp(String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    // E-114 (v110 D1): the landing shows the solved plan (data-plan="solved") whenever PLAN and PRE share a hash, and the
    // app's own card (data-plan="app") whenever that plan is set aside. This pair was written for the app's own card, so
    // it reads that card on both pages, each opened with one match price typed on the Odds tab (withPrice); the solved
    // card is held by the check after the next one.
    async function appCard(h) {
      const p = await fresh({ html: h, mode: "simple", now: NOW, state: STATE_PRICE });
      return { text: await landingText(p), plan: await p.getAttribute(".landing", "data-plan") };
    }
    const appReal = STATE_PRICE ? await appCard(html) : { text: "", plan: "" };
    // Half one: the flag is what keeps the subject out. Control = the same snapshot with his
    // flag lifted and nothing else changed.
    let appCtrl = { text: "", plan: "" };
    if (SUBJECT && STATE_PRICE) appCtrl = await appCard(htmlCtrl);
    const ctrlText = appCtrl.text;
    H.assert("C1-flagged-player-is-absent-from-the-recommendation",
      !!SUBJECT && appReal.plan === "app" && appCtrl.plan === "app" && rx(SUBJECT.name).test(ctrlText) && !rx(SUBJECT.name).test(appReal.text),
      SUBJECT ? "on the app's own card (landing " + appReal.plan + " / " + appCtrl.plan + " with a typed price): subject " + SUBJECT.name + " (id " + SUBJECT.id + ", shipped status " + SUBJECT.status + " " + SUBJECT.chance +
        "%); control with the flag lifted names him = " + rx(SUBJECT.name).test(ctrlText) + "; shipped names him = " + rx(SUBJECT.name).test(appReal.text)
        : "no flagged player in the snapshot enters the fifteen once unflagged — the control is unsound");
    // Half two: the other direction, which cannot age at all. Take whoever the shipped plan
    // actually captains, flag him, and he must leave the armband, the vice slot and the fifteen.
    const shippedCap = (oneLine.match(/Captain\s+([^,.·]+)/) || [])[1];
    const capEl = shippedCap ? LIVE.elements.filter(function (e) { return e.web_name === shippedCap.trim(); })[0] : null;
    let capFlaggedText = "";
    if (capEl) {
      const capPage = await fresh({ html: H.buildPage({ inlineData: withFlag(capEl.id, true) }), mode: "simple", now: NOW });
      capFlaggedText = (await landingText(capPage)).replace(/\n/g, " ");
    }
    // E-114: the same, on the app's own card (a typed price sets the solved plan aside): its captain, flagged, leaves it too
    const appOne = appReal.text.replace(/\n/g, " ");
    const appCap = (appOne.match(/Captain\s+([^,.·]+)/) || [])[1];
    const appCapEl = appCap ? LIVE.elements.filter(function (e) { return e.web_name === appCap.trim(); })[0] : null;
    let appCapFlagged = "";
    if (appCapEl && STATE_PRICE) {
      const acp = await fresh({ html: H.buildPage({ inlineData: withFlag(appCapEl.id, true) }), mode: "simple", now: NOW, state: STATE_PRICE });
      appCapFlagged = (await landingText(acp)).replace(/\n/g, " ");
    }
    const gone = function (name, text) {
      const e = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return !new RegExp("(Captain|vice)\\s+" + e).test(text) && !rx(name).test(text);
    };
    H.assert("C1-flagged-player-is-never-captain-nor-vice",
      !!capEl && new RegExp("Captain\\s+" + shippedCap.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(oneLine) &&
      !new RegExp("(Captain|vice)\\s+" + shippedCap.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(capFlaggedText) &&
      !rx(shippedCap.trim()).test(capFlaggedText) && !!appCapEl && gone(appCap.trim(), appCapFlagged),
      (capEl ? "the shipped " + (simple ? simple.plan : "?") + " card captains " + shippedCap.trim() + " (id " + capEl.id + "); with a 75% flag on him and nothing else changed the landing reads «" +
        capFlaggedText.slice(0, 120) + "»" : "no captain could be read off the shipped landing: «" + oneLine.slice(0, 120) + "»") +
        " · the app's own card captains " + (appCap ? appCap.trim() : "nobody") + "; flagged, it reads «" + appCapFlagged.slice(0, 100) + "»");

    // E-114 (v110 D1) · the solved card: it shows exactly when the data says it should, every player it recommends is
    // unflagged in the snapshot and named on it, and a flag on one of them (its vice, named on the card) sets the plan
    // aside: the app's own card answers and leaves him out.
    {
      const w1 = PLAN.plan && PLAN.plan.ok === true && Array.isArray(PLAN.plan.weeks) ? PLAN.plan.weeks[0] : null;
      const ev1 = w1 ? LIVE.events.filter(function (e) { return Number(e.id) === w1.gw; })[0] : null;
      const expectSolved = !!(w1 && typeof PRE.hash === "string" && PRE.hash === PLAN.hash && w1.gw === Number(LIVE.next_event) &&
        ev1 && Date.parse(ev1.deadline_time) > Date.parse(NOW));
      const byId = {}; LIVE.elements.forEach(function (e) { byId[e.id] = e; });
      const flaggedEl = function (e) { return !e || e.status !== "a" || (e.chance !== null && e.chance !== undefined && e.chance < 100); };
      const whole = !!w1 && (w1.chip === "wildcard" || w1.chip === "freehit");
      const recIds = w1 ? (whole ? w1.squad : w1.in).concat([w1.cap, w1.vice]).filter(function (v, i, a) { return a.indexOf(v) === i; }) : [];
      const nmOf = function (id) { return byId[id] ? byId[id].web_name : "id " + id; };
      const flaggedRec = recIds.filter(function (id) { return flaggedEl(byId[id]); }).map(nmOf);
      const unnamed = recIds.filter(function (id) { return !byId[id] || !rx(byId[id].web_name).test(realText); }).map(nmOf);
      const vEl = w1 ? byId[w1.vice] : null;
      let vText = "", vPlan = "";
      if (vEl) {
        const vp = await fresh({ html: H.buildPage({ inlineData: withFlag(vEl.id, true) }), mode: "simple", now: NOW });
        vText = (await landingText(vp)).replace(/\n/g, " "); vPlan = await vp.getAttribute(".landing", "data-plan");
      }
      H.assert("C1-the-solved-landing-names-only-unflagged-players-and-a-new-flag-on-one-sets-it-aside",
        expectSolved && !!simple && simple.plan === "solved" && recIds.length > 0 && flaggedRec.length === 0 && unnamed.length === 0 &&
          !!vEl && vPlan === "app" && !rx(vEl.web_name).test(vText),
        "data says solved " + expectSolved + ", landing " + (simple ? simple.plan : "?") + "; " + recIds.length + " recommended, flagged " + (flaggedRec.join(",") || "none") +
          ", not named " + (unnamed.join(",") || "none") + "; vice " + (vEl ? vEl.web_name : "?") + " flagged → landing " + vPlan + " «" + vText.slice(0, 90) + "»");
    }

    // ---------------------------------------------------------- 4. type floor and touch floors

    await fresh({ html: html, mode: "full", now: NOW });
    let minFont = { px: 999, sel: "(nothing measured)" };
    const formSeen = { px: 999, n: 0, sel: "(none)" };
    const floorMin = {};
    Object.keys(FLOORS).forEach(function (k) { floorMin[k] = { min: null, where: "" }; });

    async function measure(label) {
      const r = await page.evaluate(function (FLOORS) {
        const vis = function (el) {
          const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
          return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
        };
        let mn = { px: 999, sel: "" };
        Array.prototype.forEach.call(document.querySelectorAll(".mc-root *"), function (el) {
          if (el.tagName === "STYLE") return;
          if (!Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); })) return;
          if (!vis(el)) return;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (isFinite(fs) && fs < mn.px) mn = { px: fs, sel: (el.getAttribute("class") || el.tagName.toLowerCase()) + " «" + el.textContent.trim().slice(0, 24) + "»" };
        });
        const fl = {};
        Object.keys(FLOORS).forEach(function (k) {
          let min = null, where = "";
          Array.prototype.forEach.call(document.querySelectorAll(".mc-root " + k), function (el) {
            if (!vis(el)) return;
            const h = el.getBoundingClientRect().height;
            if (min === null || h < min) { min = h; where = el.textContent.trim().slice(0, 24); }
          });
          fl[k] = { min: min, where: where };
        });
        let fm = { px: 999, n: 0, sel: "" };
        Array.prototype.forEach.call(document.querySelectorAll(".mc-root input, .mc-root select, .mc-root textarea"), function (el) {
          if (!vis(el)) return;
          fm.n++;
          const f3 = parseFloat(getComputedStyle(el).fontSize);
          if (isFinite(f3) && f3 < fm.px) fm = { px: f3, n: fm.n, sel: el.tagName.toLowerCase() + "[" + (el.getAttribute("data-testid") || el.getAttribute("aria-label") || "") + "]" };
        });
        return { mn: mn, fl: fl, fm: fm };
      }, FLOORS);
      if (r.mn.px < minFont.px) minFont = { px: r.mn.px, sel: r.mn.sel + " on " + label };
      formSeen.n += r.fm.n;
      if (r.fm.px < formSeen.px) formSeen.px = r.fm.px, formSeen.sel = r.fm.sel + " on " + label;
      Object.keys(FLOORS).forEach(function (k) {
        const v = r.fl[k];
        if (v.min === null) return;
        if (floorMin[k].min === null || v.min < floorMin[k].min) floorMin[k] = { min: v.min, where: v.where + " on " + label };
      });
    }

    for (const t of TABS) {
      await page.click('[data-testid="tab-' + t + '"]');
      await page.waitForTimeout(120);
      await openAllSections(page);
      await openAllReveals(page);
      await page.waitForTimeout(150);
      await measure("full/" + t);
    }
    await page.click('[data-testid="menu"]');
    await page.waitForSelector(".menu");
    await measure("full/menu");
    await page.click('[data-testid="menu"]');

    H.assert("E023-type-floor-no-visible-text-under-11px", minFont.px >= 11,
      "smallest visible computed font-size " + minFont.px + "px on " + minFont.sel + " (floor 11px)");

    Object.keys(FLOORS).forEach(function (k) {
      const got = floorMin[k];
      H.assert("E024-touch-floor-" + k.replace(".", "") + "-" + FLOORS[k] + "px",
        got.min !== null && got.min >= FLOORS[k] - 0.5,
        got.min === null ? "no visible " + k + " element was rendered anywhere" : "minimum height " + got.min.toFixed(1) + "px on «" + got.where + "» (floor " + FLOORS[k] + ")");
    });

    H.assert("E023-form-controls-are-16px-or-larger-so-focus-does-not-zoom", formSeen.n > 0 && formSeen.px >= 16,
      formSeen.n + " visible input/select/textarea readings, smallest computed font-size " + formSeen.px + "px on " + formSeen.sel + " (floor 16px, WebKit's zoom-on-focus rule)");
    {
      const hb = await page.evaluate(function () {
        const r = document.querySelector('[data-testid="refresh"]'), m = document.querySelector('[data-testid="menu"]');
        if (!r || !m) return null;
        const a = r.getBoundingClientRect(), b = m.getBoundingClientRect();
        return { rw: a.width, rh: a.height, mw: b.width, mh: b.height, gap: b.left - a.right };
      });
      H.assert("E024-header-refresh-and-menu-are-44x44-with-12px-between",
        !!hb && hb.rw >= 43.5 && hb.rh >= 43.5 && hb.mw >= 43.5 && hb.mh >= 43.5 && hb.gap >= 11.99,
        hb ? "refresh " + hb.rw.toFixed(2) + "x" + hb.rh.toFixed(2) + ", menu " + hb.mw.toFixed(2) + "x" + hb.mh.toFixed(2) + ", gap " + hb.gap.toFixed(2) + " (Apple 44x44 pt, about 12 pt between bordered controls)" : "header buttons not found");
    }

    // ---------------------------------------------------------- 5. colour tokens and hex literals

    const colour = await page.evaluate(function () {
      let decl = null;
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
        for (const rule of rules) {
          if (rule.selectorText && rule.selectorText.trim() === ".mc-root") {
            const names = [];
            for (let i = 0; i < rule.style.length; i++) if (rule.style[i].indexOf("--") === 0) names.push(rule.style[i]);
            if (names.length) decl = names.sort();
          }
        }
      }
      const clone = document.querySelector(".mc-root").cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll("style"), function (s) { s.parentNode.removeChild(s); });
      const hex = clone.innerHTML.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
      return { names: decl, hex: Array.from(new Set(hex)) };
    });
    const names = colour.names || [];
    H.assert("E025-exactly-21-colour-tokens-on-mc-root",
      names.length === 21 && names.join(",") === TOKENS.join(","),
      names.length + " custom properties declared on .mc-root: " + names.join(" "));
    H.assert("E025-zero-hex-colour-literals-in-rendered-markup", colour.hex.length === 0,
      colour.hex.length ? "found " + colour.hex.join(", ") : "none outside the single <style> block");

    /* The page shipped a second <style> in the HTML shell carrying --bg and --text again as
       raw hex, outside the token definitions and free to drift from them. Exactly one style
       block in the rendered document may carry hex, and it has to be the app's own. */
    const sheets = await page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll("style"), function (st) {
        const t = st.textContent || "";
        return {
          hex: Array.from(new Set(t.match(/#[0-9a-fA-F]{3,8}\b/g) || [])).length,
          inRoot: !!st.closest(".mc-root"),
          head: t.replace(/\s+/g, " ").slice(0, 48)
        };
      });
    });
    const hexSheets = sheets.filter(function (x) { return x.hex > 0; });
    H.assert("exactly-one-style-block-in-the-page-carries-hex-colour",
      hexSheets.length === 1 && hexSheets[0].inRoot,
      sheets.length + " style blocks, hex counts [" + sheets.map(function (x) { return x.hex + (x.inRoot ? " in .mc-root" : " in the shell"); }).join(", ") + "]");

    // ---------------------------------------------------------- 6. tabs and horizontal scroll

    const tabGeom = await page.evaluate(function () {
      const t = Array.prototype.map.call(document.querySelectorAll(".tabi"), function (e) {
        return { id: e.getAttribute("data-tab"), testid: e.getAttribute("data-testid"), aria: e.getAttribute("aria-label"), w: Math.round(e.getBoundingClientRect().width * 10) / 10 };
      });
      return t;
    });
    const widths = tabGeom.map(function (t) { return t.w; });
    const spread = widths.length ? Math.max.apply(null, widths) - Math.min.apply(null, widths) : 999;
    H.assert("every-TABS-entry-is-an-equal-width-icon-tab",
      tabGeom.length === TABS.length && spread <= 1 &&
      tabGeom.every(function (t, i) { return t.id === TABS[i] && t.testid === "tab-" + TABS[i] && !!t.aria; }),
      tabGeom.length + " tabs [" + tabGeom.map(function (t) { return t.id + " " + t.w + "px"; }).join(", ") + "], width spread " + spread.toFixed(1) + "px");

    /* data-tab belongs to the tab buttons and to nothing else (CONTRACT §7). The root
       carried it too, so the page exposed eight of them with "command" twice; the root's
       current tab is data-view now. */
    const tagged = await page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll("[data-tab]"), function (e) {
        return { id: e.getAttribute("data-tab"), tabi: /\btabi\b/.test(e.getAttribute("class") || "") };
      });
    });
    H.assert("exactly-one-data-tab-element-per-TABS-entry",
      tagged.length === TABS.length && tagged.every(function (t) { return t.tabi; }) &&
        tagged.map(function (t) { return t.id; }).join(",") === TABS.join(","),
      tagged.length + " elements carry data-tab: " + tagged.map(function (t) { return t.id + (t.tabi ? "" : " (not a tab button)"); }).join(", "));

    const scrolls = [];
    for (const w of [360, 390]) {
      await page.setViewportSize({ width: w, height: 800 });
      for (const t of TABS) {
        await page.click('[data-testid="tab-' + t + '"]');
        await page.waitForTimeout(90);
        const r = await page.evaluate(function () { return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
        if (r.sw > r.cw) scrolls.push(w + "px/" + t + " " + r.sw + ">" + r.cw);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    H.assert("no-horizontal-scroll-at-360px-and-390px", scrolls.length === 0,
      scrolls.length ? scrolls.join("; ") : (2 * TABS.length) + " measurements (2 widths x " + TABS.length + " tabs), scrollWidth never exceeded clientWidth");

    // v110 D0 · the strip rule of CLAUDE.md Part G (27 Sep 2026), at 360, 390 and 430, by element walk.
    {
      const readings = [], breaches = [];
      for (const w of [360, 390, 430]) {
        await page.setViewportSize({ width: w, height: 844 });
        await page.waitForTimeout(90);
        const m = await page.evaluate(stripProbe);
        readings.push(stripSummary(m));
        stripBreaches(m, TABS.length).forEach(function (b) { breaches.push(b); });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      H.assert("tab-strip-fits-with-labels-above-380px-and-icon-only-at-360", breaches.length === 0,
        breaches.length ? breaches.slice(0, 6).join("; ") : readings.join(" · "));
    }

    // ---------------------------------------------------------- 7. header and menu

    const header = await page.evaluate(function () {
      const h1 = document.querySelector('h1[data-testid="title"]');
      const st = document.querySelector('[data-testid="status"]');
      const rf = document.querySelector('button[data-testid="refresh"]');
      const mn = document.querySelector('button[data-testid="menu"]');
      return {
        title: h1 ? h1.textContent.trim() : "", status: st ? st.innerText.replace(/\s+/g, " ").trim() : "",
        refresh: !!rf && !!rf.getAttribute("aria-label"), menu: !!mn && !!mn.getAttribute("aria-label")
      };
    });
    H.assert("header-carries-title-status-refresh-and-menu",
      header.title.length > 0 && header.status.length > 0 && header.refresh && header.menu,
      "h1 «" + header.title + "» · status «" + header.status + "» · refresh=" + header.refresh + " · menu=" + header.menu);

    await page.click('[data-testid="menu"]');
    await page.waitForSelector(".menu");
    const menu = await page.evaluate(function () {
      return {
        all: document.querySelectorAll(".menu-i").length,
        modes: Array.prototype.map.call(document.querySelectorAll(".menu-i[data-mode]"), function (e) { return e.getAttribute("data-mode"); }),
        others: Array.prototype.map.call(document.querySelectorAll(".menu-i[data-menu]"), function (e) { return e.getAttribute("data-menu"); })
      };
    });
    H.assert("header-menu-opens-with-2-mode-items-plus-4-more",
      menu.all === 6 && menu.modes.length === 2 && menu.others.length === 4 &&
      menu.modes.indexOf("simple") >= 0 && menu.modes.indexOf("full") >= 0,
      menu.all + " items: modes [" + menu.modes.join(",") + "] plus [" + menu.others.join(",") + "]");

    // ---------------------------------------------------------- 8. playbook and glossary from the menu

    await page.click('.menu-i[data-menu="guide"]');
    await page.waitForTimeout(250);
    const guide = await page.evaluate(function () {
      const root = document.querySelector(".mc-root");
      const s = root.querySelector('.section[data-section="lab-guide"]');
      return { tab: root.getAttribute("data-view"), open: s ? s.querySelector(".sec-h").getAttribute("aria-expanded") : null, chars: s ? s.innerText.trim().length : 0, menu: root.querySelectorAll(".menu").length };
    });
    H.assert("playbook-guide-renders-from-the-header-menu",
      guide.tab === "lab" && guide.open === "true" && guide.chars > 300 && guide.menu === 0,
      "tab=" + guide.tab + " open=" + guide.open + " " + guide.chars + " characters of guide text, menu closed=" + (guide.menu === 0));

    await page.click('[data-testid="menu"]');
    await page.click('.menu-i[data-menu="glossary"]');
    await page.waitForTimeout(250);
    const gloss = await page.evaluate(function () {
      const s = document.querySelector('.section[data-section="lab-gloss"]');
      return { open: s ? s.querySelector(".sec-h").getAttribute("aria-expanded") : null, rows: s ? s.querySelectorAll(".kv").length : 0, chars: s ? s.innerText.trim().length : 0 };
    });
    H.assert("glossary-renders-from-the-header-menu",
      gloss.open === "true" && gloss.rows >= 5 && gloss.chars > 150,
      "open=" + gloss.open + " " + gloss.rows + " glossary rows, " + gloss.chars + " characters");

    // ---------------------------------------------------------- 9. press feedback and reduced motion

    const active = await page.evaluate(function () {
      const hits = [];
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
        for (const rule of rules) {
          if (!rule.selectorText || rule.selectorText.indexOf(":active") < 0) continue;
          const tr = (rule.style && rule.style.transform ? rule.style.transform : "").replace(/\s+/g, "");
          if (!/scale\(0?\.97\)/.test(tr)) continue;
          const plain = rule.selectorText.split(",").map(function (s) { return s.replace(/:active/g, "").trim(); }).filter(Boolean);
          let matched = 0;
          plain.forEach(function (sel) { try { matched += document.querySelectorAll(sel).length; } catch (e) { /* skip */ } });
          hits.push({ sel: rule.selectorText.slice(0, 90), transform: tr, matched: matched });
        }
      }
      return hits;
    });
    const pressed = active.filter(function (h) { return h.matched > 0; });
    H.assert("press-feedback-active-scale-97-on-interactive-elements", pressed.length > 0,
      pressed.length ? pressed[0].transform + " on " + pressed[0].matched + " rendered elements via «" + pressed[0].sel + "»" : "no :active rule setting scale(.97) matched a rendered element");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(150);
    const reduced = await page.evaluate(function () {
      const els = Array.prototype.slice.call(document.querySelectorAll(".mc-root .btn, .mc-root .btn-sm, .mc-root .tabi, .mc-root .sec-h, .mc-root .reveal"));
      const bad = [];
      els.forEach(function (e) {
        const cs = getComputedStyle(e);
        const live = (cs.transitionDuration || "").split(",").concat((cs.animationDuration || "").split(","))
          .map(function (s) { return parseFloat(s) || 0; }).some(function (v) { return v > 0; });
        if (live) bad.push((e.getAttribute("class") || "") + " " + cs.transitionDuration + "/" + cs.animationDuration);
      });
      return { n: els.length, bad: bad };
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    H.assert("prefers-reduced-motion-kills-transitions", reduced.bad.length === 0,
      reduced.n + " interactive elements measured under the emulated media feature; still animating: " + (reduced.bad.length ? reduced.bad.slice(0, 3).join(" | ") : "none"));

    // ---------------------------------------------------------- 10. gwbar

    const gwbar = await page.evaluate(function () {
      const g = document.querySelector(".gwbar");
      if (!g) return null;
      const i = g.querySelector("i");
      return { pct: Number(g.getAttribute("data-pct")), aria: Number(g.getAttribute("aria-valuenow")), role: g.getAttribute("role"), width: i ? i.style.width : "" };
    });
    H.assert("gwbar-reports-cycle-progress-between-0-and-100",
      !!gwbar && isFinite(gwbar.pct) && gwbar.pct >= 0 && gwbar.pct <= 100 && gwbar.aria === gwbar.pct && gwbar.role === "progressbar" && gwbar.width === gwbar.pct + "%",
      gwbar ? "data-pct=" + gwbar.pct + " aria-valuenow=" + gwbar.aria + " bar width " + gwbar.width : "no .gwbar rendered");

    // ---------------------------------------------------------- 11. dead taps and the pool

    let disabled = [], blocks = null;
    for (const mode of ["full", "simple"]) {
      await fresh({ html: html, mode: mode, now: NOW });
      const tabs = mode === "full" ? TABS : ["command"];
      for (const t of tabs) {
        if (mode === "full") { await page.click('[data-testid="tab-' + t + '"]'); await page.waitForTimeout(100); await openAllSections(page); await page.waitForTimeout(120); }
        const r = await page.evaluate(function () {
          const sel = ".mc-root button, .mc-root input, .mc-root select, .mc-root textarea";
          const all = Array.prototype.slice.call(document.querySelectorAll(sel));
          return {
            total: all.length,
            dead: all.filter(function (e) { return e.disabled === true || e.getAttribute("aria-disabled") === "true"; })
              .map(function (e) { return e.getAttribute("data-testid") || e.getAttribute("class"); }),
            blocks: document.querySelectorAll(".block").length,
            confirms: document.querySelectorAll('[data-testid^="confirm-"]').length,
            squadCheck: (function () { const s = document.querySelector('.section[data-section="sq-confirm"]'); return s ? s.innerText.replace(/\s+/g, " ") : ""; })()
          };
        });
        disabled = disabled.concat(r.dead.map(function (d) { return mode + "/" + t + ":" + d; }));
        if (mode === "full" && t === "squad") blocks = r;
      }
    }
    H.assert("zero-dead-taps", disabled.length === 0,
      disabled.length ? disabled.join(", ") : "every rendered control across both modes and all " + TABS.length + " tabs was enabled");
    H.assert("pool-collapses-when-the-fifteen-is-complete",
      !!blocks && blocks.blocks === 0 && blocks.confirms === 0 && /matches the entry/.test(blocks.squadCheck),
      blocks ? blocks.blocks + " .block notices, " + blocks.confirms + " confirm controls; squad check reads «" + blocks.squadCheck.slice(0, 60) + "»" : "squad tab not measured");

    // ---------------------------------------------------------- 12. refbar (E-018: mock a 400, a 500 is retried)

    await fresh({
      html: html, mode: "full", now: NOW,
      mocks: {
        "https://fantasy.premierleague.com/**": function (route) { return route.abort(); },
        "https://api.anthropic.com/**": async function (route) {
          await new Promise(function (r) { setTimeout(r, 700); });
          return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "smoke: deliberate 400" } }) });
        }
      }
    });
    const beforeRefresh = await landingText(page);
    await page.click('[data-testid="refresh"]');
    let sawBar = false;
    try {
      await page.waitForSelector(".refbar", { timeout: 5000 });
      sawBar = true;
    } catch (e) { sawBar = false; }
    H.assert("refbar-appears-while-a-refresh-is-pending", sawBar, sawBar ? ".refbar rendered after clicking the header refresh" : ".refbar never appeared within 5s");

    let cleared = false;
    try {
      await page.waitForFunction(function () { return document.querySelectorAll(".refbar").length === 0; }, null, { timeout: 20000 });
      cleared = true;
    } catch (e) { cleared = false; }
    const after400 = await page.evaluate(function () {
      const e = document.querySelector('[data-testid="err"]');
      return { err: e ? e.innerText.replace(/\s+/g, " ").slice(0, 120) : null, bars: document.querySelectorAll(".refbar").length };
    });
    const afterRefresh = await landingText(page);
    H.assert("E018-refbar-clears-after-a-400-and-the-snapshot-is-unchanged",
      cleared && after400.bars === 0 && !!after400.err && /400/.test(after400.err) && afterRefresh === beforeRefresh,
      "cleared=" + cleared + " bars=" + after400.bars + " error «" + after400.err + "» landing unchanged=" + (afterRefresh === beforeRefresh));

    // ---------------------------------------------------------- 13. persistence (E-002 / E-022)

    // No seeded mc_ui: the harness rewrites its seed on every navigation, so the only
    // honest way to test a reload is to let the app write its own.
    await fresh({ html: html, now: NOW });
    await page.click('[data-testid="menu"]');
    await page.click('.menu-i[data-mode="full"]');
    await page.waitForTimeout(200);
    await page.click('[data-testid="tab-rivals"]');
    await page.waitForTimeout(150);
    await page.click('[data-testid="sec-rv-own"]');
    await page.click('[data-testid="sec-rv-table"]');
    await page.waitForTimeout(150);
    await page.click('[data-testid="tab-command"]');
    await page.waitForTimeout(150);
    await page.click('[data-testid="rev-ld-why"]');
    await page.waitForTimeout(150);
    await page.click('[data-testid="tab-rivals"]');
    await page.waitForTimeout(300);
    const snapBefore = await page.evaluate(function () {
      const root = document.querySelector(".mc-root");
      return {
        mode: root.getAttribute("data-mode"), tab: root.getAttribute("data-view"),
        secs: Array.prototype.map.call(root.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section") + ":" + s.querySelector(".sec-h").getAttribute("aria-expanded"); })
      };
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".mc-root");
    await page.waitForTimeout(700);
    const snapAfter = await page.evaluate(function () {
      const root = document.querySelector(".mc-root");
      return {
        mode: root.getAttribute("data-mode"), tab: root.getAttribute("data-view"),
        secs: Array.prototype.map.call(root.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section") + ":" + s.querySelector(".sec-h").getAttribute("aria-expanded"); })
      };
    });
    await page.click('[data-testid="tab-command"]');
    await page.waitForTimeout(250);
    const revAfter = await page.getAttribute('[data-testid="rev-ld-why"]', "aria-expanded");
    H.assert("E002-E022-saved-tab-and-open-sections-survive-a-reload",
      snapAfter.mode === "full" && snapAfter.tab === "rivals" && snapAfter.secs.join(",") === snapBefore.secs.join(","),
      "before " + snapBefore.mode + "/" + snapBefore.tab + " [" + snapBefore.secs.join(" ") + "] · after " + snapAfter.mode + "/" + snapAfter.tab + " [" + snapAfter.secs.join(" ") + "]");
    H.assert("reveals-survive-a-reload", revAfter === "true", "rev-ld-why aria-expanded after reload = " + revAfter);

    /* iOS 27, IOS27-04 (E-135): the artifact's storage is text only, and the harness's window.storage now refuses anything
       else with a TypeError and counts it. After a session of saves and a reload the count is 0, the first save was read back
       (data-store names the copy an artifact's), and neither storage note is on screen. The seeds the harness writes are
       objects, the copy an older build saved, so every test that seeds state also proves an old object still loads. */
    {
      const st = await page.evaluate(function () {
        const r = document.querySelector(".mc-root");
        return { refused: window.__STORAGE_NONTEXT__, store: r ? r.getAttribute("data-store") : null, notes: document.querySelectorAll('[data-testid="store-none"], [data-testid="store-err"]').length };
      });
      H.assert("IOS27-04-the-app-writes-text-only-to-window-storage-and-reads-its-first-save-back",
        st.refused === 0 && st.store === "artifact" && st.notes === 0,
        "non-string set() calls refused " + st.refused + ", data-store " + JSON.stringify(st.store) + ", storage notes on screen " + st.notes);
    }

    // v110 D1 · the Command tab's dated checklist (cmd-next): a tap ticks an item, the tick is written with the state
    // through window.storage (state.done, "<gameweek>:<item>") and it survives a reload. The item is read off the page.
    {
      await fresh({ html: html, mode: "full", now: NOW, ui: { mode: "full", tab: "command", open: { "cmd-next": true }, reveals: {} } });
      let first = null;
      try {
        await page.waitForSelector('[data-testid="cmd-todo"] .todo', { timeout: 10000 });
        first = await page.evaluate(function () { const b = document.querySelector('[data-testid="cmd-todo"] .todo'); return b ? { id: b.getAttribute("data-todo"), pressed: b.getAttribute("aria-pressed") } : null; });
      } catch (e) { first = null; }
      const sel = first ? '[data-testid="cmd-todo"] .todo[data-todo="' + first.id + '"]' : "";
      const t0 = Date.now();
      let flipped = false;
      if (first) {
        await page.click(sel);
        try {
          await page.waitForFunction(function (s) { const b = document.querySelector(s); return !!b && b.getAttribute("aria-pressed") === "true"; }, sel, { timeout: 10000 });
          flipped = true;
        } catch (e) { flipped = false; }
      }
      const tickMs = Date.now() - t0;
      await page.waitForTimeout(300);
      const stored = await page.evaluate(function () {
        try { const s = JSON.parse(window.localStorage.getItem("mc_state")); return s && s.done && typeof s.done === "object" ? Object.keys(s.done).filter(function (k) { return s.done[k] === true; }) : []; }
        catch (e) { return null; }
      });
      let after = null;
      if (first) {
        await page.reload({ waitUntil: "load" });
        await page.waitForSelector(".mc-root");
        try { await page.waitForSelector(sel, { timeout: 10000 }); after = await page.getAttribute(sel, "aria-pressed"); } catch (e) { after = null; }
      }
      const key = first && Array.isArray(stored) ? stored.filter(function (k) { return /^\d+:[a-z]+$/.test(k) && k.slice(k.indexOf(":") + 1) === first.id; })[0] : null;
      H.assert("D1-a-checklist-tick-is-saved-with-the-state-and-survives-a-reload",
        !!first && first.pressed === "false" && flipped && !!key && after === "true",
        first ? "item " + first.id + " was " + first.pressed + ", after the tap " + (flipped ? "true" : "not true") + " in " + tickMs + " ms; stored ticks [" + (stored || []).join(",") + "]; after a reload " + after
          : "no checklist item rendered in cmd-next");
      console.log("(measured: checklist tick " + tickMs + " ms from tap to aria-pressed on " + (first ? first.id : "?") + ")");
    }

    // ---------------------------------------------------------- 14. the LIVE window

    await fresh({ html: htmlLive, mode: "full", now: LIVE_NOW });
    const liveLanding = await landingText(page);
    const livePts = (liveLanding.replace(/\s+/g, " ").match(/(-?\d+) points so far/) || [])[1];
    H.assert("LIVE-window-landing-shows-live-points-and-no-transfer-instruction",
      /Matches are running/.test(liveLanding) && livePts !== undefined && isFinite(Number(livePts)) &&
      !/Play Wildcard/.test(liveLanding) && !/\bSell\b/.test(liveLanding) && !/\bBuy\b/.test(liveLanding),
      "landing at " + LIVE_NOW + ": «" + liveLanding.replace(/\s+/g, " ").slice(0, 110) + "»");

    await page.click('[data-testid="tab-plan"]');
    await page.waitForTimeout(150);
    await openAllSections(page);
    await page.waitForTimeout(200);
    const livePlan = await page.evaluate(function () {
      const out = {};
      Array.prototype.forEach.call(document.querySelectorAll(".section"), function (s) {
        out[s.getAttribute("data-section")] = { text: s.innerText.replace(/\s+/g, " "), rows: s.querySelectorAll(".sec-b .row").length };
      });
      return out;
    });
    const txPanels = ["plan-tx", "plan-wc", "plan-fb"];
    const stillOpen = txPanels.filter(function (id) { return !livePlan[id] || !/Matches are running/.test(livePlan[id].text) || livePlan[id].rows > 0; });
    H.assert("LIVE-window-hides-every-transfer-panel", stillOpen.length === 0,
      stillOpen.length ? stillOpen.map(function (id) { return id + " «" + livePlan[id].text.slice(0, 70) + "»"; }).join("; ")
        : txPanels.join(", ") + " all show the whistle note and render no move rows");

    // The regression the fix closes: the snapshot still says current_event 3 (a Friday
    // pull) while GW4 is being played, so the window has to come from the clock.
    await fresh({ html: html, mode: "full", now: LIVE_NOW });
    const staleLanding = await landingText(page);
    H.assert("LIVE-window-is-keyed-on-the-clock-not-on-the-snapshot-current_event",
      /Matches are running/.test(staleLanding) && !/Play Wildcard/.test(staleLanding),
      "shipped snapshot has current_event " + LIVE.current_event + " and next_event " + LIVE.next_event +
      "; at " + LIVE_NOW + " the landing reads «" + staleLanding.replace(/\s+/g, " ").slice(0, 90) + "»");

    // ---------------------------------------------------------- 15. copy once the deadline has passed
    //
    // hoursText returned the bare word "closed" and every call site appended its own suffix,
    // so from 12:30Z on the Saturday the header read "closed to deadline" and the landing
    // "closed left, nobody flagged". Every countdown phrase is complete at its call site now.

    // 13:00Z on the Saturday is inside the live window, so the landing shows live points and
    // only the header prints a countdown; 09:00Z on the Tuesday is past the last kick-off, so
    // the landing is back and prints one too. Both times are walked, on every tab in TABS.
    // Derived from the snapshot (E-084): just after the next deadline, which is inside the live
    // window, and then past the last kick-off of that gameweek, where the landing comes back.
    const POST_DEADLINE = [isoAt(NEXT_DL + 3 * 3600000), isoAt(NEXT_LAST_KO + 14 * 3600000)];
    const brokenCopy = [];
    const headerPost = {};
    let lateLanding = "";
    for (const when of POST_DEADLINE) {
      await fresh({ html: html, mode: "full", now: when });
      for (const t of TABS) {
        await page.click('[data-testid="tab-' + t + '"]');
        await page.waitForFunction(function (id) { const r = document.querySelector(".mc-root"); return r && r.getAttribute("data-view") === id; }, t, { timeout: 10000 });
        await openAllSections(page);
        await page.waitForTimeout(160);
        const seen = await page.evaluate(function () {
          const root = document.querySelector(".mc-root");
          const st = root.querySelector('[data-testid="status"]');
          return { text: root.innerText.replace(/\s+/g, " "), status: st ? st.innerText.replace(/\s+/g, " ") : "" };
        });
        headerPost[when] = seen.status;
        const m = seen.text.match(/closed (to deadline|left)/i);
        if (m) brokenCopy.push(when + " " + t + " «" + seen.text.slice(Math.max(0, seen.text.indexOf(m[0]) - 40), seen.text.indexOf(m[0]) + 44) + "»");
      }
      if (when === POST_DEADLINE[1]) {
        // The tab loop ends on Lab; the landing only renders on Command in full mode.
        await page.click('[data-testid="tab-command"]');
        await page.waitForTimeout(200);
        lateLanding = (await landingText(page)).replace(/\s+/g, " ");
      }
    }
    H.assert("no-half-sentence-copy-once-the-deadline-has-passed", brokenCopy.length === 0,
      brokenCopy.length ? brokenCopy.join(" | ")
        : "neither " + POST_DEADLINE.join(" nor ") + " rendered \"closed to deadline\" or \"closed left\" on any of the " + TABS.length + " tabs");
    H.assert("the-header-says-the-deadline-is-closed-in-a-whole-phrase",
      POST_DEADLINE.every(function (w) { return /deadline closed/.test(headerPost[w] || ""); }),
      POST_DEADLINE.map(function (w) { return w + " «" + (headerPost[w] || "") + "»"; }).join(" · "));
    H.assert("the-landing-deadline-panel-reads-as-a-sentence-after-the-deadline",
      /closed, (nobody flagged|\d+ flagged)/.test(lateLanding),
      "landing at " + POST_DEADLINE[1] + ": «" + lateLanding.slice(0, 150) + "»");

    // ---------------------------------------------------------- 15. D3 block (E-012)

    const squad = LIVE.picks[String(LIVE.current_event)].picks.map(function (p) { return p.element; });
    const mismatched = squad.slice(0, 14).concat([GAKPO]);
    const d3state = {
      version: 87, exported_at: null, entry: 3546875,
      squad: mismatched.map(function (id) { return { id: id, purchase: null }; }),
      bank: 0, ft: 3, value: 1000, confirmed_gw: 2, leagues: [],
      draft: { league_id: null, roster: [], watchlist: [] },
      ui: { mode: "full", tab: "command", open: {}, reveals: {} }, ledger: [],
      refresh: { pair: "sonnet46", last: null }
    };
    await fresh({ html: html, mode: "full", state: d3state, now: NOW });
    const d3landing = await landingText(page);
    const guarded = { plan: ["plan-tx", "plan-wc", "plan-cap", "plan-xi", "plan-time", "plan-fb"], rivals: ["rv-buys", "rv-cap", "rv-sim"], chips: ["ch-now", "ch-regret"] };
    const unblocked = [];
    for (const t of Object.keys(guarded)) {
      await page.click('[data-testid="tab-' + t + '"]');
      await page.waitForTimeout(120);
      await openAllSections(page);
      await page.waitForTimeout(150);
      const r = await page.evaluate(function (ids) {
        return ids.map(function (id) {
          const s = document.querySelector('.section[data-section="' + id + '"]');
          return { id: id, block: !!(s && s.querySelector(".block")), confirm: !!(s && s.querySelector('[data-testid^="confirm-"]')), rows: s ? s.querySelectorAll(".sec-b .row").length : -1 };
        });
      }, guarded[t]);
      r.forEach(function (x) { if (!x.block || !x.confirm || x.rows > 0) unblocked.push(t + "/" + x.id + " block=" + x.block + " confirm=" + x.confirm + " rows=" + x.rows); });
    }
    H.assert("E012-D3-a-squad-that-differs-from-the-entry-picks-blocks-the-landing",
      /Confirm the squad first/.test(d3landing) && /differ/.test(d3landing) && !/Play Wildcard/.test(d3landing),
      "landing «" + d3landing.replace(/\s+/g, " ").slice(0, 110) + "»");
    H.assert("E012-D3-every-recommendation-panel-is-suppressed-until-confirmed", unblocked.length === 0,
      unblocked.length ? unblocked.join("; ") : "11 guarded panels (plan x6, rivals x3, chips x2) all showed the block notice, a confirm button and no recommendation rows");

    await page.click('[data-testid="tab-plan"]');
    await page.waitForTimeout(150);
    await page.click('[data-testid="confirm-plan-tx"]');
    await page.waitForTimeout(500);
    const afterConfirm = await page.evaluate(function () {
      const s = document.querySelector('.section[data-section="plan-tx"]');
      return { blocks: document.querySelectorAll(".block").length, rows: s ? s.querySelectorAll(".sec-b .row").length : -1, text: s ? s.innerText.replace(/\s+/g, " ").slice(0, 80) : "" };
    });
    H.assert("E012-D3-confirming-the-API-squad-clears-the-block",
      afterConfirm.blocks === 0 && afterConfirm.rows > 0,
      afterConfirm.blocks + " blocks left, plan-tx renders " + afterConfirm.rows + " move rows: «" + afterConfirm.text + "»");

    // ---------------------------------------------------------- E-060 the lock drives the answer everywhere

    {
      const lockShots = {};
      for (const locked of [false, true]) {
        const lc = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const lp = await lc.newPage();
        await H.open(lp, {
          mode: "full", tab: "command", now: NOW, html: html,
          ui: { mode: "full", tab: "command", open: {}, reveals: locked ? { "wc-lock": true } : {} }
        });
        lockShots[locked ? "locked" : "pure"] = await lp.evaluate(function () {
          const l = document.querySelector(".landing");
          const names = l ? l.querySelector(".names") : null;
          const t = l ? l.innerText : "";
          const m = t.match(/Captain\s+([^,]+),\s*vice\s+([^.]+)\./);
          return {
            fifteen: names ? names.innerText.replace(/\s+/g, " ").trim() : "",
            captain: m ? m[1].trim() : "",
            vice: m ? m[2].trim() : "",
            words: t.trim().split(/\s+/).length,
            plan: l ? l.getAttribute("data-plan") || "" : ""
          };
        });
        await lc.close();
      }
      // E-114 (v110 D1): the unlocked landing is the solved card when PLAN and PRE share a hash, so the app's own unlocked
      // card is read too, on a page with one typed price (withPrice): the lock must still change the app's own fifteen,
      // and it must set the solved card aside.
      {
        const lc = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const lp = await lc.newPage();
        await H.open(lp, { mode: "full", tab: "command", now: NOW, html: html, state: STATE_PRICE, ui: { mode: "full", tab: "command", open: {}, reveals: {} } });
        lockShots.app = await lp.evaluate(function () {
          const l = document.querySelector(".landing");
          const names = l ? l.querySelector(".names") : null;
          const t = l ? l.innerText : "";
          const m = t.match(/Captain\s+([^,]+),\s*vice\s+([^.]+)\./);
          return { fifteen: names ? names.innerText.replace(/\s+/g, " ").trim() : "", captain: m ? m[1].trim() : "", vice: m ? m[2].trim() : "",
            words: t.trim().split(/\s+/).length, plan: l ? l.getAttribute("data-plan") || "" : "" };
        });
        await lc.close();
      }
      const a = lockShots.pure, b = lockShots.locked, c = lockShots.app;
      H.assert("locking-the-premiums-changes-the-landing-fifteen-and-keeps-a-captain",
        !!STATE_PRICE && c.plan === "app" && b.plan === "app" && c.fifteen !== "" && b.fifteen !== "" && c.fifteen !== b.fifteen && a.fifteen !== b.fifteen &&
          a.captain !== "" && a.captain !== "\u2014" && b.captain !== "" && b.captain !== "\u2014" && c.captain !== "" && c.captain !== "\u2014" &&
          b.vice !== "" && b.vice !== "\u2014" && a.words < 110 && b.words < 110 && c.words < 110,
        "unlocked (" + a.plan + " card): captain " + a.captain + ", vice " + a.vice + ", " + a.words + " words · the app's own unlocked card: captain " + c.captain +
          ", " + c.words + " words · locked (" + b.plan + " card): captain " + b.captain + ", vice " + b.vice + ", " + b.words + " words · the app's own two fifteens " +
          (c.fifteen === b.fifteen ? "are identical (the lock did nothing)" : "differ") + ", the landing's " + (a.fifteen === b.fifteen ? "does not move" : "moves"));
    }

    // ---------------------------------------------------------- F4 / F5 / F8 caveat panels

    // Part F: every roadmap item ships with a UI caveat, and the caveat is a test gate like any
    // other. Each number below is compared against the engine's own answer, never a literal.
    await fresh({ html: html, mode: "full", ui: { mode: "full", tab: "lab", open: {}, reveals: {} }, now: NOW });
    await page.click('[data-testid="sec-lab-minutes"]');
    await page.waitForSelector('[data-section="lab-minutes"] .sec-b .row', { timeout: 20000 });
    await page.click('[data-testid="rev-lab-min-terms"]');
    await page.click('[data-testid="rev-lab-min-rel"]');
    const minPanel = await page.evaluate(function () {
      const sec = document.querySelector('[data-section="lab-minutes"] .sec-b');
      return sec ? sec.innerText : "";
    });
    const mwfLive = ENG.minutesWalkForward(LIVE, { bins: 5 });
    const lastFit = mwfLive.folds.filter(function (f) { return f.fitted; }).slice(-1)[0];
    H.assert("F4-the-lab-panel-prints-the-engine's-own-Brier-scores-and-names-the-driver",
      !!lastFit &&
      minPanel.indexOf(lastFit.incumbent.brier.toFixed(4)) >= 0 &&
      minPanel.indexOf(lastFit.challenger.brier.toFixed(4)) >= 0 &&
      /Driving P\(start\)[\s\S]{0,40}Laplace/.test(minPanel) &&
      /minutes logistic/i.test(minPanel),
      "panel shows Laplace " + (lastFit ? lastFit.incumbent.brier.toFixed(4) : "—") + " and logistic " +
        (lastFit ? lastFit.challenger.brier.toFixed(4) : "—") + " for GW" + (lastFit ? lastFit.from + "→" + lastFit.to : "?") +
        "; first 160 chars: " + minPanel.slice(0, 160).replace(/\n/g, " | "));
    // E-084: the last clause was /the gate needs 3/, which is what the engine's note says while
    // the gate is SHUT. Five finished gameweeks opened it, and the panel correctly stopped
    // saying that. The panel must state the gate's own verdict, whichever way it has gone.
    const gateOpen = mwfLive.gate.promotable === true;
    const gateWording = gateOpen ? /(gate|promot)/i.test(minPanel) : /the gate needs 3/i.test(minPanel);
    H.assert("F4-the-lab-panel-says-the-flag-and-the-European-load-were-not-fitted",
      /flag/i.test(minPanel) && /european load/i.test(minPanel) &&
      /not a status per gameweek/i.test(minPanel) && /Premier League/i.test(minPanel) && gateWording,
      "the two declared-but-unfitted terms are named; the walk-forward gate is " + (gateOpen ? "OPEN" : "shut") +
      " (" + mwfLive.comparable + " fittable transitions, " + mwfLive.wins + " won, hold-out " + mwfLive.holdout +
      ") and the panel " + (gateWording ? "states it" : "does NOT state it"));
    H.assert("F4-the-reliability-curve-prints-what-it-said-against-what-happened",
      /said/i.test(minPanel) && /happened/i.test(minPanel) &&
      minPanel.indexOf(Math.round(lastFit.challenger.reliability.bins[0].meanPred * 100) + "%") >= 0,
      "five bins, the first forecasting " + Math.round(lastFit.challenger.reliability.bins[0].meanPred * 100) + "%");

    await page.click('[data-testid="sec-lab-tour"]');
    await page.waitForSelector('[data-section="lab-tour"] .sec-b .row', { timeout: 20000 });
    const tourPanel = await page.evaluate(function () {
      const sec = document.querySelector('[data-section="lab-tour"] .sec-b');
      return sec ? sec.innerText : "";
    });
    const tourLive = ENG.tournament(LIVE);
    const pxg = tourLive.models.filter(function (m) { return m.key === "player_xg"; })[0];
    H.assert("F5-the-tournament-panel-carries-the-ninth-model-and-promotes-nothing",
      /Player xG/.test(tourPanel) &&
      tourPanel.indexOf(pxg.spearman.toFixed(2)) >= 0 &&
      /Promotable[\s\S]{0,20}not yet/i.test(tourPanel) &&
      /promotes nothing/i.test(tourPanel) &&
      tourLive.models.every(function (m) { return m.promotable === false; }),
      "player_xg ρ " + pxg.spearman.toFixed(4) + " leading " + pxg.wins + " of " + tourLive.transitions +
        " transitions, promotable " + pxg.promotable + "; the panel says promotable " +
        (/not yet/i.test(tourPanel) ? "not yet" : "SOMETHING ELSE"));

    await page.click('[data-testid="tab-chips"]');
    await page.click('[data-testid="sec-ch-solver"]');
    await page.waitForSelector('[data-section="ch-solver"] .sec-b .kv', { timeout: 30000 });
    await page.click('[data-testid="rev-ch-solver-how"]');
    const chipPanel = await page.evaluate(function () {
      const sec = document.querySelector('[data-section="ch-solver"] .sec-b');
      return sec ? sec.innerText : "";
    });
    const solveLive = ENG.chipSolver(ENG.buildCtx(LIVE, null, NOW), {});
    const benchBoosted = solveLive.plan.filter(function (a) { return a.chip !== "WC"; });
    H.assert("F8-the-chip-panel-says-no-window-is-confirmed-and-assigns-no-bench-boost",
      /No window is confirmed yet/.test(chipPanel) &&
      /Confirmed windows[\s\S]{0,20}none/i.test(chipPanel) &&
      chipPanel.indexOf("BB") < 0 && chipPanel.indexOf("TC") < 0 && chipPanel.indexOf("FH") < 0 &&
      benchBoosted.length === 0 && solveLive.confirmed === false,
      "engine: " + solveLive.doubles.length + " doubles, " + solveLive.blanks.length + " blanks, plan " +
        (solveLive.plan.map(function (a) { return a.chip + " GW" + a.event; }).join(", ") || "empty") +
        "; panel first 140 chars: " + chipPanel.slice(0, 140).replace(/\n/g, " | "));
    H.assert("F8-the-chip-panel-states-both-set-expiries-and-the-Free-Hit-upper-bound",
      /Set one[\s\S]{0,40}GW19/.test(chipPanel) && /Set two[\s\S]{0,40}GW20 to GW38/.test(chipPanel) &&
      /upper bound/i.test(chipPanel) && /never two chips in one gameweek/i.test(chipPanel),
      "set one to the GW19 deadline, set two GW20 to GW38, the Free Hit labelled an upper bound and the one-chip-a-gameweek rule stated");

    // ---------------------------------------------------------- v89 the PWA must not cost the file:// mode

    /* dist/index.html gained a manifest link and a service-worker registration in v89, and the
       way this app is actually opened today is from a file:// URL — where a registration
       rejects, and on some engines throws synchronously. The protocol guard is what keeps that
       mode alive, so this check boots the SHIPPED file exactly as the manager does, with a spy
       over navigator.serviceWorker.register, and reads what the guard decided. The same boot is
       re-measured under WebKit in qa/webkit.js, because Safari is the target device. */
    {
      const pc = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const pp = await pc.newPage();
      const pwaErrs = [];
      pp.on("pageerror", function (e) { pwaErrs.push(String(e && e.message ? e.message : e)); });
      pp.on("console", function (m) {
        if (m.type() !== "error") return;
        const t = m.text();
        if (/Failed to load resource/i.test(t) || /net::ERR_/.test(t) || /[Mm]anifest/.test(t)) return;
        pwaErrs.push("console: " + t);
      });
      await pp.addInitScript(H.SW_SPY);
      await pp.goto("file://" + DIST, { waitUntil: "load" });
      await pp.waitForSelector(".mc-root", { timeout: 25000 });
      const pwa = await pp.evaluate(function () {
        const r = document.querySelector(".mc-root");
        const meta = document.querySelector('meta[name="theme-color"]');
        let store = false;
        try { localStorage.setItem("mc_probe", "1"); store = localStorage.getItem("mc_probe") === "1"; localStorage.removeItem("mc_probe"); } catch (e) { store = false; }
        return {
          state: window.__PWA__ ? String(window.__PWA__.sw) : "no __PWA__ on the page",
          protocol: window.__PWA__ ? String(window.__PWA__.protocol) : "",
          calls: (window.__SWCALLS__ || []).slice(),
          spyErr: window.__SWSPY_ERR__ || "",
          manifest: !!document.querySelector('link[rel="manifest"]'),
          appleIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
          theme: meta ? String(meta.getAttribute("content")) : "",
          landing: !!r.querySelector(".landing"),
          boundary: r.querySelectorAll(".boundary").length,
          store: store
        };
      });
      await pc.close();
      H.assert("PWA-the-shipped-file-still-boots-from-a-file-url-with-no-service-worker-exception",
        pwa.landing && pwa.boundary === 0 && pwa.state === "skipped-not-http" && pwa.calls.length === 0 &&
          pwaErrs.length === 0 && pwa.store,
        "file://" + DIST + " → landing " + pwa.landing + ", boundaries " + pwa.boundary + ", protocol " +
          pwa.protocol + ", __PWA__.sw " + pwa.state + ", register() calls " + JSON.stringify(pwa.calls) +
          ", localStorage writable " + pwa.store + ", page errors " +
          (pwaErrs.length ? pwaErrs.slice(0, 2).join(" | ") : "none"));
      H.assert("PWA-the-shipped-page-links-the-manifest-the-apple-icon-and-the-theme-colour",
        pwa.manifest && pwa.appleIcon && /^#[0-9a-fA-F]{6}$/.test(pwa.theme),
        "manifest link " + pwa.manifest + ", apple-touch-icon " + pwa.appleIcon + ", theme-color " +
          (pwa.theme || "absent"));
    }

    // ---------------------------------------------------------- close

    console.log("(measured: landing " + simpleWords + " words / " + (simple ? simple.panels : "?") + " panels · tab words " +
      TABS.map(function (t) { return t + " " + tabWords[t]; }).join(" ") + ")");
    console.log("(measured: type floor " + minFont.px + "px on " + minFont.sel + " · touch floors " +
      Object.keys(FLOORS).map(function (k) { return k + " " + (floorMin[k].min === null ? "n/a" : floorMin[k].min.toFixed(1)); }).join(" ") + ")");
    H.assert("no-uncaught-page-errors-during-the-suite", pageErrors.length === 0,
      pageErrors.length ? pageErrors.slice(0, 3).join(" | ") : "no pageerror and no console error in " + "any of the runs above");
  } finally {
    await browser.close();
  }

  return H.done("smoke");
}

main().catch(function (e) {
  H.assert("smoke-suite-ran-to-completion", false, e && e.message ? e.message : String(e));
  H.done("smoke");
});

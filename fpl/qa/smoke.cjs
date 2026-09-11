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
const LIVE = require(path.join(ROOT, "data", "live.json"));

const NOW = "2026-09-11T08:00:00Z";                 // Friday before the GW4 deadline
const LIVE_NOW = "2026-09-12T15:00:00Z";            // GW4 deadline 12:30Z, last kick-off 14 Sep 19:00Z
const TABS = ["command", "plan", "squad", "rivals", "draft", "chips", "lab"];
const PRIMARY = { command: "cmd-stand", plan: "plan-tx", squad: "sq-fifteen", rivals: "rv-table", draft: "df-waivers", chips: "ch-now", lab: "lab-data" };
const TOKENS = ["--amb", "--bg", "--bg2", "--bg3", "--blu", "--cyn", "--dim", "--err", "--focus", "--grn", "--grn2", "--line", "--mute", "--ok", "--pnk", "--pnk2", "--pur", "--shadow", "--text", "--warn", "--wht"];
const FLOORS = { ".btn": 38, ".btn-sm": 32, ".tabi": 52, ".sec-h": 48, ".menu-i": 44, ".inp": 40, ".row": 38 };
const GAKPO = 367;

// ---------------------------------------------------------------- small helpers

function words(s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length; }

function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

/* The snapshot with Gakpo's flag lifted and nothing else touched: the control half of
   the "a flag is what excludes him" pair. */
function unflaggedGakpo() {
  const live = deepCopy(LIVE);
  const el = live.elements.filter(function (e) { return e.id === GAKPO; })[0];
  el.status = "a"; el.chance = null; el.news = "";
  return live;
}

/* The snapshot as it would look with GW4 under way: the same data, plus the live rows
   and picks the API serves once the deadline has passed. Nothing else is changed, so
   current_event stays 3 exactly as a Friday snapshot has it. */
function gw4Running() {
  const live = deepCopy(LIVE);
  const picks = live.picks["3"].picks;
  const rows = {};
  picks.forEach(function (p, i) { rows[p.element] = [90, 1, (i % 5) + 2, 0.2, 0.1, 0.8, 9, 20, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; });
  live.gw["4"] = { elements: rows, fixture_xg: {} };
  live.picks["4"] = { active_chip: null, picks: picks };
  return live;
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
  const htmlCtrl = H.buildPage({ inlineData: unflaggedGakpo() });
  const htmlLive = H.buildPage({ inlineData: gw4Running() });
  const browser = await H.launch();

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
        text: (function () { const l = root.querySelector(".landing"); return l ? l.innerText : ""; })()
      };
    });
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
        mode: root.getAttribute("data-mode"), tab: root.getAttribute("data-tab"),
        landing: !!root.querySelector(".landing"), boundary: root.querySelectorAll(".boundary").length,
        firstIsLanding: !!first && first.classList.contains("landing"),
        beforeSections: !sec || !!(first && (first.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING)),
        tabs: root.querySelectorAll(".tabi").length,
        cardHtml: (function () { const l = root.querySelector(".landing"); return l ? l.innerHTML : ""; })()
      };
    });
    H.assert("full-mode-renders", !!full && full.landing && full.boundary === 0 && full.mode === "full" && full.tabs === 7,
      full ? "landing=" + full.landing + " boundary=" + full.boundary + " tabs=" + full.tabs : "no .mc-root");
    H.assert("full-mode-landing-is-the-first-card-in-mc-root", !!full && full.firstIsLanding && full.beforeSections,
      full ? "firstIsLanding=" + full.firstIsLanding + " beforeSections=" + full.beforeSections : "no page");
    H.assert("E022-both-modes-share-GwActionCard", !!simple && !!full && simple.cardHtml.length > 0 && simple.cardHtml === full.cardHtml,
      "simple " + (simple ? simple.cardHtml.length : -1) + " chars, full " + (full ? full.cardHtml.length : -1) + " chars, identical=" + (!!simple && !!full && simple.cardHtml === full.cardHtml));

    // ---------------------------------------------------------- 2. per-tab first paint

    const tabWords = {}, tabSecs = {};
    for (const t of TABS) {
      await page.click('[data-testid="tab-' + t + '"]');
      await page.waitForFunction(function (id) { const r = document.querySelector(".mc-root"); return r && r.getAttribute("data-tab") === id; }, t, { timeout: 10000 });
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

    const ctrlPage = await fresh({ html: htmlCtrl, mode: "simple", now: NOW });
    const ctrlText = await landingText(ctrlPage);
    const realText = simple ? simple.text : "";
    const ctrlHas = /Gakpo/.test(ctrlText);
    const ctrlCaptain = /Captain\s+Gakpo/.test(ctrlText.replace(/\n/g, " "));
    const realHas = /Gakpo/.test(realText);
    H.assert("C1-flagged-player-is-absent-from-the-recommendation",
      ctrlHas && !realHas,
      "control snapshot (id 367 status a, chance null, nothing else changed) names him in the fifteen = " + ctrlHas +
      "; shipped snapshot (status d, chance 75) names him = " + realHas);
    H.assert("C1-flagged-player-is-never-captain-nor-vice",
      ctrlCaptain && !/Captain\s+Gakpo/.test(realText.replace(/\n/g, " ")) && !/vice\s+Gakpo/.test(realText.replace(/\n/g, " ")),
      "control captains him = " + ctrlCaptain + "; shipped captain line = " + (realText.replace(/\n/g, " ").match(/Captain [^.]*\./) || ["none"])[0]);

    // ---------------------------------------------------------- 4. type floor and touch floors

    await fresh({ html: html, mode: "full", now: NOW });
    let minFont = { px: 999, sel: "(nothing measured)" };
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
        return { mn: mn, fl: fl };
      }, FLOORS);
      if (r.mn.px < minFont.px) minFont = { px: r.mn.px, sel: r.mn.sel + " on " + label };
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

    // ---------------------------------------------------------- 6. tabs and horizontal scroll

    const tabGeom = await page.evaluate(function () {
      const t = Array.prototype.map.call(document.querySelectorAll(".tabi"), function (e) {
        return { id: e.getAttribute("data-tab"), testid: e.getAttribute("data-testid"), aria: e.getAttribute("aria-label"), w: Math.round(e.getBoundingClientRect().width * 10) / 10 };
      });
      return t;
    });
    const widths = tabGeom.map(function (t) { return t.w; });
    const spread = widths.length ? Math.max.apply(null, widths) - Math.min.apply(null, widths) : 999;
    H.assert("seven-equal-width-icon-tabs",
      tabGeom.length === 7 && spread <= 1 &&
      tabGeom.every(function (t, i) { return t.id === TABS[i] && t.testid === "tab-" + TABS[i] && !!t.aria; }),
      tabGeom.length + " tabs [" + tabGeom.map(function (t) { return t.id + " " + t.w + "px"; }).join(", ") + "], width spread " + spread.toFixed(1) + "px");

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
      scrolls.length ? scrolls.join("; ") : "14 measurements (2 widths x 7 tabs), scrollWidth never exceeded clientWidth");

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
      return { tab: root.getAttribute("data-tab"), open: s ? s.querySelector(".sec-h").getAttribute("aria-expanded") : null, chars: s ? s.innerText.trim().length : 0, menu: root.querySelectorAll(".menu").length };
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
      disabled.length ? disabled.join(", ") : "every rendered control across both modes and all seven tabs was enabled");
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
        mode: root.getAttribute("data-mode"), tab: root.getAttribute("data-tab"),
        secs: Array.prototype.map.call(root.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section") + ":" + s.querySelector(".sec-h").getAttribute("aria-expanded"); })
      };
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".mc-root");
    await page.waitForTimeout(700);
    const snapAfter = await page.evaluate(function () {
      const root = document.querySelector(".mc-root");
      return {
        mode: root.getAttribute("data-mode"), tab: root.getAttribute("data-tab"),
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

    // ---------------------------------------------------------- 15. D3 block (E-012)

    const squad = LIVE.picks["3"].picks.map(function (p) { return p.element; });
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

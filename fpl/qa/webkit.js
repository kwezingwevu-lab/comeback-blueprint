/*
 * qa/webkit.js — Safari-engine (WebKit) acceptance suite.
 *
 * Why it exists: every other browser suite runs in Chromium, and the manager reads this app
 * on an iPhone, where the engine is WebKit. Chromium green is not Safari green — the Part G
 * gates are font-metric and layout dependent, and Safari's storage behaviour is its own.
 * This suite re-measures the engine-dependent gates under WebKit and exercises the storage,
 * export/import, refresh-error and D3-block paths there.
 *
 * It reuses qa/harness.cjs for the bundle (bundleApp), the assertion counters and the
 * SUITE line, and carries its own launcher and page builder because the harness launcher is
 * pinned to Chromium and its open() installs an in-memory window.storage that a wipe cannot
 * clear (this suite has to be able to wipe storage for real).
 *
 * Output: PASS/FAIL per check, then "SUITE webkit <pass>/<total>"; exit 1 on any FAIL.
 * Screenshots: qa/shots/webkit-<tab>.png at 390x844.
 *
 * Run: node qa/webkit.js
 *
 * Sandbox note: `npx playwright install webkit` fails its download validation here; the
 * browser is already present and `npx playwright install-deps webkit` has been run, so the
 * suite launches playwright.webkit directly and never shells out to an installer.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const H = require(path.join(__dirname, "harness.cjs"));

const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(__dirname, "shots");
const DIST = path.join(ROOT, "dist", "index.html");
const LIVE = require(path.join(ROOT, "data", "live.json"));

const NOW = "2026-09-11T08:00:00Z";                  // Friday before the GW4 deadline
const TABS = ["command", "plan", "squad", "rivals", "draft", "chips", "lab"];
const FLOORS = { ".btn": 38, ".btn-sm": 32, ".tabi": 52, ".sec-h": 48, ".menu-i": 44, ".inp": 40, ".row": 38 };
const GAKPO = 367;
const PAGE_URL = H.PAGE_URL;
const VIEW = { width: 390, height: 844 };

/* The same localStorage-backed shim dist/index.html ships. Backed by localStorage and
   nothing else, so localStorage.clear() is a real wipe — the harness's own shim keeps an
   in-memory copy that survives a clear, which would make the export/import check a lie. */
const STORAGE_SHIM = [
  "(function(){",
  "  if (window.storage && typeof window.storage.get === 'function') return;",
  "  window.storage = {",
  "    get: function(k){ try { var v = localStorage.getItem(k); return Promise.resolve(v === null ? null : { value: JSON.parse(v) }); } catch (e) { return Promise.resolve(null); } },",
  "    set: function(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return Promise.resolve(true); }",
  "  };",
  "})();"
].join("\n");

const MEASURED = {};

// ---------------------------------------------------------------- helpers

function words(s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length; }

function launchWebkit() {
  let webkit;
  try { webkit = require("playwright").webkit; } catch (e) {
    throw new Error("webkit: playwright is not installed in fpl/node_modules — run `npm install` in fpl/");
  }
  return webkit.launch({ headless: true }).catch(function (e) {
    const m = e && e.message ? String(e.message).split("\n")[0] : String(e);
    throw new Error("webkit: could not launch Playwright WebKit — " + m +
      " (the browser is preinstalled; do not run `npx playwright install webkit`, its download validation fails here)");
  });
}

/* Two shells over one esbuild bundle: with the window.storage shim (the artifact path) and
   without it (the localStorage fallback the app degrades to). */
function shells() {
  const js = H.bundleApp();
  function page(withShim) {
    return [
      "<!doctype html>",
      '<html lang="en-ZA"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
      '<meta name="color-scheme" content="dark">',
      "<title>FPL Mission Control — WebKit acceptance</title>",
      "<style>html,body{margin:0;padding:0}#root{min-height:100vh}</style>",
      "</head><body>",
      '<div id="root"></div>',
      withShim ? "<script>" + STORAGE_SHIM + "</script>" : "",
      "<script>" + js.replace(/<\/script>/gi, "<\\/script>") + "</script>",
      "</body></html>"
    ].join("\n");
  }
  return { shim: page(true), noShim: page(false) };
}

async function openPage(page, opts) {
  const o = opts || {};
  await page.addInitScript(function (now) {
    try { if (now) window.__NOW__ = now; } catch (e) { /* noop */ }
  }, o.now || NOW);
  await page.route(PAGE_URL + "**", function (route) {
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: o.html });
  });
  const mocks = o.mocks && typeof o.mocks === "object" ? o.mocks : null;
  if (mocks) for (const glob of Object.keys(mocks)) await page.route(glob, mocks[glob]);
  await page.goto(PAGE_URL, { waitUntil: "load" });
  await page.waitForSelector(".mc-root", { timeout: 25000 });
  return page;
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

async function gotoTab(page, t) {
  await page.click('[data-testid="tab-' + t + '"]');
  await page.waitForFunction(function (id) {
    const r = document.querySelector(".mc-root");
    return r && r.getAttribute("data-view") === id;
  }, t, { timeout: 15000 });
}

// ---------------------------------------------------------------- the suite

async function main() {
  const missing = H.appMissing();
  if (missing) { H.assert("app-file-exists", false, missing); return H.done("webkit"); }
  if (!fs.existsSync(DIST)) { H.assert("dist-index-html-exists", false, "dist/index.html is missing — run `node build.cjs`"); return H.done("webkit"); }
  fs.mkdirSync(SHOTS, { recursive: true });

  const HTML = shells();
  const browser = await launchWebkit();

  H.assert("webkit-launched-and-reports-its-version",
    !!browser && browser.isConnected() && /^\d+\.\d+/.test(String(browser.version())),
    "playwright.webkit " + (browser ? browser.version() : "no browser") + " (Safari engine; Chromium suites run separately)");

  const pageErrors = [];
  function watch(p, label) {
    p.on("pageerror", function (e) { pageErrors.push(label + ": " + String(e && e.message ? e.message : e)); });
    p.on("console", function (m) {
      if (m.type() !== "error") return;
      const t = m.text();
      if (/Failed to load resource/i.test(t) || /Load failed/i.test(t) || /net::ERR_/.test(t) || /XMLHttpRequest|Fetch API|Origin .* is not allowed/i.test(t)) return;
      pageErrors.push(label + " console: " + t);
    });
  }

  let context = null, page = null;
  async function fresh(opts, label) {
    if (context) { await context.close(); context = null; page = null; }
    context = await browser.newContext({ viewport: VIEW, acceptDownloads: true });
    page = await context.newPage();
    watch(page, label || "page");
    await openPage(page, opts);
    return page;
  }

  try {
    // ------------------------------------------------------ 1. boot

    // 1a. the shipped standalone file, straight off the filesystem, exactly as the manager
    // opens it on a phone — no harness, no server, no routing.
    {
      const c = await browser.newContext({ viewport: VIEW });
      const p = await c.newPage();
      const errs = [];
      p.on("pageerror", function (e) { errs.push(String(e && e.message ? e.message : e)); });
      await p.goto("file://" + DIST, { waitUntil: "load" });
      let mounted = false;
      try { await p.waitForSelector(".mc-root", { timeout: 25000 }); mounted = true; } catch (e) { mounted = false; }
      const boot = mounted ? await p.evaluate(function () {
        const r = document.querySelector(".mc-root");
        return { mode: r.getAttribute("data-mode"), view: r.getAttribute("data-view"), landing: !!r.querySelector(".landing"), boundary: r.querySelectorAll(".boundary").length, words: (r.innerText || "").trim().split(/\s+/).filter(Boolean).length };
      }) : null;
      H.assert("boot-dist-index-html-mounts-from-a-file-url",
        mounted && !!boot && boot.landing && boot.boundary === 0,
        mounted ? "file://" + DIST + " → .mc-root mode=" + boot.mode + " view=" + boot.view + " landing=" + boot.landing + " boundary=" + boot.boundary + " (" + boot.words + " visible words)" : ".mc-root never appeared within 25s");
      H.assert("boot-file-url-raises-zero-page-errors", errs.length === 0, errs.length ? errs.slice(0, 3).join(" | ") : "no uncaught error while loading and mounting dist/index.html from file://");
      await c.close();
    }

    // 1b. the harness page (esbuild bundle + React from node_modules), which every later
    // check drives.
    await fresh({ html: HTML.shim, now: NOW }, "boot/harness");
    const harnessBoot = await page.evaluate(function () {
      const r = document.querySelector(".mc-root");
      return { mode: r.getAttribute("data-mode"), landing: !!r.querySelector(".landing"), boundary: r.querySelectorAll(".boundary").length, storage: typeof window.storage === "object" && !!window.storage };
    });
    H.assert("boot-harness-page-mounts-with-the-window-storage-shim",
      harnessBoot.landing && harnessBoot.boundary === 0 && harnessBoot.storage,
      "mode=" + harnessBoot.mode + " landing=" + harnessBoot.landing + " boundary=" + harnessBoot.boundary + " window.storage=" + harnessBoot.storage);

    // ------------------------------------------------------ 2. all seven tabs + simple landing

    const simpleText = await landingText(page);
    const simpleShape = await page.evaluate(function () {
      const r = document.querySelector(".mc-root");
      const l = r.querySelector(".landing");
      return { panels: l ? l.querySelectorAll(".panel").length : -1, boundary: r.querySelectorAll(".boundary").length, tabs: r.querySelectorAll(".tabi").length };
    });
    H.assert("simple-mode-renders-the-landing-card-with-no-boundary",
      simpleText.length > 0 && simpleShape.panels >= 1 && simpleShape.panels <= 4 && simpleShape.boundary === 0,
      simpleShape.panels + " panels, boundary=" + simpleShape.boundary + ", " + simpleShape.tabs + " tabs in simple mode");

    await fresh({ html: HTML.shim, now: NOW }, "tabs");
    await page.click('[data-testid="menu"]');
    await page.click('.menu-i[data-mode="full"]');
    await page.waitForTimeout(250);

    const tabWords = {}, tabBoundary = {}, tabSecs = {};
    for (const t of TABS) {
      await gotoTab(page, t);
      const r = await page.evaluate(function () {
        const root = document.querySelector(".mc-root");
        return { text: root.innerText, boundary: root.querySelectorAll(".boundary").length, secs: root.querySelectorAll(".section").length };
      });
      tabWords[t] = words(r.text); tabBoundary[t] = r.boundary; tabSecs[t] = r.secs;
    }
    H.assert("all-seven-tabs-render-in-full-mode",
      TABS.every(function (t) { return tabWords[t] > 0 && tabSecs[t] >= 1; }),
      TABS.map(function (t) { return t + " " + tabWords[t] + "w/" + tabSecs[t] + "sec"; }).join(", "));
    H.assert("no-boundary-anywhere-under-webkit",
      TABS.every(function (t) { return tabBoundary[t] === 0; }) && simpleShape.boundary === 0,
      "full-mode tabs " + TABS.map(function (t) { return t + ":" + tabBoundary[t]; }).join(",") + "; simple-mode landing:" + simpleShape.boundary);

    // ------------------------------------------------------ 3. Part G gates, re-measured

    const simpleWords = words(simpleText);
    MEASURED.landingWords = simpleWords;
    MEASURED.landingPanels = simpleShape.panels;
    H.assert("G-landing-card-under-110-visible-words-under-webkit", simpleWords > 0 && simpleWords < 110,
      "visible words in .landing = " + simpleWords + " in " + simpleShape.panels + " panels (gate < 110)");

    MEASURED.tabWords = TABS.map(function (t) { return t + " " + tabWords[t]; }).join(" ");
    const overWords = TABS.filter(function (t) { return tabWords[t] >= 500; });
    H.assert("G-every-tab-under-500-visible-words-under-webkit", overWords.length === 0,
      TABS.map(function (t) { return t + " " + tabWords[t]; }).join(", ") + " (gate < 500)");

    let minFont = { px: 999, sel: "(nothing measured)" };
    const floorMin = {};
    Object.keys(FLOORS).forEach(function (k) { floorMin[k] = { min: null, where: "" }; });

    async function measure(label) {
      const r = await page.evaluate(function (FL) {
        const vis = function (el) {
          const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
          return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
        };
        let mn = { px: 999, sel: "" };
        Array.prototype.forEach.call(document.querySelectorAll(".mc-root *"), function (el) {
          if (el.tagName === "STYLE") return;
          if (!Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); })) return;
          if (!vis(el)) return;
          const fs2 = parseFloat(getComputedStyle(el).fontSize);
          if (isFinite(fs2) && fs2 < mn.px) mn = { px: fs2, sel: (el.getAttribute("class") || el.tagName.toLowerCase()) + " «" + el.textContent.trim().slice(0, 24) + "»" };
        });
        const fl = {};
        Object.keys(FL).forEach(function (k) {
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
      await gotoTab(page, t);
      await page.waitForTimeout(120);
      await openAllSections(page);
      await openAllReveals(page);
      await page.waitForTimeout(180);
      await measure("full/" + t);
    }
    await page.click('[data-testid="menu"]');
    await page.waitForSelector(".menu");
    await measure("full/menu");
    await page.click('[data-testid="menu"]');

    MEASURED.typeFloor = minFont.px + "px on " + minFont.sel;
    H.assert("G-type-floor-11px-under-webkit", minFont.px >= 11,
      "smallest visible computed font-size " + minFont.px + "px on " + minFont.sel + " (floor 11px)");

    MEASURED.touch = Object.keys(FLOORS).map(function (k) { return k + " " + (floorMin[k].min === null ? "n/a" : floorMin[k].min.toFixed(2)); }).join(" ");
    MEASURED.touchWhere = Object.keys(FLOORS).map(function (k) { return k + " " + (floorMin[k].min === null ? "n/a" : floorMin[k].min.toFixed(2) + " «" + floorMin[k].where + "»"); }).join(" · ");
    Object.keys(FLOORS).forEach(function (k) {
      const got = floorMin[k];
      H.assert("G-touch-floor-" + k.replace(".", "") + "-" + FLOORS[k] + "px-under-webkit",
        got.min !== null && got.min >= FLOORS[k] - 0.5,
        got.min === null ? "no visible " + k + " element was rendered anywhere" : "minimum height " + got.min.toFixed(2) + "px on «" + got.where + "» (floor " + FLOORS[k] + ")");
    });

    const tabGeom = await page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll(".tabi"), function (e) {
        return { id: e.getAttribute("data-tab"), testid: e.getAttribute("data-testid"), aria: e.getAttribute("aria-label"), w: Math.round(e.getBoundingClientRect().width * 100) / 100 };
      });
    });
    const widths = tabGeom.map(function (t) { return t.w; });
    const spread = widths.length ? Math.max.apply(null, widths) - Math.min.apply(null, widths) : 999;
    MEASURED.tabWidths = tabGeom.map(function (t) { return t.id + " " + t.w; }).join(" ") + " · spread " + spread.toFixed(2) + "px";
    H.assert("G-seven-equal-width-icon-tabs-under-webkit",
      tabGeom.length === 7 && spread <= 1 &&
      tabGeom.every(function (t, i) { return t.id === TABS[i] && t.testid === "tab-" + TABS[i] && !!t.aria; }),
      tabGeom.length + " tabs [" + tabGeom.map(function (t) { return t.id + " " + t.w + "px"; }).join(", ") + "], width spread " + spread.toFixed(2) + "px");

    const scrolls = [], scrollNums = [];
    for (const w of [360, 390]) {
      await page.setViewportSize({ width: w, height: 800 });
      for (const t of TABS) {
        await gotoTab(page, t);
        await page.waitForTimeout(110);
        const r = await page.evaluate(function () { return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
        scrollNums.push(w + "/" + t + " " + r.sw + "≤" + r.cw);
        if (r.sw > r.cw) scrolls.push(w + "px/" + t + " " + r.sw + ">" + r.cw);
      }
    }
    await page.setViewportSize(VIEW);
    MEASURED.scroll = scrollNums.join(" ");
    H.assert("G-no-horizontal-scroll-at-360px-and-390px-under-webkit", scrolls.length === 0,
      scrolls.length ? scrolls.join("; ") : "14 measurements (2 widths x 7 tabs), scrollWidth never exceeded clientWidth");

    // ------------------------------------------------------ 4. storage: both paths survive a reload
    //
    // Safari's storage behaviour is the reason this suite exists: the artifact path
    // (window.storage) and the fallback (localStorage) are exercised separately, because a
    // page served without the shim uses a different code path inside the app's store.

    const storageResults = {};
    for (const flavour of ["window.storage", "localStorage"]) {
      await fresh({ html: flavour === "window.storage" ? HTML.shim : HTML.noShim, now: NOW }, "storage/" + flavour);
      const hasShim = await page.evaluate(function () { return !!(window.storage && typeof window.storage.get === "function"); });
      await page.click('[data-testid="menu"]');
      await page.click('.menu-i[data-mode="full"]');
      await page.waitForTimeout(220);
      await gotoTab(page, "rivals");
      await page.waitForTimeout(150);
      await page.click('[data-testid="sec-rv-own"]');
      await page.waitForTimeout(200);
      const before = await page.evaluate(function () {
        const r = document.querySelector(".mc-root");
        return {
          mode: r.getAttribute("data-mode"), tab: r.getAttribute("data-view"),
          secs: Array.prototype.map.call(r.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section") + ":" + s.querySelector(".sec-h").getAttribute("aria-expanded"); })
        };
      });
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(".mc-root");
      await page.waitForTimeout(800);
      const after = await page.evaluate(function () {
        const r = document.querySelector(".mc-root");
        return {
          mode: r.getAttribute("data-mode"), tab: r.getAttribute("data-view"),
          secs: Array.prototype.map.call(r.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section") + ":" + s.querySelector(".sec-h").getAttribute("aria-expanded"); })
        };
      });
      storageResults[flavour] = { hasShim: hasShim, before: before, after: after };
      H.assert("storage-" + flavour.replace(".", "-") + "-persists-mode-tab-and-open-sections-across-a-reload",
        (flavour === "window.storage" ? hasShim : !hasShim) &&
        after.mode === "full" && after.tab === "rivals" && after.secs.join(",") === before.secs.join(","),
        "window.storage present=" + hasShim + " · before " + before.mode + "/" + before.tab + " [" + before.secs.join(" ") +
        "] · after " + after.mode + "/" + after.tab + " [" + after.secs.join(" ") + "]");
    }

    // ------------------------------------------------------ 5. export → wipe → import

    {
      await fresh({ html: HTML.shim, now: NOW }, "export-import");
      // A state that is distinguishable from the snapshot seed: the fourteen confirmed picks
      // plus Gakpo, written straight into storage so the reload below starts from it.
      const squad = LIVE.picks["3"].picks.map(function (p) { return p.element; });
      const marked = squad.slice(0, 14).concat([GAKPO]);
      await page.evaluate(function (s) {
        localStorage.setItem("mc_state", JSON.stringify(s.state));
        localStorage.setItem("mc_ui", JSON.stringify(s.ui));
      }, {
        state: {
          version: 87, exported_at: null, entry: 3546875,
          squad: marked.map(function (id) { return { id: id, purchase: null }; }),
          bank: 0, ft: 3, value: 1000, confirmed_gw: 2, leagues: [],
          draft: { league_id: null, roster: [], watchlist: [] },
          ui: { mode: "full", tab: "lab", open: {}, reveals: {} }, ledger: [],
          refresh: { pair: "sonnet46", last: null }
        },
        ui: { mode: "full", tab: "lab", open: { "lab-export": true, "lab-import": true }, reveals: {} }
      });
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(".mc-root");
      await page.waitForTimeout(700);
      await gotoTab(page, "lab");
      await openAllSections(page);
      await page.waitForTimeout(200);

      // Export through the real control: the Download button builds a Blob and clicks an
      // anchor. WebKit is the engine where that path is least forgiving, so it is driven
      // rather than simulated.
      let exported = null, exportErr = "";
      try {
        const [dl] = await Promise.all([
          page.waitForEvent("download", { timeout: 10000 }),
          page.click('[data-testid="export-download"]')
        ]);
        const p2 = await dl.path();
        exported = fs.readFileSync(p2, "utf8");
      } catch (e) { exportErr = e && e.message ? String(e.message).split("\n")[0] : String(e); }
      let parsed = null;
      try { parsed = JSON.parse(exported); } catch (e) { /* stays null */ }
      const exIds = parsed && Array.isArray(parsed.squad) ? parsed.squad.map(function (x) { return Number(x.id); }) : [];
      H.assert("export-download-produces-the-current-state-as-json",
        !!parsed && exIds.length === 15 && exIds.indexOf(GAKPO) >= 0,
        exported === null ? "no download fired: " + exportErr : exported.length + " bytes, " + exIds.length + " squad ids, contains " + GAKPO + "=" + (exIds.indexOf(GAKPO) >= 0));

      // Wipe every storage the app can read, then reload: it has to fall back to the
      // snapshot seed, which does NOT carry the marker id.
      await page.evaluate(function () { try { localStorage.clear(); } catch (e) { /* noop */ } try { sessionStorage.clear(); } catch (e) { /* noop */ } });
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(".mc-root");
      await page.waitForTimeout(700);
      const wiped = await page.evaluate(function () {
        let s = null; try { s = JSON.parse(localStorage.getItem("mc_state") || "null"); } catch (e) { /* noop */ }
        const r = document.querySelector(".mc-root");
        return { ids: s && Array.isArray(s.squad) ? s.squad.map(function (x) { return Number(x.id); }) : [], mode: r.getAttribute("data-mode") };
      });
      H.assert("wiping-storage-drops-the-imported-squad",
        wiped.ids.indexOf(GAKPO) < 0 && wiped.mode === "simple",
        "after localStorage.clear() and a reload the app reseeded from the snapshot: mode=" + wiped.mode + ", squad carries " + GAKPO + "=" + (wiped.ids.indexOf(GAKPO) >= 0));

      // Import it back through the Lab textarea and Apply.
      await page.click('[data-testid="menu"]');
      await page.click('.menu-i[data-mode="full"]');
      await page.waitForTimeout(220);
      await gotoTab(page, "lab");
      await page.click('[data-testid="sec-lab-import"]');
      await page.waitForTimeout(150);
      await page.fill('[data-testid="import-text"]', exported === null ? "{}" : exported);
      await page.waitForTimeout(120);
      await page.click('[data-testid="import-apply"]');
      await page.waitForTimeout(600);
      await gotoTab(page, "squad");
      await page.waitForTimeout(200);
      await openAllSections(page);
      await page.waitForTimeout(250);
      const back = await page.evaluate(function () {
        let s = null; try { s = JSON.parse(localStorage.getItem("mc_state") || "null"); } catch (e) { /* noop */ }
        const sec = document.querySelector('.section[data-section="sq-fifteen"]');
        return {
          ids: s && Array.isArray(s.squad) ? s.squad.map(function (x) { return Number(x.id); }) : [],
          names: sec ? sec.innerText.replace(/\s+/g, " ") : "",
          err: (function () { const e = document.querySelector('[data-testid="lab-import"] .err'); return e ? e.innerText : ""; })()
        };
      });
      H.assert("import-restores-the-exported-squad-and-the-squad-tab-shows-it",
        back.ids.length === 15 && back.ids.indexOf(GAKPO) >= 0 && /Gakpo/.test(back.names),
        back.ids.length + " squad ids in storage, contains " + GAKPO + "=" + (back.ids.indexOf(GAKPO) >= 0) +
        ", the fifteen names Gakpo=" + /Gakpo/.test(back.names) + (back.err ? ", import error «" + back.err + "»" : ""));
    }

    // ------------------------------------------------------ 6. refresh error path (mocked 400)

    {
      await fresh({
        html: HTML.shim, now: NOW,
        mocks: {
          "https://fantasy.premierleague.com/**": function (route) { return route.abort(); },
          "https://api.anthropic.com/**": async function (route) {
            await new Promise(function (r) { setTimeout(r, 700); });
            return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "webkit: deliberate 400" } }) });
          }
        }
      }, "refresh-400");
      const beforeRefresh = await landingText(page);
      await page.click('[data-testid="refresh"]');
      let sawBar = false;
      try { await page.waitForSelector(".refbar", { timeout: 6000 }); sawBar = true; } catch (e) { sawBar = false; }
      H.assert("refbar-appears-while-a-refresh-is-pending-under-webkit", sawBar,
        sawBar ? ".refbar rendered after the header refresh was clicked" : ".refbar never appeared within 6s");
      let cleared = false;
      try { await page.waitForFunction(function () { return document.querySelectorAll(".refbar").length === 0; }, null, { timeout: 25000 }); cleared = true; } catch (e) { cleared = false; }
      const after400 = await page.evaluate(function () {
        const e = document.querySelector('[data-testid="err"]');
        return { err: e ? e.innerText.replace(/\s+/g, " ").slice(0, 120) : null, bars: document.querySelectorAll(".refbar").length };
      });
      const afterRefresh = await landingText(page);
      H.assert("E018-refbar-clears-after-a-400-and-the-state-is-unchanged-under-webkit",
        cleared && after400.bars === 0 && !!after400.err && /400/.test(after400.err) && afterRefresh === beforeRefresh,
        "cleared=" + cleared + " bars=" + after400.bars + " error «" + after400.err + "» landing unchanged=" + (afterRefresh === beforeRefresh));
    }

    // ------------------------------------------------------ 7. D3 block renders and clears

    {
      const squad = LIVE.picks["3"].picks.map(function (p) { return p.element; });
      const mismatched = squad.slice(0, 14).concat([GAKPO]);
      await fresh({ html: HTML.shim, now: NOW }, "d3");
      await page.evaluate(function (s) {
        localStorage.setItem("mc_state", JSON.stringify(s.state));
        localStorage.setItem("mc_ui", JSON.stringify(s.ui));
      }, {
        state: {
          version: 87, exported_at: null, entry: 3546875,
          squad: mismatched.map(function (id) { return { id: id, purchase: null }; }),
          bank: 0, ft: 3, value: 1000, confirmed_gw: 2, leagues: [],
          draft: { league_id: null, roster: [], watchlist: [] },
          ui: { mode: "full", tab: "command", open: {}, reveals: {} }, ledger: [],
          refresh: { pair: "sonnet46", last: null }
        },
        ui: { mode: "full", tab: "command", open: {}, reveals: {} }
      });
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(".mc-root");
      await page.waitForTimeout(700);
      const d3landing = await landingText(page);
      await gotoTab(page, "plan");
      await page.waitForTimeout(150);
      await openAllSections(page);
      await page.waitForTimeout(220);
      const guarded = ["plan-tx", "plan-wc", "plan-cap", "plan-xi", "plan-time", "plan-fb"];
      const blocked = await page.evaluate(function (ids) {
        return ids.map(function (id) {
          const s = document.querySelector('.section[data-section="' + id + '"]');
          return { id: id, block: !!(s && s.querySelector(".block")), confirm: !!(s && s.querySelector('[data-testid^="confirm-"]')), rows: s ? s.querySelectorAll(".sec-b .row").length : -1 };
        });
      }, guarded);
      const bad = blocked.filter(function (x) { return !x.block || !x.confirm || x.rows > 0; });
      H.assert("E012-D3-block-renders-under-webkit",
        /Confirm the squad first/.test(d3landing) && bad.length === 0,
        "landing «" + d3landing.replace(/\s+/g, " ").slice(0, 80) + "» · " + (bad.length ? bad.map(function (x) { return x.id + " block=" + x.block + " rows=" + x.rows; }).join("; ") : guarded.length + " guarded plan panels all blocked with a confirm control and no move rows"));

      await page.click('[data-testid="confirm-plan-tx"]');
      await page.waitForTimeout(700);
      const afterConfirm = await page.evaluate(function () {
        const s = document.querySelector('.section[data-section="plan-tx"]');
        return { blocks: document.querySelectorAll(".block").length, rows: s ? s.querySelectorAll(".sec-b .row").length : -1, text: s ? s.innerText.replace(/\s+/g, " ").slice(0, 80) : "" };
      });
      H.assert("E012-D3-block-clears-on-confirm-under-webkit",
        afterConfirm.blocks === 0 && afterConfirm.rows > 0,
        afterConfirm.blocks + " blocks left, plan-tx renders " + afterConfirm.rows + " move rows: «" + afterConfirm.text + "»");
    }

    // ------------------------------------------------------ 8. screenshots, 390x844

    {
      await fresh({ html: HTML.shim, now: NOW }, "shots");
      await page.click('[data-testid="menu"]');
      await page.click('.menu-i[data-mode="full"]');
      await page.waitForTimeout(250);
      const written = [];
      for (const t of TABS) {
        await gotoTab(page, t);
        await page.waitForTimeout(320);
        const file = path.join(SHOTS, "webkit-" + t + ".png");
        await page.screenshot({ path: file });
        const st = fs.statSync(file);
        written.push(t + " " + Math.round(st.size / 1024) + "kB");
      }
      H.assert("390x844-screenshots-written-for-all-seven-tabs",
        written.length === 7 && TABS.every(function (t) { return fs.existsSync(path.join(SHOTS, "webkit-" + t + ".png")); }),
        "qa/shots/webkit-<tab>.png: " + written.join(", "));
    }

    // ------------------------------------------------------ close

    console.log("(webkit measured: landing " + MEASURED.landingWords + " words / " + MEASURED.landingPanels + " panels · tab words " + MEASURED.tabWords + ")");
    console.log("(webkit measured: type floor " + MEASURED.typeFloor + ")");
    console.log("(webkit measured: touch floors " + MEASURED.touch + ")");
    console.log("(webkit measured: smallest of each class — " + MEASURED.touchWhere + ")");
    console.log("(webkit measured: tab widths " + MEASURED.tabWidths + ")");
    console.log("(webkit measured: scrollWidth vs clientWidth " + MEASURED.scroll + ")");

    H.assert("no-uncaught-page-errors-during-the-webkit-suite", pageErrors.length === 0,
      pageErrors.length ? pageErrors.slice(0, 4).join(" | ") : "no pageerror and no console error across every WebKit page opened above");
  } finally {
    if (context) { try { await context.close(); } catch (e) { /* noop */ } }
    await browser.close();
  }

  return H.done("webkit");
}

main().catch(function (e) {
  H.assert("webkit-suite-ran-to-completion", false, e && e.message ? e.message : String(e));
  H.done("webkit");
});

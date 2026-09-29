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
 * Screenshots: qa/shots/webkit-<tab>.png at 390x844 (Playwright's default scheme, light), webkit-<tab>-dark.png
 * (section 9, prefers-color-scheme dark) and webkit-odds-full.png / webkit-review-full.png (the two v110 tabs,
 * full page, every section and reveal open, dark).
 *
 * Section 9 (v110 §5 D7, E5) re-measures the Part G gates in each colour scheme in its own context — landing,
 * first paint against the source's PRIMARY, type and touch floors, no horizontal scroll by document width AND by a
 * whole-page element walk at 360 and 390, the strip rule — and holds the light and dark renders identical.
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

// E-084 again: this was frozen at "2026-09-11T08:00:00Z" — the Friday before the GW4
// deadline — and the screenshots this suite writes were still counting down to a deadline
// fifteen days in the past ("29d to deadline" on a GW6 snapshot). Derived from the
// snapshot's own is_next event, like the clocks in qa/smoke.cjs.
const NEXT_EV = LIVE.events.filter(function (e) { return e.is_next; })[0] || LIVE.events[LIVE.events.length - 1];
const NOW = new Date(Date.parse(NEXT_EV.deadline_time) - 26 * 3600000).toISOString().replace(/\.\d{3}Z$/, "Z");   // the day before the next deadline
// v110 D0: nine tabs — odds and review join before lab. Every count below is TABS.length, and
// "G-suite-TABS-equal-the-app-tab-strip-under-webkit" compares this list once with the rendered .tabi ids.
const TABS = ["command", "plan", "squad", "rivals", "draft", "chips", "odds", "review", "lab"];
const FLOORS = { ".btn": 44, ".btn-sm": 32, ".btn-ic": 44, ".tabi": 52, ".sec-h": 48, ".menu-i": 44, ".inp": 44, ".row": 38, ".reveal": 44 };
const GAKPO = 367;
const PAGE_URL = H.PAGE_URL;
/* A service worker needs a secure context, so the registration half of the PWA guard is
   measured on an https origin. Both requests are fulfilled by a Playwright route; nothing
   leaves the machine and no certificate is involved. */
const SECURE_URL = "https://mc.test/";
const VIEW = { width: 390, height: 844 };

/* The artifact's window.storage, for the flavour that has one: text only (set() refuses a non-string with a TypeError,
   counted on window.__STORAGE_NONTEXT__; get() answers { key, value: <the text> }), backed by localStorage and nothing
   else, so localStorage.clear() is a real wipe — the harness's own shim keeps an in-memory copy that survives a clear,
   which would make the export/import check a lie. It carries no __shim marker, because the artifact never does: the
   dist build's own shim (marker, failed writes resolve false) is what the loopback suite qa/ios.cjs runs. */
const STORAGE_SHIM = [
  "(function(){",
  "  if (window.storage && typeof window.storage.get === 'function') return;",
  "  window.__STORAGE_NONTEXT__ = 0;",
  "  window.storage = {",
  "    get: function(k){ try { var v = localStorage.getItem(k); return Promise.resolve(v === null ? null : { key: k, value: v }); } catch (e) { return Promise.resolve(null); } },",
  "    set: function(k, v){",
  "      if (typeof v !== 'string') { window.__STORAGE_NONTEXT__++; return Promise.reject(new TypeError('window.storage.set: the value must be a string (artifact storage is text only)')); }",
  "      try { localStorage.setItem(k, v); } catch (e) {} return Promise.resolve({ key: k, value: v });",
  "    }",
  "  };",
  "})();"
].join("\n");

const MEASURED = {};

/* Proof mode for section 9 only: WEBKIT_MUTATE=light-palette adds a light palette under prefers-color-scheme: light,
   which the scheme-identity check must fire on; WEBKIT_MUTATE=clipped-wide puts a 600px bar inside the first open
   section, where .section{overflow:hidden} clips it, so the document's scrollWidth stays pinned and only the element
   walk can see it. Neither touches sections 1–8. */
const MUT = String(process.env.WEBKIT_MUTATE || "");

// ---------------------------------------------------------------- helpers

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

/* v110 D7/E5 · PRIMARY read from the assembled app the harness bundles (app/FPL_Mission_Control.jsx), so this suite
   carries no second copy of it to drift. Returns {} when it cannot be read; the check that uses it then fails. */
function sourcePrimary() {
  let src = "";
  try { src = fs.readFileSync(H.appPath, "utf8"); } catch (e) { return {}; }
  const m = src.match(/\nconst PRIMARY = \{([^}]*)\};/);
  const out = {};
  if (!m) return out;
  const re = /([a-z0-9_]+):\s*"([^"]+)"/g;
  let x;
  while ((x = re.exec(m[1]))) out[x[1]] = x[2];
  return out;
}

/* The tab as it first paints: the words the manager sees and which sections are open (as qa/smoke.cjs measures it). */
function firstPaintProbe() {
  const r = document.querySelector(".mc-root");
  const secs = Array.prototype.slice.call(r.querySelectorAll(".section"));
  return {
    words: (r.innerText || "").trim().split(/\s+/).filter(Boolean).length,
    open: secs.filter(function (s) { const h = s.querySelector(".sec-h"); return h && h.getAttribute("aria-expanded") === "true"; })
      .map(function (s) { return s.getAttribute("data-section"); }),
    view: r.getAttribute("data-view"),
    dark: window.matchMedia("(prefers-color-scheme: dark)").matches
  };
}

/* Part G type and touch floors on whatever is on screen: the smallest computed font-size on a visible text-bearing
   element, and the smallest height per touch class. The same measure as section 3's, as a function of the page. */
function floorProbe(FL) {
  const vis = function (el) {
    const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
  };
  let mn = { px: 999, sel: "" };
  Array.prototype.forEach.call(document.querySelectorAll(".mc-root *"), function (el) {
    if (el.tagName === "STYLE") return;
    if (!Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); })) return;
    if (!vis(el)) return;
    const f = parseFloat(getComputedStyle(el).fontSize);
    if (isFinite(f) && f < mn.px) mn = { px: f, sel: (el.getAttribute("class") || el.tagName.toLowerCase()) + " «" + el.textContent.trim().slice(0, 24) + "»" };
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
}

/* The whole-page element walk of qa/browser.py (WALK_JS), in Safari's engine: every element's client rects against
   the viewport, excusing only an overshoot that an INNER overflow-x scroller can still bring into view. The document's
   own scrollWidth is returned beside it as a measurement; it cannot see a child that .section{overflow:hidden} clips. */
function walkProbe(eps) {
  const vw = document.documentElement.clientWidth, bad = [];
  let n = 0;
  const name = function (el) {
    let s = el.tagName.toLowerCase();
    const c = el.getAttribute && el.getAttribute("class");
    if (c && typeof c === "string" && c.trim()) s += "." + c.trim().split(/\s+/).join(".");
    const t = el.getAttribute && el.getAttribute("data-testid");
    if (t) s += '[data-testid="' + t + '"]';
    return s;
  };
  Array.prototype.forEach.call(document.querySelectorAll("*"), function (el) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return;
    let right = -Infinity, left = Infinity;
    Array.prototype.forEach.call(el.getClientRects(), function (r) {
      if (r.width === 0 && r.height === 0) return;
      if (r.right > right) right = r.right;
      if (r.left < left) left = r.left;
    });
    if (right === -Infinity) return;
    n++;
    [["right", right - vw], ["left", -left]].forEach(function (p) {
      if (p[1] <= eps) return;
      let reach = 0;
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        if (!/(auto|scroll)/.test(getComputedStyle(a).overflowX)) continue;
        const avail = p[0] === "right" ? a.scrollWidth - a.clientWidth - a.scrollLeft : a.scrollLeft;
        if (avail > 1) reach += avail;
      }
      if (p[1] - reach > eps) bad.push({ sel: name(el), side: p[0], over: Math.round(p[1] * 100) / 100, text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) });
    });
  });
  return { vw: vw, n: n, docSW: document.documentElement.scrollWidth, docCW: document.documentElement.clientWidth, bad: bad };
}

/* A 6x12 grid of mean luminance (Rec.709 on sRGB bytes) over a PNG, computed exactly per block rather than by a
   canvas downscale, whose filter differs between engines. The same signature qa/browser.py compares schemes with. */
async function gridProbe(a) {
  const url = a[0], cols = a[1], rows = a[2];
  const img = new Image();
  await new Promise(function (res, rej) { img.onload = res; img.onerror = function () { rej(new Error("the screenshot did not decode")); }; img.src = url; });
  const W = img.naturalWidth, Hh = img.naturalHeight, c = document.createElement("canvas");
  c.width = W; c.height = Hh;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, Hh).data, sum = new Array(cols * rows).fill(0), cnt = new Array(cols * rows).fill(0);
  for (let y = 0; y < Hh; y++) {
    const ry = Math.min(rows - 1, Math.floor(y * rows / Hh));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, k = ry * cols + Math.min(cols - 1, Math.floor(x * cols / W));
      sum[k] += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; cnt[k]++;
    }
  }
  return { sig: sum.map(function (s, k) { return Math.round(s / cnt[k] * 10) / 10; }), w: W, h: Hh };
}

/* Width and height out of a PNG's IHDR, so a written screenshot is checked for what it is, not only that it exists. */
function pngSize(buf) {
  if (!buf || buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

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
      "<style>html,body{margin:0;padding:0}#root{min-height:100vh;min-height:100svh}</style>",
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
      // v89: the page now carries a service-worker registration. The spy records whether it
      // was attempted; from a file: URL it must not be, because Safari rejects (and can throw
      // on) a registration from one and this is the mode the app is opened in today.
      await p.addInitScript(H.SW_SPY);
      await p.goto("file://" + DIST, { waitUntil: "load" });
      let mounted = false;
      try { await p.waitForSelector(".mc-root", { timeout: 25000 }); mounted = true; } catch (e) { mounted = false; }
      const boot = mounted ? await p.evaluate(function () {
        const r = document.querySelector(".mc-root");
        const meta = document.querySelector('meta[name="theme-color"]');
        return {
          mode: r.getAttribute("data-mode"), view: r.getAttribute("data-view"),
          landing: !!r.querySelector(".landing"), boundary: r.querySelectorAll(".boundary").length,
          words: (r.innerText || "").trim().split(/\s+/).filter(Boolean).length,
          pwa: window.__PWA__ ? String(window.__PWA__.sw) : "no __PWA__ on the page",
          protocol: window.__PWA__ ? String(window.__PWA__.protocol) : "",
          calls: (window.__SWCALLS__ || []).slice(),
          manifest: !!document.querySelector('link[rel="manifest"]'),
          appleIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
          theme: meta ? String(meta.getAttribute("content")) : ""
        };
      }) : null;
      H.assert("boot-dist-index-html-mounts-from-a-file-url",
        mounted && !!boot && boot.landing && boot.boundary === 0,
        mounted ? "file://" + DIST + " → .mc-root mode=" + boot.mode + " view=" + boot.view + " landing=" + boot.landing + " boundary=" + boot.boundary + " (" + boot.words + " visible words)" : ".mc-root never appeared within 25s");
      H.assert("boot-file-url-raises-zero-page-errors", errs.length === 0, errs.length ? errs.slice(0, 3).join(" | ") : "no uncaught error while loading and mounting dist/index.html from file://");
      H.assert("PWA-no-service-worker-is-registered-from-a-file-url-under-webkit",
        !!boot && boot.pwa === "skipped-not-http" && boot.calls.length === 0 && boot.protocol === "file:",
        boot ? "protocol " + boot.protocol + ", __PWA__.sw " + boot.pwa + ", register() calls " + JSON.stringify(boot.calls) : "the page never mounted");
      H.assert("PWA-the-shipped-page-carries-the-manifest-the-apple-icon-and-the-theme-colour",
        !!boot && boot.manifest && boot.appleIcon && /^#[0-9a-fA-F]{6}$/.test(boot.theme),
        boot ? "manifest link " + boot.manifest + ", apple-touch-icon " + boot.appleIcon + ", theme-color " + (boot.theme || "absent") : "the page never mounted");
      await c.close();
    }

    // 1a-bis. the same shipped file served over https, which is the other half of the guard:
    // the file:// check above proves the registration is skipped, and this proves it is not
    // skipped for everyone. https, not http, because a service worker needs a secure context:
    // over http://mc.test/ WebKit does not expose navigator.serviceWorker at all and the page
    // honestly reports "unsupported", which would make this check unable to fail. Measured:
    // over https both engines expose it and the page registers. The spy stands in for the
    // registration itself so nothing is actually installed in the test browser.
    {
      const c = await browser.newContext({ viewport: VIEW, ignoreHTTPSErrors: true });
      const p = await c.newPage();
      const errs = [];
      p.on("pageerror", function (e) { errs.push(String(e && e.message ? e.message : e)); });
      await p.addInitScript(H.SW_SPY);
      const distHtml = fs.readFileSync(DIST, "utf8");
      const mfText = fs.readFileSync(path.join(ROOT, "dist", "manifest.webmanifest"), "utf8");
      const swText = fs.readFileSync(path.join(ROOT, "dist", "sw.js"), "utf8");
      await p.route(SECURE_URL + "**", function (route) {
        route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: distHtml });
      });
      await p.route(SECURE_URL + "manifest.webmanifest", function (route) {
        route.fulfill({ status: 200, contentType: "application/manifest+json", body: mfText });
      });
      await p.route(SECURE_URL + "sw.js", function (route) {
        route.fulfill({ status: 200, contentType: "text/javascript", body: swText });
      });
      await p.goto(SECURE_URL, { waitUntil: "load" });
      await p.waitForSelector(".mc-root", { timeout: 25000 });
      let settled = true;
      try {
        await p.waitForFunction(function () { return window.__PWA__ && window.__PWA__.sw !== "pending"; }, null, { timeout: 15000 });
      } catch (e) { settled = false; }
      const http = await p.evaluate(function () {
        return {
          sw: window.__PWA__ ? String(window.__PWA__.sw) : "no __PWA__ on the page",
          protocol: window.__PWA__ ? String(window.__PWA__.protocol) : "",
          calls: (window.__SWCALLS__ || []).slice(),
          spyErr: window.__SWSPY_ERR__ || "",
          secure: !!window.isSecureContext,
          error: window.__PWA__ && window.__PWA__.error ? String(window.__PWA__.error) : ""
        };
      });
      H.assert("PWA-over-https-the-guard-lets-the-registration-through-under-webkit",
        settled && http.protocol === "https:" && http.secure && http.sw === "registered" &&
          http.calls.length === 1 && http.calls[0] === "sw.js" && !http.spyErr,
        "protocol " + http.protocol + ", secure context " + http.secure + ", __PWA__.sw " + http.sw +
          ", register() calls " + JSON.stringify(http.calls) +
          (http.spyErr ? ", spy could not install (" + http.spyErr + ")" : "") +
          (http.error ? ", error " + http.error : "") + ", settled " + settled);
      H.assert("PWA-serving-the-page-over-https-raises-zero-page-errors",
        errs.length === 0, errs.length ? errs.slice(0, 3).join(" | ") : "no uncaught error with the manifest linked and the worker registered");
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

    // ------------------------------------------------------ 2. every tab + simple landing

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
    H.assert("every-tab-renders-in-full-mode",
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
    const formSeen = { px: 999, n: 0, sel: "(none)" };
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

    H.assert("G-form-controls-are-16px-or-larger-under-webkit", formSeen.n > 0 && formSeen.px >= 16,
      formSeen.n + " visible input/select/textarea readings, smallest computed font-size " + formSeen.px + "px on " + formSeen.sel + " (floor 16px, WebKit's zoom-on-focus rule)");
    MEASURED.formFloor = formSeen.px + "px over " + formSeen.n + " readings";
    {
      const hb = await page.evaluate(function () {
        const r = document.querySelector('[data-testid="refresh"]'), m = document.querySelector('[data-testid="menu"]');
        if (!r || !m) return null;
        const a = r.getBoundingClientRect(), b = m.getBoundingClientRect();
        return { rw: a.width, rh: a.height, mw: b.width, mh: b.height, gap: b.left - a.right };
      });
      H.assert("G-header-refresh-and-menu-are-44x44-with-12px-between-under-webkit",
        !!hb && hb.rw >= 43.5 && hb.rh >= 43.5 && hb.mw >= 43.5 && hb.mh >= 43.5 && hb.gap >= 11.99,
        hb ? "refresh " + hb.rw.toFixed(2) + "x" + hb.rh.toFixed(2) + ", menu " + hb.mw.toFixed(2) + "x" + hb.mh.toFixed(2) + ", gap " + hb.gap.toFixed(2) + " (Apple 44x44 pt, about 12 pt between bordered controls)" : "header buttons not found");
    }

    const tabGeom = await page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll(".tabi"), function (e) {
        return { id: e.getAttribute("data-tab"), testid: e.getAttribute("data-testid"), aria: e.getAttribute("aria-label"), w: Math.round(e.getBoundingClientRect().width * 100) / 100 };
      });
    });
    const widths = tabGeom.map(function (t) { return t.w; });
    const spread = widths.length ? Math.max.apply(null, widths) - Math.min.apply(null, widths) : 999;
    MEASURED.tabWidths = tabGeom.map(function (t) { return t.id + " " + t.w; }).join(" ") + " · spread " + spread.toFixed(2) + "px";
    H.assert("G-suite-TABS-equal-the-app-tab-strip-under-webkit",
      tabGeom.map(function (t) { return t.id; }).join(",") === TABS.join(","),
      "rendered [" + tabGeom.map(function (t) { return t.id; }).join(",") + "] · suite [" + TABS.join(",") + "]");
    H.assert("G-every-TABS-entry-is-an-equal-width-icon-tab-under-webkit",
      tabGeom.length === TABS.length && spread <= 1 &&
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
      scrolls.length ? scrolls.join("; ") : (2 * TABS.length) + " measurements (2 widths x " + TABS.length + " tabs), scrollWidth never exceeded clientWidth");

    // v110 D0 · the strip rule of CLAUDE.md Part G (27 Sep 2026), at 360, 390 and 430, by element walk, in Safari's engine.
    {
      const readings = [], breaches = [];
      for (const w of [360, 390, 430]) {
        await page.setViewportSize({ width: w, height: 844 });
        await page.waitForTimeout(110);
        const m = await page.evaluate(stripProbe);
        readings.push(stripSummary(m));
        stripBreaches(m, TABS.length).forEach(function (b) { breaches.push(b); });
      }
      await page.setViewportSize(VIEW);
      MEASURED.strip = readings.join(" · ");
      H.assert("G-tab-strip-fits-with-labels-above-380px-and-icon-only-at-360-under-webkit", breaches.length === 0,
        breaches.length ? breaches.slice(0, 6).join("; ") : readings.join(" · "));
    }

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
          secs: Array.prototype.map.call(r.querySelectorAll(".section"), function (s) { return s.getAttribute("data-section") + ":" + s.querySelector(".sec-h").getAttribute("aria-expanded"); }),
          refused: window.__STORAGE_NONTEXT__ === undefined ? null : window.__STORAGE_NONTEXT__, store: r.getAttribute("data-store"),
          notes: document.querySelectorAll('[data-testid="store-none"], [data-testid="store-err"]').length
        };
      });
      storageResults[flavour] = { hasShim: hasShim, before: before, after: after };
      /* iOS 27, IOS27-04 (E-135): the artifact's store takes text only and refuses a non-string with a TypeError (counted);
         after a reload the app has read its first save back, so it names the copy an artifact's (window.storage) or a local
         one (the localStorage fallback), and shows neither storage note. */
      H.assert("IOS27-04-storage-" + flavour.replace(".", "-") + "-takes-text-only-and-the-first-save-is-read-back",
        after.notes === 0 && (flavour === "window.storage" ? after.refused === 0 && after.store === "artifact" : after.store === "local"),
        "non-string set() calls refused " + after.refused + ", data-store " + JSON.stringify(after.store) + ", storage notes on screen " + after.notes);
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
      H.assert("390x844-screenshots-written-for-every-tab",
        written.length === TABS.length && TABS.every(function (t) { return fs.existsSync(path.join(SHOTS, "webkit-" + t + ".png")); }),
        "qa/shots/webkit-<tab>.png: " + written.join(", "));
    }

    // ------------------------------------------------------ 9. both schemes (v110 §5 D7, E5)
    //
    // Every Part G measurement above ran in Playwright's default scheme, which is light, and the manager's iPhone is
    // as likely to be in dark. The app declares no light palette (qa/browser.py holds that tripwire in Chromium), so
    // this pass renders each scheme in its own context, proves the emulation took (matchMedia), re-measures the Part G
    // gates in each, and holds the two renders identical in Safari's engine: every tab at first paint and the landing
    // card, by a 6x12 luminance grid (qa/browser.py's signature, tolerance 1.0) with byte equality reported beside it.
    // It writes webkit-<tab>-dark.png for every tab, and full-page shots of the two v110 tabs with everything open.
    {
      const PRIMARY = sourcePrimary();
      const SCHEMES = ["light", "dark"];
      const R = {};
      const sigCtx = await browser.newContext();
      const sigPage = await sigCtx.newPage();
      await sigPage.setContent("<!doctype html><body></body>");
      const grid = function (png) { return sigPage.evaluate(gridProbe, ["data:image/png;base64," + png.toString("base64"), 6, 12]); };
      for (const scheme of SCHEMES) {
        const r = { shots: {}, first: {}, font: { px: 999, sel: "(nothing measured)" }, floors: {}, walk: [], walkNums: [], strip: [], stripBad: [] };
        Object.keys(FLOORS).forEach(function (k) { r.floors[k] = { min: null, where: "" }; });
        const c = await browser.newContext({ viewport: VIEW, colorScheme: scheme });
        const p = await c.newPage();
        watch(p, "scheme/" + scheme);
        try {
          await openPage(p, { html: HTML.shim, now: NOW });
          if (MUT === "light-palette") {
            await p.evaluate(function () {
              const s = document.createElement("style");
              s.textContent = "@media (prefers-color-scheme: light){.mc-root{--bg:#ffffff !important;--bg2:#f2f4f8 !important;--text:#0b0e13 !important}}";
              document.head.appendChild(s);
            });
          }
          r.media = await p.evaluate(function () { return window.matchMedia("(prefers-color-scheme: dark)").matches; });
          r.landing = await p.evaluate(function () {
            const l = document.querySelector(".mc-root .landing");
            if (!l) return null;
            const t = (l.innerText || "").trim();
            return { words: t.split(/\s+/).filter(Boolean).length, panels: l.querySelectorAll(".panel").length, text: t.replace(/\s+/g, " ") };
          });
          r.shots.landing = await p.screenshot();
          await p.click('[data-testid="menu"]');
          await p.click('.menu-i[data-mode="full"]');
          await p.waitForTimeout(250);
          for (const t of TABS) {
            await p.click('[data-testid="tab-' + t + '"]');
            await p.waitForFunction(function (id) { const x = document.querySelector(".mc-root"); return x && x.getAttribute("data-view") === id; }, t, { timeout: 15000 });
            await p.waitForTimeout(250);
            r.first[t] = await p.evaluate(firstPaintProbe);
            r.shots[t] = await p.screenshot();
            if (scheme === "dark") fs.writeFileSync(path.join(SHOTS, "webkit-" + t + "-dark.png"), r.shots[t]);
          }
          for (const t of TABS) {
            await p.click('[data-testid="tab-' + t + '"]');
            await p.waitForFunction(function (id) { const x = document.querySelector(".mc-root"); return x && x.getAttribute("data-view") === id; }, t, { timeout: 15000 });
            await p.waitForTimeout(120);
            await openAllSections(p);
            await openAllReveals(p);
            await p.waitForTimeout(180);
            const m = await p.evaluate(floorProbe, FLOORS);
            if (m.mn.px < r.font.px) r.font = { px: m.mn.px, sel: m.mn.sel + " on " + t };
            Object.keys(FLOORS).forEach(function (k) {
              const v = m.fl[k];
              if (v.min !== null && (r.floors[k].min === null || v.min < r.floors[k].min)) r.floors[k] = { min: v.min, where: v.where + " on " + t };
            });
            if (scheme === "dark" && (t === "odds" || t === "review")) {
              const file = path.join(SHOTS, "webkit-" + t + "-full.png");
              // From the top: the strip is sticky, and a full-page capture taken mid-scroll paints it mid-page.
              await p.evaluate(function () { window.scrollTo(0, 0); });
              await p.waitForTimeout(120);
              await p.screenshot({ path: file, fullPage: true });
              r.shots[t + "-full"] = fs.readFileSync(file);
            }
          }
          await p.click('[data-testid="menu"]');
          await p.waitForSelector(".menu");
          const mm = await p.evaluate(floorProbe, FLOORS);
          if (mm.mn.px < r.font.px) r.font = { px: mm.mn.px, sel: mm.mn.sel + " on the menu" };
          Object.keys(FLOORS).forEach(function (k) {
            const v = mm.fl[k];
            if (v.min !== null && (r.floors[k].min === null || v.min < r.floors[k].min)) r.floors[k] = { min: v.min, where: v.where + " on the menu" };
          });
          await p.click('[data-testid="menu"]');
          for (const w of [360, 390]) {
            await p.setViewportSize({ width: w, height: 844 });
            for (const t of TABS) {
              await p.click('[data-testid="tab-' + t + '"]');
              await p.waitForFunction(function (id) { const x = document.querySelector(".mc-root"); return x && x.getAttribute("data-view") === id; }, t, { timeout: 15000 });
              await p.waitForTimeout(110);
              if (MUT === "clipped-wide") {
                await p.evaluate(function () {
                  const b = document.querySelector(".mc-root .section .sec-b");
                  if (!b || document.getElementById("mutation-clipped-wide")) return;
                  const d = document.createElement("div");
                  d.id = "mutation-clipped-wide"; d.style.cssText = "width:600px;height:12px"; d.textContent = "MUTATION clipped wide bar";
                  b.appendChild(d);
                });
              }
              const wk = await p.evaluate(walkProbe, 0.5);
              r.walkNums.push(w + "/" + t + " " + wk.bad.length + "/" + wk.docSW);
              if (wk.docSW > wk.docCW) r.walk.push(w + "px/" + t + " document scrollWidth " + wk.docSW + " > " + wk.docCW);
              wk.bad.slice(0, 2).forEach(function (b) { r.walk.push(w + "px/" + t + " " + b.sel + " " + b.side + " edge over by " + b.over + "px «" + b.text + "»"); });
            }
          }
          for (const w of [360, 390, 430]) {
            await p.setViewportSize({ width: w, height: 844 });
            await p.waitForTimeout(110);
            const sm = await p.evaluate(stripProbe);
            r.strip.push(stripSummary(sm));
            stripBreaches(sm, TABS.length).forEach(function (b) { r.stripBad.push(b); });
          }
        } finally {
          await c.close();
        }
        R[scheme] = r;
      }

      for (const scheme of SCHEMES) {
        const r = R[scheme], tag = scheme + "-scheme-under-webkit";
        H.assert("D7-the-" + scheme + "-scheme-is-emulated-under-webkit", r.media === (scheme === "dark"),
          "matchMedia('(prefers-color-scheme: dark)').matches = " + r.media + " in a context created with colorScheme " + scheme);
        const lw = r.landing ? r.landing.words : -1, lp = r.landing ? r.landing.panels : -1;
        H.assert("G-landing-card-under-110-visible-words-in-at-most-4-panels-" + tag,
          !!r.landing && lw > 0 && lw < 110 && lp >= 1 && lp <= 4,
          r.landing ? lw + " visible words in " + lp + " panels (gates < 110 words, ≤ 4 panels)" : "no .landing in simple mode at boot");
        const fpBad = TABS.filter(function (t) { const f = r.first[t]; return !f || f.view !== t || f.words >= 500 || !PRIMARY[t] || f.open.length !== 1 || f.open[0] !== PRIMARY[t]; });
        H.assert("G-every-tab-first-paint-under-500-words-with-only-its-PRIMARY-open-" + tag, fpBad.length === 0 && Object.keys(PRIMARY).length > 0,
          TABS.map(function (t) { const f = r.first[t]; return t + " " + (f ? f.words + "w [" + f.open.join("|") + "]" : "not rendered") + (PRIMARY[t] ? "" : " (no PRIMARY in the source)"); }).join(", ") +
          (fpBad.length ? " · off the gate: " + fpBad.join(", ") : " (gate < 500, exactly the PRIMARY open)"));
        H.assert("G-type-floor-11px-" + tag, r.font.px >= 11, "smallest visible computed font-size " + r.font.px + "px on " + r.font.sel + " (floor 11px)");
        const lowFloors = Object.keys(FLOORS).filter(function (k) { return r.floors[k].min === null || r.floors[k].min < FLOORS[k] - 0.5; });
        H.assert("G-touch-floors-" + tag, lowFloors.length === 0,
          Object.keys(FLOORS).map(function (k) { return k + " " + (r.floors[k].min === null ? "none rendered" : r.floors[k].min.toFixed(2) + " «" + r.floors[k].where + "»") + " (floor " + FLOORS[k] + ")"; }).join(" · "));
        H.assert("G-no-horizontal-scroll-at-360px-and-390px-by-document-width-and-element-walk-" + tag, r.walk.length === 0,
          r.walk.length ? r.walk.slice(0, 5).join("; ") : (2 * TABS.length) + " readings (2 widths × " + TABS.length + " tabs, every section and reveal open): no element past the viewport that an inner scroller cannot reach, and document scrollWidth never over clientWidth");
        H.assert("G-tab-strip-fits-with-labels-above-380px-and-icon-only-at-360-" + tag, r.stripBad.length === 0,
          r.stripBad.length ? r.stripBad.slice(0, 6).join("; ") : r.strip.join(" · "));
      }

      // The two schemes, render for render.
      const pairs = ["landing"].concat(TABS), diffs = [];
      let same = 0, worst = { max: 0, at: "" };
      for (const k of pairs) {
        const a = R.light.shots[k], b = R.dark.shots[k];
        if (!a || !b) { diffs.push(k + " missing"); continue; }
        if (a.equals(b)) { same++; continue; }
        const ga = await grid(a), gb = await grid(b);
        let mx = 0;
        ga.sig.forEach(function (v, i) { mx = Math.max(mx, Math.abs(v - gb.sig[i])); });
        if (mx > worst.max) worst = { max: mx, at: k };
        if (mx > 1.0 || ga.w !== gb.w || ga.h !== gb.h) diffs.push(k + " grid max |delta| " + mx.toFixed(1) + " (" + ga.w + "x" + ga.h + " vs " + gb.w + "x" + gb.h + ")");
      }
      const sameLanding = !!R.light.landing && !!R.dark.landing && R.light.landing.text === R.dark.landing.text;
      MEASURED.identity = diffs.length ? diffs.slice(0, 4).join("; ") : pairs.length + " renders compared at 390x844 (the landing and " + TABS.length + " tabs at first paint): " + same + " byte-identical PNGs, the rest within a 6x12 luminance max |delta| of " + worst.max.toFixed(1) + " (tolerance 1.0)" + (sameLanding ? "; the landing's words are the same text" : "; the landing's words DIFFER");
      H.assert("D7-every-tab-and-the-landing-render-identically-in-light-and-dark-under-webkit", diffs.length === 0 && sameLanding, MEASURED.identity);
      await sigCtx.close();

      const newTabs = ["odds", "review"].filter(function (t) { return TABS.indexOf(t) >= 0; });
      const shotBad = [], shotSeen = [];
      newTabs.forEach(function (t) {
        [["webkit-" + t + ".png", VIEW.height], ["webkit-" + t + "-dark.png", VIEW.height], ["webkit-" + t + "-full.png", null]].forEach(function (f) {
          const file = path.join(SHOTS, f[0]);
          const sz = fs.existsSync(file) ? pngSize(fs.readFileSync(file)) : null;
          if (!sz) { shotBad.push(f[0] + " missing or not a PNG"); return; }
          if (sz.w !== VIEW.width || (f[1] !== null && sz.h !== f[1]) || (f[1] === null && sz.h <= VIEW.height)) shotBad.push(f[0] + " is " + sz.w + "x" + sz.h);
          shotSeen.push(f[0] + " " + sz.w + "x" + sz.h);
        });
        if (!R.dark.first[t] || R.dark.first[t].view !== t) shotBad.push("the dark first-paint shot of " + t + " was not taken on " + t);
      });
      MEASURED.shots = shotSeen.join(", ");
      H.assert("screenshots-of-the-two-v110-tabs-at-first-paint-in-both-schemes-and-full-page-open-under-webkit",
        newTabs.length === 2 && shotBad.length === 0,
        newTabs.length !== 2 ? "TABS carries " + newTabs.join(",") + " of odds,review" : shotBad.length ? shotBad.join("; ") : shotSeen.join(", "));

      MEASURED.schemes = SCHEMES.map(function (s) {
        return s + ": landing " + (R[s].landing ? R[s].landing.words : "?") + "w · first paint " + TABS.map(function (t) { return t + " " + (R[s].first[t] ? R[s].first[t].words : "?"); }).join(" ") +
          " · type " + R[s].font.px + "px · walk (offenders/document scrollWidth) " + R[s].walkNums.join(" ");
      }).join(" ‖ ");
    }

    // ------------------------------------------------------ close

    console.log("(webkit measured: landing " + MEASURED.landingWords + " words / " + MEASURED.landingPanels + " panels · tab words " + MEASURED.tabWords + ")");
    console.log("(webkit measured, by scheme: " + MEASURED.schemes + ")");
    console.log("(webkit measured, light against dark: " + MEASURED.identity + ")");
    console.log("(webkit measured, the v110 tabs' screenshots: " + MEASURED.shots + ")");
    if (MUT) console.log("(webkit MUTATION MODE " + MUT + ": section 9 ran on a deliberately broken page; a red there is the proof)");
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

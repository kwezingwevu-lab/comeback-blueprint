/*
 * qa/harness.cjs — shared harness for the browser suites (CONTRACT §8).
 *
 * Exports
 *   buildPage({inlineData})            → complete HTML string (esbuild bundle of
 *                                        app/FPL_Mission_Control.jsx, React from fpl/node_modules)
 *   launch()                           → Playwright Chromium browser
 *   open(page, {mode,state,ui,now,mocks}) → seeds storage + __NOW__ before load, then navigates
 *                                        and WAITS for .mc-root; throws when the app never
 *                                        mounts (pass allowNoMount:true to opt out and read
 *                                        page.mcMounted yourself) — E-052
 *   visibleText(page)                  → the text a person can see under .mc-root, from a walk over its
 *                                        text nodes (IOS27-16: not innerText, which Safari 27 changed to keep
 *                                        every <option> of a <select>; not a bare textContent, which counts
 *                                        <style> and hidden nodes)
 *   visibleWords(page)                 → the number of words in visibleText(page), the count the Part G gates use
 *   assert(name, cond, detail)         → prints "PASS name" / "FAIL name — detail"
 *   done(suite)                        → prints "SUITE <name> <pass>/<total>", exits 1 on any FAIL
 *                                        and on a total of 0 (a suite that asserted nothing) — E-052
 *   appPath, appMissing(), requireApp() → app-file guards (the UI is built in parallel)
 *   PAGE_URL, counts()
 *
 * Every helper that depends on app/FPL_Mission_Control.jsx checks for it first and
 * throws a single-line Error instead of a stack trace from esbuild.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(ROOT, "app", "FPL_Mission_Control.jsx");
const NODE_MODULES = path.join(ROOT, "node_modules");
const CHROMIUM_PATH = "/opt/pw-browsers/chromium";
const PAGE_URL = "http://mc.test/";

// ---------------------------------------------------------------- counters

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, detail) {
  const label = String(name);
  if (cond) {
    pass++;
    console.log("PASS " + label);
    return true;
  }
  fail++;
  const d = detail === undefined || detail === null || detail === "" ? "no detail given" : String(detail);
  failures.push(label + " — " + d);
  console.log("FAIL " + label + " — " + d);
  return false;
}

function counts() {
  return { pass: pass, fail: fail, total: pass + fail, failures: failures.slice() };
}

function done(suite) {
  const total = pass + fail;
  // A suite that threw before its first assert used to reach here with 0/0 and exit 0 — a
  // green line for a suite that proved nothing (E-052). Zero assertions is a failure.
  if (total === 0) {
    console.log("FAIL " + String(suite) + " — the suite recorded no assertions at all (it threw or returned before its first check); 0/0 is not a pass");
    console.log("SUITE " + String(suite) + " 0/0");
    process.exit(1);
  }
  console.log("SUITE " + String(suite) + " " + pass + "/" + total);
  if (fail > 0) process.exit(1);
  return total;
}

// ---------------------------------------------------------------- app-file guards

function appMissing() {
  if (fs.existsSync(APP_PATH)) return null;
  return "harness: app/FPL_Mission_Control.jsx does not exist yet — run `node build.cjs` first (the UI is assembled by build.cjs from src/ui.jsx)";
}

function requireApp() {
  const msg = appMissing();
  if (msg) throw new Error(msg);
  return APP_PATH;
}

function requireReact() {
  if (!fs.existsSync(path.join(NODE_MODULES, "react"))) {
    throw new Error("harness: react is not installed in fpl/node_modules — run `npm install` in fpl/");
  }
  return NODE_MODULES;
}

// ---------------------------------------------------------------- build the page

function bundleApp() {
  requireApp();
  requireReact();
  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch (e) {
    throw new Error("harness: esbuild is not installed in fpl/node_modules — run `npm install` in fpl/");
  }
  // The assembled file is an ES module that only EXPORTS the App component — the same
  // synthetic entry build.cjs uses has to mount it, or the page renders nothing and every
  // suite reports an empty .mc-root instead of the real defect.
  const hasDefault = /export\s+default/.test(fs.readFileSync(APP_PATH, "utf8"));
  const entry = [
    'import React from "react";',
    'import { createRoot } from "react-dom/client";',
    'import App from "./app/FPL_Mission_Control.jsx";',
    'const el = document.getElementById("root");',
    "createRoot(el).render(React.createElement(App));"
  ].join("\n");
  const common = {
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    loader: { ".jsx": "jsx" },
    absWorkingDir: ROOT,
    nodePaths: [NODE_MODULES],
    target: ["chrome110"],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent"
  };
  let out;
  try {
    out = esbuild.buildSync(hasDefault
      ? Object.assign({ stdin: { contents: entry, resolveDir: ROOT, sourcefile: "entry.jsx", loader: "jsx" } }, common)
      : Object.assign({ entryPoints: [APP_PATH] }, common));
  } catch (e) {
    const first = (e && Array.isArray(e.errors) && e.errors.length && e.errors[0].text) ? e.errors[0].text : (e && e.message ? e.message : String(e));
    throw new Error("harness: esbuild could not bundle app/FPL_Mission_Control.jsx — " + String(first).split("\n")[0]);
  }
  if (!out || !out.outputFiles || !out.outputFiles.length) {
    throw new Error("harness: esbuild produced no output for app/FPL_Mission_Control.jsx");
  }
  return out.outputFiles[0].text;
}

// A tiny window.storage over localStorage, installed only when the page has not already been given one by open().
// It keeps the artifact's contract, which Anthropic documents as text only: set() takes a string and refuses anything
// else with a TypeError (counted on window.__STORAGE_NONTEXT__, so a suite can assert the app never sends a non-string),
// get() answers { key, value: <the text> }. Until IOS27-04 every double here JSON-encoded whatever it was given, which
// is why an app writing objects to a text-only store went unseen (E-135).
const STORAGE_SHIM = [
  "if (!window.storage) {",
  "  window.__STORAGE_NONTEXT__ = 0;",
  "  window.storage = {",
  "    async get(k){ try { const v = localStorage.getItem(k); return v === null ? null : { key: k, value: v }; } catch (e) { return null; } },",
  "    async set(k, v){",
  "      if (typeof v !== 'string') { window.__STORAGE_NONTEXT__++; throw new TypeError('window.storage.set: the value must be a string (artifact storage is text only)'); }",
  "      try { localStorage.setItem(k, v); } catch (e) {} return { key: k, value: v };",
  "    }",
  "  };",
  "}"
].join("\n");

function buildPage(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const js = bundleApp();
  const inline = o.inlineData === undefined ? null : o.inlineData;
  let inlineScript = "";
  if (inline !== null) {
    let text;
    try {
      text = JSON.stringify(inline);
    } catch (e) {
      throw new Error("harness: inlineData is not JSON-serialisable — " + (e && e.message ? e.message : String(e)));
    }
    inlineScript = "<script>window.__MC_INLINE__ = " + String(text).replace(/</g, "\\u003c") + ";</script>\n";
  }
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    "<title>FPL Mission Control — QA</title>",
    "</head><body>",
    '<div id="root"></div>',
    inlineScript + "<script>" + STORAGE_SHIM + "</script>",
    "<script>" + js.replace(/<\/script>/gi, "<\\/script>") + "</script>",
    "</body></html>"
  ].join("\n");
}

/* An init script that records every navigator.serviceWorker.register() call on
   window.__SWCALLS__ and resolves it locally, so a suite can prove whether the shipped page
   TRIED to register a worker without one actually being installed (and without depending on
   an engine's service-worker support in a test browser). Shared by smoke.cjs (Chromium) and
   webkit.js (Safari engine) so the two measure exactly the same thing. */
function SW_SPY() {
  try {
    window.__SWCALLS__ = [];
    if (navigator.serviceWorker && typeof navigator.serviceWorker.register === "function") {
      navigator.serviceWorker.register = function (url) {
        window.__SWCALLS__.push(String(url));
        return Promise.resolve({ scope: String(location.href) });
      };
    }
  } catch (e) {
    window.__SWSPY_ERR__ = String(e && e.message ? e.message : e);
  }
}

// ---------------------------------------------------------------- browser

function launch(options) {
  let chromium;
  try {
    chromium = require("playwright").chromium;
  } catch (e) {
    throw new Error("harness: playwright is not installed in fpl/node_modules — run `npm install` in fpl/");
  }
  const opts = Object.assign({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }, options || {});
  // Sandbox: Playwright 1.63 looks for Chromium build 1243; /opt/pw-browsers has 1194 (ERRORS.md E-027).
  // CI runner: no /opt/pw-browsers at all — fall back to Playwright's own install.
  if (fs.existsSync(CHROMIUM_PATH)) opts.executablePath = CHROMIUM_PATH;
  return chromium.launch(opts).catch(function (e) {
    const m = e && e.message ? String(e.message).split("\n")[0] : String(e);
    throw new Error("harness: could not launch Chromium (" + (opts.executablePath ? opts.executablePath : "playwright default") + ") — " + m);
  });
}

// ---------------------------------------------------------------- open a page

async function open(page, opts) {
  if (!page || typeof page.goto !== "function") throw new Error("harness: open(page, …) needs a Playwright page");
  const o = opts && typeof opts === "object" ? opts : {};
  const html = o.html !== undefined ? String(o.html) : buildPage({ inlineData: o.inlineData });

  const seed = {
    now: typeof o.now === "string" && o.now ? o.now : null,
    state: o.state === undefined ? null : o.state,
    ui: o.ui === undefined ? null : o.ui,
    mode: o.mode === "full" || o.mode === "simple" ? o.mode : null
  };

  // 1. storage + __NOW__ before any app code runs.
  await page.addInitScript(function (s) {
    try {
      if (s.now) window.__NOW__ = s.now;
      const mem = {};
      const write = function (k, v) {
        mem[k] = v;
        try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* opaque origin */ }
      };
      if (s.state !== null && s.state !== undefined) write("mc_state", s.state);
      let ui = s.ui;
      if (s.mode) {
        ui = ui && typeof ui === "object" ? Object.assign({}, ui) : {};
        ui.mode = s.mode;
      }
      if (ui !== null && ui !== undefined) write("mc_ui", ui);
      /* The seeds above are objects: the copy an older build saved, which the app must still read. Everything the app
         writes is text, as the artifact's storage requires; a non-string is refused with a TypeError and counted. */
      window.__STORAGE_NONTEXT__ = 0;
      window.storage = {
        get: async function (k) {
          if (Object.prototype.hasOwnProperty.call(mem, k)) return { key: k, value: mem[k] };
          try {
            const v = window.localStorage.getItem(k);
            return v === null ? null : { key: k, value: v };
          } catch (e) { return null; }
        },
        set: async function (k, v) {
          if (typeof v !== "string") { window.__STORAGE_NONTEXT__++; throw new TypeError("window.storage.set: the value must be a string (artifact storage is text only)"); }
          mem[k] = v;
          try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ }
          return { key: k, value: v };
        }
      };
    } catch (e) { /* never break page load from the harness */ }
  }, seed);

  // 2. serve the page from a real origin so localStorage works (about:blank is opaque).
  await page.route(PAGE_URL + "**", function (route) {
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  });

  // 3. caller-supplied mocks: { "<url glob>": handler | {status, contentType, body} }.
  const mocks = o.mocks && typeof o.mocks === "object" ? o.mocks : null;
  if (mocks) {
    for (const glob of Object.keys(mocks)) {
      const m = mocks[glob];
      await page.route(glob, function (route, request) {
        if (typeof m === "function") return m(route, request);
        const r = m && typeof m === "object" ? m : {};
        return route.fulfill({
          status: r.status === undefined ? 200 : r.status,
          contentType: r.contentType || "application/json",
          body: typeof r.body === "string" ? r.body : JSON.stringify(r.body === undefined ? {} : r.body)
        });
      });
    }
  }

  await page.goto(PAGE_URL, { waitUntil: "load" });
  // E-052: the .mc-root timeout used to be caught and discarded, so a page that never mounted
  // was handed to the suite as if it had opened and every later assertion measured an empty
  // document. open() now fails loudly. A suite that deliberately opens a page which cannot
  // mount passes {allowNoMount: true} and reads page.mcMounted itself.
  page.mcMounted = false;
  try {
    await page.waitForSelector(".mc-root", { timeout: o.timeout === undefined ? 15000 : o.timeout });
    page.mcMounted = true;
  } catch (e) {
    let detail = "";
    try {
      detail = await page.evaluate(function () {
        const root = document.getElementById("root");
        const body = document.body ? (document.body.innerText || "").trim().slice(0, 200) : "";
        return "#root " + (root ? "present, " + root.childElementCount + " children" : "missing") + (body ? "; body text: " + body : "; body empty");
      });
    } catch (e2) { detail = "page could not be read (" + (e2 && e2.message ? String(e2.message).split("\n")[0] : String(e2)) + ")"; }
    if (o.allowNoMount === true) return page;
    throw new Error("harness: the app never mounted — .mc-root did not appear within " +
      (o.timeout === undefined ? 15000 : o.timeout) + "ms (" + detail + ")");
  }
  return page;
}

// ---------------------------------------------------------------- reading the page

/* IOS27-16. Word gates (the landing under 110, every tab under 500) count what a person can see, and the count must not
   move when a WebKit release changes innerText. Safari 27 made innerText keep the text of every <option> inside a
   <select> (WebKit 175006854), which would add a whole option list to a count that a person reads as one selected value.
   So this walks the text nodes under .mc-root and keeps a node when
     - no ancestor is <style>, <script>, <template>, <noscript>, [hidden] or aria-hidden="true",
     - its parent has client rects and computes visibility:visible,
     - and, inside a <select>, it is the selected <option> of a select that is itself visible, counted once.
   Text nodes in one block container are joined without a break and each new block container starts a new line, so the
   result reads like innerText and splits into the same words. The same walk is qa/ios.cjs's counter, measured equal to it
   on every tab; innerText is never used to decide. */
async function visibleText(page) {
  if (!page || typeof page.evaluate !== "function") throw new Error("harness: visibleText(page) needs a Playwright page");
  return page.evaluate(function () {
    const root = document.querySelector(".mc-root");
    if (!root) return "";
    const skipTag = { STYLE: 1, SCRIPT: 1, TEMPLATE: 1, NOSCRIPT: 1 };
    const memo = new Map();
    const hidden = function (el) {
      if (memo.has(el)) return memo.get(el);
      let h = false;
      if (skipTag[el.tagName] || el.hidden === true || (el.getAttribute && el.getAttribute("aria-hidden") === "true")) h = true;
      else if (el !== root && el.parentElement) h = hidden(el.parentElement);
      memo.set(el, h);
      return h;
    };
    const blockOf = function (el) {
      for (let n = el; n; n = n.parentElement) {
        if (n === root) return root;
        const d = getComputedStyle(n).display;
        if (d !== "inline" && d !== "contents") return n;
      }
      return root;
    };
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const lines = [];
    let n, last = null;
    while ((n = tw.nextNode())) {
      const v = n.nodeValue;
      if (!v || !v.trim()) continue;
      const p = n.parentElement;
      if (!p || hidden(p)) continue;
      const opt = p.closest("option");
      let blk;
      if (opt) {
        const s = opt.closest("select");
        if (!s || !opt.selected || hidden(s) || !s.getClientRects().length || getComputedStyle(s).visibility !== "visible") continue;
        blk = s;
      } else {
        if (!p.getClientRects().length || getComputedStyle(p).visibility !== "visible") continue;
        blk = blockOf(p);
      }
      if (blk === last && lines.length) lines[lines.length - 1] += v;
      else lines.push(v);
      last = blk;
    }
    return lines.map(function (l) { return l.replace(/[ \t\r\n]+/g, " ").trim(); }).filter(Boolean).join("\n");
  });
}

async function visibleWords(page) {
  const t = await visibleText(page);
  return t.split(/\s+/).filter(Boolean).length;
}

module.exports = {
  ROOT: ROOT,
  appPath: APP_PATH,
  PAGE_URL: PAGE_URL,
  CHROMIUM_PATH: CHROMIUM_PATH,
  appMissing: appMissing,
  requireApp: requireApp,
  bundleApp: bundleApp,
  buildPage: buildPage,
  launch: launch,
  open: open,
  visibleText: visibleText,
  visibleWords: visibleWords,
  assert: assert,
  done: done,
  counts: counts,
  SW_SPY: SW_SPY
};

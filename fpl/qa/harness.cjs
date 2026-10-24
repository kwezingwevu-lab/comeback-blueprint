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
 *   visibleText(page)                  → innerText of .mc-root (never textContent)
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

// A tiny window.storage shim over localStorage (mirrors the one dist/index.html carries),
// installed only when the page has not already been given one by open().
const STORAGE_SHIM = [
  "if (!window.storage) {",
  "  window.storage = {",
  "    async get(k){ try { const v = localStorage.getItem(k); return v === null ? null : { value: JSON.parse(v) }; } catch (e) { return null; } },",
  "    async set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return true; }",
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
      window.storage = {
        get: async function (k) {
          if (Object.prototype.hasOwnProperty.call(mem, k)) return { value: mem[k] };
          try {
            const v = window.localStorage.getItem(k);
            return v === null ? null : { value: JSON.parse(v) };
          } catch (e) { return null; }
        },
        set: async function (k, v) {
          mem[k] = v;
          try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
          return true;
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

async function visibleText(page) {
  if (!page || typeof page.evaluate !== "function") throw new Error("harness: visibleText(page) needs a Playwright page");
  return page.evaluate(function () {
    const el = document.querySelector(".mc-root");
    return el ? el.innerText : "";          // innerText, never textContent (it includes <style>)
  });
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
  assert: assert,
  done: done,
  counts: counts
};

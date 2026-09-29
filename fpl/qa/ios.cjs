/*
 * qa/ios.cjs — iPhone acceptance suite (iOS 27 plan, item IOS27-01).
 *
 * WHAT IT PROVES
 *   The shipped dist/ (read from disk at request time, never rebuilt here) served over a real
 *   loopback http server on 127.0.0.1, with a second mount under /comeback-blueprint/ that mirrors
 *   a GitHub Pages project path, opened in Playwright's WebKit with the iPhone 17, iPhone 17 Pro and
 *   iPhone 17 Pro Max descriptors (isMobile, hasTouch, DPR 3), portrait and landscape, light and dark:
 *     - every context boots with 0 page errors and 0 console errors;
 *     - no horizontal overflow, by document width, by the tab strip's own scroll box and by an
 *       element walk (the qa/browser.py walk, ported);
 *     - every tab the strip offers (read from the page, never typed) is reached with page.tap and
 *       arrives as a trusted touch pointer;
 *     - the Part G floors as the plan revises them (IOS27-09), the type floor, the word gates;
 *     - a DPR-3 screenshot per context whose PNG IHDR is exactly viewport x 3; iPhone 17 and 17 Pro
 *       are hashed and reported once as identical; light == dark while the app is dark-only.
 *   Then one check (or a small group) for the measurable acceptance of every P0 and P1 item of the
 *   plan, IOS27-02 to IOS27-17, each named with its item id. Checks for items not yet built are red
 *   on today's page on purpose: red first.
 *
 * WHAT IT CANNOT PROVE (and says so on every run)
 *   The engine is WebKit main in the Linux WPE port (Playwright's build, labelled 26.6). It is not
 *   Safari 27.0 and not an iPhone. env(safe-area-inset-*) is always 0 here and display-mode
 *   standalone cannot be emulated, so those checks are simulations and carry "SIM:" in their names:
 *   the insets are placeholders (not Apple figures) set by overriding --sat/--sar/--sab/--sal on
 *   <html>, and standalone is a matchMedia/Navigator.standalone/CSSOM shim with the viewport set to
 *   the screen. Dynamic Type, the keyboard, focus zoom, VoiceOver speech, real insets and the Claude
 *   iOS app's artifact host are device-only: they are printed as an uncounted checklist at the end,
 *   never in the count.
 *
 * HOUSE STYLE
 *   PASS/FAIL lines with the measured numbers, SKIP (uncounted) only where the engine cannot
 *   reproduce the difference being tested, "# " lines for timing and records, "SUITE ios p/t" last,
 *   exit 1 on any FAIL. Measurements run first (contexts in a small parallel pool, IOS_JOBS, default
 *   3); every check is then judged and printed in a fixed order.
 *
 * RULES THIS FILE KEEPS
 *   Launches require("playwright").webkit and never runs an installer. Never reads navigator.userAgent
 *   to decide anything (the descriptor UA is printed for the record). Tabs, sections and controls are
 *   read from the page. Visible words are counted with a text-node walk over visible elements (the
 *   IOS27-16 counter below), not innerText. Screenshots go to qa/shots/ios-<profile>-<orient>-
 *   <scheme>[-sim].png.
 *
 * Run: node qa/ios.cjs [--dist <dir>]   (from fpl/)
 *      --dist <dir> (or IOS_DIST=<dir>; the flag wins) serves another copy of dist/ for mutation
 *      runs, and IOS_SHOTS=<dir> keeps such a run's screenshots out of qa/shots/. IOS_SRC=<dir> points
 *      the static src/ scan at another copy of src/ (the plan's "add navigator.userAgent to src"
 *      mutation). IOS_JOBS=<n> sets the parallel pool (default 3); IOS_DUMP=<file.json> writes the
 *      raw measurements for diagnosis. Any other argument exits 2, so a mistyped flag can never
 *      quietly test the committed dist/ instead of the copy it named.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
/* --dist <dir> or IOS_DIST points the suite at another copy of dist/ (a mutation or a candidate build
   in a scratch folder); by default it serves the committed dist/ and never builds anything. IOS_SRC
   does the same for the static src/ scan. */
let ARG_DIST = null;
(function parseArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    const m = /^--dist=(.+)$/.exec(argv[i]);
    if (m) { ARG_DIST = m[1]; continue; }
    if (argv[i] === "--dist" && argv[i + 1] && argv[i + 1].indexOf("--") !== 0) { ARG_DIST = argv[++i]; continue; }
    console.log("usage: node qa/ios.cjs [--dist <dir>] — unknown or incomplete argument " + JSON.stringify(argv[i]));
    process.exit(2);
  }
})(process.argv.slice(2));
const DIST_ARG = ARG_DIST || process.env.IOS_DIST || null;
const DIST = DIST_ARG ? path.resolve(DIST_ARG) : path.join(ROOT, "dist");
const SRC = process.env.IOS_SRC ? path.resolve(process.env.IOS_SRC) : path.join(ROOT, "src");
const SHOTS = process.env.IOS_SHOTS ? path.resolve(process.env.IOS_SHOTS) : path.join(__dirname, "shots");
const SUB = "/comeback-blueprint/";
const T_START = Date.now();
const JOBS = Math.max(1, Math.min(6, parseInt(process.env.IOS_JOBS || "3", 10) || 3));

const PROFILES = ["iPhone 17", "iPhone 17 Pro", "iPhone 17 Pro Max"];
const ORIENTS = ["portrait", "landscape"];
const SCHEMES = ["light", "dark"];
/* Placeholder insets from the plan (IOS27-02), NOT Apple figures. IOS27-15's on-device readout
   replaces them. Landscape top and bottom are left at 0 because the plan names none. */
const SIM_INSETS = { portrait: { sat: 59, sar: 0, sab: 34, sal: 0 }, landscape: { sat: 0, sar: 59, sab: 0, sal: 59 } };

// ---------------------------------------------------------------- output

let passN = 0, failN = 0;
const skipped = [];
function check(name, cond, detail) {
  const d = detail === undefined || detail === null || detail === "" ? "no detail given" : String(detail);
  if (cond) { passN++; console.log("PASS " + name + " — " + d); return true; }
  failN++; console.log("FAIL " + name + " — " + d); return false;
}
function skip(name, reason) { skipped.push(name); console.log("SKIP " + name + " — " + reason); }
function info(s) { console.log("# " + s); }
function finish() {
  const total = passN + failN;
  if (total === 0) {
    console.log("FAIL ios — the suite recorded no assertions at all; 0/0 is not a pass");
    console.log("SUITE ios 0/0");
    process.exit(1);
  }
  console.log("SUITE ios " + passN + "/" + total);
  process.exit(failN > 0 ? 1 : 0);
}
function short(e) { return e && e.message ? String(e.message).split("\n")[0].slice(0, 220) : String(e).slice(0, 220); }
function sec(ms) { return (ms / 1000).toFixed(2) + " s"; }
function sha(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function f2(v) { return v === null || v === undefined || !isFinite(v) ? String(v) : (Math.round(v * 100) / 100).toString(); }
function slug(profile) { return profile.toLowerCase().replace(/\s+/g, "-"); }

// ---------------------------------------------------------------- static inputs

function readText(p) { try { return fs.readFileSync(p, "utf8"); } catch (e) { return null; } }
let LIVE = null;
try { LIVE = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "live.json"), "utf8")); } catch (e) { LIVE = null; }
/* The clock is pinned (the app prefers window.__NOW__) so two contexts render the same pixels:
   the day before the snapshot's own next deadline, as qa/webkit.js does (E-084: derived, not typed). */
const NEXT_EV = LIVE && Array.isArray(LIVE.events) ? (LIVE.events.filter(function (e) { return e.is_next; })[0] || LIVE.events[LIVE.events.length - 1]) : null;
const NOW = NEXT_EV && NEXT_EV.deadline_time ? new Date(Date.parse(NEXT_EV.deadline_time) - 26 * 3600000).toISOString().replace(/\.\d{3}Z$/, "Z") : null;

function swFacts(text) {
  const t = String(text || "");
  const c = t.match(/(?:var|let|const)\s+CACHE\s*=\s*["']([^"']+)["']/);
  const s = t.match(/(?:var|let|const)\s+SHELL\s*=\s*(\[[^\]]*\])/);
  let shell = null;
  try { shell = s ? JSON.parse(s[1].replace(/'/g, '"')) : null; } catch (e) { shell = null; }
  return { cache: c ? c[1] : null, shell: shell };
}

function listFiles(dir, re) {
  const out = [];
  (function walk(d) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    ents.forEach(function (e) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (re.test(e.name)) out.push(p);
    });
  })(dir);
  return out;
}

// ---------------------------------------------------------------- loopback server

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json"
};

/* One server per scenario. Files are read from dist/ on every request (the suite tests whatever
   dist/ holds while it runs). `over` swaps a file's body, `hold` delays a file's response, `cc`
   sets its Cache-Control (default no-cache). `/host` is an artifact-like page: the app inside an
   <iframe sandbox="allow-scripts">. Every request is logged with its time. */
function makeServer(label) {
  const S = { label: label, log: [], over: {}, hold: {}, cc: {}, closed: false, port: 0, origin: "" };
  S.srv = http.createServer(function (req, res) {
    const url = decodeURIComponent(String(req.url || "/").split("?")[0]);
    const entry = { t: Date.now(), method: req.method, url: url, status: 0, sent: 0 };
    S.log.push(entry);
    if (url === "/host" || url === SUB + "host") {
      const base = url === "/host" ? "/" : SUB;
      entry.status = 200; entry.sent = Date.now();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      return res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
        "<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;display:block}</style></head>" +
        '<body><iframe id="art" sandbox="allow-scripts" src="' + base + 'index.html"></iframe></body></html>');
    }
    let rel;
    if (url === "/" || url === SUB || url === SUB.slice(0, -1)) rel = "/index.html";
    else if (url.indexOf(SUB) === 0) rel = "/" + url.slice(SUB.length);
    else rel = url;
    const send = function () {
      if (S.closed) { try { res.destroy(); } catch (e) { /* gone */ } return; }
      let body;
      if (Object.prototype.hasOwnProperty.call(S.over, rel)) body = Buffer.from(String(S.over[rel]));
      else {
        const f = path.join(DIST, rel);
        if (f.indexOf(DIST + path.sep) !== 0 || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
          entry.status = 404; entry.sent = Date.now();
          res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("not found");
        }
        body = fs.readFileSync(f);
      }
      entry.status = 200; entry.sent = Date.now();
      try {
        res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream", "Cache-Control": S.cc[rel] || "no-cache" });
        res.end(body);
      } catch (e) { /* client went away */ }
    };
    const ms = S.hold[rel];
    if (ms) { entry.held = ms; setTimeout(send, ms); } else send();
  });
  S.start = function () {
    return new Promise(function (resolve, reject) {
      S.srv.once("error", reject);
      S.srv.listen(0, "127.0.0.1", function () { S.port = S.srv.address().port; S.origin = "http://127.0.0.1:" + S.port; resolve(S); });
    });
  };
  S.close = function () {
    return new Promise(function (resolve) {
      if (S.closed) return resolve();
      S.closed = true;
      try { S.srv.closeAllConnections(); } catch (e) { /* older node */ }
      S.srv.close(function () { resolve(); });
    });
  };
  S.hitsAfter = function (t0, re) { return S.log.filter(function (e) { return e.t >= t0 && re.test(e.url); }); };
  return S;
}

// ---------------------------------------------------------------- PNG

function pngSize(buf) { return [buf.readUInt32BE(16), buf.readUInt32BE(20)]; }
function decodePNG(buf) {
  let off = 8, w = 0, h = 0, bd = 0, ct = 0, il = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString("ascii", off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bd !== 8 || il !== 0 || (ct !== 2 && ct !== 6)) throw new Error("unsupported PNG: bit depth " + bd + ", colour type " + ct + ", interlace " + il);
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride), prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w: w, h: h, bpp: bpp, data: out };
}

// ---------------------------------------------------------------- page-side scripts (init scripts)

/* Pinned clock, a pointer/click log (to prove taps arrive as trusted touch), an error log that
   also works inside frames, and an optional mc_ui seed written only when storage is empty. */
function INIT(a) {
  try { if (a && a.now) window.__NOW__ = a.now; } catch (e) { /* noop */ }
  try {
    window.__PTR__ = [];
    const log = function (e) {
      try {
        const t = e.target && e.target.closest ? e.target.closest("[data-tab]") : null;
        window.__PTR__.push({ type: e.type, pointerType: e.pointerType === undefined ? null : e.pointerType, trusted: e.isTrusted, tab: t ? t.getAttribute("data-tab") : null });
      } catch (x) { /* noop */ }
    };
    ["pointerdown", "pointerup", "touchstart", "touchend", "click"].forEach(function (t) { document.addEventListener(t, log, true); });
  } catch (e) { /* noop */ }
  try {
    window.__ERRS__ = [];
    window.addEventListener("error", function (e) { window.__ERRS__.push(String(e && e.message ? e.message : e)); });
    window.addEventListener("unhandledrejection", function (e) { window.__ERRS__.push("unhandled rejection: " + String(e && e.reason && e.reason.message ? e.reason.message : e && e.reason)); });
  } catch (e) { /* noop */ }
  if (a && a.ui) { try { if (localStorage.getItem("mc_ui") === null) localStorage.setItem("mc_ui", JSON.stringify(a.ui)); } catch (e) { /* opaque origin */ } }
}

/* Measurement helpers, installed as window.__QA in every page and frame. Self-contained. */
function QA_HELPERS() {
  if (window.__QA) return;
  const vis = function (el) {
    if (!el || !el.getBoundingClientRect) return false;
    const b = el.getBoundingClientRect();
    if (!(b.width > 0 && b.height > 0)) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
  };
  const label = function (el) {
    if (!el || !el.tagName) return String(el);
    let s = el.tagName.toLowerCase();
    const c = el.getAttribute && el.getAttribute("class");
    if (c && typeof c === "string" && c.trim()) s += "." + c.trim().split(/\s+/).slice(0, 3).join(".");
    const t = el.getAttribute && (el.getAttribute("data-testid") || el.getAttribute("data-section") || el.getAttribute("data-tab"));
    if (t) s += "[" + t + "]";
    const x = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24);
    return x ? s + " «" + x + "»" : s;
  };
  /* IOS27-16 counter. Walks the text nodes under the root and keeps a node when its parent has
     client rects and is visibility:visible, and when no ancestor is <style>/<script>/[hidden]/
     aria-hidden. Inside a <select> only the selected <option> of a visible select counts, once.
     Nodes in one block container are concatenated (as innerText does for inline runs); a new block
     container starts a new word. innerText is returned beside it for the record only. */
  const words = function (sel) {
    const root = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!root) return { words: -1, inner: -1, text: "" };
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
    let n, text = "", last = null;
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
      text += (blk === last ? "" : " ") + v;
      last = blk;
    }
    const w = text.trim().split(/\s+/).filter(Boolean).length;
    const it = String(root.innerText || "").trim().split(/\s+/).filter(Boolean).length;
    return { words: w, inner: it, text: text.replace(/\s+/g, " ").trim() };
  };
  /* The qa/browser.py overflow walk: an element edge past the viewport is an offender unless an
     INNER scroll container still has the reach to bring it into view (the document panning
     sideways is the defect, never the excuse). */
  const walk = function (eps) {
    const e0 = eps === undefined ? 0.5 : eps;
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    let excused = 0;
    const all = document.querySelectorAll("body *");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
      let wr = null, wl = null;
      const rs = el.getClientRects();
      for (let k = 0; k < rs.length; k++) {
        const r = rs[k];
        if (r.width === 0 && r.height === 0) continue;
        if (!wr || r.right > wr.right) wr = r;
        if (!wl || r.left < wl.left) wl = r;
      }
      const chk = function (rect, side) {
        if (!rect) return;
        const over = side === "right" ? rect.right - vw : -rect.left;
        if (over <= e0) return;
        let reach = 0;
        for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
          const pcs = getComputedStyle(p);
          if (!/(auto|scroll)/.test(pcs.overflowX)) continue;
          const avail = side === "right" ? (p.scrollWidth - p.clientWidth - p.scrollLeft) : p.scrollLeft;
          if (avail > 1) reach += avail;
        }
        if (over - reach <= e0) excused++;
        else offenders.push({ el: label(el), side: side, over: Math.round(over * 100) / 100, reach: Math.round(reach * 100) / 100 });
      };
      chk(wr, "right"); chk(wl, "left");
    }
    offenders.sort(function (a, b) { return b.over - a.over; });
    const tabs = document.querySelector(".tabs");
    return {
      vw: vw, docSW: document.documentElement.scrollWidth, docCW: document.documentElement.clientWidth,
      stripSW: tabs ? tabs.scrollWidth : null, stripCW: tabs ? tabs.clientWidth : null,
      n: offenders.length, offenders: offenders.slice(0, 5), excused: excused
    };
  };
  const INTERACTIVE = 'button, a[href], input, select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"]';
  const interactive = function () {
    return Array.prototype.filter.call(document.querySelectorAll(INTERACTIVE.split(",").map(function (s) { return ".mc-root " + s.trim(); }).join(",")), vis);
  };
  const overlaps = function () {
    const els = interactive();
    const rects = els.map(function (e) { return e.getBoundingClientRect(); });
    const hits = [];
    let count = 0;
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
        const a = rects[i], b = rects[j];
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 0.5 && oy > 0.5) { count++; if (hits.length < 4) hits.push(label(els[i]) + " x " + label(els[j]) + " (" + ox.toFixed(1) + "x" + oy.toFixed(1) + ")"); }
      }
    }
    return { n: els.length, count: count, hits: hits };
  };
  const R = function (e) {
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { x: Math.round(b.left * 100) / 100, y: Math.round(b.top * 100) / 100, w: Math.round(b.width * 100) / 100, h: Math.round(b.height * 100) / 100, r: Math.round(b.right * 100) / 100, b: Math.round(b.bottom * 100) / 100 };
  };
  const floors = function () {
    const sels = [".btn", ".btn-sm", ".btn-ic", ".tabi", ".sec-h", ".menu-i", ".inp", ".row", ".reveal"];
    const out = { cls: {}, type: { px: 999, where: "" }, forms: [], header: null, overlaps: null };
    sels.forEach(function (s) {
      const o = { n: 0, minH: null, minW: null, whereH: "", whereW: "" };
      document.querySelectorAll(".mc-root " + s).forEach(function (el) {
        if (!vis(el)) return;
        o.n++;
        const b = el.getBoundingClientRect();
        if (o.minH === null || b.height < o.minH) { o.minH = b.height; o.whereH = label(el); }
        if (o.minW === null || b.width < o.minW) { o.minW = b.width; o.whereW = label(el); }
      });
      out.cls[s] = o;
    });
    document.querySelectorAll(".mc-root *").forEach(function (el) {
      if (el.tagName === "STYLE") return;
      let has = false;
      for (let i = 0; i < el.childNodes.length; i++) { const c = el.childNodes[i]; if (c.nodeType === 3 && c.nodeValue.trim()) { has = true; break; } }
      if (!has || !vis(el)) return;
      const f = parseFloat(getComputedStyle(el).fontSize);
      if (isFinite(f) && f < out.type.px) out.type = { px: f, where: label(el) };
    });
    document.querySelectorAll(".mc-root input, .mc-root select, .mc-root textarea").forEach(function (el) {
      if (!vis(el)) return;
      out.forms.push({ tag: el.tagName.toLowerCase(), id: el.getAttribute("data-testid") || el.getAttribute("aria-label") || el.type || "", fs: parseFloat(getComputedStyle(el).fontSize) });
    });
    const ref = document.querySelector('[data-testid="refresh"]'), men = document.querySelector('[data-testid="menu"]');
    const hr = document.querySelector(".hdr-r");
    out.header = {
      refresh: R(ref), menu: R(men), h1: R(document.querySelector('[data-testid="title"]')), hdr: R(document.querySelector(".hdr")),
      gapCss: hr ? getComputedStyle(hr).columnGap : null,
      gap: ref && men ? Math.round((men.getBoundingClientRect().left - ref.getBoundingClientRect().right) * 100) / 100 : null
    };
    out.overlaps = overlaps();
    return out;
  };
  const parseC = function (s) {
    const m = String(s || "").match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s\/]+([\d.]+%?))?\s*\)/);
    if (!m) return null;
    const a = m[4] === undefined ? 1 : (String(m[4]).slice(-1) === "%" ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a: a };
  };
  const lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = function (c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); };
  const ratio = function (a, b) { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const over = function (t, u) { return { r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 }; };
  const bgOf = function (el) {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parseC(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 0, g: 0, b: 0, a: 1 };
    if (layers.length && layers[layers.length - 1].a >= 1) base = layers.pop();
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const probe = function (prop, v) {
    const root = document.querySelector(".mc-root") || document.body;
    const s = document.createElement("span");
    s.style[prop] = v;
    root.appendChild(s);
    const c = getComputedStyle(s)[prop];
    s.remove();
    return c;
  };
  /* Text contrast against the effective background (alpha layers composited, element opacity
     applied to the text). mode "all": every visible text element; mode "tokens": only text whose
     computed colour is the resolved --dim or --mute. Disabled controls are counted and excluded
     (WCAG 1.4.3 exempts inactive components). SVG text is judged by its fill. */
  const contrast = function (mode) {
    const root = document.querySelector(".mc-root");
    if (!root) return null;
    const tok = { dim: probe("color", "var(--dim)"), mute: probe("color", "var(--mute)"), line: probe("color", "var(--line)"), bg2: probe("color", "var(--bg2)") };
    const pl = parseC(tok.line), pb = parseC(tok.bg2);
    const res = { mode: mode, n: 0, min: null, worst: [], disabled: 0, unparsed: 0, dim: { n: 0, min: null }, mute: { n: 0, min: null }, tok: tok, lineOnBg2: pl && pb ? Math.round(ratio(pl, pb) * 100) / 100 : null };
    const all = root.querySelectorAll("*");
    const rows = [];
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.tagName === "STYLE") continue;
      let has = false;
      for (let k = 0; k < el.childNodes.length; k++) { const c = el.childNodes[k]; if (c.nodeType === 3 && c.nodeValue.trim()) { has = true; break; } }
      if (!has || !vis(el)) continue;
      if (el.closest('button:disabled, input:disabled, select:disabled, textarea:disabled, fieldset:disabled, [aria-disabled="true"]')) { res.disabled++; continue; }
      const cs = getComputedStyle(el);
      const svg = el.namespaceURI === "http://www.w3.org/2000/svg";
      const fgStr = svg ? cs.fill : cs.color;
      const fg0 = parseC(fgStr);
      if (!fg0) { res.unparsed++; continue; }
      let host = el;
      if (svg) { while (host && host.namespaceURI === "http://www.w3.org/2000/svg") host = host.parentElement; }
      const bg = bgOf(host || el);
      let op = 1;
      for (let p = el; p && p.nodeType === 1; p = p.parentElement) op *= Number(getComputedStyle(p).opacity);
      const fg = over({ r: fg0.r, g: fg0.g, b: fg0.b, a: fg0.a * op }, bg);
      const cr = Math.round(ratio(fg, bg) * 100) / 100;
      const isDim = !svg && cs.color === tok.dim, isMute = !svg && cs.color === tok.mute;
      if (mode === "tokens" && !isDim && !isMute) continue;
      res.n++;
      if (isDim) { res.dim.n++; if (res.dim.min === null || cr < res.dim.min) res.dim.min = cr; }
      if (isMute) { res.mute.n++; if (res.mute.min === null || cr < res.mute.min) res.mute.min = cr; }
      if (res.min === null || cr < res.min) res.min = cr;
      rows.push({ cr: cr, fg: fgStr, bg: "rgb(" + [bg.r, bg.g, bg.b].map(Math.round).join(", ") + ")", fs: cs.fontSize, el: label(el) });
    }
    rows.sort(function (a, b) { return a.cr - b.cr; });
    res.worst = rows.slice(0, 5);
    return res;
  };
  /* Every control keeps a visible edge: a border on some side or an outline (forced colours). */
  const edges = function () {
    const bad = [];
    const els = interactive();
    els.forEach(function (el) {
      const cs = getComputedStyle(el);
      const b = ["Top", "Right", "Bottom", "Left"].some(function (s) { return parseFloat(cs["border" + s + "Width"]) > 0 && cs["border" + s + "Style"] !== "none" && cs["border" + s + "Style"] !== "hidden"; });
      const o = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      if (!b && !o) bad.push(label(el));
    });
    return { n: els.length, bad: bad.length, sample: bad.slice(0, 5) };
  };
  /* CSSOM audit of the app's own style block. */
  const cssom = function () {
    const out = { sheets: 0, rootVars: {}, consume: {}, mcRootProps: [], s27outside: [], schemeRules: 0, lightDark: 0, rules: 0 };
    const S27 = [
      { name: "appearance: base-select", re: /appearance\s*:\s*base-select/ },
      { name: "sizing keyword stretch", re: /(?:^|[;{\s])(?:width|height|min-width|min-height|max-width|max-height|inline-size|block-size)\s*:\s*stretch\b/ },
      { name: ":heading", re: /:heading\b/ }, { name: "revert-rule", re: /revert-rule/ }, { name: "alpha()", re: /(?:^|[^\w-])alpha\(/ },
      { name: "::picker", re: /::picker\b/ }, { name: "::checkmark", re: /::checkmark\b/ },
      { name: "image(<color>)", re: /(?:^|[^\w-])image\(\s*(?:#|rgb|hsl|oklch|var\()/ }, { name: "light-dark() with images", re: /light-dark\(\s*url\(/ }
    ];
    const isSup = function (r) { return typeof CSSSupportsRule !== "undefined" && r instanceof CSSSupportsRule; };
    const visit = function (rules, inSup) {
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        out.rules++;
        const txt = r.cssText || "";
        if (r.type === 1) {
          const parts = String(r.selectorText || "").split(",").map(function (s) { return s.trim(); });
          if (parts.indexOf(":root") >= 0) {
            for (let k = 0; k < r.style.length; k++) { const p = r.style[k]; if (p.indexOf("--") === 0) out.rootVars[p] = r.style.getPropertyValue(p).trim(); }
          }
          if (String(r.selectorText).trim() === ".mc-root" && !r.parentRule) {
            for (let k = 0; k < r.style.length; k++) { const p = r.style[k]; if (p.indexOf("--") === 0) out.mcRootProps.push({ name: p, value: r.style.getPropertyValue(p).trim() }); }
          }
          [".hdr", ".tabs", ".wrap", ".menu", ".mc-root"].forEach(function (cls) {
            if (parts.indexOf(cls) >= 0) (out.consume[cls] = out.consume[cls] || []).push(r.style.cssText);
          });
          if (!inSup) S27.forEach(function (p) { if (p.re.test(txt)) out.s27outside.push(p.name + " in «" + txt.slice(0, 70) + "»"); });
        }
        if (r.type === 4 && r.media && /prefers-color-scheme/.test(r.media.mediaText)) out.schemeRules++;
        if (/light-dark\(/.test(txt)) out.lightDark++;
        if (r.cssRules && r.type !== 1) visit(r.cssRules, inSup || isSup(r));
      }
    };
    for (let i = 0; i < document.styleSheets.length; i++) {
      let rules;
      try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
      out.sheets++;
      visit(rules, false);
    }
    return out;
  };
  const tokens = function () {
    const root = document.querySelector(".mc-root");
    const a = cssom();
    const cs = root ? getComputedStyle(root) : null;
    return a.mcRootProps.map(function (p) { return { name: p.name, declared: p.value, computed: cs ? cs.getPropertyValue(p.name).trim() : null }; });
  };
  /* The app's saved value for a key, read back through window.storage (the dist shim or an
     artifact store) and decoded whether it was stored as an object or as text. */
  const readKey = async function (k) {
    try {
      const r = await window.storage.get(k);
      let v = r && typeof r === "object" && "value" in r ? r.value : r;
      if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { /* keep the text */ } }
      return v === undefined ? null : v;
    } catch (e) { return null; }
  };
  /* A landing note: the smallest visible element whose text matches, whether it sits inside
     .landing, and the landing's word count with the note's words added when it sits outside. */
  const noteOn = function (src) {
    const re = new RegExp(src, "i");
    const root = document.querySelector(".mc-root");
    const land = words(".landing");
    if (!root) return { found: false, landing: land.words, total: land.words };
    let best = null;
    root.querySelectorAll("*").forEach(function (el) {
      if (el.tagName === "STYLE" || !vis(el)) return;
      const t = el.textContent || "";
      if (!re.test(t)) return;
      if (!best || t.length < (best.textContent || "").length) best = el;
    });
    if (!best) return { found: false, landing: land.words, total: land.words };
    const inLanding = !!best.closest(".landing");
    const w = words(best);
    return { found: true, inLanding: inLanding, text: w.text.slice(0, 120), landing: land.words, total: inLanding ? land.words : land.words + w.words, el: label(best) };
  };
  const rectOf = R;
  window.__QA = { vis: vis, label: label, words: words, walk: walk, overlaps: overlaps, floors: floors, contrast: contrast, edges: edges, cssom: cssom, tokens: tokens, rect: rectOf, interactive: interactive, parseC: parseC, ratio: ratio, noteOn: noteOn, readKey: readKey };
}

/* SIM: standalone. matchMedia answers display-mode standalone (and any list naming it) true and
   display-mode browser false; Navigator.prototype.standalone is true; every CSSMediaRule naming
   display-mode standalone is promoted to "all" (and a lone browser rule to "not all") whenever a
   <style> lands. A plain EventTarget with defineProperties stands in for MediaQueryList (the
   research found that patching the real prototype throws). */
function SIM_INIT() {
  try {
    const mm = window.matchMedia.bind(window);
    const fake = function (q, on) {
      const o = new EventTarget();
      Object.defineProperties(o, { matches: { value: on, enumerable: true }, media: { value: q, enumerable: true }, onchange: { value: null, writable: true }, addListener: { value: function () {} }, removeListener: { value: function () {} } });
      return o;
    };
    window.matchMedia = function (q) {
      const s = String(q);
      if (/display-mode\s*:\s*standalone/.test(s)) return fake(s, true);
      if (/^\s*\(\s*display-mode\s*:\s*browser\s*\)\s*$/.test(s)) return fake(s, false);
      return mm(q);
    };
    Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: function () { return true; } });
    const promote = function () {
      const visit = function (rules) {
        for (let i = 0; i < rules.length; i++) {
          const r = rules[i];
          if (r.type === 4 && r.media) {
            const t = r.media.mediaText;
            if (/display-mode\s*:\s*standalone/.test(t) && t !== "all") r.media.mediaText = "all";
            else if (/^\(\s*display-mode\s*:\s*browser\s*\)$/.test(t)) r.media.mediaText = "not all";
          }
          if (r.cssRules) visit(r.cssRules);
        }
      };
      for (let k = 0; k < document.styleSheets.length; k++) { let rs; try { rs = document.styleSheets[k].cssRules; } catch (e) { continue; } visit(rs); }
    };
    window.__SIM_PROMOTE__ = promote;
    const mo = new MutationObserver(function (ms) {
      for (let i = 0; i < ms.length; i++) {
        const m = ms[i];
        if (m.target && m.target.nodeName === "STYLE") { promote(); return; }
        for (let k = 0; k < m.addedNodes.length; k++) { const n = m.addedNodes[k]; if (n.nodeName === "STYLE" || (n.querySelector && n.querySelector("style"))) { promote(); return; } }
      }
    });
    const arm = function () { try { mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true }); } catch (e) { /* noop */ } promote(); };
    if (document.documentElement) arm(); else document.addEventListener("DOMContentLoaded", arm);
    window.__SIM__ = true;
  } catch (e) { window.__SIM_ERR__ = String(e && e.message ? e.message : e); }
}

/* IOS27-04 shell A: a strict text-only window.storage (the artifact contract: text only). set
   rejects with a TypeError on a non-string; get answers {key, value:string}. Backed by
   localStorage under "qaA:" so it survives a reload, and so a copy the app writes to plain
   localStorage (its old fallback) can never be what restores it. */
function SHELL_A() {
  try {
    const P = "qaA:";
    window.storage = {
      get: function (k) {
        return new Promise(function (res) { let v = null; try { v = localStorage.getItem(P + k); } catch (e) { v = null; } res(v === null ? null : { key: k, value: v }); });
      },
      set: function (k, v) {
        if (typeof v !== "string") {
          try { sessionStorage.setItem("qaA:typeErrors", String(Number(sessionStorage.getItem("qaA:typeErrors") || 0) + 1)); } catch (e) { /* noop */ }
          return Promise.reject(new TypeError("window.storage.set: the value must be a string (artifact storage is text only)"));
        }
        try { localStorage.setItem(P + k, v); } catch (e) { /* noop */ }
        return Promise.resolve({ key: k, value: v });
      }
    };
  } catch (e) { /* noop */ }
}
/* IOS27-04 shell B: set resolves, get always answers null (storage that never comes back). */
function SHELL_B() {
  try {
    window.__QA_B__ = { sets: 0 };
    window.storage = { get: function () { return Promise.resolve(null); }, set: function (k, v) { window.__QA_B__.sets++; return Promise.resolve({ key: k, value: v }); } };
  } catch (e) { /* noop */ }
}
/* An in-memory text store standing in for the artifact's window.storage (no __shim marker). */
function ARTIFACT_MEM() {
  try {
    const mem = {};
    window.storage = {
      get: function (k) { return Promise.resolve(Object.prototype.hasOwnProperty.call(mem, k) ? { key: k, value: mem[k] } : null); },
      set: function (k, v) { mem[k] = typeof v === "string" ? v : JSON.stringify(v); return Promise.resolve({ key: k, value: mem[k] }); }
    };
  } catch (e) { /* noop */ }
}
function PERSIST_SPY() {
  window.__PERSIST__ = { calls: 0, present: false };
  try {
    if (typeof StorageManager !== "undefined" && StorageManager.prototype && typeof StorageManager.prototype.persist === "function") {
      window.__PERSIST__.present = true;
      const orig = StorageManager.prototype.persist;
      StorageManager.prototype.persist = function () {
        window.__PERSIST__.calls++;
        try { return orig.apply(this, arguments); } catch (e) { return Promise.resolve(false); }
      };
    }
  } catch (e) { /* noop */ }
}
function PERSIST_DELETE() {
  try { if (typeof StorageManager !== "undefined") delete StorageManager.prototype.persist; } catch (e) { /* noop */ }
  window.__PERSIST_GONE__ = !(navigator.storage && typeof navigator.storage.persist === "function");
}
/* IOS27-10 in dist. A page served under a service worker sends its cross-origin fetches through
   the worker, where Playwright's route() cannot see them (measured: the POST reached the real
   network). So the page's own fetch is wrapped: every call to api.anthropic.com is logged (method
   and all, in sessionStorage so a reload keeps it) and answered locally with a 401; the FPL public
   endpoint is refused the way a browser's origin rules refuse it. Nothing leaves the machine. */
function FETCH_MOCK() {
  try {
    const f = window.fetch;
    window.fetch = function (input, init) {
      const u = typeof input === "string" ? input : (input && input.url) || "";
      try {
        if (/api\.anthropic\.com/.test(u)) {
          const m = (init && init.method) || (input && input.method) || "GET";
          sessionStorage.setItem("qa:anthropic", (sessionStorage.getItem("qa:anthropic") || "") + String(m).toUpperCase() + " ");
          return Promise.resolve(new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "ios suite: no key in dist" } }), { status: 401, headers: { "Content-Type": "application/json" } }));
        }
        if (/fantasy\.premierleague\.com/.test(u)) return Promise.reject(new TypeError("Load failed"));
      } catch (e) { /* fall through */ }
      return f.apply(this, arguments);
    };
  } catch (e) { /* noop */ }
}
function SHARE_STUB() {
  window.__QA_SHARE__ = [];
  try {
    Object.defineProperty(navigator, "canShare", { configurable: true, writable: true, value: function (d) { return !!(d && d.files && d.files.length); } });
    Object.defineProperty(navigator, "share", {
      configurable: true, writable: true,
      value: function (d) {
        const files = (d && d.files) || [];
        return Promise.all(Array.prototype.map.call(files, function (f) { return f.text().then(function (t) { return { name: f.name, type: f.type, text: t }; }); }))
          .then(function (list) { window.__QA_SHARE__.push({ title: d && d.title, files: list }); });
      }
    });
  } catch (e) { window.__QA_SHARE_ERR__ = String(e && e.message ? e.message : e); }
}
/* IOS27-11 fallback run: whatever this engine ships, ariaNotify is removed, so the role=status path is
   the one under test (a WebKit that gains ariaNotify would otherwise leave the fallback unprovable). */
function ARIA_REMOVE() {
  window.__QA_ARIA_NATIVE__ = typeof Element !== "undefined" && typeof Element.prototype.ariaNotify === "function" ? "function" : "undefined";
  try { delete Element.prototype.ariaNotify; } catch (e) { /* noop */ }
  try { delete Document.prototype.ariaNotify; } catch (e) { /* noop */ }
}
function ARIA_SPY() {
  window.__QA_ARIA__ = [];
  const spy = function (msg) { window.__QA_ARIA__.push({ msg: String(msg), refbar: !!document.querySelector(".refbar"), t: Date.now() }); };
  try { Element.prototype.ariaNotify = spy; } catch (e) { /* noop */ }
  try { Document.prototype.ariaNotify = spy; } catch (e) { /* noop */ }
}

// ---------------------------------------------------------------- page helpers

const IGNORABLE = /Failed to load resource|Load failed|net::ERR_|XMLHttpRequest|Fetch API|Origin .* is not allowed|access control checks/i;
function watch(page, sink, tag) {
  page.on("pageerror", function (e) { sink.push(tag + " pageerror: " + short(e)); });
  page.on("console", function (m) {
    if (m.type() !== "error") return;
    const t = m.text();
    if (IGNORABLE.test(t)) { sink.ignored = (sink.ignored || 0) + 1; return; }
    sink.push(tag + " console: " + t.slice(0, 200));
  });
}
async function mount(page, url, timeout) {
  await page.goto(url, { waitUntil: "load", timeout: timeout || 45000 });
  await page.waitForSelector(".mc-root", { timeout: 30000 });
}
async function tapTab(page, id) {
  await page.tap('.tabs [data-tab="' + id + '"]');
  await page.waitForFunction(function (x) { const r = document.querySelector(".mc-root"); return !!r && r.getAttribute("data-view") === x; }, id, { timeout: 15000 });
}
async function goFull(page) {
  const mode = await page.getAttribute(".mc-root", "data-mode");
  if (mode !== "full") {
    await page.tap('[data-testid="menu"]');
    await page.waitForSelector('.menu-i[data-mode="full"]', { timeout: 10000 });
    await page.tap('.menu-i[data-mode="full"]');
  }
  await page.waitForSelector(".tabs [data-tab]", { timeout: 15000 });
  return page.$$eval(".tabs [data-tab]", function (els) { return els.map(function (e) { return e.getAttribute("data-tab"); }); });
}
/* Opens every closed Section and Reveal on the current tab, tap by tap (trusted touch), in rounds
   so nested ones that appear are opened too. A header that cannot be tapped (re-rendered away,
   obscured) falls back to a DOM click, and the fallbacks are counted and reported. */
async function openAll(page) {
  let tapped = 0, fallback = 0;
  for (let round = 0; round < 4; round++) {
    const sels = await page.evaluate(function (rnd) {
      const out = [];
      let i = 0;
      document.querySelectorAll('.mc-root .sec-h[aria-expanded="false"], .mc-root .reveal[aria-expanded="false"]').forEach(function (b) {
        if (!window.__QA.vis(b)) return;
        const k = "o" + rnd + "-" + (i++);
        b.setAttribute("data-qa-open", k);
        out.push('[data-qa-open="' + k + '"]');
      });
      return out;
    }, round);
    if (!sels.length) break;
    for (const s of sels) {
      try { await page.tap(s, { timeout: 2500 }); tapped++; }
      catch (e) {
        const ok = await page.evaluate(function (q) { const b = document.querySelector(q); if (b && b.getAttribute("aria-expanded") === "false") { b.click(); return true; } return false; }, s).catch(function () { return false; });
        if (ok) fallback++;
      }
    }
    await page.waitForTimeout(120);
  }
  return { tapped: tapped, fallback: fallback };
}
async function setInsets(page, ins) {
  await page.evaluate(function (v) {
    const st = document.documentElement.style;
    ["sat", "sar", "sab", "sal"].forEach(function (k) { if (v === null) st.removeProperty("--" + k); else st.setProperty("--" + k, v[k] + "px"); });
  }, ins);
}
async function landmarks(page) {
  return page.evaluate(function () {
    const q = function (s) { return window.__QA.rect(document.querySelector(s)); };
    return { hdr: q(".hdr"), h1: q('[data-testid="title"]'), refresh: q('[data-testid="refresh"]'), menu: q('[data-testid="menu"]'), tabs: q(".tabs"), wrap: q(".wrap"), tab0: q(".tabs [data-tab]") };
  });
}
function sameRects(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function anthropicBodyOk() {
  const els = [];
  for (let i = 1; i <= 30; i++) els.push({ id: i, status: "a", chance: 100, news: "" });
  return {
    id: "msg_qa_ios", type: "message", role: "assistant", model: "claude-sonnet-4-6", stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 12 }, content: [{ type: "text", text: JSON.stringify({ elements: els }) }]
  };
}
const BODY_400 = { type: "error", error: { type: "invalid_request_error", message: "ios suite: a deliberate 400 for the refresh-outcome checks" } };

/* A marker player for the storage and import checks: the first element in data/live.json that is
   not in the given squad and plays the same position as the pick it replaces, with a unique name. */
function markerFor(squadIds) {
  if (!LIVE || !Array.isArray(LIVE.elements)) return null;
  const byId = {};
  LIVE.elements.forEach(function (e) { byId[e.id] = e; });
  const last = byId[squadIds[squadIds.length - 1]];
  const names = {};
  LIVE.elements.forEach(function (e) { names[e.web_name] = (names[e.web_name] || 0) + 1; });
  const m = LIVE.elements.filter(function (e) {
    return squadIds.indexOf(e.id) < 0 && (!last || e.element_type === last.element_type) && names[e.web_name] === 1 && /^[A-Za-z][A-Za-z .'-]{3,}$/.test(e.web_name);
  })[0];
  return m ? { id: m.id, name: m.web_name } : null;
}

// ---------------------------------------------------------------- the matrix (one context each)

function matrixSpecs() {
  const out = [];
  PROFILES.forEach(function (p) {
    ORIENTS.forEach(function (o) {
      SCHEMES.forEach(function (s) {
        [false, true].forEach(function (sim) {
          const dark = s === "dark";
          const spec = { profile: p, orient: o, scheme: s, sim: sim, key: slug(p) + "-" + o + "-" + s + (sim ? "-sim" : "") };
          spec.deep = !sim && dark;
          spec.simGeom = sim && dark;
          spec.cssom = !sim && dark && p === "iPhone 17" && o === "portrait";
          spec.jump = dark && p === "iPhone 17" && o === "portrait";
          spec.contrast = !sim && dark && p === "iPhone 17 Pro" && o === "portrait";
          spec.readout = dark && p === "iPhone 17 Pro" && o === "portrait";
          spec.fixture = !sim && dark && p === "iPhone 17 Pro" && o === "portrait";
          out.push(spec);
        });
      });
    });
  });
  return out;
}

async function runMatrix(env, spec) {
  const pw = env.pw, browser = env.browser, S = env.main;
  const m = { spec: spec, errors: [], t: {} };
  const d = pw.devices[spec.profile + (spec.orient === "landscape" ? " landscape" : "")];
  const opts = Object.assign({}, d, { colorScheme: spec.scheme, serviceWorkers: "block" });
  if (spec.sim) opts.viewport = spec.orient === "portrait" ? { width: d.screen.width, height: d.screen.height } : { width: d.screen.height, height: d.screen.width };
  m.viewport = opts.viewport;
  const t0 = Date.now();
  const ctx = await browser.newContext(opts);
  try {
    await ctx.addInitScript(INIT, { now: NOW, ui: null });
    await ctx.addInitScript(QA_HELPERS);
    if (spec.sim) await ctx.addInitScript(SIM_INIT);
    const page = await ctx.newPage();
    watch(page, m.errors, spec.key);
    await mount(page, S.origin + "/index.html");
    m.t.boot = Date.now() - t0;
    if (spec.sim) {
      m.simState = await page.evaluate(function () {
        return { flag: window.__SIM__ === true, err: window.__SIM_ERR__ || "", standalone: matchMedia("(display-mode: standalone)").matches, browser: matchMedia("(display-mode: browser)").matches, nav: navigator.standalone === true, inner: [innerWidth, innerHeight] };
      });
    }
    // the first paint: simple mode, landing card
    m.mode0 = await page.getAttribute(".mc-root", "data-mode");
    m.landing = await page.evaluate(function () { return window.__QA.words(".landing"); });
    m.importNote = await page.evaluate(function () { return window.__QA.noteOn("New here\\?|Import the export from Safari"); });
    // full mode and every tab the strip offers, by tap
    m.tabs = await goFull(page);
    m.tabRuns = [];
    for (const t of m.tabs) {
      await page.evaluate(function () { window.__PTR__ = []; });
      let switched = true;
      try { await tapTab(page, t); } catch (e) { switched = false; }
      await page.waitForTimeout(60);
      const r = await page.evaluate(function () {
        const root = document.querySelector(".mc-root");
        return { ptr: window.__PTR__.slice(), view: root.getAttribute("data-view"), words: window.__QA.words(".mc-root"), boundary: root.querySelectorAll(".boundary").length, sections: root.querySelectorAll(".section").length, walk: window.__QA.walk(0.5) };
      });
      r.id = t; r.switched = switched;
      m.tabRuns.push(r);
    }
    await tapTab(page, m.tabs[0]);
    if (spec.sim) {
      // control: with no override, env() is 0 here; forcing the four variables to 0px must change nothing
      const r0 = await landmarks(page);
      await setInsets(page, { sat: 0, sar: 0, sab: 0, sal: 0 });
      await page.waitForTimeout(50);
      const r1 = await landmarks(page);
      m.control = { same: sameRects(r0, r1), r0: r0, r1: r1 };
      await setInsets(page, SIM_INSETS[spec.orient]);
    }
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.waitForTimeout(400);
    const file = path.join(SHOTS, "ios-" + slug(spec.profile) + "-" + spec.orient + "-" + spec.scheme + (spec.sim ? "-sim" : "") + ".png");
    const png = await page.screenshot({ path: file });
    m.shot = { file: path.relative(ROOT, file), size: pngSize(png), hash: sha(png), bytes: png.length };
    if (spec.cssom) m.cssom = await page.evaluate(function () { return window.__QA.cssom(); });
    if (spec.simGeom) m.geom = await simGeometry(page, spec);
    if (spec.deep) m.deep = await deepPass(page, m.tabs, spec);
    if (spec.jump) m.jump = await jumpChecks(page, m.tabs);
    if (spec.readout) m.readout = await readout(page, m.tabs);
    if (spec.fixture) m.fixture = await optionFixture(page);
  } catch (e) {
    m.fatal = short(e);
  } finally {
    m.t.total = Date.now() - t0;
    await ctx.close().catch(function () {});
  }
  return m;
}

/* IOS27-02 under SIM insets (placeholders). */
async function simGeometry(page, spec) {
  const ins = SIM_INSETS[spec.orient];
  const g = { ins: ins };
  g.top = await page.evaluate(function (v) {
    const Q = window.__QA;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const bad = [];
    Q.interactive().forEach(function (e) {
      const b = e.getBoundingClientRect(), lab = Q.label(e);
      let fixed = false;
      for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === "fixed") { fixed = true; break; } }
      if (v.sal > 0 && b.left < v.sal - 0.5) bad.push(lab + " left " + b.left.toFixed(1));
      if (v.sar > 0 && b.right > vw - v.sar + 0.5) bad.push(lab + " right " + b.right.toFixed(1) + " > " + (vw - v.sar));
      if (v.sat > 0 && b.top < v.sat - 0.5 && b.bottom > 0) bad.push(lab + " top " + b.top.toFixed(1) + " < " + v.sat);
      if (v.sab > 0 && fixed && b.bottom > vh - v.sab + 0.5) bad.push(lab + " bottom " + b.bottom.toFixed(1) + " > " + (vh - v.sab));
    });
    const tabs = document.querySelectorAll(".tabs [data-tab]");
    return {
      vw: vw, vh: vh, h1: Q.rect(document.querySelector('[data-testid="title"]')), refresh: Q.rect(document.querySelector('[data-testid="refresh"]')),
      menu: Q.rect(document.querySelector('[data-testid="menu"]')), hdr: Q.rect(document.querySelector(".hdr")),
      firstTab: Q.rect(tabs[0]), lastTab: Q.rect(tabs[tabs.length - 1]), bandHits: bad.length, bandSample: bad.slice(0, 4), n: Q.interactive().length
    };
  }, ins);
  // scrolled: the sticky strip and the status-bar band (the page must scroll past the strip's own offset to pin it)
  g.tabsAt0 = await page.evaluate(function () { const t = document.querySelector(".tabs"); return t ? Math.round(t.getBoundingClientRect().top * 100) / 100 : null; });
  g.scrolled = await page.evaluate(function () {
    window.scrollTo(0, 800);
    const t = document.querySelector(".tabs");
    const probe = document.createElement("span");
    probe.style.background = "var(--bg2)";
    (document.querySelector(".mc-root") || document.body).appendChild(probe);
    const bg2 = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { y: window.scrollY, tabsTop: t ? Math.round(t.getBoundingClientRect().top * 100) / 100 : null, bg2: bg2 };
  });
  await page.waitForTimeout(150);
  g.scrolled.tabsTop = await page.evaluate(function () { const t = document.querySelector(".tabs"); return t ? Math.round(t.getBoundingClientRect().top * 100) / 100 : null; });
  if (ins.sat > 0) {
    const png = await page.screenshot();
    const img = decodePNG(png);
    const c = await page.evaluate(function (s) { return window.__QA.parseC(s); }, g.scrolled.bg2);
    const off = function (im, i) { return Math.abs(im.data[i] - c.r) > 3 || Math.abs(im.data[i + 1] - c.g) > 3 || Math.abs(im.data[i + 2] - c.b) > 3; };
    /* Engine artefact, measured rather than assumed: this WebKit build paints the top-left CSS
       pixel of ANY focused page rgb(54, 58, 66), a plain solid page included (measured in a
       scratch probe). The same page, in the same state, under a full-viewport --bg2 overlay at the
       top of the stack, shows which device pixels the engine itself spoils; exactly those are
       masked and counted. */
    const mask = new Set();
    await page.evaluate(function (bg) { const d = document.createElement("div"); d.id = "qa-mask-probe"; d.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;background:" + bg; document.body.appendChild(d); }, g.scrolled.bg2);
    try {
      const ci = decodePNG(await page.screenshot());
      if (ci.w === img.w) for (let i = 0, p = 0; p < ci.w * Math.min(ci.h, img.h); p++, i += ci.bpp) if (off(ci, i)) mask.add(p);
    } finally { await page.evaluate(function () { const d = document.getElementById("qa-mask-probe"); if (d) d.remove(); }); }
    const rows = Math.round(ins.sat * img.h / g.top.vh);
    let n = 0, bad = 0, masked = 0, sample = null;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < img.w; x++) {
        const p = y * img.w + x, i = p * img.bpp;
        if (mask.has(p)) { masked++; continue; }
        n++;
        if (off(img, i)) { bad++; if (!sample) sample = "(" + x + "," + y + ") rgb(" + img.data[i] + ", " + img.data[i + 1] + ", " + img.data[i + 2] + ")"; }
      }
    }
    g.scrim = { rows: rows, pixels: n, off: bad, masked: masked, sample: sample, want: g.scrolled.bg2 };
  }
  // the menu against the header
  await page.evaluate(function () { window.scrollTo(0, 0); });
  await page.waitForTimeout(80);
  try {
    await page.tap('[data-testid="menu"]');
    await page.waitForSelector(".menu", { timeout: 5000 });
    g.menu = await page.evaluate(function () { return { menu: window.__QA.rect(document.querySelector(".menu")), hdr: window.__QA.rect(document.querySelector(".hdr")) }; });
    await page.tap('[data-testid="menu"]');
  } catch (e) { g.menuErr = short(e); }
  // the end of the scroll
  g.end = await page.evaluate(function () {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const w = document.querySelector(".wrap");
    return { y: window.scrollY, wrapBottom: w ? Math.round(w.getBoundingClientRect().bottom * 100) / 100 : null, vh: window.innerHeight };
  });
  await page.waitForTimeout(100);
  g.end.wrapBottom = await page.evaluate(function () { const w = document.querySelector(".wrap"); return w ? Math.round(w.getBoundingClientRect().bottom * 100) / 100 : null; });
  await page.evaluate(function () { window.scrollTo(0, 0); });
  return g;
}

/* Every section and reveal opened on every tab, then the floors, form fonts, overlaps and the
   element walk re-measured; the menu opened for .menu-i. */
async function deepPass(page, tabs, spec) {
  const acc = { cls: {}, type: { px: 999, where: "" }, forms: [], overlaps: { count: 0, hits: [], n: 0 }, header: null, walks: [], contrast: null, opened: { tapped: 0, fallback: 0 } };
  const mergeFloors = function (f, where) {
    Object.keys(f.cls).forEach(function (k) {
      const o = f.cls[k], a = acc.cls[k] || (acc.cls[k] = { n: 0, minH: null, minW: null, whereH: "", whereW: "" });
      a.n += o.n;
      if (o.minH !== null && (a.minH === null || o.minH < a.minH)) { a.minH = o.minH; a.whereH = o.whereH + " on " + where; }
      if (o.minW !== null && (a.minW === null || o.minW < a.minW)) { a.minW = o.minW; a.whereW = o.whereW + " on " + where; }
    });
    if (f.type.px < acc.type.px) acc.type = { px: f.type.px, where: f.type.where + " on " + where };
    f.forms.forEach(function (x) { acc.forms.push(Object.assign({ where: where }, x)); });
  };
  for (const t of tabs) {
    await tapTab(page, t);
    const o = await openAll(page);
    acc.opened.tapped += o.tapped; acc.opened.fallback += o.fallback;
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.waitForTimeout(120);
    const f = await page.evaluate(function () { return window.__QA.floors(); });
    mergeFloors(f, t);
    if (!acc.header) acc.header = f.header;
    acc.overlaps.n += f.overlaps.n;
    acc.overlaps.count += f.overlaps.count;
    f.overlaps.hits.forEach(function (h) { if (acc.overlaps.hits.length < 4) acc.overlaps.hits.push(h + " on " + t); });
    const w = await page.evaluate(function () { return window.__QA.walk(0.5); });
    w.tab = t;
    acc.walks.push(w);
    if (spec.contrast) {
      const c = await page.evaluate(function () { return window.__QA.contrast("all"); });
      if (!acc.contrast) acc.contrast = { n: 0, min: null, worst: [], disabled: 0, unparsed: 0, tok: c.tok };
      acc.contrast.n += c.n; acc.contrast.disabled += c.disabled; acc.contrast.unparsed += c.unparsed;
      if (c.min !== null && (acc.contrast.min === null || c.min < acc.contrast.min)) acc.contrast.min = c.min;
      c.worst.forEach(function (x) { acc.contrast.worst.push(Object.assign({ tab: t }, x)); });
    }
  }
  if (acc.contrast) { acc.contrast.worst.sort(function (a, b) { return a.cr - b.cr; }); acc.contrast.worst = acc.contrast.worst.slice(0, 5); }
  await page.evaluate(function () { window.scrollTo(0, 0); });
  try {
    await page.tap('[data-testid="menu"]');
    await page.waitForSelector(".menu-i", { timeout: 5000 });
    const f = await page.evaluate(function () { return window.__QA.floors(); });
    mergeFloors(f, "menu");
    await page.tap('[data-testid="menu"]');
  } catch (e) { acc.menuErr = short(e); }
  return acc;
}

/* IOS27-08: a tab switch from deep in a long tab, and the menu jump to Import. */
async function jumpChecks(page, tabs) {
  const has = function (id) { return tabs.indexOf(id) >= 0; };
  const out = { planId: has("plan") ? "plan" : tabs[1], squadId: has("squad") ? "squad" : tabs[2], nowId: tabs[0] };
  try {
    await tapTab(page, out.planId);
    await openAll(page);
    await page.waitForTimeout(150);
    out.scrolledTo = await page.evaluate(function () { window.scrollTo(0, 2000); return window.scrollY; });
    await page.waitForTimeout(150);
    await tapTab(page, out.squadId);
    await page.waitForTimeout(350);
    out.tab = await page.evaluate(function () {
      const s = document.querySelector(".wrap .section"), t = document.querySelector(".tabs");
      return { y: window.scrollY, first: s ? s.getAttribute("data-section") : null, top: s ? Math.round(s.getBoundingClientRect().top * 100) / 100 : null, tabsBottom: t ? Math.round(t.getBoundingClientRect().bottom * 100) / 100 : null };
    });
    await tapTab(page, out.nowId);
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.waitForTimeout(150);
    await page.tap('[data-testid="menu"]');
    await page.waitForSelector(".menu-i", { timeout: 5000 });
    const sel = (await page.$('.menu-i[data-menu="import"]')) ? '.menu-i[data-menu="import"]' : ".menu-i >> text=/import/i";
    await page.tap(sel);
    await page.waitForTimeout(600);
    out.jump = await page.evaluate(function () {
      const s = document.querySelector('[data-section="lab-import"]'), t = document.querySelector(".tabs"), ae = document.activeElement;
      const h = s ? s.querySelector(".sec-h") : null;
      return {
        view: document.querySelector(".mc-root").getAttribute("data-view"), y: window.scrollY, vh: window.innerHeight,
        top: s ? Math.round(s.getBoundingClientRect().top * 100) / 100 : null, tabsBottom: t ? Math.round(t.getBoundingClientRect().bottom * 100) / 100 : null,
        active: ae ? window.__QA.label(ae) : null, activeIsSecH: !!(h && ae === h)
      };
    });
  } catch (e) { out.err = short(e); }
  return out;
}

/* IOS27-15: the Lab device readout, opened by tap, read as visible text. */
async function readout(page, tabs) {
  const labId = tabs.indexOf("lab") >= 0 ? "lab" : tabs[tabs.length - 1];
  const out = { labId: labId };
  try {
    await tapTab(page, labId);
    const present = await page.$('[data-section="lab-device"]');
    out.present = !!present;
    if (present) {
      const st = await page.getAttribute('[data-section="lab-device"] .sec-h', "aria-expanded");
      if (st === "false") await page.tap('[data-section="lab-device"] .sec-h');
      await page.waitForTimeout(400);
      out.text = await page.evaluate(function () { return window.__QA.words('[data-section="lab-device"]').text; });
    }
  } catch (e) { out.err = short(e); }
  return out;
}

/* IOS27-16 stability: a 200-option select (one word per option) appended inside .mc-root. */
async function optionFixture(page) {
  return page.evaluate(function () {
    const Q = window.__QA;
    const before = Q.words(".mc-root");
    const s = document.createElement("select");
    s.setAttribute("data-qa", "fixture");
    for (let i = 0; i < 200; i++) { const o = document.createElement("option"); o.textContent = "w" + i; s.appendChild(o); }
    (document.querySelector(".wrap") || document.querySelector(".mc-root")).appendChild(s);
    const after = Q.words(".mc-root");
    s.remove();
    return { before: before.words, after: after.words, innerBefore: before.inner, innerAfter: after.inner };
  });
}

// ---------------------------------------------------------------- extra tasks (iPhone 17 Pro unless named)

function dev(pw, name) { return pw.devices[name || "iPhone 17 Pro"]; }

async function newCtx(env, extra, inits) {
  const ctx = await env.browser.newContext(Object.assign({}, dev(env.pw), { colorScheme: "dark", serviceWorkers: "block" }, extra || {}));
  await ctx.addInitScript(INIT, { now: NOW, ui: (extra && extra.__ui) || null });
  await ctx.addInitScript(QA_HELPERS);
  for (const f of inits || []) await ctx.addInitScript(f);
  return ctx;
}

/* IOS27-01 PWA block and IOS27-06: the real service-worker lifecycle on the loopback server, at the
   root and under /comeback-blueprint/, then an offline boot with the server closed. */
async function taskPwaLifecycle(env) {
  const S = await makeServer("pwa").start();
  const out = { errors: [], sw: swFacts(readText(path.join(DIST, "sw.js"))) };
  const runs = [];
  const ctxs = [];
  try {
    for (const base of ["/", SUB]) {
      const ctx = await env.browser.newContext(Object.assign({}, dev(env.pw), { colorScheme: "dark", serviceWorkers: "allow" }));
      ctxs.push(ctx);
      await ctx.addInitScript(INIT, { now: NOW, ui: null });
      await ctx.addInitScript(QA_HELPERS);
      const page = await ctx.newPage();
      watch(page, out.errors, "pwa" + base);
      const t0 = Date.now();
      await mount(page, S.origin + base + "index.html");
      await page.waitForFunction(function () { return window.__PWA__ && window.__PWA__.sw !== "pending"; }, null, { timeout: 15000 }).catch(function () {});
      const first = await page.evaluate(async function (cache) {
        const st = window.__PWA__ ? { sw: window.__PWA__.sw, error: window.__PWA__.error } : null;
        const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(function (r) { setTimeout(function () { r(null); }, 15000); })]);
        // ready resolves while the worker may still be "activating": wait for "activated" (15 s at most)
        for (let i = 0; reg && reg.active && reg.active.state !== "activated" && i < 60; i++) await new Promise(function (r) { setTimeout(r, 250); });
        const ready = reg ? { scope: reg.scope, active: reg.active ? reg.active.state : null } : null;
        let entries = null;
        for (let i = 0; i < 60; i++) {
          try { if (cache && (await caches.has(cache))) { entries = (await (await caches.open(cache)).keys()).length; } } catch (e) { entries = null; }
          if (entries !== null && entries > 0) break;
          await new Promise(function (r) { setTimeout(r, 250); });
        }
        return { pwa: st, ready: ready, entries: entries, names: await caches.keys() };
      }, out.sw.cache);
      // give the install a moment to finish writing every entry, then read again
      await page.waitForTimeout(800);
      first.entries = await page.evaluate(async function (cache) { try { return (await (await caches.open(cache)).keys()).length; } catch (e) { return null; } }, out.sw.cache);
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(".mc-root", { timeout: 30000 });
      const second = await page.evaluate(function () { return { controlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller) }; });
      runs.push({ base: base, page: page, first: first, second: second, ms: Date.now() - t0 });
    }
    const hits = S.log.map(function (e) { return e.url; });
    out.shellFetched = { "/": [], [SUB]: [] };
    (out.sw.shell || []).forEach(function (s) {
      const rel = String(s).replace(/^\.\//, "");
      ["/", SUB].forEach(function (b) { if (hits.indexOf(b + rel) >= 0) out.shellFetched[b].push(rel); });
    });
    await S.close();
    for (const r of runs) {
      let off = null;
      try {
        await r.page.evaluate(function () { window.__OLD__ = true; });
        await r.page.reload({ waitUntil: "load", timeout: 20000 });
        await r.page.waitForSelector(".mc-root", { timeout: 20000 });
        off = await r.page.evaluate(function () { return { fresh: !window.__OLD__, mounted: !!document.querySelector(".mc-root"), controlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller) }; });
      } catch (e) { off = { error: short(e) }; }
      r.offline = off;
      delete r.page;
    }
    out.runs = runs;
  } catch (e) { out.fatal = short(e); }
  finally {
    await S.close();
    for (const c of ctxs) await c.close().catch(function () {});
  }
  return out;
}

/* IOS27-07 update flow, and the IOS27-01 cache-hygiene check that follows it. */
async function taskUpdate(env) {
  const S = await makeServer("update").start();
  const out = { errors: [] };
  const swText = readText(path.join(DIST, "sw.js")) || "";
  const html = readText(path.join(DIST, "index.html")) || "";
  const f = swFacts(swText);
  out.oldCache = f.cache;
  out.newCache = f.cache ? f.cache + "-qa-next" : null;
  const ctx = await env.browser.newContext(Object.assign({}, dev(env.pw), { colorScheme: "dark", serviceWorkers: "allow" }));
  try {
    await ctx.addInitScript(INIT, { now: NOW, ui: null });
    await ctx.addInitScript(QA_HELPERS);
    const page = await ctx.newPage();
    watch(page, out.errors, "update");
    await mount(page, S.origin + "/index.html");
    out.controlled0 = await page.waitForFunction(function () { return !!(navigator.serviceWorker && navigator.serviceWorker.controller); }, null, { timeout: 20000 }).then(function () { return true; }, function () { return false; });
    await page.waitForTimeout(1500);   // let the first install finish its precache
    // the new build
    S.over["/sw.js"] = swText.replace(/((?:var|let|const)\s+CACHE\s*=\s*["'])([^"']+)(["'])/, "$1$2-qa-next$3") + "\n/* qa: next build */\n";
    S.over["/index.html"] = html.replace(/<head>/i, '<head>\n<meta name="qa-build" content="next">');
    const tSwap = Date.now();
    await page.evaluate(function () { document.dispatchEvent(new Event("visibilitychange")); });
    let swReq = false;
    for (let i = 0; i < 30 && !swReq; i++) { await sleep(200); swReq = S.hitsAfter(tSwap, /\/sw\.js$/).length > 0; }
    out.swRequested = swReq;
    out.newActive = await page.evaluate(async function (name) {
      for (let i = 0; i < 40; i++) { try { if (await caches.has(name)) return true; } catch (e) { /* noop */ } await new Promise(function (r) { setTimeout(r, 250); }); }
      return false;
    }, out.newCache);
    out.note = null;
    for (let i = 0; i < 25 && !out.note; i++) {
      await page.waitForTimeout(200);
      out.note = await page.evaluate(function () {
        const m = window.__QA.words(".mc-root").text.match(/New build ready[^.]*\.?[^.]{0,40}/i);
        return m ? m[0].slice(0, 80) : null;
      }).catch(function () { return null; });
    }
    if (out.note) {
      const btn = await page.$('.mc-root button:has-text("New build ready"), .mc-root button:has-text("reload"), .mc-root button:has-text("Reload")');
      if (btn) {
        await page.evaluate(function () { window.__OLD__ = true; });
        await Promise.all([page.waitForNavigation({ waitUntil: "load", timeout: 20000 }).catch(function () {}), btn.tap()]);
        await page.waitForSelector(".mc-root", { timeout: 20000 });
        out.afterTap = await page.evaluate(async function () {
          const ks = (await caches.keys()).filter(function (k) { return k.indexOf("fpl-mc-") === 0; });
          return { reloaded: !window.__OLD__, names: ks, next: !!document.querySelector('meta[name="qa-build"][content="next"]') };
        });
      } else out.afterTap = { error: "the note carries no button to tap" };
    }
    // IOS27-01 cache hygiene: a navigation after CACHE changed
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".mc-root", { timeout: 30000 });
    out.hygiene = await page.evaluate(async function (name) {
      let ks = [];
      for (let i = 0; i < 60; i++) {
        ks = (await caches.keys()).filter(function (k) { return k.indexOf("fpl-mc-") === 0; });
        if (ks.length === 1 && ks[0] === name) break;
        await new Promise(function (r) { setTimeout(r, 250); });
      }
      return { names: ks, next: !!document.querySelector('meta[name="qa-build"][content="next"]') };
    }, out.newCache);
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); await S.close(); }
  return out;
}

/* IOS27-07 revalidation with a real max-age, behind two controls that say whether this engine can
   show the difference at all: (1) with no worker a re-open must be served by the HTTP cache (0
   requests), and (2) the SAME document (the app's own index.html, served under /qa-probe/, where it
   registers a minimal worker whose navigation handler is today's pattern, fetch(e.request)) must
   ALSO be served from the HTTP cache. If (2) already reaches the server, this engine revalidates
   whatever the worker does, the check could never turn red, and it is reported as "not provable
   here" (SKIP) instead of a PASS that proves nothing. */
const PROBE_SW = "self.addEventListener('install',function(e){self.skipWaiting();});" +
  "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});" +
  "self.addEventListener('fetch',function(e){if(e.request.mode==='navigate')e.respondWith(fetch(e.request));});";
async function taskRevalidate(env) {
  const S = await makeServer("revalidate").start();
  const html = readText(path.join(DIST, "index.html")) || "";
  S.cc["/index.html"] = "max-age=600";
  S.over["/qa-probe/index.html"] = html;
  S.over["/qa-probe/sw.js"] = PROBE_SW;
  S.cc["/qa-probe/index.html"] = "max-age=600";
  const out = { errors: [] };
  try {
    {
      const ctx = await env.browser.newContext(Object.assign({}, dev(env.pw), { serviceWorkers: "block" }));
      const page = await ctx.newPage();
      await page.goto(S.origin + "/index.html", { waitUntil: "load" });
      const t1 = Date.now();
      await page.goto("about:blank");
      await page.goto(S.origin + "/index.html", { waitUntil: "load" });
      out.controlHits = S.hitsAfter(t1, /^\/index\.html$/).length;
      await ctx.close();
    }
    {
      const ctx = await env.browser.newContext(Object.assign({}, dev(env.pw), { serviceWorkers: "allow" }));
      try {
        const page = await ctx.newPage();
        await page.addInitScript(INIT, { now: NOW, ui: null });
        await mount(page, S.origin + "/qa-probe/index.html");
        out.probeControlled = await page.waitForFunction(function () { return !!(navigator.serviceWorker && navigator.serviceWorker.controller); }, null, { timeout: 15000 }).then(function () { return true; }, function () { return false; });
        const t3 = Date.now();
        await page.goto("about:blank");
        await page.waitForTimeout(800);
        await page.goto(S.origin + "/qa-probe/index.html", { waitUntil: "load" });
        out.probeHits = S.hitsAfter(t3, /^\/qa-probe\/index\.html$/).length;
      } finally { await ctx.close().catch(function () {}); }
    }
    if (out.controlHits === 0 && out.probeControlled && out.probeHits === 0) {
      const ctx = await env.browser.newContext(Object.assign({}, dev(env.pw), { colorScheme: "dark", serviceWorkers: "allow" }));
      try {
        await ctx.addInitScript(INIT, { now: NOW, ui: null });
        const page = await ctx.newPage();
        watch(page, out.errors, "revalidate");
        await mount(page, S.origin + "/index.html");
        out.controlled = await page.waitForFunction(function () { return !!(navigator.serviceWorker && navigator.serviceWorker.controller); }, null, { timeout: 20000 }).then(function () { return true; }, function () { return false; });
        await page.waitForTimeout(1500);
        S.over["/index.html"] = html.replace(/<head>/i, '<head>\n<meta name="qa-build" content="revalidated">');
        const t2 = Date.now();
        await page.goto("about:blank");
        await page.goto(S.origin + "/index.html", { waitUntil: "load" });
        await page.waitForSelector(".mc-root", { timeout: 30000 });
        out.swHits = S.hitsAfter(t2, /^\/index\.html$/).length;
        out.newShown = await page.evaluate(function () { return !!document.querySelector('meta[name="qa-build"][content="revalidated"]'); });
      } finally { await ctx.close().catch(function () {}); }
    }
  } catch (e) { out.fatal = short(e); }
  finally { await S.close(); }
  return out;
}

/* Reload and time the new document's .mc-root (the old one is marked so it cannot be mistaken). */
async function timedReload(page, limit) {
  await page.evaluate(function () { window.__OLD__ = true; });
  const t0 = Date.now();
  const nav = page.reload({ waitUntil: "load", timeout: limit + 12000 }).catch(function () {});
  let at = null;
  while (Date.now() - t0 < limit) {
    const ok = await page.evaluate(function () { return !window.__OLD__ && !!document.querySelector(".mc-root"); }).catch(function () { return false; });
    if (ok) { at = Date.now() - t0; break; }
    await sleep(100);
  }
  await nav;
  return at;
}

/* IOS27-17: a navigation held for 10 s once the page is controlled; then a prompt one. */
async function taskSlow(env) {
  const S = await makeServer("slow").start();
  const html = readText(path.join(DIST, "index.html")) || "";
  const out = { errors: [] };
  const ctx = await env.browser.newContext(Object.assign({}, dev(env.pw), { colorScheme: "dark", serviceWorkers: "allow" }));
  try {
    await ctx.addInitScript(INIT, { now: NOW, ui: null });
    const page = await ctx.newPage();
    watch(page, out.errors, "slow");
    await mount(page, S.origin + "/index.html");
    out.controlled = await page.waitForFunction(function () { return !!(navigator.serviceWorker && navigator.serviceWorker.controller); }, null, { timeout: 20000 }).then(function () { return true; }, function () { return false; });
    await page.waitForTimeout(1500);
    // reference: a controlled reload with a prompt server, from the tap on reload to a mounted root
    out.promptMs = await timedReload(page, 13000);
    out.promptMs2 = await timedReload(page, 13000);
    S.over["/index.html"] = html.replace(/<head>/i, '<head>\n<meta name="qa-build" content="slow">');
    S.hold["/index.html"] = 10000;
    await page.evaluate(function () { window.__OLD__ = true; });
    const t0 = Date.now();
    const nav = page.reload({ waitUntil: "load", timeout: 25000 }).catch(function (e) { return short(e); });
    let mountedAt = null;
    while (Date.now() - t0 < 13000) {
      const ok = await page.evaluate(function () { return !window.__OLD__ && !!document.querySelector(".mc-root"); }).catch(function () { return false; });
      if (ok) { mountedAt = Date.now() - t0; break; }
      await sleep(100);
    }
    out.mountMs = mountedAt;
    // wait for the held response to go out, then look in the cache
    for (let i = 0; i < 120; i++) {
      if (S.log.some(function (e) { return e.t >= t0 && e.url === "/index.html" && e.held && e.sent; })) break;
      await sleep(100);
    }
    // when the server let the held response go, in ms after the reload began (E-134 compares the mount with it)
    const released = S.log.filter(function (e) { return e.t >= t0 && e.url === "/index.html" && e.held && e.sent; })[0];
    out.heldAt = released ? released.sent - t0 : null;
    await nav;
    out.cacheNew = await page.evaluate(async function () {
      for (let i = 0; i < 40; i++) {
        try { const r = await caches.match("./index.html"); if (r) { const t = await r.text(); if (t.indexOf('content="slow"') >= 0) return true; } } catch (e) { /* noop */ }
        await new Promise(function (r) { setTimeout(r, 200); });
      }
      return false;
    }).catch(function (e) { return "error: " + short(e); });
    delete S.hold["/index.html"];
    S.over["/index.html"] = html.replace(/<head>/i, '<head>\n<meta name="qa-build" content="prompt">');
    /* the prompt reload doubles as a second reading of the controlled-reload boot, taken after the held one (E-134) */
    out.promptAfterMs = await timedReload(page, 13000);
    await page.waitForSelector(".mc-root", { timeout: 30000 });
    out.prompt = await page.evaluate(function () { return !!document.querySelector('meta[name="qa-build"][content="prompt"]'); });
    out.promptAfterMs2 = await timedReload(page, 13000);
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); await S.close(); }
  return out;
}

/* IOS27-10 in dist: what ↻ does when the page is not an artifact. */
async function taskDistRefresh(env) {
  const S = await makeServer("dist-refresh").start();
  const out = { errors: [], posts: 0 };
  const ctx = await env.browser.newContext(Object.assign({}, dev(env.pw), { colorScheme: "dark", serviceWorkers: "allow" }));
  try {
    await ctx.addInitScript(INIT, { now: NOW, ui: null });
    await ctx.addInitScript(QA_HELPERS);
    await ctx.addInitScript(FETCH_MOCK);
    // a second net for anything that does not go through the worker
    await ctx.route("https://fantasy.premierleague.com/**", function (r) { return r.abort(); });
    await ctx.route("https://api.anthropic.com/**", function (r) {
      if (r.request().method() === "POST") out.posts++;
      return r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "ios suite: no key in dist" } }) });
    });
    ctx.on("request", function (q) { if (/api\.anthropic\.com/.test(q.url()) && q.method() === "POST") out.reqPosts = (out.reqPosts || 0) + 1; });
    const page = await ctx.newPage();
    watch(page, out.errors, "dist-refresh");
    await mount(page, S.origin + "/index.html");
    await page.waitForFunction(function () { return window.__PWA__ && window.__PWA__.sw !== "pending"; }, null, { timeout: 15000 }).catch(function () {});
    await page.evaluate(function () { return Promise.race([navigator.serviceWorker.ready, new Promise(function (r) { setTimeout(r, 10000); })]); }).catch(function () {});
    out.label = await page.getAttribute('[data-testid="refresh"]', "aria-label");
    const t0 = Date.now();
    await page.tap('[data-testid="refresh"]');
    for (let i = 0; i < 40; i++) {
      await sleep(200);
      const busy = await page.evaluate(function () { return document.querySelectorAll(".refbar").length > 0; }).catch(function () { return true; });
      if (!busy && Date.now() - t0 > 1500) break;
    }
    await page.waitForLoadState("load").catch(function () {});
    out.swAfterTap = S.hitsAfter(t0, /\/sw\.js$/).length;
    out.fetchLog = await page.evaluate(function () { try { return sessionStorage.getItem("qa:anthropic") || ""; } catch (e) { return "unreadable"; } }).catch(function () { return "unreadable"; });
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); await S.close(); }
  return out;
}

/* IOS27-11 (and IOS27-10's artifact half): refresh outcomes in an artifact-like shell. */
async function taskAnnounce(env, stubbed) {
  const S = env.main;
  const out = { errors: [], stubbed: stubbed };
  const plan = [{ status: 400, body: BODY_400, delay: 1200 }, { status: 200, body: anthropicBodyOk(), delay: 1200 }];
  let call = 0;
  const inits = [ARTIFACT_MEM];
  inits.push(stubbed ? ARIA_SPY : ARIA_REMOVE);
  const ctx = await newCtx(env, {}, inits);
  try {
    await ctx.route("https://fantasy.premierleague.com/**", function (r) { return r.abort(); });
    await ctx.route("https://api.anthropic.com/**", async function (r) {
      const p = plan[Math.min(call, plan.length - 1)];
      await sleep(p.delay);
      return r.fulfill({ status: p.status, contentType: "application/json", body: JSON.stringify(p.body) });
    });
    const page = await ctx.newPage();
    watch(page, out.errors, stubbed ? "announce-stub" : "announce");
    await mount(page, S.origin + "/index.html");
    out.engineAria = await page.evaluate(function () { return typeof document.body.ariaNotify; });
    out.nativeAria = await page.evaluate(function () { return window.__QA_ARIA_NATIVE__ || null; });
    out.gw = await page.getAttribute(".mc-root", "data-gw");
    out.before = await page.evaluate(function () {
      const n = document.querySelector('.mc-root [role="status"]');
      if (n) n.__qaTag = "qa-status-node";
      return { present: !!n, text: n ? n.textContent : null };
    });
    out.runs = [];
    for (let k = 0; k < 2; k++) {
      call = k;
      const landing0 = await page.evaluate(function () { return window.__QA.words(".landing").text; });
      await page.tap('[data-testid="refresh"]');
      let sawBar = false;
      try { await page.waitForSelector(".refbar", { timeout: 5000 }); sawBar = true; } catch (e) { sawBar = false; }
      const busyStatus = await page.evaluate(function () { const s = document.querySelector('[data-testid="status"]'); return s ? s.textContent : ""; });
      let cleared = false;
      try { await page.waitForFunction(function () { return document.querySelectorAll(".refbar").length === 0; }, null, { timeout: 25000 }); cleared = true; } catch (e) { cleared = false; }
      await page.waitForTimeout(500);
      const after = await page.evaluate(function () {
        const n = document.querySelector('.mc-root [role="status"]');
        const e = document.querySelector('[data-testid="err"]');
        return { present: !!n, same: !!(n && n.__qaTag === "qa-status-node"), text: n ? n.textContent.trim() : null, err: e ? e.textContent.replace(/\s+/g, " ").trim() : null, aria: (window.__QA_ARIA__ || []).slice() };
      });
      after.landingSame = (await page.evaluate(function () { return window.__QA.words(".landing").text; })) === landing0;
      after.snapshot = await page.locator("body").ariaSnapshot().catch(function (e) { return "ariaSnapshot failed: " + short(e); });
      out.runs.push({ status: plan[k].status, sawBar: sawBar, busyStatus: busyStatus, cleared: cleared, after: after });
    }
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); }
  return out;
}

/* IOS27-12 (with a control) and the IOS27-11 busy line under Reduce Motion. */
async function taskMotion(env, reduce) {
  const S = env.main;
  const out = { errors: [], reduce: reduce };
  // the artifact shell: the refresh in flight is the artifact's (IOS27-10 removes it from dist)
  const ctx = await newCtx(env, reduce ? { reducedMotion: "reduce" } : {}, [ARTIFACT_MEM]);
  try {
    await ctx.route("https://fantasy.premierleague.com/**", function (r) { return r.abort(); });
    await ctx.route("https://api.anthropic.com/**", async function (r) { await sleep(1500); return r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify(BODY_400) }); });
    const page = await ctx.newPage();
    watch(page, out.errors, reduce ? "motion-reduce" : "motion-control");
    await mount(page, S.origin + "/index.html");
    await page.waitForTimeout(300);
    out.animsBoot = await page.evaluate(function () { return document.getAnimations ? document.getAnimations().length : null; });
    out.transition = await page.evaluate(function () { const b = document.querySelector(".mc-root button"); return b ? getComputedStyle(b).transitionDuration : null; });
    // a visible .btn, wherever the app first shows one (first paint of each tab, then with its sections open)
    const pick = function () { return page.evaluate(function () { const b = Array.prototype.filter.call(document.querySelectorAll(".mc-root .btn"), function (x) { return window.__QA.vis(x) && !x.disabled; })[0]; if (b) b.setAttribute("data-qa-hold", "1"); return !!b; }); };
    let found = await pick();
    if (!found) {
      const tabs = await goFull(page);
      for (const t of tabs) {
        await tapTab(page, t);
        found = await pick();
        if (!found) { await openAll(page); found = await pick(); }
        if (found) { out.btnTab = t; break; }
      }
    }
    out.btn = found ? await page.evaluate(function () { return window.__QA.label(document.querySelector("[data-qa-hold]")); }) : null;
    if (found) {
      const el = await page.$("[data-qa-hold]");
      await el.scrollIntoViewIfNeeded();
      const bb = await el.boundingBox();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(200);
      out.heldActive = await page.evaluate(function () { const b = document.querySelector("[data-qa-hold]"); return { active: b.matches(":active"), transform: getComputedStyle(b).transform }; });
      await page.mouse.move(2, 2);
      await page.mouse.up();
      // the same state through the CSSOM: every rule re-added with :active read as a class
      out.cssomActive = await page.evaluate(async function () {
        let css = "";
        for (let i = 0; i < document.styleSheets.length; i++) { try { const rs = document.styleSheets[i].cssRules; for (let k = 0; k < rs.length; k++) css += rs[k].cssText + "\n"; } catch (e) { /* noop */ } }
        const st = document.createElement("style");
        st.textContent = css.replace(/:active\b/g, ".qa-active");
        document.head.appendChild(st);
        const b = document.querySelector("[data-qa-hold]");
        b.classList.add("qa-active");
        await new Promise(function (r) { setTimeout(r, 250); });
        const t = getComputedStyle(b).transform;
        b.classList.remove("qa-active");
        st.remove();
        return t;
      });
    }
    // a refresh in flight: animations and the header line
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.tap('[data-testid="refresh"]');
    let bar = false;
    try { await page.waitForSelector(".refbar", { timeout: 5000 }); bar = true; } catch (e) { bar = false; }
    await page.waitForTimeout(150);
    out.busy = await page.evaluate(function () { const s = document.querySelector('[data-testid="status"]'); return { bar: document.querySelectorAll(".refbar").length, anims: document.getAnimations ? document.getAnimations().length : null, status: s ? s.textContent : "" }; });
    out.busy.sawBar = bar;
    await page.waitForFunction(function () { return document.querySelectorAll(".refbar").length === 0; }, null, { timeout: 25000 }).catch(function () {});
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); }
  return out;
}

/* IOS27-13: contrast 'more' (dim/mute text and --line), 'no-preference' (tokens untouched), and
   forced colours (every control keeps an edge). */
async function taskContrast(env, kind) {
  const S = env.main;
  const out = { errors: [], kind: kind };
  const extra = kind === "more" ? { contrast: "more" } : kind === "nopref" ? { contrast: "no-preference" } : { forcedColors: "active" };
  const ctx = await newCtx(env, extra, []);
  try {
    const page = await ctx.newPage();
    watch(page, out.errors, "contrast-" + kind);
    await mount(page, S.origin + "/index.html");
    out.media = await page.evaluate(function () { return { more: matchMedia("(prefers-contrast: more)").matches, forced: matchMedia("(forced-colors: active)").matches }; });
    if (kind === "nopref") { out.tokens = await page.evaluate(function () { return window.__QA.tokens(); }); return out; }
    const tabs = await goFull(page);
    out.agg = { n: 0, dim: { n: 0, min: null }, mute: { n: 0, min: null }, worst: [], lineOnBg2: null, edges: { n: 0, bad: 0, sample: [] } };
    for (const t of tabs) {
      await tapTab(page, t);
      await openAll(page);
      await page.evaluate(function () { window.scrollTo(0, 0); });
      await page.waitForTimeout(100);
      if (kind === "more") {
        const c = await page.evaluate(function () { return window.__QA.contrast("tokens"); });
        out.agg.n += c.n;
        out.agg.lineOnBg2 = c.lineOnBg2; out.agg.tok = c.tok;
        ["dim", "mute"].forEach(function (k) { out.agg[k].n += c[k].n; if (c[k].min !== null && (out.agg[k].min === null || c[k].min < out.agg[k].min)) out.agg[k].min = c[k].min; });
        c.worst.forEach(function (w) { out.agg.worst.push(Object.assign({ tab: t }, w)); });
      } else {
        const e = await page.evaluate(function () { return window.__QA.edges(); });
        out.agg.edges.n += e.n; out.agg.edges.bad += e.bad;
        e.sample.forEach(function (s) { if (out.agg.edges.sample.length < 5) out.agg.edges.sample.push(s + " on " + t); });
      }
    }
    if (kind === "forced") {
      await page.evaluate(function () { window.scrollTo(0, 0); });
      await page.tap('[data-testid="menu"]');
      await page.waitForSelector(".menu-i", { timeout: 5000 });
      const e = await page.evaluate(function () { return window.__QA.edges(); });
      out.agg.edges.n += e.n; out.agg.edges.bad += e.bad;
      e.sample.forEach(function (s) { if (out.agg.edges.sample.length < 5) out.agg.edges.sample.push(s + " in the menu"); });
    }
    out.agg.worst.sort(function (a, b) { return a.cr - b.cr; });
    out.agg.worst = out.agg.worst.slice(0, 4);
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); }
  return out;
}

/* IOS27-04 shells A and B. */
async function taskShellA(env) {
  const S = env.main;
  const out = { errors: [] };
  const ctx = await newCtx(env, {}, [SHELL_A]);
  try {
    const page = await ctx.newPage();
    watch(page, out.errors, "shellA");
    await mount(page, S.origin + "/index.html");
    await page.waitForTimeout(900);
    const seed = await page.evaluate(function () { return { mock: localStorage.getItem("qaA:mc_state"), local: localStorage.getItem("mc_state") }; });
    let state = null;
    try { state = JSON.parse(seed.mock || seed.local); } catch (e) { state = null; }
    out.seedFrom = seed.mock ? "window.storage (text)" : seed.local ? "localStorage (the fallback)" : "nowhere";
    if (!state || !Array.isArray(state.squad) || !state.squad.length) { out.fatal = "the app wrote no state anywhere after boot"; return out; }
    const ids = state.squad.map(function (x) { return Number(x.id); });
    const mk = markerFor(ids);
    if (!mk) { out.fatal = "no marker player could be chosen from data/live.json"; return out; }
    out.marker = mk;
    const mis = JSON.parse(JSON.stringify(state));
    mis.squad[mis.squad.length - 1] = { id: mk.id, purchase: null };
    // D3 blocks only while the saved squad is unconfirmed for the current gameweek: step it back one
    mis.confirmed_gw = Math.max(0, (Number(state.confirmed_gw) || 0) - 1);
    out.confirmedFrom = state.confirmed_gw;
    const tabs0 = await goFull(page);
    out.seedTab = tabs0[1] || tabs0[0];
    await page.evaluate(function (a) {
      localStorage.setItem("qaA:mc_state", JSON.stringify(a.s));
      localStorage.setItem("qaA:mc_ui", JSON.stringify({ mode: "full", tab: a.tab, open: {}, reveals: {} }));
      localStorage.removeItem("mc_state"); localStorage.removeItem("mc_ui");
    }, { s: mis, tab: out.seedTab });
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".mc-root", { timeout: 30000 });
    await page.waitForTimeout(700);
    out.r1 = await page.evaluate(function () {
      const r = document.querySelector(".mc-root");
      return { mode: r.getAttribute("data-mode"), view: r.getAttribute("data-view"), blocks: r.querySelectorAll(".block").length, confirm: Array.prototype.filter.call(r.querySelectorAll('[data-testid^="confirm-"]'), window.__QA.vis).length };
    });
    if (out.r1.confirm > 0) {
      await page.tap('.mc-root [data-testid^="confirm-"] >> visible=true');
      await page.waitForTimeout(700);
      out.confirmed = true;
    }
    const tabs = await goFull(page);
    out.tab = tabs[Math.min(3, tabs.length - 1)];
    await tapTab(page, out.tab);
    const sec = await page.evaluate(function () { const h = Array.prototype.filter.call(document.querySelectorAll('.mc-root .sec-h[aria-expanded="false"]'), window.__QA.vis)[0]; return h ? h.getAttribute("data-testid") : null; });
    out.section = sec;
    if (sec) { await page.tap('[data-testid="' + sec + '"]'); await page.waitForTimeout(600); }
    out.stored = await page.evaluate(function () {
      const u = localStorage.getItem("qaA:mc_ui"), s = localStorage.getItem("qaA:mc_state");
      let su = null, ss = null;
      try { su = JSON.parse(u); } catch (e) { su = null; }
      try { ss = JSON.parse(s); } catch (e) { ss = null; }
      return { uiIsText: typeof u === "string", ui: su, squad: ss && Array.isArray(ss.squad) ? ss.squad.map(function (x) { return Number(x.id); }) : null, typeErrors: Number(sessionStorage.getItem("qaA:typeErrors") || 0) };
    });
    await page.evaluate(function () { localStorage.removeItem("mc_state"); localStorage.removeItem("mc_ui"); });
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".mc-root", { timeout: 30000 });
    await page.waitForTimeout(700);
    out.r2 = await page.evaluate(function (sec) {
      const r = document.querySelector(".mc-root");
      const h = sec ? document.querySelector('[data-testid="' + sec + '"]') : null;
      return { mode: r.getAttribute("data-mode"), view: r.getAttribute("data-view"), blocks: r.querySelectorAll(".block").length, open: h ? h.getAttribute("aria-expanded") : null, typeErrors: Number(sessionStorage.getItem("qaA:typeErrors") || 0) };
    }, sec);
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); }
  return out;
}
async function taskShellB(env) {
  const S = env.main;
  const out = { errors: [] };
  const ctx = await newCtx(env, {}, [SHELL_B]);
  try {
    const page = await ctx.newPage();
    watch(page, out.errors, "shellB");
    await mount(page, S.origin + "/index.html");
    await page.waitForTimeout(1500);
    out.r = await page.evaluate(function () {
      const r = document.querySelector(".mc-root");
      return { sets: window.__QA_B__ ? window.__QA_B__.sets : null, boundary: r.querySelectorAll(".boundary").length, mode: r.getAttribute("data-mode"), note: window.__QA.noteOn("not saving on this device") };
    });
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); }
  return out;
}
/* IOS27-04 shell C (also the IOS27-01 artifact approximation): the app in <iframe sandbox="allow-scripts">. */
async function taskShellC(env) {
  const S = env.main;
  const out = { errors: [] };
  /* serviceWorkers "allow" on purpose: with "block", Playwright's own bootstrap script touches
     navigator.serviceWorker inside the sandboxed frame and throws a SecurityError that is reported
     as a page error (measured: web-inspector://bootstrap.js), which is the harness, not the app. */
  const ctx = await newCtx(env, { serviceWorkers: "allow" }, []);
  try {
    const page = await ctx.newPage();
    watch(page, out.errors, "shellC");
    await page.goto(S.origin + "/host", { waitUntil: "load" });
    let mounted = true;
    try { await page.frameLocator("#art").locator(".mc-root").waitFor({ timeout: 30000 }); } catch (e) { mounted = false; }
    out.mounted = mounted;
    await page.waitForTimeout(1500);
    const fr = page.frames().filter(function (f) { return f !== page.mainFrame(); })[0];
    out.frame = fr ? await fr.evaluate(function () {
      let ls;
      try { void localStorage.length; ls = "usable"; } catch (e) { ls = "throws " + e.name; }
      const n = window.__QA ? window.__QA.noteOn("not saving on this device") : { found: false };
      return { origin: String(location.origin), ls: ls, pwa: window.__PWA__ ? window.__PWA__.sw : null, errs: (window.__ERRS__ || []).slice(0, 3), helpers: !!window.__QA, note: n, boundary: document.querySelectorAll(".boundary").length };
    }) : null;
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); }
  return out;
}

/* IOS27-05: the dist shim on a failed write, and persist(). */
async function taskShim(env) {
  const S = env.main;
  const out = { errors: [] };
  const ctx = await newCtx(env, {}, [PERSIST_SPY]);
  try {
    const page = await ctx.newPage();
    watch(page, out.errors, "shim");
    await mount(page, S.origin + "/index.html");
    await page.waitForTimeout(1200);
    out.persistAfterBoot = await page.evaluate(function () { return window.__PERSIST__; });
    const tabs = await goFull(page);
    await tapTab(page, tabs[1] || tabs[0]);
    await page.waitForTimeout(900);
    out.persistAfterMore = await page.evaluate(function () { return window.__PERSIST__.calls; });
    out.shim = await page.evaluate(function () { return { marker: window.storage ? window.storage.__shim || null : null }; });
    out.setResult = await page.evaluate(async function () {
      Storage.prototype.setItem = function () { throw new DOMException("The quota has been exceeded.", "QuotaExceededError"); };
      try { const r = await window.storage.set("k", { a: 1 }); return { value: r }; } catch (e) { return { threw: String(e && e.name) }; }
    });
    const sec = await page.evaluate(function () { const h = Array.prototype.filter.call(document.querySelectorAll(".mc-root .sec-h"), window.__QA.vis)[0]; return h ? h.getAttribute("data-testid") : null; });
    if (sec) { await page.tap('[data-testid="' + sec + '"]'); await page.waitForTimeout(900); }
    /* the note must carry a reason and point to export: the smallest visible element holding both */
    out.noteFull = await page.evaluate(function () { return window.__QA.noteOn("Last change not saved\\W+\\S[\\s\\S]{0,160}Export now"); });
    out.note = await page.evaluate(function () { const t = window.__QA.words(".mc-root").text; const m = t.match(/Last change not saved[^.]*\.?[^.]*\.?/i); return m ? m[0].slice(0, 100) : null; });
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); }
  // persist() absent
  const ctx2 = await newCtx(env, {}, [PERSIST_DELETE]);
  out.errors2 = [];
  try {
    const page = await ctx2.newPage();
    watch(page, out.errors2, "shim-nopersist");
    await mount(page, S.origin + "/index.html");
    out.gone = await page.evaluate(function () { return window.__PERSIST_GONE__ === true; });
    const tabs = await goFull(page);
    await tapTab(page, tabs[1] || tabs[0]);
    const sec = await page.evaluate(function () { const h = Array.prototype.filter.call(document.querySelectorAll(".mc-root .sec-h"), window.__QA.vis)[0]; return h ? h.getAttribute("data-testid") : null; });
    if (sec) await page.tap('[data-testid="' + sec + '"]');
    await page.waitForTimeout(800);
    out.saved2 = await page.evaluate(async function () { const u = await window.__QA.readKey("mc_ui"); return !!(u && u.mode === "full"); });
  } catch (e) { out.fatal2 = short(e); }
  finally { await ctx2.close().catch(function () {}); }
  return out;
}

/* IOS27-14: share sheet, download fallback, import from a file. */
async function taskShare(env) {
  const S = env.main;
  const out = { errors: [] };
  const ctx = await newCtx(env, { acceptDownloads: true }, [SHARE_STUB]);
  try {
    const page = await ctx.newPage();
    watch(page, out.errors, "share");
    await mount(page, S.origin + "/index.html");
    const openVia = async function (item) {
      await page.evaluate(function () { window.scrollTo(0, 0); });
      await page.tap('[data-testid="menu"]');
      await page.waitForSelector(".menu-i", { timeout: 5000 });
      const sel = (await page.$('.menu-i[data-menu="' + item + '"]')) ? '.menu-i[data-menu="' + item + '"]' : '.menu-i >> text=/' + item + '/i';
      await page.tap(sel);
      await page.waitForTimeout(500);
    };
    const exportBtn = async function () {
      const h = await page.$('[data-testid="export-download"]');
      if (h) return h;
      return page.$('[data-section="lab-export"] .btn');
    };
    await openVia("export");
    const b1 = await exportBtn();
    if (!b1) throw new Error("no export control in lab-export");
    // share path
    let dl1 = null;
    const dlP = page.waitForEvent("download", { timeout: 3000 }).then(function (d) { dl1 = d.suggestedFilename(); }, function () {});
    await b1.tap();
    await page.waitForTimeout(1000);
    await dlP;
    out.shared = await page.evaluate(function () { return (window.__QA_SHARE__ || []).slice(); });
    out.downloadWhileShareStubbed = dl1;
    out.stateNow = await page.evaluate(function () { return window.__QA.readKey("mc_state"); });
    // download path: stubs removed
    await page.evaluate(function () { try { delete navigator.share; delete navigator.canShare; } catch (e) { /* noop */ } });
    out.shareGone = await page.evaluate(function () { return typeof navigator.share === "undefined"; });
    let dl = null, text = null;
    try {
      const b2 = await exportBtn();
      const [d] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), b2.tap()]);
      dl = d.suggestedFilename();
      text = fs.readFileSync(await d.path(), "utf8");
    } catch (e) { out.dlErr = short(e); }
    out.download = dl;
    // file import
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
    if (parsed && Array.isArray(parsed.squad)) {
      const ids = parsed.squad.map(function (x) { return Number(x.id); });
      const mk = markerFor(ids);
      out.marker = mk;
      if (mk) {
        parsed.squad[parsed.squad.length - 1] = { id: mk.id, purchase: null };
        await openVia("import");
        const input = await page.$('.mc-root input[type="file"]');
        out.fileInput = !!input;
        if (input) {
          await input.setInputFiles({ name: dl || "mc_state.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(parsed)) });
          await page.waitForTimeout(900);
          const tabs = await goFull(page);
          const sq = tabs.indexOf("squad") >= 0 ? "squad" : tabs[2];
          await tapTab(page, sq);
          await openAll(page);
          out.squadShows = await page.evaluate(function (n) { return window.__QA.words(".mc-root").text.indexOf(n) >= 0; }, mk.name);
          out.storedHas = await page.evaluate(async function (id) { const st = await window.__QA.readKey("mc_state"); return !!(st && Array.isArray(st.squad) && st.squad.some(function (x) { return Number(x.id) === id; })); }, mk.id);
        }
      }
    } else out.importSkippedWhy = "the download did not parse, so there was no file to import";
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); }
  return out;
}

/* IOS27-01 PWA block: scroll anchoring when .refbar is inserted above the reading position. */
async function taskAnchor(env) {
  const S = env.main;
  const out = { errors: [] };
  // the artifact shell: the refresh in flight is the artifact's (IOS27-10 removes it from dist)
  const ctx = await newCtx(env, {}, [ARTIFACT_MEM]);
  try {
    await ctx.route("https://fantasy.premierleague.com/**", function (r) { return r.abort(); });
    await ctx.route("https://api.anthropic.com/**", async function (r) { await sleep(2500); return r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify(BODY_400) }); });
    const page = await ctx.newPage();
    watch(page, out.errors, "anchor");
    await mount(page, S.origin + "/index.html");
    const tabs = await goFull(page);
    const tall = tabs.indexOf("plan") >= 0 ? "plan" : tabs[1];
    await tapTab(page, tall);
    await openAll(page);
    await page.evaluate(function () { window.scrollTo(0, 1200); });
    await page.waitForTimeout(300);
    /* The reading position: the content element at the middle of the viewport, tagged, and the
       height of everything above the content (header, bars) before and after the insertion. */
    const read = function () {
      return page.evaluate(function () {
        let a = document.querySelector("[data-qa-anchor]");
        if (!a) {
          const e = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
          a = e ? (e.closest(".row, .kv, .sec-h, .section, .card, p") || e) : null;
          if (a) a.setAttribute("data-qa-anchor", "1");
        }
        const w = document.querySelector(".wrap"), b = document.querySelector(".refbar");
        return { y: window.scrollY, top: a ? Math.round(a.getBoundingClientRect().top * 100) / 100 : null, anchor: a ? window.__QA.label(a) : null,
          above: w ? Math.round((w.getBoundingClientRect().top + window.scrollY) * 100) / 100 : null, h: b ? b.getBoundingClientRect().height : null };
      });
    };
    const r0 = await read();
    out.y0 = r0.y; out.top0 = r0.top; out.anchor = r0.anchor; out.above0 = r0.above;
    // a DOM click: a tap would scroll ↻ into view and destroy the reading position being measured
    await page.evaluate(function () { document.querySelector('[data-testid="refresh"]').click(); });
    try { await page.waitForSelector(".refbar", { timeout: 5000 }); } catch (e) { out.noBar = true; }
    await page.waitForTimeout(200);
    const r1 = await read();
    out.y1 = r1.y; out.h = r1.h; out.top1 = r1.top; out.above1 = r1.above;
    await page.waitForFunction(function () { return document.querySelectorAll(".refbar").length === 0; }, null, { timeout: 25000 }).catch(function () {});
    await page.waitForTimeout(200);
    out.y2 = await page.evaluate(function () { return window.scrollY; });
  } catch (e) { out.fatal = short(e); }
  finally { await ctx.close().catch(function () {}); }
  return out;
}

/* IOS27-16 parity: the same counter in Chromium at the iPhone 17 Pro viewport. */
async function taskChromium(env) {
  const out = { errors: [] };
  let chromium;
  try { chromium = require("playwright").chromium; } catch (e) { out.fatal = "playwright chromium unavailable: " + short(e); return out; }
  const exe = "/opt/pw-browsers/chromium";
  let b = null;
  try {
    b = await chromium.launch(Object.assign({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }, fs.existsSync(exe) ? { executablePath: exe } : {}));
    out.version = b.version();
    const d = dev(env.pw);
    const ctx = await b.newContext({ viewport: d.viewport, screen: d.screen, deviceScaleFactor: d.deviceScaleFactor, isMobile: true, hasTouch: true, colorScheme: "dark", serviceWorkers: "block" });
    await ctx.addInitScript(INIT, { now: NOW, ui: null });
    await ctx.addInitScript(QA_HELPERS);
    const page = await ctx.newPage();
    watch(page, out.errors, "chromium");
    await mount(page, env.main.origin + "/index.html");
    out.landing = (await page.evaluate(function () { return window.__QA.words(".landing"); })).words;
    const tabs = await goFull(page);
    out.tabs = {};
    for (const t of tabs) { await tapTab(page, t); await page.waitForTimeout(60); out.tabs[t] = (await page.evaluate(function () { return window.__QA.words(".mc-root"); })).words; }
    await ctx.close();
  } catch (e) { out.fatal = short(e); }
  finally { if (b) await b.close().catch(function () {}); }
  return out;
}

// ---------------------------------------------------------------- pool

async function runPool(tasks, n) {
  const R = {};
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const t = tasks[next++];
      const t0 = Date.now();
      let r;
      try { r = await t.run(); } catch (e) { r = { fatal: short(e) }; }
      r = r || {};
      r.__ms = Date.now() - t0;
      R[t.name] = r;
      const b = r.t && r.t.boot ? ", boot " + sec(r.t.boot) : "";
      info("timing " + t.name + ": " + sec(r.__ms) + b + (r.fatal ? " — error: " + r.fatal : ""));
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return R;
}

// ---------------------------------------------------------------- judge

function judge(env, R, M) {
  const distHtml = env.distHtml;
  const swText = env.swText;
  const byKey = {};
  M.forEach(function (m) { byKey[m.spec.key] = m; });
  const desc = M.filter(function (m) { return !m.spec.sim; });
  const sims = M.filter(function (m) { return m.spec.sim; });
  const errOf = function (x) { return (x && x.errors ? x.errors.length : 0); };
  const vp = function (m) { return m.viewport.width + "x" + m.viewport.height; };

  // ---------------- preflight: static gates
  console.log("");
  info("---- static gates (dist/ and src/ as they are on disk now)");
  const meta = (distHtml.match(/<meta[^>]+name=["']viewport["'][^>]*>/i) || [""])[0];
  const content = (meta.match(/content=["']([^"']*)["']/i) || ["", ""])[1];
  check("IOS27-01 static: the viewport meta has width=device-width and viewport-fit=cover",
    /width\s*=\s*device-width/.test(content) && /viewport-fit\s*=\s*cover/.test(content), "content=\"" + content + "\"");
  check("IOS27-03 static: the viewport meta carries no maximum-scale and no user-scalable",
    !!content && !/maximum-scale|user-scalable/i.test(content), "content=\"" + content + "\"");

  const srcFiles = listFiles(SRC, /\.(jsx?|cjs|mjs|html)$/);
  const scan = srcFiles.map(function (f) { return { f: path.relative(ROOT, f), t: readText(f) || "" }; })
    .concat([{ f: "dist/index.html", t: distHtml }, { f: "dist/sw.js", t: swText || "" }]);
  const UA_RULES = [
    { name: "navigator.userAgent", re: /navigator\s*\.\s*userAgent/g },
    { name: "'iPhone OS'", re: /iPhone OS/g },
    { name: "toolbar.visible", re: /toolbar\s*\.\s*visible/g },
    { name: "a bare '(display-mode: standalone)'", re: /\(\s*display-mode\s*:\s*standalone\s*\)(?!\s*,\s*\(\s*display-mode\s*:\s*fullscreen\s*\))/g }
  ];
  const uaHits = [];
  scan.forEach(function (s) { UA_RULES.forEach(function (r) { const n = (s.t.match(r.re) || []).length; if (n) uaHits.push(r.name + " x" + n + " in " + s.f); }); });
  check("IOS27-01 static (also IOS27-10, IOS27-15): no navigator.userAgent, 'iPhone OS', toolbar.visible or bare '(display-mode: standalone)' in src/ or the dist JS",
    uaHits.length === 0, uaHits.length ? uaHits.slice(0, 6).join("; ") : "0 hits across " + scan.length + " files (" + srcFiles.length + " under src/, dist/index.html, dist/sw.js)");

  const TP = [
    { name: "corner-shape", re: /corner-shape/g }, { name: "random-item(", re: /random-item\(/g }, { name: "at-rule(", re: /(?:^|[^\w-])at-rule\(/g },
    { name: "ident(", re: /(?:^|[^\w-])ident\(/g }, { name: "inherit(", re: /(?:^|[^\w-])inherit\(/g }, { name: "object-view-box", re: /object-view-box/g },
    { name: "popover=\"hint\"", re: /popover\s*[=:]\s*["']hint["']/g }, { name: "Iterator.zip", re: /Iterator\s*\.\s*zip/g }
  ];
  const tpHits = [];
  [{ f: "dist/index.html", t: distHtml }, { f: "dist/sw.js", t: swText || "" }].forEach(function (s) { TP.forEach(function (r) { const n = (s.t.match(r.re) || []).length; if (n) tpHits.push(r.name + " x" + n + " in " + s.f); }); });
  check("IOS27-01 static allow-list: no Technology-Preview-only token (corner-shape, random-item(, at-rule(, ident(, inherit(, object-view-box, popover=hint, Iterator.zip) in dist",
    tpHits.length === 0, tpHits.length ? tpHits.join("; ") : "0 hits in dist/index.html and dist/sw.js (this engine accepts them; Safari 27.0 does not)");

  const ref = byKey["iphone-17-portrait-dark"];
  const cs = ref && ref.cssom ? ref.cssom : null;
  check("IOS27-01 CSSOM: every Safari 27.0-only CSS feature the app uses sits under @supports",
    !!cs && cs.s27outside.length === 0, cs ? (cs.s27outside.length ? cs.s27outside.slice(0, 4).join("; ") : "0 found outside @supports across " + cs.rules + " rules in " + cs.sheets + " sheet(s)") : "the CSSOM was not read (" + (ref && ref.fatal ? ref.fatal : "context missing") + ")");

  const NAMES = { "--sat": "top", "--sar": "right", "--sab": "bottom", "--sal": "left" };
  const rootBad = cs ? Object.keys(NAMES).filter(function (k) { return !(cs.rootVars[k] && new RegExp("env\\(\\s*safe-area-inset-" + NAMES[k] + "\\b").test(cs.rootVars[k])); }) : Object.keys(NAMES);
  check("IOS27-02 CSSOM (the IOS27-01 env() gate): env(safe-area-inset-top/right/bottom/left) are each held in a :root custom property (--sat --sar --sab --sal)",
    !!cs && rootBad.length === 0, cs ? (rootBad.length ? "missing or not env(): " + rootBad.map(function (k) { return k + " (" + NAMES[k] + ")=" + JSON.stringify(cs.rootVars[k] || null); }).join(", ") + "; :root custom properties now: " + (Object.keys(cs.rootVars).join(" ") || "none") : Object.keys(NAMES).map(function (k) { return k + "=" + cs.rootVars[k]; }).join(" ")) : "the CSSOM was not read");
  const need = { ".hdr": ["--sat", "--sar", "--sal"], ".tabs": ["--sat", "--sal", "--sar"], ".wrap": ["--sal", "--sar"], ".menu": ["--sar"], ".mc-root": ["--sab"] };
  const consumeBad = [];
  if (cs) {
    Object.keys(need).forEach(function (cls) {
      const txt = (cs.consume[cls] || []).join(" ");
      need[cls].forEach(function (v) { if (!new RegExp("var\\(\\s*" + v + "\\b").test(txt)) consumeBad.push(cls + " lacks var(" + v + ")"); });
    });
    const menuTxt = (cs.consume[".menu"] || []).join(" ");
    const topDecl = (menuTxt.match(/(?:^|;)\s*top\s*:\s*([^;]+)/) || ["", ""])[1].trim();
    if (!/var\(\s*--sat\b/.test(menuTxt) && /^\d+(\.\d+)?px$/.test(topDecl)) consumeBad.push(".menu top is a fixed " + topDecl + " with no var(--sat) (nor anchored to the header)");
  }
  check("IOS27-02 CSSOM: .hdr, .tabs, .wrap, .menu and .mc-root consume the inset variables (the plan's rules)",
    !!cs && consumeBad.length === 0, cs ? (consumeBad.length ? consumeBad.join("; ") : "all present") : "the CSSOM was not read");
  check("IOS27-02 CSSOM guard (smoke E025): the top-level .mc-root rules still declare exactly 21 custom properties",
    !!cs && cs.mcRootProps.length === 21, cs ? cs.mcRootProps.length + " custom properties on top-level .mc-root rules" + (cs.rootVars && Object.keys(cs.rootVars).length ? "; :root holds " + Object.keys(cs.rootVars).length : "") : "the CSSOM was not read");

  const regOk = /serviceWorker\.register\(\s*['"]sw\.js['"]\s*,\s*\{\s*scope\s*:\s*['"]\.\/['"]\s*\}/.test(distHtml);
  check("IOS27-07 static: dist/sw.js sits beside index.html and the page registers 'sw.js' with scope './'",
    fs.existsSync(path.join(DIST, "sw.js")) && regOk, "dist/sw.js " + (fs.existsSync(path.join(DIST, "sw.js")) ? "present" : "MISSING") + ", register('sw.js', {scope:'./'}) " + (regOk ? "found" : "NOT found"));

  // ---------------- IOS27-01 per context
  console.log("");
  info("---- IOS27-01 the matrix: " + desc.length + " descriptor contexts + " + sims.length + " SIM:standalone contexts");
  const bootLine = function (list) { return list.map(function (m) { return m.spec.key + " " + (m.t.boot ? sec(m.t.boot) : "?") + (m.fatal ? " ERROR " + m.fatal : "") + (m.errors.length ? " errors " + m.errors.length : ""); }).join("; "); };
  const descBad = desc.filter(function (m) { return m.fatal || m.errors.length || m.mode0 === null; });
  check("IOS27-01 all " + desc.length + " descriptor contexts boot with 0 page errors and 0 console errors",
    desc.length === 12 && descBad.length === 0, (descBad.length ? "BAD: " + descBad.map(function (m) { return m.spec.key + ": " + (m.fatal || m.errors.slice(0, 2).join(" | ")); }).join("; ") + " · " : "") + "boot " + bootLine(desc));
  /* viewport = screen: the inner size the page reports must be the descriptor's screen (portrait) or its
     transpose (landscape), which runMatrix set; a meta-viewport or engine rescale would show here */
  const simBad = sims.filter(function (m) { return m.fatal || m.errors.length || !m.simState || !m.simState.standalone || !m.simState.nav || m.simState.browser || !m.simState.inner || m.simState.inner[0] !== m.viewport.width || m.simState.inner[1] !== m.viewport.height; });
  check("IOS27-01 SIM: all " + sims.length + " standalone contexts boot with 0 page errors, with the shim active (display-mode standalone true, browser false, navigator.standalone true, viewport = screen)",
    sims.length === 12 && simBad.length === 0, (simBad.length ? "BAD: " + simBad.map(function (m) { return m.spec.key + ": " + (m.fatal || (m.errors.length ? m.errors.slice(0, 2).join(" | ") : JSON.stringify(m.simState) + " vs screen " + vp(m))); }).join("; ") + " · " : "") + "inner = screen in " + sims.filter(function (m) { return m.simState && m.simState.inner && m.simState.inner[0] === m.viewport.width && m.simState.inner[1] === m.viewport.height; }).length + "/" + sims.length + "; boot " + bootLine(sims));

  const taps = [], tapBad = [];
  M.forEach(function (m) {
    (m.tabRuns || []).forEach(function (r) {
      const pd = r.ptr.filter(function (e) { return e.type === "pointerdown"; })[0], ck = r.ptr.filter(function (e) { return e.type === "click"; })[0];
      const ok = r.switched && r.view === r.id && !!pd && pd.pointerType === "touch" && pd.trusted === true && !!ck && ck.trusted === true && r.boundary === 0;
      taps.push(ok);
      if (!ok && tapBad.length < 5) tapBad.push(m.spec.key + "/" + r.id + ": view " + r.view + ", pointerdown " + (pd ? pd.pointerType + (pd.trusted ? "/trusted" : "/untrusted") : "none") + ", click " + (ck ? (ck.trusted ? "trusted" : "untrusted") : "none") + ", boundary " + r.boundary);
    });
  });
  const tabCounts = M.map(function (m) { return (m.tabs || []).length; });
  check("IOS27-01 every tab the strip offers, tapped with page.tap, switches data-view with a trusted touch pointer and no .boundary, in every context",
    taps.length > 0 && tapBad.length === 0 && M.every(function (m) { return m.tabs && m.tabs.length > 0 && m.tabRuns.length === m.tabs.length; }),
    tapBad.length ? tapBad.join("; ") : taps.length + " taps over " + M.length + " contexts (" + Array.from(new Set(tabCounts)).join("/") + " tabs read from the strip: " + ((ref && ref.tabs) || []).join(",") + "); every pointerdown touch+trusted, every click trusted");

  const ovRows = [];
  const ovBad = [];
  M.forEach(function (m) {
    (m.tabRuns || []).forEach(function (r) { const w = r.walk; ovRows.push(w); if (w.docSW > w.docCW || (w.stripSW !== null && w.stripSW > w.stripCW) || w.n > 0) ovBad.push(m.spec.key + "/" + r.id + " first paint: doc " + w.docSW + "/" + w.docCW + ", strip " + w.stripSW + "/" + w.stripCW + ", walk " + w.n + (w.offenders[0] ? " (" + w.offenders[0].el + " " + w.offenders[0].side + " +" + w.offenders[0].over + ")" : "")); });
    if (m.deep) m.deep.walks.forEach(function (w) { ovRows.push(w); if (w.docSW > w.docCW || (w.stripSW !== null && w.stripSW > w.stripCW) || w.n > 0) ovBad.push(m.spec.key + "/" + w.tab + " all open: doc " + w.docSW + "/" + w.docCW + ", strip " + w.stripSW + "/" + w.stripCW + ", walk " + w.n + (w.offenders[0] ? " (" + w.offenders[0].el + " " + w.offenders[0].side + " +" + w.offenders[0].over + ")" : "")); });
  });
  const widths = Array.from(new Set(M.map(function (m) { return m.viewport.width; }))).sort(function (a, b) { return a - b; });
  const excused = ovRows.reduce(function (s, w) { return s + w.excused; }, 0);
  check("IOS27-01 (also IOS27-03, IOS27-09) no horizontal overflow by document width, strip scroll box or element walk, every tab of every context, first paint and all-open",
    ovRows.length > 0 && ovBad.length === 0, ovBad.length ? ovBad.slice(0, 5).join("; ") + (ovBad.length > 5 ? " (+" + (ovBad.length - 5) + ")" : "") : ovRows.length + " readings at widths " + widths.join(", ") + "; 0 unreachable edges; " + excused + " edges excused by an inner scroller (.tbl)");

  const words = [], wordBad = [];
  M.forEach(function (m) {
    if (m.landing) { words.push(m.landing.words); if (!(m.landing.words > 0 && m.landing.words < 110)) wordBad.push(m.spec.key + " landing " + m.landing.words); }
    (m.tabRuns || []).forEach(function (r) { if (!(r.words.words > 0 && r.words.words < 500)) wordBad.push(m.spec.key + "/" + r.id + " " + r.words.words); });
  });
  const r17p = byKey["iphone-17-pro-portrait-dark"];
  check("IOS27-09 (Part G) landing < 110 and every tab < 500 visible words by the IOS27-16 counter, in every context",
    words.length === M.length && wordBad.length === 0,
    wordBad.length ? wordBad.slice(0, 6).join("; ") : "landing " + Math.min.apply(null, words) + "–" + Math.max.apply(null, words) + " words; iPhone 17 Pro portrait tabs " + (r17p && r17p.tabRuns ? r17p.tabRuns.map(function (r) { return r.id + " " + r.words.words + " (innerText " + r.words.inner + ")"; }).join(", ") : "?"));

  const shotBad = [], shotRows = [];
  M.forEach(function (m) {
    if (!m.shot) { shotBad.push(m.spec.key + " no screenshot"); return; }
    const want = [m.viewport.width * 3, m.viewport.height * 3];
    shotRows.push(path.basename(m.shot.file) + " " + m.shot.size.join("x"));
    if (m.shot.size[0] !== want[0] || m.shot.size[1] !== want[1]) shotBad.push(m.spec.key + " " + m.shot.size.join("x") + " != " + want.join("x"));
  });
  const sizes = {};
  M.forEach(function (m) { if (m.shot) sizes[(m.spec.sim ? "SIM " : "") + m.spec.profile + " " + m.spec.orient] = m.shot.size.join("x"); });
  check("IOS27-01 DPR-3 screenshots: every PNG IHDR equals viewport x 3 (written to qa/shots/ios-*.png)",
    shotBad.length === 0 && shotRows.length === M.length,
    shotBad.length ? shotBad.join("; ") : Object.keys(sizes).map(function (k) { return k + " " + sizes[k]; }).join(", "));

  const pairs = [], pairBad = [];
  ORIENTS.forEach(function (o) { SCHEMES.forEach(function (s) { [false, true].forEach(function (sim) {
    const a = byKey["iphone-17-" + o + "-" + s + (sim ? "-sim" : "")], b = byKey["iphone-17-pro-" + o + "-" + s + (sim ? "-sim" : "")];
    if (!a || !b || !a.shot || !b.shot) { pairBad.push(o + "/" + s + (sim ? "/sim" : "") + " missing"); return; }
    pairs.push(a.shot.hash === b.shot.hash);
    if (a.shot.hash !== b.shot.hash) pairBad.push(o + "/" + s + (sim ? "/sim" : "") + " differs");
  }); }); });
  check("IOS27-01 iPhone 17 Pro renders byte-identical to iPhone 17 (same 402-wide viewport): reported once as identical, not as two results",
    pairs.length === 8 && pairBad.length === 0, pairBad.length ? pairBad.join("; ") : "identical in 8/8 pairs (portrait/landscape x light/dark x Safari tab/SIM)");

  const ldBad = [], ld = [];
  PROFILES.forEach(function (p) { ORIENTS.forEach(function (o) { [false, true].forEach(function (sim) {
    const a = byKey[slug(p) + "-" + o + "-light" + (sim ? "-sim" : "")], b = byKey[slug(p) + "-" + o + "-dark" + (sim ? "-sim" : "")];
    if (!a || !b || !a.shot || !b.shot) { ldBad.push(slug(p) + "-" + o + (sim ? "-sim" : "") + " missing"); return; }
    ld.push(a.shot.hash === b.shot.hash);
    if (a.shot.hash !== b.shot.hash) ldBad.push(slug(p) + "-" + o + (sim ? "-sim" : "") + " light != dark");
  }); }); });
  const darkOnly = cs ? cs.schemeRules === 0 && cs.lightDark === 0 : null;
  check("IOS27-01 light == dark by screenshot hash while the app is dark-only (a half-light theme would fail loudly)",
    ld.length === 12 && ldBad.length === 0, (ldBad.length ? ldBad.join("; ") : "identical in 12/12 pairs") + "; CSSOM: " + (cs ? cs.schemeRules + " prefers-color-scheme rules, " + cs.lightDark + " light-dark()" + (darkOnly ? " (dark-only)" : " (NOT dark-only any more: replace this with per-scheme contrast checks)") : "not read"));

  // ---------------- IOS27-02 SIM
  console.log("");
  info("---- IOS27-02 safe areas under SIM insets (placeholders, not Apple figures: portrait --sat " + SIM_INSETS.portrait.sat + " --sab " + SIM_INSETS.portrait.sab + "; landscape --sal/--sar " + SIM_INSETS.landscape.sal + ")");
  const G = sims.filter(function (m) { return m.geom; });
  const gName = function (m) { return m.spec.profile + " " + m.spec.orient; };
  {
    const bad = [], rows = [];
    G.forEach(function (m) {
      const g = m.geom, t = g.top, i = g.ins;
      rows.push(gName(m) + ": h1 " + f2(t.h1 && t.h1.y) + ", ↻ " + f2(t.refresh && t.refresh.y) + ", ⋯ " + f2(t.menu && t.menu.y));
      if (!(t.h1 && t.h1.y >= i.sat + 12 - 0.5)) bad.push(gName(m) + " h1 top " + f2(t.h1 && t.h1.y) + " < " + (i.sat + 12));
      if (!(t.refresh && t.refresh.y >= i.sat - 0.5 && t.menu && t.menu.y >= i.sat - 0.5)) bad.push(gName(m) + " ↻/⋯ top " + f2(t.refresh && t.refresh.y) + "/" + f2(t.menu && t.menu.y) + " < " + i.sat);
    });
    check("IOS27-02 SIM: the title clears the top inset by 12 (h1 top ≥ " + (SIM_INSETS.portrait.sat + 12) + " in portrait) and ↻/⋯ tops ≥ the inset",
      G.length === 6 && bad.length === 0, (bad.length ? bad.join("; ") + " · " : "") + rows.join("; "));
  }
  {
    const bad = [], rows = [];
    G.forEach(function (m) {
      const g = m.geom, i = g.ins;
      rows.push(gName(m) + ": scrollY " + g.scrolled.y + " (strip at " + g.tabsAt0 + " unscrolled), .tabs top " + g.scrolled.tabsTop + (g.scrim ? ", band 0–" + i.sat + " " + (g.scrim.pixels - g.scrim.off) + "/" + g.scrim.pixels + " device px " + g.scrim.want + " (" + g.scrim.masked + " masked: the engine's own corner pixel, measured on a plain page)" : ""));
      if (!(g.tabsAt0 !== null && g.scrolled.y >= g.tabsAt0 - i.sat)) bad.push(gName(m) + " the page scrolled only " + g.scrolled.y + ", too short to pin a strip that starts at " + g.tabsAt0);
      else if (!(Math.abs(g.scrolled.tabsTop - i.sat) <= 0.5)) bad.push(gName(m) + " .tabs top " + g.scrolled.tabsTop + " != " + i.sat);
      if (i.sat > 0 && !(g.scrim && g.scrim.off === 0)) bad.push(gName(m) + " band not all --bg2: " + (g.scrim ? g.scrim.off + " px off, first " + g.scrim.sample : "not read"));
      /* the mask excuses only the engine's own spoiled pixels; if it grew past 1% of the band the
         band could not be judged at all, and a vacuous green is not a pass */
      if (i.sat > 0 && g.scrim && !(g.scrim.pixels > 0 && g.scrim.masked * 100 <= g.scrim.pixels + g.scrim.masked)) bad.push(gName(m) + " the engine spoils " + g.scrim.masked + " of " + (g.scrim.pixels + g.scrim.masked) + " band pixels even under a plain --bg2 overlay, so the scrim cannot be judged");
    });
    check("IOS27-02 SIM: after scrollTo(0,800) .tabs pins at the top inset and the band 0–inset is painted --bg2 (the scrim)",
      G.length === 6 && bad.length === 0, (bad.length ? bad.join("; ") + " · " : "") + rows.join("; "));
  }
  {
    const bad = [], rows = [];
    G.forEach(function (m) {
      const g = m.geom;
      if (!g.menu) { bad.push(gName(m) + " menu not measured: " + (g.menuErr || "?")); return; }
      rows.push(gName(m) + ": menu top " + g.menu.menu.y + ", header bottom " + g.menu.hdr.b);
      if (!(g.menu.menu.y >= g.menu.hdr.b - 0.5)) bad.push(gName(m) + " menu top " + g.menu.menu.y + " < header bottom " + g.menu.hdr.b);
    });
    check("IOS27-02 SIM: the ⋯ menu opens below the header (menu top ≥ header bottom)", G.length === 6 && bad.length === 0, (bad.length ? bad.join("; ") + " · " : "") + rows.join("; "));
  }
  {
    const bad = [], rows = [];
    G.forEach(function (m) {
      const g = m.geom, t = g.top, i = g.ins;
      rows.push(gName(m) + ": " + t.n + " controls, " + t.bandHits + " in a band" + (i.sal ? ", first tab left " + f2(t.firstTab && t.firstTab.x) : ""));
      if (t.bandHits > 0) bad.push(gName(m) + " " + t.bandHits + " controls in an inset band (" + t.bandSample.join("; ") + ")");
      if (i.sal > 0 && !(t.firstTab && t.firstTab.x >= i.sal - 0.5)) bad.push(gName(m) + " first .tabi left " + f2(t.firstTab && t.firstTab.x) + " < " + i.sal);
    });
    check("IOS27-02 SIM: no interactive rect intersects an inset band, and in landscape the first .tabi left ≥ " + SIM_INSETS.landscape.sal,
      G.length === 6 && bad.length === 0, (bad.length ? bad.slice(0, 4).join("; ") + " · " : "") + rows.join("; "));
  }
  {
    const bad = [], rows = [];
    G.forEach(function (m) {
      const g = m.geom, i = g.ins;
      rows.push(gName(m) + ": .wrap bottom " + g.end.wrapBottom + " vs " + (g.end.vh - i.sab));
      if (!(g.end.wrapBottom !== null && g.end.wrapBottom <= g.end.vh - i.sab + 0.5)) bad.push(gName(m) + " content bottom " + g.end.wrapBottom + " > " + (g.end.vh - i.sab));
    });
    check("IOS27-02 SIM: at the end of the scroll the last content clears the bottom inset (≤ innerHeight − " + SIM_INSETS.portrait.sab + " in portrait)",
      G.length === 6 && bad.length === 0, (bad.length ? bad.join("; ") + " · " : "") + rows.join("; "));
  }
  {
    const ctl = sims.filter(function (m) { return m.control; });
    const bad = ctl.filter(function (m) { return !m.control.same; });
    check("IOS27-02 SIM control: with the four variables forced to 0px every header, title, ↻, ⋯, tabs and wrap rect equals the unset one (env() is 0 in this engine)",
      ctl.length === 12 && bad.length === 0, bad.length ? bad.map(function (m) { return m.spec.key + " " + JSON.stringify(m.control.r0) + " vs " + JSON.stringify(m.control.r1); }).slice(0, 2).join("; ") : ctl.length + " SIM contexts, identical rects");
  }

  // ---------------- IOS27-03
  console.log("");
  const deep = desc.filter(function (m) { return m.deep; });
  {
    const forms = [];
    deep.forEach(function (m) { m.deep.forms.forEach(function (f) { forms.push(Object.assign({ key: m.spec.profile + " " + m.spec.orient }, f)); }); });
    const small = forms.filter(function (f) { return !(f.fs >= 16); });
    const uniq = {};
    forms.forEach(function (f) { uniq[f.tag + ":" + f.id] = f.fs + "px"; });
    check("IOS27-03 every visible input, select and textarea computes to 16px or larger (iPhone 17, 17 Pro, 17 Pro Max, portrait and landscape, every section open)",
      deep.length === 6 && forms.length > 0 && small.length === 0,
      (small.length ? small.length + "/" + forms.length + " below 16px · " : forms.length + " controls, all ≥16px · ") + Object.keys(uniq).map(function (k) { return k + " " + uniq[k]; }).join(", "));
  }

  // ---------------- IOS27-04
  {
    const a = R["shell-a"] || {};
    const r1 = a.r1 || {}, r2 = a.r2 || {}, st = a.stored || {};
    const ok = !a.fatal && r1.mode === "full" && r1.blocks > 0 && a.confirmed === true && r2.mode === "full" && r2.view === a.tab && r2.open === "true" && r2.blocks === 0 &&
      st.uiIsText && Array.isArray(st.squad) && a.marker && st.squad.indexOf(a.marker.id) < 0 && r2.typeErrors === 0 && errOf(a) === 0;
    check("IOS27-04 shell A (strict text-only window.storage): mode, tab, an open section and a confirmed squad survive a reload",
      ok, a.fatal ? "error: " + a.fatal + (a.seedFrom ? " (state was written to " + a.seedFrom + ")" : "") :
        "first boot wrote state to " + a.seedFrom + "; seeded text state (full/" + a.seedTab + ") with " + (a.marker ? a.marker.name + " #" + a.marker.id : "?") + " → mode " + r1.mode + ", view " + r1.view + ", D3 blocks " + r1.blocks + ", confirm " + (a.confirmed ? "tapped" : "absent") +
        " · after " + (a.tab || "?") + "/" + (a.section || "?") + " and a reload: mode " + r2.mode + ", view " + r2.view + ", section open " + r2.open + ", blocks " + r2.blocks +
        " · non-string set() calls rejected: " + r2.typeErrors + ", page errors " + errOf(a));
  }
  {
    const b = R["shell-b"] || {}, r = b.r || {}, nt = r.note || {};
    check("IOS27-04 shell B (set resolves, get always null): the landing says 'This copy is not saving on this device', no .boundary, landing (with the note) < 110 words",
      !b.fatal && nt.found === true && r.boundary === 0 && nt.total > 0 && nt.total < 110 && errOf(b) === 0,
      b.fatal ? "error: " + b.fatal : "note " + (nt.found ? "found (" + (nt.inLanding ? "inside" : "outside") + " .landing): " + JSON.stringify(nt.text) : "absent") + ", .boundary " + r.boundary + ", landing " + nt.landing + " words, with the note " + nt.total + ", set() calls " + r.sets + ", page errors " + errOf(b));
  }
  const c = R["shell-c"] || {}, cf = c.frame || {}, cn = cf.note || {};
  check("IOS27-01 PWA block / IOS27-04 shell C: in <iframe sandbox=\"allow-scripts\"> the app mounts with 0 page errors while localStorage throws SecurityError",
    !c.fatal && c.mounted === true && /SecurityError/.test(String(cf.ls)) && errOf(c) === 0 && (cf.errs || []).length === 0 && cf.boundary === 0 && cf.helpers === true,
    c.fatal ? "error: " + c.fatal : "mounted " + c.mounted + ", origin " + cf.origin + ", localStorage " + cf.ls + ", __PWA__.sw " + cf.pwa + ", .boundary " + cf.boundary + ", page errors " + errOf(c) + ", frame errors " + JSON.stringify(cf.errs || []) + " (an approximation: the real host's flags are unverified)");
  check("IOS27-04 shell C: the sandboxed copy shows the not-saving note (landing with the note < 110 words)",
    !c.fatal && cn.found === true && cn.total < 110, c.fatal ? "error: " + c.fatal : "note " + (cn.found ? JSON.stringify(cn.text) : "absent") + ", landing " + cn.landing + " words, with the note " + cn.total);

  // ---------------- IOS27-05
  {
    const s = R.shim || {};
    check("IOS27-05 dist shim: window.storage.set resolves false when localStorage.setItem throws QuotaExceededError",
      !s.fatal && s.setResult && s.setResult.value === false, s.fatal ? "error: " + s.fatal : "set('k',{a:1}) → " + JSON.stringify(s.setResult) + ", shim marker " + JSON.stringify(s.shim && s.shim.marker));
    check("IOS27-05 a failed save shows 'Last change not saved (<reason>). Export now.'",
      !s.fatal && !!s.noteFull && s.noteFull.found === true,
      s.fatal ? "error: " + s.fatal : "note after toggling a section with setItem throwing: " + (s.noteFull && s.noteFull.found ? JSON.stringify(s.noteFull.text) : JSON.stringify(s.note) + (s.note ? " (no reason, or no 'Export now', in one visible element)" : "")));
    check("IOS27-05 navigator.storage.persist() is called exactly once after the first save",
      !s.fatal && s.persistAfterBoot && s.persistAfterBoot.present && s.persistAfterMore === 1,
      s.fatal ? "error: " + s.fatal : "persist present " + (s.persistAfterBoot && s.persistAfterBoot.present) + ", calls after boot " + (s.persistAfterBoot && s.persistAfterBoot.calls) + ", after more saves " + s.persistAfterMore);
    check("IOS27-05 with persist() absent the app boots and saves with 0 page errors",
      !s.fatal2 && s.gone === true && (s.errors2 || []).length === 0 && s.saved2 === true,
      s.fatal2 ? "error: " + s.fatal2 : "persist deleted " + s.gone + ", saved " + s.saved2 + ", page errors " + (s.errors2 || []).length + ((s.errors2 || []).length ? " (" + s.errors2.slice(0, 2).join(" | ") + ")" : ""));
  }

  // ---------------- IOS27-06 (and the IOS27-01 PWA lifecycle)
  console.log("");
  info("---- PWA on the loopback server (real service-worker lifecycle; the sandbox's WebKit, not an iPhone)");
  {
    const p = R.pwa || {}, sw = p.sw || {};
    const shellLen = sw.shell ? sw.shell.length : null;
    const run = function (b) { return (p.runs || []).filter(function (r) { return r.base === b; })[0]; };
    const root = run("/"), sub = run(SUB);
    const life = function (r) { return r && r.first && r.first.pwa && r.first.pwa.sw === "registered" && r.first.ready && r.first.ready.active === "activated" && r.first.entries === shellLen && r.second && r.second.controlled === true; };
    const desc1 = function (r) { return r ? "__PWA__.sw " + (r.first.pwa && r.first.pwa.sw) + ", scope " + (r.first.ready && r.first.ready.scope) + ", active " + (r.first.ready && r.first.ready.active) + ", " + r.first.entries + "/" + shellLen + " cached in " + sw.cache + ", controlled after reload " + (r.second && r.second.controlled) : "not run"; };
    check("IOS27-01 PWA loopback lifecycle: the worker registers and activates, the precache holds SHELL.length entries fetched from the server, and the page is controlled after reload",
      !p.fatal && shellLen > 0 && life(root) && (p.shellFetched["/"] || []).length === shellLen,
      p.fatal ? "error: " + p.fatal : desc1(root) + "; server saw " + (p.shellFetched ? p.shellFetched["/"].length : 0) + "/" + shellLen + " SHELL files");
    check("IOS27-01 PWA offline boot: with the server closed a reload mounts .mc-root from the worker (never context.setOffline)",
      !p.fatal && root && root.offline && root.offline.fresh === true && root.offline.mounted === true && root.offline.controlled === true,
      p.fatal ? "error: " + p.fatal : "after server.close(): " + JSON.stringify(root && root.offline));
    check("IOS27-06 subpath: under /comeback-blueprint/ the worker's scope ends in /comeback-blueprint/, SHELL.length entries are cached, and a reload mounts after the server closes",
      !p.fatal && life(sub) && /\/comeback-blueprint\/$/.test(String(sub.first.ready && sub.first.ready.scope)) && sub.offline && sub.offline.fresh === true && sub.offline.mounted === true,
      p.fatal ? "error: " + p.fatal : desc1(sub) + "; offline " + JSON.stringify(sub && sub.offline));
    info("IOS27-06 CI-only half (a post-deploy curl of index.html, sw.js and manifest.webmanifest, and served CACHE == committed CACHE) cannot run here: it is on the device/CI checklist below");
  }

  // ---------------- IOS27-07
  {
    const u = R.update || {};
    check("IOS27-07 update: a visibilitychange makes the page ask the server for sw.js (reg.update())",
      !u.fatal && u.controlled0 === true && u.swRequested === true, u.fatal ? "error: " + u.fatal : "controlled before the swap " + u.controlled0 + ", sw.js requested within 6 s of visibilitychange: " + u.swRequested);
    check("IOS27-07 update: the new worker activates and the 'New build ready. Tap to reload.' note renders",
      !u.fatal && u.newActive === true && !!u.note, u.fatal ? "error: " + u.fatal : "new cache " + u.newCache + " present " + u.newActive + ", note " + JSON.stringify(u.note));
    const at = u.afterTap || {};
    check("IOS27-07 update: tapping the note reloads into the new build with only the new fpl-mc- cache",
      !u.fatal && !!u.note && at.reloaded === true && at.next === true && Array.isArray(at.names) && at.names.length === 1 && at.names[0] === u.newCache,
      u.fatal ? "error: " + u.fatal : (u.note ? "after the tap: " + JSON.stringify(at) : "no note to tap"));
    const h = u.hygiene || {};
    check("IOS27-01 PWA cache hygiene: after CACHE changes and a navigation, caches.keys() holds only the new fpl-mc- name and the new build is on the page",
      !u.fatal && Array.isArray(h.names) && h.names.length === 1 && h.names[0] === u.newCache && h.next === true, u.fatal ? "error: " + u.fatal : "old " + u.oldCache + " → " + JSON.stringify(h));
    const v = R.revalidate || {};
    const RV = "IOS27-07 revalidation: with index.html served max-age=600 the next open still reaches the server (and shows the new file)";
    if (v.fatal) check(RV, false, "error: " + v.fatal);
    else if (v.controlHits !== 0) skip(RV, "not provable here: with no worker this engine re-requested index.html " + v.controlHits + " time(s) despite max-age=600, so its HTTP cache cannot show the difference; left on the device checklist");
    else if (!v.probeControlled || v.probeHits !== 0) skip(RV, "not provable here: the same document under a minimal worker doing plain fetch(e.request) (today's pattern) " + (v.probeControlled ? "already reached the server " + v.probeHits + " time(s)" : "never took control") + " on a max-age=600 re-open, so this engine revalidates whatever the worker asks and the check could not turn red; left on the device checklist (no-worker control: 0 re-requests)");
    else check(RV, v.controlled === true && v.swHits > 0 && v.newShown === true,
      "controls on the same document: no worker 0 re-requests, a plain fetch(e.request) worker 0 re-requests (the HTTP cache honours max-age); the app's worker: " + v.swHits + " request(s) after the file changed, new file shown " + v.newShown);
  }

  // ---------------- IOS27-08
  console.log("");
  {
    /* one line per shell: a measured Safari-tab line and a SIM: line (placeholder insets), so a SIM
       result is never reported under a measured name */
    const J = M.filter(function (m) { return m.jump; });
    const shells = [[false, "IOS27-08 ", " (Safari tab)"], [true, "IOS27-08 SIM: ", " under the placeholder insets"]];
    shells.forEach(function (sh) {
      const Jg = J.filter(function (m) { return m.spec.sim === sh[0]; });
      const bad = [], rows = [];
      Jg.forEach(function (m) {
        const j = m.jump, nm = gName(m);
        if (j.err || !j.tab) { bad.push(nm + " error " + (j.err || "no reading")); return; }
        rows.push(nm + ": " + j.planId + " scrolled to " + j.scrolledTo + " → tap " + j.squadId + ": scrollY " + j.tab.y + ", first section " + j.tab.first + " top " + j.tab.top + " vs .tabs bottom " + j.tab.tabsBottom);
        if (!(j.tab.top !== null && j.tab.top >= j.tab.tabsBottom - 0.5)) bad.push(nm + " first section top " + j.tab.top + " < .tabs bottom " + j.tab.tabsBottom);
      });
      check(sh[1] + "tab switch" + sh[2] + ": from " + ((Jg[0] && Jg[0].jump.planId) || "plan") + " (every section open) at scroll 2000, tapping " + ((Jg[0] && Jg[0].jump.squadId) || "squad") + " lands the first section below the tabs",
        Jg.length === 1 && bad.length === 0, (bad.length ? bad.join("; ") + " · " : "") + (rows.join("; ") || "not measured"));
    });
    shells.forEach(function (sh) {
      const Jg = J.filter(function (m) { return m.spec.sim === sh[0]; });
      const bad2 = [], rows2 = [];
      Jg.forEach(function (m) {
        const j = m.jump, nm = gName(m);
        if (j.err || !j.jump) { bad2.push(nm + " error " + (j.err || "no reading")); return; }
        const x = j.jump;
        rows2.push(nm + ": view " + x.view + ", lab-import top " + x.top + " (tabs bottom " + x.tabsBottom + ", innerHeight " + x.vh + "), focus " + x.active);
        if (!(x.top !== null && x.top >= x.tabsBottom - 0.5 && x.top < x.vh)) bad2.push(nm + " lab-import top " + x.top + " outside " + x.tabsBottom + "–" + x.vh);
        if (!x.activeIsSecH) bad2.push(nm + " focus on " + x.active + ", not the section header");
      });
      check(sh[1] + "menu jump" + sh[2] + ": ⋯ → Import from the top of " + ((Jg[0] && Jg[0].jump.nowId) || "the first tab") + " lands lab-import between the tabs and the fold, with focus on its .sec-h",
        Jg.length === 1 && bad2.length === 0, (bad2.length ? bad2.join("; ") + " · " : "") + (rows2.join("; ") || "not measured"));
    });
  }

  // ---------------- IOS27-09
  {
    const bad = [], rows = [];
    deep.forEach(function (m) {
      const k = m.deep.cls, nm = gName(m);
      [".btn", ".inp", ".reveal"].forEach(function (s) {
        const o = k[s];
        if (!o || !o.n) { bad.push(nm + " no visible " + s); return; }
        if (o.minH < 44 - 0.5) bad.push(nm + " " + s + " " + f2(o.minH) + " (" + o.whereH + ")");
      });
      rows.push(nm + " .btn " + f2(k[".btn"] && k[".btn"].minH) + " .inp " + f2(k[".inp"] && k[".inp"].minH) + " .reveal " + f2(k[".reveal"] && k[".reveal"].minH));
    });
    check("IOS27-09 .btn, .inp and .reveal are ≥ 44 tall (Apple's 44x44 pt), three profiles portrait and landscape, every section open",
      deep.length === 6 && bad.length === 0, (bad.length ? bad.slice(0, 4).join("; ") + " · " : "") + rows.join("; "));
  }
  {
    const bad = [], rows = [];
    deep.forEach(function (m) {
      const h = m.deep.header, nm = gName(m);
      if (!h || !h.refresh || !h.menu) { bad.push(nm + " header buttons not found"); return; }
      rows.push(nm + " ↻ " + h.refresh.w + "x" + h.refresh.h + " at x=" + h.refresh.x + ",y=" + h.refresh.y + ", ⋯ " + h.menu.w + "x" + h.menu.h + " at x=" + h.menu.x);
      if (!(h.refresh.w >= 43.5 && h.refresh.h >= 43.5 && h.menu.w >= 43.5 && h.menu.h >= 43.5)) bad.push(nm + " ↻ " + h.refresh.w + "x" + h.refresh.h + ", ⋯ " + h.menu.w + "x" + h.menu.h);
    });
    check("IOS27-09 header ↻ and ⋯ (.btn-ic) are ≥ 44x44", deep.length === 6 && bad.length === 0, (bad.length ? bad.slice(0, 3).join("; ") + " · " : "") + rows.slice(0, 3).join("; "));
  }
  {
    const bad = [], rows = [];
    const rule = [[".btn-sm", 32, 28], [".tabi", 52, 28], [".menu-i", 44, 0], [".sec-h", 48, 0], [".row", 38, 0]];
    deep.forEach(function (m) {
      const k = m.deep.cls, nm = gName(m);
      rule.forEach(function (r) {
        const o = k[r[0]];
        if (!o || !o.n) { bad.push(nm + " no visible " + r[0]); return; }
        if (o.minH < r[1] - 0.5) bad.push(nm + " " + r[0] + " " + f2(o.minH) + " tall < " + r[1] + " (" + o.whereH + ")");
        if (r[2] && o.minW < r[2] - 0.5) bad.push(nm + " " + r[0] + " " + f2(o.minW) + " wide < " + r[2] + " (" + o.whereW + ")");
      });
      rows.push(nm + ": " + rule.map(function (r) { const o = k[r[0]] || {}; return r[0] + " " + f2(o.minH) + (r[2] ? "x" + f2(o.minW) : ""); }).join(" "));
    });
    check("IOS27-09 other floors: .btn-sm ≥ 32 tall and ≥ 28 wide, .tabi ≥ 52 tall and ≥ 28 wide, .menu-i ≥ 44, .sec-h ≥ 48, .row ≥ 38",
      deep.length === 6 && bad.length === 0, (bad.length ? bad.slice(0, 4).join("; ") + " · " : "") + rows.slice(0, 6).join("; "));
  }
  {
    const bad = [], rows = [];
    deep.forEach(function (m) {
      const d = m.deep, nm = gName(m), h = d.header || {};
      rows.push(nm + ": " + d.overlaps.count + " intersecting pairs, .hdr-r gap " + h.gap + " (css " + h.gapCss + ")");
      if (d.overlaps.count > 0) bad.push(nm + " " + d.overlaps.count + " pairs (" + d.overlaps.hits.slice(0, 2).join("; ") + ")");
      if (!(h.gap >= 12 - 0.01)) bad.push(nm + " .hdr-r gap " + h.gap + " < 12");
    });
    check("IOS27-09 spacing: no two interactive rects intersect and the .hdr-r gap is ≥ 12 (Apple's 'about 12 points')",
      deep.length === 6 && bad.length === 0, (bad.length ? bad.slice(0, 3).join("; ") + " · " : "") + rows.slice(0, 3).join("; "));
  }
  {
    const bad = [], rows = [];
    deep.forEach(function (m) { rows.push(gName(m) + " " + m.deep.type.px + "px"); if (!(m.deep.type.px >= 11)) bad.push(gName(m) + " " + m.deep.type.px + "px on " + m.deep.type.where); });
    check("IOS27-01 (Part G) type floor: no visible text below 11px, every section open", deep.length === 6 && bad.length === 0, (bad.length ? bad.join("; ") + " · " : "") + rows.join(", ") + (deep[0] ? "; opened by tap " + deep.map(function (m) { return m.deep.opened.tapped + (m.deep.opened.fallback ? "+" + m.deep.opened.fallback + " DOM" : ""); }).join("/") : ""));
  }

  // ---------------- IOS27-10
  {
    const d = R["dist-refresh"] || {};
    const posts = Math.max(d.posts || 0, d.reqPosts || 0, ((d.fetchLog || "").match(/POST/g) || []).length);
    check("IOS27-10 dist: tapping ↻ sends no POST to api.anthropic.com (the artifact-only refresh)",
      !d.fatal && posts === 0, d.fatal ? "error: " + d.fatal : posts + " POST(s) seen (route " + (d.posts || 0) + ", request events " + (d.reqPosts || 0) + ", fetch log \"" + String(d.fetchLog || "").trim() + "\")");
    check("IOS27-10 dist: ↻ is labelled 'Check for new data'", !d.fatal && d.label === "Check for new data", d.fatal ? "error: " + d.fatal : "aria-label " + JSON.stringify(d.label));
    check("IOS27-10 dist: tapping ↻ asks the server for sw.js (an update check)", !d.fatal && d.swAfterTap > 0, d.fatal ? "error: " + d.fatal : d.swAfterTap + " sw.js request(s) after the tap");
    const fl = sims.map(function (m) { const n = m.importNote || {}; return { k: m.spec.key, note: n.found === true, w: n.total }; });
    const flOk = fl.filter(function (x) { return x.note && x.w > 0 && x.w < 110; }).length;
    check("IOS27-10 SIM: a first launch as an app with no saved state shows 'New here? Import the export from Safari.' and the landing (with the note) stays < 110 words",
      fl.length === 12 && flOk === 12, flOk + "/" + fl.length + " SIM contexts show it under 110 words; " + fl.map(function (x) { return x.k + " " + (x.note ? "note" : "no note") + "/" + x.w + "w"; }).slice(0, 3).join(", ") + (fl.length > 3 ? " …" : ""));
    const tabNote = desc.map(function (m) { return m.importNote ? m.importNote.found === true : null; });
    check("IOS27-10 a Safari-tab first launch does not show the app-only import note", tabNote.length === 12 && tabNote.every(function (x) { return x === false; }), tabNote.filter(function (x) { return x === false; }).length + "/" + tabNote.length + " descriptor contexts without it");
  }

  // ---------------- IOS27-11
  {
    const s = R["announce-stub"] || {}, n = R.announce || {};
    const calls = s.runs && s.runs.length === 2 ? s.runs[1].after.aria : [];
    const firstAfter = s.runs && s.runs[0] ? s.runs[0].after.aria.length : null;
    const regionEmpty = s.runs ? s.runs.every(function (r) { return !r.after.text; }) : false;
    check("IOS27-11 with ariaNotify stubbed: exactly one call per refresh (400 then 200), ≤ 80 chars, made after .refbar is gone, and the status region left empty",
      !s.fatal && firstAfter === 1 && calls.length === 2 && calls.every(function (x) { return x.msg.length <= 80 && x.refbar === false; }) && regionEmpty,
      s.fatal ? "error: " + s.fatal : "calls after refresh 1: " + firstAfter + ", after refresh 2: " + calls.length + " " + JSON.stringify(calls.map(function (x) { return { msg: x.msg.slice(0, 60), refbar: x.refbar }; })) + ", region texts " + JSON.stringify((s.runs || []).map(function (r) { return r.after.text; })));
    const r0 = n.runs && n.runs[0] ? n.runs[0].after : {}, r1 = n.runs && n.runs[1] ? n.runs[1].after : {};
    const errTail = r0.err ? r0.err.replace(/\s+/g, " ").trim() : "";
    const failOk = typeof r0.text === "string" && /^Refresh failed: /.test(r0.text) && r0.text.length <= 80 && errTail.indexOf(r0.text.slice(16, 40)) >= 0;
    const okOk = r1.text === "Refreshed, GW" + n.gw + " data";
    const snapOk = typeof r1.snapshot === "string" && /status/.test(r1.snapshot) && r1.snapshot.indexOf("Refreshed, GW" + n.gw) >= 0;
    check("IOS27-11 without ariaNotify (native in this engine: " + (n.nativeAria || "?") + "; absent for this run: " + (n.engineAria || "?") + "): one persistent [role=status] carries 'Refresh failed: …' then 'Refreshed, GW<n> data', same node, listed by the ariaSnapshot",
      !n.fatal && n.engineAria !== "function" && n.before && n.before.present && failOk && okOk && r0.same && r1.same && snapOk,
      n.fatal ? "error: " + n.fatal : "region before " + JSON.stringify(n.before) + "; after the 400 " + JSON.stringify(r0.text) + " same node " + r0.same + "; after the 200 " + JSON.stringify(r1.text) + " same node " + r1.same + " (want \"Refreshed, GW" + n.gw + " data\"); snapshot lists it " + snapOk);
    const m = R["motion-reduce"] || {};
    const busyRows = [];
    const busyEach = [n, m].map(function (x, i) {
      const st = i === 0 ? (x.runs && x.runs[0] ? x.runs[0].busyStatus : null) : (x.busy ? x.busy.status : null);
      busyRows.push((i === 0 ? "default" : "reduced motion") + ": " + JSON.stringify(String(st || "").slice(0, 70)));
      return !x.fatal && /Refreshing/.test(String(st || ""));
    });
    const busyOk = busyEach.every(Boolean);
    check("IOS27-11 while a refresh is in flight the header status line reads 'Refreshing…', also under Reduce Motion", busyOk, busyRows.join("; "));
    const a0 = n.runs && n.runs[0] ? n.runs[0] : {};
    check("IOS27-10 artifact shell keeps today's refresh: .refbar appears and clears, the 400 surfaces in .err, the landing is unchanged",
      !n.fatal && a0.sawBar === true && a0.cleared === true && !!(a0.after && a0.after.err && /400/.test(a0.after.err)) && a0.after.landingSame === true,
      n.fatal ? "error: " + n.fatal : "refbar seen " + a0.sawBar + ", cleared " + a0.cleared + ", .err " + JSON.stringify(a0.after ? String(a0.after.err || "").slice(0, 70) : null) + ", landing unchanged " + (a0.after && a0.after.landingSame));
  }

  // ---------------- IOS27-12
  {
    const r = R["motion-reduce"] || {}, c0 = R["motion-control"] || {};
    const scaled = /matrix\(0\.97/.test(String((c0.heldActive || {}).transform)) ;
    const cssomScaled = /matrix\(0\.97/.test(String(c0.cssomActive));
    const method = scaled ? "a held pointer (:active " + (c0.heldActive && c0.heldActive.active) + ")" : cssomScaled ? "the CSSOM (:active could not be held here: " + JSON.stringify(c0.heldActive) + ")" : "neither";
    /* The CSSOM route is deterministic: it must show the scale in the control (so it can see one) and
       'none' under Reduce Motion. The held pointer is read too, and wherever :active really held under
       Reduce Motion it must also read 'none'. A held 'none' alone is never taken as proof: this engine
       sometimes reports :active under a held pointer without applying the scale, which would pass a
       page whose Reduce Motion block is missing. */
    const rh = r.heldActive || {};
    const heldOk = !rh.active || rh.transform === "none";
    check("IOS27-12 Reduce Motion: a pressed .btn is not scaled (transform none; matrix(0.97…) without emulation)",
      !r.fatal && !c0.fatal && cssomScaled && r.cssomActive === "none" && heldOk,
      (r.fatal || c0.fatal) ? "error: " + (r.fatal || c0.fatal) : "control " + ((c0.heldActive || {}).transform) + " / CSSOM " + c0.cssomActive + "; reduced motion " + ((r.heldActive || {}).transform) + " / CSSOM " + r.cssomActive + "; measured through " + method + " on " + r.btn);
    check("IOS27-12 Reduce Motion: transitions compute to 0s and there are 0 animations after boot and during a refresh",
      !r.fatal && r.transition === "0s" && r.animsBoot === 0 && r.busy && r.busy.sawBar && r.busy.anims === 0,
      r.fatal ? "error: " + r.fatal : "transition-duration " + r.transition + ", animations after boot " + r.animsBoot + ", during a refresh " + (r.busy && r.busy.anims) + " (refbar " + (r.busy && r.busy.sawBar) + "); control: " + c0.transition + ", " + c0.animsBoot + ", " + (c0.busy && c0.busy.anims));
  }

  // ---------------- IOS27-13
  {
    const cm = R["contrast-more"] || {}, ag = cm.agg || {};
    const mins = [ag.dim && ag.dim.min, ag.mute && ag.mute.min].filter(function (v) { return v !== null && v !== undefined; });
    const mn = mins.length ? Math.min.apply(null, mins) : null;
    check("IOS27-13 Increase Contrast (contrast 'more'): every .dim and --mute text reaches 7:1 on its effective background",
      !cm.fatal && cm.media && cm.media.more && ag.n > 0 && mn !== null && mn >= 7,
      cm.fatal ? "error: " + cm.fatal : ag.n + " texts; --dim " + (ag.tok && ag.tok.dim) + " min " + (ag.dim && ag.dim.min) + " over " + (ag.dim && ag.dim.n) + ", --mute " + (ag.tok && ag.tok.mute) + " min " + (ag.mute && ag.mute.min) + " over " + (ag.mute && ag.mute.n) + "; worst " + (ag.worst || []).slice(0, 2).map(function (w) { return w.cr + " " + w.el + " on " + w.tab; }).join(", "));
    check("IOS27-13 Increase Contrast: --line reaches 3:1 against --bg2",
      !cm.fatal && ag.lineOnBg2 !== null && ag.lineOnBg2 >= 3, cm.fatal ? "error: " + cm.fatal : "--line " + (ag.tok && ag.tok.line) + " on --bg2 " + (ag.tok && ag.tok.bg2) + " = " + ag.lineOnBg2 + ":1");
    const np = R["contrast-nopref"] || {};
    const tk = np.tokens || [];
    const diff = tk.filter(function (t) { return t.declared !== t.computed; });
    check("IOS27-13 contrast 'no-preference': every token value is byte-identical to its .mc-root declaration",
      !np.fatal && tk.length === 21 && diff.length === 0, np.fatal ? "error: " + np.fatal : tk.length + " tokens" + (diff.length ? ", differing: " + diff.map(function (t) { return t.name + " " + t.declared + " → " + t.computed; }).join(", ") : ", all identical"));
    const dc = r17p && r17p.deep ? r17p.deep.contrast : null;
    check("IOS27-13 default gate: every visible text is ≥ 4.5:1 on its effective background (iPhone 17 Pro, every section open)",
      !!dc && dc.n > 0 && dc.min >= 4.5, dc ? dc.n + " texts, min " + dc.min + ":1, disabled excluded " + dc.disabled + ", unparsed " + dc.unparsed + "; worst " + dc.worst.slice(0, 3).map(function (w) { return w.cr + " " + w.fg + " on " + w.bg + " " + w.fs + " " + w.el + " (" + w.tab + ")"; }).join("; ") : "not measured (" + (r17p && r17p.fatal ? r17p.fatal : "context missing") + ")");
    const fc = R["contrast-forced"] || {}, fe = fc.agg ? fc.agg.edges : null;
    check("IOS27-13 forced colours 'active': boots with 0 page errors and every control keeps a border or an outline",
      !fc.fatal && fc.media && fc.media.forced && errOf(fc) === 0 && fe && fe.n > 0 && fe.bad === 0,
      fc.fatal ? "error: " + fc.fatal : "forced-colors matches " + (fc.media && fc.media.forced) + ", page errors " + errOf(fc) + ", " + (fe ? fe.bad + "/" + fe.n + " controls with no edge" + (fe.sample.length ? " (" + fe.sample.join("; ") + ")" : "") : "not measured"));
  }

  // ---------------- IOS27-14
  {
    const s = R.share || {};
    const sh = (s.shared || [])[0];
    const f = sh && sh.files && sh.files.length === 1 ? sh.files[0] : null;
    let parsed = null;
    try { parsed = f ? JSON.parse(f.text) : null; } catch (e) { parsed = null; }
    const cur = s.stateNow && Array.isArray(s.stateNow.squad) ? s.stateNow.squad.map(function (x) { return Number(x.id); }).join(",") : null;
    const got = parsed && Array.isArray(parsed.squad) ? parsed.squad.map(function (x) { return Number(x.id); }).join(",") : null;
    check("IOS27-14 share path: Export hands navigator.share exactly one File mc_state_gw<N>.json, application/json, whose text parses to the current state",
      !s.fatal && (s.shared || []).length === 1 && !!f && /^mc_state_gw\d+\.json$/.test(f.name) && f.type === "application/json" && !!got && got === cur,
      s.fatal ? "error: " + s.fatal : "share calls " + (s.shared || []).length + (f ? ", file " + f.name + " " + f.type + ", squad matches the stored state " + (got === cur) : "") + (s.downloadWhileShareStubbed ? "; a download fired instead: " + s.downloadWhileShareStubbed : ""));
    check("IOS27-14 download path: without share, Export still downloads mc_state_gw<N>.json",
      !s.fatal && s.shareGone === true && /^mc_state_gw\d+\.json$/.test(String(s.download)) && (!f || f.name === s.download),
      s.fatal ? "error: " + s.fatal : "share removed " + s.shareGone + ", download " + JSON.stringify(s.download) + (s.dlErr ? " (" + s.dlErr + ")" : ""));
    check("IOS27-14 file import: <input type=file> with the exported file restores the squad and the Squad tab shows it",
      !s.fatal && s.fileInput === true && s.squadShows === true && s.storedHas === true,
      s.fatal ? "error: " + s.fatal : (s.importSkippedWhy || ("file input " + s.fileInput + (s.marker ? ", marker " + s.marker.name + " #" + s.marker.id : "") + ", Squad tab shows it " + s.squadShows + ", stored " + s.storedHas)));
  }

  // ---------------- IOS27-15
  {
    const d = r17p ? r17p.readout : null, sm = byKey["iphone-17-pro-portrait-dark-sim"], sd = sm ? sm.readout : null;
    const t = d && d.text ? d.text : "";
    /* the expected sizes come from the descriptor the context was built from, never typed (E-084) */
    const dd = env.pw.devices["iPhone 17 Pro"];
    const vw = dd.viewport.width, vh = dd.viewport.height, sw = dd.screen.width, sh = dd.screen.height, dpr = dd.deviceScaleFactor;
    const size = function (a, b) { return new RegExp("\\b" + a + "\\s*[×x]\\s*" + b + "\\b"); };
    /* A readout that lists the three display-mode queries names every mode as a label, so finding the
       word proves nothing. A mode counts as REPORTED when it follows "display-mode" (and is not then
       negated) or is itself followed by a yes/true/on. */
    const says = function (txt, mode) {
      const a = new RegExp("display-mode\\W{0,3}" + mode + "\\b(?!\\W{0,3}(?:false|no|off|✗)\\b)", "i");
      const b = new RegExp("\\b" + mode + "\\W{0,3}(?:true|yes|on|✓|matches)\\b", "i");
      return a.test(txt) || b.test(txt);
    };
    const zeros = (t.match(/\b0px\b/g) || []).length;
    const ok = !!d && d.present && size(vw, vh).test(t) && size(sw, sh).test(t) && new RegExp("(DPR|devicePixelRatio|pixel ratio)\\D{0,8}" + dpr + "\\b", "i").test(t) && zeros >= 4 && says(t, "browser") && !says(t, "standalone");
    check("IOS27-15 the Lab device readout lists " + vw + "×" + vh + ", screen " + sw + "×" + sh + ", DPR " + dpr + ", insets 0px and display-mode browser (iPhone 17 Pro)",
      ok, d ? (d.present ? "readout: " + JSON.stringify(t.slice(0, 200)) + "; reports browser " + says(t, "browser") + ", reports standalone " + says(t, "standalone") : "no [data-section=lab-device] in " + d.labId) + (d.err ? " (" + d.err + ")" : "") : "not measured");
    const st = sd && sd.text ? sd.text : "";
    check("IOS27-15 SIM: under the standalone shim the readout reports display-mode standalone (and not browser)",
      !!sd && sd.present && says(st, "standalone") && !says(st, "browser"), sd ? (sd.present ? "readout: " + JSON.stringify(st.slice(0, 160)) + "; reports standalone " + says(st, "standalone") + ", reports browser " + says(st, "browser") : "no [data-section=lab-device]") : "not measured");
  }

  // ---------------- IOS27-16
  {
    const ch = R.chromium || {};
    const wk = r17p;
    const bad = [], rows = [];
    if (!ch.fatal && wk && wk.tabRuns) {
      rows.push("landing " + (wk.landing && wk.landing.words) + "/" + ch.landing);
      if (!wk.landing || wk.landing.words !== ch.landing) bad.push("landing WebKit " + (wk.landing && wk.landing.words) + " vs Chromium " + ch.landing);
      wk.tabRuns.forEach(function (r) { rows.push(r.id + " " + r.words.words + "/" + (ch.tabs || {})[r.id]); if (r.words.words !== (ch.tabs || {})[r.id]) bad.push(r.id + " WebKit " + r.words.words + " vs Chromium " + (ch.tabs || {})[r.id]); });
    }
    check("IOS27-16 parity: the text-node counter gives equal counts in WebKit and Chromium for the landing and every tab (iPhone 17 Pro viewport)",
      !ch.fatal && !!wk && !!wk.tabRuns && bad.length === 0 && Object.keys(ch.tabs || {}).length === wk.tabRuns.length,
      ch.fatal ? "Chromium could not run: " + ch.fatal : (bad.length ? bad.join("; ") + " · " : "") + "WebKit/Chromium " + rows.join(", ") + " (Chromium " + ch.version + ")");
    const fx = wk ? wk.fixture : null;
    check("IOS27-16 stability: a 200-option select moves the counter by its selected option only",
      !!fx && fx.after - fx.before === 1, fx ? "counter " + fx.before + " → " + fx.after + " (+" + (fx.after - fx.before) + "); innerText " + fx.innerBefore + " → " + fx.innerAfter + " (+" + (fx.innerAfter - fx.innerBefore) + " in this WebKit)" : "not measured");
  }

  // ---------------- IOS27-17
  {
    const s = R.slow || {};
    /* E-134: the plan typed "within 4 s". A controlled reload that only opens the cached shell already takes 3.47 s to boot in
       this sandbox (3 MB of script, measured), so a 3 s race plus that boot cannot fit 4 s whatever the worker does. The property
       is that the page opens from the cached shell after the race, without waiting for the network: it mounts no earlier than
       the race (the network was still held), no later than the race plus the measured controlled-reload boot plus 1 s, and
       before the held response is released. The race is read out of dist/sw.js, and the boot is measured in this run, twice
       before the held reload and twice after it, the largest reading used: the pool runs three WebKit contexts at once and
       the same reload took 1.3 s alone and up to 2.9 s beside them, so one reading taken at another moment is not the
       boot the held reload had. */
    const rmm = (readText(path.join(DIST, "sw.js")) || "").match(/var\s+RACE_MS\s*=\s*(\d+)/);
    const raceMs = rmm ? Number(rmm[1]) : null;
    const boots = [s.promptMs, s.promptMs2, s.promptAfterMs, s.promptAfterMs2].filter(function (x) { return typeof x === "number"; });
    const bootMs = boots.length ? Math.max.apply(null, boots) : null;
    const limit = raceMs !== null && bootMs !== null ? raceMs + bootMs + 1000 : null;
    check("IOS27-17 slow network: with the page controlled and index.html held 10 s, .mc-root mounts from the cached shell after the race and before the held response is released, within race + controlled-reload boot + 1 s",
      !s.fatal && s.controlled === true && s.mountMs !== null && raceMs !== null && limit !== null && s.heldAt !== null && s.heldAt !== undefined &&
        s.mountMs >= raceMs && s.mountMs <= limit && s.mountMs < s.heldAt,
      s.fatal ? "error: " + s.fatal : "controlled " + s.controlled + " · race " + (raceMs === null ? "not found in dist/sw.js" : sec(raceMs)) + " · controlled-reload boot " + (bootMs === null ? "?" : sec(bootMs)) + " (readings " + boots.map(sec).join(", ") + ": two before the held reload, two after; the larger used) · limit race + boot + 1 s = " + (limit === null ? "?" : sec(limit)) +
        " · mounted at " + (s.mountMs === null ? "not within 13 s" : sec(s.mountMs)) + " · held response released at " + (s.heldAt === null || s.heldAt === undefined ? "?" : sec(s.heldAt)));
    check("IOS27-17 slow network: once the server answers, caches.match('./index.html') holds the new body",
      !s.fatal && s.cacheNew === true, s.fatal ? "error: " + s.fatal : "cache holds the held copy: " + s.cacheNew);
    check("IOS27-17 prompt network: the network copy is served", !s.fatal && s.prompt === true, s.fatal ? "error: " + s.fatal : "new build on the page " + s.prompt);
  }

  // ---------------- IOS27-01 the rest of the PWA block and the extra passes
  console.log("");
  {
    const a = R.anchor || {};
    const inserted = a.above1 !== undefined && a.above0 !== undefined ? a.above1 - a.above0 : null;
    check("IOS27-01 scroll anchoring (engine behaviour, not Safari 27 proof): inserting .refbar above the reading position at scroll 1200 keeps the content in view where it was, and scrollY moves by exactly the height inserted above",
      !a.fatal && !a.noBar && a.h !== null && a.top0 !== null && Math.abs(a.top1 - a.top0) <= 0.5 && inserted !== null && inserted >= a.h - 0.5 && Math.abs((a.y1 - a.y0) - inserted) <= 0.5,
      a.fatal ? "error: " + a.fatal : "scrollY " + a.y0 + " → " + a.y1 + " (delta " + f2(a.y1 - a.y0) + "); height inserted above the content " + f2(inserted) + " (the .refbar " + a.h + "px" + (inserted !== null && Math.abs(inserted - a.h) > 0.5 ? " plus " + f2(inserted - a.h) + "px of header growth" : "") + "); " + a.anchor + " top " + a.top0 + " → " + a.top1 + "; scrollY " + a.y2 + " after it cleared");
    const ex = [["reduced motion", R["motion-reduce"]], ["contrast more", R["contrast-more"]], ["forced colours", R["contrast-forced"]]];
    check("IOS27-01 the extra passes on iPhone 17 Pro (reducedMotion reduce, contrast more, forcedColors active) boot with 0 page errors",
      ex.every(function (x) { return x[1] && !x[1].fatal && errOf(x[1]) === 0; }), ex.map(function (x) { return x[0] + " " + (x[1] ? (x[1].fatal ? "error " + x[1].fatal : errOf(x[1]) + " errors") : "not run"); }).join(", "));
    const others = Object.keys(R).filter(function (k) { return k.indexOf("ctx:") !== 0; });
    const errs = [];
    others.forEach(function (k) { const x = R[k]; (x.errors || []).concat(x.errors2 || []).forEach(function (e) { errs.push(e); }); });
    check("IOS27-01 zero uncaught page errors and console errors across every other context of the run",
      errs.length === 0, errs.length ? errs.slice(0, 4).join(" | ") + (errs.length > 4 ? " (+" + (errs.length - 4) + ")" : "") : others.length + " task contexts clean (resource-load console noise from the mocked refresh is ignored, as in qa/webkit.js)");
  }
}

// ---------------------------------------------------------------- device checklist

function deviceChecklist() {
  console.log("");
  console.log("DEVICE-ONLY CHECKLIST (not counted; the sandbox cannot run these — on the manager's iPhone):");
  [
    "IOS27-01 Safari tab in the Compact, Bottom and Top tab-bar layouts: header, tabs and landing read correctly",
    "IOS27-01 the Home Screen app: Share, Add to Home Screen, turn on Open as Web App, Add; then open it",
    "IOS27-01 light and dark system appearance, and the iOS 27 top-inset colour at the scroll origin",
    "IOS27-01 the Home Screen icon in the Tinted and Clear appearances",
    "IOS27-01 VoiceOver, Increase Contrast and Larger Text (Dynamic Type) on the landing and every tab",
    "IOS27-02 in the Home Screen app, portrait and landscape, the header clears the Dynamic Island and the status bar",
    "IOS27-03 tapping the draft-league field and the import box does not zoom the page",
    "IOS27-04 in the Claude iOS app: open the artifact, change tab, close and reopen (the tab is kept, or the not-saving note shows)",
    "IOS27-05 in a Safari tab, the Lab last-export line after more than 7 days without an export",
    "IOS27-06 add to the Home Screen from the Pages URL, open it, switch on airplane mode, reopen; CI-only: the post-deploy curl of index.html, sw.js and manifest.webmanifest, and served CACHE == committed CACHE",
    "IOS27-07 after a deploy the Home Screen app offers 'New build ready' on resume; cache revalidation under the real host's max-age if the SKIP above fired",
    "IOS27-10 which display-mode query matches in the Home Screen app (standalone or fullscreen), read from the Lab readout",
    "IOS27-11 VoiceOver on iOS 27 speaks each refresh outcome once",
    "IOS27-13 Settings → Accessibility → Display & Text Size → Increase Contrast: dim text and lines visibly stronger",
    "IOS27-14 Share → Save to Files; import from Files in the Home Screen app; inside the Claude iOS app the download fallback fires",
    "IOS27-15 screenshot the Lab device readout in a Safari tab and from the Home Screen: its insets replace SIM_INSETS here and pick the profile (iPhone 18 Pro or Duo have no descriptor)",
    "IOS27-17 open the Home Screen app on a weak signal: the shell appears within about 4 s",
    "Optional Mac leg: the Safari MCP server (macOS Safari 27, safaridriver --mcp) at iPhone widths — a desktop check, never iPhone acceptance"
  ].forEach(function (s) { console.log("  [ ] " + s); });
}

// ---------------------------------------------------------------- main

async function main() {
  const distHtml = readText(path.join(DIST, "index.html"));
  const swText = readText(path.join(DIST, "sw.js"));
  if (!distHtml) {
    console.log("iOS WebKit acceptance NOT run — dist/index.html is missing");
    check("IOS27-01 dist/index.html exists", false, "dist/index.html is missing; this suite never builds (run the build first)");
    return finish();
  }
  let pw, browser;
  try {
    pw = require("playwright");
    browser = await pw.webkit.launch({ headless: true });
  } catch (e) {
    console.log("iOS WebKit acceptance NOT run — " + short(e));
    check("IOS27-01 WebKit launches from the preinstalled build (never an installer)", false, short(e));
    return finish();
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  const distHash0 = sha(Buffer.from(distHtml));
  let pwVersion = "?";
  try { pwVersion = require("playwright/package.json").version; } catch (e) { /* noop */ }
  let buildDate = null;
  try {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
    const wk = fs.readdirSync(base).filter(function (d) { return /^webkit-\d+$/.test(d); })[0];
    const txt = wk ? readText(path.join(base, wk, "minibrowser-wpe", "README.txt")) : null;
    const mm = txt ? txt.match(/Builder date:\s*(\S+)/) : null;
    buildDate = mm ? wk + " built " + mm[1] : null;
  } catch (e) { buildDate = null; }

  info("qa/ios.cjs — iPhone acceptance (iOS 27 plan IOS27-01..17) on " + new Date().toISOString());
  info("browser.version() " + browser.version() + "; Playwright " + pwVersion + (buildDate ? "; " + buildDate : ""));
  info("descriptor UA (for the record only, never used to decide anything): " + pw.devices["iPhone 17"].userAgent);
  info("WebKit main (Playwright " + pwVersion + ", labelled " + browser.version() + "), not Safari 27.0 — a green line here is not Safari 27 proof");
  info("serving " + (DIST_ARG ? DIST + " (not the committed dist/)" : "the committed dist/") + "; static src/ scan over " + (process.env.IOS_SRC ? SRC + " (not the committed src/)" : "the committed src/"));
  info("dist/index.html " + distHtml.length + " chars, sha256 " + distHash0.slice(0, 16) + "…; sw.js CACHE " + (swFacts(swText).cache || "?") + "; clock pinned to " + (NOW || "(not pinned: data/live.json unreadable)") + "; " + JOBS + " parallel jobs");

  const main = await makeServer("main").start();
  info("loopback server " + main.origin + " (dist/ at / and at " + SUB + ", read at request time)");
  const env = { pw: pw, browser: browser, main: main, distHtml: distHtml, swText: swText };

  const specs = matrixSpecs();
  const tasks = [];
  // long waits first, so they overlap the matrix
  tasks.push({ name: "slow", run: function () { return taskSlow(env); } });
  tasks.push({ name: "update", run: function () { return taskUpdate(env); } });
  tasks.push({ name: "pwa", run: function () { return taskPwaLifecycle(env); } });
  specs.filter(function (s) { return s.deep; }).forEach(function (s) { tasks.push({ name: "ctx:" + s.key, spec: s, run: function () { return runMatrix(env, s); } }); });
  tasks.push({ name: "revalidate", run: function () { return taskRevalidate(env); } });
  tasks.push({ name: "dist-refresh", run: function () { return taskDistRefresh(env); } });
  tasks.push({ name: "announce-stub", run: function () { return taskAnnounce(env, true); } });
  tasks.push({ name: "announce", run: function () { return taskAnnounce(env, false); } });
  tasks.push({ name: "contrast-more", run: function () { return taskContrast(env, "more"); } });
  tasks.push({ name: "contrast-forced", run: function () { return taskContrast(env, "forced"); } });
  specs.filter(function (s) { return !s.deep; }).forEach(function (s) { tasks.push({ name: "ctx:" + s.key, spec: s, run: function () { return runMatrix(env, s); } }); });
  tasks.push({ name: "contrast-nopref", run: function () { return taskContrast(env, "nopref"); } });
  tasks.push({ name: "motion-reduce", run: function () { return taskMotion(env, true); } });
  tasks.push({ name: "motion-control", run: function () { return taskMotion(env, false); } });
  tasks.push({ name: "shell-a", run: function () { return taskShellA(env); } });
  tasks.push({ name: "shell-b", run: function () { return taskShellB(env); } });
  tasks.push({ name: "shell-c", run: function () { return taskShellC(env); } });
  tasks.push({ name: "shim", run: function () { return taskShim(env); } });
  tasks.push({ name: "share", run: function () { return taskShare(env); } });
  tasks.push({ name: "anchor", run: function () { return taskAnchor(env); } });
  tasks.push({ name: "chromium", run: function () { return taskChromium(env); } });

  info("measuring: " + tasks.length + " tasks (" + specs.length + " matrix contexts + " + (tasks.length - specs.length) + " scenario tasks)");
  const tM = Date.now();
  let R = {};
  try { R = await runPool(tasks, JOBS); }
  finally {
    await main.close();
    await browser.close().catch(function () {});
  }
  const M = specs.map(function (s) { const r = R["ctx:" + s.key] || { fatal: "never ran" }; r.spec = s; r.errors = r.errors || []; r.t = r.t || {}; r.viewport = r.viewport || { width: 0, height: 0 }; return r; });
  info("measured in " + sec(Date.now() - tM));

  if (process.env.IOS_DUMP) { try { fs.writeFileSync(path.resolve(process.env.IOS_DUMP), JSON.stringify({ R: R, M: M }, null, 1)); info("raw measurements written to " + process.env.IOS_DUMP); } catch (e) { info("IOS_DUMP failed: " + short(e)); } }
  judge(env, R, M);

  const distHash1 = sha(Buffer.from(readText(path.join(DIST, "index.html")) || ""));
  if (distHash1 !== distHash0) info("WARNING: dist/index.html changed while the suite ran (" + distHash0.slice(0, 12) + " → " + distHash1.slice(0, 12) + "); rerun for a clean reading");
  deviceChecklist();
  console.log("");
  info("skipped (uncounted): " + (skipped.length ? skipped.join("; ") : "none"));
  info("total " + sec(Date.now() - T_START) + " (" + JOBS + " jobs)");
  return finish();
}

main().catch(function (e) {
  console.log("iOS WebKit acceptance did not complete — " + short(e));
  check("IOS27-01 the suite ran to completion", false, short(e));
  finish();
});

#!/usr/bin/env node
/* build.cjs — assembles the single file and the standalone page (CONTRACT §2).
 *
 *   app/FPL_Mission_Control.jsx  imports · APP_VERSION · engine · mc engine · weekly · live · mc data · plan ·
 *                                precomputed · ui · mc ui (CONTRACT §2, sixteen markers since v110 D0)
 *   data/pre.json                pipeline/precompute.cjs, run first: the heavy searches, once per build; rewritten
 *                                only when its content changes, so the build still reproduces the tree byte for byte
 *   dist/index.html              esbuild IIFE bundle of that file, inlined, with a
 *                                window.storage shim over localStorage.
 *   dist/manifest.webmanifest    installable-app metadata; its colours ARE the --bg token
 *   dist/sw.js                   service worker, cache name carrying this build's hash
 *   dist/icon.svg + PNG icon set the icons, drawn here from the colour tokens (no deps), at
 *                                every size a 2026 install asks for, each one parsed back before
 *                                it is written
 *
 * Marker text is exact and each marker appears once, in order; verify.sh asserts it.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");
const zlib = require("zlib");
const crypto = require("crypto");

const ROOT = __dirname;
const P = function (...parts) { return path.join(ROOT, ...parts); };
const read = function (rel) { return fs.readFileSync(P(rel), "utf8"); };

const pkg = JSON.parse(read("package.json"));
const APP_VERSION = "v" + String(pkg.version).split(".")[0];

/* The markers, in the order they are written (CONTRACT §2). verify.sh I5 reads its own list out of CONTRACT.md, so
   this one and that one are held against each other rather than one copied from the other. */
const M = {
  engineStart: "// ENGINE — START",
  engineEnd: "// ENGINE — END",
  mcEngineStart: "// MC ENGINE — START",
  mcEngineEnd: "// MC ENGINE — END",
  weeklyStart: "// WEEKLY STRATEGY ENGINE — START",
  weeklyEnd: "// WEEKLY STRATEGY ENGINE — END",
  liveStart: "// LIVE DATA — START",
  liveEnd: "// LIVE DATA — END",
  mcDataStart: "// MC DATA — START",
  mcDataEnd: "// MC DATA — END",
  planStart: "// PLAN — START",
  planEnd: "// PLAN — END",
  preStart: "// PRECOMPUTED — START",
  preEnd: "// PRECOMPUTED — END",
  mcUiStart: "// MC UI — START",
  mcUiEnd: "// MC UI — END"
};

/* src/mc_engine.js is UMD: `module.exports = factory()` when a CommonJS `module` is in scope, `root.MCEngine`
   otherwise. The assembled file is an ES module, and qa/components.cjs and qa/mc_full.cjs evaluate it under Node
   with their own `module` object in scope — a bare UMD would assign the engine over that object. So the module runs
   inside a function with a `module` of its own, and its export becomes the one binding the app reads, MCEngine.
   Two exact lines; the source between them is byte for byte, and verify.sh I8 compares it. */
const MC_WRAP = {
  head: "const MCEngine = (function () { const module = { exports: {} }; const exports = module.exports;",
  tail: "return module.exports; })();"
};

/* The import lines have to stay at the top of an ES module, so they are lifted off
   src/ui.jsx and everything else follows the data blocks. Collection stops at the first
   statement that is not an import, which is why an import written further down the file
   would be dropped silently: the body is scanned afterwards and a late import throws with
   its line number instead. (The old code also tested for an import inside the branch that
   had already established the line was blank or a comment, which could never be true.) */
function splitImports(src) {
  const lines = src.split("\n");
  const imports = [];
  let i = 0;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "" || t.startsWith("//")) continue;
    if (t.startsWith("import ")) { imports.push(lines[i]); continue; }
    break;
  }
  const rest = lines.slice(i);
  for (let k = 0; k < rest.length; k++) {
    if (rest[k].trim().startsWith("import ")) {
      throw new Error("src/ui.jsx line " + (i + k + 1) + " is an import after the first statement: " +
        rest[k].trim().slice(0, 80) + " — move it to the top of the file; the assembler would otherwise drop it");
    }
  }
  return { imports: imports, rest: rest.join("\n") };
}

function jsLiteral(obj) {
  return JSON.stringify(obj).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/* src/mc_ui.jsx is appended after the ui body, inside the same ES module, so it may not import or export: an import
   after the first statement breaks the module and a second export collides with App's. */
function mcUiSource() {
  const src = read("src/mc_ui.jsx").trim();
  src.split("\n").forEach(function (line, i) {
    const t = line.trim();
    if (/^(import|export)\s/.test(t)) {
      throw new Error("src/mc_ui.jsx line " + (i + 1) + " is an " + t.split(/\s/)[0] + " statement: " + t.slice(0, 80) +
        " — it is appended inside src/ui.jsx's module, so it uses that module's scope and exports nothing");
    }
  });
  return src;
}

function assemble() {
  const ui = splitImports(read("src/ui.jsx"));
  const engine = read("src/engine.js").trim();
  const mcEngine = read("src/mc_engine.js").trim();
  const weekly = read("data/weekly.js").trim();
  const live = JSON.parse(read("data/live.json"));
  const mcData = JSON.parse(read("data/mc_data.json"));
  const plan = JSON.parse(read("data/plan.json"));
  const pre = JSON.parse(read("data/pre.json"));
  const mcUi = mcUiSource();

  const out = [
    "/* FPL Mission Control " + APP_VERSION + " — assembled by build.cjs; edit src/ui.jsx, src/engine.js,",
    "   data/weekly.js or data/live.json and run `npm run build`. Do not edit this file. */",
    ui.imports.join("\n"),
    "",
    "const APP_VERSION = \"" + APP_VERSION + "\";",
    "",
    M.engineStart,
    engine,
    M.engineEnd,
    "",
    M.mcEngineStart,
    MC_WRAP.head,
    mcEngine,
    MC_WRAP.tail,
    M.mcEngineEnd,
    "",
    M.weeklyStart,
    weekly,
    M.weeklyEnd,
    "",
    M.liveStart,
    "const LIVE = " + jsLiteral(live) + ";",
    M.liveEnd,
    "",
    M.mcDataStart,
    "const MC = " + jsLiteral(mcData) + ";",
    M.mcDataEnd,
    "",
    M.planStart,
    "const PLAN = " + jsLiteral(plan) + ";",
    M.planEnd,
    "",
    M.preStart,
    "const PRE = " + jsLiteral(pre) + ";",
    M.preEnd,
    "",
    ui.rest.trim(),
    "",
    M.mcUiStart,
    mcUi,
    M.mcUiEnd,
    ""
  ].join("\n");

  const order = Object.keys(M).map(function (k) { return { key: k, text: M[k], at: out.indexOf(M[k]) }; });
  order.forEach(function (m) {
    const n = out.split(m.text).length - 1;
    if (n !== 1) throw new Error("marker " + m.text + " appears " + n + " times, expected 1");
  });
  for (let i = 1; i < order.length; i++) {
    if (order[i].at < order[i - 1].at) throw new Error("marker out of order: " + order[i].text);
  }
  /* The banned fields must not reach any data block or be read anywhere: the only
     permitted mention is the engine header comment that names them as banned. */
  [["live data", M.liveStart, M.liveEnd], ["mc data", M.mcDataStart, M.mcDataEnd], ["plan", M.planStart, M.planEnd],
    ["precomputed", M.preStart, M.preEnd]].forEach(function (b) {
    if (/ep_this|ep_next/.test(out.slice(out.indexOf(b[1]), out.indexOf(b[2])))) throw new Error("banned field ep_this/ep_next is in the " + b[0] + " block");
  });
  const reads = out.match(/\.ep_(this|next)\b|\[\s*["']ep_(this|next)/g);
  if (reads) throw new Error("banned field read in code: " + reads.join(", "));

  fs.mkdirSync(P("app"), { recursive: true });
  fs.writeFileSync(P("app/FPL_Mission_Control.jsx"), out);
  return out;
}

function bundle() {
  const entry = [
    "import React from \"react\";",
    "import { createRoot } from \"react-dom/client\";",
    "import App from \"./app/FPL_Mission_Control.jsx\";",
    "const el = document.getElementById(\"root\");",
    "createRoot(el).render(React.createElement(App));"
  ].join("\n");
  const res = esbuild.buildSync({
    stdin: { contents: entry, resolveDir: ROOT, sourcefile: "entry.jsx", loader: "jsx" },
    bundle: true,
    format: "iife",
    jsx: "automatic",
    loader: { ".jsx": "jsx" },
    minifySyntax: true,
    legalComments: "none",
    define: { "process.env.NODE_ENV": "\"production\"" },
    logLevel: "error",
    write: false
  });
  return res.outputFiles[0].text;
}

/* ------------------------------------------------------------------ PWA (v89)
 *
 * dist/ is also a progressive web app: a manifest, an icon set and a service worker that
 * precaches the shell. All three are GENERATED here rather than written by hand, for one
 * reason — the manifest's theme and background colours are the app's own `--bg` token, read
 * out of src/ui.jsx at build time, so a second hand-written copy of a colour cannot drift
 * from the tokens (the same argument the shell's <style> block already makes above).
 *
 * The single-file mode is a hard constraint: dist/index.html is opened from a file:// URL
 * today, and a service worker cannot be registered from one — the call rejects, and on some
 * engines throws a SecurityError synchronously. So the registration sits behind a protocol
 * guard and records what it decided on `window.__PWA__` for the suites to read. Nothing else
 * about the page changes: same shim, same bundle, same single <style> block.
 *
 * No dependency is added. zlib and crypto are in node, and the icons are flat colour, so
 * build.cjs writes the PNGs itself.
 */

/* One snapshot of src/ui.jsx per build. The tokens are read at build time on purpose — they
   are the UI's own, and a second hand-written copy of a colour is the drift this generator
   exists to prevent — but they are read ONCE, so eleven icons cannot be rastered from two
   different revisions of the file if it changes underneath a running build. */
var _uiSrc = null;
function uiSource() {
  if (_uiSrc === null) _uiSrc = read("src/ui.jsx");
  return _uiSrc;
}

function tokenColour(name) {
  const src = uiSource();
  const m = src.match(new RegExp("--" + name + "\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;"));
  if (!m) {
    throw new Error("build: the --" + name + " colour token is not defined in src/ui.jsx — the manifest, " +
      "the theme-color meta and the icons are all taken from the tokens so they cannot drift from the UI");
  }
  return m[1].toLowerCase();
}

function rgbOf(hex) {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/* ---- PNG writer (signature + IHDR + IDAT + IEND, filter 0, 8-bit RGBA) ---- */

const CRC_TABLE = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;                                   // filter type 0 (none)
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;                                             // bit depth
  ihdr[9] = 6;                                             // colour type 6 = RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

/* ---- PNG reader: every file this build emits is parsed back before it is written ----

   A PNG that node's zlib wrote is not automatically a PNG a browser accepts, and the failure
   mode is the worst kind: the manifest names the file, every existence check passes, and the
   installed app shows a blank tile. So the bytes are decoded again here — signature, every
   chunk's CRC recomputed, IHDR read back field by field, the IDAT stream inflated and the
   scanline filter bytes checked — and the build throws rather than write a file it cannot
   read. `size` is what the caller asked for, so a size that disagrees with the IHDR (which is
   what the manifest's `sizes` is written from) cannot ship either. */

function verifyPng(buf, size, name) {
  const fail = function (why) {
    throw new Error("build: " + name + " is not a PNG a browser will accept \u2014 " + why);
  };
  if (!buf || typeof buf.length !== "number") fail("the build produced no bytes for it at all");
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 8) fail("the file is " + buf.length + " bytes, shorter than the signature");
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIG[i]) fail("signature byte " + i + " is 0x" + buf[i].toString(16) + ", expected 0x" + SIG[i].toString(16));
  }
  let p = 8;
  const order = [];
  const idat = [];
  let ihdr = null;
  while (p < buf.length) {
    if (p + 12 > buf.length) fail("a chunk header at byte " + p + " runs past the end of the file");
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    if (p + 12 + len > buf.length) fail("chunk " + type + " declares " + len + " bytes of data and only " + (buf.length - p - 12) + " remain");
    const body = buf.slice(p + 4, p + 8 + len);                 // type + data, exactly what the CRC covers
    const want = buf.readUInt32BE(p + 8 + len);
    const got = crc32(body);
    if (got !== want) fail("chunk " + type + " at byte " + p + " carries CRC 0x" + want.toString(16) + " and its bytes hash to 0x" + got.toString(16));
    order.push(type);
    if (type === "IHDR") ihdr = buf.slice(p + 8, p + 8 + len);
    if (type === "IDAT") idat.push(buf.slice(p + 8, p + 8 + len));
    p += 12 + len;
  }
  if (order[0] !== "IHDR") fail("the first chunk is " + order[0] + ", not IHDR");
  if (order[order.length - 1] !== "IEND") fail("the last chunk is " + order[order.length - 1] + ", not IEND");
  if (!ihdr || ihdr.length !== 13) fail("IHDR carries " + (ihdr ? ihdr.length : 0) + " bytes, not 13");
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  if (w !== size || h !== size) fail("IHDR says " + w + "x" + h + " and the build asked for " + size + "x" + size);
  if (ihdr[8] !== 8) fail("bit depth " + ihdr[8] + ", not 8");
  if (ihdr[9] !== 6) fail("colour type " + ihdr[9] + ", not 6 (truecolour with alpha)");
  if (ihdr[10] !== 0) fail("compression method " + ihdr[10] + ", not 0 (deflate)");
  if (ihdr[11] !== 0) fail("filter method " + ihdr[11] + ", not 0");
  if (ihdr[12] !== 0) fail("interlace method " + ihdr[12] + " \u2014 this writer emits no Adam7 passes");
  if (!idat.length) fail("there is no IDAT chunk");
  let raw = null;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); }
  catch (e) { fail("the IDAT stream does not inflate: " + (e && e.message ? e.message : e)); }
  const stride = w * 4 + 1;
  if (raw.length !== stride * h) fail("the inflated image is " + raw.length + " bytes and " + w + "x" + h + " RGBA with one filter byte a row is " + (stride * h));
  for (let y = 0; y < h; y++) {
    if (raw[y * stride] !== 0) fail("scanline " + y + " declares filter type " + raw[y * stride] + ", not 0 (none)");
  }
  return { name: name, bytes: buf.length, w: w, h: h, depth: ihdr[8], colour: ihdr[9], chunks: order.join("+"), raw: raw.length };
}

/* ---- the mark: one geometry in a unit square, used for the PNGs and the SVG alike, so the
        raster icons and the vector icon cannot disagree. Three ascending bars on a baseline
        and the dot that marks the call. `scale` shrinks the content about the centre for the
        maskable variant, whose safe zone is the middle 80%.

        `tileR` is the tile's corner radius, and the PNGs pass 0 on purpose. A rounded tile
        leaves the corner pixels transparent, and every platform that consumes these files
        applies its own mask: iOS rounds the apple-touch icon itself and composites what is
        underneath through the transparent corners, and a maskable icon is cropped to a circle
        or a squircle. So the raster icons are full-bleed opaque squares and only the SVG —
        which is the browser-tab icon, drawn as it is — keeps the radius. ---- */

function iconShapes(scale, tileR) {
  const s = typeof scale === "number" ? scale : 1;
  const tr = typeof tileR === "number" ? tileR : 0.22;
  const at = function (v) { return 0.5 + (v - 0.5) * s; };
  const bar = function (x, top) {
    return { kind: "rect", x0: at(x), x1: at(x + 0.13), y0: at(top), y1: at(0.77), r: 0.022 * s, fill: "grn" };
  };
  return [
    { kind: "rect", x0: 0, x1: 1, y0: 0, y1: 1, r: tr, fill: "bg2" },
    { kind: "rect", x0: at(0.20), x1: at(0.80), y0: at(0.785), y1: at(0.805), r: 0.010 * s, fill: "line" },
    bar(0.230, 0.500),
    bar(0.435, 0.380),
    bar(0.640, 0.255),
    { kind: "disc", cx: at(0.705), cy: at(0.175), r: 0.058 * s, fill: "grn" }
  ];
}

function inShape(sh, x, y) {
  if (sh.kind === "disc") {
    const dx = x - sh.cx, dy = y - sh.cy;
    return dx * dx + dy * dy <= sh.r * sh.r;
  }
  if (x < sh.x0 || x > sh.x1 || y < sh.y0 || y > sh.y1) return false;
  const r = Math.min(sh.r, (sh.x1 - sh.x0) / 2, (sh.y1 - sh.y0) / 2);
  if (r <= 0) return true;
  const cx = x < sh.x0 + r ? sh.x0 + r : (x > sh.x1 - r ? sh.x1 - r : x);
  const cy = y < sh.y0 + r ? sh.y0 + r : (y > sh.y1 - r ? sh.y1 - r : y);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function topShape(shapes, x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) if (inShape(shapes[i], x, y)) return i;
  return -1;
}

/* A maskable icon is cropped by the platform to a circle, a squircle or a rounded square, and
   only the middle 80% of the canvas — a circle of radius 0.40 from the centre — is guaranteed
   to survive. `at()` scales the content about that exact centre, so the farthest point of the
   content is linear in the scale: the largest scale that fits is arithmetic, not a guess, and
   the scale is derived from it below rather than typed in. MASK_FILL is how much of the safe
   radius the mark is allowed to occupy; the remainder is margin the spec does not require and
   a launcher's own padding is glad of. 0.72 shipped before this, which put the mark at 79.6%
   of the safe radius and left 41.8 px of the 204.8 unused at 512 — not clipped, over-shrunk. */
const MASK_SAFE_R = 0.40;
const MASK_FILL = 0.95;

/* The farthest point of a shape from (cx, cy). A rounded rectangle is the convex hull of its
   four corner discs, and the farthest point of a hull of discs from an outside point is the
   farthest of those discs, so this is exact rather than sampled. */
function shapeMaxRadius(sh, cx, cy) {
  if (sh.kind === "disc") return Math.sqrt((sh.cx - cx) * (sh.cx - cx) + (sh.cy - cy) * (sh.cy - cy)) + sh.r;
  const r = Math.min(sh.r, (sh.x1 - sh.x0) / 2, (sh.y1 - sh.y0) / 2);
  const corners = [[sh.x0 + r, sh.y0 + r], [sh.x1 - r, sh.y0 + r], [sh.x0 + r, sh.y1 - r], [sh.x1 - r, sh.y1 - r]];
  let best = 0;
  for (let i = 0; i < corners.length; i++) {
    const dx = corners[i][0] - cx, dy = corners[i][1] - cy;
    const d = Math.sqrt(dx * dx + dy * dy) + r;
    if (d > best) best = d;
  }
  return best;
}

/* shapes[0] is the tile, which is meant to run to the edge and is not content. */
function contentRadius(scale) {
  const shapes = iconShapes(scale, 0).slice(1);
  let worst = 0;
  for (let i = 0; i < shapes.length; i++) {
    const r = shapeMaxRadius(shapes[i], 0.5, 0.5);
    if (r > worst) worst = r;
  }
  return worst;
}

function maskableScale() {
  const worst1 = contentRadius(1);
  const scale = (MASK_SAFE_R * MASK_FILL) / worst1;
  const worst = contentRadius(scale);
  if (!(worst <= MASK_SAFE_R)) {
    throw new Error("build: the maskable mark reaches " + worst.toFixed(5) + "u from the centre at scale " +
      scale.toFixed(4) + ", past the " + MASK_SAFE_R + "u safe radius (" + (worst / MASK_SAFE_R * 100).toFixed(1) +
      "% of it) \u2014 a launcher would crop the mark. Lower MASK_FILL.");
  }
  return { scale: scale, worst: worst, worst1: worst1, pct: worst / MASK_SAFE_R * 100, limit: MASK_SAFE_R / worst1 };
}

/* Is the pixel square [x0,x1]x[y0,y1] clear of this shape's outline? Returns 1 for wholly
   inside, 0 for wholly outside and -1 for "the outline crosses it, sample this pixel".

   Both answers are proved, not sampled. Every shape here is convex (a disc, or a rounded
   rectangle, which is the hull of four discs), so four corners inside a convex set means the
   whole square is inside it. "Outside" needs the bounding box as well, and that is the half
   that matters: a feature thinner than a pixel — the baseline is 0.020u, which is 0.64 px at
   32 — can pass clean between four corners that all read "outside", and a four-corner test
   alone would then drop it and fill the pixel flat. */
function pixelVsShape(sh, x0, y0, x1, y1) {
  let bx0, bx1, by0, by1;
  if (sh.kind === "disc") { bx0 = sh.cx - sh.r; bx1 = sh.cx + sh.r; by0 = sh.cy - sh.r; by1 = sh.cy + sh.r; }
  else { bx0 = sh.x0; bx1 = sh.x1; by0 = sh.y0; by1 = sh.y1; }
  if (bx0 > x1 || bx1 < x0 || by0 > y1 || by1 < y0) return 0;   // bounding boxes do not touch
  const n = (inShape(sh, x0, y0) ? 1 : 0) + (inShape(sh, x1, y0) ? 1 : 0) +
            (inShape(sh, x0, y1) ? 1 : 0) + (inShape(sh, x1, y1) ? 1 : 0);
  if (n === 4) return 1;
  return -1;
}

/* The topmost shape covering the whole pixel square, -1 if none covers any of it, and -2 if an
   outline crosses it and the pixel has to be sampled. */
function pixelShape(shapes, x0, y0, x1, y1) {
  let top = -1;
  for (let i = 0; i < shapes.length; i++) {
    const v = pixelVsShape(shapes[i], x0, y0, x1, y1);
    if (v === 1) { top = i; continue; }
    if (v === -1) return -2;
  }
  return top;
}

function iconRgba(size, scale) {
  const shapes = iconShapes(scale, 0);
  const cols = {};
  ["bg2", "line", "grn"].forEach(function (k) { cols[k] = rgbOf(tokenColour(k)); });
  const buf = Buffer.alloc(size * size * 4);               // transparent outside the tile
  /* 16x16 = 256 samples, so a pixel's coverage lands on one of 256 levels: the full precision
     an 8-bit channel can carry, and the point at which more samples stop changing the file.
     Measured against a 32x32 reference the 4x4 grid this replaces was out by up to 23 of 255
     levels (rms 3.08 at 32 px) and dropped colour on 122 pixels of a 32 px icon; 16x16 is
     within 6 levels with no pixel out by more than 8. It costs nothing on flat interiors
     because only the pixels an outline crosses are sampled at all — supersampling every pixel
     of the 1024 would take 12.7 s against 0.28 s. */
  const S = 16;
  const px = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) * px, v = (y + 0.5) * px;
      const o = (y * size + x) * 4;
      const mid = pixelShape(shapes, u - px / 2, v - px / 2, u + px / 2, v + px / 2);
      if (mid !== -2) {
        if (mid < 0) continue;
        const c = cols[shapes[mid].fill];
        buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
        continue;
      }
      let r = 0, g = 0, b = 0, hit = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const uu = (x + (sx + 0.5) / S) * px, vv = (y + (sy + 0.5) / S) * px;
          const t = topShape(shapes, uu, vv);
          if (t < 0) continue;
          const c = cols[shapes[t].fill];
          r += c[0]; g += c[1]; b += c[2]; hit++;
        }
      }
      if (!hit) continue;
      buf[o] = Math.round(r / hit);
      buf[o + 1] = Math.round(g / hit);
      buf[o + 2] = Math.round(b / hit);
      buf[o + 3] = Math.round((hit / (S * S)) * 255);
    }
  }
  return buf;
}

function iconSvg() {
  const cols = { bg2: tokenColour("bg2"), line: tokenColour("line"), grn: tokenColour("grn") };
  const V = 512;
  const p = function (v) { return Math.round(v * V * 100) / 100; };
  const parts = iconShapes(1, 0.22).map(function (sh) {
    if (sh.kind === "disc") {
      return '<circle cx="' + p(sh.cx) + '" cy="' + p(sh.cy) + '" r="' + p(sh.r) + '" fill="' + cols[sh.fill] + '"/>';
    }
    return '<rect x="' + p(sh.x0) + '" y="' + p(sh.y0) + '" width="' + p(sh.x1 - sh.x0) +
      '" height="' + p(sh.y1 - sh.y0) + '" rx="' + p(sh.r) + '" fill="' + cols[sh.fill] + '"/>';
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + V + " " + V + '" width="' + V + '" height="' + V +
    '" role="img" aria-label="FPL Mission Control">' + parts.join("") + "</svg>\n";
}

/* ---- manifest, service worker, registration ---- */

/* Every size a 2026 install asks for, and no size nothing asks for.
     32, 48   — the browser tab. A raster fallback matters because the mark's own baseline is
                0.64 px at 32, and an engine that does not take an SVG rel=icon otherwise has
                nothing at all to draw.
     120      — iPhone home screen at @2x.
     152, 167 — iPad at @2x and iPad Pro at @2x.
     180      — iPhone home screen at @3x, which is what apple-touch-icon is handed. Resampling
                the 192 to 180 is not an integer ratio and measured 56 of 255 levels out at
                worst against a 180 drawn directly (E-076's neighbour: the apple-touch icon was
                also the one file no manifest-derived check covered).
     192, 512 — the two sizes an installable manifest is required to carry.
     1024     — store listings, and a clean source for any downsample a platform does itself.
   Maskable is drawn at 192 and 512: Android is the only consumer, and those are the two sizes
   it asks for. All of them are named in the manifest, which is what puts them inside I17, I21
   and I22 — the E-076 checks — instead of beside them. */
const ICON_ANY = [32, 48, 120, 152, 167, 180, 192, 512, 1024];
const ICON_MASKABLE = [192, 512];
const APPLE_TOUCH = [180, 167, 152, 120];                  // largest first; 180 is the default pick
const FAVICON_PNG = [48, 32];

const PWA = {
  manifest: "manifest.webmanifest",
  sw: "sw.js",
  svg: "icon.svg",
  png: function (n) { return "icon-" + n + ".png"; },
  maskablePng: function (n) { return "icon-maskable-" + n + ".png"; }
};

function manifestObject() {
  const bg = tokenColour("bg");
  return {
    name: "FPL Mission Control",
    short_name: "FPL MC",
    description: "One screen that says what to do this gameweek, sourced.",
    lang: "en-ZA",
    dir: "ltr",
    start_url: "./index.html",
    scope: "./",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    /* `id` is the installed app's identity. Without it the identity IS start_url, so the day
       start_url changes the install becomes a second, unrelated app on the device and the
       first one is orphaned. It is resolved against the origin, not the manifest's path, so a
       path-independent string keeps the identity stable if dist/ is ever served from a
       subdirectory. */
    id: "fpl-mission-control",
    categories: ["sports", "utilities"],
    background_color: bg,
    theme_color: bg,
    /* One list, built from ICON_ANY and ICON_MASKABLE, so the manifest declares exactly the
       files main() writes: a manifest naming a file the repository does not hold is E-076. */
    icons: [{ src: PWA.svg, sizes: "any", type: "image/svg+xml", purpose: "any" }]
      .concat(ICON_ANY.map(function (n) {
        return { src: PWA.png(n), sizes: n + "x" + n, type: "image/png", purpose: "any" };
      }))
      .concat(ICON_MASKABLE.map(function (n) {
        return { src: PWA.maskablePng(n), sizes: n + "x" + n, type: "image/png", purpose: "maskable" };
      }))
  };
}

/* The worker precaches exactly what the manifest names, derived from the manifest itself so a
   size added to ICON_ANY cannot be installable and offline-missing at the same time.

   "./" is deliberately absent. On every static host it and "./index.html" are the same 2.37 MiB
   document, so precaching both stored the shell twice — 4.75 MiB of cache quota and two full
   fetches per install for one file. Nothing is lost: navigateFirst answers every navigation
   from caches.match("./index.html") whatever URL was asked for, which is the line that makes
   the app work offline, and it does not consult "./" at all. */
function shellList(mf) {
  const out = [];
  const seen = {};
  const add = function (u) { if (!seen[u]) { seen[u] = 1; out.push(u); } };
  add("./index.html");
  add("./" + PWA.manifest);
  mf.icons.forEach(function (i) { add("./" + String(i.src).replace(/^\.\//, "")); });
  return out;
}

function serviceWorker(cacheName, shell) {
  return [
    "/* sw.js — generated by build.cjs; do not edit. Precaches the shell so the app opens with",
    " * no network. The cache name carries the build hash, so a new build lands in a new cache",
    " * and every older fpl-mc- cache is deleted on activate: a stale shell cannot survive a",
    " * deploy. Nothing cross-origin and nothing that is not a GET is ever cached — the D4",
    " * refresh path is a POST to api.anthropic.com and must always hit the network. */",
    '"use strict";',
    "var CACHE = " + JSON.stringify(cacheName) + ";",
    "var SHELL = " + JSON.stringify(shell) + ";",
    "/* How long a navigation waits for the network before the cached shell answers (IOS27-17). */",
    "var RACE_MS = 3000;",
    "",
    "self.addEventListener('install', function (e) {",
    "  e.waitUntil((async function () {",
    "    var c = await caches.open(CACHE);",
    "    for (var i = 0; i < SHELL.length; i++) {",
    "      try {",
    "        var r = await fetch(new Request(SHELL[i], { cache: 'reload' }));",
    "        if (r && r.ok) await c.put(SHELL[i], r.clone());",
    "      } catch (err) { /* one missing file must not fail the install; fetch() falls through */ }",
    "    }",
    "    await self.skipWaiting();",
    "  })());",
    "});",
    "",
    "self.addEventListener('activate', function (e) {",
    "  e.waitUntil((async function () {",
    "    var names = await caches.keys();",
    "    for (var i = 0; i < names.length; i++) {",
    "      if (names[i] !== CACHE && names[i].indexOf('fpl-mc-') === 0) await caches.delete(names[i]);",
    "    }",
    "    await self.clients.claim();",
    "  })());",
    "});",
    "",
    "/* The page asks a waiting worker to take over when the manager taps \"New build ready\" (IOS27-07). */",
    "self.addEventListener('message', function (e) {",
    "  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();",
    "});",
    "",
    "self.addEventListener('fetch', function (e) {",
    "  var req = e.request;",
    "  if (req.method !== 'GET') return;",
    "  var url = null;",
    "  try { url = new URL(req.url); } catch (err) { return; }",
    "  if (url.origin !== self.location.origin) return;",
    "  if (req.mode === 'navigate') { e.respondWith(navigateFirst(req, e)); return; }",
    "  e.respondWith(cacheFirst(req));",
    "});",
    "",
    "/* A navigation goes to the network first and is revalidated on every open (cache: 'no-cache'), so no max-age a",
    "   host sends can serve yesterday's page. If the network has not answered inside RACE_MS the cached shell answers",
    "   instead and the fetch is left to finish under waitUntil, so the cache holds the new copy for the next open.",
    "   redirect: 'manual' keeps a host's redirect a redirect: a followed one cannot answer a navigation. Offline, the",
    "   cached shell is the answer, which is what makes the app work with no signal. */",
    "async function navigateFirst(req, e) {",
    "  var net = fetch(new Request(req.url, { cache: 'no-cache', redirect: 'manual' })).then(async function (fresh) {",
    "    if (fresh && fresh.ok) { var c = await caches.open(CACHE); await c.put('./index.html', fresh.clone()); }",
    "    return fresh;",
    "  });",
    "  e.waitUntil(net.then(function () {}, function () {}));",
    "  var timer = null;",
    "  var late = new Promise(function (resolve) { timer = setTimeout(function () { resolve(null); }, RACE_MS); });",
    "  var first;",
    "  try { first = await Promise.race([net, late]); } catch (err) { first = undefined; }",
    "  if (timer) clearTimeout(timer);",
    "  if (first) return first;",
    "  var hit = await caches.match('./index.html', { cacheName: CACHE });",
    "  if (hit) return hit;",
    "  if (first === null) { try { var slow = await net; if (slow) return slow; } catch (err) { /* offline */ } }",
    "  return new Response('FPL Mission Control is offline and the shell is not in the cache yet.',",
    "    { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });",
    "}",
    "",
    "async function cacheFirst(req) {",
    "  var hit = await caches.match(req, { cacheName: CACHE });",
    "  if (hit) return hit;",
    "  var fresh = await fetch(req);",
    "  if (fresh && fresh.ok && fresh.type !== 'opaque') { var c = await caches.open(CACHE); await c.put(req, fresh.clone()); }",
    "  return fresh;",
    "}",
    ""
  ].join("\n");
}

/* The registration, bracketed so qa/verify.sh can lift it out of the shipped page and RUN it
   against a stubbed file: location — a grep for the word "protocol" would not prove the guard
   works, and this is the line that keeps the single-file mode alive. */
const PWA_MARK = { start: "/* PWA — START */", end: "/* PWA — END */" };

function registerScript() {
  return [
    PWA_MARK.start,
    "(function(){",
    "  var st = { protocol: '', sw: 'pending', cache: null, error: null, updated: false };",
    "  try {",
    "    window.__PWA__ = st;",
    "    st.protocol = (location && location.protocol) || '';",
    "    if (st.protocol !== 'http:' && st.protocol !== 'https:') { st.sw = 'skipped-not-http'; return; }",
    "    if (!('serviceWorker' in navigator)) { st.sw = 'unsupported'; return; }",
    /* A newer build has taken over, or is waiting: tell the page (the app shows \"New build ready\"). st.updated is there
       for an app that mounts after the event. */
    "    var announce = function(){",
    "      st.updated = true;",
    "      try { window.dispatchEvent(new Event('mc-sw-updated')); } catch (e) {}",
    "    };",
    /* Everything after a successful registration. A controllerchange with no controller before it is the first worker
       claiming the page, not an update. update() runs when the page comes back to the front, at most once in thirty
       minutes, and the throttle starts unarmed: the first return checks. */
    "    var wire = function(reg){",
    "      try {",
    "        var sw = navigator.serviceWorker;",
    "        var had = !!sw.controller;",
    "        if (typeof sw.addEventListener === 'function') sw.addEventListener('controllerchange', function(){ if (had) announce(); had = true; });",
    "        if (had && reg.waiting) announce();",
    "        if (had && typeof reg.addEventListener === 'function') reg.addEventListener('updatefound', function(){",
    "          var w = reg.installing;",
    "          if (!w || typeof w.addEventListener !== 'function') return;",
    "          w.addEventListener('statechange', function(){",
    "            if (w.state === 'installed' && typeof setTimeout === 'function') setTimeout(function(){ if (reg.waiting) announce(); }, 1500);",
    "          });",
    "        });",
    "        var last = 0;",
    "        if (typeof reg.update === 'function' && typeof document.addEventListener === 'function') document.addEventListener('visibilitychange', function(){",
    "          if (document.visibilityState !== 'visible') return;",
    "          var now = Date.now();",
    "          if (last && now - last < 1800000) return;",
    "          last = now;",
    "          try { var p = reg.update(); if (p && typeof p.catch === 'function') p.catch(function(){}); } catch (e) {}",
    "        });",
    "      } catch (e) { st.error = String(e && e.message ? e.message : e).slice(0, 140); }",
    "    };",
    "    var go = function(){",
    "      try {",
    "        navigator.serviceWorker.register('sw.js', { scope: './' }).then(function(reg){",
    "          st.sw = 'registered'; st.cache = reg && reg.scope ? String(reg.scope) : '';",
    "          if (reg) wire(reg);",
    "        }, function(err){",
    "          st.sw = 'failed'; st.error = String(err && err.message ? err.message : err).slice(0, 140);",
    "        });",
    "      } catch (e) { st.sw = 'failed'; st.error = String(e && e.message ? e.message : e).slice(0, 140); }",
    "    };",
    "    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);",
    "  } catch (e) { st.sw = 'failed'; st.error = String(e && e.message ? e.message : e).slice(0, 140); }",
    "})();",
    PWA_MARK.end
  ].join("\n");
}

function page(js) {
  /* The dist shim behaves like the artifact's store: text in, text out. A string is stored as it is (the app writes JSON
     text, the same bytes the plain-localStorage fallback writes); anything else is turned into JSON text first. A failed
     write resolves false and keeps the reason on __error, so the app can say "not saved" instead of pretending. __shim is
     the marker the app reads to know it is the dist build and not the artifact, which never has it. */
  const shim = [
    "(function(){",
    "  if (window.storage && typeof window.storage.get === 'function') return;",
    "  var api = {",
    "    __shim: 'localStorage', __error: null,",
    "    get: function(k){ try { var v = localStorage.getItem(k); return Promise.resolve(v === null ? null : { key: k, value: v }); } catch (e) { return Promise.resolve(null); } },",
    "    set: function(k, v){",
    "      try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); api.__error = null; return Promise.resolve(true); }",
    "      catch (e) { api.__error = { name: String(e && e.name ? e.name : 'Error'), message: String(e && e.message ? e.message : e).slice(0, 120) }; return Promise.resolve(false); }",
    "    }",
    "  };",
    "  window.storage = api;",
    "})();"
  ].join("\n");
  return [
    "<!doctype html>",
    "<html lang=\"en-ZA\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">",
    "<meta name=\"color-scheme\" content=\"dark\">",
    "<title>FPL Mission Control " + APP_VERSION + "</title>",
    /* The installable half. theme_color, background_color and this meta are all the app's own
       --bg token, read out of src/ui.jsx at build time: the manifest cannot carry a colour in
       a format that understands var(--bg), so the only safe copy is a derived one. verify.sh
       asserts all three are equal to the token. */
    "<link rel=\"manifest\" href=\"" + PWA.manifest + "\">",
    /* Tab icons: the raster pair first, so an engine that does not take an SVG rel=icon has a
       sharp file to draw rather than nothing, then the vector one for engines that prefer it.
       Home-screen icons: iOS reads these links and not the manifest, and it is handed the size
       it asks for instead of resampling one — 192 down to 180 is not an integer ratio. Every
       href below is also a manifest icon, which is what checkPageIcons() asserts and what puts
       these files inside the manifest-derived E-076 checks. */
    FAVICON_PNG.map(function (n) {
      return "<link rel=\"icon\" type=\"image/png\" sizes=\"" + n + "x" + n + "\" href=\"" + PWA.png(n) + "\">";
    }).join("\n"),
    "<link rel=\"icon\" type=\"image/svg+xml\" href=\"" + PWA.svg + "\">",
    APPLE_TOUCH.map(function (n) {
      return "<link rel=\"apple-touch-icon\" sizes=\"" + n + "x" + n + "\" href=\"" + PWA.png(n) + "\">";
    }).join("\n"),
    "<meta name=\"theme-color\" content=\"" + tokenColour("bg") + "\">",
    "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">",
    "<meta name=\"apple-mobile-web-app-title\" content=\"FPL MC\">",
    "<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\">",
    "<meta name=\"mobile-web-app-capable\" content=\"yes\">",
    /* CONTRACT §7 allows hex only inside the token definitions, which live in the app's own
       single <style> block. This shell block therefore carries no colour at all: it would be a
       second, unwatched copy of --bg and --text, free to drift from the tokens. The dark canvas
       before React mounts comes from the color-scheme meta above, and .mc-root paints var(--bg)
       over the full viewport the moment it renders. */
    "<style>html,body{margin:0;padding:0}#root{min-height:100vh;min-height:100svh}</style>",
    "</head>",
    "<body>",
    "<div id=\"root\"></div>",
    "<script>" + shim + "</script>",
    "<script>" + js.replace(/<\/script/gi, "<\\/script") + "</script>",
    "<script>" + registerScript() + "</script>",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

/* Every icon the page links to must be one the manifest names. The apple-touch-icon was the
   one asset dist/index.html referenced that no manifest-derived check could see, which is how
   E-076 got its PNGs quietly dropped by an ignore rule: I17, I21 and I22 all build their file
   lists from manifest.icons. Pointing the page's links at manifest icons puts them inside
   those checks; this assert is what stops a later link pointing somewhere else again. */
function checkPageIcons(html, mf) {
  const named = {};
  mf.icons.forEach(function (i) { named[String(i.src).replace(/^\.\//, "")] = true; });
  const hrefs = [];
  const re = /<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1].replace(/^\.\//, ""));
  if (!hrefs.length) throw new Error("build: dist/index.html links no icon at all");
  const stray = hrefs.filter(function (h) { return !named[h]; });
  if (stray.length) {
    throw new Error("build: the page links " + stray.join(", ") + ", which the manifest does not name \u2014 " +
      "a file outside manifest.icons is a file verify.sh I17/I21/I22 cannot see, and E-076 is what that costs");
  }
  return hrefs;
}

function main() {
  /* data/pre.json first, so `npm run build` and the gate's build step both refresh it. A refusal (the plan was
     solved on other data, or two claims sheets for one plan) stops the build: nothing is assembled from it. */
  let preRun;
  try { preRun = require("./pipeline/precompute.cjs"); }
  catch (e) { throw new Error("build: pipeline/precompute.cjs could not be loaded — " + (e && e.message ? e.message : e)); }
  let preRes;
  try { preRes = preRun.precompute(); }
  catch (e) { throw new Error("build: pipeline/precompute.cjs refused" + (e && e.code ? " (exit " + e.code + ")" : "") + " — " + (e && e.message ? e.message : e)); }
  console.log(preRun.summary(preRes));
  const jsx = assemble();
  const js = bundle();
  fs.mkdirSync(P("dist"), { recursive: true });

  const mask = maskableScale();
  const html = page(js);
  const mf = manifestObject();
  const mfText = JSON.stringify(mf, null, 2) + "\n";
  const linked = checkPageIcons(html, mf);

  const icons = {};
  const parsed = [];
  icons[PWA.svg] = Buffer.from(iconSvg(), "utf8");
  ICON_ANY.forEach(function (n) { icons[PWA.png(n)] = png(n, iconRgba(n, 1)); });
  ICON_MASKABLE.forEach(function (n) { icons[PWA.maskablePng(n)] = png(n, iconRgba(n, mask.scale)); });

  /* The manifest and the files on disk are the same list by construction; this is the assert
     that says so out loud, because "by construction" is how E-076 read too. */
  const mfIcons = mf.icons.map(function (i) { return String(i.src).replace(/^\.\//, ""); });
  const unwritten = mfIcons.filter(function (k) { return !icons[k]; });
  const unnamed = Object.keys(icons).filter(function (k) { return mfIcons.indexOf(k) < 0; });
  if (unwritten.length || unnamed.length) {
    throw new Error("build: the manifest and the icon set disagree \u2014 named and not written: " +
      (unwritten.join(", ") || "none") + "; written and not named: " + (unnamed.join(", ") || "none"));
  }

  /* Decoded again before anything is written: see verifyPng. The manifest's `sizes` is written
     from the same number this checks the IHDR against, so the two cannot disagree either. */
  ICON_ANY.forEach(function (n) { parsed.push(verifyPng(icons[PWA.png(n)], n, PWA.png(n))); });
  ICON_MASKABLE.forEach(function (n) { parsed.push(verifyPng(icons[PWA.maskablePng(n)], n, PWA.maskablePng(n))); });

  /* The cache name is derived from everything the worker precaches except the worker itself,
     so a build that changes one byte of the page or one icon gets a new cache and the old one
     is deleted on activate. Hashing the worker into its own name is the cycle that has to be
     avoided; nothing in the page references the worker's contents, only its filename. */
  const stamp = crypto.createHash("sha256");
  stamp.update(html);
  stamp.update(mfText);
  Object.keys(icons).sort().forEach(function (k) { stamp.update(k); stamp.update(icons[k]); });
  const cacheName = "fpl-mc-" + APP_VERSION + "-" + stamp.digest("hex").slice(0, 12);
  const swText = serviceWorker(cacheName, shellList(mf));

  fs.writeFileSync(P("dist/index.html"), html);
  fs.writeFileSync(P("dist/" + PWA.manifest), mfText);
  fs.writeFileSync(P("dist/" + PWA.sw), swText);
  Object.keys(icons).forEach(function (k) { fs.writeFileSync(P("dist/" + k), icons[k]); });

  const kb = function (s) { return (Buffer.byteLength(s, "utf8") / 1024).toFixed(0) + " kB"; };
  const kbb = function (b) { return (b.length / 1024).toFixed(1) + " kB"; };
  console.log("app/FPL_Mission_Control.jsx  " + kb(jsx));
  console.log("dist/index.html              " + kb(html));
  console.log("dist/" + PWA.manifest + "    " + kb(mfText) + "  theme " + tokenColour("bg") + " (= --bg)");
  console.log("dist/" + PWA.sw + "                    " + kb(swText) + "  cache " + cacheName);
  console.log("dist/icon.svg                " + kbb(icons[PWA.svg]) + "  vector, viewBox 512");
  parsed.forEach(function (r) {
    console.log("dist/" + r.name + (r.name.length < 24 ? new Array(24 - r.name.length + 1).join(" ") : "") +
      " " + String(r.bytes).padStart(6) + " B  IHDR " + r.w + "x" + r.h +
      "  depth " + r.depth + "  colour " + r.colour + " (RGBA)  " + r.chunks + "  CRCs ok");
  });
  console.log("maskable safe zone           content reaches " + mask.worst.toFixed(5) + "u = " +
    mask.pct.toFixed(1) + "% of the " + MASK_SAFE_R + "u safe radius at scale " + mask.scale.toFixed(4) +
    " (clips above " + mask.limit.toFixed(4) + ")");
  console.log("page icon links              " + linked.length + " (" + linked.join(", ") + "), all named by the manifest");
  const nm = Object.keys(M).length;
  console.log("version " + APP_VERSION + "  markers " + nm + "/" + nm + "  order ok  " + parsed.length + " PNGs parsed back");
}

main();

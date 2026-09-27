#!/usr/bin/env node
/*
 * qa/visual.cjs — the machine-checked visual standard: contrast and layout, read from the source.
 *
 *   node qa/visual.cjs                       # audits src/ui.jsx
 *   VISUAL_SRC=<file> node qa/visual.cjs     # the same audits on a copy of it (the mutation runs)
 *
 * WHAT IT PROVES
 *   audit_contrast — every foreground/background token pairing the markup actually uses meets
 *   WCAG 2.2 (1.4.3 text, 1.4.11 non-text). The tokens are read out of src/ui.jsx with the
 *   same reader build.cjs uses for the manifest and the icons, so there is one definition of a
 *   colour in this repository and no second copy to drift. The pairings are DERIVED: the CSS in
 *   the STYLE literal is parsed into rules, the JSX is walked element by element with its
 *   ancestor chain, and each text-bearing element is resolved to the colour it inherits and the
 *   surface it sits on. Where a surface cannot be resolved (a component's root element, whose
 *   parent is another component), the pairing is tested on every neutral surface, which for a
 *   light-on-dark palette is the strictest reading, never a softer one.
 *
 *   audit_layout — the Part G phone rules that a stylesheet can hold on its own: the seven
 *   touch floors as min-heights, the 11px type floor in every rule of every media query, the tab
 *   strip fitting at 390px and at the width its own media query targets, the header title guard,
 *   and zero hex colour literals outside the token block.
 *
 * WHY NODE-ONLY, AND WHY IT IS IN GROUP A
 *   smoke.cjs and webkit.js measure the type and touch floors in a real browser, at 390x844.
 *   A rule inside a media query for a narrower phone never fires at that width, so a browser
 *   measurement at one viewport cannot see it; this suite reads the stylesheet, so it can. It
 *   needs no browser and no build, and finishes in well under a second, which is why it runs
 *   before the data suites: a red here is the cheapest red in the gate.
 *
 * THRESHOLDS
 *   Text: 4.5:1, or 3:1 for large text. WCAG defines large text as 18 point or 14 point bold;
 *   at 96 dpi that is 24px regular or 18.66px at weight 700 or above. Nothing in this app is
 *   large by that definition, so every text pairing is held to 4.5:1. Non-text (1.4.11): 3:1
 *   for the boundary of a text input, the fill of a progress bar against its track, the focus
 *   outline, the active tab's border and every icon against its surface. Contrast is the WCAG
 *   relative-luminance ratio, rounded to four decimals before comparison.
 *
 * MUTATIONS PROVEN ON A COPY (VISUAL_SRC), each quoted in the report of 27 September 2026:
 *   --mute darkened to its former #6a7588 → the --mute line goes red at 4.1538 / 3.8198 / 3.4533;
 *   one min-height removed → its touch floor goes red; a hex literal placed in JSX markup → the
 *   hex line goes red naming the line.
 *
 * NO FROZEN LIVE VALUES. Every number here is a design rule (Part G, WCAG) or is computed from
 * the source on each run. The touch-floor table is cross-checked against the one smoke.cjs and
 * webkit.js carry, so the three copies cannot drift apart unnoticed.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = process.env.VISUAL_SRC ? path.resolve(process.env.VISUAL_SRC) : path.join(ROOT, "src", "ui.jsx");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name + (detail ? " — " + detail : "")); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const r4 = (x) => Math.round(x * 10000) / 10000;
const fmt = (x) => r4(x).toFixed(4);

const src = fs.readFileSync(SRC, "utf8");

/* ------------------------------------------------------------------ the token reader
 * A copy of build.cjs tokenColour() and rgbOf(), which build.cjs does not export. The regular
 * expression is identical on purpose: `--bg\s*:` cannot match `--bg2:`, and a token that is
 * referenced but never defined throws rather than reading as black. */
function tokenColour(name) {
  const m = src.match(new RegExp("--" + name + "\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;"));
  if (!m) throw new Error("the --" + name + " colour token is not defined in " + path.relative(ROOT, SRC));
  return m[1].toLowerCase();
}
function rgbOf(hex) {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/* ------------------------------------------------------------------ WCAG 2.2 */
function channel(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum(hex) { const [r, g, b] = rgbOf(hex); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); }
function contrast(a, b) { const x = relLum(a), y = relLum(b); return r4((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)); }
function isLarge(px, weight) { return px >= 24 || (px >= 18.66 && weight >= 700); }

/* ------------------------------------------------------------------ the STYLE literal */
const styleStart = src.indexOf("const STYLE = `");
const styleEnd = styleStart < 0 ? -1 : src.indexOf("`;", styleStart + 15);
const STYLE = styleStart < 0 || styleEnd < 0 ? "" : src.slice(styleStart + 15, styleEnd);
const styleLine = styleStart < 0 ? 0 : src.slice(0, styleStart).split("\n").length;

/* The JSX with the stylesheet cut out and comments removed, so a hex code or a tag inside a
   comment cannot be mistaken for markup. Line numbers are preserved: the removed spans are
   replaced by the same number of newlines. */
function blank(s) { return s.replace(/[^\n]/g, ""); }
const MARKUP = (styleStart < 0 ? src : src.slice(0, styleStart) + blank(src.slice(styleStart, styleEnd + 2)) + src.slice(styleEnd + 2))
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/^\s*\/\/.*$/gm, blank);
const lineAt = (idx) => MARKUP.slice(0, idx).split("\n").length;

/* ------------------------------------------------------------------ CSS parser */
function parseCss(text) {
  const rules = [];
  let i = 0; const n = text.length;
  function block(media) {
    while (i < n) {
      while (i < n && /\s/.test(text[i])) i++;
      if (i >= n) return;
      if (text[i] === "}") { i++; return; }
      const j = text.indexOf("{", i);
      if (j < 0) return;
      const prelude = text.slice(i, j).trim();
      i = j + 1;
      if (prelude[0] === "@") {
        const m = prelude.match(/^@([\w-]+)\s*(.*)$/);
        if (m && m[1] === "media") { block((media ? media + " and " : "") + m[2].trim()); continue; }
        let depth = 1;                       // @keyframes and the like: skipped whole
        while (i < n && depth > 0) { if (text[i] === "{") depth++; else if (text[i] === "}") depth--; i++; }
        continue;
      }
      let k = i, q = null;
      for (; k < n; k++) { const c = text[k]; if (q) { if (c === q) q = null; continue; } if (c === '"' || c === "'") q = c; else if (c === "}") break; }
      const decl = {};
      text.slice(i, k).split(";").forEach((d) => {
        const p = d.indexOf(":"); if (p < 0) return;
        const prop = d.slice(0, p).trim().toLowerCase(), val = d.slice(p + 1).trim();
        if (prop) decl[prop] = val;
      });
      i = k + 1;
      prelude.split(",").forEach((sel) => {
        const s = sel.trim().replace(/\s+/g, " ");
        rules.push({ sel: s, decl, media: media || null, order: rules.length, comps: parseSelector(s) });
      });
    }
  }
  block(null);
  return rules;
}

/* Compound selectors joined by descendant or child combinators. Pseudo-elements and sibling
   combinators are outside this model and return null; pseudo-classes are kept on the compound
   and make it match nothing during colour resolution (:active, :disabled, :last-child and
   :focus-visible do not set colours in this stylesheet; the outline is read explicitly). */
function parseSelector(sel) {
  if (/::|\+|~/.test(sel)) return null;
  const comps = [];
  for (const part of sel.split(/\s*>\s*|\s+/).filter(Boolean)) {
    const c = { tag: null, classes: [], attrs: [], pseudos: [], universal: false };
    let rest = part, m;
    if (rest[0] === "*") { c.universal = true; rest = rest.slice(1); }
    else if ((m = rest.match(/^[a-zA-Z][\w-]*/))) { c.tag = m[0].toLowerCase(); rest = rest.slice(m[0].length); }
    const re = /\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:([\w-]+)(?:\([^)]*\))?/g;
    let mm, used = 0;
    while ((mm = re.exec(rest))) {
      used += mm[0].length;
      if (mm[1]) c.classes.push(mm[1]);
      else if (mm[2]) c.attrs.push({ name: mm[2], value: mm[3] === undefined ? null : mm[3] });
      else if (mm[4]) c.pseudos.push(mm[4]);
    }
    if (used !== rest.length) return null;
    comps.push(c);
  }
  return comps.length ? comps : null;
}
function specificity(comps) {
  let b = 0, c = 0;
  for (const k of comps) { b += k.classes.length + k.attrs.length + k.pseudos.length; c += k.tag ? 1 : 0; }
  return [b, c];
}
const tokenIn = (val) => { const m = /var\(--([\w-]+)\)/.exec(val || ""); return m ? m[1] : null; };
function pxOf(val) {
  const m = /^(\d+(?:\.\d+)?)(px|em|rem|pt|%)?$/.exec(String(val || "").trim());
  if (!m) return null;
  const v = parseFloat(m[1]), u = m[2] || (v === 0 ? "px" : null);
  if (u === "px") return v;
  if (u === "em" || u === "rem") return v * BASE_PX;
  if (u === "%") return v * BASE_PX / 100;
  if (u === "pt") return v * 96 / 72;
  return null;
}
function fontShorthandPx(val) { const m = /(\d+(?:\.\d+)?)(px|em|rem|pt|%)\s*(?:\/|\s)/.exec(val || ""); return m ? pxOf(m[1] + m[2]) : null; }
function weightOf(val) { if (!val) return null; if (/^bold$/i.test(val)) return 700; if (/^normal$/i.test(val)) return 400; const n = parseInt(val, 10); return isNaN(n) ? null : n; }

const RULES = parseCss(STYLE.replace(/\/\*[\s\S]*?\*\//g, ""));
const rootRule = RULES.find((r) => r.sel === ".mc-root" && !r.media);
const BASE_PX = (rootRule && (fontShorthandPx(rootRule.decl.font) || pxOf(rootRule.decl["font-size"]))) || 16;

/* ------------------------------------------------------------------ JSX walk
 * Every element with its tag, its static classes, the string tokens inside a dynamic className
 * (each a class the element carries in some state), the attribute names it has, whether it has
 * direct text or expression content, and its ancestor chain. A capitalised tag that is defined
 * in this file is a component: its children are re-parented into the element that renders
 * props.children (Section → .section > .sec-b, Row → .row), found by a first pass. A capitalised
 * tag that is neither defined here nor imported from recharts is a lucide icon, an inline svg
 * that takes currentColor. Markup built with React.createElement (the error boundary) is read
 * by a small second scanner and resolved against every neutral surface. */
const KNOWN_TAGS = new Set(["div", "span", "button", "b", "i", "p", "select", "option", "textarea", "nav", "input", "h1", "h2", "h3", "h4", "a", "ul", "ol", "li", "small", "strong", "em", "label", "form", "section", "header", "footer", "main", "table", "thead", "tbody", "tr", "td", "th", "svg", "path", "img", "pre", "code", "style"]);
const RECHARTS = new Set((/import\s*\{([^}]*)\}\s*from\s*"recharts"/.exec(src) || ["", ""])[1].split(",").map((s) => s.trim()).filter(Boolean));
const LOCAL = {};
{
  const re = /^(?:function\s+([A-Z]\w*)\s*\(|class\s+([A-Z]\w*)\s+extends|const\s+([A-Z]\w*)\s*=)/gm;
  const defs = []; let m;
  while ((m = re.exec(MARKUP))) defs.push({ name: m[1] || m[2] || m[3], start: m.index });
  defs.forEach((d, k) => { LOCAL[d.name] = { start: d.start, end: k + 1 < defs.length ? defs[k + 1].start : MARKUP.length, slot: null }; });
}
function ownerOf(idx) { for (const name in LOCAL) if (idx >= LOCAL[name].start && idx < LOCAL[name].end) return name; return null; }

function parseAttrs(text) {
  /* strip {…} expressions (brace balanced, quote aware) and quoted values, then read the names */
  let out = "", depth = 0, q = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === "\\") { i++; continue; } if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { q = ch; if (depth === 0) out += " "; continue; }
    if (ch === "{") { depth++; continue; }
    if (ch === "}") { depth--; continue; }
    if (depth === 0) out += ch;
  }
  const names = [];
  out.replace(/([A-Za-z][\w-]*)\s*(?==|\s|$|\/)/g, (all, nm) => { names.push(nm); return all; });
  return names;
}
function classesOf(attrText) {
  const st = /className\s*=\s*"([^"]*)"/.exec(attrText);
  if (st) return { statics: st[1].split(/\s+/).filter(Boolean), dynamics: [] };
  const dy = /className\s*=\s*\{/.exec(attrText);
  if (!dy) return { statics: [], dynamics: [] };
  let i = dy.index + dy[0].length, depth = 1, q = null, expr = "";
  for (; i < attrText.length && depth > 0; i++) {
    const ch = attrText[i];
    if (q) { expr += ch; if (ch === "\\") { expr += attrText[++i]; continue; } if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { q = ch; expr += ch; continue; }
    if (ch === "{") depth++; else if (ch === "}") { depth--; if (!depth) break; }
    expr += ch;
  }
  const toks = new Set();
  expr.replace(/"([^"]*)"|'([^']*)'/g, (all, a, b) => { String(a || b || "").split(/\s+/).filter(Boolean).forEach((t) => toks.add(t)); return all; });
  return { statics: [], dynamics: [...toks] };
}

function walk(text, withSlots) {
  const els = [], stack = [];
  let i = 0; const n = text.length;
  const chainNow = () => { const ch = []; for (const f of stack) { if (f.el) ch.push(f.el); for (const v of f.virtual || []) ch.push(v); } return ch; };
  while (i < n) {
    const c = text[i];
    if (c !== "<") {
      if (stack.length && !/\s/.test(c)) {
        const top = stack[stack.length - 1];
        if (top.el) top.el.content = true;
        if (text.startsWith("props.children", i) && top.el) top.el.slot = true;
      }
      i++; continue;
    }
    if (text[i + 1] === "/") {
      const m = /^<\/([A-Za-z][\w.]*)\s*>/.exec(text.slice(i, i + 80));
      if (!m) { i++; continue; }
      let k = stack.length - 1; while (k >= 0 && stack[k].name !== m[1]) k--;
      if (k >= 0) stack.length = k;
      i += m[0].length; continue;
    }
    const m = /^<([A-Za-z][\w.]*)/.exec(text.slice(i, i + 80));
    if (!m) { i++; continue; }
    const name = m[1];
    let k = i + m[0].length, depth = 0, q = null, selfClose = false;
    for (; k < n; k++) {
      const ch = text[k];
      if (q) { if (ch === "\\") { k++; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { q = ch; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) { selfClose = text[k - 1] === "/"; break; }
    }
    const attrText = text.slice(i + m[0].length, k);
    const line = lineAt(i);
    const isCap = /^[A-Z]/.test(name);
    if (!isCap && !KNOWN_TAGS.has(name)) { i = k + 1; continue; }        // not markup
    const cls = classesOf(attrText);
    const attrs = parseAttrs(attrText);
    let el = null, virtual = [];
    if (!isCap) {
      el = { tag: name, statics: cls.statics, dynamics: cls.dynamics, attrs, content: false, slot: false, line, chain: chainNow(), owner: ownerOf(i) };
      els.push(el);
    } else if (LOCAL[name]) {
      if (withSlots && LOCAL[name].slot) {
        /* the component's own chain from its root to the element holding props.children, with
           the usage's attribute names carried onto the root (so <Row head> reads as .row-h) */
        virtual = LOCAL[name].slot.map((v, idx) => ({ tag: v.tag, statics: v.statics, dynamics: v.dynamics, attrs: idx === 0 ? [...new Set(v.attrs.concat(attrs))] : v.attrs, content: false, line: v.line, virtual: true }));
      }
    } else if (!RECHARTS.has(name)) {
      el = { tag: "svg", statics: cls.statics, dynamics: cls.dynamics, attrs, content: false, slot: false, line, chain: chainNow(), owner: ownerOf(i), icon: true };
      els.push(el);
    }
    if (!selfClose) stack.push({ name, el, virtual });
    i = k + 1;
  }
  return { els, leftOpen: stack.length };
}

/* Pass 1: which element of each component renders props.children. */
const pass1 = walk(MARKUP, false);
for (const el of pass1.els) {
  if (!el.slot || !el.owner) continue;
  const chain = el.chain.filter((a) => a.owner === el.owner).concat([el]);
  LOCAL[el.owner].slot = chain.map((a) => ({ tag: a.tag, statics: a.statics, dynamics: a.dynamics, attrs: a.attrs, line: a.line }));
}
/* Pass 2: the elements with their real ancestry, component slots included. */
const pass2 = walk(MARKUP, true);
const ELS = pass2.els;
/* React.createElement("tag", { className: "…" }, …children) — the error boundary. */
{
  const re = /React\.createElement\(\s*"([a-z][a-z0-9]*)"\s*,\s*\{\s*className:\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(MARKUP))) ELS.push({ tag: m[1], statics: m[2].split(/\s+/).filter(Boolean), dynamics: [], attrs: [], content: true, line: lineAt(m.index), chain: [], owner: ownerOf(m.index), created: true });
}

/* ------------------------------------------------------------------ cascade resolution */
const COLOUR_RULES = RULES.filter((r) => r.comps && !r.media && tokenIn(r.decl.color));
const BG_RULES = RULES.filter((r) => r.comps && !r.media && r.decl.background !== undefined);
const SIZE_RULES = RULES.filter((r) => r.comps && !r.media && (r.decl["font-size"] !== undefined || r.decl.font !== undefined));
const WEIGHT_RULES = RULES.filter((r) => r.comps && !r.media && r.decl["font-weight"] !== undefined);

function compMatches(comp, el, state) {
  if (comp.pseudos.length) return false;
  if (comp.tag && comp.tag !== el.tag) return false;
  for (const c of comp.classes) if (!el.cls.includes(c)) return false;
  for (const a of comp.attrs) {
    if (!el.attrs.includes(a.name)) return false;
    if (a.value !== null && state !== a.name + '="' + a.value + '"') return false;
  }
  return true;
}
function view(el, extra) { return { tag: el.tag, cls: el.statics.concat(extra ? [extra] : []), attrs: el.attrs }; }
function selMatches(comps, el, chain, state) {
  if (!compMatches(comps[comps.length - 1], el, state)) return false;
  let ai = chain.length - 1;
  for (let ci = comps.length - 2; ci >= 0; ci--) {
    while (ai >= 0 && !compMatches(comps[ci], chain[ai], state)) ai--;
    if (ai < 0) return false;
    ai--;
  }
  return true;
}
/* the most specific matching rule of a set, source order breaking ties */
function winner(rules, el, chain, state) {
  let best = null, bs = null;
  for (const r of rules) {
    if (!selMatches(r.comps, el, chain, state)) continue;
    const s = specificity(r.comps);
    if (!best || s[0] > bs[0] || (s[0] === bs[0] && (s[1] > bs[1] || (s[1] === bs[1] && r.order > best.order)))) { best = r; bs = s; }
  }
  return best;
}
const NEUTRAL = "*neutral*";
const NEUTRAL_SURFACES = ["bg", "bg2", "bg3"];

/* The element and its chain, each as the set of views it can take (static classes, plus each
   dynamic class in turn). A property is resolved per view, and a view that sets nothing inherits
   the whole set from the parent, so a Row head passes --mute down to its cells. */
function views(el) { const out = [view(el, null)]; for (const d of el.dynamics) out.push(view(el, d)); return out; }
function chainViews(chain) { return chain.map((a) => view(a, null)); }

function resolve(el, chain, state, rules, pick, memo) {
  const key = (el.line || 0) + "|" + el.tag + "|" + chain.length + "|" + state;
  if (memo.has(key)) return memo.get(key);
  const out = new Set();
  const cv = chainViews(chain);
  for (const v of views(el)) {
    const r = winner(rules, v, cv, state);
    const val = r ? pick(r) : undefined;
    if (val === "inherit-parent" || val === undefined || val === null) {
      if (!chain.length) out.add("*root*");
      else for (const x of resolve(chain[chain.length - 1], chain.slice(0, -1), state, rules, pick, memo)) out.add(x);
    } else out.add(val);
  }
  memo.set(key, out);
  return out;
}
const pickColour = (r) => tokenIn(r.decl.color);
const pickBg = (r) => { const t = tokenIn(r.decl.background); return t ? t : "inherit-parent"; };   // background:none inherits the surface
const pickSize = (r) => { const v = r.decl["font-size"] !== undefined ? pxOf(r.decl["font-size"]) : fontShorthandPx(r.decl.font); return v === null ? "inherit-parent" : v; };
const pickWeight = (r) => { const w = weightOf(r.decl["font-weight"]); return w === null ? "inherit-parent" : w; };
const memoC = new Map(), memoB = new Map(), memoS = new Map(), memoW = new Map();

/* Every attribute condition a colour or background rule can be in, applicable to this element
   when it or an ancestor carries the attribute. */
function statesFor(el, chain) {
  const s = new Set([null]);
  for (const r of COLOUR_RULES.concat(BG_RULES)) for (const comp of r.comps) for (const a of comp.attrs) {
    if (a.value === null) continue;
    if (el.attrs.includes(a.name) || chain.some((x) => x.attrs.includes(a.name))) s.add(a.name + '="' + a.value + '"');
  }
  return [...s];
}

const PAIRS = new Map();     // key → {fg, bg, kind, thr, where, n, cls: every class on the element and its ancestors}
function addPair(fg, bg, kind, thr, where, cls) {
  const k = fg + "|" + bg + "|" + kind + "|" + thr;
  if (!PAIRS.has(k)) PAIRS.set(k, { fg, bg, kind, thr, where, n: 0, cls: new Set() });
  PAIRS.get(k).n++;
  for (const c of cls || []) PAIRS.get(k).cls.add(c);
}
const usedRules = new Set();
for (const el of ELS) {
  if (el.tag === "style") continue;
  const chain = el.chain || [];
  for (const state of statesFor(el, chain)) {
    const cv = chainViews(chain);
    for (const v of views(el)) { const r = winner(COLOUR_RULES, v, cv, state); if (r) usedRules.add(r.order); const b = winner(BG_RULES, v, cv, state); if (b) usedRules.add(b.order); }
    if (!el.content && !el.icon) continue;
    const fgs = [...resolve(el, chain, state, COLOUR_RULES, pickColour, memoC)].map((x) => (x === "*root*" ? "text" : x));
    let bgs = [...resolve(el, chain, state, BG_RULES, pickBg, memoB)];
    bgs = bgs.flatMap((x) => (x === "*root*" ? [NEUTRAL] : [x]));
    const sizes = [...resolve(el, chain, state, SIZE_RULES, pickSize, memoS)].map((x) => (x === "*root*" ? BASE_PX : x));
    const weights = [...resolve(el, chain, state, WEIGHT_RULES, pickWeight, memoW)].map((x) => (x === "*root*" ? 400 : x));
    const size = Math.min(...sizes), weight = Math.min(...weights);
    const kind = el.icon ? "icon" : "text";
    const thr = el.icon ? 3.0 : (isLarge(size, weight) ? 3.0 : 4.5);
    const where = (el.tag + (el.statics.length ? "." + el.statics.join(".") : "") + (el.dynamics.length ? "{" + el.dynamics.join("|") + "}" : "")) + " line " + el.line + (state ? " [" + state + "]" : "") + (el.icon ? "" : " " + size + "px/" + weight);
    /* the classes on the element and up its chain: a button's label sits in a child span, so the
       button is found through the chain, not through the element that carries the text */
    const cls = new Set(el.statics.concat(el.dynamics));
    for (const a of chain) { a.statics.forEach((c) => cls.add(c)); a.dynamics.forEach((c) => cls.add(c)); }
    for (const fg of fgs) for (const bg of bgs) addPair(fg, bg, kind, thr, where, cls);
  }
}
/* A colour rule that no element reached still names a pairing the app can show (a class used
   only through a prop, or an element built outside JSX). It is tested against its own
   background if the rule sets one, otherwise against every neutral surface. A surface rule
   that no element reached and that sizes text (font-size) is a text surface for --text. */
for (const r of COLOUR_RULES) {
  if (usedRules.has(r.order)) continue;
  const fg = tokenIn(r.decl.color);
  const own = tokenIn(r.decl.background);
  const size = pickSize(r) === "inherit-parent" ? BASE_PX : pickSize(r);
  const weight = pickWeight(r) === "inherit-parent" ? 400 : pickWeight(r);
  addPair(fg, own || NEUTRAL, "text", isLarge(size, weight) ? 3.0 : 4.5, "rule " + r.sel + " (no JSX element matched; assumed on " + (own ? "its own surface" : "every neutral surface") + ")");
}
for (const r of BG_RULES) {
  if (usedRules.has(r.order) || !tokenIn(r.decl.background)) continue;
  if (r.decl["font-size"] === undefined) continue;
  addPair("text", tokenIn(r.decl.background), "text", isLarge(pxOf(r.decl["font-size"]) || BASE_PX, 400) ? 3.0 : 4.5, "rule " + r.sel + " (surface with sized text, no JSX element matched)");
}

/* ================================================================== audit_contrast */
console.log("audit_contrast");
const TOKEN_NAMES = (() => { const m = /const TOKENS = \[([^\]]*)\]/.exec(src); return m ? m[1].split(",").map((s) => s.trim().replace(/^"--|"$/g, "")).filter(Boolean) : []; })();
const TOK = {};
for (const nm of TOKEN_NAMES) { try { TOK[nm] = tokenColour(nm); } catch (e) { /* reported below */ } }
const NEED = ["bg", "bg2", "bg3", "text", "dim", "mute"];
ok("audit_contrast · the colour tokens were read from " + path.relative(ROOT, SRC) + " with build.cjs's reader",
  Object.keys(TOK).length > 0 && NEED.every((n) => /^#[0-9a-f]{6}$/.test(TOK[n] || "")) && TOKEN_NAMES.length === Object.keys(TOK).length,
  Object.keys(TOK).length + " of " + TOKEN_NAMES.length + " tokens: " + NEED.map((n) => "--" + n + " " + (TOK[n] || "missing")).join(", "));

const themeBlocks = RULES.filter((r) => r.decl["--bg"] !== undefined).length;
ok("audit_contrast · the app defines one theme (one token block); a second theme would be audited the same way",
  themeBlocks === 1, themeBlocks + " rule(s) define --bg" + (themeBlocks === 1 ? " (" + RULES.find((r) => r.decl["--bg"]).sel + ")" : ""));

const col = (n) => TOK[n] || (TOK[n] = tokenColour(n));
const surfaces = (bg) => (bg === NEUTRAL ? NEUTRAL_SURFACES : [bg]);

if (Object.keys(TOK).length) {
  /* The three numbers the contrast fix recorded, computed here from the source and never typed. */
  const muteOn = NEUTRAL_SURFACES.map((s) => contrast(col("mute"), col(s)));
  ok("audit_contrast · --mute on --bg / --bg2 / --bg3 at 11px uppercase (threshold 4.5)",
    muteOn.every((c) => c >= 4.5), muteOn.map(fmt).join(" / "));
  for (const fg of ["text", "dim"]) {
    const cs = NEUTRAL_SURFACES.map((s) => contrast(col(fg), col(s)));
    ok("audit_contrast · --" + fg + " on --bg / --bg2 / --bg3 (threshold 4.5)", cs.every((c) => c >= 4.5), cs.map(fmt).join(" / "));
  }

  /* Every derived pairing, one line per foreground token. */
  const byFg = new Map();
  for (const p of PAIRS.values()) { if (!byFg.has(p.fg)) byFg.set(p.fg, []); byFg.get(p.fg).push(p); }
  let alpha = [];
  for (const fg of [...byFg.keys()].sort()) {
    const rows = [], bad = [];
    for (const p of byFg.get(fg)) for (const s of surfaces(p.bg)) {
      if (col(fg).length !== 7 || col(s).length !== 7) { alpha.push(fg + " on " + s); continue; }
      const c = contrast(col(fg), col(s));
      rows.push("--" + s + " " + fmt(c) + (p.kind === "icon" ? " icon" : "") + " ≥" + p.thr);
      if (c < p.thr) bad.push("--" + fg + " on --" + s + " " + fmt(c) + " < " + p.thr + " (" + p.kind + ", " + p.where + ")");
    }
    ok("audit_contrast · --" + fg + " on every surface the markup puts it on", bad.length === 0,
      bad.length ? bad.join(" · ") : [...new Set(rows)].join(", "));
  }
  ok("audit_contrast · no pairing uses a token with an alpha channel (a shadow is not a text colour)", alpha.length === 0, alpha.join(", ") || "--shadow stays in box-shadow");

  /* The button classes the standard names must have produced pairings from the markup: the
     label (a child span) or the icon (.btn-sm is only ever an icon button) on the button's fill. */
  const btnClasses = ["btn", "btn-go", "btn-sm", "tabi", "sec-h", "menu-i", "reveal"];
  const btnSeen = btnClasses.filter((c) => [...PAIRS.values()].some((p) => p.cls.has(c)));
  ok("audit_contrast · button text or icon on button fills was derived for " + btnClasses.join(", "),
    btnSeen.length === btnClasses.length, "seen " + btnSeen.join(", ") + (btnSeen.length === btnClasses.length ? "" : "; missing " + btnClasses.filter((c) => !btnSeen.includes(c)).join(", ")));

  /* The alarm surfaces: whatever text lands on --pnk2 must pass, including the quiet grey the
     C2 rule promotes to --text there (--dim on --pnk2 alone measures under 4.5). */
  const onPnk2 = [...PAIRS.values()].filter((p) => p.bg === "pnk2" && p.kind === "text");
  ok("audit_contrast · every text pairing on the alarm surface --pnk2 passes (" + onPnk2.length + " pairing(s))",
    onPnk2.length > 0 && onPnk2.every((p) => contrast(col(p.fg), col("pnk2")) >= p.thr),
    onPnk2.map((p) => "--" + p.fg + " " + fmt(contrast(col(p.fg), col("pnk2")))).join(", ") + "; --dim alone would be " + fmt(contrast(col("dim"), col("pnk2"))));

  /* 1.4.11 non-text: boundaries, fills against tracks, the focus ring, the active tab border. */
  const ruleBy = (sel) => RULES.find((r) => r.sel === sel && !r.media);
  const G = [
    { sel: ".inp", prop: "border", vs: ["self", "bg", "bg2", "bg3"], why: "text-input boundary against its fill and the surfaces it sits on" },
    { sel: ".meter", prop: "border", vs: ["self"], why: "meter boundary against its track" },
    { sel: ".meter i", prop: "background", vs: [".meter"], why: "meter fill against its track" },
    { sel: ".gwbar i", prop: "background", vs: [".gwbar"], why: "gameweek progress fill against its track" },
    { sel: ".refbar i", prop: "background", vs: [".refbar"], why: "refresh bar fill against its track" },
    { sel: '.tabi[aria-current="true"]', prop: "border-color", vs: ["self", ".tabs"], why: "active tab border against the tab and the strip" },
    { sel: ".mc-root :focus-visible", prop: "outline", vs: ["bg", "bg2", "bg3"], why: "focus ring on every neutral surface" }
  ];
  for (const g of G) {
    const r = ruleBy(g.sel);
    const tok = r ? tokenIn(r.decl[g.prop]) : null;
    if (!r || !tok) { ok("audit_contrast · 1.4.11 " + g.why, false, r ? g.sel + " has no token in " + g.prop : g.sel + " rule not found"); continue; }
    const rows = [], bad = [];
    for (const v of g.vs) {
      let bgTok;
      if (v === "self") bgTok = tokenIn(r.decl.background);
      else if (v[0] === ".") { const rr = ruleBy(v); bgTok = rr ? tokenIn(rr.decl.background) : null; }
      else bgTok = v;
      if (!bgTok) { bad.push(v + ": no background token"); continue; }
      const c = contrast(col(tok), col(bgTok));
      rows.push("--" + tok + " on --" + bgTok + " " + fmt(c));
      if (c < 3.0) bad.push("--" + tok + " on --" + bgTok + " " + fmt(c) + " < 3");
    }
    ok("audit_contrast · 1.4.11 " + g.why + " (threshold 3)", bad.length === 0, bad.length ? bad.join(" · ") : rows.join(", "));
  }

  /* Coverage: every token the stylesheet uses as a text colour is a foreground somewhere in the
     pairings, and every token it uses as a surface is a background somewhere (or a track above). */
  const fgTokens = new Set(COLOUR_RULES.map((r) => tokenIn(r.decl.color)));
  const bgTokens = new Set(BG_RULES.map((r) => tokenIn(r.decl.background)).filter(Boolean));
  const fgSeen = new Set([...PAIRS.values()].map((p) => p.fg));
  const bgSeen = new Set([...PAIRS.values()].flatMap((p) => surfaces(p.bg)).concat(G.flatMap((g) => g.vs.map((v) => { if (v[0] === ".") { const rr = ruleBy(v); return rr ? tokenIn(rr.decl.background) : null; } if (v === "self") { const rr = ruleBy(g.sel); return rr ? tokenIn(rr.decl.background) : null; } return v; }))).concat(G.map((g) => { const rr = ruleBy(g.sel); return rr ? tokenIn(rr.decl[g.prop]) : null; })));
  const fgMissing = [...fgTokens].filter((t) => !fgSeen.has(t)), bgMissing = [...bgTokens].filter((t) => !bgSeen.has(t));
  ok("audit_contrast · every colour token the stylesheet uses is in a pairing (" + fgTokens.size + " text colours, " + bgTokens.size + " surfaces, " + PAIRS.size + " distinct pairings)",
    fgMissing.length === 0 && bgMissing.length === 0, (fgMissing.length ? "text colours never paired: " + fgMissing.join(", ") : "") + (bgMissing.length ? " surfaces never paired: " + bgMissing.join(", ") : ""));
}

ok("audit_contrast · the JSX walk closed every tag it opened and reached the surfaces it must see",
  pass2.leftOpen === 0 && ["tabi", "block", "err", "inp", "btn-go", "panel-k", "mhead"].every((c) => ELS.some((e) => e.statics.includes(c))) && ELS.some((e) => e.created && e.statics.includes("boundary")),
  ELS.length + " elements, " + pass2.leftOpen + " left open, slots: " + Object.keys(LOCAL).filter((k) => LOCAL[k].slot).map((k) => k + "→" + LOCAL[k].slot.map((v) => v.statics.join(".") || v.dynamics.join("|") || v.tag).join(">")).join(", "));

/* ================================================================== audit_layout */
console.log("audit_layout");

/* Part G touch floors. The numbers are the standard, not an observation; the three copies of
   the table (here, smoke.cjs, webkit.js) are held equal so none can drift on its own. */
const FLOORS = { ".btn": 38, ".btn-sm": 32, ".tabi": 52, ".sec-h": 48, ".menu-i": 44, ".inp": 40, ".row": 38 };
function floorsIn(file) {
  try { const m = /const FLOORS = (\{[^}]*\});/.exec(fs.readFileSync(path.join(ROOT, "qa", file), "utf8")); return m ? new Function("return " + m[1])() : null; } catch (e) { return null; }
}
for (const f of ["smoke.cjs", "webkit.js"]) {
  const t = floorsIn(f);
  ok("audit_layout · the touch-floor table equals the one qa/" + f + " measures with", !!t && JSON.stringify(t) === JSON.stringify(FLOORS), t ? JSON.stringify(t) : "not readable");
}
for (const cls of Object.keys(FLOORS)) {
  const r = RULES.find((x) => x.sel === cls && !x.media);
  const mh = r ? pxOf(r.decl["min-height"]) : null;
  ok("audit_layout · " + cls + " min-height ≥ " + FLOORS[cls] + "px in the base stylesheet", mh !== null && mh >= FLOORS[cls],
    r ? (mh === null ? "no min-height on " + cls : "min-height " + mh + "px") : "no rule for " + cls);
}

/* The 11px type floor, in every rule of every media query, plus font sizes set in markup props
   (the chart ticks). A floor measured in one viewport cannot see a narrower media query; a
   stylesheet scan can, and does. */
{
  let scanned = 0; const low = [];
  for (const r of RULES) {
    const vals = [];
    if (r.decl["font-size"] !== undefined) vals.push(r.decl["font-size"]);
    if (r.decl.font !== undefined) { const m = /(\d+(?:\.\d+)?(?:px|em|rem|pt|%))\s*(?:\/|\s)/.exec(r.decl.font); if (m) vals.push(m[1]); }
    for (const v of vals) {
      if (/^inherit$/i.test(v)) continue;
      scanned++;
      const px = pxOf(v);
      if (px === null) low.push(r.sel + (r.media ? " @media " + r.media : "") + ": font-size " + v + " (unit not understood)");
      else if (px < 11) low.push(r.sel + (r.media ? " @media " + r.media : "") + ": font-size " + v + " = " + px + "px");
    }
  }
  const re = /fontSize:\s*(?:"(\d+(?:\.\d+)?)(?:px)?"|(\d+(?:\.\d+)?))/g; let m;
  while ((m = re.exec(MARKUP))) { scanned++; const px = parseFloat(m[1] || m[2]); if (px < 11) low.push("markup line " + lineAt(m.index) + ": fontSize " + px); }
  ok("audit_layout · 11px type floor in every rule, every media query and every markup fontSize (" + scanned + " declarations)",
    low.length === 0, low.length ? low.join(" · ") : "smallest is 11px");
}

/* The tab strip. Part G: seven equal-width icon tabs, no horizontal scroll. The CSS does this
   with flex:1 1 0 on .tabi (equal share of the strip) and a min-width that lets every tab fit:
   count × min-width + gaps + strip padding must not exceed the viewport, at 390px with the base
   rule and at the narrower width the media query targets. */
{
  const tabs = RULES.find((r) => r.sel === ".tabs" && !r.media), tabi = RULES.find((r) => r.sel === ".tabi" && !r.media);
  const flex = tabi ? String(tabi.decl.flex || "").split(/\s+/) : [];
  ok("audit_layout · .tabi shares the strip equally (flex: 1 1 0) inside a flex .tabs",
    !!tabs && /^flex$/.test(tabs.decl.display || "") && flex.length === 3 && flex[0] === "1" && flex[1] === "1" && parseFloat(flex[2]) === 0,
    "flex " + (tabi ? tabi.decl.flex : "n/a") + ", .tabs display " + (tabs ? tabs.decl.display : "n/a"));
  const count = ((/const TABS = \[([\s\S]*?)\];/.exec(src) || ["", ""])[1].match(/\{\s*id:/g) || []).length;
  const padH = (() => { const p = (tabs && tabs.decl.padding ? tabs.decl.padding : "0").split(/\s+/).map(pxOf); if (p.some((x) => x === null)) return null; return p.length === 1 ? 2 * p[0] : 2 * p[1]; })();
  const gap = tabs ? pxOf(tabs.decl.gap || "0") : null;
  const need = (minw) => count * minw + (count - 1) * gap + padH;
  const baseMin = tabi ? pxOf(tabi.decl["min-width"]) : null;
  const narrow = RULES.find((r) => r.sel === ".tabi" && r.media && /max-width\s*:\s*(\d+)px/.test(r.media));
  const narrowW = narrow ? parseInt(/max-width\s*:\s*(\d+)px/.exec(narrow.media)[1], 10) : null;
  const narrowMin = narrow && narrow.decl["min-width"] !== undefined ? pxOf(narrow.decl["min-width"]) : baseMin;
  ok("audit_layout · " + count + " tabs fit at 390px with the base rule and at ≤" + narrowW + "px with the media rule (no horizontal scroll)",
    count === 7 && baseMin !== null && gap !== null && padH !== null && need(baseMin) <= 390 && (narrowW === null || (narrowMin !== null && need(narrowMin) <= Math.min(narrowW, 360))),
    "base " + count + "×" + baseMin + " + " + (count - 1) + "×" + gap + " + " + padH + " = " + (baseMin !== null && gap !== null && padH !== null ? need(baseMin) : "n/a") + " ≤ 390" +
    (narrowW !== null ? "; ≤" + narrowW + "px: " + count + "×" + narrowMin + " … = " + need(narrowMin) + " ≤ " + Math.min(narrowW, 360) : ""));
}

/* The header title guard. The sibling project guards its title with .hero-race{max-width}; this
   app has no .hero-race — its equivalent is the flex header: the title column takes the spare
   width with min-width:0 (so it may shrink below its content), the h1 truncates with an
   ellipsis instead of wrapping, and the button column is flex:none. That is what is asserted. */
{
  const hdr = RULES.find((r) => r.sel === ".hdr" && !r.media), l = RULES.find((r) => r.sel === ".hdr-l" && !r.media);
  const h1 = RULES.find((r) => r.sel === ".hdr h1" && !r.media), rr = RULES.find((r) => r.sel === ".hdr-r" && !r.media);
  const good = !!hdr && hdr.decl.display === "flex" && !!l && pxOf(l.decl["min-width"]) === 0 && /^1\b/.test(l.decl.flex || "") &&
    !!h1 && h1.decl["white-space"] === "nowrap" && h1.decl.overflow === "hidden" && h1.decl["text-overflow"] === "ellipsis" && !!rr && rr.decl.flex === "none";
  ok("audit_layout · header title cannot wrap or push the buttons at 390px (.hdr-l min-width:0 + .hdr h1 ellipsis + .hdr-r flex:none)", good,
    ".hdr " + (hdr ? hdr.decl.display : "missing") + "; .hdr-l flex " + (l ? l.decl.flex + " min-width " + l.decl["min-width"] : "missing") +
    "; .hdr h1 " + (h1 ? [h1.decl["white-space"], h1.decl.overflow, h1.decl["text-overflow"]].join("/") : "missing") + "; .hdr-r flex " + (rr ? rr.decl.flex : "missing"));
}

/* Hex literals: only inside the token block (the first declarations of .mc-root). Everything
   else — the rest of the stylesheet and all of the JSX — addresses colour through var(--token). */
{
  const HEX = /#[0-9a-fA-F]{3,8}\b/g;
  const tokStart = STYLE.indexOf(".mc-root{"), tokEnd = tokStart < 0 ? -1 : STYLE.indexOf("}", tokStart);
  const tokenBlock = tokStart < 0 ? "" : STYLE.slice(tokStart, tokEnd);
  const restStyle = tokStart < 0 ? STYLE : STYLE.slice(0, tokStart) + STYLE.slice(tokEnd);
  const inTokens = (tokenBlock.match(HEX) || []).length;
  const offenders = [];
  let m;
  while ((m = HEX.exec(restStyle))) offenders.push("stylesheet outside the token block: " + m[0]);
  const jsx = src.slice(0, styleStart) + blank(src.slice(styleStart, styleEnd + 2)) + src.slice(styleEnd + 2);
  while ((m = HEX.exec(jsx))) offenders.push("line " + jsx.slice(0, m.index).split("\n").length + ": " + m[0]);
  ok("audit_layout · 0 hex colour literals outside the token block (Part G)", offenders.length === 0,
    offenders.length ? offenders.join(" · ") : inTokens + " hex values, all inside .mc-root{…} at line " + (styleLine + 1));
  ok("audit_layout · the token block defines exactly the TOKENS list (" + TOKEN_NAMES.length + " names) and nothing else in hex",
    TOKEN_NAMES.length > 0 && inTokens === TOKEN_NAMES.length && TOKEN_NAMES.every((n) => new RegExp("--" + n + "\\s*:\\s*#").test(tokenBlock)),
    inTokens + " hex definitions for " + TOKEN_NAMES.length + " names");
}

console.log("SUITE visual " + pass + "/" + (pass + fail));
process.exit(fail ? 1 : 0);

/*
 * qa/tdz_check.cjs — temporal-dead-zone gate (CLAUDE.md H1, ERRORS.md E-013).
 *
 * Two independent checks on one file:
 *   1. STATIC  — a comment- and string-aware scan for a const/let binding that is read
 *                earlier in the same scope than its declaration. Comment-blind scanning
 *                was E-013 (false positives for a whole session), so comments, strings,
 *                template literals and regex literals are blanked (line numbers kept)
 *                before any identifier is looked at. References that sit inside a nested
 *                *function* are never flagged: a hoisted function may legally close over
 *                a const declared later, as long as it is called later.
 *   2. DYNAMIC — the file is evaluated with const/let semantics preserved. An esbuild
 *                CommonJS transform rewrites const → var and hides TDZ entirely, so the
 *                source is wrapped in a plain function body (block scoping and TDZ both
 *                apply there) and run. A ReferenceError of the form
 *                "Cannot access 'X' before initialization" is a TDZ finding.
 *
 * Usage:  node qa/tdz_check.cjs <file> [<file> …]      (default: src/engine.js)
 * Output: "TDZ CLEAN <file>" per file and "TDZ CLEAN" overall, or the offending
 *         identifiers with line numbers. Exit 1 on any finding.
 * A file that does not exist is skipped with a message (exit 0) — app/FPL_Mission_Control.jsx
 * is assembled by build.cjs and may legitimately not be there yet.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------- 1. blanking pass

const KEYWORDS_BEFORE_REGEX = ["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"];

// Replace every comment, string, template and regex literal with spaces, keeping
// newlines (so line numbers survive) and keeping the file length (so indices match).
function blank(src) {
  const out = new Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i];
  const keep = function (from, to) {
    for (let i = from; i < to && i < src.length; i++) out[i] = src[i] === "\n" ? "\n" : " ";
  };
  let i = 0;
  let prevSignificant = "";           // last non-space character kept as code
  let prevWord = "";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      let j = i;
      while (j < src.length && src[j] !== "\n") j++;
      keep(i, j); i = j; continue;
    }
    if (c === "/" && d === "*") {
      let j = i + 2;
      while (j < src.length && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j = Math.min(src.length, j + 2);
      keep(i, j); i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        if (src[j] === "\n") break;            // unterminated: stop at the line end
        j++;
      }
      keep(i, j); i = j; prevSignificant = "?"; prevWord = ""; continue;
    }
    if (c === "`") {
      // Template literal: blank the text, but keep ${ … } expressions as code.
      let j = i + 1;
      out[i] = " ";
      while (j < src.length) {
        if (src[j] === "\\") { keep(j, j + 2); j += 2; continue; }
        if (src[j] === "`") { out[j] = " "; j++; break; }
        if (src[j] === "$" && src[j + 1] === "{") {
          out[j] = " "; out[j + 1] = " ";
          let depth = 1; let k = j + 2;
          while (k < src.length && depth > 0) {
            if (src[k] === "{") depth++;
            else if (src[k] === "}") { depth--; if (depth === 0) { out[k] = " "; k++; break; } }
            else if (src[k] === '"' || src[k] === "'" || src[k] === "`") {
              const q = src[k]; let m = k + 1;
              while (m < src.length) { if (src[m] === "\\") { m += 2; continue; } if (src[m] === q) { m++; break; } m++; }
              keep(k, m); k = m; continue;
            }
            k++;
          }
          j = k; continue;
        }
        out[j] = src[j] === "\n" ? "\n" : " ";
        j++;
      }
      i = j; prevSignificant = "?"; prevWord = ""; continue;
    }
    if (c === "/") {
      // Regex literal or a division? Decide from the previous significant token.
      const regexOk = prevSignificant === "" || "(,=:[!&|?{};+-*%~^<>".indexOf(prevSignificant) >= 0 || KEYWORDS_BEFORE_REGEX.indexOf(prevWord) >= 0;
      if (regexOk) {
        let j = i + 1; let inClass = false; let closed = false;
        while (j < src.length) {
          const e = src[j];
          if (e === "\\") { j += 2; continue; }
          if (e === "\n") break;
          if (e === "[") inClass = true;
          else if (e === "]") inClass = false;
          else if (e === "/" && !inClass) { j++; closed = true; break; }
          j++;
        }
        if (closed) {
          while (j < src.length && /[a-z]/.test(src[j])) j++;        // flags
          keep(i, j); i = j; prevSignificant = "?"; prevWord = ""; continue;
        }
      }
    }
    if (!/\s/.test(c)) {
      prevSignificant = c;
      if (/[A-Za-z_$]/.test(c)) {
        let j = i;
        while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
        prevWord = src.slice(i, j);
        for (let k = i; k < j; k++) out[k] = src[k];
        prevSignificant = src[j - 1];
        i = j;
        continue;
      }
      prevWord = "";
    }
    i++;
  }
  return out.join("");
}

function lineOf(src, index) {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") n++;
  return n;
}

// ---------------------------------------------------------------- 2. scope map

// Walk the blanked source once, tracking brace depth and whether each open brace is a
// function/class body (a "function boundary"). Returns, for every index, the depth and
// the index of the nearest enclosing function boundary.
function scopeMap(code) {
  const depthAt = new Int32Array(code.length);
  const fnAt = new Int32Array(code.length);          // index of the brace that opened the nearest function body, -1 for module scope
  const stack = [];                                  // {open, isFn}
  let fnTop = -1;
  const fnStack = [-1];
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "{") {
      const isFn = openIsFunctionBody(code, i);
      stack.push({ open: i, isFn: isFn });
      if (isFn) { fnStack.push(i); fnTop = i; }
      depthAt[i] = stack.length;
      fnAt[i] = fnTop;
      continue;
    }
    if (c === "}") {
      depthAt[i] = stack.length;
      fnAt[i] = fnTop;
      const top = stack.pop();
      if (top && top.isFn) { fnStack.pop(); fnTop = fnStack[fnStack.length - 1]; }
      continue;
    }
    depthAt[i] = stack.length;
    fnAt[i] = fnTop;
  }
  return { depthAt: depthAt, fnAt: fnAt };
}

// Is the "{" at index i the body of a function, arrow, class, or method?
function openIsFunctionBody(code, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(code[j])) j--;
  if (j < 0) return false;
  // arrow: ... => {
  if (code[j] === ">" && j > 0 && code[j - 1] === "=") return true;
  // class body: class X { , class X extends Y {
  // function body / method body: ) {
  if (code[j] === ")") {
    // walk back over the parameter list to the token before "("
    let depth = 0; let k = j;
    for (; k >= 0; k--) {
      if (code[k] === ")") depth++;
      else if (code[k] === "(") { depth--; if (depth === 0) break; }
    }
    if (k < 0) return false;
    let m = k - 1;
    while (m >= 0 && /\s/.test(code[m])) m--;
    if (m < 0) return false;
    // ")" preceded by an identifier or "function" → a call's argument list is not a body;
    // but "foo() {" inside a class/object and "function foo() {" and "if (…) {" all end in ")".
    // Distinguish the control-flow keywords, which are NOT function bodies.
    let e = m;
    while (e >= 0 && /[A-Za-z0-9_$]/.test(code[e])) e--;
    const word = code.slice(e + 1, m + 1);
    if (["if", "for", "while", "switch", "catch", "with"].indexOf(word) >= 0) return false;
    return true;
  }
  let e = j;
  while (e >= 0 && /[A-Za-z0-9_$]/.test(code[e])) e--;
  const word = code.slice(e + 1, j + 1);
  if (word === "class" || word === "else" || word === "do" || word === "try" || word === "finally") return word === "class";
  return false;
}

// ---------------------------------------------------------------- 3. static scan

const RESERVED = {
  "if": 1, "for": 1, "while": 1, "return": 1, "function": 1, "var": 1, "let": 1, "const": 1, "new": 1, "typeof": 1,
  "this": 1, "true": 1, "false": 1, "null": 1, "undefined": 1, "in": 1, "of": 1, "else": 1, "switch": 1, "case": 1,
  "break": 1, "continue": 1, "do": 1, "try": 1, "catch": 1, "finally": 1, "throw": 1, "class": 1, "extends": 1,
  "super": 1, "import": 1, "export": 1, "default": 1, "await": 1, "async": 1, "yield": 1, "delete": 1, "void": 1,
  "instanceof": 1, "with": 1, "debugger": 1
};

// Split a piece of code on a separator that sits at bracket depth 0.
function splitTopLevel(s, sep) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === sep && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out;
}

// The identifiers a binding pattern actually binds. "const el = ctx.els[id]" binds el and
// nothing else — collecting the right-hand side was the false-positive engine in the first
// draft of this file, exactly the E-013 failure mode.
function patternNames(pat) {
  const p = String(pat).trim();
  if (!p) return [];
  if (p[0] !== "{" && p[0] !== "[") {
    const m = /^\.{0,3}\s*([A-Za-z_$][A-Za-z0-9_$]*)/.exec(p);
    return m && !RESERVED[m[1]] ? [m[1]] : [];
  }
  const inner = p.slice(1, p.length - 1);
  const out = [];
  splitTopLevel(inner, ",").forEach(function (part) {
    let q = splitTopLevel(part, "=")[0].trim();          // drop any default value
    if (!q) return;
    q = q.replace(/^\.\.\./, "").trim();
    if (q[0] === "{" || q[0] === "[") { patternNames(q).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); return; }
    const colon = splitTopLevel(q, ":");
    if (colon.length > 1) { patternNames(colon.slice(1).join(":")).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); return; }
    const m = /^([A-Za-z_$][A-Za-z0-9_$]*)/.exec(q);
    if (m && !RESERVED[m[1]] && out.indexOf(m[1]) < 0) out.push(m[1]);
  });
  return out;
}

function boundNames(code, from, to) {
  const names = [];
  splitTopLevel(code.slice(from, to), ",").forEach(function (decl) {
    patternNames(splitTopLevel(decl, "=")[0]).forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
  });
  return names;
}

// Concise arrow bodies have no braces, so scopeMap cannot see them: "const Box = () => <div>{LABEL}</div>"
// legitimately reads a const declared later. Record each concise body's span so those
// references are treated as nested-function references, exactly like a braced body.
function conciseArrowRanges(code) {
  const out = [];
  for (let i = 0; i + 1 < code.length; i++) {
    if (code[i] !== "=" || code[i + 1] !== ">") continue;
    let j = i + 2;
    while (j < code.length && /\s/.test(code[j])) j++;
    if (j >= code.length || code[j] === "{") continue;        // braced body: scopeMap has it already
    let depth = 0, k = j;
    for (; k < code.length; k++) {
      const c = code[k];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; }
      else if ((c === "," || c === ";") && depth === 0) break;
    }
    out.push([j, k]);
  }
  return out;
}

function staticScan(src) {
  const code = blank(src);
  const map = scopeMap(code);
  const concise = conciseArrowRanges(code);
  const findings = [];
  const declRe = /(^|[^A-Za-z0-9_$.])(const|let)\s+/g;
  let m;
  while ((m = declRe.exec(code)) !== null) {
    const kw = m[2];
    const declStart = m.index + m[1].length;
    const listStart = declStart + kw.length;
    // End of the declarator list: the first ";" or newline at the same brace depth,
    // ignoring nested (), [], {}.
    let i = listStart;
    let par = 0, sq = 0, cur = 0;
    while (i < code.length) {
      const c = code[i];
      if (c === "(") par++;
      else if (c === ")") { if (par === 0) break; par--; }          // for (const x of y) — stop at the header's ")"
      else if (c === "[") sq++;
      else if (c === "]") { if (sq === 0) break; sq--; }
      else if (c === "{") cur++;
      else if (c === "}") { if (cur === 0) break; cur--; }
      else if (c === ";" && par === 0 && sq === 0 && cur === 0) break;
      i++;
    }
    const listEnd = i;
    const names = boundNames(code, listStart, listEnd);
    if (!names.length) continue;
    const depth = map.depthAt[declStart];
    const fn = map.fnAt[declStart];
    // Scope start = the opening brace of the enclosing block, or 0 at module scope.
    let scopeStart = 0;
    if (depth > 0) {
      let d = depth, j = declStart;
      while (j >= 0) {
        if (code[j] === "}") d++;
        else if (code[j] === "{") { d--; if (d < depth) { scopeStart = j + 1; break; } }
        j--;
      }
    }
    names.forEach(function (name) {
      const useRe = new RegExp("[A-Za-z0-9_$.]?\\b" + name.replace(/\$/g, "\\$") + "\\b", "g");
      const region = code.slice(scopeStart, declStart);
      let u;
      useRe.lastIndex = 0;
      while ((u = useRe.exec(region)) !== null) {
        const at = scopeStart + u.index + (u[0].length - name.length);
        const lead = u[0].length > name.length ? u[0][0] : "";
        if (lead === "." || /[A-Za-z0-9_$]/.test(lead)) continue;        // member access / part of a longer word
        // Skip its own re-declaration keyword forms and property keys "name:".
        const after = code.slice(at + name.length, at + name.length + 2);
        if (/^\s*:/.test(after)) continue;
        // A reference inside a nested function body is legal (called later).
        if (map.fnAt[at] !== fn) continue;
        if (concise.some(function (r) { return at >= r[0] && at < r[1] && !(declStart >= r[0] && declStart < r[1]); })) continue;
        // A reference inside a nested block that is not a function still resolves outward → TDZ.
        findings.push({
          name: name,
          useLine: lineOf(src, at),
          declLine: lineOf(src, declStart),
          kind: kw
        });
        break;
      }
    });
  }
  return findings;
}

// ---------------------------------------------------------------- 4. dynamic check

function stripModuleSyntax(src) {
  // Remove import statements and export keywords so the source can run inside a function
  // body, WITHOUT touching const/let (that is the whole point — esbuild's CJS transform
  // rewrites const → var and hides TDZ).
  let s = src;
  s = s.replace(/^\s*import\s+[^;\n]*?from\s*["'][^"']+["']\s*;?/gm, "");
  s = s.replace(/^\s*import\s*["'][^"']+["']\s*;?/gm, "");
  s = s.replace(/^\s*export\s+default\s+/gm, "var __default__ = ");
  s = s.replace(/^\s*export\s+(?=(const|let|var|function|class)\b)/gm, "");
  s = s.replace(/^\s*export\s*\{[^}]*\}\s*;?/gm, "");
  return s;
}

function toPlainJs(file, src) {
  if (!/\.jsx$/.test(file)) return src;
  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch (e) {
    return null;
  }
  try {
    // format is deliberately left alone: no CJS rewrite, so const stays const.
    return esbuild.transformSync(src, { loader: "jsx", jsx: "automatic", target: "esnext" }).code;
  } catch (e) {
    return null;
  }
}

function dynamicCheck(file, src) {
  const js = toPlainJs(file, src);
  if (js === null) return { ran: false, note: "could not transform JSX for the dynamic pass", findings: [] };
  const body = stripModuleSyntax(js);
  const stubObj = new Proxy(function () {}, {
    get: function (t, k) { return k === Symbol.toPrimitive || k === "toString" ? function () { return "stub"; } : stubObj; },
    apply: function () { return stubObj; },
    construct: function () { return stubObj; },
    has: function () { return true; }
  });
  const modStub = { exports: {} };
  const valueFor = function (n) {
    if (n === "module") return modStub;
    if (n === "exports") return modStub.exports;
    if (n === "require") return function () { return stubObj; };
    if (n === "fetch") return function () { return Promise.resolve(stubObj); };
    return stubObj;
  };
  // Start from the names a bundled artefact normally has, then learn the rest: every
  // "X is not defined" adds X as a stub and the body is re-run, so the evaluation walks
  // the whole module instead of stopping on the first stripped import.
  const names = ["React", "ReactDOM", "jsx", "jsxs", "Fragment", "window", "document", "localStorage", "navigator", "fetch", "recharts", "module", "exports", "require"];
  for (let attempt = 0; attempt < 80; attempt++) {
    let fn;
    try {
      fn = new Function(names.join(","), '"use strict";\n' + body + "\n");
    } catch (e) {
      return { ran: false, note: "could not compile for the dynamic pass: " + String(e && e.message ? e.message : e).split("\n")[0], findings: [] };
    }
    try {
      fn.apply({}, names.map(valueFor));
      return { ran: true, note: "evaluated with const/let semantics intact" + (names.length > 14 ? " (" + (names.length - 14) + " stripped import bindings stubbed)" : ""), findings: [] };
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      const tdz = /Cannot access '([^']+)' before initialization/.exec(msg);
      if (tdz) return { ran: true, note: "", findings: [{ name: tdz[1], message: msg }] };
      const undef = /^([A-Za-z_$][A-Za-z0-9_$]*) is not defined$/.exec(msg);
      if (undef && names.indexOf(undef[1]) < 0) { names.push(undef[1]); continue; }
      return { ran: true, note: "no TDZ error; evaluation stopped on an unrelated error (" + msg.split("\n")[0] + ")", findings: [] };
    }
  }
  return { ran: true, note: "no TDZ error; the dynamic pass ran out of stub retries", findings: [] };
}

// ---------------------------------------------------------------- main

function checkFile(file) {
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  let rel = path.relative(ROOT, abs) || file;
  if (rel.indexOf("..") === 0) rel = file;
  if (!fs.existsSync(abs)) {
    console.log("SKIP " + rel + " — file does not exist yet (nothing to check)");
    return { skipped: true, findings: [] };
  }
  const src = fs.readFileSync(abs, "utf8");
  const stat = staticScan(src);
  const dyn = dynamicCheck(abs, src);
  const findings = [];
  stat.forEach(function (f) {
    findings.push(rel + ": " + f.name + " read on line " + f.useLine + " before its " + f.kind + " declaration on line " + f.declLine + " (static)");
  });
  dyn.findings.forEach(function (f) {
    findings.push(rel + ": " + f.name + " — " + f.message + " (dynamic)");
  });
  if (findings.length) {
    findings.forEach(function (f) { console.log("TDZ " + f); });
    return { skipped: false, findings: findings };
  }
  console.log("TDZ CLEAN " + rel + " (static scan + dynamic pass" + (dyn.ran ? "" : ", dynamic pass not run: " + dyn.note) + (dyn.ran && dyn.note ? "; " + dyn.note : "") + ")");
  return { skipped: false, findings: [] };
}

function main() {
  const args = process.argv.slice(2).filter(function (a) { return a && a[0] !== "-"; });
  const files = args.length ? args : [path.join(ROOT, "src", "engine.js")];
  let all = [];
  files.forEach(function (f) { all = all.concat(checkFile(f).findings); });
  if (all.length) {
    console.log("TDZ FAIL — " + all.length + " finding" + (all.length === 1 ? "" : "s"));
    process.exit(1);
  }
  console.log("TDZ CLEAN");
}

if (require.main === module) main();

module.exports = { blank: blank, staticScan: staticScan, dynamicCheck: dynamicCheck, checkFile: checkFile };

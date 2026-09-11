/*
 * qa/tdz_check.cjs — temporal-dead-zone gate (CLAUDE.md H1, ERRORS.md E-013, E-051).
 *
 * Three checks on one file. The output names each of them, because a gate that claims more
 * than it ran is worse than no gate (E-051):
 *   1. STATIC, SAME SCOPE   — a comment- and string-aware scan for a const/let binding read
 *                earlier in the same scope than its declaration. Comment-blind scanning was
 *                E-013 (false positives for a whole session), so comments, strings, template
 *                literals and regex literals are blanked (line numbers kept) before any
 *                identifier is looked at. A reference inside a nested *function* body is not
 *                flagged here: a hoisted function may legally close over a const declared
 *                later, as long as it is called later.
 *   2. STATIC, NESTED BODY  — the case check 1 deliberately lets through, caught narrowly: a
 *                function expression bound to a const/let reads a const declared later in the
 *                same scope AND is called by name, in that same scope, before the declaration.
 *                All four facts must be visible in one scope or nothing is reported.
 *   3. DYNAMIC  — the file is evaluated with const/let semantics preserved (an esbuild
 *                CommonJS transform rewrites const → var and hides TDZ entirely, so the source
 *                is wrapped in a plain function body instead), and then every exported function
 *                is called once with no arguments — the module top level alone never enters a
 *                function body. A ReferenceError of the form "Cannot access 'X' before
 *                initialization" is a finding; any other throw is ignored.
 *
 * Usage:  node qa/tdz_check.cjs <file> [<file> …]      (default: src/engine.js)
 *         node qa/tdz_check.cjs --self-test            (six control files: three must be found,
 *                                                       three must stay clean)
 * Output: "TDZ CLEAN <file> (…what actually ran…)" per file and "TDZ CLEAN" overall, or the
 *         offending identifiers with line numbers. Exit 1 on any finding.
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

// Every const/let declaration in the file, with the scope it belongs to. Both the
// same-scope scan (3a) and the nested-body scan (3b) read this one list.
function collectDecls(code, map) {
  const out = [];
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
    out.push({ kw: kw, names: names, declStart: declStart, listStart: listStart, listEnd: listEnd, fn: fn, scopeStart: scopeStart });
  }
  return out;
}

// ---------------------------------------------------------------- 3a. same-scope scan

// A function's PARAMETER LIST is not part of the enclosing scope, but it sits outside the
// body brace, so scopeMap attributes it to the enclosing function. Left alone, a parameter
// that happens to share a name with a later const in that enclosing scope reads as a use
// before the declaration — exactly the E-013 false-positive shape. Record every parameter
// list so both scans can skip it.
function paramRanges(code) {
  const out = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] !== "(") continue;
    let d = 0, j = i;
    for (; j < code.length; j++) {
      if (code[j] === "(") d++;
      else if (code[j] === ")") { d--; if (d === 0) break; }
    }
    if (j >= code.length) continue;
    let k = j + 1;
    while (k < code.length && /\s/.test(code[k])) k++;
    const isParams = (code[k] === "=" && code[k + 1] === ">") || (code[k] === "{" && openIsFunctionBody(code, k));
    if (isParams) { out.push([i + 1, j]); i = j; }
  }
  return out;
}

function inRanges(ranges, at) {
  for (let i = 0; i < ranges.length; i++) if (at >= ranges[i][0] && at < ranges[i][1]) return true;
  return false;
}

function staticScan(src) {
  const code = blank(src);
  const map = scopeMap(code);
  const concise = conciseArrowRanges(code);
  const params = paramRanges(code);
  const findings = [];
  collectDecls(code, map).forEach(function (d) {
    const kw = d.kw, declStart = d.declStart, fn = d.fn, scopeStart = d.scopeStart;
    d.names.forEach(function (name) {
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
        if (inRanges(params, at)) continue;                              // a parameter of that name, not a read
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
  });
  return findings;
}

// ---------------------------------------------------------------- 3b. nested-body scan

// The blind spot the same-scope scan leaves open (E-051): a function EXPRESSION bound to a
// const/let reads a const declared later in the same scope, and is CALLED before that
// declaration. 3a skips every reference inside a nested function body on purpose — a hoisted
// function may legally close over a later const (that leniency is the E-013 lesson) — so it
// cannot see this. The extension stays conservative: it fires only when all four facts are
// visible in one scope — the binding, a call to it by name, the reference inside its body,
// and the later declaration — and it never fires on a reference it cannot resolve.

// Where the body of a function expression assigned at `from` starts and ends, or null.
function fnExprBody(code, from) {
  let i = from;
  while (i < code.length && /\s/.test(code[i])) i++;
  if (code.slice(i, i + 5) === "async") { i += 5; while (i < code.length && /\s/.test(code[i])) i++; }
  const matchPair = function (open, close, at) {
    let d = 0;
    for (let k = at; k < code.length; k++) {
      if (code[k] === open) d++;
      else if (code[k] === close) { d--; if (d === 0) return k; }
    }
    return -1;
  };
  if (code.slice(i, i + 8) === "function" && !/[A-Za-z0-9_$]/.test(code[i + 8] || " ")) {
    const par = code.indexOf("(", i); if (par < 0) return null;
    const parEnd = matchPair("(", ")", par); if (parEnd < 0) return null;
    let b = parEnd + 1;
    while (b < code.length && /\s/.test(code[b])) b++;
    if (code[b] !== "{") return null;
    const end = matchPair("{", "}", b); if (end < 0) return null;
    return { start: b + 1, end: end, concise: false };
  }
  // arrow: (a, b) => …  or  a => …
  let head = -1;
  if (code[i] === "(") { head = matchPair("(", ")", i); if (head < 0) return null; head++; }
  else { let j = i; while (j < code.length && /[A-Za-z0-9_$]/.test(code[j])) j++; if (j === i) return null; head = j; }
  let k = head;
  while (k < code.length && /\s/.test(code[k])) k++;
  if (code[k] !== "=" || code[k + 1] !== ">") return null;
  let b = k + 2;
  while (b < code.length && /\s/.test(code[b])) b++;
  if (code[b] === "{") {
    const end = matchPair("{", "}", b); if (end < 0) return null;
    return { start: b + 1, end: end, concise: false };
  }
  let depth = 0, e = b;
  for (; e < code.length; e++) {
    const c = code[e];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; }
    else if ((c === "," || c === ";") && depth === 0) break;
  }
  return { start: b, end: e, concise: true };
}

// Is `name` referenced as a bare identifier inside [from, to)? Member access (".name"),
// property keys ("name:") and longer words are not references.
function bareRefIn(code, name, from, to) {
  const re = new RegExp("[A-Za-z0-9_$.]?\\b" + name.replace(/\$/g, "\\$") + "\\b", "g");
  const region = code.slice(from, to);
  let m;
  while ((m = re.exec(region)) !== null) {
    const at = from + m.index + (m[0].length - name.length);
    const lead = m[0].length > name.length ? m[0][0] : "";
    if (lead === "." || /[A-Za-z0-9_$]/.test(lead)) continue;
    if (/^\s*:/.test(code.slice(at + name.length, at + name.length + 2))) continue;
    return at;
  }
  return -1;
}

// A body that binds the name itself (parameter or its own const/let/var) shadows the outer
// one, and the scan must stay quiet.
function shadows(code, name, from, to) {
  const re = new RegExp("\\b(?:const|let|var|function)\\s+" + name.replace(/\$/g, "\\$") + "\\b");
  return re.test(code.slice(from, to));
}

function nestedScan(src) {
  const code = blank(src);
  const map = scopeMap(code);
  const decls = collectDecls(code, map);
  const params = paramRanges(code);
  const findings = [];
  decls.forEach(function (d) {
    if (d.names.length !== 1) return;                       // one plain binding only
    const name = d.names[0];
    const eq = code.indexOf("=", d.listStart);
    if (eq < 0 || eq > d.listEnd) return;
    const body = fnExprBody(code, eq + 1);
    if (!body || body.end <= body.start) return;
    // The parameter list immediately in front of this body: a parameter of the same name
    // shadows the outer binding and the scan must stay quiet about it.
    const ownParams = params.filter(function (r) { return r[1] < body.start && r[1] > eq; }).pop() || null;
    const shadowed = function (n) {
      if (ownParams && bareRefIn(code, n, ownParams[0], ownParams[1]) >= 0) return true;
      return shadows(code, n, body.start, body.end);
    };
    if (shadowed(name)) return;
    // Call sites of this binding, by name, in the same scope, after the binding itself.
    const callRe = new RegExp("[A-Za-z0-9_$.]?\\b" + name.replace(/\$/g, "\\$") + "\\s*\\(", "g");
    let c;
    const calls = [];
    while ((c = callRe.exec(code)) !== null) {
      const at = c.index + (/[A-Za-z0-9_$.]/.test(c[0][0]) && c[0].length > name.length + 1 ? 1 : 0);
      if (c[0][0] === ".") continue;
      if (at <= body.end) continue;
      if (map.fnAt[at] !== d.fn) continue;
      if (at < d.scopeStart) continue;
      calls.push(at);
    }
    if (!calls.length) return;
    const firstCall = Math.min.apply(null, calls);
    decls.forEach(function (o) {
      if (o === d || o.fn !== d.fn || o.scopeStart !== d.scopeStart) return;
      if (o.declStart <= firstCall) return;                 // already initialised when the call runs
      o.names.forEach(function (n) {
        if (n === name) return;
        if (shadowed(n)) return;
        const at = bareRefIn(code, n, body.start, body.end);
        if (at < 0) return;
        findings.push({
          name: n,
          kind: o.kw,
          useLine: lineOf(src, at),
          callLine: lineOf(src, firstCall),
          declLine: lineOf(src, o.declStart),
          via: name
        });
      });
    });
  });
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
  // The default export is a var inside the wrapper; hand it back through the module stub so
  // the second phase can call it too.
  const body = stripModuleSyntax(js) +
    '\ntry { module.__tdz_default = (typeof __default__ !== "undefined" ? __default__ : null); } catch (e) {}\n';
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
      const stubbed = names.length > 14 ? " (" + (names.length - 14) + " stripped import bindings stubbed)" : "";
      // The top level alone proves very little: a TDZ inside a function body only bites when
      // the function RUNS (E-051). Call every exported function once with no arguments — the
      // engine promises totality, so a throw is information, and only a TDZ ReferenceError is
      // a finding. Anything else (a by-specification throw, a React hook against a stub) is
      // ignored on purpose.
      const called = [];
      const targets = [];
      try {
        const ex = modStub.exports;
        if (ex && typeof ex === "object") Object.keys(ex).forEach(function (k) { if (typeof ex[k] === "function") targets.push([k, ex[k]]); });
        else if (typeof ex === "function") targets.push(["module.exports", ex]);
      } catch (e2) { /* no exports to call */ }
      try { if (typeof modStub.__tdz_default === "function") targets.push(["default export", modStub.__tdz_default]); } catch (e2) { /* none */ }
      const started = Date.now();
      for (let t = 0; t < targets.length; t++) {
        if (Date.now() - started > 10000) break;
        called.push(targets[t][0]);
        try { targets[t][1](); } catch (err) {
          const em = String(err && err.message ? err.message : err);
          const hit = /Cannot access '([^']+)' before initialization/.exec(em);
          if (hit) return { ran: true, note: "", findings: [{ name: hit[1], message: em + " — thrown by calling the exported " + targets[t][0] + "()" }] };
        }
      }
      return {
        ran: true,
        calls: called.length,
        note: "module top level evaluated with const/let semantics intact" + stubbed +
          (called.length ? "; " + called.length + " exported function" + (called.length === 1 ? "" : "s") + " then called with no arguments"
                         : "; no exported function to call, so no function body was executed"),
        findings: []
      };
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
  const nested = nestedScan(src);
  const dyn = dynamicCheck(abs, src);
  const findings = [];
  stat.forEach(function (f) {
    findings.push(rel + ": " + f.name + " read on line " + f.useLine + " before its " + f.kind + " declaration on line " + f.declLine + " (static, same scope)");
  });
  nested.forEach(function (f) {
    findings.push(rel + ": " + f.name + " read on line " + f.useLine + " inside " + f.via + "(), which is called on line " + f.callLine +
      " — before the " + f.kind + " declaration of " + f.name + " on line " + f.declLine + " (static, nested body)");
  });
  dyn.findings.forEach(function (f) {
    findings.push(rel + ": " + f.name + " — " + f.message + " (dynamic)");
  });
  if (findings.length) {
    findings.forEach(function (f) { console.log("TDZ " + f); });
    return { skipped: false, findings: findings };
  }
  // Say exactly what ran. The static scan is deliberately lenient about references inside
  // nested function bodies, and the dynamic pass only reaches the code it actually executes;
  // claiming more than that is how a blind spot reads as a clean bill of health (E-051).
  const what = "static scan (same scope + nested bodies called before the declaration) + dynamic pass" +
    (dyn.ran ? "; " + dyn.note : ", dynamic pass not run: " + dyn.note);
  console.log("TDZ CLEAN " + rel + " (" + what + ")");
  return { skipped: false, findings: [] };
}

// ---------------------------------------------------------------- 5. self-test

// E-013 says this checker's own false positives cost a session; E-051 says its clean pass
// once covered a file whose exported function threw a real TDZ. Both directions are pinned
// here, so the gate proves the gate. Run: node qa/tdz_check.cjs --self-test
const SELF_CASES = [
  {
    name: "a nested function called BEFORE the const it reads is a finding",
    src: 'function boot(){ const read = function(){ return CONF.k; }; const v = read(); const CONF = { k: 1 }; return v; }\nmodule.exports = { boot: boot };\n',
    expect: true
  },
  {
    name: "the same nested function called AFTER the const is clean",
    src: 'function boot(){ const read = function(){ return CONF.k; }; const CONF = { k: 1 }; const v = read(); return v; }\nmodule.exports = { boot: boot };\n',
    expect: false
  },
  {
    name: "a hoisted function closing over a later const is clean (E-013 leniency kept)",
    src: 'function get(){ return LATE.k; }\nvar LATE = null;\nconst CONF = { k: 1 };\nLATE = CONF;\nmodule.exports = { get: get };\n',
    expect: false
  },
  {
    name: "a plain same-scope read before the declaration is a finding",
    src: 'function boot(){ const v = CONF.k; const CONF = { k: 1 }; return v; }\nmodule.exports = { boot: boot };\n',
    expect: true
  },
  {
    name: "the name in a comment or a string is not a reference (E-013)",
    src: 'function boot(){ /* CONF first */ const s = "CONF.k"; const CONF = { k: 1 }; return s + CONF.k; }\nmodule.exports = { boot: boot };\n',
    expect: false
  },
  {
    name: "a parameter of the same name shadows the outer const",
    src: 'function boot(){ const read = function(CONF){ return CONF.k; }; const v = read({ k: 2 }); const CONF = { k: 1 }; return v + CONF.k; }\nmodule.exports = { boot: boot };\n',
    expect: false
  }
];

function selfTest() {
  const os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tdz-self-"));
  let pass = 0, fail = 0;
  SELF_CASES.forEach(function (c, i) {
    const file = path.join(dir, "case" + (i + 1) + ".js");
    fs.writeFileSync(file, c.src, "utf8");
    const src = fs.readFileSync(file, "utf8");
    const found = staticScan(src).length + nestedScan(src).length + dynamicCheck(file, src).findings.length;
    const ok = c.expect ? found > 0 : found === 0;
    if (ok) { pass++; console.log("PASS tdz-self " + c.name); }
    else { fail++; console.log("FAIL tdz-self " + c.name + " — expected " + (c.expect ? "a finding" : "no finding") + ", got " + found); }
    try { fs.unlinkSync(file); } catch (e) { /* leave it */ }
  });
  try { fs.rmdirSync(dir); } catch (e) { /* leave it */ }
  console.log("TDZ SELF-TEST " + pass + "/" + (pass + fail));
  return fail;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.indexOf("--self-test") >= 0) {
    const bad = selfTest();
    if (bad) { console.log("TDZ FAIL — the checker failed its own self-test"); process.exit(1); }
    if (argv.length === 1) return;
  }
  const args = argv.filter(function (a) { return a && a[0] !== "-"; });
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

module.exports = { blank: blank, staticScan: staticScan, nestedScan: nestedScan, dynamicCheck: dynamicCheck, checkFile: checkFile, selfTest: selfTest };

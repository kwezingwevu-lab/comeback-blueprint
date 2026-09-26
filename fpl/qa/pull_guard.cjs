#!/usr/bin/env node
/*
 * qa/pull_guard.cjs — the acceptance test for pipeline/pull.sh (v110 §5 A1).
 *
 *   node qa/pull_guard.cjs
 *
 * The spec's test is "two runs on a blocked network leave the previous files intact". That is the
 * core of it, but a guard that never writes would also pass it, so this suite also proves the
 * opposite: given a feed that answers properly, the file IS replaced. A one-sided test on a
 * fallback is how a fallback that has stopped fetching gets shipped.
 *
 * Nothing here touches the real API. A local HTTP server stands in for both hosts through the
 * FPL_BASE and DRAFT_BASE overrides, and each case gets its own feeds directory under the
 * scratch path, so a case cannot see another's files.
 *
 * The four failure modes it exercises, all of them real:
 *   blocked    connection refused — the sandbox with no outbound access, or the API down.
 *   html       200 with an HTML body. The FPL API serves "the game is being updated" this way
 *              during deadline processing, and writing it over a good snapshot turns a stale
 *              file into a broken one: the bake then dies on a parse error instead of on a
 *              missing feed, which points the reader at the wrong thing.
 *   truncated  200 that opens with { and does not parse — a cut-off transfer.
 *   good       200 with real JSON, which must overwrite.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PULL = path.join(ROOT, "pipeline", "pull.sh");
const REF = path.join(ROOT, "reference", "v109", "live");
const TMP = fs.mkdtempSync(path.join(require("os").tmpdir(), "pullguard-"));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};

const sha = (p) => require("crypto").createHash("sha1").update(fs.readFileSync(p)).digest("hex");

/* A minimal bootstrap, written rather than copied, so the gameweek-detection cases can set
   is_current / finished / is_next exactly. */
function bootstrap(opts) {
  const events = [];
  for (let i = 1; i <= 38; i++) {
    events.push({
      id: i,
      deadline_time: "2026-08-" + String(14 + i).padStart(2, "0") + "T17:30:00Z",
      finished: i <= (opts.finished || 0),
      is_current: i === opts.current,
      is_next: i === opts.next,
      average_entry_score: 50
    });
  }
  return JSON.stringify({ events: events, teams: [], elements: [] });
}

/* The stand-in API runs in its OWN PROCESS.
   It has to: the suite drives pull.sh with execFileSync, which blocks this event loop, so a
   server listening in this process would accept the connection and never answer it. The child
   is handed a mode and a routes file and speaks only on loopback. */
const SERVER_SRC = path.join(TMP, "server.cjs");
fs.writeFileSync(SERVER_SRC, [
  '"use strict";',
  'const http = require("http"), fs = require("fs");',
  'const port = Number(process.argv[2]), mode = process.argv[3];',
  'const routes = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], "utf8")) : {};',
  'http.createServer(function (req, res) {',
  '  if (req.url === "/__ready") { res.writeHead(200); res.end("ok"); return; }',
  '  if (mode === "html") { res.writeHead(200, {"content-type":"text/html"});',
  '    res.end("<html><body>The game is being updated.</body></html>"); return; }',
  '  if (mode === "truncated") { res.writeHead(200, {"content-type":"application/json"});',
  '    res.end("{\\"events\\":[{\\"id\\":1,"); return; }',
  '  let body = routes.default || "{}";',
  '  for (const r of (routes.rules || [])) { if (new RegExp(r.re).test(req.url)) { body = r.body; break; } }',
  '  res.writeHead(200, {"content-type":"application/json"});',
  '  res.end(body);',
  '}).listen(port, "127.0.0.1");'
].join("\n"));

let nextPort = 24731;
function serve(mode, routes) {
  const port = nextPort++;
  const routeFile = path.join(TMP, "routes-" + port + ".json");
  fs.writeFileSync(routeFile, JSON.stringify(routes || {}));
  const child = require("child_process").spawn(process.execPath, [SERVER_SRC, String(port), mode, routeFile],
    { stdio: "ignore", detached: false });
  /* Block until it answers, so a slow start cannot be read as a blocked network — which would
     make every case below pass for the wrong reason. */
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    try {
      execFileSync("curl", ["-s", "-m", "2", "-o", "/dev/null", "http://127.0.0.1:" + port + "/__ready"], { stdio: "ignore" });
      up = true;
    } catch (e) { execFileSync("sleep", ["0.05"]); }
  }
  if (!up) { try { child.kill("SIGKILL"); } catch (e) {} throw new Error("the stand-in API never came up on port " + port); }
  return {
    base: "http://127.0.0.1:" + port + "/api",
    close: function () { try { child.kill("SIGKILL"); } catch (e) {} }
  };
}

function runPull(feeds, base, args) {
  const env = Object.assign({}, process.env, {
    FEEDS: feeds,
    FPL_BASE: base,
    DRAFT_BASE: base,
    PULL_TIMEOUT: "4"
  });
  try {
    const out = execFileSync("bash", [PULL].concat(args || []), { env: env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status === undefined || e.status === null ? -1 : e.status, out: String(e.stdout || "") + String(e.stderr || "") };
  }
}

/* A feeds directory pre-loaded with two good files, so "intact" is measurable. */
function seed(name) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "bootstrap.json"), bootstrap({ current: 5, finished: 5, next: 6 }));
  fs.writeFileSync(path.join(dir, "d_details.json"), JSON.stringify({ league_entries: [{ entry_id: 279275, entry_name: "Yoh-Nited" }], standings: [], matches: [] }));
  fs.writeFileSync(path.join(dir, "entry.json"), JSON.stringify({ leagues: { classic: [] } }));
  fs.writeFileSync(path.join(dir, "fixtures.json"), "[]");
  fs.writeFileSync(path.join(dir, "history.json"), JSON.stringify({ current: [], chips: [] }));
  return dir;
}

function snapshotOf(dir) {
  const m = {};
  for (const f of fs.readdirSync(dir).sort()) m[f] = sha(path.join(dir, f));
  return m;
}

ok("pipeline/pull.sh exists and is executable", fs.existsSync(PULL), PULL);

/* ---------------------------------------------------------------- blocked network, twice */
{
  const dir = seed("blocked");
  const before = snapshotOf(dir);
  // Port 1 on loopback: nothing listens there, so every request is refused immediately.
  const r1 = runPull(dir, "http://127.0.0.1:1/api", []);
  const after1 = snapshotOf(dir);
  const r2 = runPull(dir, "http://127.0.0.1:1/api", []);
  const after2 = snapshotOf(dir);

  ok("blocked: the first run leaves every previous file byte-identical",
    JSON.stringify(before) === JSON.stringify(after1), "before " + JSON.stringify(before) + " after " + JSON.stringify(after1));
  ok("blocked: the second run leaves them byte-identical too",
    JSON.stringify(before) === JSON.stringify(after2));
  ok("blocked: it exits non-zero rather than reporting a successful pull",
    r1.code !== 0 && r2.code !== 0, "exit " + r1.code + " then " + r2.code);
  ok("blocked: it says the previous file was kept, naming it",
    /kept\s+bootstrap\.json/.test(r1.out), r1.out.split("\n").slice(0, 4).join(" · "));
  ok("blocked: it leaves no .tmp file behind",
    Object.keys(after2).filter((f) => f.endsWith(".tmp")).length === 0, Object.keys(after2).join(","));
  ok("blocked: it still works out the gameweek, from the bootstrap it already had",
    /gameweek in play 5/.test(r1.out), r1.out.split("\n").slice(0, 3).join(" · "));
}

/* ---------------------------------------------------------------- 200 with an HTML body */
{
  const dir = seed("html");
  const before = snapshotOf(dir);
  const srv = serve("html", {});
  const r = runPull(dir, srv.base, []);
  srv.close();
  const after = snapshotOf(dir);
  ok('html: a 200 carrying "the game is being updated" does not overwrite a good feed',
    JSON.stringify(before) === JSON.stringify(after));
  ok("html: it exits non-zero", r.code !== 0, "exit " + r.code);
}

/* ---------------------------------------------------------------- 200 that does not parse */
{
  const dir = seed("truncated");
  const before = snapshotOf(dir);
  const srv = serve("truncated", {});
  const r = runPull(dir, srv.base, []);
  srv.close();
  const after = snapshotOf(dir);
  ok("truncated: a body that opens with { and does not parse does not overwrite",
    JSON.stringify(before) === JSON.stringify(after), "exit " + r.code);
}

/* ---------------------------------------------------------------- the other side: it must write */
{
  const dir = seed("good");
  const before = snapshotOf(dir);
  const fresh = bootstrap({ current: 7, finished: 7, next: 8 });
  const srv = serve("good", { rules: [
    { re: "bootstrap-static", body: fresh },
    { re: "/fixtures/", body: "[]" },
    { re: "details", body: JSON.stringify({ league_entries: [], standings: [], matches: [] }) },
    { re: "entry/3546875/$", body: JSON.stringify({ leagues: { classic: [] } }) },
    { re: "history", body: JSON.stringify({ current: [], chips: [] }) }
  ], default: "{}" });
  const r = runPull(dir, srv.base, []);
  srv.close();
  const after = snapshotOf(dir);
  ok("good: a feed that answers properly DOES overwrite the previous file",
    before["bootstrap.json"] !== after["bootstrap.json"], "sha unchanged: " + after["bootstrap.json"]);
  ok("good: the gameweek in play is detected from the feed, not from a default",
    /gameweek in play 7/.test(r.out), r.out.split("\n").slice(0, 3).join(" · "));
  ok("good: it exits zero", r.code === 0, "exit " + r.code + " · " + r.out.split("\n").slice(-3).join(" · "));
}

/* ---------------------------------------------------------------- gameweek detection fallbacks */
{
  const cases = [
    ["is_current wins", { current: 4, finished: 4, next: 5 }, 4],
    ["no is_current: the highest finished event", { finished: 9, next: 10 }, 9],
    ["neither: is_next minus one", { next: 3 }, 2]
  ];
  for (const [label, opts, want] of cases) {
    const dir = seed("gw-" + want);
    const srv = serve("good", { rules: [
      { re: "bootstrap-static", body: bootstrap(opts) },
      { re: "history", body: JSON.stringify({ current: [], chips: [] }) },
      { re: "entry/3546875/$", body: JSON.stringify({ leagues: { classic: [] } }) }
    ], default: "{}" });
    const r = runPull(dir, srv.base, []);
    srv.close();
    ok("gameweek detection — " + label + " → " + want,
      new RegExp("gameweek in play " + want + "\\b").test(r.out), r.out.split("\n").slice(0, 3).join(" · "));
  }
}

/* ---------------------------------------------------------------- an explicit argument wins */
{
  const dir = seed("arg");
  const srv = serve("good", { rules: [
    { re: "bootstrap-static", body: bootstrap({ current: 5, finished: 5, next: 6 }) },
    { re: "history", body: JSON.stringify({ current: [], chips: [] }) },
    { re: "entry/3546875/$", body: JSON.stringify({ leagues: { classic: [] } }) }
  ], default: "{}" });
  const r = runPull(dir, srv.base, ["2"]);
  srv.close();
  ok("an explicit gameweek argument overrides detection, for replaying a past week",
    /gameweek in play 2\b/.test(r.out), r.out.split("\n").slice(0, 3).join(" · "));
  ok("the forced gameweek is the one fetched: picks1 and picks2 only",
    fs.existsSync(path.join(dir, "picks1.json")) && fs.existsSync(path.join(dir, "picks2.json")) &&
    !fs.existsSync(path.join(dir, "picks3.json")),
    fs.readdirSync(dir).filter((f) => /^picks/.test(f)).join(","));
}

/* ---------------------------------------------------------------- no bootstrap, no guess */
{
  const dir = path.join(TMP, "empty");
  fs.mkdirSync(dir, { recursive: true });
  const r = runPull(dir, "http://127.0.0.1:1/api", []);
  ok("with no bootstrap and no argument it refuses rather than guessing a gameweek",
    r.code === 2 && /cannot tell which gameweek/.test(r.out), "exit " + r.code + " · " + r.out.trim().split("\n").slice(-2).join(" · "));
  ok("and it wrote nothing at all",
    fs.readdirSync(dir).length === 0, fs.readdirSync(dir).join(","));
}

/* ---------------------------------------------------------------- the feeds are never committed */
{
  /* ASK GIT, do not read the pattern. Reading it is what let E-091 through: `pipeline/feeds/`
     written inside pipeline/.gitignore means pipeline/pipeline/feeds/ and matches nothing, and a
     regex over the file's text says the rule is there either way. */
  let ignored = false, detail = "";
  try {
    execFileSync("git", ["-C", ROOT, "check-ignore", "--no-index", "-q", "pipeline/feeds/entry.json"], { stdio: "ignore" });
    ignored = true;
  } catch (e) {
    let text = "";
    try { text = fs.readFileSync(path.join(ROOT, "pipeline", ".gitignore"), "utf8").trim(); } catch (e2) { text = "no pipeline/.gitignore"; }
    detail = "git check-ignore says pipeline/feeds/entry.json is NOT ignored; the rule reads: " + text;
  }
  ok("pipeline/feeds/ is ignored by git, proved with git check-ignore (E-085, E-091)", ignored, detail);
  let tracked = "";
  try {
    tracked = execFileSync("git", ["-C", ROOT, "ls-files", "pipeline/feeds"], { encoding: "utf8" });
  } catch (e) { tracked = ""; }
  ok("and no feed is tracked", tracked.trim() === "", tracked.trim().split("\n").slice(0, 3).join(","));
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* the OS will */ }

console.log("SUITE pull_guard " + pass + "/" + (pass + fail));
process.exit(fail ? 1 : 0);

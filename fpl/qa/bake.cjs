#!/usr/bin/env node
/*
 * qa/bake.cjs — the bake reproduces the reference block, and the block holds what the spec says
 * (v110 §5 A2 snapshot equality, A4 reconciliation, A5 free-transfer ledger, A6 transfer ledger,
 * A7 INTEL; §1.5 privacy).
 *
 *   node qa/bake.cjs
 *
 * WHAT IT PROVES
 *   A2  pipeline/bake.js, run on the frozen reference feeds with the reference block's own INTEL and
 *       no previous bake, reproduces reference/v109/app/data.json path for path. The kit reads its
 *       clock from Date.now(), so the suite pins the clock to the reference block's own asOf through
 *       a Node preload written at test time; the bake is not changed for it and NO path is excluded
 *       from the comparison. The only paths the port may add are the v111 additions the kit carries
 *       over v109 — delta, players[].press, draft.events[].tr, draft.activity, draft.waiverRuns — and
 *       they are named here so anything else that appears is a failure, not a surprise.
 *   A4  Every classic.recon row has rebuilt === reported, on the reference bake and on the committed
 *       repo block, and rebuilt is what the spec says — Σ(points × multiplier) − hit — recomputed here
 *       from the picks, so a bake that copied `reported` into `rebuilt` would fail.
 *   A5  classic.ftNext equals golden.classic.ftNext with ftSure true, the block's value is what the
 *       exported ledger function returns on the block's own weeks, and the rule itself is proved on
 *       synthetic histories: a wildcard or free-hit week keeps the count, an ordinary week adds one,
 *       the cap is 1 + max_extra_free_transfers, a hit week leaves 1 (v110 §4, Part N1).
 *   A6  The reference bake's classic.transfersLog equals the reference data's, and every entry carries
 *       the player in, the player out, the gameweek and the price paid; the points each has scored
 *       since are derived from the per-gameweek lines the same way the reference interface does it,
 *       and the buyer's figure is cross-checked against the published squads, a second source.
 *   A7  pipeline/intel.js: asOf is an ISO instant; every note and every source carries a date; every
 *       odds row is [HOME, AWAY, h, d, a] with prices above 1, both clubs real and the pairing a real
 *       fixture of that gameweek; every start override has p in (0, 1] and a dated why; and the Draft
 *       horizon is READ from d_details.json's league.drafts (§7.12), proved by baking a feeds tree
 *       whose unfinished draft sits one gameweek later and watching the block follow it.
 *   Privacy  The serialised output holds no personal-name key and no short_name on any league entry.
 *
 * NO FROZEN LIVE VALUES (E-084, E-094)
 *   Every expectation is read from reference/v109/app/{data,golden}.json, from the feeds, or derived
 *   from the block under test. The synthetic ledger histories are rules of the game and are marked.
 *
 * MUTATIONS
 *   Each parity check is broken in a copy and must fail: a changed price, a recon row off by one, a
 *   "wildcard adds one" ledger, a transfer without its player in, a planted personal name, and a
 *   moved re-draft. A check that cannot fail reads as proof and proves nothing (E-070).
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BAKE = path.join(ROOT, "pipeline", "bake.js");
const INTEL_JS = path.join(ROOT, "pipeline", "intel.js");
const REF_FEEDS = path.join(ROOT, "reference", "v109", "live");
const REF_DATA = path.join(ROOT, "reference", "v109", "app", "data.json");
const GOLDEN = path.join(ROOT, "reference", "v109", "app", "golden.json");
const REPO_BLOCK = path.join(ROOT, "data", "mc_data.json");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("PASS " + name); return true; }
  fail++; console.log("FAIL " + name + (detail ? " — " + detail : ""));
  return false;
};
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } };
const sha = (p) => { try { return require("crypto").createHash("sha1").update(fs.readFileSync(p)).digest("hex"); } catch (e) { return null; } };
const isIsoInstant = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(s) && isFinite(Date.parse(s));
/* A date in prose: a day and a month name ("25 Sep", "10 October", "8 and 9 October"), or an ISO date. */
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const hasDate = (s) => typeof s === "string" && (new RegExp("\\b\\d{1,2}\\s+" + MONTH + "\\b").test(s) || /\b\d{4}-\d{2}-\d{2}\b/.test(s));

/* ---------------------------------------------------------------- deep comparison, path for path */
function fmt(v) { const s = JSON.stringify(v); return s === undefined ? String(v) : (s.length > 60 ? s.slice(0, 57) + "..." : s); }
/* Every path the reference holds must be in `got` with the same value (→ diffs); every path `got`
   holds that the reference does not is reported separately (→ extra). */
function deepDiff(ref, got, at, diffs, extra) {
  const tr = ref === null ? "null" : Array.isArray(ref) ? "array" : typeof ref;
  const tg = got === null ? "null" : Array.isArray(got) ? "array" : typeof got;
  if (tr !== tg) { diffs.push({ path: at, ref: fmt(ref), got: fmt(got) }); return; }
  if (tr === "array") {
    if (ref.length !== got.length) diffs.push({ path: at + ".length", ref: ref.length, got: got.length });
    const n = Math.min(ref.length, got.length);
    for (let i = 0; i < n; i++) deepDiff(ref[i], got[i], at + "[" + i + "]", diffs, extra);
    for (let i = n; i < got.length; i++) extra.push(at + "[" + i + "]");
    return;
  }
  if (tr === "object") {
    for (const k of Object.keys(ref)) {
      if (!Object.prototype.hasOwnProperty.call(got, k)) { diffs.push({ path: at + "." + k, ref: fmt(ref[k]), got: "(absent)" }); continue; }
      deepDiff(ref[k], got[k], at + "." + k, diffs, extra);
    }
    for (const k of Object.keys(got)) if (!Object.prototype.hasOwnProperty.call(ref, k)) extra.push(at + "." + k);
    return;
  }
  if (!(ref === got || (Number.isNaN(ref) && Number.isNaN(got)))) diffs.push({ path: at, ref: fmt(ref), got: fmt(got) });
}
const compare = (ref, got) => { const diffs = [], extra = []; deepDiff(ref, got, "$", diffs, extra); return { diffs, extra }; };
/* players[12].press → players[*].press; draft.events.6.tr → draft.events.*.tr */
const shape = (p) => p.replace(/^\$\./, "").replace(/\[\d+\]/g, "[*]").replace(/\.\d+(?=\.|$)/g, ".*");
const firstTen = (diffs) => diffs.slice(0, 10).map((d) => d.path + " ref " + d.ref + " got " + d.got).join("\n       ");

/* ---------------------------------------------------------------- the privacy walk */
const NAME_KEYS = ["player_first_name", "player_last_name", "player_name"];
function privacyScan(doc) {
  const out = { nameKeys: [], initials: [] };
  (function walk(v, at) {
    if (v === null || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, at + "[" + i + "]")); return; }
    const keys = Object.keys(v);
    for (const k of keys) if (NAME_KEYS.indexOf(k) !== -1) out.nameKeys.push(at + "." + k);
    const entryLike = ["entry_id", "entry_name", "waiver_pick"].some((m) => keys.indexOf(m) !== -1);
    if (entryLike && keys.indexOf("short_name") !== -1) out.initials.push(at + ".short_name");
    for (const k of keys) walk(v[k], at + "." + k);
  })(doc, "$");
  return out;
}

/* ---------------------------------------------------------------- running the bake */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "mc-bake-qa-"));
/* The clock preload: Date.now() and new Date() answer the pinned instant; everything else on Date is
   untouched. Written here so the bake needs no clock argument of its own. */
const CLOCK = path.join(TMP, "clock.cjs");
fs.writeFileSync(CLOCK, [
  '"use strict";',
  "const T = Date.parse(process.env.QA_NOW);",
  "if (!isFinite(T)) throw new Error('QA_NOW is not an instant: ' + process.env.QA_NOW);",
  "const R = Date;",
  "class Pinned extends R { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }",
  "globalThis.Date = Pinned;"
].join("\n"));
function runBake(args, opts) {
  const o = opts || {};
  const cwd = o.cwd || TMP;
  fs.mkdirSync(cwd, { recursive: true });
  const env = Object.assign({}, process.env, o.now ? { QA_NOW: o.now } : {});
  const nodeArgs = (o.now ? ["-r", CLOCK] : []).concat([BAKE], args);
  const r = spawnSync(process.execPath, nodeArgs, { cwd, env, encoding: "utf8", timeout: 90000 });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

/* ---------------------------------------------------------------- the checks */
const refData = readJson(REF_DATA), golden = readJson(GOLDEN);
const refBoot = readJson(path.join(REF_FEEDS, "bootstrap.json")), refDet = readJson(path.join(REF_FEEDS, "d_details.json"));
ok("the reference feeds, block and golden numbers are readable",
  !!refData && !!golden && !!golden.classic && !!refBoot && Array.isArray(refBoot.teams) && !!refDet && !!refDet.league,
  [!!refData, !!golden, !!refBoot, !!refDet].join(","));

let B = null;
try { B = require(BAKE); } catch (e) { B = { __err: e.message }; }
ok("pipeline/bake.js loads as a module and exports the ledger and the bake",
  B && typeof B.ftLedger === "function" && typeof B.bake === "function",
  B && B.__err ? B.__err.split("\n")[0] : "exports: " + Object.keys(B || {}).join(","));

let INTEL = null;
try { INTEL = require(INTEL_JS); } catch (e) { INTEL = null; }
ok("pipeline/intel.js exports the INTEL block",
  !!INTEL && typeof INTEL === "object" && ["asOf", "market5", "odds", "start", "notes", "sources"].every((k) => k in INTEL),
  INTEL ? "keys: " + Object.keys(INTEL).join(",") : "not loadable");

const refDataSha = sha(REF_DATA);
const repoBlockSha = sha(REPO_BLOCK);

/* ================================================================ A2 — snapshot equality */
let got = null, refLine = "";
{
  const runDir = path.join(TMP, "run"), outFile = path.join(TMP, "out", "ref_bake.json");
  const r = refData ? runBake(["--feeds", REF_FEEDS, "--intel", REF_DATA, "--prev", "none", "--out", outFile], { cwd: runDir, now: refData.asOf }) : { status: -1, stdout: "", stderr: "no reference block" };
  refLine = r.stdout.trim().split("\n").pop() || "";
  got = readJson(outFile);
  ok("A2 the bake runs on the reference feeds with the clock pinned to the reference asOf and prints its summary",
    r.status === 0 && !!got && /^baked /.test(refLine),
    "exit " + r.status + " · " + (r.stderr.trim().split("\n")[0] || refLine).slice(0, 160));
  ok("A2 the pinned clock took: the output's asOf is the reference block's own",
    !!got && !!refData && got.asOf === refData.asOf, got ? got.asOf + " vs " + (refData && refData.asOf) : "no output");

  const cmp = got && refData ? compare(refData, got) : { diffs: [{ path: "$", ref: "block", got: "(no output)" }], extra: [] };
  ok("A2 every path in reference/v109/app/data.json is reproduced — " + (cmp.diffs.length ? cmp.diffs.length + " differing" : "0 differing, 0 excluded"),
    cmp.diffs.length === 0, "first ten:\n       " + firstTen(cmp.diffs));

  const ADDED = ["delta", "players[*].press", "draft.events.*.tr", "draft.activity", "draft.waiverRuns"];
  const extraShapes = [...new Set(cmp.extra.map(shape))].sort();
  ok("A2 the only paths the port adds are the v111 additions: " + ADDED.join(", "),
    got !== null && extraShapes.length === ADDED.length && ADDED.slice().sort().every((a, i) => a === extraShapes[i]),
    "added: " + extraShapes.join(", "));
  ok("A2 with --prev none the delta block is the empty one the kit writes when it has nothing to compare against",
    !!got && !!got.delta && got.delta.since === null && Array.isArray(got.delta.prices) && got.delta.prices.length === 0 && Array.isArray(got.delta.flags) && got.delta.flags.length === 0,
    got ? fmt(got.delta) : "no output");

  /* Mutation: the comparer must see a leaf. */
  if (got) {
    const copy = JSON.parse(JSON.stringify(got)); copy.players[0].pr = copy.players[0].pr + 1;
    const m = compare(refData, copy);
    ok("A2 mutation: one player's price changed in a copy is reported at its path, and nothing else moves",
      m.diffs.length === cmp.diffs.length + 1 && m.diffs.some((d) => d.path === "$.players[0].pr"), firstTen(m.diffs) || "nothing reported");
  }

  /* The bake writes nothing but --out: the run directory stays empty, no ../app/data.json appears,
     and neither the reference block nor the committed repo block changed. */
  const runFiles = fs.existsSync(runDir) ? fs.readdirSync(runDir) : ["(missing)"];
  const strayApp = fs.existsSync(path.join(TMP, "app", "data.json"));
  ok("A2 the bake wrote nothing outside --out: run directory empty, no ../app/data.json, reference and repo blocks untouched",
    runFiles.length === 0 && !strayApp && sha(REF_DATA) === refDataSha && sha(REPO_BLOCK) === repoBlockSha,
    "run dir: [" + runFiles.join(",") + "] stray app/data.json: " + strayApp + " ref changed: " + (sha(REF_DATA) !== refDataSha) + " repo changed: " + (sha(REPO_BLOCK) !== repoBlockSha));
}

/* ================================================================ A4 — reconciliation */
const repo = readJson(REPO_BLOCK);
ok("A4 the committed repo block data/mc_data.json exists and parses",
  !!repo && !!repo.classic && Array.isArray(repo.classic.recon) && Array.isArray(repo.classic.gws), repo ? "keys: " + Object.keys(repo).join(",") : "missing or unparseable");

/* Σ(points × multiplier) − hit, recomputed here from the picks. */
const rebuild = (g) => g.picks.reduce((a, k) => a + (k.pts || 0) * k.mult, 0) - (g.hit || 0);
function reconCheck(label, block) {
  if (!block) { ok("A4 " + label + ": every recon row has rebuilt === reported", false, "no block"); return; }
  const rows = block.classic.recon, gws = block.classic.gws;
  const bad = rows.filter((r) => r.rebuilt !== r.reported);
  ok("A4 " + label + ": every recon row has rebuilt === reported — " + (rows.length - bad.length) + " of " + rows.length + ", one per published gameweek (" + gws.length + ")",
    rows.length > 0 && rows.length === gws.length && bad.length === 0, JSON.stringify(bad));
  const notRebuilt = rows.filter((r) => { const g = gws.find((x) => x.gw === r.gw); return !g || rebuild(g) !== r.rebuilt; });
  ok("A4 " + label + ": rebuilt is Σ(points × multiplier) − hit recomputed from the picks, not a copy of reported",
    notRebuilt.length === 0, JSON.stringify(notRebuilt));
}
reconCheck("reference bake", got);
reconCheck("repo block", repo);
if (got) {
  const copy = JSON.parse(JSON.stringify(got)); copy.classic.recon[0].rebuilt += 1;
  ok("A4 mutation: a recon row moved by one point stops matching",
    copy.classic.recon.some((r) => r.rebuilt !== r.reported), "the mutated row still matched");
  /* The mutation that matters is at the feed. On data that reconciles, a bake that copied `reported`
     into `rebuilt` is indistinguishable from one that computed it, so the official total of the last
     published gameweek is moved by one point in a copy of the feeds: the block must then carry the
     mismatch — reported follows the feed, rebuilt stays what the picks add up to — and the gate must
     refuse that block. This is what "the gate fails if any gameweek mismatches" means. */
  const lastPicks = fs.readdirSync(REF_FEEDS).filter((f) => /^picks\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5))).pop();
  const feeds3 = path.join(TMP, "feeds_offbyone"); fs.mkdirSync(feeds3, { recursive: true });
  for (const f of fs.readdirSync(REF_FEEDS)) if (f !== lastPicks) fs.symlinkSync(path.join(REF_FEEDS, f), path.join(feeds3, f));
  const pk = readJson(path.join(REF_FEEDS, lastPicks)); pk.entry_history.points += 1;
  fs.writeFileSync(path.join(feeds3, lastPicks), JSON.stringify(pk));
  const out3 = path.join(TMP, "out", "offbyone.json");
  const r3 = runBake(["--feeds", feeds3, "--intel", REF_DATA, "--prev", "none", "--out", out3], { cwd: path.join(TMP, "run3"), now: refData.asOf });
  const off = readJson(out3);
  const gwN = parseInt(lastPicks.slice(5));
  const row = off && off.classic.recon.find((r) => r.gw === gwN), refRow = got.classic.recon.find((r) => r.gw === gwN);
  ok("A4 mutation at the feed: an official total one point off makes the bake's recon row mismatch — reported follows the feed, rebuilt stays the picks' sum — so the gate would refuse the block",
    r3.status === 0 && !!row && !!refRow && row.reported === refRow.reported + 1 && row.rebuilt === refRow.rebuilt && row.rebuilt !== row.reported,
    "exit " + r3.status + " row " + (row ? fmt(row) : "none") + " reference row " + (refRow ? fmt(refRow) : "none") + " " + r3.stderr.trim().split("\n")[0]);
}

/* ================================================================ A5 — free-transfer ledger */
ok("A5 reference bake: classic.ftNext equals golden.classic.ftNext and ftSure is true",
  !!got && !!golden && got.classic.ftNext === golden.classic.ftNext && got.classic.ftSure === true,
  got ? "ftNext " + got.classic.ftNext + " (golden " + (golden && golden.classic.ftNext) + ") ftSure " + got.classic.ftSure : "no output");
if (B && typeof B.ftLedger === "function") {
  const same = (block) => { const L = B.ftLedger(block.classic.gws, block.gw.next, block.classic.maxFt); return L.ft === block.classic.ftNext && L.ftSure === block.classic.ftSure; };
  ok("A5 the block's ftNext is what the exported ftLedger returns on the block's own weeks (reference bake and repo block)",
    !!got && same(got) && !!repo && same(repo), (got ? "ref ok " + same(got) : "no ref") + (repo ? " · repo ok " + same(repo) : " · no repo block"));
  ok("A5 repo block: ftNext sits inside [1, maxFt] and maxFt is 1 + max_extra_free_transfers read from the block's rules",
    !!repo && repo.classic.ftNext >= 1 && repo.classic.ftNext <= repo.rules.maxFt && repo.classic.maxFt === repo.rules.maxFt,
    repo ? "ftNext " + repo.classic.ftNext + " maxFt " + repo.classic.maxFt : "no repo block");

  /* The rule itself, on synthetic histories (v110 §4 Classic; Fantasy Football Scout, 20 Jul 2026).
     frozen-ok: a rule of the game, not a live value — these weeks are built here, not read from a feed. */
  const W = (gw, tx, chip, hit) => ({ gw, tx, chip: chip || null, hit: hit || 0 });
  const CAP = 5;                                     // 1 + max_extra_free_transfers of 4, the game's own cap
  const plain = [W(2, 0), W(3, 0)];                  // nothing spent: 1 → 2 → 3 in hand for GW4
  const wc = [W(2, 0), W(3, 8, "wildcard")];         // a wildcard week keeps the count exactly: 2 stays 2
  const fh = [W(2, 0), W(3, 6, "freehit")];          // a free-hit week likewise
  const hit = [W(2, 2, null, 4)];                    // 1 in hand, 2 made, one hit: 1 used → 1 in hand again
  const many = [W(2, 0), W(3, 0), W(4, 0), W(5, 0), W(6, 0), W(7, 0)];   // 1 + 6 arrivals, capped
  const at = (h, next) => B.ftLedger(h, next, CAP).ft;
  ok("A5 rule: an ordinary week with no transfer adds one (1 → 2 → 3)", at(plain, 4) === 3, "got " + at(plain, 4));
  ok("A5 rule: a wildcard week keeps the count exactly as it was, nothing spent and nothing added", at(wc, 4) === at(plain.slice(0, 1), 3) && at(wc, 4) === 2, "got " + at(wc, 4) + ", expected the count going in, 2");
  ok("A5 rule: a free-hit week keeps the count exactly as it was", at(fh, 4) === 2, "got " + at(fh, 4));
  ok("A5 rule: a hit week leaves 1 (one free used, the paid-for one does not count)", at(hit, 3) === 1, "got " + at(hit, 3));
  ok("A5 rule: the cap is 1 + max_extra_free_transfers", at(many, 8) === CAP && B.ftLedger(many, 8, 3).ft === 3, "got " + at(many, 8) + " at cap 5, " + B.ftLedger(many, 8, 3).ft + " at cap 3");
  ok("A5 rule: ftSure is false until the gameweek in play has published its picks",
    B.ftLedger([W(2, 0)], 4, CAP).ftSure === false && B.ftLedger([W(2, 0), W(3, 0)], 4, CAP).ftSure === true,
    JSON.stringify([B.ftLedger([W(2, 0)], 4, CAP), B.ftLedger([W(2, 0), W(3, 0)], 4, CAP)]));
  /* Mutation: the §7.5 defect — a wildcard week ADDING one — must disagree with the ledger. */
  const wcAdds = (h, next) => { let ft = 1; for (let g = 2; g < next; g++) { const w = h.find((x) => x.gw === g); const chip = w && (w.chip === "wildcard" || w.chip === "freehit"); ft = chip ? Math.min(CAP, ft + 1) : Math.min(CAP, ft - (w ? Math.min(ft, w.tx || 0) : 0) + 1); } return ft; };
  ok("A5 mutation: a ledger where the wildcard week adds one disagrees with ftLedger on the wildcard history (§7.5 is what this test catches)",
    wcAdds(wc, 4) !== at(wc, 4) && wcAdds(plain, 4) === at(plain, 4), "mutant " + wcAdds(wc, 4) + " vs ledger " + at(wc, 4));
} else {
  for (let i = 0; i < 9; i++) ok("A5 ledger check " + (i + 1) + " (needs pipeline/bake.js to export ftLedger)", false, "no ftLedger");
}

/* ================================================================ A6 — transfer ledger */
ok("A6 the reference bake's classic.transfersLog equals the reference data's, and it is not empty",
  !!got && !!refData && refData.classic.transfersLog.length > 0 && compare(refData.classic.transfersLog, got.classic.transfersLog).diffs.length === 0,
  got ? fmt(got.classic.transfersLog) : "no output");
/* Points since, the way the reference interface derives them: Σ h[g][1] for g from the transfer's
   gameweek to the last finished one. The buyer's figure is cross-checked against the published
   squads, which come from a different part of the feeds. */
function ledgerCheck(label, block) {
  if (!block) { ok("A6 " + label + ": every entry carries in, out, gw, the price paid and the points since", false, "no block"); return; }
  const P = {}; block.players.forEach((p) => { P[p.id] = p; });
  const last = block.gw.lastDone;
  const rows = block.classic.transfersLog.map((t) => {
    const hi = (P[t.in] && P[t.in].h) || {}, ho = (P[t.out] && P[t.out].h) || {};
    let pi = 0, po = 0; for (let g = t.gw; g <= last; g++) { pi += hi[g] ? hi[g][1] : 0; po += ho[g] ? ho[g][1] : 0; }
    const fromPicks = block.classic.gws.filter((g) => g.gw >= t.gw).reduce((a, g) => { const k = g.picks.find((x) => x.id === t.in); return a + (k ? (k.pts || 0) : 0); }, 0);
    const shape = Number.isInteger(t.in) && Number.isInteger(t.out) && Number.isInteger(t.gw) && typeof t.inCost === "number" && typeof t.outCost === "number" && typeof t.at === "string";
    return { gw: t.gw, in: t.in, out: t.out, paid: t.inCost, pi, po, fromPicks, shape, known: !!P[t.in] && !!P[t.out] };
  });
  const bad = rows.filter((r) => !r.shape || !r.known || r.pi !== r.fromPicks);
  ok("A6 " + label + ": every entry carries in, out, gw, the price paid, and the points since (in " + rows.map((r) => r.pi).join(",") + " · out " + rows.map((r) => r.po).join(",") + ") agree with the published squads",
    rows.length > 0 && bad.length === 0, JSON.stringify(bad));
}
ledgerCheck("reference bake", got);
ledgerCheck("repo block", repo);
if (got) {
  const copy = JSON.parse(JSON.stringify(got)); delete copy.classic.transfersLog[0].in;
  const shapeOk = copy.classic.transfersLog.every((t) => Number.isInteger(t.in));
  ok("A6 mutation: a transfer stripped of its player in fails the shape check", !shapeOk, "the entry without `in` passed");
}

/* ================================================================ A7 — INTEL */
const teamsOf = (block) => new Set((block ? block.teams : refBoot.teams).map((t) => t.s || t.short_name));
if (INTEL) {
  ok("A7 intel.asOf is an ISO instant", isIsoInstant(INTEL.asOf), String(INTEL.asOf));
  const undatedNotes = (INTEL.notes || []).filter((n) => !hasDate(n));
  const undatedSources = (INTEL.sources || []).filter((s) => !hasDate(s));
  ok("A7 every note carries a date (" + (INTEL.notes || []).length + " notes) and every source carries a date (" + (INTEL.sources || []).length + " sources)",
    (INTEL.notes || []).length > 0 && (INTEL.sources || []).length > 0 && undatedNotes.length === 0 && undatedSources.length === 0,
    "undated notes: " + undatedNotes.map((n) => JSON.stringify(n.slice(0, 70))).join(" · ") + " undated sources: " + undatedSources.map((s) => JSON.stringify(s.slice(0, 70))).join(" · "));

  /* The odds are dated 26 Sep and the repo block is baked from the 26 Sep feeds, so the fixtures the
     rows must match are the repo block's; the club list is the season's twenty either way. */
  const fxBlock = repo || got;
  const T = teamsOf(fxBlock);
  const oddsRows = [];
  Object.keys(INTEL.odds || {}).forEach((g) => (INTEL.odds[g] || []).forEach((r) => oddsRows.push({ gw: +g, r })));
  const badOdds = oddsRows.filter(({ gw, r }) => !(Array.isArray(r) && r.length === 5 && T.has(r[0]) && T.has(r[1]) && r[0] !== r[1] && [2, 3, 4].every((i) => typeof r[i] === "number" && r[i] > 1)
    && (!fxBlock || fxBlock.fixtures.some((f) => f.gw === gw && f.h === r[0] && f.a === r[1]))));
  ok("A7 every odds row is [HOME, AWAY, h, d, a] with the three prices above 1, both clubs in the feeds' team list and the pairing a real fixture of that gameweek — " + oddsRows.length + " rows over gameweeks " + Object.keys(INTEL.odds || {}).join(","),
    oddsRows.length > 0 && badOdds.length === 0, JSON.stringify(badOdds.slice(0, 3)));

  const startRows = [];
  Object.keys(INTEL.start || {}).forEach((g) => Object.keys(INTEL.start[g]).forEach((k) => startRows.push({ gw: g, key: k, o: INTEL.start[g][k] })));
  const badStart = startRows.filter(({ key, o }) => { const team = key.split("|")[1]; return !(o && typeof o.p === "number" && o.p > 0 && o.p <= 1 && T.has(team) && hasDate(o.why)); });
  ok("A7 every start override has p in (0, 1], a Name|TEAM key with a real club, and a why carrying a date — " + startRows.length + " overrides over gameweeks " + Object.keys(INTEL.start || {}).join(","),
    startRows.length > 0 && badStart.length === 0, badStart.map((b) => b.gw + " " + b.key + " " + fmt(b.o)).join(" · "));

  /* market5 anchors: a team code and numbers in range, so a typo cannot ride in as an anchor. */
  const badM5 = Object.keys(INTEL.market5 || {}).filter((t) => !(T.has(t) && Object.keys(INTEL.market5[t]).every((k) => (k === "xg" && INTEL.market5[t].xg > 0 && INTEL.market5[t].xg < 5) || (k === "cs" && INTEL.market5[t].cs > 0 && INTEL.market5[t].cs < 1))));
  ok("A7 every market5 anchor names a real club with xg in (0, 5) and cs in (0, 1)", Object.keys(INTEL.market5 || {}).length > 0 && badM5.length === 0, badM5.join(","));
} else {
  for (let i = 0; i < 5; i++) ok("A7 INTEL check " + (i + 1) + " (needs pipeline/intel.js)", false, "no INTEL");
}

/* The Draft horizon is READ from league.drafts (§7.12): the reference feed's unfinished draft names
   the first gameweek of the new rosters, and the block carries exactly that. */
{
  const unfinished = refDet && (refDet.league.drafts || []).find((d) => !d.draft_completed);
  ok("A7 §7.12 the reference bake's league.redraft.fromGw is the unfinished draft's event read from d_details.json, and drafts[] has one row per draft",
    !!got && !!unfinished && got.draft.league.redraft && got.draft.league.redraft.fromGw === unfinished.event && got.draft.league.drafts.length === refDet.league.drafts.length,
    got ? "block " + fmt(got.draft.league.redraft) + " feed event " + (unfinished && unfinished.event) : "no output");
  ok("A7 §7.12 the repo block's redraft is its own unfinished draft and its horizon starts after the next gameweek",
    !!repo && repo.draft.league.redraft && repo.draft.league.drafts.some((d) => !d.done && d.fromGw === repo.draft.league.redraft.fromGw) && repo.draft.league.redraft.fromGw > repo.gw.next,
    repo ? fmt(repo.draft.league.redraft) + " next " + repo.gw.next : "no repo block");

  /* Mutation: a feeds tree identical to the reference except that the unfinished draft sits one
     gameweek later. A bake that typed the horizon would not move. */
  if (got && unfinished) {
    const feeds2 = path.join(TMP, "feeds_moved"); fs.mkdirSync(feeds2, { recursive: true });
    for (const f of fs.readdirSync(REF_FEEDS)) if (f !== "d_details.json") fs.symlinkSync(path.join(REF_FEEDS, f), path.join(feeds2, f));
    const det2 = JSON.parse(JSON.stringify(refDet)); det2.league.drafts.find((d) => !d.draft_completed).event = unfinished.event + 1;
    fs.writeFileSync(path.join(feeds2, "d_details.json"), JSON.stringify(det2));
    const out2 = path.join(TMP, "out", "moved.json");
    const r = runBake(["--feeds", feeds2, "--intel", REF_DATA, "--prev", "none", "--out", out2], { cwd: path.join(TMP, "run2"), now: refData.asOf });
    const moved = readJson(out2);
    ok("A7 §7.12 mutation: moving the unfinished draft one gameweek later in the feed moves the block's horizon with it (read, not typed)",
      r.status === 0 && !!moved && moved.draft.league.redraft.fromGw === unfinished.event + 1,
      "exit " + r.status + " block " + (moved ? fmt(moved.draft.league.redraft) : "none") + " " + r.stderr.trim().split("\n")[0]);
  }
}

/* ================================================================ privacy */
function privacyCheck(label, block) {
  if (!block) { ok("privacy " + label + ": no personal-name key and no short_name on a league entry", false, "no block"); return; }
  const s = privacyScan(block);
  const text = JSON.stringify(block);
  const bare = NAME_KEYS.filter((k) => text.indexOf('"' + k + '"') !== -1);
  ok("privacy " + label + ": no key named player_first_name, player_last_name or player_name, and no short_name on any object carrying entry_id, entry_name or waiver_pick",
    s.nameKeys.length === 0 && s.initials.length === 0 && bare.length === 0, s.nameKeys.concat(s.initials).concat(bare).slice(0, 5).join(", "));
}
privacyCheck("reference bake", got);
privacyCheck("repo block", repo);
{
  const planted = { draft: { entries: [{ entry_id: 1, entry_name: "T", waiver_pick: 3, short_name: "ZZ" }], standings: [{ entry: 2, player_name: "Planted Name" }] } };
  const s = privacyScan(planted);
  ok("privacy mutation: a planted player_name and a planted league-entry short_name are both found",
    s.nameKeys.length === 1 && s.initials.length === 1, JSON.stringify(s));
}

/* ---------------------------------------------------------------- tidy up */
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a leftover temp dir is not a failure */ }

console.log("SUITE bake " + pass + "/" + (pass + fail) + (refLine ? " · " + refLine.slice(0, 120) : ""));
process.exit(fail ? 1 : 0);

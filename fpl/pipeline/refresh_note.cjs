#!/usr/bin/env node
/* pipeline/refresh_note.cjs — the refresh's two questions about a pull: did anything the manager decides on change,
   and if it did, what (v110 §5 E7). .github/workflows/refresh.yml runs it twice.

     node pipeline/refresh_note.cjs --before <dir> [--after <dir>] --check [--since <ISO time>]
     node pipeline/refresh_note.cjs --before <dir> [--after <dir>] [--since <ISO time>] [--out <file>] [--title <file>]

   Each <dir> holds mc_data.json, live.json, solver_in.json and plan.json. --before is a copy of the committed files,
   taken before the pull; --after defaults to data/. `--before data --after data` compares the tree with itself, which
   is how the no-change path is dry-run.

   CONTENT, NEVER CLOCKS (ERRORS.md E-093, E-101). A re-bake of the same feeds differs from the committed block only in
   `asOf`, `delta` (the since-last-build list, rebuilt against whichever block came before) and `model.at`; live.json
   only in `fetched_at`; plan.json only in `at`. Those are set aside before anything is hashed. Two digests come out:
     content   the whole block and the whole live snapshot, clocks set aside. It moves on nearly every pull, because
               ownership and transfer counts move by the hour, and none of that changes a decision.
     decision  what the manager acts on: the export hash (every player's expected points per gameweek, prices, flags
               through the projection, both squads, bank, free transfers, chips — pipeline/export.js), the next
               gameweek with its Classic deadline and its Draft waiver and trade times, both squads, and the price,
               status, chance and news of every player in his Classic fifteen and Draft roster.
   The refresh proposes a pull request only when the DECISION digest moves. Measured on 27 Sep 2026: two bakes of the
   same feeds gave one content digest, equal to the committed block's; a fresh pull 2 h 28 min later moved the content
   digest (players, classic, model) and left the export hash where it was.

   --check (after the export, before the solve) prints key=value lines and nothing else:
     changed   1 when the decision digest moved
     resolve   1 when the export hash moved, so the committed plan was solved on other data and the solve must run;
               0 keeps the committed plan, and pipeline/plan.cjs's guard then proves it is the plan for this data
     reason    one sentence
     and the digests on both sides.

   STALE GUARD (exit 3, both modes). The pulled data may never be behind the committed snapshot: an earlier next or
   last finished gameweek in the block or in live.json, or the block and live.json disagreeing on the next gameweek (one
   of the two pulls caught the game mid-rollover), is refused. With --since, every file the pull request would carry
   must also have been written at or after that time — the block's asOf and model.at, live.json's fetched_at, the
   solver input's at — because a stage that silently wrote nothing would otherwise ship the committed file under a
   "refreshed" title. In the note mode the plan must also carry the solver input's hash.

   THE NOTE (default mode). One paragraph, SA English, business-professional, every time in SAST (UTC+2), every
   number labelled Classic or Draft, and the two games never added, averaged, netted or compared (v110 §1.1). It names
   the next gameweek and its deadlines, squad changes, price moves on the Classic fifteen, flag changes on the Classic
   fifteen and the Draft roster, and whether the plan changed and by how many expected points in each game. Free
   transfers and hits come from plan.json's replay, never the solver's own fields (§6). Players and clubs are named;
   a manager never is (§1.5). With no decision change the paragraph says so and nothing else.

   EXIT 0 done · 2 bad arguments or a file missing · 3 stale (nothing written). */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const FILES = { data: "mc_data.json", live: "live.json", input: "solver_in.json", plan: "plan.json" };
const CLOCKS = { data: [["asOf"], ["delta"], ["model", "at"]], live: [["fetched_at"]], plan: [["at"], ["timing", "at"]] };
const STATUS = { a: "fit", d: "doubtful", i: "injured", s: "suspended", u: "unavailable", n: "unavailable" };
const CHIP = { wildcard: "the wildcard", freehit: "the free hit", bboost: "the bench boost", "3xc": "the triple captain" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SAST_MS = 2 * 3600e3;          // South Africa Standard Time is UTC+2 all year; there is no daylight saving
const LIST_MAX = 5;                  // names listed before "and N more", so the paragraph stays one paragraph

function die(code, msg) { console.error("refresh_note: " + msg); process.exit(code); }

function parseArgs(argv) {
  const o = { before: null, after: path.join(ROOT, "data"), check: false, out: null, title: null, since: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    const need = () => { if (v === undefined || v.startsWith("--")) die(2, a + " needs a value"); i++; return v; };
    if (a === "--before") o.before = path.resolve(need());
    else if (a === "--after") o.after = path.resolve(need());
    else if (a === "--check") o.check = true;
    else if (a === "--out") o.out = path.resolve(need());
    else if (a === "--title") o.title = path.resolve(need());
    else if (a === "--since") o.since = need();
    else die(2, "unknown argument " + a + " (expected --before <dir> [--after <dir>] [--check] [--since <time>] [--out <file>] [--title <file>])");
  }
  if (!o.before) die(2, "--before <dir> is required");
  if (o.since !== null && !Number.isFinite(Date.parse(o.since))) die(2, "--since takes an ISO time, not " + JSON.stringify(o.since));
  return o;
}

function load(dir) {
  const s = {};
  Object.keys(FILES).forEach((k) => {
    const f = path.join(dir, FILES[k]);
    if (!fs.existsSync(f)) die(2, "no " + FILES[k] + " in " + dir);
    try { s[k] = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { die(2, f + " is not JSON: " + e.message); }
  });
  return s;
}

/* ---------------------------------------------------------------- digests */
const canon = (v) => (Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {}) : v);
const sha = (v) => crypto.createHash("sha1").update(JSON.stringify(canon(v))).digest("hex").slice(0, 16);
const clone = (v) => JSON.parse(JSON.stringify(v));
function without(obj, paths) {
  const c = clone(obj);
  paths.forEach((p) => {
    let o = c;
    for (let i = 0; i < p.length - 1 && o && typeof o === "object"; i++) o = o[p[i]];
    if (o && typeof o === "object") delete o[p[p.length - 1]];
  });
  return c;
}
const contentDigest = (obj, kind) => sha(without(obj, CLOCKS[kind]));

/* The manager's two squads, from the engine the app uses (the same call pipeline/plan.cjs and weekly.cjs make). The
   engine gets a copy, so nothing it caches can reach a digest. */
const MCE = require(path.join(ROOT, "src", "mc_engine.js"));
function view(s) {
  const d = s.data, M = MCE.create(clone(d)), cs = M.classicSquad();
  const next = d.gw.next, ev = (d.gw.events || []).find((e) => e.id === next) || {}, dev = ((d.draft || {}).events || {})[next] || {};
  return {
    P: new Map((d.players || []).map((p) => [p.id, p])),
    classic: cs.squad.map((p) => p.id), draft: M.draftRoster().map((p) => p.id), bank: cs.bank, ft: cs.ft,
    next, lastDone: d.gw.lastDone, dl: ev.dl || null, wv: dev.wv || null, tr: dev.tr || null
  };
}
const byId = (a, b) => a - b;
function decisionParts(s, v) {
  const mine = [...new Set(v.classic.concat(v.draft))].sort(byId).map((id) => {
    const p = v.P.get(id) || {};
    return [id, p.pr, p.st, p.cop == null ? null : p.cop, p.news || ""];
  });
  return {
    export: s.input.hash,
    gameweek: [v.next, v.lastDone],
    deadlines: [v.dl, v.wv, v.tr],
    squads: [v.classic.slice().sort(byId), v.draft.slice().sort(byId), v.bank, v.ft],
    players: mine
  };
}
const PART_WORDS = {
  export: "the export hash",
  gameweek: "the gameweek in play",
  deadlines: "the next deadlines",
  squads: "your squads",
  players: "prices, flags or news on your players"
};

/* ---------------------------------------------------------------- the stale guard */
function staleProblems(b, a, vb, va, since, withPlan) {
  const out = [];
  if (va.next < vb.next) out.push("the pulled block's next gameweek is GW" + va.next + ", behind the committed GW" + vb.next);
  if (va.lastDone < vb.lastDone) out.push("the pulled block's last finished gameweek is GW" + va.lastDone + ", behind the committed GW" + vb.lastDone);
  const ln = Number(a.live.next_event), lb = Number(b.live.next_event);
  if (Number.isFinite(ln) && Number.isFinite(lb) && ln < lb) out.push("the pulled live.json's next gameweek is GW" + ln + ", behind the committed GW" + lb);
  if (Number.isFinite(ln) && ln !== va.next) out.push("the block says the next gameweek is GW" + va.next + " and live.json says GW" + ln + ": one of the two pulls caught the game mid-rollover");
  if (a.input.next !== va.next) out.push("the solver input was exported for GW" + a.input.next + " but the block's next gameweek is GW" + va.next);
  if (withPlan && a.plan.hash !== a.input.hash) out.push("plan.json was solved on " + a.plan.hash + " but the solver input exports " + a.input.hash);
  if (since) {
    const t0 = Date.parse(since);
    [["mc_data.json asOf", a.data.asOf], ["mc_data.json model.at", a.data.model && a.data.model.at], ["live.json fetched_at", a.live.fetched_at], ["solver_in.json at", a.input.at]]
      .forEach(([name, at]) => { if (!(Date.parse(at) >= t0)) out.push(name + " is " + (at || "missing") + ", earlier than this run's start (" + since + "): the stage that writes it did not run"); });
  }
  return out;
}

/* ---------------------------------------------------------------- words */
const pad2 = (n) => String(n).padStart(2, "0");
function sast(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "an unknown time";
  const d = new Date(t + SAST_MS);
  return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + " SAST";
}
function sastDate(iso) {
  const d = new Date(Date.parse(iso) + SAST_MS);
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
}
const money = (x) => "£" + Number(x).toFixed(1) + "m";
const f1 = (x) => (Math.round(Number(x) * 10) / 10).toFixed(1);
const pct = (x) => (Math.round(Number(x) * 1000) / 10).toFixed(1) + "%";
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
function list(items) {
  if (items.length <= 1) return items.join("");
  const shown = items.slice(0, LIST_MAX), more = items.length - shown.length;
  if (more > 0) return shown.join(", ") + " and " + more + " more";
  return shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1];
}
const clip = (s) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, "") + "…" : t; };
const who = (p, id) => (p ? p.n + " (" + p.t + ")" : "player " + id);
function flagOf(p) {
  const word = STATUS[p.st] || "status " + p.st;
  return p.st === "d" && p.cop != null ? word + " at " + p.cop + "%" : word;
}
// "more" or "fewer" against the earlier figure, never a signed number the reader has to parse
function against(now, was) {
  const d = Math.round((now - was) * 10) / 10;
  if (d === 0) return "the same as the committed plan's " + f1(was);
  return f1(Math.abs(d)) + (d > 0 ? " more" : " fewer") + " than the committed plan's " + f1(was);
}
const windowOf = (pl) => (pl && pl.ok && pl.weeks && pl.weeks.length ? "GW" + pl.weeks[0].gw + "–GW" + pl.weeks[pl.weeks.length - 1].gw : null);

/* ---------------------------------------------------------------- the paragraph's parts */
function deadlineSentence(vb, va) {
  const draft = va.wv ? " For that gameweek, Draft " + (va.tr ? "trades close " + sast(va.tr) + " and waivers " : "waivers close ") + sast(va.wv) + "." : "";
  if (va.next !== vb.next) return "The game has moved on from GW" + vb.next + " to GW" + va.next + ": the Classic deadline is " + sast(va.dl) + "." + draft;
  const moved = va.dl !== vb.dl ? ", moved from " + sast(vb.dl) : "";
  return "The next Classic deadline is GW" + va.next + ", " + sast(va.dl) + moved + "." + draft;
}

function squadSentence(vb, va) {
  const parts = [];
  [["Classic fifteen", "classic"], ["Draft roster", "draft"]].forEach(([label, k]) => {
    const was = new Set(vb[k]), now = new Set(va[k]);
    const ins = va[k].filter((id) => !was.has(id)).map((id) => who(va.P.get(id), id));
    const outs = vb[k].filter((id) => !now.has(id)).map((id) => who(vb.P.get(id), id));
    if (ins.length || outs.length) parts.push("your " + label + " changed (in " + (list(ins) || "nobody") + "; out " + (list(outs) || "nobody") + ")");
  });
  return parts.length ? "Since the committed snapshot " + parts.join(", and ") + "." : "";
}

function priceSentence(vb, va) {
  let all = 0;
  va.P.forEach((p, id) => { const q = vb.P.get(id); if (q && q.pr !== p.pr) all++; });
  const mine = va.classic.map((id) => {
    const p = va.P.get(id), q = vb.P.get(id);
    if (!p || !q || p.pr === q.pr) return null;
    return who(p, id) + (p.pr > q.pr ? " up " : " down ") + money(Math.abs(p.pr - q.pr)) + " to " + money(p.pr);
  }).filter(Boolean);
  if (!all) return "No Classic price moved.";
  const game = "Classic prices: " + plural(all, "move", "moves") + " across the game, ";
  return game + (mine.length ? mine.length + (all === 1 ? " on" : " of them on") + " your fifteen: " + list(mine) + "." : "none on your fifteen.");
}

function flagChanges(ids, vb, va) {
  return ids.map((id) => {
    const p = va.P.get(id), q = vb.P.get(id);
    if (!p || !q) return null;
    const same = p.st === q.st && (p.cop == null ? null : p.cop) === (q.cop == null ? null : q.cop);
    if (same) {
      if ((p.news || "") === (q.news || "")) return null;
      return p.news ? who(p, id) + " has new news, \u201c" + clip(p.news) + "\u201d" : who(p, id) + " has no news now (it read \u201c" + clip(q.news) + "\u201d)";
    }
    return who(p, id) + " is now " + flagOf(p) + " (was " + flagOf(q) + ")" + (p.news && p.st !== "a" ? ", \u201c" + clip(p.news) + "\u201d" : "");
  }).filter(Boolean);
}
function flagSentence(vb, va) {
  const c = flagChanges(va.classic, vb, va), d = flagChanges(va.draft, vb, va);
  if (!c.length && !d.length) return "No flag changed on your Classic fifteen or your Draft roster.";
  const bits = [];
  if (c.length) bits.push("Flag changes on your Classic fifteen: " + list(c) + ".");
  bits.push(d.length ? "On your Draft roster: " + list(d) + "." : "None on your Draft roster.");
  if (!c.length) bits[0] = "No flag changed on your Classic fifteen. " + bits[0];
  return bits.join(" ");
}

function action(pl, replay, P) {
  if (!pl || !pl.ok || !pl.weeks || !pl.weeks.length) return null;
  const w = pl.weeks[0], r = (replay || []).find((x) => x.gw === w.gw) || {};
  const cap = P.get(w.cap), capName = cap ? cap.n : "player " + w.cap;
  if (w.chip) return "play " + (CHIP[w.chip] || w.chip) + " with " + capName + " captain";
  const moves = Number(r.moves) || 0, hits = Number(r.hits) || 0;
  if (!moves) return "roll " + (Number(r.ftBefore) === 1 ? "the free transfer" : "the free transfers") + " with " + capName + " captain";
  return "make " + plural(moves, "transfer", "transfers") + (hits ? " at a cost of " + hits + " points in hits" : "") + " with " + capName + " captain";
}

function planSentence(b, a, vb, va) {
  const pb = b.plan, pa = a.plan, hb = b.input.hash, ha = a.input.hash;
  const cB = pb.plan, cA = pa.plan, wB = windowOf(cB), wA = windowOf(cA);
  const dEndA = a.input.dEnd, dEndB = b.input.dEnd;
  const draftNow = pa.draft && pa.draft.ok ? pa.draft : null, draftWas = pb.draft && pb.draft.ok ? pb.draft : null;
  if (ha === hb) {
    const same = contentDigest(pa, "plan") === contentDigest(pb, "plan");
    return "The export hash is unchanged (" + ha + "), so the plan was not re-solved" + (same ? "" : " and pipeline/plan.cjs rewrote it from the same solve") +
      ": the Classic plan expects " + (cA && cA.ok ? f1(cA.total) + " points over " + wA : "nothing, no plan is solved") +
      (draftNow ? ", and the Draft roster solve is worth " + f1(draftNow.value) + " expected points to GW" + dEndA : "") + ".";
  }
  const out = [];
  const solve = cA && cA.ok ? " in " + Math.round(cA.secs) + " s with a proven gap of " + pct(cA.gap) : "";
  out.push("The export hash moved from " + hb + " to " + ha + ", so the plan was re-solved on this data" + solve + ".");
  if (cA && cA.ok) {
    let s = "Classic: " + f1(cA.total) + " expected points over " + wA;
    if (cB && cB.ok && wB === wA) s += ", " + against(cA.total, cB.total);
    else if (cB && cB.ok) s += "; the committed plan's " + f1(cB.total) + " covered " + wB + ", a different window, so the two are not compared";
    const now = action(cA, pa.replay && pa.replay.weeks, va.P), was = action(cB, pb.replay && pb.replay.weeks, vb.P);
    const gw = cA.weeks[0].gw;
    if (now && was && cB.weeks[0].gw === gw) s += now === was ? "; for GW" + gw + " it still says to " + now : "; for GW" + gw + " it now says to " + now + ", where it said to " + was;
    else if (now) s += "; for GW" + gw + " it says to " + now;
    out.push(s + ".");
  } else out.push("Classic: the solve returned no plan.");
  if (draftNow) {
    let s = "Draft: the solved roster is worth " + f1(draftNow.value) + " expected points to GW" + dEndA;
    if (draftWas && dEndA === dEndB && vb.next === va.next) s += ", " + against(draftNow.value, draftWas.value);
    s += ", with " + plural((draftNow.pairs || []).length, "claim pair", "claim pairs");
    out.push(s + ".");
  }
  const src = pa.source || {}, word = (x) => (/^stale/.test(String(x)) ? "stale" : /^(absent|incomplete)/.test(String(x || "absent")) ? "absent" : null);
  const tW = word(src.timingFold), lW = word(src.longSolve);
  if (tW || lW) {
    out.push("The chip-timing and long solves were not run on the runner, and plan.json's source records " +
      (tW && tW === lW ? "both the timing file and the long solve as " + tW : [tW ? "the timing file as " + tW : null, lW ? "the long solve as " + lW : null].filter(Boolean).join(" and ")) +
      ", so the plan carries no wildcard now, later or never comparison until they are re-run on an idle machine.");
  }
  return out.join(" ");
}

/* ---------------------------------------------------------------- main */
function main() {
  const o = parseArgs(process.argv.slice(2));
  const b = load(o.before), a = load(o.after);
  const vb = view(b), va = view(a);

  const stale = staleProblems(b, a, vb, va, o.since, !o.check);
  if (stale.length) {
    stale.forEach((s) => console.log("stale: " + s));
    console.log("refresh_note: REFUSED — the pull is not newer than the committed snapshot, so nothing may be proposed as fresh");
    process.exit(3);
  }

  const pb = decisionParts(b, vb), pa = decisionParts(a, va);
  const moved = Object.keys(pa).filter((k) => sha(pa[k]) !== sha(pb[k]));
  const changed = moved.length > 0;
  const resolve = a.input.hash !== b.input.hash;
  const cB = contentDigest(b.data, "data"), cA = contentDigest(a.data, "data");
  const lB = contentDigest(b.live, "live"), lA = contentDigest(a.live, "live");

  if (o.check) {
    const reason = changed
      ? "the decision inputs moved: " + list(moved.map((k) => PART_WORDS[k])) + (resolve ? " (export hash " + b.input.hash + " to " + a.input.hash + ", so the plan is re-solved)" : " (export hash unchanged at " + a.input.hash + ", so the committed plan stands)")
      : "nothing a decision rests on moved (export hash " + a.input.hash + ", the GW" + va.next + " deadlines, your squads and your players' prices, flags and news)" +
        (cA !== cB || lA !== lB ? "; only figures that change no decision moved, such as ownership and transfer counts" : "; the block and live.json are identical once their clocks are set aside");
    [["changed", changed ? 1 : 0], ["resolve", resolve ? 1 : 0], ["moved", moved.join(",") || "none"],
      ["decision_before", sha(pb)], ["decision_after", sha(pa)], ["content_before", cB], ["content_after", cA],
      ["live_before", lB], ["live_after", lA], ["export_before", b.input.hash], ["export_after", a.input.hash],
      ["next_gw", va.next], ["deadline", va.dl || ""], ["deadline_sast", sast(va.dl)], ["reason", reason]]
      .forEach(([k, v]) => console.log(k + "=" + v));
    return;
  }

  let note;
  if (!changed) {
    note = "Nothing to propose. The pull of " + sast(a.data.asOf) + " matches the committed snapshot of " + sast(b.data.asOf) +
      " on everything a decision rests on: the export hash (" + a.input.hash + "), the GW" + va.next + " Classic deadline (" + sast(va.dl) + ")" +
      (va.wv ? " and Draft waivers (" + sast(va.wv) + ")" : "") + ", both squads, and the price, status and news of every player in your Classic fifteen and Draft roster." +
      (cA !== cB || lA !== lB
        ? " Figures that change no decision, such as ownership and transfer counts, did move (content digest " + cB + " to " + cA + "), so no pull request is opened for them."
        : " The block and live.json are identical to the committed ones once their clock fields are set aside (content digest " + cA + ").");
  } else {
    note = ["Pulled " + sast(a.data.asOf) + " and compared with the committed snapshot of " + sast(b.data.asOf) + ".",
      deadlineSentence(vb, va), squadSentence(vb, va), priceSentence(vb, va), flagSentence(vb, va), planSentence(b, a, vb, va)]
      .filter(Boolean).join(" ");
  }
  const onFifteen = va.classic.filter((id) => { const p = va.P.get(id), q = vb.P.get(id); return p && q && p.pr !== q.pr; }).length;
  const title = "FPL refresh " + sastDate(a.data.asOf) + ": " + (changed
    ? "GW" + va.next + " data, plan " + (resolve ? "re-solved" : "unchanged") + (onFifteen ? ", " + plural(onFifteen, "price move", "price moves") + " on your Classic fifteen" : "")
    : "nothing to propose");
  if (o.out) fs.writeFileSync(o.out, note + "\n");
  if (o.title) fs.writeFileSync(o.title, title + "\n");
  console.log(note);
}

main();

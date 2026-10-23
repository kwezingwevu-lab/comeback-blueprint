#!/usr/bin/env node
/* pipeline/partm.cjs — write Part M of CLAUDE.md (the human-readable copy of the plan of record) from the files the
   app ships, so the block is generated and never typed (CLAUDE.md N4: Part M is the one place a gameweek, a deadline
   or a price may be written, dated, with the words "verify before trusting").

   node pipeline/partm.cjs [--date YYYY-MM-DD] [--replaced "<one sentence on the plan this one replaces>"] [--print]

   Reads data/plan.json (the plan, the timing cases, the free-hit weeks, the gameweek / month / season lenses),
   data/mc_data.json (names, flags, deadlines, the Draft calendar), data/weekly.js (locks, the C2 fallback, the Draft
   claims) and data/pre.json (the claims sheet's stress test). The paragraph "What happened to the plans before this
   one" is carried over from the Part M already in CLAUDE.md, with --replaced appended to it: history is kept, not
   regenerated. The Tournament and F4 sentences are carried over too. Writes CLAUDE.md in place unless --print.
   Classic and Draft figures are never added together (N3); every Classic figure is Classic expected points. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const PLAN = read("data/plan.json"), MC = read("data/mc_data.json"), PRE = fs.existsSync(path.join(ROOT, "data/pre.json")) ? read("data/pre.json") : null;
const WEEKLY = new Function(fs.readFileSync(path.join(ROOT, "data/weekly.js"), "utf8") + "; return WEEKLY;")();
const M = require(path.join(ROOT, "src", "mc_engine.js")).create(MC);

const P = {}; MC.players.forEach((p) => { P[p.id] = p; });
const nm = (id) => (P[id] ? P[id].n : "#" + id);
const f0 = (x) => String(Math.round(x)), f1 = (x) => (Math.round(x * 10) / 10).toFixed(1), f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const sgn = (x) => (x >= 0 ? "+" : "-") + f2(Math.abs(x));
const cash = (x) => "£" + Number(x).toFixed(1) + "m";
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sast = (iso) => { const d = new Date(Date.parse(iso) + 2 * 3600000); return DAY[d.getUTCDay()] + " " + d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + " SAST"; };
const andList = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const CHIP = { wildcard: "Wildcard 1", bboost: "Bench Boost", "3xc": "Triple Captain", freehit: "Free Hit" };
const date = opt("--date") || new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 10);

const pl = PLAN.plan, w = pl.weeks[0], gw = w.gw, last = pl.weeks[pl.weeks.length - 1].gw, rp = PLAN.replay.weeks[0];
const ev = MC.gw.events.find((e) => e.id === gw);
const flagged = (id) => { const p = P[id]; return p && (p.st !== "a" || (p.cop !== null && p.cop !== undefined && p.cop < 100)); };
const flagTxt = (id) => nm(id) + " " + P[id].st + " " + (P[id].cop === null || P[id].cop === undefined ? "" : P[id].cop + "%");
const own = M.classicSquad().squad.map((p) => p.id);

/* Classic */
const wc = w.chip === "wildcard";
const sells = w.out.map(nm), buys = w.in.map(nm), keeps = own.filter((i) => w.squad.includes(i)).map(nm);
let lead;
if (wc) lead = "play Wildcard 1";
else if (w.in.length) lead = "make " + w.in.length + (w.in.length === 1 ? " transfer" : " transfers") + (w.chip ? " and play the " + CHIP[w.chip] : "");
else lead = w.chip ? "play the " + CHIP[w.chip] + " with no transfer" : "roll the transfer";
const ftAfter = rp.ftAfter, hits = rp.hitCount;
const later = pl.weeks.slice(1).filter((x) => x.chip).map((x) => "**" + CHIP[x.chip] + " GW" + x.gw + "**" + (x.chip === "3xc" || x.chip === "bboost" ? " (captain " + nm(x.cap) + ")" : ""));
const fh = (PLAN.freeHit || []).filter((f) => f.free).sort((a, b) => b.gain - a.gain)[0];
const T = PLAN.timing, tol = (pl.gap || 0) * pl.total;
const wcWeek = pl.weeks.find((x) => x.chip === "wildcard");
let timing = "";
const choice = pl.managerChoice && T && T.now ? T.now : null;   // E-179/E-181: the plan of record is the manager's; the solver's best is priced beside it
const wcOf = (r) => ((r && r.weeks) || []).find((x) => x.chip === "wildcard");
if (choice && T.never) {
  timing = " The solver's own best under the GW13 rule plays the wildcard in GW" + ((wcOf(choice) || {}).gw || "—") + ": " + f2(choice.total) + " (" + sgn(choice.total - pl.total) + " against your GW" + (wcWeek ? wcWeek.gw : last) + " choice)." +
    " Never: " + f2(T.never.total) + " (" + sgn(T.never.total - pl.total) + ")." +
    " The proof's tolerance is about " + f1(tol) + " points.";
} else if (T && T.later && T.never) {
  const lw = (T.later.weeks || []).find((x) => x.chip === "wildcard");
  timing = (wc ? " Wildcard in GW" + (lw ? lw.gw : "a later week") + " instead: " + f2(T.later.total) + " (" + sgn(T.later.total - pl.total) + ")."
    : " The wildcard: " + (wcWeek ? "the plan plays it in GW" + wcWeek.gw : "the plan keeps it to GW" + last) + "; the best plan that holds it until GW" + (gw + 1) + " or later is worth " + f2(T.later.total) + (lw ? " (wildcard GW" + lw.gw + ")" : "") + ".") +
    " Never: " + f2(T.never.total) + " (" + sgn(T.never.total - pl.total) + ")." +
    (T.latest ? " Wildcard as late as the rules allow, GW" + ((T.latest.weeks || []).slice(-1)[0] || {}).gw + ": " + f2(T.latest.total) + " (" + sgn(T.latest.total - pl.total) + "), built from the never plan, a floor." : "") +
    " The proof's tolerance is about " + f1(tol) + " points.";
}
const locks = (WEEKLY.classic.locks || []).filter((i) => w.squad.includes(i)).map(nm);
let classic = "**Classic GW" + gw + ": " + lead + "** (deadline " + sast(ev.dl) + "). " +
  (wc ? w.in.length + " of fifteen change. " : "") +
  (w.in.length ? "Sell " + sells.join(", ") + "; buy " + buys.join(", ") + (hits ? " (" + hits + (hits === 1 ? " hit, −4" : " hits, −" + 4 * hits) + ")" : "") + ". " : "") +
  (wc && keeps.length ? keeps.join(", ") + (keeps.length === 1 ? " stays. " : " stay. ") : "") +
  "Captain **" + nm(w.cap) + "**, vice **" + nm(w.vice) + "**. " + cash(rp.bank) + " in the bank, " +
  (wc ? ftAfter + " free transfers kept (a wildcard week keeps the count)." : ftAfter + (ftAfter === 1 ? " free transfer" : " free transfers") + " into GW" + (gw + 1) + ".") +
  (later.length ? " Then " + later.join(", ") + "." : "") +
  (fh ? " The free hit is held (best week GW" + fh.gw + ", " + sgn(fh.gain) + ")." : "") +
  " The plan is worth " + f2(pl.total) + " Classic expected points to GW" + last + (choice ? ", the proven no-wildcard plan (within " + ((pl.gap || 0) * 100).toFixed(2) + "% of the best plan without a wildcard) to GW" + (((wcWeek || {}).gw || last) - 1) + " with the fifteen rebuilt in GW" + ((wcWeek || {}).gw || last) + ", a plan built from a proof, not itself a solve."
    : ", proved within " + ((pl.gap || 0) * 100).toFixed(2) + "% of the best possible.") + timing +
  (locks.length ? " " + andList(locks) + (locks.length === 1 ? " is the declared lock" : " are the declared locks") + " (at or over the C1.6 rival-ownership gate, kept on purpose)." : "");

/* the gameweek, the month and the season (15 Oct 2026) */
let horizons = "";
const H = PLAN.horizons;
if (H && H.plan && Array.isArray(H.candidates) && H.best) {
  // the same reading as the Plan tab's table (src/ui.jsx, view.horizons): the best of every plan solved on this input,
  // per horizon, and what it takes off the total to the chip stop
  const C = H.candidates, byKey = (k) => C.find((c) => c.key === k) || null, b = H.month.banked || 0, mN = H.month.name, span = "GW" + H.month.start + "–" + H.month.stop;
  const costC = (c) => H.plan.season - c.score.season;
  // E-181: under the manager's choice a candidate that plays the wildcard in another week breaks his rule; never "free"
  const breaks = (c) => !!choice && !!wcWeek && (c.chips || []).some((x) => x.chip === "wildcard" && x.gw !== wcWeek.gw);
  const bitC = (c, label, mine, best) => !c ? "" : label + " " + f1(mine) + (c.key === "plan" || best - mine <= 0.05 ? " (the best found)" :
    " (best found " + f1(best) + " with \u201c" + c.label + "\u201d, costing " + f1(costC(c)) + " to GW" + last + (breaks(c) ? ", but it plays the wildcard in GW" + c.chips.find((x) => x.chip === "wildcard").gw + ", against your GW" + wcWeek.gw + " choice" : costC(c) <= tol + 1e-9 ? ", inside the tolerance: a free choice" : "") + ")");
  const bg = byKey(H.best.gameweek), bm = byKey(H.best.month), bs = byKey(H.best.season);
  horizons = "**Gameweek, month and season** (the manager's ask of 15 Oct 2026; Classic expected points, hits off). " +
    [bitC(bg, "GW" + gw, H.plan.gameweek, bg && bg.score.gameweek),
     bitC(bm, mN + " (" + span + ", " + f0(b) + " banked)", b + H.plan.month, bm && b + bm.score.month),
     bitC(bs, "to GW" + last + (H.seasonBanked !== null && H.seasonBanked !== undefined ? " (+" + f0(H.seasonBanked) + " banked)" : ""), H.plan.season, bs && bs.score.season)]
      .filter(Boolean).join(" · ") + ". The plan of record is never replaced by a lens or a timing case; the Plan tab shows what each would change.";
}

/* Draft */
const dev = (MC.draft.events || {})[String(gw)] || {};
const cl = (WEEKLY.draft.claims || []).map((c) => c.why ? c.why.split(",")[0] : "");
const cs = PRE && PRE.claims ? PRE.claims : null;
let draft = "**Draft GW" + gw + ": " + (cl.length ? cl.length + (MC.draft.waiversProcessed ? (cl.length === 1 ? " move" : " moves") : (cl.length === 1 ? " claim" : " claims")) : (MC.draft.waiversProcessed ? "no move" : "no claim")) + "** (" +
  (dev.wv ? (MC.draft.waiversProcessed ? "waivers settled " : "waivers settle ") + sast(dev.wv) : "waiver time not in the feed") + (dev.tr ? "; trades close " + sast(dev.tr) : "") + "). " +
  (MC.draft.waiversProcessed
    ? (cl.length ? (function () {
        // after the run (CLAUDE.md N2): weekly.cjs writes each line as "sign now" or "locked until the next waiver run"
        const now = [], later = [];
        (WEEKLY.draft.claims || []).forEach((c, i) => (/sign now/.test(c.why || "") ? now : later).push(cl[i]));
        return (now.length ? "Sign now, as free agents: " + now.join("; ") + ". " : "") + (later.length ? "Locked until the next waiver run, so claim then: " + later.join("; ") + ". " : "");
      })() : "")
    : (cl.length ? "Lodge in this order: " + cl.join("; ") + ". " : "") +
  (cs && isFinite(cs.valueStress) ? "Worth " + f1(cs.valueStress) + " Draft expected points to GW" + M.CFG.draftEnd + " under the stress test, a mean of " + f1(cs.meanValue) + " over " + cs.runs + " simulated waiver runs, against " + f1(cs.valueNow) + " today." : ""));

/* the leagues to GW19 (the manager's ask of 15 Oct 2026: "a clear plan to win draft and all my mini leagues by the end of
   gw19"). Classic from the engine's leagueRoute on data/live.json with the plan's own weekly rate; Draft from the ported
   engine's titleRace on the app's draws and seed. Points, wins and places only: no chance of winning (E4). */
let leagues = "";
try {
  const EG = require(path.join(ROOT, "src", "engine.js")), LIVE = read("data/live.json");
  const R = EG.leagueRoute(EG.buildCtx(LIVE, null, Date.now()), { end: last, planPerWeek: pl.weeks.reduce((a, x) => a + x.epNet, 0) / pl.weeks.length });
  const st = R.leagues.filter((x) => x.started && x.leader && x.gap > 0);
  const paces = st.map((x) => x.leader.pace).filter((x) => x !== null);
  const closeG = st.filter((x) => x.overtakeGwAtGame !== null), shortG = st.filter((x) => x.overtakeGwAtGame === null);
  const atPace = st.filter((x) => x.overtakeGw !== null);
  const classicL = "Classic, " + R.weeksLeft + " gameweeks: " + st.map((x) => x.name + " −" + x.gap + " (" + f1(x.need) + " a week; the leader " +
    (x.leader.pace === null ? "unread" : "averaging " + f1(x.leader.pace)) + ", chips left " + (x.leader.chipsLeft ? (x.leader.chipsLeft.join(" ") || "none") : "unread") + ")").join("; ") +
    ". The plan expects " + f1(R.planPerWeek) + " a week; you have averaged " + f1(R.mine.pace) + ", the game " + f1(R.gamePace) +
    (paces.length ? ", the leaders " + f1(Math.min.apply(null, paces)) + " to " + f1(Math.max.apply(null, paces)) + " (chips spent included)" : "") + ". " +
    (atPace.length ? "At the leaders' pace the plan alone overtakes in " + andList(atPace.map((x) => x.name)) + ". " : "At the leaders' pace no league closes on expected points alone. ") +
    (closeG.length ? "If they fall back to the game's average it takes " + andList(closeG.map((x) => x.name + " by GW" + x.overtakeGwAtGame)) + ". " : "") +
    ((() => { const spent = st.filter((x) => x.leader.chipsLeft && x.leader.chipsLeft.length <= 2); return spent.length ? "The leaders of " + andList(spent.map((x) => x.name + " (" + (4 - x.leader.chipsLeft.length) + " spent)")) + " have already played at least two set-1 chips, so their pace so far has had help you still hold. " : ""; })()) +
    (shortG.length ? andList(shortG.map((x) => x.name)) + " need more than expected points: a choice level on expected points goes to the player and captain fewer of that league own, and the chips are the swing (you hold " + R.mine.chipsLeft.length + " of 4; the leaders " + R.chipsHeldByLeaders + " of " + 4 * st.filter((x) => x.leader.chipsLeft).length + ")." : "");
  const D = M.titleRace(MC.gw.next, Math.min(19, M.CFG.draftEndApi), EG.DRAFT_ROUTE_DRAWS, EG.DRAFT_ROUTE_SEED), me = MC.draft.me;
  const nowPts = {}; MC.draft.standings.forEach((x) => { nowPts[x.name] = x.pts; });
  const mineD = D.find((x) => x.name === me), oth = D.filter((x) => x.name !== me).sort((a, b) => b.pts - a.pts);
  const dEnd = Math.min(19, M.CFG.draftEndApi), games = MC.draft.matches.filter((m) => !m.fin && m.gw >= MC.gw.next && m.gw <= dEnd && (m.a === me || m.b === me));
  const top2 = oth.slice(0, 2).map((x) => x.name), sixes = games.filter((m) => top2.includes(m.a === me ? m.b : m.a)).map((m) => "GW" + m.gw + " " + (m.a === me ? m.b : m.a));
  const myRank = (MC.draft.standings.find((x) => x.name === me) || {}).rank;
  const needW = Math.max(0, Math.ceil((oth[0].pts - nowPts[me]) / 3 - 1e-9));
  const strongest = oth.slice().sort((a, b) => b.strength - a.strength)[0];
  const draftL = "Draft, " + games.length + " matches to GW" + dEnd + ": " + (myRank ? "rank " + myRank + " of " + MC.draft.standings.length + " on " : "") + nowPts[me] + " league points. The engine's race (" +
    EG.DRAFT_ROUTE_DRAWS + " draws, today's rosters) expects " + f1(mineD.pts) + " against " + f1(oth[0].pts) + " for " + oth[0].name + ": first takes about " + Math.ceil(oth[0].pts) + ", so about " + needW + " wins of " + games.length +
    " against " + f1((mineD.pts - nowPts[me]) / 3) + " expected. " + (sixes.length ? sixes.length + " are six-pointers (" + sixes.join(", ") + "). " : "") +
    "Your eleven is expected to score " + f1(mineD.strength) + " a week" + (strongest && mineD.strength >= strongest.strength ? ", the most in the league: the deficit is the table, not the team." : " against " + f1(strongest.strength) + " for the strongest.");
  leagues = "**Leagues to GW19** (the manager's ask of 15 Oct 2026; Classic and Draft never added together; points, wins and places, no chance of winning, E4). " + classicL + " " + draftL;
} catch (e) { leagues = "**Leagues to GW19:** not written (" + e.message + ")."; }

/* flags */
const dIds = M.draftRoster().map((p) => p.id);
const cf = own.filter(flagged).map(flagTxt), df = dIds.filter(flagged).map(flagTxt), pf = w.squad.filter(flagged).map(flagTxt);
const flags = "**Flags on both fifteens (" + date + "):** Classic — " + (cf.length ? cf.join(", ") : "none") + ". Draft — " + (df.length ? df.join(", ") : "none") + ". " +
  (pf.length ? "The plan's GW" + gw + " fifteen carries " + pf.join(", ") + "." : "The plan's GW" + gw + " fifteen carries no flagged player.");

/* carried over: the history paragraph and the Tournament / F4 sentences */
const cm = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
const a = cm.indexOf("# PART M"), z = cm.indexOf("\n---\n", a);
if (a < 0 || z < 0) { console.error("partm.cjs: no Part M in CLAUDE.md"); process.exit(3); }
const old = cm.slice(a, z);
const hm = old.match(/\*\*What happened to the plans before this one\.\*\*[\s\S]*?(?=\n\n\*\*)/);
let history = hm ? hm[0].trim() : "**What happened to the plans before this one.** (no earlier record in this file)";
if (opt("--replaced")) history += " " + opt("--replaced").trim();
const tm = old.match(/\*\*Tournament:\*\*[\s\S]*$/);
const used = (MC.classic.chipsUsed || []).map((c) => c.name + " GW" + c.gw);
const chips = "**Chips:** " + (used.length ? "used " + used.join(", ") : "all four of both sets unused") + ". Set 1 expires at the GW" + MC.rules.chipStop + " deadline." + (tm ? " " + tm[0].trim() : "");

const block = ["# PART M — CURRENT PLAN (v110 · " + date + " · verify before trusting)",
  "> The plan of record is `data/plan.json` (the optimiser's, replayed from the rules) and `data/weekly.js`, which\n> `pipeline/weekly.cjs` writes from it. Nothing here is an input: this block is the human-readable copy, written\n> by `pipeline/partm.cjs` from those files at the moment of writing, dated, and it carries the record of the plan it replaced.",
  history, classic].concat(horizons ? [horizons] : []).concat([draft]).concat(leagues ? [leagues] : []).concat([flags, chips]).join("\n\n") + "\n";
if (args.includes("--print")) { process.stdout.write(block); process.exit(0); }
fs.writeFileSync(path.join(ROOT, "CLAUDE.md"), cm.slice(0, a) + block + cm.slice(z));
console.log("partm.cjs wrote Part M of CLAUDE.md for GW" + gw + " (" + date + "), plan " + PLAN.hash);

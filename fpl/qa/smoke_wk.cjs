/*
 * qa/smoke_wk.cjs — every recommendation this app can put on screen, checked against
 * the live API and against the six rules (CLAUDE.md H1 "smoke_wk" row, bar 32/32).
 *
 * Two sources, deliberately separated (CLAUDE.md H2):
 *   - a fresh pull of fantasy.premierleague.com / draft.premierleague.com is used wherever
 *     the check is a RECONCILIATION (deadline, a buy's availability, a flag, the draft
 *     waiver window). If the network is unreachable those checks fall back to
 *     data/live.json and the SUITE line says so — a reconciliation against the snapshot
 *     is a weaker statement and is never reported as if it were the live one.
 *   - data/live.json is used wherever the check is an ENGINE PROPERTY (legality, budget,
 *     margin, P(start), team strength, the draft code join).
 *
 * Two checks are read out of the real UI through the harness (the deadline as shown and
 * the wildcard timing series as shown), because "the numbers shown" is the claim.
 *
 * Run: node qa/smoke_wk.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");
const H = require("./harness.cjs");

const ROOT = H.ROOT;
const E = require(path.join(ROOT, "src", "engine.js"));
const LIVE = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "live.json"), "utf8"));
const STATE = JSON.parse(fs.readFileSync(path.join(ROOT, "state", "kwezi.json"), "utf8"));
const WEEKLY = new Function(fs.readFileSync(path.join(ROOT, "data", "weekly.js"), "utf8") + "\nreturn WEEKLY;")();

const assert = H.assert;
const ENTRY = 3546875;

// Mocked time (H2): the snapshot's own fetched_at, so every relative number in this file
// is reproducible whatever day the suite is run.
const NOW = LIVE.fetched_at;

const ctx = E.buildCtx(LIVE, STATE, NOW);
const SELL_GAIN_MIN = 4;
const CONVERGENCE = 0.60;

const nm = (id) => (ctx.els[id] ? ctx.els[id].web_name : "id " + id);
const list = (ids) => ids.map(nm).join(", ") || "none";
const fx1 = (x) => Number(x).toFixed(1);

// ---------------------------------------------------------------- the recommendations under test

const tp = E.transferProtocol(null, ctx);
const wc = E.wildcardSolver(ctx, {});
const timing = E.wildcardTiming(ctx);
const squad = ctx.squadIds.slice();
const inSquad = new Set(squad);

const WRITTEN = WEEKLY.classic || {};
const fbMoves = (WRITTEN.fallback && WRITTEN.fallback.moves) || [];
const fbSquad = squad.filter((id) => !fbMoves.some((m) => Number(m.out) === id)).concat(fbMoves.map((m) => Number(m.in)));
const fbXI = E.bestXI(fbSquad, ctx);
const postSquad = squad.filter((id) => !tp.moves.some((m) => m.out === id)).concat(tp.moves.map((m) => m.in));
const postXI = E.bestXI(postSquad, ctx);
const wcXI = wc.ok && wc.xi ? wc.xi : { ids: [], capId: null, bench: [] };

// Every player the app proposes to BUY, on any path it can take this week.
const buys = [...new Set([].concat(
  tp.moves.map((m) => Number(m.in)),
  wc.ok ? wc.ids.filter((id) => !inSquad.has(id)) : [],
  fbMoves.map((m) => Number(m.in))
))].sort((a, b) => a - b);

// Every player it proposes to SELL.
const sells = [...new Set([].concat(
  tp.moves.map((m) => Number(m.out)),
  fbMoves.map((m) => Number(m.out))
))].sort((a, b) => a - b);

// Every fifteen it can display.
const fifteens = [
  { label: "engine wildcard fifteen", ids: wc.ok ? wc.ids : [], budget: ctx.budget },
  { label: "written wildcard fifteen (weekly block)", ids: (WRITTEN.wildcard15 || []).map(Number), budget: ctx.budget },
  { label: "fifteen after the transfer plan", ids: postSquad, budget: null },
  { label: "fifteen after the written fallback", ids: fbSquad, budget: null },
  { label: "the fifteen owned today", ids: squad, budget: null }
].filter((f) => f.ids.length);

// Every captain it can name.
const captains = [
  { label: "wildcard path", id: wcXI.capId, xi: wcXI.ids },
  { label: "fallback path", id: fbXI.capId, xi: fbXI.ids },
  { label: "written fallback captain", id: Number(WRITTEN.captain) || null, xi: fbXI.ids },
  { label: "transfer plan", id: tp.captain, xi: tp.xi || postXI.ids }
].filter((c) => c.id);

// ---------------------------------------------------------------- fresh pull (reconciliations only)

const API = "https://fantasy.premierleague.com/api";
const DRAFT_API = "https://draft.premierleague.com/api";
let FRESH = null;           // {boot, draft} or null when offline
let OFFLINE_WHY = "";

async function getJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "user-agent": "fpl-mission-control-qa" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
  return r.json();
}
async function pull() {
  try {
    const [boot, draft] = await Promise.all([getJSON(API + "/bootstrap-static/"), getJSON(DRAFT_API + "/bootstrap-static")]);
    FRESH = { boot: boot, draft: draft, byId: new Map(boot.elements.map((e) => [Number(e.id), e])) };
  } catch (e) {
    OFFLINE_WHY = e && e.message ? String(e.message) : String(e);
    FRESH = null;
  }
}
// The live view of one classic element: fresh when the API answered, the snapshot otherwise.
function liveEl(id) {
  if (FRESH && FRESH.byId.has(Number(id))) {
    const b = FRESH.byId.get(Number(id));
    return { id: Number(b.id), web_name: b.web_name, status: b.status, chance: b.chance_of_playing_next_round === undefined ? null : b.chance_of_playing_next_round, starts: Number(b.starts), now_cost: Number(b.now_cost), src: "live" };
  }
  const l = ctx.els[id];
  return l ? { id: Number(l.id), web_name: l.web_name, status: l.status, chance: l.chance === undefined ? null : l.chance, starts: Number(l.starts), now_cost: Number(l.now_cost), src: "snapshot" } : null;
}
const SRC = () => (FRESH ? "live API" : "snapshot (offline)");
function flaggedLive(e) { return !e || e.status !== "a" || (e.chance !== null && e.chance < 100); }

// ---------------------------------------------------------------- the UI pass

async function collectUI() {
  const out = { ok: false, why: "", status: "", landing: "", timing: "", draftRows: [], draftText: "" };
  let browser = null;
  try {
    browser = await H.launch();
    const page = await browser.newPage();
    await H.open(page, {
      mode: "full", state: STATE, now: NOW,
      ui: { mode: "full", tab: "command", open: {}, reveals: {} },
      mocks: { "https://fantasy.premierleague.com/**": (route) => route.abort(), "https://api.anthropic.com/**": (route) => route.abort() }
    });
    out.status = await page.evaluate(() => { const e = document.querySelector('[data-testid="status"]'); return e ? e.innerText : ""; });
    out.landing = await page.evaluate(() => { const e = document.querySelector(".landing"); return e ? e.innerText : ""; });

    await page.click('[data-testid="tab-plan"]');
    await page.waitForSelector('[data-section="plan-time"]', { timeout: 15000 });
    await page.click('[data-testid="sec-plan-time"]');
    await page.waitForFunction(() => {
      const s = document.querySelector('[data-section="plan-time"]');
      return !!s && /Weekly gap/.test(s.innerText);
    }, null, { timeout: 20000 });
    out.timing = await page.evaluate(() => document.querySelector('[data-section="plan-time"]').innerText);

    await page.click('[data-testid="tab-draft"]');
    await page.waitForFunction(() => {
      const s = document.querySelector('[data-section="df-waivers"]');
      return !!s && /waivers process/.test(s.innerText);
    }, null, { timeout: 20000 });
    out.draftText = await page.evaluate(() => document.querySelector('[data-section="df-waivers"]').innerText);
    out.draftRows = await page.evaluate(() => Array.prototype.map.call(
      document.querySelectorAll('[data-section="df-waivers"] .row'),
      (r) => r.innerText.replace(/\s+/g, " ").trim()
    ));
    out.ok = true;
  } catch (e) {
    out.why = e && e.message ? String(e.message) : String(e);
  } finally {
    if (browser) { try { await browser.close(); } catch (e) { /* nothing left to close */ } }
  }
  return out;
}

// SAST, computed here rather than borrowed from the app, so the two can disagree.
function sast(iso) {
  const t = Date.parse(iso);
  if (!isFinite(t)) return "";
  const d = new Date(t + 2 * 3600000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[d.getUTCDay()] + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}

// ---------------------------------------------------------------- checks

async function main() {
  await pull();
  const ui = await collectUI();

  // ---- 1 · the deadline the app works to is the live is_next deadline
  {
    const liveNext = FRESH ? (FRESH.boot.events.filter((e) => e.is_next)[0] || null) : (LIVE.events.filter((e) => e.is_next)[0] || null);
    const want = liveNext ? String(liveNext.deadline_time) : null;
    assert("deadline-equals-events-is-next",
      !!want && String(ctx.deadline) === want && Number(ctx.nextEvent) === Number(liveNext.id),
      "app GW" + ctx.nextEvent + " " + String(ctx.deadline) + " vs " + SRC() + " is_next GW" + (liveNext ? liveNext.id : "?") + " " + String(want));
  }

  // ---- 2 · and that deadline is what the page actually shows
  {
    const want = sast(ctx.deadline);
    const okGw = /\bGW4\b|\bGW\d+\b/.test(ui.status) && ui.status.indexOf("GW" + ctx.nextEvent) >= 0;
    const okDl = ui.landing.indexOf(want) >= 0;
    assert("deadline-shown-on-the-page",
      ui.ok && okGw && okDl,
      ui.ok ? "header \"" + ui.status.replace(/\n/g, " · ") + "\"; landing " + (okDl ? "names " + want : "does not name " + want) : "the page did not render: " + ui.why);
  }

  // ---- 3 · C1 rule 1: a sell has no starts in three, or the gain clears the hit with margin
  {
    const bad = [];
    tp.moves.forEach((m) => {
      const gs = ctx.gwStats[m.out] || { starts_last3: 0 };
      if (gs.starts_last3 === 0) return;
      if (m.gain > SELL_GAIN_MIN) return;
      bad.push(nm(m.out) + " has " + gs.starts_last3 + " starts and gains only " + m.gain.toFixed(2));
    });
    assert("sells-have-no-starts-in-three-or-beat-the-hit-by-four",
      !bad.length,
      tp.moves.length + " sells: " + tp.moves.map((m) => nm(m.out) + (m.forced ? " (forced, " + (ctx.gwStats[m.out] || {}).starts_last3 + "/3 starts)" : " (+" + m.gain.toFixed(2) + " xp5)")).join("; ") + (bad.length ? " — " + bad.join("; ") : ""));
  }

  // ---- 4 · E-010: never sell a player who started his club's last match after a spell out
  {
    const protectedIds = squad.filter((id) => (ctx.gwStats[id] || {}).konsa === true);
    const bad = sells.filter((id) => (ctx.gwStats[id] || {}).konsa === true);
    assert("sells-respect-the-konsa-rule",
      !bad.length && protectedIds.length > 0,
      "protected (returned to the XI after a spell out): " + list(protectedIds) + "; proposed sells: " + list(sells) + (bad.length ? " — SOLD A PROTECTED PLAYER: " + list(bad) : ""));
  }

  // ---- 5 · every buy is available in the live API
  {
    const bad = buys.filter((id) => { const e = liveEl(id); return !e || e.status !== "a"; });
    assert("buys-are-status-a-live",
      buys.length > 0 && !bad.length,
      buys.length + " buys checked against the " + SRC() + ": " + buys.map((id) => { const e = liveEl(id); return nm(id) + " " + (e ? e.status : "missing"); }).join(", "));
  }

  // ---- 6 · and has actually been starting
  {
    const bad = buys.filter((id) => { const e = liveEl(id); const gs = ctx.gwStats[id] || { starts_last3: 0 }; return !e || !(e.starts >= 1) || gs.starts_last3 < 1; });
    assert("buys-have-started-recently",
      buys.length > 0 && !bad.length,
      buys.map((id) => nm(id) + " " + (ctx.gwStats[id] || {}).starts_last3 + "/3 starts, " + (liveEl(id) || {}).starts + " this season").join("; ") + (bad.length ? " — failing: " + list(bad) : ""));
  }

  // ---- 7 · E-019: no flagged player is ever bought
  {
    const bad = buys.filter((id) => flaggedLive(liveEl(id)));
    assert("buys-are-unflagged-live",
      !bad.length,
      "no flag on any of the " + buys.length + " buys per the " + SRC() + (bad.length ? " — flagged: " + bad.map((id) => { const e = liveEl(id); return nm(id) + " " + e.status + " " + e.chance + "%"; }).join(", ") : ""));
  }

  // ---- 8 · E-021: no buy the rivals already own (≥60%) without an explicit lock
  {
    // A lock is the only exemption the solver takes (wildcardSolver opts.locks); the weekly
    // block is where one would be declared, and this week declares none.
    const locks = new Set(((WRITTEN.locks) || []).map(Number));
    const bad = buys.filter((id) => !locks.has(id) && E.convergenceRisk(id, ctx).risk);
    const worst = buys.map((id) => ({ id: id, own: E.rivalOwnMax(id, ctx).max })).sort((a, b) => b.own - a.own)[0];
    const excluded = (WRITTEN.wildcard15 || []).map(Number).filter((id) => E.rivalOwnMax(id, ctx).max >= CONVERGENCE && !(wc.ok && wc.ids.indexOf(id) >= 0));
    assert("buys-below-the-convergence-gate",
      !bad.length,
      "highest rival ownership among the buys " + (worst ? nm(worst.id) + " " + Math.round(worst.own * 100) + "%" : "n/a") + ", gate 60%; over the gate in the written fifteen and kept out of the engine's: " + list(excluded) + " (locks declared: " + (locks.size ? [...locks].map(nm).join(", ") : "none") + ")" + (bad.length ? " — over the gate: " + list(bad) : ""));
  }

  // ---- 9 · B3: legal15 on every proposed fifteen
  {
    const bad = [];
    fifteens.forEach((f) => {
      const r = E.legal15(f.ids, ctx.els, f.budget === null ? 1e9 : f.budget);
      if (!r.ok) bad.push(f.label + ": " + r.reasons.join(", "));
    });
    assert("legal15-on-every-proposed-fifteen",
      fifteens.length >= 4 && !bad.length,
      fifteens.map((f) => f.label + " " + E.legal15(f.ids, ctx.els, f.budget === null ? 1e9 : f.budget).cost + (f.budget === null ? "" : "/" + f.budget)).join(" · ") + (bad.length ? " — " + bad.join("; ") : ""));
  }

  // ---- 10 · E-005 / E-009: three per club in the squad, two per club incoming
  {
    const bad = [];
    fifteens.forEach((f) => {
      const c = E.clubCounts(f.ids, ctx.els);
      Object.keys(c).forEach((t) => { if (c[t] > 3) bad.push(f.label + " has " + c[t] + " from team " + t); });
    });
    [{ label: "transfer plan", ins: tp.moves.map((m) => m.in) }, { label: "written fallback", ins: fbMoves.map((m) => Number(m.in)) }].forEach((g) => {
      const c = E.clubCounts(g.ins, ctx.els);
      Object.keys(c).forEach((t) => { if (c[t] > 2) bad.push(g.label + " brings in " + c[t] + " from team " + t); });
    });
    assert("club-cap-three-per-club-and-two-incoming",
      !bad.length,
      fifteens.map((f) => { const c = E.clubCounts(f.ids, ctx.els); return f.label + " max " + Math.max.apply(null, Object.keys(c).map((k) => c[k])); }).join(" · ") + (bad.length ? " — " + bad.join("; ") : ""));
  }

  // ---- 11 · E-007: the budget is built from raw prices, never a display-rounded one
  {
    let sellSum = 0;
    const raws = [];
    ctx.squad.forEach((s) => { const p = E.sellPrice(Number(ctx.els[s.id].now_cost), s.purchase); sellSum += p; raws.push(p); });
    const budget = ctx.bank + sellSum;
    const integers = raws.every((v) => Number.isInteger(v)) && Number.isInteger(budget) && Number.isInteger(ctx.budget);
    const wcOk = !wc.ok || (Number.isInteger(wc.cost) && wc.cost + wc.bank === ctx.budget && wc.cost <= ctx.budget);
    assert("budget-from-raw-prices",
      integers && ctx.budget === budget && wcOk,
      "selling value " + sellSum + " + bank " + ctx.bank + " = " + budget + " tenths, app budget " + ctx.budget + "; wildcard cost " + wc.cost + " + bank left " + wc.bank + (wcOk ? " reconciles" : " DOES NOT reconcile"));
  }

  // ---- 12 · and nothing leaves the bank negative
  {
    const raw = (moves) => moves.reduce((b, m) => b + E.sellPrice(Number(ctx.els[m.out].now_cost), (ctx.purchase[m.out] === undefined ? null : ctx.purchase[m.out])) - Number(ctx.els[m.in].now_cost), ctx.bank);
    const tpBank = raw(tp.moves.map((m) => ({ out: m.out, in: m.in })));
    const fbBank = raw(fbMoves.map((m) => ({ out: Number(m.out), in: Number(m.in) })));
    assert("bank-after-the-plan-is-not-negative",
      tp.bankAfter >= 0 && tpBank >= 0 && tp.bankAfter === tpBank && fbBank >= 0 && (!wc.ok || wc.bank >= 0),
      "transfer plan leaves " + tp.bankAfter + " (recomputed raw " + tpBank + "), written fallback " + fbBank + ", wildcard " + wc.bank + " tenths");
  }

  // ---- 13 · E-019: the captain is in the XI, on the wildcard path
  {
    const inXi = !!wcXI.capId && wcXI.ids.indexOf(wcXI.capId) >= 0;
    const shown = ui.ok ? ui.landing.indexOf("Captain " + nm(wcXI.capId)) >= 0 : false;
    const onCard = ui.ok ? ui.landing.indexOf(nm(wcXI.capId)) >= 0 : false;
    assert("captain-in-the-xi-on-the-wildcard-path",
      wc.ok && inXi && shown && onCard,
      "wildcard XI " + wcXI.formation + ", captain " + nm(wcXI.capId) + (inXi ? " is in the eleven" : " is NOT in the eleven") + "; the landing card " + (shown ? "names him and lists him in the fifteen" : "does not: " + ui.landing.slice(0, 120).replace(/\n/g, " · ")));
  }

  // ---- 14 · and on the fallback path, where no chip is played
  {
    const engineOk = !!fbXI.capId && fbXI.ids.indexOf(fbXI.capId) >= 0;
    const writtenCap = Number(WRITTEN.captain);
    const writtenOk = fbXI.ids.indexOf(writtenCap) >= 0;
    assert("captain-in-the-xi-on-the-fallback-path",
      engineOk && writtenOk,
      "fallback XI " + fbXI.formation + " (" + list(fbXI.ids) + "); engine captain " + nm(fbXI.capId) + (engineOk ? " in the eleven" : " NOT in the eleven") + "; written captain " + nm(writtenCap) + (writtenOk ? " in the eleven" : " NOT in the eleven"));
  }

  // ---- 15 · C1 rule 2: a flagged player is never captain, on any path
  {
    const bad = captains.filter((c) => { const fl = ctx.flags[c.id] || {}; const e = liveEl(c.id); return fl.flagged || flaggedLive(e); });
    assert("captain-is-never-flagged",
      captains.length >= 3 && !bad.length,
      captains.map((c) => c.label + " " + nm(c.id) + " " + (liveEl(c.id) || {}).status).join(" · ") + " (" + SRC() + ")" + (bad.length ? " — flagged: " + bad.map((c) => nm(c.id)).join(", ") : ""));
  }

  // ---- 16 · P(start) is a probability, for every player in the snapshot
  {
    const bad = [];
    ctx.elList.forEach((el) => {
      const p = E.pStart(el, ctx.gwStats);
      const q = ctx.xp[el.id] ? ctx.xp[el.id].pstart : p;
      if (!(p >= 0 && p <= 1) || !(q >= 0 && q <= 1) || Math.abs(p - q) > 1e-9) bad.push(el.web_name + " " + p);
    });
    const ps = ctx.elList.map((el) => ctx.xp[el.id].pstart);
    assert("pstart-in-range-for-every-element",
      !bad.length,
      ctx.elList.length + " players, P(start) between " + Math.min.apply(null, ps).toFixed(3) + " and " + Math.max.apply(null, ps).toFixed(3) + (bad.length ? " — out of range: " + bad.slice(0, 3).join(", ") : ""));
  }

  // ---- 17 · C1 rule 3: a doubt never starts ahead of a certainty he could swap with
  {
    const bad = [];
    [{ label: "wildcard XI", xi: wcXI.ids, all: wc.ok ? wc.ids : [] }, { label: "XI after the transfers", xi: postXI.ids, all: postSquad }].forEach((g) => {
      if (!g.xi.length) return;
      const on = new Set(g.xi);
      g.xi.forEach((sid) => {
        const sp = ctx.xp[sid].pstart;
        if (sp >= 0.5) return;
        g.all.filter((bid) => !on.has(bid) && ctx.els[bid].element_type === ctx.els[sid].element_type).forEach((bid) => {
          if (ctx.xp[bid].pstart >= 0.75) bad.push(g.label + ": " + nm(sid) + " " + sp.toFixed(2) + " starts ahead of " + nm(bid) + " " + ctx.xp[bid].pstart.toFixed(2));
        });
      });
    });
    const lowest = wcXI.ids.length ? Math.min.apply(null, wcXI.ids.map((id) => ctx.xp[id].pstart)) : 1;
    assert("xi-never-starts-a-doubtful-over-a-certain",
      !bad.length,
      "lowest P(start) in the wildcard eleven " + lowest.toFixed(2) + (bad.length ? " — " + bad.join("; ") : ""));
  }

  // ---- 18 · E-019: no flagged player appears in any recommendation at all
  {
    const rec = [...new Set([].concat(wc.ok ? wc.ids : [], buys, captains.map((c) => c.id), wcXI.ids))];
    const bad = rec.filter((id) => (ctx.flags[id] && ctx.flags[id].flagged) || flaggedLive(liveEl(id)));
    const flaggedNow = ctx.elList.filter((el) => ctx.flags[el.id].flagged).length;
    assert("no-flagged-player-in-any-recommendation",
      !bad.length && rec.length >= 15,
      rec.length + " recommended players, none flagged; " + flaggedNow + " players carry a flag in the snapshot (" + SRC() + " agrees)" + (bad.length ? " — flagged in a recommendation: " + list(bad) : ""));
  }

  // ---- 19 · C4: the timing series is internally consistent
  {
    const h = timing.horizons;
    const weeksUp = h.every((x, i) => i === 0 || x.weeks >= h[i - 1].weeks);
    const sumUp = h.every((x, i) => i === 0 || x.sumDeficit >= h[i - 1].sumDeficit - 1e-9);
    const cap5 = h[0].sumDeficit <= 5 * timing.weeklyGap + 1e-9;
    const gw19 = h.filter((x) => /GW19/.test(x.label))[0];
    const breakevenOk = gw19 && Math.abs(gw19.sumDeficit - timing.breakeven.byGw19) < 1e-9;
    assert("timing-horizons-reconcile",
      timing.weeklyGap >= 0 && weeksUp && sumUp && cap5 && breakevenOk,
      "weekly gap " + fx1(timing.weeklyGap) + " over " + timing.swapsNeeded + " swaps; " + h.map((x) => x.label + " " + fx1(x.sumDeficit)).join(" · ") + "; breakeven by GW19 " + fx1(timing.breakeven.byGw19));
  }

  // ---- 20 · and the sensitivity grid is the same series, shifted by the later window
  {
    const bad = [];
    const base = timing.breakeven.byGw19;
    timing.grid.filter((g) => g.deficitMult === 1).forEach((g) => {
      if (Math.abs(g.nowAdvantageBy.gw19 - (base - g.laterValue)) > 1e-9) bad.push("later " + g.laterValue + " → " + g.nowAdvantageBy.gw19.toFixed(2) + ", expected " + (base - g.laterValue).toFixed(2));
    });
    const mults = [0.5, 0.75, 1, 1.25, 1.5];
    mults.forEach((m, i) => {
      if (i === 0) return;
      const a = timing.grid.filter((g) => g.deficitMult === mults[i - 1] && g.laterValue === 0)[0];
      const b = timing.grid.filter((g) => g.deficitMult === m && g.laterValue === 0)[0];
      if (a && b && b.nowAdvantageBy.gw19 < a.nowAdvantageBy.gw19 - 1e-9) bad.push("a bigger deficit multiplier lowered the now-advantage");
    });
    assert("timing-grid-reconciles-with-the-horizons",
      timing.grid.length === 30 && !bad.length,
      timing.grid.length + " cells; at deficit ×1 the row runs " + timing.grid.filter((g) => g.deficitMult === 1).map((g) => Math.round(g.nowAdvantageBy.gw19)).join(", ") + " against later windows 0/10/20/30/45/60" + (bad.length ? " — " + bad.join("; ") : ""));
  }

  // ---- 21 · and those are the numbers on the screen
  {
    const want = [fx1(timing.weeklyGap) + " pts", String(timing.swapsNeeded)].concat(timing.horizons.map((x) => fx1(x.sumDeficit) + " pts"));
    const missing = ui.ok ? want.filter((w) => ui.timing.indexOf(w) < 0) : want;
    const labelsOk = ui.ok && timing.horizons.every((x) => ui.timing.indexOf(x.label) >= 0);
    assert("timing-numbers-shown-match-the-engine",
      ui.ok && !missing.length && labelsOk,
      ui.ok ? "panel carries " + want.join(" / ") + (missing.length ? " — missing from the panel: " + missing.join(", ") + " | panel: " + ui.timing.replace(/\n/g, " · ").slice(0, 200) : "") : "the timing panel did not render: " + ui.why);
  }

  // ---- 22 · E-011: Hull is not the best defence — the goals model said so, xG does not
  {
    const st = E.teamStrength(LIVE);
    const short = {}; LIVE.teams.forEach((t) => { short[t.id] = t.short_name; });
    const byXg = Object.keys(st.TS).map((id) => ({ id: Number(id), sn: short[id], def: st.TS[id].def })).sort((a, b) => a.def - b.def);
    const byGoals = Object.keys(st.TS_GOALS).map((id) => ({ id: Number(id), sn: short[id], def: st.TS_GOALS[id].def })).sort((a, b) => a.def - b.def);
    const hullXg = byXg.findIndex((r) => r.sn === "HUL");
    const hullGoals = byGoals.findIndex((r) => r.sn === "HUL");
    assert("hull-is-not-the-best-defence-on-xg",
      hullXg > 0,
      "on expected goals Hull rank " + (hullXg + 1) + " of " + byXg.length + " (def " + (byXg[hullXg] ? byXg[hullXg].def.toFixed(3) : "?") + "); on goals conceded Hull rank " + (hullGoals + 1) + " — the goals model is what rated them best and inverted a captaincy call");
  }

  // ---- 23 · Arsenal is where the xG model puts the best defence
  {
    const st = E.teamStrength(LIVE);
    const short = {}; LIVE.teams.forEach((t) => { short[t.id] = t.short_name; });
    const byXg = Object.keys(st.TS).map((id) => ({ sn: short[id], def: st.TS[id].def })).sort((a, b) => a.def - b.def);
    const ars = byXg.findIndex((r) => r.sn === "ARS");
    assert("arsenal-is-the-best-or-near-best-defence-on-xg",
      ars >= 0 && ars <= 1,
      "Arsenal rank " + (ars + 1) + " on expected goals against (def " + byXg[ars].def.toFixed(3) + "); top three " + byXg.slice(0, 3).map((r) => r.sn + " " + r.def.toFixed(3)).join(", "));
  }

  // ---- 24 · the OVER/UNDER tag is present wherever the gap is half a goal a game
  {
    const tags = E.overUnderTags(LIVE);
    const bad = [];
    tags.forEach((t) => {
      if (!t.g) return;
      const df = (t.gf - t.xgf) / t.g, da = (t.ga - t.xga) / t.g;
      if (df >= 0.5 && t.tagFor !== "OVER") bad.push(t.short_name + " scoring +" + df.toFixed(2) + " untagged");
      if (df <= -0.5 && t.tagFor !== "UNDER") bad.push(t.short_name + " scoring " + df.toFixed(2) + " untagged");
      if (da >= 0.5 && t.tagAgainst !== "OVER") bad.push(t.short_name + " conceding +" + da.toFixed(2) + " untagged");
      if (da <= -0.5 && t.tagAgainst !== "UNDER") bad.push(t.short_name + " conceding " + da.toFixed(2) + " untagged");
      if (Math.abs(df) < 0.5 && t.tagFor) bad.push(t.short_name + " tagged " + t.tagFor + " at only " + df.toFixed(2));
      if (Math.abs(da) < 0.5 && t.tagAgainst) bad.push(t.short_name + " tagged " + t.tagAgainst + " against at only " + da.toFixed(2));
    });
    const tagged = tags.filter((t) => t.tagFor || t.tagAgainst);
    assert("over-under-tag-where-the-gap-is-half-a-goal-a-game",
      tags.length === LIVE.teams.length && tagged.length > 0 && !bad.length,
      tagged.length + " of " + tags.length + " teams tagged, e.g. " + tagged.slice(0, 4).map((t) => t.short_name + " " + (t.tagFor || "-") + "/" + (t.tagAgainst || "-")).join(", ") + (bad.length ? " — " + bad.join("; ") : ""));
  }

  // ---- 25 · E-026: draft and classic are joined on code, never on id
  {
    const claims = (WEEKLY.draft && WEEKLY.draft.claims) || [];
    const bad = [];
    claims.forEach((c) => {
      [c.out, c.in].forEach((code) => {
        const rec = E.draftEl(code, ctx);
        if (!rec || !rec.classic || !rec.draft) bad.push("code " + code + " does not resolve on both sides");
      });
    });
    // and the join is proved where it matters: a player whose draft id is not his classic id
    const shifted = LIVE.draft.elements.filter((d) => { const c = ctx.byCode[d.code]; return c && Number(c.id) !== Number(d.id); });
    const ex = shifted[0];
    const wrong = ex ? ctx.els[ex.id] : null;
    const exOk = !!ex && E.draftEl(ex.code, ctx).classic.id !== ex.id;
    assert("draft-claims-join-on-code-not-id",
      claims.length === 6 && !bad.length && exOk,
      claims.length + " claims, all twelve codes resolve in both tables; worked example " + (ex ? ex.web_name + " draft id " + ex.id + " vs classic id " + ctx.byCode[ex.code].id + " (keying on the draft id would give " + (wrong ? wrong.web_name : "nobody") + ")" : "none") + (bad.length ? " — " + bad.join("; ") : ""));
  }

  // ---- 26 · and the size of that mismatch is what the session recorded
  {
    let joined = 0, differ = 0;
    LIVE.draft.elements.forEach((d) => { const c = ctx.byCode[d.code]; if (!c) return; joined++; if (Number(c.id) !== Number(d.id)) differ++; });
    assert("draft-ids-differ-from-classic-for-59-of-655",
      joined === 655 && differ === 59,
      differ + " of " + joined + " draft ids differ from the classic id (expected 59 of 655)");
  }

  // ---- 27 · C5: forced replacements first, then the largest gain
  {
    const claims = E.draftWaivers(STATE, ctx);
    const roster = new Set((STATE.draft.roster || []).map(Number));
    const bad = [];
    let seenUnforced = false;
    claims.forEach((c) => {
      if (c.forced && seenUnforced) bad.push("forced claim " + c.outName + " ranked below an upgrade");
      if (!c.forced) seenUnforced = true;
      if (!roster.has(Number(c.out))) bad.push(c.outName + " is not on the saved roster");
      if (roster.has(Number(c.in))) bad.push(c.inName + " is already on the roster");
    });
    const group = (f) => claims.filter((c) => c.forced === f);
    [true, false].forEach((f) => {
      const g = group(f);
      g.forEach((c, i) => { if (i && c.gain > g[i - 1].gain + 1e-9) bad.push((f ? "forced" : "upgrade") + " claims are not in descending gain"); });
    });
    assert("draft-claims-forced-replacements-first",
      claims.length > 0 && !bad.length,
      claims.length + " claims: " + claims.slice(0, 4).map((c) => c.priority + ". " + c.outName + "→" + c.inName + " " + fx1(c.gain) + (c.forced ? " forced" : "")).join(" · ") + (bad.length ? " — " + bad.join("; ") : ""));
  }

  // ---- 28 · the written claims are audited against the draft API, and the shortfalls are shown
  {
    const claims = (WEEKLY.draft && WEEKLY.draft.claims) || [];
    const draftFresh = FRESH ? new Map(FRESH.draft.elements.map((e) => [Number(e.code), e])) : null;
    const bad = [];
    const notes = [];
    claims.forEach((c) => {
      const out = E.draftEl(c.out, ctx), inn = E.draftEl(c.in, ctx);
      const outLive = draftFresh && draftFresh.get(Number(c.out)) ? draftFresh.get(Number(c.out)) : out.draft;
      const inLive = draftFresh && draftFresh.get(Number(c.in)) ? draftFresh.get(Number(c.in)) : inn.draft;
      const outEv = E.draftEV(out, ctx), inEv = E.draftEV(inn, ctx);
      const forced = String(outLive.status) !== "a" || outEv.starts_last3 === 0;
      const gain = inEv.ev - outEv.ev;
      if (!forced && gain <= 0) bad.push(out.web_name + "→" + inn.web_name + " is neither forced nor a gain (" + gain.toFixed(2) + ")");
      if (String(inLive.status) !== "a") bad.push(inn.web_name + " is status " + inLive.status + " in the draft API");
      if (inEv.starts_last3 < 3) notes.push(inn.web_name + " has " + inEv.starts_last3 + " of 3 starts");
    });
    // A shortfall that is real must be on screen, not hidden (Isidor: no free-agent forward has three starts).
    const shownIssues = ui.ok ? notes.filter((n) => { const who = n.split(" has ")[0]; return new RegExp(who.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]{0,160}of 3 starts").test(ui.draftText); }) : [];
    assert("draft-claims-are-valid-against-the-draft-api",
      claims.length === 6 && !bad.length && shownIssues.length === notes.length,
      "six written claims checked against the " + (draftFresh ? "live draft API" : "snapshot (offline)") + "; shortfalls named on screen: " + (notes.join("; ") || "none") + (bad.length ? " — invalid: " + bad.join("; ") : "") + (shownIssues.length !== notes.length ? " — a shortfall is not shown in the waivers panel" : ""));
  }

  // ---- 29 · C5 watchlist rule: KEEP only with three starts of three
  {
    const keepers = ctx.elList.filter((el) => (ctx.gwStats[el.id] || {}).starts_last3 === 3 && el.status === "a").slice(0, 5).map((el) => el.code);
    const audit = E.watchlistAudit(keepers, ctx);
    const bad = audit.keep.filter((code) => { const r = E.draftEl(code, ctx); return (ctx.gwStats[r.classic.id] || {}).starts_last3 !== 3; });
    const appAudit = E.watchlistAudit(STATE.draft.watchlist, ctx);
    assert("watchlist-keep-only-with-three-starts",
      keepers.length === 5 && audit.keep.length === 5 && !audit.drop.length && !bad.length && appAudit.keep.length === 0 && appAudit.detail.length === 0,
      audit.keep.length + " of " + keepers.length + " three-start players KEEP (" + audit.detail.map((d) => d.name + " " + d.starts_last3 + "/3").join(", ") + "); the app's own watchlist is empty, so the audit returns nothing rather than a verdict");
  }

  // ---- 30 · and DROP on none
  {
    const dead = ctx.elList.filter((el) => (ctx.gwStats[el.id] || {}).starts_last3 === 0).slice(0, 5).map((el) => el.code);
    const audit = E.watchlistAudit(dead, ctx);
    const bad = audit.keep.length;
    assert("watchlist-drop-on-zero-starts",
      dead.length === 5 && audit.drop.length === 5 && !bad,
      audit.drop.length + " of " + dead.length + " no-start players DROP (" + audit.detail.map((d) => d.name + " " + d.starts_last3 + "/3").join(", ") + ")");
  }

  // ---- 31 · E-008: the margin is measured against a genuinely different plan
  {
    const bestIns = tp.moves.map((m) => m.in).sort((a, b) => a - b).join(",");
    const bestOuts = tp.moves.map((m) => m.out).sort((a, b) => a - b).join(",");
    const alt = tp.alternatives[0] || null;
    const altIns = alt ? alt.moves.map((m) => m.in).sort((a, b) => a - b).join(",") : "";
    const altOuts = alt ? alt.moves.map((m) => m.out).sort((a, b) => a - b).join(",") : "";
    const different = !!alt && (altIns !== bestIns || altOuts !== bestOuts);
    const reconciles = !!alt && Math.abs(tp.margin - (tp.value - alt.value)) < 1e-9;
    assert("margin-against-a-genuinely-different-plan",
      tp.moves.length > 0 && different && reconciles && tp.margin > 0,
      "best plan " + tp.value.toFixed(2) + " (" + tp.moves.map((m) => m.outName + "→" + m.inName).join(", ") + "), next genuinely different " + (alt ? alt.value.toFixed(2) + " (" + alt.moves.map((m) => m.outName + "→" + m.inName).join(", ") + ")" : "none") + ", margin " + tp.margin.toFixed(2) + " → " + tp.confidence);
  }

  // ---- 32 · E-004: the free-transfer budget is respected, and a hit is charged when it is not
  {
    const ok1 = tp.k <= Math.min(ctx.ft + 1, 3) && tp.hits === Math.max(0, tp.k - ctx.ft) * 4;
    const zero = E.transferProtocol(Object.assign({}, STATE, { ft: 0 }), ctx);
    const ok2 = zero.moves.length === 0 || (zero.k <= 1 && zero.hits === zero.k * 4);
    const two = E.transferProtocol(Object.assign({}, STATE, { ft: 1 }), ctx);
    const ok3 = two.k <= 2 && two.hits === Math.max(0, two.k - 1) * 4;
    assert("ft-budget-respected",
      ok1 && ok2 && ok3,
      "at FT " + ctx.ft + ": " + tp.k + " transfers, hit " + tp.hits + "; forced to FT 0: " + zero.k + " transfers, hit " + zero.hits + " (" + zero.confidence + "); at FT 1: " + two.k + " transfers, hit " + two.hits);
  }

  const c = H.counts();
  if (!FRESH) console.log("NOTE reconciliations fell back to data/live.json — the API was unreachable (" + OFFLINE_WHY + ")");
  H.done("smoke_wk" + (FRESH ? "" : " (offline)"));
  return c;
}

main().catch(function (e) {
  console.log("FAIL smoke_wk — the suite threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : String(e)));
  console.log("SUITE smoke_wk " + H.counts().pass + "/" + (H.counts().total + 1));
  process.exit(1);
});

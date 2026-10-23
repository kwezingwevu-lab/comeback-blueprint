#!/usr/bin/env node
/* pipeline/plan.cjs — keep the best solve, prove it matches the data, replay the ledger from the rules of the game, and
   write the plan the app reads (v110 §5 C3 and C6; §6; §7.1, §7.7).

   node pipeline/plan.cjs [--data data/mc_data.json] [--solver-out data/solver_out.json] [--timing data/solver_timing.json]
                          [--long data/solver_long.json] [--out data/plan.json]

   WHAT IT DOES, IN ORDER — the same steps as the v111 kit's build.js (lines 40–61), which is the executable spec here
     1. Reads the solver output and REFUSES (exit 3, nothing written) unless it finished (`done: true`), its plan is ok,
        and its hash equals the export hash of --data computed with pipeline/export.js's buildInput. The guard is
        content, never a clock (§7.7, E-101): a plan solved on other data is not a plan for this one.
     2. slim(): keeps of each solve only what the interface needs.
     3. The long solve (solver_long.json) replaces the plan when it is the same problem proved to a better objective.
     4. The timing file (solver_timing.json): "now" is the same problem solved again, so the better objective is kept
        as THE plan, and the timing block reads now := the kept plan, later and never as solved. When the file also holds
        "latest" (pipeline/latest_wildcard.py: the never plan with the first wildcard played in the last week before set
        one expires), it is folded as timing.latest, flagged constructed, with no gap of its own. A stale or incomplete
        timing file is named and left out. The reference tree has no long solve; both files are optional.
     5. Free-hit weeks are re-labelled and re-priced against whichever plan was kept: a week is free only if that plan
        plays no chip in it, its budget is the kept squad's selling value plus the bank, and only affordable weeks stay.
     6. REPLAY (C3, §7.1, E-102). The solver's free-transfer variables are upper bounds, so the ledger, the hits and the
        bank are recomputed week by week from the rules of the game (CLAUDE.md Part N1; v110 §4 Classic):
          · free transfers before each week: one added per ordinary week; a wildcard or free-hit week keeps the count
            exactly as it was, nothing spent and nothing added (Fantasy Football Scout, 20 Jul 2026); the cap is
            1 + max_extra_free_transfers as the block carries it in rules.maxFt; the floor is 1
          · moves = the squad difference from the previous week; used = min(free, moves) on an ordinary week
          · hits = 4 × max(0, moves − free): a hit only once every free transfer is used, none on a chip week
          · bank from selling prices for the original fifteen and purchase prices for anyone bought inside the window
        The interface reads `replay`, never the solver's own ft / hits / bank (§6). If the replay disagrees with the
        solver's fields anywhere, every disagreeing week is printed with both values, the file is still written with
        replay.agrees false and the differences listed, and the exit code is 2 so the stage goes red.

   OUTPUT  plan.json = { hash, at, source: {data, out, timing, long, horizons, solvedBy, longSolve, timingFold, horizonsFold}, plan,
           noWildcard, undecayed, freeHit, timing, horizons (step 4c; null when absent or stale), draft, draftIfTaken, draftAhead,
           replay: { weeks: [{gw, chip, ftBefore, moves, used, hitCount, hits, bank, ftAfter}], agrees, differences } }
           In the replay `hits` is points (four per hit) and `hitCount` is the number; `used` is the free transfers
           spent. No clock is written: the same inputs give the same file, so a harmless re-run changes nothing.
   EXIT    0 written and the replay agrees · 2 written, the replay disagrees · 3 refused, nothing written.
   The app never solves and never runs this; it reads the committed data/plan.json (C6). qa/plan_legality.cjs checks
   the written file week by week with its own replay, and qa/solver_smoke.sh runs this on a short, time-limited solve. */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULTS = { data: "data/mc_data.json", out: "data/solver_out.json", timing: "data/solver_timing.json", long: "data/solver_long.json", horizons: "data/solver_horizons.json", plan: "data/plan.json" };
const HIT_POINTS = 4;            // a hit costs four points by rule (v110 §4 Classic)
const BANK_TOL = 0.051;          // the solver rounds its bank to £0.1m each week, as the replay does

const abs = (p) => path.resolve(ROOT, p);
const show = (p) => { const r = path.relative(ROOT, p); return r && !r.startsWith("..") ? r : p; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const refuse = (msg) => { console.log("plan.cjs refused: " + msg); process.exit(3); };

function parseArgs(argv) {
  const o = { data: abs(DEFAULTS.data), out: abs(DEFAULTS.out), timing: abs(DEFAULTS.timing), long: abs(DEFAULTS.long), horizons: abs(DEFAULTS.horizons), plan: abs(DEFAULTS.plan) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === "--data") { o.data = path.resolve(v); i++; }
    else if (a === "--solver-out") { o.out = path.resolve(v); i++; }
    else if (a === "--timing") { o.timing = path.resolve(v); i++; }
    else if (a === "--long") { o.long = path.resolve(v); i++; }
    else if (a === "--horizons") { o.horizons = path.resolve(v); i++; }
    else if (a === "--out") { o.plan = path.resolve(v); i++; }
    else refuse("unknown argument " + a + " (expected --data, --solver-out, --timing, --long, --horizons, --out, each with a file)");
  }
  return o;
}

/* what the interface needs of a solve, and nothing else (kit build.js line 40) */
function slim(pl) {
  return pl && pl.ok ? { ok: true, total: pl.total, obj: pl.obj, secs: pl.secs, gap: pl.gap, detail: pl.detail, params: pl.params,
    weeks: pl.weeks.map((w) => ({ gw: w.gw, chip: w.chip, xi: w.xi, bench: w.bench, gk2: w.gk2, cap: w.cap, vice: w.vice, in: w.in, out: w.out, ftBefore: w.ftBefore, used: w.used, hits: w.hits, bank: w.bank, ep: w.ep, epNet: w.epNet, held: !!w.held, squad: w.squad })) } : null;
}

/* the ledger from the rules of the game, never from the solver's variables (C3, §7.1) */
function replayLedger(weeks, ctx) {
  let ft = ctx.ft0, bank = ctx.bank0, prev = new Set(ctx.own0);
  const out = [];
  for (const w of weeks) {
    const ins = w.squad.filter((i) => !prev.has(i)), outs = [...prev].filter((i) => !w.squad.includes(i));
    const chipWeek = w.chip === "wildcard" || w.chip === "freehit";                 // keeps the count exactly as it was: nothing spent, nothing added
    const moves = ins.length;
    const used = chipWeek ? 0 : Math.min(ft, moves);
    const hitCount = chipWeek ? 0 : Math.max(0, moves - ft);                        // a hit only once every free transfer is used
    bank = r1(bank + outs.reduce((a, i) => a + ctx.sellOf(i), 0) - ins.reduce((a, i) => a + ctx.buyOf(i), 0));
    const ftAfter = chipWeek ? ft : Math.max(1, Math.min(ctx.maxFt, ft - used + 1)); // one more after the deadline, capped, floor 1
    out.push({ gw: w.gw, chip: w.chip || null, ftBefore: ft, moves, used, hitCount, hits: HIT_POINTS * hitCount, bank, ftAfter });
    ft = ftAfter; prev = new Set(w.squad);
  }
  return out;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(o.data)) refuse("no data block at " + show(o.data) + " — run the bake first (npm run bake)");
  const DATA = readJson(o.data);
  const M = require(path.join(ROOT, "src", "mc_engine.js")).create(DATA);
  const input = require(path.join(ROOT, "pipeline", "export.js")).buildInput(DATA, M), nowHash = input.hash;

  /* 1. the solver output, guarded by content */
  if (!fs.existsSync(o.out)) refuse("no solver output at " + show(o.out) + " — run pipeline/solve.py first");
  const so = readJson(o.out);
  if (so.done !== true) refuse("the solve at " + show(o.out) + " did not finish (done is " + JSON.stringify(so.done) + "); a partial run is not shipped");
  if (!so.plan || !so.plan.ok) refuse("the solve at " + show(o.out) + " carries no feasible plan (" + (so.plan && so.plan.status) + ")");
  if (so.hash !== nowHash) refuse("solved on different data: solver hash " + so.hash + " vs the export hash of " + show(o.data) + " " + nowHash);

  /* 2–4. the kept plan */
  let plan = slim(so.plan), solvedBy = show(o.out) + " plan", longNote = "absent", timing = null, timingNote = "absent";
  const sameProblem = [{ label: "main plan", p: so.plan }];   // E-128: solves of one integer programme, whose dual bounds are shared below
  if (fs.existsSync(o.long)) {
    const sl = readJson(o.long);
    if (sl.hash !== nowHash) longNote = "stale (hash " + sl.hash + ")";
    else if (!(sl.plan && sl.plan.ok)) longNote = "no feasible plan";
    else if (JSON.stringify(sl.plan.params || null) !== JSON.stringify(so.plan.params || null)) longNote = "other params (a rule changed since; E-181)";
    else if ((sl.plan.obj || 0) > (plan.obj || 0)) { plan = slim(sl.plan); solvedBy = show(o.long) + " plan"; longNote = "kept (objective " + sl.plan.obj + ", gap " + sl.plan.gap + ")"; }
    else longNote = "not better (objective " + sl.plan.obj + " vs " + plan.obj + ")";
    if (sl.hash === nowHash && sl.plan && sl.plan.ok) sameProblem.push({ label: "long solve", p: sl.plan });
  }
  if (fs.existsSync(o.timing)) {
    const st = readJson(o.timing);
    if (st.hash === nowHash && st.now && st.now.ok) sameProblem.push({ label: "wildcard now", p: st.now });
    if (st.hash === nowHash && st.now && st.later && st.never) {
      /* the main plan and "wildcard now" are the same problem solved twice: keep whichever reached the better objective, and its proven gap */
      if (JSON.stringify(st.now.params || null) === JSON.stringify(so.plan.params || null) && (st.now.obj || 0) > (plan.obj || 0)) { plan = Object.assign(slim(st.now), { detail: so.plan.detail }); solvedBy = show(o.timing) + " now"; }
      timing = { now: plan, later: slim(st.later), never: slim(st.never), at: st.at }; timingNote = "folded (now := the kept plan)";
      /* The wildcard as late as the rules allow (pipeline/latest_wildcard.py): the proven "never" plan with the wildcard
         played in the last week. It is a plan built from a proven one, not a solve, so it carries no gap of its own;
         it is folded only when it is feasible and its weeks up to the last are the never plan's own. Optional. */
      if (st.latest) {
        const l = st.latest, nv = st.never;
        const same = l.ok && l.constructed === true && nv && nv.ok && Array.isArray(l.weeks) && Array.isArray(nv.weeks) && l.weeks.length === nv.weeks.length &&
          l.weeks.slice(0, -1).every((w, i) => JSON.stringify(w.squad) === JSON.stringify(nv.weeks[i].squad) && w.chip === nv.weeks[i].chip);
        if (same) { timing.latest = Object.assign(slim(l), { constructed: true, from: l.from, reshuffle: l.reshuffle, note: l.note, fixedWeek: l.fixedWeek || null }); timingNote += "; latest wildcard folded (built from never)"; }
        else timingNote += "; latest wildcard left out (not feasible, or not built from the never plan in this file)";
      }
    } else timingNote = st.hash === nowHash ? "incomplete (needs now, later and never)" : "stale (hash " + st.hash + ")";
  }

  /* 4b. The kept plan's proof (E-128). The main plan, the long solve and "wildcard now" are ONE integer programme solved
     up to three times — classic() with its default arguments, which is checked here through the recorded params and not
     assumed — so a dual bound proven by any of them bounds the best plan of all of them. Each solve proves
     bound = objective × (1 + gap); the tightest of those is the best bound for the problem, and the kept plan is proven
     within (best bound ÷ its own objective − 1) of the best possible. The gap is never reported tighter than the
     tightest bound allows, and never looser than the kept solve's own. A solve with other parameters shares nothing. */
  let gapNote = "the kept solve's own gap";
  {
    const key = JSON.stringify(plan.params || null);
    const peers = sameProblem.filter((x) => x.p && x.p.ok && typeof x.p.obj === "number" && typeof x.p.gap === "number" && JSON.stringify(x.p.params || null) === key);
    if (plan.params && peers.length && typeof plan.obj === "number" && plan.obj > 0 && typeof plan.gap === "number") {
      const best = peers.reduce((a, x) => (x.p.obj * (1 + x.p.gap) < a.b ? { b: x.p.obj * (1 + x.p.gap), from: x.label, p: x.p } : a), { b: Infinity, from: null, p: null });
      const certified = best.b / plan.obj - 1;
      if (certified < plan.gap - 1e-12) {
        plan = Object.assign({}, plan, { gapOwn: plan.gap, gap: Math.max(0, certified), gapFrom: best.from, gapBound: Math.round(best.b * 1e4) / 1e4 });
        gapNote = "certified by the " + best.from + "'s bound " + plan.gapBound + " (its own gap " + plan.gapOwn.toFixed(4) + ")";
      }
    }
    if (timing) timing.now = plan;   // "now" is the kept plan, with the proof it now carries
  }

  /* 4b2. The manager's choice (20 Oct 2026, ERRORS.md E-179): "The first wildcard will only be played before gw20. So play it
     for gw 19." The plan of record is then the GW19 wildcard plan (pipeline/latest_wildcard.py: the proven never plan with the
     wildcard in GW19), not the solver's own pick; the solved plan stays beside it as timing.now so the Plan tab can show what
     the choice costs. It carries the never plan's proof, since it is that plan to GW18. Applied before the horizons
     (4c), so the gameweek, month and season are scored on the plan of record (E-181). */
  const WC1_GW = 19;
  let choiceNote = "none";
  if (WC1_GW && timing && timing.latest && timing.latest.weeks.some((w) => w.gw === WC1_GW && w.chip === "wildcard")) {
    plan = Object.assign({}, timing.latest, { obj: timing.never.obj, gap: timing.never.gap, secs: timing.never.secs, status: timing.never.status, detail: plan.detail, params: timing.never.params, managerChoice: "wildcard GW" + WC1_GW, fixedWeek: timing.latest.fixedWeek || null });   // the solve time and status are the never solve's, whose plan this is to GW18
    solvedBy = "the manager's choice: wildcard GW" + WC1_GW + " (built from the never plan)";
    choiceNote = "wildcard GW" + WC1_GW + " kept as the plan of record (" + timing.latest.total + " against the solver's " + timing.now.total + ")";
  } else if (WC1_GW) choiceNote = "wildcard GW" + WC1_GW + " asked for but no GW" + WC1_GW + " wildcard plan in the timing file; the solver's plan is kept";

  /* 4c. The gameweek, the month and the season (the manager's ask of 15 Oct 2026: "maximise the gameweek, the monthly and
     the season points"). pipeline/horizons.py solves classic() three more times on this input, each with one horizon
     weighted up in memory (season: no discount; month: the current FPL month's weeks x4; gameweek: the next one x4), and
     re-scores each on the unscaled expected points. Here the kept plan is scored the same way, a lens is folded only when
     it was solved on this input (the hash) over the same weeks, and the month's points already banked come from the feed
     (points less hits, as the game's monthly tables count them). Nothing is chosen here: the plan of record stays the kept
     plan, and the lenses say how far each horizon is from its own best and what chasing it would cost. Optional: an
     absent or stale file is named and left out. */
  let horizons = null, horizonsNote = "absent";
  if (fs.existsSync(o.horizons)) {
    const sh = readJson(o.horizons);
    const phases = DATA.gw && Array.isArray(DATA.gw.phases) ? DATA.gw.phases.filter((x) => x && Number.isInteger(x.start) && Number.isInteger(x.stop)) : [];
    const first = plan.weeks[0].gw, month = phases.find((x) => x.start <= first && first <= x.stop) || null;
    if (sh.hash !== nowHash) horizonsNote = "stale (hash " + sh.hash + ")";
    else if (!month) horizonsNote = "left out: the data carries no FPL month for GW" + first + " (gw.phases)";
    else {
      const score = (weeks) => {
        const by = phases.map((x) => {
          const s = weeks.filter((w) => w.gw >= x.start && w.gw <= x.stop);
          return s.length ? { id: x.id, name: x.name, start: x.start, stop: x.stop, ep: r2(s.reduce((a, w) => a + w.epNet, 0)), weeks: s.length } : null;
        }).filter(Boolean);
        const m = by.find((b) => b.id === month.id);
        return { gameweek: r2(weeks[0].epNet), month: m ? m.ep : 0, season: r2(weeks.reduce((a, w) => a + w.epNet, 0)), byPhase: by };
      };
      const lens = (k) => {
        const l = sh.lenses && sh.lenses[k];
        if (!l || l.ok !== true || !Array.isArray(l.weeks) || l.weeks.length !== plan.weeks.length || l.weeks[0].gw !== first) return null;
        const w0 = l.weeks[0];
        return { gap: l.gap, secs: l.secs, params: l.params, score: score(l.weeks),
          first: { gw: w0.gw, chip: w0.chip || null, cap: w0.cap, vice: w0.vice, in: w0.in, out: w0.out, hits: w0.hits },
          chips: l.weeks.filter((w) => w.chip).map((w) => ({ gw: w.gw, chip: w.chip })) };
      };
      const banked = (DATA.classic && Array.isArray(DATA.classic.gws) ? DATA.classic.gws : []).filter((g) => g && g.gw >= month.start && g.gw <= month.stop && g.gw < first);
      horizons = {
        month: { id: month.id, name: month.name, start: month.start, stop: month.stop,
          banked: banked.reduce((a, g) => a + (Number(g.pts) || 0) - (Number(g.hit) || 0), 0), bankedWeeks: banked.map((g) => g.gw) },
        seasonBanked: DATA.classic && Number.isFinite(Number(DATA.classic.total)) ? Number(DATA.classic.total) : null,
        tol: r2((typeof plan.gap === "number" ? plan.gap : 0) * plan.total),
        plan: score(plan.weeks),
        lenses: { season: lens("season"), month: lens("month"), gameweek: lens("gameweek") }
      };
      /* The best found for each horizon is the best of EVERY plan solved on this input, not only that horizon's own lens:
         a lens is solved to a tolerance and carries the optimiser's friction terms (transfer cost, bench weight, banked
         transfers), so another solve can beat it on its own horizon (15 Oct 2026: the wildcard-later case reached 72.0 in
         GW7 against the gameweek lens's 71.7, and the plan of record 820.7 to GW19 against the season lens's 817.4). Each
         candidate is scored with the same arithmetic; ties go to the plan of record, then to the order below. */
      const cand = [{ key: "plan", label: "This plan", weeks: plan.weeks }];
      if (timing) {
        if (plan.managerChoice && timing.now) cand.push({ key: "now", label: "The solver's wildcard week", weeks: timing.now.weeks });
        if (timing.later) cand.push({ key: "later", label: "Wildcard held past GW" + (timing.later.weeks[Math.max(0, ((timing.later.params || {}).wcFrom || 1) - 1)] || {}).gw, weeks: timing.later.weeks });
        if (timing.never) cand.push({ key: "never", label: "No wildcard before GW" + plan.weeks[plan.weeks.length - 1].gw, weeks: timing.never.weeks });
      }
      ["season", "month", "gameweek"].forEach((k) => {
        const l = sh.lenses && sh.lenses[k];
        if (l && l.ok === true && Array.isArray(l.weeks) && l.weeks.length === plan.weeks.length && l.weeks[0].gw === first)
          cand.push({ key: "lens:" + k, label: k === "season" ? "Every week equal" : k === "month" ? month.name + " first" : "GW" + first + " first", weeks: l.weeks });
      });
      horizons.candidates = cand.filter((c) => Array.isArray(c.weeks) && c.weeks.length === plan.weeks.length).map((c) => {
        const w0 = c.weeks[0];
        return { key: c.key, label: c.label, score: score(c.weeks), first: { gw: w0.gw, chip: w0.chip || null, cap: w0.cap, vice: w0.vice, in: w0.in, out: w0.out, hits: w0.hits },
          chips: c.weeks.filter((w) => w.chip).map((w) => ({ gw: w.gw, chip: w.chip })) };
      });
      horizons.best = {};
      ["gameweek", "month", "season"].forEach((h) => {
        let b = horizons.candidates[0];
        horizons.candidates.forEach((c) => { if (c.score[h] > b.score[h] + 1e-9) b = c; });
        horizons.best[h] = b.key;
      });
      horizonsNote = "folded (" + Object.values(horizons.lenses).filter(Boolean).length + " of 3 lenses, " + month.name + " GW" + month.start + "–" + month.stop + ")";
    }
  }

  /* 5. free-hit weeks against the kept plan */
  const cs = M.classicSquad(), own0 = new Set(cs.squad.map((p) => p.id)), sellMap = new Map(cs.squad.map((p) => [p.id, p.sell]));
  const sellOf = (i) => (sellMap.has(i) ? sellMap.get(i) : M.P[i].pr);   // the selling price the export gave the solver for the original fifteen; purchase price otherwise
  const buyOf = (i) => M.P[i].pr;
  const chipWeeks = new Set(plan.weeks.filter((w) => w.chip).map((w) => w.gw));
  const freeHit = (so.freeHit || []).map((f) => ({ gw: f.gw, gain: f.gain, free: f.free, budget: f.budget, cap: f.cap, xi: f.xi, squad: f.squad })).map((f) => {
    const w = plan.weeks.find((x) => x.gw === f.gw); if (!w || !f.squad) return null;
    const budget = r1(w.squad.reduce((a, i) => a + sellOf(i), 0) + w.bank), cost = r1(f.squad.reduce((a, i) => a + buyOf(i), 0));
    const fhEp = f.xi.reduce((a, i) => a + M.ep(M.P[i], f.gw), 0) + M.ep(M.P[f.cap], f.gw), base = w.xi.reduce((a, i) => a + M.ep(M.P[i], f.gw), 0) + M.ep(M.P[w.cap], f.gw);
    return Object.assign({}, f, { free: !chipWeeks.has(f.gw), budget, cost, affordable: cost <= budget + 1e-9, gain: r2(fhEp - base) });
  }).filter(Boolean).filter((f) => f.affordable).filter((f) => f.gw >= ((so.plan.params || {}).chipFrom || 0) && f.gw <= 19);   // E-181: no free hit before GW13; set 1 ends GW19

  /* 6. the replay, and its comparison with the solver's own fields */
  const replay = replayLedger(plan.weeks, { ft0: cs.ft, bank0: cs.bank, own0, maxFt: DATA.rules.maxFt, sellOf, buyOf });
  const differences = [];
  plan.weeks.forEach((w, i) => {
    const r = replay[i];
    [["ftBefore", w.ftBefore, r.ftBefore], ["used", w.used, r.used], ["hits", w.hits, r.hitCount], ["bank", w.bank, r.bank]].forEach(([field, solver, rep]) => {
      const same = field === "bank" ? Math.abs(solver - rep) <= BANK_TOL : solver === rep;
      if (!same) differences.push({ gw: w.gw, field, replay: rep, solver });
    });
  });

  const out = {
    hash: nowHash, at: so.at,
    source: { data: show(o.data), out: show(o.out), timing: fs.existsSync(o.timing) ? show(o.timing) : null, long: fs.existsSync(o.long) ? show(o.long) : null, horizons: fs.existsSync(o.horizons) ? show(o.horizons) : null, solvedBy, longSolve: longNote, timingFold: timingNote, horizonsFold: horizonsNote },
    plan, noWildcard: slim(so.noWildcard), undecayed: slim(so.undecayed), freeHit, timing, horizons,
    draft: so.draft || null, draftIfTaken: so.draftIfTaken || null, draftAhead: (input.draft.ahead || []).join(", "),
    replay: { weeks: replay, agrees: differences.length === 0, differences }
  };
  fs.mkdirSync(path.dirname(o.plan), { recursive: true });
  fs.writeFileSync(o.plan, JSON.stringify(out));

  const chips = plan.weeks.filter((w) => w.chip).map((w) => "GW" + w.gw + " " + w.chip).join(", ") || "none";
  const hits = replay.reduce((a, r) => a + r.hitCount, 0);
  console.log("plan.cjs wrote " + show(o.plan) + " · hash " + nowHash + " · kept " + solvedBy + " · choice " + choiceNote + " · total " + plan.total + " · objective " + plan.obj + " · gap " + plan.gap + " (" + gapNote + ")" +
    " · " + plan.weeks.length + " weeks GW" + plan.weeks[0].gw + "–" + plan.weeks[plan.weeks.length - 1].gw + " · chips " + chips + " · replayed hits " + hits +
    " · long solve " + longNote + " · timing " + timingNote + " · horizons " + horizonsNote + " · free-hit weeks " + freeHit.length + " · Draft roster " + (so.draft && so.draft.ok ? "ok" : "absent"));
  if (differences.length) {
    console.log("REPLAY DISAGREES with the solver's own fields (§7.1) — the replay is what the interface reads:");
    differences.forEach((d) => console.log("  GW" + d.gw + " " + d.field + ": replay " + d.replay + " · solver " + d.solver));
    process.exit(2);
  }
  console.log("replay agrees with the solver's fields on every week (ftBefore, used, hits, bank)");
}

main();

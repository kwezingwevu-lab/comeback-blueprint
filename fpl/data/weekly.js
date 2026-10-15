// WEEKLY STRATEGY ENGINE — decisions only (CONTRACT §4). WRITTEN BY pipeline/weekly.cjs — do not edit by hand;
// change the inputs and re-run it after pipeline/plan.cjs. Classic entries are FPL element ids; Draft entries are
// player codes (join on code, never on id). The figures in the comments and the why lines are the plan's own at
// the moment of writing; the app's engines recompute every figure it shows.
// Plan 2fa283ff9b2ad779 (data/solver_out.json plan), block baked 2026-10-15T22:48:37.368Z, live snapshot 2026-10-15T22:54:50Z.
const WEEKLY = {
  version: 110, gw: 7, written: "2026-10-16", hash: "2fa283ff9b2ad779",
  source: "pipeline/plan.cjs on data/mc_data.json baked 2026-10-15T22:48:37.368Z (export hash 2fa283ff9b2ad779); data/live.json fetched 2026-10-15T22:54:50Z",

  // The plan this block replaces, recorded rather than deleted (v89 rule). `previous` carries the one before it.
  superseded: {
    "version": 89,
    "gw": 6,
    "plan": "wildcard",
    "what": "Play Wildcard 1 in GW6 with Haaland, Groß, De Cuyper, Bogle, Gvardiol, Guéhi, Schade, Janelt, Tarkowski, Tzolakis, Cunha, Tavernier, A.Becker, Emersonn, Isak; captain Groß, vice Schade.",
    "outcome": "Superseded on 2026-09-27, before the GW6 deadline, by the v110 solved plan; never played.",
    "measured": "src/mc_engine.js squadValue, each fifteen held unchanged from GW6 to GW19 with its best eleven and captain every week: v89's 805.4 Classic expected points against v110's 856.1 (the v110 plan's own total, with its later transfers and chips, is 902.96).",
    "evidence": "data/plan.json hash cef80183f9a5a2ae · v89 was written 2026-09-26 from src/engine.js on data/live.json fetched 2026-09-26T10:49:45Z",
    "previous": {
      "version": 88,
      "gw": 4,
      "plan": "wildcard",
      "what": "Play Wildcard 1 in GW4 with Tzolakis, Raya, Calafiori, Ajayi, Tarkowski, Bogle, Mendy, Janelt, Saka, Scott, Rogers, Barnes, João Pedro, Haaland, Barry; captain João Pedro.",
      "outcome": "Never played. He kept his fifteen, captained Haaland and scored 71 against a field average of 69.",
      "measured": "state/kwezi.json ledger, GW4 chip row: the fifteen of record scored 96 across all fifteen and 102 as its best legal eleven in hindsight with João Pedro captained, against the 71 he played. The regret is an upper bound because a squad that was never played has no played eleven.",
      "evidence": "history.chips === [] · history.current[].event_transfers === [0,0,0,0,1]"
    }
  },

  classic: {
    plan: "wildcard",                                   // "wildcard" | "transfers" | "hold"
    // data/plan.json weeks[0].squad: Gabriel, Calafiori, Saka, Janelt, Van Hecke, Groß, Gomez, Thomas-Asante, Leno, Stach, Trafford, Guéhi, Haaland, Gonzalo, Affengruber.
    // Buys Calafiori, Janelt, Van Hecke, Groß, Gomez, Thomas-Asante, Leno, Stach, Trafford, Guéhi, Gonzalo, Affengruber; sells Diop, Shaw, Rogers, Brobbey, Verbruggen, Semenyo, van Ewijk, Kinsky, Szoboszlai, Hughes, Calvert-Lewin, Konsa.
    wildcard15: [4, 8, 12, 98, 112, 124, 127, 194, 250, 335, 385, 388, 411, 569, 650],
    // Rule C1.6's only exemption, declared (smoke_wk reads it): the fifteen's players at or over the 60% rival-ownership
    // gate. The plan keeps them because they maximise expected points (v110 §1.2).
    locks: [8, 124, 411],
    // The fifteen's cost at today's prices, recorded so the Plan tab reads it out of the block (E-088).
    wildcard15_cost_written: 968,
    captain: 411, vice: 12,                            // Haaland, Saka — the plan's own armband for GW7
    // Without the chip: src/engine.js transferProtocol (CLAUDE.md C2), because the optimiser's no-wildcard week sells van Ewijk, protected by the Konsa rule; 5 moves, 0 hits, confidence HIGH.
    fallback: {
      moves: [{out: 212, in: 98}, {out: 423, in: 229}, {out: 368, in: 127}, {out: 4, in: 115}, {out: 31, in: 388}],
      captain: 411, vice: 397                            // Haaland, Semenyo
    },
    chip: "wildcard",
    notes: [
      "The plan is the optimiser's (pipeline/solve.py, HiGHS), proved within 0.20% of the best possible: 819.89 Classic expected points from GW7 to GW19, 0 hits.",
      "Chips in the plan: WC GW7, BB GW8, TC GW11 on Haaland; the best free-hit week is GW16 at +3.35, not taken.",
      "Free transfers come from the replayed ledger (data/plan.json replay), never the solver's own variables: 5 into GW7, 5 after it, because a wildcard week keeps the count.",
      "Calafiori, Groß, Haaland are at or over the 60% rival-ownership gate and kept on purpose; the rule-pure search on the Plan tab prices the difference."
    ],
    why: [
      "Timing (data/plan.json timing): wildcard now 819.89, later (GW8) 814.61, never 808.94 Classic expected points to GW19.",
      "The wildcard as late as the rules allow, GW19 (the last deadline before set one expires): the no-wildcard plan to the week before, then the fifteen rebuilt for that week (10 changes, 3.90 that week), worth 812.84 Classic expected points, which is 7.05 below the plan, so waiting to the end costs at most that plus the proof tolerance. It is a plan built from a proven one and replayed against the rules, and a floor, not a proved best. Points are counted only to GW19, so a wildcard played in the last week is credited with that week alone and none after it: the cost is what waiting gives up, not the whole comparison.",
      "Without the wildcard the best plan found is 809.38, so the chip is worth 10.51 over the window.",
      "The app's own timing model (src/engine.js wildcardTiming) puts the five-gameweek deficit of the current fifteen at 56.6 and the break-even for waiting at 104.6 by GW19."
    ]
  },

  draft: {
    // buildClaimSheet (src/mc_analysis.js) on the solved roster's pairs, with the Monte Carlo orderings — the same call
    // data/pre.json makes. Lodge in exactly this order: every first choice, then the backups — the ordering that lands more value under the league's own processing (strategy "firsts").
    // Monte Carlo over 1500 runs, mean Draft value by ordering: all first choices, then backups 620.1; each backup under its first choice 620.1; highest expected gain first 620.1; likeliest to land first 620.1.
    pool: "api",
    pool_note: "League 46148: the ins are free agents in the league's own feed, and the waiver model reproduces the league's claim log (qa/waiver_log.cjs). 2 claims, 0 of them backups.",
    claims: [
      { out: 85633, in: 489639, why: "Verbruggen for Sels (GKP), first choice: +2.4 Draft expected points to GW20, lands in 97% of 1500 simulated waiver runs, stress test: lands" },
      { out: 195546, in: 166989, why: "Tielemans for Buendía (MID), first choice: +2.3 Draft expected points to GW20, lands in 18% of 1500 simulated waiver runs, stress test: taken first" }
    ],
    // The best eleven of the roster the stress test leaves (src/mc_engine.js bestXI for GW7): 5-4-1, Verbruggen, Silva, Guéhi, Hill, Mukiele, Murillo, Cunha, Janelt, Buendía, Xhaka, N.Jackson.
    xi: {
      formation: "5-4-1",
      gk: 489639,
      def: [483067, 209036, 463981, 200834, 575476],
      mid: [430871, 204580, 195546, 84450],
      fwd: [517052]
    },
    watchlist: []
  },

  chips: {
    set1_expires_gw: 19,
    planned: [{set: 1, chip: "WC", gw: 7},{set: 1, chip: "BB", gw: 8},{set: 1, chip: "TC", gw: 11}],
    note: "Chips from data/plan.json: WC GW7, BB GW8, TC GW11. The free hit is held; its best week is GW16."
  },

  // tournament(live) on data/live.json: notes only; the engine recomputes them every render.
  tournament: { leader: "player_xg", transitions: 5, promote_at_gw: 7 },

  // wildcardTiming(ctx) — the app engine's note; `solved` is the optimiser's (data/plan.json timing).
  timing: { now_vs_later: { by_gw19: 105, by_gw38: 105, breakeven_double_gw17: null, breakeven_later_value: 105 },
    solved: { now: 819.89, later: 814.61, later_gw: 8, never: 808.94, latest: 812.84, latest_gw: 19 } }
};

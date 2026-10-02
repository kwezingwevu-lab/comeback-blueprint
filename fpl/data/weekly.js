// WEEKLY STRATEGY ENGINE — decisions only (CONTRACT §4). WRITTEN BY pipeline/weekly.cjs — do not edit by hand;
// change the inputs and re-run it after pipeline/plan.cjs. Classic entries are FPL element ids; Draft entries are
// player codes (join on code, never on id). The figures in the comments and the why lines are the plan's own at
// the moment of writing; the app's engines recompute every figure it shows.
// Plan 1c1af4c2c40b1b26 (data/solver_out.json plan), block baked 2026-10-01T18:19:17.509Z, live snapshot 2026-10-01T18:40:17Z.
const WEEKLY = {
  version: 110, gw: 6, written: "2026-10-01", hash: "1c1af4c2c40b1b26",
  source: "pipeline/plan.cjs on data/mc_data.json baked 2026-10-01T18:19:17.509Z (export hash 1c1af4c2c40b1b26); data/live.json fetched 2026-10-01T18:40:17Z",

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
    // data/plan.json weeks[0].squad: Gabriel, Saka, Janelt, Groß, Thomas, Benitez, Tarkowski, Branthwaite, Barry, Leno, Stach, Haaland, Mbeumo, Hall, Gonzalo.
    // Buys Janelt, Groß, Thomas, Benitez, Tarkowski, Branthwaite, Barry, Leno, Stach, Mbeumo, Hall, Gonzalo; sells Diop, Shaw, Rogers, Brobbey, Semenyo, Verbruggen, van Ewijk, Kinsky, Szoboszlai, Hughes, Calvert-Lewin, Konsa.
    wildcard15: [4, 12, 98, 124, 173, 199, 229, 230, 249, 250, 335, 411, 427, 449, 569],
    // Rule C1.6's only exemption, declared (smoke_wk reads it): the fifteen's players at or over the 60% rival-ownership
    // gate. The plan keeps them because they maximise expected points (v110 §1.2).
    locks: [411],
    // The fifteen's cost at today's prices, recorded so the Plan tab reads it out of the block (E-088).
    wildcard15_cost_written: 995,
    captain: 12, vice: 4,                            // Saka, Gabriel — the plan's own armband for GW6
    // Without the chip: src/engine.js transferProtocol (CLAUDE.md C2), because the optimiser's no-wildcard week sells Shaw, protected by the Konsa rule; 5 moves, 1 hit, confidence HIGH.
    fallback: {
      moves: [{out: 212, in: 127}, {out: 175, in: 330}, {out: 552, in: 316}, {out: 31, in: 115}, {out: 368, in: 94}],
      captain: 94, vice: 411                            // Schade, Haaland
    },
    chip: "wildcard",
    notes: [
      "The plan is the optimiser's (pipeline/solve.py, HiGHS), proved within 0.38% of the best possible: 904.07 Classic expected points from GW6 to GW19, 0 hits.",
      "Chips in the plan: WC GW6, TC GW7 on Haaland, BB GW9; the best free-hit week is GW8 at +4.11, not taken.",
      "Free transfers come from the replayed ledger (data/plan.json replay), never the solver's own variables: 4 into GW6, 4 after it, because a wildcard week keeps the count.",
      "Haaland is at or over the 60% rival-ownership gate and kept on purpose; the rule-pure search on the Plan tab prices the difference."
    ],
    why: [
      "Timing (data/plan.json timing): wildcard now 904.07, later (GW7) 899.87, never 889.86 Classic expected points to GW19.",
      "The wildcard as late as the rules allow, GW19 (the last deadline before set one expires): the no-wildcard plan to the week before, then the fifteen rebuilt for that week (9 changes, 4.75 that week), worth 894.63 Classic expected points, which is 9.44 below the plan, so waiting to the end costs at most that plus the proof tolerance. It is a plan built from a proven one and replayed against the rules, and a floor, not a proved best. Points are counted only to GW19, so a wildcard played in the last week is credited with that week alone and none after it: the cost is what waiting gives up, not the whole comparison.",
      "Without the wildcard the best plan found is 889.86, so the chip is worth 14.21 over the window.",
      "The app's own timing model (src/engine.js wildcardTiming) puts the five-gameweek deficit of the current fifteen at 64.0 and the break-even for waiting at 136.4 by GW19."
    ]
  },

  draft: {
    // buildClaimSheet (src/mc_analysis.js) on the solved roster's pairs, with the Monte Carlo orderings — the same call
    // data/pre.json makes. Lodge in exactly this order: every first choice, then the backups — the ordering that lands more value under the league's own processing (strategy "firsts").
    // Monte Carlo over 1500 runs, mean Draft value by ordering: all first choices, then backups 640.6; each backup under its first choice 641.2; highest expected gain first 633.6; likeliest to land first 633.5.
    pool: "api",
    pool_note: "League 46148: the ins are free agents in the league's own feed, and the waiver model reproduces the league's claim log (qa/waiver_log.cjs). 12 claims, 5 of them backups. Held back because the player is flagged (re-check after the pressers): Mainoo for Janelt (status d, 75%).",
    claims: [
      { out: 83299, in: 483067, why: "Silva for Dunk (DEF), first choice: +35.3 Draft expected points to GW20, lands in 48% of 1500 simulated waiver runs, stress test: taken first" },
      { out: 437505, in: 444102, why: "Evanilson for Isidor (FWD), first choice: +21.8 Draft expected points to GW20, lands in 86% of 1500 simulated waiver runs, stress test: lands" },
      { out: 455084, in: 200834, why: "Mukiele for Davis (DEF), first choice: +15.6 Draft expected points to GW20, lands in 12% of 1500 simulated waiver runs, stress test: taken first" },
      { out: 540324, in: 484420, why: "E.Le Fée for Belloumi (MID), first choice: +14.0 Draft expected points to GW20, lands in 17% of 1500 simulated waiver runs, stress test: taken first" },
      { out: 226182, in: 463981, why: "Hill for Bogle (DEF), first choice: +13.0 Draft expected points to GW20, lands in 31% of 1500 simulated waiver runs, stress test: taken first" },
      { out: 482973, in: 169432, why: "McBurnie for Igor Jesus (FWD), first choice: +11.7 Draft expected points to GW20, lands in 74% of 1500 simulated waiver runs, stress test: lands" },
      { out: 577725, in: 430871, why: "Cunha for King (MID), first choice: +6.6 Draft expected points to GW20, lands in 19% of 1500 simulated waiver runs, stress test: taken first" },
      { out: 83299, in: 513086, why: "Schuster for Dunk (DEF), backup for Silva: +24.9 Draft expected points to GW20, lands in 29% of 1500 simulated waiver runs, stress test: lands" },
      { out: 437505, in: 613221, why: "Fernandez-Pardo for Isidor (FWD), backup for Evanilson: +8.8 Draft expected points to GW20, lands in 13% of 1500 simulated waiver runs, stress test: not reached" },
      { out: 455084, in: 220627, why: "Justin for Davis (DEF), backup for Mukiele: +11.0 Draft expected points to GW20, lands in 64% of 1500 simulated waiver runs, stress test: lands" },
      { out: 540324, in: 195546, why: "Buendía for Belloumi (MID), backup for E.Le Fée: +10.6 Draft expected points to GW20, lands in 71% of 1500 simulated waiver runs, stress test: lands" },
      { out: 226182, in: 461102, why: "Thomas for Bogle (DEF), backup for Hill: +5.6 Draft expected points to GW20, lands in 69% of 1500 simulated waiver runs, stress test: lands" }
    ],
    // The best eleven of the roster the stress test leaves (src/mc_engine.js bestXI for GW6): 4-5-1, Tzolakis, Murillo, Thomas, Schuster, Guéhi, Buendía, Scott, Xhaka, Janelt, King, N.Jackson.
    xi: {
      formation: "4-5-1",
      gk: 473284,
      def: [575476, 461102, 513086, 209036],
      mid: [195546, 503139, 84450, 204580, 577725],
      fwd: [517052]
    },
    watchlist: []
  },

  chips: {
    set1_expires_gw: 19,
    planned: [{set: 1, chip: "WC", gw: 6},{set: 1, chip: "TC", gw: 7},{set: 1, chip: "BB", gw: 9}],
    note: "Chips from data/plan.json: WC GW6, TC GW7, BB GW9. The free hit is held; its best week is GW8."
  },

  // tournament(live) on data/live.json: notes only; the engine recomputes them every render.
  tournament: { leader: "player_xg", transitions: 4, promote_at_gw: 6 },

  // wildcardTiming(ctx) — the app engine's note; `solved` is the optimiser's (data/plan.json timing).
  timing: { now_vs_later: { by_gw19: 136, by_gw38: 136, breakeven_double_gw17: null, breakeven_later_value: 136 },
    solved: { now: 904.07, later: 899.87, later_gw: 7, never: 889.86, latest: 894.63, latest_gw: 19 } }
};

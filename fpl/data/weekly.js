// WEEKLY STRATEGY ENGINE — decisions only (CONTRACT §4). WRITTEN BY pipeline/weekly.cjs — do not edit by hand;
// change the inputs and re-run it after pipeline/plan.cjs. Classic entries are FPL element ids; Draft entries are
// player codes (join on code, never on id). The figures in the comments and the why lines are the plan's own at
// the moment of writing; the app's engines recompute every figure it shows.
// Plan 2f20653cc20d2d10 (the manager's choice: wildcard GW19 (built from the never plan)), block baked 2026-11-20T11:05:10.415Z, live snapshot 2026-11-20T11:05:03Z.
const WEEKLY = {
  version: 110, gw: 11, written: "2026-11-20", hash: "2f20653cc20d2d10",
  source: "pipeline/plan.cjs on data/mc_data.json baked 2026-11-20T11:05:10.415Z (export hash 2f20653cc20d2d10); data/live.json fetched 2026-11-20T11:05:03Z",

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
    plan: "hold",                                   // "wildcard" | "transfers" | "hold"
    // data/plan.json weeks[0].squad: Verbruggen, De Cuyper, Guéhi, Tarkowski, Gomez, Mbeumo, Rogers, Janelt, Brobbey, Calvert-Lewin, Haaland, Kinsky, Saka, Diop, van Ewijk.
    // Buys ; sells .
    wildcard15: [109, 115, 388, 229, 127, 427, 40, 98, 552, 346, 411, 496, 12, 259, 175],
    // Rule C1.6's only exemption, declared (smoke_wk reads it): the fifteen's players at or over the 60% rival-ownership
    // gate. The plan keeps them because they maximise expected points (v110 §1.2).
    locks: [40, 109, 115, 411],
    // The fifteen's cost at today's prices, recorded so the Plan tab reads it out of the block (E-088).
    wildcard15_cost_written: 967,
    captain: 411, vice: 127,                            // Haaland, Gomez — the plan's own armband for GW11
    // Without the chip: the plan of record's own GW11 week (no chip is played in it).
    fallback: {
      moves: [],
      captain: 411, vice: 127                            // Haaland, Gomez
    },
    chip: null,
    // The week's own ledger, replayed from the rules (data/plan.json replay), never the solver's variables (E-180).
    transfers: [],
    hits: 0, ft_before: 3, ft_after: 4, bank_after: 27,
    manager_choice: "wildcard GW19",
    notes: [
      "The plan of record is the manager's choice (wildcard GW19): the optimiser's no-wildcard plan (pipeline/solve.py, HiGHS), proved within 0.11% of the best plan without a wildcard, with the fifteen rebuilt in GW19: 562.01 Classic expected points from GW11 to GW19, 0 hits.",
      "Chips in the plan: BB GW14, WC GW19; the best free-hit week is GW13 at +4.43, not taken.",
      "Free transfers come from the replayed ledger (data/plan.json replay), never the solver's own variables: 3 into GW11, 4 after it.",
      "No chip before GW13 (the manager's rule of 22 Oct 2026: chips are kept for his last-man-standing league too) and Wildcard 1 in GW19 (his choice of 20 Oct 2026).",
      "Kept but flagged, so not in the eleven unless cleared: Guéhi d 75%, Brobbey i 0%, Saka i 0%.",
      "Rogers, Verbruggen, De Cuyper, Haaland are at or over the 60% rival-ownership gate and kept on purpose; the rule-pure search on the Plan tab prices the difference."
    ],
    why: [
      "The cost of the manager's rules: the solver's own best plan under the GW13 rule plays the wildcard in GW13 for 582.35 Classic expected points to GW19; the plan of record (wildcard GW19) is 562.01, 20.34 less.",
      "Timing (data/plan.json timing): wildcard at the solver's week (GW13) 582.35, later (GW14) 582.44, never 557.70 Classic expected points to GW19.",
      "The wildcard as late as the rules allow, GW19 (the last deadline before set one expires): the no-wildcard plan to the week before, then the fifteen rebuilt for that week (8 changes, 4.32 that week), worth 562.01 Classic expected points, which is 0.00 below the plan, so waiting to the end costs at most that plus the proof tolerance. It is a plan built from a proven one and replayed against the rules, and a floor, not a proved best. Points are counted only to GW19, so a wildcard played in the last week is credited with that week alone and none after it: the cost is what waiting gives up, not the whole comparison.",
      "Without the wildcard the best plan found is 573.82, so the chip is worth -11.81 over the window.",
      "The app's own timing model (src/engine.js wildcardTiming) puts the five-gameweek deficit of the current fifteen at 21.2 and the break-even for waiting at 34.5 by GW19."
    ]
  },

  draft: {
    // buildClaimSheet (src/mc_analysis.js) on the solved roster's pairs, with the Monte Carlo orderings — the same call
    // data/pre.json makes. Lodge in exactly this order: every first choice, then the backups — the ordering that lands more value under the league's own processing (strategy "firsts").
    // Monte Carlo over 1500 runs, mean Draft value by ordering: all first choices, then backups 449.7; each backup under its first choice 449.3; highest expected gain first 449.6; likeliest to land first 449.6.
    pool: "api",
    pool_note: "League 46148: the ins are free agents in the league's own feed, and the waiver model reproduces the league's claim log (qa/waiver_log.cjs). 8 claims, 4 of them backups.",
    claims: [
      { out: 84450, in: 446008, why: "Mbeumo for Xhaka (MID), first choice: +31.7 Draft expected points to GW20, lands in 100% of 1500 simulated waiver runs, stress test: lands" },
      { out: 169528, in: 200834, why: "Mukiele for Robinson (DEF), first choice: +9.5 Draft expected points to GW20, lands in 15% of 1500 simulated waiver runs, stress test: taken first" },
      { out: 577725, in: 432714, why: "McAtee for King (MID), first choice: +6.6 Draft expected points to GW20, lands in 23% of 1500 simulated waiver runs, stress test: taken first" },
      { out: 477555, in: 122806, why: "McGinn for Bobb (MID), first choice: +6.0 Draft expected points to GW20, lands in 60% of 1500 simulated waiver runs, stress test: taken first" },
      { out: 84450, in: 204580, why: "Janelt for Xhaka (MID), backup for Mbeumo: +17.3 Draft expected points to GW20, lands in 0% of 1500 simulated waiver runs, stress test: not reached" },
      { out: 169528, in: 444765, why: "Van den Berg for Robinson (DEF), backup for Mukiele: +4.3 Draft expected points to GW20, lands in 85% of 1500 simulated waiver runs, stress test: lands" },
      { out: 577725, in: 480457, why: "Rudoni for King (MID), backup for McAtee: +4.3 Draft expected points to GW20, lands in 77% of 1500 simulated waiver runs, stress test: lands" },
      { out: 477555, in: 432422, why: "Tonali for Bobb (MID), backup for McGinn: +4.1 Draft expected points to GW20, lands in 40% of 1500 simulated waiver runs, stress test: lands" }
    ],
    // The best eleven of the roster the stress test leaves (src/mc_engine.js bestXI for GW11): 4-5-1, Tzolakis, Silva, Hill, Murillo, Van den Berg, Mbeumo, Rudoni, Tonali, Gomez, Cunha, N.Jackson.
    xi: {
      formation: "4-5-1",
      gk: 473284,
      def: [483067, 463981, 575476, 444765],
      mid: [446008, 480457, 432422, 514254, 430871],
      fwd: [517052]
    },
    watchlist: []
  },

  chips: {
    set1_expires_gw: 19,
    planned: [{set: 1, chip: "BB", gw: 14},{set: 1, chip: "WC", gw: 19}],
    rule: "No chip before GW13 (the manager's rule of 22 Oct 2026: chips are kept for his last-man-standing league too) and Wildcard 1 in GW19 (his choice of 20 Oct 2026).", chips_from_gw: 13, wc1_gw: 19,
    note: "Chips from data/plan.json: BB GW14, WC GW19. The free hit is held; its best week is GW13."
  },

  // tournament(live) on data/live.json: notes only; the engine recomputes them every render.
  tournament: { leader: "player_xg", transitions: 9, promote_at_gw: 11 },

  // wildcardTiming(ctx) — the app engine's note; `solved` is the optimiser's (data/plan.json timing).
  timing: { now_vs_later: { by_gw19: 34, by_gw38: 36, breakeven_double_gw17: null, breakeven_later_value: 34 },
    solved: { now: 582.35, later: 582.44, later_gw: 14, never: 557.7, latest: 562.01, latest_gw: 19 } }
};

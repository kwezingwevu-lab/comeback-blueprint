// WEEKLY STRATEGY ENGINE — decisions only (CONTRACT §4). WRITTEN BY pipeline/weekly.cjs — do not edit by hand;
// change the inputs and re-run it after pipeline/plan.cjs. Classic entries are FPL element ids; Draft entries are
// player codes (join on code, never on id). The figures in the comments and the why lines are the plan's own at
// the moment of writing; the app's engines recompute every figure it shows.
// Plan cd96607c93c3239e (the manager's choice: wildcard GW19 (built from the never plan)), block baked 2026-10-23T05:38:54.074Z, live snapshot 2026-10-23T05:38:50Z.
const WEEKLY = {
  version: 110, gw: 8, written: "2026-10-23", hash: "cd96607c93c3239e",
  source: "pipeline/plan.cjs on data/mc_data.json baked 2026-10-23T05:38:54.074Z (export hash cd96607c93c3239e); data/live.json fetched 2026-10-23T05:38:50Z",

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
    plan: "transfers",                                   // "wildcard" | "transfers" | "hold"
    // data/plan.json weeks[0].squad: Verbruggen, De Cuyper, Tarkowski, Guéhi, Rogers, Gomez, Saka, Janelt, Haaland, Calvert-Lewin, Kinsky, Brobbey, Diop, van Ewijk, Mbeumo.
    // Buys Mbeumo; sells Semenyo.
    wildcard15: [109, 115, 229, 388, 40, 127, 12, 98, 411, 346, 496, 552, 259, 175, 427],
    // Rule C1.6's only exemption, declared (smoke_wk reads it): the fifteen's players at or over the 60% rival-ownership
    // gate. The plan keeps them because they maximise expected points (v110 §1.2).
    locks: [40, 109, 115, 411],
    // The fifteen's cost at today's prices, recorded so the Plan tab reads it out of the block (E-088).
    wildcard15_cost_written: 966,
    captain: 411, vice: 427,                            // Haaland, Mbeumo — the plan's own armband for GW8
    // Without the chip: the plan of record's own GW8 week (no chip is played in it).
    fallback: {
      moves: [{out: 397, in: 427}],
      captain: 411, vice: 427                            // Haaland, Mbeumo
    },
    chip: null,
    // The week's own ledger, replayed from the rules (data/plan.json replay), never the solver's variables (E-180).
    transfers: [{out: 397, in: 427}],
    hits: 0, ft_before: 1, ft_after: 1, bank_after: 27,
    manager_choice: "wildcard GW19",
    notes: [
      "The plan of record is the manager's choice (wildcard GW19): the optimiser's no-wildcard plan (pipeline/solve.py, HiGHS), proved within 0.40% of the best plan without a wildcard, with the fifteen rebuilt in GW19: 729.58 Classic expected points from GW8 to GW19, 1 hits.",
      "Chips in the plan: BB GW16, WC GW19; the best free-hit week is GW13 at +3.48, not taken.",
      "Free transfers come from the replayed ledger (data/plan.json replay), never the solver's own variables: 1 into GW8, 1 after it.",
      "No chip before GW13 (the manager's rule of 22 Oct 2026: chips are kept for his last-man-standing league too) and Wildcard 1 in GW19 (his choice of 20 Oct 2026).",
      "Kept but flagged, so not in the eleven unless cleared: Saka d 50%, Janelt s 0%, Brobbey d 75%.",
      "Rogers, Verbruggen, De Cuyper, Haaland are at or over the 60% rival-ownership gate and kept on purpose; the rule-pure search on the Plan tab prices the difference."
    ],
    why: [
      "The cost of the manager's rules: the solver's own best plan under the GW13 rule plays the wildcard in GW13 for 728.59 Classic expected points to GW19; the plan of record (wildcard GW19) is 729.58, -0.99 less.",
      "Timing (data/plan.json timing): wildcard at the solver's week (GW13) 728.59, later (GW14) 725.88, never 726.05 Classic expected points to GW19.",
      "The wildcard as late as the rules allow, GW19 (the last deadline before set one expires): the no-wildcard plan to the week before, then the fifteen rebuilt for that week (10 changes, 3.54 that week), worth 729.58 Classic expected points, which is 0.00 below the plan, so waiting to the end costs at most that plus the proof tolerance. It is a plan built from a proven one and replayed against the rules, and a floor, not a proved best. Points are counted only to GW19, so a wildcard played in the last week is credited with that week alone and none after it: the cost is what waiting gives up, not the whole comparison.",
      "Without the wildcard the best plan found is 726.05, so the chip is worth 3.53 over the window.",
      "The app's own timing model (src/engine.js wildcardTiming) puts the five-gameweek deficit of the current fifteen at 23.5 and the break-even for waiting at 43.5 by GW19."
    ]
  },

  draft: {
    // buildClaimSheet (src/mc_analysis.js) on the solved roster's pairs, with the Monte Carlo orderings — the same call
    // data/pre.json makes. This gameweek's waivers have settled: each line says whether its player can be signed now or is locked until the next run, in order of gain.
    // Monte Carlo over 1500 runs, mean Draft value by ordering: all first choices, then backups 549.8; each backup under its first choice 549.8; highest expected gain first 549.8; likeliest to land first 549.8.
    pool: "api",
    pool_note: "League 46148: the ins are free agents in the league's own feed, and the waiver model reproduces the league's claim log (qa/waiver_log.cjs). 2 claims, 0 of them backups. Waivers for GW8 have settled, so a free agent is signed instantly until the deadline and a player dropped in that run is locked until the next.",
    claims: [
      { out: 442299, in: 575476, why: "Murillo for Affengruber (DEF), first choice: +12.7 Draft expected points to GW20, sign now (a free agent until the GW8 deadline)" },
      { out: 577725, in: 166989, why: "Tielemans for King (MID), first choice: +6.7 Draft expected points to GW20, sign now (a free agent until the GW8 deadline)" }
    ],
    // The best eleven of the roster the stress test leaves (src/mc_engine.js bestXI for GW8): 5-4-1, Sels, Murillo, Mukiele, Guéhi, Silva, Hill, Cunha, King, Xhaka, Buendía, N.Jackson.
    xi: {
      formation: "5-4-1",
      gk: 85633,
      def: [575476, 200834, 209036, 483067, 463981],
      mid: [430871, 577725, 84450, 195546],
      fwd: [517052]
    },
    watchlist: []
  },

  chips: {
    set1_expires_gw: 19,
    planned: [{set: 1, chip: "BB", gw: 16},{set: 1, chip: "WC", gw: 19}],
    rule: "No chip before GW13 (the manager's rule of 22 Oct 2026: chips are kept for his last-man-standing league too) and Wildcard 1 in GW19 (his choice of 20 Oct 2026).", chips_from_gw: 13, wc1_gw: 19,
    note: "Chips from data/plan.json: BB GW16, WC GW19. The free hit is held; its best week is GW13."
  },

  // tournament(live) on data/live.json: notes only; the engine recomputes them every render.
  tournament: { leader: "player_xg", transitions: 6, promote_at_gw: 8 },

  // wildcardTiming(ctx) — the app engine's note; `solved` is the optimiser's (data/plan.json timing).
  timing: { now_vs_later: { by_gw19: 43, by_gw38: 43, breakeven_double_gw17: null, breakeven_later_value: 43 },
    solved: { now: 728.59, later: 725.88, later_gw: 14, never: 726.05, latest: 729.58, latest_gw: 19 } }
};

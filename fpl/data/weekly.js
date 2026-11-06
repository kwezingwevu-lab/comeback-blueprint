// WEEKLY STRATEGY ENGINE — decisions only (CONTRACT §4). WRITTEN BY pipeline/weekly.cjs — do not edit by hand;
// change the inputs and re-run it after pipeline/plan.cjs. Classic entries are FPL element ids; Draft entries are
// player codes (join on code, never on id). The figures in the comments and the why lines are the plan's own at
// the moment of writing; the app's engines recompute every figure it shows.
// Plan 8c02411311c006fa (the manager's choice: wildcard GW19 (built from the never plan)), block baked 2026-11-06T15:02:46.508Z, live snapshot 2026-11-06T15:02:43Z.
const WEEKLY = {
  version: 110, gw: 10, written: "2026-11-06", hash: "8c02411311c006fa",
  source: "pipeline/plan.cjs on data/mc_data.json baked 2026-11-06T15:02:46.508Z (export hash 8c02411311c006fa); data/live.json fetched 2026-11-06T15:02:43Z",

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
    // data/plan.json weeks[0].squad: Verbruggen, De Cuyper, Tarkowski, Diop, Mbeumo, Rogers, Gomez, Janelt, Haaland, Brobbey, Calvert-Lewin, Kinsky, Saka, Guéhi, van Ewijk.
    // Buys ; sells .
    wildcard15: [109, 115, 229, 259, 427, 40, 127, 98, 411, 552, 346, 496, 12, 388, 175],
    // Rule C1.6's only exemption, declared (smoke_wk reads it): the fifteen's players at or over the 60% rival-ownership
    // gate. The plan keeps them because they maximise expected points (v110 §1.2).
    locks: [40, 115, 411],
    // The fifteen's cost at today's prices, recorded so the Plan tab reads it out of the block (E-088).
    wildcard15_cost_written: 966,
    captain: 411, vice: 427,                            // Haaland, Mbeumo — the plan's own armband for GW10
    // Without the chip: the plan of record's own GW10 week (no chip is played in it).
    fallback: {
      moves: [],
      captain: 411, vice: 427                            // Haaland, Mbeumo
    },
    chip: null,
    // The week's own ledger, replayed from the rules (data/plan.json replay), never the solver's variables (E-180).
    transfers: [],
    hits: 0, ft_before: 2, ft_after: 3, bank_after: 27,
    manager_choice: "wildcard GW19",
    notes: [
      "The plan of record is the manager's choice (wildcard GW19): the optimiser's no-wildcard plan (pipeline/solve.py, HiGHS), proved within 0.27% of the best plan without a wildcard, with the fifteen rebuilt in GW19: 607.42 Classic expected points from GW10 to GW19, 0 hits.",
      "Chips in the plan: BB GW16, WC GW19; the best free-hit week is GW15 at +4.22, not taken.",
      "Free transfers come from the replayed ledger (data/plan.json replay), never the solver's own variables: 2 into GW10, 3 after it.",
      "No chip before GW13 (the manager's rule of 22 Oct 2026: chips are kept for his last-man-standing league too) and Wildcard 1 in GW19 (his choice of 20 Oct 2026).",
      "Kept but flagged, so not in the eleven unless cleared: Calvert-Lewin d 75%, Saka i 0%.",
      "Rogers, De Cuyper, Haaland are at or over the 60% rival-ownership gate and kept on purpose; the rule-pure search on the Plan tab prices the difference."
    ],
    why: [
      "The cost of the manager's rules: the solver's own best plan under the GW13 rule plays the wildcard in GW13 for 630.04 Classic expected points to GW19; the plan of record (wildcard GW19) is 607.42, 22.62 less.",
      "Timing (data/plan.json timing): wildcard at the solver's week (GW13) 630.04, later (GW14) 628.03, never 605.00 Classic expected points to GW19.",
      "The wildcard as late as the rules allow, GW19 (the last deadline before set one expires): the no-wildcard plan to the week before, then the fifteen rebuilt for that week (5 changes, 2.43 that week), worth 607.42 Classic expected points, which is 0.00 below the plan, so waiting to the end costs at most that plus the proof tolerance. It is a plan built from a proven one and replayed against the rules, and a floor, not a proved best. Points are counted only to GW19, so a wildcard played in the last week is credited with that week alone and none after it: the cost is what waiting gives up, not the whole comparison.",
      "Without the wildcard the best plan found is 624.05, so the chip is worth -16.63 over the window.",
      "The app's own timing model (src/engine.js wildcardTiming) puts the five-gameweek deficit of the current fifteen at 29.0 and the break-even for waiting at 48.8 by GW19."
    ]
  },

  draft: {
    // buildClaimSheet (src/mc_analysis.js) on the solved roster's pairs, with the Monte Carlo orderings — the same call
    // data/pre.json makes. This gameweek's waivers have settled: each line says whether its player can be signed now or is locked until the next run, in order of gain.
    // Monte Carlo over 1500 runs, mean Draft value by ordering: all first choices, then backups 485.9; each backup under its first choice 485.9; highest expected gain first 485.9; likeliest to land first 485.7.
    pool: "api",
    pool_note: "League 46148: the ins are free agents in the league's own feed, and the waiver model reproduces the league's claim log (qa/waiver_log.cjs). 4 claims, 1 of them backups. Waivers for GW10 have settled, so a free agent is signed instantly until the deadline and a player dropped in that run is locked until the next.",
    claims: [
      { out: 577725, in: 446008, why: "Mbeumo for King (MID), first choice: +21.4 Draft expected points to GW20, locked until the next waiver run, so lodge it as a claim then" },
      { out: 477555, in: 432714, why: "McAtee for Bobb (MID), first choice: +7.4 Draft expected points to GW20, locked until the next waiver run, so lodge it as a claim then" },
      { out: 514254, in: 432422, why: "Tonali for Gomez (MID), first choice: +0.8 Draft expected points to GW20, locked until the next waiver run, so lodge it as a claim then" },
      { out: 577725, in: 122806, why: "McGinn for King (MID), backup for Mbeumo: +3.6 Draft expected points to GW20, sign now (a free agent until the GW10 deadline)" }
    ],
    // The best eleven of the roster the stress test leaves (src/mc_engine.js bestXI for GW10): 4-5-1, Tzolakis, Silva, Hill, Affengruber, Murillo, Cunha, Xhaka, Bobb, Gomez, McGinn, N.Jackson.
    xi: {
      formation: "4-5-1",
      gk: 473284,
      def: [483067, 463981, 442299, 575476],
      mid: [430871, 84450, 477555, 514254, 122806],
      fwd: [517052]
    },
    watchlist: []
  },

  chips: {
    set1_expires_gw: 19,
    planned: [{set: 1, chip: "BB", gw: 16},{set: 1, chip: "WC", gw: 19}],
    rule: "No chip before GW13 (the manager's rule of 22 Oct 2026: chips are kept for his last-man-standing league too) and Wildcard 1 in GW19 (his choice of 20 Oct 2026).", chips_from_gw: 13, wc1_gw: 19,
    note: "Chips from data/plan.json: BB GW16, WC GW19. The free hit is held; its best week is GW15."
  },

  // tournament(live) on data/live.json: notes only; the engine recomputes them every render.
  tournament: { leader: "player_xg", transitions: 8, promote_at_gw: 10 },

  // wildcardTiming(ctx) — the app engine's note; `solved` is the optimiser's (data/plan.json timing).
  timing: { now_vs_later: { by_gw19: 49, by_gw38: 50, breakeven_double_gw17: null, breakeven_later_value: 49 },
    solved: { now: 630.04, later: 628.03, later_gw: 14, never: 605, latest: 607.42, latest_gw: 19 } }
};

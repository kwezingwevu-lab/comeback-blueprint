// WEEKLY STRATEGY ENGINE — decisions only (CONTRACT §4). The engine recomputes every
// number live; nothing here is a model output. Classic entries are FPL element ids;
// draft entries are player "code"s (draft ids differ from classic for 64 of 667 players
// on this snapshot — join on code, never on id).
// Written 26 September 2026 against data/live.json fetched 2026-09-26T10:49:45Z
// (five finished gameweeks, GW6 deadline 2026-10-10T10:00:00Z, 335 hours away).
// Every figure in the comments below came out of src/engine.js on that snapshot and is
// reproducible: buildCtx(LIVE, state/kwezi.json, now) then the named function.
const WEEKLY = {
  version: 89, gw: 6, written: "2026-09-26", source: "src/engine.js on data/live.json fetched 2026-09-26T10:49:45Z",

  // The v87/v88 plan of record recommended Wildcard 1 in GW4. It was NOT played:
  // history.chips is [] on 26 September 2026 and all four chips of both sets remain.
  // He made one transfer all season, in GW5 (João Pedro out, Calvert-Lewin in), and
  // carries four free transfers into GW6. That plan is recorded here rather than
  // deleted, so the history is not quietly rewritten.
  superseded: {
    version: 88, gw: 4, plan: "wildcard",
    what: "Play Wildcard 1 in GW4 with Tzolakis, Raya, Calafiori, Ajayi, Tarkowski, Bogle, Mendy, Janelt, Saka, Scott, Rogers, Barnes, João Pedro, Haaland, Barry; captain João Pedro.",
    outcome: "Never played. He kept his fifteen, captained Haaland and scored 71 against a field average of 69.",
    measured: "state/kwezi.json ledger, GW4 chip row: the fifteen of record scored 96 across all fifteen and 102 as its best legal eleven in hindsight with João Pedro captained, against the 71 he played. The regret is an upper bound because a squad that was never played has no played eleven.",
    evidence: "history.chips === [] · history.current[].event_transfers === [0,0,0,0,1]"
  },

  classic: {
    plan: "wildcard",                                   // "wildcard" | "transfers" | "hold"
    // wildcardOptions(ctx, {written}).locked — the rule-pure solve with the one convergent
    // player the manager already owns locked in. Cost £98.8m of a £99.5m selling value, £0.7m
    // left, objective 230.86 against the pure solve's 225.11: keeping Haaland is worth +5.75
    // over five gameweeks and spends £7.8m more. Haaland, Groß, De Cuyper, Bogle, Gvardiol,
    // Guéhi, Schade, Janelt, Tarkowski, Tzolakis, Cunha, Tavernier, A.Becker, Emersonn, Isak.
    wildcard15: [411, 124, 115, 330, 391, 388, 94, 98, 229, 572, 428, 68, 350, 316, 379],
    // Rule C1.6 keeps anyone at or above 60% rival ownership out of the solver. Haaland is
    // 100% rival-owned across the six winnable leagues, so he is out of the rule-pure solve
    // and is declared here as the one explicit lock — the only exemption the solver takes.
    locks: [411],
    captain: 124, vice: 94,                             // Groß (BHA), Schade (BRE) — bestXI 3-4-3
    // Without the chip: the C2 weekly protocol, three of his four free transfers, no hit.
    // Four players are forced sells and only three swaps are searched (C2 caps k at 3), so
    // the highest-xP forced sell — Semenyo — stays for another week.
    fallback: {
      moves: [{ out: 175, in: 115 }, { out: 212, in: 127 }, { out: 552, in: 316 }],
      captain: 411, vice: 12                            // Haaland, Saka — bestXI of the post-move fifteen
    },
    chip: "wildcard",
    notes: [
      "Four forced sells, three slots: van Ewijk (d 75%), Hughes (0 starts in 3) and Brobbey (d 75%) go; Semenyo (d 75%) stays because he has the highest five-week xP of the four.",
      "Haaland is 100% rival-owned across the six winnable leagues, over the 60% convergence gate, so rule C1.6 keeps him out of the rule-pure solve. He is locked into the written fifteen instead, which is worth +5.75 over five gameweeks and spends £7.8m more of the bank. The rule protects mini-league rank against the field; the points say the opposite. Both answers are priced side by side.",
      "The captain is Groß on the chip path, not Haaland: on the wildcard fifteen his EV_cap is the highest in the eleven. On the fallback path, where Groß is not owned, Haaland captains.",
      "wildcardOptions prices the rule-pure solve, the same solve with Haaland locked in, and the written fifteen under one objective; the Plan tab shows all three."
    ],
    // C3 runs the solve under both fixture models and ships only what is equal-or-better
    // under both. It is NOT equal-or-better here: four players differ and the goals model
    // scores its own answer higher (247.79 against 242.30 for the xG answer). That is the
    // v74 lesson, and it is why the numbers below are quoted with the disagreement attached.
    why: [
      "wildcardTiming: the five-gameweek deficit of the current fifteen against the best fifteen is 82.2 points against a trigger of 20, and 143.9 cumulative to the GW19 expiry of chip set one, after allowing for repair at one free transfer a week.",
      "chipSolver assigns Wildcard 1 to set one, GW6, at 143.9 points, and confirms no double and no blank anywhere on the fixture list — every club has exactly one fixture in every remaining gameweek, so there is nothing for a Bench Boost, a Triple Captain or a Free Hit to aim at yet.",
      "Fourteen of fifteen change. The deficit is driven by four flagged players and a bench worth 0.9 to 7.5 five-week xP, and the two fixture models disagree on four of the fifteen, so the fifteen is a model answer and not a forecast.",
      "There is no deadline pressure: 335 hours to GW6, an international break. Flags on Semenyo, Brobbey, van Ewijk and João Pedro will be re-read after the pressers, and three of the four repairs are free either way."
    ]
  },

  draft: {
    // draftWaivers(state, ctx) on this snapshot: six claims, every one a forced replacement,
    // ordered by descending gain (C5). The free-agent pool CANNOT be seen without the draft
    // league id, which is still unknown, so each claim's `in` is the engine's best available
    // replacement over the WHOLE player list and every row is marked pool "assumed" in the
    // data as well as in the copy. Expect the top names to be owned in a seven-team league;
    // supply the league id and the list is re-derived from the real element-status pool.
    pool: "assumed",
    pool_note: "No draft league id. The outs are sourced — they are the six players on the saved roster with no starts in the last three or a status that is not 'a'. The ins are the engine's best replacement by five-week xP × P(start) over every player, because the pool is unknown.",
    claims: [
      { out: 221466, in: 465730, why: "Senesi has no starts in the last 3; De Cuyper is the best available defender by EV (+20.2), pool assumed" },
      { out: 108413, in: 513418, why: "Hughes has no starts in the last 3; Schade is the best available midfielder by EV (+19.7), pool assumed" },
      { out: 482973, in: 223094, why: "Igor Jesus has no starts in the last 3; Haaland is the best available forward by EV (+18.8), pool assumed — almost certainly owned in a seven-team league" },
      { out: 204480, in: 60307, why: "Rice is status d; Groß is the best available midfielder left by EV (+18.5), pool assumed" },
      { out: 153682, in: 141746, why: "Wilson (assumed to be the Leeds midfielder, code 153682) is status i; B.Fernandes is next by EV (+18.2), pool assumed" },
      { out: 212319, in: 219168, why: "Richarlison is status u; Isak is the best available forward left by EV (+16.5), pool assumed — almost certainly owned" }
    ],
    // draftXI on the post-claim twelve: 3-5-2, Verbruggen · De Cuyper, Guéhi, Truffert ·
    // Groß, Schade, B.Fernandes, Mbeumo, Gibbs-White · Isak, Haaland. Three of the fifteen
    // roster slots are still unknown (state/kwezi.json draft.roster_note).
    xi: {
      formation: "3-5-2",
      gk: 489639,
      def: [465730, 209036, 494521],
      mid: [60307, 513418, 141746, 446008, 222531],
      fwd: [219168, 223094]
    },
    // Empty on purpose: the manager's 44-name watchlist has never been available to this
    // build. The rule stands (on the list only if he started the last three); populate it
    // from the draft app and watchlistAudit scores it.
    watchlist: []
  },

  chips: {
    set1_expires_gw: 19,
    // chipSolver's joint answer over both sets on this snapshot.
    planned: [{ set: 1, chip: "WC", gw: 6 }],
    note: "No double and no blank is confirmed anywhere on the fixture list, so Bench Boost, Triple Captain and Free Hit are unassigned in both sets."
  },

  // tournament(live) on this snapshot: nine models, four walk-forward transitions.
  // player_xg leads on both metrics (ρ 0.3054, calibrated MAE 2.24) and has won three of
  // the four transitions, but its trailing hold-out is one gameweek against the two the
  // gate wants, so promotionGate says no and nothing it produces drives a recommendation.
  // GW6 scores the fifth transition and decides it.
  tournament: { leader: "player_xg", transitions: 4, promote_at_gw: 6 },

  // wildcardTiming(ctx) — notes only; the engine recomputes them every render.
  // `breakeven_double_gw17` is null because the fixture list still carries no double
  // gameweek to price (chipSolver: doubles 0, blanks 0). `breakeven_later_value` is the
  // value a later window would have to be worth for waiting to break even.
  timing: { now_vs_later: { by_gw19: 144, by_gw38: 144, breakeven_double_gw17: null, breakeven_later_value: 144 } }
};

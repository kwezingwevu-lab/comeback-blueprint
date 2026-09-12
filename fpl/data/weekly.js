// WEEKLY STRATEGY ENGINE — decisions only (CONTRACT §4). The engine recomputes every
// number live; nothing here is a model output. Classic entries are FPL element ids;
// draft entries are player "code"s (draft ids differ from classic for 59 players).
// Names in comments were resolved against bootstrap-static on 11 Sep 2026.
const WEEKLY = {
  version: 88, gw: 4, written: "2026-09-11", source: "CLAUDE.md Part M + live check 11 Sep 2026",
  classic: {
    plan: "wildcard",                                   // "wildcard" | "transfers" | "hold"
    // Tzolakis, Raya · Calafiori, Ajayi, Tarkowski, Bogle, Mendy · Janelt, Saka, Scott, Rogers, Barnes · João Pedro, Haaland, Barry
    wildcard15: [572, 1, 8, 279, 229, 330, 586, 98, 12, 69, 40, 453, 165, 411, 249],
    captain: 165, vice: 411,                            // João Pedro (CHE v HUL), Haaland
    // Without the wildcard: Hughes→Yalcouyé, Shaw→Ajayi, Diop→Mendy
    fallback: { moves: [{ out: 212, in: 605 }, { out: 423, in: 279 }, { out: 259, in: 586 }], captain: 165, vice: 411 },
    chip: "wildcard", notes: ["Gakpo out (thigh, 75%) → Janelt"]
  },
  draft: {
    // Six claims in Part M order. out/in are codes: Richarlison 212319 · Isidor 437505 ·
    // Hughes 108413 · Janelt 204580 · Senesi 221466 · Bogle 226182 · Wilson (LEE MID) 153682 ·
    // Scott 503139 · Truffert 494521 · Vuskovic 610799 · Verbruggen 489639 · Tzolakis 473284.
    // "Wilson" is assumed to be the Leeds midfielder (id 260); Brentford (108) and Coventry (172) also carry the name.
    claims: [
      { out: 212319, in: 437505, why: "Richarlison unavailable (status u); Isidor is the best free-agent forward on points — no free agent forward has three starts" },
      { out: 108413, in: 204580, why: "Hughes has 0 starts in 3; Janelt has started all 3 for Brentford" },
      { out: 221466, in: 226182, why: "Senesi 1 start in 3; Bogle has started all 3 for Leeds — DEF value is CS + DefCon + BPS" },
      { out: 153682, in: 503139, why: "Wilson (LEE MID, assumed of three Wilsons) 1 start in 3; Scott has started all 3 for Bournemouth" },
      { out: 494521, in: 610799, why: "Both have three starts; Vuskovic 18 pts and 44 BPS to Truffert 5 pts and 24 BPS over GW1-3; smallest gain of the six, so claimed last but one" },
      { out: 489639, in: 473284, why: "Both have three starts; Tzolakis 26 pts, 3 clean sheets, 9 saves to Verbruggen 9 pts, 1 clean sheet, 4 saves over GW1-3; a keeper swap is the lowest-priority claim" }
    ],
    // 3-5-2: Tzolakis · Guéhi, Bogle, Vuskovic · Mbeumo, Janelt, Scott, Gibbs-White, Rice · Igor Jesus, N.Jackson
    xi: {
      formation: "3-5-2",
      gk: 473284,
      def: [209036, 226182, 610799],
      mid: [446008, 204580, 503139, 222531, 204480],
      fwd: [482973, 517052]
    },
    // Empty on purpose: the manager's 44-name watchlist was not available to the v87
    // rebuild. The rule stands (on the list only if started the last three); populate
    // from the draft app and run watchlistAudit before trusting it.
    watchlist: []
  },
  chips: { set1_expires_gw: 19, planned: [] },
  tournament: { leader: "bps_rate", transitions: 2, promote_at_gw: 5 },
  timing: { now_vs_later: { by_gw19: 21, by_gw38: 45, breakeven_double_gw17: 45 } }   // from the master prompt C4; recomputed by the engine when data allows
};

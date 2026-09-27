/* pipeline/intel.js — desk research the feeds cannot see. Dated, sourced, and only ever an override
   (v110 §5 A7). This is the one hand-typed input to the bake: bookmaker match prices by gameweek,
   the gameweek 5 market anchors kept for calibration, per-gameweek start-probability overrides where
   dated reporting is ahead of the official flag, notes and sources. Every entry carries a date;
   qa/bake.cjs refuses an undated one. Block dated 26 Sep 2026, ported from the v111 kit; the lines
   marked "Carried from the 22 Sep block" or ending in a reporting date were undated in the kit and
   carry the date the block's own sources give, nothing more.
   Consumed by pipeline/bake.js (default --intel path); a .json path there means "use that file's
   intel key" instead, which is how the parity test bakes the reference block with its own INTEL. */
"use strict";

const INTEL = {
  asOf: "2026-09-26T17:30:00Z",
  /* Gameweek 5 market numbers (allaboutfpl / Fantasy Football Scout clean-sheet odds and RotoWire prices, 17 Sep). Kept as calibration anchors now the week is played. */
  market5: { MCI: { xg: 2.36, cs: 0.48 }, NEW: { xg: 2.01, cs: 0.35 }, NFO: { xg: 1.88, cs: 0.38 }, LIV: { xg: 1.84 }, ARS: { xg: 1.80, cs: 0.34 }, EVE: { xg: 1.80, cs: 0.34 }, MUN: { xg: 1.80 }, CHE: { xg: 1.77 }, LEE: { xg: 1.77, cs: 0.33 }, TOT: { cs: 0.31 } },
  /* Average bookmaker match prices (home, draw, away), OddsPortal, read 26 September. Every fixture
     was checked against the official fixtures feed for its gameweek and its home side before it was
     entered here: OddsPortal groups by date, and it also carried a spurious Brentford v Liverpool row
     on 11 October that the feed places in gameweek 7 alone. Gameweek 7 is now fully priced, ten of ten,
     where the 21 September read had only three. */
  odds: {
    6: [["ARS", "LEE", 1.37, 4.85, 7.50], ["AVL", "BRE", 2.59, 3.53, 2.55], ["CHE", "BOU", 1.78, 4.07, 3.91], ["IPS", "FUL", 2.68, 3.45, 2.49], ["SUN", "BHA", 2.88, 3.41, 2.35],
        ["MUN", "TOT", 1.69, 4.03, 4.31], ["CRY", "NFO", 2.59, 3.29, 2.64], ["HUL", "EVE", 3.53, 3.35, 2.06], ["LIV", "MCI", 2.59, 3.60, 2.48], ["COV", "NEW", 3.28, 3.57, 2.09]],
    7: [["EVE", "CHE", 2.82, 3.65, 2.28], ["BRE", "LIV", 2.68, 3.70, 2.35], ["FUL", "HUL", 1.63, 4.00, 4.85], ["MCI", "IPS", 1.20, 6.33, 10.67], ["NEW", "AVL", 2.07, 3.70, 3.18],
        ["BOU", "SUN", 1.97, 3.53, 3.58], ["BHA", "CRY", 1.52, 4.37, 5.32], ["LEE", "MUN", 2.80, 3.53, 2.33], ["NFO", "ARS", 5.55, 4.00, 1.56], ["TOT", "COV", 1.48, 4.48, 5.88]],
  },
  /* Start-probability overrides by gameweek, where dated reporting is ahead of the official flag.
     Only players in one of the two squads, the plan or the claims pool are listed: an override on a
     player nobody can pick changes nothing. Each one says which way it moves the official number.
     Gameweek 5 is played; its three overrides are kept as the record of what the model believed, and
     carry the date of the block they came from. */
  start: {
    5: { "João Pedro|CHE": { p: 0.15, why: "ESPN Brasil: knee, about three and a half weeks. He did miss Brentford. Carried from the 22 Sep block." }, "Shaw|MUN": { p: 0.40, why: "Carrick: 'half a chance'. Carried from the 22 Sep block." }, "N.Jackson|AVL": { p: 0.55, why: "Hooked at half-time the week before. Carried from the 22 Sep block." } },
    6: {
      "João Pedro|CHE": { p: 0.65, why: "Alonso, via premierleague.com 18 Sep, says he should be in contention for Bournemouth on 10 October; the three-week break is the reason. The Standard and Yahoo, 21 Sep, agree the target is that match. Official flag 75%, and this holds the 21 Sep number rather than churn it." },
      "Semenyo|MCI": { p: 0.50, why: "BELOW the 75% flag. Withdrew from the Ghana squad with a swollen leg: Ghana FA president Kurt Okraku, 25 Sep, quotes him saying 'my leg is swollen, and we need to treat it'. Yahoo and BritBall, 24-25 Sep: no confirmed recovery timetable, and his availability for Liverpool away is in doubt — that fixture IS gameweek 6." },
      "Brobbey|SUN": { p: 0.40, why: "BELOW the 75% flag. Non-contact hamstring for the Netherlands, went down untouched and limped down the tunnel, sent back to Sunderland early (Fantasy Football Scout, 25 Sep). Fifteen days to the deadline and no contact makes a hamstring the slow kind. He scored a hat-trick in gameweek 5, so the flag is the only thing holding his price." },
      "van Ewijk|COV": { p: 0.80, why: "ABOVE the 75% flag. Lampard, 19 Sep: a small hamstring issue, and he missed one match. Three weeks of break follow, so the flag is likely to be lifted before the deadline." },
      "Dunk|BHA": { p: 0.88, why: "ABOVE the 75% flag. A stiff neck, out of one match against Arsenal (Andy Naylor, The Athletic, 19 Sep). Three weeks of break follow. Draft roster." },
      "Havertz|ARS": { p: 0.45, why: "Not owned in either squad; here because he is a wildcard-pool candidate. Suspected hamstring in the 1-1 with the Netherlands after a challenge from Quinten Timber, sent for a scan, and Klopp said he was likely to miss the rest of the international break (Fantasy Football Scout, 25 Sep)." },
    },
  },
  notes: [
    "The September and October international windows are merged: no Premier League football between 20 September and Saturday 10 October. Gameweek 6 is the first football in three weeks.",
    "Set the Draft claims and build the wildcard as late as the deadlines allow. Three weeks of international duty is three weeks of injury risk, and almost none of it is reported until the press conferences on 8 and 9 October.",
    "Two of his own players got worse over the break, and both are flagged at 75% when the reporting says less. Semenyo withdrew from Ghana with a swollen leg and no timetable, and his club face Liverpool in gameweek 6. Brobbey pulled a hamstring without contact for the Netherlands and was sent back to Sunderland, a fortnight after a gameweek 5 hat-trick. Reported by Metro on 24 Sep and Fantasy Football Scout on 25 Sep.",
    "Two got better. Van Ewijk missed one match with what Lampard called a small hamstring issue, and Dunk missed one with a stiff neck; both have three weeks to clear, so their 75% flags are likely to lift. Both reported 19 Sep: Coventry City on van Ewijk, The Athletic on Dunk.",
    "Havertz is the notable absentee outside his squads: a suspected hamstring on international duty, scanned, and expected to miss the rest of the break. Fantasy Football Scout, 25 Sep.",
    "Price moves among his own players since the last build, from the feed rather than from a forum: Konsa +0.1 to £4.6, Tzolakis +0.1 to £4.7, Shaw -0.1 to £4.3, Brobbey -0.1 to £5.7. Feed pulled 26 Sep.",
    "There are two players called Hughes. He owns id 212, the Crystal Palace midfielder at £4.4, who is fit and unflagged. The one carrying 'Groin injury - Unknown return date' is id 278, a Hull defender at £3.9. Match on id, never on the name. Read from the feed pulled 26 Sep.",
  ],
  sources: [
    "Official Fantasy Premier League and FPL Draft feeds, pulled 26 Sep 17:15Z",
    "OddsPortal average match prices for gameweeks 6 and 7, read 26 Sep",
    "Fantasy Football Scout, 25 Sep: Havertz, Brobbey and Semenyo injury latest after international withdrawals",
    "Ghana FA president Kurt Okraku on Semenyo, quoted 25 Sep",
    "Yahoo Sports, 25 Sep, and BritBall, 24 Sep, on Semenyo's lack of a recovery timetable",
    "Metro, 24 Sep: Semenyo withdraws from international duty with a swollen leg",
    "premierleague.com, 18 Sep: Alonso on João Pedro being in contention for Bournemouth",
    "Andy Naylor, The Athletic, 19 Sep, on Dunk's stiff neck",
    "Coventry City, 19 Sep: Lampard on van Ewijk's small hamstring issue",
    "allaboutfpl and Fantasy Football Scout gameweek 5 clean-sheet odds, 17 Sep (calibration anchors only)",
  ],
};

module.exports = INTEL;

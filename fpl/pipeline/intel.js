/* pipeline/intel.js — desk research the feeds cannot see. Dated, sourced, and only ever an override
   (v110 §5 A7). This is the one hand-typed input to the bake: bookmaker match prices by gameweek,
   the gameweek 5 market anchors kept for calibration, per-gameweek start-probability overrides where
   dated reporting is ahead of the official flag, notes and sources. Every entry carries a date;
   qa/bake.cjs refuses an undated one. Re-read in full on 2 Oct 2026 (odds, overrides, notes, sources); first dated 26 Sep 2026, ported from the v111 kit; the lines
   marked "Carried from the 22 Sep block" or ending in a reporting date were undated in the kit and
   carry the date the block's own sources give, nothing more.
   Consumed by pipeline/bake.js (default --intel path); a .json path there means "use that file's
   intel key" instead, which is how the parity test bakes the reference block with its own INTEL. */
"use strict";

const INTEL = {
  asOf: "2026-10-02T13:45:00Z",
  /* Gameweek 5 market numbers (allaboutfpl / Fantasy Football Scout clean-sheet odds and RotoWire prices, 17 Sep). Kept as calibration anchors now the week is played. */
  market5: { MCI: { xg: 2.36, cs: 0.48 }, NEW: { xg: 2.01, cs: 0.35 }, NFO: { xg: 1.88, cs: 0.38 }, LIV: { xg: 1.84 }, ARS: { xg: 1.80, cs: 0.34 }, EVE: { xg: 1.80, cs: 0.34 }, MUN: { xg: 1.80 }, CHE: { xg: 1.77 }, LEE: { xg: 1.77, cs: 0.33 }, TOT: { cs: 0.31 } },
  /* Average bookmaker match prices (home, draw, away), OddsPortal, read 26 September. Every fixture
     was checked against the official fixtures feed for its gameweek and its home side before it was
     entered here: OddsPortal groups by date, and it also carried a spurious Brentford v Liverpool row
     on 11 October that the feed places in gameweek 7 alone. Gameweek 7 is now fully priced, ten of ten,
     where the 21 September read had only three. */
  odds: {
    /* Average bookmaker match prices (home, draw, away), OddsPortal, read 2 Oct 2026 07:25Z from a live (uncached) scrape of the
       Premier League page; gameweek 6 read twice, by two tools, and the two matched exactly. Every fixture was checked against the
       official fixtures feed for its gameweek and its home side after converting the page's time zone. The page again carried a
       spurious row, "Liverpool v Manchester City" under 17 October, which is not a gameweek 7 fixture; it is left out. Since 26 Sep
       Chelsea v Bournemouth moved most (1.78/4.07/3.91 to 1.70/4.05/4.26). */
    6: [["ARS", "LEE", 1.37, 4.88, 7.50], ["AVL", "BRE", 2.57, 3.55, 2.55], ["CHE", "BOU", 1.70, 4.05, 4.26], ["IPS", "FUL", 2.66, 3.45, 2.50], ["SUN", "BHA", 2.84, 3.44, 2.36],
        ["MUN", "TOT", 1.69, 4.05, 4.36], ["CRY", "NFO", 2.61, 3.24, 2.65], ["HUL", "EVE", 3.53, 3.35, 2.06], ["LIV", "MCI", 2.53, 3.60, 2.53], ["COV", "NEW", 3.20, 3.53, 2.11]],
    7: [["EVE", "CHE", 2.82, 3.65, 2.28], ["BRE", "LIV", 2.72, 3.70, 2.32], ["FUL", "HUL", 1.63, 4.00, 4.75], ["MCI", "IPS", 1.20, 6.33, 10.67], ["NEW", "AVL", 2.07, 3.70, 3.15],
        ["BOU", "SUN", 1.98, 3.53, 3.53], ["BHA", "CRY", 1.55, 4.33, 5.18], ["LEE", "MUN", 2.82, 3.60, 2.27], ["NFO", "ARS", 5.55, 4.00, 1.56], ["TOT", "COV", 1.48, 4.48, 5.88]],
  },

  /* Start-probability overrides by gameweek, where dated reporting is ahead of the official flag.
     Only players in one of the two squads, the plan or the claims pool are listed: an override on a
     player nobody can pick changes nothing. Each one says which way it moves the official number.
     Gameweek 5 is played; its three overrides are kept as the record of what the model believed, and
     carry the date of the block they came from. */
  start: {
    5: { "João Pedro|CHE": { p: 0.15, why: "ESPN Brasil: knee, about three and a half weeks. He did miss Brentford. Carried from the 22 Sep block." }, "Shaw|MUN": { p: 0.40, why: "Carrick: 'half a chance'. Carried from the 22 Sep block." }, "N.Jackson|AVL": { p: 0.55, why: "Hooked at half-time the week before. Carried from the 22 Sep block." } },
    6: {
      /* Re-read 2 Oct 2026 07:30–07:45Z. Each line says which way it moves the official flag and on what dated reporting. Premier
         Injuries is an aggregator (its percentages are its own reading of the news), so it never stands alone. */
      "João Pedro|CHE": { p: 0.40, why: "BELOW the 75% flag. Seeing a specialist in London during the break (Evening Standard, 2 Oct); a Brazilian report of knee swelling 'that could take up to four weeks' (Roundtable via Yahoo, 29 Sep, speculation); Premier Injuries lists him ruled out to 17 Oct (read 2 Oct). Alonso's pre-break target was Bournemouth on 10 Oct (premierleague.com, 28 Sep), so this is a doubt, not a write-off." },
      "Semenyo|MCI": { p: 0.45, why: "BELOW the 75% flag. Withdrew from Ghana with a swollen leg (Okraku, 24 Sep); not pictured back in training and 'a doubt for City's next fixture against Liverpool' (Man City News, 1 Oct, a fan site); Premier Injuries 50%, no return date (read 2 Oct). No club update." },
      "Brobbey|SUN": { p: 0.25, why: "BELOW the 75% flag. Hamstring for the Netherlands on 24 Sep; Sunderland still 'awaiting news' (Sunderland Echo, 27 Sep); Premier Injuries 25%, no return date (read 2 Oct). A former PSV doctor calls it 'very serious' (Football Insider, 2 Oct): an outside view, not his doctor's, and weighed as such." },
      "van Ewijk|COV": { p: 0.50, why: "BELOW the 75% flag, and lower than the 26 Sep block's 0.80. Nothing new since Lampard on 22 Sep ('we hope will see him back on the other side of the break', via Rotowire); Premier Injuries now reads 25% with a return of 12 Oct (read 2 Oct). Coventry play on Monday 12 Oct, after the deadline, so he cannot be seen in a team sheet first." },
      "Dunk|BHA": { p: 0.70, why: "Just below the 75% flag, and lower than the 26 Sep block's 0.88. A neck problem; 'pushing to be available' for Sunderland on 10 Oct (Sussex Express, 28 Sep, a report rather than a quote); Premier Injuries 50%, return 10 Oct (read 2 Oct). Draft roster." },
      "Havertz|ARS": { p: 0.20, why: "Not owned in either squad; a wildcard-pool candidate. Hamstring for Germany on 24 Sep; The Times (27 Sep, via ArsenalInsider) says 'at least four weeks', which the club has not confirmed; Arsenal have given no timeline (ReadArsenal, 2 Oct); Premier Injuries 25% (read 2 Oct)." },
      "Mykolenko|EVE": { p: 0.50, why: "BELOW the 75% flag the feed added on 2 Oct. Left the Ukraine camp injured on 1 Oct: the Ukrainian FA said he 'will not help the blue-and-yellows in the upcoming matches' (UNN, 1 Oct); coach Maldera: 'He isn't feeling good' (Sport Witness, 1 Oct). Premier Injuries 50%, return 11 Oct (read 2 Oct). Everton play Hull on Sunday 11 Oct." },
    },
  },
  notes: [
    "Re-read 2 Oct 2026. The September and October international windows are merged: no Premier League football between 20 September and Saturday 10 October. International matches are still to come on 3 to 6 October (England v Croatia on 3 Oct and v Czechia on 6 Oct with Saka and Hall; Brazil v India in Kolkata on 3 Oct with Gabriel; Côte d'Ivoire v Cameroon on 3 Oct with Mbeumo; Portugal v Norway on 4 Oct with Haaland), so new knocks are still possible. Sources: England fixtures page, Daily Cannon 29 Sep, Africa Soccer 1 Oct, ESPN UK, all read 2 Oct.",
    "No gameweek 6 press-conference schedule is published yet (Fantasy Football Scout, the Premier League site and Hayters checked 2 Oct). Saturday's clubs usually speak on Thursday 8 or Friday 9 Oct; Coventry and Newcastle, who play on Monday 12 Oct, may not speak before the deadline, which matters for Thomas and Hall. Set the claims and build the wildcard as late as the deadlines allow, and re-check after the pressers.",
    "Prices are not paused for the break: the official daily price page (premierleague.com, 1 Oct) reports rises at 00:00 BST each day. Barry rose to £5.7m on 28 Sep and Tarkowski to £6.2m on 1 Oct. The feed pulled 2 Oct 07:25Z shows no further move since the 1 Oct build.",
    "Fit on international duty, dated: Saka started for England on 29 Sep and came off on 71 minutes (England match centre; GiveMeSport, 30 Sep, thought he 'didn't look fully fit', an opinion); Hall played 90 minutes v Czechia (Fantasy Football Hub, 1 Oct); Haaland started Wales 2-1 Norway on 1 Oct; Gabriel started Brazil's 4-2 win over Australia on 29 Sep; Mbeumo played 90 minutes for Cameroon on 29 Sep; Stach played 6 minutes v Greece on 27 Sep and is not in Germany's squad for the rest of the window.",
    "Konsa (ARS, in the current fifteen and sold by the plan) missed England training with 'minor issues' and was an unused substitute on 29 Sep (Tuchel via Hayters, 28 Sep; Fantasy Football Scout, 30 Sep). Mainoo (MUN, held back from the Draft claims as flagged) withdrew from England but 'is not thought to be injured', likely load management (Evening Standard, 2 Oct, a report without a club statement).",
    "Pundits on captaincy, gameweek 6 (opinion, dated): The Scout backs Saka, who 'now has spot-kick duties' (premierleague.com, 1 Oct); OneFPL says the armband 'should not be automatically locked on Haaland' (26–27 Sep); Fantasy Football Scout calls Saka 'the more convincing attacking option' (30 Sep). RotoWire's projections (updated 1 Oct) put Bruno 6.56 and Palmer 5.94 above Saka 5.82 and Haaland 5.81. Haaland is about 74% owned and Saka about 14% (RotoWire), so a Saka armband is a large differential against the field.",
    "Pundits on the plan's picks (opinion, dated): Tarkowski, Hall, Groß, Barry and Haaland recur in published wildcard drafts (Fantasy Football Scout 26 Sep, Ingenuity Fantasy 28 Sep, Fantasy Football Fix 1 Oct); Branthwaite, Barry, Gonzalo and Leno are named as differentials (premierleague.com, 27 Sep). Against the plan: no published draft found runs three Everton players, and Everton's defence has conceded fewer than its 6.9 expected goals against suggests (Fantasy Football Scout, 29 Sep); Fantasy Football Scout calls Gabriel 'prohibitively pricy' at £8.0m (30 Sep); The Scout ranks Crystal Palace's and Leeds's next five fixtures among the worst (29 Sep), which touches Benitez and Stach.",
    "Chip risk, flagged by a pundit: Manchester City host PSG on Wednesday 14 Oct, Ipswich on Saturday 17 Oct (the plan's Triple Captain week for Haaland) and AEK on Tuesday 20 Oct; Fantasy Football Scout names gameweek 7 City's 'possible biggest rotation risk' (28 Sep), while guessing he is more likely rested against AEK. The plan's Bench Boost in gameweek 9 has Saka and Gabriel at Anfield.",
    "Afternoon re-read at 2 Oct 13:45Z: no availability news changed on any listed player. Ukraine's coach confirmed Mykolenko misses tonight's match (Fantasy Football Scout, 2 Oct 11:45Z: 'we cannot count on Mykolenko, he is not feeling very well'); Sunderland still 'awaiting news' on Brobbey (Sunderland Echo, 2 Oct 11:00Z); Hall is in contention to start for England on 3 Oct (Read Newcastle, 2 Oct). Groß is September's Player of the Month and Raya its Save of the Month (premierleague.com, 2 Oct): no availability bearing. OddsPortal, read again at 2 Oct 13:45Z, moved three gameweek 6 fixtures by 0.05 or more on a leg since the 2 Oct 07:25Z read in this block: Arsenal v Leeds 1.36/4.73/7.67, Chelsea v Bournemouth 1.71/4.05/4.19, Manchester United v Tottenham 1.69/4.08/4.27; the other seven are within 0.03 on every leg. The block keeps the 2 Oct 07:25Z prices: the moves shift no implied probability by more than about half a point, the plan is re-solved after the Thursday pressers in any case, and a re-solve on this drift would replace a proven plan with the same one.",
    "The Second Chance League (premierleague.com, 2 Oct): a global league that starts scoring from zero at the gameweek 6 deadline; every existing team is entered automatically; no cup. It changes nothing in either game's plan.",
    "There are two players called Hughes. He owns id 212, the Crystal Palace midfielder, who is fit and unflagged. The one carrying 'Groin injury - Unknown return date' is id 278, a Hull defender. Match on id, never on the name. Read from the feed pulled 26 Sep and unchanged on 2 Oct.",
  ],
  sources: [
    "Official Fantasy Premier League and FPL Draft feeds, pulled 2 Oct 07:25Z and again 2 Oct 13:26Z (nothing a decision rests on moved)",
    "Fantasy Football Scout, 2 Oct 11:45Z (international-break injury bulletin: Mykolenko); Sunderland Echo, 2 Oct 11:00Z (Brobbey); Read Newcastle, 2 Oct (Hall); premierleague.com, 2 Oct (monthly awards; Second Chance League); OddsPortal re-read at 2 Oct 13:45Z",
    "OddsPortal average match prices for gameweeks 6 and 7, read 2 Oct 07:25Z (live scrape; gameweek 6 read twice and matched)",
    "Premier Injuries injury table, read 2 Oct (an aggregator; each entry quotes its own dated report)",
    "Evening Standard, 2 Oct, on João Pedro seeing a specialist, on Havertz and on Mainoo's withdrawal",
    "Roundtable via Yahoo, 29 Sep, on João Pedro's knee (speculation)",
    "premierleague.com, 28 Sep, carrying Alonso's pre-break target for João Pedro",
    "Man City News, 1 Oct, on Semenyo (a fan site)",
    "Ghana FA president Kurt Okraku on Semenyo, quoted 24 Sep",
    "Sunderland Echo, 27 Sep, and Football Insider, 2 Oct, on Brobbey",
    "Rotowire, 22 Sep, carrying Lampard on van Ewijk",
    "Sussex Express, 28 Sep, on Dunk",
    "The Times via ArsenalInsider, 27 Sep, and ReadArsenal, 2 Oct, on Havertz",
    "UNN and Sport Witness, 1 Oct, on Mykolenko leaving the Ukraine camp",
    "Hayters via Yahoo, 28 Sep, and Fantasy Football Scout, 30 Sep, on Konsa",
    "England match centre, Sports Illustrated and GiveMeSport, 29–30 Sep; VAVEL, 29 Sep and 1 Oct; United in Focus, 29 Sep; Fantasy Football Hub, 1 Oct (international minutes)",
    "premierleague.com, 1 Oct: The Scout's gameweek 6 wildcard squad, and the daily price-change page",
    "premierleague.com, 27 and 29 Sep: differentials by position, and the fixture ranking",
    "OneFPL, 26–27 Sep; RotoWire (Adam Zdroik), updated 1 Oct; Fantasy Football Scout, 26, 28, 29 and 30 Sep; Ingenuity Fantasy, 28 Sep; Fantasy Football Fix, 1 Oct (pundit opinion)",
    "allaboutfpl and Fantasy Football Scout gameweek 5 clean-sheet odds, 17 Sep (calibration anchors only)",
  ],
};

module.exports = INTEL;

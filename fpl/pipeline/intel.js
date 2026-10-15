/* pipeline/intel.js — desk research the feeds cannot see. Dated, sourced, and only ever an override
   (v110 §5 A7). This is the one hand-typed input to the bake: bookmaker match prices by gameweek,
   the gameweek 5 market anchors kept for calibration, per-gameweek start-probability overrides where
   dated reporting is ahead of the official flag, notes and sources. Every entry carries a date;
   qa/bake.cjs refuses an undated one. Re-read for gameweek 7 on 15 Oct 2026 (odds for gameweeks 7 and 8, overrides, notes, sources) and in full on 2 Oct 2026; first dated 26 Sep 2026, ported from the v111 kit; the lines
   marked "Carried from the 22 Sep block" or ending in a reporting date were undated in the kit and
   carry the date the block's own sources give, nothing more.
   Consumed by pipeline/bake.js (default --intel path); a .json path there means "use that file's
   intel key" instead, which is how the parity test bakes the reference block with its own INTEL. */
"use strict";

const INTEL = {
  asOf: "2026-10-15T18:50:00Z",
  /* Gameweek 5 market numbers (allaboutfpl / Fantasy Football Scout clean-sheet odds and RotoWire prices, 17 Sep). Kept as calibration anchors now the week is played. */
  market5: { MCI: { xg: 2.36, cs: 0.48 }, NEW: { xg: 2.01, cs: 0.35 }, NFO: { xg: 1.88, cs: 0.38 }, LIV: { xg: 1.84 }, ARS: { xg: 1.80, cs: 0.34 }, EVE: { xg: 1.80, cs: 0.34 }, MUN: { xg: 1.80 }, CHE: { xg: 1.77 }, LEE: { xg: 1.77, cs: 0.33 }, TOT: { cs: 0.31 } },
  /* Average bookmaker match prices (home, draw, away), OddsPortal, read 26 September. Every fixture
     was checked against the official fixtures feed for its gameweek and its home side before it was
     entered here: OddsPortal groups by date, and it also carried a spurious Brentford v Liverpool row
     on 11 October that the feed places in gameweek 7 alone. Gameweek 7 is now fully priced, ten of ten,
     where the 21 September read had only three. */
  odds: {
    /* Average bookmaker match prices (home, draw, away), read 15 Oct 2026 about 18:47Z from Betexplorer's Premier League fixtures
       page (OddsPortal's sister site, the same match ids), rendered with the Nimble connector from a UK location: gameweek 7 is the
       average of 17 bookmakers, gameweek 8 of 12. OddsPortal's own league page, read the same minute, shows the best price, not
       the average (59 of 60 cells at or above these), so it is the cross-check and not the input. Every row was checked against
       the official fixtures feed for its gameweek, its home side and its kick-off (the page shows UTC+1); none was spurious.
       Gameweek 9 was not yet priced. Gameweek 6 is played and its prices are gone: they moved no projection after its deadline.
       Since the 2 Oct read, Everton v Chelsea moved most (2.82/3.65/2.28 to 3.18/3.67/2.15). */
    7: [["EVE", "CHE", 3.18, 3.67, 2.15], ["BRE", "LIV", 2.36, 3.62, 2.84], ["FUL", "HUL", 1.71, 3.92, 4.66], ["MCI", "IPS", 1.24, 6.67, 10.09], ["NEW", "AVL", 2.25, 3.67, 2.98],
        ["BOU", "SUN", 2.07, 3.53, 3.50], ["BHA", "CRY", 1.55, 4.47, 5.37], ["LEE", "MUN", 2.34, 3.57, 2.89], ["NFO", "ARS", 5.78, 3.86, 1.62], ["TOT", "COV", 1.48, 4.60, 6.28]],
    8: [["IPS", "NFO", 3.01, 3.47, 2.25], ["AVL", "MCI", 4.41, 4.08, 1.70], ["ARS", "EVE", 1.38, 4.64, 8.38], ["COV", "FUL", 2.90, 3.51, 2.31], ["CHE", "TOT", 1.81, 3.94, 3.89],
        ["CRY", "NEW", 2.63, 3.51, 2.50], ["HUL", "BRE", 4.52, 3.89, 1.71], ["LIV", "BHA", 2.02, 3.83, 3.25], ["MUN", "BOU", 1.80, 4.03, 3.84], ["SUN", "LEE", 2.78, 3.32, 2.49]],
  },

  /* Start-probability overrides by gameweek, where dated reporting is ahead of the official flag.
     Only players in one of the two squads, the plan or the claims pool are listed: an override on a
     player nobody can pick changes nothing. Each one says which way it moves the official number.
     Gameweek 5 is played; its three overrides are kept as the record of what the model believed, and
     carry the date of the block they came from. */
  start: {
    5: { "João Pedro|CHE": { p: 0.15, why: "ESPN Brasil: knee, about three and a half weeks. He did miss Brentford. Carried from the 22 Sep block." }, "Shaw|MUN": { p: 0.40, why: "Carrick: 'half a chance'. Carried from the 22 Sep block." }, "N.Jackson|AVL": { p: 0.55, why: "Hooked at half-time the week before. Carried from the 22 Sep block." } },
    6: {
      /* Re-read 9 Oct 2026 10:30–11:00Z, after Thursday's pressers and the first of Friday's (Fantasy Football Scout's
         dated live team-news pages, 8 and 9 Oct). Each line says which way it moves the official flag and on what reporting. */
      "João Pedro|CHE": { p: 0.90, why: "Up from 0.40. Alonso, Friday: 'now they have trained well and they are ready to go… for tomorrow they will be good' (Fantasy Football Scout, 9 Oct); the feed cleared his flag at 16:17Z." },
      "Semenyo|MCI": { p: 0.45, why: "Kept below the flag. Left Ghana with a 'swollen leg' (Mirror via Fantasy Football Scout, 8 Oct); Maresca took no question on him on 9 Oct (Fantasy Football Scout, 9 Oct)." },
      "Brobbey|SUN": { p: 0.01, why: "OUT for gameweek 6. Le Bris: hamstring, 'short-term… it won't be too long', on the same timeline as Diarra, about a week (Fantasy Football Scout and Metro, 8 Oct)." },
      "van Ewijk|COV": { p: 0.65, why: "Up from 0.50. Lampard: 'Milan is back training with us… We hope he'll be alright if he comes through the next few days' (Fantasy Football Scout, 8 Oct). Coventry play Monday 12 Oct." },
      "Dunk|BHA": { p: 0.90, why: "Up from 0.70. Hurzeler said he returns after the stiff neck (Fantasy Football Scout, 9 Oct, presser); the feed has him fit." },
      "Havertz|ARS": { p: 0.30, why: "Up from 0.05. Arteta, Friday: 'Ezri and Kai we will see tomorrow', a late fitness test after the hamstring on Germany duty (Fantasy Football Scout, 9 Oct)." },
      "Mykolenko|EVE": { p: 0.50, why: "Kept. Moyes, Friday: 'has got a chance for Sunday, the extra day might help. We'll see' (Fantasy Football Scout, 9 Oct)." },
      "Haaland|MCI": { p: 0.95, why: "Fit. Maresca: 'He's good… recovered, and is ready for Anfield' (Fantasy Football Scout, 9 Oct, presser). Came off for Norway on 4 Oct, which the club treats as fatigue." },
      "Konsa|ARS": { p: 0.50, why: "Down from 0.60. Late fitness test on the dead leg: 'Ezri and Kai we will see tomorrow' (Arteta via Fantasy Football Scout, 9 Oct)." },
      "Tzolis|ARS": { p: 0.01, why: "Reported out about three weeks with a hamstring after 18 minutes for Greece (Evening Standard via Fantasy Football Scout, 8 Oct); not confirmed by the club." },
      "Joelinton|NEW": { p: 0.10, why: "Jaissle: 'They have the potential to be in the squad but… not in the starting XI' (Fantasy Football Scout, 8 Oct)." },
    },
    7: {
      /* Read 15 Oct 2026 about 18:50Z, after Thursday's pressers (Liverpool, Newcastle, Hull, Coventry) and the team news given at
         Wednesday's European pressers (Brighton, Bournemouth, Sunderland, Palace), through the Parallel Search and Exa connectors.
         Only players in the current fifteen, the plan's buys or the claims pool are listed, and only where the dated reporting is
         ahead of the official flag in the feed pulled 15 Oct 18:41Z; where the feed already carries the doubt it is left to the feed. */
      "Shaw|MUN": { p: 0.50, why: "BELOW the 75% flag. Took a knock against Spurs and did not travel to Madrid; Carrick: 'Luke and Kobbie had issues in the game on Saturday, so we're kind of working through that' (Manchester Evening News, 12 Oct); listed doubtful (Yorkshire Evening Post, 15 Oct). Carrick speaks on Friday." },
      "Mainoo|MUN": { p: 0.50, why: "BELOW the 75% flag. The same knock and the same Carrick quote as Shaw (Manchester Evening News, 12 Oct); doubtful (Yorkshire Evening Post, 15 Oct)." },
      "Szoboszlai|LIV": { p: 0.50, why: "BELOW the 75% flag. Hamstring; Iraola: 'It's early for us to say, we have still tomorrow's training... I leave the chance open this time, yes' (liverpoolfc.com, 15 Oct)." },
      "Mykolenko|EVE": { p: 0.35, why: "BELOW the 75% flag. Missed Hull with a muscle injury and is not in the training footage Everton released on 15 Oct (everton.news, 15 Oct, the outlet's inference); Premier Injuries 50/50 (via GoodisonNews, 12 Oct, an aggregator). Moyes speaks on Friday." },
      "Brobbey|SUN": { p: 0.45, why: "BELOW the feed's 100%. Back from the hamstring but only on the bench in Sunderland's European tie on 15 Oct (Everything Sunderland AFC line-up, 15 Oct); Le Bris: 'they will be involved quickly, but we need to respect the process' (Fantasy Football Scout, 14 Oct)." },
      "Mendy|HUL": { p: 0.01, why: "OUT against the feed's 100%. Jakirovic: 'he will be out for two weeks' (Hull Live via Fantasy Football Scout, 15 Oct)." },
    },
  },
  notes: [
    "Read 15 Oct 2026 about 18:50Z for gameweek 7 (deadline Sat 17 Oct 10:00Z, 12:00 SAST), through the Parallel Search and Exa connectors. No injury reported against Raya, Gabriel, Saka, Konsa or Havertz (Arsenal; Saka was ill and benched against Lille, then scored and assisted: Arteta via Hayters, 13 Oct; the Evening Standard expects him to start, 15 Oct), Haaland (two goals against PSG; 'Man City are not believed to have any injury concerns', Evening Standard, 14 Oct), Palmer and João Pedro (played against Bournemouth, Evening Standard, 12 Oct), Tarkowski, Barry, Diop, Janelt, Groß, Hall, Tavernier, Silva, Thomas, van Ewijk, Leno, Affengruber, Gonzalo, Calvert-Lewin, Stach, Trafford, Tzolakis or Kinsky. Out or doubtful elsewhere: Isak, Gakpo and Szoboszlai doubts and Gravenberch suspended (Iraola, liverpoolfc.com, 15 Oct); Saliba, Hincapié and Tzolis out (Evening Standard, 15 Oct); Sesko doubtful and Dorgu out (Yorkshire Evening Post, 15 Oct); Mateta not yet available (Sage via Fantasy Football Scout, 14 Oct); Ruggeri out more than a month (Emery, Birmingham Live, 13 Oct); Milenković and Igor Jesus out (Nottingham Post, 13 Oct); Kulusevski and Porro doubtful (Evening Standard, 15 Oct).",
    "Still to come before the gameweek 7 deadline: Maresca on Friday 16 Oct at 12:30Z (mancity.com, 12 Oct); Moyes and Carrick on Friday, times not published (everton.news and United In Focus, read 15 Oct); the other clubs had not published times when read. Re-read the flags after them; Shaw, Mainoo, Szoboszlai, Mykolenko and Brobbey are the overrides they decide.",
    "Friday afternoon re-read, 9 Oct 2026 16:20Z (Fantasy Football Scout's Friday live page; feed pulled 16:17Z): nothing against Raya, Gabriel, Saka, Tarkowski, Barry, Diop, Janelt, Groß, Affengruber, Gonzalo, Leno or Haaland. O'Neil has 'a fully fit squad' (Ipswich); Arbeloa: 'everybody is fit and available' bar Cairney and Robinson (Fulham); Andrews ruled out only Milambo and Dasilva (Brentford). Palmer and João Pedro 'ready to go' (Alonso); Tzolis out 'a few weeks' (Arteta). Newcastle, Leeds and Bournemouth were not on that page; their Thursday pressers carried nothing against Hall, Stach or Tavernier.",
    "Re-read 9 Oct 2026 after Thursday's pressers (Bournemouth, Coventry, Leeds, Sunderland, Newcastle) and Friday's first three (Manchester City, Brighton, Fulham), from Fantasy Football Scout's live team-news pages of 8 and 9 Oct. Arsenal, Chelsea, Everton, Manchester United, Palace, Brentford, Liverpool, Villa and others spoke on Friday afternoon after this read: re-check Saka, Raya, Gabriel, Tarkowski, Barry, Mbeumo and Stach before the deadline. Nothing found against any of them. Scott (BOU) is out four to five weeks (Rose, 8 Oct); Daniel James (LEE) misses Arsenal (Farke, 8 Oct); Isak and Gakpo are injured (Iraola, 8 Oct).",
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
    "Official Fantasy Premier League and FPL Draft feeds, pulled 15 Oct 18:41Z",
    "Betexplorer Premier League fixtures (average of 17 bookmakers for gameweek 7, 12 for gameweek 8), read 15 Oct 18:47Z through the Nimble connector; OddsPortal's league page read the same minute as the cross-check",
    "liverpoolfc.com, 15 Oct (Iraola's press conference); BBC, 15 Oct (Jaissle, Lampard); Hull Live via Fantasy Football Scout, 15 Oct (Jakirovic)",
    "Manchester Evening News, 12 Oct (Carrick on Shaw and Mainoo); Yorkshire Evening Post, 15 Oct (Leeds v Manchester United team news)",
    "Evening Standard, 12, 14 and 15 Oct (Chelsea, Manchester City and Arsenal team news); Hayters live, 13 Oct (Arteta on Saka); football.london, 15 Oct (predicted line-up)",
    "everton.news, 15 Oct, and GoodisonNews, 12 Oct (Mykolenko); Everything Sunderland AFC, 15 Oct, and Fantasy Football Scout, 14 Oct (Brobbey, Le Bris)",
    "Fantasy Football Scout, 14 Oct (Hurzeler, Rose, Le Bris and Sage at their European press conferences); Birmingham Live, 13 Oct (Emery); Nottingham Post, 13 Oct",
    "Fantasy Football Scout, gameweek 6 early team news and Thursday's live injury updates (8 Oct) and Friday's live injury updates (9 Oct, read before the afternoon pressers)",
    "Official Fantasy Premier League and FPL Draft feeds, pulled 9 Oct 10:32Z",
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

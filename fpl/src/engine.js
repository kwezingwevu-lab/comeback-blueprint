/*
 * FPL Mission Control — pure engine (src/engine.js), v87.
 *
 * Rules of this file: top-level function declarations only; no React, no DOM, no
 * imports, no Date.now() inside pure functions (pass `now` in). Every function is
 * total — bad input yields a safe empty result — except parseJson and applyRefresh,
 * which throw by specification (D4). The API's two opaque expected-points fields are
 * never read (D1 bans them; verify.sh greps the assembled file for their names).
 *
 * Most decision functions take a `ctx` built once by buildCtx(live, state, now).
 * Prices are in tenths (integers). Ids are classic FPL element ids; draft players are
 * joined on `code`.
 *
 * EXPORTS (signature → return shape)
 *
 * Constants
 *   SCORING                         {1:{…},2:{…},3:{…},4:{…}} per element_type (B1)
 *   REFRESH_PAIRS                   {sonnet46|sonnet5|opus5: {model, tool}}
 *   DECAY, PRIOR_PPS, FORMATIONS    E1 decay weights, position priors, legal formations
 *
 * Context
 *   buildCtx(live, state, now)      → ctx {ok, els, elList, byCode, teams, events, nextEvent,
 *                                      currentEvent, deadline, hoursToDeadline, phase, fixtures,
 *                                      fixturesByEvent, finishedGws, TS, TS_GOALS, Lbar, gwStats,
 *                                      rivalOwn, capShare, flags, mults, xp, squadIds, squad, picks,
 *                                      ft, bank, value, budget, block, baseRates, draft, leagues, error}
 *   elementGwStats(live)            → {id: {games, starts, played, minutes, everBenched, starts_last3,
 *                                      startedLast, konsa, last3[], dcRate, bonusRate, ptsPerGame, …}}
 *   flagInfo(el)                    → {flagged, status, chance, news, factor}
 *   isFlagged(el)                   → boolean
 *   gamePhase(live, now)            → "pre" | "live" | "post"
 *   nowMs(now)                      → epoch ms (0 if unparseable)
 *
 * Scoring (B1)
 *   pointsFor(statsRow, elementType, scoring?) → integer points (FWD never CS; GKP never DefCon)
 *   draftScoring(live)              → SCORING-shaped table from live.draft.scoring (GKP goal 10)
 *   gwPoints(picks, gwData)         → Σ pts × multiplier from a finished live.gw block
 *
 * Constraints (B3)
 *   legal15(ids, els, budget=1000)  → {ok, reasons[], cost, counts, clubs}
 *   legalXI(ids, els)               → {ok, reasons[], formation}
 *   formationOf(ids, els)           → "D-M-F" string ("" if not 11)
 *   clubCounts(ids, els)            → {teamId: n}
 *
 * xP (E1)
 *   shrunkPps(el)                   → number (K=4, position priors)
 *   pStart(el, gwStats)             → probability [0,1]
 *   fxMult(fixture, teamId, TS)     → multiplier (1 when the team is not in the fixture, and 1
 *                                     when the argument is not a fixture object at all — ask
 *                                     fxMultInfo which of the two it was)
 *   fxMultInfo(fixture, teamId, TS) → {mult, resolved, reason}: resolved=false means the 1 is the
 *                                     unresolved default, not a computed multiplier (E-043)
 *   xp1(el, ctx) / xp5(el, ctx)     → number (cached in ctx.xp)
 *   xp1With(el, ctx, tsKey) / xp5With(el, ctx, tsKey)  → number under "TS" or "TS_GOALS"
 *   xp5FromMults(el, pstart, mults) → number (worked example: 5.23 × 0.875 × 3.557 = 16.3)
 *   teamMults(teamId, ctx, tsKey)   → [m0..m4] for the next five events (0 on a blank)
 *
 * Strength (E2)
 *   teamStrength(live)              → {TS:{teamId:{att,def,g,xgf,xga,Lbar}}, TS_GOALS:{…}, Lbar, LbarGoals}
 *   tsXg(t,o,home,TS) / tsMult(t,o,home,TS) / tsPcs(t,o,home,TS) → numbers (tsPcs ∈ (0,1))
 *   overUnderTags(live)             → [{teamId, short_name, g, gf, xgf, ga, xga, tagFor, tagAgainst}]
 *   runAvg(teamId, fixtures, n)     → FDR 1–5 (comparison panel only)
 *
 * Rivals (E3)
 *   rivalOwn(live)                  → {leagueId:{elementId: share}}
 *   capShare(live)                  → {leagueId:{elementId: share}}
 *   classify(el, ctx)               → "EDGE" | "SHARED" | "DEAD" | "NEUTRAL"
 *   convergenceRisk(elementId, ctx) → {risk, max, league}
 *   rivalOwnMax(elementId, ctx)     → {max, league}
 *
 * Decisions (C1–C5)
 *   captainPick(xiIds, ctx)         → {capId, viceId, table[], reasons[]}
 *   bestXI(ids, ctx)                → {ids, capId, viceId, formation, score, bench[]}
 *   benchOrder(squadIds, xiIds, ctx)→ ordered outfield bench ids (GKP excluded)
 *   sellCandidates(squad, ctx)      → [{id, web_name, reason, forced, konsa}]
 *   transferProtocol(state, ctx)    → {moves[], order[], captain, vice, value, margin, confidence,
 *                                      hits, k, bankAfter, forced[], alternatives[], reasons[], blocked}
 *                                      order is sells, then buys, then the captain and vice steps,
 *                                      on every path that reaches an eleven — hold included (E-037)
 *   wildcardSolver(ctx, opts)       → {ok, ids, xi, cost, bank, score, model, alt, disagreement,
 *                                      relaxed, relaxations[], reasons[], steps, spend}
 *   wcSetup(ctx, opts, tsKey)       → {ok, budget, pool, cands, cheap, minCost, locks, lockSet,
 *                                      current, relaxed, relaxations[], reasons[]} — the pool,
 *                                      windows and budget the solver and its audit both use
 *   wcFeasible(ids, ctx, W)         → boolean (B3 + ≤3/club + ≤2 incoming/club + budget lookahead)
 *   wcCost(ids, ctx)                → tenths
 *   wcLocalOptimum(ids, ctx, opts)  → {ok, optimal, checked, dearerTried, bestGain, bank,
 *                                      improvements[], reason} — no legal single swap over the
 *                                      whole pool improves the fifteen (the acceptance criterion)
 *   wildcardOptions(ctx, opts)      → {ok, pure, locked, written, locks[], deltas, budget, note}
 *                                      the three priced answers to the C1.6 conflict; opts.written
 *                                      supplies the manager’s fifteen when no WEEKLY block is in
 *                                      scope. Changes neither the solver default nor rule C1.6.
 *   wildcardTiming(ctx)             → {gw, weeklyGap, swapsNeeded, horizons[], grid[], breakeven,
 *                                      saturated:{saturates, weeks, gw, note}, note} — both
 *                                      horizons include their end gameweek (E-042)
 *   chipWindows(live)               → {doubles[], blanks[], recommendation, nextEvent}
 *   chipRegret(chip, ctx, opts)     → {chip, useNow, bestLater, laterEvent, regretUse, regretHold, verdict, note}
 *   draftWaivers(state, ctx)        → [{priority, out, in, outName, inName, evOut, evIn, gain, why,
 *                                      forced, pool:"api"|"assumed", roster:"api"|"saved"|"none"}]
 *                                      "api" means the claim came from the league's real free
 *                                      agents; "assumed" is the old ordering over everyone
 *   watchlistAudit(codes, ctx)      → {keep[], drop[], unknown[], detail[]}
 *   draftXIBase(codes, ctx, valueOf?) → the eleven under any per-player value function
 *   draftXI(codes, ctx, opts?)      → {codes, ids, benchIds, formation, score, gk, def[], mid[],
 *                                      fwd[], bench[], lean:"up"|"down"|"none", tilted,
 *                                      tiltChangedXI, h2h, note}
 *                                      C5 variance rule: ceiling when behind, floor when ahead
 *
 * Draft league (C5 · F2; empty until a league id is in the snapshot)
 *   draftLeagueInput(text)          → {ok, kind:"league"|"entry"|"unknown", id, note}
 *   draftOwnership(ctx)             → {ok, byCode, owners, ownedCount, unownedCount, poolCount, note}
 *   draftPool(ctx, opts?)           → [{code, id, web_name, element_type, starts_last3, ev,
 *                                      poolStatus, status, eligible}] — free agents only
 *                                      (owner null and element-status "a"), ranked by EV.
 *                                      poolStatus is claimability, status is fitness: the two
 *                                      are different fields and a free agent can be injured
 *   draftRosterOf(leagueEntryId,ctx)→ [codes]
 *   draftRivalRosters(ctx)          → [{leagueEntryId, entryId, name, manager, codes[], ids[]}]
 *   waiverOrder(ctx)                → {ok, order[], size, mine:{position, of}, note}
 *   h2hOpponent(ctx, gw)            → {ok, gw, opponent, mine, myPoints, oppPoints, finished, note}
 *   draftRoster(state, ctx)         → {codes, source:"api"|"saved"|"none", complete, note}
 *   playerSpread(el, ctx, iters, seed) → {mean, sd, iters}
 *   distStats(list)                 → {mean, sd, q10, q50, q90, n}
 *   mcDraftXI(ids, bench, ctx, iters, seed) → {mean, sd, q10, q50, q90, iters, ok} (no captain)
 *   mcH2H(myIds, myBench, oppIds, oppBench, ctx, iters, seed) → {ok, mine, theirs, margin}
 *                                      both elevens in one loop over shared fixture draws
 *   h2hProjection(ctx, opts?)       → {ok, gw, opponent, mine, theirs, margin, marginDist, lean, note}
 *
 * Squad / state
 *   sanitiseState(raw)              → state (§6 shape; cap 15, dedupe on id; never throws)
 *   detectSquadChange(stateSquadIds, picks) → {changed, added[], removed[], block}
 *   ftAvailable(history, currentEvent, chips?) → integer 1..5. Accepts the history object or its
 *                                      rows array and gives the SAME answer either way: chips come
 *                                      from the object, from the third argument, or are inferred
 *                                      from a gameweek that used more free transfers than the cap
 *   sellPrice(now, purchase)        → tenths (purchase + floor(rise/2); falls follow now)
 *   bankAfter(state, moves, els)    → tenths (raw)
 *
 * Monte Carlo (E4)
 *   mulberry32(seed)                → rng() in [0,1)
 *   simFixture(fixture, ctx, rng)   → {h, a} shared goals draw
 *   simPlayer(el, ctx, rng, draw?)  → points (may be negative)
 *   mcSquad(ids, capId, ctx, iters, seed, viceId?) → {mean, sd, q10, q50, q90, iters}
 *                                      iters is floored at MC_MIN_ITERS (100): one draw is not a
 *                                      distribution and is never reported as one (E-046)
 *   mcLeague(ctx, leagueId, opts)   → {leagueId, direction, rankBand, currentRank, medianRank, pWin|null, …}
 *
 * Calibration and fitting (F4)
 *   logistic(z)                     → probability in [0,1]; NaN answers 0.5, the infinities saturate
 *   solveLinear(A, b)               → solution vector, or null on a singular or non-finite system
 *   fitLogistic(X, y, opts?)        → {ok, beta[], n, k, iters, converged, ridge, logLik, baseRate, note}
 *                                     ridge-penalised IRLS; the design matrix carries its own intercept
 *   brier(predictions, outcomes)    → {brier, n, baseRate, baseBrier, skill, ok} — brier ∈ [0,1]
 *   reliability(pred, out, bins?)   → {bins:[{lo,hi,n,meanPred,meanOutcome,gap}], n, baseRate, maxGap, ok}
 *   promotionGate(opts)             → {promotable, transitions, wins, holdout, need, needHoldout,
 *                                     transitionsOk, winsOk, holdoutOk, reasons[], note}
 *                                     THE gate (CLAUDE.md J): three scored transitions, three of them
 *                                     won, and a two-gameweek trailing hold-out. The model tournament
 *                                     and the minutes walk-forward both go through this one function
 *
 * Minutes model (F4) — a challenger; it drives nothing until the gate opens
 *   minutesPanel(live)              → {gws, deadlines, teamGames, rows, els, teamOf, ok}
 *   minutesFeatureVector(hist, gw, deadlines) → [1, starts_last3, minutes_trend3, minutes_rate,
 *                                     days_since_last_start] — every term bounded
 *   minutesRowsFor(live, gw, panel?)→ {X, y, ids, seenFlag, n, seen, baseRate, note}: features from
 *                                     gameweeks strictly before gw, outcome "did he start in gw"
 *   minutesFit(live, uptoGw, opts?) → {ok, beta[], rows, gws[], converged, iters, terms[], note}
 *   ctxMinutesFit(ctx, opts?)       → the same fit, cached on the context
 *   minutesModel(el, ctx, opts?)    → {p, pModel, pIncumbent, flagFactor, fitted, driving:false,
 *                                     driver:"pStart", features, terms[], fit, note}
 *   truncateLive(live, uptoGw)      → the snapshot as it stood at the end of uptoGw
 *   minutesWalkForward(live, opts?) → {folds[], comparable, wins, holdout, incumbent, challengerScore,
 *                                     gate, note} — fit on ≤ k, score "started in k+1" on the held-out
 *                                     gameweek for BOTH the Laplace incumbent and the challenger
 *
 * Player xG (F5) — the ninth tournament challenger; E6 bars it from driving anything
 *   playerXg(el, ctx, opts?)        → {xp, xpPerFixture, p, lambda, lambdaAssist, mult, att, def,
 *                                     xg90, xa90, fixtures, components, opponents[], note}
 *   playerXgPredict(acc, prior, type, SCORING_row, fixtures, TSprev) → the same shape from the
 *                                     walk-forward's own accumulators (no look-ahead)
 *   strengthFromCounts(counts)      → {TS, Lbar}: the E2 xG shrinkage on any set of team counts
 *
 * Chips on the real calendar (F8)
 *   eventMult(teamId, ctx, event)   → total fixture multiplier in one event (0 blank, 2 fixtures on a double)
 *   xpEvent(el, ctx, event)         → E1 xP for one named event
 *   bestElevenForEvent(ctx, ev, ids?) → {ids, score, formation, ok, pool, note} — no budget and no
 *                                     club cap: an upper bound, and the note says so (E-068)
 *   chipValue(chip, event, ctx, opts?) → {chip, event, value, basis, detail, ok}
 *   chipSolver(ctx, opts?)          → {ok, doubles[], blanks[], confirmed, used[], candidates[], plan[],
 *                                     total, sets[], windowNote, note, reasons[]} — the two chip sets
 *                                     solved jointly under their expiries, one chip per gameweek
 *
 * The winning objective (A1, v89) — both objectives, priced, neither promoted
 *   winnableLeagues(ctx, opts?)     → [{id, name, size, rank, standings}] (size <= WINNABLE_MAX_SIZE)
 *   leagueField(ctx, leagueId)      → {ok, rows:[{entry,total,rank,me,xi,bench,cap}], meIndex,
 *                                     missingPicks, simulated, myTotal, note}
 *   candidateSquads(ctx, cands?)    → [{key,label,ids,xi,bench,cap,vice}] (no argument = his own fifteen)
 *   winProbabilityCore(ctx, c, o?)  → the shared loop: every candidate on ONE set of draws
 *   winProbability(ctx, opts?)      → {ok, leagues:[{pFirst, pFirstShown, pTop3, expRank, medianRank,
 *                                     rankBand, currentRank, direction, headline}], pooled, candidate, note}
 *                                     pFirstShown is null below MC_MIN_GWS_FOR_PWIN gameweeks (E-020):
 *                                     the probability is computed because a comparison needs it, and
 *                                     barred from being a headline
 *   objectiveCompare(ctx, c, o?)    → {ok, candidates[], byEv, byWin, agree, disagree, pairs[], verdict}
 *                                     a pair where EV falls and P(first) rises is named in those words
 *
 * Autosubs, the bench plan and the leak back-test (F3, corrected in v89)
 *   autosubResolve(xi, bench, playedOf, ctx) → {starters, subsIn, subsOut, ok} — THE autosub rules
 *   permutations(list)              → every ordering (capped at six elements)
 *   benchPlan(squadIds, xiIds, ctx) → {ok, order, rows:[{pEnter, eGiven, value, replaces}],
 *                                     expectedGain, bestGain, worstGain, orderValue, truncatedMass}
 *                                     P(comes on) exact over the blank patterns, not simulated
 *   picksOf(live, gw)               → {ok, xi, bench, ids, capId, viceId, chip} as submitted
 *   gwSims(live, gw, ids)           → {id:{pts,mins}} for a finished gameweek, entryPoints' shape
 *   bestEntryOverElevens(ids, capId, viceId, sims, ctx, mustCaptain) → the exact best total
 *   leakBacktest(live, opts?)       → where the points actually leaked: bench ordering, XI selection
 *                                     and captaincy, per gameweek, in points, with the engine's own
 *                                     ex-ante answer beside each. Corrects the points_on_bench
 *                                     misreading the roadmap was built on (ERRORS.md E-091)
 *   truncateElements(live, uptoGw)  → the snapshot with every CUMULATIVE element field rebuilt from
 *                                     the surviving gameweek rows. truncateLive alone leaves
 *                                     total_points/starts at fetch time, which shrunkPps reads
 *
 * Hierarchical partial pooling (v89, the tenth tournament challenger; it drives nothing)
 *   hierRowsFromAcc(acc, types)     → [{id, type, n, mean, variance}]
 *   hierGroups(rows)                → {1..4, pooled}: {mu, sigma2, tau2, players, games, fitted}
 *                                     empirical Bayes; tau2 by DerSimonian-Laird moments
 *   hierPosterior(row, group)       → {postMean, postVar, postSd, weight, flatWeight, flatMean, shrinkGap}
 *   hierPool(live, opts?)           → the panel: per-position hyperparameters, per-player posteriors,
 *                                     the posterior-variance range, the thinnest and thickest rows
 *
 * Dixon-Coles, properly (E2, v89) — the tau correction and exponential time decay
 *   dcTau(x, y, lamH, lamA, rho)    → the low-score correction on (0,0) (0,1) (1,0) (1,1)
 *   dcRhoRange(lamH, lamA)          → {lo, hi}: where every tau cell stays non-negative
 *   poissonPmf(k, lam)              → probability in [0,1]
 *   dcCleanSheetProb(lamH, lamA, rho, side) → P(the named side concedes nothing), tau applied
 *   dcMatches(live, opts?)          → the matches a cut may see, with their decay weights
 *   dixonColes(live, opts?)         → {ok, basis:"goals"|"xg", xi, mu, gamma, att, def, rho, rhoRange,
 *                                     matches, weightSum, iters, converged, loglik, note}
 *   dcLambdas(t, o, home, M) / dcPcs(t, o, home, M) → the two rates, and the clean-sheet probability
 *   cleanSheetCalibration(live, o?) → the incumbent tsPcs against both Dixon-Coles fits on Brier and
 *                                     a reliability curve, walk-forward. Evidence, not a promotion
 *
 * Probabilistic scoring (E5, v89) — a proper score over the whole distribution
 *   logGamma(x) / nbDispersion(mean, variance, shift) → Lanczos log-gamma, moment-matched dispersion
 *   pointsPmf(mean, dispersion, o?) → {ok, min, max, pmf[], cdf[], r, mass}: shifted negative binomial
 *   crpsDiscrete(dist, y)           → CRPS, non-negative
 *   logScoreDiscrete(dist, y)       → -log p(observed), floored at LOG_SCORE_FLOOR
 *
 * Tournament (E5)
 *   tournament(live)                → {models:[{key,name,spearman,mae,maeRaw,maeScale,
 *                                      maeCalibrated,transitions,wins,holdout,gate,promotable}],
 *                                      leader, decidable, promotable, transitions,
 *                                      maeUnits:"points", maeNote} — MAE is rescaled into points
 *                                      before it is compared across models (E-047).
 *                                      decidable = enough transitions exist for the gate to be
 *                                      DECIDED (transitions >= TOURNAMENT_PROMOTE_AT); it says
 *                                      nothing about any model passing. promotable = at least one
 *                                      model's own gate is open, which is what the word reads as
 *                                      (E-086). Per model, `promotable` is that model's gate.
 *                                      v89 adds crps, logScore and their per-transition arrays, and
 *                                      the SAME gate decided on CRPS as gateCrps / promotableCrps /
 *                                      transitionWinnersCrps. `authoritativeMetric` is "spearman":
 *                                      the CRPS gate is published beside the verdict, never instead
 *                                      of it, because moving the metric a gate runs on rewrites
 *                                      every past verdict at once (A2 law 5). TEN models from v89:
 *                                      the eight of E5, player_xg (F5) and hier_pool.
 *   calibrateToPoints(pred, actual) → {scale, calibrated, pred[]}
 *   spearman(a, b) / mae(a, b)      → numbers
 *
 * Refresh (D4)
 *   parseJson(text)                 → object (throws with the real message)
 *   stripFences(text)               → string with an opening and a closing fence line removed and
 *                                     nothing touched in between (E-044)
 *   pickText(contentBlocks)         → string (only type==="text", any order)
 *   blockTypes(contentBlocks)       → string listing block types seen
 *   refreshRequest(cfg)             → {model, max_tokens:4000, tools:[{type,name:"web_search"}], messages}
 *   applyRefresh(state, parsed)     → new state (throws on invalid input; never mutates)
 */

var ENGINE_VERSION = "v89";

var SCORING = {
  1: { play_short: 1, play_long: 2, goal: 6, assist: 3, cs: 4, gc_per2: -1, saves_per3: 1, pen_save: 5, pen_miss: -2, yc: -1, rc: -3, og: -2, dc: 0, dc_threshold: null, bonus: 1 },
  2: { play_short: 1, play_long: 2, goal: 6, assist: 3, cs: 4, gc_per2: -1, saves_per3: 0, pen_save: 0, pen_miss: -2, yc: -1, rc: -3, og: -2, dc: 2, dc_threshold: 10, bonus: 1 },
  3: { play_short: 1, play_long: 2, goal: 5, assist: 3, cs: 1, gc_per2: 0, saves_per3: 0, pen_save: 0, pen_miss: -2, yc: -1, rc: -3, og: -2, dc: 2, dc_threshold: 12, bonus: 1 },
  4: { play_short: 1, play_long: 2, goal: 4, assist: 3, cs: 0, gc_per2: 0, saves_per3: 0, pen_save: 0, pen_miss: -2, yc: -1, rc: -3, og: -2, dc: 2, dc_threshold: 12, bonus: 1 }
};
var POS_NAME = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
var SQUAD_SHAPE = { 1: 2, 2: 5, 3: 5, 4: 3 };
var FORMATIONS = [[3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 2, 3], [5, 3, 2], [5, 4, 1]];
var PRIOR_PPS = { 1: 3.2, 2: 3.4, 3: 3.9, 4: 3.8 };
var BINOMIAL_MAX_N = 5000;
var SHRINK_K = 4;
var TS_K = 6;
var HOME_ADV = 1.10;
var AWAY_ADV = 0.90;
var DECAY = [1.00, 0.82, 0.68, 0.56, 0.46];
var BENCH_FACTOR = 0.85;
var LBAR_PRIOR = 1.4;
var BUDGET_TENTHS = 1000;
var MAX_PER_CLUB = 3;
var MAX_INCOMING_PER_CLUB = 2;
var HIT_COST = 4;
/* The exhaustive part of the transfer search stops at three swaps: C(15,k) out-sets times the
   candidates per slot grows past what a phone can run at four. Free transfers bank to five, so the
   search does not stop there — MAX_GREEDY_SWAPS extends the best three-swap plan one swap at a
   time. See transferProtocol and ERRORS.md E-090. */
var MAX_SWAPS = 3;
var MAX_GREEDY_SWAPS = 5;
var SELL_GAIN_MIN = 4;
var MARGIN_HIGH = 2.0;
var MARGIN_MED = 0.8;
var CONVERGENCE = 0.60;
var EDGE_MAX = 0.25;
var SHARED_MIN = 0.70;
var WC_MIN_STARTS3 = 3;
var WC_MIN_PSTART = 0.75;
var WC_BENCH_WEIGHT = 0.15;
var WC_TRIGGER = 20;
var MC_MIN_GWS_FOR_PWIN = 8;
var MC_MIN_ITERS = 100;
var MC_DRAFT_ITERS = 400;
var MC_SPREAD_ITERS = 200;
var H2H_LEAN_TOL = 0.5;
var TOURNAMENT_PROMOTE_AT = 3;
var PROMOTION_HOLDOUT_WEEKS = 2;
var MINUTES_FEATURES = ["intercept", "starts_last3", "minutes_trend3", "minutes_rate", "days_since_last_start"];
var MINUTES_MAX_DAYS = 35;
var MINUTES_CHALLENGER = "The minutes logistic";
var MINUTES_INCUMBENT = "the Laplace rate";
var CHIP_NAMES = ["WC", "BB", "TC", "FH"];
var CHIP_SETS = [{ set: 1, from: 1, to: 19 }, { set: 2, from: 20, to: 38 }];
var CHIP_ALIAS = { wildcard: "WC", bboost: "BB", "3xc": "TC", freehit: "FH", wc: "WC", bb: "BB", tc: "TC", fh: "FH" };
var CHIP_PRICE_WINDOWS = 4;
var CHIP_MAX_WINDOWS = 2;
var CHIP_FH_POOL = 60;
var CHIP_SEARCH_NODES = 200000;
var FT_CAP = 5;
var REFRESH_MAX_TOKENS = 4000;
var REFRESH_PAIRS = {
  sonnet46: { model: "claude-sonnet-4-6", tool: "web_search_20250305" },
  sonnet5: { model: "claude-sonnet-5", tool: "web_search_20260209" },
  opus5: { model: "claude-opus-5", tool: "web_search_20260209" }
};
// --- the winning objective (A1, v89) ---------------------------------------
var WINNABLE_MAX_SIZE = 40;              // A1: a league this size or smaller is a league he can win
var WINPROB_ITERS = 400;
var WINPROB_TOP_N = 3;                   // the "top three" band the panel reports beside P(first)
// --- autosubs and the bench plan (F3, v89) ---------------------------------
var AUTOSUB_MAX_BLANKS = 4;              // four substitutes is the most that can ever come on
// --- hierarchical partial pooling (v89 challenger) -------------------------
var HIER_MIN_PLAYERS = 4;                // below this a group cannot estimate a between-player variance
var HIER_MIN_SIGMA2 = 0.25;              // floor on the pooled within-player variance, points squared
var HIER_MIN_TAU2 = 1e-3;                // floor on the between-player variance
// --- Dixon-Coles, properly (E2, v89) --------------------------------------
var DC_DECAY_PER_DAY = 0.0065;           // Dixon & Coles (1997): half-life about 107 days
var DC_MAX_ITERS = 200;
var DC_TOL = 1e-9;
var DC_RHO_GRID = 81;
// --- probabilistic scoring (E5, v89) --------------------------------------
var PTS_DIST_MIN = -6;                   // a red card and an own goal is the realistic floor
var PTS_DIST_MAX = 34;
var NB_MIN_R = 0.05;
var NB_MAX_R = 1e6;                      // the Poisson limit of the negative binomial
var LOG_SCORE_FLOOR = 1e-9;
var PMF_CACHE_STEP = 20;                 // predictive means are cached at a twentieth of a point
var TOURNAMENT_MODELS = [
  { key: "season_mean", name: "Season mean" },
  { key: "last_gw", name: "Last GW" },
  { key: "per90", name: "Per 90" },
  { key: "shrunk_per90", name: "Shrunk per 90" },
  { key: "ict_rate", name: "ICT rate" },
  { key: "bps_rate", name: "BPS rate" },
  { key: "blend", name: "Blend" },
  { key: "component_xp", name: "Component xP" },
  { key: "player_xg", name: "Player xG" },
  { key: "hier_pool", name: "Hierarchical pool" }
];

// ---------------------------------------------------------------- helpers

function num(x, d) {
  var v = typeof x === "number" ? x : (typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
  return isFinite(v) ? v : (d === undefined ? 0 : d);
}
function intOf(x, d) { var v = num(x, NaN); return isFinite(v) ? Math.trunc(v) : (d === undefined ? 0 : d); }
// A clamp that can return NaN is not a clamp: non-finite bounds fall back to 0 and the pair is
// ordered, so the answer is always inside a real range.
function clamp(v, lo, hi) {
  lo = num(lo, 0); hi = num(hi, 0);
  if (hi < lo) { var t = lo; lo = hi; hi = t; }
  v = num(v, lo);
  return v < lo ? lo : (v > hi ? hi : v);
}
function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
// A name for a value that is safe to put in a message: never the literal "undefined", which
// a returned string is not allowed to contain (it reads as a bug even when it is the truth).
function kindOf(x) { return x === null ? "null" : (x === undefined ? "missing" : (Array.isArray(x) ? "array" : typeof x)); }
function arr(x) { return Array.isArray(x) ? x : []; }
function errMsg(e) {
  if (e && e.message) return String(e.message);
  if (typeof e === "string" && e) return e;
  if (e === null || e === undefined) return "unknown error";
  if (typeof e === "number") return isFinite(e) ? "error " + e : "unknown error";
  var s;
  try { s = String(e); } catch (x) { s = ""; }
  if (s && s.indexOf("[object ") < 0) return s;
  try { var j = JSON.stringify(e); if (j && j !== "{}" && j.indexOf("[object ") < 0) return j.slice(0, 240); } catch (x2) { /* circular */ }
  return "unknown error";
}
function okCtx(ctx) { return isObj(ctx) && ctx.ok === true && isObj(ctx.els); }
function idOf(x) { if (isObj(x)) { return num(x.id !== undefined ? x.id : x.element, NaN); } return num(x, NaN); }
function idList(ids) { var out = []; arr(ids).forEach(function (x) { var v = idOf(x); if (isFinite(v)) out.push(v); }); return out; }
function elMap(els) {
  if (Array.isArray(els)) { var m = {}; els.forEach(function (e) { if (isObj(e) && e.id !== undefined) m[e.id] = e; }); return m; }
  return isObj(els) ? els : {};
}
function elType(el) { var t = intOf(el && el.element_type, 0); return t >= 1 && t <= 4 ? t : 0; }
function uniq(list) { var seen = {}, out = []; arr(list).forEach(function (v) { if (!seen[v]) { seen[v] = true; out.push(v); } }); return out; }
function sum(list, f) { var s = 0; var g = typeof f === "function" ? f : null; arr(list).forEach(function (v, i) { s += num(g ? g(v, i) : v, 0); }); return s; }
function sortNum(a, b) { return a - b; }
function quantile(sorted, q) {
  // E-055 (recurrence of E-031): the two endpoints used to be read straight off the array, so a
  // list of anything but numbers came back as a STRING — "[object Object]NaN" — from the helper
  // that produces mcSquad's q10/q50/q90, which are rendered.
  sorted = arr(sorted); q = clamp(q, 0, 1);
  if (!sorted.length) return 0;
  var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  var a = num(sorted[lo], 0), b = num(sorted[hi], 0);
  return a + (b - a) * (pos - lo);
}
function nowMs(now) {
  if (now === undefined || now === null) return 0;
  if (typeof now === "number") return isFinite(now) ? now : 0;
  if (now instanceof Date) { var t = now.getTime(); return isFinite(t) ? t : 0; }
  if (typeof now === "string") { var p = Date.parse(now); return isFinite(p) ? p : 0; }
  return 0;
}
function combos(list, k) {
  list = arr(list); k = intOf(k, -1);
  var out = [];
  function rec(start, cur) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (var i = start; i < list.length; i++) { cur.push(list[i]); rec(i + 1, cur); cur.pop(); }
  }
  if (k >= 0 && k <= list.length) rec(0, []);
  return out;
}

// ---------------------------------------------------------------- scoring (B1)

function rowStat(row, idx, key, alt) {
  if (Array.isArray(row)) return num(row[idx], 0);
  if (!isObj(row)) return 0;
  if (row[key] !== undefined) return num(row[key], 0);
  if (alt && row[alt] !== undefined) return num(row[alt], 0);
  return 0;
}
function pointsFor(statsRow, elementType, scoring) {
  var t = intOf(elementType, 0);
  var S = (isObj(scoring) && isObj(scoring[t])) ? scoring[t] : SCORING[t];
  if (!S) return 0;
  var mins = rowStat(statsRow, 0, "minutes", "min");
  if (mins <= 0) return 0;
  var goals = rowStat(statsRow, 9, "goals", "goals_scored");
  var assists = rowStat(statsRow, 10, "assists");
  var cs = rowStat(statsRow, 11, "cs", "clean_sheets");
  var gc = rowStat(statsRow, 12, "gc", "goals_conceded");
  var bonus = rowStat(statsRow, 13, "bonus");
  var yc = rowStat(statsRow, 14, "yc", "yellow_cards");
  var rc = rowStat(statsRow, 15, "rc", "red_cards");
  var og = rowStat(statsRow, 16, "og", "own_goals");
  var penMiss = rowStat(statsRow, 17, "pen_miss", "penalties_missed");
  var penSave = rowStat(statsRow, 18, "pen_save", "penalties_saved");
  var saves = rowStat(statsRow, 19, "saves");
  var dc = rowStat(statsRow, 6, "dc", "defensive_contribution");
  var p = mins >= 60 ? S.play_long : S.play_short;
  p += goals * S.goal + assists * S.assist;
  if (mins >= 60 && cs > 0 && S.cs) p += S.cs;                      // FWD: S.cs = 0, never a clean sheet
  if (S.gc_per2) p += Math.floor(gc / 2) * S.gc_per2;                // GKP/DEF only
  if (S.saves_per3) p += Math.floor(saves / 3) * S.saves_per3;       // GKP only
  if (t === 1) p += penSave * S.pen_save;
  p += penMiss * S.pen_miss + yc * S.yc + rc * S.rc + og * S.og;
  if (S.dc && S.dc_threshold && dc >= S.dc_threshold) p += S.dc;     // GKP: S.dc = 0, never DefCon
  p += bonus * (S.bonus === undefined ? 1 : S.bonus);
  return Math.round(p);
}
function draftScoring(live) {
  var out = {};
  var sc = live && live.draft && isObj(live.draft.scoring) ? live.draft.scoring : null;
  [1, 2, 3, 4].forEach(function (t) {
    var base = SCORING[t], pos = POS_NAME[t], o = {};
    Object.keys(base).forEach(function (k) { o[k] = base[k]; });
    if (sc) {
      o.play_short = num(sc.short_play, base.play_short);
      o.play_long = num(sc.long_play, base.play_long);
      o.goal = num(sc["goals_scored_" + pos], base.goal);
      o.assist = num(sc.assists, base.assist);
      o.cs = num(sc["clean_sheets_" + pos], base.cs);
      o.gc_per2 = num(sc["goals_conceded_" + pos], base.gc_per2);
      o.saves_per3 = t === 1 ? num(sc.saves, base.saves_per3) : 0;
      o.pen_save = t === 1 ? num(sc.penalties_saved, base.pen_save) : 0;
      o.pen_miss = num(sc.penalties_missed, base.pen_miss);
      o.yc = num(sc.yellow_cards, base.yc);
      o.rc = num(sc.red_cards, base.rc);
      o.og = num(sc.own_goals, base.og);
      o.dc = num(sc["defensive_contribution_" + pos], base.dc);
      var thr = num(sc["defensive_contribution_limit_" + pos], 0);
      o.dc_threshold = thr > 0 ? thr : null;
      o.bonus = num(sc.bonus, 1);
    }
    out[t] = o;
  });
  return out;
}
function gwPoints(picks, gwData) {
  var list = arr(isObj(picks) && Array.isArray(picks.picks) ? picks.picks : picks);
  var els = isObj(gwData) && isObj(gwData.elements) ? gwData.elements : (isObj(gwData) ? gwData : {});
  var total = 0;
  list.forEach(function (p) {
    if (!isObj(p)) return;
    var m = num(p.multiplier, 1); if (m <= 0) return;
    var row = els[p.element]; if (!Array.isArray(row)) return;
    total += num(row[2], 0) * m;
  });
  return total;
}

// ---------------------------------------------------------------- constraints (B3)

function clubCounts(ids, els) {
  var E = elMap(els), out = {};
  idList(ids).forEach(function (id) { var el = E[id]; if (!el) return; var t = num(el.team, 0); out[t] = (out[t] || 0) + 1; });
  return out;
}
function posCounts(ids, E) {
  var c = { 1: 0, 2: 0, 3: 0, 4: 0, unknown: 0 };
  E = elMap(E);
  arr(ids).forEach(function (id) { var el = E[id]; var t = el ? elType(el) : 0; if (t) c[t]++; else c.unknown++; });
  return c;
}
function legal15(ids, els, budget) {
  var res = { ok: false, reasons: [], cost: 0, counts: {}, clubs: {} };
  try {
    var E = elMap(els);
    var raw = arr(ids), list = idList(raw);
    var cap = num(budget, BUDGET_TENTHS);
    if (!Array.isArray(ids)) { res.reasons.push("squad is not a list"); return res; }
    if (list.length !== raw.length) res.reasons.push("squad contains a non-numeric id");
    if (list.length !== 15) res.reasons.push("squad has " + list.length + " players, needs 15");
    if (uniq(list).length !== list.length) res.reasons.push("duplicate player id");
    var missing = list.filter(function (id) { return !E[id]; });
    if (missing.length) res.reasons.push("unknown ids: " + missing.join(","));
    var c = posCounts(list, E); res.counts = c;
    if (c[1] !== 2 || c[2] !== 5 || c[3] !== 5 || c[4] !== 3) res.reasons.push("shape " + c[1] + "-" + c[2] + "-" + c[3] + "-" + c[4] + ", needs 2-5-5-3");
    var cost = 0;
    raw.forEach(function (x) {
      var id = idOf(x); var el = E[id]; if (!el) return;
      cost += (isObj(x) && x.purchase !== undefined) ? num(x.purchase, num(el.now_cost, 0)) : num(el.now_cost, 0);
    });
    res.cost = cost;
    if (cost > cap) res.reasons.push("cost " + (cost / 10).toFixed(1) + "m exceeds " + (cap / 10).toFixed(1) + "m");
    var clubs = clubCounts(list, E); res.clubs = clubs;
    Object.keys(clubs).forEach(function (t) { if (clubs[t] > MAX_PER_CLUB) res.reasons.push(clubs[t] + " players from club " + t + " (max " + MAX_PER_CLUB + ")"); });
    res.ok = res.reasons.length === 0;
  } catch (e) { res.ok = false; res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function legalXI(ids, els) {
  var res = { ok: false, reasons: [], formation: "" };
  try {
    var E = elMap(els);
    if (!Array.isArray(ids)) { res.reasons.push("XI is not a list"); return res; }
    var list = idList(ids);
    if (list.length !== ids.length) res.reasons.push("XI contains a non-numeric id");
    if (list.length !== 11) res.reasons.push("XI has " + list.length + " players, needs 11");
    if (uniq(list).length !== list.length) res.reasons.push("duplicate player id");
    var missing = list.filter(function (id) { return !E[id]; });
    if (missing.length) res.reasons.push("unknown ids: " + missing.join(","));
    var c = posCounts(list, E);
    if (c[1] !== 1) res.reasons.push(c[1] + " goalkeepers, needs exactly 1");
    if (c[2] < 3) res.reasons.push(c[2] + " defenders, needs at least 3");
    if (c[3] < 2) res.reasons.push(c[3] + " midfielders, needs at least 2");
    if (c[4] < 1) res.reasons.push(c[4] + " forwards, needs at least 1");
    if (c[2] > 5 || c[3] > 5 || c[4] > 3) res.reasons.push("too many in one position");
    res.formation = c[2] + "-" + c[3] + "-" + c[4];
    res.ok = res.reasons.length === 0;
  } catch (e) { res.ok = false; res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function formationOf(ids, els) {
  var E = elMap(els), list = idList(ids);
  if (list.length !== 11) return "";
  var c = posCounts(list, E);
  if (c.unknown > 0 || c[1] !== 1) return "";
  return c[2] + "-" + c[3] + "-" + c[4];
}

// ---------------------------------------------------------------- xP (E1)

function shrunkPps(el) {
  if (!isObj(el)) return 0;
  var t = elType(el); var prior = PRIOR_PPS[t] || 3.5;
  var starts = Math.max(0, num(el.starts, 0)), pts = num(el.total_points, 0);
  var w = starts / (starts + SHRINK_K);
  var pps = starts > 0 ? pts / starts : 0;
  return w * pps + (1 - w) * prior;
}
function flagInfo(el) {
  var out = { flagged: false, status: "a", chance: null, news: "", factor: 1 };
  if (!isObj(el)) return out;
  var status = typeof el.status === "string" ? el.status : "a";
  var chance = (el.chance === null || el.chance === undefined) ? (el.chance_of_playing_next_round === undefined ? null : el.chance_of_playing_next_round) : el.chance;
  chance = chance === null || chance === undefined ? null : clamp(chance, 0, 100);
  out.status = status; out.chance = chance; out.news = typeof el.news === "string" ? el.news : "";
  out.flagged = status !== "a" || (chance !== null && chance < 100);
  if (!out.flagged) out.factor = 1;
  else if (chance !== null) out.factor = chance / 100;
  else out.factor = status === "d" ? 0.75 : 0;         // 'd' with no percentage: FPL's default doubt is 75%; i/s/u/n: 0
  return out;
}
function isFlagged(el) { return flagInfo(el).flagged; }
function statsFor(el, gwStats) {
  if (!isObj(el)) return null;
  if (isObj(gwStats) && typeof gwStats.games === "number") return gwStats;
  if (isObj(gwStats) && isObj(gwStats[el.id])) return gwStats[el.id];
  return null;
}
function pStart(el, gwStats) {
  if (!isObj(el)) return 0;
  var gs = statsFor(el, gwStats);
  var starts, n, benched;
  if (gs) { starts = num(gs.starts, 0); n = num(gs.games, 0); benched = !!gs.everBenched; }
  else { starts = Math.max(0, num(el.starts, 0)); n = starts; benched = false; }
  if (n < starts) n = starts;
  var p = (starts + 0.5) / (n + 1);
  if (benched) p *= BENCH_FACTOR;
  p *= flagInfo(el).factor;
  return clamp(p, 0, 1);
}
function fxMultInfo(fixture, teamId, TS) {
  // E-043: fxMult takes a FIXTURE OBJECT (H2 names this trap). Handed a fixture id it has nothing
  // to look up, returns the neutral 1, and every xp1/xp5 quietly falls back to the shrunk
  // baseline with no sign that anything went wrong. fxMult keeps the neutral answer — teamMults
  // sums over real fixtures and relies on it — and this companion says whether that 1 was
  // computed from a fixture or is the unresolved default. Callers and suites read `resolved`.
  var res = { mult: 1, resolved: false, reason: "" };
  if (!isObj(fixture)) { res.reason = "not a fixture object (" + kindOf(fixture) + "): fxMult needs the fixture itself, not its id"; return res; }
  var t = num(teamId, NaN);
  if (!isFinite(t)) { res.reason = "team id is not a number (" + kindOf(teamId) + ")"; return res; }
  var h = num(fixture.team_h, NaN), a = num(fixture.team_a, NaN);
  if (t === h) { res.mult = tsMult(t, a, true, TS); res.resolved = true; res.reason = "home"; return res; }
  if (t === a) { res.mult = tsMult(t, h, false, TS); res.resolved = true; res.reason = "away"; return res; }
  res.reason = "team " + t + " is not in this fixture";
  return res;
}
function fxMult(fixture, teamId, TS) { return fxMultInfo(fixture, teamId, TS).mult; }
function teamMults(teamId, ctx, tsKey) {
  var out = [0, 0, 0, 0, 0];
  if (!okCtx(ctx)) return out;
  var key = tsKey === "TS_GOALS" ? "TS_GOALS" : "TS";
  var cache = ctx.mults && ctx.mults[key] && ctx.mults[key][teamId];
  if (cache) return cache.slice();
  var TS = ctx[key] || {};
  for (var k = 0; k < 5; k++) {
    var ev = ctx.nextEvent + k;
    var fx = arr(ctx.fixturesByEvent[ev]);
    var m = 0;
    fx.forEach(function (f) { if (num(f.team_h, -1) === teamId || num(f.team_a, -1) === teamId) m += fxMult(f, teamId, TS); });
    out[k] = m;
  }
  return out;
}
function xp5FromMults(el, pstart, mults) {
  var s = shrunkPps(el), p = clamp(pstart, 0, 1), acc = 0;
  for (var k = 0; k < 5; k++) acc += DECAY[k] * num(arr(mults)[k], 0);
  return s * p * acc;
}
function xp1With(el, ctx, tsKey) {
  if (!isObj(el) || !okCtx(ctx)) return 0;
  var key = tsKey === "TS_GOALS" ? "TS_GOALS" : "TS";
  var c = ctx.xp && ctx.xp[el.id];
  if (c && c.el === el) return key === "TS" ? c.xp1 : c.xp1g;
  var m = teamMults(num(el.team, -1), ctx, key);
  return shrunkPps(el) * m[0] * pStart(el, ctx.gwStats);
}
function xp5With(el, ctx, tsKey) {
  if (!isObj(el) || !okCtx(ctx)) return 0;
  var key = tsKey === "TS_GOALS" ? "TS_GOALS" : "TS";
  var c = ctx.xp && ctx.xp[el.id];
  if (c && c.el === el) return key === "TS" ? c.xp5 : c.xp5g;
  return xp5FromMults(el, pStart(el, ctx.gwStats), teamMults(num(el.team, -1), ctx, key));
}
function xp1(el, ctx) { return xp1With(el, ctx, "TS"); }
function xp5(el, ctx) { return xp5With(el, ctx, "TS"); }

// ---------------------------------------------------------------- strength (E2)

function teamStrength(live) {
  var out = { TS: {}, TS_GOALS: {}, Lbar: LBAR_PRIOR, LbarGoals: LBAR_PRIOR };
  try {
    if (!isObj(live)) return out;
    var teams = arr(live.teams), fixtures = arr(live.fixtures);
    var fxById = {}; fixtures.forEach(function (f) { if (isObj(f) && f.id !== undefined) fxById[f.id] = f; });
    var acc = {};
    teams.forEach(function (t) { if (isObj(t) && t.id !== undefined) acc[t.id] = { g: 0, xgf: 0, xga: 0, gg: 0, gf: 0, ga: 0 }; });
    var gw = isObj(live.gw) ? live.gw : {};
    Object.keys(gw).forEach(function (k) {
      var fxg = isObj(gw[k]) && isObj(gw[k].fixture_xg) ? gw[k].fixture_xg : null; if (!fxg) return;
      Object.keys(fxg).forEach(function (fid) {
        var f = fxById[fid], v = fxg[fid]; if (!f || !isObj(v)) return;
        var h = num(v.h, 0), a = num(v.a, 0);
        if (acc[f.team_h]) { acc[f.team_h].g++; acc[f.team_h].xgf += h; acc[f.team_h].xga += a; }
        if (acc[f.team_a]) { acc[f.team_a].g++; acc[f.team_a].xgf += a; acc[f.team_a].xga += h; }
      });
    });
    fixtures.forEach(function (f) {
      if (!isObj(f) || !f.finished) return;
      var hs = num(f.team_h_score, NaN), as = num(f.team_a_score, NaN);
      if (!isFinite(hs) || !isFinite(as)) return;
      if (acc[f.team_h]) { acc[f.team_h].gg++; acc[f.team_h].gf += hs; acc[f.team_h].ga += as; }
      if (acc[f.team_a]) { acc[f.team_a].gg++; acc[f.team_a].gf += as; acc[f.team_a].ga += hs; }
    });
    var sgo = 0, sgg = 0;
    Object.keys(acc).forEach(function (t) { sgo += acc[t].gf; sgg += acc[t].gg; });
    var xgSide = strengthFromCounts(acc);            // one implementation of the E2 xG shrinkage
    var Lbar = xgSide.Lbar;
    var LbarG = sgg > 0 && sgo > 0 ? sgo / sgg : LBAR_PRIOR;
    out.Lbar = Lbar; out.LbarGoals = LbarG;
    out.TS = xgSide.TS;
    Object.keys(acc).forEach(function (t) {
      var a = acc[t];
      var wg = a.gg / (a.gg + TS_K);
      out.TS_GOALS[t] = { att: wg * ((a.gg ? a.gf / a.gg : 0) / LbarG) + (1 - wg), def: wg * ((a.gg ? a.ga / a.gg : 0) / LbarG) + (1 - wg), g: a.gg, xgf: a.gf, xga: a.ga, gf: a.gf, ga: a.ga, Lbar: LbarG };
    });
  } catch (e) { out.error = errMsg(e); }
  return out;
}
function tsEntry(TS, t) {
  var e = isObj(TS) ? TS[t] : null;
  if (!isObj(e)) return { att: 1, def: 1, Lbar: LBAR_PRIOR };
  return { att: clamp(num(e.att, 1), 0.05, 5), def: clamp(num(e.def, 1), 0.05, 5), Lbar: clamp(num(e.Lbar, LBAR_PRIOR), 0.2, 5) };
}
function tsXg(t, o, home, TS) {
  var a = tsEntry(TS, t), d = tsEntry(TS, o);
  return a.Lbar * a.att * d.def * (home ? HOME_ADV : AWAY_ADV);
}
function tsMult(t, o, home, TS) {
  var a = tsEntry(TS, t), d = tsEntry(TS, o);
  return a.att * d.def * (home ? HOME_ADV : AWAY_ADV);
}
function tsPcs(t, o, home, TS) {
  var lam = tsXg(o, t, !home, TS);
  return clamp(Math.exp(-lam), 1e-6, 1 - 1e-6);
}
function overUnderTags(live) {
  var out = [];
  try {
    var st = teamStrength(live);
    arr(live && live.teams).forEach(function (t) {
      if (!isObj(t)) return;
      var x = st.TS[t.id] || { g: 0, xgf: 0, xga: 0 }, g = st.TS_GOALS[t.id] || { g: 0, gf: 0, ga: 0 };
      var n = Math.max(x.g, g.g);
      var row = { teamId: t.id, short_name: t.short_name, g: n, gf: g.gf, xgf: x.xgf, ga: g.ga, xga: x.xga, tagFor: null, tagAgainst: null, diffFor: 0, diffAgainst: 0 };
      if (n > 0) {
        row.diffFor = (g.gf - x.xgf) / n; row.diffAgainst = (g.ga - x.xga) / n;
        if (row.diffFor >= 0.5) row.tagFor = "OVER"; else if (row.diffFor <= -0.5) row.tagFor = "UNDER";
        if (row.diffAgainst >= 0.5) row.tagAgainst = "OVER"; else if (row.diffAgainst <= -0.5) row.tagAgainst = "UNDER";
      }
      out.push(row);
    });
  } catch (e) { /* total */ }
  return out;
}
function runAvg(teamId, fixtures, n) {
  try {
    var t = num(teamId, NaN); if (!isFinite(t)) return 3;
    var k = Math.max(1, intOf(n, 5));
    var list = arr(fixtures).filter(function (f) { return isObj(f) && !f.finished && f.event !== null && f.event !== undefined && (num(f.team_h, -1) === t || num(f.team_a, -1) === t); });
    list.sort(function (a, b) { return num(a.event, 99) - num(b.event, 99) || String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")); });
    list = list.slice(0, k);
    if (!list.length) return 3;
    var s = 0; list.forEach(function (f) { s += clamp(num(f.team_h, -1) === t ? f.team_h_difficulty : f.team_a_difficulty, 1, 5); });
    return clamp(s / list.length, 1, 5);
  } catch (e) { return 3; }
}

// ---------------------------------------------------------------- per-element GW stats

function elementGwStats(live) {
  var out = {};
  try {
    if (!isObj(live)) return out;
    var fixtures = arr(live.fixtures);
    var gw = isObj(live.gw) ? live.gw : {};
    var gwKeys = Object.keys(gw).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum);
    var teamGames = {};                                 // teamId -> [{gw, n}]
    gwKeys.forEach(function (g) {
      fixtures.forEach(function (f) {
        if (!isObj(f) || num(f.event, -1) !== g) return;
        [f.team_h, f.team_a].forEach(function (t) { teamGames[t] = teamGames[t] || {}; teamGames[t][g] = (teamGames[t][g] || 0) + 1; });
      });
    });
    var dcThr = { 1: null, 2: 10, 3: 12, 4: 12 };
    arr(live.elements).forEach(function (el) {
      if (!isObj(el) || el.id === undefined) return;
      var t = el.team, type = elType(el);
      var s = { games: 0, starts: 0, played: 0, minutes: 0, everBenched: false, starts_last3: 0, startedLast: false, konsa: false, last3: [], history: [], dcHits: 0, dcRate: 0, bonusSum: 0, bonusRate: 0, ptsSum: 0, ptsPerGame: 0, bpsSum: 0, ictSum: 0, xgSum: 0, xaSum: 0, xgcSum: 0 };
      var seq = [];
      gwKeys.forEach(function (g) {
        var clubN = teamGames[t] && teamGames[t][g] ? teamGames[t][g] : 0;
        var row = isObj(gw[g]) && isObj(gw[g].elements) ? gw[g].elements[el.id] : null;
        var min = Array.isArray(row) ? num(row[0], 0) : 0, st = Array.isArray(row) ? num(row[1], 0) : 0, pts = Array.isArray(row) ? num(row[2], 0) : 0;
        if (clubN === 0 && !row) return;               // blank for the club and no data: not a game
        var n = Math.max(clubN, st > 0 ? st : 0, row ? 1 : 0);
        s.games += n; s.starts += st; s.minutes += min;
        if (min > 0) s.played++;
        if (st < n) s.everBenched = true;
        var h = { gw: g, games: n, min: min, starts: st, pts: pts };
        if (Array.isArray(row)) {
          h.xg = num(row[3], 0); h.xa = num(row[4], 0); h.xgc = num(row[5], 0); h.dc = num(row[6], 0); h.bps = num(row[7], 0); h.ict = num(row[8], 0); h.bonus = num(row[13], 0);
          s.ptsSum += pts; s.bpsSum += h.bps; s.ictSum += h.ict; s.xgSum += h.xg; s.xaSum += h.xa; s.xgcSum += h.xgc; s.bonusSum += h.bonus;
          if (dcThr[type] && h.dc >= dcThr[type]) s.dcHits++;
        }
        seq.push(h); s.history.push(h);
      });
      s.last3 = seq.slice(-3);
      s.starts_last3 = sum(s.last3, function (h) { return h.starts; });
      s.startedLast = seq.length > 0 && seq[seq.length - 1].starts > 0;
      s.konsa = s.startedLast && seq.length > 1 && seq[seq.length - 2].starts === 0;
      s.dcRate = s.played ? s.dcHits / s.played : 0;
      s.bonusRate = s.played ? s.bonusSum / s.played : 0;
      s.ptsPerGame = s.played ? s.ptsSum / s.played : 0;
      out[el.id] = s;
    });
  } catch (e) { /* total */ }
  return out;
}

// ---------------------------------------------------------------- rivals (E3)

function rivalPickShares(live, predicate) {
  var out = {};
  try {
    if (!isObj(live)) return out;
    var me = live.entry && live.entry.id !== undefined ? num(live.entry.id, NaN) : NaN;
    var rivals = isObj(live.rivals) ? live.rivals : {};
    arr(live.leagues).forEach(function (L) {
      if (!isObj(L) || L.id === undefined) return;
      var ids = arr(L.standings).map(function (r) { return isObj(r) ? num(r.entry, NaN) : NaN; })
        .filter(function (e) { return isFinite(e) && e !== me && isObj(rivals[e]) && Array.isArray(rivals[e].picks); });
      ids = uniq(ids);
      var counts = {};
      ids.forEach(function (e) { arr(rivals[e].picks).forEach(function (p) { if (isObj(p) && p.element !== undefined && predicate(p)) counts[p.element] = (counts[p.element] || 0) + 1; }); });
      var share = {}; Object.keys(counts).forEach(function (k) { share[k] = ids.length ? counts[k] / ids.length : 0; });
      out[L.id] = share;
    });
  } catch (e) { /* total */ }
  return out;
}
function rivalOwn(live) { return rivalPickShares(live, function () { return true; }); }
function capShare(live) { return rivalPickShares(live, function (p) { return p.is_captain === true || num(p.multiplier, 1) >= 2; }); }
function rivalOwnMax(elementId, ctx) {
  var best = { max: 0, league: null };
  if (!okCtx(ctx) || !isObj(ctx.rivalOwn)) return best;
  Object.keys(ctx.rivalOwn).forEach(function (L) { var v = num(ctx.rivalOwn[L][elementId], 0); if (v > best.max) { best.max = v; best.league = num(L, L); } });
  return best;
}
function convergenceRisk(elementId, ctx) {
  var m = rivalOwnMax(elementId, ctx);
  return { risk: m.max >= CONVERGENCE, max: m.max, league: m.league };
}
function classify(el, ctx) {
  if (!isObj(el) || !okCtx(ctx)) return "NEUTRAL";
  var gs = ctx.gwStats[el.id] || { starts_last3: 0, startedLast: false };
  if (num(gs.starts_last3, 0) === 0) return "DEAD";
  var m = rivalOwnMax(el.id, ctx).max;
  if (m >= SHARED_MIN) return "SHARED";
  if (m < EDGE_MAX && gs.startedLast) return "EDGE";
  return "NEUTRAL";
}

// ---------------------------------------------------------------- phase and context

function gamePhase(live, now) {
  try {
    var t = nowMs(now); if (!t || !isObj(live)) return "pre";
    var events = arr(live.events).filter(function (e) { return isObj(e) && isFinite(Date.parse(e.deadline_time)); });
    var past = events.filter(function (e) { return Date.parse(e.deadline_time) <= t; });
    if (!past.length) return "pre";
    var last = past[past.length - 1];
    var dl = Date.parse(last.deadline_time);
    var open = arr(live.fixtures).some(function (f) {
      if (!isObj(f) || num(f.event, -1) !== num(last.id, -2) || f.finished) return false;
      var ko = Date.parse(f.kickoff_time); return isFinite(ko) && ko - dl < 6 * 86400000;
    });
    if (open) return "live";
    var future = events.filter(function (e) { return Date.parse(e.deadline_time) > t; });
    return future.length ? "pre" : "post";
  } catch (e) { return "pre"; }
}
function buildCtx(live, state, now) {
  var ctx = { ok: false, live: null, state: null, now: 0, nowISO: "", els: {}, elList: [], byCode: {}, teams: {}, teamList: [], events: [], nextEvent: 0, currentEvent: 0, deadline: null, hoursToDeadline: null, phase: "pre", fixtures: [], fixturesByEvent: {}, finishedGws: [], TS: {}, TS_GOALS: {}, Lbar: LBAR_PRIOR, gwStats: {}, rivalOwn: {}, capShare: {}, flags: {}, mults: { TS: {}, TS_GOALS: {} }, xp: {}, squadIds: [], squad: [], purchase: {}, picks: [], ft: 1, bank: 0, value: 0, budget: BUDGET_TENTHS, block: { changed: false, added: [], removed: [], block: false }, baseRates: { yc: 0.13, rc: 0.005, og: 0.004 }, draft: { els: {}, byCode: {}, scoring: null, waiversTime: null, deadline: null, leagueId: null, captainsDisabled: true, league: null, entries: [], entryById: {}, ownership: {}, rosters: {}, freeAgents: [], matches: [], standings: [], picks: {}, me: null, hasPool: false, note: "" }, leagues: [], error: null };
  try {
    if (!isObj(live) || !Array.isArray(live.elements)) { ctx.error = "live snapshot missing or malformed"; return ctx; }
    ctx.live = live;
    var t = nowMs(now) || nowMs(live.fetched_at) || 0;
    ctx.now = t; ctx.nowISO = t ? new Date(t).toISOString() : "";
    live.elements.forEach(function (el) { if (isObj(el) && el.id !== undefined) { ctx.els[el.id] = el; ctx.elList.push(el); if (el.code !== undefined) ctx.byCode[el.code] = el; } });
    arr(live.teams).forEach(function (tm) { if (isObj(tm) && tm.id !== undefined) { ctx.teams[tm.id] = tm; ctx.teamList.push(tm); } });
    ctx.events = arr(live.events).filter(isObj);
    var nextEv = intOf(live.next_event, 0);
    if (!nextEv) { var n1 = ctx.events.filter(function (e) { return e.is_next; })[0]; nextEv = n1 ? intOf(n1.id, 0) : 0; }
    var curEv = intOf(live.current_event, 0);
    if (!curEv) { var c1 = ctx.events.filter(function (e) { return e.is_current; })[0]; curEv = c1 ? intOf(c1.id, 0) : Math.max(0, nextEv - 1); }
    if (!nextEv) nextEv = curEv + 1;
    ctx.nextEvent = nextEv; ctx.currentEvent = curEv;
    var nextObj = ctx.events.filter(function (e) { return intOf(e.id, -1) === nextEv; })[0];
    ctx.deadline = nextObj && nextObj.deadline_time ? String(nextObj.deadline_time) : null;
    var dl = ctx.deadline ? Date.parse(ctx.deadline) : NaN;
    ctx.hoursToDeadline = isFinite(dl) && t ? (dl - t) / 3600000 : null;
    ctx.phase = gamePhase(live, t);
    ctx.fixtures = arr(live.fixtures).filter(isObj);
    ctx.fixtures.forEach(function (f) { var ev = intOf(f.event, -1); if (ev < 0) return; (ctx.fixturesByEvent[ev] = ctx.fixturesByEvent[ev] || []).push(f); });
    ctx.finishedGws = Object.keys(isObj(live.gw) ? live.gw : {}).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum);
    var st = teamStrength(live);
    ctx.TS = st.TS; ctx.TS_GOALS = st.TS_GOALS; ctx.Lbar = st.Lbar; ctx.LbarGoals = st.LbarGoals;
    ctx.gwStats = elementGwStats(live);
    ctx.rivalOwn = rivalOwn(live); ctx.capShare = capShare(live);
    ctx.leagues = arr(live.leagues).filter(isObj);
    ctx.ok = true;
    ctx.teamList.forEach(function (tm) { ctx.mults.TS[tm.id] = teamMults(tm.id, ctx, "TS"); ctx.mults.TS_GOALS[tm.id] = teamMults(tm.id, ctx, "TS_GOALS"); });
    var mins = 0, yc = 0, rc = 0, og = 0;
    ctx.elList.forEach(function (el) {
      ctx.flags[el.id] = flagInfo(el);
      mins += num(el.minutes, 0); yc += num(el.yc, 0); rc += num(el.rc, 0); og += num(el.og, 0);
      var s = shrunkPps(el), p = pStart(el, ctx.gwStats);
      var m = ctx.mults.TS[el.team] || [0, 0, 0, 0, 0], mg = ctx.mults.TS_GOALS[el.team] || [0, 0, 0, 0, 0];
      ctx.xp[el.id] = { el: el, shrunk: s, pstart: p, xp1: s * m[0] * p, xp5: xp5FromMults(el, p, m), xp1g: s * mg[0] * p, xp5g: xp5FromMults(el, p, mg) };
    });
    if (mins > 0) ctx.baseRates = { yc: yc / mins * 90, rc: rc / mins * 90, og: og / mins * 90 };
    var sstate = sanitiseState(state);
    ctx.state = sstate;
    ctx.squad = sstate.squad.filter(function (s) { return ctx.els[s.id]; });
    ctx.squadIds = ctx.squad.map(function (s) { return s.id; });
    ctx.squad.forEach(function (s) { ctx.purchase[s.id] = s.purchase; });
    ctx.ft = live.ft_available !== undefined ? clamp(intOf(live.ft_available, 1), 0, FT_CAP) : (isObj(live.history) ? ftAvailable(live.history, curEv) : clamp(sstate.ft, 0, FT_CAP));
    if (state && isObj(state) && state.ft !== undefined && live.ft_available === undefined) ctx.ft = clamp(sstate.ft, 0, FT_CAP);
    ctx.bank = sstate.bank;
    if (isObj(live.entry) && live.entry.last_deadline_bank !== undefined && (!isObj(state) || state.bank === undefined)) ctx.bank = intOf(live.entry.last_deadline_bank, 0);
    ctx.value = sstate.value || (isObj(live.entry) ? intOf(live.entry.last_deadline_value, 0) : 0);
    var sellSum = 0; ctx.squad.forEach(function (s) { sellSum += sellPrice(num(ctx.els[s.id].now_cost, 0), s.purchase); });
    ctx.budget = ctx.squad.length === 15 ? ctx.bank + sellSum : BUDGET_TENTHS;
    var pk = isObj(live.picks) ? live.picks[curEv] || live.picks[String(curEv)] : null;
    ctx.picks = pk && Array.isArray(pk.picks) ? pk.picks : [];
    ctx.block = ctx.picks.length ? detectSquadChange(ctx.squadIds, ctx.picks) : { changed: false, added: [], removed: [], block: false };
    if (ctx.block.block && sstate.confirmed_gw >= curEv && ctx.squadIds.length === 15) ctx.block = { changed: ctx.block.changed, added: ctx.block.added, removed: ctx.block.removed, block: false, confirmed: true };
    var d = isObj(live.draft) ? live.draft : {};
    arr(d.elements).forEach(function (de) { if (isObj(de) && de.id !== undefined) { ctx.draft.els[de.id] = de; if (de.code !== undefined) ctx.draft.byCode[de.code] = de; } });
    ctx.draft.scoring = draftScoring(live);
    var dEv = arr(d.events).filter(function (e) { return isObj(e) && intOf(e.id, -1) === nextEv; })[0];
    ctx.draft.waiversTime = dEv && dEv.waivers_time ? String(dEv.waivers_time) : null;
    ctx.draft.deadline = dEv && dEv.deadline_time ? String(dEv.deadline_time) : null;
    ctx.draft.leagueId = d.league_id === undefined || d.league_id === null ? null : (intOf(d.league_id, 0) || null);
    ctx.draft.captainsDisabled = !(isObj(d.squad) && d.squad.captains_disabled === false);
    // The league half of the draft block (CONTRACT §3). Absent when no league id has been
    // supplied, in which case every field below stays empty and hasPool stays false.
    ctx.draft.league = isObj(d.league) ? { id: intOf(d.league.id, 0) || null, name: String(d.league.name || ""), scoring: String(d.league.scoring || ""), size: intOf(d.league.size, 0) } : null;
    arr(d.entries).forEach(function (e) {
      if (!isObj(e)) return;
      var lid = intOf(e.leagueEntryId, 0); if (!lid) return;
      var row = {
        leagueEntryId: lid,
        entryId: e.entryId === null || e.entryId === undefined ? null : (intOf(e.entryId, 0) || null),
        name: String(e.name || ""),
        waiverPick: e.waiverPick === null || e.waiverPick === undefined ? null : (intOf(e.waiverPick, 0) || null)
      };
      ctx.draft.entries.push(row); ctx.draft.entryById[lid] = row;
    });
    arr(d.ownership).forEach(function (o) {
      if (!isObj(o)) return;
      var c = intOf(o.code, 0); if (!c) return;
      ctx.draft.ownership[c] = { owner: o.owner === null || o.owner === undefined ? null : (intOf(o.owner, 0) || null), status: String(o.status || "") };
    });
    if (isObj(d.rosters)) Object.keys(d.rosters).forEach(function (k) {
      var lid = intOf(k, 0); if (!lid) return;
      ctx.draft.rosters[lid] = uniq(arr(d.rosters[k]).map(function (c) { return intOf(c, 0); }).filter(function (c) { return c > 0; }));
    });
    ctx.draft.freeAgents = uniq(arr(d.freeAgents).map(function (c) { return intOf(c, 0); }).filter(function (c) { return c > 0; }));
    arr(d.matches).forEach(function (m) {
      if (!isObj(m)) return;
      ctx.draft.matches.push({
        event: intOf(m.event, 0), finished: !!m.finished, started: !!m.started,
        entry1: intOf(m.entry1, 0) || null, points1: num(m.points1, 0),
        entry2: intOf(m.entry2, 0) || null, points2: num(m.points2, 0),
        winner: m.winner === null || m.winner === undefined ? null : (intOf(m.winner, 0) || null)
      });
    });
    arr(d.standings).forEach(function (r) {
      if (!isObj(r)) return;
      ctx.draft.standings.push({
        leagueEntry: intOf(r.leagueEntry, 0) || null, rank: intOf(r.rank, 0), lastRank: intOf(r.lastRank, 0),
        played: intOf(r.played, 0), won: intOf(r.won, 0), drawn: intOf(r.drawn, 0), lost: intOf(r.lost, 0),
        pointsFor: num(r.pointsFor, 0), pointsAgainst: num(r.pointsAgainst, 0), total: num(r.total, 0)
      });
    });
    if (isObj(d.picks)) Object.keys(d.picks).forEach(function (k) {
      var lid = intOf(k, 0), p = d.picks[k]; if (!lid || !isObj(p)) return;
      var codesOf = function (x) { return uniq(arr(x).map(function (c) { return intOf(c, 0); }).filter(function (c) { return c > 0; })); };
      ctx.draft.picks[lid] = { event: intOf(p.event, 0), codes: codesOf(p.codes), xi: codesOf(p.xi), bench: codesOf(p.bench) };
    });
    if (isObj(d.me)) {
      var mel = intOf(d.me.leagueEntryId, 0);
      if (mel) ctx.draft.me = { leagueEntryId: mel, entryId: d.me.entryId === null || d.me.entryId === undefined ? null : (intOf(d.me.entryId, 0) || null), via: String(d.me.via || "") };
    }
    if (!ctx.draft.me && sstate.draft && sstate.draft.entry_id) {
      var se = intOf(sstate.draft.entry_id, 0), hit = null;
      ctx.draft.entries.forEach(function (e) { if (!hit && e.entryId === se) hit = e; });
      if (hit) ctx.draft.me = { leagueEntryId: hit.leagueEntryId, entryId: hit.entryId, via: "saved entry id" };
    }
    ctx.draft.hasPool = Object.keys(ctx.draft.ownership).length > 0 && ctx.draft.entries.length > 0;
    ctx.draft.note = ctx.draft.hasPool ? "" : (ctx.draft.leagueId ? "a draft league id is saved but this snapshot carries no ownership for it" : "no draft league id has been supplied");
  } catch (e) { ctx.ok = false; ctx.error = errMsg(e); }
  return ctx;
}

// ---------------------------------------------------------------- XI selection

function tierOf(p) { return p >= 0.75 ? 2 : (p >= 0.5 ? 1 : 0); }
function pickXI(ids, ctx, valueOf) {
  // Generic legal-XI maximiser over the eight formations. valueOf(el) is the per-player score.
  // A P(start) < 0.5 player never starts ahead of a P(start) >= 0.75 player he could be swapped with.
  var res = { ids: [], formation: "", score: 0, bench: [], ok: false };
  if (!okCtx(ctx)) return res;
  var scoreOf = typeof valueOf === "function" ? valueOf : function () { return 0; };
  var list = uniq(idList(ids)).filter(function (id) { return ctx.els[id]; });
  var by = { 1: [], 2: [], 3: [], 4: [] };
  list.forEach(function (id) {
    var el = ctx.els[id], t = elType(el); if (!t) return;
    var p = ctx.xp[id] ? ctx.xp[id].pstart : pStart(el, ctx.gwStats);
    by[t].push({ id: id, v: num(scoreOf(el), 0), p: p, tier: tierOf(p), starts: num(el.starts, 0), min: num(el.minutes, 0) });
  });
  [1, 2, 3, 4].forEach(function (t) { by[t].sort(function (a, b) { return b.tier - a.tier || b.v - a.v || b.starts - a.starts || b.min - a.min; }); });
  if (!by[1].length) return res;
  var best = null;
  FORMATIONS.forEach(function (f) {
    if (by[2].length < f[0] || by[3].length < f[1] || by[4].length < f[2]) return;
    var xi = [by[1][0]].concat(by[2].slice(0, f[0]), by[3].slice(0, f[1]), by[4].slice(0, f[2]));
    var bench = by[1].slice(1).concat(by[2].slice(f[0]), by[3].slice(f[1]), by[4].slice(f[2]));
    var score = sum(xi, function (x) { return x.v; });
    // violation: a tier-0 starter while a tier-2 outfield bench player could legally replace him
    var counts = { 2: f[0], 3: f[1], 4: f[2] };
    var violation = xi.some(function (s) {
      if (s.tier !== 0) return false;
      var st = elType(ctx.els[s.id]);
      return bench.some(function (b) {
        if (b.tier !== 2) return false;
        var bt = elType(ctx.els[b.id]); if (bt === 1 || st === 1) return bt === st;
        if (bt === st) return true;
        var c = { 2: counts[2], 3: counts[3], 4: counts[4] }; c[st]--; c[bt]++;
        return c[2] >= 3 && c[2] <= 5 && c[3] >= 2 && c[3] <= 5 && c[4] >= 1 && c[4] <= 3;
      });
    });
    var cand = { xi: xi, bench: bench, score: score, formation: f[0] + "-" + f[1] + "-" + f[2], violation: violation };
    if (!best || (best.violation && !cand.violation) || (best.violation === cand.violation && cand.score > best.score)) best = cand;
  });
  if (!best) return res;
  res.ids = best.xi.map(function (x) { return x.id; });
  res.bench = best.bench.map(function (x) { return x.id; });
  res.formation = best.formation; res.score = best.score; res.ok = true;
  return res;
}
function captainPick(xiIds, ctx) {
  var res = { capId: null, viceId: null, table: [], reasons: [] };
  try {
    if (!okCtx(ctx)) { res.reasons.push("no context"); return res; }
    var list = uniq(idList(xiIds)).filter(function (id) { return ctx.els[id]; });
    list.forEach(function (id) {
      var el = ctx.els[id], t = elType(el);
      var x = ctx.xp[id] || { xp1: xp1(el, ctx), pstart: pStart(el, ctx.gwStats) };
      var fl = ctx.flags[id] || flagInfo(el);
      var starts = num(el.starts, 0);
      var cs = {}; var csMax = 0;
      Object.keys(ctx.capShare).forEach(function (L) { var v = num(ctx.capShare[L][id], 0); cs[L] = v; if (v > csMax) csMax = v; });
      var row = { id: id, web_name: el.web_name, pos: POS_NAME[t] || "?", xp1: x.xp1, pstart: x.pstart, ev: 2 * x.xp1 * x.pstart, ppsStart: starts ? num(el.total_points, 0) / starts : 0, flagged: fl.flagged, status: fl.status, chance: fl.chance, capShare: cs, capShareMax: csMax, rivalOwnMax: rivalOwnMax(id, ctx).max, eligible: (t === 3 || t === 4) && !fl.flagged && x.pstart >= 0.5, why: "" };
      if (t !== 3 && t !== 4) row.why = "not an attacker";
      else if (fl.flagged) row.why = "flagged (" + fl.status + (fl.chance !== null ? " " + fl.chance + "%" : "") + ")";
      else if (x.pstart < 0.5) row.why = "P(start) below 0.5";
      res.table.push(row);
    });
    res.table.sort(function (a, b) { return (b.eligible - a.eligible) || (b.ev - a.ev) || (b.ppsStart - a.ppsStart) || (b.pstart - a.pstart); });
    var el = res.table.filter(function (r) { return r.eligible; });
    if (el.length) res.capId = el[0].id; else res.reasons.push("no unflagged attacker with P(start) >= 0.5 in the XI");
    if (el.length > 1) res.viceId = el[1].id;
  } catch (e) { res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function bestXI(ids, ctx) {
  var res = { ids: [], capId: null, viceId: null, formation: "", score: 0, bench: [] };
  try {
    if (!okCtx(ctx)) return res;
    var r = pickXI(ids, ctx, function (el) { return ctx.xp[el.id] ? ctx.xp[el.id].xp1 : xp1(el, ctx); });
    if (!r.ok) return res;
    res.ids = r.ids; res.formation = r.formation; res.score = r.score; res.bench = r.bench;
    var c = captainPick(r.ids, ctx); res.capId = c.capId; res.viceId = c.viceId;
  } catch (e) { /* total */ }
  return res;
}
function benchOrder(squadIds, xiIds, ctx) {
  try {
    if (!okCtx(ctx)) return [];
    var xi = uniq(idList(xiIds)).filter(function (id) { return ctx.els[id]; });
    var xiSet = {}; xi.forEach(function (id) { xiSet[id] = true; });
    var bench = uniq(idList(squadIds)).filter(function (id) { return ctx.els[id] && !xiSet[id] && elType(ctx.els[id]) !== 1; });
    var counts = posCounts(xi, ctx.els);
    var starters = xi.filter(function (id) { return elType(ctx.els[id]) !== 1; });
    var scored = bench.map(function (id) {
      var el = ctx.els[id], bt = elType(el), x = ctx.xp[id] || { shrunk: shrunkPps(el), pstart: pStart(el, ctx.gwStats) };
      var m = (ctx.mults.TS[el.team] || [0])[0];
      var eGiven = x.shrunk * m;                                    // E[points | plays]
      var pNone = 1;
      starters.forEach(function (s) {
        var st = elType(ctx.els[s]);
        var c = { 2: counts[2], 3: counts[3], 4: counts[4] }; c[st]--; c[bt]++;
        var legal = c[2] >= 3 && c[2] <= 5 && c[3] >= 2 && c[3] <= 5 && c[4] >= 1 && c[4] <= 3;
        if (!legal) return;
        var ps = ctx.xp[s] ? ctx.xp[s].pstart : pStart(ctx.els[s], ctx.gwStats);
        pNone *= ps;                                                 // P(this starter does not fail)
      });
      var pFail = 1 - pNone;
      return { id: id, key: pFail * eGiven * x.pstart, pFail: pFail, eGiven: eGiven };
    });
    scored.sort(function (a, b) { return b.key - a.key; });
    return scored.map(function (s) { return s.id; });
  } catch (e) { return []; }
}
function sellCandidates(squad, ctx) {
  var out = [];
  try {
    if (!okCtx(ctx)) return out;
    uniq(idList(squad)).forEach(function (id) {
      var el = ctx.els[id]; if (!el) return;
      var gs = ctx.gwStats[id] || { starts_last3: 0, konsa: false };
      var fl = ctx.flags[id] || flagInfo(el);
      var reasons = [];
      if (num(gs.starts_last3, 0) === 0) reasons.push("no starts in the last 3");
      if (fl.status !== "a") reasons.push("status " + fl.status + (fl.chance !== null ? " (" + fl.chance + "%)" : ""));
      if (reasons.length) out.push({ id: id, web_name: el.web_name, reason: reasons.join("; "), forced: true, konsa: !!gs.konsa });
      else if (gs.konsa) out.push({ id: id, web_name: el.web_name, reason: "started the last match after a spell out — protected (Konsa rule)", forced: false, konsa: true });
    });
  } catch (e) { /* total */ }
  return out;
}

// ---------------------------------------------------------------- transfers (C2)

function transferProtocol(state, ctx) {
  var res = { moves: [], order: [], captain: null, vice: null, value: 0, margin: 0, confidence: "hold", hits: 0, k: 0, bankAfter: 0, forced: [], alternatives: [], reasons: [], blocked: false, ft: 0, bank: 0 };
  try {
    if (!okCtx(ctx)) { res.reasons.push("no context"); return res; }
    var st = state === undefined || state === null ? ctx.state : sanitiseState(state);
    var squad = st.squad.map(function (s) { return s.id; }).filter(function (id) { return ctx.els[id]; });
    if (squad.length !== 15) { res.reasons.push("squad is " + squad.length + " known players, not 15"); return res; }
    var purchase = {}; st.squad.forEach(function (s) { purchase[s.id] = s.purchase; });
    var FT = clamp(intOf(st.ft, ctx.ft), 0, FT_CAP); if (state === undefined || state === null) FT = ctx.ft;
    var bank = state === undefined || state === null ? ctx.bank : intOf(st.bank, 0);
    res.ft = FT; res.bank = bank; res.bankAfter = bank;
    var blk = detectSquadChange(squad, ctx.picks);
    if (ctx.picks.length && blk.block && !(st.confirmed_gw >= ctx.currentEvent)) { res.blocked = true; res.reasons.push("live picks differ from the saved squad (added " + blk.added.join(",") + "; removed " + blk.removed.join(",") + ") — confirm the squad before any move"); return res; }
    var sells = sellCandidates(squad, ctx);
    var forced = sells.filter(function (s) { return s.forced; }).map(function (s) { return s.id; });
    var protectedIds = {}; sells.forEach(function (s) { if (s.konsa && !s.forced) protectedIds[s.id] = true; });
    res.forced = sells.filter(function (s) { return s.forced; });
    var inSquad = {}; squad.forEach(function (id) { inSquad[id] = true; });
    /* E-090: this used to be min(FT + 1, 3) and the reason string said "at most 3 transfers this
       week", printed under a header reading "FT 4". Both statements were true about different
       things — the 3 was the search's own limit, not the week's — and together they told the
       manager he could not do something the rules plainly allow. Free transfers bank to five
       (v110 §4), so the week's limit is FT + 1 with one hit, and the search reaches it. */
    var weekK = Math.min(FT + 1, MAX_GREEDY_SWAPS);
    var maxK = Math.min(weekK, MAX_SWAPS);
    res.weekLimit = weekK;
    res.searchLimit = maxK;
    if (forced.length > weekK) {
      res.reasons.push(forced.length + " forced sells and the week allows " + weekK +
        " transfer" + (weekK === 1 ? "" : "s") + " (" + FT + " free" + (weekK > FT ? " plus one hit" : "") +
        "); the lowest-xp forced sells go first");
    }
    forced.sort(function (a, b) { return ctx.xp[a].xp5 - ctx.xp[b].xp5; });
    var candByPos = { 1: [], 2: [], 3: [], 4: [] };
    ctx.elList.forEach(function (el) {
      var t = elType(el); if (!t || inSquad[el.id]) return;
      var fl = ctx.flags[el.id]; if (fl.status !== "a" || fl.flagged) return;
      var gs = ctx.gwStats[el.id]; if (!gs || gs.starts_last3 === 0) return;
      var x = ctx.xp[el.id]; if (x.pstart < 0.5) return;
      if (convergenceRisk(el.id, ctx).risk) return;
      candByPos[t].push(el.id);
    });
    [1, 2, 3, 4].forEach(function (t) { candByPos[t].sort(function (a, b) { return ctx.xp[b].xp5 - ctx.xp[a].xp5; }); });
    var perPos = { 1: 40, 2: 12, 3: 8 };
    var plans = [];
    function evalPlan(outs, ins, k) {
      var hits = Math.max(0, k - FT) * HIT_COST;
      var newSquad = squad.filter(function (id) { return outs.indexOf(id) < 0; }).concat(ins);
      var L = legal15(newSquad, ctx.els, 1e9); if (!L.ok) return null;
      var incoming = clubCounts(ins, ctx.els);
      for (var c in incoming) if (incoming[c] > MAX_INCOMING_PER_CLUB) return null;
      var moves = [];
      var outsByPos = {}, insByPos = {};
      outs.forEach(function (id) { var t = elType(ctx.els[id]); (outsByPos[t] = outsByPos[t] || []).push(id); });
      ins.forEach(function (id) { var t = elType(ctx.els[id]); (insByPos[t] = insByPos[t] || []).push(id); });
      var gain = 0;
      for (var t in outsByPos) {
        if (!insByPos[t] || insByPos[t].length !== outsByPos[t].length) return null;
        var o = outsByPos[t].slice().sort(function (a, b) { return ctx.xp[a].xp5 - ctx.xp[b].xp5; });
        var i = insByPos[t].slice().sort(function (a, b) { return ctx.xp[a].xp5 - ctx.xp[b].xp5; });
        for (var j = 0; j < o.length; j++) {
          var g = ctx.xp[i[j]].xp5 - ctx.xp[o[j]].xp5;
          var isForced = forced.indexOf(o[j]) >= 0;
          if (!isForced && g <= SELL_GAIN_MIN) return null;     // C1 rule 1: sell only if no starts in 3 or gain > 4
          gain += g;
          moves.push({ out: o[j], in: i[j], outName: ctx.els[o[j]].web_name, inName: ctx.els[i[j]].web_name, xpOut: ctx.xp[o[j]].xp5, xpIn: ctx.xp[i[j]].xp5, gain: g, forced: isForced, priceOut: sellPrice(num(ctx.els[o[j]].now_cost, 0), purchase[o[j]]), priceIn: num(ctx.els[i[j]].now_cost, 0) });
        }
      }
      /* E-092: k is what every caller downstream believes about this plan — the number of
         transfers, the hit priced at 4 each, the "k of your FT free" line on the landing card. A
         plan whose moves disagree with its k is not a plan, it is a lie with a price on it, so it
         never leaves this function. The pairing above already refuses an out whose position has no
         candidate left; this is the backstop for any caller that miscounts the swaps it asked for. */
      if (moves.length !== k) return null;
      var bankAfter = bankAfter_(bank, moves);
      if (bankAfter < 0) return null;
      moves.sort(function (a, b) { return (b.forced - a.forced) || (b.gain - a.gain); });
      return { moves: moves, outs: outs.slice().sort(sortNum), ins: ins.slice().sort(sortNum), k: k, hits: hits, value: gain - hits, bankAfter: bankAfter };
    }
    function bankAfter_(b, moves) { var v = b; moves.forEach(function (m) { v += m.priceOut - m.priceIn; }); return v; }
    for (var k = 1; k <= maxK; k++) {
      var need = forced.slice(0, Math.min(forced.length, k));
      var free = squad.filter(function (id) { return need.indexOf(id) < 0 && forced.indexOf(id) < 0 && !protectedIds[id]; });
      var outSets = combos(free, k - need.length).map(function (c) { return need.concat(c); });
      var lim = perPos[k] || 8;
      outSets.forEach(function (outs) {
        var slots = outs.map(function (id) { return candByPos[elType(ctx.els[id])].slice(0, lim); });
        function rec(i, chosen) {
          if (i === outs.length) { var p = evalPlan(outs, chosen, k); if (p) plans.push(p); return; }
          for (var j = 0; j < slots[i].length; j++) {
            var c = slots[i][j]; if (chosen.indexOf(c) >= 0) continue;
            if (i > 0 && elType(ctx.els[outs[i - 1]]) === elType(ctx.els[outs[i]]) && chosen.length && c < chosen[chosen.length - 1]) continue; // same-position symmetry
            chosen.push(c); rec(i + 1, chosen); chosen.pop();
          }
        }
        rec(0, []);
      });
    }
    /* Beyond three swaps the search is greedy, which is what v110 B4 asks for: take the best plan
       so far and add the single best further swap, while the week still allows one. Exhaustive
       would mean C(15,4) out-sets times the candidates per slot, and that is not a search a phone
       finishes. Greedy is monotone here — a swap is only added when it raises the plan's value —
       so a four-swap plan never scores worse than the three-swap plan it grew from.

       E-092: the loop used to count `gk` from MAX_SWAPS + 1 to weekK while the plan it grows from
       is whatever won the exhaustive search — and that winner is often a one- or two-swap plan,
       because a k-swap out-set is forced to carry min(forced, k) forced sells, and two forced sells
       plus one high-gain choice can beat three forced sells. Growing a two-swap plan then produced
       three moves labelled k = 4: `moves.length !== k` (mc_all I55), a hit charged for a transfer
       nobody made (I54 prices the hit off the same k), and the last free transfer left unused
       because the counter ran out before the plan did. The step now reads the plan's own moves: the
       base pairs come from `grown.moves`, the new k is one more than the moves the plan actually
       reports, and the loop runs while that count is below the week's limit. */
    if (weekK > MAX_SWAPS && plans.length) {
      plans.sort(function (a, b) { return b.value - a.value || a.k - b.k; });
      var grown = plans[0];
      for (var step = 0; step < weekK && grown.moves.length < weekK; step++) {
        var baseOuts = grown.moves.map(function (m) { return m.out; });
        var baseIns = grown.moves.map(function (m) { return m.in; });
        var gk = baseOuts.length + 1;
        var used = {}; baseOuts.forEach(function (id) { used[id] = true; });
        var usedIn = {}; baseIns.forEach(function (id) { usedIn[id] = true; });
        var bestNext = null;
        var stillOut = squad.filter(function (id) { return !used[id] && !protectedIds[id]; });
        // Forced sells still in the squad come first, then the rest by lowest five-week xp.
        stillOut.sort(function (a, b) {
          var fa = forced.indexOf(a) >= 0 ? 0 : 1, fb = forced.indexOf(b) >= 0 ? 0 : 1;
          return (fa - fb) || ((ctx.xp[a] ? ctx.xp[a].xp5 : 0) - (ctx.xp[b] ? ctx.xp[b].xp5 : 0));
        });
        stillOut.slice(0, 8).forEach(function (outId) {
          var cands = candByPos[elType(ctx.els[outId])] || [];
          cands.slice(0, 8).forEach(function (inId) {
            if (usedIn[inId]) return;
            var p = evalPlan(baseOuts.concat([outId]), baseIns.concat([inId]), gk);
            if (!p) return;
            if (!bestNext || p.value > bestNext.value) bestNext = p;
          });
        });
        if (!bestNext || bestNext.value <= grown.value) break;   // adding a swap has to pay
        plans.push(bestNext);
        grown = bestNext;
      }
    }
    plans.sort(function (a, b) { return b.value - a.value || a.k - b.k; });
    // E-037: `order` is built on ONE path. The no-plan branch used to return early with the
    // captain and the vice set but the execution order empty, so a hold week handed the manager
    // an empty list of steps. C2 step 5 wants sells first and the captain and vice steps last on
    // every path that reaches an eleven — hold included.
    var newSquad = squad;
    if (!plans.length) {
      res.confidence = forced.length ? "LOW" : "hold";
      res.reasons.push(forced.length ? "forced sells exist but no legal replacement passed every gate (budget, club cap, convergence, starts)" : "no swap clears the sell rule (gain > 4 xp5 or a forced sell)");
    } else {
      var best = plans[0];
    // E-008: "genuinely different" is the SET of players out and the SET of players in, sorted —
    // the same two swaps paired the other way round is the same plan, and reporting it as the
    // runner-up is what produced "margin 0.00 LOW". The margin and the alternatives panel both
    // use this key, so the panel can never show the shipped plan back to the manager.
      var planKey = function (p) { return p.outs.slice().sort(sortNum).join(",") + ">" + p.ins.slice().sort(sortNum).join(","); };
      var bestKey = planKey(best);
      var different = plans.slice(1).filter(function (p) { return planKey(p) !== bestKey; });
      var alt = different.length ? different[0] : null;
      res.margin = alt ? best.value - alt.value : best.value;
      res.alternatives = different.slice(0, 3).map(function (p) { return { value: p.value, k: p.k, hits: p.hits, moves: p.moves.map(function (m) { return { out: m.out, in: m.in, outName: m.outName, inName: m.inName, gain: m.gain }; }) }; });
      var hasForced = best.moves.some(function (m) { return m.forced; });
      /* A forced sell the plan chooses NOT to make has to be named, with its reason, or the
         manager is looking at a squad that still holds a flagged player and nothing on screen
         says why. E-082's rule cuts both ways: selling a starter on a doubt needs the reason on
         screen, and so does keeping one. */
      var keptForced = res.forced.filter(function (f) {
        return best.outs.indexOf(f.id) < 0;
      });
      if (keptForced.length) {
        res.keptForced = keptForced.map(function (f) { return { id: f.id, name: elName(f.id, ctx), reason: f.reason }; });
        res.reasons.push("kept despite the flag, because the swap did not pay: " +
          res.keptForced.map(function (f) { return f.name + " (" + f.reason + ")"; }).join(", "));
      }
      if (res.margin >= MARGIN_HIGH) res.confidence = "HIGH";
      else if (res.margin >= MARGIN_MED) res.confidence = "MED";
      else res.confidence = hasForced ? "LOW" : "hold";
      if (res.confidence === "hold" && best.value <= 0) res.reasons.push("best plan does not beat holding");
      var ship = res.confidence !== "hold";
      if (!ship && hasForced) ship = true;
      if (ship) {
        // E-067: every field that describes the SHIPPED plan is written here and nowhere else.
        // k, hits, value and bankAfter used to be set from the best plan before the ship decision,
        // so a hold week reported "no hit: 3 of your 3 free transfers" on the landing card with an
        // empty list of moves. On a hold nothing is transferred: k and hits are 0, the bank is
        // untouched, and the plan that was considered stays in `alternatives` with its own numbers.
        res.moves = best.moves;
        res.value = best.value; res.hits = best.hits; res.k = best.k; res.bankAfter = best.bankAfter;
        newSquad = squad.filter(function (id) { return best.outs.indexOf(id) < 0; }).concat(best.ins);
        best.moves.forEach(function (m, i) { res.order.push({ step: i + 1, action: "sell", id: m.out, name: m.outName, price: m.priceOut }); });
        best.moves.forEach(function (m, i) { res.order.push({ step: best.moves.length + i + 1, action: "buy", id: m.in, name: m.inName, price: m.priceIn }); });
      } else {
        res.reasons.push("margin " + res.margin.toFixed(2) + " below " + MARGIN_MED + " — hold; best plan kept in alternatives");
        res.alternatives.unshift({ value: best.value, k: best.k, hits: best.hits, moves: best.moves.map(function (m) { return { out: m.out, in: m.in, outName: m.outName, inName: m.inName, gain: m.gain }; }) });
      }
    }
    var bx = bestXI(newSquad, ctx);
    res.captain = bx.capId; res.vice = bx.viceId; res.xi = bx.ids; res.formation = bx.formation;
    if (bx.capId) res.order.push({ step: res.order.length + 1, action: "captain", id: bx.capId, name: ctx.els[bx.capId].web_name });
    if (bx.viceId) res.order.push({ step: res.order.length + 1, action: "vice", id: bx.viceId, name: ctx.els[bx.viceId].web_name });
  } catch (e) { res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}

// ---------------------------------------------------------------- wildcard (C3, C4)

function wcObjective(ids, ctx, tsKey) {
  var r = pickXI(ids, ctx, function (el) { return xp5With(el, ctx, tsKey); });
  if (!r.ok) return -1e9;
  return r.score + WC_BENCH_WEIGHT * sum(r.bench, function (id) { return xp5With(ctx.els[id], ctx, tsKey); });
}
function wcPool(ctx, opts, position) {
  // Eligibility ladder: L0 strict (3 of 3 starts, P(start) >= 0.75, status a) → L1 (2 of 3, 0.5) → L2 (any start) → L3 (status a).
  var levels = [
    function (el, gs, x) { return gs.starts_last3 >= WC_MIN_STARTS3 && x.pstart >= WC_MIN_PSTART; },
    function (el, gs, x) { return gs.starts_last3 >= 2 && x.pstart >= 0.5; },
    function (el, gs, x) { return num(el.starts, 0) >= 1; },
    function () { return true; }
  ];
  if (!okCtx(ctx) || !Array.isArray(ctx.elList) || !SQUAD_SHAPE[position]) return { ids: [], level: 3, exhausted: true };
  if (!isObj(opts)) opts = {};
  var lockSet = {}; arr(opts.locks).forEach(function (id) { lockSet[id] = true; });
  var exclude = {}; arr(opts.exclude).forEach(function (id) { exclude[id] = true; });
  var need = SQUAD_SHAPE[position] + 2;
  for (var L = 0; L < levels.length; L++) {
    if (L > 0 && opts.relax === false) return { ids: [], level: L - 1, exhausted: true };
    var ids = ctx.elList.filter(function (el) {
      if (elType(el) !== position || exclude[el.id]) return false;
      if (lockSet[el.id]) return true;
      var fl = ctx.flags && ctx.flags[el.id] ? ctx.flags[el.id] : flagInfo(el); if (fl.status !== "a") return false;
      var gs = ctx.gwStats[el.id] || { starts_last3: 0 }, x = ctx.xp[el.id];
      if (!levels[L](el, gs, x)) return false;
      if (convergenceRisk(el.id, ctx).risk) return false;
      return true;
    }).map(function (el) { return el.id; });
    if (ids.length >= need) return { ids: ids, level: L, exhausted: false };
  }
  return { ids: [], level: 3, exhausted: true };
}
function wcCost(ids, ctx) {
  if (!okCtx(ctx)) return 0;
  return sum(arr(ids), function (x) { var el = ctx.els[idOf(x)]; return el ? num(el.now_cost, 0) : 0; });
}
function wcSetup(ctx, opts, tsKey) {
  // One place builds the eligible pool, the candidate windows, the locks and the budget that the
  // wildcard search AND any audit of its answer have to share. It used to be inline in wcSolve,
  // so a check of the returned fifteen could only ever test its own private copy of the rules.
  var out = { ok: false, budget: BUDGET_TENTHS, pool: {}, cands: {}, cheap: {}, minCost: {}, locks: [], lockSet: {}, current: {}, relaxed: false, relaxations: [], reasons: [] };
  if (!okCtx(ctx) || !Array.isArray(ctx.elList) || !Array.isArray(ctx.squadIds)) { out.reasons.push("no usable context"); return out; }
  if (!isObj(opts)) opts = {};
  var key = tsKey === "TS_GOALS" ? "TS_GOALS" : "TS";
  out.budget = num(opts.budget, ctx.budget || BUDGET_TENTHS);
  out.locks = uniq(idList(opts.locks)).filter(function (id) { return ctx.els[id]; });
  out.locks.forEach(function (id) { out.lockSet[id] = true; });
  ctx.squadIds.forEach(function (id) { out.current[id] = true; });
  var levelNames = ["3 of 3 starts and P(start) >= 0.75", "2 of 3 starts and P(start) >= 0.5", "any start this season", "status available only"];
  [1, 2, 3, 4].forEach(function (t) {
    var p = wcPool(ctx, opts, t);
    if (p.exhausted) out.reasons.push(POS_NAME[t] + ": pool cannot fill the position");
    if (p.level > 0) { out.relaxed = true; out.relaxations.push(POS_NAME[t] + ": fewer than " + (SQUAD_SHAPE[t] + 2) + " players meet 3 of 3 starts and P(start) >= 0.75; relaxed to " + levelNames[p.level]); }
    out.pool[t] = p.ids.slice().sort(function (a, b) { return xp5With(ctx.els[b], ctx, key) - xp5With(ctx.els[a], ctx, key); });
    out.cands[t] = out.pool[t].slice(0, 30);
    out.locks.forEach(function (id) { if (elType(ctx.els[id]) === t && out.cands[t].indexOf(id) < 0) out.cands[t].unshift(id); });
    out.cheap[t] = out.pool[t].slice().sort(function (a, b) { return num(ctx.els[a].now_cost, 0) - num(ctx.els[b].now_cost, 0); }).slice(0, 8);
    out.minCost[t] = out.pool[t].length ? Math.min.apply(null, out.pool[t].map(function (id) { return num(ctx.els[id].now_cost, 0); })) : 999;
  });
  out.ok = out.reasons.length === 0;
  return out;
}
function wcFeasible(ids, ctx, W) {
  // B3 plus C3: 2-5-5-3 never exceeded, <=3 from a club, <=2 incoming from a club (E-009), and
  // enough budget left to fill the empty slots at the cheapest price in the pool.
  if (!Array.isArray(ids) || !okCtx(ctx) || !isObj(W)) return false;
  if (uniq(ids).length !== ids.length) return false;
  var pc = posCounts(ids, ctx.els);
  if (pc.unknown > 0) return false;
  for (var t = 1; t <= 4; t++) if (pc[t] > SQUAD_SHAPE[t]) return false;
  var cc = clubCounts(ids, ctx.els); for (var c in cc) if (cc[c] > MAX_PER_CLUB) return false;
  var cur = isObj(W.current) ? W.current : {};
  var inc = clubCounts(ids.filter(function (id) { return !cur[id]; }), ctx.els); for (var c2 in inc) if (inc[c2] > MAX_INCOMING_PER_CLUB) return false;
  var mc = isObj(W.minCost) ? W.minCost : {};
  var remaining = 0; for (var t2 = 1; t2 <= 4; t2++) remaining += (SQUAD_SHAPE[t2] - pc[t2]) * num(mc[t2], 999);
  return wcCost(ids, ctx) + remaining <= num(W.budget, BUDGET_TENTHS);
}
function wcSolve(ctx, opts, tsKey) {
  var out = { ok: false, ids: [], cost: 0, score: -1e9, steps: 0, spend: null, relaxed: false, relaxations: [], reasons: [] };
  if (!okCtx(ctx) || !Array.isArray(ctx.elList) || !Array.isArray(ctx.squadIds)) { out.reasons.push("no usable context"); return out; }
  if (!isObj(opts)) opts = {};
  var W = wcSetup(ctx, opts, tsKey);
  out.relaxed = W.relaxed; out.relaxations = W.relaxations.slice();
  if (!W.ok) { out.reasons = W.reasons.slice(); return out; }
  var budget = W.budget, pool = W.pool, cands = W.cands, cheap = W.cheap, locks = W.locks, lockSet = W.lockSet;
  function feasible(list) { return wcFeasible(list, ctx, W); }
  function obj(list) { return wcObjective(list, ctx, tsKey); }
  function priceOf(id) { return num(ctx.els[id].now_cost, 0); }
  // greedy seed by xp5/price
  var ids = locks.slice();
  if (!feasible(ids)) { out.reasons.push("locks are not jointly legal within the budget"); return out; }
  var ratio = [];
  [1, 2, 3, 4].forEach(function (t) { pool[t].forEach(function (id) { if (ids.indexOf(id) < 0) ratio.push({ id: id, r: xp5With(ctx.els[id], ctx, tsKey) / Math.max(1, priceOf(id)) }); }); });
  ratio.sort(function (a, b) { return b.r - a.r; });
  ratio.forEach(function (c) { if (ids.length >= 15) return; var tryIds = ids.concat([c.id]); if (feasible(tryIds)) ids = tryIds; });
  if (ids.length < 15) { out.reasons.push("greedy seed could not fill 15 within the budget"); return out; }
  var score = obj(ids);
  // E-038: the local search used to stop after twelve improvements and only ever looked at the
  // top thirty candidates per position, so "nothing better exists" really meant "nothing better
  // inside the window, if twelve steps were enough". The 1-swap pass now runs to a fixed point
  // over the WHOLE eligible pool; the 2-swap pass keeps its top-12 window because it is
  // quadratic; and a spend-the-bank pair step sells one player down to fund a dearer upgrade
  // elsewhere, which is the only move that can turn an idle bank into points. What comes back is
  // a 1-swap local optimum by construction, and wcLocalOptimum is the proof of it.
  var stepCap = clamp(intOf(opts.maxPasses, 300), 0, 4000);
  var steps = 0, spendTried = 0;
  function step1() {
    var bestIds = null, bestGain = 1e-9;
    for (var i = 0; i < ids.length; i++) {
      if (lockSet[ids[i]]) continue;
      var p = pool[elType(ctx.els[ids[i]])] || [];
      for (var j = 0; j < p.length; j++) {
        var c = p[j]; if (ids.indexOf(c) >= 0) continue;
        var trial = ids.slice(); trial[i] = c;
        if (!feasible(trial)) continue;
        var sc = obj(trial);
        if (sc - score > bestGain) { bestGain = sc - score; bestIds = trial; }
      }
    }
    return bestIds ? { ids: bestIds, gain: bestGain } : null;
  }
  function step2() {
    var bestIds = null, bestGain = 1e-9;
    for (var a = 0; a < ids.length && !bestIds; a++) {
      if (lockSet[ids[a]]) continue;
      var ca = (cands[elType(ctx.els[ids[a]])] || []).slice(0, 12);
      for (var b = a + 1; b < ids.length && !bestIds; b++) {
        if (lockSet[ids[b]]) continue;
        var cb = (cands[elType(ctx.els[ids[b]])] || []).slice(0, 12);
        for (var x = 0; x < ca.length; x++) {
          if (ids.indexOf(ca[x]) >= 0) continue;
          for (var y = 0; y < cb.length; y++) {
            if (ids.indexOf(cb[y]) >= 0 || cb[y] === ca[x]) continue;
            var tr = ids.slice(); tr[a] = ca[x]; tr[b] = cb[y];
            if (!feasible(tr)) continue;
            var s2 = obj(tr);
            if (s2 - score > bestGain) { bestGain = s2 - score; bestIds = tr; }
          }
        }
      }
    }
    return bestIds ? { ids: bestIds, gain: bestGain } : null;
  }
  function stepSpend() {
    var bestIds = null, bestGain = 1e-9;
    for (var a = 0; a < ids.length && !bestIds; a++) {
      if (lockSet[ids[a]]) continue;
      var down = cheap[elType(ctx.els[ids[a]])] || [];
      for (var b = 0; b < ids.length && !bestIds; b++) {
        if (b === a || lockSet[ids[b]]) continue;
        var up = (cands[elType(ctx.els[ids[b]])] || []).slice(0, 10);
        for (var x = 0; x < down.length; x++) {
          if (ids.indexOf(down[x]) >= 0 || priceOf(down[x]) >= priceOf(ids[a])) continue;
          for (var y = 0; y < up.length; y++) {
            if (ids.indexOf(up[y]) >= 0 || up[y] === down[x] || priceOf(up[y]) <= priceOf(ids[b])) continue;
            var tr = ids.slice(); tr[a] = down[x]; tr[b] = up[y];
            if (!feasible(tr)) continue;
            spendTried++;
            var s3 = obj(tr);
            if (s3 - score > bestGain) { bestGain = s3 - score; bestIds = tr; }
          }
        }
      }
    }
    return bestIds ? { ids: bestIds, gain: bestGain } : null;
  }
  var moved = true, m1, m2, m3;
  while (moved && steps < stepCap) {
    moved = false;
    while (steps < stepCap) {
      m1 = step1(); if (!m1) break;
      ids = m1.ids; score += m1.gain; steps++; moved = true;
    }
    if (steps >= stepCap) break;
    m2 = step2();
    if (m2) { ids = m2.ids; score += m2.gain; steps++; moved = true; continue; }
    m3 = stepSpend();
    if (m3) { ids = m3.ids; score += m3.gain; steps++; moved = true; }
  }
  var spent = wcCost(ids, ctx), left = Math.trunc(num(budget, 0) - spent);
  out.ok = true; out.ids = ids; out.cost = spent; out.score = score; out.steps = steps;
  out.spend = { bank: left, pairsTried: spendTried, note: left <= 0 ? "the whole budget is spent" : "no legal swap and no funded upgrade inside the eligible pool raises the objective, so " + left + " tenths stay in the bank" };
  return out;
}
function wcLocalOptimum(ids, ctx, opts) {
  // The only honest acceptance criterion for a local search: a returned fifteen is a local
  // optimum when no single legal swap against the WHOLE eligible pool raises the objective.
  // Same pool, same feasibility and same objective as wcSolve, because they come from wcSetup.
  var res = { ok: false, optimal: false, checked: 0, dearerTried: 0, bestGain: 0, bank: 0, improvements: [], reason: "" };
  try {
    var o = isObj(opts) ? opts : {};
    var tsKey = o.model === "TS_GOALS" ? "TS_GOALS" : "TS";
    if (!okCtx(ctx)) { res.reason = "no context"; return res; }
    var list = uniq(idList(ids)).filter(function (id) { return ctx.els[id]; });
    if (list.length !== 15) { res.reason = "a fifteen is needed, got " + list.length + " known players"; return res; }
    var W = wcSetup(ctx, o, tsKey);
    if (!W.ok) { res.reason = W.reasons.join("; ") || "no eligible pool"; return res; }
    res.bank = Math.trunc(num(W.budget, 0) - wcCost(list, ctx));
    var score = wcObjective(list, ctx, tsKey);
    var found = [];
    for (var i = 0; i < list.length; i++) {
      if (W.lockSet[list[i]]) continue;
      var p = arr(W.pool[elType(ctx.els[list[i]])]);
      for (var j = 0; j < p.length; j++) {
        var c = p[j]; if (list.indexOf(c) >= 0) continue;
        var trial = list.slice(); trial[i] = c;
        if (!wcFeasible(trial, ctx, W)) continue;
        res.checked++;
        if (num(ctx.els[c].now_cost, 0) > num(ctx.els[list[i]].now_cost, 0)) res.dearerTried++;
        var g = wcObjective(trial, ctx, tsKey) - score;
        if (g > 1e-9) found.push({ out: list[i], outName: elName(list[i], ctx), in: c, inName: elName(c, ctx), gain: g });
      }
    }
    found.sort(function (a, b) { return b.gain - a.gain; });
    res.improvements = found.slice(0, 5);
    res.bestGain = found.length ? found[0].gain : 0;
    res.optimal = found.length === 0;
    res.ok = true;
    res.reason = found.length
      ? found.length + " legal single swaps raise the objective; the best is worth " + found[0].gain.toFixed(3)
      : res.checked + " legal single swaps were tested and none raises the objective" + (res.bank > 0 ? ", including " + res.dearerTried + " dearer players the " + res.bank + " tenths in the bank could pay for" : "");
  } catch (e) { res.reason = "engine error: " + errMsg(e); }
  return res;
}
function wildcardSolver(ctx, opts) {
  var res = { ok: false, ids: [], xi: null, cost: 0, bank: 0, score: 0, model: "TS", alt: null, disagreement: null, relaxed: false, relaxations: [], reasons: [], budget: 0, steps: 0, spend: null };
  try {
    if (!okCtx(ctx)) { res.reasons.push("no context"); return res; }
    var o = isObj(opts) ? opts : {};
    var budget = num(o.budget, ctx.budget || BUDGET_TENTHS);
    res.budget = budget;
    var main = wcSolve(ctx, { locks: o.locks, exclude: o.exclude, relax: o.relax, budget: budget, maxPasses: o.maxPasses }, "TS");
    res.relaxed = main.relaxed; res.relaxations = main.relaxations; res.reasons = main.reasons.slice();
    if (!main.ok) return res;
    var alt = (o.model === "TS" || o.both === false) ? null : wcSolve(ctx, { locks: o.locks, exclude: o.exclude, relax: o.relax, budget: budget, maxPasses: o.maxPasses }, "TS_GOALS");
    var mainTs = main.score, mainGoals = wcObjective(main.ids, ctx, "TS_GOALS");
    var chosen = main, model = "TS";
    if (alt && alt.ok) {
      var altTs = wcObjective(alt.ids, ctx, "TS"), altGoals = alt.score;
      var differ = alt.ids.filter(function (id) { return main.ids.indexOf(id) < 0; }).length;
      res.alt = { ids: alt.ids, cost: alt.cost, score: altGoals, scoreTs: altTs, model: "TS_GOALS" };
      res.disagreement = { playersDiffer: differ, main: { ts: mainTs, goals: mainGoals }, alt: { ts: altTs, goals: altGoals }, mainDominates: mainGoals >= altGoals - 1e-9, note: differ === 0 ? "both fixture models agree on the fifteen" : (mainGoals >= altGoals - 1e-9 ? "xG squad is equal-or-better under both models" : "the goals model prefers " + differ + " different players; treat the gap as noise — xG drives, goals explain") };
    }
    res.ok = true; res.ids = chosen.ids; res.cost = chosen.cost; res.bank = budget - chosen.cost; res.score = chosen.score; res.model = model;
    res.steps = chosen.steps; res.spend = chosen.spend;
    res.xi = bestXI(chosen.ids, ctx);
    var L = legal15(chosen.ids, ctx.els, budget); if (!L.ok) { res.ok = false; res.reasons = res.reasons.concat(L.reasons); }
  } catch (e) { res.ok = false; res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function elName(id, ctx) {
  var el = okCtx(ctx) ? ctx.els[id] : null;
  var n = el && el.web_name !== undefined && el.web_name !== null ? String(el.web_name) : "";
  if (n !== "") return n;
  var v = idOf(id);
  return isFinite(v) ? "player " + v : "unknown player";
}
function writtenFifteen(opts) {
  // The written plan lives in the WEEKLY block, which is assembled after the engine in the
  // shipped file. Callers may hand it in (opts.written); when they do not, and a weekly block is
  // in scope, it is read from there. Required either way — the engine never invents a fifteen.
  var given = uniq(idList(isObj(opts) ? opts.written : null));
  if (given.length) return given;
  try {
    if (typeof WEEKLY !== "undefined" && isObj(WEEKLY) && isObj(WEEKLY.classic)) return uniq(idList(WEEKLY.classic.wildcard15));
  } catch (e) { /* the engine also runs standalone, with no weekly block in scope */ }
  return [];
}
function wildcardOptions(ctx, opts) {
  // C1 rule 6 keeps anyone at or above 60% rival ownership out of the solver. When the manager's
  // own written fifteen contains such players, the rule and the plan disagree, and the app has to
  // be able to show the disagreement priced rather than silently shipping one side of it. This
  // returns all three fifteens under one objective; it changes neither wildcardSolver's default
  // answer nor rule C1.6.
  var res = { ok: false, pure: null, locked: null, written: null, locks: [], deltas: null, budget: 0, model: "TS", note: "", reasons: [] };
  try {
    if (!okCtx(ctx)) { res.reasons.push("no context"); return res; }
    var o = isObj(opts) ? opts : {};
    var budget = num(o.budget, ctx.budget || BUDGET_TENTHS);
    res.budget = budget;
    var decaySum = sum(DECAY) || 1;
    var w15 = writtenFifteen(o).filter(function (id) { return ctx.els[id]; });
    // Derived, never a list of ids: the convergent players the written plan itself contains.
    var lockIds = w15.filter(function (id) { return convergenceRisk(id, ctx).risk; });
    res.locks = lockIds.map(function (id) {
      var r = rivalOwnMax(id, ctx);
      return { id: id, web_name: elName(id, ctx), rivalOwn: r.max, league: r.league, now_cost: num(ctx.els[id].now_cost, 0) };
    });
    function variant(label, list, how) {
      var v = { label: label, how: how, ok: false, ids: [], cost: 0, bank: 0, objective: 0, weekly: 0, xi: [], formation: "", captain: null, vice: null, legal: false, reasons: [] };
      var ids = uniq(idList(list)).filter(function (id) { return ctx.els[id]; });
      v.ids = ids;
      if (ids.length !== 15) { v.reasons.push(label + " is " + ids.length + " known players, not fifteen"); return v; }
      var L = legal15(ids, ctx.els, budget);
      v.legal = L.ok; v.cost = L.cost; v.bank = Math.trunc(budget - L.cost);
      if (!L.ok) v.reasons = v.reasons.concat(L.reasons);
      v.objective = wcObjective(ids, ctx, "TS");
      v.weekly = v.objective / decaySum;
      var bx = bestXI(ids, ctx);
      v.xi = bx.ids; v.formation = bx.formation; v.captain = bx.capId; v.vice = bx.viceId;
      v.ok = true;
      return v;
    }
    function gap(a, b) {
      if (!a || !b || !a.ok || !b.ok) return null;
      var onlyA = a.ids.filter(function (id) { return b.ids.indexOf(id) < 0; });
      var onlyB = b.ids.filter(function (id) { return a.ids.indexOf(id) < 0; });
      return {
        objective: a.objective - b.objective, weekly: a.weekly - b.weekly,
        cost: a.cost - b.cost, bank: a.bank - b.bank, playersDiffer: onlyA.length,
        gained: onlyA.map(function (id) { return { id: id, web_name: elName(id, ctx), now_cost: num(ctx.els[id].now_cost, 0) }; }),
        given: onlyB.map(function (id) { return { id: id, web_name: elName(id, ctx), now_cost: num(ctx.els[id].now_cost, 0) }; })
      };
    }
    var pureSolve = wildcardSolver(ctx, { budget: budget, both: false, relax: o.relax, exclude: o.exclude, maxPasses: o.maxPasses });
    if (!pureSolve.ok) { res.reasons = res.reasons.concat(pureSolve.reasons); return res; }
    res.pure = variant("rule-pure", pureSolve.ids, "solved with C1 rule 6 in force: nobody at or above 60% rival ownership");
    var lockedSolve = lockIds.length ? wildcardSolver(ctx, { budget: budget, both: false, locks: lockIds, relax: o.relax, exclude: o.exclude, maxPasses: o.maxPasses }) : pureSolve;
    if (lockedSolve.ok) {
      res.locked = variant("premiums locked", lockedSolve.ids, lockIds.length
        ? "same solve with " + lockIds.map(function (id) { return elName(id, ctx); }).join(", ") + " locked in — the convergent players the written plan already carries"
        : "no convergent player in the written fifteen, so this is the rule-pure solve");
    } else {
      res.reasons = res.reasons.concat(lockedSolve.reasons);
    }
    res.written = variant("written plan", w15, w15.length ? "the manager's own fifteen, scored under the same objective" : "no written fifteen was supplied");
    res.deltas = {
      lockedVsPure: gap(res.locked, res.pure),
      writtenVsPure: gap(res.written, res.pure),
      writtenVsLocked: gap(res.written, res.locked)
    };
    var d = res.deltas.lockedVsPure;
    res.note = lockIds.length === 0
      ? "No player in the written fifteen is 60% rival-owned, so the rule and the plan agree and all three fifteens are the same solve."
      : "Rule C1.6 keeps " + lockIds.length + " of the written fifteen out of the solver (" + res.locks.map(function (l) { return l.web_name + " " + Math.round(l.rivalOwn * 100) + "%"; }).join(", ") +
        "). Locking them in is worth " + (d ? (d.objective >= 0 ? "+" : "") + d.objective.toFixed(2) + " over five gameweeks and spends " + (d.cost >= 0 ? "" : "") + d.cost + " tenths more" : "a figure the solver could not produce") +
        ". The rule protects mini-league rank against the field; the points say the opposite. Both are on the table, priced.";
    res.ok = true;
  } catch (e) { res.reasons.push("engine error: " + errMsg(e)); }
  return res;
}
function wildcardTiming(ctx) {
  var res = { gw: 0, weeklyGap: 0, swapsNeeded: 0, currentWeekly: 0, bestWeekly: 0, horizons: [], grid: [], breakeven: { byGw19: null, byGw38: null }, wcTrigger: WC_TRIGGER, sumDeficit5: 0, saturated: { saturates: false, weeks: 0, gw: 0, note: "" }, note: "" };
  try {
    if (!okCtx(ctx)) return res;
    res.gw = ctx.nextEvent;
    var decaySum = sum(DECAY);
    var cur = ctx.squadIds.length === 15 ? ctx.squadIds : [];
    var wc = wildcardSolver(ctx, { both: false });
    if (!wc.ok) { res.note = "wildcard solver could not build a squad: " + wc.reasons.join("; "); return res; }
    var curObj = cur.length ? wcObjective(cur, ctx, "TS") : 0;
    res.currentWeekly = curObj / decaySum; res.bestWeekly = wc.score / decaySum;
    res.weeklyGap = Math.max(0, res.bestWeekly - res.currentWeekly);
    res.swapsNeeded = cur.length ? wc.ids.filter(function (id) { return cur.indexOf(id) < 0; }).length : 15;
    res.sumDeficit5 = Math.max(0, wc.score - curObj);
    var perFix = res.swapsNeeded ? res.weeklyGap / res.swapsNeeded : 0;
    function sumDeficit(T, mult) { var s = 0; for (var t = 0; t < T; t++) s += Math.max(0, res.weeklyGap * mult - t * perFix * mult); return s; }
    // E-042: the two headline horizons were a gameweek out of step with each other — the GW19
    // window excluded GW19 while the GW38 window included GW38 — and then printed the same total
    // with nothing to say why. Both windows are inclusive of their end gameweek now, and
    // `saturated` names the gameweek after which the deficit stops growing because the free
    // transfers have already made every swap. Two equal totals are a property, not a coincidence.
    var toGw19 = Math.max(0, 19 - ctx.nextEvent + 1), toGw38 = Math.max(0, 38 - ctx.nextEvent + 1);
    [5, toGw19, toGw38].forEach(function (T, i) { res.horizons.push({ label: ["5 GWs", "to GW19 (set 1 expiry)", "to GW38"][i], weeks: T, gw: ctx.nextEvent + T - 1, sumDeficit: sumDeficit(T, 1) }); });
    var satWeeks = perFix > 1e-12 ? Math.ceil(res.weeklyGap / perFix - 1e-9) : 0;
    if (!isFinite(satWeeks) || satWeeks < 0) satWeeks = 0;
    res.saturated = {
      saturates: satWeeks > 0 && satWeeks <= toGw38,
      weeks: satWeeks,
      gw: satWeeks > 0 ? res.gw + satWeeks - 1 : res.gw,
      note: satWeeks > 0
        ? "The deficit stops growing after GW" + (res.gw + satWeeks - 1) + ": by then the free transfers have made all " + res.swapsNeeded + " swaps at one a week, so every horizon past that gameweek reports the same total."
        : "Current squad and wildcard squad are the same fifteen, so there is no deficit to accumulate."
    };
    [0.5, 0.75, 1, 1.25, 1.5].forEach(function (m) {
      [0, 10, 20, 30, 45, 60].forEach(function (later) {
        res.grid.push({ deficitMult: m, laterValue: later, nowAdvantageBy: { gw19: sumDeficit(toGw19, m) - later, gw38: sumDeficit(toGw38, m) - later } });
      });
    });
    res.breakeven.byGw19 = sumDeficit(toGw19, 1); res.breakeven.byGw38 = sumDeficit(toGw38, 1);
    res.note = "Now-advantage = cumulative weekly deficit of the current squad against the wildcard squad, declining as free transfers fix it at one a week, minus the value of a later window. A later window worth more than " + res.breakeven.byGw19.toFixed(0) + " by GW19 would beat playing it now; none is confirmed in the fixture list.";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- chips (C1 rule 5, F8)

function chipWindows(live) {
  var res = { doubles: [], blanks: [], recommendation: { bb: null, tc: null, fh: null, wc: "see wildcardTiming", note: "" }, nextEvent: 0 };
  try {
    if (!isObj(live)) return res;
    var teams = arr(live.teams).filter(isObj).map(function (t) { return t.id; });
    var nextEv = intOf(live.next_event, 0);
    var events = arr(live.events).filter(isObj).map(function (e) { return intOf(e.id, 0); }).filter(function (e) { return e >= nextEv; });
    var counts = {};
    arr(live.fixtures).forEach(function (f) { if (!isObj(f)) return; var ev = intOf(f.event, -1); if (ev < nextEv) return; counts[ev] = counts[ev] || {}; counts[ev][f.team_h] = (counts[ev][f.team_h] || 0) + 1; counts[ev][f.team_a] = (counts[ev][f.team_a] || 0) + 1; });
    res.nextEvent = nextEv;
    events.forEach(function (ev) {
      var c = counts[ev] || {}; var total = 0; Object.keys(c).forEach(function (t) { total += c[t]; });
      if (total === 0) return;                                   // unscheduled event: no evidence either way
      var dbl = teams.filter(function (t) { return (c[t] || 0) >= 2; }), blank = teams.filter(function (t) { return !(c[t] || 0); });
      if (dbl.length) res.doubles.push({ event: ev, teams: dbl, n: dbl.length, confirmed: true });
      if (blank.length) res.blanks.push({ event: ev, teams: blank, n: blank.length, confirmed: true });
    });
    if (res.doubles.length) { var big = res.doubles.slice().sort(function (a, b) { return b.n - a.n || a.event - b.event; })[0]; res.recommendation.bb = big.event; res.recommendation.tc = big.event; }
    if (res.blanks.length) { var deep = res.blanks.slice().sort(function (a, b) { return b.n - a.n || a.event - b.event; })[0]; res.recommendation.fh = deep.event; }
    res.recommendation.note = (res.doubles.length || res.blanks.length) ? "Windows are read from the fixture list as published; a double or blank only counts once the fixtures are scheduled." : "No double or blank gameweek is scheduled in the fixture list yet; Bench Boost, Triple Captain and Free Hit wait for a confirmed window.";
  } catch (e) { res.recommendation.note = "engine error: " + errMsg(e); }
  return res;
}
function chipRegret(chip, ctx, opts) {
  var res = { chip: String(chip || "").toUpperCase(), useNow: 0, bestLater: 0, laterEvent: null, regretUse: 0, regretHold: 0, verdict: "no window", note: "" };
  try {
    if (!okCtx(ctx)) return res;
    var o = isObj(opts) ? opts : {};
    var windows = chipWindows(ctx.live);
    var squad = uniq(idList(o.ids && o.ids.length ? o.ids : ctx.squadIds)).filter(function (id) { return ctx.els[id]; });
    var bx = squad.length >= 11 ? bestXI(squad, ctx) : { ids: [], capId: null, bench: [] };
    var capXp = bx.capId ? ctx.xp[bx.capId].xp1 : 0;
    var benchXp = sum(bx.bench, function (id) { return ctx.xp[id].xp1; });
    var dbl = windows.doubles[0] || null, blank = windows.blanks[0] || null;
    if (res.chip === "TC") { res.useNow = capXp; res.bestLater = dbl ? 2 * capXp : 0; res.laterEvent = dbl ? dbl.event : null; }
    else if (res.chip === "BB") { res.useNow = benchXp; res.bestLater = dbl ? 2 * benchXp : 0; res.laterEvent = dbl ? dbl.event : null; }
    else if (res.chip === "FH") { var wc = wildcardSolver(ctx, { both: false }); res.useNow = wc.ok && bx.ids.length ? Math.max(0, (wc.xi ? wc.xi.score : 0) - bx.score) : 0; res.bestLater = blank ? blank.n / 20 * 11 * (bx.score / 11 || 0) : 0; res.laterEvent = blank ? blank.event : null; }
    else if (res.chip === "WC") { var tm = ctx._chipWcTiming || (ctx._chipWcTiming = wildcardTiming(ctx)); res.useNow = tm.breakeven.byGw19 || 0; res.bestLater = num(o.laterValue, 0); res.laterEvent = o.laterEvent === undefined ? null : o.laterEvent; }
    else { res.note = "unknown chip"; return res; }
    res.regretUse = Math.max(0, res.bestLater - res.useNow); res.regretHold = Math.max(0, res.useNow - res.bestLater);
    if (res.laterEvent === null && res.chip !== "WC") { res.verdict = res.useNow > 0 && res.chip === "WC" ? "use" : "no window"; res.note = "No confirmed later window in the fixture list; expected regret of holding is the single-GW value forgone, of using it is unknown until a window is scheduled."; }
    else res.verdict = res.regretUse > res.regretHold ? "hold" : "use";
    if (res.chip === "WC") res.verdict = res.useNow >= WC_TRIGGER && res.useNow >= res.bestLater ? "use" : (res.useNow < WC_TRIGGER ? "hold" : "hold");
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- draft (C5)

function draftEl(code, ctx) {
  if (!okCtx(ctx)) return null;
  var c = num(code, NaN); if (!isFinite(c)) return null;
  var cls = ctx.byCode[c] || null, dr = ctx.draft.byCode[c] || null;
  if (!cls && !dr) return null;
  return { code: c, classic: cls, draft: dr, id: cls ? cls.id : null, web_name: (cls || dr).web_name, team: (cls || dr).team, element_type: elType(cls || dr), status: (dr || cls).status, chance: (dr || cls).chance === undefined ? null : (dr || cls).chance };
}
function draftEV(rec, ctx) {
  if (!rec || !rec.classic) return { ev: 0, xp5: 0, pstart: 0, starts_last3: 0 };
  var x = ctx.xp[rec.classic.id] || { xp5: 0, pstart: 0 };
  var gs = ctx.gwStats[rec.classic.id] || { starts_last3: 0 };
  var fl = flagInfo(rec.draft || rec.classic);
  var p = fl.flagged ? x.pstart * (fl.factor / Math.max(1e-6, (ctx.flags[rec.classic.id] || fl).factor)) : x.pstart;
  return { ev: x.xp5 * clamp(p, 0, 1), xp5: x.xp5, pstart: clamp(p, 0, 1), starts_last3: gs.starts_last3, flagged: fl.flagged, status: fl.status };
}
function draftWaivers(state, ctx) {
  var out = [];
  try {
    if (!okCtx(ctx)) return out;
    var st = state === undefined || state === null ? ctx.state : sanitiseState(state);
    var rosterInfo = draftRoster(state, ctx);
    var roster = rosterInfo.codes;
    var mine = {}; roster.forEach(function (c) { mine[c] = true; });
    var taken = {}; arr(isObj(state) && state.draft ? state.draft.taken : null).forEach(function (c) { taken[num(c, NaN)] = true; });
    var rosterRecs = roster.map(function (c) { return draftEl(c, ctx); }).filter(Boolean);
    var fa = {};
    [1, 2, 3, 4].forEach(function (t) { fa[t] = []; });
    // With a league id the pool is the league's real free agents; without one it is every
    // player not on the saved roster, which is an ordering and not a list — the two paths
    // are named on every claim so the app can never present the second as the first.
    var pool = draftPool(ctx);
    // The switch is whether a league's ownership is loaded, not whether the pool came back
    // non-empty: a real league with nothing worth claiming must not silently fall back to
    // the assumed ordering over every player in the game.
    var poolSource = ctx.draft.hasPool ? "api" : "assumed";
    if (poolSource === "api") {
      pool.forEach(function (p) {
        if (mine[p.code] || taken[p.code]) return;
        if (p.status !== "a" || p.starts_last3 === 0) return;
        var rec = draftEl(p.code, ctx); if (!rec || !rec.classic) return;
        fa[rec.element_type].push({ rec: rec, ev: draftEV(rec, ctx) });
      });
    } else {
      Object.keys(ctx.draft.byCode).forEach(function (c) {
        var rec = draftEl(c, ctx); if (!rec || mine[rec.code] || taken[rec.code] || !rec.classic) return;
        if (rec.status !== "a") return;
        var ev = draftEV(rec, ctx); if (ev.starts_last3 === 0) return;
        fa[rec.element_type].push({ rec: rec, ev: ev });
      });
    }
    [1, 2, 3, 4].forEach(function (t) { fa[t].sort(function (a, b) { return b.ev.ev - a.ev.ev; }); });
    var used = {};
    function bestFA(t) { for (var i = 0; i < fa[t].length; i++) if (!used[fa[t][i].rec.code]) return fa[t][i]; return null; }
    var claims = [];
    rosterRecs.forEach(function (r) {
      var ev = draftEV(r, ctx);
      var why = null;
      if (r.status !== "a") why = "unavailable (status " + r.status + ")";
      else if (ev.starts_last3 === 0) why = "no starts in the last 3";
      if (!why) return;
      var b = bestFA(r.element_type); if (!b) return;
      used[b.rec.code] = true;
      claims.push({ out: r.code, in: b.rec.code, outName: r.web_name, inName: b.rec.web_name, evOut: ev.ev, evIn: b.ev.ev, gain: b.ev.ev - ev.ev, why: why, forced: true, pool: poolSource, roster: rosterInfo.source });
    });
    // C5: forced replacements go in first, but within that group the claim order is still
    // the gain — a waiver list is submitted in priority order and the biggest gain has to
    // survive the rivals' claims. (Caught by smoke_wk "draft claims forced replacements first".)
    claims.sort(function (a, b) { return b.gain - a.gain; });
    var upgrades = [];
    rosterRecs.forEach(function (r) {
      if (claims.some(function (c) { return c.out === r.code; })) return;
      var ev = draftEV(r, ctx);
      var b = bestFA(r.element_type); if (!b) return;
      var gain = b.ev.ev - ev.ev;
      if (gain > 0.5) upgrades.push({ out: r.code, in: b.rec.code, outName: r.web_name, inName: b.rec.web_name, evOut: ev.ev, evIn: b.ev.ev, gain: gain, why: "upgrade: EV " + b.ev.ev.toFixed(1) + " vs " + ev.ev.toFixed(1), forced: false, pool: poolSource, roster: rosterInfo.source });
    });
    upgrades.sort(function (a, b) { return b.gain - a.gain; });
    var seen = {};
    upgrades.forEach(function (u) { if (seen[u.in]) return; seen[u.in] = true; claims.push(u); });
    claims.forEach(function (c, i) { c.priority = i + 1; out.push(c); });
  } catch (e) { /* total */ }
  return out;
}
function watchlistAudit(codes, ctx) {
  var res = { keep: [], drop: [], unknown: [], detail: [] };
  try {
    if (!okCtx(ctx)) return res;
    uniq(arr(codes).map(function (c) { return num(c, NaN); }).filter(isFinite)).forEach(function (c) {
      var rec = draftEl(c, ctx);
      if (!rec || !rec.classic) { res.unknown.push(c); res.detail.push({ code: c, name: null, starts_last3: null, verdict: "unknown" }); return; }
      var gs = ctx.gwStats[rec.classic.id] || { starts_last3: 0 };
      var keep = gs.starts_last3 >= 3 && rec.status === "a";
      (keep ? res.keep : res.drop).push(c);
      res.detail.push({ code: c, id: rec.classic.id, name: rec.web_name, starts_last3: gs.starts_last3, status: rec.status, verdict: keep ? "KEEP" : "DROP" });
    });
  } catch (e) { /* total */ }
  return res;
}
function draftXIBase(codes, ctx, valueOf) {
  var res = { codes: [], ids: [], benchIds: [], formation: "", score: 0, gk: null, def: [], mid: [], fwd: [], bench: [] };
  try {
    if (!okCtx(ctx)) return res;
    var recs = uniq(arr(codes).map(function (c) { return num(c, NaN); }).filter(isFinite)).map(function (c) { return draftEl(c, ctx); }).filter(function (r) { return r && r.classic; });
    var ids = recs.map(function (r) { return r.classic.id; });
    var codeOf = {}; recs.forEach(function (r) { codeOf[r.classic.id] = r.code; });
    var score = typeof valueOf === "function" ? valueOf : function (el) { return ctx.xp[el.id] ? ctx.xp[el.id].xp1 : xp1(el, ctx); };
    var r = pickXI(ids, ctx, score);
    if (!r.ok) return res;
    res.ids = r.ids; res.codes = r.ids.map(function (id) { return codeOf[id]; }); res.formation = r.formation; res.score = r.score;
    res.benchIds = r.bench.slice();
    res.bench = r.bench.map(function (id) { return codeOf[id]; });
    r.ids.forEach(function (id) { var t = elType(ctx.els[id]); if (t === 1) res.gk = codeOf[id]; else if (t === 2) res.def.push(codeOf[id]); else if (t === 3) res.mid.push(codeOf[id]); else res.fwd.push(codeOf[id]); });
  } catch (e) { /* total */ }
  return res;
}

/* C5 head-to-head XI. The eleven is the highest expected points unless this week's
   opponent is known and the projections separate: behind, the tilt is towards ceiling;
   ahead, towards floor. The tilt is kept only when it actually improves the statistic
   that matters (the top tenth when behind, the bottom tenth when ahead), and the answer
   always says which way it leaned and by how much. */
function draftXI(codes, ctx, opts) {
  var res = draftXIBase(codes, ctx);
  res.lean = "none"; res.tilted = false; res.tiltChangedXI = false; res.h2h = null; res.note = "";
  try {
    if (!okCtx(ctx) || !res.ids.length) return res;
    var o = isObj(opts) ? opts : {};
    if (o.h2h === false) { res.note = "highest expected points"; return res; }
    var proj = isObj(o.projection) ? o.projection : h2hProjection(ctx, { codes: codes, gw: o.gw, iters: o.iters });
    res.h2h = proj;
    if (!proj.ok) { res.note = "no opponent projection, so the eleven is the highest expected points"; return res; }
    if (proj.lean === "level") { res.note = "the two projections are level, so the eleven is the highest expected points"; return res; }
    var up = proj.lean === "up", k = 0.5, spread = {};
    var tilt = draftXIBase(codes, ctx, function (el) {
      var sp = spread[el.id];
      if (!sp) { sp = playerSpread(el, ctx, MC_SPREAD_ITERS, 3000 + intOf(el.id, 1)); spread[el.id] = sp; }
      var base = ctx.xp[el.id] ? ctx.xp[el.id].xp1 : xp1(el, ctx);
      return base + (up ? k : -k) * sp.sd;
    });
    if (!tilt.ids.length) { res.note = "the variance tilt made no legal eleven, so the highest expected points stands"; return res; }
    var iters = clamp(intOf(o.iters, MC_DRAFT_ITERS), MC_MIN_ITERS, 20000);
    var a = mcDraftXI(res.ids, res.benchIds, ctx, iters, 21);
    var b = mcDraftXI(tilt.ids, tilt.benchIds, ctx, iters, 21);
    if (!a.ok || !b.ok) { res.note = "the tilt could not be simulated, so the highest expected points stands"; return res; }
    var statA = up ? a.q90 : a.q10, statB = up ? b.q90 : b.q10;
    var word = up ? "top tenth " : "bottom tenth ";
    res.lean = proj.lean;
    if (statB > statA) {
      var sameXI = res.ids.slice().sort(sortNum).join(",") === tilt.ids.slice().sort(sortNum).join(",");
      res.codes = tilt.codes; res.ids = tilt.ids; res.benchIds = tilt.benchIds; res.bench = tilt.bench;
      res.formation = tilt.formation; res.score = tilt.score;
      res.gk = tilt.gk; res.def = tilt.def; res.mid = tilt.mid; res.fwd = tilt.fwd;
      res.tilted = true; res.tiltChangedXI = !sameXI;
      res.note = (up ? "behind on the projection, so the team leans to the higher ceiling" : "ahead on the projection, so the team leans to the steadier floor") +
        (sameXI ? " — the same eleven with the bench reordered: " : " — the eleven changes: ") +
        word + statB.toFixed(1) + " against " + statA.toFixed(1) + " for the highest-expected-points side";
    } else {
      res.note = (up ? "behind on the projection, but no higher-ceiling eleven beat the highest-expected-points one: " : "ahead on the projection, but no steadier eleven beat the highest-expected-points one: ") +
        word + statB.toFixed(1) + " against " + statA.toFixed(1);
    }
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- draft league (C5 · F2)

/* The manager types one thing: what he sees when he opens the league in the draft app.
   That can be the whole address, the league number on its own, or his own entry number.
   A bare number is ambiguous, so this parser never pretends to know which it is — the
   fetcher tries it as a league first and then as an entry, and says which one answered. */
function draftLeagueInput(text) {
  var res = { ok: false, kind: null, id: null, note: "" };
  try {
    var s = String(text === undefined || text === null ? "" : text).trim();
    if (!s) { res.note = "nothing typed"; return res; }
    if (s.length > 400) { res.note = "too long to be a league id or a league address"; return res; }
    var low = s.toLowerCase();
    var kind = null, m = /\/entry\/(\d+)/.exec(low);
    if (m) kind = "entry";
    else { m = /\/leagues?\/(\d+)/.exec(low); if (m) kind = "league"; }
    if (!m) { m = /(\d+)/.exec(low); if (m) kind = "unknown"; }
    if (!m) { res.note = "there is no number in that"; return res; }
    if (m[1].length > 9) { res.note = "that number is too long to be a draft id"; return res; }
    var id = intOf(m[1], 0);
    if (id <= 0) { res.note = "a draft id is a positive number"; return res; }
    res.ok = true; res.kind = kind; res.id = id;
    res.note = kind === "entry" ? "read as a draft entry id; the league comes from that entry"
      : kind === "league" ? "read as a draft league id"
        : "a bare number: tried as a league first, then as an entry";
  } catch (e) { res.note = errMsg(e); }
  return res;
}

/* Who owns what, by CODE. The draft API answers on draft element ids, which differ from
   the classic ids for 59 of 655 players (E-026); the snapshot resolves them to codes
   before they ever reach here. owner null means nobody has him. */
function draftOwnership(ctx) {
  var res = { ok: false, byCode: {}, owners: {}, entries: 0, ownedCount: 0, unownedCount: 0, poolCount: 0, unjoined: 0, note: "" };
  try {
    if (!okCtx(ctx)) { res.note = "no context"; return res; }
    var own = isObj(ctx.draft.ownership) ? ctx.draft.ownership : {};
    var keys = Object.keys(own);
    if (!keys.length) { res.note = (ctx.draft.note ? ctx.draft.note + ", so " : "") + "the free-agent pool is unknown"; return res; }
    keys.forEach(function (k) {
      var c = intOf(k, 0); if (!c) return;
      var row = isObj(own[k]) ? own[k] : {};
      var owner = intOf(row.owner, 0) || null, status = String(row.status || "");
      res.byCode[c] = { owner: owner, status: status };
      if (owner) { res.ownedCount++; (res.owners[owner] = res.owners[owner] || []).push(c); }
      else { res.unownedCount++; if (status === "a") res.poolCount++; }
      if (!ctx.byCode[c]) res.unjoined++;
    });
    Object.keys(res.owners).forEach(function (o) { res.owners[o].sort(sortNum); });
    res.entries = ctx.draft.entries.length;
    res.ok = true;
    res.note = res.ownedCount + " owned across " + res.entries + " teams, " + res.unownedCount +
      " unowned of which " + res.poolCount + " carry draft status a";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

/* The real free-agent pool: owner null AND draft status "a". Ranked by EV = xp5 x P(start),
   with the C5 watchlist rule (three starts of the last three) carried as a flag rather than
   a filter — the rule governs the watchlist, and a forward pool with no three-start player
   in it is a fact the manager has to see, not one to hide. Empty when no league is known. */
function draftPool(ctx, opts) {
  var out = [];
  try {
    if (!okCtx(ctx)) return out;
    var o = isObj(opts) ? opts : {};
    var minStarts = o.minStarts === undefined ? WC_MIN_STARTS3 : clamp(intOf(o.minStarts, WC_MIN_STARTS3), 0, 3);
    var own = isObj(ctx.draft.ownership) ? ctx.draft.ownership : {};
    var ownKeys = Object.keys(own);
    // The pool is DERIVED from ownership — owner null and element-status "a" — rather than
    // read off the snapshot's freeAgents list, so a wrong list cannot put a player somebody
    // owns in front of the manager. freeAgents is used only when there is no ownership at all.
    var codes = ownKeys.length
      ? ownKeys.filter(function (k) { return !intOf(own[k].owner, 0) && String(own[k].status) === "a"; }).map(function (k) { return intOf(k, 0); })
      : arr(ctx.draft.freeAgents);
    if (!codes.length) return out;
    codes.forEach(function (c) {
      var code = intOf(c, 0); if (!code) return;
      var o2 = own[code];
      var rec = draftEl(code, ctx); if (!rec || !rec.classic) return;
      var ev = draftEV(rec, ctx);
      // Two different "a"s: poolStatus is the league's element-status (is he claimable),
      // status is the player's own fitness. A free agent can be claimable and injured.
      out.push({
        code: rec.code, id: rec.classic.id, web_name: rec.web_name, team: rec.team,
        element_type: rec.element_type, status: rec.status, poolStatus: o2 ? String(o2.status) : "a", chance: rec.chance,
        starts_last3: ev.starts_last3, pstart: ev.pstart, xp5: ev.xp5, ev: ev.ev,
        eligible: ev.starts_last3 >= minStarts && rec.status === "a"
      });
    });
    out.sort(function (a, b) { return (Number(b.eligible) - Number(a.eligible)) || (b.ev - a.ev) || (a.code - b.code); });
  } catch (e) { /* total */ }
  return out;
}

function draftRosterOf(leagueEntryId, ctx) {
  var out = [];
  try {
    if (!okCtx(ctx)) return out;
    var lid = intOf(leagueEntryId, 0); if (!lid) return out;
    var r = ctx.draft.rosters[lid];
    if (Array.isArray(r) && r.length) return r.slice();
    var own = isObj(ctx.draft.ownership) ? ctx.draft.ownership : {};
    Object.keys(own).forEach(function (k) { if (intOf(own[k].owner, 0) === lid) out.push(intOf(k, 0)); });
    out.sort(sortNum);
  } catch (e) { /* total */ }
  return out;
}

function draftRivalRosters(ctx) {
  var out = [];
  try {
    if (!okCtx(ctx)) return out;
    var meId = ctx.draft.me ? ctx.draft.me.leagueEntryId : null;
    ctx.draft.entries.forEach(function (e) {
      if (meId && e.leagueEntryId === meId) return;
      var codes = draftRosterOf(e.leagueEntryId, ctx);
      var ids = [];
      codes.forEach(function (c) { var r = draftEl(c, ctx); if (r && r.classic) ids.push(r.classic.id); });
      out.push({
        leagueEntryId: e.leagueEntryId, entryId: e.entryId, name: e.name,
        waiverPick: e.waiverPick, codes: codes, ids: ids
      });
    });
  } catch (e) { /* total */ }
  return out;
}

/* Waiver claim order as the league API reports it (league_entries[].waiver_pick). A team
   the API gives no pick number sits last rather than first. */
function waiverOrder(ctx) {
  var res = { ok: false, order: [], size: 0, mine: null, note: "" };
  try {
    if (!okCtx(ctx)) { res.note = "no context"; return res; }
    var entries = ctx.draft.entries;
    if (!entries.length) { res.note = ctx.draft.note || "no draft league"; return res; }
    var meId = ctx.draft.me ? ctx.draft.me.leagueEntryId : null;
    var rows = entries.map(function (e) {
      return { leagueEntryId: e.leagueEntryId, name: e.name, waiverPick: e.waiverPick, mine: !!meId && e.leagueEntryId === meId, position: 0 };
    });
    rows.sort(function (a, b) {
      var pa = a.waiverPick === null ? Infinity : a.waiverPick, pb = b.waiverPick === null ? Infinity : b.waiverPick;
      return (pa - pb) || (a.leagueEntryId - b.leagueEntryId);
    });
    rows.forEach(function (r, i) { r.position = i + 1; });
    res.order = rows; res.size = rows.length; res.ok = true;
    var mine = rows.filter(function (r) { return r.mine; })[0];
    res.mine = mine ? { leagueEntryId: mine.leagueEntryId, position: mine.position, waiverPick: mine.waiverPick, of: rows.length } : null;
    res.note = mine ? "you claim " + mine.position + " of " + rows.length : "the league is known but which team is yours is not";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

/* How this league actually settles waivers, inferred from its own transaction log and then
   proved against it (v110 §4 Draft, §5 B6; qa/waiver_log.cjs replays 74 of 74).

   The game documents none of this, so every rule below is one the log forced:

     1. Claims settle in ROUNDS, not in one pass. Each round visits managers in waiver order,
        and a manager keeps trying their own claims, in the order they lodged them, until one
        LANDS. So your first success beats everyone behind you, and your k-th success comes
        after everyone ahead of you has had k and everyone behind you k−1.
     2. "Already claimed" is checked BEFORE "drop already gone". Both can be true of the same
        claim, and the game reports the first. Checking them the other way round scores 72 of
        74 on this log, which is how the order was established (ERRORS.md E-089).
     3. Nobody moves to the bottom after a success. A league that rotated priority would settle
        the same claims in a different order, and the log says it does not.
     4. A failed claim is consumed. It is not retried in a later round.

   Pure and context-free on purpose: it takes the claim lists and the order, so the suite can
   drive it straight off a recorded log, and so a claims sheet can be simulated under several
   orderings without a context at all.

   `claimsByOwner`  { ownerKey: [{add, drop}, …] } in lodged order. ownerKey is whatever the
                    caller keys by — a league-entry id, an entry id, anything comparable.
   `order`          [ownerKey] in processing order.
   `opts.maxRounds` a safety bound, default 12: no manager in an 8-team league can land more
                    than a roster's worth, and an unbounded loop in a renderer is a hang.
   `opts.denyOrder` / `rotate` / `stopOnFail` / `reverseOrder` exist ONLY so the suite can break
                    one rule at a time and show the fit gets worse. Production never passes them.
*/
function waiverSim(claimsByOwner, order, opts) {
  var res = { ok: false, log: [], taken: [], rounds: 0, note: "" };
  try {
    var o = isObj(opts) ? opts : {};
    var maxRounds = intOf(o.maxRounds, 0) || 12;
    var seq = arr(order).slice();
    if (o.reverseOrder) seq.reverse();
    var lists = {};
    seq.forEach(function (k) {
      lists[k] = arr(isObj(claimsByOwner) ? claimsByOwner[k] : null)
        .filter(isObj)
        .map(function (c) { return { add: c.add, drop: c.drop }; });
    });
    if (!seq.length) { res.note = "no claim order"; res.ok = true; return res; }

    var at = {}, dropped = {}, taken = {};
    seq.forEach(function (k) { at[k] = 0; dropped[k] = {}; });

    for (var round = 1; round <= maxRounds; round++) {
      var landed = false;
      res.rounds = round;
      for (var i = 0; i < seq.length; i++) {
        var who = seq[i], L = lists[who] || [];
        while (at[who] < L.length) {
          var c = L[at[who]++];
          if (!c) continue;
          var gone = Object.prototype.hasOwnProperty.call(taken, String(c.add));
          var lost = Object.prototype.hasOwnProperty.call(dropped[who], String(c.drop));
          // Rule 2. The mutation swaps which of the two the game is told to report.
          var first = o.denyOrder === "dropFirst"
            ? (lost ? "drop already gone" : (gone ? "already claimed" : ""))
            : (gone ? "already claimed" : (lost ? "drop already gone" : ""));
          if (first) {
            res.log.push({ round: round, who: who, add: c.add, drop: c.drop, ok: false, why: first });
            if (o.stopOnFail) break;          // mutation: one attempt per manager per round
            continue;
          }
          taken[String(c.add)] = true;
          dropped[who][String(c.drop)] = true;
          res.log.push({ round: round, who: who, add: c.add, drop: c.drop, ok: true, why: "" });
          landed = true;
          break;
        }
      }
      // Rule 3. The mutation is a league that sends a successful claimant to the back.
      if (o.rotate && landed) seq.push(seq.shift());
      if (!landed) break;
    }

    res.taken = Object.keys(taken).map(function (k) { return num(k, k); });
    res.ok = true;
    res.note = res.log.length + " claim(s) settled over " + res.rounds + " round(s)";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

/* Every claim in the log that the model did NOT get to attempt would be invisible, so the suite
   asserts the counts agree. This helper says how many claims one owner landed, which the claims
   sheet uses to label a line "lands", "taken first" or "not reached". */
function waiverOutcomeFor(sim, ownerKey) {
  var out = { landed: [], denied: [], note: "" };
  try {
    arr(isObj(sim) ? sim.log : null).forEach(function (x) {
      if (!isObj(x) || String(x.who) !== String(ownerKey)) return;
      if (x.ok) out.landed.push({ add: x.add, drop: x.drop, round: x.round });
      else out.denied.push({ add: x.add, drop: x.drop, round: x.round, why: x.why });
    });
    out.note = out.landed.length + " of " + (out.landed.length + out.denied.length) + " landed";
  } catch (e) { out.note = "engine error: " + errMsg(e); }
  return out;
}

/* The head-to-head fixture for a gameweek, from the league's own matches array. */
function h2hOpponent(ctx, gw) {
  var res = { ok: false, gw: 0, opponent: null, mine: null, myPoints: null, oppPoints: null, finished: false, started: false, note: "" };
  try {
    if (!okCtx(ctx)) { res.note = "no context"; return res; }
    var ev = intOf(gw, 0) || ctx.nextEvent;
    res.gw = ev;
    if (!ctx.draft.matches.length) { res.note = ctx.draft.note || "no draft league fixtures"; return res; }
    var me = ctx.draft.me ? ctx.draft.me.leagueEntryId : null;
    if (!me) { res.note = "the league is known but which team is yours is not"; return res; }
    var m = null;
    ctx.draft.matches.forEach(function (x) { if (!m && x.event === ev && (x.entry1 === me || x.entry2 === me)) m = x; });
    if (!m) { res.note = "no fixture for GW" + ev; return res; }
    var oppId = m.entry1 === me ? m.entry2 : m.entry1;
    var mineRow = ctx.draft.entryById[me] || null, oppRow = ctx.draft.entryById[oppId] || null;
    res.ok = true; res.finished = !!m.finished; res.started = !!m.started;
    res.myPoints = m.entry1 === me ? m.points1 : m.points2;
    res.oppPoints = m.entry1 === me ? m.points2 : m.points1;
    res.mine = { leagueEntryId: me, name: mineRow ? mineRow.name : "" };
    res.opponent = { leagueEntryId: oppId, name: oppRow ? oppRow.name : "" };
    res.note = "GW" + ev + ": " + res.mine.name + " against " + res.opponent.name;
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

/* Kwezi's own fifteen: from the league API when the league and his team are known, from
   the hand-typed list otherwise. The source is part of the answer. */
function draftRoster(state, ctx) {
  var res = { codes: [], source: "none", complete: false, leagueEntryId: null, note: "" };
  try {
    if (!okCtx(ctx)) return res;
    var st = state === undefined || state === null ? ctx.state : sanitiseState(state);
    var me = ctx.draft.me ? ctx.draft.me.leagueEntryId : null;
    if (me) {
      var api = draftRosterOf(me, ctx);
      if (api.length) {
        res.codes = api; res.source = "api"; res.leagueEntryId = me; res.complete = api.length === 15;
        res.note = api.length + " players read from the league API";
        return res;
      }
    }
    var saved = uniq(arr(st && st.draft ? st.draft.roster : null).map(function (c) { return intOf(c, 0); }).filter(function (c) { return c > 0; }));
    res.codes = saved; res.source = saved.length ? "saved" : "none"; res.complete = saved.length === 15;
    res.note = saved.length ? saved.length + " players typed in by hand" : "no roster";
  } catch (e) { /* total */ }
  return res;
}

/* One player's own spread under the same Monte Carlo the squad uses — the input to the
   C5 variance rule. Deterministic: the seed is the player. */
function playerSpread(el, ctx, iters, seed) {
  var res = { mean: 0, sd: 0, iters: 0 };
  try {
    if (!isObj(el) || !okCtx(ctx)) return res;
    var n = clamp(intOf(iters, MC_SPREAD_ITERS), 20, 5000);
    var R = mulberry32(intOf(seed, 0) || (3000 + intOf(el.id, 1)));
    var sc = isObj(ctx.draft.scoring) ? ctx.draft.scoring : null;
    var tot = [], s = 0;
    for (var i = 0; i < n; i++) { var p = simPlayerDetail(el, ctx, R, null, sc).pts; tot.push(p); s += p; }
    var mean = s / n, v = 0;
    tot.forEach(function (t) { v += (t - mean) * (t - mean); });
    res.mean = mean; res.sd = Math.sqrt(v / n); res.iters = n;
  } catch (e) { /* total */ }
  return res;
}

/* A draft eleven's distribution: draft scoring (a keeper's goal is ten, not six) and no
   captain, because this league has none. */
function mcDraftXI(ids, bench, ctx, iters, seed) {
  var res = { mean: 0, sd: 0, q10: 0, q50: 0, q90: 0, iters: 0, ok: false };
  try {
    if (!okCtx(ctx)) return res;
    // A draft eleven is a SET; only the bench is ordered. entryPoints walks the starters in
    // the order it is given when it fills in for a player who did not appear, so leaving the
    // caller's order alone let a reshuffle that changes nothing real move the distribution —
    // and a variance tilt could then be "kept" for a side identical to the one it replaced.
    var xi = uniq(idList(ids)).filter(function (id) { return ctx.els[id]; }).sort(sortNum);
    if (xi.length !== 11) return res;
    var bn = uniq(idList(bench)).filter(function (id) { return ctx.els[id] && xi.indexOf(id) < 0; });
    var n = clamp(intOf(iters, MC_DRAFT_ITERS), MC_MIN_ITERS, 20000), R = mulberry32(intOf(seed, 11));
    var sc = isObj(ctx.draft.scoring) ? ctx.draft.scoring : null;
    var all = xi.concat(bn), totals = [];
    for (var i = 0; i < n; i++) {
      var draws = fixtureDraws(ctx, R), sims = {};
      all.forEach(function (id) { sims[id] = simPlayerDetail(ctx.els[id], ctx, R, draws, sc); });
      totals.push(entryPoints(xi, bn, null, null, sims, ctx));            // no captain in draft
    }
    var mean = sum(totals) / n, v = 0;
    totals.forEach(function (t) { v += (t - mean) * (t - mean); });
    totals.sort(sortNum);
    res.mean = mean; res.sd = Math.sqrt(v / n); res.q10 = quantile(totals, 0.1); res.q50 = quantile(totals, 0.5); res.q90 = quantile(totals, 0.9);
    res.iters = n; res.ok = true;
  } catch (e) { /* total */ }
  return res;
}

function distStats(list) {
  var res = { mean: 0, sd: 0, q10: 0, q50: 0, q90: 0, n: 0 };
  var v = arr(list).map(function (x) { return num(x, 0); });
  if (!v.length) return res;
  var mean = sum(v) / v.length, sq = 0;
  v.forEach(function (x) { sq += (x - mean) * (x - mean); });
  var sorted = v.slice().sort(sortNum);
  res.mean = mean; res.sd = Math.sqrt(sq / v.length);
  res.q10 = quantile(sorted, 0.1); res.q50 = quantile(sorted, 0.5); res.q90 = quantile(sorted, 0.9);
  res.n = v.length;
  return res;
}

/* Both elevens in ONE simulation, sharing the gameweek's fixture draws. The two teams play
   in the same real matches, so their scores are correlated (E4's portfolio rule); simulating
   them separately also made the margin disagree with itself depending on whose side you
   asked from. Shared draws make it exactly antisymmetric. No captain: this league has none. */
function mcH2H(myIds, myBench, oppIds, oppBench, ctx, iters, seed) {
  var res = { ok: false, iters: 0, mine: null, theirs: null, margin: null };
  try {
    if (!okCtx(ctx)) return res;
    var live = function (x) { return uniq(idList(x)).filter(function (id) { return ctx.els[id]; }); };
    var xa = live(myIds).sort(sortNum), xb = live(oppIds).sort(sortNum);   // the eleven is a set
    if (xa.length !== 11 || xb.length !== 11) return res;
    var ba = live(myBench).filter(function (id) { return xa.indexOf(id) < 0; });
    var bb = live(oppBench).filter(function (id) { return xb.indexOf(id) < 0; });
    var n = clamp(intOf(iters, MC_DRAFT_ITERS), MC_MIN_ITERS, 20000), R = mulberry32(intOf(seed, 0) || 11);
    var sc = isObj(ctx.draft.scoring) ? ctx.draft.scoring : null;
    // Canonical order: the rng is consumed player by player, so simulating "mine" first would
    // give a different draw sequence from simulating "theirs" first and the same fixture would
    // produce two different margins depending on whose side you asked from.
    var all = uniq(xa.concat(ba, xb, bb)).sort(sortNum);
    var A = [], B = [], M = [];
    for (var i = 0; i < n; i++) {
      var draws = fixtureDraws(ctx, R), sims = {};
      all.forEach(function (id) { sims[id] = simPlayerDetail(ctx.els[id], ctx, R, draws, sc); });
      var pa = entryPoints(xa, ba, null, null, sims, ctx), pb = entryPoints(xb, bb, null, null, sims, ctx);
      A.push(pa); B.push(pb); M.push(pa - pb);
    }
    res.mine = distStats(A); res.theirs = distStats(B); res.margin = distStats(M); res.iters = n; res.ok = true;
  } catch (e) { /* total */ }
  return res;
}

/* Both sides of this week's head-to-head, simulated. lean "up" means Kwezi is projected
   behind and wants ceiling; "down" means ahead and wants floor. */
function h2hProjection(ctx, opts) {
  var res = { ok: false, gw: 0, opponent: null, mine: null, theirs: null, margin: null, marginDist: null, lean: "level", iters: 0, note: "" };
  try {
    if (!okCtx(ctx)) { res.note = "no context"; return res; }
    var o = isObj(opts) ? opts : {};
    var h = h2hOpponent(ctx, o.gw);
    res.gw = h.gw; res.opponent = h.opponent;
    if (!h.ok) { res.note = h.note; return res; }
    var myCodes = arr(o.codes).length ? o.codes : draftRoster(null, ctx).codes;
    var oppCodes = draftRosterOf(h.opponent.leagueEntryId, ctx);
    var mineXI = draftXIBase(myCodes, ctx), oppXI = draftXIBase(oppCodes, ctx);
    if (!mineXI.ids.length || !oppXI.ids.length) { res.note = "one of the two teams does not make a legal eleven"; return res; }
    var iters = clamp(intOf(o.iters, MC_DRAFT_ITERS), MC_MIN_ITERS, 20000);
    var hh = mcH2H(mineXI.ids, mineXI.benchIds, oppXI.ids, oppXI.benchIds, ctx, iters, 11);
    if (!hh.ok) { res.note = "the simulation did not run"; return res; }
    res.mine = hh.mine; res.theirs = hh.theirs; res.marginDist = hh.margin;
    res.margin = hh.margin.mean; res.iters = iters; res.ok = true;
    res.lean = res.margin < -H2H_LEAN_TOL ? "up" : (res.margin > H2H_LEAN_TOL ? "down" : "level");
    res.note = "projected " + hh.mine.mean.toFixed(1) + " against " + hh.theirs.mean.toFixed(1) +
      " over " + iters + " shared-fixture draws, margin " + (hh.margin.mean >= 0 ? "+" : "") + hh.margin.mean.toFixed(1) +
      " (tenth to ninetieth " + hh.margin.q10.toFixed(1) + " to " + hh.margin.q90.toFixed(1) + ")";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- state (§6), D3

/* v110 D0 · `market` is the Odds tab's store of bookmaker overrides: { "<gameweek>": { "<team short name>": { xg } } }.
   A gameweek is 1–38; xg is a finite number from 0.2 to 5 inclusive (goals a side is expected to score, after the
   margin is removed); the team is one of `opts.teams` when the caller passes the engine's team list (the app passes
   MCEngine's teamNames), and otherwise a three-letter capital short name, the form every club's short name takes.
   Anything else is dropped, never repaired, and the map is capped so a corrupt store cannot grow it (E-003's rule,
   applied to a map). The ported engine reads it through setMarket; nothing here computes with it.
   v110 D1 · `done` is the Command tab's checklist ticks: { "<gameweek>:<item>": true }. The gameweek is 1–38, the item is
   two to twelve lower-case letters (the checklist's own ids), and only `true` is kept, so an untick is a deletion and a
   junk value never reads as ticked. Capped like `market`; an own "__proto__" key cannot pass the pattern. */
function sanitiseState(raw, opts) {
  var out = { version: 88, exported_at: null, entry: null, squad: [], bank: 0, ft: 1, value: 0, confirmed_gw: 0, leagues: [], draft: { league_id: null, entry_id: null, roster: [], watchlist: [] }, ui: { mode: "simple", tab: "command", open: {}, reveals: {} }, ledger: [], refresh: { pair: "sonnet46", last: null }, market: {}, done: {} };
  try {
    var r = raw;
    if (typeof r === "string") { try { r = JSON.parse(r); } catch (e) { r = null; } }
    if (!isObj(r)) return out;
    out.version = clamp(intOf(r.version, 88), 1, 100000);
    out.exported_at = typeof r.exported_at === "string" ? r.exported_at.slice(0, 40) : null;
    var en = num(r.entry, NaN); out.entry = isFinite(en) && en > 0 ? Math.trunc(en) : null;
    var seen = {};
    arr(r.squad).forEach(function (s) {
      if (out.squad.length >= 15) return;
      var id = idOf(s); if (!isFinite(id) || id <= 0 || id > 1000000 || seen[id]) return;
      var p = isObj(s) ? num(s.purchase, NaN) : NaN;
      seen[id] = true;
      out.squad.push({ id: Math.trunc(id), purchase: isFinite(p) ? clamp(Math.trunc(p), 0, 100000) : null });
    });
    out.bank = clamp(intOf(r.bank, 0), 0, 1000000);
    out.ft = clamp(intOf(r.ft, 1), 0, FT_CAP);
    out.value = clamp(intOf(r.value, 0), 0, 1000000);
    out.confirmed_gw = clamp(intOf(r.confirmed_gw, 0), 0, 38);
    out.leagues = uniq(arr(r.leagues).map(function (x) { return num(x, NaN); }).filter(function (x) { return isFinite(x) && x > 0; }).map(Math.trunc)).slice(0, 50);
    var d = isObj(r.draft) ? r.draft : {};
    var lid = num(d.league_id, NaN); out.draft.league_id = isFinite(lid) && lid > 0 ? Math.trunc(lid) : null;
    var eid = num(d.entry_id, NaN); out.draft.entry_id = isFinite(eid) && eid > 0 ? Math.trunc(eid) : null;
    if (typeof d.league_input === "string" && d.league_input) out.draft.league_input = d.league_input.slice(0, 400);
    out.draft.roster = uniq(arr(d.roster).map(function (x) { return num(x, NaN); }).filter(function (x) { return isFinite(x) && x > 0; }).map(Math.trunc)).slice(0, 15);
    out.draft.watchlist = uniq(arr(d.watchlist).map(function (x) { return num(x, NaN); }).filter(function (x) { return isFinite(x) && x > 0; }).map(Math.trunc)).slice(0, 200);
    if (Array.isArray(d.taken)) out.draft.taken = uniq(d.taken.map(function (x) { return num(x, NaN); }).filter(function (x) { return isFinite(x) && x > 0; }).map(Math.trunc)).slice(0, 400);
    if (typeof d.roster_complete === "boolean") out.draft.roster_complete = d.roster_complete;
    if (typeof d.roster_note === "string") out.draft.roster_note = d.roster_note.slice(0, 600);
    var u = isObj(r.ui) ? r.ui : {};
    out.ui.mode = u.mode === "full" ? "full" : "simple";
    var tabs = ["command", "plan", "squad", "rivals", "draft", "chips", "odds", "review", "lab"];
    out.ui.tab = tabs.indexOf(u.tab) >= 0 ? u.tab : "command";
    ["open", "reveals"].forEach(function (k) { var src = isObj(u[k]) ? u[k] : {}; var n = 0; Object.keys(src).forEach(function (key) { if (n++ < 200 && typeof key === "string" && key.length <= 60) out.ui[k][key] = !!src[key]; }); });
    arr(r.ledger).slice(0, 500).forEach(function (row) {
      if (!isObj(row)) return;
      out.ledger.push({ gw: clamp(intOf(row.gw, 0), 0, 38), type: String(row.type === undefined ? "" : row.type).slice(0, 20), pick: row.pick === undefined || row.pick === null ? null : (isFinite(num(row.pick, NaN)) ? num(row.pick) : String(row.pick).slice(0, 40)), alt: row.alt === undefined || row.alt === null ? null : (isFinite(num(row.alt, NaN)) ? num(row.alt) : String(row.alt).slice(0, 40)), xp_pick: num(row.xp_pick, 0), xp_alt: num(row.xp_alt, 0), outcome: row.outcome === undefined || row.outcome === null ? null : num(row.outcome, 0), regret: row.regret === undefined || row.regret === null ? null : num(row.regret, 0) });
    });
    var rf = isObj(r.refresh) ? r.refresh : {};
    out.refresh.pair = REFRESH_PAIRS[rf.pair] ? rf.pair : "sonnet46";
    out.refresh.last = typeof rf.last === "string" ? rf.last.slice(0, 40) : null;
    var XG_MIN = 0.2, XG_MAX = 5, MARKET_CAP = 200, SCAN = 100;
    var known = null;
    if (isObj(opts) && Array.isArray(opts.teams)) {
      known = opts.teams.slice(0, SCAN).filter(function (t) { return typeof t === "string" && t.length >= 2 && t.length <= 4 && t === t.toUpperCase() && t !== "__PROTO__"; });
    }
    var teamOk = function (t) { return known ? known.indexOf(t) >= 0 : /^[A-Z]{3}$/.test(t); };
    var mk = isObj(r.market) ? r.market : {}, kept = 0;
    Object.keys(mk).slice(0, SCAN).forEach(function (g) {
      var gw = num(g, NaN), row = mk[g];
      if (!isFinite(gw) || gw !== Math.trunc(gw) || gw < 1 || gw > 38 || !isObj(row)) return;
      Object.keys(row).slice(0, SCAN).forEach(function (t) {
        if (kept >= MARKET_CAP || !teamOk(t) || !isObj(row[t])) return;
        var xg = num(row[t].xg, NaN);
        if (!isFinite(xg) || xg < XG_MIN || xg > XG_MAX) return;
        var key = String(gw);
        if (!Object.prototype.hasOwnProperty.call(out.market, key)) out.market[key] = {};
        out.market[key][t] = { xg: xg };
        kept++;
      });
    });
    var dn = isObj(r.done) ? r.done : {}, ticks = 0;
    Object.keys(dn).slice(0, 400).forEach(function (k) {
      if (ticks >= 100 || dn[k] !== true) return;
      var m = /^([1-9]|[1-3][0-9]):([a-z]{2,12})$/.exec(k);
      if (!m || Number(m[1]) > 38) return;
      out.done[k] = true;
      ticks++;
    });
  } catch (e) { /* total: defaults stand */ }
  return out;
}
function detectSquadChange(stateSquadIds, picks) {
  var res = { changed: false, added: [], removed: [], block: false };
  try {
    var mine = uniq(idList(stateSquadIds));
    var list = isObj(picks) && Array.isArray(picks.picks) ? picks.picks : picks;
    var theirs = uniq(arr(list).map(function (p) { return isObj(p) ? num(p.element, NaN) : num(p, NaN); }).filter(isFinite));
    if (!theirs.length) return res;
    var m = {}, t = {}; mine.forEach(function (id) { m[id] = true; }); theirs.forEach(function (id) { t[id] = true; });
    res.added = theirs.filter(function (id) { return !m[id]; });
    res.removed = mine.filter(function (id) { return !t[id]; });
    res.changed = res.added.length > 0 || res.removed.length > 0;
    res.block = res.changed;
  } catch (e) { res.changed = true; res.block = true; }
  return res;
}
function ftAvailable(history, currentEvent, chips) {
  // E-045: the chips list was only ever read from the object form, so ftAvailable(history, n) and
  // ftAvailable(history.current, n) answered differently on the same data and neither said so.
  // Chips now reach this function three ways and the two shapes agree: from the object, from an
  // explicit third argument, and — when neither is given — inferred from the rows themselves,
  // because using more free transfers in one gameweek than the cap of five allows can only be a
  // wildcard or a free hit week.
  try {
    var src = isObj(history) && Array.isArray(history.current) ? history.current : history;
    var rows = arr(src).filter(isObj).map(function (r) { return { event: intOf(r.event, 0), t: Math.max(0, intOf(r.event_transfers, 0)), cost: Math.max(0, intOf(r.event_transfers_cost, 0)) }; }).filter(function (r) { return r.event > 0; }).sort(function (a, b) { return a.event - b.event; });
    var chipSrc = Array.isArray(chips) ? chips : (isObj(history) ? history.chips : null);
    var chipWeeks = {}; arr(chipSrc).forEach(function (c) { if (isObj(c) && (c.name === "wildcard" || c.name === "freehit")) chipWeeks[intOf(c.event, 0)] = true; });
    var cur = intOf(currentEvent, rows.length ? rows[rows.length - 1].event : 0);
    var ft = 1;
    rows.forEach(function (r) {
      if (r.event < 2 || r.event > cur) return;
      var freeUsed = Math.max(0, r.t - Math.floor(r.cost / HIT_COST));
      // E-099: a wildcard or free-hit week keeps the count exactly as it was — nothing spent, nothing
      // added (v110 §4, Part N1). The +1 arrives with the next ordinary week, as it always does.
      if (chipWeeks[r.event] || freeUsed > FT_CAP) return;
      ft = Math.min(FT_CAP, Math.max(0, ft - freeUsed) + 1);
    });
    return clamp(ft, 1, FT_CAP);
  } catch (e) { return 1; }
}
function sellPrice(now, purchase) {
  var n = Math.max(0, intOf(now, 0)); var p = intOf(purchase, NaN);
  if (!isFinite(p) || p <= 0) return n;
  if (n > p) return p + Math.floor((n - p) / 2);
  return n;
}
/* What a player cost, and therefore what he sells for (v110 §4 Classic, §5 A3).

   The rule: selling price is the price paid plus HALF of any rise, rounded down to £0.1m; a fall is
   taken in full. `sellPrice` above is that arithmetic. The hard part is the price paid, and it has
   two sources:

     the original fifteen   `now_cost - cost_change_start`. The start price, worked back from
                            today's price and the change since.
     anyone bought since    `element_in_cost` from the entry transfers endpoint (the fetcher's job,
                            never the app's — verify.sh forbids an account path in src for a
                            reason). This is the price
                            actually paid, logged by the game, and it is NOT recoverable from
                            `cost_change_start`: a player bought after a rise was paid the risen
                            price, and his start price would understate what he sells for.

   Before this, the repo had no transfer log at all and took purchase prices from `state.squad[].
   purchase` — hand-derived, which is why Calvert-Lewin sat in the state file as an estimate of 60
   inferred from the bank delta. The log says `element_in_cost: 60`. The estimate was right and that
   is not the point: an estimate that happens to be right is still an estimate, and a screenshot or
   a derivation goes stale within days (§7.13).

   Pure and array-shaped so a suite can drive it straight off recorded feeds.
*/
function purchasePrices(elements, transfers, squadIds) {
  var res = { paid: {}, source: {}, bought: 0, original: 0, note: "" };
  try {
    var E = elMap(elements);
    var ids = arr(squadIds).map(function (x) { return intOf(x, 0); }).filter(function (x) { return x > 0; });
    if (!ids.length) ids = Object.keys(E).map(function (k) { return intOf(k, 0); });

    /* The log is applied in time order, so the LAST price paid for a player who was bought,
       sold and bought again is the one that counts. */
    var log = arr(transfers).filter(isObj).slice().sort(function (a, b) {
      return String(a.time || "").localeCompare(String(b.time || ""));
    });
    var byTransfer = {};
    log.forEach(function (t) {
      var inId = intOf(t.element_in, 0);
      var cost = intOf(t.element_in_cost, NaN);
      if (inId > 0 && isFinite(cost) && cost > 0) byTransfer[inId] = cost;
    });

    ids.forEach(function (id) {
      var el = E[id];
      if (!isObj(el)) return;
      var now = intOf(el.now_cost, 0);
      if (Object.prototype.hasOwnProperty.call(byTransfer, id)) {
        res.paid[id] = byTransfer[id];
        res.source[id] = "transfer";
        res.bought++;
      } else {
        res.paid[id] = now - intOf(el.cost_change_start, 0);
        res.source[id] = "start";
        res.original++;
      }
    });
    res.note = res.original + " priced from the start price, " + res.bought + " from the transfer log";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

/* {id: {now, paid, sell}} in TENTHS, which is what the API speaks. Callers divide by ten to show
   a price; nothing internal ever rounds, because a display-rounded price in a budget check is how
   a squad comes out £0.1m over (B3's "raw prices, never display-rounded"). */
function sellPrices(elements, transfers, squadIds) {
  var out = { rows: {}, paidSource: {}, note: "" };
  try {
    var E = elMap(elements);
    var pp = purchasePrices(elements, transfers, squadIds);
    Object.keys(pp.paid).forEach(function (id) {
      var el = E[id];
      if (!isObj(el)) return;
      var now = intOf(el.now_cost, 0), paid = intOf(pp.paid[id], 0);
      out.rows[id] = { now: now, paid: paid, sell: sellPrice(now, paid) };
      out.paidSource[id] = pp.source[id];
    });
    out.note = pp.note;
  } catch (e) { out.note = "engine error: " + errMsg(e); }
  return out;
}

function bankAfter(state, moves, els) {
  try {
    var st = sanitiseState(state), E = elMap(els);
    var purchase = {}; st.squad.forEach(function (s) { purchase[s.id] = s.purchase; });
    var bank = st.bank;
    var list = isObj(moves) && !Array.isArray(moves) ? arr(moves.sells).map(function (id) { return { out: id }; }).concat(arr(moves.buys).map(function (id) { return { in: id }; })) : arr(moves);
    list.forEach(function (m) {
      if (!isObj(m)) return;
      var o = num(m.out, NaN), i = num(m.in, NaN);
      if (isFinite(o) && E[o]) bank += sellPrice(num(E[o].now_cost, 0), purchase[o]);
      if (isFinite(i) && E[i]) bank -= num(E[i].now_cost, 0);
    });
    return Math.trunc(bank);
  } catch (e) { return 0; }
}

// ---------------------------------------------------------------- refresh (D4)

function openClosers(piece) {
  if (typeof piece !== "string") return null;
  var stack = [], inStr = false, esc = false;
  for (var i = 0; i < piece.length; i++) {
    var ch = piece[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === "\"") inStr = false; continue; }
    if (ch === "\"") inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") { if (!stack.length || stack[stack.length - 1] !== ch) return null; stack.pop(); }
  }
  return (inStr ? "\"" : "") + stack.reverse().join("");
}
function salvageJson(s) {
  if (typeof s !== "string") return null;
  var cut = s.length;
  for (var attempt = 0; attempt < 80; attempt++) {
    var piece = s.slice(0, cut).replace(/[\s,]+$/, "");
    var closers = openClosers(piece);
    if (closers !== null) {
      try { var v = JSON.parse(piece + closers); if (isObj(v)) return v; } catch (e) { /* keep cutting */ }
      var tail = piece.replace(/:\s*$/, ": null");
      if (tail !== piece) { try { var v2 = JSON.parse(tail + closers); if (isObj(v2)) return v2; } catch (e2) { /* keep cutting */ } }
    }
    var lc = piece.lastIndexOf(",");
    if (lc <= 0) return null;
    cut = lc;
  }
  return null;
}
function stripFences(text) {
  // E-044: the fence strip was global, so it ran INSIDE the JSON string values too and ate the
  // whitespace after each fence — '{"news":"a ``` b"}' came back as {"news":"a b"}. D4 payloads
  // carry news text, which is exactly where a stray fence turns up. Only a fence that opens the
  // reply and a fence that closes it are markup; anything between them is content.
  if (typeof text !== "string") return "";
  var s = text.trim();
  s = s.replace(/^```[a-zA-Z0-9_.+-]*[ \t]*(\r?\n|$)/, "");
  s = s.replace(/(\r?\n|^)[ \t]*```[ \t]*$/, "");
  return s.trim();
}
function parseJson(text) {
  if (typeof text !== "string") throw new Error("parseJson: expected a string, got " + (text === null ? "null" : typeof text));
  var s = stripFences(text);
  var a = s.indexOf("{");
  if (a < 0) throw new Error("parseJson: no JSON object in the reply (" + s.length + " chars: \"" + s.slice(0, 60).replace(/\s+/g, " ") + "\")");
  var b = s.lastIndexOf("}");
  var body = b > a ? s.slice(a, b + 1) : s.slice(a);
  var first;
  try { var v = JSON.parse(body); if (isObj(v)) return v; first = new Error("top-level JSON is not an object"); } catch (e) { first = e; }
  var salvaged = salvageJson(s.slice(a));
  if (salvaged !== null) { salvaged.__salvaged = true; return salvaged; }
  throw new Error("parseJson: " + errMsg(first) + " (reply starts: \"" + s.slice(0, 60).replace(/\s+/g, " ") + "\")");
}
function blocksOf(content) {
  if (Array.isArray(content)) return content;
  if (isObj(content) && Array.isArray(content.content)) return content.content;
  return [];
}
function pickText(contentBlocks) {
  var parts = [];
  blocksOf(contentBlocks).forEach(function (b) { if (isObj(b) && b.type === "text" && typeof b.text === "string") parts.push(b.text); });
  return parts.join("\n");
}
function blockTypes(contentBlocks) {
  var types = blocksOf(contentBlocks).map(function (b) { return isObj(b) && typeof b.type === "string" ? b.type : "unknown"; });
  return types.length ? uniq(types).join(", ") : "none";
}
function refreshRequest(cfg) {
  var c = isObj(cfg) ? cfg : {};
  var key = REFRESH_PAIRS[c.pair] ? c.pair : "sonnet46";
  var pair = REFRESH_PAIRS[key];
  var ids = uniq(idList(c.ids)).slice(0, 60);
  var names = arr(c.names).filter(function (n) { return typeof n === "string"; }).slice(0, 60);
  var gw = intOf(c.nextEvent, 0);
  var who = names.length ? names.join(", ") : (ids.length ? "element ids " + ids.join(", ") : "every player in the two fifteens");
  var prompt = typeof c.prompt === "string" && c.prompt.trim() ? c.prompt : (
    "You are updating a Fantasy Premier League app. Search the official Fantasy Premier League site and this week's club press conferences" +
    (gw ? " for Gameweek " + gw : "") + " and report, for these players: " + who + ". " +
    "Reply with one JSON object and nothing else, in this exact shape: " +
    "{\"fetched_at\":\"<ISO-8601 UTC>\",\"deadline_time\":\"<ISO-8601 UTC of the next deadline>\"," +
    "\"elements\":[{\"id\":<FPL element id>,\"web_name\":\"<name>\",\"status\":\"a|d|i|s|u|n\",\"chance\":<0-100 or null>,\"news\":\"<short>\",\"now_cost\":<price in tenths, e.g. 77>}]}. " +
    "Use the element id as the key, never the name. Leave a field out if you could not verify it. No prose, no code fences.");
  return { model: pair.model, max_tokens: REFRESH_MAX_TOKENS, tools: [{ type: pair.tool, name: "web_search" }], messages: [{ role: "user", content: prompt }], pair: key, ids: ids, warning: REFRESH_PAIRS[c.pair] ? null : "unknown pair " + (typeof c.pair === "string" && c.pair ? "'" + c.pair + "'" : "(none given)") + ", using sonnet46" };
}
var REFRESH_PRICE_STEP = 3;            // tenths of a million: the most a refresh may move a price (SEC-02)
var REFRESH_DEADLINE_MS = 15 * 60000;   // a reply's deadline within this of the official one is a confirmation, not a change
function applyRefresh(state, parsed) {
  if (!isObj(parsed)) throw new Error("applyRefresh: refresh payload is not an object");
  if (parsed.type === "error" || isObj(parsed.error)) throw new Error("applyRefresh: " + (isObj(parsed.error) && parsed.error.message ? parsed.error.message : "the reply was an error object"));
  var elements = Array.isArray(parsed.elements) ? parsed.elements : (Array.isArray(parsed.players) ? parsed.players : null);
  if (!elements) throw new Error("applyRefresh: no elements array in the refresh");
  var live = isObj(state) && Array.isArray(state.elements) ? state : (isObj(state) && isObj(state.live) && Array.isArray(state.live.elements) ? state.live : null);
  if (!live) throw new Error("applyRefresh: state carries no live snapshot to update");
  var byId = {}; live.elements.forEach(function (el) { if (isObj(el)) byId[el.id] = el; });
  var updates = {}, skipped = [], applied = 0;
  elements.forEach(function (u) {
    if (!isObj(u)) { skipped.push("non-object entry"); return; }
    var id = num(u.id, NaN);
    if (!isFinite(id)) { skipped.push("no element id for " + String(u.web_name || "?")); return; }
    if (!byId[id]) { skipped.push("unknown element id " + id); return; }
    var patch = {};
    if (u.status !== undefined && u.status !== null) { var st = String(u.status).toLowerCase(); if (st.length !== 1 || "adisun".indexOf(st) < 0) throw new Error("applyRefresh: bad status \"" + String(u.status) + "\" for id " + id); patch.status = st; }
    if (u.chance !== undefined) { if (u.chance === null) patch.chance = null; else { var ch = num(u.chance, NaN); if (!isFinite(ch)) throw new Error("applyRefresh: bad chance \"" + String(u.chance) + "\" for id " + id); patch.chance = clamp(Math.round(ch), 0, 100); } }
    if (u.news !== undefined && u.news !== null) patch.news = String(u.news).slice(0, 300);
    if (u.now_cost !== undefined && u.now_cost !== null) {
      var nc = num(u.now_cost, NaN); if (!isFinite(nc) || nc < 30 || nc > 250) throw new Error("applyRefresh: bad now_cost \"" + String(u.now_cost) + "\" for id " + id);
      /* Audit SEC-02: a price moves by at most £0.1m a day, so a reply more than £0.3m from the snapshot is not believed;
         that one field is skipped with its reason, and the rest of the reply still applies. */
      var was = num(byId[id].now_cost, NaN);
      if (isFinite(was) && Math.abs(Math.round(nc) - was) > REFRESH_PRICE_STEP) skipped.push("price for id " + id + " moved " + (Math.round(nc) - was) / 10 + "m, more than the £0.3m a refresh may move it; kept " + was / 10 + "m");
      else patch.now_cost = Math.round(nc);
    }
    if (Object.keys(patch).length) { patch.refresh_src = "model"; updates[id] = patch; applied++; } else skipped.push("nothing verifiable for id " + id);
  });
  if (!applied) throw new Error("applyRefresh: nothing applied (" + (skipped.slice(0, 3).join("; ") || "empty elements") + ")");
  var newElements = live.elements.map(function (el) {
    if (!isObj(el) || !updates[el.id]) return el;
    var p = updates[el.id], n = {};
    Object.keys(el).forEach(function (k) { n[k] = el[k]; });
    Object.keys(p).forEach(function (k) { n[k] = p[k]; });
    if (p.now_cost !== undefined) n.cost_change_event = num(el.cost_change_event, 0) + (p.now_cost - num(el.now_cost, 0));
    return n;
  });
  var newLive = {};
  Object.keys(live).forEach(function (k) { newLive[k] = live[k]; });
  newLive.elements = newElements;
  if (typeof parsed.fetched_at === "string" && isFinite(Date.parse(parsed.fetched_at))) newLive.fetched_at = parsed.fetched_at;
  /* Audit SEC-02: the deadline belongs to the official snapshot. A reply may confirm it to within a quarter of an hour
     (and then nothing changes); a reply further out is skipped with its reason and the built-in deadline stands. */
  if (typeof parsed.deadline_time === "string" && isFinite(Date.parse(parsed.deadline_time)) && Array.isArray(live.events)) {
    var nextId = intOf(live.next_event, 0);
    var evN = live.events.filter(function (e) { return isObj(e) && intOf(e.id, -1) === nextId; })[0];
    var have = evN ? Date.parse(evN.deadline_time) : NaN, got = Date.parse(parsed.deadline_time);
    if (isFinite(have) && Math.abs(got - have) > REFRESH_DEADLINE_MS) skipped.push("deadline " + parsed.deadline_time + " differs from the official " + evN.deadline_time + " by " + Math.round(Math.abs(got - have) / 60000) + " minutes; kept the official one");
  }
  newLive.refreshed = { applied: applied, skipped: skipped, at: newLive.fetched_at || null, salvaged: parsed.__salvaged === true, src: "model" };
  if (live === state) return newLive;
  var ns = {}; Object.keys(state).forEach(function (k) { ns[k] = state[k]; }); ns.live = newLive;
  return ns;
}

// ---------------------------------------------------------------- Monte Carlo (E4)

function mulberry32(seed) {
  var a = (intOf(seed, 1) | 0) >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngOf(rng) { return typeof rng === "function" ? rng : mulberry32(1); }
function poisson(lambda, rng) {
  if (typeof rng !== "function") return 0;
  lambda = num(lambda, 0); if (lambda <= 0) return 0;
  if (lambda > 25) { var u1 = Math.max(1e-12, rng()), u2 = rng(); return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2))); }
  var L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L && k < 60);
  return k - 1;
}
// n is capped: nothing in this game draws more than a few hundred Bernoulli trials, and an
// uncapped n from a corrupt input is an unbounded loop, not a bad number (poisson is already
// capped at 60 draws).
function binomial(n, p, rng) { var k = 0; if (typeof rng !== "function") return 0; n = clamp(intOf(n, 0), 0, BINOMIAL_MAX_N); p = clamp(p, 0, 1); for (var i = 0; i < n; i++) if (rng() < p) k++; return k; }
function posRates(ctx) {
  if (!isObj(ctx)) return { 1: { xg90: 0, xa90: 0, sv90: 0 }, 2: { xg90: 0, xa90: 0, sv90: 0 }, 3: { xg90: 0, xa90: 0, sv90: 0 }, 4: { xg90: 0, xa90: 0, sv90: 0 } };
  if (ctx._posRates) return ctx._posRates;
  var acc = { 1: { m: 0, xg: 0, xa: 0, sv: 0 }, 2: { m: 0, xg: 0, xa: 0, sv: 0 }, 3: { m: 0, xg: 0, xa: 0, sv: 0 }, 4: { m: 0, xg: 0, xa: 0, sv: 0 } };
  arr(ctx.elList).forEach(function (el) { var t = elType(el); if (!t) return; acc[t].m += num(el.minutes, 0); acc[t].xg += num(el.xg, 0); acc[t].xa += num(el.xa, 0); acc[t].sv += num(el.saves, 0); });
  var out = {}; [1, 2, 3, 4].forEach(function (t) { var m = acc[t].m; out[t] = { xg90: m ? acc[t].xg / m * 90 : 0, xa90: m ? acc[t].xa / m * 90 : 0, sv90: m ? acc[t].sv / m * 90 : 0 }; });
  ctx._posRates = out; return out;
}
function playerRates(el, ctx) {
  if (!isObj(ctx)) ctx = {};
  if (!isObj(el)) el = {};
  var base = isObj(ctx.baseRates) ? ctx.baseRates : { yc: 0 };
  var t = elType(el), pr = posRates(ctx)[t] || { xg90: 0, xa90: 0, sv90: 0 };
  var m = num(el.minutes, 0), w = m / (m + 270);
  var r = function (v, prior) { return w * (m ? num(v, 0) / m * 90 : 0) + (1 - w) * prior; };
  return { xg90: r(el.xg, pr.xg90), xa90: r(el.xa, pr.xa90), sv90: t === 1 ? r(el.saves, pr.sv90) : 0, yc90: Math.max(num(base.yc, 0), m ? num(el.yc, 0) / m * 90 : 0) };
}
function likelyXI(teamId, ctx) {
  if (!isObj(ctx) || !Array.isArray(ctx.elList) || !isObj(ctx.xp)) return [];
  ctx._likely = ctx._likely || {};
  if (ctx._likely[teamId]) return ctx._likely[teamId];
  var list = ctx.elList.filter(function (el) { return num(el.team, -1) === teamId && ctx.xp[el.id] && ctx.xp[el.id].pstart >= 0.5; })
    .sort(function (a, b) { return ctx.xp[b.id].pstart - ctx.xp[a.id].pstart; }).slice(0, 11)
    .map(function (el) { var gs = ctx.gwStats[el.id] || { played: 0, bpsSum: 0 }; return { id: el.id, bps: gs.played ? gs.bpsSum / gs.played : num(el.bps, 0) / Math.max(1, num(el.starts, 0)) }; });
  ctx._likely[teamId] = list; return list;
}
function simFixture(fixture, ctx, rng) {
  var out = { h: 0, a: 0, bonus: {} };
  try {
    if (!okCtx(ctx) || !isObj(fixture)) return out;
    var R = rngOf(rng), h = num(fixture.team_h, -1), a = num(fixture.team_a, -1);
    out.h = poisson(tsXg(h, a, true, ctx.TS), R); out.a = poisson(tsXg(a, h, false, ctx.TS), R);
    var cand = likelyXI(h, ctx).concat(likelyXI(a, ctx)).map(function (p) { return { id: p.id, bps: p.bps * (0.5 + R()) }; });
    cand.sort(function (x, y) { return y.bps - x.bps; });
    if (cand[0]) out.bonus[cand[0].id] = 3; if (cand[1]) out.bonus[cand[1].id] = 2; if (cand[2]) out.bonus[cand[2].id] = 1;
  } catch (e) { /* total */ }
  return out;
}
function simPlayerDetail(el, ctx, rng, draws, scoring) {
  var res = { pts: 0, mins: 0 };
  if (!isObj(el) || !okCtx(ctx)) return res;
  var R = rngOf(rng), t = elType(el); if (!t) return res;
  var x = ctx.xp[el.id] || { pstart: pStart(el, ctx.gwStats) };
  var gs = ctx.gwStats[el.id] || { dcRate: 0, bonusRate: 0 };
  var team = num(el.team, -1), fx = arr(ctx.fixturesByEvent[ctx.nextEvent]).filter(function (f) { return num(f.team_h, -1) === team || num(f.team_a, -1) === team; });
  if (!fx.length) return res;
  var rates = playerRates(el, ctx), TBL = isObj(scoring) && isObj(scoring[t]) ? scoring : SCORING, S = TBL[t];
  fx.forEach(function (f) {
    if (R() >= x.pstart) return;                                      // did not start: 0 minutes
    var mins = R() < 0.85 ? 60 + Math.floor(R() * 31) : 1 + Math.floor(R() * 59);
    var home = num(f.team_h, -1) === team, opp = home ? num(f.team_a, -1) : num(f.team_h, -1);
    var draw = isObj(draws) ? draws[f.id] : null;
    var mult = tsMult(team, opp, home, ctx.TS), frac = mins / 90;
    var teamGoals, oppGoals, goals, assists;
    if (isObj(draw)) {
      teamGoals = home ? num(draw.h, 0) : num(draw.a, 0); oppGoals = home ? num(draw.a, 0) : num(draw.h, 0);
      goals = binomial(teamGoals, rates.xg90 * frac / ctx.Lbar, R);
      assists = binomial(teamGoals - goals, rates.xa90 * frac / ctx.Lbar, R);
    } else {
      var lamOpp = tsXg(opp, team, !home, ctx.TS);
      goals = poisson(rates.xg90 * frac * mult, R); assists = poisson(rates.xa90 * frac * mult, R);
      oppGoals = poisson(lamOpp, R); teamGoals = goals;
    }
    var cs = mins >= 60 && oppGoals === 0 ? 1 : 0;
    var gc = mins >= 60 ? oppGoals : Math.floor(oppGoals * frac);
    var dc = S.dc_threshold && R() < num(gs.dcRate, 0) ? S.dc_threshold : 0;
    var saves = t === 1 ? poisson(rates.sv90 * frac * tsMult(opp, team, !home, ctx.TS), R) : 0;
    var yc = R() < rates.yc90 * frac ? 1 : 0, rc = R() < ctx.baseRates.rc * frac ? 1 : 0, og = R() < ctx.baseRates.og * frac ? 1 : 0;
    var bonus = isObj(draw) && isObj(draw.bonus) ? num(draw.bonus[el.id], 0) : (R() < clamp(num(gs.bonusRate, 0), 0, 1) ? 1 + Math.floor(R() * 3) : 0);
    var row = { minutes: mins, goals: goals, assists: assists, cs: cs, gc: gc, bonus: bonus, yc: yc, rc: rc, og: og, pen_miss: 0, pen_save: 0, saves: saves, dc: dc };
    res.pts += pointsFor(row, t, TBL); res.mins += mins;
  });
  return res;
}
function simPlayer(el, ctx, rng, draws) { return simPlayerDetail(el, ctx, rng, draws).pts; }
function fixtureDraws(ctx, rng) { var d = {}; if (!isObj(ctx) || !isObj(ctx.fixturesByEvent) || typeof rng !== "function") return d; arr(ctx.fixturesByEvent[ctx.nextEvent]).forEach(function (f) { d[f.id] = simFixture(f, ctx, rng); }); return d; }
function entryPoints(xi, bench, capId, viceId, sims, ctx) {
  // xi: 11 ids in order; bench: [gkSub, b1, b2, b3] in order; sims: {id:{pts,mins}}
  if (!okCtx(ctx)) return 0;
  if (!isObj(sims)) sims = {};
  var total = 0;
  // The autosub rules live in autosubResolve and nowhere else, so the Monte Carlo and the F3
  // back-test cannot drift apart on them (E-089's lesson applied before it could recur here).
  var sub = autosubResolve(xi, bench, function (id) { return (sims[id] || { mins: 0 }).mins > 0; }, ctx);
  var starters = sub.ok ? sub.starters : arr(xi).slice();
  starters.forEach(function (id) { total += (sims[id] || { pts: 0 }).pts; });
  var cap = capId, capS = sims[cap] || { pts: 0, mins: 0 };
  if (capS.mins <= 0 && viceId) { cap = viceId; capS = sims[cap] || { pts: 0, mins: 0 }; }
  if (cap && starters.indexOf(cap) >= 0 && capS.mins > 0) total += capS.pts;
  return total;
}
function squadOrder(ids, capId, ctx) {
  if (!okCtx(ctx)) return null;
  var list = uniq(idList(ids)).filter(function (id) { return ctx.els[id]; });
  var xi, bench;
  if (list.length === 11 && legalXI(list, ctx.els).ok) { xi = list; bench = []; }
  else if (list.length === 15 && legalXI(list.slice(0, 11), ctx.els).ok) { xi = list.slice(0, 11); bench = list.slice(11); }
  else { var bx = bestXI(list, ctx); if (!bx.ids.length) return null; xi = bx.ids; var gk = bx.bench.filter(function (id) { return elType(ctx.els[id]) === 1; }); bench = gk.concat(benchOrder(list, xi, ctx)); if (!capId) capId = bx.capId; }
  var cap = num(capId, NaN); if (!isFinite(cap) || xi.indexOf(cap) < 0) { var c = captainPick(xi, ctx); cap = c.capId; }
  return { xi: xi, bench: bench, cap: cap };
}
function mcSquad(ids, capId, ctx, iters, seed, viceId) {
  var res = { mean: 0, sd: 0, q10: 0, q50: 0, q90: 0, iters: 0 };
  try {
    if (!okCtx(ctx)) return res;
    var so = squadOrder(ids, capId, ctx); if (!so) return res;
    var vice = num(viceId, NaN); if (!isFinite(vice) || so.xi.indexOf(vice) < 0) vice = null;
    // E-046: iters 0 or negative used to become a single draw reported with the full shape of a
    // converged distribution — mean, sd 0, and three identical quantiles. The count is floored at
    // MC_MIN_ITERS so one draw can never be presented as a distribution.
    var n = clamp(intOf(iters, 1000), MC_MIN_ITERS, 20000), R = mulberry32(intOf(seed, 1));
    var all = so.xi.concat(so.bench), totals = [];
    for (var i = 0; i < n; i++) {
      var draws = fixtureDraws(ctx, R), sims = {};
      all.forEach(function (id) { sims[id] = simPlayerDetail(ctx.els[id], ctx, R, draws); });
      totals.push(entryPoints(so.xi, so.bench, so.cap, vice, sims, ctx));
    }
    var mean = sum(totals) / n, v = 0; totals.forEach(function (t) { v += (t - mean) * (t - mean); });
    totals.sort(sortNum);
    res.mean = mean; res.sd = Math.sqrt(v / n); res.q10 = quantile(totals, 0.1); res.q50 = quantile(totals, 0.5); res.q90 = quantile(totals, 0.9); res.iters = n;
  } catch (e) { /* total */ }
  return res;
}
function mcLeague(ctx, leagueId, opts) {
  var res = { leagueId: null, name: "", entries: 0, rivalsSimulated: 0, missingPicks: 0, currentRank: null, medianRank: null, rankBand: [null, null], direction: "hold", gwsOfData: 0, pWin: null, pWinNote: "", iters: 0, note: "" };
  try {
    if (!okCtx(ctx)) return res;
    var o = isObj(opts) ? opts : {};
    var L = ctx.leagues.filter(function (l) { return num(l.id, NaN) === num(leagueId, NaN); })[0];
    if (!L) { res.note = "league not in the snapshot"; return res; }
    res.leagueId = num(L.id); res.name = String(L.name || ""); res.gwsOfData = ctx.finishedGws.length;
    var me = ctx.live.entry ? num(ctx.live.entry.id, NaN) : NaN;
    var rivals = isObj(ctx.live.rivals) ? ctx.live.rivals : {};
    var mine = squadOrder(o.ids && o.ids.length ? o.ids : (ctx.picks.length ? ctx.picks.slice().sort(function (a, b) { return num(a.position, 0) - num(b.position, 0); }).map(function (p) { return p.element; }) : ctx.squadIds), o.capId, ctx);
    if (!mine) { res.note = "no legal squad to simulate"; return res; }
    var vice = num(o.viceId, NaN); if (!isFinite(vice)) vice = null;
    var entries = [];
    arr(L.standings).forEach(function (r) {
      if (!isObj(r)) return;
      var e = num(r.entry, NaN); if (!isFinite(e)) return;
      var row = { entry: e, total: num(r.total, 0), rank: num(r.rank, 0), me: e === me, xi: null, bench: [], cap: null };
      if (row.me) { row.xi = mine.xi; row.bench = mine.bench; row.cap = mine.cap; }
      else if (rivals[e] && Array.isArray(rivals[e].picks)) {
        var pk = rivals[e].picks.filter(isObj).slice().sort(function (a, b) { return num(a.position, 0) - num(b.position, 0); });
        var ids = pk.map(function (p) { return num(p.element, NaN); }).filter(function (id) { return isFinite(id) && ctx.els[id]; });
        if (ids.length >= 11 && legalXI(ids.slice(0, 11), ctx.els).ok) { row.xi = ids.slice(0, 11); row.bench = ids.slice(11); var capP = pk.filter(function (p) { return p.is_captain === true || num(p.multiplier, 1) >= 2; })[0]; row.cap = capP ? num(capP.element) : null; }
      }
      entries.push(row);
    });
    if (!entries.some(function (e) { return e.me; })) entries.push({ entry: me, total: num(ctx.live.entry && ctx.live.entry.summary_overall_points, 0), rank: entries.length + 1, me: true, xi: mine.xi, bench: mine.bench, cap: mine.cap });
    res.entries = entries.length; res.rivalsSimulated = entries.filter(function (e) { return !e.me && e.xi; }).length; res.missingPicks = entries.filter(function (e) { return !e.xi; }).length;
    var meRow = entries.filter(function (e) { return e.me; })[0]; res.currentRank = meRow.rank || null;
    /* Audit F-09: a table that has not started (every total 0, or no rank of my own) has nothing to rank against. */
    if (!meRow.rank || entries.every(function (e) { return !e.total; })) {
      res.note = res.name + " has no scores yet, so there is no rank to simulate.";
      return res;
    }
    var n = clamp(intOf(o.iters, 500), 1, 20000), R = mulberry32(intOf(o.seed, 7));
    var union = {}; entries.forEach(function (e) { if (e.xi) e.xi.concat(e.bench).forEach(function (id) { union[id] = true; }); });
    var unionIds = Object.keys(union).map(Number);
    var ranks = [], wins = 0;
    for (var i = 0; i < n; i++) {
      var draws = fixtureDraws(ctx, R), sims = {};
      unionIds.forEach(function (id) { sims[id] = simPlayerDetail(ctx.els[id], ctx, R, draws); });
      var pts = entries.map(function (e) { return e.xi ? entryPoints(e.xi, e.bench, e.cap, e.me ? vice : null, sims, ctx) : null; });
      var known = pts.filter(function (p) { return p !== null; }); var fill = known.length ? sum(known) / known.length : 0;
      var totals = entries.map(function (e, j) { return e.total + (pts[j] === null ? fill : pts[j]); });
      var myTotal = totals[entries.indexOf(meRow)];
      var rank = 1; totals.forEach(function (t, j) { if (entries[j] !== meRow && t > myTotal) rank++; });
      ranks.push(rank); if (rank === 1) wins++;
    }
    ranks.sort(sortNum);
    res.medianRank = quantile(ranks, 0.5); res.rankBand = [quantile(ranks, 0.1), quantile(ranks, 0.9)]; res.iters = n;
    res.direction = res.currentRank === null ? "hold" : (res.medianRank < res.currentRank - 0.5 ? "up" : (res.medianRank > res.currentRank + 0.5 ? "down" : "hold"));
    if (res.gwsOfData >= MC_MIN_GWS_FOR_PWIN) { res.pWin = wins / n; res.pWinNote = "P(win) shown: " + res.gwsOfData + " gameweeks of data"; }
    else res.pWinNote = "Direction and rank band only: " + res.gwsOfData + " of the " + MC_MIN_GWS_FOR_PWIN + " gameweeks needed before a win probability is reported";
    res.note = "One-gameweek simulation against the rivals' actual GW" + ctx.currentEvent + " picks; entries without picks data score the simulated field mean.";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- tournament (E5)

function ranksOf(v) {
  v = arr(v);
  var idx = v.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x - b.x; });
  var r = new Array(v.length), i = 0;
  while (i < idx.length) { var j = i; while (j + 1 < idx.length && idx[j + 1].x === idx[i].x) j++; var avg = (i + j) / 2 + 1; for (var k = i; k <= j; k++) r[idx[k].i] = avg; i = j + 1; }
  return r;
}
function spearman(a, b) {
  try {
    var x = arr(a).map(function (v) { return num(v, NaN); }), y = arr(b).map(function (v) { return num(v, NaN); });
    var n = Math.min(x.length, y.length), px = [], py = [];
    for (var i = 0; i < n; i++) if (isFinite(x[i]) && isFinite(y[i])) { px.push(x[i]); py.push(y[i]); }
    if (px.length < 3) return 0;
    var rx = ranksOf(px), ry = ranksOf(py), mx = sum(rx) / rx.length, my = sum(ry) / ry.length, sxy = 0, sxx = 0, syy = 0;
    for (var j = 0; j < rx.length; j++) { sxy += (rx[j] - mx) * (ry[j] - my); sxx += (rx[j] - mx) * (rx[j] - mx); syy += (ry[j] - my) * (ry[j] - my); }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  } catch (e) { return 0; }
}
function mae(a, b) {
  try {
    var x = arr(a), y = arr(b), n = Math.min(x.length, y.length), s = 0, c = 0;
    for (var i = 0; i < n; i++) { var u = num(x[i], NaN), v = num(y[i], NaN); if (isFinite(u) && isFinite(v)) { s += Math.abs(u - v); c++; } }
    return c ? s / c : 0;
  } catch (e) { return 0; }
}
function calibrateToPoints(pred, actual) {
  // E-047: MAE is only comparable across models when every predictor is in the same units. BPS
  // per 90 runs about ten times points per 90, so the raw column ranked units, not accuracy
  // (bps_rate 11.23 against component_xp 2.43 on the GW4 snapshot). Each predictor is rescaled by
  // mean(points) / mean(prediction) over the gameweek it was fitted on before the MAE is taken.
  // Spearman is scale-invariant and is left exactly as it was.
  var res = { scale: 1, calibrated: false, pred: arr(pred).slice() };
  var p = arr(pred), a = arr(actual), n = Math.min(p.length, a.length), sp = 0, sa = 0, c = 0;
  for (var i = 0; i < n; i++) {
    var u = num(p[i], NaN), v = num(a[i], NaN);
    if (isFinite(u) && isFinite(v)) { sp += u; sa += v; c++; }
  }
  if (!c || Math.abs(sp) < 1e-9) return res;                       // a zero mean cannot be scaled
  var k = sa / sp;
  if (!isFinite(k) || k <= 0) return res;
  res.scale = k; res.calibrated = true;
  res.pred = p.map(function (x) { return num(x, 0) * k; });
  return res;
}
function tournament(live) {
  var res = { models: TOURNAMENT_MODELS.map(function (m) { return { key: m.key, name: m.name, spearman: null, mae: null, maeRaw: null, maeScale: null, maeCalibrated: false, transitions: 0, perTransition: [], wins: 0, holdout: 0, gate: null, promotable: false, crps: null, logScore: null, crpsPerTransition: [], logPerTransition: [], crpsWins: 0, crpsHoldout: 0, gateCrps: null, promotableCrps: false }; }), leader: null, decidable: false, promotable: false, transitions: 0, transitionWinners: [], maeUnits: "points", maeNote: "", crpsLeader: null, logScoreLeader: null, promotableCrps: false, transitionWinnersCrps: [], authoritativeMetric: "spearman", distNote: "", note: "" };
  try {
    if (!isObj(live) || !isObj(live.gw)) { res.note = "no finished gameweeks in the snapshot"; return res; }
    var keys = Object.keys(live.gw).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum);
    var types = {}; arr(live.elements).forEach(function (el) { if (isObj(el)) types[el.id] = elType(el); });
    var acc = {};                                                       // cumulative per element
    var pacc = { 1: { min: 0, xg: 0, xa: 0 }, 2: { min: 0, xg: 0, xa: 0 }, 3: { min: 0, xg: 0, xa: 0 }, 4: { min: 0, xg: 0, xa: 0 } };
    var tacc = {};                                                      // cumulative team xG for and against
    var fxById = {}, fxOf = {}, teamOf = {};                            // F5 needs the opponent of the gameweek it predicts
    arr(live.teams).forEach(function (tm) { if (isObj(tm) && tm.id !== undefined) tacc[tm.id] = { g: 0, xgf: 0, xga: 0 }; });
    arr(live.fixtures).forEach(function (f) {
      if (!isObj(f)) return;
      if (f.id !== undefined) fxById[f.id] = f;
      var ev = intOf(f.event, -1); if (ev < 0) return;
      var kh = ev + ":" + f.team_h, ka = ev + ":" + f.team_a;
      (fxOf[kh] = fxOf[kh] || []).push({ team: num(f.team_h, -1), opp: num(f.team_a, -1), home: true });
      (fxOf[ka] = fxOf[ka] || []).push({ team: num(f.team_a, -1), opp: num(f.team_h, -1), home: false });
    });
    arr(live.elements).forEach(function (el) { if (isObj(el)) teamOf[el.id] = num(el.team, -1); });
    var scores = {}; TOURNAMENT_MODELS.forEach(function (m) { scores[m.key] = { rho: [], mae: [], raw: [], scale: [], uncal: 0, crps: [], logs: [] }; });
    // The spread of realised points over the gameweeks already seen, which is what the predictive
    // distribution's dispersion is moment-matched to. Updated after each gameweek is scored, so it
    // never contains the gameweek being predicted.
    var dAcc = { n: 0, sum: 0, sum2: 0 };
    for (var i = 0; i < keys.length; i++) {
      var g = keys[i], rows = isObj(live.gw[g]) && isObj(live.gw[g].elements) ? live.gw[g].elements : {};
      var TSprev = strengthFromCounts(tacc);                            // strength from the gameweeks BEFORE g
      if (i > 0) {
        var preds = {}; TOURNAMENT_MODELS.forEach(function (m) { preds[m.key] = []; }); var actual = [];
        var priors = [];                                              // each player's own prior per-game points
        var hgroups = hierGroups(hierRowsFromAcc(acc, types));        // the hierarchy on gameweeks <= k only
        Object.keys(rows).forEach(function (id) {
          var a = acc[id]; if (!a || !a.played) return;
          var row = rows[id]; if (!Array.isArray(row) || num(row[0], 0) <= 0) return;
          var t = types[id] || 3, S = SCORING[t];
          var seasonMean = a.pts / a.played, per90 = a.min ? a.pts / a.min * 90 : 0, w = a.played / (a.played + SHRINK_K);
          var shrunk = w * per90 + (1 - w) * (PRIOR_PPS[t] || 3.5);
          var bps = a.bps / a.played, ict = a.ict / a.played;
          var component = (a.min / a.played >= 60 ? 2 : 1) + a.xg / a.played * S.goal + a.xa / a.played * S.assist + a.cs / a.played * S.cs + (a.gc / a.played) / 2 * S.gc_per2 + a.dcHits / a.played * S.dc + a.bonus / a.played;
          preds.season_mean.push(seasonMean); preds.last_gw.push(a.last); preds.per90.push(per90); preds.shrunk_per90.push(shrunk);
          preds.ict_rate.push(ict); preds.bps_rate.push(bps); preds.blend.push((seasonMean + shrunk + bps / 10) / 3); preds.component_xp.push(component);
          preds.player_xg.push(playerXgPredict(a, pacc[t], t, S, fxOf[g + ":" + teamOf[id]], TSprev));
          preds.hier_pool.push(hierPosterior({ id: num(id, 0), type: t, n: a.played, mean: seasonMean, variance: a.played >= 2 ? Math.max(0, (num(a.pts2, 0) - a.played * seasonMean * seasonMean) / (a.played - 1)) : NaN }, hgroups[t]).postMean);
          priors.push(seasonMean);
          actual.push(num(row[2], 0));
        });
        if (actual.length >= 10) TOURNAMENT_MODELS.forEach(function (m) {
          var S = scores[m.key];
          S.rho.push(spearman(preds[m.key], actual));
          var cal = calibrateToPoints(preds[m.key], actual);
          S.mae.push(mae(cal.pred, actual));
          S.raw.push(mae(preds[m.key], actual));
          S.scale.push(cal.scale);
          if (!cal.calibrated) S.uncal++;
        });
        // CRPS and the logarithmic score over the whole predicted distribution. Every figure here
        // comes from gameweeks <= k: the rescaling factor is the players' own prior per-game points
        // against the model's own mean prediction, and the dispersion is moment-matched to the
        // spread of points already observed. Neither reads the gameweek being scored.
        if (actual.length >= 10) {
          var dmean = dAcc.n ? dAcc.sum / dAcc.n : 0;
          var dvar = dAcc.n > 1 ? Math.max(0, (dAcc.sum2 - dAcc.n * dmean * dmean) / (dAcc.n - 1)) : 0;
          var disp = nbDispersion(dmean, dvar, PTS_DIST_MIN);
          var priorMean = priors.length ? sum(priors) / priors.length : 0;
          var pmfCache = {};
          var distOf = function (mu) {
            var key = Math.round(num(mu, 0) * PMF_CACHE_STEP);
            if (!pmfCache[key]) pmfCache[key] = pointsPmf(key / PMF_CACHE_STEP, disp, {});
            return pmfCache[key];
          };
          TOURNAMENT_MODELS.forEach(function (m) {
            var pv = preds[m.key], pm = 0, c = 0, q;
            for (q = 0; q < pv.length; q++) { var u = num(pv[q], NaN); if (isFinite(u)) { pm += u; c++; } }
            pm = c ? pm / c : 0;
            var k = (pm > 0 && priorMean > 0) ? priorMean / pm : 1;
            if (!isFinite(k) || k <= 0) k = 1;
            var sc = 0, sl = 0, n2 = 0;
            for (q = 0; q < pv.length && q < actual.length; q++) {
              var mu = num(pv[q], NaN); if (!isFinite(mu)) continue;
              var d = distOf(mu * k);
              sc += crpsDiscrete(d, actual[q]); sl += logScoreDiscrete(d, actual[q]); n2++;
            }
            if (n2) { scores[m.key].crps.push(sc / n2); scores[m.key].logs.push(sl / n2); }
          });
        }
      }
      Object.keys(rows).forEach(function (id) {
        var row = rows[id]; if (!Array.isArray(row)) return;
        var a = acc[id] = acc[id] || { played: 0, min: 0, pts: 0, pts2: 0, xg: 0, xa: 0, cs: 0, gc: 0, dcHits: 0, bps: 0, ict: 0, bonus: 0, last: 0 };
        if (num(row[0], 0) > 0) { var pv0 = num(row[2], 0); a.pts2 = num(a.pts2, 0) + pv0 * pv0; dAcc.n++; dAcc.sum += pv0; dAcc.sum2 += pv0 * pv0; a.played++; a.min += num(row[0], 0); a.pts += num(row[2], 0); a.xg += num(row[3], 0); a.xa += num(row[4], 0); a.cs += num(row[11], 0); a.gc += num(row[12], 0); a.bps += num(row[7], 0); a.ict += num(row[8], 0); a.bonus += num(row[13], 0); var thr = SCORING[types[id] || 3].dc_threshold; if (thr && num(row[6], 0) >= thr) a.dcHits++; var pt = types[id] || 3; if (pacc[pt]) { pacc[pt].min += num(row[0], 0); pacc[pt].xg += num(row[3], 0); pacc[pt].xa += num(row[4], 0); } }
        a.last = num(row[2], 0);
      });
      Object.keys(acc).forEach(function (id) { if (!rows[id]) acc[id].last = 0; });
      var fxg = isObj(live.gw[g]) && isObj(live.gw[g].fixture_xg) ? live.gw[g].fixture_xg : null;
      if (fxg) Object.keys(fxg).forEach(function (fid) {
        var f = fxById[fid], v = fxg[fid];
        if (!isObj(f) || !isObj(v)) return;
        var hx = num(v.h, 0), ax = num(v.a, 0);
        if (tacc[f.team_h]) { tacc[f.team_h].g++; tacc[f.team_h].xgf += hx; tacc[f.team_h].xga += ax; }
        if (tacc[f.team_a]) { tacc[f.team_a].g++; tacc[f.team_a].xgf += ax; tacc[f.team_a].xga += hx; }
      });
    }
    res.models.forEach(function (m) {
      var s = scores[m.key]; m.transitions = s.rho.length;
      m.perTransition = s.rho.slice();                              // published even when it is empty
      if (!s.rho.length) return;
      m.spearman = sum(s.rho) / s.rho.length;
      m.mae = sum(s.mae) / s.mae.length;
      m.maeRaw = sum(s.raw) / s.raw.length;
      m.maeScale = sum(s.scale) / s.scale.length;
      m.maeCalibrated = s.uncal === 0;
      m.crpsPerTransition = s.crps.slice();
      m.logPerTransition = s.logs.slice();
      if (s.crps.length) m.crps = sum(s.crps) / s.crps.length;
      if (s.logs.length) m.logScore = sum(s.logs) / s.logs.length;
    });
    res.maeNote = "MAE is reported in points: each predictor is rescaled by mean(points) / mean(prediction) over the gameweek it was fitted on, so the column ranks accuracy and not units. maeRaw keeps the unscaled figure. Spearman needs no rescaling.";
    res.transitions = Math.max.apply(null, [0].concat(res.models.map(function (m) { return m.transitions; })));
    var ranked = res.models.filter(function (m) { return m.spearman !== null; }).sort(function (a, b) { return b.spearman - a.spearman || a.mae - b.mae; });
    res.leader = ranked.length ? ranked[0].key : null;
    // E-086: this flag used to be called `promotable`, which read as "something can be
    // promoted" while every model's own gate was shut. It is the transition-count half of the
    // gate and nothing else, so it is `decidable`: enough transitions exist for the gate to be
    // decided. `promotable` below is the honest reading of the word.
    res.decidable = res.transitions >= TOURNAMENT_PROMOTE_AT;
    // Which model led each transition, and then the SHARED promotion gate (CLAUDE.md J) per
    // model: three scored transitions, three of them led, and a two-gameweek trailing run.
    // promotionGate is the one door; F4's minutes walk-forward goes through the same function.
    var winners = [];
    for (var wi = 0; wi < res.transitions; wi++) {
      var bestKey = null, bestV = null;
      res.models.forEach(function (m) {
        var pt = Array.isArray(m.perTransition) && m.perTransition.length > wi ? num(m.perTransition[wi], NaN) : NaN;
        if (!isFinite(pt)) return;
        if (bestV === null || pt > bestV) { bestV = pt; bestKey = m.key; }
      });
      winners.push(bestKey);
    }
    res.transitionWinners = winners;
    res.models.forEach(function (m) {
      var wins = 0, trail = 0;
      winners.forEach(function (k) { if (k === m.key) wins++; });
      for (var ti = winners.length - 1; ti >= 0; ti--) { if (winners[ti] === m.key) trail++; else break; }
      m.wins = wins; m.holdout = trail;
      m.gate = promotionGate({ transitions: m.transitions, wins: wins, holdout: trail, challenger: m.name, incumbent: "E1 xP in production" });
      m.promotable = m.gate.promotable;
    });
    // E-086: the top-level word now means what it says — at least one model's own gate is open.
    res.promotable = res.models.some(function (m) { return m.promotable === true; });
    // The same gate, decided on CRPS instead of Spearman, computed and published BESIDE the
    // authoritative verdict rather than in place of it. Lower CRPS wins a transition. Switching
    // the metric the gate runs on rewrites every past verdict at once, so it is a decision with its
    // own round and its own before-and-after, not a side effect of adding a column (A2 law 5).
    var cw = [];
    for (var ci = 0; ci < res.transitions; ci++) {
      var bk = null, bv = null;
      res.models.forEach(function (m) {
        var v = Array.isArray(m.crpsPerTransition) && m.crpsPerTransition.length > ci ? num(m.crpsPerTransition[ci], NaN) : NaN;
        if (!isFinite(v)) return;
        if (bv === null || v < bv) { bv = v; bk = m.key; }
      });
      cw.push(bk);
    }
    res.transitionWinnersCrps = cw;
    res.models.forEach(function (m) {
      var w = 0, tr = 0;
      cw.forEach(function (k) { if (k === m.key) w++; });
      for (var ti = cw.length - 1; ti >= 0; ti--) { if (cw[ti] === m.key) tr++; else break; }
      m.crpsWins = w; m.crpsHoldout = tr;
      m.gateCrps = promotionGate({ transitions: Array.isArray(m.crpsPerTransition) ? m.crpsPerTransition.length : 0, wins: w, holdout: tr, challenger: m.name + " on CRPS", incumbent: "E1 xP in production" });
      m.promotableCrps = m.gateCrps.promotable;
    });
    res.promotableCrps = res.models.some(function (m) { return m.promotableCrps === true; });
    var scoredC = res.models.filter(function (m) { return m.crps !== null; }).sort(function (a, b) { return a.crps - b.crps; });
    var scoredL = res.models.filter(function (m) { return m.logScore !== null; }).sort(function (a, b) { return a.logScore - b.logScore; });
    res.crpsLeader = scoredC.length ? scoredC[0].key : null;
    res.logScoreLeader = scoredL.length ? scoredL[0].key : null;
    res.distNote = scoredC.length
      ? ("CRPS and the logarithmic score run over the whole predicted distribution (lower is better, both walk-forward). CRPS leader " +
         res.crpsLeader + " at " + scoredC[0].crps.toFixed(4) + "; log score leader " + res.logScoreLeader +
         (scoredL.length ? " at " + scoredL[0].logScore.toFixed(4) : "") +
         ". The gate this app promotes on is still Spearman (authoritativeMetric): the CRPS gate is published beside it as gateCrps and promotableCrps, and moving the gate onto it is its own decision with its own before-and-after.")
      : "fewer than ten scored rows in any transition: no distributional score";
    res.note = res.transitions
      ? (res.transitions + " walk-forward transition" + (res.transitions === 1 ? "" : "s") + "; promotion needs " + TOURNAMENT_PROMOTE_AT +
         " with a " + PROMOTION_HOLDOUT_WEEKS + "-gameweek trailing hold-out. The gate is " +
         (res.decidable ? "decidable" : "not decidable yet") + " and " +
         (res.promotable ? "one or more models have passed it" : "no model has passed it") + ".")
      : "fewer than two finished gameweeks: no transition to score";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// The E2 xG shrinkage, factored out so the tournament can rebuild team strength from the
// gameweeks it is allowed to see without a second copy of the formula (F5 walk-forward).
function strengthFromCounts(counts) {
  var res = { TS: {}, Lbar: LBAR_PRIOR };
  try {
    var c = isObj(counts) ? counts : {};
    var sx = 0, sg = 0;
    Object.keys(c).forEach(function (t) { sx += num(c[t] && c[t].xgf, 0); sg += num(c[t] && c[t].g, 0); });
    var Lbar = sg > 0 && sx > 0 ? sx / sg : LBAR_PRIOR;
    res.Lbar = Lbar;
    Object.keys(c).forEach(function (t) {
      var a = isObj(c[t]) ? c[t] : { g: 0, xgf: 0, xga: 0 };
      var g = num(a.g, 0), w = g / (g + TS_K);
      res.TS[t] = {
        att: w * ((g ? num(a.xgf, 0) / g : 0) / Lbar) + (1 - w),
        def: w * ((g ? num(a.xga, 0) / g : 0) / Lbar) + (1 - w),
        g: g, xgf: num(a.xgf, 0), xga: num(a.xga, 0), Lbar: Lbar
      };
    });
  } catch (e) { /* total */ }
  return res;
}

// The player-xG challenger as the tournament scores it: the same xG90 x att x def shape playerXg
// ships, but built from the cumulative rows the walk-forward is allowed to see and from team
// strength rebuilt on those gameweeks only, so it can never read the gameweek it is predicting.
function playerXgPredict(a, prior, t, S, fixtures, TSprev) {
  try {
    if (!isObj(a) || !num(a.played, 0) || !isObj(S)) return 0;
    var fx = arr(fixtures);
    if (!fx.length) return 0;
    var minsAvg = clamp(num(a.min, 0) / num(a.played, 1), 0, 90), frac = clamp(minsAvg / 90, 0, 1);
    var mn = num(a.min, 0), wr = mn / (mn + 270);
    var pr = isObj(prior) ? prior : { min: 0, xg: 0, xa: 0 };
    var pm = num(pr.min, 0);
    var pxg = pm > 0 ? num(pr.xg, 0) / pm * 90 : 0, pxa = pm > 0 ? num(pr.xa, 0) / pm * 90 : 0;
    var xg90 = wr * (mn ? num(a.xg, 0) / mn * 90 : 0) + (1 - wr) * pxg;
    var xa90 = wr * (mn ? num(a.xa, 0) / mn * 90 : 0) + (1 - wr) * pxa;
    var TS = isObj(TSprev) && isObj(TSprev.TS) ? TSprev.TS : {};
    var total = 0;
    fx.forEach(function (f) {
      if (!isObj(f)) return;
      var at = tsEntry(TS, f.team), df = tsEntry(TS, f.opp);
      var mult = at.att * df.def * (f.home ? HOME_ADV : AWAY_ADV);
      var lam = xg90 * mult * frac, lamA = xa90 * mult * frac;
      var lamOpp = df.Lbar * df.att * at.def * (f.home ? AWAY_ADV : HOME_ADV);
      var pcs = clamp(Math.exp(-lamOpp), 0, 1);
      total += (minsAvg >= 60 ? S.play_long : S.play_short) + lam * S.goal + lamA * S.assist +
        (minsAvg >= 60 ? pcs : 0) * S.cs + (S.gc_per2 ? (lamOpp * frac) / 2 * S.gc_per2 : 0) +
        (num(a.dcHits, 0) / num(a.played, 1)) * S.dc + (num(a.bonus, 0) / num(a.played, 1));
    });
    return isFinite(total) ? total : 0;
  } catch (e) { return 0; }
}

// ------------------------------------------------- calibration and fitting (F4, F5, F8 support)

// A logistic that is total: NaN carries no information and answers 0.5, the infinities saturate,
// and every finite input is squashed into [0,1]. Everything downstream (Brier, the minutes model,
// the promotion gate) relies on this never producing a NaN.
function logistic(z) {
  var v = typeof z === "number" ? z : num(z, NaN);
  if (v !== v) return 0.5;
  if (v === Infinity || v > 40) return 1;
  if (v === -Infinity || v < -40) return 0;
  return 1 / (1 + Math.exp(-v));
}

// Gauss-Jordan with partial pivoting. Returns null rather than throwing or returning NaN when the
// system is singular or any coefficient is not finite — the Newton step then stops where it is.
function solveLinear(A, b) {
  try {
    var rhs = arr(b), n = rhs.length;
    if (!n || arr(A).length < n) return null;
    var M = [], i, j;
    for (i = 0; i < n; i++) {
      var src = arr(A[i]);
      if (src.length < n) return null;
      var row = [];
      for (j = 0; j < n; j++) { var v = num(src[j], NaN); if (!isFinite(v)) return null; row.push(v); }
      var r = num(rhs[i], NaN); if (!isFinite(r)) return null;
      row.push(r); M.push(row);
    }
    for (var c = 0; c < n; c++) {
      var piv = c;
      for (var p = c + 1; p < n; p++) if (Math.abs(M[p][c]) > Math.abs(M[piv][c])) piv = p;
      if (!(Math.abs(M[piv][c]) > 1e-12)) return null;
      var tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
      for (var q = 0; q < n; q++) {
        if (q === c) continue;
        var f = M[q][c] / M[c][c];
        if (!isFinite(f)) return null;
        for (var k = c; k <= n; k++) M[q][k] -= f * M[c][k];
      }
    }
    var out = [];
    for (i = 0; i < n; i++) { var x = M[i][n] / M[i][i]; if (!isFinite(x)) return null; out.push(x); }
    return out;
  } catch (e) { return null; }
}

// Ridge-penalised logistic regression by IRLS (Newton-Raphson on the penalised log-likelihood).
// Deterministic, seedless, dependency-free. The design matrix carries its own intercept column —
// this function adds nothing — so the caller can say exactly which term is which.
function fitLogistic(X, y, opts) {
  var o = isObj(opts) ? opts : {};
  var ridge = num(o.ridge, 1e-3); if (!(ridge > 0) || !isFinite(ridge)) ridge = 1e-3;
  var maxIter = clamp(intOf(o.maxIter, 20), 1, 200);
  var tol = num(o.tol, 1e-7); if (!(tol > 0)) tol = 1e-7;
  var res = { ok: false, beta: [], k: 0, n: 0, iters: 0, converged: false, ridge: ridge, logLik: 0, ones: 0, baseRate: 0, note: "" };
  try {
    var rows = arr(X), ys = arr(y), i, j;
    var n = Math.min(rows.length, ys.length);
    if (!n) { res.note = "no rows to fit"; return res; }
    var k = arr(rows[0]).length;
    if (!k) { res.note = "the design matrix has no columns"; return res; }
    res.k = k;
    var Xc = [], yc = [], ones = 0;
    for (i = 0; i < n; i++) {
      var src = arr(rows[i]); if (src.length !== k) continue;
      var keep = true, row = [];
      for (j = 0; j < k; j++) { var v = num(src[j], NaN); if (!isFinite(v)) { keep = false; break; } row.push(v); }
      var yv = num(ys[i], NaN);
      if (!keep || !isFinite(yv)) continue;
      Xc.push(row); yc.push(yv > 0.5 ? 1 : 0); ones += yv > 0.5 ? 1 : 0;
    }
    var m = Xc.length;
    res.n = m; res.ones = ones; res.baseRate = m ? clamp(ones / m, 0, 1) : 0;
    if (m < k + 2) { res.note = "fewer usable rows (" + m + ") than the fit needs (" + (k + 2) + ")"; return res; }
    var beta = []; for (j = 0; j < k; j++) beta.push(0);
    for (var it = 0; it < maxIter; it++) {
      var H = [], grad = [], a, b2;
      for (a = 0; a < k; a++) { grad.push(0); var hr = []; for (b2 = 0; b2 < k; b2++) hr.push(0); H.push(hr); }
      for (i = 0; i < m; i++) {
        var z = 0, xi = Xc[i];
        for (j = 0; j < k; j++) z += beta[j] * xi[j];
        var pr = logistic(z);
        var w = Math.max(pr * (1 - pr), 1e-6);
        var resid = yc[i] - pr;
        for (a = 0; a < k; a++) {
          grad[a] += resid * xi[a];
          for (b2 = a; b2 < k; b2++) H[a][b2] += w * xi[a] * xi[b2];
        }
      }
      for (a = 0; a < k; a++) { for (b2 = 0; b2 < a; b2++) H[a][b2] = H[b2][a]; }
      for (a = 0; a < k; a++) { grad[a] -= ridge * beta[a]; H[a][a] += ridge; }
      var step = solveLinear(H, grad);
      if (!step) { res.note = "the Newton step was singular at iteration " + (it + 1) + "; the fit stopped there"; break; }
      var moved = 0;
      for (a = 0; a < k; a++) { var d = clamp(step[a], -4, 4); beta[a] += d; if (Math.abs(d) > moved) moved = Math.abs(d); }
      res.iters = it + 1;
      if (moved < tol) { res.converged = true; break; }
    }
    for (j = 0; j < k; j++) if (!isFinite(beta[j])) { res.note = "the fit produced a coefficient that is not finite"; return res; }
    var ll = 0;
    for (i = 0; i < m; i++) {
      var zz = 0; for (j = 0; j < k; j++) zz += beta[j] * Xc[i][j];
      var pp = clamp(logistic(zz), 1e-9, 1 - 1e-9);
      ll += yc[i] ? Math.log(pp) : Math.log(1 - pp);
    }
    res.beta = beta; res.logLik = isFinite(ll) ? ll : 0; res.ok = true;
    if (!res.note) res.note = res.converged ? "converged in " + res.iters + " Newton steps" : "stopped at the iteration cap of " + maxIter;
  } catch (e) { res.note = "engine error: " + errMsg(e); res.ok = false; }
  return res;
}

// Brier score of a probability forecast against 0/1 outcomes, with the base-rate forecast beside
// it. Both are in [0,1] by construction; skill is the usual 1 - brier/baseBrier, clamped.
function brier(predictions, outcomes) {
  var res = { brier: 0, n: 0, baseRate: 0, baseBrier: 0, skill: 0, ok: false };
  try {
    var p = arr(predictions), y = arr(outcomes), n = Math.min(p.length, y.length), s = 0, ones = 0, c = 0;
    for (var i = 0; i < n; i++) {
      var pv = num(p[i], NaN), yv = num(y[i], NaN);
      if (!isFinite(pv) || !isFinite(yv)) continue;
      pv = clamp(pv, 0, 1); yv = yv > 0.5 ? 1 : 0;
      s += (pv - yv) * (pv - yv); ones += yv; c++;
    }
    if (!c) return res;
    res.n = c; res.brier = clamp(s / c, 0, 1); res.baseRate = clamp(ones / c, 0, 1);
    res.baseBrier = clamp(res.baseRate * (1 - res.baseRate), 0, 1);
    res.skill = res.baseBrier > 0 ? clamp(1 - res.brier / res.baseBrier, -1, 1) : 0;
    res.ok = true;
  } catch (e) { /* total */ }
  return res;
}

// Reliability curve: equal-width probability bins with the mean forecast and the observed rate in
// each. maxGap is the largest |mean forecast - observed rate| over the non-empty bins.
function reliability(predictions, outcomes, bins) {
  var nb = clamp(intOf(bins, 10), 2, 20);
  var res = { bins: [], n: 0, nBins: nb, baseRate: 0, maxGap: 0, ok: false };
  try {
    var p = arr(predictions), y = arr(outcomes), n = Math.min(p.length, y.length), i;
    var acc = [];
    for (i = 0; i < nb; i++) acc.push({ lo: i / nb, hi: (i + 1) / nb, n: 0, sumP: 0, sumY: 0 });
    var c = 0, ones = 0;
    for (i = 0; i < n; i++) {
      var pv = num(p[i], NaN), yv = num(y[i], NaN);
      if (!isFinite(pv) || !isFinite(yv)) continue;
      pv = clamp(pv, 0, 1); yv = yv > 0.5 ? 1 : 0;
      var b = Math.min(nb - 1, Math.floor(pv * nb));
      acc[b].n++; acc[b].sumP += pv; acc[b].sumY += yv; c++; ones += yv;
    }
    res.n = c; res.baseRate = c ? clamp(ones / c, 0, 1) : 0;
    acc.forEach(function (a) {
      var mp = a.n ? clamp(a.sumP / a.n, 0, 1) : 0, my = a.n ? clamp(a.sumY / a.n, 0, 1) : 0;
      var gap = a.n ? Math.abs(mp - my) : 0;
      if (a.n && gap > res.maxGap) res.maxGap = gap;
      res.bins.push({ lo: a.lo, hi: a.hi, n: a.n, meanPred: mp, meanOutcome: my, gap: gap });
    });
    res.ok = c > 0;
  } catch (e) { /* total */ }
  return res;
}

// THE promotion gate (CLAUDE.md J, E5). One function, used by the model tournament and by the
// minutes walk-forward, so a challenger can never be promoted through a second, softer door.
// Three conditions, all required: at least TOURNAMENT_PROMOTE_AT scored transitions, at least
// that many of them won, and the last PROMOTION_HOLDOUT_WEEKS of them won in a row (the hold-out).
function promotionGate(opts) {
  var o = isObj(opts) ? opts : {};
  var need = TOURNAMENT_PROMOTE_AT, needHold = PROMOTION_HOLDOUT_WEEKS;
  var transitions = Math.max(0, intOf(o.transitions, 0));
  var wins = clamp(intOf(o.wins, 0), 0, transitions);
  var holdout = clamp(intOf(o.holdout, 0), 0, transitions);
  var res = {
    challenger: String(o.challenger || "challenger"), incumbent: String(o.incumbent || "incumbent"),
    transitions: transitions, wins: wins, holdout: holdout, need: need, needHoldout: needHold,
    transitionsOk: transitions >= need, winsOk: wins >= need, holdoutOk: holdout >= needHold,
    promotable: false, reasons: [], note: ""
  };
  res.promotable = res.transitionsOk && res.winsOk && res.holdoutOk;
  if (!res.transitionsOk) res.reasons.push(transitions + " scored transition" + (transitions === 1 ? "" : "s") + "; the gate needs " + need);
  if (!res.winsOk) res.reasons.push(wins + " of " + transitions + " won; the gate needs " + need);
  if (!res.holdoutOk) res.reasons.push("the trailing hold-out is " + holdout + " gameweek" + (holdout === 1 ? "" : "s") + "; the gate needs " + needHold);
  res.note = res.promotable
    ? res.challenger + " clears the gate: " + wins + " of " + transitions + " transitions won with a " + holdout + "-gameweek hold-out."
    : res.challenger + " does not drive anything: " + res.reasons.join("; ") + ".";
  return res;
}

// ------------------------------------------------- minutes model (F4)

// The five slots the spec names. Four are fitted from history; the flag is a present-tense field
// with no per-gameweek history in the snapshot, and midweek European load is not in the snapshot
// at all. Both are declared, both are reported as not fitted, and neither is quietly dropped.
function minutesTerms(fit) {
  var beta = isObj(fit) && Array.isArray(fit.beta) ? fit.beta : [];
  var names = MINUTES_FEATURES;
  var out = [];
  for (var i = 0; i < names.length; i++) {
    out.push({ name: names[i], coef: beta.length > i && isFinite(num(beta[i], NaN)) ? num(beta[i], 0) : null, fitted: beta.length > i, available: true, how: "fitted by IRLS on the finished gameweeks" });
  }
  out.push({
    name: "flag", coef: null, fitted: false, available: true, how: "applied, not fitted",
    why: "the snapshot carries one current status and chance per player, not a status per gameweek, so a flag coefficient cannot be fitted from history; the flag enters as the same availability factor E1 uses, multiplying the fitted probability"
  });
  out.push({
    name: "european_load", coef: null, fitted: false, available: false, how: "not in the snapshot",
    why: "the fixture list this app pulls is the Premier League fixture list; it carries no midweek European fixtures, so competition load is not a feature here and is not pretended to be one"
  });
  return out;
}

// Panel of everything the minutes features need, built once per snapshot.
function minutesPanel(live) {
  var res = { gws: [], deadlines: {}, teamGames: {}, rows: {}, els: [], teamOf: {}, ok: false };
  try {
    if (!isObj(live)) return res;
    arr(live.events).forEach(function (e) {
      if (!isObj(e)) return;
      var id = intOf(e.id, 0), t = Date.parse(e.deadline_time);
      if (id && isFinite(t)) res.deadlines[id] = t;
    });
    arr(live.fixtures).forEach(function (f) {
      if (!isObj(f)) return;
      var ev = intOf(f.event, -1); if (ev < 0) return;
      var m = res.teamGames[ev] = res.teamGames[ev] || {};
      m[f.team_h] = (m[f.team_h] || 0) + 1; m[f.team_a] = (m[f.team_a] || 0) + 1;
    });
    var gw = isObj(live.gw) ? live.gw : {};
    res.gws = Object.keys(gw).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum);
    res.gws.forEach(function (g) { res.rows[g] = isObj(gw[g]) && isObj(gw[g].elements) ? gw[g].elements : {}; });
    arr(live.elements).forEach(function (el) { if (isObj(el) && el.id !== undefined) { res.els.push(el); res.teamOf[el.id] = num(el.team, -1); } });
    res.ok = res.gws.length > 0 && res.els.length > 0;
  } catch (e) { /* total */ }
  return res;
}

// [intercept, starts in the last three, minutes trend over the last three, minutes rate,
//  days since the last start] — every one bounded, so a junk history cannot blow the fit up.
function minutesFeatureVector(hist, targetGw, deadlines) {
  // E-074: a null row in the history is not a gameweek of zero minutes, it is no row at all, and
  // `last3[last3.length - 1].min` threw on it. Filtered once, at the top, so every reader below
  // can assume an object.
  var h = arr(hist).filter(isObj);
  var last3 = h.slice(-3);
  var starts3 = 0, games3 = 0;
  last3.forEach(function (r) { starts3 += num(r && r.starts, 0); games3 += Math.max(1, num(r && r.games, 1)); });
  var f1 = games3 > 0 ? clamp(starts3 / games3, 0, 1) : 0;
  var lastMin = last3.length ? num(last3[last3.length - 1].min, 0) : 0;
  var prevMin = lastMin;
  if (last3.length > 1) { var s = 0; for (var i = 0; i < last3.length - 1; i++) s += num(last3[i].min, 0); prevMin = s / (last3.length - 1); }
  var f2 = clamp((lastMin - prevMin) / 90, -1, 1);
  var totMin = 0, totGames = 0;
  h.forEach(function (r) { totMin += num(r && r.min, 0); totGames += Math.max(1, num(r && r.games, 1)); });
  var f3 = totGames > 0 ? clamp(totMin / (90 * totGames), 0, 1) : 0;
  var lastStart = 0;
  h.forEach(function (r) { if (num(r && r.starts, 0) > 0) lastStart = intOf(r.gw, 0); });
  var days = MINUTES_MAX_DAYS;
  var D = isObj(deadlines) ? deadlines : {};
  var t1 = num(D[intOf(targetGw, 0)], NaN), t0 = lastStart ? num(D[lastStart], NaN) : NaN;
  if (isFinite(t1) && isFinite(t0) && t1 >= t0) days = clamp((t1 - t0) / 86400000, 0, MINUTES_MAX_DAYS);
  var f4 = clamp(days / MINUTES_MAX_DAYS, 0, 1);
  return [1, f1, f2, f3, f4];
}

// One walk-forward row set: features from every gameweek strictly BEFORE targetGw, outcome
// "did he start in targetGw". Only players whose club actually had a fixture in targetGw get a
// row — a blank gameweek is not a non-start.
function minutesRowsFor(live, targetGw, panel) {
  var P = isObj(panel) && Array.isArray(panel.gws) ? panel : minutesPanel(live);
  var res = { X: [], y: [], ids: [], seenFlag: [], names: MINUTES_FEATURES.slice(), n: 0, seen: 0, baseRate: 0, targetGw: intOf(targetGw, 0), note: "" };
  try {
    var target = intOf(targetGw, 0);
    if (!target) { res.note = "no target gameweek was given"; return res; }
    if (P.gws.indexOf(target) < 0) { res.note = "GW" + target + " is not a finished gameweek in this snapshot"; return res; }
    var prior = P.gws.filter(function (g) { return g < target; });
    if (!prior.length) { res.note = "no finished gameweek sits before GW" + target + ", so there is no history to build a feature from"; return res; }
    var hist = {};
    prior.forEach(function (g) {
      var rows = P.rows[g] || {}, tg = P.teamGames[g] || {};
      P.els.forEach(function (el) {
        var clubN = intOf(tg[P.teamOf[el.id]], 0);
        var row = rows[el.id];
        if (!clubN && !Array.isArray(row)) return;
        var min = Array.isArray(row) ? num(row[0], 0) : 0, st = Array.isArray(row) ? num(row[1], 0) : 0;
        (hist[el.id] = hist[el.id] || []).push({ gw: g, games: Math.max(clubN, st, Array.isArray(row) ? 1 : 0), min: min, starts: st });
      });
    });
    var tRows = P.rows[target] || {}, tGames = P.teamGames[target] || {};
    var ones = 0;
    P.els.forEach(function (el) {
      if (!intOf(tGames[P.teamOf[el.id]], 0)) return;
      var h = hist[el.id];
      if (!h || !h.length) return;
      var played = 0;
      h.forEach(function (r) { if (num(r.min, 0) > 0) played++; });
      var row = tRows[el.id];
      var y = Array.isArray(row) && num(row[1], 0) > 0 ? 1 : 0;
      res.X.push(minutesFeatureVector(h, target, P.deadlines));
      res.y.push(y); res.ids.push(el.id); res.seenFlag.push(played > 0 ? 1 : 0);
      if (played > 0) res.seen++;
      ones += y;
    });
    res.n = res.y.length;
    res.baseRate = res.n ? clamp(ones / res.n, 0, 1) : 0;
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// Fit on every finished gameweek up to and including uptoGw (0 = all of them).
function minutesFit(live, uptoGw, opts) {
  var res = { ok: false, beta: [], names: MINUTES_FEATURES.slice(), rows: 0, gws: [], upto: 0, converged: false, iters: 0, ridge: 0, logLik: 0, baseRate: 0, terms: [], note: "" };
  try {
    var P = minutesPanel(live);
    if (!P.ok) { res.note = "the snapshot carries no finished gameweek to fit on"; res.terms = minutesTerms(res); return res; }
    var upto = intOf(uptoGw, 0) || P.gws[P.gws.length - 1];
    res.upto = upto;
    var X = [], y = [];
    P.gws.filter(function (g) { return g <= upto; }).forEach(function (g) {
      var r = minutesRowsFor(live, g, P);
      if (!r.n) return;
      res.gws.push(g);
      for (var i = 0; i < r.X.length; i++) { X.push(r.X[i]); y.push(r.y[i]); }
    });
    var f = fitLogistic(X, y, opts);
    res.rows = f.n; res.beta = f.beta; res.converged = f.converged; res.iters = f.iters;
    res.ridge = f.ridge; res.logLik = f.logLik; res.baseRate = f.baseRate; res.ok = f.ok;
    res.note = res.gws.length
      ? "fitted on " + f.n + " player-gameweek rows from GW" + res.gws[0] + " to GW" + res.gws[res.gws.length - 1] + "; " + f.note
      : "no gameweek up to GW" + upto + " has a gameweek before it, so there is nothing to fit";
    res.terms = minutesTerms(res);
  } catch (e) { res.note = "engine error: " + errMsg(e); res.terms = minutesTerms(res); }
  return res;
}

// The fit the app would use today, cached on the context (pure in the snapshot, so the cache is
// only ever a repeat of the same answer).
function ctxMinutesFit(ctx, opts) {
  if (!okCtx(ctx)) return minutesFit(null, 0, opts);
  if (ctx._minutesFit) return ctx._minutesFit;
  ctx._minutesFit = minutesFit(ctx.live, 0, opts);
  return ctx._minutesFit;
}

/* Whether the minutes logistic may drive production P(start) (ERRORS.md E-087, closed here).

   E-087 recorded the defect: `driving` was the literal `false`, written in v88 when the gate was
   shut, and five finished gameweeks later the gate is open while the engine still reported that
   nothing was being driven. A flag that answers a question the engine can compute is computed.

   THREE THINGS THIS DECIDES, AND THEY ARE NOT THE SAME THING
     eligible  the challenger has earned promotion: the shared gate is open AND the tail condition
               below holds.
     routed    production actually asks it. It does not yet — see MINUTES_PRODUCTION_ROUTED.
     driving   eligible AND routed. This is what the app reports, and it is true only when the
               model really is behind the numbers on screen. Reporting `driving` for a model that
               nothing calls would be E-087 inverted, which is no better than E-087.

   THE GATE, MEASURED
     Brier over each fold: logistic 0.0874 / 0.0768 / 0.0764 against the Laplace rate's
     0.0954 / 0.0953 / 0.0968. It wins every fold it can be fitted on, with a three-gameweek
     hold-out against a gate wanting two, so `promotionGate` opens.

   THE TAIL CONDITION, AND WHY A MEAN SCORE NEEDS ONE
     The gate is a mean over every scored row, and a mean cannot see a handful of rows where the
     challenger has almost no evidence. Those rows are the ones that move a transfer
     recommendation: a model that gives a good chance of starting to a player the incumbent can
     see has not been starting will put him in a squad. So promotion also requires that, for every
     player whose incumbent probability is at the floor, the challenger stays below an even chance.

     Measured like for like on the 26 September snapshot — both probabilities flag-adjusted, which
     matters: comparing the model's raw `pModel` against the flag-adjusted incumbent invents
     disagreements out of nothing, and the first version of this note did exactly that and claimed
     a 0.000 to 0.627 jump for a flagged player that was the flag and not the model. Corrected:
     over 421 players the two disagree by a mean of 0.104, median 0.035, p90 0.304, max 0.598. Of
     138 players at the incumbent floor the challenger's highest is 0.305, against the 0.50 limit.
     So the tail condition HOLDS and the challenger is eligible.

   WHY IT IS STILL NOT ROUTED
     v110 §5 B3 replaces this minutes model outright — recent starts weighted, flags, parsed
     return dates and dated overrides — and the tournament re-scores against that. Routing
     production through a model that is about to be replaced would spend a round's worth of
     before-and-after on the shipped plan twice. So the decision is recorded, not taken, and the
     code says which of the three words is false rather than implying all three.
*/
var MINUTES_TAIL_LIMIT = 0.50;

/* Production P(start) is the Laplace rate. Flip this to true only together with routing the xp
   path through minutesModel, and only with the before-and-after on the shipped plan in the
   retest — every recommendation in the app moves with it. */
var MINUTES_PRODUCTION_ROUTED = false;


function minutesPromotion(live, opts) {
  var res = {
    ok: false, eligible: false, routed: MINUTES_PRODUCTION_ROUTED, driving: false, driver: "pStart", gate: null,
    tail: { ok: false, thin: 0, checked: 0, max: 0, limit: MINUTES_TAIL_LIMIT, worst: null },
    note: ""
  };
  try {
    var wf = minutesWalkForward(live, opts);
    res.gate = wf.gate || null;
    var gateOpen = !!(res.gate && res.gate.promotable);

    /* A "thin" row is one where the INCUMBENT has hard evidence of not starting: the Laplace
       rate over its own recent window is at the floor. That is the comparison that matters,
       because the incumbent is what production uses, and the two models look at different
       windows — Fatawu has starts earlier in the season and none recently, so the Laplace rate
       reads 0.000 while the logistic, fitted over the whole panel, reads 0.627. Measuring the
       tail against the fitted window instead found no thin rows at all and would have passed
       this condition without testing anything. */
    var panel = minutesPanel(live);
    var fit = minutesFit(live, 0, opts);
    var gwStats = elementGwStats(live);
    var THIN_INCUMBENT = 0.10;
    var targetGw = intOf(isObj(live) ? live.next_event : 0, 0);
    if (!targetGw) arr(isObj(live) ? live.events : null).forEach(function (e) { if (isObj(e) && e.is_next) targetGw = intOf(e.id, 0); });

    var els = arr(isObj(live) ? live.elements : null);
    var worst = null, maxP = 0, maxAdj = 0, thin = 0, checked = 0;
    if (fit.ok) {
      els.forEach(function (el) {
        if (!isObj(el)) return;
        if (intOf(el.minutes, 0) <= 0) return;            // never on the pitch: no features to speak of
        if (pStart(el, gwStats) > THIN_INCUMBENT) return; // the incumbent has evidence either way
        thin++;
        var hist = [];
        arr(panel.gws).forEach(function (g) {
          var rows = panel.rows[g] || {}, tg = panel.teamGames[g] || {};
          var clubN = intOf(tg[num(el.team, -1)], 0), row = rows[el.id];
          if (!clubN && !Array.isArray(row)) return;
          hist.push({ gw: g, games: Math.max(clubN, Array.isArray(row) ? num(row[1], 0) : 0, Array.isArray(row) ? 1 : 0),
            min: Array.isArray(row) ? num(row[0], 0) : 0, starts: Array.isArray(row) ? num(row[1], 0) : 0 });
        });
        /* Audit G-11: the target gameweek is the next deadline's, as minutesModel uses (ctx.nextEvent). The panel
           carries no nextEvent, so this read 0 and every thin row was scored against gameweek zero. */
        var x = minutesFeatureVector(hist, targetGw, panel.deadlines);
        var z = 0;
        for (var i = 0; i < x.length && i < fit.beta.length; i++) z += num(fit.beta[i], 0) * x[i];
        /* The RAW model probability binds the condition, not the flag-adjusted one. A flag is
           today's news and it lifts; the model's own claim about a player the incumbent has not
           seen starting is the thing being judged, and it must not move with the news. Both are
           reported, because the raw figure is what a promotion would inherit. */
        var pm = clamp(logistic(z), 0, 1);
        var pmAdj = clamp(pm * clamp(flagInfo(el).factor, 0, 1), 0, 1);
        checked++;
        if (pmAdj > maxAdj) maxAdj = pmAdj;
        if (pm > maxP) { maxP = pm; worst = { id: el.id, name: String(el.web_name || el.id), p: pm, pAdjusted: pmAdj }; }
      });
    }
    res.tail.thin = thin;
    res.tail.checked = checked;
    res.tail.max = maxP;
    res.tail.maxAdjusted = maxAdj;
    res.tail.margin = MINUTES_TAIL_LIMIT - maxP;
    res.tail.worst = worst;
    res.tail.ok = fit.ok && checked > 0 && maxP <= MINUTES_TAIL_LIMIT;

    res.eligible = gateOpen && res.tail.ok;
    res.driving = res.eligible && MINUTES_PRODUCTION_ROUTED;
    res.ok = res.eligible;                       // "ok" answers eligibility, which is what the gate decides
    res.driver = res.driving ? "minutesLogistic" : "pStart";
    if (!gateOpen) {
      res.note = "the gate is shut: " + ((res.gate && res.gate.reasons ? res.gate.reasons : []).join("; ") || "not enough transitions won");
    } else if (!res.tail.ok) {
      res.note = "the gate is open (" + (res.gate ? res.gate.note : "") + ") but the tail condition is not met: " +
        (worst ? worst.name + " has no recent start the incumbent can see and the model gives " + Math.round(maxP * 1000) / 1000 : "no thin row could be scored") +
        ", against a limit of " + MINUTES_TAIL_LIMIT + ". P(start) in production stays the Laplace rate.";
    } else if (!MINUTES_PRODUCTION_ROUTED) {
      res.note = "the gate is open and the tail condition holds (worst row at the incumbent floor: " +
        (worst ? worst.name + " at " + Math.round(maxP * 1000) / 1000 : "none") + " \u2264 " + MINUTES_TAIL_LIMIT +
        ", by " + Math.round((MINUTES_TAIL_LIMIT - maxP) * 1000) / 1000 +
        " \u2014 close, and said so rather than rounded away; flag-adjusted the same row is " + Math.round(maxAdj * 1000) / 1000 +
        "), so the minutes logistic is ELIGIBLE. It is not routed: production P(start) is still the " +
        "Laplace rate, because v110 B3 replaces this minutes model and the tournament re-scores against that.";
    } else {
      res.note = "the gate is open, the tail condition holds (worst row at the incumbent floor: " +
        (worst ? worst.name + " at " + Math.round(maxP * 1000) / 1000 : "none") + " \u2264 " + MINUTES_TAIL_LIMIT +
        ") and production is routed through it: the minutes logistic drives P(start).";
    }
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// F4's challenger for P(start). It does NOT drive anything: `driving` is false until the shared
// promotion gate says otherwise, and the note says which model is driving today.
function minutesModel(el, ctx, opts) {
  var res = {
    p: 0, pModel: 0, pIncumbent: 0, flagFactor: 1, fitted: false, driving: false, driver: "pStart",
    features: { starts_last3: 0, minutes_trend3: 0, minutes_rate: 0, days_since_last_start: 1 },
    x: [], terms: [], fit: null, note: ""
  };
  try {
    if (!isObj(el)) { res.note = "no player was given"; res.terms = minutesTerms(null); return res; }
    if (!okCtx(ctx)) { res.note = "no usable context"; res.terms = minutesTerms(null); return res; }
    res.pIncumbent = pStart(el, ctx.gwStats);
    var fit = ctxMinutesFit(ctx, opts);
    res.fit = { ok: fit.ok, rows: fit.rows, gws: fit.gws.slice(), converged: fit.converged, iters: fit.iters, upto: fit.upto, note: fit.note };
    res.terms = fit.terms && fit.terms.length ? fit.terms : minutesTerms(fit);
    var fl = flagInfo(el);
    res.flagFactor = clamp(fl.factor, 0, 1);
    var P = ctx._minutesPanel || (ctx._minutesPanel = minutesPanel(ctx.live));
    var hist = [];
    P.gws.forEach(function (g) {
      var rows = P.rows[g] || {}, tg = P.teamGames[g] || {};
      var clubN = intOf(tg[num(el.team, -1)], 0), row = rows[el.id];
      if (!clubN && !Array.isArray(row)) return;
      hist.push({ gw: g, games: Math.max(clubN, Array.isArray(row) ? num(row[1], 0) : 0, Array.isArray(row) ? 1 : 0), min: Array.isArray(row) ? num(row[0], 0) : 0, starts: Array.isArray(row) ? num(row[1], 0) : 0 });
    });
    var x = minutesFeatureVector(hist, ctx.nextEvent, P.deadlines);
    res.x = x.slice();
    res.features = { starts_last3: x[1], minutes_trend3: x[2], minutes_rate: x[3], days_since_last_start: x[4] };
    if (!fit.ok) {
      res.p = res.pIncumbent;
      res.driving = false;
      res.driver = "pStart";
      res.note = "the minutes model could not be fitted on this snapshot (" + fit.note + "), so this is the Laplace rate the app ships.";
      return res;
    }
    var z = 0;
    for (var i = 0; i < x.length && i < fit.beta.length; i++) z += num(fit.beta[i], 0) * x[i];
    res.fitted = true;
    res.pModel = clamp(logistic(z), 0, 1);
    res.p = clamp(res.pModel * res.flagFactor, 0, 1);
    // E-087: computed, not typed. Cached on the context because the decision needs a
    // walk-forward and every player would otherwise pay for it again.
    var promo = ctx._minutesPromotion || (ctx._minutesPromotion = minutesPromotion(ctx.live, opts));
    res.driving = !!promo.driving;
    res.driver = promo.driver;
    res.promotion = { eligible: !!promo.eligible, routed: !!promo.routed, driving: !!promo.driving,
      gateOpen: !!(promo.gate && promo.gate.promotable), tail: promo.tail, note: promo.note };
    res.note = promo.driving
      ? "the minutes logistic drives P(start): " + promo.note
      : "challenger only \u2014 " + promo.note;
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// A snapshot as it stood at the end of uptoGw: later gameweek rows are dropped and later fixtures
// are put back to unplayed, so nothing fitted on this can see the gameweek it is predicting.
function truncateLive(live, uptoGw) {
  if (!isObj(live)) return { elements: [], fixtures: [], gw: {}, events: [], teams: [] };
  var upto = intOf(uptoGw, 0);
  var out = {};
  Object.keys(live).forEach(function (k) { out[k] = live[k]; });
  var gw = {};
  if (isObj(live.gw)) Object.keys(live.gw).forEach(function (k) { if (num(k, NaN) <= upto) gw[k] = live.gw[k]; });
  out.gw = gw;
  out.fixtures = arr(live.fixtures).map(function (f) {
    if (!isObj(f)) return f;
    if (intOf(f.event, -1) <= upto) return f;
    if (!f.finished && !f.started) return f;
    var c = {}; Object.keys(f).forEach(function (k) { c[k] = f[k]; });
    c.finished = false; c.started = false; c.team_h_score = null; c.team_a_score = null;
    return c;
  });
  out.current_event = upto; out.next_event = upto + 1;
  return out;
}

// The calibration the v87 scorecard asked for: fit on gameweeks <= k, predict "did he start in
// k+1", score BOTH the incumbent Laplace rate and the F4 challenger on the held-out gameweek.
// Lower Brier is better. Both models carry the same present-tense flag factor, so the comparison
// is like for like; the no-flag pair is reported beside it so the flag's contribution is visible.
function minutesWalkForward(live, opts) {
  var res = {
    folds: [], comparable: 0, wins: 0, holdout: 0, driver: "pStart", challenger: "minutesModel",
    incumbent: { brier: null, n: 0, folds: 0 }, challengerScore: { brier: null, n: 0, folds: 0 },
    gate: promotionGate({ transitions: 0, wins: 0, holdout: 0, challenger: MINUTES_CHALLENGER, incumbent: MINUTES_INCUMBENT }),
    flagHistory: false, europeanLoad: false, bins: 0, note: ""
  };
  try {
    var o = isObj(opts) ? opts : {};
    var nb = clamp(intOf(o.bins, 5), 2, 20);
    res.bins = nb;
    var P = minutesPanel(live);
    if (!P.ok || P.gws.length < 2) {
      res.note = "a walk-forward needs at least two finished gameweeks; this snapshot has " + (P.gws ? P.gws.length : 0) + ".";
      return res;
    }
    var elsById = {};
    arr(live.elements).forEach(function (el) { if (isObj(el) && el.id !== undefined) elsById[el.id] = el; });
    var incSum = 0, incN = 0, chSum = 0, chN = 0;
    for (var i = 1; i < P.gws.length; i++) {
      var k = P.gws[i - 1], target = P.gws[i];
      var pred = minutesRowsFor(live, target, P);
      if (!pred.n) continue;
      var gsK = elementGwStats(truncateLive(live, k));
      var incP = [], incPnf = [], chP = [], chPnf = [], ys = [], seenP = [], seenC = [], seenY = [];
      var fit = minutesFit(live, k, o);
      for (var r = 0; r < pred.ids.length; r++) {
        var el = elsById[pred.ids[r]];
        if (!el) continue;
        var fl = flagInfo(el), ff = clamp(fl.factor, 0, 1);
        var raw = pStart(el, gsK);
        var nf = ff > 0 ? clamp(raw / ff, 0, 1) : raw;          // pStart folds the flag in; peel it back out
        incP.push(raw); incPnf.push(nf); ys.push(pred.y[r]);
        var cp = null;
        if (fit.ok) {
          var z = 0, x = pred.X[r];
          for (var j = 0; j < x.length && j < fit.beta.length; j++) z += num(fit.beta[j], 0) * x[j];
          var pm = clamp(logistic(z), 0, 1);
          chPnf.push(pm); cp = clamp(pm * ff, 0, 1); chP.push(cp);
        }
        if (pred.seenFlag[r]) { seenP.push(raw); seenY.push(pred.y[r]); if (cp !== null) seenC.push(cp); }
      }
      var incB = brier(incP, ys), chB = fit.ok ? brier(chP, ys) : null;
      var fold = {
        from: k, to: target, n: incB.n, baseRate: incB.baseRate, seen: pred.seen,
        fitted: fit.ok, fitRows: fit.rows, fitGws: fit.gws.slice(),
        incumbent: { brier: incB.brier, skill: incB.skill, n: incB.n, reliability: reliability(incP, ys, nb) },
        challenger: chB ? { brier: chB.brier, skill: chB.skill, n: chB.n, reliability: reliability(chP, ys, nb) } : null,
        noFlag: { incumbent: brier(incPnf, ys).brier, challenger: fit.ok ? brier(chPnf, ys).brier : null },
        seenOnly: { n: seenY.length, incumbent: brier(seenP, seenY).brier, challenger: seenC.length ? brier(seenC, seenY).brier : null },
        winner: "not scored", note: ""
      };
      if (!fit.ok) fold.note = "the challenger could not be fitted on gameweeks up to GW" + k + ": " + fit.note;
      else if (chB.brier < incB.brier) fold.winner = "challenger";
      else if (chB.brier > incB.brier) fold.winner = "incumbent";
      else fold.winner = "tie";
      res.folds.push(fold);
      incSum += incB.brier * incB.n; incN += incB.n; res.incumbent.folds++;
      if (chB) { chSum += chB.brier * chB.n; chN += chB.n; res.challengerScore.folds++; }
    }
    res.incumbent.brier = incN ? clamp(incSum / incN, 0, 1) : null; res.incumbent.n = incN;
    res.challengerScore.brier = chN ? clamp(chSum / chN, 0, 1) : null; res.challengerScore.n = chN;
    res.comparable = res.folds.filter(function (f) { return f.fitted; }).length;
    res.wins = res.folds.filter(function (f) { return f.winner === "challenger"; }).length;
    var trail = 0;
    for (var t = res.folds.length - 1; t >= 0; t--) { if (res.folds[t].winner === "challenger") trail++; else break; }
    res.holdout = trail;
    res.gate = promotionGate({ transitions: res.comparable, wins: res.wins, holdout: res.holdout, challenger: MINUTES_CHALLENGER, incumbent: MINUTES_INCUMBENT });
    res.note = "Walk-forward over " + res.folds.length + " transition" + (res.folds.length === 1 ? "" : "s") +
      "; the challenger could be fitted on " + res.comparable + " of them, because a fit needs a gameweek of history before the gameweek it is fitted on. " +
      "Production P(start) stays the Laplace rate. " + res.gate.note;
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ------------------------------------------------- player xG model (F5)

// xG90 x att(team) x def(opponent), folded into the E1 shape. A ninth challenger in the
// tournament, barred from driving anything by E6 and by the shared promotion gate.
function playerXg(el, ctx, opts) {
  var res = {
    xp: 0, xpPerFixture: 0, p: 0, lambda: 0, lambdaAssist: 0, mult: 0, att: 1, def: 1,
    xg90: 0, xa90: 0, fixtures: 0, event: 0, opponents: [], driving: false,
    components: { appearance: 0, goals: 0, assists: 0, cs: 0, conceded: 0, dc: 0, bonus: 0 }, note: ""
  };
  try {
    if (!isObj(el) || !okCtx(ctx)) { res.note = "no player or no usable context"; return res; }
    var t = elType(el); if (!t) { res.note = "the player has no position"; return res; }
    var o = isObj(opts) ? opts : {};
    var event = intOf(o.event, 0) || ctx.nextEvent;
    res.event = event;
    var team = num(el.team, -1);
    var fx = arr(ctx.fixturesByEvent[event]).filter(function (f) { return num(f.team_h, -1) === team || num(f.team_a, -1) === team; });
    res.fixtures = fx.length;
    var rates = playerRates(el, ctx);
    res.xg90 = num(rates.xg90, 0); res.xa90 = num(rates.xa90, 0);
    var gs = ctx.gwStats[el.id] || { dcRate: 0, bonusRate: 0, played: 0, minutes: 0, games: 0 };
    var p = ctx.xp[el.id] ? ctx.xp[el.id].pstart : pStart(el, ctx.gwStats);
    res.p = clamp(p, 0, 1);
    if (!fx.length) { res.note = "no fixture for this club in GW" + event + ": a blank is worth nothing, not a default"; return res; }
    var S = SCORING[t];
    var minsAvg = num(gs.played, 0) > 0 ? clamp(num(gs.minutes, 0) / num(gs.played, 1), 0, 90) : 90;
    var frac = clamp(minsAvg / 90, 0, 1);
    var total = 0, attSum = 0, defSum = 0;
    fx.forEach(function (f) {
      var home = num(f.team_h, -1) === team, opp = home ? num(f.team_a, -1) : num(f.team_h, -1);
      var a = tsEntry(ctx.TS, team), d = tsEntry(ctx.TS, opp);
      attSum += a.att; defSum += d.def;
      var mult = a.att * d.def * (home ? HOME_ADV : AWAY_ADV);
      var lam = res.xg90 * mult * frac, lamA = res.xa90 * mult * frac;
      var lamOpp = tsXg(opp, team, !home, ctx.TS);
      var pcs = clamp(Math.exp(-lamOpp), 0, 1);
      var appearance = minsAvg >= 60 ? S.play_long : S.play_short;
      var csPts = (minsAvg >= 60 ? pcs : 0) * S.cs;
      var gcPts = S.gc_per2 ? (lamOpp * frac) / 2 * S.gc_per2 : 0;
      var dcPts = clamp(num(gs.dcRate, 0), 0, 1) * S.dc;
      var bonusPts = Math.max(0, num(gs.bonusRate, 0));
      res.lambda += lam; res.lambdaAssist += lamA; res.mult += mult;
      res.components.appearance += appearance; res.components.goals += lam * S.goal; res.components.assists += lamA * S.assist;
      res.components.cs += csPts; res.components.conceded += gcPts; res.components.dc += dcPts; res.components.bonus += bonusPts;
      res.opponents.push({ opponent: opp, home: home, mult: mult, lambda: lam });
      total += appearance + lam * S.goal + lamA * S.assist + csPts + gcPts + dcPts + bonusPts;
    });
    res.att = fx.length ? attSum / fx.length : 1;
    res.def = fx.length ? defSum / fx.length : 1;
    res.xpPerFixture = fx.length ? total / fx.length : 0;
    res.xp = total * res.p;
    res.note = "challenger only (E6 bars a component model from driving): the production xP is the E1 shrunk-points-per-start shape.";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ------------------------------------------------- chip solver on the real calendar (F8)

// A team's total fixture multiplier in one event: 0 on a blank, one multiplier on a single, the
// sum of both on a double. Never assumes one fixture (B2).
function eventMult(teamId, ctx, event) {
  var t = num(teamId, NaN);
  if (!isFinite(t) || !okCtx(ctx)) return 0;
  var m = 0;
  arr(ctx.fixturesByEvent[intOf(event, -1)]).forEach(function (f) {
    if (num(f.team_h, -1) === t || num(f.team_a, -1) === t) m += fxMult(f, t, ctx.TS);
  });
  return m;
}
function xpEvent(el, ctx, event) {
  if (!isObj(el) || !okCtx(ctx)) return 0;
  var x = ctx.xp[el.id];
  var p = x ? x.pstart : pStart(el, ctx.gwStats);
  return shrunkPps(el) * clamp(p, 0, 1) * eventMult(num(el.team, -1), ctx, event);
}
// The best legal eleven for one event out of a candidate list, scored on that event's fixtures.
// Neither the budget nor the three-per-club cap is applied: the Free Hit figure this feeds is an
// UPPER BOUND on both counts, and every place it is shown says so. A deep enough blank can leave
// too few clubs for a legal fifteen at all, which is a fact about the blank, not about the solver.
function bestElevenForEvent(ctx, event, ids) {
  var res = { ids: [], score: 0, formation: "", ok: false, pool: 0, note: "" };
  try {
    if (!okCtx(ctx)) return res;
    var ev = intOf(event, 0);
    var source = Array.isArray(ids) && ids.length ? uniq(idList(ids)).filter(function (id) { return ctx.els[id]; })
      : ctx.elList.map(function (el) { return el.id; });
    var scored = [];
    source.forEach(function (id) {
      var el = ctx.els[id]; if (!el) return;
      var v = xpEvent(el, ctx, ev);
      if (v > 0) scored.push({ id: id, v: v });
    });
    scored.sort(function (a, b) { return b.v - a.v; });
    res.pool = scored.length;
    var top = scored.slice(0, CHIP_FH_POOL), vOf = {};
    top.forEach(function (r) { vOf[r.id] = r.v; });
    var xi = pickXI(top.map(function (r) { return r.id; }), ctx, function (el) { return num(vOf[el.id], 0); });
    res.ids = xi.ids.slice(); res.score = num(xi.score, 0); res.formation = xi.formation; res.ok = xi.ok;
    res.note = "best legal eleven for GW" + ev + " out of the " + top.length + " highest-scoring players whose club plays; " +
      "neither the budget nor the three-per-club cap is applied, so it is an upper bound";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// What one chip is worth in one event, priced from the fixture list and the E1 xP.
function chipValue(chip, event, ctx, opts) {
  var res = { chip: String(chip || "").toUpperCase(), event: intOf(event, 0), value: 0, basis: "", detail: "", ok: false };
  try {
    if (!okCtx(ctx)) { res.detail = "no usable context"; return res; }
    var o = isObj(opts) ? opts : {};
    var ev = res.event;
    var squad = uniq(idList(o.ids && o.ids.length ? o.ids : ctx.squadIds)).filter(function (id) { return ctx.els[id]; });
    if (res.chip !== "WC" && squad.length < 11) { res.detail = "the saved fifteen is not complete, so this chip cannot be priced"; return res; }
    if (res.chip === "BB") {
      var xiB = pickXI(squad, ctx, function (el) { return xpEvent(el, ctx, ev); });
      var bench = xiB.ok ? xiB.bench : [];
      res.value = sum(bench, function (id) { return xpEvent(ctx.els[id], ctx, ev); });
      res.basis = "sum of the bench xP in GW" + ev;
      res.detail = bench.length + " bench players priced on GW" + ev + " fixtures";
      res.ok = true;
    } else if (res.chip === "TC") {
      var xiT = pickXI(squad, ctx, function (el) { return xpEvent(el, ctx, ev); });
      var pool = xiT.ok ? xiT.ids : squad;
      var best = 0, bestId = null;
      pool.forEach(function (id) {
        var el = ctx.els[id], t = elType(el);
        if (t !== 3 && t !== 4) return;
        if (flagInfo(el).flagged) return;
        var v = xpEvent(el, ctx, ev);
        if (v > best) { best = v; bestId = id; }
      });
      res.value = best;
      res.basis = "the extra multiple on the best single fixture in GW" + ev;
      res.detail = bestId === null ? "no unflagged attacker in the eleven" : "best attacker " + elName(bestId, ctx);
      res.ok = bestId !== null;
    } else if (res.chip === "FH") {
      var mine = pickXI(squad, ctx, function (el) { return xpEvent(el, ctx, ev); });
      var free = bestElevenForEvent(ctx, ev, null);
      res.value = Math.max(0, num(free.score, 0) - num(mine.score, 0));
      res.basis = "best eleven available in GW" + ev + " minus the current fifteen's best eleven";
      res.detail = "upper bound: neither the budget nor the three-per-club cap is applied to the replacement eleven";
      res.ok = free.ok;
    } else if (res.chip === "WC") {
      var tm = ctx._chipWcTiming || (ctx._chipWcTiming = wildcardTiming(ctx));
      res.value = Math.max(0, num(tm.breakeven.byGw19, 0));
      res.basis = "cumulative deficit of the current fifteen against the wildcard fifteen to the set-one expiry";
      res.detail = tm.swapsNeeded + " swaps, " + (Math.round(num(tm.weeklyGap, 0) * 100) / 100) + " points a week at the start";
      res.ok = true;
    } else {
      res.detail = "unknown chip";
    }
    if (!isFinite(res.value)) res.value = 0;
  } catch (e) { res.detail = "engine error: " + errMsg(e); }
  return res;
}

// F8. Enumerate the confirmed doubles and blanks, price every chip in every window it could be
// played in, then solve the two chip sets JOINTLY: each chip once per set, each set inside its
// own expiry, never two chips in one gameweek.
function chipSolver(ctx, opts) {
  var res = {
    ok: false, nextEvent: 0, doubles: [], blanks: [], confirmed: false, used: [],
    candidates: [], plan: [], total: 0, sets: [], considered: 0, note: "", windowNote: "", reasons: []
  };
  try {
    if (!okCtx(ctx)) { res.note = "no usable context"; return res; }
    var o = isObj(opts) ? opts : {};
    res.nextEvent = ctx.nextEvent;
    var w = chipWindows(ctx.live);
    res.doubles = w.doubles.map(function (d) { return { event: d.event, n: d.n, teams: d.teams.slice() }; });
    res.blanks = w.blanks.map(function (b) { return { event: b.event, n: b.n, teams: b.teams.slice() }; });
    res.confirmed = res.doubles.length > 0 || res.blanks.length > 0;
    var usedChips = {};
    arr(ctx.live && ctx.live.history && ctx.live.history.chips).forEach(function (c) {
      if (!isObj(c)) return;
      var nm = CHIP_ALIAS[String(c.name || "").toLowerCase()] || String(c.name || "").toUpperCase();
      var evt = intOf(c.event, 0);
      var st = evt >= CHIP_SETS[1].from && evt <= CHIP_SETS[1].to ? 2 : 1;
      usedChips[st + ":" + nm] = evt;
      res.used.push({ set: st, chip: nm, event: evt });
    });
    var cand = [];
    for (var si = 0; si < CHIP_SETS.length; si++) {
      var S = CHIP_SETS[si];
      res.sets.push({ set: S.set, from: S.from, to: S.to });
      for (var ci = 0; ci < CHIP_NAMES.length; ci++) {
        var chip = CHIP_NAMES[ci];
        if (usedChips[S.set + ":" + chip] !== undefined) continue;
        var events = [];
        if (chip === "BB" || chip === "TC") events = res.doubles.map(function (d) { return d.event; });
        else if (chip === "FH") events = res.blanks.map(function (b) { return b.event; });
        else events = [ctx.nextEvent];
        var inSet = [];
        for (var ei = 0; ei < events.length; ei++) {
          var ev = intOf(events[ei], 0);
          if (ev >= S.from && ev <= S.to && ev >= ctx.nextEvent) inSet.push(ev);
        }
        if (!inSet.length) {
          res.reasons.push(chip + " has no window inside set " + S.set + " (GW" + S.from + " to GW" + S.to + ") that is still ahead of GW" + ctx.nextEvent);
          continue;
        }
        var priced = [];
        for (var pi = 0; pi < inSet.length && pi < CHIP_PRICE_WINDOWS; pi++) {
          var v = chipValue(chip, inSet[pi], ctx, o);
          if (!v.ok) { res.reasons.push(chip + " in GW" + inSet[pi] + " could not be priced: " + v.detail); continue; }
          priced.push({ set: S.set, chip: chip, event: inSet[pi], value: num(v.value, 0), basis: v.basis, detail: v.detail });
        }
        priced.sort(function (a, b) { return b.value - a.value || a.event - b.event; });
        for (var qi = 0; qi < priced.length && qi < CHIP_MAX_WINDOWS; qi++) cand.push(priced[qi]);
      }
    }
    cand.sort(function (a, b) { return b.value - a.value || a.event - b.event; });
    res.candidates = cand;
    // Exhaustive assignment. The candidate list is small by construction (four chips, two sets,
    // at most CHIP_MAX_WINDOWS windows each), so depth-first search with a node cap is exact here
    // and cannot run away on a fixture list that later carries many doubles.
    var best = { total: 0, pick: [] };
    var nodes = 0;
    (function search(i, takenChip, takenEvent, acc, total) {
      nodes++;
      if (nodes > CHIP_SEARCH_NODES) return;
      if (total > best.total) { best = { total: total, pick: acc.slice() }; }
      for (var j = i; j < cand.length; j++) {
        var c = cand[j];
        var ck = c.set + ":" + c.chip;
        if (takenChip[ck] || takenEvent[c.event]) continue;
        takenChip[ck] = true; takenEvent[c.event] = true;
        acc.push(c);
        search(j + 1, takenChip, takenEvent, acc, total + c.value);
        acc.pop();
        takenChip[ck] = false; takenEvent[c.event] = false;
      }
    })(0, {}, {}, [], 0);
    res.considered = nodes;
    res.plan = best.pick.slice().sort(function (a, b) { return a.event - b.event || a.set - b.set; });
    res.total = best.total;
    res.ok = true;
    res.windowNote = res.confirmed
      ? "Windows are read from the published fixture list: " + res.doubles.length + " double" + (res.doubles.length === 1 ? "" : "s") +
        " and " + res.blanks.length + " blank" + (res.blanks.length === 1 ? "" : "s") + " are scheduled."
      : "No window is confirmed yet: the fixture list carries exactly one fixture for every club in every remaining gameweek, so there is no double and no blank to plan a Bench Boost, a Triple Captain or a Free Hit around.";
    res.note = res.plan.length
      ? res.windowNote + " The solver assigns " + res.plan.length + " chip" + (res.plan.length === 1 ? "" : "s") + " worth " + (Math.round(res.total * 10) / 10) + " points in total."
      : res.windowNote + " Nothing is assigned.";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- autosubs, bench plan, leak back-test (F3, corrected)

/* The autosub rules live here and nowhere else. A bench player enters only for a starter who
 * played zero minutes, only if the formation stays legal after the swap, and a goalkeeper only
 * ever replaces a goalkeeper. Bench order decides who is tried first, and a sub who did not play
 * himself cannot come on. entryPoints (the Monte Carlo) and the back-test below both call this,
 * so there is exactly one implementation of the rules — the E-089 lesson: a settlement order
 * that exists twice is a settlement order that will differ once.
 * playedOf(id) -> boolean. */
function autosubResolve(xi, bench, playedOf, ctx) {
  var res = { starters: [], subsIn: [], subsOut: [], ok: false };
  try {
    if (!okCtx(ctx)) return res;
    var played = typeof playedOf === "function" ? playedOf : function () { return true; };
    var starters = arr(xi).slice(), benchLeft = arr(bench).slice();
    var counts = posCounts(starters, ctx.els);
    var ins = [], outs = [];
    starters.forEach(function (id, i) {
      if (played(id)) return;
      var st = elType(ctx.els[id]);
      for (var j = 0; j < benchLeft.length; j++) {
        var b = benchLeft[j];
        if (!played(b)) continue;
        var bt = elType(ctx.els[b]);
        if (st === 1 || bt === 1) { if (st !== bt) continue; }
        else {
          var c = { 2: counts[2], 3: counts[3], 4: counts[4] };
          c[st]--; c[bt]++;
          if (!(c[2] >= 3 && c[3] >= 2 && c[4] >= 1)) continue;
          counts = c;
        }
        starters[i] = b; benchLeft.splice(j, 1); ins.push(b); outs.push(id); break;
      }
    });
    res.starters = starters; res.subsIn = ins; res.subsOut = outs; res.ok = true;
  } catch (e) { /* total */ }
  return res;
}

// Every ordering of a list, capped so junk cannot ask for 13! of anything.
function permutations(list) {
  var src = arr(list);
  if (src.length > 6) return [src.slice()];
  var out = [];
  (function rec(rest, cur) {
    if (!rest.length) { out.push(cur.slice()); return; }
    for (var i = 0; i < rest.length; i++) {
      var next = rest.slice(); var v = next.splice(i, 1)[0];
      cur.push(v); rec(next, cur); cur.pop();
    }
  })(src, []);
  return out;
}

/* benchPlan — roadmap F3, built to its own specification and reported honestly.
 *
 * Value of a bench slot = P(it actually comes on) x E[points | it plays], where P(it comes on) is
 * computed exactly rather than simulated: every pattern of up to AUTOSUB_MAX_BLANKS simultaneous
 * blanks among the eleven, crossed with every played/blanked pattern of the bench, is enumerated,
 * the real autosub rules are run on each, and the probability of the patterns in which this sub
 * entered is summed. Patterns with more simultaneous blanks than the bench could ever cover are
 * left out and their probability is reported as `truncatedMass`, so the truncation is visible.
 *
 * What it is worth is a separate question from whether it is built, and on this manager's record
 * the answer is nothing: leakBacktest finds 0 points of bench-ordering value over five finished
 * gameweeks because not one of his starters has blanked. `orderValue` is the ex-ante spread
 * between the best and the worst legal ordering — the expected points at stake in the ORDER.
 */
function benchPlan(squadIds, xiIds, ctx) {
  var res = {
    ok: false, xi: [], bench: [], gkSub: null, order: [], rows: [], patterns: 0, truncatedMass: 0,
    expectedGain: 0, bestGain: 0, worstGain: 0, orderValue: 0, bestOrder: [], note: ""
  };
  try {
    if (!okCtx(ctx)) { res.note = "no context"; return res; }
    var squad = uniq(idList(squadIds)).filter(function (id) { return ctx.els[id]; });
    var xi = uniq(idList(xiIds)).filter(function (id) { return ctx.els[id] && squad.indexOf(id) >= 0; });
    if (xi.length !== 11 || !legalXI(xi, ctx.els).ok) xi = bestXI(squad, ctx).ids.slice();
    if (xi.length !== 11) { res.note = "no legal eleven to plan a bench around"; return res; }
    var xiSet = {}; xi.forEach(function (id) { xiSet[id] = true; });
    var bench = squad.filter(function (id) { return !xiSet[id]; });
    var gk = bench.filter(function (id) { return elType(ctx.els[id]) === 1; });
    var outfield = bench.filter(function (id) { return elType(ctx.els[id]) !== 1; }).slice(0, 5);
    res.xi = xi.slice(); res.bench = bench.slice(); res.gkSub = gk.length ? gk[0] : null;
    var pOf = {}, eOf = {};
    squad.forEach(function (id) {
      var el = ctx.els[id];
      var x = ctx.xp[id] || { shrunk: shrunkPps(el), pstart: pStart(el, ctx.gwStats) };
      pOf[id] = clamp(num(x.pstart, 0), 0, 1);
      eOf[id] = Math.max(0, num(x.shrunk, 0) * num((ctx.mults.TS[el.team] || [0])[0], 0));
    });
    // starter blank subsets, capped by how many subs could ever come on
    var maxBlanks = Math.min(AUTOSUB_MAX_BLANKS, xi.length);
    var subsets = [], mass = 0;
    for (var k = 0; k <= maxBlanks; k++) {
      combos(xi, k).forEach(function (set) {
        var pr = 1, blank = {};
        xi.forEach(function (id) { var isB = set.indexOf(id) >= 0; blank[id] = isB; pr *= isB ? 1 - pOf[id] : pOf[id]; });
        if (pr <= 0) return;
        subsets.push({ blank: blank, p: pr });
        mass += pr;
      });
    }
    var benchAll = (res.gkSub === null ? [] : [res.gkSub]).concat(outfield);
    var benchPatterns = [];
    var total = 1 << benchAll.length;
    for (var m = 0; m < total; m++) {
      var pr2 = 1, on = {};
      for (var b = 0; b < benchAll.length; b++) {
        var id = benchAll[b], up = (m & (1 << b)) === 0;
        on[id] = up; pr2 *= up ? pOf[id] : 1 - pOf[id];
      }
      if (pr2 > 0) benchPatterns.push({ on: on, p: pr2 });
    }
    res.patterns = subsets.length * Math.max(1, benchPatterns.length);
    res.truncatedMass = clamp(1 - mass, 0, 1);
    var evaluate = function (order) {
      var full = (res.gkSub === null ? [] : [res.gkSub]).concat(order);
      var gain = 0, pEnter = {};
      full.forEach(function (id) { pEnter[id] = 0; });
      subsets.forEach(function (S) {
        var anyBlank = false;
        for (var i = 0; i < xi.length; i++) if (S.blank[xi[i]]) { anyBlank = true; break; }
        if (!anyBlank) return;                                  // nobody to replace: no sub enters
        benchPatterns.forEach(function (B) {
          var p = S.p * B.p;
          if (p <= 0) return;
          var r = autosubResolve(xi, full, function (id) {
            if (S.blank[id] !== undefined) return !S.blank[id];
            if (B.on[id] !== undefined) return B.on[id];
            return true;
          }, ctx);
          if (!r.ok) return;
          r.subsIn.forEach(function (id) { pEnter[id] = num(pEnter[id], 0) + p; gain += p * num(eOf[id], 0); });
        });
      });
      return { gain: gain, pEnter: pEnter, order: order.slice() };
    };
    var planned = benchOrder(squad, xi, ctx);
    if (planned.length !== outfield.length) planned = outfield.slice();
    var mine = evaluate(planned), best = null, worst = null;
    permutations(outfield).forEach(function (o) {
      var v = evaluate(o);
      if (!best || v.gain > best.gain) best = v;
      if (!worst || v.gain < worst.gain) worst = v;
    });
    res.order = planned.slice();
    res.expectedGain = mine.gain;
    res.bestGain = best ? best.gain : mine.gain;
    res.worstGain = worst ? worst.gain : mine.gain;
    res.bestOrder = best ? best.order.slice() : planned.slice();
    res.orderValue = Math.max(0, res.bestGain - res.worstGain);
    var counts = posCounts(xi, ctx.els);
    benchAll.forEach(function (id) {
      var el = ctx.els[id], bt = elType(el);
      var replaces = xi.filter(function (s) {
        var st = elType(ctx.els[s]);
        if (st === 1 || bt === 1) return st === bt;
        var c = { 2: counts[2], 3: counts[3], 4: counts[4] }; c[st]--; c[bt]++;
        return c[2] >= 3 && c[3] >= 2 && c[4] >= 1;
      });
      var pe = clamp(num(mine.pEnter[id], 0), 0, 1);
      res.rows.push({
        id: id, web_name: String(el.web_name || ""), pos: POS_NAME[bt] || "?",
        pStart: pOf[id], eGiven: eOf[id], pEnter: pe, value: pe * num(eOf[id], 0), replaces: replaces.slice()
      });
    });
    res.ok = true;
    res.note = "P(comes on) is exact over " + res.patterns + " played/blanked patterns under the real autosub rules (" +
      (res.truncatedMass * 100).toFixed(4) + "% of the probability left out as more simultaneous blanks than the bench could cover). " +
      "The bench is worth " + res.expectedGain.toFixed(2) + " expected points this gameweek and the ORDER is worth " +
      res.orderValue.toFixed(2) + " of that. Back-tested over the finished gameweeks the ordering has returned 0 points, " +
      "because no starter has blanked (leakBacktest, ERRORS.md E-091).";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// The fifteen as it was submitted for a finished gameweek, in bench order.
function picksOf(live, gw) {
  var res = { ok: false, gw: intOf(gw, 0), xi: [], bench: [], ids: [], capId: null, viceId: null, chip: null };
  try {
    if (!isObj(live) || !isObj(live.picks)) return res;
    var p = live.picks[gw] || live.picks[String(gw)];
    if (!isObj(p) || !Array.isArray(p.picks)) return res;
    var rows = p.picks.filter(isObj).slice().sort(function (a, b) { return num(a.position, 0) - num(b.position, 0); });
    if (rows.length < 11) return res;
    res.chip = p.active_chip === undefined ? null : p.active_chip;
    rows.forEach(function (r, i) {
      var id = num(r.element, NaN); if (!isFinite(id)) return;
      res.ids.push(id);
      if (i < 11) res.xi.push(id); else res.bench.push(id);
      if (r.is_captain === true) res.capId = id;
      if (r.is_vice_captain === true) res.viceId = id;
    });
    // A bench goalkeeper is tried only against the starting goalkeeper, so his place in the
    // bench list does not matter; the outfield order does. Keep the submitted order verbatim.
    res.ok = res.xi.length === 11;
  } catch (e) { /* total */ }
  return res;
}

// {id: {pts, mins}} for one finished gameweek, in the shape entryPoints reads. A player absent
// from the block did not play: the snapshot omits zero-minute rows (CONTRACT §3).
function gwSims(live, gw, ids) {
  var out = {};
  try {
    var rows = isObj(live) && isObj(live.gw) && isObj(live.gw[gw] || live.gw[String(gw)])
      ? (live.gw[gw] || live.gw[String(gw)]).elements : null;
    arr(ids).forEach(function (id) {
      var row = isObj(rows) ? rows[id] : null;
      out[id] = Array.isArray(row) ? { pts: num(row[2], 0), mins: num(row[0], 0) } : { pts: 0, mins: 0 };
    });
  } catch (e) { /* total */ }
  return out;
}

/* The best total a fifteen could have produced, exactly: every legal eleven of the fifteen, every
 * ordering of the outfield substitutes, scored through entryPoints — the same function the Monte
 * Carlo uses, so the autosub rules, the captain double and the vice fallback are the shipped ones
 * and not a second copy of them. `mustCaptain` holds the armband, which is what isolates the
 * eleven-selection leak from the captaincy leak. */
function bestEntryOverElevens(ids, capId, viceId, sims, ctx, mustCaptain) {
  var res = { best: null, xi: [], bench: [], formation: "", elevens: 0, ok: false };
  try {
    if (!okCtx(ctx)) return res;
    var list = uniq(idList(ids)).filter(function (id) { return ctx.els[id]; });
    if (list.length < 11 || list.length > 15) return res;
    var cap = num(capId, NaN), force = mustCaptain === false ? false : true;
    combos(list, 11).forEach(function (xi) {
      if (!legalXI(xi, ctx.els).ok) return;
      if (force && isFinite(cap) && xi.indexOf(cap) < 0) return;
      res.elevens++;
      var rest = list.filter(function (id) { return xi.indexOf(id) < 0; });
      var bgk = rest.filter(function (id) { return elType(ctx.els[id]) === 1; });
      var bof = rest.filter(function (id) { return elType(ctx.els[id]) !== 1; });
      permutations(bof).forEach(function (ord) {
        var t = entryPoints(xi, bgk.concat(ord), capId, viceId, sims, ctx);
        if (res.best === null || t > res.best) { res.best = t; res.xi = xi.slice(); res.bench = bgk.concat(ord); res.formation = formationOf(xi, ctx.els); }
      });
    });
    res.ok = res.best !== null;
    if (!res.ok) res.best = 0;
  } catch (e) { /* total */ }
  return res;
}

/* leakBacktest — where the points actually leaked, measured against every finished gameweek.
 *
 * This function exists because a headline statistic in this project was wrong for three
 * versions. CLAUDE.md roadmap F3 justified a bench-order optimiser with "21 bench points wasted
 * to date" (43 by GW5). That figure is `history.current[].points_on_bench`, which is what the
 * bench SCORED while benched. None of it is receivable: a sub's points only ever reach the total
 * when a starter plays zero minutes and an autosub fires. It is not a loss and reordering
 * nothing recovers it (ERRORS.md E-091).
 *
 * What is measured here instead, per gameweek, with perfect hindsight and the real rules:
 *   bench   — the best legal ORDERING of the outfield substitutes against the one submitted
 *   xi      — the best legal ELEVEN of his own fifteen, captain held at the one he chose
 *   captain — the best armband from the eleven he actually fielded, XI held
 * and beside each, what the engine would have chosen ex ante from a snapshot truncated to the
 * gameweeks before it. Perfect hindsight is an upper bound no model reaches: the three figures
 * are a ranking of where the effort belongs, not a target.
 */
function leakBacktest(live, opts) {
  var res = {
    ok: false, gws: [], totals: { bench: 0, xi: 0, captain: 0, actual: 0, engineXi: 0, engineCaptain: 0 },
    reconciles: true, reported: { pointsOnBench: 0, note: "" }, engineAvailable: 0, flaggedToday: 0, note: ""
  };
  try {
    var o = isObj(opts) ? opts : {};
    if (!isObj(live) || !isObj(live.gw) || !isObj(live.picks)) { res.note = "no finished gameweeks with picks in the snapshot"; return res; }
    var gws = Object.keys(live.gw).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum);
    var histRows = isObj(live.history) && Array.isArray(live.history.current) ? live.history.current : [];
    var histOf = {}; histRows.forEach(function (r) { if (isObj(r)) histOf[intOf(r.event, -1)] = r; });
    var ctxNow = isObj(o.ctx) && o.ctx.ok ? o.ctx : buildCtx(live, o.state || null, o.now || live.fetched_at);
    if (!ctxNow.ok) { res.note = "context could not be built"; return res; }
    gws.forEach(function (g) {
      var pk = picksOf(live, g);
      if (!pk.ok) return;
      var sims = gwSims(live, g, pk.ids);
      var playedOf = function (id) { return num((sims[id] || {}).mins, 0) > 0; };
      var ptsOf = function (id) { return num((sims[id] || {}).pts, 0); };
      var actual = entryPoints(pk.xi, pk.bench, pk.capId, pk.viceId, sims, ctxNow);
      var hist = histOf[g] || null;
      var reported = hist ? num(hist.points, NaN) : NaN;
      var recon = !isFinite(reported) || Math.abs(reported - actual) < 1e-9;
      if (!recon) res.reconciles = false;
      // bench ordering, perfect hindsight
      var gkSub = pk.bench.filter(function (id) { return elType(ctxNow.els[id]) === 1; });
      var outSub = pk.bench.filter(function (id) { return elType(ctxNow.els[id]) !== 1; });
      var benchBest = actual;
      permutations(outSub).forEach(function (ord) {
        var t = entryPoints(pk.xi, gkSub.concat(ord), pk.capId, pk.viceId, sims, ctxNow);
        if (t > benchBest) benchBest = t;
      });
      var blanks = pk.xi.filter(function (id) { return !playedOf(id); });
      var fired = autosubResolve(pk.xi, pk.bench, playedOf, ctxNow).subsIn.length;
      // XI selection, captain held at his own choice
      var hind = bestEntryOverElevens(pk.ids, pk.capId, pk.viceId, sims, ctxNow, true);
      var xiBest = hind.ok && hind.best > actual ? hind.best : actual;
      // captaincy, XI held
      var capBest = actual, capBestId = pk.capId;
      pk.xi.forEach(function (id) {
        var t = entryPoints(pk.xi, pk.bench, id, pk.viceId, sims, ctxNow);
        if (t > capBest) { capBest = t; capBestId = id; }
      });
      // the engine's own ex-ante answer, from a snapshot truncated to the gameweeks before g
      var eng = { available: false, xi: null, capId: null, viceId: null, xiPoints: null, capPoints: null, note: "" };
      if (g > gws[0]) {
        var cut = truncateElements(truncateLive(live, g - 1), g - 1);
        var evObj = arr(live.events).filter(function (e) { return isObj(e) && intOf(e.id, -1) === g; })[0];
        var ctxK = buildCtx(cut, { squad: pk.ids.map(function (id) { return { id: id, purchase: num((ctxNow.els[id] || {}).now_cost, 0) }; }), confirmed_gw: g - 1 }, evObj && evObj.deadline_time ? evObj.deadline_time : null);
        if (ctxK.ok) {
          var bx = bestXI(pk.ids, ctxK);
          if (bx.ids.length === 11) {
            var ebGk = bx.bench.filter(function (id) { return elType(ctxK.els[id]) === 1; });
            var ebOut = benchOrder(pk.ids, bx.ids, ctxK);
            eng.available = true; eng.xi = bx.ids.slice(); eng.capId = bx.capId; eng.viceId = bx.viceId;
            eng.xiPoints = entryPoints(bx.ids, ebGk.concat(ebOut), pk.capId, pk.viceId, sims, ctxNow);
            eng.capPoints = entryPoints(pk.xi, pk.bench, bx.capId === null ? pk.capId : bx.capId, pk.viceId, sims, ctxNow);
            res.engineAvailable++;
          } else eng.note = "the engine could not field a legal eleven from the fifteen";
        } else eng.note = "the truncated context did not build";
      } else eng.note = "no gameweek of history exists before the first finished gameweek";
      var flagged = pk.ids.filter(function (id) { return (ctxNow.flags[id] || flagInfo(ctxNow.els[id])).flagged; }).length;
      res.flaggedToday += flagged;
      var row = {
        gw: g, actual: actual, reported: isFinite(reported) ? reported : null, reconciles: recon,
        pointsOnBench: hist ? num(hist.points_on_bench, 0) : 0,
        blanks: blanks.length, autosubsFired: fired,
        bench: { best: benchBest, leak: benchBest - actual, orderings: permutations(outSub).length },
        xi: { best: xiBest, leak: xiBest - actual, formationHindsight: hind.formation, elevens: hind.elevens, engine: eng.xiPoints, engineLeak: eng.xiPoints === null ? null : eng.xiPoints - actual },
        captain: {
          playedId: pk.capId, best: capBest, bestId: capBestId, leak: capBest - actual,
          engineId: eng.capId, engine: eng.capPoints, engineLeak: eng.capPoints === null ? null : eng.capPoints - actual
        },
        engine: { available: eng.available, capId: eng.capId, note: eng.note },
        flaggedToday: flagged
      };
      res.gws.push(row);
      res.totals.actual += actual;
      res.totals.bench += row.bench.leak;
      res.totals.xi += row.xi.leak;
      res.totals.captain += row.captain.leak;
      if (row.xi.engineLeak !== null) res.totals.engineXi += row.xi.engineLeak;
      if (row.captain.engineLeak !== null) res.totals.engineCaptain += row.captain.engineLeak;
      res.reported.pointsOnBench += row.pointsOnBench;
    });
    res.ok = res.gws.length > 0;
    res.reported.note = "points_on_bench over these gameweeks sums to " + res.reported.pointsOnBench +
      ", which is what the bench scored while benched. None of it was receivable: " +
      res.gws.reduce(function (s, r) { return s + r.autosubsFired; }, 0) + " autosubs fired across " +
      res.gws.length + " gameweeks. The recoverable bench figure is " + res.totals.bench.toFixed(0) + " (ERRORS.md E-091).";
    res.note = res.ok
      ? ("Perfect hindsight over GW" + res.gws[0].gw + "-GW" + res.gws[res.gws.length - 1].gw + " on " +
         res.totals.actual + " points scored: bench ordering " + res.totals.bench.toFixed(0) +
         ", XI selection " + res.totals.xi.toFixed(0) + ", captaincy " + res.totals.captain.toFixed(0) +
         ". Hindsight is an upper bound no model reaches — read the three as a ranking of where the effort belongs. " +
         "The engine's own ex-ante choices, scored on the same gameweeks, are " + res.totals.engineXi.toFixed(0) +
         " for the eleven and " + res.totals.engineCaptain.toFixed(0) + " for the armband against what he played. " +
         "Today's injury flags are the only present-tense input (E-069): " + res.flaggedToday + " flagged player-gameweeks.")
      : "no finished gameweek carried both picks and a live block";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

/* truncateLive cuts the per-gameweek blocks and un-finishes later fixtures, but it leaves
 * `elements[]` alone — and those carry SEASON-CUMULATIVE totals taken at fetch time. shrunkPps
 * reads total_points/starts straight off the element, so a walk-forward built on truncateLive
 * alone reads the gameweek it is predicting through the back door. This rebuilds every
 * cumulative field from the gameweek rows that survive the cut.
 *
 * What cannot be historised, and is left present-tense on purpose: `status`, `chance` and `news`
 * (the snapshot carries one availability per player, not one per gameweek — E-069) and prices.
 * Callers report the flag count so the concession is visible rather than silent.
 */
function truncateElements(live, uptoGw) {
  try {
    if (!isObj(live)) return null;   // nothing to truncate; never hand junk input back as if it were a snapshot (mc_full P05, E-147)
    var upto = intOf(uptoGw, 0);
    var gw = isObj(live.gw) ? live.gw : {};
    var keys = Object.keys(gw).map(function (k) { return num(k, NaN); }).filter(isFinite).filter(function (k) { return k <= upto; }).sort(sortNum);
    var acc = {};
    keys.forEach(function (g) {
      var rows = isObj(gw[g]) && isObj(gw[g].elements) ? gw[g].elements : (isObj(gw[String(g)]) && isObj(gw[String(g)].elements) ? gw[String(g)].elements : {});
      Object.keys(rows).forEach(function (id) {
        var r = rows[id]; if (!Array.isArray(r)) return;
        var a = acc[id] = acc[id] || { minutes: 0, starts: 0, total_points: 0, xg: 0, xa: 0, xgc: 0, dc: 0, bps: 0, ict: 0, goals: 0, assists: 0, cs: 0, gc: 0, bonus: 0, yc: 0, rc: 0, og: 0, pen_miss: 0, pen_save: 0, saves: 0 };
        a.minutes += num(r[0], 0); a.starts += num(r[1], 0); a.total_points += num(r[2], 0);
        a.xg += num(r[3], 0); a.xa += num(r[4], 0); a.xgc += num(r[5], 0); a.dc += num(r[6], 0);
        a.bps += num(r[7], 0); a.ict += num(r[8], 0); a.goals += num(r[9], 0); a.assists += num(r[10], 0);
        a.cs += num(r[11], 0); a.gc += num(r[12], 0); a.bonus += num(r[13], 0); a.yc += num(r[14], 0);
        a.rc += num(r[15], 0); a.og += num(r[16], 0); a.pen_miss += num(r[17], 0); a.pen_save += num(r[18], 0);
        a.saves += num(r[19], 0);
      });
    });
    var out = {}; Object.keys(live).forEach(function (k) { out[k] = live[k]; });
    out.elements = arr(live.elements).map(function (el) {
      if (!isObj(el)) return el;
      var c = {}; Object.keys(el).forEach(function (k) { c[k] = el[k]; });
      var a = acc[el.id];
      ["minutes", "starts", "total_points", "xg", "xa", "xgc", "dc", "bps", "ict", "goals", "assists", "cs", "gc", "bonus", "yc", "rc", "og", "pen_miss", "pen_save", "saves"].forEach(function (k) {
        c[k] = a ? a[k] : 0;
      });
      c.truncated_to_gw = upto;
      return c;
    });
    return out;
  } catch (e) { return live; }
}

// ---------------------------------------------------------------- the winning objective (A1)

/* The app has always maximised expected points. That is not the stated objective. CLAUDE.md A1
 * says: win the overall competition, every mini-league and the draft pool — first, not top-10k.
 * Those are different problems. In a seven-team league against known squads the fifteen that
 * maximises expected points is often not the fifteen that maximises P(first), because finishing
 * first depends on variance and on CORRELATION with what the rivals already own: a player 100% of
 * the field owns adds points to everyone's total and moves nobody's rank.
 *
 * Both objectives are computed, both are shown and the difference is priced. Neither replaces the
 * other and neither is silently promoted — the same discipline the convergence lock uses.
 *
 * E4's reporting rule still binds. Below MC_MIN_GWS_FOR_PWIN finished gameweeks a win probability
 * compounds a short edge into false certainty (the "99% to win" result, E-020), so `pFirstShown`
 * is null and the headline carries direction and a rank band. `pFirst` is still computed, because
 * comparing two candidate squads requires it; what is barred is printing it as a headline.
 */
function winnableLeagues(ctx, opts) {
  var out = [];
  try {
    if (!okCtx(ctx)) return out;
    var o = isObj(opts) ? opts : {};
    var cap = intOf(o.maxSize, WINNABLE_MAX_SIZE);
    var only = Array.isArray(o.leagues) ? o.leagues.map(function (v) { return num(v, NaN); }).filter(isFinite) : null;
    arr(ctx.leagues).forEach(function (L) {
      if (!isObj(L)) return;
      var id = num(L.id, NaN); if (!isFinite(id)) return;
      var size = intOf(L.size, arr(L.standings).length);
      if (only && only.indexOf(id) < 0) return;
      if (!only && size > cap) return;
      out.push({ id: id, name: String(L.name || ""), size: size, rank: intOf(L.rank, 0) || null, standings: arr(L.standings).length });
    });
  } catch (e) { /* total */ }
  return out;
}

// One league's field: the rivals' actual submitted fifteens, keyed the way mcLeague keys them.
// A rival whose picks are not in the snapshot is carried as null and scores the simulated field
// mean in every draw, which is stated rather than hidden.
function leagueField(ctx, leagueId) {
  var res = { ok: false, leagueId: null, name: "", size: 0, rows: [], meIndex: -1, missingPicks: 0, simulated: 0, myTotal: 0, note: "" };
  try {
    if (!okCtx(ctx)) return res;
    var L = arr(ctx.leagues).filter(function (l) { return isObj(l) && num(l.id, NaN) === num(leagueId, NaN); })[0];
    if (!L) { res.note = "league not in the snapshot"; return res; }
    res.leagueId = num(L.id); res.name = String(L.name || ""); res.size = intOf(L.size, arr(L.standings).length);
    var me = isObj(ctx.live) && isObj(ctx.live.entry) ? num(ctx.live.entry.id, NaN) : NaN;
    var rivals = isObj(ctx.live) && isObj(ctx.live.rivals) ? ctx.live.rivals : {};
    arr(L.standings).forEach(function (r) {
      if (!isObj(r)) return;
      var e = num(r.entry, NaN); if (!isFinite(e)) return;
      var row = { entry: e, total: num(r.total, 0), rank: intOf(r.rank, 0), me: e === me, xi: null, bench: [], cap: null };
      if (!row.me && isObj(rivals[e]) && Array.isArray(rivals[e].picks)) {
        var pk = rivals[e].picks.filter(isObj).slice().sort(function (a, b) { return num(a.position, 0) - num(b.position, 0); });
        var ids = pk.map(function (p) { return num(p.element, NaN); }).filter(function (id) { return isFinite(id) && ctx.els[id]; });
        if (ids.length >= 11 && legalXI(ids.slice(0, 11), ctx.els).ok) {
          row.xi = ids.slice(0, 11); row.bench = ids.slice(11);
          var cp = pk.filter(function (p) { return p.is_captain === true || num(p.multiplier, 1) >= 2; })[0];
          row.cap = cp ? num(cp.element) : null;
        }
      }
      res.rows.push(row);
    });
    res.meIndex = res.rows.map(function (r) { return r.me; }).indexOf(true);
    if (res.meIndex < 0) {
      res.rows.push({ entry: isFinite(me) ? me : 0, total: isObj(ctx.live) && isObj(ctx.live.entry) ? num(ctx.live.entry.summary_overall_points, 0) : 0, rank: res.rows.length + 1, me: true, xi: null, bench: [], cap: null });
      res.meIndex = res.rows.length - 1;
    }
    res.myTotal = res.rows[res.meIndex].total;
    res.missingPicks = res.rows.filter(function (r) { return !r.me && !r.xi; }).length;
    res.simulated = res.rows.filter(function (r) { return !r.me && r.xi; }).length;
    res.ok = res.rows.length > 0;
    res.note = res.simulated + " of " + (res.rows.length - 1) + " rivals carry submitted picks; " + res.missingPicks + " score the simulated field mean.";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// Candidates in, {key,label,xi,bench,cap,vice,ids} out. Accepts an id array, an object with ids,
// or nothing at all — in which case the manager's own submitted fifteen is the one candidate.
function candidateSquads(ctx, candidates) {
  var out = [];
  try {
    if (!okCtx(ctx)) return out;
    var list = Array.isArray(candidates) && candidates.length ? candidates : [null];
    list.forEach(function (c, i) {
      var ids, key, label, capId = null, viceId = null;
      if (Array.isArray(c)) { ids = c; key = "c" + (i + 1); label = "candidate " + (i + 1); }
      else if (isObj(c)) {
        ids = Array.isArray(c.ids) ? c.ids : (Array.isArray(c.squad) ? c.squad : []);
        key = String(c.key || ("c" + (i + 1))); label = String(c.label || key);
        capId = c.capId === undefined ? null : c.capId; viceId = c.viceId === undefined ? null : c.viceId;
      } else {
        ids = arr(ctx.picks).length ? arr(ctx.picks).slice().sort(function (a, b) { return num(a.position, 0) - num(b.position, 0); }).map(function (p) { return num(p.element, NaN); }) : ctx.squadIds;
        key = "current"; label = "the fifteen he submitted";
        var cp = arr(ctx.picks).filter(function (p) { return isObj(p) && (p.is_captain === true || num(p.multiplier, 1) >= 2); })[0];
        var vp = arr(ctx.picks).filter(function (p) { return isObj(p) && p.is_vice_captain === true; })[0];
        if (cp) capId = num(cp.element, NaN); if (vp) viceId = num(vp.element, NaN);
      }
      var so = squadOrder(ids, capId, ctx);
      if (!so) return;
      var vice = num(viceId, NaN);
      if (!isFinite(vice) || so.xi.indexOf(vice) < 0) {
        var cpk = captainPick(so.xi, ctx); vice = cpk.viceId === null ? null : cpk.viceId;
      }
      out.push({ key: key, label: label, ids: uniq(idList(ids)), xi: so.xi, bench: so.bench, cap: so.cap, vice: vice });
    });
  } catch (e) { /* total */ }
  return out;
}

/* The shared loop. Every candidate is scored on THE SAME fixture and player draws (common random
 * numbers), so the EV comparison and the P(first) comparison are both paired: a difference between
 * two candidates is a difference between the squads and not between two sets of dice. */
function winProbabilityCore(ctx, candidates, opts) {
  var res = {
    ok: false, iters: 0, seed: 0, gwsOfData: 0, reportable: false, event: 0,
    leagues: [], candidates: [], note: ""
  };
  try {
    if (!okCtx(ctx)) { res.note = "no context"; return res; }
    var o = isObj(opts) ? opts : {};
    var cands = candidateSquads(ctx, candidates);
    if (!cands.length) { res.note = "no legal candidate squad to simulate"; return res; }
    var Ls = winnableLeagues(ctx, o);
    var fields = [];
    Ls.forEach(function (L) { var f = leagueField(ctx, L.id); if (f.ok) fields.push(f); });
    if (!fields.length) { res.note = "no winnable league in the snapshot to simulate against"; return res; }
    var n = clamp(intOf(o.iters, WINPROB_ITERS), MC_MIN_ITERS, 20000);
    var seed = intOf(o.seed, 89);
    var R = mulberry32(seed);
    res.iters = n; res.seed = seed; res.event = ctx.nextEvent;
    res.gwsOfData = arr(ctx.finishedGws).length;
    res.reportable = res.gwsOfData >= MC_MIN_GWS_FOR_PWIN;
    // the union of every player who has to be simulated
    var union = {};
    cands.forEach(function (c) { c.xi.concat(c.bench).forEach(function (id) { union[id] = true; }); });
    fields.forEach(function (f) { f.rows.forEach(function (r) { if (r.xi) r.xi.concat(r.bench).forEach(function (id) { union[id] = true; }); }); });
    var unionIds = Object.keys(union).map(Number).filter(function (id) { return ctx.els[id]; });
    // accumulators
    var acc = cands.map(function () {
      return { pts: [], leagues: fields.map(function () { return { first: 0, top: 0, rankSum: 0, ranks: [] }; }), anyFirst: 0, allFirst: 0 };
    });
    for (var i = 0; i < n; i++) {
      var draws = fixtureDraws(ctx, R), sims = {};
      unionIds.forEach(function (id) { sims[id] = simPlayerDetail(ctx.els[id], ctx, R, draws); });
      var myPts = cands.map(function (c) { return entryPoints(c.xi, c.bench, c.cap, c.vice, sims, ctx); });
      myPts.forEach(function (p, ci) { acc[ci].pts.push(p); });
      for (var li = 0; li < fields.length; li++) {
        var f = fields[li], rivalTotals = [], known = [];
        for (var ri = 0; ri < f.rows.length; ri++) {
          var row = f.rows[ri];
          if (row.me) continue;
          if (row.xi) { var p2 = entryPoints(row.xi, row.bench, row.cap, null, sims, ctx); known.push(p2); rivalTotals.push({ base: row.total, pts: p2, filled: false }); }
          else rivalTotals.push({ base: row.total, pts: null, filled: true });
        }
        var fillMean = known.length ? sum(known) / known.length : 0;
        for (var ci2 = 0; ci2 < cands.length; ci2++) {
          var mine = f.myTotal + myPts[ci2], rank = 1;
          for (var k = 0; k < rivalTotals.length; k++) {
            var t = rivalTotals[k].base + (rivalTotals[k].pts === null ? fillMean : rivalTotals[k].pts);
            if (t > mine) rank++;
          }
          var a = acc[ci2].leagues[li];
          a.rankSum += rank; a.ranks.push(rank);
          if (rank === 1) a.first++;
          if (rank <= WINPROB_TOP_N) a.top++;
        }
      }
      for (var ci3 = 0; ci3 < cands.length; ci3++) {
        var anyF = false, allF = true;
        for (var lj = 0; lj < fields.length; lj++) {
          var last = acc[ci3].leagues[lj].ranks[acc[ci3].leagues[lj].ranks.length - 1];
          if (last === 1) anyF = true; else allF = false;
        }
        if (anyF) acc[ci3].anyFirst++;
        if (allF) acc[ci3].allFirst++;
      }
    }
    res.leagues = fields.map(function (f) { return { leagueId: f.leagueId, name: f.name, size: f.size, entries: f.rows.length, rivalsSimulated: f.simulated, missingPicks: f.missingPicks, currentRank: f.rows[f.meIndex].rank || null, note: f.note }; });
    res.candidates = cands.map(function (c, ci) {
      var a = acc[ci];
      var ev = distStats(a.pts);
      var per = a.leagues.map(function (g, li) {
        var ranks = g.ranks.slice().sort(sortNum);
        var cur = res.leagues[li].currentRank;
        var med = quantile(ranks, 0.5);
        var band = [quantile(ranks, 0.1), quantile(ranks, 0.9)];
        var dir = cur === null ? "hold" : (med < cur - 0.5 ? "up" : (med > cur + 0.5 ? "down" : "hold"));
        return {
          leagueId: res.leagues[li].leagueId, name: res.leagues[li].name, size: res.leagues[li].size,
          pFirst: clamp(g.first / n, 0, 1), pTop3: clamp(g.top / n, 0, 1),
          pFirstShown: res.reportable ? clamp(g.first / n, 0, 1) : null,
          expRank: g.rankSum / n, medianRank: med, rankBand: band, currentRank: cur, direction: dir,
          headline: "GW" + ctx.nextEvent + " " + res.leagues[li].name + ": rank " + (cur === null ? "unknown" : cur) +
            " → median " + med.toFixed(1) + ", tenth to ninetieth " + band[0].toFixed(0) + " to " + band[1].toFixed(0) +
            " (" + dir + ")" + (res.reportable ? ", P(first) " + (100 * g.first / n).toFixed(1) + "%" : "")
        };
      });
      var pf = per.map(function (p) { return p.pFirst; });
      return {
        key: c.key, label: c.label, ids: c.ids.slice(), capId: c.cap, viceId: c.vice,
        ev: ev, leagues: per,
        pooled: {
          pFirstMean: pf.length ? sum(pf) / pf.length : 0,
          pFirstBest: pf.length ? Math.max.apply(null, pf) : 0,
          pFirstWorst: pf.length ? Math.min.apply(null, pf) : 0,
          pAnyFirst: clamp(a.anyFirst / n, 0, 1), pAllFirst: clamp(a.allFirst / n, 0, 1),
          expRankMean: per.length ? sum(per, function (p) { return p.expRank; }) / per.length : 0
        }
      };
    });
    res.ok = true;
    res.note = "One gameweek (GW" + ctx.nextEvent + ") simulated " + n + " times against the rivals' actual GW" + ctx.currentEvent +
      " fifteens, over " + fields.length + " winnable league" + (fields.length === 1 ? "" : "s") + " and " + unionIds.length +
      " players, on shared per-fixture goal draws. " +
      (res.reportable
        ? ("P(first) is reported: " + res.gwsOfData + " finished gameweeks.")
        : ("Direction and rank band only: " + res.gwsOfData + " of the " + MC_MIN_GWS_FOR_PWIN +
           " finished gameweeks a win probability needs before it can be a headline (E-020). The probabilities are computed — a squad comparison cannot be made without them — and pFirstShown is null."));
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

function winProbability(ctx, opts) {
  var o = isObj(opts) ? opts : {};
  var cands = Array.isArray(o.candidates) ? o.candidates : (Array.isArray(o.ids) && o.ids.length ? [{ key: "candidate", label: "candidate fifteen", ids: o.ids, capId: o.capId, viceId: o.viceId }] : null);
  var core = winProbabilityCore(ctx, cands, o);
  var res = {
    ok: core.ok, iters: core.iters, seed: core.seed, gwsOfData: core.gwsOfData, reportable: core.reportable,
    event: core.event, leagues: [], pooled: null, candidate: null, note: core.note
  };
  if (core.ok && core.candidates.length) {
    res.candidate = { key: core.candidates[0].key, label: core.candidates[0].label, ids: core.candidates[0].ids, capId: core.candidates[0].capId, viceId: core.candidates[0].viceId, ev: core.candidates[0].ev };
    res.leagues = core.candidates[0].leagues;
    res.pooled = core.candidates[0].pooled;
  }
  return res;
}

/* objectiveCompare — the two objectives side by side, priced.
 *
 * Every candidate is scored under expected points and under P(first), from one set of shared
 * draws. Where they disagree the panel says so in the words that describe what is happening: a
 * differential that LOWERS EV BUT RAISES P(FIRST) is the whole point of the exercise, and the
 * opposite — a safe pick that raises EV and lowers P(first) — is the trap. Nothing is promoted:
 * both columns are shown and the manager chooses.
 */
function objectiveCompare(ctx, candidates, opts) {
  var res = {
    ok: false, iters: 0, seed: 0, gwsOfData: 0, reportable: false, event: 0, leagues: [],
    candidates: [], byEv: null, byWin: null, agree: true, disagree: false, pairs: [], note: "", verdict: ""
  };
  try {
    var o = isObj(opts) ? opts : {};
    var core = winProbabilityCore(ctx, candidates, o);
    res.ok = core.ok; res.iters = core.iters; res.seed = core.seed; res.gwsOfData = core.gwsOfData;
    res.reportable = core.reportable; res.event = core.event; res.leagues = core.leagues;
    res.note = core.note;
    if (!core.ok) { res.verdict = core.note; return res; }
    var byEv = core.candidates.slice().sort(function (a, b) { return b.ev.mean - a.ev.mean; });
    var byWin = core.candidates.slice().sort(function (a, b) { return b.pooled.pAnyFirst - a.pooled.pAnyFirst || b.pooled.pFirstMean - a.pooled.pFirstMean; });
    var evRank = {}, winRank = {};
    byEv.forEach(function (c, i) { evRank[c.key] = i + 1; });
    byWin.forEach(function (c, i) { winRank[c.key] = i + 1; });
    res.candidates = core.candidates.map(function (c) {
      return {
        key: c.key, label: c.label, ids: c.ids.slice(), capId: c.capId, viceId: c.viceId,
        ev: c.ev, leagues: c.leagues, pooled: c.pooled,
        evRank: evRank[c.key], winRank: winRank[c.key], objectivesAgree: evRank[c.key] === winRank[c.key]
      };
    });
    res.byEv = byEv[0].key; res.byWin = byWin[0].key;
    res.agree = res.byEv === res.byWin; res.disagree = !res.agree;
    // every ordered pair, priced
    for (var a = 0; a < core.candidates.length; a++) for (var b = 0; b < core.candidates.length; b++) {
      if (a === b) continue;
      var A = core.candidates[a], B = core.candidates[b];
      var dEv = A.ev.mean - B.ev.mean;
      var dWin = A.pooled.pFirstMean - B.pooled.pFirstMean;
      var dAny = A.pooled.pAnyFirst - B.pooled.pAnyFirst;
      var verdict;
      if (dEv < 0 && dWin > 0) verdict = A.label + " lowers EV but raises P(first) against " + B.label + ": " + Math.abs(dEv).toFixed(2) + " expected points given up for " + (dWin * 100).toFixed(2) + " percentage points of P(first). That is the differential trade, and it is the whole point of comparing the two objectives.";
      else if (dEv > 0 && dWin < 0) verdict = A.label + " raises EV but lowers P(first) against " + B.label + ": " + dEv.toFixed(2) + " expected points bought for " + Math.abs(dWin * 100).toFixed(2) + " percentage points of P(first). That is the safe-pick trap — more points, less chance of finishing first.";
      else if (dEv === 0 && dWin === 0) verdict = A.label + " and " + B.label + " are indistinguishable under both objectives on these draws.";
      else verdict = "the two objectives agree between " + A.label + " and " + B.label + " (" + (dEv >= 0 ? "+" : "") + dEv.toFixed(2) + " EV, " + (dWin >= 0 ? "+" : "") + (dWin * 100).toFixed(2) + "pp P(first)).";
      res.pairs.push({ a: A.key, b: B.key, evDelta: dEv, pFirstDelta: dWin, pAnyFirstDelta: dAny, conflict: (dEv < 0 && dWin > 0) || (dEv > 0 && dWin < 0), verdict: verdict });
    }
    var conflicts = res.pairs.filter(function (p) { return p.conflict; });
    res.verdict = (res.agree
      ? "Both objectives name " + byEv[0].label + "."
      : "The objectives disagree: expected points names " + byEv[0].label + " and P(first) names " + byWin[0].label + ".") +
      " " + conflicts.length + " of " + res.pairs.length + " ordered pairs trade one objective against the other. " +
      (res.reportable ? "" : "Under " + MC_MIN_GWS_FOR_PWIN + " finished gameweeks the win probabilities are a direction and a rank band, not a headline percentage (E-020); the DIFFERENCE between two candidates on shared draws is what is being read here, not its level. ") +
      "Neither objective replaces the other: both are shown, the difference is priced, and the manager chooses.";
  } catch (e) { res.note = "engine error: " + errMsg(e); res.verdict = res.note; }
  return res;
}

// ---------------------------------------------------------------- hierarchical partial pooling

/* E1 shrinks a player's points per start towards a position prior with w = starts/(starts+4).
 * The 4 is an assumption, the prior is a constant typed into the file, and — the part that
 * matters — the result carries no uncertainty at all, so the Monte Carlo treats a three-start
 * player and a thirty-start player as equally certain.
 *
 * This is the same idea done properly: an empirical-Bayes two-level model. A player's per-game
 * scoring rate is drawn from a position-level distribution whose mean AND variance are estimated
 * from the data (DerSimonian-Laird moments), the within-player variance is pooled across the
 * position, and every player comes back with a posterior mean and a POSTERIOR VARIANCE. The
 * shrinkage weight is then derived rather than assumed.
 *
 * It enters the tournament as the tenth challenger, `hier_pool`. It drives nothing: E6 and the
 * shared promotion gate apply to it exactly as they apply to player_xg.
 */
function hierRowsFromAcc(acc, types) {
  var rows = [];
  try {
    if (!isObj(acc)) return rows;
    Object.keys(acc).forEach(function (id) {
      var a = acc[id]; if (!isObj(a)) return;
      var n = num(a.played, 0); if (n <= 0) return;
      var mean = num(a.pts, 0) / n;
      var ss = num(a.pts2, NaN);
      var v = (isFinite(ss) && n >= 2) ? Math.max(0, (ss - n * mean * mean) / (n - 1)) : NaN;
      rows.push({ id: num(id, 0), type: intOf(isObj(types) ? types[id] : 3, 3) || 3, n: n, mean: mean, variance: v });
    });
  } catch (e) { /* total */ }
  return rows;
}
function hierGroups(rows) {
  var out = { 1: null, 2: null, 3: null, 4: null, pooled: null, ok: false };
  try {
    var all = arr(rows).filter(function (r) { return isObj(r) && num(r.n, 0) > 0; });
    var fit = function (list, fallbackPrior) {
      var k = list.length;
      var res = {
        n: k, players: k, mu: num(fallbackPrior, 3.5), sigma2: HIER_MIN_SIGMA2, tau2: HIER_MIN_TAU2,
        games: 0, fitted: false, note: ""
      };
      if (!k) { res.note = "no players in this group"; return res; }
      var sw = 0, swy = 0, ssw = 0, sn = 0;
      list.forEach(function (r) { sn += num(r.n, 0); });
      res.games = sn;
      // pooled within-player variance
      var wnum = 0, wden = 0;
      list.forEach(function (r) { var v = num(r.variance, NaN), n = num(r.n, 0); if (isFinite(v) && n >= 2) { wnum += (n - 1) * v; wden += (n - 1); } });
      res.sigma2 = wden > 0 ? Math.max(HIER_MIN_SIGMA2, wnum / wden) : HIER_MIN_SIGMA2;
      // precision-weighted grand mean
      list.forEach(function (r) { var w = num(r.n, 0) / res.sigma2; sw += w; swy += w * num(r.mean, 0); ssw += w * w; });
      if (sw <= 0) { res.note = "no usable precision"; return res; }
      var ybar = swy / sw;
      if (k < HIER_MIN_PLAYERS) {
        res.mu = ybar; res.note = k + " players is too few to estimate a between-player variance; the prior variance stays at its floor";
        return res;
      }
      var Q = 0;
      list.forEach(function (r) { var w = num(r.n, 0) / res.sigma2, d = num(r.mean, 0) - ybar; Q += w * d * d; });
      var denom = sw - ssw / sw;
      var tau2 = denom > 0 ? (Q - (k - 1)) / denom : 0;
      res.tau2 = Math.max(HIER_MIN_TAU2, isFinite(tau2) ? tau2 : 0);
      // re-weight the grand mean with the between-player variance in place
      var sw2 = 0, swy2 = 0;
      list.forEach(function (r) { var w = 1 / (res.sigma2 / num(r.n, 1) + res.tau2); sw2 += w; swy2 += w * num(r.mean, 0); });
      res.mu = sw2 > 0 ? swy2 / sw2 : ybar;
      res.fitted = true;
      res.note = k + " players, " + sn + " player-gameweeks; within-player variance " + res.sigma2.toFixed(3) +
        ", between-player variance " + res.tau2.toFixed(3) + " (DerSimonian-Laird), group mean " + res.mu.toFixed(3);
      return res;
    };
    [1, 2, 3, 4].forEach(function (t) {
      out[t] = fit(all.filter(function (r) { return intOf(r.type, 3) === t; }), PRIOR_PPS[t]);
    });
    out.pooled = fit(all, 3.5);
    out.ok = all.length > 0;
  } catch (e) { /* total */ }
  return out;
}
function hierPosterior(row, group) {
  var res = { n: 0, mean: 0, postMean: 0, postVar: 0, postSd: 0, weight: 0, flatWeight: 0, flatMean: 0, shrinkGap: 0, ok: false };
  try {
    if (!isObj(row)) return res;
    var t = intOf(row.type, 3) || 3;
    var g = isObj(group) ? group : null;
    var mu = g ? num(g.mu, PRIOR_PPS[t] || 3.5) : (PRIOR_PPS[t] || 3.5);
    var sigma2 = Math.max(HIER_MIN_SIGMA2, g ? num(g.sigma2, HIER_MIN_SIGMA2) : HIER_MIN_SIGMA2);
    var tau2 = Math.max(HIER_MIN_TAU2, g ? num(g.tau2, HIER_MIN_TAU2) : HIER_MIN_TAU2);
    var n = Math.max(0, num(row.n, 0)), mean = num(row.mean, 0);
    res.n = n; res.mean = mean;
    var prec = n / sigma2 + 1 / tau2;
    if (!(prec > 0) || !isFinite(prec)) return res;
    res.postMean = (n / sigma2 * mean + mu / tau2) / prec;
    res.postVar = 1 / prec;
    res.postSd = Math.sqrt(res.postVar);
    res.weight = clamp((n / sigma2) / prec, 0, 1);
    res.flatWeight = clamp(n / (n + SHRINK_K), 0, 1);
    res.flatMean = res.flatWeight * mean + (1 - res.flatWeight) * (PRIOR_PPS[t] || 3.5);
    res.shrinkGap = res.weight - res.flatWeight;
    res.ok = true;
  } catch (e) { /* total */ }
  return res;
}
function hierPool(live, opts) {
  var res = {
    ok: false, gws: [], positions: {}, players: {}, rows: [], n: 0,
    thin: null, thick: null, varianceRange: [0, 0], note: ""
  };
  try {
    var o = isObj(opts) ? opts : {};
    if (!isObj(live) || !isObj(live.gw)) { res.note = "no finished gameweeks in the snapshot"; return res; }
    var upto = o.upto === undefined ? null : intOf(o.upto, 0);
    var keys = Object.keys(live.gw).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum)
      .filter(function (g) { return upto === null || g <= upto; });
    res.gws = keys.slice();
    var types = {}; arr(live.elements).forEach(function (el) { if (isObj(el)) types[el.id] = elType(el); });
    var names = {}; arr(live.elements).forEach(function (el) { if (isObj(el)) names[el.id] = String(el.web_name || ""); });
    var acc = {};
    keys.forEach(function (g) {
      var rows = isObj(live.gw[g]) && isObj(live.gw[g].elements) ? live.gw[g].elements : {};
      Object.keys(rows).forEach(function (id) {
        var r = rows[id]; if (!Array.isArray(r) || num(r[0], 0) <= 0) return;
        var a = acc[id] = acc[id] || { played: 0, pts: 0, pts2: 0 };
        var p = num(r[2], 0);
        a.played++; a.pts += p; a.pts2 += p * p;
      });
    });
    var rows = hierRowsFromAcc(acc, types);
    var groups = hierGroups(rows);
    [1, 2, 3, 4].forEach(function (t) {
      var g = groups[t];
      res.positions[t] = g ? { pos: POS_NAME[t], players: g.players, games: g.games, mu: g.mu, sigma2: g.sigma2, tau2: g.tau2, fitted: g.fitted, flatPrior: PRIOR_PPS[t], note: g.note } : null;
    });
    var lo = null, hi = null;
    rows.forEach(function (r) {
      var p = hierPosterior(r, groups[r.type]);
      if (!p.ok) return;
      var out = {
        id: r.id, web_name: names[r.id] || "", pos: POS_NAME[r.type] || "?", n: r.n, mean: r.mean,
        variance: isFinite(r.variance) ? r.variance : null,
        postMean: p.postMean, postVar: p.postVar, postSd: p.postSd,
        weight: p.weight, flatWeight: p.flatWeight, flatMean: p.flatMean, shrinkGap: p.shrinkGap
      };
      res.players[r.id] = out; res.rows.push(out); res.n++;
      if (lo === null || p.postVar < lo) lo = p.postVar;
      if (hi === null || p.postVar > hi) hi = p.postVar;
    });
    res.varianceRange = [lo === null ? 0 : lo, hi === null ? 0 : hi];
    var byN = res.rows.slice().sort(function (a, b) { return a.n - b.n || b.postVar - a.postVar; });
    res.thin = byN.length ? byN[0] : null;
    res.thick = byN.length ? byN[byN.length - 1] : null;
    res.ok = res.n > 0;
    res.note = res.ok
      ? (res.n + " players over " + keys.length + " finished gameweeks. Posterior variance runs from " +
         res.varianceRange[0].toFixed(3) + " to " + res.varianceRange[1].toFixed(3) + " points squared — the flat " +
         "starts/(starts+" + SHRINK_K + ") shrinkage produces none at all, which is the point of the exercise. " +
         (res.thin && res.thick ? ("Thinnest row " + res.thin.n + " game" + (res.thin.n === 1 ? "" : "s") + ": posterior sd " +
           res.thin.postSd.toFixed(2) + " against the thickest row's " + res.thick.postSd.toFixed(2) + ". ") : "") +
         "A challenger only: E6 and the shared promotion gate bar it from driving anything.")
      : "no player has a finished gameweek to pool";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- Dixon-Coles, properly (E2)

/* E2 ships a "Dixon-Coles-lite": shrunken attack and defence rates on xG, with no low-score
 * dependence correction and no time decay. The two missing pieces are exactly the two the 1997
 * paper is known for.
 *
 * 1. The tau correction. Independent Poisson margins under-state 0-0, 1-0, 0-1 and 1-1. Those
 *    four cells are where clean-sheet probability lives, and a clean sheet is most of a defender's
 *    value (B1: CS 4 for DEF and GKP), so getting them wrong is not a rounding error.
 *      tau(0,0) = 1 - lam*mu*rho ; tau(0,1) = 1 + lam*rho ; tau(1,0) = 1 + mu*rho ; tau(1,1) = 1 - rho
 * 2. Exponential time decay. A match played eight weeks ago is not the same evidence as one
 *    played on Saturday: every match carries weight exp(-xi * days).
 *
 * Both are added here, the existing TS stays exactly as it is, and the two are scored against each
 * other on clean-sheet calibration specifically — see cleanSheetCalibration. This drives nothing:
 * E-011 retired team strength on goals for CAPTAINCY, and that verdict stands until this
 * measurement, or another, overturns it through the gate.
 */
function dcTau(x, y, lamH, lamA, rho) {
  var r = num(rho, 0), h = Math.max(0, num(lamH, 0)), a = Math.max(0, num(lamA, 0));
  var xi = intOf(x, -1), yi = intOf(y, -1);
  if (xi === 0 && yi === 0) return Math.max(0, 1 - h * a * r);
  if (xi === 0 && yi === 1) return Math.max(0, 1 + h * r);
  if (xi === 1 && yi === 0) return Math.max(0, 1 + a * r);
  if (xi === 1 && yi === 1) return Math.max(0, 1 - r);
  return 1;
}
// The range in which every one of the four tau cells stays non-negative for these rates.
function dcRhoRange(lamH, lamA) {
  var h = Math.max(1e-6, num(lamH, 1)), a = Math.max(1e-6, num(lamA, 1));
  return { lo: Math.max(-1 / h, -1 / a), hi: Math.min(1, 1 / (h * a)) };
}
function poissonPmf(k, lam) {
  var n = intOf(k, -1), L = Math.max(0, num(lam, 0));
  if (n < 0) return 0;
  if (L === 0) return n === 0 ? 1 : 0;
  var lp = -L + n * Math.log(L) - logGamma(n + 1);
  var v = Math.exp(lp);
  return isFinite(v) ? clamp(v, 0, 1) : 0;
}
// P(the named side concedes nothing), with the tau correction applied to the low cells.
function dcCleanSheetProb(lamH, lamA, rho, side) {
  var h = Math.max(1e-6, num(lamH, 0)), a = Math.max(1e-6, num(lamA, 0)), r = num(rho, 0);
  var ph0 = poissonPmf(0, h), ph1 = poissonPmf(1, h), pa0 = poissonPmf(0, a), pa1 = poissonPmf(1, a);
  var p;
  if (String(side) === "a") {
    // the away side keeps it: the home side scores 0, summed over every away scoreline
    p = ph0 * (dcTau(0, 0, h, a, r) * pa0 + dcTau(0, 1, h, a, r) * pa1 + Math.max(0, 1 - pa0 - pa1));
  } else {
    p = pa0 * (dcTau(0, 0, h, a, r) * ph0 + dcTau(1, 0, h, a, r) * ph1 + Math.max(0, 1 - ph0 - ph1));
  }
  return clamp(p, 1e-6, 1 - 1e-6);
}
// The matches a fit may see: finished, at or before the cut, with the chosen basis available.
function dcMatches(live, opts) {
  var out = [];
  try {
    if (!isObj(live)) return out;
    var o = isObj(opts) ? opts : {};
    var basis = String(o.basis || "goals") === "xg" ? "xg" : "goals";
    var upto = o.upto === undefined || o.upto === null ? Infinity : intOf(o.upto, 0);
    var xgOf = {};
    if (basis === "xg" && isObj(live.gw)) Object.keys(live.gw).forEach(function (g) {
      if (num(g, NaN) > upto) return;
      var fx = isObj(live.gw[g]) && isObj(live.gw[g].fixture_xg) ? live.gw[g].fixture_xg : null;
      if (fx) Object.keys(fx).forEach(function (fid) { if (isObj(fx[fid])) xgOf[fid] = fx[fid]; });
    });
    arr(live.fixtures).forEach(function (f) {
      if (!isObj(f)) return;
      var ev = intOf(f.event, -1);
      if (ev < 0 || ev > upto) return;
      var h = num(f.team_h, NaN), a = num(f.team_a, NaN);
      if (!isFinite(h) || !isFinite(a)) return;
      var hg, ag;
      if (basis === "xg") {
        var row = xgOf[f.id]; if (!isObj(row)) return;
        hg = Math.max(0, num(row.h, 0)); ag = Math.max(0, num(row.a, 0));
      } else {
        if (!f.finished) return;
        hg = num(f.team_h_score, NaN); ag = num(f.team_a_score, NaN);
        if (!isFinite(hg) || !isFinite(ag)) return;
      }
      var ko = Date.parse(f.kickoff_time);
      out.push({ event: ev, fixture: f.id, h: h, a: a, hg: hg, ag: ag, ko: isFinite(ko) ? ko : 0, w: 1 });
    });
  } catch (e) { /* total */ }
  return out;
}
function dixonColes(live, opts) {
  var res = {
    ok: false, basis: "goals", xi: DC_DECAY_PER_DAY, upto: null, mu: LBAR_PRIOR, gamma: HOME_ADV,
    att: {}, def: {}, rho: 0, rhoRange: { lo: -1, hi: 1 }, rhoLogLik: 0, matches: 0, weightSum: 0,
    iters: 0, converged: false, loglik: 0, tRef: 0, teams: [], fitCheck: { predicted: 0, observed: 0, gap: 0 },
    shrink: true, shrinkK: TS_K, games: {}, note: ""
  };
  try {
    var o = isObj(opts) ? opts : {};
    res.basis = String(o.basis || "goals") === "xg" ? "xg" : "goals";
    res.xi = Math.max(0, num(o.xi, DC_DECAY_PER_DAY));
    res.upto = o.upto === undefined || o.upto === null ? null : intOf(o.upto, 0);
    var ms = dcMatches(live, { basis: res.basis, upto: res.upto });
    res.matches = ms.length;
    if (ms.length < 4) { res.note = "a Dixon-Coles fit needs at least four matches; this cut carries " + ms.length; return res; }
    var tRef = 0; ms.forEach(function (m) { if (m.ko > tRef) tRef = m.ko; });
    if (o.now !== undefined && o.now !== null) { var t2 = nowMs(o.now); if (t2) tRef = t2; }
    res.tRef = tRef;
    ms.forEach(function (m) {
      var days = tRef && m.ko ? Math.max(0, (tRef - m.ko) / 86400000) : 0;
      m.days = days; m.w = Math.exp(-res.xi * days);
    });
    var teams = {};
    ms.forEach(function (m) { teams[m.h] = true; teams[m.a] = true; });
    var ids = Object.keys(teams).map(Number).sort(sortNum);
    res.teams = ids.slice();
    var att = {}, def = {};
    ids.forEach(function (t) { att[t] = 1; def[t] = 1; });
    var sw = 0, sy = 0;
    ms.forEach(function (m) { sw += m.w * 2; sy += m.w * (m.hg + m.ag); });
    var mu = sw > 0 ? sy / sw : LBAR_PRIOR;
    if (!(mu > 0) || !isFinite(mu)) mu = LBAR_PRIOR;
    var gamma = HOME_ADV, it = 0, moved = 1;
    for (it = 0; it < DC_MAX_ITERS && moved > DC_TOL; it++) {
      moved = 0;
      // attack
      ids.forEach(function (t) {
        var numr = 0, den = 0;
        ms.forEach(function (m) {
          if (m.h === t) { numr += m.w * m.hg; den += m.w * mu * def[m.a] * gamma; }
          else if (m.a === t) { numr += m.w * m.ag; den += m.w * mu * def[m.h]; }
        });
        var v = den > 0 ? numr / den : att[t];
        v = clamp(isFinite(v) ? v : att[t], 0.05, 5);
        moved = Math.max(moved, Math.abs(v - att[t])); att[t] = v;
      });
      // defence (rates conceded)
      ids.forEach(function (t) {
        var numr = 0, den = 0;
        ms.forEach(function (m) {
          if (m.h === t) { numr += m.w * m.ag; den += m.w * mu * att[m.a]; }
          else if (m.a === t) { numr += m.w * m.hg; den += m.w * mu * att[m.h] * gamma; }
        });
        var v = den > 0 ? numr / den : def[t];
        v = clamp(isFinite(v) ? v : def[t], 0.05, 5);
        moved = Math.max(moved, Math.abs(v - def[t])); def[t] = v;
      });
      // home factor
      var gn = 0, gd = 0;
      ms.forEach(function (m) { gn += m.w * m.hg; gd += m.w * mu * att[m.h] * def[m.a]; });
      var g2 = gd > 0 ? gn / gd : gamma;
      g2 = clamp(isFinite(g2) ? g2 : gamma, 0.5, 2.5);
      moved = Math.max(moved, Math.abs(g2 - gamma)); gamma = g2;
      /* Identification. lam = mu * att_i * def_j * gamma has TWO scale redundancies: att against mu
         and def against mu. Normalising att alone leaves the defence scale free to drift, mu grows
         with it, and the moment a def value reaches its clamp the fitted rates stop meaning
         anything — which is exactly what the first version of this function did (it produced a mu
         of 3.35 and a home scoring rate of 3.7 goals). Both vectors are normalised to mean one and
         the whole level lives in mu, which is then the mean rate per team-match. */
      var sa = 0, sd = 0;
      ids.forEach(function (t) { sa += att[t]; sd += def[t]; });
      var ma = ids.length ? sa / ids.length : 1, md = ids.length ? sd / ids.length : 1;
      if (ma > 0 && isFinite(ma)) { ids.forEach(function (t) { att[t] = att[t] / ma; }); mu = mu * ma; }
      if (md > 0 && isFinite(md)) { ids.forEach(function (t) { def[t] = def[t] / md; }); mu = mu * md; }
      mu = clamp(mu, 0.05, 20);
    }
    /* The MLE's own first-order condition: the weighted sum of the fitted rates equals the weighted
       sum of the goals actually scored. A fit that misses this has not converged, whatever the
       iteration counter says, so the check is published rather than trusted. */
    var predSum = 0, obsSum = 0;
    ms.forEach(function (m) {
      predSum += m.w * (mu * att[m.h] * def[m.a] * gamma + mu * att[m.a] * def[m.h]);
      obsSum += m.w * (m.hg + m.ag);
    });
    res.fitCheck = { predicted: predSum, observed: obsSum, gap: obsSum > 0 ? Math.abs(predSum - obsSum) / obsSum : 0 };
    /* Shrinkage, and why it is here. A raw maximum-likelihood Dixon-Coles fit on five gameweeks
       gives every team at most five matches, so a side that has kept two clean sheets is fitted a
       defence at the clamp and a 93% clean-sheet probability. The incumbent TS shrinks towards the
       league with w = g/(g+TS_K), and leaving that out would make this comparison a test of
       "shrinkage or no shrinkage" wearing the label "tau and decay". So the SAME shrinkage is
       applied here, held constant across the models being compared, and opts.shrink === false
       returns the raw fit so the cost of leaving it out can be measured rather than argued about.
       fitCheck above is taken on the unshrunk fit: it is a test of the fit, not of the prior. */
    res.shrink = o.shrink !== false;
    res.shrinkK = TS_K;
    var gOf = {};
    ids.forEach(function (t) { gOf[t] = 0; });
    ms.forEach(function (m) { gOf[m.h] += m.w; gOf[m.a] += m.w; });
    res.games = gOf;
    if (res.shrink) ids.forEach(function (t) {
      var w = gOf[t] / (gOf[t] + TS_K);
      att[t] = clamp(w * att[t] + (1 - w), 0.05, 5);
      def[t] = clamp(w * def[t] + (1 - w), 0.05, 5);
    });
    res.iters = it; res.converged = moved <= DC_TOL;
    res.att = att; res.def = def; res.mu = mu; res.gamma = gamma;
    res.weightSum = sum(ms, function (m) { return m.w; });
    // rho: one-dimensional search inside the range in which every tau cell stays non-negative
    var lo = -1, hi = 1;
    ms.forEach(function (m) {
      var lh = mu * att[m.h] * def[m.a] * gamma, la = mu * att[m.a] * def[m.h];
      var rr = dcRhoRange(lh, la);
      if (rr.lo > lo) lo = rr.lo;
      if (rr.hi < hi) hi = rr.hi;
    });
    if (!(hi > lo)) { lo = -0.05; hi = 0.05; }
    res.rhoRange = { lo: lo, hi: hi };
    var tauLL = function (r) {
      var s = 0;
      ms.forEach(function (m) {
        if (res.basis === "xg") return;                     // xG is not a scoreline: no cell to correct
        var lh = mu * att[m.h] * def[m.a] * gamma, la = mu * att[m.a] * def[m.h];
        var t = dcTau(m.hg, m.ag, lh, la, r);
        s += m.w * Math.log(Math.max(1e-12, t));
      });
      return s;
    };
    var bestR = 0, bestL = -Infinity;
    for (var gi = 0; gi < DC_RHO_GRID; gi++) {
      var r = lo + (hi - lo) * gi / (DC_RHO_GRID - 1);
      var L = tauLL(r);
      if (L > bestL) { bestL = L; bestR = r; }
    }
    if (res.basis === "xg" && o.rho !== undefined && o.rho !== null) {
      bestR = clamp(num(o.rho, 0), lo, hi); bestL = tauLL(bestR);
    }
    res.rho = res.basis === "xg" && (o.rho === undefined || o.rho === null) ? 0 : bestR;
    res.rhoLogLik = isFinite(bestL) ? bestL : 0;
    // the weighted log-likelihood of the fitted model, tau included
    var ll = 0;
    ms.forEach(function (m) {
      var lh = mu * att[m.h] * def[m.a] * gamma, la = mu * att[m.a] * def[m.h];
      var base = -lh + m.hg * Math.log(Math.max(1e-12, lh)) - logGamma(m.hg + 1)
        - la + m.ag * Math.log(Math.max(1e-12, la)) - logGamma(m.ag + 1);
      ll += m.w * (base + Math.log(Math.max(1e-12, dcTau(m.hg, m.ag, lh, la, res.rho))));
    });
    res.loglik = isFinite(ll) ? ll : 0;
    res.ok = true;
    res.note = "Dixon-Coles on " + res.basis + ": " + ms.length + " matches, effective weight " + res.weightSum.toFixed(2) +
      " at a decay of " + res.xi + " per day (half-life " + (res.xi > 0 ? (Math.log(2) / res.xi).toFixed(0) : "infinite") +
      " days), home factor " + res.gamma.toFixed(3) + ", rho " + res.rho.toFixed(4) +
      " inside [" + res.rhoRange.lo.toFixed(3) + ", " + res.rhoRange.hi.toFixed(3) + "]" +
      ", mean rate " + res.mu.toFixed(3) + " per team-match (fitted total " + res.fitCheck.predicted.toFixed(2) +
      " against the observed " + res.fitCheck.observed.toFixed(2) + ", gap " + (res.fitCheck.gap * 100).toFixed(3) + "%)" +
      (res.basis === "xg" ? " (xG is not a scoreline, so the low-cell correction is applied at prediction time with a rho fitted on goals, never fitted on xG itself)" : "") +
      ", " + res.iters + " iterations" + (res.converged ? ", converged" : ", NOT converged") +
      (res.shrink ? ", attack and defence shrunk towards the league with w = g/(g+" + TS_K + ") as E2 does" : ", NO shrinkage (raw maximum likelihood)") + ".";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}
// The two scoring rates of one fixture under a fitted model.
function dcLambdas(t, o, home, M) {
  var res = { own: LBAR_PRIOR, opp: LBAR_PRIOR, lamH: LBAR_PRIOR, lamA: LBAR_PRIOR, side: home ? "h" : "a" };
  try {
    if (!isObj(M) || !isObj(M.att) || !isObj(M.def)) return res;
    var mu = Math.max(0.05, num(M.mu, LBAR_PRIOR)), g = Math.max(0.1, num(M.gamma, HOME_ADV));
    var at = clamp(num(M.att[t], 1), 0.05, 5), df = clamp(num(M.def[t], 1), 0.05, 5);
    var ao = clamp(num(M.att[o], 1), 0.05, 5), dfo = clamp(num(M.def[o], 1), 0.05, 5);
    var own = home ? mu * at * dfo * g : mu * at * dfo;
    var opp = home ? mu * ao * df : mu * ao * df * g;
    res.own = own; res.opp = opp;
    res.lamH = home ? own : opp; res.lamA = home ? opp : own;
  } catch (e) { /* total */ }
  return res;
}
function dcPcs(t, o, home, M) {
  var L = dcLambdas(t, o, home, M);
  return dcCleanSheetProb(L.lamH, L.lamA, isObj(M) ? num(M.rho, 0) : 0, home ? "h" : "a");
}

/* cleanSheetCalibration — the tau correction and the time decay, measured where they are supposed
 * to matter. Walk-forward: fit on the gameweeks strictly before g, predict "does this team concede
 * nothing in g" for both sides of every fixture in g, score with Brier and a reliability curve.
 *
 * Three predictors, so the two questions do not get confounded:
 *   lite      — the shipped tsPcs: exp(-xG conceded), on xG, no decay, no tau (the incumbent)
 *   dc_goals  — Dixon-Coles on goals, tau fitted, exponential decay
 *   dc_xg     — the same decay-weighted fit on xG with the goals-fitted rho applied at prediction
 * This is a team-level clean sheet (conceded nothing). A player also needs 60 minutes for the
 * points, which pStart and the Monte Carlo handle; the probability being scored here is the team's.
 */
function cleanSheetCalibration(live, opts) {
  var res = { ok: false, gws: [], n: 0, models: [], baseRate: 0, rho: null, xi: DC_DECAY_PER_DAY, note: "" };
  try {
    var o = isObj(opts) ? opts : {};
    if (!isObj(live) || !isObj(live.gw)) { res.note = "no finished gameweeks in the snapshot"; return res; }
    var xiD = Math.max(0, num(o.xi, DC_DECAY_PER_DAY));
    res.xi = xiD;
    var keys = Object.keys(live.gw).map(function (k) { return num(k, NaN); }).filter(isFinite).sort(sortNum);
    if (keys.length < 2) { res.note = "a walk-forward needs at least two finished gameweeks; this snapshot has " + keys.length; return res; }
    var defs = [
      { key: "lite", name: "TS lite (xG, shrunk, no tau, no decay)" },
      { key: "dc_goals", name: "Dixon-Coles on goals (tau + decay, shrunk)" },
      { key: "dc_xg", name: "Dixon-Coles on xG (tau from goals + decay, shrunk)" },
      { key: "dc_goals_raw", name: "Dixon-Coles on goals, no shrinkage" },
      { key: "dc_xg_raw", name: "Dixon-Coles on xG, no shrinkage" }
    ];
    var P = {}, Y = [], perGw = [];
    defs.forEach(function (d) { P[d.key] = []; });
    var lastRho = null;
    for (var i = 1; i < keys.length; i++) {
      var g = keys[i], cut = keys[i - 1];
      var cutLive = truncateLive(live, cut);
      var st = teamStrength(cutLive);
      var dcg = dixonColes(live, { basis: "goals", upto: cut, xi: xiD });
      var dcx = dixonColes(live, { basis: "xg", upto: cut, xi: xiD, rho: dcg.ok ? dcg.rho : 0 });
      var dcgR = dixonColes(live, { basis: "goals", upto: cut, xi: xiD, shrink: false });
      var dcxR = dixonColes(live, { basis: "xg", upto: cut, xi: xiD, rho: dcg.ok ? dcg.rho : 0, shrink: false });
      if (dcg.ok) lastRho = dcg.rho;
      var rowsGw = { gw: g, n: 0, rho: dcg.ok ? dcg.rho : null, matches: dcg.matches, byModel: {} };
      defs.forEach(function (d) { rowsGw.byModel[d.key] = { pred: [], y: [] }; });
      arr(live.fixtures).forEach(function (f) {
        if (!isObj(f) || intOf(f.event, -1) !== g || !f.finished) return;
        var hs = num(f.team_h_score, NaN), as = num(f.team_a_score, NaN);
        if (!isFinite(hs) || !isFinite(as)) return;
        [{ t: num(f.team_h, NaN), o: num(f.team_a, NaN), home: true, conceded: as },
         { t: num(f.team_a, NaN), o: num(f.team_h, NaN), home: false, conceded: hs }].forEach(function (side) {
          if (!isFinite(side.t) || !isFinite(side.o)) return;
          var y = side.conceded === 0 ? 1 : 0;
          var preds = {
            lite: tsPcs(side.t, side.o, side.home, st.TS),
            dc_goals: dcg.ok ? dcPcs(side.t, side.o, side.home, dcg) : null,
            dc_xg: dcx.ok ? dcPcs(side.t, side.o, side.home, dcx) : null,
            dc_goals_raw: dcgR.ok ? dcPcs(side.t, side.o, side.home, dcgR) : null,
            dc_xg_raw: dcxR.ok ? dcPcs(side.t, side.o, side.home, dcxR) : null
          };
          var missing = false;
          defs.forEach(function (d) { if (preds[d.key] === null || preds[d.key] === undefined) missing = true; });
          if (missing) return;
          defs.forEach(function (d) { P[d.key].push(preds[d.key]); rowsGw.byModel[d.key].pred.push(preds[d.key]); rowsGw.byModel[d.key].y.push(y); });
          Y.push(y); rowsGw.n++;
        });
      });
      if (rowsGw.n) {
        defs.forEach(function (d) { rowsGw.byModel[d.key].brier = brier(rowsGw.byModel[d.key].pred, rowsGw.byModel[d.key].y).brier; });
        perGw.push(rowsGw);
        res.gws.push(g);
      }
    }
    res.n = Y.length;
    res.rho = lastRho;
    var nb = clamp(intOf(o.bins, 5), 2, 20);
    res.models = defs.map(function (d) {
      var b = brier(P[d.key], Y), rel = reliability(P[d.key], Y, nb);
      return {
        key: d.key, name: d.name, n: b.n, brier: b.brier, skill: b.skill, baseRate: b.baseRate,
        maxGap: rel.maxGap, reliability: rel,
        perGw: perGw.map(function (r) { return { gw: r.gw, n: r.n, brier: num(r.byModel[d.key].brier, 0) }; })
      };
    });
    res.baseRate = res.models.length ? res.models[0].baseRate : 0;
    var ranked = res.models.slice().filter(function (m) { return m.n > 0; }).sort(function (a, b) { return a.brier - b.brier; });
    res.ok = res.n > 0;
    res.note = res.ok
      ? ("Clean-sheet calibration over " + res.n + " team-gameweeks in GW" + res.gws[0] + "-GW" + res.gws[res.gws.length - 1] +
         ", base rate " + (res.baseRate * 100).toFixed(1) + "%. Brier: " +
         res.models.map(function (m) { return m.key + " " + m.brier.toFixed(4); }).join(" · ") +
         ". Lowest is best, so " + (ranked.length ? ranked[0].key : "nothing") + " leads. " +
         "Fitted rho " + (res.rho === null ? "none" : res.rho.toFixed(4)) + " at a decay of " + xiD +
         " per day. This measurement drives nothing: it is the evidence a promotion would need, not a promotion.")
      : "no finished fixture with a score to calibrate against";
  } catch (e) { res.note = "engine error: " + errMsg(e); }
  return res;
}

// ---------------------------------------------------------------- probabilistic scoring (E5)

/* Spearman and MAE score a point estimate. They say nothing about whether the model knows how
 * uncertain it is, and an FPL decision is a decision under uncertainty: a captain with a mean of 6
 * and a fat tail is not the same bet as a captain with a mean of 6 and no tail.
 *
 * CRPS and the logarithmic score are proper scoring rules over the whole predicted distribution.
 * Both are reported per model, both in points-like units (lower is better), both computed
 * walk-forward. Each model's point prediction is turned into a distribution the same way, so the
 * comparison is of the models and not of three different distribution families:
 *   · the prediction is rescaled into points by a factor built ONLY from gameweeks <= k
 *     (mean of the players' own prior per-game points over the scored rows / mean prediction),
 *     which is stricter than the MAE calibration, which uses the scored gameweek's mean (E-047);
 *   · points are shifted to be non-negative and given a negative-binomial shape whose dispersion
 *     is moment-matched to the observed spread of points in the gameweeks BEFORE the one scored.
 *
 * THE GATE DOES NOT MOVE ON THIS. Promotion still runs on the Spearman winners, because changing
 * the metric a gate is decided on changes every past verdict at once, and player_xg is one
 * gameweek away from deciding its own gate on the metric it has been scored on all season. The
 * CRPS gate is computed and published beside it (`gateCrps`, `promotableCrps`) so the switch can be
 * made on evidence, in its own round, with its own before-and-after. A2 law 5.
 */
function logGamma(x) {
  var z = num(x, NaN);
  if (!isFinite(z) || z <= 0) return 0;
  // Lanczos, g=7, n=9
  var C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7];
  if (z < 0.5) {
    // reflection: Gamma(z)Gamma(1-z) = pi / sin(pi z)
    var s = Math.sin(Math.PI * z);
    if (!(Math.abs(s) > 1e-300)) return 0;
    return Math.log(Math.PI / Math.abs(s)) - logGamma(1 - z);
  }
  z -= 1;
  var a = C[0], t = z + 7.5;
  for (var i = 1; i < 9; i++) a += C[i] / (z + i);
  var v = 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
  return isFinite(v) ? v : 0;
}
// Moment matching for the shifted negative binomial: variance = m + m^2/r.
function nbDispersion(mean, variance, shift) {
  var m = num(mean, 0) - num(shift, 0), v = num(variance, NaN);
  if (!(m > 0) || !isFinite(v) || !(v > m)) return NB_MAX_R;                 // no over-dispersion: Poisson
  var r = m * m / (v - m);
  if (!isFinite(r) || r <= 0) return NB_MAX_R;
  return clamp(r, NB_MIN_R, NB_MAX_R);
}
/* The predictive distribution of one player's gameweek points: a negative binomial on points
 * shifted up by -PTS_DIST_MIN, truncated to [PTS_DIST_MIN, PTS_DIST_MAX] and renormalised. */
function pointsPmf(mean, dispersion, opts) {
  var res = { ok: false, min: PTS_DIST_MIN, max: PTS_DIST_MAX, pmf: [], cdf: [], mean: 0, r: NB_MAX_R, shift: -PTS_DIST_MIN, mass: 0 };
  try {
    var o = isObj(opts) ? opts : {};
    res.min = intOf(o.min, PTS_DIST_MIN); res.max = intOf(o.max, PTS_DIST_MAX);
    if (res.max <= res.min) { res.max = res.min + 1; }
    res.shift = -res.min;
    var r = clamp(num(dispersion, NB_MAX_R), NB_MIN_R, NB_MAX_R);
    if (!isFinite(r)) r = NB_MAX_R;
    res.r = r;
    var m = num(mean, 0) + res.shift;
    if (!isFinite(m)) m = res.shift;
    m = clamp(m, 1e-3, 1e4);
    res.mean = m - res.shift;
    var K = res.max - res.min;
    var lr = Math.log(r) - Math.log(r + m), lm = Math.log(m) - Math.log(r + m);
    var s = 0, i;
    for (i = 0; i <= K; i++) {
      var lp = logGamma(i + r) - logGamma(r) - logGamma(i + 1) + r * lr + i * lm;
      var p = Math.exp(lp);
      if (!isFinite(p) || p < 0) p = 0;
      res.pmf.push(p); s += p;
    }
    res.mass = s;
    if (!(s > 0)) { res.pmf = res.pmf.map(function () { return 1 / (K + 1); }); s = 1; }
    else for (i = 0; i <= K; i++) res.pmf[i] = res.pmf[i] / s;
    var c = 0;
    for (i = 0; i <= K; i++) { c += res.pmf[i]; res.cdf.push(clamp(c, 0, 1)); }
    res.cdf[K] = 1;
    res.ok = true;
  } catch (e) { /* total */ }
  return res;
}
// CRPS of a discrete distribution against an observation: sum over the support of (F(k) - 1{y<=k})^2.
// Non-negative by construction, zero only for a point mass on the observation.
function crpsDiscrete(dist, y) {
  try {
    if (!isObj(dist) || !Array.isArray(dist.cdf) || !dist.cdf.length) return 0;
    var obs = num(y, NaN); if (!isFinite(obs)) return 0;
    var s = 0;
    for (var i = 0; i < dist.cdf.length; i++) {
      var k = num(dist.min, PTS_DIST_MIN) + i;
      var ind = obs <= k ? 1 : 0;
      var d = num(dist.cdf[i], 0) - ind;
      s += d * d;
    }
    return isFinite(s) && s >= 0 ? s : 0;
  } catch (e) { return 0; }
}
// The logarithmic score: -log p(observed). Floored so a zero probability is a large finite penalty
// rather than an infinity that would make one row decide the whole column.
function logScoreDiscrete(dist, y) {
  try {
    if (!isObj(dist) || !Array.isArray(dist.pmf) || !dist.pmf.length) return -Math.log(LOG_SCORE_FLOOR);
    var obs = Math.round(num(y, NaN));
    if (!isFinite(obs)) return -Math.log(LOG_SCORE_FLOOR);
    var idx = clamp(obs - num(dist.min, PTS_DIST_MIN), 0, dist.pmf.length - 1);
    var p = num(dist.pmf[Math.round(idx)], 0);
    return -Math.log(Math.max(LOG_SCORE_FLOOR, p));
  } catch (e) { return -Math.log(LOG_SCORE_FLOOR); }
}

// ---------------------------------------------------------------- exports

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ENGINE_VERSION: ENGINE_VERSION, SCORING: SCORING, REFRESH_PAIRS: REFRESH_PAIRS, DECAY: DECAY, PRIOR_PPS: PRIOR_PPS, FORMATIONS: FORMATIONS, SQUAD_SHAPE: SQUAD_SHAPE, POS_NAME: POS_NAME, TOURNAMENT_MODELS: TOURNAMENT_MODELS,
    num: num, intOf: intOf, clamp: clamp, isObj: isObj, kindOf: kindOf, arr: arr, errMsg: errMsg, okCtx: okCtx, idOf: idOf, idList: idList, elMap: elMap, elType: elType, uniq: uniq, sum: sum, sortNum: sortNum, quantile: quantile, nowMs: nowMs, combos: combos,
    rowStat: rowStat, pointsFor: pointsFor, draftScoring: draftScoring, gwPoints: gwPoints,
    clubCounts: clubCounts, posCounts: posCounts, legal15: legal15, legalXI: legalXI, formationOf: formationOf,
    shrunkPps: shrunkPps, flagInfo: flagInfo, isFlagged: isFlagged, statsFor: statsFor, pStart: pStart, fxMult: fxMult, fxMultInfo: fxMultInfo, teamMults: teamMults, xp5FromMults: xp5FromMults, xp1With: xp1With, xp5With: xp5With, xp1: xp1, xp5: xp5,
    teamStrength: teamStrength, tsEntry: tsEntry, tsXg: tsXg, tsMult: tsMult, tsPcs: tsPcs, overUnderTags: overUnderTags, runAvg: runAvg,
    elementGwStats: elementGwStats, rivalPickShares: rivalPickShares, rivalOwn: rivalOwn, capShare: capShare, rivalOwnMax: rivalOwnMax, convergenceRisk: convergenceRisk, classify: classify,
    gamePhase: gamePhase, buildCtx: buildCtx,
    tierOf: tierOf, pickXI: pickXI, captainPick: captainPick, bestXI: bestXI, benchOrder: benchOrder, sellCandidates: sellCandidates, transferProtocol: transferProtocol,
    wcObjective: wcObjective, wcPool: wcPool, wcCost: wcCost, wcSetup: wcSetup, wcFeasible: wcFeasible, wcSolve: wcSolve, wcLocalOptimum: wcLocalOptimum,
    wildcardSolver: wildcardSolver, elName: elName, writtenFifteen: writtenFifteen, wildcardOptions: wildcardOptions, wildcardTiming: wildcardTiming, chipWindows: chipWindows, chipRegret: chipRegret,
    draftEl: draftEl, draftEV: draftEV, draftWaivers: draftWaivers, watchlistAudit: watchlistAudit, draftXIBase: draftXIBase, draftXI: draftXI,
    draftLeagueInput: draftLeagueInput, draftOwnership: draftOwnership, draftPool: draftPool, draftRosterOf: draftRosterOf, draftRivalRosters: draftRivalRosters,
    waiverOrder: waiverOrder, waiverSim: waiverSim, waiverOutcomeFor: waiverOutcomeFor, h2hOpponent: h2hOpponent, draftRoster: draftRoster, playerSpread: playerSpread,
    distStats: distStats, mcDraftXI: mcDraftXI, mcH2H: mcH2H, h2hProjection: h2hProjection,
    sanitiseState: sanitiseState, detectSquadChange: detectSquadChange, ftAvailable: ftAvailable, sellPrice: sellPrice, bankAfter: bankAfter,
    purchasePrices: purchasePrices, sellPrices: sellPrices,
    openClosers: openClosers, salvageJson: salvageJson, stripFences: stripFences, parseJson: parseJson, blocksOf: blocksOf, pickText: pickText, blockTypes: blockTypes, refreshRequest: refreshRequest, applyRefresh: applyRefresh,
    mulberry32: mulberry32, rngOf: rngOf, poisson: poisson, binomial: binomial, posRates: posRates, playerRates: playerRates, likelyXI: likelyXI, simFixture: simFixture, simPlayerDetail: simPlayerDetail, simPlayer: simPlayer, fixtureDraws: fixtureDraws, entryPoints: entryPoints, squadOrder: squadOrder, mcSquad: mcSquad, mcLeague: mcLeague,
    ranksOf: ranksOf, spearman: spearman, mae: mae, calibrateToPoints: calibrateToPoints, tournament: tournament,
    strengthFromCounts: strengthFromCounts, playerXgPredict: playerXgPredict,
    logistic: logistic, solveLinear: solveLinear, fitLogistic: fitLogistic, brier: brier, reliability: reliability, promotionGate: promotionGate,
    minutesTerms: minutesTerms, minutesPanel: minutesPanel, minutesFeatureVector: minutesFeatureVector, minutesRowsFor: minutesRowsFor,
    minutesFit: minutesFit, ctxMinutesFit: ctxMinutesFit, minutesModel: minutesModel, truncateLive: truncateLive, minutesWalkForward: minutesWalkForward,
    minutesPromotion: minutesPromotion, MINUTES_TAIL_LIMIT: MINUTES_TAIL_LIMIT, MINUTES_PRODUCTION_ROUTED: MINUTES_PRODUCTION_ROUTED,
    playerXg: playerXg, eventMult: eventMult, xpEvent: xpEvent, bestElevenForEvent: bestElevenForEvent, chipValue: chipValue, chipSolver: chipSolver,
    MAX_SWAPS: MAX_SWAPS, MAX_GREEDY_SWAPS: MAX_GREEDY_SWAPS,
    autosubResolve: autosubResolve, permutations: permutations, benchPlan: benchPlan, picksOf: picksOf, gwSims: gwSims,
    bestEntryOverElevens: bestEntryOverElevens, leakBacktest: leakBacktest, truncateElements: truncateElements,
    winnableLeagues: winnableLeagues, leagueField: leagueField, candidateSquads: candidateSquads,
    winProbabilityCore: winProbabilityCore, winProbability: winProbability, objectiveCompare: objectiveCompare,
    hierRowsFromAcc: hierRowsFromAcc, hierGroups: hierGroups, hierPosterior: hierPosterior, hierPool: hierPool,
    dcTau: dcTau, dcRhoRange: dcRhoRange, poissonPmf: poissonPmf, dcCleanSheetProb: dcCleanSheetProb,
    dcMatches: dcMatches, dixonColes: dixonColes, dcLambdas: dcLambdas, dcPcs: dcPcs,
    cleanSheetCalibration: cleanSheetCalibration,
    logGamma: logGamma, nbDispersion: nbDispersion, pointsPmf: pointsPmf, crpsDiscrete: crpsDiscrete, logScoreDiscrete: logScoreDiscrete,
    MINUTES_FEATURES: MINUTES_FEATURES, CHIP_SETS: CHIP_SETS, CHIP_NAMES: CHIP_NAMES, PROMOTION_HOLDOUT_WEEKS: PROMOTION_HOLDOUT_WEEKS,
    TOURNAMENT_PROMOTE_AT: TOURNAMENT_PROMOTE_AT, MC_MIN_GWS_FOR_PWIN: MC_MIN_GWS_FOR_PWIN,
    WINNABLE_MAX_SIZE: WINNABLE_MAX_SIZE, WINPROB_TOP_N: WINPROB_TOP_N, AUTOSUB_MAX_BLANKS: AUTOSUB_MAX_BLANKS,
    DC_DECAY_PER_DAY: DC_DECAY_PER_DAY, PTS_DIST_MIN: PTS_DIST_MIN, PTS_DIST_MAX: PTS_DIST_MAX, SHRINK_K: SHRINK_K
  };
}

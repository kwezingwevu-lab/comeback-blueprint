"""latest_wildcard.py — the first wildcard played as late as the rules allow, built from the proven "never" plan.

  python3 pipeline/latest_wildcard.py [--in data/solver_in.json] [--timing data/solver_timing.json]

What "as late as possible" is. Set one of the chips expires at the chip stop (GW19), so the latest week the first
wildcard can be played is the last week of the planning window. This script builds that plan and writes it to the timing
file as the key "latest". It takes the "never" plan (the best plan that plays no wildcard, proved to the same tolerance as
the other cases) unchanged up to the week before the last, and in the last week plays the wildcard: the fifteen is rebuilt
for that week alone with solve.one_week_best, the routine that prices a free hit, under the budget the held squad really
has (its selling values plus the bank), never re-buying anybody sold earlier in the window (the model's own no-rebuy rule).

Why it is built and not solved. The optimiser plans transfers week by week for the first eight weeks and holds the squad
after that, and a chip cannot be played in a held week, so solve.classic cannot place a wildcard in the last week at all.
Opening every week to it (detail = all fourteen) was tried on 2 Oct 2026: the full problem and its wildcard-free base each
ran 1800 s on an idle machine and stopped at 3.1% and 4.9% gaps with incumbents (888.2 and 904.0) below plans that were
already in hand, so it proves nothing. solve.classic is also the reference's, byte for byte, and is not touched. A plan
built from the proven "never" plan is a plan you could actually play, replayed against the rules by qa/plan_legality.cjs,
and its points are exact; it is a floor for the late-wildcard case, not a proved optimum, because planning the earlier
transfers around the final reshuffle might add a little. The comparison the app draws takes that into account: waiting
costs AT MOST the plan above minus this plan, plus the proof tolerance.

The wildcard week keeps the free-transfer count, spends nothing and adds nothing (Part N1). If the best fifteen for the
week is no better than the held one, the wildcard is played with the same fifteen: legal, and it says so.

It refuses, naming why, when the timing file was solved on other data, has no "never" plan, or the never plan already
plays a chip in the last week."""
import json, sys, os, solve

path = solve.ARGS.timing
if not os.path.exists(path):
    sys.exit("no timing file at %s — run chip_timing first" % path)
t = json.load(open(path))
if t.get("hash") != solve.IN.get("hash"):
    sys.exit("the timing file at %s was solved on other data (hash %s vs %s)" % (path, t.get("hash"), solve.IN.get("hash")))
nv = t.get("never")
if not (nv and nv.get("ok") and nv.get("weeks")):
    sys.exit("the timing file has no feasible 'never' plan to build from")

C = solve.IN["classic"]; P = solve.P
W = [g for g in solve.GWS if g <= solve.IN["cEnd"]]; T = len(W)
weeks = [dict(w) for w in nv["weeks"]]
if len(weeks) != T:
    sys.exit("the never plan has %d weeks and the window has %d" % (len(weeks), T))
last = weeks[-1]
if last.get("chip"):
    sys.exit("the never plan already plays %s in GW%d, so a wildcard cannot share the week" % (last["chip"], last["gw"]))
if not last.get("held"):
    sys.exit("the last week of the never plan is not a held week; nothing to rebuild")

own = set(C["squad"])
sellv = lambda i: C["sell"].get(str(i), P[i]["pr"]) if i in own else P[i]["pr"]
held_sq = list(last["squad"]); prev_sq = set(held_sq)
budget = round(sum(sellv(i) for i in held_sq) + last["bank"], 1)
sold = set()
for w in weeks[:-1]:
    sold.update(w["out"])
tl = T - 1
# nobody sold earlier in the window may be bought again: take them out of the one-week search by giving them a prohibitive
# expected score for this week only, and restore it after (the shared data is not changed on disk).
saved = {i: P[i]["ep"][tl] for i in sold if i in P}
for i in saved: P[i]["ep"][tl] = -99.0
try:
    best = solve.one_week_best(tl, budget)
finally:
    for i, v in saved.items(): P[i]["ep"][tl] = v
if best is None:
    sys.exit("no feasible fifteen for the last week under a budget of %.1f" % budget)

held_ep = last["ep"]
if best["ep"] <= held_ep + 1e-9:          # no better than keeping the squad: play the wildcard with the same fifteen
    sq = held_sq; xi = list(last["xi"]); cap = last["cap"]; ep = held_ep; same = True
else:
    sq = best["squad"]; xi = best["xi"]; cap = best["cap"]; ep = best["ep"]; same = False
bench = sorted([i for i in sq if i not in xi and P[i]["p"] != 1], key=lambda i: -P[i]["ep"][tl])
gk2 = [i for i in sq if i not in xi and P[i]["p"] == 1]
vice = sorted([i for i in xi if i != cap], key=lambda i: -P[i]["ep"][tl])[0]
ins = [i for i in sq if i not in prev_sq]; outs = [i for i in prev_sq if i not in sq]
bank = round(last["bank"] + sum(sellv(i) for i in outs) - sum(P[i]["pr"] for i in ins), 1)
if bank < -1e-9:
    sys.exit("internal error: the rebuilt fifteen overspends (bank %.1f)" % bank)
weeks[-1] = {"gw": last["gw"], "chip": "wildcard", "xi": xi, "bench": bench, "gk2": gk2[0] if gk2 else None, "cap": cap, "vice": vice, "in": ins, "out": outs,
             "ftBefore": last["ftBefore"], "used": 0, "hits": 0, "bank": bank, "ep": round(ep, 2), "epNet": round(ep, 2), "squad": list(sq), "held": False}
total = round(sum(w["epNet"] for w in weeks), 2)
res = {"ok": True, "constructed": True, "from": "never", "total": total, "weeks": weeks, "wcGw": last["gw"],
       "reshuffle": {"gw": last["gw"], "budget": budget, "heldEp": round(held_ep, 2), "newEp": round(ep, 2), "gain": round(ep - held_ep, 2),
                     "changes": len(ins), "sameFifteen": same, "excludedRebuys": len(saved)},
       "note": "the never plan to GW%d, then the wildcard in GW%d: %s" % (W[-2], last["gw"], "the same fifteen (nothing better under the budget)" if same else "%d changes for %+.2f points that week" % (len(ins), ep - held_ep))}
# read-modify-write, hash-checked again just before writing (another solve may have written the file in the meantime)
t = json.load(open(path))
if t.get("hash") != solve.IN.get("hash"):
    sys.exit("the timing file changed to other data while this ran")
t["latest"] = res
solve.dump(t, path)
print("latest wildcard GW%d: total %.2f (never %.2f, %+.2f) · %s · written to %s" % (last["gw"], total, nv["total"], total - nv["total"], res["note"], path), flush=True)

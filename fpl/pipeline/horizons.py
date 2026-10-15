"""horizons.py — the plan read three ways, and the best each way: the gameweek, the month and the season.

  python3 pipeline/horizons.py <season|month|gameweek> [TL] [--gap G] [--data data/mc_data.json] [--horizons data/solver_horizons.json]
                               TL defaults to 600 s, G to 0.005 (the main plan's own tolerance)

The manager's ask of 15 Oct 2026: maximise the gameweek, the monthly and the season points. Fantasy Premier League keeps
all three at once: the gameweek, the month (the game's own "phases" in bootstrap-static, which pipeline/bake.js carries
as gw.phases: October is gameweeks 6 to 9 this season, read from the feed and never typed) and the season. The plan of
record maximises one blend of them, expected points to gameweek 19 with each week worth 0.95 of the one before, so this
gameweek and this month already count for more than the far weeks. This script answers what that blend cannot say on
its own: how much more each horizon could have, and what chasing it would cost the others.

Each lens is solve.classic, byte for byte the reference's, on the same input, with every player's expected points scaled
in memory (never on disk) and restored afterwards:
  season    every week weighted 1 and no discount (decay 1.0): the most expected points to gameweek 19
  month     the weeks of the current month still to play weighted x4, every other week 1, no discount
  gameweek  the next gameweek weighted x4, every other week 1, no discount
The weights change what the optimiser prefers, never what a player is expected to score. Every figure written here is
re-scored on the unscaled expected points with classic()'s own arithmetic (the eleven, the armband doubled or tripled on
a Triple Captain week, the bench on a Bench Boost week, less four points a hit), so the three lenses and the plan of
record are measured in the same points. A month lens with x4 is "this month first", not "this month at any price":
the weeks after it still count, so it never wrecks the squad for the weeks it does not chase.

The file is guarded like the timing file: it carries the input hash, every write re-reads it and checks the hash again
(two lenses may solve side by side, each replacing only its own entry), and pipeline/plan.cjs folds it only when the
hash matches the data it ships. Nothing here is read by the app directly.
"""
import json, os, sys, solve

LENSES = ("season", "month", "gameweek")
K = 4.0          # the priority weight on the chased horizon's weeks

def arg(flag, default):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default

lens = next((a for a in sys.argv[1:] if a in LENSES), None)
if lens is None:
    sys.exit("usage: horizons.py <season|month|gameweek> [TL] [--gap G] [--data data/mc_data.json] [--horizons data/solver_horizons.json]")
gap = float(arg("--gap", "0.005"))
tl = next((int(a) for a in sys.argv[1:] if a.isdigit()), 600)
data_path = arg("--data", os.path.join(solve.REPO, "data", "mc_data.json"))
out_path = arg("--horizons", os.path.join(solve.REPO, "data", "solver_horizons.json"))

IN, P = solve.IN, solve.P
W = [g for g in solve.GWS if g <= IN["cEnd"]]; T = len(W)
DATA = json.load(open(data_path))
phases = [x for x in ((DATA.get("gw") or {}).get("phases") or []) if isinstance(x, dict) and isinstance(x.get("start"), int) and isinstance(x.get("stop"), int)]
cur = next((x for x in phases if x["start"] <= W[0] <= x["stop"]), None)
if cur is None:
    sys.exit("no FPL month in %s contains gameweek %d: re-bake with pipeline/bake.js, which carries gw.phases" % (data_path, W[0]))

if lens == "season": weights = [1.0] * T
elif lens == "month": weights = [K if cur["start"] <= g <= cur["stop"] else 1.0 for g in W]
else: weights = [K if t == 0 else 1.0 for t in range(T)]

saved = {i: P[i]["ep"] for i in P}
try:
    for i in P:
        P[i]["ep"] = [e * weights[t] if t < T else e for t, e in enumerate(saved[i])]
    r = solve.classic(decay=1.0, time_limit=tl, gap=gap)
finally:
    for i, v in saved.items(): P[i]["ep"] = v     # the shared input is never left scaled

def rescore(weeks):
    """classic()'s own weekly arithmetic, on the unscaled expected points."""
    out = []
    for t, w in enumerate(weeks):
        ep = lambda i: P[i]["ep"][t]
        bench = list(w["bench"]) + ([w["gk2"]] if w.get("gk2") is not None else [])
        pts = sum(ep(i) for i in w["xi"]) + ep(w["cap"]) * (2 if w["chip"] == "3xc" else 1) + (sum(ep(i) for i in bench) if w["chip"] == "bboost" else 0)
        out.append(dict(w, ep=round(pts, 2), epNet=round(pts - 4 * w["hits"], 2)))
    return out

def score(weeks):
    by = []
    for x in phases:
        s = [w["epNet"] for w in weeks if x["start"] <= w["gw"] <= x["stop"]]
        if s: by.append({"id": x["id"], "name": x["name"], "start": x["start"], "stop": x["stop"], "ep": round(sum(s), 2), "weeks": len(s)})
    month = next((b["ep"] for b in by if b["id"] == cur["id"]), 0.0)
    return {"gameweek": weeks[0]["epNet"], "month": month, "season": round(sum(w["epNet"] for w in weeks), 2), "byPhase": by}

res = {"ok": bool(r.get("ok")), "status": r.get("status"), "at": solve.stamp()}
if r.get("ok"):
    weeks = rescore(r["weeks"])
    res.update({"secs": r.get("secs"), "gap": r.get("gap"), "obj": r.get("obj"), "weeks": weeks, "score": score(weeks),
                "params": dict(r.get("params") or {}, lens=lens, weight=1.0 if lens == "season" else K, chased=[g for t, g in enumerate(W) if weights[t] != 1.0])})

# read-modify-write, hash-checked before writing: another lens may have written the file while this one solved
t = json.load(open(out_path)) if os.path.exists(out_path) else {}
if t.get("hash") != IN.get("hash"):
    t = {"hash": IN.get("hash"), "lenses": {}}
t["month"] = cur; t["at"] = solve.stamp(); t.setdefault("lenses", {})[lens] = res
solve.dump(t, out_path)
sc = res.get("score") or {}
print("%s: %s · %s s · gap %s · GW%d %.2f · %s (GW%d-%d) %.2f · to GW%d %.2f · written to %s" % (
    lens, res.get("status"), res.get("secs"), res.get("gap"), W[0], sc.get("gameweek", 0), cur["name"], cur["start"], cur["stop"],
    sc.get("month", 0), IN["cEnd"], sc.get("season", 0), out_path), flush=True)

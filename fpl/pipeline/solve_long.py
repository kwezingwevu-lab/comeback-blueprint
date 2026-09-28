"""solve_long.py — the main Classic plan again, with a longer time limit and nothing else running, so the proof tightens.
Writes the long-solve file (--long / $SOLVER_LONG / data/solver_long.json) with the input hash; pipeline/plan.cjs keeps
whichever identical solve reached the better objective (v110 §5 C2, C6).

  python3 pipeline/solve_long.py [TL] [--gap G] [--in data/solver_in.json] [--long data/solver_long.json]      TL defaults to 600 s, G to 0.01

Ported from the v111 kit on 27 Sep 2026; the model is solve.classic, byte for byte the reference's."""
import json, sys, solve
# --gap G tightens the proof (default 0.01, the kit's). A tighter gap needs a longer clock: 0.003 wants about 25 minutes.
gap = float(sys.argv[sys.argv.index("--gap") + 1]) if "--gap" in sys.argv else 0.01
r = solve.classic(time_limit=solve.ARGS.tl or 600, gap=gap)
solve.dump({"hash": solve.IN.get("hash"), "at": solve.stamp(), "plan": r}, solve.ARGS.long)
print("long plan", r.get("status"), r.get("secs"), "s · gap", r.get("gap"), "· total", r.get("total"), "· obj", r.get("obj"), "·", solve.ARGS.long, flush=True)

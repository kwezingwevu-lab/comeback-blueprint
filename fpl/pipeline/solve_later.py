"""solve_later.py — re-solve "wildcard later" with a longer limit and fold it into the timing file if it proves a better plan.
The same as `python3 pipeline/solve.py --later`; kept because the kit documents this file name (v110 §5 C4).

  python3 pipeline/solve_later.py [TL] [--in data/solver_in.json] [--timing data/solver_timing.json]      TL defaults to 540 s

Ported from the v111 kit on 27 Sep 2026; the model is solve.classic, byte for byte the reference's."""
import solve
solve.later(TL=solve.ARGS.tl or 540)

"""solve_scenario.py — re-solve ONE wildcard-timing scenario with a longer clock and a tighter proof, and fold it into
the timing file only if it reaches a better objective.

  python3 pipeline/solve_scenario.py <now|later|never> [TL] [--gap G] [--in data/solver_in.json] [--timing data/solver_timing.json]
                                     TL defaults to 900 s, G to 0.004

Why it exists. chip_timing() solves the three scenarios once each at 240 s. Those runs are time-limited, and a
time-limited solve loses ground when anything else is using the machine: on the 28 Sep refresh a "never" solve that
had proved optimal on 27 Sep at 892.26 came back at 883.78 with an 11% gap, because builds and suites were running
beside it (ERRORS.md E-129). Re-running the one scenario that came back weak, on an idle machine, is cheaper than
re-running all three, and it cannot make the file worse: the result replaces the stored scenario only when its
objective is higher, and only when the timing file was solved on the same input (the content hash), so two inputs are
never mixed.

Scenarios are the ones chip_timing() defines, read from solve.scenario_kwargs: "now" is the full problem (no chip before
GW13, the manager's rule, E-181), "later" holds the wildcard past the first open week, "never" removes the wildcard and
keeps GW19 free of any chip. A stored scenario solved on other params (a rule changed) is always replaced (solve.replaces).
The model is solve.classic: the reference's with the declared E-181 change, which plan_legality checks."""
import json, sys, os, solve

KEYS = ("now", "later", "never")
scenario = next((a for a in sys.argv[1:] if a in KEYS), None)
if scenario is None:
    sys.exit("usage: solve_scenario.py <now|later|never> [TL] [--gap G]")
gap = float(sys.argv[sys.argv.index("--gap") + 1]) if "--gap" in sys.argv else 0.004
tl = next((int(a) for a in sys.argv[1:] if a.isdigit()), 900)   # solve.ARGS.tl only reads a leading positional, and the scenario name comes first
path = solve.ARGS.timing
if not os.path.exists(path):
    sys.exit("no timing file at %s — run chip_timing first" % path)
t = json.load(open(path))
if t.get("hash") != solve.IN.get("hash"):
    sys.exit("the timing file at %s was solved on other data (hash %s vs %s)" % (path, t.get("hash"), solve.IN.get("hash")))

r = solve.classic(time_limit=tl, gap=gap, **solve.scenario_kwargs(scenario))
# Read-modify-write with the window as short as possible: two scenarios may be re-solved side by side, and each writes the
# whole file, so a copy read minutes ago would silently undo the other's result. The file is re-read here, checked again
# against the input hash, and only this scenario's entry is replaced.
t = json.load(open(path))
if t.get("hash") != solve.IN.get("hash"):
    sys.exit("the timing file at %s changed to other data while this solve ran (hash %s vs %s)" % (path, t.get("hash"), solve.IN.get("hash")))
have = (t.get(scenario) or {}).get("obj") or 0
took = solve.replaces(r, t.get(scenario))
if took:
    t[scenario] = {k: r[k] for k in solve.TIMING_KEYS if k in r}
    solve.dump(t, path)
print(scenario, r.get("status"), r.get("secs"), "s · gap", r.get("gap"), "· total", r.get("total"), "· obj", r.get("obj"),
      "· stored objective was", have, "·", "folded into " + path if took else "not better on the same params, the file is unchanged", flush=True)

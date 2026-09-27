"""Re-solve "wildcard later" with a longer limit and fold it into solver_timing.json if it proves a better plan."""
import json, time, solve
r = solve.classic(time_limit=540, gap=0.01, wc_from=1)
t = json.load(open("solver_timing.json"))
if r.get("ok") and (r.get("obj") or 0) > (t.get("later", {}).get("obj") or 0):
    t["later"] = {k: r[k] for k in ("ok", "status", "secs", "gap", "total", "obj", "weeks", "params") if k in r}; json.dump(t, open("solver_timing.json", "w"))
print("later", r.get("status"), r.get("secs"), "s · gap", r.get("gap"), "· total", r.get("total"), "· wc", next((w["gw"] for w in r.get("weeks", []) if w["chip"] == "wildcard"), None), flush=True)

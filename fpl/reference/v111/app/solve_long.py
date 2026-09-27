"""solve_long.py — the main Classic plan again, with a longer time limit and nothing else running, so the proof tightens.
Writes solver_long.json with the input hash; build.js keeps whichever identical solve reached the better objective."""
import json, time, solve
r = solve.classic(time_limit=int(__import__("sys").argv[1]) if len(__import__("sys").argv) > 1 else 600, gap=0.01)
json.dump({"hash": solve.IN.get("hash"), "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "plan": r}, open("solver_long.json", "w"))
print("long plan", r.get("status"), r.get("secs"), "s · gap", r.get("gap"), "· total", r.get("total"), "· obj", r.get("obj"), flush=True)

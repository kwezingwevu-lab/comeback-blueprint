"""solve.py — maximise expected points (v110 §5 C1–C6; ported from the v111 kit on 27 Sep 2026).

Classic: one integer programme over every gameweek from the next deadline to gameweek 19, when the first set of chips
expires. It chooses the squad, the eleven, the captain, every transfer (free or for a four-point hit), how many free
transfers to bank, and the weeks for the wildcard, bench boost and triple captain. Free hit value is priced separately
week by week, because it borrows a one-week squad and hands the old one back.

Draft: the best fifteen from your roster plus every claimable player, with the eleven re-picked every gameweek to the
re-draft. Run twice: once as the market stands, once assuming the manager who claims before you takes what the model
expects them to take.

THE MODELS ARE THE EXECUTABLE SPEC (§1.4). class Model, classic(), one_week_best() and draft() below are byte for byte
reference/v109/app/solve.py's, and qa/plan_legality.cjs proves that on every run. Only squad membership is integer:
given a whole-number squad, the eleven, the armband and the buy/sell flows form a totally unimodular system, so their
optimum comes out whole on its own and the proof closes; the all-binary version stalled at a 24.6% gap (§7.9, E-104).

WHAT THE PORT CHANGED: the paths and the entry points, nothing in the models.
  python3 pipeline/solve.py [TL] [sens] [--in data/solver_in.json] [--out data/solver_out.json]
      the main run: the plan, the no-wildcard plan, the free hit priced by week, the Draft roster, and the Draft roster
      if the manager ahead takes what the model expects. TL is the time limit in seconds (240). `sens` adds the
      undecayed sensitivity.
  python3 pipeline/solve.py --later [TL] [--in …] [--timing data/solver_timing.json]
      re-solve "wildcard later" with a longer limit (540) and fold it into the timing file if it proves a better plan.
  python3 -c "import solve; solve.chip_timing(TL=240)"        from pipeline/, as the kit documents it
      wildcard now, later and never, solved to a common tolerance and written to the timing file.
  pipeline/solve_long.py and pipeline/solve_later.py are the kit's two helpers on these same arguments.
Defaults come from the environment (SOLVER_IN, SOLVER_OUT, SOLVER_TIMING, SOLVER_LONG) and then from data/ beside this
folder, so `import solve` from any working directory finds the same files.

EVERY STAGE WRITES ITS OUTPUT AS SOON AS IT FINISHES (§7.2, E-103), so a partial run is still usable; start a full run
detached (setsid nohup … &) because a background job dies when the shell call that started it ends. The interface
never reads the solver's own free-transfer, hit or bank figures: pipeline/plan.cjs replays the ledger from the rules of
the game (§7.1, E-102) and the app reads the committed data/plan.json (C6).
"""
import argparse, json, os, sys, time
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds
from scipy.sparse import coo_matrix

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DEFAULTS = {
    "inp": os.environ.get("SOLVER_IN") or os.path.join(REPO, "data", "solver_in.json"),
    "out": os.environ.get("SOLVER_OUT") or os.path.join(REPO, "data", "solver_out.json"),
    "timing": os.environ.get("SOLVER_TIMING") or os.path.join(REPO, "data", "solver_timing.json"),
    "long": os.environ.get("SOLVER_LONG") or os.path.join(REPO, "data", "solver_long.json"),
}

def parse_args(argv):
    """The kit's positional arguments (a time limit in seconds, then the word sens) and the four paths. Unknown
    arguments are left alone, so `import solve` from another script never trips over that script's own flags."""
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("--in", dest="inp", default=DEFAULTS["inp"])
    ap.add_argument("--out", dest="out", default=DEFAULTS["out"])
    ap.add_argument("--timing", dest="timing", default=DEFAULTS["timing"])
    ap.add_argument("--long", dest="long", default=DEFAULTS["long"])
    ap.add_argument("--later", action="store_true")
    ap.add_argument("rest", nargs="*")
    a, _unknown = ap.parse_known_intermixed_args(argv)
    a.tl = int(a.rest[0]) if a.rest and a.rest[0].isdigit() else None
    a.sens = "sens" in a.rest
    return a

ARGS = parse_args(sys.argv[1:])

def stamp(): return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def dump(obj, path):
    """Write the whole file, then move it into place, so a reader never sees a half-written stage."""
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f: json.dump(obj, f)
    os.replace(tmp, path)

if not os.path.exists(ARGS.inp):
    sys.exit("solver input not found at %s — run the export stage first (node pipeline/export.js) or pass --in <file>" % ARGS.inp)
IN = json.load(open(ARGS.inp))
P = {p["id"]: p for p in IN["players"]}
GWS = IN["gws"]

# ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
# The models: byte for byte reference/v109/app/solve.py from here to the end of draft(). qa/plan_legality.cjs checks it.
# ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
class Model:
    def __init__(self):
        self.lb, self.ub, self.intg, self.obj = [], [], [], []
        self.r, self.c, self.v, self.lo, self.hi = [], [], [], [], []
        self.nrow = 0
    def var(self, lb=0.0, ub=1.0, integer=True, cost=0.0):
        self.lb.append(lb); self.ub.append(ub); self.intg.append(1 if integer else 0); self.obj.append(cost)
        return len(self.lb) - 1
    def add(self, terms, lo=-np.inf, hi=np.inf):
        for j, a in terms:
            if a != 0: self.r.append(self.nrow); self.c.append(j); self.v.append(a)
        self.lo.append(lo); self.hi.append(hi); self.nrow += 1
    def solve(self, time_limit=240, gap=0.004):
        A = coo_matrix((self.v, (self.r, self.c)), shape=(self.nrow, len(self.lb))).tocsr()
        t0 = time.time()
        res = milp(c=-np.array(self.obj), constraints=LinearConstraint(A, np.array(self.lo), np.array(self.hi)),
                   integrality=np.array(self.intg), bounds=Bounds(np.array(self.lb), np.array(self.ub)),
                   options={"time_limit": time_limit, "mip_rel_gap": gap, "disp": False})
        return res, time.time() - t0

POSN = {1: 2, 2: 5, 3: 5, 4: 3}
PLAY = {1: (1, 1), 2: (3, 5), 3: (2, 5), 4: (1, 3)}

def classic(decay=0.95, bench_w=0.10, gk_bench_w=0.03, tau=0.6, ft_value=1.5, allow=None, detail=8, no_rebuy=True, wc_from=0, time_limit=240, gap=0.005):
    """Transfers are planned week by week for the first `detail` gameweeks; after that the squad is held to gameweek 19,
    with the eleven, the armband and the bench boost and triple captain still chosen week by week. Banked free
    transfers at the end of the detailed window are valued at `ft_value` points each."""
    C = IN["classic"]; W = [g for g in GWS if g <= IN["cEnd"]]; T = len(W); TD = min(detail, T)
    allow = allow or {"wildcard": C["chips"]["wildcard"], "bboost": C["chips"]["bboost"], "3xc": C["chips"]["3xc"]}
    own = set(C["squad"]); hor = lambda p: sum(p["ep"][:T])
    cand = set(own)
    for pos, k in {1: 8, 2: 30, 3: 34, 4: 18}.items():
        ps = sorted([p for p in IN["players"] if p["p"] == pos], key=lambda p: -hor(p)); cand.update(p["id"] for p in ps[:k])
        cheap = sorted([p for p in ps if p["pr"] <= {1: 4.5, 2: 4.5, 3: 5.5, 4: 5.5}[pos] and p["start"] > 0.5], key=lambda p: -hor(p)); cand.update(p["id"] for p in cheap[:5])
    ids = sorted(cand); N = len(ids)
    sellp = {i: (C["sell"].get(str(i), P[i]["pr"]) if i in own else P[i]["pr"]) for i in ids}
    m = Model(); X, L, CP, BI, SO, TC, BB = {}, {}, {}, {}, {}, {}, {}
    wc, bb, tc, ft, used, pen, wct, hit, bank = {}, {}, {}, {}, {}, {}, {}, {}, {}
    for t in range(T):
        d = decay ** t; det = t < TD
        wc[t] = m.var(0, 1 if (allow.get("wildcard") and det and t >= wc_from) else 0); bb[t] = m.var(0, 1 if allow.get("bboost") else 0); tc[t] = m.var(0, 1 if allow.get("3xc") else 0)
        if det:
            ft[t] = m.var(C["ft"] if t == 0 else 0, C["ft"] if t == 0 else C["maxFt"])
            used[t] = m.var(0, C["maxFt"], cost=-d * tau); pen[t] = m.var(0, 15, cost=-d * (4 + tau))
            wct[t] = m.var(0, 15); hit[t] = m.var(0, 1); bank[t] = m.var(0, 200, integer=False)
        for i in ids:
            e = P[i]["ep"][t]; bw = gk_bench_w if P[i]["p"] == 1 else bench_w
            # only squad membership needs to be integer: given a whole-number squad, the eleven, the armband and the
            # buy/sell flows form a totally unimodular system, so their optimal values come out whole on their own.
            if det: X[i, t] = m.var(cost=d * e * bw); BI[i, t] = m.var(integer=False); SO[i, t] = m.var(integer=False)
            else: X[i, t] = X[i, TD - 1]; m.obj[X[i, t]] += d * e * bw
            L[i, t] = m.var(integer=False, cost=d * e * (1 - bw)); CP[i, t] = m.var(integer=False, cost=d * e)
            TC[i, t] = m.var(integer=False, cost=d * e); BB[i, t] = m.var(integer=False, cost=d * e * (1 - bw))
    ftend = m.var(0, C["maxFt"], cost=ft_value * decay ** (TD - 1))
    for t in range(T):
        det = t < TD
        for i in ids:
            if det:
                if t == 0: prev = 1 if i in own else 0; m.add([(X[i, 0], 1), (BI[i, 0], -1), (SO[i, 0], 1)], prev, prev)
                else: m.add([(X[i, t], 1), (X[i, t - 1], -1), (BI[i, t], -1), (SO[i, t], 1)], 0, 0)
                m.add([(BI[i, t], 1), (SO[i, t], 1)], hi=1)
            m.add([(L[i, t], 1), (X[i, t], -1)], hi=0); m.add([(CP[i, t], 1), (L[i, t], -1)], hi=0)
            m.add([(TC[i, t], 1), (CP[i, t], -1)], hi=0)
            m.add([(BB[i, t], 1), (X[i, t], -1), (L[i, t], 1)], hi=0); m.add([(BB[i, t], 1), (bb[t], -1)], hi=0)
        for pos, n in POSN.items():
            if det: m.add([(X[i, t], 1) for i in ids if P[i]["p"] == pos], n, n)
            lo, hi = PLAY[pos]; m.add([(L[i, t], 1) for i in ids if P[i]["p"] == pos], lo, hi)
        if det:
            for club in set(P[i]["t"] for i in ids): m.add([(X[i, t], 1) for i in ids if P[i]["t"] == club], hi=C["clubLimit"])
        m.add([(L[i, t], 1) for i in ids], 11, 11); m.add([(CP[i, t], 1) for i in ids], 1, 1)
        m.add([(TC[i, t], 1) for i in ids] + [(tc[t], -1)], hi=0)
        m.add([(wc[t], 1), (bb[t], 1), (tc[t], 1)], hi=1)
        if not det: continue
        m.add([(bank[t], 1)] + ([(bank[t - 1], -1)] if t else []) + [(SO[i, t], -sellp[i]) for i in ids] + [(BI[i, t], P[i]["pr"]) for i in ids], *((C["bank"], C["bank"]) if t == 0 else (0, 0)))
        m.add([(BI[i, t], 1) for i in ids] + [(used[t], -1), (pen[t], -1), (wct[t], -1)], 0, 0)
        m.add([(used[t], 1), (ft[t], -1)], hi=0); m.add([(wct[t], 1), (wc[t], -15)], hi=0)
        m.add([(used[t], 1), (wc[t], 5)], hi=5); m.add([(pen[t], 1), (wc[t], 15)], hi=15)
        m.add([(pen[t], 1), (hit[t], -15)], hi=0); m.add([(used[t], 1), (ft[t], -1), (hit[t], -5)], lo=-5)      # a hit only once every free transfer is spent
        nxt = ft[t + 1] if t + 1 < TD else ftend
        m.add([(nxt, 1), (ft[t], -1), (used[t], 1), (wc[t], -5)], hi=1)                                        # bank one more, less what was used
        m.add([(nxt, 1), (ft[t], -1), (wc[t], 5)], hi=5)                                                       # a wildcard week keeps the count as it was
    for ch in (wc, bb, tc): m.add([(v, 1) for v in ch.values()], hi=1)
    if no_rebuy:   # no selling a player only to buy him back later in the window: prices move, and the plan should be one you would actually follow
        for i in ids:
            for t1 in range(TD):
                for t2 in range(t1 + 1, TD): m.add([(SO[i, t1], 1), (BI[i, t2], 1)], hi=1)
    res, secs = m.solve(time_limit, gap)
    if res.x is None: return {"ok": False, "status": res.message}
    x = res.x; on = lambda j: x[j] > 0.5
    weeks = []; total = 0.0; ftn = C["ft"]; bankn = C["bank"]; prev = set(own)
    for t, g in enumerate(W):
        sq = [i for i in ids if on(X[i, t])]; xi = [i for i in sq if on(L[i, t])]; bench = sorted([i for i in sq if i not in xi and P[i]["p"] != 1], key=lambda i: -P[i]["ep"][t])
        gk2 = [i for i in sq if i not in xi and P[i]["p"] == 1]; cap = max(xi, key=lambda i: x[CP[i, t]])
        vice = sorted([i for i in xi if i != cap], key=lambda i: -P[i]["ep"][t])[0]
        chip = "wildcard" if on(wc[t]) else "bboost" if on(bb[t]) else "3xc" if on(tc[t]) else None
        ins = [i for i in sq if i not in prev]; outs = [i for i in prev if i not in sq]
        # the free-transfer ledger is replayed from the game's own rules, not read off the solver's upper bounds
        n = len(ins); hits = 0 if chip == "wildcard" else max(0, n - ftn); usedn = 0 if chip == "wildcard" else min(ftn, n)
        bankn = round(bankn + sum(sellp.get(i, P[i]["pr"]) for i in outs) - sum(P[i]["pr"] for i in ins), 1)
        pts = sum(P[i]["ep"][t] for i in xi) + P[cap]["ep"][t] * (2 if chip == "3xc" else 1) + (sum(P[i]["ep"][t] for i in bench + gk2) if chip == "bboost" else 0)
        total += pts - 4 * hits
        weeks.append({"gw": g, "chip": chip, "xi": xi, "bench": bench, "gk2": gk2[0] if gk2 else None, "cap": cap, "vice": vice, "in": ins, "out": outs,
                      "ftBefore": ftn, "used": usedn, "hits": hits, "bank": bankn, "ep": round(pts, 2), "epNet": round(pts - 4 * hits, 2), "squad": sq, "held": t >= TD})
        ftn = ftn if chip == "wildcard" else min(C["maxFt"], ftn - usedn + 1); prev = set(sq)
    gapv = getattr(res, "mip_gap", None)
    return {"ok": True, "status": res.message, "secs": round(secs, 1), "gap": gapv, "obj": round(-res.fun, 2), "total": round(total, 2), "ftEnd": ftn,
            "weeks": weeks, "n": N, "detail": TD, "params": {"decay": decay, "benchW": bench_w, "tau": tau, "ftValue": ft_value, "allow": allow, "noRebuy": no_rebuy, "wcFrom": wc_from}}

def one_week_best(t, budget, gap=0.002):
    """Best squad for a single gameweek under a budget: what a free hit could field that week."""
    hor = lambda p: p["ep"][t]
    cand = set()
    for pos, k in {1: 8, 2: 30, 3: 34, 4: 18}.items():
        ps = sorted([p for p in IN["players"] if p["p"] == pos], key=lambda p: -hor(p)); cand.update(p["id"] for p in ps[:k])
        cheap = sorted([p for p in ps if p["pr"] <= {1: 4.5, 2: 4.5, 3: 5.0, 4: 5.5}[pos]], key=lambda p: (p["pr"], -hor(p))); cand.update(p["id"] for p in cheap[:4])
    ids = sorted(cand); m = Model(); X, L, CP = {}, {}, {}
    for i in ids:
        e = P[i]["ep"][t]; X[i] = m.var(cost=0.03 * e); L[i] = m.var(cost=0.97 * e); CP[i] = m.var(cost=e)
        m.add([(L[i], 1), (X[i], -1)], hi=0); m.add([(CP[i], 1), (L[i], -1)], hi=0)
    for pos, n in POSN.items():
        m.add([(X[i], 1) for i in ids if P[i]["p"] == pos], n, n); lo, hi = PLAY[pos]; m.add([(L[i], 1) for i in ids if P[i]["p"] == pos], lo, hi)
    for club in set(P[i]["t"] for i in ids): m.add([(X[i], 1) for i in ids if P[i]["t"] == club], hi=IN["classic"]["clubLimit"])
    m.add([(L[i], 1) for i in ids], 11, 11); m.add([(CP[i], 1) for i in ids], 1, 1); m.add([(X[i], P[i]["pr"]) for i in ids], hi=budget)
    res, _ = m.solve(60, gap)
    if res.x is None: return None
    on = lambda j: res.x[j] > 0.5; xi = [i for i in ids if on(L[i])]; cap = [i for i in ids if on(CP[i])][0]
    return {"xi": xi, "squad": [i for i in ids if on(X[i])], "cap": cap, "ep": round(sum(P[i]["ep"][t] for i in xi) + P[cap]["ep"][t], 2)}

def draft(exclude=(), decay=0.95, change_cost=0.6, bench_w=0.04, time_limit=120):
    D = IN["draft"]; W = [g for g in GWS if g <= IN["dEnd"]]; T = len(W); roster = set(D["roster"]); hor = lambda p: sum(p["ep"][:T])
    pool = [i for i in D["pool"] if i not in set(exclude) and i in P]
    cand = set(roster)
    for pos, k in {1: 6, 2: 22, 3: 24, 4: 14}.items(): cand.update(sorted([i for i in pool if P[i]["p"] == pos], key=lambda i: -hor(P[i]))[:k])
    ids = sorted(cand); m = Model(); Rv, L = {}, {}
    for i in ids: Rv[i] = m.var(cost=0 if i in roster else -change_cost)
    for t in range(T):
        d = decay ** t
        for i in ids:
            e = P[i]["ep"][t]; L[i, t] = m.var(cost=d * e * (1 - bench_w)); m.obj[Rv[i]] += d * e * bench_w
            m.add([(L[i, t], 1), (Rv[i], -1)], hi=0)
        for pos in POSN: lo, hi = PLAY[pos]; m.add([(L[i, t], 1) for i in ids if P[i]["p"] == pos], lo, hi)
        m.add([(L[i, t], 1) for i in ids], 11, 11)
    for pos, n in POSN.items(): m.add([(Rv[i], 1) for i in ids if P[i]["p"] == pos], n, n)
    res, secs = m.solve(time_limit, 0.002)
    if res.x is None: return {"ok": False, "status": res.message}
    on = lambda j: res.x[j] > 0.5; new = [i for i in ids if on(Rv[i])]
    adds = [i for i in new if i not in roster]; drops = [i for i in roster if i not in new]
    pairs = []
    for pos in POSN:
        a = sorted([i for i in adds if P[i]["p"] == pos], key=lambda i: -hor(P[i])); dr = sorted([i for i in drops if P[i]["p"] == pos], key=lambda i: hor(P[i]))
        pairs += [{"add": x, "drop": y, "pos": pos} for x, y in zip(a, dr)]
    def best_total(sq):
        tot = 0.0
        for t in range(T):
            best = -1
            for dd in range(3, 6):
                for mm in range(2, 6):
                    ff = 10 - dd - mm
                    if ff < 1 or ff > 3: continue
                    by = lambda k, n: sorted([P[i]["ep"][t] for i in sq if P[i]["p"] == k], reverse=True)[:n]
                    s = sum(by(1, 1)) + sum(by(2, dd)) + sum(by(3, mm)) + sum(by(4, ff)); best = max(best, s)
            tot += best
        return tot
    return {"ok": True, "secs": round(secs, 1), "roster": new, "pairs": pairs, "value": round(best_total(new), 2), "base": round(best_total(list(roster)), 2), "weeks": W, "excluded": list(exclude)}

# ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
# Entry points. The paths are ARGS'; the stages and their order are the kit's.
# ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
TIMING_KEYS = ("ok", "status", "secs", "gap", "total", "obj", "weeks", "params")
SCENARIO_KEYS = ("ok", "status", "secs", "gap", "total", "obj", "weeks")

def no_wildcard_allow():
    return {"wildcard": False, "bboost": IN["classic"]["chips"]["bboost"], "3xc": IN["classic"]["chips"]["3xc"]}

def chip_timing(TL=420, gap=0.004, path=None):
    """Wildcard now, wildcard later (any week from gameweek 7), or not at all before gameweek 19: solved to the same tolerance.
    Written to `path` (default --timing / $SOLVER_TIMING / data/solver_timing.json) after every scenario."""
    path = path or ARGS.timing
    out = {}; save = lambda: dump(out, path)
    out["hash"] = IN.get("hash"); out["at"] = stamp()
    for key, kw in (("now", {}), ("later", {"wc_from": 1}), ("never", {"allow": no_wildcard_allow()})):
        r = classic(time_limit=TL, gap=gap, **kw); out[key] = {k: r[k] for k in TIMING_KEYS if k in r}; save()
        print(key, r.get("status"), r.get("secs"), "s · gap", r.get("gap"), "· total", r.get("total"), "· wc week", next((w["gw"] for w in r.get("weeks", []) if w["chip"] == "wildcard"), None), flush=True)
    out["done"] = True; save()
    return out

def later(TL=540, gap=0.01, path=None):
    """Re-solve "wildcard later" with a longer limit and fold it into the timing file if it proves a better plan.
    The timing file must exist and carry this input's hash: folding a fresh scenario into a stale file would mix two inputs."""
    path = path or ARGS.timing
    if not os.path.exists(path): sys.exit("no timing file at %s — run chip_timing first" % path)
    t = json.load(open(path))
    if t.get("hash") != IN.get("hash"): sys.exit("the timing file at %s was solved on other data (hash %s vs %s)" % (path, t.get("hash"), IN.get("hash")))
    r = classic(time_limit=TL, gap=gap, wc_from=1)
    if r.get("ok") and (r.get("obj") or 0) > (t.get("later", {}).get("obj") or 0):
        t["later"] = {k: r[k] for k in TIMING_KEYS if k in r}; dump(t, path); print("later: folded into", path, flush=True)
    print("later", r.get("status"), r.get("secs"), "s · gap", r.get("gap"), "· total", r.get("total"), "· wc", next((w["gw"] for w in r.get("weeks", []) if w["chip"] == "wildcard"), None), flush=True)
    return r

def main():
    if ARGS.later:
        later(TL=ARGS.tl or 540); return
    t0 = time.time(); out = {"at": stamp(), "hash": IN.get("hash")}
    save = lambda: dump(out, ARGS.out)     # written after every stage, so a partial run is still usable (§7.2)
    TL = ARGS.tl or 240
    plan = classic(time_limit=TL); out["plan"] = plan; save(); print("plan", plan.get("status"), plan.get("secs"), "s · gap", plan.get("gap"), "· total", plan.get("total"), flush=True)
    nowc = classic(allow=no_wildcard_allow(), time_limit=int(TL * 0.7))
    out["noWildcard"] = {k: nowc[k] for k in SCENARIO_KEYS if k in nowc}; save(); print("no-wildcard", nowc.get("secs"), "s · gap", nowc.get("gap"), "· total", nowc.get("total"), flush=True)
    fh = []
    if plan.get("ok") and IN["classic"]["chips"].get("freehit"):
        own0 = set(IN["classic"]["squad"])
        for t, w in enumerate(plan["weeks"]):
            sell_value = sum((IN["classic"]["sell"].get(str(i), P[i]["pr"]) if i in own0 else P[i]["pr"]) for i in w["squad"]) + w["bank"]
            best = one_week_best(t, round(sell_value, 1)); base = sum(P[i]["ep"][t] for i in w["xi"]) + P[w["cap"]]["ep"][t]
            if best: fh.append({"gw": w["gw"], "gain": round(best["ep"] - base, 2), "budget": round(sell_value, 1), "free": w["chip"] is None, **best})
    out["freeHit"] = fh; save(); print("free hit", [(f["gw"], f["gain"]) for f in fh], flush=True)
    dA = draft(); out["draft"] = dA; save(); print("draft", dA.get("secs"), "s · value", dA.get("value"), "base", dA.get("base"), [(P[q["add"]]["n"], P[q["drop"]]["n"]) for q in dA.get("pairs", [])], flush=True)
    dB = draft(exclude=IN["draft"]["aheadTakes"]); out["draftIfTaken"] = dB; save(); print("draft if taken", dB.get("value"), [(P[q["add"]]["n"], P[q["drop"]]["n"]) for q in dB.get("pairs", [])], flush=True)
    if ARGS.sens:
        flat = classic(decay=1.0, time_limit=int(TL * 0.6)); out["undecayed"] = {k: flat[k] for k in SCENARIO_KEYS if k in flat}; save(); print("undecayed", flat.get("total"), flush=True)
    out["done"] = True; save(); print("done in", round(time.time() - t0, 1), "s ·", ARGS.out, flush=True)

if __name__ == "__main__":
    main()

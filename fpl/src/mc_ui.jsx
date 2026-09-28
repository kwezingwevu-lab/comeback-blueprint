/* src/mc_ui.jsx — the interface for the ported engine (v110 §5 D). Scaffolded by the D0 integration on 27 Sep 2026;
 * D4 Odds and D5 Review built on it the same day.
 *
 * HOW IT SHIPS
 *   build.cjs appends this file verbatim after the src/ui.jsx body, between the two MC UI markers (CONTRACT §2;
 *   the marker text itself may not appear in this file, build.cjs counts it), so it shares that module's scope: React,
 *   Section, Reveal, KV, Row, Meter, Tier, openOf, PRIMARY, the time and number helpers (sastText, two, pc, grp), the
 *   repo engine (tsXg) and the colour tokens on .mc-root are all in scope. It carries no import of its own — an import
 *   after the first statement would break the ES module — and every component is a module-level function declaration,
 *   hoisted, so App can render it although it is defined after App (E-002: module level, props not closures).
 *
 * THE PROPS EVERY TAB HERE TAKES
 *   ctx  the context from src/engine.js buildCtx (the repo's engine, unchanged); ctx.state.market is the store of the
 *        manager's own prices
 *   ui   { mode, tab, open, reveals } — sections open through openOf(ui, tab, id), so first paint opens only PRIMARY
 *   on   { sec, rev, market } — the section and reveal toggles, and market(gw, team, xg) which stores an Odds override
 *        in state.market (xg null removes it); App validates it through sanitiseState with the engine's team list and
 *        applies state.market to E with setMarket before any child renders
 *   mc   { MC, PLAN, PRE, E } — the baked block, the solved plan, the build-time searches (pipeline/precompute.cjs)
 *        and E = MCEngine.create(MC), made once in App. PRE was computed at build time on the baked prices alone.
 *   Junk in any slot is refused with a TypeError, the contract qa/components.cjs pass C and qa/mc_full.cjs P03 hold
 *   every component to. A legal but empty world degrades in words: mc.MC absent → one sentence; mc.PRE absent → the
 *   tab computes what PRE would have carried, and qa/mc_render.cjs proves the two draw the same markup.
 *
 * RULES (fpl/CLAUDE.md Part N, v110 §1): every number is labelled Classic or Draft and the two are never added,
 * averaged, netted or compared; free transfers come from PLAN.replay, never the solver's own fields; every figure is
 * read from MC, PLAN, PRE, state or the engines at render time, never typed; colour only through the tokens; long
 * content behind a closed Section or a Reveal.
 */

/* The post-mortem's window and flag thresholds: src/mc_analysis.js MC_REVIEW_WEEKS and MC_REVIEW_FLAGS, restated here
   because that file does not ship in the app. qa/mc_render.cjs holds the two equal. closeLoss is a definition (a Draft
   loss by this many points or fewer is a close one), priceMax the largest decimal price read as typed. */
const MC_UI_CFG = { reviewWeeks: 5, flags: { captainGap: 6, classicBench: 8, draftBench: 10 }, closeLoss: 2, priceMax: 1000 };

/* How each match's goals were set, in the words the Odds tab uses (v110 §5 D4). */
const MC_SRC_LABEL = { odds: "bookmaker match prices", market: "bookmaker goal and clean-sheet prices", model: "the model", mine: "bookmaker match prices, added by you" };

const MC_ODDS_COLS = "64px minmax(0,1fr) auto";
const MC_RW_C_COLS = "40px minmax(0,1fr) 56px 72px";
const MC_RW_D_COLS = "40px minmax(0,1fr) 72px";
const MC_RW_L_COLS = "40px minmax(0,1fr) auto";

/* Why a component's props cannot be used, or "" when they can. Total — it never throws and always returns a string
   — so qa/mc_full.cjs can fuzz it like any other top-level function; the components throw the TypeError.
   opts.market: the tab writes prices, so on.market is required; opts.review: the post-mortem engine calls are. */
function mcPropsProblem(props, tab, opts) {
  const who = typeof tab === "string" && tab ? tab.slice(0, 40) : "component";
  try {
    const obj = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
    const need = obj(opts) ? opts : {};
    if (!obj(props)) return who + ": props must be an object";
    if (!obj(props.ctx)) return who + ": props.ctx must be the context object from buildCtx";
    if (!obj(props.ui)) return who + ": props.ui must be the { mode, tab, open, reveals } object";
    if (!obj(props.on) || typeof props.on.sec !== "function" || typeof props.on.rev !== "function") return who + ": props.on must carry the sec and rev toggles";
    if (need.market && typeof props.on.market !== "function") return who + ": props.on.market must store a price override";
    const mc = props.mc;
    if (!obj(mc)) return who + ": props.mc must be { MC, PLAN, PRE, E }";
    if (mc.MC === null || mc.MC === undefined) return "";
    if (!obj(mc.MC) || !obj(mc.MC.gw) || !Array.isArray(mc.MC.fixtures)) return who + ": props.mc.MC must be the baked block";
    const E = mc.E;
    if (!obj(E) || ["ep", "lambdas", "matchOdds", "devig", "fitRates", "setMarket"].some(function (k) { return typeof E[k] !== "function"; })) {
      return who + ": props.mc.E must be an engine from MCEngine.create";
    }
    if (need.review && (typeof E.classicReview !== "function" || typeof E.draftReview !== "function")) return who + ": props.mc.E must carry the post-mortems";
    if (mc.PRE !== null && mc.PRE !== undefined && !obj(mc.PRE)) return who + ": props.mc.PRE must be the precomputed block or absent";
    if (mc.PLAN !== null && mc.PLAN !== undefined && !obj(mc.PLAN)) return who + ": props.mc.PLAN must be the solved plan or absent";
    return "";
  } catch (e) {
    return who + ": props could not be read";
  }
}

/* ------------------------------------------------------------------ D4 · Odds: the numbers */

/* The two gameweeks the Odds tab prices: the one in play, else the next, and the one after it (the kit's vOdds). */
function mcOddsWeeks(MC) {
  try {
    const G = MC && MC.gw;
    if (!G || typeof G !== "object") return [];
    const next = Number(G.next), live = Number(G.live), done = Number(G.lastDone);
    if (!isFinite(next) || next !== Math.trunc(next) || next < 1 || next > 38) return [];
    const inPlay = isFinite(live) && isFinite(done) && live > done && live === Math.trunc(live) && live >= 1 && live <= 38 ? live : null;
    const first = inPlay || next, second = first !== next ? next : next + 1;
    return [first].concat(second <= 38 ? [second] : []);
  } catch (e) { return []; }
}

/* The manager's own prices, read from the context's sanitised state: { "<gw>": { "<TEAM>": { xg } } }. */
function mcMarketOf(ctx) {
  try {
    const m = ctx && ctx.state && ctx.state.market;
    return m && typeof m === "object" && !Array.isArray(m) ? m : {};
  } catch (e) { return {}; }
}

/* One gameweek's fixtures as the ported engine prices them, kick-off order: goals each side (lambdas), home / draw /
   away (matchOdds on the Poisson grid), clean-sheet chance each side and the source. A match either of whose sides
   carries a price of the manager's is named as his, whatever the engine's own tag. Total: [] on anything unusable. */
function mcOddsRows(E, MC, gw, market) {
  const out = [];
  try {
    const g = Number(gw);
    if (!E || typeof E.lambdas !== "function" || typeof E.matchOdds !== "function" || !MC || !Array.isArray(MC.fixtures)) return out;
    if (!isFinite(g) || g !== Math.trunc(g) || g < 1 || g > 38) return out;
    const book = market && typeof market === "object" ? market[String(g)] : null;
    const mine = book && typeof book === "object" && !Array.isArray(book) ? book : {};
    const has = function (t) { return Object.prototype.hasOwnProperty.call(mine, t); };
    MC.fixtures.filter(function (f) { return f && typeof f === "object" && Number(f.gw) === g && typeof f.h === "string" && typeof f.a === "string"; })
      .sort(function (a, b) { return String(a.ko || "").localeCompare(String(b.ko || "")) || Number(a.id) - Number(b.id); })
      .forEach(function (f) {
        const L = E.lambdas(f.h, { o: f.a, ha: "H" }, g);
        const lf = Number(L && L.lf), la = Number(L && L.la);
        if (!isFinite(lf) || !isFinite(la) || lf < 0 || la < 0) return;
        const o = E.matchOdds(lf, la);
        const src = has(f.h) || has(f.a) ? "mine" : L.src === "odds" ? "odds" : L.src === "market" ? "market" : "model";
        out.push({ id: Number(f.id), gw: g, h: f.h, a: f.a, ko: typeof f.ko === "string" ? f.ko : "", lf: lf, la: la,
          home: Number(o.h) || 0, draw: Number(o.d) || 0, away: Number(o.a) || 0, csH: Math.exp(-la), csA: Math.exp(-lf), src: src, label: MC_SRC_LABEL[src] });
      });
  } catch (e) { /* the rows priced before the fault stand */ }
  return out;
}

/* One sentence per gameweek: how many of its fixtures take their goals from which source. */
function mcSourceLine(rows, gw) {
  try {
    const list = Array.isArray(rows) ? rows : [];
    const g = Number(gw), span = isFinite(g) ? "GW" + g : "this gameweek";
    if (!list.length) return "No fixture is scheduled in " + span + " in the baked block.";
    const order = ["odds", "mine", "market", "model"], count = {};
    list.forEach(function (r) { const k = r && order.indexOf(r.src) >= 0 ? r.src : "model"; count[k] = (count[k] || 0) + 1; });
    const parts = order.filter(function (k) { return count[k] > 0; });
    if (parts.length === 1) return "All " + list.length + " fixtures in " + span + " take their goals from " + MC_SRC_LABEL[parts[0]] + ".";
    const bits = parts.map(function (k, i) { return count[k] + (i === 0 ? " take their goals from " : " from ") + MC_SRC_LABEL[k]; });
    return "Of the " + list.length + " fixtures in " + span + ", " + bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1] + ".";
  } catch (e) { return "The fixtures could not be counted."; }
}

/* The original engine's goals for one match (src/engine.js tsXg on ctx.TS: this season's expected goals, no bookmaker
   prices), kept beside the ported answer as §1.4 asks. Null when the context carries no team table. */
function mcRepoXg(ctx, h, a) {
  try {
    if (!ctx || typeof ctx !== "object" || !ctx.teams || typeof ctx.teams !== "object") return null;
    let hid = null, aid = null;
    Object.keys(ctx.teams).slice(0, 60).forEach(function (id) {
      const t = ctx.teams[id];
      if (t && t.short_name === h) hid = id;
      if (t && t.short_name === a) aid = id;
    });
    if (hid === null || aid === null) return null;
    const lf = tsXg(hid, aid, true, ctx.TS), la = tsXg(aid, hid, false, ctx.TS);
    return isFinite(lf) && isFinite(la) ? { lf: lf, la: la } : null;
  } catch (e) { return null; }
}

/* Three typed decimal prices → the margin removed in proportion and both sides' goals fitted on the Poisson grid, by
   the ported engine's own devig and fitRates (B2). A decimal comma reads as a point. Total: `why` names what is
   missing when `ok` is false — empty, incomplete, range, under (the three imply under 100%) or engine. */
function mcFairPrice(E, h, d, a) {
  const out = { ok: false, why: "empty", sum: 0, margin: 0, home: 0, draw: 0, away: 0, lh: 0, la: 0 };
  try {
    const raw = [h, d, a].map(function (s) { return typeof s === "string" || typeof s === "number" ? String(s).trim().replace(",", ".") : ""; });
    const filled = raw.filter(function (s) { return s !== ""; }).length;
    if (filled === 0) return out;
    if (filled < 3) { out.why = "incomplete"; return out; }
    const px = raw.map(function (s) { return s.length <= 12 && /^\d+(\.\d+)?$/.test(s) ? Number(s) : -1; });
    if (px.some(function (x) { return !(x > 1 && x <= MC_UI_CFG.priceMax); })) { out.why = "range"; return out; }
    out.sum = 1 / px[0] + 1 / px[1] + 1 / px[2];
    out.margin = out.sum - 1;
    if (out.margin < 0) { out.why = "under"; return out; }
    if (!E || typeof E.devig !== "function" || typeof E.fitRates !== "function") { out.why = "engine"; return out; }
    const fair = E.devig(px[0], px[1], px[2]), fit = E.fitRates(fair);
    const lh = Math.round(Number(fit && fit.lh) * 100) / 100, la = Math.round(Number(fit && fit.la) * 100) / 100;
    if (!isFinite(lh) || !isFinite(la)) { out.why = "engine"; return out; }
    out.home = fair.h; out.draw = fair.d; out.away = fair.a; out.lh = lh; out.la = la; out.ok = true; out.why = "";
    return out;
  } catch (e) { return { ok: false, why: "engine", sum: 0, margin: 0, home: 0, draw: 0, away: 0, lh: 0, la: 0 }; }
}

/* The store with one side of one fixture set (xg a number) or cleared (xg null), the shape App's on.market writes and
   sanitiseState keeps: { "<gw>": { "<TEAM>": { xg } } }. Pure and total; the map passed in is never touched. */
function mcMarketWith(market, gw, team, xg) {
  const out = {};
  try {
    const src = market && typeof market === "object" && !Array.isArray(market) ? market : {};
    Object.keys(src).slice(0, 100).forEach(function (g) {
      const row = src[g];
      if (g === "__proto__" || !row || typeof row !== "object" || Array.isArray(row)) return;
      const copy = {};
      Object.keys(row).slice(0, 100).forEach(function (t) { const x = Number(row[t] && row[t].xg); if (t !== "__proto__" && isFinite(x)) copy[t] = { xg: x }; });
      if (Object.keys(copy).length) out[g] = copy;
    });
    const n = Number(gw), t = typeof team === "string" ? team : "";
    if (!isFinite(n) || n !== Math.trunc(n) || !t || t === "__proto__") return out;
    const g = String(n);
    if (xg === null || xg === undefined) {
      if (out[g]) { delete out[g][t]; if (!Object.keys(out[g]).length) delete out[g]; }
      return out;
    }
    const x = Number(xg);
    if (!isFinite(x)) return out;
    out[g] = out[g] || {};
    out[g][t] = { xg: x };
    return out;
  } catch (e) { return out; }
}

/* The manager's prices grouped by match for the list: one line per fixture both of whose sides he priced, one per side
   left on its own. Gameweek order, then kick-off. Total. */
function mcMarketGroups(market, fixtures) {
  const out = [];
  try {
    const m = market && typeof market === "object" && !Array.isArray(market) ? market : {};
    const fx = Array.isArray(fixtures) ? fixtures : [];
    Object.keys(m).filter(function (g) { return isFinite(Number(g)); }).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (g) {
      const row = m[g] && typeof m[g] === "object" ? m[g] : {};
      const left = Object.keys(row).filter(function (t) { return isFinite(Number(row[t] && row[t].xg)); });
      fx.filter(function (f) { return f && Number(f.gw) === Number(g); })
        .sort(function (a, b) { return String(a.ko || "").localeCompare(String(b.ko || "")); })
        .forEach(function (f) {
          const sides = [f.h, f.a].filter(function (t) { return left.indexOf(t) >= 0; });
          if (!sides.length) return;
          sides.forEach(function (t) { left.splice(left.indexOf(t), 1); });
          out.push({ gw: Number(g), id: Number(f.id), title: f.h + " v " + f.a, teams: sides,
            xg: sides.map(function (t) { return t + " " + Number(row[t].xg).toFixed(2); }).join(", ") });
        });
      left.forEach(function (t) { out.push({ gw: Number(g), id: -1, title: t, teams: [t], xg: t + " " + Number(row[t].xg).toFixed(2) }); });
    });
  } catch (e) { /* the groups found before the fault stand */ }
  return out;
}

/* ------------------------------------------------------------------ D4 · Odds: the tab */

/* D4 · Odds. The next two gameweeks' match prices, each match with its SAST kick-off, both sides' goals, home / draw /
   away, both clean-sheet chances and the source of its goals named; the original engine's numbers behind a Reveal
   per gameweek (§1.4); then the entry form that removes a bookmaker's margin and stores the result as an override. */
function TabOdds(props) {
  const why = mcPropsProblem(props, "TabOdds", { market: true });
  if (why) throw new TypeError(why);
  const ctx = props.ctx, ui = props.ui, on = props.on, mc = props.mc;
  const sec = function (id) { return openOf(ui, "odds", id); };
  const rev = ui.reveals && typeof ui.reveals === "object" ? ui.reveals : {};
  if (!mc.MC) {
    return (
      <div>
        <Section id="od-next" title="Match prices" open={sec("od-next")} onToggle={on.sec}>
          <p className="dim">The baked data block is missing from this build, so no match can be priced.</p>
        </Section>
      </div>
    );
  }
  const MC = mc.MC, E = mc.E, market = mcMarketOf(ctx);
  const weeks = mcOddsWeeks(MC);
  const blocks = [0, 1].map(function (i) { const gw = weeks[i]; return { gw: gw, rows: gw ? mcOddsRows(E, MC, gw, market) : [] }; });
  const groups = mcMarketGroups(market, MC.fixtures);
  const formFx = blocks[0].rows.concat(blocks[1].rows).map(function (r) { return { id: r.id, gw: r.gw, h: r.h, a: r.a, ko: r.ko }; });
  const model = function (b) {
    return [<div key="how">The original engine rates each side from this season's expected goals alone, with no bookmaker prices. For the same matches:</div>]
      .concat(b.rows.map(function (r) {
        const x = mcRepoXg(ctx, r.h, r.a);
        return <div key={r.id}>{r.h + " v " + r.a + ": " + (x ? two(x.lf) + "–" + two(x.la) : "no team table in this snapshot")}</div>;
      }));
  };
  const week = function (b, i) {
    if (!b.gw) return <p className="dim">{i === 0 ? "No gameweek is left to price in the baked block." : "No gameweek follows the one above."}</p>;
    return (
      <div>
        <p className="dim" data-testid="od-lede">{mcSourceLine(b.rows, b.gw) + (i === 0 ? " These goals drive every player projection, in both games." : "")}</p>
        {b.rows.length ? (
          <div>
            <Row head cols={MC_ODDS_COLS}><span>SAST</span><span>Match</span><span className="rt">Expected goals</span></Row>
            {b.rows.map(function (r) {
              return (
                <Row key={r.id} cols={MC_ODDS_COLS}>
                  <span className="dim" data-testid="od-ko" data-fx={String(r.id)} style={{ whiteSpace: "nowrap" }}>{sastText(r.ko) || "to be set"}</span>
                  <span className="nm" data-testid="od-fx" data-fx={String(r.id)} data-gw={String(r.gw)} data-src={r.src}>{r.h + " v " + r.a}</span>
                  <span className="rt" data-testid="od-xg" data-fx={String(r.id)} style={{ whiteSpace: "nowrap" }}>{two(r.lf) + "–" + two(r.la)}</span>
                  <span className="mini">
                    <span>{"Home " + pc(r.home)}</span><span>{"Draw " + pc(r.draw)}</span><span>{"Away " + pc(r.away)}</span>
                    <span>{"Clean sheet " + r.h + " " + pc(r.csH) + ", " + r.a + " " + pc(r.csA)}</span>
                    <span className={r.src === "mine" ? "warnt" : undefined} data-testid="od-src" data-fx={String(r.id)}>{r.label}</span>
                  </span>
                </Row>
              );
            })}
          </div>
        ) : null}
        {i === 0
          ? <Reveal id="od-model-next" label="The original engine's numbers" open={!!rev["od-model-next"]} onToggle={on.rev}>{model(b)}</Reveal>
          : <Reveal id="od-model-later" label="The original engine's numbers" open={!!rev["od-model-later"]} onToggle={on.rev}>{model(b)}</Reveal>}
      </div>
    );
  };
  return (
    <div>
      <Section id="od-next" title={blocks[0].gw ? "GW" + blocks[0].gw + " match prices" : "Match prices"} open={sec("od-next")} onToggle={on.sec}>
        {groups.length ? (
          <div className="note note-w" data-testid="od-active">
            {groups.length + (groups.length === 1 ? " price of yours is active" : " prices of yours are active") +
              " (Add a bookmaker price, below). The solved Classic plan is hidden while any is, because it was solved on the built-in prices."}
          </div>
        ) : null}
        {week(blocks[0], 0)}
      </Section>
      <Section id="od-later" title={blocks[1].gw ? "GW" + blocks[1].gw + " match prices" : "The gameweek after"} open={sec("od-later")} onToggle={on.sec}>
        {week(blocks[1], 1)}
      </Section>
      <Section id="od-add" title="Add a bookmaker price" open={sec("od-add")} onToggle={on.sec}>
        <p className="dim">A price you add replaces the built-in goals for both sides of that match, in every projection, until you remove it.</p>
        <OddsForm fixtures={formFx} E={E} market={market} on={on} />
        <OddsOverrides market={market} fixtures={MC.fixtures} E={E} on={on} />
      </Section>
    </div>
  );
}

/* The entry form: a fixture and the three decimal prices, held in the form's own state (it does not survive a reload,
   the stored override does). The working and the apply button are OddsCalc's. */
function OddsForm(props) {
  if (!props || typeof props !== "object" || Array.isArray(props)) throw new TypeError("OddsForm: props must be an object");
  if (!Array.isArray(props.fixtures)) throw new TypeError("OddsForm: props.fixtures must be the fixtures offered");
  if (!props.E || typeof props.E !== "object" || typeof props.E.devig !== "function" || typeof props.E.fitRates !== "function") throw new TypeError("OddsForm: props.E must be an engine from MCEngine.create");
  if (!props.on || typeof props.on !== "object" || typeof props.on.market !== "function") throw new TypeError("OddsForm: props.on.market must store a price override");
  if (props.market !== null && props.market !== undefined && (typeof props.market !== "object" || Array.isArray(props.market))) throw new TypeError("OddsForm: props.market must be the price store");
  const fixtures = props.fixtures.filter(function (f) { return f && typeof f === "object" && typeof f.h === "string" && typeof f.a === "string" && isFinite(Number(f.gw)); });
  const [fxId, setFxId] = React.useState("");
  const [ph, setPh] = React.useState("");
  const [pd, setPd] = React.useState("");
  const [pa, setPa] = React.useState("");
  if (!fixtures.length) return <p className="dim">No fixture is open to price.</p>;
  const sel = fixtures.filter(function (f) { return String(f.id) === fxId; })[0] || fixtures[0];
  const clear = function () { setPh(""); setPd(""); setPa(""); };
  const field = function (id, label, value, set) {
    return (
      <label className="dim" style={{ display: "grid", gap: "4px" }}>
        <span>{label}</span>
        <input className="inp" data-testid={id} type="text" inputMode="decimal" autoComplete="off" value={value}
          aria-label={label + " price, " + sel.h + " v " + sel.a} onChange={function (e) { set(e.target.value); }} />
      </label>
    );
  };
  return (
    <div>
      <select className="inp" data-testid="od-fixture" value={String(sel.id)} aria-label="Match to price"
        onChange={function (e) { setFxId(e.target.value); }}>
        {fixtures.map(function (f) {
          return <option key={f.id} value={String(f.id)}>{"GW" + f.gw + " " + f.h + " v " + f.a + (sastText(f.ko) ? ", " + sastText(f.ko) : "")}</option>;
        })}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px", marginTop: "9px" }}>
        {field("od-home", "Home", ph, setPh)}
        {field("od-draw", "Draw", pd, setPd)}
        {field("od-away", "Away", pa, setPa)}
      </div>
      <OddsCalc fixture={sel} prices={{ h: ph, d: pd, a: pa }} E={props.E} market={props.market || {}} on={props.on} onDone={clear} />
    </div>
  );
}

/* The working for three typed prices and the button that stores them. Hookless, so qa/mc_render.cjs drives its own
   onClick: both sides go to on.market (App sanitises and persists them in state.market), and E.setMarket is called
   with the same map at once, as App's memo does before the next render. */
function OddsCalc(props) {
  if (!props || typeof props !== "object" || Array.isArray(props)) throw new TypeError("OddsCalc: props must be an object");
  const f = props.fixture;
  if (!f || typeof f !== "object" || typeof f.h !== "string" || typeof f.a !== "string" || !isFinite(Number(f.gw))) throw new TypeError("OddsCalc: props.fixture must be { gw, h, a }");
  if (!props.prices || typeof props.prices !== "object" || Array.isArray(props.prices)) throw new TypeError("OddsCalc: props.prices must be { h, d, a }");
  const E = props.E;
  if (!E || typeof E !== "object" || ["devig", "fitRates", "lambdas", "setMarket"].some(function (k) { return typeof E[k] !== "function"; })) throw new TypeError("OddsCalc: props.E must be an engine from MCEngine.create");
  if (!props.on || typeof props.on !== "object" || typeof props.on.market !== "function") throw new TypeError("OddsCalc: props.on.market must store a price override");
  if (props.market !== null && props.market !== undefined && (typeof props.market !== "object" || Array.isArray(props.market))) throw new TypeError("OddsCalc: props.market must be the price store");
  if (props.onDone !== null && props.onDone !== undefined && typeof props.onDone !== "function") throw new TypeError("OddsCalc: props.onDone must be a function or absent");
  const gw = Number(f.gw);
  const r = mcFairPrice(E, props.prices.h, props.prices.d, props.prices.a);
  if (!r.ok) {
    const say = r.why === "incomplete" ? "Three prices are needed: home, draw and away."
      : r.why === "range" ? "Each price is a decimal above 1, the way a bookmaker shows it."
        : r.why === "under" ? "These three prices imply " + (r.sum * 100).toFixed(1) + "% in total, under 100%, so they are not one bookmaker's market. Check them."
          : r.why === "engine" ? "The engine could not fit goals to these prices."
            : "Type the home, draw and away prices as decimals, the way a bookmaker shows them. The margin comes out in proportion and both sides' goals are fitted to the three chances.";
    return <div className={r.why && r.why !== "empty" ? "note note-w" : "dim"} data-testid="od-calc">{say}</div>;
  }
  let now = "";
  try { const L = E.lambdas(f.h, { o: f.a, ha: "H" }, gw); now = " Now " + two(L.lf) + "–" + two(L.la) + ", from " + (MC_SRC_LABEL[L.src] || MC_SRC_LABEL.model) + "."; } catch (e) { now = ""; }
  const apply = function () {
    props.on.market(gw, f.h, r.lh);
    props.on.market(gw, f.a, r.la);
    try { E.setMarket(mcMarketWith(mcMarketWith(props.market, gw, f.h, r.lh), gw, f.a, r.la)); } catch (e) { /* App applies state.market on the next render */ }
    if (typeof props.onDone === "function") props.onDone();
  };
  return (
    <div>
      <div className="note" data-testid="od-calc">
        {"Margin removed: " + (r.margin * 100).toFixed(1) + "%. Fair chances: home " + pc(r.home) + ", draw " + pc(r.draw) + ", away " + pc(r.away) +
          ". That implies " + f.h + " " + r.lh.toFixed(2) + " goals and " + f.a + " " + r.la.toFixed(2) + ", clean sheets " + pc(Math.exp(-r.la)) + " and " + pc(Math.exp(-r.lh)) + "." + now}
      </div>
      <button className="btn btn-go" data-testid="od-apply" onClick={apply}>{"Use these for " + f.h + " v " + f.a}</button>
    </div>
  );
}

/* The manager's active prices, one line per match, each with a remove control that clears both sides through on.market
   and resets the engine at once. Hookless for the same reason as OddsCalc. */
function OddsOverrides(props) {
  if (!props || typeof props !== "object" || Array.isArray(props)) throw new TypeError("OddsOverrides: props must be an object");
  if (props.market !== null && props.market !== undefined && (typeof props.market !== "object" || Array.isArray(props.market))) throw new TypeError("OddsOverrides: props.market must be the price store");
  if (!Array.isArray(props.fixtures)) throw new TypeError("OddsOverrides: props.fixtures must be the baked fixtures");
  if (!props.E || typeof props.E !== "object" || typeof props.E.setMarket !== "function") throw new TypeError("OddsOverrides: props.E must be an engine from MCEngine.create");
  if (!props.on || typeof props.on !== "object" || typeof props.on.market !== "function") throw new TypeError("OddsOverrides: props.on.market must clear a price override");
  const market = props.market || {}, E = props.E, on = props.on;
  const groups = mcMarketGroups(market, props.fixtures);
  if (!groups.length) return <div className="dim" data-testid="od-overrides">No price of yours is active: every match takes the built-in goals.</div>;
  return (
    <div data-testid="od-overrides">
      <div className="panel-k">Your prices</div>
      {groups.map(function (g) {
        const remove = function () {
          g.teams.forEach(function (t) { on.market(g.gw, t, null); });
          try { E.setMarket(g.teams.reduce(function (m, t) { return mcMarketWith(m, g.gw, t, null); }, market)); } catch (e) { /* App applies state.market on the next render */ }
        };
        return (
          <Row key={g.gw + "-" + g.id + "-" + g.title} cols="minmax(0,1fr) auto">
            <span className="nm">{"GW" + g.gw + " " + g.title + ": " + g.xg}</span>
            <button className="btn-sm" data-testid="od-remove" aria-label={"Remove your price for GW" + g.gw + " " + g.title} onClick={remove}>Remove</button>
          </Row>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ D5 · Review: the numbers */

/* The five-week post-mortem per game, exactly as pipeline/precompute.cjs writes PRE.review through src/mc_analysis.js
   reviewSummary (B9) — used when PRE carries none. Bench scored is what the bench scored; avoidable is the part a better
   legal eleven would have played (docs/GAP_v110.md B9). Total: null when the engine or the block cannot answer. */
function mcReviewOf(E, MC) {
  try {
    if (!E || typeof E.classicReview !== "function" || typeof E.draftReview !== "function" || !MC || typeof MC !== "object") return null;
    const n = MC_UI_CFG.reviewWeeks, F = MC_UI_CFG.flags;
    const sum = function (list, f) { return list.reduce(function (s, g) { return s + f(g); }, 0); };
    const rows = E.classicReview(n);
    if (!Array.isArray(rows)) return null;
    const benchScored = sum(rows, function (g) { return g.bench || 0; }), avoidable = sum(rows, function (g) { return g.leftOnBench; });
    const captainGap = sum(rows, function (g) { return g.capGap; }), vsAverage = sum(rows, function (g) { return g.pts - g.avg; });
    const captainBest = rows.filter(function (g) { return g.capGap === 0; }).length, noTransfers = rows.every(function (g) { return !g.tx; });
    const classic = { game: "classic", weeks: rows.length, rows: rows, benchScored: benchScored, avoidable: avoidable, captainGap: captainGap, captainBest: captainBest,
      vsAverage: vsAverage, noTransfers: noTransfers,
      flags: { captain: captainGap > F.captainGap, bench: avoidable > F.classicBench, noTransfers: noTransfers } };
    const drows = E.draftReview(n), P = E.P || {};
    if (!Array.isArray(drows)) return null;
    const gws = MC.draft.myGws.filter(function (g) { return g.gw <= MC.gw.lastDone; }).slice(-n);
    const perWeek = gws.map(function (g) {
      const bench = g.picks.filter(function (k) { return P[k.id] && k.pos > 11; });
      return { gw: g.gw, benchScored: bench.reduce(function (s, k) { return s + (k.pts || 0); }, 0) };
    });
    const dAvoid = sum(drows, function (g) { return g.leftOnBench; }), dBench = perWeek.reduce(function (s, w) { return s + w.benchScored; }, 0);
    const count = function (res) { return drows.filter(function (g) { return g.res === res; }).length; };
    const flipped = drows.filter(function (g) { return g.flip; }).map(function (g) { return g.gw; });
    const draft = { game: "draft", weeks: drows.length, rows: drows, perWeek: perWeek, benchScored: dBench, avoidable: dAvoid, flipped: flipped,
      wins: count("W"), draws: count("D"), losses: count("L"),
      flags: { bench: dAvoid > F.draftBench, noWins: drows.length > 0 && count("W") === 0, flipped: flipped.length > 0 } };
    return { classic: classic, draft: draft };
  } catch (e) { return null; }
}

/* PRE.review when it has the shape the tab reads, else the same computed here. */
function mcReviewFrom(mc) {
  try {
    const r = mc && mc.PRE && mc.PRE.review;
    const ok = r && typeof r === "object" && r.classic && Array.isArray(r.classic.rows) && r.draft && Array.isArray(r.draft.rows) && Array.isArray(r.draft.perWeek);
    return ok ? r : mcReviewOf(mc && mc.E, mc && mc.MC);
  } catch (e) { return null; }
}

/* Classic's transfer ledger (A6): each transfer, player in against player out, with the points each has scored from
   that gameweek to the last finished one. Total. */
function mcLedgerOf(E, MC) {
  const out = [];
  try {
    const P = E && E.P && typeof E.P === "object" ? E.P : {};
    const last = Number(MC && MC.gw && MC.gw.lastDone);
    const log = MC && MC.classic && Array.isArray(MC.classic.transfersLog) ? MC.classic.transfersLog : [];
    if (!isFinite(last)) return out;
    log.slice(0, 200).forEach(function (t) {
      if (!t || typeof t !== "object" || !P[t.in] || !P[t.out] || !isFinite(Number(t.gw))) return;
      const since = function (p) { let s = 0; const h = p.h || {}; for (let g = Number(t.gw); g <= last; g++) s += h[g] ? Number(h[g][1]) || 0 : 0; return s; };
      out.push({ gw: Number(t.gw), inId: t.in, outId: t.out, inName: String(P[t.in].n), outName: String(P[t.out].n),
        boughtM: Number(t.inCost) || 0, soldM: Number(t.outCost) || 0, ptsIn: since(P[t.in]), ptsOut: since(P[t.out]) });
    });
  } catch (e) { /* the transfers read before the fault stand */ }
  return out;
}

/* What to repeat and what to stop, each game on its own (the kit's vReview, with every league fact computed and the
   free-transfer bank read from PLAN.replay). Total: empty lists on anything unusable. */
function mcReviewNotes(review, MC, PLAN, E, ledger) {
  const out = { classic: { repeat: [], stop: [] }, draft: { repeat: [], stop: [] } };
  try {
    const c = review && review.classic, d = review && review.draft;
    const plural = function (k, one, many) { return k === 1 ? one : many; };
    if (c && c.weeks > 0) {
      const n = c.weeks, C = out.classic;
      if (c.vsAverage > 0) C.repeat.push("You beat the gameweek average by " + c.vsAverage + " points across " + n + " gameweeks. The core of the squad is sound.");
      else C.stop.push("You trail the gameweek average by " + (-c.vsAverage) + " points across " + n + " gameweeks.");
      if (c.captainBest >= Math.ceil(n / 2)) C.repeat.push("The captain was the best pick in the squad in " + c.captainBest + " of " + n + " gameweeks. Keep following the expected-points order.");
      if (c.flags && c.flags.captain) C.stop.push("Captain choices cost " + c.captainGap + " points against the best captain in the squad. Captain from the expected-points order, not instinct.");
      if (c.flags && c.flags.bench) C.stop.push(c.avoidable + " avoidable bench points in " + n + " gameweeks: set the eleven from the best-eleven view every week, and check it again after Friday's press conferences.");
      else C.repeat.push("Team selection was tight: the bench scored " + c.benchScored + ", of which " + c.avoidable + " was avoidable.");
      const next = Number(MC && MC.gw && MC.gw.next), cap = Number(MC && MC.classic && MC.classic.maxFt);
      const wk = PLAN && PLAN.replay && Array.isArray(PLAN.replay.weeks) ? PLAN.replay.weeks.filter(function (w) { return w && Number(w.gw) === next; })[0] : null;
      const ft = wk ? Number(wk.ftBefore) : NaN;
      if (c.noTransfers) C.stop.push("No transfer in " + n + " gameweeks." + (isFinite(ft) && isFinite(cap) ? " " + ft + " free " + plural(ft, "transfer is", "transfers are") + " banked for GW" + next + ", and " + cap + " is the most you can hold." : ""));
      else if ((ledger || []).length && isFinite(ft) && isFinite(cap) && ft >= cap - 1) {
        C.stop.push(ft + " free transfers are banked for GW" + next + ". The most you can hold is " + cap + ", so rolling " +
          (ft >= cap ? "this week throws one away." : "this week and next throws one away.") + " A wildcard week keeps the bank exactly as it is.");
      }
    }
    if (d && d.weeks > 0) {
      const n = d.weeks, D = out.draft, rows = Array.isArray(d.rows) ? d.rows : [];
      if (d.wins === 0) {
        const st = MC && MC.draft && Array.isArray(MC.draft.standings) ? MC.draft.standings : [];
        const me = st.filter(function (s) { return s && s.name === MC.draft.me; })[0];
        const k = me ? st.filter(function (s) { return s && Number(s.pf) > Number(me.pf); }).length + 1 : 0;
        D.stop.push("No Draft win in " + n + " gameweeks." + (me ? " Your " + me.pf + " points scored rank " + k + " of " + st.length + " in the league." : ""));
      }
      if (d.flipped && d.flipped.length) {
        D.stop.push("Set the Draft eleven from the best-eleven view before every deadline: it would have turned " + d.flipped.length + " " + plural(d.flipped.length, "result", "results") + " into " + plural(d.flipped.length, "a win", "wins") + ".");
      }
      if (d.flags && d.flags.bench) {
        const close = rows.filter(function (g) { return g && g.res === "L" && Number(g.opp) - Number(g.mine) <= MC_UI_CFG.closeLoss; }).length;
        D.stop.push(d.avoidable + " avoidable bench points in " + n + " gameweeks" +
          (close ? ", and " + close + " of your " + d.losses + " " + plural(d.losses, "loss was", "losses were") + " by " + MC_UI_CFG.closeLoss + " points or fewer." : "."));
      } else D.repeat.push("Draft selection was efficient: the bench scored " + d.benchScored + ", of which " + d.avoidable + " was avoidable.");
      const end = Number(E && E.CFG && E.CFG.draftEnd);
      D.repeat.push("Work the free-agent list every week." + (isFinite(end) ? " The league re-drafts after GW" + end + ", so a player's value after that is nothing: hold the fifteen who score most until then." : ""));
    }
  } catch (e) { /* the notes written before the fault stand */ }
  return out;
}

/* ------------------------------------------------------------------ D5 · Review: the tab */

/* D5 · Review. Each game on its own over its last five finished gameweeks: what to repeat and what to stop, the week
   table with bench points scored beside the avoidable ones, and Classic's transfer ledger. Bench points scored are
   never presented as a loss; avoidable ones are (docs/GAP_v110.md, B9's correction). */
function TabReview(props) {
  const why = mcPropsProblem(props, "TabReview", { review: true });
  if (why) throw new TypeError(why);
  const ui = props.ui, on = props.on, mc = props.mc;
  const sec = function (id) { return openOf(ui, "review", id); };
  const rev = ui.reveals && typeof ui.reveals === "object" ? ui.reveals : {};
  const review = mc.MC ? mcReviewFrom(mc) : null;
  if (!review) {
    return (
      <div>
        <Section id="rw-classic" title="Classic review" open={sec("rw-classic")} onToggle={on.sec}>
          <p className="dim">{mc.MC ? "The engine could not rebuild the last five gameweeks from this build's data." : "The baked data block is missing from this build, so there is nothing to review."}</p>
        </Section>
        <Section id="rw-draft" title="Draft review" open={sec("rw-draft")} onToggle={on.sec}>
          <p className="dim">Nothing to review in this build.</p>
        </Section>
      </div>
    );
  }
  const MC = mc.MC, c = review.classic, d = review.draft;
  const ledger = mcLedgerOf(mc.E, MC);
  const notes = mcReviewNotes(review, MC, mc.PLAN, mc.E, ledger);
  const span = function (rows) { const g = rows.map(function (r) { return Number(r && r.gw); }).filter(function (x) { return isFinite(x); }); return g.length ? "GW" + g[0] + (g.length > 1 ? " to GW" + g[g.length - 1] : "") : ""; };
  const cSpan = span(c.rows), dSpan = span(d.rows);
  const top = function (list) { return (Array.isArray(list) ? list : []).map(function (t) { return t.n + " " + t.pts; }).join(", "); };
  const chipName = { wildcard: "wildcard", freehit: "free hit", bboost: "bench boost", "3xc": "triple captain" };
  const lists = function (n) {
    return (
      <div>
        {n.repeat.length ? <div className="panel-k">Repeat</div> : null}
        {n.repeat.length ? <ul style={{ margin: 0, paddingLeft: "18px" }}>{n.repeat.map(function (t, i) { return <li key={i} className="panel-v">{t}</li>; })}</ul> : null}
        {n.stop.length ? <div className="panel-k" style={{ marginTop: n.repeat.length ? "8px" : 0 }}>Stop</div> : null}
        {n.stop.length ? <ul style={{ margin: 0, paddingLeft: "18px" }}>{n.stop.map(function (t, i) { return <li key={i} className="panel-v">{t}</li>; })}</ul> : null}
      </div>
    );
  };
  const perWeek = {};
  (d.perWeek || []).forEach(function (w) { if (w) perWeek[w.gw] = w.benchScored; });
  const res = { W: "Won", L: "Lost", D: "Drew" };
  return (
    <div>
      <Section id="rw-classic" title={cSpan ? "Classic, " + cSpan : "Classic review"} open={sec("rw-classic")} onToggle={on.sec}>
        {c.rows.length ? (
          <div>
            <p data-testid="rw-c-sum">{"Classic, " + cSpan + ": the bench scored " + c.benchScored + " points, and " + c.avoidable +
              " of them were avoidable, points a better legal eleven would have had on the pitch."}</p>
            {notes.classic.repeat.length || notes.classic.stop.length ? <div className="panel" data-testid="rw-c-notes">{lists(notes.classic)}</div> : null}
            <Row head cols={MC_RW_C_COLS}><span>GW</span><span>You v average</span><span className="rt">Bench scored</span><span className="rt">Avoidable</span></Row>
            {c.rows.map(function (g) {
              return (
                <Row key={g.gw} cols={MC_RW_C_COLS}>
                  <span data-testid="rw-c-gw" data-gw={String(g.gw)} data-bench={String(g.bench)} data-avoid={String(g.leftOnBench)}>{"GW" + g.gw}</span>
                  <span className={g.pts >= g.avg ? "go" : "out"}>{g.pts + " v " + g.avg}</span>
                  <span className="rt dim">{String(g.bench)}</span>
                  <span className={"rt" + (g.leftOnBench > 0 ? " warnt" : "")}>{String(g.leftOnBench)}</span>
                  <span className="mini">
                    <span>{"Rank " + grp(g.rank)}</span>
                    <span>{g.cap ? "Captain " + g.cap.n + " " + g.cap.pts : "No captain"}</span>
                    <span>{g.capGap > 0 && g.bestCap ? "Better captain " + g.bestCap.n + " " + g.bestCap.pts : "Captain was the best pick"}</span>
                    {g.chip ? <span>{"Chip " + (chipName[g.chip] || g.chip)}</span> : null}
                    {g.tx ? <span>{"Transfers " + g.tx + (g.hit ? ", hit \u2212" + g.hit : "")}</span> : null}
                    <span>{"Top " + top(g.top)}</span>
                  </span>
                </Row>
              );
            })}
            <Reveal id="rw-how" label="How avoidable is measured" open={!!rev["rw-how"]} onToggle={on.rev}>
              <div>Bench scored is what the bench scored. It is not a loss in itself: most of it could only have been played by dropping a starter who scored as much or more.</div>
              <div>Avoidable is the gap between the best legal eleven from the fifteen, picked on the points each player actually scored, and the eleven that played. The captain gap is the best captain in the squad against the one chosen, on the same points.</div>
            </Reveal>
            <div className="panel-k" style={{ marginTop: "12px" }}>Transfer ledger</div>
            {ledger.length ? ledger.map(function (t) {
              const diff = t.ptsIn - t.ptsOut;
              return (
                <Row key={t.gw + "-" + t.inId + "-" + t.outId} cols={MC_RW_L_COLS}>
                  <span>{"GW" + t.gw}</span>
                  <span className="nm" data-testid="rw-ledger" data-in={String(t.inId)} data-out={String(t.outId)}>{t.inName + " in for " + t.outName}</span>
                  <span className={"rt " + (diff >= 0 ? "go" : "out")}>{(diff > 0 ? "+" : diff < 0 ? "−" : "") + Math.abs(diff)}</span>
                  <span className="mini">
                    <span>{"Bought £" + t.boughtM.toFixed(1) + "m, sold £" + t.soldM.toFixed(1) + "m"}</span>
                    <span>{"Since then " + t.ptsIn + " points against " + t.ptsOut}</span>
                  </span>
                </Row>
              );
            }) : <div className="dim">No Classic transfer on record.</div>}
          </div>
        ) : <p className="dim">Classic: no finished gameweek to review yet.</p>}
      </Section>
      <Section id="rw-draft" title={dSpan ? "Draft, " + dSpan : "Draft review"} open={sec("rw-draft")} onToggle={on.sec}>
        {d.rows.length ? (
          <div>
            <p data-testid="rw-d-sum">{"Draft, " + dSpan + ": won " + d.wins + ", drew " + d.draws + ", lost " + d.losses + ". The bench scored " + d.benchScored +
              " points, and " + d.avoidable + " of them were avoidable." +
              (d.flipped.length ? " The best eleven would have won " + d.flipped.map(function (g) { return "GW" + g; }).join(" and ") + "." : " The best eleven would not have changed a result.")}</p>
            {notes.draft.repeat.length || notes.draft.stop.length ? <div className="panel" data-testid="rw-d-notes">{lists(notes.draft)}</div> : null}
            <Row head cols={MC_RW_D_COLS}><span>GW</span><span>Result</span><span className="rt">Avoidable</span></Row>
            {d.rows.map(function (g) {
              const b = perWeek[g.gw] === undefined ? 0 : perWeek[g.gw];
              return (
                <Row key={g.gw} cols={MC_RW_D_COLS}>
                  <span data-testid="rw-d-gw" data-gw={String(g.gw)} data-bench={String(b)} data-avoid={String(g.leftOnBench)} data-flip={String(!!g.flip)}>{"GW" + g.gw}</span>
                  <span className={g.res === "W" ? "go" : g.res === "L" ? "out" : undefined}>{(res[g.res] || "Not played") + (g.mine !== null && g.mine !== undefined ? " " + g.mine + "–" + g.opp : "")}</span>
                  <span className={"rt" + (g.leftOnBench > 0 ? " warnt" : "")}>{String(g.leftOnBench)}</span>
                  <span className="mini">
                    {g.oppName ? <span>{"v " + g.oppName}</span> : null}
                    <span>{"Bench scored " + b}</span>
                    <span className={g.flip ? "out" : undefined}>{g.flip ? "The best eleven would have won it" : g.res === "W" ? "Won as picked" : "The best eleven would not have changed it"}</span>
                    <span>{"Top " + top(g.top)}</span>
                  </span>
                </Row>
              );
            })}
            <div className="dim">Avoidable points are bench points the best legal eleven would have played. Draft has no captain.</div>
          </div>
        ) : <p className="dim">Draft: no finished gameweek to review yet.</p>}
      </Section>
    </div>
  );
}

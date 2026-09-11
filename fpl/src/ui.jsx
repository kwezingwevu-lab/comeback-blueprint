import React from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Crosshair, ClipboardList, Shield, Users, Layers, Zap, FlaskConical, RefreshCw, Ellipsis, ChevronRight, TriangleAlert, Check, Download, Upload, BookOpen, ListChecks } from "lucide-react";

/* ------------------------------------------------------------------ constants
   APP_VERSION is stamped by build.cjs above this line; never defined here.
   Colour lives in 21 custom properties on .mc-root and nowhere else: every rule
   below this comment addresses colour through var(--token). */

const TABS = [
  { id: "command", label: "Now", aria: "Command", Icon: Crosshair },
  { id: "plan", label: "Plan", Icon: ClipboardList },
  { id: "squad", label: "Squad", Icon: Shield },
  { id: "rivals", label: "Rivals", Icon: Users },
  { id: "draft", label: "Draft", Icon: Layers },
  { id: "chips", label: "Chips", Icon: Zap },
  { id: "lab", label: "Lab", Icon: FlaskConical }
];

const TOKENS = ["--bg", "--bg2", "--bg3", "--line", "--text", "--dim", "--mute", "--grn", "--grn2", "--pnk", "--pnk2", "--amb", "--cyn", "--blu", "--pur", "--wht", "--shadow", "--focus", "--ok", "--warn", "--err"];

const PRIMARY = { command: "cmd-stand", plan: "plan-tx", squad: "sq-fifteen", rivals: "rv-table", draft: "df-waivers", chips: "ch-now", lab: "lab-data" };

const STYLE = `
.mc-root{
  --bg:#0b0e13; --bg2:#131822; --bg3:#1b2130; --line:#28303e; --text:#e9eef6; --dim:#97a3b6;
  --mute:#6a7588; --grn:#42dda0; --grn2:#1d7a59; --pnk:#ff5f8d; --pnk2:#7c2542; --amb:#ffb84d;
  --cyn:#4fd1e0; --blu:#5d8cf0; --pur:#a98bfb; --wht:#ffffff; --shadow:#00000099; --focus:#7aa2ff;
  --ok:#42dda0; --warn:#ffb84d; --err:#ff5f8d;
  background:var(--bg); color:var(--text); min-height:100vh; padding:0 0 44px;
  font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  -webkit-font-smoothing:antialiased; -webkit-text-size-adjust:100%;
}
.mc-root *{box-sizing:border-box; font-size:inherit}
.mc-root button,.mc-root select,.mc-root input,.mc-root textarea{font-family:inherit;color:inherit}
.wrap{max-width:720px;margin:0 auto;padding:0 12px}

.hdr{display:flex;align-items:flex-start;gap:8px;padding:12px 12px 8px;border-bottom:1px solid var(--line);background:var(--bg2)}
.hdr-l{flex:1 1 auto;min-width:0}
.hdr h1{margin:0;font-size:16px;font-weight:700;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status{display:flex;flex-wrap:wrap;gap:10px;margin-top:3px;font-size:11px;color:var(--dim)}
.status b{color:var(--text);font-weight:600}
.hdr-r{display:flex;gap:6px;flex:none}
.gwbar{position:relative;height:3px;background:var(--bg3);overflow:hidden}
.gwbar i{display:block;height:100%;background:var(--grn2)}
.refbar{height:3px;background:var(--bg3);overflow:hidden}
.refbar i{display:block;height:100%;width:40%;background:var(--cyn);animation:sl 1.1s linear infinite}
@keyframes sl{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}

.tabs{display:flex;gap:4px;padding:6px 8px;background:var(--bg2);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:4}
.tabi{flex:1 1 0;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  background:var(--bg3);border:1px solid var(--line);border-radius:10px;color:var(--dim);font-size:11px;cursor:pointer;padding:4px 2px}
.tabi svg{width:19px;height:19px}
.tabi[aria-current="true"]{color:var(--text);border-color:var(--grn2);background:var(--bg)}
.tabi[aria-current="true"] svg{color:var(--grn)}
.tabi span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.btn{min-height:38px;padding:8px 14px;border-radius:9px;border:1px solid var(--line);background:var(--bg3);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn-go{background:var(--grn2);border-color:var(--grn);color:var(--wht)}
.btn-sm{min-height:32px;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg3);color:var(--text);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px}
.btn-ic{width:38px;min-height:38px;padding:0}
.btn-ic svg{width:18px;height:18px}
.btn:disabled,.btn-sm:disabled{opacity:.5}
.inp{min-height:40px;width:100%;padding:8px 10px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:13px}
textarea.inp{min-height:88px;line-height:1.4;resize:vertical}

.card{background:var(--bg2);border:1px solid var(--line);border-radius:14px;margin:12px 0;overflow:hidden}
.section{background:var(--bg2);border:1px solid var(--line);border-radius:12px;margin:10px 0;overflow:hidden}
.sec-h{min-height:48px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:10px 12px;background:var(--bg2);border:0;border-bottom:1px solid var(--line);color:var(--text);font-size:14px;font-weight:600;text-align:left;cursor:pointer}
.sec-h .cv{flex:none;color:var(--dim);transition:transform .15s ease}
.sec-h[aria-expanded="true"] .cv{transform:rotate(90deg)}
.sec-h svg{width:16px;height:16px}
.sec-b{padding:10px 12px 14px}
.sec-b>*+*{margin-top:9px}

.reveal{width:100%;min-height:32px;display:flex;align-items:center;gap:6px;padding:6px 0;background:none;border:0;color:var(--dim);font-size:12px;text-align:left;cursor:pointer}
.reveal .tri{color:var(--grn);font-size:12px;transition:transform .15s ease}
.reveal[aria-expanded="true"] .tri{transform:rotate(90deg)}
.reveal-b{padding:2px 0 6px;font-size:12px;color:var(--dim);line-height:1.5}
.reveal-b>*+*{margin-top:6px}

.landing{padding:12px}
.lead{font-size:18px;font-weight:700;line-height:1.25;letter-spacing:-.2px}
.lead .hi{color:var(--grn)}
.lead .no{color:var(--pnk)}
.panel{margin-top:10px;padding:9px 10px;background:var(--bg3);border:1px solid var(--line);border-radius:10px}
.panel-k{font-size:11px;color:var(--mute);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
.panel-v{font-size:13px;line-height:1.45}
.panel-v b{font-weight:600}
.names{font-size:13px;line-height:1.5}
.names i{font-style:normal;color:var(--dim)}
.block{margin-top:10px;padding:10px;border:1px solid var(--pnk);background:var(--pnk2);border-radius:10px;font-size:13px}

.note::first-letter{text-transform:uppercase}
.note{font-size:11px;line-height:1.5;color:var(--dim);padding:8px 10px;background:var(--bg3);border:1px solid var(--line);border-left:3px solid var(--line);border-radius:8px}
.note-w{border-left-color:var(--warn)}
.note-a{border-left-color:var(--pnk)}
.err{font-size:12px;line-height:1.45;color:var(--text);padding:9px 10px;background:var(--pnk2);border:1px solid var(--pnk);border-radius:9px;word-break:break-word}
.boundary{margin:12px;padding:14px;border:1px solid var(--pnk);background:var(--pnk2);border-radius:12px;font-size:13px}

.row{min-height:38px;display:grid;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12px}
.row:last-child{border-bottom:0}
.row-h{min-height:38px;color:var(--mute);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.row .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.row .rt{text-align:right;font-variant-numeric:tabular-nums}
.kv{display:flex;align-items:baseline;justify-content:space-between;gap:10px;min-height:38px;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px}
.kv:last-child{border-bottom:0}
.kv .k{color:var(--dim);font-size:12px}
.kv .v{text-align:right;font-variant-numeric:tabular-nums}
.tbl{overflow-x:auto;-webkit-overflow-scrolling:touch}

.dim{color:var(--dim);font-size:11px;line-height:1.5}
.tier{color:var(--mute);font-size:11px;letter-spacing:.04em}
.go{color:var(--grn)}
.out{color:var(--pnk)}
.warnt{color:var(--warn)}
.cynt{color:var(--cyn)}
.put{color:var(--pur)}
.blut{color:var(--blu)}
.tag{display:inline-block;padding:1px 6px;border-radius:6px;font-size:11px;border:1px solid var(--line);background:var(--bg);color:var(--dim)}
.tag-e{border-color:var(--grn2);color:var(--grn)}
.tag-s{border-color:var(--line);color:var(--blu)}
.tag-d{border-color:var(--pnk2);color:var(--pnk)}
.meter{height:6px;border-radius:4px;background:var(--bg);overflow:hidden;border:1px solid var(--line)}
.meter i{display:block;height:100%;background:var(--cyn)}
.chips-r{display:flex;flex-wrap:wrap;gap:6px}

.menu{position:absolute;right:10px;top:52px;z-index:9;min-width:190px;background:var(--bg3);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px var(--shadow);overflow:hidden}
.menu-i{min-height:44px;width:100%;display:flex;align-items:center;gap:8px;padding:10px 12px;background:none;border:0;border-bottom:1px solid var(--line);color:var(--text);font-size:13px;text-align:left;cursor:pointer}
.menu-i:last-child{border-bottom:0}
.menu-i[aria-current="true"]{color:var(--grn)}
.menu-i svg{width:15px;height:15px;color:var(--dim)}
.mhead{padding:7px 12px;font-size:11px;color:var(--mute);text-transform:uppercase;letter-spacing:.08em;background:var(--bg2)}

.mc-root button:active,.mc-root select:active,.mc-root input:active,.mc-root textarea:active,
.btn:active,.btn-sm:active,.tabi:active,.sec-h:active,.menu-i:active,.inp:active,.reveal:active{transform:scale(.97)}
.mc-root button,.mc-root .tabi,.mc-root .sec-h,.mc-root .menu-i,.mc-root .reveal{transition:transform .08s ease,background .12s ease,color .12s ease}
.mc-root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}
@media (prefers-reduced-motion: reduce){
  .mc-root *,.mc-root *::before,.mc-root *::after{transition:none !important;animation:none !important;scroll-behavior:auto !important}
}
.mini{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--dim);line-height:1.5;grid-column:1 / -1}
.mini b{color:var(--text);font-weight:600}
.chartwrap{width:100%}
.reveal-w{margin-top:2px}
.sec-b p{margin:0 0 8px}
.sec-b p:last-child{margin-bottom:0}
@media (max-width:380px){ .tabi{font-size:11px} .wrap{padding:0 10px} }
`;

/* ------------------------------------------------------------------ storage adapter
   window.storage in the artifact (async, {value} envelopes); localStorage everywhere
   else. Both paths are total: a broken store degrades to an unsaved session. */

const STORE_KEYS = { state: "mc_state", ui: "mc_ui" };

const store = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
        const r = await window.storage.get(key);
        if (r === null || r === undefined) return null;
        return r && typeof r === "object" && "value" in r ? r.value : r;
      }
    } catch (e) { /* fall through to localStorage */ }
    try {
      const s = window.localStorage.getItem(key);
      return s === null ? null : JSON.parse(s);
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.set === "function") {
        await window.storage.set(key, value);
        return true;
      }
    } catch (e) { /* fall through */ }
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
};

/* ------------------------------------------------------------------ time helpers */

function nowISO() {
  try { if (typeof window !== "undefined" && window.__NOW__) return String(window.__NOW__); } catch (e) { /* noop */ }
  return new Date().toISOString();
}
function msOf(iso) { const t = Date.parse(iso); return isFinite(t) ? t : 0; }
function sastText(iso) {
  const t = msOf(iso); if (!t) return "";
  const d = new Date(t + 2 * 3600000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hh = String(d.getUTCHours()).padStart(2, "0"), mm = String(d.getUTCMinutes()).padStart(2, "0");
  return days[d.getUTCDay()] + " " + hh + ":" + mm;
}
function hoursText(h) {
  if (h === null || h === undefined || !isFinite(h)) return "—";
  if (h < 0) return "closed";
  if (h < 1) return Math.max(1, Math.round(h * 60)) + "min";
  if (h < 48) return Math.round(h) + "h";
  return Math.round(h / 24) + "d";
}
function gwProgress(ctx) {
  try {
    const evs = ctx.events || [];
    const next = evs.filter(function (e) { return Number(e.id) === ctx.nextEvent; })[0];
    const prev = evs.filter(function (e) { return Number(e.id) === ctx.nextEvent - 1; })[0];
    const a = prev ? msOf(prev.deadline_time) : 0, b = next ? msOf(next.deadline_time) : 0;
    if (!a || !b || b <= a || !ctx.now) return 0;
    const p = ((ctx.now - a) / (b - a)) * 100;
    return Math.max(0, Math.min(100, Math.round(p)));
  } catch (e) { return 0; }
}
/* The gameweek that is actually under way: the last event whose deadline has passed,
   read from the clock and not from the snapshot's current_event. A snapshot taken on
   the Friday still says current_event 3 while GW4 is being played, and keying the live
   window on it left the transfer panels open all Saturday. */
function liveEventOf(ctx) {
  try {
    if (!ctx || !ctx.ok || !ctx.now) return 0;
    let best = 0;
    (ctx.events || []).forEach(function (e) {
      const dl = msOf(e.deadline_time);
      if (dl && dl <= ctx.now && Number(e.id) > best) best = Number(e.id);
    });
    return best;
  } catch (e) { return 0; }
}
/* The live window the UX standard names: from that event's deadline to two hours past
   its last kick-off, and only while one of its fixtures is unfinished. ctx.phase is the
   engine's coarser answer. */
function inLiveWindow(ctx) {
  try {
    const ev = liveEventOf(ctx);
    if (!ev) return false;
    const fx = ctx.fixturesByEvent[ev] || [];
    if (!fx.length) return false;
    if (fx.every(function (f) { return !!f.finished; })) return false;
    let last = 0;
    fx.forEach(function (f) { const k = msOf(f.kickoff_time); if (k > last) last = k; });
    if (!last) return false;
    return ctx.now <= last + 2 * 3600000;
  } catch (e) { return false; }
}
function livePointsNow(ctx) {
  try {
    const ev = liveEventOf(ctx) || ctx.currentEvent;
    const gw = ctx.live && ctx.live.gw ? ctx.live.gw[ev] || ctx.live.gw[String(ev)] : null;
    const pk = ctx.live && ctx.live.picks ? ctx.live.picks[ev] || ctx.live.picks[String(ev)] : null;
    const picks = pk && Array.isArray(pk.picks) ? pk.picks : ctx.picks;
    if (!gw || !picks.length) return null;
    return gwPoints(picks, gw);
  } catch (e) { return null; }
}

/* ------------------------------------------------------------------ format helpers */

function canCopy() { try { return !!(navigator.clipboard && navigator.clipboard.writeText); } catch (e) { return false; } }
function money(tenths) { const v = Number(tenths); return isFinite(v) ? "£" + (v / 10).toFixed(1) + "m" : "—"; }
function one(x) { const v = Number(x); return isFinite(v) ? v.toFixed(1) : "—"; }
function two(x) { const v = Number(x); return isFinite(v) ? v.toFixed(2) : "—"; }
function pc(x) { const v = Number(x); return isFinite(v) ? Math.round(v * 100) + "%" : "—"; }
function grp(n) { const v = Number(n); return isFinite(v) ? String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "—"; }
function nameOf(ctx, id) { const el = ctx && ctx.els ? ctx.els[id] : null; const n = Number(id); return el ? el.web_name : (isFinite(n) ? "id " + n : "unknown player"); }
function teamOf(ctx, id) { const el = ctx && ctx.els ? ctx.els[id] : null; const t = el && ctx.teams ? ctx.teams[el.team] : null; return t ? t.short_name : ""; }
function posOf(ctx, id) { const el = ctx && ctx.els ? ctx.els[id] : null; return el ? POS_NAME[el.element_type] || "" : ""; }
function codeName(ctx, code) { const r = draftEl(code, ctx); const c = Number(code); return r ? r.web_name : (isFinite(c) ? "code " + c : "unknown player"); }
function byPos(ctx, ids) {
  const out = { 1: [], 2: [], 3: [], 4: [] };
  if (!ctx || !ctx.els || !ctx.xp) return out;
  (Array.isArray(ids) ? ids : []).forEach(function (id) { const el = ctx.els[id]; if (el && out[el.element_type]) out[el.element_type].push(id); });
  [1, 2, 3, 4].forEach(function (t) { out[t].sort(function (a, b) { return (ctx.xp[b] ? ctx.xp[b].xp5 : 0) - (ctx.xp[a] ? ctx.xp[a].xp5 : 0); }); });
  return out;
}
function flagList(ctx, ids) {
  const out = [];
  if (!ctx || !ctx.flags) return out;
  (Array.isArray(ids) ? ids : []).forEach(function (id) {
    const fl = ctx.flags[id]; if (!fl || !fl.flagged) return;
    out.push({ id: id, name: nameOf(ctx, id), status: fl.status, chance: fl.chance, news: fl.news });
  });
  return out;
}

/* ------------------------------------------------------------------ seed + plan

   seedState builds the CONTRACT §6 state from the snapshot the first time the app
   runs: the fifteen and their purchase prices come from the entry's own picks (no
   transfers have been made, so purchase = season-start price), the draft roster is
   the Part M claim-outs plus the XI codes that are not claim-ins. */

function seedState(live) {
  const st = { version: 87, exported_at: null, entry: null, squad: [], bank: 0, ft: 1, value: 0, confirmed_gw: 0, leagues: [], draft: { league_id: null, roster: [], watchlist: [] }, ui: { mode: "simple", tab: "command", open: {}, reveals: {} }, ledger: [], refresh: { pair: "sonnet46", last: null } };
  try {
    const cur = Number(live.current_event) || 0;
    const pk = live.picks ? live.picks[cur] || live.picks[String(cur)] : null;
    const byId = {}; (live.elements || []).forEach(function (e) { byId[e.id] = e; });
    if (pk && Array.isArray(pk.picks)) {
      pk.picks.forEach(function (p) {
        const el = byId[p.element]; if (!el) return;
        st.squad.push({ id: el.id, purchase: Number(el.now_cost) - Number(el.cost_change_start || 0) });
      });
    }
    st.entry = live.entry ? Number(live.entry.id) : null;
    st.bank = live.entry ? Number(live.entry.last_deadline_bank) || 0 : 0;
    st.value = live.entry ? Number(live.entry.last_deadline_value) || 0 : 0;
    st.ft = Number(live.ft_available) || 1;
    st.confirmed_gw = cur;
    st.leagues = (live.leagues || []).map(function (l) { return Number(l.id); });
    const claims = (WEEKLY.draft && WEEKLY.draft.claims) || [];
    const xi = (WEEKLY.draft && WEEKLY.draft.xi) || {};
    const ins = {}; claims.forEach(function (c) { ins[c.in] = true; });
    const roster = [];
    claims.forEach(function (c) { if (roster.indexOf(c.out) < 0) roster.push(c.out); });
    [].concat([xi.gk], xi.def || [], xi.mid || [], xi.fwd || []).forEach(function (c) {
      if (c && !ins[c] && roster.indexOf(c) < 0) roster.push(c);
    });
    st.draft.roster = roster;
    st.draft.watchlist = (WEEKLY.draft && WEEKLY.draft.watchlist) || [];
  } catch (e) { /* defaults stand */ }
  return sanitiseState(st);
}

/* buildPlan turns the engine's answers into the one decision the landing shows. */
function buildPlan(ctx) {
  if (!ctx || typeof ctx !== "object") ctx = { ok: false };
  const plan = { kind: "hold", gw: ctx.nextEvent, deadline: ctx.deadline, hours: ctx.hoursToDeadline, tp: null, wc: null, timing: null, ids: [], capId: null, viceId: null, formation: "", flags: [], cost: 0, bank: 0, livePts: null, chipUsed: false, agree: true, why: [] };
  try {
    if (!ctx.ok) { plan.kind = "nodata"; return plan; }
    plan.livePts = livePointsNow(ctx);
    if (ctx.block && ctx.block.block) { plan.kind = "blocked"; return plan; }
    if (inLiveWindow(ctx)) { plan.kind = "live"; return plan; }
    plan.tp = transferProtocol(null, ctx);
    const chips = ctx.live && ctx.live.history ? ctx.live.history.chips || [] : [];
    plan.chipUsed = chips.some(function (c) { return c && c.name === "wildcard"; });
    const wantWc = WEEKLY.classic && WEEKLY.classic.plan === "wildcard" && !plan.chipUsed;
    if (wantWc) {
      plan.timing = wildcardTiming(ctx);
      const five = plan.timing.horizons.length ? plan.timing.horizons[0].sumDeficit : 0;
      plan.agree = five >= WC_TRIGGER;
      if (plan.agree) {
        plan.wc = wildcardSolver(ctx, {});
        if (plan.wc.ok) {
          plan.kind = "wildcard";
          plan.ids = plan.wc.ids; plan.cost = plan.wc.cost; plan.bank = plan.wc.bank;
          plan.capId = plan.wc.xi ? plan.wc.xi.capId : null;
          plan.viceId = plan.wc.xi ? plan.wc.xi.viceId : null;
          plan.formation = plan.wc.xi ? plan.wc.xi.formation : "";
          plan.why.push("Five gameweeks of squad deficit come to " + one(five) + " points against a trigger of " + WC_TRIGGER + ".");
        }
      } else {
        plan.why.push("The written plan is the wildcard, but the five-gameweek deficit is only " + one(five) + " against a trigger of " + WC_TRIGGER + ".");
      }
    }
    if (plan.kind !== "wildcard") {
      const tp = plan.tp;
      plan.kind = tp && tp.moves.length ? "transfers" : "hold";
      plan.capId = tp ? tp.captain : null;
      plan.viceId = tp ? tp.vice : null;
      plan.formation = tp ? tp.formation || "" : "";
      plan.ids = ctx.squadIds;
    }
    plan.flags = flagList(ctx, plan.kind === "wildcard" ? plan.ids : ctx.squadIds);
  } catch (e) { plan.kind = "nodata"; plan.why.push("engine error: " + String(e && e.message ? e.message : e)); }
  return plan;
}

/* ------------------------------------------------------------------ hooks */

function useNow() {
  const [t, setT] = React.useState(nowISO());
  React.useEffect(function () {
    let mocked = false;
    try { mocked = !!(typeof window !== "undefined" && window.__NOW__); } catch (e) { mocked = false; }
    if (mocked) return undefined;
    const h = setInterval(function () { setT(nowISO()); }, 60000);
    return function () { clearInterval(h); };
  }, []);
  return t;
}

function useBoot(live) {
  const [ready, setReady] = React.useState(false);
  const [state, setState] = React.useState(function () { return seedState(live); });
  const [ui, setUi] = React.useState({ mode: "simple", tab: "command", open: {}, reveals: {} });
  React.useEffect(function () {
    let dead = false;
    (async function () {
      const savedState = await store.get(STORE_KEYS.state);
      const savedUi = await store.get(STORE_KEYS.ui);
      if (dead) return;
      if (savedState) setState(sanitiseState(savedState));
      const base = sanitiseState(savedState || {}).ui;
      const u = savedUi && typeof savedUi === "object" ? savedUi : base;
      setUi({
        mode: u.mode === "full" ? "full" : "simple",
        tab: TABS.some(function (t) { return t.id === u.tab; }) ? u.tab : "command",
        open: u.open && typeof u.open === "object" ? u.open : {},
        reveals: u.reveals && typeof u.reveals === "object" ? u.reveals : {}
      });
      setReady(true);
    })();
    return function () { dead = true; };
  }, []);
  React.useEffect(function () { if (ready) store.set(STORE_KEYS.ui, ui); }, [ready, ui]);
  React.useEffect(function () { if (ready) store.set(STORE_KEYS.state, state); }, [ready, state]);
  return { ready: ready, state: state, setState: setState, ui: ui, setUi: setUi };
}

/* ------------------------------------------------------------------ components */

class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err: err }; }
  componentDidCatch(err) { try { if (typeof console !== "undefined") console.error(err); } catch (e) { /* noop */ } }
  render() {
    if (this.state.err) {
      const m = String(this.state.err && this.state.err.message ? this.state.err.message : this.state.err).slice(0, 140);
      return React.createElement("div", { className: "boundary" },
        React.createElement("b", null, "This panel could not draw."),
        React.createElement("div", { className: "dim", style: { marginTop: "6px" } }, m),
        React.createElement("div", { className: "dim", style: { marginTop: "6px" } }, "Everything else still works. Open another tab, then come back."));
    }
    return this.props.children;
  }
}

function Section(props) {
  const open = !!props.open;
  return (
    <div className="section" data-section={props.id}>
      <button className="sec-h" data-testid={"sec-" + (props.id === undefined || props.id === null ? "?" : props.id)} aria-expanded={open ? "true" : "false"}
        onClick={function () { props.onToggle(props.id); }}>
        <span>{props.title}</span>
        <ChevronRight className="cv" aria-hidden="true" />
      </button>
      <div className="sec-b" hidden={!open}>{open ? props.children : null}</div>
    </div>
  );
}

function Reveal(props) {
  const open = !!props.open;
  return (
    <div className="reveal-w">
      <button className="reveal" data-testid={"rev-" + (props.id === undefined || props.id === null ? "?" : props.id)} aria-expanded={open ? "true" : "false"}
        onClick={function () { props.onToggle(props.id); }}>
        <span className="tri" aria-hidden="true">▸</span>
        <span>{props.label}</span>
      </button>
      <div className="reveal-b" hidden={!open}>{open ? props.children : null}</div>
    </div>
  );
}

function Tier(props) { return <span className="tier">{props.k}</span>; }

/* D3: while the entry's picks and the saved fifteen differ, every panel that would
   recommend something shows this instead. */
function BlockNote(props) {
  const ctx = props.ctx;
  const add = (ctx.block.added || []).map(function (id) { return nameOf(ctx, id); }).join(", ") || "none";
  const rem = (ctx.block.removed || []).map(function (id) { return nameOf(ctx, id); }).join(", ") || "none";
  return (
    <div className="block">
      <div className="panel-v">The entry's picks and the saved fifteen differ. In the API: {add}. Saved: {rem}.</div>
      {props.onConfirm ? <button className="btn btn-go" data-testid={"confirm-" + props.where} onClick={props.onConfirm}>Confirm the API squad</button> : null}
      <div className="dim">Nothing is recommended until they match. Matching is on element id, never on name.</div>
    </div>
  );
}

function Guard(props) {
  if (props.ctx.block && props.ctx.block.block) return <BlockNote ctx={props.ctx} onConfirm={props.onConfirm} where={props.where} />;
  return props.children;
}

function Row(props) {
  return <div className={"row" + (props.head ? " row-h" : "")} style={{ gridTemplateColumns: props.cols }}>{props.children}</div>;
}

function KV(props) {
  return (
    <div className="kv">
      <span className="k">{props.k}</span>
      <span className={"v" + (props.tone ? " " + props.tone : "")}>{props.v}</span>
    </div>
  );
}

function Meter(props) {
  const p = Math.max(0, Math.min(100, Number(props.pct) || 0));
  return <div className="meter" role="img" aria-label={props.label}><i style={{ width: p + "%" }} /></div>;
}

function GwActionCard(props) {
  const ctx = props.ctx, plan = props.plan, mode = props.mode;
  const rev = props.reveals || {}, onRev = props.onReveal;
  const gw = "GW" + plan.gw;
  if (plan.kind === "nodata") {
    return (
      <div className="landing card">
        <div className="lead">No usable snapshot.</div>
        <div className="panel"><div className="panel-v">{ctx.error || "The data block did not load."}</div></div>
      </div>
    );
  }
  if (plan.kind === "blocked") {
    return (
      <div className="landing card">
        <div className="lead"><span className="no">Confirm the squad first.</span></div>
        <BlockNote ctx={ctx} onConfirm={props.onConfirm} where="landing" />
        <div className="dim" style={{ marginTop: "8px" }}><Tier k="T0" /> entry picks</div>
      </div>
    );
  }
  if (plan.kind === "live") {
    return (
      <div className="landing card">
        <div className="lead">{gw ? "Matches are running." : ""}</div>
        <div className="panel">
          <div className="panel-k">Live</div>
          <div className="panel-v"><b>{plan.livePts === null ? "—" : plan.livePts}</b> points so far</div>
        </div>
        <div className="panel">
          <div className="panel-v">Transfers reopen when the last whistle goes.</div>
        </div>
        <div className="dim" style={{ marginTop: "8px" }}><Tier k="T0" /> live scores</div>
      </div>
    );
  }
  const cap = plan.capId ? nameOf(ctx, plan.capId) : "—";
  const vice = plan.viceId ? nameOf(ctx, plan.viceId) : "—";
  const p = byPos(ctx, plan.ids);
  const nm = function (id) { return nameOf(ctx, id); };
  return (
    <div className="landing card">
      <div className="lead">
        {plan.kind === "wildcard" ? <span><span className="hi">Play Wildcard 1</span> before {sastText(plan.deadline)}.</span> : null}
        {plan.kind === "transfers" ? <span><span className="hi">Make {plan.tp.moves.length} transfer{plan.tp.moves.length === 1 ? "" : "s"}</span> before {sastText(plan.deadline)}.</span> : null}
        {plan.kind === "hold" ? <span><span className="hi">Hold</span> — no transfer clears the bar.</span> : null}
      </div>

      {plan.kind === "wildcard" ? (
        <div className="panel">
          <div className="panel-k">The fifteen</div>
          <div className="names">
            {p[1].map(nm).join(", ")} <i>·</i> {p[2].map(nm).join(", ")} <i>·</i> {p[3].map(nm).join(", ")} <i>·</i> {p[4].map(nm).join(", ")}
          </div>
        </div>
      ) : null}

      {plan.kind === "transfers" ? (
        <div className="panel">
          <div className="panel-k">In order</div>
          <div className="panel-v">
            {plan.tp.order.filter(function (o) { return o.action === "sell" || o.action === "buy"; })
              .map(function (o) { return (o.action === "sell" ? "Sell " : "Buy ") + o.name; }).join(" · ")}
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-k">Then</div>
        <div className="panel-v">Captain <b>{cap}</b>, vice <b>{vice}</b>.</div>
      </div>

      <div className="panel">
        <div className="panel-k">{gw} deadline</div>
        <div className="panel-v"><b>{hoursText(plan.hours)}</b> left{plan.flags.length ? ", " + plan.flags.length + " flagged" : ", nobody flagged"}.</div>
      </div>

      <Reveal id="ld-why" label="Why" open={!!rev["ld-why"]} onToggle={onRev}>
        {plan.kind === "wildcard" ? <div>{plan.why.join(" ")} The solver runs under the xG fixture model and again under the goals model; the fifteen above is equal-or-better under both, and the gap between them is noise.</div> : null}
        {plan.kind === "transfers" ? <div>Best plan worth {one(plan.tp.value)} expected points over five gameweeks, margin {two(plan.tp.margin)} over the next genuinely different plan, confidence {plan.tp.confidence}.</div> : null}
        {plan.kind === "hold" ? <div>{plan.tp.reasons.join(" ") || "No swap gains more than four expected points over five gameweeks."}</div> : null}
        <div>Captaincy is the highest expected-value attacker in the XI, flagged players excluded.</div>
      </Reveal>
      <Reveal id="ld-cost" label="What it costs" open={!!rev["ld-cost"]} onToggle={onRev}>
        {plan.kind === "wildcard" ? <div>Fifteen costs {money(plan.cost)} of a {money(ctx.budget)} selling value, leaving {money(plan.bank)} in the bank. The chip itself costs nothing; set one expires at the {"GW" + (WEEKLY.chips ? WEEKLY.chips.set1_expires_gw : 19)} deadline.</div> : null}
        {plan.kind !== "wildcard" ? <div>{plan.tp.hits ? "A hit of " + plan.tp.hits + " points is already subtracted above." : "No hit: " + plan.tp.k + " of your " + ctx.ft + " free transfers."} Bank afterwards {money(plan.tp.bankAfter)}.</div> : null}
      </Reveal>
      {plan.flags.length ? (
        <Reveal id="ld-flag" label="Flags" open={!!rev["ld-flag"]} onToggle={onRev}>
          {plan.flags.map(function (f) {
            return <div key={f.id}>{f.name}: {f.status}{f.chance === null ? "" : " " + f.chance + "%"}{f.news ? " — " + f.news : ""}</div>;
          })}
        </Reveal>
      ) : null}

      <div className="dim" style={{ marginTop: "8px" }}><Tier k="model" /> xP on xG strength · <Tier k="T0" /> prices, flags, deadline</div>
    </div>
  );
}

function Header(props) {
  const ctx = props.ctx;
  return (
    <div className="hdr">
      <div className="hdr-l">
        <h1 data-testid="title">FPL Mission Control</h1>
        <div className="status" data-testid="status">
          <span><b>{"GW" + ctx.nextEvent}</b></span>
          <span>{hoursText(ctx.hoursToDeadline)} to deadline</span>
          <span>FT {ctx.ft}</span>
          <span>{money(ctx.bank)} bank</span>
          <span>{APP_VERSION}</span>
        </div>
      </div>
      <div className="hdr-r">
        <button className="btn-sm btn-ic" data-testid="refresh" aria-label="Refresh player data"
          onClick={props.onRefresh} aria-busy={props.busy ? "true" : "false"}>
          <RefreshCw aria-hidden="true" />
        </button>
        <button className="btn-sm btn-ic" data-testid="menu" aria-label="Menu" aria-expanded={props.menuOpen ? "true" : "false"}
          onClick={props.onMenu}>
          <Ellipsis aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Tabs(props) {
  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.map(function (t) {
        const Icon = t.Icon;
        const on = props.tab === t.id;
        return (
          <button key={t.id} className="tabi" data-tab={t.id} data-testid={"tab-" + t.id}
            aria-label={t.aria || t.label} aria-current={on ? "true" : "false"}
            onClick={function () { props.onTab(t.id); }}>
            <Icon aria-hidden="true" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Menu(props) {
  return (
    <div className="menu" role="menu" data-testid="menu-pop">
      <div className="mhead">Mode</div>
      <button className="menu-i" role="menuitem" data-mode="simple" aria-current={props.mode === "simple" ? "true" : "false"}
        onClick={function () { props.onMode("simple"); }}><Check aria-hidden="true" />Simple</button>
      <button className="menu-i" role="menuitem" data-mode="full" aria-current={props.mode === "full" ? "true" : "false"}
        onClick={function () { props.onMode("full"); }}><Layers aria-hidden="true" />Full</button>
      <div className="mhead">Open</div>
      <button className="menu-i" role="menuitem" data-menu="guide" onClick={function () { props.onJump("lab-guide"); }}><BookOpen aria-hidden="true" />Guide</button>
      <button className="menu-i" role="menuitem" data-menu="glossary" onClick={function () { props.onJump("lab-gloss"); }}><ListChecks aria-hidden="true" />Glossary</button>
      <button className="menu-i" role="menuitem" data-menu="export" onClick={function () { props.onJump("lab-export"); }}><Download aria-hidden="true" />Export</button>
      <button className="menu-i" role="menuitem" data-menu="import" onClick={function () { props.onJump("lab-import"); }}><Upload aria-hidden="true" />Import</button>
    </div>
  );
}

/* ------------------------------------------------------------------ tab: command */

function openOf(ui, tab, id) { const v = ui && ui.open ? ui.open[id] : undefined; return v === undefined ? PRIMARY[tab] === id : !!v; }

function TabCommand(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on;
  const hist = (ctx.live.history && ctx.live.history.current) || [];
  const last = hist.length ? hist[hist.length - 1] : null;
  const ev = (ctx.events || []).filter(function (e) { return Number(e.id) === ctx.currentEvent; })[0];
  const bench = hist.reduce(function (s, r) { return s + (Number(r.points_on_bench) || 0); }, 0);
  const sec = function (id) { return openOf(ui, "command", id); };
  return (
    <div>
      <Section id="cmd-stand" title="Where the season stands" open={sec("cmd-stand")} onToggle={on.sec}>
        <KV k="Overall rank" v={grp(ctx.live.entry ? ctx.live.entry.summary_overall_rank : 0)} />
        <KV k="Season points" v={ctx.live.entry ? ctx.live.entry.summary_overall_points : "—"} />
        <KV k={"GW" + ctx.currentEvent + " points"} v={(last ? last.points : "—") + " of " + (ev ? ev.average_entry_score : "—") + " field"} tone={last && ev && last.points >= ev.average_entry_score ? "go" : "out"} />
        <KV k="Points left on the bench" v={bench} tone={bench > 15 ? "out" : ""} />
        <KV k="Squad value" v={money(ctx.value)} />
        <div className="dim"><Tier k="T0" /> entry history</div>
      </Section>

      <Section id="cmd-checks" title="What the engine checked" open={sec("cmd-checks")} onToggle={on.sec}>
        <KV k="Squad matches the API" v={ctx.block.block ? "no" : "yes"} tone={ctx.block.block ? "out" : "go"} />
        <KV k="Flags on the fifteen" v={flagList(ctx, ctx.squadIds).length} />
        <KV k="Free transfers" v={ctx.ft} />
        <KV k="Snapshot age" v={hoursText((ctx.now - msOf(ctx.live.fetched_at)) / 3600000).replace("min", " min")} />
        <div className="dim">Every number on this screen is recomputed from the snapshot each time it draws. <Tier k="T0" /></div>
      </Section>

      <Section id="cmd-week" title="The week, in order" open={sec("cmd-week")} onToggle={on.sec}>
        <KV k="Tue, Wed" v="Price watch, draft waivers" />
        <KV k="Thu" v="Press conferences, flag check" />
        <KV k="Fri" v="Execute, captain last" />
        <KV k="Sat, Sun" v="Watch. No panic moves" />
        <div className="dim">Transfers are worth more than chips: the evidence ranks transfers, then captaincy, then chip timing.</div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ tab: plan */

function MoveList(props) {
  const ctx = props.ctx, tp = props.tp;
  if (!tp.order.length) return <div className="dim">Nothing to execute.</div>;
  return (
    <div>
      {tp.order.map(function (o) {
        const tone = o.action === "sell" ? "out" : (o.action === "buy" ? "go" : "");
        return (
          <Row key={o.step + o.action + o.id} cols="22px minmax(0,1fr) auto">
            <span className="dim">{o.step}</span>
            <span className="nm"><span className={tone}>{o.action === "sell" ? "Sell" : o.action === "buy" ? "Buy" : o.action === "captain" ? "Captain" : "Vice"}</span> {o.name}</span>
            <span className="rt dim">{o.price === undefined ? "" : money(o.price)}</span>
          </Row>
        );
      })}
    </div>
  );
}

function TabPlan(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on, plan = props.plan;
  const sec = function (id) { return openOf(ui, "plan", id); };
  const rev = ui.reveals;
  const tp = plan.tp || transferProtocol(null, ctx);
  const hidden = plan.kind === "live";
  const wc = sec("plan-wc") ? (plan.wc && plan.wc.ok ? plan.wc : wildcardSolver(ctx, {})) : null;
  const bx = sec("plan-xi") ? bestXI(ctx.squadIds, ctx) : null;
  const wcXi = plan.kind === "wildcard" && plan.wc && plan.wc.ok && plan.wc.xi ? plan.wc.xi.ids : null;
  const capIds = wcXi || bestXI(ctx.squadIds, ctx).ids;
  const cap = sec("plan-cap") ? captainPick(capIds, ctx) : null;
  const tim = sec("plan-time") ? (plan.timing || wildcardTiming(ctx)) : null;
  const fb = WEEKLY.classic.fallback || { moves: [] };
  const fbCost = (WEEKLY.classic.wildcard15 || []).reduce(function (s, id) { return s + (ctx.els[id] ? Number(ctx.els[id].now_cost) : 0); }, 0);
  return (
    <div>
      <Section id="plan-tx" title="Transfers" open={sec("plan-tx")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="plan-tx">
        {hidden ? <div className="note note-w">Matches are running. Transfer panels come back when the last whistle goes.</div> : (
          <div>
            {plan.kind === "wildcard" ? <div className="note">The chip is this week's plan. These are the transfers if you keep it.</div> : null}
            <KV k="Confidence" v={tp.confidence} tone={tp.confidence === "HIGH" ? "go" : tp.confidence === "hold" ? "out" : ""} />
            <KV k="Five-week value" v={one(tp.value) + " pts"} />
            <KV k="Margin over the next plan" v={two(tp.margin)} />
            <KV k="Hits" v={tp.hits ? "−" + tp.hits : "none"} tone={tp.hits ? "out" : "go"} />
            <MoveList ctx={ctx} tp={tp} />
            {tp.forced.length ? <div className="note note-a">Forced: {tp.forced.map(function (f) { return f.web_name + " (" + f.reason + ")"; }).join("; ")}</div> : null}
            {tp.reasons.length ? <div className="note">{tp.reasons.join(" ")}</div> : null}
            <div className="dim"><Tier k="model" /> five-week xP, hits subtracted. A swap ships only on a forced sell or a gain above four.</div>
          </div>
        )}
        </Guard>
      </Section>

      <Section id="plan-wc" title="Wildcard fifteen" open={sec("plan-wc")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="plan-wc">
        {hidden ? <div className="note note-w">Matches are running. Transfer panels come back when the last whistle goes.</div> : wc && wc.ok ? (
          <div>
            <KV k="Cost" v={money(wc.cost) + " of " + money(wc.budget)} />
            <KV k="Bank left" v={money(wc.bank)} tone={wc.bank > 30 ? "out" : ""} />
            <KV k="XI" v={(wc.xi ? wc.xi.formation : "") + ", captain " + (wc.xi && wc.xi.capId ? nameOf(ctx, wc.xi.capId) : "—")} />
            {[1, 2, 3, 4].map(function (t) {
              const ids = byPos(ctx, wc.ids)[t];
              return (
                <Row key={t} cols="42px minmax(0,1fr)">
                  <span className="dim">{POS_NAME[t]}</span>
                  <span className="nm" style={{ whiteSpace: "normal" }}>{ids.map(function (id) { return nameOf(ctx, id); }).join(", ")}</span>
                </Row>
              );
            })}
            {wc.bank > 30 ? <div className="note note-w">{money(wc.bank)} is left unspent: nothing in the pool that fits three per club, the convergence rule and the starts test improved the fifteen.</div> : null}
            {wc.disagreement ? <div className="note">{wc.disagreement.note}</div> : null}
            {wc.relaxed ? <div className="note note-w">Eligibility was relaxed to fill the squad: {wc.relaxations.join("; ")}</div> : null}
            <Reveal id="pl-wc-how" label="How it was built" open={!!rev["pl-wc-how"]} onToggle={on.rev}>
              <div>Greedy seed on five-week xP per million, then one-swap and two-swap local search, under 2-5-5-3, the selling value, three per club and the convergence rule. Run again under the goals model; the fifteen shipped is equal-or-better under both.</div>
            </Reveal>
            <div className="dim"><Tier k="model" /> solver · <Tier k="T0" /> prices</div>
          </div>
        ) : <div className="note note-a">The solver could not build a legal fifteen from the snapshot.</div>}
        </Guard>
      </Section>

      <Section id="plan-cap" title="Captain" open={sec("plan-cap")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="plan-cap">
        {cap ? (
          <div>
            <div className="tbl">
              <Row head cols="minmax(0,1fr) 42px 42px 46px">
                <span>Player</span><span className="rt">EV</span><span className="rt">Start</span><span className="rt">Rivals</span>
              </Row>
              {cap.table.slice(0, 6).map(function (r) {
                return (
                  <Row key={r.id} cols="minmax(0,1fr) 42px 42px 46px">
                    <span className="nm">{r.web_name} {r.eligible ? null : <span className="tag tag-d">out</span>}</span>
                    <span className="rt">{one(r.ev)}</span>
                    <span className="rt">{pc(r.pstart)}</span>
                    <span className="rt">{pc(r.capShareMax)}</span>
                  </Row>
                );
              })}
            </div>
            {cap.table.filter(function (r) { return !r.eligible && r.why !== "not an attacker"; }).length ? <div className="dim">Excluded: {cap.table.filter(function (r) { return !r.eligible && r.why !== "not an attacker"; }).map(function (r) { return r.web_name + " — " + r.why; }).join("; ")}</div> : null}
            <div className="dim">The eleven {wcXi ? "the wildcard leaves you with" : "you own today"}. Rivals is the highest share of your six leagues captaining him. <Tier k="model" /> EV · <Tier k="T0" /> rival picks</div>
          </div>
        ) : null}
        </Guard>
      </Section>

      <Section id="plan-xi" title="Best XI and bench" open={sec("plan-xi")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="plan-xi">
        {bx ? (
          <div>
            <KV k="Formation" v={bx.formation} />
            {[1, 2, 3, 4].map(function (t) {
              const ids = byPos(ctx, bx.ids)[t];
              if (!ids.length) return null;
              return (
                <Row key={t} cols="42px minmax(0,1fr)">
                  <span className="dim">{POS_NAME[t]}</span>
                  <span className="nm" style={{ whiteSpace: "normal" }}>{ids.map(function (id) { return nameOf(ctx, id); }).join(", ")}</span>
                </Row>
              );
            })}
            <KV k="Bench order" v={benchOrder(ctx.squadIds, bx.ids, ctx).map(function (id) { return nameOf(ctx, id); }).join(", ")} />
            <div className="dim">Bench order is the chance a starter fails times what the sub scores when he plays. <Tier k="model" /></div>
          </div>
        ) : null}
        </Guard>
      </Section>

      <Section id="plan-time" title="Wildcard timing" open={sec("plan-time")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="plan-time">
        {tim ? (
          <div>
            <KV k="Weekly gap to the best fifteen" v={one(tim.weeklyGap) + " pts"} />
            <KV k="Swaps needed" v={tim.swapsNeeded} />
            {tim.horizons.map(function (h) { return <KV key={h.label} k={h.label} v={one(h.sumDeficit) + " pts"} />; })}
            <Reveal id="pl-grid" label="Sensitivity grid" open={!!rev["pl-grid"]} onToggle={on.rev}>
              <div className="tbl">
                <Row head cols="52px repeat(6, 1fr)">
                  <span>Deficit</span>
                  {[0, 10, 20, 30, 45, 60].map(function (v) { return <span key={v} className="rt">{v}</span>; })}
                </Row>
                {[0.5, 0.75, 1, 1.25, 1.5].map(function (m) {
                  return (
                    <Row key={m} cols="52px repeat(6, 1fr)">
                      <span className="dim">{m}×</span>
                      {[0, 10, 20, 30, 45, 60].map(function (later) {
                        const cell = tim.grid.filter(function (g) { return g.deficitMult === m && g.laterValue === later; })[0];
                        const v = cell ? cell.nowAdvantageBy.gw19 : 0;
                        return <span key={later} className={"rt " + (v >= 0 ? "go" : "out")}>{Math.round(v)}</span>;
                      })}
                    </Row>
                  );
                })}
              </div>
              <div>Rows are how wrong the weekly deficit could be; columns are what a later window might be worth. Every cell is the now-advantage by the set-one expiry.</div>
            </Reveal>
            <div className="dim">{tim.note} <Tier k="model" /></div>
          </div>
        ) : null}
        </Guard>
      </Section>

      <Section id="plan-fb" title="Fallback, without the chip" open={sec("plan-fb")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="plan-fb">
        {hidden ? <div className="note note-w">Matches are running. Transfer panels come back when the last whistle goes.</div> : (
        <div>
          {fb.moves.map(function (m) {
            return (
              <Row key={m.out} cols="minmax(0,1fr) 16px minmax(0,1fr)">
                <span className="nm out">{nameOf(ctx, m.out)}</span>
                <span className="dim">to</span>
                <span className="nm go">{nameOf(ctx, m.in)}</span>
              </Row>
            );
          })}
          <KV k="Captain, vice" v={nameOf(ctx, fb.captain) + ", " + nameOf(ctx, fb.vice)} />
          <KV k="Written fifteen costs" v={money(fbCost) + " of " + money(ctx.budget)} tone={fbCost <= ctx.budget ? "go" : "out"} />
          <div className="note">The written plan quotes {money(978)} for that fifteen. Today it is {money(fbCost)} against a selling value of {money(ctx.budget)}: still affordable, but the price moved.</div>
          <div className="dim"><Tier k="T0" /> prices today · written plan from the weekly block</div>
        </div>
        )}
        </Guard>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ tab: squad */

function TabSquad(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on;
  const sec = function (id) { return openOf(ui, "squad", id); };
  const ids = ctx.squadIds.slice().sort(function (a, b) {
    const ta = ctx.els[a].element_type, tb = ctx.els[b].element_type;
    return ta - tb || (ctx.xp[b] ? ctx.xp[b].xp5 : 0) - (ctx.xp[a] ? ctx.xp[a].xp5 : 0);
  });
  const moved = ids.filter(function (id) { return Number(ctx.els[id].cost_change_event) !== 0; });
  return (
    <div>
      <Section id="sq-fifteen" title="The fifteen" open={sec("sq-fifteen")} onToggle={on.sec}>
        {ids.map(function (id) {
          const el = ctx.els[id], x = ctx.xp[id], gs = ctx.gwStats[id] || { starts_last3: 0 }, fl = ctx.flags[id];
          const cls = classify(el, ctx);
          const tagc = cls === "EDGE" ? "tag-e" : cls === "DEAD" ? "tag-d" : cls === "SHARED" ? "tag-s" : "";
          const sell = sellPrice(Number(el.now_cost), ctx.purchase[id]);
          return (
            <Row key={id} cols="minmax(0,1fr) 58px">
              <span className="nm">{el.web_name} <span className="dim">{POS_NAME[el.element_type]} {teamOf(ctx, id)}</span></span>
              <span className="rt">{money(el.now_cost)}</span>
              <span className="mini" style={{ gridColumn: "1 / -1" }}>
                <span>sell {money(sell)}</span>
                <span>{gs.starts_last3}/3 starts</span>
                <span>xp1 {one(x.xp1)}</span>
                <span>xp5 {one(x.xp5)}</span>
                <span className={"tag " + tagc}>{cls}</span>
                {fl.flagged ? <span className="tag tag-d">{fl.status}{fl.chance === null ? "" : " " + fl.chance + "%"}</span> : null}
              </span>
            </Row>
          );
        })}
        <div className="dim">EDGE is under a quarter of your rivals owning him, SHARED is seven in ten or more, DEAD is no start in three. <Tier k="model" /> xP · <Tier k="T0" /> prices</div>
      </Section>

      <Section id="sq-price" title="Price watch" open={sec("sq-price")} onToggle={on.sec}>
        {moved.length ? moved.map(function (id) {
          const el = ctx.els[id];
          const d = Number(el.cost_change_event);
          return (
            <Row key={id} cols="minmax(0,1fr) 54px">
              <span className="nm">{el.web_name}</span>
              <span className={"rt " + (d > 0 ? "go" : "out")}>{(d > 0 ? "+" : "") + (d / 10).toFixed(1)}</span>
              <span className="mini" style={{ gridColumn: "1 / -1" }}>
                <span>in {grp(el.transfers_in_event)}</span>
                <span>out {grp(el.transfers_out_event)}</span>
                <span>now {money(el.now_cost)}</span>
              </span>
            </Row>
          );
        }) : <div className="dim">No owned player has moved price this gameweek.</div>}
        <div className="dim">Prices change overnight on net transfers. Selling price is what you paid plus half of any rise. <Tier k="T0" /></div>
      </Section>

      <Section id="sq-confirm" title="Squad check" open={sec("sq-confirm")} onToggle={on.sec}>
        {ctx.block.block ? (
          <div>
            <BlockNote ctx={ctx} onConfirm={props.onConfirm} where="squad" />
            <div className="dim">Two moves were missed by name matching in three gameweeks; that is why this blocks.</div>
          </div>
        ) : (
          <div>
            <KV k="Saved fifteen" v="matches the entry" tone="go" />
            <KV k="Confirmed through" v={"GW" + ctx.state.confirmed_gw} />
            <div className="dim">Nothing to confirm. The check runs again on every snapshot. <Tier k="T0" /></div>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ tab: rivals */

function TabRivals(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on, plan = props.plan;
  const sec = function (id) { return openOf(ui, "rivals", id); };
  const me = ctx.live.entry ? Number(ctx.live.entry.id) : 0;
  const buys = (plan.kind === "wildcard" ? plan.ids.filter(function (id) { return ctx.squadIds.indexOf(id) < 0; }) : (plan.tp ? plan.tp.moves.map(function (m) { return m.in; }) : [])).slice(0, 8);
  const simId = props.simLeague || (ctx.leagues[0] ? ctx.leagues[0].id : 0);
  const simIds = plan.kind === "wildcard" && plan.ids.length === 15 ? plan.ids : null;
  const sim = sec("rv-sim") ? mcLeague(ctx, simId, { iters: 300, ids: simIds, capId: plan.capId, viceId: plan.viceId }) : null;
  return (
    <div>
      <Section id="rv-table" title="The six leagues" open={sec("rv-table")} onToggle={on.sec}>
        <div className="tbl">
          <Row head cols="minmax(0,1fr) 34px 40px 46px">
            <span>League</span><span className="rt">Size</span><span className="rt">Rank</span><span className="rt">Gap</span>
          </Row>
          {ctx.leagues.map(function (L) {
            const st = L.standings || [];
            const first = st[0] ? Number(st[0].total) : 0;
            const mine = st.filter(function (r) { return Number(r.entry) === me; })[0];
            const gap = mine ? first - Number(mine.total) : null;
            const dir = mine && Number(L.last_rank) ? Number(L.last_rank) - Number(mine.rank || L.rank) : 0;
            return (
              <Row key={L.id} cols="minmax(0,1fr) 34px 40px 46px">
                <span className="nm">{L.name}</span>
                <span className="rt dim">{L.size}</span>
                <span className={"rt " + (dir > 0 ? "go" : dir < 0 ? "out" : "")}>{mine ? mine.rank : L.rank}</span>
                <span className="rt dim">{gap === null ? "—" : gap}</span>
              </Row>
            );
          })}
        </div>
        <div className="dim">Gap is points behind the leader. Rank colour is the move since last gameweek. <Tier k="T0" /> standings</div>
      </Section>

      <Section id="rv-own" title="Ownership of your fifteen" open={sec("rv-own")} onToggle={on.sec}>
        {ctx.squadIds.slice().sort(function (a, b) { return rivalOwnMax(b, ctx).max - rivalOwnMax(a, ctx).max; }).map(function (id) {
          const r = rivalOwnMax(id, ctx), cls = classify(ctx.els[id], ctx);
          const tagc = cls === "EDGE" ? "tag-e" : cls === "DEAD" ? "tag-d" : cls === "SHARED" ? "tag-s" : "";
          return (
            <Row key={id} cols="minmax(0,1fr) 48px 52px">
              <span className="nm">{nameOf(ctx, id)}</span>
              <span className="rt">{pc(r.max)}</span>
              <span className={"rt tag " + tagc}>{cls}</span>
            </Row>
          );
        })}
        <div className="dim">The highest share across your six leagues. <Tier k="T0" /> rival picks</div>
      </Section>

      <Section id="rv-buys" title="Convergence on the buys" open={sec("rv-buys")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="rv-buys">
        {buys.length ? buys.map(function (id) {
          const c = convergenceRisk(id, ctx);
          return (
            <Row key={id} cols="minmax(0,1fr) 52px 56px">
              <span className="nm">{nameOf(ctx, id)}</span>
              <span className="rt">{pc(c.max)}</span>
              <span className={"rt " + (c.risk ? "out" : "go")}>{c.risk ? "converge" : "clear"}</span>
            </Row>
          );
        }) : <div className="dim">No incoming player this week.</div>}
        <div className="dim">A buy owned by six in ten rivals or more is excluded: it cannot win a mini-league, it can only lose it. <Tier k="model" /></div>
        </Guard>
      </Section>

      <Section id="rv-cap" title="Captaincy against rivals" open={sec("rv-cap")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="rv-cap">
        {plan.capId ? (
          <div>
            <KV k="Your captain" v={nameOf(ctx, plan.capId)} />
            {ctx.leagues.map(function (L) {
              const share = (ctx.capShare[L.id] || {})[plan.capId] || 0;
              return (
                <Row key={L.id} cols="minmax(0,1fr) 50px">
                  <span className="nm">{L.name}</span>
                  <span className={"rt " + (share >= 0.5 ? "out" : "go")}>{pc(share)}</span>
                </Row>
              );
            })}
            <div className="dim">A captain nobody else has is where a mini-league is won. <Tier k="T0" /> rival captains</div>
          </div>
        ) : <div className="dim">No captain is set.</div>}
        </Guard>
      </Section>

      <Section id="rv-sim" title="Simulation" open={sec("rv-sim")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="rv-sim">
        <select className="inp" data-testid="sim-league" value={String(simId)} aria-label="League to simulate"
          onChange={function (e) { props.onSimLeague(Number(e.target.value)); }}>
          {ctx.leagues.map(function (L) { return <option key={L.id} value={String(L.id)}>{L.name}</option>; })}
        </select>
        {sim ? (
          <div>
            <KV k="Rank now" v={sim.currentRank === null ? "—" : sim.currentRank} />
            <KV k="Median rank after the gameweek" v={one(sim.medianRank)} tone={sim.direction === "up" ? "go" : sim.direction === "down" ? "out" : ""} />
            <KV k="Band, one in ten either way" v={one(sim.rankBand[0]) + " to " + one(sim.rankBand[1])} />
            <KV k="Rivals simulated" v={sim.rivalsSimulated + " of " + sim.entries} />
            <div className="note">{sim.pWinNote}</div>
            <div className="dim">{simIds ? "The wildcard fifteen is simulated, not the one you own today. " : ""}{sim.note} <Tier k="model" /> Monte Carlo</div>
          </div>
        ) : null}
        </Guard>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ tab: draft */

/* The written claims, checked against the snapshot: is the player out really out,
   is the player in really startable, and what is the gain in expected points. */
function checkClaims(claims, ctx, roster) {
  const own = {}; (Array.isArray(roster) ? roster : []).forEach(function (c) { own[c] = true; });
  return (Array.isArray(claims) ? claims : []).filter(function (c) { return c && typeof c === "object"; }).map(function (c, i) {
    const rOut = draftEl(c.out, ctx), rIn = draftEl(c.in, ctx);
    const evOut = draftEV(rOut, ctx), evIn = draftEV(rIn, ctx);
    const forced = !!rOut && (rOut.status !== "a" || evOut.starts_last3 === 0);
    const issues = [];
    if (!rOut) issues.push("player out not in the snapshot");
    if (!rIn) issues.push("player in not in the snapshot");
    if (rOut && !own[c.out]) issues.push("not on the saved roster");
    if (rIn && own[c.in]) issues.push("already on the roster");
    if (rIn && evIn.starts_last3 < 3) issues.push("incoming has " + evIn.starts_last3 + " of 3 starts");
    return {
      key: "claim-" + i, written: i + 1,
      outName: rOut ? rOut.web_name : codeName(ctx, c.out), inName: rIn ? rIn.web_name : codeName(ctx, c.in),
      gain: evIn.ev - evOut.ev, forced: forced, issues: issues, why: c.why || ""
    };
  }).sort(function (a, b) { return (b.forced - a.forced) || (b.gain - a.gain); })
    .map(function (c, i) { c.priority = i + 1; return c; });
}

function TabDraft(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on, state = props.state;
  const sec = function (id) { return openOf(ui, "draft", id); };
  const roster = state.draft.roster || [];
  const complete = state.draft.roster_complete === true;
  const checked = checkClaims(WEEKLY.draft.claims, ctx, roster);
  const engine = sec("df-waivers") ? draftWaivers(state, ctx) : [];
  const xi = sec("df-xi") ? draftXI(roster, ctx) : null;
  const audit = sec("df-watch") ? watchlistAudit(state.draft.watchlist, ctx) : null;
  const wHours = ctx.draft.waiversTime ? (msOf(ctx.draft.waiversTime) - ctx.now) / 3600000 : null;
  const [txt, setTxt] = React.useState(state.draft.league_id === null ? "" : String(state.draft.league_id));
  const typed = txt.trim();
  const changed = typed !== (state.draft.league_id === null ? "" : String(state.draft.league_id));
  return (
    <div>
      {complete ? null : (
        <div className="note note-w">Roster is {roster.length} of 15. Save the draft league id and the rest reads from the API.</div>
      )}

      <Section id="df-waivers" title="Waivers" open={sec("df-waivers")} onToggle={on.sec}>
        <KV k={"GW" + ctx.nextEvent + " waivers process"} v={ctx.draft.waiversTime ? sastText(ctx.draft.waiversTime) + ", " + hoursText(wHours) + " left" : "unknown"} tone={wHours !== null && wHours < 6 ? "out" : ""} />
        {checked.map(function (c) {
          return (
            <Row key={c.key} cols="22px minmax(0,1fr) 46px">
              <span className="dim">{c.priority}</span>
              <span className="nm"><span className="out">{c.outName}</span> <span className="dim">to</span> <span className="go">{c.inName}</span></span>
              <span className="rt">{one(c.gain)}</span>
              <span className="mini" style={{ gridColumn: "1 / -1" }}>
                <span className={c.forced ? "out" : "dim"}>{c.forced ? "forced" : "upgrade"}</span>
                {c.priority === c.written ? null : <span>written {c.written}</span>}
                {c.issues.length ? <span className="warnt">{c.issues.join("; ")}</span> : <span>valid</span>}
              </span>
            </Row>
          );
        })}
        <div className="note">Free agents cannot be listed without the draft league id: the check above proves the players leaving are out and the players arriving start, not that they are unclaimed.</div>
        <Reveal id="df-eng" label="What the engine would claim" open={!!ui.reveals["df-eng"]} onToggle={on.rev}>
          {engine.length ? engine.slice(0, 6).map(function (c) {
            return <div key={c.out + "-" + c.in}>{c.priority}. {c.outName} to {c.inName}, {one(c.gain)} — {c.why}</div>;
          }) : <div>No claim clears the bar.</div>}
          <div>This ranking treats every player not on your roster as available, which the pool is not. Read it as an ordering, not a list.</div>
        </Reveal>
        <div className="dim">Forced replacements first, then the largest gain. <Tier k="model" /> five-week xP · <Tier k="T0" /> draft status</div>
      </Section>

      <Section id="df-xi" title="Draft XI" open={sec("df-xi")} onToggle={on.sec}>
        {xi && xi.ids.length ? (
          <div>
            <KV k="Formation" v={xi.formation} />
            {[1, 2, 3, 4].map(function (t) {
              const ids = byPos(ctx, xi.ids)[t];
              if (!ids.length) return null;
              return (
                <Row key={t} cols="42px minmax(0,1fr)">
                  <span className="dim">{POS_NAME[t]}</span>
                  <span className="nm" style={{ whiteSpace: "normal" }}>{ids.map(function (id) { return nameOf(ctx, id); }).join(", ")}</span>
                </Row>
              );
            })}
            <div className="dim">The eleven from the roster as it stands. The claims above change it.</div>
            <div className="note">Head to head is won by beating one opponent, not the field: when you are behind, pick the higher ceiling; when you are ahead, pick the steadier floor. No captain in this league.</div>
            <div className="dim">Draft scoring gives a keeper ten for a goal where the classic game gives six; everything else matches. <Tier k="T0" /> draft rules</div>
          </div>
        ) : <div className="dim">The roster does not yet make a legal eleven.</div>}
      </Section>

      <Section id="df-watch" title="Watchlist audit" open={sec("df-watch")} onToggle={on.sec}>
        {audit && (audit.keep.length + audit.drop.length + audit.unknown.length) ? (
          <div>
            {audit.detail.map(function (d) {
              return (
                <Row key={d.code} cols="minmax(0,1fr) 54px">
                  <span className="nm">{d.name || "code " + d.code}</span>
                  <span className={"rt " + (d.verdict === "KEEP" ? "go" : "out")}>{d.verdict}</span>
                </Row>
              );
            })}
            <div className="dim">On the list only if he started the last three. <Tier k="T0" /> starts</div>
          </div>
        ) : (
          <div>
            <div className="dim">The watchlist is empty. The rule stands: a name earns its place by starting the last three matches. Forty-four names once held twelve starters.</div>
          </div>
        )}
      </Section>

      <Section id="df-league" title="Draft league" open={sec("df-league")} onToggle={on.sec}>
        <KV k="Saved id" v={state.draft.league_id === null ? "none" : state.draft.league_id} />
        <input className="inp" data-testid="draft-league" inputMode="numeric" placeholder="League id from the draft site"
          aria-label="Draft league id" value={txt} onChange={function (e) { setTxt(e.target.value); }} />
        {changed ? (
          <button className="btn btn-go" data-testid="draft-league-save"
            onClick={function () { props.onLeague(typed === "" ? null : Number(typed)); }}>
            {typed === "" ? "Clear" : "Save"}
          </button>
        ) : null}
        <div className="dim">With the id the roster, the free agents and the waiver order come from the draft API instead of being typed in.</div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ tab: chips */

function TabChips(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on, plan = props.plan;
  const sec = function (id) { return openOf(ui, "chips", id); };
  const w = chipWindows(ctx.live);
  const used = (ctx.live.history && ctx.live.history.chips) || [];
  const expiry = WEEKLY.chips ? WEEKLY.chips.set1_expires_gw : 19;
  const regrets = sec("ch-regret") ? ["TC", "BB", "FH", "WC"].map(function (c) { return chipRegret(c, ctx, {}); }) : [];
  return (
    <div>
      <Section id="ch-now" title="Chips" open={sec("ch-now")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="ch-now">
        <KV k="Set one expires" v={"GW" + expiry + " deadline"} />
        <KV k="Used so far" v={used.length ? used.map(function (c) { return c.name + " GW" + c.event; }).join(", ") : "none"} />
        <KV k="Doubles confirmed" v={w.doubles.length ? w.doubles.map(function (d) { return "GW" + d.event; }).join(", ") : "none"} />
        <KV k="Blanks confirmed" v={w.blanks.length ? w.blanks.map(function (b) { return "GW" + b.event; }).join(", ") : "none"} />
        <KV k="This week" v={plan.kind === "wildcard" ? "Wildcard 1" : "no chip"} tone={plan.kind === "wildcard" ? "go" : ""} />
        <div className="note">{w.recommendation.note}</div>
        <div className="dim">Windows are counted from the published fixture list, never assumed. <Tier k="T0" /> fixtures</div>
        </Guard>
      </Section>

      <Section id="ch-regret" title="Regret, chip by chip" open={sec("ch-regret")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="ch-regret">
        <div className="tbl">
          <Row head cols="44px 52px 52px minmax(0,1fr)">
            <span>Chip</span><span className="rt">Now</span><span className="rt">Later</span><span className="rt">Verdict</span>
          </Row>
          {regrets.map(function (r) {
            return (
              <Row key={r.chip} cols="44px 52px 52px minmax(0,1fr)">
                <span>{r.chip}</span>
                <span className="rt">{one(r.useNow)}</span>
                <span className="rt">{one(r.bestLater)}</span>
                <span className={"rt " + (r.verdict === "use" ? "go" : "dim")}>{r.verdict}</span>
              </Row>
            );
          })}
        </div>
        <div className="dim">Now is what the chip is worth this week; later is the best confirmed window. With no double or blank scheduled, later is zero and holding costs whatever this week was worth. <Tier k="model" /></div>
        </Guard>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ tab: lab */

function TabLab(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on, state = props.state, rf = props.refresh;
  const sec = function (id) { return openOf(ui, "lab", id); };
  const tour = sec("lab-tour") ? tournament(ctx.live) : null;
  const tags = sec("lab-ts") ? overUnderTags(ctx.live) : null;
  const [imp, setImp] = React.useState("");
  const [copied, setCopied] = React.useState("");
  const json = JSON.stringify(state, null, 2);
  const bars = tour ? tour.models.slice().sort(function (a, b) { return (b.spearman || 0) - (a.spearman || 0); }) : [];
  const chart = bars.filter(function (m) { return m.spearman !== null; }).map(function (m) { return { name: m.name, rho: Number((m.spearman || 0).toFixed(3)) }; });
  return (
    <div>
      <Section id="lab-data" title="Data" open={sec("lab-data")} onToggle={on.sec}>
        <KV k="Snapshot taken" v={sastText(ctx.live.fetched_at) + " SAST"} />
        <KV k="Age" v={hoursText((ctx.now - msOf(ctx.live.fetched_at)) / 3600000)} />
        <KV k="Next event" v={"GW" + ctx.nextEvent + ", " + sastText(ctx.deadline) + " SAST"} />
        <KV k="Finished gameweeks" v={ctx.finishedGws.join(", ") || "none"} />
        <KV k="Players, teams, fixtures" v={ctx.elList.length + ", " + ctx.teamList.length + ", " + ctx.fixtures.length} />
        <div className="dim">{ctx.live.source} <Tier k="T0" /></div>
      </Section>

      <Section id="lab-refresh" title="Refresh" open={sec("lab-refresh")} onToggle={on.sec}>
        <div className="dim">Model and search pairing</div>
        <select className="inp" data-testid="refresh-pair" value={state.refresh.pair} aria-label="Model and search tool"
          onChange={function (e) { rf.onPair(e.target.value); }}>
          {Object.keys(REFRESH_PAIRS).map(function (k) {
            return <option key={k} value={k}>{REFRESH_PAIRS[k].model}</option>;
          })}
        </select>
        <button className="btn" data-testid="refresh-run" onClick={rf.onRefresh} disabled={rf.busy}>
          <RefreshCw aria-hidden="true" />{rf.busy ? "Checking" : "Check flags and prices"}
        </button>
        {rf.busy ? <div className="refbar" data-testid="refbar-lab"><i /></div> : null}
        {rf.err ? <div className="err" data-testid="refresh-err">{rf.err}</div> : null}
        {rf.okMsg ? <div className="note">{rf.okMsg}</div> : null}
        <div className="dim">One search, one JSON reply, four thousand tokens so the search results cannot eat the answer. A failure leaves the snapshot exactly as it was. <Tier k="T0" /> after it lands</div>
      </Section>

      <Section id="lab-tour" title="Model tournament" open={sec("lab-tour")} onToggle={on.sec}>
        {tour ? (
          <div>
            <KV k="Leader" v={(TOURNAMENT_MODELS.filter(function (m) { return m.key === tour.leader; })[0] || { name: "none yet" }).name} />
            <KV k="Transitions scored" v={tour.transitions} />
            <KV k="Promotable" v={tour.promotable ? "yes" : "not yet"} tone={tour.promotable ? "go" : "out"} />
            {bars.map(function (m) {
              return (
                <Row key={m.key} cols="minmax(0,1fr) 52px 46px">
                  <span className="nm">{m.name}</span>
                  <span className="rt">{m.spearman === null ? "—" : two(m.spearman)}</span>
                  <span className="rt dim">{m.mae === null ? "—" : one(m.mae)}</span>
                </Row>
              );
            })}
            <Reveal id="lab-tour-chart" label="Chart" open={!!ui.reveals["lab-tour-chart"]} onToggle={on.rev}>
              <div className="chartwrap cynt" style={{ height: "230px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
                    <XAxis type="number" stroke="currentColor" tick={{ fill: "currentColor", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={96} interval={0} stroke="currentColor" tick={{ fill: "currentColor", fontSize: 11 }} />
                    <Bar dataKey="rho" fill="currentColor" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>Rank correlation against what actually happened, averaged over the scored transitions. Higher is better.</div>
            </Reveal>
            <div className="note">{tour.note}</div>
            <div className="dim">Eight models score the next gameweek from data up to the last one. Promotion needs three transitions ahead, so the leader here drives nothing yet. <Tier k="model" /></div>
          </div>
        ) : null}
      </Section>

      <Section id="lab-ts" title="Team strength" open={sec("lab-ts")} onToggle={on.sec}>
        {tags ? (
          <div className="tbl">
            <Row head cols="44px 52px 52px 44px">
              <span>Team</span><span className="rt">GF xGF</span><span className="rt">GA xGA</span><span className="rt">Next 5</span>
            </Row>
            {tags.slice().sort(function (a, b) { return b.xgf - a.xgf; }).map(function (t) {
              return (
                <Row key={t.teamId} cols="44px 52px 52px 44px">
                  <span className="nm">{t.short_name}</span>
                  <span className={"rt " + (t.tagFor === "OVER" ? "warnt" : t.tagFor === "UNDER" ? "cynt" : "")}>{t.gf} {one(t.xgf)}</span>
                  <span className={"rt " + (t.tagAgainst === "OVER" ? "warnt" : t.tagAgainst === "UNDER" ? "cynt" : "")}>{t.ga} {one(t.xga)}</span>
                  <span className="rt dim">{one(runAvg(t.teamId, ctx.fixtures, 5))}</span>
                </Row>
              );
            })}
            <div className="dim">Amber is scoring or conceding above the chances, blue below. Next five is the official difficulty rating, kept only for this comparison: strength itself is built on expected goals. A team that conceded nothing from open chances once rated as the best defence in the league and inverted a captaincy call. <Tier k="model" /> xG · <Tier k="T0" /> goals</div>
          </div>
        ) : null}
      </Section>

      <Section id="lab-ledger" title="Decision ledger" open={sec("lab-ledger")} onToggle={on.sec}>
        {state.ledger.length ? state.ledger.slice(-12).map(function (r, i) {
          return (
            <Row key={i} cols="34px minmax(0,1fr) 46px">
              <span className="dim">{"GW" + r.gw}</span>
              <span className="nm">{r.type} {String(r.pick)}</span>
              <span className={"rt " + (Number(r.regret) > 0 ? "out" : "go")}>{r.regret === null ? "—" : one(r.regret)}</span>
            </Row>
          );
        }) : <div className="dim">Empty. Every recommendation shown here gets written down with its alternative, then scored against what happened, so regret is measured rather than remembered.</div>}
      </Section>

      <Section id="lab-export" title="Export" open={sec("lab-export")} onToggle={on.sec}>
        <div className="chips-r">
          <button className="btn" data-testid="export-download" onClick={function () { props.onDownload(json); }}><Download aria-hidden="true" />Download</button>
          {canCopy() ? <button className="btn" data-testid="export-copy" onClick={function () { props.onCopy(json).then(function (ok) { setCopied(ok ? "copied to the clipboard" : "the clipboard refused; use Download"); }); }}>Copy</button> : null}
        </div>
        {copied ? <div className="dim">{copied}</div> : null}
        <div className="dim">The repository is the permanent store: commit the exported file as the state of record. The app's own storage is per device and not linked to any drive.</div>
      </Section>

      <Section id="lab-import" title="Import" open={sec("lab-import")} onToggle={on.sec}>
        <textarea className="inp" data-testid="import-text" placeholder="Paste an exported state" aria-label="Exported state"
          value={imp} onChange={function (e) { setImp(e.target.value); }} />
        {imp.trim() ? <button className="btn btn-go" data-testid="import-apply" onClick={function () { props.onImport(imp); setImp(""); }}>Apply</button> : null}
        {props.importErr ? <div className="err">{props.importErr}</div> : null}
        <div className="dim">Anything unreadable is dropped rather than trusted: the squad is capped at fifteen and de-duplicated on id.</div>
      </Section>

      <Section id="lab-guide" title="Guide" open={sec("lab-guide")} onToggle={on.sec}>
        <div className="dim">
          <p>The first tab is the only screen you need before a deadline: it says what to do, by when, and what could spoil it. Everything else is the working behind it.</p>
          <p>Plan holds the transfer protocol, the wildcard fifteen, the captain table and the timing grid. Squad is your fifteen with selling prices and ownership. Rivals is the six leagues that can still be won. Draft is the other competition. Chips is what is left and when a window appears. Lab is the data, the models and the export.</p>
          <p>Six rules run underneath: sell only on no starts or a gain above four, captain the highest expected value in the eleven, pick the eleven on expected points, order the bench on who fails and what replaces him, play a chip on a window and never on impulse, and treat a player six in ten rivals already own as a way to lose a mini-league rather than win one.</p>
        </div>
      </Section>

      <Section id="lab-gloss" title="Glossary" open={sec("lab-gloss")} onToggle={on.sec}>
        <div className="dim">
          <KV k="xp1, xp5" v="Expected points, next match and next five" />
          <KV k="P(start)" v="Chance he starts, from starts and flags" />
          <KV k="xG, xGA" v="Chances created and allowed, not goals" />
          <KV k="EDGE, SHARED, DEAD" v="Rival ownership under a quarter, over seven in ten, no start in three" />
          <KV k="Margin" v="Gap to the next genuinely different plan" />
          <KV k="Regret" v="What holding cost against what using cost" />
          <KV k="Transition" v="One walk-forward gameweek scored by every model" />
          <div>Tiers: T0 is the official API, model is this app's own arithmetic on top of it.</div>
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ App */

const ENDPOINT = "https://api.anthropic.com/v1/messages";

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* The QA harness can serve an alternative snapshot on window.__MC_INLINE__; anything
   that is not a live snapshot is ignored and the built-in block stands. */
function initialLive() {
  try {
    const inj = typeof window !== "undefined" ? window.__MC_INLINE__ : null;
    if (inj && typeof inj === "object") {
      if (Array.isArray(inj.elements)) return inj;
      if (inj.live && Array.isArray(inj.live.elements)) return inj.live;
    }
  } catch (e) { /* the built-in block stands */ }
  return LIVE;
}

function shortErr(e) {
  return errMsg(e).slice(0, 140);
}

/* One attempt at the refresh call. Returns {ok, json} or {ok:false, retry, message}:
   only 429, 5xx, a timeout or a dropped connection are worth trying again. */
async function refreshAttempt(body) {
  let r;
  try {
    const ac = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ac ? setTimeout(function () { ac.abort(); }, 30000) : null;
    r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify(body),
      signal: ac ? ac.signal : undefined
    });
    if (timer) clearTimeout(timer);
  } catch (e) {
    return { ok: false, retry: true, message: "network: " + shortErr(e) };
  }
  let text = "";
  try { text = await r.text(); } catch (e) { text = ""; }
  if (!r.ok) {
    return { ok: false, retry: r.status === 429 || r.status >= 500, message: "HTTP " + r.status + " " + text.replace(/\s+/g, " ").trim() };
  }
  try { return { ok: true, json: JSON.parse(text) }; }
  catch (e) { return { ok: false, retry: false, message: "the reply was not JSON: " + text.slice(0, 80) }; }
}

export default function App() {
  const now = useNow();
  const [live, setLive] = React.useState(initialLive);
  const boot = useBoot(live);
  const state = boot.state, ui = boot.ui;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [refErr, setRefErr] = React.useState(null);
  const [okMsg, setOkMsg] = React.useState("");
  const [importErr, setImportErr] = React.useState(null);
  const [simLeague, setSimLeague] = React.useState(0);

  const ctx = React.useMemo(function () { return buildCtx(live, state, now); }, [live, state, now]);
  const plan = React.useMemo(function () { return buildPlan(ctx); }, [ctx]);

  const setUi = boot.setUi, setState = boot.setState;
  const on = React.useMemo(function () {
    return {
      sec: function (id) { setUi(function (u) { const o = {}; Object.keys(u.open).forEach(function (k) { o[k] = u.open[k]; }); o[id] = !openOf(u, u.tab, id); return { mode: u.mode, tab: u.tab, open: o, reveals: u.reveals }; }); },
      rev: function (id) { setUi(function (u) { const r = {}; Object.keys(u.reveals).forEach(function (k) { r[k] = u.reveals[k]; }); r[id] = !r[id]; return { mode: u.mode, tab: u.tab, open: u.open, reveals: r }; }); }
    };
  }, [setUi]);

  const goTab = React.useCallback(function (tab) { setUi(function (u) { return { mode: u.mode, tab: tab, open: u.open, reveals: u.reveals }; }); }, [setUi]);
  const setMode = React.useCallback(function (mode) { setMenuOpen(false); setUi(function (u) { return { mode: mode, tab: u.tab, open: u.open, reveals: u.reveals }; }); }, [setUi]);
  const jump = React.useCallback(function (sectionId) {
    setMenuOpen(false);
    setUi(function (u) {
      const o = {}; Object.keys(u.open).forEach(function (k) { o[k] = u.open[k]; });
      o[sectionId] = true;
      return { mode: "full", tab: "lab", open: o, reveals: u.reveals };
    });
  }, [setUi]);

  const onConfirm = React.useCallback(function () {
    setState(function (s) {
      const next = JSON.parse(JSON.stringify(s));
      const byId = {}; (live.elements || []).forEach(function (e) { byId[e.id] = e; });
      const cur = Number(live.current_event) || 0;
      const pk = live.picks ? live.picks[cur] || live.picks[String(cur)] : null;
      if (pk && Array.isArray(pk.picks)) {
        next.squad = pk.picks.map(function (p) {
          const was = s.squad.filter(function (q) { return q.id === p.element; })[0];
          const el = byId[p.element];
          return { id: p.element, purchase: was ? was.purchase : (el ? Number(el.now_cost) : null) };
        });
      }
      next.confirmed_gw = cur;
      return sanitiseState(next);
    });
  }, [live, setState]);

  const onLeague = React.useCallback(function (id) {
    setState(function (s) {
      const next = JSON.parse(JSON.stringify(s));
      next.draft.league_id = id;
      return sanitiseState(next);
    });
  }, [setState]);

  const onImport = React.useCallback(function (text) {
    setImportErr(null);
    try {
      const parsed = JSON.parse(text);
      const clean = sanitiseState(parsed);
      if (!clean.squad.length) throw new Error("no squad in that file");
      setState(clean);
    } catch (e) { setImportErr(shortErr(e)); }
  }, [setState]);

  const onDownload = React.useCallback(function (json) {
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "mc_state_gw" + ctx.nextEvent + ".json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    } catch (e) { /* a blocked download is not an error worth a panel */ }
  }, [ctx.nextEvent]);

  const onCopy = React.useCallback(function (json) {
    try { return navigator.clipboard.writeText(json).then(function () { return true; }, function () { return false; }); }
    catch (e) { return Promise.resolve(false); }
  }, []);

  const onPair = React.useCallback(function (pair) {
    setState(function (s) { const next = JSON.parse(JSON.stringify(s)); next.refresh.pair = pair; return sanitiseState(next); });
  }, [setState]);

  const onRefresh = React.useCallback(async function () {
    if (busy) return;
    setBusy(true); setRefErr(null); setOkMsg("");
    setMenuOpen(false);
    try {
      /* 1. the public endpoint first; the browser's origin rules block it, so this is
            expected to fail and the run carries on. */
      try {
        const ac = typeof AbortController === "function" ? new AbortController() : null;
        if (ac) setTimeout(function () { ac.abort(); }, 2500);
        await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", { signal: ac ? ac.signal : undefined });
      } catch (e) { /* expected */ }

      const watch = ctx.squadIds.concat(plan.kind === "wildcard" ? plan.ids : []);
      const ids = watch.filter(function (v, i) { return watch.indexOf(v) === i; });
      const body = refreshRequest({ pair: state.refresh.pair, ids: ids, names: ids.map(function (id) { return nameOf(ctx, id); }), nextEvent: ctx.nextEvent });
      let out = null, last = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        out = await refreshAttempt(body);
        if (out.ok) break;
        last = out.message;
        if (!out.retry) break;
        if (attempt < 2) await sleep(400 * Math.pow(3, attempt));
      }
      if (!out || !out.ok) throw new Error(last || "the refresh did not return anything");
      const json = out.json;
      /* A 200 that carries an error object instead of a message: the real message is
         the only useful thing in it, and pickText would otherwise report "no text in
         the reply" and bury it (D4 rule 5: the UI shows the real error). */
      if (json && (json.type === "error" || (json.error && typeof json.error === "object"))) {
        throw new Error(json.error && json.error.message ? String(json.error.message) : "the reply was an error object with no message");
      }
      const truncated = json && json.stop_reason === "max_tokens";
      const text = pickText(json && json.content ? json.content : json);
      if (!text) throw new Error("no text in the reply; blocks were " + blockTypes(json && json.content ? json.content : json));
      const parsed = parseJson(text);
      const nextLive = applyRefresh(live, parsed);
      setLive(nextLive);
      const r = nextLive.refreshed || { applied: 0, skipped: [] };
      setOkMsg("Applied " + r.applied + " update" + (r.applied === 1 ? "" : "s") + (r.skipped.length ? ", skipped " + r.skipped.length : "") + (truncated ? ". The reply hit the token ceiling and was cut short." : ""));
      setState(function (s) { const n = JSON.parse(JSON.stringify(s)); n.refresh.last = nowISO(); return sanitiseState(n); });
    } catch (e) {
      setRefErr(shortErr(e));
    } finally {
      setBusy(false);
    }
  }, [busy, ctx, plan, live, state.refresh.pair, setState]);

  const pct = gwProgress(ctx);
  const showLanding = ui.mode === "simple" || ui.tab === "command";
  const hist = (live.history && live.history.current) || [];
  const lastRow = hist.length ? hist[hist.length - 1] : null;
  const evNow = (ctx.events || []).filter(function (e) { return Number(e.id) === ctx.currentEvent; })[0];

  const body = function () {
    if (ui.mode === "simple") return null;
    if (ui.tab === "command") return <TabCommand ctx={ctx} ui={ui} on={on} />;
    if (ui.tab === "plan") return <TabPlan ctx={ctx} ui={ui} on={on} plan={plan} onConfirm={onConfirm} />;
    if (ui.tab === "squad") return <TabSquad ctx={ctx} ui={ui} on={on} onConfirm={onConfirm} />;
    if (ui.tab === "rivals") return <TabRivals ctx={ctx} ui={ui} on={on} plan={plan} simLeague={simLeague} onSimLeague={setSimLeague} onConfirm={onConfirm} />;
    if (ui.tab === "draft") return <TabDraft ctx={ctx} ui={ui} on={on} state={state} onLeague={onLeague} />;
    if (ui.tab === "chips") return <TabChips ctx={ctx} ui={ui} on={on} plan={plan} onConfirm={onConfirm} />;
    return <TabLab ctx={ctx} ui={ui} on={on} state={state} onDownload={onDownload} onCopy={onCopy} onImport={onImport} importErr={importErr}
      refresh={{ busy: busy, err: refErr, okMsg: okMsg, onRefresh: onRefresh, onPair: onPair }} />;
  };

  return (
    <div className="mc-root" data-tokens={TOKENS.length} data-mode={ui.mode} data-tab={ui.tab} data-gw={ctx.nextEvent}>
      <style>{STYLE}</style>
      <Header ctx={ctx} onRefresh={onRefresh} onMenu={function () { setMenuOpen(!menuOpen); }} menuOpen={menuOpen} busy={busy} />
      {busy ? <div className="refbar" data-testid="refbar"><i /></div> : null}
      <div className="gwbar" data-testid="gwbar" data-pct={pct} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Gameweek progress"><i style={{ width: pct + "%" }} /></div>
      {menuOpen ? <Menu mode={ui.mode} onMode={setMode} onJump={jump} /> : null}
      {ui.mode === "full" ? <Tabs tab={ui.tab} onTab={goTab} /> : null}
      <div className="wrap">
        {refErr ? <div className="err" data-testid="err">{refErr}</div> : null}
        <Boundary key={ui.mode + ui.tab}>
          {showLanding ? (
            <div>
              <GwActionCard plan={plan} ctx={ctx} mode={ui.mode} reveals={ui.reveals} onReveal={on.rev} onConfirm={onConfirm} />
              <div className="note" data-testid="standing">
                Rank {grp(live.entry ? live.entry.summary_overall_rank : 0)}, {live.entry ? live.entry.summary_overall_points : 0} points.
                {" GW" + ctx.currentEvent + " scored " + (lastRow ? lastRow.points : "—") + " against " + (evNow ? evNow.average_entry_score : "—") + "."}
              </div>
            </div>
          ) : null}
          {body()}
        </Boundary>
      </div>
    </div>
  );
}

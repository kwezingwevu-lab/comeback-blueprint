import React from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Crosshair, ClipboardList, Shield, Users, Layers, Zap, FlaskConical, RefreshCw, Ellipsis, ChevronRight, TriangleAlert, Check, Download, Upload, BookOpen, ListChecks, Percent, History } from "lucide-react";

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
  { id: "odds", label: "Odds", Icon: Percent },
  { id: "review", label: "Review", Icon: History },
  { id: "lab", label: "Lab", Icon: FlaskConical }
];

const TOKENS = ["--bg", "--bg2", "--bg3", "--line", "--text", "--dim", "--mute", "--grn", "--grn2", "--pnk", "--pnk2", "--amb", "--cyn", "--blu", "--pur", "--wht", "--shadow", "--focus", "--ok", "--warn", "--err"];

const PRIMARY = { command: "cmd-stand", plan: "plan-solved", squad: "sq-fifteen", rivals: "rv-table", draft: "df-claims", chips: "ch-now", odds: "od-next", review: "rw-classic", lab: "lab-data" };

const STYLE = `
:root{--sat:env(safe-area-inset-top,0px);--sar:env(safe-area-inset-right,0px);--sab:env(safe-area-inset-bottom,0px);--sal:env(safe-area-inset-left,0px)}
.mc-root{
  --bg:#0b0e13; --bg2:#131822; --bg3:#1b2130; --line:#28303e; --text:#e9eef6; --dim:#a2adbe;
  --mute:#8692a6; --grn:#42dda0; --grn2:#1d7a59; --pnk:#ff5f8d; --pnk2:#7c2542; --amb:#ffb84d;
  --cyn:#4fd1e0; --blu:#5d8cf0; --pur:#a98bfb; --wht:#ffffff; --shadow:#00000099; --focus:#7aa2ff;
  --ok:#42dda0; --warn:#ffb84d; --err:#ff5f8d;
  background:var(--bg); color:var(--text); min-height:100vh; min-height:100svh; padding:0 0 calc(44px + var(--sab));
  -webkit-tap-highlight-color:transparent;
  font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  -webkit-font-smoothing:antialiased; -webkit-text-size-adjust:100%;
}
.mc-root::before{content:"";position:fixed;left:0;right:0;top:0;height:var(--sat);background:var(--bg2);z-index:5}
.mc-root *{box-sizing:border-box; font-size:inherit}
.mc-root button,.mc-root select,.mc-root input,.mc-root textarea{font-family:inherit;color:inherit}
.wrap{max-width:720px;margin:0 auto;padding:0 max(12px,var(--sar)) 0 max(12px,var(--sal))}

.hdr{display:flex;align-items:flex-start;gap:8px;padding:calc(12px + var(--sat)) max(12px,var(--sar)) 8px max(12px,var(--sal));border-bottom:1px solid var(--line);background:var(--bg2)}
.hdr-l{flex:1 1 auto;min-width:0}
.hdr h1{margin:0;font-size:16px;font-weight:700;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status{display:flex;flex-wrap:wrap;gap:10px;margin-top:3px;font-size:11px;color:var(--dim)}
.status b{color:var(--text);font-weight:600}
.hdr-r{display:flex;gap:12px;flex:none}
.gwbar{position:relative;height:3px;background:var(--bg3);overflow:hidden}
.gwbar i{display:block;height:100%;background:var(--grn2)}
.refbar{height:3px;background:var(--bg3);overflow:hidden}
.refbar i{display:block;height:100%;width:40%;background:var(--cyn);animation:sl 1.1s linear infinite}
@keyframes sl{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}

.tabs{display:flex;gap:2px;padding:6px 4px;background:var(--bg2);border-bottom:1px solid var(--line);position:sticky;top:var(--sat);z-index:4;
  overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.tabs{padding-left:max(4px,var(--sal));padding-right:max(4px,var(--sar))}
.tabs::-webkit-scrollbar{width:0;height:0}
.tabi{flex:1 1 0;min-width:36px;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  background:var(--bg3);border:1px solid var(--line);border-radius:10px;color:var(--dim);font-size:11px;cursor:pointer;padding:4px 0}
.tabi svg{width:19px;height:19px}
.tabi[aria-current="true"]{color:var(--text);border-color:var(--grn2);background:var(--bg)}
.tabi[aria-current="true"] svg{color:var(--grn)}
.tabi span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.btn{min-height:44px;padding:8px 14px;border-radius:9px;border:1px solid var(--line);background:var(--bg3);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn-go{background:var(--grn2);border-color:var(--grn);color:var(--wht)}
.btn-sm{min-height:32px;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg3);color:var(--text);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px}
.btn-ic{width:44px;min-height:44px;padding:0}
.btn-ic svg{width:18px;height:18px}
.btn:disabled,.btn-sm:disabled{opacity:.5}
.inp{min-height:44px;width:100%;padding:8px 10px;border-radius:9px;border:1px solid var(--mute);background:var(--bg);color:var(--text);font-size:16px}
textarea.inp{min-height:88px;line-height:1.4;resize:vertical}

.card{background:var(--bg2);border:1px solid var(--line);border-radius:14px;margin:12px 0;overflow:hidden}
.section{background:var(--bg2);border:1px solid var(--line);border-radius:12px;margin:10px 0;overflow:hidden;scroll-margin-top:calc(73px + var(--sat))}
.sec-h{min-height:48px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:10px 12px;background:var(--bg2);border:0;border-bottom:1px solid var(--line);color:var(--text);font-size:14px;font-weight:600;text-align:left;cursor:pointer}
.sec-h .cv{flex:none;color:var(--dim);transition:transform .15s ease}
.sec-h[aria-expanded="true"] .cv{transform:rotate(90deg)}
.sec-h svg{width:16px;height:16px}
.sec-b{padding:10px 12px 14px}
.sec-b>*+*{margin-top:9px}

.reveal{width:100%;min-height:44px;display:flex;align-items:center;gap:6px;padding:6px 0;background:none;border:0;color:var(--dim);font-size:12px;text-align:left;cursor:pointer}
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
/* iOS 27 · the storage and update notes sit above every view (IOS27-04, -05, -07, -10) */
.notes{margin-top:10px}
.notes>*+*{margin-top:8px}
.upd{width:100%;border-color:var(--warn)}
/* iOS 27 · IOS27-08: a section a menu jump scrolls to stops below the pinned tab strip (65px: 6 + 52 + 6 + its 1px edge)
   with 8px to spare, and below the status-bar inset in the Home Screen app. IOS27-11: .vh keeps a node in the accessibility
   tree and off the screen (the one status region). IOS27-14: the file picker is a real input laid over its 44px label
   button, invisible, so the tap lands on the input itself and a screen reader gets a full-size frame; the label's border
   is the edge people see, and its focus ring shows when the input has focus. */
.vh{position:absolute;width:1px;height:1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.filebtn{position:relative;overflow:hidden}
.filebtn input{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px}
.filebtn:focus-within{outline:2px solid var(--focus);outline-offset:2px}
.err{font-size:12px;line-height:1.45;color:var(--text);padding:9px 10px;background:var(--pnk2);border:1px solid var(--pnk);border-radius:9px;word-break:break-word}
.boundary{margin:12px;padding:14px;border:1px solid var(--pnk);background:var(--pnk2);border-radius:12px;font-size:13px}
/* C2: --dim was never sized against --pnk2 (3.74 at 11px). On these three surfaces the
   quiet grey becomes --text (8.19). The token is untouched; its other 12 usages keep it. */
.block .dim,.err .dim,.boundary .dim{color:var(--text)}

.row{min-height:38px;display:grid;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12px}
.row:last-child{border-bottom:0}
.row-h{min-height:38px;color:var(--mute);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.row-h>*{min-width:0;overflow-wrap:anywhere}
.row .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.row .rt{text-align:right;font-variant-numeric:tabular-nums}
.kv{display:flex;align-items:baseline;justify-content:space-between;gap:10px;min-height:38px;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px}
.kv:last-child{border-bottom:0}
.kv .k{color:var(--dim);font-size:12px;min-width:0;overflow-wrap:anywhere}
.kv .v{text-align:right;font-variant-numeric:tabular-nums;min-width:0;overflow-wrap:anywhere}
.tbl{overflow-x:auto;-webkit-overflow-scrolling:touch}

.dim{color:var(--dim);font-size:11px;line-height:1.5}
.tier{color:var(--mute);font-size:11px;letter-spacing:.04em}
.go{color:var(--grn)}
.out{color:var(--pnk)}
.warnt{color:var(--warn)}
.cynt{color:var(--cyn)}
.put{color:var(--pur)}
.blut{color:var(--blu)}
.tag{display:inline-block;max-width:100%;padding:1px 6px;border-radius:6px;font-size:11px;border:1px solid var(--line);background:var(--bg);color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row>.tag{text-align:center}
.tag-e{border-color:var(--grn2);color:var(--grn)}
.tag-s{border-color:var(--line);color:var(--blu)}
.tag-d{border-color:var(--pnk2);color:var(--pnk)}
.meter{height:6px;border-radius:4px;background:var(--bg);overflow:hidden;border:1px solid var(--mute)}
.meter i{display:block;height:100%;background:var(--cyn)}
.chips-r{display:flex;flex-wrap:wrap;gap:12px}

.menu{position:absolute;right:max(10px,var(--sar));top:calc(70px + var(--sat));z-index:9;min-width:190px;background:var(--bg3);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px var(--shadow);overflow:hidden}
.menu-i{min-height:44px;width:100%;display:flex;align-items:center;gap:8px;padding:10px 12px;background:none;border:0;border-bottom:1px solid var(--line);color:var(--text);font-size:13px;text-align:left;cursor:pointer}
.menu-i:last-child{border-bottom:0}
.menu-i[aria-current="true"]{color:var(--grn)}
.menu-i svg{width:15px;height:15px;color:var(--dim)}
.mhead{padding:7px 12px;font-size:11px;color:var(--mute);text-transform:uppercase;letter-spacing:.08em;background:var(--bg2)}

.mc-root button:active,.mc-root select:active,.mc-root input:active,.mc-root textarea:active,
.btn:active,.btn-sm:active,.tabi:active,.sec-h:active,.menu-i:active,.inp:active,.reveal:active{transform:scale(.97)}
.mc-root button,.mc-root .tabi,.mc-root .sec-h,.mc-root .menu-i,.mc-root .reveal{transition:transform .08s ease,background .12s ease,color .12s ease}
.mc-root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.tabi,.btn,.btn-sm,.btn-ic,.sec-h,.menu-i,.reveal{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
@media (prefers-reduced-motion: reduce){
  .mc-root,.mc-root *,.mc-root *::before,.mc-root *::after{transition:none !important;animation:none !important;scroll-behavior:auto !important}
  .mc-root button:active,.mc-root select:active,.mc-root input:active,.mc-root textarea:active,
  .mc-root .btn:active,.mc-root .btn-sm:active,.mc-root .tabi:active,.mc-root .sec-h:active,.mc-root .menu-i:active,.mc-root .inp:active,.mc-root .reveal:active{transform:none}
  .mc-root .btn:not(.btn-go):active,.mc-root .btn-sm:active,.mc-root .tabi:active,.mc-root .sec-h:active,.mc-root .menu-i:active,.mc-root .reveal:active{background:var(--line)}
  .mc-root .btn-go:active{border-color:var(--wht)}
}
/* Increase Contrast: the same token names, raised. --dim and --mute reach 7:1 on --bg3 and --line reaches 3:1 on --bg3
   (so on --bg2 too). qa/visual.cjs reads this block, allows hex only here and in the base token block, and accepts
   only names from the 21-token list. */
@media (prefers-contrast: more){
  .mc-root{--dim:#c6cdd7; --mute:#a7b0be; --line:#5c6f8f}
}
/* Forced colours: the system draws the colours, so a control that has no border must keep an edge of its own. */
@media (forced-colors: active){
  .reveal,.sec-h,.menu-i{outline:1px solid var(--line);outline-offset:-1px}
}
.mini{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--dim);line-height:1.5;grid-column:1 / -1}
.mini b{color:var(--text);font-weight:600}
.chartwrap{width:100%}
.reveal-w{margin-top:2px}
.sec-b p{margin:0 0 8px}
.sec-b p:last-child{margin-bottom:0}
@media (max-width:380px){ .tabi{min-width:30px;font-size:11px;padding:4px 0} .tabi span{display:none} .wrap{padding-left:max(10px,var(--sal));padding-right:max(10px,var(--sar))} }
/* v110 interface — START */
/* The v110 interface wave appends here, one comment-delimited block per item, below this line and above the END
   marker. Colour only through var(--token); the 11px type floor and the Part G touch floors hold in every rule. */
/* v110 D2 · the solved Classic plan (TabPlan, plan-solved) — START */
.pstrip{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.pst{display:flex;flex-direction:column;gap:1px;min-width:0;padding:7px 9px;background:var(--bg3);border:1px solid var(--line);border-radius:9px}
.pst-k,.pst-s{font-size:11px;line-height:1.35;color:var(--dim);overflow-wrap:anywhere}
.pst-v{font-size:17px;line-height:1.25;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.pwk{min-width:0;white-space:normal;overflow-wrap:anywhere;font-size:12px}
@media (min-width:600px){ .pstrip{grid-template-columns:repeat(4,minmax(0,1fr))} }
/* v110 D2 · the solved Classic plan — END */
/* v110 D3 · the Draft tab (TabDraft: df-claims, df-solved, df-pool, df-trades) — START */
.dfv>*+*{margin-top:8px}
.dfln{min-width:0;white-space:normal;overflow-wrap:anywhere;font-size:13px}
.dfhow{min-width:0;font-size:11px;line-height:1.3;white-space:normal;overflow-wrap:anywhere}
/* v110 D3 · the Draft tab — END */
/* v110 D1 · Today: the landing card and the Command tab (GwActionCard, TabCommand: cmd-next, cmd-notes) — START */
.todo{width:100%;min-height:44px;display:grid;grid-template-columns:22px minmax(0,1fr);column-gap:8px;row-gap:2px;align-items:start;margin-top:6px;
  padding:8px 10px;background:var(--bg3);border:1px solid var(--line);border-radius:9px;color:var(--text);font-size:13px;line-height:1.4;text-align:left;cursor:pointer}
.todo-box{grid-row:1 / span 2;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:1px solid var(--mute);border-radius:5px;background:var(--bg)}
.todo-box svg{width:14px;height:14px}
.todo.on .todo-box{background:var(--grn2);border-color:var(--grn);color:var(--wht)}
.todo-t{min-width:0;overflow-wrap:anywhere}
.todo.on .todo-t{color:var(--dim)}
.todo-d{grid-column:2;min-width:0;font-size:11px;line-height:1.35;color:var(--dim);font-variant-numeric:tabular-nums}
.cmdn{font-size:12px;line-height:1.5;color:var(--text);overflow-wrap:anywhere}
.cmdl{margin:0;padding-left:18px;font-size:12px;line-height:1.5;color:var(--text);overflow-wrap:anywhere}
.cmdl li+li{margin-top:5px}
/* v110 D1 · Today — END */
/* v110 D6 · the Lab: method, limits, dated sources (TabLab: lab-method, lab-backtest, lab-limits, lab-sources) — START */
.labl{margin:6px 0 0;padding-left:18px;font-size:12px;line-height:1.5;color:var(--text);overflow-wrap:anywhere}
.labl li+li{margin-top:6px}
.labl b{font-weight:600}
.labt{margin-top:10px}
.labn{margin-top:10px;font-size:12px;line-height:1.5;color:var(--text);overflow-wrap:anywhere}
.labn>div+div{margin-top:6px}
/* v110 D6 · the Lab — END */
/* v110 interface — END */
`;

/* ------------------------------------------------------------------ storage adapter
   Anthropic documents artifact storage as text only, so the adapter writes JSON text and reads it back
   (an object saved by an older build still loads). The dist shim over localStorage keeps the same text, byte for
   byte what the plain-localStorage fallback writes. Every write is queued, so results arrive in the order the writes
   were made, and the first save of mc_ui is read back and compared: that sets storeMode, "artifact" or "local" when the
   copy came back and "none" when it did not (no new storage key). Both paths are total: a broken store degrades to an
   unsaved session, and the app says so. */

const STORE_KEYS = { state: "mc_state", ui: "mc_ui" };

/* text → object; an unreadable value or anything that is not an object is null, so the app reseeds instead of crashing */
function decodeStored(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    let o;
    try { o = JSON.parse(v); } catch (e) { return null; }
    if (typeof o === "string") { try { o = JSON.parse(o); } catch (e) { return null; } }   // text that was quoted once more
    return o && typeof o === "object" ? o : null;
  }
  return typeof v === "object" ? v : null;
}
function sortedJson(v) {
  try {
    return JSON.stringify(v, function (k, x) {
      if (x && typeof x === "object" && !Array.isArray(x)) { const o = {}; Object.keys(x).sort().forEach(function (q) { o[q] = x[q]; }); return o; }
      return x;
    });
  } catch (e) { return ""; }
}
/* the short reason a write failed, in words a manager can act on; e is a DOMException, an Error or the shim's {name, message} */
function whyNot(e) {
  const n = e && e.name ? String(e.name) : "", m = e && e.message ? String(e.message) : "";
  if (/quota/i.test(n + " " + m)) return "storage is full";
  if (/security|denied|not allowed|blocked/i.test(n + " " + m)) return "storage is blocked here";
  const t = (m || n).replace(/\s+/g, " ").replace(/[.\s]+$/, "").slice(0, 60);
  return t || "storage refused the write";
}
/* "artifact" (the host's own window.storage), "local" (localStorage, directly or through the dist shim), "none", or "pending" */
let storeMode = "pending";
let storeQueue = Promise.resolve();
let persistAsked = false;

function windowStore() {
  try { return typeof window !== "undefined" && window.storage ? window.storage : null; } catch (e) { return null; }
}
/* navigator.storage.persist() asks the browser to keep the copy through storage pressure; where it does not exist there is nothing to ask */
function askForPersistence() {
  if (persistAsked) return;
  try {
    if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.persist === "function") {
      persistAsked = true;
      const p = navigator.storage.persist();
      if (p && typeof p.then === "function") p.then(function () {}, function () {});
    }
  } catch (e) { /* the request is a courtesy */ }
}
async function readBack(key, via) {
  try {
    if (via === "window") {
      const r = await windowStore().get(key);
      if (r === null || r === undefined) return null;
      return decodeStored(r && typeof r === "object" && "value" in r ? r.value : r);
    }
    return decodeStored(window.localStorage.getItem(key));
  } catch (e) { return null; }
}

const store = {
  async get(key) {
    try {
      const S = windowStore();
      if (S && typeof S.get === "function") {
        const r = await S.get(key);
        if (r === null || r === undefined) return null;
        return decodeStored(r && typeof r === "object" && "value" in r ? r.value : r);
      }
    } catch (e) { /* fall through to localStorage */ }
    try { return decodeStored(window.localStorage.getItem(key)); } catch (e) { return null; }
  },
  /* resolves { ok, reason, mode } and never rejects: reason is empty on success, mode is storeMode after this write */
  set(key, value) {
    const run = async function () {
      try {
        let text;
        try { text = JSON.stringify(value); } catch (e) { text = undefined; }
        if (typeof text !== "string") return { ok: false, reason: "the data could not be written as text", mode: storeMode };
        const S = windowStore();
        let via = "", reason = "", tryLocal = !(S && typeof S.set === "function");
        if (!tryLocal) {
          try {
            const r = await S.set(key, text);
            if (r === false) reason = whyNot(S.__error);   // the dist shim says no, and says why
            else via = "window";
          } catch (e) { reason = whyNot(e); tryLocal = true; }
        }
        if (tryLocal) {
          try { window.localStorage.setItem(key, text); via = "local"; reason = ""; } catch (e) { reason = whyNot(e); }
        }
        const ok = via !== "";
        if (ok && key === STORE_KEYS.ui && (storeMode === "pending" || storeMode === "none")) {
          const back = await readBack(key, via);
          storeMode = back && sortedJson(back) === sortedJson(value) ? (via === "window" && !S.__shim ? "artifact" : "local") : "none";
        } else if (!ok && storeMode === "pending") storeMode = "none";
        if (ok && storeMode === "local") askForPersistence();
        return { ok: ok, reason: ok ? "" : reason, mode: storeMode };
      } catch (e) { return { ok: false, reason: whyNot(e), mode: storeMode }; }
    };
    const p = storeQueue.then(run);
    storeQueue = p.then(function () {}, function () {});
    return p;
  }
};

/* Where the page came from, read from what the page has and never from the user agent. The dist build's shim marks
   window.storage; the artifact host never does. */
function hostIsDist() {
  try { return !!(typeof window !== "undefined" && window.storage && window.storage.__shim); } catch (e) { return false; }
}
/* Installed to the Home Screen. iOS reports fullscreen where a manifest asks for standalone (WebKit bug 264218), so both
   display modes count, and navigator.standalone is Apple's own flag. */
function runsAsApp() {
  try {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches) return true;
    return typeof navigator !== "undefined" && "standalone" in navigator && navigator.standalone === true;
  } catch (e) { return false; }
}
/* the registration script in the page sets this when a newer worker has taken over or is waiting */
function pwaUpdated() {
  try { return !!(typeof window !== "undefined" && window.__PWA__ && window.__PWA__.updated === true); } catch (e) { return false; }
}
/* Reload into the new build. A waiting worker is told to take over first and the reload follows its controllerchange
   (or two seconds, whichever is first), so the old cache is gone when the new page asks for it. Nothing to reload
   without a worker or a location: the state is saved on every change, so a reload loses nothing. */
function reloadIntoNewBuild() {
  const go = function () { try { window.location.reload(); } catch (e) { /* nothing to reload */ } };
  try {
    const sw = navigator.serviceWorker;
    if (!sw || typeof sw.getRegistration !== "function") { go(); return; }
    sw.getRegistration().then(function (reg) {
      const w = reg && reg.waiting;
      if (!w) { go(); return; }
      let done = false;
      const once = function () { if (done) return; done = true; go(); };
      try { sw.addEventListener("controllerchange", once); } catch (e) { /* the timer below covers it */ }
      try { w.postMessage({ type: "SKIP_WAITING" }); } catch (e) { once(); return; }
      setTimeout(once, 2000);
    }, go);
  } catch (e) { go(); }
}
/* The dist build's refresh: ask the server for a newer worker. "reload" means there is no worker to ask (file://, an
   engine without service workers), so the only way to pick up a replaced file is to load the page again. "new" means a
   newer build was found (the note in the page offers the reload), "same" means the server has nothing newer. */
async function checkForNewBuild() {
  const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : null;
  if (!sw || typeof sw.getRegistration !== "function") return "reload";
  const reg = await sw.getRegistration();
  if (!reg || typeof reg.update !== "function") return "reload";
  const before = pwaUpdated();
  let timer = null;
  await Promise.race([
    reg.update(),
    new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error("the server did not answer in 15 seconds")); }, 15000); })
  ]).then(function () { if (timer) clearTimeout(timer); }, function (e) { if (timer) clearTimeout(timer); throw e; });
  return reg.installing || reg.waiting || (pwaUpdated() && !before) ? "new" : "same";
}

/* iOS 27 · IOS27-08. Where a tab switch or a menu jump lands. With no section id the page goes back to the top, so the
   new tab's first section sits just under the tab strip; with one, that section is scrolled to the top of the
   viewport (STYLE .section{scroll-margin-top} keeps it clear of the pinned strip and the status-bar inset) and its
   header takes focus without a second scroll. Window scrolling only. Ids are the app's own, so the selector is safe.
   Older Safari that ignores scroll-margin lands the section under the strip by at most the strip's height; one that
   ignores preventScroll finds the header already in view. Total: any failure leaves the page where it is. */
function landOn(sectionId) {
  try {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const s = sectionId ? document.querySelector('[data-section="' + sectionId + '"]') : null;
    if (!s) { window.scrollTo(0, 0); return; }
    if (typeof s.scrollIntoView === "function") s.scrollIntoView({ block: "start" });
    const h = s.querySelector(".sec-h");
    if (h && typeof h.focus === "function") h.focus({ preventScroll: true });
  } catch (e) { /* the page stays where it is */ }
}

/* iOS 27 · IOS27-11. What a settled refresh says out loud, built from the game week the app is on (never a typed one).
   80 characters at most: "Refresh failed: " and the first 60 characters of the reason. In the dist build the refresh is a
   check for a newer build, so its outcomes are worded for that: okMsg is the "Nothing newer" note the check leaves when
   the server holds no newer build, and a check that ended with neither an error nor that note found one. */
function refreshMessage(err, dist, okMsg, gw) {
  if (err) return "Refresh failed: " + String(err).replace(/\s+/g, " ").trim().slice(0, 60);
  if (dist) return okMsg ? "Nothing newer. GW" + gw + " data is the latest." : "A newer build was found.";
  return "Refreshed, GW" + gw + " data";
}
/* Safari 27 speaks through ariaNotify; where it exists it is called once and the status region stays empty. The
   caller writes the region only when this returns false, so exactly one path speaks. */
function ariaSpeak(msg) {
  try {
    const b = typeof document !== "undefined" ? document.body : null;
    if (b && typeof b.ariaNotify === "function") { b.ariaNotify(msg); return true; }
  } catch (e) { /* the status region carries it */ }
  return false;
}

/* iOS 27 · IOS27-14. The export as one file for the share sheet, where the platform will take it. canShareFiles() only
   asks; tryShare() starts the share from the tap itself (share() needs the tap's transient activation, so it is called
   before any await) and answers a promise, or null when there is no sheet to open, so the caller can download in the
   same tick. A refused share falls back to the download; closing the sheet (AbortError) is an answer, not a failure. */
function canShareFiles() {
  try {
    if (typeof File !== "function" || typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    return !!navigator.canShare({ files: [new File(["{}"], "mc_state.json", { type: "application/json" })] });
  } catch (e) { return false; }
}
function tryShare(json, name) {
  try {
    if (typeof File !== "function" || typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return null;
    const f = new File([json], name, { type: "application/json" });
    if (!navigator.canShare({ files: [f] })) return null;
    return navigator.share({ files: [f], title: "FPL MC state" }).then(function () { return true; }, function (e) { return !!(e && e.name === "AbortError"); });
  } catch (e) { return null; }
}
function saveAsFile(json, name) {
  try {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  } catch (e) { /* a blocked download is not an error worth a panel */ }
}
/* File.text() where it exists (Safari 14 and later), a FileReader before that. */
function readFileText(file) {
  if (file && typeof file.text === "function") return file.text();
  return new Promise(function (resolve, reject) {
    try {
      const r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(r.error || new Error("the file could not be read")); };
      r.readAsText(file);
    } catch (e) { reject(e); }
  });
}

/* iOS 27 · IOS27-15. What this device says about itself, read when the readout draws and never typed. Every field is a
   feature read that answers "n/a" where its API is missing; nothing reads the user agent. The safe-area probe reads the
   same custom properties the layout consumes (--sat and its three siblings, which hold env(safe-area-inset-*)), so it
   shows what the layout got. The display-mode queries are asked one by one because this is a diagnostic: it shows which
   of them the Home Screen app matches (iOS reports fullscreen where a manifest asks for standalone) and decides nothing;
   runsAsApp() decides, and asks for standalone and fullscreen together. Rows are [label, text] pairs. */
function bytesText(n) {
  const v = Number(n);
  if (!isFinite(v) || v < 0) return "n/a";
  if (v < 1000) return Math.round(v) + " B";
  if (v < 1e6) return Math.round(v / 1e3) + " kB";
  if (v < 1e9) return (v / 1e6).toFixed(1) + " MB";
  return (v / 1e9).toFixed(1) + " GB";
}
function readDevice(mode, mem) {
  const NA = "n/a";
  const w = typeof window !== "undefined" && window ? window : null;
  const nav = typeof navigator !== "undefined" && navigator ? navigator : null;
  const fin = function (v) { return typeof v === "number" && isFinite(v); };
  const size = function (a, b) { return fin(a) && fin(b) ? a + "×" + b : NA; };
  const mq = function (q) { try { return w && typeof w.matchMedia === "function" ? !!w.matchMedia(q).matches : null; } catch (e) { return null; } };
  const yn = function (v) { return v === null ? NA : v ? "yes" : "no"; };
  const has = function (f) { try { return f() ? "yes" : "no"; } catch (e) { return "no"; } };
  let insets = NA;
  try {
    if (typeof document !== "undefined" && document.body && w && typeof w.getComputedStyle === "function") {
      const p = document.createElement("div");
      p.setAttribute("aria-hidden", "true");
      p.style.cssText = "position:absolute;visibility:hidden;width:0;height:0;padding:var(--sat) var(--sar) var(--sab) var(--sal)";
      document.body.appendChild(p);
      const cs = w.getComputedStyle(p);
      const v = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
      document.body.removeChild(p);
      if (v.every(function (x) { return /^-?\d+(\.\d+)?px$/.test(x); })) insets = "top " + v[0] + " · right " + v[1] + " · bottom " + v[2] + " · left " + v[3];
    }
  } catch (e) { insets = NA; }
  /* the modes are queried one by one, the string built here so no query stands alone in the source as a decision */
  const modes = ["standalone", "fullscreen", "browser"].map(function (m) { return m + " " + yn(mq("(display-mode: " + m + ")")); }).join(" · ");
  const pref = function (feature, values) {
    for (let i = 0; i < values.length; i++) if (mq("(" + feature + ": " + values[i][0] + ")") === true) return values[i][1];
    return NA;
  };
  const sw = w && w.__PWA__ && typeof w.__PWA__.sw === "string" && w.__PWA__.sw ? w.__PWA__.sw : NA;
  const m = typeof mode === "string" && ["artifact", "local", "none", "pending"].indexOf(mode) >= 0 ? mode : NA;
  const mm = mem && typeof mem === "object" ? mem : {};
  return [
    ["Window", w ? size(w.innerWidth, w.innerHeight) : NA],
    ["Screen", w && w.screen ? size(w.screen.width, w.screen.height) : NA],
    ["Pixel ratio", w && fin(w.devicePixelRatio) ? String(w.devicePixelRatio) : NA],
    ["Safe area", insets],
    ["Display mode", modes],
    ["navigator.standalone", nav && "standalone" in nav ? String(nav.standalone === true) : NA],
    ["Storage mode", m],
    ["Persistent storage", typeof mm.persisted === "string" ? mm.persisted : NA],
    ["Storage used", typeof mm.usage === "string" ? mm.usage : NA],
    ["Service worker", sw],
    ["ariaNotify", has(function () { return typeof document !== "undefined" && document.body && typeof document.body.ariaNotify === "function"; })],
    ["Share sheet for files", canShareFiles() ? "yes" : has(function () { return typeof nav.share === "function"; }) === "yes" ? "share only" : "no"],
    ["storage.persist()", has(function () { return typeof nav.storage.persist === "function"; })],
    ["Contrast", pref("prefers-contrast", [["more", "more"], ["less", "less"], ["custom", "custom"], ["no-preference", "no preference"]])],
    ["Reduced motion", pref("prefers-reduced-motion", [["reduce", "reduce"], ["no-preference", "no preference"]])],
    ["Colour scheme", pref("prefers-color-scheme", [["dark", "dark"], ["light", "light"]])]
  ];
}

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
/* hoursText is a magnitude and never a state: it says how long, and each call site says
   what that length is. Returning the bare word "closed" from here put "closed to deadline"
   in the header and "closed left, nobody flagged" on the landing the moment a deadline
   passed, because every call site appended its own suffix. The three phrases below are
   complete on their own. */
function hoursText(h) {
  if (h === null || h === undefined || !isFinite(h)) return "—";
  const a = Math.abs(h);
  if (a < 1) return Math.max(1, Math.round(a * 60)) + "min";
  if (a < 48) return Math.round(a) + "h";
  return Math.round(a / 24) + "d";
}
function deadlineLine(h) {
  if (h === null || h === undefined || !isFinite(h)) return "deadline unknown";
  return h < 0 ? "deadline closed" : hoursText(h) + " to deadline";
}
function leftLine(h) {
  if (h === null || h === undefined || !isFinite(h)) return "time unknown";
  return h < 0 ? "closed" : hoursText(h) + " left";
}
/* Age is elapsed time and has no closed state: a snapshot stamped ahead of the clock is
   simply fresh. */
function ageText(h) {
  if (h === null || h === undefined || !isFinite(h)) return "—";
  return h < 0 ? "fresh" : hoursText(h);
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
  const st = { version: 88, exported_at: null, entry: null, squad: [], bank: 0, ft: 1, value: 0, confirmed_gw: 0, leagues: [], draft: { league_id: null, roster: [], watchlist: [] }, ui: { mode: "simple", tab: "command", open: {}, reveals: {} }, ledger: [], refresh: { pair: "sonnet46", last: null }, market: {} };
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

/* C1 rule 6 keeps anyone at or above 60% rival ownership out of the wildcard solver, so
   the engine's fifteen can differ from the fifteen the manager wrote down almost wholesale.
   Shipping that difference without naming the rule that caused it is the silent
   reprogramming the standing rules forbid, so the landing carries one line: the rule, and
   the two heaviest exclusions, with their numbers. The full pricing is on the Plan tab. */
function andList(names) {
  const a = (Array.isArray(names) ? names : [])
    .filter(function (v) { return typeof v === "string" ? v !== "" : (typeof v === "number" && isFinite(v)); })
    .map(String);
  if (!a.length) return "";
  if (a.length === 1) return a[0];
  return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
}
function writtenConflict(ctx, ids) {
  try {
    const w15 = writtenFifteen({ written: WEEKLY.classic ? WEEKLY.classic.wildcard15 : [] });
    if (!w15.length || !Array.isArray(ids) || !ids.length) return null;
    const shown = {};
    ids.forEach(function (id) { shown[id] = true; });
    const missing = w15.filter(function (id) { return !shown[id]; });
    if (!missing.length) return null;
    const dropped = missing
      .filter(function (id) { return convergenceRisk(id, ctx).risk; })
      .map(function (id) { return { id: id, name: nameOf(ctx, id), own: rivalOwnMax(id, ctx).max }; })
      .sort(function (a, b) { return b.own - a.own; });
    return { differ: missing.length, ruled: dropped.length, dropped: dropped.slice(0, 2) };
  } catch (e) { return null; }
}

/* buildPlan turns the engine's answers into the one decision the landing shows. */
function buildPlan(ctx, premLocked) {
  if (!ctx || typeof ctx !== "object") ctx = { ok: false };
  const plan = { kind: "hold", gw: ctx.nextEvent, deadline: ctx.deadline, hours: ctx.hoursToDeadline, tp: null, wc: null, timing: null, ids: [], capId: null, viceId: null, formation: "", flags: [], cost: 0, bank: 0, livePts: null, chipUsed: false, agree: true, conflict: null, locked: false, locks: [], why: [] };
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
        if (premLocked) {
          const wo = wildcardOptions(ctx, { written: WEEKLY.classic ? WEEKLY.classic.wildcard15 : [] });
          if (wo && wo.ok && wo.locked && wo.locked.ok && wo.locked.ids.length === 15) {
            const lx = Array.isArray(wo.locked.xi) ? wo.locked.xi : [];
            plan.wc = {
              ok: true, ids: wo.locked.ids, cost: wo.locked.cost, bank: wo.locked.bank,
              score: wo.locked.objective,
              xi: { ids: lx, capId: wo.locked.captain, viceId: wo.locked.vice, formation: wo.locked.formation, score: wo.locked.objective },
              model: "TS", alt: null, disagreement: null, relaxed: false, reasons: wo.locked.reasons || [], budget: wo.budget
            };
            plan.locked = true;
            plan.locks = wo.locks || [];
            plan.writtenDiffer = wo.deltas && wo.deltas.writtenVsLocked ? wo.deltas.writtenVsLocked.playersDiffer : null;
          }
        }
        if (plan.wc.ok) {
          plan.kind = "wildcard";
          plan.ids = plan.wc.ids; plan.cost = plan.wc.cost; plan.bank = plan.wc.bank;
          plan.capId = plan.wc.xi ? plan.wc.xi.capId : null;
          plan.viceId = plan.wc.xi ? plan.wc.xi.viceId : null;
          plan.formation = plan.wc.xi ? plan.wc.xi.formation : "";
          plan.conflict = writtenConflict(ctx, plan.ids);
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
  /* fresh: nothing was saved when the page opened. save: where the copy goes (storeMode) and why the last write of each
     key failed, if it did. */
  const [fresh, setFresh] = React.useState(false);
  const [save, setSave] = React.useState({ mode: storeMode, err: { ui: "", state: "" } });
  React.useEffect(function () {
    let dead = false;
    (async function () {
      const savedState = await store.get(STORE_KEYS.state);
      const savedUi = await store.get(STORE_KEYS.ui);
      if (dead) return;
      if (savedState) setState(sanitiseState(savedState));
      setFresh(!savedState);
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
  /* The result of each write lands here, in the order the writes were made (store.set queues them), so the note a manager
     sees is always about the latest change. A failed write is named; a later good one clears it. */
  const noted = React.useCallback(function (key, r) {
    setSave(function (s) {
      const why = r.ok ? "" : r.reason;
      if (s.mode === r.mode && s.err[key] === why) return s;   // nothing changed: no render
      const err = { ui: s.err.ui, state: s.err.state };
      err[key] = why;
      return { mode: r.mode, err: err };
    });
  }, []);
  React.useEffect(function () { if (ready) store.set(STORE_KEYS.ui, ui).then(function (r) { noted("ui", r); }); }, [ready, ui, noted]);
  React.useEffect(function () { if (ready) store.set(STORE_KEYS.state, state).then(function (r) { noted("state", r); }); }, [ready, state, noted]);
  return { ready: ready, state: state, setState: setState, ui: ui, setUi: setUi, fresh: fresh, save: save };
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

/* ------------------------------------------------------------------ v110 §5 D1 · Today: the landing card

   The landing card ports the kit's vToday instruction (the kit's ui.js 70–132). It reads the solved plan
   (PLAN, written by pipeline/plan.cjs) and the Draft claims sheet built with it (PRE.claims), and says what to do in
   under 100 words (v110 §1.6). Laws it holds (fpl/CLAUDE.md Part N, v110 §1, §6, §7):
   · the solved instruction replaces the app's own only when PLAN.plan exists and PLAN.hash equals PRE.hash, its first
     week is the snapshot's next gameweek and that deadline is still ahead; the wildcard lock or a match price typed on
     the Odds tab (settings the plan was not solved on) sets it aside, and one line says why;
   · a flagged player is never recommended (C1 rule 2): a flag in the latest snapshot on anyone the solved week buys,
     captains or vices sets the plan aside and the app's own search, which leaves him out, answers — the line saying
     why never names him;
   · free transfers, hits and bank are PLAN.replay's, never the solver's own week fields (§6, C3);
   · Classic and Draft sit in their own labelled panels, and no figure of one is added to, netted against or compared
     with the other (§1.1, N3);
   · every league-table figure is read from the table when the card draws, never written as prose (§1.7, §7.6, E-122).
   The helpers are total: junk in any slot gives an empty answer, never a throw. */

/* SAST (UTC+2 all year) with the day and the date written out, for a time that can be a week or more away. */
function sastDate(iso) {
  const t = typeof iso === "string" ? Date.parse(iso) : NaN;
  if (!isFinite(t)) return "";
  const d = new Date(t + 2 * 3600000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return days[d.getUTCDay()] + " " + d.getUTCDate() + " " + mons[d.getUTCMonth()] + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}
function ordinalOf(n) {
  const v = Number(n);
  if (!isFinite(v) || v < 1 || v !== Math.trunc(v) || v > 1e6) return "";
  const m = v % 100;
  return v + (m >= 11 && m <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[v % 10] || "th");
}
/* How many match prices the manager has typed on the Odds tab (state.market, carried into ctx.state by buildCtx). */
function overrideCount(ctx) {
  try {
    const m = ctx && ctx.state && ctx.state.market && typeof ctx.state.market === "object" && !Array.isArray(ctx.state.market) ? ctx.state.market : {};
    return Object.keys(m).reduce(function (s, g) { return s + (m[g] && typeof m[g] === "object" ? Object.keys(m[g]).length : 0); }, 0);
  } catch (e) { return 0; }
}

/* The Draft league table as copy, read from MC.draft.standings when the card draws (E-122: "seven points off the lead"
   was once typed when the gap was eight). Gaps are in league points; the leader is the table's own rank 1. */
function draftTableView(MC) {
  const view = { rank: "", of: "", tail: "", key: "", row: "" };
  try {
    const isO = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
    const fin = function (x) { return typeof x === "number" && isFinite(x); };
    if (!isO(MC) || !isO(MC.draft) || !Array.isArray(MC.draft.standings)) return view;
    const st = MC.draft.standings.filter(function (s) { return isO(s) && fin(s.rank) && fin(s.pts) && typeof s.name === "string"; });
    const me = st.filter(function (s) { return s.name === MC.draft.me; })[0];
    if (!me || !ordinalOf(me.rank)) return view;
    const byRank = st.slice().sort(function (a, b) { return a.rank - b.rank || b.pts - a.pts; });
    let tail;
    if (me.rank === 1) {
      const second = byRank.filter(function (s) { return s !== me; })[0], clear = second ? me.pts - second.pts : 0;
      tail = "top of the table" + (clear > 0 ? ", " + clear + " clear" : ", level on league points");
    } else {
      const behind = byRank[0].pts - me.pts;
      tail = behind <= 0 ? "level with the leader" : behind + " off the lead";
    }
    view.rank = ordinalOf(me.rank); view.of = String(st.length); view.tail = tail;
    view.key = view.rank + " of " + view.of + ", " + tail;
    view.row = view.rank + " of " + view.of + " on " + me.pts + " league point" + (me.pts === 1 ? "" : "s") + ", " + tail;
  } catch (e) { return { rank: "", of: "", tail: "", key: "", row: "" }; }
  return view;
}

/* The Draft half of the landing and of the checklist: the claims sheet's state (the Draft tab's own, draftTabView, so the
   two never disagree), its count, the first claim, the value if every first choice lands and under the stress test, and
   the settle time. now is ctx.now in ms; overrides is overrideCount(ctx). */
function draftClaimsView(mc, now, overrides) {
  const view = { state: "absent", count: 0, first: "", line: "", wv: "", wvDate: "" };
  try {
    const isO = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
    const fin = function (x) { return typeof x === "number" && isFinite(x); };
    const sgn = function (x) { return (x >= 0 ? "+" : "−") + (Math.round(Math.abs(x) * 10) / 10).toFixed(1); };
    if (!isO(mc) || !isO(mc.MC) || !isO(mc.MC.gw) || !isO(mc.MC.draft)) return view;
    const dv = draftTabView(mc, now, overrides);
    const next = Number(mc.MC.gw.next);
    const evs = isO(mc.MC.draft.events) ? mc.MC.draft.events : {}, ev = isO(evs[String(next)]) ? evs[String(next)] : {};
    view.wv = sastText(typeof ev.wv === "string" ? ev.wv : "");
    view.wvDate = sastDate(ev.wv);
    view.state = dv.claims.state;
    const C = isO(mc.PRE) && isO(mc.PRE.claims) ? mc.PRE.claims : {};
    const lines = Array.isArray(dv.claims.lines) ? dv.claims.lines : [];
    if (view.state === "sheet" && lines.length) {
      const all = fin(C.valueAll) ? C.valueAll : C.allFirst;
      view.count = lines.length;
      view.first = lines[0].add + " for " + lines[0].drop;
      view.line = lines.length + (lines.length === 1 ? " claim" : " claims") + ", first " + view.first +
        (fin(all) && fin(C.valueNow) ? ": " + sgn(all - C.valueNow) + " Draft points if all land" : "") +
        (fin(C.valueStress) && fin(C.valueNow) ? ", " + sgn(C.valueStress - C.valueNow) + " under the stress test." : ".") +
        (view.wv ? " Waivers settle " + view.wv + " SAST." : "");
    } else if (view.state === "stale") {
      view.line = "Waivers " + (view.wv ? "settled " + view.wv + " SAST" : "have settled") + ": sign any free agent still worth it before the deadline.";
    } else if (view.state === "hidden") {
      view.line = "The claims sheet is hidden while a match price is overridden on the Odds tab.";
    } else {
      view.state = "absent";
      view.line = "No claims sheet in this build; the Draft tab has the app's own search.";
    }
  } catch (e) { return { state: "absent", count: 0, first: "", line: "", wv: "", wvDate: "" }; }
  return view;
}

/* What the landing shows. state is "solved" (the plan's instruction), "aside" (a solved plan exists but something it was
   not solved on is in play: note says what, and the app's own card answers) or "none" (no solved plan at all, so the
   app's own card stands with nothing added). setting is { locked, overrides }. */
function landingPlanView(mc, ctx, setting) {
  const empty = function () {
    return { state: "none", note: "", gw: 0, kind: "", lead: "", dlText: "", deadline: "", hours: null, fifteen: [], steps: [], squadIds: [],
      cap: "", vice: "", capId: null, viceId: null, flagged: [], whyText: "", costText: "", draftKey: "", draftLine: "", todo: "" };
  };
  const view = empty();
  try {
    const isO = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
    const fin = function (x) { return typeof x === "number" && isFinite(x); };
    const f0 = function (x) { const v = Number(x); return isFinite(v) ? String(Math.round(v)) : "—"; };
    const f1 = function (x) { const v = Number(x); return isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : "—"; };
    const sgn = function (x) { const v = Number(x); return isFinite(v) ? (v >= 0 ? "+" : "−") + f1(Math.abs(v)) : "—"; };
    const cash = function (x) { const v = Number(x); return isFinite(v) ? "£" + v.toFixed(1) + "m" : "—"; };
    const plural = function (n, one, many) { return n === 1 ? one : many; };
    if (!isO(mc) || !isO(mc.MC) || !isO(mc.PLAN) || !isO(mc.E) || !isO(ctx) || ctx.ok !== true || !isO(ctx.els)) return view;
    const MC = mc.MC, PLAN = mc.PLAN, PRE = isO(mc.PRE) ? mc.PRE : null;
    const pl = PLAN.plan;
    if (!isO(pl) || pl.ok !== true || !Array.isArray(pl.weeks) || !pl.weeks.length || !isO(pl.weeks[0]) || !fin(pl.total)) return view;
    const w = pl.weeks[0], gw = Number(w.gw);
    if (!fin(gw)) return view;
    const aside = function (why) { view.state = "aside"; view.note = "Solved plan set aside: " + why; return view; };

    // what the plan was solved on: this build's data (one content hash), the next gameweek, a deadline still ahead
    if (!PRE || typeof PRE.hash !== "string" || typeof PLAN.hash !== "string" || PRE.hash !== PLAN.hash) return aside("it does not match this build's precomputed results.");
    if (gw !== Number(ctx.nextEvent)) return aside("it starts at GW" + gw + ", and the next deadline is GW" + f0(ctx.nextEvent) + ".");
    const ev = isO(MC.gw) && Array.isArray(MC.gw.events) ? MC.gw.events.filter(function (e) { return isO(e) && Number(e.id) === gw; })[0] : null;
    const dlIso = ev && typeof ev.dl === "string" ? ev.dl : (typeof ctx.deadline === "string" ? ctx.deadline : "");
    const dl = Date.parse(dlIso), t = Number(ctx.now);
    if (isFinite(dl) && isFinite(t) && t >= dl) return aside("its GW" + gw + " deadline has passed.");
    // the settings the plan was not solved on
    const s = isO(setting) ? setting : {};
    if (s.locked === true) return aside("the premiums are locked in on the Plan tab.");
    if (fin(s.overrides) && s.overrides > 0) return aside(s.overrides + plural(s.overrides, " match price is", " match prices are") + " overridden on the Odds tab.");
    // the players it names: all in this snapshot, and nobody it recommends flagged since it was solved (C1 rule 2)
    const ids = function (v) { return Array.isArray(v) ? v.filter(fin) : []; };
    const squad = ids(w.squad), ins = ids(w.in), outs = ids(w.out), xi = ids(w.xi);
    if (squad.length !== 15 || !fin(w.cap) || !fin(w.vice) || squad.some(function (id) { return !ctx.els[id]; })) return aside("it names players this snapshot does not carry.");
    const whole = w.chip === "wildcard" || w.chip === "freehit";
    const rec = (whole ? squad : ins).concat([w.cap, w.vice]).filter(function (v, i, a) { return a.indexOf(v) === i; });
    const flaggedNow = rec.filter(function (id) { return isO(ctx.flags) && isO(ctx.flags[id]) && ctx.flags[id].flagged === true; });
    if (flaggedNow.length) return aside((flaggedNow.length === 1 ? "a player it picks is" : flaggedNow.length + " players it picks are") + " flagged in the latest snapshot.");

    // the instruction
    const CHIP = { wildcard: "Wildcard", freehit: "Free Hit", bboost: "Bench Boost", "3xc": "Triple Captain" };
    const chip = typeof w.chip === "string" && CHIP[w.chip] ? w.chip : "";
    const kind = w.chip === "wildcard" ? "wildcard" : w.chip === "freehit" ? "freehit" : ins.length ? "transfers" : "roll";
    const nm = function (id) { return nameOf(ctx, id); };
    view.state = "solved"; view.gw = gw; view.kind = kind; view.squadIds = squad;
    view.lead = kind === "wildcard" ? "Play the Wildcard" : kind === "freehit" ? "Play the Free Hit"
      : kind === "transfers" ? "Make " + ins.length + plural(ins.length, " transfer", " transfers") + (chip ? " and play the " + CHIP[chip] : "")
        : (chip ? "Play the " + CHIP[chip] : "Roll the free transfer");
    view.deadline = dlIso; view.dlText = sastText(dlIso);
    view.hours = isFinite(dl) && isFinite(t) ? (dl - t) / 3600000 : null;
    view.capId = w.cap; view.viceId = w.vice; view.cap = nm(w.cap); view.vice = nm(w.vice);
    if (whole) { const bp = byPos(ctx, squad); view.fifteen = [1, 2, 3, 4].map(function (k) { return bp[k].map(nm); }); }
    if (kind === "transfers") {
      planPairUp(isO(mc.E.P) ? mc.E.P : {}, outs, ins).forEach(function (pr) { view.steps.push("Sell " + pr.out); view.steps.push("Buy " + pr.inn); });
    }
    view.flagged = flagList(ctx, squad);
    const pairs = kind === "transfers" ? planPairUp(isO(mc.E.P) ? mc.E.P : {}, outs, ins).map(function (pr) { return pr.out + " to " + pr.inn; }).join(", ") : "";
    view.todo = (kind === "wildcard" ? "Play the Wildcard and build the planned fifteen" : kind === "freehit" ? "Play the Free Hit with the planned fifteen"
      : kind === "transfers" ? "Make the planned transfers (" + pairs + ")" + (chip ? " and play the " + CHIP[chip] : "")
        : (chip ? "Play the " + CHIP[chip] : "Roll the free transfer")) + "; captain " + view.cap + ", vice " + view.vice;

    // why: the plan, from PLAN (Classic only)
    const T = isO(PLAN.timing) ? PLAN.timing : null;
    const ok = function (r) { return isO(r) && r.ok === true && fin(r.total); };
    const nw = (T && ok(T.never) ? T.never : null) || (ok(PLAN.noWildcard) ? PLAN.noWildcard : null);
    const lastW = pl.weeks[pl.weeks.length - 1], lastGw = isO(lastW) && fin(lastW.gw) ? lastW.gw : gw;
    const later = pl.weeks.filter(function (x) { return isO(x) && fin(x.gw) && x.gw > gw && typeof x.chip === "string" && CHIP[x.chip] && x.chip !== "wildcard"; })
      .map(function (x) { return CHIP[x.chip] + " in GW" + x.gw + (x.chip === "3xc" && fin(x.cap) ? " on " + nm(x.cap) : ""); });
    view.whyText = "Classic: the plan is worth " + f0(pl.total) + " expected points to GW" + lastGw +
      (nw ? ", " + sgn(pl.total - nw.total) + " on the best plan that keeps the wildcard unplayed" : "") + ". " +
      (later.length ? "Then " + later.join(", ") + ". " : "") +
      "It is solved week by week with every transfer, hit and chip, and the Plan tab has the eleven, the timing verdict and every week.";

    // what it costs: from the replay, never the solver's own fields (§6)
    const rw = isO(PLAN.replay) && Array.isArray(PLAN.replay.weeks) ? PLAN.replay.weeks.filter(isO) : [];
    const r0 = rw.filter(function (r) { return Number(r.gw) === gw; })[0] || null;
    if (r0 && fin(r0.bank)) {
      const hits = fin(r0.hits) && r0.hits > 0 ? r0.hits : 0;
      const bankLine = "the bank after " + (whole ? "the " + CHIP[w.chip] : kind === "transfers" ? "the transfers" : "the week") + " is " + cash(r0.bank) +
        (r0.bank < 0.35 ? ", under the £0.35m budget line, so a price rise on a planned buy before the deadline can break the fifteen" : "");
      const ft = fin(r0.ftBefore) ? r0.ftBefore : null, fa = fin(r0.ftAfter) ? r0.ftAfter : null;
      view.costText = "Classic: " + (whole
        ? bankLine + ". " + (ft !== null && fa === ft && ft > 0 ? "Your " + ft + plural(ft, " free transfer is", " free transfers are") + " kept for GW" + (gw + 1) + ". " : "")
        : (kind === "transfers" ? ins.length + plural(ins.length, " transfer", " transfers") + ", " + (hits ? "a hit of " + hits + " points" : "no hit") + "; " : "no transfer; ") + bankLine + ". " +
          (fa !== null ? fa + plural(fa, " free transfer carries", " free transfers carry") + " into GW" + (gw + 1) + ". " : "")) +
        (hits ? "" : "No hits.");
    } else view.costText = "Classic: the replay of this week is not in the plan block, so the bank after it is not shown.";

    // the Draft half: the table (E-122) and the claims line
    const tv = draftTableView(MC);
    view.draftKey = "Draft" + (tv.key ? " · " + tv.key : "");
    view.draftLine = draftClaimsView(mc, t, fin(s.overrides) ? s.overrides : 0).line;
  } catch (e) { return empty(); }
  return view;
}

/* The app's own answer (buildPlan: the five-gameweek search in src/engine.js), kept on the landing behind a labelled
   reveal when the solved plan shows (§1.4: the proven answer shows, the other stays reachable). */
function appSearchText(plan, ctx) {
  try {
    if (!plan || typeof plan !== "object") return "";
    const cap = plan.capId ? nameOf(ctx, plan.capId) : "—", vice = plan.viceId ? nameOf(ctx, plan.viceId) : "—";
    const what = plan.kind === "wildcard" ? "play Wildcard 1 with a fifteen of its own"
      : plan.kind === "transfers" && plan.tp && Array.isArray(plan.tp.moves) ? "make " + plan.tp.moves.length + (plan.tp.moves.length === 1 ? " transfer" : " transfers")
        : "hold";
    return "The app's own search, on its five-gameweek model: " + what + ", captain " + cap + ", vice " + vice + "." +
      (Array.isArray(plan.why) && plan.why.length ? " " + plan.why.filter(function (x) { return typeof x === "string"; }).join(" ") : "");
  } catch (e) { return ""; }
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
  /* v110 D1: the solved plan's instruction when PLAN and PRE share a hash and nothing it was not solved on is in play;
     otherwise the app's own card below stands, with one line saying why the solved plan is set aside. */
  const lv = landingPlanView(props.mc, ctx, { locked: !!rev["wc-lock"], overrides: overrideCount(ctx) });
  if (lv.state === "solved") {
    return (
      <div className="landing card" data-plan="solved">
        <div className="lead"><span className="hi">{lv.lead}</span> before {lv.dlText} SAST.</div>
        {lv.fifteen.length ? (
          <div className="panel">
            <div className="panel-k">Classic · fifteen</div>
            <div className="names">
              {lv.fifteen[0].join(", ")} <i>·</i> {lv.fifteen[1].join(", ")} <i>·</i> {lv.fifteen[2].join(", ")} <i>·</i> {lv.fifteen[3].join(", ")}
            </div>
          </div>
        ) : null}
        {lv.steps.length ? (
          <div className="panel">
            <div className="panel-k">Classic · in order</div>
            <div className="panel-v">{lv.steps.join(" · ")}</div>
          </div>
        ) : null}
        <div className="panel">
          <div className="panel-k">Classic · then</div>
          <div className="panel-v">Captain <b>{lv.cap}</b>, vice <b>{lv.vice}</b>.</div>
        </div>
        <div className="panel">
          <div className="panel-k">{"GW" + lv.gw} deadline</div>
          <div className="panel-v"><b>{leftLine(lv.hours)}</b>{lv.flagged.length ? ", " + lv.flagged.length + " flagged" : ", nobody flagged"}.</div>
        </div>
        <div className="panel" data-testid="ld-draft">
          <div className="panel-k">{lv.draftKey}</div>
          <div className="panel-v">{lv.draftLine}</div>
        </div>
        <Reveal id="ld-why" label="Why" open={!!rev["ld-why"]} onToggle={onRev}>
          <div data-testid="ld-why">{lv.whyText}</div>
        </Reveal>
        <Reveal id="ld-cost" label="What it costs" open={!!rev["ld-cost"]} onToggle={onRev}>
          <div data-testid="ld-cost">{lv.costText}</div>
        </Reveal>
        {lv.flagged.length ? (
          <Reveal id="ld-flag" label="Flags" open={!!rev["ld-flag"]} onToggle={onRev}>
            {lv.flagged.map(function (f) {
              return <div key={f.id}>{f.name}: {f.status}{f.chance === null ? "" : " " + f.chance + "%"}{f.news ? " — " + f.news : ""}</div>;
            })}
          </Reveal>
        ) : null}
        <Reveal id="ld-quick" label="Quick search" open={!!rev["ld-quick"]} onToggle={onRev}>
          <div data-testid="ld-quick">{appSearchText(plan, ctx)}</div>
        </Reveal>
        <div className="dim" style={{ marginTop: "8px" }}><Tier k="model" /> plan · <Tier k="T0" /> deadline</div>
      </div>
    );
  }
  const cap = plan.capId ? nameOf(ctx, plan.capId) : "—";
  const vice = plan.viceId ? nameOf(ctx, plan.viceId) : "—";
  const p = byPos(ctx, plan.ids);
  const nm = function (id) { return nameOf(ctx, id); };
  return (
    <div className="landing card" data-plan="app">
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

      {plan.kind === "wildcard" && plan.locked ? (
        <div className="panel">
          <div className="panel-k">Premiums locked</div>
          <div className="panel-v">{andList(plan.locks.map(function (l) { return l.web_name; }))} {plan.locks.length === 1 ? "is" : "are"} back in against rule six{plan.writtenDiffer ? ", and " + plan.writtenDiffer + " of your written fifteen still differ" : ""}. The Plan tab prices all three fifteens.</div>
        </div>
      ) : null}
      {plan.kind === "wildcard" && !plan.locked && plan.conflict && plan.conflict.dropped.length ? (
        <div className="panel">
          <div className="panel-k">Not your written fifteen</div>
          <div className="panel-v">The convergence rule drops {plan.conflict.dropped.map(function (d) { return d.name + " (" + pc(d.own) + " rival-owned)"; }).join(" and ")}. The Plan tab prices all three fifteens.</div>
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
        <div className="panel-v"><b>{leftLine(plan.hours)}</b>{plan.flags.length ? ", " + plan.flags.length + " flagged" : ", nobody flagged"}.</div>
      </div>

      <Reveal id="ld-why" label="Why" open={!!rev["ld-why"]} onToggle={onRev}>
        {plan.kind === "wildcard" ? <div>{plan.why.join(" ")} The solver runs under the xG fixture model and again under the goals model; the fifteen above is equal-or-better under both, and the gap between them is noise.</div> : null}
        {plan.kind === "wildcard" && plan.conflict ? <div>Rule six of the six keeps anyone at or above 60% rival ownership out of the solver, so {plan.conflict.differ} of the fifteen you wrote down are not in this one. The rule guards your rank in six mini-leagues against a field that already owns those players; it is not a points rule. Three fifteens, priced, on the Plan tab shows what it costs and lets you lock them back in.</div> : null}
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

      {lv.state === "aside" ? <div className="dim" data-testid="ld-aside" style={{ marginTop: "8px" }}>{lv.note}</div> : null}
      <div className="dim" style={{ marginTop: "8px" }}><Tier k="model" /> xP on xG strength · <Tier k="T0" /> prices, flags, deadline</div>
    </div>
  );
}

/* iOS 27 · the notes above every view, all of them about the copy of the app or of the data on this device: a newer build
   waiting (IOS27-07), a copy that is not saving (IOS27-04), a change that did not save (IOS27-05), a first launch as an app
   with nothing saved (IOS27-10) and what a check for new data found. Module-level, props only, total for any props. */
function StoreNotes(props) {
  const s = props.save && typeof props.save === "object" ? props.save : {};
  const err = s.err && typeof s.err === "object" ? s.err : {};
  const why = typeof err.state === "string" && err.state ? err.state : typeof err.ui === "string" ? err.ui : "";
  const none = s.mode === "none";
  const msg = typeof props.check === "string" ? props.check : "";
  if (!props.update && !none && !why && !props.fresh && !msg) return null;
  return (
    <div className="notes">
      {props.update ? <button className="btn upd" data-testid="update-ready" onClick={props.onReload}>New build ready. Tap to reload.</button> : null}
      {none ? <div className="note note-w" data-testid="store-none">This copy is not saving on this device. Export before you close it.</div> : null}
      {!none && why ? <div className="note note-w" data-testid="store-err">Last change not saved ({why}). Export now.</div> : null}
      {props.fresh ? <button className="btn upd" data-testid="new-here" onClick={props.onImport}>New here? Import the export from Safari.</button> : null}
      {msg ? <div className="note" data-testid="check-msg">{msg}</div> : null}
    </div>
  );
}

/* iOS 27 · IOS27-11. The one status region, mounted for good and never keyed: only its text changes. A screen reader
   speaks a change to it. Where ariaNotify exists the app calls that instead and leaves this empty, so an outcome is
   spoken once. */
function Announcer(props) {
  return <div className="vh" role="status" data-testid="announce">{typeof props.text === "string" ? props.text : ""}</div>;
}

/* iOS 27 · IOS27-15. The numbers the harness cannot know, read from the device when the section opens (and again when
   the window is resized or turned) and printed as text that can be selected or copied. props.mode is the storage mode
   App holds; persisted() and estimate() are asked once on mount. Total for any props. */
function DeviceReadout(props) {
  const [, setTick] = React.useState(0);
  const [mem, setMem] = React.useState({ persisted: "checking", usage: "checking" });
  const [said, setSaid] = React.useState("");
  React.useEffect(function () {
    const h = function () { setTick(function (t) { return t + 1; }); };
    try { window.addEventListener("resize", h); window.addEventListener("orientationchange", h); } catch (e) { /* nothing to listen to */ }
    return function () { try { window.removeEventListener("resize", h); window.removeEventListener("orientationchange", h); } catch (e) { /* noop */ } };
  }, []);
  React.useEffect(function () {
    let dead = false;
    const put = function (k, v) { if (!dead) setMem(function (m) { const o = { persisted: m.persisted, usage: m.usage }; o[k] = v; return o; }); };
    const st = typeof navigator !== "undefined" && navigator ? navigator.storage : null;
    try {
      if (st && typeof st.persisted === "function") st.persisted().then(function (v) { put("persisted", v ? "granted" : "not granted"); }, function () { put("persisted", "n/a"); });
      else put("persisted", "n/a");
      if (st && typeof st.estimate === "function") st.estimate().then(function (e) { put("usage", bytesText(e && e.usage) + " of " + bytesText(e && e.quota)); }, function () { put("usage", "n/a"); });
      else put("usage", "n/a");
    } catch (e) { put("persisted", "n/a"); put("usage", "n/a"); }
    return function () { dead = true; };
  }, []);
  const rows = readDevice(props.mode, mem);
  const text = "FPL Mission Control " + APP_VERSION + "\n" + rows.map(function (r) { return r[0] + ": " + r[1]; }).join("\n");
  return (
    <div data-testid="device-readout">
      {rows.map(function (r) { return <KV key={r[0]} k={r[0]} v={r[1]} />; })}
      {canCopy() ? <button className="btn" data-testid="device-copy" onClick={function () {
        if (typeof props.onCopy !== "function") return;
        props.onCopy(text).then(function (ok) { setSaid(ok ? "copied to the clipboard" : "the clipboard refused; select the lines above instead"); });
      }}>Copy</button> : null}
      {said ? <div className="dim">{said}</div> : null}
      <div className="dim">Read from this device each time it draws. A field that reads n/a is one this browser does not offer.</div>
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
          <span>{deadlineLine(ctx.hoursToDeadline)}</span>
          <span>FT {ctx.ft}</span>
          {props.busy ? <span>Refreshing…</span> : <span>{money(ctx.bank)} bank</span>}
          {props.busy ? null : <span>{APP_VERSION}</span>}
        </div>
      </div>
      <div className="hdr-r">
        <button className="btn-sm btn-ic" data-testid="refresh" aria-label={props.check ? "Check for new data" : "Refresh player data"}
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

/* ------------------------------------------------------------------ v110 §5 D1 · Today: the Command tab

   The kit's vToday sections (the kit's ui.js 90–133: checklist, todayClassic, todayDraft, deltaHtml, whatsNew), as data
   for TabCommand's four new sections. Every figure is read from the baked block (MC), the plan (PLAN), the build's
   precomputed results (PRE), the ported engine (E) or the snapshot (ctx) when the tab draws, and each row names its
   game: Classic and Draft are never added, netted or compared (§1.1, N3). Times are SAST (§1.6). The league table is
   read, never written as prose (§7.6, E-122). Total: junk in any slot gives empty lists, never a throw.
   lv is landingPlanView's answer, so the checklist's Classic item says exactly what the landing card says. */
function commandView(mc, ctx, lv) {
  const empty = function () {
    return { next: { gw: "", lede: "", items: [] }, last: { classicHead: "", classic: [], draftHead: "", draft: [] },
      flags: { classicHead: "", classic: [], draftHead: "", draft: [], delta: "" }, notes: { lede: "", redraft: "", buildHead: "", build: [], deskHead: "", desk: [] } };
  };
  const view = empty();
  try {
    const isO = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
    const fin = function (x) { return typeof x === "number" && isFinite(x); };
    const txt = function (s) { return typeof s === "string" && s.length > 0 && s.length < 2000 ? s : ""; };
    const cash = function (x) { const v = Number(x); return isFinite(v) ? "£" + v.toFixed(1) + "m" : "—"; };
    const plural = function (n, one, many) { return n === 1 ? one : many; };
    if (!isO(mc) || !isO(mc.MC) || !isO(mc.E) || !isO(mc.MC.gw) || !isO(ctx)) return view;
    const MC = mc.MC, E = mc.E, P = isO(E.P) ? E.P : {}, D = isO(MC.draft) ? MC.draft : {}, PRE = isO(mc.PRE) ? mc.PRE : {};
    const L = isO(lv) ? lv : {};
    const pName = function (id) { const p = P[id]; return isO(p) && typeof p.n === "string" ? p.n : "id " + (fin(Number(id)) ? String(id) : "?"); };
    const lastDone = Number(MC.gw.lastDone), next = Number(MC.gw.next), now = Number(ctx.now);
    const CHIP = { wildcard: "Wildcard", freehit: "Free Hit", bboost: "Bench Boost", "3xc": "Triple Captain" };

    // (1) last gameweek, each game: Classic from the entry's published weeks, Draft from the league's matches and table
    const gws = isO(MC.classic) && Array.isArray(MC.classic.gws) ? MC.classic.gws.filter(function (g) { return isO(g) && fin(g.gw) && fin(lastDone) && g.gw <= lastDone; }) : [];
    if (gws.length) {
      const g = gws[gws.length - 1], prev = gws.length > 1 ? gws[gws.length - 2] : null;
      view.last.classicHead = "GW" + g.gw + ", from the entry's published picks.";
      if (fin(g.pts) && fin(g.avg)) view.last.classic.push({ label: "Classic GW" + g.gw, value: g.pts + " against an average of " + g.avg, tone: g.pts >= g.avg ? "go" : "out" });
      if (prev && fin(prev.rank) && fin(g.rank)) {
        const diff = prev.rank - g.rank;
        // grouped with no-break spaces, so a seven-digit rank never wraps inside the number on a 360px screen
        const nb = function (n) { return grp(n).replace(/ /g, "\u00a0"); };
        view.last.classic.push({ label: "Classic overall rank", value: nb(prev.rank) + " to " + nb(g.rank) + (diff === 0 ? ", unchanged" : ", " + (diff > 0 ? "up " : "down ") + nb(Math.abs(diff))), tone: diff > 0 ? "go" : diff < 0 ? "out" : "" });
      }
      const cap = Array.isArray(g.picks) ? g.picks.filter(function (k) { return isO(k) && k.c === true; })[0] : null;
      if (cap) {
        const mult = fin(cap.mult) ? cap.mult : 2, pts = fin(cap.pts) ? cap.pts : 0;
        view.last.classic.push({ label: "Classic captain", value: pName(cap.id) + ", " + (pts * mult) + " points" + (mult === 3 ? " as Triple Captain" : ""), tone: "" });
      }
      if (typeof g.chip === "string" && CHIP[g.chip]) view.last.classic.push({ label: "Classic chip", value: CHIP[g.chip], tone: "" });
      const since = function (id, from) {
        let s = 0; const h = isO(P[id]) && isO(P[id].h) ? P[id].h : {};
        for (let k = from; k <= lastDone && k - from < 60; k++) { const row = h[k]; s += Array.isArray(row) && fin(row[1]) ? row[1] : 0; }
        return s;
      };
      const tl = Array.isArray(MC.classic.transfersLog) ? MC.classic.transfersLog.filter(function (t) { return isO(t) && t.gw === g.gw && fin(t.in) && fin(t.out); }) : [];
      tl.forEach(function (t) {
        const a = since(t.in, t.gw), b = since(t.out, t.gw);
        view.last.classic.push({ label: "Classic transfer, GW" + t.gw, value: pName(t.in) + " in for " + pName(t.out) + ": " + a + " against " + b + " since GW" + t.gw, tone: a >= b ? "go" : "out" });
      });
      if (!tl.length) view.last.classic.push({ label: "Classic transfers, GW" + g.gw, value: "none", tone: "" });
      if (fin(g.hit) && g.hit > 0) view.last.classic.push({ label: "Classic hit", value: "−" + g.hit, tone: "out" });
    } else view.last.classicHead = "No finished Classic gameweek in this build.";
    const me = txt(D.me);
    const m = Array.isArray(D.matches) ? D.matches.filter(function (x) { return isO(x) && x.fin === true && fin(x.gw) && x.gw <= lastDone && (x.a === me || x.b === me); })
      .sort(function (a, b) { return b.gw - a.gw; })[0] : null;
    view.last.draftHead = (isO(D.league) && txt(D.league.name) ? D.league.name + ", " : "") + "head to head.";
    if (m && fin(m.ap) && fin(m.bp)) {
      const mine = m.a === me ? m.ap : m.bp, opp = m.a === me ? m.bp : m.ap, on = m.a === me ? m.b : m.a;
      view.last.draft.push({ label: "Draft GW" + m.gw, value: (mine > opp ? "Won" : mine < opp ? "Lost" : "Drew") + " " + mine + "–" + opp + " against " + txt(on), tone: mine > opp ? "go" : mine < opp ? "out" : "" });
    }
    const tv = draftTableView(MC);
    if (tv.row) view.last.draft.push({ label: "Draft table", value: tv.row, tone: "" });
    const st = Array.isArray(D.standings) ? D.standings.filter(function (s) { return isO(s) && s.name === me; })[0] : null;
    if (st && fin(st.w) && fin(st.d) && fin(st.l) && fin(st.pf) && fin(st.pa)) {
      view.last.draft.push({ label: "Draft record", value: st.w + " won, " + st.d + " drawn, " + st.l + " lost; " + st.pf + " scored, " + st.pa + " conceded", tone: "" });
    }
    if (!view.last.draft.length) view.last.draftHead = "No finished Draft match in this build.";

    // (2) the dated checklist, before the next deadline: times from MC.draft.events[next] and the gameweek's deadline
    if (fin(next)) {
      view.next.gw = String(next);
      const evs = isO(D.events) ? D.events : {}, de = isO(evs[String(next)]) ? evs[String(next)] : {};
      const gwEv = Array.isArray(MC.gw.events) ? MC.gw.events.filter(function (e) { return isO(e) && Number(e.id) === next; })[0] : null;
      const dl = gwEv && typeof gwEv.dl === "string" ? gwEv.dl : (typeof de.dl === "string" ? de.dl : "");
      const items = [];
      const add = function (id, game, due, text) { if (typeof due === "string" && isFinite(Date.parse(due))) items.push({ id: id, game: game, due: due, text: text }); };
      const count = overrideCount(ctx);
      const dv = draftTabView(mc, now, count);
      const both = dv.trades.state === "trades" && Array.isArray(dv.trades.both) ? dv.trades.both : [];
      if (both.length) add("trade", "Draft", de.tr, "Propose " + both[0].get + " from " + both[0].rival + " for " + both[0].give + " (you " + both[0].mine + ", they " + both[0].theirs + " Draft points)");
      const before = typeof (de.wv || dl) === "string" && isFinite(Date.parse(de.wv || dl)) ? new Date(Date.parse(de.wv || dl) - 24 * 3600000).toISOString() : "";
      add("rebuild", "", before, "Refresh the data and ask for a rebuild, so the plan and the claims carry the latest injury news and prices");
      const cv = draftClaimsView(mc, now, count);
      if (cv.state === "sheet" && cv.count) add("claims", "Draft", de.wv, "Lodge the " + cv.count + " Draft claims in the order on the Draft tab, first " + cv.first);
      const blocked = isO(ctx.block) && ctx.block.block === true;
      add("classic", "Classic", dl, blocked ? "Confirm the squad first: the entry's picks and the saved fifteen differ"
        : L.state === "solved" && txt(L.todo) ? L.todo : "Carry out the instruction on the card above, captain and vice included");
      add("draftxi", "Draft", dl, "Once waivers settle, sign any free agent still worth it and set the Draft eleven");
      const done = isO(ctx.state) && isO(ctx.state.done) ? ctx.state.done : {};
      view.next.items = items.map(function (x, i) { return { x: x, i: i }; })
        .sort(function (a, b) { return Date.parse(a.x.due) - Date.parse(b.x.due) || a.i - b.i; })
        .map(function (o) {
          const key = next + ":" + o.x.id, past = isFinite(now) && now > Date.parse(o.x.due);
          return { id: o.x.id, key: key, game: o.x.game, text: o.x.text, due: (past ? "passed, " : "") + sastDate(o.x.due) + " SAST", on: done[key] === true };
        });
      const n = view.next.items.filter(function (x) { return x.on; }).length;
      view.next.lede = n + " of " + view.next.items.length + " done. Tap an item to tick it; the ticks are saved with the rest of your state.";
    }

    // (3) flags on both fifteens: the Classic fifteen as the snapshot has it, the Draft roster as the league has it
    const cf = flagList(ctx, Array.isArray(ctx.squadIds) ? ctx.squadIds : []);
    view.flags.classicHead = "Flagged in the fifteen: " + (cf.length ? cf.length + "." : "nobody.");
    view.flags.classic = cf.map(function (f) {
      return { label: "Classic · " + f.name, value: txt(f.news) || "status " + f.status + (fin(f.chance) ? " " + f.chance + "%" : ""), tone: "out" };
    });
    let roster = [];
    try { roster = typeof E.draftRoster === "function" ? E.draftRoster() : []; } catch (e) { roster = []; }
    const df = (Array.isArray(roster) ? roster : []).filter(function (p) { return isO(p) && typeof p.n === "string" && typeof p.st === "string" && p.st !== "a"; });
    view.flags.draftHead = "Flagged on the roster: " + (df.length ? df.length + "." : "nobody.");
    view.flags.draft = df.map(function (p) { return { label: "Draft · " + p.n, value: txt(p.news) || "status " + p.st + (fin(p.cop) ? " " + p.cop + "%" : ""), tone: "out" }; });
    const d = isO(MC.delta) ? MC.delta : null;
    if (d && txt(d.since) && (Array.isArray(d.prices) || Array.isArray(d.flags))) {
      const pr = Array.isArray(d.prices) ? d.prices.filter(isO) : [], fl = Array.isArray(d.flags) ? d.flags.filter(isO) : [];
      if (pr.length || fl.length) {
        const mine = {};
        (Array.isArray(ctx.squadIds) ? ctx.squadIds : []).concat((Array.isArray(roster) ? roster : []).map(function (p) { return isO(p) ? p.id : null; }), Array.isArray(L.squadIds) ? L.squadIds : [],
          isO(PRE.claims) && Array.isArray(PRE.claims.sheet) ? PRE.claims.sheet.map(function (q) { return isO(q) ? q.add : null; }) : []).forEach(function (id) { if (fin(id)) mine[id] = true; });
        const hit = pr.filter(function (x) { return mine[x.id]; }).map(function (x) { return pName(x.id) + " " + cash(x.from) + " to " + cash(x.to); })
          .concat(fl.filter(function (x) { return mine[x.id]; }).map(function (x) { return pName(x.id) + ": " + (txt(x.news) || "flag cleared"); }));
        view.flags.delta = "Since the last build (" + sastDate(d.since) + " SAST): " + pr.length + plural(pr.length, " price change", " price changes") + " and " +
          fl.length + plural(fl.length, " flag change", " flag changes") + " across the game. " +
          (hit.length ? "Touching your squads, the plan or the claims: " + hit.join("; ") + "." : "None touches your squads, the plan or the claims.");
      }
    }

    // (4) what this build knows, dated: the feeds, the desk research, the re-draft, and the build notes
    const intel = isO(MC.intel) ? MC.intel : {};
    view.notes.lede = (sastDate(MC.asOf) ? "Feeds pulled " + sastDate(MC.asOf) + " SAST. " : "") + (sastDate(intel.asOf) ? "Desk research dated " + sastDate(intel.asOf) + " SAST. " : "") +
      "The two games are scored and planned separately everywhere in this app.";
    const rd = isO(D.league) && isO(D.league.redraft) ? D.league.redraft : null;
    if (rd && fin(rd.fromGw) && sastDate(rd.at)) view.notes.redraft = "Your Draft league re-drafts " + sastDate(rd.at) + " SAST, effective GW" + rd.fromGw + ", so this roster plays through GW" + (rd.fromGw - 1) + ".";
    view.notes.build = (Array.isArray(PRE.changes) ? PRE.changes : []).map(txt).filter(Boolean).slice(0, 40);
    view.notes.buildHead = view.notes.build.length ? "This build" + (sastDate(PRE.at) ? ", " + sastDate(PRE.at) + " SAST" : "") + ":" : "";
    view.notes.desk = (Array.isArray(intel.notes) ? intel.notes : []).map(txt).filter(Boolean).slice(0, 40);
    view.notes.deskHead = view.notes.desk.length ? "Desk research, each note from the source it names:" : "";
  } catch (e) { return empty(); }
  return view;
}

function TabCommand(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on, mc = props.mc;
  const hist = (ctx.live.history && ctx.live.history.current) || [];
  const last = hist.length ? hist[hist.length - 1] : null;
  const ev = (ctx.events || []).filter(function (e) { return Number(e.id) === ctx.currentEvent; })[0];
  const bench = hist.reduce(function (s, r) { return s + (Number(r.points_on_bench) || 0); }, 0);
  const sec = function (id) { return openOf(ui, "command", id); };
  /* v110 D1: the ported engine and its blocks arrive as props.mc = { MC, PLAN, PRE, E }, made once in App. The four new
     sections read them; the three the tab had stay as they were, each now tagged with its game (E-118). cmd-stand stays
     PRIMARY: in full mode the landing card above already carries the week's instruction, so the checklist would repeat it
     on first paint, and the season panel is the one view of this tab that nothing above it shows. */
  const isMcObj = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
  if (!isMcObj(mc) || !isMcObj(mc.MC) || !isMcObj(mc.PLAN) || !isMcObj(mc.E)) {
    throw new TypeError("TabCommand: props.mc must be the { MC, PLAN, PRE, E } object App builds");
  }
  const lv = landingPlanView(mc, ctx, { locked: !!(ui && ui.reveals && ui.reveals["wc-lock"]), overrides: overrideCount(ctx) });
  const cv = commandView(mc, ctx, lv);
  const tick = function (key) { if (on && typeof on.done === "function") on.done(key); };
  const kvs = function (rows) { return rows.map(function (r, i) { return <KV key={i + r.label} k={r.label} v={r.value} tone={r.tone} />; }); };
  return (
    <div>
      <Section id="cmd-last" title="Last gameweek, each game" open={sec("cmd-last")} onToggle={on.sec}>
        <div data-testid="cmd-last-classic">
          <div className="dim"><span className="tag tag-s">Classic</span> {cv.last.classicHead}</div>
          {kvs(cv.last.classic)}
        </div>
        <div data-testid="cmd-last-draft">
          <div className="dim"><span className="tag">Draft</span> {cv.last.draftHead}</div>
          {kvs(cv.last.draft)}
        </div>
      </Section>

      <Section id="cmd-next" title={cv.next.gw ? "Before GW" + cv.next.gw : "Before the next deadline"} open={sec("cmd-next")} onToggle={on.sec}>
        <div className="dim">{cv.next.lede}</div>
        <div data-testid="cmd-todo">
          {cv.next.items.map(function (x) {
            return (
              <button key={x.id} className={"todo" + (x.on ? " on" : "")} data-todo={x.id} aria-pressed={x.on ? "true" : "false"}
                onClick={function () { tick(x.key); }}>
                <span className="todo-box" aria-hidden="true">{x.on ? <Check /> : null}</span>
                <span className="todo-t">{x.game ? <span className={x.game === "Classic" ? "tag tag-s" : "tag"}>{x.game}</span> : null}{x.game ? " " : null}{x.text}</span>
                <span className="todo-d">{x.due}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section id="cmd-flags" title="Flags on both fifteens" open={sec("cmd-flags")} onToggle={on.sec}>
        <div data-testid="cmd-flags-classic">
          <div className="dim"><span className="tag tag-s">Classic</span> {cv.flags.classicHead}</div>
          {kvs(cv.flags.classic)}
        </div>
        <div data-testid="cmd-flags-draft">
          <div className="dim"><span className="tag">Draft</span> {cv.flags.draftHead}</div>
          {kvs(cv.flags.draft)}
        </div>
        {cv.flags.delta ? <div className="note" data-testid="cmd-delta">{cv.flags.delta}</div> : null}
        <div className="dim"><Tier k="T0" /> status and news from the feeds</div>
      </Section>

      <Section id="cmd-notes" title="What this build knows" open={sec("cmd-notes")} onToggle={on.sec}>
        <div className="dim">{cv.notes.lede}</div>
        <div data-testid="cmd-notes-list">
          {cv.notes.redraft ? <div className="cmdn">{cv.notes.redraft}</div> : null}
          {cv.notes.build.length ? <div className="dim">{cv.notes.buildHead}</div> : null}
          {cv.notes.build.length ? <ul className="cmdl">{cv.notes.build.map(function (x, i) { return <li key={"b" + i}>{x}</li>; })}</ul> : null}
          {cv.notes.desk.length ? <div className="dim">{cv.notes.deskHead}</div> : null}
          {cv.notes.desk.length ? <ul className="cmdl">{cv.notes.desk.map(function (x, i) { return <li key={"d" + i}>{x}</li>; })}</ul> : null}
        </div>
      </Section>

      <Section id="cmd-stand" title="Where the season stands" open={sec("cmd-stand")} onToggle={on.sec}>
        <div className="dim"><span className="tag tag-s">Classic</span> {"The season to GW" + ctx.currentEvent + ", from the entry's own history."}</div>
        <KV k="Overall rank" v={grp(ctx.live.entry ? ctx.live.entry.summary_overall_rank : 0)} />
        <KV k="Season points" v={ctx.live.entry ? ctx.live.entry.summary_overall_points : "—"} />
        <KV k={"GW" + ctx.currentEvent + " points"} v={(last ? last.points : "—") + " of " + (ev ? ev.average_entry_score : "—") + " field"} tone={last && ev && last.points >= ev.average_entry_score ? "go" : "out"} />
        <KV k="Points left on the bench" v={bench} tone={bench > 15 ? "out" : ""} />
        <KV k="Squad value" v={money(ctx.value)} />
        <div className="dim"><Tier k="T0" /> entry history</div>
      </Section>

      <Section id="cmd-checks" title="What the engine checked" open={sec("cmd-checks")} onToggle={on.sec}>
        <div className="dim"><span className="tag tag-s">Classic</span> The squad, the free transfers and the snapshot.</div>
        <KV k="Squad matches the API" v={ctx.block.block ? "no" : "yes"} tone={ctx.block.block ? "out" : "go"} />
        <KV k="Flags on the fifteen" v={flagList(ctx, ctx.squadIds).length} />
        <KV k="Free transfers" v={ctx.ft} />
        <KV k="Snapshot age" v={ageText((ctx.now - msOf(ctx.live.fetched_at)) / 3600000).replace("min", " min")} />
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
            <span className="nm"><span className={tone || undefined}>{o.action === "sell" ? "Sell" : o.action === "buy" ? "Buy" : o.action === "captain" ? "Captain" : "Vice"}</span> {o.name}</span>
            <span className="rt dim">{o.price === undefined ? "" : money(o.price)}</span>
          </Row>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ v110 §5 D2 · the solved Classic plan

   The plan tab's first panel reads the plan pipeline/plan.cjs wrote (PLAN: plan, noWildcard, timing, freeHit, replay)
   and the ported engine (props.mc.E), and ports the kit's planHtml and priceWatchHtml (the kit's ui.js 154–182) into
   rows and notes. Laws it holds (fpl/CLAUDE.md Part N, v110 §1 and §6):
   · free transfers, hits and bank are read from PLAN.replay, never from the solver's own week fields — the solver's
     free-transfer variables are upper bounds only (C3, E-102); a wildcard week keeps the count (Fantasy Football
     Scout, 20 Jul 2026, N1);
   · everything here is Classic, and nothing is added to, netted against or compared with a Draft figure (§1.1);
   · every figure is read from PLAN, the baked block or the engine when the panel draws, never typed (§1.7).
   Both helpers are total: junk in any slot returns an empty answer, never a throw. */

/* The kit's pairUp: sales and buys matched position by position, each side dearest first, so the list reads as
   like-for-like swaps. Returns [{ out, inn }] with names; a buy the pairing cannot match is shown as "?". */
function planPairUp(P, outs, ins) {
  const res = [];
  try {
    if (!P || typeof P !== "object" || !Array.isArray(outs) || !Array.isArray(ins)) return res;
    const side = function (ids) {
      return ids.map(function (i) { return P[i]; })
        .filter(function (p) { return !!p && typeof p === "object" && [1, 2, 3, 4].indexOf(p.p) >= 0 && typeof p.n === "string"; })
        .sort(function (a, b) { return a.p - b.p || (Number(b.pr) || 0) - (Number(a.pr) || 0); });
    };
    const o = side(outs), n = side(ins);
    [1, 2, 3, 4].forEach(function (k) {
      const a = o.filter(function (x) { return x.p === k; }), b = n.filter(function (x) { return x.p === k; });
      a.forEach(function (x, j) { res.push({ out: x.n, inn: b[j] ? b[j].n : "?" }); });
    });
  } catch (e) { return []; }
  return res;
}

/* What the plan-solved section shows. state is "plan", or one of three reasons it shows a note instead: "hidden" (a
   planning setting the plan was not solved on is active: the wildcard lock, or a match price typed on the Odds tab),
   "stale" (the plan's first deadline has passed) and "unsolved" (no solved plan in this build's data).
   now is the clock in ms (ctx.now); setting is { locked, overrides }. */
function solvedPlanView(mc, now, setting) {
  const QUICK = " The quick searches below still work.";
  const view = { state: "unsolved", note: "The points plan is not solved for this data, so this panel stays empty until the next rebuild." + QUICK,
    gw: 0, lastGw: 0, strip: [], timing: null, eleven: [], benchLine: [], reserve: null, shape: "", weekEp: "", wildcard: false,
    pairs: [], bankText: "", budgetLine: false, keptText: "", price: null, weekRows: [], foot: "" };
  try {
    const isO = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
    const fin = function (x) { return typeof x === "number" && isFinite(x); };
    const f0 = function (x) { const v = Number(x); return isFinite(v) ? String(Math.round(v)) : "—"; };
    const f1 = function (x) { const v = Number(x); return isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : "—"; };
    const sgn = function (x) { const v = Number(x); return isFinite(v) ? (v >= 0 ? "+" : "−") + f1(Math.abs(v)) : "—"; };
    const cash = function (x) { const v = Number(x); return isFinite(v) ? "£" + v.toFixed(1) + "m" : "—"; };
    const plural = function (n, one, many) { return n === 1 ? one : many; };
    if (!isO(mc) || !isO(mc.MC) || !isO(mc.PLAN) || !isO(mc.E)) return view;
    const MC = mc.MC, PLAN = mc.PLAN, E = mc.E, P = isO(E.P) ? E.P : {};
    const pl = PLAN.plan;
    const rw = isO(PLAN.replay) && Array.isArray(PLAN.replay.weeks) ? PLAN.replay.weeks.filter(isO) : [];
    if (!isO(pl) || pl.ok !== true || !Array.isArray(pl.weeks) || !pl.weeks.length || !isO(pl.weeks[0]) || !fin(pl.total) || !rw.length) return view;

    const s = isO(setting) ? setting : {};
    const why = [];
    if (s.locked === true) why.push("the premiums are locked in under Three fifteens, priced");
    if (fin(s.overrides) && s.overrides > 0) why.push(s.overrides + plural(s.overrides, " match price is", " match prices are") + " overridden on the Odds tab");
    if (why.length) {
      view.state = "hidden";
      view.note = "The solved plan was worked out on the built-in settings, and " + why.join(" and ") + ", so it is hidden until " +
        (why.length > 1 ? "both are" : "that is") + " undone or the plan is rebuilt." + QUICK;
      return view;
    }

    const w = pl.weeks[0], gw = Number(w.gw), lastW = pl.weeks[pl.weeks.length - 1], lastGw = isO(lastW) ? Number(lastW.gw) : gw;
    if (!fin(gw)) return view;
    const cEnd = isO(E.CFG) && fin(E.CFG.classicEnd) ? E.CFG.classicEnd : lastGw;
    const rOf = function (g) { return rw.filter(function (r) { return Number(r.gw) === Number(g); })[0] || null; };
    const r0 = rOf(gw);
    const ev = isO(MC.gw) && Array.isArray(MC.gw.events) ? MC.gw.events.filter(function (e) { return isO(e) && Number(e.id) === gw; })[0] : null;
    const dl = ev ? Date.parse(ev.dl) : NaN, t = Number(now);
    if (isFinite(dl) && isFinite(t) && t >= dl) {
      view.state = "stale";
      view.note = "The solved plan starts at GW" + gw + ", whose deadline has passed, so it is hidden until the next rebuild." + QUICK;
      return view;
    }

    const name = function (id) { const p = P[id]; return isO(p) && typeof p.n === "string" ? p.n : "id " + f0(id); };
    const epOf = function (id) { const p = P[id]; if (!isO(p) || typeof E.ep !== "function") return NaN; try { return Number(E.ep(p, gw)); } catch (e) { return NaN; } };
    const ids = function (v) { return Array.isArray(v) ? v.filter(function (x) { return fin(x); }) : []; };
    const ins = ids(w.in), outs = ids(w.out), wc = w.chip === "wildcard";
    const CHIP = { wildcard: "Wildcard", freehit: "Free Hit", bboost: "Bench Boost", "3xc": "Triple Captain" };
    const SHORT = { wildcard: "WC", freehit: "FH", bboost: "BB", "3xc": "TC" };
    view.state = "plan"; view.gw = gw; view.lastGw = lastGw; view.wildcard = wc;

    // (1) the stat strip
    const T = isO(PLAN.timing) ? PLAN.timing : null;
    const ok = function (r) { return isO(r) && r.ok === true && fin(r.total); };
    const nw = (T && ok(T.never) ? T.never : null) || (ok(PLAN.noWildcard) ? PLAN.noWildcard : null);
    const fh = (Array.isArray(PLAN.freeHit) ? PLAN.freeHit : []).filter(function (f) { return isO(f) && f.free === true && fin(f.gain) && fin(f.gw); })
      .sort(function (a, b) { return b.gain - a.gain; })[0] || null;
    view.strip = [
      { k: "Expected points", v: f0(pl.total), sub: "to GW" + lastGw },
      wc && T && ok(T.later)
        ? { k: "Wildcard later", v: f0(T.later.total), sub: sgn(pl.total - T.later.total) + " for playing it now" }
        : { k: "Without the wildcard", v: nw ? f0(nw.total) : "—", sub: nw ? "the plan is " + sgn(pl.total - nw.total) : "not solved" },
      { k: "GW" + gw, v: wc ? "Wildcard" : ins.length ? ins.length + " in" : "Roll", sub: "captain " + name(w.cap) + (w.chip && !wc && CHIP[w.chip] ? ", " + CHIP[w.chip] : "") },
      { k: "Free Hit", v: fh ? "GW" + fh.gw : "—", sub: fh ? sgn(fh.gain) + " that week" : "no week with it free" }
    ];

    // (2) the timing verdict. A solve's gap bounds its own objective, so the most a restricted case could still reach
    // is obj × (1 + gap): the kept plan's objective above that bound is a proof, not an eyeball. The proof is in
    // objective space; the display is in points, and "settled" needs the points gap to beat the solver's tolerance.
    if (wc && T && ok(T.now) && ok(T.later) && ok(T.never)) {
      const gap = function (r) { return fin(r.gap) ? r.gap : 0; };
      const tol = Math.round(Math.max(gap(T.now), gap(T.later), gap(T.never)) * pl.total);
      const bound = function (r) { return fin(r.obj) ? r.obj * (1 + gap(r)) : 0; };
      const proved = function (r) { return fin(T.now.obj) && T.now.obj > bound(r); };
      const lw = Array.isArray(T.later.weeks) ? T.later.weeks.filter(function (x) { return isO(x) && x.chip === "wildcard"; })[0] : null;
      const lgw = lw && fin(lw.gw) ? "GW" + lw.gw : "a later week";
      const edge = T.now.total - T.later.total, clear = edge > tol;
      const tips = [];
      if (!clear) {
        const days = isFinite(dl) && isFinite(t) ? Math.max(0, Math.round((dl - t) / 864e5)) : null;
        if (days !== null) tips.push(days > 6 ? "with " + days + " days to the deadline you can build late, once the injury news is in" : "building at the deadline means the injury news is in");
        if (r0 && fin(r0.ftBefore) && r0.ftBefore > 0 && r0.ftAfter === r0.ftBefore) {
          tips.push("your " + r0.ftBefore + plural(r0.ftBefore, " free transfer survives", " free transfers survive") + " the chip and give" + plural(r0.ftBefore, "s", "") + " a second reshuffle in GW" + (gw + 1));
        }
        const tcw = pl.weeks.filter(function (x) { return isO(x) && x.chip === "3xc" && fin(x.gw); })[0];
        if (tcw) {
          const cp = P[tcw.cap];
          let fx = [];
          try { fx = isO(cp) && typeof E.fx === "function" ? E.fx(cp.t, tcw.gw) : []; } catch (e) { fx = []; }
          const where = (Array.isArray(fx) ? fx : []).filter(function (f) { return isO(f) && typeof f.o === "string"; })
            .map(function (f) { return (f.ha === "H" ? "at home to " : "away to ") + f.o; }).join(" and ");
          tips.push("the plan's Triple Captain week, " + name(tcw.cap) + (where ? " " + where : "") + " in GW" + tcw.gw + ", needs the new squad in place");
        }
        if (ins.length >= 6 && r0 && fin(r0.ftBefore)) tips.push(ins.length + " of your fifteen are being replaced anyway, which " + r0.ftBefore + plural(r0.ftBefore, " free transfer", " free transfers") + " cannot do");
      }
      view.timing = {
        clear: clear,
        head: "Classic wildcard timing, each case solved on its own to about the same tolerance.",
        cases: "Play it in GW" + gw + ": " + f0(T.now.total) + ". Play it later, best week " + lgw + ": " + f0(T.later.total) + ". Keep it unplayed to GW" + cEnd + ": " + f0(T.never.total) + ".",
        never: proved(T.never)
          ? "Holding the chip to GW" + cEnd + " is proved worse: the best plan that never plays it was solved to the end and cannot reach the plan above."
          : "Holding the chip is " + f1(T.now.total - T.never.total) + " behind, which is still inside the proof tolerance.",
        verdict: clear
          ? "GW" + gw + " beats every later week by " + f1(edge) + ", more than the tolerance of about " + tol + " points, so the week is settled."
          : (proved(T.later) ? "GW" + gw + " is ahead of every later week in the proof as well, but only just: " + sgn(edge) + " against " + lgw + ", inside the tolerance of about " + tol + " points" : "GW" + gw + " against " + lgw + " is " + sgn(edge) + ", inside the tolerance of about " + tol + " points") +
            ", so treat the two weeks as level on expected points." + (tips.length ? " What tips it to now: " + tips.join("; ") + "." : "")
      };
    }

    // (3) the next gameweek's eleven, by position, with the engine's expected points; then the bench in order
    const cnt = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const person = function (id) { const v = epOf(id); return { id: id, name: name(id), ep: f1(v), tag: id === w.cap ? "C" : id === w.vice ? "V" : "" }; };
    const xi = ids(w.xi);
    view.eleven = [1, 2, 3, 4].map(function (k) {
      const row = xi.filter(function (id) { return isO(P[id]) && P[id].p === k; }).sort(function (a, b) { return (epOf(b) || 0) - (epOf(a) || 0); });
      cnt[k] = row.length;
      return { pos: POS_NAME[k], people: row.map(person) };
    }).filter(function (r) { return r.people.length > 0; });
    view.shape = cnt[2] + "-" + cnt[3] + "-" + cnt[4];
    view.weekEp = f1(w.epNet);
    view.benchLine = ids(w.bench).map(person);
    view.reserve = fin(w.gk2) ? person(w.gk2) : null;

    // (4) the change list, with the bank after and the free transfers from the replay
    view.pairs = planPairUp(P, outs, ins);
    const bank = r0 && fin(r0.bank) ? r0.bank : null;
    view.bankText = cash(bank === null ? NaN : bank);
    view.budgetLine = bank !== null && bank < 0.35 && view.pairs.length > 0;
    if (wc && r0 && fin(r0.ftBefore) && fin(r0.ftAfter)) {
      view.keptText = r0.ftAfter === r0.ftBefore
        ? "Your " + r0.ftBefore + plural(r0.ftBefore, " free transfer is", " free transfers are") + " kept for GW" + (gw + 1) + "."
        : "You carry " + r0.ftAfter + plural(r0.ftAfter, " free transfer", " free transfers") + " into GW" + (gw + 1) + ".";
    }

    // (5) the price watch: planned buys under rise pressure, planned sales under fall pressure, on the replayed bank
    let st = null;
    try {
      st = bank !== null && typeof E.priceStress === "function" && isO(MC.gw)
        ? E.priceStress(ids(w.squad), ins, outs, bank, Number(MC.gw.next), cEnd, isO(MC.classic) && isO(MC.classic.sell) ? MC.classic.sell : null) : null;
    } catch (e) { st = null; }
    if (isO(st)) {
      const risers = ids(st.risers), fallers = ids(st.fallers), shortBy = fin(st.need) ? st.need : 0;
      if (risers.length || fallers.length || shortBy > 0) {
        const bits = [];
        if (risers.length) bits.push("Planned buys under rise pressure, net transfers in over owners since the last deadline: " +
          risers.map(function (i) { const pr = isO(P[i]) ? Number(P[i].press) : NaN; return name(i) + (isFinite(pr) ? " " + Math.round(pr * 100) + "%" : ""); }).join(", ") + ".");
        if (fallers.length) bits.push("Planned sales under fall pressure: " + fallers.map(name).join(", ") + ".");
        if (shortBy > 0) {
          const fix = isO(st.fix) && fin(st.fix.out) && fin(st.fix.inn) ? st.fix : null;
          bits.push("A £0.1m move on each leaves you " + cash(shortBy) + " short" + (fix
            ? "; the least costly fix is " + name(fix.out) + " to " + name(fix.inn) + (fin(fix.saves) ? ", saving " + cash(fix.saves) : "") +
              (fin(fix.loss) ? ", " + sgn(-fix.loss) + " expected points to GW" + cEnd : "") + "."
            : "."));
        } else bits.push("The bank covers a £0.1m move on each of them.");
        view.price = { warn: shortBy > 0, text: bits.join(" ") };
      }
    }

    // (6) week by week: moves from the in and out lists; free transfers, hits and bank from the replay
    view.weekRows = pl.weeks.filter(function (x) { return isO(x) && fin(x.gw); }).map(function (x) {
      const r = rOf(x.gw), xin = ids(x.in), xout = ids(x.out);
      const what = x.chip === "wildcard" ? "Wildcard: " + xin.length + " changes"
        : !xin.length ? (x.held === true ? "hold the squad" : "roll")
          : planPairUp(P, xout, xin).map(function (pr) { return pr.out + " to " + pr.inn; }).join(", ");
      const hit = r && fin(r.hits) && r.hits > 0 ? " (−" + r.hits + ")" : "";
      return { gw: Number(x.gw), what: what + hit, sub: r && fin(r.ftBefore) ? r.ftBefore + " free, bank " + cash(r.bank) : "not replayed",
        chip: x.chip && SHORT[x.chip] ? SHORT[x.chip] : "", cap: name(x.cap), ep: f1(x.epNet) };
    });
    const und = ok(PLAN.undecayed) && (!fin(PLAN.undecayed.gap) || PLAN.undecayed.gap < 0.05) && Array.isArray(PLAN.undecayed.weeks) && isO(PLAN.undecayed.weeks[0]) ? PLAN.undecayed : null;
    const same = und ? und.weeks[0].chip === w.chip && und.weeks[0].cap === w.cap : false;
    const agrees = isO(PLAN.replay) && PLAN.replay.agrees === true;
    const diffs = isO(PLAN.replay) && Array.isArray(PLAN.replay.differences) ? PLAN.replay.differences.length : 0;
    view.foot = (fin(pl.detail) ? "Transfers are planned week by week for the first " + pl.detail + " gameweeks; after that the plan holds the squad. " : "") +
      "Hits are allowed but chosen only when they pay, and no player is sold only to be bought back. Free transfers, hits and bank are replayed from the game's rules" +
      (agrees ? ", and the replay agrees with the solver on every week." : diffs ? "; the replay differs from the solver in " + diffs + plural(diffs, " place", " places") + ", and the figures shown are the replay's." : ".") +
      (fin(pl.secs) ? " Solved in " + Math.round(pl.secs) + " s" + (fin(pl.gap) ? ", within " + (pl.gap * 100).toFixed(1) + "% of the best plan that exists." : ".") : "") +
      (und ? " Counting every week equally gives " + f0(und.total) + " and " + (same ? "the same GW" + gw + " decision." : "a different GW" + gw + " decision.") : "") +
      " WC wildcard, BB bench boost, TC triple captain, FH free hit.";
  } catch (e) {
    view.state = "unsolved";
    view.note = "The solved plan could not be read from this build's data, so this panel stays empty until the next rebuild." + QUICK;
  }
  return view;
}

function TabPlan(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on, plan = props.plan, mc = props.mc;
  /* v110 D2: the ported engine and the solved plan arrive as props.mc = { MC, PLAN, PRE, E }, made once in App. */
  const isMcObj = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
  if (!isMcObj(mc) || !isMcObj(mc.MC) || !isMcObj(mc.PLAN) || !isMcObj(mc.E) || typeof mc.E.ep !== "function") {
    throw new TypeError("TabPlan: props.mc must be the { MC, PLAN, PRE, E } object App builds");
  }
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
  const premLocked = !!(ui.reveals && ui.reveals["wc-lock"]);
  /* v110 D2: the solved plan hides behind one note while a setting it was not solved on is active — the wildcard lock
     above, or any match price the manager typed on the Odds tab (state.market, carried into ctx.state by buildCtx). */
  const mkt = ctx && ctx.state && ctx.state.market && typeof ctx.state.market === "object" ? ctx.state.market : {};
  const mktCount = Object.keys(mkt).reduce(function (s, g) { return s + (mkt[g] && typeof mkt[g] === "object" ? Object.keys(mkt[g]).length : 0); }, 0);
  const solvedOpen = sec("plan-solved");
  const clock = ctx ? Number(ctx.now) : NaN;
  const sv = React.useMemo(function () {
    return solvedOpen ? solvedPlanView(mc, clock, { locked: premLocked, overrides: mktCount }) : null;
  }, [solvedOpen, mc, clock, premLocked, mktCount]);
  /* Three priced fifteens cost two solver runs, so they are computed once per snapshot and
     only while the panel is open: without the memo every click on the tab paid for them again. */
  const optsOpen = sec("plan-opts") && !hidden;
  const wcOpts = React.useMemo(function () {
    return optsOpen ? wildcardOptions(ctx, { written: WEEKLY.classic ? WEEKLY.classic.wildcard15 : [] }) : null;
  }, [optsOpen, ctx]);
  const optRows = wcOpts && wcOpts.ok
    ? [{ key: "pure", v: wcOpts.pure }, { key: "locked", v: wcOpts.locked }, { key: "written", v: wcOpts.written }].filter(function (r) { return r.v && r.v.ok; })
    : [];
  const headKey = premLocked ? "locked" : "pure";
  const headRow = optRows.filter(function (r) { return r.key === headKey; })[0] || optRows[0] || null;
  const priced = wcOpts && wcOpts.ok && wcOpts.pure && wcOpts.pure.ok && wcOpts.locked && wcOpts.locked.ok && wcOpts.written && wcOpts.written.ok;
  const fb = WEEKLY.classic.fallback || { moves: [] };
  const fbCost = (WEEKLY.classic.wildcard15 || []).reduce(function (s, id) { return s + (ctx.els[id] ? Number(ctx.els[id].now_cost) : 0); }, 0);
  return (
    <div>
      <Section id="plan-solved" title="The points-maximising plan" open={sec("plan-solved")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="plan-solved">
        {!sv ? null : sv.state !== "plan" ? <div className="note note-w" data-testid="plan-solved-note">{sv.note}</div> : (
          <div data-testid="plan-solved">
            <div className="dim"><span className="tag tag-s">Classic</span> {"Solved to GW" + sv.lastGw + ", when the first set of chips expires."}</div>
            <div className="pstrip" data-testid="plan-strip">
              {sv.strip.map(function (c) {
                return (
                  <div className="pst" key={c.k}>
                    <span className="pst-k">{c.k}</span>
                    <span className="pst-v">{c.v}</span>
                    <span className="pst-s">{c.sub}</span>
                  </div>
                );
              })}
            </div>
            {sv.timing ? (
              <div className={"note" + (sv.timing.clear ? "" : " note-w")} data-testid="plan-timing">
                <b>{sv.timing.head}</b> {sv.timing.cases + " " + sv.timing.never + " " + sv.timing.verdict}
              </div>
            ) : null}
            <div data-testid="plan-xi">
              <div className="dim">{"Classic GW" + sv.gw + " under the plan, " + sv.shape + ": " + sv.weekEp + " expected with the captain's points doubled."}</div>
              {sv.eleven.map(function (r) {
                return (
                  <Row key={r.pos} cols="42px minmax(0,1fr)">
                    <span className="dim">{r.pos}</span>
                    <span className="nm" style={{ whiteSpace: "normal" }}>
                      {r.people.map(function (x, i) {
                        return (
                          <span key={x.id}>{(i ? ", " : "") + x.name + " " + x.ep}{x.tag ? " " : null}{x.tag ? <span className={x.tag === "C" ? "tag tag-e" : "tag"}>{x.tag}</span> : null}</span>
                        );
                      })}
                    </span>
                  </Row>
                );
              })}
              <Row cols="42px minmax(0,1fr)">
                <span className="dim">Bench</span>
                <span className="nm" style={{ whiteSpace: "normal" }}>
                  {sv.benchLine.map(function (x, i) { return (i ? ", " : "") + (i + 1) + " " + x.name + " " + x.ep; }).join("")}
                  {sv.reserve ? (sv.benchLine.length ? "; " : "") + "reserve keeper " + sv.reserve.name + " " + sv.reserve.ep : ""}
                </span>
              </Row>
            </div>
            {sv.pairs.length ? (
              <div data-testid="plan-changes">
                <KV k={"Classic bank after GW" + sv.gw + "'s changes"} v={sv.bankText} tone={sv.budgetLine ? "out" : ""} />
                {sv.budgetLine ? <div className="note note-w">At the budget line: if a planned buy rises before the deadline, one player must give way, so rebuild the plan in the last two days.</div> : null}
                {sv.keptText ? <div className="dim">{sv.keptText}</div> : null}
                <Reveal id="pl-changes" label={(sv.wildcard ? "Classic wildcard: the " + sv.pairs.length + " changes" : "Classic transfers: the " + sv.pairs.length + (sv.pairs.length === 1 ? " change" : " changes")) + ", out then in"}
                  open={!!(rev && rev["pl-changes"])} onToggle={on.rev}>
                  {sv.pairs.map(function (pr, i) {
                    return (
                      <Row key={"pc" + i} cols="minmax(0,1fr) 16px minmax(0,1fr)">
                        <span className="nm out">{pr.out}</span>
                        <span className="dim">to</span>
                        <span className="nm go">{pr.inn}</span>
                      </Row>
                    );
                  })}
                </Reveal>
              </div>
            ) : null}
            {sv.price ? (
              <div className={"note" + (sv.price.warn ? " note-w" : "")} data-testid="plan-price"><b>Classic price watch.</b> {sv.price.text}</div>
            ) : null}
            <Reveal id="pl-week" label="Week by week, Classic" open={!!(rev && rev["pl-week"])} onToggle={on.rev}>
              <div className="tbl" data-testid="plan-week-table">
                <Row head cols="26px minmax(0,1fr) 34px minmax(0,64px) 34px">
                  <span>GW</span><span>Moves</span><span>Chip</span><span>Captain</span><span className="rt">xP</span>
                </Row>
                {sv.weekRows.map(function (x) {
                  return (
                    <Row key={"wk" + x.gw} cols="26px minmax(0,1fr) 34px minmax(0,64px) 34px">
                      <span className={x.gw === sv.gw ? "go" : "dim"}>{x.gw}</span>
                      <span className="pwk">{x.what}<span className="dim">{" · " + x.sub}</span></span>
                      <span className="dim">{x.chip}</span>
                      <span className="nm">{x.cap}</span>
                      <span className="rt">{x.ep}</span>
                    </Row>
                  );
                })}
              </div>
              <div>{sv.foot}</div>
            </Reveal>
            <div className="dim"><Tier k="model" /> solved plan · <Tier k="T0" /> prices</div>
          </div>
        )}
        </Guard>
      </Section>

      <Section id="plan-tx" title="Transfers" open={sec("plan-tx")} onToggle={on.sec}>
        <div className="dim"><span className="tag tag-s">Classic</span> The weekly transfers, from the squad and the free transfers you hold.</div>
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
        <div className="dim"><span className="tag tag-s">Classic</span> The wildcard fifteen, priced at today's selling values.</div>
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
            {premLocked ? <div className="note note-w">The premiums are locked, so this fifteen and the one on the landing card are the locked solve. Unlock to go back to the rule-pure answer.</div> : null}
            <Reveal id="pl-wc-how" label="How it was built" open={!!rev["pl-wc-how"]} onToggle={on.rev}>
              <div>Greedy seed on five-week xP per million, then one-swap and two-swap local search, under 2-5-5-3, the selling value, three per club and the convergence rule. Run again under the goals model; the fifteen shipped is equal-or-better under both.</div>
            </Reveal>
            <div className="dim"><Tier k="model" /> solver · <Tier k="T0" /> prices</div>
          </div>
        ) : <div className="note note-a">The solver could not build a legal fifteen from the snapshot.</div>}
        </Guard>
      </Section>

      <Section id="plan-opts" title="Three fifteens, priced" open={sec("plan-opts")} onToggle={on.sec}>
        <div className="dim"><span className="tag tag-s">Classic</span> Three ways to build the wildcard fifteen, priced under one objective.</div>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="plan-opts">
        {hidden ? <div className="note note-w">Matches are running. Transfer panels come back when the last whistle goes.</div> : optRows.length ? (
          <div>
            <div className="tbl">
              <Row head cols="minmax(0,1fr) 50px 58px 50px">
                <span>Fifteen</span><span className="rt">Weekly</span><span className="rt">Cost</span><span className="rt">Bank</span>
              </Row>
              {optRows.map(function (r) {
                return (
                  <Row key={r.key} cols="minmax(0,1fr) 50px 58px 50px">
                    <span className="nm" style={{ whiteSpace: "normal" }}>{r.v.label} {r.key === headKey ? <span className="tag tag-e">yours</span> : null}</span>
                    <span className="rt">{two(r.v.weekly)}</span>
                    <span className="rt">{money(r.v.cost)}</span>
                    <span className="rt dim">{money(r.v.bank)}</span>
                  </Row>
                );
              })}
            </div>
            <button className="btn" data-testid="wc-lock" aria-pressed={premLocked ? "true" : "false"} onClick={function () { on.rev("wc-lock"); }}>
              {premLocked ? "Unlock the premiums" : "Lock the premiums in"}
            </button>
            {headRow ? <KV k="Working answer" v={headRow.v.label + ", " + headRow.v.formation + ", captain " + (headRow.v.captain ? nameOf(ctx, headRow.v.captain) : "—")} /> : null}
            {headRow ? <div className="names" style={{ whiteSpace: "normal" }}>{headRow.v.ids.map(function (id) { return nameOf(ctx, id); }).join(", ")}</div> : null}
            {priced && wcOpts.deltas.lockedVsPure ? (
              <KV k="Locking changes" v={wcOpts.deltas.lockedVsPure.playersDiffer + " of the fifteen, " + money(wcOpts.deltas.lockedVsPure.cost) + " more spent"} />
            ) : null}
            {priced && wcOpts.deltas.writtenVsPure ? (
              <KV k="Written plan differs by" v={wcOpts.deltas.writtenVsPure.playersDiffer + " of the fifteen"} />
            ) : null}
            {priced ? (
              <div className="note note-w">
                On this snapshot the locked fifteen is worth {two(Math.abs(wcOpts.locked.weekly - wcOpts.pure.weekly))} points a week {wcOpts.locked.weekly >= wcOpts.pure.weekly ? "more" : "less"} than the rule-pure one and spends {money(Math.abs(wcOpts.locked.cost - wcOpts.pure.cost))} {wcOpts.locked.cost >= wcOpts.pure.cost ? "more" : "less"} of the budget, so rule six costs expected points here. That is a finding, not a licence to drop the rule: it exists to protect your rank in six mini-leagues against a field that already owns those players. Your written fifteen scores {two(Math.abs(wcOpts.pure.weekly - wcOpts.written.weekly))} a week {wcOpts.written.weekly >= wcOpts.pure.weekly ? "more" : "less"} than the rule-pure one.
              </div>
            ) : null}
            {wcOpts.locks.length
              ? <div className="dim">Rule six holds {wcOpts.locks.length} of the written fifteen out of the solver: {wcOpts.locks.map(function (l) { return l.web_name + " " + pc(l.rivalOwn); }).join(", ")}.</div>
              : <div className="dim">Nobody in the written fifteen is 60% rival-owned, so the rule and the plan agree and all three are the same solve.</div>}
            <Reveal id="pl-opt-how" label="How the three compare" open={!!rev["pl-opt-how"]} onToggle={on.rev}>
              {optRows.map(function (r) { return <div key={"how-" + r.key}>{r.v.label}: {r.v.how}.</div>; })}
              <div>All three are scored under one five-week objective and the same legality test, so the columns are comparable. Whichever one you take, the other two stay on this screen.</div>
            </Reveal>
            <div className="dim"><Tier k="model" /> one objective, one legality test · <Tier k="T0" /> prices, rival picks</div>
          </div>
        ) : <div className="note note-a">The three fifteens could not be priced from this snapshot{wcOpts && wcOpts.reasons.length ? ": " + wcOpts.reasons.join("; ") : "."}</div>}
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
        <div className="dim"><span className="tag tag-s">Classic</span> The eleven and the bench of the wildcard fifteen.</div>
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
        <div className="dim"><span className="tag tag-s">Classic</span> When to play the wildcard, judged by the weekly gap it closes.</div>
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
        <div className="dim"><span className="tag tag-s">Classic</span> The transfers to make without playing the chip.</div>
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
          <div className="note">The written plan quotes {money(WEEKLY.classic.wildcard15_cost_written)} for that fifteen. Today it is {money(fbCost)} against a selling value of {money(ctx.budget)}: still affordable, but the price moved.</div>
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
            <Row key={id} cols="minmax(0,1fr) 48px 72px">
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

/* ------------------------------------------------------------------ v110 §5 D3 · the Draft tab, ported

   The kit's vDraft, claimSheetHtml, draftPlanHtml, contestHtml and tradesHtml (the kit's ui.js 199–279), as data
   for TabDraft to draw. They read the ported engine and its blocks, props.mc = { MC, PLAN, PRE, E }:
   · the claims sheet is PRE.claims, built at build time by buildClaimSheet (fpl/CLAUDE.md Part N2: lodging order,
     backups for the same drop, flagged players held back, gains measured to the Draft horizon);
   · the waiver order is E.waiverOrder(), read from waiver_pick and never re-derived from the table (N2);
   · the Draft horizon is MC.draft.league.redraft, the unfinished draft's first gameweek minus one (N2, §7.12);
   · "how to get him" is E.howToGet, phase-aware: before waivers settle every unowned player is a claim (§7.4);
   · every trade and every claim is position for position (§7.3); a pair that is not is never shown;
   · everything here is Draft, and nothing is added to, netted against or compared with a Classic figure (§1.1);
   · every figure is read from the blocks or the engine when the panel draws, never typed (§1.7).
   Both helpers are total: junk in any slot returns an empty answer, never a throw. */

/* What df-claims, df-solved and df-trades show. now is the clock in ms (ctx.now); overrides is how many match prices
   the manager has typed on the Odds tab (state.market). The claims sheet, the solved roster and the trades were all
   worked out on the built-in prices, so any override hides them behind one note each; the waiver paragraph and the
   horizon do not depend on prices and stay. */
function draftTabView(mc, now, overrides) {
  const QUICK = " The app's own claim search below still works.";
  const view = {
    game: "draft", league: "", horizon: "", toHz: "the horizon", phase: "",
    claims: { state: "absent", note: "The Draft claims sheet is not in this build's data, so there is nothing to lodge from here until the next rebuild." + QUICK,
      head: "", lines: [], strip: [], stress: "", held: "", orderings: [], rivals: [], activity: "", runs: "" },
    solved: { state: "absent", note: "The best Draft roster is not solved for this data, so this panel stays empty until the next rebuild.", head: "", pairs: [], ifTaken: "" },
    trades: { state: "absent", note: "The Draft trade search is not in this build's data, so this panel stays empty until the next rebuild.", both: [], ask: [], more: "" }
  };
  try {
    const isO = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
    const fin = function (x) { return typeof x === "number" && isFinite(x); };
    const f0 = function (x) { const v = Number(x); return isFinite(v) ? String(Math.round(v)) : "—"; };
    const f1 = function (x) { const v = Number(x); return isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : "—"; };
    const sgn = function (x) { const v = Number(x); return isFinite(v) ? (v >= 0 ? "+" : "−") + f1(Math.abs(v)) : "—"; };
    const pctS = function (x) { const v = Number(x); return isFinite(v) ? Math.round(Math.max(0, Math.min(1, v)) * 100) + "%" : "—"; };
    const ord = function (n) { const m = n % 100, s = m >= 11 && m <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"; return n + s; };
    const txt = function (s) { return typeof s === "string" && s.length > 0 && s.length < 200 ? s : ""; };
    // SAST is UTC+2 all year; the day and the date are written out, because a waiver run can be a week away.
    const sastDay = function (iso) {
      const t = typeof iso === "string" ? Date.parse(iso) : NaN;
      if (!isFinite(t)) return "";
      const d = new Date(t + 2 * 3600000);
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return days[d.getUTCDay()] + " " + d.getUTCDate() + " " + mons[d.getUTCMonth()] + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
    };
    if (!isO(mc) || !isO(mc.MC) || !isO(mc.E) || !isO(mc.MC.draft) || !isO(mc.MC.gw)) return view;
    const MC = mc.MC, E = mc.E, D = MC.draft, P = isO(E.P) ? E.P : {}, POS = isO(E.POS) ? E.POS : {};
    const PLAN = isO(mc.PLAN) ? mc.PLAN : {}, PRE = isO(mc.PRE) ? mc.PRE : {};
    const pl = function (id) { const p = P[id]; return isO(p) && typeof p.n === "string" && [1, 2, 3, 4].indexOf(p.p) >= 0 ? p : null; };
    const name = function (id) { const p = pl(id); return p ? p.n : "id " + f0(id); };
    const posOf = function (id) { const p = pl(id); return p && typeof POS[p.p] === "string" ? POS[p.p] : ""; };
    const same = function (a, b) { const x = pl(a), y = pl(b); return !!x && !!y && x.p === y.p; };
    const next = Number(MC.gw.next);
    if (!fin(next)) return view;
    const lg = isO(D.league) ? D.league : {};
    view.league = txt(lg.name);

    // the Draft horizon, read from the league's own draft settings (N2): the unfinished draft's first gameweek minus one
    const rd = isO(lg.redraft) ? lg.redraft : null;
    const cfgEnd = isO(E.CFG) && fin(E.CFG.draftEnd) ? E.CFG.draftEnd : null;
    const hz = rd && fin(rd.fromGw) ? rd.fromGw - 1 : cfgEnd;
    view.horizon = hz === null ? "The Draft horizon is not in this build's data."
      : "Draft horizon GW" + hz + (rd && fin(rd.fromGw) && sastDay(rd.at)
        ? ": the league re-drafts " + sastDay(rd.at) + " SAST, effective GW" + rd.fromGw + "."
        : ", from the league's settings.");
    const toHz = hz === null ? "the horizon" : "GW" + hz;
    view.toHz = toHz;

    // the waiver phase, with the full order (N2: reverse standings read from waiver_pick; rounds; nobody moves down)
    let order = [];
    try { order = typeof E.waiverOrder === "function" ? E.waiverOrder() : []; } catch (e) { order = []; }
    order = (Array.isArray(order) ? order : []).filter(function (s) { return txt(s) !== ""; });
    const me = txt(D.me), at = order.indexOf(me) + 1;
    const evs = isO(D.events) ? D.events : {}, ev = isO(evs[String(next)]) ? evs[String(next)] : {};
    const gwEv = Array.isArray(MC.gw.events) ? MC.gw.events.filter(function (e) { return isO(e) && Number(e.id) === next; })[0] : null;
    const wv = sastDay(ev.wv), dl = sastDay(ev.dl) || (gwEv ? sastDay(gwEv.dl) : "");
    const list = order.map(function (s, i) { return (i + 1) + ". " + s; }).join(", ");
    const place = at > 0 ? " You are " + ord(at) + " of " + order.length + "." : "";
    const until = dl ? "until the GW" + next + " deadline, " + dl + " SAST" : "until the GW" + next + " deadline";
    const processed = D.waiversProcessed === true;
    view.phase = processed
      ? "Draft waivers for GW" + next + " have settled. Anyone unclaimed can be signed instantly " + until + "; anyone dropped since is locked until the next waiver run." +
        (list ? " The order for that run: " + list + "." + place : "")
      : (wv ? "Draft waivers settle " + wv + " SAST. Until then every move is a claim" : "Until Draft waivers settle every move is a claim") +
        (list ? ", and claims settle in rounds in this order: " + list + "." + place : ".") +
        " Once they settle, anyone unclaimed can be signed instantly " + until + ".";

    const count = fin(overrides) && overrides > 0 ? overrides : 0;
    const hiddenBy = count ? count + (count === 1 ? " match price is" : " match prices are") + " overridden on the Odds tab" : "";
    const hashOk = !(typeof PRE.hash === "string" && typeof PLAN.hash === "string" && PRE.hash !== PLAN.hash);

    // (1) the claims sheet, in lodging order
    const C = isO(PRE.claims) ? PRE.claims : null;
    const sheet = C && Array.isArray(C.sheet) ? C.sheet.filter(function (q) { return isO(q) && pl(q.add) && pl(q.drop) && same(q.add, q.drop); }) : [];
    const wvMs = typeof ev.wv === "string" ? Date.parse(ev.wv) : NaN, t = Number(now);
    if (!C || !sheet.length || !hashOk) {
      if (C && !hashOk) view.claims.note = "The Draft claims sheet in this build was made from a different plan, so it is hidden until the next rebuild." + QUICK;
    } else if (count) {
      view.claims.state = "hidden";
      view.claims.note = "The Draft claims sheet was worked out on the built-in match prices, and " + hiddenBy + ", so it is hidden until that is undone or the build is refreshed." + QUICK;
    } else if (processed || (isFinite(wvMs) && isFinite(t) && t >= wvMs)) {
      view.claims.state = "stale";
      view.claims.note = "Draft waivers for GW" + next + (wv ? " settled " + wv + " SAST" : " have settled") + ", and this sheet was built for that run, so it is hidden until the next rebuild." + QUICK;
    } else {
      view.claims.state = "sheet";
      const landed = Array.isArray(C.landed) ? C.landed : [], lost = Array.isArray(C.lost) ? C.lost : [];
      const land = isO(C.land) ? C.land : {};
      const runs = fin(C.runs) && C.runs > 0 ? C.runs : null;
      view.claims.runs = runs ? grp(runs) : "";
      view.claims.head = "Lodge them in exactly this order. Gain: Draft points to " + toHz + "." +
        (runs ? " Chance: how often it lands in " + grp(runs) + " simulated waiver runs." : "") + " Label: the stress test's worst case.";
      let nL = 0, nT = 0, nR = 0;
      view.claims.lines = sheet.map(function (q, i) {
        const worst = landed.indexOf(q.add) >= 0 ? "lands" : lost.indexOf(q.add) >= 0 ? "taken first" : "not reached";
        if (worst === "lands") nL++; else if (worst === "taken first") nT++; else nR++;
        return { key: "cl" + i + "-" + f0(q.add), n: String(i + 1), add: name(q.add), drop: name(q.drop), pos: posOf(q.add), gain: sgn(q.gain),
          chance: fin(land[q.add]) ? pctS(land[q.add]) : "—", worst: worst, tone: worst === "lands" ? "go" : worst === "taken first" ? "out" : "dim",
          backupFor: q.kind === "backup" && pl(q.of) ? name(q.of) : "" };
      });
      const s0 = [];
      if (fin(C.valueNow)) s0.push({ k: "Roster today", v: f0(C.valueNow), sub: "Draft points to " + toHz });
      if (fin(C.meanValue)) s0.push({ k: "Expected after claims", v: f0(C.meanValue), sub: (fin(C.valueNow) ? sgn(C.meanValue - C.valueNow) + ", " : "") + (fin(C.p10) && fin(C.p90) ? f0(C.p10) + " to " + f0(C.p90) : "") });
      if (fin(C.valueStress)) s0.push({ k: "Worst case", v: f0(C.valueStress), sub: "the stress test" });
      const all = fin(C.valueAll) ? C.valueAll : C.allFirst;
      if (fin(all)) s0.push({ k: "Every first choice", v: f0(all), sub: "the ceiling" });
      view.claims.strip = s0;
      const NAMES = { firsts: "all first choices, then backups", paired: "each backup under its first choice" };
      const kept = NAMES[C.strategy] || txt(C.strategy), other = C.strategy === "firsts" ? NAMES.paired : C.strategy === "paired" ? NAMES.firsts : "";
      view.claims.stress = "Stress test, the league's own processing with every rival lodging the moves the model rates best for them: " +
        nL + " of " + sheet.length + " claims land, " + nT + " are taken first and " + nR + (nR === 1 ? " is" : " are") + " not reached." +
        (kept && fin(C.valueStress) ? " This order (" + kept + ") ends on " + f1(C.valueStress) + " Draft points to " + toHz +
          (other && fin(C.altValue) ? ", against " + f1(C.altValue) + " with " + other : "") + "." : "");
      const held = Array.isArray(C.held) ? C.held.filter(function (h) { return isO(h) && pl(h.add) && pl(h.drop); }) : [];
      view.claims.held = held.length ? "Held back because flagged: " + held.map(function (h) {
        return name(h.add) + " for " + name(h.drop) + (txt(h.status) ? ", status " + h.status : "") + (fin(h.chance) ? " at " + Math.round(h.chance) + "%" : "");
      }).join("; ") + ". Re-check once the team news is in before lodging." : "";
      view.claims.orderings = (Array.isArray(C.orderings) ? C.orderings : []).filter(function (o) { return isO(o) && txt(o.name) && fin(o.mean); })
        .slice().sort(function (a, b) { return b.mean - a.mean; })
        .map(function (o, i) { return { key: "or" + i, name: o.name, mean: f1(o.mean), range: fin(o.p10) && fin(o.p90) ? f0(o.p10) + " to " + f0(o.p90) : "—", kept: o.name === kept }; });
      const R = isO(C.rivals) ? C.rivals : {};
      view.claims.rivals = Object.keys(R).filter(function (k) { return txt(k) && k !== me && Array.isArray(R[k]); }).map(function (k, i) {
        return { key: "rv" + i, team: k, wants: R[k].filter(function (id) { return pl(id); }).map(name).join(", ") || "nothing the model rates" };
      });
      const act = isO(D.activity) ? D.activity : {};
      const busy = Object.keys(act).filter(function (k) { return txt(k) && k !== me && isO(act[k]) && fin(act[k].claims) && fin(act[k].runs); })
        .sort(function (a, b) { return act[b].claims - act[a].claims; }).slice(0, 3);
      view.claims.activity = busy.length ? "Busiest in the league's own waiver log: " + busy.map(function (k) { return k + ", " + act[k].claims + " claims in " + act[k].runs + " runs"; }).join("; ") + "." : "";
    }

    // (2) the best roster to the re-draft, solved (the Draft half of PLAN)
    const A = isO(PLAN.draft) && PLAN.draft.ok === true && Array.isArray(PLAN.draft.pairs) ? PLAN.draft : null;
    if (A && count) {
      view.solved.state = "hidden";
      view.solved.note = "The best Draft roster was solved on the built-in match prices, and " + hiddenBy + ", so it is hidden until that is undone or the build is refreshed.";
    } else if (A) {
      view.solved.state = "solved";
      const pairs = A.pairs.filter(function (q) { return isO(q) && pl(q.add) && pl(q.drop) && same(q.add, q.drop); });
      const last = Array.isArray(A.weeks) && fin(A.weeks[A.weeks.length - 1]) ? A.weeks[A.weeks.length - 1] : hz;
      view.solved.head = pairs.length + (pairs.length === 1 ? " claim, " : " claims, ") + (fin(A.value) && fin(A.base) ? sgn(A.value - A.base) + " Draft points to GW" + last + " (" + f0(A.base) + " to " + f0(A.value) + ")." : "to GW" + last + ".");
      view.solved.pairs = pairs.map(function (q, i) {
        const a = pl(q.add);
        return { key: "sp" + i, add: name(q.add), drop: name(q.drop), pos: posOf(q.add), flag: a && a.st !== "a" ? "flagged, status " + String(a.st) + ", so held back from the sheet" : "" };
      });
      const B = isO(PLAN.draftIfTaken) && PLAN.draftIfTaken.ok === true && Array.isArray(PLAN.draftIfTaken.pairs) && Array.isArray(PLAN.draftIfTaken.excluded) && PLAN.draftIfTaken.excluded.length ? PLAN.draftIfTaken : null;
      if (B && fin(B.value) && fin(B.base)) {
        const ex = B.excluded.filter(function (id) { return pl(id); }).map(name);
        const bp = B.pairs.filter(function (q) { return isO(q) && pl(q.add) && pl(q.drop) && same(q.add, q.drop); });
        view.solved.ifTaken = "If " + (txt(PLAN.draftAhead) || "the team ahead of you") + " take " + (ex.length > 1 ? ex.slice(0, -1).join(", ") + " and " + ex[ex.length - 1] : ex.join("")) +
          " first, the next-best fifteen is worth " + sgn(B.value - B.base) + (bp.length ? ": " + bp.map(function (q) { return name(q.add) + " for " + name(q.drop); }).join(", ") : "") + ".";
      }
    }

    // (3) trades, position for position, "both gain" apart from "ask"
    const T = isO(PRE.trades) ? PRE.trades : null;
    if (T && count) {
      view.trades.state = "hidden";
      view.trades.note = "The Draft trade search was run on the built-in match prices, and " + hiddenBy + ", so it is hidden until that is undone or the build is refreshed.";
    } else if (T && Array.isArray(T.both) && Array.isArray(T.ask)) {
      view.trades.state = "trades";
      const line = function (x, i, g) {
        return { key: g + i, rival: txt(x.rival), get: name(x.get), give: name(x.give), pos: posOf(x.get), mine: sgn(x.mine), theirs: sgn(x.theirs) };
      };
      const ok = function (x) { return isO(x) && txt(x.rival) && x.rival !== me && pl(x.get) && pl(x.give) && same(x.get, x.give) && fin(x.mine) && fin(x.theirs); };
      const both = T.both.filter(ok), ask = T.ask.filter(ok);
      view.trades.both = both.slice(0, 4).map(function (x, i) { return line(x, i, "tb"); });
      view.trades.ask = ask.slice(0, 3).map(function (x, i) { return line(x, i, "ta"); });
      const more = Math.max(0, both.length - 4) + Math.max(0, ask.length - 3);
      view.trades.more = more ? "These lead on the two sides' combined change; " + more + (more === 1 ? " more swap passes" : " more swaps pass") + " the same screen." : "";
    }
  } catch (e) {
    view.claims.state = "absent"; view.solved.state = "absent"; view.trades.state = "absent";
  }
  return view;
}

/* The free agents, ranked by Draft points to the horizon, each with the phase-aware "how to get him" (E.howToGet:
   before waivers settle every unowned player is a claim; afterwards an available player signs instantly and one
   dropped since the last run is locked until the next, §7.4). limit caps the rows. */
function draftPoolView(mc, limit) {
  const view = { game: "draft", rows: [], total: "", head: "", toHz: "" };
  try {
    const isO = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
    if (!isO(mc) || !isO(mc.MC) || !isO(mc.E) || !isO(mc.MC.draft) || !isO(mc.MC.gw)) return view;
    const MC = mc.MC, E = mc.E, POS = isO(E.POS) ? E.POS : {};
    const next = Number(MC.gw.next), end = isO(E.CFG) ? Number(E.CFG.draftEnd) : NaN;
    if (!isFinite(next) || !isFinite(end) || typeof E.waiverPool !== "function" || typeof E.epRange !== "function" || typeof E.howToGet !== "function") return view;
    const n = Number(limit), cap = isFinite(n) && n >= 1 ? Math.min(40, Math.floor(n)) : 12;
    const processed = MC.draft.waiversProcessed === true;
    const pool = (function () { try { const v = E.waiverPool(); return Array.isArray(v) ? v : []; } catch (e) { return []; } })()
      .filter(function (p) { return isO(p) && typeof p.n === "string" && [1, 2, 3, 4].indexOf(p.p) >= 0; });
    const ranked = pool.map(function (p) { let h = NaN; try { h = Number(E.epRange(p, next, end)); } catch (e) { h = NaN; } return { pl: p, h: h }; })
      .filter(function (x) { return isFinite(x.h); }).sort(function (a, b) { return b.h - a.h; });
    view.total = String(ranked.length);
    view.toHz = "GW" + end;
    const lg = isO(MC.draft.league) && typeof MC.draft.league.name === "string" && MC.draft.league.name.length < 200 ? MC.draft.league.name : "";
    view.head = "From this build's Draft data" + (lg ? " for " + lg : "") + ", ranked by expected points to GW" + end + ", with how each one can be had " +
      (processed ? "now that waivers have settled." : "before waivers settle.");
    view.rows = ranked.slice(0, cap).map(function (x, i) {
      const p = x.pl;
      let how = "";
      try { how = E.howToGet(p) === "waiver" ? (processed ? "locked until next waivers" : "waiver claim") : "sign now"; } catch (e) { how = ""; }
      const cop = Number(p.cop);
      return { key: "fh" + i + "-" + String(p.id), rank: String(i + 1), name: p.n, pos: typeof POS[p.p] === "string" ? POS[p.p] : "", team: typeof p.t === "string" ? p.t : "",
        pts: String(Math.round(x.h)), how: how, flag: p.st && p.st !== "a" ? String(p.st) + (isFinite(cop) && p.cop !== null ? " " + Math.round(cop) + "%" : "") : "" };
    });
  } catch (e) { view.rows = []; view.total = ""; view.head = ""; view.toHz = ""; }
  return view;
}

function TabDraft(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on, state = props.state, mc = props.mc;
  /* v110 D3: the ported engine, the solved plan and the build-time Draft answers arrive as props.mc = { MC, PLAN, PRE, E },
     made once in App. PRE may be absent: the panels then say the sheet is not in this build's data. */
  const isMcObj = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
  if (!isMcObj(mc) || !isMcObj(mc.MC) || !isMcObj(mc.PLAN) || !isMcObj(mc.E) || typeof mc.E.waiverOrder !== "function") {
    throw new TypeError("TabDraft: props.mc must be the { MC, PLAN, PRE, E } object App builds");
  }
  const sec = function (id) { return openOf(ui, "draft", id); };
  const pool = ctx.draft.hasPool;
  const rosterInfo = draftRoster(state, ctx);
  const roster = rosterInfo.codes;
  const complete = rosterInfo.complete || state.draft.roster_complete === true;
  const checked = checkClaims(WEEKLY.draft.claims, ctx, roster);
  const engine = sec("df-waivers") ? draftWaivers(state, ctx) : [];
  const free = sec("df-pool") ? draftPool(ctx) : [];
  const order = pool ? waiverOrder(ctx) : null;
  const xi = sec("df-xi") ? draftXI(roster, ctx) : null;
  const h2h = sec("df-h2h") ? h2hProjection(ctx, { codes: roster }) : null;
  const audit = sec("df-watch") ? watchlistAudit(state.draft.watchlist, ctx) : null;
  const wHours = ctx.draft.waiversTime ? (msOf(ctx.draft.waiversTime) - ctx.now) / 3600000 : null;
  const saved = state.draft.league_input || (state.draft.league_id === null ? (state.draft.entry_id === null ? "" : String(state.draft.entry_id)) : String(state.draft.league_id));
  /* v110 D3: every build-time Draft answer (the claims sheet, the solved roster, the trades) was worked out on the built-in
     match prices, so a price typed on the Odds tab (state.market, carried into ctx.state) hides each behind its own note.
     The free agents are ranked live by the engine, which App has already given the typed prices. */
  const mktOf = function (s) { return s && typeof s === "object" && s.market && typeof s.market === "object" && !Array.isArray(s.market) ? s.market : null; };
  const mkt = mktOf(ctx && ctx.state) || mktOf(state) || {};
  const mktCount = Object.keys(mkt).reduce(function (n, g) { return n + (mkt[g] && typeof mkt[g] === "object" ? Object.keys(mkt[g]).length : 0); }, 0);
  const mktKey = (function () { try { return JSON.stringify(mkt); } catch (e) { return ""; } })();
  const dRev = ui && ui.reveals && typeof ui.reveals === "object" ? ui.reveals : {};
  const dOpen = sec("df-claims") || sec("df-solved") || sec("df-trades"), poolOpen = sec("df-pool");
  const clock = ctx ? Number(ctx.now) : NaN;
  const dv = React.useMemo(function () {
    return dOpen ? draftTabView(mc, clock, mktCount) : null;
  }, [dOpen, mc, clock, mktCount]);
  const pv = React.useMemo(function () {
    return poolOpen ? draftPoolView(mc, 12) : null;
  }, [poolOpen, mc, mktKey]);
  const poolTable = pv && pv.rows.length ? (
    <div className="dfv" data-testid="df-pool-horizon">
      <div className="dim">{pv.head}</div>
      <div className="tbl">
        <Row head cols="22px minmax(0,1fr) 40px minmax(0,92px)">
          <span>#</span><span>Player</span><span className="rt">{"To " + pv.toHz}</span><span>How to get him</span>
        </Row>
        {pv.rows.map(function (x) {
          return (
            <Row key={x.key} cols="22px minmax(0,1fr) 40px minmax(0,92px)">
              <span className="dim">{x.rank}</span>
              <span className="dfln">{x.name} <span className="dim">{x.pos} {x.team}</span>{x.flag ? " " : null}{x.flag ? <span className="tag tag-d">{x.flag}</span> : null}</span>
              <span className="rt">{x.pts}</span>
              <span className={"dfhow " + (x.how === "sign now" ? "go" : "dim")}>{x.how}</span>
            </Row>
          );
        })}
      </div>
      <div className="dim"><Tier k="T0" /> ownership and waiver phase · <Tier k="model" /> Draft points to the horizon</div>
    </div>
  ) : null;
  const [txt, setTxt] = React.useState(saved);
  const typed = txt.trim();
  const parsed = draftLeagueInput(typed);
  const changed = typed !== saved;
  return (
    <div>
      {pool ? null : (
        <div className="note note-w">Roster is {roster.length} of 15 and the free agents are unknown. Save the draft league id and both read from the API.</div>
      )}
      {pool && !complete ? (
        <div className="note note-w">The league answers, but your fifteen is {roster.length} of 15.</div>
      ) : null}

      <Section id="df-claims" title="Claims to lodge, in this order" open={sec("df-claims")} onToggle={on.sec}>
        {dv ? (
          <div className="dfv" data-testid="df-claims">
            <div className="dim" data-testid="df-horizon"><span className="tag">Draft</span> {dv.horizon}</div>
            <div className="note" data-testid="df-phase">{dv.phase}</div>
            {dv.claims.state !== "sheet" ? <div className="note note-w" data-testid="df-claims-note">{dv.claims.note}</div> : (
              <div className="dfv">
                <div className="dim">{dv.claims.head}</div>
                <div className="tbl" data-testid="df-sheet">
                  <Row head cols="20px minmax(0,1fr) 46px 54px">
                    <span>#</span><span>Claim: add for drop</span><span className="rt">Gain</span><span className="rt">Chance</span>
                  </Row>
                  {dv.claims.lines.map(function (c) {
                    return (
                      <Row key={c.key} cols="20px minmax(0,1fr) 46px 54px">
                        <span className="dim">{c.n}</span>
                        <span className="dfln"><span className="go">{c.add}</span> <span className="dim">for</span> <span className="out">{c.drop}</span></span>
                        <span className="rt">{c.gain}</span>
                        <span className="rt">{c.chance}</span>
                        <span className="mini">
                          <span>{c.pos}</span>
                          <span className={c.tone}>{c.worst}</span>
                          {c.backupFor ? <span>{"backup for " + c.backupFor}</span> : null}
                        </span>
                      </Row>
                    );
                  })}
                  {dv.claims.held ? <div className="note note-w">{dv.claims.held}</div> : null}
                </div>
                <div className="pstrip" data-testid="df-strip">
                  {dv.claims.strip.map(function (c) {
                    return (
                      <div className="pst" key={c.k}>
                        <span className="pst-k">{c.k}</span>
                        <span className="pst-v">{c.v}</span>
                        <span className="pst-s">{c.sub}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="dim" data-testid="df-stress">{dv.claims.stress}</div>
                <Reveal id="df-orderings" label={dv.claims.orderings.length + " orderings of the same Draft claims" + (dv.claims.runs ? ", " + dv.claims.runs + " simulated waiver runs each" : "")}
                  open={!!dRev["df-orderings"]} onToggle={on.rev}>
                  <div className="tbl" data-testid="df-orderings-list">
                    <Row head cols="minmax(0,1fr) 66px 80px"><span>Ordering</span><span className="rt">Expected</span><span className="rt">Range</span></Row>
                    {dv.claims.orderings.map(function (o) {
                      return (
                        <Row key={o.key} cols="minmax(0,1fr) 66px 80px">
                          <span className="dfln">{o.name}{o.kept ? " " : null}{o.kept ? <span className="tag tag-e">lodged</span> : null}</span>
                          <span className="rt">{o.mean}</span>
                          <span className="rt">{o.range}</span>
                        </Row>
                      );
                    })}
                    <div>Each rival is active as often as the league's own log shows and picks from the moves the model rates best for them; every ordering meets the same rival behaviour. The stress test above decides the order lodged.</div>
                  </div>
                </Reveal>
                <Reveal id="df-rivals" label="What the model has each rival claiming" open={!!dRev["df-rivals"]} onToggle={on.rev}>
                  <div data-testid="df-rivals-list">
                    {dv.claims.rivals.map(function (r) {
                      return (
                        <Row key={r.key} cols="minmax(0,120px) minmax(0,1fr)">
                          <span className="dfln">{r.team}</span>
                          <span className="dfln">{r.wants}</span>
                        </Row>
                      );
                    })}
                    {dv.claims.activity ? <div>{dv.claims.activity}</div> : null}
                  </div>
                </Reveal>
              </div>
            )}
            <div className="dim"><Tier k="T0" /> order and times · <Tier k="model" /> points and chances</div>
          </div>
        ) : null}
      </Section>

      <Section id="df-solved" title="Best roster to the re-draft, solved" open={sec("df-solved")} onToggle={on.sec}>
        {!dv ? null : dv.solved.state !== "solved" ? <div className="note note-w" data-testid="df-solved-note">{dv.solved.note}</div> : (
          <div className="dfv" data-testid="df-solved">
            <div className="panel-v"><span className="tag">Draft</span> <b>{dv.solved.head}</b></div>
            <div className="dim">The optimiser picks the best fifteen from your roster and every claimable player, re-picking the best eleven every gameweek to the re-draft. In head to head that is also what raises the chance of winning each week.</div>
            {dv.solved.pairs.length ? (
              <div>
                {dv.solved.pairs.map(function (q) {
                  return (
                    <Row key={q.key} cols="minmax(0,1fr) 40px">
                      <span className="dfln"><span className="go">{q.add}</span> <span className="dim">for</span> <span className="out">{q.drop}</span></span>
                      <span className="rt dim">{q.pos}</span>
                      {q.flag ? <span className="mini"><span className="warnt">{q.flag}</span></span> : null}
                    </Row>
                  );
                })}
              </div>
            ) : <div className="dim">No change beats your current fifteen.</div>}
            {dv.solved.ifTaken ? <div className="dim">{dv.solved.ifTaken}</div> : null}
            <div className="dim"><Tier k="model" /> Draft optimiser, solved at build time</div>
          </div>
        )}
      </Section>

      <Section id="df-waivers" title="Quick check: the app's own claim search" open={sec("df-waivers")} onToggle={on.sec}>
        <KV k={"GW" + ctx.nextEvent + " waivers process"} v={ctx.draft.waiversTime ? sastText(ctx.draft.waiversTime) + ", " + leftLine(wHours) : "unknown"} tone={wHours !== null && wHours < 6 ? "out" : ""} />
        {pool ? <KV k="Your claim order" v={order && order.mine ? order.mine.position + " of " + order.mine.of : "not known"} /> : null}
        {pool ? (
          <div>
            {engine.length ? engine.slice(0, 8).map(function (c) {
              return (
                <Row key={"e-" + c.out + "-" + c.in} cols="22px minmax(0,1fr) 46px">
                  <span className="dim">{c.priority}</span>
                  <span className="nm"><span className="out">{c.outName}</span> <span className="dim">to</span> <span className="go">{c.inName}</span></span>
                  <span className="rt">{one(c.gain)}</span>
                  <span className="mini" style={{ gridColumn: "1 / -1" }}>
                    <span className={c.forced ? "out" : "dim"}>{c.forced ? "forced" : "upgrade"}</span>
                    <span>{c.why}</span>
                  </span>
                </Row>
              );
            }) : <div className="dim">No claim clears the bar: nothing in the free agents beats what you have.</div>}
            <div className="dim">Claimed from the league's own free agents. <Tier k="T0" /> ownership · <Tier k="model" /> five-week xP</div>
            {checked.some(function (c) { return c.issues.length; }) ? (
              <div className="note">Written claims to re-check: {checked.filter(function (c) { return c.issues.length; }).map(function (c) { return c.inName + " for " + c.outName + " (" + c.issues.join("; ") + ")"; }).join(" · ")}.</div>
            ) : null}
            <Reveal id="df-written" label="The written claims, checked" open={!!ui.reveals["df-written"]} onToggle={on.rev}>
              {checked.map(function (c) {
                return <div key={c.key}>{c.priority}. {c.outName} to {c.inName}, {one(c.gain)}{c.issues.length ? " — " + c.issues.join("; ") : " — valid"}</div>;
              })}
            </Reveal>
          </div>
        ) : (
          <div>
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
          </div>
        )}
      </Section>

      <Section id="df-pool" title="Free agents" open={sec("df-pool")} onToggle={on.sec}>
        {pool ? (
          <div>
            <KV k="Unclaimed and available" v={free.length} />
            {poolTable}
            <Reveal id="df-pool-app" label="The app's own five-week ranking, with the three-start rule" open={!!dRev["df-pool-app"]} onToggle={on.rev}>
            <div data-testid="df-pool-app">
            {free.slice(0, 12).map(function (p, i) {
              return (
                <Row key={"fa-" + p.code} cols="22px minmax(0,1fr) 34px 46px">
                  <span className="dim">{i + 1}</span>
                  <span className="nm">{p.web_name} <span className="dim">{POS_NAME[p.element_type]} {teamOf(ctx, p.id)}</span></span>
                  <span className={"rt " + (p.eligible ? "go" : "dim")}>{p.starts_last3}/3</span>
                  <span className="rt">{one(p.ev)}</span>
                </Row>
              );
            })}
            <div className="dim">Ranked on five-week xP times P(start). The three-start column is the watchlist rule: a name earns its place by starting the last three. <Tier k="T0" /> ownership and starts</div>
            </div>
            </Reveal>
          </div>
        ) : (
          <div>
          <div className="dim">The pool is unknown until a draft league id is saved. Nothing is listed rather than a guess at who is unclaimed.</div>
          {poolTable}
          </div>
        )}
      </Section>

      <Section id="df-trades" title="Trades, position for position" open={sec("df-trades")} onToggle={on.sec}>
        {!dv ? null : dv.trades.state !== "trades" ? <div className="note note-w" data-testid="df-trades-note">{dv.trades.note}</div> : (
          <div className="dfv" data-testid="df-trades">
            <div className="dim">{"A rival accepts only a swap that helps their side too. Every swap here is like for like, and both sides' changes are Draft points to " + dv.toHz + "."}</div>
            <div className="panel-k">Both sides gain</div>
            {dv.trades.both.length ? dv.trades.both.map(function (x) {
              return (
                <Row key={x.key} cols="minmax(0,1fr) 40px">
                  <span className="dfln">Get <span className="go">{x.get}</span> from {x.rival} for <span className="out">{x.give}</span></span>
                  <span className="rt dim">{x.pos}</span>
                  <span className="mini"><span>{"you " + x.mine + ", they " + x.theirs}</span></span>
                </Row>
              );
            }) : <div className="dim">No swap gains both sides on these numbers.</div>}
            <div className="panel-k">Worth asking, at a small cost to them</div>
            {dv.trades.ask.length ? dv.trades.ask.map(function (x) {
              return (
                <Row key={x.key} cols="minmax(0,1fr) 40px">
                  <span className="dfln">Get <span className="go">{x.get}</span> from {x.rival} for <span className="out">{x.give}</span></span>
                  <span className="rt dim">{x.pos}</span>
                  <span className="mini"><span>{"you " + x.mine + ", they " + x.theirs}</span></span>
                </Row>
              );
            }) : <div className="dim">No swap is worth asking for on these numbers.</div>}
            {dv.trades.ask.length ? <div className="dim">They lose a little on paper, so lead with why the swap fits their squad.</div> : null}
            {dv.trades.more ? <div className="dim">{dv.trades.more}</div> : null}
            <div className="dim"><Tier k="model" /> Draft points to {dv.toHz}, searched against every rival at build time</div>
          </div>
        )}
      </Section>


      <Section id="df-h2h" title="Head to head" open={sec("df-h2h")} onToggle={on.sec}>
        {h2h && h2h.ok ? (
          <div>
            <KV k={"GW" + h2h.gw + " opponent"} v={h2h.opponent.name} />
            <KV k="Projected" v={one(h2h.mine.mean) + " against " + one(h2h.theirs.mean)} />
            <KV k="Margin" v={(h2h.margin >= 0 ? "+" : "") + one(h2h.margin)} tone={h2h.margin >= 0 ? "go" : "out"} />
            <div className="dim">Tenth to ninetieth of the margin {one(h2h.marginDist.q10)} to {one(h2h.marginDist.q90)}, over {h2h.iters} draws that share each fixture between the two teams. <Tier k="model" /> Monte Carlo</div>
            <div className="note">{h2h.lean === "up" ? "Behind on the projection: the eleven takes the higher ceiling." : h2h.lean === "down" ? "Ahead on the projection: the eleven takes the steadier floor." : "Level: the eleven is simply the highest expected points."}</div>
          </div>
        ) : (
          <div className="dim">{pool ? (h2h && h2h.note ? h2h.note : "No head-to-head fixture for this gameweek.") : "No head-to-head fixture without the draft league id: this week's opponent comes from the league's own fixture list."}</div>
        )}
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
            {xi.lean === "none" ? (
              <div className="note">Head to head is won by beating one opponent, not the field: when you are behind, pick the higher ceiling; when you are ahead, pick the steadier floor. No captain in this league.</div>
            ) : (
              <div className="note">{xi.note}. No captain in this league.</div>
            )}
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
        <KV k="Saved" v={saved === "" ? "none" : saved} />
        {pool ? <KV k="Reading" v={((ctx.draft.league || {}).name || "league " + ctx.draft.leagueId) + ", " + ctx.draft.entries.length + " teams"} /> : null}
        {pool && ctx.draft.me ? <KV k="Your team" v={(ctx.draft.entryById[ctx.draft.me.leagueEntryId] || {}).name || ctx.draft.me.leagueEntryId} /> : null}
        <input className="inp" data-testid="draft-league" placeholder="League address, league id, or your entry id"
          aria-label="Draft league" value={txt} onChange={function (e) { setTxt(e.target.value); }}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done"
          onKeyDown={function (e) {
            if (e.key !== "Enter" || (e.nativeEvent && e.nativeEvent.isComposing)) return;
            e.preventDefault();
            if (changed) props.onLeague(typed === "" ? null : typed);
            e.currentTarget.blur();
          }} />
        {typed && !parsed.ok ? <div className="note note-w">{parsed.note}</div> : null}
        {typed && parsed.ok ? <div className="dim">Read as {parsed.kind === "entry" ? "entry" : parsed.kind === "league" ? "league" : "number"} {parsed.id}: {parsed.note}</div> : null}
        {changed ? (
          <button className="btn btn-go" data-testid="draft-league-save"
            onClick={function () { props.onLeague(typed === "" ? null : typed); }}>
            {typed === "" ? "Clear" : "Save"}
          </button>
        ) : null}
        <div className="dim">It is the number in the address when you open the league in the draft app. Your own entry number works too.</div>
        <div className="dim">With it the roster, the free agents, the claim order and this week's opponent come from the draft API instead of being typed in. The next refresh of the snapshot picks it up.</div>
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
  const solve = sec("ch-solver") ? chipSolver(ctx, {}) : null;
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

      <Section id="ch-solver" title="Chip solver" open={sec("ch-solver")} onToggle={on.sec}>
        <Guard ctx={ctx} onConfirm={props.onConfirm} where="ch-solver">
        {solve ? (
          <div>
            <KV k="Set one" v={"GW" + solve.sets[0].from + " to the GW" + solve.sets[0].to + " deadline"} />
            <KV k="Set two" v={"GW" + solve.sets[1].from + " to GW" + solve.sets[1].to} />
            <KV k="Confirmed windows" v={solve.confirmed ? solve.doubles.length + " doubles, " + solve.blanks.length + " blanks" : "none"} tone={solve.confirmed ? "go" : "out"} />
            {solve.plan.length ? (
              <div className="tbl">
                <Row head cols="44px 44px 52px minmax(0,1fr)">
                  <span>Chip</span><span className="rt">Set</span><span className="rt">GW</span><span className="rt">Worth</span>
                </Row>
                {solve.plan.map(function (a) {
                  return (
                    <Row key={"cs-" + a.set + a.chip} cols="44px 44px 52px minmax(0,1fr)">
                      <span>{a.chip}</span>
                      <span className="rt dim">{a.set}</span>
                      <span className="rt">{a.event}</span>
                      <span className="rt">{one(a.value)} pts</span>
                    </Row>
                  );
                })}
              </div>
            ) : <div className="panel-v">Nothing is assigned.</div>}
            <div className="note note-w">{solve.windowNote}</div>
            <Reveal id="ch-solver-how" label="How each one is priced" open={!!ui.reveals["ch-solver-how"]} onToggle={on.rev}>
              {solve.candidates.map(function (c) {
                return <div key={"cw-" + c.set + c.chip + c.event}>{c.chip} in GW{c.event}, set {c.set}: {one(c.value)} points — {c.basis}. {c.detail}.</div>;
              })}
              <div>Bench Boost is the sum of the bench in that gameweek, Triple Captain the extra multiple on the best single fixture, Free Hit the best eleven available in a blank minus your own, and the Wildcard the deficit the timing model already computes. The Free Hit figure is an upper bound: the replacement eleven applies neither the budget nor the three-per-club cap.</div>
              <div>The two sets are solved together, not one at a time: a chip is used once per set, inside that set's expiry, and never two chips in one gameweek.</div>
            </Reveal>
            <div className="dim">Doubles and blanks are counted from the published fixture list, one fixture at a time, and never assumed. <Tier k="T0" /> fixtures</div>
          </div>
        ) : null}
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

/* The engine now publishes each model's per-transition Spearman (tournament().models[].
   perTransition), so this reads the engine's own numbers rather than recovering them from the
   running mean. Nothing is recomputed here. */
function tourTransitions(live, tour) {
  const out = [];
  try {
    const t = tour && Array.isArray(tour.models) ? tour : tournament(live);
    const keys = live && live.gw && typeof live.gw === "object"
      ? Object.keys(live.gw).map(Number).filter(function (n) { return isFinite(n); }).sort(function (a, b) { return a - b; })
      : [];
    const n = Number(t.transitions) || 0;
    for (let i = 0; i < n; i++) {
      const from = keys[i] === undefined ? i + 1 : keys[i];
      const to = keys[i + 1] === undefined ? from + 1 : keys[i + 1];
      const row = { label: from + " to " + to, rho: {} };
      t.models.forEach(function (m) {
        const v = Array.isArray(m.perTransition) && m.perTransition.length > i ? m.perTransition[i] : null;
        row.rho[m.key] = v === undefined ? null : v;
      });
      out.push(row);
    }
  } catch (e) { return out; }
  return out;
}

/* ------------------------------------------------------------------ v110 §5 D6 · the Lab: method, limits, dated sources

   Ports the kit's vLab (the kit's ui.js 357–375) and backtestHtml (376–392) into four closed Lab sections: lab-method,
   lab-backtest, lab-limits and lab-sources. Every figure is read when the section draws, from MC (the baked block and its
   model block), PLAN (the solve, pipeline/plan.cjs), PRE (the build, pipeline/precompute.cjs) and the ported engine's own
   fit (E.calib, E.CFG); none is typed (v110 §1.7). A line that carries a game's figure names its game and never both
   (§1.1, Part N3); model figures carry the model tier. Times are SAST (UTC+2), a UTC time quoted inside a source's own
   note included. Free transfers, hits and bank are never read from the solver's own fields here either (§6). The
   helpers are total: junk in any slot gives the empty view or an empty string, never a throw. */

/* "GW3, GW4 and GW5" from a list of gameweek numbers; anything that is not a whole gameweek is dropped. */
function labGwList(list) {
  const g = (Array.isArray(list) ? list : []).filter(function (x) { return typeof x === "number" && isFinite(x) && x === Math.trunc(x) && x >= 1 && x <= 38; })
    .map(function (x) { return "GW" + x; });
  return g.length < 2 ? g.join("") : g.slice(0, -1).join(", ") + " and " + g[g.length - 1];
}

/* A source's own note may quote a time in UTC ("pulled 26 Sep 17:15Z"); the app shows every time in SAST, so the time
   is moved to UTC+2 with its date (the year is the research's own), and a bare time is moved on the clock. */
function labSastText(s, year) {
  if (typeof s !== "string") return "";
  const y = typeof year === "number" && isFinite(year) && year >= 2000 && year <= 2200 ? Math.trunc(year) : null;
  const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = function (n) { return String(n).padStart(2, "0"); };
  const dated = s.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}):(\d{2}) ?(?:Z|UTC)\b/g, function (all, d, mon, h, mi) {
    if (y === null || Number(h) > 23 || Number(mi) > 59) return all;
    const t = Date.UTC(y, mons.indexOf(mon), Number(d), Number(h), Number(mi)) + 2 * 3600000;
    if (!isFinite(t)) return all;
    const x = new Date(t);
    return x.getUTCDate() + " " + mons[x.getUTCMonth()] + " " + pad(x.getUTCHours()) + ":" + pad(x.getUTCMinutes()) + " SAST";
  });
  return dated.replace(/\b(\d{1,2}):(\d{2}) ?(?:Z|UTC)\b/g, function (all, h, mi) {
    const hh = Number(h) + 2;
    if (Number(h) > 23 || Number(mi) > 59) return all;
    return pad(hh % 24) + ":" + mi + " SAST" + (hh >= 24 ? " the next day" : "");
  });
}

/* What the four sections show. mc is App's { MC, PLAN, PRE, E }. */
function labView(mc) {
  const empty = { ok: false, none: "The ported engine and its data blocks are not in this build, so there is nothing to show here.",
    method: [], bt: null, limits: [], build: [], deskHead: "", desk: [], solve: [] };
  try {
    const MC = mc && typeof mc === "object" && mc.MC && typeof mc.MC === "object" ? mc.MC : null;
    if (!MC || !MC.gw || typeof MC.gw !== "object") return empty;
    const E = mc.E && typeof mc.E === "object" ? mc.E : null;
    const PLAN = mc.PLAN && typeof mc.PLAN === "object" ? mc.PLAN : {};
    const PRE = mc.PRE && typeof mc.PRE === "object" ? mc.PRE : {};
    const fin = function (x) { return typeof x === "number" && isFinite(x); };
    const f1 = function (x) { return fin(x) ? (x < 0 ? "−" : "") + Math.abs(x).toFixed(1) : "—"; };
    const f2 = function (x) { return fin(x) ? (x < 0 ? "−" : "") + Math.abs(x).toFixed(2) : "—"; };
    const kx = function (x) { return fin(x) ? String(Math.round(x * 100) / 100) : "—"; };
    const pct2 = function (x) { return fin(x) ? (x * 100).toFixed(2) + "%" : "—"; };
    const n0 = function (x) { return fin(x) ? String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "—"; };
    const secsT = function (x) { return !fin(x) ? "—" : x < 1 ? "under a second" : Math.round(x) + " s"; };
    const when = function (iso) { const t = sastDate(iso); return t ? t + " SAST" : ""; };
    const txt = function (x) { return typeof x === "string" ? x.slice(0, 400) : ""; };
    const plural = function (n, one, many) { return n === 1 ? one : many; };
    const POSN = { 1: "Goalkeepers", 2: "Defenders", 3: "Midfielders", 4: "Forwards" };
    const intel = MC.intel && typeof MC.intel === "object" ? MC.intel : {};
    const next = fin(MC.gw.next) ? MC.gw.next : null, lastDone = fin(MC.gw.lastDone) ? MC.gw.lastDone : null;
    const pl = PLAN.plan && typeof PLAN.plan === "object" && PLAN.plan.ok === true && Array.isArray(PLAN.plan.weeks) && PLAN.plan.weeks.length &&
      PLAN.plan.weeks.every(function (w) { return w && fin(w.gw); }) ? PLAN.plan : null;
    const w0 = pl ? pl.weeks[0].gw : null, wN = pl ? pl.weeks[pl.weeks.length - 1].gw : null;
    const hash = typeof PLAN.hash === "string" ? PLAN.hash.slice(0, 64) : "", preHash = typeof PRE.hash === "string" ? PRE.hash.slice(0, 64) : "";
    const same = hash !== "" && hash === preHash;
    const src = PLAN.source && typeof PLAN.source === "object" ? PLAN.source : {};
    const model = MC.model && typeof MC.model === "object" ? MC.model : {};
    const bt = model.backtest && typeof model.backtest === "object" ? model.backtest : null;
    const calib = model.calib && typeof model.calib === "object" ? model.calib : {};
    const corr = function (k) { const c = Number(calib[k]); return isFinite(c) ? c : 1; };
    const byPos = bt && bt.points && bt.points.byPos && typeof bt.points.byPos === "object" ? bt.points.byPos : {};
    const keys = Object.keys(byPos).filter(function (k) { return POSN[k] && byPos[k] && typeof byPos[k] === "object" && fin(byPos[k].ratio); }).sort();
    const corrected = keys.filter(function (k) { return Math.abs(corr(k) - 1) > 1e-9; });
    const alone = keys.filter(function (k) { return corrected.indexOf(k) < 0; });
    /* "only halfway" is a claim about the numbers, so it is checked on them: each correction is 1 + half the observed gap */
    const halfway = corrected.length > 0 && corrected.every(function (k) { return Math.abs(corr(k) - (1 + (byPos[k].ratio - 1) / 2)) <= 0.0015; });
    const excl = keys.length > 0 && keys.every(function (k) {
      const x = byPos[k]; return (Math.abs(corr(k) - 1) > 1e-9) === (fin(x.lo) && fin(x.hi) && (x.lo > 1 || x.hi < 1));
    });
    const btWeeks = bt ? labGwList(bt.weeks) : "";
    const cal = E && E.calib && typeof E.calib === "object" ? E.calib : null;
    const cfg = E && E.CFG && typeof E.CFG === "object" ? E.CFG : {};
    const d = MC.draft && typeof MC.draft === "object" ? MC.draft : {};
    const v = { ok: true, none: "", method: [], bt: null, limits: [], build: [], deskHead: "", desk: [], solve: [] };
    const add = function (head, text) { if (text) v.method.push({ head: head, text: text }); };

    // ── how the numbers are made
    add("Team strength.", "Each side's attack and defence start from what the game's own prices say about its most expensive attackers and " +
      "defenders, then move toward this season's opponent-adjusted expected goals, with actual goals given the smaller share. The season's " +
      "share grows with every match played" + (lastDone !== null ? "; " + lastDone + plural(lastDone, " played gameweek is", " played gameweeks are") + " in so far." : "."));
    if (cal && fin(cal.n) && cal.n > 0) {
      add("Bookmaker prices.", "The price-to-strength exponents are fitted so the ratings reproduce " + cal.n + " bookmaker-implied numbers" +
        (labGwList(cal.weeks) ? " from " + labGwList(cal.weeks) : "") + ": attack exponent " + kx(cal.ka) + ", defence exponent " + kx(cal.kd) +
        (fin(cal.rmse) ? ", and the typical miss is " + Math.round(cal.rmse * 100) + "% per number" : "") + ". Match prices become goals for each " +
        "side by removing the bookmaker's margin and fitting the scoreline odds; where a market number exists, it replaces the model.");
    } else add("Bookmaker prices.", "No bookmaker-implied number reached the fit in this build, so the ratings rest on prices and this season's matches alone.");
    add("Players.", "Expected goals and assists per 90 minutes this season, pulled toward a price-based prior" +
      (fin(cfg.kShrink) ? " worth " + cfg.kShrink + " matches" : "") + " and scaled by the fixture. Clean sheets, goals conceded, saves, bonus, " +
      "defensive contributions and cards are all priced in.");
    if (keys.length) {
      const said = corrected.map(function (k) { return POSN[k].toLowerCase() + " ×" + corr(k).toFixed(3) + " for an observed " + f2(byPos[k].ratio); });
      const left = alone.map(function (k) { return POSN[k].toLowerCase(); });
      const leftTxt = left.length ? (left.length < 2 ? left[0] : left.slice(0, -1).join(", ") + " and " + left[left.length - 1]) + " are left alone" +
        (excl ? " because their range includes 1" : "") : "";
      add("Backtest and correction.", "Each data refresh re-forecasts " + (btWeeks || "the played gameweeks") + " from what was known before each deadline and " +
        "scores the forecasts (the table below). Position corrections come only from that evidence" + (excl ? ", only where the 90% range excludes 1" : "") +
        (halfway ? ", and only halfway: " : ": ") + (said.length ? said.join(", ") : "none applies in this build") + (leftTxt ? "; " + leftTxt : "") +
        ". A correction scales everything except the appearance points.");
    }
    const st = intel.start && typeof intel.start === "object" && next !== null && intel.start[String(next)] && typeof intel.start[String(next)] === "object"
      ? Object.keys(intel.start[String(next)]).length : 0;
    add("Minutes.", "Recent starts weigh more than old ones. Official flags set availability, and return dates switch a player back on in the " +
      "right gameweek. Where reporting runs ahead of an official flag, a dated override from the desk research is used instead" +
      (next !== null ? ": " + st + plural(st, " dated override is", " dated overrides are") + " in force for GW" + next + "." : "."));
    if (pl) {
      const pa = pl.params && typeof pl.params === "object" ? pl.params : {};
      const wts = [];
      if (fin(pa.decay)) wts.push("each week counts " + pa.decay + " of the week before");
      if (fin(pa.benchW)) wts.push("the outfield bench counts " + pa.benchW + " of its points");
      if (fin(pa.tau)) wts.push("every transfer carries a " + pa.tau + "-point friction");
      if (fin(pa.ftValue)) wts.push("each free transfer still banked at the end is worth " + pa.ftValue);
      add("Classic plan.", "One mixed-integer programme over every gameweek from GW" + w0 + " to GW" + wN + ": the squad, the eleven, the captain, " +
        "every transfer and hit, the free-transfer bank and the chip weeks are decided together." +
        (wts.length ? " In the objective " + (wts.length < 2 ? wts[0] : wts.slice(0, -1).join(", ") + " and " + wts[wts.length - 1]) + "." : "") +
        (fin(pl.detail) ? " Transfers are planned week by week for " + pl.detail + " gameweeks, then the squad is held to GW" + wN + "." : ""));
      add("Why it solves on one core.", "Only squad membership is integer. Given a whole squad, the eleven, the armband, the chip flags and the buy " +
        "and sell flows form a totally unimodular system, so their optimum comes out whole on its own and the search only has to branch on squads." +
        (fin(pl.gap) && fin(pl.secs) ? " This Classic plan was proved within " + pct2(pl.gap) + " of the best possible in " + Math.round(pl.secs) + " seconds." : ""));
    } else {
      add("Classic plan.", "No solved Classic plan is in this build. The optimiser is one mixed-integer programme over every gameweek to the " +
        "chip deadline, with only squad membership integer; until a solve for this data lands, the quick search on the Classic tab answers.");
    }
    if (hash && pl) {
      add("Solved off the phone.", "The solve runs detached on the build machine and writes its output after every stage; the app never solves, " +
        "it reads the committed plan. The plan carries the content hash of the data it was solved on, " + hash + ", and is shown only while " +
        "that matches this build's hash" + (same ? ", which it does." : preHash ? ": this build's is " + preHash + ", so the solved plan is set aside." : ": this build carries none, so the solved plan is set aside."));
    }
    const rp = PLAN.replay && typeof PLAN.replay === "object" && Array.isArray(PLAN.replay.weeks) ? PLAN.replay : null;
    if (pl && rp) {
      const nd = Array.isArray(rp.differences) ? rp.differences.length : 0;
      add("Replayed, not read.", "Free transfers, hits and the bank come from a week-by-week replay of the Classic ledger under the game's rules, " +
        "never from the solver's own variables, which are only upper bounds. " + (rp.agrees === true && nd === 0
          ? "The replay agrees with the solve on all " + rp.weeks.length + " planned weeks."
          : "The replay differs from the solve on " + Math.max(1, nd) + " of " + rp.weeks.length + " planned weeks, and the replay is what is shown."));
    }
    const dr = PLAN.draft && typeof PLAN.draft === "object" && PLAN.draft.ok === true ? PLAN.draft : null;
    const dIf = PLAN.draftIfTaken && typeof PLAN.draftIfTaken === "object" && PLAN.draftIfTaken.ok === true ? PLAN.draftIfTaken : null;
    const ahead = txt(PLAN.draftAhead);
    if (dr) {
      const dw = Array.isArray(dr.weeks) ? dr.weeks.filter(fin) : [];
      add("Draft roster.", "Solved the same way" + (dw.length ? " to GW" + dw[dw.length - 1] : "") + ", as the best fifteen from your roster plus " +
        "every claimable player, with the eleven re-picked each week and a small cost on every player brought in. " + f1(dr.base) + " expected Draft points as " +
        "the roster stands, " + f1(dr.value) + " solved" + (dIf && ahead ? ", and " + f1(dIf.value) + " if " + ahead + ", ahead of you in the waiver " +
        "order, takes what the model expects it to." : "."));
    } else add("Draft roster.", "No solved Draft roster is in this build; the Draft tab's own search answers until one lands.");
    const act = d.activity && typeof d.activity === "object" ? d.activity : {};
    const claims = Object.keys(act).reduce(function (s, t) { const c = act[t] && fin(act[t].claims) ? act[t].claims : 0; return s + c; }, 0);
    const runs = (Array.isArray(d.waiverRuns) ? d.waiverRuns.filter(fin) : []).slice().sort(function (a, b) { return a - b; });
    add("Waivers.", "Draft claims settle the way this league's own log shows: in rounds, in the order read from the league's waiver picks, each " +
      "manager's claims tried in the order lodged until one lands, “already claimed” checked before “drop already gone”, and nobody sent to " +
      "the bottom after a success." + (claims > 0 && runs.length ? " Every build replays the league's own " + claims + " claims from the GW" + runs[0] +
      " to GW" + runs[runs.length - 1] + " waiver runs and must reproduce each result before it ships." : ""));
    const cs = PRE.classicSim && typeof PRE.classicSim === "object" ? PRE.classicSim : null;
    const hh = PRE.h2h && typeof PRE.h2h === "object" ? PRE.h2h : null;
    const cl = PRE.claims && typeof PRE.claims === "object" ? PRE.claims : null;
    const sims = [];
    if (cs && fin(cs.gw) && fin(cs.draws)) sims.push("Classic GW" + cs.gw + ": " + n0(cs.draws) + " runs.");
    if (hh && fin(hh.gw) && fin(hh.draws)) sims.push("Draft GW" + hh.gw + " head-to-head: " + n0(hh.draws) + " runs.");
    if (cl && Array.isArray(cl.orderings) && cl.orderings.length && fin(cl.runs)) sims.push("Draft claims: " + cl.orderings.length + " lodging orders, " +
      n0(cl.runs) + " runs each, with the deterministic stress test choosing the order.");
    add("Simulation.", "Each run draws every scoreline, then deals goals and assists to players by their share, so team-mates rise and fall " +
      "together; substitutes come on in bench order, as in the real game." + (sims.length ? " " + sims.join(" ") : ""));
    add("Two engines.", "The quick searches on the Classic and Draft tabs are the app's own greedy engine, run on your phone for what-if checks, " +
      "and so are the tournament, the minutes model and the team-strength table further down. Where both engines answer the same question, the " +
      "solved answer leads and the app's own sits behind a labelled reveal.");

    // ── the backtest by position
    if (bt && keys.length) {
      const mi = bt.minutes && typeof bt.minutes === "object" ? bt.minutes : null;
      const go = bt.goals && typeof bt.goals === "object" ? bt.goals : null;
      const all = bt.points && bt.points.all && typeof bt.points.all === "object" ? bt.points.all : null;
      const bands = mi && Array.isArray(mi.buckets) ? mi.buckets.filter(function (b) { return b && fin(b.n) && b.n > 0 && fin(b.pred) && fin(b.act); }) : [];
      const band = bands.length ? Math.round(100 * Math.max.apply(null, bands.map(function (b) { return Math.abs(b.pred - b.act); }))) : null;
      const ll = go && fin(go.logLik) && fin(go.logLikNaive) ? go.logLik - go.logLikNaive : null;
      v.bt = {
        lede: "Each of " + (btWeeks || "the played gameweeks") + " is forecast again from what was known before its deadline, then scored against what " +
          "happened. Points are judged only for players who started, so injuries the model could not see do not distort the result; who starts " +
          "is judged separately.",
        rows: keys.map(function (k) {
          const x = byPos[k];
          return { key: k, name: POSN[k], starts: fin(x.n) ? String(x.n) : "—", pred: f1(x.meanPred), act: f1(x.meanAct),
            ratio: f2(x.ratio) + " (" + f2(x.lo) + "–" + f2(x.hi) + ")", corr: corrected.indexOf(k) >= 0 ? "×" + corr(k).toFixed(3) : "none",
            rank: f2(x.rho) + " / " + f2(x.rhoNaive), err: f1(x.mae) + " / " + f1(x.maeNaive) };
        }),
        all: all && fin(all.rho) && fin(all.rhoNaive) && fin(all.n) ? "All positions: rank correlation " + f2(all.rho) + " against " + f2(all.rhoNaive) +
          " naive over " + n0(all.n) + " starts." : "",
        minutes: mi && fin(mi.brier) && fin(mi.brierNaive) && fin(mi.n) ? "Who starts: Brier score " + mi.brier.toFixed(3) + " against " +
          mi.brierNaive.toFixed(3) + " for “same as last week” (lower is better), over " + n0(mi.n) + " player-weeks" +
          (band !== null ? "; forecast start chances land within " + band + " points of the observed rate in every band." : ".") : "",
        goals: ll !== null && fin(go.n) ? "Team goals: log-likelihood " + f1(go.logLik) + " against " + f1(go.logLikNaive) + " for a flat league " +
          "average over " + go.n + " matches; " + (Math.abs(ll) < 2 ? "no measurable difference yet on a sample this small." : ll > 0
            ? "the model is ahead." : "the flat average is ahead.") : "",
        note: (halfway && excl ? "A correction is applied only where the 90% range excludes 1, at half the observed gap. " : "") +
          "The naive benchmark is each player's points per start so far."
      };
    }

    // ── what it cannot see
    v.limits.push("The solved plan, the claims sheet and every figure baked into this build are fixed when it is built" +
      (when(PRE.at) ? ", " + when(PRE.at) : "") + ". The Refresh panel above can check flags and prices; it never re-solves the plan, and a new " +
      "plan needs a rebuild from the feeds.");
    const ev = Array.isArray(MC.gw.events) ? MC.gw.events.filter(function (e) { return e && e.id === next; })[0] : null;
    if (next !== null) v.limits.push("Your saved Classic team for GW" + next + " stays private until its deadline" + (ev && when(ev.dl) ? ", " + when(ev.dl) : "") +
      ". The plan starts from your last published team" + (lastDone !== null ? ", GW" + lastDone : "") + ", which is also your current fifteen unless " +
      "you have made transfers since.");
    v.limits.push("Rivals' Draft elevens publish only after each deadline. Before then the " + (hh && fin(hh.gw) ? "GW" + hh.gw + " " : "") +
      "head-to-head assumes " + (hh && txt(hh.opp) && hh.theirSaved !== true ? txt(hh.opp) + " fields its" : "each rival fields their") + " best eleven.");
    if (lastDone !== null) v.limits.push("A sample of " + lastDone + plural(lastDone, " played gameweek", " played gameweeks") + " is small: " +
      "early-season projections lean on prices and sharpen each week.");
    const O = intel.odds && typeof intel.odds === "object" ? intel.odds : {};
    const fixt = Array.isArray(MC.fixtures) ? MC.fixtures : [];
    const cover = next === null ? [] : Object.keys(O).map(Number).filter(function (g) { return fin(g) && g >= next; }).sort(function (a, b) { return a - b; })
      .map(function (g) {
        const fx = fixt.filter(function (f) { return f && f.gw === g; });
        const rows = Array.isArray(O[g]) ? O[g] : Array.isArray(O[String(g)]) ? O[String(g)] : [];
        const have = rows.filter(function (r) { return Array.isArray(r) && fx.some(function (f) { return f.h === r[0] && f.a === r[1]; }); }).length;
        return { g: g, have: have, all: fx.length };
      }).filter(function (c) { return c.have > 0; });
    const coverTxt = cover.map(function (c) { return "GW" + c.g + " (" + c.have + " of " + c.all + " matches)"; });
    const lastCov = cover.length ? cover[cover.length - 1].g : next;
    const cEnd = pl ? wN : fin(cfg.classicEnd) ? cfg.classicEnd : null, dEnd = fin(cfg.draftEnd) ? cfg.draftEnd : null;
    if (next !== null) v.limits.push("Bookmaker prices are loaded for " + (coverTxt.length ? (coverTxt.length < 2 ? coverTxt[0] : coverTxt.slice(0, -1).join(", ") +
      " and " + coverTxt[coverTxt.length - 1]) : "no gameweek yet") + ". From GW" + (cover.length ? lastCov + 1 : next) + " the team ratings carry the fixtures" +
      (cEnd !== null && dEnd !== null ? ", to GW" + cEnd + " in Classic and GW" + dEnd + " in Draft" : "") + "; add prices on the Odds tab as they appear.");

    // ── sources, dated, and how the plans were solved
    if (when(MC.asOf)) v.build.push("Official Fantasy Premier League and FPL Draft public feeds, pulled " + when(MC.asOf) + ".");
    if (when(model.at)) v.build.push("Backtest and position corrections fitted " + when(model.at) + ".");
    if (preHash) v.build.push("This build" + (when(PRE.at) ? " " + when(PRE.at) : "") + "; content hash " + preHash + (same ? ", the same as the solved plan's." : hash
      ? "; the solved plan's is " + hash + ", so it is set aside." : "; no solved plan carries one."));
    const yr = (function () { const t = Date.parse(typeof intel.asOf === "string" ? intel.asOf : MC.asOf); return isFinite(t) ? new Date(t).getUTCFullYear() : null; })();
    v.desk = (Array.isArray(intel.sources) ? intel.sources : []).map(function (s) { return labSastText(txt(s), yr); }).filter(Boolean).slice(0, 60);
    v.deskHead = v.desk.length ? "Desk research" + (when(intel.asOf) ? ", dated " + when(intel.asOf) : "") + ", each note from the source it names:" : "";
    const sol = function (r) { return r && typeof r === "object" && r.ok === true && fin(r.gap) && fin(r.secs) ? "within " + pct2(r.gap) + " in " + secsT(r.secs) : ""; };
    if (pl) v.solve.push("Classic plan: solved" + (when(PLAN.at) ? " " + when(PLAN.at) : "") + (txt(src.data) ? " from " + txt(src.data) : "") +
      (sol(pl) ? ", proved " + sol(pl) : "") + (txt(src.solvedBy) ? " (kept: " + txt(src.solvedBy) + ")" : "") + ".");
    else v.solve.push("Classic plan: no solve for this data is in this build.");
    if (pl && sol(PLAN.noWildcard)) v.solve.push("Classic, no wildcard before GW" + wN + ": " + sol(PLAN.noWildcard) + ".");
    if (pl && sol(PLAN.undecayed)) v.solve.push("Classic, every week weighted equally: " + sol(PLAN.undecayed) + ".");
    const tm = PLAN.timing && typeof PLAN.timing === "object" ? PLAN.timing : null;
    if (pl && tm) {
      const parts = ["now", "later", "never"].filter(function (k) { return sol(tm[k]); }).map(function (k) { return k + " " + sol(tm[k]); });
      if (parts.length) v.solve.push("Classic wildcard timing, solved" + (when(tm.at) ? " " + when(tm.at) : "") + ": " + parts.join(", ") + ".");
    }
    if (pl && txt(src.longSolve)) v.solve.push("Classic, a longer re-solve: " + txt(src.longSolve) + ".");
    if (pl && txt(src.timingFold)) v.solve.push("Classic wildcard timing, pipeline note: " + txt(src.timingFold) + ".");
    if (dr && fin(dr.secs)) v.solve.push("Draft roster: solved in " + secsT(dr.secs) + (dIf && fin(dIf.secs) ? "; again with " + (ahead ? ahead + "'s" : "the manager ahead's") +
      " modelled claims taken first, in " + secsT(dIf.secs) : "") + ".");
    return v;
  } catch (e) { return empty; }
}

function TabLab(props) {
  const ctx = props.ctx, ui = props.ui, on = props.on, state = props.state, rf = props.refresh;
  const sharing = canShareFiles();
  const sec = function (id) { return openOf(ui, "lab", id); };
  const tour = sec("lab-tour") ? tournament(ctx.live) : null;
  const mwf = sec("lab-minutes") ? minutesWalkForward(ctx.live, { bins: 5 }) : null;
  const mfold = mwf ? mwf.folds.filter(function (f) { return f.fitted; }).slice(-1)[0] || null : null;
  const mterms = mwf ? minutesFit(ctx.live, 0, {}).terms : [];
  const tags = sec("lab-ts") ? overUnderTags(ctx.live) : null;
  const [imp, setImp] = React.useState("");
  const [copied, setCopied] = React.useState("");
  const [fileErr, setFileErr] = React.useState("");
  const json = JSON.stringify(state, null, 2);
  const bars = tour ? tour.models.slice().sort(function (a, b) { return (b.spearman || 0) - (a.spearman || 0); }) : [];
  const chart = bars.filter(function (m) { return m.spearman !== null; }).map(function (m) { return { name: m.name, rho: Number((m.spearman || 0).toFixed(3)) }; });
  const trans = tour ? tourTransitions(ctx.live, tour) : [];
  const scored = bars.filter(function (m) { return m.spearman !== null; });
  const lead4 = scored.slice(0, 4);
  const spread = lead4.length > 1 ? lead4[0].spearman - lead4[lead4.length - 1].spearman : 0;
  const swing = trans.length > 1 ? scored.reduce(function (mx, m) {
    const vals = trans.map(function (t) { return t.rho[m.key]; }).filter(function (v) { return v !== null && v !== undefined; });
    if (vals.length < 2) return mx;
    const d = Math.max.apply(null, vals) - Math.min.apply(null, vals);
    return d > mx ? d : mx;
  }, 0) : 0;
  const transCols = "minmax(76px,1fr) repeat(" + Math.max(1, trans.length) + ", 52px)";
  const leadRow = tour ? scored.filter(function (m) { return m.key === tour.leader; })[0] || scored[0] || null : null;
  const gateNeed = leadRow && leadRow.gate ? leadRow.gate.need : 3;
  const gateHold = leadRow && leadRow.gate ? leadRow.gate.needHoldout : 2;
  /* v110 D6: the four ported sections read the blocks only when one of them is open */
  const lv = sec("lab-method") || sec("lab-backtest") || sec("lab-limits") || sec("lab-sources") ? labView(props.mc) : null;
  const btC1 = "minmax(0,1fr) 44px 58px 50px", btC2 = "minmax(0,1fr) 108px 64px", btC3 = "minmax(0,1fr) 80px 72px";
  return (
    <div>
      <Section id="lab-data" title="Data" open={sec("lab-data")} onToggle={on.sec}>
        <KV k="Snapshot taken" v={sastText(ctx.live.fetched_at) + " SAST"} />
        <KV k="Age" v={ageText((ctx.now - msOf(ctx.live.fetched_at)) / 3600000)} />
        <KV k="Next event" v={"GW" + ctx.nextEvent + ", " + sastText(ctx.deadline) + " SAST"} />
        <KV k="Finished gameweeks" v={ctx.finishedGws.join(", ") || "none"} />
        <KV k="Players, teams, fixtures" v={ctx.elList.length + ", " + ctx.teamList.length + ", " + ctx.fixtures.length} />
        <div className="dim">{ctx.live.source} <Tier k="T0" /></div>
      </Section>

      <Section id="lab-refresh" title="Refresh" open={sec("lab-refresh")} onToggle={on.sec}>
        {rf.dist ? null : <div className="dim">Model and search pairing</div>}
        {rf.dist ? null : (
          <select className="inp" data-testid="refresh-pair" value={state.refresh.pair} aria-label="Model and search tool"
            onChange={function (e) { rf.onPair(e.target.value); }}>
            {Object.keys(REFRESH_PAIRS).map(function (k) {
              return <option key={k} value={k}>{REFRESH_PAIRS[k].model}</option>;
            })}
          </select>
        )}
        <button className="btn" data-testid="refresh-run" onClick={rf.onRefresh} disabled={rf.busy}>
          <RefreshCw aria-hidden="true" />{rf.busy ? "Checking" : rf.dist ? "Check for new data" : "Check flags and prices"}
        </button>
        {rf.busy ? <div className="refbar" data-testid="refbar-lab"><i /></div> : null}
        {rf.err ? <div className="err" data-testid="refresh-err">{rf.err}</div> : null}
        {rf.okMsg ? <div className="note">{rf.okMsg}</div> : null}
        {rf.dist ? (
          <div className="dim">Asks the server for a newer build of this page. The player snapshot travels inside the page, so a newer build brings newer flags and prices. Nothing is sent to Anthropic from here. <Tier k="T0" /> once the new build loads</div>
        ) : (
          <div className="dim">One search, one JSON reply, four thousand tokens so the search results cannot eat the answer. A failure leaves the snapshot exactly as it was. <Tier k="T0" /> after it lands</div>
        )}
      </Section>

      <Section id="lab-method" title="How the numbers are made" open={sec("lab-method")} onToggle={on.sec}>
        {lv && lv.ok ? (
          <div>
            <div className="dim">The ported engine behind the solved plan, the claims sheet and the projections. A line that carries a game's figure names its game. <Tier k="model" /></div>
            <ul className="labl" data-testid="lab-method-list">
              {lv.method.map(function (m, i) { return <li key={"lm" + i}><b>{m.head}</b> {m.text}</li>; })}
            </ul>
          </div>
        ) : <div className="dim">{lv ? lv.none : ""}</div>}
      </Section>

      <Section id="lab-backtest" title="Backtest by position" open={sec("lab-backtest")} onToggle={on.sec}>
        {lv && lv.ok && lv.bt ? (
          <div>
            <div className="dim">{lv.bt.lede} <Tier k="model" /></div>
            <div className="tbl labt" data-testid="lab-bt-points">
              <Row head cols={btC1}><span>Given a start</span><span className="rt">Starts</span><span className="rt">Forecast</span><span className="rt">Actual</span></Row>
              {lv.bt.rows.map(function (r) {
                return (
                  <Row key={"bp" + r.key} cols={btC1}>
                    <span className="nm">{r.name}</span><span className="rt">{r.starts}</span><span className="rt">{r.pred}</span><span className="rt">{r.act}</span>
                  </Row>
                );
              })}
            </div>
            <div className="tbl labt" data-testid="lab-bt-ratio">
              <Row head cols={btC2}><span>Position</span><span className="rt">Actual ÷ forecast, 90% range</span><span className="rt">Correction applied</span></Row>
              {lv.bt.rows.map(function (r) {
                return (
                  <Row key={"br" + r.key} cols={btC2}>
                    <span className="nm">{r.name}</span><span className="rt">{r.ratio}</span><span className="rt">{r.corr}</span>
                  </Row>
                );
              })}
            </div>
            <div className="tbl labt" data-testid="lab-bt-rank">
              <Row head cols={btC3}><span>Position</span><span className="rt">Rank corr. model / naive</span><span className="rt">Error model / naive</span></Row>
              {lv.bt.rows.map(function (r) {
                return (
                  <Row key={"bk" + r.key} cols={btC3}>
                    <span className="nm">{r.name}</span><span className="rt">{r.rank}</span><span className="rt">{r.err}</span>
                  </Row>
                );
              })}
            </div>
            <div className="labn" data-testid="lab-bt-notes">
              {lv.bt.all ? <div>{lv.bt.all}</div> : null}
              {lv.bt.minutes ? <div>{lv.bt.minutes}</div> : null}
              {lv.bt.goals ? <div>{lv.bt.goals}</div> : null}
              <div className="dim">{lv.bt.note}</div>
            </div>
          </div>
        ) : <div className="dim">{lv && lv.ok ? "No walk-forward backtest is in this build's model block." : lv ? lv.none : ""}</div>}
      </Section>

      <Section id="lab-limits" title="What it cannot see" open={sec("lab-limits")} onToggle={on.sec}>
        {lv && lv.ok ? (
          <ul className="labl" data-testid="lab-limits-list">
            {lv.limits.map(function (x, i) { return <li key={"ll" + i}>{x}</li>; })}
          </ul>
        ) : <div className="dim">{lv ? lv.none : ""}</div>}
      </Section>

      <Section id="lab-sources" title="Sources" open={sec("lab-sources")} onToggle={on.sec}>
        {lv && lv.ok ? (
          <div>
            <ul className="labl" data-testid="lab-sources-list">
              {lv.build.map(function (x, i) { return <li key={"lb" + i}>{x}</li>; })}
            </ul>
            {lv.desk.length ? <div className="dim labt">{lv.deskHead}</div> : null}
            {lv.desk.length ? <ul className="labl">{lv.desk.map(function (x, i) { return <li key={"ld" + i}>{x}</li>; })}</ul> : null}
            <div className="dim labt">How the plans were solved:</div>
            <ul className="labl" data-testid="lab-solve-list">
              {lv.solve.map(function (x, i) { return <li key={"ls" + i}>{x}</li>; })}
            </ul>
          </div>
        ) : <div className="dim">{lv ? lv.none : ""}</div>}
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
            {trans.length ? (
              <div className="tbl">
                <Row head cols={transCols}>
                  <span>Per transition</span>
                  {trans.map(function (t) { return <span key={t.label} className="rt">{t.label}</span>; })}
                </Row>
                {bars.map(function (m) {
                  return (
                    <Row key={"tr-" + m.key} cols={transCols}>
                      <span className="nm">{m.name}</span>
                      {trans.map(function (t) {
                        const v = t.rho[m.key];
                        return <span key={t.label} className="rt">{v === null || v === undefined ? "—" : two(v)}</span>;
                      })}
                    </Row>
                  );
                })}
              </div>
            ) : null}
            <div className="note note-w">
              {tour.transitions} transition{tour.transitions === 1 ? "" : "s"} is not a verdict. The four leading models sit inside {two(spread)} of one another{trans.length > 1 ? ", while a single model moves as much as " + two(swing) + " between them" : ""}, so the order in this table is not decision-grade in either direction. {leadRow ? leadRow.name + " leads the table and led " + leadRow.wins + " of the " + tour.transitions + " transitions" : "No model has been scored yet"}, and it promotes nothing: the shared gate wants {gateNeed} scored transitions, {gateNeed} of them won and a {gateHold}-gameweek hold-out, and there {tour.transitions === 1 ? "is" : "are"} {tour.transitions}. The figures the plan carries from version 86 — BPS rate leading at 0.148, component xP last at 0.032 — are not reproduced here either. Player xG is the F5 challenger and component xP is barred by E6; neither drives a recommendation, and the production xP is unchanged.
            </div>
            <div className="note">{tour.note}</div>
            <div className="dim">{tour.maeNote}</div>
            <div className="dim">Eight models score the next gameweek from data up to the last one. Promotion needs three transitions ahead, so the leader here drives nothing yet. <Tier k="model" /></div>
          </div>
        ) : null}
      </Section>

      <Section id="lab-minutes" title="Minutes model" open={sec("lab-minutes")} onToggle={on.sec}>
        {mwf ? (
          <div>
            <KV k="Driving P(start)" v="the Laplace rate" tone="go" />
            <KV k="Challenger" v="minutes logistic (F4)" />
            <KV k="Transitions fitted and scored" v={mwf.comparable + " of " + mwf.folds.length} />
            <KV k="Base rate, did he start" v={mfold ? pc(mfold.baseRate) : "—"} />
            <div className="tbl">
              <Row head cols="minmax(0,1fr) 56px 56px 58px">
                <span>Brier, lower wins</span><span className="rt">Laplace</span><span className="rt">Logistic</span><span className="rt">Ahead</span>
              </Row>
              {mwf.folds.map(function (f) {
                return (
                  <Row key={"mf-" + f.from + "-" + f.to} cols="minmax(0,1fr) 56px 56px 58px">
                    <span className="nm">GW{f.from} to GW{f.to}</span>
                    <span className="rt">{f.incumbent ? f.incumbent.brier.toFixed(4) : "—"}</span>
                    <span className="rt">{f.challenger ? f.challenger.brier.toFixed(4) : "not fitted"}</span>
                    <span className={"rt " + (f.winner === "challenger" ? "go" : "dim")}>{f.winner === "not scored" ? "—" : f.winner === "challenger" ? "logistic" : f.winner}</span>
                  </Row>
                );
              })}
            </div>
            <Reveal id="lab-min-rel" label="Reliability curve" open={!!ui.reveals["lab-min-rel"]} onToggle={on.rev}>
              {mfold && mfold.challenger ? (
                <div className="tbl">
                  <Row head cols="88px 30px 44px minmax(68px,1fr)">
                    <span>Forecast</span><span className="rt">n</span><span className="rt">Said</span><span className="rt">Happened</span>
                  </Row>
                  {mfold.challenger.reliability.bins.map(function (b) {
                    return (
                      <Row key={"rb-" + b.lo} cols="88px 30px 44px minmax(68px,1fr)">
                        <span className="nm">{pc(b.lo)} to {pc(b.hi)}</span>
                        <span className="rt">{b.n}</span>
                        <span className="rt">{b.n ? pc(b.meanPred) : "—"}</span>
                        <span className="rt">{b.n ? pc(b.meanOutcome) : "—"}</span>
                      </Row>
                    );
                  })}
                  <div className="dim">Largest gap between what it said and what happened: {pc(mfold.challenger.reliability.maxGap)} on GW{mfold.to}.</div>
                </div>
              ) : <div className="dim">No transition has been fitted yet, so there is no curve to draw.</div>}
            </Reveal>
            <Reveal id="lab-min-terms" label="What is in the model" open={!!ui.reveals["lab-min-terms"]} onToggle={on.rev}>
              <div className="tbl">
                <Row head cols="minmax(0,1fr) 84px 62px">
                  <span>Term</span><span className="rt">Coefficient</span><span className="rt">Fitted</span>
                </Row>
                {mterms.map(function (t) {
                  return (
                    <Row key={"mt-" + t.name} cols="minmax(0,1fr) 84px 62px">
                      <span className="nm">{t.name.replace(/_/g, " ")}</span>
                      <span className="rt">{t.coef === null ? "—" : two(t.coef)}</span>
                      <span className={"rt " + (t.fitted ? "" : "dim")}>{t.fitted ? "yes" : "no"}</span>
                    </Row>
                  );
                })}
              </div>
              {mterms.filter(function (t) { return !t.fitted; }).map(function (t) {
                return <div key={"mw-" + t.name} className="dim">{t.name.replace(/_/g, " ")}: {t.why}</div>;
              })}
            </Reveal>
            <div className="note note-w">{mwf.note} Until that gate opens, every P(start) on every other screen is the Laplace rate from E1, and this panel is the only place the logistic appears.</div>
            <div className="dim">Brier is the mean squared error of a probability forecast: 0 is perfect, the base rate alone scores {mfold ? two(mfold.baseRate * (1 - mfold.baseRate)) : "—"} here. Fit on the gameweeks up to k, score on k+1, never the other way round. <Tier k="model" /></div>
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
          <button className="btn" data-testid="export-download" onClick={function () { props.onDownload(json); }}><Download aria-hidden="true" />{sharing ? "Share or save" : "Download"}</button>
          {canCopy() ? <button className="btn" data-testid="export-copy" onClick={function () { props.onCopy(json).then(function (ok) { setCopied(ok ? "copied to the clipboard" : "the clipboard refused; use Download"); }); }}>Copy</button> : null}
        </div>
        {copied ? <div className="dim">{copied}</div> : null}
        <div className="dim">On an iPhone this opens the share sheet: choose Save to Files. Elsewhere the file downloads.</div>
        <div className="dim">The repository is the permanent store: commit the exported file as the state of record. The app's own storage is per device and not linked to any drive.</div>
      </Section>

      <Section id="lab-import" title="Import" open={sec("lab-import")} onToggle={on.sec}>
        <textarea className="inp" data-testid="import-text" placeholder="Paste an exported state" aria-label="Exported state"
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          value={imp} onChange={function (e) { setImp(e.target.value); }} />
        <label className="btn filebtn">
          <Upload aria-hidden="true" />Import from a file
          <input type="file" accept="application/json,.json" data-testid="import-file" aria-label="Import a state file" onChange={function (e) {
            const el = e.target, f = el.files && el.files[0];
            if (!f) return;
            setFileErr("");
            if (f.size > 5000000) { setFileErr("That file is too large to be an export."); el.value = ""; return; }
            readFileText(f).then(function (t) { props.onImport(t); }, function (err) { setFileErr("That file could not be read: " + shortErr(err)); });
            el.value = "";
          }} />
        </label>
        {fileErr ? <div className="err">{fileErr}</div> : null}
        {imp.trim() ? <button className="btn btn-go" data-testid="import-apply" onClick={function () { props.onImport(imp); setImp(""); }}>Apply</button> : null}
        {props.importErr ? <div className="err">{props.importErr}</div> : null}
        <div className="dim">Anything unreadable is dropped rather than trusted: the squad is capped at fifteen and de-duplicated on id.</div>
      </Section>

      <Section id="lab-device" title="This device" open={sec("lab-device")} onToggle={on.sec}>
        <DeviceReadout mode={props.storeMode} onCopy={props.onCopy} />
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
  /* iOS 27: the host and the mode come from what the page has (a marker on the dist shim, the display-mode media query,
     navigator.standalone), never from the user agent. swNew: a newer build has taken over. checkMsg: what a check found. */
  const isDist = React.useMemo(hostIsDist, []);
  const isApp = React.useMemo(runsAsApp, []);
  const [swNew, setSwNew] = React.useState(pwaUpdated);
  const [checkMsg, setCheckMsg] = React.useState("");
  const [imported, setImported] = React.useState(false);
  /* IOS27-11: a settled refresh is spoken once, after .refbar has gone. Where ariaNotify exists it is called and the status
     region stays empty; otherwise the region carries the text. The region is cleared when the next refresh starts, so an
     outcome that repeats is still a change a screen reader speaks. */
  const [said, setSaid] = React.useState("");
  const wasBusy = React.useRef(false);
  React.useEffect(function () {
    const h = function () { setSwNew(true); };
    window.addEventListener("mc-sw-updated", h);
    return function () { window.removeEventListener("mc-sw-updated", h); };
  }, []);
  React.useEffect(function () {
    if (!checkMsg) return undefined;
    const h = setTimeout(function () { setCheckMsg(""); }, 8000);
    return function () { clearTimeout(h); };
  }, [checkMsg]);

  const ctx = React.useMemo(function () { return buildCtx(live, state, now); }, [live, state, now]);
  React.useEffect(function () {
    if (busy) { wasBusy.current = true; setSaid(function (t) { return t ? "" : t; }); return; }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    const msg = refreshMessage(refErr, isDist, okMsg, ctx.nextEvent);
    if (!ariaSpeak(msg)) setSaid(msg);
  }, [busy]);
  const premLocked = !!(boot.ui && boot.ui.reveals && boot.ui.reveals["wc-lock"]);
  const plan = React.useMemo(function () { return buildPlan(ctx, premLocked); }, [ctx, premLocked]);

  /* v110 D0 · the ported engine, made once. Every tab and the landing card get props.mc = { MC, PLAN, PRE, E }: the
     baked block, the solved plan, the build-time searches and the engine instance. src/engine.js keeps driving what it
     drives; where both engines answer one question the panel shows the proven answer and keeps the other in a Reveal. */
  const mce = React.useMemo(function () { return MCEngine.create(MC); }, []);
  const mc = React.useMemo(function () { return { MC: MC, PLAN: PLAN, PRE: PRE, E: mce }; }, [mce]);
  /* The Odds tab's overrides (state.market) are validated against the engine's own team list, and applied to the
     engine before any child renders, so every panel reading E sees the same prices. PRE stays as built. */
  const known = React.useMemo(function () { return { teams: mce.teamNames }; }, [mce]);
  const marketKey = JSON.stringify(state.market && typeof state.market === "object" ? state.market : {});
  React.useMemo(function () {
    try { mce.setMarket(JSON.parse(marketKey)); } catch (e) { /* the baked prices stand */ }
    return marketKey;
  }, [mce, marketKey]);

  const setUi = boot.setUi, setState = boot.setState;
  const on = React.useMemo(function () {
    return {
      sec: function (id) { setUi(function (u) { const o = {}; Object.keys(u.open).forEach(function (k) { o[k] = u.open[k]; }); o[id] = !openOf(u, u.tab, id); return { mode: u.mode, tab: u.tab, open: o, reveals: u.reveals }; }); },
      rev: function (id) { setUi(function (u) { const r = {}; Object.keys(u.reveals).forEach(function (k) { r[k] = u.reveals[k]; }); r[id] = !r[id]; return { mode: u.mode, tab: u.tab, open: u.open, reveals: r }; }); },
      /* market(gw, team, xg) stores one override; xg null or undefined removes it. sanitiseState drops anything that is
         not a gameweek 1–38, a known team and a finite xg from 0.2 to 5, so a bad entry never reaches the engine. */
      market: function (gw, team, xg) {
        setState(function (s) {
          const next = JSON.parse(JSON.stringify(s));
          const g = String(gw), t = String(team);
          next.market = next.market && typeof next.market === "object" ? next.market : {};
          if (xg === null || xg === undefined) {
            if (next.market[g]) { delete next.market[g][t]; if (!Object.keys(next.market[g]).length) delete next.market[g]; }
          } else {
            next.market[g] = next.market[g] && typeof next.market[g] === "object" ? next.market[g] : {};
            next.market[g][t] = { xg: Number(xg) };
          }
          return sanitiseState(next, known);
        });
      },
      /* v110 D1 · done(key) ticks or unticks one item of the Command tab's checklist, "<gameweek>:<item>", in state.done,
         which window.storage keeps with the rest of the state. sanitiseState keeps only a well-formed key set to true. */
      done: function (key) {
        setState(function (s) {
          const next = JSON.parse(JSON.stringify(s));
          const k = String(key);
          next.done = next.done && typeof next.done === "object" ? next.done : {};
          if (next.done[k] === true) delete next.done[k]; else next.done[k] = true;
          return sanitiseState(next, known);
        });
      }
    };
  }, [setUi, setState, known]);

  /* IOS27-08: every tab switch and menu jump also bumps `nav`, and one layout effect (after the new view has drawn, before
     it paints) lands the page: the top for a tab, the section for a jump. Nothing scrolls on the first render, so a
     reload keeps the position the browser restored. */
  const [nav, setNav] = React.useState({ n: 0, id: "" });
  React.useLayoutEffect(function () { if (nav.n > 0) landOn(nav.id); }, [nav]);
  const goTab = React.useCallback(function (tab) {
    setNav(function (v) { return { n: v.n + 1, id: "" }; });
    setUi(function (u) { return { mode: u.mode, tab: tab, open: u.open, reveals: u.reveals }; });
  }, [setUi]);
  const setMode = React.useCallback(function (mode) { setMenuOpen(false); setUi(function (u) { return { mode: mode, tab: u.tab, open: u.open, reveals: u.reveals }; }); }, [setUi]);
  const jump = React.useCallback(function (sectionId) {
    setMenuOpen(false);
    setNav(function (v) { return { n: v.n + 1, id: sectionId }; });
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
      return sanitiseState(next, known);
    });
  }, [live, setState, known]);

  /* One control, three acceptable answers: the league address, the league number, or his
     own entry number. A bare number is stored as a league id and the fetcher falls back to
     the entry endpoint if the league one does not answer — the app itself never calls the
     draft API (D4: the refresh path is the only network it does). */
  const onLeague = React.useCallback(function (text) {
    setState(function (s) {
      const next = JSON.parse(JSON.stringify(s));
      const raw = text === null || text === undefined ? "" : String(text).trim();
      if (!raw) {
        next.draft.league_id = null; next.draft.entry_id = null; next.draft.league_input = "";
        return sanitiseState(next, known);
      }
      const p = draftLeagueInput(raw);
      next.draft.league_input = raw;
      if (p.ok) {
        next.draft.league_id = p.kind === "entry" ? null : p.id;
        next.draft.entry_id = p.kind === "entry" ? p.id : null;
      }
      return sanitiseState(next, known);
    });
  }, [setState, known]);

  const onImport = React.useCallback(function (text) {
    setImportErr(null);
    try {
      const parsed = JSON.parse(text);
      const clean = sanitiseState(parsed, known);
      if (!clean.squad.length) throw new Error("no squad in that file");
      setState(clean);
      setImported(true);
    } catch (e) { setImportErr(shortErr(e)); }
  }, [setState, known]);

  /* IOS27-14: Export goes to the share sheet as one file where the platform allows it, and downloads otherwise (no sheet,
     or a sheet that refused). The download happens in the tap's own tick when there is no sheet to open. */
  const onDownload = React.useCallback(function (json) {
    const name = "mc_state_gw" + ctx.nextEvent + ".json";
    const p = tryShare(json, name);
    if (!p) { saveAsFile(json, name); return; }
    p.then(function (done) { if (!done) saveAsFile(json, name); });
  }, [ctx.nextEvent]);

  const onCopy = React.useCallback(function (json) {
    try { return navigator.clipboard.writeText(json).then(function () { return true; }, function () { return false; }); }
    catch (e) { return Promise.resolve(false); }
  }, []);

  const onPair = React.useCallback(function (pair) {
    setState(function (s) { const next = JSON.parse(JSON.stringify(s)); next.refresh.pair = pair; return sanitiseState(next, known); });
  }, [setState, known]);

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
      setState(function (s) { const n = JSON.parse(JSON.stringify(s)); n.refresh.last = nowISO(); return sanitiseState(n, known); });
    } catch (e) {
      setRefErr(shortErr(e));
    } finally {
      setBusy(false);
    }
  }, [busy, ctx, plan, live, state.refresh.pair, setState, known]);

  /* The dist build has no Claude call to make (the keyless proxy exists only in the artifact), so its refresh asks the
     server for a newer build; the artifact keeps the D4 request above. */
  const onCheck = React.useCallback(async function () {
    if (busy) return;
    setBusy(true); setRefErr(null); setOkMsg(""); setCheckMsg("");
    setMenuOpen(false);
    try {
      const r = await checkForNewBuild();
      if (r === "reload") { try { window.location.reload(); } catch (e) { /* nothing to reload */ } return; }
      if (r === "same") {
        const at = sastText(live && live.fetched_at);
        const m = "Nothing newer: this is the latest build" + (at ? ", with the snapshot taken " + at + " SAST" : "") + ".";
        setCheckMsg(m); setOkMsg(m);
      }
    } catch (e) {
      setRefErr("Could not check for a newer build: " + shortErr(e));
    } finally {
      setBusy(false);
    }
  }, [busy, live]);

  const pct = gwProgress(ctx);
  const showLanding = ui.mode === "simple" || ui.tab === "command";
  const hist = (live.history && live.history.current) || [];
  const lastRow = hist.length ? hist[hist.length - 1] : null;
  const evNow = (ctx.events || []).filter(function (e) { return Number(e.id) === ctx.currentEvent; })[0];

  const body = function () {
    if (ui.mode === "simple") return null;
    if (ui.tab === "command") return <TabCommand ctx={ctx} ui={ui} on={on} mc={mc} />;
    if (ui.tab === "plan") return <TabPlan ctx={ctx} ui={ui} on={on} plan={plan} onConfirm={onConfirm} mc={mc} />;
    if (ui.tab === "squad") return <TabSquad ctx={ctx} ui={ui} on={on} onConfirm={onConfirm} mc={mc} />;
    if (ui.tab === "rivals") return <TabRivals ctx={ctx} ui={ui} on={on} plan={plan} simLeague={simLeague} onSimLeague={setSimLeague} onConfirm={onConfirm} mc={mc} />;
    if (ui.tab === "draft") return <TabDraft ctx={ctx} ui={ui} on={on} state={state} onLeague={onLeague} mc={mc} />;
    if (ui.tab === "chips") return <TabChips ctx={ctx} ui={ui} on={on} plan={plan} onConfirm={onConfirm} mc={mc} />;
    if (ui.tab === "odds") return <TabOdds ctx={ctx} ui={ui} on={on} mc={mc} />;
    if (ui.tab === "review") return <TabReview ctx={ctx} ui={ui} on={on} mc={mc} />;
    return <TabLab ctx={ctx} ui={ui} on={on} state={state} onDownload={onDownload} onCopy={onCopy} onImport={onImport} importErr={importErr} storeMode={boot.save.mode}
      refresh={{ busy: busy, err: refErr, okMsg: okMsg, onRefresh: isDist ? onCheck : onRefresh, onPair: onPair, dist: isDist }} mc={mc} />;
  };

  return (
    <div className="mc-root" data-tokens={TOKENS.length} data-mode={ui.mode} data-view={ui.tab} data-gw={ctx.nextEvent} data-store={boot.save.mode}>
      <style>{STYLE}</style>
      <Announcer text={said} />
      <Header ctx={ctx} onRefresh={isDist ? onCheck : onRefresh} check={isDist} onMenu={function () { setMenuOpen(!menuOpen); }} menuOpen={menuOpen} busy={busy} />
      {busy ? <div className="refbar" data-testid="refbar"><i /></div> : null}
      <div className="gwbar" data-testid="gwbar" data-pct={pct} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Gameweek progress"><i style={{ width: pct + "%" }} /></div>
      {menuOpen ? <Menu mode={ui.mode} onMode={setMode} onJump={jump} /> : null}
      {ui.mode === "full" ? <Tabs tab={ui.tab} onTab={goTab} /> : null}
      <div className="wrap">
        <StoreNotes save={boot.save} update={swNew} onReload={reloadIntoNewBuild}
          fresh={isDist && isApp && boot.fresh && !imported && showLanding} onImport={function () { jump("lab-import"); }}
          check={isDist && !(ui.mode === "full" && ui.tab === "lab") ? checkMsg : ""} />
        {refErr ? <div className="err" data-testid="err">{refErr}</div> : null}
        <Boundary key={ui.mode + ui.tab}>
          {showLanding ? (
            <div>
              <GwActionCard plan={plan} ctx={ctx} mode={ui.mode} reveals={ui.reveals} onReveal={on.rev} onConfirm={onConfirm} mc={mc} />
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

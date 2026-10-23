#!/usr/bin/env node
/* state.cjs — advance state/kwezi.json to the entry's own latest picks (ERRORS.md E-182).

     node pipeline/state.cjs [--live data/live.json] [--transfers pipeline/feeds/transfers.json] [--state state/kwezi.json] [--check]

   Why it exists. The D3 guard blocks every recommendation while the saved fifteen differs from the API's picks for the
   gameweek in play. Nothing wrote the saved fifteen after GW6, so after the manager's five GW7 transfers the app went blank
   (21 Oct 2026). This step runs after the bake on every refresh and keys on element id, never on name (D3).

   What it writes, and from where (Part N1):
   - squad: picks[current_event] in pick order, each with its purchase price: the cost of the latest transfer that brought
     the player in (`element_in_cost`, entry/{id}/transfers/), else `now_cost − cost_change_start` (held since the start).
   - bank: entry.last_deadline_bank · value: entry.last_deadline_value · ft: ft_available · confirmed_gw: current_event.
   Every other field (leagues, draft, ui, ledger, refresh, notes) is kept as it is.

   It never writes silently: the players in and out against the saved fifteen are printed, so the refresh reply can list
   them for the manager. --check writes nothing and exits 1 when the file is behind the feed. */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d; };
const LIVE = arg("live", path.join(ROOT, "data", "live.json"));
const TX = arg("transfers", path.join(ROOT, "pipeline", "feeds", "transfers.json"));
const STATE = arg("state", path.join(ROOT, "state", "kwezi.json"));
const CHECK = process.argv.includes("--check");

const fail = (m) => { console.error("state.cjs: " + m); process.exit(2); };
const live = JSON.parse(fs.readFileSync(LIVE, "utf8"));
const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
const tx = fs.existsSync(TX) ? JSON.parse(fs.readFileSync(TX, "utf8")) : [];

const cur = Number(live.current_event);
const pk = live.picks && live.picks[String(cur)];
if (!Number.isInteger(cur) || !pk || !Array.isArray(pk.picks) || pk.picks.length !== 15) fail("no fifteen picks for the current gameweek (GW" + live.current_event + ") in " + LIVE);
const els = new Map((live.elements || []).map((e) => [Number(e.id), e]));
const ids = pk.picks.slice().sort((a, b) => a.position - b.position).map((p) => Number(p.element));
const missing = ids.filter((i) => !els.has(i));
if (missing.length) fail("picks name ids the feed does not carry: " + missing.join(","));
if (!Array.isArray(tx)) fail("the transfers feed is not a list");
const ent = live.entry || {};
if (!Number.isFinite(Number(ent.last_deadline_bank)) || !Number.isFinite(Number(live.ft_available))) fail("the feed carries no bank or free-transfer count");

// the latest transfer that brought each player in, up to the gameweek in play
const lastIn = new Map();
tx.filter((t) => Number(t.event) <= cur).sort((a, b) => String(a.time).localeCompare(String(b.time))).forEach((t) => lastIn.set(Number(t.element_in), Number(t.element_in_cost)));
const purchase = (i) => (lastIn.has(i) ? lastIn.get(i) : Number(els.get(i).now_cost) - Number(els.get(i).cost_change_start));

const squad = ids.map((i) => ({ id: i, purchase: purchase(i) }));
const before = new Set((st.squad || []).map((s) => Number(s.id))), after = new Set(ids);
const name = (i) => (els.get(i) ? els.get(i).web_name : "#" + i);
const ins = ids.filter((i) => !before.has(i)), outs = [...before].filter((i) => !after.has(i));
const repriced = squad.filter((s) => before.has(s.id) && (st.squad || []).some((o) => Number(o.id) === s.id && Number(o.purchase) !== s.purchase));
const next = Object.assign({}, st, {
  version: Math.max(110, Number(st.version) || 0),
  exported_at: live.fetched_at || new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  entry: Number(ent.id) || st.entry,
  squad,
  bank: Number(ent.last_deadline_bank),
  ft: Number(live.ft_available),
  value: Number(ent.last_deadline_value) || st.value,
  confirmed_gw: cur
});
const behind = JSON.stringify([st.squad, st.bank, st.ft, st.confirmed_gw]) !== JSON.stringify([next.squad, next.bank, next.ft, next.confirmed_gw]);

console.log("state.cjs · GW" + cur + " picks · " + (ins.length ? ins.length + " in (" + ins.map(name).join(", ") + "), " + outs.length + " out (" + outs.map(name).join(", ") + ")" : "the fifteen is unchanged") +
  (repriced.length ? " · purchase price corrected for " + repriced.map((s) => name(s.id)).join(", ") : "") +
  " · bank " + (next.bank / 10).toFixed(1) + " · free transfers " + next.ft + " · confirmed through GW" + cur + (st.confirmed_gw !== cur ? " (was GW" + st.confirmed_gw + ")" : ""));
if (CHECK) process.exit(behind ? 1 : 0);
if (behind) { fs.writeFileSync(STATE, JSON.stringify(next, null, 2) + "\n"); console.log("state.cjs wrote " + path.relative(ROOT, STATE)); }
else console.log("state.cjs: " + path.relative(ROOT, STATE) + " already matches the feed; nothing written");

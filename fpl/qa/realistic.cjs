/*
 * qa/realistic.cjs — the D4 refresh path against real Anthropic API response shapes
 * (CLAUDE.md H1 "realistic" row, bar 8/8; E-001, E-018).
 *
 * Everything is mocked through page.route("https://api.anthropic.com/**") and driven
 * through the real UI: the Lab tab's refresh button, the panel that reports what landed,
 * and the error strip. Nothing here calls a real API.
 *
 * The shapes are the ones the API actually sends when web search is on: the tool blocks
 * (server_tool_use, web_search_tool_result) arrive BEFORE the text block, a truncated
 * reply carries stop_reason "max_tokens", and an error is an object with error.message.
 *
 * Run: node qa/realistic.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");
const H = require("./harness.cjs");

const ROOT = H.ROOT;
const E = require(path.join(ROOT, "src", "engine.js"));
const LIVE = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "live.json"), "utf8"));
const STATE = JSON.parse(fs.readFileSync(path.join(ROOT, "state", "kwezi.json"), "utf8"));

const assert = H.assert;
const NOW = LIVE.fetched_at;
const GAKPO = 367;                 // in the snapshot: status "d", chance 75
const JOAO = 165;

// ---------------------------------------------------------------- response shapes

function message(content, stop) {
  return {
    id: "msg_01QA", type: "message", role: "assistant", model: "claude-sonnet-4-6",
    stop_reason: stop || "end_turn", stop_sequence: null,
    usage: { input_tokens: 2841, output_tokens: 310, server_tool_use: { web_search_requests: 1 } },
    content: content
  };
}
function toolBlocks(decoyText) {
  return [
    { type: "server_tool_use", id: "srvtoolu_01QA", name: "web_search", input: { query: "fantasy premier league gameweek 4 team news" } },
    {
      type: "web_search_tool_result", tool_use_id: "srvtoolu_01QA",
      content: [
        { type: "web_search_result", title: "Team news", url: "https://www.premierleague.com/news", page_age: "1 hour ago", encrypted_content: "EqgBCkYIAxgCIkA..." },
        { type: "web_search_result", title: "Price changes", url: "https://fantasy.premierleague.com/statistics", page_age: null, encrypted_content: "EqgBCkYIAxgCIkB..." }
      ],
      text: decoyText === undefined ? "" : decoyText
    }
  ];
}
const textBlock = (t) => ({ type: "text", text: t });

// ---------------------------------------------------------------- one refresh run

async function session(browser, opts) {
  const o = opts || {};
  const reqs = [];
  const page = await browser.newPage();
  const handler = async function (route, request) {
    try { reqs.push(JSON.parse(request.postData() || "{}")); } catch (e) { reqs.push(null); }
    if (o.delayMs) await new Promise((r) => setTimeout(r, o.delayMs));
    const body = typeof o.body === "function" ? o.body(reqs.length) : o.body;
    await route.fulfill({
      status: o.status === undefined ? 200 : o.status,
      contentType: "application/json",
      body: typeof body === "string" ? body : JSON.stringify(body)
    });
  };
  await H.open(page, {
    mode: "full", state: STATE, now: NOW,
    ui: { mode: "full", tab: "lab", open: { "lab-refresh": true }, reveals: {} },
    mocks: {
      "https://fantasy.premierleague.com/**": (route) => route.abort(),      // CORS-blocked in a browser; the app expects it to fail
      "https://api.anthropic.com/**": handler
    }
  });
  const before = await snapshot(page);
  await page.click('[data-testid="refresh-run"]');
  let barSeen = false;
  if (o.watchBar) {
    try { await page.waitForSelector('[data-testid="refbar-lab"]', { timeout: 5000 }); barSeen = true; } catch (e) { barSeen = false; }
  }
  await page.waitForFunction(() => {
    const s = document.querySelector('[data-section="lab-refresh"]');
    if (!s) return false;
    return !!s.querySelector('[data-testid="refresh-err"]') || !!s.querySelector(".note");
  }, null, { timeout: 30000 });
  const after = await snapshot(page);
  const out = {
    page: page, reqs: reqs, barSeen: barSeen, before: before, after: after,
    err: after.err, note: after.note, bar: after.bar
  };
  return out;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const s = document.querySelector('[data-section="lab-refresh"]');
    const e = s ? s.querySelector('[data-testid="refresh-err"]') : null;
    const n = s ? s.querySelector(".note") : null;
    let st = null;
    try { st = window.localStorage.getItem("mc_state"); } catch (x) { st = "unreadable"; }
    return {
      err: e ? e.innerText.trim() : null,
      note: n ? n.innerText.trim() : null,
      bar: !!document.querySelector(".refbar"),
      topErr: (function () { const t = document.querySelector('[data-testid="err"]'); return t ? t.innerText.trim() : null; })(),
      gw: (function () { const r = document.querySelector(".mc-root"); return r ? r.getAttribute("data-gw") : null; })(),
      state: st
    };
  });
}

const shape = (r) => (r && r.model ? r.model + " max_tokens=" + r.max_tokens + " tools=" + (r.tools || []).map((t) => t.type + "/" + t.name).join(",") : "no body");

// ---------------------------------------------------------------- the suite

async function main() {
  const browser = await H.launch();
  try {
    // ---- 1 · the tool blocks come first and only the text block is read
    {
      const decoy = '{"elements":[{"id":' + JOAO + ',"now_cost":9990,"status":"i"}]}';   // would throw if it were read
      const s = await session(browser, {
        body: message(toolBlocks(decoy).concat([textBlock('{"fetched_at":"2026-09-11T07:00:00Z","elements":[{"id":' + GAKPO + ',"web_name":"Gakpo","status":"d","chance":75,"news":"Thigh injury - 75% chance of playing"}]}')]))
      });
      const types = (s.reqs.length ? "server_tool_use, web_search_tool_result, text" : "");
      assert("tool-blocks-first-and-only-the-text-block-is-read",
        !s.err && /Applied 1 update/.test(s.note || ""),
        "blocks in the order " + types + "; the decoy JSON inside the tool result (now_cost 9990, status i) was ignored; panel says \"" + (s.note || s.err) + "\"");
      await s.page.close();
    }

    // ---- 2 · E-001: 4000 tokens whenever a tool is attached, and the tool matches the pair
    {
      const good = message([textBlock('{"elements":[{"id":' + GAKPO + ',"status":"d","chance":75}]}')]);
      const page = await browser.newPage();
      const reqs = [];
      await H.open(page, {
        mode: "full", state: STATE, now: NOW,
        ui: { mode: "full", tab: "lab", open: { "lab-refresh": true }, reveals: {} },
        mocks: {
          "https://fantasy.premierleague.com/**": (route) => route.abort(),
          "https://api.anthropic.com/**": (route, request) => {
            try { reqs.push(JSON.parse(request.postData() || "{}")); } catch (e) { reqs.push(null); }
            route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(good) });
          }
        }
      });
      await page.click('[data-testid="refresh-run"]');
      await page.waitForFunction(() => { const s = document.querySelector('[data-section="lab-refresh"]'); return !!s && !!s.querySelector(".note"); }, null, { timeout: 30000 });
      await page.selectOption('[data-testid="refresh-pair"]', "sonnet5");
      await page.click('[data-testid="refresh-run"]');
      for (let i = 0; i < 300 && reqs.length < 2; i++) await page.waitForTimeout(100);   // the second request, node-side
      const pairs = E.REFRESH_PAIRS;
      const bad = [];
      reqs.forEach((r) => {
        if (!r) { bad.push("a request carried no body"); return; }
        const tools = r.tools || [];
        if (!tools.length) { bad.push(r.model + " sent no tool"); return; }
        if (!(Number(r.max_tokens) >= 4000)) bad.push(r.model + " sent max_tokens " + r.max_tokens + " with a tool attached");
        const want = Object.keys(pairs).map((k) => pairs[k]).filter((p) => p.model === r.model)[0];
        if (!want) { bad.push("unknown model " + r.model); return; }
        if (tools[0].type !== want.tool) bad.push(r.model + " paired with " + tools[0].type + ", expected " + want.tool);
        if (tools[0].name !== "web_search") bad.push("tool name " + tools[0].name);
      });
      const models = reqs.map((r) => (r ? r.model : "?"));
      assert("request-carries-4000-tokens-and-the-tool-paired-with-the-model",
        reqs.length === 2 && models.indexOf("claude-sonnet-4-6") >= 0 && models.indexOf("claude-sonnet-5") >= 0 && !bad.length,
        reqs.map(shape).join(" | ") + (bad.length ? " — " + bad.join("; ") : ""));
      await page.close();
    }

    // ---- 3 · a truncated reply is named as truncation, not swallowed
    {
      const s = await session(browser, {
        body: message(toolBlocks().concat([textBlock('{"elements":[{"id":' + GAKPO + ',"status":"d","chance":75,"news":"Thigh"}]}')]), "max_tokens")
      });
      assert("max-tokens-stop-is-named-as-truncation",
        !s.err && /Applied 1 update/.test(s.note || "") && /token ceiling|cut short/i.test(s.note || ""),
        "stop_reason max_tokens → panel says \"" + (s.note || s.err) + "\"");
      await s.page.close();
    }

    // ---- 4 · fenced JSON parses
    {
      const fenced = "Here is what the search found:\n\n```json\n{\n  \"fetched_at\": \"2026-09-11T07:05:00Z\",\n  \"elements\": [\n    {\"id\": " + GAKPO + ", \"web_name\": \"Gakpo\", \"status\": \"a\", \"chance\": null, \"news\": \"\"}\n  ]\n}\n```\n";
      const s = await session(browser, { body: message(toolBlocks().concat([textBlock(fenced)])) });
      assert("fenced-json-parses",
        !s.err && /Applied 1 update/.test(s.note || ""),
        "a fenced reply with prose either side applied cleanly: \"" + (s.note || s.err) + "\"");
      await s.page.close();
    }

    // ---- 5 · a reply cut off mid-array is salvaged rather than thrown away
    {
      const cut = '{"fetched_at":"2026-09-11T07:10:00Z","elements":[{"id":' + GAKPO + ',"web_name":"Gakpo","status":"d","chance":75,"news":"Thigh injury"},{"id":' + JOAO + ',"web_name":"Joao Pedro","status":"a","chance":null,"new';
      const s = await session(browser, { body: message(toolBlocks().concat([textBlock(cut)]), "max_tokens") });
      const parsed = (function () { try { return E.parseJson(cut); } catch (e) { return null; } })();
      assert("cut-off-array-is-salvaged",
        !s.err && /Applied 2 updates/.test(s.note || "") && !!parsed && parsed.__salvaged === true && parsed.elements.length === 2,
        "the reply stops inside the second object; parseJson salvages " + (parsed ? parsed.elements.length : 0) + " elements and the panel says \"" + (s.note || s.err) + "\"");
      await s.page.close();
    }

    // ---- 6 · an answer with no text block names the block types it did see
    {
      const s = await session(browser, { body: message(toolBlocks()) });
      assert("empty-reply-names-the-block-types-it-saw",
        !!s.err && /server_tool_use/.test(s.err) && /web_search_tool_result/.test(s.err),
        "error strip reads \"" + s.err + "\"");
      await s.page.close();
    }

    // ---- 7 · an error object surfaces its own message, not a generic one
    {
      const real = "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits, and then retry this request with the same model and tool pairing.";
      const s = await session(browser, { body: { type: "error", error: { type: "invalid_request_error", message: real } } });
      const head = real.slice(0, 100);
      assert("error-object-surfaces-its-real-message",
        !!s.err && s.err.indexOf(head) >= 0 && s.err.length <= 140 && !/no text in the reply/.test(s.err),
        "error strip reads \"" + s.err + "\" (" + (s.err || "").length + " chars, capped at 140)");
      await s.page.close();
    }

    // ---- 8 · E-018: a 4xx is rejected, not retried; state untouched; the bar clears
    {
      const s = await session(browser, {
        status: 400, delayMs: 400, watchBar: true,
        body: { type: "error", error: { type: "invalid_request_error", message: "max_tokens: 1000 > 4096, which is the maximum allowed number of output tokens for claude-sonnet-4-6" } }
      });
      const untouched = s.before.state === s.after.state && s.before.gw === s.after.gw;
      // and the other half of E-018: a 500 IS retried, which is why mocking one never
      // proves that the bar clears.
      const s5 = await session(browser, { status: 500, body: { type: "error", error: { type: "api_error", message: "Internal server error" } } });
      const retried = s5.reqs.length === 3 && /HTTP 500/.test(s5.err || "");
      await s5.page.close();
      assert("a-4xx-is-rejected-state-untouched-and-the-bar-cleared",
        !!s.err && /HTTP 400/.test(s.err) && s.reqs.length === 1 && s.barSeen && !s.after.bar && untouched && !s.after.note && retried,
        s.reqs.length + " request for the 400 against " + s5.reqs.length + " for a 500 (only 429/5xx/timeout/network are retried), refresh bar seen while pending " + s.barSeen + " and cleared " + !s.after.bar + ", saved state " + (untouched ? "byte-identical" : "CHANGED") + ", error \"" + (s.err || "").slice(0, 80) + "\"");
      await s.page.close();
    }
  } finally {
    try { await browser.close(); } catch (e) { /* nothing left to close */ }
  }
  H.done("realistic");
}

main().catch(function (e) {
  console.log("FAIL realistic — the suite threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : String(e)));
  console.log("SUITE realistic " + H.counts().pass + "/" + (H.counts().total + 1));
  process.exit(1);
});

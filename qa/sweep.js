// Regression sweep: renders every view across dates, seeds, modes and routes and fails on any page error, any junk text
// (NaN, undefined, Infinity, a raw "${", "[object", "+-", a doubled minus, a bare null) and any horizontal overflow.
// Usage: node qa/sweep.js [app.html] [width]   (default: qa/ComebackBlueprint.html at 390 px; run.sh copies the fresh build there)
// It exists because two audits found defects that no single-view test would: the ETA chart threw Infinity errors only with a
// profile weight synced to a late weigh-in, and "target +-0.49/wk" only appeared in a cut on the Track weight pane.
// A sweep is only evidence if it can fail: seeds include the states that once broke (long2 = long history + the profile weight
// the Log button writes; planpath = weekly weigh-ins along the plan's own +0.4 kg path).
process.env.TZ = 'Africa/Johannesburg';
const puppeteer = require('puppeteer');
const { fontReply } = require('./fontroute');
const fs = require('fs');
const path = require('path');
const GUARD_SRC = require('./a11yguard').toString(); // accessible-name / focusable / boolean-state guard, evaluated inside the page

const APP = path.resolve(process.argv[2] || path.join(__dirname, 'ComebackBlueprint.html'));
const VW = +(process.argv[3] || 390);
const MOCK = (iso) => { const R = Date; const fixed = new R(iso + 'T09:00:00+02:00').getTime(); class M extends R { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = M; };

const demo = fs.readFileSync(path.join(__dirname, 'fixtures', 'demo.setup.js'), 'utf8').trim().split('\n').pop();
const longTmpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'longseed.tmpl.js'), 'utf8');
const long = (d) => longTmpl.replace('__END__', d);
// what the Log button writes: the profile weight follows the latest weigh-in
const profileSync = ';(function(){var W=JSON.parse(localStorage.getItem("cb2_weight")||"[]");W.sort(function(a,b){return a.date<b.date?-1:1});var p={weight:W.length?W[W.length-1].v:88,height:177,age:38,bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:"55:00",phase:"hyper"};localStorage.setItem("cb2_profile",JSON.stringify(p));})();';
const long2 = (d) => long(d) + profileSync;
const planpath = '(function(){var W=[];for(var k=0;k<=23;k++){var d=new Date(Date.UTC(2026,9,24+7*k));W.push({date:d.toISOString().slice(0,10),v:Math.round((88+0.4*k)*10)/10});}localStorage.setItem("cb2_weight",JSON.stringify(W));localStorage.setItem("cb2_profile",JSON.stringify({weight:W[W.length-1].v,height:177,age:38,bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:"55:00",phase:"hyper"}));})();';
const set = (k, v) => `localStorage.setItem('${k}',${JSON.stringify(JSON.stringify(v))});`;

const DATES = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-17', '2026-11-24', '2027-02-11', '2027-02-12', '2026-11-29', '2026-12-19', '2027-01-15', '2027-01-30', '2027-03-06', '2027-05-15', '2027-05-21', '2027-05-22', '2027-06-05', '2027-07-03', '2027-10-11', '2028-03-22', '2028-11-11', '2028-11-22'];
// Three pre-start days (11-13 Nov), Day 1 (Sat 14 Nov), the 1 km check (Tue 17 Nov), a block Tuesday, race week (11-12 Feb, real dates), two deloads (19 Dec, 30 Jan), the last Aggressive week and the step-down (15-22 May), and the far end (after week 104). Plan dates moved +7 days on 12 Nov 2026.
const VIEWS = ['home', 'lift', 'run', 'roadmap', 'fuel', 'numbers', 'track', 'guide'];
const combos = [];
for (const d of DATES) {
  combos.push({ d, n: 'empty', seed: '' });
  combos.push({ d, n: 'demo', seed: demo });
  if (d > '2027-02-02') combos.push({ d, n: 'long', seed: long(d) });
}
for (const d of ['2026-11-29', '2027-05-22', '2027-07-03']) {
  for (const m of ['cut', 'lean', 'balanced', 'max']) combos.push({ d, n: 'mode-' + m, seed: demo + set('cb2_bulk', m) });
}
combos.push({ d: '2026-11-29', n: 'home-gym', seed: demo + set('cb2_loc', 'home') });
for (const d of ['2027-03-06', '2027-05-15', '2027-05-22', '2027-06-05', '2027-10-11', '2028-11-22']) combos.push({ d, n: 'long2', seed: long2(d) });
for (const d of ['2027-03-06', '2027-05-15', '2027-05-22']) combos.push({ d, n: 'planpath', seed: planpath });

const JUNK = /\bNaN\b|\bundefined\b|Infinity|\$\{|\[object|\+-|−−|\bnull\b/;
// Milestone guard (24 Oct 2026): the soft milestone, the check weekend, peak week and the March routes are retired; any of them on any view fails the sweep
const MILESTONE = /soft milestone|check weekend|the check day|march check|5[–-]7 march|peak week|band-max|band-edge|mass-max|route selector/i;

(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const fails = [];
  let renders = 0;
  for (const c of combos) {
    const p = await b.newPage();
    await p.setRequestInterception(true);
    p.on('request', (r) => { const u = r.url(); if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.respond(fontReply(u) || { status: 200, contentType: 'text/css', body: '' }); });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.evaluateOnNewDocument(MOCK, c.d);
    await p.evaluateOnNewDocument('try{localStorage.clear();}catch(e){}' + c.seed);
    await p.setViewport({ width: VW, height: 844, deviceScaleFactor: 1 });
    await p.goto('file://' + APP, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 700));
    for (const v of VIEWS) {
      try {
        const r = await p.evaluate(async (v, gsrc) => {
          const W = (ms) => new Promise((r) => setTimeout(r, ms));
          const G = new Function('return ' + gsrc)(); const a11y = [];
          // round 3 (a11y): every visible control has a name, custom buttons are focusable, aria-expanded/pressed are booleans
          const scan = () => { document.querySelectorAll('#view-' + v + ' .rweek').forEach((x) => x.classList.add('open')); a11y.push(...G('#view-' + v)); };
          switchView(v); await W(60);
          document.querySelectorAll('#view-' + v + ' .tool').forEach((t) => t.classList.add('open'));
          let acc = '';
          if (v === 'track') for (const t of document.querySelectorAll('[data-tp]')) { t.click(); await W(40); acc += document.getElementById('view-track').innerText + '\n'; scan(); }
          const el = document.getElementById('view-' + v);
          const txt = v === 'track' ? acc : el.innerText;
          const over = []; const w = document.documentElement.clientWidth;
          el.querySelectorAll('*').forEach((e) => {
            const r = e.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.right > w + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('#dayPills,.pills,.tabs,.track-tabs,.seg,svg')) over.push((e.tagName + '.' + String(e.className).replace(/\s+/g, '.')).slice(0, 50) + ' r=' + Math.round(r.right));
          });
          if (v !== 'track') scan();
          return { txt, over: over.slice(0, 3), sw: document.documentElement.scrollWidth, w, a11y };
        }, v, GUARD_SRC);
        renders++;
        const m = r.txt.match(new RegExp('.{0,40}(' + JUNK.source + ').{0,40}'));
        if (m) fails.push(`${c.d} ${c.n} ${v}: junk "${m[0].replace(/\s+/g, ' ')}"`);
        const ms = r.txt.match(MILESTONE);
        if (ms) fails.push(`${c.d} ${c.n} ${v}: milestone copy "${ms[0]}"`);
        if (r.over.length || r.sw > r.w + 1) fails.push(`${c.d} ${c.n} ${v}: overflow sw=${r.sw} ${r.over.join(' | ')}`);
        for (const a of [...new Set(r.a11y)]) fails.push(`${v}: a11y ${a}`);
      } catch (e) { fails.push(`${c.d} ${c.n} ${v}: threw ${String(e.message).slice(0, 100)}`); }
    }
    if (errs.length) fails.push(`${c.d} ${c.n}: page errors ${[...new Set(errs)].slice(0, 3).join(' || ').slice(0, 240)}`);
    await p.close();
  }
  await b.close();
  const seen = new Set(); const out = fails.filter((f) => !seen.has(f) && seen.add(f));
  console.log(out.slice(0, 40).map((f) => 'FAIL: sweep ' + f).join('\n') || `SWEEP ALL PASS (${renders} renders at ${VW} px)`);
  if (out.length) console.log(`SWEEP FAILED: ${out.length} issue(s) in ${renders} renders at ${VW} px`);
  process.exit(out.length ? 1 : 0);
})().catch((e) => { console.error('SWEEP CRASH:', e && e.stack || e); process.exit(2); });

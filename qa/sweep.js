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

const APP = path.resolve(process.argv[2] || path.join(__dirname, 'ComebackBlueprint.html'));
const VW = +(process.argv[3] || 390);
const MOCK = (iso) => { const R = Date; const fixed = new R(iso + 'T09:00:00+02:00').getTime(); class M extends R { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = M; };

const demo = fs.readFileSync(path.join(__dirname, 'fixtures', 'demo.setup.js'), 'utf8').trim().split('\n').pop();
const longTmpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'longseed.tmpl.js'), 'utf8');
const long = (d) => longTmpl.replace('__END__', d);
// what the Log button writes: the profile weight follows the latest weigh-in
const profileSync = ';(function(){var W=JSON.parse(localStorage.getItem("cb2_weight")||"[]");W.sort(function(a,b){return a.date<b.date?-1:1});var p={weight:W.length?W[W.length-1].v:88,height:177,age:38,bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:"55:00",phase:"hyper"};localStorage.setItem("cb2_profile",JSON.stringify(p));})();';
const long2 = (d) => long(d) + profileSync;
const planpath = '(function(){var W=[];for(var k=0;k<=23;k++){var d=new Date(Date.UTC(2026,8,12+7*k));W.push({date:d.toISOString().slice(0,10),v:Math.round((88+0.4*k)*10)/10});}localStorage.setItem("cb2_weight",JSON.stringify(W));localStorage.setItem("cb2_profile",JSON.stringify({weight:W[W.length-1].v,height:177,age:38,bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:"55:00",phase:"hyper"}));})();';
const set = (k, v) => `localStorage.setItem('${k}',${JSON.stringify(JSON.stringify(v))});`;

const DATES = ['2026-09-11', '2026-09-12', '2026-09-27', '2026-10-23', '2026-12-20', '2027-01-02', '2027-02-27', '2027-03-02', '2027-03-05', '2027-03-06', '2027-03-08', '2027-03-24', '2027-05-05', '2027-09-20', '2028-09-20', '2028-10-04'];
const VIEWS = ['home', 'lift', 'run', 'roadmap', 'fuel', 'numbers', 'track', 'guide'];
const combos = [];
for (const d of DATES) {
  combos.push({ d, n: 'empty', seed: '' });
  combos.push({ d, n: 'demo', seed: demo });
  if (d > '2026-12-01') combos.push({ d, n: 'long', seed: long(d) });
}
for (const d of ['2026-09-27', '2027-03-24', '2027-05-05']) {
  for (const m of ['cut', 'lean', 'balanced', 'max']) combos.push({ d, n: 'mode-' + m, seed: demo + set('cb2_bulk', m) });
  for (const r of ['edge', 'mass']) combos.push({ d, n: 'route-' + r, seed: demo + set('cb2_march', r) });
}
combos.push({ d: '2026-09-27', n: 'home-gym', seed: demo + set('cb2_loc', 'home') });
for (const d of ['2027-01-16', '2027-02-24', '2027-03-06', '2027-03-24', '2027-04-10', '2027-09-20']) combos.push({ d, n: 'long2', seed: long2(d) });
for (const d of ['2027-01-16', '2027-02-24', '2027-03-06']) combos.push({ d, n: 'planpath', seed: planpath });
for (const d of ['2027-03-24', '2027-05-05']) for (const m of ['band', 'edge', 'mass']) combos.push({ d, n: 'long2-' + m, seed: long2(d) + set('cb2_march', m) });

const JUNK = /\bNaN\b|\bundefined\b|Infinity|\$\{|\[object|\+-|−−|\bnull\b/;

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
        const r = await p.evaluate(async (v) => {
          const W = (ms) => new Promise((r) => setTimeout(r, ms));
          switchView(v); await W(60);
          document.querySelectorAll('#view-' + v + ' .tool').forEach((t) => t.classList.add('open'));
          let acc = '';
          if (v === 'track') for (const t of document.querySelectorAll('[data-tp]')) { t.click(); await W(40); acc += document.getElementById('view-track').innerText + '\n'; }
          const el = document.getElementById('view-' + v);
          const txt = v === 'track' ? acc : el.innerText;
          const over = []; const w = document.documentElement.clientWidth;
          el.querySelectorAll('*').forEach((e) => {
            const r = e.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.right > w + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('#dayPills,.pills,.tabs,.track-tabs,.seg,svg')) over.push((e.tagName + '.' + String(e.className).replace(/\s+/g, '.')).slice(0, 50) + ' r=' + Math.round(r.right));
          });
          return { txt, over: over.slice(0, 3), sw: document.documentElement.scrollWidth, w };
        }, v);
        renders++;
        const m = r.txt.match(new RegExp('.{0,40}(' + JUNK.source + ').{0,40}'));
        if (m) fails.push(`${c.d} ${c.n} ${v}: junk "${m[0].replace(/\s+/g, ' ')}"`);
        if (r.over.length || r.sw > r.w + 1) fails.push(`${c.d} ${c.n} ${v}: overflow sw=${r.sw} ${r.over.join(' | ')}`);
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

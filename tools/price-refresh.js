#!/usr/bin/env node
// Price drift check for The Comeback Blueprint.
// Reads the newest tools/prices/YYYY-MM-DD.json (every price the app quotes), asks Takealot
// and Woolworths for each product again, and prints what moved: changed prices, out of
// stock, and products that can no longer be found. Exit 1 when anything moved, 0 when all
// prices still match. It never edits the app; a person updates src/app_full.js and writes
// a new dated evidence file.
//   node tools/price-refresh.js            live check (needs curl and network)
//   node tools/price-refresh.js --selftest offline check against tools/prices/fixture/
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

function newestFile(dir) {
  const files = fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  if (!files.length) throw new Error('no dated price file in ' + dir);
  return path.join(dir, files[files.length - 1]);
}

function curlJSON(url, headers) {
  const args = ['-s', '--max-time', '30'];
  for (const [k, v] of Object.entries(headers || {})) args.push('-H', k + ': ' + v);
  args.push(url);
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(out);
}

const live = {
  takealot(plid) {
    const d = curlJSON('https://api.takealot.com/rest/v-1-12-0/product-details/' + plid + '?platform=desktop',
      { 'User-Agent': UA, Accept: 'application/json', Origin: 'https://www.takealot.com', Referer: 'https://www.takealot.com/' });
    const p = d && d.event_data && d.event_data.documents && d.event_data.documents.product;
    if (!p) return null;
    return { price: p.purchase_price, inStock: !!p.in_stock, title: d.title };
  },
  woolworths(id, name) {
    for (const q of [name, id]) {
      const d = curlJSON('https://ac.cnstrc.com/search/' + encodeURIComponent(q) + '?key=key_tw9hKe0fkfgEf36D&num_results_per_page=30');
      const hit = ((d.response && d.response.results) || []).find(r => String(r.data && r.data.id) === String(id));
      if (hit) return { price: hit.data.p30, inStock: true, title: hit.value };
    }
    return null;
  }
};

// Compare one evidence file against a source of current prices. Returns a list of lines.
function check(doc, src) {
  const moved = [], same = [];
  const seen = new Set();
  for (const r of doc.records) {
    const key = r.shop + ':' + r.productId;
    if (seen.has(key)) continue; seen.add(key);
    let now = null, err = null;
    try {
      now = r.shop === 'Takealot' ? src.takealot(r.productId) : src.woolworths(r.productId, r.size || r.title);
    } catch (e) { err = e.message; }
    const label = r.shop + ' ' + r.productId + ' "' + r.title + '"';
    if (err) moved.push('ERROR    ' + label + ': ' + err);
    else if (!now) moved.push('MISSING  ' + label + ': not found any more');
    else if (now.inStock === false) moved.push('NO STOCK ' + label + ': R' + now.price + ' but out of stock');
    else if (Number(now.price) !== Number(r.price)) moved.push('CHANGED  ' + label + ': R' + r.price + ' -> R' + now.price);
    else same.push(label);
  }
  return { moved, same };
}

function report(file, res) {
  console.log('Price file: ' + file);
  console.log('Checked ' + (res.moved.length + res.same.length) + ' products: ' + res.same.length + ' unchanged, ' + res.moved.length + ' moved.');
  for (const l of res.moved) console.log('  ' + l);
}

function selftest() {
  const dir = path.join(__dirname, 'prices', 'fixture');
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'prices.json'), 'utf8'));
  const canned = JSON.parse(fs.readFileSync(path.join(dir, 'responses.json'), 'utf8'));
  const src = {
    takealot: id => canned.takealot[id] || null,
    woolworths: id => canned.woolworths[id] || null
  };
  const res = check(doc, src);
  const ok = [];
  const want = (name, cond) => { ok.push([name, !!cond]); };
  want('unchanged price is quiet', res.same.some(l => l.includes('PLID111')));
  want('changed Takealot price reported', res.moved.some(l => /^CHANGED .*PLID222.*R100 -> R120/.test(l)));
  want('out of stock reported', res.moved.some(l => /^NO STOCK .*PLID333/.test(l)));
  want('missing Woolworths product reported', res.moved.some(l => /^MISSING .*9990002/.test(l)));
  want('changed Woolworths price reported', res.moved.some(l => /^CHANGED .*9990001.*R47.99 -> R49.99/.test(l)));
  want('exactly four moved lines', res.moved.length === 4);
  const newest = path.basename(newestFile(path.join(__dirname, 'prices')));
  want('newest dated evidence file is found', /^\d{4}-\d{2}-\d{2}\.json$/.test(newest));
  const fails = ok.filter(x => !x[1]);
  for (const [n, v] of ok) console.log((v ? 'ok   ' : 'FAIL ') + n);
  console.log(fails.length ? 'PRICE TOOL SELFTEST FAIL' : 'PRICE TOOL SELFTEST PASS');
  process.exit(fails.length ? 1 : 0);
}

if (require.main === module) {
  if (process.argv.includes('--selftest')) selftest();
  else {
    const file = newestFile(path.join(__dirname, 'prices'));
    const res = check(JSON.parse(fs.readFileSync(file, 'utf8')), live);
    report(file, res);
    process.exit(res.moved.length ? 1 : 0);
  }
}
module.exports = { check, newestFile };

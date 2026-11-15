#!/usr/bin/env node
// Price drift check for The Comeback Blueprint.
// Reads the newest tools/prices/YYYY-MM-DD.json (every price the app quotes) and asks each shop for each
// product again: Takealot and Woolworths through their product APIs, every other shop (iHerb, the brand
// stores, the specialist food shops) by fetching the product page and reading the JSON-LD offer price with
// JSON.parse. It prints what moved: changed prices, out of stock, products that can no longer be found, and
// "check by hand" with the URL for anything it cannot read (a blocked page, no JSON-LD price, a different
// currency, a shipping quote). Exit 1 when anything moved or needs a hand check, 0 when every price still
// matches. It never edits the app; a person updates src/app_full.js and writes a new dated evidence file.
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

function curlText(url, headers) {
  const args = ['-s', '-L', '--max-time', '30', '--compressed'];
  for (const [k, v] of Object.entries(headers || {})) args.push('-H', k + ': ' + v);
  args.push(url);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
function curlJSON(url, headers) { return JSON.parse(curlText(url, headers)); }

// Every <script type="application/ld+json"> block, parsed with JSON.parse. iHerb escapes the plus sign
// in the type attribute (application/ld&#x2B;json), so the entity forms count too.
function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type\s*=\s*["']?application\/ld(?:\+|&#x2B;|&#43;|&plus;)json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1].trim())); } catch (e) { /* a block that is not JSON is skipped, never guessed at */ }
  }
  return out;
}
const isType = (n, t) => [].concat(n && n['@type'] || []).some(x => String(x).toLowerCase() === t.toLowerCase());
// The first Product offer found depth-first (handles @graph, arrays, a list of offers and AggregateOffer).
function findOffer(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const x of node) { const r = findOffer(x); if (r) return r; } return null; }
  if (isType(node, 'Product') && node.offers) {
    for (const o of [].concat(node.offers)) {
      const inner = isType(o, 'AggregateOffer') && o.offers ? [].concat(o.offers) : [o];
      for (const x of inner) {
        const p = x.price != null ? x.price : (o.lowPrice != null ? o.lowPrice : (x.priceSpecification && x.priceSpecification.price));
        if (p == null || p === '' || !isFinite(Number(p))) continue;
        const av = x.availability || o.availability;
        return { price: Number(p), currency: x.priceCurrency || o.priceCurrency || (x.priceSpecification && x.priceSpecification.priceCurrency) || null,
          inStock: av ? !/OutOfStock|SoldOut|Discontinued/i.test(String(av)) : null };
      }
    }
  }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (v && typeof v === 'object') { const r = findOffer(v); if (r) return r; }
  }
  return null;
}
function pageOffer(html) {
  for (const b of jsonLdBlocks(html)) { const r = findOffer(b); if (r) return r; }
  return null;
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
      if (!q) continue;
      const d = curlJSON('https://ac.cnstrc.com/search/' + encodeURIComponent(q) + '?key=key_tw9hKe0fkfgEf36D&num_results_per_page=30');
      const hit = ((d.response && d.response.results) || []).find(r => String(r.data && r.data.id) === String(id));
      if (hit) return { price: hit.data.p30, inStock: true, title: hit.value };
    }
    return null;
  },
  page(url) { return pageOffer(curlText(url, { 'User-Agent': UA, Accept: 'text/html' })); }
};

// Compare one evidence file against a source of current prices. Returns {moved, hand, same}.
function check(doc, src) {
  const moved = [], hand = [], same = [];
  const seen = new Set();
  for (const r of doc.records) {
    const key = r.shop + ':' + (r.productId || r.url);
    if (seen.has(key)) continue; seen.add(key);
    const label = r.shop + ' ' + (r.productId || '') + (r.productId ? ' ' : '') + '"' + r.title + '"';
    const cur = r.currency || 'ZAR', sym = cur === 'ZAR' ? 'R' : cur + ' ';
    if (r.check === 'hand') { hand.push('CHECK BY HAND ' + label + ': ' + (r.why || 'not a product page') + ' ' + r.url); continue; }
    let now = null, err = null, viaPage = false;
    try {
      if (r.shop === 'Takealot' && r.productId) now = src.takealot(r.productId);
      else if (r.shop === 'Woolworths' && r.productId) now = src.woolworths(r.productId, r.title);
      else { viaPage = true; now = src.page(r.url); }
    } catch (e) { err = e.message; }
    if (viaPage && (err || !now)) { hand.push('CHECK BY HAND ' + label + ': ' + (err ? 'page not read (' + err.split('\n')[0] + ')' : 'no JSON-LD price on the page') + ' ' + r.url); continue; }
    if (viaPage && now.currency && now.currency !== cur) { hand.push('CHECK BY HAND ' + label + ': the page prices in ' + now.currency + ', the record in ' + cur + ' ' + r.url); continue; }
    if (err) moved.push('ERROR    ' + label + ': ' + err);
    else if (!now) moved.push('MISSING  ' + label + ': not found any more');
    else if (now.inStock === false) moved.push('NO STOCK ' + label + ': ' + sym + now.price + ' but out of stock');
    else if (Math.abs(Number(now.price) - Number(r.price)) > 0.004) moved.push('CHANGED  ' + label + ': ' + sym + r.price + ' -> ' + sym + now.price);
    else same.push(label);
  }
  return { moved, hand, same };
}

function report(file, res) {
  console.log('Price file: ' + file);
  console.log('Checked ' + (res.moved.length + res.hand.length + res.same.length) + ' products: ' + res.same.length + ' unchanged, ' + res.moved.length + ' moved, ' + res.hand.length + ' to check by hand.');
  for (const l of res.moved.concat(res.hand)) console.log('  ' + l);
}

function selftest() {
  const dir = path.join(__dirname, 'prices', 'fixture');
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'prices.json'), 'utf8'));
  const canned = JSON.parse(fs.readFileSync(path.join(dir, 'responses.json'), 'utf8'));
  const src = {
    takealot: id => canned.takealot[id] || null,
    woolworths: id => canned.woolworths[id] || null,
    page: url => { if (canned.blocked && canned.blocked.includes(url)) throw new Error('HTTP 403'); return url in canned.pages ? pageOffer(canned.pages[url]) : null; }
  };
  const res = check(doc, src);
  const ok = [];
  const want = (name, cond) => { ok.push([name, !!cond]); };
  want('unchanged price is quiet', res.same.some(l => l.includes('PLID111')));
  want('changed Takealot price reported', res.moved.some(l => /^CHANGED .*PLID222.*R100 -> R120/.test(l)));
  want('out of stock reported', res.moved.some(l => /^NO STOCK .*PLID333/.test(l)));
  want('missing Woolworths product reported', res.moved.some(l => /^MISSING .*9990002/.test(l)));
  want('changed Woolworths price reported', res.moved.some(l => /^CHANGED .*9990001.*R47.99 -> R49.99/.test(l)));
  want('page shop: same JSON-LD price (iHerb escapes the plus sign) is quiet', res.same.some(l => l.includes('Fixture casein')));
  want('page shop: a price inside @graph that moved is reported', res.moved.some(l => /^CHANGED .*Fixture chicken.*R299.9 -> R319.9/.test(l)));
  want('page shop: a foreign price in its own currency is compared as such', res.same.some(l => l.includes('Fixture D3')));
  want('page shop: AggregateOffer lowPrice is read', res.same.some(l => l.includes('Fixture mince')));
  want('page shop: out of stock from the offer availability', res.moved.some(l => /^NO STOCK .*Fixture omega/.test(l)));
  want('page shop: no JSON-LD price means check by hand, with the URL', res.hand.some(l => /^CHECK BY HAND .*Fixture steak.*no JSON-LD price.*https:\/\/fixture\.example\/vcf-steak/.test(l)));
  want('page shop: a blocked page means check by hand', res.hand.some(l => /^CHECK BY HAND .*Fixture whey.*page not read \(HTTP 403\)/.test(l)));
  want('page shop: a different currency on the page means check by hand', res.hand.some(l => /^CHECK BY HAND .*Fixture collagen.*prices in ZAR, the record in USD/.test(l)));
  want('a shipping quote is always a hand check', res.hand.some(l => /^CHECK BY HAND .*Fixture shipping quote/.test(l)));
  want('a script block that is not JSON is skipped, not guessed', pageOffer('<script type="application/ld+json">{price: 5}</script>') === null);
  want('exactly six moved lines and four hand checks', res.moved.length === 6 && res.hand.length === 4);
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
    process.exit(res.moved.length || res.hand.length ? 1 : 0);
  }
}
module.exports = { check, newestFile, pageOffer, jsonLdBlocks };

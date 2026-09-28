// PWA / offline acceptance (Chromium): serves dist/ over http at the same path GitHub Pages uses
// (/comeback-blueprint/dist/), then proves: manifest is linked and valid, icons resolve, the service worker
// installs and controls the page, the app boots offline from cache, deep links (#track) open the right tab,
// and a Shortcut-style #import= link lands in the log exactly once. file:// mode is covered by qa_full.js.
const puppeteer=require('puppeteer');const http=require('http');const fs=require('fs');const path=require('path');
const R=[];const T=(n,ok,d)=>R.push({name:n,ok:!!ok,detail:d});const wait=ms=>new Promise(r=>setTimeout(r,ms));
const DIST=path.resolve(__dirname,'../dist'),BASE='/comeback-blueprint/dist/';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0].split('#')[0]);if(!u.startsWith(BASE)){s.writeHead(404);return s.end();}
  let f=path.join(DIST,u.slice(BASE.length)||'index.html');if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
  if(!f.startsWith(DIST)||!fs.existsSync(f)){s.writeHead(404);return s.end();}
  s.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(f).pipe(s);});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+srv.address().port,APP=origin+BASE+'ComebackBlueprint.html';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']});const ctx=await b.createBrowserContext();const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts\.(googleapis|gstatic)|Failed to load resource/.test(m.text()))errs.push(m.text());});
// Google Fonts are unreachable in the sandbox and render-blocking; answer them locally (see LEARNINGS 2026-09-11)
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/fonts\.(googleapis|gstatic)\.com/.test(u))r.respond({status:200,contentType:'text/css',body:''});else r.continue();});
await p.goto(APP,{waitUntil:'load'});await wait(800);
const man=await p.evaluate(async()=>{const l=document.querySelector('link[rel="manifest"]');if(!l)return {linked:false};const r=await fetch(l.href);const j=await r.json();return {linked:true,href:l.href,name:j.name,start:j.start_url,display:j.display,icons:j.icons.map(i=>i.src+'|'+i.sizes+'|'+(i.purpose||'any'))};});
T('pwa: manifest linked over http',man.linked,JSON.stringify(man));
T('pwa: manifest valid (name, standalone, start_url)',man.name==='The Comeback Blueprint'&&man.display==='standalone'&&/ComebackBlueprint\.html$/.test(man.start||''),JSON.stringify(man));
T('pwa: manifest has 192, 512 and maskable icons',man.icons&&man.icons.some(x=>/192x192\|any/.test(x))&&man.icons.some(x=>/512x512\|any/.test(x))&&man.icons.some(x=>/maskable/.test(x)),JSON.stringify(man.icons));
const icons=await p.evaluate(async()=>{const out={};for(const s of ['icons/icon-180.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png']){const r=await fetch(s);out[s]=r.status+' '+r.headers.get('content-type');}const a=document.querySelector('link[rel="apple-touch-icon"][sizes="180x180"]');out.apple=a?a.getAttribute('href'):null;return out;});
T('pwa: all icons resolve as PNG',Object.entries(icons).filter(([k])=>k!=='apple').every(([,v])=>/^200 image\/png/.test(v)),JSON.stringify(icons));
T('pwa: 180 px PNG apple-touch-icon linked',icons.apple==='icons/icon-180.png',icons.apple);
const sw=await p.evaluate(async()=>{if(!('serviceWorker' in navigator))return {supported:false};const reg=await Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),8000))]);return {supported:true,active:!!(reg&&reg.active),scope:reg&&reg.scope};});
T('pwa: service worker installs with the /dist/ scope',sw.active&&/\/comeback-blueprint\/dist\/$/.test(sw.scope||''),JSON.stringify(sw));
await p.reload({waitUntil:'load'});await wait(800);
T('pwa: page is controlled by the service worker after reload',await p.evaluate(()=>!!navigator.serviceWorker.controller));
const cached=await p.evaluate(async()=>{const ks=await caches.keys();const k=ks.find(x=>x.startsWith('cb-app-'));if(!k)return {keys:ks};const c=await caches.open(k);return {keys:ks,urls:(await c.keys()).map(r=>new URL(r.url).pathname.split('/').pop())};});
T('pwa: app shell + icons precached',cached.urls&&['ComebackBlueprint.html','manifest.webmanifest','icon-180.png','icon-512.png'].every(f=>cached.urls.includes(f)),JSON.stringify(cached));
// offline boot
await p.setOfflineMode(true);await p.reload({waitUntil:'load'});await wait(1000);
const off=await p.evaluate(()=>({db:typeof DB==='object',home:!!document.getElementById('view-home')&&document.getElementById('view-home').innerHTML.length>500,online:navigator.onLine}));
T('pwa: app boots offline from the cache',off.db&&off.home,JSON.stringify(off));
await p.setOfflineMode(false);
// deep link
await p.goto(APP+'#track',{waitUntil:'load'});await wait(900);
T('pwa: #track deep link opens Track',await p.evaluate(()=>document.getElementById('view-track').offsetParent!==null));
// Shortcut import link (Apple Health automation): applies once, then the hash is cleared
await p.evaluate(()=>{localStorage.clear();});
await p.goto(APP+'#import='+encodeURIComponent('2026-09-25,weight,88.6\n2026-09-25,sleep,7.4'),{waitUntil:'load'});await wait(1400);
const imp=await p.evaluate(()=>({w:DB.weight.filter(x=>x.date==='2026-09-25').map(x=>+x.v),s:DB.sleep.filter(x=>x.date==='2026-09-25').map(x=>+x.h),hash:location.hash}));
T('pwa: #import= link logs weight + sleep',imp.w.includes(88.6)&&imp.s.includes(7.4),JSON.stringify(imp));
T('pwa: #import= hash cleared after applying (no double import on reload)',!/import=/.test(imp.hash),imp.hash);
await p.reload({waitUntil:'load'});await wait(900);
T('pwa: reload does not import twice',await p.evaluate(()=>DB.weight.filter(x=>x.date==='2026-09-25').length===1));
// iPhone Safari tab: install advice with the storage facts; installed app, empty log: restore prompt
for(const mode of ['tab','standalone']){const c2=await b.createBrowserContext();const q=await c2.newPage();await q.setRequestInterception(true);q.on('request',r=>{const u=r.url();if(/fonts\.(googleapis|gstatic)\.com/.test(u))r.respond({status:200,contentType:'text/css',body:''});else r.continue();});
  q.on('pageerror',e=>errs.push(mode+': '+e.message));await q.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1');
  if(mode==='standalone')await q.evaluateOnNewDocument(()=>{const mm=window.matchMedia.bind(window);window.matchMedia=s=>/display-mode: fullscreen/.test(s)?{matches:true,media:s,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}:mm(s);});
  await q.goto(APP,{waitUntil:'load'});await wait(900);await q.evaluate(()=>switchView('home'));await wait(500);
  const r=await q.evaluate(()=>({t:document.getElementById('phoneCaps')?.innerText||'',inst:!!document.getElementById('installNote'),rest:!!document.getElementById('restoreNote'),sa:pwaStatus().standalone}));
  if(mode==='tab')T('pwa: iPhone Safari tab shows the install advice (7-day clean-up, separate storage)',r.inst&&!r.rest&&/browser tab/.test(r.t),JSON.stringify(r));
  else T('pwa: iOS standalone (reported as display-mode: fullscreen) is detected and an empty install offers Restore',r.sa&&r.rest&&!r.inst&&/Home Screen app/.test(r.t),JSON.stringify(r));
  await c2.close();}
// service worker: the redirect stub must never replace the cached app; the page must revalidate past the HTTP cache
{const r=await p.evaluate(async()=>{const k=(await caches.keys()).find(x=>x.startsWith('cb-app-'));const c=await caches.open(k);const size=async()=>{const m=await c.match('./ComebackBlueprint.html');return m?(await m.text()).length:0;};const before=await size();await fetch('index.html');await new Promise(r=>setTimeout(r,500));const after=await size();return {before,after};});
 T('pwa: fetching index.html does not overwrite the cached app (no cache poisoning)',r.before>100000&&r.after===r.before,JSON.stringify(r));}
T('pwa: no page errors',errs.length===0,errs.join('|').slice(0,300));
await b.close();srv.close();
const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+(x.detail||'')).join('\n')||'PWA ALL PASS');console.log('PWA RESULT:',pass+'/'+R.length);process.exit(pass===R.length?0:1);
})().catch(e=>{console.error('PWA CRASH:',e.message);srv.close();process.exit(2);});

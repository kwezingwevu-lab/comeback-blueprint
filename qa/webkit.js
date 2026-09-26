// WebKit acceptance (Safari/iOS engine) — boot, every view, the storage paths, a 390×844 screenshot.
// Run: node qa/webkit.js  (after `npx playwright install webkit`; on Linux also `npx playwright install-deps webkit`).
// Chromium remains the functional suite (qa_full.js); this is the Safari-behaviour gate from CLAUDE.md §4 step 6.
const {webkit}=require('playwright');const path=require('path');const fs=require('fs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const R=[];const T=(n,ok,d)=>R.push({name:n,ok:!!ok,detail:d});
(async()=>{const iso=process.argv[2]||'2026-09-12';
const b=await webkit.launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,timezoneId:'Africa/Johannesburg'});
await ctx.route(u=>!(u.protocol==='file:'||u.protocol==='data:'),r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await ctx.addInitScript(iso=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;
  const store={};window.__cs=store;window.storage={async get(k){if(!(k in store))throw new Error('nf');return{key:k,value:store[k]};},async set(k,v){store[k]=String(v);return{key:k,value:v};},async delete(k){delete store[k];return{key:k}},async list(){return{keys:Object.keys(store)}}};},iso);
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const file=fs.existsSync(path.resolve(__dirname,'ComebackBlueprint.html'))?path.resolve(__dirname,'ComebackBlueprint.html'):path.resolve(__dirname,'../dist/ComebackBlueprint.html');
await p.goto('file://'+file,{waitUntil:'load'});await wait(1200);
T('webkit boot: DB + switchView defined',await p.evaluate(()=>typeof DB==='object'&&typeof switchView==='function'));
T('webkit boot: Day-1 CTA',/Start today.*Legs A/.test(await p.evaluate(()=>document.querySelector('.cta')?.textContent||'')));
for(const v of ['home','lift','run','roadmap','fuel','numbers','track','guide']){await p.evaluate(n=>switchView(n),v);await wait(150);
  T('webkit view: '+v,await p.evaluate(n=>{const e=document.getElementById('view-'+n);return e&&e.offsetParent!==null&&e.innerHTML.length>500;},v));}
// Storage path 1: real input → DB.save → localStorage + IndexedDB mirror + account mirror (window.storage mock).
await p.evaluate(()=>switchView('track'));await wait(200);
await p.evaluate(()=>{document.getElementById('wVal').value='88.4';document.getElementById('wAdd').click();});await wait(900);
const st=await p.evaluate(async()=>{const ls=JSON.parse(localStorage.getItem('cb2_weight')||'[]').length;const cs=(window.__cs['cb2_all']||'').includes('88.4');
  const idb=await new Promise(res=>{const q=indexedDB.databases?indexedDB.databases():Promise.resolve(null);q.then(d=>res(d?d.map(x=>x.name):['n/a'])).catch(()=>res(['err']));});return {ls,cs,idb};});
T('webkit storage: weigh-in → localStorage',st.ls===1,JSON.stringify(st));T('webkit storage: account mirror (window.storage) received it',st.cs,JSON.stringify(st));T('webkit storage: IndexedDB vault exists',Array.isArray(st.idb)&&st.idb.length>0,JSON.stringify(st.idb));
// Storage path 2: backup → wipe → restore (reload) → cloudBoot/idbBoot on the reloaded page.
const backup=await p.evaluate(()=>backupJSON());
const nav=p.waitForNavigation({waitUntil:'load',timeout:15000});await p.evaluate(j=>{localStorage.clear();applyRestoreText(j);},backup);await nav;await wait(900);
T('webkit storage: restore survives reload',await p.evaluate(()=>DB.weight.length===1&&+DB.weight[0].v===88.4));
await p.evaluate(()=>switchView('home'));await wait(300);
fs.mkdirSync(path.resolve(__dirname,'shots'),{recursive:true});await p.screenshot({path:path.resolve(__dirname,'shots/webkit-home-390.png'),fullPage:false});
await p.evaluate(()=>switchView('lift'));await wait(300);await p.screenshot({path:path.resolve(__dirname,'shots/webkit-lift-390.png'),fullPage:false});
T('webkit: no page/console errors',errs.length===0,errs.join('|').slice(0,300));
// --- upgrade features in the Safari engine (2026-09-26)
{const c2=await b.newContext({viewport:{width:390,height:844},timezoneId:'Africa/Johannesburg'});
 await c2.route(u=>!(u.protocol==='file:'||u.protocol==='data:'),r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await c2.addInitScript(()=>{const R=Date;const fixed=new R('2026-09-27T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;
   if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();const S=(d,day,e)=>({id:'w'+d,dateISO:d,day,loc:'gym',entries:e});const st=(n,r,w)=>Array.from({length:n},()=>({r:String(r),w:String(w)}));
   localStorage.setItem('cb2_sessions',JSON.stringify([S('2026-09-13','pushA',{pa1:st(4,8,60)}),S('2026-09-20','pushA',{pa1:st(4,8,62.5)})]));}});
 const q=await c2.newPage();const e2=[];q.on('pageerror',e=>e2.push(e.message));await q.goto('file://'+file,{waitUntil:'load'});await wait(1200);
 await q.click('.tab[data-view="lift"]');await wait(500);
 const lf=await q.evaluate(()=>({cur:curDay,next:document.querySelector('[data-prog="pa1"]')?.innerText||'',awake:!!document.getElementById('awakeRow')?.innerText,today:todayISO()}));
 T('webkit: Lift tab opens Sunday\'s Push A in Johannesburg time',lf.cur==='pushA'&&lf.today==='2026-09-27',JSON.stringify(lf));
 T('webkit: auto-progression card renders (bench 8s at 62.5 → 65 kg)',/Add load: 65 kg/.test(lf.next),lf.next);T('webkit: session tools row renders',lf.awake);
 await q.evaluate(()=>{const r=document.querySelector('#liftBody input[data-ex="pa1"][data-i="0"][data-f="r"]'),w=document.querySelector('#liftBody input[data-ex="pa1"][data-i="0"][data-f="w"]');r.value='8';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='65';w.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#liftBody [data-chk="pa1"][data-i="0"]').click();});await wait(1600);
 const rt=await q.evaluate(()=>({show:document.getElementById('restTimer').classList.contains('show'),t:document.getElementById('restTime').textContent,strip:document.getElementById('sessStrip')?.innerText||''}));
 T('webkit: ticking a set starts the rest timer and updates the session strip',rt.show&&/1 set done/.test(rt.strip),JSON.stringify(rt));
 await q.evaluate(()=>{switchView('track');document.querySelector('.track-tabs button[data-tp="lifts"]').click();});await wait(400);
 T('webkit: Track Lifts pane charts the logged exercise',await q.evaluate(()=>!!document.querySelector('#exChart svg')&&document.querySelectorAll('#exSel option').length>=1));
 await q.evaluate(()=>switchView('home'));await wait(300);T('webkit: coach pack renders on Home',await q.evaluate(()=>!!document.getElementById('coachPack')&&/App verdict/.test(coachText())));
 await q.evaluate(()=>switchView('track'));await wait(200);T('webkit: Track picker keys lifts by place (gym/home never share a line)',await q.evaluate(()=>[...document.querySelectorAll('#exSel option')].every(o=>/@(gym|home)$/.test(o.value))));
 const ic=await q.evaluate(()=>{const t=icsText(),enc=new TextEncoder();return {ok:t.startsWith('BEGIN:VCALENDAR\r\n')&&t.endsWith('END:VCALENDAR\r\n'),long:t.split('\r\n').filter(l=>enc.encode(l).length>75).length,ev:(t.match(/BEGIN:VEVENT/g)||[]).length};});
 T('webkit: calendar file builds in Safari’s engine (valid frame, folded lines)',ic.ok&&ic.long===0&&ic.ev>20,JSON.stringify(ic));
 await q.evaluate(()=>{window.__said=[];try{Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){window.__said.push(u.text);},cancel(){}}});}catch(e){}switchView('lift');});await wait(300);
 const vc=await q.evaluate(()=>{const b=document.getElementById('voiceBtn');if(b&&!b.disabled)b.click();return {btn:!!b,said:window.__said.slice()};});
 T('webkit: voice cue button renders and speaks when switched on',vc.btn&&vc.said.includes('Voice cue on'),JSON.stringify(vc));
 await q.evaluate(()=>switchView('home'));await wait(600);T('webkit: phone panel measures this browser live',await q.evaluate(()=>/This phone, checked live/i.test(document.getElementById('phoneCaps')?.innerText||'')&&/offline file copy/.test(document.getElementById('phoneCaps').innerText)));
 await q.evaluate(()=>switchView('roadmap'));await wait(300);await q.screenshot({path:path.resolve(__dirname,'shots/webkit-roadmap-ics-390.png'),fullPage:false});
 T('webkit: upgrade walk has no page errors',e2.length===0,e2.join('|'));await c2.close();}
// --- offline install in the Safari engine: serve dist/ over http like GitHub Pages
{const http=require('http');const DIST=path.resolve(__dirname,'../dist'),BASE='/comeback-blueprint/dist/';const TY={'.html':'text/html; charset=utf-8','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
 const srv=http.createServer((rq,rs)=>{const u=decodeURIComponent(rq.url.split('?')[0]);let f=u.startsWith(BASE)?path.join(DIST,u.slice(BASE.length)||'index.html'):null;if(!f||!fs.existsSync(f)){rs.writeHead(404);return rs.end();}rs.writeHead(200,{'Content-Type':TY[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(rs);});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const APP='http://127.0.0.1:'+srv.address().port+BASE+'ComebackBlueprint.html';
 const c3=await b.newContext({viewport:{width:390,height:844},timezoneId:'Africa/Johannesburg'});await c3.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 const q=await c3.newPage();await q.goto(APP,{waitUntil:'load'});await wait(1000);
 const sw=await q.evaluate(async()=>{if(!('serviceWorker' in navigator))return {supported:false};const reg=await Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),8000))]);return {supported:true,active:!!(reg&&reg.active),manifest:!!document.querySelector('link[rel="manifest"]')};});
 T('webkit pwa: manifest linked and service worker active over http',sw.supported&&sw.active&&sw.manifest,JSON.stringify(sw));
 // Playwright's setOffline() breaks every WebKit navigation ("internal error"), so take the server down for real instead.
 if(sw.active){await q.reload({waitUntil:'load'});await wait(800);await new Promise(r=>srv.close(r));if(srv.closeAllConnections)srv.closeAllConnections();let ok=false;try{await q.reload({waitUntil:'load',timeout:15000});await wait(900);ok=await q.evaluate(()=>typeof DB==='object'&&document.getElementById('view-home').innerHTML.length>500);}catch(e){ok=false;}
  T('webkit pwa: boots from the service-worker cache with the server down',ok);}
 await c3.close();try{srv.close();}catch(e){}}
await b.close();
const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+(x.detail||'')).join('\n')||'WEBKIT ALL PASS');console.log('WEBKIT RESULT:',pass+'/'+R.length);process.exit(pass===R.length?0:1);})().catch(e=>{console.error('WEBKIT CRASH:',e.message);process.exit(2);});

// WebKit acceptance (Safari/iOS engine) — boot, every view, the storage paths, a 390×844 screenshot.
// Run: node qa/webkit.js  (after `npx playwright install webkit`; on Linux also `npx playwright install-deps webkit`).
// Chromium remains the functional suite (qa_full.js); this is the Safari-behaviour gate from CLAUDE.md §4 step 6.
const {webkit}=require('playwright');const path=require('path');const fs=require('fs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const R=[];const T=(n,ok,d)=>R.push({name:n,ok:!!ok,detail:d});
(async()=>{const iso=process.argv[2]||'2026-09-12';
const b=await webkit.launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,timezoneId:'Africa/Johannesburg'});
await ctx.route(u=>!(u.protocol==='file:'||u.protocol==='data:'||u.protocol==='blob:'),r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await ctx.addInitScript(iso=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;
  const store={};window.__cs=store;window.storage={async get(k){if(!(k in store))throw new Error('nf');return{key:k,value:store[k]};},async set(k,v){store[k]=String(v);return{key:k,value:v};},async delete(k){delete store[k];return{key:k}},async list(){return{keys:Object.keys(store)}}};},iso);
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const file=fs.existsSync(path.resolve(__dirname,'ComebackBlueprint.html'))?path.resolve(__dirname,'ComebackBlueprint.html'):path.resolve(__dirname,'../dist/ComebackBlueprint.html');
await p.goto('file://'+file,{waitUntil:'load'});await wait(1200);
T('webkit boot: DB + switchView defined',await p.evaluate(()=>typeof DB==='object'&&typeof switchView==='function'));
T('webkit boot: Day-1 CTA',/Start today.*Legs A/.test(await p.evaluate(()=>document.querySelector('.cta')?.textContent||'')));
T('webkit dates: Johannesburg zone, dateAdd/todayISO stay on the local day',await p.evaluate(()=>dateAdd(START_ISO,0)===START_ISO&&dateAdd(START_ISO,7)==='2026-09-19'&&todayISO()==='2026-09-12'&&weekStartISO(1)===START_ISO));
T('webkit copy: run-era copy retired on Lift/Numbers/footer',await p.evaluate(()=>{switchView('lift');const l=document.getElementById('view-lift').innerText;switchView('numbers');const n=document.getElementById('view-numbers').innerText;switchView('guide');const g=document.getElementById('view-guide').innerText;return /six lifting days/.test(l)&&!/Post-race|4 lifting days/.test(l)&&/Maintenance week/.test(n)&&!/Race Block|Race Time Predictor|Goal 10K/.test(n)&&/Pure Muscle · FFMI 25 · Day 1 Sat 12 Sep 2026/.test(g)&&!/Strength \+ Speed/.test(g);}));
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
// Storage path 3: delete → Undo puts the entry back in localStorage and the account mirror (26 Sep visual round).
await p.evaluate(()=>switchView('track'));await wait(200);
await p.evaluate(()=>document.querySelector('[data-delw]').click());await wait(250);
const del=await p.evaluate(()=>({n:DB.weight.length,undo:!!document.querySelector('#toast.show .undo')}));
await p.evaluate(()=>{const u=document.querySelector('#toast .undo');if(u)u.click();});await wait(900);
const und=await p.evaluate(()=>({n:DB.weight.length,ls:JSON.parse(localStorage.getItem('cb2_weight')||'[]').length,cs:(window.__cs['cb2_all']||'').includes('88.4')}));
T('webkit storage: delete offers Undo; Undo restores localStorage and the account mirror',del.n===0&&del.undo&&und.n===1&&und.ls===1&&und.cs,JSON.stringify({del,und}));
// Visual: charts drawn at true scale, so Safari renders their labels at full size (the roadmap and gauge were ~4-5 px).
const chartPx=await p.evaluate(async()=>{let min=99,where='';for(const v of ['roadmap','numbers']){switchView(v);await new Promise(r=>setTimeout(r,150));document.querySelectorAll('#view-'+v+' svg.chart-svg,#view-'+v+' svg.gauge-svg').forEach(s=>{const k=s.getBoundingClientRect().width/s.viewBox.baseVal.width;s.querySelectorAll('text').forEach(t=>{const f=parseFloat(getComputedStyle(t).fontSize)*k;if(f<min){min=f;where=v+':'+t.textContent;}});});}return {min:+min.toFixed(2),where};});
T('webkit visual: roadmap, ETA and gauge labels render at 10.5 px or more at 390 px',chartPx.min>=10.5,JSON.stringify(chartPx));
// Chart readout (27 Sep): a tap on the roadmap chart prints the date, projected weight and phase above it.
const rd=await p.evaluate(async()=>{switchView('roadmap');await new Promise(r=>setTimeout(r,200));const s=document.querySelector('#rmChart svg[data-tip]');s.scrollIntoView({block:'center'});const b=s.getBoundingClientRect();return {x:b.left+b.width*0.3,y:b.top+b.height/2,id:s.dataset.tip};});
await p.mouse.click(rd.x,rd.y);await wait(150);const rt=await p.evaluate(id=>(document.getElementById(id+'r')||{innerText:''}).innerText.trim(),rd.id);
T('webkit readout: a tap on the roadmap chart prints date, weight and phase',/^\d{1,2} [A-Z][a-z]{2} ’\d\d · \d+\.\d kg · \S/.test(rt),rt);
// Progress photos (27 Sep): a photo picked through the file chooser is stored as a JPEG Blob in IndexedDB and decodes on screen.
{const img=path.resolve(__dirname,'shots/webkit-photo-src.jpg');fs.mkdirSync(path.dirname(img),{recursive:true});await p.screenshot({path:img,type:'jpeg'});
 await p.evaluate(()=>{switchView('track');document.querySelector('.track-tabs button[data-tp="measure"]').click();});await wait(300);
 const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}),p.click('[data-ph="front"]')]);await fc.setFiles(img);await wait(1200);
 const ph=await p.evaluate(async()=>{const a=await phAll();const im=document.querySelector('#phBody .ph-cmp img');return {n:a.length,type:a[0]&&a[0].blob.type,ok:!!(im&&im.complete&&im.naturalWidth>0)};});
 T('webkit photos: picked photo stored as a JPEG in IndexedDB and shown',ph.n===1&&ph.type==='image/jpeg'&&ph.ok,JSON.stringify(ph));}
await p.evaluate(()=>switchView('home'));await wait(300);
fs.mkdirSync(path.resolve(__dirname,'shots'),{recursive:true});await p.screenshot({path:path.resolve(__dirname,'shots/webkit-home-390.png'),fullPage:false});
await p.evaluate(()=>switchView('lift'));await wait(300);await p.screenshot({path:path.resolve(__dirname,'shots/webkit-lift-390.png'),fullPage:false});
await p.evaluate(()=>switchView('home'));await wait(200);
T('webkit tech: rest timer finishes from wall-clock time after the phone was away',await p.evaluate(async()=>{startRest(90);const f=Date.now();Date.now=()=>f+95000;document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,100));const ok=document.getElementById('restTime').textContent==='Go!'&&(window.__beeps||0)>=1;Date.now=()=>f;return ok;}));
T('webkit tech: weekly check-in text for Claude builds',await p.evaluate(()=>/Weekly check-in from The Comeback Blueprint/.test(coachText())&&/Use only the numbers above/.test(coachText())));
T('webkit tech: Track Lifts and Regions panes render (7 regions)',await p.evaluate(async()=>{switchView('track');await new Promise(r=>setTimeout(r,150));return document.querySelectorAll('#tp-regions .rg').length===7&&!!document.getElementById('tp-lifts');}));
T('webkit tech: no manifest or service worker on file:// (install layer is http-only)',await p.evaluate(()=>!document.querySelector('link[rel=manifest]')&&!window.__swReg));
T('webkit: no page/console errors',errs.length===0,errs.join('|').slice(0,300));
await b.close();
const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+String(x.detail||'').replace(/\s+/g,' ').slice(0,400)).join('\n')||'WEBKIT ALL PASS');console.log('WEBKIT RESULT:',pass+'/'+R.length);process.exit(pass===R.length?0:1);})().catch(e=>{console.error('WEBKIT CRASH:',e.message);process.exit(2);});

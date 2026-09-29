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
 const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}),p.click('[data-ph="front"]')]);await fc.setFiles(img);for(let i=0;i<80;i++){await wait(100);if(await p.evaluate(()=>/^Saved · /.test(document.getElementById('toast').innerText)))break;}await wait(300);
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
// Safari zooms the page when a field under 16 px takes focus; every field in the app must be 16 px or more, and selects draw their own chevron.
{const z=await p.evaluate(()=>{const small=[];for(const v of [...document.querySelectorAll('.tab[data-view]')].map(x=>x.dataset.view)){switchView(v);if(v==='track')document.querySelectorAll('[data-tp]').forEach(x=>x.click());document.querySelectorAll('#view-'+v+' input,#view-'+v+' select,#view-'+v+' textarea').forEach(e=>{if(/file|checkbox|radio|range|hidden/.test(e.type))return;const f=parseFloat(getComputedStyle(e).fontSize);if(f<16)small.push(v+':'+(e.id||e.tagName)+':'+f);});}
  const s=document.querySelector('select.sel'),i=document.getElementById('wVal');return {small,sel:s&&getComputedStyle(s).backgroundImage.slice(0,20),app:s&&(getComputedStyle(s).webkitAppearance||getComputedStyle(s).appearance),inp:getComputedStyle(i).backgroundImage};});
 T('webkit iPhone: no field under 16 px (no focus zoom); selects draw the chevron, number fields do not',z.small.length===0&&/svg/.test(z.sel||'')&&z.app==='none'&&z.inp==='none',JSON.stringify(z));}
// Round-2 engine (27 Sep): lean above the ceiling on a typed body fat never breaks the ETA chart in Safari; the one-tap tape estimate saves and Undo restores.
{const r=await p.evaluate(async()=>{const w0=DB.profile.weight,bf0=DB.profile.bf;DB.profile.weight=98.5;DB.measure.push({date:todayISO(),waist:97,neck:39.5});switchView('roadmap');await new Promise(r=>setTimeout(r,200));const c=[...document.querySelectorAll('#view-roadmap .card')].find(x=>/How Fast Can You Reach/.test(x.textContent));if(!c)return {miss:true};const a={bad:/Infinity|NaN/.test(c.innerHTML),svg:!!c.querySelector('svg[data-tip]'),btn:!!c.querySelector('.bf-stale button')};const bt=c.querySelector('.bf-stale button');if(bt)bt.click();await new Promise(r=>setTimeout(r,300));const b={bf:DB.profile.bf,ls:JSON.parse(localStorage.getItem('cb2_profile')).bf,undo:!!document.querySelector('#toast.show .undo')};const u=document.querySelector('#toast .undo');if(u)u.click();await new Promise(r=>setTimeout(r,300));const z={bf:DB.profile.bf,ls:JSON.parse(localStorage.getItem('cb2_profile')).bf};DB.measure.pop();DB.profile.weight=w0;DB.save();return {a,b,z,bf0};});
 T('webkit engine: lean above the ceiling shows the body-fat state with no broken chart; the tape estimate saves to localStorage and Undo restores it',!r.miss&&!r.a.bad&&!r.a.svg&&r.a.btn&&r.b.bf===24.1&&r.b.ls===24.1&&r.b.undo&&r.z.bf===r.bf0&&r.z.ls===r.bf0,JSON.stringify(r));}
// Round-2 coach (27 Sep 2026): Home follows today's session in Safari too. One set typed in the real Lift grid turns the CTA into "Continue".
{await p.evaluate(()=>{switchView('home');const c=document.querySelector('#view-home .cta');if(c)c.click();});await wait(300);
 await p.evaluate(()=>{const put=(f,v)=>{const i=document.querySelector('#liftBody input.cell[data-ex="ga1"][data-i="0"][data-f="'+f+'"]');if(i){i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));}};put('r','8');put('w','60');});await wait(300);
 const c=await p.evaluate(()=>{switchView('home');return {cta:((document.querySelector('#view-home .cta')||{}).textContent||'').trim(),ls:JSON.parse(localStorage.getItem('cb2_sessions')||'[]').filter(x=>x.dateISO===todayISO()).length};});
 T('webkit home: one logged set turns the CTA into "Continue Legs A — 1 of 8 exercises", and the session is in localStorage',/^▶ Continue Legs A — 1 of 8 exercises$/.test(c.cta)&&c.ls===1,JSON.stringify(c));}
// Lift (round 2): guided mode scrolls to the current exercise under the sticky header in Safari too.
{const g=await p.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));switchView('lift');const hb=document.querySelector('#locSeg button[data-loc="home"]');if(hb)hb.click();await W(250);const B=re=>[...document.querySelectorAll('#liftBody button')].find(b=>re.test(b.textContent.trim()));const gm=B(/Guide me/);if(!gm)return {err:'no Guide me'};gm.click();await W(250);const n=B(/^Next ›$/);if(n)n.click();await W(250);
  const x=document.querySelector('#liftBody .ex'),row=x&&x.querySelector('.set-row'),h=document.querySelector('header.app'),nav=document.querySelector('nav.tabs');const r=x&&row&&h?{top:Math.round(x.getBoundingClientRect().top),hb:Math.round(h.getBoundingClientRect().bottom),row:Math.round(row.getBoundingClientRect().bottom),nt:Math.round(nav?nav.getBoundingClientRect().top:innerHeight)}:{err:'no card'};
  focusOn=false;const gy=document.querySelector('#locSeg button[data-loc="gym"]');if(gy)gy.click();switchView('home');return r;});
 T('webkit lift: guided Next lands on the current exercise below the header, first set row on screen',!g.err&&g.top>=g.hb-2&&g.top<422&&g.row<=g.nt,JSON.stringify(g));}
// A South African keypad types "88,4": the log fields are text fields with a decimal keypad, so Safari keeps the comma; refusals are named and save nothing.
{await p.evaluate(()=>{switchView('track');document.querySelector('[data-tp="weight"]').click();});await wait(300);
 await p.fill('#wDate','2026-09-11');await p.fill('#wVal','88,9');await p.click('#wAdd');await wait(300);
 const c1=await p.evaluate(()=>({has:DB.weight.some(x=>x.date==='2026-09-11'&&x.v===88.9),typ:document.getElementById('wVal')?document.getElementById('wVal').type:'gone'}));
 await p.fill('#wDate','2026-09-10');await p.fill('#wVal','886');await p.click('#wAdd');await wait(300);
 const c2=await p.evaluate(()=>({none:!DB.weight.some(x=>x.date==='2026-09-10'),err:/^err/.test(document.getElementById('toast').className),msg:document.getElementById('toast').innerText}));
 T('webkit data: "88,9" is read as 88.9 kg from a text field with a decimal keypad; 886 kg is refused with an error toast and nothing is saved',c1.has&&c2.none&&c2.err&&/between 30 and 250/.test(c2.msg),JSON.stringify({c1,c2}));}
// Round-2 audit (27 Sep 2026): the toast, macro tiles and lean-tier tiles as Safari lays them out (WebKit clipped the Fat tile).
{const u=await p.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));switchView('home');undoToast('Weigh-in deleted',()=>{});await W(450);const t=document.getElementById('toast'),sp=t.querySelector('span');const o={tw:Math.round(t.getBoundingClientRect().width),th:Math.round(sp.getBoundingClientRect().height)};t.className='';
  switchView('numbers');await W(200);const g=document.querySelector('#view-numbers .macro-row');o.macro=g?[g.scrollWidth,g.clientWidth]:null;o.tops=[];
  for(const bf of [10,18]){const b=document.querySelector('#ceilBfSeg button[data-bf="'+bf+'"]');if(b){b.click();await W(80);}o.tops.push([...document.querySelectorAll('#ceilOut .dose .dv')].map(v=>{const n=v.firstChild;if(!n||n.nodeType!==3)return null;const rg=document.createRange();rg.setStart(n,0);rg.setEnd(n,1);return Math.round(rg.getBoundingClientRect().top);}));}return o;});
 T('webkit layout: a short toast sits on one line, the macro tiles fit their box, and the lean-tier values share one line',u.th<24&&u.tw>195&&!!u.macro&&u.macro[0]<=u.macro[1]&&u.tops.length===2&&u.tops.every(a=>a.length===3&&a.every(x=>x!=null&&Math.abs(x-a[0])<=1)),JSON.stringify(u));}
// Round-3 stage S1 (29 Sep 2026): a corrupt store never bricks the app, Restore refuses the wrong shape, the page policy keeps the real fonts, a full store never reports "saved", the vault connection closes, two open copies reload from storage -- as Safari lays it out.
{const {fontReply}=require('./fontroute');
 const MOCKS=iso=>"(function(){var R=Date;var fixed=new R('"+iso+"T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;})();";
 const CSPW="window.__csp=[];document.addEventListener('securitypolicyviolation',function(e){window.__csp.push(e.violatedDirective+' '+e.blockedURI);});";
 const RAWS=o=>'localStorage.clear();'+Object.entries(o).map(([k,v])=>'localStorage.setItem('+JSON.stringify(k)+','+JSON.stringify(v)+');').join('');
 const safe=async(pg,fn,arg)=>{try{return await pg.evaluate(fn,arg);}catch(e){return {err:String(e&&e.message||e).slice(0,140)};}};
 const mkctx=async(init,fonts)=>{const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,timezoneId:'Africa/Johannesburg'});
   await c.route(u=>!(u.protocol==='file:'||u.protocol==='data:'||u.protocol==='blob:'),r=>{const f=fonts?fontReply(r.request().url()):null;if(f)r.fulfill({status:f.status,contentType:f.contentType,headers:f.headers,body:f.body});else r.fulfill({status:200,contentType:'text/css',body:''});});
   await c.addInitScript(init);return c;};
 const open=async(c)=>{const pg=await c.newPage();pg.__errs=[];pg.on('pageerror',e=>pg.__errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')pg.__errs.push(m.text());});await pg.goto('file://'+file,{waitUntil:'load'});await wait(1200);return pg;};
 // fonts and the policy
 {const c=await mkctx(MOCKS('2026-09-28')+CSPW,true);const pg=await open(c);let r=null;
  for(let i=0;i<50&&!(r&&r.mano&&r.media==='all');i++){await wait(150);r=await safe(pg,()=>{const L=[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/['"]/g,''));const lk=document.querySelector('link[rel=stylesheet][href*="fonts.googleapis"]');return {mano:L.includes('Manrope'),media:lk?lk.media:'none',csp:window.__csp.length};});}
  const bootErrs=pg.__errs.length;const n=await safe(pg,async()=>{const m=document.querySelector('meta[http-equiv="Content-Security-Policy"]');let f='allowed';try{await fetch('data:text/plain,hi');}catch(e){f='blocked';}await new Promise(r=>setTimeout(r,200));return {pol:m?m.content:'',fetch:f,viol:window.__csp.filter(v=>/^connect-src/.test(v)).length};});
  T('webkit CSP: the page policy allows the Google Fonts stylesheet and font files (Manrope loads, inline onload swap runs), boot raises no violation, and fetch is refused',!!r&&r.mano&&r.media==='all'&&r.csp===0&&!!n&&/connect-src 'none'/.test(n.pol||'')&&n.fetch==='blocked'&&n.viol>=1&&bootErrs===0,JSON.stringify({r,n,bootErrs,e:pg.__errs.join('|').slice(0,160)}));await c.close();}
 // a corrupt store already on the device
 {const BAD={cb2_weight:'[null,{},{"date":5,"v":"x"}]',cb2_sessions:'"abc"',cb2_measure:'{"a":1}',cb2_profile:'[]',cb2_bulk:'"zzz"',cb2_steps:'{oops',cb2_ceilbf:'1e999'};
  const c=await mkctx(MOCKS('2026-09-28')+RAWS(BAD));const pg=await open(c);
  const v=await safe(pg,async(V)=>{const o=[];for(const x of V){try{switchView(x);await new Promise(r=>setTimeout(r,90));const e=document.getElementById('view-'+x);o.push(e&&e.innerHTML.length>500?1:0);}catch(err){o.push('E');}}const ban=document.getElementById('storageWarnAll');return {o,ban:ban.classList.contains('show')&&/could not be read/.test(ban.textContent),bad:Object.keys(_bad).length,w:DB.weight.length,mode:bulkMode};},['home','lift','run','roadmap','fuel','numbers','track','guide']);
  T('webkit boot: seven keys holding the wrong shape still boot in Safari; all eight views render on the defaults and one banner says what was set aside',!!v&&Array.isArray(v.o)&&v.o.every(x=>x===1)&&v.ban&&v.bad>=6&&v.w===0&&v.mode==='aggr'&&pg.__errs.length===0,JSON.stringify(v)+pg.__errs.join('|').slice(0,120));
  const rr=await safe(pg,()=>{const snap=()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}return JSON.stringify(o);};window.confirm=()=>true;const before=snap();doRestore();const ta=document.getElementById('dataTa');if(ta)ta.value='{"cb2_weight":[null,{},{"date":5,"v":"x"}]}';const ap=document.getElementById('dataApply');if(ap)ap.click();const t=document.getElementById('toast');const a={err:/^err/.test(t.className),msg:t.innerText.slice(0,70),same:snap()===before};
    doRestore();if(ta)ta.value='\uFEFF'+JSON.stringify({cb2_weight:[{date:'2026-09-22',v:87.7}]})+'\r\n';if(ap)ap.click();a.bom=/87\.7/.test(localStorage.getItem('cb2_weight')||'');return a;});
  T('webkit restore: a wrong-shaped file is refused with nothing written, and a pasted file that starts with a byte-order mark restores',!!rr&&rr.err&&/valid backup/.test(rr.msg||'')&&rr.same&&rr.bom,JSON.stringify(rr));await c.close();}
 // full storage, and the vault connection
 {const c=await mkctx(MOCKS('2026-09-28')+RAWS({cb2_pure:'true',cb2_weight:'[{"date":"2026-09-20","v":88.4}]'}));const pg=await open(c);
  const r=await safe(pg,async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const out={};const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(/^cb2_/.test(k))throw new DOMException('quota','QuotaExceededError');return orig.call(this,k,v);};
    const el=document.getElementById('qW');if(el){el.value='90.5';quickLogWeight();}await W(80);const t=document.getElementById('toast');out.toast=t.className+'|'+t.innerText;out.undo=!!t.querySelector('.undo');const ban=document.getElementById('storageWarnAll');out.ban=ban.classList.contains('show')&&/full or refusing/.test(ban.textContent);
    Storage.prototype.setItem=orig;switchView('track');await W(150);const w2=document.getElementById('wVal');if(w2){w2.value='90.7';const ad2=document.getElementById('wAdd');if(ad2)ad2.click();}await W(80);out.ok=document.getElementById('toast').className;out.banGone=!document.getElementById('storageWarnAll').classList.contains('show');
    const opened=[];const oo=IDBFactory.prototype.open;IDBFactory.prototype.open=function(n){const rq=oo.apply(this,arguments);if(n==='cb2')rq.addEventListener('success',()=>{opened.push(rq.result);});return rq;};const oc=IDBDatabase.prototype.close;IDBDatabase.prototype.close=function(){this.__closed=true;return oc.apply(this,arguments);};
    for(let i=0;i<3;i++){DB.weight.push({date:'2026-09-2'+(2+i),v:89+i});DB.save();await W(80);}await _idbLast;await W(250);out.opened=opened.length;out.stillOpen=opened.filter(d=>!d.__closed).length;
    out.del=await new Promise(res=>{const d=indexedDB.deleteDatabase('cb2');d.onsuccess=()=>res('deleted');d.onblocked=()=>res('blocked');d.onerror=()=>res('error');setTimeout(()=>res('timeout'),3000);});return out;});
  T('webkit storage: with the store full a log says "Not saved" with no Undo and the banner shows; the banner clears when writes work again; the vault connection is closed after each save',!!r&&/^err/.test(r.toast||'')&&/Not saved/.test(r.toast||'')&&r.undo===false&&r.ban===true&&!/^err/.test(r.ok||'')&&r.banGone===true&&r.opened>=3&&r.stillOpen===0&&r.del==='deleted',JSON.stringify(r));await c.close();}
 // two open copies
 {const c=await mkctx(MOCKS('2026-09-28')+"if(!sessionStorage.getItem('__s')){sessionStorage.setItem('__s','1');}");const A=await open(c);
  await safe(A,()=>{localStorage.setItem('cb2_weight',JSON.stringify([{date:'2026-09-20',v:88.4}]));reloadDB();});
  const B2=await open(c);
  await safe(B2,async()=>{const el=document.getElementById('qW');if(el){el.value='91,0';quickLogWeight();}await new Promise(r=>setTimeout(r,120));});
  let ra=null;for(let i=0;i<30&&!(ra&&ra.n===2);i++){await wait(120);ra=await safe(A,()=>({n:DB.weight.length,toast:document.getElementById('toast').innerText}));}
  T('webkit two copies: a second open copy in Safari takes the first one\'s new log and says so instead of overwriting it',!!ra&&ra.n===2&&/Another open copy/.test(ra.toast||''),JSON.stringify(ra));await c.close();}
}
// Round-3 stage S2 (29 Sep 2026): the Lift's logging states as Safari runs them -- Fill is a suggestion until the tick, a tap selects the cell (iOS ignores a synchronous select), gym and home sets are two records in localStorage, the Lift tab keeps its place, a resumed page redraws Home.
{const MOCKS=iso=>"(function(){var R=Date;var base=new R('"+iso+"T09:00:00+02:00').getTime();window.__off=0;class M extends R{constructor(...a){if(a.length===0)super(base+window.__off);else super(...a);}static now(){return base+window.__off;}}window.Date=M;})();";
 const SEEDW='localStorage.clear();localStorage.setItem("cb2_pure","true");localStorage.setItem("cb2_sessions",JSON.stringify([{id:"w1",dateISO:"2026-09-21",day:"pullA",loc:"gym",entries:{la1:[{r:"10",w:"80"},{r:"10",w:"80"},{r:"9",w:"80"}]}}]));';
 const safe=async(pg,fn,arg)=>{try{return await pg.evaluate(fn,arg);}catch(e){return {err:String(e&&e.message||e).slice(0,140)};}};
 const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,timezoneId:'Africa/Johannesburg'});
 await c.route(u=>!(u.protocol==='file:'||u.protocol==='data:'||u.protocol==='blob:'),r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await c.addInitScript(MOCKS('2026-09-28')+SEEDW);
 const pg=await c.newPage();const perr=[];pg.on('pageerror',e=>perr.push(e.message));pg.on('console',m=>{if(m.type()==='error')perr.push(m.text());});
 await pg.goto('file://'+file,{waitUntil:'load'});await wait(1200);
 const cell=(ex,i,f)=>'input[data-ex="'+ex+'"][data-i="'+i+'"][data-f="'+f+'"]';
 await safe(pg,()=>goToLift());await wait(300);
 await safe(pg,()=>fillFromLast('la1'));await wait(200);
 const f0=await safe(pg,()=>{const raw=JSON.parse(localStorage.getItem('cb2_sessions')||'[]');return {today:raw.filter(x=>x.dateISO==='2026-09-28').length,pend:document.querySelectorAll('#liftBody tr.set-row.pending').length,on:document.querySelectorAll('#liftBody .chk.on').length};});
 await safe(pg,()=>document.querySelector('#liftBody .chk[data-chk="la1"][data-i="0"]').click());await wait(250);
 const f1=await safe(pg,()=>{const raw=JSON.parse(localStorage.getItem('cb2_sessions')||'[]').filter(x=>x.dateISO==='2026-09-28');return {n:raw.length,la:raw[0]&&raw[0].entries.la1?JSON.stringify(raw[0].entries.la1):null,pend:document.querySelectorAll('#liftBody tr.set-row.pending').length};});
 T('webkit lift: Fill prefills dashed rows that are not in localStorage; the tick writes exactly that set',!!f0&&f0.today===0&&f0.pend===3&&f0.on===0&&!!f1&&f1.n===1&&f1.la==='[{"r":"10","w":"80"}]'&&f1.pend===2,JSON.stringify({f0,f1}));
 // a tap on a filled cell selects it (iOS ignores a synchronous select, so the handler also selects on a timer)
 await pg.click(cell('la1',0,'w'));let sel=null;for(let i=0;i<20;i++){await wait(60);sel=await safe(pg,()=>{const e=document.activeElement;return {f:e&&e.dataset&&e.dataset.f,a:e&&e.selectionStart,b:e&&e.selectionEnd,n:e&&e.value.length};});if(sel&&sel.n===2&&sel.a===0&&sel.b===2)break;}
 T('webkit lift: tapping a filled cell selects its contents in Safari, so typing replaces it',!!sel&&sel.f==='w'&&sel.a===0&&sel.b===sel.n&&sel.n===2,JSON.stringify(sel));
 // gym set, switch to home, home set: two records, each with its own loc, in localStorage
 await safe(pg,()=>{const e=document.querySelector('input[data-ex="la1"][data-i="1"][data-f="r"]');e.value='9';e.dispatchEvent(new Event('input',{bubbles:true}));const w=document.querySelector('input[data-ex="la1"][data-i="1"][data-f="w"]');w.value='82.5';w.dispatchEvent(new Event('input',{bubbles:true}));});
 await safe(pg,()=>document.querySelector('#locSeg button[data-loc="home"]').click());await wait(300);
 const h0=await safe(pg,()=>({r0:document.querySelector('input[data-ex="la1"][data-i="0"][data-f="r"]').value,toast:document.getElementById('toast').innerText}));
 await safe(pg,()=>{const e=document.querySelector('input[data-ex="la1"][data-i="0"][data-f="r"]');e.value='12';e.dispatchEvent(new Event('input',{bubbles:true}));const w=document.querySelector('input[data-ex="la1"][data-i="0"][data-f="w"]');w.value='15';w.dispatchEvent(new Event('input',{bubbles:true}));});await wait(200);
 const h1=await safe(pg,()=>{const raw=JSON.parse(localStorage.getItem('cb2_sessions')||'[]').filter(x=>x.dateISO==='2026-09-28');return raw.map(x=>x.loc+':'+x.entries.la1.map(q=>q.r+'x'+q.w).join('/')).sort().join(' | ');});
 T('webkit lift: after gym sets, Home opens its own empty grid and its own record; localStorage holds one record per place',!!h0&&h0.r0===''&&/Commercial Gym log/.test(h0.toast||'')&&h1==='gym:10x80/9x82.5 | home:12x15',JSON.stringify({h0,h1}));
 // the Lift tab: a re-tap changes nothing, and a round trip through Fuel comes back to the same place
 await safe(pg,()=>document.querySelector('#locSeg button[data-loc="gym"]').click());await wait(300);
 const y=await safe(pg,()=>{const x=document.querySelectorAll('#liftBody .ex')[3];const y=Math.round(x.getBoundingClientRect().top+scrollY-120);window.scrollTo(0,y);document.getElementById('liftBody').dataset.mark='1';return y;});await wait(150);
 await pg.click('.tab[data-view="lift"]');await wait(300);
 const t1=await safe(pg,()=>({sy:Math.round(scrollY),mark:document.getElementById('liftBody').dataset.mark}));
 await pg.click('.tab[data-view="fuel"]');await wait(300);await pg.click('.tab[data-view="lift"]');await wait(400);
 const t2=await safe(pg,()=>Math.round(scrollY));
 T('webkit lift: tapping the Lift tab on Lift keeps the place and the page; Fuel and back returns to the same place',typeof y==='number'&&y>1000&&!!t1&&Math.abs(t1.sy-y)<=3&&t1.mark==='1'&&Math.abs(t2-y)<=3,JSON.stringify({y,t1,t2}));
 // a page restored after midnight (pageshow) redraws Home
 await safe(pg,()=>switchView('home'));await wait(250);
 await safe(pg,()=>{window.__off=20*60*1000+15*3600*1000;window.dispatchEvent(new Event('pageshow'));});await wait(300);
 const d1=await safe(pg,()=>({today:todayISO(),cta:(document.querySelector('#view-home .cta')||{}).textContent}));
 T('webkit home: a resumed page (pageshow) after the date has moved redraws Home for the new day',!!d1&&d1.today==='2026-09-29'&&/Legs B/.test(d1.cta||''),JSON.stringify(d1));
 T('webkit S2: no page errors in these steps',perr.length===0,perr.join('|').slice(0,200));
 await c.close();}
// Round-3 stage S3 (29 Sep 2026): accessibility as Safari runs it -- the keyboard pattern on the tab bar and the custom accordion buttons, the focus ring (Safari's own default ring was 2.94:1 on the segment buttons), the toast live region, the Lift toggles keeping the page in place, and the tab bar's layout unchanged by the new tablist wrapper.
{const MOCKS=iso=>"(function(){var R=Date;var base=new R('"+iso+"T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(base);else super(...a);}static now(){return base;}}window.Date=M;})();";
 const DEMO=fs.readFileSync(path.join(__dirname,'fixtures/demo.setup.js'),'utf8').trim().split('\n').pop();
 const safe=async(pg,fn,arg)=>{try{return await pg.evaluate(fn,arg);}catch(e){return {err:String(e&&e.message||e).slice(0,140)};}};
 const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,timezoneId:'Africa/Johannesburg'});
 await c.route(u=>!(u.protocol==='file:'||u.protocol==='data:'||u.protocol==='blob:'),r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await c.addInitScript(MOCKS('2026-09-28')+'try{localStorage.clear();}catch(e){}'+DEMO);
 const pg=await c.newPage();const perr=[];pg.on('pageerror',e=>perr.push(e.message));pg.on('console',m=>{if(m.type()==='error')perr.push(m.text());});
 await pg.goto('file://'+file,{waitUntil:'load'});await wait(1200);
 // tab bar layout: eight equal columns edge to edge (the tablist wrapper must not change the layout)
 const lay=await safe(pg,()=>{const r=[...document.querySelectorAll('nav.tabs .tab')].map(t=>t.getBoundingClientRect());return {n:r.length,w:r.map(x=>Math.round(x.width*10)/10),first:Math.round(r[0].left),last:Math.round(r[r.length-1].right),navH:Math.round(document.querySelector('nav.tabs').getBoundingClientRect().height)};});
 T('webkit a11y: the tab bar is still eight equal columns across the full width',!!lay&&lay.n===8&&lay.w.every(x=>Math.abs(x-lay.w[0])<=1)&&lay.first<=1&&lay.last>=389,JSON.stringify(lay));
 // keyboard on the tab bar
 await safe(pg,()=>document.getElementById('tab-home').focus());await pg.keyboard.press('ArrowRight');await wait(300);
 const k1=await safe(pg,()=>({ae:document.activeElement.id,act:(document.querySelector('.view.active')||{}).id,sel:(document.querySelector('[role=tab][aria-selected=true]')||{}).id,title:document.title}));
 await pg.keyboard.press('End');await wait(300);const k2=await safe(pg,()=>({ae:document.activeElement.id,act:(document.querySelector('.view.active')||{}).id}));
 T('webkit a11y: Right and End move along the tab bar (focus, selection and view together) and the title follows',!!k1&&k1.ae==='tab-lift'&&k1.act==='view-lift'&&k1.sel==='tab-lift'&&/^Lift/.test(k1.title)&&!!k2&&k2.ae==='tab-guide'&&k2.act==='view-guide',JSON.stringify({k1,k2}));
 // a custom accordion button from the keyboard
 await safe(pg,()=>switchView('fuel'));await wait(400);
 await safe(pg,()=>document.querySelector('.supp-h').focus());await pg.keyboard.press('Enter');await wait(150);
 const a1=await safe(pg,()=>{const h=document.querySelector('.supp-h');return {exp:h.getAttribute('aria-expanded'),open:document.getElementById(h.getAttribute('aria-controls')).classList.contains('open'),kept:document.activeElement===h};});
 await pg.keyboard.press('Space');await wait(150);
 const a2=await safe(pg,()=>{const h=document.querySelector('.supp-h');return {exp:h.getAttribute('aria-expanded'),kept:document.activeElement===h};});
 T('webkit a11y: Enter opens and Space closes a supplement accordion (role=button div), aria-expanded in step, focus kept',!!a1&&a1.exp==='true'&&a1.open&&a1.kept&&!!a2&&a2.exp==='false'&&a2.kept,JSON.stringify({a1,a2}));
 // the focus ring in Safari
 await pg.keyboard.press('Tab');
 const ring=await safe(pg,async()=>{const out=[],W=ms=>new Promise(r=>setTimeout(r,ms));const chk=async(v,sel)=>{switchView(v);await W(250);const e=[...document.querySelectorAll(sel)].find(x=>x.getClientRects().length);if(!e){out.push('missing '+sel);return;}e.focus();await W(320);const cs=getComputedStyle(e);if(cs.outlineStyle!=='solid'||parseFloat(cs.outlineWidth)<2||cs.outlineColor!=='rgb(255, 197, 61)')out.push(sel+' '+cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor);};
   await chk('lift','#locSeg button');await chk('lift','#liftBody .chk');await chk('lift','#dayPills .pill');await chk('fuel','.supp-h');await chk('track','#tp-weight .del');await chk('track','.track-tabs button');await chk('home','.card[role=link]');return out;});
 T('webkit a11y: segment buttons, ticks, pills, accordions, deletes and links show a 2 px gold focus ring in Safari (not the default 2.94:1 one)',Array.isArray(ring)&&ring.length===0,JSON.stringify(ring));
 // the Lift toggles keep the page in place when tapped
 await safe(pg,()=>switchView('lift'));await wait(400);
 const s0=await safe(pg,()=>{const e=document.querySelector('#locSeg');e.scrollIntoView({block:'center'});return {y:Math.round(scrollY),top:Math.round(e.getBoundingClientRect().top)};});await wait(150);
 await pg.click('#locSeg button[data-loc="home"]');await wait(500);
 const s1=await safe(pg,()=>({y:Math.round(scrollY),top:Math.round(document.querySelector('#locSeg').getBoundingClientRect().top),pressed:document.querySelector('#locSeg button[data-loc="home"]').getAttribute('aria-pressed')}));
 T('webkit a11y: tapping the Lift Home/Gym toggle leaves the page and the toggle where they were, and the new choice is aria-pressed',!!s0&&!!s1&&s0.y>50&&Math.abs(s1.y-s0.y)<=2&&Math.abs(s1.top-s0.top)<=2&&s1.pressed==='true',JSON.stringify({s0,s1}));
 // toast live region
 const t0=await safe(pg,()=>{const t=document.getElementById('toast');const a=[t.getAttribute('role'),t.getAttribute('aria-live')].join('/');toast('That did not save',false,true);return {fresh:a,bad:[t.getAttribute('role'),t.getAttribute('aria-live')].join('/')};});
 await safe(pg,()=>{window.__u=0;undoToast('Deleted',()=>{window.__u++;});window.__ub=document.querySelector('#toast .undo');});
 let gone=false;for(let i=0;i<45&&!gone;i++){await wait(200);gone=(await safe(pg,()=>document.getElementById('toast').className===''&&document.getElementById('toast').innerHTML===''))===true;}
 const t1=await safe(pg,()=>{const b=window.__ub;if(b)b.click();return {u:window.__u,btns:document.querySelectorAll('#toast button').length};});
 T('webkit a11y: the toast is a live region from first paint (alert for errors); a faded toast leaves no words or Undo, and a stale Undo runs nothing',!!t0&&t0.fresh==='status/polite'&&t0.bad==='alert/assertive'&&gone&&!!t1&&t1.u===0&&t1.btns===0,JSON.stringify({t0,gone,t1}));
 T('webkit a11y: no page errors in these steps',perr.length===0,perr.join('|').slice(0,200));
 await c.close();}
T('webkit: no page/console errors',errs.length===0,errs.join('|').slice(0,300));
await b.close();
const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+String(x.detail||'').replace(/\s+/g,' ').slice(0,400)).join('\n')||'WEBKIT ALL PASS');console.log('WEBKIT RESULT:',pass+'/'+R.length);process.exit(pass===R.length?0:1);})().catch(e=>{console.error('WEBKIT CRASH:',e.message);process.exit(2);});

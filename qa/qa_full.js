const puppeteer=require('puppeteer');const path=require('path');const fs=require('fs');
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
const STORAGE=()=>{const store={};window.__cs=store;window.storage={async get(k){if(!(k in store))throw new Error('nf');return{key:k,value:store[k]};},async set(k,v){store[k]=String(v);return{key:k,value:v};},async delete(k){delete store[k];return{key:k}},async list(){return{keys:Object.keys(store)}}};};
const R=[];const T=(name,ok,detail)=>{R.push({name,ok:!!ok,detail});};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const OFFLINE=async p=>{await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:'))r.continue();else r.respond({status:200,contentType:'text/css',body:''});});};
// The user lives in Johannesburg (UTC+2): run every page in that timezone so date bugs that hide in UTC show up here.
async function page(b,iso,extra){const p=await b.newPage();await p.emulateTimezone('Africa/Johannesburg');await OFFLINE(p);p.__errs=[];p.on('pageerror',e=>p.__errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.__errs.push(m.text());});
  await p.evaluateOnNewDocument(MOCK,iso);await p.evaluateOnNewDocument(STORAGE);if(extra)await p.evaluateOnNewDocument(extra);
  await p.goto('file://'+path.resolve('ComebackBlueprint.html'),{waitUntil:'networkidle0'});await p.setViewport({width:390,height:844,deviceScaleFactor:1});await wait(900);return p;}
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']});
// ===== A. Boot + all views (Fri 11 Sep) =====
let p=await page(b,'2026-09-12');
for(const v of ['home','lift','run','roadmap','fuel','numbers','track','guide']){await p.evaluate(n=>switchView(n),v);await wait(120);const vis=await p.evaluate(n=>document.getElementById('view-'+n).offsetParent!==null&&document.getElementById('view-'+n).innerHTML.length>500,v);T('view renders: '+v,vis);}
T('boot: no console/page errors',p.__errs.length===0,p.__errs.join('|').slice(0,200));
// ===== B. Home =====
await p.evaluate(()=>switchView('home'));await wait(300);
const home=await p.evaluate(()=>{const t=document.body.innerText;const m=milestoneProjection();return {cta:document.querySelector('.cta')?.textContent,weeks:m.weeks,pct:m.pct,lean:+m.lean.toFixed(1),ffmi:+m.ffmi.toFixed(1),bw:m.bw,card:t.includes('Soft milestone — 5–7 March 2027'),counters:t.includes('0/6')&&t.includes('0/3'),review:t.includes('Weekly Review — Week 1'),data:t.includes('Cloud-linked')};});
T('home: Day-1 CTA = Start Legs A',/Start today.*Legs A/.test(home.cta||''),home.cta);
T('home: milestone card present',home.card);
T('home: milestone weeks ≈25',home.weeks>=24&&home.weeks<=26,home.weeks);
T('home: milestone lean target FFMI ~24.4',home.ffmi>=24.0&&home.ffmi<=24.8,home.lean+' kg / FFMI '+home.ffmi);
T('home: milestone scale target ≈ band top (97–100)',home.bw>=96.5&&home.bw<=100.5,home.bw);
T('home: counters 0/6 & 0/3',home.counters);T('home: weekly review W1',home.review);T('home: cloud-linked card (mock)',home.data);
await p.evaluate(()=>document.querySelector('.cta').click());await wait(400);
T('home: CTA deep-links to Legs A on Day 1',await p.evaluate(()=>document.getElementById('view-lift').offsetParent!==null&&curDay==='legsA'));
// ===== C. Lift: pills, toggle, guided, furniture =====
const pills=await p.evaluate(()=>[...document.querySelectorAll('#dayPills .pill')].map(x=>x.textContent));T('lift: 7 pills',pills.length===7,pills.join(','));
await p.evaluate(()=>{[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent==='Legs A').click();});await wait(300);
await p.evaluate(()=>{[...document.querySelectorAll('#locSeg button')].find(x=>x.dataset.loc==='home').click();});await wait(400);
const lh=await p.evaluate(()=>{const t=document.body.innerText;return {first:document.querySelector('#liftBody .ex-nm')?.textContent,subs:document.querySelectorAll('#liftBody .ex').length,session:t.includes('Home session — Legs A'),rules:t.includes('Today’s rules —'),furniture:(t.toLowerCase().replace('no bar, bench, pull-up bar or cables','').match(/couch|chair|sofa|step\b|stairs|towel|tile|wall|table|bench/g)||[]).length};});
T('lift home: home headline',/Bear-Hug/.test(lh.first||''),lh.first);T('lift home: 8 cards',lh.subs===8);T('lift home: session card',lh.session);T('lift: rules line',lh.rules);T('lift home: zero furniture words',lh.furniture===0);
await p.evaluate(()=>{document.querySelector('#rulesTool .tool-h').click();});await wait(150);T('lift: rules opens on one tap',await p.evaluate(()=>document.getElementById('rulesTool').classList.contains('open')));
await p.evaluate(()=>{[...document.querySelectorAll('#liftBody button')].find(x=>x.textContent.includes('Guide me')).click();});await wait(350);
T('lift guided: single card 1/8',await p.evaluate(()=>document.querySelectorAll('#liftBody .ex').length===1&&/Exercise 1 of 8/.test(document.body.innerText)));
for(let i=0;i<7;i++){await p.evaluate(()=>{const n=[...document.querySelectorAll('#liftBody button')].find(x=>x.textContent.includes('Next'));if(n)n.click();});await wait(150);}
T('lift guided: Finish at 8/8',await p.evaluate(()=>!!([...document.querySelectorAll('#liftBody button')].find(x=>x.textContent.includes('Finish')))&&/Exercise 8 of 8/.test(document.body.innerText)));
await p.evaluate(()=>{[...document.querySelectorAll('#liftBody button')].find(x=>x.textContent.includes('Finish')).click();});await wait(300);
T('lift guided: exits to full list',await p.evaluate(()=>document.querySelectorAll('#liftBody .ex').length===8&&!focusOn));
// ===== D. Set logging via real inputs =====
const before=await p.evaluate(()=>DB.sessions.length);
await p.evaluate(()=>{const r=document.querySelector('input[data-ex="ga1"][data-i="0"][data-f="r"]'),w=document.querySelector('input[data-ex="ga1"][data-i="0"][data-f="w"]');r.value='12';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='15';w.dispatchEvent(new Event('input',{bubbles:true}));});await wait(400);
const logged=await p.evaluate(()=>{const s=DB.sessions.find(x=>x.day==='legsA'||Object.keys(x.entries||{}).includes('ga1'));return {n:DB.sessions.length,set:s&&s.entries&&s.entries.ga1&&s.entries.ga1[0],ls:JSON.parse(localStorage.getItem('cb2_sessions')||'[]').length};});
T('log: typing reps/kg creates a session',logged.n===before+1&&logged.set&&logged.set.r==12&&logged.set.w==15,JSON.stringify(logged.set));
T('log: session persisted to localStorage',logged.ls===logged.n);
await wait(700);T('log: cloud mirror received the session',await p.evaluate(()=>(window.__cs['cb2_all']||'').includes('ga1')));
await p.evaluate(()=>switchView('home'));await wait(350);
const cnt=await p.evaluate(()=>({lifts:sessionsThisWeek().lifts,txt:document.body.innerText.includes('1/6')}));T('log: lifts counter 1/6',cnt.lifts===1&&cnt.txt,JSON.stringify(cnt));
await p.evaluate(()=>{[...document.querySelectorAll('#locSeg button')].find(x=>x.dataset.loc==='gym')?.click();});
// ===== E. Track: weight + waist via real UI =====
await p.evaluate(()=>switchView('track'));await wait(350);
await p.evaluate(()=>{document.getElementById('wVal').value='88.4';document.getElementById('wAdd').click();});await wait(300);
const wt=await p.evaluate(()=>({n:DB.weight.length,v:DB.weight[DB.weight.length-1]&&DB.weight[DB.weight.length-1].v,profile:DB.profile.weight}));
T('track: weigh-in saves',wt.n===1&&+wt.v===88.4,JSON.stringify(wt));T('track: profile weight syncs',+wt.profile===88.4,wt.profile);
await p.evaluate(()=>{document.getElementById('meWaist').value='86';document.getElementById('meAdd').click();});await wait(300);
T('track: waist saves',await p.evaluate(()=>DB.measure.filter(x=>x.waist!=null).length===1));
await p.evaluate(()=>switchView('home'));await wait(350);
const sc=await p.evaluate(()=>{const r=weeklyReview();return {wi:r.wi,txt:document.body.innerText.includes('1/3'),verdict:r.verdict.slice(0,40),win:(document.body.innerText.match(/live score (\d)\/3/)||[])[1]};});
T('home: weigh-in counter 1/3',sc.wi===1&&sc.txt);T('home: win-plan teaser 1/3',await p.evaluate(()=>/The Win Plan — 1\/3 this week/.test(document.body.innerText)));T('home: weekly review no longer "nothing logged"',!/Nothing logged/.test(sc.verdict),sc.verdict);
// ===== F. Fuel =====
await p.evaluate(()=>switchView('fuel'));await wait(350);
const f1=await p.evaluate(()=>({mode:fuelQ,prem:(document.getElementById('suppStack').innerHTML.match(/Premium pick/g)||[]).length,casein:document.body.innerText.includes('Slow protein before bed'),steak:document.body.innerText.includes('rump or sirloin steak'),windows:document.body.innerText.includes('04:30 — the early window')}));
T('fuel: premium picks ×12',f1.prem===12);T('fuel: casein in 20:00 window',f1.casein);T('fuel: premium dinner swap',f1.steak);T('fuel: two-window schedule',f1.windows);
await p.evaluate(()=>{[...document.querySelectorAll('#fuelQSeg button')].find(x=>x.dataset.q==='standard').click();});await wait(400);
T('fuel: standard toggle removes premium',await p.evaluate(()=>fuelQ==='standard'&&(document.getElementById('suppStack').innerHTML.match(/Premium pick/g)||[]).length===0));
await p.evaluate(()=>{[...document.querySelectorAll('#fuelQSeg button')].find(x=>x.dataset.q==='premium').click();});await wait(300);
// ===== G. Numbers =====
await p.evaluate(()=>switchView('numbers'));await wait(350);
const n1=await p.evaluate(()=>({btns:[...document.querySelectorAll('#bulkSeg button')].map(x=>x.dataset.bm),on:document.querySelector('#bulkSeg button.on')?.dataset.bm,rate:+gainModel('hyper').rateKgWk.toFixed(2),surplus:gainModel('hyper').surplus,pro:macros('hyper').pro,goalFFMI:+compute().goalFFMInorm.toFixed(2),verdict:document.querySelector('#verdict .verdict')?.textContent.slice(0,50)}));
T('numbers: 5 bulk modes incl. aggr + cut',n1.btns.join()==='lean,balanced,max,aggr,cut'&&n1.on==='aggr',n1.btns.join());T('numbers: aggressive rate ≈0.42 kg/wk',Math.abs(n1.rate-0.42)<0.03,n1.rate);T('numbers: surplus ≈460',n1.surplus>=430&&n1.surplus<=500,n1.surplus);T('numbers: protein 2.2 g/kg (≈194)',n1.pro>=190&&n1.pro<=198,n1.pro);T('numbers: goal = FFMI 25.0',n1.goalFFMI===25);T('numbers: gauge verdict on the map',/sits on the natural map/.test(n1.verdict||''),n1.verdict);
await p.evaluate(()=>{[...document.querySelectorAll('#bulkSeg button')].find(x=>x.dataset.bm==='max').click();});await wait(250);T('numbers: max rate ≈0.31',await p.evaluate(()=>Math.abs(gainModel('hyper').rateKgWk-0.31)<0.03));
await p.evaluate(()=>{[...document.querySelectorAll('#bulkSeg button')].find(x=>x.dataset.bm==='aggr').click();});await wait(250);
await p.evaluate(()=>{document.getElementById('pGoalBf').value=18;setGoalFromFFMI();});await wait(200);T('numbers: FFMI button at 18% → 94.8',await p.evaluate(()=>Math.abs(DB.profile.goal-94.8)<0.15));
await p.evaluate(()=>{document.getElementById('pGoalBf').value=24;setGoalFromFFMI();});await wait(200);T('numbers: FFMI button at 24% → 102.3',await p.evaluate(()=>Math.abs(DB.profile.goal-102.3)<0.15));
// ===== H. Roadmap =====
await p.evaluate(()=>switchView('roadmap'));await wait(400);
const rm=await p.evaluate(()=>{const w=buildRoadmap();const ms=w.find(x=>x.wk===MILESTONE_WK);const peak=Math.max(...w.map(x=>x.bw));return {total:w.length,end:+w[w.length-1].bw.toFixed(1),ceil:Math.round(compute().ceilBW),peak:+peak.toFixed(1),msWk:MILESTONE_WK,msText:ms&&ms.milestone,cutStart:w.find(x=>/Mini-Cut I$/.test(x.phase||'')||/Mini-Cut I\b/.test(x.phase||''))?.wk,eta:document.body.innerText.includes('How Fast Can You Reach FFMI 25?'),etaRow:document.body.innerText.includes('5–7 Mar 2027 soft milestone'),deload:w.filter(x=>x.deload).slice(0,3).map(x=>x.wk)};});
T('roadmap: 104 weeks',rm.total===104);T('roadmap: end ≤ ceiling+0.5',rm.end<=rm.ceil+0.5,rm.end+' vs '+rm.ceil);T('roadmap: peak ≈ band top ≤ 100.5',rm.peak<=100.5,rm.peak);T('roadmap: milestone at week 26 (12 Sep anchor)',rm.msWk===26&&/Soft milestone/.test(rm.msText||''),rm.msWk+' '+rm.msText);T('roadmap: Mini-Cut I starts after the check (wk 28)',rm.cutStart===28,rm.cutStart);T('roadmap: ETA card + milestone row',rm.eta&&rm.etaRow);T('roadmap: deloads 6,12,18',rm.deload.join()==='6,12,18',rm.deload.join());
// ===== I. Events + Guide =====
await p.evaluate(()=>switchView('run'));await wait(350);
const ev=await p.evaluate(()=>{const t=document.body.innerText;return {months:(t.match(/\d+ events?\n/g)||[]).length,confirmed:(t.match(/CONFIRMED/g)||[]).length,hyrox:t.includes('HYROX Johannesburg'),parkedHidden:document.getElementById('toolParked').offsetParent===null};});
T('events: 12-month calendar',ev.months===12);T('events: ≥20 confirmed within 30 km of home',ev.confirmed>=20,ev.confirmed);T('events: home-distance filter (Lanseria in, Benoni out, Deadly Dozen ~15 km)',await p.evaluate(()=>{const t=document.body.innerText;const km=n=>evKm(RACES_12M.find(r=>r.name===n));return t.includes('within 30 km of home')&&km('Blair Atholl MTB')<=30&&km('Johnson Crane Hire Marathon')>30&&/Deadly Dozen Fitness Race — Johannesburg[\s\S]{0,700}~1[3-7] km from home/.test(t)&&t.includes('Just outside 30 km')&&t.includes('Johnson Crane Hire Marathon (Willowmoore Park, Benoni');}));T('events: HYROX listed',ev.hyrox);T('events: race plan hidden',ev.parkedHidden);
await p.evaluate(()=>switchView('guide'));await wait(350);
const gd=await p.evaluate(()=>{const t=document.body.innerText;return ['The Win Plan','As Fast As Legally Possible','Where Money Actually Buys Muscle','The Long Game','The Posterior Chain Case','Mode: Pure Muscle'].map(k=>t.includes(k));});
T('guide: all six doctrine cards',gd.every(Boolean),gd.join());
// ===== J. Storage roundtrip =====
const backup=await p.evaluate(()=>backupJSON());
await p.evaluate(()=>{localStorage.clear();});{const nav=p.waitForNavigation({waitUntil:'load',timeout:15000});await p.evaluate(j=>{applyRestoreText(j);},backup);await nav;}await wait(600);
T('storage: backup→wipe→restore keeps session+weight+waist',await p.evaluate(()=>DB.sessions.length===1&&DB.weight.length===1&&DB.measure.length===1));
T('A–J: no errors during interaction',p.__errs.length===0,p.__errs.join('|').slice(0,200));await p.close();
// ===== K. Time travel =====
const tt=async(iso)=>{const q=await page(b,iso);const r=await q.evaluate(()=>({wk:planWeek(),live:aggrLive(),rate:+gainModel('hyper').rateKgWk.toFixed(2),deload:isDeloadWeek(),ms:milestoneProjection().weeks,passed:milestoneProjection().passed,block:currentBlock().name,label:(macros('hyper').label||'').slice(0,30)}));const e=q.__errs.length;await q.close();return {...r,errs:e};};
const d1=await tt('2026-12-01');T('time: 1 Dec still Aggressive (0.42)',d1.live&&Math.abs(d1.rate-0.42)<0.03&&d1.errs===0,JSON.stringify(d1));
const d2=await tt('2027-03-05');T('time: 5 Mar — check weekend, still aggressive',d2.live&&d2.ms===0,JSON.stringify(d2));
const d3=await tt('2027-03-10');T('time: 10 Mar — stepped down to max (0.31), passed',!d3.live&&Math.abs(d3.rate-0.31)<0.03&&d3.passed,JSON.stringify(d3));
const d4=await tt('2026-10-23');T('time: week 6 deload flag',d4.deload&&d4.wk===6,JSON.stringify(d4));
const d5=await tt('2027-01-05');T('time: Jan = Posterior specialization block',/Posterior/.test(d5.block),d5.block);

// ===== L. Peak week + baseline (new) =====
{const q=await page(b,'2026-09-11',()=>{localStorage.clear();});
 const a=await q.evaluate(()=>({peakHome:document.body.innerText.includes('It is peak week'),peakGuideCount:0,base:baselineStatus(),row:document.body.innerText.includes('Baseline tapes 0/4'),hero:document.body.innerText.includes('as big as possible by 5 Mar 2027')}));
 T('peak: hidden on Home in September',!a.peakHome);T('peak: baseline row 0/4',a.row);T('peak: hero interim objective',a.hero);
 await q.evaluate(()=>switchView('guide'));await wait(300);T('peak: protocol readable in Guide',await q.evaluate(()=>document.body.innerText.includes('Peak Week — arrive as big as possible')));
 await q.evaluate(()=>switchView('track'));await wait(300);
 await q.evaluate(()=>{document.getElementById('meWaist').value='86';document.getElementById('meArm').value='36';document.getElementById('meChest').value='102';document.getElementById('meThigh').value='58';document.getElementById('meAdd').click();});await wait(300);
 await q.evaluate(()=>switchView('home'));await wait(300);
 T('peak: baseline row 4/4 after logging tapes',await q.evaluate(()=>document.body.innerText.includes('Baseline tapes 4/4')&&!document.body.innerText.includes('Log baseline tapes now')));
 T('L: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}
{const q=await page(b,'2027-03-01');const a=await q.evaluate(()=>({peak:document.body.innerText.includes('It is peak week'),weeks:milestoneProjection().weeks,live:aggrLive()}));T('peak: surfaces on Home at D-5 (1 Mar), still aggressive',a.peak&&a.live,JSON.stringify(a));await q.close();}
{const q=await page(b,'2027-03-12');const a=await q.evaluate(()=>({peak:document.body.innerText.includes('It is peak week'),hero:document.body.innerText.includes('as fast as the law allows')}));T('peak: gone after the check; hero reverts',!a.peak&&a.hero,JSON.stringify(a));await q.close();}

// ===== M. March routes =====
{const q=await page(b,'2026-09-11',()=>{localStorage.clear();});
 const r=await q.evaluate(()=>({def:marchKey,band:+marchTarget('band').bfM.toFixed(0),mass:+marchTarget('mass').bfM.toFixed(0),seg:!!document.querySelector('#marchSeg'),table:document.body.innerText.includes('choose the route, see the price')}));
 T('march: default route = band',r.def==='band');T('march: 110 route shows ~31% fat',r.mass>=30&&r.mass<=33,r.mass);T('march: selector + cost table render',r.seg&&r.table);
 for(const k of ['mass','edge','band']){await q.evaluate(k=>{[...document.querySelectorAll('#marchSeg button')].find(x=>x.dataset.mk===k).click();},k);await wait(450);
   const x=await q.evaluate(()=>{const w=buildRoadmap();return {key:marchKey,rate:+gainModel('hyper').rateKgWk.toFixed(2),peak:+w.find(v=>v.wk===MILESTONE_WK).bw.toFixed(1),end:+w[w.length-1].bw.toFixed(1),ceil:Math.round(compute().ceilBW),total:w.length,limit:aggrLive()?marchTarget().limit:3};});
   T('march '+k+': engine rate follows route',x.rate>0.3,JSON.stringify(x));T('march '+k+': roadmap peaks at target week 27',k==='mass'?x.peak>=109:k==='edge'?x.peak>=102:x.peak>=98,x.peak);T('march '+k+': roadmap ends on the ceiling (≤ +0.6)',x.end<=x.ceil+0.6&&x.total===104,x.end+' vs '+x.ceil);}
 T('M: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}

// ===== N. Fast-track lean + Cut mode + trigger =====
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();});
 const f=await q.evaluate(()=>{const m=fastTrackModel();return {cross:m.crossWeek,contractile:m.contractileWeek,tool:document.body.innerText.includes('Fastest way to the 3.3 kg'),brief:document.body.innerText.includes('Creatine fast track')};});
 T('fast: 3.3 kg crossed ≈ week 8',f.cross>=7&&f.cross<=9,f.cross);T('fast: contractile-only ≈ week 24',f.contractile>=22&&f.contractile<=26,f.contractile);T('fast: tool present on Home',f.tool);T('fast: creatine loading nudge in week 1',f.brief);
 await q.evaluate(()=>{document.querySelector('#view-home .tool .tool-h').click();});await wait(200);T('fast: tool opens on one tap',await q.evaluate(()=>document.querySelector('#view-home .tool').classList.contains('open')));
 await q.evaluate(()=>switchView('fuel'));await wait(300);T('fuel: creatine loading protocol — 20 g/day for 7 days, 10 g in each window',await q.evaluate(()=>{const h=document.getElementById('suppStack').innerHTML;return h.includes('20 g a day for 7 days')&&h.includes('10 g in each window');}));
 await q.evaluate(()=>switchView('numbers'));await wait(300);const calAggr=await q.evaluate(()=>macros('hyper').cal);
 await q.evaluate(()=>{[...document.querySelectorAll('#bulkSeg button')].find(x=>x.dataset.bm==='cut').click();});await wait(300);
 const c=await q.evaluate(()=>({mode:bulkMode,rate:+gainModel('hyper').rateKgWk.toFixed(2),surplus:gainModel('hyper').surplus,pro:macros('hyper').pro,cal:macros('hyper').cal,desc:document.body.innerText.includes('Cut: a controlled deficit')}));
 T('cut: rate ≈ −0.44 kg/wk',Math.abs(c.rate+0.44)<0.03,c.rate);T('cut: deficit ≈ −480 kcal',c.surplus<=-440&&c.surplus>=-520,c.surplus);T('cut: protein 2.4 g/kg (≈211)',c.pro>=207&&c.pro<=215,c.pro);T('cut: description renders',c.desc);T('cut: calories below aggressive-mode calories',c.cal<calAggr-800,c.cal+' vs '+calAggr);
 await q.evaluate(()=>{[...document.querySelectorAll('#bulkSeg button')].find(x=>x.dataset.bm==='aggr').click();});await wait(200);
 T('N: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}
{const seed=()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));const w=[];for(let i=0;i<13;i++){w.push({date:'2026-09-'+String(12+i).padStart(2,'0'),v:88+i*0.3});}
  // 13 weekly weigh-ins would span months; emulate dates properly
  const ws=[];const d0=new Date('2026-09-12T12:00:00');let v=88;for(let i=0;i<13;i++){const d=new Date(d0.getTime()+i*7*86400000);if(i>0)v+=(i<=10?0.85:0.35);ws.push({date:d.toISOString().slice(0,10),v:+v.toFixed(1)});}
  localStorage.setItem('cb2_weight',JSON.stringify(ws));localStorage.setItem('cb2_measure',JSON.stringify([{date:'2026-09-12',waist:86},{date:'2026-12-04',waist:90.2}]));};
 const q=await page(b,'2026-12-05',seed);
 const r=await q.evaluate(()=>{const v=weeklyReview();return {wk:roadmapWeekNow(),estLean:+v.estLean.toFixed(1),waistD:v.waistD,verdict:v.verdict,cls:v.cls,rate:v.rate==null?null:+v.rate.toFixed(2)};});
 T('trigger: lean banked ≥3.3 & waist +4 ⇒ cut advice',/cut can start now/.test(r.verdict),JSON.stringify(r));await q.close();}

// ===== O. Quick log + fill from last =====
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));localStorage.setItem('cb2_sessions',JSON.stringify([{dateISO:'2026-09-07',day:'legsA',entries:{ga1:[{r:12,w:15},{r:11,w:15},{r:10,w:15}]}}]));});
 const q0=await q.evaluate(()=>({card:document.body.innerText.includes('Quick log'),inputs:!!document.getElementById('qW')&&!!document.getElementById('qWa')}));
 T('quick: card + inputs on Home',q0.card&&q0.inputs);
 await q.evaluate(()=>{document.getElementById('qW').value='88.6';quickLogWeight();});await wait(350);
 const qw=await q.evaluate(()=>({n:DB.weight.length,v:DB.weight[0]&&DB.weight[0].v,today:document.body.innerText.includes('88.6 kg today'),profile:DB.profile.weight,counter:document.body.innerText.includes('1/3')}));
 T('quick: weight saves + shows ✓ today + profile synced + counter 1/3',qw.n===1&&+qw.v===88.6&&qw.today&&+qw.profile===88.6&&qw.counter,JSON.stringify(qw));
 await q.evaluate(()=>{document.getElementById('qWa').value='86';quickLogWaist();});await wait(350);
 T('quick: waist saves + baseline row 1/4',await q.evaluate(()=>DB.measure.some(x=>x.waist===86)&&document.body.innerText.includes('Baseline tapes 1/4')));
 await q.evaluate(()=>switchView('lift'));await wait(300);await q.evaluate(()=>{[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent==='Legs A').click();});await wait(300);
 T('fill: button shown when last-time exists',await q.evaluate(()=>!!document.querySelector('button[onclick="fillFromLast(\'ga1\')"]')));
 await q.evaluate(()=>fillFromLast('ga1'));await wait(400);
 const ff=await q.evaluate(()=>{const s=DB.sessions.find(x=>x.dateISO===todayISO());const r0=document.querySelector('input[data-ex="ga1"][data-i="0"][data-f="r"]').value;return {rows:s&&s.entries&&s.entries.ga1?s.entries.ga1.filter(x=>x&&x.r&&x.w).length:0,r0};});
 T('fill: three rows filled and saved as today\'s session',ff.rows===3&&ff.r0==='12',JSON.stringify(ff));
 T('O: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}

// ===== P. Pre-start day (11 Sep) =====
{const q=await page(b,'2026-09-11',()=>{localStorage.clear();});
 const a=await q.evaluate(()=>{const t=document.body.innerText;return {started:planStarted(),cta:document.querySelector('.cta')?.textContent||'',brief:t.includes('Day 1 Tomorrow')||t.includes('Tomorrow opens'),creatine:t.includes('start the creatine load'),quick:!!document.getElementById('qW'),ms:milestoneProjection().weeks};});
 T('prestart: not started, Day-1-tomorrow CTA',!a.started&&/Day 1 is/.test(a.cta),a.cta);T('prestart: brief tells him to load creatine today',a.creatine);T('prestart: quick log available before Day 1',a.quick);T('prestart: milestone ≈25 weeks',a.ms>=24&&a.ms<=26,a.ms);
 T('P: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}

// ===== Q. Highest doses + watch import =====
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 await q.evaluate(()=>switchView('fuel'));await wait(300);
 const f=await q.evaluate(()=>{const h=document.getElementById('suppStack').innerHTML;const t=document.body.innerText;return {hi:(h.match(/Highest recommended dose/g)||[]).length,creatine:h.includes('0.1 g/kg'),caff:h.includes('440\u2013530 mg')||h.includes('440–530 mg'),iron:h.includes('0 until ferritin'),ba:t.includes('3.2 g (½ of today’s 6.4 g)')&&t.includes('3.2 g (2nd ½ of 6.4 g)'),citr:t.includes('6–8 g · conditional')&&!t.includes('8–10 g · conditional')};});
 T('dose: highest-dose block on all 12 items',f.hi===12,f.hi);T('dose: creatine 0.1 g/kg + caffeine 440–530 + iron none',f.creatine&&f.caff&&f.iron,JSON.stringify(f));T('dose: timing card BA 3.2 g halves of 6.4 g in week 1 + citrulline 6–8 g (one figure everywhere)',f.ba&&f.citr,JSON.stringify(f));
 await q.evaluate(()=>switchView('home'));await wait(300);
 const r1=await q.evaluate(()=>importHealthText("2026-09-12,weight,88.4\n2026-09-12,sleep,7.4\n2026-09-12,rhr,52\n2026-09-12,steps,8200\n2026-09-11,sleep,6.2"));
 T('import: shortcut text → 5 readings',r1.n===5&&r1.kinds.weight===1&&r1.kinds.sleep===2,JSON.stringify(r1));
 const r2=await q.evaluate(()=>importHealthText('Date,Weight,Resting Heart Rate,Sleep,Total Steps\n2026-09-10,88.1,54,"7h 05m",7412\n2026-09-09,88.0,53,6:40,9001'));
 T('import: Garmin CSV → 8 readings (h/m and h:mm sleep parsed)',r2.n===8&&r2.kinds.sleep===2,JSON.stringify(r2));
 const r3=await q.evaluate(()=>importHealthText(JSON.stringify({weight:[{date:'2026-09-08',kg:87.9}],sleep:[{date:'2026-09-08',hours:6.5}],rhr:[{date:'2026-09-08',bpm:55}]})));
 T('import: JSON → 3 readings',r3.n===3,JSON.stringify(r3));
 const st=await q.evaluate(()=>({w:DB.weight.length,profile:DB.profile.weight,sleep:DB.sleep.length,rhr:DB.rhr.length,steps:DB.steps.length,ls:JSON.parse(localStorage.getItem('cb2_sleep')||'[]').length,dedupe:DB.sleep.filter(x=>x.date==='2026-09-12').length}));
 T('import: merged into DB + persisted + profile synced to latest weight',st.w===4&&+st.profile===88.4&&st.sleep===5&&st.rhr===4&&st.steps===3&&st.ls===5&&st.dedupe===1,JSON.stringify(st));
 await q.evaluate(()=>renderHome());await wait(300);
 const rc=await q.evaluate(()=>{const t=document.body.innerText;const v=weeklyReview();return {chips:/7\.4 h/.test(t)&&/52 bpm/.test(t)&&/8,200|8 200/.test(t),sleepRule:/Sleep averaged/.test(v.verdict),avg:+((DB.sleep.filter(x=>x.date>=dateAdd(todayISO(),-7)).reduce((a,x)=>a+x.h,0))/5).toFixed(2)};});
 T('recovery: chips on Home (sleep, rhr, steps)',rc.chips);T('review: sleep < 7 h avg ⇒ recovery verdict',rc.sleepRule,JSON.stringify(rc));
 T('import: UI present in Data card',await q.evaluate(()=>!!document.getElementById('healthTa')&&document.body.innerText.includes('Watch data')));
 await q.evaluate(()=>switchView('guide'));await wait(300);T('guide: watch recipe card',await q.evaluate(()=>document.body.innerText.includes('Connect Apple Watch & Garmin')));
 const bk=await q.evaluate(()=>backupJSON());T('backup: includes sleep/rhr/steps',/cb2_sleep/.test(bk)&&/cb2_rhr/.test(bk)&&/cb2_steps/.test(bk));
 T('Q: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}

// ===== R. Tape body-fat estimator =====
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 await q.evaluate(()=>switchView('numbers'));await wait(300);
 T('bf: hint shown when no neck logged',await q.evaluate(()=>document.body.innerText.includes('Body fat is still a typed number')));
 await q.evaluate(()=>switchView('track'));await wait(300);
 await q.evaluate(()=>{document.getElementById('meWaist').value='86';document.getElementById('meNeck').value='40';document.getElementById('meAdd').click();});await wait(300);
 const e=await q.evaluate(()=>estimateBF());T('bf: Navy estimate ≈15.8% from 86/40/177',e&&Math.abs(e.bf-15.8)<0.4,JSON.stringify(e));
 await q.evaluate(()=>switchView('numbers'));await wait(300);
 const before=await q.evaluate(()=>({bf:DB.profile.bf,chip:document.getElementById('cdDays').textContent,lean:+compute().leanNow.toFixed(1),btn:!!document.querySelector('button[onclick="applyTapeBF()"]')}));
 await q.evaluate(()=>applyTapeBF());await wait(300);
 const after=await q.evaluate(()=>({bf:DB.profile.bf,chip:document.getElementById('cdDays').textContent,lean:+compute().leanNow.toFixed(1),sync:document.body.innerText.includes('In sync')}));
 T('bf: apply button present when estimate differs',before.btn);T('bf: a waist+neck reading anchors lean mass automatically (≈88.4×(1−15.8%) before Apply is tapped)',Math.abs(before.lean-74.4)<0.3,JSON.stringify(before));T('bf: applying writes the tape % to the profile and the header chip matches the lean anchor',+after.bf===e.bf&&after.lean===before.lean&&after.chip===('+'+(77.7-after.lean).toFixed(1))&&after.sync,JSON.stringify({before,after}));
 T('R: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}

// ===== S. Legs & Back focus =====
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 const r=await q.evaluate(()=>{const rs=regionSets();return {on:focusLB,rs,newIds:['gb9','la9','lb9'].every(i=>GYM_ORDER.some(k=>GYM[k].ex.some(e=>e.id===i))),subs:['gb9','la9','lb9'].every(i=>!!HOME_SUB[i])};});
 T('focus: on by default; new calf/tib exercises + home subs',r.on&&r.newIds&&r.subs,JSON.stringify(r));
 T('focus: calves ≥12 sets/week, hamstrings ≥16, mid back ≥16',r.rs.calves>=12&&r.rs.hamstrings>=16&&r.rs['mid back']>=16,JSON.stringify(r.rs));
 await q.evaluate(()=>switchView('lift'));await wait(300);await q.evaluate(()=>{[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent==='Legs A').click();});await wait(300);
 const c=await q.evaluate(()=>({first:document.querySelector('#liftBody .chip')?.textContent.replace(/\s+/g,' '),rows:document.querySelectorAll('input[data-ex="ga1"][data-f="r"]').length,seg:!!document.querySelector('#focusSeg'),rules:/legs & back focus/.test(document.body.innerText)}));
 T('focus: Legs A squat shows 5 sets + focus tag, and 6 rows (Aggressive +1 set pre-added, matching the +1 chip)',/^5×/.test(c.first||'')&&/focus/.test(c.first||'')&&/\+1/.test(c.first||'')&&c.rows===6,JSON.stringify(c));T('focus: toggle + rules summary',c.seg&&c.rules);
 await q.evaluate(()=>{[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent==='Push A').click();});await wait(300);
 const t=await q.evaluate(()=>({fly:[...document.querySelectorAll('#liftBody .ex')].find(x=>x.textContent.includes('Fly'))?.querySelector('.chip')?.textContent.replace(/\s+/g,' ')}));
 T('focus: chest fly trimmed to 2 sets',/^2×/.test(t.fly||'')&&/trim/.test(t.fly||''),t.fly);
 await q.evaluate(()=>{[...document.querySelectorAll('#focusSeg button')].find(x=>x.dataset.fx==='off').click();});await wait(350);
 const off=await q.evaluate(()=>({on:focusLB,fly:[...document.querySelectorAll('#liftBody .ex')].find(x=>x.textContent.includes('Fly'))?.querySelector('.chip')?.textContent.replace(/\s+/g,' '),persisted:JSON.parse(localStorage.getItem('cb2_focuslb'))}));
 T('focus: off restores 3 sets and persists',!off.on&&/^3×/.test(off.fly||'')&&off.persisted===false,JSON.stringify(off));
 await q.evaluate(()=>{[...document.querySelectorAll('#focusSeg button')].find(x=>x.dataset.fx==='on').click();});await wait(300);
 await q.evaluate(()=>{[...document.querySelectorAll('#locSeg button')].find(x=>x.dataset.loc==='home').click();});await wait(350);
 await q.evaluate(()=>{[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent==='Legs B').click();});await wait(300);
 const h=await q.evaluate(()=>{const t=document.body.innerText.toLowerCase().replace('no bar, bench, pull-up bar or cables','');return {tib:t.includes('seated tibialis raise'),furn:(t.match(/couch|chair|sofa|step\b|stairs|towel|tile|wall|table|bench/g)||[]).length};});
 T('focus: home mode has tibialis sub, zero furniture words',h.tib&&h.furn===0,JSON.stringify(h));
 await q.evaluate(()=>{[...document.querySelectorAll('#locSeg button')].find(x=>x.dataset.loc==='gym').click();});
 await q.evaluate(()=>switchView('guide'));await wait(300);T('guide: region map card',await q.evaluate(()=>document.body.innerText.includes('Legs & Back Focus — the region map')));
 T('S: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}

// ===== T. Radius selector + vault + fuel audit =====
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 await q.evaluate(()=>switchView('run'));await wait(300);
 const c30=await q.evaluate(()=>(document.body.innerText.match(/CONFIRMED/g)||[]).length);
 await q.evaluate(()=>{[...document.querySelectorAll('#radiusSeg button')].find(x=>x.dataset.r==='60').click();});await wait(400);
 const c60=await q.evaluate(()=>({n:(document.body.innerText.match(/CONFIRMED/g)||[]).length,jc:/~40 km from home · Willowmoore Park, Benoni/.test(document.body.innerText),persisted:JSON.parse(localStorage.getItem('cb2_radius'))}));
 await q.evaluate(()=>{[...document.querySelectorAll('#radiusSeg button')].find(x=>x.dataset.r==='15').click();});await wait(400);
 const c15=await q.evaluate(()=>(document.body.innerText.match(/CONFIRMED/g)||[]).length);
 T('radius: 60 km shows more than 30, 15 shows fewer; persists',c60.n>c30&&c60.jc&&c15<c30&&c60.persisted===60,JSON.stringify({c15,c30,c60}));
 await q.evaluate(()=>{[...document.querySelectorAll('#radiusSeg button')].find(x=>x.dataset.r==='30').click();});await wait(300);
 // vault: save data, wipe localStorage, boot → restored from IndexedDB
 await q.evaluate(()=>{DB.weight.push({date:todayISO(),v:88.9});DB.save();});await wait(500);
 await q.evaluate(()=>localStorage.clear());await q.reload({waitUntil:'networkidle0'});await wait(1500);
 const vault=await q.evaluate(()=>({w:DB.weight.length,has889:DB.weight.some(x=>+x.v===88.9),status:document.body.innerText.includes('device vault (IndexedDB)')}));
 T('vault: wiped localStorage restores from IndexedDB (88.9 survives)',vault.w>=1&&vault.has889&&vault.status,JSON.stringify(vault));
 await q.evaluate(()=>switchView('fuel'));await wait(300);
 const f=await q.evaluate(()=>{const h=document.getElementById('suppStack').innerHTML;return {collagen:h.includes('Collagen Peptides + Vitamin C'),bicarb:h.includes('Sodium Bicarbonate'),skip:document.body.innerText.includes('what NOT to buy')&&document.body.innerText.includes('HMB')};});
 T('fuel: bicarbonate replaced by collagen + C; skip-list present',f.collagen&&!f.bicarb&&f.skip,JSON.stringify(f));
 T('T: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}

// ===== U. Legs-first week + share backup =====
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 const w=await q.evaluate(()=>({order:GYM_ORDER.join(','),sat:weekTemplate().find(x=>x.day==='Sat').label,tue:weekTemplate().find(x=>x.day==='Tue').label,gap:(()=>{const d=['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];const legs=weekTemplate().filter(x=>/Legs/.test(x.label)).map(x=>d.indexOf(x.day));return Math.abs(legs[1]-legs[0]);})(),share:typeof shareBackup==='function',btn:document.body.innerText.includes('Save backup to iCloud Drive / Google Drive'),copy:document.body.innerText.includes('cannot link')}));
 T('week: legs-first order, Sat = Legs A, Tue = Legs B, 3 days apart',w.order==='legsA,pushA,pullA,legsB,pushB,pullB'&&w.sat==='Legs A'&&w.tue==='Legs B'&&w.gap===3,JSON.stringify(w));
 T('storage: share-to-Drive button + honest copy',w.share&&w.btn&&w.copy);
 T('U: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}
{const q=await page(b,'2026-09-11',()=>{localStorage.clear();});const c=await q.evaluate(()=>document.body.innerText.includes('Tomorrow opens with Legs A'));T('prestart: brief says Legs A tomorrow',c);await q.close();}

// ===== V. Minimal rest days =====
{const q=await page(b,'2026-09-18',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 const f=await q.evaluate(()=>({dow:DOW[new Date().getDay()],cta:document.querySelector('.cta')?.textContent||'',title:document.body.innerText.includes('Active Recovery — Minimal Rest by Design'),tmpl:weekTemplate().find(x=>x.day==='Fri').label}));
 T('rest: Friday = active recovery CTA + title + template',f.dow==='Fri'&&/Active recovery/.test(f.cta)&&f.title&&f.tmpl==='Active Recovery',JSON.stringify(f));
 await q.evaluate(()=>document.querySelector('.cta').click());await wait(400);
 T('rest: CTA opens Extras (active-recovery sub)',await q.evaluate(()=>curDay==='extras'&&document.body.innerText.includes('Active Recovery Pump')));
 await q.evaluate(()=>switchView('guide'));await wait(300);T('rest: doctrine in Guide',await q.evaluate(()=>document.body.innerText.includes('minimal by design, and why not zero')));
 T('V: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}
{const q=await page(b,'2026-10-23',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 const d=await q.evaluate(()=>({deload:isDeloadWeek(),dow:DOW[new Date().getDay()],title:document.body.innerText.includes('Rest Day — Deload Week'),cta:document.querySelector('.cta')?.textContent||''}));
 T('rest: deload-week Friday = full rest',d.deload&&d.dow==='Fri'&&d.title&&/Deload week rest day/.test(d.cta),JSON.stringify(d));await q.close();}
const dateAddN=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
// ===== W–AU. Upgrade + audit-fix checks (2026-09-26). Isolated contexts, Johannesburg time, real UI. =====
async function pg(b,iso,seed,opt){opt=opt||{};const ctx=await b.createBrowserContext();const p=await ctx.newPage();p.__ctx=ctx;await p.emulateTimezone('Africa/Johannesburg');await OFFLINE(p);
  p.__errs=[];p.__dialogs=[];p.on('pageerror',e=>p.__errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.__errs.push(m.text());});p.on('dialog',d=>{p.__dialogs.push(d.message());d.accept();});
  await p.evaluateOnNewDocument((iso,hh)=>{const R=Date;const fixed=new R(iso+'T'+hh+':00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;},iso,opt.time||'09:00');
  await p.evaluateOnNewDocument(STORAGE);
  await p.evaluateOnNewDocument(s=>{if(sessionStorage.getItem('__qs'))return;sessionStorage.setItem('__qs','1');localStorage.clear();localStorage.setItem('cb2_pure','true');if(s)for(const k in s)localStorage.setItem(k,JSON.stringify(s[k]));},seed||null);
  await p.setViewport({width:390,height:844,deviceScaleFactor:1});
  await p.goto('file://'+path.resolve('ComebackBlueprint.html')+(opt.hash||''),{waitUntil:'networkidle0'});await wait(900);return p;}
const done=async p=>{await p.__ctx.close();};
const SS=(d,day,ent,loc)=>({id:'q'+d+day+(loc||''),dateISO:d,day,loc:loc||'gym',entries:ent});
const sets=(n,r,w)=>Array.from({length:n},()=>({r:String(r),w:String(w)}));
// --- W. timezone: the user's phone is UTC+2
{const wkSeed={cb2_sessions:[SS('2026-09-26','legsA',{ga1:sets(1,8,80)}),SS('2026-09-27','pushA',{pa1:sets(1,8,60)}),SS('2026-09-28','pullA',{la1:sets(1,8,60)}),SS('2026-09-29','legsB',{gb1:sets(1,8,100)}),SS('2026-09-30','pushB',{pb1:sets(1,8,40)}),SS('2026-10-01','pullB',{lb1:sets(1,8,60)})]};
 const p=await pg(b,'2026-10-01',wkSeed,{time:'00:30'});const r=await p.evaluate(()=>({today:todayISO(),d0:dateAdd('2026-09-12',0),ws3:weekStartISO(3),end3:dateAdd(weekStartISO(3),6),dow:DOW[new Date().getDay()],lifts:sessionsThisWeek().lifts,home:document.body.innerText.includes('6/6')}));
 T('tz: 00:30 SAST on Thu 1 Oct — today is 2026-10-01, not yesterday',r.today==='2026-10-01'&&r.dow==='Thu',JSON.stringify(r));
 T('tz: dateAdd/weekStartISO keep calendar dates in UTC+2 (week 3 = 26 Sep–2 Oct)',r.d0==='2026-09-12'&&r.ws3==='2026-09-26'&&r.end3==='2026-10-02',JSON.stringify(r));
 T('tz: Sat–Thu sessions all count — Lifts this week 6/6',r.lifts===6&&r.home,JSON.stringify(r));T('tz: no errors',p.__errs.length===0,p.__errs.join('|'));await done(p);}
// --- X. the Lift tab opens today's session; a manual pick sticks for the day
for(const [iso,key] of [['2026-09-26','legsA'],['2026-09-27','pushA'],['2026-09-28','pullA'],['2026-09-29','legsB'],['2026-09-30','pushB'],['2026-10-01','pullB'],['2026-10-02','extras']]){
 const p=await pg(b,iso);await p.click('.tab[data-view="lift"]');await wait(300);const d=await p.evaluate(()=>({cur:curDay,pill:document.querySelector('#dayPills .pill.on')?.textContent}));
 T('lift tab on '+iso+' opens '+key,d.cur===key,JSON.stringify(d));
 if(iso==='2026-09-27'){await p.evaluate(()=>[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent==='Legs B').click());await wait(200);await p.click('.tab[data-view="home"]');await wait(200);await p.click('.tab[data-view="lift"]');await wait(300);T('lift: a manual day pick sticks for the rest of the day',await p.evaluate(()=>curDay==='legsB'));
  const vis=await p.evaluate(()=>{const w=document.getElementById('dayPills'),on=w.querySelector('.pill.on');const a=w.getBoundingClientRect(),o=on.getBoundingClientRect();return o.left>=a.left-1&&o.right<=a.right+1;});T('lift: the selected day pill is scrolled into view',vis);}
 await done(p);}
// --- Y. auto-progression, Use button, stall reset, gym/home separation, AMRAP safety
{const seed={cb2_sessions:[SS('2026-09-12','legsA',{ga1:sets(5,8,80)}),SS('2026-09-19','legsA',{ga1:[{r:'4',w:'100'}].concat(sets(4,8,85)),ga7:sets(3,15,60)}),SS('2026-09-24','pushB',{pb7:[{r:'14',w:''},{r:'12',w:''}]})]};
 const p=await pg(b,'2026-09-26',seed);await p.click('.tab[data-view="lift"]');await wait(400);
 const c=await p.evaluate(()=>({ga1:document.querySelector('[data-prog="ga1"]')?.innerText||'',ga7:document.querySelector('[data-prog="ga7"]')?.innerText||''}));
 T('prog: heavier top set ignored — working load 85 kg, all back-offs at 8 → add load to 87.5 kg with plates per side',/Add load: 87\.5 kg/.test(c.ga1)&&/per side 25 \+ 5 \+ 3?\.?7?5?|per side/.test(c.ga1),c.ga1);
 T('prog: machine calf raise at the top of 10–15 → +2.5 kg',/Add load: 62\.5 kg/.test(c.ga7),c.ga7);
 await p.evaluate(()=>document.querySelector('[data-prog="ga1"] .prog-use').click());await wait(300);
 T('prog: Use loads 87.5 kg into every empty kg cell',await p.evaluate(()=>[...document.querySelectorAll('#liftBody input[data-ex="ga1"][data-f="w"]')].every(i=>i.value==='87.5')));
 await p.evaluate(()=>{[...document.querySelectorAll('#locSeg button')].find(x=>x.dataset.loc==='home').click();});await wait(400);
 const h=await p.evaluate(()=>{const card=document.querySelector('input[data-ex="ga1"]').closest('.ex');return {last:/Last time/.test(card.innerText),first:/First home session/.test(card.innerText),ph:card.querySelector('input[data-f="w"]').placeholder};});
 T('home mode never shows gym history (no 85 kg "Last time", first-session prompt instead)',!h.last&&h.first&&h.ph!=='85',JSON.stringify(h));
 await p.evaluate(()=>{[...document.querySelectorAll('#locSeg button')].find(x=>x.dataset.loc==='gym').click();});await wait(300);
 await p.click('.tab[data-view="home"]');await wait(400);T('AMRAP bodyweight log does not break Home (coach pack renders)',await p.evaluate(()=>!!document.getElementById('coachPack')));
 T('Y: no errors',p.__errs.length===0,p.__errs.join('|'));await done(p);}
{const st=[['2026-09-05',82],['2026-09-12',82],['2026-09-16',82],['2026-09-19',82]].map(([d,w])=>SS(d,'legsA',{ga1:sets(4,6,w)}));
 st[0].entries.ga1=sets(4,7,82);const p=await pg(b,'2026-09-26',{cb2_sessions:st});await p.click('.tab[data-view="lift"]');await wait(400);
 T('prog: three sessions without a new best → ~10% reset suggestion',await p.evaluate(()=>/No new best in three sessions — drop to 72\.5 kg/.test(document.querySelector('[data-prog="ga1"]')?.innerText||'')),await p.evaluate(()=>document.querySelector('[data-prog="ga1"]')?.innerText));await done(p);}
// --- Z. Add set / Remove set
{const p=await pg(b,'2026-09-26');await p.click('.tab[data-view="lift"]');await wait(400);const rows=()=>p.evaluate(()=>document.querySelectorAll('#liftBody input[data-ex="ga2"][data-f="r"]').length);
 const r0=await rows();await p.click('[data-add="ga2"]');await wait(300);const r1=await rows();T('sets: Add set adds exactly one row',r1===r0+1,r0+'→'+r1);
 await p.evaluate(n=>{const r=document.querySelector(`#liftBody input[data-ex="ga2"][data-i="${n-1}"][data-f="r"]`),w=document.querySelector(`#liftBody input[data-ex="ga2"][data-i="${n-1}"][data-f="w"]`);r.value='9';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='70';w.dispatchEvent(new Event('input',{bubbles:true}));},r1);await wait(300);
 await p.click('[data-del="ga2"]');await wait(400);const r2=await rows();const e=await p.evaluate(()=>{const s=findLiftSession('legsA');return (s.entries.ga2||[]).filter(x=>x&&x.r).length;});
 T('sets: Remove on a logged set asks first, then drops the row and its data',p.__dialogs.some(m=>/Delete set/.test(m))&&r2===r0&&e===0,JSON.stringify({r2,e,d:p.__dialogs}));
 const n0=p.__dialogs.length;await p.click('[data-del="ga2"]');await wait(300);T('sets: Remove on an empty row needs no confirmation',p.__dialogs.length===n0&&(await rows())===r0-1);await done(p);}
// --- AA. bodyweight sets count; AB. Extras PR never crashes
{const p=await pg(b,'2026-09-26');await p.evaluate(()=>{[...document.querySelectorAll('.tab')].find(t=>t.dataset.view==='lift').click();});await wait(300);
 await p.evaluate(()=>{[...document.querySelectorAll('#locSeg button')].find(x=>x.dataset.loc==='home').click();});await wait(400);
 const id=await p.evaluate(()=>{const e=GYM.legsA.ex.find(x=>HOME_SUB[x.id]&&/bodyweight/.test(homeRx(x,HOME_SUB[x.id]).load));return e&&e.id;});
 await p.evaluate(id=>{const r=document.querySelector(`#liftBody input[data-ex="${id}"][data-i="0"][data-f="r"]`);r.value='15';r.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector(`#liftBody [data-chk="${id}"][data-i="0"]`).click();},id);await wait(400);
 const bw=await p.evaluate(()=>({timer:document.getElementById('restTimer').classList.contains('show'),lifts:sessionsThisWeek().lifts}));
 T('bodyweight: reps alone tick the set, start the timer and count the session',!!id&&bw.timer&&bw.lifts===1,JSON.stringify({id,...bw}));
 const t0=await p.evaluate(()=>document.getElementById('restTime').textContent);await wait(2300);const t1=await p.evaluate(()=>document.getElementById('restTime').textContent);
 T('rest timer counts down on the real clock',t0!==t1,t0+' → '+t1);
 T('home rest: the timer uses the home rest (60–90 s), not the gym 3 min',/^1:[0-3]\d$|^0:[5-9]\d$/.test(t0),t0);await done(p);}
{const p=await pg(b,'2026-10-02',{cb2_sessions:[SS('2026-09-25','extras',{x2:sets(2,15,8)})]});await p.click('.tab[data-view="lift"]');await wait(400);
 await p.evaluate(()=>{const r=document.querySelector('#liftBody input[data-ex="x2"][data-i="0"][data-f="r"]'),w=document.querySelector('#liftBody input[data-ex="x2"][data-i="0"][data-f="w"]');r.value='15';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='10';w.dispatchEvent(new Event('input',{bubbles:true}));w.dispatchEvent(new Event('change',{bubbles:true}));});await wait(500);
 T('extras: a PR on the Friday pump toasts the exercise name and throws nothing',p.__errs.length===0&&await p.evaluate(()=>/Lateral Raise/.test(document.getElementById('toast').textContent)),p.__errs.join('|'));
 T('extras: RIR 2 prescription on Friday',await p.evaluate(()=>/RIR <b>2<\/b>|RIR 2/.test(document.getElementById('liftBody').innerHTML)));await done(p);}
// --- AD. quick-log Edit; AE. measures merge into the day
{const p=await pg(b,'2026-09-26',{cb2_weight:[{date:'2026-09-26',v:88.4}]});
 await p.evaluate(()=>{[...document.querySelectorAll('#view-home button')].find(x=>x.textContent.trim()==='Edit').click();});await wait(300);
 T('quick log: Edit opens an input without a script error',await p.evaluate(()=>!!document.getElementById('qW'))&&p.__errs.length===0,p.__errs.join('|'));
 await p.evaluate(()=>{const i=document.getElementById('qW');i.value='88.9';[...document.querySelectorAll('#view-home button')].find(x=>x.textContent.trim()==='Save'&&x.previousElementSibling&&x.previousElementSibling.contains(i)).click();});await wait(300);
 T('quick log: Save after Edit replaces today\'s weight',await p.evaluate(()=>DB.weight.filter(x=>x.date==='2026-09-26').map(x=>+x.v).join()==='88.9'));
 await p.evaluate(()=>{const i=document.getElementById('qWa');i.value='86.5';quickLogWaist();});await wait(300);
 await p.click('.tab[data-view="track"]');await wait(300);await p.evaluate(()=>{document.querySelector('.track-tabs button[data-tp="measure"]').click();document.getElementById('meNeck').value='39';document.getElementById('meAdd').click();});await wait(300);
 const m=await p.evaluate(()=>({rec:DB.measure.find(x=>x.date==='2026-09-26'),bf:estimateBF()}));
 T('measures: a neck-only save keeps the waist logged from Home (tape estimate works)',m.rec&&+m.rec.waist===86.5&&+m.rec.neck===39&&m.bf&&m.bf.bf>5,JSON.stringify(m));await done(p);}
// --- AF. Weekly Review: cut-mode signs, last week's final verdict early in the week, extras never counted
{const ws=[];let v=90;for(let i=0;i<22;i+=2){ws.push({date:dateAddN('2026-09-12',i),v:Math.round(v*10)/10});v-=0.13;}
 const p=await pg(b,'2026-10-08',{cb2_weight:ws,cb2_bulk:'cut',cb2_sessions:[SS('2026-10-03','legsA',{ga1:sets(3,8,80)}),SS('2026-10-04','pushA',{pa1:sets(3,8,60)})]});
 const r=await p.evaluate(()=>{const x=weeklyReview();return {v:x.verdict,t:x.target,rate:x.rate};});
 T('review: an on-target loss in Cut mode is not told the surplus is too big',!/surplus is too big|Gaining only/.test(r.v)&&r.t<0,JSON.stringify(r));await done(p);}
{const p=await pg(b,'2026-09-26',{cb2_sessions:[SS('2026-09-19','legsA',{ga1:sets(3,8,80)}),SS('2026-09-20','pushA',{pa1:sets(3,8,60)}),SS('2026-09-25','extras',{x2:sets(3,15,8)})]});
 const r=await p.evaluate(()=>({title:(document.body.innerText.match(/Weekly Review — Week \d+[^\n]*/)||[''])[0],lifts:weeklyReview().lifts}));
 T('review: on Saturday with <2 new sessions it shows last week (final)',/Week 2 \(final\)/.test(r.title),r.title);T('review: the Friday pump is never one of the six sessions',r.lifts===2,JSON.stringify(r));await done(p);}
// --- AG. the retired run plan never drives Home again; AH. Friday copy follows the ledger
for(const [iso,title,brief] of [['2026-11-12','Pull B — Strength','Today: Pull B'],['2026-09-27','Push A — Strength','Today: Push A'],['2026-09-29','Legs B — Strength','Today: Legs B']]){
 const p=await pg(b,iso);const r=await p.evaluate(()=>({t:document.querySelector('.tb-title')?.textContent,body:document.body.innerText}));
 T('run plan retired: '+iso+' Today card = '+title+' and Brief = '+brief,r.t===title&&r.body.includes(brief)&&!/RACE DAY|Long Run —|Easy Run —|Shake-Out/.test(r.body),r.t);await done(p);}
{const p=await pg(b,'2026-10-02');const r=await p.evaluate(()=>({note:(document.body.innerText.match(/How the week works:[^\n]*/)||[''])[0],fri:[...document.querySelectorAll('.wd')].find(w=>w.querySelector('.wdn').textContent==='Fri')?.querySelector('.wdl').textContent,brief:(document.body.innerText.match(/Today: [^\n]*/)||[''])[0]}));
 T('friday: copy says active recovery, strip says Pump, Brief says Extras pump',/Friday active recovery/.test(r.note)&&r.fri==='Pump'&&/Extras pump/.test(r.brief),JSON.stringify(r));await done(p);}
{const p=await pg(b,'2026-10-23');const r=await p.evaluate(()=>({note:(document.body.innerText.match(/How the week works:[^\n]*/)||[''])[0],btn:[...document.querySelectorAll('#view-home button')].some(x=>/Extras Pump/.test(x.textContent))}));
 T('deload friday: full rest copy and no pump buttons',/Friday full rest \(deload week\)/.test(r.note)&&!r.btn,JSON.stringify(r));await done(p);}
{const p=await pg(b,'2027-03-02');const r=await p.evaluate(()=>({cta:document.querySelector('.cta')?.textContent,t:document.querySelector('.tb-title')?.textContent}));
 T('peak week: D-3 Legs day becomes an upper-body pump (CTA and Today card agree)',/Peak week/.test(r.cta)&&/legs rest/.test(r.t),JSON.stringify(r));await done(p);}
{const p=await pg(b,'2027-03-05');T('check day: CTA sends you to weigh in, tape and photograph',await p.evaluate(()=>/Check day/.test(document.querySelector('.cta')?.textContent||'')));await done(p);}
// --- AI. two realistic weeks, every tab and Track pane: no errors, no leaked template text, no NaN/undefined
{const probe=await pg(b,'2026-09-12');const prog=await probe.evaluate(()=>({order:GYM_ORDER,days:Object.fromEntries(GYM_ORDER.concat(['extras']).map(d=>[d,GYM[d].ex.map(e=>({id:e.id,cmp:!!e.cmp,reps:String(e.reps||''),n:fxSets(e)}))]))}));await done(probe);
 const sess=[],wts=[],mea=[],sl=[];for(let n=0;n<14;n++){const d=dateAddN('2026-09-12',n),idx=n%7,wk=Math.floor(n/7);const day=idx<6?prog.order[idx]:'extras';
  const entries={};prog.days[day].forEach((e,i)=>{const top=parseInt((e.reps.match(/(\d+)\s*[-–]\s*(\d+)/)||[])[2]||e.reps)||10;entries[e.id]=Array.from({length:e.n},(_,k)=>({r:String(Math.max(3,top-k)),w:/AMRAP/.test(e.reps)?'':String((e.cmp?(i===0?80:50):14)+2.5*wk),rpe:String(k===e.n-1?10:8.5)}));});
  sess.push(SS(d,day,entries));if([0,2,4].includes(idx))wts.push({date:d,v:Math.round((88+0.06*n)*10)/10});if(idx===0)mea.push({date:d,waist:86+0.2*wk,neck:39,arm:37});sl.push({date:d,h:6.8+0.1*(n%3)});}
 const p=await pg(b,'2026-09-26',{cb2_sessions:sess,cb2_weight:wts,cb2_measure:mea,cb2_sleep:sl});const bad=[];
 for(const v of ['home','lift','run','roadmap','fuel','numbers','track','guide']){await p.evaluate(n=>switchView(n),v);await wait(250);const t=await p.evaluate(n=>document.getElementById('view-'+n).innerText,v);const m=t.match(/\$\{|NaN|undefined|\[object|Infinity/);if(m)bad.push(v+':'+m[0]);
  const ow=await p.evaluate(()=>document.documentElement.scrollWidth);if(ow>391)bad.push(v+': page scrolls sideways '+ow);}
 for(const tp of ['weight','lifts','volume','measure']){await p.evaluate(t=>document.querySelector('.track-tabs button[data-tp="'+t+'"]').click(),tp);await wait(200);const t=await p.evaluate(t=>document.getElementById('tp-'+t).innerText,tp);const m=t.match(/\$\{|NaN|undefined|\[object/);if(m)bad.push('track-'+tp+':'+m[0]);}
 T('realistic data: all 8 tabs and 4 Track panes render with no leaked template text, NaN or undefined, and no sideways scroll',bad.length===0,bad.join(' | '));
 T('realistic data: zero page errors across the walk',p.__errs.length===0,p.__errs.join('|').slice(0,300));
 // Track panes with that data
 await p.evaluate(()=>{switchView('track');document.querySelector('.track-tabs button[data-tp="lifts"]').click();});await wait(300);
 const tr=await p.evaluate(()=>({opts:document.querySelectorAll('#exSel option').length,svg:!!document.querySelector('#exChart svg'),board:document.querySelectorAll('#prBoard .log-row').length,vol:document.querySelectorAll('#volBody .vol-row').length}));
 T('track lifts: every logged exercise is selectable and charted from the Lift log',tr.opts>=30&&tr.svg,JSON.stringify(tr));T('track lifts: PR board lists the last four weeks of new bests',tr.board>=1,JSON.stringify(tr));T('track volume: seven legs-and-back regions',tr.vol===7,JSON.stringify(tr));
 const cp=await p.evaluate(()=>({t:coachText(),a:askClaudeText('my squat stalled')}));
 T('coach pack: summary carries sessions, lifts and the app verdict',/Sessions: /.test(cp.t)&&/Lifts this week/.test(cp.t)&&/App verdict:/.test(cp.t),cp.t.slice(0,200));
 T('ask Claude: the question and the plan\'s rules travel with the numbers',/My question: my squat stalled/.test(cp.a)&&/natural and legal only/.test(cp.a)&&/18–24%/.test(cp.a));
 await done(p);}
// --- AJ. lean mass is anchored to measurement, not scale × typed %; AK. weight trend is a least-squares slope
{const p=await pg(b,'2027-03-05',{cb2_weight:[{date:'2026-09-12',v:88},{date:'2027-03-05',v:98.7}]});const r=await p.evaluate(()=>{const c=compute();return {ffmi:+c.ffmiNorm.toFixed(2),toGo:+(c.ceilLean-c.leanNow).toFixed(2),src:leanEstimate().src};});
 T('lean model: 98.7 kg on the scale no longer "reaches" FFMI 26 — gain is credited at the model rate',r.ffmi<25&&r.toGo>0.5&&r.src==='Day-1 weigh-in',JSON.stringify(r));await done(p);}
{const w=[['2026-09-15',87.9],['2026-09-17',88.3],['2026-09-19',88.4],['2026-09-22',88.6],['2026-09-24',88.4],['2026-09-26',88.9]].map(([date,v])=>({date,v}));
 const p=await pg(b,'2026-09-26',{cb2_weight:w});const r=await p.evaluate(()=>actualGainRate());
 const xs=w.map(x=>(new Date(x.date)-new Date(w[0].date))/864e5),ys=w.map(x=>x.v),mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;let sxy=0,sxx=0;xs.forEach((x,i)=>{sxy+=(x-mx)*(ys[i]-my);sxx+=(x-mx)**2;});const exp=sxy/sxx*7;
 T('gain rate: least-squares trend over 28 days (not first-vs-last weigh-in)',r&&r.method==='trend'&&Math.abs(r.kgWk-exp)<0.01,JSON.stringify({r,exp}));
 const r3=await p.evaluate(()=>{DB.weight=DB.weight.slice(-3);return actualGainRate();});T('gain rate: fewer than 4 weigh-ins → no calorie instruction yet',r3===null);await done(p);}
// --- AL. DEXA, full backup, legacy restore
{const p=await pg(b,'2026-09-26',{cb2_weight:[{date:'2026-09-26',v:88.9}],cb2_sessions:[SS('2026-09-19','legsA',{ga1:sets(3,8,80)})]});await p.click('.tab[data-view="track"]');await wait(300);
 await p.evaluate(()=>{document.querySelector('.track-tabs button[data-tp="measure"]').click();document.getElementById('dxBf').value='19.5';document.getElementById('dxLean').value='69.8';document.getElementById('dxAdd').click();});await wait(300);
 T('dexa: a saved scan shows as the latest reading',await p.evaluate(()=>/19\.5% body fat/.test(document.getElementById('dexaLatest')?.innerText||'')));
 await p.evaluate(()=>document.getElementById('dxUse').click());await wait(300);const dx=await p.evaluate(()=>({bf:DB.profile.bf,src:leanEstimate().src}));
 T('dexa: Use writes the % to the engine and the scan anchors lean mass',+dx.bf===19.5&&dx.src==='DEXA',JSON.stringify(dx));
 await p.evaluate(()=>document.getElementById('exportBtn').click());await wait(400);T('backup: Track "Download full backup" is the complete format and resets the age indicator',await p.evaluate(()=>!!localStorage.getItem('cb2_lastbackup')&&JSON.parse(backupJSON()).cb2_dexa.length===1));
 const tmp=path.join(require('os').tmpdir(),'cb-legacy-'+process.pid+'.json');fs.writeFileSync(tmp,JSON.stringify({app:'ComebackBlueprint',version:2,profile:{weight:90,height:177,age:38,bf:18,goal:102.3,goalBf:24,act:1.55},sessions:[SS('2026-09-20','pushA',{pa1:sets(3,8,60)})],weight:[{date:'2026-09-20',v:90}],measure:[],lifts:[]}));
 const fi=await p.$('#importFile');await fi.uploadFile(tmp);
 // waitForNavigation can be satisfied by the export download above, so poll for the restored state across the reload,
 // then re-read after the vault (600 ms) and cloud boots to prove nothing old is written back
 const rd=()=>p.evaluate(()=>({s:DB.sessions.length,w:DB.weight.map(x=>x.v).join()})).catch(()=>null);let lr=null;const until=Date.now()+15000;
 while(Date.now()<until){lr=await rd();if(lr&&lr.w==='90')break;await wait(300);}await wait(1500);lr=await rd()||lr;T('backup: an old Track-format file restores (converted) instead of wiping the log',p.__dialogs.some(m=>/Restore this backup/.test(m))&&lr.s===1&&lr.w==='90',JSON.stringify(lr));fs.unlinkSync(tmp);await done(p);}
// --- AN. Events · AO. Numbers · AP. Roadmap · AQ. Fuel · AR. Guide
{const p=await pg(b,'2026-09-26');await p.evaluate(()=>switchView('run'));await wait(300);const t=await p.evaluate(()=>document.getElementById('view-run').innerText);
 T('events: past September events are hidden and counted',!/Fri 18 Sep 2026|Sat 19 Sep 2026|Sun 20 Sep 2026|Sun 6 Sep 2026/.test(t)&&/earlier this month — already happened/.test(t),t.slice(0,300));
 T('events: radius copy follows the selector; no hand-typed "inside 10 km"',!/within ~25 km|inside 10 km/.test(t)&&/within 30 km of home/.test(t));
 T('events: unverified events are labelled, banner counts from the data',/UNVERIFIED/.test(t)&&/Those \d+ are the muscle-relevant anchors|That one is the muscle-relevant anchor/.test(t));
 T('events: stored guessed distances and relative words are gone',await p.evaluate(()=>!RACES_12M.some(r=>/^~\d+\s*km/.test(r.km||'')||/Tomorrow|days out|twelve minutes/.test(r.note||''))));
 await p.evaluate(()=>switchView('numbers'));await wait(300);const n=await p.evaluate(()=>({t:document.getElementById('view-numbers').innerText,g10:!!document.getElementById('pGoal10k'),ph:!!document.getElementById('phaseSeg'),pro:document.getElementById('rProN')?.textContent,lean:!!document.getElementById('leanSource')}));
 T('numbers: race predictor, goal 10K and race phases are retired',!/Race Time Predictor/.test(n.t)&&!n.g10&&!n.ph,JSON.stringify({g10:n.g10,ph:n.ph}));T('numbers: protein tile shows the engine factor and lean mass shows its source',n.pro==='2.2 g/kg'&&n.lean,JSON.stringify(n.pro));
 await p.evaluate(()=>switchView('roadmap'));await wait(300);const rm=await p.evaluate(()=>document.getElementById('view-roadmap').innerText);
 T('roadmap: Start is Day 1 (12 Sep 26); no "second race"; no repeated "Week 9 —"',/12 Sep 26/.test(rm)&&!/second race|Week 9 — first bulk/.test(rm)&&!/29 Jun 26/.test(rm));
 await p.evaluate(()=>switchView('fuel'));await wait(300);const fu=await p.evaluate(()=>document.getElementById('view-fuel').innerText);
 T('fuel: no bicarbonate, race-day or run fuel; collagen at 04:30, magnesium at 20:00',!/Bicarbonate|race day|for your runs|long-run days/i.test(fu)&&/Collagen \+ vitamin C/.test(fu)&&/Magnesium glycinate/.test(fu));
 await p.evaluate(()=>switchView('guide'));await wait(300);const gu=await p.evaluate(()=>({t:document.getElementById('view-guide').innerText,arch:!!document.getElementById('runArchive')&&!document.getElementById('runArchive').open,ic:[...document.querySelectorAll('#view-guide .card-t .ic svg')].every(s=>s.getBoundingClientRect().width>=18)}));
 T('guide: running-era cards live in a collapsed archive; footer is pure muscle',gu.arch&&!/Strength \+ Speed|Built for 24 September/.test(gu.t)&&/Pure Muscle · FFMI 25/.test(gu.t),JSON.stringify({arch:gu.arch}));
 T('guide: decision rules come from the engine (1.6× target, cut-mode flip)',/1\.6× target/.test(gu.t)&&/In Cut mode the rate rules flip/.test(gu.t));T('guide: card-header icons render at 20 px (were 0×0)',gu.ic);
 T('AN–AR: no errors',p.__errs.length===0,p.__errs.join('|'));await done(p);}
{const p=await pg(b,'2026-10-10');await p.evaluate(()=>switchView('fuel'));await wait(300);T('fuel: beta-alanine steps down to 3.2 g/day after week 4 (1.6 g per window)',await p.evaluate(()=>document.getElementById('view-fuel').innerText.includes('1.6 g (½ of today’s 3.2 g)')));await done(p);}
// --- AS. accessibility essentials · AT/AU. file:// mode stays server-free; deep and import links work there too
{const p=await pg(b,'2026-09-26');const a=await p.evaluate(()=>{switchView('lift');const tabs=[...document.querySelectorAll('nav .tab')];const strip=document.querySelector('.track-tabs');return {sel:tabs.filter(t=>t.getAttribute('aria-selected')==='true').map(t=>t.dataset.view),lbl:(()=>{switchView('numbers');return !!document.querySelector('label[for="pWeight"]');})(),toast:document.getElementById('toast').getAttribute('role'),t3:getComputedStyle(document.documentElement).getPropertyValue('--text-3').trim(),bad:getComputedStyle(document.documentElement).getPropertyValue('--bad').trim()};});
 T('a11y: the active tab reports aria-selected',a.sel.join()==='lift',a.sel.join());T('a11y: form labels are linked (label for=pWeight)',a.lbl);T('a11y: toasts are announced (role=status)',a.toast==='status');
 T('a11y: tertiary text colour meets WCAG AA (#8A96B0) and the red token exists',a.t3.toUpperCase()==='#8A96B0'&&a.bad!=='',JSON.stringify(a));
 await p.evaluate(()=>switchView('track'));await wait(200);T('a11y: all four Track tabs sit inside the strip at 390 px',await p.evaluate(()=>{const s=document.querySelector('.track-tabs').getBoundingClientRect();return [...document.querySelectorAll('.track-tabs button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=s.left-1&&r.right<=s.right+1;});}));
 T('file mode: no manifest link and no service worker (the file still opens with no server)',await p.evaluate(()=>!document.querySelector('link[rel="manifest"]')&&!(navigator.serviceWorker&&navigator.serviceWorker.controller)));await done(p);}
{const p=await pg(b,'2026-09-26',null,{hash:'#track'});T('deep link: #track opens Track from a file too',await p.evaluate(()=>document.getElementById('view-track').offsetParent!==null));await done(p);}
{const p=await pg(b,'2026-09-26',null,{hash:'#import='+encodeURIComponent('2026-09-25,weight,88.6|2026-09-25,sleep,7.4')});const r=await p.evaluate(()=>({w:DB.weight.map(x=>+x.v),s:DB.sleep.map(x=>+x.h),h:location.hash}));
 T('import link: "|"-separated Shortcut text lands weight + sleep and clears the link',r.w.includes(88.6)&&r.s.includes(7.4)&&!/import/.test(r.h),JSON.stringify(r));await done(p);}

// --- AV. research integration (26 Sep 2026): e1RM rep cap, gym/home split, stall window, back-off, big steps,
//         calendar file, voice cue, phone panel, sourced events, lifting references
{const seed={cb2_sessions:[SS('2026-09-13','legsA',{ga1:sets(3,20,15)},'home'),SS('2026-09-19','legsA',{ga1:sets(3,18,15)},'home'),SS('2026-09-20','legsA',{ga1:sets(3,8,100)}),SS('2026-09-26','legsA',{ga1:sets(3,22,15)},'home')]};
 const p=await pg(b,'2026-09-26',seed);
 const f=await p.evaluate(()=>({one:e1rm(100,1),ten:Math.round(e1rm(100,10)*10)/10,pr:prEvents().map(x=>x.key+'|'+x.date+'|'+x.top.r)}));
 T('e1RM: a true single is its own max; 10 reps still Epley',f.one===100&&f.ten===133.3,JSON.stringify(f));
 T('PRs: a gym session never counts as a PR over home sets (only the home 22-rep best is a PR)',f.pr.length===1&&f.pr[0]==='ga1@home|2026-09-26|22',JSON.stringify(f.pr));
 await p.click('.tab[data-view="track"]');await wait(300);await p.evaluate(()=>document.querySelector('.track-tabs button[data-tp="lifts"]').click());await wait(300);
 const t=await p.evaluate(()=>({opts:[...document.querySelectorAll('#exSel option')].map(o=>o.value+'|'+o.textContent),lbl:document.querySelector('.ex-stats span').textContent,note:document.getElementById('e1rmNote').innerText,board:document.getElementById('prBoard')?.innerText||''}));
 T('Track: home and gym squat are separate lines in the picker',t.opts.length===2&&t.opts.some(o=>/^ga1@home\|.*\(home\)/.test(o))&&t.opts.some(o=>/^ga1@gym\|Barbell Back Squat/.test(o)),JSON.stringify(t.opts));
 T('Track: a best from a >10-rep set is labelled an index, with the source named',t.lbl==='Best index'&&/Reynolds, Gordon & Robergs, 2006/.test(t.note)&&/Home sets chart apart/.test(t.note),JSON.stringify(t));
 T('Track: PR board names the home movement and marks the index',/\(home\)/.test(t.board)&&/· index/.test(t.board),t.board);
 await p.evaluate(()=>{const s=document.getElementById('exSel');s.value='ga1@gym';s.dispatchEvent(new Event('change'));});await wait(250);
 const g=await p.evaluate(()=>({lbl:document.querySelector('.ex-stats span').textContent,best:document.querySelector('.ex-stats b').textContent,stored:JSON.parse(localStorage.getItem('cb2_curex'))}));
 T('Track: switching to the gym line shows a true e1RM (127 kg) and remembers the pick',g.lbl==='Best e1RM'&&g.best==='127 kg'&&g.stored==='ga1@gym',JSON.stringify(g));
 const ct=await p.evaluate(()=>coachText());T('coach pack: home lifts are named as home movements and >10-rep bests flagged as an index',/\(home\): \d+×15 kg · e1RM \d+ kg \(index\)/.test(ct),ct.split('\n').filter(l=>/^- /.test(l)).join(' / '));
 T('AV-1: no errors',p.__errs.length===0,p.__errs.join('|'));await done(p);}
{const p=await pg(b,'2026-10-31');const r=await p.evaluate(()=>{const H=(d,r,w,rpe)=>({date:d,sets:[0,1,2].map(()=>({r,w,rpe:rpe==null?null:rpe}))});
  return {flat:isStalled([H('2026-09-14',8,100),H('2026-09-21',8,100),H('2026-09-28',8,100),H('2026-10-05',8,100)]),
   easy:isStalled([H('2026-09-14',8,100),H('2026-09-21',8,100,7),H('2026-09-28',8,100,7),H('2026-10-05',8,100,6.5)]),
   repPR:isStalled([H('2026-09-14',8,100),H('2026-09-21',8,100),H('2026-09-28',12,90),H('2026-10-05',8,100)]),
   deload:isStalled([H('2026-09-14',8,100),H('2026-09-21',8,100),H('2026-10-19',8,100),H('2026-10-26',8,100)]),dl6:deloadWks().has(6)&&wkOfISO('2026-10-19')===6};});
 T('stall: four flat exposures → stalled',r.flat===true,JSON.stringify(r));T('stall: easy sets (RPE ≤ 7) are under-effort, not a stall',r.easy===false,JSON.stringify(r));
 T('stall: a rep PR at a lighter load counts as progress',r.repPR===false,JSON.stringify(r));T('stall: deload-week sessions never count toward the window',r.deload===false&&r.dl6===true,JSON.stringify(r));await done(p);}
{const W=d=>SS(d,'pullA',{la1:sets(3,8,100)});const p=await pg(b,'2026-10-10',{cb2_sessions:[W('2026-09-14'),W('2026-09-21'),W('2026-09-28'),W('2026-10-05')]});
 const r=await p.evaluate(()=>{const w=weeklyReview();return {st:w.stalls,k:w.stallKeys,lbl:document.getElementById('view-home').innerText.includes('all-time bests / 3-session stalls')};});
 T('Weekly Review: stalls come from the three-session window, keyed by place',r.st===1&&r.k[0]==='la1@gym'&&r.lbl,JSON.stringify(r));
 await p.click('.tab[data-view="track"]');await wait(300);await p.evaluate(()=>document.querySelector('.track-tabs button[data-tp="lifts"]').click());await wait(300);
 T('Track: stall watch names the lift and the rule',await p.evaluate(()=>/Barbell Row.*no new best and no rep PR in three sessions \(deload weeks don’t count\)/.test(document.getElementById('stallWatch')?.innerText||'')));await done(p);}
{const p=await pg(b,'2026-09-26',{cb2_sessions:[SS('2026-09-19','legsA',{ga1:[{r:'3',w:'100'},{r:'3',w:'100'},{r:'2',w:'100'}]})]});await p.click('.tab[data-view="lift"]');await wait(400);
 const c=await p.evaluate(()=>document.querySelector('[data-prog="ga1"]')?.innerText||'');
 T('prog: first set 2 reps under the range → back off ~8% to 92.5 kg (rounded to the bar step, capped at 10%)',/Back off to 92\.5 kg — the first set came up 2 reps short of 5/.test(c)&&/about 4% per missed rep/.test(c),c);
 await p.evaluate(()=>document.querySelector('[data-prog="ga1"] .prog-use').click());await wait(300);
 T('prog: Use loads the back-off weight',await p.evaluate(()=>[...document.querySelectorAll('#liftBody input[data-ex="ga1"][data-f="w"]')].every(i=>i.value==='92.5')));await done(p);}
{const p=await pg(b,'2026-09-27',{cb2_sessions:[SS('2026-09-20','pushA',{pa6:sets(4,20,8)})]});await p.click('.tab[data-view="lift"]');await wait(400);
 const c=await p.evaluate(()=>document.querySelector('[data-prog="pa6"]')?.innerText||'');
 T('prog: a dumbbell step over 10% says so (8 → 10 kg is +25%, expect 12 reps first)',/Add load: 10 kg/.test(c)&&/\+25% is a big step, so expect 12 reps at first/.test(c),c);await done(p);}
{const p=await pg(b,'2026-09-26');const r=await p.evaluate(()=>{const w=buildRoadmap(),m=n=>w.find(x=>x.wk===n).milestone||'';return {w10:m(10),w26:m(26),w78:m(78)};});
 T('roadmap: week 10 shows the phase change AND the re-test',/New phase begins/.test(r.w10)&&/Re-test/.test(r.w10),r.w10);
 T('roadmap: week 26 carries the check weekend, the re-test and the 6-monthly bloodwork',/Soft milestone/.test(r.w26)&&/Re-test/.test(r.w26)&&/bloodwork/.test(r.w26),r.w26);
 T('roadmap: week 78 bloodwork is no longer hidden behind the re-test',/Re-test/.test(r.w78)&&/bloodwork/.test(r.w78),r.w78);
 const c=await p.evaluate(()=>{const t=icsText(),L=t.split('\r\n'),enc=new TextEncoder(),un=t.replace(/\r\n /g,''),U=L.filter(l=>/^UID:/.test(l)),dl=buildRoadmap().filter(w=>w.deload&&w.start>=weekStartISO(roadmapWeekNow())).length;
  return {start:t.startsWith('BEGIN:VCALENDAR\r\n'),end:t.endsWith('END:VCALENDAR\r\n'),bareLF:/[^\r]\n/.test(t),long:L.filter(l=>enc.encode(l).length>75).length,ev:(t.match(/BEGIN:VEVENT/g)||[]).length,evEnd:(t.match(/END:VEVENT/g)||[]).length,alarms:(t.match(/BEGIN:VALARM/g)||[]).length,uids:U.length,uniq:new Set(U).size,
   am:un.includes('DTSTART;TZID=Africa/Johannesburg:20260926T043000'),pm:un.includes('DTSTART;TZID=Africa/Johannesburg:20260926T200000'),rr:(un.match(/RRULE:FREQ=DAILY;UNTIL=2028\d{4}T000000Z/g)||[]).length,
   check:un.includes('DTSTART;VALUE=DATE:20270305')&&un.includes('DTEND;VALUE=DATE:20270308'),peak:un.includes('DTSTART;VALUE=DATE:20270226'),dlEv:(un.match(/SUMMARY:Deload week starts/g)||[]).length,dl,tz:un.includes('TZID:Africa/Johannesburg')&&un.includes('TZOFFSETTO:+0200')};});
 T('calendar file: valid frame, CRLF only, every line ≤ 75 octets',c.start&&c.end&&!c.bareLF&&c.long===0,JSON.stringify(c));
 T('calendar file: every event closed, alerted and uniquely identified',c.ev>20&&c.ev===c.evEnd&&c.alarms===c.ev&&c.uids===c.ev&&c.uniq===c.ev,JSON.stringify(c));
 T('calendar file: 04:30 and 20:00 supplement windows repeat daily in SAST',c.am&&c.pm&&c.rr===2&&c.tz,JSON.stringify(c));
 T('calendar file: check weekend 5–7 Mar, peak week and every future deload come from the roadmap',c.check&&c.peak&&c.dlEv===c.dl&&c.dl>=10,JSON.stringify(c));
 await p.click('.tab[data-view="roadmap"]');await wait(300);
 await p.evaluate(()=>{window.__dl=[];URL.createObjectURL=x=>{window.__blob=x;return 'blob:stub';};HTMLAnchorElement.prototype.click=function(){window.__dl.push(this.download);};document.getElementById('icsBtn').click();});await wait(300);
 const d=await p.evaluate(async()=>({dl:window.__dl,type:window.__blob&&window.__blob.type,has:window.__blob?(await window.__blob.text()).includes('BEGIN:VEVENT'):false,toast:document.getElementById('toast').innerText,card:/\d+ events/.test(document.getElementById('icsCard').innerText)}));
 T('calendar file: the Roadmap button downloads ComebackBlueprint-plan.ics as text/calendar',d.dl[0]==='ComebackBlueprint-plan.ics'&&/^text\/calendar/.test(d.type||'')&&d.has&&/Calendar file saved/.test(d.toast)&&d.card,JSON.stringify(d));
 T('AV-2: no errors',p.__errs.length===0,p.__errs.join('|'));await done(p);}
{const p=await pg(b,'2026-09-26');
 await p.evaluate(()=>{window.__said=[];Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){window.__said.push(u.text);},cancel(){}}});});
 await p.click('.tab[data-view="lift"]');await wait(400);await p.evaluate(()=>document.getElementById('voiceBtn').click());await wait(200);
 const v1=await p.evaluate(()=>({said:window.__said.slice(),on:document.getElementById('voiceBtn').getAttribute('aria-pressed'),stored:localStorage.getItem('cb2_voice'),ow:document.documentElement.scrollWidth}));
 T('voice cue: the toggle speaks, presses and persists; the three-button row fits 390 px',v1.said.includes('Voice cue on')&&v1.on==='true'&&v1.stored==='true'&&v1.ow<=391,JSON.stringify(v1));
 await p.evaluate(()=>{const set=(f,v)=>{const i=document.querySelector('#liftBody input[data-ex="ga1"][data-f="'+f+'"]');i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));};set('r','8');set('w','80');});await wait(150);
 await p.evaluate(()=>document.querySelector('#liftBody .chk[data-chk="ga1"][data-i="0"]').click());await wait(200);
 await p.evaluate(()=>{_restEnd=nowMs()-1000;restTick();});await wait(100);
 const v2=await p.evaluate(()=>window.__said.slice());
 T('voice cue: ticking a set calls the rest inside the tap, and the timer says go at the end',v2.includes('Rest 3 minutes')&&v2.includes('Rest over. Next set.'),JSON.stringify(v2));
 await p.click('.tab[data-view="home"]');await wait(500);
 const pc=await p.evaluate(()=>({t:document.getElementById('phoneCaps')?.innerText||'',inst:!!document.getElementById('installNote')}));
 T('phone panel: measured live — file copy mode, storage, wake, share and voice rows; no install nag outside Safari',/This phone, checked live/i.test(pc.t)&&/offline file copy/.test(pc.t)&&/Storage/.test(pc.t)&&/Voice rest cue/.test(pc.t)&&!pc.inst,pc.t);
 await p.click('.tab[data-view="run"]');await wait(300);
 const e=await p.evaluate(()=>({all:RACES_12M.every(r=>r.src),hope:RACES_12M.find(r=>r.name==='Hope In Motion').d,hy:RACES_12M.find(r=>r.name==='Virgin Active HYROX Johannesburg').d,jc:RACES_12M.find(r=>r.name==='Johnson Crane Hire Marathon').st,src:document.getElementById('view-run').innerHTML.includes('Source: Entry Ninja event page, checked 26 Sep 2026'),conf:(document.getElementById('view-run').innerText.match(/CONFIRMED/g)||[]).length}));
 T('events: every entry names its source; the moved, re-dated and downgraded entries carry the 26 Sep check',e.all&&e.hope==='Sun 18 Oct 2026'&&/^Thu–Sun 26–29 Nov 2026/.test(e.hy)&&e.jc==='expected'&&e.src,JSON.stringify(e));
 T('events: at least 30 confirmed events within 30 km from here on',e.conf>=30,e.conf);
 await p.click('.tab[data-view="guide"]');await wait(300);
 T('guide: the lifting-model references are listed and marked as heuristics where no study exists',await p.evaluate(()=>{const t=document.getElementById('liftRefs')?.innerText||'';return /Reynolds, Gordon & Robergs \(2006\)/.test(t)&&/Grgic, Lazinica & Schoenfeld \(2020\)/.test(t)&&/coaching heuristics/.test(t);}));
 T('AV-3: no errors',p.__errs.length===0,p.__errs.join('|'));await done(p);}

{const W=d=>SS(d,'pullA',{la1:sets(3,8,100)});const p=await pg(b,'2026-10-10',{cb2_sessions:[W('2026-09-14'),W('2026-09-21'),W('2026-09-28'),W('2026-10-05')]});
 await p.click('.tab[data-view="track"]');await wait(300);await p.evaluate(()=>{document.querySelector('.track-tabs button[data-tp="lifts"]').click();const s=document.getElementById('exSel');s.value='la1@gym';s.dispatchEvent(new Event('change'));});await wait(300);
 const r=await p.evaluate(()=>({d:fmtShort('2026-09-14'),dm:fmtDM('2026-10-04'),ticks:[...document.querySelectorAll('#exChart svg text[text-anchor="end"]')].map(t=>t.textContent),x:[...document.querySelectorAll('#exChart svg text[text-anchor="middle"]')].map(t=>t.textContent)}));
 T('dates: compact dates are day-first with the month by name on any locale (14 Sep, never 09/14)',r.d==='14 Sep'&&r.dm==='4 Oct'&&r.x.every(x=>/^\d{1,2} [A-Z][a-z]{2}$/.test(x)),JSON.stringify(r));
 T('charts: a flat e1RM line gets five distinct y-axis labels',r.ticks.length===5&&new Set(r.ticks).size===5,JSON.stringify(r.ticks));await done(p);}
await b.close();
const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+(x.detail||'')).join('\n')||'ALL PASS');console.log('RESULT:',pass+'/'+R.length);fs.writeFileSync('qa_report.json',JSON.stringify(R,null,1));})();

const puppeteer=require('puppeteer');const path=require('path');const fs=require('fs');
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
const STORAGE=()=>{const store={};window.__cs=store;window.storage={async get(k){if(!(k in store))throw new Error('nf');return{key:k,value:store[k]};},async set(k,v){store[k]=String(v);return{key:k,value:v};},async delete(k){delete store[k];return{key:k}},async list(){return{keys:Object.keys(store)}}};};
const R=[];const T=(name,ok,detail)=>{R.push({name,ok:!!ok,detail});};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const OFFLINE=async p=>{await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:'))r.continue();else r.respond({status:200,contentType:'text/css',body:''});});};
async function page(b,iso,extra){const p=await b.newPage();await OFFLINE(p);p.__errs=[];p.on('pageerror',e=>p.__errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.__errs.push(m.text());});
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
T('events: 12-month calendar',ev.months===12);T('events: ≥20 confirmed within 30 km of home',ev.confirmed>=20,ev.confirmed);T('events: home-distance filter (Lanseria in, Benoni out, Deadly Dozen ~15 km)',await p.evaluate(()=>{const t=document.body.innerText;const km=n=>evKm(RACES_12M.find(r=>r.name===n));return t.includes('within 30 km of home')&&km('Blair Atholl MTB')<=30&&km('Johnson Crane Hire Marathon')>30&&/Deadly Dozen Fitness Race — Johannesburg[\s\S]{0,700}~1[3-7] km from home/.test(t)&&t.includes('Just outside 30 km')&&t.includes('Johnson Crane Hire Marathon (Benoni');}));T('events: HYROX listed',ev.hyrox);T('events: race plan hidden',ev.parkedHidden);
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
 await q.evaluate(()=>switchView('fuel'));await wait(300);T('fuel: creatine loading protocol',await q.evaluate(()=>document.getElementById('suppStack').innerHTML.includes('load 20 g/day')));
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
 const f=await q.evaluate(()=>{const h=document.getElementById('suppStack').innerHTML;const t=document.body.innerText;return {hi:(h.match(/Highest recommended dose/g)||[]).length,creatine:h.includes('0.1 g/kg'),caff:h.includes('440\u2013530 mg')||h.includes('440–530 mg'),iron:h.includes('0 until ferritin'),ba:t.includes('3.2 g (½ of 6.4 g loading)'),citr:t.includes('8–10 g · conditional')};});
 T('dose: highest-dose block on all 12 items',f.hi===12,f.hi);T('dose: creatine 0.1 g/kg + caffeine 440–530 + iron none',f.creatine&&f.caff&&f.iron,JSON.stringify(f));T('dose: timing card BA 3.2 g halves + citrulline 8–10 g',f.ba&&f.citr);
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
 T('bf: apply button present when estimate differs',before.btn);T('bf: applying updates profile, lean mass and header chip',+after.bf===e.bf&&after.lean>before.lean&&after.chip!==before.chip&&after.sync,JSON.stringify({before,after}));
 T('R: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}

// ===== S. Legs & Back focus =====
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 const r=await q.evaluate(()=>{const rs=regionSets();return {on:focusLB,rs,newIds:['gb9','la9','lb9'].every(i=>GYM_ORDER.some(k=>GYM[k].ex.some(e=>e.id===i))),subs:['gb9','la9','lb9'].every(i=>!!HOME_SUB[i])};});
 T('focus: on by default; new calf/tib exercises + home subs',r.on&&r.newIds&&r.subs,JSON.stringify(r));
 T('focus: calves ≥12 sets/week, hamstrings ≥16, mid back ≥16',r.rs.calves>=12&&r.rs.hamstrings>=16&&r.rs['mid back']>=16,JSON.stringify(r.rs));
 await q.evaluate(()=>switchView('lift'));await wait(300);await q.evaluate(()=>{[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent==='Legs A').click();});await wait(300);
 const c=await q.evaluate(()=>({first:document.querySelector('#liftBody .chip')?.textContent.replace(/\s+/g,' '),rows:document.querySelectorAll('input[data-ex="ga1"][data-f="r"]').length,seg:!!document.querySelector('#focusSeg'),rules:/legs & back focus/.test(document.body.innerText)}));
 T('focus: Legs A squat shows 5 sets + focus tag and 5 rows',/^5×/.test(c.first||'')&&/focus/.test(c.first||'')&&c.rows===5,JSON.stringify(c));T('focus: toggle + rules summary',c.seg&&c.rules);
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
 const c60=await q.evaluate(()=>({n:(document.body.innerText.match(/CONFIRMED/g)||[]).length,jc:document.body.innerText.includes('Sun 28 Feb 2027'),persisted:JSON.parse(localStorage.getItem('cb2_radius'))}));
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
await b.close();
const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+(x.detail||'')).join('\n')||'ALL PASS');console.log('RESULT:',pass+'/'+R.length);fs.writeFileSync('qa_report.json',JSON.stringify(R,null,1));})();

const puppeteer=require('puppeteer');const path=require('path');const fs=require('fs');
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
const STORAGE=()=>{const store={};window.__cs=store;window.storage={async get(k){if(!(k in store))throw new Error('nf');return{key:k,value:store[k]};},async set(k,v){store[k]=String(v);return{key:k,value:v};},async delete(k){delete store[k];return{key:k}},async list(){return{keys:Object.keys(store)}}};};
const R=[];const T=(name,ok,detail)=>{R.push({name,ok:!!ok,detail});};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const OFFLINE=async p=>{await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:')||u.startsWith('blob:'))r.continue();else r.respond({status:200,contentType:'text/css',body:''});});};
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
await p.evaluate(()=>{const r=document.querySelector('input[data-ex="ga1"][data-i="0"][data-f="r"]'),w=document.querySelector('input[data-ex="ga1"][data-i="0"][data-f="w"]');if(!r||!w)return;r.value='12';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='15';w.dispatchEvent(new Event('input',{bubbles:true}));});await wait(400);
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
{const _cL=await b.createBrowserContext();const q=await page(_cL,'2026-09-11',()=>{localStorage.clear();});
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
 const f=await q.evaluate(()=>{const h=document.getElementById('suppStack').innerHTML;const t=document.body.innerText;return {hi:(h.match(/Highest recommended dose/g)||[]).length,creatine:h.includes('0.1 g/kg'),caff:h.includes('440\u2013530 mg')||h.includes('440–530 mg'),iron:h.includes('0 until ferritin'),ba:(t.match(/3\.2 g weeks 1–4, then 1\.6 g/g)||[]).length===2&&h.includes('6.4 g a day for four weeks, then 3.2 g')&&!/3-5 g daily/.test(h),citr:t.includes('8 g · conditional')&&!/6(-|–)8 g/.test(h)};});
 T('dose: highest-dose block on all 12 items',f.hi===12,f.hi);T('dose: creatine 0.1 g/kg + caffeine 440–530 + iron none',f.creatine&&f.caff&&f.iron,JSON.stringify(f));T('dose: one beta-alanine protocol (6.4 g × 4 wk, then 3.2 g; 3.2 g halves) and one citrulline dose (8 g) everywhere',f.ba&&f.citr,JSON.stringify(f));
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
 T('focus: Legs A squat shows 5 sets + focus tag, and 6 rows when the Aggressive +1 set applies',/^5×/.test(c.first||'')&&/focus/.test(c.first||'')&&c.rows===(/\+1/.test(c.first||'')?6:5),JSON.stringify(c));T('focus: toggle + rules summary',c.seg&&c.rules);
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

// ===== W. Pure-muscle copy retired, Johannesburg-zone dates, date-aware calendar, focus-aware time estimate (11 Sep 2026) =====
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 const d=await q.evaluate(()=>({tz:Intl.DateTimeFormat().resolvedOptions().timeZone,a0:dateAdd(START_ISO,0),a7:dateAdd(START_ISO,7),ws:weekStartISO(1),wr:weekRangeLabel(1),il:isoLocal(new Date(2026,8,12,1,30)),nd:normDate('12 September 2026'),today:todayISO()}));
 T('dates: suite runs in Africa/Johannesburg',d.tz==='Africa/Johannesburg',d.tz);
 T('dates: dateAdd/weekStart stay on the local day (was one day early in SAST)',d.a0==='2026-09-12'&&d.a7==='2026-09-19'&&d.ws==='2026-09-12'&&/12 Sep/.test(d.wr)&&d.today==='2026-09-12',JSON.stringify(d));
 T('dates: isoLocal at 01:30 local + normDate free text give the local day',d.il==='2026-09-12'&&d.nd==='2026-09-12',JSON.stringify(d));
 await q.evaluate(()=>switchView('lift'));await wait(300);
 const l=await q.evaluate(()=>({t:document.getElementById('view-lift').innerText,h:document.getElementById('view-lift').innerHTML,ph:liftPhase}));
 T('lift: six-day pure-muscle copy, fallback labelled, no run-era copy',l.ph==='hyper'&&/six lifting days a week/.test(l.t)&&/Fallback \(4-day\)/.test(l.t)&&/Pure muscle \(from Day 1, Sat 12 Sep\)/.test(l.t)&&!/Post-race|4 lifting days|Running is trimmed|after 24 Sep/.test(l.t),l.t.slice(0,300));
 await q.evaluate(()=>{document.querySelector('#liftPhaseSeg button[data-ph="build"]').click();});await wait(300);
 const lb=await q.evaluate(()=>document.getElementById('view-lift').innerText);
 T('lift: fallback note is honest (four sessions, a floor not the plan) and mentions no running',/Fallback week \(4-day\)/.test(lb)&&/a floor, not the plan/.test(lb)&&!/running|runs/i.test(lb.split('Commercial Gym')[0]),lb.slice(0,400));
 await q.evaluate(()=>{document.querySelector('#liftPhaseSeg button[data-ph="hyper"]').click();});await wait(200);
 await q.evaluate(()=>switchView('home'));await wait(300);
 const hm=await q.evaluate(()=>document.getElementById('view-home').innerText);
 T('home: how-week note says active-recovery Friday, not "1 full rest"',/active-recovery Friday \(full rest only in deload weeks\)/.test(hm)&&!/1 full rest/.test(hm)&&!/lives in its own tab/.test(hm));
 await q.evaluate(()=>switchView('numbers'));await wait(300);
 const n=await q.evaluate(()=>({t:document.getElementById('view-numbers').innerText,btns:[...document.querySelectorAll('#phaseSeg button')].map(x=>x.textContent),g10:!!document.getElementById('pGoal10k'),pred:!!document.getElementById('predBtn'),note:document.getElementById('calNote').innerText}));
 T('numbers: phase toggle is Pure muscle / Maintenance week only; predictor and Goal-10K field gone',n.btns.join('|')==='Pure muscle|Maintenance week'&&!n.g10&&!n.pred&&!/Race Block|Race Time Predictor|Goal 10K|race paces/.test(n.t)&&/FFMI target/.test(n.t),JSON.stringify(n.btns)+n.t.slice(0,160));
 T('numbers: macro note is pure-muscle, no running',/Pure-muscle growth/.test(n.note)&&!/running twice|Post-race/.test(n.note),n.note);
 await q.evaluate(()=>{document.querySelector('#phaseSeg button[data-ph="race"]').click();});await wait(200);
 const nr=await q.evaluate(()=>({note:document.getElementById('calNote').innerText,gain:document.getElementById('gainOut').innerText}));
 T('numbers: Maintenance week note + gain card copy retired',/Maintenance week:/.test(nr.note)&&/Maintenance week holds weight/.test(nr.gain)&&!/Race Block|Post-Race/.test(nr.gain),nr.gain.slice(0,200));
 await q.evaluate(()=>{document.querySelector('#phaseSeg button[data-ph="hyper"]').click();document.getElementById('pWeight').value='88.5';document.getElementById('saveProfile').click();});await wait(300);
 T('numbers: profile save still works without the 10K field',await q.evaluate(()=>DB.profile.weight===88.5&&!!document.getElementById('rCal').textContent.match(/\d/)));
 await q.evaluate(()=>switchView('guide'));await wait(300);
 const g=await q.evaluate(()=>({t:document.getElementById('view-guide').innerText,h:document.getElementById('view-guide').innerHTML}));
 T('guide: interference card rewritten, six-day split, footer re-anchored to Day 1',/Why Running Is Retired \(the interference effect\)/.test(g.t)&&/six-day split/.test(g.t)&&/Pure Muscle · FFMI 25 · Day 1 Sat 12 Sep 2026/.test(g.t)&&/Add load gradually/.test(g.t)&&!/Four lifting days, two runs|Running Is Trimmed|Strength \+ Speed|Built for 24 September|Build running volume/.test(g.t),g.t.slice(-300));
 T('guide: region card explains the deliberate lower-back band',/held in the gold band on purpose/.test(g.h));
 await q.evaluate(()=>switchView('fuel'));await wait(300);
 const f=await q.evaluate(()=>document.getElementById('view-fuel').innerHTML);
 T('fuel: beta-alanine reason is lifting-only',/15–25-rep calf work/.test(f)&&!/Tuesday track work|600 m rep/.test(f));
 const te=await q.evaluate(()=>{const on=focusLB;focusLB=true;const a=sessionTimeEstimate('legsB').full;focusLB=false;const b2=sessionTimeEstimate('legsB').full;focusLB=on;const sets=GYM.legsB.ex.reduce((n,e)=>n+fxSets(e),0);return {a,b2,sets};});
 T('time estimate honours the Legs & Back focus (+sets → longer session)',te.a>te.b2&&te.a-te.b2>=8,JSON.stringify(te));
 const cal=await q.evaluate(()=>({n:RACES_12M.filter(r=>r.iso).length,ok:RACES_12M.filter(r=>r.iso).every(r=>r.iso.slice(0,7)===r.ym&&/^\d{4}-\d{2}-\d{2}$/.test(r.iso)),miss:RACES_12M.filter(r=>/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(–(Mon|Tue|Wed|Thu|Fri|Sat|Sun))? \d/.test(r.d)&&!r.iso).map(r=>r.name),pk:evKm(RACES_12M.find(r=>r.st==='weekly'))}));
 T('calendar: every weekday-dated entry carries an iso that matches its month; nearest parkrun is ~3 km',cal.n>=30&&cal.ok&&cal.miss.length===0&&cal.pk===3,JSON.stringify(cal));
 T('W: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}
{const q=await page(b,'2026-09-11',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 await q.evaluate(()=>switchView('run'));await wait(300);
 const r=await q.evaluate(()=>document.getElementById('view-run').innerText);
 T('calendar (11 Sep): Hope In Motion re-dated to 18 Oct, Deadly Dozen shows "in 8 days", Warrior "in 8 days", Golden Harvest parkrun block',/Hope In Motion[\s\S]{0,200}Sun 18 Oct 2026/.test(r)&&/Deadly Dozen[\s\S]{0,400}in 8 days/.test(r)&&/Warrior #2[\s\S]{0,300}in 8 days/.test(r)&&/Golden Harvest/.test(r)&&/32 parkruns/.test(r),r.slice(0,200));
 T('calendar (11 Sep): anchors box is computed, date-sorted (Warrior 19 Sep before Deadly Dozen 20 Sep) with computed distances',new RegExp('Built for your goal, not for runners:\\s*Warrior #2 — Taroko Trail Park \\(Sat 19 Sep 2026, ~'+await q.evaluate(()=>evKm(RACES_12M.find(x=>/^Warrior #2/.test(x.name))))+' km\\) · Deadly Dozen Fitness Race — Johannesburg \\(Sat–Sun 19–20 Sep 2026, ~15 km\\)').test(r)&&new RegExp('HYROX Johannesburg \\(Thu–Sun 26–29 Nov 2026, ~'+await q.evaluate(()=>evKm(RACES_12M.find(x=>/HYROX Johannesburg$/.test(x.name))))+' km\\)').test(r)&&/calendar of races within 30 km/.test(r),r.slice(0,600));
 await q.evaluate(()=>{document.querySelector('#radiusSeg button[data-r="15"]').click();});await wait(300);
 const r15=await q.evaluate(()=>document.getElementById('view-run').innerText);
 T('calendar: fallback text follows the chosen radius',/No published event within 15 km yet/.test(r15)&&!/~25 km yet/.test(r15));
 await q.evaluate(()=>{document.querySelector('#radiusSeg button[data-r="30"]').click();});await wait(200);
 T('run: no errors',q.__errs.length===0,q.__errs.join('|'));await q.close();}
{const q=await page(b,'2026-09-21',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));});
 await q.evaluate(()=>switchView('run'));await wait(300);
 const r=await q.evaluate(()=>document.getElementById('view-run').innerText);
 T('calendar (21 Sep): the Deadly Dozen has dropped off the month and the anchors box',!/Deadly Dozen Fitness Race — Johannesburg/.test(r)&&/Built for your goal, not for runners:\s*Warrior|Built for your goal, not for runners:\s*(?!Deadly)/.test(r)&&/HYROX/.test(r),r.slice(0,400));
 await q.close();}
{const q=await page(b,'2026-09-12',()=>{localStorage.clear();localStorage.setItem('cb2_pure',JSON.stringify(true));const R=Date;const fixed=new R('2026-09-12T01:30:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;});
 const e=await q.evaluate(()=>({t:todayISO(),started:planStarted(),cta:document.querySelector('.cta')?.textContent||''}));
 T('dates: at 01:30 on Day 1 the app already knows it is Day 1 (was "yesterday" via UTC)',e.t==='2026-09-12'&&e.started&&/Legs A/.test(e.cta),JSON.stringify(e));await q.close();}

// ===== X. Coherence fixes + tech layer (26 Sep 2026). Each group runs in its own browser context: storage and IndexedDB are isolated. =====
const SEED=o=>'localStorage.clear();'+Object.entries(Object.assign({cb2_pure:true},o)).map(([k,v])=>'localStorage.setItem('+JSON.stringify(k)+','+JSON.stringify(JSON.stringify(v))+');').join('');
const ctxPage=async(iso,seed,more)=>{const c=await b.createBrowserContext();const q=await page(c,iso,SEED(seed||{})+(more||''));q.__ctx=c;return q;};
const done=async q=>{await q.__ctx.close();};
const S=(date,day,entries,loc)=>({id:'s'+date+day,dateISO:date,day,loc:loc||'gym',entries});
const sets=(arr)=>arr.map(([r,w,rpe])=>rpe?{r:String(r),w:String(w),rpe:String(rpe)}:{r:String(r),w:String(w)});
// X1 Brief + Today card follow the lifting template only (the retired run plan leaked in on Sun/Tue/Thu)
for(const [iso,lab] of [['2026-09-27','Push A'],['2026-09-29','Legs B'],['2026-11-12','Pull B']]){const q=await ctxPage(iso);
 const h=await q.evaluate(()=>document.getElementById('view-home').innerText);
 T('brief/today '+iso+': '+lab+', no run-plan leakage',new RegExp('Today: '+lab).test(h)&&!/Absa|RACE DAY|Long Run|Easy Run|Run tab/.test(h),h.match(/Today:[^\n]*/)+'');
 T('home '+iso+': no errors',q.__errs.length===0,q.__errs.join('|'));await done(q);}
// X2 Peak week: no lower-body session D-3..D-1, D-1 is a 30-minute upper pump; Today card, Brief, CTA and Jump In agree
{const q=await ctxPage('2027-03-02');const h=await q.evaluate(()=>({t:document.getElementById('view-home').innerText,cta:document.querySelector('.cta').textContent}));
 T('peak D-3 (Tue 2 Mar): Legs B replaced everywhere',/D-3 — no lower-body session/.test(h.t)&&/Today: D-3 — no lower-body session/.test(h.t)&&/legs off/.test(h.cta)&&!/Start Legs/.test(h.t),h.cta);await done(q);}
{const q=await ctxPage('2027-03-04');const h=await q.evaluate(()=>({t:document.getElementById('view-home').innerText,cta:document.querySelector('.cta').textContent}));
 T('peak D-1 (Thu 4 Mar): 30-minute upper-body pump',/D-1 — 30-minute upper-body pump/.test(h.t)&&/upper-body pump/.test(h.cta),h.cta);
 await q.evaluate(()=>document.querySelector('.cta').click());await wait(300);T('peak D-1: CTA opens the Extras pump',await q.evaluate(()=>curDay==='extras'));await done(q);}
// X3 Deload Friday: Brief says full rest, Today card has no pump buttons; X4 week strip labels
{const q=await ctxPage('2026-10-23');const h=await q.evaluate(()=>({t:document.getElementById('view-home').innerText,h:document.getElementById('view-home').innerHTML}));
 T('deload Friday: Brief = full rest, no Extras Pump button',/Today: Full rest — deload week/.test(h.t)&&!/goToExtras\(\)">[^<]*<svg[\s\S]{0,400}Extras Pump/.test(h.h)&&!/Main day instead/.test(h.t),h.t.match(/Today:[^\n]*/)+'');
 T('strip: deload-week Friday reads Rest',/FRI\s*\n?\s*Rest/i.test(h.t.replace(/\n+/g,'\n')),'');await done(q);}
{const q=await ctxPage('2026-09-26');const h=await q.evaluate(()=>document.getElementById('view-home').innerText);
 T('strip: normal Friday reads Pump; Jump In says Events, not Run Plan',/FRI\s*\n?\s*Pump/i.test(h.replace(/\n+/g,'\n'))&&/Events/.test(h)&&!/Run Plan/.test(h));
 T('pillar: ceiling states both fat levels',/ceiling ~\d+ kg @ 18%\s+~\d+ kg @ 24%/.test(h));await done(q);}
// X5 March route: Day-1 anchored target, 1%/week ceiling, honest engine line, readable table
{const a=await ctxPage('2026-09-12');const k0=await a.evaluate(()=>['band','edge','mass'].map(k=>+marchTarget(k).kg.toFixed(1)));await done(a);
 const q=await ctxPage('2026-12-01');const k1=await q.evaluate(()=>['band','edge','mass'].map(k=>+marchTarget(k).kg.toFixed(1)));
 T('march: targets anchored to Day 1 (no drift with time alone)',JSON.stringify(k0)===JSON.stringify(k1),JSON.stringify([k0,k1]));
 const e=await q.evaluate(()=>{const t=document.getElementById('view-home').innerText;return {line:(t.match(/Engine now targets[^\n]*/)||[''])[0],g:+gainModel('hyper').rateKgWk.toFixed(2)};});
 T('march: engine line prints the rate the engine uses (band route)',e.line.includes('+'+e.g.toFixed(2)+' kg/week')&&/route itself needs/.test(e.line),e.line);await done(q);}
{const q=await ctxPage('2027-03-02',{cb2_march:'edge',cb2_bulk:'aggr'});const m=await q.evaluate(()=>{const r=['band','edge','mass'].map(k=>marchTarget(k));return {kcal:r.map(x=>x.surplus),cap:r.map(x=>x.capped),g:gainModel('hyper').rateKgWk,w:+DB.profile.weight,line:(document.getElementById('view-home').innerText.match(/Engine now targets[^\n]*/)||[''])[0]};});
 T('march (final week): no route prescribes more than 1%/week (was +6.9 kg/wk, 7,590 kcal)',m.kcal.every(k=>k<=1000)&&m.g<=m.w*0.01+1e-9&&m.cap.some(Boolean)&&/priced, not chased/.test(m.line),JSON.stringify(m));await done(q);}
{const q=await ctxPage('2027-02-25');T('milestone: under two weeks counts days to the check day ("8 days away")',/8 days away \(the check is Friday 5 Mar\)/.test(await q.evaluate(()=>document.getElementById('view-home').innerText)));await done(q);}
// X6 Roadmap copy
{const q=await ctxPage('2026-09-26');const r=await q.evaluate(()=>{const rm=buildRoadmap();return {w9:rm[8].milestone||'',w16:rm[15].milestone||'',txt:JSON.stringify(rm)};});
 T('roadmap: week-16 base-block milestone, no week-9 bulk banner, no run-era copy',/base block complete/.test(r.w16)&&!/first bulk block/.test(r.txt)&&!/Running drops away|concurrent|second race/.test(r.txt),r.w9+' | '+r.w16);await done(q);}
// X7 Readiness from last night's sleep
{const q=await ctxPage('2026-09-26',{cb2_sleep:[{date:'2026-09-25',h:5.2}]});const h=await q.evaluate(()=>document.getElementById('view-home').innerText);
 T('readiness: a 5.2 h night triggers the RIR-2 nudge on a lift day',/Short night — 5.2 h logged/.test(h));await done(q);}
// X8 Auto-progression (double progression) on the real Lift cards
const LEG_A_PREV={ga1:sets([[3,110],[8,100],[8,100],[8,100],[8,100]]),ga2:sets([[10,80],[9,80],[8,80]]),ga3:sets([[12,150],[9,150],[12,150]])};
{const q=await ctxPage('2026-09-26',{cb2_sessions:[S('2026-09-19','legsA',LEG_A_PREV)]});await q.evaluate(()=>goToLift());await wait(400);
 const t=await q.evaluate(()=>[...document.querySelectorAll('#liftBody .nextt')].map(x=>x.dataset.kind+'|'+x.innerText));
 T('progression: squat all sets at 8 of 5–8 → +2.5 kg, top set noted',t.some(x=>/^up\|Next target: 102.5 kg × 5–8/.test(x)&&/Top set \(110 kg\)/.test(x)),JSON.stringify(t));
 T('progression: RDL 10/9/8 → same load, add a rep to the weakest set',t.some(x=>/^reps\|Next target: 80 kg × 8–12[\s\S]*weakest set \(8\)/.test(x)),JSON.stringify(t));
 T('progression: leg press set below range → hold the load',t.some(x=>/^hold\|Next target: 150 kg × 10–15/.test(x)),JSON.stringify(t));
 T('X8: no errors',q.__errs.length===0,q.__errs.join('|'));await done(q);}
{const q=await ctxPage('2026-10-17',{cb2_sessions:[S('2026-10-10','legsA',LEG_A_PREV)]});await q.evaluate(()=>goToLift());await wait(400);
 const t=await q.evaluate(()=>[...document.querySelectorAll('#liftBody .nextt')].map(x=>x.dataset.kind+'|'+x.innerText));
 T('progression: deload week → about 65% of the working weight',t.some(x=>/^deload\|Next target: 65 kg/.test(x)),JSON.stringify(t));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_loc:'home',cb2_sessions:[S('2026-09-12','legsA',{ga1:sets([[20,15],[20,15],[20,15],[20,15]])},'home'),S('2026-09-19','legsA',{ga1:sets([[5,140]])},'gym')]});await q.evaluate(()=>goToLift());await wait(400);
 const t=await q.evaluate(()=>[...document.querySelectorAll('#liftBody .nextt')].map(x=>x.dataset.kind+'|'+x.innerText));
 T('progression (home): top of the home range (20) on the 15 kg bells → make the rep harder; a newer gym session never leaks in',t.some(x=>/^harder\|Next target: 15 kg × 10–20/.test(x))&&!t.some(x=>/140|142.5/.test(x)),JSON.stringify(t));await done(q);}
// X9 Lifts + Regions analytics on Track, driven by the Lift log
{const q=await ctxPage('2026-09-26',{cb2_sessions:[S('2026-09-12','legsA',{ga1:sets([[8,95],[8,95]]),ga2:sets([[10,70]])}),S('2026-09-19','legsA',{ga1:sets([[8,100],[8,100]])}),S('2026-09-26','legsA',{ga2:sets([[10,80],[10,80],[10,80]]),ga7:sets([[12,60],[12,60]])})]});
 await q.evaluate(()=>switchView('track'));await wait(300);
 const tabs=await q.evaluate(()=>[...document.querySelectorAll('.track-tabs button')].map(x=>x.textContent).join('|'));
 T('track: tabs are Weight|Lifts|Regions|Tests|Tapes and all five fit at 390 px (run tabs retired)',tabs==='Weight|Lifts|Regions|Tests|Tapes'&&await q.evaluate(()=>{const w=document.querySelector('.track-tabs');return w.scrollWidth<=w.clientWidth+1;}),tabs);
 await q.evaluate(()=>document.querySelector('.track-tabs button[data-tp="lifts"]').click());await wait(200);
 const l=await q.evaluate(()=>({t:document.getElementById('tp-lifts').innerText,svg:!!document.querySelector('#tp-lifts svg'),vis:document.getElementById('tp-lifts').classList.contains('on')}));
 T('lifts: e1RM curve + table built from the Lift log, squat PB flagged',l.vis&&l.svg&&/Barbell Back Squat \(or Hack Squat\)\s+127\s+\+6\s+PB/.test(l.t),l.t.slice(0,300));
 await q.evaluate(()=>{const s=document.getElementById('lhSel');s.value=[...s.options].find(o=>/Romanian/.test(o.text)).value;s.dispatchEvent(new Event('change'));});await wait(200);
 T('lifts: switching exercise redraws the curve',await q.evaluate(()=>curLiftKey==='ga2|gym'&&!!document.querySelector('#tp-lifts svg')));
 await q.evaluate(()=>document.querySelector('.track-tabs button[data-tp="regions"]').click());await wait(200);
 const r=await q.evaluate(()=>{const g=n=>document.querySelector('#tp-regions [data-rg="'+n+'"]').innerText.replace(/\s+/g,' ');return {h:g('hamstrings'),c:g('calves'),lb:g('lower back'),plan:regionSets()};});
 T('regions: this week logged/planned per region (RDL → hamstrings, glutes, lower back; calf raise → calves)',r.h.includes('3 / '+r.plan.hamstrings)&&r.lb.includes('3 / '+r.plan['lower back'])&&r.c.includes('2 / '+r.plan.calves),JSON.stringify(r));
 T('X9: no errors',q.__errs.length===0,q.__errs.join('|'));await done(q);}
// X10 Screen wake lock follows the Lift view and the toggle
{const WL="window.__wl={req:0,rel:0};Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{window.__wl.req++;const l={released:false,addEventListener(){},release:async()=>{window.__wl.rel++;}};return l;}}});";
 const q=await ctxPage('2026-09-26',{},WL);await q.evaluate(()=>switchView('lift'));await wait(300);const a=await q.evaluate(()=>({...window.__wl,seg:!!document.getElementById('wakeSeg')}));
 await q.evaluate(()=>switchView('home'));await wait(300);const b2=await q.evaluate(()=>({...window.__wl}));
 T('wake lock: requested on Lift, released on leaving',a.req===1&&a.seg&&b2.rel===1,JSON.stringify([a,b2]));
 await q.evaluate(()=>switchView('lift'));await wait(200);await q.evaluate(()=>document.querySelector('#wakeSeg button[data-wk="off"]').click());await wait(300);
 const c=await q.evaluate(()=>({...window.__wl,stored:localStorage.getItem('cb2_wakelock')}));
 T('wake lock: toggle off releases and persists',c.stored==='false'&&c.rel>=2,JSON.stringify(c));await done(q);}
// X11 Rest timer runs on the wall clock (survives a locked screen) and cues the end
{const q=await ctxPage('2026-09-26');await q.evaluate(()=>goToLift());await wait(300);
 await q.evaluate(()=>{const r=document.querySelector('#liftBody input[data-f="r"]'),w=document.querySelector('#liftBody input[data-f="w"]');r.value='8';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='60';w.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#liftBody .chk').click();});await wait(300);
 const s0=await q.evaluate(()=>({show:document.getElementById('restTimer').classList.contains('show'),t:document.getElementById('restTime').textContent}));
 await q.evaluate(()=>{const f=Date.now();Date.now=()=>f+400000;document.dispatchEvent(new Event('visibilitychange'));});await wait(200);
 const s1=await q.evaluate(()=>({t:document.getElementById('restTime').textContent,beeps:window.__beeps||0}));
 T('rest timer: starts on the set tick, finishes from wall-clock time after the phone was away, beeps',s0.show&&/^\d:\d\d$/.test(s0.t)&&s1.t==='Go!'&&s1.beeps>=1,JSON.stringify([s0,s1]));
 await q.evaluate(()=>document.getElementById('restPlus').click());await wait(200);
 T('rest timer: +15s after it finished starts a fresh 15 s',await q.evaluate(()=>document.getElementById('restTime').textContent==='0:15'&&document.getElementById('restTimer').classList.contains('show')));await done(q);}
// X12 Weekly check-in for Claude (clipboard path, textarea fallback)
{const CB="window.__clip=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__clip=t;}}});";
 const q=await ctxPage('2026-09-26',{cb2_sessions:[S('2026-09-19','legsA',{ga1:sets([[8,100],[8,100]])})],cb2_weight:[{date:'2026-09-19',v:88.4},{date:'2026-09-26',v:88.9}],cb2_measure:[{date:'2026-09-19',waist:92,neck:40}]},CB);
 await q.evaluate(()=>document.getElementById('coachBtn').click());await wait(300);const t=await q.evaluate(()=>window.__clip||'');
 T('claude check-in: copied text carries the log, the region table and the no-guessing instruction',/plan week 3/.test(t)&&/Barbell Back Squat \(or Hack Squat\): 8×100 kg, 8×100 kg/.test(t)&&/2026-09-26 88.9 kg/.test(t)&&/waist 92 cm/.test(t)&&/Hard sets per region this week/.test(t)&&/Use only the numbers above/.test(t)&&!/@|Bellcanto|North Riding/.test(t),t.slice(0,240));await done(q);}
{const q=await ctxPage('2026-09-26',{},"Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});Object.defineProperty(navigator,'share',{configurable:true,value:undefined});");
 await q.evaluate(()=>document.getElementById('coachBtn').click());await wait(300);
 T('claude check-in: no clipboard or share sheet → the text appears, selected, in a box',await q.evaluate(()=>{const b=document.getElementById('coachBox');return !b.hidden&&/Weekly check-in/.test(b.value);}));await done(q);}
// X13 Scan body fat (DEXA/InBody) overrides the tape
{const q=await ctxPage('2026-09-26',{cb2_measure:[{date:'2026-09-19',waist:95,neck:39}]});await q.evaluate(()=>switchView('numbers'));await wait(300);
 await q.evaluate(()=>{document.getElementById('scanKind').value='DEXA';document.getElementById('scanBf').value='21.4';document.getElementById('scanDate').value='2026-09-24';document.getElementById('scanApply').click();});await wait(400);
 const r=await q.evaluate(()=>({bf:DB.profile.bf,m:DB.measure.find(x=>x.date==='2026-09-24'),t:document.getElementById('view-numbers').innerText}));
 T('scan: DEXA 21.4% sets the profile, is stored, and outranks the older tape',r.bf===21.4&&r.m&&r.m.scanBf===21.4&&/so the scan stands/.test(r.t)&&/Last scan: 21.4%/.test(r.t),JSON.stringify({bf:r.bf,m:r.m}));await done(q);}
// X14 Data safety: full backup keys, legacy restore format, key whitelist, measure merge, Track export = full backup
{const q=await ctxPage('2026-09-26',{cb2_loc:'home',cb2_wakelock:false});const k=await q.evaluate(()=>Object.keys(JSON.parse(backupJSON())));
 T('backup: preferences (location, wake lock) travel with the backup',k.includes('cb2_loc')&&k.includes('cb2_wakelock'),k.join(','));
 const r=await q.evaluate(()=>{localStorage.removeItem('cb2_weight');applyRestoreText(JSON.stringify({app:'ComebackBlueprint',version:2,weight:[{date:'2026-09-20',v:89}],sleep:[{date:'2026-09-20',h:7}],evil:1}));return {w:localStorage.getItem('cb2_weight'),s:localStorage.getItem('cb2_sleep'),e:localStorage.getItem('evil')};});
 T('restore: the older Track-export format maps onto the full keys; unknown keys are refused',/89/.test(r.w||'')&&/"h":7/.test(r.s||'')&&r.e===null,JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-26');await q.evaluate(()=>switchView('track'));await wait(300);await q.evaluate(()=>document.querySelector('.track-tabs button[data-tp="measure"]').click());
 await q.evaluate(()=>{const s=(i,v)=>{const e=document.getElementById(i);e.value=v;};s('meDate','2026-09-26');s('meWaist','93');s('meNeck','40');document.getElementById('meAdd').click();});await wait(200);
 await q.evaluate(()=>{const s=(i,v)=>{const e=document.getElementById(i);e.value=v;};s('meDate','2026-09-26');s('meArm','39');document.getElementById('meAdd').click();});await wait(200);
 const m=await q.evaluate(()=>DB.measure.find(x=>x.date==='2026-09-26'));T('measures: a second entry the same day merges (waist and neck kept, arm added)',m&&m.waist===93&&m.neck===40&&m.arm===39,JSON.stringify(m));
 await q.evaluate(()=>document.getElementById('exportBtn').click());await wait(300);T('track export: writes the full backup (backup-age clock resets)',await q.evaluate(()=>!!localStorage.getItem('cb2_lastbackup')));await done(q);}
// X15 PR toast no longer crashes on Extras / Upper exercises
{const q=await ctxPage('2026-09-25',{cb2_sessions:[S('2026-09-18','extras',{x1:sets([[15,20]])})]});await q.evaluate(()=>{curDay='extras';switchView('lift');});await wait(300);
 await q.evaluate(()=>{const r=document.querySelector('input[data-ex="x1"][data-f="r"]'),w=document.querySelector('input[data-ex="x1"][data-f="w"]');r.value='15';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='25';w.dispatchEvent(new Event('input',{bubbles:true}));w.dispatchEvent(new Event('change',{bubbles:true}));});await wait(300);
 T('PR on an Extras exercise: toast names it, no crash',await q.evaluate(()=>/New PR on Face Pull/.test(document.getElementById('toast').innerText))&&q.__errs.length===0,q.__errs.join('|'));await done(q);}
// X16 Calendar hygiene + shell
{const q=await ctxPage('2026-09-26');await q.evaluate(()=>switchView('run'));await wait(300);const c=await q.evaluate(()=>({t:document.getElementById('view-run').innerText,stale:RACES_12M.filter(r=>/^~\d/.test(r.km||'')).length,pta:RACES_12M.some(r=>/Deadly Dozen.*Pretoria/.test(r.name)),box:(document.getElementById('view-run').innerText.match(/Built for your goal, not for runners:[^\n]*/)||[''])[0]}));
 T('calendar: no typed distances left, unverified Pretoria date removed, club heading honest',c.stale===0&&!c.pta&&/Weekly, free, near home/.test(c.t)&&!/inside 10 km|within about 15 km/.test(c.t));
 T('calendar (26 Sep): anchors start with HYROX (Deadly Dozen and Warrior #2 have run)',/not for runners:\s*Virgin Active HYROX Johannesburg/.test(c.box),c.box.slice(0,160));
 T('calendar: verified additions render with computed distances',/Fat Cats 10K[\s\S]{0,200}~16 km from home/.test(c.t)&&/Sandton Half Marathon/.test(c.t),'');
 const sh=await q.evaluate(()=>({d:document.querySelector('meta[name=description]').content,f:document.querySelector('link[href*="fonts.googleapis.com/css2"]').media,mf:!!document.querySelector('link[rel=manifest]')}));
 T('shell: description retired the 15K race, fonts are non-blocking, no manifest link on file://',!/15K|race plan/.test(sh.d)&&sh.f==='all'&&!sh.mf,JSON.stringify(sh));
 for(const v of ['home','lift','run','roadmap','fuel','numbers','track','guide']){await q.evaluate(n=>switchView(n),v);await wait(120);}
 T('X16: all eight views, no errors',q.__errs.length===0,q.__errs.join('|'));await done(q);}

// ===== Y. Review round (64 verified findings, 26 Sep 2026): each fix proven through the real UI or the engine =====
const SEED_ONCE=o=>'if(!sessionStorage.getItem("__seeded")){sessionStorage.setItem("__seeded","1");'+SEED(o)+'}';
const nextT=async q=>q.evaluate(()=>[...document.querySelectorAll('#liftBody .nextt')].map(x=>x.dataset.kind+'|'+x.innerText));
{const q=await ctxPage('2026-09-26',{cb2_loc:'home',cb2_sessions:[S('2026-09-19','legsA',{ga1:sets([[20,5],[20,5],[20,5]]),ga2:sets([[15,15],[15,15]])},'home')]});await q.evaluate(()=>goToLift());await wait(400);const t=await nextT(q);
 T('Y home: 5 kg bells at the top of 10–20 → move up to the 15 kg bells; mid-range 15 reps → add a rep (home range, not the gym 5–8)',t.some(x=>/^up\|Next target: 15 kg × 10–20[\s\S]*15 kg bells/.test(x))&&t.some(x=>/^reps\|Next target: 15 kg × 10–20/.test(x)),JSON.stringify(t));await done(q);}
{const q=await ctxPage('2026-10-24',{cb2_sessions:[S('2026-10-10','legsA',{ga1:sets([[7,100],[7,100],[7,100],[7,100]])}),S('2026-10-17','legsA',{ga1:sets([[8,65],[8,65],[8,65],[8,65]])})]});await q.evaluate(()=>goToLift());await wait(400);const t=await nextT(q);
 T('Y deload: the week after a deload anchors on the last full week (100 kg), not the 65 kg deload session',t.some(x=>/^reps\|Next target: 100 kg × 5–8/.test(x))&&!t.some(x=>/67\.5|65 kg/.test(x)),JSON.stringify(t));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_sessions:[S('2026-09-19','legsA',{ga2:sets([[12,90],[10,90],[9,90],[9,90]])})]});await q.evaluate(()=>goToLift());await wait(400);const t=await nextT(q);
 T('Y aggressive: set one at the top of 8–12 raises the load (the rule printed on the Lift screen)',t.some(x=>/^up\|Next target: 92.5 kg × 8–12[\s\S]*Set one hit 12\+/.test(x)),JSON.stringify(t));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_sessions:[S('2026-09-19','legsA',{ga1:sets([[8,100],[8,100]])},'gym'),S('2026-09-23','legsA',{ga1:sets([[15,15],[15,15]])},'home')]});await q.evaluate(()=>goToLift());await wait(400);
 const l=await q.evaluate(()=>(document.querySelector('#liftBody .lastt')||{}).innerText||'');T('Y last time: the gym card shows the last gym session, not a newer home one',/100 kg × 8/.test(l)&&!/15 kg × 15/.test(l),l);await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_loc:'home',cb2_sessions:[{id:'u1',dateISO:'2026-09-19',day:'legsA',entries:{ga1:sets([[15,15]])}}]},'');
 T('Y migration: untagged sessions from before the upgrade take the location setting once',await q.evaluate(()=>DB.sessions[0].loc==='home'&&JSON.parse(localStorage.getItem('cb2_locmig'))===true));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_loc:'home',cb2_sessions:[{id:'e1',dateISO:'2026-09-26',day:'legsA',loc:'home',entries:{}}]});await q.evaluate(()=>{switchView('lift');});await wait(300);
 await q.evaluate(()=>{document.querySelector('#locSeg button[data-loc="gym"]').click();});await wait(300);
 await q.evaluate(()=>{const r=document.querySelector('#liftBody input[data-f="r"]'),w=document.querySelector('#liftBody input[data-f="w"]');r.value='8';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='100';w.dispatchEvent(new Event('input',{bubbles:true}));});await wait(200);
 T('Y location: a session with no sets yet follows the Home/Gym switch',await q.evaluate(()=>DB.sessions.length===1&&DB.sessions[0].loc==='gym'),await q.evaluate(()=>JSON.stringify(DB.sessions)));await done(q);}
{const CB="window.__clip=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__clip=t;}}});";
 const q=await ctxPage('2026-09-29',{cb2_sessions:[S('2026-09-29','legsB',{gb8:sets([[6,0],[6,0],[6,0],[6,0]])}),S('2026-10-02','extras',{x5:sets([[15,40],[15,40],[15,40]])})]},CB);
 await q.evaluate(()=>{switchView('track');document.querySelector('.track-tabs button[data-tp="regions"]').click();});await wait(300);
 const r=await q.evaluate(()=>({h:document.querySelector('#tp-regions [data-rg="hamstrings"]').innerText.replace(/\s+/g,' '),c:document.querySelector('#tp-regions [data-rg="calves"]').innerText.replace(/\s+/g,' ')}));
 T('Y regions: bodyweight sets (0 kg Nordics) count; Friday Extras show as pump, not hard sets',/^Hamstrings 4 \//.test(r.h)&&/^Calves 0 \/ \d+ \+ 3 pump/.test(r.c),JSON.stringify(r));
 await q.evaluate(()=>{switchView('home');document.getElementById('coachBtn').click();});await wait(300);
 T('Y check-in: bodyweight sets are included as "bodyweight"',/Nordic Hamstring Curl \(Eccentric\): 6×bodyweight/.test(await q.evaluate(()=>window.__clip||'')));await done(q);}
{const q=await ctxPage('2026-09-26');const l=await q.evaluate(()=>({a:exLabel('ga7|gym'),b:exLabel('x5|gym'),c:exLabel('ga1|gym'),s:loadStep({},22.5),t:loadStep({},24)}));
 T('Y labels + steps: duplicate names carry their day; a 22.5 kg bell steps 2.5, a 24 kg bell steps 2',l.a==='Standing Calf Raise · Legs A'&&l.b==='Standing Calf Raise · Extras'&&l.c==='Barbell Back Squat (or Hack Squat)'&&l.s===2.5&&l.t===2,JSON.stringify(l));await done(q);}
{const W=[{date:'2026-09-12',v:88.0},{date:'2026-10-24',v:90.5},{date:'2026-12-12',v:93.5}];const q=await ctxPage('2026-12-12',{cb2_weight:W});
 const a=await q.evaluate(()=>({k:marchTarget('band').kg,rows:['band','edge','mass'].map(k=>marchTarget(k).leanGain)}));
 await q.evaluate(()=>{switchView('numbers');document.getElementById('scanBf').value='22';document.getElementById('scanDate').value='2026-12-12';document.getElementById('scanApply').click();});await wait(400);
 const b2=await q.evaluate(()=>({k:marchTarget('band').kg,bf:DB.profile.bf,day1:DB.profile.day1bf}));
 T('Y March anchor: a later scan does not rewrite the Day-1 target; muscle columns stay positive',a.k===b2.k&&b2.bf===22&&a.rows.every(v=>v>0),JSON.stringify([a,b2]));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_weight:[{date:'2026-02-15',v:94.0},{date:'2026-09-14',v:88.2}]});
 T('Y Day-1 weight: the reading nearest 12 Sep within a week wins; an old pre-layoff import is ignored',await q.evaluate(()=>day1W()===88.2));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_bulk:'cut'});const l=await q.evaluate(()=>(document.getElementById('view-home').innerText.match(/Engine is in Cut[^\n]*/)||[''])[0]);
 T('Y engine line in Cut mode: a deficit, no "+-"',/Engine is in Cut: −0\.\d\d kg\/week/.test(l)&&!/\+-/.test(l),l);await done(q);}
{const q=await ctxPage('2027-02-13',{cb2_weight:[{date:'2026-09-12',v:88.0},{date:'2027-02-13',v:99.6}]});const a=await q.evaluate(()=>({need:marchTarget('band').need,g:gainModel('hyper').rateKgWk}));
 T('Y band route: when ahead, the engine slows to what the route needs instead of driving past the band top',a.g<=a.need+1e-9,JSON.stringify(a));await done(q);}
{const q=await ctxPage('2027-03-08');const t=await q.evaluate(()=>document.getElementById('view-home').innerText+(document.getElementById('marchSeg')?' [route table]':''));
 T('Y after the milestone: no route asks for kilos per week against a passed deadline',/The check weekend has passed/.test(t)&&!/route itself needs/.test(t)&&!/\[route table\]/.test(t));await done(q);}
{const q=await ctxPage('2026-11-07',{cb2_bulk:'max'});const t=await q.evaluate(()=>document.getElementById('view-home').innerText.replace(/\s+/g,' '));
 T('Y waist rule: the milestone card shows the limit the Weekly Review enforces (+3 cm outside Aggressive)',/Waist rule ≤ \+3/i.test(t)&&!/Waist rule ≤ \+5/i.test(t),(t.match(/Waist rule.{0,60}/i)||[''])[0]);await done(q);}
{const q=await ctxPage('2026-10-03',{cb2_weight:[{date:'2026-09-19',v:88.8},{date:'2026-10-03',v:89.9}]});await q.evaluate(()=>switchView('roadmap'));await wait(300);
 const rm=await q.evaluate(()=>document.getElementById('view-roadmap').innerText);
 await q.evaluate(()=>{switchView('track');document.getElementById('wDate').value='2026-09-12';document.getElementById('wVal').value='88.0';document.getElementById('wAdd').click();});await wait(300);
 T('Y roadmap starts at Day 1 (12 Sep), and backfilling the Day-1 weigh-in keeps the profile on the latest reading',/12 Sep ’26/.test(rm)&&!/29 Jun/.test(rm)&&await q.evaluate(()=>DB.profile.weight===89.9&&day1W()===88),rm.slice(0,120));await done(q);}
{const c=await b.createBrowserContext();const q=await page(c,'2026-09-26',SEED_ONCE({}));await q.evaluate(()=>{DB.weight.push({date:todayISO(),v:88.9});DB.save();});await wait(700);
 await q.evaluate(()=>localStorage.clear());await q.reload({waitUntil:'networkidle0'});await wait(1600);
 T('Y vault: a real wipe (no flags re-seeded) restores from IndexedDB',await q.evaluate(()=>DB.weight.some(x=>+x.v===88.9)),await q.evaluate(()=>JSON.stringify(DB.weight)));await c.close();}
{const q=await ctxPage('2026-09-26');await wait(1200);T('Y vault: a fresh, empty first run shows no false "Restored" toast',await q.evaluate(()=>!/Restored from the device vault/.test(document.getElementById('toast').innerText)));
 const r=await q.evaluate(()=>{persist('cb2_march','edge');persist('cb2_bulk','max');reloadDB();return {m:marchKey,b:bulkMode};});T('Y restore: reloading data also reloads the settings',r.m==='edge'&&r.b==='max',JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_measure:[{date:'2026-09-26',waist:92,neck:39}]});await q.evaluate(()=>switchView('numbers'));await wait(200);
 const ap=async(v,d)=>{await q.evaluate((v,d)=>{document.getElementById('scanBf').value=v;document.getElementById('scanDate').value=d;document.getElementById('scanApply').click();},v,d);await wait(300);};
 await ap('21','2026-09-26');const same=await q.evaluate(()=>document.getElementById('view-numbers').innerText);
 await ap('25','2026-08-01');const r=await q.evaluate(()=>({bf:DB.profile.bf}));
 await q.evaluate(()=>{switchView('track');document.querySelector('.track-tabs button[data-tp="measure"]').click();});await wait(200);const lst=await q.evaluate(()=>document.getElementById('meList').innerText);
 T('Y scans: an older scan is stored but does not override; same-day wording; scans show in the Tapes list',r.bf===21&&/was taken the same day as your DEXA scan/.test(same)&&/DEXA 25%/.test(lst)&&/DEXA 21%/.test(lst),JSON.stringify(r)+lst.slice(0,120));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_sleep:[{date:'2026-09-24',h:6}]});const r=await q.evaluate(()=>{const nav=[];const orig=location.reload;applyRestoreText(JSON.stringify({app:'ComebackBlueprint',version:2,weight:[{date:'2026-09-01',v:87.5}]}));const a=localStorage.getItem('cb2_sleep');applyRestoreText(JSON.stringify({cb2_weight:[{date:'2026-09-02',v:87.6}],evil:1}));return {sleep:a,evil:localStorage.getItem('evil'),w:localStorage.getItem('cb2_weight')};});
 T('Y restore: an older-format file replaces the logs it lacks; a modern file cannot write foreign keys',r.sleep==='[]'&&r.evil===null&&/87.6/.test(r.w),JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_sleep:[{date:'2026-09-25',h:7}],cb2_sessions:[S('2026-09-19','legsA',{ga1:sets([[8,100]])})],cb2_bulk:'max'});
 const keys=await q.evaluate(async()=>{let blob=null;const o=URL.createObjectURL;URL.createObjectURL=b=>{blob=b;return o.call(URL,b);};switchView('track');document.getElementById('exportBtn').click();await new Promise(r=>setTimeout(r,200));URL.createObjectURL=o;return blob?Object.keys(JSON.parse(await blob.text())):[];});
 T('Y export: Track → Export writes the full backup (profile, sessions, sleep, settings)',['cb2_profile','cb2_sessions','cb2_sleep','cb2_bulk'].every(k=>keys.includes(k)),keys.join(','));await done(q);}
{const q=await ctxPage('2026-09-26');await q.evaluate(()=>{localStorage.removeItem('cb2_lifts');reloadDB();switchView('track');});await wait(300);
 T('Y restore without lifts: Track opens without errors (lifts default is a list)',await q.evaluate(()=>Array.isArray(DB.lifts))&&q.__errs.length===0,q.__errs.join('|'));await done(q);}
{const q=await ctxPage('2027-03-02',{cb2_sleep:[{date:'2027-03-02',h:5}]});await q.evaluate(()=>goToLift());await wait(300);
 const r=await q.evaluate(()=>({v:[...document.querySelectorAll('.view')].find(x=>x.classList.contains('active')).id,brief:(document.getElementById('view-home').innerText.match(/Short night[^\n]*/)||[''])[0]}));
 T('Y peak: the Lift button on D-3 opens Fuel (legs off) and the short-sleep nudge does not say "keep the session"',r.v==='view-fuel'&&!r.brief,JSON.stringify(r));await done(q);}
{const q=await ctxPage('2027-03-04');await q.evaluate(()=>goToLift());await wait(300);T('Y peak: the Lift button on D-1 opens the Extras pump',await q.evaluate(()=>curDay==='extras'));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_sleep:[{date:'2026-09-25',h:5.2}],cb2_bulk:'aggr'});await q.evaluate(()=>goToLift());await wait(400);
 const r=await q.evaluate(()=>({note:/Short night — 5.2 h logged/.test(document.getElementById('liftBody').innerHTML),plus:/font-weight:700">\+1</.test(document.getElementById('liftBody').innerHTML)}));
 T('Y readiness reaches Lift: short-night note and no aggressive +1 set',r.note&&!r.plus,JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-11-28');await q.evaluate(()=>switchView('run'));await wait(300);const t=await q.evaluate(()=>document.getElementById('view-run').innerText);
 T('Y calendar: HYROX stays listed on its third day as "on now"; estate name not rendered; parkrun distances computed',/Virgin Active HYROX Johannesburg[\s\S]{0,300}on now/i.test(t)&&!/Bellcanto/.test(t)&&/Nearest by straight line: Golden Harvest ~3 km/.test(t),'');
 T('Y backup keys: one global list, every setting included',await q.evaluate(()=>Array.isArray(BACKUP_KEYS)&&['cb2_wakelock','cb2_loc','cb2_fuelq','cb2_focuslb','cb2_radius','cb2_march','cb2_bulk'].every(k=>BACKUP_KEYS.includes(k))));await done(q);}
// ===== Z. Visual layer (26 Sep 2026): true-scale charts, a text floor, finger-sized targets, undo on delete. Measured at 390 px, the phone width. =====
{const VSEED={cb2_weight:[{date:'2026-09-12',v:88},{date:'2026-09-19',v:88.4},{date:'2026-09-25',v:88.8}],cb2_measure:[{date:'2026-09-12',waist:92,neck:39,arm:37},{date:'2026-09-26',waist:92.4,neck:39,arm:37.3}],cb2_sessions:[S('2026-09-12','legsA',{ga1:sets([[8,100],[8,100]])}),S('2026-09-19','legsA',{ga1:sets([[8,102.5],[8,102.5]])})]};
 const q=await ctxPage('2026-09-26',VSEED);await q.setViewport({width:390,height:844});await wait(300);
 const m=await q.evaluate(()=>{const out={svgMin:99,svgWorst:'',htmlMin:99,htmlWorst:'',tapMin:99,tapWorst:'',scale:[],aria:0,charts:0,views:0};
  for(const v of [...document.querySelectorAll('.tab[data-view]')].map(t=>t.dataset.view)){switchView(v);out.views++;
   document.querySelectorAll('#view-'+v+' .tool').forEach(t=>t.classList.add('open'));document.querySelectorAll('#view-'+v+' details').forEach(d=>d.open=true);
   const panes=v==='track'?[...document.querySelectorAll('.track-tabs button')]:[null];
   for(const pb of panes){if(pb)pb.click();const root=document.getElementById('view-'+v);
    root.querySelectorAll('*').forEach(el=>{const cs=getComputedStyle(el);if(!el.getClientRects().length||cs.visibility==='hidden')return;
     const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1);
     if(own){let fs=parseFloat(cs.fontSize);const svg=el.closest('svg');
      if(svg){const vb=svg.viewBox&&svg.viewBox.baseVal;if(vb&&vb.width)fs*=svg.getBoundingClientRect().width/vb.width;if(fs<out.svgMin){out.svgMin=fs;out.svgWorst=v+':'+el.textContent.trim().slice(0,24);}}
      else if(fs<out.htmlMin){out.htmlMin=fs;out.htmlWorst=v+':'+(el.className||el.tagName)+':'+el.textContent.trim().slice(0,24);}}
     if(el.matches('.seg button,.track-tabs button,.btn,.mini,.del')){const r=el.getBoundingClientRect();if(r.height<out.tapMin){out.tapMin=r.height;out.tapWorst=v+':'+el.className+':'+el.textContent.trim().slice(0,20);}}
     if(el.matches('svg.chart-svg,svg.gauge-svg')){out.charts++;if(el.getAttribute('role')==='img'&&(el.getAttribute('aria-label')||'').length>8)out.aria++;const r=el.getBoundingClientRect(),vb=el.viewBox.baseVal;if(r.width>0)out.scale.push(+(r.width/vb.width).toFixed(2));}});}}
  const c=document.querySelector('.chk');out.chkHit=c?getComputedStyle(c,'::after').top:'none';
  out.nav=parseFloat(getComputedStyle(document.querySelector('nav.tabs .tab span')).fontSize);return out;});
 T('Z charts: every chart text renders at 10.5 px or more on a 390 px phone (the roadmap and gauge were ~4-5 px)',m.svgMin>=10.5,m.svgMin.toFixed(2)+' '+m.svgWorst);
 T('Z charts: drawn at true scale (rendered width within 15% of the drawing width) and every chart is labelled for screen readers',m.scale.length>=5&&m.scale.every(x=>x>=0.85&&x<=1.15)&&m.aria===m.charts,JSON.stringify({scale:m.scale,aria:m.aria,charts:m.charts}));
 T('Z text floor: no text below 9.5 px anywhere in the eight views; tab labels 10 px',m.views===8&&m.htmlMin>=9.5&&m.nav>=10,m.htmlMin+' '+m.htmlWorst+' nav '+m.nav);
 T('Z targets: buttons, segments, track tabs, set buttons and delete icons are at least 36 px tall; the set tick has a 42 px hit area',m.tapMin>=36&&m.chkHit==='-7px',m.tapMin+' '+m.tapWorst+' chk '+m.chkHit);
 await q.evaluate(()=>switchView('roadmap'));await wait(150);
 const rm=await q.evaluate(()=>{const svg=document.querySelector('#rmChart svg');const t=[...svg.querySelectorAll('text')].map(x=>x.textContent);const ys=t.filter(x=>/^\d+$/.test(x)).map(Number);const xs=t.filter(x=>!/^\d+$/.test(x));const st=ys[1]-ys[0];
  return {ys,xs,round:ys.length>=3&&ys.every((y,i)=>i===0||y-ys[i-1]===st)&&ys.every(y=>y%st===0),legend:document.getElementById('rmChart').innerText};});
 T('Z roadmap: round-number weight ticks, month-and-year dates across the three calendar years, and a legend for the lines and dots',rm.round&&rm.xs.length>=3&&rm.xs.every(x=>/^[A-Z][a-z]{2} ’\d\d$/.test(x))&&/FFMI 25 band: ~\d+–\d+ kg \(18–24%\)/.test(rm.legend)&&/March milestone/.test(rm.legend)&&/re-test/.test(rm.legend),JSON.stringify(rm));
 const ft=await q.evaluate(()=>document.getElementById('view-home').innerText);T('Z fast-track header: one dash, not two',/Fastest way to the 3\.3 kg — by \d+ [A-Z][a-z]{2} \d{4}/.test(ft)&&!/— —/.test(ft),(ft.match(/Fastest way[^\n]*/)||[''])[0]);
 await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_weight:[{date:'2026-09-19',v:88.2},{date:'2026-09-25',v:88.8}],cb2_measure:[{date:'2026-09-12',waist:92,neck:39},{date:'2026-09-26',waist:92.4,neck:39}]});
 await q.evaluate(()=>switchView('track'));await wait(200);
 await q.evaluate(()=>document.querySelector('[data-delw="2026-09-25"]').click());await wait(150);
 const a=await q.evaluate(()=>({n:DB.weight.length,undo:!!document.querySelector('#toast.show .undo'),clickable:getComputedStyle(document.getElementById('toast')).pointerEvents}));
 await q.evaluate(()=>(document.querySelector('#toast .undo')||{click(){}}).click());await wait(150);
 const b2=await q.evaluate(()=>({n:DB.weight.length,ls:JSON.parse(localStorage.getItem('cb2_weight')).length,row:/88\.8/.test(document.getElementById('wList').innerText),toast:document.getElementById('toast').innerText}));
 await q.evaluate(()=>{document.querySelector('.track-tabs button[data-tp="measure"]').click();(document.querySelector('[data-delme="2026-09-26"]')||{click(){}}).click();});await wait(150);
 const c1=await q.evaluate(()=>DB.measure.length);await q.evaluate(()=>(document.querySelector('#toast .undo')||{click(){}}).click());await wait(150);const c2=await q.evaluate(()=>({n:DB.measure.length,ls:JSON.parse(localStorage.getItem('cb2_measure')).length}));
 T('Z undo: deleting a weigh-in or a tape entry offers Undo, and Undo restores it on screen and in storage',a.n===1&&a.undo&&a.clickable==='auto'&&b2.n===2&&b2.ls===2&&b2.row&&/Restored/.test(b2.toast)&&c1===1&&c2.n===2&&c2.ls===2,JSON.stringify({a,b2,c1,c2}));
 await done(q);}
// K13 (27 Sep 2026): touch a chart to read any point. Driven with the real mouse; keyboard via focus + arrow keys.
{const q=await ctxPage('2026-09-26',{cb2_weight:[{date:'2026-09-12',v:88},{date:'2026-09-19',v:88.4},{date:'2026-09-25',v:88.8}]});await q.setViewport({width:390,height:844});await q.evaluate(()=>switchView('track'));await wait(250);
 const at=(sel,pick)=>q.evaluate((sel,pick)=>{const s=document.querySelector(sel);s.scrollIntoView({block:'center'});const T=_tips[s.dataset.tip];const i=typeof pick==='string'?T.d.indexOf(pick):Math.round((T.x.length-1)*pick);const b=s.getBoundingClientRect(),k=b.width/s.viewBox.baseVal.width;return {x:b.left+T.x[i]*k,y:b.top+b.height/2};},sel,pick);
 const read=sel=>q.evaluate(sel=>{const s=document.querySelector(sel);if(!s)return {r:'no chart'};return {r:document.getElementById(s.dataset.tip+'r').innerText.trim(),vis:s.querySelector('.ctip').getAttribute('visibility'),dots:s.querySelectorAll('.ctip-d circle').length};},sel);
 const W='#wChart svg[data-tip]';const h0=await read(W);let p=await at(W,'19 Sep');await q.mouse.click(p.x,p.y);await wait(80);const a=await read(W);
 await q.evaluate(sel=>{const e=document.querySelector(sel);if(e&&e.focus)e.focus();},W);await q.keyboard.press('ArrowLeft');await wait(50);const k=await read(W);
 await q.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));await wait(50);const c=await read(W);
 T('Z readout: touching the weight chart reads that day, arrow keys step back a day, a tap elsewhere clears',/Touch the chart/.test(h0.r)&&h0.vis==='hidden'&&a.r==='19 Sep · 88.4 kg'&&a.vis==='visible'&&a.dots===1&&k.r==='12 Sep · 88.0 kg'&&/Touch the chart/.test(c.r)&&c.vis==='hidden',JSON.stringify({h0,a,k,c}));
 await q.evaluate(()=>switchView('roadmap'));await wait(250);const RM='#rmChart svg[data-tip]';p=await at(RM,0.25);await q.mouse.click(p.x,p.y);await wait(80);const rm=await read(RM);
 const E='#view-roadmap .card svg[data-tip]';p=await at(E,0.25);await q.mouse.click(p.x,p.y);await wait(80);const eta=await read(E);
 const fits=await q.evaluate(()=>{let over=0;document.querySelectorAll('#view-roadmap svg[data-tip]').forEach(s=>{const T=_tips[s.dataset.tip],r=document.getElementById(s.dataset.tip+'r');for(let i=0;i<T.x.length;i++){tipAt(s,i);if(r.scrollWidth>r.clientWidth+1)over++;}tipClear(s);});return over;});
 T('Z readout: the roadmap reads date, projected weight and phase; the ETA chart reads month and both lean-mass lines; no reading is cut off',/^\d{1,2} [A-Z][a-z]{2} ’\d\d · \d+\.\d kg · \S/.test(rm.r)&&rm.vis==='visible'&&/^[A-Z][a-z]{2} \d{4} · plan \d+\.\d kg · (logged|Max|best) \d+\.\d kg$/.test(eta.r)&&eta.dots===2&&fits===0,JSON.stringify({rm,eta,fits}));
 await q.evaluate(()=>{switchView('home');const t=document.querySelector('#view-home .tool');if(t&&!t.classList.contains('open'))t.querySelector('.tool-h').click();});await wait(200);const F='#view-home .tool svg[data-tip]';p=await at(F,8/30);await q.mouse.click(p.x,p.y);await wait(80);const ft=await read(F);
 T('Z readout: the fast-track chart reads the week and both gains',/^Week 8 · fast \+\d\.\d · tissue \+\d\.\d kg$/.test(ft.r)&&ft.dots===2,JSON.stringify(ft));
 await done(q);}
// K4 (27 Sep 2026): progress photos through the real file chooser; stored in IndexedDB as 1280 px JPEGs; Undo; survive a reload.
{const q=await ctxPage('2026-09-27');const img=path.join(require('os').tmpdir(),'cb-photo-'+process.pid+'.jpg');
 await q.setViewport({width:1000,height:1500,deviceScaleFactor:1});await q.screenshot({path:img,type:'jpeg'});await q.setViewport({width:390,height:844});
 const open=()=>q.evaluate(()=>{switchView('track');document.querySelector('.track-tabs button[data-tp="measure"]').click();});await open();await wait(300);
 const empty=await q.evaluate(()=>document.getElementById('phBody').innerText);
 const pick=async(pose,date)=>{if(date)await q.evaluate(d=>{document.getElementById('meDate').value=d;},date);const t0=await q.evaluate(()=>document.getElementById('toast').innerText);const [fc]=await Promise.all([q.waitForFileChooser({timeout:5000}),q.click('[data-ph="'+pose+'"]')]);await fc.accept([img]);
  // a save takes ~1 s headless (shrink + IndexedDB); wait for its toast, never a fixed sleep
  for(let i=0;i<80;i++){await wait(100);if(await q.evaluate(t0=>{const t=document.getElementById('toast').innerText;return /^(Saved|Replaced) · /.test(t)&&t!==t0;},t0))break;}await wait(300);};
 await pick('front');await pick('side');await pick('front','2026-10-24');
 const r=await q.evaluate(async()=>{const a=await phAll();return {n:a.length,ids:a.map(p=>p.id).join(),type:a[0].blob.type,long:Math.max(a[0].w,a[0].h),figs:document.querySelectorAll('#phBody .ph-cmp figure').length,caps:[...document.querySelectorAll('#phBody figcaption')].map(f=>f.innerText.replace(/\s+/g,' ')),rows:document.querySelectorAll('#phBody .log-row').length,foot:(document.querySelector('#phBody .ph-foot')||{innerText:''}).innerText,imgOk:[...document.querySelectorAll('#phBody .ph-cmp img')].every(i=>i.complete&&i.naturalWidth>0)};});
 T('Z photos: picked through the file chooser, stored on the phone as 1280 px JPEGs; front compares first vs latest; list and storage line',/No photos yet/.test(empty)&&r.n===3&&r.ids==='2026-09-27-front,2026-09-27-side,2026-10-24-front'&&r.type==='image/jpeg'&&r.long===1280&&r.figs===2&&/^First 27 Sep/.test(r.caps[0])&&/^Latest 24 Oct/.test(r.caps[1])&&r.rows===3&&/3 photos · \d+ KB on this phone/.test(r.foot)&&/not in the JSON backup/.test(r.foot)&&r.imgOk,JSON.stringify(r));
 await q.evaluate(()=>(document.querySelector('[data-phdel="2026-09-27-side"]')||{click(){}}).click());await wait(400);const d1=await q.evaluate(async()=>(await phAll()).length);
 await q.evaluate(()=>(document.querySelector('#toast .undo')||{click(){}}).click());await wait(500);const d2=await q.evaluate(async()=>({n:(await phAll()).length,rows:document.querySelectorAll('#phBody .log-row').length}));
 await q.reload({waitUntil:'networkidle0'});await wait(900);await open();await wait(700);const d3=await q.evaluate(async()=>({n:(await phAll()).length,rows:document.querySelectorAll('#phBody .log-row').length}));
 T('Z photos: delete offers Undo, Undo restores it, and photos survive a reload',d1===2&&d2.n===3&&d2.rows===3&&d3.n===3&&d3.rows===3,JSON.stringify({d1,d2,d3}));
 try{fs.unlinkSync(img);}catch(e){}await done(q);}
// ===== AA. Visual audit fixes (27 Sep 2026): 60 findings confirmed by a second agent; the ones that could regress are pinned here =====
{const css=fs.readFileSync(path.join(__dirname,'../src/blueprint.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../src/app_full.js'),'utf8');
 const root=(css.match(/:root\{[^}]*\}/)||[''])[0],defined=new Set([...root.matchAll(/--([\w-]+):/g)].map(m=>m[1])),used=new Set([...(css+js).matchAll(/var\(--([\w-]+)\)/g)].map(m=>m[1]));
 const missing=[...used].filter(v=>!defined.has(v));T('AA tokens: every var(--x) the app uses is defined on :root (--bad was used 8 times and never defined)',missing.length===0,missing.join(','));}
{const q=await ctxPage('2026-09-27');await q.setViewport({width:390,height:844});
 const r=await q.evaluate(()=>{const s=[...document.querySelectorAll('#view-home span')].find(x=>/backup file never made/.test(x.textContent));const bad=getComputedStyle(document.documentElement).getPropertyValue('--bad').trim();const tmp=document.createElement('i');tmp.style.color=bad;document.body.appendChild(tmp);const want=getComputedStyle(tmp).color;tmp.remove();const col=s&&getComputedStyle(s).color;
  const b=()=>[...document.querySelectorAll('#view-home .card')].find(c=>/Coach/.test(c.querySelector('.card-t')?.textContent||''));const n0=[...b().querySelectorAll('.verdict')].map(v=>v.innerText).join('|');
  document.getElementById('qW').value='88.4';quickLogWeight();const n1=[...b().querySelectorAll('.verdict')].map(v=>v.innerText).join('|');
  const hdr=[...document.querySelectorAll('header.app *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>parseFloat(getComputedStyle(e).fontSize));
  const sub=document.querySelector('.brand-txt span'),rg=document.createRange();rg.setStart(sub.firstChild,0);rg.setEnd(sub.firstChild,7);const subFits=rg.toString()==='FFMI 25'&&rg.getBoundingClientRect().right<=sub.getBoundingClientRect().right+0.5;return {subFits,col,want,n0,n1,hdrMin:Math.min(...hdr),sub:sub.textContent};});
 T('AA home: the backup-age warning is red, and the Brief sends the first weigh-in to Quick log, then asks for one more',r.col==='rgb(255, 107, 122)'&&r.col===r.want&&/Quick log above/.test(r.n0)&&/One more weigh-in on another morning/.test(r.n1),JSON.stringify(r));
 T('AA header: no text under 10 px and "FFMI 25" is never cut off (any font)',r.hdrMin>=10&&r.subFits&&/FFMI 25/.test(r.sub),JSON.stringify({m:r.hdrMin,f:r.subFits,s:r.sub}));
 await q.evaluate(()=>document.querySelector('.tab[data-view="lift"]').click());await wait(250);
 const l=await q.evaluate(()=>({pill:(document.querySelector('#dayPills .on')||{}).textContent,visible:(()=>{const w=document.getElementById('dayPills').getBoundingClientRect(),o=document.querySelector('#dayPills .on').getBoundingClientRect();return o.left>=w.left-1&&o.right<=w.right+1;})()}));
 T('AA lift: the tab opens on today (Sun = Push A) with its chip in view',l.pill==='Push A'&&l.visible,JSON.stringify(l));
 const a=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const ex=()=>document.querySelectorAll('#liftBody .ex')[0];const n0=ex().querySelectorAll('.set-row').length;ex().querySelector('[data-add]').click();await W(40);const n1=ex().querySelectorAll('.set-row').length,sess=DB.sessions.length;ex().querySelector('[data-del]').click();await W(40);const n2=ex().querySelectorAll('.set-row').length;
  const r=ex().querySelector('input[data-f="r"]'),w=ex().querySelector('input[data-f="w"]');r.value='6';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='100';w.dispatchEvent(new Event('input',{bubbles:true}));await W(40);ex().querySelector('[data-del]').click();await W(40);const cleared=JSON.stringify(DB.sessions[0]&&DB.sessions[0].entries),hasUndo=!!document.querySelector('#toast .undo');(document.querySelector('#toast .undo')||{click(){}}).click();await W(40);const back=JSON.stringify(DB.sessions[0]&&DB.sessions[0].entries);return {n0,n1,sess,n2,cleared,hasUndo,back};});
 T('AA lift: Add set adds a row without saving an empty session; Remove takes it back; clearing a logged set offers Undo',a.n1===a.n0+1&&a.sess===0&&a.n2===a.n0&&/\[\]/.test(a.cleared)&&a.hasUndo&&/"r":"6"/.test(a.back),JSON.stringify(a));
 await done(q);}
{const q=await ctxPage('2026-09-27',{cb2_loc:'home'});await q.evaluate(()=>switchView('lift'));await wait(200);
 const bad=await q.evaluate(async()=>{const out=[];for(const d of liftDayOrder()){curDay=d;renderDayPills();renderLiftDay();await new Promise(r=>setTimeout(r,20));document.querySelectorAll('#liftBody .ex').forEach(ex=>{const c=ex.querySelector('.chips .chip b'),rows=ex.querySelectorAll('.set-row').length;if(c&&+c.textContent!==rows)out.push(d+' '+ex.querySelector('.ex-n').textContent+' '+c.textContent+'/'+rows);});}return out;});
 T('AA lift home: every exercise card draws as many rows as its sets chip says',bad.length===0,bad.join(', '));await done(q);}
{const q=await ctxPage('2026-09-27',Object.assign({cb2_bulk:'cut'}));const t=await q.evaluate(()=>{let all='';for(const v of ['home','numbers','fuel','guide','roadmap']){switchView(v);all+=document.getElementById('view-'+v).innerText+'\n';}return {plusminus:/\+-|\+−/.test(all),cal:document.getElementById('rCalN').textContent,pro:document.getElementById('rProN').textContent,maint:/maintenance/.test(document.getElementById('rCalN').textContent),dollar:/\$\{/.test(all),eta:/At Cut settings[\s\S]{0,20}Paused/i.test(all)};});
 T('AA cut mode: signed numbers everywhere, the deficit is not called maintenance, protein reads 2.4 g/kg, the ETA shows as paused',!t.plusminus&&/^−\d+ \/ \d+$/.test(t.cal)&&t.pro==='2.4 g/kg'&&!t.maint&&!t.dollar&&t.eta,JSON.stringify(t));await done(q);}
{const r={};for(const d of ['2027-03-05','2027-03-06','2027-03-08','2027-03-20','2027-05-15']){const q=await ctxPage(d);r[d]=await q.evaluate(()=>{const t=document.getElementById('view-home').innerText;const g=gainModel('hyper');return {cta:(document.querySelector('.cta')||{}).textContent||'',check:/Today is the check/.test(t),weekend:/This is the check weekend/.test(t),passed:/check weekend has passed/.test(t),peak:/It is peak week/.test(t),eff:g.eff,rate:+g.rateKgWk.toFixed(2),brief:(t.match(/Fuel:[^\n]*/)||[''])[0]};});await done(q);}
 T('AA milestone weekend: Fri 5 Mar is the check day everywhere; Sat reads as the weekend with no peak card; 8 Mar has passed',/Check day/.test(r['2027-03-05'].cta)&&r['2027-03-05'].check&&r['2027-03-06'].weekend&&!r['2027-03-06'].peak&&r['2027-03-08'].passed,JSON.stringify([r['2027-03-05'],r['2027-03-06'],r['2027-03-08']]));
 T('AA engine: Mini-Cut I runs automatically after the check (20 Mar deficit, labelled Cut), then Maximum (15 May)',r['2027-03-20'].eff==='cut'&&r['2027-03-20'].rate<0&&/\(Cut\)/.test(r['2027-03-20'].brief)&&r['2027-05-15'].eff==='max'&&r['2027-05-15'].rate>0,JSON.stringify([r['2027-03-20'],r['2027-05-15']]));}
{const q=await ctxPage('2026-09-27',JSON.parse('{}'));const t=await q.evaluate(()=>{const rm=buildRoadmap();switchView('guide');const g=document.getElementById('view-guide').innerText;switchView('roadmap');const r=document.getElementById('view-roadmap').innerText;return {w10:rm[9].tags.map(x=>x.t),w26:rm[25].tags.length,rule:(g.match(/A week above [\d.]+ kg of gain/)||[''])[0],want:'A week above '+(gainModel('hyper').rateKgWk*1.6).toFixed(2)+' kg of gain',atMax:/At Maximum/i.test(r),lean:/~90 kg lean max/.test(g),reality:/muscle ceiling is ~\d+ kg lean/.test(r)};});
 T('AA roadmap and Guide: every milestone in a week survives, the Guide quotes the engine\'s own rule, the ETA compares against Maximum, the ceiling is described correctly',t.w10.length===1&&/Re-test/.test(t.w10[0])&&t.w26===3&&t.rule===t.want&&t.atMax&&!t.lean&&t.reality,JSON.stringify(t));await done(q);}
{const q=await ctxPage('2026-09-27',{cb2_sleep:[{date:'2026-09-26',h:7.4},{date:'2026-09-25',h:6.8}]});const t=await q.evaluate(()=>{let all='';for(const v of [...document.querySelectorAll('.tab[data-view]')].map(x=>x.dataset.view)){switchView(v);document.querySelectorAll('#view-'+v+' .tool').forEach(x=>x.classList.add('open'));all+=document.getElementById('view-'+v).innerText;}return {dollar:(all.match(/.{0,30}\$\{.{0,30}/)||[''])[0],sleep:(document.getElementById('view-home').innerText.match(/🛌[^\n]*/)||[''])[0]};});
 T('AA copy: no raw template code anywhere in the eight views (the sleep chip printed "${avg.toFixed(1)}")',!t.dollar&&/wk \d\.\d h/.test(t.sleep),JSON.stringify(t));await done(q);}
// ===== AB. Visual audit fixes, part 2 (27 Sep 2026): Fuel, Events, Track, and the iPhone-only defects =====
{const q=await ctxPage('2026-09-27');const r=await q.evaluate(()=>{switchView('fuel');document.querySelectorAll('#view-fuel .tool').forEach(x=>x.classList.add('open'));const ph=(curPhase==="hyper"||curPhase==="race")?curPhase:"build",m=macros(ph),g=gainModel(ph);const w=document.getElementById('mealPlanWrap').innerText;const kc=MP_DAYS.map(d=>d.meals.reduce((a,x)=>a+x.kc,0));const avg=Math.round(kc.reduce((a,b)=>a+b,0)/kc.length/10)*10;const h=document.getElementById('view-fuel').innerHTML.replace(/<[^>]+>/g,' ');
  return {avg,avgOk:w.includes('~'+avg+' kcal'),title:w.includes('Your Meal Plan — '+modeName(g.eff)),ph:/\{PRO\}|\{CAF\}/.test(h),whey:h.includes('('+m.pro+' g for you)'),caf:h.includes('for you ≈ '+Math.round((parseFloat(DB.profile.weight)||85)*3)+' mg'),runs:(h.match(/\b(long runs?|late-run|runners?|race harder|your runs|short runs|interval endurance)\b/gi)||[]),bicarbTile:/<div class="dn">Bicarbonate/.test(document.getElementById('view-fuel').innerHTML)};});
 T('AB fuel: the meal plan quotes its own average, names the live mode, fills whey and caffeine from your numbers, and reads for a lifter',r.avgOk&&r.title&&!r.ph&&r.whey&&r.caf&&r.runs.length===0&&!r.bicarbTile,JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-27',{cb2_bulk:'cut'});const t=await q.evaluate(()=>{switchView('fuel');return document.getElementById('mealPlanWrap').innerText;});
 T('AB fuel cut: the plan is titled Cut and the scaling advice is a cut instruction, not "drop a snack"',/Your Meal Plan — Cut/.test(t)&&/Cut mode: your target is ~\d+ kcal/.test(t)&&/keep every protein source/.test(t),t.slice(0,300));await done(q);}
{const q=await ctxPage('2026-09-27');await q.setViewport({width:390,height:844});const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));switchView('fuel');await W(400);const seg=()=>document.getElementById('fuelQSeg');window.scrollTo(0,seg().getBoundingClientRect().top+scrollY-300);await W(30);const t0=seg().getBoundingClientRect().top,q0=fuelQ;[...seg().querySelectorAll('[data-q]')].find(x=>x.dataset.q!==fuelQ).click();await W(80);const t1=seg().getBoundingClientRect().top;
  switchView('run');await W(400);const rs=()=>document.getElementById('radiusSeg');window.scrollTo(0,rs().getBoundingClientRect().top+scrollY-200);await W(30);const u0=rs().getBoundingClientRect().top;rs().querySelector('[data-r="45"]').click();await W(80);const u1=rs().getBoundingClientRect().top;return {t0,t1,u0,u1,q0,q1:fuelQ,rad:radiusKm};});
 T('AB fuel/events: Standard/Premium and the radius switch without throwing you back to the top',r.q1!==r.q0&&r.rad===45&&Math.abs(r.t1-r.t0)<=1&&Math.abs(r.u1-r.u0)<=1&&r.t0>200&&r.u0>100,JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-27');const r=await q.evaluate(()=>{switchView('run');const rows=[...document.querySelectorAll('#view-run div[style*="border-left:3px"]')];const bad=[];let blockish=0;
  for(let i=0;i<rows.length;i++){const b=rows[i].querySelector('b');if(b&&getComputedStyle(b).display==='block')blockish++;if(i&&rows[i].parentNode===rows[i-1].parentNode){const k=n=>{const e=RACES_12M.find(x=>x.name===n);return e?String(e.iso||e.ym+'-99'):'';};const a=k(rows[i-1].querySelector('b').textContent),c=k(rows[i].querySelector('b').textContent);if(a>c)bad.push(a+'>'+c);}}
  const out=(([...document.querySelectorAll('#view-run .calc-note')].find(n=>/Just outside/.test(n.textContent))||{}).textContent||'');const kms=(out.match(/~(\d+) km/g)||[]).map(x=>+x.replace(/\D/g,''));
  const cur=document.getElementById('view-run').innerText.match(/Sep 2026 · now[\s\S]{0,160}/);return {n:rows.length,blockish,bad,kms,cur:cur&&cur[0]};});
 T('AB events: names on their own line, each month in date order, "just outside" stays within 15 km of the radius, an emptied month says its events have run',r.n>20&&r.blockish===r.n&&r.bad.length===0&&r.kms.length>0&&r.kms.every(k=>k>30&&k<=45)&&/already run/.test(r.cur||''),JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-27');await q.setViewport({width:390,height:844});const r=await q.evaluate(()=>{const small=[];let txt='';for(const v of [...document.querySelectorAll('.tab[data-view]')].map(x=>x.dataset.view)){switchView(v);document.querySelectorAll('#view-'+v+' .tool').forEach(x=>x.classList.add('open'));if(v==='track')document.querySelectorAll('[data-tp]').forEach(x=>x.click());txt+=document.getElementById('view-'+v).innerHTML.replace(/<[^>]+>/g,' ');
   document.querySelectorAll('#view-'+v+' input,#view-'+v+' select,#view-'+v+' textarea').forEach(e=>{if(/file|checkbox|radio|range|hidden/.test(e.type))return;const f=parseFloat(getComputedStyle(e).fontSize);if(f<16)small.push(v+':'+(e.id||e.tagName)+':'+f);});}
  const hov=[];const walk=(rules,ok)=>{for(const x of rules){if(x.cssRules&&x.conditionText!==undefined)walk(x.cssRules,ok||/hover:\s*hover/.test(x.conditionText));else if(x.selectorText&&/:hover/.test(x.selectorText)&&!ok)hov.push(x.selectorText);}};for(const ss of document.styleSheets){try{walk(ss.cssRules,false);}catch(e){}}
  switchView('track');document.querySelector('[data-tp="weight"]').click();const wd=document.getElementById('wDate'),wv=document.getElementById('wVal');const sel=document.getElementById('lhSel')||document.querySelector('select.sel');
  return {small,hov,inBg:getComputedStyle(wv).backgroundImage,dateBg:getComputedStyle(wd).backgroundImage,selBg:sel&&getComputedStyle(sel).backgroundImage,dateW:Math.round(wd.getBoundingClientRect().width),us:(txt.match(/\b(speciali[sz]ation|program|emphasiz\w*|speciali[z]\w*)\b/g)||[]).filter(w=>/z|program$/.test(w)),tests:/Tested 1-rep max/.test(txt),neck:/Neck and waist together give the body-fat estimate/.test(txt)};});
 T('AB iPhone: every input, select and textarea is 16 px or more (no focus zoom), and no hover style is left without a hover-capable pointer',r.small.length===0&&r.hov.length===0,JSON.stringify({s:r.small,h:r.hov}));
 T('AB track: selects carry a chevron but number and date fields do not; the date field shows a whole date; Tests and Tapes say what they are for',r.inBg==='none'&&r.dateBg==='none'&&/svg/.test(r.selBg||'')&&r.dateW>=140&&r.tests&&r.neck,JSON.stringify({i:r.inBg,d:r.dateBg,s:(r.selBg||'').slice(0,30),w:r.dateW,t:r.tests,n:r.neck}));
 T('AB copy: South African spelling in the app (specialisation, programme, emphasised)',r.us.length===0,r.us.join(','));await done(q);}
{const q=await ctxPage('2026-11-28');const r=await q.evaluate(()=>{switchView('run');const now=[...document.querySelectorAll('#view-run .ev-now')];const plain=[...document.querySelectorAll('#view-run div[style*="border-left:3px"] span')].filter(s=>/^in \d+ days$|^tomorrow$/.test(s.textContent)&&!s.classList.contains('ev-now'));
  switchView('fuel');const it=document.querySelector('#view-fuel .tblk.evening .tblk-items'),cs=it&&getComputedStyle(it);
  return {now:now.map(s=>s.textContent+'|'+getComputedStyle(s).backgroundColor+'|'+!!s.closest('.ev-live')),plain:plain.length,plainBg:plain[0]&&getComputedStyle(plain[0]).backgroundColor,gap:cs&&[cs.marginTop,cs.borderTopWidth]};});
 T('AB events live: "on now" and "today" are filled green chips on a lit card; countdowns stay plain; the 20:00 list keeps its divider after slow protein',r.now.length===2&&r.now.every(x=>/^(on now|today)\|rgb\(66, 215, 125\)\|true$/.test(x))&&r.plain>0&&/rgba\(0, 0, 0, 0\)|transparent/.test(r.plainBg)&&r.gap&&r.gap[0]==='9px'&&r.gap[1]==='1px',JSON.stringify(r));await done(q);}
// ===== AC-engine. Round-2 audit fixes (27 Sep 2026) =====
{const PP="(function(){var W=[];for(var k=0;k<=23;k++){var d=new Date(Date.UTC(2026,8,12+7*k));W.push({date:d.toISOString().slice(0,10),v:Math.round((88+0.4*k)*10)/10});}localStorage.setItem('cb2_weight',JSON.stringify(W));localStorage.setItem('cb2_profile',JSON.stringify({weight:W[W.length-1].v,height:177,age:38,bf:18,day1bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:'55:00',phase:'hyper'}));})();";
 const q=await ctxPage('2027-02-24',{cb2_measure:[{date:'2027-02-20',waist:97,neck:39.5}]},PP);
 const eta=()=>[...document.querySelectorAll('#view-roadmap .card')].find(x=>/How Fast Can You Reach/.test(x.textContent));
 const a=await q.evaluate(()=>({hdr:document.getElementById('cdDays').textContent,hero:((document.querySelector('#view-home .cd-lab')||{}).innerText||''),ban:!!document.querySelector('#view-home .bf-stale button'),est:(estimateBF()||{}).bf}));
 await q.evaluate(()=>switchView('roadmap'));await wait(300);
 const r=await q.evaluate(`(${eta})()&&(()=>{const card=(${eta})();const raw=etaChartSVG(etaModel('max'));return {t:card.innerText,svg:!!card.querySelector('svg[data-tip]'),bad:/Infinity|NaN/.test(card.innerHTML+raw),rawSvg:/<svg/.test(raw),btn:!!card.querySelector('.bf-stale button')};})()`);
 await q.evaluate(`(()=>{const c=(${eta})();const b=c&&c.querySelector('.bf-stale button');if(b)b.click();})()`);await wait(400);
 const u=await q.evaluate(`(()=>{const card=(${eta})();return {bf:DB.profile.bf,ls:JSON.parse(localStorage.getItem('cb2_profile')).bf,hdr:document.getElementById('cdDays').textContent,svg:!!(card&&card.querySelector('svg[data-tip]')),undo:!!document.querySelector('#toast.show .undo'),bad:/Infinity|NaN/.test(card?card.innerHTML:'')};})()`);
 await q.evaluate(()=>(document.querySelector('#toast .undo')||{click(){}}).click());await wait(300);
 const z=await q.evaluate(()=>({bf:DB.profile.bf,hdr:document.getElementById('cdDays').textContent}));
 const rr=r||{t:''};
 T('AC-engine charts-01/cal-10: a typed 18% at 97.2 kg (lean above the ceiling) reads "check body fat" in the header, hero and ETA, draws no chart from a single point, and one tap on the tape estimate saves it with Undo',a.hdr==='check'&&/check/i.test(a.hero)&&a.ban&&/check body fat first/i.test(rr.t)&&!rr.svg&&!rr.bad&&!rr.rawSvg&&rr.btn&&u.bf===a.est&&u.ls===a.est&&/^\+\d/.test(u.hdr)&&u.svg&&u.undo&&!u.bad&&z.bf===18&&z.hdr==='check'&&q.__errs.length===0,JSON.stringify({a,r:{svg:rr.svg,bad:rr.bad,rawSvg:rr.rawSvg,btn:rr.btn,t:String(rr.t).slice(0,120)},u,z,errs:q.__errs.slice(0,2)}));
 await done(q);}
{const q=await ctxPage('2026-09-27',{cb2_profile:{weight:88,height:177,age:38,bf:14,day1bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:'55:00',phase:'hyper'}});
 await q.evaluate(()=>switchView('roadmap'));await wait(250);
 const w=await q.evaluate(()=>{const t=document.getElementById('view-roadmap').innerText;return (t.match(/FFMI 24\.0\s+(\S+)/)||[])[1]||'';});
 await q.evaluate(()=>{switchView('numbers');document.getElementById('pWeight').value='100';document.getElementById('pBf').value='12';document.getElementById('saveProfile').click();});await wait(300);
 const v=await q.evaluate(()=>(document.getElementById('verdict')||{innerText:''}).innerText);
 await q.evaluate(()=>switchView('roadmap'));await wait(250);
 const r=await q.evaluate(()=>{const t=document.getElementById('view-roadmap').innerText,h=document.getElementById('view-roadmap').innerHTML;return {bad:/Infinity|NaN/.test(h),zero:/0\.0 years · 0 months/.test(t),check:/check body fat first/i.test(t)};});
 T('AC-engine num-04: at 88 kg / 14% the passed FFMI 24 waypoint reads "reached"; at 100 kg / 12% no negative room, the verdict says "at or above the drug-free ceiling", and the ETA asks for the body fat instead of "0 months"',w==='reached'&&!/[-−]\d+\.\d points/.test(v)&&/at or above the drug-free ceiling/.test(v)&&!r.bad&&!r.zero&&r.check&&q.__errs.length===0,JSON.stringify({w,v:v.slice(-170),r,errs:q.__errs.slice(0,2)}));await done(q);}
{const q=await ctxPage('2026-09-27');await q.evaluate(()=>switchView('numbers'));await wait(200);
 await q.evaluate(()=>{const g=id=>document.getElementById(id);if(!g('scanApply'))return;g('scanKind').value='DEXA';g('scanBf').value='22';g('scanBf').dispatchEvent(new Event('input',{bubbles:true}));g('scanDate').value='2026-09-14';g('scanApply').click();});await wait(400);
 const n=await q.evaluate(()=>document.getElementById('view-numbers').innerText);
 await q.evaluate(()=>switchView('roadmap'));await wait(250);
 const r=await q.evaluate(()=>{const t=document.getElementById('view-roadmap').innerText;const row=+((t.match(/soft milestone[\s\S]{0,80}?([\d.]+) kg lean/)||[])[1]);const em=marchModel(),mo=Math.round(dayDiff(todayISO(),MILESTONE_ISO)/30.4),cur=etaModel('aggr');return {d1:day1BF(),row,model:+em.pts[Math.min(em.mo,em.pts.length-1)].lean.toFixed(1),curve:+cur.pts[Math.min(mo,cur.pts.length-1)].lean.toFixed(1)};});
 T('AC-engine num-02: a DEXA dated in the Day-1 week (14 Sep) becomes the Day-1 body fat, so the March lean row sits on the curve (within 1 kg) instead of the typed 18%',r.d1===22&&Math.abs(r.row-r.model)<0.06&&Math.abs(r.row-r.curve)<1&&r.row<74,JSON.stringify(r));
 T('AC-engine num-07: after a DEXA with no tape logged, Numbers credits the scan instead of calling body fat "a typed number"',/Body fat 22% from your DEXA \(14 Sep\)/.test(n)&&!/still a typed number/.test(n),(n.match(/Body fat[^\n]{0,120}/)||[''])[0]);
 await done(q);}
{const r={};for(const d of ['2027-10-06','2028-05-20','2028-07-01']){const q=await ctxPage(d);r[d]=await q.evaluate(()=>{const g=gainModel('hyper'),m=macros('hyper');switchView('home');const brief=(document.getElementById('view-home').innerText.match(/Fuel:[^\n]*/)||[''])[0];switchView('fuel');const fuel=(document.getElementById('view-fuel').innerText.match(/Your Meal Plan — \S+/)||[''])[0];switchView('numbers');const num=((document.getElementById('gainOut')||{}).innerText||'')+' | '+((document.getElementById('calNote')||{}).innerText||'');return {ph:rmPhaseNow().phase,eff:effMode(),rate:+g.rateKgWk.toFixed(2),surplus:m.surplus,brief,fuel,num:num.replace(/\s+/g,' ')};});await done(q);}
 const q=await ctxPage('2027-10-06',{cb2_bulk:'max'});const man=await q.evaluate(()=>({eff:effMode(),rate:gainModel('hyper').rateKgWk}));await done(q);
 const A=r['2027-10-06'],B=r['2028-05-20'],C=r['2028-07-01'];
 T('AC-engine cal-01: after Mini-Cut I, Aggressive follows the roadmap: Mini-Cut II and Polish Cut run the cut, Maintain runs maintenance, and Home, Fuel and Numbers name it; a manual Maximum stays Maximum',A.ph==='Mini-Cut II'&&A.eff==='cut'&&A.rate<0&&/\(Cut\)/.test(A.brief)&&/— Cut/.test(A.fuel)&&/Mini-Cut II \(automatic\)/.test(A.num)&&B.ph==='Polish Cut'&&B.eff==='cut'&&B.rate<0&&C.ph==='Maintain & Reassess'&&C.eff==='maintain'&&C.rate===0&&C.surplus===0&&/\(Maintain\)/.test(C.brief)&&/— Maintain/.test(C.fuel)&&/Maintenance:/.test(C.num)&&man.eff==='max'&&man.rate>0,JSON.stringify({A:{...A,num:A.num.slice(0,160)},B:{...B,num:''},C:{...C,num:C.num.slice(0,160)},man}));}
{const q=await ctxPage('2028-09-20',{cb2_sessions:[S('2028-09-16','legsA',{ga1:sets([[8,100],[8,100]])}),S('2028-09-17','pushA',{pa1:sets([[8,80]])})],cb2_weight:[{date:'2028-09-10',v:95.4},{date:'2028-09-16',v:95},{date:'2028-09-19',v:95.2}]});
 const a=await q.evaluate(()=>{const t=document.getElementById('view-home').innerText;switchView('roadmap');const rm=document.getElementById('view-roadmap').innerText;return {wk:planWeek(),hdr:document.getElementById('cdWeek').textContent,lifts:sessionsThisWeek().lifts,eyebrow:(t.match(/This Week — [^\n]*/i)||[''])[0],review:/Weekly Review — Week 106/i.test(t),done:/Plan complete/.test(t)&&/Plan complete/.test(rm),eff:effMode(),rate:gainModel('hyper').rateKgWk,wi:weeklyReview().wi};});
 T('AC-engine cal-09: after week 104 the week keeps counting (W106): counters and the Weekly Review read the new logs, Home and Roadmap say the plan is complete, and Aggressive holds maintenance',a.wk===106&&a.hdr==='W106'&&a.lifts===2&&/Week 106/i.test(a.eyebrow)&&a.review&&a.done&&a.eff==='maintain'&&a.rate===0&&a.wi===2,JSON.stringify(a));await done(q);}
{const q=await ctxPage('2026-09-27');const r=await q.evaluate(async()=>{const out={};for(const k of ['band','edge','mass']){const b=[...document.querySelectorAll('#marchSeg button')].find(x=>x.dataset.mk===k);if(b)b.click();await new Promise(r=>setTimeout(r,250));const seg=document.getElementById('marchSeg');const rows=seg?[...seg.parentElement.querySelectorAll('table tbody tr')].map(tr=>tr.lastElementChild.textContent.trim()):[];out[k]={table:rows,rm:buildRoadmap().filter(w=>w.phase==='Mini-Cut I').length,mt:marchTarget(k).cutWeeks};}return out;});
 T('AC-engine cal-13: the route table prices the same Mini-Cut I the roadmap and the engine run (6 / 8 / 22 weeks)',['band','edge','mass'].every((k,i)=>r[k].table.join()==='6wk,8wk,22wk'&&r[k].rm===[6,8,22][i]&&r[k].mt===r[k].rm),JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-27',{cb2_weight:[{date:'2026-09-13',v:88.2},{date:'2026-09-20',v:88.8},{date:'2026-09-26',v:89.3}]});
 const a=await q.evaluate(()=>({act:(etaActual()||{}).months,aggr:etaModel('aggr').months}));await done(q);
 const q2=await ctxPage('2027-06-15',{cb2_march:'mass'});await q2.evaluate(()=>switchView('roadmap'));await wait(250);
 const b2=await q2.evaluate(()=>{const c=[...document.querySelectorAll('#view-roadmap .card')].find(x=>/How Fast Can You Reach/.test(x.textContent));const t=c?c.innerText:'';const sv=c&&c.querySelector('svg[data-tip]');const s=sv&&_tips[sv.dataset.tip]&&_tips[sv.dataset.tip].s[0];return {t:t.replace(/\s+/g,' ').slice(0,420),flat:s?s.v.slice(0,3):null};});
 T('AC-engine cal-14: the logged rate never projects sooner than the Aggressive best case; during the mass Mini-Cut the ETA says when building resumes ("After the cut", Maximum from 21 Aug) and the settings curve stays flat until then',a.act!=null&&a.act>=a.aggr&&/At Cut settings Paused/i.test(b2.t)&&/After the cut/i.test(b2.t)&&/Maximum from 21 Aug/.test(b2.t)&&!/same as your settings now/i.test(b2.t)&&!!b2.flat&&b2.flat[0]===b2.flat[2],JSON.stringify({a,b2}));await done(q2);}
{const r={};for(const k of ['band','edge','mass']){const q=await ctxPage('2026-09-27',{cb2_march:k});r[k]=await q.evaluate(()=>{const w=buildRoadmap(),st=wk=>+(w[wk-1].bw-w[wk-2].bw).toFixed(2);return {t:marchTarget().kg,w25:w[24].bw,s26:st(26),s27:st(27),peak:Math.max(...w.map(x=>x.bw))};});await done(q);}
 T('AC-engine cal-19: the roadmap runs the route step to the check and Maximum (0.35% a week) in weeks 26–27, as the engine does; mass lands on 110 kg at the check and every route peaks within 0.85 kg of its check weight',['band','edge','mass'].every(k=>Math.abs(r[k].s26-r[k].w25*0.0035)<=0.02&&r[k].s27<=0.4&&r[k].peak<=r[k].w25+0.85)&&Math.abs(r.mass.w25-110)<0.15&&Math.abs(r.edge.w25-r.edge.t)<0.3,JSON.stringify(r));}
{const seed="(function(){var W=[];var t0=Date.UTC(2026,8,12);for(var i=0;i<=209;i+=3){var wk=i/7,v=wk<=27?88+0.42*wk:88+0.42*27-0.5*(wk-27);W.push({date:new Date(t0+i*864e5).toISOString().slice(0,10),v:Math.round(v*10)/10});}localStorage.setItem('cb2_weight',JSON.stringify(W));localStorage.setItem('cb2_profile',JSON.stringify({weight:W[W.length-1].v,height:177,age:38,bf:18,day1bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:'55:00',phase:'hyper'}));})();";
 const q=await ctxPage('2027-04-10',{},seed);await q.evaluate(()=>switchView('track'));await wait(300);
 const r=await q.evaluate(()=>{const sub=(document.getElementById('wSub')||{}).textContent||'';const p=document.querySelector('#wChart path[opacity="0.13"]');const nums=(p?p.getAttribute('d'):'').match(/-?\d+(\.\d+)?/g)||[];const pts=[];for(let i=0;i+1<nums.length;i+=2)pts.push([+nums[i],+nums[i+1]]);const n=pts.length/2,hi=pts.slice(0,n);const arr=[...DB.weight].sort((a,b)=>a.date.localeCompare(b.date));const k=arr.findIndex(x=>x.date>='2027-03-20');return {sub,n,cut:autoCutNow(),yCut:hi[k]&&hi[k][1],yEnd:hi[n-1]&&hi[n-1][1],label:/plan range/.test((document.getElementById('wChart')||{}).innerHTML||'')};});
 T('AC-engine charts-02: during Mini-Cut I the weight band follows the roadmap down (plan range) and the subtitle prints a signed target (−0.xx/wk)',r.cut&&r.n>10&&r.yEnd>r.yCut+2&&r.label&&/target −0\.\d\d\/wk/.test(r.sub)&&!/\+-/.test(r.sub),JSON.stringify(r));await done(q);}
{const q=await ctxPage('2027-01-23',{cb2_weight:[{date:'2026-09-12',v:88},{date:'2027-01-23',v:97.5}],cb2_profile:{weight:97.5,height:177,age:38,bf:18,day1bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:'55:00',phase:'hyper'}});await q.evaluate(()=>switchView('numbers'));await wait(250);
 const r=await q.evaluate(()=>({t:(document.getElementById('gainOut')||{}).innerText||'',pct:(gainModel('hyper').ratePctWk*100).toFixed(2),ov:marchRateOverride()}));
 T('AC-engine num-03: the gain card states the rate the engine runs (not a fixed 0.48%) and says the band route has slowed it',r.ov!=null&&!/0\.48% of bodyweight/.test(r.t)&&r.t.includes(r.pct+'% of bodyweight a week (slowed to what the band route still needs)'),JSON.stringify({pct:r.pct,ov:r.ov,t:(r.t.match(/Aggressive[^\n]{0,260}/)||[''])[0]}));await done(q);}
// ===== AC-plan. Round-2 audit fixes (27 Sep 2026) =====
{const q=await ctxPage('2027-03-10');const r=await q.evaluate(()=>{switchView('home');const h=document.getElementById('view-home'),t=h.innerText;const nm=[...h.querySelectorAll('.card')].find(c=>/Milestone/.test((c.querySelector('.card-t')||{}).textContent||''));return {passed:/The check weekend has passed/.test(t),res:!!document.getElementById('marchResult'),seg:!!document.getElementById('marchSeg'),fast:/Fastest way|Fast track/.test(t),base:/Baseline tapes \d\/4|Log baseline tapes now/.test(t),ontrack:/looks like that weekend/.test(t),needs:/route itself needs/.test(t),phase:((document.getElementById('phaseNow')||{}).innerText||'').replace(/\s+/g,' '),nm:nm?nm.innerText.replace(/\s+/g,' '):''};});
 T('AC-plan March result (10 Mar): logged against targets, no route table, fast track, baseline nag or "that weekend" note; Home names the live phase and Mini-Cut I; the passed check is not the next milestone',r.passed&&r.res&&!r.seg&&!r.fast&&!r.base&&!r.ontrack&&!r.needs&&/^Now: .+ · week \d+ of \d+\. The engine runs \w+ at [+−]\d\.\d\d kg\/week \(automatic under Aggressive\)\./.test(r.phase)&&/Mini-Cut I/.test(r.phase)&&/^This Week’s Milestone/.test(r.nm)&&!/Soft milestone/.test(r.nm)&&/Re-test/.test(r.nm),JSON.stringify(r));await done(q);}
{const q=await ctxPage('2027-03-24');const r=await q.evaluate(()=>{switchView('home');const t=document.getElementById('view-home').innerText;const pn=document.getElementById('phaseNow');const o={card:/Soft milestone — 5–7/.test(t),fast:/Fastest way|Fast track/.test(t),phase:pn?pn.innerText.replace(/\s+/g,' '):'',h:pn?Math.round(pn.getBoundingClientRect().height):0};switchView('numbers');o.scan=((document.getElementById('scanCard')||{}).textContent||'').match(/One scan[^.]*\./)||'';o.scan=String(o.scan);return o;});
 T('AC-plan after the result window (24 Mar): the March card is gone and one short line names Mini-Cut I and what the engine runs; the scan note no longer asks for March',!r.card&&!r.fast&&/^Now: Mini-Cut I · week \d of 6\. The engine runs Cut at −0\.\d\d kg\/week/.test(r.phase)&&r.h>0&&r.h<140&&!/in March/.test(r.scan)&&/end of each cut/.test(r.scan),JSON.stringify(r));await done(q);}
{const r={};for(const d of ['2026-09-12','2026-10-10','2026-12-20']){const q=await ctxPage(d);r[d]=await q.evaluate(()=>{switchView('home');const h=document.getElementById('view-home');const t=h.innerText;const tool=[...h.querySelectorAll('.tool')].find(x=>/Fastest way/.test(x.textContent));return {head:(t.match(/Fastest way[^\n]*/)||[''])[0],now:!!(tool&&[...tool.querySelectorAll('svg text')].some(x=>x.textContent==='now')),day1:!!(tool&&[...tool.querySelectorAll('svg text')].some(x=>x.textContent==='Day 1')),line:((document.getElementById('fastTrack')||{}).innerText||''),cross:fastTrackModel().crossISO};});await done(q);}
 T('AC-plan fast track anchored to Day 1: "by 7 Nov 2026" on 12 Sep and on 10 Oct (with a now marker on a Day-1 axis); after the date it is a one-line result, not a sliding "in 8 weeks"',r['2026-09-12'].head.includes('by 7 Nov 2026')&&r['2026-10-10'].head.includes('by 7 Nov 2026')&&r['2026-10-10'].now&&r['2026-10-10'].day1&&!/in \d+ weeks/.test(r['2026-10-10'].head)&&!r['2026-12-20'].head&&/modelled by 7 Nov 2026/.test(r['2026-12-20'].line)&&r['2026-12-20'].cross==='2026-11-07',JSON.stringify(r));}
{const q=await ctxPage('2026-09-27',{cb2_bulk:'cut'});const r=await q.evaluate(()=>{switchView('home');const t=document.getElementById('view-home').innerText;const o={st:(t.match(/weeks away[^\n]*/)||[''])[0],fast:((document.getElementById('fastTrack')||{}).innerText||''),tool:/Fastest way/.test(t),eng:(t.match(/Engine is in Cut[^\n]*/)||[''])[0]};switchView('fuel');const f=document.getElementById('view-fuel').textContent;o.fuel=/Built to hit your cut target/.test(f)&&!/grow fast/.test(f);o.rules=/Eat in a controlled deficit, not a crash/.test(f)&&/Carbs fuel the lifting/.test(f)&&!/Carbs are your friend on a bulk/.test(f);switchView('numbers');o.sub=(document.getElementById('macroSt')||{}).textContent||'';return o;});
 T('AC-plan Cut mode: the March card promises no automatic step-down, the fast track is paused, the engine line has a true minus, Fuel and Numbers speak of a deficit',/Cut runs until you change it in Numbers/.test(r.st)&&!/Aggressive settings hold/.test(r.st)&&/paused while you cut/.test(r.fast)&&!r.tool&&/Engine is in Cut: −0\.\d\d kg\/week/.test(r.eng)&&r.fuel&&r.rules&&/controlled deficit/.test(r.sub),JSON.stringify(r));await done(q);}
{const r={};for(const m of ['lean','aggr']){const q=await ctxPage('2026-09-27',{cb2_bulk:m});r[m]=await q.evaluate(()=>{const t=document.getElementById('view-home').innerText;return {v:(t.match(/Band-max:[^\n]*/)||[''])[0],st:(t.match(/weeks away[^\n]*/)||[''])[0]};});await done(q);}
 T('AC-plan route verdict: in Lean the engine holds the Lean rate and no waist brake is claimed; Aggressive names the route cut length',/engine holds the Lean rate/.test(r.lean.v)&&!/trips that brake/.test(r.lean.v)&&/Lean runs until you change it/.test(r.lean.st)&&/Mini-Cut I \(6 weeks on this route\)/.test(r.aggr.st),JSON.stringify(r));}
{const r={};for(const k of ['band','edge','mass']){const q=await ctxPage('2026-09-27',{cb2_march:k});r[k]=await q.evaluate(()=>{switchView('roadmap');const p=[...document.querySelectorAll('#rmPhases .rwh-meta p')];const rc=[...document.querySelectorAll('#view-roadmap .note.gold')].map(n=>n.innerText).find(x=>/Reality check/.test(x))||'';return {p3:p[2]?p[2].innerText:'',nw:p[2]?/white-space:nowrap">\d+-week cut<\/span>/.test(p[2].innerHTML):false,rc};});await done(q);}
 T('AC-plan roadmap follows the route: Mini-Cut I reads 6 / 8 / 22 weeks (kept on one line), and the Reality check puts the edge and 110 kg peaks above the band, with no "lean 110 kg" line on the 110 route',/6-week cut/.test(r.band.p3)&&/8-week cut/.test(r.edge.p3)&&/22-week cut/.test(r.mass.p3)&&r.mass.nw&&/inside that band/.test(r.band.rc)&&/kg above that band/.test(r.mass.rc)&&!/inside that band/.test(r.mass.rc)&&!/lean 110 kg/.test(r.mass.rc)&&/kg above that band/.test(r.edge.rc)&&/8 weeks to bring it back/.test(r.edge.rc),JSON.stringify(r));}
{const r={};for(const k of ['mass','band']){const q=await ctxPage('2026-09-27',{cb2_march:k});r[k]=await q.evaluate(()=>{switchView('numbers');const n=document.getElementById('gainOut').innerText;switchView('guide');const notes=[...document.querySelectorAll('#view-guide .calc-note')].map(x=>x.innerText);const g=notes.find(x=>/Aggressive mode — the top of the legal dial/.test(x))||'';const reach=notes.find(x=>/What reaches it/.test(x))||'';switchView('lift');const l=[...document.querySelectorAll('#rulesTool .note')].map(x=>x.textContent).find(x=>/^Aggressive mode/.test(x))||'';return {rate:(gainModel('hyper').ratePctWk*100).toFixed(2),n:(n.match(/Aggressive \(to the[^\n]*/)||[''])[0],g,reach:(reach.match(/300–500 kcal surplus \([^)]*\)/)||[''])[0],l};});await done(q);}
 const m=r.mass,b2=r.band;
 T('AC-plan 110 kg route: Numbers, the Guide and the Lift rules quote the route (its own rate, 22-week cut, brake off), not the band route (0.48%, +5 cm, a switch in Fuel)',m.n.includes(m.rate+'% of bodyweight')&&/22 weeks/.test(m.n)&&/Waist brake: off/.test(m.n)&&!/0\.48%/.test(m.n+m.g)&&/22-week Mini-Cut I/.test(m.g)&&!/never leaves the band/.test(m.g)&&!/\+5 cm/.test(m.g+m.l)&&/off on the 110 kg route/.test(m.l)&&!/switches off in Fuel/.test(m.l)&&/step down to Maximum in Numbers/.test(m.l)&&/110 kg route runs Aggressive/.test(m.reach),JSON.stringify(m));
 T('AC-plan band route keeps its own words: 6-week cut, +5 cm brake, "sits at the edge"',/6 weeks/.test(b2.n)&&/\+5 cm from baseline, the band itself/.test(b2.n)&&/6-week Mini-Cut I/.test(b2.g)&&/never leaves the band/.test(b2.g)&&/\+5 cm from baseline by March/.test(b2.l)&&/sits at the edge until March/.test(b2.reach),JSON.stringify(b2));}
{const q=await ctxPage('2027-06-15',{cb2_march:'mass'});const r=await q.evaluate(()=>{switchView('numbers');const o={eff:effMode(),st:(document.getElementById('macroSt')||{}).textContent||'',cn:document.getElementById('calNote').textContent};switchView('fuel');const f=document.getElementById('view-fuel').textContent;o.plan=/Built to hit your cut target/.test(f)&&!/grow fast/.test(f);o.rules=(f.match(/Eat in a controlled[^.]*\.[^.]*\.[^.]*\./)||[''])[0];o.carbs=/Carbs are your friend on a bulk/.test(f);return o;});
 T('AC-plan cut copy (110 kg route, 15 Jun 2027, week 13 of the 22-week cut): Numbers says deficit and counts the cut weeks; Fuel says cut target and controlled deficit, no bulking lines',r.eff==='cut'&&/controlled deficit/.test(r.st)&&/Mini-Cut I: week 13 of 22/.test(r.cn)&&!/Four to six weeks/.test(r.cn)&&r.plan&&/controlled deficit, not a crash\. Aim for −0\.\d\d kg\/week/.test(r.rules)&&!r.carbs,JSON.stringify(r));await done(q);}
{const W=[];for(let i=0;i<=27;i++){W.push({date:new Date(Date.UTC(2026,8,12)+i*7*86400000).toISOString().slice(0,10),v:+(88+i*0.4).toFixed(1)});}[['2027-03-24',98.6],['2027-03-27',98.4],['2027-03-31',98.1],['2027-04-03',97.9],['2027-04-07',97.6]].forEach(([date,v])=>W.push({date,v}));
 const M=[{date:'2026-09-12',waist:86},{date:'2027-03-13',waist:91},{date:'2027-03-20',waist:91},{date:'2027-04-03',waist:90.2}];const r={};
 for(const d of ['2027-03-24','2027-04-07']){const q=await ctxPage(d,{cb2_weight:W.filter(x=>x.date<=d),cb2_measure:M.filter(x=>x.date<=d)});r[d]=await q.evaluate(()=>{switchView('numbers');return document.getElementById('gainOut').innerText.replace(/\s+/g,' ');});await done(q);}
 const a=r['2027-03-24'],z=r['2027-04-07'];
 T('AC-plan Mini-Cut I trend: only the cut’s own weigh-ins count (no "gaining faster", no "keep pushing aggressively" from the bulk before it); two weeks in it reads the loss against the deficit with true minus signs',/Cut trend:/.test(a)&&/since Mini-Cut I began \(20 Mar\)/.test(a)&&!/gaining faster than target|Keep pushing aggressively|Textbook lean gain/.test(a)&&/On track for the cut \(−0\.\d\d kg\/wk vs −0\.\d\d target\)/.test(z)&&/waist since Mini-Cut I began \(20 Mar\): coming down \(−0\.\d\d cm\/wk\)/.test(z)&&!/-0\./.test(a+z),JSON.stringify(r));}
{const LB=[];let v=88;for(let i=0;i<13;i++){if(i>0)v+=(i<=10?0.85:0.35);LB.push({date:new Date(Date.UTC(2026,8,12)+i*7*86400000).toISOString().slice(0,10),v:+v.toFixed(1)});}
 const MS=[{date:'2026-09-12',waist:86},{date:'2026-12-04',waist:90.2}];const r={};
 for(const m of ['balanced','aggr']){const q=await ctxPage('2026-12-05',{cb2_bulk:m,cb2_weight:LB,cb2_measure:MS});r[m]=await q.evaluate(()=>{switchView('home');return (document.getElementById('view-home').innerText.match(/Lean target banked[^\n]*|Waist is \+[^\n]*/)||[''])[0];});await done(q);}
 T('AC-plan lean target banked fires in every building mode (Balanced no longer hits the +3 cm brake first); in Aggressive it offers the cut or the hold to March',/^Lean target banked/.test(r.balanced)&&/cut can start now: switch Numbers to Cut/.test(r.balanced)&&/cut can start now \(switch Numbers to Cut for 4–6 weeks\), or hold Aggressive to 5–7 March/.test(r.aggr),JSON.stringify(r));}
{const q=await ctxPage('2026-10-09',{cb2_weight:[{date:'2026-09-26',v:90},{date:'2026-09-29',v:90},{date:'2026-10-03',v:89.8},{date:'2026-10-06',v:89.8}]});const t=await q.evaluate(()=>{switchView('home');return (document.getElementById('view-home').innerText.match(/(Losing|Gaining only)[^\n]*target[^\n]*/)||[''])[0];});
 T('AC-plan Weekly Review: a loss against a gain target reads "Losing 0.20 kg/week against a +0.xx target", no hyphen-minus',/^Losing 0\.20 kg\/week against a \+0\.\d\d target/.test(t)&&!/-0\./.test(t),t);await done(q);}
{const q=await ctxPage('2027-03-01');const r=await q.evaluate(()=>{switchView('home');const pc=document.getElementById('peakCompact'),mc=document.getElementById('marchCard');const rows=pc?[...pc.querySelectorAll('span')].filter(s=>/flex:0 0 96px/.test(s.getAttribute('style')||'')):[];const o={pc:!!pc,rows:rows.length,first:rows[0]?rows[0].textContent:'',above:!!(pc&&mc&&pc.getBoundingClientRect().top<mc.getBoundingClientRect().top),full:!!document.querySelector('#view-home #peakFull'),h:pc?Math.round(pc.getBoundingClientRect().height):0,peak:/It is peak week/.test(document.getElementById('view-home').innerText)};const b=pc&&[...pc.querySelectorAll('button')].find(x=>/Full protocol/.test(x.textContent));if(b)b.click();o.guide=!!document.querySelector('#view-guide.active #peakFull');return o;});await done(q);
 const q2=await ctxPage('2027-06-15');const g=await q2.evaluate(()=>{switchView('guide');return /Peak Week — arrive as big as possible/.test(document.getElementById('view-guide').innerText);});await done(q2);
 T('AC-plan peak week: Home shows only today’s step (one row, above the March card) with a link to the full protocol in the Guide; the Guide drops the card after March',r.pc&&r.peak&&r.rows===1&&/^D-7/.test(r.first)&&r.above&&!r.full&&r.h>0&&r.h<420&&r.guide&&!g,JSON.stringify([r,g]));}
{const q=await ctxPage('2027-03-06');const k=await q.evaluate(()=>{switchView('home');const tb=document.querySelector('#view-home table tbody');return tb?[...tb.querySelectorAll('tr')].map(tr=>tr.children[6]?+tr.children[6].textContent:0):[];});
 T('AC-plan check weekend: the route table prices each route from Day 1, not 0 kcal',k.length===3&&k.every(v=>v>0),JSON.stringify(k));await done(q);}
// ===== AC-coach. Round-2 audit fixes (27 Sep 2026) =====
{const DEMO=fs.readFileSync(path.join(__dirname,'fixtures/demo.setup.js'),'utf8').trim().split('\n').pop();const ERR=[];const fin=async q=>{ERR.push(...q.__errs);await done(q);};
 const addD=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const EX={legsA:'ga1',pushA:'pa1',pullA:'la1',legsB:'gb1',pushB:'pb1',pullB:'lb1',extras:'x1'},ORD=['legsA','pushA','pullA','legsB','pushB','pullB','extras'];
 const week=(sat,days,w)=>days.map((d,i)=>d?S(addD(sat,i),d,{[EX[d]]:sets([[8,w||100],[8,w||100],[8,w||100]])}):null).filter(Boolean); // one plan week from its Saturday; null = skipped
 const WSER=(from,to,v0,perWk)=>{const o=[];let d=from,i=0;while(d<=to){o.push({date:d,v:+(v0+perWk*i/7).toFixed(2)});d=addD(d,1);i++;}return o;};
 const PROF=ph=>({weight:88,height:177,age:38,bf:18,goal:102.3,goalBf:24,act:1.55,phase:ph});
 const H=q=>q.evaluate(()=>{const h=document.getElementById('view-home');if(!h)return {};const card=re=>{const c=[...h.querySelectorAll('.card')].find(c=>re.test((c.querySelector('.card-t')||{}).textContent||''));return c?c.textContent.replace(/\s+/g,' '):'';};
   return {cta:((h.querySelector('.cta')||{}).textContent||'').trim(),title:(h.querySelector('.tb-title')||{}).textContent||'',today:(h.querySelector('.today-body')||{}).textContent||'',comp:(h.querySelector('.compbar .cc-v')||{}).textContent||'',brief:card(/Coach/),review:card(/Weekly Review/),strip:[...h.querySelectorAll('.weekstrip .wd')].map(x=>x.textContent).join(' '),all:h.textContent};});
 // coach-01: attendance counts the sessions due so far, not six
 {const q=await ctxPage('2026-10-01',{cb2_sessions:week('2026-09-26',['legsA','pushA','pullA','legsB','pushB'])});const a=await H(q);const r=await q.evaluate(()=>({due:sessionsThisWeek().due,v:weeklyReview().verdict}));
  await q.evaluate(()=>{DB.sessions=DB.sessions.filter(x=>x.dateISO!=='2026-09-30');renderHome();});const b2=await H(q);
  T('AC coach-01 attendance: on schedule on Thursday (5 of 5 due) reads on track; one missed session reads "4 of 5 due before today"',r.due===5&&!/attendance/.test(r.v)&&a.comp==='5/6'&&/4 of 5 sessions due before today/.test(b2.review),JSON.stringify({r,c:a.comp,v:(b2.review||'').slice(0,240)}));await fin(q);}
 {const q=await ctxPage('2027-03-05',{cb2_sessions:week('2027-02-27',['legsA','pushA','pullA',null,'pushB','extras'])});const a=await H(q);const r=await q.evaluate(()=>({v:weeklyReview().verdict,s:sessionsThisWeek()}));
  T('AC coach-01 peak week done as prescribed (legs off on D-3, the D-1 pump for Pull B): check day reads 5/5 with no attendance verdict',r.s.planned===5&&r.s.lifts===5&&a.comp==='5/5'&&!/attendance/.test(r.v),JSON.stringify({s:r.s,c:a.comp,v:r.v}));await fin(q);}
 // coach-11: the Friday pump is not a lift
 {const q=await ctxPage('2026-09-25',{cb2_sessions:week('2026-09-19',ORD)});const a=await H(q);
  await q.evaluate(()=>{DB.sessions=DB.sessions.filter(x=>x.day!=='pullB');renderHome();});const b2=await H(q);
  T('AC coach-11 the Friday pump is not a lift: a full week reads 6/6 (was 7/6); skip Pull B and do the pump, and it reads 5/6 with the attendance verdict',a.comp==='6/6'&&/Sessions\s*6\s*of 6/.test(a.review)&&b2.comp==='5/6'&&/5 of 6 sessions due before today/.test(b2.review),JSON.stringify({a:a.comp,b:b2.comp,v:(b2.review||'').slice(0,240)}));await fin(q);}
 // coach-02: the Brief never says "All engines fed" next to a red verdict or on stale data; a Friday sleep verdict makes Friday a rest day everywhere
 {const q=await ctxPage('2026-11-12',{},DEMO);const a=await H(q);
  T('AC coach-02 stale data: weeks without a weigh-in, the Brief asks for one instead of "All engines fed"',/Last weigh-in was \d+ days ago/.test(a.brief)&&/Last waist reading was \d+ days ago/.test(a.brief)&&!/All engines fed/.test(a.brief),(a.brief||'').slice(0,420));await fin(q);}
 {const q=await ctxPage('2026-09-27',{},DEMO+"localStorage.setItem('cb2_measure',JSON.stringify([{date:'2026-09-11',waist:92},{date:'2026-09-26',waist:97.5}]));");const a=await H(q);
  T('AC coach-02 a red verdict: the Brief points at the Weekly Review instead of saying "All engines fed"',/Waist is \+5\.5/.test(a.review)&&/Weekly Review below has one correction/.test(a.brief)&&!/All engines fed/.test(a.brief),JSON.stringify({b:(a.brief||'').slice(-260),r:(a.review||'').slice(0,200)}));await fin(q);}
 {const sl=[];for(let i=1;i<=6;i++)sl.push({date:addD('2026-10-02',-i),h:6});const q=await ctxPage('2026-10-02',{cb2_sessions:week('2026-09-26',ORD.slice(0,6)),cb2_sleep:sl});const a=await H(q);
  T('AC coach-02 sleep verdict on a Friday: Today card, CTA, week strip and Brief all say full rest (no gold pump button)',/^Full Rest/.test(a.title)&&/^Full rest today/.test(a.cta)&&!/Extras pump/.test(a.cta)&&/FriRest/.test(a.strip)&&/Today: Full rest/.test(a.brief)&&/Sleep averaged 6\.0/.test(a.review),JSON.stringify({t:a.title,c:a.cta,s:a.strip,b:(a.brief||'').slice(0,160)}));
  await q.evaluate(()=>{window.scrollTo(0,0);const c=document.querySelector('#view-home .cta');if(c)c.click();});await wait(900);const y=await q.evaluate(()=>{const r=document.getElementById('reviewCard');return r?Math.round(r.getBoundingClientRect().top):null;});
  T('AC coach-02 the full-rest CTA scrolls to the Weekly Review',y!==null&&y>=-5&&y<220,String(y));await fin(q);}
 // coach-03 / cal-02: the waist brake in a cut, after the check and after the cut
 {const q=await ctxPage('2026-09-27',{cb2_bulk:'cut'},DEMO+"localStorage.setItem('cb2_measure',JSON.stringify([{date:'2026-09-11',waist:92},{date:'2026-09-26',waist:97}]));");const r=await q.evaluate(()=>({v:weeklyReview().verdict,t:gainModel('hyper').rateKgWk}));
  T('AC coach-03 Cut mode with the waist +5 cm: no "cut from the surplus" brake; the cut-rate rule judges the week',r.t<0&&!/surplus|Waist is/.test(r.v)&&/not coming down/.test(r.v),JSON.stringify(r));await fin(q);}
 {const q=await ctxPage('2027-03-24',{cb2_measure:[{date:'2026-09-12',waist:86},{date:'2027-03-06',waist:91},{date:'2027-03-20',waist:91}],cb2_weight:WSER('2027-02-20','2027-03-23',99,-0.5)});const r=await q.evaluate(()=>({v:weeklyReview().verdict,t:gainModel('hyper').rateKgWk,m:effMode()}));
  T('AC cal-02 Mini-Cut I (24 Mar 2027) with the waist +5 cm: the brake stands down in the deficit',r.t<0&&!/surplus/.test(r.v),JSON.stringify(r));await fin(q);}
 {const q=await ctxPage('2027-03-10',{cb2_measure:[{date:'2026-09-12',waist:86},{date:'2027-03-06',waist:91}]});const v=await q.evaluate(()=>weeklyReview().verdict);
  T('AC coach-03 after the check the brake names the mode that runs (Maximum), not Aggressive',/limit \+3 cm in Maximum mode/.test(v)&&!/Aggressive/.test(v),v);await fin(q);}
 {const q=await ctxPage('2027-05-15',{cb2_measure:[{date:'2026-09-12',waist:86},{date:'2027-03-06',waist:91},{date:'2027-05-01',waist:89},{date:'2027-05-15',waist:89.8}]});
  const r=await q.evaluate(()=>{const v=weeklyReview();const o={v:v.verdict,d:v.waistD==null?null:+v.waistD.toFixed(2),b:typeof waistBaseISO==='function'?waistBaseISO():null};const m=DB.measure.find(x=>x.date==='2027-05-15');if(m)m.waist=92.4;o.v2=weeklyReview().verdict;return o;});
  T('AC cal-02 after Mini-Cut I the brake re-anchors on the first tape after the cut (+0.8 cm, not +3.8 from Day 1); +3.4 from it still trips it',r.b==='2027-05-01'&&r.d===0.8&&!/Waist is/.test(r.v)&&/Waist is \+3\.4 cm from your 1 May reading/.test(r.v2),JSON.stringify(r));await fin(q);}
 // coach-04: deload weeks
 {const dlSeed=[].concat(week('2026-10-10',ORD.slice(0,6),100),week('2026-10-17',ORD.slice(0,6),65),week('2026-10-24',ORD.slice(0,5),100));
  let q=await ctxPage('2026-10-23',{cb2_sessions:dlSeed.filter(x=>x.dateISO<'2026-10-23')});let a=await H(q);const r=await q.evaluate(()=>({dl:isDeloadWeek(),v:weeklyReview().verdict}));
  T('AC coach-04 deload week: no "add sets or deload" stall verdict, and the PR tile says deload week',r.dl&&!/No e1RM improved/.test(r.v)&&/deload week/.test(a.review),JSON.stringify({r,t:(a.review||'').slice(0,200)}));await fin(q);
  q=await ctxPage('2026-10-29',{cb2_sessions:dlSeed});const r2=await q.evaluate(()=>{const v=weeklyReview();return {prs:v.prs,stalls:v.stalls};});
  T('AC coach-04 the week after a deload is compared with the last full week: the same loads read 0 PRs, not 5 PRs against the 65% week',r2.prs===0&&r2.stalls===5,JSON.stringify(r2));await fin(q);}
 // coach-05: creatine water in the first three weeks on the scale
 {const q=await ctxPage('2026-09-24',{cb2_weight:WSER('2026-09-12','2026-09-18',88,0).concat(WSER('2026-09-19','2026-09-23',89.3,0))});const r=await q.evaluate(()=>{const v=weeklyReview();return {v:v.verdict,c:v.cls};});
  T('AC coach-05 first weeks on the scale: +1.3 kg in week 2 reads as creatine water (hold the surplus), not "trim 250–300 kcal"',/creatine water/.test(r.v)&&r.c==='ok'&&!/trim/.test(r.v),JSON.stringify(r));await fin(q);}
 {const q=await ctxPage('2026-10-15',{cb2_weight:WSER('2026-09-12','2026-10-09',88,0).concat(WSER('2026-10-10','2026-10-14',89.3,0))});const v=await q.evaluate(()=>weeklyReview().verdict);
  T('AC coach-05 after three weeks on the scale the same jump is judged in full (the surplus is too big)',/surplus is too big/.test(v),v);await fin(q);}
 // coach-07: short night
 {const q=await ctxPage('2026-09-27',{},DEMO+"localStorage.setItem('cb2_sleep',JSON.stringify([{date:'2026-09-26',h:5.2}]));");
  await q.evaluate(()=>{const c=document.querySelector('#view-home .cta');if(c)c.click();});await wait(400);
  const n=await q.evaluate(()=>[...document.querySelectorAll('#rulesTool .note')].map(x=>x.textContent.replace(/\s+/g,' ')));const red=n.find(t=>/^Short night/.test(t))||'',ag=n.find(t=>/^Aggressive mode/.test(t))||'';
  T('AC coach-07 short night in Aggressive: the red note says the extra set and the set-one load jump are off; the gold note no longer promises either',/set-one load jump are off today/.test(red)&&/off today \(short night/.test(ag)&&!/already a row below/.test(ag),JSON.stringify({red:red.slice(0,200),ag:ag.slice(0,220)}));await fin(q);}
 {const q=await ctxPage('2026-09-27',{cb2_bulk:'max'},DEMO+"localStorage.setItem('cb2_sleep',JSON.stringify([{date:'2026-09-26',h:5.2}]));");const a=await H(q);
  await q.evaluate(()=>{const c=document.querySelector('#view-home .cta');if(c)c.click();});await wait(400);const red=await q.evaluate(()=>([...document.querySelectorAll('#rulesTool .note')].map(x=>x.textContent).find(t=>/Short night/.test(t))||''));
  T('AC coach-07 short night in Maximum: neither the Brief nor the Lift mentions an aggressive extra set this mode never adds',/Short night/.test(a.brief)&&!/aggressive extra set/i.test(a.brief)&&/RIR 2/.test(red)&&!/aggressive/i.test(red),JSON.stringify({b:(a.brief||'').slice(0,300),r:red}));await fin(q);}
 // coach-10: the posterior count is what the rows show
 {const q=await ctxPage('2026-09-27',{},DEMO);await q.evaluate(()=>switchView('lift'));await wait(300);const out={};
  for(const d of ['legsA','pullA','legsB']){out[d]=await q.evaluate(d=>{const b=document.querySelector('#dayPills .pill[data-d="'+d+'"]');if(b)b.click();const h=(document.querySelector('#rulesTool h4')||{}).textContent||'';const said=+((h.match(/(\d+) posterior sets/)||[])[1]||0);
    const rows=[...document.querySelectorAll('#liftBody .ex')].reduce((a,el,i)=>a+(GYM[d].ex[i]&&GYM[d].ex[i].post?el.querySelectorAll('.set-row').length:0),0);return {said,rows,cur:curDay};},d);}
  T('AC coach-10 "N posterior sets" in Today\'s rules equals the posterior set rows the Lift shows (focus sets and the aggressive +1 included)',Object.values(out).every(x=>x.said>0&&x.said===x.rows),JSON.stringify(out));await fin(q);}
 // coach-12: Fallback week
 {const q=await ctxPage('2026-09-28',{cb2_profile:PROF('build')},DEMO);const a=await H(q);await q.evaluate(()=>{const c=document.querySelector('#view-home .cta');if(c)c.click();});await wait(400);
  const r=await q.evaluate(()=>({seg:(document.querySelector('#liftPhaseSeg .on')||{}).textContent||'',cur:curDay,stored:JSON.parse(localStorage.getItem('cb2_profile')).phase,order:liftDayOrder()}));
  T('AC coach-12 Fallback week: the Home CTA names the fallback day and opens it without flipping the Lift to the six-day plan',/^▶ Fallback week — start Push A$/.test(a.cta)&&/Fallback/.test(r.seg)&&r.cur==='pushA'&&r.order.includes(r.cur)&&r.stored==='build'&&a.title==='Push A — Fallback week',JSON.stringify({cta:a.cta,t:a.title,r}));await fin(q);}
 // coach-14 / cal-17 / charts-12: the Today card title and deload
 {const q=await ctxPage('2026-09-29');const a=await H(q);T('AC coach-14 Volume days are titled Volume (Tue: "Legs B — Volume")',a.title==='Legs B — Volume',a.title);await fin(q);}
 {const q=await ctxPage('2026-10-19');const a=await H(q);T('AC charts-12 deload week: the Today card says Deload with 65% loads, and the CTA says it is a deload session',a.title==='Pull A — Deload'&&/65%/.test(a.today)&&/^▶ Start today’s deload — Pull A$/.test(a.cta),JSON.stringify({t:a.title,b:a.today,c:a.cta}));await fin(q);}
 // coach-15 / charts-06: the review tiles and the rate source
 {const q=await ctxPage('2026-10-01',{cb2_bulk:'cut',cb2_weight:WSER('2026-09-19','2026-09-25',88,0).concat(WSER('2026-09-26','2026-09-30',86.8,0))});
  const t=await q.evaluate(()=>{const c=document.getElementById('reviewCard');const d=c?[...c.querySelectorAll('.dose')].map(x=>({n:x.querySelector('.dn').textContent,v:x.querySelector('.dv').firstChild.textContent,bad:x.querySelector('.dv').classList.contains('bad')})):[];return {d,v:weeklyReview().verdict};});const lr=t.d[1]||{};
  T('AC coach-15 Cut mode: the tile reads "Loss rate" with a true minus, red under the rate verdict (the Sessions tile stays green)',lr.n==='Loss rate'&&lr.v==='−1.20'&&lr.bad&&/^Losing 1\.20/.test(t.v)&&t.d[0]&&!t.d[0].bad,JSON.stringify(t));await fin(q);}
 {const q=await ctxPage('2026-10-05',{cb2_weight:WSER('2026-09-12','2026-10-02',88,0.42).concat([{date:'2026-10-05',v:89.1}])});
  const r=await q.evaluate(()=>{const v=weeklyReview();const c=document.getElementById('reviewCard');return {wi:v.wi,src:v.rateSrc,rate:v.rate==null?null:+v.rate.toFixed(2),v:v.verdict,tile:!!c&&/\(28 d\)/.test(c.textContent)};});
  T('AC charts-06 one Monday weigh-in: the review reads the 28-day trend like Numbers, so no "add 250 kcal" from a single reading',r.wi===1&&r.src==='28d'&&r.rate>0.3&&!/add 250 kcal/.test(r.v)&&r.tile,JSON.stringify(r));await fin(q);}
 {const sl=[];for(let i=1;i<=6;i++)sl.push({date:addD('2026-09-30',-i),h:6});const q=await ctxPage('2026-09-30',{cb2_bulk:'max',cb2_sleep:sl,cb2_sessions:week('2026-09-26',['legsA','pushA','pullA','legsB'])});const v=await q.evaluate(()=>weeklyReview().verdict);
  T('AC coach-15 the sleep verdict outside Aggressive does not say "step Aggressive down"',/Sleep averaged/.test(v)&&!/step Aggressive/.test(v),v);await fin(q);}
 // coach-17: the Claude check-in reflects the settings
 {const q=await ctxPage('2026-09-27',{cb2_bulk:'cut',cb2_focuslb:false,cb2_profile:PROF('build')},DEMO);const t=await q.evaluate(()=>coachText());
  T('AC coach-17 the Claude check-in names the mode and the Fallback week, signs the target with a true minus and asks a cut question in a cut',/mode Cut/.test(t)&&/Fallback week/.test(t)&&/engine target −0\.\d\d kg\/week/.test(t)&&/loss is coming off fat/.test(t)&&!/lean gain or fat gain/.test(t),t.split('\n').slice(2,4).join(' | ').slice(0,420));
  const t2=await q.evaluate(()=>{liftPhase='hyper';return coachText();});T('AC coach-17 focus off: "even split", not the extra legs-and-back volume',/even split/.test(t2)&&!/extra volume for calves/.test(t2),t2.split('\n')[2].slice(0,300));await fin(q);}
 // critic gap: Home once today's session is done or half-done
 {const q=await ctxPage('2026-09-26',{},DEMO);const a=await H(q);
  T('AC Home after the session: Legs A logged today reads done on the CTA, Today card, Brief and Jump In instead of "Start today\'s session"',/^✓ Legs A logged — 25 sets/.test(a.cta)&&/Done: 25 sets across 8 exercises/.test(a.today)&&/Tomorrow: Push A/.test(a.today)&&/done: 25 sets logged/.test(a.brief)&&!/Just execute today/.test(a.brief)&&/Today’s log/.test(a.all),JSON.stringify({c:a.cta,t:a.today,b:(a.brief||'').slice(0,200)}));
  await q.evaluate(()=>{const s=DB.sessions.find(x=>x.dateISO==='2026-09-26');['ga6','ga7','ga8'].forEach(k=>delete s.entries[k]);renderHome();});const b2=await H(q);
  T('AC Home mid-session: 5 of 8 exercises logged reads "Continue" with the next exercise named',/^▶ Continue Legs A — 5 of 8 exercises$/.test(b2.cta)&&/Next up: Seated Leg Curl/.test(b2.today)&&/in progress: 5 of 8/.test(b2.brief),JSON.stringify({c:b2.cta,t:b2.today}));
  await q.evaluate(()=>{const c=document.querySelector('#view-home .cta');if(c)c.click();});await wait(400);
  const lc=await q.evaluate(()=>{const el=[...document.querySelectorAll('#liftBody .ex')][5],r=el&&el.getBoundingClientRect();return {cur:curDay,done:document.querySelectorAll('#liftBody .set-row.done').length,name:el?(el.querySelector('.ex-nm')||{}).textContent:'',top:r?Math.round(r.top):null};});
  T('AC Home mid-session: Continue opens Legs A with today\'s sets in place, scrolled to the next exercise (Seated Leg Curl)',lc.cur==='legsA'&&lc.done>0&&lc.name==='Seated Leg Curl'&&lc.top!==null&&lc.top>=60&&lc.top<700,JSON.stringify(lc));await fin(q);}
 T('AC coach: no page or console errors across the section',ERR.length===0,ERR.join('|').slice(0,300));}
// ===== AC-lift. Round-2 audit fixes (27 Sep 2026) =====
{const q=await ctxPage('2026-10-24',{cb2_sessions:[S('2026-10-10','legsA',{ga1:sets([[7,100],[7,100],[7,100],[7,100]])}),S('2026-10-17','legsA',{ga1:sets([[8,65],[8,65],[8,65],[8,65]])})]});await q.evaluate(()=>goToLift());await wait(400);
 const a=await q.evaluate(()=>{const l=document.querySelector('#liftBody .lastt');const ph=document.querySelector('input[data-ex="ga1"][data-i="0"][data-f="w"]');const b=l&&[...l.querySelectorAll('button')].find(x=>/Fill/.test(x.textContent));if(b)b.click();const s=DB.sessions.find(x=>x.dateISO===todayISO());return {l:l?l.innerText.replace(/\s+/g,' '):'',ph:ph?ph.placeholder:'',w:s&&s.entries&&s.entries.ga1?s.entries.ga1.map(x=>x.w+'x'+x.r).join(','):''};});
 T('AC lift-01: the week after a deload, Last time, the placeholders and Fill read the last full week (100 kg), the same history as the Next target',/^Last time: 100 kg × 7, 7, 7, 7 — beat it/.test(a.l)&&a.ph==='100'&&a.w==='100x7,100x7,100x7,100x7',JSON.stringify(a));await done(q);}
{const q=await ctxPage('2026-10-17',{cb2_sessions:[S('2026-10-10','legsA',{ga1:sets([[8,100],[8,100],[7,100],[7,100]])})]});await q.evaluate(()=>goToLift());await wait(400);
 const a=await q.evaluate(()=>{const l=document.querySelector('#liftBody .lastt'),n=document.querySelector('#liftBody .nextt');const ph=document.querySelector('input[data-ex="ga1"][data-i="0"][data-f="w"]');const b=l&&[...l.querySelectorAll('button')].find(x=>/Fill/.test(x.textContent));if(b)b.click();const s=DB.sessions.find(x=>x.dateISO===todayISO());return {l:l?l.innerText.replace(/\s+/g,' '):'',n:n?n.innerText:'',ph:ph?ph.placeholder:'',w:s&&s.entries&&s.entries.ga1?s.entries.ga1.map(x=>x.w+'x'+x.r).join(','):'',toast:document.getElementById('toast').innerText};});
 T('AC lift-01: in a deload week the card reads "Last full week" without "beat it", and Fill writes the deload load (65 kg × 5), not last week\'s 100 kg',/^Last full week: 100 kg × 8, 8, 7, 7 — deload week/.test(a.l)&&!/beat it/.test(a.l)&&/Next target: 65 kg × 5–8/.test(a.n)&&a.ph==='65'&&a.w==='65x5,65x5,65x5,65x5'&&/deload set/.test(a.toast),JSON.stringify(a));await done(q);}
{const q=await ctxPage('2026-09-26',{cb2_sessions:[S('2026-09-19','legsA',{ga1:sets([[6,80],[6,80],[5,80],[4,80]]),ga3:sets([[14,197.5],[14,197.5],[13,195]])})]});await q.evaluate(()=>goToLift());await wait(400);
 const a=await q.evaluate(()=>{const L=[...document.querySelectorAll('#liftBody .lastt:not(.nextt) b')],S=[...document.querySelectorAll('#liftBody .lastt:not(.nextt) b span')];return {t:L.map(b=>b.innerText),spans:S.length,broken:S.filter(s=>s.getClientRects().length>1).map(s=>s.innerText)};});
 T('AC lift-03: Last time prints a repeated load once ("80 kg × 6, 6, 5, 4") and never splits one set across two lines',a.t[0]==='80 kg × 6, 6, 5, 4'&&a.t.includes('197.5 kg × 14, 197.5 kg × 14, 195 kg × 13')&&a.spans>=4&&a.broken.length===0,JSON.stringify(a));await done(q);}
{const card=q=>q.evaluate(()=>{const x=[...document.querySelectorAll('#liftBody .ex')].find(e=>e.querySelector('[data-ex="gb8"]'));return x?[...x.querySelectorAll('.lastt')].map(l=>l.innerText.replace(/\s+/g,' ')).join(' | '):'';});
 const q=await ctxPage('2026-09-29',{cb2_sessions:[S('2026-09-22','legsB',{gb8:sets([[6,0],[6,0],[6,0]])})]});await q.evaluate(()=>goToLift());await wait(400);const a=await card(q);await done(q);
 const q2=await ctxPage('2026-10-20',{cb2_sessions:[S('2026-10-13','legsB',{gb8:sets([[6,0],[6,0],[6,0]])})]});await q2.evaluate(()=>goToLift());await wait(400);const d=await card(q2);await done(q2);
 T('AC lift-07: bodyweight work reads "bodyweight", not "0 kg", and the deload asks for two-thirds of the reps, not 65% of 0 kg',/Last time: bodyweight × 6, 6, 6 — beat it/.test(a)&&/Next target: bodyweight × 5–8/.test(a)&&!/0 kg/.test(a+d)&&/Deload week: bodyweight, about two-thirds/.test(d),JSON.stringify([a,d]));}
{const chk=async(iso)=>{const q=await ctxPage(iso);await q.evaluate(()=>goToLift());await wait(400);const r=await q.evaluate(()=>{const t=document.getElementById('rulesTool');return {mode:effMode(),mn:modeName(effMode()),live:aggrLive(),h:t?t.querySelector('h4').innerText:'',body:t?t.querySelector('.tool-b').innerHTML:'',chip:(document.querySelector('#liftBody .ex .chip')||{}).innerText||'',rows:document.querySelectorAll('input[data-ex="'+GYM[curDay].ex[0].id+'"][data-f="r"]').length,sets:fxSets(GYM[curDay].ex[0])};});await done(q);return r;};
 const pre=await chk('2027-02-13'),cut=await chk('2027-03-20'),post=await chk('2027-03-24');
 T('AC lift-02/cal-12: after the March check the Lift drops the Aggressive extras (no "Aggressive", no +1 chip or row, no set-one rule) and says what it stepped down to',pre.live&&/Aggressive/.test(pre.h)&&/\+1/.test(pre.chip)&&pre.rows===pre.sets+1&&[cut,post].every(r=>!r.live&&!/Aggressive ·|Aggressive mode|\+1/.test(r.h+r.body+r.chip)&&r.rows===r.sets&&r.mode==='cut'&&r.body.includes('stepped down after the March check — now '+r.mn)&&r.h.includes(r.mn)),JSON.stringify({pre:[pre.h,pre.chip,pre.rows,pre.sets],cut:[cut.mode,cut.h,cut.chip,cut.rows,cut.sets],post:[post.mode,post.h,post.chip,post.rows,post.sets]}));}
{const q=await ctxPage('2026-09-27',{cb2_loc:'home'});await q.evaluate(()=>switchView('lift'));await wait(400);
 const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const B=re=>[...document.querySelectorAll('#liftBody button')].find(b=>re.test(b.textContent.trim()));
  const vis=()=>{const x=document.querySelector('#liftBody .ex'),row=x&&x.querySelector('.set-row'),h=document.querySelector('header.app'),nav=document.querySelector('nav.tabs');if(!x||!row||!h)return null;return {top:Math.round(x.getBoundingClientRect().top),hb:Math.round(h.getBoundingClientRect().bottom),row:Math.round(row.getBoundingClientRect().bottom),nt:Math.round(nav?nav.getBoundingClientRect().top:innerHeight)};};
  const g=B(/Guide me/);if(!g)return {err:'no Guide me'};g.click();await W(250);const v0=vis(),p0=B(/Prev/);const pd=!!(p0&&p0.disabled);const n=B(/^Next ›$/);if(n)n.click();await W(250);const v1=vis();
  for(let i=0;i<12;i++){const nx=B(/^Next ›$/);if(!nx)break;nx.click();await W(80);}const fin=B(/^Finish ✓$/),pv=B(/Prev/);
  return {v0,v1,pd,pv:pv&&[pv.disabled,pv.offsetHeight],fh:fin&&fin.offsetHeight,foot:[...document.querySelectorAll('#liftBody .sets button')].some(b=>/Finish session/.test(b.textContent))};});
 const ok=v=>!!v&&v.top>=v.hb-2&&v.top<422&&v.row<=v.nt;
 T('AC lift-04: Guide me and Next land on the current exercise, below the header, with its first set row on screen',ok(r.v0)&&ok(r.v1),JSON.stringify(r));
 T('AC lift-05: Prev is disabled on exercise 1; Finish stays on one line, as tall as Prev; a Finish button also sits under the last set grid',r.pd&&r.pv&&!r.pv[0]&&r.fh>0&&r.fh<=r.pv[1]+2&&r.foot,JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-27',{cb2_loc:'home',cb2_sessions:[S('2026-09-13','pushA',{pa1:sets([[8,80],[8,80]])},'gym'),S('2026-09-20','pushA',{pa1:sets([[20,15],[20,15]])},'home')]});await q.evaluate(()=>switchView('lift'));await wait(400);
 const r=await q.evaluate(async()=>{const r=document.querySelector('input[data-ex="pa1"][data-i="0"][data-f="r"]'),w=document.querySelector('input[data-ex="pa1"][data-i="0"][data-f="w"]');if(!r||!w)return {err:'no grid'};r.value='23';r.dispatchEvent(new Event('input',{bubbles:true}));w.value='15';w.dispatchEvent(new Event('input',{bubbles:true}));w.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(x=>setTimeout(x,150));const t=document.getElementById('toast');return {t:t.innerText,cls:t.className};});
 T('AC lift-06: a home PR is judged against home history and names the home exercise, in the success style',/New PR on 🏠 DB Floor Squeeze Press — ~27 kg/.test(r.t)&&!/Bench/.test(r.t)&&/cyan/.test(r.cls||''),JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-26');await q.evaluate(()=>switchView('lift'));await wait(300);
 const r=await q.evaluate(()=>{const W=document.getElementById('plW'),Bb=document.getElementById('plBar'),out=()=>document.getElementById('plateOut');if(!W||!Bb)return {err:'no calc'};const set=(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
  set(Bb,'0');set(W,'140');const sled=out().innerText.replace(/\s+/g,' ');set(Bb,'20');set(W,'15');const below=out().innerText.replace(/\s+/g,' '),wu15=!!out().querySelector('.wu-sets');set(W,'25');const wu25=[...out().querySelectorAll('.wu-w')].map(x=>parseFloat(x.textContent));return {sled,below,wu15,wu25};});
 T('AC lift-09: a 0 kg bar (sled) loads the whole target, and warm-ups are never heavier than the work set',/Per side: 2×25kg · 1×20kg/.test(r.sled||'')&&/below the bar/.test(r.below||'')&&!r.wu15&&Array.isArray(r.wu25)&&r.wu25.length===3&&r.wu25.every(x=>x<=25),JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-27',{cb2_loc:'home'});await q.evaluate(()=>switchView('lift'));await wait(300);
 const tag=id=>q.evaluate(id=>{const x=[...document.querySelectorAll('#liftBody .ex')].find(e=>e.querySelector('[data-ex="'+id+'"]'));return x?x.querySelector('.ex-tag').innerText:'';},id);
 const pa7=await tag('pa7'),pa1=await tag('pa1');await q.evaluate(()=>{[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent==='Legs A').click();});await wait(300);const ga1=await tag('ga1');
 T('AC lift-10: one-dumbbell home exercises are tagged with one 15 kg bell; two-bell ones keep the pair',/1×15 kg DB$/.test(pa7)&&!/2×15/.test(pa7)&&/2×15 kg DBs$/.test(pa1)&&/20 kg bag \+ 1×15 kg DB$/.test(ga1),JSON.stringify([pa7,pa1,ga1]));await done(q);}
{const q=await ctxPage('2026-10-20',{cb2_sessions:[S('2026-10-03','legsA',{ga1:sets([[8,95],[8,95]])}),S('2026-10-10','legsA',{ga1:sets([[8,100],[8,100]])}),S('2026-10-17','legsA',{ga1:sets([[8,65],[8,65]])})]});
 await q.evaluate(()=>{switchView('track');const b=document.querySelector('.track-tabs button[data-tp="lifts"]');if(b)b.click();});await wait(300);
 const r=await q.evaluate(()=>{const h=liftHistory()['ga1|gym']||{};const row=[...document.querySelectorAll('#tp-lifts tbody tr')].find(t=>/Back Squat/.test(t.innerText));return {d:Object.keys(h).sort(),row:row?row.innerText.replace(/\s+/g,' '):''};});
 T('AC charts-07: a 65% deload session stays out of the e1RM curve, the change column and the PB flag',r.d.join(',')==='2026-10-03,2026-10-10'&&/\+6/.test(r.row)&&/PB/.test(r.row),JSON.stringify(r));await done(q);}
{const q=await ctxPage('2027-03-02');await q.evaluate(()=>{const c=document.querySelector('.cta');if(c)c.click();});await wait(400);
 const r=await q.evaluate(()=>{const f=document.getElementById('view-fuel'),m=macros('hyper');return {vis:!!f&&f.offsetParent!==null,banner:(document.getElementById('peakFuel')||{}).innerText||'',trim:/Trim ~|halve the peanut butter/.test(f?f.innerText:''),gkg:+(m.carb/DB.profile.weight).toFixed(1)};});
 const q2=await ctxPage('2027-03-01');const n=await q2.evaluate(()=>({b:!!document.getElementById('peakFuel')||(switchView('fuel'),!!document.getElementById('peakFuel')),gkg:+(macros('hyper').carb/DB.profile.weight).toFixed(1)}));await done(q2);
 T('AC cal-06: on D-3 the "carbs up, legs off" button lands on Fuel that leads with the peak carb load (7–8 g/kg) the engine now targets, with no "trim" advice; D-4 is untouched',r.vis&&/Peak week — D-3: carbs up, legs off/.test(r.banner)&&/7–8 g\/kg/.test(r.banner)&&r.gkg>=7&&r.gkg<=8&&!r.trim&&!n.b&&n.gkg<6,JSON.stringify({r,n}));await done(q);}
{const q=await ctxPage('2027-03-02');await q.evaluate(()=>{const t=document.querySelector('.tab[data-view=lift]');if(t)t.click();});await wait(400);
 const r=await q.evaluate(()=>{const n=document.getElementById('peakNote'),x=document.querySelector('#liftBody .ex'),h=document.querySelector('#rulesTool h4');return {day:curDay,h:n?Math.round(n.getBoundingClientRect().height):0,inTool:!!(n&&n.closest('.tool')),first:!!(n&&document.getElementById('liftBody').firstElementChild===n),title:h?h.innerText:'',op:x?getComputedStyle(x).opacity:''};});
 const tE=async iso=>{const z=await ctxPage(iso);const v=await z.evaluate(()=>sessionTimeEstimate('extras').full);await done(z);return v;};const d1=await tE('2027-03-04'),fri=await tE('2027-02-19');
 T('AC cal-07: on the legs-off day the Lift leads with a visible peak-week note, titles the rules "Peak week" and greys the Legs B list; D-1 drops the skipped calf raise from the time estimate',r.day==='legsB'&&r.h>20&&!r.inTool&&r.first&&/^Today’s rules — Peak week/.test(r.title)&&r.op==='0.55'&&d1<fri,JSON.stringify({r,d1,fri}));await done(q);}
{const run=async(iso,day)=>{const q=await ctxPage(iso);const r=await q.evaluate(async day=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const bp=blockPlan();switchView('lift');const pl=[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent===day);if(pl)pl.click();await W(200);
   const chip=id=>{const x=[...document.querySelectorAll('#liftBody .ex')].find(e=>e.querySelector('[data-ex="'+id+'"]'));return x?x.querySelector('.chip').innerText.replace(/\s+/g,' '):'';};const ids=GYM[curDay].ex.map(e=>e.id);
   const out={name:bp&&bp.name,tot:bp&&bp.tot,chips:Object.fromEntries(ids.map(i=>[i,chip(i)])),trim:/\btrim\b/.test(document.getElementById('liftBody').innerText),rows:Object.fromEntries(ids.map(i=>[i,document.querySelectorAll('input[data-ex="'+i+'"][data-f="r"]').length])),note:(((document.getElementById('rulesTool')||{}).textContent||'').match(/[A-Za-z &]+ specialisation — week \d of 6\./)||[''])[0]};
   const pl2=[...document.querySelectorAll('#dayPills .pill')].find(x=>x.textContent==='Legs A');if(pl2)pl2.click();await W(200);out.squat=chip('ga1');return out;},day);await done(q);return r;};
 const da=await run('2027-04-03','Push A'),cb=await run('2027-05-08','Push A');
 const within=(r,em)=>{const t=r.tot||{};return em.every(g=>t[g]>=16);};
 const rowsMatch=r=>Object.keys(r.chips).every(i=>!r.chips[i]||r.rows[i]===parseInt(r.chips[i],10));
 T('AC cal-08: Delts & arms block — delts and arms take 16–20 hard sets a week; laterals and triceps read "priority"; bench and squat keep their base sets (no maintenance cut); nothing is trimmed',da.name==='Delts & arms specialisation'&&within(da,['delts','arms'])&&da.tot.delts<=20&&da.tot.arms<=20&&/priority/.test(da.chips.pa6)&&/priority/.test(da.chips.pa7)&&!/maintenance/.test(da.chips.pa1)&&parseInt(da.chips.pa1,10)===4&&!/maintenance/.test(da.squat)&&parseInt(da.squat,10)>=4&&!da.trim&&rowsMatch(da)&&!!da.note,JSON.stringify(da));
 T('AC cal-08: Chest & back width block — the cable fly is a priority lift, not trimmed; chest and back width at 16+ sets, every other muscle on its base dose',cb.name==='Chest & back width specialisation'&&within(cb,['chest','back width'])&&/priority/.test(cb.chips.pa5)&&!cb.trim&&rowsMatch(cb),JSON.stringify(cb));}
{const CLOCK="(()=>{const R=Object.getPrototypeOf(window.Date);window.__t=new R('2026-09-26T23:58:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(window.__t);else super(...a);}static now(){return window.__t;}}window.Date=M;})();";
 const q=await ctxPage('2026-09-26',{cb2_sessions:[S('2026-09-19','legsA',{ga1:sets([[8,100],[8,100]])})]},CLOCK);await q.evaluate(()=>goToLift());await wait(300);
 const type=(i,f,v)=>q.evaluate((i,f,v)=>{const el=document.querySelector('#liftBody input[data-ex="ga1"][data-i="'+i+'"][data-f="'+f+'"]');if(!el)return false;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;},i,f,v);
 const clock=iso=>q.evaluate(iso=>{window.__t=new (Object.getPrototypeOf(Date))(iso).getTime();},iso);
 await type(0,'r','8');await type(0,'w','102.5');await type(1,'r','8');await clock('2026-09-27T00:04:00+02:00');
 await type(1,'w','102.5');await type(2,'r','7');await type(2,'w','102.5');await q.evaluate(()=>{const b=document.querySelector('#liftBody [data-add="ga1"]');if(b)b.click();});await wait(200);
 const a=await q.evaluate(()=>({today:todayISO(),ss:DB.sessions.map(s=>s.dateISO+' '+s.day+' '+((s.entries.ga1||[]).filter(okSet).map(x=>x.w+'x'+x.r).join(','))),rows:document.querySelectorAll('#liftBody input[data-ex="ga1"][data-f="r"]').length,base:fxSets(GYM.legsA.ex[0])+(aggrExtra(GYM.legsA.ex[0],GYM.legsA)?1:0),v2:(document.querySelector('#liftBody input[data-ex="ga1"][data-i="2"][data-f="w"]')||{}).value,last:(document.querySelector('#liftBody .lastt')||{}).innerText||'',next:(document.querySelector('#liftBody .nextt')||{}).innerText||''}));
 await clock('2026-09-27T09:00:00+02:00');const wrote=await type(3,'r','6');await wait(200);
 const b2=await q.evaluate(()=>({n:DB.sessions.length,day:curDay,toast:document.getElementById('toast').innerText,sun:DB.sessions.filter(s=>s.dateISO==='2026-09-27').length}));
 T('AC midnight: a session that runs past midnight stays one Saturday session (no phantom Sunday Legs A), and Last time, Next target and Add set keep reading the same day',a.today==='2026-09-27'&&a.ss.length===2&&a.ss[1]==='2026-09-26 legsA 102.5x8,102.5x8,102.5x7'&&a.rows===a.base+1&&a.v2==='102.5'&&/Last time: 100 kg × 8, 8/.test(a.last)&&/Next target: 102.5 kg × 5–8/.test(a.next),JSON.stringify(a));
 T('AC midnight: a grid left open overnight is refreshed to today on the next tap instead of writing into yesterday',wrote&&b2.n===2&&b2.sun===0&&b2.day==='pushA'&&/new day/i.test(b2.toast),JSON.stringify(b2));await done(q);}
// ===== AC-data. Round-2 audit fixes (27 Sep 2026): typed and imported numbers, storage honesty, backup and restore =====
{const q=await ctxPage('2026-09-27');await q.setViewport({width:390,height:844});
 const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const tt=()=>document.getElementById('toast');const put=(id,v)=>{const e=document.getElementById(id);if(!e)return;e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};
  switchView('track');await W(300);{const tp=document.querySelector('[data-tp="weight"]');if(tp)tp.click();}
  put('wVal','88,4');{const ab=document.getElementById('wAdd');if(ab)ab.click();}await W(80);const ok={n:DB.weight.length,v:(DB.weight[0]||{}).v,prof:DB.profile.weight};
  put('wVal','886');document.getElementById('wAdd').click();await W(80);const typo={n:DB.weight.length,prof:DB.profile.weight,cls:tt().className,msg:tt().innerText,bad:document.getElementById('wVal').classList.contains('bad'),tick:tt().querySelectorAll('path[d^="M5 13"]').length};
  put('wVal','88,9');put('wDate','2026-10-05');document.getElementById('wAdd').click();await W(80);const fut={n:DB.weight.length,msg:tt().innerText};
  return {ok,typo,fut};});
 T('AC data: Track weigh-in reads a decimal comma ("88,4" = 88.4), refuses 886 kg with an error toast (no tick) and a red field, and refuses a future date; nothing is saved on a refusal',r.ok.n===1&&r.ok.v===88.4&&r.ok.prof===88.4&&r.typo.n===1&&r.typo.prof===88.4&&/^err/.test(r.typo.cls)&&/between 30 and 250/.test(r.typo.msg)&&r.typo.bad&&r.typo.tick===0&&r.fut.n===1&&/future/.test(r.fut.msg),JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-27');const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const tt=()=>document.getElementById('toast');
  const el=()=>document.getElementById('qW');const setv=v=>{const e=el();if(e)e.value=v;};setv('886');quickLogWeight();await W(60);const typo={n:DB.weight.length,cls:tt().className,msg:tt().innerText};
  setv('88,4');quickLogWeight();await W(60);const ok={v:DB.weight.map(x=>x.v),prof:DB.profile.weight,msg:tt().innerText,cls:tt().className,ticks:(tt().innerText.match(/✓/g)||[]).length,svgs:tt().querySelectorAll('svg').length};
  return {typo,ok};});
 T('AC data: Home quick log refuses 886 kg (error toast, nothing saved) and accepts "88,4"; the success toast carries one tick, not two',r.typo.n===0&&/^err/.test(r.typo.cls)&&/between 30 and 250/.test(r.typo.msg)&&r.ok.v.length===1&&r.ok.v[0]===88.4&&r.ok.prof===88.4&&!/^err/.test(r.ok.cls)&&r.ok.ticks===0&&r.ok.svgs===1,JSON.stringify(r));await done(q);}
{const txt=['2026-09-25,weight,88,2','09/26/2026,weight,88.6','2026-13-40,weight,88','2027-01-01,weight,88','2026-09-24,weight,886','2026-09-23,sleep,4','2026-09-23,sleep,3.5','2019-05-01,weight,90'].join('\n');
 const q=await ctxPage('2026-09-27');const r=await q.evaluate(t=>{const res=importHealthText(t);return {res,w:DB.weight.map(x=>x.date+':'+x.v).sort(),s:DB.sleep.map(x=>x.date+':'+x.h),prof:DB.profile.weight};},txt);await done(q);
 const q2=await ctxPage('2026-09-27');const u=await q2.evaluate(async t=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const ha=document.getElementById('healthTa');if(ha)ha.value=t;const ib=document.querySelector('button[onclick="doHealthImport()"]');if(ib)ib.click();await W(80);const tt=document.getElementById('toast');return {cls:tt.className,msg:tt.innerText,kept:(document.getElementById('healthTa')||{}).value===t};},txt);
 T('AC data: watch import reads a decimal comma and a US month/day paste, sums split sleep samples, and refuses month 13, future, pre-2020 and impossible values (bodyweight follows the newest real weigh-in)',r.res.n===3&&r.res.skipped===4&&r.w.join()==='2026-09-25:88.2,2026-09-26:88.6'&&r.s.join()==='2026-09-23:7.5'&&r.prof===88.6,JSON.stringify(r));
 T('AC data: the import toast counts what it skipped (in the warning style) and keeps the pasted text so the bad lines can be fixed',/^err/.test(u.cls)&&/Imported 3 readings/.test(u.msg)&&/skipped 3 lines/.test(u.msg)&&/1 line with a value out of range/.test(u.msg)&&u.kept,JSON.stringify(u));await done(q2);}
{const q=await ctxPage('2026-09-27');await q.setViewport({width:390,height:844});const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const put=(id,v)=>{const e=document.getElementById(id);if(!e)return;e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};
  switchView('numbers');await W(300);const before=DB.profile.weight;put('pWeight','886');document.getElementById('saveProfile').click();await W(80);const a={w:DB.profile.weight,before,msg:document.getElementById('toast').innerText,cls:document.getElementById('toast').className};
  put('pWeight','90,5');document.getElementById('saveProfile').click();await W(80);return {a,b:DB.profile.weight};});
 T('AC data: Save & Recompute refuses a typo (886 kg leaves the profile as it was) and accepts "90,5"',r.a.w===r.a.before&&/between 30 and 250/.test(r.a.msg)&&/^err/.test(r.a.cls)&&r.b===90.5,JSON.stringify(r));await done(q);}
{let r=null;const q=await ctxPage('2026-09-27',{},"Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('blocked');}});Object.defineProperty(window,'indexedDB',{configurable:true,get(){return undefined;}});");
 try{r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const ban=document.getElementById('storageWarnAll'),dl=document.getElementById('dataLives');const out={ok:STORAGE_OK,ban:!!ban&&ban.classList.contains('show')&&/Saving is blocked/.test(ban.textContent),lives:dl?dl.innerText:''};
   const el=document.getElementById('qW');if(el){el.value='88,4';quickLogWeight();await W(80);}const tt=document.getElementById('toast');out.toast=tt.className+'|'+tt.innerText;switchView('track');await W(300);out.trackDup=!!document.getElementById('storageWarn');return out;});}catch(e){r={err:String(e&&e.message||e).slice(0,160)};}
 T('AC data: with storage blocked, one banner says so on every view, the Data card does not tick "device store" or the vault, and a logged weight says it is for this session only',!!r&&r.ok===false&&r.ban&&/device store ✗ blocked/.test(r.lives)&&!/device store ✓/.test(r.lives)&&!/vault \(IndexedDB\) ✓/.test(r.lives)&&/^err/.test(r.toast||'')&&/saving is blocked/i.test(r.toast||'')&&!r.trackDup,JSON.stringify(r));await done(q);}
{const q=await ctxPage('2026-09-27',{},"Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}});");
 const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));document.querySelector('button[onclick="doBackup()"]').click();await W(150);const tt=document.getElementById('toast');return {last:localStorage.getItem('cb2_lastbackup'),cls:tt.className,msg:tt.innerText,box:document.getElementById('dataBox').style.display,len:(document.getElementById('dataTa')||{value:''}).value.length,picker:(document.getElementById('dataFileWrap')||{style:{}}).style.display};});
 T('AC data: Copy with the clipboard blocked does not record a backup, shows the text to copy by hand, and hides the restore picker',r.last===null&&/^err/.test(r.cls)&&/Clipboard blocked/.test(r.msg)&&r.box==='block'&&r.len>20&&r.picker==='none',JSON.stringify(r));await done(q);}
{const lb=Date.parse('2026-09-25T22:00:00+02:00');const q=await ctxPage('2026-09-27',{cb2_lastbackup:lb});const t=await q.evaluate(()=>{const e=document.getElementById('dataLives');return e?e.innerText:'';});
 T('AC data: the backup age counts calendar days (a Friday-night backup reads "2 days ago" on Sunday, not "1 day ago")',/backup file 2 days ago/.test(t),t.slice(0,240));await done(q);}
{const q=await ctxPage('2026-09-27',{cb2_weight:[{date:'2026-09-01',v:87.5}]});const dlg=[];let mode='dismiss';q.on('dialog',async d=>{dlg.push(d.type());if(mode==='accept')await d.accept();else await d.dismiss();});
 const ts=JSON.stringify({app:'ComebackBlueprint',version:2,weight:[{date:'2026-09-20',v:89}]});let a=null,b=null;
 try{a=await q.evaluate(ts=>{doRestore();(document.getElementById('dataTa')||{}).value=ts;const ap=document.getElementById('dataApply');if(ap)ap.click();return {w:localStorage.getItem('cb2_weight')};},ts);
  mode='accept';b=await q.evaluate(ts=>{const ap=document.getElementById('dataApply');if(ap)ap.click();return {w:localStorage.getItem('cb2_weight')};},ts);}catch(e){b={err:String(e&&e.message||e).slice(0,120)};}
 T('AC data: Restore from the Home Data card asks before it replaces the logs (Cancel keeps them, OK restores), like Track\'s Import Backup',!!a&&/87\.5/.test(a.w||'')&&dlg.length===2&&dlg[0]==='confirm'&&!!b&&(/89/.test(b.w||'')||!!b.err),JSON.stringify({a,b,dlg}));await done(q);}
{const q=await ctxPage('2026-09-27');await q.setViewport({width:390,height:844});const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const put=(e,v)=>{if(!e)return;e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};
  switchView('lift');await W(300);const ex=document.querySelectorAll('#liftBody .ex')[0],w=ex.querySelector('input[data-f="w"]'),rr=ex.querySelector('input[data-f="r"]');
  put(w,'82,5');await W(40);put(rr,'8');await W(40);const ent=()=>{const s=DB.sessions[DB.sessions.length-1];const k=s&&s.entries&&Object.keys(s.entries)[0];return k?s.entries[k][0]:null;};const first=ent()&&JSON.parse(JSON.stringify(ent()));
  put(rr,'150');await W(40);return {first,cls:rr.classList.contains('bad'),after:ent()&&ent().r,toast:document.getElementById('toast').className+'|'+document.getElementById('toast').innerText};});
 T('AC data: Lift set cells read "82,5" as 82.5 kg and refuse 150 reps (red cell, error toast, the refused value is not kept as a set)',!!r.first&&r.first.w==='82.5'&&r.first.r==='8'&&r.cls&&r.after===''&&/^err/.test(r.toast),JSON.stringify(r));await done(q);}
// ===== AC-ui. Round-2 audit fixes (27 Sep 2026) =====
// Toast (charts-09, device-05, ui-01): sized to its text; short messages on one line, long ones wrap inside 16 px gutters.
{const q=await ctxPage('2026-09-27');
 const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const t=document.getElementById('toast');const m=()=>{const b=t.getBoundingClientRect(),s=t.querySelector('span');return {w:Math.round(b.width),l:Math.round(b.left),r:Math.round(b.right),h:s?Math.round(s.getBoundingClientRect().height):0};};
  undoToast('Weigh-in deleted',()=>{});await W(450);const a=m();toast('Saved — everything updated');await W(450);const c=m();toast('Nothing logged yet — the full list is below; enter your sets there, set by set, as you go');await W(450);const d=m();return {a,c,d,vw:innerWidth};});
 T('AC-ui toast: short messages sit on one line (the box sizes to its text, no longer half the screen) and a long one wraps inside 16 px gutters',r.a.h<24&&r.a.w>195&&r.c.h<24&&r.d.h>=24&&r.d.w>300&&r.d.l>=15&&r.d.r<=r.vw-15,JSON.stringify(r));await done(q);}
// Macro tiles (charts-11, cal-15, num-06): inside the readout box at 375, 390 and 430 px.
{const q=await ctxPage('2026-09-27');const r={};for(const vw of [375,390,430]){await q.setViewport({width:vw,height:844});await q.evaluate(()=>switchView('numbers'));await wait(200);
  r[vw]=await q.evaluate(()=>{const g=document.querySelector('#view-numbers .macro-row');if(!g)return null;const ro=g.closest('.readout'),gr=g.getBoundingClientRect(),rr=ro?ro.getBoundingClientRect():gr;const t=[...g.children].map(e=>e.getBoundingClientRect());
   return {sw:g.scrollWidth,cw:g.clientWidth,out:t.filter(b=>b.right>gr.right+0.5||b.left<gr.left-0.5||b.right>rr.right).length,cols:new Set(t.map(b=>Math.round(b.left))).size,ov:[...g.querySelectorAll('.mv,.ml,.mg')].filter(e=>e.scrollWidth>e.clientWidth+1).length};});}
 T('AC-ui macros: the four macro tiles stay inside the readout box at 375, 390 and 430 px (2×2 up to 420 px, four across above) and no tile text overflows',[375,390,430].every(v=>r[v]&&r[v].sw<=r[v].cw&&r[v].out===0&&r[v].ov===0)&&r[390].cols===2&&r[430].cols===4,JSON.stringify(r));await done(q);}
// Delete icons (charts-16), "1 log" (charts-15), photo compare keeps a landscape frame whole (charts-10).
{const q=await ctxPage('2026-09-27',{cb2_weight:[{date:'2026-09-26',v:88}],cb2_measure:[{date:'2026-09-26',waist:92.4,neck:39}]});await q.evaluate(()=>switchView('track'));await wait(250);
 const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const sz=s=>[...document.querySelectorAll(s)].map(b=>{const x=b.getBoundingClientRect();return [Math.round(x.width),Math.round(x.height)];});const o={sub:document.getElementById('wSub').textContent,row:(document.querySelector('#wList .lv')||{}).textContent,w:sz('#wList .del')};
  document.querySelector('[data-tp="measure"]').click();await W(100);o.me=sz('#meList .del');
  const c=document.createElement('canvas');c.width=1280;c.height=960;const g=c.getContext('2d');g.fillStyle='#345';g.fillRect(0,0,1280,960);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.8));const buf=await blob.arrayBuffer();
  await phPut({id:'2026-09-26-side',date:'2026-09-26',pose:'side',w:1280,h:960,type:'image/jpeg',buf,bytes:buf.byteLength});_phView='side';renderPhotos();await W(400);
  const im=document.querySelector('#phBody .ph-cmp img');o.fit=im&&getComputedStyle(im).objectFit;o.nat=im&&[im.naturalWidth,im.naturalHeight];o.ph=sz('#phBody .del');return o;});
 T('AC-ui lists: every row delete icon is at least 36×36 px, one weigh-in reads "1 log" with one decimal, and a landscape photo is shown whole in the compare box',r.w.length===1&&r.me.length===1&&r.ph.length===1&&[...r.w,...r.me,...r.ph].every(([w,h])=>w>=36&&h>=36)&&/ · 1 log · /.test(r.sub)&&/^88\.0/.test(r.row||'')&&r.fit==='contain'&&r.nat&&r.nat[0]===1280,JSON.stringify(r));await done(q);}
// A year of logs (charts-03, charts-08, charts-14, charts-15): ticks never collide, dates carry the year, lists page at 12 rows.
{const seed="(function(){var W=[],M=[],t0=Date.UTC(2026,8,12);for(var i=0;i<=372;i+=2){W.push({date:new Date(t0+i*864e5).toISOString().slice(0,10),v:Math.round((88+i*0.037)*10)/10});}for(var j=0;j<=371;j+=7){M.push({date:new Date(t0+j*864e5).toISOString().slice(0,10),waist:Math.round((92+j*0.01)*10)/10,arm:Math.round((38+j*0.004)*10)/10,chest:108.3,thigh:60,neck:40});}localStorage.setItem('cb2_weight',JSON.stringify(W));localStorage.setItem('cb2_measure',JSON.stringify(M));})();";
 const q=await ctxPage('2027-09-20',{},seed);await q.evaluate(()=>switchView('track'));await wait(400);
 const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const o={};
  const over=svg=>{if(!svg)return {n:-1,labs:[]};const H=svg.viewBox.baseVal.height;const tx=[...svg.querySelectorAll('text')].filter(t=>+t.getAttribute('y')===H-8).map(t=>{const b=t.getBoundingClientRect();return [b.left,b.right,t.textContent];}).sort((a,b)=>a[0]-b[0]);let n=0;for(let i=1;i<tx.length;i++)if(tx[i][0]<tx[i-1][1]+2)n++;return {n,labs:tx.map(x=>x[2])};};
  const ws=document.querySelector('#wChart svg[data-tip]');o.w=over(ws);const S=[...DB.weight].sort((a,b)=>a.date.localeCompare(b.date));o.spans={};
  for(const end of ['2026-12-19','2027-03-05','2027-09-19']){const d=document.createElement('div');document.getElementById('wChart').parentElement.appendChild(d);d.innerHTML=lineChart([{name:'Bodyweight',points:S.filter(p=>p.date<=end).map(p=>({x:p.date,value:p.v})),color:'var(--gold)'}],{dec:1,unit:'kg'});o.spans[end]=over(d.querySelector('svg'));d.remove();}
  const rd=()=>{const e=ws&&document.getElementById(ws.dataset.tip+'r');return e?e.innerText.trim():'';};if(ws){ws.focus();ws.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));o.r0=rd();ws.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));o.r1=rd();}
  const rows=s=>[...document.querySelectorAll(s+' .log-row')];o.rows=rows('#wList').length;const mb=document.querySelector('#wList [data-more]');o.more=mb&&mb.textContent;o.first=(rows('#wList')[0]||{innerText:''}).innerText.replace(/\s+/g,' ');
  if(mb)mb.click();await W(100);o.all=rows('#wList').length;o.last=(rows('#wList').pop()||{innerText:''}).innerText.replace(/\s+/g,' ');o.ldBad=[...document.querySelectorAll('#wList .ld')].filter(e=>e.scrollWidth>e.clientWidth+1||e.getBoundingClientRect().height>20).length;
  const del=document.querySelector('#wList [data-delw]');if(del)del.click();await W(100);o.afterDel=rows('#wList').length;const un=document.querySelector('#toast .undo');if(un)un.click();await W(100);o.afterUndo=rows('#wList').length;
  document.querySelector('[data-tp="measure"]').click();await W(150);o.m=over(document.querySelector('#meChart svg[data-tip]'));o.meRows=rows('#meList').length;o.meMore=(document.querySelector('#meList [data-more]')||{}).textContent;
  const lx=[...document.querySelectorAll('#meList .lx')];o.meTxt=lx[0]?lx[0].innerText.replace(/\s+/g,' '):'';o.meDot=lx.filter(e=>/·/.test(e.textContent)).length;o.meSplit=lx.reduce((n,e)=>n+[...e.children].filter(s=>{const g=document.createRange();g.selectNodeContents(s);return new Set([...g.getClientRects()].map(x=>Math.round(x.top))).size>1;}).length,0);
  const y=id=>{const e=document.getElementById(id);return e?e.getBoundingClientRect().top:NaN;};o.phAbove=y('phCard')<y('meList');return o;});
 const tick=/^[A-Z][a-z]{2} ’\d\d$/;
 T('AC-ui long charts: x-axis dates never collide (the Dec, Mar and Sep spans of a year of weigh-ins, and the tape chart); past 300 days the ticks read "Sep ’26 … Sep ’27" and the readout carries the year',r.w.n===0&&r.m.n===0&&Object.values(r.spans).every(s=>s.n===0&&s.labs.length>=3)&&r.w.labs.every(l=>tick.test(l))&&r.w.labs[0]==='Sep ’26'&&r.w.labs[r.w.labs.length-1]==='Sep ’27'&&r.r0==='12 Sep ’26 · 88.0 kg'&&r.r1==='19 Sep ’27 · 101.8 kg',JSON.stringify({w:r.w,m:r.m,spans:r.spans,r0:r.r0,r1:r.r1}));
 T('AC-ui long lists: a year of weigh-ins shows the newest 12 rows with "Show all 187 weigh-ins"; expanded, rows carry the year and one decimal, a delete keeps the list open; tapes page the same way, each value whole with no stray "·", and photos sit above the tape list',r.rows===12&&r.more==='Show all 187 weigh-ins'&&/^19 Sep ’27 101\.8 ?kg/.test(r.first)&&r.all===187&&/^12 Sep ’26 88\.0 ?kg/.test(r.last)&&r.ldBad===0&&r.afterDel===186&&r.afterUndo===187&&r.meRows===12&&r.meMore==='Show all 54 tape entries'&&/^W \d+\.\d A \d+\.\d C 108\.3 T 60\.0 N 40\.0$/.test(r.meTxt)&&r.meDot===0&&r.meSplit===0&&r.phAbove,JSON.stringify({rows:r.rows,more:r.more,first:r.first,all:r.all,last:r.last,ldBad:r.ldBad,afterDel:r.afterDel,afterUndo:r.afterUndo,meRows:r.meRows,meMore:r.meMore,meTxt:r.meTxt,meDot:r.meDot,meSplit:r.meSplit,phAbove:r.phAbove}));
 await done(q);}
// Readouts (charts-04): each line is named, one value where both lines start, and every reading fits at 375 px.
{const q=await ctxPage('2026-09-26',{cb2_weight:[{date:'2026-09-12',v:88},{date:'2026-09-19',v:88.4},{date:'2026-09-25',v:88.8}]});await q.setViewport({width:375,height:812});
 const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const o={};const chk=s=>{const T=_tips[s.dataset.tip],e=document.getElementById(s.dataset.tip+'r');let over=0;for(let i=0;i<T.x.length;i++){tipAt(s,i);if(e.scrollWidth>e.clientWidth+1)over++;}tipAt(s,0);const z={r:e.innerText.trim(),dots:s.querySelectorAll('.ctip-d circle').length};tipClear(s);return {over,z,names:T.s.map(x=>x.n)};};
  switchView('home');const t=document.querySelector('#view-home .tool');if(t&&!t.classList.contains('open'))t.querySelector('.tool-h').click();await W(150);const ft=document.querySelector('#view-home .tool svg[data-tip]');o.ft=ft?chk(ft):null;
  switchView('roadmap');await W(200);const eta=[...document.querySelectorAll('#view-roadmap svg[data-tip]')].find(s=>/^eta/.test(s.dataset.tip));o.eta=eta?chk(eta):null;return o;});
 T('AC-ui readouts: the ETA and fast-track readings name their lines (plan / logged, fast / tissue), print one value where both lines start, and fit at 375 px at every point',!!(r.ft&&r.eta)&&r.ft.over===0&&r.eta.over===0&&r.ft.z.dots===1&&/^(Now|Day 1) · fast \+0\.0 kg$/.test(r.ft.z.r)&&r.eta.z.dots===1&&/^Now · plan \d+\.\d kg$/.test(r.eta.z.r)&&r.eta.names.join()==='plan,logged'&&r.ft.names.join()==='fast,tissue',JSON.stringify(r));await done(q);}
// Home copy fit (coach-16, cal-21, device-13) and spelling (cal-22).
{const q=await ctxPage('2026-09-27');const r={};
 for(const vw of [375,390]){await q.setViewport({width:vw,height:844});await q.evaluate(()=>switchView('home'));await wait(250);
  r[vw]=await q.evaluate(()=>{const card=[...document.querySelectorAll('#view-home .card')].find(c=>/Soft milestone/.test(c.textContent));const t=card&&card.querySelector('.card-t');if(!t)return null;const tw=document.createTreeWalker(t,NodeFilter.SHOW_TEXT);const ch=[];let n;
   while(n=tw.nextNode()){for(let i=0;i<n.data.length;i++){const g=document.createRange();g.setStart(n,i);g.setEnd(n,i+1);const b=g.getBoundingClientRect();if(b.width)ch.push([n.data[i],Math.round(b.top)]);}}const top=c=>{const f=ch.find(x=>x[0]===c);return f?f[1]:null;};
   return {dash:top('—'),soft:top('S'),five:top('5'),march:top('M'),txt:t.innerText.trim()};});}
 const h=await q.evaluate(()=>{switchView('home');const e=document.getElementById('pillarStrMeta');const words=b=>{const tw=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);const w=[];let n;while(n=tw.nextNode()){const re=/\S+/g;let m;while(m=re.exec(n.data)){const g=document.createRange();g.setStart(n,m.index);g.setEnd(n,m.index+m[0].length);w.push([m[0],Math.round(g.getBoundingClientRect().top)]);}}return w;};
  const lines=b=>{const per={};words(b).forEach(([w,t])=>{(per[t]=per[t]||[]).push(w);});return Object.values(per).map(a=>a.join(' '));};const B=re=>[...document.querySelectorAll('#view-home button')].find(b=>re.test(b.textContent.trim()));
  const sv=B(/^Save backup to iCloud Drive/),dl=B(/^Download$/),im=B(/^Import$/);const o={meta:e?lines(e):null,save:sv?lines(sv):null,dl:dl?lines(dl).length:0,im:im?lines(im).length:0};
  switchView('guide');const g=document.getElementById('view-guide').innerHTML;o.guide=/<b>Import<\/b>/.test(g)&&!/Import pasted data/.test(g);o.us=/periodiz/i.test(g);o.sa=/periodised/.test(g);return o;});
 T('AC-ui milestone title: at 375 and 390 px the dash stays with "Soft milestone" and "5–7 March 2027" stays whole on the next line; the words are unchanged',[375,390].every(v=>r[v]&&r[v].dash===r[v].soft&&r[v].five===r[v].march&&r[v].dash!==r[v].five&&/Soft milestone — 5–7 March 2027/.test(r[v].txt)),JSON.stringify(r));
 T('AC-ui Home fit: the Mass pillar ceiling reads as two whole lines with no separator; "Download" and "Import" sit on one line; the iCloud button never leaves one word alone; the Guide names the same Import button and spells "periodised"',!!h.meta&&h.meta.length===2&&/^ceiling ~\d+ kg @ 18%$/.test(h.meta[0])&&/^~\d+ kg @ 24%$/.test(h.meta[1])&&!!h.save&&h.save.every(l=>l.split(' ').length>=2)&&h.dl===1&&h.im===1&&h.guide&&!h.us&&h.sa,JSON.stringify(h));await done(q);}
// Gauge (num-05) and lean tiers (num-10).
{const q=await ctxPage('2026-09-27',{cb2_profile:{weight:88,height:177,age:38,bf:22,day1bf:18,goal:110,goalBf:24,act:1.55,goal10k:'55:00',phase:'hyper'}});await q.evaluate(()=>switchView('numbers'));await wait(250);
 const r=await q.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const svg=document.querySelector('#gaugeWrap svg');const o={};if(svg){const tx=[...svg.querySelectorAll('text')].filter(t=>/^(NATURAL|ASSISTED ONLY)$/.test(t.textContent)).map(t=>{const b=t.getBBox();return {t:t.textContent,x0:b.x,x1:b.x+b.width,y0:b.y,y1:b.y+b.height};});
   const ln=[...svg.querySelectorAll('line[stroke-width="2.5"]')].map(l=>({x:+l.getAttribute('x1'),y0:Math.min(+l.getAttribute('y1'),+l.getAttribute('y2')),y1:Math.max(+l.getAttribute('y1'),+l.getAttribute('y2'))}));
   o.inside=ln.map(l=>tx.filter(t=>l.x>=t.x0&&l.x<=t.x1).map(t=>t.t).join());o.cross=ln.filter(l=>tx.some(t=>l.x>=t.x0&&l.x<=t.x1&&l.y1>t.y0&&l.y0<t.y1)).length;o.enter=ln.map(l=>[l.y0,l.y1]);}
  o.tiers={};for(const bf of [10,12,15,18,24]){const b=document.querySelector('#ceilBfSeg button[data-bf="'+bf+'"]');if(!b){o.tiers[bf]=null;continue;}b.click();await W(60);const ds=[...document.querySelectorAll('#ceilOut .dose')];
   o.tiers[bf]={tops:ds.map(d=>{const v=d.querySelector('.dv'),n=v&&v.firstChild;if(!n||n.nodeType!==3)return null;const g=document.createRange();g.setStart(n,0);g.setEnd(n,1);return Math.round(g.getBoundingClientRect().top);}),lab:ds[0]?ds[0].querySelector('.dn').textContent:'',sub:ds[0]&&ds[0].querySelector('small')?ds[0].querySelector('small').innerText.replace(/\s+/g,' '):''};}
  return o;});
 T('AC-ui gauge: with YOU inside the NATURAL label (22% body fat) and the goal inside ASSISTED ONLY (110 kg @ 24%), neither marker line crosses its zone label',!!r.inside&&r.inside[0]==='NATURAL'&&r.inside[1]==='ASSISTED ONLY'&&r.cross===0,JSON.stringify({inside:r.inside,cross:r.cross,enter:r.enter}));
 T('AC-ui lean tiers: at every tier the three values share one line, the tier label is short (no "·" or band verdict in it) and the verdict sits under the value',Object.values(r.tiers).every(o=>o&&o.tops.length===3&&o.tops.every(t=>t!=null&&Math.abs(t-o.tops[0])<=1)&&/^Max natural @ \d+%$/.test(o.lab))&&/leaner than your band/.test(r.tiers[10].sub)&&/in your band/.test(r.tiers[18].sub),JSON.stringify(r.tiers));await done(q);}
// Landscape (device-09, device-10): 844×390 with the iPhone's 59 px side insets.
{const q=await ctxPage('2026-09-27');await q.setViewport({width:844,height:390});const cdp=await q.createCDPSession();await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{left:59,right:59,top:0,bottom:21}});await q.evaluate(()=>switchView('home'));await wait(300);
 const r=await q.evaluate(async()=>{const nav=document.querySelector('nav.tabs'),tabs=[...nav.querySelectorAll('.tab')];const tb=tabs.map(t=>{const b=t.getBoundingClientRect(),c=[...t.children].map(e=>e.getBoundingClientRect()).filter(x=>x.width>0);const cl=Math.min(...c.map(x=>x.left)),cr=Math.max(...c.map(x=>x.right));return {h:Math.round(b.height),l:Math.round(b.left),r:Math.round(b.right),off:Math.round(Math.abs((cl+cr)/2-(b.left+b.right)/2))};});
  const hi=document.querySelector('.head-inner'),first=hi&&hi.firstElementChild,card=document.querySelector('#view-home .card');startRest(90);await new Promise(r=>setTimeout(r,450));const rt=document.getElementById('restTimer').getBoundingClientRect();
  return {tb,sw:nav.scrollWidth,cw:nav.clientWidth,brandL:first?Math.round(first.getBoundingClientRect().left):-1,cardL:card?Math.round(card.getBoundingClientRect().left):-1,pb:parseFloat(getComputedStyle(document.body).paddingBottom),rtTop:Math.round(rt.top),vh:innerHeight,vw:innerWidth};});
 T('AC-ui landscape: at 844×390 with 59 px side insets the eight tabs are 36 px+ tall with their icon and label centred, clear of the insets, the nav does not scroll, header and cards start clear of the inset, and the page leaves room to scroll the last control above the rest timer',r.tb.length===8&&r.tb.every(t=>t.h>=36&&t.off<=3)&&r.tb[0].l>=59&&r.tb[7].r<=r.vw-59&&r.sw<=r.cw&&r.brandL>=59&&r.cardL>=59&&r.pb>=r.vh-r.rtTop,JSON.stringify(r));await done(q);}
// ===== AD-S1. Round-3 fixes (28-29 Sep 2026): restore and boot safety, escaping + CSP, honest saves, mirrors, two open copies, copy =====
{const {fontReply}=require('./fontroute');
const tryEval=async(q,fn,arg)=>{try{return await q.evaluate(fn,arg);}catch(e){return {err:String(e&&e.message||e).slice(0,160)};}};
const RAW=o=>'localStorage.clear();'+Object.entries(o).map(([k,v])=>'localStorage.setItem('+JSON.stringify(k)+','+JSON.stringify(v)+');').join('');
const CSPWATCH="window.__csp=[];document.addEventListener('securitypolicyviolation',function(e){window.__csp.push(e.violatedDirective+' '+e.blockedURI);});";
const DEMO_W=[{date:'2026-09-20',v:88.4},{date:'2026-09-21',v:88.9}];
const VIEWS8=['home','lift','run','roadmap','fuel','numbers','track','guide'];
const allViews=q=>tryEval(q,async(V)=>{const out=[];for(const v of V){try{switchView(v);await new Promise(r=>setTimeout(r,90));const e=document.getElementById('view-'+v);out.push(e&&e.innerHTML.length>500&&!/NaN|undefined|Infinity/.test(e.innerText)?1:0);}catch(err){out.push('E:'+String(err&&err.message||err).slice(0,60));}}return out;},VIEWS8);
// A cloud mirror that survives reloads (kept in localStorage under non-cb2_ keys, so it also survives a tab that comes back with fresh session storage) and a clock that ticks, so "newer" means something. mode: ok | fail | hang.
const CLOUDP=(seed,cloud,mode)=>"(function(){var K='__cloudmock';if(!localStorage.getItem('__seeded')&&window.name!=='__cbseeded'){window.name='__cbseeded';localStorage.clear();localStorage.setItem('__seeded','1');"
 +Object.entries(Object.assign({cb2_pure:true},seed||{})).map(([k,v])=>"localStorage.setItem("+JSON.stringify(k)+","+JSON.stringify(JSON.stringify(v))+");").join('')
 +(cloud?"localStorage.setItem(K,"+JSON.stringify(JSON.stringify({cb2_all:JSON.stringify(cloud)}))+");":"")+"}"
 +"var store={};try{store=JSON.parse(localStorage.getItem(K)||'{}');}catch(e){}window.__cs=store;window.__setCalls=0;var sv=function(){try{localStorage.setItem(K,JSON.stringify(store));}catch(e){}};"
 +(mode==='fail'?"window.storage={get:function(k){return Promise.reject(new Error('nf'));},set:function(k,v){window.__setCalls++;return Promise.reject(new Error('down'));}};"
  :mode==='hang'?"window.storage={get:function(k){return new Promise(function(){});},set:function(k,v){window.__setCalls++;return Promise.resolve();}};"
  :"window.storage={get:function(k){return k in store?Promise.resolve({key:k,value:store[k]}):Promise.reject(new Error('nf'));},set:function(k,v){window.__setCalls++;store[k]=String(v);sv();return Promise.resolve({key:k,value:v});},delete:function(k){delete store[k];sv();return Promise.resolve({key:k});},list:function(){return Promise.resolve({keys:Object.keys(store)});}};")
 +"var base=new Date().getTime();Date.now=function(){var n=(+localStorage.getItem('__tick')||0)+1;localStorage.setItem('__tick',n);return base+n*1000;};})();";
const ready=async q=>{for(let i=0;i<45;i++){const ok=await tryEval(q,()=>typeof _cloudReady!=='undefined'&&_cloudReady===true&&!!window.__cs.cb2_all);if(ok===true)return true;await wait(150);}return false;};
const acct=q=>tryEval(q,()=>{try{return JSON.parse(window.__cs.cb2_all);}catch(e){return null;}});
const cpage=async(seed,cloud,mode)=>{const c=await b.createBrowserContext();const q=await page(c,'2026-09-28',CLOUDP(seed,cloud,mode));q.__ctx=c;return q;};

// ---- (a) Restore refuses a wrong-shaped or hostile file before anything is written
{const q=await ctxPage('2026-09-28',{cb2_weight:DEMO_W,cb2_sleep:[{date:'2026-09-20',h:7}],cb2_lastbackup:1234});
 const P=['{"cb2_weight":[null,{},{"date":5,"v":"x"}]}','{"cb2_sessions":"abc"}','{"cb2_sessions":{"a":1}}','{"cb2_weight":5}',
  '{"cb2_weight":{"2026-09-27":88},"cb2_measure":[null,{"date":"2026-09-20","waist":90}],"cb2_profile":{"weight":90}}','{"cb2_sleep":"abc"}',
  '{"cb2_weight":[{"date":"2026-09-21\\"><img src=x onerror=window.__pwn=1>","v":89}]}','{"cb2_profile":{"goal":"<img src=x onerror=window.__pwn=1>"}}',
  '{"cb2_bulk":"<b>x</b>"}','{"cb2_evil":{"a":1}}','{"cb2_ceilbf":"18"}','{"cb2_sessions":[null,5,"x",{"entries":null}]}','{"cb2_weight":[{"date":"2026-09-20","v":1e999}]}'];
 const r=await tryEval(q,async(P)=>{const snap=()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}return JSON.stringify(o);};window.confirm=()=>true;const out=[];
   for(const txt of P){const before=snap();doRestore();const ta=document.getElementById('dataTa');if(ta)ta.value=txt;const ap=document.getElementById('dataApply');if(ap)ap.click();const t=document.getElementById('toast');out.push({err:/^err/.test(t.className),msg:t.innerText.slice(0,80),same:snap()===before});await new Promise(r=>setTimeout(r,25));}
   return out;},P);
 T('AD-S1 restore: 13 wrong-shaped or hostile files are refused before anything is written, each with an error toast (real Restore box)',Array.isArray(r)&&r.length===P.length&&r.every(x=>x.err&&/valid backup/.test(x.msg)&&x.same),JSON.stringify(Array.isArray(r)?r.filter(x=>!(x.err&&x.same)):r).slice(0,300));
 await done(q);}
{const q=await ctxPage('2026-09-28',{cb2_weight:DEMO_W,cb2_lastbackup:1234,cb2_locmig:true});
 const r=await tryEval(q,()=>{const ok=applyRestoreText(JSON.stringify({cb2_weight:[{date:'2026-09-22',v:87.7}],cb2_evil:{a:1},cb2_all:'zz',cb2_lastbackup:0,cb2_locmig:false,cb2_quarantine:{cb2_weight:'x'}}));return {ok,w:localStorage.getItem('cb2_weight'),evil:localStorage.getItem('cb2_evil'),all:localStorage.getItem('cb2_all'),lb:localStorage.getItem('cb2_lastbackup'),lm:localStorage.getItem('cb2_locmig'),qu:localStorage.getItem('cb2_quarantine')};});
 T('AD-S1 restore: only BACKUP_KEYS are written (cb2_evil, cb2_all, cb2_lastbackup, cb2_locmig, cb2_quarantine in a file change nothing)',!!r&&r.ok===true&&/87\.7/.test(r.w||'')&&r.evil===null&&r.all===null&&r.lb==='1234'&&r.lm==='true'&&r.qu===null,JSON.stringify(r));
 await done(q);}
{const q=await ctxPage('2026-09-28',{cb2_weight:DEMO_W});
 const r=await tryEval(q,()=>{window.confirm=()=>true;doRestore();const ta=document.getElementById('dataTa');if(ta)ta.value='\uFEFF'+JSON.stringify({cb2_weight:[{date:'2026-09-22',v:87.7}]})+'\r\n';const ap=document.getElementById('dataApply');if(ap)ap.click();const h=importHealthText('\uFEFF2026-09-20,weight,88.6');return {w:localStorage.getItem('cb2_weight'),t:document.getElementById('toast').innerText,h:h.n};});
 T('AD-S1 restore: a pasted backup that starts with a byte-order mark restores like the file picker, and the watch import strips it too',!!r&&/87\.7/.test(r.w||'')&&/Restored/.test(r.t||'')&&r.h===1,JSON.stringify(r));
 await done(q);}
{const q=await ctxPage('2026-09-28',{cb2_weight:DEMO_W});
 const r=await tryEval(q,async()=>{let asked=0;window.confirm=()=>{asked++;return true;};switchView('track');await new Promise(r=>setTimeout(r,200));const inp=document.getElementById('importFile');if(!inp)return {err:'no import input'};
   const go=async txt=>{const dt=new DataTransfer();dt.items.add(new File([txt],'b.json',{type:'application/json'}));inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,200));const t=document.getElementById('toast');return {toast:t.innerText,cls:t.className};};
   const bad=await go('{"cb2_weight":"abc"}');const askedBad=asked;const w1=localStorage.getItem('cb2_weight');const ok=await go(JSON.stringify({cb2_weight:[{date:'2026-09-22',v:87.7}]}));
   return {bad,askedBad,asked,same:w1===JSON.stringify(JSON.parse(w1)),w:localStorage.getItem('cb2_weight'),okToast:ok.toast};});
 T('AD-S1 restore: Track Import refuses a wrong-shaped file with an error toast before it even asks, and a good file still asks once and restores',!!r&&!!r.bad&&/^err/.test(r.bad.cls||'')&&/valid backup/.test(r.bad.toast||'')&&r.askedBad===0&&r.asked===1&&/87\.7/.test(r.w||'')&&/Restored/.test(r.okToast||''),JSON.stringify(r).slice(0,300));
 await done(q);}
{const q=await ctxPage('2026-09-28',{});
 const r=await tryEval(q,()=>{const P=parseBackup(JSON.stringify({cb2_profile:{weight:90,height:177,age:38,bf:18}}));const V=parseBackup(JSON.stringify({app:'ComebackBlueprint',weight:[{date:'2026-09-01',v:87.5}]}));return {ok:P.ok,act:P.ok&&P.data.cb2_profile.act,goal:P.ok&&P.data.cb2_profile.goal,w:P.ok&&P.data.cb2_profile.weight,v1:V.ok&&Object.keys(V.data).join(',')};});
 T('AD-S1 restore: a profile with missing fields is merged over the defaults (act, goal, goalBf never go missing); an old-format file still maps',!!r&&r.ok&&r.act===1.55&&r.goal===102.3&&r.w===90&&/cb2_weight/.test(r.v1||''),JSON.stringify(r));
 await done(q);}
{const c=await b.createBrowserContext();const q=await page(c,'2026-09-28',RAW({cb2_pure:'true',cb2_profile:'{"weight":90,"height":177,"age":38,"bf":18}'}));q.__ctx=c;
 const v=await allViews(q);
 T('AD-S1 boot: an old-style profile with fields missing renders Home, Fuel and Numbers with no NaN',Array.isArray(v)&&v.every(x=>x===1)&&q.__errs.length===0,JSON.stringify(v)+q.__errs.join('|').slice(0,200));
 await done(q);}
// the app's own data always passes its own check (demo log and the long history), so the guard never refuses or hides real logs
{const DEMO=fs.readFileSync(path.join(__dirname,'fixtures/demo.setup.js'),'utf8').trim().split('\n').pop();const LONG=fs.readFileSync(path.join(__dirname,'fixtures/longseed.tmpl.js'),'utf8').replace('__END__','2027-03-06');
 const out=[];for(const [n,iso,seed] of [['demo','2026-09-28',DEMO],['long','2027-03-06',LONG]]){const c=await b.createBrowserContext();const q=await page(c,iso,seed);q.__ctx=c;
   const r=await tryEval(q,()=>{const P=parseBackup(backupJSON());const ban=document.getElementById('storageWarnAll');return {bad:Object.keys(_bad).length,ok:P.ok,n:P.ok?P.n:0,sess:DB.sessions.length,ban:ban.classList.contains('show'),q:localStorage.getItem('cb2_quarantine')};});
   out.push({n,r});await done(q);}
 T('AD-S1 shape check: the demo log and the 24-week long history load with nothing dropped, no banner, and their own backup passes the strict restore check',out.every(o=>o.r&&o.r.bad===0&&o.r.ok&&o.r.n>=5&&o.r.sess>10&&!o.r.ban&&o.r.q===null),JSON.stringify(out).slice(0,300));}

{const q=await ctxPage('2026-09-28',{cb2_profile:{weight:88,height:177,age:38,bf:18,goal:102.3,goalBf:24,act:'1.375',goal10k:'55:00',phase:'hyper',day1bf:18},cb2_weight:DEMO_W});
 const r=await tryEval(q,()=>{const P=parseBackup(backupJSON());const raw=JSON.parse(localStorage.getItem('cb2_profile'));return {bad:Object.keys(_bad).length,act:DB.profile.act,ok:P.ok&&parseBackup(JSON.stringify({cb2_profile:{act:'1.375'}})).ok,d1:DB.profile.day1bf,rawAct:raw.act};});
 T('AD-S1 shape check: an activity level saved as text ("1.375", which is how the Numbers select saves it) is read as a number, not dropped, and does not raise the banner',!!r&&r.bad===0&&r.act===1.375&&r.ok===true&&r.d1===18,JSON.stringify(r));
 await done(q);}

// ---- (a) A corrupt store already on the device never bricks the app
{const BAD={cb2_weight:'[null,{},{"date":5,"v":"x"}]',cb2_sessions:'"abc"',cb2_measure:'{"a":1}',cb2_lifts:'7',cb2_runs:'null',cb2_sleep:'"abc"',cb2_rhr:'[1,2]',cb2_steps:'{oops',cb2_profile:'[]',cb2_bulk:'"zzz"',cb2_march:'5',cb2_fuelq:'{}',cb2_loc:'"moon"',cb2_radius:'"far"',cb2_ceilbf:'1e999',cb2_focuslb:'"yes"',cb2_wakelock:'3',cb2_ts:'"now"',cb2_lastbackup:'"x"'};
 const c=await b.createBrowserContext();const q=await page(c,'2026-09-28',RAW(BAD));q.__ctx=c;
 const v=await allViews(q);
 const r=await tryEval(q,()=>{const ban=document.getElementById('storageWarnAll');let qz={};try{qz=JSON.parse(localStorage.getItem('cb2_quarantine')||'{}');}catch(e){}return {bad:Object.keys(_bad).length,ban:ban.classList.contains('show')&&/could not be read/.test(ban.textContent)&&!!ban.querySelector('.warn-act'),w:DB.weight.length,s:DB.sessions.length,mode:bulkMode,pw:DB.profile.weight,qs:qz.cb2_sessions,qst:qz.cb2_steps};});
 T('AD-S1 boot: 19 keys holding the wrong shape (strings, numbers, junk rows, broken JSON) still boot; all eight views render clean on the defaults',Array.isArray(v)&&v.every(x=>x===1)&&q.__errs.length===0&&!!r&&r.w===0&&r.s===0&&r.mode==='aggr'&&r.pw===88,JSON.stringify({v,r,e:q.__errs.join('|').slice(0,160)}));
 T('AD-S1 boot: one banner says what could not be read, and the original text is set aside (not deleted) in the quarantine',!!r&&r.bad>=17&&r.ban&&r.qs==='"abc"'&&r.qst==='{oops',JSON.stringify(r));
 const ex=await tryEval(q,async()=>{let cap=null,name='';const oc=URL.createObjectURL;URL.createObjectURL=bl=>{cap=bl;return oc.call(URL,bl);};const ac=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){name=this.download;};
   const btn=document.querySelector('#storageWarnAll .warn-act button');if(btn)btn.click();HTMLAnchorElement.prototype.click=ac;URL.createObjectURL=oc;const txt=cap?await new Response(cap).text():'';let j=null;try{j=JSON.parse(txt);}catch(e){}
   const refused=parseBackup(txt);return {name,app:j&&j.app,keys:j?Object.keys(j.keys||{}).length:0,sess:j&&j.keys&&j.keys.cb2_sessions,refused:refused.ok===false};});
 T('AD-S1 boot: "Export what is there" saves the set-aside text to a file, and Restore refuses that file',!!ex&&/^comeback-unreadable-2026-09-28\.json$/.test(ex.name||'')&&ex.app==='ComebackBlueprint-unreadable'&&ex.keys>=17&&ex.sess==='"abc"'&&ex.refused===true,JSON.stringify(ex));
 await done(q);}
{const c=await b.createBrowserContext();const q=await page(c,'2026-09-28',RAW({cb2_weight:'[{"date":"2026-09-20","v":88.5},null,{"date":"2026-09-21","v":"x"}]'}));q.__ctx=c;
 const r=await tryEval(q,async()=>{const out={n:DB.weight.length,ban:document.getElementById('storageWarnAll').textContent};const el=document.getElementById('qW');if(el){el.value='90,1';quickLogWeight();}await new Promise(r=>setTimeout(r,100));out.after=JSON.parse(localStorage.getItem('cb2_weight')||'[]').length;out.qz=(localStorage.getItem('cb2_quarantine')||'').includes('null');return out;});
 T('AD-S1 boot: unreadable rows are left out and counted, the good rows stay, and the original is set aside before the next save overwrites it',!!r&&r.n===1&&/weigh-ins \(2 entries\)/.test(r.ban||'')&&r.after===2&&r.qz===true,JSON.stringify(r));
 await done(q);}

// ---- (b) Stored text is escaped where it is printed; a Content-Security-Policy forbids network access from the page
{const HOST={cb2_lifts:JSON.stringify([{date:'2026-09-20',lift:'Squat<img src=x onerror=window.__pwn1=1>',w:100,r:5}]),cb2_measure:JSON.stringify([{date:'2026-09-20',waist:90,scanBf:22,scanKind:'DEXA<img src=x onerror=window.__pwn2=1>'}]),
  cb2_runs:JSON.stringify([{date:'2026-09-20',type:'<img src=x onerror=window.__pwn3=1>',dist:5,time:1500}]),cb2_profile:JSON.stringify({weight:88,height:177,age:38,bf:18,goal:'<img src=x onerror=window.__pwn4=1>',goalBf:24,act:1.55,goal10k:'55:00',phase:'hyper'}),
  cb2_bulk:'"<img src=x onerror=window.__pwn5=1>"',cb2_radius:'"<img src=x onerror=window.__pwn6=1>"',cb2_ceilbf:'"<img src=x onerror=window.__pwn7=1>"',cb2_rhr:'[{"date":"2026-09-20","bpm":"<img src=x onerror=window.__pwn8=1>"}]'};
 const c=await b.createBrowserContext();const q=await page(c,'2026-09-28',RAW(HOST)+CSPWATCH);q.__ctx=c;
 const r=await tryEval(q,async(V)=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const out={e:esc('<img src=x onerror=1>&"\''),lists:[]};
   for(const v of V){switchView(v);await W(80);if(v==='track'){for(const tp of ['strength','measure','lifts','weight']){const bt=document.querySelector('.track-tabs button[data-tp="'+tp+'"]');if(bt)bt.click();await W(80);}}}
   out.img=document.querySelectorAll('img[src="x"]').length;out.pwn=Object.keys(window).filter(k=>/^__pwn/.test(k));out.lift=(document.getElementById('liftList')||{}).innerText||'';out.opt=(document.getElementById('liftSel')||{}).innerText||'';out.tape=(document.getElementById('meList')||{}).innerText||'';out.run=(document.getElementById('runList')||{}).innerText||'';out.goal=(document.getElementById('pillarStrMeta')||{}).textContent||'';out.bad=Object.keys(_bad);out.goalv=DB.profile.goal;return out;},VIEWS8);
 T('AD-S1 escape: esc() covers & < > " and the apostrophe',!!r&&r.e==='&lt;img src=x onerror=1&gt;&amp;&quot;&#39;',JSON.stringify(r&&r.e));
 T('AD-S1 escape: hostile lift and run text prints as text on every view; hostile scan kind, goal, mode, radius and heart-rate values are dropped at ingest; no element is injected and no script runs',!!r&&r.img===0&&r.pwn.length===0&&/Squat<img/.test(r.lift+r.opt)&&r.tape.indexOf('DEXA<img')<0&&r.bad.includes('cb2_measure')&&r.bad.includes('cb2_profile')&&r.bad.includes('cb2_rhr')&&r.goalv===102.3,JSON.stringify({img:r&&r.img,pwn:r&&r.pwn,bad:r&&r.bad,goalv:r&&r.goalv,tape:r&&r.tape,lift:r&&r.lift}).slice(0,380));
 await done(q);}
{const q=await ctxPage('2026-09-28',{},CSPWATCH);
 const r=await tryEval(q,async()=>{const m=document.querySelector('meta[http-equiv="Content-Security-Policy"]');const out={c:m?m.content:'',first:!!m&&document.head.querySelector('meta[http-equiv]')===m,boot:window.__csp.length};
   try{await fetch('data:text/plain,hi');out.fetch='allowed';}catch(e){out.fetch='blocked';}
   try{const x=new XMLHttpRequest();x.open('GET','data:text/plain,hi');x.send();out.xhr='sent';}catch(e){out.xhr='blocked';}
   try{new WebSocket('ws://127.0.0.1:9/x');out.ws='made';}catch(e){out.ws='blocked';}
   try{navigator.sendBeacon('data:text/plain,hi','x');out.beacon='sent';}catch(e){out.beacon='blocked';}
   await new Promise(r=>setTimeout(r,250));out.viol=window.__csp.filter(v=>/^connect-src/.test(v)).length;return out;});
 T('AD-S1 CSP: the page carries a policy with connect-src \'none\'; fetch, XHR, WebSocket and beacon are all refused and reported, and boot raised no violation',!!r&&/connect-src 'none'/.test(r.c||'')&&/script-src 'unsafe-inline'/.test(r.c||'')&&r.boot===0&&r.fetch==='blocked'&&r.viol>=3,JSON.stringify(r).slice(0,300));
 await done(q);}
{const c=await b.createBrowserContext();const q=await c.newPage();const errs=[];q.on('pageerror',e=>errs.push(e.message));q.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await q.setRequestInterception(true);q.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:')||u.startsWith('blob:'))return r.continue();const f=fontReply(u);if(f)return r.respond(f);r.respond({status:200,contentType:'text/css',body:''});});
 await q.evaluateOnNewDocument(MOCK,'2026-09-28');await q.evaluateOnNewDocument(STORAGE);await q.evaluateOnNewDocument(CSPWATCH);
 await q.goto('file://'+path.resolve('ComebackBlueprint.html'),{waitUntil:'networkidle0'});await q.setViewport({width:390,height:844,deviceScaleFactor:1});
 let r=null;for(let i=0;i<40&&!(r&&r.mano&&r.media==='all');i++){await wait(150);r=await tryEval(q,()=>{const L=[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/['"]/g,''));const lk=document.querySelector('link[rel=stylesheet][href*="fonts.googleapis"]');return {L:[...new Set(L)],mano:L.includes('Manrope'),csp:window.__csp.length,media:lk?lk.media:'none'};});}
 T('AD-S1 CSP: with the policy on, the Google Fonts stylesheet (swapped in by its inline onload) and the font files still load in the shell, with no violation and no console error',!!r&&r.mano&&r.media==='all'&&r.csp===0&&errs.length===0,JSON.stringify(r)+errs.join('|').slice(0,160));
 await c.close();}

// ---- (c) A save that did not land is never reported as saved
{const q=await ctxPage('2026-09-28',{cb2_weight:DEMO_W,cb2_sleep:[{date:'2026-09-20',h:7}]});
 const r=await tryEval(q,async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const out={};const orig=Storage.prototype.setItem;const before=localStorage.getItem('cb2_weight');
   Storage.prototype.setItem=function(k,v){if(/^cb2_/.test(k))throw new DOMException('quota','QuotaExceededError');return orig.call(this,k,v);};
   const el=document.getElementById('qW');if(el){el.value='90.5';quickLogWeight();}await W(60);let t=document.getElementById('toast');out.home=t.className+'|'+t.innerText;out.homeUndo=!!t.querySelector('.undo');
   const ban=document.getElementById('storageWarnAll');out.ban=ban.classList.contains('show')&&/full or refusing/.test(ban.textContent);out.lives=(document.getElementById('dataLives')||{}).innerText||'';
   switchView('track');await W(150);const wv=document.getElementById('wVal');if(wv){wv.value='91.2';const ad=document.getElementById('wAdd');if(ad)ad.click();}await W(60);t=document.getElementById('toast');out.track=t.className+'|'+t.innerText;out.trackUndo=!!t.querySelector('.undo');
   out.restore=applyRestoreText(JSON.stringify({cb2_weight:[{date:'2026-09-22',v:87.7}]}));out.rtoast=document.getElementById('toast').innerText;out.same=localStorage.getItem('cb2_weight')===before;
   Storage.prototype.setItem=orig;switchView('track');await W(150);const w2=document.getElementById('wVal');if(w2){w2.value='90.7';const ad2=document.getElementById('wAdd');if(ad2)ad2.click();}await W(60);t=document.getElementById('toast');out.ok=t.className+'|'+t.innerText+'|undo:'+!!t.querySelector('.undo');out.banGone=!document.getElementById('storageWarnAll').classList.contains('show');out.stored=/90\.7/.test(localStorage.getItem('cb2_weight')||'');return out;});
 T('AD-S1 honest save: with storage full, a Home log and a Track log say "Not saved" in the warning style with no Undo, and the one banner and the Data card say the store is full',!!r&&/^err/.test(r.home||'')&&/Not saved/.test(r.home||'')&&r.homeUndo===false&&/^err/.test(r.track||'')&&/Not saved/.test(r.track||'')&&r.trackUndo===false&&r.ban===true&&/device store ✗ full/.test(r.lives||''),JSON.stringify(r).slice(0,400));
 T('AD-S1 honest save: a Restore that cannot write every key changes nothing and says so; once storage works again the banner clears and the next log is a normal success',!!r&&r.restore===false&&/Not restored/.test(r.rtoast||'')&&r.same===true&&!/^err/.test(r.ok||'')&&/Weight logged[\s\S]*undo:true/.test(r.ok||'')&&r.banGone===true&&r.stored===true,JSON.stringify({restore:r&&r.restore,rtoast:r&&r.rtoast,same:r&&r.same,ok:r&&r.ok,banGone:r&&r.banGone,stored:r&&r.stored}).slice(0,380));
 await done(q);}

// ---- (d) Mirrors: the vault and the account copy follow a Restore, a setting counts as a change, the account copy is applied only when it is newer, and the Data card ticks only real writes
{const q=await cpage({cb2_weight:[{date:'2026-09-20',v:88.4}]});let r={};
 if(await ready(q)){
   r.backup=await tryEval(q,()=>{DB.save();return backupJSON();});
   await tryEval(q,()=>{DB.weight.push({date:'2026-09-21',v:89.1});DB.save();});
   for(let i=0;i<30;i++){const a=await acct(q);if(a&&a.data&&a.data.cb2_weight&&a.data.cb2_weight.length===2)break;await wait(120);}
   const nav=q.waitForNavigation({waitUntil:'load',timeout:15000}).catch(()=>null);
   await tryEval(q,j=>{applyRestoreText(j);},r.backup);await nav;
   await ready(q);await wait(300);
   r.after=await tryEval(q,async()=>{const ac=JSON.parse(window.__cs.cb2_all);const raw=await idbLoad();let vw=-1;try{vw=JSON.parse(raw).data.cb2_weight.length;}catch(e){}return {w:DB.weight.length,ls:JSON.parse(localStorage.getItem('cb2_weight')||'[]').length,acct:ac.data.cb2_weight.length,vault:vw,toast:document.getElementById('toast').innerText};});}
 T('AD-S1 mirrors: inside Claude, restoring an older backup is not undone at the next launch by the account copy, and the device vault holds the restored generation too',!!r.after&&r.after.w===1&&r.after.ls===1&&r.after.acct===1&&r.after.vault===1&&!/Cloud data loaded/.test(r.after.toast||''),JSON.stringify(r.after||r).slice(0,300));
 await done(q);}
{const q=await cpage({cb2_weight:[{date:'2026-09-20',v:88.4}],cb2_bulk:'aggr'});let r={};
 if(await ready(q)){
   await tryEval(q,async()=>{switchView('numbers');await new Promise(r=>setTimeout(r,250));const bt=document.querySelector('#bulkSeg button[data-bm="max"]');if(bt)bt.click();DB.weight.push({date:'2026-09-21',v:89.1});DB.save();});
   for(let i=0;i<30;i++){const a=await acct(q);if(a&&a.data&&a.data.cb2_bulk==='max')break;await wait(120);}
   await tryEval(q,()=>{const bt=document.querySelector('#bulkSeg button[data-bm="cut"]');if(bt)bt.click();});
   for(let i=0;i<30;i++){const a=await acct(q);if(a&&a.data&&a.data.cb2_bulk==='cut')break;await wait(120);}
   r.acct=(await acct(q)||{data:{}}).data.cb2_bulk;
   const nav=q.waitForNavigation({waitUntil:'load',timeout:15000}).catch(()=>null);await tryEval(q,()=>{location.reload();});await nav;
   await ready(q);await wait(300);
   r.after=await tryEval(q,()=>({mode:bulkMode,ls:localStorage.getItem('cb2_bulk'),toast:document.getElementById('toast').innerText}));}
 T('AD-S1 mirrors: a nutrition mode changed after the last log reaches the account copy and is not reverted at the next launch (a setting counts as a change)',r.acct==='cut'&&!!r.after&&r.after.mode==='cut'&&r.after.ls==='"cut"'&&!/Cloud data loaded/.test(r.after.toast||''),JSON.stringify(r).slice(0,300));
 await done(q);}
{const q=await cpage({cb2_measure:[{date:'2026-09-27',waist:90,neck:38}],cb2_ts:5000000000000},{ts:1000,data:{cb2_measure:[{date:'2026-09-01',waist:95}],cb2_weight:[{date:'2026-09-01',v:90}]}});let r={};
 if(await ready(q))r=await tryEval(q,()=>({m:DB.measure.length,md:DB.measure[0]&&DB.measure[0].date,w:DB.weight.length,toast:document.getElementById('toast').innerText}));
 T('AD-S1 mirrors: an older account copy does not overwrite newer local tapes (emptiness counts tapes, lifts and sleep, and the time stamp still decides)',!!r&&r.m===1&&r.md==='2026-09-27'&&r.w===0&&!/Cloud data loaded/.test(r.toast||''),JSON.stringify(r));
 await done(q);}
{const q=await cpage({},{ts:1000,data:{cb2_lifts:[{date:'2026-09-01',lift:'Squat',w:100,r:5}],cb2_evil:{a:1},cb2_weight:[{date:'2026-09-01',v:90},null]}});let r={};
 if(await ready(q))r=await tryEval(q,()=>({l:DB.lifts.length,w:DB.weight.length,evil:localStorage.getItem('cb2_evil'),toast:document.getElementById('toast').innerText}));
 T('AD-S1 mirrors: an empty device takes the account copy, keeping only the app\'s own keys and readable rows',!!r&&r.l===1&&r.w===1&&r.evil===null&&/Cloud data loaded/.test(r.toast||''),JSON.stringify(r));
 await done(q);}
{const q=await ctxPage('2026-09-28',{cb2_profile:{weight:88,height:177,age:38,bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:'55:00',phase:'hyper'}});
 const r=await tryEval(q,()=>{const a=liftPhase;localStorage.setItem('cb2_profile',JSON.stringify(Object.assign({},DB.profile,{phase:'build'})));reloadDB();const b2=liftPhase;localStorage.setItem('cb2_profile',JSON.stringify(Object.assign({},DB.profile,{phase:'hyper'})));reloadDB();return {a,b2,c:liftPhase};});
 T('AD-S1 mirrors: reloadDB refreshes the Lift phase, so a vault or account restore never leaves the Lift on the wrong programme',!!r&&r.a==='hyper'&&r.b2==='build'&&r.c==='hyper',JSON.stringify(r));
 await done(q);}
{let ok1=null,bad=null,hang=null;
 {const q=await cpage({cb2_weight:DEMO_W},null,'ok');if(await ready(q)){await wait(200);ok1=await tryEval(q,()=>{switchView('home');return {lives:document.getElementById('dataLives').innerText,ack:(document.getElementById('cloudAck')||{}).textContent,calls:window.__setCalls};});}await done(q);}
 {const q=await cpage({cb2_weight:DEMO_W},null,'fail');await wait(1500);bad=await tryEval(q,async()=>{switchView('home');await new Promise(r=>setTimeout(r,150));return {lives:document.getElementById('dataLives').innerText,ack:(document.getElementById('cloudAck')||{}).textContent,err:_cloudErr,calls:window.__setCalls};});await done(q);}
 {const q=await cpage({cb2_weight:DEMO_W},null,'hang');let g=null;for(let i=0;i<50&&!(g&&g.err);i++){await wait(150);g=await tryEval(q,()=>({err:_cloudErr,calls:window.__setCalls}));}
   hang=await tryEval(q,async()=>{switchView('home');await new Promise(r=>setTimeout(r,150));return {lives:document.getElementById('dataLives').innerText,ack:(document.getElementById('cloudAck')||{}).textContent,err:_cloudErr,calls:window.__setCalls};});await done(q);}
 T('AD-S1 Data card: "Claude account" ticks with the time only after a write has succeeded; a rejected write shows "last save failed" and never a tick',!!ok1&&/Claude account ✓ \d/.test(ok1.lives||'')&&/Saved .* ✓/.test(ok1.ack||'')&&!!bad&&bad.err==='save'&&/Claude account ✗ last save failed/.test(bad.lives||'')&&!/Claude account ✓/.test(bad.lives||'')&&/failed/.test(bad.ack||''),JSON.stringify({ok1,bad}).slice(0,400));
 T('AD-S1 Data card: an account that never answers is marked "not reachable" after 5 seconds, nothing is written to it, and there is no tick',!!hang&&hang.err==='reach'&&hang.calls===0&&/Claude account ✗ not reachable/.test(hang.lives||'')&&!/Claude account ✓/.test(hang.lives||''),JSON.stringify(hang));}
{const q=await ctxPage('2026-09-28',{cb2_weight:DEMO_W});
 const r=await tryEval(q,async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const opened=[];const oo=IDBFactory.prototype.open;IDBFactory.prototype.open=function(n){const rq=oo.apply(this,arguments);if(n==='cb2')rq.addEventListener('success',()=>{opened.push(rq.result);});return rq;};
   const oc=IDBDatabase.prototype.close;IDBDatabase.prototype.close=function(){this.__closed=true;return oc.apply(this,arguments);};
   for(let i=0;i<3;i++){DB.weight.push({date:'2026-09-2'+(2+i),v:89+i});DB.save();await W(80);}await _idbLast;await W(200);const stillOpen=opened.filter(d=>!d.__closed).length;
   const del=await new Promise(res=>{const d=indexedDB.deleteDatabase('cb2');d.onsuccess=()=>res('deleted');d.onblocked=()=>res('blocked');d.onerror=()=>res('error');setTimeout(()=>res('timeout'),2500);});return {n:opened.length,stillOpen,del};});
 T('AD-S1 vault: every save closes its IndexedDB connection (none left open after three saves, and the vault can be deleted or upgraded while the app is open)',!!r&&r.n>=3&&r.stillOpen===0&&r.del==='deleted',JSON.stringify(r));
 await done(q);}

// ---- (e) Two open copies reload from storage instead of overwriting each other
{const c=await b.createBrowserContext();const A=await page(c,'2026-09-28',SEED({cb2_weight:DEMO_W}));A.__ctx=c;const B2=await page(c,'2026-09-28','');
 await tryEval(B2,async()=>{const el=document.getElementById('qW');if(el){el.value='91,0';quickLogWeight();}await new Promise(r=>setTimeout(r,100));});
 await A.bringToFront();let ra=null;for(let i=0;i<60&&!(ra&&ra.n===3);i++){await wait(150);ra=await tryEval(A,()=>({n:DB.weight.length,toast:document.getElementById('toast').innerText}));}
 await tryEval(A,()=>{DB.weight.push({date:'2026-09-23',v:90.2});DB.save();});
 const rb=await tryEval(A,()=>JSON.parse(localStorage.getItem('cb2_weight')||'[]').map(w=>w.date).join(','));
 T('AD-S1 two copies: a second open copy takes the first one\'s new log and says so, so its next save keeps both entries (no last-write-wins)',!!ra&&ra.n===3&&/Another open copy/.test(ra.toast||'')&&/2026-09-23/.test(rb||'')&&(rb||'').split(',').length===4,JSON.stringify({ra,rb}));
 await B2.close();await done(A);}

// ---- (f) Copy: where the other data lives, and photos are not in the backup file
{const q=await ctxPage('2026-09-28',{});
 const r=await tryEval(q,()=>{const a=freshCopyNote('https:',true,true),b2=freshCopyNote('https:',false,true);switchView('home');const home=document.getElementById('view-home').innerHTML;switchView('track');const foot=(document.querySelector('#view-track .foot-note')||{}).innerText||'';
   return {a,b2,n1:freshCopyNote('https:',true,false),n2:freshCopyNote('file:',true,true),home:/Progress photos are not in the file/.test(home),foot,std:isStandalone()};});
 T('AD-S1 copy: an empty Home Screen copy says the Safari data lives elsewhere and how to move it; a Safari tab says the same the other way; a copy with data or a file: copy stays quiet',!!r&&/Home Screen app keeps its own copy, apart from Safari/.test(r.a)&&/Download there, then tap Restore here/.test(r.a)&&/Safari and the Home Screen app each keep their own copy/.test(r.b2)&&r.n1===''&&r.n2===''&&r.std===false,JSON.stringify(r).slice(0,300));
 T('AD-S1 copy: the Data card and the Track footer both say progress photos are not in the backup file and where to save them',!!r&&r.home&&/not the progress photos/.test(r.foot||'')&&/Save photos/.test(r.foot||''),JSON.stringify(r).slice(0,300));
 await done(q);}
}

// ===== AD-S1 review repairs (29 Sep 2026): legacy set text, hostile exercise keys, blocked storage, silent saves, complete banner =====
{const tryEval=async(q,fn,arg)=>{try{return await q.evaluate(fn,arg);}catch(e){return {err:String(e&&e.message||e).slice(0,160)};}};
 const W2=[{date:'2026-09-20',v:88.4},{date:'2026-09-21',v:88.9}];
 // sets typed before the 28 Sep validation may hold free text; they keep their session, markup is still refused
 {const LEG={id:'legacy1',dateISO:'2026-09-20',day:'pushA',loc:'home',entries:{pa1:[{r:'BW',w:'0'},{r:'8',w:'80kg',rpe:'8-9'}]}};
  const q=await ctxPage('2026-09-28',{cb2_weight:W2,cb2_sessions:[LEG]});
  const r=await tryEval(q,()=>({kept:DB.sessions.some(s=>s.id==='legacy1'),bad:Object.keys(_bad).length,ban:document.getElementById('storageWarnAll').classList.contains('show'),strict:parseBackup(backupJSON()).ok,
    hostile:parseBackup(JSON.stringify({cb2_sessions:[{id:'x',dateISO:'2026-09-20',day:'pushA',entries:{pa1:[{r:'<img src=x onerror=1>',w:'5'}]}}]})).ok}));
  T('AD-S1 shape check: sets typed before the 28 Sep validation ("BW", "80kg", "8-10") keep their session, raise no banner and pass the strict restore check; a set holding markup is still refused',!!r&&r.kept===true&&r.bad===0&&r.ban===false&&r.strict===true&&r.hostile===false,JSON.stringify(r));
  await done(q);}
 // a hostile exercise key inside a session never reaches the page (Track > Lifts printed it unescaped)
 {const q=await ctxPage('2026-09-28',{cb2_weight:W2,cb2_sessions:[{id:'ok1',dateISO:'2026-09-27',day:'legsA',loc:'gym',entries:{'<img src=x onerror=window.__pwn9=1>':[{r:'5',w:'50'}],ga1:[{r:'8',w:'60'}]}},{id:'ok2',dateISO:'2026-09-26',day:'legsA',loc:'gym',entries:{ga1:[{r:'8',w:'60'}]}}]});
  const r=await tryEval(q,async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));for(const v of ['lift','track','guide','home']){switchView(v);await W(80);if(v==='track'){for(const t of document.querySelectorAll('[data-tp]')){t.click();await W(60);}}}
    return {img:document.querySelectorAll('img[src="x"]').length,pwn:Object.keys(window).filter(k=>/^__pwn/.test(k)).length,bad:Object.keys(_bad),n:DB.sessions.length,ref:parseBackup(JSON.stringify({cb2_sessions:[{id:'x',dateISO:'2026-09-20',day:'legsA',entries:{'<b>':[{r:'5',w:'5'}]}}]})).ok};});
  T('AD-S1 escape: a hostile exercise key inside a lift session is refused at ingest (and escaped where Track > Lifts prints it): no element injected, no script runs, the good session stays, Restore refuses it',!!r&&r.img===0&&r.pwn===0&&r.n===1&&(r.bad||[]).includes('cb2_sessions')&&r.ref===false,JSON.stringify(r));
  await done(q);}
 // storage blocked in the viewer: the vault (or the account copy) is the only store, so it must still fill the app for the session
 {const q=await ctxPage('2026-09-28',{cb2_weight:W2,cb2_sleep:[{date:'2026-09-20',h:7}]});
  await tryEval(q,()=>{DB.save();});
  let vn=0;for(let i=0;i<40&&vn<2;i++){await wait(150);const v=await tryEval(q,()=>new Promise(res=>{const o=indexedDB.open('cb2',1);o.onsuccess=()=>{try{const g=o.result.transaction('kv').objectStore('kv').get('cb2_all');g.onsuccess=()=>{let n=0;try{n=JSON.parse(g.result).data.cb2_weight.length;}catch(e){}o.result.close();res(n);};}catch(e){res(0);}};o.onerror=()=>res(0);}));vn=typeof v==='number'?v:0;}
  const BLOCK="try{Object.defineProperty(window,'localStorage',{get:function(){throw new DOMException('denied','SecurityError');}});}catch(e){}";
  const p2=await page(q.__ctx,'2026-09-28',BLOCK);
  const r=await tryEval(p2,()=>({ok:STORAGE_OK,w:DB.weight.length,toast:document.getElementById('toast').innerText.slice(0,60)}));
  T('AD-S1 mirrors: in a viewer that blocks localStorage the device vault still fills the app for the session (Restored from the device vault)',vn===2&&!!r&&r.ok===false&&r.w===2&&/device vault/.test(r.toast||''),JSON.stringify({vn,r}));
  await p2.close();await done(q);}
 // a save that nobody toasts about (typing a set in Lift) still says Not saved, once, not on every keystroke
 {const q=await ctxPage('2026-09-28',{cb2_weight:W2});
  const r=await tryEval(q,async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(/^cb2_/.test(k))throw new DOMException('quota','QuotaExceededError');return o.call(this,k,v);};
    switchView('lift');await W(300);const t=document.getElementById('toast');t.className='';const c=document.querySelector('#liftBody input.cell[data-f="r"]');if(!c){Storage.prototype.setItem=o;return {err:'no cell'};}
    c.value='8';c.dispatchEvent(new Event('input',{bubbles:true}));await W(60);const first={cls:t.className,txt:t.innerText};t.className='';
    c.value='9';c.dispatchEvent(new Event('input',{bubbles:true}));await W(60);const second=t.className;Storage.prototype.setItem=o;return {first,second};});
  T('AD-S1 honest save: typing a set in Lift with storage full raises one Not saved warning, not one per keystroke',!!r&&!!r.first&&/^err/.test(r.first.cls)&&/Not saved/.test(r.first.txt)&&r.second==='',JSON.stringify(r));
  await done(q);}
 // the banner is complete once every boot-time read has run: a setting that could not be read is listed too
 {const q=await ctxPage('2026-09-28',{cb2_weight:W2,cb2_bulk:'zzz'});
  const r=await tryEval(q,()=>{const b=document.getElementById('storageWarnAll');return {show:b.classList.contains('show'),txt:b.textContent.slice(0,200),mode:bulkMode};});
  T('AD-S1 boot: the banner lists a setting that could not be read (nutrition mode) and the app falls back to its default',!!r&&r.show===true&&/nutrition mode/.test(r.txt||'')&&r.mode==='aggr',JSON.stringify(r));
  await done(q);}
}

await b.close();
const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+String(x.detail||'').replace(/\s+/g,' ').slice(0,400)).join('\n')||'ALL PASS');console.log('RESULT:',pass+'/'+R.length);fs.writeFileSync('qa_report.json',JSON.stringify(R,null,1));process.exit(pass===R.length?0:1);})().catch(e=>{console.error('QA CRASH:',e&&e.stack||e);process.exit(2);});

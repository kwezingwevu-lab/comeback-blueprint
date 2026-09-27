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
 T('pillar: ceiling states both fat levels',/ceiling ~\d+ kg at 18% · ~\d+ at 24%/.test(h));await done(q);}
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
 T('Y engine line in Cut mode: a deficit, no "+-"',/Engine is in Cut: -0\.\d\d kg\/week/.test(l)&&!/\+-/.test(l),l);await done(q);}
{const q=await ctxPage('2027-02-13',{cb2_weight:[{date:'2026-09-12',v:88.0},{date:'2027-02-13',v:99.6}]});const a=await q.evaluate(()=>({need:marchTarget('band').need,g:gainModel('hyper').rateKgWk}));
 T('Y band route: when ahead, the engine slows to what the route needs instead of driving past the band top',a.g<=a.need+1e-9,JSON.stringify(a));await done(q);}
{const q=await ctxPage('2027-03-08');const t=await q.evaluate(()=>document.getElementById('view-home').innerText);
 T('Y after the milestone: no route asks for kilos per week against a passed deadline',/The check weekend has passed; the table shows what each route priced/.test(t)&&!/route itself needs/.test(t));await done(q);}
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
 const ft=await q.evaluate(()=>document.getElementById('view-home').innerText);T('Z fast-track header: one dash, not two',/Fastest way to the 3\.3 kg — in \d+ weeks/.test(ft)&&!/— —/.test(ft),(ft.match(/Fastest way[^\n]*/)||[''])[0]);
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
 T('Z readout: the roadmap reads date, projected weight and phase; the ETA chart reads month and both lean-mass lines; no reading is cut off',/^\d{1,2} [A-Z][a-z]{2} ’\d\d · \d+\.\d kg · \S/.test(rm.r)&&rm.vis==='visible'&&/^[A-Z][a-z]{2} \d{4} · \d+\.\d kg lean · \d+\.\d kg lean$/.test(eta.r)&&eta.dots===2&&fits===0,JSON.stringify({rm,eta,fits}));
 await q.evaluate(()=>{switchView('home');const t=document.querySelector('#view-home .tool');if(t&&!t.classList.contains('open'))t.querySelector('.tool-h').click();});await wait(200);const F='#view-home .tool svg[data-tip]';p=await at(F,8/30);await q.mouse.click(p.x,p.y);await wait(80);const ft=await read(F);
 T('Z readout: the fast-track chart reads the week and both gains',/^Week 8 · \+\d\.\d kg · \+\d\.\d kg$/.test(ft.r)&&ft.dots===2,JSON.stringify(ft));
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
await b.close();
const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+String(x.detail||'').replace(/\s+/g,' ').slice(0,400)).join('\n')||'ALL PASS');console.log('RESULT:',pass+'/'+R.length);fs.writeFileSync('qa_report.json',JSON.stringify(R,null,1));process.exit(pass===R.length?0:1);})().catch(e=>{console.error('QA CRASH:',e&&e.stack||e);process.exit(2);});

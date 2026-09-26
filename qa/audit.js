// Audit walker (PROMPT-MASTER step 1): walks all eight tabs at 390×844 for a mocked date, optionally seeded
// with realistic logs from Day 1 to the day before, and writes text dumps + viewport screenshots.
// Usage: node qa/audit.js <iso-date> <seed|empty> <outdir> [maxShotsPerView]
// Not part of the pass/fail gate; it produces evidence for a human (or agent) to read.
const puppeteer=require('puppeteer');const path=require('path');const fs=require('fs');
const [iso='2026-09-26',mode='seed',out='qa/audit-out',maxShots='14']=process.argv.slice(2);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
// Google Fonts: served from qa/.fonts when tools/fetch_fonts.sh has cached them (real typography), else answered empty.
const FONTS=path.resolve(__dirname,'.fonts');const HAVE_FONTS=fs.existsSync(path.join(FONTS,'fonts.css'));
const OFFLINE=async p=>{await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:'))return r.continue();
  if(HAVE_FONTS&&u.startsWith('https://fonts.googleapis.com/'))return r.respond({status:200,contentType:'text/css',body:fs.readFileSync(path.join(FONTS,'fonts.css'))});
  if(HAVE_FONTS&&u.startsWith('https://fonts.gstatic.com/')){const f=path.join(FONTS,u.replace('https://fonts.gstatic.com/','').replace(/\//g,'_'));if(fs.existsSync(f))return r.respond({status:200,contentType:'font/woff2',headers:{'Access-Control-Allow-Origin':'*'},body:fs.readFileSync(f)});}
  r.respond({status:200,contentType:'text/css',body:''});});};
const file='file://'+path.resolve(__dirname,'../dist/ComebackBlueprint.html');
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
(async()=>{fs.mkdirSync(out,{recursive:true});
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']});
// 1) read the programme (exercise ids per day) from a throwaway context
let ctx=await b.createBrowserContext();let p=await ctx.newPage();await OFFLINE(p);await p.evaluateOnNewDocument(MOCK,iso);
await p.goto(file,{waitUntil:'load'});await wait(900);
const prog=await p.evaluate(()=>({order:GYM_ORDER,start:START_ISO,days:Object.fromEntries(GYM_ORDER.map(d=>[d,GYM[d].ex.map(e=>({id:e.id,cmp:!!e.cmp,reps:String(e.reps||''),sets:fxSets(e)}))]))}));
await ctx.close();
// 2) build a realistic seed: Day 1 .. iso-1, Sat..Thu lifting (Legs-first order), Fri active recovery
let seed=null;
if(mode==='seed'){const sessions=[],weight=[],measure=[],sleep=[];let d=prog.start,n=0;
  while(d<iso){const dow=new Date(d+'T12:00:00Z').getUTCDay();const idx=(dow+1)%7; // Sat=0 .. Fri=6
    const wk=Math.floor(n/7);
    if(idx<6){const day=prog.order[idx];const entries={};
      prog.days[day].forEach((e,i)=>{const top=parseInt((e.reps.match(/(\d+)\s*[-–]\s*(\d+)/)||[])[2]||e.reps)||10,low=parseInt((e.reps.match(/(\d+)/)||[])[1])||8;
        const base=e.cmp?(i===0?80:50):14,w=base+(e.cmp?2.5:1)*wk;
        entries[e.id]=Array.from({length:e.sets},(_,k)=>({r:String(Math.max(low,top-k-(wk===0?1:0))),w:String(w),rpe:String(k===e.sets-1?10:8.5)}));});
      sessions.push({id:'seed'+n,dateISO:d,day,entries});}
    if([0,2,4].includes(idx))weight.push({date:d,v:Math.round((88+0.06*n+(n%3?0.2:-0.1))*10)/10});
    if(idx===0)measure.push({date:d,waist:86+0.2*wk,neck:39,arm:37+0.2*wk,chest:104,thigh:60+0.3*wk});
    sleep.push({date:d,h:Math.round((6.6+(n%4)*0.3)*10)/10});
    d=addDays(d,1);n++;}
  seed={cb2_sessions:sessions,cb2_weight:weight,cb2_measure:measure,cb2_sleep:sleep};}
// 3) walk the tabs in a fresh context (no vault bleed)
ctx=await b.createBrowserContext();p=await ctx.newPage();await OFFLINE(p);const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.evaluateOnNewDocument(MOCK,iso);
if(seed)await p.evaluateOnNewDocument(s=>{if(!sessionStorage.getItem('__seeded')){localStorage.clear();for(const k in s)localStorage.setItem(k,JSON.stringify(s[k]));sessionStorage.setItem('__seeded','1');}},seed);
await p.setViewport({width:390,height:844,deviceScaleFactor:2});await p.goto(file,{waitUntil:'load'});await wait(1200);
const views=['home','lift','run','roadmap','fuel','numbers','track','guide'];const index=[];
for(const v of views){await p.evaluate(n=>{switchView(n);window.scrollTo(0,0);},v);await wait(400);
  // open every accordion so hidden copy is audited too
  await p.evaluate(n=>{const root=document.getElementById('view-'+n);root.querySelectorAll('.tool').forEach(t=>t.classList.add('open'));root.querySelectorAll('.hw-b').forEach(x=>x.classList.add('open'));},v);await wait(200);
  const txt=await p.evaluate(n=>document.getElementById('view-'+n).innerText,v);fs.writeFileSync(path.join(out,v+'.txt'),txt);
  const H=await p.evaluate(()=>document.documentElement.scrollHeight);const shots=Math.min(+maxShots,Math.ceil(H/760));
  for(let i=0;i<shots;i++){await p.evaluate(y=>window.scrollTo(0,y),i*760);await wait(120);const f=path.join(out,`${v}-${String(i+1).padStart(2,'0')}.png`);await p.screenshot({path:f});index.push(f);}
  index.push(`${v}: pageHeight=${H}px shots=${shots}${Math.ceil(H/760)>shots?' (TRUNCATED at '+maxShots+')':''}`);}
// Track sub-tabs (Lifts, Volume, Measures) are hidden panes: screenshot each one too
await p.evaluate(()=>{switchView('track');window.scrollTo(0,0);});await wait(300);
for(const tp of await p.evaluate(()=>[...document.querySelectorAll('.track-tabs button')].map(b=>b.dataset.tp))){
  await p.evaluate(t=>{document.querySelector('.track-tabs button[data-tp="'+t+'"]').click();window.scrollTo(0,0);},tp);await wait(250);
  fs.writeFileSync(path.join(out,'track-'+tp+'.txt'),await p.evaluate(t=>document.getElementById('tp-'+t).innerText,tp));
  const H=await p.evaluate(()=>document.documentElement.scrollHeight);const n=Math.min(4,Math.ceil(H/760));
  for(let i=0;i<n;i++){await p.evaluate(y=>window.scrollTo(0,y),i*760);await wait(100);const f=path.join(out,'track-'+tp+'-'+(i+1)+'.png');await p.screenshot({path:f});index.push(f);}}
fs.writeFileSync(path.join(out,'INDEX.txt'),[`date=${iso} mode=${mode} errors=${errs.length}`,...errs,...index].join('\n'));
console.log('audit written to',out,'errors:',errs.length);await b.close();})().catch(e=>{console.error('AUDIT CRASH',e);process.exit(2);});

// Screenshot one element at 390x844 on a mocked date, after optional seeding and actions (Chromium, offline-deterministic).
// Usage: node qa/elshot.js <YYYY-MM-DD> <out.png> "<css selector>" "[setup JS run before the app boots]" "[action JS run after boot]"
const puppeteer=require('puppeteer');const path=require('path');
const [iso,out,sel,setup,action]=process.argv.slice(2);
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});const p=await b.newPage();
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:'))r.continue();else r.respond({status:200,contentType:'text/css',body:''});});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.evaluateOnNewDocument(MOCK,iso);await p.evaluateOnNewDocument('try{localStorage.clear();}catch(e){}'+(setup||''));
await p.setViewport({width:390,height:844,deviceScaleFactor:2});
await p.goto('file://'+path.resolve(__dirname,'ComebackBlueprint.html'),{waitUntil:'networkidle0'});await wait(900);
if(action){await p.evaluate(action);await wait(600);}
await p.evaluate(()=>{const t=document.getElementById('toast');if(t)t.style.display='none';const r=document.getElementById('restTimer');if(r)r.style.display='none';});
const el=await p.$(sel);if(!el){console.error('no element',sel);process.exit(1);}
await el.screenshot({path:out});console.log('shot',out,errs.length?'ERRORS '+errs.join('|'):'');await b.close();})();

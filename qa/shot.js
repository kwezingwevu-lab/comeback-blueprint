// Screenshot + text dump of one view at 390×844 on a mocked date (Chromium, offline-deterministic like qa_full.js).
// Usage: node qa/shot.js <view> <YYYY-MM-DD> <outPrefix> [setupJS]   e.g. node qa/shot.js lift 2026-09-12 /tmp/lift "localStorage.setItem('cb2_pure','true')"
const puppeteer=require('puppeteer');const path=require('path');const fs=require('fs');
const [view,iso,out,setup]=process.argv.slice(2);
if(!view||!iso||!out){console.error('usage: node qa/shot.js <view> <iso> <outPrefix> [setupJS]');process.exit(2);}
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
const STORAGE=()=>{const store={};window.__cs=store;window.storage={async get(k){if(!(k in store))throw new Error('nf');return{key:k,value:store[k]};},async set(k,v){store[k]=String(v);return{key:k,value:v};},async delete(k){delete store[k];return{key:k}},async list(){return{keys:Object.keys(store)}}};};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']});const p=await b.newPage();
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:'))r.continue();else r.respond({status:200,contentType:'text/css',body:''});});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.evaluateOnNewDocument(MOCK,iso);await p.evaluateOnNewDocument(STORAGE);await p.evaluateOnNewDocument(()=>{try{localStorage.clear();}catch(e){}});
if(setup)await p.evaluateOnNewDocument(new Function(setup));
const file=fs.existsSync(path.resolve(__dirname,'ComebackBlueprint.html'))?path.resolve(__dirname,'ComebackBlueprint.html'):path.resolve(__dirname,'../dist/ComebackBlueprint.html');
await p.goto('file://'+file,{waitUntil:'networkidle0'});await p.setViewport({width:390,height:844,deviceScaleFactor:2});await wait(900);
await p.evaluate(n=>switchView(n),view);await wait(400);
// open every accordion so hidden copy is visible in the dump and the full-page shot
await p.evaluate(()=>document.querySelectorAll('.tool').forEach(t=>t.classList.add('open')));await wait(200);
const txt=await p.evaluate(n=>document.getElementById('view-'+n).innerText,view);
const html=await p.evaluate(n=>document.getElementById('view-'+n).innerHTML,view);
const overflow=await p.evaluate(()=>{const w=document.documentElement.clientWidth;const bad=[];document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect();if(r.width>0&&(r.right>w+1||r.left<-1)&&getComputedStyle(el).position!=='fixed')bad.push((el.tagName+'.'+String(el.className).replace(/\s+/g,'.')).slice(0,60)+' right='+Math.round(r.right));});return bad.slice(0,25);});
await p.screenshot({path:out+'.png',fullPage:true});
fs.writeFileSync(out+'.txt',txt);fs.writeFileSync(out+'.html',html);
fs.writeFileSync(out+'.meta.json',JSON.stringify({view,iso,errors:errs,overflow,textChars:txt.length},null,1));
console.log(JSON.stringify({view,iso,png:out+'.png',txt:out+'.txt',errors:errs.length,overflow:overflow.length,textChars:txt.length}));
await b.close();})().catch(e=>{console.error('SHOT CRASH',e.message);process.exit(1);});

// Clipped 390-wide screenshot of one view: node qa/clip.js <view> <YYYY-MM-DD> <out.png> <yOffsetPx> <heightPx> [setupJS]
const puppeteer=require('puppeteer');const {fontReply}=require('./fontroute');const path=require('path');
const [view,iso,out,y0,h,setup]=process.argv.slice(2);
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});const p=await b.newPage();
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:')||u.startsWith('blob:'))r.continue();else r.respond(fontReply(u)||{status:200,contentType:'text/css',body:''});});
await p.evaluateOnNewDocument(MOCK,iso);await p.evaluateOnNewDocument(()=>{const store={};window.storage={async get(k){if(!(k in store))throw new Error('nf');return{key:k,value:store[k]};},async set(k,v){store[k]=String(v);return{key:k,value:v};},async delete(k){delete store[k];return{key:k}},async list(){return{keys:Object.keys(store)}}};try{localStorage.clear();}catch(e){}});
if(setup)await p.evaluateOnNewDocument(new Function(setup));
await p.goto('file://'+(process.env.APP||path.resolve(__dirname,'ComebackBlueprint.html')),{waitUntil:'networkidle0'});await p.setViewport({width:390,height:844,deviceScaleFactor:+(process.env.DSF||2)});await wait(800);
await p.evaluate(n=>switchView(n),view);await wait(400);
const top=await p.evaluate(n=>document.getElementById('view-'+n).getBoundingClientRect().top+window.scrollY,view);
await p.screenshot({path:out,clip:{x:0,y:top+(+y0),width:390,height:+h}});console.log('clip',out);await b.close();})();

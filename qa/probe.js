// Quick probe: node qa/probe.js <iso> "<setup JS>" "<expression>" — prints errors and the expression's value. Viewport 390x844 (VW env overrides the width).
const puppeteer=require('puppeteer');const {fontReply}=require('./fontroute');const path=require('path');const [iso,setup,expr]=process.argv.slice(2);
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});const p=await b.newPage();await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:')||u.startsWith('blob:'))r.continue();else r.respond(fontReply(u)||{status:200,contentType:'text/css',body:''});});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.evaluateOnNewDocument(MOCK,iso);await p.evaluateOnNewDocument('try{localStorage.clear();}catch(e){}'+(setup||''));
await p.setViewport({width:+(process.env.VW||390),height:844,deviceScaleFactor:1});await p.goto('file://'+(process.env.APP||path.resolve(__dirname,'ComebackBlueprint.html')),{waitUntil:'networkidle0'});await new Promise(r=>setTimeout(r,900));
const v=await p.evaluate(expr||'1');console.log('ERRORS:',JSON.stringify(errs));console.log('VALUE:',typeof v==='string'?v:JSON.stringify(v));await b.close();})();

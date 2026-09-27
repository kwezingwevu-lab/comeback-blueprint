// WebKit (Safari engine) screenshot of one view or element at 390x844, 3x density, mocked date, optional seed/action.
// Usage: node qa/wkshot.js <view> <YYYY-MM-DD> <out.png> "[setup JS]" "[css selector, default the view]" "[action JS]"
const {webkit}=require('playwright');const {fontReply}=require('./fontroute');const path=require('path');
const [view,iso,out,setup,sel,action]=process.argv.slice(2);
(async()=>{const b=await webkit.launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:+(process.env.DSF||3),timezoneId:'Africa/Johannesburg'});
await ctx.route(u=>!(u.protocol==='file:'||u.protocol==='data:'||u.protocol==='blob:'),r=>r.fulfill(fontReply(r.request().url())||{status:200,contentType:'text/css',body:''}));
await ctx.addInitScript(([iso,setup])=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;try{localStorage.clear();}catch(e){}if(setup)(0,eval)(setup);},[iso,setup||'']);
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+(process.env.APP||path.resolve(__dirname,'ComebackBlueprint.html')),{waitUntil:'load'});await p.waitForTimeout(1200);
await p.evaluate(v=>switchView(v),view);await p.waitForTimeout(400);if(action){await p.evaluate(action);await p.waitForTimeout(500);}
await p.evaluate(sel=>{for(const id of ['toast','restTimer'])(document.getElementById(id)||{}).style&&(document.getElementById(id).style.display='none');const n=document.querySelector('nav.tabs');if(n&&!/nav|tab/.test(sel||''))n.style.display='none';if(sel){const hd=document.querySelector('header');if(hd&&!/header/.test(sel))hd.style.position='static';}},sel||'');
const target=sel?await p.$(sel):await p.$('#view-'+view);if(!target){console.error('no element',sel);process.exit(1);}
await target.screenshot({path:out});console.log('webkit shot',out,errs.length?'ERRORS '+errs.join('|'):'');await b.close();})();

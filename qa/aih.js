// Harness for the AI-layer suites (qa/ai.js, qa/ai_webkit.js; LEDGER 36): dist/artifact.html inside a viewer-like frame (as QA sections AI and AJ
// build it) with a mock window.claude.use: db + user (account copy) and "sample" as sample.d.ts describes it (a function + .json + .limits, onText in
// chunks, any error code on demand, signal honoured, a call log on window.top.__aicalls). AI_SHOTS=<folder> also writes the screenshots.
const puppeteer=require('puppeteer');const path=require('path');const fs=require('fs');const http=require('http');
const {fontReply}=require('./fontroute');
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
const MOCKS=`(function(){var T=window.top;T.__mdb=T.__mdb||{};T.__aicalls=T.__aicalls||[];T.__limcalls=T.__limcalls||0;T.__usecalls=T.__usecalls||[];
  function ref(p){return {get:function(){var e=Object.prototype.hasOwnProperty.call(T.__mdb,p);return Promise.resolve({id:p.split('/').pop(),exists:e,data:function(){return e?T.__mdb[p]:undefined;},metadata:{fromCache:false,hasPendingWrites:false}});},
   set:function(d){T.__mdb[p]=JSON.parse(JSON.stringify(d));return Promise.resolve();},delete:function(){delete T.__mdb[p];return Promise.resolve();}};}
  var db={doc:function(p){return ref(p);},collection:function(c){return {doc:function(id){return ref(c+'/'+id);}};}};
  var user={id:function(){return Promise.resolve('u1');}};
  function mk(kind){return function(input,options){var C=T.__ai||{},o=options||{};
    var rec={kind:kind,input:JSON.parse(JSON.stringify(input)),keys:Object.keys(o).sort(),cache:o.cache===undefined?'(omitted)':JSON.parse(JSON.stringify(o.cache)),modelTier:o.modelTier,tools:(o.tools||[]).map(function(t){return t.name;}),signal:!!(o.signal&&typeof o.signal.aborted==='boolean'),onText:typeof o.onText==='function',at:Date.now(),toolRuns:[]};
    T.__aicalls.push(rec);
    return new Promise(function(res,rej){var done=false,text='';
      function fail(code,t){if(done)return;done=true;var e={code:code,message:'mock '+code+' <b>never shown</b>'};if(t)e.text=t;rec.end=code;rej(e);}
      if(o.signal){if(o.signal.aborted)return fail('cancelled');o.signal.addEventListener('abort',function(){fail('cancelled',text||undefined);});}
      var d=C.delay==null?80:C.delay,chunks=(C.chunks||['Keep today simple. ','Hit the first compound, eat to target, sleep.']).slice();
      var pre=Promise.resolve();
      if(C.callTools&&o.tools){pre=Promise.all(C.callTools.map(function(c){var t=o.tools.filter(function(x){return x.name===c.name;})[0];if(!t)return null;var before=JSON.stringify(T.__snap?T.__snap():null);
        return Promise.resolve().then(function(){return t.execute(c.input||{},{signal:o.signal});}).then(function(r){rec.toolRuns.push({name:c.name,ok:true,bytes:JSON.stringify(r).length,out:r,same:before===JSON.stringify(T.__snap?T.__snap():null)});},function(e){rec.toolRuns.push({name:c.name,ok:false,err:String(e&&e.message||e)});});}));}
      pre.then(function(){
        if(C.hold)return;                                    // never answers: for Thinking and Stop
        if(C.err&&!C.errAfter)return setTimeout(function(){fail(C.err,C.errText);},d);
        var i=0;(function step(){if(done)return;if(i<chunks.length){setTimeout(function(){if(done)return;var delta=chunks[i];text+=delta;i++;try{if(o.onText)o.onText({text:text,delta:delta});}catch(e){}
            if(C.err&&C.errAfter===i)return fail(C.err,C.err==='refused'?undefined:text);if(C.holdAfter===i)return;step();},d);}
          else setTimeout(function(){if(done)return;done=true;rec.end='ok';if(kind==='json'){try{res(JSON.parse(text));}catch(e){rej({code:'invalid_json',message:'no json',text:text});}}else res({text:text,truncated:!!C.truncated,modelTierApplied:o.modelTier||'default'});},d);})();});});};}
  var sample=mk('text');sample.json=mk('json');sample.limits=function(){T.__limcalls++;var C=T.__ai||{};return C.limErr?Promise.reject({code:'upstream_error',message:'x'}):Promise.resolve(C.limits||{maxPromptBytes:262144});};
  if(!T.__noclaude)window.claude={use:function(n){T.__usecalls.push(n);return new Promise(function(res){setTimeout(function(){var C=T.__ai||{};res(n==='db'?db:n==='user'?user:n==='sample'?(C.none?null:sample):null);},40);});}};})();`;
const ART=()=>fs.readFileSync(path.join(__dirname,'..','dist','artifact.html'),'utf8');
const FRAME=(iso,seed)=>'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style><script>('+MOCK.toString()+')("'+iso+'");try{localStorage.clear();}catch(e){}'+(seed||'')+';'+MOCKS+'</script></head><body>'+ART()+'</body></html>';
const W=ms=>new Promise(r=>setTimeout(r,ms));
const DEMO=()=>fs.readFileSync(path.join(__dirname,'fixtures','demo.setup.js'),'utf8').trim().split('\n').pop();
async function start(){const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']});
  let cur={iso:'2026-11-28',seed:''};
  const srv=http.createServer((rq,rs)=>{if(rq.url.startsWith('/frame'))return rs.writeHead(200,{'content-type':'text/html'}),rs.end(FRAME(cur.iso,cur.seed));rs.writeHead(200,{'content-type':'text/html'});rs.end('<!doctype html><html><body style="margin:0;background:#0A0D14"><iframe id="f" sandbox="allow-scripts allow-same-origin" src="/frame.html" style="width:'+(cur.w||390)+'px;height:844px;border:0;display:block"></iframe></body></html>');});
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port;
  const open=async(o)=>{o=o||{};cur={iso:o.iso||'2026-11-28',seed:o.seed||'',w:o.w||390};const c=await b.createBrowserContext();const q=await c.newPage();await q.setRequestInterception(true);
    q.on('request',r=>{const u=r.url();if(u.startsWith(base)||u.startsWith('data:')||u.startsWith('blob:')||u.startsWith('about:'))r.continue();else r.respond(fontReply(u)||{status:200,contentType:'text/css',body:''});});
    q.__errs=[];q.on('pageerror',e=>q.__errs.push(e.message));q.on('console',m=>{if(m.type()==='error')q.__errs.push('console: '+m.text());});
    await q.evaluateOnNewDocument((ai,nc)=>{if(window===window.top){window.__ai=ai;window.__noclaude=nc;}},o.ai||{},!!o.noclaude);
    await q.setViewport({width:cur.w,height:844,deviceScaleFactor:o.dsf||1});await q.goto(base+'/',{waitUntil:'load'});
    let f=null;for(let i=0;i<80;i++){f=q.frames().find(x=>x.url().includes('/frame'));if(f){const ok=await f.evaluate(()=>typeof DB!=='undefined'&&!!document.getElementById('view-home')&&!document.querySelector('#view-home .boot-ph')).catch(()=>false);if(ok)break;}await W(100);}
    await W(o.settle==null?1200:o.settle);     // the boot chain starts at 600 ms; use() answers after 40 ms
    const ev=async(fn,a)=>{try{return await f.evaluate(fn,a);}catch(e){return {err:String(e&&e.message||e).slice(0,300)};}};
    const poll=async(fn,ms,a)=>{const t=Date.now();let v;while(Date.now()-t<(ms||6000)){v=await ev(fn,a);if(v&&!v.err&&v!==false)return v;await W(120);}return v;};
    const top=(fn,a)=>q.evaluate(fn,a);
    const shot=async(file)=>{const d=process.env.AI_SHOTS;if(!d)return null;const o=path.join(d,path.basename(file));try{fs.mkdirSync(d,{recursive:true});await q.screenshot({path:o});}catch(e){}return o;};
    return {q,f,ev,poll,top,shot,errs:q.__errs,close:()=>c.close()};};
  return {open,close:async()=>{await b.close();srv.close();},W,DEMO};}
module.exports={start,W,DEMO,FRAME,MOCK};

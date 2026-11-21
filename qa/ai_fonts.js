// P1 (17 Nov 2026): the artifact build in the viewer-like frame boots and draws its own fonts without the network.
// F1: every request that leaves the local frame server is held 1500 ms; Home's text is painted (and first contentful paint happens) before any of them arrives.
// F2: every such request is refused; document.fonts in the frame still reports the three families loaded (they are inlined as data: URIs).
// F3 (P1-R2-1): the frame's font script ran: the inlined faces are in document.fonts, the fallback block is disabled and no fallback face was looked up.
// Run alone: AI_ONLY=fonts node ai.js
const {FRAME}=require('./aih');const puppeteer=require('puppeteer');const http=require('http');
const W=ms=>new Promise(r=>setTimeout(r,ms));
const PROBE=()=>{window.__p1paint=null;const tick=()=>{const h=document.getElementById('view-home');if(h&&!h.querySelector('.boot-ph')&&h.innerText.trim().length>80){requestAnimationFrame(()=>setTimeout(()=>{window.__p1paint=performance.now();},0));return;}requestAnimationFrame(tick);};requestAnimationFrame(tick);};
module.exports=async function(T){
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']});
  const srv=http.createServer((rq,rs)=>{rs.writeHead(200,{'content-type':'text/html'});if(rq.url.startsWith('/frame'))return rs.end(FRAME('2026-11-28',''));rs.end('<!doctype html><html><body style="margin:0"><iframe sandbox="allow-scripts allow-same-origin" src="/frame.html" style="width:390px;height:844px;border:0"></iframe></body></html>');});
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port;
  const open=async(mode)=>{const c=await b.createBrowserContext();const q=await c.newPage();const ext=[];await q.setRequestInterception(true);
    q.on('request',r=>{const u=r.url();if(u.startsWith(base)||u.startsWith('data:')||u.startsWith('blob:')||u.startsWith('about:'))return r.continue();
      if(mode==='abort')return r.abort('internetdisconnected');setTimeout(()=>{ext.push(Date.now());r.respond({status:200,contentType:'text/css',body:''}).catch(()=>{});},1500);});
    await q.evaluateOnNewDocument(PROBE);await q.setViewport({width:390,height:844});
    try{await q.goto(base+'/',{waitUntil:'load',timeout:60000});}catch(e){}
    await W(2600);const f=q.frames().find(x=>x.url().includes('/frame'));return {c,q,f,ext};};
  const ev=async(f,fn)=>{if(!f)return {err:'no frame'};try{return await f.evaluate(fn);}catch(e){return {err:String(e&&e.message||e).slice(0,200)};}};
  try{
    {const o=await open(1500);const m=await ev(o.f,()=>({fcp:Math.round((performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime||-1),paint:Math.round(window.__p1paint||-1),origin:performance.timeOrigin}));
     const ext=o.ext.map(t=>Math.round(t-(m.origin||0)));const first=ext.length?Math.min(...ext):null;
     T('P1 F1 artifact boot: with every outside request held 1500 ms, Home text in the frame is painted (and first contentful paint happens) before any arrives and under 1500 ms',!m.err&&m.paint>0&&m.paint<1500&&m.fcp>0&&m.fcp<1500&&(first===null||m.paint<first),JSON.stringify({fcp:m.fcp,paint:m.paint,err:m.err,ext,first}));await o.c.close();}
    {const o=await open('abort');const L=await ev(o.f,async()=>{await document.fonts.ready;return [...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/['"]/g,'')))];});
     T('P1 F2 artifact offline: with every outside request refused, document.fonts in the frame reports IBM Plex Mono, Manrope and Space Grotesk loaded',Array.isArray(L)&&['IBM Plex Mono','Manrope','Space Grotesk'].every(x=>L.includes(x)),JSON.stringify(L));
     const g=await ev(o.f,()=>{const fb=document.querySelector('style[data-fallback]');return {ready:document.documentElement.hasAttribute('data-fonts-ready'),fbOff:!!(fb&&fb.disabled),touched:[...document.fonts].filter(f=>/Fallback/.test(f.family)&&f.status!=='unloaded').map(f=>f.family+' '+f.weight+' '+f.status)};});
     T('P1 F3 artifact font script: in the frame html carries data-fonts-ready, the fallback block is disabled and no fallback face was looked up (the head script travels with the artifact build)',!!g&&!g.err&&g.ready===true&&g.fbOff===true&&Array.isArray(g.touched)&&g.touched.length===0,JSON.stringify(g));await o.c.close();}
  }finally{await b.close();srv.close();}
};

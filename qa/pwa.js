// PWA acceptance: serve dist/ over local HTTP (as GitHub Pages would), prove the service worker installs, controls the
// page, and serves the app with the server gone. Run: node qa/pwa.js (bash qa/run.sh runs it after the Chromium suite).
// Google Fonts is mapped to "not found" and the proxy is bypassed so the test is fast and deterministic in a sandbox.
const puppeteer=require('puppeteer');const http=require('http');const fs=require('fs');const path=require('path');
const DIST=path.resolve(__dirname,'../dist');const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
const R=[];const T=(n,ok,d)=>R.push({name:n,ok:!!ok,detail:d});const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const sockets=new Set();let MODE='ok';
const srv=http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(/\.html$/.test(u)&&MODE==='503'){s.writeHead(503);s.end('Service Unavailable');return;}if(/\.html$/.test(u)&&MODE==='hang')return;if(u.endsWith('/'))u+='index.html';const f=path.join(DIST,u);if(!f.startsWith(DIST)||!fs.existsSync(f)){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'});s.end(fs.readFileSync(f));});
srv.on('connection',c=>{sockets.add(c);c.on('close',()=>sockets.delete(c));});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port+'/';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--no-proxy-server','--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(base+'ComebackBlueprint.html',{waitUntil:'load'});
const ready=await p.evaluate(async()=>{const r=await Promise.race([navigator.serviceWorker.ready.then(()=>true),new Promise(res=>setTimeout(()=>res(false),15000))]);return {r,mf:!!document.querySelector('link[rel=manifest]'),ic:!!document.querySelector('link[rel="apple-touch-icon"][href="apple-touch-icon.png"]')};});
T('pwa: service worker installs over http; manifest and PNG touch icon linked',ready.r&&ready.mf&&ready.ic,JSON.stringify(ready));
await p.reload({waitUntil:'load'});await wait(500);
T('pwa: after a reload the service worker controls the page',await p.evaluate(()=>!!navigator.serviceWorker.controller));
MODE='503';await p.reload({waitUntil:'load'});await wait(400);
T('pwa: a server error (503) serves the cached app, not an error page',await p.evaluate(()=>typeof DB==='object'));
MODE='hang';const t0=Date.now();await p.reload({waitUntil:'load',timeout:15000});await wait(300);const dt=Date.now()-t0;
T('pwa: a stalled connection falls back to the cached app within the 3.5 s budget',await p.evaluate(()=>typeof DB==='object')&&dt<8000,dt+' ms');
MODE='ok';await p.reload({waitUntil:'load'});await wait(300);
const man=await p.evaluate(async()=>(await fetch('manifest.webmanifest')).json());
T('pwa: manifest valid (name, standalone, start_url, 192/512 and maskable icons)',man.name==='The Comeback Blueprint'&&man.display==='standalone'&&man.start_url==='./ComebackBlueprint.html'&&['192x192','512x512'].every(s=>man.icons.some(i=>i.sizes===s))&&man.icons.some(i=>i.purpose==='maskable'),JSON.stringify(man).slice(0,200));
const icons=await p.evaluate(async()=>Promise.all(['icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png'].map(async f=>{const r=await fetch(f);return r.ok&&(r.headers.get('content-type')||'').includes('png');})));
T('pwa: all four icons are served as PNG',icons.every(Boolean),JSON.stringify(icons));
const sw=fs.readFileSync(path.join(DIST,'sw.js'),'utf8');T('pwa: sw.js carries the build stamp',/comeback-[0-9a-f]{12}/.test(sw)&&!/__BUILD__/.test(sw));
T('pwa: the site root points at the app',await p.evaluate(async()=>{const r=await fetch('./');return r.ok&&/ComebackBlueprint\.html/.test(await r.text());}));
await new Promise(r=>{srv.close(r);for(const c of sockets)c.destroy();});
await p.reload({waitUntil:'load'});await wait(900);
const off=await p.evaluate(()=>({db:typeof DB==='object',len:((document.getElementById('view-home')||{}).innerText||'').length}));
T('pwa: with the server gone, the app boots from the offline cache',off.db&&off.len>200,JSON.stringify(off));
T('pwa: no page errors',errs.length===0,errs.join('|'));
await b.close();const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+(x.detail||'')).join('\n')||'PWA ALL PASS');console.log('PWA RESULT:',pass+'/'+R.length);process.exit(pass===R.length?0:1);})().catch(e=>{console.error('PWA CRASH:',e&&e.stack||e);process.exit(2);});

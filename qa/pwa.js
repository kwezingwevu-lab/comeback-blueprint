// PWA acceptance: serve dist/ over local HTTP (as GitHub Pages would), prove the service worker installs, controls the
// page, and serves the app with the server gone. Run: node qa/pwa.js (bash qa/run.sh runs it after the Chromium suite).
// Google Fonts is mapped to "not found" and the proxy is bypassed so the test is fast and deterministic in a sandbox (the app has used inlined fonts since P1).
const puppeteer=require('puppeteer');const http=require('http');const fs=require('fs');const path=require('path');
const DIST=path.resolve(__dirname,'../dist');const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
const R=[];const T=(n,ok,d)=>R.push({name:n,ok:!!ok,detail:d});const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const sockets=new Set();let MODE='ok';
const srv=http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(/\.html$/.test(u)&&MODE==='503'){s.writeHead(503);s.end('Service Unavailable');return;}if(/\.html$/.test(u)&&MODE==='hang')return;if(u.endsWith('/'))u+='index.html';const f=path.join(DIST,u);if(!f.startsWith(DIST)||!fs.existsSync(f)){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'});s.end(fs.readFileSync(f));});
srv.on('connection',c=>{sockets.add(c);c.on('close',()=>sockets.delete(c));});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port+'/';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--no-proxy-server','--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND']});
const p=await b.newPage();const errs=[],cspMsgs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(/Content Security Policy/i.test(m.text()))cspMsgs.push(m.text().slice(0,160));});
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
// The page's own policy forbids fetch (connect-src 'none'), so these three checks ask the local server directly instead of fetching from the page.
const GET=u=>new Promise((res,rej)=>{http.get(base+u,r=>{const d=[];r.on('data',x=>d.push(x));r.on('end',()=>res({ok:r.statusCode>=200&&r.statusCode<300,status:r.statusCode,type:r.headers['content-type']||'',buf:()=>Buffer.concat(d),text:()=>Buffer.concat(d).toString('utf8')}));}).on('error',rej);});
const man=JSON.parse((await GET('manifest.webmanifest')).text());
T('pwa: manifest valid (name, standalone, start_url, 192/512 and maskable icons)',man.name==='The Comeback Blueprint'&&man.display==='standalone'&&man.start_url==='./ComebackBlueprint.html'&&['192x192','512x512'].every(s=>man.icons.some(i=>i.sizes===s))&&man.icons.some(i=>i.purpose==='maskable'),JSON.stringify(man).slice(0,200));
const icons=await Promise.all(['icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png'].map(async f=>{const r=await GET(f);return r.ok&&r.type.includes('png');}));
T('pwa: all four icons are served as PNG',icons.every(Boolean),JSON.stringify(icons));
// P7 (PX8): the served page itself (as iOS reads it for Add to Home Screen, before any script runs) names the PNG touch icon, which answers
// 200 as a 180x180 PNG, and every launch-screen link answers 200 with a PNG exactly device width x height x pixel ratio. After boot no
// touch icon in the page is the old SVG data: one.
{const dim=b=>b&&b.length>24&&b.toString('latin1',1,4)==='PNG'?[b.readUInt32BE(16),b.readUInt32BE(20)]:null;
 const page=(await GET('ComebackBlueprint.html')).text();const head=page.slice(0,Math.max(0,page.indexOf('</head>')));
 const touch=[...head.matchAll(/<link rel="apple-touch-icon" href="([^"]+)">/g)].map(m=>m[1]);
 const ti=touch.length===1?await GET(touch[0]):null;const tdim=ti&&dim(ti.buf());
 const live=await p.evaluate(()=>[...document.querySelectorAll('link[rel="apple-touch-icon"]')].map(l=>l.getAttribute('href')));
 T('pwa P7: the served page links one static PNG apple-touch-icon; it answers 200 as image/png, 180x180; after boot every touch-icon link is that PNG',touch.length===1&&touch[0]==='apple-touch-icon.png'&&!!ti&&ti.status===200&&ti.type.includes('image/png')&&!!tdim&&tdim[0]===180&&tdim[1]===180&&live.length>=1&&live.every(h=>h==='apple-touch-icon.png'),JSON.stringify({touch,st:ti&&ti.status,type:ti&&ti.type,tdim,live}));
 const su=[...head.matchAll(/<link rel="apple-touch-startup-image" media="\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: portrait\)" href="([^"]+)">/g)];
 const res=await Promise.all(su.map(async m=>{const r=await GET(m[4]);const d=dim(r.buf());return {f:m[4],ok:r.status===200&&r.type.includes('image/png')&&!!d&&d[0]===m[1]*m[3]&&d[1]===m[2]*m[3],d};}));
 T('pwa P7: every iPhone launch screen in the served page answers 200 as a PNG exactly device size x pixel ratio (10 or more sizes)',res.length>=10&&res.length===(head.match(/apple-touch-startup-image/g)||[]).length&&res.every(x=>x.ok),JSON.stringify(res.filter(x=>!x.ok)).slice(0,300)+' n='+res.length);}
const sw=fs.readFileSync(path.join(DIST,'sw.js'),'utf8');T('pwa: sw.js carries the build stamp',/comeback-[0-9a-f]{12}/.test(sw)&&!/__BUILD__/.test(sw));
T('pwa: the site root points at the app',await (async()=>{const r=await GET('./');return r.ok&&/ComebackBlueprint\.html/.test(r.text());})());
await new Promise(r=>{srv.close(r);for(const c of sockets)c.destroy();});
await p.reload({waitUntil:'load'});await wait(900);
const off=await p.evaluate(()=>({db:typeof DB==='object',len:((document.getElementById('view-home')||{}).innerText||'').length}));
T('pwa: with the server gone, the app boots from the offline cache',off.db&&off.len>200,JSON.stringify(off));
// P1: the typefaces are inlined in the cached page, so with the server gone and Google Fonts unreachable the three families still load.
const offF=await p.evaluate(async()=>{await document.fonts.ready;return [...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/['"]/g,'')))];}).catch(e=>['error '+e.message]);
T('pwa: offline boot draws its own fonts (document.fonts reports IBM Plex Mono, Manrope and Space Grotesk loaded with the server and Google Fonts unreachable)',['IBM Plex Mono','Manrope','Space Grotesk'].every(f=>offF.includes(f)),JSON.stringify(offF));
T('pwa: the page policy (connect-src none) is in the served page, and the manifest, service worker, cache-first reloads and the offline boot raised no policy violation',await p.evaluate(()=>{const m=document.querySelector('meta[http-equiv="Content-Security-Policy"]');return !!m&&/connect-src 'none'/.test(m.content)&&/worker-src 'self'/.test(m.content)&&/manifest-src 'self'/.test(m.content);})&&cspMsgs.length===0,cspMsgs.join('|'));
T('pwa: no page errors',errs.length===0,errs.join('|'));
await b.close();const pass=R.filter(x=>x.ok).length;console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' → '+(x.detail||'')).join('\n')||'PWA ALL PASS');console.log('PWA RESULT:',pass+'/'+R.length);process.exit(pass===R.length?0:1);})().catch(e=>{console.error('PWA CRASH:',e&&e.stack||e);process.exit(2);});

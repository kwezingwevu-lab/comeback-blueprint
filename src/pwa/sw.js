/* Service worker for The Comeback Blueprint (installed only when the app is served over http/https, e.g. GitHub Pages).
   Build stamp: __BUILD__ — build.py replaces it with a hash of the app, manifest, icons and this file, so any change
   to any of them installs a fresh worker and cache.
   Page strategy: network first, bypassing the HTTP cache, with a 3.5-second budget. If the network is slow, fails or
   answers with an error (404/503), the cached app is served instead; a late network answer still refreshes the cache.
   Icons and the manifest are cache-first. Cross-origin requests (Google Fonts) are left to the browser. */
const CACHE="comeback-__BUILD__";
const APP="./ComebackBlueprint.html";
const CORE=[APP,"./manifest.webmanifest","./icon-192.png","./icon-512.png","./maskable-512.png","./apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("comeback-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{const req=e.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  // Only the app's own response is ever stored under the app key (a cached root redirect once caused an offline reload loop).
  const isApp=url.pathname.endsWith("/ComebackBlueprint.html");
  if(req.mode==="navigate"||isApp){
    const net=fetch(new Request(req.url,{cache:"no-cache",credentials:"same-origin"})).then(r=>{if(isApp&&r&&r.ok&&r.type==="basic"){const cp=r.clone();caches.open(CACHE).then(c=>c.put(APP,cp));}return r;});
    e.waitUntil(net.then(()=>{},()=>{}));
    e.respondWith((async()=>{const cached=await caches.match(APP);if(!cached)return net;
      const late=new Promise(res=>setTimeout(()=>res(null),3500));
      try{const r=await Promise.race([net,late]);return (r&&r.ok)?r:cached;}catch(err){return cached;}})());
    return;}
  e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;})));});

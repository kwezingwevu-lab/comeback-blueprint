/* Service worker for The Comeback Blueprint (installed only when the app is served over http/https, e.g. GitHub Pages).
   Build stamp: __BUILD__ — build.py replaces it with a hash of the built app, so every new build installs a fresh cache.
   Strategy: the app page is network-first (you always get the latest build when online) with the cached copy as the
   offline fallback; icons and the manifest are cache-first. Cross-origin requests (Google Fonts) are left to the browser. */
const CACHE="comeback-__BUILD__";
const CORE=["./ComebackBlueprint.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./maskable-512.png","./apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("comeback-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{const req=e.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  // Only the app's own response is ever stored under the app key. (Caching the site-root redirect page there once
  // produced an offline reload loop: the cached "app" was a meta-refresh to itself.)
  const APP="./ComebackBlueprint.html",isApp=url.pathname.endsWith("/ComebackBlueprint.html");
  if(req.mode==="navigate"||isApp){e.respondWith(fetch(req).then(r=>{if(isApp&&r&&r.ok&&r.type==="basic"){const cp=r.clone();caches.open(CACHE).then(c=>c.put(APP,cp));}return r;}).catch(()=>caches.match(APP)));return;}
  e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;})));});

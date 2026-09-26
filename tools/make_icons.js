// Renders the app mark to PNG icons for the Home Screen / install manifest.
// iOS ignores SVG apple-touch-icons, so real PNGs are required. Run: node tools/make_icons.js
// Output: src/pwa/icon-180.png (apple-touch-icon), icon-192.png, icon-512.png, icon-maskable-512.png
const puppeteer=require('puppeteer');const path=require('path');
const mark=(size,maskable)=>{const pad=maskable?0.16:0; // maskable: keep the glyph inside the 80% safe zone
  const s=180,inner=s*(1-2*pad),k=inner/180,o=s*pad;
  const path=`M${o+40*k} ${o+138*k}L${o+70*k} ${o+70*k}l${22*k} ${36*k} ${22*k} ${-50*k} ${36*k} ${82*k}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="${size}" height="${size}"><rect width="180" height="180" rx="${maskable?0:40}" fill="#0A0D14"/><path d="${path}" fill="none" stroke="#FFC53D" stroke-width="${14*k}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;};
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});const p=await b.newPage();
for(const [name,size,mk,transparentCorners] of [['icon-180.png',180,false,false],['icon-192.png',192,false,true],['icon-512.png',512,false,true],['icon-maskable-512.png',512,true,false]]){
  // apple-touch-icon must be square and opaque (iOS applies its own mask): no rounded corners on 180
  const svg=name==='icon-180.png'?mark(size,false).replace('rx="40"','rx="0"'):mark(size,mk);
  await p.setViewport({width:size,height:size,deviceScaleFactor:1});
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await p.screenshot({path:path.resolve(__dirname,'../src/pwa/'+name),omitBackground:transparentCorners,clip:{x:0,y:0,width:size,height:size}});
  console.log('wrote src/pwa/'+name);}
await b.close();})();

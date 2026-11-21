// Renders the app mark to the PNG icons the manifest and iOS need, and the iPhone launch screens listed in startup.json.
// Run: node src/pwa/make-icons.js            (everything)
//      node src/pwa/make-icons.js startup    (launch screens only; the icons stay byte-for-byte as they are)
// Square, opaque backgrounds: iOS fills transparent corners with black, and maskable icons need full bleed.
// Launch screens: the app's ink background with the mark centred at 96 CSS px, drawn at the device's pixel ratio, so iOS shows
// the app's own colour (not a white flash) while the Home Screen app starts.
const puppeteer=require('puppeteer');const path=require('path');const fs=require('fs');
const mark=(size,pad)=>{const s=180,sc=(1-2*pad);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${size}" height="${size}"><rect width="${s}" height="${s}" fill="#0A0D14"/><g transform="translate(${s*pad} ${s*pad}) scale(${sc})"><path d="M40 138L70 70l22 36 22-50 36 82" fill="none" stroke="#FFC53D" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;};
const OUT=[["icon-192.png",192,0.04],["icon-512.png",512,0.04],["maskable-512.png",512,0.16],["apple-touch-icon.png",180,0.06]];
const SCREENS=JSON.parse(fs.readFileSync(path.join(__dirname,'startup.json'),'utf8')).screens;
const startupName=s=>`startup-${s.w*s.dpr}x${s.h*s.dpr}.png`;
module.exports={SCREENS,startupName};
if(require.main===module)(async()=>{const only=process.argv[2];const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});const p=await b.newPage();
if(only!=='startup')for(const [f,size,pad] of OUT){await p.setViewport({width:size,height:size,deviceScaleFactor:1});await p.setContent(`<html><body style="margin:0;background:#0A0D14">${mark(size,pad)}</body></html>`);await p.screenshot({path:path.join(__dirname,f),clip:{x:0,y:0,width:size,height:size},omitBackground:false});console.log('wrote',f,size);}
for(const s of SCREENS){await p.setViewport({width:s.w,height:s.h,deviceScaleFactor:s.dpr});
  await p.setContent(`<html><body style="margin:0;width:${s.w}px;height:${s.h}px;background:#0A0D14;display:flex;align-items:center;justify-content:center">${mark(96,0.06)}</body></html>`);
  const f=startupName(s);await p.screenshot({path:path.join(__dirname,f),clip:{x:0,y:0,width:s.w,height:s.h},omitBackground:false});console.log('wrote',f,s.w*s.dpr+'x'+s.h*s.dpr);}
await b.close();})();

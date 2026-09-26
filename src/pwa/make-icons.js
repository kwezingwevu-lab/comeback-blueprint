// Renders the app mark to the PNG icons the manifest and iOS need. Run: node src/pwa/make-icons.js
// Square, opaque backgrounds: iOS fills transparent corners with black, and maskable icons need full bleed.
const puppeteer=require('puppeteer');const path=require('path');
const mark=(size,pad)=>{const s=180,sc=(1-2*pad);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${size}" height="${size}"><rect width="${s}" height="${s}" fill="#0A0D14"/><g transform="translate(${s*pad} ${s*pad}) scale(${sc})"><path d="M40 138L70 70l22 36 22-50 36 82" fill="none" stroke="#FFC53D" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;};
const OUT=[["icon-192.png",192,0.04],["icon-512.png",512,0.04],["maskable-512.png",512,0.16],["apple-touch-icon.png",180,0.06]];
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});const p=await b.newPage();
for(const [f,size,pad] of OUT){await p.setViewport({width:size,height:size,deviceScaleFactor:1});await p.setContent(`<html><body style="margin:0;background:#0A0D14">${mark(size,pad)}</body></html>`);await p.screenshot({path:path.join(__dirname,f),clip:{x:0,y:0,width:size,height:size},omitBackground:false});console.log('wrote',f,size);}
await b.close();})();

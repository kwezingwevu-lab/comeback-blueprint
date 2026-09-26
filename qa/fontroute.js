// Answers the app's Google Fonts requests from qa/fonts, so screenshots show the real typefaces
// (Manrope, IBM Plex Mono, Space Grotesk; SIL OFL 1.1, licences alongside) with no network.
// FONTS=0 falls back to the old behaviour (empty CSS, system fallback fonts).
const fs=require('fs'),path=require('path');const DIR=path.join(__dirname,'fonts');
function fontReply(url){
  if(process.env.FONTS==='0')return null;
  if(url.startsWith('https://fonts.googleapis.com/'))return {status:200,contentType:'text/css',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(path.join(DIR,'fonts.css'),'utf8')};
  if(url.startsWith('https://fonts.gstatic.com/qa/')){const f=path.join(DIR,path.basename(url.split('?')[0]));if(fs.existsSync(f))return {status:200,contentType:'font/woff2',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(f)};}
  return null;}
module.exports={fontReply};

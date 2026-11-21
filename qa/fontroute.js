// Since P1 (Nov 2026) the app carries its three typefaces inlined (style[data-fonts], built from src/fonts), so a page gets the real fonts
// with no network at all. fontReply still answers any Google Fonts request from qa/fonts (an older build, or a mutation that brings a link back).
// FONTS=0 gives a fallback-font run: fontsOff() is a document-start script that removes style[data-fonts] (the metric-matched fallback faces
// in the main stylesheet stay), and fontReply answers nothing.
const fs=require('fs'),path=require('path');const DIR=path.join(__dirname,'fonts');
function fontReply(url){
  if(process.env.FONTS==='0')return null;
  if(url.startsWith('https://fonts.googleapis.com/'))return {status:200,contentType:'text/css',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(path.join(DIR,'fonts.css'),'utf8')};
  if(url.startsWith('https://fonts.gstatic.com/qa/')){const f=path.join(DIR,path.basename(url.split('?')[0]));if(fs.existsSync(f))return {status:200,contentType:'font/woff2',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(f)};}
  return null;}
const FONTS_OFF="(function(){var k=function(){document.querySelectorAll('style[data-fonts]').forEach(function(s){s.remove();});};k();new MutationObserver(k).observe(document,{childList:true,subtree:true});})();";
function fontsOff(){return process.env.FONTS==='0'?FONTS_OFF:';';}
module.exports={fontReply,fontsOff,FONTS_OFF};

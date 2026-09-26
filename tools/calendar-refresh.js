#!/usr/bin/env node
// Calendar refresh helper — finds events the app does not list yet, and listed events whose date moved.
// It NEVER edits the app: it writes tools/out/calendar-candidates.md for a human to approve (CLAUDE.md §7: date, venue,
// status and a source you actually saw). Sources: Peak Timing (schema.org SportsEvent JSON-LD) and RaceSpace's Gauteng
// running listings, month by month for the next 12 months. Fetching uses curl so the sandbox proxy is honoured.
// Usage:  node tools/calendar-refresh.js            live run, writes the report
//         node tools/calendar-refresh.js --geocode  also looks up venue coordinates on OpenStreetMap (1 request/second)
//         node tools/calendar-refresh.js --selftest parser + diff checks on built-in fixtures (runs in qa/run.sh)
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.resolve(__dirname,'..');const HOME_LL=[-26.045,27.955];
const havKm=(a,b)=>{const R=6371,dl=(b[0]-a[0])*Math.PI/180,dn=(b[1]-a[1])*Math.PI/180;const x=Math.sin(dl/2)**2+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dn/2)**2;return Math.round(2*R*Math.asin(Math.sqrt(x)));};
const MON={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
const dec=s=>String(s).replace(/&amp;/g,'&').replace(/&#38;/g,'&').replace(/&#39;|&#x27;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const STOP=new Set(['the','and','race','run','road','km','fun','walk','marathon','half','2026','2027','of','in','by','presented','series','challenge','annual','edition','joburg','johannesburg','gauteng','10k','5k','10km','5km','21km']);
const toks=s=>dec(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g,' ').split(' ').filter(w=>w&&!STOP.has(w)&&!/^\d+$/.test(w));
function appEvents(){const s=fs.readFileSync(path.join(ROOT,'src/app_full.js'),'utf8');const m=s.match(/const RACES_12M=\[[\s\S]*?\n\];/);if(!m)throw new Error('RACES_12M not found');return eval(m[0].replace('const RACES_12M=',''));}
function parsePeak(html){const out=[];const re=/"@type":"SportsEvent","name":"((?:[^"\\]|\\.)*)","startDate":"(\d{4}-\d{2}-\d{2})"[\s\S]*?"location":\{"@type":"Place","name":"((?:[^"\\]|\\.)*)"[\s\S]*?"addressRegion":"((?:[^"\\]|\\.)*)"[\s\S]*?"url":"((?:[^"\\]|\\.)*)"(?:,"description":"((?:[^"\\]|\\.)*)")?/g;let m;
  while((m=re.exec(html))){out.push({src:'Peak Timing',name:dec(JSON.parse('"'+m[1]+'"')),iso:m[2],venue:dec(JSON.parse('"'+m[3]+'"')),region:m[4],url:JSON.parse('"'+m[5]+'"'),dist:m[6]?dec(JSON.parse('"'+m[6]+'"')):''});}return out;}
function parseRaceSpace(html,pageUrl){const out=[];const cards=html.split(/<div class="race-card(?: [^"]*)?">/);cards.shift(); // not race-card__* children
  for(const c of cards){const href=(c.match(/href="(\/race\/[^"]+)"/)||[])[1],name=(c.match(/race-card__section-title">([^<]+)</)||[])[1];const spans=[...c.matchAll(/<span>([^<]+)<\/span>/g)].map(x=>dec(x[1]));
    const dm=(spans[0]||'').match(/^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/);if(!href||!name||!dm)continue;
    out.push({src:'RaceSpace',name:dec(name),iso:dm[3]+'-'+String(MON[dm[2]]).padStart(2,'0')+'-'+dm[1].padStart(2,'0'),venue:spans[1]||'',dist:spans[2]||'',url:'https://www.racespace.co.za'+href,listing:pageUrl});}return out;}
function sameEvent(a,b){const ta=new Set(toks(a.name)),tb=toks(b.name);if(!ta.size||!tb.length)return false;const hit=tb.filter(t=>ta.has(t)).length;if(Math.min(ta.size,tb.length)===1)return ta.size===tb.length&&hit===1; // one-word names must match exactly ("Vaal Marathon" is not "Vaal Has Hills")
  return hit>=2&&hit/Math.min(ta.size,tb.length)>=0.6;}
function diff(found,app){const news=[],moved=[],seen=new Set();
  for(const f of found){const key=toks(f.name).join(' ')+'|'+f.iso;if(seen.has(key))continue;seen.add(key);
    const match=app.find(a=>sameEvent(a,f));if(!match){news.push(f);continue;}
    if(match.iso&&match.iso!==f.iso&&Math.abs((new Date(match.iso)-new Date(f.iso))/864e5)>1)moved.push({app:match,found:f});}
  return {news,moved};}
function curl(url){try{return cp.execFileSync('curl',['-sS','-L','--max-time','45','-A','Mozilla/5.0 (comeback-blueprint calendar check)',url],{encoding:'utf8',maxBuffer:32*1024*1024});}catch(e){return '';}}
function geocode(q){const u='https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=za&q='+encodeURIComponent(q+', Gauteng');const t=curl(u);try{const j=JSON.parse(t);return j[0]?{co:[+(+j[0].lat).toFixed(3),+(+j[0].lon).toFixed(3)],label:j[0].display_name}:null;}catch(e){return null;}}
function selftest(){const R=[];const T=(n,ok)=>R.push([n,!!ok]);
  const pt='[{"@context":"https://schema.org","@type":"SportsEvent","name":"Fat Cats 10K 2026","startDate":"2026-10-11","endDate":"2026-10-11","location":{"@type":"Place","name":"Mall of Africa, Waterfall City","address":{"@type":"PostalAddress","addressRegion":"Gauteng"}},"url":"https://secure.onreg.com/x?id=1","description":"Road \\u2014 10km, 5km"}]';
  const p=parsePeak(pt);T('peak: parses name/date/venue/url/description',p.length===1&&p[0].name==='Fat Cats 10K 2026'&&p[0].iso==='2026-10-11'&&p[0].venue==='Mall of Africa, Waterfall City'&&/10km/.test(p[0].dist));
  const rs='<div class="race-card "> <a href="/race/7091-owl-project" class="race-card__link"> <div class="race-card__container"><div class="race-card__content"> Road Running </div></div><div class="race-card__content-2"> <h3 class="race-card__section-title">Owl Project 5km Fun Run &amp; Walk</h3> <div class="race-card__container-2"><span>10 Oct 2026</span></div><div class="race-card__container-3"><span>Loerie Dog Park, Randburg</span></div><div class="race-card__container-4"><span>5km</span></div></div></a></div>';
  const r=parseRaceSpace(rs,'u');T('racespace: parses card',r.length===1&&r[0].name==='Owl Project 5km Fun Run & Walk'&&r[0].iso==='2026-10-10'&&r[0].venue==='Loerie Dog Park, Randburg');
  const app=[{name:'Owl Project 5 km Fun Run & Walk',iso:'2026-10-10'},{name:'Fat Cats 10K',iso:'2026-10-18'}];
  const d=diff(p.concat(r).concat([{name:'Brand New Trail Race',iso:'2026-11-01'}]),app);
  T('diff: known events matched across spelling, moved date flagged, new event reported',d.news.length===1&&d.news[0].name==='Brand New Trail Race'&&d.moved.length===1&&d.moved[0].found.iso==='2026-10-11');
  T('diff: a shared single word is not a match (Vaal Marathon vs Vaal Has Hills)',!sameEvent({name:'Vaal Marathon'},{name:'Vaal Has Hills'})&&sameEvent({name:'Hope In Motion'},{name:'Hope In Motion'}));
  T('app calendar loads from src',appEvents().length>20);
  R.forEach(([n,ok])=>console.log((ok?'ok   ':'FAIL ')+n));const pass=R.every(x=>x[1]);console.log(pass?'CALENDAR TOOL SELFTEST PASS':'CALENDAR TOOL SELFTEST FAIL');process.exit(pass?0:1);}
async function main(){if(process.argv.includes('--selftest'))return selftest();const geo=process.argv.includes('--geocode');
  const now=new Date(),found=[],log=[];
  const pt=curl('https://www.peaktiming.co.za/');const P=parsePeak(pt).filter(e=>/gauteng/i.test(e.region));log.push('Peak Timing: '+P.length+' Gauteng events'+(pt?'':' (fetch failed)'));found.push(...P);
  for(let i=0;i<12;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);const u='https://www.racespace.co.za/races/running/gauteng/'+d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0');const h=curl(u);const r=parseRaceSpace(h,u);log.push('RaceSpace '+u.slice(-7)+': '+r.length+(h?'':' (fetch failed)'));found.push(...r);}
  const today=now.toISOString().slice(0,10);const app=appEvents();const {news,moved}=diff(found.filter(f=>f.iso>=today),app);
  if(geo)for(const n of news){const g=geocode(n.venue);if(g){n.co=g.co;n.km=havKm(HOME_LL,g.co);n.geo=g.label;}cp.execFileSync('sleep',['1.1']);}
  news.sort((a,b)=>(a.km==null?999:a.km)-(b.km==null?999:b.km)||a.iso.localeCompare(b.iso));
  const md=['# Calendar candidates — '+today,'','Generated by tools/calendar-refresh.js. Nothing here is in the app yet. Add an event only after opening its source and confirming the date and venue; distances come from OpenStreetMap coordinates of the venue (check the match) measured from HOME_LL.','','## Sources read',...log.map(l=>'- '+l),'',
    '## Listed in the app but the date on the source differs ('+moved.length+')',...moved.map(x=>'- **'+x.app.name+'**: app '+x.app.iso+' vs '+x.found.src+' '+x.found.iso+' — '+x.found.url),'',
    '## Not in the app ('+news.length+')','','| date | km | event | venue | distances | source |','|---|---|---|---|---|---|',
    ...news.map(n=>'| '+n.iso+' | '+(n.km!=null?n.km:'?')+' | '+n.name.replace(/\|/g,'/')+' | '+n.venue.replace(/\|/g,'/')+' | '+(n.dist||'').replace(/\|/g,'/')+' | '+n.src+' '+n.url+' |')];
  fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});fs.writeFileSync(path.join(__dirname,'out/calendar-candidates.md'),md.join('\n')+'\n');
  console.log(log.join('\n'));console.log('moved:',moved.length,'· new:',news.length,'→ tools/out/calendar-candidates.md');}
main();

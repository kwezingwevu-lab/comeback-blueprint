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
const MON={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Sept:9,Oct:10,Nov:11,Dec:12};
const dec=s=>String(s).replace(/&amp;/g,'&').replace(/&#38;/g,'&').replace(/&#39;|&#x27;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const STOP=new Set(['the','and','race','run','road','km','fun','walk','marathon','half','2026','2027','of','in','by','presented','series','challenge','annual','edition','joburg','johannesburg','gauteng','10k','5k','10km','5km','21km']);
const toks=s=>dec(s).toLowerCase().normalize('NFKD').replace(/#\s*(\d+)/g,' n$1 ').replace(/[^a-z0-9 ]+/g,' ').split(' ').filter(w=>w&&!STOP.has(w)&&!/^\d+$/.test(w));
function appEvents(){const s=fs.readFileSync(path.join(ROOT,'src/app_full.js'),'utf8');const m=s.match(/const RACES_12M=\[[\s\S]*?\n\];/);if(!m)throw new Error('RACES_12M not found');return eval(m[0].replace('const RACES_12M=',''));}
function parsePeak(html){const out=[];const re=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;let m;
  while((m=re.exec(html))){let j;try{j=JSON.parse(m[1]);}catch(e){continue;}(Array.isArray(j)?j:[j]).forEach(ev=>{if(!ev||ev['@type']!=='SportsEvent')return;const loc=ev.location||{},ad=loc.address||{};
    out.push({src:'Peak Timing',name:dec(ev.name||''),iso:String(ev.startDate||'').slice(0,10),venue:dec(loc.name||''),region:ad.addressRegion||'',url:ev.url||'https://www.peaktiming.co.za/',dist:dec(ev.description||'')});});}
  return out;}
function parseRaceSpace(html,pageUrl){const out=[];const cards=html.split(/<div class="race-card(?: [^"]*)?">/);cards.shift(); // not race-card__* children
  for(const c of cards){const href=(c.match(/href="(\/race\/[^"]+)"/)||[])[1],name=(c.match(/race-card__section-title">([^<]+)</)||[])[1];const spans=[...c.matchAll(/<span>([^<]*)<\/span>/g)].map(x=>dec(x[1]));
    const dm=(spans[0]||'').match(/^(\d{1,2}) ([A-Z][a-z]{2,3}) (\d{4})$/);if(!href||!name||!dm)continue;
    out.push({src:'RaceSpace',name:dec(name),iso:dm[3]+'-'+String(MON[dm[2]]).padStart(2,'0')+'-'+dm[1].padStart(2,'0'),venue:spans[1]||'',dist:spans[2]||'',url:'https://www.racespace.co.za'+href,listing:pageUrl});}return out;}
const approxISO=a=>a.iso||(a.ym?a.ym+'-15':'');
const daysApart=(a,b)=>{const x=approxISO(a),y=approxISO(b);return x&&y?Math.abs((new Date(x)-new Date(y))/864e5):Infinity;};
function sameEvent(a,b){const ta=new Set(toks(a.name)),tb=toks(b.name);if(!ta.size||!tb.length)return false;
  const na=[...ta].filter(x=>/^n\d+$/.test(x)),nb=tb.filter(x=>/^n\d+$/.test(x));if(na.length&&nb.length&&!na.some(x=>nb.includes(x)))return false; // TinMan #4 is not TinMan #5
  const hit=tb.filter(x=>ta.has(x)).length,near=a.iso&&b.iso&&daysApart(a,b)<=3;
  if(Math.min(ta.size,tb.length)===1)return hit===1&&(ta.size===tb.length||!!near); // one-word names: exact, or the same date ("Soweto Marathon" = "African Bank Soweto Marathon")
  return hit>=2&&hit/Math.min(ta.size,tb.length)>=0.6;}
function diff(found,app){const news=[],moved=[],dated=[],seen=new Set();
  for(const f of found){const key=toks(f.name).join(' ')+'|'+f.iso;if(seen.has(key))continue;seen.add(key);
    const cands=app.filter(a=>sameEvent(a,f)).sort((x,y)=>daysApart(x,f)-daysApart(y,f));const match=cands[0];
    if(!match){news.push(f);continue;}
    if(daysApart(match,f)>60){news.push(f);continue;}                       // a different edition, not a moved date
    if(!match.iso){dated.push({app:match,found:f});continue;}                // an "expected" entry now has a published date
    const inside=match.isoEnd&&f.iso>=match.iso&&f.iso<=match.isoEnd;
    if(daysApart(match,f)>1&&!inside)moved.push({app:match,found:f});}
  return {news,moved,dated};}
function curl(url){try{return cp.execFileSync('curl',['-sS','-L','--max-time','45','-A','Mozilla/5.0 (comeback-blueprint calendar check)',url],{encoding:'utf8',maxBuffer:32*1024*1024});}catch(e){return '';}}
function geocode(q){const u='https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=za&q='+encodeURIComponent(q+', Gauteng');const txt=curl(u);
  try{const BAD=new Set(['highway','railway','boundary','waterway','landuse','route']);const hit=JSON.parse(txt).find(x=>!BAD.has(x.class));return hit?{co:[+(+hit.lat).toFixed(3),+(+hit.lon).toFixed(3)],label:hit.display_name,kind:hit.class+'/'+hit.type}:null;}catch(e){return null;}}
function selftest(){const R=[];const T=(n,ok)=>R.push([n,!!ok]);
  const pt='<script type="application/ld+json">{"@type":"Organization","name":"Peak Timing"}</script><script type="application/ld+json">[{"@context":"https://schema.org","@type":"SportsEvent","name":"Fat Cats 10K 2026","startDate":"2026-10-11","location":{"@type":"Place","name":"Mall of Africa, Waterfall City","address":{"@type":"PostalAddress","addressRegion":"Gauteng"}},"url":"https://secure.onreg.com/x?id=1","description":"Road — 10km, 5km"},{"@type":"SportsEvent","name":"The Heroes Marathon","startDate":"2026-11-28","location":{"@type":"Place","name":"Coming soon!"}},{"@type":"SportsEvent","name":"RAC Tough One","startDate":"2026-11-29","location":{"@type":"Place","name":"Randburg Sports Complex","address":{"addressRegion":"Gauteng"}},"url":"https://secure.onreg.com/x?id=8030","description":"Road — 32km, 5km"}]</script>';
  const p=parsePeak(pt);T('peak: JSON-LD parsed as data; an event without region or url does not swallow the next one',p.length===3&&p[0].name==='Fat Cats 10K 2026'&&p[0].venue==='Mall of Africa, Waterfall City'&&p[1].region===''&&p[2].name==='RAC Tough One'&&/8030/.test(p[2].url));
  const card=(date,venue,name)=>'<div class="race-card "> <a href="/race/1-x" class="race-card__link"> <div class="race-card__container"><div class="race-card__content"> Road Running </div></div><div class="race-card__content-2"> <h3 class="race-card__section-title">'+name+'</h3> <div class="race-card__container-2"><span>'+date+'</span></div><div class="race-card__container-3"><span>'+venue+'</span></div><div class="race-card__container-4"><span>5km</span></div></div></a></div>';
  const r=parseRaceSpace(card('10 Oct 2026','Loerie Dog Park, Randburg','Owl Project 5km Fun Run &amp; Walk')+card('27 Sept 2026','Lone Hill Park','Otter Estates Lonehill')+card('24 Sept 2026','','Run Your City Joburg'),'u');
  T('racespace: cards parsed incl. "Sept" and an empty venue',r.length===3&&r[0].iso==='2026-10-10'&&r[1].iso==='2026-09-27'&&r[2].venue===''&&r[2].dist==='5km');
  const app=[{name:'Owl Project 5 km Fun Run & Walk',iso:'2026-10-10'},{name:'Fat Cats 10K',iso:'2026-10-18'},{name:'TinMan Joburg #4 Triathlon',iso:'2026-10-11'},{name:'African Bank Soweto Marathon',iso:'2026-11-29'},{name:'Biogen Half-Marathon',ym:'2027-01'},{name:'Virgin Active HYROX Johannesburg',iso:'2026-11-26',isoEnd:'2026-11-29'},{name:'Vaal Marathon',iso:'2026-09-13'}];
  const d=diff([p[0],r[0],{name:'Brand New Trail Race',iso:'2026-11-01'},{name:'TinMan Joburg #5 Triathlon',iso:'2026-11-29'},{name:'Soweto Marathon 2026',iso:'2026-11-29'},{name:'Biogen Half Marathon 2027',iso:'2027-01-10'},{name:'Virgin Active HYROX Johannesburg 2027',iso:'2027-05-29'},{name:'HYROX Johannesburg',iso:'2026-11-28'},{name:'Vaal Has Hills',iso:'2026-12-05'}],app);
  T('diff: moved date flagged (Fat Cats 18 → 11 Oct)',d.moved.length===1&&d.moved[0].found.iso==='2026-10-11');
  T('diff: TinMan #5 is new, not TinMan #4 moved',d.news.some(x=>/#5/.test(x.name)));
  T('diff: sponsor-less name on the same date matches (Soweto Marathon)',!d.news.some(x=>/Soweto/.test(x.name)));
  T('diff: an expected entry that gains a date is reported',d.dated.length===1&&d.dated[0].found.iso==='2027-01-10');
  T('diff: a 2027 edition is new, a date inside a multi-day event is not moved',d.news.some(x=>/HYROX Johannesburg 2027/.test(x.name))&&!d.moved.some(x=>/HYROX/.test(x.app.name)));
  T('diff: a shared single word is not a match (Vaal Marathon vs Vaal Has Hills)',d.news.some(x=>x.name==='Vaal Has Hills'));
  T('app calendar loads from src',appEvents().length>20);
  R.forEach(([n,ok])=>console.log((ok?'ok   ':'FAIL ')+n));const pass=R.every(x=>x[1]);console.log(pass?'CALENDAR TOOL SELFTEST PASS':'CALENDAR TOOL SELFTEST FAIL');process.exit(pass?0:1);}
async function main(){if(process.argv.includes('--selftest'))return selftest();const geo=process.argv.includes('--geocode');
  const now=new Date(),found=[],log=[];
  const pt=curl('https://www.peaktiming.co.za/');const P=parsePeak(pt).filter(e=>!e.region||/gauteng/i.test(e.region));log.push('Peak Timing: '+P.length+' Gauteng events'+(pt?'':' (fetch failed)'));found.push(...P);
  for(let i=0;i<12;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);const u='https://www.racespace.co.za/races/running/gauteng/'+d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0');let h=curl(u),r=parseRaceSpace(h,u),pages=1;
    for(let pg=2;pg<=8&&h&&h.includes('?page='+pg);pg++){h=curl(u+'?page='+pg);const more=parseRaceSpace(h,u+'?page='+pg);if(!more.length)break;r=r.concat(more);pages++;}
    log.push('RaceSpace '+u.slice(-7)+': '+r.length+' events on '+pages+' page'+(pages>1?'s':''));found.push(...r);}
  const today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10); // local date, not UTC
  const app=appEvents();const {news,moved,dated}=diff(found.filter(f=>f.iso>=today),app);
  if(geo)for(const n of news){const g=n.venue?geocode(n.venue):null;if(g){n.co=g.co;n.km=havKm(HOME_LL,g.co);n.geo=g.label+' ['+g.kind+']';}cp.execFileSync('sleep',['1.1']);}
  news.sort((a,b)=>(a.km==null?999:a.km)-(b.km==null?999:b.km)||a.iso.localeCompare(b.iso));
  const md=['# Calendar candidates — '+today,'','Generated by tools/calendar-refresh.js. Nothing here is in the app yet. Add an event only after opening its source and confirming the date and venue; distances come from OpenStreetMap coordinates of the venue (check the match) measured from HOME_LL.','','## Sources read',...log.map(l=>'- '+l),'',
    '## Listed in the app but the date on the source differs ('+moved.length+')',...moved.map(x=>'- **'+x.app.name+'**: app '+x.app.iso+' vs '+x.found.src+' '+x.found.iso+' — '+x.found.url),'',
    '## Listed as expected in the app, now dated on the source ('+dated.length+')',...dated.map(x=>'- **'+x.app.name+'**: '+x.found.src+' shows '+x.found.iso+' — '+x.found.url),'',
    '## Not in the app ('+news.length+')','','| date | km | event | venue | distances | source | geocode match (check it) |','|---|---|---|---|---|---|---|',
    ...news.map(n=>'| '+n.iso+' | '+(n.km!=null?n.km:'?')+' | '+n.name.replace(/\|/g,'/')+' | '+(n.venue||'(no venue listed)').replace(/\|/g,'/')+' | '+(n.dist||'').replace(/\|/g,'/')+' | '+n.src+' '+n.url+' | '+(n.geo||'').replace(/\|/g,'/')+' |')];
  fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});fs.writeFileSync(path.join(__dirname,'out/calendar-candidates.md'),md.join('\n')+'\n');
  console.log(log.join('\n'));console.log('moved:',moved.length,'· newly dated:',dated.length,'· new:',news.length,'→ tools/out/calendar-candidates.md');}
main();

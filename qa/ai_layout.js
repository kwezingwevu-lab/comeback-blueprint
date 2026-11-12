// Smoke 3: (a) outside the artifact (file://, no window.claude): no AI control anywhere, no console error;
// (b) inside: accessible names, 36 px floor, 16 px textarea, no overflow at 390 and 375, safe-area padding, hover rules, the sheet's rate-limited state.
const {start,W,DEMO}=require('./aih');const path=require('path');const fs=require('fs');const SH='shots';
const puppeteer=require('puppeteer');const GUARD=require('./a11yguard').toString();
const MOCK=(iso)=>{const R=Date;const fixed=new R(iso+'T09:00:00+02:00').getTime();class M extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a);}static now(){return fixed;}}window.Date=M;};
module.exports=async function(T){
  { const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']});
    for(const [iso,seed] of [['2026-11-28',DEMO()],['2026-11-12','']]){const p=await b.newPage();await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('file:')||u.startsWith('data:')||u.startsWith('blob:'))r.continue();else r.respond({status:200,contentType:'text/css',body:''});});
      const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text());});
      await p.evaluateOnNewDocument(MOCK,iso);await p.evaluateOnNewDocument('try{localStorage.clear();}catch(e){}'+seed);await p.setViewport({width:390,height:844});
      await p.goto('file://'+path.join(__dirname,'..','dist','ComebackBlueprint.html'),{waitUntil:'networkidle0'});await W(1500);
      const r=await p.evaluate(()=>{const n=['home','lift','run','roadmap','fuel','numbers','track','guide'].map(v=>{switchView(v);document.querySelectorAll('#view-'+v+' .tool').forEach(t=>t.classList.add('open'));return document.querySelectorAll('[data-ai],[data-ai-chip],[data-ai-open],[data-ai-act],#coachWrap,#coachSheet,.ai-chip,.ai-btn,.ai-box,.coach-wrap').length;});switchView('home');
        const slots=[...document.querySelectorAll('[data-ai-slot]')];return {ok:aiOK(),art:inArtifact(),n,slotsVisible:slots.filter(s=>s.getClientRects().length||s.innerHTML!=='').length,note:(document.getElementById('coachSendNote')||{}).textContent,claude:typeof window.claude,txt:/Ask the coach|Explain this week|Debrief this session/.test(document.body.innerText)};});
      T('outside the artifact on '+iso+': aiOK false, no AI control or AI copy in any of the eight views, slots empty, no console error or warning',!r.ok&&!r.art&&r.n.every(v=>v===0)&&r.slotsVisible===0&&!r.txt&&r.claude==='undefined'&&(iso==='2026-11-12'||r.note==='The app itself sends nothing anywhere.')&&errs.length===0,JSON.stringify({r,errs}));await p.close();}
    await b.close(); }
  const H=await start();
  for(const w of [390,375]){ const p=await H.open({iso:'2026-11-28',seed:DEMO(),w,ai:{delay:40,chunks:['A fairly long answer that has to wrap inside the sheet without pushing anything sideways, with a longwordlikethisonethatcannotbreakanywhereunlessthecsssaysso and a number 102.5 kg × 5. ','Second sentence.']}});
    const scan=()=>p.ev((G)=>{const guard=eval('('+G+')');const out={over:[],small:[],guard:[],font:[]};const vw=document.documentElement.clientWidth;
        document.querySelectorAll('[data-ai] *,[data-ai]').forEach(el=>{const r=el.getBoundingClientRect();if(r.width>0&&(r.right>vw+1||r.left<-1))out.over.push((el.id||el.className||el.tagName)+':'+Math.round(r.left)+'-'+Math.round(r.right));});
        document.querySelectorAll('[data-ai] button,[data-ai] textarea,[data-ai] input,[data-ai] select').forEach(el=>{if(!el.getClientRects().length)return;const r=el.getBoundingClientRect();if(r.height<36)out.small.push((el.id||el.textContent.slice(0,16))+':'+Math.round(r.height));if(/TEXTAREA|INPUT|SELECT/.test(el.tagName)&&parseFloat(getComputedStyle(el).fontSize)<16)out.font.push(el.id);});
        out.guard=guard('body').filter(x=>/ai-|coach|data-ai/.test(x));out.doc=document.documentElement.scrollWidth<=vw+1;return out;},GUARD);
    const res={};
    for(const v of ['home','lift','track','fuel','run']){await p.ev(v=>switchView(v),v);await W(120);res[v]=await scan();}
    await p.ev(()=>{switchView('lift');document.querySelector('#aiDebrief [data-ai-act="deb"]').click();});await p.poll(()=>!aiBusy());await W(100);res.debrief=await scan();
    await p.ev(()=>{switchView('home');document.querySelector('#reviewCard [data-ai-act="rev"]').click();});await p.poll(()=>!aiBusy());await W(100);res.review=await scan();
    await p.ev(()=>document.querySelector('#view-home [data-ai-open="home"]').click());await W(150);await p.ev(()=>document.querySelector('#coachSheet [data-ai-chip="home:1"]').click());await p.poll(()=>!aiBusy());await W(100);res.sheet=await scan();
    const bad=Object.entries(res).filter(([k,v])=>v.err||v.over.length||v.small.length||v.guard.length||v.font.length||!v.doc);
    T('inside at '+w+' px: every AI surface (5 views, debrief, review, sheet with an answer) has no overflow, nothing under 36 px, a 16 px textarea and accessible names',bad.length===0,JSON.stringify(bad).slice(0,900));
    const sh=await p.ev(()=>{const s=document.getElementById('coachSheet'),wr=document.getElementById('coachWrap'),cs=getComputedStyle(s),r=s.getBoundingClientRect(),body=document.getElementById('coachBody');
      const rules=[];const walk=(list,ok)=>{for(const x of list){if(x.cssRules&&x.conditionText!==undefined)walk(x.cssRules,ok||/hover:\s*hover/.test(x.conditionText));else if(x.selectorText&&/:hover/.test(x.selectorText)&&!ok)rules.push(x.selectorText);}};for(const ss of document.styleSheets){try{walk(ss.cssRules,false);}catch(e){}}
      let css='';for(const ss of document.styleSheets){try{for(const x of ss.cssRules)css+=x.cssText||'';}catch(e){}}
      return {bottom:Math.round(window.innerHeight-r.bottom),top:Math.round(r.top),z:getComputedStyle(wr).zIndex,safeB:/\.coach-sheet\s*\{[^}]*safe-area-inset-bottom/.test(css),safeT:/\.coach-wrap\s*\{[^}]*safe-area-inset-top/.test(css),hov:rules,scroll:getComputedStyle(body).overflowY,osb:getComputedStyle(body).overscrollBehaviorY,wrapW:Math.round(body.scrollWidth-body.clientWidth)};});
    T('sheet at '+w+' px: pinned to the bottom, safe-area padding top and bottom, its body scrolls and contains the overscroll, no hover rule outside a hover media query',sh.bottom===0&&sh.top>=12&&sh.safeB&&sh.safeT&&sh.hov.length===0&&sh.scroll==='auto'&&sh.osb==='contain'&&sh.wrapW<=0,JSON.stringify(sh));
    await p.shot(path.join(SH,'20-sheet-answer-'+w+'.png'));
    if(w===390){await p.top(()=>{window.__ai={err:'rate_limited',delay:40};});await p.ev(()=>{const t=document.getElementById('coachQ');t.value='Should I move my long run to Saturday this week?';document.getElementById('coachSend').click();});await p.poll(()=>!aiBusy());await W(120);await p.shot(path.join(SH,'21-sheet-rate-limited.png'));
      // long thread: the body scrolls, the sheet never passes the top inset
      await p.top(()=>{window.__ai={delay:5,chunks:['Para one of a long answer. '.repeat(12)+'\n\n','Para two. '.repeat(30)]};});for(let i=0;i<4;i++){await p.ev(i=>{const t=document.getElementById('coachQ');t.value='Long question number '+i;document.getElementById('coachSend').click();},i);await p.poll(()=>!aiBusy());}
      const lg=await p.ev(()=>{const s=document.getElementById('coachSheet').getBoundingClientRect(),b=document.getElementById('coachBody');return {top:Math.round(s.top),h:Math.round(s.height),scrolls:b.scrollHeight>b.clientHeight,atEnd:(function(){const qs=b.querySelectorAll('.coach-q'),q=qs[qs.length-1].getBoundingClientRect(),br=b.getBoundingClientRect();return q.top>=br.top-1&&(q.top<br.top+40||Math.abs(b.scrollHeight-b.scrollTop-b.clientHeight)<4);})(),inView:document.getElementById('coachSend').getBoundingClientRect().bottom<=window.innerHeight};});
      T('a long thread scrolls inside the sheet with the last question in view (at the top when its answer is longer than the area); the sheet stops under the top inset and the Ask row stays on screen',lg.top>=12&&lg.scrolls&&lg.atEnd&&lg.inView,JSON.stringify(lg));await p.shot(path.join(SH,'22-sheet-long.png'));}
    T('inside at '+w+' px: no page errors',p.errs.length===0,p.errs.join(' | ').slice(0,300));await p.close();}
  await H.close();
};

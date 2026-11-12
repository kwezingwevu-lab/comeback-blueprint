// AI layer, core checks (run by qa/ai.js): Stop, every error class, text never parsed as HTML, Weekly Review explained, the debrief, the read-only
// tools, dialog behaviour, the turn cap, and absence (no "sample": no AI control anywhere).
const {start,W,DEMO}=require('./aih');const path=require('path');const SH='shots';
const setAI=(p,o)=>p.top(o=>{window.__ai=o;},o);
const calls=p=>p.top(()=>window.__aicalls.length);
const ask=async(p,q)=>{await p.ev(q=>{const t=document.getElementById('coachQ');t.value=q;document.getElementById('coachSend').click();},q);};
const idle=p=>p.poll(()=>!aiBusy());
module.exports=async function(T){const H=await start();
  { // ---- A. coach: Stop, errors, XSS, turn cap, dialog
    const p=await H.open({iso:'2026-11-28',seed:DEMO(),ai:{hold:true}});
    await p.ev(()=>{switchView('lift');});await W(150);
    await p.ev(()=>{const b=document.querySelector('#view-lift [data-ai-chip="lift:0"]');b.focus();b.click();});await W(250);
    const th=await p.ev(()=>({open:!!document.getElementById('coachSheet'),think:(document.getElementById('aiLive-coach')||{}).textContent,scope:_ai.scope,lock:getComputedStyle(document.body).overflow+'/'+getComputedStyle(document.documentElement).overflow,hdr:Math.round(document.querySelector('header.app').getBoundingClientRect().top)}));
    T('A1 chip on Lift opens the sheet and shows Thinking',th.open&&th.think==='Thinking…'&&th.scope==='lift',JSON.stringify(th));
    await p.ev(()=>document.getElementById('coachStop').click());await idle(p);await W(100);
    const st=await p.ev(()=>({turns:_ai.turns.length,fail:_ai.fail,body:document.getElementById('coachBody').innerText,note:!!document.getElementById('coachNote'),send:!document.getElementById('coachSend').hidden,chipOn:!document.querySelector('#coachSheet [data-ai-chip]').disabled}));
    const c1=await p.top(()=>window.__aicalls.map(c=>c.end));
    T('A2 Stop: cancelled, nothing shown, controls back',c1.length===1&&c1[0]==='cancelled'&&st.turns===0&&!st.fail&&!st.note&&st.send&&st.chipOn&&!/Claude/.test(st.body),JSON.stringify({c1,st}));
    // error classes
    const tryErr=async(code,extra)=>{await setAI(p,Object.assign({err:code,delay:40},extra||{}));const n0=await calls(p);await ask(p,'Why '+code+'?');await idle(p);await W(120);
      const r=await p.ev(()=>({open:!!document.getElementById('coachSheet'),ok:aiOK(),note:(document.getElementById('coachNote')||{}).textContent||'',body:(document.getElementById('coachBody')||{}).innerText||'',retry:!!document.querySelector('#coachBody [data-ai-act="retry"]'),ta:(document.getElementById('coachQ')||{}).value,turns:_ai.turns.length,html:(document.getElementById('coachBody')||{}).innerHTML||''}));r.calls=(await calls(p))-n0;return r;};
    let r=await tryErr('rate_limited');T('A3 rate_limited: P3 copy, control kept, question back in the box, one call',r.note==='Claude is busy or your usage limit is reached. Try again later.'&&r.open&&r.ok&&r.ta==='Why rate_limited?'&&r.calls===1&&!r.retry&&!/never shown/.test(r.html),JSON.stringify(r));
    await p.ev(()=>{document.getElementById('coachQ').value='';});
    r=await tryErr('session_expired');T('A4 session_expired',r.note==='Sign in to Claude again.'&&r.open&&r.calls===1,JSON.stringify(r));await p.ev(()=>{document.getElementById('coachQ').value='';});
    r=await tryErr('refused',{errAfter:1,chunks:['Partial text that must go. ','x']});T('A5 refused after a chunk: output cleared, copy shown',r.note==='Claude declined that. Rephrase it.'&&!/Partial text/.test(r.body)&&r.calls===1,JSON.stringify(r));await p.ev(()=>{document.getElementById('coachQ').value='';});
    r=await tryErr('empty_completion');T('A6 empty_completion',r.note==='No usable answer. Try again.'&&r.calls===1,JSON.stringify(r));await p.ev(()=>{document.getElementById('coachQ').value='';});
    r=await tryErr('prompt_too_large');T('A7 prompt_too_large (d.ts page-bug class)',/too long to send/.test(r.note)&&!r.retry&&r.calls===1,JSON.stringify(r));await p.ev(()=>{document.getElementById('coachQ').value='';});
    r=await tryErr('upstream_error',{errAfter:1,chunks:['Half an answer about squats. ','never']});
    T('A8 upstream_error: partial kept, marked interrupted, manual retry, no retry from code',/Half an answer about squats/.test(r.body)&&/interrupted/.test(r.body)&&r.retry&&r.calls===1&&r.ta===''&&r.turns===0,JSON.stringify(r));
    await p.shot(path.join(SH,'10-sheet-interrupted.png'));
    await setAI(p,{delay:40,chunks:['<b>bold</b> and <img src=x onerror="window.top.__x=1"> stay text.\n\nSecond paragraph\nline two.']});
    const n0=await calls(p);await p.ev(()=>document.querySelector('#coachBody [data-ai-act="retry"]').click());await idle(p);await W(150);
    const x=await p.ev(()=>({turns:_ai.turns.length,q:_ai.turns[0]&&_ai.turns[0].content,imgs:document.querySelectorAll('#coachSheet img, #coachSheet b').length,txt:document.querySelector('#coachBody .coach-a .ai-txt').textContent,ps:document.querySelectorAll('#coachBody .coach-a .ai-txt p').length,brs:document.querySelectorAll('#coachBody .coach-a .ai-txt br').length}));const xx=await p.top(()=>window.__x);
    T('A9 Try again is one call on a tap; <b> and <img onerror> render as text; paragraphs and lines split',(await calls(p))-n0===1&&x.turns===2&&x.q==='Why upstream_error?'&&x.imgs===0&&/<b>bold<\/b> and <img src=x onerror=/.test(x.txt)&&xx===undefined&&x.ps===2&&x.brs===1,JSON.stringify({x,xx}));
    r=await tryErr('weird_new_code');T('A10 unknown code is treated as upstream_error',r.retry&&/interrupted/i.test(r.note)&&r.calls===1,JSON.stringify(r));
    // turn cap
    await setAI(p,{delay:10,chunks:['ok ','then.']});for(let i=0;i<6;i++){await ask(p,'Question '+i);await idle(p);}
    const cap=await p.ev(()=>({n:_ai.turns.length,first:_ai.turns[0].content}));const last=await p.top(()=>{const c=window.__aicalls[window.__aicalls.length-1];return {n:c.input.length,r0:c.input[0].content.slice(0,24),rl:c.input[c.input.length-1].role};});
    T('A11 at most 8 turns kept and at most rules + 8 sent, rules turn first, ends on user',cap.n===8&&last.n===9&&last.r0==='You are the coach inside'&&last.rl==='user',JSON.stringify({cap,last}));
    // dialog: Tab trap, Escape, focus back, lock released
    const d=await p.ev(()=>{const s=document.getElementById('coachSheet');const ks=k=>document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));const seq=[];s.focus();for(let i=0;i<7;i++){ks('Tab');seq.push(document.activeElement.id||document.activeElement.textContent.slice(0,10));}const inside=seq.every((v,i)=>s.contains(document.activeElement));ks('Escape');
      return {seq,inside,gone:!document.getElementById('coachWrap'),lock:getComputedStyle(document.body).overflow,focus:document.activeElement&&(document.activeElement.dataset.aiChip||document.activeElement.id)};});
    T('A12 Tab stays inside, Escape closes, focus returns to the chip, scroll lock released',d.inside&&d.gone&&d.lock!=='hidden'&&d.focus==='lift:0',JSON.stringify(d));
    // hide-all
    await p.ev(()=>document.querySelector('#view-lift [data-ai-chip="lift:1"]').click());await idle(p);await W(100);
    const sw=await p.top(()=>{const c=window.__aicalls[window.__aicalls.length-1];return {swap:/"swap_candidates":\[/.test(c.input[0].content),q:c.input[c.input.length-1].content,bytes:c.input[0].content.length};});
    T('A13 "A machine is taken" sends the page-computed swap candidates',sw.swap&&/machine is taken/.test(sw.q),JSON.stringify(sw));
    await setAI(p,{err:'not_granted',delay:40});await ask(p,'again');await idle(p);await W(200);
    const h=await p.ev(()=>{const all=v=>{switchView(v);return document.querySelectorAll('[data-ai],[data-ai-chip],[data-ai-open],[data-ai-act],#coachWrap,#coachSheet,.ai-chip,.ai-btn').length;};return {ok:aiOK(),n:['home','lift','run','fuel','track'].map(all),toast:document.getElementById('toast').textContent,lock:getComputedStyle(document.body).overflow,note:(function(){switchView('home');return (document.getElementById('coachSendNote')||{}).textContent;})(),copy:!!document.getElementById('coachBtn')};});
    T('A14 not_granted removes every AI control in every view, closes the sheet, keeps the copy-text check-in',!h.ok&&h.n.every(v=>v===0)&&/not available in this view/.test(h.toast)&&h.lock!=='hidden'&&h.note==='The app itself sends nothing anywhere.'&&h.copy,JSON.stringify(h));
    T('A: no page errors',p.errs.length===0,p.errs.join(' | ').slice(0,400));await p.close();}
  { // ---- B. Weekly Review explained
    const p=await H.open({iso:'2026-11-27',seed:DEMO(),ai:{delay:120,chunks:['What happened: four sessions and three weigh-ins.\n\n','Why the app said so: the rate sits near the target.\n\nOne thing for next week: keep the Sunday run easy.']}});
    await p.ev(()=>{document.getElementById('reviewCard').scrollIntoView({block:'start'});window.scrollBy(0,-70);});
    const b0=await p.ev(()=>{const b=document.querySelector('#reviewCard [data-ai-act="rev"]');return b&&{t:b.textContent,h:Math.round(b.getBoundingClientRect().height)};});
    await p.ev(()=>document.querySelector('#reviewCard [data-ai-act="rev"]').click());await W(60);
    const t0=await p.ev(()=>({think:(document.getElementById('aiLive-rev')||{}).textContent,stop:!!document.querySelector('#aiReview [data-ai-act="stop"]'),others:[...document.querySelectorAll('[data-ai-open],[data-ai-chip]')].every(b=>b.disabled)}));
    await idle(p);await W(100);
    const a=await p.ev(()=>({txt:(document.getElementById('aiOut-rev')||{}).innerText,lab:(document.querySelector('#aiReview .ai-lab')||{}).textContent,btn:document.querySelector('#aiReview [data-ai-act="rev"]').textContent}));
    const c=await p.top(()=>window.__aicalls.map(c=>({cache:c.cache,isStr:typeof c.input==='string',rules:String(c.input).indexOf('You are the coach inside')===0,task:/TASK: Explain this week/.test(c.input),verdict:/"verdict":"/.test(c.input),bytes:String(c.input).length,tools:c.tools})));
    T('B1 Explain this week: Thinking + Stop, one call, cache 6 h, a prompt string with rules + task + the review JSON',b0&&b0.t==='Explain this week'&&b0.h>=40&&t0.think==='Thinking…'&&t0.stop&&t0.others&&c.length===1&&c[0].isStr&&c[0].rules&&c[0].task&&c[0].verdict&&c[0].cache&&c[0].cache.gcTime===21600000&&c[0].tools.length===0,JSON.stringify({b0,t0,c}));
    T('B2 the answer shows with its label',/What happened: four sessions/.test(a.txt)&&/One thing for next week/.test(a.txt)&&a.lab==='Claude · advice, not a plan change'&&a.btn==='Hide the explanation',JSON.stringify(a));
    await p.shot(path.join(SH,'11-review-explained.png'));
    await p.ev(()=>document.querySelector('#aiReview [data-ai-act="rev"]').click());await W(120);const h1=await p.ev(()=>({out:!!document.getElementById('aiOut-rev'),btn:document.querySelector('#aiReview [data-ai-act="rev"]').textContent}));
    await p.ev(()=>document.querySelector('#aiReview [data-ai-act="rev"]').click());await W(120);const h2=await p.ev(()=>({out:!!document.getElementById('aiOut-rev')}));
    T('B3 second and third tap make no call (hide, show)',(await calls(p))===1&&!h1.out&&h1.btn==='Explain this week'&&h2.out,JSON.stringify({h1,h2,n:await calls(p)}));
    await p.ev(()=>{switchView('lift');switchView('home');});const keep=await p.ev(()=>!!document.getElementById('aiOut-rev'));T('B4 the explanation survives a re-render, still no call',keep&&(await calls(p))===1,String(keep));
    await setAI(p,{err:'rate_limited',delay:40});await p.ev(()=>{DB.weight.push({date:'2026-11-26',v:88.9});DB.save();renderHome();});await W(80);
    const nb=await p.ev(()=>({out:!!document.getElementById('aiOut-rev'),btn:(document.querySelector('#aiReview [data-ai-act="rev"]')||{}).textContent}));
    await p.ev(()=>document.querySelector('#aiReview [data-ai-act="rev"]').click());await idle(p);await W(100);
    const e=await p.ev(()=>({note:(document.querySelector('#aiReview .ai-note')||{}).textContent,btn:(document.querySelector('#aiReview [data-ai-act="rev"]')||{}).textContent}));
    T('B5 new data in the week asks again; rate_limited shows its copy and keeps the button',!nb.out&&nb.btn==='Explain this week'&&(await calls(p))===2&&e.note==='Claude is busy or your usage limit is reached. Try again later.'&&e.btn==='Explain this week',JSON.stringify({nb,e}));
    await p.ev(()=>{document.getElementById('reviewCard').scrollIntoView({block:'start'});window.scrollBy(0,-70);});await p.shot(path.join(SH,'12-review-rate-limited.png'));
    T('B: no page errors',p.errs.length===0,p.errs.join(' | ').slice(0,400));await p.close();}
  { // ---- C. Debrief on Lift
    const p=await H.open({iso:'2026-11-28',seed:DEMO(),ai:{delay:100,chunks:['Went well: the squat top set moved.\n','Watch: the last leg-curl set dropped a rep.\n','Next time: own the bottom of the range first.']}});
    await p.ev(()=>switchView('lift'));await W(200);
    const b=await p.ev(()=>({btn:(document.querySelector('#aiDebrief [data-ai-act="deb"]')||{}).textContent,has:aiDebHas(),day:curDay}));
    await p.ev(()=>document.querySelector('#aiDebrief [data-ai-act="deb"]').click());await idle(p);await W(120);
    const a=await p.ev(()=>{const asOf=dateAdd(liftISO(),1),exp=GYM[curDay].ex.filter(e=>((findLiftSession(curDay).entries||{})[e.id]||[]).some(okSet)).map(e=>{const pt=progressTarget(e,asOf);return pt?e.id+'|'+(pt.bo?'top set ':'')+fmtLoad(pt.w)+' × '+pt.reps+(pt.bo?' · back-offs about '+fmtLoad(pt.bo.w)+' × '+pt.bo.reps:''):null;}).filter(Boolean);
      const got=[...document.querySelectorAll('#aiNext p[data-ex]')].map(x=>x.dataset.ex+'|'+x.querySelector('.ai-next-t').textContent);const today=GYM[curDay].ex.map(e=>{const pt=progressTarget(e);return pt?pt.w+'x'+pt.reps:null;});const next=GYM[curDay].ex.map(e=>{const pt=progressTarget(e,asOf);return pt?pt.w+'x'+pt.reps:null;});
      return {exp,got,same:JSON.stringify(exp)===JSON.stringify(got),differs:JSON.stringify(today)!==JSON.stringify(next),txt:(document.getElementById('aiOut-deb')||{}).innerText,lab:(document.querySelector('#aiDebrief .ai-lab')||{}).textContent,head:(document.querySelector('#aiNext .ai-next-h')||{}).textContent};});
    const c=await p.top(()=>window.__aicalls.map(c=>({cache:c.cache,task:/TASK: Debrief this lifting session/.test(c.input),next:/"next_target":"/.test(c.input),today:/"today":"/.test(c.input),tgt:/"target_today":"/.test(c.input),last:/"last_time":"/.test(c.input),bytes:String(c.input).length})));
    T('C1 debrief only with a set logged today; one call with today, target, last time and the engine next target',b.has&&b.btn==='Debrief this session'&&c.length===1&&c[0].task&&c[0].next&&c[0].today&&c[0].tgt&&c[0].last,JSON.stringify({b,c}));
    T('C2 the next-target lines equal progressTarget/topTarget as of tomorrow, and differ from today\'s targets',a.same&&a.got.length>=6&&a.differs&&/Went well/.test(a.txt)&&a.lab==='Claude · advice, not a plan change',JSON.stringify(a).slice(0,900));
    await p.ev(()=>{document.getElementById('aiDebrief').scrollIntoView({block:'start'});window.scrollBy(0,-70);});await W(100);await p.shot(path.join(SH,'13-lift-debrief.png'));
    await p.ev(()=>{window.scrollBy(0,560);});await W(100);await p.shot(path.join(SH,'14-lift-debrief-b.png'));
    // a new set changes the key: the old debrief goes, the button returns; typing goes through the real cell
    const k=await p.ev(()=>{const cells=[...document.querySelectorAll('#liftBody input.cell[data-f="r"]')];const c=cells[0];c.value=String((+c.value||5)+1);c.dispatchEvent(new Event('input',{bubbles:true}));return {out:!!document.getElementById('aiOut-deb'),btn:(document.querySelector('#aiDebrief [data-ai-act="deb"]')||{}).textContent};});
    T('C3 editing a set retires the old debrief (it described other numbers)',!k.out&&k.btn==='Debrief this session'&&(await calls(p))===1,JSON.stringify(k));
    // no set today on another day
    const n=await p.ev(()=>{const pill=[...document.querySelectorAll('#dayPills .pill')].find(x=>x.dataset.d!==curDay);pill.click();return {day:curDay,has:aiDebHas(),box:!!document.getElementById('aiDebrief')};});
    T('C4 a day with no set logged today has no debrief control',!n.has&&!n.box,JSON.stringify(n));
    await p.ev(()=>{switchView('lift');window.scrollTo(0,0);const c=document.querySelector('#view-lift .ai-chips');c.scrollIntoView({block:'center'});});await W(150);await p.shot(path.join(SH,'15-lift-chips.png'));
    for(const v of ['track','fuel','run']){await p.ev(v=>{switchView(v);window.scrollTo(0,0);},v);await W(150);await p.shot(path.join(SH,'16-'+v+'-chips.png'));}
    T('C: no page errors',p.errs.length===0,p.errs.join(' | ').slice(0,400));await p.close();}
  { // ---- D. tools
    const p=await H.open({iso:'2026-11-28',seed:DEMO(),ai:{delay:30,limits:{maxPromptBytes:262144,tools:{maxCount:8}},callTools:[{name:'get_lift_history',input:{id:'ga1'}},{name:'get_lift_history',input:{id:'Leg Press'}},{name:'get_lift_history',input:{id:'nope'}},{name:'get_day_plan',input:{date:'2026-12-01'}},{name:'get_day_plan',input:{date:'tomorrow'}},{name:'get_runs',input:{days:9999}},{name:'get_events',input:{days:84}},{name:'get_review',input:{}}]}});
    await p.ev(()=>{window.top.__snap=()=>JSON.stringify(DB)+'|'+JSON.stringify(Object.keys(localStorage).filter(k=>k!=='cb2_ts').sort().map(k=>[k,localStorage.getItem(k)]));});
    await p.ev(()=>document.querySelector('#view-home [data-ai-open="home"]').click());await W(150);await ask(p,'How is my squat going?');await idle(p);await W(100);
    const c=await p.top(()=>{const c=window.__aicalls[0];return {keys:c.keys,cache:c.cache,tools:c.tools,runs:c.toolRuns.map(r=>({n:r.name,ok:r.ok,b:r.bytes,same:r.same,err:r.err,out:JSON.stringify(r.out||'').slice(0,160)}))};});
    T('D1 with limits().tools the coach offers five read-only tools and omits cache',c.tools.join()==='get_lift_history,get_day_plan,get_runs,get_events,get_review'&&c.cache==='(omitted)'&&c.keys.indexOf('cache')<0,JSON.stringify({k:c.keys,t:c.tools,cache:c.cache}));
    T('D2 every tool result is under 2 KB, bad input throws, DB and localStorage are unchanged',c.runs.filter(r=>r.ok).length===6&&c.runs.filter(r=>r.ok).every(r=>r.b<=2000&&r.same)&&c.runs.filter(r=>!r.ok).length===2,JSON.stringify(c.runs));
    await setAI(p,{delay:30,err:'tools_unavailable',limits:{tools:{maxCount:8}}});await ask(p,'And my runs?');await idle(p);await W(100);
    const tu=await p.ev(()=>({can:aiCan('tools'),ok:aiOK(),note:(document.getElementById('coachNote')||{}).textContent,retry:!!document.querySelector('#coachBody [data-ai-act="retry"]')}));
    await setAI(p,{delay:30});await p.ev(()=>document.querySelector('#coachBody [data-ai-act="retry"]').click());await idle(p);
    const c2=await p.top(()=>{const c=window.__aicalls[window.__aicalls.length-1];return {tools:c.tools,cache:c.cache};});
    T('D3 tools_unavailable hides only the tools: the coach stays, the retry goes without tools and with cache:false',!tu.can&&tu.ok&&/cannot look things up/.test(tu.note)&&tu.retry&&c2.tools.length===0&&c2.cache===false,JSON.stringify({tu,c2}));
    T('D: no page errors',p.errs.length===0,p.errs.join(' | ').slice(0,400));await p.close();}
  { // ---- E. no sample; and limits() failing
    const p=await H.open({iso:'2026-11-28',seed:DEMO(),ai:{none:true}});
    const r=await p.ev(()=>{const n=['home','lift','run','fuel','track','roadmap','numbers','guide'].map(v=>{switchView(v);return document.querySelectorAll('[data-ai],[data-ai-chip],[data-ai-open],[data-ai-act],#coachWrap,.ai-chip,.ai-btn,.ai-box').length;});switchView('home');const slots=[...document.querySelectorAll('[data-ai-slot]')];return {ok:aiOK(),n,slots:slots.length,vis:slots.filter(s=>s.getClientRects().length).length,note:document.getElementById('coachSendNote').textContent,copy:!!document.getElementById('coachBtn')};});
    await p.ev(()=>document.getElementById('coachBtn').click());await W(300);const cp=await p.ev(()=>/Weekly check-in/.test(window.__coach||''));
    T('E1 use("sample") null: no AI control in any view, slots empty and not rendered, the copy-text check-in works',!r.ok&&r.n.every(v=>v===0)&&r.vis===0&&r.note==='The app itself sends nothing anywhere.'&&cp&&(await calls(p))===0,JSON.stringify({r,cp}));
    T('E: no page errors',p.errs.length===0,p.errs.join(' | ').slice(0,400));await p.close();
    const p2=await H.open({iso:'2026-11-28',seed:DEMO(),ai:{limErr:true}});const r2=await p2.ev(()=>({ok:aiOK(),tools:aiCan('tools'),images:aiCan('images'),max:_ai.lim.maxPromptBytes}));
    T('E2 limits() rejecting leaves the text features on and both affordances off',r2.ok&&!r2.tools&&!r2.images&&r2.max===262144,JSON.stringify(r2));await p2.close();}
  { // ---- F. pre-start day: brief button there, no review card, coach context says before Day 1
    const p=await H.open({iso:'2026-11-12',seed:'',ai:{delay:20}});
    const r=await p.ev(()=>({btn:!!document.querySelector('#view-home [data-ai-open="home"]'),rev:!!document.getElementById('aiReview'),ctx:aiContext('home'),bytes:aiBytes(JSON.stringify(aiContext('home')))}));
    T('F1 before Day 1: the coach button is there, no review explain, context says so',r.btn&&!r.rev&&r.ctx.today.state==='before Day 1'&&r.ctx.today.days_to_day1===2,JSON.stringify(r).slice(0,700));
    await p.ev(()=>{const b=document.querySelector('#view-home [data-ai-open="home"]');b.scrollIntoView({block:'center'});});await W(150);await p.shot(path.join(SH,'17-prestart-brief.png'));
    T('F: no page errors',p.errs.length===0,p.errs.join(' | ').slice(0,400));await p.close();}
  await H.close();
};

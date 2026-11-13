// AI-layer acceptance (LEDGER 36): the artifact build in a viewer-like frame with a mock "sample" capability (qa/aih.js).
// Usage: cd qa && node ai.js   (run.sh runs it after qa_full.js). Prints one line per failing check, then AI ALL PASS and AI RESULT: n/n.
process.env.TZ='Africa/Johannesburg';
const R=[];const mk=tag=>(n,ok,d)=>{R.push({name:'AK '+tag+' '+n,ok:!!ok,detail:d});};
(async()=>{
  for(const [tag,file] of [['core','./ai_core'],['layout','./ai_layout'],['log','./ai_log']].filter(x=>!process.env.AI_ONLY||process.env.AI_ONLY.split(',').includes(x[0]))){try{await require(file)(mk(tag));}catch(e){R.push({name:'AK '+tag+': the suite ran to the end',ok:false,detail:String(e&&e.stack||e)});}}
  const pass=R.filter(x=>x.ok).length;
  console.log(R.filter(x=>!x.ok).map(x=>'FAIL: '+x.name+' \u2192 '+String(x.detail||'').replace(/\s+/g,' ').slice(0,700)).join('\n')||'AI ALL PASS');
  console.log('AI RESULT: '+pass+'/'+R.length);process.exit(pass===R.length&&R.length>0?0:1);
})();

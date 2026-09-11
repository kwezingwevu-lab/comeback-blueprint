window.onerror=function(msg,src,line,col,err){try{var d=document.createElement("div");d.style.cssText="position:fixed;left:10px;right:10px;top:70px;z-index:99999;background:#3a0d12;color:#ffb3b8;border:1px solid #a33;border-radius:12px;padding:12px;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;max-height:45vh;overflow:auto";d.textContent="\u26a0\ufe0f App error \u2014 screenshot this:\n"+msg+"\n@ "+line+":"+col+(err&&err.stack?"\n"+String(err.stack).slice(0,500):"");(document.body||document.documentElement).appendChild(d);}catch(_){}};

"use strict";
/* THE COMEBACK BLUEPRINT — Strength + Speed (unified) */
const RACE_ISO="2026-09-24";const START_ISO="2026-09-12";const MILESTONE_ISO="2027-03-06";const MILESTONE_WK=Math.floor(dayDiff(START_ISO,MILESTONE_ISO)/7)+1;const PLAN_WEEKS=9;const ROADMAP_WEEKS=104;
let STORAGE_OK=true;try{const k="__cb2";localStorage.setItem(k,"1");localStorage.removeItem(k);}catch(e){STORAGE_OK=false;}
const mem={};
function load(k,d){try{if(!STORAGE_OK)return k in mem?mem[k]:d;const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function persist(k,v){try{if(!STORAGE_OK){mem[k]=v;return;}localStorage.setItem(k,JSON.stringify(v));}catch(e){mem[k]=v;}}
const DB={
  profile:load("cb2_profile",{weight:88,height:177,age:38,bf:18,goal:102.3,goalBf:24,act:1.55,goal10k:"55:00",phase:"hyper"}),
  sessions:load("cb2_sessions",[]),runs:load("cb2_runs",[]),weight:load("cb2_weight",[]),measure:load("cb2_measure",[]),lifts:load("cb2_lifts",[]),
  save(){persist("cb2_profile",this.profile);persist("cb2_sessions",this.sessions);persist("cb2_runs",this.runs);persist("cb2_weight",this.weight);persist("cb2_measure",this.measure);persist("cb2_lifts",this.lifts);persist("cb2_sleep",this.sleep||[]);persist("cb2_rhr",this.rhr||[]);persist("cb2_steps",this.steps||[]);persist("cb2_ts",Date.now());cloudQueue();}
};
DB.sleep=load("cb2_sleep",[]);DB.rhr=load("cb2_rhr",[]);DB.steps=load("cb2_steps",[]);
if(!load("cb2_pure",false)){DB.profile.phase="hyper";DB.save();persist("cb2_pure",true);}
function todayISO(){return new Date().toISOString().slice(0,10);}
function fmtShort(iso){const d=new Date(iso+"T00:00:00");return d.toLocaleDateString(undefined,{day:'2-digit',month:'2-digit'});}
function fmtLong(iso){const d=new Date(iso+"T00:00:00");return d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});}
function daysToRace(){return Math.max(0,Math.ceil((new Date(RACE_ISO+"T00:00:00")-new Date(todayISO()+"T00:00:00"))/86400000));}
function dateAdd(iso,days){const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
function dayDiff(a,b){return Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000);}
function planStarted(){return dayDiff(START_ISO,todayISO())>=0;}
function daysToStart(){return Math.max(0,dayDiff(todayISO(),START_ISO));}
function planWeek(){if(!planStarted())return 1;return Math.min(104,Math.max(1,Math.floor(dayDiff(START_ISO,todayISO())/7)+1));}
function roadmapWeekNow(){if(!planStarted())return 1;return Math.min(ROADMAP_WEEKS,Math.max(1,Math.floor(dayDiff(START_ISO,todayISO())/7)+1));}
function weekStartISO(wk){return dateAdd(START_ISO,(wk-1)*7);}
function fmtDM(iso){const d=new Date(iso+"T00:00:00");return d.toLocaleDateString(undefined,{day:'numeric',month:'short'});}
function weekRangeLabel(wk){const s=weekStartISO(wk);return fmtDM(s)+" – "+fmtDM(dateAdd(s,6));}
const DOW_INDEX={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6};
const JS_DOW={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
function dateForWeekDay(wk,dowLabel){const s=weekStartISO(wk);const sDow=new Date(s+"T00:00:00").getDay();const off=((JS_DOW[dowLabel]-sDow)+7)%7;return dateAdd(s,off);}
function firstSessionDow(){return DOW[new Date(START_ISO+"T00:00:00").getDay()];}
function parseRest(str){if(!str)return 90;str=String(str).toLowerCase();const m=str.match(/([\d.]+)(?:\s*-\s*([\d.]+))?\s*min/);if(m){const a=parseFloat(m[1]),b=m[2]?parseFloat(m[2]):a;return Math.round((a+b)/2*60);}const s=str.match(/([\d.]+)\s*s/);if(s)return Math.round(parseFloat(s[1]));return 90;}
function computePlates(target,bar){bar=parseFloat(bar)||20;target=parseFloat(target)||0;const sizes=[25,20,15,10,5,2.5,1.25];let per=(target-bar)/2;if(per<0)return null;const out=[];sizes.forEach(p=>{let n=Math.floor(per/p+1e-9);if(n>0){out.push({p,n});per=+(per-n*p).toFixed(4);}});return {perSide:out,leftover:+per.toFixed(2),bar};}
function warmupSets(working){working=parseFloat(working);if(!working||working<=0)return[];const pcts=[0.4,0.6,0.8],reps=[8,5,3];return pcts.map((pc,i)=>({pct:Math.round(pc*100),weight:Math.max(20,Math.round(working*pc/2.5)*2.5),reps:reps[i]}));}
function sessionsThisWeek(){const wk=planWeek(),s=weekStartISO(wk),e=dateAdd(s,7);const lifts=DB.sessions.filter(x=>x.dateISO>=s&&x.dateISO<e&&Object.values(x.entries||{}).some(arr=>arr&&arr.some(st=>st&&st.r&&st.w))).length;const runs=DB.runs.filter(x=>x.date>=s&&x.date<e).length;return {lifts,runs};}
function e1rm(w,r){w=parseFloat(w);r=parseFloat(r);if(!w||!r||w<=0||r<=0)return 0;return w*(1+r/30);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function parseTime(s){if(!s)return 0;const p=String(s).split(":").map(Number);if(p.length===2)return p[0]*60+p[1];if(p.length===3)return p[0]*3600+p[1]*60+p[2];return parseFloat(s)||0;}
function fmtPace(sec){if(!sec||sec<=0||!isFinite(sec))return"—";const m=Math.floor(sec/60),s=Math.round(sec%60);return m+":"+String(s).padStart(2,"0");}
function fmtClock(sec){if(!sec||sec<=0||!isFinite(sec))return"—";const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=Math.round(sec%60);return h?(h+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")):(m+":"+String(s).padStart(2,"0"));}
function toast(msg,cyan){const t=document.getElementById("toast");t.className=(cyan?"cyan ":"")+"show";t.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>'+msg+'</span>';clearTimeout(toast._t);toast._t=setTimeout(()=>{t.className="";},2400);}
const ICON={
  lift:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5l11 11M5 8l-2 2 3 3 2-2M16 5l3 3-2 2-3-3M14.5 9.5l-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  run:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13" cy="4" r="2"/><path d="M5 21l3-6 4-2-2-4 4 1 2 3M9 13l-2-3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rest:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 109 9 7 7 0 01-9-9z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
/* ===== GYM DATA ===== */
const GYM={
  pushA:{name:"Push A",sub:"Chest Focus",ex:[
    {id:"pa1",n:"A1",name:"Barbell Bench Press",tag:"Compound · Barbell",cmp:1,sets:4,reps:"5-8",tempo:"3/1/X/0",rest:"3 min",rir:"1-2",how:"Lie back, grip slightly wider than your shoulders. Lower the bar slowly to your mid-chest, touch lightly, then drive it up powerfully. Shoulder blades pinched, feet planted.",why:"The single best upper-body mass builder. It loads chest, front shoulders and triceps with more weight than anything else, driving the most total growth."},
    {id:"pa2",n:"A2",name:"Standing Overhead Press",tag:"Compound · Barbell",cmp:1,sets:3,reps:"6-10",tempo:"3/0/X/0",rest:"2-3 min",rir:"1-2",how:"Stand tall, bar at your collarbone. Brace abs and glutes, press straight overhead to lockout, lower under control. Don't lean back excessively.",why:"The king of shoulder builders. Pressing overhead while standing works all three shoulder heads plus triceps and core, building round, capped delts."},
    {id:"pa3",n:"A3",name:"Weighted Dip (Chest Lean)",tag:"Compound · Bodyweight+ · Stretch",cmp:1,stretch:1,sets:3,reps:"8-12",tempo:"3/1/X/0",rest:"2 min",rir:"1-2",how:"Lean forward ~30°. Lower slowly until you feel a deep chest stretch, then press up. Add weight with a belt once bodyweight is easy.",why:"A top chest and triceps builder. The forward lean and deep stretch hit the lower chest hard — and loading the stretch is the most powerful growth trigger we know."},
    {id:"pa4",n:"A4",name:"Incline Dumbbell Press",tag:"Compound · Dumbbell",cmp:1,sets:3,reps:"8-12",tempo:"3/0/1/0",rest:"90s",rir:"1-2",how:"Bench at ~30°. Press dumbbells from the sides of your upper chest to over your eyes. Lower slowly to a stretch, press up and slightly together.",why:"Targets the upper chest for a full, square look. Dumbbells allow a deeper stretch and longer range than a barbell — more muscle-building tension."},
    {id:"pa5",n:"A5",name:"Cable Fly (Stretch)",tag:"Isolation · Cable · Stretch",cmp:0,stretch:1,sets:3,reps:"12-15",tempo:"3/1/1/0",rest:"90s",rir:"0-1",how:"Cables at shoulder height, slight elbow bend. Bring hands together in a big hugging arc; let them travel back far enough for a strong chest stretch each rep.",why:"Isolates the chest with constant tension and an exaggerated stretch — the position where it grows best. Finishes the chest after heavy pressing."},
    {id:"pa6",n:"A6",name:"Dumbbell Lateral Raise",tag:"Isolation · Dumbbell",cmp:0,sets:4,reps:"12-20",tempo:"2/0/1/1",rest:"75s",rir:"0-1",how:"Light dumbbells at your sides, lean forward slightly. Raise out to the sides to shoulder height, leading with your elbows. Lower slowly. No swinging.",why:"Side delts give your shoulders width. They respond best to lighter weight and higher reps near failure, exactly what this delivers."},
    {id:"pa7",n:"A7",name:"Overhead Triceps Extension",tag:"Isolation · Cable/DB · Stretch",cmp:0,stretch:1,sets:3,reps:"10-15",tempo:"3/1/1/0",rest:"90s",rir:"1-2",how:"Rope on a low cable or one dumbbell in both hands, hands behind your head. Extend overhead, then lower slowly until you feel a deep triceps stretch.",why:"Stretches the largest triceps head (the long head) under load — grows it far more than pushdowns. The most effective triceps move you can do."}
  ]},
  pullA:{name:"Pull A",sub:"Back Thickness",ex:[
    {id:"la1",post:1,n:"A1",name:"Barbell Row (or Pendlay Row)",tag:"Compound · Barbell",cmp:1,sets:4,reps:"6-10",tempo:"3/1/1/0",rest:"2-3 min",rir:"1-2",how:"Hinge forward to ~45°, back flat. Pull the bar to your lower ribs/belly button, squeezing your shoulder blades, then lower under control.",why:"The best back-thickness builder. It loads lats, mid-back, rear delts and biceps with heavy weight for a dense, 3D back that pulldowns alone can't build."},
    {id:"la2",post:1,n:"A2",name:"Weighted Pull-Up or Lat Pulldown",tag:"Compound · Bodyweight+ · Stretch",cmp:1,stretch:1,sets:3,reps:"8-12",tempo:"3/0/1/1",rest:"2 min",rir:"1-2",how:"Grip slightly wider than shoulders. From a full hang (big stretch), pull your chest toward the bar by driving elbows down and back. Lower slowly to full stretch.",why:"The premier lat-width builder, creating the V-taper. Starting from a full stretch each rep maximises lat growth."},
    {id:"la3",post:1,n:"A3",name:"Chest-Supported Row",tag:"Compound · Machine/DB",cmp:1,sets:3,reps:"10-12",tempo:"2/1/1/0",rest:"90s",rir:"1-2",how:"Chest-down on an incline bench or machine. Pull the weight in, squeezing your shoulder blades hard at the top, then lower slowly.",why:"With your chest supported, your lower back can't cheat — all the effort goes into your mid-back, building dense muscle and better posture."},
    {id:"la4",post:1,n:"A4",name:"Cable Pullover",tag:"Isolation · Cable · Stretch",cmp:0,stretch:1,sets:3,reps:"12-15",tempo:"3/1/1/0",rest:"90s",rir:"0-1",how:"Face a high cable, arms nearly straight. Pull the handle down in an arc to your thighs using your lats, then let it rise for a full lat stretch overhead.",why:"Isolates the lats through a long arc with a deep stretch — the lat version of a fly, loading them where growth is greatest."},
    {id:"la5",post:1,n:"A5",name:"Rear-Delt Fly",tag:"Isolation · Cable/DB",cmp:0,sets:3,reps:"15-20",tempo:"2/1/1/0",rest:"60s",rir:"0-1",how:"Bent over or on a reverse pec-deck, raise the weights out to the sides leading with your elbows, squeezing your shoulder blades. Light and strict.",why:"Rear delts complete a 3D shoulder, balance all your pressing and keep your shoulders healthy. High reps with strict form grow them."},
    {id:"la6",n:"A6",name:"Incline Dumbbell Curl",tag:"Isolation · Dumbbell · Stretch",cmp:0,stretch:1,sets:3,reps:"10-12",tempo:"3/0/1/1",rest:"75s",rir:"1-2",how:"Sit back on an incline bench so your arms hang behind your body. Curl up keeping upper arms still, squeeze, lower slowly to a full stretch.",why:"Arms hanging behind you put the biceps in a deep stretch, roughly doubling the growth stimulus versus standing curls. The best biceps-mass move."},
    {id:"la7",n:"A7",name:"Hammer Curl",tag:"Isolation · Dumbbell",cmp:0,sets:2,reps:"12-15",tempo:"2/0/1/0",rest:"60s",rir:"1-2",how:"Palms facing each other (like holding hammers). Curl up without rotating your wrists, lower slowly.",why:"Builds the brachialis (under the biceps) and forearms, adding thickness and width that regular curls miss."},
    {id:"la8",post:1,n:"A8",name:"Heavy Shrug",tag:"Isolation · Barbell/Dumbbell",cmp:0,sets:3,reps:"8-12",tempo:"2/1/1/1",rest:"90s",rir:"0-1",how:"Stand tall, arms straight, shrug vertically toward your ears — no rolling, ever. Hold a full second at the top, then lower until you feel the traps stretch under load.",why:"Traps were the one large posterior muscle this plan never trained directly. They carry visible thickness across the neck and upper back, they tolerate heavy loads well, and they respond to long top-end holds better than to volume."},
    {id:"la9",n:"A9",name:"Standing Calf Raise (Pull-day dose)",tag:"Isolation \u00b7 Machine/DB \u00b7 Calves",cmp:0,sets:3,reps:"15-25",tempo:"2/2/1/1",rest:"60s",rir:"0-1",how:"Full stretch at the bottom with a 2 s pause, drive to a full lock and squeeze. Straight knees hit the gastrocnemius.",why:"Calves grow on frequency more than anything: four sessions a week beats two, and a pull day costs them nothing in recovery."}
  ]},
  legsA:{name:"Legs A",sub:"Quad Focus",ex:[
    {id:"ga1",n:"A1",name:"Barbell Back Squat (or Hack Squat)",tag:"Compound · Barbell/Machine",cmp:1,sets:4,reps:"5-8",tempo:"3/1/X/0",rest:"3 min",rir:"1-2",how:"Bar on upper back, shoulder-width stance. Sit down and back as deep as you can with a flat back, drive up through your whole foot.",why:"The king of lower-body exercises. It loads quads, glutes and hamstrings heavy while building your core and back — nothing matches its total effect."},
    {id:"ga2",post:1,n:"A2",name:"Romanian Deadlift",tag:"Compound · Barbell · Stretch",cmp:1,stretch:1,sets:3,reps:"8-12",tempo:"4/0/1/0",rest:"2-3 min",rir:"1-2",how:"Bar at your thighs, legs almost straight, back flat. Push your hips back and lower the bar down your legs until you feel a deep hamstring stretch. Drive hips forward to stand.",why:"The best hamstring and glute builder. The deep stretch under load is exactly what makes hamstrings grow, and it strengthens your lower back."},
    {id:"ga3",n:"A3",name:"Leg Press",tag:"Compound · Machine",cmp:1,sets:3,reps:"10-15",tempo:"3/0/1/0",rest:"2 min",rir:"1-2",how:"Feet shoulder-width on the platform. Lower by bending your knees toward your chest as far as comfortable, then press up without locking out hard.",why:"Lets you pile on quad and glute volume safely after squats, when your lower back is tired. Deep reps make it a serious leg builder."},
    {id:"ga4",n:"A4",name:"Walking Lunge",tag:"Compound · Dumbbell · Stretch",cmp:1,stretch:1,sets:2,reps:"12-15/leg",tempo:"2/0/1/0",rest:"90s",rir:"1-2",how:"Dumbbells at your sides, walk forward in long strides, dropping your back knee toward the floor each step. Push through your front heel into the next stride.",why:"Trains each leg alone (fixing imbalances) and stretches the glutes under load. Continuous walking keeps constant tension on quads and glutes."},
    {id:"ga5",n:"A5",name:"Leg Extension",tag:"Isolation · Machine",cmp:0,sets:3,reps:"12-15",tempo:"2/1/1/0",rest:"75s",rir:"0-1",how:"Shins behind the pad. Straighten your legs fully, squeeze your quads hard for a second at the top, lower slowly.",why:"Isolates the quads with a strong top squeeze, letting you target them directly to failure safely after the heavy compounds."},
    {id:"ga6",post:1,n:"A6",name:"Seated Leg Curl",tag:"Isolation · Machine · Stretch",cmp:0,stretch:1,sets:3,reps:"10-15",tempo:"3/1/1/0",rest:"75s",rir:"0-1",how:"Pad on the back of your ankles. Curl your heels down and under you as far as possible, squeeze, return slowly to a stretch.",why:"Directly trains the hamstrings stretched (seated beats lying for growth). Balances all the squatting and protects your knees."},
    {id:"ga7",n:"A7",name:"Standing Calf Raise",tag:"Isolation · Machine · Stretch",cmp:0,stretch:1,sets:4,reps:"10-15",tempo:"2/2/1/1",rest:"60s",rir:"0",how:"Balls of your feet on the edge of the platform. Drop your heels down for a deep 2-second stretch, then rise onto your toes and squeeze.",why:"Calves grow from a full range and deep stretch. Pausing 2 seconds at the bottom dramatically increases calf growth versus bouncing."},
    {id:"ga8",post:1,n:"A8",name:"45° Back Extension (Weighted)",tag:"Compound · Bodyweight+ · Stretch",cmp:1,stretch:1,sets:3,reps:"10-12",tempo:"3/1/1/1",rest:"90s",rir:"1-2",how:"Pads at the hip crease, never up on the ribs. Lower slowly, rounding down through the spine, then extend by squeezing glutes and hamstrings until your body is one straight line — stop there, never arch past it. Hug a plate to your chest once bodyweight gets easy.",why:"Erectors, glutes and hamstrings trained together through a full range with almost none of the spinal fatigue a deadlift costs. This is the movement that makes every squat and pull safer while building the thickness that lives behind you."}
  ]},
  pushB:{name:"Push B",sub:"Shoulder Focus",ex:[
    {id:"pb1",n:"B1",name:"Standing Overhead Press (Heavy)",tag:"Compound · Barbell",cmp:1,sets:4,reps:"5-8",tempo:"3/0/X/0",rest:"3 min",rir:"1-2",how:"Today it's your heavy first lift. Bar at collarbone, brace hard, press straight overhead to lockout, lower under control.",why:"Pressing overhead first when fresh lets you move the most weight and build maximum shoulder and triceps mass. Hitting shoulders heavy twice a week drives faster growth."},
    {id:"pb2",n:"B2",name:"Incline Barbell Bench Press",tag:"Compound · Barbell",cmp:1,sets:3,reps:"6-10",tempo:"3/1/X/0",rest:"2-3 min",rir:"1-2",how:"Bench at ~30°. Lower the bar to your upper chest, touch lightly, press up powerfully. Shoulder blades pinned back.",why:"Overloads the upper chest with heavy weight for a full upper-chest shelf. Pairs with Push A's flat bench to develop the whole chest."},
    {id:"pb3",n:"B3",name:"Machine Chest Press",tag:"Compound · Machine",cmp:1,sets:3,reps:"10-12",tempo:"3/0/1/0",rest:"90s",rir:"1-2",how:"Handles at mid-chest height. Press forward until nearly straight, return slowly until you feel a chest stretch.",why:"Lets you push the chest close to failure safely without a spotter after the heavy barbell work. The fixed path puts all effort into the chest."},
    {id:"pb4",n:"B4",name:"Seated Dumbbell Shoulder Press",tag:"Compound · Dumbbell",cmp:1,sets:3,reps:"8-12",tempo:"3/0/1/0",rest:"90s",rir:"1-2",how:"Upright on a bench with back support. Press dumbbells from shoulder height to overhead, lower slowly to just below shoulder level.",why:"Dumbbells allow a deeper, more natural press than a barbell and let each shoulder work alone. More pressing volume means more shoulder and triceps growth."},
    {id:"pb5",n:"B5",name:"Cable Lateral Raise",tag:"Isolation · Cable",cmp:0,sets:4,reps:"15-20",tempo:"2/0/1/1",rest:"60s",rir:"0-1",how:"Side-on to a low cable, handle in the far hand. Raise out to the side to shoulder height, lower slowly. Cable keeps tension the whole way.",why:"Constant cable tension hits the side delts even harder than dumbbells, especially at the bottom. More side-delt volume builds width."},
    {id:"pb6",n:"B6",name:"Rope Triceps Pushdown",tag:"Isolation · Cable",cmp:0,sets:3,reps:"12-15",tempo:"2/0/1/1",rest:"60s",rir:"0-1",how:"Face a high cable with a rope, elbows pinned to your sides. Push down and spread the rope ends apart at the bottom, return slowly.",why:"Targets the outer triceps head for the horseshoe look, complementing Push A's overhead extensions. The spread maximises the squeeze."},
    {id:"pb7",n:"B7",name:"Deep Push-Up or Dip (to failure)",tag:"Compound · Bodyweight",cmp:1,sets:2,reps:"AMRAP",tempo:"2/0/X/0",rest:"75s",rir:"0",how:"Finish with two all-out sets of deep push-ups or dips, going as deep as possible each rep until you can't do another (AMRAP).",why:"A high-rep deep-stretch finisher that floods the chest, shoulders and triceps with blood and growth-stimulating volume. Safe to failure with no heavy load."}
  ]},
  pullB:{name:"Pull B",sub:"Back Width",ex:[
    {id:"lb1",post:1,n:"B1",name:"Weighted Pull-Up / Pulldown (Heavy)",tag:"Compound · Bodyweight+ · Stretch",cmp:1,stretch:1,sets:4,reps:"6-10",tempo:"3/0/1/1",rest:"2-3 min",rir:"1-2",how:"Vertical pulling is your heavy first move today. From a full stretch, pull your chest to the bar, driving elbows down and back. Add weight so 6-10 reps is hard. Lower slowly.",why:"Hitting the lats heavy when fresh maximises width. Training back twice a week (vertical today, horizontal on Pull A) grows it faster and fuller."},
    {id:"lb2",post:1,n:"B2",name:"Seated Cable Row",tag:"Compound · Cable",cmp:1,sets:3,reps:"8-12",tempo:"2/1/1/0",rest:"2 min",rir:"1-2",how:"Feet on the platform, grab the handle. Pull to your stomach, chest up, squeezing your shoulder blades. Return slowly to a full stretch forward.",why:"A staple back-thickness builder with constant tension. The smooth resistance lets you really feel and squeeze the mid-back through a long range."},
    {id:"lb3",post:1,n:"B3",name:"Single-Arm Dumbbell Row",tag:"Compound · Dumbbell",cmp:1,sets:3,reps:"10-12/arm",tempo:"3/1/1/0",rest:"90s",rir:"1-2",how:"One hand and knee on a bench. Pull the dumbbell from a full stretch up to your hip, squeeze, lower slowly. Keep your back flat.",why:"One side at a time lets you move a big weight through a huge range with a deep stretch, fixing imbalances and building thick lats."},
    {id:"lb4",post:1,n:"B4",name:"Straight-Arm Pulldown",tag:"Isolation · Cable · Stretch",cmp:0,stretch:1,sets:3,reps:"12-15",tempo:"3/1/1/0",rest:"75s",rir:"0-1",how:"Face a high cable with a straight bar, arms nearly straight. Pull the bar to your thighs in an arc using only your lats, let it rise to a full stretch.",why:"Isolates the lats with a strong stretch, teaching you to use them and adding width-focused volume without the biceps. A great lat finisher."},
    {id:"lb5",post:1,n:"B5",name:"Face Pull",tag:"Isolation · Cable",cmp:0,sets:3,reps:"15-20",tempo:"2/1/1/0",rest:"60s",rir:"0-1",how:"Rope at face height. Pull toward your forehead, splitting the rope apart and squeezing your rear shoulders and upper back. Return slowly.",why:"Builds rear delts and upper back while keeping your shoulders healthy against all the pressing. Essential prehab that adds back detail."},
    {id:"lb6",n:"B6",name:"Preacher or Cable Curl",tag:"Isolation · Machine/Cable",cmp:0,sets:3,reps:"10-15",tempo:"3/0/1/1",rest:"75s",rir:"0-1",how:"On a preacher bench or low cable, curl up with strict form, squeeze hard at the top, lower slowly. No swinging.",why:"Keeps constant tension on the biceps and removes momentum, forcing the muscle to do all the work. A different angle than Pull A for complete arms."},
    {id:"lb7",n:"B7",name:"Reverse Curl",tag:"Isolation · Barbell/Cable",cmp:0,sets:2,reps:"12-15",tempo:"2/0/1/0",rest:"60s",rir:"1-2",how:"Palms facing down on a bar. Curl up keeping your wrists firm, lower slowly.",why:"Hammers the forearms and brachialis for thicker arms and a stronger grip that carries over to all your pulling."},
    {id:"lb8",post:1,n:"B8",name:"Prone Y-Raise (Lower Trap)",tag:"Isolation · Dumbbell · Prehab",cmp:0,sets:3,reps:"12-15",tempo:"2/1/2/1",rest:"60s",rir:"1-2",how:"Face down, arms out in a Y at about 45°, thumbs pointing up. Raise light weights by driving your shoulder blades down and back into your pockets, pause at the top, lower slowly. 5 kg is plenty — this is not a strength contest.",why:"Lower traps position the shoulder blade for every press and every row. On a six-day plan carrying this much pressing volume, they are the best insurance available against the shoulder injury that ends a bulk."},
    {id:"lb9",n:"B9",name:"Seated Calf Raise (Pull-day dose)",tag:"Isolation \u00b7 Machine/DB \u00b7 Calves",cmp:0,sets:3,reps:"15-25",tempo:"2/2/1/1",rest:"60s",rir:"0-1",how:"Bent knee takes the gastrocnemius out and loads the soleus, the deep calf that gives the lower leg its width. Pause 2 s at the bottom.",why:"Soleus is half the calf and only trains bent-knee. Standing on one day, seated on another \u2014 that is \u2018all round\u2019."}
  ]},
  legsB:{name:"Legs B",sub:"Posterior Focus",ex:[
    {id:"gb1",post:1,n:"B1",name:"Deadlift (Conventional / Trap Bar)",tag:"Compound · Barbell",cmp:1,sets:4,reps:"4-6",tempo:"2/0/X/0",rest:"3-4 min",rir:"1-2",how:"Bar over mid-foot. Grip it, flatten your back, take the slack out, then stand by driving your feet down and hips forward. Lower under control. Trap bar is easier on the back.",why:"The most complete posterior-chain builder there is — hamstrings, glutes, back and traps under more load than any other lift. Builds full-body strength and dense muscle."},
    {id:"gb2",n:"B2",name:"Bulgarian Split Squat",tag:"Compound · Dumbbell · Stretch",cmp:1,stretch:1,sets:3,reps:"8-12/leg",tempo:"3/1/1/0",rest:"2 min",rir:"1-2",how:"Back foot on a bench behind you, dumbbells in hand. Lower straight down until your back knee nearly touches and your front thigh is parallel, drive up through your front heel.",why:"One of the best single-leg builders. It loads one leg through a deep, stretched range, matching barbell squats for quad and glute growth while fixing imbalances."},
    {id:"gb3",post:1,n:"B3",name:"Hip Thrust",tag:"Compound · Barbell",cmp:1,sets:3,reps:"10-15",tempo:"2/2/1/0",rest:"90s",rir:"0-1",how:"Upper back on a bench, padded barbell across your hips. Drive through your heels until your body is straight from shoulders to knees, squeeze your glutes hard for 2 seconds.",why:"The #1 glute builder in research. The 2-second squeeze where the glutes are fully shortened is exactly where they work hardest, building powerful, fuller glutes."},
    {id:"gb4",post:1,n:"B4",name:"Lying Leg Curl",tag:"Isolation · Machine · Stretch",cmp:0,stretch:1,sets:4,reps:"10-15",tempo:"3/1/1/0",rest:"75s",rir:"0-1",how:"Face-down, pad on the back of your ankles. Curl your heels toward your glutes, squeeze, lower slowly to a full stretch.",why:"Targets the hamstrings from a different angle than seated curls, ensuring complete development and balancing the heavy hinging."},
    {id:"gb5",n:"B5",name:"Hack Squat / Leg Press (Quad)",tag:"Compound · Machine",cmp:1,sets:3,reps:"10-15",tempo:"3/0/1/0",rest:"2 min",rir:"1-2",how:"Feet lower/narrower to bias the quads. Lower deep keeping tension, press up without locking hard.",why:"Adds heavy quad-focused volume in a back-friendly way after deadlifts. Going deep loads the quads fully on your second leg day."},
    {id:"gb6",n:"B6",name:"Seated Calf Raise",tag:"Isolation · Machine · Stretch",cmp:0,stretch:1,sets:4,reps:"15-20",tempo:"2/2/1/1",rest:"60s",rir:"0",how:"Pad over your knees, balls of your feet on the platform. Drop your heels for a deep 2-second stretch, rise up and squeeze.",why:"The seated version targets the deeper calf muscle (soleus), most of your calf size. With standing raises on Legs A, this builds complete calves."},
    {id:"gb7",n:"B7",name:"Weighted Cable Crunch / Hanging Leg Raise",tag:"Core · Cable/Bodyweight",cmp:0,sets:3,reps:"10-15",tempo:"2/1/2/0",rest:"60s",rir:"1-2",how:"Cable crunch: kneel facing the machine, rope behind your head, crunch your ribs to your hips. Or hang and raise your knees/legs under control.",why:"Loaded ab training builds a thicker, more visible six-pack as you grow. Adding resistance grows the abs just like any other muscle."},
    {id:"gb8",post:1,n:"B8",name:"Nordic Hamstring Curl (Eccentric)",tag:"Isolation · Bodyweight · Eccentric",cmp:0,sets:3,reps:"5-8",tempo:"5/0/X/0",rest:"2 min",rir:"0-1",how:"Anchor your heels under something immovable, knees on the mat, body straight from knee to shoulder. Lower forward as slowly as you can — five seconds is the target — then catch yourself with your hands and push back to the top. The lowering is the whole exercise.",why:"The strongest evidence base of any hamstring movement: heavy eccentric knee-flexion builds hamstring strength and length, and roughly halves hamstring injury risk. Machine curls train the same muscle — nothing loads it like this."},
    {id:"gb9",n:"B9",name:"Tibialis Raise",tag:"Isolation \u00b7 Bodyweight+ \u00b7 Calves all round",cmp:0,sets:3,reps:"20-25",tempo:"2/1/2/0",rest:"45s",rir:"0-1",how:"Heels on the floor, lean back against something solid, lift the toes as high as they go and hold a beat. Add a small plate or dumbbell across the toes once 25 reps come easy.",why:"The front of the shin is the muscle that makes calves look complete from the front and protects the shins and knees. Almost nobody trains it; it responds fast."}
  ]},
  upperA:{name:"Upper",sub:"2nd Chest/Back/Shoulder Hit",ex:[
    {id:"ua1",n:"U1",name:"Incline Barbell Bench Press",tag:"Compound · Barbell",cmp:1,sets:4,reps:"6-10",tempo:"3/1/X/0",rest:"2-3 min",rir:"1-2",how:"Bench at ~30°. Lower the bar to your upper chest, touch lightly, then press up powerfully. Shoulder blades pinned back, feet planted.",why:"Your second heavy chest session of the week hits the upper chest specifically. Training a muscle twice a week beats once for growth — this is the frequency that drives gains."},
    {id:"ua2",post:1,n:"U2",name:"Weighted Pull-Up or Lat Pulldown",tag:"Compound · Bodyweight+ · Stretch",cmp:1,stretch:1,sets:4,reps:"8-12",tempo:"3/0/1/1",rest:"2 min",rir:"1-2",how:"Grip slightly wider than shoulders. From a full hang (big stretch), pull your chest toward the bar by driving your elbows down. Lower slowly to a full stretch.",why:"A second weekly lat session for width and that V-taper. Starting from a deep stretch each rep is the strongest growth trigger for the lats."},
    {id:"ua3",n:"U3",name:"Seated Dumbbell Shoulder Press",tag:"Compound · Dumbbell",cmp:1,sets:3,reps:"8-12",tempo:"3/0/1/0",rest:"90s",rir:"1-2",how:"Upright on a bench with back support. Press dumbbells from shoulder height to overhead, lower slowly to just below shoulder level.",why:"Builds round, capped shoulders. Dumbbells move through a deeper, more natural range than a barbell and let each side work on its own."},
    {id:"ua4",post:1,n:"U4",name:"Seated Cable Row",tag:"Compound · Cable",cmp:1,sets:3,reps:"10-12",tempo:"2/1/1/0",rest:"90s",rir:"1-2",how:"Feet on the platform, grab the handle. Pull to your stomach, chest up, squeezing your shoulder blades. Return slowly to a full stretch forward.",why:"Adds mid-back thickness with constant tension. The smooth resistance lets you really feel and squeeze the back through a long range."},
    {id:"ua5",n:"U5",name:"Dumbbell Lateral Raise",tag:"Isolation · Dumbbell",cmp:0,sets:4,reps:"12-20",tempo:"2/0/1/1",rest:"60s",rir:"0-1",how:"Light dumbbells at your sides, lean forward slightly. Raise out to the sides to shoulder height, leading with your elbows. Lower slowly. No swinging.",why:"Side delts give your shoulders their width — the difference between a narrow and a capped look. They thrive on lighter weight and high reps."},
    {id:"ua6",n:"U6",name:"EZ-Bar or Cable Curl",tag:"Isolation · Barbell/Cable",cmp:0,sets:3,reps:"10-12",tempo:"3/0/1/1",rest:"75s",rir:"0-1",how:"Curl up with strict form, squeeze hard at the top, lower slowly under control. No swinging or using your back.",why:"Direct biceps volume on top of all your pulling — the extra work grows the arms faster. A second weekly hit means quicker results."},
    {id:"ua7",n:"U7",name:"Rope Triceps Pushdown",tag:"Isolation · Cable",cmp:0,sets:3,reps:"12-15",tempo:"2/0/1/1",rest:"60s",rir:"0-1",how:"Face a high cable with a rope, elbows pinned to your sides. Push down and spread the rope apart at the bottom, return slowly.",why:"Triceps are most of your arm size. This direct work, twice a week with your pressing, fills out the back of the arm fast."}
  ]},
  extras:{name:"Extras",sub:"Active Recovery Pump · Fridays · RIR 2, no failure",ex:[
    {id:"x1",post:1,n:"X1",name:"Face Pull (rope, high cable)",tag:"Isolation · Cable",cmp:0,sets:3,reps:"15-20",tempo:"2/1/1/1",rest:"60s",rir:"0-1",how:"Set a rope at upper-chest height. Pull it towards your face, elbows high and wide, and finish by squeezing your shoulder blades together and rotating your knuckles back. Light weight, big squeeze.",why:"Builds the rear delts and upper back that pressing days under-hit — better posture, healthier shoulders, and a thicker look from behind. Almost zero recovery cost, perfect for a rest day."},
    {id:"x2",n:"X2",name:"Dumbbell Lateral Raise",tag:"Isolation · Dumbbell",cmp:0,sets:3,reps:"15-20",tempo:"2/0/1/1",rest:"60s",rir:"0-1",how:"Light dumbbells at your sides, slight forward lean. Raise out to shoulder height leading with the elbows, lower slowly. No swinging — if you're swinging, it's too heavy.",why:"Side delts are what make shoulders look wide, and they recover fast — an extra weekly hit here is nearly free growth."},
    {id:"x3",n:"X3",name:"Incline Dumbbell Curl",tag:"Isolation · Dumbbell · Stretch",cmp:0,stretch:1,sets:3,reps:"10-12",tempo:"3/0/1/1",rest:"75s",rir:"0-1",how:"Lie back on a 45-60° incline bench, arms hanging straight down so the biceps start in a deep stretch. Curl up without letting your elbows drift forward, lower slowly all the way down.",why:"The stretched starting position is the strongest growth trigger for the biceps — this is the highest-value curl you can add on a spare day."},
    {id:"x4",n:"X4",name:"Overhead Rope Triceps Extension",tag:"Isolation · Cable · Stretch",cmp:0,stretch:1,sets:3,reps:"12-15",tempo:"3/0/1/1",rest:"75s",rir:"0-1",how:"Face away from a low cable, rope behind your head, elbows pointing forward. Extend to lockout, then lower until you feel a deep stretch behind the arms.",why:"Works the triceps' long head in its stretched position — the part that adds most to arm size and gets least from pressing."},
    {id:"x5",n:"X5",name:"Standing Calf Raise",tag:"Isolation · Machine/DB",cmp:0,sets:3,reps:"12-15",tempo:"2/2/1/1",rest:"60s",rir:"0-1",how:"Ball of the foot on a step or platform. Lower slowly into a full stretch at the bottom, pause two seconds, then drive up onto your toes and squeeze at the top.",why:"Calves grow from full range and frequency — this costs your recovery nothing tomorrow and quietly fixes the classic lagging muscle."},
    {id:"x6",n:"X6",name:"Hanging Knee Raise / Cable Crunch",tag:"Core · Bodyweight/Cable",cmp:0,sets:3,reps:"10-15",tempo:"2/1/2/0",rest:"60s",rir:"1-2",how:"Hang from a bar and raise your knees towards your chest under control — no swinging. Or kneel at a cable with a rope behind your head and crunch ribs to hips.",why:"Loaded ab work builds a thicker, more visible six-pack as you grow. Finishing a light day with core keeps the session short and complete."}
  ]}
};
const GYM_ORDER=["legsA","pushA","pullA","legsB","pushB","pullB"];
const EXMAP={};GYM_ORDER.forEach(k=>GYM[k].ex.forEach(e=>EXMAP[e.id]={name:e.name,day:k}));
const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function weekTemplate(){return [
  {day:"Mon",kind:"lift",label:"Pull A",detail:"Strength — heavy rows and pullovers. Back width is a twice-a-week project now."},
  {day:"Tue",kind:"lift",label:"Legs B",detail:"Volume — hinge-led lower body. Hamstrings, glutes and calves get their second hit, three days after the first."},
  {day:"Wed",kind:"lift",label:"Push B",detail:"Volume — chest, shoulders, triceps from new angles. The second weekly hit is what drives growth."},
  {day:"Thu",kind:"lift",label:"Pull B",detail:"Volume — back thickness and biceps. Rows lead today."},
  {day:"Fri",kind:"rest",label:"Active Recovery",detail:"Minimal rest by design: a 30–40 minute low-stress pump (rear delts, arms, calves, core) at RIR 2, nothing that touches tomorrow's Legs A. Full rest only in deload weeks or when the Weekly Review says so."},
  {day:"Sat",kind:"lift",label:"Legs A",detail:"Strength — squat-led lower body opens the week, fresh off the rest day. Legs twice a week is where mass lives."},
  {day:"Sun",kind:"lift",label:"Push A",detail:"Strength — heavy pressing. Bench and overhead press while the legs recover."}
];}
function dayType(key){return key.indexOf("push")===0?"push":key.indexOf("pull")===0?"pull":key.indexOf("upper")===0?"upper":key.indexOf("extras")===0?"extras":"legs";}
const WARMUP={
  push:"3 min light cardio to raise your temperature. Then 15 band pull-aparts, 10 arm circles each way, 10 band shoulder dislocates and 15 push-ups. Finish with 2 light ramp-up sets of your first press — the empty bar, then about half your working weight.",
  pull:"3 min light cardio. Then 15 band pull-aparts, 10 scapular pull-ups or dead hangs, 15 band face pulls and 10 bodyweight rows. Finish with 2 light ramp-up sets of your first pull before loading up.",
  legs:"3-4 min light cardio (a bike is ideal). Then 10 bodyweight squats, 10 leg swings each way per leg, 10 walking lunges and 15 glute bridges. Finish with 2-3 progressively heavier ramp-up sets of your first lift. Never load heavy cold.",
  upper:"3 min light cardio. Then 15 band pull-aparts, 10 arm circles each way, 10 band shoulder dislocates and 10 scapular pull-ups. Finish with 2 light ramp-up sets of your first press before loading up.",
  extras:"5 min easy walk or bike, 10 arm circles each way, 15 band pull-aparts. First set of each exercise light as a ramp-up — this session is a pump, not a max-out."
};
const COOLDOWN={
  push:"Doorway chest stretch 30s each side, overhead triceps stretch 30s per arm, cross-body shoulder stretch 30s per arm. A few minutes of easy breathing to drop your heart rate.",
  pull:"Hang from the bar 30s, doorframe lat stretch 30s each side, biceps wall stretch 30s per arm. Easy breathing to finish.",
  legs:"Standing quad stretch 30s per leg, seated hamstring stretch 30s per leg, deep squat hold 30s, calf stretch against a wall 30s per leg.",
  upper:"Doorway chest stretch 30s each side, hang from the bar 30s, cross-body shoulder stretch 30s per arm, biceps + triceps stretch 30s each. Easy breathing to finish.",
  extras:"Biceps wall stretch 30s per arm, overhead triceps stretch 30s per arm, calf stretch 30s per leg. Then, ideally, a 15-20 min easy walk — the best active recovery there is."
};
/* ===== RUN PLAN (muscle priority: 2 runs/week — Sun long, Tue easy · 9 weeks, Fri-anchored) ===== */
const RUN_PLAN=[
  {wk:1,phase:"Base",total:"~10 km",long:"6 km",runs:[
    {d:"Sun",t:"long",title:"Long Run — 6 km",det:"Your first run of the plan, the morning after your opening Push day. Slow and steady — time on your feet matters more than speed. Walk breaks are completely fine. This Sunday's race option slots straight in here."},
    {d:"Tue",t:"easy",title:"Easy Run — 4 km",det:"Conversational Zone 2 — you should be able to chat the whole way. A recovery spin."}]},
  {wk:2,phase:"Base",total:"~12 km",long:"7 km",runs:[
    {d:"Sun",t:"long",title:"Long Run — 7 km",det:"Easy and controlled. Practise sipping water and settling into a rhythm you could hold for a long time."},
    {d:"Tue",t:"easy",title:"Easy Run — 5 km",det:"Relaxed Zone 2. This run is for aerobic base and recovery, not a workout."}]},
  {wk:3,phase:"Base",total:"~13 km",long:"8 km",runs:[
    {d:"Sun",t:"long",title:"Long Run — 8 km",det:"Easy pace throughout. Building the base that makes 10 km feel routine. Saturday's race option this week lands on Push day — see its note; keep Sunday's long run honest."},
    {d:"Tue",t:"easy",title:"Easy Run — 5 km + 4 strides",det:"Easy pace, then 4 × 20-second strides (smooth accelerations to ~90% with a full walk-back). Strides keep leg speed without interval fatigue."}]},
  {wk:4,phase:"Build",total:"~14 km",long:"9 km",runs:[
    {d:"Sun",t:"long",title:"Long Run — 9 km",det:"Easy and steady. Fuel beforehand and practise your pre-run routine — the dress rehearsal is next Sunday."},
    {d:"Tue",t:"easy",title:"Easy Run — 5 km",det:"Easy recovery pace. Don't push it."}]},
  {wk:5,phase:"Dress Rehearsal",total:"~15 km",long:"10 km (race)",runs:[
    {d:"Sun",t:"long",title:"Tshwane 10K — Dress Rehearsal",det:"The Absa Run Your City Tshwane 10K IS today's session. Run it at goal 10 km effort to test your pace, fuelling and kit — same series as race day, 4½ weeks out."},
    {d:"Tue",t:"easy",title:"Easy Run — 5 km",det:"Gentle recovery after racing. Legs may be flat — that's normal."}]},
  {wk:6,phase:"Build",total:"~16 km",long:"11 km",runs:[
    {d:"Sun",t:"long",title:"Long Run — 11 km",det:"Easy endurance, comfortably past race distance. If you feel good, run the last 1-2 km a touch faster."},
    {d:"Tue",t:"easy",title:"Easy Run — 5 km + strides",det:"Easy with 4-6 strides. Keeps the legs snappy with minimal fatigue cost to your lifting."}]},
  {wk:7,phase:"Peak",total:"~18 km",long:"12 km",runs:[
    {d:"Sun",t:"long",title:"Long Run — 12 km (peak)",det:"Your longest run. Easy pace. Covering 12 km makes the 10 km race feel short and manageable. Fuel and hydrate like race day. (This Sunday's 5 km race option: skip it, or jog it inside today's distance.)"},
    {d:"Tue",t:"easy",title:"Easy Run — 6 km + strides",det:"Easy with a few strides. Legs may feel heavy — normal in a peak week."}]},
  {wk:8,phase:"Taper",total:"~13 km",long:"9 km",runs:[
    {d:"Sun",t:"long",title:"Race-Pace Finish — 9 km",det:"Volume drops now. Easy for the first 6-7 km, then the last 2-3 km at your goal 10 km pace to rehearse race effort on slightly tired legs. Your one real quality touch."},
    {d:"Tue",t:"easy",title:"Easy Run — 4 km + 4 strides",det:"You can't gain fitness now, only freshness. Easy with 4 strides to keep the legs sharp."}]},
  {wk:9,phase:"Race Week",total:"Race!",long:"RACE",runs:[
    {d:"Sun",t:"easy",title:"Shake-Out — 5 km easy (optional)",det:"Four days out. A gentle 5 km (the Jeppe fun run works) or full rest. Do not race hard. No heavy lifting from here."},
    {d:"Tue",t:"easy",title:"Easy Run — 4 km + 4 strides",det:"Very easy with 4 short strides to stay loose. The work is done. Hydrate well, sleep well, rest your legs."},
    {d:"Thu",t:"race",title:"RACE DAY — Absa RUN YOUR CITY",det:"08h00, Mary Fitzgerald Square. Warm up 10 min easy + a few strides. Go out controlled, settle in, and empty the tank over the final 2 km. You trained on 2 runs a week and built real muscle doing it — now enjoy racing the 10 km."}]}
];
/* ===== GAUTENG WEEKEND RACES (real calendar, Jul–Sep 2026, Joburg-closest first) ===== */
const RACES={
  1:{day:"Sun",date:"26 Jul",name:"Randburg Harriers Challenge",where:"Randburg Sports Complex",dist:"5 / 10 / 21.1 km",loc:"North JHB ⭐"},
  2:{day:"Sun",date:"2 Aug",name:"Evaton Run",where:"Evaton Mall",dist:"5 / 10 / 21.1 km",loc:"South · ~50 km",alt:"or your nearest parkrun (Sat, free)"},
  3:{day:"Sat",date:"8 Aug",name:"Women's Day Run",where:"Prison Break Market, Midrand",dist:"5 / 10 / 16 km",loc:"Midrand · ~25 km"},
  4:{day:"Sat",date:"weekly",name:"parkrun (your nearest)",where:"Delta Park · Marks Park · Modderfontein · Berario…",dist:"5 km",loc:"Free · every Sat 08:00",pr:true},
  5:{day:"Sun",date:"23 Aug",name:"Absa Run Your City Tshwane 10K",where:"Arcadia, Pretoria",dist:"10 km",loc:"~55 km · SAME SERIES",key:true},
  6:{day:"Sat",date:"29 Aug",name:"Women's Half",where:"Wits Education Campus, Parktown",dist:"5 / 10 / 21.1 km",loc:"Central JHB ⭐"},
  7:{day:"Sun",date:"6 Sep",name:"Hope In Motion",where:"Huddle Park, Linksfield",dist:"5 km",loc:"Central JHB ⭐"},
  8:{day:"Sun",date:"13 Sep",name:"Rand Water Vaal River City Marathon",where:"Vanderbijlpark",dist:"5 / 10 / 21.1 km",loc:"South · ~75 km",alt:"or do the planned 9 km race-pace finish locally — taper discipline beats a far drive"},
  9:{day:"Thu",date:"24 Sep",name:"Absa RUN YOUR CITY Joburg 10K",where:"Mary Fitzgerald Sq, Newtown",dist:"10 km",loc:"YOUR GOAL RACE",goal:true,alt:"Sun 20 Sep · Balwin Jeppe (Senderwood, free): 5 km easy shake-out only, or skip it — nothing hard this week"}
};
function raceCallout(wk){const r=RACES[wk];if(!r)return"";
  const cls=r.goal?"goal":r.key?"key":r.taper?"taper":r.pr?"pr":"opt";
  const badge=r.goal?"🏁 Goal Race":r.key?"⭐ Key Tune-Up · Dress Rehearsal":r.taper?"Race-week · easy only":r.pr?"Saturday parkrun · free 5 km":"Weekend race option";
  const advice=r.goal?"This is the one — everything has built to it. 08h00 start; warm up, go controlled, empty the tank over the last 2 km."
    :r.key?"Same series and distance as your goal race — it <b>is</b> this week\'s Sunday session. Run it at goal 10 km effort to test pace, fuelling and kit. Don\'t add a separate long run on top."
    :r.taper?"Only days before your goal race. Easy shake-out only, or skip it. Do not race hard this week."
    :r.pr?"No nearby road race this week — parkrun is your free Saturday option — jog it easy before the Push session, and keep Sunday's long run honest."
    :"Optional. A <b>Sunday</b> race IS this week's long run — slot it straight in. A <b>Saturday</b> race lands on Push day: run the short option easy in the morning, keep the Push session (later, or swapped with Friday's rest), and keep Sunday's long run honest — <b>never let a fun run replace a lift</b>.";
  return `<div class="racecallout ${cls}"><div class="rc-top"><span class="rc-badge">${badge}</span><span class="rc-when">${r.day} ${r.date}</span></div><div class="rc-name">${r.name}</div><div class="rc-meta">${r.where} · ${r.dist} · <b>${r.loc}</b></div><div class="rc-advice">${advice}</div>${r.alt?`<div class="rc-alt">${r.alt}</div>`:""}</div>`;
}
function nextUpcomingRace(){
  const t=todayISO();
  for(let w=Math.max(1,planWeek());w<=PLAN_WEEKS;w++){
    const r=RACES[w];if(!r)continue;
    const d=dateForWeekDay(w,r.day);
    if(d>=t)return {wk:w,r,date:d,days:dayDiff(t,d)};
  }
  return null;
}
function compute(){
  const p=DB.profile,hM=p.height/100;
  const bmr=10*p.weight+6.25*p.height-5*p.age+5,tdee=bmr*parseFloat(p.act);
  const leanNow=p.weight*(1-p.bf/100),ffmi=leanNow/(hM*hM),ffmiNorm=ffmi+6.1*(1.8-hM);
  const ceilLean=(25-6.1*(1.8-hM))*hM*hM,ceilBW=ceilLean/0.82;
  const goalLean=p.goal*(1-(p.goalBf||24)/100),goalFFMInorm=(goalLean/(hM*hM))+6.1*(1.8-hM);
  return {bmr,tdee,leanNow,ffmi,ffmiNorm,ceilLean,ceilBW,goalFFMInorm,hM};
}
let bulkMode=load("cb2_bulk","aggr");
function aggrLive(){return bulkMode==="aggr"&&todayISO()<MILESTONE_ISO;}
let marchKey=load("cb2_march","band");
function marchTarget(k){k=k||marchKey;const p=DB.profile,w=parseFloat(p.weight)||88,bf=parseFloat(p.bf)||18;const leanNow=w*(1-bf/100),fatNow=w-leanNow;
  const weeks=Math.max(1,dayDiff(todayISO(),MILESTONE_ISO)/7);const em=etaModel("aggr"),mo=Math.max(0,Math.round(dayDiff(todayISO(),MILESTONE_ISO)/30.4));const leanM=em.pts[Math.min(mo,em.pts.length-1)].lean;
  const bandKg=Math.round(leanM/0.76*10)/10;const opts={band:{label:"Band-max",kg:bandKg,limit:5,note:"the biggest you can be without leaving your 18\u201324% band"},edge:{label:"Band edge + peak",kg:Math.round((leanM/0.74)*10)/10,limit:7,note:"nudges the band\u2019s edge (~26%) and lets peak-week fullness carry the scale on the day"},mass:{label:"110 kg \u2014 mass-max",kg:110,limit:99,note:"the literal number: outside the band, mostly fat, a long cut afterwards"}};
  const o=opts[k]||opts.band;const rate=Math.max(0,(o.kg-w)/weeks);const fatM=Math.max(0,o.kg-leanM);const bfM=fatM/o.kg*100;const fatGain=fatM-fatNow;const waistEst=fatGain/1.4;const cutWeeks=Math.max(0,Math.round((o.kg-leanM/0.76)/0.5));
  return {k,label:o.label,kg:o.kg,note:o.note,rate,pct:rate/w*100,surplus:Math.round(rate*1100),weeks:Math.round(weeks),leanM,fatM,bfM,fatGain,waistEst,cutWeeks,limit:o.limit,leanGain:leanM-leanNow};}
function marchRateOverride(){if(!aggrLive()||marchKey==="band")return null;return marchTarget().rate;}
function proFactor(){return bulkMode==="cut"?2.4:bulkMode==="aggr"?2.2:2.1;} // lean | balanced | max  (maximum lean gain by default)
function setBulkMode(m){bulkMode=m;persist("cb2_bulk",m);}
function gainModel(phase){
  const w=parseFloat(DB.profile.weight)||85;
  // Maximum *productive* rate of muscle gain (% bodyweight/week). A returning lifter
  // with muscle memory can gain near the top of this; beyond it, extra weight is just fat.
  const maxPct=(phase==="build"||phase==="hyper")?0.005:0; // 0.5%/wk ceiling for lean gain
  const scaler=bulkMode==="cut"?-1.0:bulkMode==="aggr"?(aggrLive()?0.96:0.7):bulkMode==="max"?0.7:bulkMode==="balanced"?0.5:0.3;
  const _ov=marchRateOverride();const rateKgWk=(_ov!=null&&maxPct>0)?_ov:w*maxPct*scaler, ratePctWk=rateKgWk/w;
  const surplus=Math.round(rateKgWk*1100/10)*10; // ~1100 kcal surplus per kg/week of gain
  return {ratePctWk,rateKgWk,rateKgMo:rateKgWk*4.345,surplus,maxRateKgWk:w*maxPct,mode:bulkMode};
}
function actualGainRate(){
  const arr=[...DB.weight].sort((a,b)=>a.date.localeCompare(b.date));
  if(arr.length<2)return null;
  const last=arr[arr.length-1],cutoff=dateAdd(last.date,-28);
  const recent=arr.filter(x=>x.date>=cutoff);
  const pts=recent.length>=2?recent:arr.slice(-2),a=pts[0],z=pts[pts.length-1],days=dayDiff(a.date,z.date);
  if(days<=0)return null;
  return {kgWk:(z.v-a.v)/days*7,days,from:a,to:z,n:pts.length};
}
function actualWaistRate(){
  const arr=[...DB.measure].filter(m=>m.waist!=null).sort((a,b)=>a.date.localeCompare(b.date));
  if(arr.length<2)return null;
  const last=arr[arr.length-1],cutoff=dateAdd(last.date,-35);
  const recent=arr.filter(x=>x.date>=cutoff);
  const pts=recent.length>=2?recent:arr.slice(-2),a=pts[0],z=pts[pts.length-1],days=dayDiff(a.date,z.date);
  if(days<=0)return null;
  return {cmWk:(z.waist-a.waist)/days*7,days,from:a,to:z};
}
function macros(phase){
  const p=DB.profile,c=compute();let surplus,label;
  if(phase==="build"||phase==="hyper"){surplus=gainModel(phase).surplus;label=(bulkMode==="cut"?"mini-cut deficit \u2014 fat off, muscle kept":bulkMode==="aggr"?(aggrLive()?(marchKey==="mass"?"110 by March \u2014 mass-max, outside the band":marchKey==="edge"?"band edge by March + peak week":"aggressive regain (to the 5\u20137 Mar check)"):"aggressive \u2192 stepped down to maximum"):bulkMode==="max"?"maximum lean-gain":bulkMode==="balanced"?"balanced gain":"lean gain")+" surplus";}
  else if(phase==="race"){surplus=150;label="near-maintenance (race week)";}
  else{surplus=0;label="maintenance";}
  const cal=Math.round((c.tdee+surplus)/10)*10,pro=Math.round(p.weight*proFactor()),fat=Math.round(p.weight*0.9);
  const carb=Math.max(0,Math.round((cal-pro*4-fat*9)/4));
  return {cal,pro,fat,carb,surplus,label,tdee:Math.round(c.tdee)};
}
function bestRun(){const rs=DB.runs.filter(r=>parseFloat(r.dist)>0&&parseTime(r.time)>0).sort((a,b)=>String(b.date).localeCompare(String(a.date)));return rs[0]||null;}
function pred10kFromLog(){const r=bestRun();if(!r)return null;const T=parseTime(r.time),D=parseFloat(r.dist);return {t10:T*Math.pow(10/D,1.06),r};}
function paces(){const pl=pred10kFromLog();const t=pl?pl.t10:parseTime(DB.profile.goal10k),p10=t/10;return {race:p10,easy:p10+75,long:p10+60,tempo:p10+18,interval:p10-15,strides:p10-35,t10:t,src:pl?pl.r:null};}
function predict(distKm,timeStr){const T1=parseTime(timeStr),D1=parseFloat(distKm);if(!T1||!D1)return null;const f=d=>T1*Math.pow(d/D1,1.06);return {p5:f(5),p10:f(10),p15:f(15),p21:f(21.1)};}
/* ===== ROUTER ===== */
const views=document.querySelectorAll(".view"),tabs=document.querySelectorAll(".tab");
function switchView(n){
  views.forEach(v=>v.classList.toggle("active",v.id==="view-"+n));
  tabs.forEach(t=>t.classList.toggle("active",t.dataset.view===n));
  const R={home:renderHome,lift:renderLift,run:renderRun,roadmap:renderRoadmap,fuel:renderFuel,numbers:renderNumbers,track:renderTrack,guide:renderGuide};
  if(R[n])R[n]();window.scrollTo({top:0});
  const at=document.querySelector('.tab[data-view="'+n+'"]');if(at&&at.scrollIntoView)at.scrollIntoView({inline:"center",block:"nearest"});
}
tabs.forEach(t=>t.addEventListener("click",()=>switchView(t.dataset.view)));
function ringSVG(frac,color){const Rr=46,Cc=2*Math.PI*Rr,off=Cc*(1-frac);return `<svg width="104" height="104" viewBox="0 0 104 104"><circle cx="52" cy="52" r="${Rr}" fill="none" stroke="var(--line)" stroke-width="8"/><circle cx="52" cy="52" r="${Rr}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${Cc.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>`;}
function updateHeader(){const c=compute();document.getElementById("cdDays").textContent="+"+Math.max(0,c.ceilLean-c.leanNow).toFixed(1);document.getElementById("cdWeek").textContent="W"+planWeek();}
/* ============================================================
   2-YEAR ROADMAP — 104 weekly milestones, model-driven
   ============================================================ */
function buildRoadmap(){
  const base=parseFloat(DB.profile.weight)||85;
  const c=compute();
  // training-phase segments across 104 weeks (Sat 25 Jul 2026 → ~Jun 2028)
  const seg=[
    {n:9,type:"race",d:(bulkMode==="aggr"?(marchKey==="mass"?0.88:marchKey==="edge"?0.56:0.42):0.35),phase:"Base Bulk",blk:"Muscle-priority concurrent",focus:"6 lifting days — every muscle twice a week. A real surplus, with the waist check standing guard."},
    {n:18,type:"regain",d:(bulkMode==="aggr"?(marchKey==="mass"?0.88:marchKey==="edge"?0.56:0.42):0.35),phase:"Reclaim Bulk",blk:"Full 6-day PPL",focus:"Running drops away — push a real surplus. Muscle memory is in full effect: the fastest, easiest gains of the whole two years."},
    {n:(marchKey==="mass"?22:marchKey==="edge"?8:6), type:"cut", d:-0.55,phase:"Mini-Cut I",blk:"6-week cut",focus:"Strip the fat picked up while bulking and reveal the muscle you just reclaimed. Keep protein high, keep lifting heavy."},
    {n:(marchKey==="mass"?5:marchKey==="edge"?19:21),type:"bulk",d:0.14,phase:"New Growth · Block 1",blk:"Lean bulk (2027)",focus:"Now it's genuinely new muscle — slower and earned. Tiny weekly surplus, add weight to the bar relentlessly."},
    {n:6, type:"cut", d:(marchKey==="edge"?-0.7:-0.5),phase:"Mini-Cut II",blk:"Re-lean",focus:"Second cut to stay lean and insulin-sensitive so the next growth block is mostly muscle, not fat."},
    {n:26,type:"bulk",d:(marchKey==="mass"?0.03:0.06), phase:"New Growth · Block 2",blk:"Lean bulk",focus:"Right up against your natural ceiling now — progress is slow but real. Master technique, chase small PRs, eat and sleep with discipline."},
    {n:6, type:"cut", d:(marchKey==="edge"?-0.7:marchKey==="mass"?-0.6:-0.5),phase:"Polish Cut",blk:"Reveal the work (2028)",focus:"Get genuinely lean to show two years of building. This is where the physique 'pops'."},
    {n:12, type:"maintain",d:0.03,phase:"Maintain & Reassess",blk:"Lock it in",focus:"Hold your new set point near the top of your natural range, cement habits, and set fresh goals."}
  ];
  const weeks=[];let bw=base,wk=0;
  seg.forEach((s,si)=>{
    for(let i=0;i<s.n;i++){
      wk++;bw=Math.round((bw+s.d)*100)/100;
      const phaseStart=(i===0);
      let milestone=null,mType=null;
      // priority: race > phase-start > re-test > health > second race
      if(wk===MILESTONE_WK){milestone="🎯 Soft milestone — progress check weekend (5–7 Mar 2027)";mType="race";}
      else if(wk===9){milestone="📈 Week 9 — first bulk block banked";mType="race";}
      else if(phaseStart){milestone="New phase begins: "+s.phase;mType="phase";}
      else if([10,26,40,58,78,96].includes(wk)){milestone="Re-test your big 5 lifts — log new maxes in Track";mType="retest";}
      else if([26,52,78,104].includes(wk)){milestone="🩺 6-monthly bloodwork & health check";mType="health";}
      else if(wk===53){milestone="One year in — compare photos to day one";mType="health";}
      else if(wk===66){milestone="Consider a second race to keep your engine sharp";mType="race";}
      const deload=(wk%6===0)&&s.type!=="cut"&&wk!==9;
      const photos=(wk%4===0);
      weeks.push({wk,start:weekStartISO(wk),range:weekRangeLabel(wk),phase:s.phase,blk:s.blk,focus:s.focus,bw,type:s.type,milestone,mType,deload,photos,segIndex:si});
    }
  });
  return weeks;
}
function roadmapPhases(weeks){
  const out=[];weeks.forEach(w=>{const last=out[out.length-1];if(!last||last.phase!==w.phase){out.push({phase:w.phase,blk:w.blk,type:w.type,focus:w.focus,from:w.wk,to:w.wk,startBw:w.bw,endBw:w.bw,startDate:w.start,weeks:[w]});}else{last.to=w.wk;last.endBw=w.bw;last.weeks.push(w);}});return out;}

function monthLabel(m){const d=new Date(todayISO()+"T12:00:00");d.setMonth(d.getMonth()+m);return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]+" "+d.getFullYear();}
function etaModel(mode){
  const c=compute(),h=(parseFloat(DB.profile.height)||177)/100,ceil=c.ceilLean;mode=mode||bulkMode;
  const base={aggr:0.35,max:0.35,balanced:0.27,lean:0.20}[mode]||0.35;
  const leanAt=f=>(f-6.1*(1.8-h))*h*h;
  const targets=[{k:"ffmi24",v:leanAt(24)},{k:"lean76",v:76},{k:"ffmi25",v:ceil-0.3}];
  let lean=c.leanNow,m=0;const pts=[{m:0,lean}],wp={};const memMo=(mode==="aggr")?Math.max(0,Math.round(dayDiff(todayISO(),MILESTONE_ISO)/30.4)):0;
  while(ceil-lean>0.3&&m<120){const rem=ceil-lean;const rb=(mode==="aggr"&&m<memMo)?0.6:base;lean+=rb*Math.max(0.15,Math.min(1,rem/4));m++;pts.push({m,lean});targets.forEach(t=>{if(wp[t.k]==null&&lean>=t.v)wp[t.k]=m;});}
  return {months:m,pts,wp,ceil,leanNow:c.leanNow,mode};
}
function etaActual(){const a=actualGainRate();if(!a||a.kgWk<=0)return null;const c=compute();const leanMo=Math.min(0.6,a.kgWk*4.345*0.65);let lean=c.leanNow,m=0;const pts=[{m:0,lean}];
  while(c.ceilLean-lean>0.3&&m<180){const rem=c.ceilLean-lean;lean+=leanMo*Math.max(0.15,Math.min(1,rem/4));m++;pts.push({m,lean});}
  return {months:m,leanMo,kgWk:a.kgWk,n:a.n,pts};}
function etaChartSVG(model,best){const W=340,H=150,pl=34,pr=10,pt=14,pb=24;const pts=model.pts;const maxM=Math.max(pts[pts.length-1].m,best?best.pts[best.pts.length-1].m:1,1);
  const yMin=Math.floor(model.leanNow-1),yMax=Math.ceil(model.ceil+0.6);
  const x=m=>pl+(W-pl-pr)*m/maxM,y=v=>pt+(H-pt-pb)*(1-(v-yMin)/(yMax-yMin));
  const P=a=>a.map((p,i)=>(i?"L":"M")+x(p.m).toFixed(1)+" "+y(p.lean).toFixed(1)).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:10px"><line x1="${pl}" x2="${W-pr}" y1="${y(model.ceil).toFixed(1)}" y2="${y(model.ceil).toFixed(1)}" stroke="var(--gold)" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${W-pr}" y="${(y(model.ceil)-4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--gold)" font-family="var(--f-mono)">FFMI 25 \u00b7 ${model.ceil.toFixed(1)} kg lean</text>${best?`<path d="${P(best.pts)}" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-dasharray="2 3"/>`:""}<path d="${P(pts)}" fill="none" stroke="var(--go)" stroke-width="2.5" stroke-linecap="round"/><circle cx="${x(0).toFixed(1)}" cy="${y(model.leanNow).toFixed(1)}" r="3.5" fill="var(--text)"/><text x="4" y="${(y(model.leanNow)+4).toFixed(1)}" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">${model.leanNow.toFixed(0)}</text><text x="${pl}" y="${H-6}" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">now</text><text x="${W-pr}" y="${H-6}" text-anchor="end" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">+${maxM} months</text></svg>`;}
function milestoneProjection(){const daysLeft=dayDiff(todayISO(),MILESTONE_ISO),total=Math.round(dayDiff(START_ISO,MILESTONE_ISO)/7);const weeks=Math.max(0,Math.round(daysLeft/7)),pct=Math.max(0,Math.min(100,Math.round((total-weeks)/total*100)));
  const em=etaModel("aggr"),mo=Math.max(0,Math.round(daysLeft/30.4)),lean=em.pts[Math.min(mo,em.pts.length-1)].lean,h=(parseFloat(DB.profile.height)||177)/100,ffmi=lean/(h*h)+6.1*(1.8-h);
  const rm=buildRoadmap(),row=rm.find(w=>w.wk===MILESTONE_WK);return {daysLeft,weeks,total,pct,lean,ffmi,bw:row?row.bw:null,passed:daysLeft<0};}
function baselineStatus(){const first=k=>DB.measure.find(x=>x[k]!=null&&x[k]!=="");return {waist:!!first("waist"),arm:!!first("arm"),chest:!!first("chest"),thigh:!!first("thigh")};}
function peakWeekHTML(compact){const d=dayDiff(todayISO(),MILESTONE_ISO);
  const days=[["D-7 \u2192 D-4","Train as normal, last two sessions at RIR 2. Carbs 5 g/kg (\u2248"+Math.round(DB.profile.weight*5)+" g). Water 3\u20134 L, sodium normal, creatine 5 g as always."],
    ["D-3 \u2192 D-1","No lower-body session \u2014 legs look fullest loaded, not sore. Carbs 7\u20138 g/kg (\u2248"+Math.round(DB.profile.weight*7.5)+" g) from rice, potatoes, oats, fruit; keep fat low. Do NOT cut sodium or water \u2014 that flattens you. Sleep 8\u20139 h."],
    ["D-1 \u00b7 Thu 4 Mar","30-minute upper-body pump: moderate loads, 15\u201320 reps, nothing to failure. Big carb dinner. Early night."],
    ["Check day \u00b7 Fri 5 Mar","Morning, fasted, before water: weigh in \u2192 waist, arm, chest, thigh tapes exactly as the baseline was taken \u2192 photos front, side, back in the same room and light. Then eat."]];
  const hi=d>=0&&d<=7;
  return `<div class="card" style="border-color:rgba(74,222,128,${hi?".55":".3"})"><div class="card-t" style="color:var(--go)"><span class="ic">${ICON.check}</span>Peak Week \u2014 arrive as big as possible</div>
  <div class="card-st">${hi?"<b>It is peak week.</b> ":""}The natural, legal way to be visibly biggest on 5 March: full muscle glycogen, steady water and sodium, a pump the day before. Worth 1\u20133 kg of real fullness on the day.</div>
  <div style="margin-top:8px">${days.map(([k,v])=>`<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)"><span style="flex:0 0 96px;font-family:var(--f-mono);font-size:12px;color:var(--gold)">${k}</span><span style="font-size:13px;color:var(--text-2);line-height:1.5">${v}</span></div>`).join("")}</div>
  <div class="calc-note" style="margin-top:10px"><b>Honest label:</b> peak week adds glycogen and water, not muscle \u2014 real fullness, temporary. It exists so the check compares like with like, and it only works if the September baseline was measured the same way.</div>${compact?"":""}</div>`;}
function baselineRowHTML(){const b=baselineStatus();const n=Object.values(b).filter(Boolean).length;
  const chip=(k,l)=>`<span style="padding:3px 8px;border-radius:7px;font-size:11px;font-family:var(--f-mono);background:${b[k]?"rgba(74,222,128,.14)":"rgba(255,107,122,.12)"};color:${b[k]?"var(--go)":"var(--bad)"}">${b[k]?"\u2713":"!"} ${l}</span>`;
  return `<div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--panel-3)"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b style="font-size:13px">Baseline tapes ${n}/4</b><div style="display:flex;gap:6px;flex-wrap:wrap">${chip("waist","waist")}${chip("arm","arm")}${chip("chest","chest")}${chip("thigh","thigh")}</div></div>
  <div style="font-size:12px;color:var(--text-3);margin-top:6px;line-height:1.45">${n===4?"Baseline complete \u2014 March will be measured against real numbers.":"Without these, \u201cbigger\u201d on 5 March is a feeling. Log all four this week, same time of day, and it becomes a number \u2014 add neck in Track and the app estimates your body fat from tape."}</div>
  ${n<4?`<button class="btn btn-gold" style="width:100%;margin-top:8px" onclick="switchView('track')">Log baseline tapes now</button>`:""}</div>`;}
function marchSelectorHTML(){const cur=marchTarget();const rows=["band","edge","mass"].map(k=>marchTarget(k));
  return `<div style="margin-top:12px"><div class="calc-note" style="margin-bottom:8px"><b>March target \u2014 choose the route, see the price:</b></div>
  <div class="seg" id="marchSeg">${rows.map(r=>`<button data-mk="${r.k}"${r.k===marchKey?" class=on":""}>${r.k==="mass"?"110 kg":"~"+r.kg.toFixed(0)+" kg"}</button>`).join("")}</div>
  <div style="margin-top:10px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:11px;white-space:nowrap"><thead><tr style="color:var(--text-3);font-family:var(--f-mono);font-size:10px;text-align:right"><th style="text-align:left;padding:4px 2px">route</th><th style="padding:4px 3px">kg</th><th style="padding:4px 3px">fat%</th><th style="padding:4px 3px">+musc</th><th style="padding:4px 3px">+fat</th><th style="padding:4px 3px">waist</th><th style="padding:4px 3px">kcal</th><th style="padding:4px 3px">cut</th></tr></thead><tbody>
  ${rows.map(r=>`<tr style="text-align:right;color:${r.k===marchKey?"var(--text)":"var(--text-3)"};font-family:var(--f-mono)"><td style="text-align:left;padding:6px 2px;font-weight:${r.k===marchKey?700:400};white-space:normal;max-width:96px">${r.label}</td><td style="padding:6px 3px">${r.kg.toFixed(1)}</td><td style="color:${r.bfM<=24.5?"var(--go)":r.bfM<=27?"var(--gold)":"var(--bad)"}">${r.bfM.toFixed(0)}%</td><td>+${r.leanGain.toFixed(1)}</td><td>+${r.fatGain.toFixed(1)}</td><td style="padding:6px 3px">+${r.waistEst.toFixed(0)}cm</td><td style="padding:6px 3px">${r.surplus}</td><td style="padding:6px 3px">${r.cutWeeks}wk</td></tr>`).join("")}
  </tbody></table></div>
  <div class="verdict ${cur.k==="band"?"ok":"warn"}" style="margin-top:10px"><b>${cur.label}:</b> ${cur.note}. Engine now targets <b>+${cur.rate.toFixed(2)} kg/week</b> (${cur.pct.toFixed(2)}% of bodyweight, ~${cur.surplus} kcal surplus); waist brake ${cur.k==="mass"?"<b>off</b> \u2014 a health guard only":"+"+cur.limit+" cm"}.${cur.k==="mass"?" Muscle by March is the same ~"+cur.leanGain.toFixed(1)+" kg on every route \u2014 the extra "+(cur.fatGain-marchTarget("band").fatGain).toFixed(0)+" kg is fat, and the "+cur.cutWeeks+"-week cut afterwards is "+cur.cutWeeks+" weeks of no building.":""}</div></div>`;}
function fastTrackModel(){const c=compute();const pts=[];let crossWeek=null,contractileWeek=null;
  for(let t=0;t<=30;t++){const cre=1.5*Math.min(1,t/1),gly=0.7*Math.min(1,t/2),con=0.6*(t/4.345);const lean=c.leanNow+cre+gly+con;pts.push({t,lean,cre,gly,con});if(crossWeek==null&&cre+gly+con>=3.3)crossWeek=t;if(contractileWeek==null&&con>=3.3)contractileWeek=t;}
  return {pts,crossWeek,contractileWeek,leanNow:c.leanNow};}
function fastTrackHTML(){const f=fastTrackModel();const W=340,H=150,pl=34,pr=10,pt=14,pb=24;const maxT=30;const yMin=Math.floor(f.leanNow-0.5),yMax=Math.ceil(f.leanNow+5.5);
  const x=t=>pl+(W-pl-pr)*t/maxT,y=v=>pt+(H-pt-pb)*(1-(v-yMin)/(yMax-yMin));const P=fn=>f.pts.map((p,i)=>(i?"L":"M")+x(p.t).toFixed(1)+" "+y(fn(p)).toFixed(1)).join(" ");
  const tgt=f.leanNow+3.3;const cw=f.crossWeek==null?"beyond 30":"week "+f.crossWeek,cd=f.crossWeek==null?"":monthLabel(Math.round(f.crossWeek/4.345));
  return `<div class="tool" style="margin-top:12px"><div class="tool-h" onclick="this.parentElement.classList.toggle('open')"><span class="ic">${ICON.check}</span><h4>\u26a1 Fastest way to the 3.3 kg \u2014 crosses ${cw}${cd?" ("+cd+")":""}</h4><span class="chev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><div class="tool-b">
  <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:6px"><line x1="${pl}" x2="${W-pr}" y1="${y(tgt).toFixed(1)}" y2="${y(tgt).toFixed(1)}" stroke="var(--gold)" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${W-pr}" y="${(y(tgt)-4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--gold)" font-family="var(--f-mono)">+3.3 kg lean</text><path d="${P(p=>f.leanNow+p.con)}" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-dasharray="2 3"/><path d="${P(p=>p.lean)}" fill="none" stroke="var(--go)" stroke-width="2.5" stroke-linecap="round"/>${f.crossWeek!=null?`<circle cx="${x(f.crossWeek).toFixed(1)}" cy="${y(tgt).toFixed(1)}" r="4" fill="var(--gold)"/>`:""}<text x="${pl}" y="${H-6}" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">now</text><text x="${W-pr}" y="${H-6}" text-anchor="end" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">+30 weeks</text></svg>
  <div class="calc-note" style="margin-top:8px"><b>Green = fast track, grey = contractile tissue only.</b> Three stacked layers, all natural: <b>creatine loading</b> (20 g/day for 5\u20137 days) puts ~1.5 kg of water <i>inside</i> the muscle in a week; <b>full glycogen</b> (carbs 5+ g/kg, never depleted) adds ~0.7 kg over two weeks; <b>contractile tissue</b> arrives at ~0.6 kg/month through the memory window. Together the 3.3 kg is on the scale by <b>${cw}</b>; contractile-only, it lands around week ${f.contractileWeek||"24+"}.</div>
  <div class="calc-note" style="margin-top:8px"><b>Then the cut can start sooner \u2014 with one rule.</b> The Weekly Review now watches for it: when weight-minus-waist says \u2265 3.3 kg of lean is banked <i>and</i> the waist has moved +4 cm, it tells you to flip Numbers to <b>Cut</b> for 4\u20136 weeks. Before week 12 it will not \u2014 the memory window is the fastest muscle of the whole arc, and cutting inside it throws that away. Fastest overall: bank the water-lean now, keep building through the window, cut when the waist says so, resume.</div></div></div>`;}
function fillFromLast(exId){const lt=liftLastTime(exId);if(!lt||!lt.length){toast("No previous session for this exercise");return;}let n=0;lt.forEach((st,i)=>{const r=document.querySelector(`input[data-ex="${exId}"][data-i="${i}"][data-f="r"]`),w=document.querySelector(`input[data-ex="${exId}"][data-i="${i}"][data-f="w"]`);if(r&&w&&!r.value&&!w.value){r.value=st.r;w.value=st.w;r.dispatchEvent(new Event("input",{bubbles:true}));w.dispatchEvent(new Event("input",{bubbles:true}));n++;}});toast(n?"Filled "+n+" set"+(n===1?"":"s")+" from last time \u2014 now beat one":"Rows already filled",!!n);}
function normDate(x){if(!x)return null;x=String(x).trim();let m=x.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[0];m=x.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);if(m)return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");m=x.match(/^(\d{4})\/(\d{2})\/(\d{2})/);if(m)return m[1]+"-"+m[2]+"-"+m[3];const d=new Date(x);return isNaN(d)?null:d.toISOString().slice(0,10);}
function parseSleepVal(x){x=String(x);const h=x.match(/(\d+)\s*h/i),mn=x.match(/(\d+)\s*m/i);if(h||mn)return (h?+h[1]:0)+(mn?+mn[1]/60:0);const c=x.match(/^(\d{1,2}):(\d{2})/);if(c)return +c[1]+(+c[2])/60;const v=parseFloat(x);return v>16?v/60:v;}
function importHealthText(txt){txt=String(txt||"").trim();if(!txt)return {n:0,kinds:{}};const rows=[];
  let parsed=false;try{const j=JSON.parse(txt);const push=(arr,k,f)=>(arr||[]).forEach(o=>{if(o&&(o.date||o.d))rows.push([normDate(o.date||o.d),k,parseFloat(o[f]!=null?o[f]:o.v)]);});push(j.weight,"weight","kg");push(j.sleep,"sleep","hours");push(j.rhr,"rhr","bpm");push(j.steps,"steps","n");parsed=true;}catch(e){}
  if(!parsed){const lines=txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);const head=lines[0].toLowerCase();
    if(/date/.test(head)&&/,|;|\t/.test(head)){const sep=head.includes("\t")?"\t":head.includes(";")?";":",";const cols=head.split(sep).map(c=>c.trim().replace(/"/g,""));const iD=cols.findIndex(c=>c.includes("date")),iW=cols.findIndex(c=>/weight|body mass/.test(c)),iR=cols.findIndex(c=>/resting/.test(c)&&/heart|hr/.test(c)),iS=cols.findIndex(c=>/sleep/.test(c)&&!/score/.test(c)),iSt=cols.findIndex(c=>/step/.test(c));
      lines.slice(1).forEach(l=>{const p=l.split(sep).map(c=>c.trim().replace(/"/g,""));const d=normDate(p[iD]);if(!d)return;if(iW>=0&&p[iW])rows.push([d,"weight",parseFloat(p[iW])]);if(iR>=0&&p[iR])rows.push([d,"rhr",parseFloat(p[iR])]);if(iS>=0&&p[iS])rows.push([d,"sleep",parseSleepVal(p[iS])]);if(iSt>=0&&p[iSt])rows.push([d,"steps",parseFloat(String(p[iSt]).replace(/[^\d.]/g,""))]);});}
    else lines.forEach(l=>{const p=l.split(/[,;\t]/).map(c=>c.trim());if(p.length<3)return;const d=normDate(p[0]),k=p[1].toLowerCase(),v=parseFloat(p[2]);if(!d||!(v>0))return;if(/weight|kg|mass/.test(k))rows.push([d,"weight",v]);else if(/sleep/.test(k))rows.push([d,"sleep",v>16?v/60:v]);else if(/rhr|resting|heart|pulse/.test(k))rows.push([d,"rhr",v]);else if(/step/.test(k))rows.push([d,"steps",v]);});}
  let n=0;const kinds={};rows.forEach(([d,k,v])=>{if(!d||!(v>0))return;
    if(k==="weight"&&v>40&&v<250){DB.weight=DB.weight.filter(x=>x.date!==d);DB.weight.push({date:d,v:Math.round(v*10)/10});n++;kinds.weight=(kinds.weight||0)+1;}
    else if(k==="sleep"&&v>0&&v<16){DB.sleep=DB.sleep.filter(x=>x.date!==d);DB.sleep.push({date:d,h:Math.round(v*10)/10});n++;kinds.sleep=(kinds.sleep||0)+1;}
    else if(k==="rhr"&&v>30&&v<120){DB.rhr=DB.rhr.filter(x=>x.date!==d);DB.rhr.push({date:d,bpm:Math.round(v)});n++;kinds.rhr=(kinds.rhr||0)+1;}
    else if(k==="steps"&&v>0&&v<100000){DB.steps=DB.steps.filter(x=>x.date!==d);DB.steps.push({date:d,n:Math.round(v)});n++;kinds.steps=(kinds.steps||0)+1;}});
  if(n){const lw=[...DB.weight].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-1)[0];if(lw)DB.profile.weight=lw.v;DB.save();}return {n,kinds};}
function doHealthImport(){const ta=document.getElementById("healthTa");const r=importHealthText(ta&&ta.value);if(!r.n){toast("Nothing recognised \u2014 check the format below");return;}toast("Imported "+r.n+" readings ("+Object.entries(r.kinds).map(([k,v])=>v+" "+k).join(", ")+") \u2713",true);if(ta)ta.value="";renderHome();updateHeader();}
function healthFromFile(inp){const f=inp.files&&inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const res=importHealthText(String(r.result));toast(res.n?"Imported "+res.n+" readings \u2713":"No readings recognised in that file",!!res.n);renderHome();updateHeader();};r.readAsText(f);}
function recoveryHTML(){const last=arr=>[...arr].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];const sl=last(DB.sleep),hr=last(DB.rhr),st=last(DB.steps);if(!sl&&!hr&&!st)return "";
  const wk=DB.sleep.filter(x=>x.date>=dateAdd(todayISO(),-7));const avg=wk.length?wk.reduce((a,x)=>a+x.h,0)/wk.length:null;
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-family:var(--f-mono);font-size:12px">${sl?`<span style="padding:5px 9px;border-radius:8px;background:var(--panel-3);color:${sl.h>=7?"var(--go)":"var(--bad)"}">\ud83d\udecc ${sl.h.toFixed(1)} h${avg!=null?" \u00b7 wk ${avg.toFixed(1)}":""}</span>`:""}${hr?`<span style="padding:5px 9px;border-radius:8px;background:var(--panel-3);color:var(--text-2)">\u2764 ${hr.bpm} bpm</span>`:""}${st?`<span style="padding:5px 9px;border-radius:8px;background:var(--panel-3);color:var(--text-2)">\ud83d\udc63 ${st.n.toLocaleString()}</span>`:""}</div>`;}
function quickLogWeight(){const el=document.getElementById("qW");const v=parseFloat(el&&el.value);if(!v||v<40||v>250){toast("Enter a weight in kg");return;}const date=todayISO();DB.weight=DB.weight.filter(x=>x.date!==date);DB.weight.push({date,v});DB.profile.weight=v;DB.save();toast("Weight logged \u2014 "+v+" kg \u2713",true);renderHome();updateHeader();}
function quickLogWaist(){const el=document.getElementById("qWa");const v=parseFloat(el&&el.value);if(!v||v<50||v>200){toast("Enter waist in cm");return;}const date=todayISO();const ex=DB.measure.find(x=>x.date===date)||{date};ex.waist=v;DB.measure=DB.measure.filter(x=>x.date!==date);DB.measure.push(ex);DB.save();toast("Waist logged \u2014 "+v+" cm \u2713",true);renderHome();}
function quickLogHTML(){const date=todayISO();const tw=DB.weight.find(x=>x.date===date),tm=DB.measure.find(x=>x.date===date&&x.waist!=null);const lastW=[...DB.weight].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];const lastWa=[...DB.measure].filter(x=>x.waist!=null).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  const row=(id,label,unit,today,last,fn,ph)=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)"><div style="flex:0 0 84px;font-weight:600;font-size:13px">${label}</div>${today?`<div style="flex:1;min-width:0;font-family:var(--f-mono);color:var(--go);white-space:nowrap">\u2713 ${today} ${unit} today</div><button class="btn" style="flex:none;width:auto;background:var(--panel-3);color:var(--text-2);border:1px solid var(--line);padding:8px 12px;font-size:12px" onclick="(function(){const b=document.getElementById('${id}');if(b){b.disabled=false;}})();this.previousElementSibling.innerHTML='<input id=\'${id}\' class=\'cell\' type=\'number\' inputmode=\'decimal\' placeholder=\'${ph}\' style=\'width:100%\'>';this.textContent='Save';this.onclick=${fn};">Edit</button>`:`<input id="${id}" class="cell" type="number" inputmode="decimal" placeholder="${ph}" style="flex:1;min-width:0"><button class="btn btn-gold" style="flex:none;width:auto;padding:9px 16px;font-size:13px" onclick="${fn}()">Save</button>`}</div>`;
  return `<div class="card" style="border-color:rgba(63,216,200,.35)"><div class="card-t cyan"><span class="ic">${ICON.check}</span>Quick log</div>
  <div class="card-st">Thirty seconds, straight from here. Weight three mornings a week; waist once a week. Every engine in the app runs on these two numbers.</div>
  <div style="margin-top:6px">${row("qW","Weight","kg",tw?tw.v:null,lastW,"quickLogWeight",lastW?"last "+lastW.v+" kg":"kg")}${row("qWa","Waist","cm",tm?tm.waist:null,lastWa,"quickLogWaist",lastWa?"last "+lastWa.waist+" cm":"cm, at the navel")}</div>${recoveryHTML()}</div>`;}
function milestoneCardHTML(){const m=milestoneProjection();
  return `<div class="card" style="border-color:rgba(255,197,61,.4)"><div class="card-t" style="color:var(--gold)"><span class="ic">${ICON.check}</span>\ud83c\udfaf Soft milestone \u2014 5\u20137 March 2027</div>
  <div class="card-st">${m.passed?"The check weekend has passed \u2014 compare the targets below to what you logged.":m.weeks+" weeks away. Aggressive settings hold until this weekend; then Mini-Cut I and a step down to Maximum, automatically."}</div>
  <div style="height:8px;border-radius:4px;background:var(--panel-3);margin-top:10px;overflow:hidden"><div style="height:100%;width:${m.pct}%;background:linear-gradient(90deg,var(--gold-deep),var(--gold))"></div></div>
  <div style="display:flex;justify-content:space-between;font-family:var(--f-mono);font-size:11px;color:var(--text-3);margin-top:4px"><span>Day 1 \u00b7 ${fmtDM(START_ISO)}</span><span>${m.pct}% of the run-up</span><span>5\u20137 Mar</span></div>
  <div class="dose-grid" style="margin-top:12px"><div class="dose"><div class="dn">Lean mass target</div><div class="dv">${m.lean.toFixed(1)}<small>kg \u00b7 banked \u2248 ${(()=>{const r=weeklyReview();return r.estLean==null?"\u2014":(r.estLean>=0?"+":"")+r.estLean.toFixed(1);})()}</small></div></div><div class="dose"><div class="dn">Scale target</div><div class="dv">${marchTarget().kg.toFixed(1)}<small>kg \u00b7 ${marchKey==="mass"?"outside the band":marchKey==="edge"?"band edge (~26%)":"top of the band"}</small></div></div><div class="dose"><div class="dn">Waist rule</div><div class="dv">${marchKey==="mass"?"off":"\u2264 +"+marchTarget().limit}<small>${marchKey==="mass"?"health guard only":"cm from baseline"}</small></div></div></div>
  ${marchSelectorHTML()}
  ${fastTrackHTML()}
  ${baselineRowHTML()}
  <div class="calc-note" style="margin-top:10px"><b>What \u201con track\u201d looks like that weekend:</b> ${m.total*6} sessions logged (six a week), ${m.total*3} weigh-ins, lean mass within ~0.5 kg of the target, waist inside the +5 cm band. Miss the lean target but hit the attendance and the brake, and the plan is still working \u2014 the ceiling taper and one bad month look identical on a scale; the log is what separates them.</div></div>${(()=>{const d=dayDiff(todayISO(),MILESTONE_ISO);return d>=0&&d<=7?peakWeekHTML(true):"";})()}`;}
function etaCardHTML(){
  const cur=etaModel(bulkMode),best=etaModel("aggr"),act=etaActual(),c=compute();
  const modeName={aggr:"Aggressive",max:"Maximum",balanced:"Balanced",lean:"Lean"}[bulkMode]||"Maximum";
  const rateTxt=bulkMode==="aggr"?"0.6 kg/month through the muscle-memory window to the 5\u20137 March check, then 0.35":({max:"0.35",balanced:"0.27",lean:"0.20"})[bulkMode]||"0.35";
  const mp=milestoneProjection();const rows=[["FFMI 24.0","ffmi24"],["76 kg lean","lean76"],["FFMI 25.0 \u2014 the ceiling","ffmi25"]].map(([l,k])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)"><span>${l}</span><span style="font-family:var(--f-mono);color:var(--go)">${cur.wp[k]!=null?monthLabel(cur.wp[k]):"beyond 10 years"}</span></div>`).join("");
  return `<div class="card" style="border-color:rgba(74,222,128,.42);background:linear-gradient(180deg,rgba(74,222,128,.06),transparent 46%)"><div class="card-t" style="color:var(--go)"><span class="ic">${ICON.check}</span>How Fast Can You Reach FFMI 25?</div>
  <div class="card-st">A live projection, recomputed every time this tab opens: your lean mass now, the natural ceiling, your gain mode \u2014 and, once weigh-ins exist, your actual measured rate.</div>
  <div class="dose-grid" style="margin-top:12px">
    <div class="dose"><div class="dn">At ${modeName} settings</div><div class="dv" style="font-size:18px">${monthLabel(cur.months)}<small>${(cur.months/12).toFixed(1)} years \u00b7 ${cur.months} months</small></div></div>
    <div class="dose"><div class="dn">Best case</div><div class="dv" style="font-size:18px">${monthLabel(best.months)}<small>Aggressive, no missed weeks</small></div></div>
    <div class="dose"><div class="dn">At your logged rate</div><div class="dv" style="font-size:18px">${act?monthLabel(act.months):"\u2014"}<small>${act?(act.months/12).toFixed(1)+" y \u00b7 +"+act.kgWk.toFixed(2)+" kg/wk measured":"log weigh-ins to unlock"}</small></div></div>
  </div>
  ${etaChartSVG(cur,act||best)}
  <div style="margin-top:8px"><div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);color:var(--gold)"><span>\ud83c\udfaf 5\u20137 Mar 2027 soft milestone</span><span style="font-family:var(--f-mono)">${mp.lean.toFixed(1)} kg lean \u00b7 FFMI ${mp.ffmi.toFixed(1)}</span></div>${rows}</div>
  <div class="calc-note" style="margin-top:10px"><b>How the model works:</b> lean gain runs at ${rateTxt} kg/month while you are more than 4 kg from the ceiling, then tapers as the gap closes \u2014 the last kilo takes longer than the first three. It sits inside the Win Plan\u2019s 1.3\u20133.3-year bracket; this is the point estimate for the settings you have chosen. Notice what Aggressive actually buys: the early waypoints arrive about a month sooner, but the ceiling month barely moves \u2014 the last kilos are governed by the taper, not by the surplus. Aggression front-loads the gains; it cannot shorten the end game. That is the biology, and the card will not pretend otherwise. FFMI 25 means ${c.ceilLean.toFixed(1)} kg of lean mass: at 24% body fat that is <b>${(c.ceilLean/0.76).toFixed(1)} kg</b> on the scale, at 18% it is ${(c.ceilLean/0.82).toFixed(1)} \u2014 same muscle, your choice of coat. The logged-rate line assumes ~65% of measured gain is lean while the waist brake holds, and it takes over from the model the moment your weigh-ins exist.</div>
  <div class="verdict ${act?"ok":"warn"}" style="margin-top:10px">${act?"<b>Live.</b> This date is now driven by your own scale data \u2014 keep the weigh-ins coming and it sharpens every week.":"<b>Still a model.</b> Three weigh-ins a week turn this into <i>your</i> date, not a textbook\u2019s."}</div></div>`;
}
function renderRoadmap(){
  const el=document.getElementById("view-roadmap");
  const weeks=buildRoadmap(),phases=roadmapPhases(weeks),now=roadmapWeekNow(),started=planStarted();
  const peak=Math.max(...weeks.map(w=>w.bw)),endBw=weeks[weeks.length-1].bw,base=weeks[0].bw-weeks[0].bw+ (parseFloat(DB.profile.weight)||85);
  const ceil=Math.round(compute().ceilBW);
  // next milestone
  const nextM=weeks.find(w=>w.wk>=now&&w.milestone);
  const TYPE={race:{c:"var(--danger)",l:"Race"},regain:{c:"var(--gold)",l:"Reclaim"},bulk:{c:"var(--go)",l:"Lean Bulk"},cut:{c:"var(--cyan)",l:"Cut"},maintain:{c:"var(--violet)",l:"Maintain"}};
  el.innerHTML=`
    <div class="eyebrow">2-Year Master Plan</div><h2 class="view-title">Roadmap</h2>
    <p class="view-sub">${started?"You're on the road.":"Starts "+fmtLong(START_ISO)+"."} 104 weeks from your start to ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+dateAdd(START_ISO,728).slice(5,7)-1]+" "+dateAdd(START_ISO,728).slice(0,4)} — every week dated, with a bodyweight target, a training focus, and the milestones that keep you honest. Built to approach your natural ceiling, not a fantasy number.</p>
    ${etaCardHTML()}
    <div class="card"><div class="card-t"><span class="ic">${ICON.lift}</span>The Two-Year Arc</div>
      <div class="card-st">Your projected bodyweight path through every phase. A guide, not a guarantee — recalibrate from your real weight trend in Track.</div>
      <div id="rmChart"></div>
      <div class="landmark-grid" style="margin-top:14px">
        <div class="lm"><div class="lmv">${parseFloat(DB.profile.weight)||85}<span style="font-size:10px">kg</span></div><div class="lml">Start</div><div class="lmd">29 Jun 26</div></div>
        <div class="lm"><div class="lmv">~${Math.round(peak)}<span style="font-size:10px">kg</span></div><div class="lml">Peak Bulk</div><div class="lmd">scale weight</div></div>
        <div class="lm"><div class="lmv">~${Math.round(endBw)}<span style="font-size:10px">kg</span></div><div class="lml">End Lean</div><div class="lmd">mid-2028</div></div>
        <div class="lm"><div class="lmv">~${ceil}<span style="font-size:10px">kg</span></div><div class="lml">Nat. Ceiling</div><div class="lmd">your limit</div></div>
      </div>
    </div>
    ${nextM?`<div class="note ${nextM.mType==="race"?"red":nextM.mType==="retest"?"gold":"cyan"}"><b>Next milestone — Week ${nextM.wk} (${fmtDM(nextM.start)}):</b> ${nextM.milestone}</div>`:""}
    <div class="note gold"><b>Reality check:</b> this path tops out around ${ceil} kg lean — an elite drug-free physique at 177 cm. A lean 110 kg isn't on the natural map (it needs an FFMI only seen with assistance). The plan builds the best version of you that's actually achievable, then holds it.</div>
    <div class="eyebrow" style="margin-top:8px">The 8 Phases</div>
    <div id="rmPhases"></div>
    <p class="foot-note">Tap a phase to open its weeks. Your current week is highlighted. Deload = lighter recovery week; 📸 = progress photos + measurements.</p>`;
  // chart: area-style line of bodyweight across 104 weeks
  drawRoadmapChart(weeks,now);
  // phases
  const wrap=document.getElementById("rmPhases");
  wrap.innerHTML=phases.map((ph,pi)=>{
    const t=TYPE[ph.type]||TYPE.bulk,isCurrent=now>=ph.from&&now<=ph.to;
    return `<div class="rweek${isCurrent?" cur open":""}">
      <div class="rweek-h" data-ph="${pi}"><div class="rwh-l"><div class="rwh-num" style="color:${t.c}">P${pi+1}</div><div class="rwh-meta"><h4>${ph.phase}${isCurrent?' · you are here':''}</h4><p>Weeks ${ph.from}-${ph.to} · ${fmtDM(ph.startDate)} · ${ph.blk}</p></div></div><div class="rwh-r" style="color:${t.c}">${ph.type==="cut"?"↓":ph.type==="maintain"?"→":"↑"} ${Math.round(ph.startBw)}-${Math.round(ph.endBw)}kg</div><span class="rwh-chev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
      <div class="rweek-b">
        <div class="rr-d" style="padding:8px 0 6px;color:var(--text-2)">${ph.focus}</div>
        ${ph.weeks.map(w=>{
          const cur=w.wk===now;
          const tags=[];if(w.milestone)tags.push(`<span class="rm-mile ${w.mType}">${w.milestone}</span>`);if(w.deload)tags.push('<span class="rm-tag deload">Deload week</span>');if(w.photos&&!w.milestone)tags.push('<span class="rm-tag photo">📸 Photos + measure</span>');
          return `<div class="rm-week${cur?" now":""}"><div class="rm-wn"><b>W${w.wk}</b><small>${fmtDM(w.start)}</small></div><div class="rm-wbody"><div class="rm-wtop"><span class="rm-bw" style="color:${t.c}">${w.bw.toFixed(1)} kg</span>${cur?'<span class="rm-here">THIS WEEK</span>':''}</div>${tags.length?`<div class="rm-tags">${tags.join("")}</div>`:""}</div></div>`;
        }).join("")}
      </div>
    </div>`;
  }).join("");
  wrap.querySelectorAll(".rweek-h").forEach(h=>h.addEventListener("click",()=>h.parentElement.classList.toggle("open")));
}
function drawRoadmapChart(weeks,now){
  const W=680,H=200,pad={t:16,r:14,b:26,l:36};
  const xs=weeks.map(w=>w.wk),ys=weeks.map(w=>w.bw);
  let min=Math.min(...ys),max=Math.max(...ys);const rng=max-min||1;min-=rng*0.15;max+=rng*0.15;
  const px=w=>pad.l+((w-1)/(weeks.length-1))*(W-pad.l-pad.r),py=v=>pad.t+(1-(v-min)/(max-min))*(H-pad.t-pad.b);
  // phase background bands
  const TYPEC={race:"rgba(246,91,91,.10)",regain:"rgba(255,197,61,.10)",bulk:"rgba(66,215,125,.09)",cut:"rgba(63,216,200,.10)",maintain:"rgba(157,140,255,.10)"};
  const phases=roadmapPhases(weeks);let bands="";
  phases.forEach(ph=>{const x1=px(ph.from)-( ph.from>1?(px(2)-px(1))/2:0),x2=px(ph.to)+((px(2)-px(1))/2);bands+=`<rect x="${Math.max(pad.l,x1).toFixed(1)}" y="${pad.t}" width="${(Math.min(W-pad.r,x2)-Math.max(pad.l,x1)).toFixed(1)}" height="${H-pad.t-pad.b}" fill="${TYPEC[ph.type]||'transparent'}"/>`;});
  let grid="",yl="";for(let g=0;g<=4;g++){const v=min+(max-min)*g/4,y=py(v);grid+=`<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="var(--line)"/>`;yl+=`<text x="${pad.l-6}" y="${y+3}" text-anchor="end" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">${Math.round(v)}</text>`;}
  // ceiling line
  const ceil=compute().ceilBW,yc=py(clamp(ceil,min,max));
  let area="M"+px(1).toFixed(1)+" "+py(ys[0]).toFixed(1);weeks.forEach((w,i)=>{area+=" L"+px(w.wk).toFixed(1)+" "+py(w.bw).toFixed(1);});
  let fill=area+" L"+px(weeks[weeks.length-1].wk).toFixed(1)+" "+(H-pad.b)+" L"+px(1).toFixed(1)+" "+(H-pad.b)+" Z";
  // markers for milestones
  let dots="";weeks.forEach(w=>{if(w.milestone){const cc=w.mType==="race"?"var(--danger)":w.mType==="retest"?"var(--gold)":"var(--cyan)";dots+=`<circle cx="${px(w.wk).toFixed(1)}" cy="${py(w.bw).toFixed(1)}" r="3.5" fill="${cc}" stroke="var(--panel)" stroke-width="1.5"/>`;}});
  // "now" marker
  let nowM="";if(planStarted()){const xn=px(clamp(now,1,weeks.length));nowM=`<line x1="${xn.toFixed(1)}" y1="${pad.t}" x2="${xn.toFixed(1)}" y2="${H-pad.b}" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="${xn.toFixed(1)}" cy="${py(weeks[clamp(now,1,weeks.length)-1].bw).toFixed(1)}" r="4.5" fill="var(--gold)" stroke="var(--ink)" stroke-width="2"/>`;}
  // x labels: every ~13 weeks
  let xl="";for(let w=1;w<=weeks.length;w+=13){xl+=`<text x="${px(w).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="9" fill="var(--text-3)" font-family="var(--f-mono)">${fmtDM(weeks[w-1].start)}</text>`;}
  document.getElementById("rmChart").innerHTML=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="rmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity="0.35"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>${bands}${grid}${yl}${(yc>pad.t&&yc<H-pad.b)?`<line x1="${pad.l}" y1="${yc.toFixed(1)}" x2="${W-pad.r}" y2="${yc.toFixed(1)}" stroke="var(--go)" stroke-width="1.2" stroke-dasharray="5 3"/><text x="${W-pad.r}" y="${(yc-4).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--go)" font-family="var(--f-mono)">natural ceiling ~${Math.round(ceil)}kg</text>`:""}<path d="${fill}" fill="url(#rmg)"/><path d="${area}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round"/>${dots}${nowM}${xl}</svg>`;
}
/* ===== REST TIMER ===== */
let _restLeft=0,_restInt=null,_restWired=false;
function renderRest(){const lab=document.getElementById("restTime");if(lab)lab.textContent=_restLeft>0?fmtPace(_restLeft):"Go!";}
function startRest(sec){const bar=document.getElementById("restTimer");if(!bar)return;_restLeft=sec;bar.classList.add("show");renderRest();clearInterval(_restInt);_restInt=setInterval(()=>{_restLeft--;if(_restLeft<=0){clearInterval(_restInt);renderRest();if(navigator.vibrate)try{navigator.vibrate([120,60,120]);}catch(e){}setTimeout(()=>{const b=document.getElementById("restTimer");if(b&&_restLeft<=0)b.classList.remove("show");},2200);}else renderRest();},1000);}
function wireRest(){if(_restWired)return;_restWired=true;const end=document.getElementById("restEnd"),plus=document.getElementById("restPlus");if(end)end.addEventListener("click",()=>{clearInterval(_restInt);_restLeft=0;document.getElementById("restTimer").classList.remove("show");});if(plus)plus.addEventListener("click",()=>{_restLeft+=15;renderRest();});}
/* ===== HOME ===== */
function backupJSON(){const keys=["cb2_profile","cb2_sessions","cb2_runs","cb2_weight","cb2_measure","cb2_lifts","cb2_bulk","cb2_ceilbf","cb2_pure","cb2_ts","cb2_march","cb2_focuslb","cb2_radius","cb2_sleep","cb2_rhr","cb2_steps"];const o={};keys.forEach(k=>{const v=load(k,null);if(v!=null)o[k]=v;});return JSON.stringify(o);}
function showDataBox(val,forRestore){const box=document.getElementById("dataBox"),ta=document.getElementById("dataTa"),ap=document.getElementById("dataApply");box.style.display="block";ta.value=val||"";ta.placeholder=forRestore?"Paste your backup here, then tap Apply":"";ap.style.display=forRestore?"block":"none";ta.focus();if(!forRestore)ta.select();}
function doBackup(){persist("cb2_lastbackup",Date.now());const j=backupJSON();if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(j).then(()=>toast("Backup copied \u2014 paste into Notes, and into any new version via Restore",true)).catch(()=>showDataBox(j,false));}else showDataBox(j,false);}
function doRestore(){showDataBox("",true);}
function applyRestoreText(txt){try{const o=JSON.parse(txt);let n=0;Object.keys(o).forEach(k=>{if(o[k]!=null){persist(k,o[k]);n++;}});if(!n)throw 0;toast("Restored — reloading…",true);setTimeout(()=>location.reload(),600);}catch(e){toast("That doesn’t look like a valid backup");}}
function applyRestore(){applyRestoreText(document.getElementById("dataTa").value);}
async function shareBackup(){const j=backupJSON();const name="ComebackBlueprint-backup-"+todayISO()+".json";try{const f=new File([j],name,{type:"application/json"});if(navigator.canShare&&navigator.canShare({files:[f]})&&navigator.share){await navigator.share({files:[f],title:"Comeback Blueprint backup"});persist("cb2_lastbackup",Date.now());toast("Shared \u2014 pick iCloud Drive or Google Drive to make it permanent",true);renderHome();return;}}catch(e){if(e&&e.name==="AbortError")return;}downloadBackup();}
function downloadBackup(){persist("cb2_lastbackup",Date.now());const j=backupJSON();const blob=new Blob([j],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="comeback-backup-"+todayISO()+".json";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);toast("Backup file downloaded — keep it in Files or Drive",true);}
function restoreFromFile(inp){const f=inp.files&&inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>applyRestoreText(String(r.result));r.readAsText(f);}
function cloudOK(){try{return !!(window.storage&&window.storage.get&&window.storage.set);}catch(e){return false;}}
var _ct=null;
var _cloudLastAck=0,_cloudReady=false;
function cloudPayload(){return JSON.stringify({ts:Date.now(),data:JSON.parse(backupJSON())});}
function cloudSaveNow(){if(!cloudOK()||!_cloudReady)return;clearTimeout(_ct);try{window.storage.set("cb2_all",cloudPayload()).then(()=>{_cloudLastAck=Date.now();const el=document.getElementById("cloudAck");if(el)el.textContent="Saved "+new Date(_cloudLastAck).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+" \u2713";}).catch(()=>{});}catch(e){}}
function idbOpen(){return new Promise((res,rej)=>{try{const q=indexedDB.open("cb2",1);q.onupgradeneeded=()=>{q.result.createObjectStore("kv");};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);}catch(e){rej(e);}});}
function idbSave(){try{idbOpen().then(db=>{const tx=db.transaction("kv","readwrite");tx.objectStore("kv").put(cloudPayload(),"cb2_all");}).catch(()=>{});}catch(e){}}
function idbLoad(){return idbOpen().then(db=>new Promise(res=>{const q=db.transaction("kv","readonly").objectStore("kv").get("cb2_all");q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);})).catch(()=>null);}
async function idbBoot(){try{const empty=DB.sessions.length===0&&DB.weight.length===0&&DB.measure.length===0;if(!empty)return;const raw=await idbLoad();if(!raw)return;const o=JSON.parse(raw);const data=o.data||o;let n=0;Object.keys(data).forEach(k=>{if(data[k]!=null){persist(k,data[k]);n++;}});if(n){reloadDB();rerenderAll();toast("Restored from the device vault \u2713",true);}}catch(e){}}
function cloudQueue(){idbSave();if(!cloudOK()||!_cloudReady)return;clearTimeout(_ct);_ct=setTimeout(cloudSaveNow,250);}
async function cloudBoot(){if(!cloudOK())return;
  let cloud=null;try{const res=await window.storage.get("cb2_all");if(res&&res.value)cloud=JSON.parse(res.value);}catch(e){}
  let cts=0,cdata=null;
  if(cloud){if(cloud.data){cts=cloud.ts||0;cdata=cloud.data;}else{cdata=cloud;cts=0;}}
  const lts=load("cb2_ts",0);
  const empty=DB.sessions.length===0&&DB.runs.length===0&&DB.weight.length===0;
  if(cdata&&(empty||cts>lts)){
    let n=0;Object.keys(cdata).forEach(k=>{if(cdata[k]!=null){persist(k,cdata[k]);n++;}});
    if(n){reloadDB();rerenderAll();toast("Cloud data loaded \u2713",true);}
  }
  _cloudReady=true;cloudSaveNow();}
function reloadDB(){DB.profile=load("cb2_profile",DB.profile);DB.sessions=load("cb2_sessions",[]);DB.runs=load("cb2_runs",[]);DB.weight=load("cb2_weight",[]);DB.measure=load("cb2_measure",[]);DB.lifts=load("cb2_lifts",{});DB.sleep=load("cb2_sleep",[]);DB.rhr=load("cb2_rhr",[]);DB.steps=load("cb2_steps",[]);ceilBf=load("cb2_ceilbf",18);LOC=load("cb2_loc","gym");}
function rerenderAll(){try{const act=[...document.querySelectorAll('[id^="view-"]')].find(el=>el.offsetParent!==null);renderHome();updateHeader();if(act&&act.id!=="view-home")switchView(act.id.replace("view-",""));}catch(e){}}
function dataCardHTML(){const empty=DB.sessions.length===0&&DB.runs.length===0&&DB.weight.length===0;
  return `<div class="card" style="border-color:rgba(255,197,61,.3)"><div class="card-t" style="color:var(--gold)"><span class="ic">${ICON.check}</span>Your Data \u2014 Keep It Safe</div>
  <div class="card-st">${cloudOK()?"<b>Cloud-linked ✓</b> — every save writes to your Claude account within a quarter-second, and flushes the instant the app closes. <span id='cloudAck' style='color:var(--go)'>Syncing…</span> File backups below remain your cross-version guarantee.":STORAGE_OK?"Saves on this device, in this copy only. A new version of the app = a fresh, empty copy \u2014 carry your logs across in 10 seconds: <b>Backup here \u2192 Restore there.</b>":"<b>Saving is blocked in this viewer.</b> Anything you log vanishes when you close it."}${empty&&STORAGE_OK?" <b>Fresh copy detected:</b> if you logged in an older copy, open that one, tap Backup, then Restore here.":""}</div>
  ${STORAGE_OK?"":`<div class="verdict warn" style="margin-top:8px">Open this file in Chrome or Safari (Share \u2192 Open in Browser), Add to Home Screen, and Backup before closing \u2014 every time.</div>`}
  ${(()=>{const lb=load("cb2_lastbackup",0);const days=lb?Math.floor((Date.now()-lb)/86400000):null;return `<div style="margin-top:10px;font-size:12px;line-height:1.5"><b>Where your data lives right now:</b> device store \u2713 \u00b7 device vault (IndexedDB) \u2713 \u00b7 ${cloudOK()?"Claude account \u2713":"Claude account \u2014 only when opened inside Claude"} \u00b7 <span style="color:${days==null||days>7?"var(--bad)":"var(--go)"}">backup file ${days==null?"never made":days===0?"today":days+" day"+(days===1?"":"s")+" ago"}</span>. Four copies beat one; the file is the one no platform can take away.</div>`;})()}
  <button class="btn btn-gold" style="width:100%;margin-top:10px" onclick="shareBackup()">Save backup to iCloud Drive / Google Drive</button>
  <div style="font-size:12px;color:var(--text-3);margin-top:6px;line-height:1.45"><b>Straight answer on Drive and iCloud:</b> a file-based app cannot <i>link</i> to them \u2014 Google Drive needs a registered server app and iCloud has no web API \u2014 but the backup <b>file</b> saved there is the permanent copy: it survives a lost phone, a cleared browser and a new device. On iPhone the button opens the share sheet \u2192 <b>Save to Files \u2192 iCloud Drive</b>; on Android \u2192 <b>Drive</b>. Restore on any device with the picker below. Do it weekly; the age indicator above turns red when it is due.</div>
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-gold" style="flex:1.3;min-width:0" onclick="downloadBackup()">Download backup</button><button class="btn" style="flex:.7;min-width:0;background:var(--panel-3);color:var(--text);border:1px solid var(--line)" onclick="doBackup()">Copy</button><button class="btn" style="flex:.9;min-width:0;background:var(--panel-3);color:var(--text);border:1px solid var(--line)" onclick="doRestore()">Restore</button></div>
  <div id="dataBox" style="display:none;margin-top:10px"><label style="display:block;font-size:12px;color:var(--text-3);margin-bottom:6px">Restore from a backup file:</label><input type="file" id="dataFile" accept="application/json,.json" onchange="restoreFromFile(this)" style="width:100%;margin-bottom:6px;color:var(--text-3);font-size:12px"><div style="font-size:12px;color:var(--text-3);margin:6px 0">— or paste a copied backup below —</div><textarea id="dataTa" style="width:100%;min-height:96px;background:var(--ink-2);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px;font-family:var(--f-mono);font-size:11px"></textarea><button id="dataApply" class="btn btn-gold" style="display:none;margin-top:8px;width:100%" onclick="applyRestore()">Apply Restore</button></div>
  <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)"><div style="font-weight:600;font-size:13px">\u231a Watch data \u2014 Apple Health & Garmin</div>
  <div style="font-size:12px;color:var(--text-3);margin-top:4px;line-height:1.45">No file-based app can pair with a watch directly. The route that works every time: Garmin \u2192 Apple Health (one toggle in Garmin Connect), then an Apple Shortcut exports weight, sleep, resting HR and steps as text \u2014 paste it here. Or pick a Garmin Connect CSV export. Full recipe in the Guide.</div>
  <textarea id="healthTa" style="width:100%;min-height:72px;margin-top:8px;background:var(--ink-2);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px;font-family:var(--f-mono);font-size:11px" placeholder="2026-09-12,weight,88.4&#10;2026-09-12,sleep,7.4&#10;2026-09-12,rhr,52&#10;2026-09-12,steps,8200"></textarea>
  <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-gold" style="flex:1" onclick="doHealthImport()">Import pasted data</button><label class="btn" style="flex:1;text-align:center;background:var(--panel-3);color:var(--text);border:1px solid var(--line);cursor:pointer">Garmin CSV<input type="file" accept=".csv,.txt,.json" style="display:none" onchange="healthFromFile(this)"></label></div></div></div>`;}
function coachBriefHTML(){
  const ph=(curPhase==="hyper"||curPhase==="race")?curPhase:"build";
  const m=macros(ph),g=gainModel(ph);
  if(!planStarted()){
    return `<div class="card" style="border-color:rgba(63,216,200,.35)"><div class="card-t cyan"><span class="ic">${ICON.check}</span>Coach\u2019s Brief \u00b7 Day 1 Tomorrow</div><div class="prose" style="margin-top:6px">
      <p><b>Tomorrow opens with Legs A</b> \u2014 squat, Romanian deadlift, split squats, calves, the 45\u00b0 back extension. The Legs & Back focus starts on Day 1. Start at ~50\u201360% of your old weights and let the tendons catch up; the extra focus set is the last set of each lift, taken honestly.</p>
      <p><b>Tonight:</b> pack the gym bag \u00b7 shop the meal plan (Fuel tab) \u00b7 sleep 7-9 h \u2014 it\u2019s the #1 recovery drug.</p>
      <p><b>Sunday:</b> Push A \u2014 bench and overhead press while the legs recover. Two days in, two sessions logged: that is the whole first weekend.</p><p><b>Today, before Day 1:</b> start the creatine load \u2014 20 g split across four meals, five to seven days \u2014 so the muscle is saturating by the first session. And log a baseline weigh-in and waist in Quick log: Day 1 should start with a number.</p></div></div>`;
  }
  const dow=DOW[new Date().getDay()],tmpl=weekTemplate(),ti=tmpl.find(x=>x.day===dow);
  const rp=RUN_PLAN[Math.min(planWeek(),PLAN_WEEKS)-1]||RUN_PLAN[RUN_PLAN.length-1];
  const run=rp&&rp.runs.find(x=>x.d===dow);
  let sess=ti?ti.label:"Rest";if(run)sess=run.title;
  const supp=(ti&&ti.kind==="lift")||run?"04:30: caffeine + \u00bd beta-alanine (citrulline only if training before ~07:00) \u00b7 20:00: creatine, \u00bd beta-alanine, omega-3, D3, ashwagandha":"Rest day \u2014 skip 04:30 entirely \u00b7 20:00: creatine, \u00bd beta-alanine, omega-3, D3, ashwagandha";
  const act=actualGainRate(),wr=actualWaistRate();
  let nudges=[];if(planStarted()&&planWeek()<=2)nudges.push({c:"ok",t:"Creatine fast track: 20 g today split across four meals (loading days 1\u20137), then 5 g daily. Lean mass on the scale within a week."});if(isDeloadWeek())nudges.push({c:"ok",t:"Deload week: lighter loads, same movements, 3+ reps in reserve. Recovery is the stimulus this week."});
  if(!act)nudges.push({c:"warn",t:"Log your bodyweight in Track \u2014 the Lean Gain engine is idling without it."});
  else if(!wr)nudges.push({c:"warn",t:"Add a waist measurement in Track \u2014 it\u2019s what proves the gain is lean."});
  if(nudges.length===0)nudges.push({c:"ok",t:"All engines fed \u2014 weight, waist and runs are flowing. Just execute today."});
  return `<div class="card" style="border-color:rgba(63,216,200,.35)"><div class="card-t cyan"><span class="ic">${ICON.check}</span>Coach\u2019s Brief</div><div class="prose" style="margin-top:6px">
    <p><b>Today:</b> ${sess}${ti&&!run?` \u2014 ${ti.detail.split(". ")[0]}.`:""}</p>
    <p><b>Fuel:</b> ${m.cal} kcal \u00b7 ${m.pro} g protein \u00b7 target +${g.rateKgWk.toFixed(2)} kg/wk (${g.mode})</p>
    <p><b>Supps:</b> ${supp}</p></div>
    ${nudges.map(n=>`<div class="verdict ${n.c}" style="margin-top:8px">${n.t}</div>`).join("")}</div>`;
}
function renderHome(){
  updateHeader();
  const started=planStarted(),wk=planWeek(),dleft=daysToRace(),frac=clamp((PLAN_WEEKS-(dleft/7))/PLAN_WEEKS,0,1);
  const rp=RUN_PLAN[Math.min(wk,RUN_PLAN.length)-1]||RUN_PLAN[0],tmpl=weekTemplate(),todayDow=DOW[new Date().getDay()];
  const todayItem=started?tmpl.find(t=>t.day===todayDow):null;
  let tClass="rest",tIc=ICON.rest,tTitle=(isDeloadWeek()?"Rest Day — Deload Week":"Active Recovery — Minimal Rest by Design"),tBody=(isDeloadWeek()?`<b>Deload week: this is the one full rest day the plan keeps.</b> Walk, eat to target, sleep long. The muscle from the last five weeks is consolidated here, not on the floor.`:`<b>Minimal rest days, as you asked — but rest is a training variable, not a day off.</b> A 30–40 minute <b>Extras pump</b> (rear delts, arms, calves, core) at RIR 2, no failure, builds more than a couch does and steals nothing from tomorrow’s Legs A. Skip it and rest fully only if the Weekly Review flags stalls or sleep under 7 h.`)+`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-gold" style="flex:1;min-width:120px" onclick="goToExtras()">${ICON.lift}Extras Pump</button><button class="btn" style="flex:1;min-width:120px;background:var(--panel-3);color:var(--text);border:1px solid var(--line)" onclick="switchView('lift')">Main day instead</button></div>`;
  if(todayItem){
    const todayRun=rp.runs.find(x=>x.d===todayDow),isRaceToday=todayRun&&todayRun.t==="race";
    if(todayItem.kind==="lift"&&!isRaceToday){tClass="lift";tIc=ICON.lift;tTitle=todayItem.label+" — Strength";tBody="<b>"+todayItem.detail+"</b> Open the Lift tab to load the session and log your sets.";}
    else if(todayRun){tClass="run";tIc=ICON.run;tTitle=todayRun.title;tBody="<b>"+todayRun.det+"</b>"+(isRaceToday?"":" Log it in the Run tab when you're done.");}
    else if(todayItem.kind==="run"){tClass="run";tIc=ICON.run;tTitle=todayItem.label;tBody="<b>"+todayItem.detail+"</b> Log it in the Run tab when you're done.";}
  }
  // pre-start: preview the actual first session on START_ISO's weekday
  const fsDow=firstSessionDow(),fsItem=tmpl.find(t=>t.day===fsDow);
  let fsClass="rest",fsIc=ICON.rest,fsTitle="Rest",fsBody="Full rest or gentle mobility before Week 1 ramps up.";
  if(fsItem){
    if(fsItem.kind==="lift"){fsClass="lift";fsIc=ICON.lift;fsTitle=fsItem.label+" — Strength";fsBody="<b>Your opening session.</b> "+fsItem.detail+" Start at ~50-60% of your old weights this first week so your tendons catch up to your muscle. Open the Lift tab to begin.";}
    else if(fsItem.kind==="run"){fsClass="run";fsIc=ICON.run;const fr=RUN_PLAN[0].runs.find(r=>r.d===fsDow);fsTitle=fr?fr.title:fsItem.label;fsBody="<b>Your opening session — ease in.</b> "+(fr?fr.det:fsItem.detail)+" A gentle run is the perfect way to start a comeback.";}
  }
  const _si=tmpl.findIndex(t=>t.day===fsDow),stripDays=_si>0?tmpl.slice(_si).concat(tmpl.slice(0,_si)):tmpl;
  const comp=sessionsThisWeek();
  const _ws=weekStartISO(planWeek()),_we=dateAdd(_ws,7),wiCount=DB.weight.filter(x=>x.date>=_ws&&x.date<_we).length;
  const liftDots=Array.from({length:6},(_,i)=>`<i class="${i<comp.lifts?"on":""}"></i>`).join("");
  const runDots=Array.from({length:3},(_,i)=>`<i class="${i<wiCount?"on":""}"></i>`).join("");
  const rmWeeks=buildRoadmap(),nowRM=roadmapWeekNow(),nextM=rmWeeks.find(w=>w.wk>=nowRM&&w.milestone);
  const el=document.getElementById("view-home");
  el.innerHTML=`
  ${!started?`<div class="startban"><div class="sb-d"><b>${daysToStart()}</b><small>${daysToStart()===1?"day":"days"}</small></div><div class="sb-t"><h4>Your plan starts ${fmtLong(START_ISO)}</h4><p>Everything below is set and ready. Week 1 opens with ${fsTitle.replace(/ — Strength$/,"")}. Get your kit, your gym bag and your kitchen ready.</p></div></div>`:""}
  <div class="hero"><div class="hero-top">
    <div class="hero-race"><div class="hr-l">The Mission</div><div class="hr-d">102 kg @ 24%</div><div class="hr-s">${todayISO()<MILESTONE_ISO?"Pure muscle · as big as possible by 5 Mar 2027":"Pure muscle · as fast as the law allows"}</div><div class="hr-s" style="color:var(--gold)">${(()=>{const c=compute();return `≈78 kg of muscle underneath · FFMI ${c.ffmiNorm.toFixed(1)} → 25.0 target`})()}</div></div>
    <div class="cd-ring">${(()=>{const c=compute();const fr=Math.max(.03,Math.min(1,c.leanNow/c.ceilLean));return ringSVG(fr,"var(--gold)")})()}<div class="cd-lab"><b>${(()=>{const c=compute();return "+"+Math.max(0,c.ceilLean-c.leanNow).toFixed(1)})()}</b><small>kg lean to go</small></div></div>
  </div></div>
  ${(()=>{const dow=DOW[new Date().getDay()],t=weekTemplate().find(x=>x.day===dow);
      if(!planStarted())return `<button class="btn btn-gold cta" onclick="switchView('lift')">Day 1 is ${fmtLong(START_ISO)} \u2014 preview the first session</button>`;
      if(t&&t.kind==="lift")return `<button class="btn btn-gold cta" onclick="goToLift()">\u25b6 Start today\u2019s session \u2014 ${t.label}${LOC==="home"?" \u00b7 home":""}</button>`;
      return isDeloadWeek()?`<button class="btn cta" style="background:var(--panel-3);color:var(--text);border:1px solid var(--line)" onclick="switchView('guide')">Deload week rest day \u2014 walk, eat, sleep</button>`:`<button class="btn btn-gold cta" onclick="goToExtras()">\u25b6 Active recovery \u2014 Extras pump, 30 min</button>`;})()}
    <div class="pillars">
    <div class="pillar str"><div class="pi">${ICON.lift}<span>Strength</span></div><div class="pv" id="pillarStr">—</div><div class="pl">Current bodyweight</div><div class="pmeta" id="pillarStrMeta">goal ${DB.profile.goal} kg</div></div>
    <div class="pillar end"><div class="pi">${ICON.run}<span>Focus</span></div><div class="pv">Week ${started?wk:"0"}</div><div class="pl">${currentBlock().name}</div><div class="pmeta">wk ${currentBlock().i}/${currentBlock().n} · ${currentBlock().span}</div></div>
  </div>
  ${started?`<div class="compbar"><div class="compcard lift"><div class="cc-top"><span class="cc-l">Lifts this week</span><span class="cc-v">${comp.lifts}/6</span></div><div class="dots">${liftDots}</div></div><div class="compcard run"><div class="cc-top"><span class="cc-l">Weigh-ins this week</span><span class="cc-v">${wiCount}/3</span></div><div class="dots">${runDots}</div></div></div>`:""}
  
  ${quickLogHTML()}
  ${milestoneCardHTML()}
  <div class="eyebrow">${started?"Today — "+todayDow:"First Session — "+fsDow+" "+fmtDM(START_ISO)}</div>
  <div class="today"><div class="today-band ${started?tClass:fsClass}"><div class="tb-ic">${started?tIc:fsIc}</div><div class="tb-txt"><div class="tb-day">${started?fmtLong(todayISO()):fmtLong(START_ISO)}</div><div class="tb-title">${started?tTitle:fsTitle}</div></div></div><div class="today-body">${started?tBody:fsBody}</div></div>
  <div class="eyebrow cyan">This Week — ${started?"Week "+wk+" · Pure muscle block":"Week 1 preview"} <span style="color:var(--text-3);font-weight:600">(${weekRangeLabel(started?wk:1)})</span></div>
  <div class="weekstrip">${stripDays.map(t=>{const isT=started&&t.day===todayDow;const ic=t.kind==="lift"?ICON.lift:t.kind==="run"?ICON.run:ICON.rest;let lbl;if(t.kind==="lift")lbl=t.label.split(" ")[0];else if(t.kind==="run"){const rr=(started?rp:RUN_PLAN[0]).runs.find(x=>x.d===t.day);const ty=rr?rr.t:"easy";lbl=ty==="long"?"Long":ty==="quality"?"Quality":ty==="race"?"Race":"Easy";}else lbl="Rest";return `<div class="wd${isT?" today":""}"><div class="wdn">${t.day}</div><div class="wdi ${t.kind}">${ic}</div><div class="wdl">${lbl}</div></div>`;}).join("")}</div>
  <div class="note cyan" style="margin-top:8px"><b>How the week works:</b> 6 lifting days + 1 full rest (Fri). Every muscle trains twice a week — Push/Pull/Legs, then again. Rest-day itch? The Extras pump is one tap away. Cardio is optional now and lives in its own tab. The why lives in the Guide.</div>
  ${coachBriefHTML()}${weeklyReviewHTML()}${winTeaserHTML()}${dataCardHTML()}
  
  ${nextM?`<div class="card" style="margin-top:4px;cursor:pointer" onclick="switchView('roadmap')"><div class="card-t"><span class="ic">${ICON.check}</span>Next Milestone</div><div class="prose" style="margin-top:2px"><p style="margin:0"><b>Week ${nextM.wk} · ${fmtDM(nextM.start)}</b> — ${nextM.milestone}</p></div><p style="font-size:12px;color:var(--text-3);margin-top:8px">Tap to open your 2-year roadmap →</p></div>`:""}
  <div class="card" style="margin-top:4px"><div class="card-t"><span class="ic">${ICON.check}</span>Jump In</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"><button class="btn btn-gold" style="flex:1;min-width:130px" onclick="goToLift()">${ICON.lift}${(started&&todayItem&&todayItem.kind==="lift")?"Start "+todayItem.label.split(" ")[0]:"Today's Lift"}</button><button class="btn btn-cyan" style="flex:1;min-width:130px" onclick="switchView('run')">${ICON.run}Run Plan</button></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-ghost" style="flex:1;min-width:130px" onclick="switchView('roadmap')">2-Year Roadmap</button><button class="btn btn-ghost" style="flex:1;min-width:130px" onclick="switchView('track')">Log Progress</button></div>
  </div>`;
  const lw=DB.weight.length?[...DB.weight].sort((a,b)=>b.date.localeCompare(a.date))[0].v:DB.profile.weight;
  document.getElementById("pillarStr").textContent=lw+" kg";
  document.getElementById("pillarStrMeta").textContent="natural peak ~"+Math.round(compute().ceilBW)+" kg";
}
/* ===== LIFT ===== */
function goToExtras(){curDay="extras";switchView('lift');}
function goToLift(){const dow=DOW[new Date().getDay()],map={Sat:"legsA",Sun:"pushA",Mon:"pullA",Tue:"legsB",Wed:"pushB",Thu:"pullB"};if(planStarted()&&map[dow]&&GYM[map[dow]]){liftPhase="hyper";curDay=map[dow];}switchView("lift");}
let liftPhase=DB.profile.phase==="hyper"?"hyper":"build";
let curDay=(DB.profile.phase==="hyper"?GYM_ORDER:["pushA","pullA","legsA","upperA"])[0];
function liftDayOrder(){return liftPhase==="build"?["pushA","pullA","legsA","upperA","extras"]:GYM_ORDER.concat(["extras"]);}
function renderLift(){
  const el=document.getElementById("view-lift"),order=liftDayOrder();
  if(!order.includes(curDay))curDay=order[0];
  el.innerHTML=`<div class="eyebrow">Strength Program · Muscle Priority</div><h2 class="view-title">Lift</h2>
    <p class="view-sub">Maximum lean muscle gain is the priority, trained aggressively. Compound-led, plain-English, only the highest-impact builders — 4 lifting days a week, chest/back/shoulders hit twice. Open <b>Aggressive growth techniques</b> below to train each set harder. Pick your phase, choose the day, log every set.</p>
    <div class="seg" id="liftPhaseSeg"><button data-ph="build"${liftPhase==="build"?" class=on":""}>Foundation (4-day)</button><button data-ph="hyper"${liftPhase==="hyper"?" class=on":""}>Pure Muscle (6-day)</button></div>
    <div class="note ${liftPhase==="build"?"cyan":"gold"}" id="liftPhaseNote"></div>
    <div class="seg" id="locSeg" style="margin-top:10px"><button data-loc="gym"${LOC==="gym"?" class=on":""}>Commercial Gym</button><button data-loc="home"${LOC==="home"?" class=on":""}>\ud83c\udfe0 Home Gym</button></div>
    <div class="seg" id="focusSeg" style="margin-top:8px"><button data-fx="on"${focusLB?" class=on":""}>Legs & Back focus ON</button><button data-fx="off"${!focusLB?" class=on":""}>Even split</button></div>
    <div class="pills" id="dayPills"></div><div id="liftBody"></div>`;
  document.getElementById("liftPhaseNote").innerHTML=liftPhase==="build"
    ?"<b>Muscle priority (now):</b> 4 hard, compound-led sessions a week — Push, Pull, Legs, then a second Upper day. Chest, back and shoulders get hit twice weekly, which is what actually drives growth. Running is trimmed to 2 easy/long runs so it doesn't steal your recovery. Legs are heavy once here, with running topping them up."
    :"<b>Post-race growth (after 24 Sep):</b> the full 6-day Push/Pull/Legs run twice through, every muscle trained 2× a week — your maximal muscle-building block \u2014 running is gone, so every unit of recovery goes to the bar.";
  document.querySelectorAll("#liftPhaseSeg button").forEach(b=>b.addEventListener("click",()=>{liftPhase=b.dataset.ph;DB.profile.phase=liftPhase;DB.save();curDay=liftDayOrder()[0];renderLift();}));
  renderDayPills();renderLiftDay();
}
function renderDayPills(){
  const wrap=document.getElementById("dayPills");
  wrap.innerHTML=liftDayOrder().map(d=>`<button class="pill${d===curDay?" on":""}" data-d="${d}">${GYM[d].name}</button>`).join("");
  wrap.querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>{curDay=b.dataset.d;renderDayPills();renderLiftDay();}));
}
function findLiftSession(day){const iso=todayISO();return DB.sessions.find(s=>s.dateISO===iso&&s.day===day);}
function ensureLiftSession(day){let s=findLiftSession(day);if(!s){s={id:"s"+Date.now()+Math.random().toString(36).slice(2,5),dateISO:todayISO(),day,entries:{}};DB.sessions.push(s);}return s;}
function liftLastTime(exId){const iso=todayISO();const past=DB.sessions.filter(s=>s.dateISO!==iso&&s.entries[exId]&&s.entries[exId].some(st=>st&&st.r&&st.w)).sort((a,b)=>b.dateISO.localeCompare(a.dateISO));if(!past.length)return null;return past[0].entries[exId].filter(st=>st&&st.r&&st.w);}
const HOME_SUB={
 pa1:{n:"DB Floor Squeeze Press (2\u00d715 kg)",h:"Press the bells together hard, 4 s lowering; last set rest-pause to RIR 0."},
 pa2:{n:"Floor Z-Press (2\u00d715 kg)",h:"Sit tall on the mat, legs long; strict overhead \u2014 your core does the bracing."},
 pa3:{n:"Deficit Push-Up, power bag on back",h:"Hands on the DB handles, chest below them; drop to knees at failure."},
 pa4:{n:"Feet-Elevated Push-Up (feet on the power bag)",h:"Upper-chest bias; 3 s negatives, partials at the bottom."},
 pa5:{n:"DB Floor Fly (5\u201315 kg)",h:"4 s lowering, arms hover just off the floor; finish with myo-reps."},
 pa7:{n:"Two-Hand DB Overhead Extension (15 kg)",h:"Deep stretch behind the head; lengthened partials to finish."},
 la1:{n:"Power-Bag Bent-Over Row (20 kg)",h:"1 s squeeze at the ribs; rest-pause the final set."},
 la2:{n:"DB Floor Pullover (15 kg)",h:"THE lat move without a bar \u2014 4 s arc, partials deep in the stretch."},
 la3:{n:"Single-Arm DB Row (hand on your knee)",h:"Brace on your own knee \u2014 strict, zero torso heave."},
 la4:{n:"Light DB Pullover, 15\u201320 reps",h:"Second pass at the stretch \u2014 slower still, lats only."},
 la5:{n:"Prone Rear-Delt Fly on the mat (2\u00d75 kg)",h:"2 s squeeze; add a round of Y-T-W raises."},
 la6:{n:"Floor Incline Curl (upper back propped on the bag)",h:"Arms hang behind you \u2014 the stretch does the work."},
 ga1:{n:"Bear-Hug Bag Squat + 15 kg goblet",h:"4 s down, 1.5 reps, rest-pause \u2014 legs only respect failure here."},
 ga2:{n:"DB Romanian Deadlift (2\u00d715 kg)",h:"4 s into a deep stretch; go single-leg once 15 reps come easy."},
 ga3:{n:"Bulgarian Split Squat (rear foot on the power bag)",h:"2\u00d715 kg \u2014 the honest leg-press replacement."},
 ga4:{n:"Reverse Lunge (2\u00d715 kg)",h:"Small space, same stimulus; longer stride = more glute."},
 ga5:{n:"Short-Stride 1.5-Rep Split Squat",h:"Rear foot on the floor, knee travels over the toe \u2014 quad isolation, zero props."},
 ga6:{n:"Med-Ball Hamstring Curl (heels on the ball)",h:"Bridge up, curl the ball in, 3 s out. Harder: Nordic negatives, feet under the bag."},
 ga7:{n:"Single-Leg Calf Raise (15 kg DB)",h:"Flat floor; 2 s pause at the top, 3 s down \u2014 the pause replaces the deficit."},
 pb1:{n:"Floor Z-Press (2\u00d715 kg)",h:"Sit tall, legs long, strict \u2014 myo-reps to finish."},
 pb2:{n:"Deficit Push-Up, feet on the power bag",h:"The incline-press stand-in; slow negatives."},
 pb3:{n:"DB Floor Press, dead-stop",h:"Pause on the floor every rep, explode up."},
 pb4:{n:"Floor Z-Press (2\u00d715 kg)",h:"No seat needed \u2014 sit tall on the mat, press strict."},
 pb5:{n:"5 kg Lateral-Raise 21s",h:"7 bottom-half + 7 top-half + 7 full \u2014 brutal on purpose."},
 pb6:{n:"DB Kickback \u2192 OH Extension superset",h:"Squeeze hard at lockout; no cable required."},
 lb1:{n:"Heavy DB Pullover + Bag Row superset",h:"The vertical-pull stand-in \u2014 both taken to RIR 0."},
 lb2:{n:"Power-Bag Seated Row",h:"Sit tall on the mat, legs long; row the handles to your navel, 2 s squeeze."},
 lb3:{n:"Single-Arm DB Row (hand on your knee)",h:"Extra range at the bottom; no heave."},
 lb4:{n:"Straight-Arm DB Pullover, light",h:"Arms locked long \u2014 lats only."},
 lb5:{n:"Prone Y-Raise + Rear Fly (5 kg)",h:"The face-pull job, done lying down."},
 lb6:{n:"Strict Standing Curl (2\u00d715 kg)",h:"Elbows pinned; myo-reps finish."},
 lb7:{n:"Reverse-Grip DB Curl (5\u201315 kg)",h:"Slow \u2014 the forearm burn is the point."},
 gb1:{n:"Power-Bag Deadlift + DB suitcase (\u224850 kg)",h:"Sharp hinge; then single-leg RDLs to true failure."},
 gb2:{n:"Bulgarian Split Squat (rear foot on the bag)",h:"Deep stretch, 1.5 reps \u2014 same move, harder execution."},
 gb3:{n:"Single-Leg Glute Bridge (+bag on hips)",h:"Shoulders on the mat; 2 s squeeze at the top."},
 gb4:{n:"Med-Ball Hamstring Curl",h:"Heels on the ball; bridge, curl in, slow out."},
 gb5:{n:"1.5-Rep Goblet Squat (15 kg)",h:"Quads cooked without a sled; finish with split-squat partials."},
 gb6:{n:"Seated Calf Raise (sit on the bag, DBs on knees)",h:"Soleus work; 2 s pauses top and bottom."},
 gb7:{n:"Ab-Roller Rollout (kneeling)",h:"An upgrade, not a substitute \u2014 brace hard, no lower-back sag."},
 ua1:{n:"Deficit Push-Up, feet on the power bag",h:"Upper chest; slow negatives, partials at the bottom."},
 ua2:{n:"DB Pullover + Bag Row superset",h:"The lat pair that replaces the bar."},
 ua3:{n:"Floor Z-Press (2\u00d715 kg)",h:"Sit tall, legs long \u2014 the strictest press there is."},
 ua4:{n:"Power-Bag Seated Row",h:"Sit tall, legs long; 2 s squeeze every rep."},
 ua6:{n:"Strict Standing DB Curl",h:"Slow negatives; myo-reps at the end."},
 ua7:{n:"Two-Hand OH DB Extension (15 kg)",h:"Long-head stretch replaces the rope."},
 x1:{n:"Prone Y-T-W (2\u00d75 kg)",h:"Rear delts and lower traps, no cable needed."},
 x3:{n:"Floor Incline Curl (back propped on the bag)",h:"Same stretch trick, propped on the bag."},
 x4:{n:"Two-Hand OH DB Extension (15 kg)",h:"Same muscle, deeper stretch."},
 x5:{n:"Single-Leg Calf Raise (15 kg)",h:"Flat floor, long pauses."},
 x6:{n:"Ab-Roller Rollout / Med-Ball Dead-Bug",h:"No bar required \u2014 the roller is the stronger option anyway."},
 ga8:{n:"Power-Bag Good Morning (20 kg)",h:"Bag on your traps, soft knees, hinge until the hamstrings load hard, squeeze back up. Slow and strict \u2014 the floor-friendly back extension."},
 gb8:{n:"Nordic Curl (heels under the loaded power bag)",h:"Knees on the mat, 5 s lowering, hands catch and push back. Add the med-ball hamstring curl after if you have anything left."},
 la8:{n:"Heavy DB Shrug (2\u00d715 kg)",h:"1 s hold at the top, full stretch at the bottom; bear-hug the 20 kg bag for a final all-out set."},
 lb8:{n:"Prone Y-Raise (2\u00d75 kg on the mat)",h:"Thumbs up, blades driven into your back pockets, 1 s hold at the top."},
 gb9:{n:"Seated Tibialis Raise (5 kg DB balanced on the foot)",h:"Sit on the bag, heels down, lift the toes high; a 5 kg bell across the toes adds the load."},
 la9:{n:"Single-Leg Calf Raise (15 kg DB)",h:"Flat floor; 2 s pause at the stretch, full squeeze at the top."},
 lb9:{n:"Seated Calf Raise (sit on the bag, DBs on knees)",h:"Bent knee for the soleus; 2 s pauses top and bottom."}
};
function isDeloadWeek(){try{const w=buildRoadmap().find(x=>x.wk===roadmapWeekNow());return !!(w&&w.deload);}catch(e){return false;}}
const RACES_12M=[
 {ym:"2026-09",d:"Every Saturday",name:"parkrun (Delta Park, Modderfontein, Gillooly\u2019s, Ruimsig)",co:[-26.13, 28.0],dist:"5 km \u00b7 free \u00b7 08:00",km:"5\u201320 km",st:"weekly",type:"walk/run",note:"Zero commitment. Walk it if you like \u2014 nobody checks."},
 {ym:"2026-09",d:"Sun 6 Sep 2026",name:"Hope In Motion",co:[-26.155, 28.115],dist:"5 km trail",km:"~9 km \u00b7 Huddle Park, Linksfield",st:"confirmed",type:"trail",note:"R80. Small, local, flat-ish. Tomorrow \u2014 only if you feel like a walk."},
 {ym:"2026-09",d:"Fri 18 Sep 2026",name:"After Dark Night Run",co:[-26.02, 27.83],dist:"5 / 10 km night trail",km:"~30 km \u00b7 Teak Place, Muldersdrift",st:"confirmed",type:"trail",note:"Head-torch trail run; a walk at the short distance."},
 {ym:"2026-09",d:"Sat 19 Sep 2026",name:"Warrior #2 \u2014 Taroko Trail Park",co:[-26.09, 28.14],dist:"5 / 8 / 10 km obstacle course",km:"~16 km \u00b7 Modderfontein Reserve",st:"confirmed",type:"obstacle",note:"R520. The one race format that rewards muscle: carries, climbs, crawls. A future Legs-day replacement, not a running event."},
 {ym:"2026-09",d:"Sun 20 Sep 2026",name:"Deadly Dozen Fitness Race \u2014 Johannesburg",co:[-26.18, 27.99],dist:"12 \u00d7 400 m runs + 12 stations: farmer\u2019s carry, 60 deadlifts, 60 lunges, snatches, burpee broad jumps, goblet squats, front carry, push press, bear crawl, clean & press, overhead carry, devil press",km:"~5 km \u00b7 UJ Athletics Track, Westdene",st:"confirmed",type:"fitness",note:"The most muscle-relevant race in the city, nine days out. Solo, pairs and relay formats; tickets on Webtickets. Enter the pairs and it is a strength day with a medal."},
 {ym:"2026-09",d:"Sun 20 Sep 2026",name:"Balwin Sport Jeppe Marathon",co:[-26.16, 28.13],dist:"42 / 21 / 10 / 5 km",km:"~12 km \u00b7 Saheti School, Senderwood",st:"confirmed",type:"road",note:"Free entry."},
 {ym:"2026-09",d:"Sat 26 Sep 2026",name:"Jozi Triathlon",co:[-26.17,28.35],dist:"Sprint / standard triathlon",km:"Ebotse Country Estate, Benoni",st:"confirmed",type:"tri",note:"Swim\u2013bike\u2013run; reference only."},
 {ym:"2026-09",d:"Sun 13 Sep 2026",name:"Vaal Marathon",co:[-26.70,27.84],dist:"42 / 21 / 10 km",km:"Vanderbijlpark",st:"confirmed",type:"road",note:"Listed for the radius maths; a long way south."},
 {ym:"2026-10",d:"Sat 3 Oct 2026",name:"Blair Atholl MTB",co:[-25.94,27.92],dist:"Mountain bike",km:"Blair Atholl, Lanseria",st:"confirmed",type:"cycle",note:"Off-road cycling; twelve minutes from your gate."},
 {ym:"2026-10",d:"Sat 3 Oct 2026",name:"Supa Store Soweto Race",co:[-26.26, 27.87],dist:"5 km",km:"~18 km \u00b7 Elkah Stadium, Rockville",st:"confirmed",type:"road",note:"R150."},
 {ym:"2026-10",d:"Sat 3 Oct 2026",name:"Black Eagle Mountain Run",co:[-26.09, 27.84],dist:"2 / 4 / 8 / 16 km trail",km:"~22 km \u00b7 Walter Sisulu Botanical Garden",st:"confirmed",type:"trail",note:"R120. Proper hills; a hike at the short distances."},
 {ym:"2026-10",d:"Sat 10 Oct 2026",name:"Owl Project 5 km Fun Run & Walk",co:[-26.09, 27.98],dist:"5 km",km:"~12 km \u00b7 Loerie Dog Park, Randburg",st:"confirmed",type:"walk",note:"R195. Explicitly a walk option."},
 {ym:"2026-10",d:"Sun 11 Oct 2026",name:"TinMan Joburg #4 Triathlon",co:[-25.96, 28.22],dist:"Sprint triathlon",km:"~28 km \u00b7 Olifantsfontein, Midrand",st:"confirmed",type:"tri",note:"Series race; reference only."},
 {ym:"2026-10",d:"Sun 18 Oct 2026",name:"Hollywoodbets Joburg 10 km / 5 km",co:[-26.13, 28.06],dist:"10 / 5 km",km:"~7 km \u00b7 James & Ethel Gray Park, Melrose",st:"confirmed",type:"road",note:"R220 / R180."},
 {ym:"2026-10",d:"Fri 23 Oct 2026",name:"Hollard Daredevil Run",co:[-26.16, 28.03],dist:"5 km",km:"~6 km \u00b7 Zoo Lake Sports Club",st:"confirmed",type:"road",note:"R200. Men\u2019s cancer-awareness run \u2014 in purple Speedos. Zero pace pressure, maximum story."},
 {ym:"2026-10",d:"Sat 31 Oct 2026",name:"The Versus Grand Prix",co:[-25.998, 28.07],dist:"10 km",km:"~25 km \u00b7 Kyalami circuit (edge of radius)",st:"confirmed",type:"road",note:"R349. A lap of the race track."},
 {ym:"2026-11",d:"Sun 15 Nov 2026",name:"Boxer Super Run \u2014 Johannesburg",co:[-26.15, 28.0],dist:"5 km",km:"~7 km \u00b7 Marks Park, Emmarentia",st:"confirmed",type:"road",note:"R100."},
 {ym:"2026-11",d:"Sun 22 Nov 2026",name:"Ride Joburg (the 947)",co:[-25.998, 28.07],dist:"97 km / 35 km cycling",km:"~25 km \u00b7 Kyalami (edge of radius)",st:"confirmed",type:"cycle",note:"R525\u2013810. Joburg\u2019s biggest sporting day. Cycling, not running."},
 {ym:"2026-11",d:"Sat 28 Nov 2026",name:"Warrior #3 \u2014 Cradle",co:[-26.01, 27.84],dist:"5 / 8 / 10 km obstacle course",km:"~30 km \u00b7 Avianto, Muldersdrift",st:"confirmed",type:"obstacle",note:"Season finale of the obstacle series; carries, climbs, crawls."},
 {ym:"2026-11",d:"Sun 29 Nov 2026",name:"TinMan Joburg #5 Triathlon",co:[-25.96, 28.22],dist:"Sprint triathlon",km:"~28 km \u00b7 Olifantsfontein, Midrand",st:"confirmed",type:"tri",note:"Series race; reference only."},
 {ym:"2026-11",d:"Fri\u2013Sun 27\u201329 Nov 2026",name:"Virgin Active HYROX Johannesburg",co:[-26.25, 27.98],dist:"8 \u00d7 1 km runs + 8 stations: ski erg, sled push, sled pull, burpee broad jumps, row, farmer\u2019s carry, sandbag lunges, wall balls",km:"~12 km \u00b7 Johannesburg Expo Centre, Nasrec",st:"confirmed",type:"fitness",note:"The world\u2019s biggest fitness race. Singles, Doubles or Relay \u2014 enter Doubles to share the running and keep the strength. Entries open at hyrox.com."},
 {ym:"2026-11",d:"Sun 29 Nov 2026",name:"African Bank Soweto Marathon",co:[-26.25, 27.98],dist:"42 / 21 / 10 km",km:"~12 km \u00b7 Nasrec",st:"confirmed",type:"road",note:"The People\u2019s Race. Organiser listings give 29 Nov; final timing still to be confirmed."},
 {ym:"2026-11",d:"Sat 14 Nov 2026",name:"Deadly Dozen Fitness Race \u2014 Pretoria",co:[-25.75,28.23],dist:"12 \u00d7 400 m runs + 12 strength stations",km:"Pretoria",st:"confirmed",type:"fitness",note:"The second Gauteng edition; the Johannesburg one is closer."},
 {ym:"2026-12",d:"Sun 13 Dec 2026",name:"Joburg Ultra Triathlon",co:[-26.02,27.75],dist:"Triathlon \u00b7 free entry",km:"Cradlemoon, Krugersdorp",st:"confirmed",type:"tri",note:"Free to enter; reference only."},
 {ym:"2026-12",d:"Sat\u2013Sun 5\u20136 Dec 2026",name:"NPC / IFBB Pro African Championships (bodybuilding)",co:null,dist:"Bodybuilding \u00b7 classic physique \u00b7 men\u2019s physique",km:"Johannesburg \u00b7 venue to be confirmed",st:"confirmed",type:"muscle",note:"Spectate. This is the standard you are building toward, on a stage 12 weeks from Day 1. Date published; venue not yet."},
 {ym:"2027-01",d:"late Jan 2027 (expected)",name:"Gauteng Bench Press & Powerlifting Championships (SA Powerlifting)",co:[-26.13, 28.06],dist:"Squat \u00b7 bench \u00b7 deadlift \u00b7 bench-only",km:"~7 km \u00b7 Olympic House, James & Ethel Gray Park, Melrose",st:"expected",type:"muscle",note:"IPF-affiliated and drug-tested \u2014 the natural athlete\u2019s meet, and a real strength benchmark for this plan. 2026 edition ran 24\u201325 Jan; needs an affiliated club (School of Strength hosts here)."},
 {ym:"2027-01",d:"mid-Jan 2027 (expected)",name:"Biogen Half-Marathon",co:[-26.18, 28.13],dist:"21 / 10 / 5 km",km:"~15 km \u00b7 Virgin Active Bedfordview",st:"expected",type:"road",note:"2026 edition ran 11 Jan."},
 {ym:"2027-02",d:"Sun 7 Feb 2027",name:"Joburg North City Marathon",co:[-26.15, 28.0],dist:"42 / 21 / 10 / 5 km",km:"~7 km \u00b7 Marks Park, Emmarentia",st:"confirmed",type:"road",note:"Entries already open (Peak Timing)."},
 {ym:"2027-02",d:"mid-Feb 2027 (expected)",name:"Randburg Harriers Valentine\u2019s 10K",co:[-26.09, 27.99],dist:"10 km",km:"~12 km \u00b7 Randburg Sports Complex",st:"expected",type:"road",note:"2026 edition ran 13 Feb."},
 {ym:"2027-02",d:"Feb 2027 (expected)",name:"Westgate Race",co:[-26.12, 27.88],dist:"21 / 10 / 5 km",km:"~18 km \u00b7 Roodepoort",st:"expected",type:"road",note:"2026 edition ran 8 Feb."},
 {ym:"2027-02",d:"Sun 28 Feb 2027",name:"Johnson Crane Hire Marathon",co:[-26.19, 28.32],dist:"42 / 21 / 10 / 5 km",km:"~30 km \u00b7 Benoni",st:"confirmed",type:"road",note:"43rd edition, entries open (Benoni Harriers). Date via aggregator listing \u2014 verify on johnsoncranemarathon.co.za. The weekend before your March check."},
 {ym:"2027-03",d:"late Mar 2027 (expected)",name:"Johannesburg City Marathon (ex-Jackie Gibson)",co:[-26.33, 28.0],dist:"42 / 21 / 10 km",km:"~14 km \u00b7 Klipriviersberg, Kibler Park",st:"expected",type:"road",note:"Joburg\u2019s oldest marathon; 2026 edition ran 29 Mar."},
 {ym:"2027-03",d:"Mar 2027 (expected)",name:"SA Classic Powerlifting Championships / Gauteng Classic Provincials",co:[-26.13, 28.06],dist:"Squat \u00b7 bench \u00b7 deadlift (raw)",km:"~7 km \u00b7 Olympic House, Melrose (2026 host)",st:"expected",type:"muscle",note:"2026 nationals ran 19\u201322 Mar in Gauteng; 2027 host province not yet announced. Provincials are the realistic first meet."},
 {ym:"2027-05",d:"late May 2027 (expected)",name:"Virgin Active HYROX Johannesburg \u2014 autumn edition",co:[-26.25, 27.98],dist:"8 \u00d7 1 km runs + 8 strength stations",km:"~12 km \u00b7 Nasrec",st:"expected",type:"fitness",note:"2026 ran 30\u201331 May; Johannesburg has hosted two a year."},
 {ym:"2027-03",d:"Mar 2027 (expected)",name:"Om Die Dam Ultra",co:[-25.74,27.85],dist:"50 / 21 / 10 km",km:"Hartbeespoort Dam",st:"expected",type:"road",note:"Listed for the radius maths."},
 {ym:"2027-05",d:"Sat 1 May 2027",name:"Miway Wally Hayward Marathon",co:[-25.86,28.19],dist:"42 / 21 / 10 / 5 km",km:"Centurion",st:"confirmed",type:"road",note:"Runs on 1 May every year; entries close 15 April or at the cap."},
 {ym:"2027-05",d:"May/Jun 2027 (unverified)",name:"Arnold Classic Africa \u2014 Multisport Festival & Expo",co:[-26.107, 28.056],dist:"Bodybuilding \u00b7 raw powerlifting \u00b7 bench-press \u00b7 strongman \u00b7 expo",km:"~12 km \u00b7 Sandton Convention Centre (past years; 2022 ran at Ruimsig)",st:"expected",type:"muscle",note:"The one event built around your exact goal. Raw meets historically ~R1,000 entry. Continuity since 2022 is unclear \u2014 verify before planning around it."},
 {ym:"2027-07",d:"mid-Jul 2027 (expected)",name:"RAC 10 km Road Race",co:[-26.09, 27.99],dist:"10 / 5 km",km:"~12 km \u00b7 Randburg",st:"expected",type:"road",note:"2026 edition ran 12 Jul."},
 {ym:"2027-07",d:"late Jul 2027 (expected)",name:"Discovery 702 Walk the Talk",co:[-26.15, 28.0],dist:"5 / 8 / 15 km \u2014 walking",km:"~7 km \u00b7 Marks Park / Zoo Lake",st:"expected",type:"walk",note:"A walk, not a run \u2014 the one mass event that fits a pure-muscle year at zero recovery cost."},
 {ym:"2027-08",d:"early Aug 2027 (expected)",name:"Old Eds Road Race",co:[-26.16, 28.05],dist:"21 / 10 / 5 km",km:"~5 km \u00b7 Houghton",st:"expected",type:"road",note:"2026 edition ran 9 Aug."},
 {ym:"2027-08",d:"mid-Aug 2027 (expected)",name:"The Wedge Road Race",co:[-26.08, 28.06],dist:"10 / 5 km",km:"~12 km \u00b7 Morningside",st:"expected",type:"road",note:"2026 edition ran 15 Aug."},
 {ym:"2027-08",d:"late Aug 2027 (expected)",name:"Wanderers Road Race",co:[-26.13, 28.05],dist:"21 / 10 / 5 km",km:"~8 km \u00b7 Illovo",st:"expected",type:"road",note:"2026 edition ran 23 Aug."},
 {ym:"2027-08",d:"late Aug 2027 (expected)",name:"Clearwater Mall Race",co:[-26.1, 27.9],dist:"21 / 10 / 5 km",km:"~22 km \u00b7 Roodepoort",st:"expected",type:"road",note:"2026 edition ran 22 Aug."}
];
const HOME_LL=[-26.045,27.955];
let radiusKm=load("cb2_radius",30);
function havKm(a,b){if(!a||!b)return null;const R=6371,dLat=(b[0]-a[0])*Math.PI/180,dLon=(b[1]-a[1])*Math.PI/180;const x=Math.sin(dLat/2)**2+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)**2;return Math.round(2*R*Math.asin(Math.sqrt(x)));}
function evKm(r){return r.co?havKm(HOME_LL,r.co):null;}
function evVenue(r){return String(r.km||"").replace(/^~\d+\s*km\s*\u00b7\s*/,"").replace(/\s*\(edge of radius\)/,"");}
function raceCalendarHTML(){
  const months=[];const t=todayISO();let y=+t.slice(0,4),m=+t.slice(5,7);
  for(let i=0;i<12;i++){months.push(`${y}-${String(m).padStart(2,"0")}`);m++;if(m>12){m=1;y++;}}
  const names={"01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"May","06":"Jun","07":"Jul","08":"Aug","09":"Sep","10":"Oct","11":"Nov","12":"Dec"};
  const nowYm=t.slice(0,7);
  const inside=r=>{const k=evKm(r);return k==null||k<=radiusKm;};const rows=months.map(ym=>{const ev=RACES_12M.filter(r=>r.ym===ym&&r.st!=="weekly"&&inside(r)).sort((a,b)=>(evKm(a)||0)-(evKm(b)||0));const cur=ym===nowYm;
    const chips=ev.length?ev.map(r=>`<div style="margin:6px 0 0;padding:8px 10px;border-radius:9px;background:var(--panel-3);border-left:3px solid ${r.st==="confirmed"?"var(--go)":"var(--gold)"}"><div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:13px">${r.name}</b> <span style="font-size:10px;padding:1px 6px;border-radius:6px;background:var(--panel-2);color:var(--text-3);font-family:var(--f-mono);white-space:nowrap">${(r.type||"road").toUpperCase()}</span><span style="font-size:11px;font-family:var(--f-mono);color:${r.st==="confirmed"?"var(--go)":"var(--gold)"};white-space:nowrap">${r.st==="confirmed"?"CONFIRMED":"EXPECTED"}</span></div><div style="font-size:12px;color:var(--text-2);margin-top:2px">${r.d} \u00b7 ${r.dist}</div><div style="font-size:12px;color:var(--text-3)">${evKm(r)!=null?"~"+evKm(r)+" km from home \u00b7 ":"venue TBC \u00b7 "}${evVenue(r)} \u00b7 ${r.note}</div></div>`).join("")
      :`<div style="font-size:12px;color:var(--text-3);margin-top:4px">No published event within ~25 km yet \u2014 SA race calendars typically confirm 3\u20136 months out.</div>`;
    return `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;color:${cur?"var(--gold)":"var(--text)"}">${names[ym.slice(5)]} ${ym.slice(0,4)}${cur?" \u00b7 now":""}</span><span style="font-family:var(--f-mono);font-size:12px;color:var(--text-3)">${ev.length} event${ev.length===1?"":"s"}</span></div>${chips}</div>`;}).join("");
  const wk=RACES_12M.find(r=>r.st==="weekly");
  return `<div class="card"><div class="card-t"><span class="ic">${ICON.run}</span>12-Month Race & Fitness Calendar \u2014 within ${radiusKm} km of home</div>
  <div class="seg" id="radiusSeg" style="margin-top:10px">${[15,30,45,60].map(k=>`<button data-r="${k}"${k===radiusKm?" class=on":""}>${k} km</button>`).join("")}</div>
  <div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(255,197,61,.08);border:1px solid rgba(255,197,61,.35);font-size:13px;line-height:1.5"><b style="color:var(--gold)">Built for your goal, not for runners:</b> Deadly Dozen Fitness Race (20 Sep, Westdene \u2014 12 runs, 12 strength stations, ~15 km from home) \u00b7 HYROX Johannesburg (27\u201329 Nov, Nasrec) \u00b7 NPC/IFBB bodybuilding show (5\u20136 Dec, spectate) \u00b7 SA Powerlifting Gauteng meets at Melrose (Jan & Mar, drug-tested) \u00b7 Warrior obstacle races (19 Sep) \u00b7 Arnold Classic Africa (May/Jun, verify). Those five are the muscle-relevant anchors; everything else is optional cardio with a medal.</div>
  <div class="card-st">Distances are computed from your home in Bellcanto Estate, North Riding (straight line; road distance runs 10\u201325% longer). Change the radius above and the calendar re-filters instantly. Sources: RaceSpace Gauteng listings, Peak Timing, Racepass, Webtickets, RunningCalendar and organiser sites; cross-checked, nothing invented. Green = date published by the organiser. Gold = annual event whose 2027 date is not yet out, shown at its usual slot with last year\u2019s date.</div>
  <div style="margin-top:10px;padding:8px 10px;border-radius:9px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.25);font-size:12px"><b>${wk.d}:</b> ${wk.name} \u2014 ${wk.dist} \u00b7 ${wk.km}. ${wk.note}</div>
  <div style="margin-top:8px;padding:8px 10px;border-radius:9px;background:rgba(63,216,200,.07);border:1px solid rgba(63,216,200,.25);font-size:12px"><b>Weekly, free, inside 10 km:</b> Pirates Club Homerun \u2014 Thu 17:45 & Sun 07:00, Braeside Rd, Greenside, ~12 km (non-members welcome) \u00b7 club time trials at Randburg Harriers (~6 km), Rand Athletic Club (~8 km), Pirates (~12 km) and Wanderers (~13 km) \u2014 5\u20138 km, open to all \u00b7 Nike Run Club, The Zone @ Rosebank, Tue/Wed 17:30 (confirm) \u00b7 The Social Runners, Central Square Sandton, Wed 17:15 \u00b7 Tyrone Harriers, Croft & Co Parkview, daily from 05:00. Reference only \u2014 walking a time trial is allowed and nobody minds.</div>
  <div style="margin-top:6px">${rows}</div>
  <div class="calc-note" style="margin-top:10px">Just outside ${radiusKm} km, for the record: ${RACES_12M.filter(r=>r.st!=="weekly"&&evKm(r)!=null&&evKm(r)>radiusKm&&months.includes(r.ym)).sort((a,b)=>evKm(a)-evKm(b)).map(r=>r.name+" ("+evVenue(r)+", ~"+evKm(r)+" km, "+r.d.replace(/ \(expected\)| \(unverified\)/,"")+")").join(" \u00b7 ")||"nothing"}. Nothing here is a plan \u2014 the plan is in the Lift tab.</div></div>`;
}
function posteriorStats(){
  let post=0,total=0,byDay={};
  GYM_ORDER.forEach(k=>{const d=GYM[k];if(!d)return;let p=0;d.ex.forEach(e=>{total+=e.sets;if(e.post)p+=e.sets;});post+=p;byDay[k]=p;});
  return {post,total,share:total?Math.round(post/total*100):0,byDay};
}
function restDoctrineHTML(){return `<div class="calc-note" style="margin-top:10px"><b>Rest days \u2014 minimal by design, and why not zero.</b> Six lifting days plus one active-recovery Friday is the least rest that still lets a 38-year-old grow: muscle protein synthesis from a hard session runs 24\u201348 hours, and the six-day split already returns to every muscle inside 72. A seventh lifting day would only take from the next Legs A. The full rest days live inside the deload weeks (6, 12, 18 \u2026), and the Weekly Review can reclaim a Friday whenever stalls or short sleep show up. Rest <i>between sets</i> is not negotiable: 2\u20133 minutes on compounds is where the muscle-building sets are earned \u2014 cutting it makes sessions shorter, not bigger.</div>`;}
function regionCardHTML(){const r=regionSets();const order=["calves","hamstrings","glutes","quads","lower back","mid back","upper back"];
  const rows=order.map(k=>{const v=r[k]||0;const c=v>=16?"var(--go)":v>=12?"var(--gold)":"var(--bad)";return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)"><span style="text-transform:capitalize">${k}</span><span style="display:flex;align-items:center;gap:8px"><span style="width:${Math.min(120,v*5)}px;height:6px;border-radius:3px;background:${c}"></span><span style="font-family:var(--f-mono);color:${c};min-width:52px;text-align:right">${v} sets</span></span></div>`;}).join("");
  return `<div class="card" style="border-color:rgba(74,222,128,.35)"><div class="card-t" style="color:var(--go)"><span class="ic">${ICON.lift}</span>Legs & Back Focus \u2014 the region map</div>
  <div class="card-st">Extreme focus, done honestly: a redistribution, not a pile-on. Every lower-body and back exercise carries one extra hard set; chest, shoulder and arm isolations give one up. Total weekly work stays inside what a 38-year-old recovers from.</div>
  <div style="margin-top:8px">${rows}</div>
  <div class="calc-note" style="margin-top:10px"><b>Weekly hard sets per region${focusLB?" with the focus on":" (focus off)"}.</b> Green is 16+, the top of the productive range; gold is 12\u201315; red is under-served. Calves now train <b>four days a week</b> \u2014 standing (gastrocnemius) on Legs A and Pull A, seated (soleus) on Legs B and Pull B, and tibialis raises on Legs B for the front of the shin: that is \u201call round\u201d. Lower back rides the deadlift, the 45\u00b0 extension and the RDL; mid back is the rows and pullovers; upper back is the shrugs, Y-raises, face pulls and rear-delt work.</div>
  <div class="calc-note" style="margin-top:10px"><b>The rule that keeps it aggressive instead of stupid:</b> the extra set on a compound is the last set of that exercise, taken to RIR 0; the trimmed set on an isolation is the first one. Switch the focus off in Lift (\u201cEven split\u201d) if the Weekly Review flags stalls or sleep \u2014 the map recomputes instantly.</div></div>`;}
function posteriorCardHTML(){
  const ps=posteriorStats();
  const rows=GYM_ORDER.map(k=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)"><span style="color:var(--text-2)">${GYM[k].name}</span><span style="font-family:var(--f-mono);color:${ps.byDay[k]>=6?"var(--go)":ps.byDay[k]>0?"var(--gold)":"var(--text-3)"}">${ps.byDay[k]} sets</span></div>`).join("");
  return `<div class="card" style="border-color:rgba(110,231,255,.34)">
  <div class="card-t cyan"><span class="ic">${ICON.lift}</span>The Posterior Chain Case</div>
  <div class="card-st">Hamstrings, glutes, erectors, lats and traps — the back half of your body, and the half that decides whether you look built or just heavier.</div>
  <div class="dose-grid" style="margin-top:12px">
    <div class="dose"><div class="dn">Posterior sets / week</div><div class="dv">${ps.post}<small>hard sets, 6-day week</small></div></div>
    <div class="dose"><div class="dn">Share of all work</div><div class="dv">${ps.share}%<small>of ${ps.total} weekly sets</small></div></div>
    <div class="dose"><div class="dn">Trained</div><div class="dv">6<small>days out of 6</small></div></div>
  </div>
  <div class="calc-note" style="margin-top:12px"><b>Why it earns the emphasis:</b> the posterior chain holds the largest muscles you own — glutes, hamstrings, erectors and lats outweigh everything on the front. For a ceiling run that needs every remaining kilo of lean mass, this is simply where most of that mass is available. It is also what carries visible thickness: the back and hamstrings are what separate a big frame from a soft one at the same scale weight.</div>
  <div class="calc-note" style="margin-top:10px"><b>The three holes now closed:</b> the plan trained hamstrings only through hinging and machine curls, erectors only as a by-product of deadlifts, and traps not at all. Hamstrings cross two joints and need <b>both</b> jobs trained — hip extension (RDL, deadlift) <b>and</b> knee flexion under heavy eccentric load (Nordics). That second job is where hamstring size and injury resistance actually come from.</div>
  <div style="margin-top:12px">${rows}</div>
  <div class="calc-note" style="margin-top:12px"><b>What was added:</b> 45° Back Extension on Legs A (erectors, glutes, hamstrings — full range, low spinal cost) · Nordic Hamstring Curl on Legs B (eccentric knee flexion; the strongest injury-prevention evidence of any exercise) · Heavy Shrug on Pull A (direct trap loading, finally) · Prone Y-Raise on Pull B (lower traps, shoulder insurance under a heavy pressing load). Honest cost: roughly 5\u20138 minutes on each of those four sessions.</div>
  <div class="calc-note" style="margin-top:10px"><b>Home gym:</b> every one of them has a kit-pure version \u2014 power-bag good mornings, heels-under-the-bag Nordics, heavy dumbbell shrugs, 5 kg Y-raises on the mat. Nothing added assumes equipment you do not own.</div>
  </div>`;
}
function sessionTimeEstimate(dayKey){
  const d=GYM[dayKey];if(!d)return null;
  const WORK=45; // seconds under the bar per set
  let fullS=0,coreS=0,isoRest=0,isoNames=[];
  d.ex.forEach(e=>{
    const r=parseRest(e.rest),t=e.sets*(WORK+r);
    fullS+=t;
    if(e.cmp)coreS+=t;else{isoRest+=e.sets*r;if(isoNames.length<2)isoNames.push(e.name);}
  });
  const wu=9*60, topset=(dayKey==="extras")?0:2*60;
  const full=Math.round((fullS+wu+topset)/60), core=Math.round((coreS+wu+topset)/60);
  const save=Math.round(isoRest*0.45/60);
  return {full,core:d.ex.some(e=>e.cmp)?core:full,save,isoNames};
}
function renderLiftDay(){
  const day=GYM[curDay],session=findLiftSession(curDay),dt=dayType(curDay);
  const wIco='<svg class="tic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v6m0 8v6M5 12H2m20 0h-3M6.3 6.3L4 4m16 16l-2.3-2.3M6.3 17.7L4 20M20 4l-2.3 2.3" stroke-linecap="round"/></svg>';
  const pIco='<svg class="tic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="4" height="12" rx="1"/><rect x="17" y="6" width="4" height="12" rx="1"/><path d="M7 12h10" stroke-linecap="round"/></svg>';
  const chev='<span class="chev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  let html=`<div class="tool" id="toolWarm"><div class="tool-h" data-tool="warm">${wIco}<h4>Warm-up &amp; cool-down</h4>${chev}</div><div class="tool-b"><div class="warmblk"><b>Warm-up (8-10 min — don't skip):</b> ${WARMUP[dt]}</div><div class="warmblk" style="margin-top:12px"><b>Cool-down (5 min):</b> ${COOLDOWN[dt]}</div></div></div>
  <div class="tool" id="toolPlate"><div class="tool-h" data-tool="plate">${pIco}<h4>Plate &amp; warm-up calculator</h4>${chev}</div><div class="tool-b"><div class="plate-row"><div class="field"><label>Working weight (kg)</label><input type="number" inputmode="decimal" id="plW" placeholder="100"></div><div class="field"><label>Bar (kg)</label><input type="number" inputmode="decimal" id="plBar" value="20"></div></div><div id="plateOut"><div class="plate-txt" style="color:var(--text-3)">Enter a working weight to see what to load per side, plus your warm-up sets.</div></div></div></div>
  <div class="tool" id="toolAgg"><div class="tool-h" data-tool="agg"><svg class="tic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke-linecap="round" stroke-linejoin="round"/></svg><h4>Aggressive growth techniques</h4>${chev}</div><div class="tool-b"><div class="prose" style="font-size:13.5px">
    <p style="color:var(--go);font-weight:700;margin-bottom:8px">Be aggressive in the gym, disciplined in the kitchen. This is how you train aggressively for lean muscle — none of it adds fat, all of it adds stimulus.</p>
    <p>• <b>Take the last set to the limit (RIR 0-1).</b> On the final set of each exercise, push until you genuinely couldn't get another clean rep (or maybe one). Keep 1-2 reps in the tank on earlier sets so you don't burn out before the money set. Training close to failure is the single biggest driver of growth.</p>
    <p>• <b>Drop sets</b> (best on the last set of isolations — laterals, curls, pushdowns, leg extensions): hit failure, instantly strip ~25-30% off, keep going to failure again. One drop set torches a muscle and adds big stimulus in seconds.</p>
    <p>• <b>Rest-pause:</b> at failure, rack the weight, breathe for 15 seconds, then squeeze out 3-5 more reps. Brutal and effective on machines and isolations.</p>
    <p>• <b>Partials past failure:</b> when you can't get a full rep, do a few short reps in the strongest part of the range. Extra stimulus when the muscle is already cooked.</p>
    <p>• <b>Supersets:</b> pair opposing muscles back-to-back (curls + pushdowns, chest + back) — more work in less time and a huge pump.</p>
    <p>• <b>Progressive overload — the real engine.</b> Beat your last session almost every week: one more rep, or a little more weight. Use <b>double progression</b> — climb to the top of the rep range on all sets, then add weight and drop back to the bottom. Your logged sets show you exactly what to beat.</p>
    <p>• <b>Add volume over the block:</b> start at the listed sets; add 1 set to any lagging muscle every 1-2 weeks. When progress stalls or you feel beaten up, take a deload week (half the sets), then come back stronger.</p>
    <p><span class="hl">The catch:</span> aggressive training only works if recovery keeps up. That means hitting your max-lean-gain calories and protein, 7-9 hours of sleep, and a deload roughly every 6 weeks. Push hard <i>and</i> recover hard — that's how aggression becomes muscle instead of burnout or injury.</p>
  </div></div></div>`;
  const notes=[],guided=(LOC==="home"&&focusOn);
  if(LOC==="home")notes.push(`<div class="note cyan" style="margin-top:4px"><b>\ud83c\udfe0 Home Gym mode</b> \u2014 your exact kit: 2\u00d75 kg + 2\u00d715 kg dumbbells, 20 kg power bag, medicine ball, ab roller, mat \u2014 no bar, bench, pull-up bar or cables. Nothing below assumes furniture either: dumbbells, bag, ball, roller, mat and floor only. Gold notes below give each exercise\u2019s home version (no note = it already works as-is). The law that makes light kit grow: <b>every set to RIR 0\u20131</b>, 3\u20134 s lowering, finished with lengthened partials, myo-reps or rest-pause.</div>`);
  if(dt==="extras"&&day.sub)html+=`<div class="note cyan" style="margin-top:6px"><b>${day.name} \u2014 ${day.sub}.</b> Keep it to 30\u201340 minutes, nothing that touches tomorrow\u2019s legs; rear delts, arms, calves and core only. Full rest instead if the Weekly Review flagged stalls or sleep.</div>`;
  if(LOC==="home"){const loads=day.ex.map(e=>HOME_SUB[e.id]?homeRx(e,HOME_SUB[e.id]).load:"2\u00d715 kg DBs").join(" | ");const kit=[["bag","20 kg power bag"],["15 kg","2\u00d715 kg dumbbells"],["5 kg","2\u00d75 kg dumbbells"],["med ball","medicine ball"],["medicine ball","medicine ball"],["Rollout","ab roller"]].filter(([k])=>loads.includes(k)||(k==="Rollout"&&day.ex.some(e=>HOME_SUB[e.id]&&/Rollout/.test(HOME_SUB[e.id].n)))).map(([,v])=>v).filter((v,i,a)=>a.indexOf(v)===i);const N=day.ex.length,cur=Math.min(focusIdx,N-1);
    html+=`<div class="card" style="border-color:rgba(255,197,61,.35)"><div class="card-t" style="color:var(--gold)"><span class="ic">${ICON.lift}</span>\ud83c\udfe0 Home session \u2014 ${day.name}</div>
    <div class="calc-note"><b>Lay out:</b> ${kit.join(" \u00b7 ")} \u00b7 mat. Rest 60\u201390 s between sets \u2014 start the timer.</div>
    <div class="calc-note" style="margin-top:8px"><b>3-minute warm-up:</b> 20 bodyweight squats \u2192 10 push-ups \u2192 10 bag good-mornings \u2192 10 overhead presses with the 5 kg bells \u2192 30 s dead-bug. Then straight into exercise 1.</div>
    ${focusOn?`<div style="display:flex;align-items:center;gap:8px;margin-top:10px"><button class="btn" style="flex:1;background:var(--panel-3);color:var(--text);border:1px solid var(--line)" onclick="focusIdx=Math.max(0,focusIdx-1);renderLiftDay()">\u2039 Prev</button><div style="flex:1.2;text-align:center;font-family:var(--f-mono);color:var(--gold)">Exercise ${cur+1} of ${N}</div>${cur<N-1?`<button class="btn btn-gold" style="flex:1" onclick="focusIdx=Math.min(${N-1},focusIdx+1);renderLiftDay();document.getElementById('liftBody').scrollIntoView({block:'start'})">Next \u203a</button>`:`<button class="btn btn-gold" style="flex:1" onclick="focusOn=false;focusIdx=0;renderLiftDay();toast('Session complete \u2014 log any missing sets',true)">Finish \u2713</button>`}</div>`:`<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-gold" style="flex:1" onclick="focusOn=true;focusIdx=0;renderLiftDay();document.getElementById('liftBody').scrollIntoView({block:'start'})">\u25b6 Guide me \u2014 one exercise at a time</button></div>`}
    </div>`;}
  if(isDeloadWeek())html+=`<div class="note gold" style="margin-top:4px"><b>Deload week — roadmap week ${roadmapWeekNow()}.</b> Keep every exercise, cut loads to ~60–70% (or halve the sets), stay 3+ reps from failure, skip top sets. This is the week the last five turn into muscle — full intensity returns next week.</div>`;
  if(bulkMode==="aggr"&&!isDeloadWeek())notes.push(`<div class="note gold" style="margin-top:4px"><b>Aggressive mode${aggrLive()?" \u2014 to the March check":""}:</b> the last set of <b>every</b> exercise goes to RIR 0; the first compound gets <b>one extra working set</b> (tap Add set); load goes up the first session you hit the top of the rep range on set one, not on all sets. The price: the waist brake is the band \u2014 +5 cm from baseline by March and not a centimetre more \u2014 and if sleep drops under 7 hours this mode switches off in Fuel. Deload weeks are still honoured.</div>`);
  const _ps=day.ex.filter(e=>e.post).reduce((a,e)=>a+e.sets,0);
  if(_ps>0)notes.push(`<div class="note cyan" style="margin-top:4px"><b>Posterior chain today: ${_ps} hard sets</b> — hamstrings, glutes, erectors, lats and traps. Drive these with intent; the back half is where the remaining mass lives.</div>`);
  if(dt!=="extras")notes.push(LOC==="home"
    ? `<div class="note gold" style="margin-top:4px"><b>Home strength rule \u2014 failure is the load:</b> no heavy bar exists here, so your \u201ctop set\u201d is the first exercise\u2019s hardest variation taken to <b>RIR 0 with a 4-second lowering</b>, then the listed back-offs. Beating last week\u2019s reps IS the progressive overload \u2014 log honestly.</div>`
    : `<div class="note gold" style="margin-top:4px"><b>Strength top set \u2014 first lift only:</b> after warm-ups, make your first work set of <b>${day.ex[0].name}</b> a TOP SET of <b>3-5 reps at RPE 8-9</b> (1-2 reps left in the tank). Then strip ~10-15% and complete the listed sets and reps as back-offs. The heavy set is what maximises pure strength; the back-offs keep the size stimulus. Skip top sets on deload weeks.</div>`);
  const te=sessionTimeEstimate(curDay);
  if(te)notes.push(`<div class="note cyan" style="margin-top:8px"><b>Session time — computed from this day\u2019s sets & rests:</b>
    <span style="display:flex;gap:8px;margin:8px 0">
      <span class="dose" style="flex:1"><span class="dn">Full session</span><span class="dv">\u2248${te.full}<small>min \u00b7 incl. warm-up</small></span></span>
      <span class="dose" style="flex:1"><span class="dn">Core (compounds)</span><span class="dv">\u2248${te.core}<small>min \u00b7 ~80% of growth</small></span></span>
    </span>
    <b>Where the returns diminish:</b> the compounds above carry most of the stimulus \u2014 past ~10 hard sets per muscle in one session, extra sets add little. Rushed? Do the core, skip the rest guilt-free.${te.isoNames.length>=2?` <b>Save \u2248${te.save} min:</b> superset ${te.isoNames[0]} \u27c2 ${te.isoNames[1]} back-to-back (60s rest between pairs).`:""} Let the rest timer police the gaps \u2014 that\u2019s where sessions bloat.</div>`);
  {const _te=sessionTimeEstimate(curDay);const summ=[bulkMode==="aggr"&&!isDeloadWeek()?"Aggressive":null,_ps>0?_ps+" posterior sets":null,_te?"~"+_te.full+" min":null,LOC==="home"?"home kit":null,focusLB?"legs & back focus":null].filter(Boolean).join(" \u00b7 ");
  if(notes.length)html+=`<div class="tool" id="rulesTool"><div class="tool-h"><span class="ic">${ICON.check}</span><h4>Today\u2019s rules \u2014 ${summ}</h4><span class="chev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><div class="tool-b">${notes.join("")}</div></div>`;}
  ((LOC==="home"&&focusOn)?[day.ex[Math.min(focusIdx,day.ex.length-1)]]:day.ex).forEach(e=>{
    const logged=(session&&session.entries[e.id])||[],lt=liftLastTime(e.id);
    const hsx=(LOC==="home"&&HOME_SUB[e.id])||null,rx=hsx?homeRx(e,hsx):null;
    html+=`<div class="ex"><div class="ex-h"><div class="ex-n">${e.n}</div><div class="ex-ti"><div class="ex-nm">${hsx?"\ud83c\udfe0 "+hsx.n:e.name}</div><div class="ex-tag ${e.cmp?"cmp":"iso"}">${hsx?"replaces "+e.name+" \u00b7 "+rx.load:e.tag}</div></div></div>
      <div class="chips">${hsx?`<span class="chip"><b>${rx.sets+fxDelta(e)}</b>×<b>${rx.reps}</b>${fxDelta(e)>0?' <span style="color:var(--go);font-weight:700">focus</span>':fxDelta(e)<0?' <span style="color:var(--text-3)">trim</span>':""}</span><span class="chip">tempo <b>${rx.tempo}</b></span><span class="chip">rest <b>${e.rest}</b></span><span class="chip rir">RIR <b>0</b> last set</span><span class="chip stretch">${rx.finisher}</span></div>`:`<span class="chip"><b>${fxSets(e)}</b>×<b>${e.reps}</b>${fxDelta(e)>0?' <span style="color:var(--go);font-weight:700">focus</span>':fxDelta(e)<0?' <span style="color:var(--text-3)">trim</span>':""}${bulkMode==="aggr"&&!isDeloadWeek()&&e===day.ex[0]&&e.cmp?' <span style="color:var(--gold);font-weight:700">+1</span>':""}</span><span class="chip">tempo <b>${e.tempo}</b></span><span class="chip">rest <b>${e.rest}</b></span><span class="chip rir">RIR <b>${e.rir}</b></span>${e.stretch?'<span class="chip stretch">stretch focus</span>':''}</div>`}`;
    if(LOC==="home"&&HOME_SUB[e.id]){const hs=HOME_SUB[e.id];html+=`<div style="margin:8px 0 2px;padding:8px 10px;border-left:3px solid var(--gold);background:rgba(255,197,61,.07);border-radius:0 8px 8px 0;font-size:13px;line-height:1.45"><b>Cue:</b> ${hs.h}</div>`;}
    if(lt)html+=`<div class="lastt" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span>Last time: <b>${lt.map(s=>s.r+"×"+s.w+"kg").join(", ")}</b> — beat it.</span><button class="btn" style="flex:none;background:var(--panel-3);color:var(--gold);border:1px solid rgba(255,197,61,.4);padding:6px 10px;font-size:12px" onclick="fillFromLast('${e.id}')">\u21ba Fill</button></div>`;
    html+=`<button class="hw-tog" data-tg="${e.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>How to do it &amp; why it works</button>
      <div class="hw-b" id="hw-${e.id}"><div class="blk"><div class="lbl how">How To Do It</div><p>${e.how}</p></div><div class="blk"><div class="lbl why">Why It Builds Muscle</div><p>${e.why}</p></div></div>`;
    const rows=Math.max(fxSets(e),logged.length,1);
    html+=`<div class="sets"><table class="set-grid"><thead><tr><th>Set</th><th>Reps</th><th>Kg</th><th>RPE</th><th>1RM</th><th>✓</th></tr></thead><tbody>`;
    for(let i=0;i<rows;i++){const st=logged[i]||{},filled=st.r&&st.w,v=e1rm(st.w,st.r);
      html+=`<tr class="set-row${filled?" done":""}"><td class="set-no">${i+1}</td><td><input class="cell${st.r?" filled":""}" type="number" inputmode="numeric" placeholder="${lt&&lt[i]&&lt[i].r?lt[i].r:"—"}" value="${st.r||""}" data-ex="${e.id}" data-i="${i}" data-f="r"></td><td><input class="cell${st.w?" filled":""}" type="number" inputmode="decimal" placeholder="${lt&&lt[i]&&lt[i].w?lt[i].w:"—"}" value="${st.w||""}" data-ex="${e.id}" data-i="${i}" data-f="w"></td><td><input class="cell${st.rpe?" filled":""}" type="number" inputmode="decimal" step="0.5" placeholder="—" value="${st.rpe||""}" data-ex="${e.id}" data-i="${i}" data-f="rpe"></td><td class="e1">${v?Math.round(v)+"kg":"—"}</td><td><button class="chk${filled?" on":""}" data-chk="${e.id}" data-i="${i}">${ICON.check}</button></td></tr>`;
    }
    html+=`</tbody></table><div class="set-act"><button class="mini" data-add="${e.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Add set</button><button class="mini" data-del="${e.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14" stroke-linecap="round"/></svg>Remove</button></div></div></div>`;
  });
  document.getElementById("liftBody").innerHTML=html;
  document.querySelectorAll("#liftBody .cell").forEach(inp=>{
    inp.addEventListener("input",()=>{const s=ensureLiftSession(curDay),ex=inp.dataset.ex,i=+inp.dataset.i,f=inp.dataset.f;s.entries[ex]=s.entries[ex]||[];s.entries[ex][i]=s.entries[ex][i]||{};s.entries[ex][i][f]=inp.value;DB.save();const row=inp.closest("tr"),st=s.entries[ex][i],v=e1rm(st.w,st.r);inp.classList.toggle("filled",!!inp.value);row.querySelector(".e1").textContent=v?Math.round(v)+"kg":"—";const chk=row.querySelector(".chk");if(st.r&&st.w){chk.classList.add("on");row.classList.add("done");}else{chk.classList.remove("on");row.classList.remove("done");}});
    inp.addEventListener("change",()=>{const ex=inp.dataset.ex,i=+inp.dataset.i,s=findLiftSession(curDay),st=s&&s.entries[ex]&&s.entries[ex][i];if(st&&st.r&&st.w){const v=e1rm(st.w,st.r);let prev=0;DB.sessions.forEach(ss=>{(ss.entries[ex]||[]).forEach((x,xi)=>{if(ss.id===s.id&&xi===i)return;const vv=e1rm(x&&x.w,x&&x.r);if(vv>prev)prev=vv;});});if(v>prev&&prev>0)toast("New PR on "+EXMAP[ex].name+"! ~"+Math.round(v)+"kg");}});
  });
  document.querySelectorAll("#liftBody .chk").forEach(b=>b.addEventListener("click",()=>{const ex=b.dataset.chk,i=+b.dataset.i,s=findLiftSession(curDay),st=s&&s.entries[ex]&&s.entries[ex][i];if(st&&st.r&&st.w){const exObj=GYM[curDay].ex.find(x=>x.id===ex);const sec=parseRest(exObj&&exObj.rest);startRest(sec);toast("Set done · resting "+fmtPace(sec),true);}else toast("Enter reps and weight first");}));
  document.querySelectorAll("#liftBody .tool-h").forEach(h=>h.addEventListener("click",()=>h.parentElement.classList.toggle("open")));
  const plW=document.getElementById("plW"),plBar=document.getElementById("plBar");
  if(plW){plW.addEventListener("input",drawPlates);plBar.addEventListener("input",drawPlates);}
  document.querySelectorAll("#liftBody .hw-tog").forEach(b=>b.addEventListener("click",()=>{document.getElementById("hw-"+b.dataset.tg).classList.toggle("open");b.classList.toggle("open");}));
  document.querySelectorAll("#liftBody [data-add]").forEach(b=>b.addEventListener("click",()=>{const s=ensureLiftSession(curDay);s.entries[b.dataset.add]=s.entries[b.dataset.add]||[];s.entries[b.dataset.add].push({});DB.save();renderLiftDay();}));
  document.querySelectorAll("#liftBody [data-del]").forEach(b=>b.addEventListener("click",()=>{const s=findLiftSession(curDay);if(s&&s.entries[b.dataset.del]&&s.entries[b.dataset.del].length>1){s.entries[b.dataset.del].pop();DB.save();renderLiftDay();}}));
}
function drawPlates(){
  const target=parseFloat(document.getElementById("plW").value),bar=parseFloat(document.getElementById("plBar").value)||20,out=document.getElementById("plateOut");
  if(!out)return;
  let vis="";
  if(!target){out.innerHTML='<div class="plate-txt" style="color:var(--text-3)">Enter a working weight to see what to load per side, plus your warm-up sets.</div>';return;}
  if(target<bar){vis=`<div class="plate-txt" style="color:var(--danger)">That's below the bar weight (${bar} kg).</div>`;}
  else{
    const r=computePlates(target,bar),COL={25:"#E0443E",20:"#3F7BE0",15:"#E0A012",10:"#2c9c4d",5:"#cfd6e4","2.5":"#9aa3b5","1.25":"#7a8294"},SZ={25:54,20:50,15:46,10:40,5:34,"2.5":28,"1.25":24};
    let plates='<div class="bar-stub"></div>';
    r.perSide.forEach(pp=>{for(let i=0;i<pp.n;i++){plates+=`<div class="plate" style="background:${COL[pp.p]};height:${SZ[pp.p]}px;width:${pp.p>=10?15:11}px"></div>`;}});
    const txt=r.perSide.map(pp=>pp.n+"\u00d7"+pp.p+"kg").join("  \u00b7  ");
    vis=`<div class="plate-vis">${plates}</div><div class="plate-txt">Per side: <b>${txt||"empty bar"}</b>${r.leftover>0?`<br><span style="color:var(--warn)">${r.leftover} kg/side can't be matched with standard plates</span>`:""}</div>`;
  }
  const wu=warmupSets(target);let wuh="";
  if(wu.length){wuh='<div class="wu-sets"><div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-3);font-weight:700;margin-bottom:7px">Suggested warm-up sets</div>'+wu.map(s=>`<div class="wu-set"><span class="wu-p">${s.pct}%</span><span class="wu-w">${s.weight} kg</span><span class="wu-r">\u00d7 ${s.reps}</span></div>`).join("")+'</div>';}
  out.innerHTML=vis+wuh;
}
/* ===== RUN ===== */
function renderRun(){
  const el=document.getElementById("view-run"),wk=planWeek(),pc=paces();
  el.innerHTML=`<div class="eyebrow cyan">Optional · Not Scheduled</div><h2 class="view-title">Events & Cardio</h2>
    <p class="view-sub">Nothing here is scheduled. Running is retired; the mission is muscle. This tab holds the optional-cardio rules and a 12-month calendar of races within ~25 km — reference only, in case a walk or a jog ever appeals.</p>
    ${raceCalendarHTML()}
    <div class="card"><div class="card-t cyan"><span class="ic">${ICON.run}</span>If You Want Some — the minimum that helps</div><div class="prose" style="margin-top:6px">
      <p>• <b>Dose:</b> up to 2 × 20–30 min easy Zone-2 (walk, easy jog, bike) — conversational pace, nothing more.</p>
      <p>• <b>Placement:</b> never the day before or after a Legs day; upper-day mornings or the Friday rest slot fit best.</p>
      <p>• <b>Zero is fine.</b> Daily steps + the Extras pump already cover health during a focused bulk. Appetite and work capacity are the only reasons to add any.</p></div></div>
    <div class="tool" id="toolParked" style="display:none"><div class="tool-h" onclick="this.parentElement.classList.toggle('open')"><span class="ic">${ICON.run}</span><h4>🅿️ Parked — the Absa 10K plan (24 Sep)</h4><span class="chev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><div class="tool-b"><p class="view-sub" style="margin:4px 0 10px">Kept intact, unscheduled. Say the word and this whole plan wakes back up.</p>
    <div class="card"><div class="card-t cyan"><span class="ic">${ICON.run}</span>Your Training Paces</div>
      <div class="card-st">${(()=>{const pc=paces();return pc.src?`Auto-calibrated \u2713 from your logged ${pc.src.dist} km in ${pc.src.time} (${fmtDM(pc.src.date)}) \u2014 re-calibrates with every run you log.`:`From your goal 10K time (set it in Numbers) \u2014 log any run and these auto-calibrate.`})()} Joburg is at altitude (~1,750 m) — add ~15-20 sec/km vs sea level and don't panic on hard days.</div>
      <div class="pace-grid">
        <div class="pace"><div class="pn">Easy / Recovery<small>most of your running</small></div><div class="pp">${fmtPace(pc.easy)}</div></div>
        <div class="pace"><div class="pn">Long Run<small>build endurance</small></div><div class="pp">${fmtPace(pc.long)}</div></div>
        <div class="pace"><div class="pn">Tempo<small>comfortably hard</small></div><div class="pp">${fmtPace(pc.tempo)}</div></div>
        <div class="pace race"><div class="pn">Race Pace<small>10K goal effort</small></div><div class="pp">${fmtPace(pc.race)}</div></div>
        <div class="pace"><div class="pn">Intervals<small>5K effort</small></div><div class="pp">${fmtPace(pc.interval)}</div></div>
        <div class="pace"><div class="pn">Strides<small>short &amp; fast</small></div><div class="pp">${fmtPace(pc.strides)}</div></div>
      </div>
      <div class="calc-note" style="margin-top:12px">Paces are per kilometre. Tempo = you can say a few words but not chat. Easy = full conversation. When in doubt, go slower on easy days — that's where most runners go wrong.</div>
    </div>
    <div class="note cyan"><b>Weekend races bolted on ↓</b> Real Gauteng races (Saturdays & Sundays), closest to Joburg first, are pinned to each week below. Sunday races ARE the Sunday long-run slot — slot them straight in. Saturday races land on Push day: race the short distance in the morning, then still get the Push session in (later that day, or swap it with Friday's rest) — and keep Sunday's long run honest. The <b>Absa Tshwane 10 K on 23 Aug</b> is your key dress rehearsal (same series as race day). On weekends with no nearby race, do your nearest <b>parkrun</b> (free, every Saturday 08:00). Dates from RaceSpace — always confirm and enter on racespace.co.za or Entry Ninja, as far-out dates can shift.</div>
    <div class="eyebrow cyan" style="margin-top:6px">The 9 Weeks</div><div id="runWeeks"></div>
    <div class="card" style="margin-top:6px"><div class="card-t cyan"><span class="ic">${ICON.check}</span>Log a Run</div>
      <div class="card-st">Record every run to watch your pace, mileage and longest run climb in Track.</div>
      <div class="quick"><div class="field"><label>Date</label><input type="date" id="rgDate"></div><div class="field"><label>Type</label><select id="rgType"><option>Easy</option><option>Long</option><option>Tempo</option><option>Intervals</option><option>Race</option></select></div><div class="field"><label>Distance (km)</label><input type="number" inputmode="decimal" id="rgDist" placeholder="8"></div><div class="field"><label>Time (mm:ss)</label><input type="text" inputmode="numeric" id="rgTime" placeholder="48:00"></div></div>
      <button class="btn btn-cyan" id="rgAdd">${ICON.run}Log This Run</button>
    </div></div></div>`;
  const wrap=document.getElementById("runWeeks");
  wrap.innerHTML=RUN_PLAN.map(w=>{const isCur=w.wk===wk;return `<div class="rweek${isCur?" cur open":""}"><div class="rweek-h" data-wk="${w.wk}"><div class="rwh-l"><div class="rwh-num">WK ${w.wk}</div><div class="rwh-meta"><h4>${w.phase}${isCur?' · this week':''}</h4><p>${weekRangeLabel(w.wk)} · longest: ${w.long}</p></div></div><div class="rwh-r">${w.total}</div><span class="rwh-chev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><div class="rweek-b">${w.runs.map(r=>`<div class="runrow"><div class="rr-day">${r.d} ${fmtDM(dateForWeekDay(w.wk,r.d))}</div><div class="rr-tag ${r.t}"></div><div class="rr-body"><div class="rr-t">${r.title}</div><div class="rr-d">${r.det}</div></div></div>`).join("")}${raceCallout(w.wk)}</div></div>`;}).join("");
  wrap.querySelectorAll(".rweek-h").forEach(h=>h.addEventListener("click",()=>h.parentElement.classList.toggle("open")));
  const di=document.getElementById("rgDate");if(di&&!di.value)di.value=todayISO();
  document.getElementById("rgAdd").addEventListener("click",()=>{const date=document.getElementById("rgDate").value||todayISO(),type=document.getElementById("rgType").value,dist=parseFloat(document.getElementById("rgDist").value),time=parseTime(document.getElementById("rgTime").value);if(!dist||!time){toast("Enter distance and time");return;}DB.runs.push({date,type,dist,time});DB.save();document.getElementById("rgDist").value="";document.getElementById("rgTime").value="";toast("Run logged · "+fmtPace(time/dist)+"/km",true);});
}
/* ===== NUMBERS ===== */
let curPhase=DB.profile.phase==="hyper"?"hyper":"build";
function renderNumbers(){
  const el=document.getElementById("view-numbers"),p=DB.profile;
  el.innerHTML=`<h2 class="view-title">Your Numbers</h2>
    <p class="view-sub">Live calculators built from your profile. Set your details once and your food, your natural ceiling, your race paces and your predicted times all update instantly.</p>
    <div class="card"><div class="card-t"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg></span>Profile</div><div class="card-st">The foundation for everything. Adjust anytime.</div>
      <div class="input-grid"><div class="field"><label>Weight (kg)</label><input type="number" inputmode="decimal" id="pWeight"></div><div class="field"><label>Height (cm)</label><input type="number" inputmode="decimal" id="pHeight"></div><div class="field"><label>Age</label><input type="number" inputmode="numeric" id="pAge"></div><div class="field"><label>Body Fat (%)</label><input type="number" inputmode="decimal" id="pBf"></div><div class="field"><label>Goal Weight (kg)</label><input type="number" inputmode="decimal" id="pGoal"></div><div class="field"><label>Goal BF %</label><input type="number" inputmode="decimal" id="pGoalBf"></div><div class="field" style="grid-column:1/-1"><button class="btn" style="width:100%;background:var(--panel-3);color:var(--gold);border:1px solid rgba(255,197,61,.45)" onclick="setGoalFromFFMI()">Set goal weight from FFMI 25.0</button><div style="font-size:12px;color:var(--text-3);margin-top:6px">FFMI 25.0 is the natural ceiling. At your goal body fat that is exactly one scale weight — this button writes it.</div>${tapeBFHTML()}</div><div class="field"><label>Goal 10K (mm:ss)</label><input type="text" inputmode="numeric" id="pGoal10k" placeholder="55:00"></div><div class="field full"><label>Activity (outside training)</label><select id="pAct"><option value="1.2">Desk job</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option><option value="1.9">Extremely active</option></select></div></div>
      <button class="btn btn-gold" id="saveProfile">${ICON.check}Save &amp; Recompute</button>
    </div>
    <div class="card"><div class="card-t"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 017 7c0 3-2 4-2 7a5 5 0 01-10 0c0-3-2-4-2-7a7 7 0 017-7z" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Calories &amp; Macros</div><div class="card-st">Eat to maximise lean muscle gain — protein high, calories in a controlled surplus.</div>
      <div class="seg" id="phaseSeg"><button data-ph="build"${curPhase==="build"?" class=on":""}>Race Block</button><button data-ph="hyper"${curPhase==="hyper"?" class=on":""}>Post-Race</button><button data-ph="race"${curPhase==="race"?" class=on":""}>Race Week</button></div>
      <div class="readout"><div class="macro-row"><div class="macro"><div class="mv cal" id="rCal">—</div><div class="ml">kcal/day</div><div class="mg" id="rCalN">—</div></div><div class="macro"><div class="mv pro" id="rPro">—</div><div class="ml">Protein</div><div class="mg">2.0 g/kg</div></div><div class="macro"><div class="mv carb" id="rCarb">—</div><div class="ml">Carbs</div><div class="mg" id="rCarbN">fuel</div></div><div class="macro"><div class="mv fat" id="rFat">—</div><div class="ml">Fat</div><div class="mg">~0.9 g/kg</div></div></div><div class="calc-note" id="calNote"></div></div>
    </div>
    <div class="card"><div class="card-t" style="color:var(--go)"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 3h4v4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Maximum Lean Gain Engine</div>
      <div class="card-st">You want maximum gain, aggressively, with minimal fat. That's a real, reachable target — but muscle has a speed limit. This sets the <b>fastest rate that's still almost all muscle</b>, and (once you log your waist) checks that it's staying lean. Eat beyond it and the extra is just fat.</div>
      <div class="seg" id="bulkSeg"><button data-bm="lean"${bulkMode==="lean"?" class=on":""}>Lean</button><button data-bm="balanced"${bulkMode==="balanced"?" class=on":""}>Balanced</button><button data-bm="max"${bulkMode==="max"?" class=on":""}>Maximum</button><button data-bm="aggr"${bulkMode==="aggr"?" class=on":""}>Aggressive</button><button data-bm="cut"${bulkMode==="cut"?" class=on":""}>Cut</button></div>
      <div id="gainOut"></div>
    </div>
    <div class="card"><div class="card-t"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 12l5-3" stroke-linecap="round"/></svg></span>Natural Ceiling Gauge</div><div class="card-st">Where you are, your drug-free limit (shown at 18% — the defined edge of your 18–24% ideal band), and where your goal actually sits. Explore other levels below.</div>
      <div id="gaugeWrap"></div><div class="gauge-legend"><div class="gl"><span class="dot" style="background:var(--go)"></span>Natural</div><div class="gl"><span class="dot" style="background:var(--violet)"></span>Assisted-only</div><div class="gl"><span class="dot" style="background:var(--text)"></span>You</div><div class="gl"><span class="dot" style="background:var(--gold)"></span>Goal</div></div><div id="verdict"></div>
      <div class="calc-note" style="margin-top:14px"><b>Highest natural weight — pick a body-fat level:</b></div>
      <div class="seg" id="ceilBfSeg" style="margin-top:8px">${[10,12,15,18,20,24].map(b=>`<button data-bf="${b}">${b}%</button>`).join("")}</div>
      <div id="ceilOut"></div>
    </div>
    <div class="card"><div class="card-t cyan"><span class="ic">${ICON.run}</span>Race Time Predictor</div><div class="card-st">Enter a recent run or time-trial and see predicted times across distances (Riegel formula).</div>
      <div class="input-grid"><div class="field"><label>Recent Distance (km)</label><input type="number" inputmode="decimal" id="predDist" placeholder="5"></div><div class="field"><label>Time (mm:ss)</label><input type="text" inputmode="numeric" id="predTime" placeholder="26:30"></div><div class="field" style="display:flex;align-items:flex-end"><button class="btn btn-cyan" id="predBtn" style="padding:11px">Predict</button></div></div>
      <div id="predOut"></div>
    </div>`;
  document.getElementById("pWeight").value=p.weight;document.getElementById("pHeight").value=p.height;document.getElementById("pAge").value=p.age;document.getElementById("pBf").value=p.bf;document.getElementById("pGoal").value=p.goal;document.getElementById("pGoalBf").value=p.goalBf||24;document.getElementById("pGoal10k").value=p.goal10k;document.getElementById("pAct").value=p.act;
  document.getElementById("saveProfile").addEventListener("click",()=>{const g=id=>document.getElementById(id).value;p.weight=parseFloat(g("pWeight"))||88;p.height=parseFloat(g("pHeight"))||177;p.age=parseFloat(g("pAge"))||38;p.bf=parseFloat(g("pBf"))||18;p.goal=parseFloat(g("pGoal"))||102;p.goalBf=parseFloat(g("pGoalBf"))||24;p.goal10k=g("pGoal10k")||"55:00";p.act=g("pAct");DB.save();renderNumbers();updateHeader();toast("Saved — everything updated");});
  document.querySelectorAll("#phaseSeg button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#phaseSeg button").forEach(x=>x.classList.remove("on"));b.classList.add("on");curPhase=b.dataset.ph;renderMacros();renderGainCard();}));
  document.querySelectorAll("#bulkSeg button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#bulkSeg button").forEach(x=>x.classList.remove("on"));b.classList.add("on");setBulkMode(b.dataset.bm);renderMacros();renderGainCard();}));
  document.querySelectorAll("#ceilBfSeg button").forEach(b=>b.addEventListener("click",()=>{ceilBf=+b.dataset.bf;persist("cb2_ceilbf",ceilBf);renderCeilCurve();}));
  document.getElementById("predBtn").addEventListener("click",()=>{const r=predict(document.getElementById("predDist").value,document.getElementById("predTime").value),out=document.getElementById("predOut");if(!r){out.innerHTML='<div class="note red" style="margin-top:8px">Enter a valid distance and time.</div>';return;}out.innerHTML=`<div class="pace-grid" style="margin-top:14px"><div class="pace"><div class="pn">5 km</div><div class="pp">${fmtClock(r.p5)}</div></div><div class="pace race"><div class="pn">10 km<small>race day</small></div><div class="pp">${fmtClock(r.p10)}</div></div><div class="pace"><div class="pn">15 km</div><div class="pp">${fmtClock(r.p15)}</div></div></div><div class="calc-note" style="margin-top:10px">These assume you're trained for the distance. Your long run peaks at 12 km in Week 7 — comfortably past race distance — which is what pulls your 10 km time down over the 9 weeks. Add a little for Joburg's altitude.</div>`;});
  renderMacros();renderGainCard();renderGauge();renderCeilCurve();const _br=bestRun();if(_br){const d=document.getElementById("predDist"),t=document.getElementById("predTime");if(d&&!d.value)d.value=_br.dist;if(t&&!t.value)t.value=_br.time;}
}
function renderGainCard(){
  const out=document.getElementById("gainOut");if(!out)return;
  const phase=(curPhase==="build"||curPhase==="hyper")?curPhase:"build";
  const g=gainModel(phase),m=macros(phase),act=actualGainRate();
  if(curPhase==="race"){out.innerHTML='<div class="calc-note" style="margin-top:12px">Race week is a maintain-and-taper week — no gaining. Switch to Race Block or Post-Race to plan your bulk.</div>';return;}
  const cal=m.cal;
  let actHtml="";
  if(act){
    const diff=act.kgWk-g.rateKgWk,fast=diff>0.15,slow=diff< -0.15;
    const cls=fast?"warn":slow?"warn":"ok";
    const verdict=fast
      ?`<b>You're gaining faster than target</b> (${act.kgWk>0?"+":""}${act.kgWk.toFixed(2)} kg/wk vs ${g.rateKgWk.toFixed(2)} target). Some of that is fat. Trim ~200-300 kcal, or accept you'll need a longer cut later.`
      :slow?(act.kgWk<0?`<b>You're losing weight, not gaining.</b> To build muscle you must eat more — add ~300-400 kcal/day and re-check in two weeks.`:`<b>You're gaining slower than you could</b> (${act.kgWk>0?"+":""}${act.kgWk.toFixed(2)} kg/wk vs ${g.rateKgWk.toFixed(2)} target). Add ~200-300 kcal/day to hit maximum muscle gain.`)
      :`<b>Bang on target</b> (${act.kgWk>0?"+":""}${act.kgWk.toFixed(2)} kg/wk). This is about as fast as you can gain while staying lean — keep going.`;
    actHtml=`<div class="verdict ${cls}" style="margin-top:12px">Your actual trend over the last ${act.days} days: ${verdict}</div>`;
  } else {
    actHtml=`<div class="calc-note" style="margin-top:12px">Log your weight a few times in Track and this will compare your <b>actual</b> rate of gain to the target — telling you if you're building muscle or just adding fat.</div>`;
  }
  // Lean-gain check: waist vs weight — proves the aggressive bulk is staying lean
  const wr=actualWaistRate();let leanHtml="";
  if(act&&wr&&act.kgWk>0.05){
    const ratio=wr.cmWk/act.kgWk;let lc,lm;
    if(wr.cmWk<=0.05){lc="ok";lm=`<b>Textbook lean gain.</b> Weight climbing, waist holding steady — that's muscle, not fat. Exactly the goal. Keep pushing aggressively.`;}
    else if(ratio<=0.35){lc="ok";lm=`<b>Lean and aggressive — nailing it.</b> Waist up only ${wr.cmWk.toFixed(2)} cm/wk against ${act.kgWk.toFixed(2)} kg/wk gained. Mostly muscle. Stay the course.`;}
    else if(ratio<=0.7){lc="warn";lm=`<b>Some fat is creeping in.</b> Waist (${wr.cmWk>0?"+":""}${wr.cmWk.toFixed(2)} cm/wk) is rising a touch fast for the weight you're adding. Hold calories here — don't push higher yet.`;}
    else{lc="warn";lm=`<b>Too much of this is fat.</b> Waist is climbing fast relative to weight. Trim ~250 kcal and keep protein high — you'll still gain, just leaner.`;}
    leanHtml=`<div class="verdict ${lc}" style="margin-top:10px">Lean-gain check — waist vs weight: ${lm}</div>`;
  } else if(act&&act.kgWk>0.05&&!wr){
    leanHtml=`<div class="calc-note" style="margin-top:10px"><b>Prove it's lean:</b> log your <b>waist</b> in Track → Measures. The engine will then watch waist against weight and tell you whether your aggressive bulk is staying lean or tipping into fat — the key to minimal fat gain.</div>`;
  }
  out.innerHTML=`
    <div class="dose-grid" style="margin-top:12px">
      <div class="dose"><div class="dn">Target rate</div><div class="dv">+${g.rateKgWk.toFixed(2)}<small>kg / week</small></div></div>
      <div class="dose"><div class="dn">Per month</div><div class="dv">+${g.rateKgMo.toFixed(1)}<small>kg / month</small></div></div>
      <div class="dose"><div class="dn">Eat daily</div><div class="dv">${cal}<small>+${g.surplus} surplus</small></div></div>
    </div>
    <div class="calc-note" style="margin-top:10px">${g.mode==="cut"?"<b>Cut:</b> a controlled deficit of ~0.5 kg a week, protein up to 2.4 g/kg, training volume unchanged \u2014 fat comes off, muscle stays. Use it when the Weekly Review says the lean target is banked, or after the March check; 4\u20136 weeks, then back to building.":g.mode==="aggr"?(aggrLive()?"<b>Aggressive (to the 5–7 March check):</b> the top of the dial that still respects your 18–24% band — 0.48% of bodyweight a week, filling the band\u2019s fat allowance by the checkpoint while muscle memory does the heavy lifting, then Mini-Cut I and a step down to Maximum. Waist brake: +5 cm from baseline, the band itself. Protein 2.2 g/kg.":"<b>Aggressive — stepped down:</b> the muscle-memory window has closed, so the surplus now runs at the Maximum rate automatically. The tighter +2 cm waist brake and 2.2 g/kg protein stay."):g.mode==="max"?"<b>Maximum (aggressive + lean):</b> the fastest rate that's still almost all muscle — as aggressive as you can go while keeping fat gain minimal. The muscle-memory window makes this achievable right now. Eat more than this and the extra is just fat.":g.mode==="balanced"?"<b>Balanced:</b> slightly slower and leaner — even less fat to cut later.":"<b>Lean:</b> the slowest, leanest gain — minimal fat, slower scale movement."} Aim for <b>+${g.rateKgWk.toFixed(2)} kg a week</b>. Weigh in 3× a week and judge by the <b>weekly average</b>, not daily numbers.</div>
    ${actHtml}${leanHtml}`;
}
function renderMacros(){
  const m=macros(curPhase),perMeal=Math.round(m.pro/5);
  document.getElementById("rCal").textContent=m.cal;document.getElementById("rCalN").textContent=m.surplus>0?("+"+m.surplus+" / "+m.tdee):"maintenance";document.getElementById("rPro").textContent=m.pro+"g";document.getElementById("rCarb").textContent=m.carb+"g";document.getElementById("rCarbN").textContent="~"+(m.carb/DB.profile.weight).toFixed(1)+" g/kg";document.getElementById("rFat").textContent=m.fat+"g";
  let n="";
  if(curPhase==="build")n=`<b>Maximum lean gain:</b> the surplus is set to the fastest rate you can build muscle (see the Maximum Lean Gain engine below). You're only running twice a week, so the calories go into growth, not fuelling runs. Carbs stay high to power four hard lifting days. Protein at <b>${perMeal}g</b> × 5 meals. The scale should climb — check the engine to confirm it's muscle, not fat.`;
  else if(curPhase==="hyper")n=`<b>Post-race growth:</b> running drops away, so push a bigger surplus for maximum muscle. Protein <b>${m.pro}g</b> (~${perMeal}g × 5). Mini-cut if body fat drifts past ~20% \u2014 that keeps you inside your 18\u201324% band with definition intact.`;
  else n=`<b>Race week:</b> near maintenance with carbs high to top up fuel stores. Don't try to lose or gain now — arrive fresh, fuelled and hydrated.`;
  n+=` <span style="color:var(--text-3)">Calibrate to your real weight trend in Track.</span>`;
  document.getElementById("calNote").innerHTML=n;
}
let ceilBf=load("cb2_ceilbf",18);
let LOC=load("cb2_loc","gym");
let focusOn=false,focusIdx=0;
let focusLB=load("cb2_focuslb",true);
const REGION={quads:["ga1","ga3","ga4","ga5","gb2","gb5"],hamstrings:["ga2","ga6","gb1","gb4","gb8","ga8"],glutes:["ga1","ga3","ga4","gb1","gb2","gb3","ga8","ga2"],calves:["ga7","gb6","x5","gb9","la9","lb9"],"lower back":["ga8","gb1","ga2"],"mid back":["la1","la3","la4","lb1","lb2","lb4","ua2","ua4","lb3","la2"],"upper back":["la2","la5","la8","lb5","lb8","x1"]};
const FX_TARGET=new Set([].concat(...Object.values(REGION)));const FX_TRIM=new Set(["pa5","pa6","pa7","pb5","pb6","la6","la7","lb6","lb7","ua5","ua6","ua7","x2","x3","x4"]);
function fxDelta(e){if(!focusLB)return 0;if(FX_TARGET.has(e.id))return 1;if(FX_TRIM.has(e.id))return -1;return 0;}
function fxSets(e){return Math.max(2,(e.sets||3)+fxDelta(e));}
function regionSets(){const out={};Object.keys(REGION).forEach(r=>out[r]=0);GYM_ORDER.forEach(k=>{const d=GYM[k];if(!d)return;d.ex.forEach(e=>{Object.entries(REGION).forEach(([r,ids])=>{if(ids.includes(e.id))out[r]+=fxSets(e);});});});return out;}
function homeRx(e,hs){const n=hs.n;const isCalf=/Calf/i.test(n),isNordic=/Nordic/i.test(n),isIso=/Curl|Raise|Fly|Extension|Y-T-W|Y-Raise|Pullover|Kickback|21s|Shrug|Rollout|Dead-Bug|Crunch/i.test(n);
  let load="your kit";const hasBag=/bag/i.test(n),has15=/15 kg|2\u00d715/.test(n),has5=/5 kg|2\u00d75/.test(n)&&!/15 kg|2\u00d715/.test(n);
  if(hasBag&&has15)load="20 kg bag + 15 kg DBs";else if(hasBag)load="20 kg bag";else if(has15)load="2\u00d715 kg DBs";else if(has5)load="2\u00d75 kg DBs";else if(/Push-Up|Nordic|Rollout|Dead-Bug|Split Squat|Sissy|Bridge/i.test(n))load="bodyweight";
  if(/Med-Ball|ball/i.test(n))load=load==="your kit"?"medicine ball":load+" + med ball";
  if(isCalf)return {sets:3,reps:"15\u201325",load,tempo:"3 s down",finisher:"2 s pause at the stretch"};
  if(isNordic)return {sets:3,reps:"5\u20138",load,tempo:"5 s lowering",finisher:"hands catch, push back"};
  if(isIso)return {sets:3,reps:"12\u201320",load,tempo:"3 s down",finisher:"myo-reps to finish"};
  return {sets:4,reps:"10\u201320",load,tempo:"3\u20134 s down",finisher:"rest-pause on the last set"};}
let fuelQ=load("cb2_fuelq","premium");
function renderCeilCurve(){
  const out=document.getElementById("ceilOut");if(!out)return;
  const c=compute();
  const maxAt=bf=>c.ceilLean/(1-bf/100);
  const room=Math.max(0,c.ceilLean-c.leanNow);
  const bf110=Math.round((1-c.ceilLean/110)*100);
  document.querySelectorAll("#ceilBfSeg button").forEach(b=>b.classList.toggle("on",+b.dataset.bf===ceilBf));
  out.innerHTML=`
    <div class="dose-grid" style="margin-top:10px">
      <div class="dose"><div class="dn">Max natural @ ${ceilBf}%${ceilBf>=18&&ceilBf<=24?" \u00b7 in your band \u2713":ceilBf<18?" \u00b7 leaner than your band":""}</div><div class="dv">\u2248${maxAt(ceilBf).toFixed(1)}<small>kg scale weight</small></div></div>
      <div class="dose"><div class="dn">Muscle underneath</div><div class="dv">\u2248${Math.round(c.ceilLean)}<small>kg lean \u2014 same every tier</small></div></div>
      <div class="dose"><div class="dn">Your lean room</div><div class="dv">+${room.toFixed(1)}<small>kg muscle to ceiling</small></div></div>
    </div>
    <div class="calc-note" style="margin-top:10px"><b>Read it straight:</b> the muscle ceiling (\u2248${Math.round(c.ceilLean)} kg lean) is fixed \u2014 body fat is the only dial that lifts scale weight above it. Your ideal band is <b>18\u201324%</b> \u2014 in kilos, a natural max of \u2248${maxAt(18).toFixed(1)}\u2013${maxAt(24).toFixed(1)} kg. Heads-up on your own fine print: \u201csome abdominal definition\u201d realistically lives at the 18\u201320% end \u2014 by 24% it\u2019s gone for most men. The old dream number: <b>a natural 110 kg means ~${bf110}% body fat</b>. FFMI-25 is a statistical drug-free ceiling \u2014 individual frames vary a little either side, and it doesn\u2019t change by ethnicity.</div>`;
}
function renderGauge(){
  const c=compute(),p=DB.profile,W=680,H=150,padL=20,padR=20,trackY=64,trackH=26,lo=18,hi=32;
  const x=v=>padL+((clamp(v,lo,hi)-lo)/(hi-lo))*(W-padL-padR),xCeil=x(25),xYou=x(clamp(c.ffmiNorm,lo,hi)),xGoal=x(clamp(c.goalFFMInorm,lo,hi));
  let ticks="";for(let v=18;v<=32;v+=2){const xx=x(v);ticks+=`<line x1="${xx}" y1="${trackY+trackH+6}" x2="${xx}" y2="${trackY+trackH+11}" stroke="var(--text-3)"/><text x="${xx}" y="${trackY+trackH+24}" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">${v}</text>`;}
  function mk(xx,color,label,sub,up){const ty=up?trackY-30:trackY+trackH+54;return `<line x1="${xx}" y1="${up?trackY-6:trackY+trackH+6}" x2="${xx}" y2="${up?trackY+trackH:trackY}" stroke="${color}" stroke-width="2.5"/><circle cx="${xx}" cy="${up?trackY-6:trackY+trackH+6}" r="4" fill="${color}"/><text x="${clamp(xx,42,W-42)}" y="${ty}" text-anchor="middle" font-size="12" font-weight="700" fill="${color}" font-family="var(--f-body)">${label}</text><text x="${clamp(xx,42,W-42)}" y="${ty+15}" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">${sub}</text>`;}
  document.getElementById("gaugeWrap").innerHTML=`<svg class="gauge-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="ng" x1="0" x2="1"><stop offset="0" stop-color="#2c7a4d"/><stop offset="1" stop-color="var(--go)"/></linearGradient><linearGradient id="ag" x1="0" x2="1"><stop offset="0" stop-color="var(--violet)"/><stop offset="1" stop-color="#7c6ae0"/></linearGradient></defs><rect x="${padL}" y="${trackY}" width="${xCeil-padL}" height="${trackH}" rx="6" fill="url(#ng)" opacity="0.85"/><rect x="${xCeil}" y="${trackY}" width="${W-padR-xCeil}" height="${trackH}" rx="6" fill="url(#ag)" opacity="0.7"/><line x1="${xCeil}" y1="${trackY-6}" x2="${xCeil}" y2="${trackY+trackH+6}" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/>${ticks}${mk(xYou,"var(--text)","YOU","FFMI "+c.ffmiNorm.toFixed(1),true)}${mk(xGoal,"var(--gold)",p.goal+"kg @ "+(p.goalBf||24)+"%","FFMI "+c.goalFFMInorm.toFixed(1),false)}<text x="${(padL+xCeil)/2}" y="${trackY+trackH/2+4}" text-anchor="middle" font-size="11" font-weight="700" fill="#06231a" font-family="var(--f-body)">NATURAL</text><text x="${(xCeil+W-padR)/2}" y="${trackY+trackH/2+4}" text-anchor="middle" font-size="11" font-weight="700" fill="#1a1330" font-family="var(--f-body)">ASSISTED ONLY</text></svg>`;
  const ceilBW=Math.round(c.ceilBW);
  document.getElementById("verdict").innerHTML=(()=>{const gbf=p.goalBf||24,x=c.goalFFMInorm,ceil24=Math.round(c.ceilLean/0.76);
    if(x>25.2)return `<div class="verdict warn"><b>${p.goal} kg @ ${gbf}% needs FFMI ${x.toFixed(1)} — assisted-only territory.</b> At ${p.height} cm your drug-free ceiling is ~${c.ceilLean.toFixed(0)} kg of lean mass — <b>${ceilBW} kg at your 18% reference</b>, up to ~${ceil24} kg at 24%. You're at FFMI ${c.ffmiNorm.toFixed(1)} now, with ${(25-c.ffmiNorm).toFixed(1)} points of natural room left.</div>`;
    return `<div class="verdict ok"><b>${p.goal} kg @ ${gbf}% sits on the natural map</b> (FFMI ${x.toFixed(1)} vs ceiling 25)${x>=24.6?" — <b>right at the ceiling</b>: the hardest natural target there is. Expect years, and the last kilos to crawl.":" — within natural reach."} The real bar is the muscle: ~${c.ceilLean.toFixed(0)} kg lean, worn at whatever body fat you choose — 95 @ 18% and 102 @ 24% are the same physique underneath. You're at FFMI ${c.ffmiNorm.toFixed(1)}, ${Math.max(0,25-c.ffmiNorm).toFixed(1)} points of room to climb.</div>`;})();
}
/* ============================================================
   FUEL — supplements, doses, SA prices, mixing & bedrock meals
   (bolted on from the evidence-dossier guide, rescaled to ~85-86kg)
   ============================================================ */
const SUPP_TIERS=[
  {tier:"Tier 1 — Proven. Actually worth your money.",cls:"t1",items:[
    {n:"Creatine Monohydrate",hi:{d:"Load 20 g/day (4 \u00d7 5 g) for 7 days, then 0.1 g/kg = ~9 g/day",note:"Above 5 g/day maintenance the extra is mostly wasted once saturated; 0.1 g/kg is the ceiling worth paying for. Safe for healthy kidneys with 3\u20134 L of water a day."},prem:{pick:"Myprotein Creapure Creatine Mono 250 g \u2014 Informed Choice certified",price:"R199.95 at Dis-Chem (verified Sep 2026; online stock varies, check in store)",m:60,why:"Creapure is the German-made monohydrate with the tightest purity spec, and the certification means every batch is screened for banned substances \u2014 the tub you want if you ever stand on a drug-tested powerlifting platform. It builds exactly as much muscle as generic creatine."},tag:"The one non-negotiable",ev:"Strongest evidence of any sports supplement",how:"<b>Fast track: load 20 g/day for 5\u20137 days (4 \u00d7 5 g with meals), then 5 g/day for good.</b> Loading saturates the muscle in a week instead of a month and adds ~1\u20132 kg of water <i>inside</i> the muscle \u2014 lean mass on any scale or DEXA, kept for as long as you keep taking it. Then: <b>5 g every single day</b>, any time, with anything — timing barely matters, consistency does. Skip loading; just take 5 g daily and your muscles saturate in ~3 weeks. Unflavoured powder in water, juice or your shake.",why:"Refills the fast-energy system (ATP) so you get an extra rep or two and recover faster between sets — over months that's real, measurable muscle and strength. Also draws water into the muscle for fuller-looking size. Helps a little for repeated hard efforts on the bike/track too."},
    {n:"Whey Protein Powder",hi:{d:"Enough to reach 2.4 g/kg total protein (~211 g/day) \u2014 typically 2 scoops",note:"More protein than 2.4 g/kg builds no more muscle; it just displaces the carbs the surplus needs. Whey has no dose of its own \u2014 it fills the gap to the target."},prem:{pick:"A whey carrying the Informed Choice / Informed Sport mark \u2014 Biogen\u2019s certified lines at Dis-Chem, or USN Blue Lab 100% Whey 900 g",price:"USN Blue Lab R689.99 \u00b7 Biogen Blended Protein 875 g R413.99 (Dis-Chem, Sep 2026)",m:450,why:"Certification buys purity, not growth. Isolate over concentrate only if lactose troubles you. Whatever the tub, it only fills the gap to your daily protein target."},tag:"Convenience, not magic",ev:"Hitting your daily protein is what matters — powder is just an easy way to do it",how:"Use only to <b>fill the gap</b> between what you eat and your daily target (~170 g for you). A 30 g scoop = ~24 g protein. One shake post-workout or between meals usually closes it. Whole-food protein works just as well — this is for convenience.",why:"Muscle is built from protein and the training stimulus. If your food already gets you to target, you don't strictly need powder — but most people find one shake a day makes the target painless."},
    {n:"Caffeine",hi:{d:"5\u20136 mg/kg = 440\u2013530 mg, once, in the 04:30 window on training days",note:"The performance ceiling. It exceeds the 400 mg/day health guideline, so it is a training-day-only single dose, never repeated; above 6 mg/kg you get tremor and a worse session, not a better one."},prem:{pick:"Plain caffeine tablets (200 mg) or a good coffee \u2014 there is no premium version",price:"~R60\u2013120 for a month est.",m:80,why:"A R400 pre-workout is caffeine plus theatre. Dose by bodyweight (see the dose card), keep it to the 04:30 window, and buy the cheapest clean source."},tag:"Best performance booster there is",ev:"Reliably increases strength, power, endurance & focus",how:"<b>3 mg per kg</b> bodyweight ~45-60 min before hard training or a race (for you ≈ 250 mg; a strong coffee is ~80-120 mg). Cap it around 400 mg/day. Skip it within ~8 hrs of bed, and take easy days off it so it keeps working.",why:"Blunts perceived effort and fatigue, so you train and race harder at the same RPE. The single most effective legal performance aid — useful for both your lifts and your race."}
  ]},
  {tier:"Tier 2 — Situational. Small, specific wins.",cls:"t2",items:[
    {n:"Citrulline Malate",hi:{d:"8\u201310 g (2:1 malate), 45\u201360 min before training",note:"10 g is the top of the studied range; more adds nothing and upsets the stomach. Only worth taking when the session starts before ~07:00."},prem:{pick:"Unflavoured bulk powder, 2:1 citrulline-malate, from a batch-tested brand if you compete",price:"~R250\u2013400 per 300 g est.",m:150,why:"Only useful on days you train before ~07:00. Form matters more than brand: 2:1 malate at 6\u20138 g; anything sold as a proprietary blend is under-dosed."},tag:"Pumps & training volume",ev:"Modest help with reps & blood flow",how:"<b>6-8 g</b> ~45 min pre-workout, in water (often already in pre-workouts — check the dose; many under-dose it).",why:"Improves blood flow and slightly delays fatigue, so you may squeeze out a few more reps. Minor but real on hard lifting days."},
    {n:"Beta-Alanine",hi:{d:"6.4 g/day for the first 4 weeks (4 \u00d7 1.6 g, or 3.2 g in each window), then 3.2\u20134.8 g/day",note:"6.4 g/day is the fastest loading protocol in the literature; the tingle is harmless but splitting the dose tames it. Beyond 6.4 g there is no extra saturation."},prem:{pick:"Unflavoured bulk beta-alanine, 3.2 g daily split across your two windows",price:"~R200\u2013350 per 250 g est.",m:100,why:"Effect is chronic, so the only thing that matters is taking it every day. A certified source if you compete; otherwise any reputable bulk powder."},tag:"High-rep & interval endurance",ev:"Helps efforts in the ~1-4 min range",how:"<b>3-5 g daily</b> (total dose matters, not timing). The harmless skin-tingle is normal; split doses to reduce it.",why:"Buffers the burn in longer sets and hard running intervals (like your Tuesday track work). Won't help a heavy triple, will help a brutal set of 20 or a 600 m rep."},
    {n:"Omega-3 (Fish Oil)",hi:{d:"3 g EPA+DHA per day (read the EPA/DHA line, not the capsule weight)",note:"The upper end of the evidence for recovery and inflammation; EFSA considers up to 5 g/day safe. Needs a concentrate \u2014 generic capsules would mean 10 a day."},prem:{pick:"A high-strength concentrate in triglyceride form delivering \u2265 1 g EPA+DHA per day \u2014 read the EPA/DHA line, not the \u201c1000 mg fish oil\u201d line (Solal, NOW Ultra Omega-3, Vital Omega-3 concentrate)",price:"~R250\u2013450 per month est.",m:350,why:"The one upgrade that changes the dose you actually absorb: generic capsules hold ~300 mg EPA+DHA, so you would need three or four to match one concentrate. Triglyceride form absorbs better than ethyl ester. Take with the fat in your 20:00 meal."},tag:"Recovery & general health",ev:"Good for health; small recovery upside",how:"<b>1-2 g combined EPA+DHA</b> daily, <b>with a meal</b> (it's fat-soluble). Check the label — you want EPA+DHA totals, not just 'fish oil' weight.",why:"Supports heart, joints and the inflammation balance that helps you recover from training twice as hard as a single-sport athlete."},
    {n:"Vitamin D3",hi:{d:"4,000 IU/day with K2 and fat \u2014 the tolerable upper level",note:"Higher (5,000\u201310,000 IU) only short-term and only with a blood level and a doctor. Above the UL without testing, calcium climbs and nothing improves."},prem:{pick:"D3 2,000\u20134,000 IU with K2 (MK-7), taken with fat \u2014 after a blood test confirms you need it",price:"~R120\u2013250 est.",m:150,why:"K2 keeps the calcium D3 mobilises out of your arteries and in your bones; the pairing costs almost nothing extra. Skip entirely if your blood panel says you are replete."},tag:"Only if you're low — test first",ev:"Fixes a deficiency; no benefit if you're already fine",how:"<b>1,000-2,000 IU</b> daily <b>with a meal</b>, but ideally <b>get a blood test first</b>. Plenty of sun in Joburg, so you may not need it.",why:"Low vitamin D hurts strength, mood and immunity. Topping up a deficiency helps; megadosing when you're fine does nothing."},
    {n:"Collagen Peptides + Vitamin C",hi:{d:"15 g hydrolysed collagen + 50 mg vitamin C, 45\u201360 min before heavy sessions",note:"15 g is the dose used in the tendon-synthesis studies; more collagen adds nothing. Vitamin C is the co-factor that makes it work."},prem:{pick:"Any hydrolysed collagen peptide powder (bovine) \u2014 unflavoured, 15 g scoop \u2014 plus a 50 mg vitamin C tablet or a small orange",price:"~R300\u2013500 per month est.",m:400,why:"No brand advantage; hydrolysed peptides absorb the same. Replaces a race-era item (sodium bicarbonate) that did nothing for a lifting plan."},tag:"Tendon & ligament insurance under heavy loading",ev:"Moderate evidence for connective-tissue adaptation",how:"<b>15 g hydrolysed collagen with ~50 mg vitamin C</b>, 45\u201360 minutes before the heavy sessions (Legs A/B, Pull A). Gelatin works the same. It is not a protein source for muscle \u2014 it is for the tissue that holds the muscle to the bone.",why:"Collagen synthesis in tendons and ligaments doubles when the amino acids are present in the blood during loading. At 38, ramping load aggressively, the tissue that gives out first is connective, not muscle \u2014 this is cheap insurance against the injury that ends a bulk."},
    {n:"Ashwagandha",hi:{d:"600 mg/day standardised extract (KSM-66 or Sensoril), evening",note:"600 mg is the top studied dose for sleep, cortisol and modest strength effects; 1,000+ mg adds sedation, not results. Cycle 8 weeks on, 2 off."},prem:{pick:"A standardised root extract \u2014 KSM-66 or Sensoril, 300\u2013600 mg \u2014 not generic \u201cashwagandha powder\u201d",price:"~R200\u2013350 est.",m:250,why:"The studies showing better sleep and modest strength gains used standardised extracts. Unstandardised root powder is a different, weaker product with the same name."},tag:"Sleep, stress & recovery",ev:"Helps stress/sleep — not a muscle builder",how:"<b>300-600 mg</b> (standardised KSM-66 or similar), usually in the <b>evening</b>.",why:"Lowers stress hormones and improves sleep quality, which indirectly helps recovery. Don't expect it to add muscle directly — its wins are calm and rest."}
  ]},
  {tier:"Tier 3 — Endurance fuel for your runs.",cls:"t3",items:[
    {n:"Carbohydrate (gels / sports drink)",hi:{d:"5\u20138 g/kg of carbohydrate from food on training days (440\u2013700 g)",note:"Not gels: whole-food carbs are the muscle fuel on this plan. 8 g/kg is peak-week territory; 5\u20136 g/kg is the daily ceiling that stays lean."},prem:{pick:"None needed \u2014 race-day fuel is parked with the running plan",price:"\u2014",m:0,why:"On a six-day lifting week your carbs come from food. A banana before training beats any gel."},tag:"Long runs & race day",ev:"Essential fuel past ~75-90 min",how:"For runs over ~75 min and on race day, take <b>30-60 g carbs per hour</b> (a gel ≈ 25 g, or sports drink). Practise it on long runs — never try new fuel on race day.",why:"Your muscles and brain run on stored carbs that empty on long efforts. Topping up keeps your pace from falling apart late in the run."},
    {n:"Electrolytes",hi:{d:"Magnesium glycinate 350\u2013400 mg elemental before bed; salt food to taste",note:"350 mg is the supplemental upper level for magnesium; glycinate is the form that reaches it without laxative effect. More than that goes straight through you."},prem:{pick:"Salt on your food, plus magnesium glycinate 300\u2013400 mg before bed (Solal, Solgar or NOW \u2014 the glycinate form, not oxide)",price:"~R150\u2013300 est.",m:200,why:"Sweat replacement is a running problem. Magnesium glycinate is the useful cousin: sleep quality and muscle relaxation, in a form that is actually absorbed."},tag:"Sweat replacement",ev:"Useful for long, sweaty Joburg sessions",how:"An electrolyte tab or pinch of salt in your bottle for long runs, especially in the heat. Don't over-think it for short runs.",why:"You lose sodium in sweat; replacing some helps hydration and prevents cramps and the late-run fade on hot days."},
    {n:"Iron",hi:{d:"0 until ferritin is measured",note:"The one item where the highest dose is none. Iron you do not need is stored in the liver. Test first, then a doctor-chosen dose if low."},prem:{pick:"Nothing until a blood panel says ferritin is low; then a doctor-chosen product",price:"\u2014",m:0,why:"Supplementing iron you do not need is harmful. Test first."},tag:"Awareness only — test, don't guess",ev:"Only if blood tests show low",how:"<b>Don't supplement blind.</b> Endurance runners (especially heavy training blocks) can run low on iron — if you feel unusually flat, get ferritin checked and treat only if needed.",why:"Iron carries oxygen in your blood. Low iron tanks endurance and energy — but too much is harmful, so this is a 'test first' item, not a default."}
  ]}
];
const SKIP=[
  {n:"BCAAs / EAAs",why:"Redundant once your daily protein is adequate — which yours is. Whole protein already contains them."},
  {n:"Glutamine",why:"No muscle or strength benefit in healthy, well-fed lifters."},
  {n:"Testosterone 'boosters'",why:"Don't reliably raise testosterone or build muscle in healthy men. Marketing, not science."},
  {n:"Fat burners / CLA",why:"Negligible effect; fat loss comes from your calorie deficit, not a pill."},
  {n:"Mass gainers",why:"Just creatine + carbs + sugar at a premium. Cheaper to eat real food and take plain creatine."}
];
const MIX=[
  {t:"Pre-workout / pre-run drink",cls:"go",items:"Caffeine + Citrulline + Beta-alanine + Creatine",note:"All dissolve happily in one 500 ml bottle ~45 min before. This is a genuine convenience win."},
  {t:"Post-workout shake",cls:"go",items:"Whey + Creatine (+ a banana or oats)",note:"Creatine rides along fine in your protein shake. Adding carbs helps refuel after long runs."},
  {t:"With a meal that has fat",cls:"go",items:"Omega-3 + Vitamin D3",note:"Both are fat-soluble, so a meal with some fat improves how much you actually absorb."},
  {t:"Keep these separate",cls:"sep",items:"Sodium bicarbonate · Ashwagandha",note:"Bicarb needs its own big bottle of water, sipped slowly with a snack. Ashwagandha sits better in the evening, away from caffeine."}
];
const MEALS=[
  {n:"Eggs & Oats",p:"~35 g",d:"3-4 whole eggs scrambled + 80 g oats cooked with milk. Add berries or honey. The classic high-protein breakfast that fuels morning training."},
  {n:"The Workhorse Plate",p:"~50 g",d:"A palm-and-a-half of chicken/beef/fish + 2 cupped handfuls of rice or potato + 2 fists of veg + a thumb of olive oil. Your default lunch or dinner."},
  {n:"Mince & Potato",p:"~45 g",d:"200 g lean beef mince browned with onion & spice + 2 medium potatoes or a cup of rice. Cheap, filling, high-protein. Batch-cook it."},
  {n:"The Mass Shake",p:"~40 g",d:"1 scoop whey + 1 banana + 80 g oats + 400 ml milk + spoon of peanut butter. ~600 easy calories when your appetite is low on bulk days."},
  {n:"Tinned Fish on Toast",p:"~30 g",d:"Tin of pilchards, tuna or mackerel on 2 slices wholegrain toast. 3-minute meal, omega-3s built in, very cheap."},
  {n:"Yoghurt Power Bowl",p:"~30 g",d:"Big tub (250 g) plain Greek/double-cream yoghurt + granola + nuts + fruit. Great snack or light meal that hits protein."},
  {n:"Steak & Eggs",p:"~60 g",d:"200 g rump or sirloin + 2 whole eggs + potatoes or rice. Red meat two or three times a week brings creatine, haem iron, zinc and B12 that chicken cannot \u2014 the quality upgrade that shows in bloodwork."},
  {n:"Oily Fish Plate",p:"~45 g",d:"180 g salmon or trout (or two tins of pilchards on a budget \u2014 nutritionally just as good) + sweet potato + greens. Real EPA/DHA from food, twice a week, which no capsule fully replaces."},
  {n:"The Pre-Sleep Bowl",p:"~35 g",d:"250\u2013300 g cottage cheese + berries + a handful of almonds, or an NPL Micellar Casein shake (R629.99 at Dis-Chem). The 20:00-window slow protein: overnight muscle protein synthesis is the cheapest growth you will ever buy."}
];
function renderFuel(){
  const el=document.getElementById("view-fuel"),w=parseFloat(DB.profile.weight)||85;
  const m=macros(curPhase==="hyper"?"hyper":curPhase==="race"?"race":"build");
  el.innerHTML=`
    <div class="eyebrow" style="color:var(--go)">Nutrition · Meal Plan · Supplements</div><h2 class="view-title">Fuel</h2>
    <p class="view-sub">Food first — it's the big lever for muscle. Below is a full <b>affordable meal plan</b> built for maximum lean gain on real South African groceries, a costed weekly shopping list, then the honest supplement guide. <b>Order of importance: training → daily protein & calories → sleep → then supplements.</b></p>
    <div id="mealPlanWrap"></div>
    <div class="note go"><b>The 5-second supplement version:</b> Creatine (5 g/day) and enough protein are 90% of the benefit. Caffeine before hard sessions. Everything else is small, situational, or for your runs. Most products in the shop are noise.</div>

    <div class="card"><div class="card-t" style="color:var(--go)"><span class="ic">${ICON.lift}</span>Personalised Doses <span style="font-size:11px;color:var(--text-3);font-weight:600">· at ${w} kg</span></div>
      <div class="card-st">Calculated from your bodyweight. Change it in Numbers and these update.</div>
      <div class="dose-grid">
        <div class="dose"><div class="dn">Creatine</div><div class="dv">5 g<small>/day, flat</small></div></div>
        <div class="dose"><div class="dn">Caffeine (pre)</div><div class="dv">${Math.round(w*3)}–${Math.round(w*6)} mg<small>3–6 mg/kg</small></div></div>
        <div class="dose"><div class="dn">Citrulline</div><div class="dv">6–8 g<small>pre-workout</small></div></div>
        <div class="dose"><div class="dn">Beta-alanine</div><div class="dv">3–5 g<small>/day</small></div></div>
        <div class="dose"><div class="dn">Bicarbonate</div><div class="dv">${Math.round(w*0.2)}–${Math.round(w*0.3)} g<small>0.2–0.3 g/kg</small></div></div>
        <div class="dose"><div class="dn">Protein target</div><div class="dv">${m.pro} g<small>/day total</small></div></div>
      </div>
      <div class="calc-note" style="margin-top:10px">Protein is a daily total from <b>food + powder combined</b> — not extra on top of eating. Bicarbonate is the one to trial cautiously (stomach), and only for hard interval days.</div>
    </div>

    <div class="card" style="border-color:rgba(66,215,125,.3)"><div class="card-t" style="color:var(--go)"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Daily Timing Schedule</div>
      <div class="card-st">Your rule: supplements only at <b>~04:30</b> or <b>~20:00</b>. Good news \u2014 the science mostly prefers it. Here\u2019s the exact two-window split, and the one thing that must never move.</div>
      <div class="timing-list">
        <div class="tblk morning">
          <div class="tblk-h"><span class="tblk-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="17" r="4"/><path d="M12 3v4M5 10l1.5 1.5M19 10l-1.5 1.5M3 17h2M19 17h2" stroke-linecap="round"/></svg></span><span class="tblk-label">04:30 \u2014 the early window (training days)</span></div>
          <div class="tblk-note">One glass of water, 30 seconds, done \u2014 then nothing else until 20:00. On rest days, skip this window entirely.</div>
          <div class="tblk-items">
            <div class="tblk-item"><div class="ti-n">Caffeine <span class="ti-d">${Math.round(w*3)}–${Math.round(w*6)} mg</span></div><div class="ti-w">Your <b>only</b> slot for it \u2014 caffeine at 20:00 would cost more muscle through wrecked sleep than it could ever add. Kicks in 45\u201360 min; strongest if you train within ~3 hours of taking it.</div></div>
            <div class="tblk-item"><div class="ti-n">Citrulline Malate <span class="ti-d">8\u201310 g \u00b7 conditional</span></div><div class="ti-w">Only worth it if you train before ~07:00 \u2014 its effect is acute (30\u201360 min). Training later in the day? Skip it; it\u2019s the one honest casualty of your windows.</div></div><div class="tblk-item"><div class="ti-n">Beta-Alanine <span class="ti-d">3.2 g (\u00bd of 6.4 g loading)</span></div><div class="ti-w">Splitting the daily 3.2 g across your two windows kills the skin-tingles. Only the daily total matters.</div></div>
          </div>
        </div>
        <div class="tblk midday">
          <div class="tblk-h"><span class="tblk-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke-linecap="round"/></svg></span><span class="tblk-label">05:00\u201319:59 \u2014 nothing, by design</span></div>
          <div class="tblk-note">Your rule holds all day: no supplements between the windows \u2014 and nothing in the stack needs one. Food does the daytime work.</div>
          <div class="tblk-items">
            <div class="tblk-item"><div class="ti-n">Whey Protein <span class="ti-d">if food falls short</span></div><div class="ti-w">Whey is <b>food</b>, not a windowed supplement \u2014 use it with any meal to close the gap to your ${m.pro} g target. Doesn\u2019t touch your rule.</div></div>
            
          </div>
        </div>
        <div class="tblk evening">
          <div class="tblk-h"><span class="tblk-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 14.5A8 8 0 1110.5 4 6.5 6.5 0 0020 14.5z" stroke-linejoin="round"/></svg></span><span class="tblk-label">20:00 \u2014 the evening window (daily)</span></div>
          <div class="tblk-note">All five together with dinner \u2014 nothing conflicts. This window carries the whole daily stack \u2014 plus one food item that earns its place here.</div>
          <div class="tblk-item" style="border-color:rgba(255,197,61,.4)"><div class="ti-n">Slow protein before bed <span class="ti-d">30\u201340 g casein \u00b7 or 250\u2013300 g cottage cheese \u00b7 or 500 ml milk</span></div><div class="ti-w">Pre-sleep protein raises overnight muscle protein synthesis, and in a 12-week training study it increased muscle mass gains versus placebo. It is food, not a supplement \u2014 it sits inside your 20:00 window either way. Casein at Dis-Chem/Clicks, or the cheap route: cottage cheese.</div></div>
          <div class="tblk-items">
            <div class="tblk-item"><div class="ti-n">Creatine <span class="ti-d">5 g</span></div><div class="ti-w">Timing never matters at all, for anyone. Total non-issue moving it to dinner or right before bed.</div></div>
            <div class="tblk-item"><div class="ti-n">Beta-Alanine <span class="ti-d">3.2 g (2nd \u00bd \u00b7 drop to 1.6 after week 4)</span></div><div class="ti-w">Second half of the daily 3.2 g. Only the total matters \u2014 the split just tames the tingles.</div></div>
            <div class="tblk-item"><div class="ti-n">Omega-3 <span class="ti-d">1–2 g</span></div><div class="ti-w">Fat-soluble — needs a meal with some fat to absorb. Dinner usually has more fat in it than a rushed breakfast anyway.</div></div>
            <div class="tblk-item"><div class="ti-n">Vitamin D3 <span class="ti-d">1,000–2,000 IU</span></div><div class="ti-w">Same logic as omega-3 — take with your biggest meal of the day, and only if a blood test actually shows you're low.</div></div>
            <div class="tblk-item"><div class="ti-n">Ashwagandha <span class="ti-d">300–600 mg</span></div><div class="ti-w">Built for stress and sleep — evening isn't a compromise here, it's the <i>intended</i> timing.</div></div>
          </div>
        </div>
        <div class="tblk occasion">
          <div class="tblk-h"><span class="tblk-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 3L4 14h6l-1 8 9-12h-6l1-8z" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="tblk-label">Occasion only — not a daily habit</span></div>
          <div class="tblk-note">These come out only when the specific session calls for them \u2014 and they\u2019re the honest exception to your windows: intra-session and race-day items are taken when the session needs them, not at 04:30/20:00.</div>
          <div class="tblk-items">
            <div class="tblk-item"><div class="ti-n">Sodium Bicarbonate <span class="ti-d">${Math.round(w*0.2)}–${Math.round(w*0.3)} g</span></div><div class="ti-w">Only before a genuinely hard interval effort, 60-90 min prior. Your run plan is mostly easy/long runs now, so you'll rarely reach for this.</div></div>
            <div class="tblk-item"><div class="ti-n">Carbs / Electrolytes <span class="ti-d">30-60 g/hr</span></div><div class="ti-w">Long runs (75 min+) and race day only. Not a daily supplement.</div></div>
            <div class="tblk-item"><div class="ti-n">Iron <span class="ti-d">test first</span></div><div class="ti-w">Never supplement blind. Only if a blood test shows you're actually low.</div></div>
          </div>
        </div>
      </div>
      <div class="calc-note" style="margin-top:12px">Want to combine any of these in one drink? The <b>What to Mix</b> card below covers exactly what blends safely and what to keep apart.</div>
    </div>

    <div class="eyebrow" style="color:var(--go)">The Stack — What Actually Works</div>
    <div class="seg" id="fuelQSeg" style="margin:4px 0 10px"><button data-q="standard"${fuelQ==="standard"?" class=on":""}>Standard picks</button><button data-q="premium"${fuelQ==="premium"?" class=on":""}>Premium picks</button></div>
    ${fuelQ==="premium"?`<div class="calc-note" style="margin-bottom:10px"><b>Premium mode:</b> every item below carries a gold \u201cPremium pick\u201d \u2014 best form, batch-tested source, South African prices (verified at Dis-Chem in Sep 2026 where stated, otherwise estimated). The full premium stack is \u2248 <b>R${SUPP_TIERS.flatMap(t=>t.items).reduce((a,i)=>a+((i.prem&&i.prem.m)||0),0).toLocaleString()}/month</b> if you bought everything \u2014 which you should not: creatine, protein, omega-3 and D3 are the ones that earn it. The meal plan below swaps its three dinners to steak, salmon and ostrich in this mode, and moves ~300 kcal of the pre-gym sandwich into a 20:00 pre-sleep cottage-cheese bowl \u2014 same daily total, better distribution.</div>`:""}
    <div id="suppStack"></div>
    <div class="calc-note" style="margin-top:12px"><b>Audited for effectiveness \u2014 and what NOT to buy:</b> the stack above is the most effective legal set for muscle gain in the evidence: creatine monohydrate, protein to target, caffeine, omega-3, D3 (if low), magnesium glycinate, ashwagandha extract, collagen for the tendons, citrulline and beta-alanine as situational extras. Money that buys nothing: <b>HMB</b> (no effect in trained lifters), <b>BCAAs</b> (redundant if protein is met), <b>testosterone boosters</b> (tribulus, D-aspartic acid, fenugreek \u2014 no meaningful effect), <b>glutamine</b>, <b>arginine</b>, <b>fat burners</b> and <b>proprietary pre-workout blends</b> (under-dosed caffeine plus theatre). If a product is not on the list above, the evidence for muscle is not there.</div>

    <div class="card"><div class="card-t"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V5a3 3 0 016 0v3" stroke-linecap="round"/></svg></span>What to Mix (and What to Keep Apart)</div>
      <div class="card-st">Combining saves time — but only some combos genuinely help absorption. Here's the difference.</div>
      <div class="mix-grid">${MIX.map(x=>`<div class="mixcard ${x.cls}"><div class="mix-t">${x.cls==="sep"?"⚠ ":"✓ "}${x.t}</div><div class="mix-items">${x.items}</div><div class="mix-note">${x.note}</div></div>`).join("")}</div>
    </div>

    <div class="card"><div class="card-t" style="color:var(--danger)"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 8l8 8" stroke-linecap="round"/></svg></span>Skip These — Money Down the Drain</div>
      <div class="card-st">The shop sells these hard. For your goal, the evidence says don't bother.</div>
      <div class="skip-list">${SKIP.map(s=>`<div class="skip-row"><div class="skip-n">${s.n}</div><div class="skip-w">${s.why}</div></div>`).join("")}</div>
    </div>

    <div class="card"><div class="card-t" style="color:var(--go)"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h10" stroke-linecap="round"/></svg></span>South African Price Guide</div>
      <div class="card-st">For commodities like creatine, ignore the brand hype and buy on <b>price per gram</b>. Prices checked late June 2026 — they drift, so confirm in-store.</div>
      <div class="price-tbl">
        <div class="pt-head"><span>Product</span><span>Typical price</span><span>Per gram</span></div>
        <div class="pt-row"><div class="pt-n">Biogen Creatine 500g<small>Informed-Sport tested — the pick</small></div><div class="pt-p">~R192–240</div><div class="pt-g">~R0.40</div></div>
        <div class="pt-row"><div class="pt-n">NPL / USN Creatine<small>fine alternatives, check it's pure monohydrate</small></div><div class="pt-p">~R200–260</div><div class="pt-g">~R0.45</div></div>
        <div class="pt-row"><div class="pt-n">Whey (value, e.g. Biogen/NPL 2kg)<small>buy on price-per-gram, not brand</small></div><div class="pt-p">~R450–650</div><div class="pt-g">~R0.25</div></div>
        <div class="pt-row"><div class="pt-n">USN Blue Lab Whey 2kg<small>premium blend, Informed-Choice</small></div><div class="pt-p">~R1,000–1,230</div><div class="pt-g">~R0.55</div></div>
        <div class="pt-row"><div class="pt-n">Beta-alanine / Citrulline<small>often cheaper bundled in a pre-workout</small></div><div class="pt-p">~R200–350</div><div class="pt-g">—</div></div>
        <div class="pt-row"><div class="pt-n">Omega-3 fish oil<small>check EPA+DHA totals</small></div><div class="pt-p">~R120–250</div><div class="pt-g">—</div></div>
        <div class="pt-row"><div class="pt-n">Biogen Vitamin D3 120s<small>only if blood test shows low</small></div><div class="pt-p">~R135</div><div class="pt-g">—</div></div>
        <div class="pt-row"><div class="pt-n">Biogen Ashwagandha 60s<small>KSM-66 root</small></div><div class="pt-p">~R198</div><div class="pt-g">—</div></div>
      </div>
      <div class="calc-note" style="margin-top:10px"><b>Where to buy:</b> Dis-Chem and Clicks for in-store + tested brands; Takealot and pricecheck.co.za to compare. <b>Your essentials-only cart:</b> one tub of tested creatine (~R200) covers 3+ months. Add whey only if your food protein falls short. That's the whole list — the rest is optional.</div>
    </div>

    <div class="eyebrow" style="color:var(--go)">Bedrock Meals — Hit Your Protein</div>
    <div class="card"><div class="card-st" style="margin-bottom:12px">Six repeatable, high-protein meals built around real South African food. Rotate them and protein takes care of itself.</div>
      <div class="meal-grid">${MEALS.map(meal=>`<div class="mealcard"><div class="meal-h"><span class="meal-n">${meal.n}</span><span class="meal-p">${meal.p} protein</span></div><div class="meal-d">${meal.d}</div></div>`).join("")}</div>
    </div>
    <div class="card"><div class="card-t" style="color:var(--go)"><span class="ic">${ICON.check}</span>Build Any Plate — The Hand Method</div><div class="prose" style="margin-top:6px">
      <p>No scale needed. Use your hand to build any meal:</p>
      <p>• <b>Protein</b> — 1–2 palms (chicken, beef, fish, eggs, dairy)</p>
      <p>• <b>Carbs</b> — 1–2 cupped handfuls (rice, potato, oats, bread, fruit) — go to the higher end on training and long-run days</p>
      <p>• <b>Veg</b> — 1–2 fists (any colour, fill the gaps)</p>
      <p>• <b>Fats</b> — 1 thumb (oil, nuts, avo, cheese)</p>
      <p><span class="hl">On a bulk:</span> add a cupped handful of carbs and a thumb of fat to each meal. <span class="hlc">On a cut:</span> drop them. Protein and veg stay constant either way.</p>
    </div></div>
    <div class="card"><div class="disclaimer"><b>Note:</b> Educational information, not medical advice. Supplements are not regulated like medicines — buy third-party-tested brands (Informed-Sport / Informed-Choice) where you can. Check with a doctor or pharmacist before starting anything new, especially sodium bicarbonate or if you have any health conditions or take medication.</div></div>
    <p class="foot-note">Fuel · part of The Comeback Blueprint · prices verified late June 2026, confirm in-store</p>`;
  document.getElementById("suppStack").innerHTML=SUPP_TIERS.map(tg=>`
    <div class="supp-tier ${tg.cls}"><div class="st-label">${tg.tier}</div>
    ${tg.items.map(it=>`<div class="supp"><div class="supp-h" data-supp="${it.n.replace(/[^a-z0-9]/gi,'')}"><div class="supp-ti"><div class="supp-n">${it.n}</div><div class="supp-tag">${it.tag}</div></div><span class="supp-chev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
      <div class="supp-ev">${it.ev}</div>
      <div class="supp-b" id="supp-${it.n.replace(/[^a-z0-9]/gi,'')}"><div class="blk"><div class="lbl how">How To Take It</div><p>${it.how}</p></div><div class="blk"><div class="lbl why">What It Does</div><p>${it.why}</p></div>${it.hi?`<div class="blk" style="border-left:3px solid var(--go);padding-left:10px;margin-top:8px"><div class="lbl" style="color:var(--go)">Highest recommended dose</div><div><b>${it.hi.d}</b></div><div style="font-size:13px;color:var(--text-2);line-height:1.5">${it.hi.note}</div></div>`:""}${fuelQ==="premium"&&it.prem?`<div class="blk" style="border-left:3px solid var(--gold);padding-left:10px;margin-top:8px"><div class="lbl" style="color:var(--gold)">Premium pick \u00b7 budget open</div><div><b>${it.prem.pick}</b></div><div style="font-family:var(--f-mono);font-size:12px;color:var(--text-2);margin:3px 0">${it.prem.price}</div><div style="font-size:13px;color:var(--text-2);line-height:1.5">${it.prem.why}</div></div>`:""}</div></div></div>`).join("")}
    </div>`).join("");
  document.querySelectorAll("#suppStack .supp-h").forEach(h=>h.addEventListener("click",()=>{document.getElementById("supp-"+h.dataset.supp).classList.toggle("open");h.classList.toggle("open");}));
  renderMealPlan();
}
/* ===== AFFORDABLE MEAL PLAN (maximum lean gain, SA groceries) ===== */
const MP_DAYS=[
  {d:"Day A",meals:[
    {m:"Breakfast",f:"100g oats cooked in 400ml milk + 1 banana + 1 tbsp peanut butter, plus 3 whole eggs scrambled",kc:995,p:45},
    {m:"Mid-morning",f:"500g maas (amasi) or plain yoghurt + 40g raisins + small handful (30g) nuts",kc:520,p:22},
    {m:"Lunch",f:"150g chicken + 1½ cups cooked rice + 2 handfuls mixed veg + 1 tbsp oil",kc:720,p:52},
    {m:"Pre/Post-gym",f:"2-slice peanut butter sandwich + 1 banana + 250ml milk",kc:580,p:20},
    {m:"Dinner",f:"200g lean beef mince (or soya mince) + 2 potatoes or 1½ cups pap + veg",pf:"200g rump or sirloin steak + 2 potatoes + veg \u2014 red meat for creatine, haem iron, zinc, B12",kc:620,p:45}]},
  {d:"Day B",meals:[
    {m:"Breakfast",f:"4 eggs + 2 slices toast + 80g oats with milk + 1 banana",kc:980,p:44},
    {m:"Mid-morning",f:"1 tin pilchards/mackerel on 2 slices wholegrain toast",kc:480,p:30},
    {m:"Lunch",f:"200g mince (or soya) + 1½ cups pap + 2 fists veg",kc:700,p:46},
    {m:"Pre/Post-gym",f:"Shake: 80g oats + 500ml milk + 1 banana + 1 tbsp peanut butter",kc:600,p:24},
    {m:"Dinner",f:"150g chicken + 2 potatoes + veg + 1 tbsp oil",pf:"180g salmon or trout + sweet potato + greens \u2014 real EPA/DHA from food (two tins of pilchards do the same job for a tenth of the price)",kc:650,p:48}]},
  {d:"Day C",meals:[
    {m:"Breakfast",f:"100g oats + 1 scoop whey (or 250ml milk) + 1 tbsp peanut butter + banana",kc:760,p:40},
    {m:"Mid-morning",f:"250g yoghurt + 40g granola + handful nuts + fruit",kc:560,p:20},
    {m:"Lunch",f:"3 eggs + 1 tin fish + 1½ cups rice + veg",kc:780,p:50},
    {m:"Pre/Post-gym",f:"2-slice peanut butter sandwich + 250ml milk",kc:520,p:18},
    {m:"Dinner",f:"200g chicken or mince + 2 potatoes/pap + veg + oil",pf:"200g lean beef or ostrich + 2 potatoes + veg + oil \u2014 ostrich is the leanest red meat in the country and full of iron",kc:760,p:52}]}
];
const MP_SWAPS=[
  {pricey:"Beef mince (~R110/kg)",cheap:"Soya mince / TVP",note:"A fraction of the price, ~50g protein per 100g dry. Cook it with stock and spice — you won't miss the beef in a bolognaise."},
  {pricey:"Chicken fillets (~R130/kg)",cheap:"Chicken thighs / frozen mixed portions",note:"Thighs ~R95/kg; frozen bulk bags even less. Same protein, more flavour, far cheaper."},
  {pricey:"Beef / steak",cheap:"Eggs · tinned pilchards · chicken livers",note:"Eggs (~R44/30 medium), tinned pilchards (~R20) and livers are the cheapest quality protein in SA."},
  {pricey:"Branded snacks",cheap:"Oats · pap · rice · potatoes · bananas",note:"Cheapest clean calories for bulking. Lean on these to add the surplus without spending much."},
  {pricey:"Flavoured milk / juice",cheap:"Full-cream milk · maas",note:"Milk (~R20/L) is a cheap, easy 600+ calorie protein source across the day. Maas is great for digestion."}
];
const MP_GROCERY=[
  {it:"Oats",q:"1.5 kg",c:50},{it:"Eggs (medium)",q:"30 pack",c:44},{it:"Full-cream milk",q:"6 L",c:120},
  {it:"Maas / plain yoghurt",q:"2 L",c:45},{it:"Chicken (thighs/frozen)",q:"2 kg",c:150},{it:"Lean mince or soya mince",q:"1 kg",c:100},
  {it:"Rice",q:"2 kg",c:45},{it:"Maize meal (pap)",q:"2.5 kg",c:40},{it:"Potatoes",q:"2 kg",c:40},
  {it:"Frozen mixed veg",q:"2 kg",c:70},{it:"Peanut butter",q:"800 g",c:80},{it:"Bananas",q:"~12",c:40},
  {it:"Bread (wholegrain)",q:"2 loaves",c:40},{it:"Tinned pilchards/mackerel",q:"×4",c:90},{it:"Nuts / raisins",q:"500 g",c:70},
  {it:"Cooking oil",q:"750 ml",c:40}
];
function renderMealPlan(){
  const wrap=document.getElementById("mealPlanWrap");if(!wrap)return;
  const ph=(curPhase==="hyper"||curPhase==="race")?curPhase:"build";
  const m=macros(ph),g=gainModel(ph);
  const planKc=3400,planP=185; // average of the three day plans as written
  const total=MP_GROCERY.reduce((s,x)=>s+x.c,0);
  const budget=Math.round(total*0.78/10)*10;
  const diff=m.cal-planKc,scaleMsg=Math.abs(diff)<150
    ?"This plan lands right on your target — eat it as written."
    :diff>0?`Your target is ~${m.cal} kcal — about ${diff} above this plan. Add a 4th shake (oats + milk + peanut butter ≈ +400) or an extra sandwich.`
    :`Your target is ~${m.cal} kcal — about ${Math.abs(diff)} below this plan. Drop the mid-morning snack or the pre-gym sandwich.`;
  wrap.innerHTML=`
    <div class="card" style="border-color:rgba(66,215,125,.35)">
      <div class="card-t" style="color:var(--go)"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v6H3zM3 13h18v8H3z" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Your Maximum Lean-Gain Meal Plan</div>
      <div class="card-st">Built to hit your gain target on affordable South African food — aggressive enough to grow fast, controlled enough to stay lean. The plan below is ~${planKc} kcal · ~${planP}g protein per day.</div>
      <div class="dose-grid" style="margin-top:12px">
        <div class="dose"><div class="dn">Your target</div><div class="dv">${m.cal}<small>kcal/day · ${g.mode}</small></div></div>
        <div class="dose"><div class="dn">Protein</div><div class="dv">${m.pro} g<small>~${Math.round(m.pro/5)}g × 5 meals</small></div></div>
        <div class="dose"><div class="dn">Gain rate</div><div class="dv">+${g.rateKgWk.toFixed(2)}<small>kg/week</small></div></div>
      </div>
      <div class="note go" style="margin-top:10px"><b>Scaling:</b> ${scaleMsg} Change your bulk aggressiveness (Lean/Balanced/Maximum) in Numbers and this target updates.</div>
      <div class="mp-days">
        ${MP_DAYS.map(day=>{const dkc=day.meals.reduce((s,x)=>s+x.kc,0),dp=day.meals.reduce((s,x)=>s+x.p,0);return `
        <div class="mp-day"><div class="mp-dh"><span>${day.d}</span><span class="mp-tot">${dkc} kcal · ${dp}g P</span></div>
          ${day.meals.map(me=>`<div class="mp-meal"><div class="mp-m">${me.m}</div><div class="mp-f">${fuelQ==="premium"&&me.pf?me.pf:me.f}${fuelQ==="premium"&&me.pf?' <span style="font-size:10px;font-family:var(--f-mono);color:var(--gold)">PREMIUM</span>':""}</div><div class="mp-macros">${me.kc} kcal · ${me.p}g</div></div>`).join("")}
        </div>`;}).join("")}
      </div>
      <div class="calc-note" style="margin-top:10px">Rotate the three days for variety; protein lands ~180g either way. Drink water through the day, and don't skip meals — consistency is what builds the mass.</div>
    </div>

    <div class="card"><div class="card-t" style="color:var(--go)"><span class="ic">${ICON.check}</span>Eat Big for Less — Affordable Swaps</div>
      <div class="card-st">Hit the same protein and calories for less. South Africa's best value muscle food.</div>
      <div class="skip-list">${MP_SWAPS.map(s=>`<div class="swap-row"><div class="swap-top"><span class="swap-cheap">✓ ${s.cheap}</span><span class="swap-pricey">instead of ${s.pricey}</span></div><div class="skip-w">${s.note}</div></div>`).join("")}</div>
    </div>

    <div class="card"><div class="card-t" style="color:var(--go)"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6h15l-1.5 9h-12z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M6 6L5 3H3" stroke-linecap="round"/></svg></span>Weekly Shopping List &amp; Cost</div>
      <div class="card-st">One week of the plan for one person. Prices checked mid-2026 — they vary by store and season, so treat as a guide.</div>
      <div class="price-tbl" style="margin-top:12px">
        <div class="pt-head"><span>Item</span><span>Qty</span><span>~Cost</span></div>
        ${MP_GROCERY.map(x=>`<div class="pt-row"><div class="pt-n">${x.it}</div><div class="pt-p" style="color:var(--text-3)">${x.q}</div><div class="pt-g" style="color:var(--go)">R${x.c}</div></div>`).join("")}
        <div class="pt-row" style="background:rgba(66,215,125,.08)"><div class="pt-n"><b>Weekly total</b></div><div class="pt-p" style="color:var(--text-3)">~${Math.round(total/7)}/day</div><div class="pt-g" style="color:var(--go)"><b>~R${total}</b></div></div>
      </div>
      <div class="note go" style="margin-top:10px"><b>Tighter budget? ~R${budget}/week:</b> swap mince for soya mince, chicken fillets for frozen portions, drop the nuts, and lean on eggs, pilchards, pap, oats and milk. That's still ~${planP}g protein a day — among the cheapest ways to build serious muscle in SA.</div>
    </div>

    <div class="card"><div class="card-t" style="color:var(--go)"><span class="ic">${ICON.check}</span>5 Diet Rules for Maximum Lean Gain</div><div class="prose" style="margin-top:6px">
      <p>• <b>Hit protein every day, no exceptions.</b> ~${m.pro}g, spread over 4-5 meals of ~${Math.round(m.pro/5)}g. This is the non-negotiable that turns training into muscle.</p>
      <p>• <b>Eat in a controlled surplus, not a dirty bulk.</b> Aim for +${g.rateKgWk.toFixed(2)} kg/week. Faster means fat — let the Maximum Lean Gain engine police it.</p>
      <p>• <b>Carbs are your friend on a bulk.</b> Rice, pap, oats and potatoes are cheap, fuel hard lifting, and drive growth. Don't fear them.</p>
      <p>• <b>Eat most carbs around training.</b> Breakfast and your pre/post-gym meals are the best time for the biggest carb servings.</p>
      <p>• <b>Be consistent and patient.</b> Muscle is built over months of hitting these numbers, not in any single day. Track your weekly average weight in Track.</p>
    </div></div>`;
}

/* ===== TRACK ===== */
let curTP="weight";
function renderTrack(){
  const el=document.getElementById("view-track");
  el.innerHTML=`<h2 class="view-title">Track</h2>
    <p class="view-sub">Watch both missions unfold: muscle on one side, race fitness on the other. Log consistently — the charts tell you if it's working.</p>
    <div class="storage-warn" id="storageWarn">&#9888; This browser is blocking local storage (private/preview mode). Logs won't persist. Download the file and open it directly for full tracking.</div>
    <div class="track-tabs"><button class="on" data-tp="weight">Bodyweight</button><button data-tp="mileage">Run Mileage</button><button data-tp="pace">Run Pace</button><button data-tp="strength">Strength</button><button data-tp="measure">Measures</button></div>
    <div class="track-pane on" id="tp-weight"><div class="quick"><div class="field"><label>Date</label><input type="date" id="wDate"></div><div class="field"><label>Weight (kg)</label><input type="number" inputmode="decimal" id="wVal" placeholder="85.0"></div><button class="btn btn-gold" id="wAdd" style="width:auto;align-self:flex-end;min-width:110px">Log</button></div><div class="chart-card"><div class="chart-head"><h3>Bodyweight Trend</h3><span class="chs" id="wSub">—</span></div><div id="wChart"></div></div><div class="log-list" id="wList"></div></div>
    <div class="track-pane" id="tp-mileage"><div class="chart-card"><div class="chart-head"><h3>Weekly Running Volume</h3><span class="chs">km per week</span></div><div id="mChart"></div></div><div class="chart-card"><div class="chart-head"><h3>Longest Run</h3><span class="chs">target: 15-16 km</span></div><div id="lrChart"></div></div><div class="log-list" id="runList"></div></div>
    <div class="track-pane" id="tp-pace"><div class="chart-card"><div class="chart-head"><h3>Easy-Run Pace Trend</h3><span class="chs">min/km · lower = faster</span></div><div id="paceChart"></div></div><div class="calc-note">As your aerobic engine grows, your easy pace gets faster at the same effort. That's fitness you can see.</div></div>
    <div class="track-pane" id="tp-strength"><div class="quick"><div class="field" style="min-width:130px"><label>Lift</label><select id="lLift"><option>Bench Press</option><option>Overhead Press</option><option>Squat</option><option>Deadlift</option><option>Barbell Row</option></select></div><div class="field"><label>Kg</label><input type="number" inputmode="decimal" id="lW" placeholder="100"></div><div class="field"><label>Reps</label><input type="number" inputmode="numeric" id="lR" placeholder="5"></div><button class="btn btn-gold" id="lAdd" style="width:auto;align-self:flex-end;min-width:90px">Log</button></div><div class="chart-card"><div class="chart-head"><h3>Estimated 1-Rep-Max</h3><select class="field" id="liftSel" style="width:auto;padding:7px 10px;font-size:13px"></select></div><div id="liftChart"></div></div><div class="log-list" id="liftList"></div></div>
    <div class="track-pane" id="tp-measure"><div class="input-grid"><div class="field"><label>Date</label><input type="date" id="meDate"></div><div class="field"><label>Waist (cm)</label><input type="number" inputmode="decimal" id="meWaist" placeholder="—"></div><div class="field"><label>Neck (cm)</label><input type="number" inputmode="decimal" id="meNeck" placeholder="— for body-fat estimate"></div><div class="field"><label>Arm (cm)</label><input type="number" inputmode="decimal" id="meArm" placeholder="—"></div><div class="field"><label>Chest (cm)</label><input type="number" inputmode="decimal" id="meChest" placeholder="—"></div><div class="field"><label>Thigh (cm)</label><input type="number" inputmode="decimal" id="meThigh" placeholder="—"></div></div><button class="btn btn-gold" id="meAdd" style="margin-bottom:16px">Save</button><div class="chart-card"><div class="chart-head"><h3>Waist vs Arm</h3><span class="chs">arm up, waist stable = winning</span></div><div id="meChart"></div></div><div class="log-list" id="meList"></div></div>
    <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" id="exportBtn" style="flex:1;min-width:150px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke-linecap="round" stroke-linejoin="round"/></svg>Export Backup</button><button class="btn btn-ghost" id="importBtn" style="flex:1;min-width:150px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21V9m0 0l-4 4m4-4l4 4M5 3h14" stroke-linecap="round" stroke-linejoin="round"/></svg>Import Backup</button><input type="file" id="importFile" accept="application/json,.json" hidden></div>
    <p class="foot-note">All data stays private in this browser. Export monthly so you never lose your progress.</p>`;
  if(!STORAGE_OK)document.getElementById("storageWarn").classList.add("show");
  ["wDate","meDate"].forEach(id=>{const e=document.getElementById(id);if(e&&!e.value)e.value=todayISO();});
  document.querySelectorAll(".track-tabs button").forEach(b=>b.addEventListener("click",()=>{curTP=b.dataset.tp;document.querySelectorAll(".track-tabs button").forEach(x=>x.classList.toggle("on",x.dataset.tp===curTP));document.querySelectorAll(".track-pane").forEach(p=>p.classList.toggle("on",p.id==="tp-"+curTP));}));
  wireTrack();renderWeight();renderMileage();renderPace();renderStrength();renderMeasure();
}
function wireTrack(){
  document.getElementById("wAdd").addEventListener("click",()=>{const date=document.getElementById("wDate").value||todayISO(),v=parseFloat(document.getElementById("wVal").value);if(!v){toast("Enter a weight");return;}DB.weight=DB.weight.filter(x=>x.date!==date);DB.weight.push({date,v});DB.profile.weight=v;DB.save();document.getElementById("wVal").value="";renderWeight();toast("Weight logged");});
  document.getElementById("lAdd").addEventListener("click",()=>{const lift=document.getElementById("lLift").value,w=parseFloat(document.getElementById("lW").value),r=parseFloat(document.getElementById("lR").value);if(!w||!r){toast("Enter weight and reps");return;}DB.lifts.push({date:todayISO(),lift,w,r});DB.save();document.getElementById("lW").value="";document.getElementById("lR").value="";renderStrength();toast("Logged · 1RM ~"+Math.round(e1rm(w,r))+"kg");});
  document.getElementById("meAdd").addEventListener("click",()=>{const g=id=>{const v=document.getElementById(id).value;return v?parseFloat(v):null;};const date=document.getElementById("meDate").value||todayISO(),e={date,waist:g("meWaist"),neck:g("meNeck"),arm:g("meArm"),chest:g("meChest"),thigh:g("meThigh")};if(e.waist==null&&e.neck==null&&e.arm==null&&e.chest==null&&e.thigh==null){toast("Enter at least one");return;}DB.measure=DB.measure.filter(x=>x.date!==date);DB.measure.push(e);DB.save();["meWaist","meArm","meChest","meThigh"].forEach(id=>document.getElementById(id).value="");renderMeasure();toast("Saved");});
  document.getElementById("exportBtn").addEventListener("click",()=>{const payload={app:"ComebackBlueprint",version:2,exported:new Date().toISOString(),profile:DB.profile,sessions:DB.sessions,runs:DB.runs,weight:DB.weight,measure:DB.measure,lifts:DB.lifts};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="comeback-blueprint-"+todayISO()+".json";a.click();URL.revokeObjectURL(url);toast("Backup downloaded");});
  document.getElementById("importBtn").addEventListener("click",()=>document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!confirm("Import this backup? It replaces current data on this device."))return;if(d.profile)DB.profile=d.profile;DB.sessions=d.sessions||[];DB.runs=d.runs||[];DB.weight=d.weight||[];DB.measure=d.measure||[];DB.lifts=d.lifts||[];DB.save();toast("Backup restored");renderTrack();updateHeader();}catch(err){toast("Couldn't read that file");}};r.readAsText(f);e.target.value="";});
}
/* ===== CHARTS ===== */
function lineChart(series,opts){
  opts=opts||{};const W=opts.w||640,H=opts.h||210,pad={t:14,r:14,b:28,l:42};
  const all=[];series.forEach(s=>s.points.forEach(p=>all.push(p.value)));
  if(opts.band)series.forEach(s=>(s.band||[]).forEach(b=>{all.push(b.lo);all.push(b.hi);}));
  if(!all.length)return "";
  let min=Math.min(...all),max=Math.max(...all);if(min===max){min-=1;max+=1;}const rng=max-min;min-=rng*0.12;max+=rng*0.12;
  const dates=[...new Set(series.flatMap(s=>s.points.map(p=>p.x)))].sort();
  const px=iso=>pad.l+(dates.length>1?dates.indexOf(iso)/(dates.length-1):0.5)*(W-pad.l-pad.r),py=v=>pad.t+(1-(v-min)/(max-min))*(H-pad.t-pad.b);
  let grid="",yl="";for(let g=0;g<=4;g++){const v=min+(max-min)*g/4,y=py(v);grid+=`<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="var(--line)"/>`;yl+=`<text x="${pad.l-7}" y="${y+3}" text-anchor="end" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">${opts.fmt?opts.fmt(v):v.toFixed(opts.dec!=null?opts.dec:0)}</text>`;}
  let bands="";series.forEach(s=>{if(s.band&&s.band.length){let t="";s.band.forEach((b,i)=>{t+=(i?"L":"M")+px(b.x).toFixed(1)+" "+py(b.hi).toFixed(1)+" ";});for(let i=s.band.length-1;i>=0;i--)t+="L"+px(s.band[i].x).toFixed(1)+" "+py(s.band[i].lo).toFixed(1)+" ";bands+=`<path d="${t}Z" fill="${s.color}" opacity="0.12"/>`;}});
  let paths="",dots="";series.forEach(s=>{if(!s.points.length)return;let d="";s.points.forEach((p,i)=>{d+=(i?"L":"M")+px(p.x).toFixed(1)+" "+py(p.value).toFixed(1)+" ";});paths+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;s.points.forEach(p=>{dots+=`<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.value).toFixed(1)}" r="3.3" fill="${s.color}" stroke="var(--panel)" stroke-width="1.5"/>`;});});
  let xl="";const step=Math.ceil(dates.length/6);dates.forEach((dt,i)=>{if(i%step===0||i===dates.length-1)xl+=`<text x="${px(dt).toFixed(1)}" y="${H-9}" text-anchor="middle" font-size="9.5" fill="var(--text-3)" font-family="var(--f-mono)">${fmtShort(dt)}</text>`;});
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${yl}${bands}${paths}${dots}${xl}</svg>`;
}
function barChart(data,opts){
  opts=opts||{};const W=opts.w||640,H=opts.h||210,pad={t:14,r:14,b:28,l:42};
  if(!data.length)return "";
  let max=Math.max(...data.map(d=>d.value),1)*1.12;const bw=(W-pad.l-pad.r)/data.length,py=v=>pad.t+(1-v/max)*(H-pad.t-pad.b);
  let grid="",yl="";for(let g=0;g<=4;g++){const v=max*g/4,y=py(v);grid+=`<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="var(--line)"/>`;yl+=`<text x="${pad.l-7}" y="${y+3}" text-anchor="end" font-size="10" fill="var(--text-3)" font-family="var(--f-mono)">${Math.round(v)}</text>`;}
  let bars="",xl="";data.forEach((d,i)=>{const x=pad.l+i*bw+bw*0.18,w=bw*0.64,y=py(d.value),h=(H-pad.b)-y;bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h,0).toFixed(1)}" rx="3" fill="url(#bg)"/>`;xl+=`<text x="${(x+w/2).toFixed(1)}" y="${H-9}" text-anchor="middle" font-size="9" fill="var(--text-3)" font-family="var(--f-mono)">${d.label}</text>`;});
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${opts.c2||'var(--cyan-2)'}"/><stop offset="1" stop-color="${opts.color||'var(--cyan-deep)'}"/></linearGradient></defs>${grid}${yl}${bars}${xl}</svg>`;
}
function isoWeek(iso){const d=new Date(iso+"T00:00:00"),t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const ys=new Date(Date.UTC(t.getUTCFullYear(),0,1));return t.getUTCFullYear()+"-W"+String(Math.ceil((((t-ys)/86400000)+1)/7)).padStart(2,"0");}
/* track renderers */
function emptyMsg(txt){return `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" stroke-linecap="round" stroke-linejoin="round"/></svg><p>${txt}</p></div>`;}
function renderWeight(){
  const arr=[...DB.weight].sort((a,b)=>a.date.localeCompare(b.date)),el=document.getElementById("wChart");
  if(arr.length<1){el.innerHTML=emptyMsg("Log your weight to see your trend against the target band.");document.getElementById("wSub").textContent="—";}
  else{const start=arr[0].v,d0=new Date(arr[0].date+"T00:00:00");function bandAt(wk){let lo=0,hi=0;const rw=Math.min(wk,13);lo+=rw*0.2;hi+=rw*0.5;if(wk>13){lo+=(wk-13)*0.3;hi+=(wk-13)*0.55;}return {lo:start+lo,hi:start+hi};}const band=arr.map(pt=>{const wk=(new Date(pt.date+"T00:00:00")-d0)/(86400000*7),b=bandAt(wk);return {x:pt.date,lo:b.lo,hi:b.hi};});el.innerHTML=lineChart([{points:arr.map(p=>({x:p.date,value:p.v})),color:"var(--gold)",band}],{dec:1});const delta=arr[arr.length-1].v-start;document.getElementById("wSub").textContent=(delta>=0?"+":"")+delta.toFixed(1)+" kg over "+arr.length+" logs";}
  document.getElementById("wList").innerHTML=[...arr].reverse().map(w=>`<div class="log-row"><span class="ld">${fmtShort(w.date)}</span><span class="lv">${w.v}<span style="font-size:10px;color:var(--text-3)">kg</span></span><span class="lx"></span><button class="del" data-delw="${w.date}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`).join("");
  document.querySelectorAll("[data-delw]").forEach(b=>b.addEventListener("click",()=>{DB.weight=DB.weight.filter(x=>x.date!==b.dataset.delw);DB.save();renderWeight();}));
}
function renderMileage(){
  const mEl=document.getElementById("mChart"),lrEl=document.getElementById("lrChart");
  if(!DB.runs.length){mEl.innerHTML=emptyMsg("Log runs in the Run tab to see weekly mileage build.");lrEl.innerHTML=emptyMsg("Your longest run will track here toward the 15-16 km peak.");}
  else{
    const wk={};DB.runs.forEach(r=>{const k=isoWeek(r.date);wk[k]=(wk[k]||0)+r.dist;});const keys=Object.keys(wk).sort().slice(-10);mEl.innerHTML=barChart(keys.map(k=>({label:"W"+k.split("-W")[1],value:Math.round(wk[k])})),{color:"var(--cyan-deep)",c2:"var(--cyan-2)"});
    const lr={};DB.runs.forEach(r=>{const k=isoWeek(r.date);if(!lr[k]||r.dist>lr[k].dist)lr[k]={dist:r.dist,date:r.date};});const lk=Object.keys(lr).sort();lrEl.innerHTML=lk.length>1?lineChart([{points:lk.map(k=>({x:lr[k].date,value:lr[k].dist})),color:"var(--cyan)"}],{dec:1}):emptyMsg("Log runs across 2+ weeks to chart your longest run.");
  }
  document.getElementById("runList").innerHTML=[...DB.runs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map((r,i)=>`<div class="log-row"><span class="ld">${fmtShort(r.date)}</span><span class="lv cyan">${r.dist}<span style="font-size:10px;color:var(--text-3)">km</span></span><span class="lx">${fmtPace(r.time/r.dist)}/km · ${r.type} · ${fmtClock(r.time)}</span><button class="del" data-delr="${r.date}|${r.dist}|${r.time}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`).join("");
  document.querySelectorAll("[data-delr]").forEach(b=>b.addEventListener("click",()=>{const[d,ds,t]=b.dataset.delr.split("|");DB.runs=DB.runs.filter(x=>!(x.date===d&&x.dist==ds&&x.time==t));DB.save();renderMileage();}));
}
function renderPace(){
  const el=document.getElementById("paceChart");
  const easy=DB.runs.filter(r=>r.type==="Easy").sort((a,b)=>a.date.localeCompare(b.date)).map(r=>({x:r.date,value:r.time/r.dist}));
  el.innerHTML=easy.length>1?lineChart([{points:easy,color:"var(--cyan)"}],{fmt:v=>fmtPace(v)}):emptyMsg("Log 2+ easy runs to see your pace improve at the same effort.");
}
function renderStrength(){
  const lifts=[...new Set(DB.lifts.map(l=>l.lift))],sel=document.getElementById("liftSel"),cur=sel.value||lifts[0]||"Bench Press";
  sel.innerHTML=lifts.length?lifts.map(l=>`<option${l===cur?" selected":""}>${l}</option>`).join(""):`<option>Bench Press</option>`;
  sel.onchange=()=>drawLift(sel.value);drawLift(sel.value||cur);
  document.getElementById("liftList").innerHTML=[...DB.lifts].reverse().slice(0,30).map((l,i)=>`<div class="log-row"><span class="ld">${fmtShort(l.date)}</span><span class="lv">${l.w}<span style="font-size:10px;color:var(--text-3)">kg</span>×${l.r}</span><span class="lx">1RM ~${Math.round(e1rm(l.w,l.r))}kg · ${l.lift}</span><button class="del" data-dell="${DB.lifts.length-1-i}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`).join("");
  document.querySelectorAll("[data-dell]").forEach(b=>b.addEventListener("click",()=>{DB.lifts.splice(+b.dataset.dell,1);DB.save();renderStrength();}));
}
function drawLift(lift){
  const el=document.getElementById("liftChart"),rows=DB.lifts.filter(l=>l.lift===lift).sort((a,b)=>a.date.localeCompare(b.date)),byDate={};
  rows.forEach(l=>{const v=e1rm(l.w,l.r);if(!byDate[l.date]||v>byDate[l.date])byDate[l.date]=v;});
  const pts=Object.keys(byDate).sort().map(d=>({x:d,value:Math.round(byDate[d])}));
  el.innerHTML=pts.length>1?lineChart([{points:pts,color:"var(--gold)"}],{dec:0}):emptyMsg("Log this lift on 2+ days to chart your strength curve. In the regain phase it should climb fast.");
}
function renderMeasure(){
  const arr=[...DB.measure].sort((a,b)=>a.date.localeCompare(b.date)),el=document.getElementById("meChart");
  const waist=arr.filter(m=>m.waist!=null).map(m=>({x:m.date,value:m.waist})),arm=arr.filter(m=>m.arm!=null).map(m=>({x:m.date,value:m.arm}));
  el.innerHTML=(waist.length||arm.length)?lineChart([{points:waist,color:"var(--warn)"},{points:arm,color:"var(--cyan)"}],{dec:1}):emptyMsg("Log waist and arm to track muscle vs fat.");
  document.getElementById("meList").innerHTML=[...arr].reverse().map(m=>{const ex=[];if(m.waist)ex.push("W "+m.waist);if(m.arm)ex.push("A "+m.arm);if(m.chest)ex.push("C "+m.chest);if(m.thigh)ex.push("T "+m.thigh);return `<div class="log-row"><span class="ld">${fmtShort(m.date)}</span><span class="lx" style="font-size:13px">${ex.join(" · ")}</span><button class="del" data-delme="${m.date}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;}).join("");
  document.querySelectorAll("[data-delme]").forEach(b=>b.addEventListener("click",()=>{DB.measure=DB.measure.filter(x=>x.date!==b.dataset.delme);DB.save();renderMeasure();}));
}
/* ===== GUIDE ===== */

function winHorizon(){
  const c=compute(),rem=Math.max(0,c.ceilLean-c.leanNow);
  const fast=rem/0.35;
  let lean=c.leanNow,mo=0;
  while(c.ceilLean-lean>0.3&&mo<180){const r=Math.min(0.30,0.30*((c.ceilLean-lean)/4));lean+=r;mo++;}
  return {rem,fast:Math.round(fast),slow:mo,yFast:(fast/12).toFixed(1),ySlow:(mo/12).toFixed(1)};
}
function winStats(){
  const wk=planWeek(),ws=weekStartISO(wk),we=dateAdd(ws,7);
  const lifts=sessionsThisWeek().lifts;
  const wi=DB.weight.filter(x=>x.date>=ws&&x.date<we).length;
  const wa=DB.measure.filter(x=>x.waist!=null&&x.date>=ws&&x.date<we).length;
  const everLift=DB.sessions.length,everW=DB.weight.length,everWa=DB.measure.filter(x=>x.waist!=null).length;
  return {lifts,wi,wa,everLift,everW,everWa,total:everLift+everW+everWa};
}
function winRow(done,need,label,why){
  const ok=done>=need;
  return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)">
    <span style="flex:0 0 22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:${ok?"rgba(74,222,128,.16)":"rgba(255,107,122,.14)"};color:${ok?"var(--go)":"var(--bad)"}">${ok?"✓":"!"}</span>
    <div style="flex:1;min-width:0"><div style="font-weight:600">${label} <span style="color:${ok?"var(--go)":"var(--bad)"};font-family:var(--f-mono)">${done}/${need}</span></div>
    <div style="font-size:12px;color:var(--text-3);line-height:1.45">${why}</div></div></div>`;
}
function winLever(n,title,body){
  return `<div style="display:flex;gap:11px;padding:10px 0;border-bottom:1px solid var(--line)">
    <span style="flex:0 0 26px;height:26px;border-radius:8px;display:grid;place-items:center;font-family:var(--f-mono);font-size:13px;font-weight:700;background:var(--panel-3);color:var(--gold)">${n}</span>
    <div style="flex:1;min-width:0"><div style="font-weight:600;margin-bottom:2px">${title}</div><div style="font-size:13px;color:var(--text-2);line-height:1.5">${body}</div></div></div>`;
}
function winPlanHTML(){
  const c=compute(),h=winHorizon(),w=winStats();
  const wkDone=(w.lifts>=6?1:0)+(w.wi>=3?1:0)+(w.wa>=1?1:0);
  return `<div class="card" style="border-color:rgba(255,197,61,.42);background:linear-gradient(180deg,rgba(255,197,61,.06),transparent 46%)">
  <div class="card-t" style="color:var(--gold)"><span class="ic">${ICON.check}</span>The Win Plan</div>
  <div class="card-st">Everything that decides whether you reach the ceiling — ranked by how much it actually matters, and scored against what you have logged.</div>

  <div class="calc-note" style="margin-top:14px"><b>1 · What winning actually is</b></div>
  <div class="dose-grid" style="margin-top:8px">
    <div class="dose"><div class="dn">The real target</div><div class="dv">${c.ceilLean.toFixed(1)}<small>kg lean · FFMI 25.0</small></div></div>
    <div class="dose"><div class="dn">Standing at</div><div class="dv">${c.leanNow.toFixed(1)}<small>kg lean · ${h.rem.toFixed(1)} to go</small></div></div>
    <div class="dose"><div class="dn">Honest horizon</div><div class="dv">${h.yFast}–${h.ySlow}<small>years of real training</small></div></div>
  </div>
  <div class="calc-note" style="margin-top:10px">102 kg on the scale is the <b>wrapper</b>; ${c.ceilLean.toFixed(0)} kg of lean mass is the <b>prize</b>. The horizon is a bracket, not a promise: ${h.fast} months is the flat-out best case at 0.35 kg of lean per month, ${h.slow} months is what the same effort looks like once deceleration near the ceiling is priced in. Both are honest. Nobody arrives early.</div>

  <div class="calc-note" style="margin-top:16px"><b>2 · The five levers, in order of actual power</b></div>
  <div style="margin-top:4px">
  ${winLever(1,"Years of hard sets — the only irreplaceable input","10–20 hard sets per muscle per week, every week, for years. No supplement, split or trick substitutes for accumulated near-failure work. Your 6-day week already delivers this — attendance is the entire variable.")}
  ${winLever(2,"Progressive overload you can prove","One more rep, one more kilo, cleaner form — logged, so next week has a number to beat. Unlogged training is guessing, and guessing plateaus. This is the single lever the app can enforce, and it needs your numbers to do it.")}
  ${winLever(3,"Protein and a measured surplus","≈185 g protein and a surplus small enough that the waist stays quiet. Bigger surpluses buy fat, not speed — muscle has a maximum build rate and it is not negotiable by eating harder.")}
  ${winLever(4,"Sleep — 7–9 hours, non-negotiable at 38","Growth hormone, testosterone, recovery and appetite regulation all run on sleep. Chronic short sleep measurably blunts muscle gain and raises fat gain on the same diet. A 04:30 start means a lights-out time, not a wish.")}
  ${winLever(5,"Staying uninjured and never fully stopping","At 38 the comeback from a torn or badly strained anything costs months you cannot bank back. Leave 1–2 reps of technical margin on grinding sets; a set that wrecks a shoulder costs more than every set it was meant to add.")}
  </div>

  <div class="calc-note" style="margin-top:16px"><b>3 · This week's non-negotiables — live score ${wkDone}/3</b></div>
  <div style="margin-top:2px">
  ${winRow(w.lifts,6,"Lifting sessions logged","Six sessions, every muscle twice. Missing one is recoverable; missing the log means the week never happened as far as progression is concerned.")}
  ${winRow(w.wi,3,"Weigh-ins logged","Three readings a week, same conditions, so the trend is signal rather than daily noise. This is what tells the app whether the surplus is right.")}
  ${winRow(w.wa,1,"Waist measurement","One number a week at the navel. It is the only brake on aggressive gain — without it, fat creeps in unnoticed until a forced cut costs months.")}
  </div>

  <div class="calc-note" style="margin-top:16px"><b>4 · The decision rules — what changes, and when</b></div>
  <div class="prose" style="margin-top:6px">
    <p>• <b>Waist +3 cm from baseline (+5 cm while Aggressive runs to the March check — the band\u2019s whole fat allowance)</b> → cut 300 kcal from the surplus and hold until it stabilises.</p>
    <p>• <b>Bodyweight up more than 0.5 kg/week for two weeks</b> → surplus is too big; trim 250–300 kcal.</p>
    <p>• <b>Bodyweight flat for three weeks</b> → add 250 kcal, mostly carbs around training.</p>
    <p>• <b>No rep or load PR in a movement for three weeks</b> → add 2–3 sets per week to that muscle, or deload it one week and come back.</p>
    <p>• <b>Estimated body fat above ~20%</b> → 4–6 week mini-cut, then straight back to building. Defending the 18–24% band beats rescuing it later.</p>
    <p>• <b>Two consecutive bad sleep weeks</b> → drop to 4 sessions and fix sleep first. Training harder into a recovery deficit builds nothing.</p>
  </div>

  <div class="calc-note" style="margin-top:16px"><b>5 · The five ways this dies</b></div>
  <div class="prose" style="margin-top:6px">
    <p>• <b>The silent quit.</b> Three missed sessions become three weeks. The counter-move is a floor, not motivation: on a bad day, do the first two exercises and leave.</p>
    <p>• <b>The dirty bulk.</b> Fat gained fast has to come off slowly, and the cut costs more muscle-building weeks than the fast gain ever bought.</p>
    <p>• <b>Junk volume.</b> Sets that stop three reps short feel productive and grow almost nothing. RIR 0–1 on the last set of every exercise is the line.</p>
    <p>• <b>Program hopping.</b> A mediocre plan run for two years beats a perfect plan run for six weeks. This one is chosen — now it gets run.</p>
    <p>• <b>The ego injury.</b> One rep past technical failure on a heavy day can erase a quarter of a year.</p>
  </div>

  ${w.total===0
    ? `<div class="verdict warn" style="margin-top:16px"><b>Verdict: the plan is complete, and it is still theory.</b> Nothing has ever been logged — no set, no weigh-in, no waist. Every engine here (progression, surplus, ceiling tracking, the brake) is idling on defaults, waiting for one real number. The plan does not start when it is perfect. It starts when the first number lands.</div>`
    : `<div class="verdict ok" style="margin-top:16px"><b>Verdict: live.</b> ${w.everLift} session${w.everLift===1?"":"s"}, ${w.everW} weigh-in${w.everW===1?"":"s"} and ${w.everWa} waist reading${w.everWa===1?"":"s"} on record — the engines are running on you, not on defaults. Keep the weekly three at full marks and the ceiling comes to meet you.</div>`}
  </div>`;
}
function fastLegalHTML(){
  const c=compute(),g=gainModel("hyper");
  return `<div class="card" style="border-color:rgba(255,197,61,.42)"><div class="card-t" style="color:var(--gold)"><span class="ic">${ICON.lift}</span>As Fast As Legally Possible \u2014 what that actually means</div>
  <div class="card-st">Your primary directive, taken literally. The honest version has a ceiling, a short list of things that reach it, a longer list that only pretend to, and exactly one legal medical lever.</div>
  <div class="dose-grid" style="margin-top:12px">
    <div class="dose"><div class="dn">Muscle rate ceiling</div><div class="dv">0.25\u20130.5<small>kg lean / month, at 38</small></div></div>
    <div class="dose"><div class="dn">Scale rate that serves it</div><div class="dv">+${gainModel("hyper").rateKgWk.toFixed(2)}<small>kg / week \u00b7 ${bulkMode==="aggr"?(aggrLive()?"Aggressive, to 5\u20137 Mar":"Aggressive, stepped down"):bulkMode+" mode"}</small></div></div>
    <div class="dose"><div class="dn">Protein floor</div><div class="dv">${Math.round(DB.profile.weight*proFactor())}<small>g / day \u00b7 ${proFactor()} g per kg</small></div></div>
  </div>
  <div class="calc-note" style="margin-top:12px"><b>The ceiling is biological, not motivational.</b> Muscle is built by protein synthesis and recovery, and neither can be legally accelerated past roughly half a kilo of lean tissue a month for an intermediate in his late thirties. The fastest legal route is not a secret \u2014 it is simply reaching that ceiling every single week instead of most weeks.</div>
  <div class="calc-note" style="margin-top:10px"><b>What reaches it:</b> six sessions a week with the last set of every exercise at RIR 0\u20131 and the numbers logged \u00b7 ${Math.round(DB.profile.weight*proFactor())} g protein daily \u00b7 a 300\u2013500 kcal surplus (the engine\u2019s Maximum mode already sits at the aggressive edge) \u00b7 7\u20139 hours of sleep \u00b7 creatine 5 g every day, the only supplement with a real size effect \u00b7 caffeine for output on the days that matter \u00b7 protein spread across 4\u20135 feedings of at least 35 g each, not two big ones \u00b7 30\u201340 g slow protein in the 20:00 window \u2014 overnight synthesis is growth you get for free.</div>
  <div class="calc-note" style="margin-top:10px"><b>What only pretends to:</b> a bigger surplus (buys fat, not speed \u2014 and the cut to remove it costs more building weeks than it saved) \u00b7 sets beyond ~20 per muscle per week \u00b7 supplement stacks beyond creatine, caffeine, protein and D3 \u00b7 changing the program.</div>
  <div class="calc-note" style="margin-top:10px"><b>The silent brakes \u2014 things that cost speed without feeling like mistakes:</b> alcohol (a single heavy evening cuts muscle protein synthesis by roughly a quarter, more when it follows training) \u00b7 chronic sleep under 6 hours (less lean gain and more fat gain on the identical diet) \u00b7 under-eating on rest days (muscle is built on the days you don\u2019t train) \u00b7 a protein-free breakfast (the first feeding sets the day\u2019s synthesis floor).</div>
  <div class="calc-note" style="margin-top:10px"><b>The one legal medical lever:</b> a blood panel \u2014 total and free testosterone, TSH, vitamin D, ferritin, HbA1c, lipids (Lancet/Ampath, roughly R1,500\u20133,000). If a doctor finds a clinical deficiency, treating it is legal and can restore a normal gain rate. That is the entire legal pharmacology. Anabolic steroids stay prescription-only under South African law and outside this plan by your own rule.</div>
  <div class="calc-note" style="margin-top:10px"><b>Aggressive mode \u2014 the top of the legal dial:</b> until the <b>5\u20137 March 2027 check</b> the surplus runs at <b>0.48% of bodyweight per week</b> (\u2248 +${(DB.profile.weight*0.0048).toFixed(2)} kg/week, roughly a ${Math.round(DB.profile.weight*0.0048*1100)} kcal surplus) against 0.35% in Maximum. That fills your 18\u201324% band by the checkpoint \u2014 the most aggressive plan that never leaves the band \u2014 and a six-week mini-cut follows the check. The justification is specific: a returning lifter regains lost muscle faster than he builds new muscle, so the first three months tolerate a bigger surplus before it turns to fat. After the March check the engine steps down to Maximum on its own. Protein rises to 2.2 g/kg, the last set of every exercise goes to RIR 0, the first compound gets an extra set, and the waist brake becomes the band itself: +5 cm from baseline, the whole fat allowance between 18% and 24%. This is the most aggressive setting that is still a lean bulk \u2014 anything past it is fat, not speed.</div>
  <div class="verdict ok" style="margin-top:12px"><b>So the plan is already the fastest legal plan.</b> What decides the speed now is not a setting \u2014 it is attendance, logged progression and sleep. Day 1 is ${fmtLong(START_ISO)}.</div></div>`;
}
function weekAvgWeight(ws,we){const a=DB.weight.filter(x=>x.date>=ws&&x.date<we).map(x=>parseFloat(x.v)).filter(v=>v>0);return a.length?a.reduce((p,q)=>p+q,0)/a.length:null;}
function bestE1RMByEx(ws,we){const out={};DB.sessions.filter(x=>x.dateISO>=ws&&x.dateISO<we).forEach(sess=>{Object.entries(sess.entries||{}).forEach(([ex,sets])=>{(sets||[]).forEach(st=>{if(st&&st.r&&st.w){const v=e1rm(st.w,st.r);if(v&&(!out[ex]||v>out[ex]))out[ex]=v;}});});});return out;}
function weeklyReview(){
  const wk=planWeek(),ws=weekStartISO(wk),we=dateAdd(ws,7),pws=dateAdd(ws,-7);
  const lifts=sessionsThisWeek().lifts;
  const wi=DB.weight.filter(x=>x.date>=ws&&x.date<we).length;
  const avgNow=weekAvgWeight(ws,we),avgPrev=weekAvgWeight(pws,ws);
  const rate=(avgNow!=null&&avgPrev!=null)?avgNow-avgPrev:null;
  const target=gainModel("hyper").rateKgWk;const waistLimit=aggrLive()?marchTarget().limit:3;
  const waistAll=DB.measure.filter(x=>x.waist!=null).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const waistD=waistAll.length>1?parseFloat(waistAll[waistAll.length-1].waist)-parseFloat(waistAll[0].waist):null;
  const wAll=DB.weight.map(x=>parseFloat(x.v)).filter(v=>v>0);const estLean=(wAll.length>=2&&waistAll.length>=2)?(wAll[wAll.length-1]-wAll[0])-1.4*(parseFloat(waistAll[waistAll.length-1].waist)-parseFloat(waistAll[0].waist)):null;
  const nowE=bestE1RMByEx(ws,we),prevE=bestE1RMByEx(pws,ws);
  let prs=0,stalls=0;Object.keys(nowE).forEach(ex=>{if(prevE[ex]){if(nowE[ex]>prevE[ex]+0.5)prs++;else stalls++;}});
  const total=DB.sessions.length+DB.weight.length+DB.measure.length;
  const lateWeek=todayISO()>=dateAdd(ws,5);
  let verdict,cls="ok";
  if(total===0){verdict="Nothing logged yet \u2014 there is nothing to review. The engine starts the moment the first set lands.";cls="warn";}
  else if(waistD!=null&&waistD>=waistLimit){verdict="Waist is +"+waistD.toFixed(1)+" cm from baseline (limit +"+waistLimit+" cm in "+(bulkMode==="aggr"?"Aggressive":"this")+" mode) \u2192 cut 300 kcal from the surplus this week and hold until it stabilises.";cls="warn";}
  else if(rate!=null&&rate>target*1.6){verdict="Gaining "+rate.toFixed(2)+" kg/week against a "+target.toFixed(2)+" target \u2192 the surplus is too big; trim 250\u2013300 kcal.";cls="warn";}
  else if(rate!=null&&rate<target*0.25&&wk>=3){verdict="Gaining only "+rate.toFixed(2)+" kg/week against a "+target.toFixed(2)+" target \u2192 add 250 kcal, mostly carbs around training.";cls="warn";}
  else if(estLean!=null&&estLean>=3.3&&waistD!=null&&waistD>=4&&roadmapWeekNow()>=12&&bulkMode!=="cut"){verdict="Lean target banked (\u2248"+estLean.toFixed(1)+" kg estimated from weight minus waist) and the waist has moved +"+waistD.toFixed(1)+" cm \u2192 the cut can start now: switch Numbers to Cut for 4\u20136 weeks, then resume building.";cls="ok";}
  else if((()=>{const sl=DB.sleep.filter(x=>x.date>=dateAdd(todayISO(),-7));return sl.length>=3&&sl.reduce((a,x)=>a+x.h,0)/sl.length<7;})()){const sl=DB.sleep.filter(x=>x.date>=dateAdd(todayISO(),-7));const avg=sl.reduce((a,x)=>a+x.h,0)/sl.length;verdict="Sleep averaged "+avg.toFixed(1)+" h this week \u2192 recovery is the limiter, not the program. Take Friday as a full rest day this week, fix lights-out before adding anything; if it stays under 7 h, step Aggressive down to Maximum.";cls="warn";}
  else if(lifts<6&&lateWeek){verdict=lifts+"/6 sessions this week \u2192 attendance is the limiter, not the program. Protect the six.";cls="warn";}
  else if(stalls>0&&prs===0&&wk>=3){verdict="No e1RM improved on last week \u2192 add 2\u20133 sets to the stalled muscles, or deload them one week and come back.";cls="warn";}
  else verdict="On track. Keep everything; beat last week\u2019s reps.";
  return {wk,lifts,wi,avgNow,avgPrev,rate,target,waistD,prs,stalls,verdict,cls,total,estLean};
}
function weeklyReviewHTML(){
  if(!planStarted())return "";
  const r=weeklyReview();const f=(v,d)=>v==null?"\u2014":(+v).toFixed(d);
  return `<div class="card"><div class="card-t"><span class="ic">${ICON.check}</span>Weekly Review \u2014 Week ${r.wk}</div>
  <div class="card-st">The app reads your log and applies the decision rules itself. One verdict, one adjustment \u2014 nothing to interpret.</div>
  <div class="dose-grid" style="margin-top:10px">
    <div class="dose"><div class="dn">Sessions</div><div class="dv">${r.lifts}<small>of 6 \u00b7 ${r.wi} weigh-ins</small></div></div>
    <div class="dose"><div class="dn">Gain rate</div><div class="dv">${r.rate==null?"\u2014":(r.rate>=0?"+":"")+f(r.rate,2)}<small>kg/wk \u00b7 target +${f(r.target,2)}</small></div></div>
    <div class="dose"><div class="dn">PRs / stalls</div><div class="dv">${r.prs}/${r.stalls}<small>e1RM vs last week</small></div></div>
  </div>
  <div class="verdict ${r.cls}" style="margin-top:10px"><b>Verdict:</b> ${r.verdict}</div></div>`;
}
function currentBlock(){const w=roadmapWeekNow();
  if(w<=16)return {name:"Base block",span:"weeks 1\u201316",i:w,n:16,focus:"Every muscle twice a week. The muscle-memory window \u2014 the fastest gains of the whole arc happen here."};
  const names=["Posterior chain","Legs","Delts & arms","Chest & back width"];const k=Math.floor((w-17)/6),idx=k%4,start=17+k*6;
  return {name:names[idx]+" specialization",span:"weeks "+start+"\u2013"+(start+5),i:w-start+1,n:6,focus:"+30\u201350% sets for "+names[idx].toLowerCase()+" (16\u201320 hard sets), everything else at maintenance (6\u20138). Same total volume, focused recovery budget."};}
function productsCardHTML(){
  const tier=(n,t,eff,body)=>`<div style="padding:11px 0;border-bottom:1px solid var(--line)"><div><b>${n}. ${t}</b></div><div style="font-size:11px;font-family:var(--f-mono);margin-top:3px;color:${eff.startsWith("Large")?"var(--go)":eff.startsWith("Small")?"var(--text-3)":"var(--gold)"}">${eff}</div><div style="font-size:13px;color:var(--text-2);line-height:1.55;margin-top:4px">${body}</div></div>`;
  return `<div class="card" style="border-color:rgba(255,197,61,.42)"><div class="card-t" style="color:var(--gold)"><span class="ic">${ICON.check}</span>Where Money Actually Buys Muscle</div>
  <div class="card-st">Budget is open where quality improves results \u2014 so here is what does, ranked by effect size, with South African prices as seen in Sep 2026 (verify at checkout). The honest headline: the biggest purchase is not a supplement.</div>
  <div style="margin-top:6px">
  ${tier(1,"Load \u2014 raise the ceiling of the home gym","Large effect · if you train at home 3+ days","Your 15 kg dumbbells are the single hardest limit in this whole system. Failure techniques make them grow muscle; they cannot deliver progressive overload on presses, rows or hinges for an 88 kg intermediate for two years.<br><b>The real upgrade:</b> adjustable dumbbells at <b>40 kg per hand</b> (FitArc, Ligum, 1818 Fitness on Takealot) \u2014 roughly R5,000\u20139,000 a pair (listing prices hidden; verify). Retires most of the home substitutions overnight.<br><b>The budget step:</b> a 40 kg spinlock dumbbell + barbell set (20 kg per hand plus a short bar) \u2014 R480 (DMC Wholesale) to R1,300 (Price Experts). A modest step from 15 kg; the bar is the useful part.<br><b>Then:</b> an adjustable bench \u2014 Everlast Power Core bench with bar and 28 kg of plates R3,500 (Everlast SA), plain benches ~R1,500\u20133,000 est. \u2014 unlocks bench, incline, chest-supported rows and seated presses. A doorway pull-up bar (~R300\u2013600 est.) or power tower (~R2,500\u20134,000 est.) gives the vertical pull the home mode currently fakes with pullovers.<br><b>If you train mostly at the commercial gym, skip this tier entirely.</b> The moment anything arrives, say so \u2014 the home mode gets re-cut to the new kit; nothing here is assumed.")}
  ${tier(2,"Tested purity \u2014 batch-certified supplements","Medium · safety and eligibility, not growth","Creatine monohydrate is creatine monohydrate; a certified tub grows exactly as much muscle as a generic one. What certification buys is purity and a clean drug test \u2014 which matters the day you enter a drug-tested SA Powerlifting meet at Melrose. In South Africa: <b>Biogen</b> (Dis-Chem\u2019s brand) runs Informed Sport / Informed Choice certified lines; <b>Myprotein Creatine (Creapure)</b> is Informed Choice certified and ships here. Buy tested, expect no extra growth from it.")}
  ${tier(3,"Better forms \u2014 the upgrades that change absorption","Medium · small but real","<b>Omega-3:</b> a high-EPA/DHA concentrate in triglyceride form, at least 1 g EPA+DHA a day (a generic 1,000 mg fish-oil capsule holds ~300 mg) \u2014 Dis-Chem/Clicks, ~R250\u2013450 a month est. <b>Vitamin D3 with K2</b>, taken with fat \u2014 ~R120\u2013250 est. <b>Magnesium glycinate</b> 300\u2013400 mg before bed for sleep quality, not the cheap oxide form \u2014 ~R150\u2013300 est. <b>Micellar casein</b> for the 20:00 slot (~R400\u2013700/kg est.) or the cheap route, cottage cheese. Whey isolate over concentrate only if lactose bothers you \u2014 there is no growth difference.")}
  ${tier(4,"Food quality \u2014 where it counts","Medium for health · small for muscle","Hitting protein and calories is 95% of it. The upgrades that still matter: oily fish twice a week (pilchards are cheap and genuinely excellent), eggs daily, full-fat dairy to carry the surplus, red meat two or three times a week for creatine, iron, zinc and B12. Grass-fed and organic buy nothing measurable for muscle.")}
  ${tier(5,"Sleep environment \u2014 the cheapest large lever","Large effect · almost free","Blackout curtains, a room at 18\u201320 \u00b0C, the phone charging outside the bedroom, a fixed lights-out that makes 04:30 survivable. Sleep is the lever most people under-buy; it costs less than one month of supplements.")}
  </div>
  <div class="calc-note" style="margin-top:12px"><b>What better products will never do:</b> raise the biological rate ceiling. Every item above either removes a brake or fills a gap \u2014 none of them adds speed beyond the 0.25\u20130.5 kg of lean tissue a month your physiology allows. Spend in this order, log the sessions, and let the Weekly Review tell you whether any of it moved the numbers.</div></div>`;
}
function watchCardHTML(){return `<div class="card"><div class="card-t cyan"><span class="ic">${ICON.check}</span>Connect Apple Watch & Garmin \u2014 the foolproof route</div>
  <div class="card-st">Honest first: a single-file app cannot pair with a watch. HealthKit is native-app-only and Garmin\u2019s API needs an approved server. What works every single time is a two-tap export that the app reads.</div>
  <div class="calc-note" style="margin-top:12px"><b>Step 0 \u2014 Garmin into Apple Health (once):</b> Garmin Connect app \u2192 More \u2192 Settings \u2192 Apple Health \u2192 allow weight, sleep, resting heart rate, steps. From then on the Garmin watch\u2019s data lands in Health alongside the Apple Watch\u2019s.</div>
  <div class="calc-note" style="margin-top:10px"><b>Step 1 \u2014 build the Shortcut (once, ~5 minutes):</b> Shortcuts app \u2192 + \u2192 add these actions in order: <b>Find Health Samples</b> (Type: Weight, Last 7 days) \u2192 <b>Repeat with Each</b> \u2192 inside it, <b>Text</b> with <code>[Start Date formatted yyyy-MM-dd],weight,[Value]</code> \u2192 end repeat \u2192 <b>Combine Text</b> (new lines). Duplicate that block for <b>Sleep Analysis</b> (label <code>sleep</code>, value in hours), <b>Resting Heart Rate</b> (<code>rhr</code>) and <b>Steps</b> (<code>steps</code>). Finish with <b>Combine Text</b> of all four \u2192 <b>Copy to Clipboard</b>. Name it \u201cBlueprint export\u201d and add it to your Home Screen.</div>
  <div class="calc-note" style="margin-top:10px"><b>Step 2 \u2014 every few days:</b> run the Shortcut \u2192 open the app \u2192 Home \u2192 Data card \u2192 paste \u2192 <b>Import pasted data</b>. Weight goes to the log and profile, sleep feeds the Weekly Review\u2019s recovery rule, resting HR and steps show as recovery chips. Duplicates by date are replaced, never doubled.</div>
  <div class="calc-note" style="margin-top:10px"><b>Garmin without an iPhone:</b> Garmin Connect (web) \u2192 Reports \u2192 Health Stats \u2192 export CSV \u2192 the Data card\u2019s <b>Garmin CSV</b> button. Columns are auto-detected (Date, Weight, Resting Heart Rate, Sleep, Steps).</div>
  <div class="calc-note" style="margin-top:10px"><b>Why sleep matters more than the rest:</b> the app now reads it. Under 7 hours averaged over a week, the Weekly Review names recovery as the limiter and tells you to step Aggressive down \u2014 the rule the doctrine promised, now enforced by your own watch.</div></div>`;}
function blockCardHTML(){const b=currentBlock();
  return `<div class="card"><div class="card-t"><span class="ic">${ICON.lift}</span>The Long Game \u2014 how the arc is periodized</div>
  <div class="card-st">Two years is too long to run one identical week. The arc is cut into blocks so recovery is spent where it grows the most.</div>
  <div class="dose-grid" style="margin-top:10px"><div class="dose"><div class="dn">Current block</div><div class="dv" style="font-size:18px">${b.name}</div></div><div class="dose"><div class="dn">Position</div><div class="dv">${b.i}/${b.n}<small>${b.span}</small></div></div></div>
  <div class="calc-note" style="margin-top:10px"><b>Now:</b> ${b.focus}</div>
  <div class="calc-note" style="margin-top:10px"><b>The sequence:</b> Base block, weeks 1\u201316 \u2014 the full 6-day week exactly as written, every muscle twice. Then 6-week <b>specialization blocks</b> rotating Posterior chain \u2192 Legs \u2192 Delts & arms \u2192 Chest & back width, and around again. In a specialization block the emphasized region takes 16\u201320 hard sets a week; everything else drops to a 6\u20138-set maintenance dose that holds size at near-zero recovery cost. Total weekly work stays about the same; the recovery budget stops being spread thin.</div>
  <div class="calc-note" style="margin-top:10px"><b>Why it is faster:</b> muscle grows in proportion to hard sets it can actually recover from. Six days of everything-at-once caps every region at the same modest dose. Focusing the dose on one region for six weeks \u2014 then moving on while it holds \u2014 pushes each region past the plateau it would otherwise sit at. Deload weeks stay exactly where the roadmap puts them (every 6th week); they fall inside blocks and that is fine.</div>
  <div class="calc-note" style="margin-top:10px"><b>Honest caveat:</b> specialization only pays off on a base that is already logged and consistent. Sixteen base weeks first, no exceptions \u2014 and the block order can be re-sequenced by whatever the log shows is lagging.</div></div>`;}
function estimateBF(){const h=parseFloat(DB.profile.height)||177;const rows=[...DB.measure].filter(x=>x.waist!=null&&x.neck!=null&&x.waist>x.neck).sort((a,b)=>String(b.date).localeCompare(String(a.date)));if(!rows.length)return null;const m=rows[0];const bf=495/(1.0324-0.19077*Math.log10(m.waist-m.neck)+0.15456*Math.log10(h))-450;if(!(bf>3&&bf<60))return null;return {bf:Math.round(bf*10)/10,date:m.date,waist:m.waist,neck:m.neck};}
function applyTapeBF(){const e=estimateBF();if(!e){toast("Log waist and neck in Track first");return;}DB.profile.bf=e.bf;DB.save();const el=document.getElementById("pBf");if(el)el.value=e.bf;toast("Body fat set to "+e.bf+"% from tape \u2713",true);if(typeof renderNumbers==="function")renderNumbers();updateHeader();}
function tapeBFHTML(){const e=estimateBF();const cur=parseFloat(DB.profile.bf)||18;
  if(!e)return `<div class="calc-note" style="margin-top:8px"><b>Body fat is still a typed number (${cur}%).</b> Log waist and neck in Track and the app estimates it from tape (US Navy method, \u00b13\u20134%) \u2014 every lean-mass and FFMI figure then runs on a measurement instead of a guess. DEXA remains the gold standard; this is the free version.</div>`;
  const diff=e.bf-cur;return `<div class="calc-note" style="margin-top:8px;border-left:3px solid var(--go);padding-left:10px"><b>Tape estimate: ${e.bf}% body fat</b> (waist ${e.waist} cm, neck ${e.neck} cm, ${fmtDM(e.date)} \u00b7 US Navy method, \u00b13\u20134%). Profile currently ${cur}%${Math.abs(diff)>=0.5?" \u2014 "+(diff>0?"+":"")+diff.toFixed(1)+" points apart":""}.${Math.abs(diff)>=0.5?` <button class="btn btn-gold" style="width:100%;margin-top:8px" onclick="applyTapeBF()">Use the tape estimate</button>`:" \u2713 In sync."}</div>`;}
function setGoalFromFFMI(){const c=compute();const el=document.getElementById("pGoalBf");const gbf=parseFloat(el&&el.value)||DB.profile.goalBf||24;const g=Math.round(c.ceilLean/(1-gbf/100)*10)/10;DB.profile.goal=g;DB.profile.goalBf=gbf;DB.save();const pg=document.getElementById("pGoal");if(pg)pg.value=g;toast("Goal set: "+g+" kg @ "+gbf+"% = FFMI 25.0",true);if(typeof renderNumbers==="function")renderNumbers();updateHeader();}
function winTeaserHTML(){
  const w=winStats(),wkDone=(w.lifts>=6?1:0)+(w.wi>=3?1:0)+(w.wa>=1?1:0);
  return `<div class="card" style="border-color:rgba(255,197,61,.3)"><div class="card-t" style="color:var(--gold)"><span class="ic">${ICON.check}</span>The Win Plan — ${wkDone}/3 this week</div>
  <div class="card-st">Six lifts logged, three weigh-ins, one waist reading. Those three lines are what the whole ${compute().ceilLean.toFixed(0)} kg ceiling run is built on.</div>
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-gold" style="flex:1" onclick="switchView('guide');setTimeout(()=>{const e=document.querySelector('#view-guide .card');if(e)e.scrollIntoView({block:'start',behavior:'smooth'});},120)">Open the full plan</button></div></div>`;
}
function renderGuide(){
  document.getElementById("view-guide").innerHTML=`<h2 class="view-title">The Guide</h2>
  <p class="view-sub">The science behind the build — why the structure looks like this, what the ceiling means, and the honest history of the running era (now retired).</p>
  <div class="note gold" style="margin-top:10px"><b>Mode: Pure Muscle</b> — from 5 Aug the schedule contains lifting only. Passages below that mention the 2-run week describe the retired running plan, kept for the record only.</div>
  ${winPlanHTML()}
  ${fastLegalHTML()}
  ${peakWeekHTML(false)}
  ${watchCardHTML()}
  ${productsCardHTML()}
  ${blockCardHTML()}
  ${restDoctrineHTML()}
  ${regionCardHTML()}
  ${posteriorCardHTML()}
  <div class="card"><div class="card-t"><span class="ic">${ICON.lift}</span>How to Actually Get Stronger Each Week</div><div class="prose" style="margin-top:6px">
    <p>Muscle grows when you ask it to do a little more over time — <b>progressive overload</b>. It's the most important rule in the whole program. In order of priority:</p>
    <p>• <b>Add reps first.</b> Got 6 last week? Aim for 7-8 at the same weight. When you hit the top of the rep range on every set, it's time to add weight.</p>
    <p>• <b>Then add weight.</b> Bump it the smallest amount available (2.5 kg total is plenty) and start again at the bottom of the rep range. This is "double progression" — the backbone of your training. The plate calculator on each Lift day shows exactly what to load.</p>
    <p>• <b>Slow the lowering.</b> Taking 3-4 seconds to lower the weight adds difficulty with no extra load — perfect when you're between jumps.</p>
    <p>• <b>Add range or a set.</b> A slightly deeper squat, or one extra set on a lagging muscle, both add growth stimulus.</p>
    <p><span class="hl">Log everything.</span> The app keeps your last-time numbers next to each lift so you always know the target to beat. The lifter who tracks out-grows the one who guesses — every time.</p>
  </div></div>
  <div class="card"><div class="card-t"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3 8 4-16 3 8h4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Deloads &amp; the Long Game</div><div class="prose" style="margin-top:6px">
    <p>Your 2-year roadmap isn't one endless push. Roughly <b>every 6th week is a deload</b> — half the sets, lighter loads — so your body supercompensates and your joints stay healthy. The roadmap also alternates <span class="hlc">building blocks</span> (small surplus, adding muscle) with short <span class="hlc">mini-cuts</span> (trimming fat so each new block stays lean). This is how natural lifters keep progressing for years instead of stalling or getting fat.</p>
    <p>Re-test your big lifts at the marked milestone weeks, take progress photos every 4 weeks, and get bloodwork twice a year. Data beats the mirror and the scale, both of which lie day to day.</p>
  </div></div>
  <div class="card"><div class="card-t cyan"><span class="ic">${ICON.run}</span>Why Muscle Comes First (and Running Is Trimmed)</div><div class="prose" style="margin-top:6px">
    <p>Training hard for muscle and endurance at the same time creates a real tension scientists call the <b>interference effect</b>: lots of hard running can blunt muscle and strength gains, because the two adaptations pull your body in different directions. You've chosen to <span class="hlc">prioritise muscle</span>, so this plan deliberately tips the balance toward lifting.</p>
    <p><b>How the plan prioritises muscle:</b></p>
    <p>• <b>Four lifting days, two runs.</b> Your chest, back and shoulders are now trained <b>twice a week</b> — the frequency that research shows drives the most growth — while running is cut to the two sessions that matter.</p>
    <p>• <b>Drop the hard running.</b> Tempo and interval sessions are the runs that most interfere with muscle and recovery, so they're gone. What's left is one easy Zone-2 run (almost no interference) and one long run for race endurance.</p>
    <p>• <b>Protect leg day.</b> Your one heavy leg session (Wed) sits four clear days before the long run (Sun) — so your legs are never hammered twice in a row.</p>
    <p>• <b>Eat to grow.</b> With less running burning fuel, your surplus now actually builds muscle. Carbs stay high for four hard lifting days; protein stays at 2 g/kg.</p>
    <p><span class="hl">The honest trade-off:</span> two runs a week is enough to <i>finish</i> the 10 km in good shape, but not to race your fastest — you'd need the harder, higher-volume running for that. You've chosen muscle, so you're trading some race speed for real, faster muscle gain. After race day you drop running entirely and switch to the 6-day program for maximal growth.</p>
  </div></div>
  <div class="card"><div class="card-t"><span class="ic">${ICON.lift}</span>Why You'll Regain Muscle Fast</div><div class="prose" style="margin-top:6px">
    <p>Ten years of training permanently changed your muscle — it added <b>myonuclei</b> (the muscle's growth command-centres) and left an <b>epigenetic memory</b> so your genes stay primed to grow. That's why returning lifters rebuild lost muscle at roughly <span class="hl">double the speed</span> it took to build the first time.</p>
    <p>Seaborne et al. (2018) saw lean mass jump 12.4% over baseline after just 7 weeks of retraining — nearly double the first gain. The rule of thumb: regaining takes about half as long as the layoff, so your ~6-month break means roughly <b>8-14 weeks</b> back to your old peak. Connective tissue lags behind muscle, though — which is why you start lighter and ramp in.</p>
  </div></div>
  <div class="card"><div class="card-t" style="color:var(--go)"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 3h4v4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>How Fast Can You Actually Gain?</div><div class="prose" style="margin-top:6px">
    <p>You want maximum weight gain — so here's the most important truth in this whole app: <span class="hl">muscle has a speed limit, and you can't bribe it with extra food.</span> Your body can only build muscle so fast. Eat more than that and the surplus doesn't become more muscle — it becomes fat.</p>
    <p>Realistic <b>muscle</b> gain rates (not scale weight — actual muscle):</p>
    <p>• <b>A brand-new beginner:</b> ~1-1.5% of bodyweight per month.</p>
    <p>• <b>You, regaining lost muscle:</b> faster than that for a few months, because muscle memory is doing the heavy lifting. This is your golden window — gain aggressively now.</p>
    <p>• <b>Building genuinely new muscle (later):</b> ~0.5% of bodyweight per month, and slowing as you near your ceiling.</p>
    <p>This is why the <b>Maximum Lean Gain engine</b> in Numbers sets a target <i>rate</i>, not just a calorie number — and why it checks your real weight trend. <span class="hlc">The fastest smart bulk is the one where the scale rises at the rate muscle can keep up with.</span> Gaining faster than that just buys you a longer cut later.</p>
    <p><b>Lean bulk vs dirty bulk:</b> a "dirty bulk" (eat everything) gains weight fastest but most of it is fat — you end up bigger but soft, then lose months cutting it off. A controlled surplus gains nearly as much <i>muscle</i> with far less fat. For maximum <i>lean</i> mass over a year, controlled wins every time.</p>
  </div></div>
  <div class="card"><div class="card-t" style="color:var(--go)"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Squeeze Out Every Last Bit of Growth</div><div class="prose" style="margin-top:6px">
    <p>You want to enhance muscle gain and recovery by every means possible. Here's every <span class="hl">legitimate</span> lever, in order of how much it matters — pull all of them and you'll gain as fast as your body naturally can.</p>
    <p>• <b>Sleep — the #1 recovery drug, and it's free.</b> 7-9 hours, every night, consistent times. Muscle is built while you sleep; short-changing it slashes muscle gain, spikes the hormones that store fat, and saps your training. Dark, cool room; no screens late; no caffeine after midday. If you fix one thing, fix this.</p>
    <p>• <b>Recover harder so you can train harder.</b> The faster you recover, the more hard sessions you can stack — and that's what builds muscle. Take a deload week every ~6 weeks, keep stress down (chronic stress raises cortisol, which eats muscle), walk and move on rest days to pump blood to sore muscles, and never train through real pain.</p>
    <p>• <b>Feed the muscle around the clock.</b> Hit your daily protein, but also <i>spread</i> it — ~35-40 g every 3-4 hours keeps muscle-building switched on all day. A serving of dairy or casein before bed feeds you through the night.</p>
    <p>• <b>Fuel your training.</b> Carbs and protein before and after lifting give you the energy to train aggressively and the raw material to rebuild. Your meal plan already times the biggest carb meals around your sessions.</p>
    <p>• <b>Train each muscle twice a week, hard, through a full range</b>, chasing progressive overload relentlessly — beat your log book. That's the entire design of your 4-day split and the aggressive-technique toolkit.</p>
    <p>• <b>Creatine, 5 g a day.</b> The one supplement proven to measurably speed up strength and muscle gain. It's in your Fuel stack.</p>
    <p>• <b>Consistency beats every hack.</b> Months of hitting these unglamorous basics will out-build any clever trick. Show up, log it, recover, repeat.</p>
    <p><span class="hlc">The honest limit:</span> "by any means possible" within natural training still has a ceiling — your ~90 kg lean max. The only things that break past it are anabolic drugs (steroids, SARMs), and this app won't give you protocols for those: they carry serious heart, liver, hormonal and legal risks, and for almost everyone they're not worth it. Everything here is built to take you to your genuine natural maximum, as fast and as safely as it can be done.</p>
  </div></div>
  <div class="card"><div class="card-t cyan"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Session Length &amp; Diminishing Returns</div><div class="prose" style="margin-top:6px">
    <p>You asked the right question: <span class="hl">when does more gym time stop paying?</span> The honest answer, per session, per muscle: most of the growth stimulus comes from your <b>first ~4-8 hard sets</b>; past <b>~10 hard sets for the same muscle</b>, each extra set adds very little except fatigue. That is exactly why this program trains every muscle <b>twice a week in focused sessions</b> instead of one marathon day \u2014 you bank the high-value sets, leave, recover, and come back for another round of high-value sets.</p>
    <p><b>The practical sweet spot is ~45-75 minutes</b> \u2014 not because of the old \u201ccortisol spikes at 60 minutes\u201d gym myth (it doesn\u2019t hold up), but because rep quality and focus fade, and each added set is worth less than the one before. The Time panel on every lift day computes your real number from the actual sets and rests.</p>
    <p><b>Three levers that cut time without cutting growth:</b> (1) <b>rest discipline</b> \u2014 2-3 min on compounds, 60-90s on isolations, policed by the rest timer; loose rests are where sessions bloat, not extra exercises. (2) <b>Superset the isolations</b> in non-competing pairs \u2014 saves 10-15 min with no hypertrophy cost. (3) <b>Know your core:</b> the compounds are ~80% of the result \u2014 on a rushed day, do them plus one isolation and leave with almost everything.</p>
    <p><span class="hlc">What not to do:</span> don\u2019t stretch sessions past ~75-80 min chasing more \u2014 add a set to a lagging muscle on its <i>other</i> weekly session instead. Frequency beats marathon days.</p>
  </div></div>
  <div class="card"><div class="card-t" style="color:var(--gold)"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>At Any Legal Cost — What Money Can Actually Buy</div><div class="prose" style="margin-top:6px">
    <p>Every free lever is already pulled — training, food, sleep, creatine. If you genuinely mean <span class="hl">any legal cost</span>, here is what spending adds, ranked by return:</p>
    <p>• <b>1. Baseline blood panel</b> (testosterone, vitamin D, ferritin, thyroid, HbA1c) at Lancet or Ampath — <i>~R1,500–R3,000, estimate, confirm</i>. Finds the invisible limiters no program can out-train. Retest around week 6.</p>
    <p>• <b>2. DEXA scan — the true lean-mass verdict.</b> Beyond the tape measure: DexaFit Joburg, ProScan Rosebank (quote MTT10 for 10% off), or Body Comp For Life in Rosebank (7-minute scan). <i>Typically ~R1,000–R2,000 private — estimate, confirm when booking.</i> One now + one race week = hard proof the bulk was lean.</p>
    <p>• <b>3. One session with a strength coach</b> to audit your squat, bench, deadlift and press — or film your top sets and review them. The cheapest strength unlock and injury insurance there is.</p>
    <p>• <b>4. A physio budget for the first niggle.</b> Treating a hotspot early costs a tenth of rehabbing an injury and losing a training block.</p>
    <p>• <b>5. Spend on sleep:</b> blackout, cool room, consistent time. The highest-ROI purchase in this list is mostly free.</p>
    <p><span class="hlc">What NOT to buy:</span> more supplements beyond the Fuel stack (marginal at best), gadgets before basics — and anything anabolic. Steroids and SARMs are prescription-only in South Africa, so "at any legal cost" excludes them by your own rule. The natural ceiling in Numbers already assumes every legal lever pulled; past this list, the only currency left is execution.</p>
  </div></div>
  <div class="card"><div class="card-t"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M5 9l3 1M19 9l-3 1M12 22a8 8 0 008-8c0-3-2-5-2-5H6s-2 2-2 5a8 8 0 008 8z" stroke-linecap="round" stroke-linejoin="round"/></svg></span>The Honest Truth About 110 kg</div><div class="prose" style="margin-top:6px">
    <p>Drug-free lifters top out around an <b>FFMI of ~25</b> (Kouri et al., 1995). At 177 cm that's about <span class="hlc">86-94 kg in lean condition</span>. A genuinely lean 110 kg implies an FFMI near 30.5 — only ever documented in steroid users.</p>
    <p>So 110 kg lean isn't a natural target. You can hit 110 on the scale at higher body fat, or chase it over years with pharmacological assistance and real health risks. Aim your natural flag at <span class="hl">~90-95 kg in great shape</span> — a genuinely elite physique you can build and keep. The Numbers tab shows exactly where you sit versus that ceiling.</p>
  </div></div>
  <div class="card"><div class="card-t"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Race-Day Game Plan</div><div class="prose" style="margin-top:6px">
    <p><b>The week before:</b> trust the taper — you can't gain fitness now, only freshness. Sleep well, hydrate, eat carbs. Lay out your kit and pin your number the night before.</p>
    <p><b>Race morning (08h00 start, Newtown):</b> eat a familiar carb breakfast 2-3 hours before. Arrive early. Warm up with 10 minutes easy plus a few strides.</p>
    <p><b>The race itself:</b> go out <span class="hlc">controlled</span> — the most common mistake is starting too fast. Settle into your goal pace, lock in through the middle, and empty the tank over the final 2 km. Your long run peaked at 13 km, well past race distance, so the endurance is there — you trained on 2 runs a week to protect your muscle gain, so today is about finishing strong, not chasing a PB. Remember Joburg's altitude — effort, not the watch, is your guide on the day.</p>
  </div></div>
  <div class="card"><div class="card-t"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16M4 12h16M4 19h10" stroke-linecap="round"/></svg></span>Key References</div><div class="refs" style="margin-top:6px">
    <div class="r"><b>Seaborne et al. (2018)</b> — Epigenetic memory of hypertrophy. <em>Scientific Reports.</em></div>
    <div class="r"><b>Schumann et al. (2022)</b> — Compatibility of concurrent strength &amp; endurance training. <em>Sports Medicine.</em></div>
    <div class="r"><b>Hickson (1980); Coffey &amp; Hawley</b> — The interference effect, foundational &amp; modern.</div>
    <div class="r"><b>Kouri et al. (1995)</b> — Drug-free FFMI ceiling. <em>Clin J Sport Med.</em></div>
    <div class="r"><b>Morton et al. (2018)</b> — Protein &amp; FFM; plateau ~1.6 g/kg/day. <em>Br J Sports Med.</em></div>
    <div class="r"><b>Riegel (1981)</b> — Endurance time-prediction model (used in the predictor).</div>
  </div><div class="disclaimer"><b>Note:</b> Educational information, not medical advice. Build running volume gradually, especially at 85-95 kg, to protect your joints. See a doctor before an aggressive surplus or any new training load if you have health concerns.</div></div>
  <p class="foot-note">The Comeback Blueprint · Strength + Speed · Built for 24 September 2026</p>`;
}
/* ===== INIT ===== */
function safeStep(n,f){try{f();}catch(e){try{window.onerror(n+": "+(e&&e.message||e),"",0,0,e);}catch(_){}}}
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")cloudSaveNow();});window.addEventListener("pagehide",function(){cloudSaveNow();});
safeStep("wireRest",wireRest);safeStep("renderHome",renderHome);safeStep("updateHeader",updateHeader);setTimeout(function(){safeStep("idbBoot",idbBoot);safeStep("cloudBoot",cloudBoot);},600);try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});}catch(e){}document.addEventListener("click",e=>{const r=e.target.closest("#radiusSeg button");if(r&&+r.dataset.r!==radiusKm){radiusKm=+r.dataset.r;persist("cb2_radius",radiusKm);switchView("run");}});document.addEventListener("click",e=>{const f=e.target.closest("#focusSeg button");if(f){const v=f.dataset.fx==="on";if(v!==focusLB){focusLB=v;persist("cb2_focuslb",focusLB);switchView("lift");}}});document.addEventListener("click",e=>{const m=e.target.closest("#marchSeg button");if(m&&m.dataset.mk!==marchKey){marchKey=m.dataset.mk;persist("cb2_march",marchKey);renderHome();updateHeader();toast("March route: "+marchTarget().label,true);}});document.addEventListener("click",e=>{const q=e.target.closest("#fuelQSeg button");if(q&&q.dataset.q!==fuelQ){fuelQ=q.dataset.q;persist("cb2_fuelq",fuelQ);switchView("fuel");}});document.addEventListener("click",e=>{const b=e.target.closest("#locSeg button");if(b&&b.dataset.loc!==LOC){LOC=b.dataset.loc;persist("cb2_loc",LOC);switchView("lift");}});


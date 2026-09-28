(function(END){
// Long-history seed (generated in the page, so the command line stays short). END = the mocked date; data stops the day before.
var B={"ga1":[100.0,[7,7,6,6]],"ga2":[80.0,[11,11,10]],"ga3":[160.0,[14,14,13]],"ga4":[22.5,[14,14]],"ga5":[50.0,[14,14,13]],"ga6":[45.0,[14,14,13]],"ga7":[80.0,[14,14,13,13]],"ga8":[20.0,[11,11,10]],"pa1":[80.0,[7,7,6,6]],"pa2":[50.0,[9,9,8]],"pa3":[10.0,[11,11,10]],"pa4":[30.0,[11,11,10]],"pa5":[15.0,[14,14,13]],"pa6":[10.0,[19,19,18,18]],"pa7":[25.0,[14,14,13]],"la1":[80.0,[9,9,8,8]],"la2":[10.0,[11,11,10]],"la3":[30.0,[11,11,10]],"la4":[30.0,[14,14,13]],"la5":[10.0,[19,19,18]],"la6":[14.0,[11,11,10]],"la7":[16.0,[14,14]],"la8":[30.0,[11,11,10]],"la9":[80.0,[24,24,23]],"gb1":[140.0,[5,5,4,4]],"gb2":[24.0,[11,11,10]],"gb3":[100.0,[14,14,13]],"gb4":[40.0,[14,14,13,13]],"gb5":[120.0,[14,14,13]],"gb6":[60.0,[19,19,18,18]],"gb7":[30.0,[14,14,13]],"gb8":[0.0,[7,7,6]],"gb9":[5.0,[24,24,23]],"pb1":[55.0,[7,7,6,6]],"pb2":[65.0,[9,9,8]],"pb3":[70.0,[11,11,10]],"pb4":[26.0,[11,11,10]],"pb5":[8.0,[19,19,18,18]],"pb6":[25.0,[14,14,13]],"pb7":[0.0,[9,9]],"lb1":[10.0,[9,9,8,8]],"lb2":[65.0,[11,11,10]],"lb3":[34.0,[11,11,10]],"lb4":[25.0,[14,14,13]],"lb5":[25.0,[19,19,18]],"lb6":[25.0,[14,14,13]],"lb7":[20.0,[14,14]],"lb8":[5.0,[14,14,13]],"lb9":[60.0,[24,24,23]],"x1":[20.0,[19,19,18]],"x2":[8.0,[19,19,18]],"x3":[12.0,[11,11,10]],"x4":[20.0,[14,14,13]],"x5":[70.0,[14,14,13]],"x6":[0.0,[14,14,13]]};
var PLAN={legsA:["ga1","ga2","ga3","ga4","ga5","ga6","ga7","ga8"],pushA:["pa1","pa2","pa3","pa4","pa5","pa6","pa7"],pullA:["la1","la2","la3","la4","la5","la6","la7","la8","la9"],legsB:["gb1","gb2","gb3","gb4","gb5","gb6","gb7","gb8","gb9"],pushB:["pb1","pb2","pb3","pb4","pb5","pb6","pb7"],pullB:["lb1","lb2","lb3","lb4","lb5","lb6","lb7","lb8","lb9"],extras:["x1","x2","x3","x4"]};
var SETS={ga1:4,ga7:4,pa1:4,pa6:4,la1:4,gb1:4,gb4:4,gb6:4,pb1:4,pb5:4,lb1:4};
var DOW=["pullA","legsB","pushB","pullB","extras","legsA","pushA"]; // index = (UTC day + 6) % 7 → Mon..Sun
function iso(t){return new Date(t).toISOString().slice(0,10);}
function rnd(i){return ((i*9301+49297)%233280)/233280;}
var D1=Date.UTC(2026,8,12),MIL=Date.UTC(2027,2,6),E=Date.parse(END+"T00:00:00Z"),DAY=864e5;
var W=[],S=[],M=[],SL=[],bw=88,i=0;
for(var t=D1-DAY;t<E;t+=DAY){i++;var w=Math.floor((t-D1)/DAY/7)+1;
  var rate=t<=MIL+13*DAY?0.4:(w<=33?-0.5:0.3);bw+=rate/7;
  if(((t-D1)/DAY)%2===0)W.push({date:iso(t),v:Math.round((bw+(rnd(i)-.5)*.5)*10)/10});
  SL.push({date:iso(t),h:Math.round((6.1+rnd(i*7)*2.2)*10)/10});
  var dow=(new Date(t).getUTCDay()+6)%7;
  if(dow===5&&t>=D1){var c=Math.min(w,27),waist=92+0.12*c-(w>27?0.45*(Math.min(w,33)-27):0)+(w>33?0.1*(w-33):0);
    M.push({date:iso(t),waist:Math.round(waist*10)/10,neck:Math.round((39+0.02*w)*10)/10,arm:Math.round((37+0.04*w)*10)/10,chest:Math.round((104+0.08*w)*10)/10,thigh:Math.round((59+0.05*w)*10)/10});}
  if(t>=D1&&rnd(i*13)>0.08){var day=DOW[dow],dl=(w%6===0),f=(dl?0.65:1)*(1+0.0095*Math.min(w,60)),ent={};
    PLAN[day].forEach(function(ex){var b=B[ex]||[20,[10,10,9]],r=b[1],n=SETS[ex]||r.length||3,wt=b[0]>=10?Math.round(b[0]*f/2.5)*2.5:Math.round(b[0]*f);
      ent[ex]=[];for(var j=0;j<n;j++)ent[ex].push({r:String(Math.max(1,r[Math.min(j,r.length-1)]-(dl?2:0))),w:String(b[0]>0?wt:0)});});
    S.push({id:"lh"+i,dateISO:iso(t),day:day,loc:"gym",entries:ent});}}
var P={cb2_pure:true,cb2_locmig:true,cb2_sessions:S,cb2_weight:W,cb2_sleep:SL,cb2_measure:M};
for(var k in P)localStorage.setItem(k,JSON.stringify(P[k]));
localStorage.setItem("cb2_lastbackup",String(E-3*DAY));
})("__END__");
/* qa/mm_stub.js: a stand-in for window.MuscleMap (vis/threed CONTRACT.md v1.2) used only by the tests. It draws a plain box with role="img" and the
   label (as the real canvas carries them) and records every call in window.__mm.calls.
   window.__mmPick(slot, key) simulates a tap on the figure (one mesh key, as the real module reports it); window.__mmSupported = false makes supported()
   say no; window.__mmThrow = true makes mount() throw; a tiny MM_DATA is defined unless window.__mmNoData is set.
   v1.2: select() takes a key, an array of keys or null and outlines every listed part; selected() returns an array; a select or a view turns the figure
   (a group whose parts mostly face away turns it to the back, and back again) and then calls onSettle({yaw, front}) once, 40 ms later (the end of the turn);
   window.__mmLose(slot, restore) loses the slot's context (the box is hidden, onLost is called) and, when restore is true, brings it back 300 ms later
   (onRestored). A mount replaces a map whose element was thrown away by a re-render, or the map already on that container, and reuses it (recorded as
   "reuse"), as the real module reuses its canvas and WebGL context. */
(function(){var M={calls:[],live:[]};window.__mm=M;if(!window.__mmNoData&&!window.MM_DATA)window.MM_DATA={v:1,mirror:true,stub:true,groups:"body chest delts biceps triceps forearms abs obliques lats midback upperback lowerback glutes quads hamstrings calves".split(" ").map(function(k,i){return {id:i,key:k,name:k};}),n:0,t:0};function rec(n,a){M.calls.push({n:n,a:a,t:Date.now()});}
  var BACK={lats:1,midback:1,upperback:1,lowerback:1,glutes:1,hamstrings:1,calves:1,triceps:1},FRONT={chest:1,delts:0,biceps:1,quads:1,abs:1,obliques:1,forearms:0};
  function facing(keys){var s=0,n=0;keys.forEach(function(k){if(BACK[k]){s++;n++;}else if(FRONT[k]){s--;n++;}});return n?s/n:0;}
  var MMX={supported:function(){rec("supported");return window.__mmSupported!==false;},
    mount:function(el,o){var reused=0;M.live.forEach(function(s){if(!s.dead&&(!s.el.isConnected||s.el===el)){s.dead=true;reused++;if(s.box&&s.box.parentNode)s.box.parentNode.removeChild(s.box);rec("reuse",{slot:s.el.getAttribute("data-gm-fig")});}});
      rec("mount",{reducedMotion:!!(o&&o.reducedMotion),keys:Object.keys((o&&o.values)||{}).sort().join(),values:o&&o.values,colors:o&&o.colors,hasData:!!(o&&o.data),slot:el&&el.getAttribute("data-gm-fig"),reused:reused,cb:{lost:typeof (o&&o.onLost)==="function",restored:typeof (o&&o.onRestored)==="function",settle:typeof (o&&o.onSettle)==="function"}});
      if(window.__mmThrow)throw new Error("stub mount failure");
      var c=document.createElement("div");c.className="mm-stub";c.setAttribute("role","img");c.setAttribute("aria-label",(o&&o.label)||"Muscle map");c.tabIndex=0;c.style.cssText="position:absolute;inset:0;background:repeating-linear-gradient(45deg,#1d2433 0 8px,#222a3d 8px 16px)";el.appendChild(c);
      var st={el:el,o:o,yaw:0,sel:[],dead:false,values:o.values,box:c,lost:false,settles:0};
      function settle(){setTimeout(function(){if(st.dead)return;st.settles++;if(o.onSettle)o.onSettle({yaw:st.yaw,front:Math.cos(st.yaw)>=0});},40);}
      var h={
        update:function(v,x){rec("update",{values:v});st.values=v;if(x){var l=typeof x==="string"?x:x.label;if(l!=null)c.setAttribute("aria-label",l);}},
        select:function(k){var a=k==null?[]:[].concat(k);rec("select",{key:a.length?a[0]:null,keys:a});st.sel=a;var f=facing(a),bk=Math.cos(st.yaw)<0;if(a.length&&f>0&&!bk)st.yaw=Math.PI;else if(a.length&&f<0&&bk)st.yaw=0;settle();},
        selected:function(){return st.sel.slice();},
        view:function(v){rec("view",{v:v});st.yaw=v==="back"?Math.PI:v==="front"?0:+v;settle();},resize:function(){rec("resize");},
        flash:function(k,op){rec("flash",{keys:k,op:op});},spin:function(){rec("spin");settle();},
        destroy:function(){rec("destroy",{slot:el.getAttribute("data-gm-fig")});st.dead=true;if(c.parentNode)c.parentNode.removeChild(c);},
        debug:function(){return {webgl2:true,frames:1,lastMs:0,tris:0,yaw:st.yaw,zoom:1,sel:st.sel.length?st.sel[0]:null,selected:st.sel.length?st.sel[0]:null,selection:st.sel.slice(),lost:st.lost,running:false,pickAt:function(){return null;}};}};
      M.live.push(st);st.h=h;return h;}};
  /* locked, so the real module the build inlines (var MuscleMap = ...) cannot replace the stub */
  Object.defineProperty(window,"MuscleMap",{get:function(){return MMX;},set:function(){},configurable:false});
  function find(slot){for(var i=M.live.length-1;i>=0;i--){var s=M.live[i];if(!s.dead&&s.el.getAttribute("data-gm-fig")===slot)return s;}return null;}
  window.__mmPick=function(slot,key){var s=find(slot);if(!s)return false;s.o.onPick(key);return true;};
  window.__mmLive=function(slot){var s=find(slot);return s?{yaw:s.yaw,sel:s.sel.length?s.sel[0]:null,sels:s.sel.slice(),values:s.values,lost:s.lost,settles:s.settles,label:s.box.getAttribute("aria-label")}:null;};
  window.__mmLose=function(slot,restore){var s=find(slot);if(!s)return false;s.lost=true;s.box.style.visibility="hidden";rec("lost",{slot:slot});if(s.o.onLost)s.o.onLost();
    if(restore)setTimeout(function(){if(s.dead)return;s.lost=false;s.box.style.visibility="";rec("restored",{slot:slot});if(s.o.onRestored)s.o.onRestored();},300);return true;};})();

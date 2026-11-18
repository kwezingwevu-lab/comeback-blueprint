/* MuscleMap: a 3D muscle map you turn with a finger. Hand-written WebGL2, no library, one global.
   Built to CONTRACT.md v1.2: MM_DATA in, MuscleMap.supported() / MuscleMap.mount() out. It never draws text. */
var MuscleMap = (function () {
  "use strict";
  var PI = Math.PI, TAU = PI * 2,
    MAXPX = 2.4e6,                         // drawing-buffer cap, pixels
    ZMAX = 2.5,                            // pinch zoom limit
    FRICTION = 400,                        // ms: time constant of the turn's exponential friction
    TN = Math.tan(12 * PI / 180),          // half the vertical field of view
    SP = Math.sin(.11), CP = Math.cos(.11),// camera pitch: looks slightly down so the floor reads
    DEF = { low: "#8E99B4", mid: "#FFC53D", high: "#42D77D", none: "#5E6A86", body: "#4A5670", select: "#F3F6FC" },   // the theme: steel (nothing yet) -> gold -> green (dose done)
    live = [], hosts = new WeakMap(), meshes = new WeakMap(), sup = null, c2d = null, memo = {},
    RO = new Float64Array(3), RD = new Float64Array(3), TM = new Float64Array(3), TD = new Float64Array(3),
    CI = new Int32Array(3), ST = new Int32Array(3);   // ray scratch: a pick allocates nothing

  // ---------- colour ----------
  function rgb(s) {                        // CSS colour -> [r,g,b] 0..1, sRGB
    var c = memo[s], m, h;
    if (c) return c;
    if ((m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s))) {
      h = m[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      c = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4), 16) / 255];
    } else {
      if (!c2d) { c2d = document.createElement("canvas"); c2d.width = c2d.height = 1; c2d = c2d.getContext("2d"); }
      c2d.clearRect(0, 0, 1, 1); c2d.fillStyle = "#000"; c2d.fillStyle = s; c2d.fillRect(0, 0, 1, 1);
      m = c2d.getImageData(0, 0, 1, 1).data; c = [m[0] / 255, m[1] / 255, m[2] / 255];
    }
    return (memo[s] = c);
  }
  function ramp(t, C) {                    // low (steel) -> mid (gold) -> high (green) along t, mixed in sRGB like a CSS gradient
    if (t == null || t !== t) return rgb(C.none);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var a = rgb(t < .5 ? C.low : C.mid), b = rgb(t < .5 ? C.mid : C.high), k = t < .5 ? t * 2 : t * 2 - 1;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  function tint(v, C) {                    // v1.2: a band (0 steel, 1 gold, 2 green) is that colour exactly; t only dims it a little, never shifts the hue
    var n = v && v.band, t = v && v.t, c, s;
    if (n !== 0 && n !== 1 && n !== 2) return ramp(v ? t : null, C);
    c = rgb(C[["steel", "gold", "green"][n]] || C[["low", "mid", "high"][n]]);
    s = t == null || t !== t ? 1 : .84 + .16 * (t < 0 ? 0 : t > 1 ? 1 : t);
    return [c[0] * s, c[1] * s, c[2] * s];
  }
  function mix(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) if (b[k] != null) o[k] = b[k]; return o; }
  function wrap(a) { return a - TAU * Math.round(a / TAU); }

  // ---------- data: decode, mirror, bin for picking (once per data object) ----------
  function b64(s, T) {
    var bin = atob(s), n = bin.length, u = new Uint8Array(n), w = T.BYTES_PER_ELEMENT, i, t;
    for (i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    if (w > 1 && new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1)       // data is little endian
      for (i = 0; i + w <= n; i += w) { t = u[i]; u[i] = u[i + w - 1]; u[i + w - 1] = t; if (w > 2) { t = u[i + 1]; u[i + 1] = u[i + 2]; u[i + 2] = t; } }
    return new T(u.buffer, 0, n / w | 0);
  }
  function build(d) {
    var m = d && meshes.get(d);
    if (m) return m;
    if (!d || d.v !== 1 || !d.groups || !d.q) throw new Error("MuscleMap: not v1 data");
    var n = d.n | 0, P = b64(d.pos, Uint16Array), N = b64(d.nrm, Int8Array), G = b64(d.gid, Uint8Array), A = d.ao ? b64(d.ao, Uint8Array) : null,
      I = b64(d.idx, d.idx32 ? Uint32Array : Uint16Array), t = Math.min(d.t | 0 || 1e9, I.length / 3 | 0) * 3,
      q = d.q, lo = q.pmin, sc = q.pscale, mir = !!d.mirror, keys = [], names = [], slotOf = {}, idSlot = new Int16Array(256).fill(-1), i, j, k;
    if (!n || !t || P.length < n * 3 || N.length < n * 3 || G.length < n || (A && A.length < n)) throw new Error("MuscleMap: short data");
    d.groups.forEach(function (g) {
      if (slotOf[g.key] == null) { slotOf[g.key] = keys.length; keys.push(g.key); names.push(g.name || g.key); }
      idSlot[g.id & 255] = slotOf[g.key];
    });
    if (slotOf.body == null) { slotOf.body = keys.length; keys.push("body"); names.push("Body"); }
    if (keys.length > 96) throw new Error("MuscleMap: too many groups");

    // vertices: 20 bytes each = position f32 x3, normal i8 x3 (+pad), ao u8, slot u8 (+pad). Mirroring welds the midline.
    var nv = n, map = null, eps = Math.abs(sc[0]) * 1.5 + 1e-7;
    if (mir) { map = new Uint32Array(n); for (i = 0; i < n; i++) map[i] = Math.abs(lo[0] + P[i * 3] * sc[0]) <= eps ? i : nv++; }
    var buf = new ArrayBuffer(nv * 20), f = new Float32Array(buf), s8 = new Int8Array(buf), u8 = new Uint8Array(buf),
      B = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9], rad = 0;
    function put(v, x, y, z, nx, ny, nz, ao, g) {
      f[v * 5] = x; f[v * 5 + 1] = y; f[v * 5 + 2] = z;
      s8[v * 20 + 12] = nx; s8[v * 20 + 13] = ny; s8[v * 20 + 14] = nz; u8[v * 20 + 16] = ao; u8[v * 20 + 17] = g;
      if (x < B[0]) B[0] = x; if (x > B[3]) B[3] = x; if (y < B[1]) B[1] = y; if (y > B[4]) B[4] = y; if (z < B[2]) B[2] = z; if (z > B[5]) B[5] = z;
      if (x * x + z * z > rad) rad = x * x + z * z;
    }
    for (i = 0; i < n; i++) {
      var x = lo[0] + P[i * 3] * sc[0], y = lo[1] + P[i * 3 + 1] * sc[1], z = lo[2] + P[i * 3 + 2] * sc[2],
        nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2], g = idSlot[G[i]];
      if (g < 0) g = slotOf.body;
      if (mir && map[i] === i) { x = 0; if (ny || nz) nx = 0; }             // on the midline the true normal has no x part
      put(i, x, y, z, nx, ny, nz, A ? A[i] : 255, g);
      if (mir && map[i] !== i) put(map[i], -x, y, z, -nx, ny, nz, A ? A[i] : 255, g);
    }
    var ix = new (nv > 65535 ? Uint32Array : Uint16Array)(mir ? t * 2 : t), a, b, c;
    for (i = k = 0; i < t; i += 3) {
      a = I[i]; b = I[i + 1]; c = I[i + 2];
      if (a >= n || b >= n || c >= n) continue;
      ix[k++] = a; ix[k++] = b; ix[k++] = c;
      if (mir && (map[a] !== a || map[b] !== b || map[c] !== c)) { ix[k++] = map[a]; ix[k++] = map[c]; ix[k++] = map[b]; }   // reflected: winding flips
    }
    ix = ix.subarray(0, k);

    // which way each group faces (front +1 .. back -1), so a selection can turn the figure to show it
    var face = null;
    // the pick grid: cells about the size of a triangle pair; a counting sort, no per-cell arrays
    var cs = Math.cbrt(Math.max((B[3] - B[0]) * (B[4] - B[1]) * (B[5] - B[2]), 1e-9) / Math.max(k / 6, 64)),
      gn = [0, 0, 0], glo = [0, 0, 0];
    for (j = 0; j < 3; j++) { gn[j] = Math.min(160, Math.max(1, Math.ceil((B[j + 3] - B[j]) / cs + .001))); glo[j] = B[j] - 1e-6; }
    cs = Math.max(cs, (B[3] - B[0]) / 159.9, (B[4] - B[1]) / 159.9, (B[5] - B[2]) / 159.9) * 1.00001;
    var nc = gn[0] * gn[1] * gn[2], at = new Uint32Array(nc + 1), refs = null, cur = null;
    function cell(v, j) { v = (v - glo[j]) / cs | 0; return v < 0 ? 0 : v >= gn[j] ? gn[j] - 1 : v; }
    function bin(fill) {
      for (var t = 0; t < k; t += 3) {
        var a = ix[t] * 5, b = ix[t + 1] * 5, c = ix[t + 2] * 5,
          i0 = cell(Math.min(f[a], f[b], f[c]), 0), i1 = cell(Math.max(f[a], f[b], f[c]), 0),
          j0 = cell(Math.min(f[a + 1], f[b + 1], f[c + 1]), 1), j1 = cell(Math.max(f[a + 1], f[b + 1], f[c + 1]), 1),
          k0 = cell(Math.min(f[a + 2], f[b + 2], f[c + 2]), 2), k1 = cell(Math.max(f[a + 2], f[b + 2], f[c + 2]), 2), x, y, z, ci;
        for (z = k0; z <= k1; z++) for (y = j0; y <= j1; y++) for (x = i0; x <= i1; x++) {
          ci = (z * gn[1] + y) * gn[0] + x;
          if (fill) refs[cur[ci]++] = t; else at[ci + 1]++;
        }
      }
    }
    bin(0);
    for (i = 0; i < nc; i++) at[i + 1] += at[i];
    refs = new Uint32Array(at[nc]); cur = at.slice(0, nc); bin(1);

    m = { buf: buf, f: f, u8: u8, ix: ix, tris: k / 3, keys: keys, names: names, slotOf: slotOf, body: slotOf.body, face: face, B: B,
      y0: B[1], y1: B[4], rad: Math.sqrt(rad), grid: { lo: glo, n: gn, cs: cs, at: at, refs: refs } };
    meshes.set(d, m);
    return m;
  }

  // Which way each group faces, from +1 (seen only from the front) to -1 (only from behind): straight rays from the front and from
  // the back on a 32 x 64 lattice, counting first hits. Made once per mesh, on the first select(); about 4,000 casts.
  function facing(m) {
    if (m.face) return m.face;
    var B = m.B, F = new Float32Array(m.keys.length), K = new Float32Array(m.keys.length), i, j, s, g;
    for (s = 1; s >= -1; s -= 2) for (j = 0; j < 64; j++) for (i = 0; i < 32; i++) {
      RO[0] = B[0] + (B[3] - B[0]) * (i + .5) / 32; RO[1] = B[1] + (B[4] - B[1]) * (j + .5) / 64; RO[2] = s * (Math.abs(B[s > 0 ? 5 : 2]) + 1);
      RD[0] = 0; RD[1] = 0; RD[2] = -s;
      g = cast(m);
      if (g >= 0) { F[g] += s; K[g]++; }
    }
    for (i = 0; i < F.length; i++) F[i] = K[i] ? F[i] / K[i] : 0;
    return (m.face = F);
  }

  // Nearest front-facing triangle along the ray RO + t*RD (model space): its group slot, or -1. A 3D DDA through the grid.
  function cast(m) {
    var g = m.grid, lo = g.lo, n = g.n, cs = g.cs, at = g.at, refs = g.refs, f = m.f, ix = m.ix, t0 = 0, t1 = 1e30, a, b, i, r, e,
      ox = RO[0], oy = RO[1], oz = RO[2], dx = RD[0], dy = RD[1], dz = RD[2], best = 1e30, hit = -1, U = 0, V = 0;
    for (i = 0; i < 3; i++) {                                                // clip the ray to the grid box
      if (Math.abs(RD[i]) < 1e-12) { if (RO[i] < lo[i] || RO[i] > lo[i] + n[i] * cs) return -1; continue; }
      a = (lo[i] - RO[i]) / RD[i]; b = (lo[i] + n[i] * cs - RO[i]) / RD[i];
      if (a > b) { r = a; a = b; b = r; }
      if (a > t0) t0 = a; if (b < t1) t1 = b;
    }
    if (t0 > t1) return -1;
    for (i = 0; i < 3; i++) {
      a = (RO[i] + RD[i] * t0 - lo[i]) / cs; CI[i] = a < 0 ? 0 : a >= n[i] ? n[i] - 1 : a | 0;
      ST[i] = RD[i] > 1e-12 ? 1 : RD[i] < -1e-12 ? -1 : 0;
      TD[i] = ST[i] ? cs / Math.abs(RD[i]) : 1e30;
      TM[i] = ST[i] ? ((CI[i] + (ST[i] > 0 ? 1 : 0)) * cs + lo[i] - RO[i]) / RD[i] : 1e30;
    }
    for (;;) {
      i = (CI[2] * n[1] + CI[1]) * n[0] + CI[0];
      for (r = at[i], e = at[i + 1]; r < e; r++) {                           // Moller-Trumbore, back faces culled like the drawing
        var t = refs[r], pa = ix[t] * 5, pb = ix[t + 1] * 5, pc = ix[t + 2] * 5, ax = f[pa], ay = f[pa + 1], az = f[pa + 2],
          e1x = f[pb] - ax, e1y = f[pb + 1] - ay, e1z = f[pb + 2] - az, e2x = f[pc] - ax, e2y = f[pc + 1] - ay, e2z = f[pc + 2] - az,
          px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det < 1e-14) continue;
        var tx = ox - ax, ty = oy - ay, tz = oz - az, u = tx * px + ty * py + tz * pz;
        if (u < 0 || u > det) continue;
        var qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = dx * qx + dy * qy + dz * qz;
        if (v < 0 || u + v > det) continue;
        var d = (e2x * qx + e2y * qy + e2z * qz) / det;
        if (d > 0 && d < best) { best = d; hit = t; U = u / det; V = v / det; }
      }
      i = TM[0] < TM[1] ? (TM[0] < TM[2] ? 0 : 2) : (TM[1] < TM[2] ? 1 : 2);
      if (best <= TM[i] || TM[i] > t1) break;                               // the nearest hit is inside the cells walked so far
      CI[i] += ST[i]; TM[i] += TD[i];
      if (CI[i] < 0 || CI[i] >= n[i]) break;
    }
    if (hit < 0) return -1;
    return m.u8[ix[hit + (1 - U - V >= U && 1 - U - V >= V ? 0 : U >= V ? 1 : 2)] * 20 + 17];   // the nearest corner's group
  }

  // ---------- shaders ----------
  var VS = "#version 300 es\nlayout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in float aO;layout(location=3)in float aG;" +
    "uniform mat4 uVP;uniform vec2 uR;uniform vec4 uC[NG],uX[NG];out vec3 vN,vP;out vec4 vC,vX;out float vO;" +
    "void main(){int g=int(aG+.5);vC=uC[g];vX=uX[g];vO=aO;" +
    "vec3 q=aP+aN*(vX.z*.011);" +                                           // a flash swells the muscle a touch (not under reduced motion)
    "vP=vec3(uR.x*q.x+uR.y*q.z,q.y,uR.x*q.z-uR.y*q.x);vN=vec3(uR.x*aN.x+uR.y*aN.z,aN.y,uR.x*aN.z-uR.y*aN.x);" +
    "gl_Position=uVP*vec4(vP,1.);}",
    // Linear light: warm key from the upper left, cool fill from the right, cool rim (Fresnel) from behind, hemisphere ambient x AO.
    FS = "#version 300 es\nprecision highp float;precision highp int;in vec3 vN,vP;in vec4 vC,vX;in float vO;uniform vec3 uE,uS;uniform float uD;uniform int uM;out vec4 o;" +
    "const vec3 K=vec3(-.42,.66,.62),F=vec3(.72,.18,.67),B=vec3(.1,.5,-.86);" +
    "void main(){float s=vC.a,g=min(vX.x+vX.y,1.5);" +
    "if(uM==1){o=vec4(sqrt(vC.rgb)*min(g,1.),s);return;}" +                 // FX target: emissive colour, selection in alpha
    "vec3 n=normalize(vN),v=normalize(uE-vP),a=vC.rgb*(1.-uD*.52*(1.-s));" +
    "float nv=max(dot(n,v),0.),fr=pow(1.-nv,4.),ao=vO,nk=dot(n,K),kd=mix(max(nk,0.),pow(max(nk*.7+.3,0.),2.),.45),fd=pow(dot(n,F)*.5+.5,2.);" +
    "vec3 c=a*(mix(vec3(.03,.034,.048),vec3(.13,.155,.21),n.y*.5+.5)*ao*ao+vec3(1.,.93,.84)*kd*(.3+.7*ao)+vec3(.4,.54,.86)*fd*.15*ao);" +
    "c+=vec3(1.,.95,.88)*pow(max(dot(n,normalize(K+v)),0.),26.)*.2*ao+vec3(.5,.68,1.)*fr*(.25+.5*max(dot(n,B),0.))*ao;" +
    "c+=a*g*(.16+.65*fr)+(uS*(.07+.6*fr)+a*.22)*s;" +                        // trained today / flash: emissive; selected: lifted
    "c=pow(c/(1.+.1*c),vec3(.4545));" +
    "c+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.;o=vec4(c,1.);}",
    // Two small jobs for one quad: the floor (a light pool and a contact shadow), and the FX composite (selection outline + glow halo).
    AVS = "#version 300 es\nlayout(location=0)in vec2 aQ;uniform mat4 uVP;uniform vec4 uF;uniform int uM;out vec2 vU;" +
    "void main(){vU=aQ;gl_Position=uM==0?uVP*vec4(aQ.x*uF.x,uF.y,aQ.y*uF.x,1.):vec4(aQ,0.,1.);}",
    AFS = "#version 300 es\nprecision highp float;precision highp int;in vec2 vU;uniform int uM;uniform sampler2D uT;uniform vec2 uP;uniform vec4 uK;out vec4 o;" +
    "void main(){if(uM==0){float r=length(vU),sh=.62*exp(-r*r*16.),l=.11*smoothstep(1.,.15,r)*(1.-sh);o=vec4(vec3(.5,.66,1.)*l,l+sh);return;}" +
    "vec2 t=vU*.5+.5;vec4 c=texture(uT,t);float m=c.a;" +
    "for(int i=0;i<8;i++){float a=float(i)*.7853982;m=max(m,texture(uT,t+vec2(cos(a),sin(a))*uP).a);}" +
    "float e=clamp((m-c.a)*1.6,0.,1.)*uK.a;" +
    "vec3 b=textureLod(uT,t,2.).rgb*.3+textureLod(uT,t,3.5).rgb*.35+textureLod(uT,t,5.).rgb*.35;b=max(b*.95-c.rgb*.75,0.)*1.15;" +
    "float h=min(max(b.r,max(b.g,b.b)),1.)*(1.-e);o=vec4(uK.rgb*e+b*(1.-e),e+h);}";

  function program(gl, vs, fs, names) {
    var p = gl.createProgram(), u = { p: p }, sh = [gl.VERTEX_SHADER, vs, gl.FRAGMENT_SHADER, fs], i, s;
    for (i = 0; i < 4; i += 2) { s = gl.createShader(sh[i]); gl.shaderSource(s, sh[i + 1]); gl.compileShader(s); gl.attachShader(p, s); gl.deleteShader(s); }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error("MuscleMap: shader " + gl.getProgramInfoLog(p));
    names.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
    return u;
  }

  // ---------- one mounted map ----------
  function create(host, o, sp) {                 // sp: the canvas and context of a map mount() just replaced, reused (WebKit counts lost contexts until GC)
    var mesh = build(o.data), msaa = o.antialias !== false, re = sp && sp.aa === msaa && !sp.gl.isContextLost(),
      cv = re ? sp.cv : document.createElement("canvas"),
      gl = re ? sp.gl : cv.getContext("webgl2", { alpha: true, antialias: msaa, depth: true, stencil: false, premultipliedAlpha: true });
    if (re) sp.used = 1;
    if (!gl) throw new Error("MuscleMap: no WebGL2 context");
    var NG = mesh.keys.length, C = mix(DEF, o.colors), values = o.values || {}, onPick = o.onPick,
      IT = mesh.ix.BYTES_PER_ELEMENT === 4 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null,
      um, ua, vm, vq, vb, ib, qb, fb = null, ft = null, fd = null, fw = 0, fh = 0, fok = false, aa = 0,
      // palette: rgb (linear) + selection weight per group, now / from / to; ext: x = glow, y = flash
      pal = new Float32Array(NG * 4), p0 = new Float32Array(NG * 4), p1 = new Float32Array(NG * 4), ext = new Float32Array(NG * 4),
      e0 = new Float32Array(NG), e1 = new Float32Array(NG), fS = new Float32Array(NG), fD = new Float32Array(NG), fT = new Float64Array(NG),
      selC = new Float32Array(3), dim = 0, dim0 = 0, dim1 = 0, pon = false, pt0 = 0, sl = [], sm = new Uint8Array(NG), tapS = [], owe = 0, due = 0,
      vp0 = new Float32Array(16), vp = new Float32Array(16), ey = 0, ez = 1, asp = 1, ppu = 100, cw = 0, ch = 0,
      yaw = 0, yon = false, ya = 0, yb = 0, yt0 = 0, yd = 480, ye = 0,           // eased turn
      ion = false, iv = 0, iy = 0, it0 = 0,                                      // inertia
      son = false, st0 = 0,                                                      // idle sway
      zoom = 1, ox = 0, oy = 0, zon = false, za = 1, xa = 0, yz = 0, zt0 = 0,    // zoom and its pan (in clip units)
      pid = [-1, -1], px = [0, 0], py = [0, 0], mode = 0, sx = 0, sy = 0, lx = 0, pd = 1, pmx = 0, pmy = 0, rl = 0, rt = 0,
      smp = new Float64Array(16), sn = 0, tapT = -1e9, tapX = 0, tapY = 0,       // last 8 (time, yaw) samples of a drag
      raf = 0, dead = false, lost = false, vis = true, dirty = false, seen = false, frames = 0, lastMs = 0, L = [], ro = null, io = null, self;

    function rm() { return o.reducedMotion === true || !!(mq && mq.matches); }
    function on(t, type, fn, opt) { t.addEventListener(type, fn, opt); L.push([t, type, fn, opt]); }
    function call(f, a) { if (f && !dead) try { f(a); } catch (e) { setTimeout(function () { throw e; }); } }   // a host callback cannot stop the map
    function settle() { owe = 0; call(o.onSettle, { yaw: wrap(yaw), front: Math.cos(yaw) >= 0 }); }
    function rest() { if (owe && !son && !ion && !yon && pid[0] < 0 && pid[1] < 0) settle(); }   // a turn that was cut short still reports where it stopped

    // ----- GL objects (made again after a restored context) -----
    function init() {
      um = program(gl, VS.replace(/NG/g, NG), FS, ["uVP", "uR", "uC", "uX", "uE", "uS", "uD", "uM"]);
      ua = program(gl, AVS, AFS, ["uVP", "uF", "uM", "uT", "uP", "uK"]);
      vm = gl.createVertexArray(); gl.bindVertexArray(vm);
      vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, mesh.buf, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 20, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.UNSIGNED_BYTE, true, 20, 16);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.UNSIGNED_BYTE, false, 20, 17);
      ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.ix, gl.STATIC_DRAW);
      vq = gl.createVertexArray(); gl.bindVertexArray(vq);
      qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      fb = ft = fd = null; fw = fh = 0;
      gl.depthFunc(gl.LEQUAL); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
      aa = gl.getParameter(gl.SAMPLES) | 0;
    }
    function free() {
      [um && um.p, ua && ua.p].forEach(function (p) { if (p) gl.deleteProgram(p); });
      [vb, ib, qb].forEach(function (b) { if (b) gl.deleteBuffer(b); });
      [vm, vq].forEach(function (v) { if (v) gl.deleteVertexArray(v); });
      if (fb) { gl.deleteFramebuffer(fb); gl.deleteTexture(ft); gl.deleteRenderbuffer(fd); }
      um = ua = vb = ib = qb = vm = vq = fb = ft = fd = null;
    }
    function fxTarget(w, h) {                    // half-size colour + depth target for the outline and the glow halo
      if (fb && fw === w && fh === h) return fok;
      if (!fb) { fb = gl.createFramebuffer(); ft = gl.createTexture(); fd = gl.createRenderbuffer(); }
      gl.bindTexture(gl.TEXTURE_2D, ft); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindRenderbuffer(gl.RENDERBUFFER, fd); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ft, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, fd);
      fw = w; fh = h; fok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      return fok;
    }

    // ----- camera: fits the figure's bounding cylinder to the canvas at any aspect; zoom is a magnification about a point -----
    function camera() {
      var hh = (mesh.y1 - mesh.y0) / 2, r = mesh.rad, n, fr, A, k,
        dist = Math.max(hh * 1.1 / TN, r * 1.06 / (TN * asp)) + r * .55;
      ey = (mesh.y0 + mesh.y1) / 2 - hh * .035 + dist * SP; ez = dist * CP; k = SP * ey + CP * ez;
      n = Math.max(dist - r * 2.2, .05); fr = dist + r * 2.2; A = (fr + n) / (n - fr);
      vp0.fill(0);
      vp0[0] = 1 / (TN * asp); vp0[5] = CP / TN; vp0[9] = -SP / TN; vp0[13] = (SP * ez - CP * ey) / TN;
      vp0[6] = A * SP; vp0[10] = A * CP; vp0[14] = 2 * fr * n / (n - fr) - A * k;
      vp0[7] = -SP; vp0[11] = -CP; vp0[15] = k;
      ppu = ch / (2 * TN * dist);
      lens();
    }
    function lens() {
      var m = zoom - 1, i;
      ox = ox < -m ? -m : ox > m ? m : ox; oy = oy < -m ? -m : oy > m ? m : oy;   // the picture always covers the canvas
      vp.set(vp0);
      for (i = 0; i < 16; i += 4) { vp[i] = zoom * vp0[i] + ox * vp0[i + 3]; vp[i + 1] = zoom * vp0[i + 1] + oy * vp0[i + 3]; }
    }
    function zoomTo(z, mx, my, qx, qy) {         // keep the point that was under (qx,qy) under (mx,my), clip units
      z = z < 1 ? 1 : z > ZMAX ? ZMAX : z;
      var cx = (qx - ox) / zoom, cy = (qy - oy) / zoom;
      zoom = z; ox = mx - cx * z; oy = my - cy * z; zon = false; lens(); kick();
    }
    function size() {
      var w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) { cw = 0; return false; }
      var dpr = Math.min(window.devicePixelRatio || 1, 3), d = dpr * (aa > 1 ? 1 : dpr < 2 ? 2 : 1.5),   // no MSAA: supersample instead
        W = Math.round(w * d), H = Math.round(h * d), k = W * H / MAXPX;
      if (k > 1) { k = Math.sqrt(k); W = W / k | 0; H = H / k | 0; }
      var ch0 = cv.width !== W || cv.height !== H || w !== cw || h !== ch;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      cw = w; ch = h; asp = w / h; camera();
      return ch0;
    }

    // ----- drawing -----
    function draw() {
      if (dead || lost || !cw) return;
      var t = performance.now(), W = cv.width, H = cv.height, n = mesh.ix.length, i, fx = dim > .004;
      for (i = 0; i < NG && !fx; i++) fx = ext[i * 4] + ext[i * 4 + 1] > .004;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(ua.p); gl.bindVertexArray(vq); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND);
      gl.uniformMatrix4fv(ua.uVP, false, vp); gl.uniform4f(ua.uF, mesh.rad * 1.3, mesh.y0, 0, 0); gl.uniform1i(ua.uM, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.useProgram(um.p); gl.bindVertexArray(vm); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.uniformMatrix4fv(um.uVP, false, vp); gl.uniform2f(um.uR, Math.cos(yaw), Math.sin(yaw)); gl.uniform4fv(um.uC, pal); gl.uniform4fv(um.uX, ext);
      gl.uniform3f(um.uE, 0, ey, ez); gl.uniform3fv(um.uS, selC); gl.uniform1f(um.uD, dim); gl.uniform1i(um.uM, 0);
      gl.drawElements(gl.TRIANGLES, n, IT, 0);
      if (fx && fxTarget(W >> 1 || 1, H >> 1 || 1)) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, fw, fh); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform1i(um.uM, 1); gl.drawElements(gl.TRIANGLES, n, IT, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
        gl.bindTexture(gl.TEXTURE_2D, ft); gl.generateMipmap(gl.TEXTURE_2D);
        gl.useProgram(ua.p); gl.bindVertexArray(vq); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND);
        i = .8 * W / cw;                                                     // outline width: about 1.6 CSS px, in half-size texels
        gl.uniform1i(ua.uM, 1); gl.uniform2f(ua.uP, i / fw, i / fh); gl.uniform4f(ua.uK, selC[0], selC[1], selC[2], dim);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      frames++; lastMs = performance.now() - t;
    }

    // ----- the clock: everything that moves is a function of the frame's timestamp, never of a frame count -----
    function step(now) {
      var mv = false, u, k, i;
      if (son) {
        if (st0 < 0) st0 = now;
        u = (now - st0) / 5200;
        if (u >= 1) { son = false; yaw = 0; due = 1; } else { yaw = .5 * Math.sin(3 * PI * u) * Math.sin(PI * u); mv = true; }
      }
      if (yon) {
        if (yt0 < 0) yt0 = now;
        u = Math.min((now - yt0) / yd, 1); k = ye ? (u < .5 ? 4 * u * u * u : 1 - Math.pow(2 - 2 * u, 3) / 2) : 1 - Math.pow(1 - u, 3);
        yaw = ya + (yb - ya) * k;
        if (u >= 1) { yon = false; yaw = wrap(yaw); due = 1; } else mv = true;
      }
      if (ion) {                                                             // closed form: v(t) = v0 e^(-t/T), so 60 and 120 Hz agree
        if (it0 < 0) it0 = now;
        u = Math.exp((it0 - now) / FRICTION); yaw = iy + iv * FRICTION * (1 - u);
        if (Math.abs(iv) * u < 3e-5) { ion = false; yaw = wrap(yaw); due = 1; } else mv = true;
      }
      if (zon) {
        if (zt0 < 0) zt0 = now;
        u = Math.min((now - zt0) / 380, 1); k = 1 - Math.pow(1 - u, 3);
        zoom = za + (1 - za) * k; ox = xa * (1 - k); oy = yz * (1 - k); lens();
        if (u >= 1) zon = false; else mv = true;
      }
      if (pon) {
        if (pt0 < 0) pt0 = now;
        u = Math.min((now - pt0) / 250, 1); k = u * u * (3 - 2 * u);
        for (i = 0; i < pal.length; i++) pal[i] = p0[i] + (p1[i] - p0[i]) * k;
        for (i = 0; i < NG; i++) ext[i * 4] = e0[i] + (e1[i] - e0[i]) * k;
        dim = dim0 + (dim1 - dim0) * k;
        if (u >= 1) pon = false; else mv = true;
      }
      for (i = 0; i < NG; i++) if (fS[i]) {
        if (fT[i] < 0) fT[i] = now;
        u = (now - fT[i]) / fD[i];
        if (u >= 1) fS[i] = ext[i * 4 + 1] = ext[i * 4 + 2] = 0;
        else if (rm()) { ext[i * 4 + 1] = fS[i] * .6; ext[i * 4 + 2] = 0; mv = true; }      // reduced motion: a steady highlight, same length
        else { k = Math.sin(PI * Math.max(1, Math.round(fD[i] / 400)) * u); ext[i * 4 + 1] = ext[i * 4 + 2] = fS[i] * k * k * (1 - .3 * u); mv = true; }
      }
      return mv;
    }
    function gone() { if (cv.isConnected) { seen = true; return false; } return seen; }
    function frame(now) {
      raf = 0;
      if (dead) return;
      if (gone()) return destroy();
      var mv = step(now);
      draw();
      if (mv) kick(); else dirty = false;
      if (due) { due = 0; if (!son && !ion && !yon) settle(); }
    }
    function kick() { dirty = true; if (!raf && !dead && !lost && vis && !document.hidden) raf = requestAnimationFrame(frame); }
    function pause() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function halt() { if (son || ion || yon) owe = 1; son = ion = yon = zon = false; }

    // ----- values -> colours -----
    function target(snap) {
      var i, k, v, c;
      p0.set(pal); dim0 = dim;
      for (i = 0; i < NG; i++) {
        k = mesh.keys[i]; v = values[k]; e0[i] = ext[i * 4];
        c = C[k] ? rgb(C[k]) : tint(v, C);
        p1[i * 4] = Math.pow(c[0], 2.2); p1[i * 4 + 1] = Math.pow(c[1], 2.2); p1[i * 4 + 2] = Math.pow(c[2], 2.2); p1[i * 4 + 3] = sm[i];
        e1[i] = v && v.glow > 0 && !C[k] ? Math.min(+v.glow, 1) : 0;
      }
      c = rgb(C.select); for (i = 0; i < 3; i++) selC[i] = Math.pow(c[i], 2.2);
      dim1 = sl.length ? 1 : 0;
      if (snap) { pon = false; pal.set(p1); for (i = 0; i < NG; i++) ext[i * 4] = e1[i]; dim = dim1; return; }   // the mount draws at once
      pon = true; pt0 = -1;                                                   // a cross-fade is not motion
      kick();
    }
    function aim() { return yon ? yb : yaw; }
    function view(v) {
      halt();
      var to = v === "front" ? 0 : v === "back" ? PI : +v || 0;
      to += TAU * Math.round((yaw - to) / TAU);                               // the short way round
      if (rm()) { yaw = wrap(to); settle(); } else { ya = yaw; yb = to; yt0 = -1; yd = 480; ye = 0; yon = true; }
      kick();
    }
    function unzoom() {
      if (zoom === 1) return;
      if (rm()) { zoom = 1; ox = oy = 0; lens(); } else { za = zoom; xa = ox; yz = oy; zt0 = -1; zon = true; }
      kick();
    }
    function setSel(a, turn) {                   // a: slot or slots; every part listed is outlined together. Returns true if it turns.
      var n = [], fc = 0, j, i, F;
      a = [].concat(a);
      for (j = 0; j < a.length; j++) { i = a[j]; if (i >= 0 && i < NG && i !== mesh.body && n.indexOf(i) < 0) n.push(i); }
      if (n.join() !== sl.join()) { sl = n; sm.fill(0); for (j = 0; j < n.length; j++) sm[n[j]] = 1; target(); }
      if (turn && n.length) { F = facing(mesh); for (j = 0; j < n.length; j++) fc += F[n[j]] / n.length; }   // the group's mean facing
      if (Math.abs(fc) > .3 && fc * Math.cos(aim()) < 0) { view(fc > 0 ? 0 : PI); return true; }
      return false;
    }
    function keys() { return sl.map(function (i) { return mesh.keys[i]; }); }
    function tell() { if (onPick) onPick(sl.length ? mesh.keys[sl[0]] : null); }

    // ----- picking: CPU ray against the decoded mesh -----
    function ray(x, y) {                         // canvas point (CSS px) -> the eye ray in model space, in RO / RD
      var nx = (x / cw * 2 - 1 - ox) / zoom, ny = (1 - y / ch * 2 - oy) / zoom, c = Math.cos(yaw), s = Math.sin(yaw),
        dx = nx * TN * asp, dy = CP * ny * TN - SP, dz = -SP * ny * TN - CP;
      RO[0] = -s * ez; RO[1] = ey; RO[2] = c * ez;
      RD[0] = c * dx - s * dz; RD[1] = dy; RD[2] = s * dx + c * dz;
    }
    function pick(x, y) { if (!cw) return -1; ray(x, y); return cast(mesh); }
    function pickNear(x, y, r) {                 // a fingertip is blunt: look around it before calling it a miss
      var i = pick(x, y), j, k, a;
      if (r && (i < 0 || i === mesh.body)) for (j = 0; j < 16; j++) {
        a = j * PI / 4; k = pick(x + Math.cos(a) * (j < 8 ? r / 2 : r), y + Math.sin(a) * (j < 8 ? r / 2 : r));
        if (k >= 0 && k !== mesh.body) return k;
      }
      return i;
    }

    // ----- pointers: one finger turns (or scrolls the page if it starts vertical), two fingers zoom and pan -----
    function slot(e) { return e.pointerId === pid[0] ? 0 : e.pointerId === pid[1] ? 1 : -1; }
    function grab(id, g) { try { if (g) cv.setPointerCapture(id); else cv.releasePointerCapture(id); } catch (_) { /* a synthetic or ended pointer */ } }
    function mid() {
      pd = Math.hypot(px[0] - px[1], py[0] - py[1]) || 1;
      pmx = ((px[0] + px[1]) / 2 - rl) / cw * 2 - 1; pmy = 1 - ((py[0] + py[1]) / 2 - rt) / ch * 2;
    }
    function down(e) {
      if (e.pointerType === "mouse" && e.button) return;
      var i = pid[0] < 0 ? 0 : pid[1] < 0 ? 1 : -1, r;
      if (i < 0) return;
      pid[i] = e.pointerId; px[i] = e.clientX; py[i] = e.clientY;
      halt();
      if (pid[0] >= 0 && pid[1] >= 0) { r = cv.getBoundingClientRect(); rl = r.left; rt = r.top; mode = 2; grab(pid[0], 1); grab(pid[1], 1); mid(); }
      else { mode = 0; sx = lx = e.clientX; sy = e.clientY; sn = 0; }
    }
    function move(e) {
      var i = slot(e), x = e.clientX, d, qx, qy;
      if (i < 0 || mode === 3) return;
      if (mode === 2) {
        px[i] = x; py[i] = e.clientY; d = pd; qx = pmx; qy = pmy; mid();
        zoomTo(zoom * pd / d, pmx, pmy, qx, qy);
        return;
      }
      if (!mode) {
        d = Math.abs(x - sx); qy = Math.abs(e.clientY - sy);
        if (d < 6 && qy < 6) return;
        if (qy > d) { mode = 3; return; }                                    // it started vertical: the page's gesture
        mode = 1; lx = x; grab(pid[i], 1); cv.style.cursor = "grabbing";
      }
      yaw += (x - lx) / (.42 * ppu * zoom); lx = x; owe = 1;                 // the surface follows the finger
      smp[(sn & 7) * 2] = e.timeStamp; smp[(sn & 7) * 2 + 1] = yaw; sn++;
      kick();
    }
    function up(e) {
      var i = slot(e), was = mode, r, x, y, k, j, t, v;
      if (i < 0) return;                                                     // window level: a release anywhere clears its pointer (v1.2)
      k = pid[i]; pid[i] = -1; grab(k, 0); cv.style.cursor = "grab";
      mode = pid[0] < 0 && pid[1] < 0 ? 0 : 3;                                // a finger left over from a pinch does nothing more
      if (was === 1) {                                                       // fling: velocity over the last 100 ms of pointer timestamps
        k = sn - 1; t = smp[(k & 7) * 2];
        for (j = k; j > k - 8 && j >= 0 && t - smp[(j & 7) * 2] <= 100; j--) i = j;
        v = k > i && t - smp[(i & 7) * 2] > 4 ? (smp[(k & 7) * 2 + 1] - smp[(i & 7) * 2 + 1]) / (t - smp[(i & 7) * 2]) : 0;
        if (e.type !== "pointerup" || e.timeStamp - t > 60 || rm()) v = 0;   // the finger had stopped, or the gesture was taken away
        v = v > .02 ? .02 : v < -.02 ? -.02 : v;
        if (Math.abs(v) > 3e-4) { iv = v; iy = yaw; it0 = -1; ion = true; kick(); } else yaw = wrap(yaw);
      } else if (!was && e.type === "pointerup" && e.target === cv) {       // a tap
        r = cv.getBoundingClientRect(); x = e.clientX - r.left; y = e.clientY - r.top;
        if (e.timeStamp - tapT < 320 && Math.hypot(x - tapX, y - tapY) < 30) {   // double tap: home, and the selection as it was before the first tap
          tapT = -1e9; k = tapS.join() !== sl.join(); setSel(tapS); if (k) tell(); view(0); unzoom(); return;
        }
        tapT = e.timeStamp; tapX = x; tapY = y; tapS = sl.slice();
        k = pickNear(x, y, e.pointerType === "touch" ? 12 : 0);
        setSel(k >= 0 && sm[k] ? [] : k); tell();
      }
      rest();
    }
    function wheel(e) {                          // a trackpad pinch arrives as ctrl + wheel
      if (!e.ctrlKey) return;
      e.preventDefault(); halt();
      var r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) / cw * 2 - 1, my = 1 - (e.clientY - r.top) / ch * 2;
      zoomTo(zoom * Math.exp(-e.deltaY * .01), mx, my, mx, my); rest();
    }
    function key(e) {
      var k = e.key, i, n;
      if (k === "ArrowLeft" || k === "ArrowRight") view(aim() + (k === "ArrowLeft" ? -PI : PI) / 12);
      else if (k === "Enter" || k === " ") {
        for (n = 0, i = sl.length ? sl[sl.length - 1] : -1; n < NG; n++) { i = (i + (e.shiftKey ? NG - 1 : 1) + (i < 0 && e.shiftKey ? 1 : 0)) % NG; if (i !== mesh.body) break; }
        halt(); setSel(i, 1); tell();
      }
      else if (k === "Escape" && sl.length) { setSel([]); tell(); }
      else if (k === "+" || k === "=") { halt(); zoomTo(zoom * 1.25, 0, 0, 0, 0); }
      else if (k === "-") { halt(); zoomTo(zoom / 1.25, 0, 0, 0, 0); }
      else if (k === "0" || k === "Home") { view(0); unzoom(); }
      else return;
      e.preventDefault(); rest();
    }
    function ring(e) {
      var show = e.type === "focus";
      try { show = show && cv.matches(":focus-visible"); } catch (_) { /* older engines: show it on every focus */ }
      cv.style.outline = show ? "2px solid " + C.select : "none";
    }

    function release() { var x = gl.getExtension("WEBGL_lose_context"); if (x && !gl.isContextLost()) x.loseContext(); }
    function destroy(keep) {                     // keep (mount() only): hand the context to the next map instead of losing it
      if (dead) return;
      dead = true; pause();
      if (ro) ro.disconnect(); if (io) io.disconnect();
      L.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); L.length = 0;
      free();
      keep = keep && !gl.isContextLost();
      if (!keep) release();                                                  // hand the GPU memory back now, not at garbage collection
      if (cv.parentNode) cv.parentNode.removeChild(cv);
      cv.width = cv.height = 1;
      live.splice(live.indexOf(rec), 1); if (hosts.get(host) === rec) hosts.delete(host);
      return keep ? { cv: cv, gl: gl, aa: msaa, lose: release } : null;
    }

    // ----- mount -----
    cv.width = 320; cv.height = 400;
    cv.style.cssText = "display:block;width:100%;" + (o.height ? "height:" + (+o.height ? o.height + "px" : o.height) : "aspect-ratio:4/5;max-height:600px") +
      ";touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;outline:none;outline-offset:2px;border-radius:inherit;cursor:grab";
    cv.setAttribute("role", "img"); cv.setAttribute("aria-label", o.label || "Muscle map"); cv.tabIndex = 0;
    try { init(); } catch (e) { free(); release(); cv.width = cv.height = 1; throw e; }   // shaders did not link: give the context back, touch nothing
    host.appendChild(cv);
    seen = cv.isConnected;
    on(cv, "pointerdown", down); on(cv, "pointermove", move); on(window, "pointerup", up); on(window, "pointercancel", up); on(cv, "lostpointercapture", up);
    on(cv, "gesturestart", function (e) { e.preventDefault(); });         // no touchmove listener: touch-action pan-y keeps the page's scroll off the main thread
    on(cv, "wheel", wheel, { passive: false }); on(cv, "keydown", key); on(cv, "focus", ring); on(cv, "blur", ring);
    on(cv, "webglcontextlost", function (e) { e.preventDefault(); if (lost) return; lost = true; pause(); cv.style.visibility = "hidden"; call(o.onLost); });   // no dead box on screen
    on(cv, "webglcontextrestored", function () {
      lost = false; try { init(); } catch (_) { return destroy(); }
      size(); draw(); cv.style.visibility = ""; call(o.onRestored); if (dirty) kick();
    });
    on(document, "visibilitychange", function () { if (document.hidden) pause(); else if (dirty) kick(); });
    on(window, "resize", function () { if (gone()) destroy(); else if (size()) draw(); });
    if (mq && mq.addEventListener) on(mq, "change", function () {             // reduced motion switched on while mounted: finish, do not animate
      if (!rm()) return;
      if (yon) yaw = wrap(yb); else if (son) yaw = 0;
      if (zon) { zoom = 1; ox = oy = 0; lens(); }
      halt(); kick(); rest();
    });
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { if (gone()) destroy(); else if (size()) draw(); }); ro.observe(cv); }   // draws only on a real change
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (en) {
        if (gone()) return destroy();
        vis = en[en.length - 1].isIntersecting;
        if (!vis) pause(); else if (dirty) kick();
      });
      io.observe(cv);
    }
    size(); target(1); draw();
    if (o.autoRotate !== false && !rm()) { son = true; st0 = -1; kick(); }

    self = {
      update: function (v, x) {                  // x: a new label, or { label, colors }
        if (v) values = v;
        if (typeof x === "string") x = { label: x };
        if (x && x.label != null) cv.setAttribute("aria-label", x.label);
        if (x && x.colors) C = mix(C, x.colors);
        target();
      },
      select: function (k) {                     // a key, an array of keys, or null (v1.2)
        if (dead) return;
        if (son || ion) owe = 1; son = ion = false;                          // an eased turn already running may finish where it was going
        if (!setSel((k == null ? [] : [].concat(k)).map(function (x) { return mesh.slotOf.hasOwnProperty(x) ? mesh.slotOf[x] : -1; }), 1) && !yon) settle();
      },
      selected: keys,
      view: view,
      flash: function (keys, f) {
        f = f || {};
        [].concat(keys || []).forEach(function (k) { var i = mesh.slotOf[k]; if (i >= 0) { fS[i] = f.strength > 0 ? Math.min(+f.strength, 1.5) : 1; fD[i] = f.ms > 0 ? +f.ms : 1200; fT[i] = -1; } });
        kick();
      },
      spin: function () { if (rm()) return; halt(); ya = yaw; yb = yaw + TAU; yt0 = -1; yd = 1600; ye = 1; yon = true; kick(); },
      resize: function () { if (dead) return; size(); draw(); },
      groups: function () { return mesh.keys.map(function (k, i) { return { key: k, name: mesh.names[i] }; }); },   // from the data, in its order
      destroy: function () { destroy(); },
      debug: function () {
        return {
          webgl2: true, frames: frames, lastMs: lastMs, tris: mesh.tris, yaw: wrap(yaw), zoom: zoom, pan: [ox, oy],
          selected: sl.length ? mesh.keys[sl[0]] : null, selection: keys(), running: !!raf, lost: lost, buffer: [cv.width, cv.height], samples: aa,
          pickAt: function (x, y) { var i = pick(x, y); return i < 0 ? null : mesh.keys[i]; },
          find: function (key) {                 // a canvas point (CSS px) where that group is in front, or null: lets a test tap a muscle
            var w = mesh.slotOf[key], n = 0, sx = 0, sy = 0, bx = 0, by = 0, b = 1e9, x, y, d, pts = [];
            for (y = 4; y < ch; y += ch / 60) for (x = 4; x < cw; x += cw / 48) if (pick(x, y) === w) { pts.push(x, y); sx += x; sy += y; n++; }
            for (x = 0; x < pts.length; x += 2) { d = Math.hypot(pts[x] - sx / n, pts[x + 1] - sy / n); if (d < b) { b = d; bx = pts[x]; by = pts[x + 1]; } }
            return n ? [bx, by] : null;
          },
          level: function (key) {                // what the shader is being told for a group, 0..255 sRGB
            var i = mesh.slotOf[key] * 4;
            return i >= 0 ? { rgb: [0, 1, 2].map(function (j) { return Math.round(Math.pow(pal[i + j], 1 / 2.2) * 255); }), sel: pal[i + 3], glow: ext[i], flash: ext[i + 1], dim: dim } : null;
          },
          ray: function (x, y) { ray(x, y); return [RO[0], RO[1], RO[2], RD[0], RD[1], RD[2]]; },
          draw: draw
        };
      }
    };
    var rec = { cv: cv, gone: gone, kill: destroy };
    live.push(rec); hosts.set(host, rec);
    return self;
  }

  return {
    supported: function () {
      if (sup === null) {
        try {
          var g = document.createElement("canvas").getContext("webgl2"), x = g && g.getExtension("WEBGL_lose_context");
          sup = !!g; if (x) x.loseContext();
        } catch (_) { sup = false; }
      }
      return sup;
    },
    mount: function (host, opts) {
      var h = null, old, sp = null;
      this.lastError = "";
      try {
        if (!host || !this.supported()) return null;
        live.slice().forEach(function (r) { if (r.gone()) sp = r.kill(!sp) || sp; });   // maps whose canvas an innerHTML re-render threw away
        old = hosts.get(host); if (old) sp = old.kill(!sp) || sp;
        h = create(host, opts || {}, sp);
      } catch (e) { this.lastError = String(e && e.message || e); h = null; }
      if (sp && !sp.used) sp.lose();
      return h;
    },
    color: function (t, colors, band) {          // the CSS colour the map uses for t (and a band): lets the page's numbers match the figure
      var c = tint({ t: t, band: band }, mix(DEF, colors));
      return "rgb(" + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + ")";
    },
    lastError: ""
  };
})();

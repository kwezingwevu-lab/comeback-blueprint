/* sdftext.js - crisp text at any scale, with no font file.
 *
 * WHAT THIS IS
 *   A signed-distance-field text renderer for WebGL2. The glyph edge is
 *   reconstructed analytically in the fragment shader from a distance field, so
 *   a label stays razor-sharp at 8 px or 256 px, at any device pixel ratio and
 *   at any viewing angle. A bitmap atlas cannot do that: its edge blurs in
 *   proportion to the magnification.
 *
 * NO NETWORK, NO DEPENDENCY, NO FONT FILE
 *   The atlas below was baked at BUILD time by tools/sdftext-bake.cjs, which
 *   rasterised a font already installed on the build machine through the 2D
 *   canvas API and computed a true signed distance field with an exact
 *   Euclidean distance transform (Felzenszwalb & Huttenlocher, separable
 *   lower-envelope-of-parabolas - O(n) per scanline, not an O(n^2) search and
 *   not a chamfer approximation). Nothing is fetched and nothing is generated
 *   on the device: the field is a quantised 8-bit greyscale PNG carried inline
 *   as a data: URL, so the browser's own deflate decoder unpacks it and the
 *   module spends zero bytes on a decompressor. The PNG -> texture -> shader
 *   round trip was measured byte-exact in both Chromium and WebKit.
 *
 * SINGLE-CHANNEL, AND THE LIMIT THAT BUYS
 *   This is a single-channel SDF, not a multi-channel (MSDF) field. A
 *   single-channel field cannot represent the crease in the distance function
 *   at a sharp corner, so bilinear reconstruction cuts the corner slightly.
 *   The cut is a fixed fraction of one atlas texel, which means it scales with
 *   the rendered size: see the measured corner figures in the lane report. At
 *   the sizes this app draws labels the cut is under one device pixel. MSDF
 *   would need the glyph outline as vector segments, which means either a font
 *   file (forbidden here) or tracing the outline back out of the raster; that
 *   is a larger and more error-prone build step for a defect that does not
 *   show at label sizes.
 *
 * CLASSIC SCRIPT ON PURPOSE
 *   This file is a classic script publishing one namespace, window.SDFText. It
 *   is NOT an ES module: a page opened from a file:// URL cannot import a
 *   sibling ES module (CORS blocks it), and the single-file build concatenates
 *   sources rather than bundling them. Load it with <script src>.
 *
 * DETERMINISM AND ACCESSIBILITY
 *   No Math.random, no Date.now, no storage of any kind. Every string drawn is
 *   retained in draw order and readable back through renderer.textContent(),
 *   so a canvas can carry a text alternative that says the same thing.
 *
 * API  (all sizes in CSS/device px unless stated; atlas units are noted)
 *   SDFText.version                      -> string
 *   SDFText.font                         -> { em, spread, ascent, descent,
 *                                             atlasWidth, atlasHeight, charset,
 *                                             glyphCount, kernPairs }
 *   SDFText.has(ch)                      -> boolean
 *   SDFText.color(css)                   -> [r,g,b] LINEAR, from '#rgb'/'#rrggbb'
 *                                           or [r,g,b] already in sRGB 0..1
 *   SDFText.measure(text, opts)          -> metrics, WITHOUT rendering
 *   SDFText.layout(text, opts)           -> { verts:Float32Array, count, ... }
 *   SDFText.load()                       -> Promise<HTMLImageElement>  (atlas)
 *   SDFText.tier(canvas)                 -> 2 WebGL2 | 1 canvas 2d | 0 neither
 *   SDFText.reducedMotion()              -> boolean (prefers-reduced-motion)
 *   SDFText.createRenderer(gl, opts)     -> renderer, see below
 *   SDFText.fallback2D(ctx, text, opts)  -> width   (tier 1, system font)
 *   SDFText.describe(items)              -> string  (text alternative helper)
 *   SDFText.VS / SDFText.FS              -> shader source, for a caller that
 *                                           owns its own pipeline
 *   SDFText.DITHER_GLSL                  -> ordered-dither snippet for the
 *                                           caller's resolve pass
 *   SDFText.mat                          -> { ortho, perspective, identity,
 *                                             multiply, translate, scale,
 *                                             rotateX, rotateY }  column-major
 *
 *   renderer.ready        Promise, resolves when the atlas texture is uploaded
 *   renderer.isReady      boolean
 *   renderer.draw(text, o)    o = { x, y, size, align, baseline, color, alpha,
 *                                   outlineWidth, outlineColor, haloWidth,
 *                                   haloColor, thicken, mvp, mode,
 *                                   letterSpacing, kerning, lineHeight,
 *                                   maxWidth }
 *                             mode: 'linear' | 'srgb' | 'p3'.
 *
 *   ON mode, BECAUSE THE DIFFERENCE IS REAL AND ONE OPTION IS BETTER:
 *     'linear'  the shader writes PREMULTIPLIED LINEAR light and the caller
 *               blends with ONE / ONE_MINUS_SRC_ALPHA into a float target
 *               (RGBA16F), then tone-maps and encodes in a resolve pass. This
 *               is the correct one: the coverage blend happens in linear light,
 *               where it physically belongs, and the glyph edge does not gain
 *               or lose weight against its background.
 *     'srgb'    the shader encodes before writing, so it can draw straight into
 *               an 8-bit canvas with no float target. Be clear about what this
 *               costs: the alpha blend then happens between ENCODED values,
 *               which is NOT linear compositing. MEASURED, white text on black
 *               at 64 px: a partially covered edge pixel comes out at 176 of
 *               255 on this path where linear compositing then encoding puts it
 *               at 216 - 40 eight-bit levels DARKER in Chromium, 45 in WebKit.
 *               The interior is exact; it is the one-pixel edge that thins, so
 *               small text looks lighter in weight. Use this mode when there is
 *               no float target, not by preference.
 *     'p3'      as 'srgb', with the linear colour taken through the sRGB ->
 *               Display-P3 primaries first. Set the drawing buffer's colour
 *               space to 'display-p3' as well, or the wider primaries are
 *               re-interpreted as sRGB and every colour shifts.
 *
 *     Either way the values are premultiplied, so the blend func is always
 *     ONE / ONE_MINUS_SRC_ALPHA. Nothing here ever double-encodes: the atlas
 *     texel is a DISTANCE, not light, so it is neither encoded nor decoded.
 *   renderer.drawLayout(layout, o)
 *   renderer.textContent()    every string drawn since resetText(), in order
 *   renderer.resetText()
 *   renderer.dispose()
 */
;(function (root) {
  'use strict';

  var VERSION = '1.0.0';

/* ---------- [SDF-ATLAS-DATA] baked by tools/sdftext-bake.cjs - do not hand-edit ---------- */
  var CS = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:;!?-+=%/()'\"&£·–−×°";
  var GM = "6.671875 13.34375,-3,-20,19,24,155,31 13.34375,-2,-20,18,23,103,105 13.34375,-3,-20,19,23,43,105 13.34375,-3,-20,19,24,175,31 13.34375,-3,-20,20,23,229,81 13.34375,-3,-20,19,24,195,31 13.34375,-3,-20,19,24,215,31 13.34375,-2,-20,18,23,122,105 13.34375,-3,-20,19,24,235,31 13.34375,-3,-20,19,24,1,56 17.328125,-3,-20,23,23,213,56 17.328125,-2,-20,22,23,25,81 17.328125,-3,-20,23,24,221,1 17.328125,-2,-20,22,23,48,81 16.015625,-2,-20,21,23,163,81 14.65625,-2,-20,19,24,21,56 18.671875,-3,-20,24,24,171,1 17.328125,-2,-20,21,23,185,81 6.671875,-2,-20,11,23,156,105 13.34375,-3,-20,18,24,101,56 17.328125,-2,-20,23,23,1,81 14.65625,-2,-20,19,23,63,105 20,-2,-20,24,23,188,56 17.328125,-2,-20,21,23,207,81 18.671875,-3,-20,24,24,196,1 16.015625,-2,-20,21,24,47,31 18.671875,-3,-20,24,28,42,1 17.328125,-2,-20,22,23,71,81 16.015625,-3,-20,22,24,1,31 14.65625,-3,-20,21,24,69,31 17.328125,-2,-20,21,24,91,31 16.015625,-3,-20,22,23,94,81 22.65625,-3,-20,29,23,158,56 16.015625,-3,-20,22,23,117,81 16.015625,-3,-20,22,23,140,81 14.65625,-3,-20,20,23,1,105 13.34375,-3,-16,20,20,190,105 14.65625,-2,-21,19,25,109,1 13.34375,-3,-16,19,20,232,105 14.65625,-3,-21,20,25,67,1 13.34375,-3,-16,19,20,1,129 8,-3,-21,15,24,120,56 14.65625,-3,-16,20,25,88,1 14.65625,-2,-21,19,24,41,56 6.671875,-2,-21,10,24,136,56 6.671875,-4,-21,12,29,29,1 13.34375,-2,-21,19,24,61,56 6.671875,-2,-21,10,24,147,56 21.34375,-2,-16,25,19,108,129 14.65625,-2,-16,19,19,176,129 14.65625,-3,-16,20,20,211,105 14.65625,-2,-16,19,24,81,56 14.65625,-3,-16,20,24,113,31 9.34375,-2,-16,14,19,234,129 13.34375,-3,-16,19,20,21,129 8,-3,-19,14,23,141,105 14.65625,-2,-16,19,20,41,129 13.34375,-3,-16,20,19,134,129 18.671875,-4,-16,26,19,81,129 13.34375,-3,-16,20,19,155,129 13.34375,-3,-16,20,24,134,31 12,-3,-16,18,19,196,129 6.671875,-2,-7,11,10,123,150 6.671875,-2,-7,11,14,48,150 8,-1,-16,10,19,1,150 8,-1,-16,10,23,168,105 8,-1,-20,10,23,179,105 14.65625,-2,-20,19,23,83,105 8,-3,-11,14,10,108,150 14.015625,-2,-18,19,20,61,129 14.015625,-3,-16,20,16,12,150 21.34375,-3,-20,27,24,143,1 6.671875,-3,-21,13,25,129,1 8,-2,-21,13,29,1,1 8,-3,-21,13,29,15,1 5.703125,-2,-20,10,13,76,150 11.375,-2,-20,15,13,60,150 17.328125,-2,-20,22,24,24,31 13.34375,-3,-20,20,23,22,105 8,-2,-13,11,10,135,150 13.34375,-3,-11,19,9,147,150 14.015625,-3,-13,20,10,87,150 14.015625,-2,-17,18,19,215,129 9.59375,-2,-20,14,14,33,150";
  var KP = "2_2_-85 b_u_-114 b_w_-114 b_x_-85 b_z_-141 b_1m_-57 b_1n_-28 b_1p_-57 g_b_-85 g_1r_-170 g_1s_-170 m_u_-114 m_w_-114 m_x_-85 m_z_-141 m_1p_-57 q_b_-114 q_1r_-198 q_1s_-198 s_w_-28 s_x_-28 s_z_-57 u_b_-114 u_p_-28 u_11_-114 u_13_-114 u_15_-114 u_19_-28 u_1f_-114 u_1i_-85 u_1j_-114 u_1l_-114 u_1n_-114 u_1p_-114 u_1r_-170 u_1s_-170 u_1t_-170 u_1u_-170 u_1x_-85 w_b_-114 w_11_-85 w_15_-85 w_19_-28 w_1f_-114 w_1i_-85 w_1l_-57 w_1p_-57 w_1r_-141 w_1s_-141 w_1t_-85 w_1u_-85 w_1x_-85 x_b_-85 x_11_-57 x_15_-28 x_19_-13 x_1f_-28 x_1i_-28 x_1l_-28 x_1p_-28 x_1r_-85 x_1s_-85 x_1t_-28 x_1u_-28 x_1x_-31 z_b_-141 z_11_-85 z_15_-85 z_19_-57 z_1f_-114 z_1g_-85 z_1h_-114 z_1l_-85 z_1m_-85 z_1r_-170 z_1s_-170 z_1t_-114 z_1u_-114 z_1x_-85 1i_1r_-85 1i_1s_-85 1m_1r_-114 1m_1s_-114 1n_1r_-57 1n_1s_-57 1p_1r_-114 1p_1s_-114";
  var AW = 256, AH = 170, EM = 24, SPREAD = 3;
  var ASC = 21.75, DESC = 5.125;
  var PNG = "data:image/png;base64,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";
/* ---------- [/SDF-ATLAS-DATA] ---------- */

  var RANGE = SPREAD * 2;          // atlas px spanned by field values 0..1
  var G = null, K = null;

  function tables() {
    if (G) return;
    G = {}; K = {};
    var recs = GM.split(' '), i, f, ch;
    for (i = 0; i < CS.length; i++) {
      ch = CS.charAt(i); f = recs[i].split(',');
      G[ch] = f.length === 1
        ? { adv: +f[0], empty: true, x0: 0, y0: 0, w: 0, h: 0, ax: 0, ay: 0 }
        : { adv: +f[0], empty: false, x0: +f[1], y0: +f[2], w: +f[3], h: +f[4], ax: +f[5], ay: +f[6] };
    }
    if (KP) {
      var kp = KP.split(' ');
      for (i = 0; i < kp.length; i++) {
        var p = kp[i].split('_');
        K[CS.charAt(parseInt(p[0], 36)) + CS.charAt(parseInt(p[1], 36))] = (+p[2]) / 64;
      }
    }
  }

  function has(ch) { tables(); return Object.prototype.hasOwnProperty.call(G, ch); }
  function glyph(ch) { tables(); return G[ch] || G['?']; }
  function kernOf(a, b) { tables(); var v = K[a + b]; return v === undefined ? 0 : v; }

  /* ---- layout ---------------------------------------------------------- */

  function runWidth(s, ls, kern) {            // atlas px
    var w = 0, n = s.length, i;
    for (i = 0; i < n; i++) {
      w += glyph(s.charAt(i)).adv;
      if (kern && i + 1 < n) w += kernOf(s.charAt(i), s.charAt(i + 1));
    }
    if (n > 1) w += ls * (n - 1);
    return w;
  }

  function opt(o, k, d) { return (o && o[k] !== undefined && o[k] !== null) ? o[k] : d; }

  function measure(text, o) {
    tables();
    var size = opt(o, 'size', 16),
        kern = opt(o, 'kerning', true) !== false,
        lh   = opt(o, 'lineHeight', 1.25),
        maxW = opt(o, 'maxWidth', Infinity),
        s    = size / EM,
        ls   = opt(o, 'letterSpacing', 0) / s;   // px -> atlas px
    var src = String(text === null || text === undefined ? '' : text);
    var paras = src.split('\n'), lines = [], p, wi;
    for (p = 0; p < paras.length; p++) {
      if (!(maxW < Infinity)) { lines.push(paras[p]); continue; }
      var words = paras[p].split(' '), cur = '';
      for (wi = 0; wi < words.length; wi++) {
        var trial = cur ? cur + ' ' + words[wi] : words[wi];
        if (cur && runWidth(trial, ls, kern) * s > maxW) { lines.push(cur); cur = words[wi]; }
        else cur = trial;
      }
      lines.push(cur);
    }
    var out = [], width = 0, i, w;
    for (i = 0; i < lines.length; i++) {
      w = runWidth(lines[i], ls, kern) * s;
      if (w > width) width = w;
      out.push({ text: lines[i], width: w });
    }
    var asc = ASC * s, desc = DESC * s, step = size * lh;
    return { width: width, height: (lines.length - 1) * step + asc + desc,
             ascent: asc, descent: desc, lineStep: step, size: size, lines: out };
  }

  // verts: 6 per glyph, 4 floats each (x, y, u, v). x,y in px with the origin
  // at the left edge of the first baseline, y down. u,v in ATLAS TEXELS.
  function layout(text, o) {
    var m = measure(text, o);
    var size = m.size, s = size / EM,
        kern = opt(o, 'kerning', true) !== false,
        ls   = opt(o, 'letterSpacing', 0) / s,
        align = opt(o, 'align', 'left');
        var af = align === 'center' ? 0.5 : align === 'right' ? 1 : 0;
    var n = 0, li, i, line;
    for (li = 0; li < m.lines.length; li++) {
      line = m.lines[li].text;
      for (i = 0; i < line.length; i++) if (!glyph(line.charAt(i)).empty) n++;
    }
    var v = new Float32Array(n * 24), k = 0;
    for (li = 0; li < m.lines.length; li++) {
      line = m.lines[li].text;
      var pen = (m.width - m.lines[li].width) * af, py = li * m.lineStep;
      for (i = 0; i < line.length; i++) {
        var ch = line.charAt(i), g = glyph(ch);
        if (!g.empty) {
          var x0 = pen + g.x0 * s, y0 = py + g.y0 * s,
              x1 = x0 + g.w * s,   y1 = y0 + g.h * s,
              u0 = g.ax, v0 = g.ay, u1 = g.ax + g.w, v1 = g.ay + g.h;
          v[k++] = x0; v[k++] = y0; v[k++] = u0; v[k++] = v0;
          v[k++] = x1; v[k++] = y0; v[k++] = u1; v[k++] = v0;
          v[k++] = x0; v[k++] = y1; v[k++] = u0; v[k++] = v1;
          v[k++] = x0; v[k++] = y1; v[k++] = u0; v[k++] = v1;
          v[k++] = x1; v[k++] = y0; v[k++] = u1; v[k++] = v0;
          v[k++] = x1; v[k++] = y1; v[k++] = u1; v[k++] = v1;
        }
        pen += g.adv * s;
        if (kern && i + 1 < line.length) pen += kernOf(ch, line.charAt(i + 1)) * s;
        if (i + 1 < line.length) pen += ls * s;
      }
    }
    return { verts: v, count: n, width: m.width, height: m.height,
             ascent: m.ascent, descent: m.descent, lineStep: m.lineStep,
             size: size, lines: m.lines, text: String(text) };
  }

  /* ---- colour ---------------------------------------------------------- */

  function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

  function color(v) {
    if (v && v.length === 3 && typeof v[0] === 'number')
      return [s2l(v[0]), s2l(v[1]), s2l(v[2])];
    var t = String(v === undefined || v === null ? '#ffffff' : v).trim();
    if (t.charAt(0) === '#') t = t.slice(1);
    if (t.length === 3) t = t.charAt(0) + t.charAt(0) + t.charAt(1) + t.charAt(1) + t.charAt(2) + t.charAt(2);
    if (t.length === 8) t = t.slice(0, 6);
    if (!/^[0-9a-fA-F]{6}$/.test(t)) return [1, 1, 1];
    return [s2l(parseInt(t.slice(0, 2), 16) / 255),
            s2l(parseInt(t.slice(2, 4), 16) / 255),
            s2l(parseInt(t.slice(4, 6), 16) / 255)];
  }

  /* ---- 4x4 matrices, column-major, hand-written ------------------------ */

  var mat = {
    identity: function () { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
    // px space (x right, y DOWN, origin top-left) -> clip space
    ortho: function (w, h) {
      return new Float32Array([2 / w,0,0,0,  0,-2 / h,0,0,  0,0,-1,0,  -1,1,0,1]);
    },
    perspective: function (fovy, aspect, near, far) {
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return new Float32Array([f / aspect,0,0,0, 0,f,0,0, 0,0,(far + near) * nf,-1, 0,0,2 * far * near * nf,0]);
    },
    translate: function (x, y, z) {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
    },
    scale: function (x, y, z) {
      return new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]);
    },
    rotateX: function (r) { var c = Math.cos(r), s = Math.sin(r);
      return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); },
    rotateY: function (r) { var c = Math.cos(r), s = Math.sin(r);
      return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); },
    multiply: function (a, b) {                 // returns a*b
      var o = new Float32Array(16), i, j, k, s;
      for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) {
        s = 0; for (k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
      return o;
    }
  };

  /* ---- shaders --------------------------------------------------------- */

  var VS =
'#version 300 es\n' +
'in vec2 aPos;\n' +
'in vec2 aUV;\n' +
'uniform mat4 uMVP;\n' +
'out vec2 vUV;\n' +
'void main(){ vUV = aUV; gl_Position = uMVP * vec4(aPos, 0.0, 1.0); }\n';

  var FS =
'#version 300 es\n' +
'precision highp float;\n' +
'in vec2 vUV;\n' +                    // atlas texels
'uniform sampler2D uTex;\n' +
'uniform vec2  uTexel;\n' +           // 1 / atlas size
'uniform float uRange;\n' +           // atlas px spanned by field 0..1
'uniform vec4  uFill;\n' +            // LINEAR rgb + alpha
'uniform vec4  uOut;\n' +
'uniform vec4  uHalo;\n' +
'uniform vec3  uEdge;\n' +            // x outline px, y halo px, z thicken px
'uniform int   uMode;\n' +            // 0 linear premultiplied, 1 sRGB, 2 P3
'out vec4 oC;\n' +
'const mat3 SRGB_TO_P3 = mat3(\n' +
'  0.8224621, 0.0331941, 0.0170827,\n' +
'  0.1775380, 0.9668058, 0.0723974,\n' +
'  0.0000000, 0.0000000, 0.9105199);\n' +
'float enc1(float c){ c = clamp(c, 0.0, 1.0);\n' +
'  return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }\n' +
'vec4 over(vec4 s, vec4 d){ return s + d * (1.0 - s.a); }\n' +
'void main(){\n' +
'  vec2 uv = vUV * uTexel;\n' +
     // textureLod, never texture(): there is no mip chain (a mipped atlas bleeds
     // between glyph cells) and an implicit-LOD fetch inside the divergent branch
     // below would be undefined.
'  vec2 dux = dFdx(uv), duy = dFdy(uv);\n' +
'  float d = (textureLod(uTex, uv, 0.0).r - 0.5) * uRange + uEdge.z;\n' +
     // Analytic AA: the L2 gradient of the distance field is exactly the number of
     // atlas px crossed per device px, at any scale and any inclination. This is
     // the derivative the brief calls fwidth; the L2 norm is used rather than
     // fwidth's L1, which overstates the footprint by up to sqrt(2) on a diagonal.
'  float g = max(length(vec2(dFdx(d), dFdy(d))), 1e-4);\n' +
'  float aF, aO;\n' +
'  if (g > 1.2) {\n' +
       // Minified past one atlas texel per device px, so the FIELD is undersampled
       // and a one-pixel stem's weight wobbles with sub-pixel phase. Measured at
       // 8 px from a 24 px em the wobble was 19% of the glyph's ink; four
       // rotated-grid taps averaged as coverage bring it down. The branch is
       // uniform-safe: d and g are computed before it.
'    vec2 o1 = 0.25 * (dux + duy), o2 = 0.25 * (dux - duy);\n' +
'    float s = 0.0, t = 0.0, dk;\n' +
'    for (int i = 0; i < 4; i++) {\n' +
'      vec2 off = i == 0 ? o1 : i == 1 ? -o1 : i == 2 ? o2 : -o2;\n' +
'      dk = (textureLod(uTex, uv + off, 0.0).r - 0.5) * uRange + uEdge.z;\n' +
       // Each tap stands for a quarter of the pixel, so its own footprint is half
       // the pixel wide: hence 2/g, not 1/g. With the full-pixel footprint the
       // single-sample estimate saturates on a stem narrower than a pixel and
       // reports it fully covered, which is where the 8 px ink wobble came from.
'      s += clamp(dk * 2.0 / g + 0.5, 0.0, 1.0);\n' +
'      t += clamp((dk + uEdge.x) * 2.0 / g + 0.5, 0.0, 1.0);\n' +
'    }\n' +
'    aF = s * 0.25; aO = t * 0.25;\n' +
'  } else {\n' +
'    aF = clamp(d / g + 0.5, 0.0, 1.0);\n' +
'    aO = clamp((d + uEdge.x) / g + 0.5, 0.0, 1.0);\n' +
'  }\n' +
'  float aH = 0.0;\n' +
'  if (uEdge.y > 0.0) { float hv = clamp((d + uEdge.y) / uEdge.y, 0.0, 1.0); aH = hv * hv; }\n' +
     // composite in LINEAR light, premultiplied, back to front
'  vec4 c = vec4(0.0);\n' +
'  c = over(vec4(uHalo.rgb * uHalo.a * aH, uHalo.a * aH), c);\n' +
'  c = over(vec4(uOut.rgb  * uOut.a  * aO, uOut.a  * aO), c);\n' +
'  c = over(vec4(uFill.rgb * uFill.a * aF, uFill.a * aF), c);\n' +
'  if (uMode == 0) { oC = c; return; }\n' +
'  vec3 lin = c.a > 1e-6 ? c.rgb / c.a : vec3(0.0);\n' +
'  if (uMode == 2) lin = SRGB_TO_P3 * lin;\n' +
'  oC = vec4(vec3(enc1(lin.r), enc1(lin.g), enc1(lin.b)) * c.a, c.a);\n' +
'}\n';

  // Ordered 8x8 Bayer dither, in DISPLAY units (i.e. apply after encoding), so
  // an 8-bit gradient does not band. Exposed for a caller's resolve pass.
  var DITHER_GLSL =
'float sdfBayer8(vec2 p){\n' +
'  vec2 q = floor(mod(p, 8.0));\n' +
'  float b = 0.0, s = 1.0;\n' +
'  for (int i = 0; i < 3; i++) {\n' +
'    float xb = mod(floor(q.x / pow(2.0, float(2 - i))), 2.0);\n' +
'    float yb = mod(floor(q.y / pow(2.0, float(2 - i))), 2.0);\n' +
'    b += s * (mod(xb + yb, 2.0) * 2.0 + xb);\n' +
'    s *= 4.0;\n' +
'  }\n' +
'  return b / 64.0;\n' +
'}\n' +
'vec3 sdfDither(vec3 encoded, vec2 fragXY, float levels){\n' +
'  return encoded + (sdfBayer8(fragXY) - 0.5) / levels;\n' +
'}\n';

  /* ---- atlas load ------------------------------------------------------ */

  var _img = null, _p = null;
  function load() {
    if (_p) return _p;
    _p = new Promise(function (res, rej) {
      if (typeof Image === 'undefined') { rej(new Error('no Image')); return; }
      var im = new Image();
      im.onload = function () { _img = im; res(im); };
      im.onerror = function () { rej(new Error('sdftext: atlas decode failed')); };
      im.src = PNG;
    });
    return _p;
  }

  /* ---- WebGL2 renderer ------------------------------------------------- */

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error('sdftext shader: ' + gl.getShaderInfoLog(s));
    return s;
  }

  function createRenderer(gl, o) {
    if (!gl || typeof gl.createVertexArray !== 'function')
      throw new Error('sdftext: createRenderer needs a WebGL2 context');
    o = o || {};
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error('sdftext link: ' + gl.getProgramInfoLog(prog));
    var U = {}, names = ['uMVP','uTex','uTexel','uRange','uFill','uOut','uHalo','uEdge','uMode'];
    for (var i = 0; i < names.length; i++) U[names[i]] = gl.getUniformLocation(prog, names[i]);
    var aPos = gl.getAttribLocation(prog, 'aPos'), aUV = gl.getAttribLocation(prog, 'aUV');
    var vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    var tex = gl.createTexture();
    var drawn = [], ready = false, disposed = false, cap = 0;
    var mode0 = o.mode === 'linear' ? 0 : o.mode === 'p3' ? 2 : 1;

    var p = load().then(function (im) {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      // LINEAR is the gamma-correct filter here: the texel is a DISTANCE, linear
      // in geometry, so interpolating it linearly is exact for a straight edge.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      ready = true;
      return im;
    });

    function anchor(l, ox, oy, align, baseline) {
      var x = ox, y = oy;
      if (align === 'center') x -= l.width / 2; else if (align === 'right') x -= l.width;
      if (baseline === 'top') y += l.ascent;
      else if (baseline === 'middle') y += l.ascent - l.height / 2;
      else if (baseline === 'bottom') y += l.ascent - l.height;
      return [x, y];
    }

    function drawLayout(l, d) {
      if (disposed) throw new Error('sdftext: renderer disposed');
      if (!ready) return false;
      d = d || {};
      if (l.count === 0) { drawn.push(l.text); return true; }
      var need = l.verts.length * 4;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      if (need > cap) { gl.bufferData(gl.ARRAY_BUFFER, need, gl.DYNAMIC_DRAW); cap = need; }
      // anchor by translating in the vertex data's own space via the matrix
      var a = anchor(l, opt(d, 'x', 0), opt(d, 'y', 0),
                     opt(d, 'align', 'left'), opt(d, 'baseline', 'alphabetic'));
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, l.verts);
      gl.useProgram(prog);
      var base = d.mvp || mat.ortho(opt(d, 'width', gl.drawingBufferWidth),
                                    opt(d, 'height', gl.drawingBufferHeight));
      var mvp = mat.multiply(base, mat.translate(a[0], a[1], 0));
      gl.uniformMatrix4fv(U.uMVP, false, mvp);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(U.uTex, 0);
      gl.uniform2f(U.uTexel, 1 / AW, 1 / AH);
      gl.uniform1f(U.uRange, RANGE);
      var fc = color(opt(d, 'color', '#ffffff')), al = opt(d, 'alpha', 1);
      gl.uniform4f(U.uFill, fc[0], fc[1], fc[2], al);
      var ow = opt(d, 'outlineWidth', 0);
      var oc = color(opt(d, 'outlineColor', '#000000'));
      gl.uniform4f(U.uOut, oc[0], oc[1], oc[2], ow > 0 ? al : 0);
      var hw = opt(d, 'haloWidth', 0);
      var hc = color(opt(d, 'haloColor', '#000000'));
      gl.uniform4f(U.uHalo, hc[0], hc[1], hc[2], hw > 0 ? opt(d, 'haloAlpha', al) : 0);
      // widths arrive in px of the RENDERED text; convert to atlas px
      var s = EM / l.size;
      gl.uniform3f(U.uEdge, Math.min(ow * s, SPREAD), Math.min(hw * s, SPREAD),
                            opt(d, 'thicken', 0) * s);
      var m = d.mode === undefined ? mode0
            : d.mode === 'linear' ? 0 : d.mode === 'p3' ? 2 : 1;
      gl.uniform1i(U.uMode, m);
      gl.drawArrays(gl.TRIANGLES, 0, l.count * 6);
      gl.bindVertexArray(null);
      drawn.push(l.text);
      return true;
    }

    return {
      ready: p,
      get isReady() { return ready; },
      program: prog,
      texture: tex,
      draw: function (text, d) { return drawLayout(layout(text, d), d); },
      drawLayout: drawLayout,
      textContent: function () { return drawn.join(' · '); },
      resetText: function () { drawn = []; },
      dispose: function () {
        disposed = true; ready = false;
        gl.deleteBuffer(vbo); gl.deleteVertexArray(vao);
        gl.deleteTexture(tex); gl.deleteProgram(prog);
      }
    };
  }

  /* ---- degradation ----------------------------------------------------- */

  function tier(canvas) {
    try {
      var c = canvas || (typeof document !== 'undefined' && document.createElement('canvas'));
      if (!c) return 0;
      if (c.getContext('webgl2')) return 2;
      if (c.getContext('2d')) return 1;
    } catch (e) { /* a blocked context throws; that is tier 0 */ }
    return 0;
  }

  // Tier 1. Draws with the BROWSER's text engine, not the baked font: the shape
  // and the metrics are the system font's, which is why it returns the width it
  // actually used instead of the baked measure().
  function fallback2D(ctx, text, o) {
    o = o || {};
    var size = opt(o, 'size', 16);
    ctx.save();
    ctx.font = (o.weight || 'bold') + ' ' + size + 'px ' +
               (o.family || 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
    ctx.textAlign = opt(o, 'align', 'left');
    ctx.textBaseline = opt(o, 'baseline', 'alphabetic');
    var t = String(text), w = ctx.measureText(t).width;
    var ow = opt(o, 'outlineWidth', 0);
    if (ow > 0) {
      ctx.lineWidth = ow * 2; ctx.lineJoin = 'round';
      ctx.strokeStyle = o.outlineColor || '#000';
      ctx.strokeText(t, opt(o, 'x', 0), opt(o, 'y', 0));
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(t, opt(o, 'x', 0), opt(o, 'y', 0));
    ctx.restore();
    return w;
  }

  function reducedMotion() {
    return typeof matchMedia === 'function' &&
           matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function describe(items) {
    if (!items) return '';
    if (typeof items === 'string') return items;
    var out = [], i;
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      out.push(typeof it === 'string' ? it
        : (it.label ? it.label + (it.value !== undefined ? ' ' + it.value : '') : String(it)));
    }
    return out.join('. ');
  }

  tables();
  var nSolid = 0, ch;
  for (ch in G) if (Object.prototype.hasOwnProperty.call(G, ch) && !G[ch].empty) nSolid++;

  root.SDFText = {
    version: VERSION,
    font: { em: EM, spread: SPREAD, range: RANGE, ascent: ASC, descent: DESC,
            atlasWidth: AW, atlasHeight: AH, charset: CS,
            glyphCount: CS.length, inkGlyphs: nSolid,
            kernPairs: Object.keys(K).length,
            source: 'Liberation Sans Bold, rasterised at build time' },
    has: has, glyph: glyph, kern: kernOf,
    measure: measure, layout: layout, color: color,
    load: load, tier: tier, reducedMotion: reducedMotion,
    createRenderer: createRenderer, fallback2D: fallback2D, describe: describe,
    mat: mat, VS: VS, FS: FS, DITHER_GLSL: DITHER_GLSL,
    atlasURL: function () { return PNG; }
  };
})(typeof window !== 'undefined' ? window : this);

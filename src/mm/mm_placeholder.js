/* mm_placeholder.js: a stylised muscular figure, generated at runtime to CONTRACT.md (v1.1).
   One global: MM_PLACEHOLDER(detail) -> an MM_DATA object (mirror: true, the x >= 0 half is stored).
   It is the renderer's test data and the fallback when the anatomical mesh is absent.
   detail (default 1) scales the tessellation; about 2.2 gives a 120,000-triangle figure for timing tests. */
var MM_PLACEHOLDER = (function () {
  "use strict";
  var PI = Math.PI, TAU = PI * 2,
    KEYS = "body chest delts biceps triceps forearms abs obliques lats midback upperback lowerback glutes quads hamstrings calves".split(" "),
    NAMES = "Body|Chest|Shoulders (delts)|Biceps|Triceps|Forearms|Abs|Obliques|Lats|Mid back|Upper back (traps)|Lower back|Glutes|Quadriceps|Hamstrings|Calves".split("|"),
    // Bellies: [group, ax,ay,az, bx,by,bz, side radius, depth radius, fullness (1 = ellipsoid, <1 = capsule), taper at B, squareness, rings, segments, half]
    // "half" marks a shape that sits on the midline: only its x >= 0 side is built. Units: figure height 2, soles at y = -1, facing +z.
    S = [
      // head, neck, limb cores, hands and feet (body)
      [0, 0, .745, 0, 0, 1, -.004, .09, .11, .8, 1, 1, 14, 18, 1],
      [0, 0, .722, .018, 0, .875, .04, .072, .084, .9, 1.05, 1, 10, 14, 1],
      [0, 0, .822, .1, 0, .9, .102, .015, .024, 1, .6, 1, 6, 8, 1],
      [0, .089, .832, -.004, .093, .908, -.014, .012, .024, 1, 1, 1, 6, 8],
      [0, 0, .62, -.015, 0, .815, 0, .078, .08, .45, .95, 1, 8, 14, 1],
      [0, .238, .62, -.012, .325, .3, -.012, .058, .064, .5, .85, 1, 8, 14],
      [0, .326, .255, -.012, .326, .345, -.012, .052, .056, 1, 1, 1, 6, 10],
      [0, .392, .05, .02, .43, -.17, .05, .022, .054, .7, .8, 1, 8, 12],
      [0, .4, 0, .062, .414, -.09, .094, .015, .017, .6, .8, 1, 6, 8],
      [0, .108, .03, 0, .114, -.47, .004, .1, .108, .55, .64, 1, 12, 18],
      [0, .114, -.522, .042, .114, -.4, .046, .06, .052, 1, 1, 1, 6, 12],
      [0, .114, -.45, .008, .108, -.94, -.008, .062, .066, .5, .64, 1, 10, 16],
      [0, .108, -.985, -.015, .108, -.885, -.015, .052, .054, 1, 1, 1, 6, 10],
      [0, .108, -.956, -.094, .12, -.968, .236, .062, .048, .6, .8, 1, 10, 14],
      // chest: a broad plate from the armpit to the sternum
      [1, .228, .57, .06, .004, .488, .12, .102, .06, .7, .95, .8, 12, 18],
      // delts: a cap on the shoulder, tapering down the arm
      [2, .242, .705, -.012, .272, .455, -.008, .084, .102, .8, .5, 1, 12, 18],
      // biceps (front of the upper arm), triceps (back)
      [3, .26, .58, .026, .327, .33, .024, .06, .06, 1, .85, 1, 10, 14],
      [4, .266, .605, -.05, .333, .325, -.048, .064, .06, .9, .85, 1, 10, 14],
      // forearms
      [5, .318, .335, -.008, .396, .03, .02, .067, .068, .65, .5, 1, 12, 16],
      // abs: three blocks and a lower plate each side of the midline
      [6, .038, .357, .106, .038, .432, .11, .05, .03, .6, 1, .6, 6, 10],
      [6, .038, .282, .102, .038, .357, .106, .05, .03, .6, 1, .6, 6, 10],
      [6, .038, .207, .1, .038, .282, .102, .05, .03, .6, 1, .6, 6, 10],
      [6, .036, .07, .092, .038, .207, .1, .05, .03, .7, 1.05, .7, 8, 10],
      // obliques
      [7, .14, .09, .02, .168, .4, .03, .04, .102, .9, 1.05, 1, 10, 14],
      // lats: a wing from the lower back up to the armpit
      [8, .088, .19, -.1, .205, .565, -.04, .072, .062, .9, 1.5, 1, 12, 16],
      // mid back (mid and lower traps, rhomboids): a diamond on the midline
      [9, 0, .3, -.106, 0, .63, -.114, .118, .046, 1, 1, 1.5, 12, 16, 1],
      // upper back (upper traps): neck to shoulder tip, and the yoke behind the neck
      [10, .028, .805, -.03, .238, .66, -.022, .056, .07, .9, .8, 1, 10, 12],
      [10, 0, .6, -.112, 0, .79, -.06, .1, .046, 1, .8, 1, 8, 14, 1],
      // lower back (erectors)
      [11, .04, .04, -.106, .044, .35, -.11, .052, .036, .8, 1, 1, 8, 10],
      // glutes
      [12, .104, -.16, -.07, .096, .1, -.082, .106, .11, .8, 1, 1, 12, 18],
      // quads: rectus femoris, vastus lateralis, vastus medialis (the teardrop)
      [13, .11, -.005, .036, .116, -.45, .032, .088, .092, .85, .7, 1, 12, 16],
      [13, .178, -.07, 0, .156, -.43, .012, .054, .086, .9, .8, 1, 10, 12],
      [13, .094, -.458, .036, .07, -.25, .032, .054, .064, 1, .6, 1, 8, 12],
      // hamstrings: outer and inner
      [14, .156, -.1, -.042, .146, -.47, -.032, .056, .084, .9, .8, 1, 10, 12],
      [14, .076, -.09, -.047, .092, -.47, -.038, .062, .084, .9, .8, 1, 10, 12],
      // calves: two heads and the taper to the heel
      [15, .082, -.455, -.036, .098, -.765, -.03, .052, .068, 1, .7, 1, 10, 12],
      [15, .148, -.455, -.036, .128, -.745, -.03, .048, .064, 1, .7, 1, 10, 12],
      [15, .11, -.6, -.03, .108, -.93, -.04, .054, .05, .8, .45, 1, 8, 10]
    ],
    // Torso core (body), lofted through these sections: [y, centre z, half width, front depth, back depth]
    L = [[-.1, 0, .06, .06, .06], [-.05, 0, .178, .1, .11], [.03, -.004, .2, .11, .125], [.13, -.004, .19, .113, .112], [.235, 0, .178, .113, .103],
      [.36, .002, .19, .12, .11], [.48, .004, .212, .128, .122], [.585, 0, .218, .12, .118], [.652, -.004, .175, .097, .102], [.71, -.008, .082, .074, .076]];

  function cr(a, b, c, d, t) { return .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - 3 * c + d - a) * t * t * t); }
  function pw(v, q) { return v < 0 ? -Math.pow(-v, q) : Math.pow(v, q); }
  function enc(a) {
    var u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), s = "", i;
    for (i = 0; i < u.length; i += 8190) s += String.fromCharCode.apply(null, u.subarray(i, i + 8190));
    return btoa(s);
  }

  return function (detail) {
    var k = detail || 1, X = [], T = [], G = [], PR = [], OC = [], i, j;

    // One closed ring surface: poles at s = 0 and 1, rings between. f(s, phi) returns [x, y, z].
    function grid(g, nr, ns, half, f) {
      var b = G.length, cols = half ? ns + 1 : ns, t0 = T.length, pi = OC.length, p, a, c, r0, r1, v = 0, cx = 0, cy = 0, cz = 0, n;
      function put(s, ph) { p = f(s, ph); X.push(p[0] < 1e-9 ? 0 : p[0], p[1] < -1 ? -1 : p[1], p[2]); G.push(g); PR.push(pi); }
      put(0, 0);
      for (i = 1; i < nr; i++) for (j = 0; j < cols; j++) put(i / nr, half ? (j / ns - .5) * PI : j / ns * TAU);
      put(1, 0);
      n = G.length - b;
      for (j = 0; j < ns; j++) {
        a = b + 1 + j; c = b + 1 + (half ? j + 1 : (j + 1) % ns);
        T.push(b, c, a);
        for (i = 1; i < nr - 1; i++) { r0 = (i - 1) * cols; r1 = r0 + cols; T.push(a + r0, c + r0, c + r1, a + r0, c + r1, a + r1); }
        r0 = (nr - 2) * cols; T.push(b + n - 1, a + r0, c + r0);
      }
      // make the winding counter-clockwise seen from outside (signed volume about the centroid)
      for (i = b; i < b + n; i++) { cx += X[i * 3]; cy += X[i * 3 + 1]; cz += X[i * 3 + 2]; }
      cx /= n; cy /= n; cz /= n;
      for (i = t0; i < T.length; i += 3) {
        a = T[i] * 3; c = T[i + 1] * 3; r0 = T[i + 2] * 3;
        var ax = X[a] - cx, ay = X[a + 1] - cy, az = X[a + 2] - cz, bx = X[c] - cx, by = X[c + 1] - cy, bz = X[c + 2] - cz, dx = X[r0] - cx, dy = X[r0 + 1] - cy, dz = X[r0 + 2] - cz;
        v += ax * (by * dz - bz * dy) + ay * (bz * dx - bx * dz) + az * (bx * dy - by * dx);
      }
      if (v < 0) for (i = t0; i < T.length; i += 3) { a = T[i + 1]; T[i + 1] = T[i + 2]; T[i + 2] = a; }
    }

    // the torso core
    grid(0, Math.round(26 * k), Math.round(22 * k), 1, function (s, ph) {
      var u = s * (L.length - 1), a = Math.min(u | 0, L.length - 2), t = u - a, r = [], q, e = s <= 0 || s >= 1 ? 0 : Math.pow(Math.sin(PI * s), .22), c = Math.cos(ph), n = Math.sin(ph);
      for (q = 0; q < 5; q++) r[q] = cr(L[Math.max(a - 1, 0)][q], L[a][q], L[a + 1][q], L[Math.min(a + 2, L.length - 1)][q], t);
      return [r[2] * e * pw(c, .82), r[0], r[1] + (n > 0 ? r[3] : r[4]) * e * pw(n, .82)];
    });
    OC.push(null);

    // the bellies
    S.forEach(function (r) {
      var ax = r[1], ay = r[2], az = r[3], dx = r[4] - ax, dy = r[5] - ay, dz = r[6] - az, len = Math.hypot(dx, dy, dz), ru = r[7], rw = r[8], e = r[9], tp = r[10], q = r[11],
        ux, uy, uz, wx, wy, wz, m;
      dx /= len; dy /= len; dz /= len;
      if (Math.abs(dz) > .9) { ux = -dz; uy = 0; uz = dx; } else { ux = dy; uy = -dx; uz = 0; }      // u = d x Y (feet) or d x Z
      m = Math.hypot(ux, uy, uz); ux /= m; uy /= m; uz /= m;
      wx = uy * dz - uz * dy; wy = uz * dx - ux * dz; wz = ux * dy - uy * dx;                        // w = u x d
      grid(r[0], Math.max(4, Math.round(r[12] * k)), Math.max(6, Math.round(r[13] * k)), r[14], function (s, ph) {
        var th = PI * s, t = (1 - Math.cos(th)) / 2, rad = (s <= 0 || s >= 1 ? 0 : Math.pow(Math.sin(th), e)) * (1 + (tp - 1) * t),
          a = ru * rad * pw(Math.cos(ph), q), b = rw * rad * pw(Math.sin(ph), q), c = len * t;
        return [ax + dx * c + ux * a + wx * b, ay + dy * c + uy * a + wy * b, az + dz * c + uz * a + wz * b];
      });
      m = (1 + tp) / 2;
      OC.push([ax + dx * len / 2, ay + dy * len / 2, az + dz * len / 2, ux / (ru * m), uy / (ru * m), uz / (ru * m), wx / (rw * m), wy / (rw * m), wz / (rw * m), dx * 2 / len, dy * 2 / len, dz * 2 / len]);
    });

    // drop triangles that lie flat on the midline plane, then smooth normals (area weighted)
    var nv = G.length, I = [], Nn = new Float32Array(nv * 3), a, b, c;
    for (i = 0; i < T.length; i += 3) {
      a = T[i] * 3; b = T[i + 1] * 3; c = T[i + 2] * 3;
      if (!X[a] && !X[b] && !X[c]) continue;
      var e1x = X[b] - X[a], e1y = X[b + 1] - X[a + 1], e1z = X[b + 2] - X[a + 2], e2x = X[c] - X[a], e2y = X[c + 1] - X[a + 1], e2z = X[c + 2] - X[a + 2],
        nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      if (nx * nx + ny * ny + nz * nz < 1e-20) continue;
      I.push(T[i], T[i + 1], T[i + 2]);
      for (j = 0; j < 3; j++) { a = T[i + j] * 3; Nn[a] += nx; Nn[a + 1] += ny; Nn[a + 2] += nz; }
    }
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], sc = [], P = new Uint16Array(nv * 3), Q = new Int8Array(nv * 3), AO = new Uint8Array(nv), o, m, d, occ, h, x, y, z;
    for (i = 0; i < nv * 3; i++) { j = i % 3; if (X[i] < lo[j]) lo[j] = X[i]; if (X[i] > hi[j]) hi[j] = X[i]; }
    for (j = 0; j < 3; j++) sc[j] = (hi[j] - lo[j]) / 65535 || 1;
    for (i = 0; i < nv; i++) {
      a = i * 3;
      if (!X[a]) Nn[a] = 0;                                   // on the midline the true normal has no x part
      m = Math.hypot(Nn[a], Nn[a + 1], Nn[a + 2]) || 1;
      // ambient occlusion: how deep a point just above the surface sits inside the neighbouring bellies
      for (occ = 0, h = .016; h < .07; h += .026) {
        x = X[a] + Nn[a] / m * h; y = X[a + 1] + Nn[a + 1] / m * h; z = X[a + 2] + Nn[a + 2] / m * h;
        for (j = 0; j < OC.length; j++) {
          o = OC[j]; if (!o) continue;
          for (c = -1; c < 2; c += 2) {                       // the belly and its mirror image (not itself)
            if (c < 0 ? !o[0] : j === PR[i]) continue;
            var px = x * c - o[0], py = y - o[1], pz = z - o[2], q1 = px * o[3] + py * o[4] + pz * o[5], q2 = px * o[6] + py * o[7] + pz * o[8], q3 = px * o[9] + py * o[10] + pz * o[11];
            d = q1 * q1 + q2 * q2 + q3 * q3;
            if (d < 1.5) occ += d < .75 ? 1 : (1.5 - d) / .75;
          }
        }
      }
      AO[i] = Math.round(255 * Math.max(.3, 1 - occ * .2));
      for (j = 0; j < 3; j++) { P[a + j] = Math.round((X[a + j] - lo[j]) / sc[j]); Q[a + j] = Math.round(Nn[a + j] / m * 127); }
    }
    return {
      v: 1, mirror: true, groups: KEYS.map(function (key, id) { return { id: id, key: key, name: NAMES[id] }; }),
      n: nv, t: I.length / 3, q: { pmin: lo, pscale: sc }, pos: enc(P), nrm: enc(Q), gid: enc(new Uint8Array(G)), ao: enc(AO),
      idx: enc(new Uint16Array(I)), idx32: false, credit: ""
    };
  };
})();

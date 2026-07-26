/* =========================================================================
   NORBERT, UNFINISHED  --  scene3d.js
   The world, in three dimensions.

   Nothing about the game changes: the same tile grid, the same physics, the
   same script. This file only re-reads that state as geometry. The traced
   terrain outlines get extruded into slabs, and every character is rebuilt
   out of the two primitives the renderer knows -- a lump and a sausage --
   from the same measurements the 2D rigs use.

   Screen space has y going down; the world has y going up. Everything below
   flips it once, at the door, and then thinks in real coordinates.
   ========================================================================= */

const Z_FRONT = 42;         // the face of the ground you look at
const Z_BACK = -250;        // how far the table recedes
const Z_BEVEL = 7;          // the rolled lip along the front edge
const Z_PLAY = 6;           // the plane the cast stands on, just behind the lip

const Scene3D = {
  levelId: null,
  slab: null, top: null, planks: null,
  turn: 0,
  labels: [],          // sign text, projected back onto the 2D layer
  vp: null,
};

/* ---------------------------------------------------------------------- */
/*  Terrain                                                                 */
/* ---------------------------------------------------------------------- */

/* Ear clipping. The traced outlines are simple polygons, sometimes very
   concave (a pit is a deep notch), so the front faces have to be properly
   triangulated rather than fanned. */
function triangulatePoly(pts) {
  const n = pts.length;
  if (n < 3) return [];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  const V = new Array(n);
  for (let i = 0; i < n; i++) V[i] = area > 0 ? i : n - 1 - i;

  const inTri = (ax, ay, bx, by, cx, cy, px, py) => {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(neg && pos);
  };

  const out = [];
  let nv = n, count = 2 * nv, v = nv - 1;
  while (nv > 2) {
    if (count-- <= 0) break;                       // not a simple polygon
    let u = v; if (nv <= u) u = 0;
    v = u + 1; if (nv <= v) v = 0;
    let w = v + 1; if (nv <= w) w = 0;

    const A = pts[V[u]], B = pts[V[v]], C = pts[V[w]];
    const cross = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    let ok = cross > 1e-7;
    if (ok) {
      for (let i = 0; i < nv; i++) {
        if (i === u || i === v || i === w) continue;
        const P = pts[V[i]];
        if (inTri(A.x, A.y, B.x, B.y, C.x, C.y, P.x, P.y)) { ok = false; break; }
      }
    }
    if (ok) {
      out.push(V[u], V[v], V[w]);
      for (let s = v, t = v + 1; t < nv; s++, t++) V[s] = V[t];
      nv--; count = 2 * nv;
    }
  }
  return out;
}

/* Douglas-Peucker on a closed ring. The traced outlines carry a lot of very
   short segments from the hand-wobble pass; harmless in 2D, but in 3D each one
   extrudes into its own little shelf. */
function simplifyRing(pts, tol) {
  const n = pts.length;
  if (n < 8) return pts;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b <= a + 1) continue;
    const A = pts[a], B = pts[b];
    const dx = B.x - A.x, dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    let worst = -1, wi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i].x - A.x) * dy - (pts[i].y - A.y) * dx) / len;
      if (d > worst) { worst = d; wi = i; }
    }
    if (worst > tol) { keep[wi] = 1; stack.push([a, wi], [wi, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out.length >= 3 ? out : pts;
}

/* per-vertex tone: layers of clay, darker as the slab goes down */
function slabTone(y, yTop) {
  const depth = clamp((yTop - y) / 240, 0, 1);
  const band = Math.sin(y * 0.055 + Math.sin(y * 0.017) * 2.0) > 0 ? 0.05 : -0.05;
  return -depth * 0.30 + band;
}

/* Extrude the traced outlines into slabs. Two meshes come out: the mass of
   the ground, and the walkable crest, which is the same lighter clay the 2D
   renderer rolls along the top edge. */
function buildTerrainMesh(lv) {
  const slab = { pos: [], nrm: [], idx: [], tone: [] };
  const top = { pos: [], nrm: [], idx: [], tone: [] };

  const push = (M, x, y, z, nx, ny, nz, tn) => {
    const i = M.pos.length / 3;
    M.pos.push(x, y, z); M.nrm.push(nx, ny, nz); M.tone.push(tn);
    return i;
  };
  const quad = (M, a, b, c, d) => { M.idx.push(a, b, c, a, c, d); };

  let yTop = -1e9;
  for (const sh of lv.shapes) yTop = Math.max(yTop, -sh.bb.y);

  for (const sh of lv.shapes) {
    /* screen space (y down) -> world space (y up) */
    const P = sh.pts.map(p => ({ x: p.x, y: -p.y }));
    const n = P.length;
    if (n < 3) continue;

    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    const ccw = area > 0;
    const ring = simplifyRing(ccw ? P : P.slice().reverse(), 2.2);
    const rn = ring.length;
    if (rn < 3) continue;

    /* inward normal per vertex, for the bevel inset */
    const inw = [];
    for (let i = 0; i < rn; i++) {
      const p0 = ring[(i - 1 + rn) % rn], p1 = ring[i], p2 = ring[(i + 1) % rn];
      const e1x = p1.x - p0.x, e1y = p1.y - p0.y;
      const e2x = p2.x - p1.x, e2y = p2.y - p1.y;
      const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
      /* interior is to the left of each edge for CCW winding */
      let ix = (-e1y / l1) + (-e2y / l2);
      let iy = (e1x / l1) + (e2x / l2);
      const l = Math.hypot(ix, iy) || 1;
      inw.push({ x: ix / l, y: iy / l });
    }

    /* --- front cap, inset by the bevel --- */
    const capPts = ring.map((p, i) => ({ x: p.x + inw[i].x * Z_BEVEL, y: p.y + inw[i].y * Z_BEVEL }));
    const tris = triangulatePoly(capPts);
    const capBase = slab.pos.length / 3;
    for (const p of capPts) push(slab, p.x, p.y, Z_FRONT, 0, 0, 1, slabTone(p.y, yTop));
    for (let i = 0; i < tris.length; i += 3) {
      slab.idx.push(capBase + tris[i], capBase + tris[i + 1], capBase + tris[i + 2]);
    }

    /* --- the rolled lip between the inset cap and the full outline --- */
    for (let i = 0; i < rn; i++) {
      const j = (i + 1) % rn;
      const o0 = ring[i], o1 = ring[j];
      const c0 = capPts[i], c1 = capPts[j];
      const nx0 = -inw[i].x, ny0 = -inw[i].y;
      const nx1 = -inw[j].x, ny1 = -inw[j].y;
      const t0 = slabTone(o0.y, yTop), t1 = slabTone(o1.y, yTop);
      const a = push(slab, c0.x, c0.y, Z_FRONT, nx0 * 0.5, ny0 * 0.5, 0.86, t0);
      const b = push(slab, o0.x, o0.y, Z_FRONT - Z_BEVEL, nx0, ny0, 0.16, t0);
      const c = push(slab, o1.x, o1.y, Z_FRONT - Z_BEVEL, nx1, ny1, 0.16, t1);
      const d = push(slab, c1.x, c1.y, Z_FRONT, nx1 * 0.5, ny1 * 0.5, 0.86, t1);
      quad(slab, a, b, c, d);
    }

    /* --- side walls, receding into the table.
       An edge whose outward normal points up is a surface you walk on, so it
       goes into the crest mesh in the lighter clay. --- */
    for (let i = 0; i < rn; i++) {
      const j = (i + 1) % rn;
      const p0 = ring[i], p1 = ring[j];
      const ex = p1.x - p0.x, ey = p1.y - p0.y;
      const l = Math.hypot(ex, ey) || 1;
      /* interior is to the LEFT of each edge in a CCW ring, so outward is
         to the right of travel */
      const nx = ey / l, ny = -ex / l;
      /* An edge facing up is a surface you walk on. Very short ones are
         wobble artefacts, and extruding those makes a spurious shelf
         sticking two hundred units into the room. */
      const isTop = ny > 0.45 && l > 9;
      const M = isTop ? top : slab;
      const t0 = isTop ? 0 : slabTone(p0.y, yTop);
      const t1 = isTop ? 0 : slabTone(p1.y, yTop);
      const a = push(M, p0.x, p0.y, Z_FRONT - Z_BEVEL, nx, ny, 0, t0);
      const b = push(M, p0.x, p0.y, Z_BACK, nx, ny, 0, t0 - 0.28);
      const c = push(M, p1.x, p1.y, Z_BACK, nx, ny, 0, t1 - 0.28);
      const d = push(M, p1.x, p1.y, Z_FRONT - Z_BEVEL, nx, ny, 0, t1);
      quad(M, a, b, c, d);
    }
  }

  /* one-way lolly sticks, as boxes floating in front of the slab */
  const planks = { pos: [], nrm: [], idx: [], tone: [] };
  for (const pl of lv.planks) {
    addBox(planks, pl.x + 2, -(pl.y + 6), Z_PLAY, (pl.w - 4) / 2, 5, 34, 0);
  }

  return {
    slab: slab.idx.length ? GL3.upload(slab) : null,
    top: top.idx.length ? GL3.upload(top) : null,
    planks: planks.idx.length ? GL3.upload(planks) : null,
  };
}

/* a box centred on (x,y,z) with half-extents (hx,hy,hz) */
function addBox(M, x, y, z, hx, hy, hz, tone) {
  const F = [
    [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
    [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
    [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
    [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
    [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
  ];
  for (const [nr, vs] of F) {
    const base = M.pos.length / 3;
    for (const v of vs) {
      M.pos.push(x + v[0] * hx, y + v[1] * hy, z + v[2] * hz);
      M.nrm.push(nr[0], nr[1], nr[2]);
      M.tone.push(tone || 0);
    }
    M.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

/* ---------------------------------------------------------------------- */
/*  Pushing lumps                                                           */
/* ---------------------------------------------------------------------- */

/* A lump. Screen y is flipped here so callers can keep using rig numbers. */
function blob3(x, y, z, rx, ry, rz, color, seed, wob, o) {
  o = o || {};
  GL3.push(o.lo ? GL3.meshes.blobLo : GL3.meshes.blob,
    x, -y, z, rx, ry, rz, o.rz || 0, o.ry || 0,
    color, seed, wob === undefined ? 0.1 : wob, o.gloss || 0, o.ao || 0);
}

/* A sausage between two points in the XY plane at depth z. */
function limb3(x1, y1, x2, y2, z, r, color, seed, o) {
  o = o || {};
  const ax = x1, ay = -y1, bx = x2, by = -y2;
  const dx = bx - ax, dy = by - ay;
  const L = Math.hypot(dx, dy) || 0.001;
  const rz = Math.atan2(-dx, dy);
  GL3.push(GL3.meshes.tube,
    (ax + bx) / 2, (ay + by) / 2, z,
    r, L / 2, o.rz2 === undefined ? r : o.rz2,
    rz, 0,
    color, seed, o.wob === undefined ? 0.07 : o.wob, o.gloss || 0, o.ao || 0);
}

/* In 2D a character needs a painted shadow to sit down on the ground. In 3D
   the wrapped lighting and the ambient occlusion already do that, and a flat
   dark disc floating a unit above the surface only reads as a black smear. */
function contact3() {}

/* ---------------------------------------------------------------------- */
/*  Norbert                                                                 */
/* ---------------------------------------------------------------------- */

function norbert3(n, wx, wy) {
  const skin = n.paint ? mixHex(NB_SKIN, n.paint, 0.82) : NB_SKIN;
  const patch = n.paint ? mixHex(NB_PATCH, n.paint, 0.6) : NB_PATCH;
  const S = n.scale * 1.2;

  /* he turns rather than mirrors, because now he can */
  const want = n.facing > 0 ? 0 : Math.PI;
  let d = want - Scene3D.turn;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  Scene3D.turn += d * 0.28;
  const yaw = Scene3D.turn;

  const bob = Math.abs(Math.sin(n.walk)) * 1.6 * n.speed;
  const sx = n.sx, sy = n.sy;

  /* Rig space -> world. Callers hand in screen coordinates like every other
     rig in the game; the flip to real y happens once, here. */
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const put = (lx, ly, lz) => ({
    x: wx + (lx * S * sx) * cs + (lz * S) * sn,
    y: -(wy + ly * S * sy) + bob * 0.4 * S,
    z: Z_PLAY - (lx * S * sx) * sn + (lz * S) * cs,
  });
  /* a lump at rig coordinates */
  const put3 = (lx, ly, lz, rx, ry, rz, color, seed, wob, o) => {
    const p = put(lx, ly, lz);
    o = o || {};
    GL3.push(o.lo ? GL3.meshes.blobLo : GL3.meshes.blob,
      p.x, p.y, p.z, rx * S * sx, ry * S * sy, rz * S,
      o.rz || 0, yaw + (o.ry || 0),
      color, seed, wob === undefined ? 0.1 : wob, o.gloss || 0, o.ao || 0);
  };
  const putLimb = (x1, y1, x2, y2, lz, r, color, seed, o) => {
    o = o || {};
    const a = put(x1, y1, lz), b = put(x2, y2, lz);
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 0.001;
    GL3.push(GL3.meshes.tube, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2,
      r * S, L / 2, r * S, Math.atan2(-dx, dy), 0,
      color, seed, 0.06, o.gloss || 0, 0);
  };

  contact3(wx, wy, 15 * S * sx, 9 * S, 0.4);

  const legPhase = n.walk;
  const l1 = Math.sin(legPhase) * 3.4 * n.speed;
  const l2 = Math.sin(legPhase + Math.PI) * 3.4 * n.speed;
  const lift1 = Math.max(0, Math.sin(legPhase)) * 2.2 * n.speed;
  const lift2 = Math.max(0, Math.sin(legPhase + Math.PI)) * 2.2 * n.speed;

  /* legs: the right one is shorter, and Ivy decided that was fine */
  putLimb(5.2, -9, 5.6 + l2, -1.6 - lift2, -5, 2.9, skin, 31);
  put3(5.6 + l2, -1.6 - lift2, -5, 4.6, 2.8, 4.2, skin, 131, 0.16);
  putLimb(-5.4, -9, -5.8 + l1, -1.4 - lift1, 5, 3.1, skin, 17);
  put3(-5.8 + l1, -1.4 - lift1, 5, 5.4, 3.0, 4.6, skin, 117, 0.16);

  /* body, and the grey patch where the orange ran out */
  put3(0, -19 + 1.6, 0, 13.2, 13.6, 11.6, skin, 7, 0.085);
  put3(-2.4, -12.6, 9.6, 6.4, 4.4, 2.6, patch, 88, 0.18, { lo: true });

  /* the nub, and the armature wire still hopefully curling out of it */
  const nubX = 10.8, nubY = -25.5;
  put3(nubX, nubY, 0, 4.5, 3.9, 4.2, skin, 44, 0.15);
  putLimb(nubX + 2.4, nubY - 0.6, nubX + 5.8, nubY - 2.6, 0, 0.75, NB_WIRE, 61, { gloss: 0.85 });
  putLimb(nubX + 5.8, nubY - 2.6, nubX + 4.6, nubY - 5.2, 0, 0.7, NB_WIRE, 62, { gloss: 0.85 });

  /* head */
  const headY = -36.5 + bob * 0.55 - n.stretch * 1.5;
  put3(0, headY, 0, 10.2, 9.6, 9.2, skin, 3, 0.075);
  /* the pinched curl */
  putLimb(0.8, headY - 9.4, 2.6 + n.curl.a * 4.2, headY - 16.4, 0, 1.7, skin, 55);
  /* the thumbprint dent she pressed too hard */
  put3(-2.6, headY - 5.4, 8.0, 3.9, 2.5, 1.4, coolShade(skin, 0.30), 92, 0.2, { lo: true });

  /* the button */
  const bex = -4.2 + n.look.x * 0.7, bey = headY + 0.6 + n.look.y * 0.7;
  if (n.blink > 0) {
    put3(bex, bey, 8.2, 3.7, 1.1, 1.8, skin, 91, 0.12, { lo: true });
  } else {
    put3(bex, bey, 8.4, 3.7, 3.6, 1.5, '#f2e8d0', 92, 0.03, { gloss: 0.5, lo: true });
    put3(bex, bey, 9.2, 2.3, 2.2, 0.8, '#dccbab', 93, 0.03, { gloss: 0.45, lo: true });
    for (const h of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      put3(bex + h[0] * 1.1, bey + h[1] * 1.1, 9.7, 0.5, 0.5, 0.45, '#3a2018', 94, 0, { lo: true });
    }
  }
  /* the bead */
  const bdx = 4.9 + n.look.x * 0.5, bdy = headY - 1.1 + n.look.y * 0.5;
  if (n.blink <= 0) put3(bdx, bdy, 8.0, 2.1, 2.1, 1.9, '#20242e', 95, 0, { gloss: 0.95, lo: true });

  /* one eyebrow, over the bead only. There was only enough for one. */
  putLimb(bdx - 2.6, headY - 4.4, bdx + 2.8, headY - 5.0 - (n.mood === 'happy' ? 0.9 : 0), 8.2,
    0.75, coolShade(skin, 0.4), 96);

  /* a mouth, pressed in with the end of a paintbrush */
  const mouthCol = coolShade(skin, 0.5);
  const my = headY + 4.9;
  if (n.mood === 'oh') {
    put3(0.4, my, 8.6, 1.9, 2.3, 1.0, mouthCol, 97, 0.08, { lo: true });
  } else if (n.mood === 'happy' || n.mood === 'grin') {
    putLimb(-3.2, my - 1.6, -0.2, my + 0.9, 8.4, 0.7, mouthCol, 98);
    putLimb(-0.2, my + 0.9, 3.4, my - 1.6, 8.4, 0.7, mouthCol, 99);
  } else if (n.mood === 'sad') {
    putLimb(-3.2, my + 1.0, -0.2, my - 1.2, 8.4, 0.7, mouthCol, 98);
    putLimb(-0.2, my - 1.2, 3.4, my + 1.0, 8.4, 0.7, mouthCol, 99);
  } else {
    putLimb(-2.6, my - 0.4, 2.8, my - 0.2, 8.4, 0.7, mouthCol, 98);
  }

  /* the long arm, which is much too long and he knows it */
  const shX = -11.6, shY = -26.5;
  let hx, hy;
  if (n.reach) { hx = n.reach.x; hy = n.reach.y; }
  else {
    hx = shX - 5.4 + n.armSwing * 6.4;
    hy = -5.4 + Math.abs(n.armSwing) * -1.8 + (n.air ? 5 * n.air : 0);
  }
  put3(shX + 1.4, shY + 0.6, 2, 4.0, 4.2, 4.0, skin, 66, 0.12);
  const midX = (shX + hx) / 2 - 3.2, midY = (shY + hy) / 2;
  putLimb(shX, shY, midX, midY, 3.5, 2.7, skin, 21);
  putLimb(midX, midY, hx, hy, 3.5, 2.3, skin, 22);
  put3(hx, hy, 3.5, 3.4, 3.1, 3.0, skin, 23, 0.18);
}

/* ---------------------------------------------------------------------- */
/*  The rest of the cast                                                    */
/* ---------------------------------------------------------------------- */

const CAST3 = {};

CAST3.gary = function (n, x, y) {
  const S = n.scale, f = n.facing;
  const bob = Math.sin(n.t * 1.6 + n.bobPhase) * 1.4;
  const yy = y + bob * 0.4;
  contact3(x, y, 15 * S, 10 * S);
  /* twig legs */
  limb3(x - 4 * S, yy - 6 * S, x - 5.5 * S, yy - 0.5 * S, Z_PLAY, 0.8 * S, '#5c4326', 12, { gloss: 0.3 });
  limb3(x + 4 * S, yy - 6 * S, x + 5.5 * S, yy - 0.5 * S, Z_PLAY, 0.8 * S, '#5c4326', 13, { gloss: 0.3 });
  /* the cone, in rings of scales */
  const H = 44 * S;
  for (let row = 0; row < 9; row++) {
    const rt = row / 8;
    const ry0 = yy - 4 * S - rt * H;
    const rw = (13.5 * Math.sin((1 - rt) * 1.5 + 0.34) + 1.5) * S;
    const count = Math.max(3, Math.round(7 - rt * 3));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + row * 0.4;
      const px = Math.cos(a) * rw, pz = Math.sin(a) * rw * 0.8;
      const tone = ['#6b4a2b', '#7d5931', '#5c3f24'][(row + i) % 3];
      blob3(x + px, ry0 + Math.abs(px) * 0.10, Z_PLAY + pz,
        5.0 * S, 3.2 * S, 3.4 * S, tone, n.seed + row * 7 + i, 0.22,
        { rz: px * 0.02, lo: true });
    }
  }
  blob3(x + 0.4 * S, yy - 4 * S - H - 5 * S, Z_PLAY, 3.2 * S, 4.4 * S, 3.2 * S, '#7d5931', n.seed + 90, 0.2);
  /* googly eyes, glued on crooked, and the glue is still shiny */
  googly3(x - 5.2 * S * f, yy - 30 * S, Z_PLAY + 7 * S, 5.2 * S, f);
  googly3(x + 5.4 * S * f, yy - 32.6 * S, Z_PLAY + 6.4 * S, 4.1 * S, f);
  /* half a pipe-cleaner moustache */
  limb3(x - 1 * S * f, yy - 23.5 * S, x - 13 * S * f, yy - 21 * S, Z_PLAY + 7 * S, 1.9 * S, '#d98a2b', n.seed + 4, { wob: 0.3 });
};

function googly3(x, y, z, r, f) {
  blob3(x, y, z, r, r, r * 0.7, '#f4f2ea', 21, 0.02, { gloss: 0.8, lo: true });
  blob3(x + (f || 1) * r * 0.18, y - r * 0.1, z + r * 0.55, r * 0.46, r * 0.46, r * 0.3, '#14161c', 22, 0, { gloss: 0.9, lo: true });
}

CAST3.beans = function (n, x, y) {
  const S = n.scale;
  const hop = Math.max(0, Math.sin(n.t * 2.2)) * (n.hoppy ? 4.5 : 0.9);
  const sq = n.talk > 0 ? Math.abs(Math.sin(n.t * 9)) * 0.22 : 0;
  contact3(x, y, 9 * S, 7 * S);
  blob3(x, y - (7.5 * S + hop), Z_PLAY, 8.6 * S * (1 + sq), 7.6 * S * (1 - sq * 0.8), 8.0 * S,
    '#8b9078', n.seed + 1, 0.18);
  blob3(x - 1.2 * S, y - (9.6 * S + hop), Z_PLAY + 7 * S, 2.0 * S, 2.0 * S, 1.6 * S,
    '#20242e', 3, 0, { gloss: 0.95, lo: true });
};

CAST3.pippa = function (n, x, y) {
  const S = n.scale, f = n.facing;
  const sway = Math.sin(n.t * 0.9) * 2.2;
  const PINK = '#e5539b', PINK2 = '#f27ab5';
  contact3(x, y, 13 * S, 9 * S);
  limb3(x - 1 * S, y - 26 * S, x - 3 * S + sway * 0.2, y - 1 * S, Z_PLAY, 1.5 * S, PINK, 1, { wob: 0.35 });
  if (n.hasLeg !== false) {
    limb3(x + 2 * S, y - 26 * S, x + 5 * S + sway * 0.2, y - 1 * S, Z_PLAY, 1.5 * S, PINK, 2, { wob: 0.35 });
  } else if (n.clayLeg) {
    limb3(x + 2 * S, y - 26 * S, x + 5 * S + sway * 0.2, y - 1.5 * S, Z_PLAY, 2.3 * S, NB_SKIN, 77, { wob: 0.12 });
    blob3(x + 5 * S, y - 1 * S, Z_PLAY, 4 * S, 2.2 * S, 3.4 * S, NB_SKIN, 78, 0.2);
  }
  /* a fat coil of chenille */
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    limb3(x - (9 - t * 2) * S, y - (32 - t * 1.6) * S, x + (9 - t * 2) * S, y - (30 - t * 1.6) * S,
      Z_PLAY + (t - 0.5) * 9 * S, (3.4 - t * 0.9) * S, i % 2 ? PINK : PINK2, n.seed + 10 + i, { wob: 0.34 });
  }
  /* the neck. An S. Always an S. */
  const nk = (t) => ({
    x: x + (-2 + Math.sin(t * 3.0 - 0.2) * 9 - t * 1.5) * S * f,
    y: y - (34 + t * 26) * S,
  });
  for (let i = 0; i < 9; i++) {
    const p0 = nk(i / 9), p1 = nk((i + 1) / 9);
    limb3(p0.x, p0.y, p1.x, p1.y, Z_PLAY, 2.0 * S, i % 2 ? PINK : PINK2, n.seed + 30 + i, { wob: 0.34 });
  }
  const hd = nk(1);
  blob3(hd.x, hd.y, Z_PLAY, 3.6 * S, 3.0 * S, 3.2 * S, PINK, n.seed + 50, 0.3);
  limb3(hd.x - 3 * S * f, hd.y + 0.6 * S, hd.x - 12 * S * f, hd.y + 2.4 * S, Z_PLAY, 1.5 * S, '#1c1a20', 51, { gloss: 0.7 });
  blob3(hd.x - 1.4 * S * f, hd.y - 1.6 * S, Z_PLAY + 3 * S, 1.4 * S, 1.4 * S, 1.2 * S, '#141018', 52, 0, { gloss: 0.95, lo: true });
  /* one sequin, load-bearing to her entire self-image */
  blob3(hd.x + 3.4 * S * f, hd.y - 3.6 * S, Z_PLAY + 3 * S, 2.0 * S, 2.0 * S, 0.5 * S, '#ffd75e', 53, 0, { gloss: 1, lo: true });
};

CAST3.steve = function (n, x, y) {
  const S = n.scale, f = n.facing;
  const CREAM = '#e2d9c2', GLAZE = '#4a7ea8';
  const W = 23 * S, H = 42 * S;
  contact3(x, y, 26 * S, 15 * S);
  /* fired: smooth, glossy, no thumbprints anywhere */
  const g = { gloss: 0.85 };
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const yy = y - t * H;
    const r = W * (0.88 + t * 0.12);
    blob3(x, yy - H * 0.07, Z_PLAY, r, H * 0.10, r, t > 0.45 ? GLAZE : CREAM, 2, 0.01, g);
  }
  /* the rim, and the chip out of it */
  blob3(x, y - H, Z_PLAY, W, W * 0.22, W, '#3a3a44', 4, 0.01, g);
  blob3(x, y - H + 1.5 * S, Z_PLAY, W * 0.84, W * 0.18, W * 0.84, '#1e2028', 5, 0.01, g);
  /* the handle. On the inside. Nobody knows how. */
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.18 + i * 0.13);
    const b = Math.PI * (0.18 + (i + 1) * 0.13);
    limb3(x + Math.cos(a) * W * 0.5, y - H + 5 * S + Math.sin(a) * 9 * S,
      x + Math.cos(b) * W * 0.5, y - H + 5 * S + Math.sin(b) * 9 * S,
      Z_PLAY, 2.2 * S, '#c9c0aa', 30 + i, g);
  }
  /* a face, painted on slightly to the left of where it should be */
  const ey = y - H * 0.60;
  const px = Z_PLAY + W * 0.86;
  blob3(x - 7.5 * S * f, ey, px, 2.1 * S, 2.6 * S, 0.6 * S, '#2a2530', 6, 0, { gloss: 0.9, lo: true });
  blob3(x + 3.5 * S * f, ey - 0.4 * S, px, 1.9 * S, 2.4 * S, 0.6 * S, '#2a2530', 7, 0, { gloss: 0.9, lo: true });
  /* eyebrows of a man who has been through the kiln */
  limb3(x - 11 * S * f, ey - 6 * S, x - 5 * S * f, ey - 4.6 * S, px, 0.8 * S, '#2a2530', 8, { gloss: 0.8 });
  limb3(x + 0.6 * S * f, ey - 5.2 * S, x + 6.2 * S * f, ey - 7.2 * S, px, 0.8 * S, '#2a2530', 9, { gloss: 0.8 });
  /* the flattest mouth ever painted on anything */
  if (n.mood === 'warm') {
    limb3(x - 7 * S * f, y - H * 0.36, x - 2 * S * f, y - H * 0.31, px, 0.8 * S, '#2a2530', 10, { gloss: 0.8 });
    limb3(x - 2 * S * f, y - H * 0.31, x + 3.6 * S * f, y - H * 0.36, px, 0.8 * S, '#2a2530', 11, { gloss: 0.8 });
  } else {
    limb3(x - 8 * S * f, y - H * 0.34, x + 3.6 * S * f, y - H * 0.35, px, 0.8 * S, '#2a2530', 10, { gloss: 0.8 });
  }
};

CAST3.glaze = function (n, x, y) {
  const S = n.scale, f = n.facing;
  const P = '#f4f2ec';
  /* perfect: no wobble anywhere, which is the single worst thing about her */
  const g = { gloss: 0.92 };
  contact3(x, y, 20 * S, 12 * S);
  blob3(x, y - 16 * S, Z_PLAY, 19 * S, 14.5 * S, 15 * S, P, 1, 0, g);
  /* the wing, one flawless sweep */
  blob3(x + 3 * S * f, y - 19 * S, Z_PLAY + 9 * S, 14 * S, 9 * S, 4 * S, '#eceae4', 2, 0, { gloss: 0.95, rz: -0.3 * f });
  blob3(x + 3 * S * f, y - 19 * S, Z_PLAY - 9 * S, 14 * S, 9 * S, 4 * S, '#e2e6e6', 3, 0, { gloss: 0.95, rz: -0.3 * f });
  /* the neck: a perfect circular arc, of course */
  for (let i = 0; i < 7; i++) {
    const a0 = 0.35 + (i / 7) * 1.4, a1 = 0.35 + ((i + 1) / 7) * 1.4;
    const c = i > 3 ? P : mixHex(P, '#7ac4d8', 0.35);
    limb3(x + (-13 + Math.cos(a0) * 14) * S * f, y - (33 + Math.sin(a0) * 14) * S,
      x + (-13 + Math.cos(a1) * 14) * S * f, y - (33 + Math.sin(a1) * 14) * S,
      Z_PLAY, 3.6 * S, c, 10 + i, g);
  }
  const hx = x + (-13 + Math.cos(0.35) * 14 - 1) * S * f;
  const hy = y - (33 + Math.sin(0.35) * 14 + 12) * S;
  blob3(hx, hy, Z_PLAY, 6.2 * S, 5.4 * S, 5.6 * S, P, 20, 0, g);
  /* gold lustre beak */
  limb3(hx - 4 * S * f, hy + 1 * S, hx - 13 * S * f, hy + 2.4 * S, Z_PLAY, 2.2 * S, '#d9ab3c', 21, { gloss: 1 });
  blob3(hx - 1.2 * S * f, hy - 1.2 * S, Z_PLAY + 4 * S, 1.5 * S, 1.9 * S, 1.2 * S, '#2b3138', 22, 0, { gloss: 1, lo: true });
};

CAST3.sock = function (n, x, y) {
  const S = n.scale, f = n.facing;
  const A = '#dcd6c8', B = '#b8535e';
  const gape = n.talk > 0 ? 0.35 + Math.abs(Math.sin(n.t * 14)) * 0.55 : 0.12;
  contact3(x, y, 20 * S, 12 * S);
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    const yy = y - (6 + t * 44) * S;
    const rr = (12 - t * 1.2 + Math.sin(t * 4) * 1.2) * S;
    blob3(x + Math.sin(t * 2.2 + n.t * 0.6) * 4 * t * S, yy, Z_PLAY,
      rr, 5.4 * S, rr * 0.85, i % 3 === 0 ? B : A, n.seed + i, 0.13);
  }
  const hx = x + Math.sin(2.2 + n.t * 0.6) * 4 * S, hy = y - 52 * S;
  blob3(hx - 3 * S * f, hy - 4 * S, Z_PLAY, 15 * S, 7 * S, 11 * S, A, n.seed + 40, 0.11, { rz: -gape * 0.5 * f });
  blob3(hx - 3 * S * f, hy + 3.4 * S, Z_PLAY, 14 * S, 6 * S, 10 * S, A, n.seed + 41, 0.11, { rz: gape * 0.5 * f });
  blob3(hx - 10 * S * f, hy + 1.6 * S, Z_PLAY + 2 * S, 7 * S, 2.6 * S, 5 * S, '#c4566a', n.seed + 42, 0.15);
  googly3(hx - 3 * S * f, hy - 9.5 * S, Z_PLAY + 9 * S, 4.6 * S, f);
  googly3(hx + 4.2 * S * f, hy - 10.6 * S, Z_PLAY + 8 * S, 4.0 * S, f);
};

CAST3.macaroni = function (n, x, y) {
  const S = n.scale;
  contact3(x, y, 17 * S, 10 * S);
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI * 0.5 + (i / (N - 1)) * TAU;
    const wob2 = n.talk > 0 ? Math.sin(n.t * 12 + i) * 1.4 : Math.sin(n.t * 1.4 + i * 0.5) * 0.5;
    blob3(x + Math.cos(a) * 14 * S, y - 22 * S + (Math.sin(a) * 20 + wob2) * S, Z_PLAY,
      2.6 * S, 4.4 * S, 2.6 * S, ['#e6c877', '#dcb85e', '#efd48d'][i % 3], n.seed + i * 3, 0.14,
      { rz: a + 1.57, gloss: 0.35, lo: true });
  }
  blob3(x - 4.6 * S, y - 30 * S, Z_PLAY + 4 * S, 1.7 * S, 1.7 * S, 1.4 * S, '#20242e', 5, 0, { gloss: 0.9, lo: true });
  blob3(x + 4.2 * S, y - 30 * S, Z_PLAY + 4 * S, 1.7 * S, 1.7 * S, 1.4 * S, '#20242e', 6, 0, { gloss: 0.9, lo: true });
};

CAST3.volcano = function (n, x, y) {
  const S = n.scale;
  contact3(x, y, 34 * S, 20 * S);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const r = (34 - t * 26) * S;
    blob3(x, y - (t * 48 + 3) * S, Z_PLAY, r, 5.4 * S, r, '#7d6b58', n.seed + i, 0.14);
  }
  blob3(x, y - 47 * S, Z_PLAY, 9 * S, 2.6 * S, 9 * S, '#8c2f22', n.seed + 20, 0.1);
  googly3(x - 11 * S, y - 20 * S, Z_PLAY + 22 * S, 5.4 * S, 1);
  googly3(x + 10 * S, y - 21 * S, Z_PLAY + 22 * S, 5.0 * S, 1);
  if (n.erupt > 0) {
    for (let i = 0; i < 14; i++) {
      const t = ((n.t * 2.4 + i * 0.13) % 1);
      const d = t * 60 * n.erupt * S;
      blob3(x + shash1(i * 3) * d * 0.4, y - 47 * S - d, Z_PLAY + shash1(i * 7) * d * 0.3,
        (2 + t * 6) * S, (2 + t * 6) * S, (2 + t * 6) * S, '#fff6ea', 40 + i, 0.3, { lo: true });
    }
  }
};

CAST3.thumb = function (n, x, y) {
  const d = clamp(n.desc || 0, 0, 1);
  if (d <= 0.001) return;
  const S = n.scale || 1;
  const H = 460 * S;
  const ty = y - (1 - d) * H * 1.35;      /* screen y of the tip */
  const SKIN = '#e0a98c';
  const R = 47 * S;
  const zc = Z_PLAY + 16 * S;

  /* one digit, not a stack of doughnuts */
  limb3(x, ty - R, x, ty - H, zc, R, SKIN, 200, { wob: 0.035, gloss: 0.26, rz2: R * 0.88 });
  blob3(x, ty - R * 0.95, zc, R * 1.02, R * 0.98, R * 0.9, SKIN, 201, 0.05, { gloss: 0.28 });

  /* knuckle creases */
  for (let i = 0; i < 3; i++) {
    limb3(x - R * 0.92, ty - H * 0.66 + i * 9 * S, x + R * 0.92, ty - H * 0.66 + i * 9 * S,
      zc + R * 0.5, 1.6 * S, '#c98d74', 210 + i, { wob: 0.05, gloss: 0.2 });
  }

  /* THE FINGERPRINT: concentric, enormous, and the single most alien thing in
     this entire craft room */
  for (let i = 1; i < 8; i++) {
    const rr = i * 5.6 * S;
    const steps = 8 + i * 5;
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * TAU;
      blob3(x + Math.cos(a) * rr, ty - 50 * S + Math.sin(a) * rr * 1.2,
        zc + R * 0.86 - rr * 0.12,
        1.5 * S, 1.5 * S, 0.9 * S, '#cf9077', 300 + i * 40 + k, 0, { lo: true });
    }
  }
};

/* ---------------------------------------------------------------------- */
/*  Props and scenery                                                       */
/* ---------------------------------------------------------------------- */

function props3(lv, t, cx, cw) {
  const near = (x) => x > cx - 220 && x < cx + cw + 220;
  for (const pr of lv.props) {
    if (!near(pr.x)) continue;
    switch (pr.kind) {
      case 'gate': {
        const gw = (pr.wid || 1) * TILE, gh = (pr.hgt || 3) * TILE;
        const gy = pr.y - gh * (1 - pr.open);
        blob3(pr.x + gw / 2, gy + gh / 2, Z_PLAY, gw * 0.52, gh * 0.5, 22, pr.color || '#7d6a52', 14, 0.05);
        if (pr.needColor) {
          blob3(pr.x + gw / 2, gy + gh * 0.5, Z_PLAY + 24, 7, 7, 5, pr.needColor, 19, 0.05, { gloss: 0.8, lo: true });
        }
        break;
      }
      case 'plate': {
        const w = (pr.wid || 1) * TILE;
        const d = (pr.press || 0) * 5;
        blob3(pr.x + w / 2, pr.y - 4 - d, Z_PLAY, w / 2, 6, 22, pr.on ? '#e0a24a' : '#9b8f7c', 41, 0.05, { gloss: 0.4 });
        break;
      }
      case 'sponge': {
        const w = (pr.wid || 2) * TILE;
        blob3(pr.x + w / 2, pr.y - 9 - (pr.sink || 0) * -1, Z_PLAY, w / 2, 10, 26, '#e8c85a', 55, 0.16);
        break;
      }
      case 'lid': {
        const w = (pr.wid || 2) * TILE;
        const yy = pr.y + Math.sin(pr.t * (pr.spd || 1)) * (pr.amp || 0);
        blob3(pr.x + w / 2, yy - 6, Z_PLAY, w / 2, 7, 26, pr.color || '#b4483c', 91, 0.05, { gloss: 0.45 });
        break;
      }
      case 'pot': {
        const x = pr.x + 16;
        blob3(x, pr.y - 11, Z_PLAY, 14, 12, 13, '#a2694a', 62, 0.11);
        blob3(x, pr.y - 22, Z_PLAY, 11, 4, 10, '#7d4e37', 63, 0.12);
        if (pr.lit) blob3(x, pr.y - 26, Z_PLAY, 7, 2, 6, '#ffd9a0', 64, 0.1, { gloss: 0.6, lo: true });
        break;
      }
      case 'spout': {
        blob3(pr.x + 8, pr.y + 8, Z_PLAY, 11, 9, 10, '#6d6a66', 72, 0.1, { gloss: 0.5 });
        break;
      }
      case 'vat': {
        const w = (pr.wid || 2) * TILE;
        blob3(pr.x + w / 2, pr.y + 4, Z_PLAY, w / 2 + 5, 8, 30, '#8e8577', 84, 0.06, { gloss: 0.4 });
        blob3(pr.x + w / 2, pr.y - 2 + Math.sin(t * 2.6) * 0.8, Z_PLAY, w / 2 - 1, 5, 26, pr.color, 85, 0.08, { gloss: 0.75 });
        break;
      }
      case 'sign': {
        const x = pr.x + 16;
        limb3(x, pr.y, x, pr.y - 30, Z_PLAY + 16, 2.4, '#7a5b3a', 45);
        const lines = (pr.text || '').split('|');
        const w = 9 + lines.reduce((m, L) => Math.max(m, L.length), 0) * 2.4;
        blob3(x, pr.y - 42, Z_PLAY + 18, w, lines.length * 5.4 + 5, 2.4, '#e2d2a8', 46, 0.05);
        Scene3D.labels.push({ x, y: pr.y - 42, z: Z_PLAY + 21, lines });
        break;
      }
      case 'item': {
        if (pr.taken) break;
        const yy = pr.y - 6 + Math.sin(t * 2 + pr.x) * 3;
        if (pr.icon === 'eye') googly3(pr.x + 12, yy, Z_PLAY + 20, 9, 1);
        else blob3(pr.x + 12, yy, Z_PLAY + 20, 8, 8, 8, '#ffd75e', 88, 0.1, { gloss: 0.9 });
        break;
      }
      case 'updraft': {
        const w = (pr.wid || 2) * TILE, h = (pr.hgt || 5) * TILE;
        for (let i = 0; i < 10; i++) {
          const ph = ((t * 0.75 + i * 0.1) % 1);
          blob3(pr.x + 8 + ((i * 53) % (w - 16)), pr.y - ph * h, Z_PLAY - 10,
            2, 5 + ph * 5, 2, '#ffcf8a', 70 + i, 0.2, { lo: true, gloss: 0.5 });
        }
        break;
      }
    }
  }

  /* the level's scattered craft-shop bits, as simple solids */
  for (const d of lv.deco) {
    if (!near(d.x)) continue;
    const z = d.layer === 'back' ? Z_PLAY - 90 : (d.layer === 'fore' ? Z_PLAY + 70 : Z_PLAY - 26);
    switch (d.k) {
      case 'pencil': {
        const L = d.len || 120, a = d.rot || 0;
        limb3(d.x, d.y, d.x + Math.cos(a) * L, d.y + Math.sin(a) * L, z, 8, d.color || '#e0b73c', 31, { wob: 0.02, gloss: 0.4 });
        blob3(d.x + Math.cos(a) * (L + 10), d.y + Math.sin(a) * (L + 10), z, 7, 7, 7, '#3a3a42', 32, 0.05);
        blob3(d.x - Math.cos(a) * 14, d.y - Math.sin(a) * 14, z, 7, 8, 7, '#d2647a', 33, 0.1);
        break;
      }
      case 'eraser': addBoxProp(d.x, d.y, z, d.w || 26, d.h || 14, 16, d.color || '#e2dcc8', 34); break;
      case 'domino': addBoxProp(d.x, d.y, z, 13, 26, 7, '#2d2b33', 36); break;
      case 'button': blob3(d.x, d.y, z, d.r || 14, d.r || 14, 3, d.color || '#7ab0c4', 35, 0.03, { gloss: 0.6 }); break;
      case 'bead': blob3(d.x, d.y, z, d.r || 8, d.r || 8, d.r || 8, d.color || '#5aa8c8', 40, 0.02, { gloss: 0.9 }); break;
      case 'splat': blob3(d.x, d.y, z, d.r || 22, 2.5, (d.r || 22) * 0.5, d.color || '#d94f9c', 39, 0.3, { gloss: 0.5 }); break;
      case 'crumple': blob3(d.x, d.y, z, d.r || 26, (d.r || 26) * 0.85, d.r || 26, d.color || '#e6e0cc', 49, 0.30); break;
      case 'cotton': {
        const r = d.r || 20;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          blob3(d.x + Math.cos(a) * r * 0.5, d.y + Math.sin(a) * r * 0.4, z + Math.sin(a * 2) * r * 0.4,
            r * 0.6, r * 0.55, r * 0.6, '#faf7ee', 37 + i, 0.35, { lo: true });
        }
        break;
      }
      case 'jar': {
        const w = d.w || 34, h = d.h || 46;
        blob3(d.x, d.y - h * 0.45, z, w / 2, h / 2, w / 2, d.color || '#3fb2c9', 43, 0.03, { gloss: 0.75 });
        blob3(d.x, d.y - h * 0.92, z, w * 0.42, 6, w * 0.42, '#c8c2b2', 44, 0.05);
        break;
      }
      case 'brush': {
        const a = d.rot || -1.2, L = d.len || 90;
        limb3(d.x, d.y, d.x + Math.cos(a) * L, d.y + Math.sin(a) * L, z, 4.2, '#6b4a2e', 47, { wob: 0.03 });
        blob3(d.x + Math.cos(a) * (L + 10), d.y + Math.sin(a) * (L + 10), z, 8, 6, 6, d.color || '#b8563f', 48, 0.2);
        break;
      }
      case 'thread': {
        const L = d.len || 200;
        for (let i = 0; i < 10; i++) {
          const u0 = i / 10, u1 = (i + 1) / 10;
          const f = (u) => ({ x: d.x + u * L, y: d.y + Math.sin(u * 7 + (d.ph || 0)) * 14 * Math.sin(u * Math.PI) + u * (d.drop || 0) });
          const a = f(u0), b = f(u1);
          limb3(a.x, a.y, b.x, b.y, z, 1.6, d.color || '#c85a7a', 50 + i, { wob: 0.1 });
        }
        break;
      }
      case 'paperclip': {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const b = ((i + 1) / 6) * TAU;
          limb3(d.x + Math.cos(a) * 14, d.y + Math.sin(a) * 10, d.x + Math.cos(b) * 14, d.y + Math.sin(b) * 10,
            z, 1.8, '#98a4ae', 60 + i, { gloss: 0.9, wob: 0 });
        }
        break;
      }
    }
  }
}

function addBoxProp(x, y, z, hx, hy, hz, color, seed) {
  blob3(x, y, z, hx, hy, hz, color, seed, 0.04);
}

/* ---------------------------------------------------------------------- */
/*  The frame                                                               */
/* ---------------------------------------------------------------------- */

const _view = new Float32Array(16), _proj = new Float32Array(16), _vp = new Float32Array(16);

Scene3D.frame = function (lv, p, W, H, t) {
  if (!GL3.ok) return;

  if (Scene3D.levelId !== lv.data.id) {
    GL3.dispose(Scene3D.slab); GL3.dispose(Scene3D.top); GL3.dispose(Scene3D.planks);
    const m = buildTerrainMesh(lv);
    Scene3D.slab = m.slab; Scene3D.top = m.top; Scene3D.planks = m.planks;
    Scene3D.levelId = lv.data.id;
  }

  const th = lv.theme;
  const cx = Cam.viewX(), cy = Cam.viewY();
  const ccx = cx + W / 2, ccy = cy + H / 2;

  /* framed so the play plane matches the 2D camera exactly, then tipped a
     few degrees so you can see the ground is a solid thing */
  const fov = 30 * Math.PI / 180;
  const dist = (H / 2) / Math.tan(fov / 2);
  const ex = ccx, ey = -ccy + dist * 0.17, ez = Z_PLAY + dist * 0.985;
  m4perspective(_proj, fov, W / H, 20, dist * 3.2);
  m4lookAt(_view, ex, ey, ez, ccx, -ccy, Z_PLAY);
  m4mul(_vp, _proj, _view);

  const key = hex2rgb(th.key || '#fff4cd');
  const amb = hex2rgb(th.shadow || '#281e3e');
  const lightDir = [-0.42, 0.74, 0.52];
  const ll = Math.hypot(lightDir[0], lightDir[1], lightDir[2]);

  Scene3D.labels.length = 0;
  Scene3D.vp = _vp;
  GL3.boil = Clay.frame * 0.37;
  GL3.begin(
    { viewProj: _vp, ex, ey, ez },
    {
      key: new Float32Array([key.r / 255 * 1.16, key.g / 255 * 1.10, key.b / 255 * 0.99]),
      amb: new Float32Array([amb.r / 255 * 1.05 + 0.07, amb.g / 255 * 1.05 + 0.07, amb.b / 255 * 1.15 + 0.09]),
      dir: new Float32Array([lightDir[0] / ll, lightDir[1] / ll, lightDir[2] / ll]),
    }
  );

  GL3.drawStatic(Scene3D.slab, lv.data.ground || th.ground, 0);
  GL3.drawStatic(Scene3D.top, lv.data.groundTop || th.groundTop, 0);
  GL3.drawStatic(Scene3D.planks, '#d3b483', 0);

  props3(lv, t, cx, W);

  for (const n of lv.npcs) {
    if (n.hidden) continue;
    if (n.kind !== 'thumb' && (n.x < cx - 300 || n.x > cx + W + 300)) continue;
    const f = CAST3[n.kind];
    if (f) f(n, n.x, n.y);
  }

  for (const b of lv.blobs) {
    if (b.x < cx - 80 || b.x > cx + W + 80) continue;
    blob3(b.x, b.y, Z_PLAY, b.r, b.r * 0.94, b.r * 0.94, b.color || NB_SKIN, b.seed || 5, 0.2);
  }

  if (p && !p.hidden) norbert3(p.rig, p.x, p.y);

  GL3.flush();
};

/* Project a world point onto the 2D overlay, so the things that are made of
   words -- signs, mostly -- can still be read. */
Scene3D.project = function (x, y, z, W, H) {
  const m = Scene3D.vp;
  if (!m) return null;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0.001) return null;
  return { x: (cx / cw * 0.5 + 0.5) * W, y: (0.5 - cy / cw * 0.5) * H, s: 1 / cw };
};

Scene3D.drawLabels = function (ctx, W, H) {
  if (!Scene3D.labels.length) return;
  ctx.save();
  ctx.fillStyle = '#5a4230';
  for (const L of Scene3D.labels) {
    const p = Scene3D.project(L.x, -L.y, L.z, W, H);
    if (!p) continue;
    /* one world unit is very nearly one logical pixel at this framing, so
       size the lettering the same way the 2D signs do */
    const pxPerUnit = p.s * 3.732 * H / 2;
    const size = clamp(8.6 * pxPerUnit, 5, 14);
    ctx.font = '700 ' + size.toFixed(1) + 'px ' + UI_FONT;
    for (let i = 0; i < L.lines.length; i++) {
      const t = L.lines[i];
      const w = ctx.measureText(t).width;
      jitterText(ctx, t, p.x - w / 2, p.y + (i - (L.lines.length - 1) / 2) * size * 1.15 + size * 0.35, i * 7, 0.4);
    }
  }
  ctx.restore();
};

/* =========================================================================
   NORBERT, UNFINISHED  --  clay.js
   The claymation renderer.

   Everything visible in this game is drawn here. There are no sprites and no
   image files: every character, prop and hillside is a lumpy polygon that gets
   run through the same little material shader below -- warm key light from the
   upper left, violet ambient shadow, an inner rim, a soft specular, pressed
   thumbprints and a film grain on top.

   Two details do most of the work:
     * silhouettes are never perfect. Each blob's radius is a sum of sine
       harmonics seeded per object, so nothing is ever a true circle.
     * BOIL. Real stop-motion wobbles because the animator re-touched the model
       between frames. Clay.frame ticks at 12fps and nudges every silhouette,
       so the whole picture simmers the way claymation does.
   ========================================================================= */

const Clay = {
  frame: 0,          // 12fps stop-motion tick
  time: 0,           // seconds
  quality: 1,        // 1 = full, 0 = reduced (skip prints/grain)
  _grainPat: null,
  _paperPat: null,
};

/* ---------------------------------------------------------------------- */
/*  Silhouettes                                                            */
/* ---------------------------------------------------------------------- */

/* Periodic lumpy radius. Smooth by construction, so no seams. */
function _lumpR(theta, seed, wob, boil) {
  const p1 = hash1(seed * 1.7) * TAU, p2 = hash1(seed * 3.3 + 5) * TAU, p3 = hash1(seed * 7.1 + 9) * TAU;
  let b1 = 0, b2 = 0;
  if (boil) {
    b1 = shash1(Clay.frame * 0.37 + seed) * boil;
    b2 = shash1(Clay.frame * 0.91 + seed * 2.1 + 40) * boil;
  }
  return 1 + wob * (
    0.50 * Math.sin(2 * theta + p1 + b1) +
    0.30 * Math.sin(3 * theta + p2 + b2) +
    0.17 * Math.sin(5 * theta + p3) +
    0.09 * Math.sin(7 * theta + p1 * 2)
  );
}

/* Build (and path) a lumpy ellipse. */
Clay.blobPath = function (ctx, x, y, rx, ry, seed, wob, rot, boil, n) {
  n = n || 22;
  wob = wob === undefined ? 0.11 : wob;
  rot = rot || 0;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    const r = _lumpR(t, seed, wob, boil);
    const lx = Math.cos(t) * rx * r, ly = Math.sin(t) * ry * r;
    const px = x + lx * cos - ly * sin, py = y + lx * sin + ly * cos;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
};

/* ---------------------------------------------------------------------- */
/*  The clay material                                                      */
/* ---------------------------------------------------------------------- */

/* Applies clay shading to whatever path is currently on ctx.
   bb = {x,y,w,h} bounding box, used to aim the gradients.               */
Clay.material = function (ctx, bb, color, o) {
  o = o || {};
  const lightAmt = o.light === undefined ? 1 : o.light;
  const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  const R = Math.max(bb.w, bb.h) / 2;

  ctx.save();
  if (o.p2d) ctx.clip(o.p2d); else ctx.clip();

  /* 1. base -- warm light upper-left, violet ambient lower-right.
        Wide surfaces (terrain) light from straight above instead, otherwise
        the gradient stretches into a ramp across the whole hillside. */
  const g = o.vert
    ? ctx.createLinearGradient(bb.x, bb.y, bb.x + 14, bb.y + Math.min(bb.h, o.vertH || 150))
    : ctx.createLinearGradient(bb.x + bb.w * 0.12, bb.y, bb.x + bb.w * 0.92, bb.y + bb.h);
  g.addColorStop(0, warmLight(color, 0.34 * lightAmt));
  g.addColorStop(0.40, warmLight(color, 0.06 * lightAmt));
  g.addColorStop(0.72, coolShade(color, 0.18));
  g.addColorStop(1, coolShade(color, 0.42));
  ctx.fillStyle = g;
  ctx.fillRect(bb.x - 2, bb.y - 2, bb.w + 4, bb.h + 4);

  /* 2. bottom-heavy occlusion so the form feels rounded and grounded */
  if (o.ao !== false) {
    const og = ctx.createRadialGradient(cx, bb.y + bb.h * 1.02, R * 0.15, cx, bb.y + bb.h * 0.98, R * 1.35);
    og.addColorStop(0, 'rgba(38,22,46,0.34)');
    og.addColorStop(1, 'rgba(38,22,46,0)');
    ctx.fillStyle = og;
    ctx.fillRect(bb.x - 2, bb.y - 2, bb.w + 4, bb.h + 4);
  }

  /* 3. inner rim light along the top-left edge (stroke, clipped inward) */
  if (o.rim !== false) {
    const rg = ctx.createLinearGradient(bb.x, bb.y, bb.x + bb.w * 0.85, bb.y + bb.h * 0.9);
    rg.addColorStop(0, rgba(warmLight(color, 0.72), 0.85 * lightAmt));
    rg.addColorStop(0.35, rgba(warmLight(color, 0.5), 0.28 * lightAmt));
    rg.addColorStop(0.6, 'rgba(0,0,0,0)');
    ctx.strokeStyle = rg;
    ctx.lineWidth = Math.max(1.4, R * 0.20);
    if (o.p2d) ctx.stroke(o.p2d); else ctx.stroke();
  }

  /* 4. inner shadow along the bottom-right edge */
  const sg = ctx.createLinearGradient(bb.x + bb.w * 0.15, bb.y + bb.h * 0.1, bb.x + bb.w, bb.y + bb.h);
  sg.addColorStop(0, 'rgba(0,0,0,0)');
  sg.addColorStop(0.5, 'rgba(0,0,0,0)');
  sg.addColorStop(1, rgba(coolShade(color, 0.66), 0.75));
  ctx.strokeStyle = sg;
  ctx.lineWidth = Math.max(1.6, R * 0.30);
  if (o.p2d) ctx.stroke(o.p2d); else ctx.stroke();

  /* 5. specular -- clay is matte, so this is broad and weak, plus one hot dot */
  if (o.spec !== false) {
    const sx = bb.x + bb.w * (o.specX === undefined ? 0.30 : o.specX);
    const sy = bb.y + bb.h * (o.specY === undefined ? 0.24 : o.specY);
    const pg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.78);
    pg.addColorStop(0, 'rgba(255,248,228,' + (0.30 * lightAmt) + ')');
    pg.addColorStop(0.55, 'rgba(255,246,224,' + (0.07 * lightAmt) + ')');
    pg.addColorStop(1, 'rgba(255,246,224,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(bb.x - 2, bb.y - 2, bb.w + 4, bb.h + 4);

    if (R > 7 && o.hotspot !== false) {
      const hg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.20);
      hg.addColorStop(0, 'rgba(255,253,244,' + (0.5 * lightAmt) + ')');
      hg.addColorStop(1, 'rgba(255,253,244,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(sx - R * 0.3, sy - R * 0.3, R * 0.6, R * 0.6);
    }
  }

  /* 6. thumbprints & tool marks -- the tell that a hand made this */
  if (Clay.quality && o.prints !== 0) {
    if (o.markSize) Clay.surfaceMarks(ctx, bb, color, o.seed || 1, o.prints || 20, o.markSize);
    else Clay.thumbprints(ctx, bb, color, o.seed || 1, o.prints || 3, o.printScale || 1);
  }

  ctx.restore();

  /* 7. contact edge: barely-there dark line so shapes read against each other */
  if (o.edge !== false) {
    ctx.strokeStyle = rgba(coolShade(color, 0.62), o.edgeAlpha === undefined ? 0.30 : o.edgeAlpha);
    ctx.lineWidth = o.edgeWidth || 1.1;
    if (o.p2d) ctx.stroke(o.p2d); else ctx.stroke();
  }
};

/* Pressed ridges: a light stroke offset up-left with a dark stroke behind it.
   Reads as a groove pushed into the surface with a thumb. */
Clay.thumbprints = function (ctx, bb, color, seed, count, scale) {
  const R = Math.max(bb.w, bb.h) / 2;
  if (R < 5) return;
  const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  const dark = rgba(coolShade(color, 0.5), 0.30);
  const lite = rgba(warmLight(color, 0.55), 0.42);
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const h = seed * 13.7 + i * 4.31;
    const a = hash1(h) * TAU;
    const rad = (0.15 + hash1(h + 1) * 0.5) * R;
    const px = cx + Math.cos(a) * R * 0.42 * hash1(h + 2);
    const py = cy + Math.sin(a) * R * 0.42 * hash1(h + 3);
    const st = hash1(h + 4) * TAU;
    const sw = 0.7 + hash1(h + 5) * 1.5;
    const lw = clamp(R * 0.09 * scale, 0.8, 3.4);
    ctx.lineWidth = lw;
    ctx.strokeStyle = dark;
    ctx.beginPath(); ctx.arc(px + lw * 0.45, py + lw * 0.45, rad, st, st + sw); ctx.stroke();
    ctx.strokeStyle = lite;
    ctx.beginPath(); ctx.arc(px - lw * 0.3, py - lw * 0.3, rad, st, st + sw); ctx.stroke();
  }
  /* one whorl, sometimes -- an actual fingerprint left in the surface */
  if (R > 13 && hash1(seed * 5.5) > 0.55) {
    const wx = cx + shash1(seed * 2.2) * R * 0.35;
    const wy = cy + shash1(seed * 6.6) * R * 0.35;
    ctx.lineWidth = clamp(R * 0.045, 0.5, 1.3);
    for (let k = 1; k <= 3; k++) {
      const rr = R * 0.09 * k;
      ctx.strokeStyle = k % 2 ? dark : lite;
      ctx.beginPath();
      ctx.arc(wx, wy, rr, 0.4 + k * 0.5, 0.4 + k * 0.5 + 3.6);
      ctx.stroke();
    }
  }
};

/* Big surfaces get many small marks of a fixed size rather than a few marks
   scaled to the shape -- a hillside was pressed with the same thumb a hundred
   times, not with one enormous thumb. Marks are scattered on a jittered grid
   so they cover evenly without clumping. */
Clay.surfaceMarks = function (ctx, bb, color, seed, count, size) {
  const dark = rgba(coolShade(color, 0.5), 0.24);
  const lite = rgba(warmLight(color, 0.5), 0.30);
  const cell = Math.sqrt((bb.w * bb.h) / Math.max(1, count));
  const cols = Math.max(1, Math.ceil(bb.w / cell)), rows = Math.max(1, Math.ceil(bb.h / cell));
  ctx.lineCap = 'round';
  const lw = size * 0.34;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const h = seed * 19.3 + gx * 3.71 + gy * 8.13;
      if (hash1(h + 9) > 0.86) continue;                       // leave gaps
      const px = bb.x + (gx + 0.15 + hash1(h) * 0.7) * cell;
      const py = bb.y + (gy + 0.15 + hash1(h + 1) * 0.7) * cell;
      const rad = size * (0.55 + hash1(h + 2) * 0.75);
      const st = hash1(h + 3) * TAU;
      const sw = 0.8 + hash1(h + 4) * 1.7;
      ctx.lineWidth = lw;
      ctx.strokeStyle = dark;
      ctx.beginPath(); ctx.arc(px + lw * 0.5, py + lw * 0.55, rad, st, st + sw); ctx.stroke();
      ctx.strokeStyle = lite;
      ctx.beginPath(); ctx.arc(px - lw * 0.35, py - lw * 0.4, rad, st, st + sw); ctx.stroke();
    }
  }
};

/* ---------------------------------------------------------------------- */
/*  Primitives                                                             */
/* ---------------------------------------------------------------------- */

/* A lumpy ball of clay. The workhorse. */
Clay.blob = function (ctx, o) {
  const rx = o.rx, ry = o.ry === undefined ? o.rx : o.ry;
  const wob = o.wob === undefined ? 0.10 : o.wob;
  const m = 1 + wob;
  Clay.blobPath(ctx, o.x, o.y, rx, ry, o.seed || 1, wob, o.rot || 0, o.boil || 0, o.n);
  Clay.material(ctx, { x: o.x - rx * m, y: o.y - ry * m, w: rx * 2 * m, h: ry * 2 * m }, o.color, o);
};

/* A rolled clay sausage between two points, tapered. Arms, legs, branches. */
Clay.limb = function (ctx, x1, y1, x2, y2, r1, r2, color, o) {
  o = o || {};
  r2 = r2 === undefined ? r1 : r2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 0.0001;
  const nx = -dy / len, ny = dx / len;
  const seed = o.seed || 2;
  const steps = Math.max(5, Math.min(16, Math.round(len / 5)));
  const bow = o.bow || 0;                    /* sideways sag, so nothing is straight */
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = lerp(r1, r2, t) * (1 + 0.10 * Math.sin(t * 6 + seed) * (o.lumpy === false ? 0 : 1));
    const b = Math.sin(t * Math.PI) * bow;
    const px = lerp(x1, x2, t) + nx * b, py = lerp(y1, y2, t) + ny * b;
    pts.push({ x: px + nx * r, y: py + ny * r });
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const r = lerp(r1, r2, t) * (1 + 0.10 * Math.sin(t * 6 + seed) * (o.lumpy === false ? 0 : 1));
    const b = Math.sin(t * Math.PI) * bow;
    const px = lerp(x1, x2, t) + nx * b, py = lerp(y1, y2, t) + ny * b;
    pts.push({ x: px - nx * r, y: py - ny * r });
  }
  ctx.beginPath();
  smoothPath(ctx, pts, true);
  const pad = Math.max(r1, r2) + Math.abs(bow);
  Clay.material(ctx, {
    x: Math.min(x1, x2) - pad, y: Math.min(y1, y2) - pad,
    w: Math.abs(dx) + pad * 2, h: Math.abs(dy) + pad * 2
  }, color, { seed: seed, prints: o.prints === undefined ? 2 : o.prints, light: o.light, edgeAlpha: o.edgeAlpha });
};

/* A slab of clay from an arbitrary polygon: terrain, furniture, props. */
Clay.slab = function (ctx, pts, color, o) {
  o = o || {};
  if (pts.length < 3) return;
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const p of pts) {
    if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
    if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
  }
  const bb = { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  ctx.beginPath();
  smoothPath(ctx, pts, true);
  Clay.material(ctx, bb, color, o);
};

function _polyPath(ctx, pts, dx, dy) {
  ctx.beginPath();
  if (dx || dy) {
    const m = pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
    smoothPath(ctx, m, true);
  } else smoothPath(ctx, pts, true);
}
function _bbox(pts) {
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const p of pts) {
    if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
    if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
  }
  return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
}

/* A landmass. Takes a baked shape from Clay.makeShape.

   Same material as everything else, plus the things that make a big surface
   read as sculpted: layers of clay pressed on in strata, a rolled lighter band
   along the walkable top, and grit pushed into the face. */
Clay.terrain = function (ctx, shape, o) {
  o = o || {};
  const color = o.color;
  const bb = shape.bb;
  const seed = o.seed || 1;
  const path = shape.path;

  Clay.material(ctx, bb, color, {
    p2d: path, seed: seed,
    prints: o.marks === undefined ? Math.min(420, Math.round(bb.w * bb.h / 950)) : o.marks,
    markSize: o.markSize || 5.5, edgeAlpha: 0.36, edgeWidth: 1.4, spec: false,
    vert: true, vertH: o.vertH || 130, ao: false,
  });

  ctx.save();
  ctx.clip(path);

  /* strata -- clay pressed on in layers, each slightly off-colour */
  if (o.strata !== false) {
    const bands = o.bands || 4;
    const H = Math.min(bb.h, 190);
    for (let i = 0; i < bands; i++) {
      const t = i / bands;
      const yy = bb.y + 14 + t * H * 0.95;
      const tone = i % 2 ? coolShade(color, 0.13) : warmLight(color, 0.06);
      ctx.beginPath();
      ctx.moveTo(bb.x - 4, yy);
      const segs = Math.max(3, Math.min(90, Math.round(bb.w / 34)));
      for (let sgi = 1; sgi <= segs; sgi++) {
        const px = bb.x + (bb.w + 8) * (sgi / segs) - 4;
        const py = yy + (fbm1(px * 0.013 + i * 9 + seed, seed + i, 2) - 0.5) * 11;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(bb.x + bb.w + 4, bb.y + bb.h + 6);
      ctx.lineTo(bb.x - 4, bb.y + bb.h + 6);
      ctx.closePath();
      ctx.fillStyle = rgba(tone, 0.40);
      ctx.fill();
    }
  }

  /* grit and pebbles pressed into the face */
  const gritN = Math.min(140, Math.round(bb.w * bb.h / 2400));
  for (let i = 0; i < gritN; i++) {
    const h = seed * 7.3 + i * 5.17;
    const px = bb.x + hash1(h) * bb.w, py = bb.y + hash1(h + 1) * Math.min(bb.h, 260);
    const r = 1 + hash1(h + 2) * 2.6;
    ctx.beginPath(); ctx.ellipse(px + 0.7, py + 0.8, r, r * 0.82, 0, 0, TAU);
    ctx.fillStyle = 'rgba(30,16,36,0.22)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.82, 0, 0, TAU);
    ctx.fillStyle = rgba(hash1(h + 3) > 0.5 ? warmLight(color, 0.3) : coolShade(color, 0.28), 0.5);
    ctx.fill();
  }

  /* the rolled top band -- island MINUS island-shifted-down */
  if (o.top) {
    ctx.save();
    const cut = new Path2D();
    cut.rect(bb.x - 30, bb.y - 60, bb.w + 60, bb.h + 120);
    cut.addPath(shape.down);
    ctx.clip(cut, 'evenodd');
    Clay.material(ctx, { x: bb.x, y: bb.y, w: bb.w, h: shape.topH * 2.6 }, o.top, {
      p2d: path, seed: seed + 3,
      prints: Math.min(260, Math.round(bb.w / 11)), markSize: 3.2,
      edge: false, rim: false, spec: false, vert: true, vertH: shape.topH * 2.4,
    });
    /* a bright lip right at the crest, where the light catches the roll */
    ctx.strokeStyle = rgba(warmLight(o.top, 0.58), 0.5);
    ctx.lineWidth = 2.6;
    ctx.stroke(path);
    ctx.restore();

    /* thin dark line under the band so the top reads as its own slab */
    ctx.strokeStyle = 'rgba(34,18,40,0.28)';
    ctx.lineWidth = 1.6;
    ctx.stroke(shape.down);
  }
  ctx.restore();
};

/* Soft contact shadow on the floor beneath something. */
Clay.groundShadow = function (ctx, x, y, rx, ry, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(30,16,38,' + alpha + ')');
  g.addColorStop(0.55, 'rgba(30,16,38,' + alpha * 0.5 + ')');
  g.addColorStop(1, 'rgba(30,16,38,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill();
  ctx.restore();
};

/* ---------------------------------------------------------------------- */
/*  Eyes -- the whole personality budget goes here                         */
/* ---------------------------------------------------------------------- */

/* Big flat shirt-button with thread holes. Norbert's left eye. */
Clay.buttonEye = function (ctx, x, y, r, rot, o) {
  o = o || {};
  const seed = o.seed || 9;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot || 0);
  /* socket */
  ctx.beginPath(); ctx.ellipse(0, r * 0.16, r * 1.12, r * 1.06, 0, 0, TAU);
  ctx.fillStyle = 'rgba(48,24,34,0.32)'; ctx.fill();
  /* button body */
  Clay.blobPath(ctx, 0, 0, r, r * 0.96, seed, 0.045, 0, 0, 18);
  Clay.material(ctx, { x: -r * 1.1, y: -r * 1.1, w: r * 2.2, h: r * 2.2 },
    o.color || '#f4ecd8', { seed: seed, prints: 0, specY: 0.2, edgeAlpha: 0.35 });
  /* inset ring */
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.68, r * 0.66, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(90,58,44,0.35)'; ctx.lineWidth = r * 0.11; ctx.stroke();
  /* four thread holes + criss-cross thread */
  const hr = Math.max(0.9, r * 0.13);
  ctx.fillStyle = 'rgba(58,32,26,0.85)';
  const hp = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const h of hp) {
    ctx.beginPath(); ctx.arc(h[0] * r * 0.3, h[1] * r * 0.3, hr, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = o.thread || 'rgba(70,44,36,0.7)';
  ctx.lineWidth = Math.max(0.8, r * 0.1); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.3); ctx.lineTo(r * 0.3, r * 0.3);
  ctx.moveTo(r * 0.3, -r * 0.3); ctx.lineTo(-r * 0.3, r * 0.3);
  ctx.stroke();
  /* glass glint */
  ctx.beginPath(); ctx.ellipse(-r * 0.36, -r * 0.42, r * 0.26, r * 0.16, -0.6, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
  ctx.restore();
};

/* Tiny shiny bead pressed into the clay. Norbert's right eye. */
Clay.beadEye = function (ctx, x, y, r, o) {
  o = o || {};
  /* pressed socket */
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 1.5, r * 1.35, 0, 0, TAU);
  ctx.fillStyle = 'rgba(48,24,34,0.28)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - r * 0.15, y - r * 0.2, r * 1.35, r * 1.2, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,236,206,0.18)'; ctx.fill();
  /* bead */
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r * 1.25);
  g.addColorStop(0, o.hi || '#6c7a8c');
  g.addColorStop(0.45, o.color || '#20242e');
  g.addColorStop(1, '#0c0d12');
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.arc(x - r * 0.34, y - r * 0.38, r * 0.3, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.28, y + r * 0.3, r * 0.16, 0, TAU);
  ctx.fillStyle = 'rgba(255,220,180,0.35)'; ctx.fill();
};

/* Craft-shop googly eye: plastic dome, loose pupil that keeps rattling. */
Clay.googlyEye = function (ctx, x, y, r, px, py, o) {
  o = o || {};
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.18, r * 1.14, r * 1.08, 0, 0, TAU);
  ctx.fillStyle = 'rgba(40,20,30,0.3)'; ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, '#f0eee7'); g.addColorStop(1, '#c9c3b4');
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  const pr = r * (o.pupil || 0.46);
  const lim = r - pr - r * 0.06;
  const cx2 = x + clamp(px, -1, 1) * lim, cy2 = y + clamp(py, -1, 1) * lim;
  ctx.beginPath(); ctx.arc(cx2, cy2, pr, 0, TAU);
  ctx.fillStyle = '#14161c'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx2 - pr * 0.3, cy2 - pr * 0.32, pr * 0.32, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  /* plastic dome sheen */
  ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.42, r * 0.24, -0.7, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.strokeStyle = 'rgba(60,40,44,0.35)'; ctx.lineWidth = Math.max(0.7, r * 0.08); ctx.stroke();
};

/* A dent pressed into clay -- Norbert has one of these in his forehead. */
Clay.dent = function (ctx, x, y, rx, ry, rot, color) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot || 0);
  const g = ctx.createLinearGradient(0, -ry, 0, ry);
  g.addColorStop(0, rgba(coolShade(color, 0.45), 0.55));
  g.addColorStop(0.62, rgba(coolShade(color, 0.12), 0.16));
  g.addColorStop(1, rgba(warmLight(color, 0.55), 0.45));
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
};

/* ---------------------------------------------------------------------- */
/*  Textures                                                               */
/* ---------------------------------------------------------------------- */

Clay.grainPattern = function (ctx) {
  if (Clay._grainPat) return Clay._grainPat;
  const S = 128;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const d = img.data;
  /* Mean-zero RGBA: half the grains lighten, half darken, most pixels are
     clear. That lets the grain go down with plain source-over instead of an
     'overlay' blend, which on a phone is the difference between a full-screen
     destination read every frame and a cheap composite. */
  for (let i = 0; i < S * S; i++) {
    const v = Math.random();
    const up = v > 0.5;
    const a = Math.pow(Math.random(), 2.2) * 190;
    d[i * 4] = up ? 255 : 0;
    d[i * 4 + 1] = up ? 250 : 4;
    d[i * 4 + 2] = up ? 235 : 12;
    d[i * 4 + 3] = a;
  }
  g.putImageData(img, 0, 0);
  Clay._grainPat = ctx.createPattern(c, 'repeat');
  return Clay._grainPat;
};

/* Coarser, softer speckle for backdrops -- reads as felt / sugar paper. */
Clay.paperPattern = function (ctx) {
  if (Clay._paperPat) return Clay._paperPat;
  const S = 160;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = Math.random() * 1.9 + 0.35;
    const v = Math.random() > 0.5 ? 255 : 0;
    g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (Math.random() * 0.26) + ')';
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  /* a few paper fibres */
  g.lineWidth = 0.7;
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * S, y = Math.random() * S, a = Math.random() * TAU, l = 4 + Math.random() * 16;
    g.strokeStyle = 'rgba(255,255,255,' + (Math.random() * 0.16) + ')';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  Clay._paperPat = ctx.createPattern(c, 'repeat');
  return Clay._paperPat;
};

/* Film grain over the whole frame.

   Filling the screen with a repeating pattern every frame means sampling that
   pattern per pixel, which on a phone costs more than the entire cast put
   together. So the grain is baked once into a full-resolution sheet a little
   larger than the screen, and each stop-motion tick blits it from a different
   offset -- same crawl, one cheap composite. */
Clay._grainSheet = null;
Clay.grain = function (ctx, w, h, alpha, devScale) {
  if (!Clay.quality) return;
  const S = Math.max(1, devScale || 1);
  const bw = Math.ceil(w * S), bh = Math.ceil(h * S);
  const PAD = 96;
  let sheet = Clay._grainSheet;
  if (!sheet || sheet.w !== bw || sheet.h !== bh) {
    const cv = document.createElement('canvas');
    cv.width = bw + PAD; cv.height = bh + PAD;
    const g = cv.getContext('2d');
    const img = g.createImageData(cv.width, cv.height);
    const d = img.data;
    /* mean-zero speckle: half lightens, half darkens, most of it is clear */
    for (let i = 0; i < cv.width * cv.height; i++) {
      const up = Math.random() > 0.5;
      d[i * 4] = up ? 255 : 0;
      d[i * 4 + 1] = up ? 250 : 4;
      d[i * 4 + 2] = up ? 235 : 12;
      d[i * 4 + 3] = Math.pow(Math.random(), 2.2) * 200;
    }
    g.putImageData(img, 0, 0);
    sheet = Clay._grainSheet = { cv, w: bw, h: bh };
  }
  const ox = (hash1(Clay.frame * 3.1) * PAD) | 0;
  const oy = (hash1(Clay.frame * 7.7 + 3) * PAD) | 0;
  ctx.save();
  ctx.globalAlpha = alpha * 2.6;
  ctx.drawImage(sheet.cv, ox, oy, bw, bh, 0, 0, w, h);
  ctx.restore();
};

Clay.paper = function (ctx, x, y, w, h, alpha, scale) {
  const pat = Clay.paperPattern(ctx);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  if (scale && scale !== 1) { ctx.scale(scale, scale); x /= scale; y /= scale; w /= scale; h /= scale; }
  ctx.fillStyle = pat;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
};

/* Vignette + warm bloom in the corners of the lens. */
Clay.vignette = function (ctx, w, h, amount, tint) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.46, h * 0.28, w * 0.5, h * 0.5, h * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.62, 'rgba(0,0,0,' + amount * 0.28 + ')');
  g.addColorStop(1, tint ? rgba(tint, amount) : 'rgba(8,4,14,' + amount + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

/* The lens, baked.

   The vignette and the colour grade never change within a room, so paying for
   two more full-screen passes every frame is pure waste -- on a phone they
   cost more than the entire cast. Bake them into one translucent layer per
   room and blit it. */
Clay._lens = null;
Clay.lens = function (ctx, w, h, key, amount, tint, gradeCol, gradeA) {
  const id = key + '|' + Math.round(w) + 'x' + Math.round(h);
  let L = Clay._lens;
  if (!L || L.id !== id) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w));
    cv.height = Math.max(1, Math.round(h));
    const g = cv.getContext('2d');
    if (gradeCol && gradeA) {
      /* the grade was an 'overlay' wash; at these strengths a straight tint
         at a little under two thirds reads the same and costs nothing */
      g.fillStyle = rgba(gradeCol, gradeA * 0.62);
      g.fillRect(0, 0, cv.width, cv.height);
    }
    Clay.vignette(g, cv.width, cv.height, amount, tint);
    L = Clay._lens = { id, cv };
  }
  ctx.drawImage(L.cv, 0, 0, L.cv.width, L.cv.height, 0, 0, w, h);
};

/* ---------------------------------------------------------------------- */
/*  Terrain outlines                                                       */
/* ---------------------------------------------------------------------- */

/* Walk the boundary of a boolean tile grid and return closed loops of points
   in world space, so terrain can be drawn as sculpted slabs instead of tiles. */
Clay.traceGrid = function (solidAt, w, h, ts) {
  const edges = new Map();          // "x,y" -> [ [toX,toY], ... ]
  const key = (x, y) => x + ',' + y;
  const add = (ax, ay, bx, by) => {
    const k = key(ax, ay);
    let a = edges.get(k);
    if (!a) { a = []; edges.set(k, a); }
    a.push([bx, by]);
  };
  /* wind every edge so the solid side is always on the right of travel */
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solidAt(x, y)) continue;
      const x0 = x * ts, y0 = y * ts, x1 = x0 + ts, y1 = y0 + ts;
      if (!solidAt(x, y - 1)) add(x0, y0, x1, y0);      // top    ->
      if (!solidAt(x + 1, y)) add(x1, y0, x1, y1);      // right  v
      if (!solidAt(x, y + 1)) add(x1, y1, x0, y1);      // bottom <-
      if (!solidAt(x - 1, y)) add(x0, y1, x0, y0);      // left   ^
    }
  }

  const loops = [];
  let guard = 0;
  while (edges.size && guard++ < 40000) {
    const startKey = edges.keys().next().value;
    const parts = startKey.split(',');
    let cx = +parts[0], cy = +parts[1];
    const sx = cx, sy = cy;
    let dx = 0, dy = 0;
    const loop = [];
    let steps = 0;
    while (steps++ < 200000) {
      const k = key(cx, cy);
      const arr = edges.get(k);
      if (!arr || !arr.length) break;

      /* At a pinch point several boundary edges leave the same corner.
         Always take the sharpest right turn: that keeps the walk on the
         boundary it arrived on instead of hopping to a different one and
         splitting the island into two broken half-loops. */
      let idx = 0;
      if (arr.length > 1 && (dx || dy)) {
        let bestScore = -1;
        for (let i = 0; i < arr.length; i++) {
          const ex = Math.sign(arr[i][0] - cx), ey = Math.sign(arr[i][1] - cy);
          const rx = -dy, ry = dx;                 // right of travel
          const straight = ex * dx + ey * dy;
          const right = ex * rx + ey * ry;
          const sc = right > 0 ? 3 : (straight > 0 ? 2 : (right < 0 ? 1 : 0));
          if (sc > bestScore) { bestScore = sc; idx = i; }
        }
      }
      const nxt = arr.splice(idx, 1)[0];
      if (!arr.length) edges.delete(k);

      loop.push({ x: cx, y: cy });
      dx = Math.sign(nxt[0] - cx); dy = Math.sign(nxt[1] - cy);
      cx = nxt[0]; cy = nxt[1];
      if (cx === sx && cy === sy) break;
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops;
};

/* Take a boxy tile outline and make it look pinched by hand.

   The trick is to resample the loop at a fixed spacing FIRST. Corner-cutting a
   raw tile outline turns a hundred-tile-long floor into one enormous smooth
   curve, because after collinear points are dropped there is nothing left
   between the two ends. Resampling keeps the straights straight and lets the
   smoothing kernel only round what is actually a corner. */
Clay.handify = function (loop, amp, freq, seed, smooth) {
  const STEP = 11;
  const pts = [];
  const n0 = loop.length;
  for (let i = 0; i < n0; i++) {
    const a = loop[i], b = loop[(i + 1) % n0];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.round(d / STEP));
    for (let j = 0; j < k; j++) pts.push({ x: lerp(a.x, b.x, j / k), y: lerp(a.y, b.y, j / k) });
  }
  if (pts.length < 8) return loop;

  /* round the corners with a few [1 2 1] passes -- radius stays local */
  let s = pts;
  const passes = smooth === undefined ? 3 : smooth;
  for (let p = 0; p < passes; p++) {
    const m = s.length;
    const out = new Array(m);
    for (let i = 0; i < m; i++) {
      const a = s[(i - 1 + m) % m], c = s[i], b = s[(i + 1) % m];
      out[i] = { x: (a.x + c.x * 2 + b.x) * 0.25, y: (a.y + c.y * 2 + b.y) * 0.25 };
    }
    s = out;
  }

  /* then push every vertex out along its own normal, by noise along the edge */
  const n = s.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = s[i], a = s[(i - 1 + n) % n], b = s[(i + 1) % n];
    const tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    const nx = ty / l, ny = -tx / l;
    const u = i * STEP * freq * 3;
    const d = (fbm1(u + seed * 10, seed, 3) - 0.5) * 2 * amp
      + (noise1(u * 0.31 + seed * 3, seed + 5) - 0.5) * amp * 0.9;
    out[i] = { x: p.x + nx * d, y: p.y + ny * d };
  }
  return out;
};

/* Bake a traced outline into reusable Path2D objects. Terrain paths are
   stroked, filled and clipped six or seven times a frame; building them once
   at level load instead of per draw call is most of the terrain budget. */
Clay.makeShape = function (pts, topH) {
  const bb = _bbox(pts);
  const path = new Path2D();
  _pathInto(path, pts, 0, 0);
  const down = new Path2D();
  _pathInto(down, pts, 0, topH || 9);
  return { pts, bb, path, down, topH: topH || 9 };
};

function _pathInto(path, pts, dx, dy) {
  const n = pts.length;
  if (n < 3) return;
  const m0x = (pts[n - 1].x + pts[0].x) / 2 + dx, m0y = (pts[n - 1].y + pts[0].y) / 2 + dy;
  path.moveTo(m0x, m0y);
  for (let i = 0; i < n; i++) {
    const cur = pts[i], nxt = pts[(i + 1) % n];
    path.quadraticCurveTo(cur.x + dx, cur.y + dy, (cur.x + nxt.x) / 2 + dx, (cur.y + nxt.y) / 2 + dy);
  }
  path.closePath();
}

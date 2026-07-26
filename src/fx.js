/* =========================================================================
   NORBERT, UNFINISHED  --  fx.js
   Particles, camera, screen shake and the transitions between rooms.
   ========================================================================= */

/* ---- particles -------------------------------------------------------- */

const FX = {
  parts: [],
  texts: [],
};

FX.clear = function () { FX.parts.length = 0; FX.texts.length = 0; };

FX.spawn = function (o) {
  if (FX.parts.length > 700) FX.parts.shift();
  FX.parts.push(Object.assign({
    x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 1, max: 1, g: 300, drag: 0.6,
    color: '#c5704a', kind: 'crumb', rot: Math.random() * TAU, vrot: shash1(Math.random() * 99) * 6,
    fade: true,
  }, o));
};

/* torn clay: chunky, tumbling, bounces once */
FX.crumbs = function (x, y, n, color, force) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.5 + shash1(i * 3.1 + x) * 2.2;
    const s = (force || 90) * (0.35 + Math.random() * 0.9);
    FX.spawn({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
      r: 1.2 + Math.random() * 2.8, life: 0.6 + Math.random() * 0.7,
      max: 1.3, color: color || NB_SKIN, kind: 'crumb', g: 620, drag: 0.2,
    });
  }
};

/* a soft round puff, for landings and doors */
FX.puff = function (x, y, n, color, spread) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = (spread || 40) * Math.random();
    FX.spawn({
      x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 2,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 18,
      r: 3 + Math.random() * 7, life: 0.4 + Math.random() * 0.5, max: 0.9,
      color: color || '#d8cdb8', kind: 'puff', g: -30, drag: 2.6,
    });
  }
};

FX.splash = function (x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.5 + shash1(i * 7.7 + y) * 1.9;
    const s = 60 + Math.random() * 150;
    FX.spawn({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      r: 1 + Math.random() * 2.6, life: 0.5 + Math.random() * 0.5, max: 1,
      color: color || '#9fd0e0', kind: 'drop', g: 520, drag: 0.1,
    });
  }
};

FX.sparkle = function (x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = 20 + Math.random() * 70;
    FX.spawn({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
      r: 1 + Math.random() * 2.2, life: 0.5 + Math.random() * 0.8, max: 1.3,
      color: color || '#ffe6a8', kind: 'star', g: 40, drag: 1.4,
    });
  }
};

FX.heart = function (x, y) {
  FX.spawn({
    x: x + shash1(Math.random() * 9) * 6, y, vx: shash1(Math.random() * 5) * 12, vy: -34,
    r: 4, life: 1.3, max: 1.3, color: '#f07a9c', kind: 'heart', g: -12, drag: 1.1,
  });
};

FX.note = function (x, y) {
  FX.spawn({
    x, y, vx: shash1(Math.random() * 5) * 16, vy: -30,
    r: 4, life: 1.5, max: 1.5, color: '#ffeecb', kind: 'note', g: -8, drag: 1.0,
  });
};

FX.text = function (x, y, str, color) {
  FX.texts.push({ x, y, str, color: color || '#fff2d8', life: 1.5, max: 1.5 });
};

FX.update = function (dt) {
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    p.life -= dt;
    if (p.life <= 0) { FX.parts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    const d = Math.exp(-p.drag * dt);
    p.vx *= d; p.vy *= d;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vrot * dt;
  }
  for (let i = FX.texts.length - 1; i >= 0; i--) {
    const t = FX.texts[i];
    t.life -= dt; t.y -= dt * 22;
    if (t.life <= 0) FX.texts.splice(i, 1);
  }
};

FX.draw = function (ctx) {
  for (const p of FX.parts) {
    const a = p.fade ? clamp(p.life / p.max, 0, 1) : 1;
    ctx.globalAlpha = a;
    switch (p.kind) {
      case 'crumb': {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        Clay.blob(ctx, { x: 0, y: 0, rx: p.r, ry: p.r * 0.78, seed: p.r * 31, color: p.color, wob: 0.25, prints: 0, spec: false });
        ctx.restore();
        break;
      }
      case 'puff': {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (2 - a));
        g.addColorStop(0, rgba(p.color, 0.34 * a));
        g.addColorStop(1, rgba(p.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (2 - a), 0, TAU); ctx.fill();
        break;
      }
      case 'drop': {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 0.7, p.r * 1.35, Math.atan2(p.vy, p.vx) - 1.57, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(p.x - p.r * 0.2, p.y - p.r * 0.3, p.r * 0.28, 0, TAU); ctx.fill();
        break;
      }
      case 'star': {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const ang = (k / 4) * TAU;
          ctx.lineTo(Math.cos(ang) * p.r * 1.9, Math.sin(ang) * p.r * 1.9);
          ctx.lineTo(Math.cos(ang + 0.785) * p.r * 0.45, Math.sin(ang + 0.785) * p.r * 0.45);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'heart': {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.life * 6) * 0.2);
        ctx.fillStyle = p.color;
        const r = p.r;
        ctx.beginPath();
        ctx.moveTo(0, r * 0.7);
        ctx.bezierCurveTo(-r * 1.5, -r * 0.4, -r * 0.5, -r * 1.3, 0, -r * 0.35);
        ctx.bezierCurveTo(r * 0.5, -r * 1.3, r * 1.5, -r * 0.4, 0, r * 0.7);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'note': {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.life * 4) * 0.25);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(-1.5, 2.5, 2.6, 1.9, -0.4, 0, TAU); ctx.fill();
        ctx.fillRect(0.7, -5, 1.2, 7.5);
        ctx.beginPath(); ctx.moveTo(0.7, -5); ctx.quadraticCurveTo(5, -5.5, 4.4, -1.5);
        ctx.quadraticCurveTo(3.6, -3.6, 0.7, -2.8); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
    }
  }
  ctx.globalAlpha = 1;
};

FX.drawText = function (ctx) {
  for (const t of FX.texts) {
    const a = clamp(t.life / t.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '700 11px ' + UI_FONT;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(28,14,26,0.8)';
    ctx.strokeText(t.str, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
    ctx.restore();
  }
};

/* ---- camera ----------------------------------------------------------- */

const Cam = {
  x: 0, y: 0, tx: 0, ty: 0,
  shake: 0, shakeD: 0,
  offX: 0, offY: 0,
  bounds: null,
  lead: 0,
};

Cam.follow = function (px, py, facing, dt, W, H, speed) {
  Cam.lead = approach(Cam.lead, facing * 46, 90 * dt);
  Cam.tx = px + Cam.lead - W / 2;
  Cam.ty = py - H * 0.62;
  const k = 1 - Math.exp(-(speed || 5.5) * dt);
  Cam.x += (Cam.tx - Cam.x) * k;
  Cam.y += (Cam.ty - Cam.y) * k;
  Cam.clamp(W, H);
};

Cam.snap = function (px, py, W, H) {
  Cam.x = px - W / 2; Cam.y = py - H * 0.62; Cam.lead = 0;
  Cam.clamp(W, H);
};

Cam.clamp = function (W, H) {
  const b = Cam.bounds;
  if (!b) return;
  if (b.w <= W) Cam.x = b.x + (b.w - W) / 2;
  else Cam.x = clamp(Cam.x, b.x, b.x + b.w - W);
  if (b.h <= H) Cam.y = b.y + (b.h - H) / 2;
  else Cam.y = clamp(Cam.y, b.y, b.y + b.h - H);
};

Cam.kick = function (amount) { Cam.shake = Math.max(Cam.shake, amount); };

Cam.update = function (dt) {
  if (Cam.shake > 0) {
    Cam.shake = Math.max(0, Cam.shake - dt * (12 + Cam.shake * 2));
    Cam.offX = shash1(Clay.frame * 7.3 + performance.now() * 0.01) * Cam.shake;
    Cam.offY = shash1(Clay.frame * 3.1 + performance.now() * 0.013) * Cam.shake;
  } else { Cam.offX = 0; Cam.offY = 0; }
};

Cam.viewX = function () { return Math.round((Cam.x + Cam.offX) * 4) / 4; };
Cam.viewY = function () { return Math.round((Cam.y + Cam.offY) * 4) / 4; };

/* ---- scene transitions ------------------------------------------------ */

/* A wipe made of overlapping clay blobs rolling across the screen, because a
   plain black fade would be the one un-handmade thing in the whole game. */
const Wipe = {
  t: 0, dir: 0, dur: 0.72, cb: null, active: false, color: '#2a1626',
};

Wipe.go = function (cb, color) {
  if (Wipe.active) return;
  Wipe.active = true; Wipe.t = 0; Wipe.dir = 1; Wipe.cb = cb;
  Wipe.color = color || '#2a1626';
};

Wipe.update = function (dt) {
  if (!Wipe.active) return;
  const step = dt / Wipe.dur;
  if (Wipe.dir === 1) {
    Wipe.t += step;
    if (Wipe.t >= 1) {
      Wipe.t = 1;
      Wipe.dir = -1;
      if (Wipe.cb) { Wipe.cb(); Wipe.cb = null; }
    }
  } else {
    Wipe.t -= step * 1.4;              /* pull back a little faster than it came */
    if (Wipe.t <= 0) { Wipe.t = 0; Wipe.active = false; Wipe.dir = 0; }
  }
};

Wipe.draw = function (ctx, W, H) {
  if (!Wipe.active) return;
  const p = smootherstep(clamp(Wipe.t, 0, 1));
  const rows = 7;
  ctx.save();
  for (let r = 0; r < rows; r++) {
    const off = (r % 2 ? 0.10 : 0) + hash1(r * 3.1) * 0.10;
    const q = clamp((p - off) / (1 - off), 0, 1);
    const w = q * (W + 220);
    if (w <= 0) continue;
    const y0 = (r / rows) * H, y1 = ((r + 1) / rows) * H;
    ctx.beginPath();
    ctx.moveTo(-20, y0 - 2);
    ctx.lineTo(w - 100, y0 - 2);
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const yy = lerp(y0, y1, t);
      const bulge = Math.sin(t * Math.PI) * 42 + shash1(i * 3 + r) * 12;
      ctx.lineTo(w - 100 + bulge, yy);
    }
    ctx.lineTo(-20, y1 + 2);
    ctx.closePath();
    ctx.fillStyle = r % 2 ? Wipe.color : coolShade(Wipe.color, 0.2);
    ctx.fill();
  }
  ctx.restore();
};

/* =========================================================================
   NORBERT, UNFINISHED  --  util.js
   Small maths / colour / noise helpers. Loaded first; everything uses these.
   ========================================================================= */

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function invlerp(a, b, v) { return (v - a) / (b - a || 1); }
function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function smootherstep(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
function approach(cur, tgt, step) {
  if (cur < tgt) return Math.min(cur + step, tgt);
  if (cur > tgt) return Math.max(cur - step, tgt);
  return tgt;
}
function sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }

/* ---- deterministic randomness -------------------------------------- */

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* stable hash of a float -> [0,1) */
function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
/* signed hash, [-1,1] */
function shash1(n) { return hash1(n) * 2 - 1; }

/* smooth 1D value noise */
function noise1(x, seed) {
  seed = seed || 0;
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash2(i, seed), hash2(i + 1, seed), u);
}
function fbm1(x, seed, oct) {
  oct = oct || 3;
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * noise1(x * f, seed + i * 17); f *= 2; a *= 0.5; }
  return v;
}
function noise2(x, y, seed) {
  seed = seed || 0;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix + seed * 31.4, iy);
  const b = hash2(ix + 1 + seed * 31.4, iy);
  const c = hash2(ix + seed * 31.4, iy + 1);
  const d = hash2(ix + 1 + seed * 31.4, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

/* ---- easing ---------------------------------------------------------- */
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t) { return t * t * t; }
function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function easeOutElastic(t) {
  const c4 = TAU / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}
function easeOutBounce(t) {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

/* ---- colour ---------------------------------------------------------- */

const _hexCache = new Map();
function hex2rgb(hex) {
  let c = _hexCache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  c = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  _hexCache.set(hex, c);
  return c;
}
function rgb2hex(r, g, b) {
  const t = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + t(r) + t(g) + t(b);
}
/* amt > 0 lightens toward white, amt < 0 darkens toward black */
function shade(hex, amt) {
  const c = hex2rgb(hex);
  if (amt >= 0) return rgb2hex(lerp(c.r, 255, amt), lerp(c.g, 255, amt), lerp(c.b, 255, amt));
  return rgb2hex(c.r * (1 + amt), c.g * (1 + amt), c.b * (1 + amt));
}
/* The key light and the ambient bounce, set per room. Highlights lean towards
   the key colour and shadows lean towards the ambient, so one palette change
   re-lights every object in the game at once: violet dusk on the windowsill,
   cold steel in the sink, red heat in the kiln room. */
let CLAY_KEY = { r: 255, g: 244, b: 205 };
let CLAY_AMB = { r: 40, g: 30, b: 62 };
function setClayLight(keyHex, ambHex) {
  CLAY_KEY = hex2rgb(keyHex || '#fff4cd');
  CLAY_AMB = hex2rgb(ambHex || '#281e3e');
}
/* lighten towards the key light -- clay highlights go yellow, never white */
function warmLight(hex, amt) {
  const c = hex2rgb(hex);
  return rgb2hex(lerp(c.r, CLAY_KEY.r, amt), lerp(c.g, CLAY_KEY.g, amt * 0.94), lerp(c.b, CLAY_KEY.b, amt * 0.86));
}
/* darken towards the ambient -- clay shadows are never black */
function coolShade(hex, amt) {
  const c = hex2rgb(hex);
  return rgb2hex(lerp(c.r, CLAY_AMB.r, amt), lerp(c.g, CLAY_AMB.g, amt), lerp(c.b, CLAY_AMB.b, amt));
}
function mixHex(a, b, t) {
  const x = hex2rgb(a), y = hex2rgb(b);
  return rgb2hex(lerp(x.r, y.r, t), lerp(x.g, y.g, t), lerp(x.b, y.b, t));
}
function rgba(hex, a) {
  const c = hex2rgb(hex);
  return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
}

/* ---- geometry -------------------------------------------------------- */

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* Chaikin corner-cutting: turns a chunky polygon into a soft handmade one */
function chaikin(pts, iterations, closed) {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const out = [];
    const n = p.length;
    const last = closed ? n : n - 1;
    if (!closed) out.push(p[0]);
    for (let i = 0; i < last; i++) {
      const a = p[i], b = p[(i + 1) % n];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    if (!closed) out.push(p[n - 1]);
    p = out;
  }
  return p;
}

/* remove points closer together than `min` (keeps curve budget sane) */
function decimate(pts, min, closed) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1];
    if (dist2(p.x, p.y, q.x, q.y) >= min * min) out.push(p);
  }
  if (closed && out.length > 2) {
    const a = out[0], b = out[out.length - 1];
    if (dist2(a.x, a.y, b.x, b.y) < min * min) out.pop();
  }
  return out;
}

/* draw a closed smooth path through points (quadratic midpoint method) */
function smoothPath(ctx, pts, closed) {
  const n = pts.length;
  if (n < 3) return;
  if (closed) {
    const m0 = { x: (pts[n - 1].x + pts[0].x) / 2, y: (pts[n - 1].y + pts[0].y) / 2 };
    ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) {
      const cur = pts[i], nxt = pts[(i + 1) % n];
      ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + nxt.x) / 2, (cur.y + nxt.y) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) {
      const cur = pts[i], nxt = pts[i + 1];
      ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + nxt.x) / 2, (cur.y + nxt.y) / 2);
    }
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
  }
}

/* ---- misc ------------------------------------------------------------ */

function pick(arr, r) { return arr[Math.floor((r === undefined ? Math.random() : r) * arr.length) % arr.length]; }

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (w === '\n') { lines.push(line); line = ''; continue; }
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

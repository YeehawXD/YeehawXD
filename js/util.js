/* Clash of Critters — util.js
 * Math helpers, deterministic RNG, storage, tiny event bus, tween helpers.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = {};

  // ---------------------------------------------------------------- math
  U.TAU = Math.PI * 2;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  U.dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  U.angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  U.approach = (cur, target, maxDelta) => {
    const d = target - cur;
    if (Math.abs(d) <= maxDelta) return target;
    return cur + Math.sign(d) * maxDelta;
  };
  U.angleLerp = (a, b, t) => {
    let d = ((b - a + Math.PI) % U.TAU) - Math.PI;
    if (d < -Math.PI) d += U.TAU;
    return a + d * t;
  };
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.easeOut = (t) => 1 - Math.pow(1 - t, 3);
  U.easeIn = (t) => t * t * t;
  U.easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  U.easeOutElastic = (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };

  // ---------------------------------------------------------------- rng
  // Mulberry32 — small, fast, seedable. Battles are reproducible from a seed.
  U.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    const f = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
    f.chance = (p) => f() < p;
    f.shuffle = (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        const t = a2[i]; a2[i] = a2[j]; a2[j] = t;
      }
      return a2;
    };
    return f;
  };

  U.hashString = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // ---------------------------------------------------------------- colors
  /* Parse #rgb, #rrggbb or an rgb()/rgba() string.
   * Accepting both matters: these helpers compose (shade of a mix of a shade),
   * so anything that only spoke hex would silently produce NaN channels — which
   * canvas ignores, leaving whatever fill was set last. */
  U.hex = function (col) {
    if (typeof col !== 'string') return { r: 0, g: 0, b: 0 };
    const m = col.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const p = m[1].split(',').map((v) => parseFloat(v));
      return { r: p[0] | 0, g: p[1] | 0, b: p[2] | 0 };
    }
    const s = col.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
    if (isNaN(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const hh = (v) => ('0' + Math.round(U.clamp(v, 0, 255)).toString(16)).slice(-2);
  /** Always returns #rrggbb so results can be fed straight back in. */
  U.toHex = function (r, g, b) { return '#' + hh(r) + hh(g) + hh(b); };

  U.rgba = function (col, a) {
    const c = U.hex(col);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  };
  U.mix = function (c1, c2, t) {
    const a = U.hex(c1), b = U.hex(c2);
    return U.toHex(U.lerp(a.r, b.r, t), U.lerp(a.g, b.g, t), U.lerp(a.b, b.b, t));
  };
  U.shade = function (col, amt) {
    // amt > 0 lightens toward white, amt < 0 darkens toward black
    const c = U.hex(col);
    const f = (v) => (amt > 0 ? v + (255 - v) * amt : v * (1 + amt));
    return U.toHex(f(c.r), f(c.g), f(c.b));
  };

  // ---------------------------------------------------------------- storage
  const KEY = 'coc.save.v1';
  U.storage = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    save(obj) {
      try {
        localStorage.setItem(KEY, JSON.stringify(obj));
        return true;
      } catch (e) {
        return false;
      }
    },
    clear() {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },
  };

  // ---------------------------------------------------------------- events
  U.bus = (function () {
    const map = new Map();
    return {
      on(ev, fn) {
        if (!map.has(ev)) map.set(ev, new Set());
        map.get(ev).add(fn);
        return () => map.get(ev).delete(fn);
      },
      emit(ev, data) {
        const s = map.get(ev);
        if (s) s.forEach((fn) => fn(data));
      },
    };
  })();

  // ---------------------------------------------------------------- dom
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.el = function (tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  U.fmtTime = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  // Format big numbers compactly (1.2k)
  U.fmtNum = function (n) {
    if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(Math.round(n));
  };

  NS.U = U;
})(window.COC);

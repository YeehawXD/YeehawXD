/* Fantasy Kritter — icons.js
 * Every icon in the game, drawn by hand on canvas.
 *
 * §6.3: no generic stock icons — resources, roles, status effects and regions
 * all share one visual language: the same badge construction, the same line
 * logic, the same rounding. Emoji are the definition of a generic icon, so
 * none survive here.
 *
 * A badge is a circle with a vertical lit gradient of its colour, a tinted
 * outline, an inner top highlight, and a white glyph with a soft drop shadow.
 * Glyphs are drawn in [-1, 1] space.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const TAU = Math.PI * 2;
  const Icons = { _cache: {} };

  // ---------------------------------------------------------------- glyphs
  function P(ctx, pts, close) {
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    if (close !== false) ctx.closePath();
  }
  function st(ctx, w) {
    ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }

  /* Each glyph paints in white; `dark(ctx)` is available for internal cut
   * lines so details read against the white fill. */
  const GLYPHS = {
    leaf(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(0, -0.9);
      ctx.quadraticCurveTo(0.85, -0.25, 0.05, 0.9);
      ctx.quadraticCurveTo(-0.8, -0.25, 0, -0.9);
      ctx.fill();
      dark();
      ctx.beginPath(); ctx.moveTo(0, -0.55); ctx.quadraticCurveTo(0.06, 0, 0.02, 0.6); st(ctx, 0.16);
    },
    rock(ctx, dark) {
      P(ctx, [[-0.8, 0.6], [-0.6, -0.3], [-0.1, -0.75], [0.55, -0.45], [0.8, 0.25], [0.5, 0.6]]);
      ctx.fill();
      dark();
      ctx.beginPath(); ctx.moveTo(-0.1, -0.75); ctx.lineTo(0.0, 0.6); st(ctx, 0.13);
      ctx.beginPath(); ctx.moveTo(-0.6, -0.3); ctx.lineTo(0.0, 0.05); st(ctx, 0.11);
    },
    flame(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(0.06, -0.9);
      ctx.quadraticCurveTo(0.34, -0.5, 0.2, -0.28);
      ctx.quadraticCurveTo(0.72, -0.06, 0.55, 0.4);
      ctx.quadraticCurveTo(0.4, 0.82, 0, 0.9);
      ctx.quadraticCurveTo(-0.58, 0.78, -0.58, 0.25);
      ctx.quadraticCurveTo(-0.58, -0.18, -0.2, -0.45);
      ctx.quadraticCurveTo(-0.02, -0.62, 0.06, -0.9);
      ctx.fill();
      dark();
      ctx.beginPath();
      ctx.moveTo(0, 0.05);
      ctx.quadraticCurveTo(0.3, 0.3, 0.05, 0.62);
      ctx.quadraticCurveTo(-0.25, 0.42, 0, 0.05);
      ctx.fill();
    },
    crystal(ctx, dark) {
      P(ctx, [[0, -0.9], [0.62, -0.15], [0, 0.9], [-0.62, -0.15]]);
      ctx.fill();
      dark();
      ctx.beginPath(); ctx.moveTo(-0.62, -0.15); ctx.lineTo(0.62, -0.15); st(ctx, 0.11);
      ctx.beginPath(); ctx.moveTo(0, -0.9); ctx.lineTo(0, 0.9); st(ctx, 0.09);
    },
    drop(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(0, -0.9);
      ctx.quadraticCurveTo(0.62, -0.05, 0.55, 0.32);
      ctx.arc(0, 0.32, 0.55, 0, Math.PI);
      ctx.quadraticCurveTo(-0.62, -0.05, 0, -0.9);
      ctx.fill();
      dark();
      ctx.beginPath(); ctx.arc(-0.18, 0.32, 0.16, 0, TAU); ctx.fill();
    },
    swords(ctx, dark) {
      [-1, 1].forEach(function (s) {
        ctx.save();
        ctx.scale(s, 1);
        ctx.beginPath(); ctx.moveTo(-0.62, 0.62); ctx.lineTo(0.5, -0.5); st(ctx, 0.24);
        P(ctx, [[0.42, -0.7], [0.72, -0.72], [0.7, -0.42]]);
        ctx.fill();
        ctx.beginPath(); ctx.moveTo(-0.28, 0.06); ctx.lineTo(-0.06, 0.28); st(ctx, 0.15);
        ctx.restore();
      });
    },
    skull(ctx, dark) {
      ctx.beginPath(); ctx.arc(0, -0.15, 0.62, 0, TAU); ctx.fill();
      ctx.fillRect(-0.34, 0.2, 0.68, 0.42);
      ctx.beginPath(); ctx.arc(-0.34, 0.55, 0.09, 0, TAU); ctx.arc(0, 0.58, 0.09, 0, TAU);
      ctx.arc(0.34, 0.55, 0.09, 0, TAU); ctx.fill();
      dark();
      ctx.beginPath(); ctx.arc(-0.24, -0.18, 0.16, 0, TAU); ctx.arc(0.24, -0.18, 0.16, 0, TAU); ctx.fill();
      P(ctx, [[0, 0.02], [-0.1, 0.22], [0.1, 0.22]]); ctx.fill();
    },
    bag(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(-0.16, -0.55);
      ctx.quadraticCurveTo(-0.75, -0.1, -0.6, 0.45);
      ctx.quadraticCurveTo(-0.45, 0.85, 0, 0.85);
      ctx.quadraticCurveTo(0.45, 0.85, 0.6, 0.45);
      ctx.quadraticCurveTo(0.75, -0.1, 0.16, -0.55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.3, -0.62); ctx.lineTo(0.3, -0.62); st(ctx, 0.22);
      dark();
      ctx.beginPath(); ctx.arc(0, 0.22, 0.22, 0, TAU); st(ctx, 0.12);
      ctx.beginPath(); ctx.moveTo(0, 0.06); ctx.lineTo(0, 0.38); st(ctx, 0.12);
    },
    campfire(ctx, dark) {
      ctx.save();
      ctx.translate(0, -0.18);
      ctx.scale(0.62, 0.62);
      GLYPHS.flame(ctx, dark);
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-0.7, 0.5); ctx.lineTo(0.7, 0.82); st(ctx, 0.2);
      ctx.beginPath(); ctx.moveTo(0.7, 0.5); ctx.lineTo(-0.7, 0.82); st(ctx, 0.2);
    },
    chest(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(-0.72, -0.05);
      ctx.quadraticCurveTo(-0.72, -0.62, 0, -0.62);
      ctx.quadraticCurveTo(0.72, -0.62, 0.72, -0.05);
      ctx.lineTo(0.72, 0.55);
      ctx.quadraticCurveTo(0.72, 0.68, 0.58, 0.68);
      ctx.lineTo(-0.58, 0.68);
      ctx.quadraticCurveTo(-0.72, 0.68, -0.72, 0.55);
      ctx.closePath();
      ctx.fill();
      dark();
      ctx.beginPath(); ctx.moveTo(-0.72, -0.05); ctx.lineTo(0.72, -0.05); st(ctx, 0.12);
      ctx.beginPath(); ctx.rect(-0.12, -0.2, 0.24, 0.34); ctx.fill();
    },
    crown(ctx, dark) {
      P(ctx, [[-0.72, 0.5], [-0.72, -0.35], [-0.34, 0.0], [0, -0.55], [0.34, 0.0], [0.72, -0.35], [0.72, 0.5]]);
      ctx.fill();
      dark();
      ctx.beginPath(); ctx.moveTo(-0.72, 0.28); ctx.lineTo(0.72, 0.28); st(ctx, 0.1);
    },
    sun(ctx, dark) {
      ctx.beginPath(); ctx.arc(0, 0, 0.42, 0, TAU); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 0.6, Math.sin(a) * 0.6);
        ctx.lineTo(Math.cos(a) * 0.88, Math.sin(a) * 0.88);
        st(ctx, 0.16);
      }
    },
    shield(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(0, -0.8);
      ctx.quadraticCurveTo(0.4, -0.62, 0.66, -0.58);
      ctx.quadraticCurveTo(0.66, 0.15, 0, 0.82);
      ctx.quadraticCurveTo(-0.66, 0.15, -0.66, -0.58);
      ctx.quadraticCurveTo(-0.4, -0.62, 0, -0.8);
      ctx.fill();
      dark();
      ctx.beginPath(); ctx.moveTo(0, -0.55); ctx.lineTo(0, 0.5); st(ctx, 0.12);
    },
    wind(ctx, dark) {
      [[-0.35, 0.7], [0, 0.85], [0.35, 0.6]].forEach(function (o, i) {
        ctx.beginPath();
        ctx.moveTo(-o[1] / 2 - 0.15, o[0]);
        ctx.quadraticCurveTo(o[1] / 2 - 0.2, o[0] - 0.22, o[1] / 2 + 0.15, o[0]);
        st(ctx, 0.17);
      });
    },
    fang(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(-0.35, -0.75);
      ctx.quadraticCurveTo(0.55, -0.55, 0.45, 0.1);
      ctx.quadraticCurveTo(0.38, 0.55, 0.02, 0.85);
      ctx.quadraticCurveTo(0.05, 0.3, -0.18, -0.08);
      ctx.quadraticCurveTo(-0.42, -0.45, -0.35, -0.75);
      ctx.fill();
    },
    bow(ctx, dark) {
      ctx.beginPath(); ctx.arc(-0.25, 0, 0.75, -1.05, 1.05); st(ctx, 0.16);
      ctx.beginPath(); ctx.moveTo(0.12, -0.65); ctx.lineTo(0.12, 0.65); st(ctx, 0.09);
      ctx.beginPath(); ctx.moveTo(0.12, 0); ctx.lineTo(0.85, 0); st(ctx, 0.13);
      P(ctx, [[0.62, -0.16], [0.92, 0], [0.62, 0.16]]); ctx.fill();
    },
    clover(ctx, dark) {
      ctx.beginPath();
      ctx.arc(0, -0.4, 0.32, 0, TAU);
      ctx.arc(-0.36, 0.14, 0.32, 0, TAU);
      ctx.arc(0.36, 0.14, 0.32, 0, TAU);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(0.02, 0.2); ctx.quadraticCurveTo(0.05, 0.55, 0.22, 0.85); st(ctx, 0.15);
    },
    gem(ctx, dark) {
      P(ctx, [[-0.38, -0.6], [0.38, -0.6], [0.72, -0.12], [0, 0.75], [-0.72, -0.12]]);
      ctx.fill();
      dark();
      ctx.beginPath(); ctx.moveTo(-0.72, -0.12); ctx.lineTo(0.72, -0.12); st(ctx, 0.1);
      ctx.beginPath(); ctx.moveTo(-0.38, -0.6); ctx.lineTo(0, 0.75); ctx.moveTo(0.38, -0.6); ctx.lineTo(0, 0.75); st(ctx, 0.08);
    },
    lamp(ctx, dark) {
      ctx.beginPath(); ctx.arc(0, -0.72, 0.22, Math.PI, 0); st(ctx, 0.12);
      ctx.beginPath();
      ctx.moveTo(-0.42, -0.5);
      ctx.quadraticCurveTo(-0.55, 0.1, -0.35, 0.6);
      ctx.lineTo(0.35, 0.6);
      ctx.quadraticCurveTo(0.55, 0.1, 0.42, -0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-0.5, 0.6, 1, 0.16);
      dark();
      ctx.beginPath(); ctx.arc(0, 0.08, 0.17, 0, TAU); ctx.fill();
    },
    horn(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(-0.7, 0.55);
      ctx.quadraticCurveTo(-0.8, -0.15, -0.3, -0.5);
      ctx.quadraticCurveTo(0.25, -0.88, 0.75, -0.62);
      ctx.quadraticCurveTo(0.4, -0.45, 0.15, -0.12);
      ctx.quadraticCurveTo(-0.1, 0.25, -0.28, 0.32);
      ctx.quadraticCurveTo(-0.5, 0.42, -0.7, 0.55);
      ctx.fill();
      ctx.beginPath(); ctx.arc(-0.62, 0.42, 0.2, 0, TAU); ctx.fill();
    },
    feather(ctx, dark) {
      ctx.save();
      ctx.rotate(0.5);
      ctx.beginPath();
      ctx.moveTo(0, -0.9);
      ctx.quadraticCurveTo(0.55, -0.35, 0.1, 0.55);
      ctx.quadraticCurveTo(-0.5, -0.3, 0, -0.9);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(0.02, -0.5); ctx.lineTo(0.02, 0.9); st(ctx, 0.12);
      dark();
      ctx.beginPath(); ctx.moveTo(0.3, -0.35); ctx.lineTo(0.04, -0.18); st(ctx, 0.1);
      ctx.beginPath(); ctx.moveTo(0.28, 0.05); ctx.lineTo(0.03, 0.18); st(ctx, 0.1);
      ctx.restore();
    },
    book(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(0, -0.35);
      ctx.quadraticCurveTo(-0.45, -0.62, -0.8, -0.45);
      ctx.lineTo(-0.8, 0.42);
      ctx.quadraticCurveTo(-0.42, 0.28, 0, 0.55);
      ctx.quadraticCurveTo(0.42, 0.28, 0.8, 0.42);
      ctx.lineTo(0.8, -0.45);
      ctx.quadraticCurveTo(0.45, -0.62, 0, -0.35);
      ctx.fill();
      dark();
      ctx.beginPath(); ctx.moveTo(0, -0.35); ctx.lineTo(0, 0.55); st(ctx, 0.1);
    },
    pot(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(-0.62, -0.25);
      ctx.quadraticCurveTo(-0.7, 0.45, 0, 0.6);
      ctx.quadraticCurveTo(0.7, 0.45, 0.62, -0.25);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -0.28, 0.68, 0.16, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.15, -0.55); ctx.quadraticCurveTo(-0.28, -0.75, -0.12, -0.9); st(ctx, 0.11);
      ctx.beginPath(); ctx.moveTo(0.18, -0.55); ctx.quadraticCurveTo(0.05, -0.72, 0.2, -0.88); st(ctx, 0.11);
      dark();
      ctx.beginPath(); ctx.ellipse(0, -0.28, 0.44, 0.09, 0, 0, TAU); ctx.fill();
    },
    coin(ctx, dark) {
      ctx.beginPath(); ctx.arc(0, 0, 0.75, 0, TAU); ctx.fill();
      dark();
      ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); st(ctx, 0.11);
      ctx.beginPath(); ctx.moveTo(0, -0.28); ctx.lineTo(0, 0.28); st(ctx, 0.14);
    },
    star(ctx, dark) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * TAU;
        const r = i % 2 ? 0.38 : 0.9;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    },
    arrow(ctx, dark) {
      ctx.beginPath(); ctx.moveTo(-0.6, 0.6); ctx.lineTo(0.45, -0.45); st(ctx, 0.2);
      P(ctx, [[0.28, -0.75], [0.75, -0.75], [0.75, -0.28]]); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.6, 0.25); ctx.lineTo(-0.6, 0.6); ctx.lineTo(-0.25, 0.6); st(ctx, 0.16);
    },
    heart(ctx, dark) {
      ctx.beginPath();
      ctx.moveTo(0, 0.72);
      ctx.quadraticCurveTo(-0.85, 0.1, -0.72, -0.32);
      ctx.quadraticCurveTo(-0.6, -0.72, -0.2, -0.6);
      ctx.quadraticCurveTo(-0.02, -0.52, 0, -0.32);
      ctx.quadraticCurveTo(0.02, -0.52, 0.2, -0.6);
      ctx.quadraticCurveTo(0.6, -0.72, 0.72, -0.32);
      ctx.quadraticCurveTo(0.85, 0.1, 0, 0.72);
      ctx.fill();
    },
    swirl(ctx, dark) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const k = i / 40;
        const a = k * Math.PI * 3.2;
        const r = 0.12 + k * 0.68;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      st(ctx, 0.18);
    },
    dagger(ctx, dark) {
      P(ctx, [[-0.1, -0.85], [0.1, -0.85], [0.14, 0.15], [0, 0.35], [-0.14, 0.15]]);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.4, 0.32); ctx.lineTo(0.4, 0.32); st(ctx, 0.16);
      ctx.beginPath(); ctx.moveTo(0, 0.4); ctx.lineTo(0, 0.72); st(ctx, 0.18);
    },
  };

  // ---------------------------------------------------------------- badge
  /**
   * @param name  glyph name
   * @param size  CSS pixel size
   * @param color badge colour (defaults per glyph are the caller's job)
   * @param opts  { flat: no badge circle, just the glyph in `color` }
   */
  Icons.get = function (name, size, color, opts) {
    opts = opts || {};
    color = color || '#8b6cf0';
    const key = name + '|' + size + '|' + color + '|' + (opts.flat ? 1 : 0);
    if (Icons._cache[key]) return Icons._cache[key];

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);

    const glyph = GLYPHS[name] || GLYPHS.star;
    const cx = size / 2;

    if (!opts.flat) {
      // badge disc
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, U.shade(color, 0.35));
      g.addColorStop(0.55, color);
      g.addColorStop(1, U.shade(color, -0.28));
      ctx.beginPath(); ctx.arc(cx, cx, cx - size * 0.045, 0, TAU);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = Math.max(1, size * 0.075);
      ctx.strokeStyle = U.shade(color, -0.55);
      ctx.stroke();
      // inner top highlight
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cx, cx - size * 0.1, 0, TAU); ctx.clip();
      ctx.beginPath(); ctx.arc(cx, cx * 0.55, cx * 0.85, Math.PI * 1.15, Math.PI * 1.85);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = size * 0.08;
      ctx.stroke();
      ctx.restore();
    }

    // glyph, shadow first
    const gs = size * (opts.flat ? 0.5 : 0.3);
    const dark = function () {
      ctx.fillStyle = U.rgba(U.shade(color, -0.5), 0.65);
      ctx.strokeStyle = U.rgba(U.shade(color, -0.5), 0.65);
    };
    [[0, size * 0.028, U.rgba(U.shade(color, -0.6), 0.5)], [0, 0, opts.flat ? color : '#ffffff']].forEach(function (pass) {
      ctx.save();
      ctx.translate(cx + pass[0], cx + pass[1]);
      ctx.scale(gs, gs);
      ctx.fillStyle = pass[2];
      ctx.strokeStyle = pass[2];
      glyph(ctx, pass[1] === 0 ? dark : function () {
        ctx.fillStyle = pass[2]; ctx.strokeStyle = pass[2];
      });
      ctx.restore();
    });

    Icons._cache[key] = c;
    return c;
  };

  /** DOM element wrapper with CSS size set. */
  Icons.el = function (name, size, color, opts) {
    const src = Icons.get(name, size, color, opts);
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    c.style.width = size + 'px';
    c.style.height = size + 'px';
    return c;
  };

  /** A row of n rarity stars as one small canvas (§1.4). */
  Icons.stars = function (n, color, size) {
    size = size || 9;
    const w = n * (size + 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = w * dpr; c.height = size * dpr;
    c.style.width = w + 'px';
    c.style.height = size + 'px';
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(i * (size + 1) + size / 2, size / 2);
      ctx.scale(size / 2, size / 2);
      // dark keyline then fill so stars read on any ground
      ctx.fillStyle = 'rgba(20,12,30,0.85)';
      GLYPHS.star(ctx, function () {});
      ctx.scale(0.78, 0.78);
      ctx.fillStyle = color || '#ffce4d';
      GLYPHS.star(ctx, function () {});
      ctx.restore();
    }
    return c;
  };

  NS.Icons = Icons;
})(window.COC);

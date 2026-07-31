/* Fantasy Kritter — draw.js
 * The shared drawing toolkit every critter is built from.
 *
 * This is deliberately NOT a critter generator. The design bible's silhouette
 * rule (§2.2) cannot be satisfied by a template with swappable ears — the
 * template *is* the silhouette. So this file provides materials, lighting and
 * line weights, and each critter is hand-built on top of it in critterart.js.
 *
 * Conventions shared by every critter:
 *   - local space: feet at (0,0), crown near y = -1, x roughly [-0.6, 0.6]
 *   - one light direction for the whole game: upper left
 *   - line weight varies by role (§2.7): heavy on the outer silhouette,
 *     medium on major internal forms, hairline on surface detail
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const D = {};

  // ---------------------------------------------------------------- light
  /* Light comes from the upper left in every scene. Every helper below derives
   * its gradient from this one vector, which is what makes separately drawn
   * critters look like they are standing in the same world. */
  D.LIGHT = { x: -0.55, y: -0.8 };

  // ---------------------------------------------------------------- weights
  /* Three deliberate line weights. Using one width everywhere is the single
   * clearest tell of flat, cheap vector art (§2.7). */
  D.W = { silhouette: 0.052, form: 0.032, detail: 0.019, hair: 0.012 };

  // ---------------------------------------------------------------- palette
  function ramp(base) {
    return {
      base,
      spec: U.shade(base, 0.68),
      hi: U.shade(base, 0.42),
      lit: U.shade(base, 0.20),
      mid: base,
      shade: U.shade(base, -0.22),
      deep: U.shade(base, -0.40),
      core: U.shade(base, -0.55),
      line: U.shade(base, -0.66),
    };
  }
  D.ramp = ramp;

  /* Gradients live in local space, which never changes between frames, so they
   * are built once and cached on the owning object. */
  function cache(o, key, make) {
    if (!o._g) o._g = {};
    if (!o._g[key]) o._g[key] = make();
    return o._g[key];
  }
  D.cache = cache;

  D.lit = function (ctx, o, key, box, p) {
    return cache(o, 'lit:' + key, function () {
      const g = ctx.createLinearGradient(
        box[0] + (box[2] - box[0]) * 0.15, box[1],
        box[2], box[3]
      );
      g.addColorStop(0, p.hi);
      g.addColorStop(0.42, p.mid);
      g.addColorStop(1, p.shade);
      return g;
    });
  };

  D.glow = function (ctx, o, key, x, y, r0, r1, inner, outer) {
    return cache(o, 'glow:' + key, function () {
      const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
      g.addColorStop(0, inner);
      g.addColorStop(1, outer);
      return g;
    });
  };

  // ---------------------------------------------------------------- shapes
  D.ell = function (ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, U.TAU);
  };
  D.circle = function (ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.abs(r), 0, U.TAU);
  };
  D.poly = function (ctx, pts, close) {
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    if (close !== false) ctx.closePath();
  };
  /** Rounded blob with controllable irregularity — reads as drawn, not geometric. */
  D.blob = function (ctx, x, y, rx, ry, wob, seed, steps) {
    steps = steps || 22;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * U.TAU;
      const w = 1 + Math.sin(a * 3 + seed) * wob + Math.cos(a * 5 - seed * 1.7) * wob * 0.5;
      const px = x + Math.cos(a) * rx * w;
      const py = y + Math.sin(a) * ry * w;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  /** Soft amorphous edge that breathes — clouds, smoke, ghosts. */
  D.puff = function (ctx, x, y, rx, ry, lobes, t, seed) {
    ctx.beginPath();
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * U.TAU;
      const w = 1
        + Math.sin(a * lobes + t * 0.8 + seed) * 0.13
        + Math.sin(a * (lobes * 2 + 1) - t * 0.5 + seed * 2) * 0.06;
      const px = x + Math.cos(a) * rx * w;
      const py = y + Math.sin(a) * ry * w;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  D.taper = function (ctx, x1, y1, x2, y2, w1, w2) {
    const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x1 + dx * w1, y1 + dy * w1);
    ctx.lineTo(x2 + dx * w2, y2 + dy * w2);
    ctx.lineTo(x2 - dx * w2, y2 - dy * w2);
    ctx.lineTo(x1 - dx * w1, y1 - dy * w1);
    ctx.closePath();
  };

  // ---------------------------------------------------------------- ink
  D.stroke = function (ctx, color, w) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  /** Fill with the lit gradient and outline at the silhouette weight. */
  D.body = function (ctx, o, key, box, p, weight) {
    ctx.fillStyle = D.lit(ctx, o, key, box, p);
    ctx.fill();
    D.stroke(ctx, p.line, weight == null ? D.W.silhouette : weight);
  };
  D.form = function (ctx, o, key, box, p) {
    D.body(ctx, o, key, box, p, D.W.form);
  };
  D.flat = function (ctx, color, weight, line) {
    ctx.fillStyle = color;
    ctx.fill();
    if (weight) D.stroke(ctx, line, weight);
  };

  /** Rim light along the shaded edge. Call with the path already built. */
  D.rim = function (ctx, path, color, weight) {
    ctx.save();
    path();
    ctx.clip();
    path();
    D.stroke(ctx, color || 'rgba(255,255,255,0.4)', (weight || D.W.form) * 2.4);
    ctx.restore();
  };

  /** Ground contact shadow (§2.6). */
  D.contact = function (ctx, o, rx, alpha) {
    ctx.save();
    ctx.fillStyle = D.glow(ctx, o, 'contact', 0, 0, 0, rx,
      'rgba(18,12,30,' + (alpha == null ? 0.38 : alpha) + ')', 'rgba(18,12,30,0)');
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, rx * 0.34, 0, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  };

  // ---------------------------------------------------------------- materials
  /* Each material gets its own surface treatment so wood never reads as metal
   * and metal never reads as stone (§2.8). Every one of these expects the
   * caller to have already filled and outlined the base form, and to pass a
   * function that rebuilds that path for clipping. */
  D.MAT = {
    bark(ctx, o, path, p, seed) {
      ctx.save();
      path(); ctx.clip();
      // long grain running with the form, plus a few knots
      const rng = U.rng(seed || 7);
      ctx.strokeStyle = U.rgba(p.core, 0.42);
      for (let i = 0; i < 7; i++) {
        const x = rng.range(-0.5, 0.5);
        ctx.beginPath();
        ctx.moveTo(x, -1.1);
        ctx.bezierCurveTo(x + rng.range(-0.06, 0.06), -0.7, x + rng.range(-0.08, 0.08), -0.3, x + rng.range(-0.05, 0.05), 0.1);
        D.stroke(ctx, U.rgba(p.core, 0.34), D.W.hair * (1 + rng() * 1.6));
      }
      ctx.restore();
    },

    stone(ctx, o, path, p, seed, glowColor) {
      ctx.save();
      path(); ctx.clip();
      const rng = U.rng(seed || 11);
      // fractures, with an inner glow bleeding out of them
      for (let i = 0; i < 5; i++) {
        const x0 = rng.range(-0.4, 0.4), y0 = rng.range(-0.9, -0.1);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        let x = x0, y = y0;
        for (let j = 0; j < 3; j++) {
          x += rng.range(-0.16, 0.16); y += rng.range(0.05, 0.18);
          ctx.lineTo(x, y);
        }
        if (glowColor) {
          D.stroke(ctx, U.rgba(glowColor, 0.85), D.W.detail * 2.6);
          D.stroke(ctx, '#fff6d0', D.W.hair);
        } else {
          D.stroke(ctx, U.rgba(p.core, 0.5), D.W.detail);
        }
      }
      // flat chipped facets catch the light differently
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      for (let i = 0; i < 4; i++) {
        D.poly(ctx, [
          [rng.range(-0.4, 0.2), rng.range(-0.9, -0.2)],
          [rng.range(-0.1, 0.45), rng.range(-0.8, -0.1)],
          [rng.range(-0.3, 0.3), rng.range(-0.5, 0.05)],
        ]);
        ctx.fill();
      }
      ctx.restore();
    },

    ice(ctx, o, path, p, seed) {
      ctx.save();
      path(); ctx.clip();
      // inner light source, then sharp facet lines
      ctx.fillStyle = D.glow(ctx, o, 'iceCore' + seed, 0, -0.5, 0, 0.55,
        U.rgba(p.spec, 0.75), U.rgba(p.spec, 0));
      ctx.fillRect(-1, -1.4, 2, 1.6);
      const rng = U.rng(seed || 13);
      for (let i = 0; i < 6; i++) {
        const x = rng.range(-0.45, 0.45), y = rng.range(-1.0, -0.05);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rng.range(-0.2, 0.2), y + rng.range(-0.25, 0.25));
        D.stroke(ctx, 'rgba(255,255,255,0.55)', D.W.hair * 1.4);
      }
      ctx.restore();
    },

    gel(ctx, o, path, p, seed, t) {
      ctx.save();
      path(); ctx.clip();
      // bubbles drifting upward inside a translucent body
      const rng = U.rng(seed || 17);
      for (let i = 0; i < 9; i++) {
        const bx = rng.range(-0.3, 0.3);
        const speed = rng.range(0.12, 0.3);
        const by = -0.08 - (((t || 0) * speed + rng()) % 1) * 0.62;
        const r = rng.range(0.022, 0.055);
        D.circle(ctx, bx, by, r);
        ctx.fillStyle = U.rgba(p.spec, 0.55);
        ctx.fill();
        D.stroke(ctx, 'rgba(255,255,255,0.5)', D.W.hair);
      }
      // the far side of a translucent body shows through
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      D.ell(ctx, 0.12, -0.16, 0.2, 0.13); ctx.fill();
      ctx.restore();
    },

    ember(ctx, o, path, p, seed, t) {
      ctx.save();
      path(); ctx.clip();
      const rng = U.rng(seed || 19);
      // cracks that pulse like a heartbeat
      const beat = 0.65 + Math.sin((t || 0) * 2.6 + seed) * 0.35;
      for (let i = 0; i < 6; i++) {
        const x0 = rng.range(-0.42, 0.42), y0 = rng.range(-0.95, -0.1);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        let x = x0, y = y0;
        for (let j = 0; j < 3; j++) {
          x += rng.range(-0.14, 0.14); y += rng.range(-0.12, 0.14);
          ctx.lineTo(x, y);
        }
        D.stroke(ctx, U.rgba('#ff7a1e', 0.35 + beat * 0.5), D.W.detail * 3);
        D.stroke(ctx, U.rgba('#ffd88a', 0.6 + beat * 0.4), D.W.hair * 1.5);
      }
      ctx.restore();
    },

    metal(ctx, o, path, p, seed) {
      ctx.save();
      path(); ctx.clip();
      // a hard specular band and a cool bounce below it
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.save();
      ctx.rotate(-0.5);
      ctx.fillRect(-0.9, -0.72, 1.8, 0.075);
      ctx.restore();
      ctx.fillStyle = 'rgba(150,190,255,0.18)';
      ctx.save();
      ctx.rotate(-0.5);
      ctx.fillRect(-0.9, -0.2, 1.8, 0.11);
      ctx.restore();
      ctx.restore();
    },

    ghost(ctx, o, path, p) {
      ctx.save();
      path(); ctx.clip();
      // fades out toward the bottom instead of ending in a hard edge
      const g = cache(o, 'ghostFade', function () {
        const gr = ctx.createLinearGradient(0, -1, 0, 0.05);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(0.55, 'rgba(255,255,255,0)');
        gr.addColorStop(1, 'rgba(0,0,0,0.55)');
        return gr;
      });
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1.4, 2, 1.5);
      ctx.restore();
    },

    fur(ctx, o, path, p, seed) {
      ctx.save();
      path(); ctx.clip();
      const rng = U.rng(seed || 23);
      ctx.strokeStyle = U.rgba(p.deep, 0.3);
      for (let i = 0; i < 26; i++) {
        const x = rng.range(-0.5, 0.5), y = rng.range(-1.0, 0.0);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rng.range(-0.03, 0.03), y + rng.range(0.03, 0.075));
        D.stroke(ctx, U.rgba(p.deep, 0.26), D.W.hair);
      }
      ctx.restore();
    },

    leaf(ctx, o, path, p, seed) {
      ctx.save();
      path(); ctx.clip();
      ctx.strokeStyle = U.rgba(p.core, 0.4);
      ctx.beginPath();
      ctx.moveTo(0, 0.1); ctx.lineTo(0, -0.9);
      D.stroke(ctx, U.rgba(p.core, 0.45), D.W.detail);
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -0.4 + i * 0.11);
        ctx.lineTo(i % 2 ? 0.24 : -0.24, -0.52 + i * 0.11);
        D.stroke(ctx, U.rgba(p.core, 0.3), D.W.hair);
      }
      ctx.restore();
    },
  };

  // ---------------------------------------------------------------- eyes
  /* Expressions are per-critter, not shared (§2.4, §11 forbids identical faces).
   * These are building blocks, and each critter picks its own shape, spacing
   * and lid treatment. */
  D.eye = function (ctx, o, opts) {
    const x = opts.x, y = opts.y;
    const rx = opts.rx, ry = opts.ry * (opts.blink == null ? 1 : opts.blink);
    const iris = opts.iris || '#2a2038';
    const shape = opts.shape || 'round';

    ctx.save();
    if (opts.rot) { ctx.translate(x, y); ctx.rotate(opts.rot); ctx.translate(-x, -y); }

    if (shape === 'slit') {
      D.ell(ctx, x, y, rx, Math.max(ry, 0.004));
      D.flat(ctx, opts.white || '#f6f2ff', D.W.detail, opts.line || '#2a2038');
      D.ell(ctx, x + (opts.look || 0) * rx * 0.3, y, rx * 0.2, ry * 0.92);
      D.flat(ctx, iris, 0);
    } else if (shape === 'glow') {
      ctx.fillStyle = D.glow(ctx, o, 'eyeglow' + x, x, y, 0, rx * 2.6,
        U.rgba(opts.glowColor || '#8fd8ff', 0.9), U.rgba(opts.glowColor || '#8fd8ff', 0));
      ctx.beginPath(); ctx.arc(x, y, rx * 2.6, 0, U.TAU); ctx.fill();
      D.ell(ctx, x, y, rx, Math.max(ry, 0.004));
      D.flat(ctx, opts.glowColor || '#cfefff', 0);
    } else {
      // a solid glossy eye: the dark mass reads at any size
      D.ell(ctx, x, y, rx, Math.max(ry, 0.005));
      const p = ramp(iris);
      ctx.fillStyle = cache(o, 'irisG' + x + shape, function () {
        const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
        g.addColorStop(0, p.core);
        g.addColorStop(0.65, U.shade(iris, -0.25));
        g.addColorStop(1, U.shade(iris, 0.32));
        return g;
      });
      ctx.fill();
      if (opts.outline !== false) D.stroke(ctx, opts.line || U.shade(iris, -0.6), D.W.detail);
      if (opts.blink == null || opts.blink > 0.4) {
        ctx.save();
        D.ell(ctx, x, y, rx, ry); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        D.ell(ctx, x - rx * 0.33, y - ry * 0.38, rx * 0.34, ry * 0.3, -0.4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        D.circle(ctx, x + rx * 0.36, y + ry * 0.34, rx * 0.17); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  };

  /** Brow line. Angle drives the whole read of a face, so each critter sets it. */
  D.brow = function (ctx, x, y, len, tilt, color, weight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0.012);
    ctx.quadraticCurveTo(0, -0.018, len / 2, 0);
    D.stroke(ctx, color || '#2a2038', weight || D.W.form);
    ctx.restore();
  };

  D.mouth = function (ctx, opts) {
    const x = opts.x || 0, y = opts.y;
    const w = opts.w || 0.1;
    ctx.beginPath();
    if (opts.shape === 'smirk') {
      ctx.moveTo(x - w * 0.5, y);
      ctx.quadraticCurveTo(x, y + w * 0.55, x + w * 0.62, y - w * 0.22);
    } else if (opts.shape === 'grin') {
      ctx.moveTo(x - w * 0.6, y - w * 0.1);
      ctx.quadraticCurveTo(x, y + w * 0.85, x + w * 0.6, y - w * 0.1);
    } else if (opts.shape === 'flat') {
      ctx.moveTo(x - w * 0.5, y);
      ctx.lineTo(x + w * 0.5, y);
    } else if (opts.shape === 'open') {
      D.ell(ctx, x, y, w * 0.42, w * 0.5);
      D.flat(ctx, opts.inner || '#6a2438', D.W.detail, opts.color || '#2a2038');
      return;
    } else {
      ctx.moveTo(x - w * 0.45, y - w * 0.12);
      ctx.quadraticCurveTo(x, y + w * 0.45, x + w * 0.45, y - w * 0.12);
    }
    D.stroke(ctx, opts.color || '#2a2038', opts.weight || D.W.form);
  };

  /** Per-critter blink timing so a line-up never blinks in unison. */
  D.blink = function (t, seed) {
    const cycle = 3.1 + (seed % 7) * 0.43;
    const phase = (t + seed * 1.9) % cycle;
    return phase < 0.14 ? Math.abs(phase - 0.07) / 0.07 : 1;
  };

  NS.D = D;
})(window.COC);

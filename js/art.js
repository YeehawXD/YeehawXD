/* Critter Clash — art.js
 * Every critter is drawn as layered vector art, built from one spec object.
 *
 * The look is deliberately consistent rather than incidental:
 *   - one light direction (upper left) for every form in the game
 *   - each mass gets base gradient -> contact shadow -> rim light -> outline
 *   - outlines are a deep tint of the fill, never pure black, which is what
 *     keeps flat vector art from looking like clip art
 *   - chibi proportions: the head is roughly half the height
 *
 * Local drawing space: feet at (0,0), head crown near y = -1, x in [-0.5, 0.5].
 * Callers scale that unit into whatever size they need.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const Art = {};

  // ---------------------------------------------------------------- palette
  /* Derive a whole ramp from one base colour so every critter is lit the same
   * way without hand-picking six colours per character. */
  function ramp(base) {
    return {
      base,
      lit: U.shade(base, 0.30),
      hi: U.shade(base, 0.55),
      mid: base,
      shade: U.shade(base, -0.24),
      deep: U.shade(base, -0.42),
      line: U.shade(base, -0.62),
    };
  }
  Art.ramp = ramp;

  /* Gradients are created in local space, which never changes between frames,
   * so they are built once per palette and cached on the spec. */
  function grad(ctx, spec, key, x0, y0, x1, y1, stops) {
    spec._g = spec._g || {};
    if (spec._g[key]) return spec._g[key];
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    spec._g[key] = g;
    return g;
  }
  function radial(ctx, spec, key, x, y, r0, r1, stops) {
    spec._g = spec._g || {};
    if (spec._g[key]) return spec._g[key];
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    spec._g[key] = g;
    return g;
  }

  function pal(spec) {
    if (!spec._p) spec._p = ramp(spec.base || '#8fd06a');
    return spec._p;
  }
  function palAccent(spec) {
    if (!spec._pa) spec._pa = ramp(spec.accent || U.shade(spec.base || '#8fd06a', -0.3));
    return spec._pa;
  }

  const LW = 0.038;

  // ---------------------------------------------------------------- shapes
  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, U.TAU);
  }
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.abs(r), 0, U.TAU);
  }
  function tri(ctx, ax, ay, bx, by, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath();
  }
  /** Slightly irregular round form — reads as drawn rather than geometric. */
  function organic(ctx, x, y, rx, ry, wobble, seed) {
    const steps = 20;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * U.TAU;
      const w = 1 + Math.sin(a * 3 + seed) * wobble + Math.cos(a * 5 - seed * 1.7) * wobble * 0.45;
      const px = x + Math.cos(a) * rx * w;
      const py = y + Math.sin(a) * ry * w;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  Art.ell = ell; Art.circle = circle; Art.organic = organic; Art.tri = tri;

  function stroke(ctx, color, w) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = w == null ? LW : w;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  /** Fill the current path with a top-left lit gradient, then outline it. */
  function form(ctx, spec, key, p, box, lw) {
    ctx.fillStyle = grad(ctx, spec, key, box[0], box[1], box[2], box[3], [
      [0, p.lit], [0.45, p.mid], [1, p.shade],
    ]);
    ctx.fill();
    stroke(ctx, p.line, lw == null ? LW : lw);
  }

  // ---------------------------------------------------------------- proportions
  const P = {
    headY: -0.655,
    headR: 0.335,
    bodyY: -0.215,
    bodyRX: 0.245,
    bodyRY: 0.205,
  };

  // ---------------------------------------------------------------- parts
  function drawShadow(ctx, spec, squash) {
    ctx.save();
    ctx.fillStyle = radial(ctx, spec, 'shadow', 0, 0, 0, 0.4, [
      [0, 'rgba(20,14,34,0.34)'], [0.65, 'rgba(20,14,34,0.16)'], [1, 'rgba(20,14,34,0)'],
    ]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.4 * squash, 0.14 * squash, 0, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawTail(ctx, spec, t, phase) {
    const kind = spec.tail;
    if (!kind || kind === 'none') return;
    const p = palAccent(spec);
    const sway = Math.sin(t * 2.6 + phase) * 0.14;
    ctx.save();
    ctx.translate(-0.20, -0.24);
    ctx.rotate(sway * 0.5);

    if (kind === 'fluffy') {
      ctx.beginPath();
      ctx.moveTo(0, 0.04);
      ctx.quadraticCurveTo(-0.34, -0.02, -0.36, -0.30);
      ctx.quadraticCurveTo(-0.34, -0.50, -0.16, -0.44);
      ctx.quadraticCurveTo(-0.22, -0.28, -0.10, -0.14);
      ctx.closePath();
      form(ctx, spec, 'tailF', p, [-0.36, -0.5, -0.05, 0.04]);
    } else if (kind === 'thin') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-0.26, 0.02, -0.30, -0.22 + sway);
      stroke(ctx, p.mid, 0.075);
      stroke(ctx, p.line, 0.028);
      circle(ctx, -0.30, -0.24 + sway, 0.06);
      form(ctx, spec, 'tailTip', p, [-0.36, -0.3, -0.24, -0.18]);
    } else if (kind === 'leaf') {
      ctx.rotate(-0.5);
      ell(ctx, -0.18, -0.10, 0.20, 0.10, -0.4);
      form(ctx, spec, 'tailL', p, [-0.36, -0.2, 0, 0]);
      ctx.beginPath();
      ctx.moveTo(-0.34, -0.02); ctx.lineTo(-0.02, -0.18);
      stroke(ctx, p.deep, 0.024);
    } else if (kind === 'flame') {
      ctx.beginPath();
      ctx.moveTo(0, 0.02);
      ctx.quadraticCurveTo(-0.30, -0.06, -0.26, -0.34);
      ctx.quadraticCurveTo(-0.16, -0.22, -0.16, -0.40 - Math.sin(t * 6) * 0.05);
      ctx.quadraticCurveTo(-0.06, -0.24, 0.02, -0.14);
      ctx.closePath();
      ctx.fillStyle = grad(ctx, spec, 'tailFlame', 0, -0.4, 0, 0.02, [
        [0, '#ffe9a0'], [0.45, '#ff9a3c'], [1, '#e8452a'],
      ]);
      ctx.fill();
      stroke(ctx, 'rgba(120,30,10,0.55)', 0.026);
    } else if (kind === 'fan') {
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.rotate(i * 0.42 - 0.5);
        ell(ctx, -0.20, -0.06, 0.21, 0.075, 0);
        form(ctx, spec, 'tailFan' + i, p, [-0.4, -0.14, 0, 0.02], 0.028);
        ctx.restore();
      }
    } else if (kind === 'bolt') {
      ctx.beginPath();
      ctx.moveTo(0.02, 0.0);
      ctx.lineTo(-0.20, -0.10);
      ctx.lineTo(-0.10, -0.20);
      ctx.lineTo(-0.34, -0.38);
      ctx.lineTo(-0.16, -0.30);
      ctx.lineTo(-0.24, -0.16);
      ctx.closePath();
      ctx.fillStyle = grad(ctx, spec, 'tailBolt', -0.34, -0.38, 0, 0, [
        [0, '#fff2a8'], [1, '#f5c020'],
      ]);
      ctx.fill();
      stroke(ctx, 'rgba(120,80,0,0.6)', 0.026);
    }
    ctx.restore();
  }

  function drawLegs(ctx, spec, walk) {
    if (spec.floats) return;
    const p = palAccent(spec);
    const sw = Math.sin(walk) * 0.045;
    for (const s of [-1, 1]) {
      const x = s * 0.115 + (s > 0 ? sw : -sw);
      ell(ctx, x, -0.045, 0.085, 0.06);
      ctx.fillStyle = grad(ctx, spec, 'leg' + s, x - 0.08, -0.1, x + 0.08, 0.01, [
        [0, p.mid], [1, p.shade],
      ]);
      ctx.fill();
      stroke(ctx, p.line, 0.03);
    }
  }

  function drawArms(ctx, spec, bob, swing, side) {
    const p = pal(spec);
    const y = P.bodyY - 0.02 + bob;
    const s = side;
    const lift = side > 0 ? swing * 0.5 : -swing * 0.16;
    ctx.save();
    ctx.translate(s * 0.235, y);
    ctx.rotate(-s * lift);
    ell(ctx, 0, 0.05, 0.075, 0.105, s * 0.18);
    ctx.fillStyle = grad(ctx, spec, 'arm' + s, -0.07, -0.05, 0.07, 0.15, [
      [0, s < 0 ? p.mid : p.lit], [1, p.shade],
    ]);
    ctx.fill();
    stroke(ctx, p.line, 0.03);
    ctx.restore();
  }

  function drawBody(ctx, spec, bob) {
    const p = pal(spec);
    const shape = spec.body || 'round';
    const y = P.bodyY + bob;
    let rx = P.bodyRX, ry = P.bodyRY;
    if (shape === 'chubby') { rx = 0.285; ry = 0.225; }
    if (shape === 'slim') { rx = 0.20; ry = 0.215; }
    if (shape === 'wide') { rx = 0.315; ry = 0.185; }

    organic(ctx, 0, y, rx, ry, 0.02, spec.seed || 1);
    form(ctx, spec, 'body', p, [-rx, y - ry, rx, y + ry]);

    // belly patch
    if (spec.belly) {
      ctx.save();
      organic(ctx, 0, y, rx, ry, 0.02, spec.seed || 1);
      ctx.clip();
      ell(ctx, 0, y + 0.06, rx * 0.66, ry * 0.72);
      ctx.fillStyle = grad(ctx, spec, 'belly', 0, y - 0.1, 0, y + ry, [
        [0, spec.belly], [1, U.shade(spec.belly, -0.12)],
      ]);
      ctx.fill();
      ctx.restore();
    }

    // markings
    if (spec.pattern === 'spots') {
      ctx.save();
      organic(ctx, 0, y, rx, ry, 0.02, spec.seed || 1);
      ctx.clip();
      ctx.fillStyle = U.rgba(spec.patternColor || '#000000', 0.18);
      circle(ctx, -rx * 0.55, y - 0.06, 0.055); ctx.fill();
      circle(ctx, rx * 0.6, y + 0.02, 0.045); ctx.fill();
      ctx.restore();
    } else if (spec.pattern === 'stripes') {
      ctx.save();
      organic(ctx, 0, y, rx, ry, 0.02, spec.seed || 1);
      ctx.clip();
      ctx.strokeStyle = U.rgba(spec.patternColor || '#000000', 0.20);
      ctx.lineWidth = 0.055;
      for (let i = -1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-0.4, y - 0.12 + i * 0.10);
        ctx.lineTo(0.4, y - 0.05 + i * 0.10);
        ctx.stroke();
      }
      ctx.restore();
    }

    // contact shadow where the head sits on the body
    ctx.save();
    organic(ctx, 0, y, rx, ry, 0.02, spec.seed || 1);
    ctx.clip();
    ctx.fillStyle = radial(ctx, spec, 'neck', 0, y - ry, 0, ry * 1.5, [
      [0, 'rgba(30,18,50,0.30)'], [1, 'rgba(30,18,50,0)'],
    ]);
    ctx.fillRect(-rx, y - ry, rx * 2, ry * 2);
    ctx.restore();

    // bounce light along the lower right
    ctx.save();
    organic(ctx, 0, y, rx, ry, 0.02, spec.seed || 1);
    ctx.clip();
    ctx.strokeStyle = U.rgba('#ffffff', 0.20);
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.ellipse(0, y, rx * 0.98, ry * 0.98, 0, 0.15, 1.35);
    ctx.stroke();
    ctx.restore();
  }

  function drawEars(ctx, spec, bob, wiggle) {
    const kind = spec.ears || 'cat';
    if (kind === 'none') return;
    const p = pal(spec);
    const pa = palAccent(spec);
    const hy = P.headY + bob;
    const hr = P.headR;

    const pair = (fn) => {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * hr * 0.62, hy - hr * 0.80);
        ctx.rotate(s * (0.18 + wiggle * 0.10));
        ctx.scale(s, 1);
        fn(s);
        ctx.restore();
      }
    };

    if (kind === 'cat') {
      pair(() => {
        ctx.beginPath();
        ctx.moveTo(-0.10, 0.10);
        ctx.quadraticCurveTo(-0.05, -0.24, 0.10, -0.19);
        ctx.quadraticCurveTo(0.15, -0.06, 0.13, 0.09);
        ctx.closePath();
        form(ctx, spec, 'ear', p, [-0.1, -0.24, 0.14, 0.1], 0.032);
        ctx.beginPath();
        ctx.moveTo(-0.045, 0.06);
        ctx.quadraticCurveTo(-0.02, -0.15, 0.06, -0.13);
        ctx.quadraticCurveTo(0.085, -0.04, 0.075, 0.05);
        ctx.closePath();
        ctx.fillStyle = spec.earInner || U.mix(pa.mid, '#ffffff', 0.5);
        ctx.fill();
      });
    } else if (kind === 'long') {
      pair(() => {
        ell(ctx, 0.02, -0.16, 0.075, 0.21, 0.14);
        form(ctx, spec, 'earL', p, [-0.06, -0.37, 0.1, 0.05], 0.032);
        ell(ctx, 0.03, -0.16, 0.036, 0.145, 0.14);
        ctx.fillStyle = spec.earInner || U.mix(pa.mid, '#ffffff', 0.45);
        ctx.fill();
      });
    } else if (kind === 'round') {
      pair(() => {
        circle(ctx, 0.02, -0.06, 0.115);
        form(ctx, spec, 'earR', p, [-0.09, -0.17, 0.13, 0.05], 0.032);
        circle(ctx, 0.03, -0.05, 0.06);
        ctx.fillStyle = spec.earInner || U.mix(pa.mid, '#ffffff', 0.45);
        ctx.fill();
      });
    } else if (kind === 'fin') {
      pair(() => {
        ctx.beginPath();
        ctx.moveTo(-0.02, 0.10);
        ctx.quadraticCurveTo(0.22, -0.02, 0.20, -0.16);
        ctx.quadraticCurveTo(0.06, -0.10, -0.04, 0.02);
        ctx.closePath();
        form(ctx, spec, 'earFin', pa, [-0.04, -0.16, 0.22, 0.1], 0.03);
      });
    } else if (kind === 'horn') {
      pair(() => {
        ctx.beginPath();
        ctx.moveTo(-0.06, 0.08);
        ctx.quadraticCurveTo(0.02, -0.16, 0.12, -0.22);
        ctx.quadraticCurveTo(0.06, -0.06, 0.08, 0.07);
        ctx.closePath();
        const hp = ramp(spec.hornColor || '#f4e6cc');
        ctx.fillStyle = grad(ctx, spec, 'horn', -0.06, -0.22, 0.12, 0.08, [
          [0, hp.hi], [1, hp.shade],
        ]);
        ctx.fill();
        stroke(ctx, hp.line, 0.028);
      });
    } else if (kind === 'tuft') {
      ctx.save();
      ctx.translate(0, hy - hr * 0.94);
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.rotate(i * 0.42 + wiggle * 0.06);
        ctx.beginPath();
        ctx.moveTo(-0.05, 0.06);
        ctx.quadraticCurveTo(0, -0.24, 0.05, 0.06);
        ctx.closePath();
        form(ctx, spec, 'tuft' + i, pa, [-0.05, -0.24, 0.05, 0.06], 0.028);
        ctx.restore();
      }
      ctx.restore();
    } else if (kind === 'antenna') {
      pair(() => {
        ctx.beginPath();
        ctx.moveTo(0, 0.06);
        ctx.quadraticCurveTo(0.06, -0.12, 0.12, -0.20 + wiggle * 0.03);
        stroke(ctx, pa.line, 0.032);
        circle(ctx, 0.12, -0.21 + wiggle * 0.03, 0.055);
        form(ctx, spec, 'ant', pa, [0.06, -0.27, 0.18, -0.15], 0.026);
      });
    }
  }

  function drawHead(ctx, spec, bob, t, mood) {
    const p = pal(spec);
    const hy = P.headY + bob;
    let hr = P.headR;
    const shape = spec.headShape || 'round';
    const rx = shape === 'wide' ? hr * 1.10 : shape === 'tall' ? hr * 0.90 : hr;
    const ry = shape === 'wide' ? hr * 0.92 : shape === 'tall' ? hr * 1.08 : hr * 0.98;

    organic(ctx, 0, hy, rx, ry, 0.018, (spec.seed || 1) + 4);
    form(ctx, spec, 'head', p, [-rx, hy - ry, rx * 0.8, hy + ry]);

    // cheek/jaw fur
    if (spec.cheekFur) {
      ctx.save();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * rx * 0.72, hy + 0.02);
        ctx.lineTo(s * rx * 1.18, hy + 0.10);
        ctx.lineTo(s * rx * 0.74, hy + 0.16);
        ctx.closePath();
        form(ctx, spec, 'cheekfur' + s, p, [0, hy, s * rx, hy + 0.16], 0.028);
      }
      ctx.restore();
    }

    // muzzle
    if (spec.muzzle === 'snout') {
      ell(ctx, 0, hy + ry * 0.42, rx * 0.44, ry * 0.30);
      const mp = ramp(spec.muzzleColor || U.mix(spec.base, '#ffffff', 0.55));
      ctx.fillStyle = grad(ctx, spec, 'muzzle', 0, hy + ry * 0.12, 0, hy + ry * 0.72, [
        [0, mp.hi], [1, mp.shade],
      ]);
      ctx.fill();
      stroke(ctx, mp.line, 0.028);
      // nose
      ell(ctx, 0, hy + ry * 0.30, 0.042, 0.031);
      ctx.fillStyle = spec.noseColor || '#3a2740';
      ctx.fill();
    } else if (spec.muzzle === 'beak') {
      const bp = ramp(spec.beakColor || '#ffb648');
      ctx.beginPath();
      ctx.moveTo(-0.085, hy + ry * 0.26);
      ctx.quadraticCurveTo(0, hy + ry * 0.30, 0.085, hy + ry * 0.26);
      ctx.quadraticCurveTo(0.02, hy + ry * 0.74, 0, hy + ry * 0.76);
      ctx.quadraticCurveTo(-0.02, hy + ry * 0.74, -0.085, hy + ry * 0.26);
      ctx.closePath();
      ctx.fillStyle = grad(ctx, spec, 'beak', -0.08, hy, 0.08, hy + ry * 0.8, [
        [0, bp.hi], [1, bp.shade],
      ]);
      ctx.fill();
      stroke(ctx, bp.line, 0.028);
    } else if (spec.muzzle === 'nose') {
      ell(ctx, 0, hy + ry * 0.34, 0.05, 0.037);
      ctx.fillStyle = spec.noseColor || '#3a2740';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ell(ctx, -0.015, hy + ry * 0.31, 0.018, 0.012); ctx.fill();
    }

    drawEyes(ctx, spec, hy, rx, ry, t, mood);

    // blush
    if (spec.blush !== false) {
      const bx = rx * 0.66, by = hy + ry * 0.30;
      for (const s of [-1, 1]) {
        ctx.fillStyle = radial(ctx, spec, 'blush' + s, s * bx, by, 0, 0.085, [
          [0, U.rgba(spec.blushColor || '#ff7fa4', 0.45)],
          [1, U.rgba(spec.blushColor || '#ff7fa4', 0)],
        ]);
        ctx.beginPath();
        ctx.arc(s * bx, by, 0.085, 0, U.TAU);
        ctx.fill();
      }
    }

    // top light
    ctx.save();
    organic(ctx, 0, hy, rx, ry, 0.018, (spec.seed || 1) + 4);
    ctx.clip();
    ctx.fillStyle = radial(ctx, spec, 'headHi', -rx * 0.35, hy - ry * 0.55, 0, rx * 0.85, [
      [0, 'rgba(255,255,255,0.30)'], [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.fillRect(-rx, hy - ry, rx * 2, ry * 2);
    ctx.restore();
  }

  function drawEyes(ctx, spec, hy, rx, ry, t, mood) {
    const kind = spec.eyes || 'wide';
    const ex = rx * 0.40;
    const ey = hy + ry * 0.04;
    // Blink on a slow, per-critter offset so a group never blinks in unison.
    const cycle = 3.4 + ((spec.seed || 1) % 5) * 0.5;
    const phase = (t + (spec.seed || 0) * 1.7) % cycle;
    const blink = phase < 0.13 ? Math.abs(phase - 0.065) / 0.065 : 1;
    const closed = mood === 'ko';

    if (kind === 'visor') {
      ctx.beginPath();
      ctx.moveTo(-rx * 0.92, ey - 0.06);
      ctx.quadraticCurveTo(0, ey - 0.14, rx * 0.92, ey - 0.06);
      ctx.quadraticCurveTo(0, ey + 0.14, -rx * 0.92, ey - 0.06);
      ctx.closePath();
      ctx.fillStyle = grad(ctx, spec, 'visor', -rx, ey - 0.14, rx, ey + 0.14, [
        [0, '#9fe8ff'], [0.5, '#3fa8d8'], [1, '#1d5f8a'],
      ]);
      ctx.fill();
      stroke(ctx, '#16324a', 0.032);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ell(ctx, -rx * 0.42, ey - 0.045, 0.06, 0.022, -0.2); ctx.fill();
      return;
    }

    /* One big glossy eye rather than a white sclera with a pupil inside.
     * A dark eye with two speculars is what makes this style read as charming
     * instead of goggle-eyed — a white ring around a dark centre looks like
     * spectacles at small sizes. */
    for (const s of [-1, 1]) {
      const x = s * ex;
      if (closed || kind === 'sleepy') {
        ctx.beginPath();
        ctx.arc(x, ey, 0.078, Math.PI * 0.10, Math.PI * 0.90);
        stroke(ctx, spec.eyeLine || '#3a2b4e', 0.038);
        continue;
      }
      const w = kind === 'sharp' ? 0.082 : 0.094;
      const h = (kind === 'sharp' ? 0.095 : 0.112) * blink;

      ell(ctx, x, ey, w, Math.max(h, 0.006));
      ctx.fillStyle = grad(ctx, spec, 'eye' + s, x, ey - h, x, ey + h, [
        [0, U.mix(spec.eyeColor || '#3a2b4e', '#000000', 0.15)],
        [0.62, U.mix(spec.eyeColor || '#3a2b4e', '#000000', 0.45)],
        [1, U.mix(spec.eyeColor || '#3a2b4e', '#ffffff', 0.30)],
      ]);
      ctx.fill();

      if (blink > 0.4) {
        ctx.save();
        ell(ctx, x, ey, w, h);
        ctx.clip();
        // main catchlight, upper left, then a soft bounce lower right
        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        ell(ctx, x - w * 0.34, ey - h * 0.36, w * 0.36, h * 0.30, -0.4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        circle(ctx, x + w * 0.34, ey + h * 0.34, w * 0.20);
        ctx.fill();
        ctx.restore();
      }

      if (kind === 'sharp') {
        // brow angled inner-low to outer-high, which reads determined.
        // The opposite slope makes every critter look permanently worried.
        ctx.beginPath();
        ctx.moveTo(x - s * w * 1.05, ey - h * 0.85);
        ctx.lineTo(x + s * w * 1.05, ey - h * 1.62);
        stroke(ctx, spec.browColor || U.shade(spec.base || '#5a4a6a', -0.45), 0.046);
      }
    }
  }

  // ---------------------------------------------------------------- extras
  const EXTRAS = {
    scarf(ctx, spec, bob, t) {
      const p = ramp(spec.extraColor || '#e0567a');
      const y = P.headY + P.headR * 0.94 + bob;
      ctx.beginPath();
      ctx.moveTo(-0.21, y - 0.02);
      ctx.quadraticCurveTo(0, y + 0.09, 0.21, y - 0.02);
      ctx.quadraticCurveTo(0, y + 0.05, -0.21, y - 0.02);
      ctx.closePath();
      form(ctx, spec, 'scarf', p, [-0.21, y - 0.03, 0.21, y + 0.09], 0.03);
      ctx.save();
      ctx.translate(0.16, y + 0.02);
      ctx.rotate(0.5 + Math.sin(t * 3) * 0.12);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0.16, 0.05); ctx.lineTo(0.03, 0.1);
      ctx.closePath();
      form(ctx, spec, 'scarfTail', p, [0, 0, 0.16, 0.1], 0.028);
      ctx.restore();
    },
    crest(ctx, spec, bob, t) {
      const p = ramp(spec.extraColor || '#ffd45e');
      const hy = P.headY + bob;
      ctx.save();
      ctx.translate(0, hy - P.headR * 0.98);
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.rotate(i * 0.34);
        ctx.beginPath();
        ctx.moveTo(-0.045, 0.05);
        ctx.quadraticCurveTo(0, -0.26 - Math.abs(i) * -0.05, 0.045, 0.05);
        ctx.closePath();
        form(ctx, spec, 'crest' + i, p, [-0.05, -0.26, 0.05, 0.05], 0.028);
        ctx.restore();
      }
      ctx.restore();
    },
    /* Drawn behind the body so the dome reads as a shell the critter is wearing
       rather than a stripe painted across its belly. */
    shell(ctx, spec, bob) {
      const p = ramp(spec.extraColor || '#8a6a4a');
      const y = P.bodyY + bob + 0.02;
      ell(ctx, 0, y - 0.02, 0.375, 0.315);
      form(ctx, spec, 'shell', p, [-0.375, y - 0.34, 0.30, y + 0.28]);
      ctx.save();
      ell(ctx, 0, y - 0.02, 0.375, 0.315);
      ctx.clip();
      ctx.strokeStyle = U.rgba(p.deep, 0.5);
      ctx.lineWidth = 0.028;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 0.13, y + 0.3);
        ctx.lineTo(i * 0.19, y - 0.36);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(0, y - 0.02, 0.22, 0.185, 0, 0, U.TAU); ctx.stroke();
      ctx.restore();
    },
    spikes(ctx, spec, bob) {
      const p = ramp(spec.extraColor || '#cfd8e6');
      const y = P.bodyY + bob;
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(i * 0.10, y - 0.19 - Math.abs(i) * -0.012);
        ctx.rotate(i * 0.24);
        ctx.beginPath();
        ctx.moveTo(-0.035, 0.05); ctx.lineTo(0, -0.15); ctx.lineTo(0.035, 0.05);
        ctx.closePath();
        form(ctx, spec, 'spike' + i, p, [-0.035, -0.15, 0.035, 0.05], 0.024);
        ctx.restore();
      }
    },
    mane(ctx, spec, bob) {
      const p = ramp(spec.extraColor || '#ff9a3c');
      const hy = P.headY + bob;
      const r = P.headR;
      // Spikes point outward from behind the head; long enough to actually
      // change the silhouette, which is the whole point of a mane.
      for (let i = 0; i < 13; i++) {
        const a = (i / 13) * U.TAU;
        const len = 0.20 + (i % 2) * 0.07;
        ctx.save();
        ctx.translate(Math.cos(a) * r * 0.86, hy + Math.sin(a) * r * 0.86);
        ctx.rotate(a - Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(-0.075, 0); ctx.lineTo(0, -len); ctx.lineTo(0.075, 0);
        ctx.closePath();
        form(ctx, spec, 'mane' + i, p, [-0.075, -len, 0.075, 0], 0.026);
        ctx.restore();
      }
    },
    flowers(ctx, spec, bob, t) {
      const hy = P.headY + bob;
      ctx.save();
      ctx.translate(P.headR * 0.66, hy - P.headR * 0.82);
      const petal = spec.extraColor || '#ff9ec4';
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i / 5) * U.TAU + Math.sin(t) * 0.05);
        ell(ctx, 0, -0.07, 0.042, 0.07);
        ctx.fillStyle = petal; ctx.fill();
        stroke(ctx, U.shade(petal, -0.45), 0.022);
        ctx.restore();
      }
      circle(ctx, 0, 0, 0.042);
      ctx.fillStyle = '#ffe066'; ctx.fill();
      stroke(ctx, '#a8781a', 0.022);
      ctx.restore();
    },
    goggles(ctx, spec, bob) {
      const hy = P.headY + bob;
      const ey = hy - P.headR * 0.55;
      ctx.beginPath();
      ctx.moveTo(-P.headR, ey); ctx.lineTo(P.headR, ey);
      stroke(ctx, '#4a3a58', 0.05);
      for (const s of [-1, 1]) {
        circle(ctx, s * P.headR * 0.42, ey, 0.085);
        ctx.fillStyle = grad(ctx, spec, 'gog' + s, s * 0.42 * P.headR - 0.08, ey - 0.08,
          s * 0.42 * P.headR + 0.08, ey + 0.08, [[0, '#bfeeff'], [1, '#4a8fb0']]);
        ctx.fill();
        stroke(ctx, '#3a2f48', 0.03);
      }
    },
    gem(ctx, spec, bob, t) {
      const hy = P.headY + bob;
      const c = spec.extraColor || '#7fe0ff';
      ctx.save();
      ctx.translate(0, hy - P.headR * 0.55);
      const glow = 0.5 + Math.sin(t * 3) * 0.2;
      ctx.globalAlpha = 0.35 * glow;
      circle(ctx, 0, 0, 0.13); ctx.fillStyle = c; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(0, -0.085); ctx.lineTo(0.06, 0); ctx.lineTo(0, 0.085); ctx.lineTo(-0.06, 0);
      ctx.closePath();
      ctx.fillStyle = grad(ctx, spec, 'gem', 0, -0.085, 0, 0.085, [
        [0, U.shade(c, 0.5)], [1, U.shade(c, -0.2)],
      ]);
      ctx.fill();
      stroke(ctx, U.shade(c, -0.55), 0.024);
      ctx.restore();
    },
  };

  // ---------------------------------------------------------------- element motif
  const ELEMENT_FX = {
    ember(ctx, t, seed) {
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.55 + i / 3 + seed * 0.13) % 1);
        const a = (1 - k) * 0.55;
        ctx.globalAlpha = a;
        ctx.fillStyle = i % 2 ? '#ffd07a' : '#ff8a3c';
        circle(ctx, Math.sin(k * 7 + i * 2) * 0.22, -0.15 - k * 0.9, 0.028 * (1 - k * 0.5));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    tide(ctx, t, seed) {
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.4 + i / 3 + seed * 0.2) % 1);
        ctx.globalAlpha = (1 - k) * 0.5;
        ctx.fillStyle = '#9fe4ff';
        circle(ctx, Math.cos(k * 5 + i * 2.2) * 0.26, -0.2 - k * 0.75, 0.03 * (1 - k * 0.4));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    bloom(ctx, t, seed) {
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.32 + i / 3 + seed * 0.17) % 1);
        ctx.globalAlpha = (1 - k) * 0.55;
        ctx.save();
        ctx.translate(Math.sin(k * 4 + i * 2) * 0.3, -0.1 - k * 0.85);
        ctx.rotate(k * 4);
        ctx.fillStyle = '#a8e86a';
        ell(ctx, 0, 0, 0.045, 0.02); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    stone(ctx, t, seed) {
      for (let i = 0; i < 2; i++) {
        const k = ((t * 0.3 + i / 2 + seed * 0.3) % 1);
        ctx.globalAlpha = (1 - k) * 0.4;
        ctx.fillStyle = '#d8b98a';
        ctx.save();
        ctx.translate(Math.sin(k * 3 + i * 3) * 0.3, -0.05 - k * 0.5);
        ctx.rotate(k * 3);
        ctx.fillRect(-0.026, -0.026, 0.052, 0.052);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    spark(ctx, t, seed) {
      const on = (Math.sin(t * 9 + seed) > 0.55);
      if (!on) return;
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#ffe98a';
      ctx.lineWidth = 0.026;
      for (let i = 0; i < 2; i++) {
        const a = (seed + i * 2.1 + t) % U.TAU;
        const r = 0.36;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, -0.45 + Math.sin(a) * r * 0.7);
        ctx.lineTo(Math.cos(a) * r * 1.3, -0.45 + Math.sin(a) * r * 0.95);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  };

  // ---------------------------------------------------------------- quadruped
  function drawQuad(ctx, spec, o, bob, walk, swing, t, mood) {
    const p = pal(spec);
    const pa = palAccent(spec);
    const by = -0.30 + bob;

    // far legs
    for (const lx of [-0.19, 0.17]) {
      const sw = Math.sin(walk + (lx > 0 ? 1.6 : 0)) * 0.04;
      ell(ctx, lx + sw, -0.07, 0.062, 0.10);
      ctx.fillStyle = pa.shade; ctx.fill();
      stroke(ctx, pa.line, 0.028);
    }

    drawTail(ctx, spec, t, spec.seed || 0);

    // barrel body
    organic(ctx, -0.02, by, 0.33, 0.20, 0.02, spec.seed || 1);
    form(ctx, spec, 'qbody', p, [-0.35, by - 0.2, 0.31, by + 0.2]);
    if (spec.belly) {
      ctx.save();
      organic(ctx, -0.02, by, 0.33, 0.20, 0.02, spec.seed || 1);
      ctx.clip();
      ell(ctx, -0.02, by + 0.10, 0.24, 0.10);
      ctx.fillStyle = spec.belly; ctx.fill();
      ctx.restore();
    }
    if (spec.pattern === 'stripes') {
      ctx.save();
      organic(ctx, -0.02, by, 0.33, 0.20, 0.02, spec.seed || 1);
      ctx.clip();
      ctx.strokeStyle = U.rgba(spec.patternColor || '#000', 0.22);
      ctx.lineWidth = 0.05;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 0.11 - 0.05, by - 0.22); ctx.lineTo(i * 0.11 + 0.05, by + 0.22);
        ctx.stroke();
      }
      ctx.restore();
    }

    // near legs
    for (const lx of [-0.22, 0.14]) {
      const sw = Math.sin(walk + (lx > 0 ? 0 : 1.6) + 0.8) * 0.05;
      ell(ctx, lx + sw, -0.055, 0.07, 0.115);
      ctx.fillStyle = grad(ctx, spec, 'qleg' + lx, lx - 0.07, -0.17, lx + 0.07, 0.01, [
        [0, pa.mid], [1, pa.shade],
      ]);
      ctx.fill();
      stroke(ctx, pa.line, 0.03);
    }

    // head sits forward and slightly up
    ctx.save();
    ctx.translate(0.19, -0.14 - swing * 0.06);
    drawEars(ctx, spec, bob, Math.sin(walk * 2) * 0.5);
    drawHead(ctx, spec, bob, t, mood);
    if (spec.extras) spec.extras.forEach((e) => EXTRAS[e] && EXTRAS[e](ctx, spec, bob, t));
    ctx.restore();
  }

  // ---------------------------------------------------------------- main
  /**
   * @param ctx   2d context translated to the critter's ground point
   * @param spec  visual spec
   * @param o     {t, walk, moving, attack, scale, mood, alpha, flip}
   */
  Art.critter = function (ctx, spec, o) {
    o = o || {};
    const t = o.t || 0;
    const s = (o.scale || 1) * (spec.scale || 1);
    const walk = o.walk || 0;
    const moving = !!o.moving;
    const seed = spec.seed || 1;

    // Idle breathing keeps a stationary line-up from looking like a screenshot.
    const breathe = Math.sin(t * 1.9 + seed) * 0.012;
    const bob = moving ? Math.sin(walk * 2) * 0.026 : breathe;
    const swing = o.attack ? Math.sin(U.clamp01(o.attack) * Math.PI) : 0;

    ctx.save();
    ctx.scale(s, s);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.flip) ctx.scale(-1, 1);

    drawShadow(ctx, spec, 1 - Math.abs(bob) * 1.5);

    // lunge toward the target when attacking
    if (swing) ctx.translate(swing * 0.09, -swing * 0.05);
    if (spec.floats) ctx.translate(0, -0.13 + Math.sin(t * 2.6 + seed) * 0.035);

    if (spec.stance === 'quad') {
      drawQuad(ctx, spec, o, bob, walk, swing, t, o.mood);
    } else {
      drawTail(ctx, spec, t, seed);
      // back-worn gear sits behind the body silhouette
      if (spec.extras && spec.extras.indexOf('shell') >= 0) EXTRAS.shell(ctx, spec, bob, t);
      if (spec.extras && spec.extras.indexOf('spikes') >= 0) EXTRAS.spikes(ctx, spec, bob, t);
      drawLegs(ctx, spec, walk);
      drawArms(ctx, spec, bob, swing, -1);
      drawBody(ctx, spec, bob);
      drawEars(ctx, spec, bob, Math.sin(walk * 2 + 1) * 0.6);
      if (spec.extras && spec.extras.indexOf('mane') >= 0) EXTRAS.mane(ctx, spec, bob, t);
      drawHead(ctx, spec, bob, t, o.mood);
      if (spec.extras) {
        spec.extras.forEach((e) => {
          if (e === 'shell' || e === 'spikes' || e === 'mane') return;
          if (EXTRAS[e]) EXTRAS[e](ctx, spec, bob, t);
        });
      }
      drawArms(ctx, spec, bob, swing, 1);
    }

    if (spec.element && ELEMENT_FX[spec.element] && o.fx !== false) {
      ELEMENT_FX[spec.element](ctx, t, seed);
    }

    ctx.restore();
  };

  Art.EXTRAS = EXTRAS;
  Art.P = P;
  NS.Art = Art;
})(window.COC);

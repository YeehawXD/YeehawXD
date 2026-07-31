/* Fantasy Kritter — critterart.js
 * One hand-built drawing routine per critter.
 *
 * Nothing here is generated from a shared body template. The design bible's
 * silhouette rule (§2.2) requires that a critter be recognisable in pure black,
 * and that two critters with similar outlines be redesigned rather than
 * recoloured — which a template cannot deliver, because the template is the
 * silhouette. So each of these builds its own body plan from draw.js, and each
 * carries accessories that deliberately break its outline.
 *
 * Local space: feet at (0,0), crown near y = -1.
 * Every routine receives (ctx, self, t, st) where `self` is the critter object
 * used to cache gradients, and `st` carries animation state:
 *   { attack: 0..1, hurt: 0..1, walk, moving, ko }
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const D = NS.D;
  const W = D.W;
  const A = {};

  // ================================================================= RODDE
  /* Skovvogteren — mole crossed with a tree root. Stout and low, with drooping
   * leaf ears and a hollowed-nut backpack that breaks the back line. */
  A.rodde = function (ctx, self, t, st) {
    const moss = D.ramp('#6f9f52');
    const bark = D.ramp('#6b4a2e');
    const nut = D.ramp('#8a5c34');
    const breathe = Math.sin(t * 1.7) * 0.014;
    const lean = st.attack ? Math.sin(st.attack * Math.PI) * 0.10 : 0;

    D.contact(ctx, self, 0.46, 0.4);
    ctx.save();
    ctx.translate(lean * 0.4, 0);

    // --- nut backpack, behind the body so it reads as worn
    ctx.save();
    ctx.translate(-0.30, -0.46 + breathe);
    ctx.rotate(-0.22);
    D.blob(ctx, 0, 0, 0.20, 0.24, 0.04, 3);
    D.body(ctx, self, 'nut', [-0.2, -0.24, 0.2, 0.24], nut);
    ctx.save();
    D.blob(ctx, 0, 0, 0.20, 0.24, 0.04, 3); ctx.clip();
    ctx.strokeStyle = U.rgba(nut.core, 0.5);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-0.22, i * 0.09); ctx.quadraticCurveTo(0, i * 0.09 + 0.03, 0.22, i * 0.09);
      D.stroke(ctx, U.rgba(nut.core, 0.45), W.hair * 1.6);
    }
    ctx.restore();
    // strap crossing the shoulder
    ctx.restore();

    // --- stout legs, barely visible under the body
    [-0.17, 0.17].forEach(function (lx, i) {
      const sw = st.moving ? Math.sin(st.walk + i * Math.PI) * 0.035 : 0;
      D.ell(ctx, lx + sw, -0.055, 0.105, 0.07);
      D.body(ctx, self, 'leg' + i, [lx - 0.1, -0.13, lx + 0.1, 0.01], bark, W.form);
    });

    // --- barrel body in woven bark armour
    const bodyPath = function () { D.blob(ctx, 0, -0.40 + breathe, 0.36, 0.30, 0.035, 1); };
    bodyPath();
    D.body(ctx, self, 'body', [-0.36, -0.72, 0.36, -0.10], bark);
    D.MAT.bark(ctx, self, bodyPath, bark, 5);
    // woven plates: horizontal weave over vertical grain
    ctx.save();
    bodyPath(); ctx.clip();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-0.4, -0.40 + i * 0.115 + breathe);
      ctx.quadraticCurveTo(0, -0.35 + i * 0.115 + breathe, 0.4, -0.42 + i * 0.115 + breathe);
      D.stroke(ctx, U.rgba(bark.core, 0.55), W.detail * 1.5);
      D.stroke(ctx, U.rgba(bark.hi, 0.30), W.hair);
    }
    ctx.restore();
    // moss patches clinging to the armour
    ctx.save();
    bodyPath(); ctx.clip();
    [[-0.19, -0.55, 0.10], [0.16, -0.34, 0.075], [0.02, -0.63, 0.06]].forEach(function (m, i) {
      D.blob(ctx, m[0], m[1] + breathe, m[2], m[2] * 0.72, 0.16, 7 + i);
      D.flat(ctx, U.rgba(moss.mid, 0.9), W.hair, U.rgba(moss.core, 0.6));
    });
    ctx.restore();

    // --- glowing shoulder mushroom
    const glowP = 0.6 + Math.sin(t * 2.2) * 0.4;
    ctx.save();
    ctx.translate(0.26, -0.62 + breathe);
    ctx.fillStyle = D.glow(ctx, self, 'shroom', 0, 0, 0, 0.22,
      U.rgba('#ffe08a', 0.55 * glowP), 'rgba(255,224,138,0)');
    ctx.beginPath(); ctx.arc(0, 0, 0.22, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#f2e6c8';
    ctx.fillRect(-0.018, -0.02, 0.036, 0.075);
    D.ell(ctx, 0, -0.03, 0.075, 0.05);
    D.flat(ctx, '#ffd977', W.hair * 1.6, '#a87a20');
    ctx.restore();

    // --- head, wide and low with a blunt snout
    const headPath = function () { D.blob(ctx, 0, -0.80 + breathe, 0.30, 0.26, 0.03, 9); };
    headPath();
    D.body(ctx, self, 'head', [-0.3, -1.06, 0.3, -0.54], moss);
    D.MAT.fur(ctx, self, headPath, moss, 4);

    // drooping leaf ears — the defining silhouette break
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(s * 0.27, -0.86 + breathe);
      ctx.rotate(s * (0.55 + Math.sin(t * 1.5 + s) * 0.05));
      const leafP = D.ramp('#5d9440');
      const leafPath = function () {
        ctx.beginPath();
        ctx.moveTo(0, -0.05);
        ctx.quadraticCurveTo(s * 0.20, 0.10, s * 0.06, 0.42);
        ctx.quadraticCurveTo(s * -0.10, 0.14, 0, -0.05);
        ctx.closePath();
      };
      leafPath();
      D.body(ctx, self, 'ear' + s, [0, -0.05, s * 0.2, 0.42], leafP, W.form);
      ctx.save();
      leafPath(); ctx.clip();
      ctx.beginPath();
      ctx.moveTo(0, -0.02); ctx.quadraticCurveTo(s * 0.05, 0.18, s * 0.05, 0.38);
      D.stroke(ctx, U.rgba(leafP.core, 0.5), W.hair * 1.4);
      ctx.restore();
      ctx.restore();
    });

    // blunt mole snout
    D.ell(ctx, 0, -0.71 + breathe, 0.135, 0.095);
    D.body(ctx, self, 'snout', [-0.13, -0.8, 0.13, -0.62], D.ramp('#c8a882'), W.form);
    D.ell(ctx, 0, -0.735 + breathe, 0.042, 0.031);
    D.flat(ctx, '#4a3040', 0);

    // gentle, slightly shy eyes — round, low-lidded, wide apart
    const bl = D.blink(t, 3);
    [-1, 1].forEach(function (s) {
      D.eye(ctx, self, {
        x: s * 0.13, y: -0.84 + breathe, rx: 0.072, ry: 0.078,
        blink: bl, iris: '#4a3524',
      });
    });
    // the leaf-tear scar over the left eye — a story, not a threat
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-0.20, -0.95 + breathe);
    ctx.lineTo(-0.09, -0.76 + breathe);
    D.stroke(ctx, U.rgba('#3f5a2c', 0.85), W.detail * 1.4);
    ctx.restore();
    D.mouth(ctx, { x: 0, y: -0.665 + breathe, w: 0.075, shape: 'curve', color: '#4a3040', weight: W.detail });

    ctx.restore();
  };

  // ================================================================= GLIMT
  /* Krystalspejderen — lean ice fox on four legs. Prism ears, frozen feather
   * cape, tail ending in a chiming crystal cluster. */
  A.glimt = function (ctx, self, t, st) {
    const ice = D.ramp('#8fd4f0');
    const deep = D.ramp('#4a92c8');
    const pulse = 0.55 + Math.sin(t * 2.4) * 0.45;
    const bob = Math.sin(t * 1.9) * 0.012;
    const lean = st.attack ? Math.sin(st.attack * Math.PI) * 0.12 : 0;

    D.contact(ctx, self, 0.44, 0.3);
    ctx.save();
    ctx.translate(lean * 0.5, 0);

    // --- crystal tail cluster, drawn behind
    ctx.save();
    ctx.translate(-0.36, -0.42 + bob);
    ctx.rotate(-0.35 + Math.sin(t * 1.6) * 0.09);
    D.taper(ctx, 0, 0, -0.20, -0.16, 0.055, 0.03);
    D.body(ctx, self, 'tail', [-0.2, -0.2, 0, 0.05], deep, W.form);
    [[-0.24, -0.20, 0.075], [-0.30, -0.10, 0.055], [-0.19, -0.28, 0.05]].forEach(function (c, i) {
      ctx.save();
      ctx.translate(c[0], c[1]);
      ctx.rotate(0.4 * i + Math.sin(t * 2 + i) * 0.1);
      D.poly(ctx, [[0, -c[2]], [c[2] * 0.6, 0], [0, c[2]], [-c[2] * 0.6, 0]]);
      ctx.fillStyle = U.rgba('#dff6ff', 0.85);
      ctx.fill();
      D.stroke(ctx, U.rgba('#3f7fae', 0.8), W.hair * 1.5);
      ctx.restore();
    });
    ctx.restore();

    // --- far legs
    [[-0.20, 1], [0.18, 0]].forEach(function (l, i) {
      const sw = st.moving ? Math.sin(st.walk + l[1] * 2.2) * 0.05 : 0;
      D.taper(ctx, l[0], -0.34, l[0] + sw, -0.02, 0.05, 0.032);
      D.body(ctx, self, 'flegd' + i, [l[0] - 0.06, -0.36, l[0] + 0.06, 0], deep, W.form);
    });

    // --- slender body of half-transparent ice
    const bodyPath = function () { D.blob(ctx, -0.02, -0.44 + bob, 0.32, 0.19, 0.03, 2); };
    bodyPath();
    D.body(ctx, self, 'body', [-0.34, -0.63, 0.30, -0.25], ice);
    D.MAT.ice(ctx, self, bodyPath, ice, 3);
    // inner light pulsing along the spine
    ctx.save();
    bodyPath(); ctx.clip();
    ctx.fillStyle = D.glow(ctx, self, 'core', -0.02, -0.44, 0, 0.28,
      U.rgba('#ffffff', 0.55), 'rgba(255,255,255,0)');
    ctx.globalAlpha = pulse;
    ctx.fillRect(-0.4, -0.7, 0.8, 0.5);
    ctx.restore();

    // --- frozen feather cape over the shoulders
    ctx.save();
    ctx.translate(0.02, -0.60 + bob);
    // Layered back-to-front so the cape lies along the spine rather than
    // fanning out from a point.
    for (let i = 0; i < 6; i++) {
      const k = i / 5;
      ctx.save();
      ctx.translate(-k * 0.30, k * 0.05);
      ctx.rotate(-0.35 - k * 0.55 + Math.sin(t * 1.4 + i) * 0.04);
      ctx.beginPath();
      ctx.moveTo(0, -0.04);
      ctx.quadraticCurveTo(0.10, 0.10, 0.03, 0.26);
      ctx.quadraticCurveTo(-0.07, 0.10, -0.04, -0.03);
      ctx.closePath();
      ctx.fillStyle = U.rgba(i % 2 ? '#eaf8ff' : '#bfe4f8', 0.92);
      ctx.fill();
      D.stroke(ctx, U.rgba('#4a92c8', 0.75), W.hair * 1.7);
      ctx.restore();
    }
    ctx.restore();

    // --- near legs
    [[-0.24, 0], [0.14, 1]].forEach(function (l, i) {
      const sw = st.moving ? Math.sin(st.walk + l[1] * 2.2 + 1.1) * 0.055 : 0;
      D.taper(ctx, l[0], -0.34, l[0] + sw, -0.015, 0.058, 0.036);
      D.body(ctx, self, 'nleg' + i, [l[0] - 0.06, -0.36, l[0] + 0.06, 0], ice, W.form);
    });

    // --- head carried forward and low, fox-like
    ctx.save();
    ctx.translate(0.20, -0.62 + bob);

    // prism ears, tall and sharp — the silhouette signature
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(s * 0.10 - 0.03, -0.16);
      ctx.rotate(s * 0.28 - 0.06);
      D.poly(ctx, [[-0.06, 0.06], [0.01, -0.34], [0.07, 0.05]]);
      ctx.fillStyle = U.rgba('#dff4ff', 0.92);
      ctx.fill();
      D.stroke(ctx, U.rgba('#3f7fae', 0.85), W.form);
      // rainbow scatter through the prism
      ctx.save();
      D.poly(ctx, [[-0.06, 0.06], [0.01, -0.34], [0.07, 0.05]]); ctx.clip();
      ['#ff9ec4', '#ffe08a', '#8fffc4'].forEach(function (c, i) {
        ctx.beginPath();
        ctx.moveTo(-0.08, -0.24 + i * 0.07);
        ctx.lineTo(0.08, -0.20 + i * 0.07);
        D.stroke(ctx, U.rgba(c, 0.55 * pulse), W.hair * 1.4);
      });
      ctx.restore();
      ctx.restore();
    });

    const headPath = function () { D.blob(ctx, 0, 0, 0.20, 0.17, 0.03, 6); };
    headPath();
    D.body(ctx, self, 'head', [-0.2, -0.17, 0.2, 0.17], ice, W.form);
    D.MAT.ice(ctx, self, headPath, ice, 8);
    // tapered fox muzzle
    D.poly(ctx, [[0.10, -0.05], [0.30, 0.035], [0.10, 0.10]]);
    D.body(ctx, self, 'muzzle', [0.1, -0.05, 0.3, 0.1], ice, W.form);
    D.circle(ctx, 0.29, 0.035, 0.026);
    D.flat(ctx, '#3f6f96', 0);

    // narrow crooked eyes, always about to laugh
    const bl = D.blink(t, 5);
    [-1, 1].forEach(function (s) {
      D.eye(ctx, self, {
        x: 0.02 + s * 0.07, y: -0.02, rx: 0.062, ry: 0.042 * bl,
        shape: 'slit', look: 0.5, rot: s * 0.30 - 0.1,
        iris: '#1f4f70', white: '#f2fbff', line: '#2a5f82',
      });
    });
    ctx.restore();
    ctx.restore();
  };

  // ================================================================= GRUMLE
  /* Klippeknuseren — a granite bear. Massive and wide, cracks leaking gold, a
   * meteor-stone hammer across the back and a beard of stalactites. */
  A.grumle = function (ctx, self, t, st) {
    const rock = D.ramp('#6e6a68');
    const rust = D.ramp('#8a5236');
    const breathe = Math.sin(t * 1.3) * 0.011;
    const swing = st.attack ? Math.sin(st.attack * Math.PI) : 0;

    D.contact(ctx, self, 0.6, 0.45);
    ctx.save();

    // --- meteor hammer strapped across the back
    ctx.save();
    ctx.translate(-0.30, -0.62 + breathe);
    ctx.rotate(-0.72 + swing * 0.5);
    D.taper(ctx, 0, 0.30, 0, -0.34, 0.035, 0.03);
    D.body(ctx, self, 'haft', [-0.04, -0.34, 0.04, 0.3], D.ramp('#5a4028'), W.form);
    const hammerHead = function () {
      D.poly(ctx, [[-0.22, -0.36], [0.22, -0.44], [0.26, -0.16], [-0.18, -0.09]]);
    };
    hammerHead();
    D.body(ctx, self, 'hhead', [-0.22, -0.44, 0.26, -0.09], D.ramp('#4a4a52'));
    D.MAT.metal(ctx, self, hammerHead, D.ramp('#4a4a52'), 2);
    ctx.restore();

    // --- squat legs
    [-0.26, 0.26].forEach(function (lx, i) {
      D.poly(ctx, [[lx - 0.13, -0.30], [lx + 0.13, -0.30], [lx + 0.16, -0.01], [lx - 0.16, -0.01]]);
      D.body(ctx, self, 'leg' + i, [lx - 0.16, -0.30, lx + 0.16, 0], rock, W.form);
    });

    // --- massive squared-off torso
    const bodyPath = function () {
      D.poly(ctx, [
        [-0.42, -0.28], [-0.46, -0.72], [-0.30, -0.92],
        [0.30, -0.92], [0.46, -0.72], [0.42, -0.28],
      ]);
    };
    bodyPath();
    D.body(ctx, self, 'body', [-0.46, -0.92, 0.46, -0.28], rock);
    D.MAT.stone(ctx, self, bodyPath, rock, 3, '#ffb43c');
    // rust-red ore veins
    ctx.save();
    bodyPath(); ctx.clip();
    [[-0.3, -0.8], [0.15, -0.55]].forEach(function (v, i) {
      ctx.beginPath();
      ctx.moveTo(v[0], v[1]);
      ctx.quadraticCurveTo(v[0] + 0.2, v[1] + 0.15, v[0] + 0.1, v[1] + 0.35);
      D.stroke(ctx, U.rgba(rust.mid, 0.55), W.detail * 2);
    });
    ctx.restore();

    // --- gnarled stone fists
    [[-0.52, 1], [0.52, -1]].forEach(function (a, i) {
      const lift = i === 1 ? -swing * 0.16 : 0;
      D.blob(ctx, a[0], -0.42 + lift, 0.14, 0.16, 0.13, 11 + i);
      D.body(ctx, self, 'fist' + i, [a[0] - 0.14, -0.6, a[0] + 0.14, -0.26], rock, W.form);
    });

    // --- blocky head sunk into the shoulders
    const headPath = function () {
      D.poly(ctx, [
        [-0.28, -0.92], [-0.30, -1.16], [-0.16, -1.30],
        [0.16, -1.30], [0.30, -1.16], [0.28, -0.92],
      ]);
    };
    headPath();
    D.body(ctx, self, 'headb', [-0.3, -1.3, 0.3, -0.92], rock);
    D.MAT.stone(ctx, self, headPath, rock, 6, '#ffb43c');

    // heavy stone brow shelf
    D.poly(ctx, [[-0.31, -1.16], [0.31, -1.16], [0.27, -1.06], [-0.27, -1.06]]);
    D.body(ctx, self, 'brow', [-0.31, -1.18, 0.31, -1.04], D.ramp('#5c5856'), W.form);

    // small narrowed eyes deep under the shelf
    const bl = D.blink(t, 2);
    [-1, 1].forEach(function (s) {
      D.eye(ctx, self, {
        x: s * 0.12, y: -1.015, rx: 0.045, ry: 0.030 * bl,
        shape: 'slit', iris: '#ffce6a', white: '#3a3634', line: '#241f1c', look: 0,
      });
    });

    // Stalactite beard. It hangs from the jaw line, well below the eyes —
    // any higher and the spikes read as a mouthful of teeth.
    const jaw = -0.90;
    D.poly(ctx, [[-0.26, jaw - 0.03], [0.26, jaw - 0.03], [0.22, jaw + 0.07], [-0.22, jaw + 0.07]]);
    D.body(ctx, self, 'jaw', [-0.26, jaw - 0.03, 0.26, jaw + 0.07], D.ramp('#7d7a76'), W.form);
    for (let i = -2; i <= 2; i++) {
      const len = 0.13 + (2 - Math.abs(i)) * 0.07;
      const sway = Math.sin(t * 2.2 + i) * 0.014;
      const bx = i * 0.095;
      D.poly(ctx, [[bx - 0.034, jaw + 0.05], [bx + 0.034, jaw + 0.05], [bx + sway, jaw + 0.05 + len]]);
      D.body(ctx, self, 'beard' + i, [bx - 0.034, jaw, bx + 0.034, jaw + 0.05 + len], D.ramp('#95928d'), W.detail);
    }

    ctx.restore();
  };

  // ================================================================= SJATTE
  /* Sumpsangeren — a gelatinous frog-meets-waterskin. Round and translucent
   * with bubbles rising inside, under a reed hat several sizes too big. */
  A.sjatte = function (ctx, self, t, st) {
    const gel = D.ramp('#7fc46a');
    const hat = D.ramp('#4a6b30');
    const squash = 1 + Math.sin(t * 2.1) * 0.035;
    const sing = st.attack ? Math.sin(st.attack * Math.PI) : 0;

    D.contact(ctx, self, 0.42, 0.32);
    ctx.save();

    // --- webbed feet splayed either side
    [-1, 1].forEach(function (s) {
      D.ell(ctx, s * 0.26, -0.035, 0.13, 0.055, s * 0.15);
      D.body(ctx, self, 'foot' + s, [s * 0.26 - 0.13, -0.09, s * 0.26 + 0.13, 0.02], D.ramp('#6aa858'), W.form);
    });

    // --- translucent body: a sack of water
    ctx.save();
    ctx.scale(1 / squash, squash);
    const bodyPath = function () { D.blob(ctx, 0, -0.34, 0.38, 0.34, 0.045, 1); };
    bodyPath();
    ctx.fillStyle = D.lit(ctx, self, 'gelbody', [-0.38, -0.68, 0.38, 0], gel);
    ctx.globalAlpha = 0.88;
    ctx.fill();
    ctx.globalAlpha = 1;
    D.stroke(ctx, gel.line, W.silhouette);
    D.MAT.gel(ctx, self, bodyPath, gel, 4, t);
    // a bright meniscus where the surface curves away
    ctx.save();
    bodyPath(); ctx.clip();
    ctx.beginPath();
    ctx.ellipse(0, -0.34, 0.33, 0.29, 0, 0.5, 2.2);
    D.stroke(ctx, 'rgba(255,255,255,0.5)', W.form * 1.6);
    ctx.restore();
    ctx.restore();

    // --- thin leaf fins acting as ears, flicking while singing
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(s * 0.36, -0.52);
      ctx.rotate(s * (0.5 + sing * 0.5 + Math.sin(t * 3.1 + s) * 0.09));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.20, -0.10, s * 0.30, 0.06);
      ctx.quadraticCurveTo(s * 0.16, 0.06, 0, 0.05);
      ctx.closePath();
      D.body(ctx, self, 'fin' + s, [0, -0.1, s * 0.3, 0.06], D.ramp('#9ad86a'), W.form);
      ctx.restore();
    });

    // --- big wet eyes with long lashes, set high on the blob
    const bl = D.blink(t, 6);
    [-1, 1].forEach(function (s) {
      D.eye(ctx, self, {
        x: s * 0.15, y: -0.53, rx: 0.105, ry: 0.115 * bl, iris: '#2f4a2a',
      });
      // lashes
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        const a = -0.6 + i * 0.35;
        const ex = s * 0.15 + Math.cos(a) * 0.105 * s;
        const ey = -0.53 + Math.sin(a) * 0.115;
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + Math.cos(a) * 0.05 * s, ey + Math.sin(a) * 0.05);
        D.stroke(ctx, '#2f4a2a', W.hair * 1.6);
      }
    });
    D.mouth(ctx, {
      x: 0, y: -0.36, w: 0.16,
      shape: sing > 0.3 ? 'open' : 'grin', color: '#2f4a2a', weight: W.detail, inner: '#4a7a3c',
    });

    // --- oversized reed hat, permanently sliding over one eye
    ctx.save();
    ctx.translate(-0.06, -0.70);
    ctx.rotate(-0.20 + Math.sin(t * 1.2) * 0.02);
    const brim = function () { D.ell(ctx, 0, 0.05, 0.44, 0.13); };
    brim();
    D.body(ctx, self, 'brim', [-0.44, -0.08, 0.44, 0.18], hat);
    ctx.beginPath();
    ctx.moveTo(-0.22, 0.04);
    ctx.quadraticCurveTo(-0.10, -0.30, 0.02, -0.31);
    ctx.quadraticCurveTo(0.16, -0.28, 0.22, 0.04);
    ctx.closePath();
    D.body(ctx, self, 'crown', [-0.22, -0.31, 0.22, 0.04], hat, W.form);
    // woven reed texture
    ctx.save();
    brim(); ctx.clip();
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 0.12, -0.1); ctx.lineTo(i * 0.12 + 0.04, 0.2);
      D.stroke(ctx, U.rgba(hat.core, 0.45), W.hair * 1.4);
    }
    ctx.restore();
    ctx.restore();

    ctx.restore();
  };

  // ================================================================= ASKEØJE
  /* Emberulven — lean, low, predatory. Ash-crust fur with cracks pulsing like
   * embers, one blind eye, obsidian claws, a tail trailing sparks. */
  A.askeoje = function (ctx, self, t, st) {
    const ash = D.ramp('#4a4548');
    const dark = D.ramp('#332f33');
    const lunge = st.attack ? Math.sin(st.attack * Math.PI) : 0;
    const bob = Math.sin(t * 1.8) * 0.01;

    D.contact(ctx, self, 0.5, 0.34);
    ctx.save();
    ctx.translate(lunge * 0.14, 0);

    // --- tail streaming sparks
    ctx.save();
    ctx.translate(-0.38, -0.40 + bob);
    const wag = Math.sin(t * 2.3) * 0.16;
    ctx.rotate(-0.5 + wag);
    ctx.beginPath();
    ctx.moveTo(0, 0.06);
    ctx.quadraticCurveTo(-0.24, -0.02, -0.34, -0.24);
    ctx.quadraticCurveTo(-0.20, -0.12, -0.02, -0.06);
    ctx.closePath();
    D.body(ctx, self, 'tail', [-0.34, -0.24, 0, 0.06], dark, W.form);
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.8 + i / 4) % 1);
      ctx.globalAlpha = (1 - k) * 0.9;
      D.circle(ctx, -0.34 - k * 0.2, -0.24 - k * 0.22, 0.022 * (1 - k * 0.5));
      D.flat(ctx, i % 2 ? '#ffcf6a' : '#ff7a2a', 0);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // --- far legs
    [[-0.22, 0], [0.20, 1]].forEach(function (l, i) {
      const sw = st.moving ? Math.sin(st.walk + l[1] * 2.4) * 0.05 : 0;
      D.taper(ctx, l[0], -0.36, l[0] + sw, -0.02, 0.048, 0.030);
      D.body(ctx, self, 'fl' + i, [l[0] - 0.06, -0.38, l[0] + 0.06, 0], dark, W.form);
    });

    // --- long low body
    const bodyPath = function () { D.blob(ctx, -0.02, -0.48 + bob, 0.35, 0.19, 0.035, 2); };
    bodyPath();
    D.body(ctx, self, 'body', [-0.37, -0.67, 0.33, -0.29], ash);
    D.MAT.fur(ctx, self, bodyPath, ash, 9);
    D.MAT.ember(ctx, self, bodyPath, ash, 3, t);

    // raised hackles along the spine break the top line
    for (let i = -2; i <= 2; i++) {
      const h = 0.10 + (2 - Math.abs(i)) * 0.035 + lunge * 0.05;
      D.poly(ctx, [[i * 0.10 - 0.045, -0.64 + bob], [i * 0.10, -0.64 - h + bob], [i * 0.10 + 0.045, -0.64 + bob]]);
      D.body(ctx, self, 'hack' + i, [i * 0.1 - 0.05, -0.78, i * 0.1 + 0.05, -0.6], dark, W.detail);
    }

    // --- near legs, with obsidian claws
    [[-0.26, 1], [0.14, 0]].forEach(function (l, i) {
      const sw = st.moving ? Math.sin(st.walk + l[1] * 2.4 + 1.2) * 0.055 : 0;
      D.taper(ctx, l[0], -0.36, l[0] + sw, -0.015, 0.055, 0.034);
      D.body(ctx, self, 'nl' + i, [l[0] - 0.06, -0.38, l[0] + 0.06, 0], ash, W.form);
      for (let c = -1; c <= 1; c++) {
        D.poly(ctx, [
          [l[0] + sw + c * 0.028 - 0.012, -0.02],
          [l[0] + sw + c * 0.028 + 0.012, -0.02],
          [l[0] + sw + c * 0.030, 0.045],
        ]);
        D.flat(ctx, '#1a1620', W.hair, '#000');
      }
    });

    // --- narrow head thrust forward
    ctx.save();
    ctx.translate(0.24, -0.66 + bob - lunge * 0.03);

    // sharp swept-back ears
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(s * 0.09 - 0.05, -0.13);
      ctx.rotate(s * 0.35 - 0.35);
      D.poly(ctx, [[-0.05, 0.05], [-0.01, -0.26], [0.06, 0.04]]);
      D.body(ctx, self, 'ear' + s, [-0.05, -0.26, 0.06, 0.05], dark, W.form);
      ctx.restore();
    });

    const headPath = function () { D.blob(ctx, 0, 0, 0.19, 0.155, 0.03, 7); };
    headPath();
    D.body(ctx, self, 'head', [-0.19, -0.16, 0.19, 0.16], ash, W.form);
    D.MAT.ember(ctx, self, headPath, ash, 8, t);
    // long wolf muzzle
    D.poly(ctx, [[0.09, -0.06], [0.32, 0.03], [0.09, 0.11]]);
    D.body(ctx, self, 'muzzle', [0.09, -0.06, 0.32, 0.11], dark, W.form);
    D.circle(ctx, 0.31, 0.03, 0.026);
    D.flat(ctx, '#15121a', 0);

    // one burning eye; the other sealed under hardened ash
    D.eye(ctx, self, {
      x: 0.09, y: -0.03, rx: 0.055, ry: 0.038,
      shape: 'glow', glowColor: '#ff9a2a',
    });
    ctx.save();
    D.poly(ctx, [[-0.16, -0.10], [-0.01, -0.06], [-0.02, 0.05], [-0.17, 0.02]]);
    D.flat(ctx, '#2b262c', W.detail, '#191519');
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-0.16, -0.05 + i * 0.045);
      ctx.lineTo(-0.02, -0.02 + i * 0.045);
      D.stroke(ctx, U.rgba('#6a5a52', 0.7), W.hair);
    }
    ctx.restore();
    ctx.restore();
    ctx.restore();
  };

  // ================================================================= PUDDEL
  /* Den Genstridige Sky — an amorphous cloud with no fixed outline. Two stubby
   * arms and a wide grin are the only stable features; lightning inside. */
  A.puddel = function (ctx, self, t, st) {
    const cloud = D.ramp('#a094c0');
    const drift = Math.sin(t * 1.1) * 0.03;
    const zap = st.attack ? Math.sin(st.attack * Math.PI) : 0;
    const angry = zap > 0.2;

    ctx.save();
    ctx.translate(0, -0.34 + drift);
    D.contact(ctx, self, 0.34, 0.18);

    // --- soft shifting body, drawn as overlapping puffs so the edge never settles
    const bodyPath = function () { D.puff(ctx, 0, -0.30, 0.40, 0.31, 5, t, 1); };
    ctx.save();
    ctx.filter = 'blur(1.2px)';
    bodyPath();
    ctx.fillStyle = D.lit(ctx, self, 'cloud', [-0.4, -0.62, 0.4, 0.02], cloud);
    ctx.fill();
    ctx.restore();
    bodyPath();
    ctx.fillStyle = D.lit(ctx, self, 'cloud2', [-0.4, -0.62, 0.4, 0.02], cloud);
    ctx.fill();
    D.stroke(ctx, U.rgba(cloud.line, 0.55), W.form);
    // golden evening light along the top-left edge
    ctx.save();
    bodyPath(); ctx.clip();
    ctx.beginPath();
    ctx.ellipse(0, -0.30, 0.38, 0.29, 0, Math.PI * 0.9, Math.PI * 1.85);
    D.stroke(ctx, U.rgba('#ffd58a', 0.75), W.form * 2);
    ctx.restore();

    // --- lightning crackling inside when irritated
    if (angry || Math.sin(t * 3.7) > 0.8) {
      ctx.save();
      bodyPath(); ctx.clip();
      const rng = U.rng(Math.floor(t * 12));
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        let x = rng.range(-0.25, 0.25), y = -0.55;
        ctx.moveTo(x, y);
        for (let j = 0; j < 3; j++) {
          x += rng.range(-0.14, 0.14); y += 0.11;
          ctx.lineTo(x, y);
        }
        D.stroke(ctx, U.rgba('#8fd0ff', 0.9), W.detail * 2);
        D.stroke(ctx, '#ffffff', W.hair);
      }
      ctx.restore();
    }

    // --- two short stubby arms
    [-1, 1].forEach(function (s) {
      const lift = s > 0 ? -zap * 0.14 : 0;
      D.ell(ctx, s * 0.40, -0.24 + lift, 0.10, 0.075, s * 0.3);
      D.body(ctx, self, 'arm' + s, [s * 0.4 - 0.1, -0.34, s * 0.4 + 0.1, -0.14], cloud, W.form);
    });

    // --- the face: only the grin and eyes are ever solid
    const bl = D.blink(t, 4);
    [-1, 1].forEach(function (s) {
      D.eye(ctx, self, {
        x: s * 0.13, y: -0.36, rx: 0.058, ry: 0.048 * bl,
        shape: 'slit', iris: '#2b2340', white: '#efe8ff', line: '#3a3050',
        rot: -s * 0.22,
      });
      D.brow(ctx, s * 0.13, -0.45, 0.11, -s * 0.42, '#3a3050', W.detail);
    });
    D.mouth(ctx, { x: 0.01, y: -0.24, w: 0.24, shape: 'grin', color: '#3a3050', weight: W.form });
    // a single visible tooth sells the mischief
    D.poly(ctx, [[0.05, -0.19], [0.09, -0.19], [0.07, -0.13]]);
    D.flat(ctx, '#ffffff', 0);

    ctx.restore();
  };

  // ================================================================= KNOG
  /* Den Lille Spøgelsesridder — a house-cat-sized ghost inside armour built for
   * something much larger. Floats; the body fades to mist instead of feet. */
  A.knog = function (ctx, self, t, st) {
    const copper = D.ramp('#5f8f82');
    const ghost = D.ramp('#9fc4e8');
    const hover = Math.sin(t * 1.5) * 0.035;
    const clatter = Math.sin(t * 9) * 0.008;
    const charge = st.attack ? Math.sin(st.attack * Math.PI) : 0;

    ctx.save();
    ctx.translate(0, -0.16 + hover);
    D.contact(ctx, self, 0.3, 0.16);

    // --- tattered cape drifting as if underwater
    ctx.save();
    ctx.translate(-0.10, -0.60);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const s1 = Math.sin(t * 1.3) * 0.06;
    const s2 = Math.sin(t * 1.7 + 1) * 0.07;
    ctx.bezierCurveTo(-0.34 + s1, 0.12, -0.42 + s2, 0.42, -0.26 + s1, 0.60);
    ctx.lineTo(-0.16, 0.44);
    ctx.lineTo(-0.20, 0.58);
    ctx.lineTo(-0.08, 0.40);
    ctx.lineTo(-0.03, 0.52);
    ctx.lineTo(0.02, 0.30);
    ctx.closePath();
    ctx.globalAlpha = 0.72;
    D.body(ctx, self, 'cape', [-0.42, 0, 0.02, 0.6], D.ramp('#7fa8cf'), W.form);
    ctx.globalAlpha = 1;
    ctx.restore();

    // --- ghost body, fading to mist at the bottom
    const ghostPath = function () { D.blob(ctx, 0, -0.44, 0.22, 0.28, 0.05, 2); };
    ctx.save();
    ctx.globalAlpha = 0.85;
    ghostPath();
    ctx.fillStyle = D.lit(ctx, self, 'ghost', [-0.22, -0.72, 0.22, -0.16], ghost);
    ctx.fill();
    D.MAT.ghost(ctx, self, ghostPath, ghost);
    ctx.restore();
    // wisps of mist trailing below
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.5 + i / 3) % 1);
      ctx.globalAlpha = (1 - k) * 0.35;
      D.ell(ctx, Math.sin(t + i * 2) * 0.06, -0.14 + k * 0.14, 0.11 * (1 - k * 0.4), 0.045);
      D.flat(ctx, '#cfe4f8', 0);
    }
    ctx.globalAlpha = 1;

    // --- oversized breastplate hanging loose off the small body
    ctx.save();
    ctx.translate(clatter, 0);
    D.poly(ctx, [[-0.26, -0.56], [0.26, -0.56], [0.22, -0.20], [-0.22, -0.20]]);
    D.body(ctx, self, 'plate', [-0.26, -0.56, 0.26, -0.2], copper);
    D.MAT.metal(ctx, self, function () {
      D.poly(ctx, [[-0.26, -0.56], [0.26, -0.56], [0.22, -0.20], [-0.22, -0.20]]);
    }, copper, 3);
    // frost creeping over the oxidised copper
    ctx.save();
    D.poly(ctx, [[-0.26, -0.56], [0.26, -0.56], [0.22, -0.20], [-0.22, -0.20]]); ctx.clip();
    ctx.fillStyle = 'rgba(226,244,255,0.42)';
    [[-0.18, -0.26, 0.08], [0.12, -0.24, 0.06], [-0.02, -0.22, 0.05]].forEach(function (f) {
      D.blob(ctx, f[0], f[1], f[2], f[2] * 0.6, 0.3, 5); ctx.fill();
    });
    ctx.restore();
    // pauldrons far too wide for him
    [-1, 1].forEach(function (s) {
      D.ell(ctx, s * 0.30, -0.53, 0.14, 0.10, s * 0.2);
      D.body(ctx, self, 'pauld' + s, [s * 0.3 - 0.14, -0.63, s * 0.3 + 0.14, -0.43], copper, W.form);
    });
    ctx.restore();

    // --- helmet with a single wide visor
    ctx.save();
    ctx.translate(clatter * 1.6, -0.02);
    const helmPath = function () {
      ctx.beginPath();
      ctx.moveTo(-0.24, -0.72);
      ctx.quadraticCurveTo(-0.26, -1.02, 0, -1.06);
      ctx.quadraticCurveTo(0.26, -1.02, 0.24, -0.72);
      ctx.quadraticCurveTo(0, -0.64, -0.24, -0.72);
      ctx.closePath();
    };
    helmPath();
    D.body(ctx, self, 'helm', [-0.26, -1.06, 0.26, -0.64], copper);
    D.MAT.metal(ctx, self, helmPath, copper, 4);

    // visor slit with two soft blue lights burning behind it
    D.poly(ctx, [[-0.19, -0.88], [0.19, -0.88], [0.17, -0.79], [-0.17, -0.79]]);
    D.flat(ctx, '#16232e', W.form, '#0d161d');
    [-1, 1].forEach(function (s) {
      D.eye(ctx, self, {
        x: s * 0.085, y: -0.835, rx: 0.036, ry: 0.026,
        shape: 'glow', glowColor: charge > 0.2 ? '#dff0ff' : '#7fd0ff',
      });
    });
    // crest ridge along the top of the helm
    D.poly(ctx, [[-0.02, -1.06], [0.02, -1.06], [0.06, -1.22], [-0.06, -1.22]]);
    D.body(ctx, self, 'crest', [-0.06, -1.22, 0.06, -1.06], D.ramp('#7fb0a2'), W.detail);
    ctx.restore();

    ctx.restore();
  };

  NS.CritterArt = A;
})(window.COC);

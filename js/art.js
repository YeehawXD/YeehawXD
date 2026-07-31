/* Clash of Critters — art.js
 * Every critter in the game is drawn procedurally from a small spec object.
 * That keeps the whole game asset-free (loads instantly, works offline) while
 * still giving each card a distinct silhouette.
 *
 * Local drawing space for a critter:
 *   origin (0,0) = the point where its feet touch the ground
 *   y is negative going up, the body occupies roughly y in [-1, 0]
 *   x in [-0.55, 0.55]
 * Callers scale that space to the size they want.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const Art = {};

  // ------------------------------------------------------------------ shapes
  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, U.TAU);
  }
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.abs(r), 0, U.TAU);
  }
  function blob(ctx, x, y, rx, ry, wobble, seed) {
    // Slightly irregular ellipse — reads as hand-drawn rather than geometric.
    const steps = 14;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * U.TAU;
      const w = 1 + Math.sin(a * 3 + seed) * wobble + Math.cos(a * 5 - seed) * wobble * 0.5;
      const px = x + Math.cos(a) * rx * w;
      const py = y + Math.sin(a) * ry * w;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function limb(ctx, x1, y1, x2, y2, w) {
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineWidth = w;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function tri(ctx, ax, ay, bx, by, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath();
  }

  // outline helper: fill + dark stroke, the cartoon look
  function ink(ctx, fill, lw) {
    ctx.fillStyle = fill;
    ctx.fill();
    if (lw > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = lw;
      ctx.strokeStyle = Art.INK;
      ctx.stroke();
    }
  }

  Art.INK = 'rgba(28,20,38,0.85)';
  const LW = 0.045; // default outline width in local units

  // ------------------------------------------------------------------ parts
  function drawWings(ctx, sp, t, flap) {
    if (!sp.wings || sp.wings === 'none') return;
    const a = Math.sin(flap) * 0.6;
    const col = sp.wingColor || U.shade(sp.main, 0.35);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 0.14, -0.62);
      ctx.rotate(side * (0.5 + a));
      ctx.scale(side, 1);
      if (sp.wings === 'bat') {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(0.34, -0.28, 0.52, -0.02);
        ctx.quadraticCurveTo(0.42, 0.02, 0.40, 0.12);
        ctx.quadraticCurveTo(0.30, 0.06, 0.26, 0.16);
        ctx.quadraticCurveTo(0.16, 0.08, 0.10, 0.16);
        ctx.closePath();
        ink(ctx, col, LW * 0.8);
      } else if (sp.wings === 'insect') {
        ctx.globalAlpha = 0.62;
        ell(ctx, 0.24, -0.10, 0.26, 0.10, -0.25);
        ink(ctx, sp.wingColor || '#dff3ff', LW * 0.5);
        ell(ctx, 0.18, 0.04, 0.2, 0.075, 0.1);
        ink(ctx, sp.wingColor || '#dff3ff', LW * 0.5);
        ctx.globalAlpha = 1;
      } else if (sp.wings === 'feather') {
        ctx.beginPath();
        ctx.moveTo(0, 0.02);
        ctx.quadraticCurveTo(0.3, -0.22, 0.5, 0.0);
        ctx.quadraticCurveTo(0.3, 0.14, 0, 0.14);
        ctx.closePath();
        ink(ctx, col, LW * 0.8);
        ctx.strokeStyle = U.rgba('#000000', 0.15);
        ctx.lineWidth = LW * 0.6;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0.08 * i, 0.02);
          ctx.lineTo(0.12 + 0.1 * i, 0.11);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  function drawTail(ctx, sp, t, walk) {
    if (!sp.tail || sp.tail === 'none') return;
    const sway = Math.sin(t * 3.4 + walk * 2) * 0.12;
    ctx.save();
    ctx.translate(-0.26, -0.30);
    if (sp.tail === 'fluffy') {
      ctx.rotate(-0.4 + sway);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-0.30, -0.06, -0.34, -0.30);
      ctx.quadraticCurveTo(-0.20, -0.36, -0.16, -0.20);
      ctx.quadraticCurveTo(-0.12, -0.06, 0, 0.10);
      ctx.closePath();
      ink(ctx, sp.accent || U.shade(sp.main, -0.15), LW * 0.85);
    } else if (sp.tail === 'thin') {
      ctx.strokeStyle = sp.accent || U.shade(sp.main, -0.2);
      ctx.lineWidth = 0.075;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-0.24 + sway * 0.4, -0.04, -0.26, -0.26 + sway);
      ctx.stroke();
      circle(ctx, -0.26, -0.28 + sway, 0.055);
      ink(ctx, sp.accent || U.shade(sp.main, -0.2), 0);
    } else if (sp.tail === 'stinger') {
      ctx.rotate(0.2 + sway);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-0.22, 0.08, -0.30, -0.06);
      ctx.lineTo(-0.42, -0.14);
      ctx.quadraticCurveTo(-0.26, -0.14, -0.14, -0.10);
      ctx.closePath();
      ink(ctx, sp.accent || '#4a3a2a', LW * 0.8);
    } else if (sp.tail === 'leafy') {
      ctx.rotate(-0.5 + sway);
      ell(ctx, -0.2, -0.12, 0.19, 0.09, -0.5);
      ink(ctx, sp.accent || '#79c65b', LW * 0.8);
    }
    ctx.restore();
  }

  function drawLegs(ctx, sp, walk, grounded) {
    if (sp.legs === 'none' || grounded === false) return;
    const c = sp.legColor || U.shade(sp.main, -0.28);
    ctx.strokeStyle = c;
    const sw = Math.sin(walk) * 0.11;
    const w = sp.legW || 0.10;
    const y0 = sp.legTop == null ? -0.26 : sp.legTop;
    limb(ctx, -0.13, y0, -0.15 + sw, -0.01, w);
    limb(ctx, 0.13, y0, 0.15 - sw, -0.01, w);
    // feet
    ctx.fillStyle = U.shade(c, -0.1);
    ell(ctx, -0.15 + sw, -0.015, 0.075, 0.045); ctx.fill();
    ell(ctx, 0.15 - sw, -0.015, 0.075, 0.045); ctx.fill();
  }

  function drawBodyShape(ctx, sp, bob) {
    const shape = sp.body || 'round';
    ctx.save();
    ctx.translate(0, bob);
    if (shape === 'round') {
      blob(ctx, 0, -0.42, 0.30, 0.26, 0.035, sp.seed || 1);
    } else if (shape === 'tall') {
      blob(ctx, 0, -0.46, 0.25, 0.31, 0.03, sp.seed || 2);
    } else if (shape === 'bulky') {
      blob(ctx, 0, -0.44, 0.38, 0.31, 0.04, sp.seed || 3);
    } else if (shape === 'slim') {
      blob(ctx, 0, -0.44, 0.21, 0.27, 0.03, sp.seed || 4);
    } else if (shape === 'orb') {
      circle(ctx, 0, -0.5, 0.34);
    }
    ink(ctx, sp.main, LW);

    // belly patch
    if (sp.belly) {
      ctx.save();
      ctx.clip();
      ell(ctx, 0, -0.34, 0.19, 0.18);
      ctx.fillStyle = sp.belly;
      ctx.fill();
      ctx.restore();
    }
    // pattern
    if (sp.pattern === 'spots') {
      ctx.save();
      if (shape === 'round') blob(ctx, 0, -0.42, 0.30, 0.26, 0.035, sp.seed || 1);
      else if (shape === 'bulky') blob(ctx, 0, -0.44, 0.38, 0.31, 0.04, sp.seed || 3);
      else blob(ctx, 0, -0.46, 0.25, 0.31, 0.03, sp.seed || 2);
      ctx.clip();
      ctx.fillStyle = U.rgba(sp.patternColor || '#000000', 0.22);
      circle(ctx, -0.17, -0.52, 0.08); ctx.fill();
      circle(ctx, 0.19, -0.4, 0.065); ctx.fill();
      circle(ctx, 0.05, -0.62, 0.05); ctx.fill();
      ctx.restore();
    } else if (sp.pattern === 'stripes') {
      ctx.save();
      blob(ctx, 0, -0.44, 0.32, 0.28, 0.035, sp.seed || 1);
      ctx.clip();
      ctx.strokeStyle = U.rgba(sp.patternColor || '#000000', 0.22);
      ctx.lineWidth = 0.065;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-0.4, -0.5 + i * 0.11);
        ctx.lineTo(0.4, -0.42 + i * 0.11);
        ctx.stroke();
      }
      ctx.restore();
    }
    // soft top highlight
    ctx.save();
    ctx.globalAlpha = 0.16;
    ell(ctx, -0.08, -0.60, 0.14, 0.07, -0.4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawEars(ctx, sp, bob, wobble) {
    const type = sp.ears || 'cat';
    if (type === 'none') return;
    const c = sp.main;
    const inner = sp.earInner || U.mix(sp.main, '#ffffff', 0.55);
    ctx.save();
    ctx.translate(0, bob);
    if (type === 'cat') {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 0.16, -0.86);
        ctx.rotate(s * (0.22 + wobble * 0.12));
        tri(ctx, -0.10, 0.06, 0, -0.22, 0.11, 0.06);
        ink(ctx, c, LW);
        tri(ctx, -0.05, 0.03, 0, -0.13, 0.055, 0.03);
        ink(ctx, inner, 0);
        ctx.restore();
      }
    } else if (type === 'floppy') {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 0.20, -0.84);
        ctx.rotate(s * (0.5 + wobble * 0.2));
        ell(ctx, s * 0.06, 0.08, 0.09, 0.18, s * 0.3);
        ink(ctx, U.shade(c, -0.08), LW);
        ctx.restore();
      }
    } else if (type === 'horn') {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 0.17, -0.88);
        ctx.rotate(s * 0.4);
        tri(ctx, -0.06, 0.05, s * 0.02, -0.20, 0.07, 0.05);
        ink(ctx, sp.hornColor || '#f2e6cf', LW * 0.9);
        ctx.restore();
      }
    } else if (type === 'antenna') {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 0.10, -0.90);
        ctx.strokeStyle = Art.INK;
        ctx.lineWidth = 0.045;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * 0.10, -0.14, s * 0.16, -0.2 + wobble * 0.05);
        ctx.stroke();
        circle(ctx, s * 0.16, -0.2 + wobble * 0.05, 0.055);
        ink(ctx, sp.accent || inner, LW * 0.7);
        ctx.restore();
      }
    } else if (type === 'fin') {
      ctx.beginPath();
      ctx.moveTo(-0.02, -1.02);
      ctx.quadraticCurveTo(0.10, -1.16, 0.20, -0.94);
      ctx.quadraticCurveTo(0.08, -0.92, -0.02, -0.94);
      ctx.closePath();
      ink(ctx, sp.accent || inner, LW * 0.8);
    } else if (type === 'tuft') {
      ctx.beginPath();
      ctx.moveTo(-0.06, -0.94);
      ctx.quadraticCurveTo(-0.02, -1.16, 0.06, -1.0);
      ctx.quadraticCurveTo(0.14, -1.14, 0.12, -0.92);
      ctx.closePath();
      ink(ctx, sp.accent || U.shade(c, -0.2), LW * 0.8);
    }
    ctx.restore();
  }

  function drawHead(ctx, sp, bob, t, mood) {
    ctx.save();
    ctx.translate(0, bob);
    const hr = sp.headR || 0.30;
    const hy = sp.headY == null ? -0.78 : sp.headY;

    // head
    blob(ctx, 0, hy, hr, hr * 0.92, 0.025, (sp.seed || 1) + 5);
    ink(ctx, sp.head || sp.main, LW);

    // muzzle / snout
    if (sp.muzzle === 'snout') {
      ell(ctx, 0, hy + 0.11, 0.15, 0.10);
      ink(ctx, sp.belly || U.mix(sp.main, '#ffffff', 0.5), LW * 0.7);
    } else if (sp.muzzle === 'beak') {
      tri(ctx, -0.08, hy + 0.05, 0.0, hy + 0.20, 0.08, hy + 0.05);
      ink(ctx, sp.beakColor || '#ffb648', LW * 0.8);
    }

    // eyes
    const blink = (Math.sin(t * 0.9 + (sp.seed || 0)) > 0.985) ? 0.12 : 1;
    const eyeType = sp.eyes || 'big';
    const ex = sp.eyeX || 0.115;
    const ey = hy - 0.02;
    if (eyeType === 'goggles') {
      ctx.strokeStyle = Art.INK; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(-hr, ey - 0.02); ctx.lineTo(hr, ey - 0.02); ctx.stroke();
      for (const s of [-1, 1]) {
        circle(ctx, s * ex, ey, 0.10);
        ink(ctx, '#8fd8ff', LW * 0.8);
        circle(ctx, s * ex - 0.03, ey - 0.03, 0.035);
        ink(ctx, '#ffffff', 0);
      }
    } else if (eyeType === 'single') {
      circle(ctx, 0, ey, 0.13);
      ink(ctx, '#ffffff', LW * 0.7);
      circle(ctx, 0.02, ey + 0.01, 0.07 * blink + 0.001);
      ink(ctx, '#241a2e', 0);
      circle(ctx, -0.01, ey - 0.03, 0.028); ink(ctx, '#ffffff', 0);
    } else if (eyeType === 'angry') {
      for (const s of [-1, 1]) {
        ell(ctx, s * ex, ey, 0.085, 0.09 * blink + 0.002);
        ink(ctx, '#ffffff', LW * 0.65);
        circle(ctx, s * ex + s * 0.012, ey + 0.012, 0.045 * blink + 0.001);
        ink(ctx, '#241a2e', 0);
      }
      ctx.strokeStyle = Art.INK; ctx.lineWidth = 0.045; ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * (ex - 0.09), ey - 0.15);
        ctx.lineTo(s * (ex + 0.07), ey - 0.08);
        ctx.stroke();
      }
    } else if (eyeType === 'sleepy') {
      ctx.strokeStyle = Art.INK; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * ex, ey, 0.075, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
    } else if (eyeType === 'mask') {
      ctx.save();
      blob(ctx, 0, hy, hr, hr * 0.92, 0.025, (sp.seed || 1) + 5);
      ctx.clip();
      ctx.fillStyle = U.rgba('#231a30', 0.75);
      ctx.fillRect(-hr, ey - 0.10, hr * 2, 0.17);
      ctx.restore();
      for (const s of [-1, 1]) {
        ell(ctx, s * ex, ey, 0.07, 0.075 * blink + 0.002);
        ink(ctx, '#ffffff', 0);
        circle(ctx, s * ex, ey + 0.005, 0.035 * blink + 0.001);
        ink(ctx, '#241a2e', 0);
      }
    } else {
      // 'big' — the default doe eyes
      for (const s of [-1, 1]) {
        ell(ctx, s * ex, ey, 0.098, 0.11 * blink + 0.002);
        ink(ctx, '#ffffff', LW * 0.6);
        circle(ctx, s * ex + s * 0.014, ey + 0.018, 0.058 * blink + 0.001);
        ink(ctx, sp.pupil || '#2b1f3a', 0);
        circle(ctx, s * ex - 0.022, ey - 0.032, 0.03 * blink + 0.001);
        ink(ctx, '#ffffff', 0);
      }
    }

    // mouth
    ctx.strokeStyle = Art.INK;
    ctx.lineWidth = 0.042;
    ctx.lineCap = 'round';
    const my = hy + (sp.muzzle === 'snout' ? 0.13 : 0.13);
    if (mood === 'attack') {
      ell(ctx, 0, my + 0.01, 0.06, 0.055);
      ink(ctx, '#7a2b3c', LW * 0.6);
    } else if (sp.muzzle !== 'beak') {
      ctx.beginPath();
      ctx.arc(0, my - 0.03, 0.06, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    // cheeks
    if (sp.cheeks !== false) {
      ctx.globalAlpha = 0.35;
      for (const s of [-1, 1]) {
        ell(ctx, s * 0.20, hy + 0.08, 0.055, 0.035);
        ctx.fillStyle = sp.cheekColor || '#ff8fa8';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // fangs / teeth for the mean ones
    if (sp.fangs) {
      ctx.fillStyle = '#ffffff';
      tri(ctx, -0.06, my - 0.02, -0.03, my + 0.06, -0.005, my - 0.02); ctx.fill();
      tri(ctx, 0.06, my - 0.02, 0.03, my + 0.06, 0.005, my - 0.02); ctx.fill();
    }
    ctx.restore();
  }

  function drawGear(ctx, sp, bob, t) {
    const g = sp.gear;
    if (!g || g === 'none') return;
    const hy = sp.headY == null ? -0.78 : sp.headY;
    const hr = sp.headR || 0.30;
    ctx.save();
    ctx.translate(0, bob);
    if (g === 'helmet') {
      // The rim has to stop above the eyes or the critter loses its face.
      const rim = hy - 0.13;
      ctx.beginPath();
      ctx.arc(0, rim, hr * 1.04, Math.PI, U.TAU);
      ctx.lineTo(hr * 1.04, rim + 0.06);
      ctx.lineTo(-hr * 1.04, rim + 0.06);
      ctx.closePath();
      ink(ctx, sp.gearColor || '#b9c4d6', LW);
      ctx.fillStyle = U.rgba('#ffffff', 0.35);
      ell(ctx, -0.11, rim - 0.14, 0.07, 0.04, -0.4); ctx.fill();
      // nose guard, drawn thin so it sits between the eyes
      ctx.strokeStyle = Art.INK; ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.moveTo(0, rim - 0.28); ctx.lineTo(0, hy + 0.06); ctx.stroke();
    } else if (g === 'hood') {
      ctx.beginPath();
      ctx.arc(0, hy - 0.10, hr * 1.10, Math.PI * 0.92, U.TAU + 0.08);
      ctx.quadraticCurveTo(hr * 0.86, hy - 0.02, hr * 0.52, hy - 0.14);
      ctx.quadraticCurveTo(0, hy - 0.30, -hr * 0.52, hy - 0.14);
      ctx.quadraticCurveTo(-hr * 0.86, hy - 0.02, -hr * 1.10, hy - 0.10);
      ctx.closePath();
      ink(ctx, sp.gearColor || '#5b4b8a', LW);
    } else if (g === 'crown') {
      ctx.beginPath();
      ctx.moveTo(-0.19, hy - 0.24);
      ctx.lineTo(-0.19, hy - 0.42); ctx.lineTo(-0.09, hy - 0.32);
      ctx.lineTo(0, hy - 0.46); ctx.lineTo(0.09, hy - 0.32);
      ctx.lineTo(0.19, hy - 0.42); ctx.lineTo(0.19, hy - 0.24);
      ctx.closePath();
      ink(ctx, sp.gearColor || '#ffd45e', LW * 0.9);
    } else if (g === 'leaf') {
      ctx.save();
      ctx.translate(0.06, hy - 0.30);
      ctx.rotate(-0.5 + Math.sin(t * 2) * 0.08);
      ell(ctx, 0.10, 0, 0.16, 0.075, 0);
      ink(ctx, sp.gearColor || '#7ed957', LW * 0.8);
      ctx.restore();
    } else if (g === 'bandana') {
      ctx.beginPath();
      ctx.moveTo(-hr * 0.98, hy - 0.10);
      ctx.quadraticCurveTo(0, hy - 0.26, hr * 0.98, hy - 0.10);
      ctx.quadraticCurveTo(0, hy - 0.04, -hr * 0.98, hy - 0.10);
      ctx.closePath();
      ink(ctx, sp.gearColor || '#e0567a', LW * 0.8);
    } else if (g === 'pot') {
      ctx.beginPath();
      ctx.arc(0, hy - 0.06, hr * 0.95, Math.PI * 1.05, U.TAU - 0.05);
      ctx.closePath();
      ink(ctx, sp.gearColor || '#9aa4b2', LW);
      ctx.strokeStyle = Art.INK; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.arc(0, hy - 0.06, hr * 0.6, Math.PI * 1.1, U.TAU - 0.1); ctx.stroke();
    } else if (g === 'flower') {
      ctx.save();
      ctx.translate(0.16, hy - 0.26);
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i / 5) * U.TAU + t * 0.3);
        ell(ctx, 0, -0.075, 0.045, 0.075);
        ink(ctx, sp.gearColor || '#ff9ec4', LW * 0.55);
        ctx.restore();
      }
      circle(ctx, 0, 0, 0.045);
      ink(ctx, '#ffe066', LW * 0.5);
      ctx.restore();
    }
    ctx.restore();
  }

  // How far out to the side the weapon is held. Far enough that a long bow or
  // spear clears the head instead of slicing through the critter's face.
  const WEAPON_X = 0.36;

  function drawWeapon(ctx, sp, bob, swing, t) {
    const w = sp.weapon;
    if (!w || w === 'none') return;
    ctx.save();
    ctx.translate(WEAPON_X, -0.44 + bob);
    ctx.rotate(-0.5 + swing);
    const steel = sp.weaponColor || '#cfd8e6';
    if (w === 'sword') {
      ctx.beginPath();
      ctx.moveTo(-0.035, 0); ctx.lineTo(-0.03, -0.44);
      ctx.lineTo(0, -0.54); ctx.lineTo(0.03, -0.44); ctx.lineTo(0.035, 0);
      ctx.closePath();
      ink(ctx, steel, LW * 0.7);
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(-0.09, -0.02, 0.18, 0.05);
      ctx.fillRect(-0.03, 0.02, 0.06, 0.14);
      ctx.strokeStyle = Art.INK; ctx.lineWidth = LW * 0.6;
      ctx.strokeRect(-0.09, -0.02, 0.18, 0.05);
    } else if (w === 'dagger') {
      ctx.beginPath();
      ctx.moveTo(-0.03, 0); ctx.lineTo(-0.025, -0.24); ctx.lineTo(0, -0.31);
      ctx.lineTo(0.025, -0.24); ctx.lineTo(0.03, 0); ctx.closePath();
      ink(ctx, steel, LW * 0.6);
      ctx.fillStyle = '#5c4030'; ctx.fillRect(-0.028, 0, 0.056, 0.11);
    } else if (w === 'club') {
      ctx.strokeStyle = '#8a5f3a'; ctx.lineWidth = 0.075; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0.14); ctx.lineTo(0, -0.28); ctx.stroke();
      blob(ctx, 0, -0.38, 0.13, 0.15, 0.09, 3);
      ink(ctx, sp.weaponColor || '#a8734a', LW * 0.75);
      ctx.fillStyle = U.rgba('#3d2716', 0.4);
      circle(ctx, -0.04, -0.40, 0.028); ctx.fill();
      circle(ctx, 0.05, -0.34, 0.023); ctx.fill();
    } else if (w === 'hammer') {
      ctx.strokeStyle = '#7a5232'; ctx.lineWidth = 0.07; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0.16); ctx.lineTo(0, -0.30); ctx.stroke();
      ctx.beginPath();
      ctx.rect(-0.17, -0.46, 0.34, 0.18);
      ink(ctx, steel, LW * 0.7);
    } else if (w === 'spear') {
      ctx.strokeStyle = '#8a5f3a'; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0.24); ctx.lineTo(0, -0.44); ctx.stroke();
      tri(ctx, -0.06, -0.42, 0, -0.60, 0.06, -0.42);
      ink(ctx, steel, LW * 0.6);
    } else if (w === 'bow') {
      // A shallow limb curve reads as a bow; a wide arc just looks like a hoop.
      ctx.strokeStyle = sp.weaponColor || '#9a6a3c';
      ctx.lineWidth = 0.055; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -0.36);
      ctx.quadraticCurveTo(0.21, -0.18, 0, 0.0);
      ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffffff', 0.75); ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.moveTo(0, -0.36);
      ctx.lineTo(-0.04 - swing * 0.10, -0.18);
      ctx.lineTo(0, 0.0);
      ctx.stroke();
      // nocked arrow
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-0.04 - swing * 0.10, -0.18);
      ctx.lineTo(0.20, -0.18);
      ctx.stroke();
    } else if (w === 'staff') {
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0.20); ctx.lineTo(0, -0.42); ctx.stroke();
      const glow = 0.5 + Math.sin(t * 4) * 0.2;
      ctx.globalAlpha = 0.35 + glow * 0.3;
      circle(ctx, 0, -0.50, 0.13);
      ctx.fillStyle = sp.orbColor || '#7fe0ff'; ctx.fill();
      ctx.globalAlpha = 1;
      circle(ctx, 0, -0.50, 0.075);
      ink(ctx, sp.orbColor || '#7fe0ff', LW * 0.55);
    } else if (w === 'shield') {
      ctx.beginPath();
      ctx.moveTo(-0.15, -0.30); ctx.lineTo(0.15, -0.30);
      ctx.lineTo(0.15, -0.05); ctx.quadraticCurveTo(0, 0.14, -0.15, -0.05);
      ctx.closePath();
      ink(ctx, sp.weaponColor || '#c9a24a', LW * 0.8);
      ctx.strokeStyle = U.rgba('#ffffff', 0.5); ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.moveTo(0, -0.28); ctx.lineTo(0, 0.04); ctx.stroke();
    } else if (w === 'bomb') {
      circle(ctx, 0, -0.12, 0.13);
      ink(ctx, '#3b3450', LW * 0.7);
      ctx.strokeStyle = '#b48b5a'; ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.moveTo(0.03, -0.24); ctx.quadraticCurveTo(0.12, -0.34, 0.08, -0.42); ctx.stroke();
      const sp2 = 0.5 + Math.sin(t * 22) * 0.5;
      circle(ctx, 0.08, -0.44, 0.03 + sp2 * 0.02);
      ink(ctx, '#ffd05e', 0);
    }
    ctx.restore();
  }

  function drawBackArm(ctx, sp, bob, swing) {
    const c = sp.armColor || U.shade(sp.main, -0.18);
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    const y = -0.46 + bob;
    limb(ctx, -0.22, y, -0.36, y + 0.12 - Math.abs(swing) * 0.06, 0.085);
    circle(ctx, -0.36, y + 0.12 - Math.abs(swing) * 0.06, 0.055); ctx.fill();
  }

  function drawFrontArm(ctx, sp, bob, swing) {
    const c = sp.armColor || U.shade(sp.main, -0.18);
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    const y = -0.46 + bob;
    if (sp.weapon && sp.weapon !== 'none') {
      // reach across to the grip
      limb(ctx, 0.18, y, WEAPON_X, y + 0.02, 0.085);
      circle(ctx, WEAPON_X, y + 0.02, 0.055); ctx.fill();
    } else {
      limb(ctx, 0.22, y, 0.36, y + 0.12 + Math.abs(swing) * 0.06, 0.085);
      circle(ctx, 0.36, y + 0.12 + Math.abs(swing) * 0.06, 0.055); ctx.fill();
    }
  }

  // ------------------------------------------------------------------ main
  /**
   * Draw one critter.
   * @param ctx canvas 2d context, already translated to the critter's ground point
   * @param spec visual spec (see CARDS)
   * @param o    {t, walk, attack, hurt, frozen, flying, scale, teamColor, alpha}
   */
  Art.critter = function (ctx, spec, o) {
    o = o || {};
    const t = o.t || 0;
    const s = (o.scale || 1) * (spec.scale || 1);
    const walkPhase = o.walk || 0;
    const moving = o.moving !== false;
    const bob = moving ? Math.sin(walkPhase * 2) * 0.022 : Math.sin(t * 2.2 + (spec.seed || 0)) * 0.012;
    const swing = o.attack ? Math.sin(U.clamp01(o.attack) * Math.PI) * 1.5 : 0;

    ctx.save();
    ctx.scale(s, s);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;

    // hover for fliers
    if (o.flying) ctx.translate(0, -0.34 + Math.sin(t * 3.6 + (spec.seed || 0)) * 0.05);

    // slight squash-and-stretch while walking
    if (moving) {
      const sq = 1 + Math.sin(walkPhase * 2) * 0.02;
      ctx.translate(0, 0);
      ctx.scale(1 / sq, sq);
    }

    drawWings(ctx, spec, t, o.flying ? t * 16 : t * 8);
    drawTail(ctx, spec, t, walkPhase);
    if (!o.flying) drawLegs(ctx, spec, walkPhase, true);
    drawBackArm(ctx, spec, bob, swing);
    drawBodyShape(ctx, spec, bob);
    // The weapon goes behind the head so a raised blade never covers the face.
    drawWeapon(ctx, spec, bob, swing, t);
    drawEars(ctx, spec, bob, Math.sin(walkPhase * 2 + 1) * 0.6);
    drawHead(ctx, spec, bob, t, o.attack ? 'attack' : 'idle');
    drawGear(ctx, spec, bob, t);
    drawFrontArm(ctx, spec, bob, swing);

    // team ribbon so friend/foe is readable at a glance
    if (o.teamColor) {
      ctx.save();
      ctx.translate(0, bob);
      ctx.beginPath();
      ctx.moveTo(-0.20, -0.60);
      ctx.quadraticCurveTo(0, -0.52, 0.20, -0.60);
      ctx.quadraticCurveTo(0, -0.46, -0.20, -0.60);
      ctx.closePath();
      ink(ctx, o.teamColor, LW * 0.6);
      ctx.restore();
    }

    ctx.restore();
  };

  // Flash / freeze overlays are applied by re-drawing the silhouette on top.
  Art.critterOverlay = function (ctx, spec, o, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color;
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  };

  // ------------------------------------------------------------------ buildings
  Art.building = function (ctx, spec, o) {
    o = o || {};
    const t = o.t || 0;
    const s = (o.scale || 1) * (spec.scale || 1);
    ctx.save();
    ctx.scale(s, s);

    const kind = spec.build || 'tower';
    const main = spec.main || '#b98c5a';
    if (kind === 'cannon') {
      // base
      ell(ctx, 0, -0.06, 0.42, 0.16);
      ink(ctx, U.shade(main, -0.25), LW);
      ctx.beginPath();
      ctx.rect(-0.34, -0.34, 0.68, 0.30);
      ink(ctx, main, LW);
      // barrel
      ctx.save();
      ctx.translate(0, -0.40);
      ctx.rotate((o.aim || -0.5) + Math.sin(t) * 0.02);
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-0.09, -0.44, 0.18, 0.50, 0.06) : ctx.rect(-0.09, -0.44, 0.18, 0.50);
      ink(ctx, spec.accent || '#5c6b7a', LW);
      circle(ctx, 0, -0.44, 0.10);
      ink(ctx, U.shade(spec.accent || '#5c6b7a', -0.3), LW * 0.7);
      ctx.restore();
      circle(ctx, 0, -0.40, 0.10);
      ink(ctx, U.shade(main, -0.15), LW * 0.8);
    } else if (kind === 'nest') {
      ell(ctx, 0, -0.05, 0.44, 0.15);
      ink(ctx, U.shade(main, -0.3), LW);
      blob(ctx, 0, -0.42, 0.38, 0.36, 0.06, 7);
      ink(ctx, main, LW);
      // entrance
      ell(ctx, 0, -0.34, 0.14, 0.16);
      ink(ctx, '#3a2b20', LW * 0.7);
      // honey drips
      ctx.fillStyle = spec.accent || '#ffcf5e';
      for (let i = -1; i <= 1; i++) {
        circle(ctx, i * 0.16, -0.62 + Math.abs(i) * 0.06, 0.05); ctx.fill();
      }
    } else if (kind === 'bunker') {
      ell(ctx, 0, -0.05, 0.48, 0.16);
      ink(ctx, U.shade(main, -0.3), LW);
      ctx.beginPath();
      ctx.moveTo(-0.42, -0.06);
      ctx.quadraticCurveTo(-0.44, -0.62, 0, -0.66);
      ctx.quadraticCurveTo(0.44, -0.62, 0.42, -0.06);
      ctx.closePath();
      ink(ctx, main, LW);
      ctx.strokeStyle = U.rgba('#000000', 0.25);
      ctx.lineWidth = 0.035;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-0.40 + i * 0.02, -0.18 - i * 0.16);
        ctx.lineTo(0.40 - i * 0.02, -0.18 - i * 0.16);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.rect(-0.16, -0.44, 0.32, 0.10);
      ink(ctx, '#2c2438', LW * 0.6);
    } else {
      // generic tower
      ell(ctx, 0, -0.05, 0.44, 0.15);
      ink(ctx, U.shade(main, -0.3), LW);
      ctx.beginPath();
      ctx.moveTo(-0.32, -0.05); ctx.lineTo(-0.26, -0.62);
      ctx.lineTo(0.26, -0.62); ctx.lineTo(0.32, -0.05);
      ctx.closePath();
      ink(ctx, main, LW);
    }
    ctx.restore();
  };

  // ------------------------------------------------------------------ towers
  Art.tower = function (ctx, o) {
    // o: {kind:'king'|'princess', team, t, scale, hpFrac, activated, firing}
    const s = o.scale || 1;
    const king = o.kind === 'king';
    const base = o.team === 'player' ? '#5d8ad8' : '#d1566f';
    const stone = o.team === 'player' ? '#e8eef8' : '#f8e9ec';
    const roof = o.team === 'player' ? '#3f6bb5' : '#a83a54';
    const t = o.t || 0;

    ctx.save();
    ctx.scale(s, s);

    // platform
    ell(ctx, 0, 0, 1.35, 0.5);
    ink(ctx, U.shade(stone, -0.18), 0.05);
    ell(ctx, 0, -0.08, 1.25, 0.44);
    ink(ctx, stone, 0.04);

    const h = king ? 1.55 : 1.2;
    const w = king ? 0.92 : 0.74;

    // body
    ctx.beginPath();
    ctx.moveTo(-w, -0.12);
    ctx.lineTo(-w * 0.86, -h);
    ctx.lineTo(w * 0.86, -h);
    ctx.lineTo(w, -0.12);
    ctx.closePath();
    ink(ctx, stone, 0.05);

    // stone courses
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-w, -0.12); ctx.lineTo(-w * 0.86, -h); ctx.lineTo(w * 0.86, -h); ctx.lineTo(w, -0.12); ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = U.rgba('#7b6f88', 0.35);
    ctx.lineWidth = 0.035;
    for (let i = 1; i < 6; i++) {
      const y = -0.12 - (h - 0.12) * (i / 6);
      ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke();
      const off = i % 2 ? 0 : w * 0.45;
      for (let x = -w + off; x < w; x += w * 0.9) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + (h - 0.12) / 6); ctx.stroke();
      }
    }
    ctx.restore();

    // battlements
    const bw = w * 0.86;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.rect(i * bw * 0.4 - bw * 0.14, -h - 0.22, bw * 0.28, 0.24);
      ink(ctx, U.shade(stone, -0.06), 0.04);
    }

    // banner / roof
    if (king) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.95, -h - 0.2);
      ctx.lineTo(0, -h - 0.86);
      ctx.lineTo(w * 0.95, -h - 0.2);
      ctx.closePath();
      ink(ctx, roof, 0.05);
      // flag
      ctx.strokeStyle = Art.INK; ctx.lineWidth = 0.045;
      ctx.beginPath(); ctx.moveTo(0, -h - 0.84); ctx.lineTo(0, -h - 1.3); ctx.stroke();
      const fw = 0.42 + Math.sin(t * 3) * 0.04;
      ctx.beginPath();
      ctx.moveTo(0, -h - 1.28);
      ctx.quadraticCurveTo(fw * 0.6, -h - 1.20 + Math.sin(t * 4) * 0.03, fw, -h - 1.24);
      ctx.lineTo(fw, -h - 1.02);
      ctx.quadraticCurveTo(fw * 0.6, -h - 0.98, 0, -h - 1.04);
      ctx.closePath();
      ink(ctx, base, 0.04);
      // crown emblem
      ctx.fillStyle = '#ffd45e';
      ctx.beginPath();
      ctx.moveTo(-0.22, -h - 0.42); ctx.lineTo(-0.22, -h - 0.60); ctx.lineTo(-0.11, -h - 0.50);
      ctx.lineTo(0, -h - 0.64); ctx.lineTo(0.11, -h - 0.50); ctx.lineTo(0.22, -h - 0.60);
      ctx.lineTo(0.22, -h - 0.42); ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 0.035; ctx.strokeStyle = Art.INK; ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-w * 0.95, -h - 0.18);
      ctx.lineTo(0, -h - 0.72);
      ctx.lineTo(w * 0.95, -h - 0.18);
      ctx.closePath();
      ink(ctx, roof, 0.05);
      circle(ctx, 0, -h - 0.78, 0.09);
      ink(ctx, '#ffd45e', 0.035);
    }

    // arrow slit window glows when the tower is active
    const glow = o.activated === false ? 0.15 : 0.55 + Math.sin(t * 3) * 0.12;
    ctx.globalAlpha = glow;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(-0.11, -h * 0.72, 0.22, 0.34, 0.1)
      : ctx.rect(-0.11, -h * 0.72, 0.22, 0.34);
    ctx.fillStyle = o.activated === false ? '#5a5170' : '#ffe08a';
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  // ------------------------------------------------------------------ misc fx
  Art.shadow = function (ctx, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.22 : alpha;
    ctx.fillStyle = '#000000';
    ell(ctx, x, y, r, r * 0.42);
    ctx.fill();
    ctx.restore();
  };

  Art.ell = ell;
  Art.circle = circle;
  Art.tri = tri;
  Art.blob = blob;
  Art.ink = ink;

  NS.Art = Art;
})(window.COC);

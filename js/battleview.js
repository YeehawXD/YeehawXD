/* Critter Clash — battleview.js
 * Draws a battle: the arena, both formations, and every combat effect.
 *
 * Depth is faked with three cues that always agree — units further back sit
 * higher on screen, are drawn smaller, and are hazed toward the sky colour.
 * That is what stops a flat 3x2 grid from reading as a spreadsheet.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const CA = NS.CritterArt;
  const R = NS.Roster;
  const C = NS.Combat;

  const View = {
    canvas: null, ctx: null,
    w: 0, h: 0, dpr: 1,
    theme: null,
    shake: 0,
    _bg: null, _bgKey: '',
  };

  /* Screen position and scale for one board slot, as fractions of the field. */
  const LAYOUT = {
    foe: [
      { y: 0.345, s: 0.94 },   // row 0 — front
      { y: 0.205, s: 0.80 },   // row 1 — back, further away so smaller
    ],
    ally: [
      { y: 0.605, s: 1.06 },
      { y: 0.760, s: 1.18 },
    ],
  };
  const COL_X = [0.225, 0.5, 0.775];

  /* Critter height as a fraction of the field. Three columns of these have to
   * sit side by side without touching, and the bottom row must clear the
   * ultimate bar, so this is deliberately modest. */
  const UNIT_H = 0.077;

  View.attach = function (canvas) {
    View.canvas = canvas;
    View.ctx = canvas.getContext('2d');
    View._bg = document.createElement('canvas');
  };

  View.resize = function (w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (View.w === w && View.h === h && View.dpr === dpr) return;
    View.w = w; View.h = h; View.dpr = dpr;
    View.canvas.width = Math.round(w * dpr);
    View.canvas.height = Math.round(h * dpr);
    View.canvas.style.width = w + 'px';
    View.canvas.style.height = h + 'px';
    View._bgKey = '';
  };

  View.setTheme = function (act) {
    View.theme = act;
    View._bgKey = '';
  };

  function slotPos(side, slot) {
    const row = C.slotRow(slot), col = C.slotCol(slot);
    const L = LAYOUT[side][row];
    // stagger the back row inward so critters never hide directly behind one another
    const inset = row === 1 ? 0.055 * (col === 0 ? 1 : col === 2 ? -1 : 0) : 0;
    return { x: (COL_X[col] + inset) * View.w, y: L.y * View.h, s: L.s };
  }
  View.slotPos = slotPos;

  // ------------------------------------------------------------- background
  function bakeBackground() {
    const key = View.w + 'x' + View.h + '@' + (View.theme ? View.theme.name : '-');
    if (View._bgKey === key) return;
    View._bgKey = key;
    const c = View._bg;
    c.width = Math.round(View.w * View.dpr);
    c.height = Math.round(View.h * View.dpr);
    const ctx = c.getContext('2d');
    const th = View.theme || { sky: ['#3b6f4a', '#2a4f39'], ground: '#5f9a52', accent: '#8fd06a' };
    const W = View.w, H = View.h;
    ctx.save();
    ctx.scale(View.dpr, View.dpr);

    const horizon = H * 0.155;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon + H * 0.2);
    sky.addColorStop(0, U.shade(th.sky[1], -0.25));
    sky.addColorStop(1, th.sky[0]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + H * 0.2);

    // distant hills — stepped by segment count, never by a computed pixel
    // stride, so a zero-width canvas can never produce a zero-length step
    const rng = U.rng(U.hashString(th.name || 'act'));
    const SEGS = 8;
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      ctx.moveTo(0, horizon + layer * 8 + 26);
      for (let i = 0; i < SEGS; i++) {
        const x = (i / SEGS) * W;
        ctx.quadraticCurveTo(
          x + W / (SEGS * 2), horizon - 26 + layer * 14 + rng.range(-16, 16),
          x + W / SEGS, horizon + layer * 8 + rng.range(-6, 10)
        );
      }
      ctx.lineTo(W, horizon + 90); ctx.lineTo(0, horizon + 90);
      ctx.closePath();
      ctx.fillStyle = U.mix(th.sky[0], th.ground, 0.3 + layer * 0.3);
      ctx.fill();
    }

    // ground
    const g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, U.shade(th.ground, -0.22));
    g.addColorStop(0.45, th.ground);
    g.addColorStop(1, U.shade(th.ground, 0.12));
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, W, H - horizon);

    // ground bands, converging toward the horizon for perspective
    ctx.save();
    ctx.beginPath(); ctx.rect(0, horizon, W, H - horizon); ctx.clip();
    for (let i = 0; i < 9; i++) {
      const k = i / 9;
      const y = horizon + Math.pow(k, 1.7) * (H - horizon);
      ctx.globalAlpha = 0.05 + k * 0.05;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
      ctx.fillRect(0, y, W, Math.pow(k + 0.12, 1.7) * 26);
    }
    ctx.globalAlpha = 1;

    // scattered scenery, kept out of the two combat bands
    for (let i = 0; i < 40; i++) {
      const y = horizon + Math.pow(rng(), 1.5) * (H - horizon);
      const k = (y - horizon) / (H - horizon);
      const x = rng.range(0, W);
      const inBand = (Math.abs(y - H * 0.26) < H * 0.12) || (Math.abs(y - H * 0.72) < H * 0.14);
      if (inBand && rng.chance(0.85)) continue;
      const sc = 0.35 + k * 1.1;
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = U.shade(th.ground, -0.3 + k * 0.15);
      ctx.beginPath();
      ctx.ellipse(x, y, 16 * sc, 6 * sc, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = U.mix(th.accent, th.ground, 0.45);
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        ctx.arc(x + (b - 1) * 9 * sc, y - 8 * sc - Math.abs(b - 1) * 2 * sc, 9 * sc, 0, U.TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.28, W / 2, H * 0.5, H * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(10,6,20,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

  // ------------------------------------------------------------- draw
  View.draw = function (battle, ui) {
    const ctx = View.ctx;
    // The first frame can land before layout has given the canvas a size.
    if (!ctx || View.w < 2 || View.h < 2) return;
    bakeBackground();
    ctx.save();
    ctx.scale(View.dpr, View.dpr);
    ctx.clearRect(0, 0, View.w, View.h);

    let sx = 0, sy = 0;
    if (View.shake > 0) {
      View.shake = Math.max(0, View.shake - 0.035);
      sx = (Math.random() - 0.5) * View.shake * 16;
      sy = (Math.random() - 0.5) * View.shake * 16;
    }
    ctx.translate(sx, sy);
    ctx.drawImage(View._bg, 0, 0, View.w, View.h);

    // the two engagement lines, so the board layout is legible
    drawBands(ctx);

    const t = battle.time;
    const order = battle.units.slice().sort((a, b) => posY(a) - posY(b));

    // highlight the slot the player is hovering for an ultimate
    order.forEach((u) => drawUnit(ctx, battle, u, t, ui));
    battle.fx.forEach((f) => drawFx(ctx, battle, f));

    // §7: a brief red vignette when your own team takes a hit — never so
    // strong that it costs readability
    if (battle.allyHurt > 0) {
      const a = Math.min(0.34, battle.allyHurt * 0.34);
      const vg = ctx.createRadialGradient(
        View.w / 2, View.h / 2, Math.min(View.w, View.h) * 0.38,
        View.w / 2, View.h / 2, Math.max(View.w, View.h) * 0.72);
      vg.addColorStop(0, 'rgba(200,40,50,0)');
      vg.addColorStop(1, 'rgba(200,40,50,' + a + ')');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, View.w, View.h);
    }

    ctx.restore();
  };

  function posY(u) { return slotPos(u.side, u.slot).y; }

  function drawBands(ctx) {
    const W = View.w, H = View.h;
    [[0.345, 'rgba(255,120,140,0.10)'], [0.605, 'rgba(120,180,255,0.10)']].forEach(([y, col]) => {
      const g = ctx.createLinearGradient(0, H * y - 34, 0, H * y + 22);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, col);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, H * y - 34, W, 56);
    });
  }

  function unitScale(u) {
    const p = slotPos(u.side, u.slot);
    return View.h * UNIT_H * p.s;
  }

  function drawUnit(ctx, battle, u, t, ui) {
    const p = slotPos(u.side, u.slot);
    const scale = unitScale(u);
    const dead = u.dead;

    ctx.save();
    ctx.translate(p.x, p.y);

    if (dead) {
      ctx.globalAlpha = 0.0;
      ctx.restore();
      return;
    }

    // lunge toward the enemy while attacking
    const lunge = u.anim.attack ? Math.sin(u.anim.attack * Math.PI) : 0;
    ctx.translate(0, lunge * (u.side === 'ally' ? -10 : 10));

    // ready-to-ult glow
    if (u.energy >= C.ULT_COST) {
      const pulse = 0.5 + Math.sin(t * 5) * 0.5;
      const el = R.ELEMENTS[u.def.element];
      ctx.save();
      ctx.globalAlpha = 0.30 + pulse * 0.30;
      const g = ctx.createRadialGradient(0, -scale * 0.45, 0, 0, -scale * 0.45, scale * 1.05);
      g.addColorStop(0, el.glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -scale * 0.45, scale * 1.05, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }

    const frozen = C.hasStatus(u, 'freeze');
    const stunned = C.hasStatus(u, 'stun');
    const burning = C.hasStatus(u, 'burn');

    /* Status colour goes through a canvas filter on the critter's own draw
     * call. Compositing a tinted rectangle would need an isolated layer —
     * 'source-atop' on the shared canvas paints the background too. */
    let filter = 'none';
    if (u.anim.hurt > 0) {
      filter = 'brightness(' + (1 + U.clamp01(u.anim.hurt / 0.25) * 2.4) + ')';
    } else if (frozen) {
      filter = 'saturate(0.3) brightness(1.2) sepia(0.5) hue-rotate(165deg)';
    } else if (u.anim.heal > 0) {
      filter = 'brightness(1.18) saturate(1.5)';
    }

    CA.draw(ctx, u.def, {
      t, scale, flip: u.side === 'foe', filter: filter,
      st: {
        attack: u.anim.attack,
        walk: t * 3,
        moving: false,
        ko: dead,
        hpFrac: u.hp / u.maxHp,
      },
    });

    if (u.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.12;
      ctx.strokeStyle = '#a8e0ff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, -scale * 0.48, scale * 0.62, scale * 0.72, 0, 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (stunned) drawSpin(ctx, t, scale, '#ffe08a');
    if (burning) drawFlames(ctx, t, scale, u.uid);

    ctx.restore();

    drawUnitBars(ctx, u, p, scale, ui);
  }

  function drawSpin(ctx, t, scale, col) {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i / 3) * U.TAU;
      ctx.beginPath();
      ctx.arc(0, -scale * 1.12, scale * 0.3, a, a + 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFlames(ctx, t, scale, seed) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const k = ((t * 1.6 + i / 3 + seed * 0.11) % 1);
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.fillStyle = i % 2 ? '#ffd070' : '#ff8030';
      ctx.beginPath();
      ctx.arc(Math.sin(k * 8 + i) * scale * 0.3, -scale * (0.2 + k * 0.9), scale * 0.09 * (1 - k), 0, U.TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawUnitBars(ctx, u, p, scale, ui) {
    const w = scale * 1.05;
    const h = Math.max(5, scale * 0.10);
    const x = p.x - w / 2;
    const y = p.y + scale * 0.16;

    // health
    ctx.save();
    roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, (h + 3) / 2);
    ctx.fillStyle = 'rgba(14,10,26,0.72)';
    ctx.fill();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    const frac = U.clamp01(u.hp / u.maxHp);
    const col = u.side === 'ally'
      ? (frac > 0.5 ? ['#7fe08a', '#3fa85a'] : frac > 0.25 ? ['#ffd45e', '#e0a11f'] : ['#ff8f8f', '#d04040'])
      : ['#f58fa2', '#c0405c'];
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, Math.max(2, w * frac), h, h / 2);
    ctx.fill();

    // shield overlay
    if (u.shield > 0) {
      const sf = U.clamp01(u.shield / u.maxHp);
      ctx.fillStyle = 'rgba(170,220,255,0.85)';
      roundRect(ctx, x, y, Math.max(2, w * Math.min(1, sf)), h * 0.45, h * 0.22);
      ctx.fill();
    }

    // §7: colour-coded status pips — green up for buffs, purple down for
    // debuffs, plus one dot per active condition
    let px = x;
    const py = y - h * 1.5 - 2;
    const pip = (color, up) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      if (up == null) { ctx.arc(px + 3, py + 3, 3, 0, U.TAU); }
      else if (up) { ctx.moveTo(px, py + 6); ctx.lineTo(px + 3, py); ctx.lineTo(px + 6, py + 6); ctx.closePath(); }
      else { ctx.moveTo(px, py); ctx.lineTo(px + 6, py); ctx.lineTo(px + 3, py + 6); ctx.closePath(); }
      ctx.fill();
      px += 8;
    };
    let hasBuff = false, hasDebuff = false;
    for (const b2 of u.buffs) { if (b2.pct > 0) hasBuff = true; else hasDebuff = true; }
    if (hasBuff) pip('#62d68a', true);
    if (hasDebuff) pip('#c07ae0', false);
    if (C.hasStatus(u, 'burn')) pip('#ff8a3c', null);
    if (C.hasStatus(u, 'chill')) pip('#8fd8ff', null);
    if (C.hasStatus(u, 'stun')) pip('#ffe08a', null);

    // energy
    const ey = y + h + 2;
    const eh = Math.max(3, scale * 0.055);
    roundRect(ctx, x, ey, w, eh, eh / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fill();
    const ef = U.clamp01(u.energy / C.ULT_COST);
    ctx.fillStyle = ef >= 1 ? '#ffe08a' : '#8fb8ff';
    roundRect(ctx, x, ey, Math.max(1, w * ef), eh, eh / 2);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  View.roundRect = roundRect;

  // ------------------------------------------------------------- fx
  function drawFx(ctx, battle, f) {
    const u = f.uid ? battle.unitById(f.uid) : null;
    const k = U.clamp01(f.t / f.life);
    if (!u && f.type !== 'banner') return;
    const p = u ? slotPos(u.side, u.slot) : { x: View.w / 2, y: View.h / 2 };
    const scale = u ? unitScale(u) : 40;

    ctx.save();
    switch (f.type) {
      case 'dmg': {
        ctx.translate(p.x, p.y - scale * 0.9 - U.easeOut(k) * scale * 0.8);
        ctx.globalAlpha = 1 - k * k;
        const size = Math.min(scale * (f.crit ? 0.55 : 0.45), View.w * 0.075);
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = size * 0.22;
        ctx.strokeStyle = 'rgba(18,10,28,0.9)';
        const label = (f.crit ? '' : '') + f.v;
        ctx.strokeText(label, 0, 0);
        ctx.fillStyle = f.crit ? '#ffd45e' : f.weak ? '#b8c4d8' : '#ffffff';
        ctx.fillText(label, 0, 0);
        // Say which way the element matchup went; "weak" alone is ambiguous.
        if (f.crit || f.weak) {
          ctx.font = '800 ' + size * 0.46 + 'px system-ui, sans-serif';
          ctx.fillStyle = f.crit ? '#ffd45e' : '#9fb0c8';
          ctx.fillText(f.crit ? 'STÆRKT!' : 'SVAGT', 0, size * 0.70);
        }
        break;
      }
      case 'heal': {
        ctx.translate(p.x, p.y - scale * 0.9 - U.easeOut(k) * scale * 0.7);
        ctx.globalAlpha = 1 - k * k;
        ctx.font = '800 ' + Math.min(scale * 0.42, View.w * 0.06) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = scale * 0.08;
        ctx.strokeStyle = 'rgba(10,40,20,0.8)';
        ctx.strokeText('+' + f.v, 0, 0);
        ctx.fillStyle = '#8fffa8';
        ctx.fillText('+' + f.v, 0, 0);
        break;
      }
      case 'miss': {
        ctx.translate(p.x, p.y - scale * 0.9 - U.easeOut(k) * scale * 0.5);
        ctx.globalAlpha = 1 - k;
        ctx.font = '800 ' + Math.min(scale * 0.34, View.w * 0.05) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#cfd8e6';
        ctx.fillText('MISS', 0, 0);
        break;
      }
      case 'hit': {
        ctx.translate(p.x, p.y - scale * 0.5);
        ctx.globalAlpha = 1 - k;
        const el = R.ELEMENTS[f.element] || { glow: '#ffffff' };
        ctx.strokeStyle = el.glow;
        ctx.lineWidth = scale * 0.12 * (1 - k);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          const a = -0.6 + i * 0.5;
          const r = scale * (0.3 + k * 0.5);
          ctx.arc(0, 0, r, a, a + 0.55);
          ctx.stroke();
        }
        break;
      }
      case 'shot': {
        const from = battle.unitById(f.from);
        if (!from) break;
        const a = slotPos(from.side, from.slot);
        const el = R.ELEMENTS[f.element] || { glow: '#ffffff' };
        const x = U.lerp(a.x, p.x, k);
        const y = U.lerp(a.y - unitScale(from) * 0.55, p.y - scale * 0.55, k) - Math.sin(k * Math.PI) * 22;
        ctx.globalAlpha = 1 - k * 0.3;
        const g = ctx.createRadialGradient(x, y, 0, x, y, scale * 0.22);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, el.glow);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, scale * 0.22, 0, U.TAU); ctx.fill();
        break;
      }
      case 'beam': {
        const from = battle.unitById(f.from);
        if (!from) break;
        const a = slotPos(from.side, from.slot);
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.strokeStyle = f.heal ? '#8fffa8' : '#ffd45e';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - unitScale(from) * 0.6);
        ctx.quadraticCurveTo((a.x + p.x) / 2, Math.min(a.y, p.y) - 60, p.x, p.y - scale * 0.6);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'chain': {
        const from = battle.unitById(f.from);
        if (!from) break;
        const a = slotPos(from.side, from.slot);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#fff0a8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - unitScale(from) * 0.6);
        const steps = 4;
        for (let i = 1; i <= steps; i++) {
          const q = i / steps;
          ctx.lineTo(
            U.lerp(a.x, p.x, q) + (Math.random() - 0.5) * 16,
            U.lerp(a.y - unitScale(from) * 0.6, p.y - scale * 0.6, q) + (Math.random() - 0.5) * 16
          );
        }
        ctx.stroke();
        break;
      }
      case 'shieldUp': {
        ctx.translate(p.x, p.y - scale * 0.5);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#a8e0ff';
        ctx.lineWidth = 3 * (1 - k);
        ctx.beginPath();
        ctx.ellipse(0, 0, scale * (0.5 + k * 0.5), scale * (0.6 + k * 0.5), 0, 0, U.TAU);
        ctx.stroke();
        break;
      }
      case 'revive': {
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#ffe08a';
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * U.TAU;
          const r = scale * (0.3 + k * 1.1);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r, -scale * 0.5 + Math.sin(a) * r * 0.6);
          ctx.lineTo(Math.cos(a) * r * 1.2, -scale * 0.5 + Math.sin(a) * r * 0.75);
          ctx.stroke();
        }
        break;
      }
      case 'ko': {
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = 1 - k;
        if (f.role === 'tank') {
          // §8: a tank falls heavily — ground dust, and one thud of shake
          if (!f._thud) { f._thud = true; View.shake = Math.max(View.shake, 0.5); }
          ctx.strokeStyle = 'rgba(214,196,168,0.8)';
          ctx.lineWidth = scale * 0.14 * (1 - k);
          ctx.beginPath();
          ctx.ellipse(0, 0, scale * (0.3 + k * 1.0), scale * (0.12 + k * 0.36), 0, 0, U.TAU);
          ctx.stroke();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * U.TAU;
            const r = scale * (0.3 + k * 0.9);
            ctx.fillStyle = 'rgba(190,172,150,0.7)';
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.3 - k * scale * 0.2, scale * 0.1 * (1 - k), 0, U.TAU);
            ctx.fill();
          }
        } else if (f.role === 'snigmorder') {
          // an assassin is simply gone — a swirl of dark smoke
          for (let i = 0; i < 5; i++) {
            const a = k * 5 + (i / 5) * U.TAU;
            const r = scale * 0.34 * (1 - k * 0.4);
            ctx.fillStyle = 'rgba(42,34,52,' + 0.7 * (1 - k) + ')';
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, -scale * (0.3 + k * 0.8) + Math.sin(a) * r * 0.5,
              scale * 0.16 * (1 - k * 0.5), 0, U.TAU);
            ctx.fill();
          }
        } else {
          // everyone else dissolves into their element's light
          ctx.fillStyle = f.glow || 'rgba(255,255,255,0.9)';
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * U.TAU;
            const r = k * scale * 1.1;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, -scale * 0.5 + Math.sin(a) * r * 0.7 - k * scale * 0.4,
              scale * 0.12 * (1 - k), 0, U.TAU);
            ctx.fill();
          }
        }
        break;
      }
      case 'critflash': {
        // §7: a sharp, short flash on a super-effective hit + a micro-shake
        if (!f._shook) { f._shook = true; View.shake = Math.max(View.shake, 0.32); }
        ctx.translate(p.x, p.y - scale * 0.5);
        const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, scale * (0.5 + k * 0.9));
        g2.addColorStop(0, 'rgba(255,248,220,' + 0.85 * (1 - k) + ')');
        g2.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(0, 0, scale * (0.5 + k * 0.9), 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,190,' + (1 - k) + ')';
        ctx.lineWidth = scale * 0.08 * (1 - k);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * U.TAU + 0.4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * scale * 0.4, Math.sin(a) * scale * 0.4);
          ctx.lineTo(Math.cos(a) * scale * (0.6 + k * 0.7), Math.sin(a) * scale * (0.6 + k * 0.7));
          ctx.stroke();
        }
        break;
      }
      case 'confetti': {
        // §7: victory rain in the team's own colours
        const rng2 = U.rng(f.seed || 1);
        const n2 = 42;
        for (let i = 0; i < n2; i++) {
          const cx2 = rng2.range(0, View.w);
          const speed2 = rng2.range(0.6, 1.15);
          const size2 = rng2.range(4, 8);
          const col2 = (f.colors && f.colors.length)
            ? f.colors[i % f.colors.length] : '#ffd58a';
          const rot2 = rng2.range(0, U.TAU);
          const kk = Math.min(1, k * speed2 * 1.35);
          const y2 = -20 + kk * (View.h * 0.95);
          const x2 = cx2 + Math.sin(k * 6 + i) * 26;
          ctx.save();
          ctx.globalAlpha = Math.min(1, (1.1 - kk) * 2);
          ctx.translate(x2, y2);
          ctx.rotate(rot2 + k * 7 * (i % 2 ? 1 : -1));
          ctx.fillStyle = col2;
          ctx.fillRect(-size2 / 2, -size2 / 3, size2, size2 * 0.66);
          ctx.restore();
        }
        break;
      }
      case 'ult': {
        // a sweep of light behind the caster plus the ability name
        const bandY = p.y - scale * 0.62;
        const h = 26;
        ctx.globalAlpha = Math.sin(U.clamp01(k * 2.2) * Math.PI) * 0.42;
        const g = ctx.createLinearGradient(0, bandY - h, 0, bandY + h);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, R.ELEMENTS[u.def.element].glow);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, bandY - h, View.w, h * 2);
        ctx.globalAlpha = U.clamp01(1 - (k - 0.45) / 0.55);
        ctx.font = '800 ' + Math.max(14, View.w * 0.044) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(16,10,28,0.85)';
        ctx.strokeText(f.name, View.w / 2, bandY + 6);
        ctx.fillStyle = '#fff6d8';
        ctx.fillText(f.name, View.w / 2, bandY + 6);
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  NS.BattleView = View;
})(window.COC);

/* Clash of Critters — render.js
 * Draws the arena and everything in it. The static parts (grass, river banks,
 * bridges, scenery) are baked into an offscreen canvas and only redrawn when
 * the viewport size changes.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const Art = NS.Art;
  const ARENA = NS.ARENA;

  const TEAM = {
    player: { main: '#4a8fe0', light: '#7fb8f5', dark: '#2c5fa8', name: 'You' },
    enemy: { main: '#e0566f', light: '#f58fa2', dark: '#a83248', name: 'Rival' },
  };

  /* Tower roofs, flags and health bars stick out well above the 18×32 play
   * field, so the viewport reserves extra tiles at the top and bottom.
   * Without this the king towers are sliced off at the screen edges. */
  const PAD_TOP = 1.0;
  const PAD_BOT = 0.2;

  /* Critter height in tiles for an art scale of 1.0. Roughly two tiles reads
   * best: big enough to identify at a glance, small enough that a full push
   * still fits on a phone screen. */
  const UNIT_SCALE = 1.95;

  /* Buildings are drawn in the same local space but are squatter, so they get
   * their own multiplier. */
  const BUILD_SCALE = 1.7;

  const Render = {
    canvas: null, ctx: null,
    bg: null, bgCtx: null,
    S: 20, ox: 0, oy: 0,
    dpr: 1,
    w: 0, h: 0,
    quality: 'high',
    shake: 0,
    _thumbs: {},
  };

  Render.attach = function (canvas) {
    Render.canvas = canvas;
    Render.ctx = canvas.getContext('2d');
    Render.bg = document.createElement('canvas');
    Render.bgCtx = Render.bg.getContext('2d');
  };

  Render.resize = function (cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, Render.quality === 'low' ? 1 : 2);
    // Re-baking the background is the expensive part; skip it when nothing moved.
    if (Render.w === cssW && Render.h === cssH && Render.dpr === dpr) return;
    Render.dpr = dpr;
    Render.w = cssW; Render.h = cssH;
    const c = Render.canvas;
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';

    const S = Math.min(cssW / ARENA.w, cssH / (ARENA.h + PAD_TOP + PAD_BOT));
    Render.S = S;
    Render.ox = (cssW - ARENA.w * S) / 2;
    Render.oy = (cssH - (ARENA.h + PAD_TOP + PAD_BOT) * S) / 2 + PAD_TOP * S;

    Render.bg.width = c.width;
    Render.bg.height = c.height;
    Render.bakeBackground();
  };

  Render.toWorld = function (px, py) {
    return { x: (px - Render.ox) / Render.S, y: (py - Render.oy) / Render.S };
  };
  Render.toScreen = function (wx, wy) {
    return { x: Render.ox + wx * Render.S, y: Render.oy + wy * Render.S };
  };

  // ------------------------------------------------------------- background
  Render.bakeBackground = function () {
    const ctx = Render.bgCtx;
    const S = Render.S, ox = Render.ox, oy = Render.oy, dpr = Render.dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, Render.w, Render.h);

    const X = (v) => ox + v * S;
    const Y = (v) => oy + v * S;

    /* The arena is 18×32, narrower than most screens, so there is always some
     * margin. Filling it with darker meadow instead of flat UI colour makes the
     * field read as part of a bigger world rather than a hole in the page. */
    const surround = ctx.createLinearGradient(0, 0, 0, Render.h);
    surround.addColorStop(0, '#2f5230');
    surround.addColorStop(0.5, '#3a6338');
    surround.addColorStop(1, '#2a4a2b');
    ctx.fillStyle = surround;
    ctx.fillRect(0, 0, Render.w, Render.h);

    const outRng = U.rng(4242);
    for (let i = 0; i < 90; i++) {
      const px = outRng.range(0, Render.w);
      const py = outRng.range(0, Render.h);
      if (px > X(-0.6) && px < X(ARENA.w + 0.6)) continue;
      ctx.globalAlpha = outRng.range(0.05, 0.16);
      ctx.fillStyle = outRng.chance(0.5) ? '#ffffff' : '#000000';
      ctx.beginPath();
      ctx.ellipse(px, py, S * outRng.range(0.3, 0.9), S * outRng.range(0.12, 0.34), 0, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // hedge running down both sides of the field
    [X(0), X(ARENA.w)].forEach((edgeX, side) => {
      const dir = side === 0 ? -1 : 1;
      for (let y = -1; y < Render.h + S; y += S * 0.7) {
        ctx.fillStyle = '#3d6b38';
        ctx.beginPath();
        ctx.arc(edgeX + dir * S * 0.42, y, S * 0.5, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(edgeX + dir * S * 0.55, y - S * 0.16, S * 0.2, 0, U.TAU);
        ctx.fill();
      }
    });

    // soft shadow under the playfield so it sits above the surround
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = S * 1.2;
    ctx.shadowOffsetY = S * 0.3;
    ctx.fillStyle = '#000';
    ctx.fillRect(X(0), Y(0), ARENA.w * S, ARENA.h * S);
    ctx.restore();

    // grass halves — slightly different tints so each side reads as "yours"/"theirs"
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(0), Y(0), ARENA.w * S, ARENA.h * S);
    ctx.clip();

    const gTop = ctx.createLinearGradient(0, Y(0), 0, Y(16));
    gTop.addColorStop(0, '#67a85a');
    gTop.addColorStop(1, '#77b862');
    ctx.fillStyle = gTop;
    ctx.fillRect(X(0), Y(0), ARENA.w * S, 16 * S);

    const gBot = ctx.createLinearGradient(0, Y(16), 0, Y(32));
    gBot.addColorStop(0, '#7cbd66');
    gBot.addColorStop(1, '#6aac58');
    ctx.fillStyle = gBot;
    ctx.fillRect(X(0), Y(16), ARENA.w * S, 16 * S);

    // mown checker pattern
    ctx.globalAlpha = 0.055;
    for (let ty = 0; ty < ARENA.h; ty += 2) {
      for (let tx = 0; tx < ARENA.w; tx += 2) {
        if (((tx / 2) + (ty / 2)) % 2 === 0) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(X(tx), Y(ty), 2 * S, 2 * S);
        }
      }
    }
    ctx.globalAlpha = 1;

    // grass tufts, deterministic so the field never flickers
    const rng = U.rng(20240731);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = Math.max(1, S * 0.05);
    ctx.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const x = rng.range(0.3, ARENA.w - 0.3);
      const y = rng.range(0.3, ARENA.h - 0.3);
      if (y > ARENA.riverTop - 0.4 && y < ARENA.riverBot + 0.4) continue;
      const hgt = rng.range(0.14, 0.3);
      ctx.beginPath();
      ctx.moveTo(X(x), Y(y));
      ctx.quadraticCurveTo(X(x + 0.06), Y(y - hgt * 0.6), X(x + rng.range(-0.1, 0.1)), Y(y - hgt));
      ctx.stroke();
    }

    // ---- river
    const rT = Y(ARENA.riverTop), rB = Y(ARENA.riverBot);
    const water = ctx.createLinearGradient(0, rT, 0, rB);
    water.addColorStop(0, '#3f8fc4');
    water.addColorStop(0.5, '#54a8dc');
    water.addColorStop(1, '#3f8fc4');
    ctx.fillStyle = water;
    ctx.fillRect(X(0), rT, ARENA.w * S, rB - rT);

    // banks
    ctx.fillStyle = '#e2cfa0';
    ctx.fillRect(X(0), rT - S * 0.22, ARENA.w * S, S * 0.22);
    ctx.fillRect(X(0), rB, ARENA.w * S, S * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(X(0), rT, ARENA.w * S, S * 0.12);

    // ---- bridges
    ARENA.bridges.forEach((bx) => {
      const bw = ARENA.bridgeHalf * 2 * S;
      const x0 = X(bx - ARENA.bridgeHalf);
      const y0 = rT - S * 0.5, y1 = rB + S * 0.5;
      ctx.fillStyle = '#a8794a';
      ctx.fillRect(x0, y0, bw, y1 - y0);
      ctx.fillStyle = '#c08d58';
      ctx.fillRect(x0 + S * 0.06, y0, bw - S * 0.12, y1 - y0);
      // planks
      ctx.strokeStyle = 'rgba(90,55,25,0.45)';
      ctx.lineWidth = Math.max(1, S * 0.06);
      const planks = 9;
      for (let i = 1; i < planks; i++) {
        const yy = y0 + ((y1 - y0) * i) / planks;
        ctx.beginPath();
        ctx.moveTo(x0 + S * 0.06, yy);
        ctx.lineTo(x0 + bw - S * 0.06, yy);
        ctx.stroke();
      }
      // rails
      ctx.fillStyle = '#8a5f36';
      ctx.fillRect(x0, y0, S * 0.13, y1 - y0);
      ctx.fillRect(x0 + bw - S * 0.13, y0, S * 0.13, y1 - y0);
    });

    // ---- scenery around the edges (never on the play lanes)
    const decoRng = U.rng(777);
    for (let i = 0; i < 34; i++) {
      const edge = decoRng.chance(0.5);
      const x = edge ? decoRng.range(0.35, 1.5) : decoRng.range(ARENA.w - 1.5, ARENA.w - 0.35);
      const y = decoRng.range(0.6, ARENA.h - 0.6);
      if (y > ARENA.riverTop - 1.2 && y < ARENA.riverBot + 1.2) continue;
      drawDeco(ctx, X(x), Y(y), S, decoRng);
    }

    // arena frame
    ctx.strokeStyle = 'rgba(20,14,32,0.55)';
    ctx.lineWidth = Math.max(2, S * 0.12);
    ctx.strokeRect(X(0), Y(0), ARENA.w * S, ARENA.h * S);
    ctx.restore();
    ctx.restore();
  };

  function drawDeco(ctx, x, y, S, rng) {
    const kind = rng.int(0, 2);
    ctx.save();
    ctx.translate(x, y);
    if (kind === 0) {
      // bush
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath(); ctx.ellipse(0, 0, S * 0.42, S * 0.16, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#4f8f45';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc((i - 1) * S * 0.22, -S * 0.22 - Math.abs(i - 1) * S * 0.04, S * 0.26, 0, U.TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(-S * 0.1, -S * 0.38, S * 0.1, 0, U.TAU); ctx.fill();
    } else if (kind === 1) {
      // rock
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath(); ctx.ellipse(0, 0, S * 0.3, S * 0.12, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#9aa0ad';
      ctx.beginPath();
      ctx.moveTo(-S * 0.26, 0); ctx.lineTo(-S * 0.16, -S * 0.3);
      ctx.lineTo(S * 0.1, -S * 0.34); ctx.lineTo(S * 0.27, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(-S * 0.16, -S * 0.3); ctx.lineTo(S * 0.1, -S * 0.34); ctx.lineTo(S * 0.02, -S * 0.18);
      ctx.closePath(); ctx.fill();
    } else {
      // flowers
      const cols = ['#ffd45e', '#ff9ec4', '#c8a6ff'];
      const col = cols[rng.int(0, 2)];
      for (let i = 0; i < 3; i++) {
        const fx = (i - 1) * S * 0.2, fy = -Math.abs(i - 1) * S * 0.08;
        ctx.strokeStyle = '#4f8f45';
        ctx.lineWidth = Math.max(1, S * 0.04);
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - S * 0.2); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(fx, fy - S * 0.24, S * 0.09, 0, U.TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- frame
  Render.draw = function (battle, view) {
    const ctx = Render.ctx;
    const S = Render.S, ox = Render.ox, oy = Render.oy;
    const t = battle.time;
    ctx.save();
    ctx.scale(Render.dpr, Render.dpr);

    let shakeX = 0, shakeY = 0;
    if (Render.shake > 0) {
      Render.shake = Math.max(0, Render.shake - 0.02);
      shakeX = (Math.random() - 0.5) * Render.shake * S * 0.5;
      shakeY = (Math.random() - 0.5) * Render.shake * S * 0.5;
    }
    ctx.translate(shakeX, shakeY);

    ctx.drawImage(Render.bg, 0, 0, Render.w, Render.h);

    const X = (v) => ox + v * S;
    const Y = (v) => oy + v * S;

    // animated water shimmer
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(0), Y(ARENA.riverTop), ARENA.w * S, (ARENA.riverBot - ARENA.riverTop) * S);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = Math.max(1, S * 0.07);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const yy = Y(ARENA.riverTop + 0.28 + i * 0.42);
      for (let x = 0; x <= ARENA.w; x += 0.5) {
        const px = X(x);
        const py = yy + Math.sin(x * 1.1 + t * 1.6 + i * 1.7) * S * 0.06;
        if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    // the shimmer is clipped to the river rect, which includes the bridge decks,
    // so stamp the baked bridges back over the top
    const bTop = Y(ARENA.riverTop) - S * 0.6;
    const bH = (ARENA.riverBot - ARENA.riverTop) * S + S * 1.2;
    ARENA.bridges.forEach((bx) => {
      const bx0 = X(bx - ARENA.bridgeHalf);
      const bw = ARENA.bridgeHalf * 2 * S;
      ctx.drawImage(Render.bg,
        bx0 * Render.dpr, bTop * Render.dpr, bw * Render.dpr, bH * Render.dpr,
        bx0, bTop, bw, bH);
    });

    // deploy zone hint while dragging a card
    if (view && view.dragging) {
      drawDeployZone(ctx, battle, view);
    }

    // ---- collect drawables
    const ground = [];
    const air = [];
    for (const e of battle.entities) {
      if (e.dead) continue;
      (e.flying ? air : ground).push(e);
    }
    ground.sort((a, b) => a.y - b.y);
    air.sort((a, b) => a.y - b.y);

    // pending deploy markers
    for (const p of battle.pending) {
      drawPendingMarker(ctx, p, t);
    }

    // aura circles
    for (const a of battle.auras) {
      ctx.save();
      ctx.globalAlpha = 0.18 * U.clamp01(a.left / 0.5);
      ctx.fillStyle = '#ffd05e';
      ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), a.r * S, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    // shadows first so nothing casts over a neighbour's body
    for (const e of ground) {
      Art.shadow(ctx, X(e.x), Y(e.y), e.radius * S * 0.9, 0.2);
    }
    for (const e of air) {
      Art.shadow(ctx, X(e.x), Y(e.y), e.radius * S * 0.7, 0.13);
    }

    for (const e of ground) drawEntity(ctx, e, t, view);
    for (const p of battle.projectiles) drawProjectile(ctx, p, t);
    for (const e of air) drawEntity(ctx, e, t, view);

    // health bars on top of everything
    for (const e of ground) drawHealth(ctx, e);
    for (const e of air) drawHealth(ctx, e);

    // effects
    for (const f of battle.fx) drawFx(ctx, f, t);

    // placement cursor
    if (view && view.dragging && view.cursor) {
      drawPlacementCursor(ctx, battle, view);
    }

    ctx.restore();
  };

  function drawDeployZone(ctx, battle, view) {
    const S = Render.S, ox = Render.ox, oy = Render.oy;
    const X = (v) => ox + v * S, Y = (v) => oy + v * S;
    const card = view.dragging.card;
    ctx.save();
    if (card.kind === 'spell' || card.deployAnywhere) {
      ctx.fillStyle = 'rgba(120,220,255,0.10)';
      ctx.fillRect(X(0), Y(0), ARENA.w * S, ARENA.h * S);
    } else {
      const z = battle.deployZone('player');
      ctx.fillStyle = 'rgba(120,255,160,0.13)';
      ctx.fillRect(X(0), Y(z.halfY), ARENA.w * S, (ARENA.h - z.halfY) * S);
      if (z.leftOpen) ctx.fillRect(X(0), Y(z.minY), 9 * S, (z.halfY - z.minY) * S);
      if (z.rightOpen) ctx.fillRect(X(9), Y(z.minY), 9 * S, (z.halfY - z.minY) * S);
      ctx.strokeStyle = 'rgba(160,255,190,0.55)';
      ctx.setLineDash([S * 0.4, S * 0.3]);
      ctx.lineWidth = Math.max(2, S * 0.08);
      ctx.beginPath();
      ctx.moveTo(X(0), Y(z.halfY)); ctx.lineTo(X(ARENA.w), Y(z.halfY));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawPlacementCursor(ctx, battle, view) {
    const S = Render.S;
    const p = Render.toScreen(view.cursor.x, view.cursor.y);
    const card = view.dragging.card;
    const ok = battle.canDeploy('player', card.id, view.cursor.x, view.cursor.y).ok;
    const col = ok ? '#8effa8' : '#ff8080';
    ctx.save();
    ctx.translate(p.x, p.y);
    const r = (card.kind === 'spell' ? card.spell.radius : 1.0) * S;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2, S * 0.09);
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.5, 0, 0, U.TAU); ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.5, 0, 0, U.TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // ghost of the critter being placed
    if (card.kind !== 'spell') {
      ctx.globalAlpha = 0.55;
      if (card.kind === 'building') Art.building(ctx, card.art, { t: 0, scale: S * BUILD_SCALE });
      else Art.critter(ctx, card.art, { t: 0, scale: S * UNIT_SCALE, moving: false, teamColor: TEAM.player.main });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawPendingMarker(ctx, p, t) {
    const S = Render.S;
    const s = Render.toScreen(p.x, p.y);
    const prog = 1 - p.left / p.total;
    ctx.save();
    ctx.translate(s.x, s.y);
    const col = p.team === 'player' ? TEAM.player.light : TEAM.enemy.light;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2, S * 0.1);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 0.85, S * 0.42, 0, -Math.PI / 2, -Math.PI / 2 + U.TAU * prog);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, S * 0.85, S * 0.42, 0, 0, U.TAU); ctx.fill();
    // rising sparkles
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * U.TAU + t * 3;
      const rr = S * 0.6;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.5 - prog * S * 0.5, S * 0.07, 0, U.TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEntity(ctx, e, t, view) {
    const S = Render.S;
    const s = Render.toScreen(e.x, e.y);
    const team = TEAM[e.team];
    ctx.save();
    ctx.translate(s.x, s.y);

    if (e.etype === 'tower') {
      Art.tower(ctx, {
        kind: e.towerKind, team: e.team, t, scale: S,
        activated: e.activated, hpFrac: e.hp / e.maxHp,
      });
    } else if (e.etype === 'building') {
      Art.building(ctx, e.card.art, { t, scale: S * BUILD_SCALE, aim: aimAngle(e) });
    } else {
      let hop = 0;
      if (e.hopT > 0) hop = -Math.sin(e.hopT * Math.PI) * S * 1.1;
      ctx.translate(0, hop);
      if (e.facing < 0) ctx.scale(-1, 1);
      Art.critter(ctx, e.card.art, {
        t, scale: S * UNIT_SCALE,
        walk: e.walkPhase,
        moving: e.moving,
        attack: e.attackAnim,
        flying: e.flying,
        teamColor: team.main,
      });
    }

    // status tints
    const frozen = e.frozenUntil > t;
    if (e.hurtFlash > 0 || frozen || e.healFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      if (e.hurtFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (e.hurtFlash / 0.16) * 0.6 + ')';
        ctx.fillRect(-S * 3, -S * 5, S * 6, S * 6);
      }
      if (frozen) {
        ctx.fillStyle = 'rgba(140,220,255,0.55)';
        ctx.fillRect(-S * 3, -S * 5, S * 6, S * 6);
      }
      if (e.healFlash > 0) {
        ctx.fillStyle = 'rgba(120,255,160,0.35)';
        ctx.fillRect(-S * 3, -S * 5, S * 6, S * 6);
      }
      ctx.restore();
    }
    if (frozen) {
      ctx.strokeStyle = 'rgba(220,245,255,0.9)';
      ctx.lineWidth = Math.max(1, S * 0.06);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * U.TAU + 0.4;
        const rr = S * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rr, -S * 0.5 + Math.sin(a) * rr * 0.6);
        ctx.lineTo(Math.cos(a) * rr * 1.5, -S * 0.5 + Math.sin(a) * rr * 0.9);
        ctx.stroke();
      }
    }
    if (e.stunUntil > t && !frozen) {
      ctx.save();
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = Math.max(1, S * 0.07);
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + (i / 3) * U.TAU;
        ctx.beginPath();
        ctx.arc(0, -S * 1.5, S * 0.4, a, a + 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (e.poison) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#b06ad0';
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * S * 0.35, -S * 0.9 - ((t * 1.2 + i * 0.4) % 1) * S * 0.7, S * 0.08, 0, U.TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function aimAngle(e) {
    if (!e.target || e.target.dead) return -0.6;
    return U.angle(e.x, e.y, e.target.x, e.target.y) - Math.PI / 2;
  }

  function drawHealth(ctx, e) {
    if (e.hp >= e.maxHp && e.etype !== 'tower') return;
    const S = Render.S;
    const s = Render.toScreen(e.x, e.y);
    const isTower = e.etype === 'tower';
    const w = isTower ? S * (e.towerKind === 'king' ? 2.5 : 2.1) : Math.max(S * 0.9, e.radius * S * 2.2);
    const h = isTower ? Math.max(6, S * 0.34) : Math.max(4, S * 0.2);
    // Sit the bar just above the model, which grows with its art scale.
    const artScale = (e.card && e.card.art && e.card.art.scale) || 1;
    const bodyTop = e.etype === 'building'
      ? artScale * BUILD_SCALE * 0.72 + 0.25
      : artScale * UNIT_SCALE + (e.flying ? 0.34 * UNIT_SCALE : 0) + 0.3;
    const yOff = isTower
      ? -(e.towerKind === 'king' ? 2.7 : 2.15) * S
      : -bodyTop * S;
    const x = s.x - w / 2, y = s.y + yOff;
    const frac = U.clamp01(e.hp / e.maxHp);
    const team = TEAM[e.team];

    ctx.save();
    ctx.fillStyle = 'rgba(18,12,28,0.75)';
    roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, h * 0.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, x, y, w, h, h * 0.5);
    ctx.fill();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, team.light);
    g.addColorStop(1, team.main);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, Math.max(2, w * frac), h, h * 0.5);
    ctx.fill();
    if (isTower) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '700 ' + Math.max(9, S * 0.42) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(e.hp), s.x, y + h / 2 + 0.5);
    }
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
  Render.roundRect = roundRect;

  function drawProjectile(ctx, p, t) {
    const S = Render.S;
    const s = Render.toScreen(p.x, p.y);
    ctx.save();
    ctx.translate(s.x, s.y - (p.z || 0) * S);
    const a = p.angle || 0;
    if (p.kind === 'arrow' || p.kind === 'dart') {
      ctx.rotate(a);
      ctx.strokeStyle = '#e8dcc0';
      ctx.lineWidth = Math.max(1.5, S * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-S * 0.35, 0); ctx.lineTo(S * 0.2, 0); ctx.stroke();
      ctx.fillStyle = '#b9c4d6';
      ctx.beginPath();
      ctx.moveTo(S * 0.32, 0); ctx.lineTo(S * 0.14, -S * 0.09); ctx.lineTo(S * 0.14, S * 0.09);
      ctx.closePath(); ctx.fill();
    } else if (p.kind === 'fire') {
      const r = S * 0.24;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
      g.addColorStop(0, 'rgba(255,235,150,1)');
      g.addColorStop(0.45, 'rgba(255,150,60,0.95)');
      g.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, U.TAU); ctx.fill();
    } else if (p.kind === 'bomb') {
      ctx.fillStyle = '#3b3450';
      ctx.beginPath(); ctx.arc(0, 0, S * 0.22, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#ffd05e';
      ctx.lineWidth = Math.max(1, S * 0.06);
      ctx.beginPath(); ctx.moveTo(0, -S * 0.2); ctx.lineTo(S * 0.1, -S * 0.36); ctx.stroke();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(S * 0.12, -S * 0.38, S * 0.07 * (1 + Math.sin(t * 30) * 0.3), 0, U.TAU); ctx.fill();
    } else if (p.kind === 'spore') {
      ctx.fillStyle = 'rgba(200,140,220,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, S * 0.2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(240,200,255,0.7)';
      ctx.beginPath(); ctx.arc(-S * 0.07, -S * 0.07, S * 0.08, 0, U.TAU); ctx.fill();
    } else if (p.kind === 'petal') {
      ctx.rotate(t * 6);
      ctx.fillStyle = '#ff9ec4';
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate((i / 4) * U.TAU);
        ctx.beginPath(); ctx.ellipse(0, -S * 0.14, S * 0.08, S * 0.15, 0, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
    } else if (p.kind === 'sting') {
      ctx.rotate(a);
      ctx.fillStyle = '#ffd05e';
      ctx.beginPath();
      ctx.moveTo(S * 0.28, 0); ctx.lineTo(-S * 0.16, -S * 0.1); ctx.lineTo(-S * 0.16, S * 0.1);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = '#4a4a5c';
      ctx.beginPath(); ctx.arc(0, 0, S * 0.2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(-S * 0.06, -S * 0.06, S * 0.07, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- fx
  function drawFx(ctx, f, time) {
    const S = Render.S;
    const s = Render.toScreen(f.x, f.y);
    const k = U.clamp01(f.t / f.life);
    ctx.save();
    ctx.translate(s.x, s.y);

    switch (f.type) {
      case 'dmg': {
        const rise = U.easeOut(k);
        ctx.globalAlpha = 1 - k * k;
        ctx.translate(0, -rise * S * 1.4);
        ctx.font = '800 ' + Math.max(11, S * 0.62) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = Math.max(2, S * 0.14);
        ctx.strokeStyle = 'rgba(20,12,30,0.85)';
        ctx.strokeText('-' + f.v, 0, 0);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillText('-' + f.v, 0, 0);
        break;
      }
      case 'poof': {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * U.TAU;
          const r = k * S * 0.9;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.5, S * 0.16 * (1 - k), 0, U.TAU);
          ctx.fill();
        }
        break;
      }
      case 'impact': {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#fff3d0';
        ctx.lineWidth = Math.max(1.5, S * 0.1);
        ctx.beginPath(); ctx.arc(0, 0, S * (0.2 + k * 0.45), 0, U.TAU); ctx.stroke();
        break;
      }
      case 'boom': {
        ctx.globalAlpha = (1 - k) * 0.85;
        const r = f.r * S * (0.5 + k * 0.7);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(255,240,180,0.9)');
        g.addColorStop(0.6, 'rgba(255,150,60,0.6)');
        g.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, U.TAU); ctx.fill();
        break;
      }
      case 'die': {
        ctx.globalAlpha = 1 - k;
        ctx.translate(0, -k * S * 0.4);
        ctx.scale(1 + k * 0.3, 1 + k * 0.3);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * U.TAU + (f.spec ? f.spec.seed || 0 : 0);
          const r = k * S * 1.1;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r, -S * 0.4 + Math.sin(a) * r * 0.6, S * 0.14 * (1 - k), 0, U.TAU);
          ctx.fill();
        }
        break;
      }
      case 'towerBoom': {
        ctx.globalAlpha = 1 - k;
        const r = S * (1 + k * 3.2);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(255,255,220,0.95)');
        g.addColorStop(0.5, 'rgba(255,170,80,0.7)');
        g.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, -S, r, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(90,80,110,0.9)';
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * U.TAU;
          const rr = k * S * 3;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * rr, -S + Math.sin(a) * rr * 0.7 + k * k * S * 2, S * 0.25 * (1 - k), 0, U.TAU);
          ctx.fill();
        }
        break;
      }
      case 'deployRing': {
        break; // handled by drawPendingMarker
      }
      case 'cast': {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#c8e8ff';
        ctx.lineWidth = Math.max(2, S * 0.12);
        ctx.beginPath(); ctx.arc(0, 0, S * (0.4 + k * 1.4), 0, U.TAU); ctx.stroke();
        break;
      }
      case 'bolt': {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#fff0a0';
        ctx.lineWidth = Math.max(2, S * 0.16);
        ctx.beginPath();
        let yy = -S * 9;
        ctx.moveTo(0, yy);
        for (let i = 0; i < 5; i++) {
          yy += S * 1.8;
          ctx.lineTo((Math.random() - 0.5) * S * 0.9, yy);
        }
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(1, S * 0.07);
        ctx.stroke();
        break;
      }
      case 'spell': {
        drawSpellFx(ctx, f, k, S);
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  function drawSpellFx(ctx, f, k, S) {
    const delayK = U.clamp01(f.t / f.delay);
    const after = f.t > f.delay ? U.clamp01((f.t - f.delay) / (f.life - f.delay)) : -1;
    const R = f.r * S;

    // telegraph ring while the spell is inbound
    if (after < 0) {
      ctx.globalAlpha = 0.35 + Math.sin(f.t * 22) * 0.12;
      ctx.strokeStyle = f.visual === 'ice' ? '#a8e6ff' : f.visual === 'heal' ? '#ffe08a' : '#ffb37a';
      ctx.lineWidth = Math.max(2, S * 0.12);
      ctx.setLineDash([S * 0.35, S * 0.25]);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, R * delayK, 0, U.TAU); ctx.fill();
      return;
    }

    ctx.globalAlpha = 1 - after;
    if (f.visual === 'fire') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * (0.6 + after * 0.7));
      g.addColorStop(0, 'rgba(255,250,200,0.95)');
      g.addColorStop(0.4, 'rgba(255,160,60,0.8)');
      g.addColorStop(1, 'rgba(200,60,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, R * (0.6 + after * 0.7), 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,190,90,0.8)';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * U.TAU;
        const rr = R * (0.3 + after * 1.0);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.7, R * 0.18 * (1 - after), 0, U.TAU);
        ctx.fill();
      }
    } else if (f.visual === 'ice') {
      ctx.fillStyle = 'rgba(150,225,255,0.45)';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(230,250,255,0.9)';
      ctx.lineWidth = Math.max(1.5, S * 0.09);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * U.TAU;
        const rr = R * (0.35 + (i % 3) * 0.2);
        ctx.save();
        ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr * 0.75);
        ctx.rotate(a);
        for (let j = 0; j < 3; j++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath(); ctx.moveTo(-S * 0.25, 0); ctx.lineTo(S * 0.25, 0); ctx.stroke();
        }
        ctx.restore();
      }
    } else if (f.visual === 'arrows') {
      ctx.strokeStyle = '#f2e6c8';
      ctx.lineWidth = Math.max(1.5, S * 0.08);
      ctx.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * U.TAU + i;
        const rr = R * (0.15 + ((i * 7) % 10) / 10 * 0.85);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.8;
        const drop = (1 - after) * S * 2.2;
        ctx.beginPath();
        ctx.moveTo(px, py - drop);
        ctx.lineTo(px + S * 0.12, py - drop + S * 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(1, S * 0.06);
      ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.8, 0, 0, U.TAU); ctx.stroke();
    } else if (f.visual === 'heal') {
      ctx.fillStyle = 'rgba(255,215,110,0.30)';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,180,0.95)';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * U.TAU;
        const rise = ((after * 2 + i / 8) % 1);
        const rr = R * 0.7;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.6 - rise * S * 2, S * 0.13 * (1 - rise), 0, U.TAU);
        ctx.fill();
      }
    } else if (f.visual === 'zap') {
      ctx.strokeStyle = '#bfe9ff';
      ctx.lineWidth = Math.max(2, S * 0.1);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * U.TAU;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        let px = 0, py = 0;
        for (let j = 0; j < 3; j++) {
          px += Math.cos(a) * R / 3 + (Math.random() - 0.5) * S * 0.4;
          py += Math.sin(a) * R / 3 * 0.8 + (Math.random() - 0.5) * S * 0.4;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(180,235,255,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, R * (0.5 + after * 0.6), 0, U.TAU); ctx.fill();
    } else if (f.visual === 'lightning') {
      ctx.fillStyle = 'rgba(200,190,255,0.28)';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, U.TAU); ctx.fill();
    }
  }

  // ------------------------------------------------------------- thumbnails
  /** Render a card's critter into a cached canvas for use in the UI. */
  Render.cardThumb = function (card, size) {
    const key = card.id + '@' + size;
    if (Render._thumbs[key]) return Render._thumbs[key];
    const c = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.save();
    ctx.translate(size / 2, size * 0.86);
    const s = size * 0.52;
    if (card.kind === 'building') {
      Art.building(ctx, card.art, { t: 0, scale: s * 1.1, aim: -0.7 });
    } else {
      Art.critter(ctx, card.art, {
        t: 0.3, scale: s, moving: false,
        flying: !!card.air,
      });
    }
    ctx.restore();
    Render._thumbs[key] = c;
    return c;
  };

  Render.TEAM = TEAM;
  NS.Render = Render;
})(window.COC);

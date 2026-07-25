/* =========================================================================
   NORBERT, UNFINISHED  --  ui.js
   Title, HUD, chapter cards, pause, credits, and the on-screen buttons for
   anybody playing this on a phone.
   ========================================================================= */

const UI = {
  tip: null, tipT: 0,
  cardT: 0, card: null,
  toastEyes: 0,
};

/* ---- shared bits ------------------------------------------------------ */

/* A word pressed out of clay, letter by letter. Used for every big heading. */
function clayHeading(ctx, str, x, y, size, color, seed, spread) {
  ctx.save();
  ctx.font = '800 ' + size + 'px ' + UI_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let total = 0;
  const ws = [];
  for (const ch of str) { const w = ctx.measureText(ch).width * (spread || 1); ws.push(w); total += w; }
  let cx = x - total / 2;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const w = ws[i];
    if (ch !== ' ') {
      const h = seed + i * 7.31;
      const rot = shash1(h) * 0.075 + shash1(h + Clay.frame * 0.017) * 0.012;
      const oy = shash1(h + 9) * size * 0.05 + shash1(h + Clay.frame * 0.019) * 0.5;
      ctx.save();
      ctx.translate(cx + w / 2, y + oy);
      ctx.rotate(rot);
      /* drop shadow */
      ctx.fillStyle = 'rgba(28,12,26,0.45)';
      ctx.fillText(ch, -w / 2 + size * 0.045, size * 0.05);
      /* dark bed */
      ctx.fillStyle = coolShade(color, 0.5);
      ctx.fillText(ch, -w / 2 + size * 0.018, size * 0.022);
      /* body */
      ctx.fillStyle = color;
      ctx.fillText(ch, -w / 2, 0);
      /* light catching the top-left of the letter */
      ctx.save();
      ctx.beginPath();
      ctx.rect(-w, -size, w * 2, size * 0.55);
      ctx.clip();
      ctx.fillStyle = warmLight(color, 0.42);
      ctx.fillText(ch, -w / 2 - size * 0.012, -size * 0.016);
      ctx.restore();
      ctx.restore();
    }
    cx += w;
  }
  ctx.restore();
}

function softText(ctx, str, x, y, size, color, align, weight) {
  ctx.save();
  ctx.font = (weight || '600') + ' ' + size + 'px ' + UI_FONT;
  ctx.textAlign = align || 'center';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/* ---- HUD -------------------------------------------------------------- */

function drawHUD(ctx, G, W, H) {
  const p = G.player;
  if (!p) return;

  /* the mass meter: your actual body, in the corner, going down */
  const x0 = 20, y0 = 24;
  for (let i = 0; i < p.capMass; i++) {
    const x = x0 + i * 24;
    const owned = i < p.maxMass;
    const held = i < p.mass;
    ctx.save();
    if (!owned) {
      /* given away for good -- an empty dent where a piece used to be */
      ctx.globalAlpha = 0.5;
      Clay.dent(ctx, x, y0, 8.5, 8, 0.2, '#4a3a44');
      ctx.strokeStyle = 'rgba(255,236,210,0.22)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y0, 8.5, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    } else if (held) {
      Clay.blob(ctx, {
        x, y: y0, rx: 9.5, ry: 9, seed: 200 + i, color: p.paint ? mixHex(NB_SKIN, p.paint, 0.8) : NB_SKIN,
        wob: 0.16, boil: 0.6, prints: 1,
      });
    } else {
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = rgba(NB_SKIN, 0.8);
      ctx.lineWidth = 1.6;
      Clay.blobPath(ctx, x, y0, 8.5, 8, 200 + i, 0.16, 0, 0.5, 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* googly eyes found */
  if (G.eyes > 0) {
    const ex = W - 34;
    Clay.googlyEye(ctx, ex, 24, 9, Math.sin(G.t * 2) * 0.6, Math.cos(G.t * 1.6) * 0.5);
    softText(ctx, '×' + G.eyes, ex - 16, 29, 13, '#ffeccb', 'right', '700');
  }

  /* the clock, ticking towards nine */
  const lv = G.level;
  if (lv && lv.data.clock) {
    softText(ctx, lv.data.clock, W / 2, 26, 12, 'rgba(255,236,206,0.55)', 'center', '700');
  }

  /* dissolve warning */
  if (p.dissolve > 0.12) {
    ctx.save();
    ctx.globalAlpha = clamp(p.dissolve, 0, 1) * 0.5;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, 'rgba(120,180,210,0)');
    g.addColorStop(1, 'rgba(120,180,210,0.9)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* tip toast */
  if (UI.tipT > 0) {
    const a = clamp(UI.tipT, 0, 1) * clamp((UI.tipMax - UI.tipT) * 4, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '700 13px ' + UI_FONT;
    const w = ctx.measureText(UI.tip).width + 40;
    const bx = W / 2 - w / 2, by = H - 74;
    Clay.blobPath(ctx, W / 2, by + 15, w / 2, 17, 33, 0.05, 0, 0.2, 24);
    Clay.material(ctx, { x: bx, y: by, w: w, h: 34 }, '#e8dfc9', { seed: 33, prints: 6, markSize: 4, ao: false, spec: false });
    ctx.fillStyle = '#4a3830';
    jitterText(ctx, UI.tip, bx + 20, by + 20, 5, 0.5);
    ctx.restore();
  }

  /* chapter card */
  if (UI.card) drawChapterCard(ctx, W, H);
}

function drawChapterCard(ctx, W, H) {
  const c = UI.card;
  const t = c.t;
  const inA = smootherstep(clamp(t / 0.7, 0, 1));
  const outA = 1 - smootherstep(clamp((t - c.hold) / 0.7, 0, 1));
  const a = Math.min(inA, outA);
  if (a <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = a;
  /* a strip of card stock laid across the screen */
  const bh = 116;
  const by = H / 2 - bh / 2;
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    pts.push({ x: -20 + u * (W + 40), y: by + (fbm1(u * 7, 3, 2) - 0.5) * 6 });
  }
  for (let i = 40; i >= 0; i--) {
    const u = i / 40;
    pts.push({ x: -20 + u * (W + 40), y: by + bh + (fbm1(u * 6 + 30, 4, 2) - 0.5) * 6 });
  }
  ctx.save();
  ctx.shadowColor = 'rgba(10,4,16,0.6)'; ctx.shadowBlur = 24;
  Clay.slab(ctx, pts, '#2b2033', { seed: 8, prints: 60, markSize: 6, vert: true, vertH: bh, ao: false, spec: false });
  ctx.restore();

  const slide = (1 - inA) * 26;
  softText(ctx, 'CHAPTER ' + c.chapter, W / 2, by + 40 - slide, 13, 'rgba(255,214,160,0.75)', 'center', '700');
  clayHeading(ctx, c.title.toUpperCase(), W / 2, by + 80 - slide * 0.5, 34, '#e0b473', 21, 1.02);
  softText(ctx, c.clock, W / 2, by + 106, 12, 'rgba(255,236,206,0.5)', 'center', '600');
  ctx.restore();
}

/* ---- title ------------------------------------------------------------ */

function drawTitle(ctx, G, W, H) {
  const t = G.t;
  setClayLight(THEMES.sill.key, THEMES.sill.shadow);
  THEMES.sill.back(ctx, { x: 260 + Math.sin(t * 0.1) * 30, y: 0 }, W, H, t);

  /* a sill for him to stand on, low enough to leave room for the menu */
  const SILL = H - 50;
  const pts = [];
  for (let i = 0; i <= 34; i++) {
    const u = i / 34;
    pts.push({ x: -20 + u * (W + 40), y: SILL + (fbm1(u * 9 + 2, 6, 3) - 0.5) * 7 });
  }
  pts.push({ x: W + 20, y: H + 30 }, { x: -20, y: H + 30 });
  if (!G._titleShape) G._titleShape = Clay.makeShape(pts, 8);
  Clay.terrain(ctx, G._titleShape, { color: '#cfc4b0', top: '#e6dcc6', seed: 3, vertH: 90 });

  /* Norbert, waiting on the right, with Beans, who turned up */
  const nx = W * 0.775;
  drawNorbert(ctx, G.titleRig, nx, SILL - 2);
  CAST.beans(ctx, { t: t, seed: 3, facing: -1, scale: 0.8, talk: 0, hoppy: false }, nx + 52, SILL);

  /* the title */
  const bounce = Math.sin(t * 1.1) * 1.8;
  clayHeading(ctx, 'NORBERT,', W / 2, H * 0.255 + bounce, 53, '#d9793f', 11, 1.03);
  clayHeading(ctx, 'UNFINISHED', W / 2, H * 0.405 + bounce * 0.7, 53, '#c9603a', 27, 1.03);
  softText(ctx, 'a very short adventure about not being ready', W / 2, H * 0.478, 12, 'rgba(255,232,200,0.75)', 'center', '600');

  /* menu, over on the left so it never fights the character */
  const mx = W * 0.30;
  for (let i = 0; i < G.menu.length; i++) {
    const sel = i === G.menuIdx;
    const y = H * 0.552 + i * 27;
    ctx.save();
    ctx.globalAlpha = sel ? 1 : 0.6;
    if (sel) {
      ctx.save();
      ctx.translate(Math.sin(t * 5) * 1.4, 0);
      Clay.blob(ctx, { x: mx - 78, y: y - 5, rx: 7, ry: 6.5, seed: 66, color: '#d9793f', wob: 0.22, boil: 0.7, prints: 0 });
      ctx.restore();
    }
    softText(ctx, G.menu[i], mx, y, sel ? 20 : 17, sel ? '#ffe9c4' : '#c8b6a6', 'center', '700');
    ctx.restore();
  }

  softText(ctx, '\u2191 \u2193 choose    SPACE / ENTER select', mx, H * 0.552 + G.menu.length * 27 + 2, 10, 'rgba(255,232,200,0.42)', 'center', '600');
  softText(ctx, 'v1.0  \u00b7  no sprites, no textures, no audio files', W - 12, H - 10, 9, 'rgba(255,232,200,0.3)', 'right', '600');

  Clay.grain(ctx, W, H, 0.14);
  Clay.vignette(ctx, W, H, 0.44, '#1b1430');
}

/* ---- pause ------------------------------------------------------------ */

function drawPause(ctx, G, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(18,8,22,0.62)';
  ctx.fillRect(0, 0, W, H);
  clayHeading(ctx, 'PAUSED', W / 2, H / 2 - 58, 36, '#d9a05f', 5, 1.04);
  const items = G.pauseMenu;
  for (let i = 0; i < items.length; i++) {
    const sel = i === G.pauseIdx;
    softText(ctx, items[i], W / 2, H / 2 - 6 + i * 27, sel ? 18 : 16,
      sel ? '#ffe9c4' : 'rgba(220,204,186,0.6)', 'center', '700');
    if (sel) {
      Clay.blob(ctx, { x: W / 2 - 86, y: H / 2 - 11 + i * 27, rx: 6, ry: 5.5, seed: 67, color: '#d9793f', wob: 0.22, boil: 0.7, prints: 0 });
    }
  }
  softText(ctx, 'MOVE  ← →      JUMP  SPACE      SQUASH  ↓      STRETCH  ↑', W / 2, H - 56, 11, 'rgba(255,232,200,0.42)', 'center', '600');
  softText(ctx, 'TEAR OFF A PIECE  J / Z   SLURP IT BACK  K / X   TALK  E', W / 2, H - 34, 10.5, 'rgba(255,232,200,0.42)', 'center', '600');
  ctx.restore();
}

/* ---- ending / credits -------------------------------------------------- */

function drawEnding(ctx, G, W, H) {
  const t = G.endT;
  setClayLight('#ffcf9a', '#2a1420');
  ctx.fillStyle = '#12101c';
  ctx.fillRect(0, 0, W, H);

  /* warm pocket-light */
  const g = ctx.createRadialGradient(W / 2, H * 0.52, 20, W / 2, H * 0.52, W * 0.6);
  g.addColorStop(0, 'rgba(120,72,48,0.55)');
  g.addColorStop(1, 'rgba(20,10,20,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  /* fabric weave of the inside of a coat pocket */
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#6a4a3a';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 7) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.05 + y * 0.3) * 2);
    ctx.stroke();
  }
  ctx.restore();

  const n = G.endRig;
  drawNorbert(ctx, n, W / 2, H * 0.66);

  const lines = G.endLines;
  for (let i = 0; i < lines.length; i++) {
    const lt = t - 1.0 - i * 2.4;
    if (lt < 0) continue;
    const a = clamp(lt / 0.9, 0, 1) * (1 - clamp((lt - 6.5) / 1.2, 0, 1));
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    softText(ctx, lines[i], W / 2, 74 + i * 26, 15, '#f0dcc0', 'center', '600');
    ctx.restore();
  }

  if (t > G.endLines.length * 2.4 + 3) {
    const a = clamp((t - G.endLines.length * 2.4 - 3) / 1.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    clayHeading(ctx, 'NORBERT, UNFINISHED', W / 2, H * 0.30, 34, '#d9793f', 11, 1.02);
    softText(ctx, '— and staying that way —', W / 2, H * 0.30 + 26, 13, 'rgba(255,224,190,0.7)', 'center', '600');
    ctx.restore();
  }

  Clay.grain(ctx, W, H, 0.16);
  Clay.vignette(ctx, W, H, 0.55, '#0a0610');
}

function drawCredits(ctx, G, W, H) {
  ctx.fillStyle = '#141020';
  ctx.fillRect(0, 0, W, H);
  THEMES.dawn.back(ctx, { x: G.t * 8, y: 0 }, W, H, G.t);
  ctx.fillStyle = 'rgba(14,10,22,0.55)';
  ctx.fillRect(0, 0, W, H);

  const scroll = G.credT * 26;
  const lines = CREDITS;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const y = H + 30 + i * 26 - scroll;
    if (y < -40 || y > H + 40) continue;
    if (l.startsWith('#')) clayHeading(ctx, l.slice(1), W / 2, y, 24, '#e0b473', i * 3, 1.02);
    else if (l === '') continue;
    else softText(ctx, l, W / 2, y, 13, 'rgba(250,236,214,0.85)', 'center', '600');
  }
  if (scroll > lines.length * 26 + H - 60) {
    softText(ctx, 'press SPACE', W / 2, H - 30, 12, 'rgba(255,232,200,0.5)', 'center', '700');
  }
  Clay.grain(ctx, W, H, 0.13);
  Clay.vignette(ctx, W, H, 0.4, '#1a1020');
}

const CREDITS = [
  '#NORBERT, UNFINISHED',
  '',
  'a very short adventure',
  'about not being ready',
  '',
  '#THE CAST',
  'NORBERT ..... one lump of terracotta',
  'GARY ..... a pinecone, Mayor (self-appointed)',
  'MME. PIPPA ..... chenille, one leg, one sequin',
  'STEVE ..... fired. handle on the inside.',
  'BEANS ..... beans',
  'GLAZE ..... porcelain, symmetrical, sorry',
  'THE COUNCIL ..... a sock, some pasta, a volcano',
  'THE THUMB ..... as itself',
  '',
  '#NO ART ASSETS WERE HARMED',
  'every shape in this game is drawn',
  'from maths, at runtime, one lumpy',
  'polygon at a time.',
  '',
  'there are no sprites.',
  'there are no textures.',
  'there are no sound files.',
  'the squelches are filtered noise.',
  'the music is a small machine.',
  '',
  '#FOR ANYONE',
  'who was left on a windowsill',
  'before they were done',
  '',
  'you are allowed to still be soft',
  '',
  '',
  'thank you for playing',
  '',
];

/* ---- on-screen controls ----------------------------------------------- */

function layoutTouchControls() {
  Input.zones = [
    { a: 'left', x: 0.02, y: 0.62, w: 0.11, h: 0.34 },
    { a: 'right', x: 0.14, y: 0.62, w: 0.11, h: 0.34 },
    { a: 'up', x: 0.075, y: 0.42, w: 0.11, h: 0.19 },
    { a: 'down', x: 0.26, y: 0.62, w: 0.11, h: 0.34 },
    { a: 'jump', x: 0.86, y: 0.66, w: 0.12, h: 0.30 },
    { a: 'lob', x: 0.72, y: 0.66, w: 0.12, h: 0.30 },
    { a: 'slurp', x: 0.72, y: 0.34, w: 0.12, h: 0.28 },
    { a: 'pause', x: 0.44, y: 0.01, w: 0.12, h: 0.10 },
  ];
}

const TOUCH_LABELS = { left: '◀', right: '▶', up: '▲', down: '▼', jump: 'JUMP', lob: 'TEAR', slurp: 'SLURP', pause: '' };

function drawTouchControls(ctx, W, H) {
  if (!Input.touch) return;
  ctx.save();
  for (const z of Input.zones) {
    if (z.a === 'pause') continue;
    const x = z.x * W, y = z.y * H, w = z.w * W, h = z.h * H;
    const cx = x + w / 2, cy = y + h / 2;
    const r = Math.min(w, h) / 2;
    const on = Input.held[z.a];
    ctx.globalAlpha = on ? 0.62 : 0.3;
    Clay.blob(ctx, {
      x: cx, y: cy, rx: r, ry: r * 0.92, seed: z.a.length * 13,
      color: on ? '#e0a25c' : '#cbb9a0', wob: 0.09, prints: 1,
    });
    ctx.globalAlpha = on ? 0.95 : 0.6;
    softText(ctx, TOUCH_LABELS[z.a], cx, cy + 5, r > 26 ? 13 : 16, '#3a2a24', 'center', '800');
  }
  ctx.restore();
}

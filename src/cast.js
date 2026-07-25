/* =========================================================================
   NORBERT, UNFINISHED  --  cast.js
   Everyone else on the table.

   The material is the characterisation here. Gary is dry seed-pod. Pippa is
   fuzzy chenille. Beans is an undifferentiated lump. Steve is FIRED -- hard,
   glossy, finished, and he will tell you about it. And Glaze is drawn with
   the wobble and the thumbprints switched off entirely, because Glaze is
   perfect and that is the single worst thing about Glaze.
   ========================================================================= */

const CAST = {};

function makeNpc(kind, x, y, opts) {
  const n = Object.assign({
    kind, x, y, t: Math.random() * 10, facing: -1, talk: 0, mood: 'idle',
    seed: Math.floor(Math.random() * 1000), bobPhase: Math.random() * TAU,
    scale: 1, hidden: false, vy: 0, hop: 0,
  }, opts || {});
  return n;
}

function updateNpc(n, dt, player) {
  n.t += dt;
  if (n.talk > 0) n.talk -= dt;
  if (player && n.autoFace !== false) {
    n.facing = player.x < n.x ? -1 : 1;
  }
  if (n.hop > 0) n.hop -= dt;
}

function drawNpc(ctx, n) {
  if (n.hidden) return;
  const fn = CAST[n.kind];
  if (fn) fn(ctx, n, n.x, n.y);
}

/* Little speech-shake applied while a character is mid-line. */
function talkWobble(n) {
  return n.talk > 0 ? Math.sin(n.t * 26) * 0.035 : 0;
}

/* ======================================================================= */
/*  GARY -- a pinecone who is certain he is a distinguished gentleman      */
/* ======================================================================= */

CAST.gary = function (ctx, n, x, y) {
  const bob = Math.sin(n.t * 1.6 + n.bobPhase) * 1.4;
  const S = n.scale;
  Clay.groundShadow(ctx, x, y + 1, 15 * S, 4.4 * S, 0.4);
  ctx.save();
  ctx.translate(x, y - bob * 0.4);
  ctx.scale(n.facing * S, S);
  ctx.rotate(talkWobble(n) + Math.sin(n.t * 0.9) * 0.02);

  /* two extremely small twig legs */
  ctx.strokeStyle = '#4a3521'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -6); ctx.lineTo(-5.5, -0.5);
  ctx.moveTo(4, -6); ctx.lineTo(5.5, -0.5);
  ctx.stroke();
  ctx.strokeStyle = '#6d5334'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-4, -6); ctx.lineTo(-5.5, -0.5);
  ctx.moveTo(4, -6); ctx.lineTo(5.5, -0.5);
  ctx.stroke();

  /* the cone: rows of scales, tightest at the top */
  const H = 44;
  for (let row = 0; row < 9; row++) {
    const rt = row / 8;
    const ry0 = -4 - rt * H;
    const rw = 13.5 * Math.sin((1 - rt) * 1.5 + 0.34) + 1.5;
    const count = Math.max(2, Math.round(5 - rt * 2.4));
    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0.5 : i / (count - 1);
      const sx = lerp(-rw, rw, u) * (0.86 + 0.14 * Math.sin(row));
      const scaleW = 5.4 - rt * 1.9, scaleH = 3.4 - rt * 1.0;
      const tone = ['#6b4a2b', '#7d5931', '#5c3f24'][(row + i) % 3];
      Clay.blob(ctx, {
        x: sx, y: ry0 + Math.abs(sx) * 0.10, rx: scaleW, ry: scaleH,
        seed: n.seed + row * 7 + i, color: tone, wob: 0.20, boil: 0.35,
        rot: sx * 0.02, prints: 1, edgeAlpha: 0.4,
      });
    }
  }
  /* the pointy hat of a top */
  Clay.blob(ctx, { x: 0.4, y: -H - 5, rx: 3.4, ry: 4.4, seed: n.seed + 90, color: '#7d5931', wob: 0.2, boil: 0.4, prints: 0 });

  /* googly eyes, glued on with far too much glue and no reference photo */
  const px = Math.sin(n.t * 2.3) * 0.5, py = Math.cos(n.t * 1.7) * 0.4;
  Clay.googlyEye(ctx, -5.2, -30, 5.2, px, py + (n.talk > 0 ? Math.sin(n.t * 30) * 0.3 : 0));
  Clay.googlyEye(ctx, 5.4, -32.6, 4.1, px * 0.8 + 0.15, py);
  /* the glue, still visible, still shiny, twelve weeks later */
  ctx.fillStyle = 'rgba(240,238,225,0.25)';
  ctx.beginPath(); ctx.ellipse(-5.2, -29.4, 6.4, 5.6, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5.4, -32, 5.1, 4.5, 0, 0, TAU); ctx.fill();

  /* half a pipe-cleaner moustache. The other half is a mystery he will not
     discuss, in a tone that suggests he ate it. */
  fuzzyLimb(ctx, -1, -23.5, -13, -21, 1.9, '#d98a2b', n.seed + 4, -3);
  ctx.restore();
};

/* chenille: a wire core with fibres sticking out at every angle */
function fuzzyLimb(ctx, x1, y1, x2, y2, r, color, seed, bow) {
  const steps = 22;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.lineCap = 'round';
  /* fibres first, so the core sits on top */
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const b = Math.sin(t * Math.PI) * (bow || 0);
    const px = lerp(x1, x2, t) + nx * b, py = lerp(y1, y2, t) + ny * b;
    for (let k = 0; k < 5; k++) {
      const h = seed * 3.1 + i * 7.7 + k * 2.3;
      const a = hash1(h) * TAU;
      const l = r * (0.9 + hash1(h + 1) * 1.5);
      ctx.strokeStyle = rgba(hash1(h + 2) > 0.5 ? warmLight(color, 0.28) : coolShade(color, 0.22), 0.75);
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = coolShade(color, 0.18);
  ctx.lineWidth = r * 1.15;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2 + nx * (bow || 0) * 2, (y1 + y2) / 2 + ny * (bow || 0) * 2, x2, y2);
  ctx.stroke();
  ctx.strokeStyle = warmLight(color, 0.22);
  ctx.lineWidth = r * 0.55;
  ctx.beginPath();
  ctx.moveTo(x1, y1 - r * 0.3);
  ctx.quadraticCurveTo((x1 + x2) / 2 + nx * (bow || 0) * 2, (y1 + y2) / 2 + ny * (bow || 0) * 2 - r * 0.3, x2, y2 - r * 0.3);
  ctx.stroke();
}

/* ======================================================================= */
/*  MADAME PIPPA PIPECLEANER -- of the Windowsill Ballet, retired, briefly */
/* ======================================================================= */

CAST.pippa = function (ctx, n, x, y) {
  const S = n.scale;
  const sway = Math.sin(n.t * 0.9) * 2.2;
  const legs = n.hasLeg === false ? 1 : 2;
  Clay.groundShadow(ctx, x, y + 1, 14 * S, 4 * S, 0.34);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(n.facing * S, S);
  ctx.rotate(talkWobble(n) * 0.6);

  const PINK = '#e5539b', PINK2 = '#f27ab5';

  /* leg(s). She lost one to the vacuum cleaner in the spring. */
  fuzzyLimb(ctx, -1, -26, -3 + sway * 0.2, -1, 1.5, PINK, n.seed + 1, 2.5);
  ctx.strokeStyle = '#e0a83c'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3 + sway * 0.2, -1.5); ctx.lineTo(-6.5 + sway * 0.2, -0.2);
  ctx.moveTo(-3 + sway * 0.2, -1.5); ctx.lineTo(0.5 + sway * 0.2, -0.2);
  ctx.stroke();

  if (legs === 2) {
    fuzzyLimb(ctx, 2, -26, 5 + sway * 0.2, -1, 1.5, PINK, n.seed + 2, -2.5);
    ctx.strokeStyle = '#e0a83c'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(5 + sway * 0.2, -1.5); ctx.lineTo(1.5 + sway * 0.2, -0.2);
    ctx.moveTo(5 + sway * 0.2, -1.5); ctx.lineTo(8.5 + sway * 0.2, -0.2);
    ctx.stroke();
  } else if (n.clayLeg) {
    /* the replacement Norbert tore off himself. It doesn't match. She loves it. */
    Clay.limb(ctx, 2, -26, 5 + sway * 0.2, -1.5, 2.2, 2.6, NB_SKIN, { seed: 77, bow: -2, prints: 1 });
    Clay.blob(ctx, { x: 5 + sway * 0.2, y: -1, rx: 4, ry: 2.2, seed: 78, color: NB_SKIN, wob: 0.2, prints: 1 });
  }

  /* body: a fat coil of chenille */
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    fuzzyLimb(ctx, -9 + t * 2, -32 + t * 1.6, 9 - t * 2, -30 + t * 1.6, 3.4 - t * 0.9,
      i % 2 ? PINK : PINK2, n.seed + 10 + i, 3 - t * 4);
  }

  /* the neck. An S. Always an S. */
  const nk = (t) => {
    const a = -0.2 + Math.sin(n.t * 0.8) * 0.06;
    return {
      x: -2 + Math.sin(t * 3.0 + a) * 9 - t * 1.5,
      y: -34 - t * 26,
    };
  };
  for (let i = 0; i < 9; i++) {
    const p0 = nk(i / 9), p1 = nk((i + 1) / 9);
    fuzzyLimb(ctx, p0.x, p0.y, p1.x, p1.y, 2.0, i % 2 ? PINK : PINK2, n.seed + 30 + i, 0);
  }
  const hd = nk(1);

  /* head + a beak of folded black card */
  ctx.save();
  ctx.translate(hd.x, hd.y);
  ctx.rotate(-0.25 + Math.sin(n.t * 0.8) * 0.1 + (n.talk > 0 ? Math.sin(n.t * 22) * 0.08 : 0));
  fuzzyLimb(ctx, -3, 0, 3, -1, 3.0, PINK, n.seed + 50, 0);
  ctx.fillStyle = '#1c1a20';
  ctx.beginPath();
  ctx.moveTo(-3, -0.4); ctx.lineTo(-13, 2.4); ctx.lineTo(-3, 3.4); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.beginPath();
  ctx.moveTo(-3, -0.2); ctx.lineTo(-12, 2.1); ctx.lineTo(-6, 1.2); ctx.closePath();
  ctx.fill();
  Clay.beadEye(ctx, -1.4, -1.6, 1.5, { color: '#141018', hi: '#8a6a80' });
  /* one sequin, applied by Ivy, load-bearing to her entire self-image */
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath(); ctx.arc(3.4, -3.6, 2.0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(2.8, -4.2, 0.7, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
};

/* ======================================================================= */
/*  STEVE -- fired. Came out wrong. Runs the sink. Has opinions.           */
/* ======================================================================= */

CAST.steve = function (ctx, n, x, y) {
  const S = n.scale;
  const lean = Math.sin(n.t * 0.7) * 0.02 + talkWobble(n) * 0.4;
  Clay.groundShadow(ctx, x, y + 1, 26 * S, 7 * S, 0.44);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(n.facing * S, S);
  ctx.rotate(lean);

  const CREAM = '#e2d9c2';
  const W = 23, H = 42;

  /* the body of the mug -- FIRED, so it is hard and shiny, not matte */
  ctx.beginPath();
  ctx.moveTo(-W, -H);
  ctx.bezierCurveTo(-W - 1.5, -H * 0.4, -W * 0.85, -3, -W * 0.78, -1);
  ctx.lineTo(W * 0.78, -1);
  ctx.bezierCurveTo(W * 0.85, -3, W + 1.5, -H * 0.4, W, -H);
  ctx.closePath();
  const g = ctx.createLinearGradient(-W, -H, W * 0.9, 0);
  g.addColorStop(0, warmLight(CREAM, 0.30));
  g.addColorStop(0.22, CREAM);
  g.addColorStop(0.62, coolShade(CREAM, 0.20));
  g.addColorStop(1, coolShade(CREAM, 0.46));
  ctx.fillStyle = g; ctx.fill();

  /* glaze runs -- somebody dipped him crooked and that was that */
  ctx.save(); ctx.clip();
  const bg = ctx.createLinearGradient(0, -H, 0, -2);
  bg.addColorStop(0, 'rgba(58,104,148,0.85)');
  bg.addColorStop(0.42, 'rgba(74,126,168,0.7)');
  bg.addColorStop(0.62, 'rgba(90,140,180,0.15)');
  bg.addColorStop(1, 'rgba(90,140,180,0)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-W - 2, -H - 2);
  ctx.lineTo(W + 2, -H - 2);
  ctx.lineTo(W + 2, -H * 0.42);
  for (let i = 0; i <= 10; i++) {
    const px = W + 2 - (2 * W + 4) * (i / 10);
    ctx.lineTo(px, -H * 0.42 + Math.pow(noise1(i * 1.3 + n.seed, n.seed), 2.4) * 16);
  }
  ctx.closePath(); ctx.fill();
  /* hard specular band: this is what "finished" looks like */
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.beginPath(); ctx.ellipse(-W * 0.55, -H * 0.55, 3.4, H * 0.36, 0.06, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath(); ctx.ellipse(W * 0.62, -H * 0.5, 1.8, H * 0.28, -0.04, 0, TAU); ctx.fill();
  ctx.restore();

  /* the rim, and the chip out of it */
  ctx.beginPath();
  ctx.ellipse(0, -H, W, 6.4, 0, 0, TAU);
  ctx.fillStyle = '#3a3a44'; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -H, W * 0.86, 5.0, 0, 0, TAU);
  ctx.fillStyle = '#1e2028'; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -H - 0.5, W, 6.4, 0, Math.PI * 1.02, Math.PI * 1.98);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
  /* THE CHIP */
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.moveTo(W * 0.34, -H - 2.6);
  ctx.lineTo(W * 0.58, -H - 5.4);
  ctx.lineTo(W * 0.74, -H - 1.4);
  ctx.closePath();
  ctx.fillStyle = 'rgba(20,20,26,0.9)'; ctx.fill();
  ctx.fillStyle = 'rgba(226,217,194,0.9)';
  ctx.beginPath();
  ctx.moveTo(W * 0.36, -H - 2.2); ctx.lineTo(W * 0.56, -H - 4.6); ctx.lineTo(W * 0.6, -H - 2.0);
  ctx.closePath(); ctx.fill();

  /* the handle. On the inside. Nobody knows how. */
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -H, W * 0.86, 5.0, 0, 0, TAU);
  ctx.clip();
  ctx.strokeStyle = '#c9c0aa'; ctx.lineWidth = 4.6;
  ctx.beginPath(); ctx.arc(2, -H + 5, 8.5, Math.PI * 1.15, Math.PI * 1.95); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(2, -H + 4.2, 8.5, Math.PI * 1.2, Math.PI * 1.9); ctx.stroke();
  ctx.restore();

  /* a face, painted on by hand, slightly to the left of where it should be */
  const bl = Math.sin(n.t * 1.3) > 0.985 ? 0 : 1;
  ctx.fillStyle = '#2a2530';
  if (bl) {
    ctx.beginPath(); ctx.ellipse(-7.5, -H * 0.60, 2.1, 2.6, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3.5, -H * 0.62, 1.9, 2.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(-8.2, -H * 0.64, 0.7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(2.9, -H * 0.66, 0.6, 0, TAU); ctx.fill();
  } else {
    ctx.strokeStyle = '#2a2530'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-9.6, -H * 0.60); ctx.lineTo(-5.4, -H * 0.60);
    ctx.moveTo(1.8, -H * 0.62); ctx.lineTo(5.2, -H * 0.62); ctx.stroke();
  }
  /* the flattest mouth ever painted on anything */
  ctx.strokeStyle = '#2a2530'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath();
  if (n.mood === 'warm') { ctx.arc(-2, -H * 0.38, 5.6, 0.35, 2.6); }
  else { ctx.moveTo(-8, -H * 0.34); ctx.lineTo(3.6, -H * 0.36); }
  ctx.stroke();
  /* eyebrows of a man who has been through the kiln */
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(-11, -H * 0.76); ctx.lineTo(-5.0, -H * 0.70);
  ctx.moveTo(0.6, -H * 0.72); ctx.lineTo(6.2, -H * 0.79);
  ctx.stroke();

  ctx.restore();
};

/* ======================================================================= */
/*  BEANS                                                                   */
/* ======================================================================= */

CAST.beans = function (ctx, n, x, y) {
  const S = n.scale;
  const squish = n.talk > 0 ? Math.abs(Math.sin(n.t * 9)) * 0.22 : 0;
  const hop = Math.max(0, Math.sin(n.t * 2.2)) * (n.hoppy ? 4.5 : 0.9);
  Clay.groundShadow(ctx, x, y + 1, 9 * S, 3 * S, 0.36 - hop * 0.02);
  ctx.save();
  ctx.translate(x, y - hop);
  ctx.scale(S * (1 + squish), S * (1 - squish * 0.8));
  Clay.blob(ctx, {
    x: 0, y: -7.5, rx: 8.6, ry: 7.6, seed: n.seed + 1, color: '#8b9078',
    wob: 0.17, boil: 0.8, prints: 2,
  });
  /* one eye. That's the whole face. */
  Clay.beadEye(ctx, -1.2, -9.6, 2.0, {});
  ctx.strokeStyle = 'rgba(50,52,42,0.45)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath();
  if (n.talk > 0) ctx.ellipse(0.6, -4.6, 1.8, 1.4, 0, 0, TAU);
  else ctx.arc(0.6, -6.4, 2.4, 0.5, 2.4);
  ctx.stroke();
  ctx.restore();
};

/* ======================================================================= */
/*  GLAZE -- a porcelain swan. Genuinely nice. Somehow worse for it.       */
/* ======================================================================= */

CAST.glaze = function (ctx, n, x, y) {
  const S = n.scale;
  Clay.groundShadow(ctx, x, y + 1, 20 * S, 5.5 * S, 0.34);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(n.facing * S, S);

  const P = '#f4f2ec';
  /* Note the arguments: wob 0, prints 0. Glaze has no thumbprints on Glaze.
     Nobody's hand shows anywhere on Glaze. */
  const perfect = { wob: 0, prints: 0, boil: 0, n: 40 };

  /* body */
  Clay.blob(ctx, Object.assign({ x: 0, y: -16, rx: 19, ry: 14.5, seed: 1, color: P }, perfect));
  /* the wing, a single flawless sweep */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-11, -20);
  ctx.bezierCurveTo(0, -30, 15, -26, 16, -13);
  ctx.bezierCurveTo(8, -8, -6, -10, -11, -20);
  ctx.closePath();
  const wg = ctx.createLinearGradient(-11, -30, 16, -8);
  wg.addColorStop(0, '#ffffff');
  wg.addColorStop(0.5, '#eceae4');
  wg.addColorStop(1, '#c9d6da');
  ctx.fillStyle = wg; ctx.fill();
  ctx.strokeStyle = 'rgba(150,170,180,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
  /* feather lines, evenly spaced, mechanically */
  ctx.strokeStyle = 'rgba(150,172,184,0.4)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-6 + i * 4.6, -21 + i * 1.2);
    ctx.quadraticCurveTo(2 + i * 3.4, -17 + i * 1.6, 6 + i * 2.2, -12 + i * 0.8);
    ctx.stroke();
  }
  ctx.restore();

  /* neck: a perfect circular arc, of course */
  ctx.strokeStyle = P; ctx.lineWidth = 7.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-13, -33, 14, 0.35, 1.75); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(-13.8, -33.6, 14, 0.5, 1.6); ctx.stroke();
  /* the cyan glaze pooling in the low places, beautifully */
  ctx.strokeStyle = 'rgba(122,196,216,0.55)'; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.arc(-12.2, -32.4, 14, 0.45, 1.1); ctx.stroke();

  /* head */
  const hx = -13 + Math.cos(0.35) * 14 - 1, hy = -33 + Math.sin(0.35) * 14 - 12;
  ctx.save();
  ctx.translate(hx + 1, hy - 1);
  ctx.rotate(talkWobble(n) * 0.5 - 0.1);
  Clay.blob(ctx, Object.assign({ x: 0, y: 0, rx: 6.2, ry: 5.4, seed: 2, color: P }, perfect));
  /* gold lustre beak */
  const bg2 = ctx.createLinearGradient(-4, 0, -14, 4);
  bg2.addColorStop(0, '#f0cf72'); bg2.addColorStop(0.5, '#d9ab3c'); bg2.addColorStop(1, '#a97d21');
  ctx.beginPath();
  ctx.moveTo(-4, -1.6); ctx.lineTo(-14, 1.8); ctx.lineTo(-4, 3.4); ctx.closePath();
  ctx.fillStyle = bg2; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.moveTo(-5, -0.8); ctx.lineTo(-12.4, 1.4); ctx.lineTo(-7, 0.8); ctx.closePath(); ctx.fill();
  /* eye: a single painted dot with a perfect eyelash */
  ctx.fillStyle = '#2b3138';
  ctx.beginPath(); ctx.ellipse(-1.2, -1.2, 1.5, 1.9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(-1.7, -1.9, 0.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2b3138'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2.6, -3.6); ctx.lineTo(-4.4, -5.0);
  ctx.moveTo(-1.0, -3.9); ctx.lineTo(-1.6, -5.8); ctx.stroke();
  ctx.restore();

  /* one flawless highlight, in exactly the right place */
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(-8, -22, 4.2, 6.4, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
};

/* ======================================================================= */
/*  THE COUNCIL OF CRAFTS                                                   */
/* ======================================================================= */

CAST.sock = function (ctx, n, x, y) {
  const S = n.scale;
  const gape = n.talk > 0 ? 0.35 + Math.abs(Math.sin(n.t * 14)) * 0.55 : 0.12;
  Clay.groundShadow(ctx, x, y + 1, 20 * S, 5 * S, 0.4);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(n.facing * S, S);
  ctx.rotate(Math.sin(n.t * 1.1) * 0.03);

  const A = '#dcd6c8', B = '#b8535e';
  /* the tube of the sock, with its stripes */
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    const yy = -6 - t * 44;
    const rr = 12 - t * 1.2 + Math.sin(t * 4) * 1.2;
    Clay.blob(ctx, {
      x: Math.sin(t * 2.2 + n.t * 0.6) * 4 * t, y: yy, rx: rr, ry: 5.4,
      seed: n.seed + i, color: i % 3 === 0 ? B : A, wob: 0.12, boil: 0.4, prints: 1, edgeAlpha: 0.25,
    });
  }
  /* the head/mouth, hinged like a hand is inside it (there is no hand) */
  const hx = Math.sin(2.2 + n.t * 0.6) * 4, hy = -52;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-0.2);
  ctx.save(); ctx.rotate(-gape * 0.5);
  Clay.blob(ctx, { x: -3, y: -4, rx: 15, ry: 7, seed: n.seed + 40, color: A, wob: 0.1, boil: 0.4, prints: 2 });
  ctx.restore();
  ctx.save(); ctx.rotate(gape * 0.5);
  Clay.blob(ctx, { x: -3, y: 3.4, rx: 14, ry: 6, seed: n.seed + 41, color: A, wob: 0.1, boil: 0.4, prints: 2 });
  /* a felt tongue, cut with the round-ended scissors */
  ctx.fillStyle = '#c4566a';
  ctx.beginPath(); ctx.ellipse(-10, 1.6, 7, 2.6, -0.1, 0, TAU); ctx.fill();
  ctx.restore();
  Clay.googlyEye(ctx, -3, -9.5, 4.6, 0.1, -0.2);
  Clay.googlyEye(ctx, 4.2, -10.6, 4.0, 0.15, -0.25);
  ctx.restore();
  ctx.restore();
};

CAST.macaroni = function (ctx, n, x, y) {
  const S = n.scale;
  Clay.groundShadow(ctx, x, y + 1, 17 * S, 4.4 * S, 0.34);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(n.facing * S, S);
  /* a necklace standing up on its own, which nobody comments on */
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI * 0.5 + (i / (N - 1)) * Math.PI * 2;
    const px = Math.cos(a) * 14, py = -22 + Math.sin(a) * 20;
    const wob2 = n.talk > 0 ? Math.sin(n.t * 12 + i) * 1.4 : Math.sin(n.t * 1.4 + i * 0.5) * 0.5;
    ctx.save();
    ctx.translate(px, py + wob2);
    ctx.rotate(a + 1.57);
    Clay.blob(ctx, {
      x: 0, y: 0, rx: 2.6, ry: 4.4, seed: n.seed + i * 3,
      color: ['#e6c877', '#dcb85e', '#efd48d'][i % 3], wob: 0.14, boil: 0.5, prints: 0,
    });
    ctx.fillStyle = 'rgba(60,40,20,0.5)';
    ctx.beginPath(); ctx.ellipse(0, -3.4, 1.1, 0.8, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(200,190,170,0.6)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(0, -22, 14, 20, 0, 0, TAU); ctx.stroke();
  /* the two pieces of pasta that everyone agrees are the face */
  Clay.beadEye(ctx, -4.6, -30, 1.7, {});
  Clay.beadEye(ctx, 4.2, -30, 1.7, {});
  ctx.restore();
};

CAST.volcano = function (ctx, n, x, y) {
  const S = n.scale;
  const erupt = n.erupt || 0;
  Clay.groundShadow(ctx, x, y + 1, 34 * S, 8 * S, 0.44);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(S, S);
  /* papier-mache: newsprint lumps under grey-brown poster paint */
  const pts = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const px = -34 + t * 68;
    const py = -Math.pow(Math.sin(t * Math.PI), 0.65) * 48 - 1;
    pts.push({ x: px + shash1(i * 3 + n.seed) * 2.2, y: py + shash1(i * 7 + n.seed) * 2.2 });
  }
  pts.push({ x: 34, y: 0 }, { x: -34, y: 0 });
  Clay.slab(ctx, pts, '#7d6b58', { seed: n.seed, prints: 30, markSize: 4.4, vert: true, vertH: 60 });
  /* the crater, painted a red he is extremely proud of */
  ctx.beginPath(); ctx.ellipse(0, -47, 9, 3.4, 0, 0, TAU);
  ctx.fillStyle = '#8c2f22'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -47.6, 6.4, 2.2, 0, 0, TAU);
  ctx.fillStyle = '#c1442b'; ctx.fill();
  /* strips of newspaper still legible if you get close */
  ctx.strokeStyle = 'rgba(240,236,220,0.14)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 22; i++) {
    const px = -28 + hash1(i * 3.3 + n.seed) * 56;
    const py = -hash1(i * 7.1 + n.seed) * 42;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 5 + hash1(i) * 8, py + shash1(i * 2) * 2); ctx.stroke();
  }
  /* eyes, low on the slope, giving him a permanent look of ambition */
  Clay.googlyEye(ctx, -11, -20, 5.4, 0.1, -0.3);
  Clay.googlyEye(ctx, 10, -21, 5.0, 0.05, -0.3);
  if (erupt > 0) {
    for (let i = 0; i < 26; i++) {
      const t = ((n.t * 2.4 + i * 0.13) % 1);
      const a = -1.57 + shash1(i * 3) * 0.7;
      const d = t * 60 * erupt;
      const px = Math.cos(a) * d * 0.5, py = -47 + Math.sin(a) * d;
      ctx.globalAlpha = (1 - t) * 0.85 * erupt;
      ctx.fillStyle = i % 3 ? '#fff6ea' : '#ffd9b0';
      ctx.beginPath(); ctx.arc(px, py, 2 + t * 6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
};

/* ======================================================================= */
/*  THE THUMB                                                               */
/* ======================================================================= */

/* Ivy's thumb, coming down out of the sky. Drawn at whatever scale the scene
   needs; `n.desc` is 0 (out of frame) to 1 (touching the ground). */
CAST.thumb = function (ctx, n, x, y) {
  const d = clamp(n.desc || 0, 0, 1);
  if (d <= 0.001) return;
  const S = n.scale || 1;
  const H = 420 * S;
  const ty = y - (1 - d) * H * 1.4;

  /* a shadow that arrives before the thumb does */
  ctx.save();
  const shR = 70 * S * (0.5 + d * 0.9);
  const sg = ctx.createRadialGradient(x, y, 0, x, y, shR);
  sg.addColorStop(0, 'rgba(16,6,20,' + 0.6 * d + ')');
  sg.addColorStop(1, 'rgba(16,6,20,0)');
  ctx.fillStyle = sg;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.30); ctx.translate(-x, -y);
  ctx.beginPath(); ctx.arc(x, y, shR, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.translate(x, ty);
  ctx.rotate((n.tilt || 0.06) + Math.sin(n.t * 0.7) * 0.01);
  ctx.scale(S, S);

  const SKIN = '#e0a98c';
  /* the digit */
  ctx.beginPath();
  ctx.moveTo(-56, -420);
  ctx.bezierCurveTo(-64, -220, -60, -96, -44, -44);
  ctx.bezierCurveTo(-32, -6, 30, -4, 42, -44);
  ctx.bezierCurveTo(58, -98, 62, -230, 54, -420);
  ctx.closePath();
  const g = ctx.createLinearGradient(-60, -200, 62, -60);
  g.addColorStop(0, '#f3c8ae');
  g.addColorStop(0.35, SKIN);
  g.addColorStop(0.75, '#b87f6a');
  g.addColorStop(1, '#8d5c50');
  ctx.fillStyle = g; ctx.fill();

  ctx.save(); ctx.clip();
  /* knuckle crease */
  ctx.strokeStyle = 'rgba(130,78,66,0.35)'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-58, -300 + i * 12);
    ctx.quadraticCurveTo(0, -286 + i * 12, 56, -302 + i * 12);
    ctx.stroke();
  }
  /* THE FINGERPRINT. Concentric, enormous, and the single most alien thing
     in this entire craft room. */
  ctx.strokeStyle = 'rgba(150,92,78,0.34)';
  ctx.lineWidth = 2.6;
  for (let i = 1; i < 17; i++) {
    ctx.beginPath();
    ctx.ellipse(-2, -120, i * 4.6, i * 6.6, 0.05, 0.2, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,222,204,0.22)';
  ctx.lineWidth = 1.4;
  for (let i = 1; i < 17; i++) {
    ctx.beginPath();
    ctx.ellipse(-3, -122, i * 4.6, i * 6.6, 0.05, 0.2, Math.PI * 1.9);
    ctx.stroke();
  }
  /* a smear of dried orange clay under the nail, which is Norbert */
  ctx.fillStyle = 'rgba(190,110,72,0.4)';
  ctx.beginPath(); ctx.ellipse(24, -70, 16, 9, 0.4, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(120,70,60,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-56, -420);
  ctx.bezierCurveTo(-64, -220, -60, -96, -44, -44);
  ctx.bezierCurveTo(-32, -6, 30, -4, 42, -44);
  ctx.bezierCurveTo(58, -98, 62, -230, 54, -420);
  ctx.stroke();
  ctx.restore();
};

/* ======================================================================= */
/*  Portrait heads, for the dialogue box                                    */
/* ======================================================================= */

const PORTRAITS = {
  norbert(ctx, t, talking) {
    const n = makeNorbertRig();
    n.mood = talking ? (Math.sin(t * 12) > 0 ? 'oh' : 'neutral') : 'neutral';
    n.t = t; n.blink = (t % 3.1) < 0.12 ? 1 : 0;
    ctx.save(); ctx.translate(0, 12); ctx.scale(1.5, 1.5);
    Clay.blobPath(ctx, 0, 0, 10.2, 9.6, 3, 0.075, 0.05, 0.3, 22);
    Clay.material(ctx, { x: -12, y: -12, w: 24, h: 24 }, NB_SKIN, { seed: 3, prints: 3 });
    drawNbCurl(ctx, 0.8, -9, Math.sin(t * 1.4) * 0.2, NB_SKIN);
    Clay.dent(ctx, -2.6, -5.4, 3.9, 2.5, -0.28, NB_SKIN);
    drawNbFace(ctx, n, 10.2, 9.6, NB_SKIN);
    ctx.restore();
  },
  gary(ctx, t, talking) {
    ctx.save(); ctx.translate(0, 26); ctx.scale(1.35, 1.35);
    CAST.gary(ctx, { t, seed: 4, facing: 1, scale: 1, talk: talking ? 1 : 0, bobPhase: 0 }, 0, 0);
    ctx.restore();
  },
  pippa(ctx, t, talking) {
    ctx.save(); ctx.translate(4, 40); ctx.scale(1.05, 1.05);
    CAST.pippa(ctx, { t, seed: 7, facing: 1, scale: 1, talk: talking ? 1 : 0, hasLeg: true }, 0, 0);
    ctx.restore();
  },
  steve(ctx, t, talking) {
    ctx.save(); ctx.translate(0, 20); ctx.scale(1.15, 1.15);
    CAST.steve(ctx, { t, seed: 2, facing: 1, scale: 1, talk: talking ? 1 : 0 }, 0, 0);
    ctx.restore();
  },
  beans(ctx, t, talking) {
    ctx.save(); ctx.translate(0, 22); ctx.scale(2.1, 2.1);
    CAST.beans(ctx, { t, seed: 9, facing: 1, scale: 1, talk: talking ? 1 : 0 }, 0, 0);
    ctx.restore();
  },
  glaze(ctx, t, talking) {
    ctx.save(); ctx.translate(9, 26); ctx.scale(1.0, 1.0);
    CAST.glaze(ctx, { t, seed: 3, facing: 1, scale: 1, talk: talking ? 1 : 0 }, 0, 0);
    ctx.restore();
  },
  council(ctx, t, talking) {
    ctx.save(); ctx.translate(0, 24); ctx.scale(0.82, 0.82);
    CAST.sock(ctx, { t, seed: 5, facing: 1, scale: 1, talk: talking ? 1 : 0 }, 0, 0);
    ctx.restore();
  },
  thumb(ctx, t) {
    ctx.save(); ctx.translate(0, 30); ctx.scale(0.14, 0.14);
    CAST.thumb(ctx, { t, desc: 1, scale: 1, tilt: 0 }, 0, 0);
    ctx.restore();
  },
};

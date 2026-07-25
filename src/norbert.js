/* =========================================================================
   NORBERT, UNFINISHED  --  norbert.js
   The rig for our hero.

   Norbert was made in forty minutes by a nine-year-old named Ivy, who ran out
   of orange clay, ran out of time, and had to be picked up at five. So:
     - one arm is a long clay noodle, the other is a nub with the armature wire
       still poking out of it
     - his left eye is a shirt button, his right eye is a bead, and they do not
       match in size, height, or opinion
     - there is a thumbprint dent in his forehead where she pressed too hard
     - the patch on his belly is grey, because that was the clay that was left
     - he has a little pinched curl on top that she was quite proud of
   None of this is symmetrical. None of it is meant to be.
   ========================================================================= */

const NB_SKIN = '#c5704a';            // terracotta
const NB_PATCH = '#8d8b83';           // the grey clay she had left
const NB_WIRE = '#9aa0a6';

/* Fresh state object for the rig. The game mutates this; drawing never does. */
function makeNorbertRig() {
  return {
    facing: 1,
    walk: 0,            // walk cycle phase
    speed: 0,           // 0..1 how fast he's trundling
    sx: 1, sy: 1,       // squash & stretch springs
    vsx: 0, vsy: 0,
    squish: 0,          // 0..1 pancake
    stretch: 0,         // 0..1 tall & thin
    scale: 1,           // shrinks as he gives himself away
    air: 0,             // -1 rising, 1 falling, 0 grounded
    blink: 0,
    blinkT: 1.5,
    look: { x: 0, y: 0 },
    mood: 'neutral',
    armSwing: 0,
    reach: null,        // {x,y} world-ish local target for the long arm
    curl: { a: 0, v: 0 },   // the pinched curl on his head, on a spring
    jiggle: 0,
    dizzy: 0,
    wet: 0,             // dripping in the sink
    paint: null,        // gets dyed in the paint shelf
    t: 0,
  };
}

function updateNorbertRig(n, dt) {
  n.t += dt;

  /* squash & stretch spring back to the pose the player is holding */
  const tsx = 1 + n.squish * 0.52 - n.stretch * 0.26;
  const tsy = 1 - n.squish * 0.56 + n.stretch * 0.72;
  const K = 190, D = 15;
  n.vsx += (tsx - n.sx) * K * dt; n.vsx *= Math.exp(-D * dt); n.sx += n.vsx * dt;
  n.vsy += (tsy - n.sy) * K * dt; n.vsy *= Math.exp(-D * dt); n.sy += n.vsy * dt;

  /* the curl swings against the direction of travel, half a beat late */
  const target = -n.facing * n.speed * 0.5 - n.air * 0.35;
  n.curl.v += (target - n.curl.a) * 60 * dt;
  n.curl.v *= Math.exp(-7 * dt);
  n.curl.a += n.curl.v * dt;

  n.walk += n.speed * dt * 9.5;
  n.armSwing = Math.sin(n.walk) * n.speed;

  n.blinkT -= dt;
  if (n.blinkT <= 0) { n.blink = 0.13; n.blinkT = 1.4 + Math.random() * 3.4; }
  if (n.blink > 0) n.blink -= dt;

  if (n.dizzy > 0) n.dizzy -= dt;
  if (n.wet > 0) n.wet -= dt * 0.35;
  n.jiggle *= Math.exp(-6 * dt);
}

/* ---------------------------------------------------------------------- */

function drawNorbert(ctx, n, x, y) {
  const skin = n.paint ? mixHex(NB_SKIN, n.paint, 0.82) : NB_SKIN;
  const patch = n.paint ? mixHex(NB_PATCH, n.paint, 0.6) : NB_PATCH;
  const S = n.scale;

  /* stop-motion boil: the model was nudged between frames */
  const bx = shash1(Clay.frame * 1.7 + 11) * 0.45;
  const by = shash1(Clay.frame * 2.3 + 27) * 0.4;
  const brot = shash1(Clay.frame * 1.1 + 5) * 0.012;

  Clay.groundShadow(ctx, x, y + 1, 15 * S * n.sx, 4.6 * S, 0.4);

  ctx.save();
  ctx.translate(x + bx, y + by);
  ctx.rotate(brot + n.dizzy * 0.1 * Math.sin(n.t * 20));
  ctx.scale(n.facing * n.sx * S, n.sy * S);

  const bob = Math.abs(Math.sin(n.walk)) * 1.6 * n.speed;
  ctx.translate(0, -bob * 0.4);

  const sq = n.squish, st = n.stretch;
  const bodyY = -19 + bob * 0.3;
  const headY = -36.5 + bob * 0.55 - st * 1.5;
  const bodyRX = 13.2, bodyRY = 13.6;
  const headRX = 10.2, headRY = 9.6;

  /* ---- back leg ---- */
  const legPhase = n.walk;
  const l1 = Math.sin(legPhase) * 3.4 * n.speed;
  const l2 = Math.sin(legPhase + Math.PI) * 3.4 * n.speed;
  const legLift1 = Math.max(0, Math.sin(legPhase)) * 2.2 * n.speed;
  const legLift2 = Math.max(0, Math.sin(legPhase + Math.PI)) * 2.2 * n.speed;

  /* the right leg is shorter. Ivy noticed and decided it was fine. */
  drawNbLeg(ctx, 5.2, -9, 5.6 + l2, -1.6 - legLift2, 3.0, 4.6, 2.6, skin, 31);

  /* ---- the nub arm, behind the body ---- */
  const nubX = 10.8, nubY = -25.5 + bob * 0.3;
  ctx.save();
  ctx.translate(nubX, nubY);
  ctx.rotate(0.22 + n.armSwing * 0.22);
  /* the armature wire is still in there. It curls, hopefully, into nothing. */
  const wire = (col, lw, oy) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2.2, 0.4 + oy);
    ctx.quadraticCurveTo(5.6, -0.4 + oy, 5.9, -2.6 + oy);
    ctx.quadraticCurveTo(6.1, -4.4 + oy, 4.5, -4.5 + oy);
    ctx.stroke();
  };
  wire('rgba(40,24,36,0.45)', 1.9, 0.7);
  wire(NB_WIRE, 1.0, 0);
  wire('rgba(255,255,255,0.5)', 0.4, -0.35);
  ctx.restore();
  Clay.blob(ctx, { x: nubX, y: nubY, rx: 4.5, ry: 3.9, seed: 44, color: skin, wob: 0.15, boil: 0.5, rot: 0.3, prints: 1 });

  /* ---- body ---- */
  /* pear shaped: he settles under his own weight, like clay does */
  Clay.blobPath(ctx, 0, bodyY + 1.6, bodyRX * (1 + sq * 0.05), bodyRY, 7, 0.085, 0, 0.35, 24);
  Clay.material(ctx, { x: -bodyRX * 1.2, y: bodyY - bodyRY * 1.2, w: bodyRX * 2.4, h: bodyRY * 2.5 },
    skin, { seed: 7, prints: 4, specX: 0.28, specY: 0.22 });

  /* the grey patch on his belly */
  ctx.save();
  Clay.blobPath(ctx, 0, bodyY + 1.6, bodyRX * (1 + sq * 0.05), bodyRY, 7, 0.085, 0, 0.35, 24);
  ctx.clip();
  Clay.blobPath(ctx, -2.4, bodyY + 6.4, 6.6, 4.6, 88, 0.2, -0.2, 0.4, 16);
  Clay.material(ctx, { x: -10, y: bodyY + 1, w: 16, h: 11 }, patch,
    { seed: 88, prints: 2, edgeAlpha: 0.22, hotspot: false });
  ctx.restore();

  /* the seam where head meets body -- she pressed them together, you can tell */
  ctx.strokeStyle = rgba(coolShade(skin, 0.5), 0.28);
  ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7.6, headY + headRY * 0.72);
  ctx.quadraticCurveTo(0, headY + headRY * 1.06, 7.2, headY + headRY * 0.66);
  ctx.stroke();

  /* ---- front leg ---- */
  drawNbLeg(ctx, -5.4, -9, -5.8 + l1, -1.4 - legLift1, 3.2, 5.4, 2.9, skin, 17);

  /* ---- head ---- */
  const headTilt = n.facing * 0.04 + n.armSwing * 0.03 + shash1(Clay.frame * 0.9 + 3) * 0.01;
  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(headTilt);

  /* the pinched curl */
  drawNbCurl(ctx, 0.8, -headRY + 0.6, n.curl.a, skin);

  Clay.blobPath(ctx, 0, 0, headRX, headRY, 3, 0.075, 0.05, 0.35, 22);
  Clay.material(ctx, { x: -headRX * 1.15, y: -headRY * 1.15, w: headRX * 2.3, h: headRY * 2.3 },
    skin, { seed: 3, prints: 3, specX: 0.26, specY: 0.2 });

  /* the thumbprint dent in his forehead */
  Clay.dent(ctx, -2.6, -5.4, 3.9, 2.5, -0.28, skin);
  ctx.strokeStyle = rgba(warmLight(skin, 0.5), 0.3); ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.arc(-2.6, -5.4, 3.2, 0.9, 3.6); ctx.stroke();

  drawNbFace(ctx, n, headRX, headRY, skin);

  ctx.restore();

  /* ---- the long arm, in front. It is much too long and he knows it. ---- */
  const shX = -11.6, shY = -26.5 + bob * 0.3;
  let hx, hy, bow;
  if (n.reach) {
    hx = n.reach.x; hy = n.reach.y; bow = 2;
  } else {
    hx = shX - 5.4 + n.armSwing * 6.4;
    hy = -5.4 + Math.abs(n.armSwing) * -1.8 + (n.air ? 5 * n.air : 0);
    bow = -4.6 - n.armSwing * 3.0;
  }
  /* shoulder ball, so the arm doesn't look glued on (it is glued on) */
  Clay.blob(ctx, { x: shX + 1.4, y: shY + 0.6, rx: 4.0, ry: 4.2, seed: 66, color: skin, wob: 0.12, boil: 0.4, prints: 1 });
  Clay.limb(ctx, shX, shY, hx, hy, 3.3, 2.5, skin, { seed: 21, bow: bow, prints: 2, edgeAlpha: 0.5 });
  /* a hand, of sorts. Three fingers, because forty minutes is forty minutes. */
  Clay.blob(ctx, { x: hx, y: hy, rx: 3.4, ry: 3.1, seed: 22, color: skin, wob: 0.19, boil: 0.6, prints: 1 });
  ctx.strokeStyle = rgba(coolShade(skin, 0.45), 0.32); ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(hx - 1.4, hy + 1.6); ctx.lineTo(hx - 1.9, hy + 3.4);
  ctx.moveTo(hx + 0.2, hy + 2.0); ctx.lineTo(hx + 0.1, hy + 3.9);
  ctx.moveTo(hx + 1.7, hy + 1.4); ctx.lineTo(hx + 2.3, hy + 3.1);
  ctx.stroke();

  /* wet clay drips in the sink */
  if (n.wet > 0.02) {
    ctx.fillStyle = 'rgba(178,206,214,' + (0.4 * clamp(n.wet, 0, 1)) + ')';
    for (let i = 0; i < 4; i++) {
      const p = (n.t * 1.4 + i * 0.31) % 1;
      const dx2 = -8 + i * 5.4 + shash1(i * 3) * 2;
      ctx.beginPath();
      ctx.ellipse(dx2, -4 + p * 6, 0.9, 1.6 + p * 1.2, 0, 0, TAU);
      ctx.fill();
    }
  }

  ctx.restore();
}

/* stubby leg + flat foot */
function drawNbLeg(ctx, hx, hy, fx, fy, r, footRX, footRY, color, seed) {
  Clay.limb(ctx, hx, hy, fx, fy, r, r * 0.86, color, { seed: seed, bow: 0.8, prints: 1 });
  Clay.blob(ctx, {
    x: fx - 0.8, y: fy, rx: footRX, ry: footRY, seed: seed + 100,
    color: color, wob: 0.17, boil: 0.4, rot: -0.06, prints: 1
  });
}

/* the pinched curl on top of his head -- Ivy's favourite bit */
function drawNbCurl(ctx, x, y, a, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a * 0.5);
  const tipX = 2.6 + a * 4.2, tipY = -7.4 + Math.abs(a) * 1.4;
  Clay.limb(ctx, 0, 1, tipX, tipY, 2.5, 0.7, color, { seed: 55, bow: -2.4 - a * 1.6, prints: 0 });
  ctx.restore();
}

/* ---------------------------------------------------------------------- */
/*  Face                                                                    */
/* ---------------------------------------------------------------------- */

function drawNbFace(ctx, n, hrx, hry, skin) {
  const lookX = clamp(n.look.x, -1, 1), lookY = clamp(n.look.y, -1, 1);
  const blinking = n.blink > 0;

  /* left: the button. It is much too big and it is the best thing about him. */
  const bex = -4.2 + lookX * 0.7, bey = 0.6 + lookY * 0.7;
  if (blinking) {
    ctx.save();
    Clay.blobPath(ctx, bex, bey, 4.6, 1.1, 91, 0.14, -0.1, 0, 12);
    Clay.material(ctx, { x: bex - 5, y: bey - 2, w: 10, h: 4 }, skin, { seed: 91, prints: 0, edgeAlpha: 0.4 });
    ctx.restore();
  } else {
    Clay.buttonEye(ctx, bex, bey, 4.5, -0.16 + lookX * 0.1, { seed: 92 });
  }

  /* right: a bead. Set higher, because she was rushing. */
  const bdx = 4.9 + lookX * 0.5, bdy = -1.1 + lookY * 0.5;
  if (blinking) {
    ctx.strokeStyle = rgba(coolShade(skin, 0.5), 0.6); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(bdx, bdy + 1, 2.2, 3.4, 6.0); ctx.stroke();
  } else {
    Clay.beadEye(ctx, bdx, bdy, 1.85, {});
  }

  /* a smudge of an eyebrow over the bead only. There was only enough for one. */
  ctx.strokeStyle = rgba(coolShade(skin, 0.45), 0.4);
  ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  const browY = -4.6 + (n.mood === 'worried' ? 0.6 : 0) + lookY * 0.4;
  ctx.beginPath();
  if (n.mood === 'worried' || n.mood === 'sad') ctx.arc(bdx + 0.4, browY + 3.4, 3.2, 4.3, 5.3);
  else if (n.mood === 'happy') ctx.arc(bdx + 0.2, browY + 4.2, 3.6, 3.9, 5.0);
  else ctx.arc(bdx + 0.3, browY + 3.8, 3.4, 4.1, 5.15);
  ctx.stroke();

  /* mouth: a groove pressed in with the end of a paintbrush */
  const mx = 0.4, my = 4.9;
  const dark = rgba(coolShade(skin, 0.55), 0.5);
  const lite = rgba(warmLight(skin, 0.5), 0.42);
  ctx.lineCap = 'round';
  const stroke2 = (fn) => {
    ctx.lineWidth = 1.9; ctx.strokeStyle = dark;
    ctx.save(); ctx.translate(0.5, 0.5); ctx.beginPath(); fn(); ctx.stroke(); ctx.restore();
    ctx.lineWidth = 1.3; ctx.strokeStyle = lite;
    ctx.save(); ctx.translate(-0.4, -0.5); ctx.beginPath(); fn(); ctx.stroke(); ctx.restore();
  };

  switch (n.mood) {
    case 'happy':
      stroke2(() => ctx.arc(mx, my - 1.4, 3.5, 0.5, 2.64));
      break;
    case 'oh':
      ctx.beginPath(); ctx.ellipse(mx, my + 0.4, 1.9, 2.4, 0, 0, TAU);
      ctx.fillStyle = rgba(coolShade(skin, 0.62), 0.75); ctx.fill();
      ctx.beginPath(); ctx.ellipse(mx - 0.4, my - 0.3, 1.5, 1.8, 0, 0, TAU);
      ctx.strokeStyle = lite; ctx.lineWidth = 0.9; ctx.stroke();
      break;
    case 'sad':
      stroke2(() => ctx.arc(mx, my + 4.0, 3.4, 3.85, 5.58));
      break;
    case 'worried':
      stroke2(() => { ctx.moveTo(mx - 3.2, my); ctx.quadraticCurveTo(mx - 1, my + 1.6, mx + 0.3, my - 0.1); ctx.quadraticCurveTo(mx + 1.8, my - 1.5, mx + 3.4, my + 0.4); });
      break;
    case 'grin':
      stroke2(() => ctx.arc(mx, my - 2.2, 4.4, 0.42, 2.72));
      ctx.fillStyle = 'rgba(252,246,232,0.9)';
      ctx.beginPath(); ctx.ellipse(mx - 1.2, my + 1.0, 1.1, 1.0, 0, 0, TAU); ctx.fill();
      break;
    default:
      stroke2(() => { ctx.moveTo(mx - 2.6, my - 0.4); ctx.quadraticCurveTo(mx, my + 1.0, mx + 2.8, my - 0.6); });
  }
}

/* ---------------------------------------------------------------------- */
/*  A torn-off piece of Norbert                                            */
/* ---------------------------------------------------------------------- */

function drawClayBlobEntity(ctx, b) {
  const c = b.color || NB_SKIN;
  Clay.groundShadow(ctx, b.x, b.y + b.r * 0.85, b.r * 1.5, b.r * 0.5, 0.35);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot || 0);
  ctx.scale(b.sx || 1, b.sy || 1);
  Clay.blob(ctx, {
    x: 0, y: 0, rx: b.r, ry: b.r * 0.92, seed: b.seed || 5, color: c,
    wob: 0.17, boil: 0.7, prints: 2
  });
  /* a tiny face, because everything here is a little bit alive */
  if (b.stuck) {
    Clay.beadEye(ctx, -b.r * 0.3, -b.r * 0.15, Math.max(0.8, b.r * 0.13), {});
    Clay.beadEye(ctx, b.r * 0.32, -b.r * 0.18, Math.max(0.8, b.r * 0.13), {});
  }
  ctx.restore();
}

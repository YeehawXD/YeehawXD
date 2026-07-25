/* =========================================================================
   NORBERT, UNFINISHED  --  dialogue.js
   A talking box.

   The text is drawn one glyph at a time with a tiny seeded offset per letter
   that re-rolls on the stop-motion tick, so the lettering trembles the way
   everything else in the frame does. It costs a few hundred fillText calls and
   it is worth every one of them.
   ========================================================================= */

const UI_FONT = '"Trebuchet MS", "DejaVu Sans", Verdana, system-ui, sans-serif';

const Dialogue = {
  active: false,
  queue: [],
  line: null,
  chars: 0,
  t: 0,
  speed: 38,          // characters per second
  done: false,
  onEnd: null,
  choice: null,
  choiceIdx: 0,
  boxY: 0,
  hold: 0,
};

Dialogue.start = function (script, onEnd) {
  Dialogue.queue = script.slice();
  Dialogue.active = true;
  Dialogue.onEnd = onEnd || null;
  Dialogue.boxY = 1;
  Dialogue._next();
};

Dialogue._next = function () {
  if (!Dialogue.queue.length) {
    Dialogue.active = false;
    Dialogue.line = null;
    const cb = Dialogue.onEnd; Dialogue.onEnd = null;
    if (cb) cb();
    return;
  }
  const l = Dialogue.queue.shift();
  if (typeof l === 'function') { l(); Dialogue._next(); return; }
  /* a bare { act: 'name' } entry fires a story beat and moves straight on */
  if (l.act !== undefined && l.text === undefined) {
    if (Dialogue.onAct) Dialogue.onAct(l.act);
    Dialogue._next();
    return;
  }
  Dialogue.line = l;
  Dialogue.chars = 0;
  Dialogue.done = false;
  Dialogue.t = 0;
  Dialogue.hold = 0;
  Dialogue.choice = l.choice || null;
  Dialogue.choiceIdx = 0;
  if (l.shake) Cam.kick(l.shake);
  if (l.sfx) Sound.play(l.sfx);
};

Dialogue.skipAll = function () {
  Dialogue.queue.length = 0;
  Dialogue.active = false;
  Dialogue.line = null;
  const cb = Dialogue.onEnd; Dialogue.onEnd = null;
  if (cb) cb();
};

Dialogue.update = function (dt) {
  if (!Dialogue.active) { Dialogue.boxY = approach(Dialogue.boxY, 1, dt * 5); return; }
  Dialogue.boxY = approach(Dialogue.boxY, 0, dt * 6);
  const l = Dialogue.line;
  if (!l) return;
  Dialogue.t += dt;

  const full = l.text ? l.text.length : 0;
  if (!Dialogue.done) {
    const sp = Dialogue.speed * (l.speed || 1) * (Input.held.jump || Input.held.talk ? 3.2 : 1);
    const before = Math.floor(Dialogue.chars);
    Dialogue.chars = Math.min(full, Dialogue.chars + sp * dt);
    const after = Math.floor(Dialogue.chars);
    if (after > before) {
      const ch = l.text[after - 1];
      if (ch && ch !== ' ' && (after % 2 === 0)) Sound.blip(l.who || 'narrator');
    }
    if (Dialogue.chars >= full) { Dialogue.done = true; Dialogue.hold = 0; }
  } else {
    Dialogue.hold += dt;
  }

  if (Dialogue.choice && Dialogue.done) {
    if (Input.pressed.up || Input.pressed.left) { Dialogue.choiceIdx = (Dialogue.choiceIdx + Dialogue.choice.length - 1) % Dialogue.choice.length; Sound.play('ui'); }
    if (Input.pressed.down || Input.pressed.right) { Dialogue.choiceIdx = (Dialogue.choiceIdx + 1) % Dialogue.choice.length; Sound.play('ui'); }
    if (Input.pressed.talk || Input.pressed.jump) {
      const c = Dialogue.choice[Dialogue.choiceIdx];
      Sound.play('uiBig');
      Dialogue.choice = null;
      if (c.then) Dialogue.queue = c.then.concat(Dialogue.queue);
      Dialogue._next();
    }
    return;
  }

  if (Input.pressed.talk || Input.pressed.jump) {
    if (!Dialogue.done) { Dialogue.chars = full; Dialogue.done = true; }
    else { Sound.play('ui'); Dialogue._next(); }
  }
  /* auto-advance for cinematic lines */
  if (l.auto && Dialogue.done && Dialogue.hold > (l.auto || 1.4)) Dialogue._next();
};

/* Hand-lettered text: every glyph gets its own little wobble. */
function jitterText(ctx, str, x, y, seed, amount) {
  amount = amount === undefined ? 0.55 : amount;
  let cx = x;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const w = ctx.measureText(ch).width;
    if (ch !== ' ') {
      const h = seed + i * 3.77;
      const ox = shash1(h + Clay.frame * 0.011) * amount;
      const oy = shash1(h + 40 + Clay.frame * 0.013) * amount;
      const rot = shash1(h + 80) * 0.035 * amount;
      ctx.save();
      ctx.translate(cx + w / 2 + ox, y + oy);
      ctx.rotate(rot);
      ctx.fillText(ch, -w / 2, 0);
      ctx.restore();
    }
    cx += w;
  }
  return cx - x;
}

function jitterTextOutlined(ctx, str, x, y, seed, fill, outline, lw) {
  let cx = x;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const w = ctx.measureText(ch).width;
    if (ch !== ' ') {
      const h = seed + i * 3.77;
      const ox = shash1(h + Clay.frame * 0.011) * 0.6;
      const oy = shash1(h + 40 + Clay.frame * 0.013) * 0.6;
      const rot = shash1(h + 80) * 0.03;
      ctx.save();
      ctx.translate(cx + w / 2 + ox, y + oy);
      ctx.rotate(rot);
      if (outline) {
        ctx.lineWidth = lw || 3.4; ctx.strokeStyle = outline;
        ctx.lineJoin = 'round'; ctx.miterLimit = 2;
        ctx.strokeText(ch, -w / 2, 0);
      }
      ctx.fillStyle = fill;
      ctx.fillText(ch, -w / 2, 0);
      ctx.restore();
    }
    cx += w;
  }
  return cx - x;
}

/* ---------------------------------------------------------------------- */

const SPEAKER_NAMES = {
  norbert: 'NORBERT', gary: 'GARY', pippa: 'MME. PIPPA', steve: 'STEVE',
  beans: 'BEANS', glaze: 'GLAZE', council: 'MAYOR SOCK', thumb: '', narrator: '',
};

Dialogue.draw = function (ctx, W, H) {
  if (!Dialogue.active && Dialogue.boxY >= 0.999) return;
  const l = Dialogue.line;
  if (!l) return;

  const BH = 84;
  const slide = easeOutCubic(1 - Dialogue.boxY);
  const by = H - BH - 12 + (1 - slide) * (BH + 24);

  ctx.save();
  ctx.globalAlpha = slide;

  const bx = 22, bw = W - 44;
  const hasPortrait = l.who && PORTRAITS[l.who];
  const px = bx + 44;

  /* the box, rolled flat out of grey clay and pressed onto the screen */
  const pts = [];
  const per = 2 * (bw + BH);
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    let x, y;
    const d = t * per;
    if (d < bw) { x = bx + d; y = by; }
    else if (d < bw + BH) { x = bx + bw; y = by + (d - bw); }
    else if (d < 2 * bw + BH) { x = bx + bw - (d - bw - BH); y = by + BH; }
    else { x = bx; y = by + BH - (d - 2 * bw - BH); }
    const n = (fbm1(t * 9 + 3, 5, 2) - 0.5) * 4.4;
    pts.push({ x: x + n * 0.6, y: y + n });
  }
  ctx.save();
  ctx.shadowColor = 'rgba(10,4,16,0.55)';
  ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  Clay.slab(ctx, pts, '#e8dfc9', {
    seed: 12, prints: 46, markSize: 4.4, vert: true, vertH: BH * 1.5,
    edgeAlpha: 0.3, spec: false, rim: false, ao: false,
  });
  ctx.restore();

  /* portrait roundel */
  if (hasPortrait) {
    const cx0 = bx + 30, cy0 = by + BH / 2;
    Clay.blobPath(ctx, cx0, cy0, 27, 27, 71, 0.06, 0, 0.25, 24);
    Clay.material(ctx, { x: cx0 - 29, y: cy0 - 29, w: 58, h: 58 }, '#b9ac93',
      { seed: 71, prints: 4, edgeAlpha: 0.35 });
    ctx.save();
    Clay.blobPath(ctx, cx0, cy0, 24.5, 24.5, 71, 0.06, 0, 0.25, 24);
    ctx.clip();
    const pg = ctx.createLinearGradient(cx0 - 24, cy0 - 24, cx0 + 18, cy0 + 24);
    pg.addColorStop(0, '#5d5570'); pg.addColorStop(1, '#39304a');
    ctx.fillStyle = pg;
    ctx.fillRect(cx0 - 26, cy0 - 26, 52, 52);
    ctx.translate(cx0, cy0 + 14);
    ctx.scale(0.86, 0.86);
    const talking = !Dialogue.done;
    PORTRAITS[l.who](ctx, Dialogue.t + (l.pt || 0), talking);
    ctx.restore();
    ctx.strokeStyle = 'rgba(40,24,40,0.35)'; ctx.lineWidth = 1.2;
    Clay.blobPath(ctx, cx0, cy0, 24.5, 24.5, 71, 0.06, 0, 0.25, 24);
    ctx.stroke();
  }

  const tx = hasPortrait ? px + 24 : bx + 20;
  const tw = bx + bw - tx - 20;

  /* name plate */
  const nm = l.name !== undefined ? l.name : SPEAKER_NAMES[l.who];
  let ty = by + 24;
  if (nm) {
    ctx.font = '700 12px ' + UI_FONT;
    ctx.textBaseline = 'alphabetic';
    jitterTextOutlined(ctx, nm, tx, ty, 3, '#8e4a2e', 'rgba(255,248,230,0.75)', 2.6);
    ty += 20;
  } else {
    ty += 6;
  }

  /* the line itself */
  ctx.font = (l.style === 'shout' ? '700 17px ' : (l.style === 'soft' ? 'italic 14px ' : '600 14px ')) + UI_FONT;
  const shown = l.text.slice(0, Math.floor(Dialogue.chars));
  const lines = wrapText(ctx, l.text, tw);
  let count = Math.floor(Dialogue.chars);
  let seen = 0;
  const col = l.style === 'shout' ? '#a8321e' : (l.style === 'soft' ? '#6a5c66' : '#3c2c34');
  for (let i = 0; i < lines.length && i < 4; i++) {
    const full = lines[i];
    let part = full;
    if (seen + full.length > count) part = full.slice(0, Math.max(0, count - seen));
    seen += full.length + 1;
    const amt = l.style === 'shout' ? 1.5 : 0.55;
    ctx.fillStyle = col;
    jitterText(ctx, part, tx, ty + i * 19, i * 13 + 7, amt);
    if (part.length < full.length) break;
  }

  /* choices */
  if (Dialogue.choice && Dialogue.done) {
    ctx.font = '700 13px ' + UI_FONT;
    for (let i = 0; i < Dialogue.choice.length; i++) {
      const sel = i === Dialogue.choiceIdx;
      const cy1 = by + BH + 26 + i * 26 - Dialogue.choice.length * 26;
      const cw = ctx.measureText(Dialogue.choice[i].text).width + 34;
      const cxx = bx + bw - cw - 14;
      Clay.blobPath(ctx, cxx + cw / 2, cy1 - 4, cw / 2, 12, 30 + i, 0.07, 0, 0.2, 16);
      Clay.material(ctx, { x: cxx, y: cy1 - 18, w: cw, h: 28 },
        sel ? '#d8a25c' : '#b7ab95', { seed: 30 + i, prints: 3, edgeAlpha: 0.3 });
      ctx.fillStyle = sel ? '#3a2410' : '#4a4237';
      jitterText(ctx, Dialogue.choice[i].text, cxx + 18 + (sel ? 2 : 0), cy1, i * 9, 0.5);
      if (sel) {
        ctx.fillStyle = '#3a2410';
        ctx.beginPath();
        ctx.moveTo(cxx + 8, cy1 - 8); ctx.lineTo(cxx + 14, cy1 - 4); ctx.lineTo(cxx + 8, cy1);
        ctx.closePath(); ctx.fill();
      }
    }
  } else if (Dialogue.done) {
    /* a little clay arrow, bouncing */
    const ax = bx + bw - 26, ay = by + BH - 18 + Math.sin(Dialogue.hold * 6) * 2.4;
    ctx.save();
    ctx.translate(ax, ay);
    Clay.blob(ctx, { x: 0, y: 0, rx: 6, ry: 5, seed: 61, color: '#c07a3e', wob: 0.2, boil: 0.6, prints: 0 });
    ctx.fillStyle = 'rgba(60,32,20,0.75)';
    ctx.beginPath();
    ctx.moveTo(-2, -2.6); ctx.lineTo(2.6, 0); ctx.lineTo(-2, 2.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
};

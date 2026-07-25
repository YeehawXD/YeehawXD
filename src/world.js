/* =========================================================================
   NORBERT, UNFINISHED  --  world.js
   Tiles, physics, props, and the rules of being made of clay.
   ========================================================================= */

const TILE = 32;
const PLAYER_W = 26, PLAYER_H = 56;
const GRAV = 1150, MAXFALL = 620;

/* ======================================================================= */
/*  Level                                                                   */
/* ======================================================================= */

class Level {
  constructor(data) {
    this.data = data;
    this.theme = THEMES[data.theme];
    this.rows = data.tiles;
    this.h = this.rows.length;
    this.w = Math.max(...this.rows.map(r => r.length));
    this.rows = this.rows.map(r => r.padEnd(this.w, ' '));
    this.pxw = this.w * TILE;
    this.pxh = this.h * TILE;

    this.props = [];
    this.npcs = [];
    this.blobs = [];
    this.triggers = [];
    this.deco = (data.deco || []).slice();
    this.flags = {};

    for (const o of (data.objects || [])) this.addObject(o);

    this.buildShapes();
  }

  addObject(o) {
    const x = o.x * TILE + (o.ox || 0);
    const y = o.y * TILE + (o.oy || 0);
    if (o.t === 'npc') {
      this.npcs.push(makeNpc(o.kind, x, y, Object.assign({ id: o.id }, o.opts)));
    } else if (o.t === 'trigger') {
      this.triggers.push({
        id: o.id, x, y, w: (o.w || 1) * TILE, h: (o.h || 1) * TILE,
        once: o.once !== false, fired: false, script: o.script, act: o.act,
      });
    } else {
      this.props.push(Object.assign({
        kind: o.t, x, y, id: o.id, t: 0, state: 0, open: 0, on: false,
      }, o.opts || {}, { ox: undefined, oy: undefined }));
    }
  }

  at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return tx < 0 || tx >= this.w ? '#' : ' ';
    return this.rows[ty][tx];
  }
  solidAt(tx, ty) { const c = this.at(tx, ty); return c === '#' || c === 'X'; }
  /* strictly in-bounds -- the outline tracer needs closed loops, and the
     invisible walls that solidAt() reports off the edge of the map would
     leave the terrain boundary hanging open at x=0 and x=w. */
  rawSolid(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    const c = this.rows[ty][tx];
    return c === '#' || c === 'X';
  }
  platAt(tx, ty) { return this.at(tx, ty) === '='; }
  hazardAt(tx, ty) { const c = this.at(tx, ty); return c === '~' || c === '*'; }

  /* trace the tile grid once into sculpted outlines */
  buildShapes() {
    const loops = Clay.traceGrid((x, y) => this.rawSolid(x, y), this.w, this.h, TILE);
    const topH = (this.theme && this.theme.groundH) || 8;
    this.shapes = loops.map((l, i) => Clay.makeShape(Clay.handify(l, 2.2, 0.05, i * 3 + 5, 3), topH));
    /* one-way platforms: each horizontal run becomes a lolly stick */
    this.planks = [];
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        if (this.platAt(x, y)) {
          let x2 = x;
          while (this.platAt(x2 + 1, y)) x2++;
          this.planks.push({ x: x * TILE, y: y * TILE, w: (x2 - x + 1) * TILE, seed: x * 7 + y * 13 });
          x = x2 + 1;
        } else x++;
      }
    }
    /* pools of liquid: each horizontal run of ~ or * */
    this.pools = [];
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.at(x, y);
        if (c === '~' || c === '*') {
          let x2 = x;
          while (this.at(x2 + 1, y) === c) x2++;
          const top = this.at(x, y - 1) !== c;
          this.pools.push({ x: x * TILE, y: y * TILE, w: (x2 - x + 1) * TILE, kind: c, top, seed: x * 3 + y * 5 });
          x = x2 + 1;
        } else x++;
      }
    }
  }
}

/* ======================================================================= */
/*  Player                                                                  */
/* ======================================================================= */

function makePlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    w: PLAYER_W, h: PLAYER_H,
    grounded: false, coyote: 0, buffer: 0, wasGrounded: false,
    facing: 1,
    squish: 0, stretch: 0,
    charge: 0,
    mass: 4, maxMass: 4, capMass: 4,
    rig: makeNorbertRig(),
    lockT: 0, control: true,
    respawn: { x, y },
    hurt: 0, dissolve: 0,
    lobCool: 0, slurpCool: 0,
    stepT: 0,
    paint: null,
    marble: false,
  };
}

function playerScale(p) { return lerp(0.56, 1.0, clamp(p.mass / 4, 0, 1)); }

function playerBox(p) {
  const s = playerScale(p);
  let w = PLAYER_W * s, h = PLAYER_H * s;
  if (p.squish > 0.5) { h = 22 * s; w = PLAYER_W * s * 1.45; }
  else if (p.stretch > 0.5) { h = 84 * s; w = PLAYER_W * s * 0.8; }
  return { w, h };
}

/* ---- tile collision --------------------------------------------------- */

function tileSolid(lv, x, y) { return lv.solidAt(Math.floor(x / TILE), Math.floor(y / TILE)); }

function boxHitsSolid(lv, x, y, w, h) {
  const x0 = Math.floor((x - w / 2) / TILE), x1 = Math.floor((x + w / 2 - 0.01) / TILE);
  const y0 = Math.floor((y - h) / TILE), y1 = Math.floor((y - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (lv.solidAt(tx, ty)) return true;
  return false;
}

/* dynamic solids: stuck blobs and closed gates */
function dynamicSolids(lv) {
  const out = [];
  for (const b of lv.blobs) {
    if (b.stuck) out.push({ x: b.x - b.r * 0.95, y: b.y - b.r * 0.92, w: b.r * 1.9, h: b.r * 1.86, blob: b });
  }
  for (const p of lv.props) {
    if (p.kind === 'gate' && p.open < 0.55) {
      const gh = (p.hgt || 3) * TILE;
      out.push({ x: p.x, y: p.y - gh * (1 - p.open), w: (p.wid || 1) * TILE, h: gh });
    }
    if (p.kind === 'sponge') out.push({ x: p.x, y: p.y + (p.sink || 0), w: (p.wid || 2) * TILE, h: 14, oneWay: true, sponge: p });
    if (p.kind === 'lid') out.push({ x: p.x, y: p.y + Math.sin(p.t * (p.spd || 1)) * (p.amp || 0) , w: (p.wid || 2) * TILE, h: 12, oneWay: true, lid: p });
  }
  return out;
}

function boxHitsRects(rects, x, y, w, h, allowOneWay) {
  for (const r of rects) {
    if (r.oneWay && allowOneWay) continue;
    if (x - w / 2 < r.x + r.w && x + w / 2 > r.x && y - h < r.y + r.h && y > r.y) return r;
  }
  return null;
}

/* ---- the main update -------------------------------------------------- */

function updatePlayer(p, lv, dt, G) {
  const rig = p.rig;
  const s = playerScale(p);
  const solids = dynamicSolids(lv);

  if (p.lockT > 0) p.lockT -= dt;
  const canAct = p.control && p.lockT <= 0 && !Dialogue.active;

  /* --- abilities --- */
  const wantSquish = canAct && Input.held.down && !p.marble;
  const wantStretch = canAct && Input.held.up && p.grounded && !p.marble;

  /* you can only un-squish if there's room */
  let sq = p.squish, st = p.stretch;
  if (wantSquish) sq = approach(sq, 1, dt * 8);
  else {
    const b = { w: PLAYER_W * s, h: PLAYER_H * s };
    const blocked = boxHitsSolid(lv, p.x, p.y, b.w * 0.9, b.h) || boxHitsRects(solids, p.x, p.y, b.w * 0.9, b.h, true);
    if (!blocked) sq = approach(sq, 0, dt * 7);
  }
  if (wantStretch && sq < 0.2) st = approach(st, 1, dt * 5.5);
  else st = approach(st, 0, dt * 7);
  p.squish = sq; p.stretch = st;
  rig.squish = sq; rig.stretch = st;

  /* spring charge: hold down, then jump */
  if (sq > 0.85 && p.grounded) p.charge = Math.min(1, p.charge + dt * 1.5);
  else if (!wantSquish) p.charge = Math.max(0, p.charge - dt * 3);

  /* --- the ledge flop ---
     Stretched tall against a ledge, he pours himself over the top. This is
     what stretch is FOR; it reaches a tile higher than any jump can. */
  if (p.flop) {
    const f = p.flop;
    f.t += dt;
    const u = clamp(f.t / 0.34, 0, 1);
    const e = easeInOut(u);
    p.x = lerp(f.x0, f.x1, e);
    p.y = lerp(f.y0, f.y1, e) - Math.sin(u * Math.PI) * 12;
    p.vx = 0; p.vy = 0;
    p.stretch = 1 - u * 0.8; rig.stretch = p.stretch;
    rig.speed = 0; rig.air = 0;
    rig.facing = f.dir;
    p.facing = f.dir;
    if (u >= 1) {
      p.flop = null; p.stretch = 0; rig.stretch = 0;
      rig.vsy = -6; rig.vsx = 5;
      p.grounded = true;
      Sound.play('squelch', { pitch: 0.95, vol: 0.55 });
      FX.puff(p.x, p.y, 5, '#d3c2a8', 34);
    }
    rig.scale = s; rig.paint = p.paint;
    updateNorbertRig(rig, dt);
    return;
  }

  if (st > 0.8 && p.grounded && canAct && (Input.pressed.jump || Input.pressed.up)) {
    const dir = p.facing;
    const tx = Math.floor((p.x + dir * TILE * 1.1) / TILE);
    const feetRow = Math.floor((p.y - 1) / TILE);
    for (let up = 2; up <= 4; up++) {
      const r = feetRow - up + 1;
      const surfY = r * TILE;
      const rise = p.y - surfY;
      if (rise < 56 || rise > 116) continue;
      if (!lv.solidAt(tx, r)) continue;
      if (lv.solidAt(tx, r - 1) || lv.solidAt(tx, r - 2)) continue;
      p.flop = {
        t: 0, dir,
        x0: p.x, y0: p.y,
        x1: tx * TILE + TILE / 2, y1: surfY,
      };
      Sound.play('slurp');
      Cam.kick(1.2);
      break;
    }
  }

  const box = playerBox(p);

  /* --- horizontal --- */
  const ax = canAct ? Input.axis() : 0;
  const maxSpd = p.marble ? 210 : (sq > 0.5 ? 88 : (st > 0.5 ? 62 : 148)) * lerp(0.82, 1, s);
  const accel = p.grounded ? 1250 : 700;
  if (ax !== 0) {
    p.vx = approach(p.vx, ax * maxSpd, accel * dt);
    p.facing = ax;
  } else {
    p.vx = approach(p.vx, 0, (p.grounded ? (p.marble ? 320 : 1500) : 420) * dt);
  }

  /* --- jump --- */
  if (canAct && Input.pressed.jump) p.buffer = 0.13;
  p.buffer = Math.max(0, p.buffer - dt);
  if (p.grounded) p.coyote = 0.11; else p.coyote = Math.max(0, p.coyote - dt);

  if (p.buffer > 0 && p.coyote > 0 && st < 0.4) {
    const springs = p.charge > 0.35;
    const power = springs ? lerp(430, 660, p.charge) : 400;
    p.vy = -power * lerp(0.86, 1, s);
    p.buffer = 0; p.coyote = 0; p.grounded = false;
    p.charge = 0; p.squish = 0; rig.squish = 0;
    rig.vsy = springs ? 9 : 4.5;
    rig.vsx = springs ? -7 : -3.5;
    Sound.play('jump');
    if (springs) {
      Sound.play('squelch', { pitch: 0.7, vol: 0.8 });
      FX.puff(p.x, p.y, 10, '#d9c6a8', 70);
      Cam.kick(3);
    }
    FX.puff(p.x, p.y, 4, '#cbb9a0', 30);
  }
  if (Input.released.jump && p.vy < -120) p.vy *= 0.42;

  /* --- gravity --- */
  p.vy = Math.min(MAXFALL, p.vy + GRAV * dt * (p.vy < 0 && Input.held.jump ? 0.86 : 1));

  /* --- integrate + collide --- */
  let nx = p.x + p.vx * dt;
  if (boxHitsSolid(lv, nx, p.y, box.w, box.h) || boxHitsRects(solids, nx, p.y, box.w, box.h, true)) {
    /* step up small ledges so he doesn't snag on his own lumpiness */
    let stepped = false;
    for (let up = 2; up <= 8; up += 2) {
      if (!boxHitsSolid(lv, nx, p.y - up, box.w, box.h) && !boxHitsRects(solids, nx, p.y - up, box.w, box.h, true)
        && p.grounded) { p.y -= up; stepped = true; break; }
    }
    if (!stepped) { nx = p.x; p.vx = 0; }
  }
  p.x = nx;

  p.wasGrounded = p.grounded;
  p.grounded = false;
  let ny = p.y + p.vy * dt;

  if (p.vy >= 0) {
    /* falling: solids + one-way platforms + dynamic tops */
    const hit = boxHitsSolid(lv, p.x, ny, box.w, box.h);
    let landY = null;
    if (hit) {
      landY = Math.floor((ny - 0.01) / TILE) * TILE;
      /* walk down through the tile stack to find the exact surface */
      for (let ty = Math.floor((p.y - 0.01) / TILE); ty <= Math.floor((ny - 0.01) / TILE); ty++) {
        const x0 = Math.floor((p.x - box.w / 2) / TILE), x1 = Math.floor((p.x + box.w / 2 - 0.01) / TILE);
        let s2 = false;
        for (let tx = x0; tx <= x1; tx++) if (lv.solidAt(tx, ty)) s2 = true;
        if (s2) { landY = ty * TILE; break; }
      }
    }
    /* one-way tiles */
    if (!Input.held.down || sq < 0.9) {
      const x0 = Math.floor((p.x - box.w / 2 + 3) / TILE), x1 = Math.floor((p.x + box.w / 2 - 3) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        for (let ty = Math.floor((p.y - 1) / TILE); ty <= Math.floor(ny / TILE); ty++) {
          if (!lv.platAt(tx, ty)) continue;
          const top = ty * TILE;
          if (p.y <= top + 2 && ny >= top && (landY === null || top < landY)) landY = top;
        }
      }
      for (const r of solids) {
        if (p.x + box.w / 2 < r.x || p.x - box.w / 2 > r.x + r.w) continue;
        if (p.y <= r.y + 3 && ny >= r.y && (landY === null || r.y < landY)) {
          landY = r.y;
          if (r.sponge) r.sponge.pressed = true;
          if (r.blob) r.blob.pressed = true;
        }
      }
    }
    if (landY !== null) {
      ny = landY;
      if (!p.wasGrounded && p.vy > 180) {
        Sound.play('land', { vol: clamp(p.vy / 500, 0.3, 1) });
        FX.puff(p.x, ny, Math.round(clamp(p.vy / 90, 2, 9)), '#d3c2a8', 44);
        rig.vsy = -clamp(p.vy / 44, 2, 12);
        rig.vsx = clamp(p.vy / 52, 1.5, 10);
        if (p.vy > 430) Cam.kick(2.4);
      }
      p.vy = 0; p.grounded = true;
    }
  } else {
    if (boxHitsSolid(lv, p.x, ny, box.w, box.h) || boxHitsRects(solids, p.x, ny, box.w, box.h, true)) {
      ny = Math.ceil((ny - box.h) / TILE) * TILE + box.h + 0.1;
      /* nudge: if the head bonks on a corner, slide around it */
      if (boxHitsSolid(lv, p.x, ny, box.w, box.h)) ny = p.y;
      p.vy = 0;
      Sound.play('squelch', { pitch: 1.5, vol: 0.3 });
      rig.vsy = 5;
    }
  }
  p.y = ny;

  /* --- lob & slurp --- */
  p.lobCool = Math.max(0, p.lobCool - dt);
  p.slurpCool = Math.max(0, p.slurpCool - dt);

  if (canAct && Input.pressed.lob && p.lobCool <= 0 && p.mass > 0 && G.canLob) {
    p.mass--;
    p.lobCool = 0.24;
    const bs = playerScale(p);
    lv.blobs.push({
      x: p.x + p.facing * 12 * bs, y: p.y - box.h * 0.55,
      vx: p.facing * 250 + p.vx * 0.4, vy: -215,
      r: 11, stuck: false, t: 0, seed: Math.floor(Math.random() * 999),
      color: p.paint ? mixHex(NB_SKIN, p.paint, 0.8) : NB_SKIN, life: 0,
    });
    Sound.play('tear'); Sound.play('lob');
    FX.crumbs(p.x + p.facing * 10, p.y - box.h * 0.5, 7, NB_SKIN, 70);
    rig.vsx = 6; rig.vsy = -4;
    Cam.kick(1.4);
  }

  if (canAct && Input.pressed.slurp && G.canLob) {
    let got = 0;
    for (let i = lv.blobs.length - 1; i >= 0; i--) {
      const b = lv.blobs[i];
      if (b.locked) continue;
      if (dist(b.x, b.y, p.x, p.y - box.h * 0.5) < 132) { b.returning = true; got++; }
    }
    if (got) { Sound.play('slurp'); p.slurpCool = 0.3; }
  }

  /* --- hazards --- */
  const cx = Math.floor(p.x / TILE), cyy = Math.floor((p.y - box.h * 0.35) / TILE);
  const inWater = lv.at(cx, Math.floor((p.y - 6) / TILE)) === '~';
  const inHeat = lv.hazardAt(cx, cyy) && lv.at(cx, cyy) === '*';
  if (inWater) {
    p.dissolve += dt * 1.25;
    rig.wet = 1;
    if (Math.random() < dt * 20) FX.splash(p.x + shash1(Math.random() * 9) * 8, p.y - 4, 1, '#b8dcea');
    if (p.dissolve > 1) { G.reform(); }
  } else if (inHeat) {
    p.dissolve += dt * 0.9;
    if (Math.random() < dt * 16) FX.sparkle(p.x + shash1(Math.random() * 9) * 10, p.y - 20, 1, '#ff9c4a');
    if (p.dissolve > 1) { G.reform(); }
  } else p.dissolve = Math.max(0, p.dissolve - dt * 0.55);

  /* --- rig --- */
  rig.facing = p.facing;
  rig.speed = clamp(Math.abs(p.vx) / 130, 0, 1) * (p.grounded ? 1 : 0);
  rig.air = p.grounded ? 0 : clamp(p.vy / 300, -1, 1);
  rig.scale = s;
  rig.paint = p.paint;
  rig.mood = p.dissolve > 0.25 ? 'worried' : (p.moodOverride || (p.grounded ? 'neutral' : 'oh'));
  if (p.moodOverride) rig.mood = p.moodOverride;
  updateNorbertRig(rig, dt);

  /* footsteps */
  if (p.grounded && Math.abs(p.vx) > 30) {
    p.stepT -= dt * Math.abs(p.vx) / 44;
    if (p.stepT <= 0) { p.stepT = 1; Sound.play('step'); if (Math.random() > 0.6) FX.puff(p.x, p.y, 1, '#cbbca4', 14); }
  }
}

/* ---- blobs ------------------------------------------------------------ */

function updateBlobs(lv, p, dt, G) {
  const box = playerBox(p);
  for (let i = lv.blobs.length - 1; i >= 0; i--) {
    const b = lv.blobs[i];
    b.t += dt;
    b.pressed = false;

    if (b.returning) {
      const tx = p.x, ty = p.y - box.h * 0.5;
      const dx = tx - b.x, dy = ty - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 420 + b.t * 60;
      b.x += (dx / d) * sp * dt;
      b.y += (dy / d) * sp * dt;
      b.stuck = false;
      if (d < 16) {
        lv.blobs.splice(i, 1);
        if (p.mass < p.maxMass) p.mass++;
        Sound.play('squelch', { pitch: 1.25 });
        FX.puff(p.x, p.y - box.h * 0.5, 5, NB_SKIN, 40);
        p.rig.vsx = 5; p.rig.vsy = -3;
      }
      continue;
    }

    if (b.stuck) continue;

    b.vy = Math.min(MAXFALL, b.vy + GRAV * 0.9 * dt);
    let nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;

    const hitX = tileSolid(lv, nx + Math.sign(b.vx) * b.r, b.y);
    const hitY = tileSolid(lv, b.x, ny + Math.sign(b.vy) * b.r);
    if (hitX || hitY || (b.vy > 0 && lv.platAt(Math.floor(b.x / TILE), Math.floor((ny + b.r) / TILE)))) {
      b.stuck = true;
      if (hitY || !hitX) b.y = Math.floor((ny + b.r) / TILE) * TILE - b.r + 1;
      else b.x = nx;
      b.vx = 0; b.vy = 0;
      Sound.play('splat');
      FX.crumbs(b.x, b.y + b.r * 0.5, 5, b.color, 50);
      FX.puff(b.x, b.y + b.r, 3, '#cbbca4', 26);
      Cam.kick(1.2);
      continue;
    }
    b.x = nx; b.y = ny;

    /* fell out of the world */
    if (b.y > lv.pxh + 200) {
      lv.blobs.splice(i, 1);
      if (p.mass < p.maxMass) p.mass++;   // it comes back eventually. Don't ask.
    }
  }
}

/* ======================================================================= */
/*  Props                                                                   */
/* ======================================================================= */

function updateProps(lv, p, dt, G) {
  const box = playerBox(p);
  const pRect = { x: p.x - box.w / 2, y: p.y - box.h, w: box.w, h: box.h };

  /* which plates are pressed? */
  const plateWeight = {};
  for (const pr of lv.props) {
    pr.t += dt;
    if (pr.kind === 'plate') {
      let wgt = 0;
      const r = { x: pr.x, y: pr.y - 10, w: (pr.wid || 1) * TILE, h: 18 };
      if (rectsOverlap(pRect, r)) wgt += (p.squish > 0.6 ? 2 : 1) * (p.mass >= 2 ? 1 : 0.5);
      for (const b of lv.blobs) {
        if (!b.stuck) continue;
        if (b.x > r.x - 4 && b.x < r.x + r.w + 4 && Math.abs(b.y + b.r - pr.y) < 20) wgt += 1;
      }
      const need = pr.need || 1;
      const was = pr.on;
      pr.on = wgt >= need;
      pr.press = approach(pr.press || 0, pr.on ? 1 : 0, dt * 7);
      if (pr.on !== was) {
        Sound.play(pr.on ? 'plink' : 'pop', { freq: pr.on ? 760 : 400 });
        if (pr.on) FX.sparkle(pr.x + (pr.wid || 1) * TILE / 2, pr.y - 6, 8, '#ffd98a');
      }
      plateWeight[pr.id] = pr.on;
    }
    if (pr.kind === 'sponge') {
      const target = pr.pressed ? (pr.depth || 26) : 0;
      pr.sink = approach(pr.sink || 0, target, dt * (pr.pressed ? 40 : 70));
      pr.pressed = false;
    }
    if (pr.kind === 'spout') {
      /* a blob shoved in the hole stops the jet */
      let plugged = false;
      for (const b of lv.blobs) {
        if (b.stuck && dist(b.x, b.y, pr.x + 8, pr.y + 8) < 26) { plugged = true; b.locked = pr.permanent || false; }
      }
      pr.plugged = plugged;
      if (!plugged) {
        const dir = pr.dir || 'up';
        const len = pr.len || 3;
        const jx = pr.x + 8, jy = pr.y + 8;
        for (let k = 0; k < len * TILE; k += 10) {
          const px2 = jx + (dir === 'right' ? k : dir === 'left' ? -k : 0);
          const py2 = jy + (dir === 'up' ? -k : dir === 'down' ? k : 0);
          if (Math.abs(px2 - p.x) < box.w / 2 + 8 && py2 > p.y - box.h && py2 < p.y) {
            p.vx += (dir === 'right' ? 1 : dir === 'left' ? -1 : 0) * 900 * dt;
            if (dir === 'up') p.vy = Math.min(p.vy, -260);
            p.dissolve += dt * (pr.harm === false ? 0 : 0.8);
            if (p.dissolve > 1) G.reform();
          }
        }
        if (Math.random() < dt * 30) {
          const dir2 = pr.dir || 'up';
          FX.spawn({
            x: pr.x + 8, y: pr.y + 8, r: 1.6 + Math.random() * 2,
            vx: (dir2 === 'right' ? 1 : dir2 === 'left' ? -1 : 0) * (140 + Math.random() * 90) + shash1(Math.random() * 9) * 24,
            vy: (dir2 === 'up' ? -1 : dir2 === 'down' ? 1 : 0) * (200 + Math.random() * 120) + shash1(Math.random() * 3) * 20,
            g: 260, drag: 0.3, life: 0.5 + Math.random() * 0.4, max: 0.9,
            color: pr.color || '#cfe8f2', kind: 'drop',
          });
        }
      }
    }
    if (pr.kind === 'gate') {
      let open = false;
      if (pr.needFlag) open = !!lv.flags[pr.needFlag];
      else if (pr.plates) open = pr.plates.every(id => plateWeight[id]);
      else if (pr.needColor) open = p.paint === pr.needColor;
      const was = pr.open;
      pr.open = approach(pr.open, open ? 1 : 0, dt * (open ? 1.9 : 2.6));
      if (was < 0.02 && pr.open > 0.02) { Sound.play('whoosh'); Cam.kick(1.6); }
    }
    if (pr.kind === 'updraft') {
      const r = { x: pr.x, y: pr.y - (pr.hgt || 5) * TILE, w: (pr.wid || 2) * TILE, h: (pr.hgt || 5) * TILE };
      if (rectsOverlap(pRect, r)) {
        p.vy = Math.max(-330, p.vy - 1500 * dt);
        p.rig.jiggle = 1;
      }
    }
    if (pr.kind === 'vat') {
      const r = { x: pr.x, y: pr.y - 12, w: (pr.wid || 2) * TILE, h: 24 };
      if (rectsOverlap(pRect, r) && p.paint !== pr.color) {
        p.paint = pr.color;
        Sound.play('splat');
        FX.splash(p.x, p.y - 6, 14, pr.color);
        FX.text(p.x, p.y - 70, pr.label || 'SPLOSH', pr.color);
        Cam.kick(2);
      }
    }
    if (pr.kind === 'pot') {
      const d = dist(p.x, p.y, pr.x + 16, pr.y);
      if (d < 40 && !pr.lit) {
        pr.lit = true;
        p.respawn = { x: pr.x + 16, y: pr.y };
        Sound.play('chime');
        FX.sparkle(pr.x + 16, pr.y - 14, 16, '#ffe0a0');
        FX.text(pr.x + 16, pr.y - 44, 'a nice damp pot', '#ffe0a0');
        for (const q of lv.props) if (q.kind === 'pot' && q !== pr) q.lit = false;
      }
    }
    if (pr.kind === 'item' && !pr.taken) {
      if (dist(p.x, p.y - box.h * 0.5, pr.x + 12, pr.y) < 34) {
        pr.taken = true;
        Sound.play('chime');
        FX.sparkle(pr.x + 12, pr.y, 22, '#ffe6a8');
        FX.text(pr.x + 12, pr.y - 30, pr.label || 'got it', '#ffe6a8');
        if (pr.flag) lv.flags[pr.flag] = true;
        G.onItem && G.onItem(pr);
      }
    }
    if (pr.kind === 'exit') {
      const r = { x: pr.x, y: pr.y - (pr.hgt || 3) * TILE, w: (pr.wid || 1) * TILE, h: (pr.hgt || 3) * TILE };
      if (rectsOverlap(pRect, r) && !Dialogue.active && (!pr.needFlag || lv.flags[pr.needFlag])) {
        G.exitLevel(pr.to);
      }
    }
  }

  /* triggers */
  for (const tr of lv.triggers) {
    if (tr.fired && tr.once) continue;
    if (rectsOverlap(pRect, tr)) {
      tr.fired = true;
      if (tr.act) tr.act(G, lv, p);
      else if (tr.script) G.say(tr.script);
    }
  }
}

/* ======================================================================= */
/*  Drawing                                                                 */
/* ======================================================================= */

function drawLevel(ctx, lv, p, W, H, t) {
  const th = lv.theme;
  const cx = Cam.viewX(), cy = Cam.viewY();
  setClayLight(th.key, th.shadow);

  /* backdrop */
  ctx.save();
  th.back(ctx, { x: cx, y: cy }, W, H, t);
  ctx.restore();

  ctx.save();
  ctx.translate(-cx, -cy);

  /* far decorations */
  for (const d of lv.deco) if (d.layer === 'back') drawDeco(ctx, d, t);

  /* terrain */
  for (let i = 0; i < lv.shapes.length; i++) {
    Clay.terrain(ctx, lv.shapes[i], {
      color: lv.data.ground || th.ground,
      top: lv.data.groundTop || th.groundTop,
      topH: th.groundH,
      seed: i * 5 + 3,
      vertH: 150,
    });
  }

  /* one-way planks: lolly sticks and rulers */
  for (const pl of lv.planks) drawPlank(ctx, pl, lv);

  /* pools */
  for (const pool of lv.pools) drawPool(ctx, pool, t);

  /* mid decorations */
  for (const d of lv.deco) if (!d.layer || d.layer === 'mid') drawDeco(ctx, d, t);

  /* props behind characters */
  for (const pr of lv.props) if (PROP_BACK[pr.kind]) PROP_BACK[pr.kind](ctx, pr, t, lv);

  /* npcs */
  for (const n of lv.npcs) drawNpc(ctx, n);

  /* blobs */
  for (const b of lv.blobs) drawClayBlobEntity(ctx, b);

  /* player */
  if (p && !p.hidden) drawNorbert(ctx, p.rig, p.x, p.y);

  /* props in front */
  for (const pr of lv.props) if (PROP_FRONT[pr.kind]) PROP_FRONT[pr.kind](ctx, pr, t, lv);

  FX.draw(ctx);
  FX.drawText(ctx);

  /* near decorations */
  for (const d of lv.deco) if (d.layer === 'fore') drawDeco(ctx, d, t);

  ctx.restore();

  if (th.fore) { ctx.save(); th.fore(ctx, { x: cx, y: cy }, W, H, t); ctx.restore(); }
}

/* ---- terrain furniture ------------------------------------------------ */

function drawPlank(ctx, pl, lv) {
  const y = pl.y;
  /* a lolly stick: rounded ends, pale wood, one dark grain line */
  const pts = [];
  const n = Math.max(6, Math.round(pl.w / 12));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: pl.x + 2 + (pl.w - 4) * t, y: y + 1 + Math.sin(t * Math.PI) * -1.6 + shash1(i * 3 + pl.seed) * 0.8 });
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    pts.push({ x: pl.x + 2 + (pl.w - 4) * t, y: y + 12 + Math.sin(t * Math.PI) * 1.0 + shash1(i * 7 + pl.seed) * 0.8 });
  }
  Clay.slab(ctx, pts, '#d3b483', {
    seed: pl.seed, prints: Math.round(pl.w / 14), markSize: 3.2, vert: true, vertH: 20, edgeAlpha: 0.34,
  });
  ctx.save();
  ctx.beginPath(); smoothPath(ctx, pts, true); ctx.clip();
  ctx.strokeStyle = 'rgba(120,80,44,0.28)'; ctx.lineWidth = 0.9;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(pl.x, y + 4 + k * 3.2);
    for (let x = 0; x <= pl.w; x += 14) ctx.lineTo(pl.x + x, y + 4 + k * 3.2 + Math.sin(x * 0.08 + k + pl.seed) * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPool(ctx, pool, t) {
  const isWater = pool.kind === '~';
  ctx.save();
  const y = pool.y;
  const h = TILE;
  if (isWater) {
    const g = ctx.createLinearGradient(0, y, 0, y + h * 2.4);
    g.addColorStop(0, 'rgba(140,196,216,0.78)');
    g.addColorStop(0.4, 'rgba(84,146,178,0.86)');
    g.addColorStop(1, 'rgba(38,86,120,0.95)');
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(0, y - 8, 0, y + h);
    g.addColorStop(0, 'rgba(255,196,96,0.55)');
    g.addColorStop(0.5, 'rgba(226,104,38,0.75)');
    g.addColorStop(1, 'rgba(150,40,16,0.9)');
    ctx.fillStyle = g;
  }
  if (pool.top) {
    ctx.beginPath();
    ctx.moveTo(pool.x, y + h + 2);
    for (let x = 0; x <= pool.w; x += 8) {
      const wv = Math.sin((pool.x + x) * 0.06 + t * (isWater ? 2.2 : 3.4)) * 2.4
        + Math.sin((pool.x + x) * 0.021 - t * 1.3) * 1.8;
      ctx.lineTo(pool.x + x, y + wv);
    }
    ctx.lineTo(pool.x + pool.w, y + h + 2);
    ctx.closePath(); ctx.fill();
    /* surface line */
    ctx.strokeStyle = isWater ? 'rgba(220,248,255,0.55)' : 'rgba(255,222,150,0.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x <= pool.w; x += 8) {
      const wv = Math.sin((pool.x + x) * 0.06 + t * (isWater ? 2.2 : 3.4)) * 2.4
        + Math.sin((pool.x + x) * 0.021 - t * 1.3) * 1.8;
      if (x === 0) ctx.moveTo(pool.x + x, y + wv); else ctx.lineTo(pool.x + x, y + wv);
    }
    ctx.stroke();
    /* glints */
    ctx.fillStyle = isWater ? 'rgba(255,255,255,0.35)' : 'rgba(255,226,160,0.4)';
    for (let i = 0; i < pool.w / 30; i++) {
      const gx = pool.x + ((i * 61.3 + t * 12) % pool.w);
      const wv = Math.sin(gx * 0.06 + t * 2.2) * 2.4;
      ctx.beginPath(); ctx.ellipse(gx, y + wv - 1, 5 + Math.sin(t * 3 + i) * 2, 0.9, 0, 0, TAU); ctx.fill();
    }
  } else {
    ctx.fillRect(pool.x, y, pool.w, h + 1);
  }
  ctx.restore();
}

/* ---- props ------------------------------------------------------------ */

const PROP_BACK = {};
const PROP_FRONT = {};

PROP_BACK.gate = function (ctx, pr, t) {
  const gw = (pr.wid || 1) * TILE, gh = (pr.hgt || 3) * TILE;
  const y = pr.y - gh * (1 - pr.open);
  ctx.save();
  /* the slot it retracts into */
  ctx.fillStyle = 'rgba(18,9,22,0.6)';
  ctx.fillRect(pr.x - 3, pr.y - 7, gw + 6, 12);

  /* a slab with rounded, hand-pinched corners */
  const pts = [];
  const r = 7;
  const corner = (cx, cy, a0, a1) => {
    for (let i = 0; i <= 4; i++) {
      const a = lerp(a0, a1, i / 4);
      pts.push({ x: cx + Math.cos(a) * r + shash1(i * 3 + cx) * 1.1, y: cy + Math.sin(a) * r + shash1(i * 7 + cy) * 1.1 });
    }
  };
  corner(pr.x + r, y + r, Math.PI, Math.PI * 1.5);
  for (let i = 1; i < 4; i++) pts.push({ x: pr.x + r + (gw - 2 * r) * i / 4, y: y + shash1(i * 5) * 1.2 });
  corner(pr.x + gw - r, y + r, Math.PI * 1.5, Math.PI * 2);
  for (let i = 1; i < 6; i++) pts.push({ x: pr.x + gw + shash1(i * 9) * 1.2, y: y + r + (gh - 2 * r) * i / 6 });
  corner(pr.x + gw - r, y + gh - r, 0, Math.PI * 0.5);
  for (let i = 1; i < 4; i++) pts.push({ x: pr.x + gw - r - (gw - 2 * r) * i / 4, y: y + gh + shash1(i * 11) * 1.2 });
  corner(pr.x + r, y + gh - r, Math.PI * 0.5, Math.PI);
  for (let i = 1; i < 6; i++) pts.push({ x: pr.x + shash1(i * 13) * 1.2, y: y + gh - r - (gh - 2 * r) * i / 6 });

  Clay.slab(ctx, pts, pr.color || '#7d6a52', {
    seed: 14, prints: Math.round(gw * gh / 620), markSize: 4.6,
    vert: true, vertH: gh, ao: false, edgeAlpha: 0.4,
  });

  /* recessed panel + rivets, because it is a serious door */
  ctx.save();
  ctx.beginPath(); smoothPath(ctx, pts, true); ctx.clip();
  ctx.strokeStyle = 'rgba(24,12,26,0.30)'; ctx.lineWidth = 2;
  ctx.strokeRect(pr.x + 7, y + 9, gw - 14, gh - 18);
  ctx.strokeStyle = rgba(warmLight(pr.color || '#7d6a52', 0.4), 0.35); ctx.lineWidth = 1.1;
  ctx.strokeRect(pr.x + 8.4, y + 10.4, gw - 14, gh - 18);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,232,190,0.32)';
  const n = Math.max(2, Math.round(gh / 34));
  for (let i = 0; i < n; i++) {
    const ry = y + 11 + i * (gh - 22) / (n - 1);
    ctx.beginPath(); ctx.arc(pr.x + 6, ry, 2.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(pr.x + gw - 6, ry, 2.1, 0, TAU); ctx.fill();
  }
  /* a colour-coded lamp so you can see what it wants */
  if (pr.needColor) {
    const lit = pr.open > 0.5;
    const lx = pr.x + gw / 2, ly = y + gh * 0.5;
    const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 22);
    g.addColorStop(0, rgba(pr.needColor, lit ? 0.75 : 0.4));
    g.addColorStop(1, rgba(pr.needColor, 0));
    ctx.fillStyle = g; ctx.fillRect(lx - 24, ly - 24, 48, 48);
    Clay.blob(ctx, { x: lx, y: ly, rx: 7, ry: 7, seed: 19, color: pr.needColor, wob: 0.1, prints: 0 });
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(lx - 2.2, ly - 2.6, 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
};

PROP_BACK.plate = function (ctx, pr, t) {
  const w = (pr.wid || 1) * TILE;
  const d = (pr.press || 0) * 5;
  Clay.groundShadow(ctx, pr.x + w / 2, pr.y + 2, w * 0.6, 5, 0.32);
  /* a jar lid, upturned */
  ctx.save();
  ctx.translate(0, d);
  Clay.blob(ctx, {
    x: pr.x + w / 2, y: pr.y - 4, rx: w / 2, ry: 7, seed: 41,
    color: pr.on ? '#e0a24a' : '#9b8f7c', wob: 0.05, prints: 3,
  });
  ctx.strokeStyle = pr.on ? 'rgba(255,226,150,0.8)' : 'rgba(255,240,210,0.25)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(pr.x + w / 2, pr.y - 6, w / 2 - 4, 4, 0, 0, TAU); ctx.stroke();
  if (pr.on) {
    const g = ctx.createRadialGradient(pr.x + w / 2, pr.y - 6, 1, pr.x + w / 2, pr.y - 6, 42);
    g.addColorStop(0, 'rgba(255,206,120,0.30)'); g.addColorStop(1, 'rgba(255,206,120,0)');
    ctx.fillStyle = g; ctx.fillRect(pr.x + w / 2 - 44, pr.y - 50, 88, 88);
  }
  ctx.restore();
};

PROP_BACK.sponge = function (ctx, pr, t) {
  const w = (pr.wid || 2) * TILE;
  const y = pr.y + (pr.sink || 0);
  Clay.blob(ctx, { x: pr.x + w / 2, y: y + 9, rx: w / 2, ry: 10, seed: 55, color: '#e8c85a', wob: 0.09, prints: 0 });
  /* holes */
  ctx.save();
  Clay.blobPath(ctx, pr.x + w / 2, y + 9, w / 2, 10, 55, 0.09, 0, 0, 20);
  ctx.clip();
  for (let i = 0; i < w / 5; i++) {
    const hx = pr.x + hash1(i * 3.1) * w, hy = y + 1 + hash1(i * 7.7) * 16;
    const r = 1 + hash1(i * 2.3) * 2.6;
    ctx.fillStyle = 'rgba(140,104,20,0.4)';
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,0.3)';
    ctx.beginPath(); ctx.arc(hx - r * 0.3, hy - r * 0.4, r * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
};

PROP_BACK.pot = function (ctx, pr, t) {
  const x = pr.x + 16, y = pr.y;
  Clay.groundShadow(ctx, x, y + 1, 18, 5, 0.36);
  if (pr.lit) {
    const g = ctx.createRadialGradient(x, y - 14, 2, x, y - 14, 60);
    g.addColorStop(0, 'rgba(255,214,140,0.30)');
    g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 62, y - 76, 124, 124);
  }
  Clay.blob(ctx, { x, y: y - 11, rx: 14, ry: 12, seed: 62, color: '#a2694a', wob: 0.09, prints: 3 });
  Clay.blob(ctx, { x, y: y - 22, rx: 11, ry: 4, seed: 63, color: '#7d4e37', wob: 0.1, prints: 1 });
  ctx.fillStyle = pr.lit ? '#d0895c' : '#6b4433';
  ctx.beginPath(); ctx.ellipse(x, y - 23, 8, 2.6, 0, 0, TAU); ctx.fill();
  if (pr.lit) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.5 + i * 0.33) % 1;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.5;
      ctx.fillStyle = '#ffe2ae';
      ctx.beginPath(); ctx.arc(x + Math.sin(ph * 6 + i) * 5, y - 26 - ph * 22, 1.4, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
};

PROP_FRONT.spout = function (ctx, pr, t) {
  ctx.save();
  Clay.blob(ctx, { x: pr.x + 8, y: pr.y + 8, rx: 11, ry: 9, seed: 72, color: '#6d6a66', wob: 0.1, prints: 2 });
  ctx.fillStyle = pr.plugged ? '#8a4a2e' : '#181a1e';
  ctx.beginPath(); ctx.arc(pr.x + 8, pr.y + 8, 5.4, 0, TAU); ctx.fill();
  if (pr.plugged) {
    ctx.fillStyle = 'rgba(255,220,180,0.3)';
    ctx.beginPath(); ctx.arc(pr.x + 6.5, pr.y + 6.5, 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
};

PROP_FRONT.item = function (ctx, pr, t) {
  if (pr.taken) return;
  const y = pr.y - 6 + Math.sin(t * 2 + pr.x) * 3;
  const x = pr.x + 12;
  const g = ctx.createRadialGradient(x, y, 1, x, y, 34);
  g.addColorStop(0, 'rgba(255,226,150,0.34)');
  g.addColorStop(1, 'rgba(255,226,150,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 36, y - 36, 72, 72);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.4) * 0.16);
  const k = pr.icon || 'eye';
  if (k === 'eye') Clay.googlyEye(ctx, 0, 0, 9, Math.sin(t * 2) * 0.6, Math.cos(t * 1.7) * 0.5);
  else if (k === 'arm') Clay.limb(ctx, -10, 6, 9, -7, 3.4, 2.4, NB_SKIN, { seed: 80, bow: -3 });
  else if (k === 'bead') Clay.beadEye(ctx, 0, 0, 6, {});
  else if (k === 'sequin') {
    ctx.fillStyle = '#ffd75e'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(-2, -2.4, 2.4, 0, TAU); ctx.fill();
  } else {
    Clay.blob(ctx, { x: 0, y: 0, rx: 8, ry: 8, seed: 88, color: '#e0b45a', wob: 0.2, boil: 0.7, prints: 1 });
  }
  ctx.restore();
};

PROP_FRONT.sign = function (ctx, pr, t) {
  const x = pr.x + 16, y = pr.y;
  Clay.limb(ctx, x, y, x, y - 30, 2.6, 2.2, '#7a5b3a', { seed: 45, bow: 0.6, prints: 0 });
  ctx.save();
  ctx.translate(x, y - 42);
  ctx.rotate(Math.sin(t * 0.8) * 0.03 - 0.03);
  const lines = (pr.text || '').split('|');
  ctx.font = '700 10px ' + UI_FONT;
  let tw = 0;
  for (const L of lines) tw = Math.max(tw, ctx.measureText(L).width);
  const sw = Math.max(30, tw / 2 + 9), sh = lines.length * 6.4 + 8;
  Clay.blob(ctx, { x: 0, y: 0, rx: sw, ry: sh, seed: 46, color: '#e2d2a8', wob: 0.07, prints: 4, ao: false });
  ctx.fillStyle = '#5a4230';
  for (let i = 0; i < lines.length; i++) {
    jitterText(ctx, lines[i], -ctx.measureText(lines[i]).width / 2, 3.4 + i * 11 - (lines.length - 1) * 5.5, i * 7, 0.4);
  }
  ctx.textAlign = 'left';
  ctx.restore();
};

PROP_FRONT.vat = function (ctx, pr, t) {
  const w = (pr.wid || 2) * TILE;
  ctx.save();
  /* the tray it has been poured into: an upturned jar lid */
  Clay.blob(ctx, {
    x: pr.x + w / 2, y: pr.y + 7, rx: w / 2 + 5, ry: 11, seed: 84,
    color: '#8e8577', wob: 0.05, prints: 3, ao: false,
  });
  const glow = ctx.createRadialGradient(pr.x + w / 2, pr.y - 2, 2, pr.x + w / 2, pr.y - 2, w * 0.9);
  glow.addColorStop(0, rgba(pr.color, 0.30));
  glow.addColorStop(1, rgba(pr.color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(pr.x - w, pr.y - w, w * 3, w * 2);
  const g = ctx.createLinearGradient(0, pr.y - 10, 0, pr.y + 12);
  g.addColorStop(0, warmLight(pr.color, 0.2));
  g.addColorStop(1, coolShade(pr.color, 0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(pr.x, pr.y + 12);
  for (let x = 0; x <= w; x += 7) {
    ctx.lineTo(pr.x + x, pr.y - 4 + Math.sin((pr.x + x) * 0.08 + t * 2.6) * 2.2);
  }
  ctx.lineTo(pr.x + w, pr.y + 12);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba(warmLight(pr.color, 0.5), 0.7); ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 7) {
    const yy = pr.y - 4 + Math.sin((pr.x + x) * 0.08 + t * 2.6) * 2.2;
    if (x === 0) ctx.moveTo(pr.x + x, yy); else ctx.lineTo(pr.x + x, yy);
  }
  ctx.stroke();
  /* bloops */
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.6 + i * 0.37) % 1;
    const bx = pr.x + 12 + ((i * 37) % (w - 24));
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.7;
    ctx.fillStyle = warmLight(pr.color, 0.35);
    ctx.beginPath(); ctx.arc(bx, pr.y - 4 - ph * 7, 2 + ph * 3, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

PROP_FRONT.updraft = function (ctx, pr, t) {
  const w = (pr.wid || 2) * TILE, h = (pr.hgt || 5) * TILE;
  ctx.save();
  const g = ctx.createLinearGradient(0, pr.y, 0, pr.y - h);
  g.addColorStop(0, 'rgba(255,168,80,0.34)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(pr.x, pr.y - h, w, h);
  for (let i = 0; i < 12; i++) {
    const ph = ((t * 0.75 + i * 0.083) % 1);
    const px = pr.x + 6 + ((i * 53) % (w - 12)) + Math.sin(t * 3 + i) * 5;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.55;
    ctx.fillStyle = '#ffcf8a';
    ctx.beginPath(); ctx.ellipse(px, pr.y - ph * h, 1.6, 5 + ph * 5, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

PROP_FRONT.lid = PROP_BACK.plate ? function (ctx, pr, t) {
  const w = (pr.wid || 2) * TILE;
  const y = pr.y + Math.sin(pr.t * (pr.spd || 1)) * (pr.amp || 0);
  Clay.blob(ctx, { x: pr.x + w / 2, y: y + 6, rx: w / 2, ry: 7, seed: 91, color: pr.color || '#b4483c', wob: 0.05, prints: 2 });
  ctx.strokeStyle = 'rgba(255,236,200,0.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(pr.x + w / 2, y + 4, w / 2 - 4, 3.4, 0, 0, TAU); ctx.stroke();
} : null;

/* ---- decoration painters ---------------------------------------------- */

function drawDeco(ctx, d, t) {
  const f = DECO[d.k];
  if (f) {
    ctx.save();
    if (d.a) { ctx.translate(d.x, d.y); ctx.rotate(d.a); ctx.translate(-d.x, -d.y); }
    if (d.alpha !== undefined) ctx.globalAlpha = d.alpha;
    f(ctx, d.x, d.y, d, t);
    ctx.restore();
  }
}

const DECO = {
  pencil(ctx, x, y, d) {
    const L = d.len || 120, a = d.rot || 0;
    const x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L;
    Clay.limb(ctx, x, y, x2, y2, 8, 8, d.color || '#e0b73c', { seed: 31, bow: 0, prints: 2, lumpy: false });
    /* the sharpened end */
    ctx.save();
    ctx.translate(x2, y2); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(20, 0); ctx.lineTo(0, 8); ctx.closePath();
    ctx.fillStyle = '#d8b98e'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, -3.2); ctx.lineTo(20, 0); ctx.lineTo(13, 3.2); ctx.closePath();
    ctx.fillStyle = '#3a3a42'; ctx.fill();
    ctx.restore();
    /* ferrule + eraser */
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = '#b6bcc2'; ctx.fillRect(-14, -8.4, 15, 16.8);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-14, -8.4, 15, 4);
    Clay.blob(ctx, { x: -19, y: 0, rx: 7, ry: 8, seed: 32, color: '#d2647a', wob: 0.1, prints: 1 });
    ctx.restore();
  },
  eraser(ctx, x, y, d) {
    Clay.blob(ctx, { x, y, rx: d.w || 26, ry: d.h || 14, seed: 33, color: d.color || '#e2dcc8', wob: 0.06, prints: 5, markSize: 4 });
    ctx.fillStyle = 'rgba(90,70,60,0.18)';
    ctx.beginPath(); ctx.ellipse(x + (d.w || 26) * 0.4, y, (d.w || 26) * 0.3, (d.h || 14) * 0.5, 0, 0, TAU); ctx.fill();
  },
  button(ctx, x, y, d) {
    Clay.buttonEye(ctx, x, y, d.r || 14, d.rot || 0.3, { color: d.color || '#7ab0c4' });
  },
  paperclip(ctx, x, y, d) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(d.rot || 0);
    ctx.strokeStyle = '#3a4048'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p = () => {
      ctx.beginPath();
      ctx.moveTo(-16, 10); ctx.lineTo(-16, -8);
      ctx.quadraticCurveTo(-16, -14, -9, -14); ctx.lineTo(6, -14);
      ctx.quadraticCurveTo(13, -14, 13, -7); ctx.lineTo(13, 6);
      ctx.quadraticCurveTo(13, 11, 6, 11); ctx.lineTo(-5, 11);
      ctx.quadraticCurveTo(-10, 11, -10, 6); ctx.lineTo(-10, -6);
      ctx.stroke();
    };
    p();
    ctx.strokeStyle = '#98a4ae'; ctx.lineWidth = 3.2; p();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.1;
    ctx.translate(-0.8, -1.2); p();
    ctx.restore();
  },
  thread(ctx, x, y, d, t) {
    ctx.strokeStyle = d.color || '#c85a7a';
    ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    const L = d.len || 200;
    for (let i = 1; i <= 16; i++) {
      const u = i / 16;
      ctx.lineTo(x + u * L, y + Math.sin(u * 7 + (d.ph || 0)) * 14 * Math.sin(u * Math.PI) + u * (d.drop || 0));
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(warmLight(d.color || '#c85a7a', 0.4), 0.6);
    ctx.lineWidth = 0.9;
    ctx.stroke();
  },
  domino(ctx, x, y, d) {
    Clay.blob(ctx, { x, y, rx: 13, ry: 26, seed: 36, color: '#2d2b33', wob: 0.03, prints: 2 });
    ctx.strokeStyle = 'rgba(230,230,230,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.stroke();
    ctx.fillStyle = '#e8e6e0';
    const dots = [[-5, -18], [5, -18], [-5, -8], [5, -8], [0, 10], [-5, 18], [5, 18]];
    for (let i = 0; i < (d.n || 5); i++) {
      ctx.beginPath(); ctx.arc(x + dots[i][0], y + dots[i][1], 2.4, 0, TAU); ctx.fill();
    }
  },
  cotton(ctx, x, y, d) {
    const r = d.r || 20;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.globalAlpha = 0.5;
      Clay.blob(ctx, {
        x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.4,
        rx: r * 0.55, ry: r * 0.5, seed: 37 + i, color: '#f2eee4', wob: 0.3, prints: 0, edge: false,
      });
    }
    ctx.globalAlpha = 1;
    Clay.blob(ctx, { x, y, rx: r * 0.75, ry: r * 0.62, seed: 38, color: '#faf7ee', wob: 0.22, prints: 0, edge: false });
  },
  splat(ctx, x, y, d) {
    const c = d.color || '#d94f9c';
    Clay.blob(ctx, { x, y, rx: d.r || 22, ry: (d.r || 22) * 0.42, seed: 39 + x, color: c, wob: 0.36, prints: 2, edgeAlpha: 0.2 });
    for (let i = 0; i < 6; i++) {
      const a = hash1(i * 3 + x) * TAU, dd = (d.r || 22) * (1.1 + hash1(i + x) * 1.3);
      Clay.blob(ctx, {
        x: x + Math.cos(a) * dd, y: y + Math.sin(a) * dd * 0.4,
        rx: 1.4 + hash1(i * 7 + x) * 3.6, ry: 1 + hash1(i * 5 + x) * 2, seed: i + x, color: c, wob: 0.3, prints: 0,
      });
    }
  },
  bead(ctx, x, y, d) {
    const c = d.color || '#5aa8c8';
    Clay.blob(ctx, { x, y, rx: d.r || 8, ry: (d.r || 8) * 0.95, seed: 40 + x, color: c, wob: 0.04, prints: 0 });
    ctx.fillStyle = 'rgba(30,20,30,0.6)';
    ctx.beginPath(); ctx.ellipse(x, y, (d.r || 8) * 0.28, (d.r || 8) * 0.24, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(x - (d.r || 8) * 0.35, y - (d.r || 8) * 0.4, (d.r || 8) * 0.2, 0, TAU); ctx.fill();
  },
  jar(ctx, x, y, d, t) {
    const c = d.color || '#3fb2c9';
    const w = d.w || 34, h = d.h || 46;
    const g = ctx.createRadialGradient(x, y - h * 0.4, 2, x, y - h * 0.4, h * 2.2);
    g.addColorStop(0, rgba(c, 0.34)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - h * 2.4, y - h * 2.6, h * 4.8, h * 4.8);
    Clay.blob(ctx, { x, y: y - h * 0.45, rx: w / 2, ry: h / 2, seed: 43 + x, color: c, wob: 0.05, prints: 1, edgeAlpha: 0.25 });
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(x - w * 0.24, y - h * 0.5, w * 0.1, h * 0.24, 0, 0, TAU); ctx.fill();
    Clay.blob(ctx, { x, y: y - h * 0.92, rx: w * 0.42, ry: 6, seed: 44 + x, color: '#c8c2b2', wob: 0.06, prints: 1 });
  },
  brush(ctx, x, y, d) {
    const a = d.rot || -1.2, L = d.len || 90;
    const x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L;
    Clay.limb(ctx, x, y, x2, y2, 4.5, 3.4, '#6b4a2e', { seed: 47, bow: 1, prints: 1 });
    ctx.save(); ctx.translate(x2, y2); ctx.rotate(a);
    ctx.fillStyle = '#a8b0b8'; ctx.fillRect(-2, -4, 10, 8);
    Clay.blob(ctx, { x: 12, y: 0, rx: 8, ry: 5, seed: 48, color: d.color || '#b8563f', wob: 0.2, rot: 0, prints: 0 });
    ctx.restore();
  },
  crumple(ctx, x, y, d) {
    const r = d.r || 26;
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const rr = r * (0.7 + hash1(i * 3.1 + x) * 0.55);
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.85 });
    }
    Clay.slab(ctx, pts, d.color || '#e6e0cc', { seed: 49 + x, prints: 10, markSize: 4, vert: true, vertH: r * 2 });
    ctx.strokeStyle = 'rgba(120,110,90,0.3)'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 7; i++) {
      const a = hash1(i * 5 + x) * TAU;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.8);
      ctx.stroke();
    }
  },
};

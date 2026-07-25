/* =========================================================================
   NORBERT, UNFINISHED  --  game.js
   Scene manager, story beats, and the loop that ties it all together.
   ========================================================================= */

const VIEW_W = 576, VIEW_H = 324, RENDER_SCALE = 1920 / 576;

const G = {
  state: 'title',
  t: 0, dt: 0,
  level: null, player: null,
  eyes: 0, canLob: false,
  menu: ['BEGIN', 'CONTROLS', 'MUTE: OFF'],
  menuIdx: 0,
  pauseMenu: ['RESUME', 'RESTART CHAPTER', 'MUTE', 'QUIT TO TITLE'],
  pauseIdx: 0,
  titleRig: null,
  endRig: null,
  endT: 0, credT: 0,
  endLines: [],
  cine: null,
  showControls: false,
  frameAcc: 0,
  visited: {},
};

/* ---------------------------------------------------------------------- */

G.say = function (script) {
  if (Dialogue.active) return;
  Dialogue.start(script);
};

G.tip = function (text, dur) {
  UI.tip = text; UI.tipT = dur || 3; UI.tipMax = dur || 3;
};

G.chapterCard = function (data) {
  UI.card = { chapter: data.chapter, title: data.title, clock: data.clock, t: 0, hold: 2.6 };
};

G.loadLevel = function (id, skipCard) {
  const data = LEVELS[id];
  const lv = new Level(data);
  G.level = lv;
  FX.clear();
  const first = !G.visited[id];
  G.visited[id] = true;

  const p = G.player || makePlayer(0, 0);
  p.x = data.spawn.x * TILE; p.y = data.spawn.y * TILE;
  p.vx = 0; p.vy = 0; p.dissolve = 0; p.squish = 0; p.stretch = 0; p.charge = 0;
  p.control = true; p.lockT = 0; p.hidden = false; p.flop = null;
  p.mass = p.maxMass;
  p.respawn = { x: p.x, y: p.y };
  p.paint = null;
  p.moodOverride = null;
  G.player = p;

  Cam.bounds = { x: 0, y: 0, w: lv.pxw, h: lv.pxh };
  Cam.snap(p.x, p.y, VIEW_W, VIEW_H);

  Sound.music(lv.theme.music);
  if (!skipCard) G.chapterCard(data);
  if (first && data.intro) setTimeout(() => G.say(data.intro), 900);
};

G.exitLevel = function (to) {
  if (Wipe.active) return;
  Sound.play('whoosh');
  Wipe.go(() => {
    if (!to) { G.startEnding(); return; }
    G.loadLevel(to);
  }, '#2a1626');
};

G.reform = function () {
  const p = G.player;
  Sound.play('sad');
  FX.crumbs(p.x, p.y - 20, 22, NB_SKIN, 150);
  FX.puff(p.x, p.y - 16, 12, '#b8d4e0', 70);
  Cam.kick(6);
  p.x = p.respawn.x; p.y = p.respawn.y;
  p.vx = 0; p.vy = 0; p.dissolve = 0;
  p.mass = p.maxMass;
  p.paint = null;
  p.rig.vsy = 8; p.rig.vsx = -5;
  if (G.level) G.level.blobs.length = 0;
  Cam.snap(p.x, p.y, VIEW_W, VIEW_H);
  FX.text(p.x, p.y - 60, 're-formed', '#cfe8f2');
};

G.onItem = function (pr) {
  if (pr.eye) { G.eyes++; UI.toastEyes = 1.6; }
};

/* ---- story acts ------------------------------------------------------- */

const ACTS = {
  beansfriend() { G.level.flags.beansFriend = true; FX.heart(G.player.x, G.player.y - 60); },

  givePippa() {
    const p = G.player;
    p.maxMass = Math.min(p.maxMass, 3);
    p.mass = Math.min(p.mass, p.maxMass);
    G.level.flags.pippaDone = true;
    const pip = G.level.npcs.find(n => n.id === 'pippa');
    if (pip) { pip.hasLeg = false; pip.clayLeg = true; }
    Sound.play('tear');
    Sound.play('shrink');
    FX.crumbs(p.x, p.y - 30, 14, NB_SKIN, 110);
    for (let i = 0; i < 6; i++) FX.heart(pip ? pip.x : p.x, (pip ? pip.y : p.y) - 40 - i * 6);
    Cam.kick(4);
    FX.text(p.x, p.y - 76, '−1 forever', '#ffb0b0');
  },

  pippaLoop() {
    const tr = G.level.triggers.find(t => t.id === 'meetpippa');
    if (tr) tr.fired = false;
  },

  plugDrain() {
    const p = G.player;
    p.maxMass = Math.min(p.maxMass, 2);
    p.mass = Math.min(p.mass, p.maxMass);
    G.level.flags.drainDone = true;
    Sound.play('tear'); Sound.play('shrink'); Sound.play('thud');
    FX.crumbs(p.x, p.y - 30, 18, NB_SKIN, 130);
    Cam.kick(7);
    FX.text(p.x, p.y - 76, '−1 forever', '#ffb0b0');
    const b = G.level.npcs.find(n => n.id === 'beans2');
    if (b) { b.hoppy = true; for (let i = 0; i < 5; i++) FX.heart(b.x, b.y - 30 - i * 8); }
  },

  drainAgain() {
    const tr = G.level.triggers.find(t => t.id === 'drain');
    if (tr) tr.fired = false;
  },

  refuse() {
    G.level.flags.councilDone = true;
    Sound.play('uiBig');
    Cam.kick(3);
  },

  councilAgain() {
    const tr = G.level.triggers.find(t => t.id === 'council');
    if (tr) tr.fired = false;
  },

  erupt() {
    const v = G.level.npcs.find(n => n.id === 'volcano');
    if (v) v.erupt = 1;
    Sound.play('whoosh'); Sound.play('thud');
    Cam.kick(8);
    const x = v ? v.x : G.player.x, y = v ? v.y - 40 : G.player.y;
    for (let i = 0; i < 60; i++) FX.sparkle(x, y, 1, i % 3 ? '#fff6ea' : '#ffd9b0');
  },
};

Dialogue.onAct = function (name) { if (ACTS[name]) ACTS[name](); };

/* ---- set pieces ------------------------------------------------------- */

G.thumbScene = function () {
  const p = G.player;
  p.control = false;
  p.moodOverride = 'worried';
  const th = makeNpc('thumb', p.x + 130, 12 * TILE, { desc: 0, scale: 0.72, autoFace: false });
  G.level.npcs.push(th);
  G.cine = { name: 'thumb', t: 0, th };
  Sound.stopMusic();
  G.say(SCRIPTS.thumbIntro);
};

G.updateThumb = function (dt) {
  const c = G.cine, th = c.th, p = G.player;
  c.t += dt;
  const t = c.t;
  if (t < 3.2) {
    th.desc = smootherstep(t / 3.2) * 0.86;
    Cam.kick(0.4 + t * 0.5);
    if (Math.random() < dt * 8) FX.puff(p.x + shash1(Math.random() * 9) * 90, 12 * TILE, 1, '#c9b89c', 30);
  } else if (t < 3.7) {
    th.desc = 0.86 + (t - 3.2) / 0.5 * 0.14;
    if (!c.hit && th.desc >= 0.99) {
      c.hit = true;
      Sound.play('thud'); Sound.play('squelch', { pitch: 0.4, vol: 1 });
      Cam.kick(16);
      FX.puff(th.x, 12 * TILE, 40, '#c9b89c', 200);
      FX.crumbs(th.x, 12 * TILE, 24, '#8a5f3c', 220);
    }
  } else if (t < 5.4) {
    th.desc = 1;
    p.moodOverride = 'oh';
  } else if (t < 7.6) {
    th.desc = 1 - smootherstep((t - 5.4) / 2.2);
  } else {
    G.level.npcs = G.level.npcs.filter(n => n !== th);
    G.cine = null;
    p.control = true;
    p.moodOverride = null;
    Sound.music(G.level.theme.music);
    G.say(SCRIPTS.thumbAfter);
  }
};

G.finale = function () {
  const p = G.player;
  p.control = false;
  p.moodOverride = 'neutral';
  const th = makeNpc('thumb', p.x + 34, 11 * TILE, { desc: 0, scale: 0.66, tilt: -0.05, autoFace: false });
  G.level.npcs.push(th);
  G.cine = { name: 'finale', t: 0, th };
  Sound.stopMusic();
};

G.updateFinale = function (dt) {
  const c = G.cine, th = c.th, p = G.player;
  c.t += dt;
  const t = c.t;
  p.vx = 0;
  if (t < 1.2) {
    p.rig.look.x = 0.7; p.rig.look.y = -0.9;
  } else if (t < 5.0) {
    th.desc = smootherstep((t - 1.2) / 3.8) * 0.94;
    p.moodOverride = t > 3.4 ? 'oh' : 'worried';
    p.rig.look.y = -1;
  } else if (t < 6.4) {
    th.desc = 0.94 + smootherstep((t - 5.0) / 1.4) * 0.06;
    p.moodOverride = 'neutral';
    if (!c.lift && t > 6.2) {
      c.lift = true;
      Sound.play('squelch', { pitch: 0.9, vol: 0.7 });
      FX.sparkle(p.x, p.y - 30, 20, '#ffe6b8');
    }
  } else if (t < 9.0) {
    const u = smootherstep((t - 6.4) / 2.6);
    th.desc = 1 - u;
    p.hidden = true;
    if (!c.gone) { c.gone = true; p.moodOverride = 'happy'; }
  } else {
    G.startEnding();
  }
};

G.startEnding = function () {
  G.endRig = makeNorbertRig();
  G.endRig.mood = 'happy';
  G.endRig.scale = 1.9;
  G.endRig.look.x = 0.2;
  G.endT = 0;
  G.endLines = [
    'She did not put him in the kiln.',
    'She put him in her coat pocket.',
    'He is still in there.',
    'He is still not finished.',
  ];
  G.state = 'ending';
  Sound.music('dawn');
};

/* ---------------------------------------------------------------------- */
/*  Update                                                                  */
/* ---------------------------------------------------------------------- */

G.update = function (dt) {
  G.t += dt;
  Clay.time = G.t;
  /* stop-motion: character animation is re-posed twelve times a second */
  G.frameAcc += dt;
  while (G.frameAcc >= 1 / 12) { G.frameAcc -= 1 / 12; Clay.frame++; }

  Input.gamepad();
  Wipe.update(dt);
  if (UI.tipT > 0) UI.tipT -= dt;
  if (UI.card) { UI.card.t += dt; if (UI.card.t > UI.card.hold + 0.8) UI.card = null; }

  if (Input.pressed.mute) { Sound.setMuted(!Sound.muted); G.menu[2] = 'MUTE: ' + (Sound.muted ? 'ON' : 'OFF'); }

  switch (G.state) {
    case 'title': G.updateTitle(dt); break;
    case 'play': G.updatePlay(dt); break;
    case 'pause': G.updatePause(dt); break;
    case 'ending':
      G.endT += dt;
      G.endRig.look.x = Math.sin(G.t * 0.5) * 0.4;
      updateNorbertRig(G.endRig, dt);
      if (G.endT > G.endLines.length * 2.4 + 6 || Input.pressed.jump && G.endT > 6) {
        G.state = 'credits'; G.credT = 0;
      }
      break;
    case 'credits':
      G.credT += dt;
      if (Input.pressed.jump && G.credT > 3) { G.state = 'title'; G.reset(); }
      break;
  }
  Input.endFrame();
};

G.updateTitle = function (dt) {
  if (!G.titleRig) {
    G.titleRig = makeNorbertRig();
    G.titleRig.scale = 1.5;
  }
  const n = G.titleRig;
  n.look.x = Math.sin(G.t * 0.6) * 0.5;
  n.look.y = Math.sin(G.t * 0.43 + 1) * 0.3;
  n.mood = (G.t % 7) > 6.2 ? 'happy' : 'neutral';
  if (Math.sin(G.t * 0.7) > 0.98) n.jiggle = 1;
  updateNorbertRig(n, dt);

  if (G.showControls) {
    if (Input.pressed.jump || Input.pressed.talk || Input.pressed.pause) { G.showControls = false; Sound.play('ui'); }
    return;
  }
  if (Input.pressed.up) { G.menuIdx = (G.menuIdx + G.menu.length - 1) % G.menu.length; Sound.play('ui'); }
  if (Input.pressed.down) { G.menuIdx = (G.menuIdx + 1) % G.menu.length; Sound.play('ui'); }
  if (Input.pressed.jump || Input.pressed.talk) {
    Sound.play('uiBig');
    if (G.menuIdx === 0) {
      Wipe.go(() => { G.state = 'play'; G.reset(); G.loadLevel('sill'); }, '#2a1626');
    } else if (G.menuIdx === 1) {
      G.showControls = true;
    } else {
      Sound.setMuted(!Sound.muted);
      G.menu[2] = 'MUTE: ' + (Sound.muted ? 'ON' : 'OFF');
    }
  }
};

G.reset = function () {
  G.player = makePlayer(0, 0);
  G.eyes = 0; G.canLob = false; G.visited = {};
  FX.clear();
};

G.updatePlay = function (dt) {
  const lv = G.level, p = G.player;
  if (!lv) return;

  if (Input.pressed.pause && !G.cine) { G.state = 'pause'; G.pauseIdx = 0; Sound.play('ui'); return; }

  Dialogue.update(dt);
  Cam.update(dt);

  if (G.cine) {
    if (G.cine.name === 'thumb') G.updateThumb(dt);
    else if (G.cine.name === 'finale') G.updateFinale(dt);
  }

  updatePlayer(p, lv, dt, G);
  updateBlobs(lv, p, dt, G);
  updateProps(lv, p, dt, G);
  for (const n of lv.npcs) {
    updateNpc(n, dt, p);
    if (n.erupt > 0) n.erupt = Math.max(0, n.erupt - dt * 0.12);
  }
  if (Dialogue.active && Dialogue.line && Dialogue.line.who) {
    const sp = lv.npcs.find(n => n.kind === Dialogue.line.who || n.id === Dialogue.line.who);
    if (sp) sp.talk = 0.2;
  }
  FX.update(dt);

  /* fell off the world */
  if (p.y > lv.pxh + 120) G.reform();

  /* camera */
  const box = playerBox(p);
  const cy = p.y - (p.stretch > 0.5 ? 30 : 0);
  if (!G.cine) Cam.follow(p.x, cy, p.facing, dt, VIEW_W, VIEW_H, Dialogue.active ? 3 : 5.5);
  else {
    Cam.tx = G.cine.th ? (p.x + G.cine.th.x) / 2 - VIEW_W / 2 : Cam.tx;
    Cam.x += (Cam.tx - Cam.x) * (1 - Math.exp(-3 * dt));
    Cam.ty = p.y - VIEW_H * 0.72;
    Cam.y += (Cam.ty - Cam.y) * (1 - Math.exp(-3 * dt));
    Cam.clamp(VIEW_W, VIEW_H);
  }
};

G.updatePause = function (dt) {
  if (Input.pressed.pause) { G.state = 'play'; Sound.play('ui'); return; }
  if (Input.pressed.up) { G.pauseIdx = (G.pauseIdx + G.pauseMenu.length - 1) % G.pauseMenu.length; Sound.play('ui'); }
  if (Input.pressed.down) { G.pauseIdx = (G.pauseIdx + 1) % G.pauseMenu.length; Sound.play('ui'); }
  if (Input.pressed.jump || Input.pressed.talk) {
    Sound.play('uiBig');
    if (G.pauseIdx === 0) G.state = 'play';
    else if (G.pauseIdx === 1) { G.state = 'play'; Wipe.go(() => G.loadLevel(G.level.data.id, true), '#2a1626'); }
    else if (G.pauseIdx === 2) Sound.setMuted(!Sound.muted);
    else { G.state = 'title'; Sound.music('title'); }
  }
};

/* ---------------------------------------------------------------------- */
/*  Draw                                                                    */
/* ---------------------------------------------------------------------- */

G.draw = function (ctx) {
  const W = VIEW_W, H = VIEW_H;

  if (G.state === 'title') {
    drawTitle(ctx, G, W, H);
    if (G.showControls) drawControlsPanel(ctx, W, H);
  } else if (G.state === 'ending') {
    drawEnding(ctx, G, W, H);
  } else if (G.state === 'credits') {
    drawCredits(ctx, G, W, H);
  } else {
    const lv = G.level;
    if (lv) {
      drawLevel(ctx, lv, G.player, W, H, G.t);
      /* colour grade + film */
      const th = lv.theme;
      if (th.grade) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = th.grade[1];
        ctx.fillStyle = th.grade[0];
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      Clay.grain(ctx, W, H, 0.13);
      Clay.vignette(ctx, W, H, th.vignette, th.vignetteTint);
      drawHUD(ctx, G, W, H);
      Dialogue.draw(ctx, W, H);
      drawTouchControls(ctx, W, H);
    }
    if (G.state === 'pause') drawPause(ctx, G, W, H);
  }

  Wipe.draw(ctx, W, H);
};

function drawControlsPanel(ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(16,8,20,0.78)';
  ctx.fillRect(0, 0, W, H);
  clayHeading(ctx, 'HOW TO BE A LUMP', W / 2, 76, 30, '#e0b473', 15, 1.02);
  const rows = [
    ['← →  /  A D', 'trundle'],
    ['SPACE  /  W', 'hop'],
    ['↓  (hold)', 'squash flat — fits under things, presses things'],
    ['↓  (hold, then SPACE)', 'wind up and BOING'],
    ['↑  (hold, by a ledge)', 'stretch tall and pour yourself over'],
    ['J  /  Z', 'tear a piece off and throw it'],
    ['K  /  X', 'slurp your pieces back'],
    ['E  /  ENTER', 'talk, read, agree'],
    ['ESC', 'pause'],
  ];
  for (let i = 0; i < rows.length; i++) {
    const y = 118 + i * 24;
    softText(ctx, rows[i][0], W / 2 - 20, y, 13, '#ffd9a0', 'right', '700');
    softText(ctx, rows[i][1], W / 2 + 20, y, 13, 'rgba(240,226,206,0.82)', 'left', '600');
  }
  softText(ctx, 'you cannot die. you can only come apart a bit.', W / 2, H - 46, 12, 'rgba(255,224,190,0.6)', 'center', '600');
  softText(ctx, 'press SPACE to go back', W / 2, H - 24, 11, 'rgba(255,232,200,0.42)', 'center', '600');
  ctx.restore();
}

/* ---------------------------------------------------------------------- */
/*  Boot                                                                    */
/* ---------------------------------------------------------------------- */

let _canvas, _ctx, _last = 0;

function boot() {
  _canvas = document.getElementById('game');
  _canvas.width = VIEW_W * RENDER_SCALE;
  _canvas.height = VIEW_H * RENDER_SCALE;
  _ctx = _canvas.getContext('2d', { alpha: false });
  _ctx.imageSmoothingEnabled = true;

  Input.attach(_canvas);
  layoutTouchControls();

  const start = () => { Sound.resume(); if (!Sound._musicKey) Sound.music('title'); };
  addEventListener('keydown', start, { once: true });
  _canvas.addEventListener('pointerdown', start, { once: true });
  _canvas.addEventListener('touchstart', start, { once: true });

  resize();
  addEventListener('resize', resize);

  if (typeof setupShot === 'function' && setupShot(G)) {
    /* screenshot harness took over; it drives its own frames */
    return;
  }

  _last = performance.now();
  requestAnimationFrame(frame);
}

function resize() {
  const cw = innerWidth, ch = innerHeight;
  const scale = Math.min(cw / VIEW_W, ch / VIEW_H);
  _canvas.style.width = Math.floor(VIEW_W * scale) + 'px';
  _canvas.style.height = Math.floor(VIEW_H * scale) + 'px';
}

function frame(now) {
  const dt = Math.min(0.05, (now - _last) / 1000);
  _last = now;
  G.update(dt);
  _ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  G.draw(_ctx);
  requestAnimationFrame(frame);
}

addEventListener('DOMContentLoaded', boot);

/* =========================================================================
   NORBERT, UNFINISHED  --  shots.js
   Deterministic capture harness.

   Load index.html?shot=<name> and the game boots straight into a posed frame
   instead of the title screen, simulates it forward at a fixed timestep, and
   parks. Used by tools/screenshots.mjs so the store images are literally the
   game running, not mock-ups of it.
   ========================================================================= */

const SHOTS = {

  title: {
    frames: 150,
    setup(G) { G.state = 'title'; },
  },

  sill: {
    frames: 130,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('sill', true);
      const p = G.player;
      p.x = 29 * TILE; p.y = 11 * TILE;
      p.facing = 1;
    },
    tick(G, i) { Input.held.right = i > 40 && i < 118; },
    after(G) { Cam.x = 25.5 * TILE; Cam.y = 11 * TILE - VIEW_H * 0.66; Cam.clamp(VIEW_W, VIEW_H); },
  },

  gary: {
    frames: 90,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('sill', true);
      const p = G.player;
      p.x = 30.2 * TILE; p.y = 11 * TILE; p.facing = 1;
      p.rig.look.x = 0.7; p.rig.mood = 'oh';
      Dialogue.start(SCRIPTS.garyMeet.slice(11));
    },
    after(G) {
      Dialogue.chars = 9999; Dialogue.done = true; Dialogue.boxY = 0;
      const g = G.level.npcs.find(n => n.id === 'gary'); if (g) g.talk = 1;
      Cam.x = 28.4 * TILE - VIEW_W / 2 + 40; Cam.y = 11 * TILE - VIEW_H * 0.66;
      Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  table: {
    frames: 150,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('table', true);
      G.canLob = true;
      const p = G.player;
      p.x = 35 * TILE; p.y = 12 * TILE; p.facing = 1; p.mass = 3;
      G.level.blobs.push({
        x: 31.6 * TILE, y: 12 * TILE - 10, vx: 0, vy: 0, r: 11,
        stuck: true, t: 0, seed: 12, color: NB_SKIN,
      });
    },
    tick(G, i) { Input.held.right = i > 60 && i < 130; },
    after(G) {
      Cam.x = 28.5 * TILE; Cam.y = 12 * TILE - VIEW_H * 0.66; Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  thumb: {
    frames: 240,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('table', true);
      G.canLob = true;
      const p = G.player;
      p.x = 79 * TILE; p.y = 12 * TILE; p.facing = 1;
      G.thumbScene();
      Dialogue.skipAll();
    },
    tick(G, i) { if (i === 6) Dialogue.skipAll(); },
    after(G) {
      const th = G.cine && G.cine.th;
      if (th) { Cam.x = (G.player.x + th.x) / 2 - VIEW_W / 2 + 10; }
      Cam.y = 12 * TILE - VIEW_H * 0.86; Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  paint: {
    frames: 140,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('paint', true);
      G.canLob = true;
      const p = G.player;
      p.x = 21 * TILE; p.y = 13 * TILE; p.facing = 1;
      p.paint = '#3fb2c9';
      const gate = G.level.props.find(q => q.id === 'gC');
      if (gate) gate.open = 0.75;
    },
    tick(G, i) { Input.held.right = i > 50 && i < 120; },
    after(G) {
      Cam.x = 13.5 * TILE; Cam.y = 13 * TILE - VIEW_H * 0.70; Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  glaze: {
    frames: 90,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('paint', true);
      const p = G.player;
      p.x = 27.5 * TILE; p.y = 13 * TILE; p.facing = 1;
      p.paint = '#3fb2c9';
      p.rig.mood = 'worried'; p.rig.look.x = 0.6;
      Dialogue.start(SCRIPTS.glazeMeet.slice(6));
    },
    after(G) {
      Dialogue.chars = 9999; Dialogue.done = true; Dialogue.boxY = 0;
      const g = G.level.npcs.find(n => n.id === 'glaze'); if (g) g.talk = 1;
      Cam.x = 26 * TILE - VIEW_W / 2 + 40; Cam.y = 13 * TILE - VIEW_H * 0.68;
      Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  sink: {
    frames: 170,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('sink', true);
      G.canLob = true;
      const p = G.player;
      p.x = 41.5 * TILE; p.y = 11 * TILE; p.facing = -1; p.maxMass = 3; p.mass = 3;
      p.rig.mood = 'neutral';
    },
    after(G) {
      Cam.x = 33.5 * TILE; Cam.y = 11 * TILE - VIEW_H * 0.60; Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  steve: {
    frames: 90,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('sink', true);
      const p = G.player;
      p.x = 31.5 * TILE; p.y = 11 * TILE; p.facing = 1;
      p.maxMass = 3; p.mass = 3;
      p.rig.mood = 'oh'; p.rig.look.x = 0.6;
      Dialogue.start(SCRIPTS.steveMeet.slice(8));
    },
    after(G) {
      Dialogue.chars = 9999; Dialogue.done = true; Dialogue.boxY = 0;
      const s = G.level.npcs.find(n => n.id === 'steve'); if (s) s.talk = 1;
      Cam.x = 30 * TILE - VIEW_W / 2 + 40; Cam.y = 11 * TILE - VIEW_H * 0.66;
      Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  kiln: {
    frames: 170,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('kiln', true);
      G.canLob = true;
      const p = G.player;
      p.x = 28 * TILE; p.y = 34 * TILE; p.facing = -1;
      p.maxMass = 2; p.mass = 2;
    },
    tick(G, i) { if (i > 90 && i < 140) { Input.held.left = true; } },
    after(G) {
      Cam.x = 12 * TILE; Cam.y = 34 * TILE - VIEW_H * 0.62; Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  council: {
    frames: 110,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('kiln', true);
      const p = G.player;
      p.x = 22 * TILE; p.y = 6 * TILE; p.facing = 1;
      p.maxMass = 2; p.mass = 2;
      p.rig.mood = 'worried';
      Dialogue.start(SCRIPTS.council.slice(14));
    },
    after(G) {
      Dialogue.chars = 9999; Dialogue.done = true; Dialogue.boxY = 0;
      const s = G.level.npcs.find(n => n.id === 'sock'); if (s) s.talk = 1;
      const v = G.level.npcs.find(n => n.id === 'volcano'); if (v) v.erupt = 0.5;
      Cam.x = 12.5 * TILE; Cam.y = 6 * TILE - VIEW_H * 0.78; Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  squish: {
    frames: 120,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('sill', true);
      const p = G.player;
      p.x = 23.4 * TILE; p.y = 11 * TILE; p.facing = 1;
      G.tip('Hold  ↓  to squash flat', 4);
    },
    tick(G) { Input.held.down = true; Input.held.right = true; },
    after(G) {
      Cam.x = 18 * TILE; Cam.y = 11 * TILE - VIEW_H * 0.62; Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  dawn: {
    frames: 150,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('dawn', true);
      const p = G.player;
      p.x = 24 * TILE; p.y = 11 * TILE; p.facing = 1;
      p.maxMass = 2; p.mass = 2; p.rig.mood = 'happy';
      Dialogue.start(SCRIPTS.goodbye.slice(7));
    },
    after(G) {
      Dialogue.chars = 9999; Dialogue.done = true; Dialogue.boxY = 0;
      const s = G.level.npcs.find(n => n.id === 'steveEnd'); if (s) s.talk = 1;
      Cam.x = 11 * TILE; Cam.y = 11 * TILE - VIEW_H * 0.62; Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  pippa: {
    frames: 90,
    setup(G) {
      G.state = 'play'; G.reset(); G.loadLevel('table', true);
      const p = G.player;
      p.x = 116.5 * TILE; p.y = 12 * TILE; p.facing = 1;
      p.rig.mood = 'neutral'; p.rig.look.x = 0.6;
      Dialogue.start(SCRIPTS.pippaMeet.slice(5, 9));
    },
    after(G) {
      Dialogue.chars = 9999; Dialogue.done = true; Dialogue.boxY = 0;
      const n = G.level.npcs.find(q => q.id === 'pippa'); if (n) n.talk = 1;
      Cam.x = 114 * TILE - VIEW_W / 2 + 60; Cam.y = 12 * TILE - VIEW_H * 0.68;
      Cam.clamp(VIEW_W, VIEW_H);
    },
  },

  ending: {
    frames: 200,
    setup(G) { G.startEnding(); G.endT = 3.0; },
    tick(G) { },
  },
};

function setupShot(G) {
  const q = new URLSearchParams(location.search);
  const name = q.get('shot');
  if (!name || !SHOTS[name]) return false;

  const shot = SHOTS[name];
  const dt = 1 / 60;

  Clay.quality = 1;
  Sound.muted = true;
  const boot = document.getElementById('boot');
  if (boot) boot.remove();

  shot.setup(G);

  const frames = +(q.get('frames') || shot.frames || 120);
  for (let i = 0; i < frames; i++) {
    Input.pressed = {}; Input.released = {};
    if (shot.tick) shot.tick(G, i);
    G.update(dt);
    Input.held = {};
  }
  if (shot.after) shot.after(G);

  /* one settled draw */
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  G.draw(ctx);

  window.__shotReady = true;
  document.title = 'shot:' + name;
  return true;
}

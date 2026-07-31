/* Fantasy Kritter — scenery.js
 * §6.4: no screen may sit on an empty background. Every menu gets layered
 * scenery — far ridgelines, mist that drifts, fireflies that pulse — so even
 * the settings screen feels like a place in De Skæve Lande.
 *
 * The static layers are baked once per size+theme; only the mist and the
 * fireflies are redrawn per frame, so the whole effect costs a few dozen
 * shapes per frame.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const TAU = Math.PI * 2;

  const TITLE_THEME = {
    name: 'title',
    sky: ['#332a5e', '#171230'],
    ground: '#241c44',
    accent: '#8b6cf0',
    fire: '#ffd58a',
  };

  const Scenery = {
    current: null,        // { canvas, ctx, theme, bake, w, h, dpr, rng }
    _raf: null,
  };

  function bake(state) {
    const { w, h, dpr, theme } = state;
    const off = document.createElement('canvas');
    off.width = Math.round(w * dpr);
    off.height = Math.round(h * dpr);
    const ctx = off.getContext('2d');
    ctx.scale(dpr, dpr);
    const rng = U.rng(U.hashString(theme.name || 'x'));

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, U.shade(theme.sky[0], 0.08));
    sky.addColorStop(0.55, theme.sky[1]);
    sky.addColorStop(1, U.shade(theme.ground, -0.55));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // faint stars in the upper third
    for (let i = 0; i < 40; i++) {
      const y = rng.range(0, h * 0.4);
      ctx.globalAlpha = rng.range(0.08, 0.4) * (1 - y / (h * 0.45));
      ctx.fillStyle = '#e8e2ff';
      const r = rng.range(0.5, 1.4);
      ctx.beginPath();
      ctx.arc(rng.range(0, w), y, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // a soft moon/glow high in the sky
    const mg = ctx.createRadialGradient(w * 0.78, h * 0.16, 0, w * 0.78, h * 0.16, w * 0.3);
    mg.addColorStop(0, U.rgba(theme.accent, 0.22));
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, w, h);

    // three ridge layers, each nearer, darker and taller
    for (let layer = 0; layer < 3; layer++) {
      const base = h * (0.52 + layer * 0.16);
      const amp = 26 + layer * 22;
      const col = U.mix(theme.sky[1], theme.ground, 0.35 + layer * 0.32);
      ctx.beginPath();
      ctx.moveTo(-10, base);
      const segs = 7;
      for (let i = 0; i <= segs; i++) {
        const x = (i / segs) * (w + 20) - 10;
        ctx.quadraticCurveTo(
          x - (w / segs) / 2, base - rng.range(amp * 0.3, amp),
          x, base + rng.range(-amp * 0.25, amp * 0.25)
        );
      }
      ctx.lineTo(w + 10, h + 10);
      ctx.lineTo(-10, h + 10);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();

      // silhouetted growth on each ridge: trees, stones, glow-shrooms
      const n = 5 + layer * 4;
      for (let i = 0; i < n; i++) {
        const x = rng.range(10, w - 10);
        const y = base + rng.range(-4, amp * 0.2);
        const s = (5 + layer * 5) * rng.range(0.6, 1.3);
        const dark = U.shade(col, -0.28);
        if (rng.chance(0.55)) {
          // conifer silhouette
          ctx.fillStyle = dark;
          for (let t = 0; t < 3; t++) {
            const ww = s * (1 - t * 0.24);
            const yy = y - t * s * 0.55;
            ctx.beginPath();
            ctx.moveTo(x - ww, yy);
            ctx.lineTo(x, yy - s * 0.9);
            ctx.lineTo(x + ww, yy);
            ctx.closePath();
            ctx.fill();
          }
        } else if (rng.chance(0.5)) {
          // round stone
          ctx.fillStyle = dark;
          ctx.beginPath();
          ctx.ellipse(x, y, s * 0.7, s * 0.45, 0, 0, TAU);
          ctx.fill();
        } else {
          // glowing mushroom — the bible's light source of choice
          ctx.strokeStyle = dark;
          ctx.lineWidth = Math.max(1, s * 0.16);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.7); ctx.stroke();
          const gg = ctx.createRadialGradient(x, y - s * 0.8, 0, x, y - s * 0.8, s * 1.6);
          gg.addColorStop(0, U.rgba(theme.accent, 0.5));
          gg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.arc(x, y - s * 0.8, s * 1.6, 0, TAU); ctx.fill();
          ctx.fillStyle = U.mix(theme.accent, '#ffffff', 0.35);
          ctx.beginPath();
          ctx.ellipse(x, y - s * 0.75, s * 0.55, s * 0.35, 0, Math.PI, 0);
          ctx.fill();
        }
      }
    }

    // readability dims: darker at top for the bar, darker at bottom for buttons
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.3);
    top.addColorStop(0, 'rgba(8,5,16,0.55)');
    top.addColorStop(1, 'rgba(8,5,16,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.3);
    const bot = ctx.createLinearGradient(0, h * 0.55, 0, h);
    bot.addColorStop(0, 'rgba(8,5,16,0)');
    bot.addColorStop(1, 'rgba(8,5,16,0.72)');
    ctx.fillStyle = bot;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    // centre vignette so panels sit in a pocket of shade
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h * 0.45, h * 0.75);
    vg.addColorStop(0, 'rgba(10,6,20,0.18)');
    vg.addColorStop(1, 'rgba(10,6,20,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    return off;
  }

  function frame(now) {
    Scenery._raf = requestAnimationFrame(frame);
    const s = Scenery.current;
    if (!s || !s.canvas.isConnected) return;
    const t = now / 1000;
    const { ctx, w, h, dpr, theme } = s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(s.bake, 0, 0, w, h);

    // drifting mist bands
    for (let i = 0; i < 3; i++) {
      const speed = 9 + i * 5;
      const span = w + 340;
      const x = ((t * speed + i * span / 3) % span) - 170;
      const y = h * (0.5 + i * 0.16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 170);
      g.addColorStop(0, 'rgba(232,226,255,0.055)');
      g.addColorStop(1, 'rgba(232,226,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, 170, 46, 0, 0, TAU);
      ctx.fill();
    }

    // fireflies, each on its own slow orbit and pulse
    for (let i = 0; i < 14; i++) {
      const seed = i * 37.7;
      const bx = ((seed * 73) % w);
      const by = h * 0.35 + ((seed * 41) % (h * 0.5));
      const x = bx + Math.sin(t * 0.35 + seed) * 26;
      const y = by + Math.cos(t * 0.28 + seed * 1.7) * 18;
      const a = 0.25 + Math.sin(t * 1.6 + seed) * 0.25;
      if (a <= 0.05) continue;
      const col = theme.fire || theme.accent;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, U.rgba(col, a));
      g.addColorStop(1, U.rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = U.rgba('#fff8dc', a * 1.4);
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill();
    }
  }

  /** Called by UI.show with the active screen element. */
  Scenery.activate = function (sectionEl, UI) {
    const canvas = sectionEl && sectionEl.querySelector(':scope > canvas.scenery');
    if (!canvas) { Scenery.current = null; return; }

    // Region-themed on run screens, dusk purple everywhere else.
    const RUNSCREENS = { 's-map': 1, 's-team': 1, 's-shop': 1, 's-rest': 1 };
    let theme = TITLE_THEME;
    if (RUNSCREENS[sectionEl.id] && UI && UI.run) {
      const act = UI.run.act0();
      theme = {
        name: act.name, sky: act.sky, ground: act.ground,
        accent: act.accent, fire: act.accent,
      };
    }

    requestAnimationFrame(function () {
      const r = sectionEl.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const state = Scenery.current && Scenery.current.canvas === canvas ? Scenery.current : {};
      const need = state.w !== Math.round(r.width) || state.h !== Math.round(r.height) ||
        !state.theme || state.theme.name !== theme.name;
      state.canvas = canvas;
      state.ctx = canvas.getContext('2d');
      state.w = Math.round(r.width);
      state.h = Math.round(r.height);
      state.dpr = dpr;
      state.theme = theme;
      if (need) {
        canvas.width = Math.round(state.w * dpr);
        canvas.height = Math.round(state.h * dpr);
        state.bake = bake(state);
      }
      Scenery.current = state;
      if (!Scenery._raf) Scenery._raf = requestAnimationFrame(frame);
    });
  };

  NS.Scenery = Scenery;
})(window.COC);

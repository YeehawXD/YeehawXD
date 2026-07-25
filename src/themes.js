/* =========================================================================
   NORBERT, UNFINISHED  --  themes.js
   Six rooms of one craft club, seen from four inches off the ground.

   Each theme owns its sky, its parallax backdrop, the colour of its dirt and
   the colour of its light. Backdrops are drawn live rather than baked: they're
   only a few dozen shapes each, and drawing them live means the lamp can
   flicker and the paint can flow.
   ========================================================================= */

const THEMES = {};

/* helper: repeating scatter that's stable in world space */
function scatterX(camX, factor, spacing, W, cb) {
  const ox = camX * factor;
  const i0 = Math.floor((ox - spacing) / spacing);
  const i1 = Math.ceil((ox + W + spacing) / spacing);
  for (let i = i0; i <= i1; i++) cb(i, i * spacing - ox);
}

function skyGrad(ctx, H, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const s of stops) g.addColorStop(s[0], s[1]);
  return g;
}

/* ======================================================================= */
/*  1. THE WINDOWSILL -- 5:04pm, raining, everything just woke up          */
/* ======================================================================= */

THEMES.sill = {
  name: 'The Windowsill',
  key: '#ffe8bc', shadow: '#2a1e46',
  ground: '#cfc4b0', groundTop: '#e6dcc6', groundH: 7,
  light: '#ffd9a8', ambient: '#3a3358',
  vignette: 0.42, vignetteTint: '#1b1430',
  grade: ['#ff9d5c', 0.07],
  music: 'sill',
  back(ctx, cam, W, H, t) {
    ctx.fillStyle = skyGrad(ctx, H, [
      [0, '#2c2a52'], [0.28, '#4d3a63'], [0.52, '#8f5568'],
      [0.72, '#d2825f'], [0.88, '#efb374'], [1, '#f6d29a'],
    ]);
    ctx.fillRect(0, 0, W, H);

    /* long flat painted clouds */
    for (let i = 0; i < 7; i++) {
      const px = ((i * 233 + t * (4 + i)) % (W + 420)) - 210 - cam.x * 0.02;
      const py = 40 + hash1(i * 3.1) * 130;
      const w = 70 + hash1(i * 5.7) * 130, h = 7 + hash1(i * 2.3) * 9;
      const c = i % 2 ? '#f2b98d' : '#c98a83';
      ctx.globalAlpha = 0.5 + hash1(i) * 0.3;
      Clay.blob(ctx, { x: px, y: py, rx: w, ry: h, seed: 300 + i, color: c, wob: 0.30, prints: 0, edge: false, spec: false, n: 26 });
      ctx.globalAlpha = 1;
    }

    /* the town, four inches away and a whole world off */
    const skyline = (factor, base, col, scale, seed, lit) => {
      const ox = cam.x * factor;
      const span = 900;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-20, H + 10);
      /* walk building by building so the roofline is made of flats and steps */
      let wx = Math.floor((ox - 120) / 26) * 26;
      const endX = ox + W + 120;
      const wins = [];
      while (wx < endX) {
        const k = Math.floor(wx / 26) + seed * 37;
        const bw = 18 + Math.floor(hash1(k * 1.7) * 3) * 13;
        let bh = (14 + hash1(k * 3.1) * 30) * scale;
        const kind = hash1(k * 5.3);
        const x0 = wx - ox, x1 = x0 + bw;
        ctx.lineTo(x0, base - bh);
        if (kind > 0.90) {
          /* a spire */
          ctx.lineTo(x0 + bw * 0.34, base - bh);
          ctx.lineTo(x0 + bw * 0.5, base - bh - 30 * scale);
          ctx.lineTo(x0 + bw * 0.66, base - bh);
        } else if (kind > 0.78) {
          /* pitched roof */
          ctx.lineTo(x0 + bw * 0.5, base - bh - 9 * scale);
        }
        ctx.lineTo(x1, base - bh);
        /* chimney */
        if (hash1(k * 9.1) > 0.66) {
          const cx0 = x0 + bw * 0.72;
          ctx.lineTo(cx0, base - bh);
          ctx.lineTo(cx0, base - bh - 8 * scale);
          ctx.lineTo(cx0 + 4 * scale, base - bh - 8 * scale);
          ctx.lineTo(cx0 + 4 * scale, base - bh);
        }
        wins.push([x0, bw, bh]);
        wx += bw;
      }
      ctx.lineTo(W + 20, H + 10);
      ctx.closePath();
      ctx.fill();

      /* windows: somebody is still up */
      for (const [x0, bw, bh] of wins) {
        const cols = Math.max(1, Math.floor(bw / 9));
        const rows2 = Math.max(1, Math.floor(bh / 11));
        for (let r = 0; r < rows2; r++) {
          for (let c = 0; c < cols; c++) {
            const h2 = hash1((x0 + ox) * 0.31 + r * 7.7 + c * 3.3 + seed);
            if (h2 < 0.62) continue;
            const px = x0 + 3 + c * 9, py = base - bh + 6 + r * 11;
            if (px < -6 || px > W + 6 || py > base - 3) continue;
            const fl = h2 > 0.965 ? (Math.sin(t * 4 + px) > -0.3 ? 1 : 0.15) : 1;
            ctx.fillStyle = 'rgba(255,206,130,' + (lit * fl) + ')';
            ctx.fillRect(px, py, 2.6 * scale, 3.4 * scale);
          }
        }
      }
    };
    skyline(0.030, H * 0.815, '#4d3557', 1.0, 2, 0.55);
    skyline(0.068, H * 0.885, '#362543', 1.3, 8, 0.75);

    /* rain, out there where it can't reach you */
    ctx.strokeStyle = 'rgba(210,200,230,0.16)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < 110; i++) {
      const x = (hash1(i * 3.7) * (W + 120) + t * 26 * (0.6 + hash1(i) * 0.7)) % (W + 120) - 60;
      const y = (hash1(i * 7.1) * H + t * 260 * (0.7 + hash1(i * 2) * 0.6)) % H;
      ctx.moveTo(x, y); ctx.lineTo(x - 2.5, y + 12);
    }
    ctx.stroke();

    /* the window: glass, then muntins */
    const gx = -cam.x * 0.11;
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#bcd8e8';
    ctx.fillRect(0, 0, W, H * 0.93);
    ctx.restore();

    /* condensation and rain running down the inside */
    for (let i = 0; i < 46; i++) {
      const x = (i * 137.5 + 20) % 900 + gx * 0.5;
      if (x < -10 || x > W + 10) continue;
      const sp = 8 + hash1(i * 5.3) * 26;
      const y = ((hash1(i * 1.7) * 400 + t * sp) % (H * 0.95));
      const r = 0.8 + hash1(i * 8.2) * 2.1;
      ctx.fillStyle = 'rgba(226,240,248,0.30)';
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.5, r * 0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(226,240,248,0.10)';
      ctx.lineWidth = r * 0.7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 16); ctx.stroke();
    }

    /* muntins -- chipped white gloss over old wood */
    const bar = (x, y, w, h) => {
      const pts = [];
      const n = 16;
      for (let i = 0; i <= n; i++) pts.push({ x: x + (w * i) / n + shash1(i * 3 + x) * 0.8, y: y + shash1(i * 7 + x) * 0.9 });
      for (let i = n; i >= 0; i--) pts.push({ x: x + (w * i) / n + shash1(i * 5 + x) * 0.8, y: y + h + shash1(i * 11 + x) * 0.9 });
      Clay.slab(ctx, pts, '#e8e2d2', { seed: x * 0.3 + y, prints: Math.round(w * h / 260) + 2, markSize: 3.4, vert: true, vertH: h * 2 });
    };
    scatterX(cam.x, 0.11, 300, W, (i, x) => { bar(x - 7, -20, 14, H); });
    bar(-20, H * 0.30, W + 40, 12);
    ctx.restore && null;
  },
  fore(ctx, cam, W, H, t) {
    /* a spider plant leaning in from the left, out of focus */
    const x0 = -cam.x * 0.5 - 30;
    if (x0 > -260) {
      ctx.save();
      ctx.filter = 'blur(2.4px)';
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 6; i++) {
        const a = -0.9 + i * 0.28;
        const L = 150 + i * 26;
        Clay.limb(ctx, x0, H + 30, x0 + Math.cos(a) * L, H + 30 + Math.sin(a) * L,
          9, 1.5, i % 2 ? '#4a6b3e' : '#3d5a35', { seed: 90 + i, bow: 26 - i * 8, prints: 0 });
      }
      ctx.restore();
    }
  },
};

/* ======================================================================= */
/*  2. THE GREAT TABLE -- one lamp, ten thousand square miles              */
/* ======================================================================= */

THEMES.table = {
  name: 'The Great Table',
  key: '#ffe2ab', shadow: '#241a32',
  ground: '#8a5f3c', groundTop: '#a8794c', groundH: 8,
  light: '#ffcf8a', ambient: '#2a2136',
  vignette: 0.55, vignetteTint: '#160f22',
  grade: ['#ffab52', 0.09],
  music: 'table',
  back(ctx, cam, W, H, t) {
    ctx.fillStyle = skyGrad(ctx, H, [
      [0, '#171226'], [0.42, '#26192c'], [0.78, '#402334'], [1, '#54303a'],
    ]);
    ctx.fillRect(0, 0, W, H);

    /* the lamp, off to the upper right, doing its best */
    const flick = 1 + Math.sin(t * 11) * 0.012 + Math.sin(t * 3.7) * 0.02;
    const lx = W * 0.80 - cam.x * 0.04, ly = -40;
    const cone = ctx.createRadialGradient(lx, ly, 10, lx, ly, H * 1.5);
    cone.addColorStop(0, 'rgba(255,206,138,' + 0.36 * flick + ')');
    cone.addColorStop(0.4, 'rgba(255,178,104,0.12)');
    cone.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = cone; ctx.fillRect(0, 0, W, H);

    /* the rest of the room, a long way off and barely lit */
    const shelfY = H * 0.21;
    scatterX(cam.x, 0.05, 210, W, (i, x) => {
      /* soft silhouettes of jars and tins, rounded so they read as objects
         rather than as a bar chart */
      const blob = (bx, bw2, bh2, round) => {
        ctx.beginPath();
        ctx.moveTo(bx, shelfY);
        ctx.lineTo(bx, shelfY - bh2 + round);
        ctx.quadraticCurveTo(bx, shelfY - bh2, bx + round, shelfY - bh2);
        ctx.lineTo(bx + bw2 - round, shelfY - bh2);
        ctx.quadraticCurveTo(bx + bw2, shelfY - bh2, bx + bw2, shelfY - bh2 + round);
        ctx.lineTo(bx + bw2, shelfY);
        ctx.closePath();
        const g2 = ctx.createLinearGradient(bx, shelfY - bh2, bx + bw2, shelfY);
        g2.addColorStop(0, 'rgba(52,36,54,0.85)');
        g2.addColorStop(1, 'rgba(26,18,34,0.9)');
        ctx.fillStyle = g2; ctx.fill();
        ctx.strokeStyle = 'rgba(255,196,140,0.10)'; ctx.lineWidth = 1; ctx.stroke();
      };
      blob(x + 18, 28, 42 + hash1(i * 3.1) * 16, 9);
      blob(x + 66, 36, 60 + hash1(i * 5.7) * 20, 5);
      blob(x + 126, 22, 30 + hash1(i * 7.3) * 14, 10);
      const bg2 = ctx.createLinearGradient(0, shelfY, 0, shelfY + 10);
      bg2.addColorStop(0, 'rgba(66,44,50,0.9)');
      bg2.addColorStop(1, 'rgba(20,13,24,0.9)');
      ctx.fillStyle = bg2;
      ctx.fillRect(x - 12, shelfY, 214, 9);
      ctx.fillStyle = 'rgba(255,190,130,0.09)';
      ctx.fillRect(x - 12, shelfY, 214, 1.4);
    });

    /* GIANT craft supplies, mid distance. Everything here is a landmark. */
    const ox = cam.x * 0.16;
    const propsAt = (baseX) => {
      const x = baseX - ox;
      if (x < -300 || x > W + 300) return;
      const gy = H * 0.72;
      const k = Math.round(baseX / 520);
      const kind = k % 4;
      ctx.save();
      ctx.globalAlpha = 0.95;
      if (kind === 0) {
        /* jam jar bristling with brushes */
        for (let i = 0; i < 7; i++) {
          const a = -1.9 + i * 0.2 + shash1(i + k) * 0.08;
          const L = 120 + hash1(i * 3 + k) * 60;
          Clay.limb(ctx, x + 40, gy - 30, x + 40 + Math.cos(a) * L, gy - 30 + Math.sin(a) * L,
            4, 3, '#5a4632', { seed: k * 9 + i, bow: 2, prints: 0 });
          Clay.blob(ctx, {
            x: x + 40 + Math.cos(a) * L, y: gy - 30 + Math.sin(a) * L, rx: 5, ry: 9,
            seed: k + i, color: ['#b8563f', '#3f6b7a', '#7a6b3f'][i % 3], wob: 0.2, rot: a + 1.57, prints: 0,
          });
        }
        Clay.blob(ctx, { x: x + 40, y: gy - 8, rx: 40, ry: 46, seed: k * 3, color: '#4a5560', wob: 0.05, prints: 2, edgeAlpha: 0.2 });
        ctx.fillStyle = 'rgba(210,240,255,0.13)';
        ctx.beginPath(); ctx.ellipse(x + 24, gy - 20, 9, 30, 0.1, 0, TAU); ctx.fill();
      } else if (kind === 1) {
        /* the glue bottle, orange cap, permanently crusted */
        Clay.blob(ctx, { x: x, y: gy - 34, rx: 30, ry: 52, seed: k * 5, color: '#c8c3b4', wob: 0.05, prints: 3 });
        Clay.blob(ctx, { x: x, y: gy - 92, rx: 14, ry: 22, seed: k * 5 + 1, color: '#d9762e', wob: 0.09, prints: 1 });
        Clay.blob(ctx, { x: x - 4, y: gy - 112, rx: 6, ry: 10, seed: k * 5 + 2, color: '#e08a3c', wob: 0.2, prints: 0 });
      } else if (kind === 2) {
        /* scissors, leaning, closed, faintly threatening */
        ctx.save(); ctx.translate(x, gy); ctx.rotate(-0.22);
        Clay.limb(ctx, 0, 0, 6, -150, 9, 4, '#9aa4ad', { seed: k, bow: 3, prints: 1 });
        Clay.limb(ctx, 6, 0, 14, -146, 8, 4, '#7d868f', { seed: k + 1, bow: -2, prints: 1 });
        Clay.blob(ctx, { x: 2, y: 6, rx: 15, ry: 20, seed: k + 2, color: '#2f3f52', wob: 0.1, prints: 1 });
        Clay.blob(ctx, { x: 20, y: 10, rx: 13, ry: 17, seed: k + 3, color: '#2a394a', wob: 0.1, prints: 1 });
        ctx.restore();
      } else {
        /* stack of sugar paper */
        for (let i = 0; i < 9; i++) {
          const c = ['#c86b7a', '#6b8fc8', '#c8b26b', '#7ac887'][i % 4];
          Clay.blob(ctx, {
            x: x + shash1(i * 3 + k) * 5, y: gy - 6 - i * 7, rx: 78, ry: 5,
            seed: k * 11 + i, color: c, wob: 0.045, prints: 0, edgeAlpha: 0.25, n: 26,
          });
        }
      }
      ctx.restore();
    };
    scatterX(cam.x, 0.16, 520, W, (i, x) => propsAt(i * 520 + ox));

    /* dust in the lamplight */
    ctx.fillStyle = 'rgba(255,222,170,0.5)';
    for (let i = 0; i < 60; i++) {
      const sx = (hash1(i * 3.3) * 1400 - cam.x * 0.3) % (W + 60) - 30;
      const sy = (hash1(i * 7.7) * H + Math.sin(t * 0.35 + i) * 22 + t * 5) % H;
      const r = 0.5 + hash1(i * 2.2) * 1.1;
      ctx.globalAlpha = 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.6 + i));
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

/* ======================================================================= */
/*  3. THE PAINT SHELF -- where the colour lives                           */
/* ======================================================================= */

THEMES.paint = {
  name: 'The Paint Shelf',
  key: '#fff0d8', shadow: '#2b1640',
  ground: '#6b5340', groundTop: '#8a6b4c', groundH: 8,
  light: '#ffe6c0', ambient: '#2b2340',
  vignette: 0.44, vignetteTint: '#1a1030',
  grade: ['#ff7ad0', 0.055],
  music: 'paint',
  back(ctx, cam, W, H, t) {
    ctx.fillStyle = skyGrad(ctx, H, [
      [0, '#241a34'], [0.4, '#3a2242'], [0.75, '#54294a'], [1, '#6b3350'],
    ]);
    ctx.fillRect(0, 0, W, H);

    /* splattered back wall */
    const ox0 = cam.x * 0.06;
    for (let i = 0; i < 40; i++) {
      const bx = (i * 173.1) % 2400 - ox0;
      if (bx < -60 || bx > W + 60) continue;
      const by = hash1(i * 5.1) * H * 0.9;
      const r = 4 + hash1(i * 2.9) * 22;
      const c = ['#d94f9c', '#3fb2c9', '#e8c33f', '#5fc46b', '#9a5fd9'][i % 5];
      ctx.globalAlpha = 0.16 + hash1(i * 8) * 0.12;
      Clay.blob(ctx, { x: bx, y: by, rx: r, ry: r * (0.7 + hash1(i) * 0.5), seed: 400 + i, color: c, wob: 0.4, prints: 0, edge: false, spec: false });
      for (let d = 0; d < 3; d++) {
        const a = hash1(i * 3 + d) * TAU, dd = r * (1.4 + hash1(i + d) * 1.6);
        ctx.beginPath(); ctx.arc(bx + Math.cos(a) * dd, by + Math.sin(a) * dd, 1 + hash1(i * d + 2) * 3.4, 0, TAU);
        ctx.fillStyle = c; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* shelves stacked away into the dark, each with a row of little jars */
    for (let sh = 0; sh < 3; sh++) {
      const f = 0.09 + sh * 0.05;
      const sy = H * (0.30 + sh * 0.16);
      const dim = 1 - sh * 0.16;
      const spacing = 54 + sh * 9;
      const jScale = 0.62 + sh * 0.14;

      scatterX(cam.x, f, spacing, W, (i, x) => {
        const c = ['#d94f9c', '#3fb2c9', '#e8c33f', '#5fc46b', '#9a5fd9', '#e8623f', '#4a7ec0'][Math.abs(i * 3 + sh) % 7];
        const jh = (17 + hash1(i * 3.3 + sh) * 7) * jScale;
        const jw = (7 + hash1(i * 7.1 + sh) * 3) * jScale;
        const y = sy - jh;
        const g = ctx.createRadialGradient(x, y, 1, x, y, jh * 2.2);
        g.addColorStop(0, rgba(c, 0.20 * dim));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.fillRect(x - jh * 2.4, y - jh * 2.4, jh * 4.8, jh * 4.8);
        /* glass body with the paint sitting in the bottom two thirds */
        ctx.fillStyle = 'rgba(226,240,246,' + (0.16 * dim) + ')';
        ctx.beginPath(); ctx.rect(x - jw, y - jh * 0.5, jw * 2, jh * 1.5); ctx.fill();
        ctx.fillStyle = rgba(c, 0.86 * dim);
        ctx.fillRect(x - jw + 0.6, y + jh * 0.05, jw * 2 - 1.2, jh * 0.95);
        ctx.fillStyle = rgba(warmLight(c, 0.4), 0.5 * dim);
        ctx.fillRect(x - jw + 0.6, y + jh * 0.05, jw * 0.5, jh * 0.95);
        /* screw cap */
        ctx.fillStyle = rgba('#b9b2a2', dim);
        ctx.fillRect(x - jw * 1.15, y - jh * 0.75, jw * 2.3, jh * 0.32);
        ctx.fillStyle = 'rgba(255,244,220,' + (0.22 * dim) + ')';
        ctx.fillRect(x - jw * 1.15, y - jh * 0.75, jw * 2.3, 1.1);
        /* highlight down the glass */
        ctx.fillStyle = 'rgba(255,255,255,' + (0.22 * dim) + ')';
        ctx.fillRect(x - jw * 0.72, y - jh * 0.35, jw * 0.34, jh * 1.15);
      });

      /* the board itself, in front of the jars so they sit ON it */
      const bd = ctx.createLinearGradient(0, sy, 0, sy + 13 + sh * 2);
      bd.addColorStop(0, ['#6b4a4e', '#5a3d44', '#4a333c'][sh]);
      bd.addColorStop(1, ['#3a2530', '#31202b', '#281a24'][sh]);
      ctx.fillStyle = bd;
      ctx.fillRect(0, sy, W, 13 + sh * 2);
      ctx.fillStyle = 'rgba(255,214,170,' + (0.16 - sh * 0.04) + ')';
      ctx.fillRect(0, sy, W, 1.6);
      ctx.fillStyle = 'rgba(12,6,14,0.35)';
      ctx.fillRect(0, sy + 13 + sh * 2, W, 5);
    }
  },
};

/* ======================================================================= */
/*  4. THE SINK -- cold, loud, and full of opinions                        */
/* ======================================================================= */

THEMES.sink = {
  name: 'The Sink',
  key: '#e8f6ff', shadow: '#122636',
  ground: '#8d949a', groundTop: '#a9b1b6', groundH: 6,
  light: '#dff1ff', ambient: '#22303f',
  vignette: 0.5, vignetteTint: '#0c1824',
  grade: ['#6fd0ff', 0.08],
  music: 'sink',
  back(ctx, cam, W, H, t) {
    ctx.fillStyle = skyGrad(ctx, H, [
      [0, '#16222e'], [0.34, '#22364a'], [0.68, '#33506a'], [1, '#456c88'],
    ]);
    ctx.fillRect(0, 0, W, H);

    /* brushed steel basin wall: long soft vertical streaks */
    const ox = cam.x * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 90; i++) {
      const x = (i * 41.7) % 1600 - ox;
      if (x < -8 || x > W + 8) continue;
      const g = ctx.createLinearGradient(x, 0, x, H);
      const v = hash1(i * 3.1);
      g.addColorStop(0, 'rgba(190,214,232,' + (0.03 + v * 0.07) + ')');
      g.addColorStop(0.6, 'rgba(150,180,205,' + (0.02 + v * 0.05) + ')');
      g.addColorStop(1, 'rgba(90,120,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 2 + v * 5, H);
    }
    ctx.restore();

    /* the tap, enormous, up there, dripping on a schedule */
    const tx = W * 0.24 - cam.x * 0.14;
    if (tx > -180 && tx < W + 180) {
      Clay.limb(ctx, tx - 70, -30, tx - 70, H * 0.20, 22, 20, '#9fb0bd', { seed: 3, bow: 0, prints: 2 });
      Clay.limb(ctx, tx - 70, H * 0.20, tx + 30, H * 0.22, 19, 15, '#94a6b4', { seed: 4, bow: -28, prints: 2 });
      Clay.blob(ctx, { x: tx + 34, y: H * 0.25, rx: 15, ry: 11, seed: 5, color: '#7f929f', wob: 0.08, prints: 1 });
      const dp = (t * 0.42) % 1;
      if (dp > 0.12) {
        const dy = H * 0.27 + easeInCubic((dp - 0.12) / 0.88) * H * 0.8;
        ctx.fillStyle = 'rgba(200,230,246,0.7)';
        ctx.beginPath(); ctx.ellipse(tx + 34, dy, 3.4, 5.4 + dp * 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(tx + 32.6, dy - 1.6, 1.1, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(220,244,255,0.28)';
      ctx.beginPath(); ctx.ellipse(tx - 78, H * 0.08, 5, 60, 0.03, 0, TAU); ctx.fill();
    }

    /* soap bubbles: iridescent, doomed */
    for (let i = 0; i < 26; i++) {
      const bx = ((hash1(i * 3.7) * 1800 - cam.x * 0.3) % (W + 120) + W + 120) % (W + 120) - 60;
      const by = (hash1(i * 8.1) * H + H - (t * (7 + hash1(i) * 16) % (H + 120))) ;
      const r = 4 + hash1(i * 5.5) * 16;
      const g = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.35, 0, bx, by, r);
      g.addColorStop(0, 'rgba(255,255,255,0.16)');
      g.addColorStop(0.65, 'rgba(170,220,255,0.06)');
      g.addColorStop(0.93, 'rgba(255,190,240,0.30)');
      g.addColorStop(1, 'rgba(190,255,230,0.14)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(bx - r * 0.4, by - r * 0.45, r * 0.2, r * 0.12, -0.7, 0, TAU); ctx.fill();
    }
  },
};

/* ======================================================================= */
/*  5. THE KILN ROOM -- 1000 degrees of career advancement                 */
/* ======================================================================= */

THEMES.kiln = {
  name: 'The Kiln Room',
  key: '#ffd39a', shadow: '#3d100a',
  ground: '#633a33', groundTop: '#8a4d3a', groundH: 7,
  light: '#ffb066', ambient: '#3a1420',
  vignette: 0.58, vignetteTint: '#1a0508',
  grade: ['#ff5a1e', 0.13],
  music: 'kiln',
  back(ctx, cam, W, H, t) {
    ctx.fillStyle = skyGrad(ctx, H, [
      [0, '#150609'], [0.36, '#2d0c10'], [0.66, '#4f1512'], [0.88, '#79251a'], [1, '#9c3a1e'],
    ]);
    ctx.fillRect(0, 0, W, H);

    /* the kiln itself: a wall of firebrick with vents that breathe */
    const ox = cam.x * 0.07;
    const bw = 46, bh = 22;
    for (let r = 0; r < Math.ceil(H / bh) + 1; r++) {
      for (let c = -1; c < W / bw + 2; c++) {
        const x = c * bw - (ox % bw) + (r % 2 ? bw / 2 : 0);
        const y = r * bh - 10;
        const v = hash2(Math.floor((x + ox) / bw), r);
        ctx.fillStyle = mixHex('#3a1a16', '#5c2a1e', v);
        ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        ctx.fillStyle = 'rgba(255,150,80,0.05)';
        ctx.fillRect(x + 1, y + 1, bw - 2, 2);
      }
    }

    /* vents, glowing, pulsing like something asleep */
    scatterX(cam.x, 0.07, 250, W, (i, x) => {
      const y = H * (0.30 + hash1(i * 3.1) * 0.4);
      const pulse = 0.65 + 0.35 * Math.sin(t * 1.6 + i * 1.3) + 0.08 * Math.sin(t * 9 + i);
      const g = ctx.createRadialGradient(x, y, 2, x, y, 96);
      g.addColorStop(0, 'rgba(255,222,150,' + 0.5 * pulse + ')');
      g.addColorStop(0.25, 'rgba(255,130,40,' + 0.28 * pulse + ')');
      g.addColorStop(1, 'rgba(255,70,10,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 100, y - 100, 200, 200);
      /* a cast-iron grille with the fire behind it */
      ctx.fillStyle = 'rgba(16,5,5,0.92)';
      ctx.fillRect(x - 27, y - 15, 54, 30);
      ctx.strokeStyle = 'rgba(96,44,28,0.9)'; ctx.lineWidth = 2.4;
      ctx.strokeRect(x - 27, y - 15, 54, 30);
      for (let k = 0; k < 5; k++) {
        const yy = y - 11 + k * 5.4;
        const gg = ctx.createLinearGradient(x - 24, yy, x + 24, yy);
        gg.addColorStop(0, 'rgba(255,' + (120 + k * 16) + ',44,' + (0.45 + 0.4 * pulse) + ')');
        gg.addColorStop(0.5, 'rgba(255,' + (196 + k * 10) + ',120,' + (0.72 + 0.28 * pulse) + ')');
        gg.addColorStop(1, 'rgba(255,' + (120 + k * 16) + ',44,' + (0.45 + 0.4 * pulse) + ')');
        ctx.fillStyle = gg;
        ctx.fillRect(x - 24, yy, 48, 3.2);
      }
      ctx.fillStyle = 'rgba(255,236,190,' + (0.14 * pulse) + ')';
      ctx.fillRect(x - 27, y - 15, 54, 2)
    });

    /* the shelf of the already-fired, watching you climb past */
    const shelfY = H * 0.54;
    scatterX(cam.x, 0.18, 74, W, (i, x) => {
      const h = 18 + hash1(i * 5.3) * 30;
      const w = 9 + hash1(i * 2.7) * 13;
      const belly = hash1(i * 8.1) > 0.5 ? 1.35 : 1.02;
      ctx.beginPath();
      ctx.moveTo(x - w, shelfY);
      ctx.bezierCurveTo(x - w * belly, shelfY - h * 0.55, x - w * 0.62, shelfY - h * 0.9, x - w * 0.5, shelfY - h);
      ctx.lineTo(x + w * 0.5, shelfY - h);
      ctx.bezierCurveTo(x + w * 0.62, shelfY - h * 0.9, x + w * belly, shelfY - h * 0.55, x + w, shelfY);
      ctx.closePath();
      const pg = ctx.createLinearGradient(x - w, shelfY - h, x + w, shelfY);
      pg.addColorStop(0, 'rgba(92,34,22,0.95)');
      pg.addColorStop(0.45, 'rgba(40,13,12,0.95)');
      pg.addColorStop(1, 'rgba(20,6,8,0.95)');
      ctx.fillStyle = pg; ctx.fill();
      /* rim light from the vents behind them */
      ctx.strokeStyle = 'rgba(255,138,62,0.5)'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,166,90,0.22)';
      ctx.beginPath(); ctx.ellipse(x - w * 0.45, shelfY - h * 0.55, 1.9, h * 0.26, 0.06, 0, TAU); ctx.fill();
    });
    /* the board, with a lit edge instead of a hard black bar */
    const sg2 = ctx.createLinearGradient(0, shelfY - 1, 0, shelfY + 13);
    sg2.addColorStop(0, 'rgba(120,52,30,0.95)');
    sg2.addColorStop(0.22, 'rgba(46,15,12,0.95)');
    sg2.addColorStop(1, 'rgba(14,4,6,0.85)');
    ctx.fillStyle = sg2;
    ctx.fillRect(0, shelfY - 1, W, 14);
    ctx.fillStyle = 'rgba(255,160,84,0.30)';
    ctx.fillRect(0, shelfY - 1, W, 1.6);

    /* embers */
    for (let i = 0; i < 54; i++) {
      const life = (t * (0.16 + hash1(i) * 0.2) + hash1(i * 3)) % 1;
      const ex = (hash1(i * 7.3) * 1500 - cam.x * 0.4) % (W + 80) - 40
        + Math.sin(t * 1.4 + i * 2) * 14;
      const ey = H + 20 - life * (H + 60);
      const a = Math.sin(life * Math.PI) * 0.85;
      const r = 0.7 + hash1(i * 2.1) * 1.7;
      ctx.fillStyle = 'rgba(255,' + (120 + Math.floor(hash1(i) * 110)) + ',60,' + a + ')';
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,140,' + a * 0.5 + ')';
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.4, 0, TAU); ctx.fill();
    }

    /* heat haze along the floor */
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#ff9a4a';
    for (let i = 0; i < 8; i++) {
      const y = H * 0.72 + i * 9;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.045 + t * 3 + i) * 3.4);
      ctx.lineTo(W, y + 7); ctx.lineTo(0, y + 7); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
};

/* ======================================================================= */
/*  6. DAWN -- Wednesday, 6:41am, and nobody exploded                      */
/* ======================================================================= */

THEMES.dawn = {
  name: 'Dawn',
  key: '#fff8e6', shadow: '#3e3048',
  ground: '#c3b39a', groundTop: '#ddd0b8', groundH: 7,
  light: '#fff2d8', ambient: '#5d5a72',
  vignette: 0.26, vignetteTint: '#4a3a48',
  grade: ['#ffd9a0', 0.10],
  music: 'dawn',
  back(ctx, cam, W, H, t) {
    ctx.fillStyle = skyGrad(ctx, H, [
      [0, '#6d6a92'], [0.3, '#a98aa0'], [0.6, '#e5b394'], [0.85, '#f7d6ac'], [1, '#fdeccb'],
    ]);
    ctx.fillRect(0, 0, W, H);

    /* the doorway, wide open, full of morning */
    const dx = W * 0.72 - cam.x * 0.10;
    const g = ctx.createRadialGradient(dx, H * 0.55, 10, dx, H * 0.55, 340);
    g.addColorStop(0, 'rgba(255,248,224,0.85)');
    g.addColorStop(0.35, 'rgba(255,232,190,0.42)');
    g.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* god rays leaning in */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const a = -0.75 + i * 0.09;
      const w = 16 + hash1(i * 3.3) * 30;
      ctx.globalAlpha = 0.05 + hash1(i) * 0.05 + Math.sin(t * 0.5 + i) * 0.015;
      ctx.fillStyle = '#fff0cc';
      ctx.save();
      ctx.translate(dx, H * 0.14); ctx.rotate(a + 1.9);
      ctx.beginPath(); ctx.moveTo(-w * 0.2, 0); ctx.lineTo(w * 0.2, 0);
      ctx.lineTo(w * 1.5, 620); ctx.lineTo(-w * 1.5, 620); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    /* the room, softly, in the background */
    const ox = cam.x * 0.13;
    ctx.fillStyle = 'rgba(120,100,110,0.32)';
    scatterX(cam.x, 0.13, 300, W, (i, x) => {
      ctx.fillRect(x, H * 0.30, 150, 7);
      ctx.fillRect(x + 30, H * 0.30 - 34, 22, 34);
      ctx.fillRect(x + 78, H * 0.30 - 50, 30, 50);
    });

    /* dust, everywhere, lit like it matters */
    for (let i = 0; i < 90; i++) {
      const sx = (hash1(i * 3.3) * 1700 - cam.x * 0.34) % (W + 60) - 30;
      const sy = (hash1(i * 7.7) * H * 1.2 + Math.sin(t * 0.3 + i) * 26 - t * 3) % H;
      const r = 0.5 + hash1(i * 2.2) * 1.5;
      ctx.globalAlpha = 0.16 + 0.42 * (0.5 + 0.5 * Math.sin(t * 1.1 + i * 1.7));
      ctx.fillStyle = '#fff6de';
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

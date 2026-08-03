/* Render the app icons from the game's own drawing code.
 *
 *   node tools/icon.js
 *
 * There is no image file anywhere in this project — every critter is vector
 * code — so the app icon is drawn the same way rather than being a separate
 * asset that could drift from the art it advertises. Rodde is the mascot: the
 * design bible's §2.2 silhouette test is exactly the test an app icon has to
 * pass at 40 px on a home screen, and Rodde's leaf ears and nut backpack break
 * the outline enough to survive it.
 *
 * Everything is rendered at 4× and downsampled, so the hairline weights
 * (D.W.hair) turn into soft grey instead of dropping out at small sizes.
 *
 * Writes:
 *   app/ios/FantasyKritter/Assets.xcassets/AppIcon.appiconset/icon-1024.png  (no alpha)
 *   app/desktop/build/icon.png / icon.ico / icon.icns
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const png = require('./png');

const root = path.join(__dirname, '..');

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<script src="js/util.js"></script>
<script src="js/draw.js"></script>
<script src="js/critterart.js"></script>
<script>
window.renderIcon = function (size, rounded) {
  const SS = 4;                       // supersample, then box-filter down
  const big = document.createElement('canvas');
  big.width = big.height = size * SS;
  const g = big.getContext('2d');
  const S = size * SS;
  const NS = window.COC;

  // ---- backdrop: the night violet the whole game sits in
  const bg = g.createRadialGradient(S * 0.5, S * 0.40, S * 0.05, S * 0.5, S * 0.55, S * 0.8);
  bg.addColorStop(0, '#5b4a95');
  bg.addColorStop(0.5, '#33265e');
  bg.addColorStop(1, '#181134');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  // ---- the forest glow behind the figure. It peaks in a ring rather than at
  // the centre, because the centre is covered by the mascot: what has to be
  // bright is the band immediately around the silhouette. That halo is what
  // keeps the icon legible once it is 40 px on a home screen.
  const halo = g.createRadialGradient(S * 0.5, S * 0.46, S * 0.06, S * 0.5, S * 0.46, S * 0.52);
  halo.addColorStop(0, 'rgba(176,232,120,0.10)');
  halo.addColorStop(0.46, 'rgba(158,224,104,0.52)');
  halo.addColorStop(0.68, 'rgba(108,178,92,0.20)');
  halo.addColorStop(1, 'rgba(96,160,88,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, S, S);

  // ---- ground band, so the figure has something to stand on
  const floor = g.createLinearGradient(0, S * 0.66, 0, S);
  floor.addColorStop(0, 'rgba(24,16,44,0)');
  floor.addColorStop(1, 'rgba(14,9,30,0.92)');
  g.fillStyle = floor;
  g.fillRect(0, 0, S, S);

  // ---- the mascot. Kept well inside the frame: iOS masks the corners and
  // macOS insets the whole square again, so anything near an edge is lost.
  g.save();
  g.translate(S * 0.5, S * 0.815);
  const scale = S * 0.58;
  g.scale(scale, scale);
  NS.CritterArt.rodde(g, { _g: null }, 0.55, { attack: 0, hurt: 0, walk: 0, moving: false });
  g.restore();

  // ---- vignette to push the corners back under the mask
  const vig = g.createRadialGradient(S * 0.5, S * 0.5, S * 0.34, S * 0.5, S * 0.5, S * 0.82);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,4,26,0.5)');
  g.fillStyle = vig;
  g.fillRect(0, 0, S, S);

  // ---- downsample
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = 'high';

  if (rounded) {
    // Desktop icons are not masked by the OS, so they carry their own radius.
    const r = size * 0.225;
    o.beginPath();
    o.moveTo(r, 0);
    o.arcTo(size, 0, size, size, r);
    o.arcTo(size, size, 0, size, r);
    o.arcTo(0, size, 0, 0, r);
    o.arcTo(0, 0, size, 0, r);
    o.closePath();
    o.clip();
  }
  o.drawImage(big, 0, 0, size, size);

  const d = o.getImageData(0, 0, size, size).data;
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < d.length; i += CH) {
    s += String.fromCharCode.apply(null, d.subarray(i, Math.min(i + CH, d.length)));
  }
  return btoa(s);
};
</script></body>`;

function write(file, buf) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log('  %s (%d kB)', path.relative(root, file), Math.round(buf.length / 1024));
}

(async () => {
  const tmp = path.join(root, '_icon.html');
  fs.writeFileSync(tmp, PAGE);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + tmp);
  await page.waitForFunction('!!window.renderIcon');

  const pixels = async (size, rounded) => {
    const b64 = await page.evaluate(([s, r]) => window.renderIcon(s, r), [size, rounded]);
    return Buffer.from(b64, 'base64');
  };

  console.log('rendering app icons from the game art…');

  // ---- iOS: one 1024 master, square, no alpha channel
  const ios = await pixels(1024, false);
  write(
    path.join(root, 'app/ios/FantasyKritter/Assets.xcassets/AppIcon.appiconset/icon-1024.png'),
    png.encodeRGB(ios, 1024, 1024)
  );

  // ---- desktop: rounded, with alpha, in every size the packagers ask for
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  const set = [];
  for (const s of sizes) set.push({ size: s, png: png.encodeRGBA(await pixels(s, true), s, s) });

  const build = path.join(root, 'app/desktop/build');
  write(path.join(build, 'icon.png'), set.find((s) => s.size === 1024).png);
  write(path.join(build, 'icon.ico'), png.ico(set.filter((s) => s.size <= 256)));
  write(path.join(build, 'icon.icns'), png.icns(set));

  // ---- proof sheet: the icon at the sizes it is actually seen at. An icon
  // that only works at 1024 is an illustration, not an icon.
  const proofW = 900, proofH = 320;
  const proof = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#1b1636'; g.fillRect(0, 0, w, h);
    let x = 24;
    [180, 120, 80, 60, 40, 29].forEach((s) => {
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = s;
      const b = atob(window.renderIcon(s, true));
      const id = tmp.getContext('2d').createImageData(s, s);
      for (let i = 0; i < b.length; i++) id.data[i] = b.charCodeAt(i);
      tmp.getContext('2d').putImageData(id, 0, 0);
      g.drawImage(tmp, x, 40);
      g.fillStyle = '#9d94c4';
      g.font = '12px system-ui';
      g.fillText(s + ' px', x, 40 + s + 18);
      x += s + 26;
    });
    const d = g.getImageData(0, 0, w, h).data;
    let str = '';
    for (let i = 0; i < d.length; i += 0x8000) {
      str += String.fromCharCode.apply(null, d.subarray(i, Math.min(i + 0x8000, d.length)));
    }
    return btoa(str);
  }, [proofW, proofH]);
  write(path.join(root, 'shots/appicon.png'), png.encodeRGBA(Buffer.from(proof, 'base64'), proofW, proofH));

  await browser.close();
  fs.unlinkSync(tmp);

  if (errors.length) {
    console.error('\nconsole errors while rendering:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });

/* Contact sheet for the critter art, with the silhouette test the design bible
 * (§2.2) makes non-negotiable: each critter is rendered normally AND in pure
 * black. If two silhouettes read the same, the design has to change.
 *
 *   node tools/sheet.js [out.png]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'shots', 'critters.png');
fs.mkdirSync(path.dirname(out), { recursive: true });

const HTML = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#15112a;font-family:system-ui;color:#eee;padding:16px">
<div id="grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px"></div>
<script src="js/util.js"></script>
<script src="js/draw.js"></script>
<script src="js/critterart.js"></script>
<script>
const NS = window.COC;
const names = Object.keys(NS.CritterArt);
const grid = document.getElementById('grid');
names.forEach((id) => {
  const cell = document.createElement('div');
  cell.style.cssText='background:linear-gradient(180deg,#2b2350,#1d1738);border-radius:14px;'+
    'padding:8px;text-align:center;border:1px solid rgba(255,255,255,.09)';
  const wrap = document.createElement('div');
  wrap.style.cssText='display:flex;gap:6px;justify-content:center';

  [false, true].forEach((silhouette) => {
    const size = 150, dpr = 2;
    const cv = document.createElement('canvas');
    cv.width = size*dpr; cv.height = size*dpr;
    cv.style.cssText='width:'+size+'px;height:'+size+'px;border-radius:10px;background:'+
      (silhouette ? '#e8e4f5' : 'radial-gradient(circle at 50% 40%, #3d3468, #241c44)');
    const ctx = cv.getContext('2d');
    ctx.scale(dpr,dpr);
    ctx.save();
    ctx.translate(size/2, size*0.90);
    const s = size*0.62;
    ctx.scale(s,s);
    const self = { _g: null };
    if (silhouette) {
      // Draw everything, then keep only the alpha as flat black.
      NS.CritterArt[id](ctx, self, 0.6, {attack:0,walk:0,moving:false});
      ctx.restore();
      ctx.globalCompositeOperation='source-in';
      ctx.fillStyle='#15112a';
      ctx.fillRect(0,0,size,size);
    } else {
      NS.CritterArt[id](ctx, self, 0.6, {attack:0,walk:0,moving:false});
      ctx.restore();
    }
    wrap.appendChild(cv);
  });

  cell.appendChild(wrap);
  const n=document.createElement('div');
  n.innerHTML='<b style="font-size:14px">'+id+'</b>';
  n.style.marginTop='6px';
  cell.appendChild(n);
  grid.appendChild(cell);
});
</script></body>`;

(async () => {
  fs.writeFileSync(path.join(root, '_sheet.html'), HTML);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(root, '_sheet.html'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  fs.unlinkSync(path.join(root, '_sheet.html'));
  if (errors.length) { console.log('ERRORS:', [...new Set(errors)]); process.exitCode = 1; }
  console.log('wrote', out);
})();

/* Contact sheet of every critter, so art changes can be eyeballed all at once.
 *   node tools/sheet.js [out.png]
 */
'use strict';
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'shots', '0-critters.png');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const NS = window.COC;
    document.body.innerHTML = '';
    document.body.style.cssText =
      'background:#241a3a;margin:0;padding:16px;font-family:system-ui;color:#eee';
    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(7,1fr);gap:10px';
    document.body.appendChild(grid);

    const all = NS.Cards.list.concat(Object.values(NS.Cards.spawnOnly));
    all.forEach((c) => {
      const cell = document.createElement('div');
      cell.style.cssText =
        'background:#3a2c5c;border-radius:10px;padding:6px;text-align:center';
      const cv = document.createElement('canvas');
      const size = 130, dpr = 2;
      cv.width = size * dpr; cv.height = size * dpr;
      cv.style.cssText = 'width:' + size + 'px;height:' + size + 'px';
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#6fa858';
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size * 0.84);
      NS.Art.shadow(ctx, 0, 2, size * 0.2, 0.2);
      if (c.kind === 'building') {
        NS.Art.building(ctx, c.art, { t: 0.4, scale: size * 0.62, aim: -0.7 });
      } else {
        NS.Art.critter(ctx, c.art, {
          t: 0.4, scale: size * 0.55, walk: 1.2, moving: true,
          flying: !!c.air, teamColor: '#4a8fe0',
        });
      }
      ctx.restore();
      cell.appendChild(cv);
      const n = document.createElement('div');
      n.textContent = c.name + (c.cost ? '  ·  ' + c.cost : '');
      n.style.cssText = 'font-size:11px;margin-top:4px';
      cell.appendChild(n);
      grid.appendChild(cell);
    });
  });

  await page.waitForTimeout(400);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  if (errors.length) { console.log('errors:', errors); process.exitCode = 1; }
  console.log('wrote', out);
})();

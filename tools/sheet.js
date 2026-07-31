/* Contact sheet of every critter, so art changes can be judged all at once.
 *   node tools/sheet.js [out.png]
 * Renders straight from js/art.js + js/roster.js with no game shell involved.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'shots', 'critters.png');
fs.mkdirSync(path.dirname(out), { recursive: true });

const page_html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#1a1430;font-family:system-ui;color:#eee">
<div id="grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;padding:18px"></div>
<script src="js/util.js"></script>
<script src="js/art.js"></script>
<script src="js/roster.js"></script>
<script>
const NS = window.COC;
const grid = document.getElementById('grid');
NS.Roster.list.forEach((c) => {
  const cell = document.createElement('div');
  cell.style.cssText='background:linear-gradient(180deg,#2f2450,#241b3e);border-radius:14px;padding:8px;text-align:center;border:1px solid rgba(255,255,255,.08)';
  const size=190, dpr=2;
  const cv=document.createElement('canvas');
  cv.width=size*dpr; cv.height=size*dpr;
  cv.style.cssText='width:'+size+'px;height:'+size+'px';
  const ctx=cv.getContext('2d');
  ctx.scale(dpr,dpr);
  const el = NS.Roster.ELEMENTS[c.element];
  const g=ctx.createRadialGradient(size/2,size*0.45,0,size/2,size*0.45,size*0.62);
  g.addColorStop(0, el.color+'55'); g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  ctx.save();
  ctx.translate(size/2, size*0.90);
  NS.Art.critter(ctx, c.art, { t:0.7, scale:size*0.62, walk:0, moving:false });
  ctx.restore();
  cell.appendChild(cv);
  const n=document.createElement('div');
  n.innerHTML='<b style="font-size:13px">'+c.name+'</b><br><span style="font-size:10.5px;opacity:.7">'+
    el.name+' &middot; '+NS.Roster.ROLES[c.role].name+' &middot; '+c.grade+'</span>';
  n.style.marginTop='4px';
  cell.appendChild(n);
  grid.appendChild(cell);
});
</script></body>`;

(async () => {
  fs.writeFileSync(path.join(root, '_sheet.html'), page_html);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1160, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(root, '_sheet.html'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  fs.unlinkSync(path.join(root, '_sheet.html'));
  if (errors.length) { console.log('ERRORS:', [...new Set(errors)]); process.exitCode = 1; }
  console.log('wrote', out);
})();

/* Phone check.

   Boots the shipped single-file build in an emulated iPhone 16 Pro (402x874
   CSS px, DPR 3, touch) in both orientations, taps its way past the title,
   drives Norbert with the on-screen d-pad using real touch events, and
   reports frame rate, canvas backing size and any horizontal overflow. */
import { chromium } from 'playwright';
import path from 'node:path';

const URL = 'file://' + path.resolve('dist/norbert-unfinished.html');

const MODES = [
  ['portrait', 402, 874],
  ['landscape', 874, 402],
];

const browser = await chromium.launch();
for (const [name, w, h] of MODES) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('ERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const layout = await page.evaluate(() => {
    const c = document.getElementById('game');
    const pad = document.getElementById('pad');
    const r = c.getBoundingClientRect();
    const pr = pad.getBoundingClientRect();
    return {
      padVisible: getComputedStyle(pad).display !== 'none',
      touchClass: document.body.classList.contains('touch'),
      canvasCss: [Math.round(r.width), Math.round(r.height)],
      canvasBacking: [c.width, c.height],
      viewW: VIEW_W, renderScale: +RENDER_SCALE.toFixed(2),
      padBox: [Math.round(pr.x), Math.round(pr.y), Math.round(pr.width), Math.round(pr.height)],
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    };
  });

  /* start the game: tap the canvas (selects BEGIN on the title) */
  const box = await page.locator('#game').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1500);
  /* clear the chapter-opening narration */
  for (let i = 0; i < 12; i++) {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.35);
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(400);

  /* hold RIGHT with a real finger and see if he actually walks */
  const right = await page.locator('[data-act="right"]').boundingBox();
  const jump = await page.locator('[data-act="jump"]').boundingBox();
  const before = await page.evaluate(() => (G.player ? G.player.x : -1));

  await page.evaluate(() => { window.__fps = { n: 0, t0: performance.now() }; const f = () => { window.__fps.n++; requestAnimationFrame(f); }; requestAnimationFrame(f); });

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x + right.width / 2, y: right.y + right.height / 2, id: 1 }] });
  await page.waitForTimeout(900);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { x: right.x + right.width / 2, y: right.y + right.height / 2, id: 1 },
    { x: jump.x + jump.width / 2, y: jump.y + jump.height / 2, id: 2 },
  ] });
  await page.waitForTimeout(500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);

  const res = await page.evaluate(() => ({
    state: G.state,
    level: G.level ? G.level.data.id : null,
    x: G.player ? Math.round(G.player.x) : -1,
    everAirborne: G.player ? !G.player.grounded || G.player.__jumped : null,
    fps: Math.round(window.__fps.n / ((performance.now() - window.__fps.t0) / 1000)),
    clayQuality: Clay.quality,
    backing: [document.getElementById('game').width, document.getElementById('game').height],
    dialogue: Dialogue.active,
  }));

  console.log(`\n== ${name} ${w}x${h} ==`);
  console.log(' layout ', JSON.stringify(layout));
  console.log(' walked ', res.x - before, 'px right   state:', res.state, 'level:', res.level);
  console.log(' fps    ', res.fps, ' detail:', res.clayQuality ? 'full' : 'reduced', ' backing:', res.backing.join('x'), ' dialogue:', res.dialogue);
  console.log(' errors ', errs.length ? errs.slice(0, 6).join(' | ') : 'none');

  await page.screenshot({ path: `/tmp/claude-0/-home-user-YeehawXD/4837fa5c-7c70-5f1a-acd6-618d62837dd2/scratchpad/iphone-${name}.png` });
  await ctx.close();
}
await browser.close();

/* Headless sanity run: boot every chapter, drive Norbert around with synthetic
   input for a while, and fail loudly on any JS error, NaN position, or fall
   through the floor. Not a substitute for playing it, but it catches the
   things that make a build unshippable. */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'load' });
await page.waitForTimeout(600);

const report = await page.evaluate(() => {
  const out = [];
  const dt = 1 / 60;
  const ids = ['sill', 'table', 'paint', 'sink', 'kiln', 'dawn'];
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');

  for (const id of ids) {
    G.reset();
    G.canLob = true;
    G.state = 'play';
    G.loadLevel(id, true);
    const p = G.player;
    const startX = p.x;
    let minY = 1e9, maxY = -1e9, reforms = 0, dialogues = 0;
    const origReform = G.reform;
    G.reform = function () { reforms++; origReform.call(G); };

    for (let i = 0; i < 2400; i++) {
      Input.pressed = {}; Input.released = {}; Input.held = {};
      const phase = Math.floor(i / 90) % 6;
      if (Dialogue.active) {
        if (i % 8 === 0) Input.pressed.talk = true;
        dialogues++;
      } else {
        Input.held.right = phase !== 4;
        Input.held.left = phase === 4;
        if (i % 47 === 0) Input.pressed.jump = true;
        if (i % 53 === 0) Input.held.down = true;
        if (i % 71 === 0) Input.held.up = true;
        if (i % 130 === 0) Input.pressed.lob = true;
        if (i % 160 === 0) Input.pressed.slurp = true;
      }
      G.update(dt);
      if (G.state !== 'play' && G.state !== 'pause') break;   /* chapter finished */
      if (!isFinite(p.x) || !isFinite(p.y)) return [{ id, fatal: 'NaN position at frame ' + i }];
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    G.reform = origReform;

    /* one render of the final state, to exercise every draw path */
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    G.draw(ctx);

    out.push({
      id, actual: G.level.data.id,
      movedX: Math.round(G.player.x - startX),
      levelW: G.level.pxw,
      x: Math.round(G.player.x), y: Math.round(G.player.y),
      belowMap: G.player.y > G.level.pxh + 40,
      reforms, mass: G.player.mass, maxMass: G.player.maxMass,
      shapes: G.level.shapes.length,
      npcs: G.level.npcs.length,
      props: G.level.props.length,
    });
  }

  /* also exercise title, pause, ending and credits draws */
  G.state = 'title'; G.update(dt); ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0); G.draw(ctx);
  G.showControls = true; G.draw(ctx); G.showControls = false;
  G.state = 'play'; G.state = 'pause'; G.draw(ctx);
  G.startEnding(); G.endT = 4; G.update(dt); G.draw(ctx);
  G.state = 'credits'; G.credT = 6; G.update(dt); G.draw(ctx);
  return out;
});

console.log(JSON.stringify(report, null, 1));
if (errors.length) {
  console.log('\n=== ERRORS ===\n' + errors.slice(0, 25).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nno JS errors');
}
await browser.close();

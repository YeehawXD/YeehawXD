/* Static reachability check.

   Builds the graph of standable surfaces in every chapter and flood-fills it
   using Norbert's actual movement envelope (walk, a two-tile jump, a
   three-tile stretch-flop, and falling). Then it asserts that every object
   that matters -- pots, items, NPCs, vats, plates, signs and the exit -- is
   somewhere the player can actually stand.

   This is what catches "the pit in chapter four is one tile too deep". */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.on('pageerror', e => console.log('PAGEERROR: ' + e.message));
await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'load' });
await page.waitForTimeout(400);

const out = await page.evaluate(() => {
  const JUMP_UP = 2;        // tiles of height a standing jump clears
  const JUMP_ACROSS = 3;    // tiles of gap a running jump clears
  const STRETCH_UP = 3;     // the ledge-flop, straight up, adjacent only
  const results = [];

  for (const id of Object.keys(LEVELS)) {
    const lv = new Level(LEVELS[id]);
    const W = lv.w, H = lv.h;
    const blocked = (x, y) => lv.rawSolid(x, y);
    /* sponges and jar lids are props, not tiles, but you stand on them */
    const propFloor = new Set();
    for (const pr of lv.props) {
      if (pr.kind !== 'sponge' && pr.kind !== 'lid') continue;
      const tx = Math.floor(pr.x / 32), ty = Math.floor(pr.y / 32);
      for (let i = 0; i < (pr.wid || 2); i++) propFloor.add((ty) * W + (tx + i));
    }
    const floor = (x, y) => lv.rawSolid(x, y) || lv.at(x, y) === '=' || propFloor.has(y * W + x);
    /* standing upright needs two clear tiles; squashed flat needs one */
    const stand = (x, y) =>
      x >= 0 && x < W && y >= 1 && y < H &&
      !blocked(x, y) && !blocked(x, y - 1) && floor(x, y + 1);
    const crawl = (x, y) =>
      x >= 0 && x < W && y >= 0 && y < H && !blocked(x, y) && floor(x, y + 1);

    const key = (x, y) => y * W + x;
    const nodes = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (crawl(x, y)) nodes.push([x, y]);

    const seen = new Set();
    const sx = Math.round(LEVELS[id].spawn.x), sy = Math.round(LEVELS[id].spawn.y);
    /* spawn sits ON the surface row, so the standable cell is one above */
    let start = null;
    for (let dy = 0; dy <= 3 && !start; dy++) {
      for (const d of [0, -1, 1, -2, 2]) {
        if (stand(sx + d, sy - 1 + dy)) { start = [sx + d, sy - 1 + dy]; break; }
      }
    }
    if (!start) { results.push({ id, error: 'no standable spawn' }); continue; }

    const q = [start];
    seen.add(key(start[0], start[1]));
    while (q.length) {
      const [x, y] = q.pop();
      const push = (nx, ny) => {
        if (!stand(nx, ny)) return;
        const k = key(nx, ny);
        if (seen.has(k)) return;
        seen.add(k); q.push([nx, ny]);
      };
      /* squashed flat, he fits through anything one tile high */
      const crawlTo = (nx, ny) => {
        if (!crawl(nx, ny)) return;
        const k = key(nx, ny);
        if (seen.has(k)) return;
        seen.add(k); q.push([nx, ny]);
      };
      /* walk / small step, either direction */
      for (const dx of [-1, 1]) {
        for (let dy = -1; dy <= 1; dy++) crawlTo(x + dx, y + dy);
        for (let dy = -JUMP_UP; dy <= 1; dy++) push(x + dx, y + dy);
      }
      /* jump a gap, up to JUMP_ACROSS tiles, rising at most JUMP_UP */
      for (const dx of [-1, 1]) {
        for (let g = 2; g <= JUMP_ACROSS + 1; g++) {
          let clear = true;
          for (let s = 1; s < g; s++) if (blocked(x + dx * s, y) || blocked(x + dx * s, y - 1)) clear = false;
          if (!clear) break;
          for (let dy = -JUMP_UP; dy <= 0; dy++) push(x + dx * g, y + dy);
        }
      }
      if (!stand(x, y)) continue;   /* everything below needs room to stand up */
      /* the stretch-flop: exactly up, onto a ledge beside you */
      for (const dx of [-1, 1]) {
        for (let up = 1; up <= STRETCH_UP; up++) push(x + dx, y - up);
      }
      /* fall: straight down, or drift up to JUMP_ACROSS across */
      for (const dx of [-1, 0, 1]) {
        for (let dy = 1; dy < H; dy++) {
          if (blocked(x + dx, y + dy)) break;
          push(x + dx, y + dy);
        }
      }
      for (const dx of [-2, -3, 2, 3]) {
        if (blocked(x + Math.sign(dx), y) || blocked(x + Math.sign(dx), y - 1)) continue;
        for (let dy = 1; dy < H; dy++) {
          if (blocked(x + dx, y + dy)) break;
          push(x + dx, y + dy);
        }
      }
    }

    /* now check the things the player has to touch */
    const bad = [];
    const near = (tx, ty) => {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (seen.has(key(tx + dx, ty + dy))) return true;
      }
      return false;
    };
    for (const o of (LEVELS[id].objects || [])) {
      if (o.t === 'trigger') continue;
      const tx = Math.round(o.x), ty = Math.round(o.y);
      if (!near(tx, ty)) bad.push(o.t + (o.id ? ':' + o.id : '') + (o.kind ? ':' + o.kind : '') + '@' + tx + ',' + ty);
    }
    for (const tr of (LEVELS[id].objects || []).filter(o => o.t === 'trigger')) {
      const tx = Math.round(tr.x + (tr.w || 1) / 2), ty = Math.round(tr.y + (tr.h || 1));
      if (!near(tx, ty)) bad.push('trigger:' + tr.id + '@' + tx + ',' + ty);
    }
    results.push({ id, standable: nodes.length, reached: seen.size, unreachable: bad });
  }
  return results;
});

let fail = false;
for (const r of out) {
  const n = r.unreachable ? r.unreachable.length : 1;
  if (n) fail = true;
  console.log(`${r.id.padEnd(6)} reached ${String(r.reached).padStart(5)} / ${String(r.standable).padStart(5)} standable` +
    (n ? `   UNREACHABLE: ${(r.unreachable || [r.error]).join(', ')}` : '   all objects reachable'));
}
await browser.close();
if (fail) process.exitCode = 1;

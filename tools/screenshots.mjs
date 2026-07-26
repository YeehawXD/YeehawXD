/* Capture the Steam store set.

   Every image here is the real game running in a real browser at 1920x1080 --
   index.html?shot=<name> poses a scene, simulates it forward at a fixed
   timestep and parks on a settled frame. Nothing is composited or retouched. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const SHOTS = [
  ['01-title', 'title'],
  ['02-windowsill', 'sill'],
  ['03-gary', 'gary'],
  ['04-squash', 'squish'],
  ['05-great-table', 'table'],
  ['06-the-thumb', 'thumb'],
  ['07-paint-shelf', 'paint'],
  ['08-glaze', 'glaze'],
  ['09-the-sink', 'sink'],
  ['10-steve', 'steve'],
  ['11-kiln-room', 'kiln'],
  ['12-the-council', 'council'],
  ['13-pippa', 'pippa'],
  ['14-dawn', 'dawn'],
  ['15-ending', 'ending'],
];

const OUT = process.env.SHOT_DIR || 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errs = [];
for (const [name, shot] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errs.push(`${shot}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errs.push(`${shot}: ${m.text()}`); });
  const view = process.env.SHOT_VIEW === '2d' ? '&view=2d' : '';
  await page.goto(`http://127.0.0.1:8099/index.html?shot=${shot}${view}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
  const el = await page.$('#stack');
  await el.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
  console.log('captured', name);
}
await browser.close();
if (errs.length) { console.log('\nERRORS:\n' + errs.join('\n')); process.exitCode = 1; }
else console.log('\nall clean');

/* Quick single-page screenshotter used while building.
   usage: node tools/shot.mjs <file-or-url> <out.png> [width] [height] [waitMs] */
import { chromium } from 'playwright';
import path from 'node:path';

const target = process.argv[2];
const out = process.argv[3] || 'shot.png';
const w = +(process.argv[4] || 1920);
const h = +(process.argv[5] || 1080);
const wait = +(process.argv[6] || 700);

const url = target.startsWith('http') ? target : 'file://' + path.resolve(target);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(wait);
await page.screenshot({ path: out });
await browser.close();
if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exitCode = 1; }
else console.log('ok -> ' + out);

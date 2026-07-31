/* Drives the real game in Chromium: captures every screen and fails on any
 * console error or unhandled exception.
 *   node tools/shots.js [outdir]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'shots');
fs.mkdirSync(out, { recursive: true });

const errors = [];
function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text()); });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 430, height: 880 }, deviceScaleFactor: 2 });
  watch(page, 'phone');
  const shot = (n) => page.screenshot({ path: path.join(out, n + '.png') });

  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(800);
  await shot('1-title');

  // codex + detail
  await page.click('[data-go="codex"]');
  await page.waitForTimeout(400);
  await shot('2-codex');
  await page.click('#codex-grid .ccard:nth-child(4)');
  await page.waitForTimeout(350);
  await shot('3-detail');
  await page.click('#critter-detail .btn');
  await page.waitForTimeout(200);
  await page.click('#s-codex [data-back]');
  await page.waitForTimeout(300);

  // how to play
  await page.click('[data-go="howto"]');
  await page.waitForTimeout(300);
  await shot('4-howto');
  await page.click('#s-howto [data-back]');
  await page.waitForTimeout(250);

  // start a run
  await page.click('[data-go="newrun"]');
  await page.waitForTimeout(600);
  await shot('5-map');

  // walk into the first node
  await page.click('#map-inner .map-node.reachable');
  await page.waitForTimeout(500);
  await shot('6-formation');

  // move a critter to prove the formation UI works
  const bench = await page.$$('#bench .ccard');
  if (bench.length) {
    await bench[0].click();
    await page.waitForTimeout(150);
    await page.click('#board .slot:nth-child(2)');
    await page.waitForTimeout(250);
    await shot('7-formation-moved');
  }

  // fight
  await page.click('#btn-fight');
  await page.waitForTimeout(1400);
  await shot('8-battle-start');

  // charge everyone and fire an ultimate while the fight is still live
  const fired = await page.evaluate(() => {
    const UI = window.COC.UI;
    if (!UI.battle || UI.battle.state === 'won' || UI.battle.state === 'lost') return false;
    UI.battle.allOf('ally').forEach((u) => { u.energy = 100; });
    const first = UI.battle.side('ally')[0];
    if (!first) return false;
    UI.battle.fireUlt(first);
    return true;
  });
  await page.waitForTimeout(350);
  await shot('9-battle-mid');
  if (!fired) console.log('note: fight resolved before the ultimate could fire');

  // let the fight resolve
  await page.evaluate(() => { window.COC.UI.speed = 6; });
  await page.waitForTimeout(9000);
  await shot('11-reward');

  const state = await page.evaluate(() => ({
    screen: window.COC.UI.screen,
    hasRun: !!window.COC.UI.run,
    battleState: window.COC.UI.battle ? window.COC.UI.battle.state : null,
    roster: window.COC.UI.run ? window.COC.UI.run.roster.length : 0,
  }));
  console.log('state after first fight:', JSON.stringify(state));

  // take a reward and get back to the map
  const choice = await page.$('#reward-choices .choice');
  if (choice) { await choice.click(); await page.waitForTimeout(600); }
  await shot('12-map-after');

  // desktop sanity check
  const wide = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  watch(wide, 'desktop');
  await wide.goto('file://' + path.join(root, 'index.html'));
  await wide.waitForTimeout(700);
  await wide.screenshot({ path: path.join(out, '13-desktop.png') });

  await browser.close();

  if (errors.length) {
    console.log('\nERRORS:');
    [...new Set(errors)].forEach((e) => console.log(' -', e));
    process.exitCode = 1;
  } else {
    console.log('\nno console errors');
  }
  console.log('screenshots in', out);
})();

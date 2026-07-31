/* Screenshot harness — drives the real game in Chromium and captures screens.
 *   node tools/shots.js [outdir]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'shots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 2 });

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, '1-menu.png') });

  // collection
  await page.click('[data-act="cards"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, '2-cards.png') });

  // card detail
  await page.click('#all-cards .card:nth-child(6)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, '3-detail.png') });
  await page.click('#s-carddetail .btn-blue');
  await page.waitForTimeout(200);

  // deck builder
  await page.click('#s-cards [data-act="menu"]');
  await page.waitForTimeout(250);
  await page.click('#s-menu [data-act="deck"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, '4-deck.png') });

  // battle
  await page.click('#s-deck [data-act="menu"]');
  await page.waitForTimeout(250);
  await page.click('#s-menu [data-act="battle"]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, '5-battle-countdown.png') });

  // let both sides fight, then drop some cards of our own
  await page.waitForTimeout(3000);
  const box = await page.locator('#arena').boundingBox();
  const drop = async (slot, fx, fy) => {
    const card = await page.locator('#hand .card').nth(slot).boundingBox();
    if (!card) return;
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  };
  await drop(0, 0.25, 0.66);
  await page.waitForTimeout(2200);
  await drop(1, 0.3, 0.62);
  await page.waitForTimeout(2500);
  await drop(2, 0.72, 0.6);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(out, '6-battle-fight.png') });

  await page.waitForTimeout(9000);
  await page.screenshot({ path: path.join(out, '7-battle-later.png') });

  // fast-forward to the end so we can capture the result card
  await page.evaluate(() => { window.COC.BattleScreen.speed = 30; });
  await page.waitForTimeout(14000);
  await page.screenshot({ path: path.join(out, '8-result.png') });

  // help screen
  await page.evaluate(() => { window.COC.Game.hideOverlay('result'); window.COC.Game.show('help'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, '9-help.png') });

  // desktop-ish viewport sanity check
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page2.on('pageerror', (e) => errors.push('desktop pageerror: ' + e.message));
  await page2.goto('file://' + path.join(root, 'index.html'));
  await page2.waitForTimeout(700);
  await page2.click('#s-menu [data-act="battle"]');
  await page2.waitForTimeout(6000);
  await page2.screenshot({ path: path.join(out, '10-desktop.png') });

  await browser.close();

  if (errors.length) {
    console.log('PAGE ERRORS:');
    [...new Set(errors)].forEach((e) => console.log(' -', e));
    process.exitCode = 1;
  } else {
    console.log('no page errors');
  }
  console.log('screenshots in', out);
})();

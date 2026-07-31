/* Headless balance / smoke test.
 *   node tools/sim.js [battles]
 * Runs full AI-vs-AI battles with no DOM and reports outcomes, match length and
 * per-deck win rates. Both sides are driven by the real AI.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
  window: {},
  document: { createElement: () => ({ getContext: () => null }) },
  performance: { now: () => Date.now() },
  navigator: {},
  console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

['js/util.js', 'js/cards.js', 'js/battle.js', 'js/ai.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});

const NS = sandbox.window.COC;
const { Battle, AI, Cards } = NS;

const N = parseInt(process.argv[2] || '60', 10);
const STEP = 1 / 60;
const LEVELS = ['easy', 'normal', 'hard', 'insane'];

const tally = { player: 0, enemy: 0, draw: 0 };
const reasons = {};
const lengths = [];
const deck = {};      // name -> {w, l, d}
const level = {};     // difficulty -> {w, l, d}
const errors = [];

function bump(map, key, field) {
  const r = map[key] || (map[key] = { w: 0, l: 0, d: 0 });
  r[field]++;
}

for (let i = 0; i < N; i++) {
  const dA = Cards.AI_DECKS[i % Cards.AI_DECKS.length];
  const dB = Cards.AI_DECKS[(i * 3 + 1) % Cards.AI_DECKS.length];
  const lA = LEVELS[i % LEVELS.length];
  const lB = LEVELS[(i + 2) % LEVELS.length];

  const b = new Battle({ seed: 1000 + i, playerDeck: dA.cards, enemyDeck: dB.cards });
  const aiP = new AI(b, lA, 7 + i, 'player');
  const aiE = new AI(b, lB, 99 + i, 'enemy');

  let t = 0;
  try {
    while (b.phase !== 'ended' && t < 400) {
      b.update(STEP);
      aiP.update(STEP);
      aiE.update(STEP);
      t += STEP;
    }
  } catch (e) {
    errors.push('battle ' + i + ': ' + e.message + '\n   ' + e.stack.split('\n').slice(1, 4).join('\n   '));
    continue;
  }
  if (b.phase !== 'ended') { errors.push('battle ' + i + ' never ended'); continue; }

  const w = b.result.winner || 'draw';
  tally[w]++;
  reasons[b.result.reason] = (reasons[b.result.reason] || 0) + 1;
  lengths.push(b.result.time);

  if (w === 'draw') {
    bump(deck, dA.name, 'd'); bump(deck, dB.name, 'd');
    bump(level, lA, 'd'); bump(level, lB, 'd');
  } else {
    const win = w === 'player';
    bump(deck, dA.name, win ? 'w' : 'l');
    bump(deck, dB.name, win ? 'l' : 'w');
    bump(level, lA, win ? 'w' : 'l');
    bump(level, lB, win ? 'l' : 'w');
  }
}

const pct = (r) => {
  const n = r.w + r.l + r.d;
  return n ? Math.round((r.w / n) * 100) + '% of ' + n : '—';
};

console.log('battles:', N);
console.log('outcome:', tally);
console.log('reasons:', reasons);
if (lengths.length) {
  const sorted = lengths.slice().sort((a, b) => a - b);
  const avg = lengths.reduce((s, v) => s + v, 0) / lengths.length;
  console.log('length: avg %ss  median %ss  min %ss  max %ss',
    avg.toFixed(0), sorted[sorted.length >> 1].toFixed(0),
    sorted[0].toFixed(0), sorted[sorted.length - 1].toFixed(0));
}
console.log('\nwin rate by difficulty:');
LEVELS.forEach((l) => { if (level[l]) console.log('  %s: %s', l.padEnd(7), pct(level[l])); });
console.log('\nwin rate by deck:');
Object.keys(deck).forEach((k) => console.log('  %s: %s', k.padEnd(16), pct(deck[k])));

if (errors.length) {
  console.log('\nERRORS (' + errors.length + '):');
  errors.slice(0, 5).forEach((e) => console.log(' -', e));
  process.exitCode = 1;
} else {
  console.log('\nno errors');
}

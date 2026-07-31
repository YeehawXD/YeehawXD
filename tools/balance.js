/* Controlled balance experiments.
 *   node tools/balance.js skill [gamesPerPair]   difficulty round-robin, mirrored decks
 *   node tools/balance.js decks [gamesPerPair]   deck round-robin, equal difficulty
 *
 * Every pairing is played twice per seed with the seats swapped, so seat
 * advantage cancels out and the numbers mean something.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
  window: {}, document: { createElement: () => ({ getContext: () => null }) },
  performance: { now: () => Date.now() }, navigator: {}, console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
['js/util.js', 'js/cards.js', 'js/battle.js', 'js/ai.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
const NS = sandbox.window.COC;
const { Battle, AI, Cards } = NS;

const STEP = 1 / 60;

function run(deckA, deckB, lvlA, lvlB, seed) {
  const b = new Battle({ seed, playerDeck: deckA, enemyDeck: deckB });
  const aiP = new AI(b, lvlA, seed * 3 + 1, 'player');
  const aiE = new AI(b, lvlB, seed * 7 + 5, 'enemy');
  let t = 0;
  while (b.phase !== 'ended' && t < 400) {
    b.update(STEP); aiP.update(STEP); aiE.update(STEP); t += STEP;
  }
  return b.result || { winner: null, reason: 'timeout' };
}

/** Play `games` seeds of A-vs-B, swapping seats each time. Returns A's record. */
function duel(deckA, deckB, lvlA, lvlB, games) {
  const rec = { w: 0, l: 0, d: 0 };
  for (let i = 0; i < games; i++) {
    const seed = 5000 + i * 13;
    let r = run(deckA, deckB, lvlA, lvlB, seed);
    score(rec, r.winner === 'player' ? 'w' : r.winner === 'enemy' ? 'l' : 'd');
    // swap seats
    r = run(deckB, deckA, lvlB, lvlA, seed);
    score(rec, r.winner === 'enemy' ? 'w' : r.winner === 'player' ? 'l' : 'd');
  }
  return rec;
}
function score(rec, k) { rec[k]++; }
function rate(rec) {
  const n = rec.w + rec.l + rec.d;
  return n ? ((rec.w + rec.d * 0.5) / n) : 0;
}

const mode = process.argv[2] || 'skill';
const games = parseInt(process.argv[3] || '6', 10);

if (mode === 'skill') {
  const LEVELS = ['easy', 'normal', 'hard', 'insane'];
  const mirrorDeck = Cards.AI_DECKS[0].cards;
  console.log('Difficulty round-robin — both sides play "%s", %d games per pairing\n',
    Cards.AI_DECKS[0].name, games * 2);
  const totals = {};
  LEVELS.forEach((l) => (totals[l] = { w: 0, l: 0, d: 0 }));

  let header = 'vs'.padEnd(9);
  LEVELS.forEach((l) => (header += l.padStart(9)));
  console.log(header);
  LEVELS.forEach((a) => {
    let row = a.padEnd(9);
    LEVELS.forEach((b) => {
      if (a === b) { row += '   —'.padStart(9); return; }
      const rec = duel(mirrorDeck, mirrorDeck, a, b, games);
      totals[a].w += rec.w; totals[a].l += rec.l; totals[a].d += rec.d;
      row += (Math.round(rate(rec) * 100) + '%').padStart(9);
    });
    console.log(row);
  });
  console.log('\noverall score (win + half a draw):');
  LEVELS.forEach((l) => {
    console.log('  %s %s%%  (%dW %dL %dD)', l.padEnd(8),
      String(Math.round(rate(totals[l]) * 100)).padStart(3),
      totals[l].w, totals[l].l, totals[l].d);
  });
} else {
  const decks = Cards.AI_DECKS;
  const lvl = process.argv[4] || 'hard';
  console.log('Deck round-robin at difficulty "%s", %d games per pairing\n', lvl, games * 2);
  const totals = {};
  decks.forEach((d) => (totals[d.name] = { w: 0, l: 0, d: 0 }));
  for (let i = 0; i < decks.length; i++) {
    for (let j = i + 1; j < decks.length; j++) {
      const rec = duel(decks[i].cards, decks[j].cards, lvl, lvl, games);
      totals[decks[i].name].w += rec.w; totals[decks[i].name].l += rec.l; totals[decks[i].name].d += rec.d;
      totals[decks[j].name].w += rec.l; totals[decks[j].name].l += rec.w; totals[decks[j].name].d += rec.d;
    }
  }
  Object.entries(totals)
    .sort((a, b) => rate(b[1]) - rate(a[1]))
    .forEach(([name, rec]) => {
      console.log('  %s %s%%  (%dW %dL %dD)', name.padEnd(17),
        String(Math.round(rate(rec) * 100)).padStart(3), rec.w, rec.l, rec.d);
    });
}

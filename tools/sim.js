/* Headless run simulator — does the game actually work end to end, and is it
 * winnable without being trivial?
 *
 *   node tools/sim.js [runs]
 *
 * Plays complete runs with a simple, honest policy: take the reward that looks
 * best by a crude heuristic, keep the formation the auto-arranger picks, and
 * fire ultimates on cooldown. A human playing well should do better than this;
 * if the bot never wins, the game is too hard, and if it always wins, too easy.
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
['js/util.js', 'js/roster.js', 'js/combat.js', 'js/run.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
const NS = sandbox.window.COC;
const { Roster: R, Combat: C, RunMod: RM } = NS;

const STEP = 1 / 60;
const RUNS = parseInt(process.argv[2] || '60', 10);

function fight(run, node) {
  const enc = RM.makeEncounter(run.rng, run, node);
  const battle = new C.Battle({
    allies: run.allyEntries(),
    foes: enc.foes,
    relics: run.relicObjects(),
    autoUlt: true,
    seed: (run.seed + run.battlesWon * 977) | 0,
  });
  battle.allOf('ally').forEach((u) => {
    const e = run.owned(u.def.id);
    if (e) u.hp = Math.max(1, Math.round(u.maxHp * e.hpFrac));
  });
  let t = 0;
  while (battle.state !== 'won' && battle.state !== 'lost' && t < 180) {
    battle.update(STEP);
    t += STEP;
  }
  return { battle, enc, seconds: t, stalled: t >= 180 };
}

/** Crude but reasonable: prefer relics, then recruits, then levels, then gold. */
function pickReward(run, choices) {
  const score = (rw) => {
    if (rw.kind === 'relic') return 4;
    if (rw.kind === 'recruit') return run.roster.length < 6 ? 5 : 2;
    if (rw.kind === 'level') return 3;
    return 1;
  };
  return choices.slice().sort((a, b) => score(b) - score(a))[0];
}

const stats = {
  won: 0, lost: 0, stalled: 0,
  deathAct: [0, 0, 0],
  deathNode: {},
  battles: [],
  lengths: [],
  rosterAtEnd: [],
  relicCounts: [],
};
const errors = [];
const critterAppearances = {};

for (let i = 0; i < RUNS; i++) {
  const run = new RM.Run({ seed: 4000 + i * 37 });
  let guard = 0;
  try {
    while (!run.won && !run.dead && guard++ < 400) {
      const avail = run.available();
      if (!avail.length) {
        // end of the act's map — should not happen, the boss row is terminal
        if (!run.advanceAct()) break;
        continue;
      }
      const choice = avail[run.rng.int(0, avail.length - 1)];
      const node = run.enter(choice);

      if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
        run.autoFormation();
        const res = fight(run, node);
        stats.lengths.push(res.seconds);
        if (res.stalled) { stats.stalled++; run.dead = true; break; }
        run.recordAfterBattle(res.battle);
        if (res.battle.state === 'lost') {
          run.dead = true;
          stats.deathAct[Math.min(run.act, 2)]++;
          stats.deathNode[node.type] = (stats.deathNode[node.type] || 0) + 1;
          break;
        }
        run.winBattle();
        run.gold += (node.type === 'boss' ? 200 : node.type === 'elite' ? 120 : 55) + run.goldBonus();
        run.takeReward(pickReward(run, run.rollRewards(node)));
        run.clearNode(node);
        if (node.type === 'boss') {
          if (!run.advanceAct()) { run.won = true; break; }
        }
      } else if (node.type === 'rest') {
        run.restHeal(0.6);
        run.clearNode(node);
      } else if (node.type === 'treasure') {
        run.takeReward(pickReward(run, run.rollRewards(node)));
        run.clearNode(node);
      } else if (node.type === 'shop') {
        run.clearNode(node);
        const items = run.rollShop();
        items.sort((a, b) => a.cost - b.cost).forEach((it) => {
          if (run.gold >= it.cost) {
            run.gold -= it.cost;
            if (it.kind === 'heal') run.restHeal(it.amount);
            else run.takeReward(it);
          }
        });
      }
    }
  } catch (e) {
    errors.push('run ' + i + ': ' + e.message + '\n   ' + (e.stack || '').split('\n')[1]);
    continue;
  }

  if (run.won) stats.won++; else stats.lost++;
  stats.battles.push(run.battlesWon);
  stats.rosterAtEnd.push(run.roster.length);
  stats.relicCounts.push(run.relics.length);
  run.roster.forEach((e) => { critterAppearances[e.id] = (critterAppearances[e.id] || 0) + 1; });
}

const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

console.log('runs simulated:', RUNS);
console.log('  won   %d (%d%%)', stats.won, Math.round((stats.won / RUNS) * 100));
console.log('  lost  %d', stats.lost);
if (stats.stalled) console.log('  STALLED (fight never resolved): %d', stats.stalled);
console.log('deaths by act:', stats.deathAct.map((n, i) => 'act' + (i + 1) + '=' + n).join('  '));
console.log('deaths by node type:', JSON.stringify(stats.deathNode));
console.log('battles per run: avg %s', avg(stats.battles).toFixed(1));
console.log('roster at end:   avg %s critters', avg(stats.rosterAtEnd).toFixed(1));
console.log('relics per run:  avg %s', avg(stats.relicCounts).toFixed(1));
if (stats.lengths.length) {
  const s = stats.lengths.slice().sort((a, b) => a - b);
  console.log('fight length: median %ss  p95 %ss  max %ss',
    s[s.length >> 1].toFixed(1),
    s[Math.floor(s.length * 0.95)].toFixed(1),
    s[s.length - 1].toFixed(1));
}

console.log('\ncritters recruited (share of runs):');
Object.entries(critterAppearances)
  .filter(([id]) => R.get(id) && !R.get(id).enemyOnly)
  .sort((a, b) => b[1] - a[1])
  .forEach(([id, n]) => {
    console.log('  %s %s%%', R.get(id).name.padEnd(9), String(Math.round((n / RUNS) * 100)).padStart(3));
  });

if (errors.length) {
  console.log('\nERRORS (' + errors.length + '):');
  errors.slice(0, 5).forEach((e) => console.log(' -', e));
  process.exitCode = 1;
} else {
  console.log('\nno errors');
}

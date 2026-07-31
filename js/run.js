/* Critter Clash — run.js
 * A run is three acts of a branching map. Every node is a choice, and the team
 * you finish with is the team you built along the way.
 *
 * Health carries between fights, which is what gives Rest nodes and Menders
 * their value; without that, every encounter is independent and nothing you
 * choose between fights matters.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const R = NS.Roster;

  // ---------------------------------------------------------------- relics
  const RELICS = [
    {
      id: 'sunstone', name: 'Sunstone', icon: 'sun',
      text: 'Every critter starts each battle with 35 ultimate energy.',
      onStart: (u) => { u.energy = Math.max(u.energy, 35); },
    },
    {
      id: 'thornband', name: 'Thornband', icon: 'shield',
      text: 'Front row critters gain 25% defence.',
      onStart: (u) => { if (u.row === 0) u.baseDef *= 1.25; },
    },
    {
      id: 'windchime', name: 'Windchime', icon: 'wind',
      text: 'Back row critters attack 15% faster.',
      onStart: (u) => { if (u.row === 1) u.interval *= 0.85; },
    },
    {
      id: 'stonecore', name: 'Stone Core', icon: 'rock',
      text: 'Every critter gains 15% maximum health.',
      onStart: (u) => { u.maxHp = Math.round(u.maxHp * 1.15); u.hp = Math.round(u.hp * 1.15); },
    },
    {
      id: 'tidepearl', name: 'Tide Pearl', icon: 'drop',
      text: 'Healing is 30% stronger.',
      onStart: (u) => { u.bondPct.heal = (u.bondPct.heal || 0) + 30; },
    },
    {
      id: 'fangcharm', name: 'Fang Charm', icon: 'fang',
      text: 'Strikers gain 25% attack.',
      onStart: (u) => { if (u.def.role === 'striker') u.baseAtk *= 1.25; },
    },
    {
      id: 'longbow', name: 'Longbow Sigil', icon: 'bow',
      text: 'Marksmen gain 25% attack.',
      onStart: (u) => { if (u.def.role === 'marksman') u.baseAtk *= 1.25; },
    },
    {
      id: 'aegis', name: 'Aegis Bell', icon: 'shield',
      text: 'Guardians gain 30% maximum health.',
      onStart: (u) => {
        if (u.def.role === 'guardian') {
          u.maxHp = Math.round(u.maxHp * 1.3); u.hp = Math.round(u.hp * 1.3);
        }
      },
    },
    {
      id: 'luckyclover', name: 'Lucky Clover', icon: 'clover',
      text: 'Earn 30 extra gold from every battle.', gold: 30,
    },
    {
      id: 'mossheart', name: 'Moss Heart', icon: 'leaf',
      text: 'The team recovers 20% health after every battle.', postHeal: 0.20,
    },
    {
      id: 'prism', name: 'Prism Shard', icon: 'gem',
      text: 'Element advantage deals 1.8x damage instead of 1.5x.', prism: true,
    },
    {
      id: 'beacon', name: 'Beacon Lamp', icon: 'lamp',
      text: 'The first critter to fall each battle revives at 40% health.', beacon: true,
    },
    {
      id: 'warhorn', name: 'War Horn', icon: 'horn',
      text: 'Every critter gains 10% attack and 10% defence.',
      onStart: (u) => { u.baseAtk *= 1.1; u.baseDef *= 1.1; },
    },
    {
      id: 'dawnfeather', name: 'Dawn Feather', icon: 'feather',
      text: 'Menders gain 30% attack, which also raises their healing.',
      onStart: (u) => { if (u.def.role === 'mender') u.baseAtk *= 1.3; },
    },
  ];
  const RELIC_BY_ID = {};
  RELICS.forEach((r) => { RELIC_BY_ID[r.id] = r; });

  // ---------------------------------------------------------------- acts
  const ACTS = [
    {
      n: 1, name: 'Mumleskoven', region: 'skov',
      sky: ['#2f5a3f', '#1d3b2c'], ground: '#4a7a46', accent: '#a8e06a',
      pool: ['skovtyv', 'skovtyv', 'mosekone'],
      boss: null, rows: 7, baseLevel: 1, levelSpan: 6,
    },
    {
      n: 2, name: 'Det Syngende Træsk', region: 'sump',
      sky: ['#4a5230', '#2a3020'], ground: '#5f6b34', accent: '#c8e07a',
      pool: ['mosekone', 'skovtyv', 'slaggehund'],
      boss: null, rows: 8, baseLevel: 8, levelSpan: 7,
    },
    {
      n: 3, name: 'Emberhulen', region: 'ild',
      sky: ['#5a2a22', '#331512'], ground: '#7a3f2c', accent: '#ff9a4a',
      pool: ['slaggehund', 'mosekone', 'skovtyv'],
      boss: 'gnavrod', rows: 9, baseLevel: 16, levelSpan: 8,
    },
  ];

  // ---------------------------------------------------------------- map
  /* Rows of 1-3 nodes with edges into the next row. Every node is reachable and
   * every node has at least one way onward, so the player can never dead-end. */
  function buildMap(rng, act) {
    const rows = [];
    const n = act.rows;
    for (let r = 0; r < n; r++) {
      let count;
      if (r === 0) count = 1;
      else if (r === n - 1) count = 1;
      else if (r === n - 2) count = 1;              // a rest stop before the boss
      else count = rng.int(2, 3);
      const row = [];
      for (let i = 0; i < count; i++) {
        row.push({ row: r, idx: i, type: 'battle', next: [] });
      }
      rows.push(row);
    }

    // node types
    rows.forEach((row, r) => {
      row.forEach((node) => {
        if (r === 0) { node.type = 'battle'; return; }
        if (r === rows.length - 1) { node.type = 'boss'; return; }
        if (r === rows.length - 2) { node.type = 'rest'; return; }
        const roll = rng();
        if (r >= 2 && roll < 0.16) node.type = 'elite';
        else if (roll < 0.34) node.type = 'shop';
        else if (roll < 0.48) node.type = 'treasure';
        else if (roll < 0.60) node.type = 'rest';
        else node.type = 'battle';
      });
    });
    // guarantee at least one shop and one elite per act
    const mid = rows.slice(1, rows.length - 2).flat();
    if (mid.length && !mid.some((x) => x.type === 'shop')) mid[rng.int(0, mid.length - 1)].type = 'shop';
    if (mid.length > 2 && !mid.some((x) => x.type === 'elite')) {
      const late = mid.filter((x) => x.row >= 2);
      if (late.length) late[rng.int(0, late.length - 1)].type = 'elite';
    }

    // edges
    for (let r = 0; r < rows.length - 1; r++) {
      const cur = rows[r], nxt = rows[r + 1];
      cur.forEach((node, i) => {
        const centre = nxt.length === 1 ? 0
          : Math.round((i / Math.max(1, cur.length - 1)) * (nxt.length - 1));
        const links = new Set([centre]);
        if (nxt.length > 1 && rng.chance(0.55)) {
          links.add(U.clamp(centre + (rng.chance(0.5) ? 1 : -1), 0, nxt.length - 1));
        }
        node.next = Array.from(links);
      });
      // make sure every node in the next row is reachable
      nxt.forEach((_, j) => {
        if (!cur.some((node) => node.next.includes(j))) {
          const from = cur[rng.int(0, cur.length - 1)];
          from.next.push(j);
        }
      });
    }
    return rows;
  }

  // ---------------------------------------------------------------- encounters
  /** Build an enemy formation for a node. */
  function makeEncounter(rng, run, node) {
    const act = ACTS[run.act];
    const depth = node.row / Math.max(1, act.rows - 1);
    const level = Math.round(act.baseLevel + depth * (act.levelSpan || 5) + (node.type === 'elite' ? 2 : 0));

    /* Enemies use the same rules the player does: melee in front where it can
     * reach, ranged behind where it is protected. A randomly arranged enemy
     * team is a much softer fight than the board actually allows. */
    function place(ids) {
      const front = [1, 0, 2], back = [4, 3, 5];
      let fi = 0, bi = 0;
      const out = [];
      ids.forEach((id) => {
        const wantsFront = R.get(id).stats.range === 0;
        let slot = null;
        if (wantsFront && fi < front.length) slot = front[fi++];
        else if (!wantsFront && bi < back.length) slot = back[bi++];
        else if (fi < front.length) slot = front[fi++];
        else if (bi < back.length) slot = back[bi++];
        if (slot != null) out.push({ id, level, slot });
      });
      return out;
    }

    if (node.type === 'boss' && !act.boss) {
      // No designed boss for this act — a heavier elite pack rather than a
      // recoloured stand-in (§9.1).
      const ids = [];
      for (let i = 0; i < 5; i++) ids.push(rng.pick(act.pool));
      return {
        foes: place(ids).map(function (f) { return { id: f.id, level: level + 2, slot: f.slot }; }),
        level: level + 2, boss: false, name: 'Overmagt',
      };
    }

    if (node.type === 'boss') {
      const boss = R.get(act.boss);
      const pool = act.pool.filter((id) => !R.get(id).boss);
      const escorts = [rng.pick(pool), rng.pick(pool), rng.pick(pool)];
      const foes = place(escorts);
      // the boss takes the centre of the front row, displacing an escort
      const taken = foes.find((f) => f.slot === 1);
      if (taken) {
        const free = [0, 2, 3, 4, 5].find((sl) => !foes.some((f) => f.slot === sl));
        if (free != null) taken.slot = free; else foes.splice(foes.indexOf(taken), 1);
      }
      foes.unshift({ id: boss.id, level: level + 2, slot: 1 });
      return { foes, level, boss: true, name: boss.name, title: boss.title };
    }

    const count = node.type === 'elite'
      ? rng.int(4, 5)
      : U.clamp(2 + Math.floor(depth * 3.2), 2, 5);
    const ids = [];
    for (let i = 0; i < count; i++) ids.push(rng.pick(act.pool));
    // keep at least one body up front so the back line is not immediately exposed
    if (!ids.some((id) => R.get(id).stats.range === 0)) {
      const melee = act.pool.filter((x) => R.get(x).stats.range === 0);
      if (melee.length) ids[0] = rng.pick(melee);
    }
    return {
      foes: place(ids), level, boss: false,
      name: node.type === 'elite' ? 'Eliteflok' : 'Vilde kritter',
    };
  }

  // ---------------------------------------------------------------- run
  function Run(opts) {
    opts = opts || {};
    this.seed = opts.seed == null ? (Math.random() * 1e9) | 0 : opts.seed;
    this.rng = U.rng(this.seed);
    this.act = 0;
    this.gold = 80;
    /* One team level for everyone, raised by winning. Enemy levels climb with
     * act depth, so tying player power to victories is what keeps the two
     * curves together — per-critter levelling alone left the team far behind. */
    this.teamLevel = 1;
    this.relics = [];
    this.roster = [];          // {id, level, hpFrac}
    this.formation = [null, null, null, null, null, null];
    this.pos = null;           // {row, idx} — null means "choose from row 0"
    this.visited = [];
    this.won = false;
    this.dead = false;
    this.battlesWon = 0;
    this.startedAt = Date.now();

    (opts.starters || ['rodde', 'askeoje', 'glimt', 'sjatte']).forEach((id) => this.recruit(id));
    this.autoFormation();
    this.map = buildMap(this.rng, ACTS[0]);
  }

  /* A duplicate recruit becomes a permanent +1 bonus instead of a wasted pick. */
  Run.prototype.recruit = function (id) {
    const existing = this.roster.find((r) => r.id === id);
    if (existing) { existing.bonus = (existing.bonus || 0) + 1; return { levelled: true, entry: existing }; }
    const entry = { id, bonus: 0, hpFrac: 1 };
    this.roster.push(entry);
    return { levelled: false, entry };
  };

  /** Effective level = the shared team level plus this critter's own bonus. */
  Run.prototype.levelOf = function (entry) {
    if (!entry) return this.teamLevel;
    return this.teamLevel + (entry.bonus || 0);
  };

  Run.prototype.winBattle = function () { this.battlesWon++; };

  /* The team gains a level for every node it clears, not only for fights.
   * Enemy levels climb with map depth, so pacing power off depth is what keeps
   * the two curves together — a route through shops and camps must not leave
   * you underlevelled for the boss at the end of it. */
  Run.prototype.clearNode = function (node) {
    const big = node && (node.type === 'boss' || node.type === 'elite');
    this.teamLevel += big ? 2 : 1;
  };

  Run.prototype.owned = function (id) { return this.roster.find((r) => r.id === id); };

  /** Sensible default: guardians front and centre, ranged behind. */
  Run.prototype.autoFormation = function () {
    this.formation = [null, null, null, null, null, null];
    const front = [1, 0, 2];
    const back = [4, 3, 5];
    const sorted = this.roster.slice().sort((a, b) => {
      const ra = R.get(a.id).stats.range, rb = R.get(b.id).stats.range;
      return ra - rb;
    });
    let fi = 0, bi = 0, placed = 0;
    sorted.forEach((entry) => {
      if (placed >= Run.MAX_DEPLOY) return;
      const c = R.get(entry.id);
      const wantsFront = c.stats.range === 0;
      let slot = null;
      if (wantsFront && fi < front.length) slot = front[fi++];
      else if (!wantsFront && bi < back.length) slot = back[bi++];
      else if (fi < front.length) slot = front[fi++];
      else if (bi < back.length) slot = back[bi++];
      if (slot != null) { this.formation[slot] = entry.id; placed++; }
    });
  };

  /* §5.1: the player fields up to five critters. The board has six slots, so
   * which five and where is a real choice rather than a filled-in grid. */
  Run.MAX_DEPLOY = 5;
  Run.prototype.deployed = function () {
    return this.formation.filter(Boolean).length;
  };
  Run.prototype.canDeployMore = function () {
    return this.deployed() < Run.MAX_DEPLOY;
  };

  /** Entries for combat, carrying wounds forward from the previous fight. */
  Run.prototype.allyEntries = function () {
    const out = [];
    this.formation.forEach((id, slot) => {
      if (!id) return;
      const e = this.owned(id);
      if (!e) return;
      out.push({ id, level: this.levelOf(e), slot, hpFrac: e.hpFrac });
    });
    return out;
  };

  Run.prototype.currentRow = function () {
    return this.pos == null ? 0 : this.pos.row + 1;
  };

  /** Nodes the player may move to right now. */
  Run.prototype.available = function () {
    if (this.pos == null) return this.map[0].map((n, i) => ({ row: 0, idx: i }));
    const node = this.map[this.pos.row][this.pos.idx];
    if (this.pos.row >= this.map.length - 1) return [];
    return node.next.map((i) => ({ row: this.pos.row + 1, idx: i }));
  };

  Run.prototype.nodeAt = function (p) { return this.map[p.row][p.idx]; };

  Run.prototype.enter = function (p) {
    this.pos = { row: p.row, idx: p.idx };
    const node = this.nodeAt(p);
    node.visited = true;
    return node;
  };

  Run.prototype.relicFlag = function (name) {
    return this.relics.some((id) => RELIC_BY_ID[id] && RELIC_BY_ID[id][name]);
  };
  Run.prototype.relicObjects = function () {
    return this.relics.map((id) => RELIC_BY_ID[id]).filter(Boolean);
  };

  Run.prototype.goldBonus = function () {
    return this.relicObjects().reduce((s, r) => s + (r.gold || 0), 0);
  };

  /** Store the health each critter finished the fight with. */
  Run.prototype.recordAfterBattle = function (battle) {
    battle.allOf('ally').forEach((u) => {
      const e = this.owned(u.def.id);
      if (!e) return;
      e.hpFrac = u.dead ? 0.25 : U.clamp01(u.hp / u.maxHp);
    });
    const heal = this.relicObjects().reduce((s, r) => s + (r.postHeal || 0), 0);
    if (heal) {
      this.roster.forEach((e) => { e.hpFrac = U.clamp01(e.hpFrac + heal); });
    }
  };

  Run.prototype.restHeal = function (pct) {
    this.roster.forEach((e) => { e.hpFrac = U.clamp01(e.hpFrac + pct); });
  };

  Run.prototype.advanceAct = function () {
    this.act++;
    if (this.act >= ACTS.length) { this.won = true; return false; }
    this.map = buildMap(this.rng, ACTS[this.act]);
    this.pos = null;
    this.teamLevel = Math.max(this.teamLevel, ACTS[this.act].baseLevel);
    this.restHeal(0.4);
    return true;
  };

  Run.prototype.act0 = function () { return ACTS[this.act]; };

  // ---------------------------------------------------------------- rewards
  /** Three choices after a win: recruit, level up, or a relic. */
  Run.prototype.rollRewards = function (node) {
    const rng = this.rng;
    const out = [];
    const pool = R.playable.filter((c) => !this.owned(c.id));
    const elite = node.type === 'elite' || node.type === 'boss';

    if (pool.length) {
      const pick = rng.pick(elite ? pool.filter((c) => 'ABS'.includes(c.grade)).concat(pool) : pool);
      out.push({ kind: 'recruit', id: pick.id, title: 'Recruit ' + pick.name, critter: pick });
    }
    if (this.roster.length) {
      const e = rng.pick(this.roster);
      out.push({
        kind: 'level', id: e.id, amount: elite ? 3 : 2,
        title: R.get(e.id).name + ' +' + (elite ? 3 : 2) + ' niveauer',
      });
    }
    const relicPool = RELICS.filter((r) => !this.relics.includes(r.id));
    if (relicPool.length && (elite || rng.chance(0.4))) {
      const r = rng.pick(relicPool);
      out.push({ kind: 'relic', id: r.id, title: r.name, relic: r });
    }
    out.push({ kind: 'gold', amount: (elite ? 120 : 60) + this.goldBonus(), title: 'Guld' });

    return rng.shuffle(out).slice(0, 3);
  };

  Run.prototype.takeReward = function (rw) {
    switch (rw.kind) {
      case 'recruit': this.recruit(rw.id); this.autoFormationIfSpace(rw.id); break;
      case 'level': { const e = this.owned(rw.id); if (e) e.bonus = (e.bonus || 0) + rw.amount; break; }
      case 'relic': if (!this.relics.includes(rw.id)) this.relics.push(rw.id); break;
      case 'gold': this.gold += rw.amount; break;
      default: break;
    }
  };

  Run.prototype.autoFormationIfSpace = function (id) {
    if (this.formation.includes(id)) return;
    if (!this.canDeployMore()) return;
    const empty = this.formation.indexOf(null);
    if (empty >= 0) this.formation[empty] = id;
  };

  // ---------------------------------------------------------------- shop
  Run.prototype.rollShop = function () {
    const rng = this.rng;
    const items = [];
    const pool = R.playable.filter((c) => !this.owned(c.id));
    rng.shuffle(pool).slice(0, 2).forEach((c) => {
      items.push({
        kind: 'recruit', id: c.id, critter: c,
        cost: 90 + 'EDCBAS'.indexOf(c.grade) * 22,
        title: 'Recruit ' + c.name,
      });
    });
    rng.shuffle(this.roster.slice()).slice(0, 2).forEach((e) => {
      items.push({
        kind: 'level', id: e.id, amount: 3, cost: 70,
        title: R.get(e.id).name + ' +3 niveauer',
      });
    });
    const relicPool = RELICS.filter((r) => !this.relics.includes(r.id));
    if (relicPool.length && rng.chance(0.6)) {
      const r = rng.pick(relicPool);
      items.push({ kind: 'relic', id: r.id, relic: r, cost: 190, title: r.name });
    }
    items.push({ kind: 'heal', amount: 0.5, cost: 50, title: 'Feltrationer' });
    return items;
  };

  NS.RunMod = { Run, RELICS, RELIC_BY_ID, ACTS, makeEncounter, buildMap };
})(window.COC);

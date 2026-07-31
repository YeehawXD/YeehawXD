/* Critter Clash — combat.js
 * The battle simulation. No DOM, no rendering, so it can be run headless for
 * balance testing.
 *
 * Board: each side has a 3x2 grid. Row 0 is the front row, row 1 the back.
 *   slot = row * 3 + col
 * Front/back and column are both meaningful: melee units fight down their own
 * column, several abilities hit a whole row or column, and a critter's BOND
 * checks its orthogonal neighbours. That is what makes placement a decision.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const R = NS.Roster;

  const COLS = 3, ROWS = 2, SLOTS = COLS * ROWS;
  const ULT_COST = 100;

  const slotCol = (s) => s % COLS;
  const slotRow = (s) => Math.floor(s / COLS);

  // ---------------------------------------------------------------- unit
  let uid = 1;
  function makeUnit(entry, side, battle) {
    const c = R.get(entry.id);
    const st = R.statsFor(c, entry.level || 1);
    return {
      uid: uid++,
      side,
      def: c,
      level: entry.level || 1,
      slot: entry.slot,
      col: slotCol(entry.slot),
      row: slotRow(entry.slot),
      maxHp: st.hp, hp: st.hp,
      baseAtk: st.atk, baseDef: st.def,
      interval: st.interval,
      ranged: st.range > 0,
      energy: entry.energy || 0,
      atkTimer: 0.35 + Math.random() * 0.4,   // stagger the opening volley
      dead: false,
      shield: 0, shieldLeft: 0,
      statuses: [],       // {kind, until, mag, stacks}
      buffs: [],          // {stat, pct, until}
      bondPct: {},        // resolved once from the formation
      target: null,
      anim: { attack: 0, hurt: 0, heal: 0, walk: 0 },
      revived: false,
      passiveTimer: 0,
      damageDealt: 0,
      healingDone: 0,
      kills: 0,
    };
  }

  // ---------------------------------------------------------------- stats
  function hasStatus(u, kind) {
    for (const s of u.statuses) if (s.kind === kind) return s;
    return null;
  }
  function statusStacks(u, kind) {
    let n = 0;
    for (const s of u.statuses) if (s.kind === kind) n += (s.stacks || 1);
    return n;
  }
  function buffPct(u, stat) {
    let p = u.bondPct[stat] || 0;
    for (const b of u.buffs) if (b.stat === stat) p += b.pct;
    return p;
  }
  function atkOf(u) { return Math.max(1, u.baseAtk * (1 + buffPct(u, 'atk') / 100)); }
  function defOf(u) { return Math.max(0, u.baseDef * (1 + buffPct(u, 'def') / 100)); }
  function healPow(u) { return atkOf(u) * (1 + buffPct(u, 'heal') / 100); }

  /** Diminishing mitigation: defence never reaches immunity. */
  function mitigate(raw, def) { return raw * (1 - def / (def + 70)); }

  function canAct(u) {
    return !u.dead && !hasStatus(u, 'freeze') && !hasStatus(u, 'stun');
  }

  // ---------------------------------------------------------------- battle
  function Battle(opts) {
    opts = opts || {};
    this.seed = opts.seed == null ? (Math.random() * 1e9) | 0 : opts.seed;
    this.rng = U.rng(this.seed);
    this.time = 0;
    this.state = 'intro';     // intro | fighting | won | lost
    this.units = [];
    this.fx = [];
    this.log = [];
    this.autoUlt = opts.autoUlt !== false;
    this.relics = opts.relics || [];
    this.speed = 1;

    (opts.allies || []).forEach((e) => this.units.push(makeUnit(e, 'ally', this)));
    (opts.foes || []).forEach((e) => this.units.push(makeUnit(e, 'foe', this)));

    this.applyBonds();
    this.applyRelics();
  }

  Battle.prototype.side = function (s) {
    return this.units.filter((u) => u.side === s && !u.dead);
  };
  Battle.prototype.allOf = function (s) {
    return this.units.filter((u) => u.side === s);
  };

  /** Orthogonal neighbours within a side's 3x2 grid. */
  Battle.prototype.neighbours = function (u) {
    return this.units.filter((o) => {
      if (o.side !== u.side || o === u || o.dead) return false;
      const dc = Math.abs(o.col - u.col), dr = Math.abs(o.row - u.row);
      return (dc + dr) === 1;
    });
  };

  /** Bonds are resolved once at battle start from the chosen formation. */
  Battle.prototype.applyBonds = function () {
    this.units.forEach((u) => {
      const b = u.def.bond;
      u.bondPct = {};
      if (!b) return;
      const [type, value] = b.need.split(':');
      let n = 0;
      if (type === 'row') {
        n = (value === 'front' ? u.row === 0 : u.row === 1) ? 1 : 0;
      } else {
        n = this.neighbours(u).filter((o) =>
          type === 'element' ? o.def.element === value : o.def.role === value).length;
      }
      if (n > 0) u.bondPct[b.stat] = (u.bondPct[b.stat] || 0) + b.pct * n;
      u.bondActive = n > 0;
      u.bondCount = n;
    });
  };

  Battle.prototype.applyRelics = function () {
    this.relics.forEach((r) => {
      if (!r.onStart) return;
      this.allOf('ally').forEach((u) => r.onStart(u, this));
    });
  };

  // ---------------------------------------------------------------- targeting
  const foeOf = (s) => (s === 'ally' ? 'foe' : 'ally');

  /** Front row shields the back row: a back-row unit is only reachable once
   *  its own column, then the whole front row, is gone. */
  Battle.prototype.pickTarget = function (u) {
    const enemies = this.side(foeOf(u.side));
    if (!enemies.length) return null;

    const taunt = enemies.find((e) => hasStatus(e, 'taunting'));
    if (taunt) return taunt;

    const front = enemies.filter((e) => e.row === 0);
    const pool = front.length ? front : enemies;

    // prefer the same column, then the closest column
    let best = null, bestD = Infinity;
    for (const e of pool) {
      const d = Math.abs(e.col - u.col);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  };

  Battle.prototype.lowestAlly = function (side, excludeFull) {
    const list = this.side(side).filter((u) => !excludeFull || u.hp < u.maxHp);
    if (!list.length) return null;
    return list.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
  };

  Battle.prototype.select = function (u, selector) {
    const mine = this.side(u.side);
    const theirs = this.side(foeOf(u.side));
    switch (selector) {
      case 'self': return [u];
      case 'allAllies': return mine;
      case 'lowestAlly': { const t = this.lowestAlly(u.side); return t ? [t] : []; }
      case 'selfAndAdjacent': return [u].concat(this.neighbours(u));
      case 'allEnemies': return theirs;
      case 'frontEnemies': {
        const f = theirs.filter((e) => e.row === 0);
        return f.length ? f : theirs;
      }
      case 'backEnemies': {
        const b = theirs.filter((e) => e.row === 1);
        return b.length ? b : theirs;
      }
      case 'columnEnemies': {
        const t = this.pickTarget(u);
        if (!t) return [];
        const c = theirs.filter((e) => e.col === t.col);
        return c.length ? c : [t];
      }
      case 'weakestEnemy': {
        if (!theirs.length) return [];
        return [theirs.reduce((a, b) => (a.maxHp <= b.maxHp ? a : b))];
      }
      case 'nearestEnemy': { const t = this.pickTarget(u); return t ? [t] : []; }
      default: return [];
    }
  };

  // ---------------------------------------------------------------- damage
  Battle.prototype.damage = function (src, tgt, raw, opts) {
    opts = opts || {};
    if (tgt.dead) return 0;

    let mult = 1;
    let advantage = 0;
    if (src && !opts.pure) {
      advantage = R.elementMult(src.def.element, tgt.def.element);
      mult *= advantage;
    }
    // Wisp flickers out of the way entirely
    if (tgt.def.id === 'wisp' && this.rng.chance(0.15)) {
      this.fx.push({ type: 'miss', uid: tgt.uid, t: 0, life: 0.7 });
      return 0;
    }

    let def = defOf(tgt);
    if (opts.pierce) def *= 0.5;
    if (tgt.def.id === 'boulder' && tgt.row === 0) mult *= 0.75;   // Bedrock

    let dmg = mitigate(raw * mult, def);

    // shields soak first
    if (tgt.shield > 0) {
      const used = Math.min(tgt.shield, dmg);
      tgt.shield -= used;
      dmg -= used;
      this.fx.push({ type: 'shieldHit', uid: tgt.uid, t: 0, life: 0.35 });
    }

    dmg = Math.max(0, dmg);
    tgt.hp -= dmg;
    tgt.anim.hurt = 0.25;
    if (src) src.damageDealt += dmg;

    // energy from being hit, and from landing a hit
    tgt.energy = Math.min(ULT_COST, tgt.energy + 22 * (dmg / tgt.maxHp) * 4);
    if (src && !opts.noEnergy) {
      src.energy = Math.min(ULT_COST, src.energy + 12 * (advantage > 1 ? 1.5 : 1));
    }

    if (dmg > 0) {
      this.fx.push({
        type: 'dmg', uid: tgt.uid, v: Math.round(dmg), t: 0, life: 0.8,
        crit: advantage > 1, weak: advantage < 1,
      });
    }

    // Voidpaw drains life from everything it touches
    if (src && src.def.id === 'voidpaw') this.heal(src, src, dmg * 0.3);

    if (tgt.hp <= 0) this.kill(tgt, src);
    return dmg;
  };

  Battle.prototype.heal = function (src, tgt, amount) {
    if (tgt.dead || amount <= 0) return 0;
    const before = tgt.hp;
    tgt.hp = Math.min(tgt.maxHp, tgt.hp + amount);
    const done = tgt.hp - before;
    if (done > 0.5) {
      tgt.anim.heal = 0.4;
      this.fx.push({ type: 'heal', uid: tgt.uid, v: Math.round(done), t: 0, life: 0.8 });
      if (src) src.healingDone += done;
    }
    return done;
  };

  Battle.prototype.shieldUnit = function (tgt, amount, duration) {
    tgt.shield = Math.max(tgt.shield, amount);
    tgt.shieldLeft = Math.max(tgt.shieldLeft, duration);
    this.fx.push({ type: 'shieldUp', uid: tgt.uid, t: 0, life: 0.5 });
  };

  Battle.prototype.addStatus = function (tgt, kind, duration, mag, maxStacks) {
    if (tgt.dead) return;
    if (tgt.def.id === 'voidpaw' && (kind === 'stun' || kind === 'freeze')) return;
    const existing = tgt.statuses.filter((s) => s.kind === kind);
    if (maxStacks && existing.length >= maxStacks) {
      existing[0].until = this.time + duration;   // refresh the oldest
      return;
    }
    if (!maxStacks && existing.length) {
      existing[0].until = Math.max(existing[0].until, this.time + duration);
      existing[0].mag = Math.max(existing[0].mag || 0, mag || 0);
      return;
    }
    tgt.statuses.push({ kind, until: this.time + duration, mag: mag || 0 });
  };

  Battle.prototype.kill = function (u, src) {
    if (u.dead) return;
    // Lumen's Afterglow brings one ally back, once each
    const lumen = this.side(u.side).find((a) => a.def.id === 'lumen' && !a.dead);
    if (lumen && !u.revived && u.def.id !== 'lumen') {
      u.revived = true;
      u.hp = u.maxHp * 0.3;
      u.statuses.length = 0;
      this.fx.push({ type: 'revive', uid: u.uid, t: 0, life: 1.0 });
      return;
    }
    u.dead = true;
    u.hp = 0;
    this.fx.push({ type: 'ko', uid: u.uid, t: 0, life: 0.9 });
    if (src) {
      src.kills++;
      if (src.def.id === 'pip') this.heal(src, src, src.maxHp * 0.08);  // Second Sprout
    }
    this.checkEnd();
  };

  Battle.prototype.checkEnd = function () {
    if (this.state !== 'fighting') return;
    if (!this.side('foe').length) { this.state = 'won'; this.endedAt = this.time; }
    else if (!this.side('ally').length) { this.state = 'lost'; this.endedAt = this.time; }
  };

  // ---------------------------------------------------------------- abilities
  Battle.prototype.fireUlt = function (u) {
    if (u.dead || u.energy < ULT_COST || !canAct(u)) return false;
    const ult = u.def.ult;
    u.energy = 0;
    u.anim.attack = 0.001;
    u.ultFlash = 0.9;
    this.fx.push({ type: 'ult', uid: u.uid, name: ult.name, t: 0, life: 1.1, side: u.side });
    this.log.push({ t: this.time, side: u.side, msg: u.def.name + ' — ' + ult.name });

    const targets = this.select(u, ult.target);
    ult.effect.forEach((e) => this.applyEffect(u, targets, e));
    return true;
  };

  Battle.prototype.applyEffect = function (u, targets, e) {
    switch (e.kind) {
      case 'damage':
        targets.forEach((t) => {
          this.damage(u, t, atkOf(u) * e.mult, { pierce: u.def.id === 'coral', noEnergy: true });
          this.fx.push({ type: 'hit', uid: t.uid, t: 0, life: 0.3, element: u.def.element });
        });
        break;
      case 'chain': {
        let mult = e.mult;
        targets.forEach((t, i) => {
          this.damage(u, t, atkOf(u) * mult, { noEnergy: true });
          this.fx.push({ type: 'chain', from: u.uid, uid: t.uid, t: 0, life: 0.35 });
          mult *= (1 - (e.falloff || 0.15));
        });
        break;
      }
      case 'heal':
        targets.forEach((t) => this.heal(u, t, healPow(u) * e.mult));
        break;
      case 'shield':
        targets.forEach((t) => {
          const amt = e.defMult ? defOf(u) * e.defMult * 4 : healPow(u) * e.mult;
          this.shieldUnit(t, amt, e.duration || 8);
        });
        break;
      case 'status':
        targets.forEach((t) => {
          if (e.only === 'front' && t.row !== 0) return;
          if (e.only === 'back' && t.row !== 1) return;
          this.addStatus(t, e.status, e.duration, e.status === 'burn' ? atkOf(u) * 0.12 : 0, 3);
        });
        break;
      case 'taunt':
        this.side(foeOf(u.side)).forEach(() => {});
        this.addStatus(u, 'taunting', e.duration);
        break;
      case 'debuff':
        targets.forEach((t) => t.buffs.push({ stat: e.stat, pct: -e.pct, until: this.time + e.duration }));
        break;
      case 'buff':
        targets.forEach((t) => t.buffs.push({ stat: e.stat, pct: e.pct, until: this.time + e.duration }));
        break;
      case 'cleanse':
        targets.forEach((t) => {
          t.statuses = t.statuses.filter((s) => s.kind !== 'burn' && s.kind !== 'chill' && s.kind !== 'freeze');
          t.buffs = t.buffs.filter((b) => b.pct > 0);
        });
        break;
      case 'energy':
        targets.forEach((t) => { t.energy = Math.min(ULT_COST, t.energy + e.amount); });
        break;
      case 'drain':
        targets.forEach((t) => { t.energy = Math.max(0, t.energy - e.amount); });
        break;
      case 'leap':
        break;   // purely visual; handled by the renderer
      default:
        break;
    }
  };

  // ---------------------------------------------------------------- basic attack
  Battle.prototype.basicAttack = function (u) {
    const role = u.def.role;

    if (role === 'mender') {
      // Menders top up the most wounded ally instead of swinging.
      const t = this.lowestAlly(u.side, true);
      if (t) {
        this.heal(u, t, healPow(u) * 1.0);
        this.fx.push({ type: 'beam', from: u.uid, uid: t.uid, t: 0, life: 0.35, heal: true });
        u.energy = Math.min(ULT_COST, u.energy + 12);
        u.anim.attack = 0.001;
        return;
      }
    }

    const tgt = this.pickTarget(u);
    if (!tgt) return;
    u.target = tgt;
    u.anim.attack = 0.001;

    const raw = atkOf(u);
    const dealt = this.damage(u, tgt, raw, { pierce: u.def.id === 'coral' });

    if (u.ranged) {
      this.fx.push({ type: 'shot', from: u.uid, uid: tgt.uid, t: 0, life: 0.3, element: u.def.element });
    } else {
      this.fx.push({ type: 'hit', uid: tgt.uid, t: 0, life: 0.25, element: u.def.element });
    }

    // ---- passives that trigger on a landed attack
    switch (u.def.id) {
      case 'cinder':
        this.addStatus(tgt, 'burn', 4, raw * 0.12, 3);
        break;
      case 'frost':
        this.addStatus(tgt, 'chill', 3, 20);
        break;
      case 'geode':
        tgt.buffs.push({ stat: 'def', pct: -12, until: this.time + 5 });
        break;
      case 'zephyr':
        tgt.energy = Math.max(0, tgt.energy - 8);
        u.energy = Math.min(ULT_COST, u.energy + 8);
        break;
      case 'pyra': {
        const foes = this.side(foeOf(u.side));
        foes.filter((e) => e !== tgt && Math.abs(e.col - tgt.col) === 1 && e.row === tgt.row)
          .forEach((e) => this.damage(u, e, raw * 0.45, { noEnergy: true }));
        break;
      }
      case 'volt': {
        const foes = this.side(foeOf(u.side)).filter((e) => e !== tgt);
        if (foes.length) {
          const e = foes[this.rng.int(0, foes.length - 1)];
          this.damage(u, e, raw * 0.5, { noEnergy: true });
          this.fx.push({ type: 'chain', from: tgt.uid, uid: e.uid, t: 0, life: 0.3 });
        }
        break;
      }
      default: break;
    }

    // ---- defender reactions
    if (!u.ranged && !tgt.dead) {
      if (tgt.def.id === 'bramble') this.damage(tgt, u, dealt * 0.30, { pure: true, noEnergy: true });
      if (tgt.def.id === 'magma') this.addStatus(u, 'burn', 3, dealt * 0.20, 3);
      if (tgt.def.id === 'quill') this.damage(tgt, u, atkOf(tgt) * 0.6, { noEnergy: true });
    }
  };

  // ---------------------------------------------------------------- update
  Battle.prototype.update = function (dt) {
    if (this.state === 'intro') {
      this.introLeft = (this.introLeft == null ? 1.1 : this.introLeft) - dt;
      if (this.introLeft <= 0) this.state = 'fighting';
      this.tickFx(dt);
      return;
    }
    if (this.state !== 'fighting') { this.tickFx(dt); return; }

    this.time += dt;

    for (const u of this.units) {
      if (u.dead) continue;

      // timed status expiry
      for (let i = u.statuses.length - 1; i >= 0; i--) {
        if (u.statuses[i].until <= this.time) u.statuses.splice(i, 1);
      }
      for (let i = u.buffs.length - 1; i >= 0; i--) {
        if (u.buffs[i].until <= this.time) u.buffs.splice(i, 1);
      }
      if (u.shieldLeft > 0) {
        u.shieldLeft -= dt;
        if (u.shieldLeft <= 0) u.shield = 0;
      }

      // burn ticks
      const burns = u.statuses.filter((s) => s.kind === 'burn');
      if (burns.length) {
        let dps = 0;
        burns.forEach((b) => { dps += b.mag; });
        this.damage(null, u, dps * dt, { pure: true, noEnergy: true });
        if (u.dead) continue;
      }

      // animation decay
      ['hurt', 'heal'].forEach((k) => { if (u.anim[k] > 0) u.anim[k] -= dt; });
      if (u.anim.attack > 0) {
        u.anim.attack += dt / 0.35;
        if (u.anim.attack >= 1) u.anim.attack = 0;
      }
      if (u.ultFlash > 0) u.ultFlash -= dt;

      if (!canAct(u)) continue;

      // ---- per-critter timed passives
      u.passiveTimer -= dt;
      if (u.passiveTimer <= 0) {
        switch (u.def.id) {
          case 'thistle': {
            u.passiveTimer = 3;
            const t = this.lowestAlly(u.side, true);
            if (t) this.heal(u, t, t.maxHp * 0.06);
            break;
          }
          case 'nimbus': {
            u.passiveTimer = 4;
            const t = this.lowestAlly(u.side);
            if (t) this.shieldUnit(t, healPow(u) * 0.6, 6);
            break;
          }
          case 'thornmaw':
            u.passiveTimer = 1;
            this.heal(u, u, u.maxHp * 0.02);
            break;
          case 'cinderhorn':
            u.passiveTimer = 5;
            u.buffs.push({ stat: 'atk', pct: 6, until: this.time + 999 });
            break;
          case 'rockhound': {
            u.passiveTimer = 2;
            const pack = this.side(u.side).filter((o) => o.def.id === 'rockhound' && o !== u).length;
            u.buffs = u.buffs.filter((b) => b.tag !== 'pack');
            if (pack) u.buffs.push({ stat: 'atk', pct: 10 * pack, until: this.time + 2.1, tag: 'pack' });
            break;
          }
          default: u.passiveTimer = 1; break;
        }
      }

      // ---- attack cadence
      const chill = hasStatus(u, 'chill');
      const rate = 1 / (u.interval * (chill ? 1 + chill.mag / 100 : 1));
      u.atkTimer -= dt * rate;
      if (u.atkTimer <= 0) {
        u.atkTimer += 1;
        this.basicAttack(u);
        if (this.state !== 'fighting') break;
      }

      // ---- ultimates
      if (u.energy >= ULT_COST) {
        const auto = u.side === 'foe' ? true : this.autoUlt;
        if (auto) this.fireUlt(u);
      }
    }

    this.tickFx(dt);
    this.checkEnd();
  };

  Battle.prototype.tickFx = function (dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t >= f.life) this.fx.splice(i, 1);
    }
  };

  Battle.prototype.unitById = function (id) {
    return this.units.find((u) => u.uid === id);
  };

  Battle.prototype.readyUnits = function (side) {
    return this.side(side).filter((u) => u.energy >= ULT_COST && canAct(u));
  };

  NS.Combat = {
    Battle, COLS, ROWS, SLOTS, ULT_COST,
    slotCol, slotRow, hasStatus, atkOf, defOf, canAct, mitigate,
  };
})(window.COC);

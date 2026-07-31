/* Clash of Critters — battle.js
 * The simulation. Deterministic given a seed, and completely free of any
 * rendering or DOM code so it can also be run headless for balance testing.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const Cards = NS.Cards;

  // --------------------------------------------------------------- arena
  const ARENA = {
    w: 18, h: 32,
    riverTop: 15.4,
    riverBot: 16.6,
    bridges: [3.4, 14.6],
    bridgeHalf: 1.05,
  };
  NS.ARENA = ARENA;

  const TOWER_STATS = {
    king: { hp: 2600, dmg: 110, hitSpeed: 1.0, range: 7.0, radius: 1.5 },
    princess: { hp: 1512, dmg: 92, hitSpeed: 0.8, range: 7.5, radius: 1.2 },
  };

  const TIMING = {
    countdown: 3.0,
    regular: 180,
    doubleAt: 60,     // seconds remaining when elixir doubles
    overtime: 120,
    elixirBase: 2.8,  // seconds per elixir
    elixirMax: 10,
  };
  NS.TIMING = TIMING;

  function towerLayout(team) {
    const flip = team === 'player';
    const y = (v) => (flip ? ARENA.h - v : v);
    return [
      { kind: 'king', x: 9, y: y(2.6) },
      { kind: 'princess', x: 3.4, y: y(6.2), side: 'left' },
      { kind: 'princess', x: 14.6, y: y(6.2), side: 'right' },
    ];
  }

  // --------------------------------------------------------------- entity
  let nextId = 1;

  function makeEntity(o) {
    return Object.assign({
      id: nextId++,
      team: 'player',
      etype: 'unit',        // 'unit' | 'building' | 'tower'
      card: null,
      x: 0, y: 0,
      vx: 0, vy: 0,
      hp: 1, maxHp: 1,
      radius: 0.35,
      mass: 1,
      flying: false,
      targets: 'ground',
      target: null,
      retargetIn: 0,
      atkCd: 0,
      windup: 0,
      attackAnim: 0,
      walkPhase: 0,
      facing: 1,
      dead: false,
      deployLeft: 0,
      spawnGrace: 0,
      lifetime: 0,
      frozenUntil: 0,
      stunUntil: 0,
      poison: null,
      hurtFlash: 0,
      crossed: false,
      hopT: 0,
      spawnTimer: 0,
      damageDealt: 0,
    }, o);
  }

  // --------------------------------------------------------------- side
  function makeSide(team, deck, rng) {
    const order = rng.shuffle(deck.slice());
    return {
      team,
      deck: deck.slice(),
      hand: order.slice(0, 4),
      queue: order.slice(4),
      elixir: 5,
      elixirRate: 1 / TIMING.elixirBase,
      crowns: 0,
      towers: [],
      elixirSpent: 0,
      cardsPlayed: 0,
      lastPlayed: null,
    };
  }

  // --------------------------------------------------------------- battle
  function Battle(opts) {
    opts = opts || {};
    this.seed = opts.seed == null ? (Math.random() * 1e9) | 0 : opts.seed;
    this.rng = U.rng(this.seed);
    this.time = 0;
    this.clock = TIMING.regular;      // counts down
    this.phase = 'countdown';         // countdown | regular | overtime | ended
    this.countdown = TIMING.countdown;
    this.result = null;               // {winner, reason, crowns}
    this.entities = [];
    this.projectiles = [];
    this.pending = [];                // units still materialising
    this.auras = [];
    this.fx = [];
    this.log = [];
    this.elixirMult = 1;
    this.sudden = false;
    this.practice = !!opts.practice;
    this.infiniteElixir = !!opts.infiniteElixir;

    const playerDeck = opts.playerDeck || Cards.STARTER_DECK;
    const enemyDeck = opts.enemyDeck || Cards.AI_DECKS[0].cards;
    this.sides = {
      player: makeSide('player', playerDeck, this.rng),
      enemy: makeSide('enemy', enemyDeck, this.rng),
    };

    ['player', 'enemy'].forEach((team) => {
      towerLayout(team).forEach((t) => {
        const st = TOWER_STATS[t.kind];
        const e = makeEntity({
          etype: 'tower',
          towerKind: t.kind,
          side: t.side,
          team,
          x: t.x, y: t.y,
          hp: st.hp, maxHp: st.hp,
          radius: st.radius,
          dmg: st.dmg, hitSpeed: st.hitSpeed, range: st.range,
          targets: 'both',
          mass: 99,
          activated: t.kind !== 'king',
          projectile: { speed: 14, kind: 'arrow' },
        });
        this.entities.push(e);
        this.sides[team].towers.push(e);
      });
    });
  }

  Battle.prototype.towersOf = function (team) {
    return this.sides[team].towers.filter((t) => !t.dead);
  };
  Battle.prototype.king = function (team) {
    return this.sides[team].towers.find((t) => t.towerKind === 'king');
  };
  Battle.prototype.princesses = function (team) {
    return this.sides[team].towers.filter((t) => t.towerKind === 'princess');
  };

  // --------------------------------------------------------------- geometry
  function onBridge(x) {
    for (const b of ARENA.bridges) if (Math.abs(x - b) <= ARENA.bridgeHalf) return true;
    return false;
  }
  function inRiver(y) { return y > ARENA.riverTop && y < ARENA.riverBot; }
  NS.onBridge = onBridge;
  NS.inRiver = inRiver;

  function riverSide(y) { return y < ARENA.riverTop ? -1 : y > ARENA.riverBot ? 1 : 0; }

  // --------------------------------------------------------------- deploy
  Battle.prototype.canDeploy = function (team, cardId, x, y) {
    const c = Cards.get(cardId);
    if (!c) return { ok: false, why: 'unknown card' };
    const side = this.sides[team];
    if (!this.infiniteElixir && side.elixir < c.cost) return { ok: false, why: 'not enough elixir' };
    if (x < 0.4 || x > ARENA.w - 0.4 || y < 0.4 || y > ARENA.h - 0.4) {
      return { ok: false, why: 'outside arena' };
    }
    if (c.kind === 'spell' || c.deployAnywhere) return { ok: true };

    const zone = this.deployZone(team);
    if (team === 'player') {
      if (y < zone.minY) return { ok: false, why: 'enemy territory' };
      if (y < zone.halfY && !(zone.leftOpen && x < 9) && !(zone.rightOpen && x >= 9)) {
        return { ok: false, why: 'enemy territory' };
      }
    } else {
      if (y > zone.maxY) return { ok: false, why: 'enemy territory' };
      if (y > zone.halfY && !(zone.leftOpen && x < 9) && !(zone.rightOpen && x >= 9)) {
        return { ok: false, why: 'enemy territory' };
      }
    }
    if (inRiver(y) && !onBridge(x)) return { ok: false, why: 'in the river' };
    // never inside a tower footprint
    for (const t of this.entities) {
      if (t.etype === 'tower' && !t.dead && U.dist(x, y, t.x, t.y) < t.radius + 0.5) {
        return { ok: false, why: 'too close to a tower' };
      }
    }
    return { ok: true };
  };

  /** The rectangle a team may deploy in, widened when enemy princesses fall. */
  Battle.prototype.deployZone = function (team) {
    const foe = team === 'player' ? 'enemy' : 'player';
    const dead = {};
    this.sides[foe].towers.forEach((t) => {
      if (t.towerKind === 'princess' && t.dead) dead[t.side] = true;
    });
    if (team === 'player') {
      return {
        minY: dead.left || dead.right ? 7.4 : ARENA.riverBot + 0.1,
        halfY: ARENA.riverBot + 0.1,
        leftOpen: !!dead.left, rightOpen: !!dead.right,
      };
    }
    return {
      maxY: dead.left || dead.right ? ARENA.h - 7.4 : ARENA.riverTop - 0.1,
      halfY: ARENA.riverTop - 0.1,
      leftOpen: !!dead.left, rightOpen: !!dead.right,
    };
  };

  Battle.prototype.play = function (team, handIndex, x, y) {
    if (this.phase === 'ended' || this.phase === 'countdown') return { ok: false, why: 'not running' };
    const side = this.sides[team];
    const cardId = side.hand[handIndex];
    if (!cardId) return { ok: false, why: 'empty slot' };
    const chk = this.canDeploy(team, cardId, x, y);
    if (!chk.ok) return chk;

    const c = Cards.get(cardId);
    if (!this.infiniteElixir) side.elixir -= c.cost;
    side.elixirSpent += c.cost;
    side.cardsPlayed++;
    side.lastPlayed = { id: cardId, x, y, t: this.time };

    // cycle: played card to the back, next card into the slot
    side.queue.push(cardId);
    side.hand[handIndex] = side.queue.shift();

    this.deployCard(team, cardId, x, y);
    return { ok: true, card: c };
  };

  const FORMATIONS = {
    line: [[-0.55, 0], [0.55, 0], [-1.1, 0], [1.1, 0]],
    box: [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]],
    wedge: [[0, -0.5], [-0.55, 0.35], [0.55, 0.35], [0, 0.9]],
  };

  Battle.prototype.deployCard = function (team, cardId, x, y) {
    const c = Cards.get(cardId);
    if (c.kind === 'spell') {
      this.castSpell(team, c, x, y);
      this.fx.push({ type: 'cast', x, y, t: 0, life: 0.4, team });
      return;
    }
    const n = c.count || 1;
    const form = FORMATIONS[c.formation] || FORMATIONS.wedge;
    const dir = team === 'player' ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? [0, 0] : form[i % form.length];
      this.pending.push({
        team, card: c,
        x: U.clamp(x + off[0], 0.4, ARENA.w - 0.4),
        y: U.clamp(y + off[1] * dir, 0.4, ARENA.h - 0.4),
        left: c.deployTime,
        total: c.deployTime,
      });
    }
    this.fx.push({ type: 'deployRing', x, y, t: 0, life: c.deployTime, team, r: c.kind === 'building' ? 1.0 : 0.9 });
  };

  Battle.prototype.spawnUnit = function (team, c, x, y, opts) {
    opts = opts || {};
    const isBuilding = c.kind === 'building';
    const e = makeEntity({
      etype: isBuilding ? 'building' : 'unit',
      team, card: c,
      x, y,
      hp: c.hp, maxHp: c.hp,
      radius: c.radius,
      mass: c.mass || 1,
      flying: !!c.air,
      targets: c.targets || 'ground',
      dmg: c.dmg || 0,
      hitSpeed: c.hitSpeed || 1,
      range: c.range || 0.4,
      speed: c.speed || 0,
      splash: c.splash || 0,
      projectile: c.projectile || null,
      lifetime: c.lifetime || 0,
      spawnTimer: c.spawner ? c.spawner.first : 0,
      facing: team === 'player' ? -1 : 1,
      spawnGrace: 0.15,
    });
    if (opts.hp) { e.hp = opts.hp; e.maxHp = opts.hp; }
    e.sight = Math.max((c.range || 0.4) + 1.4, isBuilding ? (c.range || 5) : 5.5);
    e.crossed = riverSide(y) === (team === 'player' ? -1 : 1);
    this.entities.push(e);
    this.fx.push({ type: 'poof', x, y, t: 0, life: 0.35, team });
    return e;
  };

  // --------------------------------------------------------------- spells
  Battle.prototype.castSpell = function (team, c, x, y) {
    const s = c.spell;
    this.fx.push({
      type: 'spell', visual: s.visual, x, y, r: s.radius,
      t: 0, life: (s.delay || 0.3) + 0.9, delay: s.delay || 0.3, team,
    });
    const self = this;
    const apply = function () {
      NS.Audio && NS.Audio.play(s.sfx || 'explode');
      if (s.effect === 'heal') {
        self.auras.push({
          team, x, y, r: s.radius, healTotal: s.heal,
          duration: s.duration, left: s.duration, kind: 'heal',
        });
        return;
      }
      if (s.effect === 'lightning') {
        const targets = self.entities
          .filter((e) => !e.dead && e.team !== team && e.deployLeft <= 0 &&
            U.dist(e.x, e.y, x, y) <= s.radius + e.radius * 0.5)
          .sort((a, b) => b.hp - a.hp)
          .slice(0, s.bolts || 3);
        targets.forEach((e, i) => {
          self.fx.push({ type: 'bolt', x: e.x, y: e.y, t: 0, life: 0.35, delay: i * 0.05 });
          self.damage(e, s.dmg * (e.etype === 'tower' ? s.towerMult : 1), team, 'spell');
          e.stunUntil = Math.max(e.stunUntil, self.time + (s.duration || 0.5));
        });
        return;
      }
      const hit = self.entities.filter((e) => {
        if (e.dead || e.team === team) return false;
        if (e.deployLeft > 0) return false;
        if (e.flying && s.targets === 'ground') return false;
        if (!e.flying && s.targets === 'air') return false;
        return U.dist(e.x, e.y, x, y) <= s.radius + e.radius * 0.6;
      });
      hit.forEach((e) => {
        if (s.dmg) self.damage(e, s.dmg * (e.etype === 'tower' ? s.towerMult : 1), team, 'spell');
        if (s.effect === 'freeze') e.frozenUntil = Math.max(e.frozenUntil, self.time + s.duration);
        if (s.effect === 'stun') {
          e.stunUntil = Math.max(e.stunUntil, self.time + s.duration);
          e.atkCd = Math.max(e.atkCd, e.hitSpeed || 0);
        }
        if (s.knockback && e.etype === 'unit') {
          const a = U.angle(x, y, e.x, e.y);
          const k = s.knockback / (e.mass || 1);
          e.x = U.clamp(e.x + Math.cos(a) * k, 0.4, ARENA.w - 0.4);
          e.y = U.clamp(e.y + Math.sin(a) * k, 0.4, ARENA.h - 0.4);
        }
      });
    };
    this._schedule((s.delay || 0.3), apply);
  };

  Battle.prototype._schedule = function (delay, fn) {
    if (!this._timers) this._timers = [];
    this._timers.push({ left: delay, fn });
  };

  // --------------------------------------------------------------- targeting
  function canTarget(att, e) {
    if (e.dead || e.team === att.team) return false;
    if (e.deployLeft > 0) return false;
    if (att.targets === 'buildings') return e.etype === 'building' || e.etype === 'tower';
    if (e.flying) return att.targets === 'air' || att.targets === 'both';
    return att.targets === 'ground' || att.targets === 'both';
  }

  Battle.prototype.acquire = function (e) {
    let best = null, bestD = Infinity;
    const sight = e.etype === 'tower' ? e.range : e.sight;
    for (const o of this.entities) {
      if (!canTarget(e, o)) continue;
      // towers and buildings only engage inside their firing range
      const d = U.dist(e.x, e.y, o.x, o.y) - o.radius;
      if (e.etype === 'tower' || e.etype === 'building') {
        if (d > e.range + e.radius) continue;
      } else if (d > sight) {
        continue;
      }
      // Prefer troops over buildings at similar distance so units do not
      // stand still shooting a tower while being eaten from behind.
      const bias = (o.etype === 'tower' ? 1.2 : 0);
      const score = d + bias;
      if (score < bestD) { bestD = score; best = o; }
    }
    return best;
  };

  /** Where a unit walks when it has nothing to fight: the nearest enemy tower. */
  Battle.prototype.objective = function (e) {
    const foe = e.team === 'player' ? 'enemy' : 'player';
    const princesses = this.sides[foe].towers.filter((t) => t.towerKind === 'princess' && !t.dead);
    let best = null, bestD = Infinity;
    const pool = princesses.length ? princesses : this.sides[foe].towers.filter((t) => !t.dead);
    for (const t of pool) {
      // Weight by lane so a unit keeps to the side it was dropped on.
      const d = Math.abs(e.x - t.x) * 1.6 + Math.abs(e.y - t.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  };

  // --------------------------------------------------------------- pathing
  Battle.prototype.navPoint = function (e, tx, ty) {
    if (e.flying) return { x: tx, y: ty };
    const mySide = riverSide(e.y);
    const tSide = riverSide(ty);
    if (mySide === 0 || tSide === 0 || mySide === tSide) return { x: tx, y: ty };
    if (e.card && e.card.jumpsRiver) return { x: tx, y: ty };

    // choose the bridge that makes the total trip shortest
    let bx = ARENA.bridges[0], bd = Infinity;
    for (const b of ARENA.bridges) {
      const d = U.dist(e.x, e.y, b, 16) + U.dist(b, 16, tx, ty);
      if (d < bd) { bd = d; bx = b; }
    }
    const nearY = mySide < 0 ? ARENA.riverTop - 0.7 : ARENA.riverBot + 0.7;
    const farY = mySide < 0 ? ARENA.riverBot + 0.7 : ARENA.riverTop - 0.7;
    if (Math.abs(e.x - bx) > 0.45 && Math.abs(e.y - nearY) > 0.15 && riverSide(e.y) === mySide) {
      return { x: bx, y: nearY };
    }
    return { x: bx, y: farY };
  };

  // --------------------------------------------------------------- damage
  Battle.prototype.damage = function (e, amount, byTeam, kind) {
    if (e.dead || amount <= 0) return;
    e.hp -= amount;
    e.hurtFlash = 0.16;
    if (e.etype === 'tower') {
      NS.Audio && NS.Audio.play('towerHit');
      // A king tower wakes up the moment it is touched.
      if (e.towerKind === 'king' && !e.activated) {
        e.activated = true;
        this.log.push({ t: this.time, msg: 'King tower activated!', team: e.team });
      }
    }
    this.fx.push({ type: 'dmg', x: e.x, y: e.y - e.radius, v: Math.round(amount), t: 0, life: 0.8 });
    if (e.hp <= 0) {
      e.hp = 0;
      this.kill(e, byTeam);
    }
  };

  Battle.prototype.kill = function (e, byTeam) {
    if (e.dead) return;
    e.dead = true;
    const c = e.card;
    if (e.etype === 'tower') {
      NS.Audio && NS.Audio.play('towerDown');
      this.fx.push({ type: 'towerBoom', x: e.x, y: e.y, t: 0, life: 1.2, team: e.team });
      const foe = e.team === 'player' ? 'enemy' : 'player';
      if (e.towerKind === 'king') {
        this.sides[foe].crowns = 3;
        this.finish(foe, 'king tower destroyed');
      } else {
        this.sides[foe].crowns++;
        const king = this.king(e.team);
        if (king && !king.activated) king.activated = true;
        this.log.push({ t: this.time, msg: 'Tower destroyed', team: e.team });
        NS.Audio && NS.Audio.play('crown');
      }
      return;
    }
    NS.Audio && NS.Audio.play('unitDie');
    this.fx.push({
      type: 'die', x: e.x, y: e.y, t: 0, life: 0.5,
      team: e.team, spec: c && c.art, flying: e.flying, scale: (c && c.art && c.art.scale) || 1,
    });
    if (c && c.death) {
      const d = c.death;
      if (d.dmg) {
        this.fx.push({ type: 'boom', x: e.x, y: e.y, r: d.radius, t: 0, life: 0.5 });
        NS.Audio && NS.Audio.play('explode');
        for (const o of this.entities) {
          if (o.dead || o.team === e.team || o.deployLeft > 0) continue;
          if (o.flying) continue;
          if (U.dist(o.x, o.y, e.x, e.y) <= d.radius + o.radius * 0.5) {
            this.damage(o, d.dmg * (o.etype === 'tower' ? 1 : 1), e.team, 'death');
          }
        }
      }
      if (d.spawn) {
        const sc = Cards.get(d.spawn.unit);
        for (let i = 0; i < d.spawn.count; i++) {
          const a = (i / d.spawn.count) * U.TAU;
          this.spawnUnit(e.team, sc, U.clamp(e.x + Math.cos(a) * 0.6, 0.4, ARENA.w - 0.4),
            U.clamp(e.y + Math.sin(a) * 0.6, 0.4, ARENA.h - 0.4));
        }
      }
    }
  };

  // --------------------------------------------------------------- attacking
  Battle.prototype.attack = function (e, target) {
    e.atkCd = e.hitSpeed;
    e.attackAnim = 0.001;
    const dmg = e.dmg;
    if (e.projectile) {
      const p = e.projectile;
      this.projectiles.push({
        x: e.x, y: e.y - (e.flying ? 0.5 : 0.45),
        target, tx: target.x, ty: target.y,
        speed: p.speed, kind: p.kind, arc: !!p.arc,
        dmg, splash: e.splash, team: e.team,
        poison: e.card && e.card.poison,
        life: 3, t: 0,
        z: 0,
      });
      NS.Audio && NS.Audio.play(p.kind === 'arrow' || p.kind === 'dart' ? 'shootArrow' : 'shootMagic');
    } else {
      this._schedule(Math.min(0.15, e.hitSpeed * 0.25), () => {
        if (target.dead) return;
        this.hit(target, dmg, e);
      });
      NS.Audio && NS.Audio.play('hitMelee');
    }
  };

  Battle.prototype.hit = function (target, dmg, source) {
    if (source && source.splash) {
      this.fx.push({ type: 'boom', x: target.x, y: target.y, r: source.splash, t: 0, life: 0.32 });
      for (const o of this.entities) {
        if (o.dead || o.team === source.team || o.deployLeft > 0) continue;
        if (!canTarget(source, o) && o !== target) continue;
        if (U.dist(o.x, o.y, target.x, target.y) <= source.splash + o.radius * 0.5) {
          this.damage(o, dmg, source.team, 'splash');
          if (source) source.damageDealt += dmg;
        }
      }
    } else {
      this.damage(target, dmg, source ? source.team : null, 'hit');
      if (source) source.damageDealt += dmg;
    }
  };

  // --------------------------------------------------------------- update
  Battle.prototype.update = function (dt) {
    if (this.phase === 'ended') { this.tickFx(dt); return; }

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'regular';
        NS.Audio && NS.Audio.play('go');
      }
      this.tickFx(dt);
      return;
    }

    this.time += dt;
    this.clock -= dt;

    // ---- phase transitions
    if (this.phase === 'regular') {
      if (this.clock <= TIMING.doubleAt && this.elixirMult < 2) {
        this.elixirMult = 2;
        this.log.push({ t: this.time, msg: 'Double elixir!' });
        NS.Audio && NS.Audio.play('doubleElixir');
      }
      if (this.clock <= 0) {
        const pc = this.sides.player.crowns, ec = this.sides.enemy.crowns;
        if (pc > ec) this.finish('player', 'more crowns');
        else if (ec > pc) this.finish('enemy', 'more crowns');
        else {
          this.phase = 'overtime';
          this.sudden = true;
          this.clock = TIMING.overtime;
          this.elixirMult = 3;
          this.log.push({ t: this.time, msg: 'Overtime — sudden death!' });
          NS.Audio && NS.Audio.play('doubleElixir');
        }
      }
    } else if (this.phase === 'overtime') {
      if (this.clock <= 0) {
        const p = this.lowestTowerFrac('player');
        const e = this.lowestTowerFrac('enemy');
        if (Math.abs(p - e) < 0.005) this.finish(null, 'draw');
        else this.finish(p > e ? 'player' : 'enemy', 'lowest tower');
      }
    }
    if (this.phase === 'ended') { this.tickFx(dt); return; }

    // ---- elixir
    ['player', 'enemy'].forEach((team) => {
      const s = this.sides[team];
      const before = s.elixir;
      s.elixir = Math.min(TIMING.elixirMax, s.elixir + dt * this.elixirMult / TIMING.elixirBase);
      if (before < TIMING.elixirMax && s.elixir >= TIMING.elixirMax && team === 'player') {
        NS.Audio && NS.Audio.play('elixirFull');
      }
    });

    // ---- scheduled callbacks (melee windups, spell delays)
    if (this._timers) {
      for (let i = this._timers.length - 1; i >= 0; i--) {
        const tm = this._timers[i];
        tm.left -= dt;
        if (tm.left <= 0) { this._timers.splice(i, 1); tm.fn(); }
      }
    }

    // ---- pending deployments
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.left -= dt;
      if (p.left <= 0) {
        this.pending.splice(i, 1);
        this.spawnUnit(p.team, p.card, p.x, p.y);
        NS.Audio && NS.Audio.play('spawn');
      }
    }

    // ---- auras (heal)
    for (let i = this.auras.length - 1; i >= 0; i--) {
      const a = this.auras[i];
      a.left -= dt;
      const rate = a.healTotal / a.duration;
      for (const e of this.entities) {
        if (e.dead || e.team !== a.team || e.etype === 'tower') continue;
        if (U.dist(e.x, e.y, a.x, a.y) <= a.r) {
          e.hp = Math.min(e.maxHp, e.hp + rate * dt);
          e.healFlash = 0.2;
        }
      }
      if (a.left <= 0) this.auras.splice(i, 1);
    }

    // ---- entities
    const ents = this.entities;
    for (let i = 0; i < ents.length; i++) {
      this.updateEntity(ents[i], dt);
    }
    this.separate(dt);

    // ---- projectiles
    this.updateProjectiles(dt);

    // ---- cleanup
    for (let i = ents.length - 1; i >= 0; i--) {
      if (ents[i].dead) ents.splice(i, 1);
    }
    for (const team of ['player', 'enemy']) {
      const s = this.sides[team];
      s.towers = s.towers.filter(Boolean);
    }

    this.tickFx(dt);
  };

  Battle.prototype.lowestTowerFrac = function (team) {
    let lo = 1;
    this.sides[team].towers.forEach((t) => {
      if (t.dead) lo = 0;
      else lo = Math.min(lo, t.hp / t.maxHp);
    });
    return lo;
  };

  Battle.prototype.updateEntity = function (e, dt) {
    if (e.dead) return;
    if (e.hurtFlash > 0) e.hurtFlash -= dt;
    if (e.healFlash > 0) e.healFlash -= dt;
    if (e.attackAnim > 0) {
      e.attackAnim += dt / 0.32;
      if (e.attackAnim >= 1) e.attackAnim = 0;
    }
    if (e.spawnGrace > 0) e.spawnGrace -= dt;

    // poison / DoT
    if (e.poison) {
      e.poison.left -= dt;
      this.damageSilent(e, e.poison.dps * dt, e.poison.team);
      if (e.poison.left <= 0) e.poison = null;
      if (e.dead) return;
    }

    // building lifetime
    if (e.lifetime > 0) {
      e.lifetime -= dt;
      if (e.lifetime <= 0) { this.kill(e, null); return; }
    }

    const frozen = this.time < e.frozenUntil;
    const stunned = this.time < e.stunUntil;
    if (frozen || stunned) {
      e.attackAnim = 0;
      return;
    }

    // spawner buildings
    if (e.card && e.card.spawner) {
      e.spawnTimer -= dt;
      if (e.spawnTimer <= 0) {
        const sp = e.card.spawner;
        e.spawnTimer = sp.every;
        const sc = Cards.get(sp.unit);
        for (let i = 0; i < sp.count; i++) {
          const a = (i / sp.count) * U.TAU + this.rng() * 0.5;
          this.spawnUnit(e.team, sc,
            U.clamp(e.x + Math.cos(a) * 0.8, 0.4, ARENA.w - 0.4),
            U.clamp(e.y + Math.sin(a) * 0.8, 0.4, ARENA.h - 0.4));
        }
      }
    }

    if (e.atkCd > 0) e.atkCd -= dt;

    // ---- retarget
    e.retargetIn -= dt;
    if (!e.target || e.target.dead || e.retargetIn <= 0) {
      const cur = e.target;
      const next = this.acquire(e);
      // hysteresis: only swap if the new target is meaningfully closer
      if (!cur || cur.dead) e.target = next;
      else if (next && next !== cur) {
        const dc = U.dist(e.x, e.y, cur.x, cur.y);
        const dn = U.dist(e.x, e.y, next.x, next.y);
        if (dn < dc - 1.2) e.target = next;
      }
      e.retargetIn = 0.35;
    }
    // drop targets that walked out of sight (troops only)
    if (e.target && e.etype === 'unit') {
      if (U.dist(e.x, e.y, e.target.x, e.target.y) - e.target.radius > e.sight + 1.5) e.target = null;
    }
    if (e.target && (e.etype === 'tower' || e.etype === 'building')) {
      if (U.dist(e.x, e.y, e.target.x, e.target.y) - e.target.radius > e.range + e.radius + 0.3) e.target = null;
    }

    // towers that are not activated never shoot
    if (e.etype === 'tower' && !e.activated) { e.target = null; return; }

    let goal = e.target;
    if (!goal && e.etype === 'unit') {
      goal = this.objective(e);
      e.marching = true;
    } else {
      e.marching = false;
    }
    if (!goal) return;

    const reach = e.range + e.radius + goal.radius;
    const d = U.dist(e.x, e.y, goal.x, goal.y);

    if (d <= reach + 0.02) {
      // in range — attack
      e.facing = goal.x < e.x ? -1 : 1;
      if (e.atkCd <= 0 && e.dmg > 0) this.attack(e, goal);
      e.moving = false;
      return;
    }

    if (e.etype !== 'unit' || !e.speed) { e.moving = false; return; }

    // ---- move
    const nav = this.navPoint(e, goal.x, goal.y);
    const a = U.angle(e.x, e.y, nav.x, nav.y);
    let sp = e.speed;
    // charging units get a small burst once they have crossed
    const step = sp * dt;
    let nx = e.x + Math.cos(a) * step;
    let ny = e.y + Math.sin(a) * step;

    // block ground units from swimming
    if (!e.flying && !(e.card && e.card.jumpsRiver)) {
      if (inRiver(ny) && !onBridge(nx)) {
        // slide along the bank toward the nearest bridge
        let bx = ARENA.bridges[0];
        if (Math.abs(nx - ARENA.bridges[1]) < Math.abs(nx - ARENA.bridges[0])) bx = ARENA.bridges[1];
        nx = e.x + Math.sign(bx - e.x) * step;
        ny = e.y;
      }
    } else if (!e.flying && e.card && e.card.jumpsRiver) {
      if (inRiver(ny) && !onBridge(nx)) e.hopT = Math.min(1, e.hopT + dt * 1.6);
      else e.hopT = Math.max(0, e.hopT - dt * 3);
    }

    // avoid walking through towers
    if (!e.flying) {
      for (const t of this.entities) {
        if (t.etype !== 'tower' || t.dead || t === goal) continue;
        const dd = U.dist(nx, ny, t.x, t.y);
        const min = t.radius + e.radius * 0.8;
        if (dd < min) {
          const aa = U.angle(t.x, t.y, nx, ny);
          nx = t.x + Math.cos(aa) * min;
          ny = t.y + Math.sin(aa) * min;
        }
      }
    }

    e.x = U.clamp(nx, 0.3, ARENA.w - 0.3);
    e.y = U.clamp(ny, 0.3, ARENA.h - 0.3);
    e.facing = Math.cos(a) < 0 ? -1 : 1;
    e.walkPhase += dt * (6 + sp * 3);
    e.moving = true;
  };

  /** Damage with no floating number / hit sound, used for damage-over-time. */
  Battle.prototype.damageSilent = function (e, amount, byTeam) {
    if (e.dead || amount <= 0) return;
    e.hp -= amount;
    if (e.hp <= 0) { e.hp = 0; this.kill(e, byTeam); }
  };

  /** Soft body collision so units spread out instead of stacking. */
  Battle.prototype.separate = function (dt) {
    const ents = this.entities;
    for (let i = 0; i < ents.length; i++) {
      const a = ents[i];
      if (a.dead || a.etype !== 'unit') continue;
      for (let j = i + 1; j < ents.length; j++) {
        const b = ents[j];
        if (b.dead || b.etype !== 'unit') continue;
        if (a.flying !== b.flying) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        const ma = b.mass / (a.mass + b.mass);
        const mb = a.mass / (a.mass + b.mass);
        a.x -= ux * push * ma * 2; a.y -= uy * push * ma * 2;
        b.x += ux * push * mb * 2; b.y += uy * push * mb * 2;
      }
      // keep ground units out of the water after being pushed
      if (!a.flying && inRiver(a.y) && !onBridge(a.x)) {
        a.y = a.y < 16 ? ARENA.riverTop - 0.05 : ARENA.riverBot + 0.05;
      }
      a.x = U.clamp(a.x, 0.3, ARENA.w - 0.3);
      a.y = U.clamp(a.y, 0.3, ARENA.h - 0.3);
    }
  };

  Battle.prototype.updateProjectiles = function (dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      p.life -= dt;
      if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y - (p.target.flying ? 0.5 : 0.3); }
      const d = U.dist(p.x, p.y, p.tx, p.ty);
      const step = p.speed * dt;
      if (d <= step || p.life <= 0) {
        // resolve
        if (p.target && !p.target.dead) {
          const src = { team: p.team, splash: p.splash, targets: 'both' };
          if (p.splash) {
            this.fx.push({ type: 'boom', x: p.tx, y: p.ty, r: p.splash, t: 0, life: 0.3 });
            for (const o of this.entities) {
              if (o.dead || o.team === p.team || o.deployLeft > 0) continue;
              if (U.dist(o.x, o.y, p.tx, p.ty) <= p.splash + o.radius * 0.5) {
                this.damage(o, p.dmg, p.team, 'splash');
                if (p.poison) o.poison = { dps: p.poison.dps, left: p.poison.duration, team: p.team };
              }
            }
          } else {
            this.damage(p.target, p.dmg, p.team, 'hit');
            if (p.poison) p.target.poison = { dps: p.poison.dps, left: p.poison.duration, team: p.team };
          }
          NS.Audio && NS.Audio.play(p.kind === 'arrow' ? 'hitArrow' : 'hitMelee');
        }
        this.fx.push({ type: 'impact', x: p.tx, y: p.ty, t: 0, life: 0.22, kind: p.kind });
        this.projectiles.splice(i, 1);
        continue;
      }
      const a = U.angle(p.x, p.y, p.tx, p.ty);
      p.x += Math.cos(a) * step;
      p.y += Math.sin(a) * step;
      p.angle = a;
      if (p.arc) {
        p.totalD = p.totalD || d + p.t * p.speed;
        const prog = 1 - d / Math.max(0.01, p.totalD);
        p.z = Math.sin(prog * Math.PI) * Math.min(2.5, p.totalD * 0.28);
      }
    }
  };

  Battle.prototype.tickFx = function (dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t >= f.life) this.fx.splice(i, 1);
    }
  };

  Battle.prototype.finish = function (winner, reason) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.result = {
      winner,
      reason,
      crowns: { player: this.sides.player.crowns, enemy: this.sides.enemy.crowns },
      time: this.time,
    };
    this.log.push({ t: this.time, msg: winner ? winner + ' wins — ' + reason : 'Draw' });
  };

  Battle.prototype.forfeit = function (team) {
    const foe = team === 'player' ? 'enemy' : 'player';
    this.sides[foe].crowns = Math.max(this.sides[foe].crowns, 1);
    this.finish(foe, 'opponent left');
  };

  NS.Battle = Battle;
  NS.canTarget = canTarget;
})(window.COC);

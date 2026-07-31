/* Clash of Critters — ai.js
 * A rule-based opponent. It reads the same battle state the player sees and
 * decides between defending a threat, answering with a spell, or building a push.
 *
 * The brain is written entirely in "my frame": a coordinate space where the
 * AI's own towers sit at low y and it advances toward high y. Because the arena
 * is symmetric about the river, mirroring is a single subtraction, which lets
 * the same code drive either side (handy for AI-vs-AI balance runs).
 *
 * Difficulty changes three things: how fast it reacts, how much elixir it is
 * willing to commit, and how often it deliberately picks a worse answer.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const Cards = NS.Cards;
  const ARENA = NS.ARENA;

  /* Every knob is ordered so that a higher difficulty is strictly better play:
   *   reaction    how long before it answers a new push        (lower  = better)
   *   mistake     chance of deliberately picking a worse card  (lower  = better)
   *   spellSkill  how much it trusts its own spell evaluation   (higher = better)
   *   reserve     elixir kept back after committing to a push   (higher = better)
   *   punish      does it notice when the opponent is broke?
   * Two things are deliberately NOT skill axes. Answering ever-smaller threats
   * is not better play — a lone cheap unit is the tower's job — so `minThreat`
   * is the same for everyone. And `reserve` has to stay small: hoarding past
   * the elixir cap wastes income, which loses more games than it saves.
   */
  const MIN_THREAT = 0.95;

  const DIFFICULTY = {
    easy: {
      label: 'Sprout', reaction: 1.7, tickEvery: 0.5, mistake: 0.45,
      reserve: 0.0, pushAt: 9.5, spellSkill: 0.3, punish: false, overDefend: 1.9,
      sloppy: 1.7, finisher: false,
    },
    normal: {
      label: 'Scrapper', reaction: 1.15, tickEvery: 0.35, mistake: 0.30,
      reserve: 1.0, pushAt: 8.5, spellSkill: 0.55, punish: false, overDefend: 1.5,
      sloppy: 1.1, finisher: false,
    },
    hard: {
      label: 'Champion', reaction: 0.45, tickEvery: 0.22, mistake: 0.05,
      reserve: 1.5, pushAt: 8.0, spellSkill: 0.9, punish: true, overDefend: 1.05,
      sloppy: 0.3, finisher: true,
    },
    insane: {
      label: 'Legend', reaction: 0.28, tickEvery: 0.16, mistake: 0.0,
      reserve: 1.5, pushAt: 8.0, spellSkill: 1.0, punish: true, overDefend: 0.95,
      sloppy: 0, finisher: true,
    },
  };

  // Minimum wall-clock gap between two deploys, so a fast think rate does not
  // turn into dumping three cards on one threat.
  const COMMIT_GAP = 0.7;

  // --------------------------------------------------------------- roles
  function roleOf(c) {
    if (c.kind === 'spell') return 'spell';
    if (c.kind === 'building') return c.spawner ? 'spawner' : 'building';
    if (c.targets === 'buildings') return 'winCondition';
    if (c.hp * c.count >= 2200) return 'tank';
    if ((c.range || 0) >= 4.5) return 'support';
    if (c.count >= 3) return 'swarm';
    return 'melee';
  }
  function hitsAir(c) {
    if (c.kind === 'spell') return c.spell.targets === 'both' || c.spell.targets === 'air';
    return c.targets === 'both' || c.targets === 'air';
  }
  function isSplash(c) {
    if (c.kind === 'spell') return true;
    return (c.splash || 0) > 0;
  }

  // --------------------------------------------------------------- AI
  function AI(battle, difficulty, seed, team) {
    this.b = battle;
    this.team = team || 'enemy';
    this.foe = this.team === 'enemy' ? 'player' : 'enemy';
    // 'enemy' already defends the low-y end, so only 'player' needs mirroring
    this.mirror = this.team === 'player';
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.difficulty = difficulty || 'normal';
    this.rng = U.rng((seed == null ? 12345 : seed) ^ 0x9e37);
    this.tick = 0;
    this.reactUntil = null;
    this.lastAction = -99;
    this.pushLane = this.rng.chance(0.5) ? 0 : 1;
  }

  AI.DIFFICULTY = DIFFICULTY;

  /** world y -> my frame, and back (the arena is symmetric, so it is its own inverse). */
  AI.prototype.fy = function (y) { return this.mirror ? ARENA.h - y : y; };

  AI.prototype.update = function (dt) {
    const b = this.b;
    if (b.phase !== 'regular' && b.phase !== 'overtime') return;
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = this.cfg.tickEvery;
    this.think();
  };

  AI.prototype.hand = function () {
    return this.b.sides[this.team].hand.map((id, i) => ({ i, id, c: Cards.get(id) }));
  };

  AI.prototype.affordable = function () {
    const el = this.b.sides[this.team].elixir;
    return this.hand().filter((h) => h.c.cost <= el);
  };

  AI.prototype.myTowers = function () {
    return this.b.sides[this.team].towers.filter((t) => !t.dead);
  };

  // ------------------------------------------------------------- sensing
  /** Enemy units that have reached my half or are about to cross, in my frame. */
  AI.prototype.threats = function () {
    const b = this.b;
    const out = [];
    for (const e of b.entities) {
      if (e.dead || e.team !== this.foe) continue;
      if (e.etype !== 'unit' && e.etype !== 'building') continue;
      const y = this.fy(e.y);
      if (y > ARENA.riverBot + 3.5) continue;
      out.push({ x: e.x, y, hp: e.hp, radius: e.radius, flying: e.flying, card: e.card });
    }
    // count units still materialising so answers can be pre-placed
    for (const p of b.pending) {
      if (p.team !== this.foe) continue;
      const y = this.fy(p.y);
      if (y > ARENA.riverBot + 3.5) continue;
      out.push({ x: p.x, y, hp: p.card.hp || 1, radius: p.card.radius, flying: !!p.card.air, card: p.card });
    }
    return out;
  };

  function clusterOf(list) {
    if (!list.length) return null;
    // group by lane, then answer whichever side is heavier
    const left = list.filter((e) => e.x < 9);
    const right = list.filter((e) => e.x >= 9);
    const weigh = (arr) => arr.reduce((s, e) => s + (e.hp || 100) / 800 + 0.4, 0);
    const pick = weigh(left) >= weigh(right) ? left : right;
    if (!pick.length) return null;
    let sx = 0, sy = 0, hp = 0, air = 0, ground = 0, maxHp = 0;
    pick.forEach((e) => {
      sx += e.x; sy += e.y; hp += e.hp || 100;
      if (e.flying) air++; else ground++;
      maxHp = Math.max(maxHp, e.hp || 0);
    });
    return {
      units: pick, n: pick.length,
      x: sx / pick.length, y: sy / pick.length,
      hp, air, ground, maxHp,
      allAir: ground === 0 && air > 0,
      swarm: pick.length >= 3,
      tank: maxHp >= 1800,
      score: hp / 700 + pick.length * 0.35,
    };
  }

  // ------------------------------------------------------------- scoring
  AI.prototype.scoreDefence = function (h, cl) {
    const c = h.c;
    let s = 0;
    const role = roleOf(c);

    if (cl.allAir && !hitsAir(c)) return -999;
    if (cl.air > 0 && cl.ground > 0 && !hitsAir(c)) s -= 2.5;
    if (role === 'winCondition') return -999;   // never a defender

    if (c.kind === 'spell') {
      const sp = c.spell;
      if (sp.effect === 'heal') return -999;
      let kills = 0, hits = 0;
      cl.units.forEach((e) => {
        if (U.dist(e.x, e.y, cl.x, cl.y) > sp.radius) return;
        if (e.flying && sp.targets === 'ground') return;
        hits++;
        if ((e.hp || 0) <= (sp.dmg || 0)) kills++;
      });
      if (sp.effect === 'freeze') s += cl.score * 0.8;
      s += kills * 2.2 + hits * 0.5;
      if (kills < 2 && c.cost >= 4) s -= 3;    // do not waste a big spell on one unit
      s *= this.cfg.spellSkill;
      return s;
    }

    if (cl.swarm && isSplash(c)) s += 3.2;
    if (cl.swarm && !isSplash(c) && role !== 'swarm') s -= 1.2;
    if (cl.tank && (role === 'building' || role === 'swarm')) s += 2.4;
    if (cl.tank && role === 'support') s += 1.2;
    if (role === 'building' && cl.units.some((e) => e.card && e.card.targets === 'buildings')) s += 3.5;

    const dps = c.dmg ? (c.dmg / c.hitSpeed) * c.count : 0;
    const hp = (c.hp || 0) * c.count;
    s += (dps / 130 + hp / 1600) * 1.4;
    s += (cl.score - c.cost) * 0.35;          // elixir trade
    return s;
  };

  AI.prototype.scoreOffence = function (h) {
    const c = h.c;
    const role = roleOf(c);
    if (c.kind === 'spell') return -999;      // spells are for defence and finishing
    let s = 0;
    if (role === 'winCondition') s += 4;
    if (role === 'tank') s += 3;
    if (role === 'support') s += 1.6;
    if (role === 'swarm') s += 0.6;
    if (role === 'melee') s += 0.9;
    if (role === 'building' || role === 'spawner') s -= 2;
    s += Cards.threat(c) * 0.25;
    return s;
  };

  // ------------------------------------------------------------- placement
  /** All placements are computed in my frame and converted on the way out. */
  AI.prototype.defencePlace = function (h, cl) {
    const c = h.c;
    const role = roleOf(c);
    if (c.kind === 'spell') return { x: cl.x, y: cl.y };

    const towers = this.myTowers()
      .filter((t) => t.towerKind === 'princess')
      .map((t) => ({ x: t.x, y: this.fy(t.y) }));
    const king = this.b.king(this.team);
    const tower = towers.length
      ? towers.sort((a, b) => U.dist(a.x, a.y, cl.x, cl.y) - U.dist(b.x, b.y, cl.x, cl.y))[0]
      : { x: king.x, y: this.fy(king.y) };

    let x, y;
    if (role === 'building' || role === 'spawner') {
      // pull attackers toward the middle, away from the tower
      x = U.lerp(tower.x, 9, 0.45);
      y = tower.y + 3.0;
    } else if (role === 'support') {
      x = U.lerp(cl.x, tower.x, 0.4);
      y = Math.max(tower.y + 0.6, cl.y - 4.2);
    } else {
      // melee / swarm: right on top of the threat
      x = cl.x;
      y = Math.max(tower.y + 1.2, cl.y - 1.6);
    }
    // Weaker opponents misjudge the spot; the best ones do not.
    const sl = this.cfg.sloppy;
    if (sl) {
      x += (this.rng() - 0.5) * 2 * sl;
      y += (this.rng() - 0.5) * 2 * sl;
    }
    y = U.clamp(y, 1.8, ARENA.riverTop - 0.4);
    x = U.clamp(x, 1.2, ARENA.w - 1.2);
    return { x, y };
  };

  AI.prototype.offencePlace = function (h) {
    const c = h.c;
    const role = roleOf(c);
    const laneX = ARENA.bridges[this.pushLane];
    if (role === 'winCondition') {
      return { x: laneX, y: ARENA.riverTop - 0.6 };
    }
    if (role === 'tank') {
      // heavy tanks start at the back so support can catch up
      return { x: U.clamp(laneX + (this.pushLane === 0 ? 1.2 : -1.2), 2, ARENA.w - 2), y: 3.2 };
    }
    if (role === 'support' || role === 'swarm') {
      const anchor = this.pushAnchor();
      if (anchor) return { x: U.clamp(anchor.x, 1.5, ARENA.w - 1.5), y: U.clamp(anchor.y - 2.6, 1.8, ARENA.riverTop - 0.4) };
      return { x: laneX, y: 5.0 };
    }
    return { x: laneX, y: ARENA.riverTop - 1.2 };
  };

  /** How much of my own stuff is already fighting near a threat, on cl.score's scale. */
  AI.prototype.defenceOnField = function (cl) {
    let s = 0;
    for (const e of this.b.entities) {
      if (e.dead || e.team !== this.team) continue;
      if (e.etype === 'tower') continue;
      if (U.dist(e.x, this.fy(e.y), cl.x, cl.y) > 6.5) continue;
      const dps = e.dmg ? e.dmg / e.hitSpeed : 0;
      s += e.hp / 700 + dps / 260;
    }
    for (const p of this.b.pending) {
      if (p.team !== this.team) continue;
      if (U.dist(p.x, this.fy(p.y), cl.x, cl.y) > 6.5) continue;
      s += (p.card.hp || 0) / 700 + 0.35;
    }
    return s;
  };

  /** My most advanced unit on my own half — the head of a push under construction. */
  AI.prototype.pushAnchor = function () {
    let best = null;
    for (const e of this.b.entities) {
      if (e.dead || e.team !== this.team || e.etype !== 'unit') continue;
      const y = this.fy(e.y);
      if (y > ARENA.riverBot + 6) continue;
      if (!best || y > best.y) best = { x: e.x, y };
    }
    return best;
  };

  /** A damage spell in hand that would finish off an enemy tower outright. */
  AI.prototype.spellFinisher = function () {
    const el = this.b.sides[this.team].elixir;
    for (const h of this.hand()) {
      const c = h.c;
      if (c.kind !== 'spell' || c.cost > el) continue;
      const sp = c.spell;
      if (!sp.dmg) continue;
      const toTower = sp.dmg * sp.towerMult;
      for (const t of this.b.sides[this.foe].towers) {
        if (t.dead || t.hp > toTower) continue;
        return { i: h.i, x: t.x, y: t.y };
      }
    }
    return null;
  };

  // ------------------------------------------------------------- brain
  AI.prototype.think = function () {
    const b = this.b;
    const side = b.sides[this.team];
    const el = side.elixir;
    const now = b.time;
    const cfg = this.cfg;

    const cl = clusterOf(this.threats());

    // --- 1. defend whatever is walking at me
    if (cl && cl.score > MIN_THREAT) {
      if (this.reactUntil == null) this.reactUntil = now + cfg.reaction;
      if (now < this.reactUntil) return;
      if (now - this.lastAction < COMMIT_GAP) return;
      // Already committed enough to this push? Save the elixir.
      if (this.defenceOnField(cl) >= cl.score * cfg.overDefend) return;

      const opts = this.hand()
        .map((h) => ({ h, s: this.scoreDefence(h, cl) }))
        .filter((o) => o.s > -900 && o.h.c.cost <= el)
        .sort((a, bb) => bb.s - a.s);
      if (!opts.length) return;

      let choice = opts[0];
      if (this.rng.chance(cfg.mistake) && opts.length > 1) {
        choice = opts[this.rng.int(1, opts.length - 1)];
      }
      if (choice.s < 0.4) return;            // no answer is worth the elixir yet

      const pos = this.defencePlace(choice.h, cl);
      const r = b.play(this.team, choice.h.i, pos.x, this.fy(pos.y));
      if (r.ok) {
        this.lastAction = now;
        this.reactUntil = now + cfg.reaction * 0.7;
      }
      return;
    }
    this.reactUntil = null;

    // --- 2. finish a tower that a spell can reach on its own
    if (cfg.finisher) {
      const kill = this.spellFinisher();
      if (kill) {
        const r = b.play(this.team, kill.i, kill.x, kill.y);
        if (r.ok) { this.lastAction = now; return; }
      }
    }

    // --- 3. build or extend a push
    const anchor = this.pushAnchor();
    // Strong AI also strikes when the opponent has just emptied their bar.
    const opponentBroke = cfg.punish && b.sides[this.foe].elixir < 2.5;
    const bigPush = el >= cfg.pushAt || opponentBroke;
    if (!bigPush && !anchor) return;
    if (now - this.lastAction < COMMIT_GAP * 1.6) return;

    const opts = this.affordable()
      .map((h) => ({ h, s: this.scoreOffence(h) }))
      .filter((o) => o.s > -900)
      .sort((a, bb) => bb.s - a.s);
    if (!opts.length) return;

    let choice = opts[0];
    if (this.rng.chance(cfg.mistake * 0.7) && opts.length > 1) choice = opts[1];
    // Keep something back for the counter-push — unless the bar is about to
    // overflow, in which case not spending is the bigger mistake.
    const overflowing = el >= 9.4;
    if (!overflowing && choice.h.c.cost > el - cfg.reserve) return;

    const pos = this.offencePlace(choice.h);
    const r = b.play(this.team, choice.h.i, pos.x, this.fy(pos.y));
    if (r.ok) {
      this.lastAction = now;
      if (this.rng.chance(0.18)) this.pushLane = 1 - this.pushLane;
    }
  };

  NS.AI = AI;
  NS.AI_DIFFICULTY = DIFFICULTY;
})(window.COC);
